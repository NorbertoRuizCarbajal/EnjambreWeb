# Enjambre · Despliegue paso a paso

Arquitectura: sitio estático en Netlify (`public/`) + 2 Netlify Functions (`/api/contact`, `/api/conagua`) + Supabase (Postgres, Auth, RLS).
El visitante **nunca** habla con Supabase: el formulario va a `/api/contact`, que guarda con la Secret key (solo servidor).

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
