# Seguridad y privacidad

## Datos tratados

El formulario puede recibir nombre, organización, correo, teléfono, tipo de interés, país, mensaje y, de forma opcional, una ubicación aproximada. El CRM conserva datos de contacto y registros de seguimiento para uso del equipo autorizado.

## Controles presentes en el código

- Validación del método HTTP, tamaño de solicitud y campos en la función de servidor.
- Normalización de texto y validación de país, correo y coordenadas.
- Campo honeypot para filtrar parte del tráfico automatizado.
- Control de frecuencia mediante hash de IP y `RATE_LIMIT_SALT` en el procedimiento de base de datos.
- Guardado de contactos mediante una función RPC del servidor y una clave secreta no expuesta al navegador.
- Autenticación de Supabase para el panel y roles registrados en `staff_members`.
- Uso de RLS en la base de datos; sus políticas deben revisarse junto con `supabase/schema.sql` cuando cambie el esquema.
- Consentimiento obligatorio cuando el formulario incluye un pin.
- Redondeo de coordenadas a dos decimales en el servidor para reducir la precisión de la ubicación almacenada.
- Encabezados de seguridad básicos definidos en `netlify.toml`.

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

## Manejo de secretos

Nunca incluir en GitHub las variables `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, `RATE_LIMIT_SALT` u otras credenciales. Configurarlas en el gestor de variables de Netlify. Si se expone una credencial, revocarla y sustituirla.

## Alcance

Este documento describe controles visibles en el repositorio y pendientes recomendados. No constituye asesoría jurídica ni certificación de cumplimiento normativo.
