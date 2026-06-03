const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const PREDICT_ENDPOINT = `${API_BASE_URL}/predict`

/** true면 mock API, false면 FastAPI 호출 */
export const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === 'true'

/** 이 값 이상이면 해당 클래스 감지로 표시 */
export const DETECTION_THRESHOLD = 0.5

const MOCK_LABELS = {
  crack: 0.91,
  surface_damage: 0.84,
  discoloration: 0.18,
}

const MOCK_DELAY_MS = 1200

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/jpg']

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
    reader.onload = () => {
      const dataUrl = reader.result
      resolve(dataUrl.split(',')[1])
    }
    reader.onerror = () => reject(new ApiError('파일을 읽을 수 없습니다.', 'INVALID_FILE'))
    reader.readAsDataURL(file)
  })
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function validateImageFile(file) {
  if (!file) {
    throw new ApiError('파일이 선택되지 않았습니다.', 'INVALID_FILE')
  }
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new ApiError('JPG 또는 PNG 이미지 파일만 업로드할 수 있습니다.', 'INVALID_FILE')
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

  return data
}

/**
 * Mock 예측
 */
export async function predictMock(imageFile) {
  validateImageFile(imageFile)
  await delay(MOCK_DELAY_MS)
  const base64 = await fileToBase64(imageFile)
  return {
    original_image: base64,
    mask_image: base64,
    overlay_image: base64,
    labels: { ...MOCK_LABELS },
  }
}

/**
 * FastAPI POST /predict
 */
export async function predictReal(imageFile) {
  validateImageFile(imageFile)

  const formData = new FormData()
  formData.append('image', imageFile)

  let response
  try {
    response = await fetch(PREDICT_ENDPOINT, {
      method: 'POST',
      body: formData,
    })
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

/**
 * USE_MOCK_API에 따라 mock 또는 real 호출
 */
export async function predict(imageFile) {
  if (USE_MOCK_API) {
    return predictMock(imageFile)
  }
  return predictReal(imageFile)
}

/**
 * API 응답 → 화면 표시용 data URL 객체
 */
export function parsePredictResult(data) {
  const validated = validatePredictResponse(data)
  return {
    originalSrc: base64ToDataUrl(validated.original_image),
    maskSrc: base64ToDataUrl(validated.mask_image),
    overlaySrc: base64ToDataUrl(validated.overlay_image),
    labels: validated.labels,
  }
}

export function isDetected(confidence) {
  return confidence >= DETECTION_THRESHOLD
}
