import { useCallback, useEffect, useRef, useState } from 'react'
import { passwordValidationMessage } from './passwordValidation.js'

const roles = { USER: 'Usuário', EDITOR: 'Editor', ADMIN: 'Administrador' }
const emptyAccount = { name: '', email: '', password: '', role: 'EDITOR' }
const fieldClass = 'mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-sm focus:border-red-700'

async function request(path, token, options = {}) {
  const response = await fetch(path, { ...options, headers: {
    Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}),
  } })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.message || 'Não foi possível concluir a operação.')
  return result
}

export default function UserManagement({ token, currentUser }) {
  const [users, setUsers] = useState([])
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 })
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [filters, setFilters] = useState({ search: '', role: '' })
  const [account, setAccount] = useState(emptyAccount)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const generation = useRef(0)

  const load = useCallback(async () => {
    const id = ++generation.current
    setLoading(true)
    setFailed(false)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', search: filters.search })
      if (filters.role) params.set('role', filters.role)
      const result = await request(`/api/admin/users?${params}`, token)
      if (id !== generation.current) return
      const last = Math.max(1, result.pagination.totalPages)
      if (page > last) { setPage(last); return }
      setUsers(result.data)
      setPagination(result.pagination)
    } catch (err) {
      if (id !== generation.current) return
      setError(err.message)
      setUsers([])
      setFailed(true)
    } finally { if (id === generation.current) setLoading(false) }
  }, [token, page, filters])
  useEffect(() => { load(); return () => { generation.current += 1 } }, [load])

  async function changeRole(person, nextRole) {
    if (person.role === nextRole) return
    if (!window.confirm(`Alterar o acesso de ${person.name} para ${roles[nextRole]}?`)) return
    setSaving(true); setError(''); setNotice('')
    try {
      await request(`/api/admin/users/${person.id}/role`, token, { method: 'PATCH', body: JSON.stringify({ role: nextRole }) })
      setNotice(`O perfil de ${person.name} foi atualizado para ${roles[nextRole]}.`)
      await load()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  async function createAccount(event) {
    event.preventDefault()
    const invalidPassword = passwordValidationMessage(account.password, 12)
    if (invalidPassword) { setError(invalidPassword); return }
    setSaving(true); setError(''); setNotice('')
    try {
      await request('/api/admin/users', token, { method: 'POST', body: JSON.stringify(account) })
      setAccount(emptyAccount)
      setNotice('Conta criada com sucesso.')
      await load()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  return (
    <section aria-label="Gestão de usuários" className="space-y-5">
      <div><h2 className="text-xl font-bold">Usuários e permissões</h2>
        <p className="mt-1 text-sm text-neutral-600">Crie contas ou altere o acesso de pessoas já cadastradas. Seu próprio perfil de administrador é protegido.</p></div>
      {error && <p role="alert" className="rounded bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded bg-green-50 p-4 text-sm text-green-800">{notice}</p>}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)]">
        <div className="min-w-0 rounded-lg border border-neutral-200 bg-white p-5">
          <form onSubmit={(event) => { event.preventDefault(); setPage(1); setFilters({ search: search.trim(), role }) }} className="mb-5 flex flex-wrap items-end gap-3">
            <label className="min-w-0 flex-1 text-sm font-semibold">Buscar usuários
              <input className={fieldClass} type="search" value={search} onChange={e => setSearch(e.target.value)} maxLength={100} placeholder="Nome ou e-mail" /></label>
            <label className="text-sm font-semibold">Filtrar por perfil
              <select className={fieldClass} value={role} onChange={e => setRole(e.target.value)}><option value="">Todos</option>{Object.entries(roles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <button type="submit" disabled={saving} className="rounded bg-red-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Buscar</button>
          </form>
          {loading ? <p role="status">Carregando usuários...</p> : failed ? <button type="button" onClick={load} className="text-sm font-semibold text-red-700">Tentar novamente</button> : users.length === 0 ? <p className="text-sm text-neutral-600">Nenhum usuário encontrado.</p> : (
            <ul className="space-y-3">{users.map(person => <li key={person.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-neutral-200 p-4">
              <div className="min-w-0"><h3 className="break-words font-bold">{person.name}{person.id === currentUser.id ? ' (você)' : ''}</h3><p className="break-all text-sm text-neutral-600">{person.email}</p></div>
              <label className="text-sm font-semibold">Perfil de {person.name}
                <select className={fieldClass} aria-label={`Perfil de ${person.name}`} value={person.role} disabled={saving || person.id === currentUser.id}
                  onChange={e => changeRole(person, e.target.value)}>{Object.entries(roles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            </li>)}</ul>
          )}
          {!loading && !failed && <p className="mt-4 text-xs text-neutral-500">{pagination.total} usuário(s) encontrado(s).</p>}
          {!failed && pagination.totalPages > 1 && <nav aria-label="Paginação de usuários" className="mt-5 flex items-center justify-between gap-3 text-sm">
            <button type="button" disabled={loading || saving || page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</button><span>Página {page} de {pagination.totalPages}</span>
            <button type="button" disabled={loading || saving || page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>Próxima</button></nav>}
        </div>
        <form onSubmit={createAccount} className="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
          <h3 className="text-lg font-bold">Criar conta</h3>
          <fieldset disabled={saving} className="space-y-4">
            <label className="block text-sm font-semibold">Nome<input className={fieldClass} value={account.name} onChange={e => setAccount(a => ({ ...a, name: e.target.value }))} required minLength={2} maxLength={100} autoComplete="off" /></label>
            <label className="block text-sm font-semibold">E-mail<input className={fieldClass} type="email" value={account.email} onChange={e => setAccount(a => ({ ...a, email: e.target.value }))} required maxLength={254} autoComplete="off" /></label>
            <label className="block text-sm font-semibold">Senha inicial<input className={fieldClass} type="password" value={account.password} onChange={e => setAccount(a => ({ ...a, password: e.target.value }))} required minLength={12} autoComplete="new-password" /></label>
            <p className="text-xs text-neutral-500">Use pelo menos 12 caracteres. A pessoa poderá alterar a senha no próprio perfil.</p>
            <label className="block text-sm font-semibold">Perfil da nova conta<select className={fieldClass} value={account.role} onChange={e => setAccount(a => ({ ...a, role: e.target.value }))}>{Object.entries(roles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <button type="submit" className="w-full rounded bg-red-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{saving ? 'Salvando...' : 'Criar conta'}</button>
          </fieldset>
        </form>
      </div>
    </section>
  )
}
