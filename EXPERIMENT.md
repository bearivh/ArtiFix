# ArtiFix — 실험 과정 상세 기록 (최종)

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
| Scheduler | CosineAnnealingLR (T_max=NUM_EPOCHS, eta_min=1e-6) |
| Mixed Precision | FP16 (torch.amp.autocast) |
| pos_weight | 데이터 분포 기반 자동 계산 (`(1 - ratio) / ratio`) |

---

## 1. 데이터셋 구성

### 1.1 학습 데이터

| 데이터셋 | 설명 | 수량 |
|---|---|---|
| Crack500 | 아스팔트/콘크리트 균열 이미지 | train 1,896장 / val 348장 |
| 합성 데이터 (Synthetic) | 유물 이미지 기반 손상 합성 | train 960장 / val 240장 |

### 1.2 Val 라벨 분포

| 클래스 | GT Positive | 비율 |
|---|---|---|
| crack | 468개 | 79.6% |
| surface_damage | 120개 | 20.4% |
| discoloration | 120개 | 20.4% |

crack 비율이 높은 이유는 Crack500 val 348장이 전부 `[1, 0, 0]` 라벨이기 때문이다.
합성 데이터 val 240장은 다양한 라벨 조합을 포함한다.

### 1.3 합성 데이터 파이프라인

실제 손상된 유물 이미지는 구하기 어렵고 픽셀 단위 라벨링 비용이 높다.
이를 해결하기 위해 e뮤지엄에서 수집한 **온전한 유물 이미지 100장**에
세 종류의 손상 패턴을 프로그래밍으로 합성했다.

**손상 유형별 합성 방법**

- **crack**: 랜덤 워크 기반 균열선 생성. 시작점에서 방향각에 누적 노이즈를 더해 자연스러운 곡선 형태를 만들고, 0.5 확률로 분기 패턴을 추가한다. 균열 픽셀의 RGB 명도를 각각 20%, 15%, 10%로 낮춰 어두운 선으로 표현한다.
- **surface_damage**: 불규칙 폴리곤 기반 박락/깨짐 패턴. 랜덤 각도로 꼭짓점을 생성하고 반경에 노이즈를 더해 자연스러운 경계를 만든다. GaussianBlur로 경계를 부드럽게 처리 후 명도를 올려 밝게 표현한다.
- **discoloration**: 여러 불규칙 폴리곤을 누적 합성 후 넓게 블러 처리. 황변(R 강조, B 억제) 또는 청변(G 강조) 중 랜덤 선택해 색상 변화를 표현한다.

**Leakage 방지 설계**

동일 원본 이미지가 train/val에 동시에 등장하는 것을 막기 위해,
원본 100장을 train용(80장) / val용(20장)으로 먼저 분리한 뒤 각각 합성했다.
샘플 단위로 랜덤 분할하면 같은 유물에서 서로 다른 손상 패턴이 train/val에 동시에 들어가
val 성능이 부풀 수 있기 때문이다.

**Damage Config (12종)**

```python
damage_configs = [
    ['crack'], ['surface_damage'], ['discoloration'],
    ['crack', 'surface_damage'], ['crack', 'discoloration'],
    ['surface_damage', 'discoloration'],
    # 위 6종 반복 (총 12종)
]
```

80장 × 12종 = 960장 (train), 20장 × 12종 = 240장 (val)

---

## 2. 모델 구조

![ArtiFix 모델 구조](docs/model_architecture.svg)

### 2.1 4채널 입력 설계 근거

Sobel Edge Map을 추가 채널로 넣은 이유는 균열이 강한 에지 신호를 동반하기 때문이다.
명도 변화만으로는 표면 텍스처와 균열을 구분하기 어려운 케이스에서
에지 정보가 보조 신호로 작용할 수 있다는 가설 하에 설계했다.
실제 효과는 Ablation에서 검증했다 (+0.0161 mIoU).

### 2.2 멀티태스크 학습 설계 근거

Segmentation과 Classification을 동시에 학습하면
encoder가 두 태스크에 유용한 feature를 공유하게 된다.
분류 헤드가 "이 이미지에 crack이 있는가"를 학습하는 과정이
encoder의 표현력을 높여 segmentation에도 긍정적인 영향을 줄 수 있다는 가설 하에 설계했다.
Ablation 결과 +0.0038 mIoU 향상으로 이 가설이 지지되었다.
단, 향상폭이 크지 않아 task interference 가능성도 함께 논의한다 (섹션 5 참조).

### 2.3 Loss 함수

```
Total Loss = Seg Loss + λ × Cls Loss    (λ = 0.5)

Seg Loss = DiceLoss + BCEWithLogitsLoss(pos_weight)
Cls Loss = BCEWithLogitsLoss()
```

**pos_weight 자동 계산**

```python
ratio      = foreground_pixels / total_pixels
pos_weight = (1 - ratio) / ratio
```

train DataLoader 전체를 순회해 foreground 픽셀 비율을 측정하고 자동 산출한다.
이는 데이터 분포가 실험마다 다를 수 있으므로 하드코딩을 피하기 위함이다.

---

## 3. Ablation Study

### 3.1 실험 설계

각 기술 요소의 독립적인 기여도를 측정하기 위해 4단계 누적 실험을 수행했다.
기존 설정에 요소를 하나씩 추가하는 방식으로, 이전 실험의 best 설정을 유지한다.

| 실험 | USE_SOBEL | USE_MULTITASK | USE_SYNTHETIC | IN_CHANNELS |
|---|---|---|---|---|
| Baseline | False | False | False | 3 |
| +Synthetic | False | False | True | 3 |
| +Sobel | True | False | True | 4 |
| +Multitask | True | True | True | 4 |

모든 실험에서 pos_weight는 해당 실험의 train 데이터 분포로 자동 계산했다.

### 3.2 최종 결과

| 실험 | Best mIoU | Best Dice | Best F1 | Best Epoch |
|---|---|---|---|---|
| Baseline | 0.6520 | 0.7870 | — | 29 |
| +Synthetic | 0.6565 | 0.7868 | — | 42 |
| +Sobel | 0.6726 | 0.7993 | — | 38 |
| **+Multitask** | **0.6764** | **0.8028** | **0.9808** | 46 |

### 3.3 단계별 분석

| 변화 | mIoU 향상 | 비고 |
|---|---|---|
| Baseline → +Synthetic | +0.0045 (+0.7%) | 합성 데이터의 도메인 다양성 효과 |
| +Synthetic → +Sobel | +0.0161 (+2.5%) | 에지 정보가 균열 검출에 기여 |
| +Sobel → +Multitask | +0.0038 (+0.6%) | 분류 태스크 공동 학습의 소폭 기여 |
| **전체** | **+0.0244 (+3.7%)** | |

### 3.4 Baseline 상세 로그

- Train 데이터: Crack500 1,896장
- Best mIoU: **0.6520** (Epoch 29)
- Best Dice: **0.7870**
- 특이사항: USE_MULTITASK=False라 F1=0.0000 (classification 미수행)

주요 에폭:
```
[02/50] mIoU: 0.6083 | Dice: 0.7533
[05/50] mIoU: 0.6449 | Dice: 0.7815
[29/50] mIoU: 0.6520 | Dice: 0.7870  ← Best
[50/50] mIoU: 0.6320 | Dice: 0.7718
```

관찰: 29 에폭에서 best를 기록한 후 이후 에폭에서 소폭 하락하며 0.63~0.64 수준에서 진동.
Crack500만으로는 학습 데이터 다양성이 부족해 일반화 성능이 제한적임을 시사한다.

### 3.5 +Synthetic 상세 로그

- Train 데이터: Crack500 1,896 + Synthetic 960 = 2,856장
- Best mIoU: **0.6565** (Epoch 42)
- Best Dice: **0.7868**
- Baseline 대비: mIoU +0.0045

주요 에폭:
```
[05/50] mIoU: 0.5725 | Dice: 0.7224
[10/50] mIoU: 0.5896 | Dice: 0.7360
[31/50] mIoU: 0.6529 | Dice: 0.7849
[42/50] mIoU: 0.6565 | Dice: 0.7868  ← Best
[50/50] mIoU: 0.6424 | Dice: 0.7760
```

관찰: Baseline보다 수렴이 느리다. 합성 데이터가 포함되면서 데이터 다양성이 높아져
모델이 더 많은 에폭을 필요로 하는 것으로 해석된다.
향상폭(+0.0045)이 작은 이유는 합성 데이터가 실제 Crack500 텍스처와 다른 도메인이라
직접적인 val 성능 향상으로 이어지기 어렵기 때문이다.
그러나 classification 라벨 다양성 측면에서는 이후 멀티태스크 실험에 필수적이다.

### 3.6 +Sobel 상세 로그

- Train 데이터: 2,856장 (4채널 RGB+Sobel)
- Best mIoU: **0.6726** (Epoch 38)
- Best Dice: **0.7993**
- +Synthetic 대비: mIoU +0.0161

주요 에폭:
```
[07/50] mIoU: 0.5893 | Dice: 0.7368
[14/50] mIoU: 0.6117 | Dice: 0.7544
[26/50] mIoU: 0.6537 | Dice: 0.7850
[38/50] mIoU: 0.6726 | Dice: 0.7993  ← Best
[50/50] mIoU: 0.6562 | Dice: 0.7870
```

관찰: Sobel 추가로 4단계 실험 중 가장 큰 단일 향상폭을 보였다(+0.0161).
균열은 강한 에지 신호를 동반하므로 Sobel edge map이 encoder의 균열 특징 추출에
직접적으로 기여했음을 시사한다.
Best가 38 에폭으로 늦게 나타난 점은 4채널 입력에 대한 적응 기간이 필요함을 의미한다.

### 3.7 +Multitask 상세 로그

- Train 데이터: 2,856장 (4채널, Seg + Cls 공동 학습)
- Best mIoU: **0.6764** (Epoch 46)
- Best Dice: **0.8028**
- Best F1: **0.9808**
- +Sobel 대비: mIoU +0.0038

주요 에폭:
```
[08/50] mIoU: 0.5990 | Dice: 0.7427 | F1: 0.9850
[13/50] mIoU: 0.6243 | Dice: 0.7659 | F1: 0.9919
[32/50] mIoU: 0.6744 | Dice: 0.8011 | F1: 0.9784
[36/50] mIoU: 0.6763 | Dice: 0.8032 | F1: 0.9814
[46/50] mIoU: 0.6764 | Dice: 0.8028 | F1: 0.9808  ← Best
[50/50] mIoU: 0.6687 | Dice: 0.7970 | F1: 0.9825
```

관찰: mIoU 향상폭이 +0.0038로 가장 작다. 이는 멀티태스크 학습에서
classification loss가 segmentation 학습에 일부 간섭(task interference)을 일으킬 수 있음을 시사한다.
Dice가 0.80을 돌파했으며, F1은 0.98로 classification 성능이 매우 높다.
val loss가 0.5 수준으로 다른 실험 대비 크게 낮아진 점이 특징적이다.

---

## 4. Ablation 결과 해석 및 논의

### 4.1 Sobel > Multitask 현상

+Sobel(0.6726)이 +Multitask(0.6764)보다 단계 기여도가 더 크다.
이는 균열 검출에서 에지 정보가 classification 공동 학습보다 더 직접적인 효과를 가짐을 의미한다.

멀티태스크의 향상폭이 작은 원인으로 두 가지를 고려할 수 있다.

1. **Task interference**: classification loss(λ=0.5)가 segmentation 최적화를 방해할 수 있다. λ 값 조정 실험이 이를 검증할 수 있으나 시간 제약으로 수행하지 못했다.
2. **라벨 불균형**: val의 79.6%가 crack 단일 클래스라 classification 학습이 segmentation 개선에 기여하는 효과가 제한적일 수 있다.

### 4.2 Classification 성능 (F1 0.9808)

F1 수치는 threshold sweep을 통해 검증했다.

| Threshold | 평균 F1 | crack | surface_damage | discoloration |
|---|---|---|---|---|
| 0.2 | 0.9731 | 0.995 | 0.984 | 0.941 |
| 0.3 | 0.9743 | 0.995 | 0.983 | 0.945 |
| 0.4 | 0.9754 | 0.995 | 0.979 | 0.952 |
| 0.5 | 0.9754 | 0.995 | 0.979 | 0.952 |
| **0.6** | **0.9767** | **0.995** | **0.979** | **0.956** |

클래스별 최적 threshold:

| 클래스 | 최적 threshold | F1 |
|---|---|---|
| crack | 0.1 | 0.9968 |
| surface_damage | 0.7 | 0.9874 |
| discoloration | 0.7 | 0.9600 |

discoloration의 최적 threshold가 높은 것은 val 내 discoloration 샘플 수(120개)가
crack(468개)보다 적고, 합성 discoloration 패턴이 실제 변색과 차이가 있어
모델이 더 신중하게 판단할 때 정확도가 높아지기 때문으로 해석된다.

---

## 5. Fine-tuning (실제 유물 도메인 적응)

### 5.1 동기

Crack500은 아스팔트/콘크리트 균열 데이터셋이다.
학습된 모델을 실제 유물 이미지에 적용하면 텍스처 도메인이 달라
segmentation 품질이 떨어진다.
이를 완화하기 위해 실제 유물 이미지를 직접 라벨링해 fine-tuning을 수행했다.

### 5.2 라벨링 데이터

- **도구**: Label Studio (Brush 툴, 픽셀 단위 binary mask)
- **최종 데이터**: 45장
  - 손상 유물 31장 (균열, 박락, 결손 포함)
  - 정상 유물 14장 (negative sample, mask = 전부 0)

**Negative sample 추가 이유**

손상이 없는 거친 표면이나 적갈색 토기 표면을 손상으로 잡는 false positive 문제가 관찰되었다.
"손상 없는 거친 표면" 이미지를 빈 마스크(`mask=0`)와 함께 추가함으로써
모델이 "거친 표면 = 정상"을 학습하도록 했다.

### 5.3 Fine-tuning 설정

```python
FINETUNE_EPOCHS = 10
FINETUNE_LR     = 1e-5       # 기존 가중치를 크게 변형하지 않도록 낮게 설정
Loss            = DiceLoss + BCEWithLogitsLoss  # pos_weight 없이 단순화
```

**Classification loss 제외 근거**

라벨링 데이터의 cls_label이 모두 `[0, has_damage, 0]`으로 단순화되어
분류 학습에 노이즈가 될 수 있다.
Fine-tuning의 목적이 segmentation 도메인 적응이므로 seg loss만 사용하는 것이 적절하다.

### 5.4 Fine-tuning 결과

```
RealArtifactDataset: 45개
[FT 01/10] seg_loss: 1.1918
[FT 02/10] seg_loss: 1.0552
[FT 04/10] seg_loss: 0.9887
[FT 06/10] seg_loss: 0.9792
[FT 08/10] seg_loss: 0.9777  ← Best
🏁 Fine-tuning 완료 — Best loss: 0.9777
```

DiceLoss + BCEWithLogitsLoss 합산 기준 1.0 이하로 수렴해 정상 학습이 확인되었다.


### 5.5 Catastrophic Forgetting 대응

Fine-tuning 후 inference 결과에서 classification confidence가 낮아지는 현상이 관찰되었다.
Fine-tuned 모델이 유물 도메인 segmentation에 특화된 반면,
기존 best_model이 학습한 classification 표현이 손상된 것으로 판단했다.

이를 해결하기 위해 두 모델을 분리해 사용하는 방식을 채택했다.

```
seg_model = best_finetuned.pt  → Segmentation (유물 도메인 적응)
cls_model = best_model.pt      → Classification (원래 성능 유지)
```

두 모델을 동시에 로드해 각각의 출력만 사용하는 방식으로,
재학습 없이 두 태스크 모두의 성능을 최대한 유지했다.

### 5.6 모델 비교 기능

Fine-tuning의 실제 효과를 정성적으로 검증하기 위해
웹 UI에서 사용자가 추론 모델을 직접 선택할 수 있도록 구현했다.

지원 모델:

| Variant | 설명 |
|----------|----------|
| base | Fine-tuning 전 모델 (`best_model.pt`) |
| finetuned | Fine-tuning 후 모델 (`best_finetuned.pt`) |

사용자는 동일한 유물 이미지를 두 모델에 각각 입력해
Segmentation 결과를 직접 비교할 수 있다.

이를 통해 Fine-tuning이 실제 유물 도메인에서
손상 검출 품질에 어떤 영향을 주는지 정성적으로 확인하였다.

실험 결과 일부 실제 유물 이미지에서는
Fine-tuned 모델이 더 안정적인 손상 영역을 생성했으나,
일부 적갈색 토기에서는 정상 표면을 손상으로 오인하는 사례도 관찰되었다.

따라서 Fine-tuning은 실제 유물 적응에 도움이 되었지만,
추가적인 negative sample 확보가 필요함을 확인하였다.

---

## 6. 추론 파이프라인 개선

재학습 없이 추론 단계에서 segmentation 품질을 개선하기 위한 방법들을 적용했다.

### 6.1 Test Time Augmentation (TTA)

원본 이미지 외에 좌우반전, 상하반전 버전으로도 예측한 뒤 sigmoid 확률을 평균했다.
classification도 동일하게 TTA를 적용했다.

```python
seg_prob = (sigmoid(pred_orig) +
            sigmoid(pred_flip_lr) +
            sigmoid(pred_flip_ud)) / 3.0

cls_prob = (sigmoid(cls_orig) +
            sigmoid(cls_flip_lr) +
            sigmoid(cls_flip_ud)) / 3.0
```

단일 예측보다 안정적인 마스크를 얻을 수 있다.

### 6.2 Multi-scale Inference

256 단일 스케일에서는 얇은 균열이 resize 과정에서 소실될 수 있다.
384, 448, 512 세 스케일로 별도 예측 후 256으로 리사이즈해 평균했다.

```python
scales = [384, 448, 512]
seg_prob_final = mean([predict_at_scale(s) for s in scales])
```

각 스케일에서 TTA도 함께 적용했다 (스케일당 3회 예측, 총 9회 평균).
이미지 해상도 256의 제약을 추론 단계에서 부분적으로 보완하는 방법이다.

### 6.3 Morphological 후처리

얇은 균열이 끊기는 현상을 줄이기 위해 3×3 kernel로 MORPH_CLOSE를 1회 적용했다.
Kernel을 크게 하면 마스크가 번지므로 최소한으로 유지했다.

```python
kernel = np.ones((3, 3), np.uint8)
mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=1)
```

### 6.4 내부 결손(Hole) 검출 — 하이브리드 접근

유물 내부의 구멍/결손 영역은 딥러닝 모델이 일관되게 검출하기 어렵다.
이런 영역의 특성은 "유물 실루엣 내부에 배경색이 보인다"는 것이므로
규칙 기반으로 안정적으로 검출할 수 있다.

```python
hole_mask  = detect_internal_holes(cropped_rgb)
final_mask = np.maximum(model_mask, hole_mask)
```

딥러닝 segmentation + 규칙 기반 후처리의 조합은
모델이 잡지 못하는 케이스를 보완하는 견고한 설계 방식이다.

### 6.5 배경 제거 (rembg)

초기에는 HSV 임계값, Otsu 이진화, Adaptive threshold를 조합한 규칙 기반 crop을 사용했다.
그러나 회색 배경, 그림자, 받침대 등 다양한 배경 조건에서 crop 품질이 불안정했다.

이를 `rembg` (ONNX 기반 U²-Net)로 교체했다.
rembg는 학습된 AI 배경 제거 모델로, 복잡한 배경 조건에서도 안정적인 유물 실루엣 추출이 가능하다.

```python
from rembg import remove
output = remove(pil_img)  # RGBA 출력
alpha  = output[:, :, 3]  # 유물 영역 마스크
```

배경 제거 결과의 alpha 채널을 유물 마스크로 활용해 유물 외부의 false positive도 제거했다.

---

## 7. 개선 시도 및 실패 사례

### 7.1 seamlessClone 기반 합성 데이터 개선

**시도**

`cv2.seamlessClone`으로 Crack500 이미지에서 추출한 실제 균열 패치를
유물 이미지에 자연스럽게 합성하면 더 현실적인 학습 데이터를 만들 수 있다는
가설 하에 실험했다.

**결과**

동일 조건(50 에폭, +Multitask 설정)에서 best mIoU 0.6216으로,
기존 legacy 방식의 0.6764보다 낮게 나왔다.

**원인 분석**

Crack500은 아스팔트/콘크리트 텍스처이고 유물 이미지는 도자기/금속/석재 텍스처다.
seamlessClone이 픽셀 수준의 경계를 자연스럽게 합성하더라도,
두 도메인의 텍스처 자체가 달라 합성 데이터의 균열 패턴이 오히려 더 비자연스러웠을 가능성이 있다.
또한 seamlessClone 패치의 균열 면적이 legacy 방식보다 작아
foreground 픽셀 비율이 낮아지고 pos_weight가 높아진 점도 영향을 주었다.

**결론**

이 시도는 롤백하고 기존 best_model.pt를 최종 모델로 사용했다.
"실제 패치 합성이 반드시 더 좋은 것은 아니다"는 교훈을 남겼다.

---

## 8. 한계 및 향후 과제

### 8.1 한계

1. **도메인 갭**: 학습 데이터의 주축인 Crack500이 아스팔트/콘크리트 도메인이라 유물 표면과의 텍스처 차이가 존재한다. Crack500 val 기준 수치(mIoU 0.6764)와 실제 유물 이미지에서의 성능 사이에 괴리가 있다.

2. **합성 데이터 품질**: 코드로 생성한 손상 패턴은 실제 손상의 복잡한 형태를 완전히 재현하지 못한다. 특히 surface_damage와 일반 표면 텍스처의 경계가 모호해 false positive가 발생하는 케이스가 있다.

3. **멀티태스크 task interference**: +Multitask의 향상폭(+0.0038)이 작은 것은 classification loss가 segmentation 학습에 간섭할 수 있음을 시사한다. λ 값 조정 실험으로 최적값을 탐색하면 개선 가능하다.

4. **이미지 해상도**: 계산 자원 제약으로 256×256을 사용했다. 얇은 균열은 resize 과정에서 소실될 수 있으며, Multi-scale Inference로 부분 보완했다.

5. **Fine-tuning 데이터 부족**: 45장으로는 도메인 적응에 한계가 있다. Negative sample 추가로 false positive를 일부 줄였으나 근본적 해결에는 더 많은 데이터가 필요하다.

6. **합성 데이터 재현성**: 동일 시드에도 환경 차이로 완전히 동일한 합성 결과를 보장하기 어렵다. 생성된 데이터를 고정 저장해 재사용하는 방식이 필요하다.

### 8.2 향후 과제

- 실제 유물 라벨링 데이터를 100장 이상으로 확대해 도메인 적응 강화
- 이미지 해상도를 384 이상으로 높여 재학습
- λ 값 변화 Ablation 추가 (LAMBDA_CLS = 0.3, 1.0) — task interference 검증
- SAM, SegFormer 등 다른 모델과의 정량 비교
- 합성 데이터 고정 저장 후 재사용으로 재현성 확보
- 실제 손상 패치 기반 합성 개선 (도메인 통일 후 seamlessClone 재시도)