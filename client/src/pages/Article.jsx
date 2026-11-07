import { useEffect, useRef, useState } from 'react'
import Comments from '../components/news/Comments.jsx'
import ArticleContent from '../components/news/ArticleContent.jsx'
import { PortalHeader, PortalFooter } from '../components/layout/PortalChrome.jsx'
import './Article.css'

export default function Article({ slug, session, sessionNotice, onLogin, onLogout, onProfile, onAdmin }) {
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
    <div className="portal-article-page">
      <PortalHeader session={session} onLogin={onLogin} onLogout={onLogout} onProfile={onProfile} onAdmin={onAdmin} active="news" />
      {sessionNotice}
      <nav aria-label="Navegação estrutural" className="portal-article-breadcrumb">
        <div>
          <a href="#inicio">Início</a>
          <span aria-hidden="true">/</span>
          <a href="#noticias">← Todas as notícias</a>
        </div>
      </nav>
      <main id="conteudo" className="portal-article-main">
        {loading ? <div className="portal-article-state"><p role="status">Carregando notícia…</p></div> : notFound || error ? (
          <div className="portal-article-state portal-article-state--error">
            <p className="portal-content-eyebrow">Portal 138 · Notícias</p>
            <h1 ref={heading} tabIndex={-1}>{notFound ? 'Notícia não encontrada' : 'Não foi possível abrir a notícia'}</h1>
            <p role={error ? 'alert' : undefined}>{notFound ? 'Esta notícia não está disponível. Confira as outras publicações do portal.' : error}</p>
            <div className="portal-article-state-actions">
              {error && <button type="button" onClick={() => setRetry((value) => value + 1)} className="portal-article-button">Tentar novamente</button>}
              <a href="#noticias" className="portal-article-back">Voltar às notícias <span aria-hidden="true">→</span></a>
            </div>
          </div>
        ) : post && (
          <>
            <ArticleContent post={post} headingRef={heading} />
            <section aria-label="Participe da conversa" className="portal-article-conversation">
              <div className="portal-article-conversation-intro">
                <div>
                  <p className="portal-content-eyebrow">Comunidade</p>
                  <p>Sua opinião faz parte desta história.</p>
                </div>
                {!session && <button type="button" onClick={onLogin} className="portal-article-button">Entrar para comentar <span aria-hidden="true">→</span></button>}
              </div>
              <Comments key={post.id} postId={post.id} session={session} />
            </section>
          </>
        )}
      </main>
      <PortalFooter />
    </div>
  )
}
