<div align="center">
  <img src="frontend/public/Artifix.png" alt="ArtiFix" width="300"/>
  <br/><br/>
  <a href="https://youtu.be/jrtAe4J110I">
    <img src="https://img.shields.io/badge/YouTube-데모_영상-FF0000?logo=youtube&logoColor=white" alt="YouTube 데모 영상"/>
  </a>
</div>

# ArtiFix

**유물·문화재 이미지의 표면 손상을 자동으로 탐지·분류하고, 웹 UI로 시각화하는 컴퓨터 비전 시스템입니다.**

박물관·문화재 보존 현장에서 전문가가 육안으로 수행하던 손상 기록·모니터링을 딥러닝으로 보조합니다.<br>
**복원(Restoration)이나 3D 재구성(Reconstruction)을 목표로 하지 않으며**, 손상 위치·유형·심각도를 **기록·검토**하는 데 초점을 둡니다.

---

## 목차

| | |
|---|---|
| **소개** | [프로젝트 배경](#프로젝트-배경) · [주요 기능](#주요-기능) |
| **시작하기** | [실행 방법](#실행-방법) · [환경 변수](#환경-변수) · [가중치·데이터](#가중치데이터) |
| **시스템** | [시스템 아키텍처](#시스템-아키텍처) · [API 명세](#api-명세) · [기술 스택](#기술-스택) · [프로젝트 구조](#프로젝트-구조) |
| **모델·실험** | [실험 과정](#실험-과정) |
| **기타** | [제한 사항 및 향후 과제](#제한-사항-및-향후-과제) · [참고](#참고) |

<details>
<summary><strong>주요 기능 상세 목차</strong></summary>

- [분석 옵션 선택](#분석-옵션-선택)
- [이미지 업로드](#이미지-업로드)
- [결과 확인](#결과-확인)
  - [손상 분석 요약](#손상-분석-요약)
  - [탭별 시각화](#탭별-시각화)
  - [손상 유형 · Confidence](#손상-유형--confidence)
  - [3D Damage Preview](#3d-damage-preview)
  - [분석 보고서 (PDF)](#분석-보고서-pdf)
  - [분석 이미지 저장](#분석-이미지-저장)
  - [분석 히스토리](#분석-히스토리)
  - [모델 비교 (파인튜닝 전 vs 후)](#모델-비교-파인튜닝-전-vs-후)

</details>

<details>
<summary><strong>실험 과정 상세 목차</strong></summary>

- [실험 환경](#실험-환경)
- [데이터셋 구성](#데이터셋-구성)
- [모델 구조](#모델-구조)
- [Ablation Study](#ablation-study)
- [Ablation 결과 해석](#ablation-결과-해석)
- [Fine-tuning](#fine-tuning-실제-유물-도메인-적응)
- [추론 파이프라인](#추론-파이프라인)
- [개선 시도 및 실패 사례](#개선-시도-및-실패-사례)

</details>

---

## 프로젝트 배경

문화재 손상은 균열, 박락, 변색 등 다양한 형태로 나타나며, 이를 체계적으로 기록하는 일은 보존 관리의 첫 단계입니다. 그러나 기존 방식은 전문가의 육안 검사와 수작업 기록에 의존해 시간과 비용이 많이 소요됩니다.

ArtiFix는 딥러닝 기반 Segmentation과 Multi-label Classification을 결합한 멀티태스크 모델로 이 과정을 자동화합니다. 이미지 한 장을 업로드하면 손상 위치(픽셀 마스크)·유형(3종 분류)·심각도를 산출하고, Grad-CAM과 3D 시각화·PDF 보고서까지 제공합니다.

| 입력 | 출력 |
|------|------|
| 유물 사진 (JPG / PNG) | 손상 마스크, 오버레이, Grad-CAM, 다중 라벨 분류 신뢰도, 심각도 등급, PDF 보고서 |

<div align="center">
  <img src="docs/home.gif" alt="ArtiFix 데모" width="800"/>
</div>

---

## 주요 기능

웹 UI는 **분석 옵션 선택 → 이미지 업로드 → 결과 확인** 순서로 동작합니다. 메인 화면에서 **「분석하기」** 를 누르면 분석을 진행할 수 있습니다. 각 옵션 옆 **(i)** 아이콘을 누르면 기능 설명이 표시됩니다.

### 분석 옵션 선택

**「분석 옵션」** 카드에서 추론 방식을 지정합니다. **이미지를 업로드하기 전에** 옵션을 먼저 설정하는 것이 기본 흐름이며, Detection Threshold는 결과 화면에서도 조절할 수 있습니다.
![분석 옵션 선택](docs/option.png)
#### 분석 모델 선택

| 옵션 | 가중치 | 설명 |
|------|--------|------|
| **파인튜닝 후** (기본) | `best_finetuned.pt` | 실제 유물 데이터로 파인튜닝된 모델 |
| **파인튜닝 전** | `best_model.pt` | 파인튜닝 전 베이스 모델 |

동일 이미지에 두 모델을 각각 적용해 Segmentation·분류 품질을 비교할 수 있습니다. [모델 비교](#모델-비교-파인튜닝-전-vs-후)에서 같은 유물에 대한 결과 차이 예시를 확인할 수 있습니다.

#### Crop 선택

| 옵션 | 설명 |
|------|------|
| **Auto Crop 사용** (기본 켜짐) | 유물 영역을 자동으로 잘라 모델 입력에 맞춥니다. 끄면 **업로드한 원본 전체**를 분석합니다. |
| **AI Background Removal** (rembg, 기본) | U²-Net 기반 배경 제거 → 아이보리 배경 합성 → 유물 bbox tight crop. 박물관 배경·그림자 제거에 유리합니다. |
| **Legacy Crop** | HSV·Otsu·엣지 기반 규칙 crop. rembg가 실패하거나 어두운 유물에 더 나을 때 선택합니다. |

crop 면적이 원본의 **35% 미만**이면 과도한 잘림으로 보고 **원본 프레임을 유지**합니다.

#### Detection Threshold 설정 

- Segmentation 마스크 생성 **임계값**입니다. **낮을수록** 더 많은 영역을 손상으로 잡고, **높을수록** 보수적으로 잡습니다.
- **업로드 전**: 분석 옵션 카드의 슬라이더로 설정 (기본 **0.25**, 서버 허용 범위 **0.05~0.60**).
- **분석 후**: **Detection Sensitivity** 슬라이더로 변경 가능하며, 슬라이더를 놓으면 **동일 이미지로 재분석**됩니다.

---

### 이미지 업로드

[분석 옵션](#분석-옵션-선택)을 설정한 뒤, 유물 사진을 업로드하면 선택한 옵션이 그대로 적용됩니다.
![분석 옵션 선택](docs/image.png)
| 방식 | 설명 |
|------|------|
| **파일 업로드** | JPG·PNG를 드래그 앤 드롭하거나 클릭해 선택합니다. |
| **카메라 촬영** | 업로드 영역 옆 **「카메라로 촬영」** 버튼으로 웹캠·모바일 카메라에 접근해 현장에서 바로 촬영·분석할 수 있습니다. |

- 업로드가 완료되면 **즉시 서버 추론**이 시작됩니다.
- 지원 형식: **JPG, PNG** (유물 표면이 잘 보이도록 촬영·크롭된 이미지 권장).

![분석 로딩](docs/loading.png)
---

### 결과 확인

추론이 끝나면 **「분석 결과」** 섹션에서 손상 위치·유형·심각도를 확인하고, 시각화·저장·보고서까지 이어집니다.

#### ArtiFix가 다루는 손상 유형

Segmentation은 **손상 픽셀 전체**를 하나의 마스크로 찾고, Classification은 아래 3종 유형별 confidence(0~100%)를 **Multi-label**로 독립 반환합니다.

| ID (API·UI) | 표시명 | 설명 | 전형적인 예 |
|-------------|--------|------|-------------|
| `crack` | Crack (균열) | **선형·망상 균열**, 미세 crack | 도자기·석재 헤어라인, 뻗어 나가는 균열 |
| `surface_damage` | Surface Damage (표면 손상) | **박락·깨짐**, 국소적 표면 결손 | 모서리 chip, flaking, 벗겨짐 |
| `discoloration` | Discoloration (변색) | **얼룩·변색·황변·청변** | 수분·오염·노화로 인한 색 변화 |

- **Segmentation 마스크**: 유형 구분 없이 손상 픽셀 전체를 빨간 오버레이로 표시
- **Primary Damage Type**: confidence가 가장 높은 유형을 요약 카드에 표시

| Crack (균열) | Surface Damage (표면 손상) | Discoloration (변색) |
|:---:|:---:|:---:|
| ![균열 분석 예시](docs/균열결과.png) | ![표면 손상 분석 예시](docs/표면손상결과.png) | ![변색 분석 예시](docs/변색결과.png) |

#### 손상 분석 요약
![손상 분석 요약](docs/손상분석요약.png)
| 항목 | 설명 |
|------|------|
| **Damage Area** | 이미지 전체 대비 손상 픽셀 비율(%) |
| **Severity** | 면적·감지 유형 수를 종합한 `high` / `medium` / `low` / `none` |
| **Region Count** | 분할 마스크에서 분리된 손상 영역(바운딩 박스) 개수 |
| **Primary Damage Type** | `crack` · `surface_damage` · `discoloration` 중 confidence가 가장 높은 유형 |

#### 탭별 시각화

<details>
<summary><strong>인터랙티브 · Grad-CAM · 전후 비교 · 전체 보기</strong></summary>

| 인터랙티브 캔버스 | 줌 모달 |
|:---:|:---:|
| ![인터랙티브 분석](docs/인터랙티브분석.png) | ![줌](docs/줌.png) |

원본 위 손상 오버레이·노란 bbox 표시. 박스 클릭 → **Region Inspector**에서 면적·비율·confidence 확인, **줌 모달**로 확대.

![Grad-CAM](docs/Grad-CAM.png) · ![Grad-CAM 비교](docs/Grad-CAM비교.png)

분류 모델이 주목한 영역을 히트맵으로 표시. 원본과 나란히 비교해 판단 근거 확인.

![전후 비교](docs/전후비교.png) — 슬라이더로 원본 vs 오버레이 겹침 비교

![전체 보기](docs/전체보기.png) — 원본·마스크·오버레이·Grad-CAM 갤러리 (개별 PNG 저장 가능)

</details>

#### 손상 유형 · Confidence
![confidence](docs/confidence.png)

3종 유형별 confidence(0~100%)를 배지·차트로 표시. **복합 손상**(균열+변색 등) 동시 표현.

<details>
<summary><strong>3D Preview · PDF · 히스토리 · 이미지 저장</strong></summary>

![3D Preview](docs/3D프리뷰.png)

배경 제거 유물을 **Sphere · Cylinder · 평면**에 투영해 회전 확인. 평면 모드는 마스크 displacement로 손상 위치를 입체 강조.

> **3D Preview**는 시각화 기능이며, 실제 형상 복원·3D 재구성을 수행하지 않습니다.

| 사진 모드 | 히트맵 모드 |
|:---:|:---:|
| ![3D 사진 모드](docs/사진모드.gif) | ![3D 히트맵 모드](docs/히트맵모드.gif) |

![분석 보고서 UI](docs/pdf.png) · ![PDF 보고서](docs/report.png)

심각도·면적·유형 confidence·분석 이미지를 **한글 PDF**로 다운로드 (화면 옵션과 동일 설정).

![history](docs/히스토리.png)

- 세션당 최근 **10건** 보관 · 클릭해 결과 재열기 · 개별·전체 삭제
- 분석 **옵션**은 LocalStorage에 저장

</details>

#### 모델 비교 (파인튜닝 전 vs 후)

동일 유물에 **파인튜닝 전/후**를 각각 분석해 Segmentation·수치·Confidence를 비교합니다. Crop·Threshold는 **동일 값**으로 맞추세요.

| 파인튜닝 전 (`best_model.pt`) | 파인튜닝 후 (`best_finetuned.pt`) |
|:---:|:---:|
| ![파인튜닝 전 결과](docs/모델비교_파인튜닝전.png) | ![파인튜닝 후 결과](docs/모델비교_파인튜닝후.png) |

> 수치·해석: [Fine-tuning 전후 Inference 비교](#fine-tuning-전후-inference-비교) · 학습 배경: [Fine-tuning](#fine-tuning-실제-유물-도메인-적응)

#### 백엔드 산출물

결과 화면의 이미지·수치는 FastAPI `/predict` 응답을 기반으로 합니다.

- **Segmentation**: 픽셀 단위 이진 마스크 + 빨간색 오버레이 합성
- **후처리**: rembg/유물 실루엣 기반 `damage_allowed` 마스크로 **배경·유물 외부 오탐 제거**, morphology·hole 필터 적용
- **바운딩 박스**: 연결 요소별 `bboxes` (면적·좌표) — 인터랙티브 캔버스·PDF·Region Inspector에 사용

---

## 실험 과정

### 실험 환경

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

### 데이터셋 구성

#### 학습 데이터

| 데이터셋 | 설명 | 수량 |
|---|---|---|
| Crack500 | 아스팔트/콘크리트 균열 이미지 | train 1,896장 / val 348장 |
| 합성 데이터 (Synthetic) | 유물 이미지 기반 손상 합성 | train 960장 / val 240장 |

#### Val 라벨 분포

| 클래스 | GT Positive | 비율 |
|---|---|---|
| crack | 468개 | 79.6% |
| surface_damage | 120개 | 20.4% |
| discoloration | 120개 | 20.4% |

crack 비율이 높은 이유는 Crack500 val 348장이 전부 `[1, 0, 0]` 라벨이기 때문이다.
합성 데이터 val 240장은 다양한 라벨 조합을 포함한다.

#### 합성 데이터 파이프라인

국립중앙박물관 [e뮤지엄](https://www.emuseum.go.kr/main)에서 **직접 수집**한 유물 100장 기반. 픽셀 라벨링 대신 3종 손상을 코드로 합성.

- **crack**: 랜덤 워크 균열선 + 분기(50%) + RGB 명도 감소
- **surface_damage**: 불규칙 폴리곤 박락 + GaussianBlur + 명도 증가
- **discoloration**: 다중 폴리곤 + 블러 + 황변/청변 랜덤

**Leakage 방지**: 원본 100장을 train(80)/val(20) 먼저 분리 후 각각 합성. 12종 damage config × 장수 = train 960 / val 240.

### 모델 구조

![ArtiFix 모델 구조](docs/model_architecture.svg)

#### 4채널 입력 · 멀티태스크 · Loss

- **Sobel Edge Map (+1ch)**: 균열의 에지 신호를 보조 입력으로 활용 → Ablation **+0.0161 mIoU**
- **멀티태스크 (Seg + Cls)**: encoder feature 공유 가설 → **+0.0038 mIoU** (task interference 가능성은 [Ablation 결과 해석](#ablation-결과-해석) 참조)

```
Total Loss = Seg Loss + λ × Cls Loss    (λ = 0.5)
Seg Loss = DiceLoss + BCEWithLogitsLoss(pos_weight)
Cls Loss = BCEWithLogitsLoss()
pos_weight = (1 - ratio) / ratio   # train foreground 비율 기반 자동 계산
```

**파인튜닝**: 45장 실제 유물로 Segmentation만 추가 학습 → [Fine-tuning](#fine-tuning-실제-유물-도메인-적응)

### Ablation Study

#### 실험 설계

각 기술 요소의 독립적인 기여도를 측정하기 위해 4단계 누적 실험을 수행했다.
기존 설정에 요소를 하나씩 추가하는 방식으로, 이전 실험의 best 설정을 유지한다.

| 실험 | USE_SOBEL | USE_MULTITASK | USE_SYNTHETIC | IN_CHANNELS |
|---|---|---|---|---|
| Baseline | False | False | False | 3 |
| +Synthetic | False | False | True | 3 |
| +Sobel | True | False | True | 4 |
| +Multitask | True | True | True | 4 |

모든 실험에서 pos_weight는 해당 실험의 train 데이터 분포로 자동 계산했다.

#### 최종 결과

| 실험 | Best mIoU | Best Dice | Best F1 | Best Epoch |
|---|---|---|---|---|
| Baseline | 0.6520 | 0.7870 | — | 29 |
| +Synthetic | 0.6565 | 0.7868 | — | 42 |
| +Sobel | 0.6726 | 0.7993 | — | 38 |
| **+Multitask** | **0.6764** | **0.8028** | **0.9808** | 46 |

| Baseline | +Synthetic Data |
|:---:|:---:|
| ![baseline](docs/baseline_curves.png) | ![synthetic](docs/synthetic_curves.png) |
| mIoU 0.6520 | mIoU 0.6565 (+0.0045) |

| +Sobel Edge | +Multitask |
|:---:|:---:|
| ![sobel](docs/sobel_curves.png) | ![multitask](docs/multitask_curves.png) |
| mIoU 0.6726 (+0.0161) | mIoU **0.6764** (+0.0038) |

#### 단계별 분석

| 변화 | mIoU 향상 | 비고 |
|---|---|---|
| Baseline → +Synthetic | +0.0045 (+0.7%) | 합성 데이터의 도메인 다양성 효과 |
| +Synthetic → +Sobel | +0.0161 (+2.5%) | 에지 정보가 균열 검출에 기여 |
| +Sobel → +Multitask | +0.0038 (+0.6%) | 분류 태스크 공동 학습의 소폭 기여 |
| **전체** | **+0.0244 (+3.7%)** | |

<details>
<summary><strong>Ablation 상세 학습 로그</strong></summary>

**Baseline** — Crack500 1,896장 · Best mIoU **0.6520** (Ep.29) · Dice 0.7870

```
[29/50] mIoU: 0.6520 | Dice: 0.7870  ← Best
[50/50] mIoU: 0.6320 | Dice: 0.7718
```
Ep.29 이후 0.63~0.64 진동. Crack500 단독은 다양성 부족.

**+Synthetic** — 2,856장 · mIoU **0.6565** (Ep.42, +0.0045)

```
[42/50] mIoU: 0.6565 | Dice: 0.7868  ← Best
```
수렴 느림. 합성 도메인 차이로 val 향상폭은 작으나 cls 라벨 다양성에 기여.

**+Sobel** — 4ch · mIoU **0.6726** (Ep.38, +0.0161)

```
[38/50] mIoU: 0.6726 | Dice: 0.7993  ← Best
```
4단계 중 최대 단일 향상. 에지 정보가 균열 특징 추출에 직접 기여.

**+Multitask** — Seg+Cls · mIoU **0.6764** (Ep.46) · Dice 0.8028 · F1 **0.9808** (+0.0038)

```
[46/50] mIoU: 0.6764 | Dice: 0.8028 | F1: 0.9808  ← Best
```
mIoU 향상은 가장 작음. cls loss 간섭 가능성. Dice 0.80 돌파.

</details>

### Ablation 결과 해석

#### Sobel vs Multitask

+Sobel(0.6726)이 +Multitask(0.6764)보다 단계 기여도가 더 크다.
이는 균열 검출에서 에지 정보가 classification 공동 학습보다 더 직접적인 효과를 가짐을 의미한다.

멀티태스크의 향상폭이 작은 원인으로 두 가지를 고려할 수 있다.

1. **Task interference**: classification loss(λ=0.5)가 segmentation 최적화를 방해할 수 있다. λ 값 조정 실험이 이를 검증할 수 있으나 시간 제약으로 수행하지 못했다.
2. **라벨 불균형**: val의 79.6%가 crack 단일 클래스라 classification 학습이 segmentation 개선에 기여하는 효과가 제한적일 수 있다.

#### Classification 성능 (F1 0.9808)

Threshold sweep 결과 (평균 F1 최대 **0.9767** @ 0.6). 클래스별 최적 threshold: crack **0.1** (F1 0.9968), surface_damage **0.7** (0.9874), discoloration **0.7** (0.9600).

discoloration threshold가 높은 이유: val 샘플 수 적음(120) + 합성 패턴과 실제 변색의 gap.

### Fine-tuning (실제 유물 도메인 적응)

#### 동기 · 라벨링

Crack500(아스팔트/콘크리트)과 유물 표면의 **도메인 갭**을 줄이기 위해, 국립중앙박물관 [e뮤지엄](https://www.emuseum.go.kr/main)에서 **직접 수집**한 유물 **45장**을 Label Studio(Brush)로 **직접 픽셀 라벨링**했다 (손상 31 + 정상 14). 정상 14장은 거친 표면·토기 표면 **false positive** 완화용 negative sample.

#### Fine-tuning 설정 · 결과

```python
FINETUNE_EPOCHS = 10;  FINETUNE_LR = 1e-5
Loss = DiceLoss + BCEWithLogitsLoss  # cls loss 제외 (라벨 단순화로 노이즈 방지)
```

```
[FT 08/10] seg_loss: 0.9777  ← Best  (1.0 이하 수렴 확인)
```

#### Catastrophic Forgetting 대응

Fine-tuning 후 **classification confidence 저하** 관찰 → 두 모델 분리 로드:

```
seg_model = best_finetuned.pt   # Segmentation (유물 도메인)
cls_model = best_model.pt       # Classification (원래 성능 유지)
```

#### Fine-tuning 전후 Inference 비교

동일 유물(석제 원형, 균열) 기준 정성 비교. 시각적 결과는 [모델 비교](#모델-비교-파인튜닝-전-vs-후) 참고.

| 항목 | 파인튜닝 전 | 파인튜닝 후 |
|------|------------|------------|
| **Damage Area** | 0.8% | 4.83% |
| **Region Count** | 2개 | 4개 |
| **Severity** | LOW | LOW |
| **Segmentation** | 균열 일부만 검출 | 주요 경로·분기까지 더 완전한 마스크 |

Crack500 도메인 편향 → fine-tuning 후 유물 균열 패턴 적응. Severity는 동일하나 실제 감지 면적은 약 **6배** 차이. mIoU 정량 비교는 평가 데이터 부족으로 미수행.

### 추론 파이프라인

```
업로드 이미지 (JPG / PNG)
        │
        ▼
  [Crop 전처리]
  rembg: U²-Net 배경 제거 → 아이보리 배경 합성 → tight bbox crop
  legacy: HSV·Otsu·엣지 기반 crop
        │
        ▼
  [4채널 텐서 생성]
  RGB 정규화 + Sobel Edge 계산 → (4, 256, 256)
        │
        ▼
  [멀티스케일 TTA 추론]
  384 / 448 / 512px 각 스케일에서 원본 + 좌우반전 + 상하반전 예측
  총 9회 sigmoid 확률 평균 → 안정적인 마스크
        │
        ▼
  [후처리]
  ├── MORPH_CLOSE (3×3 kernel): 균열 단절 완화
  ├── damage_allowed 마스크: 유물 외부 오탐 제거
  ├── hole 검출 (규칙 기반): 유물 내부 결손 보완
  └── 연결 요소 분석: 바운딩 박스 목록 생성
        │
        ▼
  [산출물]
  mask, overlay, gradcam,
  artifact_image (투명 RGBA), artifact_overlay_image (손상+유물 RGBA),
  labels, bboxes, damage_ratio, severity
```

재학습 없이 추론 단계 품질을 높이기 위한 기법:

| 기법 | 내용 |
|------|------|
| **TTA** | 원본 + 좌우·상하 반전 3-way sigmoid 평균 (seg·cls 공통) |
| **Multi-scale** | 384/448/512px 예측 → 256 리사이즈 평균 (스케일당 TTA, 총 9회) |
| **MORPH_CLOSE** | 3×3 kernel 1회 — 균열 단절 완화 (kernel 크면 번짐) |
| **Hole 검출** | 유물 실루엣 내부 배경색 = 규칙 기반 결손 보완 (`max(model_mask, hole_mask)`) |
| **rembg crop** | U²-Net 배경 제거 → alpha로 `damage_allowed` 마스크, 유물 외부 오탐 제거 |

<details>
<summary><strong>추론 파이프라인 코드 스니펫</strong></summary>

```python
# TTA
seg_prob = mean(sigmoid(pred_orig), sigmoid(pred_flip_lr), sigmoid(pred_flip_ud))

# Multi-scale
seg_prob_final = mean([predict_at_scale(s) for s in [384, 448, 512]])

# Hole + Morphology
final_mask = np.maximum(model_mask, detect_internal_holes(cropped_rgb))
mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((3,3), np.uint8), iterations=1)
```

</details>

### 개선 시도 및 실패 사례

#### seamlessClone 합성 데이터 개선 (실패)

Crack500 균열 패치를 `cv2.seamlessClone`으로 유물에 합성 → 동일 설정(+Multitask)에서 mIoU **0.6216** (legacy 0.6764 대비 하락). 아스팔트↔유물 텍스처 gap, 패치 면적 축소로 pos_weight 상승이 원인으로 추정. **롤백** 후 legacy 방식 유지.

---

## 시스템 아키텍처

<div align="center">
  <img src="docs/artifix_architecture.svg" alt="ArtiFix 시스템 아키텍처" width="920"/>
</div>

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| **딥러닝 프레임워크** | PyTorch, segmentation-models-pytorch |
| **데이터 증강** | Albumentations |
| **이미지 처리** | OpenCV, NumPy, Pillow |
| **배경 제거** | rembg (ONNX Runtime, U²-Net) |
| **API 서버** | FastAPI, Uvicorn |
| **PDF 생성** | ReportLab |
| **프론트엔드** | React 18, Vite 6, Tailwind CSS 3 |
| **3D 렌더링** | Three.js (OrbitControls) |
| **라우팅** | React Router v6 |
| **학습 환경** | Kaggle (T4 GPU), Python 3.10+ |

---

## 프로젝트 구조

```
ArtiFix/
├── backend/          # FastAPI · inference · report · weights/
├── frontend/src/     # React 페이지·컴포넌트·api·utils
├── notebooks/        # multitask.ipynb · finetuning.ipynb
├── real_dataset/     # fine-tuning 라벨 데이터 (Kaggle)
├── image/            # 합성용 유물 원본 100장 (Kaggle)
├── docs/             # 아키텍처·UI 스크린샷
└── README.md
```

<details>
<summary><strong>디렉터리 상세</strong></summary>

```
backend/
├── main.py            # /predict · /report · /health
├── inference.py       # 모델, crop, TTA 추론, 후처리
├── report.py          # PDF 생성 (ReportLab)
└── weights/           # best_model.pt · best_finetuned.pt

frontend/src/
├── pages/             # Home.jsx · About.jsx
├── components/        # Uploader, ResultViewer, 3D, Grad-CAM, History 등
└── api/api.js         # predict · report · mock API
```

</details>

---

## 실행 방법

> 백엔드·프론트엔드를 로컬에서 띄우는 방법입니다. 가중치 파일은 [가중치·데이터](#가중치데이터)에서 먼저 받아 두세요.

### 사전 요구 사항

- Python 3.10 이상
- Node.js 18 이상
- CUDA 지원 GPU (선택, 없으면 CPU 추론)
- 학습 가중치: `backend/weights/best_model.pt`, `best_finetuned.pt` — [Kaggle에서 다운로드](#가중치데이터)

### 백엔드

```bash
cd backend

# 가상 환경 생성·활성화
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS / Linux

pip install -r requirements.txt

# 서버 실행
uvicorn main:app --reload --port 8000
```

> rembg 첫 실행 시 `u2net.onnx`를 자동 다운로드합니다 (약 170 MB).  
> 서버 충돌 시 브라우저에서 CORS 오류처럼 보일 수 있으니 터미널 로그를 먼저 확인하세요.

- 헬스 체크: `http://localhost:8000/health`
- API 문서 (Swagger): `http://localhost:8000/docs`

### 프론트엔드

```bash
cd frontend
npm install
npm run dev
```

기본 주소: `http://localhost:5173`

백엔드 연동을 위해 `frontend/.env` (또는 `.env.local`)을 생성합니다.

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_USE_MOCK_API=false
```

백엔드 없이 UI만 확인하려면 `VITE_USE_MOCK_API=true`로 설정하면 더미 응답이 반환됩니다.

### 프로덕션 빌드

```bash
cd frontend
npm run build
npm run preview   # http://localhost:4173
```

---

## API 명세

### `GET /health`

서버 상태·로드된 모델·기본 설정을 확인합니다.

```json
{
  "status": "ok",
  "models": ["base", "finetuned"],
  "default_model_variant": "finetuned",
  "crop_modes": ["rembg", "legacy"],
  "default_crop_mode": "rembg"
}
```

---

### `POST /predict`

**Content-Type:** `multipart/form-data`

#### 요청 파라미터

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `image` | file | 필수 | JPG / PNG |
| `seg_threshold` | float | `0.10` | Segmentation 이진화 임계값 (0.05 ~ 0.30) |
| `use_auto_crop` | string | `"true"` | 유물 자동 crop 사용 여부 |
| `model_variant` | string | `"finetuned"` | `"base"` \| `"finetuned"` |
| `crop_mode` | string | `"rembg"` | `"rembg"` \| `"legacy"` |

#### 응답 (주요 필드)

| 필드 | 타입 | 설명 |
|------|------|------|
| `original_image` | base64 PNG | crop된 RGB 이미지 |
| `artifact_image` | base64 PNG | 배경 제거 유물 RGBA |
| `artifact_overlay_image` | base64 PNG | 유물 + 손상 오버레이 RGBA |
| `mask_image` | base64 PNG | 손상 마스크 시각화 |
| `overlay_image` | base64 PNG | 손상 오버레이 합성 이미지 |
| `gradcam_image` | base64 PNG | Grad-CAM 히트맵 |
| `labels` | object | `{ crack, surface_damage, discoloration }` 신뢰도 (0~1) |
| `damage_ratio` | float | 손상 픽셀 비율 (%) |
| `severity` | string | `"high"` \| `"medium"` \| `"low"` \| `"none"` |
| `bboxes` | array | `[{ x, y, w, h, area }, ...]` |
| `model_variant` | string | 실제 사용된 모델 ID |

---

### `POST /report`

`/predict`와 동일한 form 필드를 받아 분석 후 **PDF 파일 바이너리**를 반환합니다.  
응답 헤더: `Content-Type: application/pdf`

---

## 환경 변수

### 프론트엔드 (`frontend/.env`)

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `VITE_API_BASE_URL` | `http://localhost:8000` | 백엔드 서버 주소 |
| `VITE_USE_MOCK_API` | `false` | `true` 시 더미 응답 반환 (백엔드 불필요) |

### 백엔드

별도 `.env` 없이 `main.py` / `inference.py` 내 상수로 동작합니다.  
CUDA가 설치된 환경에서는 PyTorch가 자동으로 GPU를 감지합니다.

---

## 가중치·데이터

GitHub 용량 제한(100 MB)으로 가중치·fine-tuning·합성 원본은 Kaggle에 데이터셋으로 업로드해 두었으므로 아래 링크에서 다운로드가 가능합니다.

| 데이터셋 | Kaggle | 배치 경로 |
|----------|--------|-----------|
| **ArtiFix Weights** | [bearivh/artifix-weights](https://www.kaggle.com/datasets/bearivh/artifix-weights) | `backend/weights/` |
| **Real Dataset** | [bearivh/real-dataset](https://www.kaggle.com/datasets/bearivh/real-dataset) | `real_dataset/` |
| **ArtiFix Artifacts** | [bearivh/artifix-artifacts](https://www.kaggle.com/datasets/bearivh/artifix-artifacts) | `image/` |

| 데이터 | 출처 | 용도 |
|--------|------|------|
| Crack500 | [Kaggle](https://www.kaggle.com/datasets/vangiap/crack500-dataset) | 베이스 학습 (균열) |
| 합성 데이터 | artifix-artifacts 100장 기반 코드 생성 | 베이스 학습 (3종 손상·라벨) |
| Real Dataset | bearivh/real-dataset | fine-tuning (31+14장) |

학습 노트북: `notebooks/multitask.ipynb` (Ablation 포함) · `notebooks/finetuning.ipynb`

---

## 제한 사항 및 향후 과제

### 한계

1. **도메인 갭**: 학습 데이터의 주축인 Crack500이 아스팔트/콘크리트 도메인이라 유물 표면과의 텍스처 차이가 존재한다. Crack500 val 기준 수치(mIoU 0.6764)와 실제 유물 이미지에서의 성능 사이에 괴리가 있다.

2. **합성 데이터 품질**: 코드로 생성한 손상 패턴은 실제 손상의 복잡한 형태를 완전히 재현하지 못한다. 특히 surface_damage와 일반 표면 텍스처의 경계가 모호해 false positive가 발생하는 케이스가 있다.

3. **멀티태스크 task interference**: +Multitask의 향상폭(+0.0038)이 작은 것은 classification loss가 segmentation 학습에 간섭할 수 있음을 시사한다. λ 값 조정 실험으로 최적값을 탐색하면 개선 가능하다.

4. **이미지 해상도**: 계산 자원 제약으로 256×256을 사용했다. 얇은 균열은 resize 과정에서 소실될 수 있으며, Multi-scale Inference로 부분 보완했다.

5. **Fine-tuning 데이터·정량 평가 부족**: 45장으로는 도메인 적응에 한계가 있다. Negative sample 추가로 false positive를 일부 줄였으나 근본적 해결에는 더 많은 데이터가 필요하다. fine-tuning 전후 mIoU 비교는 정량 평가 데이터 부족으로 수행하지 못했다 ([Fine-tuning 전후 Inference 비교](#fine-tuning-전후-inference-비교) 참고).

6. **합성 데이터 재현성**: 동일 시드에도 환경 차이로 완전히 동일한 합성 결과를 보장하기 어렵다. 생성된 데이터를 고정 저장해 재사용하는 방식이 필요하다.

7. **운영·사용 측면**: 의료·법적 감정을 대체하지 않으며, 보존 전문가의 최종 판단이 필요하다. 조명·배경·촬영 각도에 따라 Segmentation 및 분류 성능이 달라질 수 있다. rembg 첫 실행 및 대용량 이미지 처리 시 응답이 지연될 수 있다.

8. **변색 검출 한계**: 단일 이미지만으로는 **원래 색상을 알 수 없어** 황변·산화·본래 색 불균일을 구분하기 어렵다. 합성 변색 패턴도 실제보다 단순하다. 복수 시점 비교·제작 기록 결합 없이는 한계가 있다.

### 향후 과제

- 실제 유물 라벨링 데이터를 100장 이상으로 확대해 도메인 적응 강화
- 이미지 해상도를 384 이상으로 높여 재학습
- λ 값 변화 Ablation 추가 (LAMBDA_CLS = 0.3, 1.0) — task interference 검증
- SAM, SegFormer 등 다른 모델과의 정량 비교
- 합성 데이터 고정 저장 후 재사용으로 재현성 확보
- 실제 손상 패치 기반 합성 개선 (도메인 통일 후 seamlessClone 재시도)

---

## 참고

### 데이터·이미지 출처

| 자료 | 링크 | ArtiFix에서의 활용 |
|------|------|-------------------|
| **국립중앙박물관 e뮤지엄** | [emuseum.go.kr](https://www.emuseum.go.kr/main) | 합성·fine-tuning용 유물 사진 **직접 수집** |
| **Crack500** | [vangiap/crack500-dataset (Kaggle)](https://www.kaggle.com/datasets/vangiap/crack500-dataset) | 베이스 모델 학습용 균열 Segmentation 데이터 |

> e뮤지엄 소장품 이미지 사용 시 해당 사이트의 [저작권 정책](https://www.emuseum.go.kr/main)을 따릅니다.

### AI 도구

본 프로젝트 개발·문서 작성 과정에서 아래 AI 도구를 보조적으로 사용했습니다.

- **[Cursor](https://cursor.com)** — IDE 내 코드 작성·리팩터링·디버깅
- **[Claude](https://claude.ai)** (Anthropic) — 설계 검토, 문서 정리, README 작성 보조
