<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import type { Asset } from '$lib/core/domain/index';
  import {
    listAssets,
    pickAndImportAssets,
    updateAsset,
    deleteAsset,
    assetDisplayUrl,
  } from '$lib/services/assets.service';

  let bookId = $derived($page.params.bookId);

  let assets   = $state<Asset[]>([]);
  let loading  = $state(true);
  let error    = $state<string | null>(null);
  let busy     = $state(false);
  let selected = $state<Asset | null>(null);

  let editAlt     = $state('');
  let editCaption = $state('');

  onMount(() => {
    void refresh();
  });

  $effect(() => {
    if (bookId) void refresh();
  });

  async function refresh() {
    loading = true;
    error   = null;
    try {
      // Las fuentes también son assets, pero se gestionan en Estilos.
      assets = (await listAssets(bookId)).filter(a => a.assetType !== 'font');
      if (selected) {
        selected = assets.find(a => a.id === selected.id) ?? null;
        syncEditorFromAsset(selected);
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  function syncEditorFromAsset(a: Asset | null) {
    if (!a) {
      editAlt = '';
      editCaption = '';
      return;
    }
    editAlt     = a.altText;
    editCaption = a.caption;
  }

  function selectAsset(a: Asset) {
    selected = a;
    syncEditorFromAsset(a);
  }

  async function onAddImages() {
    busy = true;
    error = null;
    try {
      await pickAndImportAssets(bookId);
      await refresh();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  async function saveAssetMeta() {
    if (!selected || busy) return;
    busy = true;
    error = null;
    try {
      const updated = await updateAsset(selected.id, {
        altText: editAlt.trim(),
        caption: editCaption.trim(),
      });
      if (updated) {
        assets = assets.map(a => (a.id === updated.id ? updated : a));
        selected = updated;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  async function onDeleteAsset(a: Asset) {
    if (!confirm(`¿Eliminar “${a.originalName}” del libro? Los bloques que la usen quedarán sin imagen.`)) {
      return;
    }
    busy = true;
    error = null;
    try {
      await deleteAsset(a.id);
      if (selected?.id === a.id) {
        selected = null;
        syncEditorFromAsset(null);
      }
      await refresh();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  function formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }
</script>

<svelte:head>
  <title>Assets — MIDOO BOOKS</title>
</svelte:head>

<div class="assets-page">
  <header class="assets-header">
    <div>
      <h1 class="assets-title">Imágenes del libro</h1>
      <p class="assets-lead">
        Importa archivos locales; se copian al almacenamiento de la app y puedes reutilizarlos en bloques de imagen en Contenido.
      </p>
    </div>
    <button type="button" class="btn btn--primary" disabled={busy} onclick={onAddImages}>
      {#if busy}<span class="spinner"></span>{:else}+{/if}
      Añadir imágenes…
    </button>
  </header>

  {#if error}
    <div class="alert alert--error">{error}</div>
  {/if}

  {#if loading}
    <div class="state-loading"><div class="spinner-lg"></div> Cargando…</div>
  {:else if assets.length === 0}
    <div class="empty">
      <p>No hay imágenes en este libro todavía.</p>
      <button type="button" class="btn btn--ghost" disabled={busy} onclick={onAddImages}>Importar la primera imagen</button>
    </div>
  {:else}
    <div class="assets-layout">
      <ul class="asset-grid">
        {#each assets as a (a.id)}
          <li>
            <button
              type="button"
              class="asset-card"
              class:asset-card--active={selected?.id === a.id}
              onclick={() => selectAsset(a)}
            >
              <div class="asset-thumb-wrap">
                <img
                  class="asset-thumb"
                  src={assetDisplayUrl(bookId, a.storagePath)}
                  alt={a.altText || ''}
                  loading="lazy"
                />
              </div>
              <span class="asset-name" title={a.originalName}>{a.originalName}</span>
              <span class="asset-meta">
                {a.widthPx && a.heightPx ? `${a.widthPx}×${a.heightPx} · ` : ''}{formatBytes(a.fileSizeBytes)}
              </span>
            </button>
            <button
              type="button"
              class="asset-delete"
              title="Eliminar"
              disabled={busy}
              onclick={(e) => { e.stopPropagation(); void onDeleteAsset(a); }}
            >✕</button>
          </li>
        {/each}
      </ul>

      <aside class="asset-side">
        {#if selected}
          <h2 class="side-title">Detalle</h2>
          <div class="side-preview">
            <img src={assetDisplayUrl(bookId, selected.storagePath)} alt={editAlt || ''} />
          </div>
          <div class="field">
            <label class="field-label" for="as-alt">Texto alternativo</label>
            <input id="as-alt" class="field-input" bind:value={editAlt} maxlength={500} />
          </div>
          <div class="field">
            <label class="field-label" for="as-cap">Leyenda / pie</label>
            <textarea id="as-cap" class="field-input field-textarea" bind:value={editCaption} rows={3} maxlength={2000}></textarea>
          </div>
          <p class="field-hint mono">{selected.id}</p>
          <button type="button" class="btn btn--primary btn--full" disabled={busy} onclick={() => void saveAssetMeta()}>
            Guardar metadatos
          </button>
        {:else}
          <p class="side-empty">Selecciona una imagen para editar leyenda y texto alternativo.</p>
        {/if}
      </aside>
    </div>
  {/if}
</div>

<style>
  .assets-page {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow-y: auto;
    padding: 28px 36px 48px;
    background: #0f0f1a;
    color: #e8e8f4;
    font-family: 'Helvetica Neue', Arial, sans-serif;
  }

  .assets-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }

  .assets-title {
    font-size: 18px;
    font-weight: 700;
    margin: 0 0 8px;
    color: rgba(255, 255, 255, 0.92);
  }

  .assets-lead {
    margin: 0;
    font-size: 13px;
    line-height: 1.55;
    color: rgba(255, 255, 255, 0.45);
    max-width: 520px;
  }

  .btn {
    border-radius: 8px;
    padding: 9px 18px;
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    border: none;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .btn--primary {
    background: #7ab8e8;
    color: #0d1117;
  }
  .btn--primary:hover:not(:disabled) {
    background: #91c6f0;
  }
  .btn--ghost {
    background: transparent;
    color: rgba(255, 255, 255, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.15);
  }

  .btn--full {
    width: 100%;
    justify-content: center;
    margin-top: 8px;
  }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(13, 17, 23, 0.3);
    border-top-color: #0d1117;
    border-radius: 50%;
    animation: spin 0.65s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .alert {
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 13px;
    margin-bottom: 16px;
  }
  .alert--error {
    background: rgba(200, 60, 60, 0.12);
    border: 1px solid rgba(200, 80, 80, 0.25);
    color: #f0a0a0;
  }

  .state-loading {
    display: flex;
    align-items: center;
    gap: 12px;
    color: rgba(255, 255, 255, 0.35);
    font-size: 14px;
  }

  .spinner-lg {
    width: 22px;
    height: 22px;
    border: 3px solid rgba(255, 255, 255, 0.08);
    border-top-color: #7ab8e8;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  .empty {
    text-align: center;
    padding: 48px 20px;
    color: rgba(255, 255, 255, 0.38);
    font-size: 14px;
  }

  .assets-layout {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 28px;
    align-items: start;
  }

  @media (max-width: 900px) {
    .assets-layout {
      grid-template-columns: 1fr;
    }
  }

  .asset-grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 14px;
  }

  .asset-grid > li {
    position: relative;
  }

  .asset-card {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
    padding: 0 0 10px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    color: inherit;
    overflow: hidden;
    transition: border-color 0.12s, background 0.12s;
  }
  .asset-card:hover {
    border-color: rgba(122, 184, 232, 0.35);
    background: rgba(255, 255, 255, 0.05);
  }
  .asset-card--active {
    border-color: rgba(122, 184, 232, 0.55);
    background: rgba(122, 184, 232, 0.08);
  }

  .asset-thumb-wrap {
    aspect-ratio: 1;
    background: rgba(0, 0, 0, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .asset-thumb {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  .asset-name {
    font-size: 11px;
    font-weight: 600;
    padding: 0 8px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: rgba(255, 255, 255, 0.78);
  }

  .asset-meta {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.32);
    padding: 0 8px;
  }

  .asset-delete {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 26px;
    height: 26px;
    border-radius: 6px;
    border: none;
    background: rgba(0, 0, 0, 0.55);
    color: rgba(255, 255, 255, 0.85);
    cursor: pointer;
    font-size: 12px;
    line-height: 1;
  }
  .asset-delete:hover:not(:disabled) {
    background: rgba(200, 70, 70, 0.85);
  }

  .asset-side {
    position: sticky;
    top: 12px;
    padding: 18px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);
  }

  .side-title {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.35);
    margin: 0 0 14px;
  }

  .side-preview {
    border-radius: 8px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.4);
    margin-bottom: 16px;
    max-height: 220px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .side-preview img {
    max-width: 100%;
    max-height: 220px;
    object-fit: contain;
  }

  .field {
    margin-bottom: 12px;
  }
  .field-label {
    display: block;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: rgba(255, 255, 255, 0.38);
    margin-bottom: 5px;
  }
  .field-input {
    width: 100%;
    padding: 8px 10px;
    border-radius: 7px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.05);
    color: #e8e8f4;
    font-size: 13px;
    font-family: inherit;
  }
  .field-textarea {
    resize: vertical;
    min-height: 72px;
  }
  .field-hint {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.25);
    word-break: break-all;
    margin: 0 0 8px;
  }
  .mono {
    font-family: ui-monospace, monospace;
  }

  .side-empty {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.35);
    line-height: 1.5;
    margin: 0;
  }
</style>
