# Enjambre · landing + CRM privado + mapas

- `public/` sitio estático: `index.html` (landing), `admin/` (panel privado), `js/mapa.js`, `vendor/` (Leaflet, markercluster, supabase-js locales), `assets/`.
- `netlify/functions/submit-contact.mjs` → `/api/contact` · `netlify/functions/conagua.mjs` → `/api/conagua`
- `supabase/schema.sql` · `.env.example` · `netlify.toml` · `scripts/build-config.mjs` (comprobación del build; no genera configuración)
- **Despliegue, diagnóstico (`/api/health`) y pruebas: `DEPLOY.md`.** · Sección de impacto y procedencia de datos: `docs/IMPACTO.md`.

Reglas respetadas: país seleccionable (México por defecto); ubicación solo con pin opcional y siempre aproximado, en cualquier país (se redondea a ~1 km en servidor); consentimiento obligatorio solo con pin; ocho estados comerciales aprobados; sin cuentas ni responsables inventados; la landing pública no carga datos del CRM; claves secretas solo en variables de Netlify.
La métrica preliminar (~12 m³ en ~4 h) sigue sin aparecer. Buscar `REVISAR` en `index.html` y ver DEPLOY.md §5.

## Documentación técnica

- `docs/ARQUITECTURA.md`: componentes, flujos y responsabilidades.
- `docs/CONFIGURACION.md`: variables de entorno y ejecución local.
- `docs/PRUEBAS.md`: lista de pruebas manuales y criterios de aceptación.
- `docs/SEGURIDAD_PRIVACIDAD.md`: controles observados y pendientes de privacidad.
- `docs/ESTADO_PROYECTO.md`: pendientes previos a publicación.
- `docs/IMPACTO.md`: reglas editoriales y procedencia de los datos ambientales.
