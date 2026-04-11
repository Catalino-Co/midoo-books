<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { getBook } from '$lib/services/books.service';
  import type { BookProject } from '$lib/core/domain/index';

  const { children } = $props();

  // ── Estado ────────────────────────────────────────────────────────────────
  let book    = $state<BookProject | null>(null);
  let loading = $state(true);

  // Derivar bookId de la URL reactivamente
  let bookId = $derived($page.params.bookId);

  // Módulo activo (segmento de la URL después del bookId)
  let activeModule = $derived(() => {
    const segments = $page.url.pathname.split('/');
    return segments[segments.length - 1] || 'overview';
  });

  onMount(async () => {
    await loadBook();
  });

  async function loadBook() {
    loading = true;
    try {
      book = await getBook(bookId);
    } catch {
      book = null;
    } finally {
      loading = false;
    }
  }

  // Cuando cambia el bookId (navegación entre libros), recargamos
  $effect(() => {
    if (bookId) loadBook();
  });

  // ── Módulos de navegación ─────────────────────────────────────────────────
  const modules = [
    { id: 'overview', label: 'Descripción',  icon: '📋', implemented: true },
    { id: 'content',  label: 'Contenido',    icon: '✏️',  implemented: false },
    { id: 'assets',   label: 'Assets',       icon: '🖼️',  implemented: false },
    { id: 'styles',   label: 'Estilos',      icon: '🎨',  implemented: false },
    { id: 'layout',   label: 'Maqueta',      icon: '📐',  implemented: false },
    { id: 'preview',  label: 'Vista previa', icon: '👁️',  implemented: false },
    { id: 'export',   label: 'Exportar',     icon: '📤',  implemented: false },
  ] as const;
</script>

<div class="book-shell">

  <!-- ── Sidebar ─────────────────────────────────────────────────────────── -->
  <aside class="sidebar">

    <!-- Back to library -->
    <a href="/library" class="sidebar-back">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 12H5M12 5l-7 7 7 7"/>
      </svg>
      Biblioteca
    </a>

    <!-- Book identity -->
    <div class="sidebar-book-id">
      {#if loading}
        <div class="sidebar-book-loading"></div>
      {:else if book}
        <div class="sidebar-book-cover">
          {book.title.slice(0, 2).toUpperCase()}
        </div>
        <div class="sidebar-book-meta">
          <span class="sidebar-book-title">{book.title}</span>
          {#if book.authorName}
            <span class="sidebar-book-author">{book.authorName}</span>
          {/if}
        </div>
      {:else}
        <span class="sidebar-book-notfound">Libro no encontrado</span>
      {/if}
    </div>

    <!-- Divider -->
    <div class="sidebar-divider"></div>

    <!-- Nav modules -->
    <nav class="sidebar-nav">
      {#each modules as mod (mod.id)}
        {@const isActive = $page.url.pathname.endsWith('/' + mod.id)}
        {#if mod.implemented}
          <a
            href="/books/{bookId}/{mod.id}"
            class="nav-item"
            class:nav-item--active={isActive}
          >
            <span class="nav-icon">{mod.icon}</span>
            <span class="nav-label">{mod.label}</span>
          </a>
        {:else}
          <div class="nav-item nav-item--disabled" title="Próximamente">
            <span class="nav-icon">{mod.icon}</span>
            <span class="nav-label">{mod.label}</span>
            <span class="nav-soon">pronto</span>
          </div>
        {/if}
      {/each}
    </nav>

    <!-- Divider -->
    <div class="sidebar-divider"></div>

    <!-- Paged.js Editor (legacy) -->
    {#if book}
      <!-- link a la vista Paged.js si el libro viene del sistema de archivos (legacy) -->
    {/if}

    <!-- Spacer -->
    <div class="sidebar-spacer"></div>

  </aside>

  <!-- ── Main content ────────────────────────────────────────────────────── -->
  <div class="book-main">
    {@render children()}
  </div>

</div>

<style>
  .book-shell {
    display: flex;
    height: 100vh;
    background: #0f0f1a;
    color: #e8e8f4;
    font-family: 'Helvetica Neue', Arial, sans-serif;
    overflow: hidden;
  }

  /* ── Sidebar ──────────────────────────────────────────────────────────────── */
  .sidebar {
    width: 220px;
    min-width: 220px;
    background: #0b0b16;
    border-right: 1px solid rgba(255,255,255,0.06);
    display: flex;
    flex-direction: column;
    padding: 0;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.06) transparent;
  }

  /* Back link */
  .sidebar-back {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 16px 18px 14px;
    font-size: 12px;
    color: rgba(255,255,255,0.35);
    text-decoration: none;
    transition: color 0.12s;
    flex-shrink: 0;
  }
  .sidebar-back:hover { color: rgba(255,255,255,0.7); }

  /* Book identity */
  .sidebar-book-id {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 10px 16px 16px;
    flex-shrink: 0;
  }

  .sidebar-book-cover {
    width: 36px;
    height: 36px;
    border-radius: 7px;
    background: linear-gradient(145deg, #1d2d4e 0%, #0d0d1a 100%);
    border: 1px solid rgba(122,184,232,0.18);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 800;
    color: rgba(122,184,232,0.7);
    letter-spacing: 0.04em;
    flex-shrink: 0;
  }

  .sidebar-book-meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .sidebar-book-title {
    font-size: 12px;
    font-weight: 700;
    color: rgba(255,255,255,0.85);
    line-height: 1.35;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sidebar-book-author {
    font-size: 10px;
    color: rgba(255,255,255,0.3);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sidebar-book-loading {
    width: 36px; height: 36px;
    border-radius: 7px;
    background: rgba(255,255,255,0.05);
    animation: pulse 1.4s ease-in-out infinite;
    flex-shrink: 0;
  }
  @keyframes pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }

  .sidebar-book-notfound {
    font-size: 12px;
    color: rgba(255,255,255,0.3);
    font-style: italic;
  }

  /* Divider */
  .sidebar-divider {
    height: 1px;
    background: rgba(255,255,255,0.05);
    margin: 4px 0;
    flex-shrink: 0;
  }

  /* Nav */
  .sidebar-nav {
    display: flex;
    flex-direction: column;
    padding: 6px 8px;
    gap: 1px;
    flex-shrink: 0;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 7px;
    font-size: 13px;
    color: rgba(255,255,255,0.5);
    text-decoration: none;
    transition: background 0.12s, color 0.12s;
    cursor: pointer;
    user-select: none;
    position: relative;
  }

  .nav-item:not(.nav-item--disabled):hover {
    background: rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.85);
  }

  .nav-item--active {
    background: rgba(122,184,232,0.12) !important;
    color: #7ab8e8 !important;
  }

  .nav-item--disabled {
    cursor: default;
    opacity: 0.4;
  }

  .nav-icon { font-size: 14px; flex-shrink: 0; }

  .nav-label { flex: 1; font-size: 13px; }

  .nav-soon {
    font-size: 9px;
    color: rgba(255,255,255,0.25);
    background: rgba(255,255,255,0.06);
    padding: 1px 6px;
    border-radius: 8px;
    letter-spacing: 0.04em;
  }

  /* Spacer */
  .sidebar-spacer { flex: 1; }

  /* ── Main content ─────────────────────────────────────────────────────────── */
  .book-main {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
</style>
