import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CalendarDays, Gift, Plus, UsersRound } from 'lucide-react'
import { useAuth } from '../auth-context'
import { api } from '../lib/api'
import { dateTime } from '../lib/format'
import {
  Empty,
  EnvelopeArt,
  ErrorNotice,
  Loading,
  PageHeading,
  Pagination,
  Status,
} from '../components/ui'
import type { EventSummary } from '../lib/types'

function EventCard({ event, featured = false }: { event: EventSummary; featured?: boolean }) {
  return (
    <article className={featured ? 'event-card featured' : 'event-row'}>
      <div className="event-title">
        <Status status={event.status} />
        <h2>
          <Link to={`/eventos/${event.id}`}>{event.title}</Link>
        </h2>
      </div>
      <dl className="event-dates">
        <div>
          <dt>
            <CalendarDays size={16} /> Sorteo
          </dt>
          <dd>{dateTime(event.drawAt)}</dd>
        </div>
        <div>
          <dt>
            <Gift size={16} /> Intercambio
          </dt>
          <dd>{dateTime(event.exchangeAt)}</dd>
        </div>
        <div>
          <dt>
            <UsersRound size={16} /> Participantes
          </dt>
          <dd>
            {event.participantCount} {event.participantCount === 1 ? 'persona' : 'personas'}
          </dd>
        </div>
      </dl>
      <Link className={featured ? 'button secondary' : 'text-link'} to={`/eventos/${event.id}`}>
        Ver evento <ArrowRight size={17} />
      </Link>
    </article>
  )
}
export default function EventsPage() {
  const { session } = useAuth()
  const [page, setPage] = useState(0)
  const list = useQuery({
    queryKey: [session!.user.id, 'events', page],
    queryFn: ({ signal }) => api.events(page, signal),
  })
  const profile = useQuery({
    queryKey: [session!.user.id, 'profile'],
    queryFn: ({ signal }) => api.profile(signal),
  })
  const name = profile.data?.fullName.split(' ')[0]
  return (
    <div className="container">
      <PageHeading
        eyebrow={name ? `HOLA, ${name}` : 'ENTRE AMIGOS'}
        title="Tus próximos encuentros"
        action={
          <Link to="/eventos/nuevo" className="button primary">
            <Plus size={19} /> Crear evento
          </Link>
        }
      >
        Un lugar para reunir al grupo y mantener la sorpresa.
      </PageHeading>
      <ErrorNotice error={list.error} retry={() => list.refetch()} />
      {list.isPending ? (
        <Loading label="Buscando tus encuentros…" />
      ) : list.isSuccess && !list.data.length && !page ? (
        <Empty
          title="Tu primer intercambio empieza aquí."
          action={
            <Link to="/eventos/nuevo" className="button primary">
              Crear mi primer evento <ArrowRight size={18} />
            </Link>
          }
        >
          Elige las fechas, invita a tus amigos y deja que empiece la ilusión.
        </Empty>
      ) : (
        list.data && (
          <div className="split-layout events-layout">
            <section>
              <div className="section-header">
                <p className="eyebrow">{page ? 'TUS EVENTOS' : 'TU GRUPO, A UN PASO'}</p>
                <span className="caption">Fechas en hora de Lima</span>
              </div>
              {list.data.map((event, i) => (
                <EventCard key={event.id} event={event} featured={!page && i === 0} />
              ))}
              {!list.data.length && <p>No hay más eventos en esta página.</p>}
              <Pagination
                page={page}
                hasNext={list.data.length === 20}
                onChange={setPage}
                pending={list.isFetching}
              />
            </section>
            <aside className="paper-note">
              <EnvelopeArt small />
              <h2>Un detalle entre amigos.</h2>
              <p>Tu lista de deseos da una pista. Tu amigo secreto pone la sorpresa.</p>
              <div className="note-signature">
                whoami. <span>Amigo Secreto</span>
              </div>
            </aside>
          </div>
        )
      )}
    </div>
  )
}
