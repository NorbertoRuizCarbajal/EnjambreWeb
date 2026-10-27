# Plan de pruebas

Este documento define pruebas manuales reproducibles. No implica que todas se hayan ejecutado ni que exista una suite automatizada. Registra fecha, entorno, resultado y evidencia al probar cada versión.

## 1. Landing y navegación

- [ ] La página principal carga sin errores de JavaScript.
- [ ] Navegación, enlaces, botones y secciones llevan al destino correcto.
- [ ] La página es legible en móvil, tableta y escritorio.
- [ ] Los videos muestran sus posters si el archivo multimedia no ha cargado.
- [ ] Las imágenes tienen texto alternativo significativo cuando corresponde.
- [ ] La sección de impacto muestra como máximo tres elementos visibles y las ligas de fuente funcionan.

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
- [ ] La capa de CONAGUA solo se solicita con el nivel de zoom previsto.
- [ ] La capa presenta datos reales o un mensaje de indisponibilidad; no simula resultados oficiales.
- [ ] El mapa se adapta a pantallas pequeñas y no bloquea el resto de la página cuando falla el proveedor externo.

## 4. Panel privado

- [ ] Una persona sin sesión no puede consultar los datos privados.
- [ ] Un usuario autenticado que no está en `staff_members` no obtiene acceso al CRM.
- [ ] El rol `seguimiento` solo puede realizar operaciones autorizadas por las políticas RLS.
- [ ] El rol `admin` puede realizar las acciones administrativas permitidas.
- [ ] Cambios de estado, asignación, notas e interacciones persisten después de recargar.
- [ ] La sesión se cierra correctamente.

## 5. Despliegue y seguridad

- [ ] `/api/health` devuelve JSON y no muestra valores de credenciales.
- [ ] `/api/public-config.js` entrega solo la URL y la clave publicable necesarias.
- [ ] Las rutas `/api/contact` y `/api/conagua` están desplegadas como Netlify Functions.
- [ ] La compilación no publica secretos dentro de `public/`.
- [ ] Los encabezados configurados en `netlify.toml` están presentes.
- [ ] Se revisan los logs de Netlify y Supabase por errores sin incluir datos personales completos.

## Evidencia recomendada

Para cada prueba registra: fecha, commit desplegado, navegador/dispositivo, pasos, resultado esperado, resultado observado, captura sin datos personales y enlace al issue si hubo un fallo. No publiques nombres, correos, teléfonos, ubicaciones ni claves de contactos reales en evidencias.
