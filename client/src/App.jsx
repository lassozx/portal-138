import { useEffect, useState } from 'react'
import Login from './Login.jsx'
import AdminPanel from './AdminPanel.jsx'
import Comments from './Comments.jsx'

function App() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [view, setView] = useState('public')
  const [session, setSession] = useState(null)
  const [selectedPostId, setSelectedPostId] = useState(null)

  useEffect(() => {
    async function loadPosts() {
      try {
        setLoading(true)
        setError('')

        const response = await fetch('/api/posts?limit=12')

        if (!response.ok) {
          throw new Error('Não foi possível carregar as notícias.')
        }

        const result = await response.json()
        setPosts(Array.isArray(result.data) ? result.data : [])
      } catch (err) {
        setError(err.message || 'Erro ao conectar com o servidor.')
      } finally {
        setLoading(false)
      }
    }

    loadPosts()
  }, [])

  const filteredPosts = posts.filter((post) => {
    const term = search.trim().toLowerCase()

    if (!term) return true

    return (
      post.title?.toLowerCase().includes(term) ||
      post.excerpt?.toLowerCase().includes(term) ||
      post.category?.name?.toLowerCase().includes(term)
    )
  })

  const featuredPost = filteredPosts[0]
  const remainingPosts = filteredPosts.slice(1)

  function formatDate(date) {
    if (!date) return 'Data não informada'

    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(date))
  }

  if (view === 'login') {
    return (
      <Login
        onLogin={(newSession) => {
          setSession(newSession)
          setView('admin')
        }}
        onBack={() => setView('public')}
      />
    )
  }

  if (view === 'admin' && session) {
    return (
      <AdminPanel
        token={session.token}
        user={session.user}
        onLogout={() => {
          setSession(null)
          setView('public')
        }}
        onBack={() => setView('public')}
      />
    )
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Barra superior */}
      <div className="bg-red-700 px-4 py-2 text-center text-sm font-medium text-white">
        Portal 138 · Informação, educação e comunidade
      </div>

      {/* Cabeçalho */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 md:px-8">
          <a href="#" className="flex items-center gap-3" aria-label="Portal 138 - Início">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-700 text-xl font-black text-white shadow-sm">
              138
            </div>

            <div>
              <h1 className="text-xl font-black tracking-tight">
                Portal <span className="text-red-700">138</span>
              </h1>
              <p className="hidden text-xs text-slate-500 sm:block">
                Notícias da comunidade escolar
              </p>
            </div>
          </a>

          <nav className="hidden items-center gap-7 text-sm font-semibold md:flex">
            <a href="#inicio" className="transition hover:text-red-700">
              Início
            </a>
            <a href="#noticias" className="transition hover:text-red-700">
              Notícias
            </a>
            <a href="#projetos" className="transition hover:text-red-700">
              Projetos
            </a>
            <a href="#sobre" className="transition hover:text-red-700">
              Sobre
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setView(session ? 'admin' : 'login')}
              className="rounded-lg border border-red-700 px-3 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-50 sm:px-4"
            >
              {session ? 'Painel' : 'Entrar'}
            </button>
            <a
              href="#noticias"
              className="rounded-lg bg-red-700 px-3 py-2.5 text-sm font-bold text-white transition hover:bg-red-800 sm:px-4"
            >
              Explorar
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* Destaque principal */}
        <section id="inicio" className="overflow-hidden bg-red-50">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 md:grid-cols-2 md:px-8 md:py-24">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-red-700">
                <span className="h-2 w-2 rounded-full bg-red-600" />
                Nosso espaço, nossas histórias
              </span>

              <h2 className="mt-6 max-w-xl text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                A vida escolar em{' '}
                <span className="text-red-700">destaque.</span>
              </h2>

              <p className="mt-5 max-w-lg text-base leading-7 text-slate-600 md:text-lg">
                Acompanhe notícias, projetos, atividades e acontecimentos
                que fazem parte da comunidade do SESI 138.
              </p>

              <a
                href="#noticias"
                className="mt-8 inline-flex items-center gap-2 rounded-xl bg-red-700 px-6 py-3.5 font-bold text-white shadow-lg shadow-red-700/20 transition hover:-translate-y-0.5 hover:bg-red-800"
              >
                Ver últimas notícias
                <span aria-hidden="true">→</span>
              </a>

              <div className="mt-8 flex items-center gap-3 text-sm text-slate-500">
                <span className="h-1 w-8 rounded-full bg-red-700" />
                Informação que aproxima nossa comunidade
              </div>
            </div>

            <div className="relative">
              <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-red-200/70 blur-2xl" />
              <div className="absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-red-300/40 blur-2xl" />

              <div className="relative rounded-3xl border border-red-100 bg-white p-6 shadow-xl shadow-red-900/5 sm:p-9">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-500">
                    COMUNIDADE SESI 138
                  </span>
                  <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                    Portal oficial da comunidade
                  </span>
                </div>

                <div className="mt-8 flex aspect-[5/3] flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-red-700 via-red-600 to-red-500 text-white">
                  <span className="text-7xl font-black tracking-tighter sm:text-8xl">
                    138
                  </span>
                  <span className="mt-2 text-sm font-semibold tracking-[0.25em]">
                    PORTAL
                  </span>
                  <div className="mt-5 h-1 w-16 rounded-full bg-white/80" />
                </div>

                <div className="mt-6 grid grid-cols-3 gap-3">
                  {[
                    ['Notícias', 'Informação'],
                    ['Projetos', 'Criatividade'],
                    ['Escola', 'Comunidade'],
                  ].map(([title, subtitle]) => (
                    <div
                      key={title}
                      className="rounded-xl bg-slate-50 p-3 text-center"
                    >
                      <p className="text-sm font-bold">{title}</p>
                      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Notícias */}
        <section id="noticias" className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-20">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-red-700">
                Fique por dentro
              </p>

              <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                Últimas notícias
              </h2>

              <p className="mt-3 max-w-xl leading-7 text-slate-500">
                Confira as novidades e os acontecimentos da nossa comunidade.
              </p>
            </div>

            <label className="w-full sm:max-w-xs">
              <span className="sr-only">Pesquisar notícias</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Pesquisar notícias..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
              />
            </label>
          </div>

          <div className="mt-10">
            {loading ? (
              <div className="grid gap-6 md:grid-cols-3">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="animate-pulse overflow-hidden rounded-2xl border border-slate-100"
                  >
                    <div className="h-48 bg-slate-100" />
                    <div className="space-y-3 p-5">
                      <div className="h-4 w-1/3 rounded bg-slate-100" />
                      <div className="h-6 rounded bg-slate-100" />
                      <div className="h-4 rounded bg-slate-100" />
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center">
                <p className="font-bold text-red-800">
                  Não foi possível carregar as notícias.
                </p>
                <p className="mt-2 text-sm text-red-700">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-5 rounded-lg bg-red-700 px-5 py-2.5 font-bold text-white hover:bg-red-800"
                >
                  Tentar novamente
                </button>
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-red-200 bg-red-50/50 px-6 py-14 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 text-3xl">
                  {search ? '⌕' : '📰'}
                </div>

                <h3 className="mt-5 text-xl font-black">
                  {search
                    ? 'Nenhuma notícia encontrada'
                    : 'Em breve, novas histórias'}
                </h3>

                <p className="mx-auto mt-3 max-w-md leading-7 text-slate-600">
                  {search
                    ? 'Tente pesquisar usando outras palavras.'
                    : 'Ainda não há notícias publicadas. Assim que houver novidades, elas aparecerão aqui.'}
                </p>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredPosts.map((post) => (
                  <article
                    key={post.id}
                    className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition duration-300 hover:-translate-y-1 hover:border-red-200 hover:shadow-xl hover:shadow-red-900/5"
                  >
                    {post.coverImage ? (
                      <img
                        src={post.coverImage}
                        alt=""
                        loading="lazy"
                        className="h-52 w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="flex h-52 items-center justify-center bg-gradient-to-br from-red-100 to-red-50">
                        <span className="text-5xl font-black text-red-700/70">
                          138
                        </span>
                      </div>
                    )}

                    <div className="p-6">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                        <span className="rounded-full bg-red-100 px-3 py-1 text-red-700">
                          {post.category?.name || 'Notícia'}
                        </span>
                        <span className="text-slate-400">
                          {formatDate(post.publishedAt || post.createdAt)}
                        </span>
                      </div>

                      <h3 className="mt-4 text-xl font-black leading-snug transition group-hover:text-red-700">
                        {post.title}
                      </h3>

                      <p className="mt-3 line-clamp-3 leading-7 text-slate-600">
                        {post.excerpt || post.content}
                      </p>

                      {post.author?.name && (
                        <p className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-500">
                          Por <span className="font-semibold text-slate-700">{post.author.name}</span>
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          setSelectedPostId((currentId) =>
                            currentId === post.id ? null : post.id,
                          )
                        }
                        aria-expanded={selectedPostId === post.id}
                        className="mt-5 rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50"
                      >
                        {selectedPostId === post.id
                          ? 'Ocultar comentários'
                          : 'Ver comentários'}
                      </button>

                      {selectedPostId === post.id && (
                        <Comments postId={post.id} session={session} />
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Projetos */}
        <section id="projetos" className="bg-slate-50">
          <div className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-20">
            <div className="max-w-2xl">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-red-700">
                Além da sala de aula
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                Ideias que ganham vida.
              </h2>
              <p className="mt-4 leading-7 text-slate-600">
                Um espaço para valorizar projetos, iniciativas, atividades e
                talentos que fazem parte do dia a dia escolar.
              </p>
            </div>

            <div className="mt-9 grid gap-5 sm:grid-cols-3">
              {[
                {
                  number: '01',
                  title: 'Projetos escolares',
                  text: 'Conheça iniciativas e trabalhos desenvolvidos pelos estudantes.',
                },
                {
                  number: '02',
                  title: 'Eventos e atividades',
                  text: 'Acompanhe os acontecimentos e as experiências da comunidade.',
                },
                {
                  number: '03',
                  title: 'Ideias e criatividade',
                  text: 'Dê visibilidade às ideias que transformam o ambiente escolar.',
                },
              ].map((item) => (
                <article
                  key={item.number}
                  className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-red-200 hover:shadow-lg"
                >
                  <span className="text-sm font-black tracking-widest text-red-700">
                    {item.number}
                  </span>
                  <h3 className="mt-4 text-lg font-black">{item.title}</h3>
                  <p className="mt-2 leading-7 text-slate-600">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Sobre */}
        <section id="sobre" className="mx-auto max-w-7xl px-5 py-16 md:px-8">
          <div className="rounded-3xl bg-red-700 px-6 py-10 text-white sm:px-10 md:flex md:items-center md:justify-between md:gap-10 md:py-12">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-red-100">
                Nossa comunidade
              </p>
              <h2 className="mt-3 text-3xl font-black">
                Este espaço também é seu.
              </h2>
              <p className="mt-3 max-w-2xl leading-7 text-red-100">
                O Portal 138 reúne notícias, projetos e acontecimentos
                relacionados à comunidade escolar do SESI 138.
              </p>
            </div>

            <a
              href="#inicio"
              className="mt-7 inline-flex shrink-0 rounded-xl bg-white px-5 py-3 font-bold text-red-700 transition hover:bg-red-50 md:mt-0"
            >
              Voltar ao início ↑
            </a>
          </div>
        </section>
      </main>

      {/* Rodapé */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-7 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between md:px-8">
          <p>
            <span className="font-black text-slate-900">Portal 138</span>
            {' '}· Notícias e comunidade escolar
          </p>
          <p>Feito para valorizar as histórias da nossa comunidade.</p>
        </div>
      </footer>
    </div>
  )
}

export default App