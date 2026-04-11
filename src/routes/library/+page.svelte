<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { listBooks, deleteBook, statusLabel, statusColor, formatDate } from '$lib/services/books.service';
  import type { BookProject } from '$lib/core/domain/index';

  // ── Estado ────────────────────────────────────────────────────────────────
  let books      = $state<BookProject[]>([]);
  let loading    = $state(true);
  let error      = $state<string | null>(null);
  let deletingId = $state<string | null>(null);
  let confirmId  = $state<string | null>(null);  // ID pendiente de confirmación

  // ── Carga inicial ─────────────────────────────────────────────────────────
  onMount(async () => {
    await loadBooks();
  });

  async function loadBooks() {
    loading = true;
    error   = null;
    try {
      books = await listBooks();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  // ── Acciones ──────────────────────────────────────────────────────────────
  function openBook(id: string) {
    goto(`/books/${id}/overview`);
  }

  function requestDelete(e: MouseEvent, id: string) {
    e.stopPropagation();
    confirmId = id;
  }

  function cancelDelete() {
    confirmId = null;
  }

  async function confirmDelete() {
    if (!confirmId) return;
    const id = confirmId;
    confirmId  = null;
    deletingId = id;
    try {
      await deleteBook(id);
      books = books.filter(b => b.id !== id);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      deletingId = null;
    }
  }
</script>

<svelte:head>
  <title>Biblioteca — MIDOO BOOKS</title>
</svelte:head>

<!-- ── Contenedor de confirmación de borrado ─────────────────────────────── -->
{#if confirmId}
  {@const book = books.find(b => b.id === confirmId)}
  <div class="overlay" role="dialog" aria-modal="true">
    <div class="dialog">
      <h3 class="dialog-title">Eliminar libro</h3>
      <p class="dialog-body">
        ¿Eliminar <strong>"{book?.title}"</strong>? Esta acción no se puede deshacer.
        Se borrarán también todas las secciones y bloques del libro.
      </p>
      <div class="dialog-actions">
        <button class="btn btn--ghost" onclick={cancelDelete}>Cancelar</button>
        <button class="btn btn--danger" onclick={confirmDelete}>Eliminar</button>
      </div>
    </div>
  </div>
{/if}

<!-- ── Shell ─────────────────────────────────────────────────────────────── -->
<div class="library-shell">

  <!-- Header -->
  <header class="lib-header">
    <div class="lib-brand">
      <span class="lib-brand-text">MIDOO BOOKS</span>
      <span class="lib-brand-sub">Biblioteca</span>
    </div>
    <div class="lib-header-actions">
      <a href="/books/new" class="btn btn--primary">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor">
          <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        Nuevo libro
      </a>
    </div>
  </header>

  <!-- Contenido principal -->
  <main class="lib-main">

    {#if loading}
      <div class="state-center">
        <div class="spinner"></div>
        <span>Cargando biblioteca…</span>
      </div>

    {:else if error}
      <div class="state-center">
        <div class="error-box">
          <strong>Error al cargar la biblioteca</strong>
          <p>{error}</p>
          <button class="btn btn--ghost" onclick={loadBooks}>Reintentar</button>
        </div>
      </div>

    {:else if books.length === 0}
      <!-- Empty state -->
      <div class="empty">
        <div class="empty-icon">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
        </div>
        <h2>Sin proyectos todavía</h2>
        <p>Crea tu primer libro para empezar a trabajar.</p>
        <a href="/books/new" class="btn btn--primary btn--lg">Crear primer libro</a>
      </div>

    {:else}
      <!-- Grid de libros -->
      <section class="grid-section">
        <div class="section-header">
          <h2 class="section-label">Proyectos</h2>
          <span class="section-count">{books.length} libro{books.length !== 1 ? 's' : ''}</span>
        </div>

        <div class="book-grid">
          {#each books as book (book.id)}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="book-card"
              class:book-card--deleting={deletingId === book.id}
              onclick={() => openBook(book.id)}
            >
              <!-- Portada -->
              <div class="book-cover">
                <div class="book-cover-gradient"></div>
                <span class="book-initials">{book.title.slice(0, 2).toUpperCase()}</span>
                <!-- Badge de estado -->
                <span class="status-badge" style:--status-color={statusColor(book.status)}>
                  {statusLabel(book.status)}
                </span>
              </div>

              <!-- Info -->
              <div class="book-info">
                <h3 class="book-title">{book.title}</h3>
                {#if book.subtitle}
                  <p class="book-subtitle">{book.subtitle}</p>
                {/if}
                {#if book.authorName}
                  <p class="book-author">{book.authorName}</p>
                {/if}
                {#if book.description}
                  <p class="book-desc">{book.description}</p>
                {/if}
              </div>

              <!-- Footer de la tarjeta -->
              <div class="book-footer">
                <span class="book-date">{formatDate(book.updatedAt)}</span>
                <div class="book-actions">
                  <button
                    class="card-btn card-btn--delete"
                    title="Eliminar libro"
                    onclick={(e) => requestDelete(e, book.id)}
                    disabled={deletingId === book.id}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14H6L5 6"/>
                      <path d="M10 11v6M14 11v6"/>
                      <path d="M9 6V4h6v2"/>
                    </svg>
                  </button>
                  <button class="card-btn card-btn--open" title="Abrir">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </section>
    {/if}

  </main>
</div>

<style>
  /* ── Shell ───────────────────────────────────────────────────────────────── */
  .library-shell {
    min-height: 100vh;
    background: #0f0f1a;
    color: #e8e8f4;
    display: flex;
    flex-direction: column;
    font-family: 'Helvetica Neue', Arial, sans-serif;
  }

  /* ── Header ──────────────────────────────────────────────────────────────── */
  .lib-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 40px;
    height: 60px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    flex-shrink: 0;
    background: #0f0f1a;
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .lib-brand { display: flex; align-items: baseline; gap: 10px; }

  .lib-brand-text {
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 0.1em;
    color: #7ab8e8;
  }

  .lib-brand-sub {
    font-size: 12px;
    color: rgba(255,255,255,0.35);
    letter-spacing: 0.04em;
  }

  .lib-header-actions { display: flex; align-items: center; gap: 10px; }

  /* ── Main ─────────────────────────────────────────────────────────────────── */
  .lib-main {
    flex: 1;
    padding: 40px;
    max-width: 1300px;
    width: 100%;
    margin: 0 auto;
  }

  /* ── Botones globales ─────────────────────────────────────────────────────── */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    border: none;
    text-decoration: none;
    line-height: 1;
    transition: opacity 0.12s, background 0.12s;
    white-space: nowrap;
  }

  .btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .btn--primary {
    background: #7ab8e8;
    color: #0d1117;
  }
  .btn--primary:hover:not(:disabled) { background: #91c6f0; }

  .btn--ghost {
    background: rgba(255,255,255,0.07);
    color: rgba(255,255,255,0.7);
    border: 1px solid rgba(255,255,255,0.12);
  }
  .btn--ghost:hover:not(:disabled) { background: rgba(255,255,255,0.12); }

  .btn--danger {
    background: rgba(220, 70, 70, 0.9);
    color: #fff;
  }
  .btn--danger:hover:not(:disabled) { background: #dc4646; }

  .btn--lg { padding: 11px 22px; font-size: 14px; }

  /* ── Estados de carga / error / vacío ─────────────────────────────────────── */
  .state-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 100px 20px;
    color: rgba(255,255,255,0.4);
    font-size: 13px;
  }

  .spinner {
    width: 32px; height: 32px;
    border: 3px solid rgba(255,255,255,0.08);
    border-top-color: #7ab8e8;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .error-box {
    background: rgba(200,60,60,0.12);
    border: 1px solid rgba(200,80,80,0.3);
    border-radius: 10px;
    padding: 24px 32px;
    text-align: center;
    max-width: 420px;
    color: #f08080;
  }
  .error-box strong { display: block; margin-bottom: 8px; font-size: 14px; }
  .error-box p { margin: 0 0 16px; font-size: 13px; }

  /* Empty */
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 100px 20px;
    gap: 12px;
    color: rgba(255,255,255,0.45);
  }

  .empty-icon { color: rgba(255,255,255,0.15); margin-bottom: 8px; }

  .empty h2 {
    font-size: 22px;
    font-weight: 700;
    color: rgba(255,255,255,0.75);
    margin: 0;
  }

  .empty p { font-size: 14px; margin: 0 0 8px; }

  /* ── Grid ─────────────────────────────────────────────────────────────────── */

  .section-header {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 24px;
  }

  .section-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.35);
    margin: 0;
  }

  .section-count {
    font-size: 11px;
    color: rgba(255,255,255,0.2);
  }

  .book-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
    gap: 20px;
  }

  /* ── Tarjeta de libro ─────────────────────────────────────────────────────── */
  .book-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 10px;
    overflow: hidden;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
    position: relative;
  }

  .book-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 40px rgba(0,0,0,0.45);
    border-color: rgba(122,184,232,0.3);
  }

  .book-card--deleting {
    opacity: 0.4;
    pointer-events: none;
  }

  /* Portada */
  .book-cover {
    height: 148px;
    background: linear-gradient(145deg, #1d2d4e 0%, #0d0d1a 100%);
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .book-cover-gradient {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse at 30% 40%, rgba(122,184,232,0.12) 0%, transparent 60%),
      radial-gradient(ellipse at 70% 70%, rgba(80,50,130,0.15) 0%, transparent 60%);
  }

  .book-initials {
    font-size: 36px;
    font-weight: 800;
    letter-spacing: 0.06em;
    color: rgba(255,255,255,0.12);
    position: relative;
    z-index: 1;
    user-select: none;
  }

  .status-badge {
    position: absolute;
    bottom: 10px;
    right: 10px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--status-color);
    background: rgba(0,0,0,0.45);
    border: 1px solid var(--status-color);
    padding: 2px 8px;
    border-radius: 10px;
    z-index: 2;
  }

  /* Info */
  .book-info {
    padding: 16px 18px 12px;
    flex: 1;
  }

  .book-title {
    font-size: 14px;
    font-weight: 700;
    color: #fff;
    margin: 0 0 4px;
    line-height: 1.35;
  }

  .book-subtitle {
    font-size: 12px;
    font-style: italic;
    color: rgba(255,255,255,0.45);
    margin: 0 0 5px;
  }

  .book-author {
    font-size: 10px;
    color: #7ab8e8;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 6px;
  }

  .book-desc {
    font-size: 11px;
    color: rgba(255,255,255,0.38);
    margin: 0;
    line-height: 1.55;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Footer */
  .book-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px 12px;
    border-top: 1px solid rgba(255,255,255,0.06);
  }

  .book-date {
    font-size: 10px;
    color: rgba(255,255,255,0.25);
  }

  .book-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .card-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px; height: 28px;
    border-radius: 5px;
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
    color: rgba(255,255,255,0.35);
    transition: background 0.12s, color 0.12s, border-color 0.12s;
  }

  .card-btn:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.75); border-color: rgba(255,255,255,0.12); }

  .card-btn--delete:hover { background: rgba(220,80,80,0.15); color: #e07070; border-color: rgba(220,80,80,0.3); }

  .card-btn--open:hover { background: rgba(122,184,232,0.12); color: #7ab8e8; border-color: rgba(122,184,232,0.25); }

  /* ── Modal de confirmación ────────────────────────────────────────────────── */
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
    max-width: 420px;
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
    line-height: 1.6;
    margin: 0 0 24px;
  }

  .dialog-body strong { color: rgba(255,255,255,0.9); }

  .dialog-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
  }
</style>
