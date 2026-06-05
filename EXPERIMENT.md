# ArtiFix — Ablation Study & Experiment Log

## 실험 환경

| 항목 | 내용 |
|---|---|
| GPU | Kaggle T4 x2 |
| Framework | PyTorch 2.x, segmentation-models-pytorch |
| Encoder | EfficientNet-B2 (ImageNet pretrained) |
| Image Size | 256×256 |
| Batch Size | 8 |
| Epochs | 50 |
| Optimizer | AdamW (lr=3e-4, weight_decay=1e-4) |
| Scheduler | CosineAnnealingLR (eta_min=1e-6) |
| Mixed Precision | FP16 (torch.amp) |

---

## 데이터셋

### 학습 데이터

| 데이터셋 | 설명 | 수량 |
|---|---|---|
| Crack500 | 아스팔트/콘크리트 균열 (train) | 1,896장 |
| 합성 데이터 (Synthetic) | 유물 이미지 기반 손상 합성 | 960장 (train) / 240장 (val) |

### 검증 데이터

| 데이터셋 | 수량 |
|---|---|
| Crack500 val | 348장 |
| 합성 데이터 val | 240장 |
| **전체 val** | **588장** |

### Val 라벨 분포

| 클래스 | GT Positive | 비율 |
|---|---|---|
| crack | 468개 | 79.6% |
| surface_damage | 120개 | 20.4% |
| discoloration | 120개 | 20.4% |

### 합성 데이터 파이프라인

유물 이미지 100장 기반으로 3종 손상 패턴을 프로그래밍으로 합성했습니다.

- **crack**: 랜덤 워크 기반 균열선 + 분기 패턴
- **surface_damage**: 불규칙 폴리곤 기반 박락/깨짐 패턴
- **discoloration**: 가우시안 블러 기반 색상 변화 패턴

**Leakage 방지**: 원본 이미지 기준으로 Train(80장) / Val(20장) 분리해 동일 원본이 train/val에 동시 등장하지 않도록 설계했습니다.

---

## 모델 구조

```
4채널 입력 (RGB 3ch + Sobel Edge Map 1ch)
        ↓
EfficientNet-B2 Encoder
        ↓
    Bottleneck
   ┌────────────────┐
   ↓                ↓
U-Net Decoder    Classification Head
   ↓             (GAP → Linear(128) → ReLU → Dropout(0.3) → Linear(3))
Segmentation         ↓
  Head           Multi-label BCE
(Binary Mask)    [crack, surface_damage, discoloration]
```

### Loss 함수

```
Total Loss = Seg Loss + λ × Cls Loss

Seg Loss = Dice Loss + BCEWithLogitsLoss(pos_weight=자동계산)
Cls Loss = BCEWithLogitsLoss()
λ = 0.5 (LAMBDA_CLS)
```

**pos_weight 자동 계산**: train DataLoader 전체를 순회해 foreground 픽셀 비율로 자동 산출합니다.

---

## Ablation Study

### 실험 설계

각 기술 요소의 독립적인 기여도를 측정하기 위해 4단계 누적 실험을 수행했습니다.

| 실험 | USE_SOBEL | USE_MULTITASK | USE_SYNTHETIC | IN_CHANNELS |
|---|---|---|---|---|
| Baseline | False | False | False | 3 |
| +Synthetic | False | False | True | 3 |
| +Sobel | True | False | True | 4 |
| +Multitask | True | True | True | 4 |

### 실험 결과

| 실험 | Best mIoU | Best Dice | Best F1 | Best Epoch |
|---|---|---|---|---|
| Baseline | 0.6520 | 0.7870 | - | 29 |
| +Synthetic | 0.6736 | 0.8006 | - | 37 |
| +Sobel | 0.6823 | 0.8072 | - | 48 |
| **+Multitask** | **0.7089** | **0.8261** | **0.9802** | 31 |

### 단계별 성능 향상

| 변화 | mIoU 향상 | 의미 |
|---|---|---|
| Baseline → +Synthetic | +0.0216 (+3.3%) | 합성 데이터의 도메인 다양성 효과 |
| +Synthetic → +Sobel | +0.0087 (+1.3%) | Texture-aware 입력의 엣지 정보 기여 |
| +Sobel → +Multitask | +0.0266 (+3.9%) | 멀티태스크 공동 학습의 시너지 효과 |
| **전체 향상** | **+0.0569 (+8.7%)** | |

### 상세 학습 로그

#### Baseline (USE_SOBEL=False, USE_MULTITASK=False, USE_SYNTHETIC=False)

- Train 데이터: Crack500 1,896장
- Best mIoU: **0.6520** (Epoch 29)
- Best Dice: **0.7870**
- 특이사항: F1=0.0000 (USE_MULTITASK=False라 classification 미수행)

주요 에폭:
```
[05/50] mIoU: 0.6449 | Dice: 0.7815
[20/50] mIoU: 0.6376 | Dice: 0.7762
[29/50] mIoU: 0.6520 | Dice: 0.7870  ← Best
[50/50] mIoU: 0.6320 | Dice: 0.7718
```

#### +Synthetic (USE_SOBEL=False, USE_MULTITASK=False, USE_SYNTHETIC=True)

- Train 데이터: Crack500 1,896 + Synthetic 960 = 2,856장
- Best mIoU: **0.6736** (Epoch 37)
- Best Dice: **0.8006**
- Baseline 대비: mIoU +0.0216, Dice +0.0136

주요 에폭:
```
[10/50] mIoU: 0.6274 | Dice: 0.7661
[27/50] mIoU: 0.6566 | Dice: 0.7876
[37/50] mIoU: 0.6736 | Dice: 0.8006  ← Best
[50/50] mIoU: 0.6555 | Dice: 0.7871
```

#### +Sobel (USE_SOBEL=True, USE_MULTITASK=False, USE_SYNTHETIC=True)

- Train 데이터: 2,856장 (4채널 RGB+Sobel)
- Best mIoU: **0.6823** (Epoch 48)
- Best Dice: **0.8072**
- +Synthetic 대비: mIoU +0.0087, Dice +0.0066

주요 에폭:
```
[09/50] mIoU: 0.6277 | Dice: 0.7662
[26/50] mIoU: 0.6770 | Dice: 0.8033
[29/50] mIoU: 0.6808 | Dice: 0.8065
[48/50] mIoU: 0.6823 | Dice: 0.8072  ← Best
```

#### +Multitask (USE_SOBEL=True, USE_MULTITASK=True, USE_SYNTHETIC=True)

- Train 데이터: 2,856장 (4채널, Seg + Cls 공동 학습)
- Best mIoU: **0.7089** (Epoch 31)
- Best Dice: **0.8261**
- Best F1: **0.9802**
- +Sobel 대비: mIoU +0.0266, Dice +0.0189

주요 에폭:
```
[07/50] mIoU: 0.6141 | Dice: 0.7571 | F1: 0.9100
[15/50] mIoU: 0.6470 | Dice: 0.7824 | F1: 0.9833
[24/50] mIoU: 0.6800 | Dice: 0.8061 | F1: 0.9869
[31/50] mIoU: 0.7089 | Dice: 0.8261 | F1: 0.9840  ← Best
[50/50] mIoU: 0.6889 | Dice: 0.8121 | F1: 0.9776
```

---

## Classification 성능 분석

### F1 버그 수정 과정

초기 학습 로그에서 F1이 0.33으로 고정되는 현상이 발생했습니다.

**원인 분석**:
- Val loop 안에 디버그용 `break`가 삽입된 상태로 학습 재실행
- 첫 배치만 돌고 종료되어 `all_cls_probs`가 사실상 비어있었음
- Crack500 val 라벨 `[1,0,0]`만 있는 상태에서 0.3333이 출력됨

**수정 후**: `break` 제거 → F1 정상 출력 (0.97~0.98)

### Threshold Sweep 결과

최종 +Multitask 모델의 val 전체(588장)에 대한 threshold별 F1:

| Threshold | 평균 F1 | crack | surface_damage | discoloration |
|---|---|---|---|---|
| 0.2 | 0.9731 | 0.995 | 0.984 | 0.941 |
| 0.3 | 0.9743 | 0.995 | 0.983 | 0.945 |
| 0.4 | 0.9754 | 0.995 | 0.979 | 0.952 |
| 0.5 | 0.9754 | 0.995 | 0.979 | 0.952 |
| 0.6 | 0.9767 | 0.995 | 0.979 | 0.956 |

**클래스별 최적 threshold**:

| 클래스 | 최적 threshold | F1 |
|---|---|---|
| crack | 0.1 | 0.9968 |
| surface_damage | 0.7 | 0.9874 |
| discoloration | 0.7 | 0.9600 |

---

## Fine-tuning (실제 유물 도메인 적응)

### 목적

Crack500 (아스팔트/콘크리트) 도메인과 실제 유물 도메인 간의 갭을 줄이기 위해 실제 유물 이미지로 fine-tuning을 수행했습니다.

### 데이터

| 항목 | 내용 |
|---|---|
| 라벨링 도구 | Label Studio (Brush 툴) |
| 이미지 수 | 45장 (손상 유물 31장 + 손상 없는 유물 14장) |
| 마스크 형식 | PNG (픽셀 단위 binary mask) |
| 손상 클래스 | Binary (손상/비손상) |

### Fine-tuning 설정

```python
FINETUNE_EPOCHS = 10
FINETUNE_LR     = 1e-5       # 기존 가중치 유지를 위해 매우 낮게 설정
Loss            = Dice + BCE  # pos_weight 없이 단순화
```

**설계 결정**: Classification loss 제외, Segmentation loss만 사용
- 실제 유물 라벨이 binary mask만 있고 클래스 정보가 없어 cls_label이 부정확함
- Fine-tuning 목적이 유물 도메인 segmentation 적응이므로 seg loss만 사용이 적절

### 결과

| 모델 | Best Loss | 비고 |
|---|---|---|
| 1차 (14장) | 1.2160 | |
| **2차 (31장)** | **~1.0** | 데이터 추가 후 개선 |

### 서비스 구조

Catastrophic forgetting 방지를 위해 두 모델을 분리해서 사용합니다.

```
seg_model = best_finetuned.pt  → Segmentation (유물 도메인 적응)
cls_model = best_model.pt      → Classification (원래 성능 유지)
```

---

## 추론 파이프라인 개선

재학습 없이 추론 단계에서 성능을 개선했습니다.

### 1. TTA (Test Time Augmentation)

원본 + 좌우반전 + 상하반전 예측 평균:

```python
seg_prob = (sigmoid(seg_out_orig) +
            sigmoid(seg_out_flip_lr) +
            sigmoid(seg_out_flip_ud)) / 3.0
```

### 2. Multi-scale Inference

3개 스케일(384, 448, 512)로 예측 후 256으로 리사이즈해 평균:

```python
scales = [384, 448, 512]
seg_prob_final = mean([predict_at_scale(s) for s in scales])
```

**효과**: 256 단일 스케일에서 놓치던 얇은 균열 검출 개선

### 3. Morphological 후처리

얇은 균열 연결:
```python
kernel = np.ones((3, 3), np.uint8)
mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=1)
```

### 4. 내부 결손(Hole) 검출

딥러닝 마스크가 잡지 못하는 구멍/결손 영역을 OpenCV 규칙 기반으로 탐지:

```python
hole_mask  = detect_internal_holes(cropped_rgb)
final_mask = np.maximum(model_mask, hole_mask)
```

**설계 근거**: 유물 내부 배경색 구멍은 딥러닝보다 규칙 기반이 더 안정적

### 5. rembg 배경 제거

기존 HSV/Otsu/Adaptive threshold 기반 crop → rembg AI 배경 제거로 교체:

```python
from rembg import remove
output = remove(pil_img)  # RGBA
alpha  = output[:, :, 3]  # 유물 마스크
```

**개선 효과**: 회색 배경, 그림자, 받침 그림자 등 복잡한 케이스 처리 개선

---

## 한계 및 향후 과제

### 한계점

1. **도메인 갭**: Crack500(아스팔트)과 유물 표면의 텍스처 차이로 segmentation 성능이 제한됨
2. **합성 데이터 한계**: 코드로 생성한 손상 패턴이 실제 유물 손상과 완전히 동일하지 않음
3. **합성 데이터 Split**: 원본 이미지 기준 분리를 적용했으나 동일 합성 패턴이 train/val에 공유될 수 있음
4. **이미지 해상도**: 계산 자원 제약으로 256×256 사용, 얇은 균열 탐지에 한계
5. **Classification 불균형**: Crack500 val 79.6%가 crack 단일 클래스라 F1 신뢰도 제한적
6. **Fine-tuning 데이터**: 31장으로 충분한 도메인 적응에 한계

### 향후 과제

- 실제 유물 라벨링 데이터 100장 이상으로 확대
- IMAGE_SIZE 384 이상으로 재학습
- λ 값 변화 Ablation 추가
- SAM, SegFormer 등 베이스라인 모델과 정량 비교
- 배치 분석 API 구현