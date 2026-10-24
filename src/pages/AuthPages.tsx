import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'
import { useAuth } from '../auth-context'
import { authMessage, exchangeOnce, hasRecoveryGrant, pendingReturn } from '../lib/auth'
import { Button, EnvelopeArt, ErrorNotice, Field, Loading, Notice } from '../components/ui'

function AuthFrame({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children: ReactNode
}) {
  return (
    <div className="container auth-layout">
      <section className="auth-form">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {children}
      </section>
      <aside className="auth-art">
        <EnvelopeArt />
        <h2>
          La ilusión de regalar.
          <br />
          El gusto de sorprender.
        </h2>
        <p>Tu próximo encuentro empieza con un pequeño secreto.</p>
        <span className="auth-art-label">
          <LockKeyhole size={16} /> Amigo Secreto · whoami.
        </span>
      </aside>
    </div>
  )
}
function Password({
  label = 'Contraseña',
  value,
  onChange,
  newPassword = false,
  hint,
}: {
  label?: string
  value: string
  onChange: (v: string) => void
  newPassword?: boolean
  hint?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <Field label={label} required hint={hint}>
      {(props) => (
        <div className="password-input">
          <input
            {...props}
            type={show ? 'text' : 'password'}
            required
            minLength={newPassword ? 8 : undefined}
            maxLength={128}
            autoComplete={newPassword ? 'new-password' : 'current-password'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <button
            type="button"
            className="icon-button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
          >
            {show ? <EyeOff size={19} /> : <Eye size={19} />}
          </button>
        </div>
      )}
    </Field>
  )
}
export function AccessPage({ register = false }: { register?: boolean }) {
  const location = useLocation()
  const [accountDeleted] = useState(
    () =>
      location.state?.accountDeleted || sessionStorage.getItem('whoami:account-deleted') === '1',
  )
  useEffect(() => {
    sessionStorage.removeItem('whoami:account-deleted')
  }, [])
  const { client, session, ready, error, retry, recovery } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState<'email' | 'google' | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [unconfirmed, setUnconfirmed] = useState(false)
  const returnDestination = useRef(pendingReturn())
  if (ready && session && !recovery && !busy)
    return <Navigate to={returnDestination.current} replace />
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!client || busy) return
    setBusy('email')
    setFailure(null)
    setUnconfirmed(false)
    try {
      if (register) {
        if (!name.trim()) {
          setFailure('Indica tu nombre completo.')
          return
        }
        const { data, error } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })
        if (error) throw error
        setPassword('')
        if (!data.session) navigate('/auth/confirmar', { state: { email: email.trim() } })
        else navigate(pendingReturn(true), { replace: true })
      } else {
        const { error } = await client.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
        setPassword('')
        navigate(pendingReturn(true), { replace: true })
      }
    } catch (e) {
      setFailure(authMessage(e))
      setUnconfirmed((e as { code?: string }).code === 'email_not_confirmed')
    } finally {
      setBusy(null)
    }
  }
  async function google() {
    if (!client || busy) return
    setBusy('google')
    setFailure(null)
    try {
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) throw error
    } catch (e) {
      setFailure(authMessage(e))
      setBusy(null)
    }
  }
  return (
    <AuthFrame
      eyebrow={register ? 'UN NUEVO ENCUENTRO' : 'QUÉ BUENO VERTE'}
      title={register ? 'Todo empieza contigo.' : 'Bienvenido de nuevo.'}
    >
      <p className="intro">
        {register
          ? 'Crea tu cuenta y reúne a tu grupo para el próximo intercambio.'
          : 'Entra para organizar, descubrir y compartir.'}
      </p>
      <ErrorNotice error={error} retry={retry} />
      {accountDeleted && (
        <Notice>
          Tu cuenta se desactivó. Estamos completando la eliminación de tu acceso y tus fotos. Los
          sorteos históricos se conservarán sin tus datos personales.
        </Notice>
      )}
      {!ready && <p role="status">Preparando el acceso…</p>}
      <form
        onSubmit={submit}
        className="stack"
        aria-label={register ? 'Crear cuenta' : 'Iniciar sesión'}
      >
        {register && (
          <Field label="Nombre completo" required>
            {(props) => (
              <input
                {...props}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={160}
                autoComplete="name"
              />
            )}
          </Field>
        )}
        <Field label="Correo electrónico" required>
          {(props) => (
            <input
              {...props}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={254}
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
            />
          )}
        </Field>
        <Password
          value={password}
          onChange={setPassword}
          newPassword={register}
          hint={
            register ? 'Usa al menos 8 caracteres. Combina letras, números y símbolos.' : undefined
          }
        />
        {!register && (
          <Link className="align-right text-link" to="/recuperar">
            Olvidé mi contraseña
          </Link>
        )}
        {failure && (
          <div className="field-error" role="alert">
            {failure}
            {unconfirmed && (
              <p>
                <Link to="/auth/confirmar" state={{ email }}>
                  Solicitar otro enlace
                </Link>
              </p>
            )}
          </div>
        )}
        <Button type="submit" pending={busy === 'email'} disabled={!ready || !client || !!busy}>
          {busy === 'email' ? 'Un momento…' : register ? 'Crear mi cuenta' : 'Entrar'}{' '}
          <ArrowRight size={18} />
        </Button>
      </form>
      <div className="divider">
        <span>o continúa con</span>
      </div>
      <Button
        type="button"
        variant="secondary"
        className="full"
        onClick={google}
        pending={busy === 'google'}
        disabled={!ready || !client || !!busy}
      >
        {busy === 'google' ? 'Conectando con Google…' : 'Continuar con Google'}
      </Button>
      <p className="auth-switch">
        {register ? '¿Ya tienes una cuenta?' : '¿Es tu primera vez aquí?'}{' '}
        <Link to={register ? '/login' : '/registro'}>
          {register ? 'Inicia sesión' : 'Crea tu cuenta'}
        </Link>
      </p>
      <p className="fine-print">
        Tu cuenta te permite participar y guardar tus deseos de forma privada.
      </p>
    </AuthFrame>
  )
}
export function ConfirmEmailPage() {
  const { client, error, ready, retry } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email || '')
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [failure, setFailure] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  useEffect(() => {
    if (!cooldown) return
    const timer = window.setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])
  return (
    <AuthFrame eyebrow="UN ÚLTIMO PASO" title="Revisa tu correo.">
      <p className="intro">
        Si tu cuenta necesita confirmación, recibirás un enlace para activarla. Revisa también la
        carpeta de correo no deseado.
      </p>
      <Notice>Abre el enlace en este mismo navegador para completar tu acceso.</Notice>
      <ErrorNotice error={error} retry={retry} />
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!client || busy || cooldown) return
          setBusy(true)
          setFailure(null)
          try {
            const { error } = await client.auth.resend({
              type: 'signup',
              email: email.trim(),
              options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
            })
            if (error) throw error
            setSent(true)
            setCooldown(60)
          } catch (e) {
            setFailure(authMessage(e))
          } finally {
            setBusy(false)
          }
        }}
      >
        <Field label="Correo electrónico" required>
          {(p) => (
            <input
              {...p}
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>
        {failure && (
          <p role="alert" className="field-error">
            {failure}
          </p>
        )}
        {sent && <p role="status">Si corresponde, recibirás otro enlace de confirmación.</p>}
        <Button
          variant="secondary"
          type="submit"
          pending={busy}
          disabled={!ready || !client || cooldown > 0}
        >
          {cooldown ? `Solicitar otro enlace en ${cooldown}s` : 'Solicitar otro enlace'}
        </Button>
        <Link className="button primary" to="/login">
          Volver a iniciar sesión <ArrowRight size={18} />
        </Link>
      </form>
    </AuthFrame>
  )
}
export function RecoveryPage() {
  const { client, ready, error, retry } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  return (
    <AuthFrame eyebrow="RECUPERA TU ACCESO" title="Volvamos a encontrarnos.">
      <p className="intro">Te ayudamos a crear una nueva contraseña.</p>
      <ErrorNotice error={error} retry={retry} />
      {sent ? (
        <>
          <Notice success>
            Si existe una cuenta con ese correo, recibirás las instrucciones para recuperar tu
            acceso.
          </Notice>
          <p>Abre el enlace en este mismo navegador y revisa también tu correo no deseado.</p>
          <Link className="button secondary" to="/login">
            Volver al inicio de sesión
          </Link>
        </>
      ) : (
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!client || busy) return
            setBusy(true)
            setFailure(null)
            try {
              const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
                redirectTo: `${window.location.origin}/auth/callback?intent=recovery`,
              })
              if (error) throw error
              setSent(true)
            } catch (e) {
              setFailure(authMessage(e))
            } finally {
              setBusy(false)
            }
          }}
        >
          <Field label="Correo electrónico" required>
            {(p) => (
              <input
                {...p}
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </Field>
          {failure && (
            <p role="alert" className="field-error">
              {failure}
            </p>
          )}
          <Button pending={busy} disabled={!ready || !client} type="submit">
            {busy ? 'Solicitando enlace…' : 'Recuperar mi acceso'} <Mail size={18} />
          </Button>
          <Link to="/login" className="text-link">
            Volver a iniciar sesión
          </Link>
        </form>
      )}
    </AuthFrame>
  )
}
export function CallbackPage() {
  const { client, error, retry, recovery } = useAuth()
  const navigate = useNavigate()
  const [failure, setFailure] = useState(false)
  useEffect(() => {
    if (!client) return
    let active = true
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const failed = params.has('error') || !code
    if (failed) {
      window.history.replaceState({}, '', '/auth/callback')
      setFailure(true)
      return
    }
    exchangeOnce(client, code!)
      .then(({ data, error }) => {
        if (!active) return
        window.history.replaceState({}, '', '/auth/callback')
        if (error || !data.session) {
          setFailure(true)
          return
        }
        navigate(
          hasRecoveryGrant(data.session.user.id) || recovery
            ? '/auth/nueva-clave'
            : pendingReturn(true),
          { replace: true },
        )
      })
      .catch(() => {
        if (active) {
          window.history.replaceState({}, '', '/auth/callback')
          setFailure(true)
        }
      })
    return () => {
      active = false
    }
  }, [client, navigate])
  return (
    <AuthFrame
      eyebrow="TU ACCESO"
      title={failure ? 'No pudimos completar el acceso.' : 'Un momento, ya casi estás.'}
    >
      {failure ? (
        <>
          <p className="intro">
            El enlace puede haber vencido o haberse abierto en otro navegador. Inicia el proceso
            nuevamente desde aquí.
          </p>
          <div className="stack">
            <Link to="/login" className="button primary">
              Volver a entrar
            </Link>
            <Link to="/recuperar" className="text-link">
              Solicitar un enlace de recuperación
            </Link>
          </div>
        </>
      ) : (
        <>
          <ErrorNotice error={error} retry={retry} />
          {!error && <Loading label="Estamos completando tu acceso…" />}
        </>
      )}
    </AuthFrame>
  )
}
export function NewPasswordPage() {
  const { client, session, ready, recovery, finishRecovery } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  return (
    <AuthFrame
      eyebrow="TU NUEVA CONTRASEÑA"
      title={done ? 'Ya puedes volver.' : 'Un nuevo comienzo.'}
    >
      {!ready ? (
        <Loading />
      ) : done ? (
        <>
          <Notice success>Tu contraseña se actualizó correctamente.</Notice>
          <Button
            onClick={() => {
              finishRecovery()
              navigate(pendingReturn(true), { replace: true })
            }}
          >
            Continuar a Whoami <ArrowRight size={18} />
          </Button>
        </>
      ) : !session || !recovery ? (
        <>
          <p>Necesitas un enlace de recuperación válido para crear una nueva contraseña.</p>
          <Link className="button primary" to="/recuperar">
            Solicitar otro enlace
          </Link>
        </>
      ) : (
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!client || busy) return
            if (password !== confirmation) {
              setFailure('Las contraseñas no coinciden.')
              return
            }
            setBusy(true)
            setFailure(null)
            try {
              const { error } = await client.auth.updateUser({ password })
              if (error) throw error
              setPassword('')
              setConfirmation('')
              setDone(true)
            } catch (e) {
              setFailure(authMessage(e))
            } finally {
              setBusy(false)
            }
          }}
        >
          <p className="intro">Elige una contraseña que solo tú conozcas.</p>
          <Password
            label="Nueva contraseña"
            newPassword
            value={password}
            onChange={setPassword}
            hint="Al menos 8 caracteres; combina letras, números y símbolos."
          />
          <Password
            label="Confirmar contraseña"
            newPassword
            value={confirmation}
            onChange={setConfirmation}
          />
          {failure && (
            <p className="field-error" role="alert">
              {failure}
            </p>
          )}
          <Button pending={busy} type="submit">
            {busy ? 'Guardando…' : 'Guardar contraseña'}
          </Button>
        </form>
      )}
    </AuthFrame>
  )
}
