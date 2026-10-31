# «Vive el sistema Enjambre» y «Equipo de diseño»

## Experiencia interactiva — ruta `/experiencia/`
Ruta dedicada (el sitio es HTML estático, sin framework): `public/experiencia/index.html` + `experiencia.css` + `experiencia.js`. Sin dependencias, sin servicios externos, sin cookies ni datos personales. Se enlaza desde la navegación («Experiencia interactiva») y desde un bloque en la página principal (`#experiencia`).

**Arquitectura (`experiencia.js`)**
- `S` es el único estado. Contadores, progreso, botones y escenas se **derivan** de él; por eso avanzar, retroceder o reiniciar no duplica residuos, conteos ni eventos (cada residuo cambia de estado una sola vez: `flota → glide → fin`).
- Cada etapa es una función que dibuja su escena (SVG para 1, 2, 6, 7 y 8; Canvas 2D para 3 y 4; DOM accesible para 5). `desmontar()` cancela animaciones, temporizadores y escuchas antes de montar otra.
- Navegación: teclado (flechas/WASD, Espacio), botones de dirección (táctiles), o tocar el agua. El lienzo usa `touch-action: pan-y`, así el desplazamiento vertical de la página sigue funcionando.
- Pausa y ahorro: el bucle de animación se detiene al pausar, al salir de pantalla y con la pestaña oculta. Con `prefers-reduced-motion` no hay vuelo, ondas ni oscilación: los cambios son inmediatos (el barco se sigue moviendo porque lo controla la persona).
- Textos y recortes siguen el **concepto ilustrado del proyecto** (`public/assets/exp/etapa-1…8.webp`): el barco *dirige* los residuos hacia la banda (no los carga), la separación inicial es *manual* (metales, rocas y otros) y lo apto pasa a la trituradora. Los destinos finales se describen sin afirmar reciclaje.
- Depuración: añadir `?debug` a la URL expone el estado en `window.__exp()` (solo lectura para pruebas).

**Para ajustar**: textos por etapa en `ETAPAS`; tipos y categorías de residuos en `TIPOS`/`CATS`; posiciones de los residuos en `RES0`; meta de recolección en `GOAL`.

## Equipo de diseño — sección `#equipo`
Datos en **un solo archivo: `public/data/equipo.json`**; `public/js/equipo.js` solo los pinta.
- `miembros[]`: `name` (obligatorio), `role`, `roles_extra` (lista), `afiliacion`, `bio` (responsabilidades reales; `null` si no hay), `image` (ruta en `assets/` o `null` → iniciales).
- `colaboracion[]`: tres áreas de trabajo basadas en lo documentado (ingeniería del sistema físico, propuesta digital y experiencia, presentación a aliados). No se asignan personas ni resultados a cada área.
- Estado actual: 1 perfil (Norberto Ruiz Carbajal · Integrante del equipo de diseño · Estudiante de Informática, UNAM). No se encontraron otros nombres ni créditos en la documentación; no se inventaron.

## Información pendiente
Responsabilidades concretas de Norberto (`bio`/`roles_extra`) y, si quieres, foto; nombres, roles y responsabilidades de los demás integrantes (incluido el equipo de ingeniería, si debe aparecer).
