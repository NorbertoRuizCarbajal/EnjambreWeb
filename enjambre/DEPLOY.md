# Enjambre · Despliegue paso a paso

Arquitectura: sitio estático en Netlify (`public/`) + 2 Netlify Functions (`/api/contact`, `/api/conagua`) + Supabase (Postgres, Auth, RLS).
El visitante **nunca** habla con Supabase: el formulario va a `/api/contact`, que guarda con la Secret key (solo servidor).



## 0b. Esta versión: ORDEN OBLIGATORIO al actualizar
1. **Primero Supabase:** SQL Editor → ejecuta `supabase/migrations/2026-10-23_pais_y_pin_global.sql` (agrega país a los contactos y permite pines fuera de México; no borra datos; se puede repetir). Si publicas el código antes, un pin fuera de México sería rechazado.
2. **Después GitHub/Netlify:** commit + push (ver pasos de actualización) y revisa Deploys.
3. Abre `/api/health` y revisa lo que sigue.

## 0c. Si el formulario dice "El envío aún no está configurado en el servidor"
Ese mensaje significa que `/api/contact` **sí existe** pero respondió `error: config`: a la función le faltan `SUPABASE_URL` o `SUPABASE_SECRET_KEY` **en tiempo de ejecución**. Pasos exactos:
1. `https://TU-SITIO/api/health` → mira `variables_definidas`. Si `SUPABASE_URL` o `SUPABASE_SECRET_KEY` salen `false`, continúa.
2. Netlify → **Site configuration → Environment variables → Add a variable**. Los nombres deben ser exactamente `SUPABASE_URL` y `SUPABASE_SECRET_KEY` (también `RATE_LIMIT_SALT`).
3. En **Scopes** deja **All scopes**, o como mínimo marca **Functions** (y **Builds** para `SUPABASE_URL`). Una variable sin el alcance *Functions* no llega a la función aunque aparezca en la lista.
4. Para la clave secreta activa **Contains secret values**. No pegues la clave en ningún archivo.
5. **Deploys → Trigger deploy → Clear cache and deploy site.** Las variables nuevas solo se leen en un deploy posterior.
6. Vuelve a abrir `/api/health`: `variables_definidas` en `true` y `supabase.ok: true`. Si `funcion_alta` es `false`, ejecuta la migración del paso 0b.1 (o `schema.sql` si tu base es nueva). Si dice `clave rechazada`, copia de nuevo la Secret key desde Supabase → Project Settings → API Keys.
7. Prueba un envío real. Debe aparecer una fila nueva en Supabase → Table Editor → `contacts` con su país.

## 0d. Si la capa de CONAGUA no carga (`/api/health` → `conagua.ok: false`)
El mensaje del mapa ahora indica el motivo; `/api/health` da el detalle. Según el motivo:
- **"certificado… no pudo verificarse" (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`)**: el servidor de CONAGUA no envía su certificado intermedio (los navegadores lo completan solos; Node no). No se desactiva la seguridad TLS. Solución:
  1. En tu computadora: `openssl s_client -connect sigagis.conagua.gob.mx:443 -servername sigagis.conagua.gob.mx -showcerts </dev/null 2>/dev/null | openssl x509 -noout -text | grep "CA Issuers"` → muestra la URL del certificado del emisor.
  2. Descárgalo (`curl -O URL`). Si el archivo no es texto, conviértelo: `openssl x509 -inform DER -in archivo.crt -out intermedio.pem`. Verifica que el emisor sea una autoridad reconocida (`openssl x509 -in intermedio.pem -noout -subject -issuer`).
  3. Netlify → Environment variables → agrega `CONAGUA_CA_PEM` con **todo el texto** del PEM (con las líneas BEGIN/END), alcance **Functions**. Este certificado es público, no secreto.
  4. Trigger deploy → `/api/health` debe mostrar `conagua.ok: true` y la lista de `campos`. (Mecanismo probado localmente con una autoridad de prueba: falla sin la variable y funciona con ella.)
- **"no se encontró el servidor"**: la dirección cambió. Abre en el navegador `https://sigagis.conagua.gob.mx/ArcGIS/rest/services/Contexto_hidrol%C3%B3gico/MapServer/3`; si ya no existe, localiza la capa vigente en el portal geográfico de CONAGUA y pon su URL en la variable `CONAGUA_LAYER_URL` (o en `LAYER`, `netlify/functions/conagua.mjs`, línea 3). Debe ser un `MapServer/<n>` o `FeatureServer/<n>` de ArcGIS REST.
- **"no respondió a tiempo" / código 403–5xx**: el servicio está caído o bloquea IPs de nube. Vuelve a intentar más tarde; si es permanente, la alternativa es alojar una copia de los datos descargables oficiales (CONAGUA/INEGI) como archivo propio; avísame y la integro.
- **Cómo comprobar que cargó:** en el mapa, a zoom 8 o más, deben dibujarse polígonos azules y aparecer la leyenda "Referencia oficial". En el navegador (F12 → Network) la petición `conagua?bbox=…` debe responder 200 con `features`.

## 0. Diagnóstico rápido (si algo no funciona)
Abre `https://TU-SITIO/api/health`:
- **Página 404/HTML en vez de JSON** → el sitio se publicó **sin funciones** (p. ej. arrastrando la carpeta a Netlify Drop). El formulario y la capa de CONAGUA dependen de `/api/contact` y `/api/conagua`, por eso fallan juntos. Solución: despliega con Git o con la CLI (abajo).
- `variables_definidas` con `false` → falta esa variable en Netlify (y un nuevo deploy).
- `supabase.ok = false` → `clave rechazada` (revisa `SUPABASE_SECRET_KEY`/URL) o `funcion_alta:false` (ejecuta `supabase/schema.sql`).
- `conagua.ok = false` → el servidor de CONAGUA no responde desde Netlify (`error`/`cause` lo indica, p. ej. `UNABLE_TO_VERIFY_LEAF_SIGNATURE` = certificado incompleto del servidor). No se desactiva la verificación TLS; hay que pedir a CONAGUA que lo corrija o usar una copia de los datos (INEGI/CONAGUA descargables). Si `ok:true`, verás `campos` de la capa: avísame cuáles para ajustar el nombre que se muestra en el popup.
Puedes borrar `netlify/functions/health.mjs` cuando todo funcione.

**Desplegar con la CLI (sin Git):** `npm i -g netlify-cli` → `netlify login` → dentro de esta carpeta `netlify link` (elige tu sitio) → define las variables (`netlify env:set NOMBRE valor`) → `netlify deploy --build --prod`. Cada publicación nueva: repetir el último comando.

## 1. Supabase
1. **SQL Editor** → pega y ejecuta `supabase/schema.sql` completo (se puede ejecutar de nuevo sin romper nada).
2. **Authentication → Sign In / Providers → Email**: desactiva **"Allow new users to sign up"** (los usuarios solo se crean desde el panel de Supabase). Aunque alguien se registrara, no vería datos: el acceso lo da la tabla `staff_members`.
3. **Project Settings → API Keys**: copia la **Publishable key** y la **Secret key**. La Secret solo va a Netlify (paso 3); no la pegues en el chat ni en el repositorio.

## 2. Primer usuario administrador
1. **Authentication → Users → Add user → Create new user**: correo + contraseña, marca *Auto Confirm User*.
2. **SQL Editor** (cambia el correo y el nombre):
```sql
insert into public.staff_members (user_id, role, display_name)
select id, 'admin', 'Nombre de la persona' from auth.users where email = 'CORREO@DOMINIO';
```
3. Para más personas: repite 1–2 con `role = 'seguimiento'` (puede ver y trabajar contactos) o `'admin'` (además gestiona el equipo). Hasta que alguien se agregue así, no hay responsables asignables.

## 3. Netlify
Crea el sitio desde un repositorio Git con esta carpeta (o con `netlify deploy --build --prod`; arrastrar la carpeta a Netlify Drop **no** ejecuta funciones). `netlify.toml` ya define build, `public/` y funciones.

**Site configuration → Environment variables**

| Variable | ¿Privada? | Para qué |
|---|---|---|
| `SUPABASE_URL` | No (pública) | URL del proyecto, la usa el panel y la función |
| `SUPABASE_PUBLISHABLE_KEY` | No (pública) | Clave publicable; el panel `/admin` la usa (protegido por RLS) |
| `SUPABASE_SECRET_KEY` | **Sí** (marcar *Contains secret values*) | Solo la función `/api/contact` |
| `RATE_LIMIT_SALT` | **Sí** | Cadena aleatoria larga para hashear IPs |
| `RESEND_API_KEY` | **Sí** (opcional) | Notificación por correo |
| `NOTIFY_EMAIL_FROM` | No (opcional) | Remitente verificado en Resend, ej. `Enjambre <avisos@tu-dominio>` |
| `NOTIFY_EMAIL_TO` | No (opcional) | Por defecto `proyectoenjambre.contacto@gmail.com` |
| `ALLOWED_ORIGIN` | No (opcional) | Ej. `https://tu-sitio.netlify.app`; rechaza envíos de otros orígenes |

Sin `RESEND_API_KEY` el sistema funciona igual: guarda en la base de datos y no envía correo. **Decisión pendiente:** proveedor de correo (el código usa Resend; cambiar es editar ~10 líneas en `submit-contact.mjs`). Gmail no sirve como remitente SMTP directo desde funciones sin credenciales de aplicación.

## 4. Probar
**Formulario**: envía uno sin ubicación → mensaje de éxito + avispa. En Supabase → Table Editor deben aparecer filas en `contacts` (estado `nuevo`, sin responsable) y `contact_interactions` (tipo `formulario`). Si configuraste Resend, llega el aviso a `proyectoenjambre.contacto@gmail.com`.
**Con pin**: abre "Marcar ubicación aproximada", toca el mapa → aparece la casilla de consentimiento (obligatoria). Verifica una fila en `waterbody_locations` con `precision = aproximada`, coordenadas a 2 decimales y `consent_to_use_location = true`.
**Fallos**: desactiva temporalmente `SUPABASE_SECRET_KEY` → el formulario muestra error y **no** hay avispa. Cinco envíos seguidos desde la misma IP → el sexto responde "varios envíos".
**Mapa público** (sección "Cuerpos de agua de referencia en México"): acércate a zoom ≥ 8 → debe aparecer la capa azul. Verifica la capa oficial desde tu equipo:
`curl "https://TU-SITIO/api/conagua?bbox=-99.3,19.2,-99.0,19.5&z=11"` → JSON con `features`. Si responde 502, revisa que la URL de CONAGUA siga vigente (está en `netlify/functions/conagua.mjs`); si sus campos no incluyen un nombre reconocible, el popup dirá "Cuerpo de agua (sin nombre en la fuente)".
**Panel**: entra a `https://TU-SITIO/admin/` con el usuario del paso 2 → Resumen, Contactos (cambiar estado, asignar, nota, seguimiento), Mapa. Una cuenta sin fila en `staff_members` es expulsada con aviso. Desde una ventana de incógnito sin sesión, `…/rest/v1/contacts` con la clave publicable debe devolver `[]` o error de permisos.

## 5. Antes de publicar (marcado `REVISAR`)
Aviso de privacidad (datos de contacto, ubicación aproximada opcional, uso de OpenStreetMap/Nominatim para buscar lugares, plazo de conservación); licencia web de la tipografía; paleta definitiva; validación técnica final del contenido; quién administra cuentas y cada cuánto se revisan contactos sin asignar; proveedor de correo; política de uso de teselas de OpenStreetMap (adecuada para poco tráfico; con tráfico alto cambiar a un proveedor con plan propio en `public/js/mapa.js`).
