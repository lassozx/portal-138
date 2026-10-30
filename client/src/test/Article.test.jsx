import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from '../App.jsx'
import Article from '../Article.jsx'

const post = { id: 'p1', slug: 'feira', title: 'Feira de ciências', content: 'Experiências e descobertas da nossa escola.', author: { name: 'Ana' }, category: { name: 'Projetos' }, publishedAt: '2026-10-30T12:00:00Z' }
function mockApi() {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    if (url.startsWith('/api/comments/')) return { ok: true, json: async () => ({ comments: [], pagination: { total: 0, page: 1, totalPages: 0 } }) }
    if (url === '/api/categories') return { ok: true, json: async () => [] }
    if (url.startsWith('/api/posts?')) return { ok: true, json: async () => ({ data: [post], pagination: { total: 1, totalPages: 1 } }) }
    return { ok: true, json: async () => post }
  }))
}
afterEach(() => { cleanup(); window.history.replaceState(null, '', '/'); vi.unstubAllGlobals() })

it('abre diretamente uma URL compartilhada e carrega texto completo e comentários', async () => {
  mockApi()
  window.history.replaceState(null, '', '/#/noticias/feira')
  render(<App />)
  expect(await screen.findByRole('heading', { level: 1, name: post.title })).toBeVisible()
  expect(screen.getByText(post.content)).toBeVisible()
  expect(screen.getByText('Ana')).toBeVisible()
  await screen.findByText('Ainda não há comentários. Seja o primeiro a comentar.')
  expect(document.title).toBe(`${post.title} | Portal 138`)
  expect(fetch).toHaveBeenCalledWith('/api/posts/feira', expect.anything())
  expect(screen.getByRole('link', { name: '← Todas as notícias' })).toHaveAttribute('href', '#noticias')
  fireEvent.click(screen.getByRole('button', { name: 'Entrar para comentar' }))
  expect(screen.getByRole('button', { name: 'Entrar no painel' })).toBeVisible()
})

it('acompanha a navegação entre a lista e a notícia sem recarregar', async () => {
  mockApi()
  render(<App />)
  await screen.findByText('Em destaque · Projetos')
  window.history.pushState(null, '', '/#/noticias/feira')
  fireEvent(window, new Event('hashchange'))
  await screen.findByRole('heading', { level: 1, name: post.title })
  window.history.pushState(null, '', '/#noticias')
  fireEvent(window, new Event('hashchange'))
  await screen.findByText('Últimas notícias')
})

it('exibe notícia indisponível quando a API retorna 404', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })))
  render(<Article slug="removida" />)
  await screen.findByRole('heading', { name: 'Notícia não encontrada' })
  expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument()
})

it('recupera uma falha de conexão e ignora respostas de notícias antigas', async () => {
  mockApi()
  const original = fetch.getMockImplementation()
  fetch.mockRejectedValueOnce(new Error('offline'))
  const { rerender } = render(<Article slug="feira" />)
  fireEvent.click(await screen.findByRole('button', { name: 'Tentar novamente' }))
  await screen.findByRole('heading', { name: post.title })
  let resolveOld
  fetch.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve }))
  rerender(<Article slug="antiga" />)
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/posts/antiga', expect.anything()))
  fetch.mockImplementation(original)
  rerender(<Article slug="atual" />)
  await screen.findByRole('heading', { name: post.title })
  resolveOld({ ok: true, json: async () => ({ ...post, title: 'Resposta atrasada' }) })
  await waitFor(() => expect(screen.queryByRole('heading', { name: 'Resposta atrasada' })).not.toBeInTheDocument())
})
