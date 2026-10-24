import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, CalendarDays, Gift, MapPin, Video } from 'lucide-react'
import TimezoneSelect from '../components/TimezoneSelect'
import { useAuth } from '../auth-context'
import { api, ApiError } from '../lib/api'
import { eventFields, eventRequest, type EventFields } from '../lib/event-form'
import {
  Button,
  ConfirmDialog,
  ErrorNotice,
  Field,
  Loading,
  Notice,
  PageHeading,
} from '../components/ui'
import type { EventView } from '../lib/types'

export default function EventFormPage() {
  const { id } = useParams()
  const { session } = useAuth()
  const event = useQuery({
    queryKey: [session!.user.id, 'event', id],
    queryFn: ({ signal }) => api.event(id!, signal),
    enabled: !!id,
  })
  if (id && event.isPending)
    return (
      <div className="container">
        <Loading label="Preparando el evento…" />
      </div>
    )
  if (id && event.error)
    return (
      <div className="container narrow">
        <ErrorNotice error={event.error} retry={() => event.refetch()} />
      </div>
    )
  if (event.data && event.data.organizerId !== session!.user.id)
    return (
      <div className="container narrow">
        <ErrorNotice error={new ApiError(404, 'No podemos mostrar este contenido.')} />
      </div>
    )
  return <EventForm key={id || 'new'} event={event.data} />
}
function EventForm({ event }: { event?: EventView }) {
  const { session } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [fields, setFields] = useState(() => eventFields(event))
  const initial = useRef(JSON.stringify(eventFields(event)))
  const allowNavigation = useRef(false)
  const [validation, setValidation] = useState<unknown>(null)
  const dirty = JSON.stringify(fields) !== initial.current
  const save = useMutation({
    mutationFn: () => api.saveEvent(eventRequest(fields), event?.id),
    onSuccess: (result) => {
      allowNavigation.current = true
      queryClient.setQueryData([session!.user.id, 'event', result.id], result)
      queryClient.invalidateQueries({ queryKey: [session!.user.id, 'events'] })
      navigate(`/eventos/${result.id}`, {
        replace: true,
        state: {
          message: event
            ? 'Los cambios se guardaron.'
            : 'Tu evento está listo. Invita a tu grupo y, si también intercambiarás un regalo, inscríbete como participante.',
        },
      })
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409 && event)
        queryClient.invalidateQueries({ queryKey: [session!.user.id, 'event', event.id] })
    },
  })
  const blocked = useBlocker(
    useCallback(
      () => !allowNavigation.current && (dirty || save.isPending),
      [dirty, save.isPending],
    ),
  )
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!allowNavigation.current && (dirty || save.isPending)) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty, save.isPending])
  const update = <K extends keyof EventFields>(key: K, value: EventFields[K]) =>
    setFields((f) => ({ ...f, [key]: value }))
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (save.isPending) return
    setValidation(null)
    try {
      eventRequest(fields)
    } catch (error) {
      setValidation(error)
      return
    }
    save.mutate()
  }
  const locked = !!event && event.status !== 'OPEN'
  return (
    <div className="container">
      <PageHeading
        back={event ? `/eventos/${event.id}` : '/eventos'}
        eyebrow="UN DETALLE QUE NOS REÚNE"
        title={event ? 'Ajusta los detalles.' : 'Tu próximo encuentro.'}
      >
        Ponle nombre a la ilusión. Luego podrás invitar al grupo.
      </PageHeading>
      <div className="split-layout form-layout">
        <form onSubmit={submit} className="event-form">
          <fieldset disabled={save.isPending || locked}>
            <section className="form-section">
              <div className="section-heading">
                <span className="step-number mono">01</span>
                <div>
                  <h2>Lo que los reúne</h2>
                  <p>Un nombre y unas palabras para tu grupo.</p>
                </div>
              </div>
              <Field label="Título del evento" required>
                {(p) => (
                  <input
                    {...p}
                    required
                    maxLength={160}
                    value={fields.title}
                    onChange={(e) => update('title', e.target.value)}
                    placeholder="Por ejemplo: Amigos de siempre"
                  />
                )}
              </Field>
              <Field label="Descripción" required>
                {(p) => (
                  <textarea
                    {...p}
                    required
                    maxLength={5000}
                    rows={4}
                    value={fields.description}
                    onChange={(e) => update('description', e.target.value)}
                    placeholder="Cuéntales de qué se trata el encuentro…"
                  />
                )}
              </Field>
            </section>
            <section className="form-section">
              <div className="section-heading">
                <span className="step-number mono">02</span>
                <div>
                  <h2>Guarden las fechas</h2>
                  <p>El sorteo y el intercambio son dos momentos distintos.</p>
                </div>
              </div>
              <div className="form-grid">
                <Field
                  label="Día del sorteo"
                  required
                  hint="Fecha planificada; la inscripción sigue abierta hasta que se realice el sorteo."
                >
                  {(p) => (
                    <input
                      {...p}
                      required
                      type="date"
                      value={fields.drawDate}
                      onChange={(e) => update('drawDate', e.target.value)}
                    />
                  )}
                </Field>
                <Field label="Fecha y hora del intercambio" required>
                  {(p) => (
                    <input
                      {...p}
                      required
                      type="datetime-local"
                      value={fields.exchangeLocal}
                      onChange={(e) => update('exchangeLocal', e.target.value)}
                    />
                  )}
                </Field>
              </div>
              <Field
                label="Zona horaria"
                hint="Las fechas y horas se guardan en esta zona, aunque te encuentres en otro lugar."
              >
                {(p) => (
                  <TimezoneSelect
                    {...p}
                    value={fields.timezone}
                    onChange={(zone) => update('timezone', zone)}
                  />
                )}
              </Field>
              <fieldset className="choice-group">
                <legend>¿Cómo se realizará el sorteo?</legend>
                <label className={`choice ${!fields.autoDraw ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="draw-mode"
                    checked={!fields.autoDraw}
                    onChange={() => update('autoDraw', false)}
                  />
                  <span>
                    <strong>Lo realizaré manualmente</strong>
                    <small>Tendrás un botón para sortear cuando el grupo esté listo.</small>
                  </span>
                </label>
                <label className={`choice ${fields.autoDraw ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="draw-mode"
                    checked={fields.autoDraw}
                    onChange={() => update('autoDraw', true)}
                  />
                  <span>
                    <strong>Automáticamente a las 12:00</strong>
                    <small>Se programará para el día elegido, en la zona del evento.</small>
                  </span>
                </label>
              </fieldset>
            </section>
            <section className="form-section">
              <div className="section-heading">
                <span className="step-number mono">03</span>
                <div>
                  <h2>El lugar del encuentro</h2>
                  <p>Compartiremos estos datos solo con las personas del evento.</p>
                </div>
              </div>
              <fieldset className="choice-group horizontal">
                <legend className="sr-only">Modalidad</legend>
                <label className={`choice ${fields.modality === 'IN_PERSON' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="modality"
                    checked={fields.modality === 'IN_PERSON'}
                    onChange={() => update('modality', 'IN_PERSON')}
                  />
                  <MapPin size={18} />
                  <span>Presencial</span>
                </label>
                <label className={`choice ${fields.modality === 'VIRTUAL' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="modality"
                    checked={fields.modality === 'VIRTUAL'}
                    onChange={() => update('modality', 'VIRTUAL')}
                  />
                  <Video size={18} />
                  <span>Virtual</span>
                </label>
              </fieldset>
              {fields.modality === 'IN_PERSON' ? (
                <Field label="Dirección del encuentro" required>
                  {(p) => (
                    <textarea
                      {...p}
                      rows={2}
                      maxLength={500}
                      required
                      value={fields.address}
                      onChange={(e) => update('address', e.target.value)}
                    />
                  )}
                </Field>
              ) : (
                <>
                  <Field label="Plataforma" required>
                    {(p) => (
                      <input
                        {...p}
                        required
                        maxLength={120}
                        value={fields.platform}
                        onChange={(e) => update('platform', e.target.value)}
                        placeholder="Google Meet, Zoom…"
                      />
                    )}
                  </Field>
                  <Field label="Enlace de la reunión" required hint="Debe empezar con https://.">
                    {(p) => (
                      <input
                        {...p}
                        required
                        type="url"
                        maxLength={2048}
                        value={fields.meetingUrl}
                        onChange={(e) => update('meetingUrl', e.target.value)}
                      />
                    )}
                  </Field>
                </>
              )}
            </section>
            <section className="form-section">
              <div className="section-heading">
                <span className="step-number mono">04</span>
                <div>
                  <h2>Una referencia para regalar</h2>
                  <p>Un detalle pensado con cariño, dentro de lo acordado.</p>
                </div>
              </div>
              <Field
                label="Valor aproximado del regalo"
                hint="Opcional. Es orientativo; no es un pago ni una recaudación."
              >
                {(p) => (
                  <div className="money-input">
                    <span>S/</span>
                    <input
                      {...p}
                      inputMode="decimal"
                      maxLength={12}
                      value={fields.budget}
                      onChange={(e) => update('budget', e.target.value)}
                      placeholder="85.00"
                    />
                  </div>
                )}
              </Field>
            </section>
          </fieldset>
          <ErrorNotice error={validation || save.error} />
          {save.error instanceof ApiError && save.error.status === 0 && !event && (
            <p className="caption">
              No sabemos si el evento llegó a guardarse.{' '}
              <Link to="/eventos">Revisa tus eventos</Link> antes de crearlo otra vez.
            </p>
          )}
          {locked ? (
            <Notice>
              El evento ya no admite cambios. Conservamos los campos que estabas revisando.
            </Notice>
          ) : (
            <div className="form-actions">
              <Link className="button secondary" to={event ? `/eventos/${event.id}` : '/eventos'}>
                Volver
              </Link>
              <Button type="submit" pending={save.isPending}>
                {save.isPending ? 'Guardando…' : event ? 'Guardar cambios' : 'Crear mi evento'}{' '}
                <ArrowRight size={18} />
              </Button>
            </div>
          )}
        </form>
        <aside className="paper-note form-note">
          <Gift size={28} />
          <h2>
            Primero el grupo.
            <br />
            Después la sorpresa.
          </h2>
          <p>
            Crear el evento te convierte en organizador. Si también quieres recibir y dar un regalo,
            podrás inscribirte después.
          </p>
          <hr />
          <p>
            <CalendarDays size={18} /> El sorteo se realiza una sola vez. A partir de ese momento,
            la lista de participantes queda cerrada.
          </p>
        </aside>
      </div>
      <ConfirmDialog
        open={blocked.state === 'blocked'}
        title={save.isPending ? 'Estamos guardando el evento.' : '¿Salir sin guardar?'}
        confirmLabel="Salir sin guardar"
        pending={save.isPending}
        onCancel={() => blocked.state === 'blocked' && blocked.reset()}
        onConfirm={() => {
          allowNavigation.current = true
          if (blocked.state === 'blocked') blocked.proceed()
        }}
      >
        <p>
          {save.isPending
            ? 'Espera a que termine la solicitud para conocer el resultado.'
            : 'Los cambios de este formulario se perderán.'}
        </p>
      </ConfirmDialog>
    </div>
  )
}
