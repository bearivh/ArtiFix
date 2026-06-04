import { LabelWithHelp } from './InfoTooltip.jsx'
import { HELP } from '../utils/featureHelp.js'
import { MODEL_VARIANTS } from '../api/api.js'

export default function UploadOptions({
  useAutoCrop,
  onUseAutoCropChange,
  modelVariant,
  onModelVariantChange,
  disabled = false,
}) {
  const variants = Object.values(MODEL_VARIANTS)

  return (
    <div className="card-panel mb-4 space-y-4 p-5">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-bronze-light">
        분석 옵션
      </h3>

      <fieldset disabled={disabled} className="space-y-2">
        <legend className="mb-2 text-sm font-medium text-bronze-dark">
          <LabelWithHelp help={HELP.modelVariant}>분석 모델</LabelWithHelp>
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
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
        </div>
      </fieldset>

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
            체크 해제 시 업로드한 원본 이미지 전체를 모델에 입력합니다.
          </p>
        </div>
      </label>
    </div>
  )
}
