import type { SupabaseClient } from '@supabase/supabase-js'
import type { AuthConfiguration } from './types'

let sharedClient: Promise<SupabaseClient> | undefined
let localSessionKey: string | undefined
export const apiOrigin = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

export function getAuthClient(): Promise<SupabaseClient> {
  sharedClient ??= (async () => {
    let config: AuthConfiguration
    const url = import.meta.env.VITE_SUPABASE_URL
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
    if (url && key) config = { url, publishableKey: key }
    else {
      const r = await fetch(`${apiOrigin}/api/v1/auth/config`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      })
      if (!r.ok) throw new Error('No pudimos conectar con Whoami. Inténtalo de nuevo.')
      config = await r.json()
    }
    if (!config.url || !config.publishableKey)
      throw new Error('El acceso aún no está configurado. Contacta al responsable de Whoami.')
    if (config.publishableKey.startsWith('sb_secret_'))
      throw new Error('La configuración pública de acceso no es válida.')
    const { createClient } = await import('@supabase/supabase-js')
    localSessionKey = `sb-${new URL(config.url).hostname.split('.')[0]}-auth-token`
    return createClient(config.url, config.publishableKey, {
      auth: {
        storageKey: localSessionKey,
        flowType: 'pkce',
        detectSessionInUrl: false,
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  })().catch((e) => {
    sharedClient = undefined
    throw e
  })
  return sharedClient
}

export function forgetLocalAuth(client: SupabaseClient) {
  void client.auth.stopAutoRefresh()
  try {
    if (localSessionKey) {
      localStorage.removeItem(localSessionKey)
      localStorage.removeItem(`${localSessionKey}-code-verifier`)
    }
  } catch {
    /* The context is also cleared when browser storage is unavailable. */
  }
  clearReturn()
  clearRecovery()
  void client.auth.signOut({ scope: 'local' }).catch(() => {
    /* The server already blocks a deleted account. */
  })
}

const returnKey = 'whoami.auth.return'
const maxReturnAge = 24 * 60 * 60 * 1000
export function safeReturnPath(path: unknown): string | null {
  if (typeof path !== 'string') return null
  return /^\/(?:eventos(?:\/nuevo|\/[a-f0-9-]{36}(?:\/(?:participantes|deseos|mi-amigo|invitar|correos|editar|sortear))?)?|perfil|join\/[A-Za-z0-9_-]{43})$/.test(
    path,
  )
    ? path
    : null
}
export function rememberReturn(path: string) {
  const safe = safeReturnPath(path)
  if (safe)
    try {
      localStorage.setItem(returnKey, JSON.stringify({ path: safe, at: Date.now() }))
    } catch {
      /* Navigation still works without storage. */
    }
}
export function pendingReturn(consume = false): string {
  try {
    const raw = localStorage.getItem(returnKey)
    if (consume) localStorage.removeItem(returnKey)
    const value = raw ? JSON.parse(raw) : null
    if (value && Date.now() - value.at >= 0 && Date.now() - value.at < maxReturnAge)
      return safeReturnPath(value.path) || '/eventos'
  } catch {
    /* An unavailable or invalid storage entry cannot become a redirect. */
  }
  return '/eventos'
}
export function clearReturn() {
  try {
    localStorage.removeItem(returnKey)
  } catch {
    /* Optional storage. */
  }
}

const recoveryKey = 'whoami.auth.recovery'
export function markRecovery(userId: string) {
  try {
    sessionStorage.setItem(
      recoveryKey,
      JSON.stringify({ userId, expires: Date.now() + 15 * 60 * 1000 }),
    )
  } catch {
    /* Recovery remains available in memory. */
  }
}
export function hasRecoveryGrant(userId: string) {
  try {
    const value = JSON.parse(sessionStorage.getItem(recoveryKey) || 'null')
    return value?.userId === userId && value.expires > Date.now()
  } catch {
    return false
  }
}
export function clearRecovery() {
  try {
    sessionStorage.removeItem(recoveryKey)
  } catch {
    /* Optional storage. */
  }
}

let exchange:
  | { code: string; promise: ReturnType<SupabaseClient['auth']['exchangeCodeForSession']> }
  | undefined
export function exchangeOnce(client: SupabaseClient, code: string) {
  // A one-use PKCE code must not be exchanged twice on a React remount.
  if (exchange?.code !== code)
    exchange = { code, promise: client.auth.exchangeCodeForSession(code) }
  return exchange.promise
}

export function authMessage(error: unknown): string {
  const e = error as { code?: string; status?: number; message?: string }
  if (
    e?.status === 429 ||
    e?.code === 'over_request_rate_limit' ||
    e?.code === 'over_email_send_rate_limit'
  )
    return 'Espera un momento antes de intentarlo de nuevo.'
  if (e?.code === 'invalid_credentials') return 'El correo o la contraseña no son correctos.'
  if (e?.code === 'email_not_confirmed')
    return 'Confirma tu correo antes de entrar. Puedes solicitar otro enlace de confirmación.'
  if (e?.code === 'weak_password')
    return 'La contraseña no cumple los requisitos de seguridad. Prueba una más larga y combina letras, números y símbolos.'
  if (e?.code === 'same_password') return 'Elige una contraseña diferente a la anterior.'
  if (
    e?.code === 'provider_disabled' ||
    (e?.code === 'validation_failed' && /provider/i.test(e.message || ''))
  )
    return 'El acceso con Google no está disponible ahora. Puedes usar correo y contraseña.'
  return 'No pudimos completar el acceso. Comprueba tu conexión e inténtalo de nuevo.'
}
