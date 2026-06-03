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


def get_sobel_map(img_gray):
    sobel_x = cv2.Sobel(img_gray, cv2.CV_64F, 1, 0, ksize=3)
    sobel_y = cv2.Sobel(img_gray, cv2.CV_64F, 0, 1, ksize=3)
    sobel   = np.sqrt(sobel_x**2 + sobel_y**2)
    return np.clip(sobel / (sobel.max() + 1e-8) * 255, 0, 255).astype(np.uint8)


def auto_crop_artifact(img_bgr, padding_ratio=0.08, min_area_ratio=0.01):
    img_rgb   = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    h, w      = img_rgb.shape[:2]
    gray      = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    gray_blur = cv2.GaussianBlur(gray, (5, 5), 0)

    _, otsu_bg  = cv2.threshold(gray_blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    otsu_fg     = cv2.bitwise_not(otsu_bg)
    adaptive_fg = cv2.adaptiveThreshold(gray_blur, 255,
                    cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 51, 5)
    artifact_mask = cv2.bitwise_or(otsu_fg, adaptive_fg)
    artifact_mask = cv2.morphologyEx(artifact_mask, cv2.MORPH_CLOSE, np.ones((9,9), np.uint8))
    artifact_mask = cv2.morphologyEx(artifact_mask, cv2.MORPH_OPEN,  np.ones((5,5), np.uint8))

    contours, _ = cv2.findContours(artifact_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return img_rgb, (0, 0, w, h)

    contours = [c for c in contours if cv2.contourArea(c) >= h*w*min_area_ratio]
    if not contours:
        return img_rgb, (0, 0, w, h)

    x, y, bw, bh = cv2.boundingRect(max(contours, key=cv2.contourArea))
    pad = int(max(bw, bh) * padding_ratio)
    x1, y1 = max(0, x-pad), max(0, y-pad)
    x2, y2 = min(w, x+bw+pad), min(h, y+bh+pad)
    return img_rgb[y1:y2, x1:x2], (x1, y1, x2, y2)


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


def preprocess(img_bgr):
    cropped_rgb, bbox = auto_crop_artifact(img_bgr)
    cropped_bgr = cv2.cvtColor(cropped_rgb, cv2.COLOR_RGB2BGR)
    gray  = cv2.cvtColor(cropped_bgr, cv2.COLOR_BGR2GRAY)
    image = np.dstack([cropped_rgb, get_sobel_map(gray)])

    transform = A.Compose([
        A.Resize(IMAGE_SIZE, IMAGE_SIZE),
        A.Normalize(
            mean=[0.485, 0.456, 0.406, 0.5],
            std=[0.229, 0.224, 0.225, 0.5]
        ),
        ToTensorV2(),
    ], is_check_shapes=False)

    aug    = transform(image=image, mask=np.zeros(image.shape[:2], dtype=np.float32))
    tensor = aug['image'].unsqueeze(0).to(DEVICE)
    return tensor, cropped_rgb


def predict(seg_model, cls_model, img_bgr, seg_threshold=0.15, cls_threshold=0.5):
    tensor, cropped_rgb = preprocess(img_bgr)

    with torch.no_grad():
        # 원본
        seg_out1, _ = seg_model(tensor)
        _, cls_out1 = cls_model(tensor)

        # 좌우반전
        tensor_lr = torch.flip(tensor, dims=[3])
        seg_out2, _ = seg_model(tensor_lr)
        _, cls_out2 = cls_model(tensor_lr)
        seg_out2 = torch.flip(seg_out2, dims=[3])

        # 상하반전
        tensor_ud = torch.flip(tensor, dims=[2])
        seg_out3, _ = seg_model(tensor_ud)
        _, cls_out3 = cls_model(tensor_ud)
        seg_out3 = torch.flip(seg_out3, dims=[2])

        # segmentation 평균
        seg_prob = (
            torch.sigmoid(seg_out1) +
            torch.sigmoid(seg_out2) +
            torch.sigmoid(seg_out3)
        ) / 3.0

        # classification 평균
        cls_prob = (
            torch.sigmoid(cls_out1) +
            torch.sigmoid(cls_out2) +
            torch.sigmoid(cls_out3)
        ) / 3.0

    pred_mask = (seg_prob > seg_threshold).float().cpu().squeeze().numpy()
    cls_probs = cls_prob.cpu().squeeze().numpy()

    labels = {
        CLASS_NAMES[i]: float(cls_probs[i])
        for i in range(NUM_CLASSES)
    }

    img_vis = cv2.resize(cropped_rgb, (IMAGE_SIZE, IMAGE_SIZE))

    overlay = img_vis.copy().astype(np.float32) / 255.0
    overlay[pred_mask > 0] = [1, 0, 0]

    blended = (
        img_vis.astype(np.float32) / 255.0 * 0.6 +
        overlay * 0.4
    )
    blended = (blended * 255).astype(np.uint8)

    return {
        'cropped': img_vis,
        'mask': (pred_mask * 255).astype(np.uint8),
        'overlay': blended,
        'labels': labels,
    }