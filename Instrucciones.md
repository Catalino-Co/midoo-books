# MIDOO Books — Manual de instrucciones

## Módulo «Maqueta y documento»

Es la pantalla del libro en la ruta **Maqueta** (`/books/{bookId}/layout`). Agrupa todo lo que define **cómo se ve y se comporta el libro en la vista previa paginada**: por un lado el **formato físico de la página** (tamaño, márgenes, doble cara, guías de sangrado y zona segura) y por otro los **ajustes editoriales** que ya existían (numeración, cabecera/pie, índice y tipos donde se oculta el número).

Los datos viven en **`layout_settings`** (una fila por libro), cargados y guardados vía `getLayoutSettings` / `updateLayoutSettings`. Tras guardar, conviene **recargar la vista previa** para ver geometría y paginación alineadas con lo nuevo.

---

## Panel «Formato del documento» (PARTE 13)

Define el **trim size** y los **márgenes** que usa el motor de paginación y el preview (caja útil dentro de la hoja).

| Opción | Para qué sirve |
|--------|----------------|
| **Tamaño de página** (selector) | Elige un **preset** editorial (A5, Carta/Letter, Trade 6×9 in, A4) o **Personalizado**. Al elegir un preset distinto de «Personalizado», se rellenan **ancho** y **alto** en **mm** con las medidas canónicas de ese formato. El valor guardado como `pageSizePreset` es sobre todo una **etiqueta de UI**; lo que manda en render es `pageWidth` + `pageHeight` + `pageUnit`. |
| **Ancho** | Ancho de la **hoja completa** (no solo del texto), en la unidad elegida. |
| **Alto** | Alto de la **hoja completa**, en la misma unidad. |
| **Unidad** | Unidad de las cuatro medidas anteriores y de los márgenes: **mm**, **in**, **pt** o **px**. Si cambias ancho/alto/unidad de forma que ya no coincidan con el preset seleccionado, el preset pasa automáticamente a **Personalizado**. |
| **Margen superior** | Espacio en blanco entre el **borde superior de la hoja** y el área donde va el contenido (rail + cuerpo + pie dentro del área útil en preview). |
| **Margen inferior** | Igual, respecto al **borde inferior** de la hoja. |
| **Margen interior (lomo)** | En **doble cara**, es el margen del **lado del lomo** (donde se encuaderna). En recto/verso la app intercambia interior/exterior para que el lomo quede coherente con el preview. |
| **Margen exterior (corte)** | Margen del **lado del corte** (borde externo de la página), frente al interior. |
| **Páginas enfrentadas (interior / exterior)** | Si está activo, se usan **márgenes distintos** en izquierda y derecha según sea **verso o recto** (espejo típico de libro). Si está desactivado, los márgenes horizontales se **promedian** (simétricos), pensado para borrador o PDF de una sola cara. |
| **Sangrado (mm, opcional)** | Valor persistido para **bleed** futuro. Hoy sirve sobre todo para **visual** en preview (halo alrededor de la hoja si es mayor que 0). No sustituye aún un PDF de imprenta con sangrado real. |
| **Zona segura extra (mm)** | Inset **uniforme** hacia dentro **desde el borde del área útil**; en preview se muestra como **guía discontinua** para no pegar elementos críticos al borde. `0` = desactivado. |

**Nota:** Los márgenes en dominio se interpretan en la **misma unidad** que `pageUnit` (como el resto de dimensiones de página en `LayoutSettings`).

---

## Otros paneles de la misma pantalla «Maqueta y documento»

Siguen en la misma página y se guardan con el mismo botón **Guardar ajustes**:

- **Numeración**: folio editorial (activar/desactivar), estilo de preliminares (romanos, etc.), número inicial del cuerpo, desde qué sección empieza el cuerpo en arábigos.
- **Cabecera y pie**: mostrar pie y/o cabecera en preview.
- **Índice automático**: título del TOC, texto del título, puntos guía entre título y número de página.
- **Ocultar número en tipos especiales**: tipos de sección donde el número puede ocultarse aunque la página cuente en el flujo.

El enlace **Abrir preview** lleva a la vista previa paginada del mismo libro para comprobar tamaño de hoja, márgenes y R/L con los ajustes guardados.
