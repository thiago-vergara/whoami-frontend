import { createBrowserRouter, Link, useRouteError, type RouteObject } from 'react-router-dom'
import { Shell, RequireAuth } from './components/Shell'
import { EnvelopeArt } from './components/ui'

function RouteFailure() {
  useRouteError()
  return (
    <div className="container narrow error-page">
      <EnvelopeArt small />
      <h1>No pudimos abrir esta página.</h1>
      <p>
        Inténtalo de nuevo. Si estabas completando un formulario, revisa sus datos antes de enviarlo
        otra vez.
      </p>
      <a className="button primary" href="/">
        Volver al inicio
      </a>
    </div>
  )
}
function NotFound() {
  return (
    <div className="container narrow error-page">
      <EnvelopeArt small />
      <p className="eyebrow">A VECES NOS CRUZAMOS DE CAMINO</p>
      <h1>Esta página no está disponible.</h1>
      <p>Vuelve al inicio para encontrar tu próximo encuentro.</p>
      <Link to="/" className="button primary">
        Volver al inicio
      </Link>
    </div>
  )
}
export const routes: RouteObject[] = [
  {
    Component: Shell,
    errorElement: <RouteFailure />,
    children: [
      { index: true, lazy: async () => ({ Component: (await import('./pages/Landing')).default }) },
      {
        path: 'login',
        lazy: async () => ({ Component: (await import('./pages/AuthPages')).AccessPage }),
      },
      {
        path: 'registro',
        lazy: async () => {
          const { AccessPage } = await import('./pages/AuthPages')
          return { Component: () => <AccessPage register /> }
        },
      },
      {
        path: 'auth/confirmar',
        lazy: async () => ({ Component: (await import('./pages/AuthPages')).ConfirmEmailPage }),
      },
      {
        path: 'recuperar',
        lazy: async () => ({ Component: (await import('./pages/AuthPages')).RecoveryPage }),
      },
      {
        path: 'auth/callback',
        lazy: async () => ({ Component: (await import('./pages/AuthPages')).CallbackPage }),
      },
      {
        path: 'auth/nueva-clave',
        lazy: async () => ({ Component: (await import('./pages/AuthPages')).NewPasswordPage }),
      },
      {
        path: 'join/:token',
        lazy: async () => ({ Component: (await import('./pages/InvitationPage')).default }),
      },
      {
        Component: RequireAuth,
        children: [
          {
            path: 'perfil',
            lazy: async () => ({ Component: (await import('./pages/ProfilePage')).default }),
          },
          {
            path: 'eventos',
            lazy: async () => ({ Component: (await import('./pages/EventsPage')).default }),
          },
          {
            path: 'eventos/nuevo',
            lazy: async () => ({ Component: (await import('./pages/EventForm')).default }),
          },
          {
            path: 'eventos/:id/editar',
            lazy: async () => ({ Component: (await import('./pages/EventForm')).default }),
          },
          {
            path: 'eventos/:id',
            lazy: async () => ({ Component: (await import('./pages/EventPage')).default }),
            children: [
              {
                index: true,
                lazy: async () => ({ Component: (await import('./pages/EventPage')).EventDetails }),
              },
              {
                path: 'participantes',
                lazy: async () => ({
                  Component: (await import('./pages/EventPage')).ParticipantsPage,
                }),
              },
              {
                path: 'deseos',
                lazy: async () => ({ Component: (await import('./pages/EventPage')).WishesPage }),
              },
              {
                path: 'sortear',
                lazy: async () => ({ Component: (await import('./pages/EventPage')).DrawPage }),
              },
              {
                path: 'mi-amigo',
                lazy: async () => ({ Component: (await import('./pages/EventPage')).RevealPage }),
              },
              {
                path: 'invitar',
                lazy: async () => ({ Component: (await import('./pages/EventPage')).InvitePage }),
              },
              {
                path: 'correos',
                lazy: async () => ({
                  Component: (await import('./pages/EventPage')).NotificationsPage,
                }),
              },
            ],
          },
        ],
      },
      { path: '*', Component: NotFound },
    ],
  },
]
export function createRouter() {
  return createBrowserRouter(routes)
}
