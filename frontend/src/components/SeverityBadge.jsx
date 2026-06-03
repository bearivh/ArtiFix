const SEVERITY_CONFIG = {
  HIGH: {
    label: '심각 (HIGH)',
    className: 'border-red-400 bg-red-50 text-red-700',
  },
  MEDIUM: {
    label: '보통 (MEDIUM)',
    className: 'border-orange-400 bg-orange-50 text-orange-800',
  },
  LOW: {
    label: '경미 (LOW)',
    className: 'border-green-400 bg-green-50 text-green-800',
  },
  NONE: {
    label: '없음 (NONE)',
    className: 'border-gray-300 bg-gray-100 text-gray-600',
  },
}

export default function SeverityBadge({ severity }) {
  const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.NONE

  return (
    <span
      className={`inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-semibold tracking-wide ${config.className}`}
    >
      {config.label}
    </span>
  )
}
