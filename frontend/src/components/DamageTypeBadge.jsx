const LABEL_CONFIG = {
  crack: {
    label: '균열 (Crack)',
  },
  surface_damage: {
    label: '표면 손상 (Surface)',
  },
  discoloration: {
    label: '변색 (Discoloration)',
  },
}

export default function DamageTypeBadge({ type, confidence }) {
  const config = LABEL_CONFIG[type] || { label: type }
  const percent = Math.round(confidence * 100)

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-bronze/20 bg-pure px-4 py-2 text-sm font-medium text-bronze-dark">
      <span>{config.label}</span>
      <span className="rounded-md border border-bronze/20 bg-ivory-warm px-2 py-0.5 text-xs font-semibold tabular-nums text-bronze-dark">
        {percent}%
      </span>
    </div>
  )
}
