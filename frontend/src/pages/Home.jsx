import { useCallback, useEffect, useRef, useState } from 'react'

function ChevronDown({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  )
}
import ImageUploader from '../components/ImageUploader.jsx'
import UploadOptions from '../components/UploadOptions.jsx'
import ResultViewer from '../components/ResultViewer.jsx'
import Header from '../components/Header.jsx'
import Footer from '../components/Footer.jsx'
import HistoryPanel from '../components/HistoryPanel.jsx'
import CameraModal from '../components/CameraModal.jsx'
import { useLocalStorage } from '../utils/useLocalStorage.js'
import {
  predict,
  parsePredictResult,
  ApiError,
  DEFAULT_SEG_THRESHOLD,
  DEFAULT_MODEL_VARIANT,
  DEFAULT_CROP_MODE,
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
  const [sensitivity, setSensitivity] = useLocalStorage('artifix_sensitivity', DEFAULT_SEG_THRESHOLD)
  const [useAutoCrop, setUseAutoCrop] = useState(true)
  const [modelVariant, setModelVariant] = useLocalStorage('artifix_model_variant', DEFAULT_MODEL_VARIANT)
  const [cropMode, setCropMode] = useLocalStorage('artifix_crop_mode', DEFAULT_CROP_MODE)
  const [history, setHistory] = useState([])
  const [cameraOpen, setCameraOpen] = useState(false)
  const [showAnalysis, setShowAnalysis] = useState(false)

  const analysisSectionRef = useRef(null)
  const skipSensitivityEffect = useRef(true)
  const hasResult = useRef(false)

  // 분석하기 클릭 → 섹션 표시 후 smooth scroll
  const handleShowAnalysis = () => setShowAnalysis(true)

  useEffect(() => {
    if (!showAnalysis) return undefined
    // 두 번의 rAF: 첫 번째는 DOM 커밋, 두 번째는 레이아웃·페인트 완료 후 스크롤
    let id1, id2
    id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => {
        const el = analysisSectionRef.current
        if (!el) return
        const y = el.getBoundingClientRect().top + window.scrollY - 57
        window.scrollTo({ top: y, behavior: 'smooth' })
      })
    })
    return () => {
      cancelAnimationFrame(id1)
      cancelAnimationFrame(id2)
    }
  }, [showAnalysis])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const MAX_HISTORY = 10

  const runAnalysis = useCallback(async (file, segThreshold, autoCrop, variant, crop) => {
    if (!file) return
    setLoading(true)
    setError('')
    try {
      const data = await predict(file, segThreshold, autoCrop, variant, crop)
      const parsed = parsePredictResult(data)
      setResult(parsed)
      hasResult.current = true
      setHistory((prev) => {
        const entry = { id: Date.now(), filename: file.name, result: parsed, timestamp: Date.now() }
        return [entry, ...prev].slice(0, MAX_HISTORY)
      })
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

    await runAnalysis(file, sensitivity, useAutoCrop, modelVariant, cropMode)

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
      runAnalysis(uploadedFile, value, useAutoCrop, modelVariant, cropMode)
    },
    [uploadedFile, sensitivity, useAutoCrop, modelVariant, cropMode, runAnalysis],
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
    hasResult.current = false
    skipSensitivityEffect.current = true
  }

  const handleHistoryRestore = (item) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setUploadedFile(null)
    setResult(item.result)
    setError('')
    setLoading(false)
    hasResult.current = false
    skipSensitivityEffect.current = true
  }

  const handleHistoryRemove = (id) => {
    setHistory((prev) => prev.filter((item) => item.id !== id))
  }

  const handleHistoryClearAll = () => {
    setHistory([])
  }

  const loadingMessage = hasResult.current
    ? '민감도 변경 — 재분석 중...'
    : '손상 영역을 분석하는 중...'

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      {/* ── Hero 섹션 ── */}
      <section
        className={`flex flex-col items-center justify-center px-4 text-center ${
          showAnalysis ? 'py-16 sm:py-20' : 'flex-1'
        }`}
      >
        <div className="mb-6 flex justify-center">
          <img
            src="/Artifix.png"
            alt="ArtiFix"
            className="h-28 w-auto object-contain sm:h-36 md:h-44 lg:h-52"
          />
        </div>
        <p className="mx-auto max-w-2xl text-base leading-relaxed text-bronze-light">
          ArtiFix는 유물·문화재 이미지에서 균열, 표면 손상, 변색을 자동으로 감지하고<br />
          유형별 confidence를 제공하는 컴퓨터 비전 시스템입니다.
        </p>

        {!showAnalysis && (
          <div className="mt-10 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={handleShowAnalysis}
              className="btn-bronze px-10 py-3 text-base"
            >
              분석하기
            </button>
            <ChevronDown className="h-6 w-6 animate-bounce text-bronze-light/50" />
          </div>
        )}
      </section>

      {/* ── 분석 섹션 (분석하기 클릭 후 표시) ── */}
      {showAnalysis && (
      <main
        ref={analysisSectionRef}
        className="mx-auto w-full max-w-6xl px-4 pb-10 pt-4 sm:px-6 sm:pb-16 sm:pt-6"
        style={{ scrollMarginTop: '57px', minHeight: 'calc(100vh - 57px)' }}
      >
        <section className="mb-10">
          {!uploadedFile && (
            <>
              <UploadOptions
                useAutoCrop={useAutoCrop}
                onUseAutoCropChange={setUseAutoCrop}
                cropMode={cropMode}
                onCropModeChange={setCropMode}
                modelVariant={modelVariant}
                onModelVariantChange={setModelVariant}
                sensitivity={sensitivity}
                onSensitivityChange={setSensitivity}
                disabled={loading}
              />
              <div className="flex items-stretch gap-3">
                <div className="min-w-0 flex-1">
                  <ImageUploader onUpload={handleUpload} disabled={loading} />
                </div>
                <button
                  type="button"
                  onClick={() => setCameraOpen(true)}
                  disabled={loading}
                  className="flex w-28 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-bronze/20 bg-ivory-warm px-3 text-xs text-bronze-light transition hover:border-bronze/40 hover:bg-bronze-subtle hover:text-bronze-dark disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-center leading-snug">카메라로<br />촬영</span>
                </button>
              </div>
              <CameraModal
                open={cameraOpen}
                onClose={() => setCameraOpen(false)}
                onCapture={handleUpload}
              />
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
              cropMode={cropMode}
              modelVariant={modelVariant}
              analyzing={false}
            />
          </section>
        )}

        {history.length > 0 && (
          <section className="mt-14">
            <HistoryPanel
              history={history}
              onRestore={handleHistoryRestore}
              onRemove={handleHistoryRemove}
              onClearAll={handleHistoryClearAll}
            />
          </section>
        )}
      </main>
      )}

      <Footer />
    </div>
  )
}
