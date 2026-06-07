import { useEffect, useState } from 'react'
import { HELP } from '../utils/featureHelp.js'
import { LabelWithHelp } from './InfoTooltip.jsx'

// 슬라이더 표시 범위 (UI 값 — API threshold와 반전 관계)
const SENS_MIN = 0.10
const SENS_MAX = 0.50

// sliderValue ↔ threshold 변환
const toSlider = (threshold) => SENS_MIN + SENS_MAX - threshold
const toThreshold = (sliderValue) => SENS_MIN + SENS_MAX - sliderValue

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
  // draftSlider: UI 슬라이더 위치 (오른쪽 = 민감 = 낮은 threshold)
  const [draftSlider, setDraftSlider] = useState(() => toSlider(sensitivity))

  useEffect(() => {
    setDraftSlider(toSlider(sensitivity))
  }, [sensitivity])

  const handleCommit = (e) => {
    if (onSensitivityCommit) onSensitivityCommit(toThreshold(Number(e.target.value)))
  }

  return (
    <div className="card-panel space-y-6 p-6">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-bronze-light">
        <LabelWithHelp help={HELP.analysisControls}>분석 조절</LabelWithHelp>
      </h3>

      {/* Detection Threshold — 방향 반전: 오른쪽 = 민감(낮은 threshold) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <LabelWithHelp help={HELP.sensitivity} className="text-sm font-medium text-bronze-dark">
            Detection Threshold
          </LabelWithHelp>
          <span className="text-xs tabular-nums text-bronze-light">
            {toThreshold(draftSlider).toFixed(2)}
          </span>
        </div>
        <input
          type="range"
          min={SENS_MIN}
          max={SENS_MAX}
          step={0.01}
          value={draftSlider}
          onChange={(e) => setDraftSlider(Number(e.target.value))}
          onMouseUp={handleCommit}
          onTouchEnd={handleCommit}
          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-bronze-muted accent-bronze"
        />
        <div className="flex justify-between text-xs text-bronze-light/70">
          <span>엄격 (오탐 적음)</span>
          <span>민감 (더 많이 감지)</span>
        </div>
        <p className="text-xs text-bronze-light/70">슬라이더를 놓으면 재분석됩니다</p>
      </div>

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
