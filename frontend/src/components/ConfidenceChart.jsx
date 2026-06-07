import { useEffect, useState } from 'react'

const TYPE_CONFIG = {
  crack: {
    label: '균열 (Crack)',
    bar: 'bg-red-400',
    text: 'text-red-700',
  },
  surface_damage: {
    label: '표면 손상 (Surface Damage)',
    bar: 'bg-amber-400',
    text: 'text-amber-700',
  },
  discoloration: {
    label: '변색 (Discoloration)',
    bar: 'bg-violet-400',
    text: 'text-violet-700',
  },
}

function Bar({ label, barClass, textClass, percent }) {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const id1 = requestAnimationFrame(() => {
      const id2 = requestAnimationFrame(() => setWidth(percent))
      return () => cancelAnimationFrame(id2)
    })
    return () => cancelAnimationFrame(id1)
  }, [percent])

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-bronze-dark">{label}</span>
        <span className={`text-sm font-semibold tabular-nums ${textClass}`}>{percent}%</span>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-bronze-muted">
        <div
          className={`h-full rounded-full ${barClass} transition-[width] duration-700 ease-out`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}

export default function ConfidenceChart({ labels }) {
  if (!labels || !Object.keys(labels).length) return null

  return (
    <div className="space-y-4 pt-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-bronze-light">
        유형별 Confidence 차트
      </p>
      {Object.entries(labels).map(([type, confidence]) => {
        const cfg = TYPE_CONFIG[type] || { label: type, bar: 'bg-bronze', text: 'text-bronze-dark' }
        return (
          <Bar
            key={type}
            label={cfg.label}
            barClass={cfg.bar}
            textClass={cfg.text}
            percent={Math.round(confidence * 100)}
          />
        )
      })}
    </div>
  )
}
