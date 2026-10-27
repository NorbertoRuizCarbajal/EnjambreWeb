# Sección "El impacto que no podemos ignorar" — cómo agregar contenido

La sección está justo después del hero (`#impacto-ambiental`). **No se edita HTML**: se edita `public/data/impacto.json` y se vuelve a desplegar.

```json
{ "id": "nombre-unico", "tipo": "noticia | video | fotografia | informe",
  "categoria": "Inundaciones urbanas", "nivel": "dato | atribucion | riesgo | referencia | propio | factor",
  "titulo": "…", "resumen": "2–3 frases PROPIAS (no copiar el artículo)",
  "fuente": "Medio o institución", "url": "https://… (publicación original)",
  "fecha": "AAAA-MM-DD o null", "consultado": "AAAA-MM-DD",
  "imagen": "assets/archivo.webp (solo si tienes derecho a usarla)", "alt": "descripción", "credito": "Autor/licencia",
  "video": "assets/clip.mp4 (video local; se abre en un diálogo, sin audio automático)",
  "cifra": "6 de cada 10", "cifra_texto": "qué mide y quién lo afirma" }
```
- `destacado` (raíz del JSON) = `id` de la tarjeta grande. Sin `imagen` se usa un icono neutro.
- `nivel` distingue **dato reportado**, **atribución de la autoridad**, **riesgo señalado**, **caso de referencia** y **registro propio**. No uses "dato" para una afirmación que solo es atribución. 
- Videos de terceros: enlaza (`url`) en vez de alojar. Videos propios o con licencia: `video`.

## Imágenes
Este entorno no puede descargar ni verificar licencias de fotos externas, y fotografiar la nota original requiere su permiso. Por eso las tres tarjetas usan **fotos del archivo de Enjambre**, rotuladas «Archivo Enjambre (ilustrativa)»: no pertenecen a la publicación citada. Para usar una foto de la nota o de otro autor: (1) confirma su licencia o pide permiso, (2) guarda el archivo en `public/assets/`, (3) cambia `imagen`, `alt` y `credito` (autor y licencia) en el JSON. Si una imagen no carga, solo esa tarjeta muestra un icono neutro.

## Contenido incluido (verificado en la fuente el 22-oct-2026)
Visibles (3): Sacmex/El Universal (destacada), Posta (Conagua) y Recycling International (Interceptor de The Ocean Cleanup, solo como referencia). Archivadas (no visibles): Expansión, Crónica (Benito Juárez 2026), Uno TV (operativo de lluvias 2026) y una fotografía del archivo del equipo.
**Pendiente:** confirmar ubicación y fecha de la foto propia; añadir videos/fotos con licencia y casos de éxito/comunidades con fuente (no se encontraron aquí recursos con licencia verificable). Las cifras de las notas varían entre fuentes (50 %, 60 %, 80 %): se presentan siempre como atribución de quien las dijo. Revisa los enlaces periódicamente: los medios cambian URLs.

## Capa de CONAGUA — procedencia
Capa «Cuerpos de agua» del visor hidrológico de CONAGUA: `https://sigagis.conagua.gob.mx/ArcGIS/rest/services/Contexto_hidrol%C3%B3gico/MapServer/3`. Se consulta a través de `/api/conagua`, solo por área visible y zoom ≥ 8, y la leyenda "Referencia oficial" aparece **solo después de recibir datos reales de ese servidor**. Condiciones de uso: las de CONAGUA/datos abiertos del gobierno; mapa base © OpenStreetMap. No certifica que Enjambre pueda operar en el sitio.
