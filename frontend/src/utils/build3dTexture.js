import { loadImage } from './canvasUtils.js'

/**
 * artifact_image + artifact_overlay_image(투명 PNG) → Overlay Strength 반영 HTMLImageElement
 */
export async function build3dTextureFromArtifacts(
  artifactSrc,
  artifactOverlaySrc,
  overlayStrength = 0.4,
) {
  if (!artifactOverlaySrc) {
    throw new Error('artifact_overlay_image is required for 3D preview')
  }

  const base = artifactSrc ? await loadImage(artifactSrc) : null
  const overlay = await loadImage(artifactOverlaySrc)

  const w = overlay.width
  const h = overlay.height
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')

  if (base) {
    ctx.drawImage(base, 0, 0, w, h)
  }
  ctx.globalAlpha = Math.max(0, Math.min(1, overlayStrength))
  ctx.drawImage(overlay, 0, 0, w, h)
  ctx.globalAlpha = 1

  const dataUrl = canvas.toDataURL('image/png')
  const img = new Image()
  img.src = dataUrl

  await new Promise((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('3D texture image load failed'))
  })

  return img
}

/**
 * segmentation mask → displacement용 그레이스케일(약한 블러로 부드럽게)
 */
export async function buildDisplacementImageFromMask(maskSrc, width, height) {
  const mask = await loadImage(maskSrc)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.filter = 'blur(3px)'
  ctx.drawImage(mask, 0, 0, width, height)
  ctx.filter = 'none'

  const img = new Image()
  img.src = canvas.toDataURL('image/png')
  await new Promise((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('displacement mask load failed'))
  })
  return img
}
