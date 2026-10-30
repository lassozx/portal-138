import { useEffect, useRef, useState } from 'react'
import Comments from './Comments.jsx'
import ArticleContent from './ArticleContent.jsx'

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
            <ArticleContent post={post} headingRef={heading} />
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
