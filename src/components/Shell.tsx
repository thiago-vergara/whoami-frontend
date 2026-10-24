import { useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, LogOut, UserRound } from 'lucide-react'
import { useAuth } from '../auth-context'
import { api } from '../lib/api'
import { rememberReturn } from '../lib/auth'
import { Avatar, ErrorNotice, Loading } from './ui'

export function Shell() {
  const { session, signOut, recovery } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [menu, setMenu] = useState(false)
  const [logoutError, setLogoutError] = useState<unknown>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const me = useQuery({
    queryKey: [session?.user.id, 'profile'],
    queryFn: ({ signal }) => api.profile(signal),
    enabled: !!session && !location.pathname.startsWith('/auth/'),
  })
  useEffect(() => {
    setMenu(false)
    setLogoutError(null)
    document.querySelector<HTMLElement>('main')?.focus({ preventScroll: true })
    window.scrollTo(0, 0)
  }, [location.pathname])
  useEffect(() => {
    if (
      recovery &&
      location.pathname !== '/auth/callback' &&
      location.pathname !== '/auth/nueva-clave'
    )
      navigate('/auth/nueva-clave', { replace: true })
  }, [recovery, location.pathname, navigate])
  return (
    <>
      <a className="skip-link" href="#main">
        Saltar al contenido
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" to={session ? '/eventos' : '/'} aria-label="Whoami, inicio">
            whoami<span>.</span>
          </Link>
          {session ? (
            <>
              <NavLink className="header-events" to="/eventos">
                Mis eventos
              </NavLink>
              <div className="account">
                <button
                  type="button"
                  className="account-trigger"
                  aria-label={`Cuenta de ${me.data?.fullName || 'mi perfil'}`}
                  aria-expanded={menu}
                  aria-controls="account-menu"
                  onClick={() => setMenu((m) => !m)}
                >
                  <Avatar name={me.data?.fullName || 'Mi perfil'} url={me.data?.avatarUrl} />
                  <span className="account-name">{me.data?.fullName || 'Mi perfil'}</span>
                  <span aria-hidden="true">⌄</span>
                </button>
                {menu && (
                  <nav
                    id="account-menu"
                    className="account-menu"
                    aria-label="Cuenta"
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setMenu(false)
                    }}
                  >
                    <Link to="/perfil">
                      <UserRound size={18} /> Mi perfil
                    </Link>
                    <button
                      type="button"
                      disabled={loggingOut}
                      onClick={async () => {
                        setLoggingOut(true)
                        try {
                          await signOut()
                          navigate('/login', { replace: true })
                        } catch (e) {
                          setLogoutError(e)
                        } finally {
                          setLoggingOut(false)
                        }
                      }}
                    >
                      <LogOut size={18} />
                      {loggingOut ? 'Saliendo…' : 'Cerrar sesión'}
                    </button>
                    <ErrorNotice error={logoutError} />
                  </nav>
                )}
              </div>
            </>
          ) : (
            <Link className="header-login" to="/login">
              Iniciar sesión <ArrowRight size={16} />
            </Link>
          )}
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="site-footer">
        <Link className="brand small" to="/">
          whoami<span>.</span>
        </Link>
        <span>Amigo Secreto</span>
        <p className="footer-ownership">
          © {new Date().getFullYear()} Whoami. Propiedad de{' '}
          <a href="https://www.thiagovergaravega.com" target="_blank" rel="noopener noreferrer">
            Thiago Vergara<span className="sr-only"> (nueva pestaña)</span>
          </a>
          . Todos los derechos reservados.
        </p>
      </footer>
    </>
  )
}
export function RequireAuth() {
  const { session, ready, error, retry } = useAuth()
  const location = useLocation()
  useEffect(() => {
    if (ready && !session) rememberReturn(location.pathname)
  }, [ready, session, location.pathname])
  if (!ready)
    return (
      <div className="container">
        <Loading label="Preparando tu acceso…" />
      </div>
    )
  if (error)
    return (
      <div className="container narrow">
        <ErrorNotice error={error} retry={retry} />
      </div>
    )
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}
