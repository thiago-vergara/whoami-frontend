# Frontend Whoami

Leer `../../design.md`, `README.md`, `../../WHOAMI_CONTEXT.md` y el contrato de Spring. React/TypeScript/Vite, React Router, TanStack Query, Supabase JS solo Auth. Los HTML de `../../design/` son referencias; la app funcional está en `src/`.

Ejecutar `npm test`, `npm run build` y `npm run format:check`. Pruebas con SDK/HTTP simulado, sin correos ni cuentas/eventos remotos. No usar las credenciales reales para pruebas de escritura. Para arrancar Spring en verificaciones forzar `JOBS_ENABLED=false MIGRATIONS_ENABLED=false`; el `.env` del usuario puede tener jobs activos y contiene Resend/R2. Nunca copiar secretos a VITE_*.

Mantener DTO exactos, privacidad de dueño/dador, caché por UUID y limpieza de sesión; no usar metadata de usuario como autorización. Organizador se inscribe aparte. Consultar más páginas si falta el organizador entre las primeras 50 personas. El resultado no se solicita/renderiza antes de revelar ni se persiste; sortear/reintentar correo son operaciones distintas. Evitar reintentar automáticamente POST/DELETE/PUT por fallos de red.

Fuentes locales Geist, CSS compartido, SVG propios, responsive en una columna bajo 768px, teclado/diálogos nativos/reduced motion. Sin rifas ni pagos. Cambios visuales deben conservar contratos y estados reales. No marcar producción cerrada sin comprobar sesiones, correo, fotos y alojamiento reales.

Azure: frontend Static Web Apps Free en https://whoami.thiagovergaravega.com; backend App Service Linux Java 21 sin Docker creado por el usuario, https://whoami-backend-cuh6cygxcmewb6cu.westus2-01.azurewebsites.net. VITE_API_BASE_URL es ese origen sin /api/v1. CORS y PUBLIC_BASE_URL usan dominio personalizado. Usuario confirmó redirects Supabase y nueva secret key en .env privado del backend; no copiarla al front. No crear/cambiar planes ni recrear Container Apps/ACR. public/staticwebapp.config.json debe llegar a dist. Scripts usan token SWA privado sin stdout/argv. Guía ../../backend/whoami-backend/docs/AZURE.md. Raíz npm frontend/whoami-frontend. Pruebas sin cuentas/correos reales.

Avatar vigente: URL prefirmada con recorte512, ticket y confirmación en Spring/JWT, PUT a R2 sin JWT/cookies y con Content-Type firmado. Política CORS exacta en backend/infra/cloudflare/r2-cors.json. Avatar60s/fase, restoAPI20s; no autoreintentar mutaciones ni confirmar tras falloPUT/cambio de cuenta. Bucket privado.

## Participantes, reingreso y cancelación tras sorteo

La lista protegida de participantes incluye `avatarUrl` temporal de R2, sin clave del objeto ni contactos. Si no hay foto/configuración R2, se muestran iniciales. `GET /api/v1/invitations/{token}/access` requiere JWT y devuelve únicamente acceso/membresía del usuario actual (`NONE/ACTIVE/LEFT/REMOVED`, `canView/canJoin`); el resumen público no cambia. OpenAPI tiene 30 operaciones.

La invitación comprueba acceso antes de habilitar unirse: miembros y organizadores abren su evento con mensaje explícito. Tras una unión correcta se actualiza caché por usuario, se limpia el retorno pendiente y se navega al evento. Ante respuesta perdida se consulta pertenencia antes de otro intento; no hay POST automático. Lectura de sesión limitada a 15 s y unión a 60 s. El detalle solo busca al organizador en páginas adicionales si no figura en las primeras 50, evitando esperar una consulta desactivada.

El usuario autorizó cancelar también después del sorteo: OPEN/DRAWN → CANCELLED, estado final e idempotente. Se conservan drawn_at, población y parejas; el resultado propio sigue disponible como historial. No se permite reabrir, sortear de nuevo, unirse ni modificar la población congelada. Pendientes/fallidos se cancelan; un correo en tránsito puede llegar. La migración `drawn_event_cancellation` actualiza constraint/trigger sin borrar datos ni modificar permisos.

Verificación local: 53 pruebas backend con PostgreSQL temporal/permisos y 61 frontend; incluye pertenencia, registro-confirmación-unión, respuesta perdida, fotos, cancelación histórica y guardas SQL. Sin correos/cuentas/eventos reales de prueba.
