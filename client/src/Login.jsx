import { useState } from 'react'
import { passwordValidationMessage } from './passwordValidation.js'

function Login({ onLogin, onBack }) {
  const [registering, setRegistering] = useState(false)
  const [name, setName] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [notice, setNotice] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!email.trim() || !password) {
      setError('Preencha o e-mail e a senha.')
      return
    }

    if (registering) {
      if (name.trim().length < 2) {
        setError('Informe seu nome com pelo menos 2 caracteres.')
        return
      }
      const passwordError = passwordValidationMessage(password)
      if (passwordError) {
        setError(passwordError)
        return
      }
      if (password !== confirmPassword) {
        setError('As senhas não coincidem.')
        return
      }
    }

    try {
      setLoading(true)

      const response = await fetch(registering ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...(registering ? { name: name.trim() } : {}),
          email: email.trim(),
          password,
        }),
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          result.message || (registering ? 'Não foi possível criar sua conta.' : 'Não foi possível entrar. Verifique suas credenciais.'),
        )
      }

      if (registering) {
        setRegistering(false)
        setPassword('')
        setConfirmPassword('')
        setNotice('Conta criada com sucesso! Entre com seu e-mail e senha.')
        return
      }

      if (!result.token || !result.user) {
        throw new Error('A resposta do servidor está incompleta.')
      }

      if (!['ADMIN', 'EDITOR', 'USER'].includes(result.user.role)) {
        throw new Error(
          'Não foi possível reconhecer o tipo desta conta.',
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
            Comunidade escolar
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              {registering ? 'Crie sua conta' : 'Bem-vindo de volta'}
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              {registering ? 'Estudantes, responsáveis e comunidade: participe das conversas do portal.' : 'Entre para comentar e acompanhar nossa comunidade escolar.'}
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

          {notice && <p role="status" className="rounded-xl bg-green-50 p-4 text-sm text-green-800">{notice}</p>}

          {registering && (
            <div>
              <label htmlFor="register-name" className="mb-2 block text-sm font-semibold text-slate-700">Nome</label>
              <input id="register-name" type="text" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={100} required disabled={loading} className="w-full rounded-xl border border-slate-300 px-4 py-3" />
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
                autoComplete={registering ? 'new-password' : 'current-password'}
                minLength={registering ? 8 : undefined}
                maxLength={registering ? 72 : undefined}
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

          {registering && (
            <div>
              <label htmlFor="register-confirm" className="mb-2 block text-sm font-semibold text-slate-700">Confirmar senha</label>
              <input id="register-confirm" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required disabled={loading} className="w-full rounded-xl border border-slate-300 px-4 py-3" />
              <p className="mt-2 text-xs text-slate-500">Use pelo menos 8 caracteres. Acentos e emojis ocupam mais espaço no limite da senha.</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-red-700 px-4 py-3.5 font-bold text-white transition hover:bg-red-800 focus:outline-none focus:ring-4 focus:ring-red-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (registering ? 'Criando conta...' : 'Entrando...') : (registering ? 'Criar minha conta' : 'Entrar na minha conta')}
          </button>

          <button type="button" disabled={loading} onClick={() => {
            setRegistering((current) => !current)
            setError('')
            setNotice('')
            setPassword('')
            setConfirmPassword('')
            setShowPassword(false)
          }} className="w-full rounded-xl px-4 py-3 font-bold text-red-700 hover:bg-red-50 disabled:opacity-60">
            {registering ? 'Já tenho conta' : 'Criar uma conta'}
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
            As contas da comunidade podem comentar e gerenciar o próprio perfil.
          </p>
        </form>
      </section>
    </main>
  )
}

export default Login
