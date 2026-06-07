import { useEffect, useState } from 'react'
import ArtifactViewer3D from './ArtifactViewer3D.jsx'
import { DEFAULT_OVERLAY_STRENGTH } from '../api/api.js'

const SHAPE_TABS = [
  { id: 'sphere', label: 'Sphere', hint: '도자기, 항아리' },
  { id: 'cylinder', label: 'Cylinder', hint: '컵, 잔' },
  { id: 'plane', label: '평면', hint: '얇은 판 · 손상 미세 굴곡' },
]

const VIEW_MODE_TABS = [
  { id: 'photo', label: '사진 모드', hint: 'Overlay 텍스처' },
  { id: 'heatmap', label: '히트맵 모드', hint: '손상 분포 시각화' },
]

export default function ThreeDPreviewModal({
  open,
  onClose,
  artifactSrc,
  artifactOverlaySrc,
  maskSrc,
}) {
  const [shapeType, setShapeType] = useState('sphere')
  const [overlayOpacity, setOverlayOpacity] = useState(DEFAULT_OVERLAY_STRENGTH)
  const [viewMode, setViewMode] = useState('photo')

  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  const canPreview = Boolean(artifactOverlaySrc)
  const isHeatmap = viewMode === 'heatmap'

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="3d-damage-preview-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-forest-dark/60 bg-navy-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-navy-border px-5 py-4 sm:px-6">
          <div>
            <h2
              id="3d-damage-preview-title"
              className="text-lg font-semibold tracking-wide text-pure"
            >
              3D Damage Preview
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-forest-glow/90">
              배경 제거된 유물 텍스처(손상 오버레이 포함)를 3D 형태에 투영한 시각화입니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-navy-border bg-navy-dark px-3 py-1.5 text-sm font-medium text-pure transition hover:border-forest-light hover:bg-navy"
          >
            닫기
          </button>
        </header>

        {/* 보기 모드 토글 */}
        <div className="border-b border-navy-border px-5 py-3 sm:px-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-forest-glow/80">
            보기 모드
          </p>
          <div className="flex flex-wrap gap-2">
            {VIEW_MODE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setViewMode(tab.id)}
                className={`rounded-lg border px-4 py-2 text-left transition ${
                  viewMode === tab.id
                    ? 'border-forest-glow bg-forest-dark text-pure'
                    : 'border-navy-border bg-navy-dark text-pure/80 hover:border-forest-light'
                }`}
              >
                <span className="block text-sm font-medium">{tab.label}</span>
                <span className="block text-xs opacity-75">{tab.hint}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 유물 형태 선택 */}
        <div className="border-b border-navy-border px-5 py-3 sm:px-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-forest-glow/80">
            유물 형태
          </p>
          <div className="flex flex-wrap gap-2">
            {SHAPE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setShapeType(tab.id)}
                className={`rounded-lg border px-4 py-2 text-left transition ${
                  shapeType === tab.id
                    ? 'border-forest-glow bg-forest-dark text-pure'
                    : 'border-navy-border bg-navy-dark text-pure/80 hover:border-forest-light'
                }`}
              >
                <span className="block text-sm font-medium">{tab.label}</span>
                <span className="block text-xs opacity-75">{tab.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-[340px] flex-1 px-5 py-4 sm:px-6">
          {canPreview ? (
            <ArtifactViewer3D
              artifactSrc={artifactSrc}
              artifactOverlaySrc={artifactOverlaySrc}
              maskSrc={maskSrc}
              shapeType={shapeType}
              overlayStrength={overlayOpacity}
              viewMode={viewMode}
              active={open}
            />
          ) : (
            <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-navy-border bg-navy-dark text-sm text-pure/60">
              artifact_overlay_image가 없습니다. 분석을 다시 실행해주세요.
            </div>
          )}
        </div>

        <footer className="space-y-2 border-t border-navy-border px-5 py-4 sm:px-6">
          <div className="flex items-center justify-between text-sm">
            <span className={isHeatmap ? 'text-pure/40' : 'text-pure/90'}>Overlay Strength</span>
            <span className={`tabular-nums ${isHeatmap ? 'text-forest-glow/40' : 'text-forest-glow'}`}>
              {isHeatmap ? '—' : overlayOpacity.toFixed(1)}
            </span>
          </div>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.1}
            value={overlayOpacity}
            disabled={isHeatmap}
            onChange={(e) => setOverlayOpacity(Number(e.target.value))}
            className={`h-2 w-full appearance-none rounded-lg bg-navy-border accent-forest-glow transition ${
              isHeatmap ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'
            }`}
          />
          <div className="flex justify-between text-xs text-pure/50">
            <span>0.1</span>
            <span>1.0</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
