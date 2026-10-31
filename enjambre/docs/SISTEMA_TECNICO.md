# Sección «Así funciona el sistema real» (`#sistema`)

Integra la documentación técnica real en la página principal (`public/index.html`, entre las etapas narrativas y la experiencia interactiva) y se enlaza desde el menú («Sistema real»). Es HTML estático: para editar textos, buscar `id="sistema"`; estilos con prefijo `.sis-` en el mismo archivo. Medios en `public/assets/sistema/`.

## Fuentes por afirmación
Fuente principal: Arizmendi Maya, I. D. (2023), tesis de maestría en Ingeniería Mecánica (Diseño Mecánico), UNAM, proyecto SACMEX–UNAM («Tesis… 28 páginas contienen información técnica.pdf»). Las imágenes de la tesis llevan «Elaboración propia» y su número de imagen.

| Afirmación publicada | Fuente |
|---|---|
| El barco se opera a control remoto; hélices y motores fuera del agua para evitar enredos con hierba, ramas e hilos | Tesis, cap. 4.2.3 (subsistema Barco: requerimientos y diseño de conceptos) |
| Dos posiciones de dirección separadas 90° (navegación y recolección); el costado del casco arrastra residuos hacia el extractor | Tesis, cap. 4.2.3 (diseño conceptual y de detalle) |
| Estructura plegable: hasta 1.5 m de alto desplegada, menos de la mitad al plegarse; dos personas la operan a mano en las pruebas | Tesis, cap. 4.2.3 (diseño de detalle y pruebas, 4.2.3.7) |
| Extractor = transportador de cangilones (cadena); 4 a 8 m de largo en el diseño | Tesis, cap. 4.2.2 (requerimientos y concepto) |
| Prototipo del extractor construido; pruebas de campo en el embarcadero Cuemanco (Xochimilco) | Tesis, 4.2.2.7 y 4.2.2.10 (Imágenes 40 y 47); barco: 4.2.3.7 y 4.2.3.10 (Imágenes 62, 63 y 69) |
| El extractor «jala» al barco con eslingas hasta la posición de guardado | Tesis, 4.2.3.7 (Imagen 64) |
| Sistema «Todo en uno» de 8 subsistemas; selección manual en el separador; triturador que reduciría el volumen hasta 70 % | Tesis, 4.1.5 (Imagen 16). El 70 % es objetivo de diseño del triturador, no un resultado |
| ≈158 000 m³ de residuos sólidos removidos y desazolvados en 2022 | Tesis, cap. 3, cita [1]: Gobierno de la Ciudad de México, «Rescate de ríos y cuerpos de agua», 2022 (consultado por la tesis el 5-ene-2023). Dato histórico |
| 17 presas del Sacmex; profundidad media ≈5 m; casi todas con una sola compuerta de drenaje; mucho material orgánico | Tesis, cap. 3 y 4.2.3 |
| Meta de ≈300 kg/h | Tesis (tabla de requerimientos, valor «prometido») y `Carga Cangilón.xlsx`. **No se presenta como capacidad demostrada** |

## Qué no se pudo inspeccionar
- Los archivos `.stp` (`Sistema todoenuno_Etapa 1_05-07-22`, `Baarquito desplegado arrastre`, `Triturador v_2_2`) **no venían entre los adjuntos**, así que no se abrieron ni se afirma nada sobre su interior. El estado operativo del triturador se trata como no confirmado.
- Se usó la captura `Captura de pantalla 2026-10-27 084505.png` como referencia del modelo CAD (etiquetada «Modelo CAD»).

## Contradicciones y datos sin confirmar (resolver con el equipo)
1. **Número de subsistemas:** la tesis define 8 (bote, extractor, rampas, elevadores, estructura principal, pasillos y plataforma de supervisión, separador, triturador); el contexto técnico anterior del sitio decía 7. La página usa 8 y ya no dice «siete».
2. **Terminología:** la tesis llama al extractor «transportador de cangilones»; documentos anteriores decían «banda extractora». Se unificó a «extractor de cangilones» (incluida la experiencia interactiva). El separador sí es una banda transportadora.
3. **«Autónomo»:** el video `todo en uno-con música.mp4` describe un «barco autónomo» que «traza la ruta»; la tesis lo describe operado a control remoto. La página dice «control remoto». Ese video **no se incrustó** (además lleva música y textos propios); si se quiere usar, hay que re-editarlo sin esa frase.
4. **Capacidad:** dos métricas distintas circulan: 300 kg/h (tesis/Excel, valor prometido) y ≈12 m³ en ≈4 h (≈3 m³/h, conversación con ingeniería). No son comparables sin convertir densidades y ninguna está demostrada.
5. **Excel `Carga Cangilón.xlsx`:** `Hoja1` usa 900 botellas/m³ y `Hoja2` coincide con la tesis (651 botellas/m³, 73.4 kg/h de cuadrilla); los escenarios teóricos de `Hoja1` superan el valor prometido porque suponen cangilones llenos. Son cálculos de verificación geométrica, **no se publicaron** como capacidad.
6. **Medios:** `20231110_134817.mp4` (archivo del 10-nov-2023) se etiqueta «Prueba documentada» por mostrar el barco en el agua, pero el lugar y el propósito exactos están por confirmar; `Video de WhatsApp 2024-11-07…` (7-nov-2024) se etiqueta «Prototipo fabricado» (no se sabe si fue una prueba formal). Ambos se publican **sin audio**.
7. **Derechos:** las imágenes provienen de la tesis (elaboración propia del autor) y de archivos del proyecto: confirmar permiso de publicación y créditos.
8. **Equipo:** la tesis menciona personas e instituciones del proyecto SACMEX–UNAM. No se agregaron a la sección «Equipo de diseño» sin tu confirmación.

## Cómo agregar o cambiar evidencia
Copia un bloque `<figure class="sis-f">` dentro de `.sis-ev`, ajusta la imagen en `assets/sistema/`, usa **una** etiqueta: `sis-b-c` Modelo CAD, `sis-b-p` Prototipo fabricado, `sis-b-t` Prueba documentada, `sis-b-d` En desarrollo. Un render nunca debe llevar la etiqueta «Prueba documentada».
