# Enjambre

Plataforma web para presentar la propuesta de recolección de residuos flotantes en cuerpos de agua, explorar referencias geográficas y recibir solicitudes de contacto. El repositorio incluye una landing pública, un panel privado de seguimiento de contactos y funciones de servidor desplegadas en Netlify.

> **Estado:** prototipo funcional en desarrollo. La web presenta una propuesta tecnológica; no demuestra por sí sola que el sistema físico haya sido construido, validado o autorizado para operar.

## Contenido del repositorio

La aplicación está dentro de [`enjambre/`](./enjambre/). Los documentos técnicos y operativos están en [`enjambre/docs/`](./enjambre/docs/).

- [`enjambre/LEEME.md`](./enjambre/LEEME.md): mapa rápido de carpetas y componentes.
- [`enjambre/DEPLOY.md`](./enjambre/DEPLOY.md): configuración de Supabase y Netlify, despliegue y diagnóstico.
- [`enjambre/docs/ARQUITECTURA.md`](./enjambre/docs/ARQUITECTURA.md): componentes, flujos y estructura.
- [`enjambre/docs/CONFIGURACION.md`](./enjambre/docs/CONFIGURACION.md): variables de entorno y configuración local.
- [`enjambre/docs/PRUEBAS.md`](./enjambre/docs/PRUEBAS.md): pruebas manuales y criterios de aceptación.
- [`enjambre/docs/SEGURIDAD_PRIVACIDAD.md`](./enjambre/docs/SEGURIDAD_PRIVACIDAD.md): límites de acceso y manejo de datos.
- [`enjambre/docs/ESTADO_PROYECTO.md`](./enjambre/docs/ESTADO_PROYECTO.md): pendientes antes de presentar o publicar.
- [`enjambre/docs/IMPACTO.md`](./enjambre/docs/IMPACTO.md): formato, criterios editoriales y procedencia de contenido ambiental.

## Funcionalidades principales

- Landing pública con identidad visual, descripción del sistema y recursos audiovisuales.
- Mapa público con cartografía base y consulta de una capa geográfica de referencia de CONAGUA.
- Formulario de contacto validado en servidor, con país y ubicación aproximada opcional.
- Panel privado en `/admin/` para gestionar contactos, estados, responsables y seguimiento.
- Persistencia en Supabase y notificación opcional por correo mediante Resend.
- Funciones de Netlify para el envío de contactos, consulta geográfica, configuración pública y diagnóstico.

## Tecnologías

- HTML, CSS y JavaScript del lado del cliente.
- Netlify para hosting estático y funciones de servidor.
- Supabase (PostgreSQL, autenticación y políticas de acceso) para persistencia y panel.
- Leaflet y OpenStreetMap para el mapa.
- Servicio ArcGIS REST de CONAGUA como fuente de una capa temática.
- Resend como integración opcional para avisos por correo.
- Node.js y `undici` en la función de consulta geográfica cuando se configura un certificado CA adicional.

## Inicio rápido

1. Revisa los requisitos y pasos de [`enjambre/DEPLOY.md`](./enjambre/DEPLOY.md) antes de configurar servicios.
2. Entra en la carpeta de la aplicación:

   ```bash
   cd enjambre
   npm install
   ```

3. El proyecto no define un servidor de desarrollo en `package.json`. Para probarlo localmente, utiliza Netlify CLI desde `enjambre/` para servir tanto los archivos estáticos como las funciones:

   ```bash
   npm install --global netlify-cli
   netlify dev
   ```

4. Configura las variables requeridas para las funciones según [`enjambre/docs/CONFIGURACION.md`](./enjambre/docs/CONFIGURACION.md) y [`enjambre/DEPLOY.md`](./enjambre/DEPLOY.md).

No publiques la aplicación como una carpeta estática arrastrada a Netlify Drop: las rutas `/api/*` necesitan que las Netlify Functions se desplieguen correctamente.

## Despliegue

El archivo `enjambre/netlify.toml` define `public/` como directorio publicado y `netlify/functions/` como directorio de funciones. Antes de desplegar una versión nueva, revisa las migraciones de Supabase y los pendientes de [`enjambre/docs/ESTADO_PROYECTO.md`](./enjambre/docs/ESTADO_PROYECTO.md).

## Limitaciones

- La capa de CONAGUA depende de la disponibilidad y accesibilidad del servicio externo.
- La sección de impacto debe conservar fuentes, fechas, atribuciones y derechos de uso de imágenes.
- El proyecto contiene verificaciones explícitas marcadas como `REVISAR` en `enjambre/public/index.html`; deben resolverse antes de una publicación formal.
- El sistema físico de recolección y sus métricas requieren validación de ingeniería y pruebas en condiciones reales.
