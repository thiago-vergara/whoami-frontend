import { describe, expect, it } from 'vitest'
import {
  authMessage,
  hasRecoveryGrant,
  markRecovery,
  pendingReturn,
  rememberReturn,
  safeReturnPath,
} from '../lib/auth'
import { budgetMinor, initials, isHttps, localDateInput } from '../lib/format'
import { eventFields, eventRequest } from '../lib/event-form'
import { event, token, userId } from './fixtures'

describe('Redirección y recuperación', () => {
  it('solo permite destinos internos conocidos, sin redirección abierta', () => {
    for (const path of [
      'https://evil.test',
      '//evil.test',
      '/\\evil.test',
      '/login?next=https://evil.test',
      '/eventos/../../perfil',
      '/join/short',
      '/eventos#secret',
    ])
      expect(safeReturnPath(path)).toBeNull()
    expect(safeReturnPath(`/join/${token}`)).toBe(`/join/${token}`)
    rememberReturn(`/join/${token}`)
    expect(pendingReturn(true)).toBe(`/join/${token}`)
    expect(pendingReturn()).toBe('/eventos')
  })
  it('no restaura destinos vencidos ni entradas de storage manipuladas', () => {
    localStorage.setItem('whoami.auth.return', JSON.stringify({ path: '/perfil', at: 1 }))
    expect(pendingReturn()).toBe('/eventos')
    localStorage.setItem('whoami.auth.return', '<script>')
    expect(pendingReturn()).toBe('/eventos')
  })
  it('la recuperación corresponde a la misma cuenta y vence', () => {
    markRecovery(userId)
    expect(hasRecoveryGrant(userId)).toBe(true)
    expect(hasRecoveryGrant('otra-cuenta')).toBe(false)
    sessionStorage.setItem('whoami.auth.recovery', JSON.stringify({ userId, expires: 1 }))
    expect(hasRecoveryGrant(userId)).toBe(false)
  })
  it('traduce límites y errores de Auth sin copiar datos sensibles', () => {
    expect(authMessage({ status: 429 })).toContain('Espera')
    expect(authMessage({ code: 'email_not_confirmed' })).toContain('Confirma')
    expect(authMessage({ code: 'invalid_credentials' })).toContain('no son correctos')
  })
})
describe('Fechas y valores de evento', () => {
  it('convierte a céntimos sin redondeos flotantes y rechaza formatos ambiguos', () => {
    expect(budgetMinor('85,50')).toBe(8550)
    expect(budgetMinor('0.29')).toBe(29)
    expect(budgetMinor('')).toBeNull()
    for (const bad of ['-1', '1.005', '1e4', '1,000.20', 'Infinity'])
      expect(() => budgetMinor(bad)).toThrow()
  })
  it('convierte el intercambio desde Lima independientemente de la zona del navegador', () => {
    const fields = eventFields(event)
    expect(fields.exchangeLocal).toBe('2030-12-19T18:30')
    const body = eventRequest(fields, Date.parse('2030-01-01T00:00Z'))
    expect(body.exchangeAt).toBe('2030-12-19T23:30:00Z')
    expect(body.drawDate).toBe('2030-12-12')
    expect(body.giftBudgetMinor).toBe(8500)
  })
  it('rechaza sorteo pasado e intercambio anterior al sorteo', () => {
    const fields = eventFields(event)
    expect(() => eventRequest(fields, Date.parse('2031-01-01'))).toThrow('futuro')
    expect(() =>
      eventRequest({ ...fields, exchangeLocal: '2030-12-12T11:00' }, Date.parse('2030-01-01')),
    ).toThrow('posterior')
  })
  it('rechaza horas inexistentes o ambiguas por cambios de horario', () => {
    const fields = {
      ...eventFields(event),
      timezone: 'America/New_York',
      drawDate: '2030-03-09',
      exchangeLocal: '2030-03-10T02:30',
    }
    expect(() => eventRequest(fields, Date.parse('2030-01-01'))).toThrow('ambigua')
  })
  it('exige HTTPS para reuniones y elimina campos de la modalidad opuesta', () => {
    const fields = {
      ...eventFields(event),
      modality: 'VIRTUAL' as const,
      platform: 'Meet',
      meetingUrl: 'javascript:alert(1)',
    }
    expect(() => eventRequest(fields, Date.parse('2030-01-01'))).toThrow('HTTPS')
    const body = eventRequest(
      { ...fields, meetingUrl: 'https://meet.google.com/grupo' },
      Date.parse('2030-01-01'),
    )
    expect(body.address).toBeNull()
    expect(isHttps('https://user:secret@example.test')).toBe(false)
  })
  it('formatea fechas y nombres sin convertirlos en HTML', () => {
    expect(initials(' Lucía Vargas ')).toBe('LV')
    expect(localDateInput('2030-12-13T01:00:00Z', 'America/Lima')).toBe('2030-12-12')
  })
})
