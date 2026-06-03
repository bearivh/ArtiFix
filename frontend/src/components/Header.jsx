import { Link, useLocation } from 'react-router-dom'

const LOGO_SRC = '/symbol.png'

export default function Header() {
  const { pathname } = useLocation()
  const isAbout = pathname === '/about'

  return (
    <header className="sticky top-0 z-50 border-b border-bronze/10 bg-pure/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        <Link to="/" className="transition opacity-90 hover:opacity-100">
          <img
            src={LOGO_SRC}
            alt="ArtiFix"
            className="h-9 w-auto object-contain sm:h-10"
          />
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          {isAbout && (
            <Link to="/" className="nav-link">
              Main
            </Link>
          )}
          {!isAbout ? (
            <Link to="/about" className="nav-link">
              About
            </Link>
          ) : (
            <span className="nav-link-active">About</span>
          )}
        </nav>
      </div>
    </header>
  )
}
