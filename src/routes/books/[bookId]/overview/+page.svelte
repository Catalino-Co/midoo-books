<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import {
    getBook, updateBook, deleteBook,
    statusLabel, statusColor, formatDate,
  } from '$lib/services/books.service';
  import BookMarkdownImportModal from '$lib/components/BookMarkdownImportModal.svelte';
  import type { BookProject, BookStatus } from '$lib/core/domain/index';

  // ── Estado ────────────────────────────────────────────────────────────────
  let book    = $state<BookProject | null>(null);
  let loading = $state(true);
  let error   = $state<string | null>(null);

  // Formulario (campos enlazados)
  let title        = $state('');
  let subtitle     = $state('');
  let authorName   = $state('');
  let description  = $state('');
  let languageCode = $state('es');
  let status       = $state<BookStatus>('draft');

  // Estado de guardado
  let saving      = $state(false);
  let saveError   = $state<string | null>(null);
  let saveSuccess = $state(false);

  // Estado de borrado
  let confirmDelete = $state(false);
  let deleting      = $state(false);

  // Importación manuscrito Markdown (PARTE 6B)
  let showBookMarkdownImport = $state(false);
  let bookImportNotice       = $state<string | null>(null);

  // Detección de cambios
  let isDirty = $derived(
    book !== null && (
      title        !== book.title       ||
      subtitle     !== book.subtitle    ||
      authorName   !== book.authorName  ||
      description  !== book.description ||
      languageCode !== book.languageCode ||
      status       !== book.status
    )
  );

  let bookId = $derived($page.params.bookId);

  // ── Carga ─────────────────────────────────────────────────────────────────
  onMount(async () => {
    await loadBook();
  });

  async function loadBook() {
    loading = true;
    error   = null;
    try {
      const loaded = await getBook(bookId);
      if (!loaded) { error = 'Libro no encontrado.'; return; }
      book = loaded;
      syncFormToBook(loaded);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  function syncFormToBook(b: BookProject) {
    title        = b.title;
    subtitle     = b.subtitle     ?? '';
    authorName   = b.authorName   ?? '';
    description  = b.description  ?? '';
    languageCode = b.languageCode ?? 'es';
    status       = b.status       ?? 'draft';
  }

  // ── Guardar ───────────────────────────────────────────────────────────────
  async function handleSave(e?: SubmitEvent | MouseEvent) {
    e?.preventDefault();
    if (!isDirty || saving) return;
    saving      = true;
    saveError   = null;
    saveSuccess = false;
    try {
      const updated = await updateBook(bookId, {
        title:        title.trim(),
        subtitle:     subtitle.trim(),
        authorName:   authorName.trim(),
        description:  description.trim(),
        languageCode,
        status,
      });
      if (updated) {
        book = updated;
        syncFormToBook(updated);
        saveSuccess = true;
        setTimeout(() => (saveSuccess = false), 2500);
      }
    } catch (e) {
      saveError = e instanceof Error ? e.message : String(e);
    } finally {
      saving = false;
    }
  }

  function discardChanges() {
    if (book) syncFormToBook(book);
  }

  function onBookMarkdownImported() {
    bookImportNotice = 'Manuscrito importado. Puedes revisar la estructura en Contenido.';
    setTimeout(() => {
      bookImportNotice = null;
    }, 5000);
  }

  // ── Eliminar ──────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (deleting) return;
    deleting = true;
    try {
      await deleteBook(bookId);
      goto('/library', { replaceState: true });
    } catch (e) {
      saveError = e instanceof Error ? e.message : String(e);
      deleting  = false;
      confirmDelete = false;
    }
  }
</script>

<svelte:head>
  <title>{book ? book.title : 'Descripción'} — MIDOO BOOKS</title>
</svelte:head>

<!-- ── Confirmación de borrado ─────────────────────────────────────────────── -->
<BookMarkdownImportModal bind:open={showBookMarkdownImport} {bookId} onImported={onBookMarkdownImported} />

{#if confirmDelete}
  <div class="overlay" role="dialog" aria-modal="true">
    <div class="dialog">
      <h3 class="dialog-title">Eliminar libro</h3>
      <p class="dialog-body">
        ¿Eliminar <strong>"{book?.title}"</strong>? Esta acción es permanente y no se puede deshacer.
        Se borrarán todas las secciones y bloques asociados.
      </p>
      <div class="dialog-actions">
        <button class="btn btn--ghost" onclick={() => (confirmDelete = false)} disabled={deleting}>
          Cancelar
        </button>
        <button class="btn btn--danger" onclick={handleDelete} disabled={deleting}>
          {#if deleting}
            <span class="btn-spinner"></span>
            Eliminando…
          {:else}
            Eliminar permanentemente
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ── Página ──────────────────────────────────────────────────────────────── -->
<div class="overview-page">

  <!-- Top bar interna -->
  <header class="page-header">
    <div class="page-header-left">
      <h1 class="page-title">Descripción del proyecto</h1>
      {#if book}
        <span class="page-updated">Actualizado {formatDate(book.updatedAt)}</span>
      {/if}
    </div>
    <div class="page-header-right">
      {#if isDirty}
        <button class="btn btn--ghost btn--sm" onclick={discardChanges} disabled={saving}>
          Descartar
        </button>
      {/if}
      <button
        type="button"
        class="btn btn--primary btn--sm"
        onclick={() => handleSave()}
        disabled={!isDirty || saving}
      >
        {#if saving}
          <span class="btn-spinner btn-spinner--dark"></span>
          Guardando…
        {:else if saveSuccess}
          ✓ Guardado
        {:else}
          Guardar cambios
        {/if}
      </button>
    </div>
  </header>

  <!-- Feedback de guardado -->
  {#if saveError}
    <div class="alert alert--error">{saveError}</div>
  {/if}
  {#if bookImportNotice}
    <div class="alert alert--success">{bookImportNotice}</div>
  {/if}
  {#if isDirty && !saving}
    <div class="alert alert--info">Tienes cambios sin guardar.</div>
  {/if}

  <!-- Contenido -->
  <div class="overview-body">

    {#if loading}
      <div class="state-loading">
        <div class="spinner"></div>
        <span>Cargando información del libro…</span>
      </div>

    {:else if error}
      <div class="state-error">
        <strong>No se pudo cargar el libro</strong>
        <p>{error}</p>
        <button class="btn btn--ghost" onclick={loadBook}>Reintentar</button>
      </div>

    {:else if book}
      <form onsubmit={handleSave} class="meta-form">

        <!-- ── Sección: Identidad editorial ───────────────────────────────── -->
        <section class="form-section">
          <h2 class="form-section-title">Identidad editorial</h2>

          <div class="field field--full">
            <label class="field-label" for="ov-title">
              Título <span class="required">*</span>
            </label>
            <input
              id="ov-title"
              class="field-input"
              type="text"
              bind:value={title}
              maxlength={200}
              placeholder="Título del libro"
              disabled={saving}
              required
            />
          </div>

          <div class="field field--full">
            <label class="field-label" for="ov-subtitle">Subtítulo</label>
            <input
              id="ov-subtitle"
              class="field-input"
              type="text"
              bind:value={subtitle}
              maxlength={300}
              placeholder="Subtítulo o tagline (opcional)"
              disabled={saving}
            />
          </div>

          <div class="field field--full">
            <label class="field-label" for="ov-author">Autor / autora</label>
            <input
              id="ov-author"
              class="field-input"
              type="text"
              bind:value={authorName}
              maxlength={200}
              placeholder="Nombre del autor o autora (opcional)"
              disabled={saving}
            />
          </div>

          <div class="field field--full">
            <label class="field-label" for="ov-desc">Descripción</label>
            <textarea
              id="ov-desc"
              class="field-input field-textarea"
              bind:value={description}
              maxlength={1000}
              placeholder="Breve descripción del libro (opcional)"
              rows={4}
              disabled={saving}
            ></textarea>
            <span class="field-hint">{description.length}/1000</span>
          </div>
        </section>

        <!-- ── Sección: Configuración ──────────────────────────────────────── -->
        <section class="form-section">
          <h2 class="form-section-title">Configuración</h2>

          <div class="field-row">
            <div class="field">
              <label class="field-label" for="ov-lang">Idioma</label>
              <select id="ov-lang" class="field-input field-select" bind:value={languageCode} disabled={saving}>
                <option value="es">Español</option>
                <option value="en">English</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="pt">Português</option>
                <option value="it">Italiano</option>
              </select>
            </div>

            <div class="field">
              <label class="field-label" for="ov-status">Estado</label>
              <select id="ov-status" class="field-input field-select" bind:value={status} disabled={saving}>
                <option value="draft">Borrador</option>
                <option value="in_progress">En progreso</option>
                <option value="complete">Completado</option>
                <option value="archived">Archivado</option>
              </select>
              <span class="field-status-dot" style:background={statusColor(status)}></span>
            </div>
          </div>
        </section>

        <!-- ── Manuscrito Markdown ─────────────────────────────────────────── -->
        <section class="form-section">
          <h2 class="form-section-title">Manuscrito</h2>
          <p class="import-manuscript-lead">
            Importa un Markdown estructurado con <code class="import-code"># Título de sección</code> por cada parte
            del libro. El contenido bajo cada <code class="import-code">#</code> se convierte en bloques (mismas reglas
            que la importación por sección). Puedes añadir al final o reemplazar todas las secciones existentes.
          </p>
          <button
            type="button"
            class="btn btn--ghost btn--sm"
            onclick={() => (showBookMarkdownImport = true)}
          >
            Importar manuscrito Markdown
          </button>
        </section>

        <!-- ── Sección: Información del sistema ───────────────────────────── -->
        <section class="form-section">
          <h2 class="form-section-title">Información del sistema</h2>
          <div class="meta-table">
            <div class="meta-row">
              <span class="meta-key">ID del libro</span>
              <span class="meta-val meta-val--mono">{book.id}</span>
            </div>
            <div class="meta-row">
              <span class="meta-key">Creado</span>
              <span class="meta-val">{formatDate(book.createdAt)}</span>
            </div>
            <div class="meta-row">
              <span class="meta-key">Última actualización</span>
              <span class="meta-val">{formatDate(book.updatedAt)}</span>
            </div>
          </div>
        </section>

        <!-- ── Zona de peligro ─────────────────────────────────────────────── -->
        <section class="form-section form-section--danger">
          <h2 class="form-section-title form-section-title--danger">Zona de peligro</h2>
          <div class="danger-row">
            <div class="danger-desc">
              <strong>Eliminar este libro</strong>
              <p>Se eliminarán permanentemente el libro, todas sus secciones y bloques. Esta acción no se puede deshacer.</p>
            </div>
            <button
              type="button"
              class="btn btn--danger-outline"
              onclick={() => (confirmDelete = true)}
              disabled={deleting}
            >
              Eliminar libro
            </button>
          </div>
        </section>

      </form>
    {/if}
  </div>
</div>

<style>
  .overview-page {
    display: flex;
    flex-direction: column;
    flex: 1;
    background: #0f0f1a;
    color: #e8e8f4;
    font-family: 'Helvetica Neue', Arial, sans-serif;
    min-height: 0;
    overflow-y: auto;
  }

  /* ── Page header ──────────────────────────────────────────────────────────── */
  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 40px;
    height: 60px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    flex-shrink: 0;
    gap: 16px;
  }

  .page-header-left { display: flex; align-items: baseline; gap: 14px; }

  .page-title {
    font-size: 16px;
    font-weight: 700;
    color: rgba(255,255,255,0.9);
    margin: 0;
  }

  .page-updated {
    font-size: 11px;
    color: rgba(255,255,255,0.3);
  }

  .page-header-right { display: flex; align-items: center; gap: 8px; }

  /* ── Alerts ───────────────────────────────────────────────────────────────── */
  .alert {
    padding: 10px 40px;
    font-size: 12px;
    border-bottom: 1px solid transparent;
  }

  .alert--error {
    background: rgba(200,60,60,0.1);
    border-color: rgba(200,80,80,0.2);
    color: #f09090;
  }

  .alert--info {
    background: rgba(122,184,232,0.07);
    border-color: rgba(122,184,232,0.15);
    color: rgba(122,184,232,0.8);
  }

  .alert--success {
    background: rgba(80, 180, 120, 0.1);
    border-color: rgba(80, 200, 130, 0.22);
    color: rgba(140, 220, 170, 0.95);
  }

  .import-manuscript-lead {
    font-size: 13px;
    line-height: 1.55;
    color: rgba(255, 255, 255, 0.45);
    margin: 0;
    max-width: 52rem;
  }

  .import-code {
    font-family: ui-monospace, 'Cascadia Code', 'Segoe UI Mono', monospace;
    font-size: 0.88em;
    padding: 1px 5px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.07);
    color: rgba(200, 220, 255, 0.92);
  }

  /* ── Body ─────────────────────────────────────────────────────────────────── */
  .overview-body {
    flex: 1;
    padding: 36px 40px 60px;
    max-width: 760px;
  }

  /* ── States ───────────────────────────────────────────────────────────────── */
  .state-loading, .state-error {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    padding: 40px 0;
    color: rgba(255,255,255,0.4);
    font-size: 13px;
  }

  .spinner {
    width: 28px; height: 28px;
    border: 3px solid rgba(255,255,255,0.08);
    border-top-color: #7ab8e8;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .state-error {
    color: #f09090;
    background: rgba(200,60,60,0.08);
    border: 1px solid rgba(200,80,80,0.2);
    border-radius: 10px;
    padding: 20px 24px;
  }
  .state-error strong { font-size: 14px; }
  .state-error p { margin: 0; font-size: 13px; color: rgba(255,255,255,0.5); }

  /* ── Form ─────────────────────────────────────────────────────────────────── */
  .meta-form {
    display: flex;
    flex-direction: column;
    gap: 36px;
  }

  .form-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .form-section-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.3);
    margin: 0 0 4px;
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }

  .form-section--danger .form-section-title--danger {
    color: rgba(220,100,100,0.5);
  }

  /* Fields */
  .field { display: flex; flex-direction: column; gap: 5px; position: relative; }
  .field--full { width: 100%; }

  .field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .field-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(255,255,255,0.4);
  }

  .required { color: #7ab8e8; }

  .field-input {
    width: 100%;
    padding: 9px 12px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 7px;
    color: #e8e8f4;
    font-size: 13px;
    font-family: inherit;
    outline: none;
    transition: border-color 0.12s, background 0.12s;
  }

  .field-input:focus {
    border-color: rgba(122,184,232,0.55);
    background: rgba(255,255,255,0.06);
  }

  .field-input::placeholder { color: rgba(255,255,255,0.2); }
  .field-input:disabled { opacity: 0.5; }

  .field-textarea { resize: vertical; min-height: 96px; }

  .field-select { cursor: pointer; }
  .field-select option { background: #1a1a2e; color: #e8e8f4; }

  .field-hint {
    font-size: 10px;
    color: rgba(255,255,255,0.2);
    text-align: right;
    margin-top: -2px;
  }

  .field-status-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    position: absolute;
    bottom: 11px;
    right: 12px;
    pointer-events: none;
    transition: background 0.2s;
  }

  /* System meta table */
  .meta-table {
    display: flex;
    flex-direction: column;
    gap: 0;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 8px;
    overflow: hidden;
  }

  .meta-row {
    display: flex;
    align-items: center;
    padding: 10px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .meta-row:last-child { border-bottom: none; }

  .meta-key {
    font-size: 12px;
    color: rgba(255,255,255,0.35);
    width: 180px;
    flex-shrink: 0;
  }

  .meta-val {
    font-size: 12px;
    color: rgba(255,255,255,0.7);
  }

  .meta-val--mono {
    font-family: 'SF Mono', 'Fira Mono', monospace;
    font-size: 11px;
    color: rgba(255,255,255,0.45);
    word-break: break-all;
  }

  /* Danger zone */
  .danger-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    padding: 20px 24px;
    background: rgba(200,60,60,0.05);
    border: 1px solid rgba(200,80,80,0.15);
    border-radius: 10px;
  }

  .danger-desc {
    flex: 1;
  }

  .danger-desc strong {
    display: block;
    font-size: 13px;
    color: rgba(255,255,255,0.7);
    margin-bottom: 4px;
  }

  .danger-desc p {
    font-size: 12px;
    color: rgba(255,255,255,0.35);
    margin: 0;
    line-height: 1.5;
  }

  /* ── Buttons ──────────────────────────────────────────────────────────────── */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 9px 18px;
    border-radius: 7px;
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    border: none;
    text-decoration: none;
    line-height: 1;
    transition: opacity 0.12s, background 0.12s, color 0.12s;
    white-space: nowrap;
  }

  .btn--sm { padding: 7px 14px; font-size: 12px; }

  .btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .btn--primary { background: #7ab8e8; color: #0d1117; }
  .btn--primary:hover:not(:disabled) { background: #91c6f0; }

  .btn--ghost {
    background: rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.6);
    border: 1px solid rgba(255,255,255,0.1);
  }
  .btn--ghost:hover:not(:disabled) { background: rgba(255,255,255,0.1); }

  .btn--danger { background: rgba(220,70,70,0.9); color: #fff; }
  .btn--danger:hover:not(:disabled) { background: #dc4646; }

  .btn--danger-outline {
    background: transparent;
    color: rgba(220,100,100,0.8);
    border: 1px solid rgba(220,80,80,0.35);
    flex-shrink: 0;
  }
  .btn--danger-outline:hover:not(:disabled) {
    background: rgba(220,60,60,0.1);
    border-color: rgba(220,80,80,0.6);
    color: #f08080;
  }

  .btn-spinner {
    width: 12px; height: 12px;
    border: 2px solid rgba(0,0,0,0.2);
    border-top-color: #0d1117;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  .btn-spinner--dark {
    border-color: rgba(255,255,255,0.15);
    border-top-color: rgba(255,255,255,0.7);
  }

  /* ── Dialog ───────────────────────────────────────────────────────────────── */
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.65);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(3px);
  }

  .dialog {
    background: #1a1a2e;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 12px;
    padding: 28px 32px;
    max-width: 440px;
    width: 90%;
    box-shadow: 0 20px 60px rgba(0,0,0,0.6);
  }

  .dialog-title {
    font-size: 16px;
    font-weight: 700;
    margin: 0 0 12px;
    color: #fff;
  }

  .dialog-body {
    font-size: 13px;
    color: rgba(255,255,255,0.6);
    line-height: 1.65;
    margin: 0 0 24px;
  }

  .dialog-body strong { color: rgba(255,255,255,0.9); }

  .dialog-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
  }
</style>
