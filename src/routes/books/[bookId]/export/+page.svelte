<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import {
    exportPdf, exportMarkdown, exportEpub, exportDocx,
    createExportJob, updateExportJob, listExportJobs,
  } from '$lib/services/export.service';
  import type { ExportJob, ExportType } from '$lib/core/domain/export';

  let bookId = $derived($page.params.bookId);

  // ── State ─────────────────────────────────────────────────────────────────

  type FormatId = 'pdf_screen' | 'pdf_print' | 'epub' | 'markdown' | 'docx';

  let selectedFormat = $state<FormatId>('pdf_screen');
  let markdownSingleFile = $state(true);
  let exporting = $state(false);
  let statusMsg = $state<{ kind: 'success' | 'error' | 'info'; text: string } | null>(null);
  let history = $state<ExportJob[]>([]);

  // ── Format catalog ────────────────────────────────────────────────────────

  interface FormatDef {
    id: FormatId;
    label: string;
    description: string;
    available: boolean;
    iconPath: string;
  }

  const FORMATS: FormatDef[] = [
    {
      id: 'pdf_screen',
      label: 'PDF Pantalla',
      description: 'Ebook digital en color. Dimensiones de pantalla, optimizado para lectura digital.',
      available: true,
      iconPath: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z',
    },
    {
      id: 'pdf_print',
      label: 'PDF Impresión',
      description: 'Para impresión física. Tamaño real del libro, márgenes configurados, bleed opcional.',
      available: true,
      iconPath: 'M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z',
    },
    {
      id: 'epub',
      label: 'EPUB',
      description: 'ePub 3 reflowable. Compatible con Kindle, Apple Books, Kobo y lectores EPUB.',
      available: true,
      iconPath: 'M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z',
    },
    {
      id: 'markdown',
      label: 'Markdown',
      description: 'Texto estructurado con frontmatter YAML. Ideal para repositorios y herramientas de texto.',
      available: true,
      iconPath: 'M20.56 18H3.44C2.65 18 2 17.37 2 16.59V7.41C2 6.63 2.65 6 3.44 6h17.12C21.35 6 22 6.63 22 7.41v9.18c0 .78-.65 1.41-1.44 1.41zM6.81 15.95V10l2.38 2.95 2.38-2.95v5.95h1.6V8.05h-1.6l-2.38 2.95-2.38-2.95H4.81v7.9h2zm13.11-3.95h-2.41V8.05h-1.6v3.95h-2.41l3.21 3.95 3.21-3.95z',
    },
    {
      id: 'docx',
      label: 'Word (DOCX)',
      description: 'Microsoft Word compatible. Estilos de párrafo, headings e imágenes embebidas.',
      available: true,
      iconPath: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6zm2-4h8v2H8v-2zm0-4h8v2H8v-2zm0-4h5v2H8v-2z',
    },
  ];

  // ── History ───────────────────────────────────────────────────────────────

  async function loadHistory() {
    try {
      history = await listExportJobs(bookId, 10);
    } catch { /* silencioso */ }
  }

  onMount(() => { void loadHistory(); });

  // ── Export orchestration ──────────────────────────────────────────────────

  async function doExport() {
    if (exporting) return;
    exporting = true;
    statusMsg = { kind: 'info', text: `Generando ${formatLabel(selectedFormat)}…` };

    const job = await createExportJob({
      bookId,
      exportType: selectedFormat as ExportType,
    }).catch(() => null);

    if (job) {
      await updateExportJob(job.id, { status: 'running' }).catch(() => null);
    }

    try {
      let result: { success: boolean; path?: string; canceled?: boolean };

      switch (selectedFormat) {
        case 'pdf_screen':  result = await exportPdf(bookId, 'screen'); break;
        case 'pdf_print':   result = await exportPdf(bookId, 'print');  break;
        case 'epub':        result = await exportEpub(bookId);           break;
        case 'markdown':    result = await exportMarkdown(bookId, { singleFile: markdownSingleFile }); break;
        case 'docx':        result = await exportDocx(bookId);           break;
      }

      if (result.canceled) {
        statusMsg = { kind: 'info', text: 'Cancelado.' };
        if (job) await updateExportJob(job.id, { status: 'failed', errorMsg: 'Cancelado por el usuario.' }).catch(() => null);
      } else if (result.success) {
        statusMsg = { kind: 'success', text: result.path ? `Guardado en: ${result.path}` : 'Exportado correctamente.' };
        if (job) await updateExportJob(job.id, {
          status: 'completed',
          outputPath: result.path,
          completedAt: new Date().toISOString(),
        }).catch(() => null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      statusMsg = { kind: 'error', text: `Error: ${msg}` };
      if (job) await updateExportJob(job.id, {
        status: 'failed',
        errorMsg: msg,
        completedAt: new Date().toISOString(),
      }).catch(() => null);
    } finally {
      exporting = false;
      await loadHistory();
    }
  }

  function formatLabel(id: FormatId): string {
    return FORMATS.find(f => f.id === id)?.label ?? id;
  }

  function fmtDate(iso: string | null): string {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' });
    } catch { return iso.slice(0, 16); }
  }

  function statusColor(s: string): string {
    if (s === 'completed') return '#4ade80';
    if (s === 'failed')    return '#f87171';
    if (s === 'running')   return '#7ab8e8';
    return '#9ca3af';
  }
</script>

<svelte:head>
  <title>Exportar — MIDOO BOOKS</title>
</svelte:head>

<div class="export-page">
  <h1 class="page-title">Exportar</h1>

  <!-- Format grid -->
  <div class="format-grid">
    {#each FORMATS as f (f.id)}
      <button
        type="button"
        class="format-card"
        class:format-card--active={selectedFormat === f.id}
        class:format-card--unavailable={!f.available}
        onclick={() => { if (f.available) selectedFormat = f.id; }}
        disabled={!f.available}
      >
        <svg class="format-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d={f.iconPath}/>
        </svg>
        <div class="format-info">
          <span class="format-name">{f.label}</span>
          <span class="format-desc">{f.description}</span>
        </div>
        {#if !f.available}
          <span class="format-badge">Próximamente</span>
        {/if}
      </button>
    {/each}

    <!-- Physical print placeholder -->
    <div class="format-card format-card--unavailable">
      <svg class="format-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M9 3L5 6.99h3V14h2V6.99h3L9 3zm7 14.01V10h-2v7.01h-3L15 21l4-3.99h-3z"/>
      </svg>
      <div class="format-info">
        <span class="format-name">Impresión física</span>
        <span class="format-desc">PDF con páginas enfrentadas, bleed y marcas de registro. Para enviar a imprenta.</span>
      </div>
      <span class="format-badge">Próximamente</span>
    </div>
  </div>

  <!-- Options panel -->
  {#if selectedFormat === 'markdown'}
    <div class="options-panel">
      <p class="options-label">Opciones</p>
      <label class="option-radio">
        <input type="radio" bind:group={markdownSingleFile} value={true} />
        Un archivo único
      </label>
      <label class="option-radio">
        <input type="radio" bind:group={markdownSingleFile} value={false} />
        Un archivo por sección
      </label>
    </div>
  {:else if selectedFormat === 'pdf_print'}
    <div class="options-panel">
      <p class="options-info">
        El PDF usará las dimensiones y márgenes configurados en la pestaña
        <strong>Diseño</strong> del libro.
      </p>
    </div>
  {/if}

  <!-- Export button + status -->
  <div class="action-row">
    <button
      type="button"
      class="btn-export"
      onclick={doExport}
      disabled={exporting}
    >
      {#if exporting}
        <span class="spinner" aria-hidden="true"></span>
        Generando…
      {:else}
        Exportar {formatLabel(selectedFormat)}
      {/if}
    </button>

    {#if statusMsg}
      <div class="status-msg" class:status-msg--success={statusMsg.kind === 'success'} class:status-msg--error={statusMsg.kind === 'error'}>
        {statusMsg.text}
      </div>
    {/if}
  </div>

  <!-- History -->
  {#if history.length > 0}
    <section class="history">
      <h2 class="history-title">Historial reciente</h2>
      <ul class="history-list">
        {#each history as job (job.id)}
          <li class="history-item">
            <span class="h-type">{job.exportType}</span>
            <span class="h-date">{fmtDate(job.createdAt)}</span>
            <span class="h-status" style="color:{statusColor(job.status)}">{job.status}</span>
            {#if job.outputPath}
              <span class="h-path" title={job.outputPath}>{job.outputPath.split(/[/\\]/).pop()}</span>
            {:else if job.errorMsg}
              <span class="h-error" title={job.errorMsg}>{job.errorMsg.slice(0, 60)}</span>
            {:else}
              <span></span>
            {/if}
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</div>

<style>
  .export-page {
    padding: 28px 32px 60px;
    flex: 1;
    overflow-y: auto;
    max-width: 860px;
  }

  .page-title {
    margin: 0 0 24px;
    font-size: 20px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.88);
  }

  /* ── Format grid ─────────────────────────────────────────────────────────── */
  .format-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 10px;
    margin-bottom: 20px;
  }

  .format-card {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px;
    border-radius: 10px;
    border: 1.5px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.04);
    cursor: pointer;
    text-align: left;
    transition: border-color 0.12s, background 0.12s;
    position: relative;
    font-family: inherit;
    color: rgba(255, 255, 255, 0.75);
  }

  .format-card:hover:not(:disabled) {
    border-color: rgba(122, 184, 232, 0.35);
    background: rgba(122, 184, 232, 0.07);
  }

  .format-card--active {
    border-color: #7ab8e8 !important;
    background: rgba(122, 184, 232, 0.12) !important;
  }

  .format-card--unavailable {
    opacity: 0.45;
    cursor: default;
  }

  .format-icon {
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    margin-top: 1px;
    opacity: 0.8;
  }

  .format-info {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .format-name {
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
  }

  .format-desc {
    font-size: 11px;
    line-height: 1.4;
    color: rgba(255, 255, 255, 0.45);
  }

  .format-badge {
    position: absolute;
    top: 8px;
    right: 10px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(122, 184, 232, 0.7);
    background: rgba(122, 184, 232, 0.08);
    border: 1px solid rgba(122, 184, 232, 0.2);
    padding: 2px 7px;
    border-radius: 12px;
  }

  /* ── Options panel ───────────────────────────────────────────────────────── */
  .options-panel {
    margin-bottom: 20px;
    padding: 14px 16px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .options-label {
    margin: 0;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: rgba(255, 255, 255, 0.35);
  }

  .options-info {
    margin: 0;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    line-height: 1.5;
  }

  .option-radio {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.7);
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }

  /* ── Action row ──────────────────────────────────────────────────────────── */
  .action-row {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 32px;
  }

  .btn-export {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 24px;
    border-radius: 8px;
    border: none;
    background: #7ab8e8;
    color: #0f1923;
    font-size: 13px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    transition: opacity 0.12s, transform 0.08s;
  }

  .btn-export:disabled {
    opacity: 0.55;
    cursor: default;
  }

  .btn-export:not(:disabled):hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(0, 0, 0, 0.25);
    border-top-color: #0f1923;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .status-msg {
    font-size: 12px;
    padding: 6px 12px;
    border-radius: 6px;
    background: rgba(156, 163, 175, 0.1);
    border: 1px solid rgba(156, 163, 175, 0.2);
    color: rgba(255, 255, 255, 0.6);
    max-width: 480px;
    word-break: break-all;
  }

  .status-msg--success {
    background: rgba(74, 222, 128, 0.08);
    border-color: rgba(74, 222, 128, 0.25);
    color: #4ade80;
  }

  .status-msg--error {
    background: rgba(248, 113, 113, 0.08);
    border-color: rgba(248, 113, 113, 0.25);
    color: #f87171;
  }

  /* ── History ─────────────────────────────────────────────────────────────── */
  .history {
    border-top: 1px solid rgba(255, 255, 255, 0.07);
    padding-top: 20px;
  }

  .history-title {
    margin: 0 0 12px;
    font-size: 13px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.45);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .history-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .history-item {
    display: grid;
    grid-template-columns: 120px 130px 80px 1fr;
    align-items: center;
    gap: 10px;
    padding: 7px 12px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.03);
    font-size: 12px;
    color: rgba(255, 255, 255, 0.55);
  }

  .h-type {
    font-family: monospace;
    font-size: 11px;
    color: rgba(122, 184, 232, 0.8);
  }

  .h-date { color: rgba(255, 255, 255, 0.35); }
  .h-status { font-weight: 600; font-size: 11px; }

  .h-path {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: rgba(255, 255, 255, 0.4);
  }

  .h-error {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #f87171;
    opacity: 0.75;
  }
</style>
