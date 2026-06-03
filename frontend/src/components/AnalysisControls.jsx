import { useEffect, useState } from 'react'
import { DAMAGE_TYPES, DAMAGE_TYPE_LABELS } from '../utils/damageLabels.js'

function SliderControl({ label, value, min, max, step, onChange, onCommit, formatValue, hint }) {
  const commit = (e) => {
    if (onCommit) onCommit(Number(e.target.value))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-bronze-dark">{label}</label>
        <span className="text-xs tabular-nums text-bronze-light">
          {formatValue ? formatValue(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onMouseUp={onCommit ? commit : undefined}
        onTouchEnd={onCommit ? commit : undefined}
        className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-bronze-muted accent-bronze"
      />
      {hint && <p className="text-xs text-bronze-light/70">{hint}</p>}
      <div className="flex justify-between text-xs text-bronze-light/70">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}

export default function AnalysisControls({
  sensitivity,
  onSensitivityCommit,
  overlayStrength,
  onOverlayStrengthChange,
  enabledClasses,
  onToggleClass,
  useClassFilter,
  onUseClassFilterChange,
  analyzing = false,
}) {
  const [draftSensitivity, setDraftSensitivity] = useState(sensitivity)

  useEffect(() => {
    setDraftSensitivity(sensitivity)
  }, [sensitivity])

  return (
    <div className="card-panel space-y-6 p-6">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-bronze-light">
        분석 조절
      </h3>

      <SliderControl
        label="Detection Sensitivity"
        value={draftSensitivity}
        min={0.05}
        max={0.3}
        step={0.01}
        onChange={setDraftSensitivity}
        onCommit={onSensitivityCommit}
        formatValue={(v) => v.toFixed(2)}
        hint="슬라이더를 놓으면 재분석됩니다"
      />
      {analyzing && (
        <p className="text-xs text-bronze-light">재분석 중...</p>
      )}

      <SliderControl
        label="Overlay Strength"
        value={overlayStrength}
        min={0.1}
        max={1}
        step={0.1}
        onChange={onOverlayStrengthChange}
        formatValue={(v) => v.toFixed(1)}
      />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-bronze-dark">손상 유형 필터</p>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-bronze-light">
            <input
              type="checkbox"
              checked={useClassFilter}
              onChange={(e) => onUseClassFilterChange(e.target.checked)}
              className="rounded border-bronze/40 text-bronze accent-bronze"
            />
            Class mask 모드
          </label>
        </div>
        <p className="text-xs text-bronze-light/70">
          체크된 유형만 오버레이에 표시 (API 재호출 없음)
        </p>
        <div className="flex flex-wrap gap-4">
          {DAMAGE_TYPES.map((type) => (
            <label
              key={type}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-bronze/15 bg-ivory-warm px-3 py-2 text-sm text-bronze-dark"
            >
              <input
                type="checkbox"
                checked={enabledClasses[type]}
                onChange={() => onToggleClass(type)}
                className="rounded border-bronze/40 accent-bronze"
              />
              {DAMAGE_TYPE_LABELS[type]}
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
