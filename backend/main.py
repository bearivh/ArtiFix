import io
import base64
import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from inference import load_model, predict

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 모델 로드 (서버 시작 시 한 번만)
seg_model = load_model('./weights/best_finetuned.pt', use_multitask=True)
cls_model = load_model('./weights/best_model.pt',     use_multitask=True)

print('모델 로드 완료')


def numpy_to_base64(img_array: np.ndarray) -> str:
    _, buffer = cv2.imencode('.png', cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR))
    return base64.b64encode(buffer).decode('utf-8')


@app.post('/predict')
async def predict_endpoint(image: UploadFile = File(...)):
    contents = await image.read()
    nparr    = np.frombuffer(contents, np.uint8)
    img_bgr  = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    result = predict(seg_model, cls_model, img_bgr)

    mask_vis = result['mask']
    if mask_vis.ndim == 2:
        mask_vis = np.stack([mask_vis]*3, axis=-1)

    return {
        'original_image': numpy_to_base64(result['cropped']),
        'mask_image':     numpy_to_base64(mask_vis),
        'overlay_image':  numpy_to_base64(result['overlay']),
        'labels':         result['labels'],
    }


@app.get('/health')
def health():
    return {'status': 'ok'}