# Arquitectura del sistema

## 1. Vista general

Enjambre utiliza una arquitectura ligera: sitio estático servido por Netlify, funciones de servidor para operaciones que no deben ejecutarse en el navegador y Supabase para almacenar y gestionar los contactos.

```text
Visitante
  ├── Landing pública (public/index.html)
  ├── Formulario de colaboración (public/colabora/)
  │     ├── Mapa → /api/conagua → servicio ArcGIS REST de SEMARNAT (esdig/Agua, configurable)
  │     └── Formulario → /api/contact → Supabase RPC → tablas de contactos
  └── Panel privado (/admin/)
        ├── /api/public-config.js → URL + clave publicable de Supabase
        └── Supabase Auth + RLS → contactos, interacciones y ubicaciones

Netlify
  ├── public/                 archivos estáticos
  └── netlify/functions/      endpoints del servidor
```

## 2. Componentes

| Ruta | Responsabilidad |
|---|---|
| `public/index.html` | Landing pública: estructura de las secciones (el formulario ya no está aquí). |
| `public/colabora/index.html` | Página del formulario de colaboración; se llega desde «Proponer una alianza» (sección Alianzas), el menú y el pie de página. |
| `public/css/sitio.css` | Estilos compartidos por la landing y `colabora/` (antes estaban dentro de `index.html`). |
| `public/js/landing.js` · `menu.js` · `contacto.js` | Comportamiento de la landing (videos, hilo de etapas, pausa) · menú principal · envío del formulario y animación de éxito. |
| `public/js/mapa.js` | Comportamiento de los mapas, búsqueda y consulta geográfica. |
| `public/js/impacto.js` | Carrusel de «El impacto que no podemos ignorar»: una noticia a la vez con flechas, puntos, teclado y deslizamiento. |
| `public/data/impacto.json` | Datos editoriales de noticias, videos, fotografías e informes. |
| `public/admin/index.html` | Estructura del panel de gestión. |
| `public/admin/admin.js` | Inicio de sesión y operaciones de gestión del panel. |
| `public/vendor/` | Copias locales de Leaflet, MarkerCluster y cliente Supabase. |
| `netlify/functions/submit-contact.mjs` | Valida el formulario, aplica controles antiabuso, guarda el contacto y trata de enviar una notificación. Endpoint `/api/contact`. |
| `netlify/functions/conagua.mjs` | Consulta y transforma la capa oficial de cuerpos de agua (SEMARNAT por defecto) y devuelve su atribución en `fuente`. Endpoint `/api/conagua` (nombre heredado). |
| `netlify/functions/public-config.mjs` | Entrega la configuración publicable necesaria para el panel. Endpoint `/api/public-config.js`. |
| `netlify/functions/health.mjs` | Diagnóstico de configuración y conectividad. Endpoint `/api/health`, protegido con `HEALTH_TOKEN` (404 sin él). |
| `supabase/schema.sql` | Esquema SQL, funciones, permisos y políticas de acceso. |
| `supabase/migrations/` | Cambios incrementales al esquema de base de datos. |
| `scripts/build-config.mjs` | Comprobación previa al despliegue para evitar exponer variables privadas en los archivos públicos. |
| `netlify.toml` | Directorios de build/publicación, funciones y encabezados HTTP. |

## 3. Flujo de envío de contacto

1. La persona completa el formulario público y puede indicar un pin aproximado.
2. El navegador envía la solicitud a `POST /api/contact`; no escribe directamente en la tabla de contactos.
3. La función valida método, tamaño del cuerpo, campos, país, coordenadas y consentimiento si se proporcionó un pin.
4. Si hay ubicación, el servidor redondea latitud y longitud a dos decimales para reducir precisión.
5. La función invoca `create_contact_submission` en Supabase usando una clave secreta disponible únicamente en el servidor.
6. Si está configurado Resend, se intenta enviar un aviso por correo. El aviso es complementario: un fallo de correo no elimina el contacto ya guardado.

## 4. Flujo del panel privado

El panel utiliza Supabase Auth para autenticar al personal. La pertenencia y el rol se determinan mediante `staff_members`; los roles previstos en el esquema son `admin` y `seguimiento`. Las políticas RLS deben seguir siendo la barrera de acceso a los datos, no solo la interfaz del navegador.

- `admin`: edita todos los contactos, reasigna responsables, elimina datos personales y gestiona el equipo desde la pestaña «Equipo» (`staff_directory`, `add_staff_by_email`).
- `seguimiento`: ve todos los contactos, pero solo edita (estado, seguimiento, notas, evaluaciones) los asignados a sí o los que no tienen responsable; al editar uno sin responsable lo toma. No reasigna ni gestiona el equipo.
- Las reglas las impone la base de datos (`can_edit_contact` y políticas RLS); el panel solo desactiva los controles para que coincidan. Siempre debe quedar al menos un admin (disparador `keep_one_admin`).

## 5. Mapa y fuentes

- Leaflet renderiza los mapas interactivos.
- OpenStreetMap se utiliza como cartografía base; conserva su atribución y respeta sus condiciones de uso.
- La capa temática se consulta a través de `/api/conagua`, que actúa como intermediario para el servicio ArcGIS REST de SEMARNAT (lagos y lagunas, `esdig/Agua`). La atribución visible la decide el servidor según el servicio consultado.
- La disponibilidad de la capa depende del servicio remoto. Su visualización no certifica la idoneidad de un sitio para operar ni sustituye permisos ambientales.
- La búsqueda de lugares puede utilizar servicios externos; revisa las condiciones y políticas vigentes de cada proveedor.

## 6. Decisiones y límites

- No se publica la clave secreta de Supabase en JavaScript del navegador.
- El sitio público no debe recibir ni descargar los datos privados del CRM.
- La ubicación es opcional y aproximada; si se proporciona, se requiere consentimiento explícito.
- La web presenta la propuesta conceptual. El desempeño del sistema físico, sus capacidades y métricas deben demostrarse con pruebas de ingeniería.

## 7. Rendimiento

- Logos en WebP redimensionados al tamaño en que se muestran (originales en `assets-originales/`, fuera de `public/`). Tipografía en WOFF2 con el TTF como respaldo.
- Videos con carga diferida: solo se descargan al acercarse a la pantalla y no se reproducen con «reducir movimiento» o ahorro de datos.
- Capa de agua: el navegador redondea el área consultada a una cuadrícula de media tesela, así que vistas parecidas generan la misma URL; `/api/conagua` responde con `cache-control: public, max-age=600, s-maxage=3600` y Netlify reutiliza la respuesta. Área máxima por consulta: 60 grados² (mismo límite en `public/js/mapa.js` y en la función).
- Panel: contactos paginados en el servidor (100 por página, con total exacto); el mapa del panel carga como máximo los 2000 pines más recientes.
