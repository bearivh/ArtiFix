import { useEffect, useMemo, useState } from 'react'
import DamageTypeBadge from './DamageTypeBadge.jsx'
import SeverityBadge from './SeverityBadge.jsx'
import AnalysisControls from './AnalysisControls.jsx'
import InteractiveCanvas from './InteractiveCanvas.jsx'
import RegionInspector from './RegionInspector.jsx'
import CompareSlider from './CompareSlider.jsx'
import DownloadButton from './DownloadButton.jsx'
import ReportDownloadButton from './ReportDownloadButton.jsx'
import GradCamPanel from './GradCamPanel.jsx'
import {
  getPrimaryDamageType,
  DEFAULT_ENABLED_CLASSES,
  filterBboxesForDisplay,
} from '../utils/damageLabels.js'
import {
  blendOriginalOverlay,
  composeFromClassMasks,
  canvasToDataUrl,
} from '../utils/canvasUtils.js'

const TABS = [
  { id: 'workspace', label: '인터랙티브 분석' },
  { id: 'gradcam', label: 'Grad-CAM' },
  { id: 'compare', label: '전후 비교' },
  { id: 'gallery', label: '전체 보기' },
]

function ImagePanel({ title, src, alt }) {
  return (
    <div className="card-panel flex flex-col p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-bronze-light">
        {title}
      </h3>
      <div className="flex min-h-[200px] w-full items-center justify-center overflow-hidden rounded-xl border border-bronze/10 bg-ivory-warm">
        {src ? (
          <img
            src={src}
            alt={alt}
            className="max-h-[min(70vh,560px)] w-full object-contain"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-bronze-light/60">
            이미지 없음
          </div>
        )}
      </div>
    </div>
  )
}

export default function ResultViewer({
  result,
  imageFile,
  sensitivity,
  onSensitivityCommit,
  useAutoCrop = true,
  analyzing = false,
}) {
  const [activeTab, setActiveTab] = useState('workspace')
  const [overlayStrength, setOverlayStrength] = useState(0.4)
  const [enabledClasses, setEnabledClasses] = useState({ ...DEFAULT_ENABLED_CLASSES })
  const [useClassFilter, setUseClassFilter] = useState(false)
  const [selectedBboxIndex, setSelectedBboxIndex] = useState(-1)
  const [composedSrc, setComposedSrc] = useState('')

  const {
    originalSrc,
    overlaySrc,
    maskSrc,
    gradcamSrc,
    classMaskSrcs,
    labels,
    damageRatio,
    severity,
    bboxes,
    bboxCount,
    imageWidth,
    imageHeight,
  } = result

  const primary = useMemo(() => getPrimaryDamageType(labels), [labels])
  const displayBboxes = useMemo(
    () => filterBboxesForDisplay(bboxes, imageWidth, imageHeight),
    [bboxes, imageWidth, imageHeight],
  )
  const labelEntries = labels ? Object.entries(labels) : []
  const enabledList = Object.entries(enabledClasses)
    .filter(([, on]) => on)
    .map(([k]) => k)

  const handleToggleClass = (type) => {
    setEnabledClasses((prev) => ({ ...prev, [type]: !prev[type] }))
  }

  useEffect(() => {
    setSelectedBboxIndex(-1)
  }, [result, sensitivity])

  useEffect(() => {
    let cancelled = false
    async function buildComposed() {
      if (!originalSrc) return
      try {
        let canvas
        if (useClassFilter && classMaskSrcs && enabledList.length > 0) {
          canvas = await composeFromClassMasks({
            originalSrc,
            classMaskSrcs,
            enabledClasses: enabledList,
            overlayStrength,
          })
        } else if (overlaySrc) {
          canvas = await blendOriginalOverlay(originalSrc, overlaySrc, overlayStrength)
        } else {
          return
        }
        if (!cancelled) setComposedSrc(canvasToDataUrl(canvas))
      } catch {
        if (!cancelled) setComposedSrc(overlaySrc || '')
      }
    }
    buildComposed()
    return () => { cancelled = true }
  }, [originalSrc, overlaySrc, classMaskSrcs, useClassFilter, overlayStrength, enabledList.join(',')])

  const selectedBbox = selectedBboxIndex >= 0 ? displayBboxes[selectedBboxIndex] : null

  return (
    <div className="space-y-8">
      <div className="card-panel p-6">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-bronze-light">
          손상 분석 요약
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-bronze/10 bg-ivory-warm px-4 py-3">
            <p className="text-xs text-bronze-light">Damage Area</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-bronze-dark">
              {damageRatio != null ? `${damageRatio}%` : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-bronze/10 bg-ivory-warm px-4 py-3">
            <p className="text-xs text-bronze-light">Severity</p>
            <div className="mt-2">
              <SeverityBadge severity={severity} />
            </div>
          </div>
          <div className="rounded-xl border border-bronze/10 bg-ivory-warm px-4 py-3">
            <p className="text-xs text-bronze-light">Region Count</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-bronze-dark">
              {bboxCount}
              <span className="ml-1 text-sm font-normal text-bronze-light">개</span>
            </p>
          </div>
          <div className="rounded-xl border border-bronze/10 bg-ivory-warm px-4 py-3">
            <p className="text-xs text-bronze-light">Primary Damage Type</p>
            {primary ? (
              <>
                <p className="mt-1 text-base font-semibold text-bronze-dark">{primary.label}</p>
                <p className="text-xl font-semibold tabular-nums text-bronze">
                  {Math.round(primary.confidence * 100)}%
                </p>
              </>
            ) : (
              <p className="mt-1 text-bronze-light">—</p>
            )}
          </div>
        </div>
      </div>

      <div className="card-panel flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-bronze-dark">분석 보고서 (PDF)</h3>
          <p className="mt-1 text-xs text-bronze-light">
            손상 요약, 분석 이미지, 영역 상세가 포함된 공식 보고서를 다운로드합니다.
          </p>
        </div>
        <ReportDownloadButton
          imageFile={imageFile}
          useAutoCrop={useAutoCrop}
          disabled={analyzing}
        />
      </div>

      <AnalysisControls
        sensitivity={sensitivity}
        onSensitivityCommit={onSensitivityCommit}
        overlayStrength={overlayStrength}
        onOverlayStrengthChange={setOverlayStrength}
        enabledClasses={enabledClasses}
        onToggleClass={handleToggleClass}
        useClassFilter={useClassFilter}
        onUseClassFilterChange={setUseClassFilter}
        analyzing={analyzing}
      />

      <div className="flex flex-wrap gap-2 border-b border-bronze/10 pb-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === tab.id
                ? 'border border-bronze/30 bg-bronze-muted text-bronze-dark'
                : 'text-bronze-light hover:bg-bronze-subtle hover:text-bronze-dark'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'workspace' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="card-panel p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-bronze-light">
                손상 오버레이 · Region Inspector
              </h3>
              <InteractiveCanvas
                originalSrc={originalSrc}
                overlaySrc={overlaySrc}
                classMaskSrcs={classMaskSrcs}
                enabledClasses={enabledClasses}
                useClassFilter={useClassFilter}
                overlayStrength={overlayStrength}
                bboxes={displayBboxes}
                selectedBboxIndex={selectedBboxIndex}
                onSelectBbox={setSelectedBboxIndex}
              />
            </div>
          </div>
          <div>
            <RegionInspector
              bbox={selectedBbox}
              regionIndex={selectedBboxIndex}
              labels={labels}
              imageWidth={imageWidth}
              imageHeight={imageHeight}
            />
          </div>
        </div>
      )}

      {activeTab === 'gradcam' && (
        <GradCamPanel
          originalSrc={originalSrc}
          gradcamSrc={gradcamSrc}
          primaryLabel={primary?.label}
        />
      )}

      {activeTab === 'compare' && (
        <div className="card-panel p-6">
          <CompareSlider
            beforeSrc={originalSrc}
            afterSrc={composedSrc || overlaySrc}
            beforeLabel="원본"
            afterLabel="합성 오버레이"
          />
        </div>
      )}

      {activeTab === 'gallery' && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <ImagePanel title="원본 (Original)" src={originalSrc} alt="원본" />
          <ImagePanel title="마스크 (Mask)" src={maskSrc} alt="마스크" />
          <ImagePanel title="합성 오버레이" src={composedSrc || overlaySrc} alt="오버레이" />
          <ImagePanel
            title="Grad-CAM"
            src={gradcamSrc}
            alt="Grad-CAM"
          />
        </div>
      )}

      {labelEntries.length > 0 && (
        <div className="card-panel p-6">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-bronze-light">
            손상 유형 · Confidence
          </h3>
          <div className="flex flex-wrap gap-3">
            {labelEntries.map(([type, confidence]) => (
              <DamageTypeBadge key={type} type={type} confidence={confidence} />
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card-panel p-4">
          <DownloadButton dataUrl={originalSrc} filename="artifix-original.png" label="원본 저장" />
        </div>
        <div className="card-panel p-4">
          <DownloadButton dataUrl={maskSrc} filename="artifix-mask.png" label="마스크 저장" />
        </div>
        <div className="card-panel p-4">
          <DownloadButton
            dataUrl={composedSrc || overlaySrc}
            filename="artifix-overlay.png"
            label="오버레이 저장"
          />
        </div>
        <div className="card-panel p-4">
          <DownloadButton
            dataUrl={gradcamSrc}
            filename="artifix-gradcam.png"
            label="Grad-CAM 저장"
          />
        </div>
      </div>
    </div>
  )
}
