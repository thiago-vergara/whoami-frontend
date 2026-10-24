export function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toLocaleUpperCase('es') || '?'
  )
}
export function money(value: number | null, currency = 'PEN') {
  return value == null
    ? 'A tu elección'
    : new Intl.NumberFormat('es-PE', { style: 'currency', currency }).format(value / 100)
}
export function dateTime(value: string, timezone = 'America/Lima') {
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(value))
}
export function localDateInput(value: string, timezone: string, time = false) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(time ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const } : {}),
  }).formatToParts(new Date(value))
  const v = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  return `${v.year}-${v.month}-${v.day}${time ? `T${v.hour}:${v.minute}` : ''}`
}
export function isHttps(value: string) {
  try {
    const u = new URL(value)
    return u.protocol === 'https:' && !!u.hostname && !u.username && !u.password
  } catch {
    return false
  }
}
export function budgetMinor(value: string): number | null {
  if (!value.trim()) return null
  if (!/^\d{1,9}(?:[.,]\d{1,2})?$/.test(value.trim()))
    throw new Error('Indica un monto positivo con hasta dos decimales.')
  const [whole, fraction = ''] = value.trim().replace(',', '.').split('.')
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
}
export function errorText(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'No se pudo completar la operación. Inténtalo de nuevo.'
}
