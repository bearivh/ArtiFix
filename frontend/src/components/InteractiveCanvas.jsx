import { useCallback, useEffect, useRef, useState } from 'react'
import {
  blendOriginalOverlay,
  drawBboxesOnCanvas,
  getBboxAtPoint,
  loadImage,
} from '../utils/canvasUtils.js'

export default function InteractiveCanvas({
  originalSrc,
  overlaySrc,
  overlayStrength,
  bboxes,
  selectedBboxIndex,
  onSelectBbox,
}) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 })
  const [imageSize, setImageSize] = useState({ w: 256, h: 256 })
  const [rendering, setRendering] = useState(false)

  const render = useCallback(async () => {
    if (!originalSrc || !canvasRef.current) return
    setRendering(true)
    try {
      let canvas
      if (overlaySrc) {
        canvas = await blendOriginalOverlay(originalSrc, overlaySrc, overlayStrength)
      } else {
        const img = await loadImage(originalSrc)
        canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        canvas.getContext('2d').drawImage(img, 0, 0)
      }

      setImageSize({ w: canvas.width, h: canvas.height })

      const displayCanvas = canvasRef.current
      const container = containerRef.current
      const maxW = container?.clientWidth || canvas.width
      const maxH = typeof window !== 'undefined'
        ? Math.min(window.innerHeight * 0.7, 560)
        : 560
      const scale = Math.min(1, maxW / canvas.width, maxH / canvas.height)
      const dw = Math.floor(canvas.width * scale)
      const dh = Math.floor(canvas.height * scale)
      setDisplaySize({ w: dw, h: dh })

      displayCanvas.width = dw
      displayCanvas.height = dh
      const ctx = displayCanvas.getContext('2d')
      ctx.clearRect(0, 0, dw, dh)
      ctx.drawImage(canvas, 0, 0, dw, dh)

      const scaleX = dw / canvas.width
      const scaleY = dh / canvas.height
      drawBboxesOnCanvas(ctx, bboxes, selectedBboxIndex, scaleX, scaleY)
    } catch (e) {
      console.error('Canvas render failed', e)
    } finally {
      setRendering(false)
    }
  }, [originalSrc, overlaySrc, overlayStrength, bboxes, selectedBboxIndex])

  useEffect(() => {
    render()
  }, [render])

  const handleClick = (e) => {
    if (!bboxes.length) return
    const rect = canvasRef.current.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const scaleX = displaySize.w / imageSize.w
    const scaleY = displaySize.h / imageSize.h
    const idx = getBboxAtPoint(bboxes, px, py, scaleX, scaleY)
    onSelectBbox(idx)
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        className="mx-auto max-w-full cursor-crosshair rounded-xl border border-bronze/15 bg-ivory-warm"
        style={{ width: displaySize.w || '100%', height: displaySize.h || 'auto' }}
      />
      {rendering && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-pure/40 text-xs text-bronze-light">
          렌더링 중...
        </div>
      )}
      <p className="mt-2 text-center text-xs text-bronze-light">
        노란 박스 클릭 → 영역 상세 정보
      </p>
    </div>
  )
}
