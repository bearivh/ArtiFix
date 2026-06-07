import { loadImage } from './canvasUtils.js'

function jetColormap(t) {
  t = Math.max(0, Math.min(1, t))
  let r, g, b
  if (t < 0.125) {
    r = 0; g = 0; b = 0.5 + t * 4
  } else if (t < 0.375) {
    r = 0; g = (t - 0.125) * 4; b = 1
  } else if (t < 0.625) {
    r = (t - 0.375) * 4; g = 1; b = 1 - (t - 0.375) * 4
  } else if (t < 0.875) {
    r = 1; g = 1 - (t - 0.625) * 4; b = 0
  } else {
    r = 1 - (t - 0.875) * 4 * 0.5; g = 0; b = 0
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

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
 * mask_image → jet colormap(파랑→초록→빨강) 히트맵 텍스처
 * 외형(alpha)은 artifactOverlaySrc에서 가져와 유물 실루엣 유지
 */
export async function buildHeatmapTexture(artifactOverlaySrc, maskSrc) {
  const overlay = await loadImage(artifactOverlaySrc)
  const w = overlay.width
  const h = overlay.height

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')

  // overlay alpha → 유물 실루엣 보존용
  ctx.drawImage(overlay, 0, 0, w, h)
  const overlayPixels = ctx.getImageData(0, 0, w, h)

  if (maskSrc) {
    const mask = await loadImage(maskSrc)
    const maskCanvas = document.createElement('canvas')
    maskCanvas.width = w
    maskCanvas.height = h
    const maskCtx = maskCanvas.getContext('2d')
    maskCtx.drawImage(mask, 0, 0, w, h)
    const maskPixels = maskCtx.getImageData(0, 0, w, h)

    const result = new ImageData(w, h)
    for (let i = 0; i < maskPixels.data.length; i += 4) {
      const gray =
        (maskPixels.data[i] * 0.299 +
          maskPixels.data[i + 1] * 0.587 +
          maskPixels.data[i + 2] * 0.114) /
        255
      const [r, g, b] = jetColormap(Math.min(1, gray * 1.3))
      result.data[i] = r
      result.data[i + 1] = g
      result.data[i + 2] = b
      result.data[i + 3] = overlayPixels.data[i + 3]
    }
    ctx.clearRect(0, 0, w, h)
    ctx.putImageData(result, 0, 0)
  }

  const img = new Image()
  img.src = canvas.toDataURL('image/png')
  await new Promise((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('heatmap texture load failed'))
  })
  return img
}


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
