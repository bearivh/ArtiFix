/** 페이지 기능별 툴팁 설명 (한국어) */

export const HELP = {
  modelVariant:
    '파인튜닝 전(best_model.pt)과 파인튜닝 후(best_finetuned.pt) 중 분할·분류에 사용할 가중치를 선택합니다. 업로드 전에 고르며, 해당 분석 세션 동안 동일 모델이 적용됩니다.',
  autoCrop:
    '유물이 화면 중앙에 오도록 이미지를 자동으로 잘라 모델 입력 크기에 맞춥니다. 해제하면 업로드한 원본 전체를 그대로 분석합니다.',
  imageUpload:
    'JPG·PNG 유물 표면 사진을 드래그하거나 클릭해 업로드합니다. 업로드 즉시 서버에서 손상 분할·분류 추론이 실행됩니다.',
  apiMode:
    'Mock API는 데모용 가짜 결과를, Live API는 로컬 백엔드(localhost:8000)의 실제 모델 추론 결과를 사용합니다.',

  damageArea:
    '이미지 전체에서 모델이 손상으로 판단한 픽셀 비율(%)입니다. 면적이 클수록 표면 손상 범위가 넓다는 뜻입니다.',
  severity:
    '손상 면적 비율과 감지된 손상 유형 수를 종합해 HIGH·MEDIUM·LOW·NONE 중 하나로 표시합니다.',
  regionCount:
    '분할 마스크에서 분리된 손상 영역(바운딩 박스) 개수입니다. 클릭하면 오른쪽 패널에 상세가 나옵니다.',
  primaryDamage:
    '균열·표면 손상·변색 중 confidence가 가장 높은 유형과 그 확률(%)입니다.',

  pdfReport:
    '손상 요약, 분석 이미지, 영역 상세가 담긴 PDF 보고서를 생성해 다운로드합니다. Live API에서만 사용할 수 있습니다.',
  threeDPreview:
    '3D Damage Preview: 분석된 원본·손상 오버레이를 구형·원통형·평면 3D 형태에 매핑해 회전하며 확인합니다. 실제 3D 스캔·복원이 아닌 시각화입니다.',

  analysisControls:
    'Detection Sensitivity와 Overlay Strength로 분석·표시 방식을 조절합니다. 민감도 변경 시 서버에서 재분석합니다.',

  sensitivity:
    '세그멘테이션 마스크 생성 임계값입니다. 낮을수록 더 많은 영역을 손상으로 잡고, 높을수록 보수적으로 잡습니다. 슬라이더를 놓으면 서버에서 재분석합니다.',
  overlayStrength:
    '원본 위에 겹치는 손상 오버레이의 투명도입니다. 값이 클수록 색이 진하게 보입니다.',
  tabWorkspace:
    '원본과 손상 오버레이를 겹쳐 보고, 노란 박스(손상 영역)를 클릭해 Region Inspector에서 상세를 확인합니다.',
  tabGradcam:
    '분류 모델이 이미지의 어느 부분을 보고 손상 유형을 판단했는지 Grad-CAM 히트맵으로 확인합니다.',
  tabCompare:
    '슬라이더를 드래그해 원본과 합성 오버레이를 좌우로 비교합니다.',
  tabGallery:
    '원본, 마스크, 합성 오버레이, Grad-CAM 결과를 한 화면에서 나란히 봅니다.',

  interactiveCanvas:
    '손상 영역이 노란 테두리 박스로 표시됩니다. 박스를 클릭하면 선택되며 오른쪽에 면적·비율 등이 표시됩니다.',
  regionInspector:
    '선택한 손상 영역의 픽셀 면적, 해당 영역 손상 비율, 이미지 전체 기준 주요 유형 confidence를 보여줍니다.',

  compareSlider:
    '가운데 핸들을 좌우로 드래그해 분석 전(원본)과 분석 후(오버레이)를 겹쳐 비교합니다.',
  gradcamHeatmap:
    'Classification Head가 주목한 영역을 색으로 표시합니다. 붉을수록 해당 유형 판단에 더 크게 기여한 영역입니다.',

  confidenceLabels:
    '이미지 전체에 대한 손상 유형별 분류 confidence(0~100%)입니다. 높을수록 해당 유형일 가능성이 큽니다.',

  downloadOriginal: '분석에 사용된 원본 이미지를 PNG로 저장합니다.',
  downloadMask: '픽셀 단위 손상 영역만 표시한 이진 마스크를 저장합니다.',
  downloadOverlay: '원본과 손상 오버레이를 합성한 이미지를 저장합니다.',
  downloadGradcam: 'Grad-CAM 히트맵 이미지를 저장합니다.',

  galleryOriginal: '업로드·전처리 후 모델에 입력된 원본 이미지입니다.',
  galleryMask: '세그멘테이션으로 추출한 손상 픽셀 마스크입니다.',
  galleryOverlay: '원본 위에 손상 영역을 색으로 겹친 합성 결과입니다.',
  galleryGradcam: '모델이 손상 판단 시 참고한 영역의 히트맵입니다.',

  newUpload: '현재 결과를 지우고 새 이미지를 업로드합니다.',

  aboutModel:
    'RGB 3채널에 Sobel 엣지 맵을 더해 4채널로 입력합니다. EfficientNet 인코더와 U-Net 디코더로 분할·분류를 동시에 수행합니다.',
  aboutOutputs:
    '분할 마스크(어디가 손상인지)와 다중 라벨 분류(균열·표면 손상·변색 confidence)를 함께 제공합니다.',
  aboutTech: 'ArtiFix 웹·API·학습 파이프라인을 구성하는 주요 기술입니다.',
}
