<script lang="ts">
  /**
   * Importación Markdown unificada: misma entrada para sección actual o libro completo (# → secciones).
   */
  import {
    listSections,
    listBlocks,
    importMarkdownBook,
    importMarkdownBlocksToSection,
    parseMarkdownToBlockDrafts,
    parseMarkdownBookToSectionDrafts,
    buildMarkdownImportPreview,
    buildMarkdownBookImportPreview,
    validateMarkdownForImport,
    validateMarkdownBookForImport,
    inferMarkdownImportSuggestion,
    sectionTypeLabel,
    blockTypeLabel,
    type MarkdownImportPreview,
    type BookMarkdownImportPreview,
    type MarkdownBookImportMode,
    type MarkdownImportMode,
  } from '$lib/services/content.service';
  import type { BlockType } from '$lib/core/domain/index';

  interface SectionContext {
    sectionId: string;
    title: string;
    blockCount: number;
  }

  interface Props {
    bookId: string;
    open?: boolean;
    sectionContext?: SectionContext | null;
    onImportedBook?: (detail: {
      sectionCount: number;
      blockCount: number;
      mode: MarkdownBookImportMode;
    }) => void | Promise<void>;
    onImportedSection?: (detail: { blockCount: number; mode: MarkdownImportMode }) => void | Promise<void>;
  }

  let {
    bookId,
    open = $bindable(false),
    sectionContext = null,
    onImportedBook,
    onImportedSection,
  }: Props = $props();

  type Target = 'section' | 'book';

  let target = $state<Target>('book');
  let text = $state('');
  let modeSection = $state<MarkdownImportMode>('append');
  let modeBook = $state<MarkdownBookImportMode>('append');
  let localError = $state<string | null>(null);
  let busy = $state(false);
  let fileInput = $state<HTMLInputElement | null>(null);
  let existingSectionCount = $state(0);

  const hasSection = $derived(sectionContext != null);

  $effect(() => {
    if (open && bookId) {
      text = '';
      localError = null;
      busy = false;
      modeSection = 'append';
      modeBook = 'append';
      target = sectionContext ? 'section' : 'book';
      void refreshExistingCount();
    }
  });

  $effect(() => {
    if (!hasSection && target === 'section') {
      target = 'book';
    }
  });

  let hint = $derived.by(() => inferMarkdownImportSuggestion(text));

  let sectionPreview = $derived.by((): MarkdownImportPreview | null => {
    if (!text.trim()) return null;
    const v = validateMarkdownForImport(text);
    if (!v.ok) return null;
    const drafts = parseMarkdownToBlockDrafts(text);
    if (drafts.length === 0) return null;
    return buildMarkdownImportPreview(drafts);
  });

  let bookPreview = $derived.by((): BookMarkdownImportPreview | null => {
    if (!text.trim()) return null;
    const v = validateMarkdownBookForImport(text);
    if (!v.ok) return null;
    const drafts = parseMarkdownBookToSectionDrafts(text);
    if (drafts.length === 0) return null;
    return buildMarkdownBookImportPreview(drafts);
  });

  let canConfirm = $derived(target === 'section' ? sectionPreview !== null : bookPreview !== null);

  async function refreshExistingCount() {
    try {
      const s = await listSections(bookId);
      existingSectionCount = s.length;
    } catch {
      existingSectionCount = 0;
    }
  }

  function close() {
    if (busy) return;
    open = false;
    localError = null;
  }

  function applySuggestion() {
    if (hint.suggested && hasSection) target = hint.suggested;
  }

  function onFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      text = String(r.result ?? '');
      localError = null;
    };
    r.onerror = () => {
      localError = 'No se pudo leer el archivo.';
    };
    r.readAsText(f);
    input.value = '';
  }

  async function confirmImport() {
    if (!bookId || busy || !canConfirm) return;

    if (target === 'section') {
      if (!sectionContext) {
        localError = 'Elige una sección en Contenido e inténtalo de nuevo.';
        return;
      }
      const v = validateMarkdownForImport(text);
      if (!v.ok) {
        localError = v.message;
        return;
      }
      const drafts = parseMarkdownToBlockDrafts(text);
      if (drafts.length === 0) {
        localError =
          'No se detectaron bloques. Usa párrafos, # / ##, > cita, ---, [[PAGE_BREAK]] o ![alt](ruta).';
        return;
      }
      if (modeSection === 'replace' && sectionContext.blockCount > 0) {
        const ok = confirm(
          `¿Reemplazar los ${sectionContext.blockCount} bloque(s) de «${sectionContext.title}» por ${drafts.length} importado(s)? Esta acción no se puede deshacer.`,
        );
        if (!ok) return;
      }
      busy = true;
      localError = null;
      try {
        const currentBlocks = await listBlocks(sectionContext.sectionId);
        await importMarkdownBlocksToSection(sectionContext.sectionId, text, modeSection, currentBlocks);
        open = false;
        await onImportedSection?.({ blockCount: drafts.length, mode: modeSection });
      } catch (e) {
        localError = e instanceof Error ? e.message : String(e);
      } finally {
        busy = false;
      }
      return;
    }

    const v = validateMarkdownBookForImport(text);
    if (!v.ok) {
      localError = v.message;
      return;
    }
    const drafts = parseMarkdownBookToSectionDrafts(text);
    if (drafts.length === 0) {
      localError = 'No se detectaron secciones válidas.';
      return;
    }
    const totalBlocks = drafts.reduce((n, d) => n + d.blockDrafts.length, 0);
    if (modeBook === 'replace' && existingSectionCount > 0) {
      const ok = confirm(
        `¿Eliminar las ${existingSectionCount} sección(es) actuales y todo su contenido, y sustituirlas por ${drafts.length} sección(es) importadas? Esta acción no se puede deshacer.`,
      );
      if (!ok) return;
    }
    busy = true;
    localError = null;
    try {
      const current = await listSections(bookId);
      await importMarkdownBook(bookId, text, modeBook, current);
      open = false;
      await onImportedBook?.({ sectionCount: drafts.length, blockCount: totalBlocks, mode: modeBook });
    } catch (e) {
      localError = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }
</script>

{#if open}
  <div class="mdu-overlay" role="dialog" aria-modal="true" aria-labelledby="mdu-title">
    <div class="mdu-modal">
      <div class="mdu-head">
        <h3 id="mdu-title" class="mdu-title">Importar Markdown</h3>
        <button type="button" class="mdu-close" onclick={close} disabled={busy}>✕</button>
      </div>

      <div class="mdu-body">
        {#if hasSection}
          <div class="mdu-tabs" role="tablist" aria-label="Destino de la importación">
            <button
              type="button"
              role="tab"
              class="mdu-tab"
              class:mdu-tab--on={target === 'section'}
              aria-selected={target === 'section'}
              disabled={busy}
              onclick={() => { target = 'section'; }}
            >
              Sección actual
            </button>
            <button
              type="button"
              role="tab"
              class="mdu-tab"
              class:mdu-tab--on={target === 'book'}
              aria-selected={target === 'book'}
              disabled={busy}
              onclick={() => { target = 'book'; }}
            >
              Todo el libro
            </button>
          </div>
          {#if sectionContext}
            <p class="mdu-context">
              {#if target === 'section'}
                Se importa en <strong>{sectionContext.title || 'sección'}</strong>
                ({sectionContext.blockCount} bloque(s) ahora).
              {:else}
                Cada línea <code class="mdu-code"># Título</code> crea una sección nueva. El título no se duplica como bloque.
              {/if}
            </p>
          {/if}
        {:else}
          <p class="mdu-context">
            Manuscrito completo: cada <code class="mdu-code">#</code> abre una sección. Mismas reglas de bloques que en Contenido
            (<code class="mdu-code">##</code>, citas, <code class="mdu-code">---</code>, <code class="mdu-code">[[PAGE_BREAK]]</code>, imágenes).
          </p>
        {/if}

        {#if hint.message && hasSection}
          <div class="mdu-hint-banner">
            <span class="mdu-hint-text">{hint.message}</span>
            {#if hint.suggested}
              <button type="button" class="mdu-hint-btn" disabled={busy} onclick={applySuggestion}>
                Usar «{hint.suggested === 'book' ? 'Todo el libro' : 'Sección actual'}»
              </button>
            {/if}
          </div>
        {:else if hint.message && !hasSection}
          <p class="mdu-hint-standalone">{hint.message}</p>
        {/if}

        {#if localError}
          <div class="mdu-alert mdu-alert--err">{localError}</div>
        {/if}

        <label class="mdu-label" for="mdu-text">Markdown</label>
        <textarea
          id="mdu-text"
          class="mdu-textarea"
          bind:value={text}
          disabled={busy}
          placeholder={target === 'book' || !hasSection
            ? '# Prólogo\n\nTexto…\n\n# Capítulo 1\n\nPárrafo.\n\n## Subtítulo\n\n> Cita\n\n---\n\n[[PAGE_BREAK]]'
            : '# Título en esta sección\n\nPárrafo.\n\n## Subtítulo\n\n> Cita'}
          rows={11}
        ></textarea>

        <div class="mdu-file-row">
          <input
            bind:this={fileInput}
            type="file"
            accept=".md,.markdown,text/markdown,text/plain"
            class="sr-only"
            onchange={onFileChange}
          />
          <button type="button" class="mdu-btn-ghost" disabled={busy} onclick={() => fileInput?.click()}>
            Cargar archivo .md
          </button>
        </div>

        {#if target === 'section'}
          <span class="mdu-label">Inserción en la sección</span>
          <div class="mdu-modes">
            <label class="mdu-radio">
              <input type="radio" name="mdu-ms" value="append" bind:group={modeSection} disabled={busy} />
              <span>Agregar al final</span>
            </label>
            <label class="mdu-radio">
              <input type="radio" name="mdu-ms" value="replace" bind:group={modeSection} disabled={busy} />
              <span>Reemplazar bloques actuales</span>
            </label>
          </div>
        {:else}
          <span class="mdu-label">Estructura del libro</span>
          <div class="mdu-modes">
            <label class="mdu-radio">
              <input type="radio" name="mdu-mb" value="append" bind:group={modeBook} disabled={busy} />
              <span>Agregar secciones al final</span>
            </label>
            <label class="mdu-radio">
              <input type="radio" name="mdu-mb" value="replace" bind:group={modeBook} disabled={busy} />
              <span>Reemplazar todas las secciones actuales</span>
            </label>
          </div>
        {/if}

        {#if target === 'section' && sectionPreview}
          <div class="mdu-preview">
            <div class="mdu-preview-title">Resumen — bloques en esta sección</div>
            <p class="mdu-preview-meta">
              <strong>{sectionPreview.blockCount}</strong> bloque(s)
              {#if Object.keys(sectionPreview.byType).length > 0}
                <span>
                  ·
                  {#each Object.entries(sectionPreview.byType) as [t, n], j (t)}
                    {j > 0 ? ' · ' : ''}{blockTypeLabel(t as BlockType)}: {n}
                  {/each}
                </span>
              {/if}
            </p>
            <ul class="mdu-preview-list">
              {#each sectionPreview.samples as s, idx (idx)}
                <li>
                  <span class="mdu-preview-type">{blockTypeLabel(s.type)}</span>
                  <span class="mdu-preview-excerpt">{s.excerpt}</span>
                </li>
              {/each}
            </ul>
            {#if sectionPreview.blockCount > sectionPreview.samples.length}
              <p class="mdu-preview-more">… y {sectionPreview.blockCount - sectionPreview.samples.length} más</p>
            {/if}
          </div>
        {:else if target === 'book' && bookPreview}
          <div class="mdu-preview">
            <div class="mdu-preview-title">Resumen — libro</div>
            <p class="mdu-preview-meta">{bookPreview.summaryLine}</p>
            {#if existingSectionCount > 0}
              <p class="mdu-preview-sub">Ahora el libro tiene <strong>{existingSectionCount}</strong> sección(es).</p>
            {/if}
            <ul class="mdu-preview-sections">
              {#each bookPreview.sections as row, idx (idx)}
                <li>
                  <span class="mdu-sec-idx">{idx + 1}.</span>
                  <span class="mdu-sec-type">{sectionTypeLabel(row.sectionType)}</span>
                  <span class="mdu-sec-name">{row.title}</span>
                  <span class="mdu-sec-count">{row.blockCount} bloque(s)</span>
                </li>
              {/each}
            </ul>
          </div>
        {:else if text.trim()}
          <p class="mdu-warn">
            {#if target === 'section'}
              No se detectaron bloques. Revisa el formato o prueba «Todo el libro» si tu archivo usa varios <code class="mdu-code">#</code>.
            {:else}
              No se pudo generar el resumen. Comprueba que exista al menos un título <code class="mdu-code"># …</code>.
            {/if}
          </p>
        {/if}

        <div class="mdu-actions">
          <button type="button" class="mdu-btn-primary" disabled={busy || !canConfirm} onclick={() => void confirmImport()}>
            {#if busy}
              <span class="mdu-spinner"></span>
              Importando…
            {:else}
              Confirmar importación
            {/if}
          </button>
          <button type="button" class="mdu-btn-ghost" disabled={busy} onclick={close}>Cancelar</button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .mdu-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.65);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1100;
    backdrop-filter: blur(3px);
  }

  .mdu-modal {
    background: #14142a;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    width: 92%;
    max-width: 560px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
    color: #e8e8f4;
    color-scheme: dark;
  }

  .mdu-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 20px 0;
    margin-bottom: 10px;
  }

  .mdu-title {
    font-size: 15px;
    font-weight: 700;
    margin: 0;
    color: #fff;
  }

  .mdu-close {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.35);
    font-size: 16px;
    cursor: pointer;
    padding: 2px 5px;
    border-radius: 4px;
  }
  .mdu-close:hover:not(:disabled) {
    color: rgba(255, 255, 255, 0.85);
  }
  .mdu-close:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .mdu-body {
    padding: 0 20px 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .mdu-tabs {
    display: flex;
    gap: 6px;
    padding: 2px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
  }

  .mdu-tab {
    flex: 1;
    padding: 8px 10px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: rgba(255, 255, 255, 0.55);
    font-size: 12px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
  }
  .mdu-tab--on {
    background: rgba(122, 184, 232, 0.2);
    color: #e8f4ff;
  }
  .mdu-tab:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .mdu-context {
    font-size: 12px;
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.48);
    margin: 0;
  }

  .mdu-hint-banner {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    padding: 10px 12px;
    border-radius: 8px;
    background: rgba(122, 184, 232, 0.1);
    border: 1px solid rgba(122, 184, 232, 0.22);
  }

  .mdu-hint-text {
    font-size: 11px;
    line-height: 1.45;
    color: rgba(200, 225, 255, 0.92);
    flex: 1;
    min-width: 200px;
  }

  .mdu-hint-btn {
    padding: 5px 10px;
    border-radius: 6px;
    border: 1px solid rgba(122, 184, 232, 0.45);
    background: rgba(122, 184, 232, 0.15);
    color: #cfe8ff;
    font-size: 11px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    white-space: nowrap;
  }
  .mdu-hint-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .mdu-hint-standalone {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.45);
    margin: 0;
    line-height: 1.45;
  }

  .mdu-code {
    font-family: ui-monospace, 'Cascadia Code', 'Segoe UI Mono', monospace;
    font-size: 0.9em;
    padding: 1px 5px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(200, 220, 255, 0.95);
  }

  .mdu-alert {
    font-size: 12px;
    padding: 10px 12px;
    border-radius: 8px;
  }
  .mdu-alert--err {
    background: rgba(200, 60, 60, 0.12);
    border: 1px solid rgba(200, 80, 80, 0.25);
    color: #f0a0a0;
  }

  .mdu-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: rgba(255, 255, 255, 0.38);
  }

  .mdu-textarea {
    width: 100%;
    min-height: 180px;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04);
    color: #e8e8f4;
    font-family: ui-monospace, 'Cascadia Code', 'Segoe UI Mono', monospace;
    font-size: 12px;
    line-height: 1.45;
    resize: vertical;
  }
  .mdu-textarea:focus {
    outline: none;
    border-color: rgba(122, 184, 232, 0.5);
  }
  .mdu-textarea:disabled {
    opacity: 0.6;
  }

  .mdu-file-row {
    margin-top: -4px;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .mdu-modes {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .mdu-radio {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.78);
    cursor: pointer;
  }
  .mdu-radio input {
    accent-color: #7ab8e8;
  }

  .mdu-preview {
    padding: 12px 14px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .mdu-preview-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.42);
    margin: 0 0 8px;
  }

  .mdu-preview-meta {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.62);
    margin: 0 0 8px;
    line-height: 1.45;
  }

  .mdu-preview-sub {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.45);
    margin: -4px 0 10px;
  }

  .mdu-preview-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 160px;
    overflow-y: auto;
    scrollbar-width: thin;
  }

  .mdu-preview-list li {
    display: grid;
    grid-template-columns: minmax(5rem, auto) 1fr;
    gap: 8px;
    font-size: 11px;
    line-height: 1.35;
  }

  .mdu-preview-type {
    font-weight: 600;
    color: rgba(122, 184, 232, 0.95);
  }

  .mdu-preview-excerpt {
    color: rgba(255, 255, 255, 0.72);
    word-break: break-word;
  }

  .mdu-preview-more {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.38);
    margin: 6px 0 0;
  }

  .mdu-preview-sections {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 200px;
    overflow-y: auto;
    scrollbar-width: thin;
  }

  .mdu-preview-sections li {
    display: grid;
    grid-template-columns: 22px minmax(4.5rem, auto) 1fr auto;
    gap: 8px 10px;
    align-items: baseline;
    font-size: 12px;
    line-height: 1.35;
  }

  .mdu-sec-idx {
    font-weight: 600;
    color: rgba(255, 255, 255, 0.28);
    font-variant-numeric: tabular-nums;
  }

  .mdu-sec-type {
    font-size: 10px;
    font-weight: 600;
    color: rgba(122, 184, 232, 0.9);
  }

  .mdu-sec-name {
    color: rgba(255, 255, 255, 0.82);
    word-break: break-word;
  }

  .mdu-sec-count {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.35);
    white-space: nowrap;
  }

  .mdu-warn {
    font-size: 12px;
    color: rgba(230, 180, 100, 0.88);
    margin: 0;
    line-height: 1.45;
  }

  .mdu-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 4px;
  }

  .mdu-btn-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 16px;
    border-radius: 8px;
    border: none;
    background: linear-gradient(180deg, #5a9fd4, #3d7eb8);
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
  }
  .mdu-btn-primary:hover:not(:disabled) {
    filter: brightness(1.06);
  }
  .mdu-btn-primary:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .mdu-btn-ghost {
    padding: 9px 16px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: transparent;
    color: rgba(255, 255, 255, 0.65);
    font-size: 13px;
    font-family: inherit;
    cursor: pointer;
  }
  .mdu-btn-ghost:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.06);
    color: #fff;
  }
  .mdu-btn-ghost:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .mdu-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.25);
    border-top-color: #fff;
    border-radius: 50%;
    animation: mdu-spin 0.65s linear infinite;
  }
  @keyframes mdu-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
