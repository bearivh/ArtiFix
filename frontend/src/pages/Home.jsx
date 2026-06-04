import { useCallback, useEffect, useRef, useState } from 'react'
import ImageUploader from '../components/ImageUploader.jsx'
import UploadOptions from '../components/UploadOptions.jsx'
import ResultViewer from '../components/ResultViewer.jsx'
import Header from '../components/Header.jsx'
import Footer from '../components/Footer.jsx'
import {
  predict,
  parsePredictResult,
  USE_MOCK_API,
  ApiError,
  DEFAULT_SEG_THRESHOLD,
  DEFAULT_MODEL_VARIANT,
} from '../api/api.js'
import InfoTooltip from '../components/InfoTooltip.jsx'
import { HELP } from '../utils/featureHelp.js'

function LoadingSpinner({ message = '손상 영역을 분석하는 중...' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <div className="relative h-14 w-14">
        <div className="absolute inset-0 rounded-full border-2 border-bronze-muted" />
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-bronze" />
        <svg className="absolute inset-0 m-auto h-5 w-5 text-bronze-glow" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7-6.3-4.6L6 21l2.3-7-6-4.6h7.6z" />
        </svg>
      </div>
      <p className="text-sm font-medium tracking-wide text-bronze-light">{message}</p>
    </div>
  )
}

export default function Home() {
  const [previewUrl, setPreviewUrl] = useState(null)
  const [uploadedFile, setUploadedFile] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sensitivity, setSensitivity] = useState(DEFAULT_SEG_THRESHOLD)
  const [useAutoCrop, setUseAutoCrop] = useState(true)
  const [modelVariant, setModelVariant] = useState(DEFAULT_MODEL_VARIANT)

  const skipSensitivityEffect = useRef(true)
  const hasResult = useRef(false)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const runAnalysis = useCallback(async (file, segThreshold, autoCrop, variant) => {
    if (!file) return
    setLoading(true)
    setError('')
    try {
      const data = await predict(file, segThreshold, autoCrop, variant)
      setResult(parsePredictResult(data))
      hasResult.current = true
    } catch (err) {
      if (err instanceof ApiError) setError(err.message)
      else if (err instanceof Error) setError(err.message)
      else setError('분석 중 알 수 없는 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleUpload = async (file) => {
    setResult(null)
    hasResult.current = false
    skipSensitivityEffect.current = true

    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(file))
    setUploadedFile(file)

    await runAnalysis(file, sensitivity, useAutoCrop, modelVariant)

    skipSensitivityEffect.current = false
  }

  const handleSensitivityCommit = useCallback(
    (value) => {
      if (!uploadedFile || !hasResult.current || skipSensitivityEffect.current) {
        setSensitivity(value)
        return
      }
      if (Math.abs(value - sensitivity) < 0.0001) return

      setSensitivity(value)
      setResult(null)
      runAnalysis(uploadedFile, value, useAutoCrop, modelVariant)
    },
    [uploadedFile, sensitivity, useAutoCrop, modelVariant, runAnalysis],
  )

  const handleReset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setUploadedFile(null)
    setResult(null)
    setError('')
    setLoading(false)
    setSensitivity(DEFAULT_SEG_THRESHOLD)
    setUseAutoCrop(true)
    setModelVariant(DEFAULT_MODEL_VARIANT)
    hasResult.current = false
    skipSensitivityEffect.current = true
  }

  const loadingMessage = hasResult.current
    ? '민감도 변경 — 재분석 중...'
    : '손상 영역을 분석하는 중...'

  return (
    <div className="min-h-screen">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
        <section className="mb-14 text-center">
          <div className="mb-8 flex justify-center">
            <img
              src="/artifix-logo.png"
              alt="ArtiFix"
              className="h-16 w-auto object-contain sm:h-20 md:h-24"
            />
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-wide text-bronze-dark sm:text-3xl">
            유물 표면 손상 자동 감지
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-bronze-light">
            ArtiFix는 유물·문화재 이미지에서 균열, 표면 손상, 변색을 자동으로 감지하고
            유형별 confidence를 제공하는 컴퓨터 비전 시스템입니다.
          </p>
          <span
            className={`mt-5 inline-flex items-center gap-1.5 rounded-full border px-4 py-1 text-xs font-medium tracking-wide ${
              USE_MOCK_API
                ? 'border-amber-300/50 bg-amber-50 text-amber-800'
                : 'border-bronze/25 bg-bronze-muted text-bronze'
            }`}
          >
            {USE_MOCK_API ? 'Mock API' : 'Live API · localhost:8000'}
            <InfoTooltip content={HELP.apiMode} placement="bottom" />
          </span>
        </section>

        <section className="mb-10">
          {!uploadedFile && (
            <>
              <UploadOptions
                useAutoCrop={useAutoCrop}
                onUseAutoCropChange={setUseAutoCrop}
                modelVariant={modelVariant}
                onModelVariantChange={setModelVariant}
                disabled={loading}
              />
              <ImageUploader onUpload={handleUpload} disabled={loading} />
            </>
          )}

          {uploadedFile && loading && (
            <>
              {previewUrl && (
                <div className="card-panel mb-4 p-5">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-bronze-light">
                    업로드 미리보기
                  </p>
                  <div className="aspect-video max-h-48 overflow-hidden rounded-xl border border-bronze/10 bg-ivory-warm opacity-60">
                    <img src={previewUrl} alt="미리보기" className="h-full w-full object-contain" />
                  </div>
                </div>
              )}
              <div className="card-panel">
                <LoadingSpinner message={loadingMessage} />
              </div>
            </>
          )}

          {error && (
            <div
              className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              role="alert"
            >
              {error}
            </div>
          )}
        </section>

        {result && !loading && (
          <section>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-lg font-semibold tracking-wide text-bronze-dark">분석 결과</h2>
              <span className="inline-flex items-center gap-2">
                <button type="button" onClick={handleReset} className="btn-bronze">
                  새 이미지 업로드
                </button>
                <InfoTooltip content={HELP.newUpload} placement="bottom" />
              </span>
            </div>
            <ResultViewer
              result={result}
              imageFile={uploadedFile}
              sensitivity={sensitivity}
              onSensitivityCommit={handleSensitivityCommit}
              useAutoCrop={useAutoCrop}
              modelVariant={modelVariant}
              analyzing={false}
            />
          </section>
        )}
      </main>

      <Footer />
    </div>
  )
}
