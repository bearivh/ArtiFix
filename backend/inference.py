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
MIN_HOLE_AREA = 50
MAX_HOLE_RATIO = 0.08
# 유물 내부 단일 대형 결손(관통 구멍) 허용 상한
MAX_DOMINANT_HOLE_RATIO = 0.40
# 밝은 회색 박물관 배경 제외 (HSV) — 그림자·베이지 배경 포함하도록 완화
GRAY_BG_S_MAX = 55
GRAY_BG_V_MIN = 120
# 적응형: 이미지 밝기 상위 + 저채도
BG_ADAPTIVE_V_PERCENTILE = 58
BG_ADAPTIVE_S_PERCENTILE = 50
# 손상 컴포넌트가 배경 픽셀 비율이 이 이상이면 제거
DAMAGE_BG_COMPONENT_RATIO = 0.45
# 유물 마스크 약한 침식 — 테두리 배경 누수 완화
ARTIFACT_CORE_ERODE_KERNEL = np.ones((3, 3), np.uint8)
ARTIFACT_CORE_ERODE_ITERATIONS = 1
ARTIFACT_CORE_MIN_KEEP_RATIO = 0.3
# edge OR: otsu|sat 후보 dilate 안에서만 (배경 edge 연결 방지)
ARTIFACT_EDGE_ROI_KERNEL = np.ones((7, 7), np.uint8)
# 유물 contour 선택 (프레임 전체 잡힘 방지)
ARTIFACT_MAX_AREA_RATIO = 0.88
ARTIFACT_MIN_AREA_RATIO = 0.015
ARTIFACT_BORDER_MARGIN = 6
ARTIFACT_CAVITY_CLOSE_RATIO = 0.06
ARTIFACT_FILLED_FALLBACK_RATIO = 0.88
# hole: 유물 재질(어두운 부분) 근처의 밝은 cavity
HOLE_NEAR_MATERIAL_RATIO = 0.35
HOLE_MIN_DIST_FROM_SILHOUETTE = 4
HOLE_MORPH_CLOSE = 11


def count_mask_pixels(mask):
    return int((mask > 0).sum())


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


def build_gray_bg_mask(S, V):
    """밝고 채도 낮은 박물관 회색 배경 (고정 HSV)."""
    return ((S < GRAY_BG_S_MAX) & (V > GRAY_BG_V_MIN)).astype(np.uint8) * 255


def build_background_exclusion_mask(img_bgr):
    """
    손상 허용에서 제외할 배경 — 고정 HSV + 적응형 밝기/저채도.
    어두운 유물(금속·도자) 주변 베이지·그림자 배경 FP 완화.
    """
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
    _, S, V = cv2.split(hsv)
    fixed = build_gray_bg_mask(S, V)

    v_thr = float(np.percentile(V, BG_ADAPTIVE_V_PERCENTILE))
    s_thr = float(np.percentile(S, BG_ADAPTIVE_S_PERCENTILE))
    v_cut = max(float(GRAY_BG_V_MIN), v_thr - 8.0)
    s_cut = max(float(GRAY_BG_S_MAX), s_thr + 12.0)
    adaptive = ((V >= v_cut) & (S <= s_cut)).astype(np.uint8) * 255

    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)
    gray_blur = cv2.GaussianBlur(gray, (15, 15), 0)
    # 국소적으로 주변보다 밝고 채도 낮으면 배경
    local_bright = (gray_blur >= np.percentile(gray_blur, 62)).astype(np.uint8) * 255
    local_bg = cv2.bitwise_and(local_bright, (S < s_cut).astype(np.uint8) * 255)

    combined = cv2.bitwise_or(fixed, adaptive)
    combined = cv2.bitwise_or(combined, local_bg)
    kernel = np.ones((5, 5), np.uint8)
    combined = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel, iterations=1)
    return combined


def build_gray_bg_mask_bgr(img_bgr):
    return build_background_exclusion_mask(img_bgr)


def refine_artifact_mask_light(mask_uint8):
    """유물 마스크 경량 보정 — 25×25 close로 배경이 붙는 것 방지."""
    kernel_close = np.ones((9, 9), np.uint8)
    kernel_open = np.ones((5, 5), np.uint8)
    refined = cv2.morphologyEx(mask_uint8, cv2.MORPH_CLOSE, kernel_close)
    refined = cv2.morphologyEx(refined, cv2.MORPH_OPEN, kernel_open)
    return refined


def build_exterior_background_mask(img_bgr, artifact_filled):
    """
    유물 실루엣 밖의 배경만 — 실루엣 안의 밝은 구멍(배경 비침)은 제외하지 않음.
    """
    bg = build_background_exclusion_mask(img_bgr)
    return cv2.bitwise_and(bg, cv2.bitwise_not(artifact_filled))


def build_damage_allowed_mask(cropped_rgb, artifact_filled):
    """손상 허용 = 유물 실루엣 내부 (밝은 내부 구멍 포함)."""
    cropped_bgr = cv2.cvtColor(cropped_rgb, cv2.COLOR_RGB2BGR)
    exterior_bg = build_exterior_background_mask(cropped_bgr, artifact_filled)
    allowed = cv2.bitwise_and(artifact_filled, cv2.bitwise_not(exterior_bg))
    return allowed, exterior_bg


def remove_exterior_damage_components(
    pred_mask, exterior_bg_u8, artifact_filled, max_bg_ratio=DAMAGE_BG_COMPONENT_RATIO
):
    """유물 밖(실루엣 외) 비중이 큰 손상 blob만 제거 — 내부 구멍 손상은 유지."""
    mask_u8 = (pred_mask > 0).astype(np.uint8) * 255
    if not mask_u8.any():
        return pred_mask

    contours, _ = cv2.findContours(mask_u8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cleaned = np.zeros_like(mask_u8)
    for cnt in contours:
        comp = np.zeros_like(mask_u8)
        cv2.drawContours(comp, [cnt], -1, 255, thickness=cv2.FILLED)
        comp_area = count_mask_pixels(comp)
        if comp_area == 0:
            continue
        outside_artifact = count_mask_pixels(
            cv2.bitwise_and(comp, cv2.bitwise_not(artifact_filled))
        )
        if outside_artifact / comp_area > 0.5:
            continue
        if exterior_bg_u8.any():
            exterior_overlap = count_mask_pixels(cv2.bitwise_and(comp, exterior_bg_u8))
            if exterior_overlap / comp_area > max_bg_ratio:
                continue
        cleaned = cv2.bitwise_or(cleaned, comp)

    return (cleaned > 0).astype(np.float32)


def count_contour_border_touches(cnt, h, w, margin=ARTIFACT_BORDER_MARGIN):
    x, y, bw, bh = cv2.boundingRect(cnt)
    touches = 0
    if x <= margin:
        touches += 1
    if y <= margin:
        touches += 1
    if x + bw >= w - margin:
        touches += 1
    if y + bh >= h - margin:
        touches += 1
    return touches


def select_best_artifact_contour(contours, h, w):
    """이미지 테두리에 붙은 프레임 contour 제외, 중앙에 가까운 어두운 유물 선택."""
    total = h * w
    best_cnt = None
    best_score = -1.0
    diag = float(np.hypot(w, h))

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < total * ARTIFACT_MIN_AREA_RATIO:
            continue
        if area > total * ARTIFACT_MAX_AREA_RATIO:
            continue
        touches = count_contour_border_touches(cnt, h, w)
        if touches >= 3:
            continue

        x, y, bw, bh = cv2.boundingRect(cnt)
        cx, cy = x + bw / 2.0, y + bh / 2.0
        dist_center = float(np.hypot(cx - w / 2.0, cy - h / 2.0))
        score = area * (1.2 - 0.55 * dist_center / (diag * 0.5 + 1e-6))
        score *= 1.0 - 0.12 * touches
        if score > best_score:
            best_score = score
            best_cnt = cnt

    if best_cnt is not None:
        return best_cnt

    valid = [
        c for c in contours
        if cv2.contourArea(c) < total * ARTIFACT_MAX_AREA_RATIO
    ]
    if valid:
        return max(valid, key=cv2.contourArea)
    return None


def build_dark_material_mask(img_bgr):
    """어두운 유물 재질만 (채도 OR 제외 — 배경 전체 포화 방지)."""
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    gray_blur = cv2.GaussianBlur(gray, (5, 5), 0)
    _, dark = cv2.threshold(
        gray_blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
    )
    dark = cv2.morphologyEx(dark, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8), iterations=1)
    return dark


def expand_filled_include_cavities(filled):
    """밝은 관통 구멍이 실루엣 안에 포함되도록 닫힘 연산."""
    if not filled.any():
        return filled
    ys, xs = np.where(filled > 0)
    bw = int(xs.max() - xs.min() + 1)
    bh = int(ys.max() - ys.min() + 1)
    k = int(max(12, min(60, max(bw, bh) * ARTIFACT_CAVITY_CLOSE_RATIO)))
    if k % 2 == 0:
        k += 1
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
    return cv2.morphologyEx(filled, cv2.MORPH_CLOSE, kernel)


def fallback_artifact_filled_from_dark_bbox(cropped_bgr, h, w):
    """contour 실패/과대 시 어두운 픽셀 bbox 기반 실루엣."""
    dark = build_dark_material_mask(cropped_bgr)
    if not dark.any():
        return np.zeros((h, w), dtype=np.uint8)

    ys, xs = np.where(dark > 0)
    pad = int(max(8, 0.02 * max(h, w)))
    y1 = max(0, int(ys.min()) - pad)
    y2 = min(h, int(ys.max()) + pad)
    x1 = max(0, int(xs.min()) - pad)
    x2 = min(w, int(xs.max()) + pad)
    filled = np.zeros((h, w), dtype=np.uint8)
    filled[y1:y2, x1:x2] = 255
    return expand_filled_include_cavities(filled)


def build_artifact_material_mask(cropped_bgr, artifact_filled):
    """실루엣 안 어두운 유물 재질."""
    dark = build_dark_material_mask(cropped_bgr)
    return cv2.bitwise_and(dark, artifact_filled)


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
    base_mask = cv2.bitwise_or(otsu, sat_mask)

    edges = cv2.Canny(gray_blur, 50, 150)
    edges = cv2.dilate(edges, np.ones((5, 5), np.uint8), iterations=1)
    # E: edge는 otsu|sat 후보 dilate 영역 안에서만 연결
    edge_roi = cv2.dilate(base_mask, ARTIFACT_EDGE_ROI_KERNEL, iterations=1)
    gray_bg = build_gray_bg_mask(S, V)
    edge_roi = cv2.bitwise_and(edge_roi, cv2.bitwise_not(gray_bg))
    edges_limited = cv2.bitwise_and(edges, edge_roi)
    artifact_mask = cv2.bitwise_or(base_mask, edges_limited)

    shadow_like = ((S < 25) & (V < 180)).astype(np.uint8) * 255
    artifact_mask = cv2.bitwise_and(artifact_mask, cv2.bitwise_not(shadow_like))
    artifact_mask = cv2.bitwise_and(artifact_mask, cv2.bitwise_not(gray_bg))

    kernel_close = np.ones((9, 9), np.uint8)
    kernel_open = np.ones((5, 5), np.uint8)
    artifact_mask = cv2.morphologyEx(artifact_mask, cv2.MORPH_CLOSE, kernel_close)
    artifact_mask = cv2.morphologyEx(artifact_mask, cv2.MORPH_OPEN, kernel_open)
    return artifact_mask


def weak_erode_artifact_mask(filled_mask):
    """유물 마스크를 약하게 수축 — crop 가장자리 회색 배경 제외."""
    if not filled_mask.any():
        return filled_mask
    before = count_mask_pixels(filled_mask)
    eroded = cv2.erode(
        filled_mask,
        ARTIFACT_CORE_ERODE_KERNEL,
        iterations=ARTIFACT_CORE_ERODE_ITERATIONS,
    )
    after = count_mask_pixels(eroded)
    min_keep = max(100, int(before * ARTIFACT_CORE_MIN_KEEP_RATIO))
    if after < min_keep:
        return filled_mask
    return eroded


def artifact_core_from_crop(cropped_rgb):
    """crop 기준 유물 filled + 약한 core (손상/hole gating용)."""
    filled, otsu_bg = _artifact_filled_mask(cropped_rgb)
    core = weak_erode_artifact_mask(filled)
    return core, filled, otsu_bg


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
    artifact_mask = build_dark_material_mask(img_bgr)

    contours, _ = cv2.findContours(
        artifact_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    if not contours:
        return img_rgb, (0, 0, w, h), artifact_mask

    min_area = h * w * min_area_ratio
    contours = [c for c in contours if cv2.contourArea(c) >= min_area]
    if not contours:
        return img_rgb, (0, 0, w, h), artifact_mask

    selected = select_best_artifact_contour(contours, h, w)
    if selected is None:
        selected = max(contours, key=cv2.contourArea)
    x, y, bw, bh = cv2.boundingRect(selected)
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


def build_artifact_silhouette_mask(img_bgr):
    """어두운 유물 재질 기준 (채도 혼합 없음)."""
    return build_dark_material_mask(img_bgr)


def _artifact_filled_mask(cropped_rgb):
    """유물 실루엣 fill + otsu_bg — 프레임 전체·구멍 누락 방지."""
    h, w = cropped_rgb.shape[:2]
    cropped_bgr = cv2.cvtColor(cropped_rgb, cv2.COLOR_RGB2BGR)
    total_area = h * w

    gray = cv2.cvtColor(cropped_bgr, cv2.COLOR_BGR2GRAY)
    gray_blur = cv2.GaussianBlur(gray, (5, 5), 0)
    _, otsu_bg = cv2.threshold(gray_blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    dark = build_dark_material_mask(cropped_bgr)
    contours, _ = cv2.findContours(dark, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    artifact_filled = np.zeros((h, w), dtype=np.uint8)

    selected = select_best_artifact_contour(contours, h, w) if contours else None
    if selected is not None:
        cv2.drawContours(artifact_filled, [selected], -1, 255, thickness=cv2.FILLED)
        artifact_filled = expand_filled_include_cavities(artifact_filled)

    filled_ratio = count_mask_pixels(artifact_filled) / max(total_area, 1)
    if filled_ratio > ARTIFACT_FILLED_FALLBACK_RATIO or filled_ratio < ARTIFACT_MIN_AREA_RATIO:
        artifact_filled = fallback_artifact_filled_from_dark_bbox(cropped_bgr, h, w)

    return artifact_filled, otsu_bg


def _detect_internal_holes_raw(cropped_rgb, artifact_filled=None, otsu_bg=None):
    """
    실루엣 안 cavity(밝은 구멍) + otsu — 재질 가장자리 링만 잡히는 문제 완화.
    """
    h, w = cropped_rgb.shape[:2]
    cropped_bgr = cv2.cvtColor(cropped_rgb, cv2.COLOR_RGB2BGR)
    if artifact_filled is None or otsu_bg is None:
        filled, bg = _artifact_filled_mask(cropped_rgb)
        if artifact_filled is None:
            artifact_filled = filled
        if otsu_bg is None:
            otsu_bg = bg
    if not artifact_filled.any():
        return np.zeros((h, w), dtype=np.uint8)

    material = build_artifact_material_mask(cropped_bgr, artifact_filled)
    cavity = cv2.bitwise_and(artifact_filled, cv2.bitwise_not(material))
    cavity = cv2.morphologyEx(
        cavity, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8), iterations=1
    )

    hsv = cv2.cvtColor(cropped_bgr, cv2.COLOR_BGR2HSV)
    _, S, V = cv2.split(hsv)
    v_vals = V[artifact_filled > 0]
    if v_vals.size > 0:
        v_thr = float(np.percentile(v_vals, 52))
        bright_inside = ((V >= v_thr) & (S < GRAY_BG_S_MAX + 10)).astype(np.uint8) * 255
        bright_inside = cv2.bitwise_and(bright_inside, artifact_filled)
        cavity = cv2.bitwise_or(cavity, bright_inside)

    hole_otsu = cv2.bitwise_and(otsu_bg.copy(), artifact_filled)
    hole_mask = cv2.bitwise_or(cavity, hole_otsu)

    dist_mat = cv2.distanceTransform((material > 0).astype(np.uint8), cv2.DIST_L2, 5)
    near_material = (
        dist_mat <= max(24.0, min(h, w) * HOLE_NEAR_MATERIAL_RATIO)
    ).astype(np.uint8) * 255

    dist_sil = cv2.distanceTransform(artifact_filled, cv2.DIST_L2, 5)
    inside_sil = (dist_sil >= HOLE_MIN_DIST_FROM_SILHOUETTE).astype(np.uint8) * 255

    hole_mask = cv2.bitwise_and(hole_mask, cv2.bitwise_or(near_material, inside_sil))
    k = HOLE_MORPH_CLOSE if HOLE_MORPH_CLOSE % 2 == 1 else HOLE_MORPH_CLOSE + 1
    hole_mask = cv2.morphologyEx(
        hole_mask, cv2.MORPH_CLOSE, np.ones((k, k), np.uint8), iterations=1
    )
    return hole_mask


def build_valid_hole_mask(cropped_rgb, crop_h, crop_w, artifact_filled=None, otsu_bg=None):
    """
    작은 내부 결손만 유지. 전체 hole 비율이 MAX_HOLE_RATIO 초과면 detector 실패로 무시.
    Returns: (hole_mask uint8, hole_area_ratio, rejected)
    """
    h, w = crop_h, crop_w
    total_area = h * w
    if total_area == 0:
        return np.zeros((h, w), dtype=np.uint8), 0.0, True

    raw = _detect_internal_holes_raw(
        cropped_rgb, artifact_filled=artifact_filled, otsu_bg=otsu_bg
    )
    contours, _ = cv2.findContours(raw, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    filtered = np.zeros((h, w), dtype=np.uint8)
    max_component_area = total_area * MAX_HOLE_RATIO
    component_areas = []

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < MIN_HOLE_AREA:
            continue
        if area > max_component_area:
            if area <= total_area * MAX_DOMINANT_HOLE_RATIO:
                cv2.drawContours(filtered, [cnt], -1, 255, thickness=cv2.FILLED)
                component_areas.append(area)
            continue
        cv2.drawContours(filtered, [cnt], -1, 255, thickness=cv2.FILLED)
        component_areas.append(area)

    hole_pixels = count_mask_pixels(filtered)
    hole_area_ratio = hole_pixels / total_area

    if hole_area_ratio > MAX_HOLE_RATIO:
        if len(component_areas) == 1 and component_areas[0] >= total_area * MAX_HOLE_RATIO:
            return filtered, float(hole_area_ratio), False
        if hole_area_ratio > MAX_DOMINANT_HOLE_RATIO:
            return np.zeros((h, w), dtype=np.uint8), float(hole_area_ratio), True

    return filtered, float(hole_area_ratio), False


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


def recrop_tight_to_silhouette(img_rgb, padding_ratio=0.02):
    """전체 프레임 crop일 때 유물 bbox로 재크롭."""
    h, w = img_rgb.shape[:2]
    filled, _ = _artifact_filled_mask(img_rgb)
    filled_ratio = count_mask_pixels(filled) / max(h * w, 1)
    if filled_ratio > 0.92 or not filled.any():
        return img_rgb, (0, 0, w, h), float(filled_ratio)

    ys, xs = np.where(filled > 0)
    pad = int(max(8, max(h, w) * padding_ratio))
    y1 = max(0, int(ys.min()) - pad)
    y2 = min(h, int(ys.max()) + pad)
    x1 = max(0, int(xs.min()) - pad)
    x2 = min(w, int(xs.max()) + pad)
    if (x2 - x1) * (y2 - y1) >= 0.95 * h * w:
        return img_rgb, (0, 0, w, h), float(filled_ratio)
    return img_rgb[y1:y2, x1:x2], (x1, y1, x2, y2), float(filled_ratio)


def preprocess(img_bgr, use_auto_crop=True):
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    h, w = img_rgb.shape[:2]
    artifact_mask_full = build_artifact_mask_hsv(img_bgr)
    fallback = False
    crop_ratio = 1.0
    bbox = [0, 0, w, h]
    silhouette_ratio = None

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

        if not fallback and crop_ratio >= 0.95:
            cropped_rgb, bbox_tuple, silhouette_ratio = recrop_tight_to_silhouette(cropped_rgb)
            x1, y1, x2, y2 = bbox_tuple
            bbox_w = x2 - x1
            bbox_h = y2 - y1
            crop_ratio = (bbox_w * bbox_h) / (w * h) if w * h else 0.0
            bbox = [int(x1), int(y1), int(x2), int(y2)]

        print({
            'crop_ratio': round(crop_ratio, 4),
            'bbox': bbox,
            'fallback': fallback,
            'use_auto_crop': True,
            'silhouette_ratio': round(silhouette_ratio, 4) if silhouette_ratio is not None else None,
        })

    cropped_bgr = cv2.cvtColor(cropped_rgb, cv2.COLOR_RGB2BGR)
    gray  = cv2.cvtColor(cropped_bgr, cv2.COLOR_BGR2GRAY)
    image = np.dstack([cropped_rgb, get_sobel_map(gray)])

    transform = _model_input_compose(IMAGE_SIZE)

    aug    = transform(image=image, mask=np.zeros(image.shape[:2], dtype=np.float32))
    tensor = aug['image'].unsqueeze(0).to(DEVICE)
    return tensor, cropped_rgb, cropped_artifact_mask


def predict(model, img_bgr, seg_threshold=0.10, cls_threshold=0.5, use_auto_crop=True):
    tensor, cropped_rgb, _cropped_artifact_mask = preprocess(img_bgr, use_auto_crop=use_auto_crop)
    crop_h, crop_w = cropped_rgb.shape[:2]
    artifact_core, artifact_filled, otsu_bg = artifact_core_from_crop(cropped_rgb)
    damage_allowed, exterior_bg = build_damage_allowed_mask(cropped_rgb, artifact_filled)
    damage_fg_f = damage_allowed.astype(np.float32) / 255.0
    crop_area = max(crop_h * crop_w, 1)
    artifact_filled_ratio = round(count_mask_pixels(artifact_filled) / crop_area, 4)
    artifact_core_ratio = round(count_mask_pixels(artifact_core) / crop_area, 4)
    damage_allowed_ratio = round(count_mask_pixels(damage_allowed) / crop_area, 4)
    exterior_bg_ratio = round(count_mask_pixels(exterior_bg) / crop_area, 4)

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
            seg_out1, _ = model(t)
            seg_out2, _ = model(torch.flip(t, dims=[3]))
            seg_out3, _ = model(torch.flip(t, dims=[2]))

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
        _, cls_out1 = model(tensor)
        _, cls_out2 = model(torch.flip(tensor, dims=[3]))
        _, cls_out3 = model(torch.flip(tensor, dims=[2]))
        cls_prob = (
            torch.sigmoid(cls_out1)
            + torch.sigmoid(cls_out2)
            + torch.sigmoid(cls_out3)
        ) / 3.0

    # 1. probability map → threshold
    seg_prob_crop = resize_mask_to_crop(seg_prob_final, crop_w, crop_h, is_binary=False)
    final_mask = (seg_prob_crop > seg_threshold).astype(np.float32)
    seg_mask_pixels_after_threshold = count_mask_pixels(final_mask)

    # 1b. morph 전 배경·유물 밖 제거 (close가 배경 blob을 이어 붙이는 것 방지)
    final_mask = final_mask * damage_fg_f

    # 2. morphology open — 작은 잡음 제거
    final_mask = cv2.morphologyEx(
        final_mask.astype(np.uint8), cv2.MORPH_OPEN, MORPH_KERNEL, iterations=1
    ).astype(np.float32)

    # 3. morphology close — 끊긴 crack 연결
    final_mask = cv2.morphologyEx(
        final_mask.astype(np.uint8), cv2.MORPH_CLOSE, MORPH_KERNEL, iterations=1
    ).astype(np.float32)

    # 4. 작은 내부 결손만 선택적 병합 (과대 hole → 무시)
    hole_mask_u8, hole_area_ratio, hole_rejected = build_valid_hole_mask(
        cropped_rgb, crop_h, crop_w, artifact_filled=artifact_filled, otsu_bg=otsu_bg
    )
    hole_mask_pixels = count_mask_pixels(hole_mask_u8)
    hole_merged_pixels = 0

    if not hole_rejected and hole_mask_pixels > 0:
        hole_f = (hole_mask_u8 > 0).astype(np.float32) * damage_fg_f
        # rim만 잡힌 경우: cavity 전체를 hole 마스크로 채움 (gap만이 아님)
        hole_merged_pixels = count_mask_pixels(hole_f)
        final_mask = np.maximum(final_mask, hole_f)

    # 5. morph/hole 이후 허용 영역 밖 제거 + 배경 위 손상 blob 제거
    final_mask = final_mask * damage_fg_f
    final_mask = remove_exterior_damage_components(
        final_mask, exterior_bg, artifact_filled
    )
    final_mask_pixels = count_mask_pixels(final_mask)

    pred_mask = final_mask
    img_vis = cropped_rgb
    vis_h, vis_w = crop_h, crop_w

    print({
        'seg_threshold': round(float(seg_threshold), 4),
        'artifact_filled_ratio': artifact_filled_ratio,
        'artifact_core_ratio': artifact_core_ratio,
        'damage_allowed_ratio': damage_allowed_ratio,
        'exterior_bg_ratio': exterior_bg_ratio,
        'seg_mask_pixels_after_threshold': seg_mask_pixels_after_threshold,
        'hole_mask_pixels': hole_mask_pixels,
        'hole_merged_pixels': hole_merged_pixels,
        'hole_area_ratio': round(hole_area_ratio, 4),
        'hole_detector_rejected': hole_rejected,
        'final_mask_pixels': final_mask_pixels,
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

    bboxes = build_bboxes_from_mask(pred_mask, crop_h, crop_w)
    mask_uint8 = (pred_mask * 255).astype(np.uint8)

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

    mask_binary = (pred_mask * 255).astype(np.uint8)

    # Grad-CAM 생성
    try:
        cam_tensor = tensor.detach().clone().requires_grad_(True)
        cam = get_gradcam(model, cam_tensor)
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
        'damage_ratio': round(damage_ratio, 2),
        'severity':     severity,
        'bboxes':       bboxes,
        'bbox_count':   len(bboxes),  # 필터링 후 개수
        'image_width':  int(vis_w),
        'image_height': int(vis_h),
        'seg_threshold': round(float(seg_threshold), 4),
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