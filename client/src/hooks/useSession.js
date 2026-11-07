import { useCallback, useEffect, useRef, useState } from 'react'

export const SESSION_KEY = 'portal138.session.token'
const MAX_TIMEOUT = 2_147_483_647

function readToken() {
  try {
    return window.sessionStorage.getItem(SESSION_KEY) || null
  } catch {
    return null
  }
}

function storeToken(token) {
  try {
    if (token) window.sessionStorage.setItem(SESSION_KEY, token)
    else window.sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // A browser that blocks storage can still keep a login in memory.
  }
}

function expiresAt(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const { exp } = JSON.parse(window.atob(payload))
    return typeof exp === 'number' && Number.isFinite(exp) ? exp * 1000 : null
  } catch {
    return null
  }
}

export default function useSession() {
  const [savedToken, setSavedToken] = useState(readToken)
  const [session, setSession] = useState(null)
  const [status, setStatus] = useState(savedToken ? 'checking' : 'ready')
  const [notice, setNotice] = useState('')
  const [attempt, setAttempt] = useState(0)
  const pendingRequest = useRef(null)

  const cancelRestore = useCallback(() => {
    pendingRequest.current?.abort()
    pendingRequest.current = null
  }, [])

  const signOut = useCallback((reason) => {
    cancelRestore()
    storeToken(null)
    setSavedToken(null)
    setSession(null)
    setStatus('ready')
    setNotice(reason === 'expired' ? 'Sua sessão expirou ou não é mais válida. Entre novamente para participar.' : '')
  }, [cancelRestore])

  const signIn = useCallback((newSession) => {
    cancelRestore()
    storeToken(newSession.token)
    setSavedToken(null)
    setSession(newSession)
    setStatus('ready')
    setNotice('')
  }, [cancelRestore])

  const updateUser = useCallback((updatedUser) => {
    setSession((current) => current ? { ...current, user: { ...current.user, ...updatedUser } } : null)
  }, [])

  const retryRestore = useCallback(() => setAttempt((value) => value + 1), [])

  useEffect(() => {
    if (!savedToken) return
    const controller = new AbortController()
    pendingRequest.current = controller
    setStatus('checking')
    const timeout = window.setTimeout(() => {
      if (pendingRequest.current === controller) {
        setStatus('error')
        controller.abort()
      }
    }, 10_000)

    async function restore() {
      try {
        const response = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${savedToken}` },
          signal: controller.signal,
        })
        if (pendingRequest.current !== controller || controller.signal.aborted) return
        if (response.status === 401) {
          signOut('expired')
          return
        }
        if (!response.ok) throw new Error('Session unavailable')
        const { user } = await response.json()
        if (pendingRequest.current !== controller || controller.signal.aborted) return
        if (!user?.id || !['ADMIN', 'EDITOR', 'USER'].includes(user.role)) throw new Error('Invalid session response')
        // Roles and profile information always come from the API, never storage.
        setSession({ token: savedToken, user })
        setStatus('ready')
      } catch {
        if (pendingRequest.current === controller && !controller.signal.aborted) setStatus('error')
      } finally {
        window.clearTimeout(timeout)
      }
    }
    restore()
    return () => {
      window.clearTimeout(timeout)
      if (pendingRequest.current === controller) pendingRequest.current = null
      controller.abort()
    }
  }, [savedToken, attempt, signOut])

  useEffect(() => {
    if (!session?.token) return
    // This only schedules the UI logout. The API still verifies the JWT itself.
    const expiry = expiresAt(session.token)
    if (expiry === null) return
    let timeout
    function checkExpiry() {
      window.clearTimeout(timeout)
      const remaining = expiry - Date.now()
      if (remaining <= 0) signOut('expired')
      else timeout = window.setTimeout(checkExpiry, Math.min(remaining, MAX_TIMEOUT))
    }
    checkExpiry()
    window.addEventListener('focus', checkExpiry)
    document.addEventListener('visibilitychange', checkExpiry)
    return () => {
      window.clearTimeout(timeout)
      window.removeEventListener('focus', checkExpiry)
      document.removeEventListener('visibilitychange', checkExpiry)
    }
  }, [session?.token, signOut])

  return { session, status, notice, signIn, signOut, updateUser, retryRestore }
}
