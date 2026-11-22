# MIDOO Books

Aplicación de escritorio para **escribir, maquetar y exportar libros** —novelas ilustradas, devocionales, ensayos— con calidad de imprenta y sin depender de InDesign ni de herramientas de suscripción.

> El autor escribe. MIDOO maqueta. El lector lee.

El texto vive en bloques estructurados (párrafos, títulos, citas, imágenes, aperturas de capítulo…) y el diseño en estilos y ajustes de maqueta del libro. Lo que se ve en la vista previa es exactamente lo que sale en el PDF.

---

## Funciones principales

- **Editor de contenido** por secciones (portada, créditos, dedicatoria, índice, capítulos, contraportada… 18 tipos) y bloques (14 tipos), con modos *Escribir* y *Maquetar*, arrastrar y soltar, comando `/` e importación desde Markdown.
- **Maquetación física**: tamaño de página (A5, 6×9", Carta, A4 o personalizado), márgenes espejo, sangrado, folio («7», «— 7 —»…), cabecera, ornamento de pie, fondo de página (papel, cuadrícula o textura) y guionización en español.
- **Diseño editorial**: aperturas de capítulo a sangre, imágenes en el texto con ancho proporcional, separadores con ornamento, etiqueta «Día {n}» autonumerada, cita bíblica, bloques anclados al pie de la página y portadas con texto sobre la ilustración.
- **Estilos** por rol tipográfico (título, H1–H4, párrafo, cita, etiqueta…) y **fuentes propias** (TTF/OTF/WOFF/WOFF2) incrustadas en PDF y EPUB.
- **Plantillas** «Novela ilustrada» y «Devocional» al crear un libro, o solo su diseño sobre un libro existente.
- **Vista previa paginada** a tamaño real con zoom, guías de caja de texto y zona segura.
- **Exportación** a PDF de pantalla, PDF de imprenta (con sangrado al estilo KDP/IngramSpark), EPUB 3, DOCX y Markdown.

## Stack

| Pieza | Tecnología |
|---|---|
| Escritorio | Electron 45 |
| Interfaz | SvelteKit 2 + Svelte 5 (runes), `adapter-static` |
| Lenguaje | TypeScript |
| Base de datos | SQLite con `sql.js` (WASM, sin compilación nativa) y migraciones versionadas |
| Build | Vite (renderer) + esbuild (proceso principal) + electron-builder |
| Exportación | `printToPDF` de Chromium, `jszip` (EPUB), `docx` |
| Pruebas | Vitest |

## Requisitos

- Node.js 18 o superior y npm 9 o superior
- macOS (Apple Silicon o Intel) o Windows 10/11 x64. Linux funciona para desarrollo.

## Puesta en marcha

```bash
npm install
npm run dev
```

`npm run dev` compila el proceso principal, levanta Vite en `http://localhost:5178` y abre Electron apuntando a ese servidor.

> **Al cambiar de sistema (Windows ↔ macOS)** ejecuta `npm ci`: `node_modules/` trae binarios nativos de la plataforma donde se instaló. Detalles y cómo llevar tus libros a otro equipo en [DEVELOPMENT.md](DEVELOPMENT.md).

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Desarrollo: Vite + Electron con recarga del renderer |
| `npm run dev:web` | Solo el servidor Vite (puerto 5178) |
| `npm run build:electron` | Compila `electron/` → `dist-electron/` |
| `npm run build` | Build completo (SvelteKit + Electron) |
| `npm run start:build` | Build y abre Electron cargando la UI por `app://midoo/`, como en producción |
| `npm run pack` | App empaquetada sin instalador en `release/` |
| `npm run dist` | Instalador NSIS para Windows |
| `npm run dist:mac` | `.dmg` para macOS (arm64 + x64, sin firmar); se ejecuta en una Mac |
| `npm test` | Pruebas unitarias (Vitest) |
| `npm run typecheck` | Comprobación de tipos con `tsc` |

Para revisar los componentes Svelte: `npx svelte-check`.

## Estructura

```
midoo-books/
├── electron/                 Proceso principal (Node.js)
│   ├── main/                 Ventana, protocolos app:// y midoo-media://
│   ├── preload/              contextBridge → window.electronAPI
│   ├── ipc/handlers/         Libros, contenido, assets, maqueta, exportación
│   ├── database/             sql.js, migraciones, repositorios
│   └── services/, lib/       Importación de assets, metadatos de fuentes
├── src/
│   ├── lib/core/             Dominio y motor editorial (TypeScript puro)
│   ├── lib/components/       BookPage.svelte (render único de página), preview…
│   ├── lib/services/         Servicios del renderer (contenido, maqueta, exportación, plantillas)
│   ├── lib/persistence/      ElectronAdapter (IPC) y WebAdapter
│   └── routes/               Biblioteca, editor del libro y /export-render (PDF)
├── scripts/                  build-electron.mjs, verify-db.mjs
├── static/                   Recursos estáticos
└── content/                  Libro de ejemplo en Markdown
```

La app está en tres capas: **core** (TypeScript puro), **shell** (SvelteKit + Electron) y **persistencia** (SQLite vía IPC). Las reglas de importación entre capas están en [ARCHITECTURE.md](ARCHITECTURE.md).

## Cómo funciona la maquetación

1. El **motor de paginación** (`src/lib/core/editorial/page-layout-engine.ts`) mide cada bloque en el navegador con el mismo CSS y ancho que el render, y reparte el contenido en páginas: viudas y huérfanas, saltos, aperturas en página par o impar, bloques anclados al pie…
2. **`BookPage.svelte`** es el único componente que dibuja una página. Lo usan la vista previa y la ruta oculta `/export-render`.
3. El PDF se genera con `printToPDF` sobre esa ruta con `@page` al tamaño del libro, así que **vista previa y PDF coinciden**.

Las invariantes que mantienen esa equivalencia están en [ARCHITECTURE.md § 7](ARCHITECTURE.md#7-motor-de-paginación).

## Datos del usuario

La base de datos y las imágenes de cada libro viven fuera del repositorio, en la carpeta de datos de la app:

| Sistema | Carpeta |
|---|---|
| macOS | `~/Library/Application Support/midoo-books/` |
| Windows | `%APPDATA%\midoo-books\` |
| Linux | `~/.config/midoo-books/` |

Las migraciones se aplican solas al abrir la app.

## Documentación

- [ARCHITECTURE.md](ARCHITECTURE.md): capas, dominio, esquema SQLite, motor de paginación, exportación y protocolos.
- [DEVELOPMENT.md](DEVELOPMENT.md): instalación, cambio de equipo, scripts, depuración y FAQ.
- [Instrucciones.md](Instrucciones.md): manual de uso de Maqueta, plantillas, bloques nuevos y anclaje al pie.

## Licencia

Software propietario de MIDOO. Copyright © 2026 MIDOO. Todos los derechos reservados.
