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
    fireEvent.click(screen.getByRole('button', { name: 'Entrar na minha conta' }))

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
    fireEvent.click(screen.getByRole('button', { name: 'Entrar na minha conta' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'E-mail ou senha incorretos.',
    )

    expect(onLogin).not.toHaveBeenCalled()
  })

  it('deve autenticar contas USER para participar do portal', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Entrar na minha conta' }))

    await waitFor(() => expect(onLogin).toHaveBeenCalledWith(expect.objectContaining({ user: expect.objectContaining({ role: 'USER' }) })))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('deve rejeitar uma resposta sem token ou usuário', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'jwt-de-teste' }),
    })

    render(<Login onLogin={onLogin} onBack={onBack} />)

    preencherFormulario('admin@exemplo.com', 'SenhaSegura123')
    fireEvent.click(screen.getByRole('button', { name: 'Entrar na minha conta' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A resposta do servidor está incompleta.',
    )

    expect(onLogin).not.toHaveBeenCalled()
  })

  it('deve exibir uma mensagem quando ocorrer uma falha de conexão', async () => {
    fetch.mockRejectedValue(new Error('Falha de conexão'))

    render(<Login onLogin={onLogin} onBack={onBack} />)

    preencherFormulario('admin@exemplo.com', 'SenhaSegura123')
    fireEvent.click(screen.getByRole('button', { name: 'Entrar na minha conta' }))

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
  it('rejeita tipos de conta desconhecidos', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({ token: 'jwt', user: { role: 'OTHER' } }) })
    render(<Login onLogin={onLogin} onBack={onBack} />)
    preencherFormulario('teste@example.com', 'Senha12345')
    fireEvent.click(screen.getByRole('button', { name: 'Entrar na minha conta' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível reconhecer o tipo desta conta.')
    expect(onLogin).not.toHaveBeenCalled()
  })

  function preencherCadastro(confirm = 'Senha12345') {
    fireEvent.click(screen.getByRole('button', { name: 'Criar uma conta' }))
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: '  Maria Silva  ' } })
    preencherFormulario('maria@example.com', 'Senha12345')
    fireEvent.change(screen.getByLabelText('Confirmar senha'), { target: { value: confirm } })
  }

  it('cadastra uma conta sem solicitar privilégio e volta ao login com o e-mail preenchido', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({ user: { role: 'USER' } }) })
    render(<Login onLogin={onLogin} onBack={onBack} />)
    preencherCadastro()
    fireEvent.click(screen.getByRole('button', { name: 'Criar minha conta' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Conta criada com sucesso!')
    expect(fetch).toHaveBeenCalledWith('/api/auth/register', expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Maria Silva', email: 'maria@example.com', password: 'Senha12345' }) }))
    expect(screen.getByLabelText('E-mail')).toHaveValue('maria@example.com')
    expect(screen.getByLabelText('Senha')).toHaveValue('')
    expect(onLogin).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Confirmar senha')).not.toBeInTheDocument()
  })

  it('não envia cadastro quando as senhas não coincidem', async () => {
    render(<Login onLogin={onLogin} onBack={onBack} />)
    preencherCadastro('OutraSenha')
    fireEvent.click(screen.getByRole('button', { name: 'Criar minha conta' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('As senhas não coincidem.')
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each(['á'.repeat(36) + 'X', '😀'.repeat(18) + 'X'])('não envia cadastro quando a senha excede 72 bytes (%s)', async (password) => {
    render(<Login onLogin={onLogin} onBack={onBack} />)
    preencherCadastro(password)
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: password } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar minha conta' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('A senha é muito longa.')
    expect(screen.getByLabelText('Senha')).toHaveValue(password)
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each(['á'.repeat(36), '😀'.repeat(18)])('envia cadastro com senha de exatamente 72 bytes (%s)', async (password) => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({ user: { role: 'USER' } }) })
    render(<Login onLogin={onLogin} onBack={onBack} />)
    preencherCadastro(password)
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: password } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar minha conta' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Conta criada com sucesso!')
    expect(fetch).toHaveBeenCalledWith('/api/auth/register', expect.objectContaining({
      body: JSON.stringify({ name: 'Maria Silva', email: 'maria@example.com', password }),
    }))
  })

  it('preserva os dados e permite corrigir um e-mail já cadastrado', async () => {
    fetch.mockResolvedValue({ ok: false, json: async () => ({ message: 'Este e-mail já está cadastrado.' }) })
    render(<Login onLogin={onLogin} onBack={onBack} />)
    preencherCadastro()
    fireEvent.click(screen.getByRole('button', { name: 'Criar minha conta' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Este e-mail já está cadastrado.')
    expect(screen.getByLabelText('Nome')).toHaveValue('  Maria Silva  ')
    fireEvent.click(screen.getByRole('button', { name: 'Já tenho conta' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Senha')).toHaveValue('')
  })

})
