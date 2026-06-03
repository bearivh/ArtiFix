import cv2
import numpy as np
import torch
import torch.nn as nn
import segmentation_models_pytorch as smp
import albumentations as A
from albumentations.pytorch import ToTensorV2

DEVICE      = 'cuda' if torch.cuda.is_available() else 'cpu'
IMAGE_SIZE  = 256
IN_CHANNELS = 4
NUM_CLASSES = 3
CLASS_NAMES = ['crack', 'surface_damage', 'discoloration']

CROP_MIN_AREA_RATIO = 0.35
CROP_MIN_HEIGHT_RATIO = 0.4
MIN_BBOX_RATIO = 0.001
MIN_BBOX_AREA = 300
MORPH_KERNEL = np.ones((3, 3), np.uint8)
ARTIFACT_FG_CLOSE_KERNEL = np.ones((25, 25), np.uint8)
ARTIFACT_FG_OPEN_KERNEL = np.ones((10, 10), np.uint8)
MIN_HOLE_AREA = 150


def get_sobel_map(img_gray):
    sobel_x = cv2.Sobel(img_gray, cv2.CV_64F, 1, 0, ksize=3)
    sobel_y = cv2.Sobel(img_gray, cv2.CV_64F, 0, 1, ksize=3)
    sobel   = np.sqrt(sobel_x**2 + sobel_y**2)
    return np.clip(sobel / (sobel.max() + 1e-8) * 255, 0, 255).astype(np.uint8)


def _model_input_compose(target_size=IMAGE_SIZE):
    """학습과 동일: 모델 입력만 target_size × target_size 로 리사이즈."""
    return A.Compose([
        A.Resize(target_size, target_size),
        A.Normalize(
            mean=[0.485, 0.456, 0.406, 0.5],
            std=[0.229, 0.224, 0.225, 0.5],
        ),
        ToTensorV2(),
    ], is_check_shapes=False)


def resize_mask_to_crop(mask, crop_w, crop_h, is_binary=False):
    """256 모델 출력 → crop 원본 해상도."""
    interp = cv2.INTER_NEAREST if is_binary else cv2.INTER_LINEAR
    return cv2.resize(mask, (crop_w, crop_h), interpolation=interp)


def refine_artifact_mask(mask_uint8):
    """유물 마스크 경계 보정 — 회색 배경에서 누수 줄이기."""
    refined = cv2.morphologyEx(mask_uint8, cv2.MORPH_CLOSE, ARTIFACT_FG_CLOSE_KERNEL)
    refined = cv2.morphologyEx(refined, cv2.MORPH_OPEN, ARTIFACT_FG_OPEN_KERNEL)
    return refined


def artifact_foreground_filled(cropped_artifact_mask, crop_h, crop_w):
    """Auto crop artifact_mask → crop 해상도 filled mask (0~255)."""
    fg = cropped_artifact_mask
    if fg.shape[:2] != (crop_h, crop_w):
        fg = cv2.resize(fg, (crop_w, crop_h), interpolation=cv2.INTER_NEAREST)
    return artifact_mask_to_filled(fg)


def build_bboxes_from_mask(pred_mask, crop_h, crop_w):
    """connected components → 작은 영역 제거 후 bbox."""
    min_area = max(MIN_BBOX_AREA, MIN_BBOX_RATIO * crop_h * crop_w)
    mask_uint8 = (pred_mask > 0).astype(np.uint8) * 255
    contours, _ = cv2.findContours(mask_uint8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    bboxes = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area:
            continue
        x, y, w, h = cv2.boundingRect(cnt)
        bboxes.append({'x': int(x), 'y': int(y), 'w': int(w), 'h': int(h), 'area': float(area)})
    return bboxes


def build_artifact_mask_hsv(img_bgr):
    """밝기 + 채도 + edge 기반 유물 후보 마스크 (그림자 제거)."""
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
    _, S, V = cv2.split(hsv)
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    gray_blur = cv2.GaussianBlur(gray, (5, 5), 0)

    _, otsu = cv2.threshold(
        gray_blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
    )

    sat_mask = (S > 25).astype(np.uint8) * 255
    edges = cv2.Canny(gray_blur, 50, 150)
    edges = cv2.dilate(edges, np.ones((5, 5), np.uint8), iterations=1)

    artifact_mask = cv2.bitwise_or(otsu, sat_mask)
    artifact_mask = cv2.bitwise_or(artifact_mask, edges)

    shadow_like = ((S < 25) & (V < 180)).astype(np.uint8) * 255
    artifact_mask = cv2.bitwise_and(artifact_mask, cv2.bitwise_not(shadow_like))

    kernel_close = np.ones((9, 9), np.uint8)
    kernel_open = np.ones((5, 5), np.uint8)
    artifact_mask = cv2.morphologyEx(artifact_mask, cv2.MORPH_CLOSE, kernel_close)
    artifact_mask = cv2.morphologyEx(artifact_mask, cv2.MORPH_OPEN, kernel_open)
    return artifact_mask


def artifact_mask_to_filled(mask_uint8):
    """유물 contour를 채운 마스크 (crop 원본 해상도)."""
    h, w = mask_uint8.shape[:2]
    mask_uint8 = refine_artifact_mask(mask_uint8)
    contours, _ = cv2.findContours(mask_uint8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return np.zeros((h, w), dtype=np.uint8)

    largest = max(contours, key=cv2.contourArea)
    filled = np.zeros((h, w), dtype=np.uint8)
    cv2.drawContours(filled, [largest], -1, 255, thickness=cv2.FILLED)
    return filled


def auto_crop_artifact_v3(img_bgr, padding_ratio=0.01, min_area_ratio=0.01):
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    h, w = img_rgb.shape[:2]
    artifact_mask = build_artifact_mask_hsv(img_bgr)

    contours, _ = cv2.findContours(
        artifact_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    if not contours:
        return img_rgb, (0, 0, w, h), artifact_mask

    min_area = h * w * min_area_ratio
    contours = [c for c in contours if cv2.contourArea(c) >= min_area]
    if not contours:
        return img_rgb, (0, 0, w, h), artifact_mask

    largest = max(contours, key=cv2.contourArea)
    x, y, bw, bh = cv2.boundingRect(largest)
    pad = int(max(bw, bh) * padding_ratio)
    x1 = max(0, x - pad)
    y1 = max(0, y - pad)
    x2 = min(w, x + bw + pad)
    y2 = min(h, y + bh + pad)
    cropped_rgb = img_rgb[y1:y2, x1:x2]
    return cropped_rgb, (x1, y1, x2, y2), artifact_mask


def auto_crop_artifact(img_bgr, **kwargs):
    cropped_rgb, bbox, _ = auto_crop_artifact_v3(img_bgr, **kwargs)
    return cropped_rgb, bbox


def _artifact_filled_mask(cropped_rgb):
    """가장 큰 유물 contour를 채운 마스크 + 밝은 배경 마스크 (crop 해상도)."""
    h, w = cropped_rgb.shape[:2]
    cropped_bgr = cv2.cvtColor(cropped_rgb, cv2.COLOR_RGB2BGR)
    artifact_mask = refine_artifact_mask(build_artifact_mask_hsv(cropped_bgr))

    gray = cv2.cvtColor(cropped_bgr, cv2.COLOR_BGR2GRAY)
    gray_blur = cv2.GaussianBlur(gray, (5, 5), 0)
    _, otsu_bg = cv2.threshold(gray_blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    contours, _ = cv2.findContours(artifact_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return np.zeros((h, w), dtype=np.uint8), otsu_bg

    largest = max(contours, key=cv2.contourArea)
    artifact_filled = np.zeros((h, w), dtype=np.uint8)
    cv2.drawContours(artifact_filled, [largest], -1, 255, thickness=cv2.FILLED)
    return artifact_filled, otsu_bg


def detect_internal_holes(cropped_rgb, min_hole_area=MIN_HOLE_AREA):
    """
    유물 내부의 구멍/결손 영역 탐지
    - 유물 외곽 마스크 구하기
    - 내부에서 배경색(밝은 영역) 찾기
    - 너무 작은 노이즈 제거
    """
    h, w = cropped_rgb.shape[:2]
    artifact_filled, otsu_bg = _artifact_filled_mask(cropped_rgb)
    if not artifact_filled.any():
        return np.zeros((h, w), dtype=np.uint8)

    bright_mask = otsu_bg.copy()
    hole_mask = cv2.bitwise_and(bright_mask, artifact_filled)

    contours_hole, _ = cv2.findContours(hole_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    clean_hole_mask = np.zeros((h, w), dtype=np.uint8)
    for cnt in contours_hole:
        if cv2.contourArea(cnt) >= min_hole_area:
            cv2.drawContours(clean_hole_mask, [cnt], -1, 255, thickness=cv2.FILLED)

    return clean_hole_mask


class ArtiFix(nn.Module):
    def __init__(self, use_multitask=True):
        super().__init__()
        self.use_multitask = use_multitask
        self.unet = smp.Unet(
            encoder_name    = 'efficientnet-b2',
            encoder_weights = None,
            in_channels     = IN_CHANNELS,
            classes         = 1,
            activation      = None,
        )
        bottleneck_ch = self.unet.encoder.out_channels[-1]
        self.cls_head = nn.Sequential(
            nn.AdaptiveAvgPool2d(1), nn.Flatten(),
            nn.Linear(bottleneck_ch, 128), nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(128, NUM_CLASSES),
        ) if use_multitask else None

    def forward(self, x):
        features    = self.unet.encoder(x)
        decoder_out = self.unet.decoder(features)
        seg_out     = self.unet.segmentation_head(decoder_out)
        cls_out     = self.cls_head(features[-1]) if self.cls_head else None
        return seg_out, cls_out


def load_model(weights_path: str, use_multitask=True):
    model = ArtiFix(use_multitask=use_multitask).to(DEVICE)
    checkpoint = torch.load(weights_path, map_location=DEVICE)
    model.load_state_dict(checkpoint['model_state'])
    model.eval()
    return model


def preprocess(img_bgr, use_auto_crop=True):
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    h, w = img_rgb.shape[:2]
    artifact_mask_full = build_artifact_mask_hsv(img_bgr)
    fallback = False
    crop_ratio = 1.0
    bbox = [0, 0, w, h]

    if not use_auto_crop:
        cropped_rgb = img_rgb
        cropped_artifact_mask = artifact_mask_full
        print({
            'crop_ratio': 1.0,
            'bbox': bbox,
            'fallback': False,
            'use_auto_crop': False,
        })
    else:
        cropped_rgb, bbox_tuple, artifact_mask = auto_crop_artifact_v3(img_bgr)
        x1, y1, x2, y2 = bbox_tuple
        bbox_w = x2 - x1
        bbox_h = y2 - y1
        crop_ratio = (bbox_w * bbox_h) / (w * h) if w * h else 0.0
        bbox = [int(x1), int(y1), int(x2), int(y2)]

        fallback = (
            crop_ratio < CROP_MIN_AREA_RATIO
            or bbox_h < h * CROP_MIN_HEIGHT_RATIO
        )

        if fallback:
            cropped_rgb = img_rgb
            cropped_artifact_mask = artifact_mask_full
        elif (x1, y1, x2, y2) == (0, 0, w, h):
            cropped_artifact_mask = artifact_mask
        else:
            cropped_artifact_mask = artifact_mask[y1:y2, x1:x2]

        print({
            'crop_ratio': round(crop_ratio, 4),
            'bbox': bbox,
            'fallback': fallback,
            'use_auto_crop': True,
        })

    cropped_bgr = cv2.cvtColor(cropped_rgb, cv2.COLOR_RGB2BGR)
    gray  = cv2.cvtColor(cropped_bgr, cv2.COLOR_BGR2GRAY)
    image = np.dstack([cropped_rgb, get_sobel_map(gray)])

    transform = _model_input_compose(IMAGE_SIZE)

    aug    = transform(image=image, mask=np.zeros(image.shape[:2], dtype=np.float32))
    tensor = aug['image'].unsqueeze(0).to(DEVICE)
    return tensor, cropped_rgb, cropped_artifact_mask


def predict(seg_model, cls_model, img_bgr, seg_threshold=0.10, cls_threshold=0.5, use_auto_crop=True):
    tensor, cropped_rgb, cropped_artifact_mask = preprocess(img_bgr, use_auto_crop=use_auto_crop)
    crop_h, crop_w = cropped_rgb.shape[:2]
    artifact_filled = artifact_foreground_filled(cropped_artifact_mask, crop_h, crop_w)
    artifact_fg_f = artifact_filled.astype(np.float32) / 255.0

    with torch.no_grad():
        # ── Multi-scale Inference ──────────────────────
        seg_probs_ms = []
        for scale in [384, 448, 512]:
            transform_scale = _model_input_compose(scale)

            cropped_bgr_ms = cv2.cvtColor(cropped_rgb, cv2.COLOR_RGB2BGR)
            gray_ms = cv2.cvtColor(cropped_bgr_ms, cv2.COLOR_BGR2GRAY)
            image_ms = np.dstack([cropped_rgb, get_sobel_map(gray_ms)])
            aug_ms = transform_scale(
                image=image_ms,
                mask=np.zeros(image_ms.shape[:2], dtype=np.float32),
            )
            t = aug_ms['image'].unsqueeze(0).to(DEVICE)

            # TTA — 원본 + 좌우반전 + 상하반전
            seg_out1, _ = seg_model(t)
            seg_out2, _ = seg_model(torch.flip(t, dims=[3]))
            seg_out3, _ = seg_model(torch.flip(t, dims=[2]))

            seg_out2 = torch.flip(seg_out2, dims=[3])
            seg_out3 = torch.flip(seg_out3, dims=[2])

            seg_prob = (
                torch.sigmoid(seg_out1)
                + torch.sigmoid(seg_out2)
                + torch.sigmoid(seg_out3)
            ) / 3.0

            seg_prob_np = seg_prob.squeeze().cpu().numpy()
            seg_prob_np = cv2.resize(seg_prob_np, (IMAGE_SIZE, IMAGE_SIZE))
            seg_probs_ms.append(seg_prob_np)

        seg_prob_final = np.mean(seg_probs_ms, axis=0)

        # Classification TTA — 256 기준 tensor
        _, cls_out1 = cls_model(tensor)
        _, cls_out2 = cls_model(torch.flip(tensor, dims=[3]))
        _, cls_out3 = cls_model(torch.flip(tensor, dims=[2]))
        cls_prob = (
            torch.sigmoid(cls_out1)
            + torch.sigmoid(cls_out2)
            + torch.sigmoid(cls_out3)
        ) / 3.0

    # 1. probability map → threshold
    seg_prob_crop = resize_mask_to_crop(seg_prob_final, crop_w, crop_h, is_binary=False)
    final_mask = (seg_prob_crop > seg_threshold).astype(np.float32)

    # 2. 유물 foreground 밖 제거
    final_mask = final_mask * (artifact_filled.astype(np.float32) / 255.0)

    # 3. morphology open — 작은 잡음 제거
    final_mask = cv2.morphologyEx(
        final_mask.astype(np.uint8), cv2.MORPH_OPEN, MORPH_KERNEL, iterations=1
    ).astype(np.float32)

    # 4. morphology close — 끊긴 crack 연결
    final_mask = cv2.morphologyEx(
        final_mask.astype(np.uint8), cv2.MORPH_CLOSE, MORPH_KERNEL, iterations=1
    ).astype(np.float32)

    # 내부 구멍/결손 (유물 내부만)
    hole_mask = detect_internal_holes(cropped_rgb)
    hole_mask = (hole_mask > 0).astype(np.float32)
    final_mask = np.maximum(final_mask, hole_mask)
    final_mask = final_mask * (artifact_filled.astype(np.float32) / 255.0)

    pred_mask = final_mask
    img_vis = cropped_rgb
    vis_h, vis_w = crop_h, crop_w

    print({
        'crop_shape': list(cropped_rgb.shape),
        'final_shape': list(img_vis.shape),
    })

    cls_probs = cls_prob.cpu().squeeze().numpy()

    labels = {
        CLASS_NAMES[i]: float(cls_probs[i])
        for i in range(NUM_CLASSES)
    }

    # 1. 손상 면적 비율
    damage_ratio = float(pred_mask.sum()) / pred_mask.size * 100

    # 2. 손상 심각도 등급
    crack_detected    = labels.get('crack', 0) > cls_threshold
    surface_detected  = labels.get('surface_damage', 0) > cls_threshold
    discolor_detected = labels.get('discoloration', 0) > cls_threshold
    detected_count    = sum([crack_detected, surface_detected, discolor_detected])

    if damage_ratio > 15 or (damage_ratio > 8 and detected_count >= 2):
        severity = 'HIGH'
    elif damage_ratio > 5 or detected_count >= 2:
        severity = 'MEDIUM'
    elif damage_ratio > 1 or detected_count >= 1:
        severity = 'LOW'
    else:
        severity = 'NONE'

    mask_uint8 = (pred_mask * 255).astype(np.uint8)
    contours, _  = cv2.findContours(mask_uint8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    bboxes = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < 30:  # 너무 작은 노이즈 제거
            continue
        x, y, w, h = cv2.boundingRect(cnt)
        bboxes.append({'x': int(x), 'y': int(y), 'w': int(w), 'h': int(h), 'area': float(area)})

    overlay = img_vis.copy().astype(np.float32) / 255.0
    overlay[pred_mask > 0] = [1, 0, 0]
    blended = img_vis.astype(np.float32) / 255.0 * 0.6 + overlay * 0.4

    for bbox in bboxes:
        cv2.rectangle(
            blended,
            (bbox['x'], bbox['y']),
            (bbox['x'] + bbox['w'], bbox['y'] + bbox['h']),
            (1.0, 1.0, 0.0),
            1,
        )
    blended = (blended * 255).astype(np.uint8)

    def make_class_mask(mask, confidence, threshold=0.5):
        if confidence >= threshold:
            return (mask * 255).astype(np.uint8)
        return np.zeros((vis_h, vis_w), dtype=np.uint8)

    class_masks = {
        'crack': make_class_mask(pred_mask, labels['crack'], cls_threshold),
        'surface_damage': make_class_mask(pred_mask, labels['surface_damage'], cls_threshold),
        'discoloration': make_class_mask(pred_mask, labels['discoloration'], cls_threshold),
    }

    mask_binary = (pred_mask * 255).astype(np.uint8)

    # Grad-CAM 생성
    try:
        cam_tensor = tensor.detach().clone().requires_grad_(True)
        cam = get_gradcam(cls_model, cam_tensor)
        cam_vis = resize_mask_to_crop(cam, crop_w, crop_h, is_binary=False)
        gradcam_overlay = apply_gradcam_heatmap(img_vis, cam_vis)
    except Exception as e:
        print(f'Grad-CAM 실패: {e}')
        gradcam_overlay = img_vis.copy()

    return {
        'cropped':      img_vis,
        'mask':         mask_binary,
        'overlay':      blended,
        'gradcam':      gradcam_overlay,
        'labels':       labels,
        'class_masks':  class_masks,
        'damage_ratio': round(damage_ratio, 2),
        'severity':     severity,
        'bboxes':       bboxes,
        'bbox_count':   len(bboxes),  # 필터링 후 개수
        'image_width':  int(vis_w),
        'image_height': int(vis_h),
    }


def get_gradcam(model, tensor, target_layer_name='encoder'):
    """Classification Head 기준 Grad-CAM 생성"""

    gradients = []
    activations = []

    def forward_hook(module, input, output):
        activations.append(output)

    def backward_hook(module, grad_input, grad_output):
        gradients.append(grad_output[0])

    # EfficientNet encoder 마지막 레이어에 hook 등록
    target_layer = model.unet.encoder._blocks[-1]
    fh = target_layer.register_forward_hook(forward_hook)
    bh = target_layer.register_full_backward_hook(backward_hook)

    # Forward
    model.eval()
    tensor.requires_grad_(True)
    seg_out, cls_out = model(tensor)

    # Classification 점수 기준으로 backward
    if cls_out is not None:
        score = cls_out.max()
    else:
        score = seg_out.mean()

    model.zero_grad()
    score.backward()

    # Grad-CAM 계산
    grad = gradients[0].squeeze()       # [C, H, W]
    act = activations[0].squeeze()     # [C, H, W]
    weights = grad.mean(dim=(1, 2))       # [C]
    cam = (weights[:, None, None] * act).sum(dim=0)  # [H, W]
    cam = torch.relu(cam)

    # 정규화
    cam = cam.detach().cpu().numpy()
    cam = (cam - cam.min()) / (cam.max() - cam.min() + 1e-8)

    # 원본 크기로 리사이즈
    cam = cv2.resize(cam, (IMAGE_SIZE, IMAGE_SIZE))

    fh.remove()
    bh.remove()

    return cam


def apply_gradcam_heatmap(img_rgb, cam):
    """Grad-CAM heatmap을 이미지에 오버레이"""
    if cam.shape[:2] != img_rgb.shape[:2]:
        cam = cv2.resize(cam, (img_rgb.shape[1], img_rgb.shape[0]))
    heatmap = cv2.applyColorMap(
        (cam * 255).astype(np.uint8), cv2.COLORMAP_JET
    )
    heatmap_rgb = cv2.cvtColor(heatmap, cv2.COLOR_BGR2RGB)
    overlay = (img_rgb.astype(np.float32) * 0.5 +
               heatmap_rgb.astype(np.float32) * 0.5).astype(np.uint8)
    return overlay