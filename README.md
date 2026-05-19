# ArtiFix

유물 이미지에서 표면 손상을 자동으로 감지하고 분류하는 컴퓨터 비전 프로젝트입니다.

---

## 프로젝트 소개

박물관이나 문화재 현장에서 유물의 표면 손상(균열, 박락, 변색 등)을 전문가가 직접 육안으로 확인하는 작업을 딥러닝 모델로 보조하는 시스템입니다.

유물 이미지를 업로드하면 손상된 영역을 자동으로 찾아주고, 어떤 종류의 손상인지도 함께 알려줍니다.

---

## 주요 기능

- 손상 영역 자동 탐지 (Segmentation)
- 손상 유형 분류 — 균열 / 박락 / 변색 (Multi-label Classification)
- 웹 인터페이스를 통한 이미지 업로드 및 결과 확인

---

## 기술 스택

- **Model**: PyTorch, EfficientNet + U-Net
- **Backend**: FastAPI
- **Frontend**: React, Tailwind CSS
- **학습 환경**: Kaggle (T4 GPU)

---

## 개발 계획

### Phase 1 — 데이터 파이프라인
- Crack500 데이터셋 수집 및 전처리
- RGB + Sobel Edge Map 4채널 입력 구성
- 데이터 augmentation 파이프라인 구축

### Phase 2 — 모델 구현 및 학습
- EfficientNet-B2 + U-Net 기반 아키텍처 구현
- Bottleneck에서 Classification Head 분기
- Segmentation / Multi-label Classification 멀티태스크 학습

### Phase 3 — Ablation Study
- Segmentation Only vs Multi-task 비교
- Sobel Input 유무에 따른 성능 비교
- 합성 데이터 추가 효과 검증

### Phase 4 — 백엔드 (FastAPI)
- 학습된 모델 가중치 로드
- 이미지 입력 → 마스크 + 유형 반환 API 구현

### Phase 5 — 프론트엔드 (React + Tailwind)
- 이미지 업로드 UI
- 손상 마스크 오버레이 및 유형 태그 시각화
- 전후 비교 슬라이더
- 결과 다운로드
