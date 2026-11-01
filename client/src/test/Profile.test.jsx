import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import Profile from '../Profile.jsx'

const user = { id: 'u1', name: 'Maria', email: 'maria@example.com', role: 'USER' }

beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function preencherSenha(password) {
  render(<Profile user={user} token="token-comunidade" />)
  fireEvent.change(screen.getByLabelText('Senha atual'), { target: { value: 'SenhaAtual123' } })
  fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: password } })
  fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: 'Alterar senha' }))
}

it.each(['á'.repeat(36) + 'X', '😀'.repeat(18) + 'X'])('não altera a senha quando excede 72 bytes (%s)', async (password) => {
  preencherSenha(password)

  expect(await screen.findByRole('status')).toHaveTextContent('A senha é muito longa.')
  expect(screen.getByLabelText('Nova senha')).toHaveValue(password)
  expect(fetch).not.toHaveBeenCalled()
})

it.each(['á'.repeat(36), '😀'.repeat(18)])('altera a senha com exatamente 72 bytes (%s)', async (password) => {
  fetch.mockResolvedValue({ ok: true, json: async () => ({ user }) })
  preencherSenha(password)

  expect(await screen.findByRole('status')).toHaveTextContent('Senha alterada com sucesso.')
  expect(fetch).toHaveBeenCalledWith('/api/auth/profile', expect.objectContaining({
    method: 'PUT',
    headers: expect.objectContaining({ Authorization: 'Bearer token-comunidade' }),
    body: JSON.stringify({ currentPassword: 'SenhaAtual123', newPassword: password }),
  }))
  expect(screen.getByLabelText('Nova senha')).toHaveValue('')
})
