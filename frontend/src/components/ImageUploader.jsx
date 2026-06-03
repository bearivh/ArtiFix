import { useCallback, useRef, useState } from 'react'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png']
const ACCEPTED_EXT = '.jpg,.jpeg,.png'

function isValidImage(file) {
  return file && ACCEPTED_TYPES.includes(file.type)
}

export default function ImageUploader({ onUpload, disabled = false }) {
  const inputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState('')

  const handleFile = useCallback(
    (file) => {
      setError('')
      if (!file) return
      if (!isValidImage(file)) {
        setError('JPG 또는 PNG 파일만 업로드할 수 있습니다.')
        return
      }
      onUpload(file)
    },
    [onUpload],
  )

  const onDrop = useCallback(
    (e) => {
      e.preventDefault()
      setIsDragging(false)
      if (disabled) return
      const file = e.dataTransfer.files?.[0]
      handleFile(file)
    },
    [disabled, handleFile],
  )

  const onDragOver = (e) => {
    e.preventDefault()
    if (!disabled) setIsDragging(true)
  }

  const onDragLeave = () => setIsDragging(false)

  const onInputChange = (e) => {
    handleFile(e.target.files?.[0])
    e.target.value = ''
  }

  return (
    <div className="w-full">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (!disabled) inputRef.current?.click()
          }
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`
          flex min-h-[240px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition
          ${isDragging
            ? 'border-bronze-glow bg-bronze-muted shadow-bronze-glow'
            : 'border-bronze/30 bg-pure hover:border-bronze-light hover:bg-bronze-subtle hover:shadow-bronze'}
          ${disabled ? 'pointer-events-none cursor-not-allowed opacity-50' : ''}
        `}
      >
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-bronze/25 bg-bronze-subtle">
          <svg className="h-8 w-8 text-bronze" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.25}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-base font-medium text-bronze-dark">
          이미지를 드래그하거나 클릭하여 업로드
        </p>
        <p className="mt-2 text-sm text-bronze-light">JPG, PNG · 유물 표면 사진</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXT}
        className="hidden"
        onChange={onInputChange}
        disabled={disabled}
      />

      {error && (
        <p className="mt-3 text-center text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
