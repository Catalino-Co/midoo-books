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
| **Sangrado (mm, opcional)** | En el **PDF de impresión** cada hoja crece este valor por el corte exterior, arriba y abajo (el lomo no), y las imágenes y aperturas «a sangre» lo cubren. KDP pide 3,2 mm (0,125 in). En la vista previa se ve con el botón **Guías**. El PDF de pantalla no lo usa. |
| **Zona segura extra (mm)** | Inset **uniforme** hacia dentro **desde el borde del área útil**; en preview se muestra como **guía discontinua** para no pegar elementos críticos al borde. `0` = desactivado. |

**Nota:** Los márgenes en dominio se interpretan en la **misma unidad** que `pageUnit` (como el resto de dimensiones de página en `LayoutSettings`).

---

## Otros paneles de la misma pantalla «Maqueta y documento»

Siguen en la misma página y se guardan con el mismo botón **Guardar ajustes**:

- **Numeración**: folio editorial (activar/desactivar), estilo de preliminares (romanos, etc.), número inicial del cuerpo, desde qué sección empieza el cuerpo en arábigos.
- **Cabecera y pie**: folio (número de página) con estilo «7», «— 7 —», «· 7 ·» o «[ 7 ]», centrado o en el corte exterior; cabecera (titulillo) con el título del capítulo, del libro o alternada (libro en pares, capítulo en impares), opcionalmente en mayúsculas espaciadas. Ambos van dentro de los márgenes y no aparecen en aperturas ni páginas a sangre.
- **Cabecera y pie → Ornamento del pie**: laurel, floritura, rombo, asterismo o puntos, centrado al pie de cada página de texto (no en portada, aperturas ni imágenes a sangre). Deja al menos 18 mm de margen inferior. «Mostrar pie de página» debe estar activo; el número solo sale si la numeración editorial está activa.
- **Fondo de página**: blanco, color de papel, papel con cuadrícula tenue o una imagen del libro (textura). Va a sangre en el PDF de imprenta. Una sección puede quitarlo con «Sin fondo de página» en su inspector. No se exporta al EPUB.
- **Aplicar el diseño de una plantilla**: cambia tamaño, márgenes, tipografía, estilos, pie y fondo por los de «Novela ilustrada» o «Devocional». Pide confirmación y no toca el contenido.
- **Tipografía**: **Guionización automática (español)** parte palabras al final de línea con las reglas del español; reduce los huecos del texto justificado. Se aplica igual en vista previa y PDF.
- **Índice automático**: título del TOC, texto del título, puntos guía entre título y número de página.
- **Ocultar número en tipos especiales**: tipos de sección donde el número puede ocultarse aunque la página cuente en el flujo.

El enlace **Abrir preview** lleva a la vista previa paginada del mismo libro para comprobar tamaño de hoja, márgenes y R/L con los ajustes guardados.

---

## Plantillas al crear un libro

En **Nuevo libro** elige la plantilla:

- **En blanco**: A5 con los ajustes por defecto, sin contenido.
- **Novela ilustrada**: 135,5 × 211,7 mm (384 × 600 pt). Portada con texto claro sobre la ilustración, portadilla, créditos, dedicatoria, índice, dos capítulos de ejemplo (apertura a sangre en página par, «Capítulo N», título, floritura, texto e ilustración) y contraportada. Folio «— 7 —» y guionización.
- **Devocional**: mismo formato, papel con cuadrícula, laurel al pie y sin folio. Cada día es una sección: etiqueta «Día {n}», reflexión, cita bíblica anclada al pie y, en la página siguiente, «Oración» y «Amén.». Incluye página «Otros libros» y contraportada.

Al crear el libro se abre la vista previa. Las imágenes van vacías: elígelas en cada bloque Imagen o Apertura. Las fuentes piden Quattrocento; si no la importas en **Estilos → Fuentes del libro**, se usa Georgia.

## Bloques nuevos

- **Etiqueta (Día N)**: texto corto enmarcado. Escribe `{n}` para numerar solo: «Día {n}» → Día 1, Día 2… en el orden del libro. Marco: placa con doble filete, píldora, recuadro, subrayado o sin marco; relleno y filete con color propio. Su estilo está en **Estilos → Etiqueta**.
- **Cita bíblica / referencia**: el texto del bloque es el versículo (opcional) y la referencia se escribe en el inspector (p. ej. «Mateo 4,19»). Filetes con adorno, simples o ninguno. Estilos **Cita bíblica: texto** y **Cita bíblica: referencia**.

En modo Escribir, el botón bajo el bloque («Marco y colores…» o la referencia) abre su inspector.

## Anclar al pie de la página

En el inspector del bloque → **Flujo de página → Anclar al pie de la página**. El bloque queda pegado al final de la caja de texto y lo siguiente empieza en otra página. Sirve para la cita bíblica de cada día, el lema o el autor al pie de la portada y el copyright de la contraportada.

## Portada y contraportada con texto

En una sección **Portada** o **Contraportada**, el primer bloque Imagen se convierte en el fondo de la hoja (a sangre) y los títulos y párrafos de la sección se componen encima. Si la ilustración es oscura, marca **Texto claro** en el inspector de la sección.
