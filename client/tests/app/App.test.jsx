import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import App from '../../src/app/App.jsx'

const post = { id: 'p1', slug: 'feira-de-ciencias', title: 'Feira de ciências', excerpt: 'Projetos dos alunos', content: 'Texto completo sobre as experiências da feira.', publishedAt: '2026-10-30', category: { name: 'Projetos' } }
const result = (posts = [post], page = 1) => ({ data: posts, pagination: { page, total: 13, totalPages: 2 } })
function mockApi(handler = () => result()) {
  vi.stubGlobal('fetch', vi.fn(async (url, options) => {
    if (url === '/api/categories') return { ok: true, json: async () => [{ id: 'c1', name: 'Projetos' }] }
    return { ok: true, json: async () => handler(new URL(url, 'http://localhost').searchParams, options) }
  }))
}
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('mostra a notícia da API em destaque e links compartilháveis para a leitura', async () => {
  mockApi()
  render(<App />)
  await screen.findByText('Em destaque · Projetos')
  expect(screen.queryByText(post.content)).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Ler notícia completa →' })).toHaveAttribute('href', '#/noticias/feira-de-ciencias')
  expect(screen.getByRole('link', { name: 'Ler notícia', exact: true })).toHaveAttribute('href', '#/noticias/feira-de-ciencias')
})

it('pagina pela API e reinicia a página ao selecionar uma categoria ou buscar', async () => {
  mockApi((params) => result([{ ...post, id: params.get('page') }], Number(params.get('page'))))
  render(<App />)
  await screen.findByText('Página 1 de 2')
  fireEvent.click(screen.getByRole('button', { name: 'Próxima' }))
  await screen.findByText('Página 2 de 2')
  expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'c1' } })
  await screen.findByText('Página 1 de 2')
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ciência & arte' } })
  await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('search=ci%C3%AAncia+%26+arte'), expect.anything()))
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('categoryId=c1'), expect.anything())
  fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
  await screen.findByText('Em destaque · Projetos')
  expect(screen.getByRole('searchbox')).toHaveValue('')
})

it('distingue uma busca vazia de um blog sem publicações', async () => {
  mockApi(() => ({ data: [], pagination: { total: 0, totalPages: 0 } }))
  render(<App />)
  await screen.findByText('Em breve, novas histórias')
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'inexistente' } })
  await screen.findByText('Nenhuma notícia encontrada')
})

it('permite tentar novamente após falha sem recarregar a página', async () => {
  mockApi()
  const original = fetch.getMockImplementation()
  let failed = false
  fetch.mockImplementation((url, options) => {
    if (url.startsWith('/api/posts') && !failed) { failed = true; return Promise.reject(new Error('Falha de conexão')) }
    return original(url, options)
  })
  render(<App />)
  await screen.findByRole('button', { name: 'Tentar novamente' })
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
  await screen.findByText('Em destaque · Projetos')
})

it('navega pelos destaques e mantém o link da notícia selecionada', async () => {
  const second = { ...post, id: 'p2', slug: 'esporte', title: 'Esporte na escola' }
  const third = { ...post, id: 'p3', slug: 'cultura', title: 'Cultura na comunidade' }
  mockApi(() => result([post, second, third]))
  render(<App />)
  const hero = screen.getByRole('region', { name: 'Destaques do Portal 138' })
  await within(hero).findByRole('heading', { name: post.title })

  fireEvent.click(screen.getByRole('button', { name: 'Próximo destaque' }))
  expect(within(hero).getByRole('heading', { name: second.title })).toBeVisible()
  expect(within(hero).getByRole('link', { name: 'Ler notícia', exact: true })).toHaveAttribute('href', '#/noticias/esporte')
  expect(screen.getByRole('button', { name: 'Ir para destaque 2' })).toHaveAttribute('aria-pressed', 'true')

  fireEvent.click(screen.getByRole('button', { name: 'Ir para destaque 1' }))
  fireEvent.click(screen.getByRole('button', { name: 'Destaque anterior' }))
  expect(within(hero).getByRole('heading', { name: third.title })).toBeVisible()
  expect(within(hero).getByRole('link', { name: 'Ler notícia', exact: true })).toHaveAttribute('href', '#/noticias/cultura')
})

it('a pesquisa do cabeçalho leva ao único campo de busca da página', async () => {
  mockApi()
  render(<App />)
  await screen.findByText('Em destaque · Projetos')
  fireEvent.click(screen.getByRole('button', { name: 'Pesquisar notícias' }))
  expect(screen.getAllByRole('searchbox')).toHaveLength(1)
  expect(screen.getByRole('searchbox')).toHaveFocus()
})
