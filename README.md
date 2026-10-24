# Whoami — frontend de Amigo Secreto

React 19 + TypeScript + Vite, basado en [design.md](../../design.md) y los [mockups de Stitch](../../design/README.md). Interfaz en español, Geist servida desde la aplicación, Zinc/verde, SVG locales y adaptación a móvil. Datos y operaciones reales a través del backend Spring; Supabase se usa solo para Auth desde el navegador.

## Ejecutar

Requiere Node **22.12 o superior** (comprobado con Node 24) y el backend existente. No requiere un `.env` del frontend: obtiene la URL y la clave **pública** de Auth desde Spring.

Terminal 1, desde `backend/whoami-backend/`:

```sh
# Comprobaciones/desarrollo sin correos ni sorteos automáticos:
JOBS_ENABLED=false MIGRATIONS_ENABLED=false python3 scripts/local.py run
```

Terminal 2, desde `frontend/whoami-frontend/`:

```sh
npm ci
npm run dev
```

Abrir **http://localhost:3000**. Usar siempre este origen para login, confirmación, recuperación e invitaciones: cambiar entre `localhost` y `127.0.0.1` cambia el almacenamiento PKCE del navegador. Vite redirige `/api` a `http://localhost:8080`. `PUBLIC_BASE_URL` del backend y los enlaces QR actuales apuntan a localhost:3000.

Para uso real con correo/sorteo automático, detener el backend iniciado para comprobaciones y ejecutarlo con `python3 scripts/local.py run`, sin el override `JOBS_ENABLED=false`. El `.env` privado del usuario ya tiene jobs activos; revisar los eventos antes de iniciar ese proceso. No se modificó ese archivo ni se copiaron sus secretos al frontend.

## Configuración mínima de las cuentas

El 23/10/2026 se comprobó que Supabase tiene **email y Google habilitados**, confirmación por correo activa, y que el `.env` del backend contiene configuración Resend y R2. Presencia de variables no prueba entrega de correo ni subida de imágenes.

1. En **Supabase → Authentication → URL Configuration**, revisar Site URL `http://localhost:3000` y permitir exactamente estos dos destinos:
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/auth/callback?intent=recovery`
2. En Google, mantener como callback `https://hgmklixxdmgyhlriqsiq.supabase.co/auth/v1/callback`. Si el consentimiento sigue en modo de prueba, añadir las cuentas de prueba que usarás. El Client Secret permanece en Supabase.
3. Confirmación/recuperación envían desde **Supabase Auth**, con su SMTP Resend; los correos de eventos los envía **Spring**. Revisar ambos en una prueba controlada con tu propia cuenta.
4. Para foto, el backend necesita las credenciales R2 del bucket privado. La web recorta a 512×512 y sube por Spring; no necesita CORS PUT en R2. Sin R2, el resto del perfil funciona.

[Pasos de cuentas del backend](../../backend/whoami-backend/docs/SETUP_REAL.md). No colocar claves Resend/R2, contraseña de DB, clave AES ni service_role en variables `VITE_*`.

Si cambia la ubicación de Spring, copiar `.env.example` como `.env.local` y ajustar `BACKEND_PROXY_TARGET` (solo servidor Vite). Para una API en otro origen, `VITE_API_BASE_URL` es el origen sin `/api/v1`, por ejemplo `https://api.tu-dominio.com`; configurar CORS exacto en Spring. Las variables `VITE_*` son públicas y se fijan al construir. No necesitas configurar las variables Supabase opcionales si Spring ya devuelve `/api/v1/auth/config`.

## Flujos implementados

- Landing; registro/login con correo y Google; confirmación y reenvío con espera; recuperación, nueva clave, callback PKCE canjeado una vez; sesión persistente/renovación y logout.
- Mis eventos paginados; crear/editar con fechas en zona del evento, conversión a céntimos, modalidades y aviso de cambios sin guardar; cancelar antes del sorteo.
- Invitación pública, retorno a la invitación tras Auth y unión explícita; enlace, copiar, compartir si el navegador lo soporta y QR real obtenido como Blob con Bearer.
- Organizador participante opcional, lista paginada, salida y expulsión con confirmación. Se resuelve la pertenencia del organizador incluso si no aparece entre los primeros 50 participantes.
- Deseos propios: añadir/eliminar hasta 50 con URL HTTPS/lugar, incluidos cambios después del sorteo; lista ajena solo dentro del resultado autorizado.
- Sorteo manual único con mínimo matemático dos; automático **lo ejecuta el backend**, el cliente consulta cada 30 s mientras está visible. El frontend no ejecuta POST automáticamente ni repite mutaciones por errores de red.
- Revelación personal bajo acción explícita, ocultación local y al ocultar pestaña; eliminación del resultado de memoria al ocultar/salir. No existe vista de todas las parejas.
- Correos: contadores PENDING/SENDING/SENT/FAILED/CANCELLED y reintento de fallos del organizador; SENT se presenta como «Aceptados para envío».
- Perfil básico, correo de solo lectura, celular privado, recorte 512×512 y subida multipart de avatar opcional y manejo de 503.

## Estructura y límites

```text
src/
  app.tsx                 rutas y carga de páginas por demanda
  auth-context.tsx        sesión Auth y limpieza de caché al cambiar de cuenta
  components/             shell y componentes visuales compartidos
  lib/auth.ts             cliente Auth PKCE y retorno interno permitido
  lib/api.ts              adaptador tipado de la API, JWT, errores y cancelación
  lib/event-form.ts       fechas/zonas con Temporal y validación del contrato
  lib/types.ts            DTO alineados con ApiDtos.java/OpenAPI
  pages/                  acceso, eventos, organización, deseos y perfil
  test/                   pruebas aisladas, sin cuentas/servicios externos
```

Todas las operaciones de negocio usan `/api/v1`. No hay consultas directas a tablas ni roles de Supabase en el navegador; Spring autoriza cada petición. `getSession()` recupera la credencial del cliente y no sustituye la verificación JWT del servidor. User metadata solo presenta el nombre inicial.

No hay persistencia de eventos, deseos o asignaciones en localStorage, service worker ni modo demo en producción. Solo el SDK conserva su sesión; se guarda un retorno interno con vencimiento y un indicador de recuperación temporal ligado al usuario. Caché de consultas en memoria, separada por UUID y limpia al salir/cambiar de cuenta. Una respuesta que termina después de un cambio de sesión se descarta. El primer 401 puede renovar la sesión una vez; un 401 final limpia la sesión y ofrece volver a entrar. Los 404 no distinguen recursos ajenos; los 409 refrescan el evento y conservan campos del formulario. Enlaces de referencia HTTPS abren con noreferrer; nunca se inyecta HTML de usuarios.

Sin rifas, pagos, identidad ampliada ni nuevas tablas/endpoints. La API de Resend solo se llama desde Java. No se desplegó en Azure.

## Verificación

```sh
npm test
npm run build
npm run format:check
```

**51 pruebas de frontend aprobadas**: lógica de fechas/zonas/céntimos, destinos internos, Auth simulado, contratos de llamadas HTTP, expiración/renovación, registro sin sesión, recuperación, confirmaciones, permisos, resultado privado, limpiar caché, QR/Blob, recorte y multipart de foto, baja/limpieza de sesión, fallos de foto y correos. Vitest + Testing Library usa respuestas locales y SDK simulado; no envía correos, cambia contraseñas reales ni modifica Supabase.

También se verificaron el proxy real frontend→Spring, readiness UP, rechazo HTTP 401 sin JWT, el contrato OpenAPI y los proveedores públicos de Auth. La revisión del navegador cubre landing y login a 320/390/768/1440px, sin desborde horizontal; no certifica toda la accesibilidad o todas las pantallas privadas. Se corrigió una carrera de navegación que podía perder el retorno a una invitación al entrar. Pendiente una aceptación con tus cuentas reales: registro/confirmación, Google, recuperación, dos usuarios en el intercambio, entrega de correo y subida de foto. No se creó una cuenta ni evento remoto para probar el frontend.

La herramienta local [docs/responsive.html](docs/responsive.html), servida por Vite, permite revisar inicio/acceso a 320, 390, 768 y 1440px. No es una ruta de la aplicación ni se incluye en el build de producción.

## Contenedor opcional

Docker no es requisito para desarrollar. El Dockerfile genera los activos y los sirve con Nginx sin root en 8080, fallback de SPA y proxy `/api`; `API_UPSTREAM` se resuelve al iniciar. No contiene secretos ni se despliega automáticamente.

```sh
docker build -t whoami-frontend .
docker run --rm -p 3000:8080 \
  -e API_UPSTREAM=http://host.docker.internal:8080 whoami-frontend
```

`host.docker.internal` es para Docker Desktop. En Azure usar la URL interna/HTTPS real de Spring, mantener el mismo origen público y actualizar Site URL/redirects/QR/CORS a HTTPS. Terminar TLS en el ingreso de Azure. La imagen y la configuración Nginx quedan preparadas; no se construyeron en este equipo, que no tiene Docker disponible. En el despliegue fijar versiones/digests de imágenes y verificar salud, rutas profundas y conectividad.

Referencias: [PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [Google Auth](https://supabase.com/docs/guides/auth/social-login/auth-google), [recuperación](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail), [variables Vite](https://vite.dev/guide/env-and-mode).

## Baja de cuenta y bienvenida

En Perfil → Eliminar mi cuenta se explica el efecto y se exige escribir ELIMINAR. Se retira de eventos abiertos, cancela abiertos que organiza y conserva sorteos históricos con referencia anónima. La API bloquea acceso inmediatamente; Auth/fotos se eliminan mediante trabajo persistente. La sesión y los datos privados del navegador se limpian. Requiere `SUPABASE_SECRET_KEY` únicamente en backend y jobs activos; sin clave devuelve 503 sin eliminar nada.

La bienvenida se encola una vez al primer acceso autenticado; Resend usa la cola/reintentos del backend. Con confirmación activa, se envía después de confirmar y entrar. No es el correo de confirmación de Auth.

Los datos de negocio están en PostgreSQL Supabase, esquema privado `whoami`; usuarios/sesiones en Supabase Auth y fotos en Cloudflare R2. La sesión del SDK permanece en el navegador, sin persistir eventos ni resultados. [Modelo](../../backend/whoami-backend/docs/DATA_MODEL.md).

## Invitaciones por correo, zona horaria y footer

En un evento abierto del organizador, pestaña Invitar → Mandar correo de invitación. El diálogo solicita una dirección, valida y programa envío con Resend. El destinatario puede registrarse después; no se inscribe automáticamente. Hasta 20/hora y 5 min entre envíos a la misma dirección/evento. Error conserva formulario y permite reintento con el mismo requestId; éxito indica programado, sin prometer entrega. Los contadores están en Correos.

Nuevos correos de negocio HTML con la identidad visual de Whoami y texto alternativo. Los dos de Auth requieren [pegar plantillas en Supabase](../../backend/whoami-backend/supabase/templates/README.md). Zona horaria con menú anclado al campo, accesible por teclado y valores IANA; sin popup nativo. Footer con propiedad de Thiago Vergara, derechos reservados y enlace a su web.

PUBLIC_BASE_URL del backend debe ser accesible para invitados. localhost solo funciona en el mismo equipo; para LAN/IP ajustar también Vite host, CORS y redirects Auth. No poner secretos en el front.
