import CompareSlider from './CompareSlider.jsx'
import DownloadButton from './DownloadButton.jsx'

export default function GradCamPanel({ originalSrc, gradcamSrc, primaryLabel }) {
  if (!gradcamSrc) {
    return (
      <div className="card-panel flex min-h-[240px] flex-col items-center justify-center p-8 text-center">
        <p className="text-sm text-bronze-light">
          Grad-CAM 결과를 불러오지 못했습니다.
          <br />
          백엔드가 최신 버전인지 확인해주세요.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="card-panel p-6">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-bronze-light">
          Grad-CAM · 모델 주목 영역
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-bronze-light">
          Classification Head 기준으로 모델이 이미지의 어느 부분을 보고 손상 유형을
          판단했는지 히트맵으로 표시합니다.
          {primaryLabel && (
            <span className="mt-1 block font-medium text-bronze-dark">
              주요 판단 근거 유형: {primaryLabel}
            </span>
          )}
        </p>
        <div className="mt-4 overflow-hidden rounded-xl border border-bronze/10 bg-ivory-warm">
          <img
            src={gradcamSrc}
            alt="Grad-CAM heatmap"
            className="mx-auto max-h-[420px] w-full object-contain"
          />
        </div>
      </div>

      <div className="card-panel p-6">
        <h3 className="mb-4 text-sm font-medium text-bronze-dark">원본 vs Grad-CAM</h3>
        <CompareSlider
          beforeSrc={originalSrc}
          afterSrc={gradcamSrc}
          beforeLabel="원본"
          afterLabel="Grad-CAM"
        />
      </div>

      <div className="flex justify-end">
        <DownloadButton
          dataUrl={gradcamSrc}
          filename="artifix-gradcam.png"
          label="Grad-CAM 이미지 저장"
        />
      </div>
    </div>
  )
}
