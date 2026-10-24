import { Link } from 'react-router-dom'
import { ArrowRight, Gift, LockKeyhole, UsersRound } from 'lucide-react'
import { EnvelopeArt } from '../components/ui'
import { useAuth } from '../auth-context'
import { rememberReturn } from '../lib/auth'

export default function Landing() {
  const { session } = useAuth()
  return (
    <div className="container landing">
      <section className="hero">
        <div>
          <p className="eyebrow">AMIGO SECRETO, ENTRE LOS TUYOS</p>
          <h1>
            El regalo empieza
            <br />
            por <span>reunirse.</span>
          </h1>
          <p className="hero-copy">
            Junta a tus personas favoritas. Nosotros guardamos el secreto; ustedes ponen la ilusión.
          </p>
          <Link
            className="button primary"
            to={session ? '/eventos/nuevo' : '/registro'}
            onClick={() => rememberReturn('/eventos/nuevo')}
          >
            Crear un intercambio <ArrowRight size={18} />
          </Link>
          <p className="hero-footnote">Un nombre para ti. Un detalle para alguien más.</p>
        </div>
        <div className="hero-art">
          <span className="art-label mono">DE: ALGUIEN QUE TE CONOCE</span>
          <EnvelopeArt />
          <span className="art-label bottom mono">PARA: UNA PERSONA ESPECIAL</span>
        </div>
      </section>
      <section className="landing-story">
        <div>
          <p className="eyebrow">MENOS COORDINAR. MÁS COMPARTIR.</p>
          <h2>
            Una pequeña tradición.
            <br />
            Todo lo que necesita.
          </h2>
        </div>
        <ol className="steps">
          <li>
            <span className="mono">01</span>
            <div>
              <h3>
                <UsersRound size={20} /> Reúne al grupo
              </h3>
              <p>Elige las fechas y comparte tu invitación con un enlace o QR.</p>
            </div>
          </li>
          <li>
            <span className="mono">02</span>
            <div>
              <h3>
                <LockKeyhole size={20} /> El secreto queda contigo
              </h3>
              <p>Tras el sorteo, cada persona descubre únicamente a quién le regalará.</p>
            </div>
          </li>
          <li>
            <span className="mono">03</span>
            <div>
              <h3>
                <Gift size={20} /> Regala con una pista
              </h3>
              <p>Crea tu lista de deseos y consulta la de tu amigo secreto.</p>
            </div>
          </li>
        </ol>
      </section>
      <section className="landing-note">
        <LockKeyhole size={22} />
        <p>
          Las asignaciones y los deseos son privados. La persona que organiza no tiene acceso a las
          parejas del grupo.
        </p>
      </section>
    </div>
  )
}
