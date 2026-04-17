<script lang="ts">
  /**
   * Modal PARTE 6B — importar manuscrito Markdown completo en un libro.
   * Lógica de parseo en core; persistencia vía content.service.
   */
  import {
    listSections,
    importMarkdownBook,
    parseMarkdownBookToSectionDrafts,
    buildMarkdownBookImportPreview,
    validateMarkdownBookForImport,
    sectionTypeLabel,
    type MarkdownBookImportPreview,
    type MarkdownBookImportMode,
  } from '$lib/services/content.service';

  interface Props {
    bookId: string;
    open?: boolean;
    onImported?: () => void | Promise<void>;
  }

  let { bookId, open = $bindable(false), onImported }: Props = $props();

  let text                  = $state('');
  let mode                  = $state<MarkdownBookImportMode>('append');
  let localError            = $state<string | null>(null);
  let busy                  = $state(false);
  let existingSectionCount  = $state(0);
  let fileInput             = $state<HTMLInputElement | null>(null);

  let preview = $derived.by((): MarkdownBookImportPreview | null => {
    if (!text.trim()) return null;
    const v = validateMarkdownBookForImport(text);
    if (!v.ok) return null;
    const drafts = parseMarkdownBookToSectionDrafts(text);
    if (drafts.length === 0) return null;
    return buildMarkdownBookImportPreview(drafts);
  });

  $effect(() => {
    if (open && bookId) {
      resetFields();
      void refreshExistingCount();
    }
  });

  function resetFields() {
    text       = '';
    mode       = 'append';
    localError = null;
    busy       = false;
  }

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
    open         = false;
    localError   = null;
  }

  function onFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const f     = input.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      text       = String(r.result ?? '');
      localError = null;
    };
    r.onerror = () => {
      localError = 'No se pudo leer el archivo.';
    };
    r.readAsText(f);
    input.value = '';
  }

  async function confirmImport() {
    if (!bookId || busy) return;
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

    if (mode === 'replace' && existingSectionCount > 0) {
      const ok = confirm(
        `¿Eliminar las ${existingSectionCount} sección(es) actuales y todo su contenido, ` +
          `y sustituirlas por ${drafts.length} sección(es) importadas? Esta acción no se puede deshacer.`,
      );
      if (!ok) return;
    }

    busy       = true;
    localError = null;
    try {
      const current = await listSections(bookId);
      await importMarkdownBook(bookId, text, mode, current);
      open = false;
      await onImported?.();
    } catch (e) {
      localError = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }
</script>

{#if open}
  <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="book-md-import-title">
    <div class="book-md-modal">
      <div class="book-md-modal__header">
        <h3 id="book-md-import-title" class="book-md-modal__title">Importar manuscrito Markdown</h3>
        <button type="button" class="book-md-modal__close" onclick={close} disabled={busy}>✕</button>
      </div>

      <div class="book-md-modal__body">
        <p class="book-md-modal__hint">
          Cada línea <code class="book-md-code"># Título</code> crea una nueva sección (el título no se duplica como bloque).
          Dentro de cada sección aplican las mismas reglas que en importación por sección:
          <code class="book-md-code">##</code> / <code class="book-md-code">###</code>, párrafos, citas
          <code class="book-md-code">&gt;</code>, <code class="book-md-code">---</code>,
          <code class="book-md-code">[[PAGE_BREAK]]</code>, imágenes placeholder.
        </p>

        {#if localError}
          <div class="book-md-alert book-md-alert--error">{localError}</div>
        {/if}

        <div class="book-md-field">
          <label class="book-md-label" for="book-md-textarea">Markdown del manuscrito</label>
          <textarea
            id="book-md-textarea"
            class="book-md-textarea"
            bind:value={text}
            disabled={busy}
            placeholder="# Prólogo&#10;&#10;Texto del prólogo…&#10;&#10;# Capítulo 1: Título&#10;&#10;Párrafo.&#10;&#10;## Subtítulo&#10;&#10;Más texto…"
            rows={11}
          ></textarea>
        </div>

        <div class="book-md-field book-md-field--row">
          <input
            bind:this={fileInput}
            type="file"
            accept=".md,.markdown,text/markdown,text/plain"
            class="sr-only"
            onchange={onFileChange}
          />
          <button type="button" class="btn-ghost" disabled={busy} onclick={() => fileInput?.click()}>
            Cargar archivo .md
          </button>
        </div>

        <div class="book-md-field">
          <span class="book-md-label">Estructura del libro</span>
          <div class="book-md-mode">
            <label class="book-md-radio">
              <input type="radio" name="book-md-mode" value="append" bind:group={mode} disabled={busy} />
              <span>Agregar secciones al final</span>
            </label>
            <label class="book-md-radio">
              <input type="radio" name="book-md-mode" value="replace" bind:group={mode} disabled={busy} />
              <span>Reemplazar todas las secciones actuales</span>
            </label>
          </div>
        </div>

        {#if preview}
          <div class="book-md-preview">
            <div class="book-md-preview__title">Vista previa</div>
            <p class="book-md-preview__meta">
              <strong>{preview.sectionCount}</strong> sección(es) ·
              <strong>{preview.totalBlocks}</strong> bloque(s) en total
              {#if existingSectionCount > 0}
                · actualmente <strong>{existingSectionCount}</strong> sección(es) en el libro
              {/if}
            </p>
            <ul class="book-md-preview__list">
              {#each preview.sections as row, idx (idx)}
                <li>
                  <span class="book-md-preview__idx">{idx + 1}.</span>
                  <span class="book-md-preview__type">{sectionTypeLabel(row.sectionType)}</span>
                  <span class="book-md-preview__name">{row.title}</span>
                  <span class="book-md-preview__count">{row.blockCount} bloque(s)</span>
                </li>
              {/each}
            </ul>
          </div>
        {:else if text.trim()}
          <p class="book-md-modal__hint book-md-modal__hint--warn">
            No se pudo generar la vista previa. Comprueba que haya al menos un título
            <code class="book-md-code"># …</code>.
          </p>
        {/if}

        <div class="book-md-actions">
          <button
            type="button"
            class="btn-primary"
            disabled={busy || !preview}
            onclick={() => void confirmImport()}
          >
            {#if busy}
              <span class="spinner"></span>
              Importando…
            {:else}
              Confirmar importación
            {/if}
          </button>
          <button type="button" class="btn-ghost" disabled={busy} onclick={close}>Cancelar</button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.65);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1100;
    backdrop-filter: blur(3px);
  }

  .book-md-modal {
    background: #14142a;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    width: 90%;
    max-width: 540px;
    max-height: 88vh;
    overflow-y: auto;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
    color: #e8e8f4;
    color-scheme: dark;
  }

  .book-md-modal__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 22px 0;
    margin-bottom: 14px;
  }

  .book-md-modal__title {
    font-size: 15px;
    font-weight: 700;
    margin: 0;
    color: #fff;
  }

  .book-md-modal__close {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.35);
    font-size: 16px;
    cursor: pointer;
    padding: 2px 5px;
    border-radius: 4px;
  }
  .book-md-modal__close:hover:not(:disabled) {
    color: rgba(255, 255, 255, 0.85);
  }
  .book-md-modal__close:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .book-md-modal__body {
    padding: 0 22px 22px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .book-md-modal__hint {
    font-size: 12px;
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.45);
    margin: 0;
  }

  .book-md-modal__hint--warn {
    color: rgba(230, 180, 100, 0.85);
  }

  .book-md-code {
    font-family: ui-monospace, 'Cascadia Code', 'Segoe UI Mono', monospace;
    font-size: 0.9em;
    padding: 1px 5px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(200, 220, 255, 0.95);
  }

  .book-md-alert {
    font-size: 12px;
    padding: 10px 12px;
    border-radius: 8px;
  }
  .book-md-alert--error {
    background: rgba(200, 60, 60, 0.12);
    border: 1px solid rgba(200, 80, 80, 0.25);
    color: #f0a0a0;
  }

  .book-md-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .book-md-field--row {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-top: -4px;
  }

  .book-md-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: rgba(255, 255, 255, 0.38);
  }

  .book-md-textarea {
    width: 100%;
    min-height: 200px;
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
  .book-md-textarea:focus {
    outline: none;
    border-color: rgba(122, 184, 232, 0.5);
  }
  .book-md-textarea:disabled {
    opacity: 0.6;
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

  .book-md-mode {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 2px;
  }

  .book-md-radio {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.78);
    cursor: pointer;
  }
  .book-md-radio input {
    accent-color: #7ab8e8;
  }

  .book-md-preview {
    padding: 12px 14px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .book-md-preview__title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.42);
    margin: 0 0 8px;
  }

  .book-md-preview__meta {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.55);
    margin: 0 0 10px;
    line-height: 1.45;
  }

  .book-md-preview__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 220px;
    overflow-y: auto;
    scrollbar-width: thin;
  }

  .book-md-preview__list li {
    display: grid;
    grid-template-columns: 22px minmax(4.5rem, auto) 1fr auto;
    gap: 8px 10px;
    align-items: baseline;
    font-size: 12px;
    line-height: 1.35;
  }

  .book-md-preview__idx {
    font-weight: 600;
    color: rgba(255, 255, 255, 0.28);
    font-variant-numeric: tabular-nums;
  }

  .book-md-preview__type {
    font-size: 10px;
    font-weight: 600;
    color: rgba(122, 184, 232, 0.9);
  }

  .book-md-preview__name {
    color: rgba(255, 255, 255, 0.82);
    word-break: break-word;
  }

  .book-md-preview__count {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.35);
    white-space: nowrap;
  }

  .book-md-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 4px;
  }

  .btn-primary {
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
  .btn-primary:hover:not(:disabled) {
    filter: brightness(1.06);
  }
  .btn-primary:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .btn-ghost {
    padding: 9px 16px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: transparent;
    color: rgba(255, 255, 255, 0.65);
    font-size: 13px;
    font-family: inherit;
    cursor: pointer;
  }
  .btn-ghost:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.06);
    color: #fff;
  }
  .btn-ghost:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.25);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.65s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
