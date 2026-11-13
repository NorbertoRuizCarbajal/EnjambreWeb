# Plan de pruebas

Este documento define pruebas manuales reproducibles. No implica que todas se hayan ejecutado ni que exista una suite automatizada. Registra fecha, entorno, resultado y evidencia al probar cada versión.

## 1. Landing y navegación

- [ ] La página principal carga sin errores de JavaScript.
- [ ] Navegación, enlaces, botones y secciones llevan al destino correcto.
- [ ] La página es legible en móvil, tableta y escritorio.
- [ ] Los videos muestran sus posters si el archivo multimedia no ha cargado.
- [ ] Las imágenes tienen texto alternativo significativo cuando corresponde.
- [ ] La sección de impacto muestra un carrusel de máximo tres noticias: en la primera solo hay flecha derecha, en las intermedias ambas y en la última solo la izquierda; también funcionan los puntos, las flechas del teclado y deslizar en móvil. Las ligas de fuente funcionan.
- [ ] «Proponer una alianza» (sección Alianzas), «Colabora» del menú y del pie de página llevan a `/colabora/`, donde el formulario funciona igual que antes.

## 2. Formulario de contacto

- [ ] Envío válido sin pin: se crea un contacto y una interacción en Supabase.
- [ ] Envío válido con pin y consentimiento: se guarda una ubicación aproximada.
- [ ] Pin sin consentimiento: la solicitud se rechaza.
- [ ] Correo inválido, campos requeridos vacíos o país inválido: la solicitud se rechaza con error comprensible.
- [ ] Coordenadas fuera de rango o no numéricas: la solicitud se rechaza.
- [ ] Cuerpo JSON mal formado o demasiado grande: se rechaza.
- [ ] Campo honeypot completado: no se guarda contacto real.
- [ ] Sin configuración de Supabase: no se muestra un éxito falso ni se registra una fila.
- [ ] Al superar el límite de envíos, la función devuelve una respuesta de limitación.
- [ ] Si Resend falla, el contacto permanece guardado y el fallo queda registrado sin revelar datos sensibles.

## 3. Mapa público

- [ ] La cartografía base se muestra y conserva su atribución.
- [ ] La búsqueda de lugar presenta resultados o un mensaje de error recuperable.
- [ ] La capa de cuerpos de agua solo se solicita con el nivel de zoom previsto y la leyenda y el popup muestran la fuente real (SEMARNAT).
- [ ] La capa presenta datos reales o un mensaje de indisponibilidad; no simula resultados oficiales.
- [ ] El mapa se adapta a pantallas pequeñas y no bloquea el resto de la página cuando falla el proveedor externo.

## 4. Panel privado

- [ ] Una persona sin sesión no puede consultar los datos privados.
- [ ] Un usuario autenticado que no está en `staff_members` no obtiene acceso al CRM.
- [ ] El rol `seguimiento` ve todos los contactos; en los asignados a otra persona los controles aparecen desactivados con el aviso «Asignado a …».
- [ ] Un usuario `seguimiento` que edita un contacto sin responsable lo deja asignado a sí; no puede reasignarlo a otra persona.
- [ ] Solo `admin` ve la pestaña «Equipo»; desde ella puede dar acceso por correo, cambiar rol/nombre y retirar acceso, pero no puede dejar el panel sin administradores.
- [ ] El rol `admin` puede realizar las acciones administrativas permitidas.
- [ ] Cambios de estado, asignación, notas e interacciones persisten después de recargar.
- [ ] La sesión se cierra correctamente.
- [ ] «Eliminar datos personales» solo aparece al rol `admin`; tras usarlo el contacto queda archivado, sin nombre, correo, teléfono, mensaje, notas ni ubicación. Una llamada a `rpc/anonymize_contact` con un usuario `seguimiento` es rechazada.

## 5. Despliegue y seguridad

- [ ] `/api/health` responde 404 sin `HEALTH_TOKEN` o con un token incorrecto; con el token correcto devuelve JSON sin valores de credenciales.
- [ ] `/api/public-config.js` entrega solo la URL y la clave publicable necesarias.
- [ ] Las rutas `/api/contact` y `/api/conagua` están desplegadas como Netlify Functions.
- [ ] La compilación no publica secretos dentro de `public/`.
- [ ] Los encabezados configurados en `netlify.toml` están presentes (incluida la Content-Security-Policy) y la consola del navegador no muestra violaciones de CSP en la landing, el formulario con pin, `/admin/`, `/experiencia/` y `/privacidad/`.
- [ ] `npm run check` y `npm test` terminan sin errores.
- [ ] Al mover el mapa público a zoom ≥ 8 las peticiones `conagua?bbox=…` usan coordenadas redondeadas (vistas cercanas repiten la misma URL y se sirven desde caché); en pantallas muy grandes a zoom 8 aparece «Acerca un poco más el mapa» en lugar de un error.
- [ ] En el panel, la lista de contactos muestra 100 por página con «Anteriores/Siguientes», el total correcto con filtros, y el filtro «Mis contactos».
- [ ] Un POST a `/api/contact` sin encabezado `Origin` o desde otro dominio responde 403; sin `RATE_LIMIT_SALT` responde 500 `config` sin guardar nada.
- [ ] Se revisan los logs de Netlify y Supabase por errores sin incluir datos personales completos.

## Evidencia recomendada

Para cada prueba registra: fecha, commit desplegado, navegador/dispositivo, pasos, resultado esperado, resultado observado, captura sin datos personales y enlace al issue si hubo un fallo. No publiques nombres, correos, teléfonos, ubicaciones ni claves de contactos reales en evidencias.
