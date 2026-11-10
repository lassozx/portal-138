import { useState } from 'react'
import { passwordValidationMessage } from '../utils/passwordValidation.js'

const inputClass =
  'mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-red-700 focus:ring-2 focus:ring-red-100'

const labelClass = 'block text-sm font-semibold text-neutral-700'

function Profile({ token, user, onBack, onUserUpdated, onSessionUpdated }) {
  const [name, setName] = useState(user?.name || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function updateProfile(event) {
    event.preventDefault()
    setError('')
    setNotice('')

    const trimmedName = name.trim()

    if (trimmedName.length < 2) {
      setError('O nome precisa ter pelo menos 2 caracteres.')
      return
    }

    if (trimmedName === user?.name) {
      setError('Informe um nome diferente do atual.')
      return
    }

    try {
      setSavingName(true)

      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: trimmedName }),
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(result.message || 'Não foi possível atualizar o nome.')
      }

      onUserUpdated?.(result.user || result)
      setNotice('Nome atualizado com sucesso.')
    } catch (err) {
      setError(err.message || 'Erro ao atualizar o nome.')
    } finally {
      setSavingName(false)
    }
  }

  async function updatePassword(event) {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Preencha todos os campos de senha.')
      return
    }

    const passwordError = passwordValidationMessage(newPassword)
    if (passwordError) {
      setError(passwordError)
      return
    }

    if (newPassword !== confirmPassword) {
      setError('A confirmação da nova senha não corresponde.')
      return
    }

    try {
      setSavingPassword(true)

      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(result.message || 'Não foi possível alterar a senha.')
      }

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      if (result.token) onSessionUpdated?.({ token: result.token, user: result.user || user })
      setNotice('Senha alterada com sucesso.')
    } catch (err) {
      setError(err.message || 'Erro ao alterar a senha.')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <main className="portal-internal min-h-screen bg-[#f5f5f5] px-4 py-10 text-neutral-900 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 border-t-4 border-t-red-700 bg-white px-5 py-6 sm:px-6">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-red-700">
              SESI - Portal 138
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Meu perfil
            </h1>
            <p className="mt-2 text-sm text-neutral-600">
              Gerencie suas informações de acesso
            </p>
          </div>

          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-bold transition hover:bg-neutral-100"
          >
            Voltar
          </button>
        </header>

        <div className="mb-6 rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="text-lg font-bold">Informações da conta</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                E-mail
              </p>
              <p className="mt-1 break-all text-sm font-medium">
                {user?.email || 'Não informado'}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Perfil de acesso
              </p>
              <p className="mt-1 text-sm font-medium">
                {{ ADMIN: 'Administrador', EDITOR: 'Editor', USER: 'Comunidade' }[user?.role] || 'Não informado'}
              </p>
            </div>
          </div>
        </div>

        {(error || notice) && (
          <div
            role="status"
            className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
              error
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-green-200 bg-green-50 text-green-700'
            }`}
          >
            {error || notice}
          </div>
        )}

        <section className="mb-6 rounded-lg border border-neutral-200 bg-white p-5 sm:p-6">
          <h2 className="text-lg font-bold">Alterar nome</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Atualize o nome exibido na sua conta.
          </p>

          <form onSubmit={updateProfile} className="mt-5 space-y-4">
            <div>
              <label htmlFor="profile-name" className={labelClass}>
                Nome
              </label>
              <input
                id="profile-name"
                name="name"
                type="text"
                autoComplete="name"
                maxLength={100}
                required
                minLength={2}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              disabled={savingName || name.trim() === (user?.name || '')}
              className="rounded-lg bg-red-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingName ? 'Salvando...' : 'Salvar nome'}
            </button>
          </form>
        </section>

        <section className="rounded-lg border border-neutral-200 bg-white p-5 sm:p-6">
          <h2 className="text-lg font-bold">Alterar senha</h2>

          <form onSubmit={updatePassword} className="mt-5 space-y-4">
            <div>
              <label htmlFor="current-password" className={labelClass}>
                Senha atual
              </label>
              <input
                id="current-password"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="new-password" className={labelClass}>
                Nova senha
              </label>
              <input
                id="new-password"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                required
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className={labelClass}>
                Confirmar nova senha
              </label>
              <input
                id="confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              disabled={savingPassword}
              className="rounded-lg bg-red-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingPassword ? 'Alterando...' : 'Alterar senha'}
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}

export default Profile
