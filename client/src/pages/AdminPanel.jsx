import { useCallback, useEffect, useRef, useState } from 'react'
import ArticleContent from '../components/news/ArticleContent.jsx'
import CoverImageInput from '../components/admin/CoverImageInput.jsx'
import UserManagement from '../components/admin/UserManagement.jsx'

const EMPTY_POST = {
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  coverImage: '',
  categoryId: '',
  status: 'DRAFT',
}

const EMPTY_CATEGORY = {
  name: '',
  slug: '',
  description: '',
}

const inputClass =
  'mt-1 min-w-0 max-w-full w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-red-700 focus:ring-2 focus:ring-red-100'

const labelClass = 'block text-sm font-semibold text-neutral-700'

async function apiRequest(path, token, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })

  const result = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(result.message || 'Não foi possível concluir a operação.')
  }

  return result
}

function AdminPanel({ token, user, onLogout, onBack }) {
  const [section, setSection] = useState('posts')
  const [previewing, setPreviewing] = useState(false)
  const [posts, setPosts] = useState([])
  const [postPage, setPostPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 })
  const [loadFailed, setLoadFailed] = useState(false)
  const loadRequest = useRef(0)
  const [categories, setCategories] = useState([])
  const [postForm, setPostForm] = useState(EMPTY_POST)
  const [categoryForm, setCategoryForm] = useState(EMPTY_CATEGORY)
  const [editingPost, setEditingPost] = useState(null)
  const [editingCategory, setEditingCategory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const isAdmin = user?.role === 'ADMIN'

  const loadData = useCallback(async () => {
    const request = ++loadRequest.current
    try {
      setLoading(true)
      setLoadFailed(false)
      setError('')

      const [postResult, categoryResult] = await Promise.all([
        apiRequest(`/api/admin/posts?limit=20&page=${postPage}`, token),
        apiRequest('/api/categories', token),
      ])

      if (request !== loadRequest.current) return
      const data = Array.isArray(postResult.data) ? postResult.data : []
      const resultPagination = postResult.pagination || { total: data.length, totalPages: data.length ? 1 : 0 }
      const lastPage = Math.max(1, resultPagination.totalPages)
      if (postPage > lastPage) {
        setPostPage(lastPage)
        return
      }
      setPosts(data)
      setPagination(resultPagination)
      setCategories(
        Array.isArray(categoryResult)
          ? categoryResult
          : Array.isArray(categoryResult.data)
            ? categoryResult.data
            : [],
      )
    } catch (err) {
      if (request !== loadRequest.current) return
      setPosts([])
      setLoadFailed(true)
      setError(err.message || 'Erro ao carregar os dados.')
    } finally {
      if (request === loadRequest.current) setLoading(false)
    }
  }, [token, postPage])

  useEffect(() => {
    loadData()
    return () => { loadRequest.current += 1 }
  }, [loadData])

  function updatePostField(event) {
    const { name, value } = event.target
    setPostForm((current) => ({ ...current, [name]: value }))
  }

  function updateCategoryField(event) {
    const { name, value } = event.target
    setCategoryForm((current) => ({ ...current, [name]: value }))
  }

  function editPost(post) {
    setPreviewing(false)
    setEditingPost(post.id)
    setPostForm({
      title: post.title || '',
      slug: post.slug || '',
      excerpt: post.excerpt || '',
      content: post.content || '',
      coverImage: post.coverImage || '',
      categoryId: post.categoryId || '',
      status: post.status || 'DRAFT',
    })
    setSection('posts')
    setNotice('')
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetPostForm() {
    setPreviewing(false)
    setEditingPost(null)
    setPostForm(EMPTY_POST)
  }

  async function savePost(event) {
    event.preventDefault()
    if (uploading) return

    try {
      setSaving(true)
      setError('')
      setNotice('')

      const payload = {
        title: postForm.title.trim(),
        slug: postForm.slug.trim(),
        excerpt: postForm.excerpt.trim() || null,
        content: postForm.content.trim(),
        coverImage: postForm.coverImage.trim() || null,
        categoryId: postForm.categoryId || null,
      }

      if (editingPost) {
        if (isAdmin) {
          payload.status = postForm.status
        }

        await apiRequest(`/api/posts/${editingPost}`, token, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })

        setNotice('Notícia atualizada com sucesso.')
      } else {
        await apiRequest('/api/posts', token, {
          method: 'POST',
          body: JSON.stringify(payload),
        })

        setNotice(
          isAdmin
            ? 'Notícia criada como rascunho. Você pode editá-la para publicar.'
            : 'Notícia criada como rascunho. Um administrador poderá publicá-la.',
        )
      }

      resetPostForm()
      await loadData()
    } catch (err) {
      setError(err.message || 'Erro ao salvar a notícia.')
    } finally {
      setSaving(false)
    }
  }

  async function deletePost(post) {
    if (!isAdmin) return

    const confirmed = window.confirm(
      `Deseja realmente excluir a notícia "${post.title}"? Esta ação não pode ser desfeita.`,
    )

    if (!confirmed) return

    try {
      setError('')
      setNotice('')

      await apiRequest(`/api/posts/${post.id}`, token, {
        method: 'DELETE',
      })

      setNotice('Notícia excluída com sucesso.')

      if (editingPost === post.id) resetPostForm()

      await loadData()
    } catch (err) {
      setError(err.message || 'Erro ao excluir a notícia.')
    }
  }

  function editCategory(category) {
    setEditingCategory(category.id)
    setCategoryForm({
      name: category.name || '',
      slug: category.slug || '',
      description: category.description || '',
    })
    setSection('categories')
    setNotice('')
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetCategoryForm() {
    setEditingCategory(null)
    setCategoryForm(EMPTY_CATEGORY)
  }

  async function saveCategory(event) {
    event.preventDefault()

    try {
      setSaving(true)
      setError('')
      setNotice('')

      const payload = {
        name: categoryForm.name.trim(),
        slug: categoryForm.slug.trim(),
        description: categoryForm.description.trim() || null,
      }

      if (editingCategory) {
        await apiRequest(`/api/categories/${editingCategory}`, token, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })

        setNotice('Categoria atualizada com sucesso.')
      } else {
        await apiRequest('/api/categories', token, {
          method: 'POST',
          body: JSON.stringify(payload),
        })

        setNotice('Categoria criada com sucesso.')
      }

      resetCategoryForm()
      await loadData()
    } catch (err) {
      setError(err.message || 'Erro ao salvar a categoria.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteCategory(category) {
    if (!isAdmin) return

    const confirmed = window.confirm(
      `Deseja excluir a categoria "${category.name}"?`,
    )

    if (!confirmed) return

    try {
      setError('')
      setNotice('')

      await apiRequest(`/api/categories/${category.id}`, token, {
        method: 'DELETE',
      })

      setNotice('Categoria excluída com sucesso.')
      await loadData()
    } catch (err) {
      setError(err.message || 'Erro ao excluir a categoria.')
    }
  }

  function makeSlug(value) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }

  function statusLabel(status) {
    if (status === 'PUBLISHED') return 'Publicado'
    if (status === 'ARCHIVED') return 'Arquivado'
    return 'Rascunho'
  }

  function statusClass(status) {
    if (status === 'PUBLISHED') {
      return 'bg-green-100 text-green-800'
    }

    if (status === 'ARCHIVED') {
      return 'bg-neutral-200 text-neutral-700'
    }

    return 'bg-amber-100 text-amber-800'
  }

  return (
    <div className="portal-internal min-h-screen bg-[#f5f5f5] text-neutral-900">
      <header className="border-b border-neutral-200 border-t-4 border-t-red-700 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 md:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-red-700">
              SESI - Portal 138
            </p>
            <h1 className="mt-1 text-2xl font-bold">
              Painel administrativo
            </h1>
            <p className="mt-1 text-sm text-neutral-600">
              Olá, {user?.name || 'usuário'} · {user?.role || 'USER'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onBack}
              className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-bold text-neutral-700 transition hover:bg-neutral-100"
            >
              Ver portal
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-md border border-red-700 bg-white px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 md:px-8">
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-lg border border-neutral-200 bg-white p-5">
            <p className="text-sm text-neutral-500">Total de notícias</p>
            <p className="mt-2 text-3xl font-bold">{pagination.total}</p>
            <p className="mt-1 text-xs text-neutral-500">Todos os status</p>
          </div>

          <div className="rounded-lg border border-green-200 bg-white p-5">
            <p className="text-sm text-neutral-500">Publicadas</p>
            <p className="mt-2 text-3xl font-bold text-green-700">
              {posts.filter((post) => post.status === 'PUBLISHED').length}
            </p>
            <p className="mt-1 text-xs text-neutral-500">Nesta página</p>
          </div>

          <div className="rounded-lg border border-amber-200 bg-white p-5">
            <p className="text-sm text-neutral-500">Rascunhos</p>
            <p className="mt-2 text-3xl font-bold text-amber-700">
              {posts.filter((post) => post.status === 'DRAFT').length}
            </p>
            <p className="mt-1 text-xs text-neutral-500">Nesta página</p>
          </div>

          <div className="rounded-lg border border-neutral-300 bg-white p-5">
            <p className="text-sm text-neutral-500">Arquivadas</p>
            <p className="mt-2 text-3xl font-bold text-neutral-700">
              {posts.filter((post) => post.status === 'ARCHIVED').length}
            </p>
            <p className="mt-1 text-xs text-neutral-500">Nesta página</p>
          </div>

          <div className="rounded-lg border border-red-200 bg-white p-5">
            <p className="text-sm text-neutral-500">Categorias</p>
            <p className="mt-2 text-3xl font-bold text-red-700">
              {categories.length}
            </p>
            <p className="mt-1 text-xs text-neutral-500">Nesta página</p>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setSection('posts')
              setError('')
              setNotice('')
            }}
            className={`rounded-lg px-5 py-3 text-sm font-bold ${
              section === 'posts'
                ? 'bg-red-700 text-white'
                : 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            Notícias
          </button>

          <button
            type="button"
            onClick={() => {
              setSection('categories')
              setError('')
              setNotice('')
            }}
            className={`rounded-lg px-5 py-3 text-sm font-bold ${
              section === 'categories'
                ? 'bg-red-700 text-white'
                : 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            Categorias
          </button>

          {isAdmin && (
            <button type="button" onClick={() => { setSection('users'); setError(''); setNotice('') }}
              className={`rounded-lg px-5 py-3 text-sm font-bold ${section === 'users' ? 'bg-red-700 text-white' : 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'}`}>
              Usuários
            </button>
          )}

          {section !== 'users' && <button
            type="button"
            onClick={loadData}
            className="ml-auto rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
          >
            Atualizar dados
          </button>}
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            {error}
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="mb-5 rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800"
          >
            {notice}
          </div>
        )}

        {section === 'users' && isAdmin && <UserManagement token={token} currentUser={user} />}

        {section === 'posts' && (
          <div className="grid min-w-0 grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
            <section className="min-w-0 rounded-lg border border-neutral-200 bg-white p-5 sm:p-6">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">Notícias</h2>
                  <p className="mt-1 text-sm text-neutral-500">
                    Gerencie publicações, rascunhos ou arquivos
                  </p>
                </div>
                <span className="shrink-0 rounded bg-neutral-100 px-3 py-1 text-sm font-bold">
                  {posts.length} de {pagination.total}
                </span>
              </div>

              {loading ? (
                <p className="py-8 text-sm text-neutral-500">
                  Carregando notícias...
                </p>
              ) : loadFailed ? (
                <button type="button" onClick={() => loadData()} className="rounded-md border border-red-700 px-4 py-2 text-sm font-bold text-red-700">Tentar novamente</button>
              ) : posts.length === 0 ? (
                <p className="rounded-md bg-neutral-50 p-5 text-sm text-neutral-600">
                  Nenhuma notícia encontrada.
                </p>
              ) : (
                <div className="space-y-3">
                  {posts.map((post) => (
                    <article
                      key={post.id}
                      className="rounded-md border border-neutral-200 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold [overflow-wrap:anywhere]">
                            {post.title}
                          </h3>
                          <p className="mt-1 break-all text-xs text-neutral-500">
                            /{post.slug}
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded px-2.5 py-1 text-xs font-bold ${statusClass(post.status)}`}
                            >
                              {statusLabel(post.status)}
                            </span>
                            {post.category?.name && (
                              <span className="max-w-full rounded bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600 [overflow-wrap:anywhere]">
                                {post.category.name}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={uploading || saving}
                          onClick={() => editPost(post)}
                          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-bold hover:bg-neutral-50"
                        >
                          Editar
                        </button>
                      </div>

                      {isAdmin && (
                        <button
                          type="button"
                          disabled={uploading || saving}
                          onClick={() => deletePost(post)}
                          className="mt-3 text-sm font-semibold text-red-700 hover:text-red-900"
                        >
                          Excluir notícia
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              )}
              {!loadFailed && pagination.totalPages > 1 && (
                <nav aria-label="Paginação administrativa" className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm">
                  <button type="button" disabled={loading || postPage <= 1} onClick={() => setPostPage((page) => page - 1)} className="rounded-md border border-neutral-300 px-3 py-2 font-bold disabled:opacity-40">Anterior</button>
                  <span role="status">Página {postPage} de {pagination.totalPages}</span>
                  <button type="button" disabled={loading || postPage >= pagination.totalPages} onClick={() => setPostPage((page) => page + 1)} className="rounded-md border border-neutral-300 px-3 py-2 font-bold disabled:opacity-40">Próxima</button>
                </nav>
              )}
            </section>

            <section className="min-w-0 rounded-lg border border-neutral-200 bg-white p-5 sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">
                    {editingPost ? 'Editar notícia' : 'Nova notícia'}
                  </h2>
                </div>

                {editingPost && (
                  <button
                    type="button"
                    disabled={uploading || saving}
                    onClick={resetPostForm}
                    className="text-sm font-bold text-neutral-500 hover:text-neutral-900"
                  >
                    Cancelar
                  </button>
                )}
              </div>

              <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Modo do editor">
                <button type="button" disabled={uploading} aria-pressed={!previewing} onClick={() => setPreviewing(false)} className={`rounded-lg px-4 py-2 text-sm font-bold ${!previewing ? 'bg-red-700 text-white' : 'border border-neutral-300 text-neutral-700'}`}>Escrever</button>
                <button type="button" disabled={uploading} aria-pressed={previewing} onClick={() => setPreviewing(true)} className={`rounded-lg px-4 py-2 text-sm font-bold ${previewing ? 'bg-red-700 text-white' : 'border border-neutral-300 text-neutral-700'}`}>Pré-visualizar notícia</button>
              </div>

              {previewing && (
                <section aria-label="Prévia da notícia" className="min-w-0">
                  <p className="mb-6 rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-900">Prévia das alterações atuais. Estas alterações ainda não foram salvas ou publicadas. Volte a Escrever para continuar ou salvar.</p>
                  <ArticleContent
                    compact
                    headingLevel="h3"
                    post={{
                      ...postForm,
                      title: postForm.title.trim() || 'Título da notícia',
                      content: postForm.content.trim() || 'O conteúdo da sua notícia aparecerá aqui.',
                      author: posts.find((post) => post.id === editingPost)?.author || user,
                      category: categories.find((category) => category.id === postForm.categoryId),
                    }}
                  />
                </section>
              )}

              <form hidden={previewing} onSubmit={savePost} className="min-w-0 space-y-4">
                <label className={labelClass}>
                  Título *
                  <input
                    className={inputClass}
                    name="title"
                    value={postForm.title}
                    onChange={(event) => {
                      updatePostField(event)
                      if (!editingPost) {
                        setPostForm((current) => ({
                          ...current,
                          title: event.target.value,
                          slug: makeSlug(event.target.value),
                        }))
                      }
                    }}
                    minLength={3}
                    maxLength={180}
                    required
                  />
                </label>

                <label className={labelClass}>
                  Slug / endereço *
                  <input
                    className={inputClass}
                    name="slug"
                    value={postForm.slug}
                    onChange={updatePostField}
                    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                    title="Use letras minúsculas, números e hífens."
                    required
                  />
                </label>

                <label className={labelClass}>
                  Resumo
                  <textarea
                    className={inputClass}
                    name="excerpt"
                    value={postForm.excerpt}
                    onChange={updatePostField}
                    rows={2}
                    maxLength={300}
                  />
                </label>

                <label className={labelClass}>
                  Conteúdo *
                  <textarea
                    className={inputClass}
                    name="content"
                    value={postForm.content}
                    onChange={updatePostField}
                    rows={7}
                    required
                  />
                </label>

                <CoverImageInput
                  token={token}
                  value={postForm.coverImage}
                  onChange={(coverImage) => setPostForm(current => ({ ...current, coverImage }))}
                  onBusyChange={setUploading}
                  disabled={saving || uploading}
                />

                <label className={labelClass}>
                  Categoria
                  <select
                    className={inputClass}
                    name="categoryId"
                    value={postForm.categoryId}
                    onChange={updatePostField}
                  >
                    <option value="">Sem categoria</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>

                {editingPost && isAdmin && (
                  <label className={labelClass}>
                    Status
                    <select
                      className={inputClass}
                      name="status"
                      value={postForm.status}
                     onChange={updatePostField}
               >
                <option value="DRAFT">Rascunho</option>
                <option value="PUBLISHED">Publicado</option>
                <option value="ARCHIVED">Arquivado</option>
              </select>
            </label>
          )}

                <button
                  type="submit"
                  disabled={saving || uploading}
                  className="w-full rounded-md bg-red-700 px-5 py-3 font-bold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {uploading
                    ? 'Enviando imagem...'
                    : saving
                    ? 'Salvando...'
                    : editingPost
                      ? 'Salvar alterações'
                      : 'Criar rascunho'}
                </button>
              </form>
            </section>
          </div>
        )}

        {section === 'categories' && (
          <div className="grid min-w-0 grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.7fr)]">
            <section className="min-w-0 rounded-lg border border-neutral-200 bg-white p-5 sm:p-6">
              <h2 className="text-xl font-bold">Categorias</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Organize as notícias por categorias
              </p>

              {loading ? (
                <p className="py-8 text-sm text-neutral-500">
                  Carregando categorias...
                </p>
              ) : categories.length === 0 ? (
                <p className="mt-5 rounded-md bg-neutral-50 p-5 text-sm text-neutral-600">
                  Nenhuma categoria cadastrada.
                </p>
              ) : (
                <div className="mt-5 space-y-3">
                  {categories.map((category) => (
                    <article
                      key={category.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-neutral-200 p-4"
                    >
                      <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                        <h3 className="font-bold">{category.name}</h3>
                        <p className="mt-1 text-xs text-neutral-500">
                          /{category.slug}
                        </p>
                        {category.description && (
                          <p className="mt-2 text-sm text-neutral-600">
                            {category.description}
                          </p>
                        )}
                      </div>

                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => editCategory(category)}
                          className="text-sm font-bold text-red-700 hover:text-red-900"
                        >
                          Editar
                        </button>

                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => deleteCategory(category)}
                            className="text-sm font-bold text-neutral-500 hover:text-red-700"
                          >
                            Excluir
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="min-w-0 rounded-lg border border-neutral-200 bg-white p-5 sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">
                    {editingCategory ? 'Editar categoria' : 'Nova categoria'}
                  </h2>
                </div>

                {editingCategory && (
                  <button
                    type="button"
                    onClick={resetCategoryForm}
                    className="text-sm font-bold text-neutral-500 hover:text-neutral-900"
                  >
                    Cancelar
                  </button>
                )}
              </div>

              <form onSubmit={saveCategory} className="min-w-0 space-y-4">
                <label className={labelClass}>
                  Nome *
                  <input
                    className={inputClass}
                    name="name"
                    value={categoryForm.name}
                    onChange={(event) => {
                      updateCategoryField(event)
                      if (!editingCategory) {
                        setCategoryForm((current) => ({
                          ...current,
                          name: event.target.value,
                          slug: makeSlug(event.target.value),
                        }))
                      }
                    }}
                    minLength={2}
                    required
                  />
                </label>

                <label className={labelClass}>
                  Slug *
                  <input
                    className={inputClass}
                    name="slug"
                    value={categoryForm.slug}
                    onChange={updateCategoryField}
                    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                    title="Use letras minúsculas, números e hífens."
                    required
                  />
                </label>

                <label className={labelClass}>
                  Descrição
                  <textarea
                    className={inputClass}
                    name="description"
                    value={categoryForm.description}
                    onChange={updateCategoryField}
                    rows={3}
                  />
                </label>

                <button
                  type="submit"
                  disabled={saving || uploading}
                  className="w-full rounded-md bg-red-700 px-5 py-3 font-bold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {uploading
                    ? 'Enviando imagem...'
                    : saving
                    ? 'Salvando...'
                    : editingCategory
                      ? 'Salvar categoria'
                      : 'Criar categoria'}
                </button>
              </form>
            </section>
          </div>
        )}

      </main>
    </div>
  )
}

export default AdminPanel
