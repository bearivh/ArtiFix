import { useCallback, useEffect, useRef, useState } from 'react'

// status: 'idle' | 'loading' | 'ready' | 'captured' | 'error'

export default function CameraModal({ open, onClose, onCapture }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [status, setStatus] = useState('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [capturedSrc, setCapturedSrc] = useState(null)

  useEffect(() => {
    if (!open) return undefined

    setStatus('loading')
    setErrorMsg('')
    setCapturedSrc(null)

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error')
      setErrorMsg('카메라를 지원하지 않는 환경입니다. (HTTPS 또는 localhost 필요)')
      return undefined
    }

    let aborted = false

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((stream) => {
        if (aborted) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        const video = videoRef.current
        if (!video) return

        // 비디오 요소 레벨 에러 (프레임 디코딩 실패, 드라이버 오류 등)
        video.addEventListener('error', () => {
          if (!aborted) {
            setStatus('error')
            const code = video.error?.code ?? '?'
            const msg = video.error?.message ?? ''
            setErrorMsg(`카메라 재생 오류 (MediaError code ${code}${msg ? ': ' + msg : ''})`)
          }
        }, { once: true })

        // 스트림 트랙이 끊기는 경우 (카메라 뽑힘, 드라이버 충돌 등)
        stream.getVideoTracks().forEach((track) => {
          track.addEventListener('ended', () => {
            if (!aborted) {
              setStatus('error')
              setErrorMsg('카메라 연결이 끊어졌습니다. 다른 앱이 카메라를 점유 중일 수 있습니다.')
            }
          })
        })

        video.srcObject = stream

        // playing 이벤트 = 실제로 프레임이 화면에 그려지기 시작한 시점
        let playingFired = false
        video.addEventListener('playing', () => {
          playingFired = true
          if (!aborted) setStatus('ready')
        }, { once: true })

        return video.play().then(() => {
          // play() resolve 후 playing이 아직 안 왔으면 여기서 보장
          if (!aborted && !playingFired) setStatus('ready')
        })
      })
      .catch((err) => {
        if (aborted) return
        if (err?.name === 'AbortError') {
          setStatus('ready')
        } else {
          setStatus('error')
          setErrorMsg(`카메라 오류: ${err?.name ?? err?.message ?? String(err)}`)
        }
      })

    return () => {
      aborted = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      if (videoRef.current) videoRef.current.srcObject = null
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const handleCapture = useCallback(() => {
    const video = videoRef.current
    if (!video || status !== 'ready') return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    canvas.getContext('2d').drawImage(video, 0, 0)
    setCapturedSrc(canvas.toDataURL('image/jpeg', 0.92))
    setStatus('captured')
  }, [status])

  const handleRetake = () => {
    setCapturedSrc(null)
    setStatus('ready')
  }

  const handleConfirm = useCallback(() => {
    if (!capturedSrc) return
    fetch(capturedSrc)
      .then((r) => r.blob())
      .then((blob) => {
        const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' })
        onCapture(file)
        onClose()
      })
  }, [capturedSrc, onCapture, onClose])

  if (!open) return null

  const isVideoVisible = status === 'ready' || status === 'loading'

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-bronze/30 bg-pure shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-bronze/10 px-5 py-3">
          <h2 className="text-sm font-semibold text-bronze-dark">카메라 촬영</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-bronze/20 bg-ivory-warm px-3 py-1 text-xs font-medium text-bronze-light transition hover:text-bronze-dark"
          >
            닫기
          </button>
        </header>

        <div className="relative aspect-video overflow-hidden bg-black">
          {/*
            video는 항상 DOM에 존재 — 조건부 unmount를 피해야 브라우저가
            "소스 없음" 아이콘(X)을 표시하지 않고, ref도 항상 유효하게 유지됨
          */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`h-full w-full object-cover transition-opacity duration-300 ${isVideoVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          />

          {status === 'captured' && capturedSrc && (
            <img
              src={capturedSrc}
              alt="촬영 미리보기"
              className="absolute inset-0 h-full w-full object-contain"
            />
          )}

          {status === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <p className="text-sm text-red-400">{errorMsg}</p>
              <p className="text-xs text-red-300/60">
                브라우저 주소창의 카메라 아이콘을 클릭해 권한을 허용한 뒤 새로고침해주세요.
              </p>
            </div>
          )}

          {status === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-bronze border-t-transparent" />
              <p className="text-xs text-bronze-light/80">카메라 연결 중...</p>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-center gap-3 border-t border-bronze/10 px-5 py-4">
          {status === 'captured' ? (
            <>
              <button
                type="button"
                onClick={handleRetake}
                className="rounded-lg border border-bronze/25 bg-ivory-warm px-5 py-2 text-sm font-medium text-bronze-dark transition hover:bg-bronze-muted"
              >
                다시 찍기
              </button>
              <button type="button" onClick={handleConfirm} className="btn-bronze px-8">
                분석 시작
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleCapture}
              disabled={status !== 'ready'}
              className="btn-bronze px-10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              촬영
            </button>
          )}
        </footer>

        <p className="pb-3 text-center text-xs text-bronze-light/50">ESC로 닫기</p>
      </div>
    </div>
  )
}
