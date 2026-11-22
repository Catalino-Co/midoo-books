/**
 * Servicio de assets (imágenes por libro). El shell solo usa esta capa + getPlatformAdapter.
 */

import { getPlatformAdapter } from '$lib/persistence';
import type { Asset, UpdateAssetInput } from '$lib/core/domain/index';

export async function listAssets(bookId: string): Promise<Asset[]> {
  return getPlatformAdapter().listAssetsByBook(bookId);
}

export async function getAsset(id: string): Promise<Asset | null> {
  return getPlatformAdapter().getAssetById(id);
}

export async function updateAsset(id: string, input: UpdateAssetInput): Promise<Asset | null> {
  return getPlatformAdapter().updateAsset(id, input);
}

export async function deleteAsset(id: string): Promise<boolean> {
  return getPlatformAdapter().deleteAsset(id);
}

export async function pickAndImportAssets(bookId: string, kind: 'image' | 'font' = 'image'): Promise<Asset[]> {
  return getPlatformAdapter().pickAndImportAssets(bookId, kind);
}

export async function importAssetFiles(bookId: string, paths: string[]): Promise<Asset[]> {
  return getPlatformAdapter().importAssetFiles(bookId, paths);
}

/**
 * URL para <img src> en Electron (protocolo midoo-media registrado en main).
 * Formato: midoo-media://r/{bookId}/{segmentos de ruta codificados}
 */
export function assetDisplayUrl(bookId: string, storagePath: string): string {
  const parts = storagePath.split('/').filter(Boolean).map(encodeURIComponent);
  return `midoo-media://r/${encodeURIComponent(bookId)}/${parts.join('/')}`;
}

export { type Asset, type UpdateAssetInput } from '$lib/core/domain/index';
