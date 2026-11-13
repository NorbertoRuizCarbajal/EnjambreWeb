# Configuración del entorno

Esta guía resume las variables del código. 

## Variables de entorno

Configúralas en Netlify en **Site configuration → Environment variables**, con alcance **Functions** cuando corresponda. No añadas valores reales a GitHub, capturas públicas ni documentación.

| Variable | Requerida | Uso |
|---|---|---|
| `SUPABASE_URL` | Sí para CRM/formulario | URL del proyecto Supabase. |
| `SUPABASE_SECRET_KEY` | Sí para guardar contactos y diagnóstico | Clave privada usada en servidor. Marcar como valor secreto. Nunca usar en cliente. |
| `SUPABASE_PUBLISHABLE_KEY` | Sí para panel | Clave publicable entregada al panel; no reemplazar por la secreta. |
| `RATE_LIMIT_SALT` | **Sí** (mínimo 16 caracteres) | Clave del HMAC de la IP para el control antiabuso. Sin ella el formulario no guarda envíos. Aleatoria y privada. |
| `RESEND_API_KEY` | Opcional | Permite enviar avisos de nuevos contactos mediante Resend. |
| `NOTIFY_EMAIL_FROM` | Opcional si se habilita correo | Remitente verificado en Resend. |
| `NOTIFY_EMAIL_TO` | Opcional | Destinatario de notificaciones; existe un valor predeterminado en la función. |
| `ALLOWED_ORIGIN` | Opcional | Orígenes **adicionales** aceptados por `/api/contact`, separados por comas. El propio dominio del sitio siempre se acepta; las peticiones sin encabezado `Origin` se rechazan. |
| `CONAGUA_CA_PEM` | Solo si hace falta | Certificado CA/intermedio en formato PEM para resolver una cadena de certificados incompleta del servicio externo. No desactivar la validación TLS. |
| `CONAGUA_LAYER_URL` | Opcional | URL del MapServer ArcGIS REST (sin número de subcapa). Predeterminado: SEMARNAT `esdig/Agua`. El prefijo `CONAGUA_` se conserva por compatibilidad. |
| `CONAGUA_LAYER_IDS` | Opcional | Subcapas a combinar, separadas por coma. Predeterminado: `6,7` (lagos y lagunas). |
| `WATER_SOURCE_NAME` | Opcional | Atribución que se muestra en el mapa. Si falta, se deduce del dominio (SEMARNAT o CONAGUA). |
| `HEALTH_TOKEN` | Solo para diagnóstico | Habilita `/api/health` (mínimo 16 caracteres). Sin ella el endpoint responde 404. Marcar como secreta y borrarla al terminar. |

## Requisitos y comandos

- Node.js compatible con la versión de Netlify Functions usada en el despliegue.
- npm.
- Netlify CLI para ejecutar localmente la web y las funciones juntas.
- Proyecto de Supabase con el esquema aplicado.

Copia `.env.example` como `.env` (no se versiona) y, desde la carpeta `enjambre/`:

```bash
npm install
npm install --global netlify-cli
netlify dev
```

## Comprobaciones y pruebas

- `npm run check`: verifica que países, tipos de interés, estados y roles coincidan entre el formulario, las funciones, el panel y `schema.sql` (también se ejecuta en cada build de Netlify), y que no haya secretos en `public/`.
- `npm test`: pruebas automáticas de las funciones (formulario, `/api/health`, capa de agua) sin red ni base de datos.

## Endpoints de diagnóstico

- `/api/health`: informa si existen variables y si responden Supabase y la capa de cuerpos de agua. Solo responde con `HEALTH_TOKEN` definido y presentado (`Authorization: Bearer …` o `?token=…`); en cualquier otro caso devuelve 404.
- `/api/public-config.js`: entrega exclusivamente configuración publicable al panel.
