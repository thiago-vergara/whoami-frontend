# Frontend Whoami

Leer `../../design.md`, `README.md`, `../../WHOAMI_CONTEXT.md` y el contrato de Spring. React/TypeScript/Vite, React Router, TanStack Query, Supabase JS solo Auth. Los HTML de `../../design/` son referencias; la app funcional está en `src/`.

Ejecutar `npm test`, `npm run build` y `npm run format:check`. Pruebas con SDK/HTTP simulado, sin correos ni cuentas/eventos remotos. No usar las credenciales reales para pruebas de escritura. Para arrancar Spring en verificaciones forzar `JOBS_ENABLED=false MIGRATIONS_ENABLED=false`; el `.env` del usuario puede tener jobs activos y contiene Resend/R2. Nunca copiar secretos a VITE_*.

Mantener DTO exactos, privacidad de dueño/dador, caché por UUID y limpieza de sesión; no usar metadata de usuario como autorización. Organizador se inscribe aparte. Consultar más páginas si falta el organizador entre las primeras 50 personas. El resultado no se solicita/renderiza antes de revelar ni se persiste; sortear/reintentar correo son operaciones distintas. Evitar reintentar automáticamente POST/DELETE/PUT por fallos de red.

Fuentes locales Geist, CSS compartido, SVG propios, responsive en una columna bajo 768px, teclado/diálogos nativos/reduced motion. Sin rifas ni pagos. Cambios visuales deben conservar contratos y estados reales. No marcar producción cerrada sin comprobar sesiones, correo, fotos y alojamiento reales.

Azure: frontend Static Web Apps Free en https://whoami.thiagovergaravega.com; backend App Service Linux Java 21 sin Docker creado por el usuario, https://whoami-backend-cuh6cygxcmewb6cu.westus2-01.azurewebsites.net. VITE_API_BASE_URL es ese origen sin /api/v1. CORS y PUBLIC_BASE_URL usan dominio personalizado. Usuario confirmó redirects Supabase y nueva secret key en .env privado del backend; no copiarla al front. No crear/cambiar planes ni recrear Container Apps/ACR. public/staticwebapp.config.json debe llegar a dist. Scripts usan token SWA privado sin stdout/argv. Guía ../../backend/whoami-backend/docs/AZURE.md. Raíz npm frontend/whoami-frontend. Pruebas sin cuentas/correos reales.
