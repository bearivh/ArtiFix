import { useState } from 'react'
import DamageTypeBadge from './DamageTypeBadge.jsx'
import CompareSlider from './CompareSlider.jsx'
import DownloadButton from './DownloadButton.jsx'
import { DETECTION_THRESHOLD } from '../api/api.js'

function ImagePanel({ title, src, alt }) {
  return (
    <div className="card-panel flex flex-col p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-bronze-light">
        {title}
      </h3>
      <div className="aspect-video overflow-hidden rounded-xl border border-bronze/10 bg-ivory-warm">
        {src ? (
          <img src={src} alt={alt} className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-bronze-light/60">
            이미지 없음
          </div>
        )}
      </div>
    </div>
  )
}

const TABS = [
  { id: 'all', label: '전체 보기' },
  { id: 'compare', label: '전후 비교' },
]

export default function ResultViewer({
  originalSrc,
  overlaySrc,
  maskSrc,
  labels,
}) {
  const [activeTab, setActiveTab] = useState('all')
  const labelEntries = labels ? Object.entries(labels) : []

  return (
    <div className="space-y-8">
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

      {activeTab === 'all' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <ImagePanel title="원본 (Original)" src={originalSrc} alt="원본" />
          <ImagePanel title="마스크 (Mask)" src={maskSrc} alt="마스크" />
          <ImagePanel title="오버레이 (Overlay)" src={overlaySrc} alt="오버레이" />
        </div>
      )}

      {activeTab === 'compare' && (
        <div className="card-panel p-6">
          <h3 className="mb-4 text-sm font-medium text-bronze-dark">전후 비교</h3>
          <CompareSlider
            beforeSrc={originalSrc}
            afterSrc={overlaySrc}
            beforeLabel="원본"
            afterLabel="오버레이"
          />
        </div>
      )}

      {labelEntries.length > 0 && (
        <div className="card-panel p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-bronze-light">
              손상 유형 · Confidence
            </h3>
            <p className="text-xs text-bronze-light">
              감지 기준: {Math.round(DETECTION_THRESHOLD * 100)}% 이상
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {labelEntries.map(([type, confidence]) => (
              <DamageTypeBadge key={type} type={type} confidence={confidence} />
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card-panel p-4">
          <p className="mb-2 text-xs font-medium text-bronze-light">원본 다운로드</p>
          <DownloadButton
            dataUrl={originalSrc}
            filename="artifix-original.png"
            label="원본 저장"
          />
        </div>
        <div className="card-panel p-4">
          <p className="mb-2 text-xs font-medium text-bronze-light">마스크 다운로드</p>
          <DownloadButton
            dataUrl={maskSrc}
            filename="artifix-mask.png"
            label="마스크 저장"
          />
        </div>
        <div className="card-panel p-4">
          <p className="mb-2 text-xs font-medium text-bronze-light">오버레이 다운로드</p>
          <DownloadButton
            dataUrl={overlaySrc}
            filename="artifix-overlay.png"
            label="오버레이 저장"
          />
        </div>
      </div>
    </div>
  )
}
