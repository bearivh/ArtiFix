export function loadImage(src) {
  return new Promise((resolve, reject) => {
    if (!src) {
      reject(new Error('Empty image source'))
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = src
  })
}

/**
 * original + API overlay_image opacity 합성
 */
export async function blendOriginalOverlay(originalSrc, overlaySrc, strength = 0.4) {
  const [original, overlay] = await Promise.all([
    loadImage(originalSrc),
    loadImage(overlaySrc),
  ])

  const w = original.width
  const h = original.height
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')

  ctx.drawImage(original, 0, 0, w, h)
  ctx.globalAlpha = Math.max(0, Math.min(1, strength))
  ctx.drawImage(overlay, 0, 0, w, h)
  ctx.globalAlpha = 1

  return canvas
}

export function drawBboxesOnCanvas(ctx, bboxes, selectedIndex = -1, scaleX = 1, scaleY = 1) {
  bboxes.forEach((bbox, index) => {
    const x = bbox.x * scaleX
    const y = bbox.y * scaleY
    const w = bbox.w * scaleX
    const h = bbox.h * scaleY
    const isSelected = index === selectedIndex

    ctx.strokeStyle = isSelected ? '#A68B5B' : '#FFD700'
    ctx.lineWidth = isSelected ? 2.5 : 1.5
    ctx.strokeRect(x, y, w, h)

    if (isSelected) {
      ctx.fillStyle = 'rgba(166, 139, 91, 0.15)'
      ctx.fillRect(x, y, w, h)
    }
  })
}

export function getBboxAtPoint(bboxes, px, py, scaleX, scaleY) {
  for (let i = bboxes.length - 1; i >= 0; i--) {
    const b = bboxes[i]
    const x = b.x * scaleX
    const y = b.y * scaleY
    const w = b.w * scaleX
    const h = b.h * scaleY
    if (px >= x && px <= x + w && py >= y && py <= y + h) {
      return i
    }
  }
  return -1
}

export function canvasToDataUrl(canvas) {
  return canvas.toDataURL('image/png')
}
