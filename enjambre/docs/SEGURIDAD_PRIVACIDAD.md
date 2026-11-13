# Seguridad y privacidad

## Datos tratados

El formulario puede recibir nombre, organización, correo, teléfono, tipo de interés, país, mensaje y, de forma opcional, una ubicación aproximada. El CRM conserva datos de contacto y registros de seguimiento para uso del equipo autorizado.

## Controles presentes en el código

- Validación del método HTTP, tamaño de solicitud y campos en la función de servidor.
- Normalización de texto y validación de país, correo y coordenadas.
- Campo honeypot para filtrar parte del tráfico automatizado.
- Control de frecuencia mediante HMAC de la IP con `RATE_LIMIT_SALT` (obligatoria, ≥ 16 caracteres) en el procedimiento de base de datos.
- `/api/contact` solo acepta peticiones con encabezado `Origin` del propio sitio (o de `ALLOWED_ORIGIN`).
- Guardado de contactos mediante una función RPC del servidor y una clave secreta no expuesta al navegador.
- Autenticación de Supabase para el panel y roles registrados en `staff_members`.
- Uso de RLS en la base de datos; sus políticas deben revisarse junto con `supabase/schema.sql` cuando cambie el esquema.
- Consentimiento obligatorio cuando el formulario incluye un pin.
- Redondeo de coordenadas a dos decimales en el servidor para reducir la precisión de la ubicación almacenada.
- Encabezados de seguridad en `netlify.toml`: Content-Security-Policy (solo scripts propios; sin código en línea salvo el `<script>` de una línea al inicio de `index.html`, autorizado por hash), HSTS, Permissions-Policy, `nosniff` y `Referrer-Policy`.
- Permisos por rol aplicados en la base de datos: `seguimiento` solo modifica sus contactos o los que no tienen responsable; solo `admin` reasigna, anonimiza y gestiona el equipo; nunca se puede quedar sin administradores.
- Las búsquedas en Nominatim se espacian al menos 1.1 s (política de uso de OpenStreetMap).
- `/api/health` deshabilitado (404) salvo que exista `HEALTH_TOKEN` y la petición lo presente; comparación en tiempo constante.
- Aviso de privacidad en `public/privacidad/` (plantilla pendiente de completar y validar jurídicamente), enlazado desde el formulario.
- Anonimización de contactos (`anonymize_contact`, solo admin, botón en el panel) y función de conservación `purge_inactive_contacts(interval)`.

Estos controles reducen riesgos, pero no equivalen a una auditoría de seguridad independiente.

## Obligaciones antes de una publicación pública

- Publicar un aviso de privacidad adecuado a la legislación aplicable, explicando responsable, finalidades, transferencias, conservación, derechos y contacto.
- Definir quién accede al CRM, cómo se retiran accesos y cómo se atienden solicitudes de eliminación/corrección.
- Establecer plazos de conservación y eliminación de contactos.
- Revisar las políticas RLS y probarlas con cuentas de distintos roles.
- Revisar límites de solicitudes, protección contra abuso, CORS/origen permitido y mensajes de error.
- Confirmar si el endpoint `/api/health` debe permanecer habilitado en producción; puede revelar detalles operativos aunque no muestre claves.
- Mantener dependencias y funciones actualizadas y revisar alertas de vulnerabilidad.
- Verificar las licencias y atribuciones de mapas, tipografías, fotografías, videos y librerías.

## Content-Security-Policy: cómo mantenerla

- No agregues `<script>` en línea ni atributos `onclick`/`onerror` en el HTML: usa archivos en `public/js/` y `addEventListener`.
- Si cambias el `<script>` de una línea al inicio de `index.html`, recalcula su hash y actualízalo en `netlify.toml`:
  `node -e "console.log('sha256-'+require('crypto').createHash('sha256').update('document.documentElement.classList.add(\"js\")').digest('base64'))"`
  (sustituye el texto por el contenido exacto del script).
- Para un nuevo servicio externo (otro proveedor de teselas, un dominio propio de Supabase, analítica), agrega su dominio a la directiva correspondiente (`img-src`, `connect-src`, …). Si algo deja de cargar, la consola del navegador muestra «Refused to … because it violates the Content Security Policy».
- La sesión del panel se guarda en `localStorage` (comportamiento de supabase-js); la CSP es la principal defensa para que ningún script ajeno pueda leerla.

## Manejo de secretos

Nunca incluir en GitHub las variables `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, `RATE_LIMIT_SALT` u otras credenciales. Configurarlas en el gestor de variables de Netlify. Si se expone una credencial, revocarla y sustituirla.

## Alcance

Este documento describe controles visibles en el repositorio y pendientes recomendados. No constituye asesoría jurídica ni certificación de cumplimiento normativo.
