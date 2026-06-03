import { useEffect, useState } from 'react'
import ImageUploader from '../components/ImageUploader.jsx'
import ResultViewer from '../components/ResultViewer.jsx'
import Header from '../components/Header.jsx'
import Footer from '../components/Footer.jsx'
import {
  predict,
  parsePredictResult,
  USE_MOCK_API,
  ApiError,
} from '../api/api.js'

function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <div className="relative h-14 w-14">
        <div className="absolute inset-0 rounded-full border-2 border-bronze-muted" />
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-bronze" />
        <svg className="absolute inset-0 m-auto h-5 w-5 text-bronze-glow" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7-6.3-4.6L6 21l2.3-7-6-4.6h7.6z" />
        </svg>
      </div>
      <p className="text-sm font-medium tracking-wide text-bronze-light">
        손상 영역을 분석하는 중...
      </p>
      <p className="text-xs text-bronze-light/70">서버에서 이미지를 처리하고 있습니다</p>
    </div>
  )
}

export default function Home() {
  const [previewUrl, setPreviewUrl] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleUpload = async (file) => {
    setError('')
    setResult(null)

    if (previewUrl) URL.revokeObjectURL(previewUrl)
    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)

    setLoading(true)
    try {
      const data = await predict(file)
      setResult(parsePredictResult(data))
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('분석 중 알 수 없는 오류가 발생했습니다.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setResult(null)
    setError('')
  }

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
            className={`mt-5 inline-block rounded-full border px-4 py-1 text-xs font-medium tracking-wide ${
              USE_MOCK_API
                ? 'border-amber-300/50 bg-amber-50 text-amber-800'
                : 'border-bronze/25 bg-bronze-muted text-bronze'
            }`}
          >
            {USE_MOCK_API ? 'Mock API' : 'Live API · localhost:8000'}
          </span>
        </section>

        <section className="mb-10">
          {!loading && !result && (
            <ImageUploader onUpload={handleUpload} disabled={loading} />
          )}

          {previewUrl && loading && (
            <div className="card-panel mt-6 p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-bronze-light">
                업로드 미리보기
              </p>
              <div className="aspect-video max-h-48 overflow-hidden rounded-xl border border-bronze/10 bg-ivory-warm opacity-60">
                <img src={previewUrl} alt="미리보기" className="h-full w-full object-contain" />
              </div>
            </div>
          )}

          {loading && (
            <div className="card-panel mt-6">
              <LoadingSpinner />
            </div>
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
              <button type="button" onClick={handleReset} className="btn-bronze">
                새 이미지 업로드
              </button>
            </div>
            <ResultViewer
              originalSrc={result.originalSrc}
              overlaySrc={result.overlaySrc}
              maskSrc={result.maskSrc}
              labels={result.labels}
            />
          </section>
        )}
      </main>

      <Footer />
    </div>
  )
}
