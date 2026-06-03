import {
  DAMAGE_TYPE_LABELS,
  getPrimaryDamageType,
  getRegionDamageRatio,
} from '../utils/damageLabels.js'

export default function RegionInspector({
  bbox,
  regionIndex,
  labels,
  imageWidth = 256,
  imageHeight = 256,
}) {
  if (!bbox || regionIndex < 0) {
    return (
      <div className="card-panel flex h-full min-h-[280px] flex-col items-center justify-center p-6 text-center">
        <p className="text-sm text-bronze-light">
          오버레이 위 손상 영역(노란 박스)을 클릭하면
          <br />
          상세 정보가 표시됩니다.
        </p>
      </div>
    )
  }

  const regionRatio = getRegionDamageRatio(bbox, imageWidth, imageHeight)
  const primary = getPrimaryDamageType(labels)

  return (
    <div className="card-panel p-6">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-bronze-light">
        Damage Region Inspector
      </h3>
      <p className="text-lg font-semibold text-bronze-dark">
        Region #{regionIndex + 1}
      </p>

      <dl className="mt-6 space-y-4">
        <div>
          <dt className="text-xs text-bronze-light">Area</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums text-bronze-dark">
            {Math.round(bbox.area)} px
          </dd>
        </div>
        <div>
          <dt className="text-xs text-bronze-light">Damage Ratio (region)</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums text-bronze-dark">
            {regionRatio.toFixed(1)}%
          </dd>
        </div>
        <div>
          <dt className="text-xs text-bronze-light">Confidence (primary type)</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums text-bronze-dark">
            {primary ? `${Math.round(primary.confidence * 100)}%` : '—'}
          </dd>
          {primary && (
            <p className="mt-1 text-sm text-bronze-light">
              {DAMAGE_TYPE_LABELS[primary.type] || primary.type}
            </p>
          )}
        </div>
        <div className="rounded-lg border border-bronze/10 bg-ivory-warm px-3 py-2 text-xs text-bronze-light">
          <span className="font-medium text-bronze-dark">BBox</span>
          {' '}x:{bbox.x} y:{bbox.y} w:{bbox.w} h:{bbox.h}
        </div>
      </dl>
    </div>
  )
}
