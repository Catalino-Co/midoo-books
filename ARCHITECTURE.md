# ARCHITECTURE — MIDOO BOOKS

> Documento vivo. Última actualización: 2026-05-30.

---

## 1. Visión del producto

**MIDOO BOOKS** es una herramienta de maquetación editorial de escritorio que permite a autores independientes, diseñadores y pequeñas editoriales crear libros de calidad profesional sin depender de Canva, InDesign ni herramientas de suscripción.

### Para quién

| Perfil | Necesidad |
|---|---|
| Autor independiente | Escribir y exportar a PDF/EPUB listo para imprimir sin curva técnica |
| Diseñador editorial | Personalizar tipografía, estilos y layout por sección |
| Pequeña editorial | Gestionar catálogo de títulos con persistencia local y exportación multiformato |

### Principio rector

> El autor escribe. MIDOO maqueta. El lector lee.

La separación contenido/presentación es absoluta: el texto vive en bloques estructurados, el diseño vive en estilos de libro configurables. El usuario nunca toca CSS ni puntos tipográficos directamente.

---

## 2. Stack tecnológico actual

| Tecnología | Versión | Rol |
|---|---|---|
| **SvelteKit** | ^2.16 | Framework web / App Shell |
| **Svelte 5** | ^5.25 | UI con runes (`$state`, `$derived`, `$props`, `$effect`) |
| **TypeScript** | ^5.8 | Tipado estricto en todo el proyecto |
| **Vite** | ^6.2 | Bundler de desarrollo y build web |
| **Electron** | ^31.7 | Shell nativo Windows/Mac/Linux |
| **electron-builder** | ^25.1 | Empaquetado e instaladores (.exe, .dmg, .AppImage) |
| **sql.js** | ^1.12 | SQLite en WASM puro (sin compilación nativa) |
| **esbuild** | ^0.21 | Compilación de TypeScript de Electron → CJS |
| **docx** | ^9.6 | Exportación a Microsoft Word (.docx) |
| **jszip** | ^3.10 | Construcción de archivos EPUB |
| **gray-matter** | ^4.0 | Parsing de YAML frontmatter en importación Markdown |
| **marked** | ^13.0 | Conversión Markdown → bloques estructurados |

### Por qué estas elecciones

- **Svelte 5 Runes**: reactividad granular sin overhead, ideal para editor con estado complejo (inspector, paginación, zoom).
- **sql.js sobre better-sqlite3**: WASM puro, sin compilación nativa — funciona con cualquier versión de Node.js/Electron sin recompilar.
- **Motor de paginación propio**: en lugar de Paged.js, se construyó un motor TypeScript puro (`page-layout-engine.ts`) con medición de texto DOM en tiempo real. Permite control total de saltos de página, flujo de bloques y métricas físicas.
- **printToPDF + CSS `@page`**: la exportación PDF usa `webContents.printToPDF()` de Electron sobre una ruta de render dedicada. El tamaño de página lo controla CSS `@page { size: Xmm Ymm }` para generar MediaBox estándar.
- **Electron sobre Tauri**: el renderer SvelteKit se puede reutilizar como app web sin cambios. Tauri requeriría adaptar la capa de archivos a Rust.

---

## 3. Arquitectura de 3 capas

```
┌──────────────────────────────────────────────────────────────────┐
│  CAPA 1 — Core Editorial                                         │
│  src/lib/core/                                                   │
│                                                                  │
│  TypeScript puro. CERO dependencias de plataforma.              │
│  ✓ Dominio: Book, Section, Block, Asset, Layout, Export         │
│  ✓ Motor de paginación: page-layout-engine.ts                   │
│  ✓ Estilos editoriales: book-styles.ts                          │
│  ✓ Geometría de página: document-page-geometry.ts               │
│  ✓ Catálogos: section-type-catalog, block-type-catalog          │
│  ✗ NO: fs, electron, svelte, sql.js, window*, document*         │
│  (* excepto BrowserPreviewTextMeasurer que necesita DOM)         │
└──────────────────────────┬───────────────────────────────────────┘
                           │  importa tipos + funciones puras
┌──────────────────────────▼───────────────────────────────────────┐
│  CAPA 2 — App Shell                                              │
│  src/  (SvelteKit)  +  electron/ (proceso principal)            │
│                                                                  │
│  ✓ Componentes Svelte, routing, editor de contenido             │
│  ✓ Motor de preview paginado con zoom físico                    │
│  ✓ Módulos: Library, Content, Assets, Layout, Styles,          │
│             Preview, Export                                      │
│  ✓ Comunica con Capa 3 exclusivamente vía IPlatformAdapter      │
│  ✗ NO importa sql.js directamente                               │
│  ✗ NO accede a fs directamente (usa adapter)                    │
└──────────────────────────┬───────────────────────────────────────┘
                           │  IPC Electron / contextBridge
┌──────────────────────────▼───────────────────────────────────────┐
│  CAPA 3 — Persistencia                                           │
│  electron/database/ + src/lib/persistence/                      │
│                                                                  │
│  ✓ sql.js SQLite: BookRepo, SectionRepo, BlockRepo,             │
│              AssetRepo, LayoutRepo, ExportRepo                  │
│  ✓ Migraciones versionadas (v1–v11+)                            │
│  ✓ ElectronAdapter (contextBridge → IPC → main process)        │
│  ✓ WebAdapter (stub para modo web sin Electron)                 │
│  ✗ NO importa módulos de SvelteKit ($app/...)                   │
│  ✗ NO importa componentes Svelte                                │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4. Estructura de carpetas actual

```
midoo-books/
│
├── ARCHITECTURE.md              ← este archivo
├── DEVELOPMENT.md               ← guía de setup y scripts
├── Instrucciones.md             ← manual del módulo Maqueta
├── package.json
├── vite.config.js               ← puerto 5178, strictPort: true
├── svelte.config.js
│
├── electron/                    ← Proceso principal Electron
│   ├── main/
│   │   ├── index.ts             BrowserWindow, ciclo de vida
│   │   └── register-media-protocol.ts  protocolo midoo-media://
│   ├── preload/
│   │   └── index.ts             contextBridge → window.electronAPI
│   ├── ipc/
│   │   ├── index.ts             Registro central de handlers
│   │   └── handlers/
│   │       ├── app.handlers.ts
│   │       ├── db.handlers.ts
│   │       ├── fs.handlers.ts
│   │       ├── books.handlers.ts
│   │       ├── sections.handlers.ts
│   │       ├── blocks.handlers.ts
│   │       ├── assets.handlers.ts
│   │       ├── layout.handlers.ts
│   │       └── exports.handlers.ts
│   ├── database/
│   │   ├── connection.ts        Inicialización sql.js + persist()
│   │   ├── migrations.ts        Esquema versionado (v1–v11+)
│   │   ├── repositories/        BookRepo, SectionRepo, BlockRepo,
│   │   │                        AssetRepo, LayoutRepo, ExportRepo
│   │   └── mappers/             row → dominio (book, section, block, ...)
│   ├── lib/
│   │   ├── image-dimensions.ts
│   │   └── book-media-paths.ts
│   └── services/
│       └── asset-import.ts
│
├── src/                         ← App Shell (SvelteKit)
│   ├── app.html
│   ├── app.css
│   ├── lib/
│   │   ├── core/
│   │   │   ├── domain/          Tipos: block, section, book, layout,
│   │   │   │                    asset, export (branded IDs, interfaces)
│   │   │   └── editorial/       Motor editorial puro:
│   │   │       ├── page-layout-engine.ts      Paginación con flujo de bloques
│   │   │       ├── page-layout-model.ts       Tipos del motor
│   │   │       ├── browser-preview-text-measurer.ts  Medición DOM
│   │   │       ├── document-layout-metrics.ts
│   │   │       ├── document-page-geometry.ts
│   │   │       ├── book-styles.ts             Roles tipográficos + CSS
│   │   │       ├── preview-page-style.ts
│   │   │       ├── block-type-catalog.ts
│   │   │       ├── section-type-catalog.ts
│   │   │       ├── block-layout.ts
│   │   │       ├── blocks-to-markdown.ts
│   │   │       ├── image-block-content.ts
│   │   │       ├── chapter-opening-content.ts
│   │   │       └── title-page-content.ts
│   │   ├── persistence/
│   │   │   ├── index.ts         getPlatformAdapter() factory
│   │   │   └── adapters/
│   │   │       ├── IPlatformAdapter.ts   Contrato completo
│   │   │       ├── ElectronAdapter.ts    Implementación Electron
│   │   │       ├── WebAdapter.ts         Stub web (sin IPC)
│   │   │       └── electron.d.ts         Tipos de window.electronAPI
│   │   ├── services/            Capa de servicio (thin wrappers + lógica)
│   │   │   ├── books.service.ts
│   │   │   ├── content.service.ts
│   │   │   ├── assets.service.ts
│   │   │   ├── layout.service.ts
│   │   │   ├── styles.service.ts
│   │   │   ├── preview-layout.service.ts
│   │   │   └── export.service.ts        Markdown, EPUB, DOCX, PDF
│   │   └── components/
│   │       ├── preview/
│   │       │   └── BookPagedPreview.svelte
│   │       ├── SectionTypeSelect.svelte
│   │       └── MarkdownImportUnifiedModal.svelte
│   └── routes/
│       ├── +layout.svelte       Root layout (app.css)
│       ├── library/             Lista de libros
│       ├── books/new/           Crear libro
│       ├── books/[bookId]/
│       │   ├── +layout.svelte   Sidebar de navegación del libro
│       │   ├── overview/        Descripción y metadatos
│       │   ├── content/         Editor de secciones y bloques
│       │   ├── assets/          Gestión de imágenes
│       │   ├── styles/          Estilos editoriales por rol
│       │   ├── layout/          Formato físico, márgenes, numeración
│       │   ├── preview/         Vista previa paginada con zoom
│       │   └── export/          Exportación multiformato
│       └── export-render/[bookId]/  Ruta headless para printToPDF
│
├── dist-electron/               ← Compilados Electron (no commitear)
│   ├── main.cjs
│   └── preload.cjs
├── build/                       ← Build estático SvelteKit (no commitear)
└── scripts/
    ├── build-electron.mjs       Compilación con esbuild
    └── verify-db.mjs            Diagnóstico de base de datos
```

---

## 5. Modelo de dominio

### Entidades principales

```
BookProject
  │
  ├── LayoutSettings          (1:1) — Formato, tipografía, estilos, TOC, header/footer
  │
  ├── DocumentSection[]       (1:N) — Capítulos, prólogos, portadas, etc.
  │   └── DocumentBlock[]     (1:N) — Unidades de contenido dentro de cada sección
  │
  ├── Asset[]                 (1:N) — Imágenes importadas
  │
  └── ExportJob[]             (1:N) — Historial de exportaciones
```

### Tipos de sección (`SectionType`)
`COVER`, `BACK_COVER`, `BLANK`, `TITLE_PAGE`, `CREDITS`, `RIGHTS`, `DEDICATION`,
`TOC`, `PREFACE`, `PROLOGUE`, `CHAPTER`, `EPILOGUE`, `APPENDIX`, `AUTHOR_NOTE`,
`BIBLIOGRAPHY`, `INDEX_ANALYTICAL`, `COLOPHON`, `SPECIAL`

### Tipos de bloque (`BlockType`)
| Tipo | Descripción | Superficie de edición |
|---|---|---|
| `HEADING_1`–`4` | Títulos jerárquicos | Campo corto |
| `PARAGRAPH` | Texto corrido | Textarea grande |
| `QUOTE` | Cita o bloque destacado | Textarea grande |
| `CENTERED_PHRASE` | Dedicatoria, epígrafe | Textarea mediana |
| `IMAGE` | Imagen con caption y alt | Inspector visual |
| `SEPARATOR` | Línea divisoria | Sin texto |
| `PAGE_BREAK` | Salto de página explícito | Sin texto |
| `CHAPTER_OPENING` | Hero de apertura de capítulo (imagen + texto posicionado) | Inspector estructurado |
| `TITLE_PAGE` | Portadilla con slots fijos (serie, título, autor, editorial) | Inspector estructurado |

### Esquema SQLite (tablas activas)

| Tabla | Descripción |
|---|---|
| `app_settings` | Preferencias clave/valor de la aplicación |
| `book_projects` | Metadatos del libro (título, autor, idioma) |
| `document_sections` | Secciones del libro con tipo, orden, opciones TOC |
| `document_blocks` | Bloques de contenido con tipo, texto, contentJson, layout |
| `assets` | Imágenes importadas con ruta de almacenamiento |
| `layout_settings` | Geometría, tipografía, estilos JSON, configuración editorial |
| `export_jobs` | Historial de exportaciones con estado y ruta de salida |

---

## 6. Sistema de estilos editoriales

Los estilos viven en `layout_settings.styles_json` como un `BookStyleMap` JSON serializado.

### Roles tipográficos (`BookStyleRole`)
`TITLE`, `HEADING_1`, `HEADING_2`, `HEADING_3`, `HEADING_4`,
`PARAGRAPH`, `QUOTE`, `CENTERED_PHRASE`, `TOC_ENTRY`,
`CHAPTER_OPENING_LABEL`, `CHAPTER_OPENING_TITLE`

### Propiedades por rol (`BookStyleDefinition`)

| Propiedad | Tipo | Descripción |
|---|---|---|
| `fontSize` | `number` (pt) | Tamaño de fuente |
| `lineHeight` | `number` | Interlineado (factor) |
| `textAlign` | `left\|center\|right\|justify` | Alineación |
| `fontWeight` | `400\|500\|600\|700` | Peso de fuente |
| `fontFamily` | `string \| null` | Familia tipográfica (null = heredar del libro) |
| `letterSpacing` | `number` (em) | Espaciado entre letras |
| `textTransform` | `none\|uppercase\|lowercase\|capitalize` | Transformación de texto |
| `marginTop` | `number` (pt) | Espacio antes del bloque |
| `marginBottom` | `number` (pt) | Espacio después del bloque |
| `color` | `string \| null` | Color del texto |
| `maxWidth` | `number \| null` (%) | Ancho máximo del bloque |

---

## 7. Motor de paginación

El motor (`page-layout-engine.ts`) es TypeScript puro que opera con **unidades lógicas** (enteros proporcionales al alto de página):

1. **`computeLayoutEngineMetricsForPreviewWidth`** — traduce geometría física (mm) a píxeles a 96 dpi. Define `pageBodyHeightUnits`, `pageBodyWidthUnits`, `charsPerLine`.
2. **`BrowserPreviewTextMeasurer`** — crea elementos DOM ocultos para medir texto real con la fuente correcta.
3. **`buildPaginatedLayout`** — itera bloques, estima alturas, decide saltos de página, genera `PaginatedBookResult`.
4. **`BookPagedPreview.svelte`** — renderiza el resultado con `transform: scale(zoom)` sobre dimensiones físicas reales (96 dpi), garantizando que 1 página en pantalla = 1 página en PDF.

### Reglas especiales de paginación
- `PAGE_BREAK` → nueva página inmediata
- `CHAPTER_OPENING`, `TITLE_PAGE` → página dedicada (nueva página antes y después)
- `IMAGE` con `fillPage: true` → página dedicada
- `keepTogether`, `pageBreakBefore`, `pageBreakAfter` → controlables por bloque

---

## 8. Sistema de exportación

### Formatos disponibles

| Formato | Motor | Descripción |
|---|---|---|
| **PDF Pantalla** | `printToPDF` + BrowserWindow oculto | Dimensiones configuradas por CSS `@page`, RGB, optimizado para pantalla |
| **PDF Impresión** | `printToPDF` + BrowserWindow oculto | Mismo motor, orientado a formato físico del libro |
| **EPUB** | `jszip` | EPUB 3 reflowable con NCX EPUB 2. TOC navegable, imágenes embebidas |
| **DOCX** | `docx` | Word compatible. Estilos de párrafo, headings, imágenes embebidas |
| **Markdown** | Serialización pura JS | Frontmatter YAML, un archivo con todas las secciones |

### Flujo PDF (export-render)
```
exportPdf(bookId, format)
  → createExportJob (status: pending)
  → IPC exports:renderPdf
      → BrowserWindow oculto carga /export-render/[bookId]?format=screen|print
      → Espera window.__exportReady (Promise expuesta por la ruta)
      → win.show() off-screen (activa GPU compositor)
      → printToPDF({ margins: none, printBackground: true })
      → win.destroy()
  → IPC exports:saveFile (dialog nativo)
  → updateExportJob (status: completed, outputPath)
```

---

## 9. Protocolo de media local

Las imágenes del libro se sirven con un protocolo personalizado de Electron:

```
midoo-media://r/{bookId}/{storagePath}
```

- Registrado en `register-media-protocol.ts` antes de que `ready-to-show` se dispare.
- Permite usar las imágenes en el renderer (preview, inspector) y en la ruta de export-render con `fetch()`.
- Almacenadas en `{userData}/midoo-books/assets/{bookId}/`.

---

## 10. Reglas de desacoplamiento

Estas reglas son **no negociables**.

| Capa | Puede importar | NO puede importar |
|---|---|---|
| **Core Editorial** (`src/lib/core/`) | stdlib TS, librerías puras | `fs`, `path`, `electron`, `sql.js`, `svelte`, `$app/*` |
| **App Shell** (`src/routes/`, `src/lib/services/`) | `src/lib/core/`, SvelteKit, `IPlatformAdapter` | `sql.js`, módulos Node.js nativos, `electron` directo |
| **Persistencia** (`src/lib/persistence/`) | `src/lib/core/`, interfaces | SvelteKit `$app/*`, componentes `.svelte` |
| **Electron main** (`electron/`) | `electron`, `sql.js`, `fs`, dominio de `src/lib/core/` | Svelte, SvelteKit, `$app/*` |

---

## 11. Roadmap

### ✅ Completado

**Infraestructura**
- Proyecto Electron + SvelteKit + TypeScript
- sql.js SQLite con migraciones versionadas
- contextBridge (preload) + IPC handlers completos
- Protocolo `midoo-media://` para assets locales
- Build con esbuild + electron-builder

**Módulos de la app**
- `Biblioteca` — listado, creación y gestión de libros
- `Contenido` — editor de secciones y bloques con inspector lateral
  - Todos los tipos de bloque incluyendo `CHAPTER_OPENING` y `TITLE_PAGE`
  - Drag & drop para reordenar secciones y bloques
  - Importación desde Markdown (sección individual o libro completo)
  - Comando `/` para insertar bloques desde el editor inline
- `Assets` — importación, visualización y gestión de imágenes
- `Estilos` — configuración de roles tipográficos (fontSize, fontFamily, textTransform, etc.)
- `Maqueta` — formato físico de página, márgenes, numeración, TOC, cabecera/pie
- `Vista Previa` — preview paginado a dimensiones físicas reales con zoom interactivo
- `Exportar` — 5 formatos (PDF pantalla, PDF impresión, EPUB, DOCX, Markdown) con historial

**Motor editorial**
- Motor de paginación propio con medición DOM
- Zoom de vista previa con `transform: scale()` — 85% por defecto, ajustable
- Sincronización automática de preview al navegar desde cualquier módulo

---

### 🔄 En progreso / Mejoras pendientes

- **Fidelidad preview→PDF**: los `PREVIEW_FLOW_PAD_*` añaden padding extra en la vista previa que no existe en el PDF. Reducirlos mejoraría la correspondencia.
- **Medición por fuente**: el `BrowserPreviewTextMeasurer` usa Georgia como fuente base. Si se configura Courier u otra fuente en el rol, las métricas de paginación son aproximadas.

---

### 🗓️ Próximas fases

**Fase A — Diseño de página avanzado**
- Opción C ampliada: plantillas de sección con slots de posición libre (libre-canvas ligero)
- Soporte de imágenes de fondo por sección (no solo CHAPTER_OPENING)
- Sangrado real en PDF de imprenta (bleed + crop marks)

**Fase B — Distribución multiplataforma**
- Build `.dmg` (macOS) con notarización Apple
- Build `.AppImage` / `.deb` (Linux)
- CI/CD con GitHub Actions (matrix: windows-latest, macos-latest, ubuntu-latest)
- Auto-update vía `electron-updater`

**Fase C — Colaboración y portabilidad**
- Exportar/importar proyecto como `.midoo` (zip con SQLite + assets)
- Historial de versiones simplificado (snapshot por guardado)
- Modo web (SvelteKit puro con File System Access API para demo/colaboración)

**Fase D — Capacidades editoriales avanzadas**
- Sistema de plantillas de libro reutilizables
- Estilos de párrafo adicionales: letra capital, verso/poesía, nota al pie
- Generación de ISBN/barcode embebible en contraportada
- Preflight report para PDF de imprenta

---

## 12. Estado actual (2026-05-30)

| Módulo | Estado | Notas |
|---|---|---|
| Electron + SvelteKit | ✅ Funcionando | Puerto 5178, build con esbuild |
| sql.js SQLite | ✅ Funcionando | Migraciones v1–v11 |
| Biblioteca (CRUD libros) | ✅ Funcionando | |
| Editor de contenido | ✅ Funcionando | 13 tipos de bloque |
| Assets | ✅ Funcionando | Protocolo midoo-media:// |
| Estilos editoriales | ✅ Funcionando | fontFamily, textTransform incluidos |
| Maqueta (layout) | ✅ Funcionando | Preset A5/Trade/Carta/A4 + personalizado |
| Vista previa paginada | ✅ Funcionando | Zoom físico 40%–150% |
| Exportación PDF | ✅ Funcionando | printToPDF vía export-render |
| Exportación EPUB | ✅ Funcionando | EPUB3 + NCX, imágenes embebidas |
| Exportación DOCX | ✅ Funcionando | Packer.toBlob() (renderer-compatible) |
| Exportación Markdown | ✅ Funcionando | Frontmatter YAML |
| Bloque TITLE_PAGE | ✅ Funcionando | 5 slots posicionados |
| Mac / Linux builds | ❌ Pendiente | Fase B |
| Auto-update | ❌ Pendiente | Fase B |
| Plantillas reutilizables | ❌ Pendiente | Fase D |
