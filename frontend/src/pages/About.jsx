import { Link } from 'react-router-dom'
import Header from '../components/Header.jsx'
import Footer from '../components/Footer.jsx'
import { LabelWithHelp } from '../components/InfoTooltip.jsx'
import { HELP } from '../utils/featureHelp.js'
import useScrollAnimation from '../utils/useScrollAnimation.js'

const STEPS = [
  { n: '1', title: '분석 옵션 설정', desc: '민감도(Threshold), 모델 선택, AI Crop 방식을 선택합니다.' },
  { n: '2', title: '유물 사진 업로드', desc: 'JPG 또는 PNG 형식의 이미지를 업로드하거나 카메라로 촬영합니다.' },
  { n: '3', title: '분석 시작', desc: '사진 업로드가 완료되면 서버에서 추론을 실행합니다.' },
  { n: '4', title: '결과 확인', desc: '손상 마스크·오버레이·Grad-CAM·3D 시각화를 탭으로 확인합니다.' },
  { n: '5', title: 'PDF 보고서 다운로드', desc: '손상 요약, 분석 이미지, 영역 상세가 담긴 보고서를 저장합니다.' },
]

const OUTPUTS = [
  {
    title: '손상 마스크',
    desc: '손상으로 감지된 픽셀 영역을 흰색으로 표시한 이진(binary) 이미지입니다.',
  },
  {
    title: '합성 오버레이',
    desc: '원본 이미지 위에 손상 영역을 빨간색으로 덧씌워 위치를 직관적으로 파악할 수 있습니다.',
  },
  {
    title: 'Grad-CAM',
    desc: '모델이 유형 분류 판단 시 주목한 영역을 히트맵으로 시각화합니다. 파랑→빨강 순으로 주목도가 높습니다.',
  },
  {
    title: '손상 유형 Confidence',
    desc: 'Crack / Surface Damage / Discoloration 각각에 대한 감지 확률(0–100%)을 표시합니다.',
  },
  {
    title: '손상 면적 비율',
    desc: '전체 이미지 픽셀 대비 손상으로 분류된 픽셀의 비율(%)입니다.',
  },
  {
    title: '심각도 등급',
    desc: '손상 면적 비율과 감지 유형 수를 조합하여 LOW / MEDIUM / HIGH 등급으로 평가합니다.',
  },
]

const DAMAGE_TYPES = [
  {
    key: 'crack',
    title: '균열 (Crack)',
    desc: '표면의 선형 균열 또는 미세 균열. 구조적 약화로 이어질 수 있어 초기 발견이 중요합니다.',
    card: 'border-red-200 bg-red-50',
    dot: 'bg-red-400',
  },
  {
    key: 'surface_damage',
    title: '표면 손상 (Surface Damage)',
    desc: '박락(flaking), 깨짐, 마모 등 면적 단위의 표면 결손입니다.',
    card: 'border-amber-200 bg-amber-50',
    dot: 'bg-amber-400',
  },
  {
    key: 'discoloration',
    title: '변색 (Discoloration)',
    desc: '산화, 얼룩, 색상 변화로 나타나는 손상입니다. 재료 열화의 징후일 수 있습니다.',
    card: 'border-violet-200 bg-violet-50',
    dot: 'bg-violet-400',
  },
]

const TECH_STACK = [
  { name: 'React', desc: 'UI 프레임워크' },
  { name: 'Tailwind CSS', desc: '스타일링' },
  { name: 'Three.js', desc: '3D 시각화' },
  { name: 'FastAPI', desc: '추론 API 서버' },
  { name: 'PyTorch', desc: '딥러닝 학습·추론' },
  { name: 'segmentation-models-pytorch', desc: 'U-Net + EfficientNet 구현' },
  { name: 'OpenCV', desc: '이미지 전처리' },
  { name: 'Albumentations', desc: '데이터 증강' },
  { name: 'rembg', desc: 'AI 배경 제거' },
  { name: 'ReportLab', desc: 'PDF 보고서 생성' },
]

function FadeUp({ children, delay = 0, className = '' }) {
  const [ref, visible] = useScrollAnimation()
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(40px)',
        transition: `opacity 0.6s ease-out ${delay}ms, transform 0.6s ease-out ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

export default function About() {
  return (
    <div className="min-h-screen">
      <Header />

      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        {/* 로고 */}
        <FadeUp className="mb-10 flex justify-center">
          <img
            src="/Artifix.png"
            alt="ArtiFix"
            className="h-20 w-auto object-contain sm:h-24"
          />
        </FadeUp>

        {/* 1. 프로젝트 소개 */}
        <FadeUp delay={100}>
          <p className="mt-6 text-center text-lg leading-relaxed text-bronze-light">
            ArtiFix는 유물·문화재 이미지에서 표면 손상을 자동으로 감지하고<br />유형을
            분류하는 컴퓨터 비전(CV) 시스템입니다.
          </p>
        </FadeUp>
        <FadeUp delay={200}>
          <p className="mt-4 text-center text-base leading-relaxed text-bronze-light">
            박물관·문화재 보존 현장에서 전문가가 육안으로 수행하던 손상 기록·모니터링을 AI로
            보조합니다.<br />복원이나 3D 재구성이 목적이 아닌, 손상 위치·유형·심각도를
            기록하고 검토하는 데 초점을 둡니다.
          </p>
        </FadeUp>

        {/* 2. 사용 방법 */}
        <FadeUp className="mt-12">
          <section className="card-panel p-8">
            <h2 className="text-xl font-semibold text-bronze-dark">사용 방법</h2>
            <ol className="mt-6 space-y-4">
              {STEPS.map(({ n, title, desc }) => (
                <li key={n} className="flex items-start gap-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-bronze/30 bg-bronze-muted text-xs font-semibold text-bronze-dark">
                    {n}
                  </span>
                  <div>
                    <p className="font-semibold text-bronze-dark">{title}</p>
                    <p className="mt-0.5 text-sm text-bronze-light">{desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </FadeUp>

        {/* 3. 분석 결과 설명 */}
        <FadeUp className="mt-8">
          <section className="card-panel p-8">
            <h2 className="text-xl font-semibold text-bronze-dark">분석 결과 항목</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {OUTPUTS.map(({ title, desc }) => (
                <div
                  key={title}
                  className="rounded-xl border border-bronze/10 bg-ivory-warm px-5 py-4"
                >
                  <p className="font-semibold text-bronze-dark">{title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-bronze-light">{desc}</p>
                </div>
              ))}
            </div>
          </section>
        </FadeUp>

        {/* 4. 손상 유형 — 카드 3개 순서대로 딜레이 */}
        <FadeUp className="mt-8">
          <section className="card-panel p-8">
            <h2 className="text-xl font-semibold text-bronze-dark">손상 유형</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {DAMAGE_TYPES.map(({ key, title, desc, card, dot }, i) => (
                <FadeUp key={key} delay={i * 100}>
                  <div className={`rounded-xl border px-5 py-4 ${card}`}>
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
                      <p className="font-semibold text-bronze-dark">{title}</p>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-bronze-light">{desc}</p>
                  </div>
                </FadeUp>
              ))}
            </div>
          </section>
        </FadeUp>

        {/* 5. 모델 구조 */}
        <FadeUp className="mt-8">
          <section className="card-panel p-8">
            <h2 className="text-xl font-semibold text-bronze-dark">
              <LabelWithHelp help={HELP.aboutModel}>모델 구조</LabelWithHelp>
            </h2>
            <div className="mt-6 rounded-xl border border-bronze/15 bg-ivory-warm p-6 font-mono text-sm leading-relaxed text-bronze">
              <p>RGB + Sobel (4채널 입력)</p>
              <p className="my-3 text-center text-bronze-glow">↓</p>
              <p>EfficientNet-B2 Encoder</p>
              <p className="my-3 text-center text-bronze-glow">↓</p>
              <p>U-Net Decoder + Classification Head</p>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-bronze-light">
              EfficientNet-B2를 encoder로 사용하는 U-Net 기반 세그멘테이션 모델에 멀티태스크
              분류 헤드를 결합했습니다. RGB 이미지에 Sobel edge map을 추가한 4채널 입력으로
              미세 균열과 표면 질감 변화를 강조하며, segmentation과 classification을 동시에
              학습합니다.
            </p>
          </section>
        </FadeUp>

        {/* 6. 기술 스택 — 카드 순서대로 딜레이 */}
        <FadeUp className="mt-8">
          <section className="card-panel p-8">
            <h2 className="text-xl font-semibold text-bronze-dark">
              <LabelWithHelp help={HELP.aboutTech}>기술 스택</LabelWithHelp>
            </h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {TECH_STACK.map(({ name, desc }, i) => (
                <FadeUp key={name} delay={i * 50}>
                  <div className="rounded-xl border border-bronze/10 bg-ivory-warm px-5 py-4 transition hover:border-bronze-light/40 hover:shadow-bronze">
                    <p className="font-semibold text-bronze-dark">{name}</p>
                    <p className="mt-1 text-sm text-bronze-light">{desc}</p>
                  </div>
                </FadeUp>
              ))}
            </div>
          </section>
        </FadeUp>

        {/* CTA */}
        <FadeUp className="mt-12 text-center">
          <Link to="/" className="btn-bronze-solid">
            분석 시작하기
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </FadeUp>

        {/* 7. 주의사항 */}
        <FadeUp delay={100}>
          <p className="mt-10 text-center text-xs leading-relaxed text-bronze-light/60">
            본 시스템은 보존 전문가의 판단을 보조하는 도구입니다.
            실제 문화재 보존 처리에는 전문가의 최종 판단이 필요합니다.
          </p>
        </FadeUp>
      </main>

      <Footer />
    </div>
  )
}
