# ARCHITECTURE — MIDOO BOOKS

> Documento vivo. Última actualización: 2026-04-11.

---

## 1. Visión del producto

**MIDOO BOOKS** es una herramienta de maquetación editorial de escritorio que permite a autores independientes, diseñadores y pequeñas editoriales crear libros de calidad profesional directamente desde Markdown, sin depender de Canva, InDesign ni herramientas de suscripción.

### Para quién

| Perfil | Necesidad |
|---|---|
| Autor independiente | Escribir en Markdown y obtener un PDF listo para imprimir sin curva técnica |
| Diseñador editorial | Personalizar layouts, tipografía y estilos CSS sin código complejo |
| Pequeña editorial | Gestionar catálogo de títulos con persistencia local y exportación PDF/EPUB |

### Principio rector

> El autor escribe. MIDOO maqueta. El lector lee.

La app nunca debe obligar al autor a pensar en puntos, márgenes ni columnas. La separación contenido/presentación es absoluta: el texto vive en Markdown, el diseño vive en CSS.

---

## 2. Stack tecnológico

| Tecnología | Versión | Rol |
|---|---|---|
| **SvelteKit** | ^2.16 | Framework web / App Shell |
| **Svelte 5** | ^5.25 | UI con runes ($state, $derived, $props) |
| **TypeScript** | ^5.x | Tipado en packages/core y packages/persistence |
| **Vite** | ^6.2 | Bundler para desarrollo y build web |
| **Paged.js** | ^0.4.3 | Motor Web-to-Print (CSS3 Paged Media polyfill) |
| **gray-matter** | ^4.0 | Parsing de YAML frontmatter en archivos .md |
| **marked** | ^13.0 | Conversión Markdown → HTML |
| **Electron** | ^30.x *(Fase 1)* | Shell nativo Windows/Mac/Linux |
| **electron-builder** | ^25.x *(Fase 1)* | Empaquetado e instaladores (.exe, .dmg, .AppImage) |
| **better-sqlite3** | ^9.x *(Fase 1)* | Persistencia local SQLite (síncrono, sin servidor) |
| **npm workspaces** | nativo | Monorepo: packages/core + packages/persistence |

### Por qué estas elecciones

- **Svelte 5 + Runes**: reactividad granular sin overhead, ideal para UI de editor con estado complejo.
- **Paged.js sobre headless Chrome**: funciona en el renderer de Electron sin dependencia de puppeteer. El CSS de impresión es el mismo que el de preview.
- **better-sqlite3 sobre Prisma/Drizzle**: síncrono, sin servidor, cero latencia, ideal para app de escritorio single-user.
- **Electron sobre Tauri**: el renderer SvelteKit puede reutilizarse como app web sin cambios. Tauri requeriría adaptar la capa de archivos a Rust.

---

## 3. Arquitectura de 3 capas

```
┌──────────────────────────────────────────────────────────────────┐
│  CAPA 1 — Core Editorial                                         │
│  packages/core/                                                  │
│                                                                  │
│  TypeScript puro. CERO dependencias de plataforma.              │
│  ✓ BookMeta, Book, Section, Block (tipos)                        │
│  ✓ processMarkdown(rawMd) → { meta, content, headings }         │
│  ✓ buildBookHtml(meta, content, headings) → HTML string         │
│  ✓ slugifyHeading(text) → string                                │
│  ✗ NO: fs, electron, svelte, better-sqlite3, window, document   │
└──────────────────────────┬───────────────────────────────────────┘
                           │  importa tipos + funciones puras
┌──────────────────────────▼───────────────────────────────────────┐
│  CAPA 2 — App Shell                                              │
│  src/  (SvelteKit)  +  electron/ (proceso principal)            │
│                                                                  │
│  ✓ Componentes Svelte, routing, Paged.js, toolbar, editor       │
│  ✓ Comunica con Capa 3 exclusivamente vía IPlatformAdapter      │
│  ✗ NO importa better-sqlite3 directamente                       │
│  ✗ NO accede a fs directamente (usa adapter)                    │
└──────────────────────────┬───────────────────────────────────────┘
                           │  IBookRepository, IPlatformAdapter
┌──────────────────────────▼───────────────────────────────────────┐
│  CAPA 3 — Persistencia                                           │
│  packages/persistence/                                           │
│                                                                  │
│  ✓ SQLite: BookRepository, SectionRepository                    │
│  ✓ ElectronAdapter (IPC → main process → fs)                   │
│  ✓ WebAdapter (File System Access API, fallback web)            │
│  ✗ NO importa módulos de SvelteKit ($app/...)                   │
│  ✗ NO importa componentes Svelte                                │
└──────────────────────────────────────────────────────────────────┘
```

### Flujo de datos (render de un libro)

```
.md file / SQLite
      │
      ▼
processMarkdown()    ← packages/core
      │
      ▼
buildBookHtml()      ← packages/core
      │
      ▼
Paged.js Previewer   ← App Shell (browser/renderer)
      │
      ▼
.pagedjs_page DOM nodes → UI editor (thumbnails, spreads, zoom)
      │
      ▼
window.print()       → PDF
```

---

## 4. Estructura de carpetas (objetivo)

```
midoo-books/
│
├── ARCHITECTURE.md              ← este archivo
├── package.json                 ← monorepo root (npm workspaces)
├── svelte.config.js
├── vite.config.js (o .ts)
│
├── packages/
│   │
│   ├── core/                    ← CAPA 1
│   │   ├── package.json         (name: "@midoo/core")
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── types.ts         Book, BookMeta, Section, BookId
│   │       ├── processMarkdown.ts
│   │       ├── buildBookHtml.ts
│   │       └── slugify.ts
│   │
│   └── persistence/             ← CAPA 3
│       ├── package.json         (name: "@midoo/persistence")
│       ├── tsconfig.json
│       └── src/
│           ├── interfaces.ts    IBookRepository, ISectionRepository
│           ├── adapters/
│           │   ├── IPlatformAdapter.ts
│           │   ├── ElectronAdapter.ts
│           │   └── WebAdapter.ts
│           └── sqlite/
│               ├── BookRepository.ts
│               ├── SectionRepository.ts
│               └── schema.sql
│
├── electron/                    ← proceso principal Electron (Fase 1)
│   ├── main.ts
│   ├── preload.ts               contextBridge → window.electronAPI
│   └── ipc/
│       └── bookHandlers.ts
│
├── src/                         ← CAPA 2 (SvelteKit — App Shell)
│   ├── app.html
│   ├── app.css
│   ├── lib/
│   │   ├── platform.ts          getPlatformAdapter() factory
│   │   └── utils/
│   │       └── processMarkdown.js  (existente, hasta Fase 0)
│   └── routes/
│       ├── +page.svelte         home: lista de libros
│       └── book/[slug]/
│           ├── +page.svelte     editor de maquetación
│           └── +page.server.js
│
├── static/
│   └── book-styles.css          estilos Web-to-Print (Paged.js)
│
└── content/                     archivos .md (hasta Fase 1, luego SQLite)
    └── ejemplo-libro.md
```

---

## 5. Interfaces y contratos

### Tipos principales (`packages/core/src/types.ts`)

```typescript
// Branded type — evita confundir IDs entre entidades
declare const BookIdBrand: unique symbol;
export type BookId = string & { readonly [BookIdBrand]: never };

export interface BookMeta {
  title:       string;
  subtitle:    string;
  author:      string;
  layout:      'Standard' | 'FullImage';
  variant:     'light' | 'dark';
  pageSize:    'A5' | 'Letter';
  language:    string;
  description: string;
  coverImage:  string | null;
}

export interface Book {
  id:          BookId;
  slug:        string;
  meta:        BookMeta;
  rawMarkdown: string;
  createdAt:   Date;
  updatedAt:   Date;
}

export interface Section {
  id:    string;
  level: 1 | 2;
  text:  string;
  slug:  string;
}

// Resultado de processMarkdown()
export interface ParsedBook {
  meta:     BookMeta;
  content:  string;   // HTML
  headings: Section[];
}
```

### Repositorios (`packages/persistence/src/interfaces.ts`)

```typescript
import type { Book, BookId } from '@midoo/core';

export interface IBookRepository {
  findBySlug(slug: string): Promise<Book | null>;
  findAll():                Promise<Book[]>;
  save(book: Book):         Promise<Book>;
  delete(id: BookId):       Promise<void>;
}

export interface ISectionRepository {
  findByBook(bookId: BookId): Promise<Section[]>;
  saveAll(bookId: BookId, sections: Section[]): Promise<void>;
}
```

### Platform Adapter (`packages/persistence/src/adapters/IPlatformAdapter.ts`)

```typescript
export interface IPlatformAdapter {
  readFile(path: string):                    Promise<string>;
  writeFile(path: string, content: string):  Promise<void>;
  listFiles(dir: string, ext: string):       Promise<string[]>;
  openFilePicker():                          Promise<string | null>;
  showSaveDialog(defaultName: string):       Promise<string | null>;
}
```

### Factory de plataforma (`src/lib/platform.ts`)

```typescript
import type { IPlatformAdapter } from '@midoo/persistence';

export async function getPlatformAdapter(): Promise<IPlatformAdapter> {
  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    const { ElectronAdapter } = await import('@midoo/persistence/adapters/ElectronAdapter');
    return new ElectronAdapter((window as any).electronAPI);
  }
  const { WebAdapter } = await import('@midoo/persistence/adapters/WebAdapter');
  return new WebAdapter();
}
```

### Electron preload (contextBridge, `electron/preload.ts`)

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  readFile:   (path: string) =>
    ipcRenderer.invoke('fs:readFile', path),
  writeFile:  (path: string, content: string) =>
    ipcRenderer.invoke('fs:writeFile', path, content),
  listFiles:  (dir: string, ext: string) =>
    ipcRenderer.invoke('fs:listFiles', dir, ext),
  openPicker: () =>
    ipcRenderer.invoke('dialog:openFile'),
  saveDialog: (name: string) =>
    ipcRenderer.invoke('dialog:saveFile', name),
});
```

---

## 6. Reglas de desacoplamiento

Estas reglas son **no negociables**. Un PR que las viole debe ser rechazado.

| Capa | Puede importar | NO puede importar |
|---|---|---|
| **Core Editorial** (`packages/core`) | stdlib TS, librerías puras (gray-matter, marked) | `fs`, `path`, `electron`, `better-sqlite3`, `svelte`, DOM APIs (`window`, `document`) |
| **App Shell** (`src/`) | `@midoo/core`, SvelteKit, Svelte, Paged.js, `IPlatformAdapter` | `better-sqlite3`, módulos Node.js nativos, `electron` directo |
| **Persistencia** (`packages/persistence`) | `@midoo/core`, `better-sqlite3`, `fs`, `path` | Módulos de SvelteKit (`$app/...`), componentes `.svelte`, Paged.js |
| **Electron main** (`electron/`) | `electron`, `better-sqlite3`, `fs`, `@midoo/persistence` | Svelte, SvelteKit, Paged.js |

### Cómo verificarlo

```bash
# El Core no debe tener dependencias de runtime más allá de gray-matter y marked
cat packages/core/package.json | grep dependencies

# Buscar imports prohibidos en Core
grep -r "from 'fs'" packages/core/src/
grep -r "from 'electron'" packages/core/src/
```

---

## 7. Roadmap técnico

### Fase 0 — Estructura TypeScript *(próxima)*

**Objetivo:** monorepo funcional con Core tipado. La app web debe seguir corriendo sin cambios visibles.

- [ ] Agregar `workspaces` al `package.json` raíz
- [ ] Crear `packages/core/` con `tsconfig.json` + `package.json`
- [ ] Migrar `processMarkdown.js` → `packages/core/src/processMarkdown.ts`
- [ ] Extraer `buildBookHtml()` de `+page.svelte` → `packages/core/src/buildBookHtml.ts`
- [ ] Definir todos los tipos en `packages/core/src/types.ts`
- [ ] Actualizar `+page.svelte` y `+page.server.js` para importar desde `@midoo/core`
- [ ] Verificar `npm run dev` y `npm run build` sin errores

**Criterio de éxito:** `packages/core/src/` no tiene ningún import de `fs`, `electron` ni `svelte`.

---

### Fase 1 — MVP Desktop Windows *(~4 semanas)*

**Objetivo:** instalador `.exe` funcional con apertura de archivos .md desde el sistema de archivos local.

- [ ] Instalar `electron`, `electron-builder`, `concurrently`
- [ ] Crear `electron/main.ts` (BrowserWindow apuntando al renderer SvelteKit)
- [ ] Crear `electron/preload.ts` (contextBridge con electronAPI)
- [ ] Crear `electron/ipc/bookHandlers.ts` (handlers fs:readFile, fs:listFiles, dialog:openFile)
- [ ] Implementar `ElectronAdapter` en `packages/persistence/`
- [ ] Crear `packages/persistence/src/sqlite/schema.sql` y `BookRepository.ts`
- [ ] Reemplazar `+page.server.js` (SSR) por `getPlatformAdapter()` en cliente cuando corre en Electron
- [ ] Configurar `electron-builder` para generar `.exe` NSIS
- [ ] Prueba en Windows: abrir libro, navegar páginas, exportar PDF

**Criterio de éxito:** un usuario sin Node.js instalado puede instalar y usar MIDOO BOOKS en Windows.

---

### Fase 2 — Editor Estructurado *(~6 semanas)*

**Objetivo:** CRUD completo de libros desde la app, sin editar .md manualmente.

- [ ] Panel de propiedades con edición de todos los campos `BookMeta`
- [ ] Editor de secciones/capítulos (agregar, reordenar, eliminar)
- [ ] Importar .md existente → parsear → guardar en SQLite
- [ ] Exportar libro como .md (round-trip)
- [ ] Historial de versiones simplificado (snapshot por guardado)
- [ ] Home: biblioteca de libros con miniatura de portada

**Criterio de éxito:** flujo completo sin tocar el sistema de archivos manualmente.

---

### Fase 3 — Mac / Linux *(~3 semanas)*

**Objetivo:** misma experiencia en las 3 plataformas principales.

- [ ] Certificado de firma para macOS (notarización Apple)
- [ ] Build `.dmg` (macOS) y `.AppImage`/`.deb` (Linux)
- [ ] Ajustes de paths multiplataforma (`path.join`, no hardcoded `/`)
- [ ] CI/CD con GitHub Actions (build matrix: windows-latest, macos-latest, ubuntu-latest)
- [ ] Auto-update via `electron-updater`

**Criterio de éxito:** el mismo código fuente genera instaladores nativos para los 3 sistemas operativos.

---

### Fase 4 — Capacidades avanzadas *(roadmap largo plazo)*

- [ ] Sistema de plantillas (templates de layout reutilizables)
- [ ] Exportación EPUB (epub.js o Calibre CLI)
- [ ] Colaboración: exportar/importar proyecto como `.midoo` (zip)
- [ ] Capacitor (evaluación para Android/iOS) — requiere adaptar renderer a mobile
- [ ] Modo web (SvelteKit puro con File System Access API) — opcional

---

## 8. Principios técnicos

Estas decisiones guían cada elección de implementación.

### 1. Contenido y presentación son mundos separados
El Markdown define el contenido. El CSS define la apariencia. La app nunca mezcla ambos en el mismo artefacto. `buildBookHtml()` en Core construye el HTML; `book-styles.css` define cómo se ve. Nunca hay estilos inline en el HTML generado.

### 2. El Core no sabe que existe una UI
`packages/core` debe poder ejecutarse en un script de Node.js puro, en un test unitario, o en un worker sin browser. Esto garantiza testabilidad y portabilidad.

### 3. Paged.js es un detalle de implementación del App Shell
El resto de la app solo conoce "páginas HTML". Paged.js transforma ese HTML en páginas físicas. Si mañana Paged.js se reemplaza por otra herramienta, solo cambia el App Shell, no el Core ni la Persistencia.

### 4. SQLite es local-first
No hay servidor, no hay cloud, no hay cuenta de usuario. Los datos del autor son del autor y viven en su máquina. La sincronización en la nube es una característica futura opt-in, no una dependencia.

### 5. Electron es un detalle de empaquetado
El renderer SvelteKit no sabe si está dentro de Electron o en un browser. `getPlatformAdapter()` es el único punto de entrada al mundo nativo. Esto permite correr la app en web sin Electron para demos o colaboración ligera.

### 6. Tipado estricto en las fronteras entre capas
Las interfaces (`IBookRepository`, `IPlatformAdapter`) son contratos tipados. Los adaptadores concretos implementan esos contratos. El App Shell solo programa contra las interfaces, nunca contra implementaciones concretas.

### 7. DOM de Paged.js es inmutable para la app
Una vez que Paged.js renderiza las páginas, la app solo modifica `display`, `float` y `margin` de los nodos `.pagedjs_page`. Nunca `remove()`, `cloneNode()`, ni atributos internos. Paged.js mantiene referencias internas que se corrompen con manipulación directa del DOM.

---

## Estado actual (Fase pre-0)

| Elemento | Estado |
|---|---|
| SvelteKit + Svelte 5 | ✅ Funcionando |
| Paged.js (preview + navegación) | ✅ Funcionando |
| Toolbar + thumbnails + panel propiedades | ✅ Funcionando |
| gray-matter + marked | ✅ Funcionando |
| book-styles.css (Web-to-Print) | ✅ Funcionando |
| TypeScript en el proyecto | ❌ No configurado |
| packages/core | ❌ No existe |
| packages/persistence | ❌ No existe |
| Electron | ❌ No configurado |
| SQLite | ❌ No configurado |
| tsconfig.json | ❌ No existe |
