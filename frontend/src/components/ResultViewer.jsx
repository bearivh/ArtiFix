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
import ThreeDPreviewModal from './ThreeDPreviewModal.jsx'
import {
  getPrimaryDamageType,
  filterBboxesForDisplay,
} from '../utils/damageLabels.js'
import {
  blendOriginalOverlay,
  canvasToDataUrl,
} from '../utils/canvasUtils.js'
import InfoTooltip, { LabelWithHelp } from './InfoTooltip.jsx'
import { HELP } from '../utils/featureHelp.js'
import { getModelVariantLabel } from '../api/api.js'

const TABS = [
  { id: 'workspace', label: '인터랙티브 분석', help: HELP.tabWorkspace },
  { id: 'gradcam', label: 'Grad-CAM', help: HELP.tabGradcam },
  { id: 'compare', label: '전후 비교', help: HELP.tabCompare },
  { id: 'gallery', label: '전체 보기', help: HELP.tabGallery },
]

function ImagePanel({ title, src, alt, help }) {
  return (
    <div className="card-panel flex flex-col p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-bronze-light">
        {help ? <LabelWithHelp help={help}>{title}</LabelWithHelp> : title}
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
  modelVariant,
  analyzing = false,
}) {
  const [activeTab, setActiveTab] = useState('workspace')
  const [overlayStrength, setOverlayStrength] = useState(0.4)
  const [selectedBboxIndex, setSelectedBboxIndex] = useState(-1)
  const [composedSrc, setComposedSrc] = useState('')
  const [show3DPreview, setShow3DPreview] = useState(false)

  const {
    originalSrc,
    overlaySrc,
    maskSrc,
    gradcamSrc,
    labels,
    damageRatio,
    severity,
    bboxes,
    bboxCount,
    imageWidth,
    imageHeight,
    modelVariant: resultModelVariant,
  } = result

  const modelLabel = getModelVariantLabel(resultModelVariant ?? modelVariant)

  const primary = useMemo(() => getPrimaryDamageType(labels), [labels])
  const displayBboxes = useMemo(
    () => filterBboxesForDisplay(bboxes, imageWidth, imageHeight),
    [bboxes, imageWidth, imageHeight],
  )
  const labelEntries = labels ? Object.entries(labels) : []

  useEffect(() => {
    setSelectedBboxIndex(-1)
  }, [result, sensitivity])

  useEffect(() => {
    let cancelled = false
    async function buildComposed() {
      if (!originalSrc) return
      try {
        if (!overlaySrc) return
        const canvas = await blendOriginalOverlay(originalSrc, overlaySrc, overlayStrength)
        if (!cancelled) setComposedSrc(canvasToDataUrl(canvas))
      } catch {
        if (!cancelled) setComposedSrc(overlaySrc || '')
      }
    }
    buildComposed()
    return () => { cancelled = true }
  }, [originalSrc, overlaySrc, overlayStrength])

  const selectedBbox = selectedBboxIndex >= 0 ? displayBboxes[selectedBboxIndex] : null

  return (
    <div className="space-y-8">
      <div className="card-panel p-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-bronze-light">
            손상 분석 요약
          </h3>
          <p className="text-xs text-bronze-light">
            분석 모델: <span className="font-medium text-bronze-dark">{modelLabel}</span>
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-bronze/10 bg-ivory-warm px-4 py-3">
            <p className="text-xs text-bronze-light">
              <LabelWithHelp help={HELP.damageArea}>Damage Area</LabelWithHelp>
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-bronze-dark">
              {damageRatio != null ? `${damageRatio}%` : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-bronze/10 bg-ivory-warm px-4 py-3">
            <p className="text-xs text-bronze-light">
              <LabelWithHelp help={HELP.severity}>Severity</LabelWithHelp>
            </p>
            <div className="mt-2">
              <SeverityBadge severity={severity} />
            </div>
          </div>
          <div className="rounded-xl border border-bronze/10 bg-ivory-warm px-4 py-3">
            <p className="text-xs text-bronze-light">
              <LabelWithHelp help={HELP.regionCount}>Region Count</LabelWithHelp>
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-bronze-dark">
              {bboxCount}
              <span className="ml-1 text-sm font-normal text-bronze-light">개</span>
            </p>
          </div>
          <div className="rounded-xl border border-bronze/10 bg-ivory-warm px-4 py-3">
            <p className="text-xs text-bronze-light">
              <LabelWithHelp help={HELP.primaryDamage}>Primary Damage Type</LabelWithHelp>
            </p>
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
          <h3 className="text-sm font-semibold text-bronze-dark">
            <LabelWithHelp help={HELP.pdfReport}>분석 보고서 (PDF)</LabelWithHelp>
          </h3>
          <p className="mt-1 text-xs text-bronze-light">
            손상 요약, 분석 이미지, 영역 상세가 포함된 공식 보고서를 다운로드합니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ReportDownloadButton
            imageFile={imageFile}
            useAutoCrop={useAutoCrop}
            modelVariant={resultModelVariant ?? modelVariant}
            disabled={analyzing}
          />
          <button
            type="button"
            onClick={() => setShow3DPreview(true)}
            disabled={!originalSrc || analyzing}
            title="3D Damage Preview"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-forest-dark bg-navy-card px-5 py-2.5 text-sm font-medium text-pure transition hover:border-forest-glow hover:bg-forest-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 10h.01M15 10h.01M12 14v.01" />
            </svg>
            3D Preview
          </button>
        </div>
      </div>

      <ThreeDPreviewModal
        open={show3DPreview}
        onClose={() => setShow3DPreview(false)}
        originalSrc={originalSrc}
        overlaySrc={overlaySrc}
      />

      <AnalysisControls
        sensitivity={sensitivity}
        onSensitivityCommit={onSensitivityCommit}
        overlayStrength={overlayStrength}
        onOverlayStrengthChange={setOverlayStrength}
        analyzing={analyzing}
      />

      <div className="flex flex-wrap gap-2 border-b border-bronze/10 pb-4">
        {TABS.map((tab) => (
          <div key={tab.id} className="inline-flex items-center gap-0.5">
            <button
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
            <InfoTooltip content={tab.help} placement="bottom" />
          </div>
        ))}
      </div>

      {activeTab === 'workspace' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="card-panel p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-bronze-light">
                <LabelWithHelp help={HELP.interactiveCanvas}>
                  손상 오버레이 · Region Inspector
                </LabelWithHelp>
              </h3>
              <InteractiveCanvas
                originalSrc={originalSrc}
                overlaySrc={overlaySrc}
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
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-bronze-light">
            <LabelWithHelp help={HELP.compareSlider}>전후 비교 슬라이더</LabelWithHelp>
          </p>
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
          <ImagePanel title="원본 (Original)" src={originalSrc} alt="원본" help={HELP.galleryOriginal} />
          <ImagePanel title="마스크 (Mask)" src={maskSrc} alt="마스크" help={HELP.galleryMask} />
          <ImagePanel
            title="합성 오버레이"
            src={composedSrc || overlaySrc}
            alt="오버레이"
            help={HELP.galleryOverlay}
          />
          <ImagePanel
            title="Grad-CAM"
            src={gradcamSrc}
            alt="Grad-CAM"
            help={HELP.galleryGradcam}
          />
        </div>
      )}

      {labelEntries.length > 0 && (
        <div className="card-panel p-6">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-bronze-light">
            <LabelWithHelp help={HELP.confidenceLabels}>
              손상 유형 · Confidence
            </LabelWithHelp>
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
          <DownloadButton
            dataUrl={originalSrc}
            filename="artifix-original.png"
            label="원본 저장"
            help={HELP.downloadOriginal}
          />
        </div>
        <div className="card-panel p-4">
          <DownloadButton
            dataUrl={maskSrc}
            filename="artifix-mask.png"
            label="마스크 저장"
            help={HELP.downloadMask}
          />
        </div>
        <div className="card-panel p-4">
          <DownloadButton
            dataUrl={composedSrc || overlaySrc}
            filename="artifix-overlay.png"
            label="오버레이 저장"
            help={HELP.downloadOverlay}
          />
        </div>
        <div className="card-panel p-4">
          <DownloadButton
            dataUrl={gradcamSrc}
            filename="artifix-gradcam.png"
            label="Grad-CAM 저장"
            help={HELP.downloadGradcam}
          />
        </div>
      </div>
    </div>
  )
}
