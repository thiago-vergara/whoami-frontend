import { Temporal } from '@js-temporal/polyfill'
import { budgetMinor, isHttps, localDateInput } from './format'
import type { EventRequest, EventView } from './types'

export interface EventFields {
  title: string
  description: string
  drawDate: string
  exchangeLocal: string
  timezone: string
  autoDraw: boolean
  modality: 'IN_PERSON' | 'VIRTUAL'
  platform: string
  meetingUrl: string
  address: string
  budget: string
}
export function eventFields(event?: EventView): EventFields {
  return event
    ? {
        title: event.title,
        description: event.description,
        drawDate: localDateInput(event.drawAt, event.timezone),
        exchangeLocal: localDateInput(event.exchangeAt, event.timezone, true),
        timezone: event.timezone,
        autoDraw: event.autoDraw,
        modality: event.modality,
        platform: event.platform || '',
        meetingUrl: event.meetingUrl || '',
        address: event.address || '',
        budget: event.giftBudgetMinor == null ? '' : (event.giftBudgetMinor / 100).toFixed(2),
      }
    : {
        title: '',
        description: '',
        drawDate: '',
        exchangeLocal: '',
        timezone: 'America/Lima',
        autoDraw: false,
        modality: 'IN_PERSON',
        platform: '',
        meetingUrl: '',
        address: '',
        budget: '',
      }
}
export function eventRequest(fields: EventFields, now = Date.now()): EventRequest {
  if (!fields.title.trim() || !fields.description.trim())
    throw new Error('Completa el título y la descripción del evento.')
  let draw: Temporal.ZonedDateTime
  let exchange: Temporal.ZonedDateTime
  try {
    draw = Temporal.PlainDateTime.from(`${fields.drawDate}T12:00`).toZonedDateTime(
      fields.timezone,
      { disambiguation: 'reject' },
    )
    exchange = Temporal.PlainDateTime.from(fields.exchangeLocal).toZonedDateTime(fields.timezone, {
      disambiguation: 'reject',
    })
  } catch {
    throw new Error(
      'Revisa las fechas y horas. Si la zona cambia de horario, elige una hora que no sea ambigua.',
    )
  }
  if (draw.epochMilliseconds <= now)
    throw new Error(
      'El día de sorteo debe ser futuro; se toma como referencia las 12:00 en la zona del evento.',
    )
  if (exchange.epochMilliseconds <= draw.epochMilliseconds)
    throw new Error('El intercambio debe ser posterior al sorteo planificado.')
  if (fields.modality === 'IN_PERSON' && !fields.address.trim())
    throw new Error('Indica la dirección del encuentro.')
  if (
    fields.modality === 'VIRTUAL' &&
    (!fields.platform.trim() || !isHttps(fields.meetingUrl.trim()))
  )
    throw new Error('Indica la plataforma y un enlace HTTPS válido para la reunión.')
  return {
    title: fields.title.trim(),
    description: fields.description.trim(),
    drawDate: fields.drawDate,
    exchangeAt: exchange.toInstant().toString(),
    timezone: fields.timezone,
    autoDraw: fields.autoDraw,
    modality: fields.modality,
    address: fields.modality === 'IN_PERSON' ? fields.address.trim() : null,
    platform: fields.modality === 'VIRTUAL' ? fields.platform.trim() : null,
    meetingUrl: fields.modality === 'VIRTUAL' ? fields.meetingUrl.trim() : null,
    giftBudgetMinor: budgetMinor(fields.budget),
  }
}
