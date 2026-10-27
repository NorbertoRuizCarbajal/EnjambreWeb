# Configuración del entorno

Esta guía resume las variables del código. 

## Variables de entorno

Configúralas en Netlify en **Site configuration → Environment variables**, con alcance **Functions** cuando corresponda. No añadas valores reales a GitHub, capturas públicas ni documentación.

| Variable | Requerida | Uso |
|---|---|---|
| `SUPABASE_URL` | Sí para CRM/formulario | URL del proyecto Supabase. |
| `SUPABASE_SECRET_KEY` | Sí para guardar contactos y diagnóstico | Clave privada usada en servidor. Marcar como valor secreto. Nunca usar en cliente. |
| `SUPABASE_PUBLISHABLE_KEY` | Sí para panel | Clave publicable entregada al panel; no reemplazar por la secreta. |
| `RATE_LIMIT_SALT` | Recomendable/requerida para configuración completa | Se combina con la IP para generar un hash para controles antiabuso. Debe ser aleatoria y privada. |
| `RESEND_API_KEY` | Opcional | Permite enviar avisos de nuevos contactos mediante Resend. |
| `NOTIFY_EMAIL_FROM` | Opcional si se habilita correo | Remitente verificado en Resend. |
| `NOTIFY_EMAIL_TO` | Opcional | Destinatario de notificaciones; existe un valor predeterminado en la función. |
| `ALLOWED_ORIGIN` | Opcional | Restringe el origen aceptado por el endpoint de contacto. Configurar con el dominio de producción. |
| `CONAGUA_CA_PEM` | Solo si hace falta | Certificado CA/intermedio en formato PEM para resolver una cadena de certificados incompleta del servicio externo. No desactivar la validación TLS. |
| `CONAGUA_LAYER_URL` | Opcional | Permite especificar la capa ArcGIS REST; de lo contrario se usa el valor predeterminado del código. |

## Requisitos y comandos

- Node.js compatible con la versión de Netlify Functions usada en el despliegue.
- npm.
- Netlify CLI para ejecutar localmente la web y las funciones juntas.
- Proyecto de Supabase con el esquema aplicado.

Desde la carpeta `enjambre/`:

```bash
npm install
npm install --global netlify-cli
netlify dev
```

## Endpoints de diagnóstico

- `/api/health`: informa si existen variables y si responden Supabase y CONAGUA. No debe incluir valores de claves, pero sí revela detalles de estado; limita su exposición en producción y elimina/deshabilita la función cuando deje de ser necesaria.
- `/api/public-config.js`: entrega exclusivamente configuración publicable al panel.
