/**
 * src/lib/services/books.service.ts
 *
 * Capa de servicio para la UI.
 * Thin wrapper alrededor de getPlatformAdapter() para que los componentes
 * Svelte no importen el adaptador directamente.
 *
 * Siempre se llama desde el lado cliente (onMount / handlers de eventos).
 */

import { getPlatformAdapter } from '$lib/persistence';
import type {
  BookProject,
  CreateBookProjectInput,
  UpdateBookProjectInput,
} from '$lib/core/domain/index';

// ─── Libros ───────────────────────────────────────────────────────────────────

export async function listBooks(): Promise<BookProject[]> {
  return getPlatformAdapter().listBooks();
}

export async function createBook(input: CreateBookProjectInput): Promise<BookProject> {
  return getPlatformAdapter().createBook(input);
}

export async function getBook(id: string): Promise<BookProject | null> {
  return getPlatformAdapter().getBookById(id);
}

export async function updateBook(
  id: string,
  input: UpdateBookProjectInput,
): Promise<BookProject | null> {
  return getPlatformAdapter().updateBook(id, input);
}

export async function deleteBook(id: string): Promise<boolean> {
  return getPlatformAdapter().deleteBook(id);
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

/** Etiqueta legible para BookStatus */
export function statusLabel(status: BookProject['status']): string {
  const map: Record<BookProject['status'], string> = {
    draft:       'Borrador',
    in_progress: 'En progreso',
    complete:    'Completado',
    archived:    'Archivado',
  };
  return map[status] ?? status;
}

/** Color de acento para cada estado */
export function statusColor(status: BookProject['status']): string {
  const map: Record<BookProject['status'], string> = {
    draft:       'rgba(255,255,255,0.35)',
    in_progress: '#7ab8e8',
    complete:    '#6ecf8e',
    archived:    'rgba(255,255,255,0.2)',
  };
  return map[status] ?? 'rgba(255,255,255,0.35)';
}

/** Formatea una fecha ISO como string legible */
export function formatDate(isoString: string): string {
  try {
    return new Intl.DateTimeFormat('es', {
      day:   '2-digit',
      month: 'short',
      year:  'numeric',
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}
