/**
 * electron/preload/index.ts
 *
 * Puente seguro entre el renderer (SvelteKit) y el proceso principal.
 * contextBridge.exposeInMainWorld() es el único mecanismo seguro de comunicación.
 *
 * Principios de seguridad:
 *   - contextIsolation: true → el renderer no tiene acceso a Node.js
 *   - Solo se exponen métodos específicos y tipados, nunca ipcRenderer completo
 *   - Los parámetros son primitivos o plain objects serializables por JSON
 */

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {

  // ── Información de la app ─────────────────────────────────────────────────
  app: {
    getVersion:      () => ipcRenderer.invoke('app:getVersion'),
    getPlatform:     () => ipcRenderer.invoke('app:getPlatform'),
    getUserDataPath: () => ipcRenderer.invoke('app:getUserDataPath'),
  },

  // ── BD: settings y diagnóstico ────────────────────────────────────────────
  db: {
    ping:           ()              => ipcRenderer.invoke('db:ping'),
    getSetting:     (key)           => ipcRenderer.invoke('db:getSetting', key),
    setSetting:     (key, value)    => ipcRenderer.invoke('db:setSetting', key, value),
    getAllSettings:  ()              => ipcRenderer.invoke('db:getAllSettings'),
  },

  // ── Sistema de archivos ───────────────────────────────────────────────────
  fs: {
    readFile:       (path)          => ipcRenderer.invoke('fs:readFile', path),
    listFiles:      (dir, ext)      => ipcRenderer.invoke('fs:listFiles', dir, ext),
    openFilePicker: ()              => ipcRenderer.invoke('fs:openFilePicker'),
  },

  // ── BookProject CRUD ──────────────────────────────────────────────────────
  books: {
    create:   (input)         => ipcRenderer.invoke('books:create', input),
    list:     ()              => ipcRenderer.invoke('books:list'),
    getById:  (id)            => ipcRenderer.invoke('books:getById', id),
    update:   (id, input)     => ipcRenderer.invoke('books:update', id, input),
    delete:   (id)            => ipcRenderer.invoke('books:delete', id),
    count:    ()              => ipcRenderer.invoke('books:count'),
  },

  // ── DocumentSection CRUD ──────────────────────────────────────────────────
  sections: {
    create:      (input)               => ipcRenderer.invoke('sections:create', input),
    listByBook:  (bookId)              => ipcRenderer.invoke('sections:listByBook', bookId),
    getById:     (id)                  => ipcRenderer.invoke('sections:getById', id),
    update:      (id, input)           => ipcRenderer.invoke('sections:update', id, input),
    delete:      (id)                  => ipcRenderer.invoke('sections:delete', id),
    reorder:     (bookId, orderedIds)  => ipcRenderer.invoke('sections:reorder', bookId, orderedIds),
  },

  // ── DocumentBlock CRUD ────────────────────────────────────────────────────
  blocks: {
    create:         (input)                  => ipcRenderer.invoke('blocks:create', input),
    listBySection:  (sectionId)              => ipcRenderer.invoke('blocks:listBySection', sectionId),
    getById:        (id)                     => ipcRenderer.invoke('blocks:getById', id),
    update:         (id, input)              => ipcRenderer.invoke('blocks:update', id, input),
    delete:         (id)                     => ipcRenderer.invoke('blocks:delete', id),
    reorder:        (sectionId, orderedIds)  => ipcRenderer.invoke('blocks:reorder', sectionId, orderedIds),
  },

  // ── Assets (imágenes por libro) — PARTE 8 ─────────────────────────────────
  assets: {
    listByBook:    (bookId)                 => ipcRenderer.invoke('assets:listByBook', bookId),
    getById:       (id)                     => ipcRenderer.invoke('assets:getById', id),
    update:        (id, input)              => ipcRenderer.invoke('assets:update', id, input),
    delete:        (id)                     => ipcRenderer.invoke('assets:delete', id),
    pickAndImport: (bookId)                 => ipcRenderer.invoke('assets:pickAndImport', bookId),
    importPaths:   (bookId, paths)          => ipcRenderer.invoke('assets:importPaths', bookId, paths),
  },

  layout: {
    getByBookId:    (bookId)                => ipcRenderer.invoke('layout:getByBookId', bookId),
    updateByBookId: (bookId, input)         => ipcRenderer.invoke('layout:updateByBookId', bookId, input),
  },

  // ── Exportación ───────────────────────────────────────────────────────────
  exports: {
    create:        (input)                    => ipcRenderer.invoke('exports:create', input),
    update:        (id, updates)              => ipcRenderer.invoke('exports:update', id, updates),
    listByBook:    (bookId, limit)            => ipcRenderer.invoke('exports:listByBook', bookId, limit),
    clearHistory:  (bookId)                   => ipcRenderer.invoke('exports:clearHistory', bookId),
    renderPdf:     (bookId, opts)             => ipcRenderer.invoke('exports:renderPdf', bookId, opts),
    saveFile:      (buffer, name, filters)    => ipcRenderer.invoke('exports:saveFile', buffer, name, filters),
  },

});
