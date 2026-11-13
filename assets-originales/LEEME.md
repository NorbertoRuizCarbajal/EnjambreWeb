# Originales de imágenes (no se publican)

Esta carpeta está fuera de `public/`, así que Netlify no la sirve. Guarda los archivos en alta resolución a partir de los cuales se generan las versiones web:

| Original | Versión publicada | Tamaño web |
|---|---|---|
| `logo-simbolo.png` (900×879, 638 KB) | `public/assets/logo-simbolo.webp` | 192×188, ~25 KB (se muestra a 30–46 px de alto) |
| `logo-enjambre.png` (1692×930, 845 KB) | `public/assets/logo-enjambre.webp` | 1100×605, ~160 KB (se muestra a 520 px de ancho como máximo) |

Si cambias un logo, vuelve a generar el `.webp` (calidad 90) con el mismo ancho y actualiza `width`/`height` en `public/index.html` si cambia la proporción.
