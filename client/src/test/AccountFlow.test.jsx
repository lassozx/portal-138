import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from '../App.jsx'

const post = { id: 'p1', slug: 'feira', title: 'Feira da escola', content: 'Notícia completa.', publishedAt: '2026-10-30T12:00:00Z' }
function api(role = 'USER') {
  const user = { id: 'u1', name: 'Maria', email: 'maria@example.com', role }
  vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
    let body
    if (url === '/api/auth/login') body = { token: 'token-comunidade', user }
    else if (url.startsWith('/api/comments/post/')) body = { comments: [], pagination: { total: 0, totalPages: 0, page: 1 } }
    else if (url === '/api/comments' && options.method === 'POST') body = { id: 'new-comment' }
    else if (url === '/api/categories') body = []
    else if (url === '/api/posts/feira') body = post
    else body = { data: [post], pagination: { total: 1, totalPages: 1 } }
    return { ok: true, json: async () => body }
  }))
}
afterEach(() => { cleanup(); window.history.replaceState(null, '', '/'); vi.unstubAllGlobals() })
async function login() {
  fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'maria@example.com' } })
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'Senha12345' } })
  fireEvent.click(screen.getByRole('button', { name: 'Entrar na minha conta' }))
}

it('leva USER ao portal, permite editar perfil e sair e não carrega o painel', async () => {
  api()
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Entrar', exact: true }))
  await login()
  await screen.findByRole('button', { name: 'Meu perfil' })
  expect(screen.queryByRole('button', { name: 'Painel' })).not.toBeInTheDocument()
  expect(fetch.mock.calls.some(([url]) => url.startsWith('/api/posts/admin'))).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Meu perfil' }))
  await screen.findByRole('heading', { name: 'Meu perfil' })
  expect(screen.getByLabelText('Nome')).toHaveValue('Maria')
  expect(screen.getByText('Comunidade')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Voltar', exact: true }))
  fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
  expect(screen.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Meu perfil' })).not.toBeInTheDocument()
})

it.each(['ADMIN', 'EDITOR'])('mantém o painel disponível para %s', async (role) => {
  api(role)
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Entrar', exact: true }))
  await login()
  await screen.findByRole('heading', { name: 'Painel administrativo' })
  expect(fetch).toHaveBeenCalledWith('/api/posts/admin?limit=100', expect.anything())
  fireEvent.click(screen.getByRole('button', { name: 'Ver portal' }))
  expect(screen.getByRole('button', { name: 'Painel' })).toBeVisible()
})

it('retorna à mesma notícia após login USER e permite comentar; sair remove o formulário', async () => {
  api()
  window.history.replaceState(null, '', '/#/noticias/feira')
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'Entrar para comentar' }))
  await login()
  await screen.findByLabelText('Escreva um comentário')
  expect(window.location.hash).toBe('#/noticias/feira')
  expect(screen.getByRole('heading', { name: post.title })).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Painel' })).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Escreva um comentário'), { target: { value: 'Parabéns pelo projeto!' } })
  fireEvent.click(screen.getByRole('button', { name: 'Publicar comentário' }))
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/comments', expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer token-comunidade' }), body: JSON.stringify({ content: 'Parabéns pelo projeto!', postId: 'p1' }) })))
  await screen.findByText('Comentário publicado com sucesso.')
  fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
  expect(screen.queryByLabelText('Escreva um comentário')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Entrar para comentar' })).toBeVisible()
})
