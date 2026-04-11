<script lang="ts">
  import { goto } from '$app/navigation';
  import { createBook } from '$lib/services/books.service';
  import type { BookStatus } from '$lib/core/domain/index';

  // ── Estado del formulario ─────────────────────────────────────────────────
  let title       = $state('');
  let subtitle    = $state('');
  let authorName  = $state('');
  let description = $state('');
  let languageCode = $state('es');
  let status      = $state<BookStatus>('draft');

  let saving  = $state(false);
  let error   = $state<string | null>(null);

  // ── Validación ────────────────────────────────────────────────────────────
  let canSubmit = $derived(title.trim().length >= 1 && !saving);

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    saving = true;
    error  = null;
    try {
      const book = await createBook({
        title:        title.trim(),
        subtitle:     subtitle.trim()     || undefined,
        authorName:   authorName.trim()   || undefined,
        description:  description.trim()  || undefined,
        languageCode: languageCode        || undefined,
        status,
      });
      goto(`/books/${book.id}/overview`, { replaceState: true });
    } catch (e) {
      error  = e instanceof Error ? e.message : String(e);
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Nuevo libro — MIDOO BOOKS</title>
</svelte:head>

<div class="page">
  <!-- Top bar -->
  <header class="topbar">
    <a href="/library" class="back-link">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 12H5M12 5l-7 7 7 7"/>
      </svg>
      Biblioteca
    </a>
    <span class="topbar-title">Nuevo libro</span>
    <div></div><!-- spacer -->
  </header>

  <!-- Contenido -->
  <main class="main">
    <div class="form-card">

      <div class="form-card-header">
        <h1 class="form-title">Crear proyecto de libro</h1>
        <p class="form-subtitle">Completa la información básica. Podrás editarla en cualquier momento.</p>
      </div>

      {#if error}
        <div class="alert-error">
          <strong>Error al crear el libro:</strong> {error}
        </div>
      {/if}

      <form onsubmit={handleSubmit} class="form">

        <!-- Título -->
        <div class="field field--required">
          <label class="field-label" for="f-title">Título</label>
          <input
            id="f-title"
            class="field-input"
            type="text"
            placeholder="El título de tu libro"
            bind:value={title}
            maxlength={200}
            autocomplete="off"
            disabled={saving}
            required
          />
        </div>

        <!-- Subtítulo -->
        <div class="field">
          <label class="field-label" for="f-subtitle">Subtítulo <span class="field-optional">(opcional)</span></label>
          <input
            id="f-subtitle"
            class="field-input"
            type="text"
            placeholder="Subtítulo o tagline del libro"
            bind:value={subtitle}
            maxlength={300}
            disabled={saving}
          />
        </div>

        <!-- Autor -->
        <div class="field">
          <label class="field-label" for="f-author">Autor / autora <span class="field-optional">(opcional)</span></label>
          <input
            id="f-author"
            class="field-input"
            type="text"
            placeholder="Nombre del autor o autora"
            bind:value={authorName}
            maxlength={200}
            disabled={saving}
          />
        </div>

        <!-- Descripción -->
        <div class="field">
          <label class="field-label" for="f-desc">Descripción <span class="field-optional">(opcional)</span></label>
          <textarea
            id="f-desc"
            class="field-input field-textarea"
            placeholder="Breve descripción del libro…"
            bind:value={description}
            maxlength={1000}
            rows={3}
            disabled={saving}
          ></textarea>
        </div>

        <!-- Idioma + Estado (columnas) -->
        <div class="field-row">
          <div class="field">
            <label class="field-label" for="f-lang">Idioma</label>
            <select id="f-lang" class="field-input field-select" bind:value={languageCode} disabled={saving}>
              <option value="es">Español</option>
              <option value="en">English</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="pt">Português</option>
              <option value="it">Italiano</option>
            </select>
          </div>

          <div class="field">
            <label class="field-label" for="f-status">Estado inicial</label>
            <select id="f-status" class="field-input field-select" bind:value={status} disabled={saving}>
              <option value="draft">Borrador</option>
              <option value="in_progress">En progreso</option>
              <option value="complete">Completado</option>
              <option value="archived">Archivado</option>
            </select>
          </div>
        </div>

        <!-- Acciones -->
        <div class="form-actions">
          <a href="/library" class="btn btn--ghost" aria-disabled={saving}>Cancelar</a>
          <button type="submit" class="btn btn--primary" disabled={!canSubmit}>
            {#if saving}
              <span class="btn-spinner"></span>
              Creando…
            {:else}
              Crear libro
            {/if}
          </button>
        </div>

      </form>
    </div>
  </main>
</div>

<style>
  .page {
    min-height: 100vh;
    background: #0f0f1a;
    color: #e8e8f4;
    font-family: 'Helvetica Neue', Arial, sans-serif;
    display: flex;
    flex-direction: column;
  }

  /* ── Topbar ───────────────────────────────────────────────────────────────── */
  .topbar {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    padding: 0 32px;
    height: 56px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    flex-shrink: 0;
  }

  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
    color: rgba(255,255,255,0.45);
    text-decoration: none;
    transition: color 0.12s;
  }
  .back-link:hover { color: rgba(255,255,255,0.8); }

  .topbar-title {
    font-size: 13px;
    font-weight: 600;
    color: rgba(255,255,255,0.6);
    text-align: center;
  }

  /* ── Main ─────────────────────────────────────────────────────────────────── */
  .main {
    flex: 1;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 52px 24px;
  }

  /* ── Tarjeta de formulario ────────────────────────────────────────────────── */
  .form-card {
    width: 100%;
    max-width: 560px;
    background: rgba(255,255,255,0.025);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px;
    overflow: hidden;
  }

  .form-card-header {
    padding: 32px 36px 24px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }

  .form-title {
    font-size: 20px;
    font-weight: 800;
    color: #fff;
    margin: 0 0 6px;
  }

  .form-subtitle {
    font-size: 13px;
    color: rgba(255,255,255,0.4);
    margin: 0;
    line-height: 1.5;
  }

  /* ── Alert ────────────────────────────────────────────────────────────────── */
  .alert-error {
    margin: 20px 36px 0;
    padding: 12px 16px;
    background: rgba(220,60,60,0.12);
    border: 1px solid rgba(220,80,80,0.3);
    border-radius: 7px;
    font-size: 13px;
    color: #f09090;
  }

  /* ── Formulario ───────────────────────────────────────────────────────────── */
  .form {
    padding: 24px 36px 32px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .field { display: flex; flex-direction: column; gap: 6px; }

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
    color: rgba(255,255,255,0.45);
  }

  /* required marker moved inline in HTML */

  .field-optional { font-weight: 400; text-transform: none; letter-spacing: 0; opacity: 0.6; }

  .field-input {
    width: 100%;
    padding: 9px 12px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 7px;
    color: #e8e8f4;
    font-size: 13px;
    font-family: inherit;
    outline: none;
    transition: border-color 0.12s, background 0.12s;
  }

  .field-input:focus {
    border-color: rgba(122,184,232,0.6);
    background: rgba(255,255,255,0.07);
  }

  .field-input::placeholder { color: rgba(255,255,255,0.25); }
  .field-input:disabled { opacity: 0.5; }

  .field-textarea { resize: vertical; min-height: 80px; }

  .field-select { cursor: pointer; }
  .field-select option { background: #1a1a2e; color: #e8e8f4; }

  /* ── Acciones ─────────────────────────────────────────────────────────────── */
  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding-top: 8px;
    border-top: 1px solid rgba(255,255,255,0.06);
    margin-top: 4px;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 9px 20px;
    border-radius: 7px;
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    border: none;
    text-decoration: none;
    line-height: 1;
    transition: opacity 0.12s, background 0.12s;
  }

  .btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .btn--primary { background: #7ab8e8; color: #0d1117; }
  .btn--primary:hover:not(:disabled) { background: #91c6f0; }

  .btn--ghost {
    background: rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.6);
    border: 1px solid rgba(255,255,255,0.1);
  }
  .btn--ghost:hover { background: rgba(255,255,255,0.1); }

  .btn-spinner {
    width: 13px; height: 13px;
    border: 2px solid rgba(0,0,0,0.2);
    border-top-color: #0d1117;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
