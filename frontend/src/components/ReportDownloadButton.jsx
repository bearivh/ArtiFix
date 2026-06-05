import { useState } from 'react'
import {
  downloadReport,
  triggerPdfDownload,
  USE_MOCK_API,
  ApiError,
} from '../api/api.js'

export default function ReportDownloadButton({
  imageFile,
  useAutoCrop = true,
  modelVariant,
  cropMode,
  disabled = false,
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleDownload = async () => {
    if (!imageFile || loading) return
    setError('')
    setLoading(true)
    try {
      const blob = await downloadReport(imageFile, useAutoCrop, modelVariant, cropMode)
      triggerPdfDownload(blob, 'artifix_report.pdf')
    } catch (err) {
      if (err instanceof ApiError) setError(err.message)
      else if (err instanceof Error) setError(err.message)
      else setError('보고서 생성 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const isDisabled = disabled || !imageFile || loading || USE_MOCK_API

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleDownload}
        disabled={isDisabled}
        className="btn-bronze-solid w-full sm:w-auto"
      >
        {loading ? (
          <>
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-pure/30 border-t-pure" />
            보고서 생성 중...
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            PDF 보고서 다운로드
          </>
        )}
      </button>
      {USE_MOCK_API && (
        <p className="mt-2 text-xs text-amber-700">
          Mock API 모드에서는 PDF 보고서를 사용할 수 없습니다.
        </p>
      )}
      {error && (
        <p className="mt-2 text-xs text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
