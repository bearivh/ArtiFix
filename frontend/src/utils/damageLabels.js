export const DAMAGE_TYPES = ['crack', 'surface_damage', 'discoloration']

export const DAMAGE_TYPE_LABELS = {
  crack: 'Crack',
  surface_damage: 'Surface Damage',
  discoloration: 'Discoloration',
}

/** 백엔드 inference.py 와 동일 */
export const MIN_BBOX_RATIO = 0.001
export const MIN_BBOX_AREA = 300

export function filterBboxesForDisplay(bboxes, imageWidth, imageHeight) {
  if (!bboxes?.length || !imageWidth || !imageHeight) return bboxes ?? []
  const minArea = Math.max(MIN_BBOX_AREA, MIN_BBOX_RATIO * imageWidth * imageHeight)
  return bboxes.filter((b) => (b.area ?? 0) >= minArea)
}

export function getPrimaryDamageType(labels) {
  if (!labels || typeof labels !== 'object') return null
  const entries = Object.entries(labels)
  if (!entries.length) return null
  const [type, confidence] = entries.reduce((best, cur) =>
    cur[1] > best[1] ? cur : best,
  )
  return {
    type,
    confidence,
    label: DAMAGE_TYPE_LABELS[type] || type,
  }
}

export function getRegionDamageRatio(bbox, imageWidth = 256, imageHeight = 256) {
  if (!bbox) return 0
  const total = imageWidth * imageHeight
  return total > 0 ? (bbox.area / total) * 100 : 0
}
