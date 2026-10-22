# Enjambre · landing + CRM privado + mapas

- `public/` sitio estático: `index.html` (landing), `admin/` (panel privado), `js/mapa.js`, `vendor/` (Leaflet, markercluster, supabase-js locales), `assets/`.
- `netlify/functions/submit-contact.mjs` → `/api/contact` · `netlify/functions/conagua.mjs` → `/api/conagua`
- `supabase/schema.sql` · `.env.example` · `netlify.toml` · `scripts/build-config.mjs`
- **Despliegue y pruebas: `DEPLOY.md`.**

Reglas respetadas: país fijo México; pin opcional y siempre aproximado (se redondea a ~1 km en servidor); consentimiento obligatorio solo con pin; ocho estados comerciales aprobados; sin cuentas ni responsables inventados; la landing pública no carga datos del CRM; claves secretas solo en variables de Netlify.
La métrica preliminar (~12 m³ en ~4 h) sigue sin aparecer. Buscar `REVISAR` en `index.html` y ver DEPLOY.md §5.
