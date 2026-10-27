import { useCallback, useEffect, useState } from 'react'

function Comments({ postId, session }) {
  const [comments, setComments] = useState([])
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const token = session?.token
  const currentUser = session?.user

  const loadComments = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      const response = await fetch(
        `/api/comments/post/${encodeURIComponent(postId)}`,
      )
      const result = await response.json().catch(() => [])

      if (!response.ok) {
        throw new Error(
          result.message || 'Não foi possível carregar os comentários.',
        )
      }

      setComments(Array.isArray(result) ? result : [])
    } catch (err) {
      setError(err.message || 'Erro ao carregar os comentários.')
    } finally {
      setLoading(false)
    }
  }, [postId])

  useEffect(() => {
    loadComments()
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
      setError('Entre no painel para publicar um comentário.')
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
        throw new Error(result.message || 'Não foi possível publicar o comentário.')
      }

      if (result.comment) {
        setComments((previous) => [
          result.comment,
          ...previous.filter((item) => item.id !== result.comment.id),
        ])
      } else {
        await loadComments()
      }

      setContent('')
      setMessage('Comentário publicado com sucesso.')
    } catch (err) {
      setError(err.message || 'Erro ao publicar o comentário.')
    } finally {
      setSubmitting(false)
    }
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
        throw new Error(result.message || 'Não foi possível excluir o comentário.')
      }

      setComments((previous) =>
        previous.filter((comment) => comment.id !== commentId),
      )
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
      className="mt-5 border-t border-slate-100 pt-5"
    >
      <h4 className="text-base font-bold text-slate-900">
        Comentários ({comments.length})
      </h4>

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {message && (
        <p role="status" className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-700">
          {message}
        </p>
      )}

      {token ? (
        <form onSubmit={handleSubmit} className="mt-4">
          <label
            htmlFor={`comment-content-${postId}`}
            className="mb-2 block text-sm font-semibold text-slate-700"
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
            className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
          />

          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              {content.length}/2000 caracteres
            </span>

            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Publicando...' : 'Publicar comentário'}
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-3 text-sm text-slate-600">
          Entre no painel para publicar comentários.
        </p>
      )}

      <div className="mt-5 space-y-4">
        {loading ? (
          <p className="text-sm text-slate-500">Carregando comentários...</p>
        ) : comments.length === 0 ? (
          !error && (
            <p className="text-sm text-slate-500">
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
                className="rounded-xl bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {comment.author?.name || 'Usuário'}
                    </p>
                    {comment.createdAt && (
                      <time
                        dateTime={comment.createdAt}
                        className="mt-1 block text-xs text-slate-500"
                      >
                        {formatDate(comment.createdAt)}
                      </time>
                    )}
                  </div>

                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => handleDelete(comment.id)}
                      disabled={deletingId === comment.id}
                      className="text-xs font-semibold text-red-700 hover:text-red-900 disabled:opacity-50"
                      aria-label={`Excluir comentário de ${comment.author?.name || 'Usuário'}`}
                    >
                      {deletingId === comment.id ? 'Excluindo...' : 'Excluir'}
                    </button>
                  )}
                </div>

                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                  {comment.content}
                </p>
              </article>
            )
          })
        )}
      </div>
    </section>
  )
}

export default Comments
