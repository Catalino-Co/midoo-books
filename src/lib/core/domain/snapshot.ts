/**
 * src/lib/core/domain/snapshot.ts
 *
 * Entidad Snapshot.
 *
 * Un Snapshot es una captura inmutable del estado completo de un libro
 * en un momento dado. Sirve como historial de versiones simplificado.
 *
 * dataJson: serialización JSON del BookProject completo, incluyendo
 *           sus secciones y bloques en ese momento.
 *
 * En Fase 2 los snapshots se crean manualmente ("Guardar versión").
 * En fases futuras se pueden crear automáticamente antes de operaciones
 * destructivas o en intervalos periódicos.
 */

declare const SnapshotIdBrand: unique symbol;
export type SnapshotId = string & { readonly [SnapshotIdBrand]: never };

// ─── Tipo de snapshot ─────────────────────────────────────────────────────────

export type SnapshotType =
  | 'manual'     // Creado explícitamente por el usuario
  | 'auto'       // Creado automáticamente por la app
  | 'pre_export' // Creado antes de una exportación
  | 'pre_delete'; // Creado antes de borrar contenido

// ─── Entidad Snapshot ─────────────────────────────────────────────────────────

export interface Snapshot {
  id:           SnapshotId;
  bookId:       string;         // FK → BookProject.id
  snapshotType: SnapshotType;
  label:        string;         // Nombre descriptivo (ej. "Antes de refactoring cap.3")
  dataJson:     string;         // JSON completo del libro en ese momento
  createdAt:    string;         // Los snapshots son inmutables, no tienen updatedAt
}

// ─── Payloads ─────────────────────────────────────────────────────────────────

export interface CreateSnapshotInput {
  bookId:       string;
  snapshotType: SnapshotType;
  label:        string;
  dataJson:     string;
}
