import { Link } from 'react-router-dom'
import Header from '../components/Header.jsx'
import Footer from '../components/Footer.jsx'

const TECH_STACK = [
  { name: 'React', desc: 'UI 프레임워크' },
  { name: 'Tailwind CSS', desc: '스타일링' },
  { name: 'FastAPI', desc: '추론 API 서버' },
  { name: 'PyTorch', desc: '딥러닝 학습·추론' },
  { name: 'OpenCV', desc: '이미지 전처리' },
]

const OUTPUTS = [
  'Binary damage mask (픽셀 단위 손상 영역)',
  'Multi-label classification (균열 / 표면 손상 / 변색)',
]

export default function About() {
  return (
    <div className="min-h-screen">
      <Header />

      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="mb-10 flex justify-center">
          <img
            src="/artifix-logo.png"
            alt="ArtiFix"
            className="h-20 w-auto object-contain sm:h-24"
          />
        </div>

        <h1 className="text-center font-display text-3xl font-semibold tracking-wide text-bronze-dark">
          About ArtiFix
        </h1>
        <p className="mt-6 text-center text-lg leading-relaxed text-bronze-light">
          ArtiFix는 유물·문화재 이미지에서 표면 손상을 자동으로 감지하고 손상 유형을
          분류하는 컴퓨터 비전(CV) 시스템입니다. 보존·복원 현장에서 손상 기록과
          모니터링을 보조하는 것을 목표로 합니다.
        </p>

        <section className="card-panel mt-12 p-8">
          <h2 className="text-xl font-semibold text-bronze-dark">모델 구조</h2>
          <div className="mt-6 rounded-xl border border-bronze/15 bg-ivory-warm p-6 font-mono text-sm leading-relaxed text-bronze">
            <p>RGB + Sobel (4채널 입력)</p>
            <p className="my-3 text-center text-bronze-glow">↓</p>
            <p>EfficientNet Encoder</p>
            <p className="my-3 text-center text-bronze-glow">↓</p>
            <p>U-Net Decoder + Classification Head</p>
          </div>
          <p className="mt-4 text-sm text-bronze-light">
            Sobel edge map을 RGB와 결합해 미세 균열·표면 질감 변화를 강조합니다.
            Multi-task 학습으로 segmentation과 classification을 동시에 수행합니다.
          </p>
        </section>

        <section className="card-panel mt-8 p-8">
          <h2 className="text-xl font-semibold text-bronze-dark">출력</h2>
          <ul className="mt-4 space-y-3">
            {OUTPUTS.map((item) => (
              <li key={item} className="flex items-start gap-3 text-bronze-light">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rotate-45 bg-bronze-glow" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="card-panel mt-8 p-8">
          <h2 className="text-xl font-semibold text-bronze-dark">기술 스택</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {TECH_STACK.map(({ name, desc }) => (
              <div
                key={name}
                className="rounded-xl border border-bronze/10 bg-ivory-warm px-5 py-4 transition hover:border-bronze-light/40 hover:shadow-bronze"
              >
                <p className="font-semibold text-bronze-dark">{name}</p>
                <p className="mt-1 text-sm text-bronze-light">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-12 text-center">
          <Link to="/" className="btn-bronze-solid">
            분석 시작하기
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  )
}
