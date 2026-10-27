import { useCallback, useEffect, useState } from 'react'

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
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-red-600 focus:ring-2 focus:ring-red-100'

const labelClass = 'block text-sm font-semibold text-slate-700'

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
  const [posts, setPosts] = useState([])
  const [categories, setCategories] = useState([])
  const [postForm, setPostForm] = useState(EMPTY_POST)
  const [categoryForm, setCategoryForm] = useState(EMPTY_CATEGORY)
  const [editingPost, setEditingPost] = useState(null)
  const [editingCategory, setEditingCategory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const isAdmin = user?.role === 'ADMIN'

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      const [postResult, categoryResult] = await Promise.all([
        apiRequest('/api/posts/admin?limit=100', token),
        apiRequest('/api/categories', token),
      ])

      setPosts(Array.isArray(postResult.data) ? postResult.data : [])
      setCategories(
        Array.isArray(categoryResult)
          ? categoryResult
          : Array.isArray(categoryResult.data)
            ? categoryResult.data
            : [],
      )
    } catch (err) {
      setError(err.message || 'Erro ao carregar os dados.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadData()
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
    setEditingPost(null)
    setPostForm(EMPTY_POST)
  }

  async function savePost(event) {
    event.preventDefault()

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
          'Notícia criada como rascunho. Você pode editá-la para publicar.',
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
      return 'bg-slate-200 text-slate-700'
    }

    return 'bg-amber-100 text-amber-800'
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="bg-red-800 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 md:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-200">
              Portal 138
            </p>
            <h1 className="mt-1 text-2xl font-black">
              Painel administrativo
            </h1>
            <p className="mt-1 text-sm text-red-100">
              Olá, {user?.name || 'usuário'} · {user?.role || 'USER'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onBack}
              className="rounded-lg border border-white/40 px-4 py-2 text-sm font-bold transition hover:bg-white/10"
            >
              Ver portal
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-red-800 transition hover:bg-red-50"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 md:px-8">
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Total de notícias</p>
            <p className="mt-2 text-3xl font-black">{posts.length}</p>
            <p className="mt-1 text-xs text-slate-400">Todos os status</p>
          </div>

          <div className="rounded-2xl border border-green-200 bg-white p-5">
            <p className="text-sm text-slate-500">Publicadas</p>
            <p className="mt-2 text-3xl font-black text-green-700">
              {posts.filter((post) => post.status === 'PUBLISHED').length}
            </p>
            <p className="mt-1 text-xs text-slate-400">Visíveis no portal</p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-white p-5">
            <p className="text-sm text-slate-500">Rascunhos</p>
            <p className="mt-2 text-3xl font-black text-amber-700">
              {posts.filter((post) => post.status === 'DRAFT').length}
            </p>
            <p className="mt-1 text-xs text-slate-400">Aguardando publicação</p>
          </div>

          <div className="rounded-2xl border border-slate-300 bg-white p-5">
            <p className="text-sm text-slate-500">Arquivadas</p>
            <p className="mt-2 text-3xl font-black text-slate-700">
              {posts.filter((post) => post.status === 'ARCHIVED').length}
            </p>
            <p className="mt-1 text-xs text-slate-400">Fora das publicações ativas</p>
          </div>

          <div className="rounded-2xl border border-red-200 bg-white p-5">
            <p className="text-sm text-slate-500">Categorias</p>
            <p className="mt-2 text-3xl font-black text-red-700">
              {categories.length}
            </p>
            <p className="mt-1 text-xs text-slate-400">Organização do conteúdo</p>
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
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
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
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            Categorias
          </button>

          <button
            type="button"
            onClick={loadData}
            className="ml-auto rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            Atualizar dados
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            {error}
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"
          >
            {notice}
          </div>
        )}

        {section === 'posts' && (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">Notícias</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Gerencie publicações, rascunhos e arquivos.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold">
                  {posts.length}
                </span>
              </div>

              {loading ? (
                <p className="py-8 text-sm text-slate-500">
                  Carregando notícias...
                </p>
              ) : posts.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-600">
                  Nenhuma notícia encontrada.
                </p>
              ) : (
                <div className="space-y-3">
                  {posts.map((post) => (
                    <article
                      key={post.id}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="break-words font-bold">
                            {post.title}
                          </h3>
                          <p className="mt-1 break-all text-xs text-slate-500">
                            /{post.slug}
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(post.status)}`}
                            >
                              {statusLabel(post.status)}
                            </span>
                            {post.category?.name && (
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                                {post.category.name}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => editPost(post)}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold hover:bg-slate-50"
                        >
                          Editar
                        </button>
                      </div>

                      {isAdmin && (
                        <button
                          type="button"
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
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">
                    {editingPost ? 'Editar notícia' : 'Nova notícia'}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {editingPost
                      ? 'Altere os campos e salve.'
                      : 'Novas notícias começam como rascunho.'}
                  </p>
                </div>

                {editingPost && (
                  <button
                    type="button"
                    onClick={resetPostForm}
                    className="text-sm font-bold text-slate-500 hover:text-slate-900"
                  >
                    Cancelar
                  </button>
                )}
              </div>

              <form onSubmit={savePost} className="space-y-4">
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

                <label className={labelClass}>
                  URL da imagem de capa
                  <input
                    className={inputClass}
                    name="coverImage"
                    type="url"
                    value={postForm.coverImage}
                    onChange={updatePostField}
                    placeholder="https://..."
                  />
                </label>

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
                  disabled={saving}
                  className="w-full rounded-xl bg-red-700 px-5 py-3 font-bold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
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
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.7fr)]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <h2 className="text-xl font-black">Categorias cadastradas</h2>
              <p className="mt-1 text-sm text-slate-500">
                Organize as notícias por assunto.
              </p>

              {loading ? (
                <p className="py-8 text-sm text-slate-500">
                  Carregando categorias...
                </p>
              ) : categories.length === 0 ? (
                <p className="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-600">
                  Nenhuma categoria cadastrada.
                </p>
              ) : (
                <div className="mt-5 space-y-3">
                  {categories.map((category) => (
                    <article
                      key={category.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"
                    >
                      <div>
                        <h3 className="font-bold">{category.name}</h3>
                        <p className="mt-1 text-xs text-slate-500">
                          /{category.slug}
                        </p>
                        {category.description && (
                          <p className="mt-2 text-sm text-slate-600">
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
                            className="text-sm font-bold text-slate-500 hover:text-red-700"
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

            <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">
                    {editingCategory ? 'Editar categoria' : 'Nova categoria'}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    O slug será usado no endereço interno.
                  </p>
                </div>

                {editingCategory && (
                  <button
                    type="button"
                    onClick={resetCategoryForm}
                    className="text-sm font-bold text-slate-500 hover:text-slate-900"
                  >
                    Cancelar
                  </button>
                )}
              </div>

              <form onSubmit={saveCategory} className="space-y-4">
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
                  disabled={saving}
                  className="w-full rounded-xl bg-red-700 px-5 py-3 font-bold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? 'Salvando...'
                    : editingCategory
                      ? 'Salvar categoria'
                      : 'Criar categoria'}
                </button>
              </form>
            </section>
          </div>
        )}

        <p className="mt-8 text-center text-xs leading-5 text-slate-500">
          O acesso às operações é validado pelo servidor. As permissões da
          interface não substituem a autenticação da API.
        </p>
      </main>
    </div>
  )
}

export default AdminPanel
