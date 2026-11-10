import { useEffect, useState } from 'react'
import NewsImage from '../components/news/NewsImage.jsx'
import PortalIcon from '../components/ui/PortalIcon.jsx'
import Login from '../pages/Login.jsx'
import AdminPanel from '../pages/AdminPanel.jsx'
import Profile from '../pages/Profile.jsx'
import Article from '../pages/Article.jsx'
import { PortalHeader, PortalFooter } from '../components/layout/PortalChrome.jsx'
import useSession from '../hooks/useSession.js'

// Hash URLs work on static hosts as well as Vite, including direct links and reloads.
function articleSlug() {
  const match = window.location.hash.match(/^#\/noticias\/([^/?#]+)$/)
  if (!match) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

function articleLink(post) {
  return `#/noticias/${encodeURIComponent(post.slug)}`
}

function navigationSection() {
  return (
    { '#noticias': 'news', '#sobre': 'about' }[window.location.hash] ||
    'home'
  )
}

function App() {
  const [slug, setSlug] = useState(articleSlug)
  const [activeSection, setActiveSection] = useState(navigationSection)
  useEffect(() => {
    const update = () => {
      setSlug(articleSlug())
      setView('public')
      setActiveSection(navigationSection())
    }
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [categories, setCategories] = useState([])
  const [categoriesError, setCategoriesError] = useState(false)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 })
  const [retry, setRetry] = useState(0)
  const [view, setView] = useState('public')
  const { session, status, notice, signIn, signOut, updateUser, retryRestore } = useSession()
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [featuredIndex, setFeaturedIndex] = useState(0)
  useEffect(() => setFeaturedIndex(0), [posts])

  useEffect(() => {
    if (slug) return
    const controller = new AbortController()
    async function loadPosts() {
      setLoading(true)
      setError('')
      try {
        const params = new URLSearchParams({ limit: '12', page: String(page) })
        if (search.trim()) params.set('search', search.trim())
        if (categoryId) params.set('categoryId', categoryId)
        const response = await fetch(`/api/posts?${params}`, { signal: controller.signal })
        if (!response.ok) throw new Error('Não foi possível carregar as notícias.')
        const result = await response.json()
        if (controller.signal.aborted) return
        setPosts(Array.isArray(result.data) ? result.data : [])
        setPagination(result.pagination || { total: 0, totalPages: 0 })
      } catch (err) {
        if (!controller.signal.aborted) setError(err.message || 'Erro ao conectar com o servidor.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    // Debounce typing and cancel obsolete requests so older results cannot replace newer ones.
    setLoading(true)
    const timeout = setTimeout(loadPosts, search ? 300 : 0)
    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [search, categoryId, page, retry, slug])

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/categories', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Categorias indisponíveis')
        return response.json()
      })
      .then((result) => {
        if (!controller.signal.aborted) setCategories(Array.isArray(result) ? result : [])
      })
      .catch(() => {
        if (!controller.signal.aborted) setCategoriesError(true)
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    function handleScroll() {
      setShowScrollTop(window.scrollY > 350)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const canManage = ['ADMIN', 'EDITOR'].includes(session?.user?.role)
  function logout() {
    signOut()
    setView('public')
  }
  const sessionNotice = notice && (
    <p
      role="status"
      className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-center text-sm text-amber-900"
    >
      {notice}
    </p>
  )

  const featuredPosts =
    !loading && !error && !search && !categoryId && page === 1 ? posts.slice(0, 3) : []
  const currentFeaturedIndex = Math.min(featuredIndex, Math.max(0, featuredPosts.length - 1))
  const featuredPost = featuredPosts[currentFeaturedIndex]

  function focusSearch() {
    document.getElementById('noticias')?.scrollIntoView?.({ behavior: 'smooth' })
    document.getElementById('portal-search')?.focus({ preventScroll: true })
  }

  function formatDate(date) {
    if (!date || Number.isNaN(new Date(date).getTime())) return 'Data não informada'

    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(date))
  }

  if (status !== 'ready') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 text-slate-900">
        <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8">
          <h1 className="text-2xl font-black">
            Portal <span className="text-red-700">138</span>
          </h1>
          {status === 'checking' ? (
            <p role="status" className="mt-4 text-slate-600">
              Verificando sua sessão…
            </p>
          ) : (
            <>
              <p role="alert" className="mt-4 leading-7 text-slate-600">
                Não foi possível verificar sua sessão. Tente novamente ou continue sem entrar.
              </p>
              <button
                type="button"
                onClick={retryRestore}
                className="mt-5 w-full rounded-lg bg-red-700 px-4 py-3 font-bold text-white"
              >
                Tentar novamente
              </button>
              <button
                type="button"
                onClick={logout}
                className="mt-3 w-full rounded-lg border border-slate-300 px-4 py-3 font-bold text-slate-700"
              >
                Continuar sem entrar
              </button>
            </>
          )}
        </section>
      </main>
    )
  }

  if (view === 'login') {
    return (
      <Login
        onLogin={(newSession) => {
          signIn(newSession)
          setView(!slug && ['ADMIN', 'EDITOR'].includes(newSession.user.role) ? 'admin' : 'public')
        }}
        onBack={() => setView('public')}
      />
    )
  }

  if (view === 'profile' && session) {
    return (
      <Profile
        token={session.token}
        user={session.user}
        onBack={() => setView('public')}
        onUserUpdated={updateUser}
        onSessionUpdated={signIn}
      />
    )
  }

  if (view === 'admin' && canManage) {
    return (
      <AdminPanel
        token={session.token}
        user={session.user}
        onLogout={logout}
        onBack={() => setView('public')}
      />
    )
  }

  if (slug)
    return (
      <Article
        key={slug}
        slug={slug}
        session={session}
        sessionNotice={sessionNotice}
        onLogin={() => setView('login')}
        onLogout={logout}
        onProfile={() => setView('profile')}
        onAdmin={() => setView('admin')}
      />
    )

  return (
    <div className="portal-home">
      <a href="#conteudo" className="portal-skip">
        Pular para o conteúdo
      </a>
      <PortalHeader
        session={session}
        onLogin={() => setView('login')}
        onLogout={logout}
        onProfile={() => setView('profile')}
        onAdmin={() => setView('admin')}
        onSearch={focusSearch}
        active={activeSection}
      />
      {sessionNotice}
      <main id="conteudo">
        <section id="inicio" className="portal-hero-section" aria-label="Destaques do Portal 138">
          <div className="portal-container">
            <div className="portal-hero">
              <div className="portal-hero-copy" aria-live="polite">
                <p className="portal-eyebrow">
                  {featuredPost
                    ? `Em destaque · ${featuredPost.category?.name || 'Notícias'}`
                    : 'Comunidade escolar · SESI 138'}
                </p>
                <h1>
                  {featuredPost ? (
                    featuredPost.title
                  ) : (
                    <>
                      A vida escolar
                      <br />
                      em destaque.
                    </>
                  )}
                </h1>
                <p className="portal-hero-summary">
                  {featuredPost
                    ? featuredPost.excerpt || featuredPost.content
                    : 'Notícias, projetos e conquistas de quem faz parte da nossa comunidade. Conheça as histórias do Portal 138.'}
                </p>
                <a
                  className="portal-button portal-button-white"
                  href={featuredPost ? articleLink(featuredPost) : '#noticias'}
                >
                  {featuredPost ? 'Ler notícia' : 'Ver últimas notícias'}{' '}
                  <span aria-hidden="true">→</span>
                </a>
              </div>
              <div className="portal-hero-image">
                <NewsImage
                  key={featuredPost?.coverImage || 'hero-fallback'}
                  src={featuredPost?.coverImage}
                  hero
                />
              </div>
            </div>
            <div className="portal-hero-caption">
              <span>INFORMAÇÃO, EDUCAÇÃO E COMUNIDADE</span>
              {featuredPosts.length > 1 ? (
                <div className="portal-slider-controls" aria-label="Selecionar destaque">
                  <button
                    type="button"
                    aria-label="Destaque anterior"
                    onClick={() =>
                      setFeaturedIndex(
                        (currentFeaturedIndex + featuredPosts.length - 1) % featuredPosts.length,
                      )
                    }
                  >
                    ←
                  </button>
                  <div className="portal-slider-dots">
                    {featuredPosts.map((post, index) => (
                      <button
                        key={post.id}
                        type="button"
                        aria-label={`Ir para destaque ${index + 1}`}
                        aria-pressed={currentFeaturedIndex === index}
                        onClick={() => setFeaturedIndex(index)}
                      />
                    ))}
                  </div>
                  <span className="portal-slide-count">
                    {String(currentFeaturedIndex + 1).padStart(2, '0')} /{' '}
                    {String(featuredPosts.length).padStart(2, '0')}
                  </span>
                  <button
                    type="button"
                    aria-label="Próximo destaque"
                    onClick={() =>
                      setFeaturedIndex((currentFeaturedIndex + 1) % featuredPosts.length)
                    }
                  >
                    →
                  </button>
                </div>
              ) : (
                <span className="portal-caption-detail">NOSSO ESPAÇO. NOSSAS HISTÓRIAS.</span>
              )}
            </div>
          </div>
        </section>

        <section className="portal-quick-section" aria-label="Acessos rápidos">
          <div className="portal-container portal-quick-grid">
            <a href="#noticias" className="portal-quick-link">
              <PortalIcon name="news" />
              <span>
                <strong>Notícias da escola</strong>
                <small>Acompanhe o que acontece</small>
              </span>
              <span aria-hidden="true">
                <PortalIcon name="arrow" />
              </span>
            </a>
            <a href="#sobre" className="portal-quick-link">
              <PortalIcon name="community" />
              <span>
                <strong>Nossa comunidade</strong>
                <small>Conheça o Portal 138</small>
              </span>
              <span aria-hidden="true">
                <PortalIcon name="arrow" />
              </span>
            </a>
          </div>
        </section>

        <section id="noticias" className="portal-news-section portal-container">
          <div className="portal-section-heading">
            <div>
              <h2>
                Últimas notícias<span aria-hidden="true"></span>
              </h2>
            </div>
          </div>
          <div className="portal-news-tools">
            <label className="portal-search-field" htmlFor="portal-search">
              <span className="sr-only">Pesquisar notícias</span>
              <PortalIcon name="search" />
              <input
                id="portal-search"
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder="O que você procura?"
              />
            </label>
            <label className="portal-category-field">
              Categoria
              <select
                value={categoryId}
                onChange={(event) => {
                  setCategoryId(event.target.value)
                  setPage(1)
                }}
              >
                <option value="">Todas as categorias</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            {(search || categoryId) && (
              <button
                type="button"
                className="portal-clear"
                onClick={() => {
                  setSearch('')
                  setCategoryId('')
                  setPage(1)
                }}
              >
                Limpar filtros <span aria-hidden="true">×</span>
              </button>
            )}
          </div>
          {categoriesError && (
            <p className="portal-helper">
              Categorias indisponíveis no momento. A busca continua disponível.
            </p>
          )}
          <p role="status" className="portal-results-count">
            {loading
              ? 'Carregando notícias…'
              : error
                ? 'Notícias indisponíveis'
                : `${pagination.total} notícia(s) encontrada(s)`}
          </p>
          <div aria-busy={loading}>
            {loading ? (
              <div className="portal-news-grid" aria-label="Carregando notícias">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="portal-news-skeleton">
                    <div />
                    <span />
                    <span />
                    <span />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="portal-state">
                <PortalIcon name="news" />
                <h3>Não foi possível carregar as notícias.</h3>
                <p>{error}</p>
                <button
                  type="button"
                  className="portal-button"
                  onClick={() => setRetry((value) => value + 1)}
                >
                  Tentar novamente
                </button>
              </div>
            ) : posts.length === 0 ? (
              <div className="portal-state">
                <PortalIcon name={search || categoryId ? 'search' : 'news'} />
                <h3>
                  {search || categoryId
                    ? 'Nenhuma notícia encontrada'
                    : 'Em breve, novas histórias'}
                </h3>
                <p>
                  {search || categoryId
                    ? 'Tente pesquisar usando outras palavras.'
                    : 'Ainda não há notícias publicadas. Assim que houver novidades, elas aparecerão aqui.'}
                </p>
              </div>
            ) : (
              <div className="portal-news-grid">
                {posts.map((post) => (
                  <article key={post.id} id={`noticia-${post.id}`} className="portal-news-card">
                    <a
                      href={articleLink(post)}
                      tabIndex={-1}
                      aria-hidden="true"
                      className="portal-card-cover"
                    >
                      <NewsImage key={post.coverImage || 'fallback'} src={post.coverImage} />
                    </a>
                    <div className="portal-card-body">
                      <p className="portal-card-category">{post.category?.name || 'Notícia'}</p>
                      <time dateTime={post.publishedAt || post.createdAt || undefined}>
                        {formatDate(post.publishedAt || post.createdAt)}
                      </time>
                      <h3>
                        <a href={articleLink(post)}>{post.title}</a>
                      </h3>
                      <p className="portal-card-excerpt">{post.excerpt || post.content}</p>
                      <a href={articleLink(post)} className="portal-card-read">
                        Ler notícia completa →
                      </a>
                      {post.author?.name && (
                        <p className="portal-card-author">
                          Por <strong>{post.author.name}</strong>
                        </p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
          {!loading && !error && pagination.totalPages > 1 && (
            <nav aria-label="Paginação das notícias" className="portal-pagination">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Anterior
              </button>
              <span>
                Página {page} de {pagination.totalPages}
              </span>
              <button
                type="button"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                Próxima
              </button>
            </nav>
          )}
        </section>

        <section id="sobre" className="portal-about-section portal-container">
          <div className="portal-about-mark" aria-hidden="true">
            <span>138</span>
            <small>SESI SANTO ANASTÁCIO</small>
          </div>
          <div className="portal-about-copy">
            <p className="portal-eyebrow">SOBRE O PORTAL</p>
            <h2>Um projeto de estudante, feito para a escola.</h2>
            <p>
              O SESI - Portal 138 foi criado e desenvolvido por <strong>Lasso, estudante do SENAI</strong>,
              para reunir notícias, projetos e acontecimentos da comunidade escolar do SESI 138.
              Uma forma de colocar o aprendizado em prática e dar espaço às histórias de quem
              faz a escola acontecer.
            </p>
            <div className="portal-about-technologies">
              <h3>Tecnologias utilizadas</h3>
              <ul aria-label="Tecnologias utilizadas no Portal 138">
                {['React', 'Vite', 'Tailwind CSS', 'Node.js', 'Express', 'Prisma', 'PostgreSQL'].map(
                  (technology) => <li key={technology}>{technology}</li>,
                )}
              </ul>
            </div>
          </div>
        </section>
      </main>
      <PortalFooter />
      {showScrollTop && (
        <button
          type="button"
          className="portal-scroll-top"
          aria-label="Voltar ao topo"
          title="Voltar ao topo"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          ↑
        </button>
      )}
    </div>
  )
}

export default App
