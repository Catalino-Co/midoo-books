<script lang="ts">
  import { page } from '$app/stores';
  import BookPagedPreview from '$lib/components/preview/BookPagedPreview.svelte';
  import { loadBookLayoutSnapshot, computePaginatedPreview } from '$lib/services/preview-layout.service';
  import { listAssets } from '$lib/services/assets.service';
  import type { PaginatedBookResult } from '$lib/core/editorial/page-layout-model';
  import type { Asset } from '$lib/core/domain/asset';

  let bookId = $derived($page.params.bookId);

  let loading   = $state(true);
  let loadError = $state<string | null>(null);
  let layout    = $state<PaginatedBookResult | null>(null);
  let assets    = $state<Asset[]>([]);

  async function load() {
    loading   = true;
    loadError = null;
    layout    = null;
    try {
      const snap = await loadBookLayoutSnapshot(bookId);
      assets = await listAssets(bookId);
      layout = computePaginatedPreview(snap);
    } catch (e) {
      loadError = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (bookId) void load();
  });
</script>

<svelte:head>
  <title>Vista previa paginada — MIDOO BOOKS</title>
</svelte:head>

<div class="preview-page">
  <header class="preview-head">
    <h1 class="preview-title">Vista previa paginada</h1>
    <button type="button" class="btn-reload" onclick={() => void load()} disabled={loading}>
      {loading ? 'Actualizando…' : 'Recargar'}
    </button>
  </header>

  {#if loadError}
    <div class="alert">{loadError}</div>
  {:else if loading || !layout}
    <div class="loading">Cargando libro…</div>
  {:else}
    <BookPagedPreview {bookId} {layout} {assets} />
  {/if}
</div>

<style>
  .preview-page {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 20px 24px 40px;
    min-height: 0;
  }
  .preview-head {
    max-width: 1100px;
    margin: 0 auto 16px;
    width: 100%;
  }
  .preview-title {
    margin: 0 0 6px;
    font-size: 20px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.88);
  }
  .btn-reload {
    font-size: 12px;
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid rgba(122, 184, 232, 0.35);
    background: rgba(122, 184, 232, 0.1);
    color: #c8e6ff;
    cursor: pointer;
    font-family: inherit;
  }
  .btn-reload:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .alert {
    max-width: 560px;
    margin: 0 auto;
    padding: 12px 14px;
    border-radius: 8px;
    background: rgba(220, 80, 80, 0.12);
    border: 1px solid rgba(220, 80, 80, 0.35);
    color: #ffb4b4;
    font-size: 13px;
  }
  .loading {
    text-align: center;
    color: rgba(255, 255, 255, 0.35);
    padding: 40px;
    font-size: 14px;
  }
</style>
