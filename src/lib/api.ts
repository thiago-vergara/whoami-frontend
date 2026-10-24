import { apiOrigin, getAuthClient } from './auth'
import type {
  Assignment,
  DrawResult,
  EventRequest,
  EventSummary,
  EventView,
  Invitation,
  InvitationPreview,
  NotificationStats,
  Participant,
  Profile,
  UploadTicket,
  Wish,
  WishRequest,
} from './types'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
interface RequestOptions {
  method?: string
  body?: unknown
  signal?: AbortSignal
  public?: boolean
  blob?: boolean
  closingSession?: boolean
}
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const client = options.public ? null : await getAuthClient()
  let token: string | undefined
  let userId: string | undefined
  if (client) {
    const { data, error } = await client.auth.getSession()
    if (error || !data.session)
      throw new ApiError(401, 'Tu sesión terminó. Entra de nuevo para continuar.')
    token = data.session.access_token
    userId = data.session.user.id
  }
  const send = (accessToken?: string) =>
    fetch(`${apiOrigin}/api/v1${path}`, {
      method: options.method || 'GET',
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(20000)])
        : AbortSignal.timeout(20000),
      cache: 'no-store',
      credentials: 'omit',
      headers: {
        Accept: options.blob ? 'image/png' : 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(options.body !== undefined && !(options.body instanceof FormData)
          ? { 'Content-Type': 'application/json' }
          : {}),
      },
      body:
        options.body instanceof FormData
          ? options.body
          : options.body !== undefined
            ? JSON.stringify(options.body)
            : undefined,
    })
  let response: Response
  try {
    response = await send(token)
    if (response.status === 401 && client) {
      const { data, error } = await client.auth.refreshSession()
      if (!error && data.session) {
        if (data.session.user.id !== userId)
          throw new ApiError(401, 'Tu sesión cambió. Entra de nuevo para continuar.')
        response = await send(data.session.access_token)
      }
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, 'No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.')
  }
  if (!response.ok) {
    const problem = (await response.json().catch(() => ({}))) as { detail?: string }
    const defaults: Record<number, string> = {
      401: 'Tu sesión terminó. Entra de nuevo para continuar.',
      403: 'No puedes realizar esta acción.',
      404: 'No podemos mostrar este contenido.',
      409: 'El evento cambió. Revisa su estado antes de continuar.',
      503: 'Esta función no está disponible ahora.',
    }
    if (response.status === 401 && userId)
      window.dispatchEvent(new CustomEvent('whoami:invalid-session', { detail: { userId } }))
    throw new ApiError(
      response.status,
      response.status === 401 || response.status === 404
        ? defaults[response.status]
        : problem.detail || defaults[response.status] || 'No se pudo completar la operación.',
    )
  }
  const result =
    response.status === 204
      ? undefined
      : options.blob
        ? await response.blob()
        : await response.json()
  if (client) {
    const { data } = await client.auth.getSession()
    if (data.session?.user.id !== userId && !(options.closingSession && !data.session))
      throw new ApiError(401, 'Tu sesión cambió. Entra de nuevo para continuar.')
  }
  return result as T
}
const eventPath = (id: string) => `/events/${encodeURIComponent(id)}`
export const api = {
  profile: (signal?: AbortSignal) => request<Profile>('/me', { signal }),
  updateProfile: (body: { fullName: string; phone: string | null }) =>
    request<Profile>('/me', { method: 'PUT', body }),
  uploadAvatar: (file: File) => {
    const body = new FormData()
    body.append('file', file)
    return request<Profile>('/me/avatar', { method: 'POST', body })
  },
  deleteAccount: (confirmation: string) =>
    request<{ status: string; requestedAt: string }>('/me', {
      method: 'DELETE',
      body: { confirmation },
      closingSession: true,
    }),
  uploadTicket: (file: File) =>
    request<UploadTicket>('/me/avatar/uploads', {
      method: 'POST',
      body: { contentType: file.type, sizeBytes: file.size },
    }),
  confirmAvatar: (id: string) =>
    request<Profile>(`/me/avatar/uploads/${encodeURIComponent(id)}/confirm`, { method: 'POST' }),
  events: (page = 0, signal?: AbortSignal) =>
    request<EventSummary[]>(`/events?page=${page}&size=20`, { signal }),
  event: (id: string, signal?: AbortSignal) => request<EventView>(eventPath(id), { signal }),
  saveEvent: (body: EventRequest, id?: string) =>
    request<EventView>(id ? eventPath(id) : '/events', { method: id ? 'PUT' : 'POST', body }),
  cancel: (id: string) => request<void>(`${eventPath(id)}/cancel`, { method: 'POST' }),
  invitation: (id: string, signal?: AbortSignal) =>
    request<Invitation>(`${eventPath(id)}/invitation`, { signal }),
  sendInvitation: (id: string, email: string, requestId: string) =>
    request<{ id: string; status: string }>(`${eventPath(id)}/invitation/email`, {
      method: 'POST',
      body: { email, requestId },
    }),
  qr: (id: string, signal?: AbortSignal) =>
    request<Blob>(`${eventPath(id)}/invitation/qr`, { signal, blob: true }),
  preview: (token: string, signal?: AbortSignal) =>
    request<InvitationPreview>(`/invitations/${encodeURIComponent(token)}`, {
      public: true,
      signal,
    }),
  joinInvitation: (token: string) =>
    request<EventView>(`/invitations/${encodeURIComponent(token)}/join`, { method: 'POST' }),
  joinOrganizer: (id: string) =>
    request<EventView>(`${eventPath(id)}/participants/me`, { method: 'POST' }),
  leave: (id: string) => request<void>(`${eventPath(id)}/participants/me`, { method: 'DELETE' }),
  remove: (id: string, userId: string) =>
    request<void>(`${eventPath(id)}/participants/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    }),
  participants: (id: string, page = 0, signal?: AbortSignal) =>
    request<Participant[]>(`${eventPath(id)}/participants?page=${page}&size=50`, { signal }),
  wishlist: (id: string, signal?: AbortSignal) =>
    request<Wish[]>(`${eventPath(id)}/wishlist`, { signal }),
  addWish: (id: string, body: WishRequest) =>
    request<Wish>(`${eventPath(id)}/wishlist`, { method: 'POST', body }),
  deleteWish: (id: string, wish: string) =>
    request<void>(`${eventPath(id)}/wishlist/${encodeURIComponent(wish)}`, { method: 'DELETE' }),
  draw: (id: string) => request<DrawResult>(`${eventPath(id)}/draw`, { method: 'POST' }),
  assignment: (id: string, signal?: AbortSignal) =>
    request<Assignment>(`${eventPath(id)}/assignment`, { signal }),
  notifications: (id: string, signal?: AbortSignal) =>
    request<NotificationStats>(`${eventPath(id)}/notifications`, { signal }),
  retryNotifications: (id: string) =>
    request<void>(`${eventPath(id)}/notifications/retry`, { method: 'POST' }),
}

export async function organizerParticipates(
  event: EventView,
  userId: string,
  signal?: AbortSignal,
): Promise<boolean> {
  if (event.organizerId !== userId || event.participants.some((p) => p.userId === userId))
    return true
  if (event.participants.length < 50) return false
  // Absence from the first 50 does not mean absence from the event.
  for (let page = 1; ; page++) {
    const members = await api.participants(event.id, page, signal)
    if (members.some((p) => p.userId === userId)) return true
    if (members.length < 50) return false
  }
}
