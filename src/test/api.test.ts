import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, organizerParticipates, request } from '../lib/api'
import { event, fakeAuth, json, session, userId } from './fixtures'

const mocked = vi.hoisted(() => ({ getAuthClient: vi.fn() }))
vi.mock('../lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/auth')>()),
  getAuthClient: mocked.getAuthClient,
}))
let auth: ReturnType<typeof fakeAuth>
beforeEach(() => {
  auth = fakeAuth()
  mocked.getAuthClient.mockResolvedValue(auth.client)
})
describe('Cliente Spring', () => {
  it('envía access_token en negocio; la invitación pública no envía credenciales', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => json({}))
    vi.stubGlobal('fetch', fetcher)
    await api.profile()
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      headers: expect.objectContaining({ Authorization: 'Bearer test-access-token' }),
      credentials: 'omit',
      cache: 'no-store',
    })
    fetcher.mockClear()
    await api.preview('A'.repeat(43))
    expect(fetcher.mock.calls[0][1]).toMatchObject({ headers: { Accept: 'application/json' } })
  })
  it('renueva una vez tras 401 y vuelve a enviar con el token nuevo', async () => {
    auth.auth.refreshSession.mockResolvedValue({
      data: { session: { ...session, access_token: 'refreshed-token' } },
      error: null,
    })
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json({ id: 1 }))
    vi.stubGlobal('fetch', fetcher)
    expect(await api.profile()).toEqual({ id: 1 })
    expect(auth.auth.refreshSession).toHaveBeenCalledOnce()
    expect(fetcher.mock.calls[1][1].headers.Authorization).toBe('Bearer refreshed-token')
  })
  it('no repite un POST ante una caída de red y no oculta errores 409', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new TypeError('Network failed'))
    vi.stubGlobal('fetch', fetcher)
    await expect(api.draw(event.id)).rejects.toMatchObject({ status: 0 })
    expect(fetcher).toHaveBeenCalledOnce()
    fetcher.mockResolvedValueOnce(json({ detail: 'El evento ya no admite cambios.' }, 409))
    await expect(api.cancel(event.id)).rejects.toMatchObject({
      status: 409,
      message: 'El evento ya no admite cambios.',
    })
  })
  it('no entrega una respuesta privada cuando cambió la sesión durante la petición', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        auth.emit('SIGNED_OUT', null)
        return json({ private: 'never cache' })
      }),
    )
    await expect(api.profile()).rejects.toMatchObject({ status: 401 })
  })

  it('no reenvía una operación con la cuenta de otra sesión tras un 401', async () => {
    auth.auth.refreshSession.mockResolvedValue({
      data: { session: { ...session, user: { ...session.user, id: 'otra-cuenta' } } },
      error: null,
    })
    const fetcher = vi.fn().mockResolvedValue(json({}, 401))
    vi.stubGlobal('fetch', fetcher)
    await expect(api.draw(event.id)).rejects.toMatchObject({ status: 401 })
    expect(fetcher).toHaveBeenCalledOnce()
  })
  it('descarga QR como Blob y procesa 204 sin parsear JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(new Blob(['png'], { type: 'image/png' })))
        .mockResolvedValueOnce(json(null, 204)),
    )
    expect(await api.qr(event.id)).toBeInstanceOf(Blob)
    expect(await api.leave(event.id)).toBeUndefined()
  })
  it('no filtra detalles privados de un 404 y propaga cancelación', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(json({ detail: 'El evento existe, pero es de otra persona' }, 404))
        .mockRejectedValueOnce(new DOMException('cancelled', 'AbortError')),
    )
    await expect(request('/events/x')).rejects.toMatchObject({
      status: 404,
      message: 'No podemos mostrar este contenido.',
    })
    await expect(api.profile(new AbortController().signal)).rejects.toMatchObject({
      name: 'AbortError',
    })
  })
  it('encuentra al organizador inscrito fuera de los primeros 50 participantes', async () => {
    const first = Array.from({ length: 50 }, (_, i) => ({
      userId: `other-${i}`,
      fullName: 'Otra persona',
    }))
    const fetcher = vi.fn<typeof fetch>(async () => json([{ userId, fullName: 'Lucía Vargas' }]))
    vi.stubGlobal('fetch', fetcher)
    expect(
      await organizerParticipates({ ...event, participantCount: 51, participants: first }, userId),
    ).toBe(true)
    expect(fetcher.mock.calls[0][0]).toContain('page=1&size=50')
  })
})
