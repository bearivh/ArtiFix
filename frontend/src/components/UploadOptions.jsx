export default function UploadOptions({ useAutoCrop, onUseAutoCropChange, disabled = false }) {
  return (
    <div className="card-panel mb-4 p-5">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-bronze-light">
        분석 옵션
      </h3>
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
          <span className="text-sm font-medium text-bronze-dark">Auto Crop 사용</span>
          <p className="mt-0.5 text-xs text-bronze-light/70">
            체크 해제 시 업로드한 원본 이미지 전체를 모델에 입력합니다.
          </p>
        </div>
      </label>
    </div>
  )
}
