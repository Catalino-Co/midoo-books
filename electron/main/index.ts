/**
 * electron/main/index.ts
 *
 * Proceso principal de Electron (main process).
 *
 * Responsabilidades de este archivo:
 *   1. Crear la ventana principal de la aplicación
 *   2. Inicializar la base de datos antes de mostrar la UI
 *   3. Registrar los handlers IPC
 *   4. Gestionar el ciclo de vida de la app (arranque, foco, cierre)
 *
 * Lo que NO hace este archivo:
 *   - Lógica editorial (layouts, parsing, TOC) → src/lib/core/
 *   - Acceso directo a la BD → electron/database/
 *   - Lógica de negocio → src/lib/core/
 */

import { app, BrowserWindow, protocol, shell } from 'electron';
import { join } from 'path';
import { openDatabase, closeDatabase } from '../database/connection';
import { registerAllHandlers } from '../ipc/index';
import { registerMidooMediaProtocol } from './register-media-protocol';

protocol.registerSchemesAsPrivileged([
  {
    scheme:     'midoo-media',
    privileges: {
      standard:         true,
      secure:           true,
      supportFetchAPI:  true,
      corsEnabled:      true,
    },
  },
]);

// Detectar si estamos en modo desarrollo
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// URL del servidor de desarrollo de Vite
const DEV_URL = 'http://localhost:5178';

let mainWindow: BrowserWindow | null = null;

// ─── Creación de ventana ────────────────────────────────────────────────────

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    title: 'MIDOO Books',
    // Color de fondo igual al de la app para evitar flash blanco al cargar
    backgroundColor: '#1a1a2e',
    show: false, // Se muestra cuando esté lista (ver 'ready-to-show')
    webPreferences: {
      // Ruta al script de preload compilado por esbuild
      preload: join(__dirname, 'preload.cjs'),
      // Aislamiento de contexto: el renderer no tiene acceso a APIs de Node
      contextIsolation: true,
      // Node.js desactivado en el renderer (seguridad)
      nodeIntegration: false,
      // Sandbox desactivado solo porque el preload accede a ipcRenderer.
      // Si en el futuro el preload no necesita Node, activar sandbox: true.
      sandbox: false,
    },
  });

  // En desarrollo: cargar el servidor de Vite y abrir DevTools
  if (isDev) {
    mainWindow.loadURL(DEV_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // En producción: cargar el build estático de SvelteKit
    mainWindow.loadFile(join(app.getAppPath(), 'build', 'index.html'));
  }

  // Mostrar la ventana cuando el contenido esté listo.
  // El fallback garantiza que la ventana aparezca aunque ready-to-show
  // no se dispare (ej. fallo de GPU cache con múltiples instancias).
  let shown = false;
  const showOnce = () => {
    if (!shown) { shown = true; mainWindow?.show(); }
  };
  mainWindow.once('ready-to-show', showOnce);
  setTimeout(showOnce, 4000);

  // Abrir los links externos en el browser del sistema, no en Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  console.log(`[Main] Ventana creada (${isDev ? 'desarrollo' : 'producción'})`);
}

// ─── Ciclo de vida de la aplicación ─────────────────────────────────────────

app.whenReady().then(async () => {
  console.log(`[Main] MIDOO Books v${app.getVersion()} iniciando...`);
  console.log(`[Main] Electron ${process.versions.electron}, Node.js ${process.versions.node}`);

  // 1. Inicializar la BD antes de cualquier otra cosa
  try {
    await openDatabase();
  } catch (err) {
    console.error('[Main] Error al inicializar la base de datos:', err);
    // No cerramos la app — la UI puede funcionar sin BD en modo degradado
  }

  // 2. Registrar todos los handlers IPC
  registerAllHandlers();

  // 3. Protocolo local para servir imágenes del libro (PARTE 8)
  registerMidooMediaProtocol();

  // 4. Crear la ventana principal
  createWindow();

  // macOS: re-crear ventana al hacer clic en el ícono del dock
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Cerrar la app cuando todas las ventanas están cerradas (excepto en macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Persistir la BD antes de cerrar
app.on('before-quit', () => {
  closeDatabase();
});
