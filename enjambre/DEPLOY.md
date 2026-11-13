# Enjambre · Despliegue paso a paso

Arquitectura: sitio estático en Netlify (`public/`) + 2 Netlify Functions (`/api/contact`, `/api/conagua`) + Supabase (Postgres, Auth, RLS).
El visitante **nunca** habla con Supabase: el formulario va a `/api/contact`, que guarda con la Secret key (solo servidor).



## 0b. Esta versión: ORDEN al actualizar
1. **Primero Supabase:** SQL Editor → ejecuta, en orden, las migraciones que aún no hayas aplicado (todas se pueden repetir y no borran datos):
   - `supabase/migrations/2026-10-23_pais_y_pin_global.sql`: país en los contactos y pines fuera de México.
   - `supabase/migrations/2026-11-11_privacidad_anonimizacion.sql`: columna `anonymized_at` y funciones `anonymize_contact` / `purge_inactive_contacts` (botón «Eliminar datos personales» del panel, solo admin).
   - `supabase/migrations/2026-11-13_roles_y_equipo.sql`: permisos por rol (seguimiento solo edita sus contactos o los que no tienen responsable) y pestaña «Equipo» del panel. Sin esta migración, la pestaña Equipo muestra un error.
   **Antes de desplegar, revisa en Netlify que `RATE_LIMIT_SALT` exista y tenga al menos 16 caracteres:** desde esta versión, sin ella el formulario no guarda envíos (responde «El envío aún no está configurado»).
2. **Después GitHub/Netlify:** commit + push y revisa Deploys. El repositorio git está en la carpeta superior (`EnjambreWeb/`), así que en Netlify → Site configuration → Build & deploy → **Base directory** debe ser `enjambre`.
3. Si necesitas diagnosticar, define `HEALTH_TOKEN` y abre `/api/health?token=…` (ver §0e).

## 0e. `/api/health` está protegido
Responde **404** salvo que exista la variable `HEALTH_TOKEN` (mínimo 16 caracteres, marcada como secreta, alcance Functions) y la petición la incluya:
`curl -H "Authorization: Bearer TU_TOKEN" https://TU-SITIO/api/health` o, en el navegador, `https://TU-SITIO/api/health?token=TU_TOKEN`.
Al terminar el diagnóstico, **borra `HEALTH_TOKEN`** en Netlify y vuelve a desplegar: el endpoint queda deshabilitado. (El token en la URL puede quedar en el historial del navegador; úsalo solo de forma temporal.)

## 0c. Si el formulario dice "El envío aún no está configurado en el servidor"
Ese mensaje significa que `/api/contact` **sí existe** pero respondió `error: config`: a la función le faltan `SUPABASE_URL` o `SUPABASE_SECRET_KEY` **en tiempo de ejecución**. Pasos exactos:
1. `https://TU-SITIO/api/health?token=TU_TOKEN` (§0e) → mira `variables_definidas`. Si `SUPABASE_URL` o `SUPABASE_SECRET_KEY` salen `false`, continúa.
2. Netlify → **Site configuration → Environment variables → Add a variable**. Los nombres deben ser exactamente `SUPABASE_URL` y `SUPABASE_SECRET_KEY` (también `RATE_LIMIT_SALT`, **obligatoria**, mínimo 16 caracteres).
3. En **Scopes** deja **All scopes**, o como mínimo marca **Functions** (la URL y la clave publicable ya no se usan durante el build). Una variable sin el alcance *Functions* no llega a la función aunque aparezca en la lista.
4. Para la clave secreta activa **Contains secret values**. No pegues la clave en ningún archivo.
5. **Deploys → Trigger deploy → Clear cache and deploy site.** Las variables nuevas solo se leen en un deploy posterior.
6. Vuelve a abrir `/api/health?token=…`: `variables_definidas` en `true` y `supabase.ok: true`. Si `funcion_alta` es `false`, ejecuta la migración del paso 0b.1 (o `schema.sql` si tu base es nueva). Si dice `clave rechazada`, copia de nuevo la Secret key desde Supabase → Project Settings → API Keys.
7. Prueba un envío real. Debe aparecer una fila nueva en Supabase → Table Editor → `contacts` con su país.

## 0d. Si la capa de cuerpos de agua no carga (`/api/health` → `capa_agua.ok: false`)
**Fuente actual:** SEMARNAT, servicio ArcGIS REST `https://geomaticasig1.semarnat.gob.mx/arcgis/rest/services/esdig/Agua/MapServer`, subcapas **6 y 7** (lagos y lagunas). El mapa muestra como atribución el nombre que devuelve el servidor (`fuente`), deducido del dominio consultado; la ruta `/api/conagua` y las variables `CONAGUA_*` conservan ese nombre solo por compatibilidad.
- **"certificado… no pudo verificarse" (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`)**: el servidor no envía su certificado intermedio (los navegadores lo completan solos; Node no). No se desactiva la seguridad TLS. Solución:
  1. En tu computadora: `openssl s_client -connect geomaticasig1.semarnat.gob.mx:443 -servername geomaticasig1.semarnat.gob.mx -showcerts </dev/null 2>/dev/null | openssl x509 -noout -text | grep "CA Issuers"` → muestra la URL del certificado del emisor.
  2. Descárgalo (`curl -O URL`). Si el archivo no es texto, conviértelo: `openssl x509 -inform DER -in archivo.crt -out intermedio.pem`. Verifica que el emisor sea una autoridad reconocida (`openssl x509 -in intermedio.pem -noout -subject -issuer`).
  3. Netlify → Environment variables → agrega `CONAGUA_CA_PEM` con **todo el texto** del PEM (con las líneas BEGIN/END), alcance **Functions**. Este certificado es público, no secreto.
  4. Trigger deploy → `/api/health?token=…` debe mostrar `capa_agua.ok: true` y los nombres de las `subcapas`.
- **"no se encontró el servidor"** o una subcapa aparece como `(no existe en el servicio)`: la dirección cambió. Si el servicio ya no existe, localiza la capa vigente (SEMARNAT, CONAGUA o INEGI) y define `CONAGUA_LAYER_URL` (URL del **MapServer**, sin número final) y `CONAGUA_LAYER_IDS` (subcapas separadas por coma, p. ej. `3`). Si el dominio no es de SEMARNAT ni de CONAGUA, define también `WATER_SOURCE_NAME` con la atribución correcta y actualiza `docs/IMPACTO.md`.
- **"no respondió a tiempo" / código 403–5xx**: el servicio está caído o bloquea IPs de nube. Vuelve a intentar más tarde; si es permanente, la alternativa es alojar una copia de los datos descargables oficiales como archivo propio.
- **Cómo comprobar que cargó:** en el mapa, a zoom 8 o más, deben dibujarse polígonos azules y aparecer la leyenda "Referencia oficial… publicados por SEMARNAT". En el navegador (F12 → Network) la petición `conagua?bbox=…` debe responder 200 con `features` y `fuente`.

## 0a. Error de Netlify "Secrets scanning found secrets in build output or repo code"
Causa (resuelta en esta versión): el build escribía el valor de `SUPABASE_URL` en `public/admin/config.js`; como esa variable está marcada como secreta en Netlify, el escáner lo detectó. Ahora **ningún valor de variable se escribe en archivos del sitio**: el panel pide su configuración pública a la función `/api/public-config.js` en tiempo de ejecución, y `scripts/build-config.mjs` solo comprueba (sin imprimir valores) que ningún valor privado aparezca en `public/`. **No hay que cambiar nada en Netlify ni desactivar el escaneo.** Si el panel dice "Falta configurar SUPABASE_URL…", abre `https://TU-SITIO/api/public-config.js`: debe mostrar `window.ENJAMBRE_CFG={"supabaseUrl":…}`; si sale `{}`, revisa que ambas variables existan con alcance **Functions** (y que `SUPABASE_PUBLISHABLE_KEY` sea la clave *publicable*, no la secreta).

## 0. Diagnóstico rápido (si algo no funciona)
Define `HEALTH_TOKEN` y abre `https://TU-SITIO/api/health?token=TU_TOKEN` (§0e):
- **Página 404/HTML en vez de JSON** → el sitio se publicó **sin funciones** (p. ej. arrastrando la carpeta a Netlify Drop). El formulario y la capa de CONAGUA dependen de `/api/contact` y `/api/conagua`, por eso fallan juntos. Solución: despliega con Git o con la CLI (abajo).
- `variables_definidas` con `false` → falta esa variable en Netlify (y un nuevo deploy).
- `supabase.ok = false` → `clave rechazada` (revisa `SUPABASE_SECRET_KEY`/URL) o `funcion_alta:false` (ejecuta `supabase/schema.sql`).
- `capa_agua.ok = false` → el servicio geográfico no responde desde Netlify; ver §0d.
Cuando todo funcione, borra `HEALTH_TOKEN` en Netlify para deshabilitar el endpoint.

**Desplegar con la CLI (sin Git):** `npm i -g netlify-cli` → `netlify login` → dentro de esta carpeta `netlify link` (elige tu sitio) → define las variables (`netlify env:set NOMBRE valor`) → `netlify deploy --build --prod`. Cada publicación nueva: repetir el último comando.

## 1. Supabase
1. **SQL Editor** → pega y ejecuta `supabase/schema.sql` completo (se puede ejecutar de nuevo sin romper nada).
2. **Authentication → Sign In / Providers → Email**: desactiva **"Allow new users to sign up"** (los usuarios solo se crean desde el panel de Supabase). Aunque alguien se registrara, no vería datos: el acceso lo da la tabla `staff_members`.
3. **Project Settings → API Keys**: copia la **Publishable key** y la **Secret key**. La Secret solo va a Netlify (paso 3); no la pegues en el chat ni en el repositorio.

## 2. Netlify
Crea el sitio desde un repositorio Git con esta carpeta (o con `netlify deploy --build --prod`; arrastrar la carpeta a Netlify Drop **no** ejecuta funciones). `netlify.toml` ya define build, `public/` y funciones.

**Site configuration → Environment variables**

| Variable | ¿Privada? | Para qué |
|---|---|---|
| `SUPABASE_URL` | Da igual (puede estar marcada como secreta) | URL del proyecto. Las funciones la leen en ejecución; el panel la recibe de `/api/public-config.js`. **Alcance: Functions** |
| `SUPABASE_PUBLISHABLE_KEY` | Da igual (es pública por diseño) | Solo la entrega `/api/public-config.js` al panel (protegido por RLS). **Alcance: Functions.** Nunca pegues aquí la Secret key: la función la rechaza |
| `SUPABASE_SECRET_KEY` | **Sí** (marcar *Contains secret values*) | Solo la función `/api/contact` |
| `RATE_LIMIT_SALT` | **Sí** | **Obligatoria**, mínimo 16 caracteres aleatorios (p. ej. `openssl rand -hex 32`). Sin ella `/api/contact` no guarda nada |
| `RESEND_API_KEY` | **Sí** (opcional) | Notificación por correo |
| `NOTIFY_EMAIL_FROM` | No (opcional) | Remitente verificado en Resend, ej. `Enjambre <avisos@tu-dominio>` |
| `NOTIFY_EMAIL_TO` | No (opcional) | Por defecto `proyectoenjambre.contacto@gmail.com` |
| `HEALTH_TOKEN` | **Sí** (opcional) | Habilita `/api/health` mientras diagnosticas (§0e). Sin ella el endpoint responde 404 |
| `ALLOWED_ORIGIN` | No (opcional) | El formulario ya acepta solo envíos desde el propio dominio del sitio. Úsala solo para admitir **otros** orígenes, separados por comas |

Sin `RESEND_API_KEY` el sistema funciona igual: guarda en la base de datos y no envía correo. **Decisión pendiente:** proveedor de correo (el código usa Resend; cambiar es editar ~10 líneas en `submit-contact.mjs`). Gmail no sirve como remitente SMTP directo desde funciones sin credenciales de aplicación.

## 3. Probar
**Formulario**: envía uno sin ubicación → mensaje de éxito + avispa. En Supabase → Table Editor deben aparecer filas en `contacts` (estado `nuevo`, sin responsable) y `contact_interactions` (tipo `formulario`). Si configuraste Resend, llega el aviso a `proyectoenjambre.contacto@gmail.com`.
**Con pin**: abre "Marcar ubicación aproximada", toca el mapa → aparece la casilla de consentimiento (obligatoria). Verifica una fila en `waterbody_locations` con `precision = aproximada`, coordenadas a 2 decimales y `consent_to_use_location = true`.
**Fallos**: desactiva temporalmente `SUPABASE_SECRET_KEY` → el formulario muestra error y **no** hay avispa. Cinco envíos seguidos desde la misma IP → el sexto responde "varios envíos".
**Mapa público** (sección "Cuerpos de agua de referencia en México"): acércate a zoom ≥ 8 → debe aparecer la capa azul. Verifica la capa oficial desde tu equipo:
`curl "https://TU-SITIO/api/conagua?bbox=-99.3,19.2,-99.0,19.5&z=11"` → JSON con `features`. Si responde 502, revisa §0d; si sus campos no incluyen un nombre reconocible, el popup dirá "Cuerpo de agua (sin nombre en la fuente)".
**Panel**: entra a `https://TU-SITIO/admin/` con el usuario del paso 2 → Resumen, Contactos (cambiar estado, asignar, nota, seguimiento), Mapa y, si eres admin, Equipo (dar o retirar acceso: la cuenta se crea antes en Supabase → Authentication → Users con «Auto Confirm User»). Una cuenta sin fila en `staff_members` es expulsada con aviso. Desde una ventana de incógnito sin sesión, `…/rest/v1/contacts` con la clave publicable debe devolver `[]` o error de permisos.

## 4. Antes de publicar (marcado `REVISAR`)
**Privacidad:** el aviso está en `public/privacidad/index.html` (enlazado desde el formulario y el pie de página) como plantilla: completa los campos `[POR DEFINIR]` (responsable, domicilio, plazos) y valídalo con asesoría jurídica. Para cumplir el plazo de conservación, ejecuta en el SQL Editor `select public.purge_inactive_contacts(interval '24 months');` (con el plazo que se publique) o prográmalo con pg_cron (instrucciones en la migración 2026-11-11). Las solicitudes de cancelación se atienden con el botón «Eliminar datos personales» del panel (solo rol admin).
Otros: licencia web de la tipografía; paleta definitiva; validación técnica final del contenido; quién administra cuentas y cada cuánto se revisan contactos sin asignar; proveedor de correo; política de uso de teselas de OpenStreetMap (adecuada para poco tráfico; con tráfico alto cambiar a un proveedor con plan propio en `public/js/mapa.js`).
