import { useEffect, useState } from 'react'
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  CalendarDays,
  Check,
  Copy,
  Download,
  EyeOff,
  Gift,
  Info,
  LockKeyhole,
  MapPin,
  Plus,
  RefreshCw,
  Send,
  Share2,
  Shuffle,
  UsersRound,
  Video,
} from 'lucide-react'
import InvitationEmailDialog from '../components/InvitationEmailDialog'
import { useAuth } from '../auth-context'
import { api, ApiError, organizerParticipates } from '../lib/api'
import { dateTime, isHttps, money } from '../lib/format'
import {
  Avatar,
  Button,
  ConfirmDialog,
  Empty,
  EnvelopeArt,
  ErrorNotice,
  Field,
  Loading,
  Notice,
  PageHeading,
  Pagination,
  Status,
  WishList,
} from '../components/ui'
import type { EventView, Wish, WishRequest } from '../lib/types'

interface EventContext {
  event: EventView
  organizer: boolean
  participant: boolean
  userId: string
}
export function useEventContext() {
  return useOutletContext<EventContext>()
}
function useRefreshEvent(id: string) {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  return () => {
    for (const key of ['event', 'membership', 'participants', 'wishes', 'notifications'])
      queryClient.invalidateQueries({ queryKey: [session!.user.id, key, id] })
    queryClient.invalidateQueries({ queryKey: [session!.user.id, 'events'] })
  }
}
export default function EventPage() {
  const { id = '' } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const userId = session!.user.id
  const event = useQuery({
    queryKey: [userId, 'event', id],
    queryFn: ({ signal }) => api.event(id, signal),
    refetchInterval: (query) => (query.state.data?.status === 'OPEN' ? 30000 : false),
  })
  const membership = useQuery({
    queryKey: [userId, 'membership', id, event.data?.version, event.data?.participantCount],
    queryFn: ({ signal }) => organizerParticipates(event.data!, userId, signal),
    enabled: !!event.data && !event.error,
  })
  if (event.error || membership.error)
    return (
      <div className="container narrow">
        <PageHeading title="No podemos mostrar este contenido." back="/eventos" />
        <ErrorNotice
          error={event.error || membership.error}
          retry={() => {
            event.refetch()
            membership.refetch()
          }}
        />
      </div>
    )
  if (!event.data || membership.isPending)
    return (
      <div className="container">
        <Loading label="Preparando el intercambio…" />
      </div>
    )
  const current = event.data
  const organizer = current.organizerId === userId
  const participant = membership.data === true
  const base = `/eventos/${id}`
  const tabs = [
    { path: '', label: 'Detalles' },
    { path: '/participantes', label: 'Participantes' },
    ...(participant
      ? [
          { path: '/deseos', label: 'Mis deseos' },
          { path: '/mi-amigo', label: 'Mi amigo' },
        ]
      : []),
    ...(organizer && current.status === 'OPEN' ? [{ path: '/invitar', label: 'Invitar' }] : []),
    ...(organizer ? [{ path: '/correos', label: 'Correos' }] : []),
  ]
  const message = (location.state as { message?: string } | null)?.message
  return (
    <div className="container event-layout">
      <Link className="back-link" to="/eventos">
        ← Mis eventos
      </Link>
      <div className="event-page-header">
        <div>
          <p className="eyebrow">TU INTERCAMBIO</p>
          <h1>{current.title}</h1>
        </div>
        <Status status={current.status} />
      </div>
      {message && <Notice success>{message}</Notice>}
      {current.status === 'CANCELLED' && (
        <Notice>Este evento fue cancelado. Ya no admite inscripciones, cambios ni sorteo.</Notice>
      )}
      <nav className="event-nav" aria-label="Secciones del evento">
        {tabs.map((tab) => (
          <NavLink end={tab.path === ''} key={tab.path} to={base + tab.path}>
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <div className="event-nav-mobile">
        <Field label="Sección del evento">
          {(p) => (
            <select
              {...p}
              value={
                tabs.some((t) => base + t.path === location.pathname) ? location.pathname : base
              }
              onChange={(e) => navigate(e.target.value)}
            >
              {tabs.map((tab) => (
                <option key={tab.path} value={base + tab.path}>
                  {tab.label}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <Outlet context={{ event: current, organizer, participant, userId } satisfies EventContext} />
    </div>
  )
}
export function EventDetails() {
  const { event, organizer, participant, userId } = useEventContext()
  const queryClient = useQueryClient()
  const refresh = useRefreshEvent(event.id)
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState<'leave' | 'cancel' | null>(null)
  const action = useMutation({
    mutationFn: async (type: 'join' | 'leave' | 'cancel') => {
      if (type === 'join') await api.joinOrganizer(event.id)
      else if (type === 'leave') await api.leave(event.id)
      else await api.cancel(event.id)
    },
    onSuccess: (_result, type) => {
      setConfirm(null)
      if (type === 'leave') {
        navigate(organizer ? `/eventos/${event.id}` : '/eventos', { replace: true })
        queryClient.removeQueries({
          predicate: (q) =>
            q.queryKey[0] === userId &&
            q.queryKey.includes(event.id) &&
            (!organizer || q.queryKey[1] !== 'event'),
        })
      }
      refresh()
    },
    onError: refresh,
  })
  const open = event.status === 'OPEN'
  const overdue = open && event.autoDraw && Date.now() >= new Date(event.drawAt).getTime()
  return (
    <div className="split-layout">
      <section className="detail-main">
        <div className="event-cover">
          <EnvelopeArt />
          <span className="cover-label mono">UN DETALLE ENTRE AMIGOS</span>
        </div>
        <h2>El encuentro</h2>
        <p className="preserve-lines event-description">{event.description}</p>
        <dl className="detail-list">
          <div>
            <dt>
              <CalendarDays size={19} /> Sorteo {event.autoDraw ? 'automático' : 'manual'}
            </dt>
            <dd>{dateTime(event.drawAt, event.timezone)}</dd>
          </div>
          <div>
            <dt>
              <Gift size={19} /> Intercambio
            </dt>
            <dd>{dateTime(event.exchangeAt, event.timezone)}</dd>
          </div>
          <div>
            <dt>
              {event.modality === 'IN_PERSON' ? <MapPin size={19} /> : <Video size={19} />}{' '}
              {event.modality === 'IN_PERSON'
                ? 'Nos encontramos en'
                : `Reunión por ${event.platform}`}
            </dt>
            <dd>
              {event.modality === 'IN_PERSON' ? (
                <span className="preserve-lines">{event.address}</span>
              ) : (
                event.meetingUrl &&
                isHttps(event.meetingUrl) && (
                  <a
                    className="external"
                    href={event.meetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Abrir reunión ↗<span className="sr-only"> (nueva pestaña)</span>
                  </a>
                )
              )}
            </dd>
          </div>
        </dl>
        <p className="caption">
          Zona horaria del evento:{' '}
          {event.timezone === 'America/Lima' ? 'Hora de Lima (UTC−5)' : event.timezone}
        </p>
        {event.autoDraw && open && (
          <Notice>
            {overdue
              ? 'Aún no se ha realizado. Estamos comprobando el estado del sorteo.'
              : 'El sorteo se realizará automáticamente a partir de las 12:00 del día indicado.'}
            {event.blockedReason && <p>{event.blockedReason}</p>}
            <p className="caption">Esta pantalla actualiza el estado mientras está visible.</p>
          </Notice>
        )}
        {event.status === 'DRAWN' && (
          <Notice success>
            El sorteo se realizó el {dateTime(event.drawnAt!, event.timezone)}. Cada participante
            puede consultar su amigo secreto.
          </Notice>
        )}
        {event.status === 'DRAWN' && event.blockedReason && <Notice>{event.blockedReason}</Notice>}
      </section>
      <aside className="detail-sidebar">
        <section className="panel">
          <p className="eyebrow">EL REGALO</p>
          <p className="budget-value">{money(event.giftBudgetMinor, event.currency)}</p>
          <p className="caption">
            Valor aproximado, para que todos tengan una referencia. No es un pago.
          </p>
          <hr />
          <Link className="summary-link" to={`/eventos/${event.id}/participantes`}>
            <UsersRound size={20} />
            <span>
              <strong>{event.participantCount}</strong> participantes
            </span>
            <ArrowRight size={17} />
          </Link>
          {participant && event.status !== 'CANCELLED' && (
            <Link
              className="button secondary full"
              to={`/eventos/${event.id}/${event.status === 'DRAWN' ? 'mi-amigo' : 'deseos'}`}
            >
              {event.status === 'DRAWN' ? 'Ver mi amigo secreto' : 'Añadir mis deseos'}{' '}
              <ArrowRight size={17} />
            </Link>
          )}
        </section>
        {organizer && (
          <section className="panel organization-panel">
            <p className="eyebrow">ORGANIZACIÓN</p>
            <h2>Los detalles, en tus manos.</h2>
            {open ? (
              <div className="stack">
                <Link to={`/eventos/${event.id}/invitar`} className="button secondary">
                  <Share2 size={18} /> Invitar amigos
                </Link>
                <Link className="text-link" to={`/eventos/${event.id}/editar`}>
                  Editar el evento <ArrowRight size={16} />
                </Link>
                {!event.autoDraw ? (
                  <>
                    <Link
                      className={`button ${event.participantCount >= 2 ? 'primary' : 'secondary'}`}
                      to={`/eventos/${event.id}/sortear`}
                    >
                      <Shuffle size={18} /> Preparar sorteo
                    </Link>
                    {event.participantCount < 2 && (
                      <p className="caption">
                        Se necesitan al menos dos participantes para asignar amigos secretos.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="caption">
                    Sorteo automático programado. Puedes cambiarlo mientras siga abierto.
                  </p>
                )}
                <Button
                  variant="quiet"
                  onClick={() => {
                    action.reset()
                    setConfirm('cancel')
                  }}
                >
                  Cancelar evento
                </Button>
              </div>
            ) : (
              <p>Los datos del evento y el resultado se conservan.</p>
            )}
            <p className="caption">Organizar no permite ver las asignaciones ajenas.</p>
          </section>
        )}
        {organizer && !participant && (
          <section className="participation-note">
            <Info size={21} />
            <h2>{open ? '¿Tú también regalarás?' : 'Organizaste este encuentro.'}</h2>
            <p>
              {open
                ? 'Todavía no estás en la lista. Inscríbete si también quieres dar y recibir un regalo.'
                : 'No participaste del sorteo de este intercambio.'}
            </p>
            {open && (
              <Button
                variant="secondary"
                pending={action.isPending}
                onClick={() => action.mutate('join')}
              >
                Participar también <Plus size={17} />
              </Button>
            )}
          </section>
        )}
        {participant && open && (
          <Button
            variant="quiet"
            onClick={() => {
              action.reset()
              setConfirm('leave')
            }}
          >
            Salir del intercambio
          </Button>
        )}
        <ErrorNotice error={confirm ? null : action.error} />
      </aside>
      <ConfirmDialog
        open={!!confirm}
        title={confirm === 'cancel' ? '¿Cancelar este evento?' : '¿Salir del intercambio?'}
        confirmLabel={confirm === 'cancel' ? 'Cancelar evento' : 'Salir del intercambio'}
        pending={action.isPending}
        error={action.error}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && action.mutate(confirm)}
      >
        <p>
          {confirm === 'cancel'
            ? 'No se podrá sortear ni incorporar a más personas. Se anularán los correos pendientes de este evento.'
            : 'Dejarás de participar. Puedes volver con la invitación mientras el evento siga abierto.'}
        </p>
      </ConfirmDialog>
    </div>
  )
}
export function ParticipantsPage() {
  const { event, organizer, userId } = useEventContext()
  const [page, setPage] = useState(0)
  const [remove, setRemove] = useState<{ id: string; name: string } | null>(null)
  const refresh = useRefreshEvent(event.id)
  const list = useQuery({
    queryKey: [userId, 'participants', event.id, page],
    queryFn: ({ signal }) => api.participants(event.id, page, signal),
  })
  const mutation = useMutation({
    mutationFn: () => api.remove(event.id, remove!.id),
    onSuccess: () => {
      setRemove(null)
      refresh()
    },
    onError: refresh,
  })
  return (
    <section className="section-page">
      <div className="section-header">
        <div>
          <h2>Quienes comparten la ilusión</h2>
          <p>
            {event.participantCount}{' '}
            {event.participantCount === 1 ? 'persona inscrita' : 'personas inscritas'} en el
            intercambio.
          </p>
        </div>
        {organizer && event.status === 'OPEN' && (
          <Link className="button secondary" to={`/eventos/${event.id}/invitar`}>
            <Plus size={18} /> Invitar
          </Link>
        )}
      </div>
      <Notice>
        El grupo puede ver los nombres completos. Los datos de contacto y las asignaciones
        permanecen privados.
      </Notice>
      <ErrorNotice error={list.error} retry={() => list.refetch()} />
      {list.isPending ? (
        <Loading />
      ) : (
        list.data && (
          <>
            <ul className="participants-list">
              {list.data.map((person) => (
                <li key={person.userId}>
                  <Avatar name={person.fullName} />
                  <div className="grow">
                    <strong>{person.fullName}</strong>
                    <p>
                      {person.userId === userId
                        ? 'Tú'
                        : person.userId === event.organizerId
                          ? 'Organizador'
                          : 'Participante'}
                    </p>
                  </div>
                  {organizer && event.status === 'OPEN' && person.userId !== userId && (
                    <Button
                      variant="quiet"
                      onClick={() => {
                        mutation.reset()
                        setRemove({ id: person.userId, name: person.fullName })
                      }}
                      aria-label={`Retirar a ${person.fullName}`}
                    >
                      Retirar
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {!list.data.length && (
              <Empty
                title={
                  page ? 'No hay más participantes en esta página.' : 'El grupo empieza contigo.'
                }
              >
                {page
                  ? 'Vuelve a la página anterior.'
                  : 'Comparte la invitación para que tus amigos se unan.'}
              </Empty>
            )}
            <Pagination
              page={page}
              hasNext={list.data.length === 50}
              pending={list.isFetching}
              onChange={setPage}
            />
          </>
        )
      )}
      <ConfirmDialog
        open={!!remove}
        title={`¿Retirar a ${remove?.name || 'esta persona'}?`}
        confirmLabel="Retirar participante"
        pending={mutation.isPending}
        error={mutation.error}
        onCancel={() => setRemove(null)}
        onConfirm={() => mutation.mutate()}
      >
        <p>
          No podrá volver a unirse con la invitación de este evento. Solo puedes hacer esto antes
          del sorteo.
        </p>
      </ConfirmDialog>
    </section>
  )
}
export function WishesPage() {
  const { event, participant, userId } = useEventContext()
  const queryClient = useQueryClient()
  const refresh = useRefreshEvent(event.id)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ title: '', referenceUrl: '', referencePlace: '' })
  const [validation, setValidation] = useState<string | null>(null)
  const [remove, setRemove] = useState<Wish | null>(null)
  const [message, setMessage] = useState('')
  const wishes = useQuery({
    queryKey: [userId, 'wishes', event.id],
    queryFn: ({ signal }) => api.wishlist(event.id, signal),
    enabled: participant,
  })
  const changed = () => {
    queryClient.invalidateQueries({ queryKey: [userId, 'wishes', event.id] })
    refresh()
  }
  const add = useMutation({
    mutationFn: (body: WishRequest) => api.addWish(event.id, body),
    onSuccess: () => {
      setDraft({ title: '', referenceUrl: '', referencePlace: '' })
      setAdding(false)
      setMessage('Deseo añadido.')
      changed()
    },
    onError: changed,
  })
  const del = useMutation({
    mutationFn: () => api.deleteWish(event.id, remove!.id),
    onSuccess: () => {
      setRemove(null)
      setMessage('Deseo eliminado.')
      changed()
    },
    onError: changed,
  })
  if (!participant)
    return (
      <Empty title="Esta lista es personal.">
        Inscríbete en el intercambio para añadir tus deseos.
      </Empty>
    )
  const editable = event.status !== 'CANCELLED'
  return (
    <section className="section-page wishes-page">
      <div className="section-header">
        <div>
          <p className="eyebrow">UNA PISTA PARA QUIEN TE REGALA</p>
          <h2>Pequeñas cosas que te ilusionan.</h2>
        </div>
        {editable && (
          <Button
            onClick={() => {
              setAdding(true)
              setMessage('')
              add.reset()
            }}
            disabled={adding || !wishes.data || wishes.data.length >= 50}
          >
            <Plus size={18} /> Añadir deseo
          </Button>
        )}
      </div>
      <Notice>
        Solo tú y la persona que te regala pueden ver esta lista. Puedes actualizarla después del
        sorteo mientras el evento no esté cancelado.
      </Notice>
      {message && (
        <p role="status" className="success-message">
          {message}
        </p>
      )}
      {adding && editable && (
        <form
          className="panel wish-form stack"
          onSubmit={(e) => {
            e.preventDefault()
            if (add.isPending) return
            setValidation(null)
            const url = draft.referenceUrl.trim()
            const place = draft.referencePlace.trim()
            if (!draft.title.trim() || (!url && !place)) {
              setValidation('Indica el título y una URL o lugar de referencia.')
              return
            }
            if (url && !isHttps(url)) {
              setValidation('El enlace debe ser una URL HTTPS válida.')
              return
            }
            add.mutate({
              title: draft.title.trim(),
              referenceUrl: url || null,
              referencePlace: place || null,
            })
          }}
        >
          <h3>Algo que te gustaría recibir</h3>
          <Field label="Título del deseo" required>
            {(p) => (
              <input
                {...p}
                autoFocus
                required
                maxLength={160}
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              />
            )}
          </Field>
          <Field label="Enlace de referencia" hint="Opcional si indicas un lugar. Usa https://.">
            {(p) => (
              <input
                {...p}
                type="url"
                maxLength={2048}
                value={draft.referenceUrl}
                onChange={(e) => setDraft((d) => ({ ...d, referenceUrl: e.target.value }))}
              />
            )}
          </Field>
          <Field
            label="Lugar de referencia"
            hint="Por ejemplo, una librería o una tienda del barrio."
          >
            {(p) => (
              <textarea
                {...p}
                rows={2}
                maxLength={500}
                value={draft.referencePlace}
                onChange={(e) => setDraft((d) => ({ ...d, referencePlace: e.target.value }))}
              />
            )}
          </Field>
          {validation && (
            <p className="field-error" role="alert">
              {validation}
            </p>
          )}
          <ErrorNotice error={add.error} />
          <div className="form-actions">
            <Button
              variant="secondary"
              disabled={add.isPending}
              onClick={() => {
                setAdding(false)
                setValidation(null)
              }}
            >
              Cerrar
            </Button>
            <Button type="submit" pending={add.isPending}>
              {add.isPending ? 'Guardando…' : 'Guardar deseo'}
            </Button>
          </div>
        </form>
      )}
      <ErrorNotice error={wishes.error} retry={() => wishes.refetch()} />
      {wishes.isPending ? (
        <Loading />
      ) : wishes.data?.length ? (
        <WishList
          wishes={wishes.data}
          onDelete={
            editable
              ? (wish) => {
                  del.reset()
                  setRemove(wish)
                }
              : undefined
          }
          disabled={del.isPending}
        />
      ) : (
        !adding && (
          <Empty title="Dales una pista de lo que te haría ilusión.">
            Un libro, algo hecho a mano o ese detalle que siempre quisiste. Añade un enlace o un
            lugar para encontrarlo.
          </Empty>
        )
      )}
      <p className="caption">{wishes.data?.length || 0} de 50 deseos por evento.</p>
      <ConfirmDialog
        open={!!remove}
        title="¿Eliminar este deseo?"
        confirmLabel="Eliminar deseo"
        pending={del.isPending}
        error={del.error}
        onCancel={() => setRemove(null)}
        onConfirm={() => del.mutate()}
      >
        <p>«{remove?.title}» dejará de aparecer en tu lista.</p>
      </ConfirmDialog>
    </section>
  )
}
export function DrawPage() {
  const { event, organizer, userId } = useEventContext()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const refresh = useRefreshEvent(event.id)
  const draw = useMutation({
    mutationFn: () => api.draw(event.id),
    onSuccess: (result) => {
      queryClient.setQueryData([userId, 'event', event.id], {
        ...event,
        status: 'DRAWN',
        drawnAt: result.drawnAt,
        participantCount: result.participantCount,
      })
      refresh()
      navigate(`/eventos/${event.id}`, {
        replace: true,
        state: {
          message:
            'Sorteo realizado. Cada participante puede consultar su amigo secreto; los correos se enviarán en segundo plano.',
        },
      })
    },
    onError: refresh,
  })
  if (!organizer)
    return <ErrorNotice error={new ApiError(404, 'No podemos mostrar este contenido.')} />
  if (event.status !== 'OPEN' || event.autoDraw)
    return (
      <Empty
        title={
          event.status === 'DRAWN'
            ? 'El sorteo ya se realizó.'
            : 'Este evento no admite sorteo manual.'
        }
        action={
          <Link to={`/eventos/${event.id}`} className="button secondary">
            Volver al evento
          </Link>
        }
      >
        Consulta el estado del intercambio en sus detalles.
      </Empty>
    )
  return (
    <section className="draw-confirm panel">
      <span className="round-icon">
        <Shuffle size={28} />
      </span>
      <p className="eyebrow">EL MOMENTO DE LA SORPRESA</p>
      <h2>
        Un sorteo.
        <br />
        Un secreto para cada persona.
      </h2>
      <p>
        Participarán las <strong>{event.participantCount} personas</strong> inscritas. Cada una dará
        y recibirá un regalo, sin asignarse a sí misma.
      </p>
      <Notice>
        Después no podrás cambiar la lista de participantes ni repetir el sorteo. Las asignaciones
        se guardarán de forma única.
      </Notice>
      {event.participantCount < 2 && (
        <p className="field-error">
          Se necesitan al menos dos participantes para asignar amigos secretos.
        </p>
      )}
      <ErrorNotice error={draw.error} />
      <p className="caption">
        Cada participante podrá consultar su resultado aunque su correo se retrase.
      </p>
      <div className="form-actions">
        <Link className="button secondary" to={`/eventos/${event.id}`}>
          Volver al evento
        </Link>
        <Button
          onClick={() => draw.mutate()}
          pending={draw.isPending}
          disabled={event.participantCount < 2}
        >
          {draw.isPending ? 'Realizando sorteo…' : 'Realizar sorteo único'} <Shuffle size={18} />
        </Button>
      </div>
    </section>
  )
}
export function RevealPage() {
  const { event, participant, userId } = useEventContext()
  const queryClient = useQueryClient()
  const [revealed, setRevealed] = useState(false)
  const key = [userId, 'assignment', event.id]
  const assignment = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => api.assignment(event.id, signal),
    enabled: revealed && participant && event.status === 'DRAWN',
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  })
  function hide() {
    setRevealed(false)
    queryClient.cancelQueries({ queryKey: key })
    queryClient.removeQueries({ queryKey: key })
  }
  useEffect(() => {
    const visibility = () => {
      if (document.hidden) hide()
    }
    document.addEventListener('visibilitychange', visibility)
    return () => {
      document.removeEventListener('visibilitychange', visibility)
      queryClient.cancelQueries({ queryKey: key })
      queryClient.removeQueries({ queryKey: key })
    }
  }, [userId, event.id, queryClient])
  if (!participant)
    return <Empty title="Organizaste este intercambio, pero no participaste del sorteo." />
  if (event.status !== 'DRAWN')
    return (
      <Empty
        title={
          event.status === 'CANCELLED'
            ? 'El evento fue cancelado.'
            : 'La sorpresa aún está por llegar.'
        }
        action={
          <Link to={`/eventos/${event.id}`} className="button secondary">
            Ver estado del evento
          </Link>
        }
      >
        {event.status === 'OPEN'
          ? `El sorteo está planificado para el ${dateTime(event.drawAt, event.timezone)}.`
          : 'No existe un resultado para revelar.'}
      </Empty>
    )
  return (
    <div className="split-layout reveal-layout">
      <section className="panel reveal-card">
        <span className="private-label">
          <LockKeyhole size={16} /> SOLO PARA TI · CONFIDENCIAL
        </span>
        {!revealed ? (
          <>
            <EnvelopeArt small />
            <h2>Tu amigo secreto está listo.</h2>
            <p>Descubre a quién le regalarás en este intercambio.</p>
            <Button onClick={() => setRevealed(true)}>
              Ver mi amigo secreto <ArrowRight size={18} />
            </Button>
            <p className="caption">
              Solo tú puedes consultar tu asignación. Se ocultará al cambiar de pestaña.
            </p>
          </>
        ) : assignment.isPending ? (
          <Loading label="Abriendo tu secreto…" />
        ) : assignment.error ? (
          <>
            <ErrorNotice error={assignment.error} retry={() => assignment.refetch()} />
            <Button variant="quiet" onClick={hide}>
              Ocultar
            </Button>
          </>
        ) : (
          assignment.data && (
            <>
              <div className="secret-recipient" aria-live="polite">
                <p className="eyebrow">TU AMIGO SECRETO ES</p>
                <Avatar name={assignment.data.fullName} large />
                <h2>{assignment.data.fullName}</h2>
                {assignment.data.recipientUnavailable ? (
                  <Notice>
                    Esta persona eliminó su cuenta. Conversa con tu grupo para coordinar el
                    intercambio. El sorteo original se conserva.
                  </Notice>
                ) : (
                  <p>Un detalle tuyo le hará sonreír.</p>
                )}
              </div>
              <Button variant="quiet" onClick={hide}>
                <EyeOff size={17} /> Ocultar nombre
              </Button>
              {!assignment.data.recipientUnavailable && (
                <div className="recipient-wishes">
                  <div className="section-header">
                    <h3>Su lista de deseos</h3>
                    <Button
                      variant="quiet"
                      disabled={assignment.isFetching}
                      onClick={() => assignment.refetch()}
                      aria-label="Actualizar deseos del destinatario"
                    >
                      <RefreshCw size={17} />
                    </Button>
                  </div>
                  {assignment.data.wishlist.length ? (
                    <WishList wishes={assignment.data.wishlist} />
                  ) : (
                    <p>
                      Todavía no ha añadido deseos. Puedes volver a consultar esta lista más
                      adelante.
                    </p>
                  )}
                </div>
              )}
            </>
          )
        )}
      </section>
      <aside className="paper-note">
        <Gift size={27} />
        <h2>El detalle es lo que cuenta.</h2>
        <dl className="detail-list">
          <div>
            <dt>Regalo aproximado</dt>
            <dd>{money(event.giftBudgetMinor, event.currency)}</dd>
          </div>
          <div>
            <dt>Intercambio</dt>
            <dd>{dateTime(event.exchangeAt, event.timezone)}</dd>
          </div>
          <div>
            <dt>Modalidad</dt>
            <dd>{event.modality === 'IN_PERSON' ? 'Presencial' : 'Virtual'}</dd>
          </div>
        </dl>
        <Link className="text-link" to={`/eventos/${event.id}`}>
          Ver detalles del encuentro <ArrowRight size={16} />
        </Link>
      </aside>
    </div>
  )
}
export function InvitePage() {
  const { event, organizer, userId } = useEventContext()
  const [copyMessage, setCopyMessage] = useState('')
  const [emailDialog, setEmailDialog] = useState(false)
  const [emailQueued, setEmailQueued] = useState(false)
  const allowed = organizer && event.status === 'OPEN'
  const invitation = useQuery({
    queryKey: [userId, 'invitation', event.id],
    queryFn: ({ signal }) => api.invitation(event.id, signal),
    enabled: allowed,
  })
  const qr = useQuery({
    queryKey: [userId, 'qr', event.id],
    queryFn: ({ signal }) => api.qr(event.id, signal),
    enabled: allowed,
    gcTime: 0,
  })
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!qr.data) return
    const objectUrl = URL.createObjectURL(qr.data)
    setUrl(objectUrl)
    return () => {
      URL.revokeObjectURL(objectUrl)
      setUrl(null)
    }
  }, [qr.data])
  if (!allowed)
    return (
      <Empty
        title="La invitación no está disponible."
        action={
          <Link className="button secondary" to={`/eventos/${event.id}`}>
            Volver al evento
          </Link>
        }
      >
        Solo quien organiza puede compartirla mientras el evento esté abierto.
      </Empty>
    )
  return (
    <div className="split-layout">
      <section className="panel invite-card">
        <p className="eyebrow">EL GRUPO EMPIEZA CON UNA INVITACIÓN</p>
        <h2>Comparte la ilusión.</h2>
        <p>Invita por correo, comparte el enlace o deja que escaneen el código QR.</p>
        <div className="qr-frame">
          {url ? (
            <img
              src={url}
              width={240}
              height={240}
              alt={`Código QR para unirse a ${event.title}`}
            />
          ) : qr.isPending ? (
            <Loading label="Preparando el QR…" />
          ) : (
            <ErrorNotice error={qr.error} retry={() => qr.refetch()} />
          )}
        </div>
        {url && (
          <a href={url} download={`whoami-invitacion-${event.id}.png`} className="button secondary">
            <Download size={18} /> Descargar QR
          </a>
        )}
        <ErrorNotice error={invitation.error} retry={() => invitation.refetch()} />
        {invitation.data && (
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setEmailQueued(false)
                setEmailDialog(true)
              }}
            >
              <Send size={18} />
              Mandar correo de invitación
            </Button>
            {emailQueued && (
              <p role="status" className="success-message">
                Invitación programada para envío. Quien la reciba deberá confirmar su participación.
              </p>
            )}
            <Field label="Enlace de invitación">
              {(p) => (
                <input
                  {...p}
                  className="mono invitation-url"
                  readOnly
                  value={invitation.data.url}
                  onFocus={(e) => e.target.select()}
                />
              )}
            </Field>
            <div className="form-actions">
              <Button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(invitation.data!.url)
                    setCopyMessage('Enlace copiado.')
                  } catch {
                    setCopyMessage('Selecciona y copia el enlace del campo de arriba.')
                  }
                }}
              >
                <Copy size={18} /> Copiar enlace
              </Button>
              {typeof navigator.share === 'function' && (
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await navigator.share({
                        title: event.title,
                        text: 'Te invito a nuestro intercambio de Amigo Secreto.',
                        url: invitation.data!.url,
                      })
                    } catch {
                      /* Cancelling a native share is not an error. */
                    }
                  }}
                >
                  <Share2 size={18} /> Compartir
                </Button>
              )}
            </div>
            <p role="status" className="caption">
              {copyMessage}
            </p>
          </>
        )}
        <Notice>
          Para unirse es necesario iniciar sesión. El enlace no inscribe a nadie automáticamente.
        </Notice>
      </section>
      {emailDialog && (
        <InvitationEmailDialog
          eventId={event.id}
          eventTitle={event.title}
          userId={userId}
          onClose={() => setEmailDialog(false)}
          onQueued={() => {
            setEmailDialog(false)
            setEmailQueued(true)
          }}
        />
      )}
      <aside className="paper-note">
        <Send size={27} />
        <h2>
          Una invitación.
          <br />
          Muchas ganas de compartir.
        </h2>
        <p>
          La vista pública muestra el título, las fechas, el regalo aproximado y quién organiza.
        </p>
        <p>
          Los nombres de participantes, el recuento y los datos del lugar o la reunión se muestran
          después de unirse.
        </p>
      </aside>
    </div>
  )
}
export function NotificationsPage() {
  const { event, organizer, userId } = useEventContext()
  const stats = useQuery({
    queryKey: [userId, 'notifications', event.id],
    queryFn: ({ signal }) => api.notifications(event.id, signal),
    enabled: organizer,
    refetchInterval: 30000,
  })
  const [message, setMessage] = useState('')
  const retry = useMutation({
    mutationFn: () => api.retryNotifications(event.id),
    onSuccess: () => {
      setMessage('Reintento programado. El sorteo sigue guardado.')
      stats.refetch()
    },
    onError: () => stats.refetch(),
  })
  if (!organizer)
    return <ErrorNotice error={new ApiError(404, 'No podemos mostrar este contenido.')} />
  const labels = {
    PENDING: 'Pendientes de envío',
    SENDING: 'Procesando',
    SENT: 'Aceptados para envío',
    FAILED: 'Fallidos',
    CANCELLED: 'Anulados',
  } as const
  return (
    <section className="section-page notifications-page">
      <div className="section-header">
        <div>
          <p className="eyebrow">LOS AVISOS DEL GRUPO</p>
          <h2>Cada mensaje, a su tiempo.</h2>
        </div>
        <Button variant="secondary" onClick={() => stats.refetch()} disabled={stats.isFetching}>
          <RefreshCw size={17} /> Actualizar
        </Button>
      </div>
      <Notice>
        «Aceptado para envío» significa que el proveedor recibió el correo. No confirma que llegó a
        la bandeja de entrada.
      </Notice>
      <ErrorNotice error={stats.error} retry={() => stats.refetch()} />
      {stats.isPending ? (
        <Loading />
      ) : (
        stats.data && (
          <dl className="notification-stats">
            {Object.entries(labels).map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd className="mono">{stats.data[key as keyof typeof labels] || 0}</dd>
              </div>
            ))}
          </dl>
        )
      )}
      <div className="retry-panel">
        <h3>Si algún correo no salió, podemos volver a intentarlo.</h3>
        <p>
          Solo se reencolan los fallos definitivos. Esta acción nunca repite el sorteo ni cambia las
          asignaciones.
        </p>
        <ErrorNotice error={retry.error} />
        <Button
          onClick={() => {
            setMessage('')
            retry.mutate()
          }}
          pending={retry.isPending}
          disabled={!stats.data || !stats.data.FAILED}
        >
          {retry.isPending ? 'Programando…' : 'Reintentar correos fallidos'}
        </Button>
        {message && (
          <p role="status" className="success-message">
            <Check size={16} /> {message}
          </p>
        )}
      </div>
      <p className="caption">
        Los recordatorios se programan 72 horas antes del sorteo y del intercambio. Los contadores
        no exponen destinatarios ni contenido privado.
      </p>
    </section>
  )
}
