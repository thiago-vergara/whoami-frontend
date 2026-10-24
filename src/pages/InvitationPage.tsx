import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, CalendarDays, Gift, LockKeyhole } from 'lucide-react'
import { useAuth } from '../auth-context'
import { api, ApiError } from '../lib/api'
import { rememberReturn } from '../lib/auth'
import { dateTime, money } from '../lib/format'
import { Avatar, Button, EnvelopeArt, ErrorNotice, Loading, Notice, Status } from '../components/ui'

export default function InvitationPage() {
  const { token = '' } = useParams()
  const { session, ready } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const valid = /^[A-Za-z0-9_-]{43}$/.test(token)
  const preview = useQuery({
    queryKey: ['public-invitation', token],
    queryFn: ({ signal }) => api.preview(token, signal),
    enabled: valid,
    retry: false,
  })
  useEffect(() => {
    if (valid) rememberReturn(`/join/${token}`)
  }, [token, valid])
  const join = useMutation({
    mutationFn: () => api.joinInvitation(token),
    onSuccess: (event) => {
      queryClient.invalidateQueries({ queryKey: [session!.user.id, 'events'] })
      queryClient.setQueryData([session!.user.id, 'event', event.id], event)
      navigate(`/eventos/${event.id}`, { replace: true })
    },
    onError: () => preview.refetch(),
  })
  if (!valid || preview.error)
    return (
      <div className="container narrow">
        <ErrorNotice
          error={preview.error || new ApiError(404, 'No podemos mostrar esta invitación.')}
          retry={valid ? () => preview.refetch() : undefined}
        />
        <Link to="/eventos" className="text-link">
          Volver a mis eventos
        </Link>
      </div>
    )
  if (!preview.data)
    return (
      <div className="container">
        <Loading label="Abriendo tu invitación…" />
      </div>
    )
  const event = preview.data
  return (
    <div className="container invitation-layout">
      <section className="invitation-copy">
        <p className="eyebrow">TIENES UNA INVITACIÓN</p>
        <h1>
          Hay un lugar
          <br />
          para ti.
        </h1>
        <p className="intro">Alguien quiere compartir contigo la ilusión de regalar.</p>
        <EnvelopeArt />
        <div className="privacy-line">
          <LockKeyhole size={19} />
          <span>Los detalles privados del grupo se muestran después de unirte.</span>
        </div>
      </section>
      <section className="panel invitation-panel">
        <Status status={event.status} />
        <h2>{event.title}</h2>
        <div className="organizer-line">
          <Avatar name={event.organizerName} />
          <p>
            Organiza
            <br />
            <strong>{event.organizerName}</strong>
          </p>
        </div>
        <p className="preserve-lines">{event.description}</p>
        <dl className="detail-list">
          <div>
            <dt>
              <CalendarDays size={18} /> Sorteo
            </dt>
            <dd>{dateTime(event.drawAt)}</dd>
          </div>
          <div>
            <dt>
              <Gift size={18} /> Intercambio
            </dt>
            <dd>{dateTime(event.exchangeAt)}</dd>
          </div>
          <div>
            <dt>Regalo aproximado</dt>
            <dd>{money(event.giftBudgetMinor)}</dd>
          </div>
        </dl>
        <p className="caption">Fechas en hora de Lima. El valor del regalo es orientativo.</p>
        <ErrorNotice error={join.error} />
        {event.status === 'OPEN' ? (
          session ? (
            <>
              <Button className="full" pending={join.isPending} onClick={() => join.mutate()}>
                {join.isPending ? 'Uniéndote…' : 'Unirme al intercambio'} <ArrowRight size={18} />
              </Button>
              <p className="fine-print">
                Al unirte, podrás consultar los detalles y añadir tus deseos.
              </p>
            </>
          ) : (
            <>
              <Link
                className="button primary full"
                to="/login"
                onClick={() => rememberReturn(`/join/${token}`)}
              >
                Entrar para unirme <ArrowRight size={18} />
              </Link>
              <p className="auth-switch">
                ¿Aún no tienes cuenta?{' '}
                <Link to="/registro" onClick={() => rememberReturn(`/join/${token}`)}>
                  Regístrate
                </Link>
              </p>
              {!ready && (
                <p role="status" className="caption">
                  Comprobando tu acceso…
                </p>
              )}
            </>
          )
        ) : (
          <Notice>
            {event.status === 'DRAWN'
              ? 'El sorteo ya se realizó y no admite nuevas participaciones.'
              : 'Este evento fue cancelado y no admite participaciones.'}
          </Notice>
        )}
        {session && (
          <Link className="text-link" to="/eventos">
            Mis eventos
          </Link>
        )}
      </section>
    </div>
  )
}
