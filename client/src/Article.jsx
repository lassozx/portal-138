import { useEffect, useRef, useState } from 'react'
import Comments from './Comments.jsx'

export default function Article({ slug, session, onLogin }) {
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [retry, setRetry] = useState(0)
  const heading = useRef(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setPost(null)
    setNotFound(false)
    async function load() {
      try {
        const response = await fetch(`/api/posts/${encodeURIComponent(slug)}`, { signal: controller.signal })
        if (response.status === 404) {
          if (!controller.signal.aborted) setNotFound(true)
          return
        }
        if (!response.ok) throw new Error('Não foi possível carregar esta notícia. Tente novamente.')
        const result = await response.json()
        if (!controller.signal.aborted) setPost(result)
      } catch (err) {
        if (!controller.signal.aborted) setError('Não foi possível carregar esta notícia. Verifique sua conexão e tente novamente.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    load()
    return () => controller.abort()
  }, [slug, retry])

  useEffect(() => {
    const previousTitle = document.title
    document.title = post ? `${post.title} | Portal 138` : 'Notícia | Portal 138'
    return () => { document.title = previousTitle }
  }, [post])

  useEffect(() => {
    if (!loading) heading.current?.focus()
  }, [loading])

  const publishedAt = post?.publishedAt || post?.createdAt
  const date = publishedAt ? new Date(publishedAt) : null
  const validDate = date && !Number.isNaN(date.getTime())

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-5 py-5">
          <a href="#inicio" aria-label="Portal 138 — Início" className="text-xl font-black">Portal <span className="text-red-700">138</span></a>
          <a href="#noticias" className="rounded-lg px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50">← Todas as notícias</a>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-5 py-10 sm:py-16">
        {loading ? <p role="status" className="py-16 text-slate-500">Carregando notícia…</p> : notFound || error ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-8">
            <h1 ref={heading} tabIndex={-1} className="focus:outline-none text-2xl font-black">{notFound ? 'Notícia não encontrada' : 'Não foi possível abrir a notícia'}</h1>
            <p role={error ? 'alert' : undefined} className="mt-4 leading-7 text-slate-600">{notFound ? 'Esta notícia não está disponível. Confira as outras publicações do portal.' : error}</p>
            {error && <button onClick={() => setRetry((value) => value + 1)} className="mt-5 rounded-lg bg-red-700 px-5 py-3 font-bold text-white">Tentar novamente</button>}
            <a href="#noticias" className="mt-5 block font-bold text-red-700 hover:underline">Voltar às notícias</a>
          </div>
        ) : post && (
          <>
            <article>
              <p className="text-sm font-bold uppercase tracking-widest text-red-700">{post.category?.name || 'Notícias'}</p>
              <h1 ref={heading} tabIndex={-1} className="focus:outline-none mt-4 break-words text-3xl font-black leading-tight tracking-tight sm:text-5xl">{post.title}</h1>
              {post.excerpt && <p className="mt-5 text-lg leading-8 text-slate-600 sm:text-xl">{post.excerpt}</p>}
              <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 border-b border-slate-200 pb-6 text-sm text-slate-500">
                <span>Por <span className="font-semibold text-slate-700">{post.author?.name || 'Redação Portal 138'}</span></span>
                {validDate && <time dateTime={publishedAt}>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(date)}</time>}
              </div>
              {post.coverImage && <img src={post.coverImage} alt="" fetchPriority="high" className="mt-8 max-h-[32rem] w-full rounded-2xl object-contain" />}
              <div className="mx-auto mt-8 max-w-prose whitespace-pre-wrap break-words text-lg leading-9 text-slate-800">{post.content}</div>
            </article>
            <section aria-label="Participe da conversa" className="mx-auto mt-12 max-w-prose">
              {!session && <button onClick={onLogin} className="rounded-lg bg-red-700 px-5 py-3 font-bold text-white hover:bg-red-800">Entrar para comentar</button>}
              <Comments key={post.id} postId={post.id} session={session} />
            </section>
          </>
        )}
      </main>
      <footer className="border-t border-slate-200 px-5 py-6 text-center text-sm text-slate-500">Portal 138 · Notícias e comunidade escolar</footer>
    </div>
  )
}
