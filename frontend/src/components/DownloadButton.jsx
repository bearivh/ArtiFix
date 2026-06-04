import InfoTooltip from './InfoTooltip.jsx'

export default function DownloadButton({
  dataUrl,
  filename = 'artifix-result.png',
  label = '결과 이미지 다운로드',
  help,
}) {
  const handleDownload = () => {
    if (!dataUrl) return
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        onClick={handleDownload}
        disabled={!dataUrl}
        className="btn-bronze-solid"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        {label}
      </button>
      {help && <InfoTooltip content={help} placement="top" />}
    </div>
  )
}
