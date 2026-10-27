import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import Login from '../Login'

describe('Login — autenticação e permissões', () => {
  let onLogin
  let onBack

  beforeEach(() => {
    onLogin = vi.fn()
    onBack = vi.fn()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  function preencherFormulario(email, senha) {
    fireEvent.change(screen.getByLabelText('E-mail'), {
      target: { value: email },
    })

    fireEvent.change(screen.getByLabelText('Senha'), {
      target: { value: senha },
    })
  }

  it('deve autenticar um administrador e entregar a sessão ao componente pai', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        token: 'jwt-de-teste',
        user: {
          id: 'admin-1',
          name: 'Administrador',
          email: 'admin@exemplo.com',
          role: 'ADMIN',
        },
      }),
    })

    render(<Login onLogin={onLogin} onBack={onBack} />)

    preencherFormulario(' admin@exemplo.com ', 'SenhaSegura123')
    fireEvent.click(screen.getByRole('button', { name: 'Entrar no painel' }))

    await waitFor(() => {
      expect(onLogin).toHaveBeenCalledWith({
        token: 'jwt-de-teste',
        user: {
          id: 'admin-1',
          name: 'Administrador',
          email: 'admin@exemplo.com',
          role: 'ADMIN',
        },
      })
    })

    expect(fetch).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@exemplo.com',
        password: 'SenhaSegura123',
      }),
    })
  })

  it('deve exibir o erro retornado pela API para credenciais inválidas', async () => {
    fetch.mockResolvedValue({
      ok: false,
      json: async () => ({
        message: 'E-mail ou senha incorretos.',
      }),
    })

    render(<Login onLogin={onLogin} onBack={onBack} />)

    preencherFormulario('usuario@exemplo.com', 'SenhaErrada123')
    fireEvent.click(screen.getByRole('button', { name: 'Entrar no painel' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'E-mail ou senha incorretos.',
    )

    expect(onLogin).not.toHaveBeenCalled()
  })

  it('não deve permitir acesso ao painel para usuários com papel USER', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        token: 'jwt-de-teste',
        user: {
          id: 'user-1',
          name: 'Usuário comum',
          email: 'usuario@exemplo.com',
          role: 'USER',
        },
      }),
    })

    render(<Login onLogin={onLogin} onBack={onBack} />)

    preencherFormulario('usuario@exemplo.com', 'SenhaSegura123')
    fireEvent.click(screen.getByRole('button', { name: 'Entrar no painel' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sua conta não tem permissão para acessar o painel administrativo.',
    )

    expect(onLogin).not.toHaveBeenCalled()
  })

  it('deve rejeitar uma resposta sem token ou usuário', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'jwt-de-teste' }),
    })

    render(<Login onLogin={onLogin} onBack={onBack} />)

    preencherFormulario('admin@exemplo.com', 'SenhaSegura123')
    fireEvent.click(screen.getByRole('button', { name: 'Entrar no painel' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A resposta do servidor está incompleta.',
    )

    expect(onLogin).not.toHaveBeenCalled()
  })

  it('deve exibir uma mensagem quando ocorrer uma falha de conexão', async () => {
    fetch.mockRejectedValue(new Error('Falha de conexão'))

    render(<Login onLogin={onLogin} onBack={onBack} />)

    preencherFormulario('admin@exemplo.com', 'SenhaSegura123')
    fireEvent.click(screen.getByRole('button', { name: 'Entrar no painel' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Falha de conexão',
    )

    expect(onLogin).not.toHaveBeenCalled()
  })

  it('deve permitir voltar ao portal sem realizar uma requisição', () => {
    render(<Login onLogin={onLogin} onBack={onBack} />)

    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao portal' }))

    expect(onBack).toHaveBeenCalledTimes(1)
    expect(fetch).not.toHaveBeenCalled()
  })
})
