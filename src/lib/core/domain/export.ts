/**
 * src/lib/core/domain/export.ts
 *
 * Entidad ExportJob.
 *
 * Un ExportJob registra el historial y el estado de cada exportación
 * realizada sobre un libro. Es un registro de auditoría inmutable.
 *
 * En Fase 2 solo PDF (via window.print()) es soportado.
 * Las demás opciones están previstas para fases futuras.
 */

declare const ExportJobIdBrand: unique symbol;
export type ExportJobId = string & { readonly [ExportJobIdBrand]: never };

// ─── Enumeraciones ────────────────────────────────────────────────────────────

/**
 * Formato de salida del export.
 * - pdf:  Via Paged.js + window.print() (Fase 2)
 * - epub: ePub 3.x (futuro)
 * - odt:  OpenDocument Text (futuro)
 * - html: HTML estático (futuro)
 */
export type ExportType = 'pdf' | 'epub' | 'odt' | 'html';

/**
 * Estado del proceso de exportación.
 * - pending:   En cola, aún no iniciado
 * - running:   En proceso
 * - completed: Finalizado con éxito
 * - failed:    Terminó con error
 */
export type ExportStatus = 'pending' | 'running' | 'completed' | 'failed';

// ─── Entidad ExportJob ────────────────────────────────────────────────────────

export interface ExportJob {
  id:          ExportJobId;
  bookId:      string;          // FK → BookProject.id
  exportType:  ExportType;
  status:      ExportStatus;
  optionsJson: string | null;   // Opciones de exportación (JSON serializado)
  outputPath:  string | null;   // Ruta del archivo generado
  errorMsg:    string | null;   // Mensaje de error si status='failed'
  createdAt:   string;
  completedAt: string | null;   // null si aún no completó
}

// ─── Payloads ─────────────────────────────────────────────────────────────────

export interface CreateExportJobInput {
  bookId:       string;
  exportType:   ExportType;
  optionsJson?: string | null;
}

export interface UpdateExportJobInput {
  status:       ExportStatus;
  outputPath?:  string | null;
  errorMsg?:    string | null;
  completedAt?: string | null;
}
