/**
 * src/lib/core/domain/asset.ts
 *
 * Entidad Asset.
 *
 * Un Asset es cualquier recurso binario asociado a un libro:
 * imagen de portada, ilustraciones, fuentes embebidas, etc.
 *
 * storagePath: ruta relativa al directorio de assets del libro.
 * En Fase 1 los assets viven en el filesystem local.
 * En fases futuras podrían migrar a un almacenamiento remoto.
 */

declare const AssetIdBrand: unique symbol;
export type AssetId = string & { readonly [AssetIdBrand]: never };

export function asAssetId(id: string): AssetId {
  return id as AssetId;
}

// ─── Tipo de asset ────────────────────────────────────────────────────────────

export type AssetType =
  | 'cover_image'    // Imagen de portada
  | 'illustration'   // Ilustración interior
  | 'font'           // Fuente tipográfica
  | 'background'     // Imagen de fondo de sección
  | 'logo'           // Logo del autor / editorial
  | 'other';         // Recurso genérico

// ─── Entidad Asset ────────────────────────────────────────────────────────────

export interface Asset {
  id:            AssetId;
  bookId:        string;         // FK → BookProject.id
  assetType:     AssetType;
  filename:      string;         // Nombre en disco (sanitized)
  originalName:  string;         // Nombre original al subir
  mimeType:      string;         // ej. 'image/jpeg', 'font/woff2'
  fileExt:       string;         // ej. '.jpg', '.woff2'
  fileSizeBytes: number;
  widthPx:       number | null;  // Solo para imágenes
  heightPx:      number | null;  // Solo para imágenes
  storagePath:   string;         // Ruta relativa desde el userData dir
  checksum:      string;         // SHA-256 del archivo (integridad)
  altText:       string;         // Texto alternativo (accesibilidad)
  createdAt:     string;
  updatedAt:     string;
}

// ─── Payloads ─────────────────────────────────────────────────────────────────

export interface CreateAssetInput {
  bookId:        string;
  assetType:     AssetType;
  filename:      string;
  originalName:  string;
  mimeType:      string;
  fileExt:       string;
  fileSizeBytes: number;
  widthPx?:      number | null;
  heightPx?:     number | null;
  storagePath:   string;
  checksum:      string;
  altText?:      string;
}

export interface UpdateAssetInput {
  altText?:  string;
  assetType?: AssetType;
}
