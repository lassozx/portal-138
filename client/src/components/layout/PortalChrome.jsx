import { useEffect, useId, useRef, useState } from 'react'
import AccountMenu from '../account/AccountMenu.jsx'
import './PortalChrome.css'

const navigation = [
  { key: 'home', label: 'Início', href: '#inicio' },
  { key: 'news', label: 'Notícias', href: '#noticias' },
  { key: 'about', label: 'Sobre o portal', href: '#sobre' },
]

const institutions = [
  { label: 'FIESP', href: 'https://www.fiesp.com.br/' },
  { label: 'CIESP', href: 'https://www.ciesp.com.br/' },
  { label: 'SESI', href: 'https://www.sesisp.org.br/' },
  { label: 'SENAI', href: 'https://www.sp.senai.br/' },
]

const socialLinks = [
  { name: 'Facebook', icon: 'facebook', href: 'https://www.facebook.com/share/g/1Dc7FtWLwQ/' },
  { name: 'YouTube', icon: 'youtube', href: 'https://www.youtube.com/sesisp' },
  { name: 'Instagram', icon: 'instagram', href: 'https://www.instagram.com/segundoano.26_/' },
]

function SocialIcon({ name }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {name === 'facebook' && (
        <path d="M14 22v-9h3l.5-4H14V7c0-1.2.3-2 2-2h2V1.4a25 25 0 0 0-3-.2c-3 0-5 1.8-5 5.2V9H7v4h3v9z" />
      )}
      {name === 'youtube' && (
        <path fillRule="evenodd" d="M23 7s-.2-1.7-.9-2.4c-.9-.9-1.9-.9-2.4-1C16.3 3.3 12 3.3 12 3.3s-4.3 0-7.7.3c-.5.1-1.5.1-2.4 1C1.2 5.3 1 7 1 7S.7 9 .7 11v2c0 2 .3 4 .3 4s.2 1.7.9 2.4c.9.9 2.1.9 2.6 1 2 .2 7.5.3 7.5.3s4.3 0 7.7-.3c.5-.1 1.5-.1 2.4-1 .7-.7.9-2.4.9-2.4s.3-2 .3-4v-2c0-2-.3-4-.3-4ZM9.7 15.5V8.4l6.5 3.6z" clipRule="evenodd" />
      )}
      {name === 'instagram' && (
        <>
          <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="17.5" cy="6.5" r="1.2" />
        </>
      )}
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
    </svg>
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
        <div className="chrome-utility-inner">
          <nav className="chrome-institutions" aria-label="Instituições">
            {institutions.map((institution) => (
              <a key={institution.label} href={institution.href} target="_blank" rel="noopener noreferrer">
                {institution.label}<span className="chrome-sr-only"> (abre em nova aba)</span>
              </a>
            ))}
          </nav>
          <nav className="chrome-social-links" aria-label="Redes sociais do SESI-SP">
            {socialLinks.map((social) => (
              <a
                key={social.icon}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`SESI-SP no ${social.name} (abre em nova aba)`}
                title={`SESI-SP no ${social.name}`}
              >
                <SocialIcon name={social.icon} />
              </a>
            ))}
          </nav>
        </div>
      </div>

      <div className="chrome-container chrome-brand-row">
        <a href="#inicio" className="chrome-header-logo" aria-label="Portal 138 - Início">
          <img src="/images/logo-sesi-sp.svg" alt="SESI São Paulo" width="533" height="95" />
        </a>
        
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
      <div className="chrome-footer-info">
        <div className="chrome-container chrome-footer-info-inner">
          <div className="chrome-footer-identity">
            <a href="#inicio" aria-label="Portal 138 - Início">PORTAL 138</a>
            <p>Informação, educação e comunidade.</p>
          </div>
          <div className="chrome-footer-detail">
            <h2>Nossa comunidade</h2>
            <p>Notícias, projetos e histórias<br />da comunidade escolar SESI 138.</p>
          </div>
          <div className="chrome-footer-detail">
            <h2>Projeto estudantil</h2>
            <p>Desenvolvido por <strong>Lasso</strong>,<br />estudante do <strong>SENAI</strong>.</p>
          </div>
        </div>
      </div>

      <div className="chrome-footer-links">
        <div className="chrome-container chrome-footer-links-inner">
          <nav className="chrome-footer-nav" aria-label="Navegação do rodapé">
            <a href="#inicio">Início</a>
            <a href="#noticias">Últimas notícias</a>
            <a href="#sobre">Sobre o Portal 138</a>
          </nav>
          <a
            className="chrome-footer-repository"
            href="https://github.com/lassozx/portal-138"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 .75a11.25 11.25 0 0 0-3.56 21.92c.56.1.77-.24.77-.54v-2.1c-3.13.68-3.79-1.33-3.79-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.68.08-.68 1.13.08 1.73 1.16 1.73 1.16 1 1.72 2.63 1.22 3.27.94.1-.73.4-1.22.71-1.5-2.5-.29-5.13-1.25-5.13-5.56 0-1.23.44-2.23 1.16-3.02-.12-.28-.5-1.43.11-2.98 0 0 .95-.3 3.1 1.15a10.8 10.8 0 0 1 5.64 0c2.15-1.46 3.1-1.15 3.1-1.15.61 1.55.23 2.7.11 2.98.72.79 1.16 1.8 1.16 3.02 0 4.32-2.64 5.27-5.15 5.55.4.35.76 1.03.76 2.08v3.09c0 .3.2.65.77.54A11.25 11.25 0 0 0 12 .75Z" />
            </svg>
            <span>Código no GitHub<span className="chrome-sr-only"> (abre em nova aba)</span></span>
          </a>
        </div>
        <div className="chrome-container chrome-footer-copyright">
          <p>© {new Date().getFullYear()} Portal 138 · Desenvolvido por Lasso, estudante do SENAI.</p>
        </div>
      </div>
    </footer>
  )
}
