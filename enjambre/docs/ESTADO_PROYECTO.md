# Estado del proyecto y pendientes

## Alcance actual

El repositorio contiene una landing pública, mapas, una sección editorial de impacto ambiental, un formulario de contacto, funciones de servidor y un panel privado conectado a Supabase. El estado real de cada servicio depende de las variables configuradas y de los proveedores externos; la presencia del código no confirma que el despliegue esté operativo.

## Pendientes prioritarios antes de una presentación formal

### Contenido y afirmaciones técnicas

- [ ] Resolver los comentarios `REVISAR` en `public/index.html`.
- [ ] Validar con ingeniería la descripción de cada etapa física del sistema.
- [ ] No publicar métricas de rendimiento como hechos comprobados sin documentar metodología, fecha, condiciones, mediciones y evidencia. La nota de `LEEME.md` indica que la métrica preliminar de aproximadamente 12 m³ en 4 horas sigue pendiente de validación.

### Identidad y derechos

- [ ] Confirmar la licencia de uso web de `public/assets/fonts/enjambre.ttf`.
- [ ] Cerrar y documentar la paleta visual definitiva.
- [ ] Confirmar derechos y créditos de fotografías, videos, ilustraciones y logotipos.
- [ ] Seleccionar una licencia para el código o declarar explícitamente que no se concede una licencia de reutilización.

### Privacidad y operación

- [ ] Publicar aviso de privacidad y definir conservación/eliminación de datos.
- [ ] Confirmar las personas que administran cuentas y revisan contactos.
- [ ] Confirmar el proveedor de correo y probar notificaciones si se usarán.
- [ ] Probar el control de acceso con cuentas reales de cada rol.
- [ ] Decidir si `/api/health` debe deshabilitarse o restringirse tras terminar el diagnóstico.

### Servicios externos y rendimiento

- [ ] Probar disponibilidad de la capa CONAGUA desde Netlify y documentar alternativa si el servicio bloquea solicitudes.
- [ ] Revisar condiciones de uso del servicio de teselas de OpenStreetMap según el tráfico esperado.
- [ ] Confirmar el comportamiento móvil y los estados de error de formularios y mapas.
- [ ] Ejecutar el plan de pruebas de `PRUEBAS.md` y registrar resultados con el commit probado.

