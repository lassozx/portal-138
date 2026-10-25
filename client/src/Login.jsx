import { useState } from 'react'

function Login({ onLogin, onBack }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (!email.trim() || !password) {
      setError('Preencha o e-mail e a senha.')
      return
    }

    try {
      setLoading(true)

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          result.message || 'Não foi possível entrar. Verifique suas credenciais.',
        )
      }

      if (!result.token || !result.user) {
        throw new Error('A resposta do servidor está incompleta.')
      }

      if (!['ADMIN', 'EDITOR'].includes(result.user.role)) {
        throw new Error(
          'Sua conta não tem permissão para acessar o painel administrativo.',
        )
      }

      onLogin({
        token: result.token,
        user: result.user,
      })
    } catch (err) {
      setError(err.message || 'Erro ao conectar com o servidor.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <section className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-xl">
        <div className="bg-red-700 px-8 py-10 text-center text-white">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-2xl font-black text-red-700 shadow-lg">
            138
          </div>

          <h1 className="mt-5 text-3xl font-black tracking-tight">
            Portal 138
          </h1>

          <p className="mt-2 text-sm text-red-100">
            Área administrativa
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Bem-vindo de volta
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Entre com sua conta de administrador ou editor.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="login-email"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              E-mail
            </label>

            <input
              id="login-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="seuemail@exemplo.com"
              required
              disabled={loading}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-600 focus:ring-4 focus:ring-red-100 disabled:bg-slate-100"
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Senha
            </label>

            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Digite sua senha"
                required
                disabled={loading}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-24 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-600 focus:ring-4 focus:ring-red-100 disabled:bg-slate-100"
              />

              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute inset-y-0 right-3 text-sm font-semibold text-slate-500 hover:text-red-700"
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-red-700 px-4 py-3.5 font-bold text-white transition hover:bg-red-800 focus:outline-none focus:ring-4 focus:ring-red-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Entrando...' : 'Entrar no painel'}
          </button>

          <button
            type="button"
            onClick={onBack}
            disabled={loading}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
          >
            Voltar ao portal
          </button>

          <p className="text-center text-xs leading-5 text-slate-400">
            Acesso restrito a usuários autorizados.
          </p>
        </form>
      </section>
    </main>
  )
}

export default Login