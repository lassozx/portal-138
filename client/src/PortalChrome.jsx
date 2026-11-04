import { useEffect, useId, useRef, useState } from 'react'
import AccountMenu from './AccountMenu.jsx'
import './PortalChrome.css'

const navigation = [
  { key: 'home', label: 'Início', href: '#inicio' },
  { key: 'news', label: 'Notícias', href: '#noticias' },
  { key: 'about', label: 'Sobre o portal', href: '#sobre' },
]

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
    </svg>
  )
}

function Wordmark({ footer = false }) {
  return (
    <a
      href="#inicio"
      className={`chrome-wordmark${footer ? ' chrome-wordmark-footer' : ''}`}
      aria-label="Portal 138 - Início"
    >
      <span className="chrome-wordmark-name">
        PORTAL<span>138</span>
        <span className="chrome-wordmark-dot" />
      </span>
      <span className="chrome-wordmark-description">NOSSA ESCOLA. NOSSAS HISTÓRIAS.</span>
    </a>
  )
}

export function PortalHeader({
  session,
  onLogin,
  onLogout,
  onProfile,
  onAdmin,
  active = 'home',
  onSearch,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButton = useRef(null)
  const navigationId = useId()

  useEffect(() => {
    if (!menuOpen) return

    function closeOnEscape(event) {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        menuButton.current?.focus()
      }
    }

    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [menuOpen])

  function search() {
    setMenuOpen(false)
    onSearch?.()
  }

  return (
    <header className="chrome-header">
      <div className="chrome-utility">
        <div className="chrome-container chrome-utility-inner">
          <span>Informação, educação e comunidade</span>
          <span className="chrome-utility-school">
            COMUNIDADE ESCOLAR <strong>SESI 138</strong>
          </span>
        </div>
      </div>

      <div className="chrome-container chrome-brand-row">
        <a href="#inicio" className="chrome-header-logo" aria-label="Portal 138 - Início">
          <img src="/logo-sesi-sp.svg" alt="SESI São Paulo" width="533" height="95" />
        </a>
        <p className="chrome-brand-message">
          Um novo olhar sobre
          <br />
          <strong>a nossa comunidade.</strong>
        </p>
        <div className="chrome-account">
          <AccountMenu
            session={session}
            onLogin={onLogin}
            onLogout={onLogout}
            onProfile={onProfile}
            onAdmin={onAdmin}
          />
        </div>
      </div>

      <div className="chrome-navigation-row">
        <div className="chrome-container chrome-navigation-inner">
          <button
            ref={menuButton}
            type="button"
            className="chrome-menu-toggle"
            aria-expanded={menuOpen}
            aria-controls={navigationId}
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              {menuOpen ? <path d="m6 6 12 12M6 18 18 6" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
            <span>Menu</span>
          </button>

          <nav
            id={navigationId}
            className="chrome-nav"
            aria-label="Navegação principal"
            data-open={menuOpen}
          >
            {navigation.map((item) => (
              <a
                key={item.key}
                href={item.href}
                className="chrome-nav-link"
                aria-current={active === item.key ? 'page' : undefined}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </a>
            ))}
          </nav>

          {onSearch ? (
            <button
              type="button"
              className="chrome-search"
              onClick={search}
              aria-label="Pesquisar notícias"
            >
              <SearchIcon />
              <span>Pesquisar</span>
            </button>
          ) : (
            <a
              href="#noticias"
              className="chrome-search"
              aria-label="Pesquisar notícias"
              onClick={() => setMenuOpen(false)}
            >
              <SearchIcon />
              <span>Pesquisar</span>
            </a>
          )}
        </div>
      </div>
    </header>
  )
}

export function PortalFooter() {
  return (
    <footer className="chrome-footer">
      <div className="chrome-container chrome-footer-grid">
        <div className="chrome-footer-brand">
          <Wordmark footer />
          <p>Um espaço para as notícias, as ideias e as pessoas que fazem parte da nossa escola.</p>
        </div>

        <div className="chrome-footer-column">
          <h2>Explore o portal</h2>
          <ul>
            <li>
              <a href="#inicio">Início</a>
            </li>
            <li>
              <a href="#noticias">Últimas notícias</a>
            </li>
          </ul>
        </div>

        <div className="chrome-footer-column">
          <h2>Nossa comunidade</h2>
          <ul>
            <li>
              <a href="#sobre">Sobre o Portal 138</a>
            </li>
          </ul>
        </div>

        <div className="chrome-footer-column chrome-footer-purpose">
          <span className="chrome-footer-label">FEITO DE HISTÓRIAS</span>
          <h2>
            A escola acontece
            <br />
            todos os dias.
          </h2>
          <p>Acompanhe as conquistas e os acontecimentos da comunidade SESI 138.</p>
          <a href="#noticias">
            Fique por dentro <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>

      <div className="chrome-footer-base">
        <div className="chrome-container chrome-footer-base-inner">
          <span>Portal 138 · Comunidade escolar SESI 138</span>
          <span>Informação que aproxima.</span>
        </div>
      </div>
    </footer>
  )
}
