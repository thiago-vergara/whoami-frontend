import { vi } from 'vitest'
import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js'
import type { EventView, Profile } from '../lib/types'

export const userId = '11111111-1111-4111-8111-111111111111'
export const otherId = '22222222-2222-4222-8222-222222222222'
export const eventId = '33333333-3333-4333-8333-333333333333'
export const token = 'A'.repeat(43)
export const profile: Profile = {
  id: userId,
  fullName: 'Lucía Vargas',
  email: 'lucia@example.test',
  phone: null,
  avatarUrl: null,
}
export const event: EventView = {
  id: eventId,
  title: 'Amigos de siempre',
  description: 'Un encuentro para compartir.',
  status: 'OPEN',
  organizerId: userId,
  drawAt: '2030-12-12T17:00:00Z',
  exchangeAt: '2030-12-19T23:30:00Z',
  timezone: 'America/Lima',
  autoDraw: false,
  createdAt: '2030-01-01T12:00:00Z',
  modality: 'IN_PERSON',
  address: 'Dirección privada del encuentro',
  platform: null,
  meetingUrl: null,
  giftBudgetMinor: 8500,
  currency: 'PEN',
  drawnAt: null,
  version: 1,
  participantCount: 1,
  participants: [{ userId: otherId, fullName: 'Valeria Torres' }],
  coverImage: '/images/default-event.svg',
  blockedReason: null,
}
export const session = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  user: {
    id: userId,
    email: profile.email,
    app_metadata: {},
    user_metadata: { full_name: profile.fullName },
    aud: 'authenticated',
    created_at: '2030-01-01',
  },
} as Session

export function fakeAuth(initial: Session | null = session) {
  let current = initial
  const listeners = new Set<(event: AuthChangeEvent, next: Session | null) => void>()
  function emit(type: AuthChangeEvent, next: Session | null) {
    current = next
    listeners.forEach((fn) => fn(type, next))
  }
  const auth = {
    stopAutoRefresh: vi.fn(),
    getSession: vi.fn(async () => ({ data: { session: current }, error: null })),
    onAuthStateChange: vi.fn((cb: (event: AuthChangeEvent, next: Session | null) => void) => {
      listeners.add(cb)
      return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } }
    }),
    refreshSession: vi.fn(async () => ({ data: { session: current }, error: null })),
    signInWithPassword: vi.fn(async () => {
      emit('SIGNED_IN', session)
      return { data: { session, user: session.user }, error: null }
    }),
    signUp: vi.fn(async () => ({ data: { session: null, user: session.user }, error: null })),
    signInWithOAuth: vi.fn(async () => ({
      data: { provider: 'google', url: 'https://accounts.google.com' },
      error: null,
    })),
    resend: vi.fn(async () => ({ data: {}, error: null })),
    resetPasswordForEmail: vi.fn(async () => ({ data: {}, error: null })),
    exchangeCodeForSession: vi.fn(async () => {
      emit('SIGNED_IN', session)
      return { data: { session, user: session.user }, error: null }
    }),
    updateUser: vi.fn(async () => ({ data: { user: session.user }, error: null })),
    signOut: vi.fn(async () => {
      emit('SIGNED_OUT', null)
      return { error: null }
    }),
  }
  return { client: { auth } as unknown as SupabaseClient, auth, emit }
}
export function json(data: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
