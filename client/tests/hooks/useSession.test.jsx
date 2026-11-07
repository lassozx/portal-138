import { StrictMode } from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import useSession, { SESSION_KEY } from '../../src/hooks/useSession.js'

const user = { id: 'user-1', name: 'Maria', email: 'maria@example.com', role: 'USER' }

function tokenWithExpiry(exp) {
  const encode = (value) => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ userId: user.id, exp })}.test-signature`
}

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

beforeEach(() => {
  sessionStorage.clear()
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

describe('useSession — persistência e restauração', () => {
  it('começa sem sessão nem requisição quando não há token salvo', () => {
    const { result } = renderHook(() => useSession())
    expect(result.current.status).toBe('ready')
    expect(result.current.session).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('salva somente o token e restaura a sessão em uma nova montagem', async () => {
    const token = tokenWithExpiry(Math.floor(Date.now() / 1000) + 3600)
    const first = renderHook(() => useSession())
    act(() => first.result.current.signIn({ token, user }))
    expect(first.result.current.session).toEqual({ token, user })
    expect(sessionStorage.getItem(SESSION_KEY)).toBe(token)
    expect(sessionStorage.length).toBe(1)
    expect(fetch).not.toHaveBeenCalled()
    first.unmount()

    fetch.mockResolvedValue(response({ user: { ...user, name: 'Nome atualizado na API' } }))
    const restored = renderHook(() => useSession())
    expect(restored.result.current.session).toBeNull()
    await waitFor(() => expect(restored.result.current.status).toBe('ready'))
    expect(restored.result.current.session).toEqual({ token, user: { ...user, name: 'Nome atualizado na API' } })
    expect(fetch).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({ headers: expect.objectContaining({ Authorization: `Bearer ${token}` }) }))
  })

  it.each(['USER', 'EDITOR', 'ADMIN'])('usa o papel %s retornado pela API na restauração', async (role) => {
    const token = tokenWithExpiry(Math.floor(Date.now() / 1000) + 3600)
    sessionStorage.setItem(SESSION_KEY, token)
    fetch.mockResolvedValue(response({ user: { ...user, role } }))
    const { result } = renderHook(() => useSession())
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.session.user.role).toBe(role)
  })

  it('não disponibiliza usuário nem permissões enquanto /me está pendente', async () => {
    sessionStorage.setItem(SESSION_KEY, 'token-pendente')
    let finish
    fetch.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const { result } = renderHook(() => useSession())
    expect(result.current.status).toBe('checking')
    expect(result.current.session).toBeNull()
    await act(async () => { finish(response({ user })) })
    expect(result.current.status).toBe('ready')
    expect(result.current.session.user).toEqual(user)
  })

  it('atualiza o perfil em memória sem salvar dados pessoais no armazenamento', () => {
    const { result } = renderHook(() => useSession())
    act(() => result.current.signIn({ token: 'token-da-conta', user }))
    act(() => result.current.updateUser({ name: 'Maria Silva' }))
    expect(result.current.session).toEqual({ token: 'token-da-conta', user: { ...user, name: 'Maria Silva' } })
    expect(sessionStorage.getItem(SESSION_KEY)).toBe('token-da-conta')
    expect(sessionStorage.length).toBe(1)
  })
})

describe('useSession — validade e recuperação', () => {
  it('remove a sessão inválida quando a API retorna 401', async () => {
    sessionStorage.setItem(SESSION_KEY, 'token-expirado')
    fetch.mockResolvedValue(response({ message: 'Token inválido ou expirado.' }, 401))
    const { result } = renderHook(() => useSession())
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.session).toBeNull()
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull()
  })

  it.each(['network', 'server', 'malformed'])('mantém o token e permite tentar novamente após falha %s', async (failure) => {
    sessionStorage.setItem(SESSION_KEY, 'token-salvo')
    if (failure === 'network') fetch.mockRejectedValueOnce(new TypeError('offline'))
    if (failure === 'server') fetch.mockResolvedValueOnce(response({ message: 'Indisponível' }, 503))
    if (failure === 'malformed') fetch.mockResolvedValueOnce(response({ message: 'Resposta sem usuário' }))
    fetch.mockResolvedValueOnce(response({ user }))
    const { result } = renderHook(() => useSession())
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.session).toBeNull()
    expect(sessionStorage.getItem(SESSION_KEY)).toBe('token-salvo')
    act(() => result.current.retryRestore())
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.session).toEqual({ token: 'token-salvo', user })
  })

  it('limpa o armazenamento ao sair e ignora uma restauração que termina depois', async () => {
    sessionStorage.setItem(SESSION_KEY, 'token-antigo')
    let finish
    fetch.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const { result } = renderHook(() => useSession())
    act(() => result.current.signOut())
    expect(result.current.session).toBeNull()
    expect(result.current.status).toBe('ready')
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull()
    await act(async () => { finish(response({ user: { ...user, role: 'ADMIN' } })) })
    expect(result.current.session).toBeNull()
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull()
  })

  it('não deixa uma restauração antiga substituir um login mais recente', async () => {
    sessionStorage.setItem(SESSION_KEY, 'token-antigo')
    let finish
    fetch.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const { result } = renderHook(() => useSession())
    const newSession = { token: 'token-novo', user: { ...user, id: 'user-2', name: 'Outra conta' } }
    act(() => result.current.signIn(newSession))
    await act(async () => { finish(response({ user })) })
    expect(result.current.session).toEqual(newSession)
    expect(sessionStorage.getItem(SESSION_KEY)).toBe('token-novo')
  })

  it('encerra a sessão quando o JWT expira com a página aberta', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-30T12:00:00Z'))
    const token = tokenWithExpiry(Math.floor(Date.now() / 1000) + 2)
    const { result } = renderHook(() => useSession())
    act(() => result.current.signIn({ token, user }))
    expect(result.current.session).not.toBeNull()
    act(() => vi.advanceTimersByTime(2001))
    expect(result.current.session).toBeNull()
    expect(result.current.status).toBe('ready')
    expect(result.current.notice).toBeTruthy()
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull()
  })

  it('interrompe uma restauração após 10 segundos, permite retry e ignora a resposta tardia', async () => {
    vi.useFakeTimers()
    sessionStorage.setItem(SESSION_KEY, 'token-salvo')
    let finishOldRequest
    fetch.mockImplementationOnce(() => new Promise((resolve) => { finishOldRequest = resolve }))
    fetch.mockResolvedValueOnce(response({ user }))
    const { result } = renderHook(() => useSession())
    const oldSignal = fetch.mock.calls[0][1].signal
    expect(result.current.status).toBe('checking')
    await act(async () => { vi.advanceTimersByTime(10_000) })
    expect(result.current.status).toBe('error')
    expect(result.current.session).toBeNull()
    expect(oldSignal.aborted).toBe(true)
    expect(sessionStorage.getItem(SESSION_KEY)).toBe('token-salvo')

    await act(async () => { result.current.retryRestore() })
    expect(result.current.status).toBe('ready')
    expect(result.current.session).toEqual({ token: 'token-salvo', user })
    await act(async () => { finishOldRequest(response({ user: { ...user, role: 'ADMIN' } })) })
    expect(result.current.session.user.role).toBe('USER')
    expect(result.current.status).toBe('ready')
  })

  it.each(['focus', 'visibilitychange'])('confere expiração ao receber %s após a aba ficar suspensa', (eventName) => {
    vi.useFakeTimers()
    const start = new Date('2026-10-30T12:00:00Z').getTime()
    vi.setSystemTime(start)
    const token = tokenWithExpiry(Math.floor(start / 1000) + 2)
    const { result } = renderHook(() => useSession())
    act(() => result.current.signIn({ token, user }))
    // Move o relógio sem executar o timer para representar uma aba suspensa.
    vi.setSystemTime(start + 3_000)
    act(() => (eventName === 'focus' ? window : document).dispatchEvent(new Event(eventName)))
    expect(result.current.session).toBeNull()
    expect(result.current.status).toBe('ready')
    expect(result.current.notice).toBeTruthy()
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull()
  })

  it('tolera armazenamento indisponível e mantém o login em memória', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked') })
    const { result } = renderHook(() => useSession())
    expect(result.current.status).toBe('ready')
    act(() => result.current.signIn({ token: 'token-memoria', user }))
    expect(result.current.session).toEqual({ token: 'token-memoria', user })
    act(() => result.current.signOut())
    expect(result.current.session).toBeNull()
  })

  it('restaura corretamente em StrictMode sem ressuscitar requisições canceladas', async () => {
    sessionStorage.setItem(SESSION_KEY, 'token-strict')
    fetch.mockResolvedValue(response({ user }))
    const { result } = renderHook(() => useSession(), { wrapper: StrictMode })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.session).toEqual({ token: 'token-strict', user })
    act(() => result.current.signOut())
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull()
  })
})
