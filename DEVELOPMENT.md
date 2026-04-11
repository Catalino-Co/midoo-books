# MIDOO Books — Guía de Desarrollo

## Requisitos previos

- Node.js 18+ (probado con v24.12.0)
- npm 9+
- Windows 10/11 x64 (para el build de distribución)

## Instalación

```bash
npm install
```

> **Nota sobre sql.js**: el proyecto usa `sql.js` (SQLite en WASM puro) en lugar de
> `better-sqlite3` para evitar la necesidad de herramientas de compilación nativa
> (Visual Studio SDK, node-gyp). En Fase 2 se evaluará migrar a `better-sqlite3`
> cuando los prebuilds para Node.js 20 de Electron estén disponibles.

---

## Scripts disponibles

| Script | Descripción |
|---|---|
| `npm run dev` | Inicia web + Electron en modo desarrollo |
| `npm run dev:web` | Solo servidor Vite (http://localhost:5173) |
| `npm run build:electron` | Compila TypeScript de Electron → `dist-electron/` |
| `npm run dev:electron` | Inicia Electron (requiere servidor web activo) |
| `npm run build` | Build completo (SvelteKit + Electron bundles) |
| `npm run dist` | Genera instalador .exe para Windows |
| `npm run typecheck` | Verifica tipos TypeScript del App Shell |

---

## Modo desarrollo

### Opción A — Todo en un comando (recomendado)

```bash
npm run dev
```

Esto ejecuta en paralelo:
1. `vite dev --port 5173` — servidor SvelteKit
2. Compila los archivos TypeScript de Electron a `dist-electron/`
3. Espera a que el servidor responda en `http://localhost:5173`
4. Lanza Electron apuntando al servidor Vite

### Opción B — Procesos separados

```bash
# Terminal 1: servidor web
npm run dev:web

# Terminal 2: compilar y lanzar Electron
npm run build:electron && npm run dev:electron
```

Para recargar Electron después de cambios en `electron/`:
```bash
npm run build:electron   # recompila
# Luego cierra y vuelve a abrir la ventana Electron
```

---

## Estructura del proyecto

```
midoo-books/
│
├── electron/                  ← Proceso principal (TypeScript → CJS)
│   ├── main/index.ts          Ventana principal, ciclo de vida de la app
│   ├── preload/index.ts       contextBridge → window.electronAPI
│   ├── ipc/                   Handlers de comunicación main ↔ renderer
│   │   └── handlers/
│   │       ├── app.handlers.ts   IPC de info de la app
│   │       ├── db.handlers.ts    IPC de base de datos
│   │       └── fs.handlers.ts    IPC de sistema de archivos
│   └── database/
│       ├── connection.ts      Inicialización de sql.js
│       └── migrations.ts      Esquema y migraciones
│
├── src/                       ← App Shell (SvelteKit)
│   ├── lib/
│   │   ├── core/              Tipos del dominio editorial (TypeScript puro)
│   │   ├── persistence/       Adapters: ElectronAdapter, WebAdapter
│   │   └── shared/            Constantes compartidas
│   └── routes/                Rutas SvelteKit
│
├── dist-electron/             ← Compilados de Electron (generado, no commitear)
│   ├── main.cjs
│   └── preload.cjs
│
├── build/                     ← Build estático SvelteKit (generado)
└── scripts/
    └── build-electron.mjs     Script de compilación con esbuild
```

---

## Verificar que todo funciona

### 1. Compilar Electron manualmente

```bash
npm run build:electron
```

Debe mostrar:
```
[esbuild] ✓ preload → ./dist-electron/preload.cjs
[esbuild] ✓ main process → ./dist-electron/main.cjs
[esbuild] Build completo.
```

### 2. Verificar la base de datos

Después de arrancar Electron al menos una vez (`npm run dev`), la BD se crea en:

- **Windows**: `%APPDATA%\midoo-books\midoo-books.db`
- **macOS**: `~/Library/Application Support/midoo-books/midoo-books.db`
- **Linux**: `~/.config/midoo-books/midoo-books.db`

Puedes inspeccionar el archivo con cualquier visor de SQLite (DB Browser for SQLite, etc.)
o con el script de verificación incluido:

```bash
node scripts/verify-db.mjs
```

### 3. Verificar IPC desde la consola de DevTools

Con Electron corriendo en modo dev, abre DevTools (se abre automáticamente)
y ejecuta en la consola del renderer:

```javascript
// Verificar conexión a la BD
const result = await window.electronAPI.db.ping();
console.log(result);
// → { ok: true, message: "SQLite 3.x.x — conexión activa." }

// Leer todas las preferencias
const settings = await window.electronAPI.db.getAllSettings();
console.log(settings);
// → { appVersion: "0.1.0", theme: "dark", ... }

// Escribir una preferencia
await window.electronAPI.db.setSetting('testKey', 'hola mundo');
const val = await window.electronAPI.db.getSetting('testKey');
console.log(val);
// → "hola mundo"

// Info de la app
const version = await window.electronAPI.app.getVersion();
console.log(version);
// → "0.1.0"

const platform = await window.electronAPI.app.getPlatform();
console.log(platform);
// → "win32"
```

### 4. Indicador visual de modo desktop

Cuando la app corre dentro de Electron, aparece un badge pequeño en la esquina
inferior izquierda: **⚡ Desktop v0.1.0**

---

## Build de distribución (Windows)

```bash
npm run dist
```

Genera un instalador NSIS en `release/`:
- `MIDOO Books Setup 0.1.0.exe` — instalador para usuarios finales

> Requiere que la variable `ELECTRON_BUILDER_CACHE` o la red de internet esté
> disponible para descargar las herramientas de firma de Electron.

---

## Capas y reglas de importación

| Capa | Puede importar | No puede importar |
|---|---|---|
| `electron/` | Node.js, `electron`, `sql.js` | Svelte, SvelteKit, DOM |
| `src/lib/core/` | TypeScript puro | Todo lo demás |
| `src/lib/persistence/` | `core/`, interfaces | SvelteKit `$app/*` |
| `src/routes/` | Todo de `src/lib/` | `electron`, `sql.js` |

---

## FAQ

**¿Por qué no se usa better-sqlite3?**
Node.js 24 (el sistema host) no tiene prebuilds disponibles para better-sqlite3
y compilar desde fuente requiere el Windows SDK. sql.js es idéntico en funcionalidad
para nuestro caso de uso y funciona en cualquier entorno sin compilación.

**¿La app web (solo Vite) sigue funcionando?**
Sí. `npm run dev:web` sigue funcionando exactamente igual que antes de integrar Electron.

**¿Cómo agrego un nuevo canal IPC?**
1. Crea `electron/ipc/handlers/miFeature.handlers.ts`
2. Exporta `registerMiFeatureHandlers()`
3. Importa y llama en `electron/ipc/index.ts`
4. Expón el método en `electron/preload/index.ts`
5. Actualiza el tipo en `src/lib/persistence/adapters/electron.d.ts`
