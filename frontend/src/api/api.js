const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const PREDICT_ENDPOINT = `${API_BASE_URL}/predict`
const REPORT_ENDPOINT = `${API_BASE_URL}/report`

export const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === 'true'
export const DETECTION_THRESHOLD = 0.5
export const DEFAULT_SEG_THRESHOLD = 0.10
export const DEFAULT_OVERLAY_STRENGTH = 0.4

const MOCK_LABELS = {
  crack: 0.91,
  surface_damage: 0.84,
  discoloration: 0.18,
}

const MOCK_BBOXES = [
  { x: 48, y: 72, w: 64, h: 40, area: 1280.5 },
  { x: 140, y: 110, w: 36, h: 28, area: 412.0 },
]

const MOCK_DELAY_MS = 1200
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/jpg']
const DAMAGE_CLASSES = ['crack', 'surface_damage', 'discoloration']

export class ApiError extends Error {
  constructor(message, code = 'UNKNOWN') {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

export function base64ToDataUrl(base64, mime = 'image/png') {
  if (!base64) return ''
  if (base64.startsWith('data:')) return base64
  return `data:${mime};base64,${base64}`
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = () => reject(new ApiError('파일을 읽을 수 없습니다.', 'INVALID_FILE'))
    reader.readAsDataURL(file)
  })
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function validateImageFile(file) {
  if (!file) throw new ApiError('파일이 선택되지 않았습니다.', 'INVALID_FILE')
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new ApiError('JPG 또는 PNG 이미지 파일만 업로드할 수 있습니다.', 'INVALID_FILE')
  }
}

function validateBbox(bbox, index) {
  for (const key of ['x', 'y', 'w', 'h', 'area']) {
    if (typeof bbox[key] !== 'number') {
      throw new ApiError(`bboxes[${index}].${key} 형식이 올바르지 않습니다.`, 'INVALID_RESPONSE')
    }
  }
}

function validatePredictResponse(data) {
  if (!data || typeof data !== 'object') {
    throw new ApiError('서버 응답 형식이 올바르지 않습니다.', 'INVALID_RESPONSE')
  }

  for (const field of ['original_image', 'mask_image', 'overlay_image']) {
    if (typeof data[field] !== 'string' || !data[field]) {
      throw new ApiError(`응답에 ${field} 필드가 없거나 형식이 올바르지 않습니다.`, 'INVALID_RESPONSE')
    }
  }

  if (!data.labels || typeof data.labels !== 'object' || Array.isArray(data.labels)) {
    throw new ApiError('labels 형식이 올바르지 않습니다.', 'INVALID_RESPONSE')
  }

  if (data.class_masks !== undefined) {
    if (typeof data.class_masks !== 'object' || Array.isArray(data.class_masks)) {
      throw new ApiError('class_masks 형식이 올바르지 않습니다.', 'INVALID_RESPONSE')
    }
  }

  if (data.damage_ratio !== undefined && typeof data.damage_ratio !== 'number') {
    throw new ApiError('damage_ratio 형식이 올바르지 않습니다.', 'INVALID_RESPONSE')
  }

  if (data.severity !== undefined && typeof data.severity !== 'string') {
    throw new ApiError('severity 형식이 올바르지 않습니다.', 'INVALID_RESPONSE')
  }

  if (data.bboxes !== undefined) {
    if (!Array.isArray(data.bboxes)) {
      throw new ApiError('bboxes 형식이 올바르지 않습니다.', 'INVALID_RESPONSE')
    }
    data.bboxes.forEach(validateBbox)
  }

  if (data.gradcam_image !== undefined && typeof data.gradcam_image !== 'string') {
    throw new ApiError('gradcam_image 형식이 올바르지 않습니다.', 'INVALID_RESPONSE')
  }

  return data
}

function buildMockClassMasks(base64) {
  const masks = {}
  for (const cls of DAMAGE_CLASSES) {
    masks[cls] = MOCK_LABELS[cls] >= DETECTION_THRESHOLD ? base64 : ''
  }
  return masks
}

export async function predictMock(
  imageFile,
  segThreshold = DEFAULT_SEG_THRESHOLD,
  useAutoCrop = true,
) {
  validateImageFile(imageFile)
  await delay(MOCK_DELAY_MS)
  const base64 = await fileToBase64(imageFile)
  const class_masks = buildMockClassMasks(base64)

  return {
    original_image: base64,
    mask_image: base64,
    overlay_image: base64,
    gradcam_image: base64,
    labels: { ...MOCK_LABELS },
    class_masks,
    damage_ratio: 12.35,
    severity: 'MEDIUM',
    bboxes: MOCK_BBOXES,
    bbox_count: MOCK_BBOXES.length,
    seg_threshold: segThreshold,
  }
}

export async function predictReal(
  imageFile,
  segThreshold = DEFAULT_SEG_THRESHOLD,
  useAutoCrop = true,
) {
  validateImageFile(imageFile)

  const formData = new FormData()
  formData.append('image', imageFile)
  formData.append('seg_threshold', String(segThreshold))
  formData.append('use_auto_crop', useAutoCrop ? 'true' : 'false')

  let response
  try {
    response = await fetch(PREDICT_ENDPOINT, { method: 'POST', body: formData })
  } catch {
    throw new ApiError(
      '서버에 연결할 수 없습니다. 백엔드가 localhost:8000에서 실행 중인지 확인해주세요.',
      'NETWORK_ERROR',
    )
  }

  let data
  try {
    data = await response.json()
  } catch {
    throw new ApiError('서버 응답을 해석할 수 없습니다.', 'INVALID_RESPONSE')
  }

  if (!response.ok) {
    const detail = data?.detail
    const message = typeof detail === 'string'
      ? detail
      : Array.isArray(detail)
        ? detail.map((d) => d.msg || JSON.stringify(d)).join(', ')
        : `API 오류 (${response.status})`
    throw new ApiError(message, 'API_ERROR')
  }

  return validatePredictResponse(data)
}

export async function predict(
  imageFile,
  segThreshold = DEFAULT_SEG_THRESHOLD,
  useAutoCrop = true,
) {
  if (USE_MOCK_API) return predictMock(imageFile, segThreshold, useAutoCrop)
  return predictReal(imageFile, segThreshold, useAutoCrop)
}

export function parsePredictResult(data) {
  const validated = validatePredictResponse(data)

  const classMaskSrcs = {}
  if (validated.class_masks) {
    for (const [key, b64] of Object.entries(validated.class_masks)) {
      classMaskSrcs[key] = b64 ? base64ToDataUrl(b64) : ''
    }
  }

  return {
    originalSrc: base64ToDataUrl(validated.original_image),
    maskSrc: base64ToDataUrl(validated.mask_image),
    overlaySrc: base64ToDataUrl(validated.overlay_image),
    gradcamSrc: validated.gradcam_image
      ? base64ToDataUrl(validated.gradcam_image)
      : '',
    labels: validated.labels,
    classMaskSrcs,
    damageRatio: validated.damage_ratio ?? null,
    severity: validated.severity ?? 'NONE',
    bboxes: validated.bboxes ?? [],
    bboxCount: validated.bbox_count ?? (validated.bboxes?.length ?? 0),
    imageWidth: validated.image_width ?? 256,
    imageHeight: validated.image_height ?? 256,
  }
}

export function isDetected(confidence) {
  return confidence >= DETECTION_THRESHOLD
}

/**
 * PDF 분석 보고서 다운로드 (POST /report)
 */
export async function downloadReport(imageFile, useAutoCrop = true) {
  validateImageFile(imageFile)

  if (USE_MOCK_API) {
    throw new ApiError(
      'PDF 보고서는 Live API 모드에서만 생성할 수 있습니다. (VITE_USE_MOCK_API=false)',
      'MOCK_MODE',
    )
  }

  const formData = new FormData()
  formData.append('image', imageFile)
  formData.append('use_auto_crop', useAutoCrop ? 'true' : 'false')

  let response
  try {
    response = await fetch(REPORT_ENDPOINT, { method: 'POST', body: formData })
  } catch {
    throw new ApiError(
      '서버에 연결할 수 없습니다. 백엔드가 localhost:8000에서 실행 중인지 확인해주세요.',
      'NETWORK_ERROR',
    )
  }

  if (!response.ok) {
    let message = `보고서 생성 실패 (${response.status})`
    try {
      const errJson = await response.json()
      const detail = errJson?.detail
      if (typeof detail === 'string') message = detail
      else if (Array.isArray(detail)) {
        message = detail.map((d) => d.msg || JSON.stringify(d)).join(', ')
      }
    } catch {
      try {
        const text = await response.text()
        if (text) message = text
      } catch {
        /* ignore */
      }
    }
    throw new ApiError(message, 'API_ERROR')
  }

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('pdf') && !contentType.includes('octet-stream')) {
    throw new ApiError('서버가 PDF가 아닌 응답을 반환했습니다.', 'INVALID_RESPONSE')
  }

  return response.blob()
}

export function triggerPdfDownload(blob, filename = 'artifix_report.pdf') {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
