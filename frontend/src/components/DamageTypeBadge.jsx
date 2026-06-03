import { DETECTION_THRESHOLD, isDetected } from '../api/api.js'

const LABEL_CONFIG = {
  crack: {
    label: '균열 (Crack)',
    detected: 'border-bronze bg-bronze-muted text-bronze-dark',
    notDetected: 'border-bronze/20 bg-pure text-bronze-light/70',
  },
  surface_damage: {
    label: '표면 손상 (Surface)',
    detected: 'border-bronze bg-bronze-muted text-bronze-dark',
    notDetected: 'border-bronze/20 bg-pure text-bronze-light/70',
  },
  discoloration: {
    label: '변색 (Discoloration)',
    detected: 'border-bronze bg-bronze-muted text-bronze-dark',
    notDetected: 'border-bronze/20 bg-pure text-bronze-light/70',
  },
}

export default function DamageTypeBadge({ type, confidence }) {
  const config = LABEL_CONFIG[type] || {
    label: type,
    detected: 'border-bronze bg-bronze-muted text-bronze-dark',
    notDetected: 'border-bronze/20 bg-pure text-bronze-light/70',
  }

  const detected = isDetected(confidence)
  const colorClass = detected ? config.detected : config.notDetected
  const percent = Math.round(confidence * 100)

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium ${colorClass}`}
    >
      <span>{config.label}</span>
      <span className="rounded-md border border-bronze/20 bg-pure px-2 py-0.5 text-xs font-semibold tabular-nums text-bronze-dark">
        {percent}%
      </span>
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          detected
            ? 'bg-bronze text-pure'
            : 'bg-ivory-warm text-bronze-light'
        }`}
      >
        {detected ? '감지됨' : '미감지'}
      </span>
    </div>
  )
}

export { DETECTION_THRESHOLD }
