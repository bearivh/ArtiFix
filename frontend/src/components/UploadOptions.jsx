import { LabelWithHelp } from './InfoTooltip.jsx'
import { HELP } from '../utils/featureHelp.js'
import { MODEL_VARIANTS, CROP_MODES } from '../api/api.js'

const SENS_MIN = 0.10
const SENS_MAX = 0.50
const toSlider = (threshold) => SENS_MIN + SENS_MAX - threshold
const toThreshold = (sliderValue) => SENS_MIN + SENS_MAX - sliderValue

export default function UploadOptions({
  useAutoCrop,
  onUseAutoCropChange,
  cropMode,
  onCropModeChange,
  modelVariant,
  onModelVariantChange,
  sensitivity,
  onSensitivityChange,
  disabled = false,
}) {
  const variants = Object.values(MODEL_VARIANTS)
  const cropModes = Object.values(CROP_MODES)

  return (
    <div className="card-panel mb-4 p-5">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-bronze-light">
        분석 옵션
      </h3>

      <div className="space-y-6">

        {/* ── 분석 모델 ── */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-bronze-dark">
            <LabelWithHelp help={HELP.modelVariant}>분석 모델</LabelWithHelp>
          </p>
          <fieldset disabled={disabled} className="grid grid-cols-2 gap-3">
            <legend className="sr-only">분석 모델 선택</legend>
            {variants.map((v) => (
              <label
                key={v.id}
                className={`flex cursor-pointer flex-col rounded-lg border px-4 py-3 transition ${
                  modelVariant === v.id
                    ? 'border-bronze/40 bg-bronze-muted'
                    : 'border-bronze/15 bg-ivory-warm hover:border-bronze/25'
                } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="model_variant"
                    value={v.id}
                    checked={modelVariant === v.id}
                    onChange={() => onModelVariantChange(v.id)}
                    className="accent-bronze"
                  />
                  <span className="text-sm font-medium text-bronze-dark">{v.label}</span>
                </span>
                <span className="mt-1 pl-6 text-xs text-bronze-light/80">{v.description}</span>
              </label>
            ))}
          </fieldset>
        </div>

        {/* ── Crop ── */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-bronze-dark">Crop</p>

          {/* Auto Crop 체크박스 */}
          <label
            className={`flex items-center gap-3 rounded-lg border border-bronze/15 bg-ivory-warm px-4 py-3 ${
              disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
            }`}
          >
            <input
              type="checkbox"
              checked={useAutoCrop}
              onChange={(e) => onUseAutoCropChange(e.target.checked)}
              disabled={disabled}
              className="rounded border-bronze/40 accent-bronze"
            />
            <div>
              <LabelWithHelp help={HELP.autoCrop} className="text-sm font-medium text-bronze-dark">
                Auto Crop 사용
              </LabelWithHelp>
              <p className="mt-0.5 text-xs text-bronze-light/70">
                체크 해제 시 업로드한 원본 이미지 전체를 분석합니다.
              </p>
            </div>
          </label>

          {/* 크롭 모드 — 항상 표시, Auto Crop 해제 시 잠금 */}
          <div
            className={`space-y-2 transition-opacity duration-200 ${
              !useAutoCrop ? 'pointer-events-none opacity-40' : ''
            }`}
          >
            <p className="text-xs text-bronze-light/80">
              <LabelWithHelp help={HELP.cropMode}>크롭 모드</LabelWithHelp>
            </p>
            <fieldset disabled={disabled || !useAutoCrop} className="grid grid-cols-2 gap-3">
              <legend className="sr-only">크롭 모드 선택</legend>
              {cropModes.map((mode) => (
                <label
                  key={mode.id}
                  className={`flex cursor-pointer flex-col rounded-lg border px-4 py-3 transition ${
                    cropMode === mode.id
                      ? 'border-bronze/40 bg-bronze-muted'
                      : 'border-bronze/15 bg-ivory-warm hover:border-bronze/25'
                  } ${disabled || !useAutoCrop ? 'cursor-not-allowed' : ''}`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="crop_mode"
                      value={mode.id}
                      checked={cropMode === mode.id}
                      onChange={() => onCropModeChange(mode.id)}
                      className="accent-bronze"
                    />
                    <span className="text-sm font-medium text-bronze-dark">{mode.label}</span>
                  </span>
                  <span className="mt-1 pl-6 text-xs text-bronze-light/80">{mode.description}</span>
                </label>
              ))}
            </fieldset>
          </div>
        </div>

        {/* ── Detection Threshold ── */}
        {sensitivity !== undefined && onSensitivityChange && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-bronze-dark">
                <LabelWithHelp help={HELP.sensitivity}>Detection Threshold</LabelWithHelp>
              </p>
              <span className="text-xs tabular-nums text-bronze-light">
                {toThreshold(toSlider(sensitivity)).toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={SENS_MIN}
              max={SENS_MAX}
              step={0.01}
              value={toSlider(sensitivity)}
              disabled={disabled}
              onChange={(e) => onSensitivityChange(toThreshold(Number(e.target.value)))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-bronze-muted accent-bronze disabled:cursor-not-allowed disabled:opacity-60"
            />
            <div className="flex justify-between text-xs text-bronze-light/70">
              <span>엄격 (오탐 적음)</span>
              <span>민감 (더 많이 감지)</span>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
