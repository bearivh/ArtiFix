# ArtiFix

시설물 표면 결함(균열, 박리, 변색)을 탐지·분석하는 컴퓨터 비전 프로젝트입니다.

## 개요

- **Segmentation**: 결함 영역을 픽셀 단위로 분할
- **Classification**: 결함 유형 분류 (crack / peeling / discoloration)
- **입력**: RGB + Sobel edge map (4채널, ablation으로 3채널 RGB 지원)

## 프로젝트 구조 (예정)

```
ArtiFix/
├── backend/     # FastAPI 서빙
├── model/       # 학습·추론 (데이터셋, augmentation, config)
└── README.md
```

## 기술 스택

- PyTorch, segmentation-models-pytorch
- FastAPI, OpenCV, Albumentations

## 상태

초기 저장소 설정 중입니다. 학습·API 코드는 추후 커밋 예정입니다.

## 라이선스

TBD
