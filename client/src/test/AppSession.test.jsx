import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from '../App.jsx'
import { SESSION_KEY } from '../useSession.js'

const user = { id: 'u1', name: 'Maria Silva', email: 'maria@example.com', role: 'USER' }
const post = { id: 'p1', slug: 'feira', title: 'Feira da escola', content: 'Uma notícia da comunidade.' }
const ok = (body) => ({ ok: true, json: async () => body })
function mockApi(me) {
  vi.stubGlobal('fetch', vi.fn(async (url, options) => {
    if (url === '/api/auth/me') return me(options)
    if (url === '/api/categories') return ok([])
    if (url === '/api/posts/feira') return ok(post)
    if (url.startsWith('/api/comments/')) return ok({ comments: [], pagination: { page: 1, total: 0, totalPages: 0 } })
    return ok({ data: [post], pagination: { total: 1, totalPages: 1 } })
  }))
}
afterEach(() => {
  cleanup()
  sessionStorage.clear()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
})

it('aguarda a API, restaura a mesma notícia e mantém a conta USER fora do painel', async () => {
  sessionStorage.setItem(SESSION_KEY, 'token-salvo')
  window.history.replaceState(null, '', '/#/noticias/feira')
  let finish
  mockApi(() => new Promise((resolve) => { finish = resolve }))
  const first = render(<App />)
  expect(screen.getByText('Verificando sua sessão…')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Painel' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Meu perfil' })).not.toBeInTheDocument()
  finish(ok({ user }))
  await screen.findByLabelText('Escreva um comentário')
  expect(screen.getByRole('heading', { name: post.title })).toBeVisible()
  expect(window.location.hash).toBe('#/noticias/feira')
  expect(screen.queryByRole('button', { name: 'Painel' })).not.toBeInTheDocument()
  expect(fetch).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({ headers: { Authorization: 'Bearer token-salvo' } }))
  fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
  expect(sessionStorage.getItem(SESSION_KEY)).toBeNull()
  first.unmount()
  render(<App />)
  await screen.findByRole('button', { name: 'Entrar para comentar' })
  expect(screen.queryByLabelText('Escreva um comentário')).not.toBeInTheDocument()
})

it.each(['ADMIN', 'EDITOR'])('restaura %s e limpa o token ao sair pelo painel', async (role) => {
  sessionStorage.setItem(SESSION_KEY, 'token-da-equipe')
  mockApi(() => ok({ user: { ...user, role } }))
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'Painel' }))
  await screen.findByRole('heading', { name: 'Painel administrativo' })
  fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
  expect(sessionStorage.getItem(SESSION_KEY)).toBeNull()
  expect(screen.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible()
})

it('recupera a verificação após falha temporária sem apagar o token', async () => {
  sessionStorage.setItem(SESSION_KEY, 'token-salvo')
  let offline = true
  mockApi(() => {
    if (offline) throw new Error('offline')
    return ok({ user })
  })
  render(<App />)
  await screen.findByRole('alert')
  expect(sessionStorage.getItem(SESSION_KEY)).toBe('token-salvo')
  expect(screen.queryByRole('button', { name: 'Meu perfil' })).not.toBeInTheDocument()
  offline = false
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
  await screen.findByRole('button', { name: 'Meu perfil' })
})

it('permite continuar sem conta após falha e não restaura o login na próxima montagem', async () => {
  sessionStorage.setItem(SESSION_KEY, 'token-salvo')
  mockApi(() => { throw new Error('offline') })
  const first = render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'Continuar sem entrar' }))
  expect(sessionStorage.getItem(SESSION_KEY)).toBeNull()
  expect(screen.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible()
  first.unmount()
  render(<App />)
  expect(screen.queryByText('Verificando sua sessão…')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible()
})

it('avisa e volta ao acesso público se a API rejeitar a sessão salva', async () => {
  sessionStorage.setItem(SESSION_KEY, 'token-invalido')
  mockApi(() => ({ ok: false, status: 401 }))
  render(<App />)
  await screen.findByRole('button', { name: 'Entrar', exact: true })
  expect(screen.getByText(/Sua sessão expirou ou não é mais válida/)).toBeVisible()
  expect(sessionStorage.getItem(SESSION_KEY)).toBeNull()
})
