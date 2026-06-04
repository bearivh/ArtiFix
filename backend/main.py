import base64
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from inference import load_model, predict
from report import generate_report

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
)

_WEIGHTS_DIR = Path(__file__).resolve().parent / 'weights'
MODEL_PATHS = {
    'base': _WEIGHTS_DIR / 'best_model.pt',
    'finetuned': _WEIGHTS_DIR / 'best_finetuned.pt',
}
DEFAULT_MODEL_VARIANT = 'finetuned'

MODELS = {
    name: load_model(str(path), use_multitask=True)
    for name, path in MODEL_PATHS.items()
}

print('모델 로드 완료:', ', '.join(MODELS.keys()))


def numpy_to_base64(img_array: np.ndarray) -> str:
    if img_array.ndim == 2:
        img_array = np.stack([img_array] * 3, axis=-1)
    _, buffer = cv2.imencode('.png', cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR))
    return base64.b64encode(buffer).decode('utf-8')


def _parse_bool_form(value: str, default: bool = True) -> bool:
    if value is None:
        return default
    return str(value).strip().lower() in ('true', '1', 'yes', 'on')


def _parse_model_variant(value: Optional[str]) -> str:
    v = (value or DEFAULT_MODEL_VARIANT).strip().lower()
    return v if v in MODELS else DEFAULT_MODEL_VARIANT


@app.post('/predict')
async def predict_endpoint(
    image: UploadFile = File(...),
    seg_threshold: float = Form(0.10),
    use_auto_crop: str = Form('true'),
    model_variant: str = Form(DEFAULT_MODEL_VARIANT),
):
    contents = await image.read()
    nparr = np.frombuffer(contents, np.uint8)
    img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    seg_threshold = float(max(0.05, min(0.30, seg_threshold)))
    variant = _parse_model_variant(model_variant)
    model = MODELS[variant]

    result = predict(
        model,
        img_bgr,
        seg_threshold=seg_threshold,
        use_auto_crop=_parse_bool_form(use_auto_crop, default=True),
    )

    mask_vis = result['mask']
    if mask_vis.ndim == 2:
        mask_vis = np.stack([mask_vis] * 3, axis=-1)

    return {
        'original_image': numpy_to_base64(result['cropped']),
        'mask_image': numpy_to_base64(mask_vis),
        'overlay_image': numpy_to_base64(result['overlay']),
        'gradcam_image': numpy_to_base64(result['gradcam']),
        'labels': result['labels'],
        'damage_ratio': result['damage_ratio'],
        'severity': result['severity'],
        'bboxes': result['bboxes'],
        'bbox_count': result['bbox_count'],
        'image_width': result.get('image_width'),
        'image_height': result.get('image_height'),
        'seg_threshold': result.get('seg_threshold'),
        'model_variant': variant,
    }


@app.post('/report')
async def generate_report_endpoint(
    image: UploadFile = File(...),
    use_auto_crop: str = Form('true'),
    model_variant: str = Form(DEFAULT_MODEL_VARIANT),
):
    contents = await image.read()
    nparr = np.frombuffer(contents, np.uint8)
    img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    variant = _parse_model_variant(model_variant)
    model = MODELS[variant]

    result = predict(
        model,
        img_bgr,
        use_auto_crop=_parse_bool_form(use_auto_crop, default=True),
    )

    mask_vis = result['mask']
    if mask_vis.ndim == 2:
        mask_vis = np.stack([mask_vis] * 3, axis=-1)

    result['original_image'] = numpy_to_base64(result['cropped'])
    result['mask_image'] = numpy_to_base64(mask_vis)
    result['overlay_image'] = numpy_to_base64(result['overlay'])
    result['gradcam_image'] = numpy_to_base64(result['gradcam'])

    pdf_bytes = generate_report(result)

    return Response(
        content=pdf_bytes,
        media_type='application/pdf',
        headers={'Content-Disposition': 'attachment; filename="artifix_report.pdf"'},
    )


@app.get('/health')
def health():
    return {
        'status': 'ok',
        'models': list(MODELS.keys()),
        'default_model_variant': DEFAULT_MODEL_VARIANT,
    }
