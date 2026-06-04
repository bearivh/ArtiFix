import { blendOriginalOverlay, loadImage } from './canvasUtils.js'

/**
 * 원본 + 오버레이를 canvas에서 합성한 뒤 HTMLImageElement로 반환 (Three.js Texture용)
 */
export async function buildCompositedImage(originalSrc, overlaySrc, overlayOpacity = 0.4) {
  let canvas
  if (overlaySrc) {
    canvas = await blendOriginalOverlay(originalSrc, overlaySrc, overlayOpacity)
  } else {
    const original = await loadImage(originalSrc)
    canvas = document.createElement('canvas')
    canvas.width = original.width
    canvas.height = original.height
    canvas.getContext('2d').drawImage(original, 0, 0)
  }

  const dataUrl = canvas.toDataURL('image/png')
  const img = new Image()
  img.src = dataUrl

  await new Promise((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('3D texture image load failed'))
  })

  return img
}
