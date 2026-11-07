import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import AdminPanel from '../../src/pages/AdminPanel'

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
if (url === '/api/admin/posts?limit=20&page=1') {
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


describe('AdminPanel — prévia antes de salvar', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch())
    vi.stubGlobal('scrollTo', vi.fn())
  })
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })

  it('exibe os campos não salvos e preserva o formulário sem enviar alterações à API', async () => {
    renderPanel('EDITOR')
    await screen.findByText('Notícia de teste')
    fireEvent.change(screen.getByLabelText('Título *'), { target: { value: 'Nova história da escola' } })
    fireEvent.change(screen.getByLabelText('Resumo'), { target: { value: 'Um resumo para a capa' } })
    const content = 'Primeiro parágrafo.\n\n<script>texto que não deve executar</script>'
    fireEvent.change(screen.getByLabelText('Conteúdo *'), { target: { value: content } })
    fireEvent.change(screen.getByLabelText('URL da imagem de capa'), { target: { value: 'https://example.com/capa.jpg' } })
    fireEvent.click(screen.getByRole('button', { name: 'Pré-visualizar notícia' }))
    const preview = screen.getByRole('region', { name: 'Prévia da notícia' })
    expect(within(preview).getByRole('heading', { name: 'Nova história da escola' })).toBeVisible()
    expect(within(preview).getByText('Um resumo para a capa')).toBeVisible()
    expect(within(preview).getByText('Usuário de teste')).toBeVisible()
    expect(within(preview).getByRole('presentation')).toHaveAttribute('src', 'https://example.com/capa.jpg')
    expect(preview.textContent).toContain(content)
    expect(preview.querySelector('script')).toBeNull()
    expect(fetch.mock.calls.every(([, options]) => !options?.method)).toBe(true)
    expect(screen.queryByRole('button', { name: 'Criar rascunho' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Escrever' }))
    expect(screen.getByLabelText('Título *')).toHaveValue('Nova história da escola')
    expect(screen.getByLabelText('Conteúdo *')).toHaveValue(content)
    expect(screen.getByLabelText('Slug / endereço *')).toHaveValue('nova-historia-da-escola')
  })

  it('permite visualizar um formulário vazio sem exigir campos nem publicar', async () => {
    renderPanel()
    await screen.findByText('Notícia de teste')
    fireEvent.click(screen.getByRole('button', { name: 'Pré-visualizar notícia' }))
    expect(screen.getByRole('heading', { name: 'Título da notícia' })).toBeVisible()
    expect(screen.getByText('O conteúdo da sua notícia aparecerá aqui.')).toBeVisible()
    expect(fetch.mock.calls.every(([, options]) => !options?.method)).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Escrever' }))
    expect(screen.getByLabelText('Título *')).toHaveValue('')
  })

  it('retorna à escrita ao editar e ao cancelar, sem perder a seleção de status', async () => {
    renderPanel('ADMIN')
    await screen.findByText('Notícia de teste')
    fireEvent.click(screen.getByRole('button', { name: 'Pré-visualizar notícia' }))
    fireEvent.click(screen.getByRole('button', { name: 'Editar', exact: true }))
    expect(screen.queryByRole('region', { name: 'Prévia da notícia' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'PUBLISHED' } })
    fireEvent.click(screen.getByRole('button', { name: 'Pré-visualizar notícia' }))
    fireEvent.click(screen.getByRole('button', { name: 'Escrever' }))
    expect(screen.getByLabelText('Status')).toHaveValue('PUBLISHED')
    fireEvent.click(screen.getByRole('button', { name: 'Pré-visualizar notícia' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('region', { name: 'Prévia da notícia' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Título *')).toHaveValue('')
  })
})

describe('AdminPanel — paginação e criação por perfil', () => {
  let records
  beforeEach(() => {
    records = Array.from({ length: 101 }, (_, index) => ({ ...mockPost, id: `post-${index + 1}`, title: `Publicação ${index + 1}`, slug: `publicacao-${index + 1}` }))
    vi.stubGlobal('scrollTo', vi.fn())
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
      if (url.startsWith('/api/admin/posts?')) {
        const params = new URL(url, 'http://localhost').searchParams
        const page = Number(params.get('page'))
        const limit = Number(params.get('limit'))
        return { ok: true, json: async () => ({ data: records.slice((page - 1) * limit, page * limit), pagination: { page, limit, total: records.length, totalPages: Math.ceil(records.length / limit) } }) }
      }
      if (url === '/api/categories') return { ok: true, json: async () => [] }
      if (options.method === 'DELETE') {
        records = records.filter((post) => `/api/posts/${post.id}` !== url)
        return { ok: true, json: async () => ({}) }
      }
      if (url === '/api/posts' && options.method === 'POST') return { ok: true, json: async () => ({}) }
      throw new Error(`Requisição inesperada: ${url}`)
    }))
  })
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

  async function lastPage() {
    await screen.findByText('Página 1 de 6')
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    for (let page = 2; page <= 6; page++) {
      fireEvent.click(screen.getByRole('button', { name: 'Próxima' }))
      await screen.findByText(`Página ${page} de 6`)
      await waitFor(() => expect(screen.queryByText('Carregando notícias...')).not.toBeInTheDocument())
    }
  }

  it('alcança a notícia 101, mostra total global e permite voltar', async () => {
    renderPanel('ADMIN')
    await lastPage()
    expect(await screen.findByText('Publicação 101')).toBeVisible()
    expect(screen.getByText('1 de 101')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled()
    expect(fetch).toHaveBeenCalledWith('/api/admin/posts?limit=20&page=6', expect.anything())
    expect(screen.queryByText('Publicação 1')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }))
    await screen.findByText('Publicação 81')
    expect(screen.getByText('20 de 101')).toBeVisible()
  })

  it('retorna à última página válida após excluir sua única notícia', async () => {
    renderPanel('ADMIN')
    await lastPage()
    await screen.findByText('Publicação 101')
    fireEvent.click(screen.getByRole('button', { name: 'Excluir notícia' }))
    await screen.findByText('Página 5 de 5')
    expect(await screen.findByText('Publicação 100')).toBeVisible()
    expect(screen.queryByText('Publicação 101')).not.toBeInTheDocument()
    expect(screen.getByText('20 de 100')).toBeVisible()
  })

  it('permite repetir o carregamento da página que falhou', async () => {
    const original = fetch.getMockImplementation()
    let fail = true
    fetch.mockImplementation((url, options) => {
      if (url.endsWith('page=2') && fail) { fail = false; return Promise.resolve({ ok: false, json: async () => ({ message: 'Falha temporária' }) }) }
      return original(url, options)
    })
    renderPanel()
    await screen.findByText('Página 1 de 6')
    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Publicação 21')).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it.each(['EDITOR', 'ADMIN'])('orienta corretamente %s após criar um rascunho', async (role) => {
    records = [mockPost]
    renderPanel(role)
    await screen.findByText('Notícia de teste')
    fireEvent.change(screen.getByLabelText('Título *'), { target: { value: 'Novo projeto escolar' } })
    fireEvent.change(screen.getByLabelText('Slug / endereço *'), { target: { value: 'novo-projeto-escolar' } })
    fireEvent.change(screen.getByLabelText('Conteúdo *'), { target: { value: 'Uma notícia para a comunidade.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar rascunho' }))
    const message = role === 'ADMIN' ? 'Notícia criada como rascunho. Você pode editá-la para publicar.' : 'Notícia criada como rascunho. Um administrador poderá publicá-la.'
    expect(await screen.findByRole('status')).toHaveTextContent(message)
    const call = fetch.mock.calls.find(([url, options]) => url === '/api/posts' && options.method === 'POST')
    expect(JSON.parse(call[1].body)).not.toHaveProperty('status')
  })
})
