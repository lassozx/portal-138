import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import AdminPanel from '../AdminPanel'

const mockPost = {
id: 'post-1',
title: 'Notícia de teste',
slug: 'noticia-de-teste',
excerpt: 'Resumo da notícia',
content: 'Conteúdo original da notícia',
coverImage: '',
categoryId: null,
status: 'DRAFT',
category: null,
}

function mockFetch() {
return vi.fn(async (url, options = {}) => {
if (url === '/api/posts/admin?limit=100') {
return {
ok: true,
json: async () => ({ data: [mockPost] }),
}
}

if (url === '/api/categories') {
  return {
    ok: true,
    json: async () => ({ data: [] }),
  }
}

if (url === '/api/posts/post-1' && options.method === 'PUT') {
  return {
    ok: true,
    json: async () => ({ data: { ...mockPost } }),
  }
}

return {
  ok: false,
  json: async () => ({ message: 'Erro simulado pela API.' }),
}

})
}

function renderPanel(role = 'EDITOR') {
return render(
<AdminPanel
token="token-de-teste"
user={{ id: 'user-1', name: 'Usuário de teste', role }}
onLogout={vi.fn()}
onBack={vi.fn()}
/>,
)
}

describe('AdminPanel — permissões e edição de notícias', () => {
beforeEach(() => {
vi.stubGlobal('fetch', mockFetch())
vi.stubGlobal('scrollTo', vi.fn())
})

afterEach(() => {
cleanup()
vi.restoreAllMocks()
vi.unstubAllGlobals()
})

it('permite que ADMIN veja o seletor de status ao editar uma notícia', async () => {
renderPanel('ADMIN')

await screen.findByText('Notícia de teste')
fireEvent.click(screen.getByRole('button', { name: 'Editar' }))

expect(await screen.findByLabelText('Status')).toBeInTheDocument()

})

it('não mostra o seletor de status para EDITOR', async () => {
renderPanel('EDITOR')

await screen.findByText('Notícia de teste')
fireEvent.click(screen.getByRole('button', { name: 'Editar' }))

await screen.findByRole('heading', { name: 'Editar notícia' })

expect(screen.queryByLabelText('Status')).not.toBeInTheDocument()

})

it('permite que EDITOR edite uma notícia sem enviar o campo status', async () => {
const fetchMock = mockFetch()
vi.stubGlobal('fetch', fetchMock)

renderPanel('EDITOR')

await screen.findByText('Notícia de teste')
fireEvent.click(screen.getByRole('button', { name: 'Editar' }))

const titleInput = screen.getByRole('textbox', { name: /Título/i })
fireEvent.change(titleInput, {
  target: { value: 'Título atualizado pelo editor' },
})

fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))

await screen.findByRole('status')

const updateCall = fetchMock.mock.calls.find(
  ([url, options]) =>
    url === '/api/posts/post-1' && options?.method === 'PUT',
)

expect(updateCall).toBeDefined()

const payload = JSON.parse(updateCall[1].body)

expect(payload.title).toBe('Título atualizado pelo editor')
expect(payload).not.toHaveProperty('status')

})

it('mostra uma mensagem quando a API falha ao carregar os dados', async () => {
vi.stubGlobal(
'fetch',
vi.fn(async () => ({
ok: false,
json: async () => ({ message: 'Falha ao carregar dados.' }),
})),
)

renderPanel('EDITOR')

expect(await screen.findByRole('alert')).toHaveTextContent(
  'Falha ao carregar dados.',
)

})
})
