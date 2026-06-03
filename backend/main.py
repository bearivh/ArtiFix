import base64

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

    allow_origins=["*"],

    allow_methods=["*"],

    allow_headers=["*"],

)



seg_model = load_model('./weights/best_finetuned.pt', use_multitask=True)

cls_model = load_model('./weights/best_model.pt',     use_multitask=True)



print('모델 로드 완료')





def numpy_to_base64(img_array: np.ndarray) -> str:

    if img_array.ndim == 2:

        img_array = np.stack([img_array] * 3, axis=-1)

    _, buffer = cv2.imencode('.png', cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR))

    return base64.b64encode(buffer).decode('utf-8')





def _parse_bool_form(value: str, default: bool = True) -> bool:
    if value is None:
        return default
    return str(value).strip().lower() in ('true', '1', 'yes', 'on')


@app.post('/predict')

async def predict_endpoint(

    image: UploadFile = File(...),

    seg_threshold: float = Form(0.10),

    use_auto_crop: str = Form('true'),

):

    contents = await image.read()

    nparr    = np.frombuffer(contents, np.uint8)

    img_bgr  = cv2.imdecode(nparr, cv2.IMREAD_COLOR)



    seg_threshold = float(max(0.05, min(0.30, seg_threshold)))

    result = predict(
        seg_model,
        cls_model,
        img_bgr,
        seg_threshold=seg_threshold,
        use_auto_crop=_parse_bool_form(use_auto_crop, default=True),
    )



    mask_vis = result['mask']

    if mask_vis.ndim == 2:

        mask_vis = np.stack([mask_vis] * 3, axis=-1)



    class_masks_b64 = {

        name: numpy_to_base64(mask)

        for name, mask in result['class_masks'].items()

    }



    return {

        'original_image': numpy_to_base64(result['cropped']),

        'mask_image':     numpy_to_base64(mask_vis),

        'overlay_image':  numpy_to_base64(result['overlay']),

        'gradcam_image':  numpy_to_base64(result['gradcam']),

        'labels':         result['labels'],

        'class_masks':    class_masks_b64,

        'damage_ratio':   result['damage_ratio'],

        'severity':       result['severity'],

        'bboxes':         result['bboxes'],

        'bbox_count':     result['bbox_count'],

        'image_width':    result.get('image_width'),

        'image_height':   result.get('image_height'),

    }





@app.post('/report')

async def generate_report_endpoint(

    image: UploadFile = File(...),

    use_auto_crop: str = Form('true'),

):

    contents = await image.read()

    nparr    = np.frombuffer(contents, np.uint8)

    img_bgr  = cv2.imdecode(nparr, cv2.IMREAD_COLOR)



    result = predict(
        seg_model,
        cls_model,
        img_bgr,
        use_auto_crop=_parse_bool_form(use_auto_crop, default=True),
    )



    mask_vis = result['mask']

    if mask_vis.ndim == 2:

        mask_vis = np.stack([mask_vis] * 3, axis=-1)



    result['original_image'] = numpy_to_base64(result['cropped'])

    result['mask_image']     = numpy_to_base64(mask_vis)

    result['overlay_image']  = numpy_to_base64(result['overlay'])

    result['gradcam_image']  = numpy_to_base64(result['gradcam'])



    pdf_bytes = generate_report(result)



    return Response(

        content=pdf_bytes,

        media_type='application/pdf',

        headers={'Content-Disposition': 'attachment; filename="artifix_report.pdf"'},

    )





@app.get('/health')

def health():

    return {'status': 'ok'}

