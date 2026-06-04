const PLACEMENT = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
}

function InfoIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
        clipRule="evenodd"
      />
    </svg>
  )
}

export default function InfoTooltip({
  content,
  placement = 'top',
  className = '',
  iconClassName = '',
}) {
  if (!content) return null

  return (
    <span className={`group/info relative inline-flex shrink-0 align-middle ${className}`}>
      <button
        type="button"
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full border border-bronze/25 bg-ivory-warm text-bronze-light transition hover:border-bronze/40 hover:bg-bronze-muted hover:text-bronze-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze/40 ${iconClassName}`}
        aria-label="기능 설명 보기"
      >
        <InfoIcon />
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-[200] w-max max-w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-bronze/20 bg-pure px-3 py-2 text-left text-xs font-normal leading-relaxed text-bronze-dark shadow-soft ${PLACEMENT[placement] ?? PLACEMENT.top} invisible opacity-0 transition-opacity duration-150 group-hover/info:visible group-hover/info:opacity-100 group-focus-within/info:visible group-focus-within/info:opacity-100`}
      >
        {content}
      </span>
    </span>
  )
}

/** 라벨·제목 옆에 (i) 툴팁을 붙일 때 */
export function LabelWithHelp({ children, help, placement, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {children}
      <InfoTooltip content={help} placement={placement} />
    </span>
  )
}
