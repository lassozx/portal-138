import { useCallback, useEffect, useState } from 'react'

const COMMENTS_PER_PAGE = 10

function Comments({ postId, session }) {
  const [comments, setComments] = useState([])
  const [pagination, setPagination] = useState({
    page: 1,
    limit: COMMENTS_PER_PAGE,
    total: 0,
    totalPages: 0,
  })
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const token = session?.token
  const currentUser = session?.user

  const loadComments = useCallback(async (page = 1, append = false) => {
    try {
      if (append) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }

      setError('')

      const response = await fetch(
        `/api/comments/post/${encodeURIComponent(postId)}?page=${page}`,
      )
      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          result.message || 'Não foi possível carregar os comentários.',
        )
      }

      if (!Array.isArray(result.comments) || !result.pagination) {
        throw new Error('A resposta da API de comentários é inválida.')
      }

      setComments((previous) => {
        if (!append) {
          return result.comments
        }

        const existingIds = new Set(previous.map((comment) => comment.id))
        const newComments = result.comments.filter(
          (comment) => !existingIds.has(comment.id),
        )

        return [...previous, ...newComments]
      })

      setPagination(result.pagination)
    } catch (err) {
      setError(err.message || 'Erro ao carregar os comentários.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [postId])

  useEffect(() => {
    setComments([])
    setPagination({
      page: 1,
      limit: COMMENTS_PER_PAGE,
      total: 0,
      totalPages: 0,
    })
    loadComments(1)
  }, [loadComments])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setMessage('')

    const trimmedContent = content.trim()

    if (!trimmedContent) {
      setError('O comentário não pode estar vazio.')
      return
    }

    if (trimmedContent.length > 2000) {
      setError('O comentário deve ter no máximo 2000 caracteres.')
      return
    }

    if (!token) {
      setError('Entre na sua conta para publicar um comentário.')
      return
    }

    try {
      setSubmitting(true)

      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: trimmedContent,
          postId,
        }),
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          result.message || 'Não foi possível publicar o comentário.',
        )
      }

      setContent('')

      // Recarrega a primeira página para manter a ordem mais recente.
      await loadComments(1)

      setMessage('Comentário publicado com sucesso.')
    } catch (err) {
      setError(err.message || 'Erro ao publicar o comentário.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLoadMore() {
    if (loadingMore || loading || pagination.page >= pagination.totalPages) {
      return
    }

    await loadComments(pagination.page + 1, true)
  }

  async function handleDelete(commentId) {
    setError('')
    setMessage('')

    try {
      setDeletingId(commentId)

      const response = await fetch(
        `/api/comments/${encodeURIComponent(commentId)}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          result.message || 'Não foi possível excluir o comentário.',
        )
      }

      await loadComments(1)
      setMessage('Comentário excluído com sucesso.')
    } catch (err) {
      setError(err.message || 'Erro ao excluir o comentário.')
    } finally {
      setDeletingId(null)
    }
  }

  function formatDate(date) {
    if (!date) return ''

    const parsedDate = new Date(date)

    if (Number.isNaN(parsedDate.getTime())) return ''

    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(parsedDate)
  }

  return (
    <section
      aria-label="Comentários"
      className="portal-comments"
    >
      <h2 className="portal-comments-title">
        Comentários ({pagination.total})
      </h2>

      {error && (
        <p
          role="alert"
          className="portal-comments-notice portal-comments-notice--error"
        >
          {error}
        </p>
      )}

      {message && (
        <p
          role="status"
          className="portal-comments-notice portal-comments-notice--success"
        >
          {message}
        </p>
      )}

      {token ? (
        <form onSubmit={handleSubmit} className="portal-comments-form">
          <label
            htmlFor={`comment-content-${postId}`}
            className="portal-comments-label"
          >
            Escreva um comentário
          </label>

          <textarea
            id={`comment-content-${postId}`}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Compartilhe sua opinião..."
            className="portal-comments-input"
          />

          <div className="portal-comments-form-actions">
            <span className="portal-comments-counter">
              {content.length}/2000 caracteres
            </span>

            <button
              type="submit"
              disabled={submitting}
              className="portal-article-button"
            >
              {submitting ? 'Publicando...' : 'Publicar comentário'}
            </button>
          </div>
        </form>
      ) : (
        <p className="portal-comments-signin">
          Entre na sua conta para publicar comentários.
        </p>
      )}

      <div className="portal-comments-list">
        {loading ? (
          <p className="portal-comments-empty">
            Carregando comentários...
          </p>
        ) : comments.length === 0 ? (
          !error && (
            <p className="portal-comments-empty">
              Ainda não há comentários. Seja o primeiro a comentar.
            </p>
          )
        ) : (
          comments.map((comment) => {
            const canDelete =
              token &&
              (currentUser?.role === 'ADMIN' ||
                currentUser?.id === comment.author?.id)

            return (
              <article
                key={comment.id}
                className="portal-comments-item"
              >
                <div className="portal-comments-item-heading">
                  <div className="portal-comments-person">
                    <span className="portal-comments-avatar" aria-hidden="true">{(comment.author?.name || 'C').charAt(0).toUpperCase()}</span>
                    <div>
                      <p className="portal-comments-author">
                        {comment.author?.name || 'Usuário'}
                      </p>

                      {comment.createdAt && (
                        <time
                          dateTime={comment.createdAt}
                          className="portal-comments-time"
                        >
                          {formatDate(comment.createdAt)}
                        </time>
                      )}
                    </div>
                  </div>

                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => handleDelete(comment.id)}
                      disabled={deletingId === comment.id}
                      className="portal-comments-delete"
                      aria-label={`Excluir comentário de ${comment.author?.name || 'Usuário'}`}
                    >
                      {deletingId === comment.id
                        ? 'Excluindo...'
                        : 'Excluir'}
                    </button>
                  )}
                </div>

                <p className="portal-comments-text">
                  {comment.content}
                </p>
              </article>
            )
          })
        )}
      </div>

      {!loading && pagination.page < pagination.totalPages && (
        <div className="portal-comments-more">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="portal-article-button portal-article-button--outline"
          >
            {loadingMore ? 'Carregando...' : 'Carregar mais comentários'}
          </button>
        </div>
      )}
    </section>
  )
}

export default Comments
