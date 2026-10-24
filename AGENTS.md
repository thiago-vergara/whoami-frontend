# Frontend Whoami

Leer `../design.md`, `README.md`, `../WHOAMI_CONTEXT.md` y el contrato de Spring. React/TypeScript/Vite, React Router, TanStack Query, Supabase JS solo Auth. Los HTML de `../design/` son referencias; la app funcional está en `src/`.

Ejecutar `npm test`, `npm run build` y `npm run format:check`. Pruebas con SDK/HTTP simulado, sin correos ni cuentas/eventos remotos. No usar las credenciales reales para pruebas de escritura. Para arrancar Spring en verificaciones forzar `JOBS_ENABLED=false MIGRATIONS_ENABLED=false`; el `.env` del usuario puede tener jobs activos y contiene Resend/R2. Nunca copiar secretos a VITE_*.

Mantener DTO exactos, privacidad de dueño/dador, caché por UUID y limpieza de sesión; no usar metadata de usuario como autorización. Organizador se inscribe aparte. Consultar más páginas si falta el organizador entre las primeras 50 personas. El resultado no se solicita/renderiza antes de revelar ni se persiste; sortear/reintentar correo son operaciones distintas. Evitar reintentar automáticamente POST/DELETE/PUT por fallos de red.

Fuentes locales Geist, CSS compartido, SVG propios, responsive en una columna bajo 768px, teclado/diálogos nativos/reduced motion. Sin rifas ni pagos. Cambios visuales deben conservar contratos y estados reales. No marcar producción cerrada sin comprobar sesiones, correo, fotos y contenedor reales.
