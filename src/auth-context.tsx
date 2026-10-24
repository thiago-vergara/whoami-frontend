import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { QueryClient, useQueryClient } from '@tanstack/react-query'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import {
  clearRecovery,
  clearReturn,
  getAuthClient,
  forgetLocalAuth,
  hasRecoveryGrant,
  markRecovery,
} from './lib/auth'
import { ApiError } from './lib/api'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (count, error) =>
          count < 1 && (!(error instanceof ApiError) || error.status >= 500 || error.status === 0),
        staleTime: 15000,
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  })
}
interface AuthState {
  client: SupabaseClient | null
  session: Session | null
  ready: boolean
  error: unknown
  retry: () => void
  signOut: () => Promise<void>
  recovery: boolean
  finishRecovery: () => void
  completeAccountDeletion: () => void
}
const AuthContext = createContext<AuthState | null>(null)
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [client, setClient] = useState<SupabaseClient | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [attempt, setAttempt] = useState(0)
  const [recovery, setRecovery] = useState(false)
  const identity = useRef<string | null>(null)
  function completeAccountDeletion() {
    if (client) forgetLocalAuth(client)
    identity.current = null
    queryClient.clear()
    setSession(null)
    setRecovery(false)
    setError(null)
  }
  useEffect(() => {
    const invalid = (event: Event) => {
      if ((event as CustomEvent<{ userId: string }>).detail?.userId === identity.current)
        completeAccountDeletion()
    }
    window.addEventListener('whoami:invalid-session', invalid)
    return () => window.removeEventListener('whoami:invalid-session', invalid)
  }, [client, queryClient])
  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | undefined
    setReady(false)
    setError(null)
    getAuthClient()
      .then((auth) => {
        if (!active) return
        setClient(auth)
        const { data } = auth.auth.onAuthStateChange((event, next) => {
          if (!active) return
          const userId = next?.user.id || null
          if (identity.current !== userId) {
            queryClient.clear()
            setRecovery(userId ? hasRecoveryGrant(userId) : false)
          }
          identity.current = userId
          if (event === 'PASSWORD_RECOVERY' && userId) {
            markRecovery(userId)
            setRecovery(true)
          }
          if (event === 'SIGNED_OUT') {
            clearRecovery()
            setRecovery(false)
          }
          setSession(next)
          setReady(true)
        })
        unsubscribe = () => data.subscription.unsubscribe()
        return auth.auth.getSession().then(({ data, error: sessionError }) => {
          if (!active) return
          if (sessionError) {
            setError(sessionError)
            setReady(true)
            return
          }
          identity.current = data.session?.user.id || null
          if (data.session) setRecovery(hasRecoveryGrant(data.session.user.id))
          setSession(data.session)
          setReady(true)
        })
      })
      .catch((e) => {
        if (active) {
          setError(e)
          setReady(true)
        }
      })
    return () => {
      active = false
      unsubscribe?.()
    }
  }, [attempt, queryClient])
  async function signOut() {
    if (!client) return
    const { error } = await client.auth.signOut({ scope: 'local' })
    if (error) throw error
    queryClient.clear()
    clearReturn()
    clearRecovery()
    setRecovery(false)
    setSession(null)
  }
  return (
    <AuthContext.Provider
      value={{
        client,
        session,
        ready,
        error,
        retry: () => setAttempt((a) => a + 1),
        signOut,
        completeAccountDeletion,
        recovery,
        finishRecovery: () => {
          clearRecovery()
          setRecovery(false)
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('AuthProvider requerido')
  return value
}
