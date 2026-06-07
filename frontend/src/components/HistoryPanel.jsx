const SEVERITY_BORDER = {
  HIGH: 'border-red-300 hover:border-red-400',
  MEDIUM: 'border-orange-300 hover:border-orange-400',
  LOW: 'border-green-300 hover:border-green-400',
  NONE: 'border-bronze/20 hover:border-bronze/40',
}

const SEVERITY_PILL = {
  HIGH: 'bg-red-50 text-red-700',
  MEDIUM: 'bg-orange-50 text-orange-800',
  LOW: 'bg-green-50 text-green-800',
  NONE: 'bg-gray-100 text-gray-600',
}

function formatTime(timestamp) {
  const diff = Math.floor((Date.now() - timestamp) / 1000)
  if (diff < 60) return '방금 전'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  return `${Math.floor(diff / 3600)}시간 전`
}

function HistoryCard({ item, onRestore, onRemove }) {
  const borderClass = SEVERITY_BORDER[item.result.severity] || SEVERITY_BORDER.NONE
  const pillClass = SEVERITY_PILL[item.result.severity] || SEVERITY_PILL.NONE

  return (
    <div className={`group relative flex-shrink-0 w-36 rounded-xl border-2 bg-ivory-warm transition ${borderClass}`}>
      <button
        type="button"
        onClick={() => onRestore(item)}
        className="w-full p-2 text-left"
      >
        <div className="aspect-square overflow-hidden rounded-lg mb-2 bg-bronze/5">
          <img
            src={item.result.originalSrc}
            alt={item.filename}
            className="h-full w-full object-cover"
          />
        </div>
        <p className="text-xs font-medium text-bronze-dark truncate" title={item.filename}>
          {item.filename}
        </p>
        <p className="text-xs text-bronze-light/70 mt-0.5">{formatTime(item.timestamp)}</p>
        <div className="mt-1.5 flex items-center justify-between gap-1">
          <span className="text-xs tabular-nums text-bronze-light">
            {item.result.damageRatio != null ? `${item.result.damageRatio}%` : '—'}
          </span>
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${pillClass}`}>
            {item.result.severity}
          </span>
        </div>
      </button>
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        aria-label="삭제"
        className="absolute -top-2 -right-2 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-bronze-muted border border-bronze/20 text-bronze-light hover:bg-bronze hover:text-white transition text-xs"
      >
        ×
      </button>
    </div>
  )
}

export default function HistoryPanel({ history, onRestore, onRemove, onClearAll }) {
  if (!history.length) return null

  return (
    <section className="card-panel p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-bronze-light">
          분석 이력
          <span className="ml-2 rounded-full bg-bronze-muted px-2 py-0.5 text-bronze-dark">
            {history.length}
          </span>
        </h3>
        <button
          type="button"
          onClick={onClearAll}
          className="text-xs text-bronze-light hover:text-bronze-dark transition"
        >
          전체 삭제
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {history.map((item) => (
          <HistoryCard
            key={item.id}
            item={item}
            onRestore={onRestore}
            onRemove={onRemove}
          />
        ))}
      </div>
      <p className="mt-3 text-xs text-bronze-light/60">
        카드를 클릭하면 해당 분석 결과를 다시 불러옵니다. 새로 고침 시 초기화됩니다.
      </p>
    </section>
  )
}
