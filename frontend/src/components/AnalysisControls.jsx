import { useEffect, useState } from 'react'
import { HELP } from '../utils/featureHelp.js'
import { LabelWithHelp } from './InfoTooltip.jsx'

function SliderControl({ label, value, min, max, step, onChange, onCommit, formatValue, hint, help }) {
  const commit = (e) => {
    if (onCommit) onCommit(Number(e.target.value))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        {help ? (
          <LabelWithHelp help={help} className="text-sm font-medium text-bronze-dark">
            {label}
          </LabelWithHelp>
        ) : (
          <span className="text-sm font-medium text-bronze-dark">{label}</span>
        )}
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
  analyzing = false,
}) {
  const [draftSensitivity, setDraftSensitivity] = useState(sensitivity)

  useEffect(() => {
    setDraftSensitivity(sensitivity)
  }, [sensitivity])

  return (
    <div className="card-panel space-y-6 p-6">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-bronze-light">
        <LabelWithHelp help={HELP.analysisControls}>분석 조절</LabelWithHelp>
      </h3>

      <SliderControl
        label="Detection Sensitivity"
        help={HELP.sensitivity}
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
        help={HELP.overlayStrength}
        value={overlayStrength}
        min={0.1}
        max={1}
        step={0.1}
        onChange={onOverlayStrengthChange}
        formatValue={(v) => v.toFixed(1)}
      />
    </div>
  )
}
