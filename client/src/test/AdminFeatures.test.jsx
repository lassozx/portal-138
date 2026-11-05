import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import AdminPanel from '../AdminPanel.jsx'

const currentUser = { id: 'admin-1', name: 'Lasso', email: 'lasso@teste.com', role: 'ADMIN' }
const people = [currentUser, { id: 'user-2', name: 'Ana', email: 'ana@teste.com', role: 'USER' }]
const ok = data => ({ ok: true, json: async () => data })
function setup(role = 'ADMIN', handler = () => { throw new Error('Requisição inesperada') }) {
  vi.stubGlobal('scrollTo', vi.fn())
  vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
    if (url.startsWith('/api/admin/posts?')) return ok({ data: [], pagination: { total: 0, totalPages: 0 } })
    if (url === '/api/categories') return ok([])
    return handler(url, options)
  }))
  return render(<AdminPanel token="token" user={{ ...currentUser, role }} onBack={vi.fn()} onLogout={vi.fn()} />)
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('mantém a gestão de usuários fora do painel dos editores', async () => {
  setup('EDITOR')
  await screen.findByRole('button', { name: 'Criar rascunho' })
  expect(screen.queryByRole('button', { name: 'Usuários', exact: true })).not.toBeInTheDocument()
  expect(fetch.mock.calls.some(([url]) => url.startsWith('/api/admin/users'))).toBe(false)
})

it('lista contas, protege o próprio perfil e envia alterações confirmadas', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  setup('ADMIN', (url, options) => {
    if (url.startsWith('/api/admin/users?')) return ok({ data: people, pagination: { total: 2, totalPages: 1 } })
    if (url === '/api/admin/users/user-2/role' && options.method === 'PATCH') return ok({})
    throw new Error(url)
  })
  fireEvent.click(screen.getByRole('button', { name: 'Usuários', exact: true }))
  expect(await screen.findByLabelText('Perfil de Lasso')).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Perfil de Ana'), { target: { value: 'EDITOR' } })
  await screen.findByText('O perfil de Ana foi atualizado para Editor.')
  const call = fetch.mock.calls.find(([url, options]) => url === '/api/admin/users/user-2/role' && options.method === 'PATCH')
  expect(JSON.parse(call[1].body)).toEqual({ role: 'EDITOR' })
  expect(call[1].headers.Authorization).toBe('Bearer token')
})

it('cancela uma alteração de acesso e pesquisa pelo nome e perfil escolhidos', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(false)
  setup('ADMIN', () => ok({ data: people, pagination: { total: 2, totalPages: 1 } }))
  fireEvent.click(screen.getByRole('button', { name: 'Usuários', exact: true }))
  await screen.findByText('Ana')
  fireEvent.change(screen.getByLabelText('Perfil de Ana'), { target: { value: 'ADMIN' } })
  expect(fetch.mock.calls.some(([, options]) => options?.method === 'PATCH')).toBe(false)
  fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar usuários' }), { target: { value: 'ana' } })
  fireEvent.change(screen.getByLabelText('Filtrar por perfil'), { target: { value: 'USER' } })
  fireEvent.click(screen.getByRole('button', { name: 'Buscar', exact: true }))
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/admin/users?page=1&limit=20&search=ana&role=USER', expect.anything()))
})

it('cria um editor pelo painel e limpa a senha após a criação', async () => {
  setup('ADMIN', (url, options) => {
    if (url.startsWith('/api/admin/users?')) return ok({ data: people, pagination: { total: 2, totalPages: 1 } })
    if (url === '/api/admin/users' && options.method === 'POST') return ok({})
    throw new Error(url)
  })
  fireEvent.click(screen.getByRole('button', { name: 'Usuários', exact: true }))
  await screen.findByText('Ana')
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Bruno' } })
  fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'bruno@teste.com' } })
  fireEvent.change(screen.getByLabelText('Senha inicial'), { target: { value: 'SenhaInicial123' } })
  fireEvent.click(screen.getByRole('button', { name: 'Criar conta', exact: true }))
  await screen.findByText('Conta criada com sucesso.')
  const call = fetch.mock.calls.find(([url, options]) => url === '/api/admin/users' && options.method === 'POST')
  expect(JSON.parse(call[1].body)).toEqual({ name: 'Bruno', email: 'bruno@teste.com', password: 'SenhaInicial123', role: 'EDITOR' })
  expect(screen.getByLabelText('Senha inicial')).toHaveValue('')
})

it('envia a imagem como arquivo e salva a URL retornada na notícia', async () => {
  const url = '/api/uploads/00000000-0000-0000-0000-000000000000.png'
  let finishUpload
  setup('EDITOR', (path, options) => {
    if (path === '/api/uploads') return new Promise(resolve => { finishUpload = () => resolve(ok({ url })) })
    if (path === '/api/posts' && options.method === 'POST') return ok({})
    throw new Error(path)
  })
  await screen.findByText('Nenhuma notícia encontrada.')
  const file = new File(['png'], 'capa.png', { type: 'image/png' })
  fireEvent.change(screen.getByLabelText('Enviar imagem de capa'), { target: { files: [file] } })
  expect(screen.getByRole('button', { name: 'Enviando imagem...' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Pré-visualizar notícia' })).toBeDisabled()
  const upload = fetch.mock.calls.find(([path]) => path === '/api/uploads')
  expect(upload[1].body).toBe(file)
  expect(upload[1].headers['Content-Type']).toBe('image/png')
  finishUpload()
  expect(await screen.findByAltText('Prévia da imagem de capa')).toHaveAttribute('src', url)
  fireEvent.change(screen.getByLabelText('Título *'), { target: { value: 'Nova notícia' } })
  fireEvent.change(screen.getByLabelText('Slug / endereço *'), { target: { value: 'nova-noticia' } })
  fireEvent.change(screen.getByLabelText('Conteúdo *'), { target: { value: 'Conteúdo da notícia.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Criar rascunho' }))
  await screen.findByText('Notícia criada como rascunho. Um administrador poderá publicá-la.')
  const save = fetch.mock.calls.find(([path, options]) => path === '/api/posts' && options.method === 'POST')
  expect(JSON.parse(save[1].body).coverImage).toBe(url)
})

it('preserva a capa anterior se o envio falhar e valida tamanho e tipo antes de enviar', async () => {
  setup('ADMIN', () => ({ ok: false, json: async () => ({ message: 'Arquivo inválido.' }) }))
  await screen.findByText('Nenhuma notícia encontrada.')
  fireEvent.change(screen.getByLabelText('URL da imagem de capa'), { target: { value: 'https://example.com/anterior.png' } })
  const input = screen.getByLabelText('Enviar imagem de capa')
  fireEvent.change(input, { target: { files: [new File(['svg'], 'capa.svg', { type: 'image/svg+xml' })] } })
  expect(screen.getByRole('alert')).toHaveTextContent('Escolha uma imagem JPG, PNG ou WebP.')
  const large = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'grande.png', { type: 'image/png' })
  fireEvent.change(input, { target: { files: [large] } })
  expect(screen.getByRole('alert')).toHaveTextContent('A imagem deve ter no máximo 5 MB.')
  expect(fetch.mock.calls.some(([url]) => url === '/api/uploads')).toBe(false)
  fireEvent.change(input, { target: { files: [new File(['png'], 'imagem.png', { type: 'image/png' })] } })
  expect(await screen.findByRole('alert')).toHaveTextContent('Arquivo inválido.')
  expect(screen.getByAltText('Prévia da imagem de capa')).toHaveAttribute('src', 'https://example.com/anterior.png')
})
