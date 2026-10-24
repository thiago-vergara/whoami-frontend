import { StrictMode } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { AuthProvider, createQueryClient } from '../auth-context'
import { routes } from '../app'
import {
  event,
  eventId,
  fakeAuth,
  json,
  otherId,
  profile,
  session,
  token,
  userId,
} from './fixtures'
import type { EventView, Wish } from '../lib/types'

const mocked = vi.hoisted(() => ({ getAuthClient: vi.fn() }))
vi.mock('../lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/auth')>()),
  getAuthClient: mocked.getAuthClient,
}))
vi.mock('../components/AvatarCropDialog', () => ({
  default: ({
    onCancel,
    onSave,
  }: {
    onCancel: () => void
    onSave: (file: File) => Promise<void>
  }) => (
    <div role="dialog" aria-label="Recortar foto">
      <button onClick={onCancel}>Cancelar recorte</button>
      <button
        onClick={() => {
          void onSave(new File(['cropped'], 'avatar.jpg', { type: 'image/jpeg' })).catch(() => {})
        }}
      >
        Guardar recorte
      </button>
    </div>
  ),
}))
let currentEvent: EventView
let wishes: Wish[]
let calls: { path: string; method: string; body: unknown; headers: HeadersInit | undefined }[]
let override: ((path: string, options: RequestInit) => Response | undefined) | undefined
function backend(path: string, options: RequestInit = {}): Response {
  const method = options.method || 'GET'
  const body =
    options.body instanceof FormData
      ? options.body
      : options.body
        ? JSON.parse(String(options.body))
        : undefined
  calls.push({ path, method, body, headers: options.headers })
  const overridden = override?.(path, options)
  if (overridden) return overridden
  if (path === '/api/v1/me') return json(method === 'PUT' ? { ...profile, ...body } : profile)
  if (path.startsWith('/api/v1/events?')) return json([currentEvent])
  if (path === '/api/v1/events' && method === 'POST') {
    currentEvent = { ...currentEvent, ...body }
    return json(currentEvent, 201)
  }
  if (path === `/api/v1/events/${eventId}`) return json(currentEvent)
  if (path.includes(`/api/v1/invitations/${token}`))
    return json(
      method === 'POST'
        ? currentEvent
        : {
            eventId,
            title: currentEvent.title,
            description: 'Una invitación para ti.',
            drawAt: currentEvent.drawAt,
            exchangeAt: currentEvent.exchangeAt,
            giftBudgetMinor: 8500,
            organizerName: 'Lucía Vargas',
            status: currentEvent.status,
          },
    )
  if (path.endsWith('/participants/me') && method === 'POST') {
    currentEvent = {
      ...currentEvent,
      participantCount: 2,
      participants: [...currentEvent.participants, { userId, fullName: profile.fullName }],
    }
    return json(currentEvent)
  }
  if (path.endsWith('/participants/me') && method === 'DELETE') return json(null, 204)
  if (path.includes('/participants?')) return json(currentEvent.participants)
  if (path.includes('/participants/') && method === 'DELETE') {
    currentEvent = { ...currentEvent, participantCount: 0, participants: [] }
    return json(null, 204)
  }
  if (path.endsWith('/wishlist')) {
    if (method === 'POST') {
      const wish = { ...body, id: 'wish-new' }
      wishes.push(wish)
      return json(wish, 201)
    }
    return json(wishes)
  }
  if (path.includes('/wishlist/') && method === 'DELETE') {
    wishes = []
    return json(null, 204)
  }
  if (path.endsWith('/draw')) {
    currentEvent = { ...currentEvent, status: 'DRAWN', drawnAt: '2030-12-12T17:00:00Z' }
    return json({
      eventId,
      participantCount: currentEvent.participantCount,
      drawnAt: currentEvent.drawnAt,
    })
  }
  if (path.endsWith('/assignment'))
    return json({
      recipientId: otherId,
      fullName: 'Valeria Torres',
      wishlist: [
        {
          id: 'private-wish',
          title: 'Un libro de fotografía',
          referencePlace: 'Librería del barrio',
          referenceUrl: null,
        },
      ],
    })
  if (path.endsWith('/notifications')) return json({ PENDING: 2, SENDING: 1, SENT: 3, FAILED: 1 })
  if (path.endsWith('/notifications/retry')) return json(null, 204)
  if (path.endsWith('/invitation/email')) return json({ id: 'email-test', status: 'PENDING' }, 202)
  if (path.endsWith('/invitation'))
    return json({ token, url: `http://localhost:3000/join/${token}` })
  if (path.endsWith('/invitation/qr'))
    return new Response(new Blob(['png'], { type: 'image/png' }), {
      headers: { 'Content-Type': 'image/png' },
    })
  if (path.endsWith('/cancel')) {
    currentEvent = { ...currentEvent, status: 'CANCELLED' }
    return json(null, 204)
  }
  throw new Error(`Unexpected fixture endpoint: ${method} ${path}`)
}
function mount(path: string, initial: Session | null = session, strict = false) {
  const auth = fakeAuth(initial)
  mocked.getAuthClient.mockResolvedValue(auth.client)
  const client = createQueryClient()
  client.setDefaultOptions({ queries: { retry: false, gcTime: 0 }, mutations: { retry: false } })
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const app = (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  )
  render(strict ? <StrictMode>{app}</StrictMode> : app)
  return { auth, router, client, user: userEvent.setup() }
}
function participate() {
  currentEvent = {
    ...currentEvent,
    participantCount: 2,
    participants: [...currentEvent.participants, { userId, fullName: profile.fullName }],
  }
}
beforeEach(() => {
  currentEvent = structuredClone(event)
  wishes = []
  calls = []
  override = undefined
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request, options?: RequestInit) =>
      backend(String(input), options),
    ),
  )
  window.history.replaceState({}, '', '/')
})
describe('Acceso e invitaciones', () => {
  it('la invitación pública no solicita participantes ni ubicación privada', async () => {
    mount(`/join/${token}`, null)
    expect(await screen.findByRole('heading', { name: 'Amigos de siempre' })).toBeInTheDocument()
    expect(screen.queryByText(event.address!)).not.toBeInTheDocument()
    expect(screen.queryByText('Valeria Torres')).not.toBeInTheDocument()
    expect(calls.every((c) => c.path.includes('/invitations/'))).toBe(true)
    expect(screen.getByRole('link', { name: /Entrar para unirme/ })).toHaveAttribute(
      'href',
      '/login',
    )
    expect(calls.some((c) => c.method === 'POST')).toBe(false)
  })
  it('protege rutas privadas y conserva la invitación al iniciar sesión', async () => {
    localStorage.setItem(
      'whoami.auth.return',
      JSON.stringify({ path: `/join/${token}`, at: Date.now() }),
    )
    const { auth, user } = mount('/login', null)
    await user.type(await screen.findByLabelText(/Correo electrónico/), 'lucia@example.test')
    await user.type(screen.getByLabelText(/^Contraseña/), 'Clave-local-123')
    await user.click(screen.getByRole('button', { name: /^Entrar/ }))
    await screen.findByRole('button', { name: /Unirme al intercambio/ })
    expect(auth.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'lucia@example.test',
      password: 'Clave-local-123',
    })
    expect(calls.some((c) => c.method === 'POST')).toBe(false)
  })
  it('el registro sin sesión muestra confirmación, sin afirmar que ya inició sesión', async () => {
    const { auth, user } = mount('/registro', null)
    await user.type(await screen.findByLabelText(/Nombre completo/), 'Lucía Vargas')
    await user.type(screen.getByLabelText(/Correo electrónico/), 'lucia@example.test')
    await user.type(screen.getByLabelText(/^Contraseña/), 'Clave-local-123')
    await user.click(screen.getByRole('button', { name: /Crear mi cuenta/ }))
    expect(await screen.findByRole('heading', { name: 'Revisa tu correo.' })).toBeInTheDocument()
    expect(auth.auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          data: { full_name: 'Lucía Vargas' },
          emailRedirectTo: expect.stringContaining('/auth/callback'),
        }),
      }),
    )
    expect(screen.queryByText('Tus próximos encuentros')).not.toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })
  it('Google usa el mismo callback PKCE, sin enviar contraseñas al backend', async () => {
    const { auth, user } = mount('/login', null)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Continuar con Google/ })).toBeEnabled(),
    )
    await user.click(screen.getByRole('button', { name: /Continuar con Google/ }))
    expect(auth.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: expect.stringContaining('/auth/callback') },
    })
    expect(calls).toHaveLength(0)
  })
  it('canjea una sola vez el código aunque React remonte el callback', async () => {
    window.history.replaceState({}, '', '/auth/callback?code=one-use-test-code')
    const { auth } = mount('/auth/callback?code=one-use-test-code', null, true)
    await screen.findByRole('heading', { name: 'Tus próximos encuentros' })
    expect(auth.auth.exchangeCodeForSession).toHaveBeenCalledTimes(1)
    expect(window.location.search).toBe('')
  })
  it('el acceso normal no permite abrir directamente el formulario de recuperación', async () => {
    mount('/auth/nueva-clave')
    expect(
      await screen.findByText(/Necesitas un enlace de recuperación válido/),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText(/Nueva contraseña/)).not.toBeInTheDocument()
  })
})
describe('Organizar y participar', () => {
  it('crear organización no inscribe al organizador; participar es una operación explícita', async () => {
    const { user } = mount(`/eventos/${eventId}`)
    const join = await screen.findByRole('button', { name: /Participar también/ })
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0)
    expect(screen.queryByRole('link', { name: 'Mis deseos' })).not.toBeInTheDocument()
    await user.click(join)
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Participar también/ })).not.toBeInTheDocument(),
    )
    expect(await screen.findByRole('link', { name: 'Mis deseos' })).toBeInTheDocument()
    expect(
      calls.filter((c) => c.path.endsWith('/participants/me') && c.method === 'POST'),
    ).toHaveLength(1)
  })
  it('valida el mínimo matemático y nunca sortea por visitar la confirmación', async () => {
    mount(`/eventos/${eventId}/sortear`)
    const draw = await screen.findByRole('button', { name: /Realizar sorteo único/ })
    expect(draw).toBeDisabled()
    expect(calls.some((c) => c.path.endsWith('/draw'))).toBe(false)
  })
  it('sortea una sola vez y no consulta asignaciones del grupo', async () => {
    participate()
    const { user } = mount(`/eventos/${eventId}/sortear`)
    await user.click(await screen.findByRole('button', { name: /Realizar sorteo único/ }))
    await screen.findByText(/Cada participante puede consultar su amigo secreto; los correos/)
    expect(calls.filter((c) => c.path.endsWith('/draw'))).toHaveLength(1)
    expect(calls.some((c) => c.path.endsWith('/assignment'))).toBe(false)
    expect(screen.queryByRole('link', { name: /Preparar sorteo/ })).not.toBeInTheDocument()
  })
  it('las expulsiones requieren confirmación y no muestran datos de contacto', async () => {
    const { user } = mount(`/eventos/${eventId}/participantes`)
    await user.click(await screen.findByRole('button', { name: 'Retirar a Valeria Torres' }))
    const dialog = screen.getByRole('dialog', { name: '¿Retirar a Valeria Torres?' })
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false)
    await user.click(within(dialog).getByRole('button', { name: 'Retirar participante' }))
    await waitFor(() => expect(screen.queryByText('Valeria Torres')).not.toBeInTheDocument())
    expect(calls.filter((c) => c.method === 'DELETE' && c.path.endsWith(otherId))).toHaveLength(1)
    expect(screen.queryByText('lucia@example.test')).not.toBeInTheDocument()
  })
  it('un evento cancelado conserva los datos y elimina acciones de cambio', async () => {
    currentEvent.status = 'CANCELLED'
    participate()
    mount(`/eventos/${eventId}`)
    await screen.findByText(/Este evento fue cancelado/)
    expect(screen.queryByRole('link', { name: /Editar el evento/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Salir del intercambio/ })).not.toBeInTheDocument()
  })
  it('envía fechas, modalidad y céntimos con el contrato de Spring', async () => {
    const { user } = mount('/eventos/nuevo')
    await user.type(await screen.findByLabelText(/Título del evento/), 'Intercambio del barrio')
    await user.type(screen.getByLabelText(/^Descripción/), 'Un encuentro entre vecinos')
    fireEvent.change(screen.getByLabelText(/Día del sorteo/), { target: { value: '2035-12-12' } })
    fireEvent.change(screen.getByLabelText(/Fecha y hora del intercambio/), {
      target: { value: '2035-12-19T18:30' },
    })
    await user.type(screen.getByLabelText(/Dirección del encuentro/), 'Calle del encuentro 123')
    await user.type(screen.getByLabelText(/Valor aproximado del regalo/), '85.50')
    await user.click(screen.getByRole('button', { name: /Crear mi evento/ }))
    await screen.findByText(/Tu evento está listo/)
    expect(
      calls.find((c) => c.path === '/api/v1/events' && c.method === 'POST')?.body,
    ).toMatchObject({
      giftBudgetMinor: 8550,
      exchangeAt: '2035-12-19T23:30:00Z',
      autoDraw: false,
      modality: 'IN_PERSON',
      meetingUrl: null,
    })
    expect(calls.some((c) => c.path.endsWith('/participants/me') && c.method === 'POST')).toBe(
      false,
    )
  })
})
describe('Privacidad, deseos y correos', () => {
  it('añade y elimina deseos propios con referencia sin editar listas ajenas', async () => {
    participate()
    const { user } = mount(`/eventos/${eventId}/deseos`)
    await waitFor(() => expect(screen.getByRole('button', { name: /Añadir deseo/ })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: /Añadir deseo/ }))
    await user.type(screen.getByLabelText(/Título del deseo/), 'Una planta pequeña')
    await user.type(screen.getByLabelText(/Lugar de referencia/), 'Vivero del barrio')
    await user.click(screen.getByRole('button', { name: 'Guardar deseo' }))
    expect(await screen.findByRole('heading', { name: 'Una planta pequeña' })).toBeInTheDocument()
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
      title: 'Una planta pequeña',
      referenceUrl: null,
      referencePlace: 'Vivero del barrio',
    })
    await user.click(screen.getByRole('button', { name: 'Eliminar Una planta pequeña' }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar deseo' }),
    )
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Una planta pequeña' })).not.toBeInTheDocument(),
    )
  })
  it('consulta el resultado solo al revelar y lo borra al ocultar', async () => {
    participate()
    currentEvent.status = 'DRAWN'
    currentEvent.drawnAt = event.drawAt
    const { user, client } = mount(`/eventos/${eventId}/mi-amigo`)
    const reveal = await screen.findByRole('button', { name: /Ver mi amigo secreto/ })
    expect(screen.queryByText('Valeria Torres')).not.toBeInTheDocument()
    expect(calls.some((c) => c.path.endsWith('/assignment'))).toBe(false)
    await user.click(reveal)
    expect(await screen.findByRole('heading', { name: 'Valeria Torres' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Un libro de fotografía' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Ocultar nombre/ }))
    expect(screen.queryByText('Valeria Torres')).not.toBeInTheDocument()
    expect(client.getQueryData([userId, 'assignment', eventId])).toBeUndefined()
  })
  it('la vista de correos usa contadores y un reintento no llama al sorteo', async () => {
    const { user } = mount(`/eventos/${eventId}/correos`)
    expect(await screen.findByText('Aceptados para envío')).toBeInTheDocument()
    expect(screen.queryByText('Entregados')).not.toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Reintentar correos fallidos' })).toBeEnabled(),
    )
    await user.click(screen.getByRole('button', { name: 'Reintentar correos fallidos' }))
    await screen.findByText(/Reintento programado/)
    expect(calls.filter((c) => c.path.endsWith('/notifications/retry'))).toHaveLength(1)
    expect(calls.some((c) => c.path.endsWith('/draw'))).toBe(false)
  })
  it('el organizador puede mandar invitación por correo desde el diálogo', async () => {
    const { user } = mount(`/eventos/${eventId}/invitar`)
    await user.click(await screen.findByRole('button', { name: 'Mandar correo de invitación' }))
    const dialog = screen.getByRole('dialog', { name: 'Manda una invitación.' })
    const input = within(dialog).getByLabelText(/Correo de la persona invitada/)
    expect(input).toHaveFocus()
    await user.click(within(dialog).getByRole('button', { name: 'Enviar invitación' }))
    expect(calls.filter((c) => c.path.endsWith('/invitation/email'))).toHaveLength(0)
    await user.type(input, 'Amiga@example.test')
    await user.click(within(dialog).getByRole('button', { name: 'Enviar invitación' }))
    await screen.findByText(/Invitación programada para envío/)
    const request = calls.find((c) => c.path.endsWith('/invitation/email'))!
    expect(request.method).toBe('POST')
    expect(request.body).toEqual({ email: 'amiga@example.test', requestId: expect.any(String) })
    expect(screen.queryByRole('dialog', { name: 'Manda una invitación.' })).not.toBeInTheDocument()
  })
  it('el reintento de invitación conserva requestId y muestra el fallo', async () => {
    let attempt = 0
    override = (path) =>
      path.endsWith('/invitation/email')
        ? ++attempt === 1
          ? json({ detail: 'No disponible ahora.' }, 503)
          : json({ id: 'email-retry', status: 'PENDING' }, 202)
        : undefined
    const { user } = mount(`/eventos/${eventId}/invitar`)
    await user.click(await screen.findByRole('button', { name: 'Mandar correo de invitación' }))
    await user.type(screen.getByLabelText(/Correo de la persona invitada/), 'friend@example.test')
    await user.click(screen.getByRole('button', { name: 'Enviar invitación' }))
    await screen.findByText('No disponible ahora.')
    expect(attempt).toBe(1)
    await user.click(screen.getByRole('button', { name: 'Enviar invitación' }))
    await screen.findByText(/Invitación programada/)
    const requests = calls.filter((c) => c.path.endsWith('/invitation/email'))
    expect(requests[0].body).toEqual(requests[1].body)
  })
  it('un fallo de fotos 503 no impide guardar el perfil básico', async () => {
    override = (path) =>
      path.endsWith('/me/avatar') ? json({ detail: 'Fotos no configuradas' }, 503) : undefined
    const { user } = mount('/perfil')
    const file = new File(['test'], 'avatar.png', { type: 'image/png' })
    await user.upload(await screen.findByLabelText('Seleccionar foto de perfil'), file)
    await user.click(await screen.findByRole('button', { name: 'Guardar recorte' }))
    await screen.findByText(/Las fotos no están disponibles ahora/)
    await user.click(screen.getByRole('button', { name: 'Cancelar recorte' }))
    const name = screen.getByLabelText(/Nombre completo/)
    await user.clear(name)
    await user.type(name, 'Lucía Vargas Silva')
    await user.click(screen.getByRole('button', { name: 'Guardar mi perfil' }))
    await screen.findByText('Tu perfil se guardó.')
    expect(calls.find((c) => c.path === '/api/v1/me' && c.method === 'PUT')?.body).toEqual({
      fullName: 'Lucía Vargas Silva',
      phone: null,
    })
  })
  it('al cerrar sesión desaparecen los datos privados del caché', async () => {
    const { auth, client } = mount('/eventos')
    await screen.findByRole('heading', { name: 'Tus próximos encuentros' })
    await waitFor(() =>
      expect(
        client
          .getQueryCache()
          .findAll({ queryKey: [userId] })
          .some((q) => !!q.state.data),
      ).toBe(true),
    )
    await act(async () => {
      auth.emit('SIGNED_OUT', null)
    })
    await screen.findByRole('heading', { name: 'Bienvenido de nuevo.' })
    expect(client.getQueryCache().findAll({ queryKey: [userId] })).toHaveLength(0)
  })
})

describe('Recuperación y recursos externos', () => {
  it('conserva el retorno cuando Auth publica la sesión antes de resolver el login', async () => {
    localStorage.setItem(
      'whoami.auth.return',
      JSON.stringify({ path: `/join/${token}`, at: Date.now() }),
    )
    const { auth, user, router } = mount('/login', null)
    let complete!: () => void
    auth.auth.signInWithPassword.mockImplementationOnce(async () => {
      auth.emit('SIGNED_IN', session)
      await new Promise<void>((resolve) => {
        complete = resolve
      })
      return { data: { session, user: session.user }, error: null }
    })
    await user.type(await screen.findByLabelText(/Correo electrónico/), 'lucia@example.test')
    await user.type(screen.getByLabelText(/^Contraseña/), 'Clave-local-123')
    await user.click(screen.getByRole('button', { name: /^Entrar/ }))
    expect(router.state.location.pathname).toBe('/login')
    await act(async () => complete())
    await screen.findByRole('button', { name: /Unirme al intercambio/ })
    expect(router.state.location.pathname).toBe(`/join/${token}`)
  })

  it('la recuperación no revela si existe la cuenta', async () => {
    const { auth, user } = mount('/recuperar', null)
    await user.type(await screen.findByLabelText(/Correo electrónico/), 'desconocido@example.test')
    await user.click(screen.getByRole('button', { name: /Recuperar mi acceso/ }))
    await screen.findByText(/Si existe una cuenta con ese correo/)
    expect(auth.auth.resetPasswordForEmail).toHaveBeenCalledWith('desconocido@example.test', {
      redirectTo: expect.stringContaining('/auth/callback?intent=recovery'),
    })
    expect(calls).toHaveLength(0)
  })

  it('una sesión de recuperación cambia la contraseña mediante Auth', async () => {
    const { auth, user } = mount('/auth/nueva-clave', null)
    await screen.findByText(/Necesitas un enlace de recuperación válido/)
    await act(async () => auth.emit('PASSWORD_RECOVERY', session))
    await user.type(await screen.findByLabelText(/^Nueva contraseña/), 'Una-clave-local-123')
    await user.type(screen.getByLabelText(/^Confirmar contraseña/), 'Una-clave-local-123')
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }))
    await screen.findByText('Tu contraseña se actualizó correctamente.')
    expect(auth.auth.updateUser).toHaveBeenCalledWith({ password: 'Una-clave-local-123' })
    expect(calls.some((c) => c.method === 'PUT' || c.method === 'POST')).toBe(false)
    await user.click(screen.getByRole('button', { name: /Continuar a Whoami/ }))
    await screen.findByRole('heading', { name: 'Tus próximos encuentros' })
    expect(sessionStorage.getItem('whoami.auth.recovery')).toBeNull()
  })

  it('el modo automático no ejecuta un sorteo desde el navegador', async () => {
    currentEvent.autoDraw = true
    mount(`/eventos/${eventId}`)
    await screen.findByText(/se realizará automáticamente a partir de las 12:00/)
    expect(screen.queryByRole('link', { name: /Preparar sorteo/ })).not.toBeInTheDocument()
    expect(calls.some((c) => c.path.endsWith('/draw'))).toBe(false)
  })

  it('salir limpia el evento privado y vuelve a mis eventos', async () => {
    currentEvent.organizerId = otherId
    participate()
    const { user, client } = mount(`/eventos/${eventId}`)
    await user.click(await screen.findByRole('button', { name: 'Salir del intercambio' }))
    const dialog = screen.getByRole('dialog')
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false)
    await user.click(within(dialog).getByRole('button', { name: 'Salir del intercambio' }))
    await screen.findByRole('heading', { name: 'Tus próximos encuentros' })
    expect(
      client
        .getQueryCache()
        .findAll()
        .some((q) => q.queryKey.includes(eventId)),
    ).toBe(false)
  })

  it('el QR se obtiene con Bearer como Blob y se revoca al salir', async () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:qr-isolated-test')
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    const { user } = mount(`/eventos/${eventId}/invitar`)
    const qr = await screen.findByRole('img', { name: /Código QR para unirse/ })
    expect(qr).toHaveAttribute('src', 'blob:qr-isolated-test')
    expect(create).toHaveBeenCalledWith(expect.any(Blob))
    const request = calls.find((c) => c.path.endsWith('/invitation/qr'))
    expect(request?.headers).toMatchObject({ Authorization: 'Bearer test-access-token' })
    await user.click(screen.getByRole('link', { name: 'Mis eventos' }))
    await screen.findByRole('heading', { name: 'Tus próximos encuentros' })
    expect(revoke).toHaveBeenCalledWith('blob:qr-isolated-test')
  })

  it('el recorte se envía por multipart al backend sin un PUT de navegador a R2', async () => {
    override = (path) =>
      path.endsWith('/me/avatar')
        ? json({ ...profile, avatarUrl: 'https://example.test/read-avatar' })
        : undefined
    const { user } = mount('/perfil')
    await user.upload(
      await screen.findByLabelText('Seleccionar foto de perfil'),
      new File(['test'], 'avatar.png', { type: 'image/png' }),
    )
    expect(calls.some((c) => c.path.endsWith('/me/avatar'))).toBe(false)
    await user.click(await screen.findByRole('button', { name: 'Guardar recorte' }))
    await screen.findByText(/Tu foto se actualizó/)
    const upload = calls.find((c) => c.path.endsWith('/me/avatar'))!
    expect(upload.method).toBe('POST')
    expect(upload.body).toBeInstanceOf(FormData)
    expect((upload.body as FormData).get('file')).toBeInstanceOf(File)
    expect(upload.headers).toMatchObject({ Authorization: 'Bearer test-access-token' })
    expect(calls.some((c) => c.path.startsWith('https://'))).toBe(false)
  })
  it('eliminar exige confirmación y limpia sesión y caché', async () => {
    override = (path, options) =>
      path === '/api/v1/me' && options.method === 'DELETE'
        ? json({ status: 'ACCEPTED' }, 202)
        : undefined
    const { user, auth, client } = mount('/perfil')
    await user.click(await screen.findByRole('button', { name: 'Eliminar mi cuenta' }))
    const confirm = screen.getByRole('button', { name: 'Eliminar definitivamente' })
    expect(confirm).toBeDisabled()
    expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(0)
    await user.type(screen.getByLabelText('Escribe ELIMINAR para confirmar'), 'ELIMINAR')
    await user.click(confirm)
    await screen.findByText(/Tu cuenta se desactivó/)
    expect(calls.find((c) => c.method === 'DELETE')?.body).toEqual({ confirmation: 'ELIMINAR' })
    expect(auth.auth.stopAutoRefresh).toHaveBeenCalled()
    expect(
      client
        .getQueryCache()
        .findAll({ queryKey: [userId] })
        .some((q) => !!q.state.data),
    ).toBe(false)
  })
  it('un 503 al eliminar conserva el perfil y muestra el error', async () => {
    override = (path, options) =>
      path === '/api/v1/me' && options.method === 'DELETE'
        ? json({ detail: 'La eliminación no está disponible ahora.' }, 503)
        : undefined
    const { user, auth } = mount('/perfil')
    await user.click(await screen.findByRole('button', { name: 'Eliminar mi cuenta' }))
    await user.type(screen.getByLabelText('Escribe ELIMINAR para confirmar'), 'ELIMINAR')
    await user.click(screen.getByRole('button', { name: 'Eliminar definitivamente' }))
    await screen.findByText('La eliminación no está disponible ahora.')
    expect(auth.auth.signOut).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/Nombre completo/)).toHaveValue(profile.fullName)
  })
})
