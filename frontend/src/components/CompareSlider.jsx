import { useState } from 'react'

export default function CompareSlider({ beforeSrc, afterSrc, beforeLabel = '원본', afterLabel = '오버레이' }) {
  const [position, setPosition] = useState(50)

  if (!beforeSrc || !afterSrc) return null

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between text-sm text-bronze-light">
        <span>{beforeLabel}</span>
        <span className="font-medium text-bronze">드래그하여 비교</span>
        <span>{afterLabel}</span>
      </div>

      <div className="relative flex min-h-[240px] w-full items-center justify-center overflow-hidden rounded-xl border border-bronze/15 bg-ivory-warm shadow-soft">
        <img
          src={afterSrc}
          alt={afterLabel}
          className="relative mx-auto block max-h-[min(70vh,560px)] w-full object-contain"
          draggable={false}
        />
        <img
          src={beforeSrc}
          alt={beforeLabel}
          className="absolute left-0 top-0 mx-auto max-h-[min(70vh,560px)] w-full object-contain"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
          draggable={false}
        />

        <div
          className="pointer-events-none absolute inset-y-0 z-10 w-px bg-bronze-glow shadow-bronze-glow"
          style={{ left: `${position}%` }}
        >
          <div className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-bronze-glow bg-pure text-bronze shadow-bronze-glow">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l-4 4 4 4M16 15l4-4-4-4" />
            </svg>
          </div>
        </div>

        <input
          type="range"
          min="0"
          max="100"
          value={position}
          onChange={(e) => setPosition(Number(e.target.value))}
          className="compare-slider-input"
          aria-label="전후 비교 슬라이더"
        />
      </div>
    </div>
  )
}
