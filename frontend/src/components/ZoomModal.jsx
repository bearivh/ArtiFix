import { useEffect, useRef } from 'react'
import { loadImage } from '../utils/canvasUtils.js'

const ZOOM = 3
const PAD = 24

export default function ZoomModal({ open, onClose, originalSrc, bbox, regionIndex }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!open || !originalSrc || !bbox || !canvasRef.current) return
    let cancelled = false

    loadImage(originalSrc).then((img) => {
      if (cancelled || !canvasRef.current) return

      const srcX = Math.max(0, bbox.x - PAD)
      const srcY = Math.max(0, bbox.y - PAD)
      const srcW = Math.min(img.width - srcX, bbox.w + PAD * 2)
      const srcH = Math.min(img.height - srcY, bbox.h + PAD * 2)

      const dstW = Math.round(srcW * ZOOM)
      const dstH = Math.round(srcH * ZOOM)

      const canvas = canvasRef.current
      canvas.width = dstW
      canvas.height = dstH
      const ctx = canvas.getContext('2d')
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, dstW, dstH)

      const bx = (bbox.x - srcX) * ZOOM
      const by = (bbox.y - srcY) * ZOOM
      const bw = bbox.w * ZOOM
      const bh = bbox.h * ZOOM

      ctx.strokeStyle = '#A68B5B'
      ctx.lineWidth = 2.5
      ctx.setLineDash([6, 3])
      ctx.strokeRect(bx, by, bw, bh)
      ctx.setLineDash([])
    }).catch(() => {})

    return () => { cancelled = true }
  }, [open, originalSrc, bbox])

  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open || !bbox) return null

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-bronze/30 bg-pure shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-bronze/10 px-5 py-3">
          <h2 className="text-sm font-semibold text-bronze-dark">
            확대 보기 — Region #{regionIndex + 1}
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-bronze-light">{ZOOM}× 확대</span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-bronze/20 bg-ivory-warm px-3 py-1 text-xs font-medium text-bronze-light transition hover:text-bronze-dark"
            >
              닫기
            </button>
          </div>
        </header>

        <div className="overflow-auto p-4">
          <canvas
            ref={canvasRef}
            className="mx-auto block max-w-full rounded-xl border border-bronze/10"
          />
        </div>

        <footer className="border-t border-bronze/10 px-5 py-2.5 text-center">
          <p className="text-xs text-bronze-light/60">
            BBox &nbsp;x:{bbox.x} y:{bbox.y} w:{bbox.w} h:{bbox.h} &nbsp;·&nbsp; ESC로 닫기
          </p>
        </footer>
      </div>
    </div>
  )
}
