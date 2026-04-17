<script lang="ts">
  /**
   * Módulo Content — Estructura Editorial del Libro
   *
   * Layout 3-paneles:
   *   [Panel Secciones 240px] | [Panel Bloques flex] | [Inspector 280px]
   *
   * Estado gestionado localmente con Svelte 5 runes.
   * Persistencia vía content.service.ts → IPlatformAdapter → IPC → SQLite.
   */

  import { onMount }   from 'svelte';
  import { page }      from '$app/stores';
  import {
    listSections, createSection, updateSection, deleteSection, moveSectionInList,
    duplicateSection,
    listBlocks,   createBlock,   updateBlock,   deleteBlock,   moveBlockInList,
    sectionTypeLabel,
    getSectionCreationDefaults,
    blockTypeLabel,   blockTypeIcon,    ALL_BLOCK_TYPES,
    styleVariantLabel, ALL_STYLE_VARIANTS,
    blockHasTextContent, blockContentPreview,
  } from '$lib/services/content.service';
  import SectionTypeSelect from '$lib/components/SectionTypeSelect.svelte';
  import type {
    DocumentSection, SectionType,
    DocumentBlock,   BlockType, BlockStyleVariant,
  } from '$lib/core/domain/index';
  import { DEFAULT_SECTION_TYPE } from '$lib/core/domain/index';

  // ── bookId ────────────────────────────────────────────────────────────────
  let bookId = $derived($page.params.bookId);

  // ── Estado principal ──────────────────────────────────────────────────────
  let sections           = $state<DocumentSection[]>([]);
  let selectedSectionId  = $state<string | null>(null);
  let blocks             = $state<DocumentBlock[]>([]);
  let selectedBlockId    = $state<string | null>(null);

  // ── Estado de carga ───────────────────────────────────────────────────────
  let loadingSections = $state(true);
  let loadingBlocks   = $state(false);
  let globalError     = $state<string | null>(null);

  // ── Modales y formularios ─────────────────────────────────────────────────

  // Modal: nueva sección
  let showNewSectionModal    = $state(false);
  let newSectionTitle        = $state('');
  let newSectionType         = $state<SectionType>(DEFAULT_SECTION_TYPE);
  let newSectionIncludeToc   = $state(true);
  let newSectionStartRight   = $state(true);
  let savingNewSection       = $state(false);
  let newSectionError        = $state<string | null>(null);
  let duplicatingSectionId   = $state<string | null>(null);

  // Modal: nuevo bloque
  let showNewBlockModal      = $state(false);
  let newBlockType           = $state<BlockType>('paragraph');
  let newBlockContentText    = $state('');
  let savingNewBlock         = $state(false);
  let newBlockError          = $state<string | null>(null);

  // Confirmación de borrado
  let confirmDeleteSection   = $state<DocumentSection | null>(null);
  let confirmDeleteBlock     = $state<DocumentBlock | null>(null);
  let deleting               = $state(false);

  // Inspector: feedback de guardado
  let inspectorSaving        = $state(false);
  let inspectorSaveOk        = $state(false);
  let inspectorError         = $state<string | null>(null);

  // ── Derivados ─────────────────────────────────────────────────────────────
  let selectedSection = $derived(
    sections.find(s => s.id === selectedSectionId) ?? null
  );
  let selectedBlock = $derived(
    blocks.find(b => b.id === selectedBlockId) ?? null
  );

  // Inspector: ¿qué mostrar?
  let inspectorMode = $derived<'section' | 'block' | 'none'>(
    selectedBlockId   ? 'block'
    : selectedSectionId ? 'section'
    : 'none'
  );

  // ── Inspector: campos editables con $state ────────────────────────────────
  // Los inicializamos cuando cambia la selección (via $effect)

  // Sección
  let insp_sTitle          = $state('');
  let insp_sType           = $state<SectionType>(DEFAULT_SECTION_TYPE);
  let insp_sIncludeToc     = $state(true);
  let insp_sStartRight     = $state(false);

  // Bloque
  let insp_bType           = $state<BlockType>('paragraph');
  let insp_bContentText    = $state('');
  let insp_bStyleVariant   = $state<BlockStyleVariant>('default');
  let insp_bIncludeToc     = $state(false);
  let insp_bKeepTogether   = $state(false);
  let insp_bBreakBefore    = $state(false);
  let insp_bBreakAfter     = $state(false);

  // Suciedad del inspector
  let inspectorDirty = $state(false);

  // ── Carga inicial ─────────────────────────────────────────────────────────
  onMount(async () => {
    await loadSections();
  });

  async function loadSections() {
    loadingSections = true;
    globalError     = null;
    try {
      sections = await listSections(bookId);
      // Seleccionar la primera sección automáticamente
      if (sections.length > 0 && !selectedSectionId) {
        await selectSection(sections[0].id);
      }
    } catch (e) {
      globalError = e instanceof Error ? e.message : String(e);
    } finally {
      loadingSections = false;
    }
  }

  // ── Selección de sección ──────────────────────────────────────────────────
  async function selectSection(id: string) {
    if (selectedSectionId === id) return;
    selectedSectionId = id;
    selectedBlockId   = null;
    resetInspectorDirty();
    await loadBlocksForSection(id);
    syncSectionToInspector();
  }

  async function loadBlocksForSection(sectionId: string) {
    loadingBlocks = true;
    try {
      blocks = await listBlocks(sectionId);
    } catch (e) {
      globalError = e instanceof Error ? e.message : String(e);
    } finally {
      loadingBlocks = false;
    }
  }

  // ── Selección de bloque ───────────────────────────────────────────────────
  function selectBlock(id: string) {
    if (selectedBlockId === id) {
      selectedBlockId = null;  // deselect on second click
      syncSectionToInspector();
    } else {
      selectedBlockId = id;
      const block = blocks.find(b => b.id === id);
      if (block) syncBlockToInspector(block);
    }
    resetInspectorDirty();
  }

  // ── Sincronización inspector ──────────────────────────────────────────────
  function syncSectionToInspector() {
    const s = sections.find(sec => sec.id === selectedSectionId);
    if (!s) return;
    insp_sTitle      = s.title;
    insp_sType       = s.sectionType;
    insp_sIncludeToc = s.includeInToc;
    insp_sStartRight = s.startOnRightPage;
    resetInspectorDirty();
  }

  function syncBlockToInspector(block: DocumentBlock) {
    insp_bType          = block.blockType;
    insp_bContentText   = block.contentText;
    insp_bStyleVariant  = block.styleVariant;
    insp_bIncludeToc    = block.includeInToc;
    insp_bKeepTogether  = block.keepTogether;
    insp_bBreakBefore   = block.pageBreakBefore;
    insp_bBreakAfter    = block.pageBreakAfter;
    resetInspectorDirty();
  }

  function resetInspectorDirty() {
    inspectorDirty = false;
    inspectorSaveOk = false;
    inspectorError  = null;
  }

  function openNewSectionModal() {
    showNewSectionModal  = true;
    newSectionError      = null;
    newSectionTitle      = '';
    newSectionType       = DEFAULT_SECTION_TYPE;
    const d              = getSectionCreationDefaults(DEFAULT_SECTION_TYPE);
    newSectionIncludeToc = d.includeInToc;
    newSectionStartRight = d.startOnRightPage;
  }

  function onNewSectionTypeChange(t: SectionType) {
    newSectionType       = t;
    const d              = getSectionCreationDefaults(t);
    newSectionIncludeToc = d.includeInToc;
    newSectionStartRight = d.startOnRightPage;
  }

  function markInspectorDirty() {
    inspectorDirty  = true;
    inspectorSaveOk = false;
    inspectorError  = null;
  }

  // ── Actualizar sección desde inspector ────────────────────────────────────
  async function saveSection() {
    if (!selectedSectionId || inspectorSaving) return;
    inspectorSaving = true;
    inspectorError  = null;
    try {
      const updated = await updateSection(selectedSectionId, {
        title:           insp_sTitle.trim(),
        sectionType:     insp_sType,
        includeInToc:    insp_sIncludeToc,
        startOnRightPage: insp_sStartRight,
      });
      if (updated) {
        sections = sections.map(s => s.id === updated.id ? updated : s);
        resetInspectorDirty();
        inspectorSaveOk = true;
        setTimeout(() => (inspectorSaveOk = false), 2000);
      }
    } catch (e) {
      inspectorError = e instanceof Error ? e.message : String(e);
    } finally {
      inspectorSaving = false;
    }
  }

  // ── Actualizar bloque desde inspector ─────────────────────────────────────
  async function saveBlock() {
    if (!selectedBlockId || inspectorSaving) return;
    inspectorSaving = true;
    inspectorError  = null;
    try {
      const updated = await updateBlock(selectedBlockId, {
        blockType:       insp_bType,
        contentText:     insp_bContentText,
        styleVariant:    insp_bStyleVariant,
        includeInToc:    insp_bIncludeToc,
        keepTogether:    insp_bKeepTogether,
        pageBreakBefore: insp_bBreakBefore,
        pageBreakAfter:  insp_bBreakAfter,
      });
      if (updated) {
        blocks = blocks.map(b => b.id === updated.id ? updated : b);
        resetInspectorDirty();
        inspectorSaveOk = true;
        setTimeout(() => (inspectorSaveOk = false), 2000);
      }
    } catch (e) {
      inspectorError = e instanceof Error ? e.message : String(e);
    } finally {
      inspectorSaving = false;
    }
  }

  // ── Crear sección ─────────────────────────────────────────────────────────
  async function submitNewSection(e: SubmitEvent) {
    e.preventDefault();
    if (!newSectionTitle.trim() || savingNewSection) return;
    savingNewSection  = true;
    newSectionError   = null;
    try {
      const created = await createSection({
        bookId,
        sectionType:      newSectionType,
        title:            newSectionTitle.trim(),
        includeInToc:     newSectionIncludeToc,
        startOnRightPage: newSectionStartRight,
      });
      sections = [...sections, created].sort((a, b) => a.orderIndex - b.orderIndex);
      showNewSectionModal = false;
      newSectionTitle     = '';
      newSectionType      = DEFAULT_SECTION_TYPE;
      const d             = getSectionCreationDefaults(DEFAULT_SECTION_TYPE);
      newSectionIncludeToc = d.includeInToc;
      newSectionStartRight = d.startOnRightPage;
      await selectSection(created.id);
    } catch (e) {
      newSectionError = e instanceof Error ? e.message : String(e);
    } finally {
      savingNewSection = false;
    }
  }

  // ── Eliminar sección ──────────────────────────────────────────────────────
  async function doDeleteSection() {
    if (!confirmDeleteSection || deleting) return;
    deleting = true;
    const id = confirmDeleteSection.id;
    confirmDeleteSection = null;
    try {
      await deleteSection(id);
      sections = sections.filter(s => s.id !== id);
      if (selectedSectionId === id) {
        selectedSectionId = null;
        selectedBlockId   = null;
        blocks            = [];
        // Seleccionar otra sección si existe
        if (sections.length > 0) {
          await selectSection(sections[0].id);
        }
      }
    } catch (e) {
      globalError = e instanceof Error ? e.message : String(e);
    } finally {
      deleting = false;
    }
  }

  // ── Mover sección ─────────────────────────────────────────────────────────
  async function moveSection(sectionId: string, dir: 'up' | 'down') {
    try {
      sections = await moveSectionInList(sections, sectionId, dir);
    } catch (e) {
      globalError = e instanceof Error ? e.message : String(e);
    }
  }

  async function onDuplicateSection(section: DocumentSection) {
    if (duplicatingSectionId) return;
    duplicatingSectionId = section.id;
    globalError = null;
    try {
      const created = await duplicateSection(bookId, section.id);
      sections = await listSections(bookId);
      await selectSection(created.id);
    } catch (e) {
      globalError = e instanceof Error ? e.message : String(e);
    } finally {
      duplicatingSectionId = null;
    }
  }

  // ── Crear bloque ──────────────────────────────────────────────────────────
  async function submitNewBlock(e: SubmitEvent) {
    e.preventDefault();
    if (!selectedSectionId || savingNewBlock) return;
    savingNewBlock = true;
    newBlockError  = null;
    try {
      const created = await createBlock({
        sectionId:   selectedSectionId,
        blockType:   newBlockType,
        contentText: newBlockContentText.trim(),
      });
      blocks = [...blocks, created].sort((a, b) => a.orderIndex - b.orderIndex);
      showNewBlockModal  = false;
      newBlockType       = 'paragraph';
      newBlockContentText = '';
      selectBlock(created.id);
    } catch (e) {
      newBlockError = e instanceof Error ? e.message : String(e);
    } finally {
      savingNewBlock = false;
    }
  }

  // ── Eliminar bloque ───────────────────────────────────────────────────────
  async function doDeleteBlock() {
    if (!confirmDeleteBlock || deleting) return;
    deleting = true;
    const id = confirmDeleteBlock.id;
    confirmDeleteBlock = null;
    try {
      await deleteBlock(id);
      blocks = blocks.filter(b => b.id !== id);
      if (selectedBlockId === id) {
        selectedBlockId = null;
        syncSectionToInspector();
      }
    } catch (e) {
      globalError = e instanceof Error ? e.message : String(e);
    } finally {
      deleting = false;
    }
  }

  // ── Mover bloque ──────────────────────────────────────────────────────────
  async function moveBlock(blockId: string, dir: 'up' | 'down') {
    try {
      blocks = await moveBlockInList(blocks, blockId, dir);
    } catch (e) {
      globalError = e instanceof Error ? e.message : String(e);
    }
  }
</script>

<svelte:head>
  <title>Contenido — MIDOO BOOKS</title>
</svelte:head>

<!-- ── Modales ────────────────────────────────────────────────────────────── -->

{#if showNewSectionModal}
  <div class="overlay" role="dialog" aria-modal="true">
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">Nueva sección</h3>
        <button class="modal-close" onclick={() => (showNewSectionModal = false)}>✕</button>
      </div>
      <form onsubmit={submitNewSection} class="modal-form">
        {#if newSectionError}
          <div class="alert alert--error">{newSectionError}</div>
        {/if}
        <div class="form-field">
          <label class="form-label" for="ns-type">Tipo de sección</label>
          <SectionTypeSelect
            value={newSectionType}
            disabled={savingNewSection}
            onchange={onNewSectionTypeChange}
          />
        </div>
        <div class="form-field form-field--row">
          <label class="form-label form-label--checkbox" for="ns-toc">
            Incluir en índice
            <span class="form-hint">Según el tipo; puedes cambiarlo antes de crear.</span>
          </label>
          <input
            id="ns-toc" type="checkbox" class="form-checkbox"
            bind:checked={newSectionIncludeToc}
            disabled={savingNewSection}
          />
        </div>
        <div class="form-field form-field--row">
          <label class="form-label form-label--checkbox" for="ns-right">
            Iniciar en página derecha
            <span class="form-hint">Ajuste editorial sugerido para este tipo.</span>
          </label>
          <input
            id="ns-right" type="checkbox" class="form-checkbox"
            bind:checked={newSectionStartRight}
            disabled={savingNewSection}
          />
        </div>
        <div class="form-field">
          <label class="form-label" for="ns-title">Título <span class="req">*</span></label>
          <input
            id="ns-title" class="form-input" type="text"
            bind:value={newSectionTitle}
            placeholder="Ej: Capítulo 1 — El comienzo"
            maxlength={200}
            disabled={savingNewSection}
            required
          />
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn--ghost" onclick={() => (showNewSectionModal = false)} disabled={savingNewSection}>
            Cancelar
          </button>
          <button type="submit" class="btn btn--primary" disabled={!newSectionTitle.trim() || savingNewSection}>
            {#if savingNewSection}<span class="spinner-sm"></span> Creando…{:else}Crear sección{/if}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

{#if showNewBlockModal}
  <div class="overlay" role="dialog" aria-modal="true">
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">Añadir bloque</h3>
        <button class="modal-close" onclick={() => (showNewBlockModal = false)}>✕</button>
      </div>
      <form onsubmit={submitNewBlock} class="modal-form">
        {#if newBlockError}
          <div class="alert alert--error">{newBlockError}</div>
        {/if}
        <div class="form-field">
          <label class="form-label" for="nb-type">Tipo de bloque</label>
          <div class="block-type-grid">
            {#each ALL_BLOCK_TYPES as t}
              <button
                type="button"
                class="block-type-btn"
                class:block-type-btn--active={newBlockType === t}
                onclick={() => (newBlockType = t)}
                disabled={savingNewBlock}
              >
                <svg class="block-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                  <path d={blockTypeIcon(t)}/>
                </svg>
                <span>{blockTypeLabel(t)}</span>
              </button>
            {/each}
          </div>
        </div>
        {#if blockHasTextContent(newBlockType)}
          <div class="form-field">
            <label class="form-label" for="nb-text">Contenido inicial <span class="optional">(opcional)</span></label>
            <textarea
              id="nb-text" class="form-textarea"
              bind:value={newBlockContentText}
              rows={3}
              placeholder="Texto inicial del bloque…"
              disabled={savingNewBlock}
            ></textarea>
          </div>
        {/if}
        <div class="modal-actions">
          <button type="button" class="btn btn--ghost" onclick={() => (showNewBlockModal = false)} disabled={savingNewBlock}>
            Cancelar
          </button>
          <button type="submit" class="btn btn--primary" disabled={savingNewBlock}>
            {#if savingNewBlock}<span class="spinner-sm"></span> Añadiendo…{:else}Añadir bloque{/if}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

{#if confirmDeleteSection}
  <div class="overlay" role="dialog" aria-modal="true">
    <div class="modal modal--sm">
      <h3 class="modal-title">Eliminar sección</h3>
      <p class="modal-body-text">
        ¿Eliminar <strong>"{confirmDeleteSection.title || sectionTypeLabel(confirmDeleteSection.sectionType)}"</strong>?
        Se borrarán también todos sus bloques. Esta acción es permanente.
      </p>
      <div class="modal-actions">
        <button class="btn btn--ghost" onclick={() => (confirmDeleteSection = null)} disabled={deleting}>Cancelar</button>
        <button class="btn btn--danger" onclick={doDeleteSection} disabled={deleting}>
          {#if deleting}<span class="spinner-sm"></span> Eliminando…{:else}Eliminar{/if}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if confirmDeleteBlock}
  <div class="overlay" role="dialog" aria-modal="true">
    <div class="modal modal--sm">
      <h3 class="modal-title">Eliminar bloque</h3>
      <p class="modal-body-text">
        ¿Eliminar este bloque de tipo <strong>{blockTypeLabel(confirmDeleteBlock.blockType)}</strong>? Esta acción es permanente.
      </p>
      <div class="modal-actions">
        <button class="btn btn--ghost" onclick={() => (confirmDeleteBlock = null)} disabled={deleting}>Cancelar</button>
        <button class="btn btn--danger" onclick={doDeleteBlock} disabled={deleting}>
          {#if deleting}<span class="spinner-sm"></span> Eliminando…{:else}Eliminar{/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ── Página principal ─────────────────────────────────────────────────── -->
<div class="content-page">

  <!-- Error global -->
  {#if globalError}
    <div class="global-error">
      <strong>Error:</strong> {globalError}
      <button class="alert-close" onclick={() => (globalError = null)}>✕</button>
    </div>
  {/if}

  <!-- ═════════════════ PANEL SECCIONES ════════════════════════════════════ -->
  <aside class="panel panel--sections">
    <div class="panel-header">
      <span class="panel-title">Estructura</span>
      <button
        class="icon-btn icon-btn--accent"
        title="Nueva sección"
        onclick={openNewSectionModal}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
      </button>
    </div>

    <div class="panel-body panel-body--scroll">
      {#if loadingSections}
        <div class="panel-loading">
          <div class="spinner-md"></div>
        </div>
      {:else if sections.length === 0}
        <div class="panel-empty">
          <p>Sin secciones.</p>
          <button class="btn btn--sm btn--primary" onclick={openNewSectionModal}>
            Crear primera sección
          </button>
        </div>
      {:else}
        <ul class="section-list">
          {#each sections as section, i (section.id)}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
            <li
              class="section-item"
              class:section-item--active={selectedSectionId === section.id}
              onclick={() => selectSection(section.id)}
            >
              <!-- Order arrows -->
              <div class="section-arrows">
                <button
                  class="arrow-btn"
                  title="Subir"
                  disabled={i === 0}
                  onclick={(e) => { e.stopPropagation(); moveSection(section.id, 'up'); }}
                >▲</button>
                <button
                  class="arrow-btn"
                  title="Bajar"
                  disabled={i === sections.length - 1}
                  onclick={(e) => { e.stopPropagation(); moveSection(section.id, 'down'); }}
                >▼</button>
              </div>

              <!-- Info -->
              <div class="section-info">
                <span class="section-title-text">
                  {section.title || sectionTypeLabel(section.sectionType)}
                </span>
                {#if section.title.trim()}
                  <span class="section-type-muted">{sectionTypeLabel(section.sectionType)}</span>
                {/if}
              </div>

              <!-- Duplicar / eliminar -->
              <button
                class="icon-btn"
                title="Duplicar sección"
                disabled={duplicatingSectionId === section.id}
                onclick={(e) => { e.stopPropagation(); onDuplicateSection(section); }}
              >
                {#if duplicatingSectionId === section.id}
                  <span class="spinner-sm spinner-sm--light"></span>
                {:else}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                {/if}
              </button>
              <button
                class="icon-btn icon-btn--danger"
                title="Eliminar sección"
                onclick={(e) => { e.stopPropagation(); confirmDeleteSection = section; }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <!-- Footer de secciones -->
    <div class="panel-footer">
      <button class="panel-footer-btn" onclick={openNewSectionModal}>
        + Sección
      </button>
    </div>
  </aside>

  <!-- ═════════════════ PANEL BLOQUES ══════════════════════════════════════ -->
  <main class="panel panel--blocks">
    {#if !selectedSection}
      <div class="panel-empty panel-empty--center">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.3">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>
        <p>Selecciona una sección para ver sus bloques.</p>
        {#if sections.length === 0 && !loadingSections}
          <button class="btn btn--sm btn--primary" onclick={openNewSectionModal}>
            Crear primera sección
          </button>
        {/if}
      </div>
    {:else}
      <!-- Header del panel de bloques -->
      <div class="blocks-header">
        <div class="blocks-header-left">
          <h2 class="blocks-section-title">
            {selectedSection.title || sectionTypeLabel(selectedSection.sectionType)}
          </h2>
          <span class="blocks-section-badge">{sectionTypeLabel(selectedSection.sectionType)}</span>
        </div>
        <button
          class="btn btn--sm btn--primary"
          onclick={() => { showNewBlockModal = true; newBlockError = null; }}
          disabled={loadingBlocks}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Añadir bloque
        </button>
      </div>

      <!-- Cuerpo del panel de bloques -->
      <div class="blocks-body">
        {#if loadingBlocks}
          <div class="panel-loading">
            <div class="spinner-md"></div>
          </div>
        {:else if blocks.length === 0}
          <div class="panel-empty panel-empty--center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.25">
              <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 12h8M8 8h4M8 16h5"/>
            </svg>
            <p>Esta sección no tiene bloques todavía.</p>
            <button class="btn btn--sm btn--ghost" onclick={() => (showNewBlockModal = true)}>
              Añadir primer bloque
            </button>
          </div>
        {:else}
          <ul class="block-list">
            {#each blocks as block, i (block.id)}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
              <li
                class="block-item"
                class:block-item--active={selectedBlockId === block.id}
                onclick={() => selectBlock(block.id)}
              >
                <!-- Tipo icon -->
                <div class="block-type-chip">
                  <svg class="block-chip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                    <path d={blockTypeIcon(block.blockType)}/>
                  </svg>
                  <span class="block-chip-label">{blockTypeLabel(block.blockType)}</span>
                </div>

                <!-- Preview del contenido -->
                <div class="block-preview">
                  {#if blockContentPreview(block)}
                    <span class="block-preview-text">{blockContentPreview(block)}</span>
                  {:else}
                    <span class="block-preview-empty">— sin contenido —</span>
                  {/if}
                </div>

                <!-- Acciones de bloque -->
                <div class="block-actions">
                  <button
                    class="arrow-btn"
                    title="Subir bloque"
                    disabled={i === 0}
                    onclick={(e) => { e.stopPropagation(); moveBlock(block.id, 'up'); }}
                  >▲</button>
                  <button
                    class="arrow-btn"
                    title="Bajar bloque"
                    disabled={i === blocks.length - 1}
                    onclick={(e) => { e.stopPropagation(); moveBlock(block.id, 'down'); }}
                  >▼</button>
                  <button
                    class="icon-btn icon-btn--danger"
                    title="Eliminar bloque"
                    onclick={(e) => { e.stopPropagation(); confirmDeleteBlock = block; }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>
                  </button>
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/if}
  </main>

  <!-- ═════════════════ INSPECTOR ══════════════════════════════════════════ -->
  <aside class="panel panel--inspector">
    <div class="panel-header">
      <span class="panel-title">
        {#if inspectorMode === 'block'}Inspector de bloque
        {:else if inspectorMode === 'section'}Inspector de sección
        {:else}Inspector{/if}
      </span>
      {#if inspectorDirty}
        <span class="dirty-dot" title="Cambios sin guardar"></span>
      {/if}
    </div>

    <div class="panel-body panel-body--scroll">

      <!-- ─── Estado vacío ──────────────────────────────────────────────── -->
      {#if inspectorMode === 'none'}
        <div class="inspector-empty">
          <p>Selecciona una sección o un bloque para editar sus propiedades.</p>
        </div>

      <!-- ─── Inspector: sección ────────────────────────────────────────── -->
      {:else if inspectorMode === 'section' && selectedSection}
        <div class="inspector-form">

          <div class="insp-field">
            <label class="insp-label" for="is-title">Título</label>
            <input
              id="is-title" class="insp-input" type="text"
              bind:value={insp_sTitle}
              oninput={markInspectorDirty}
              maxlength={200}
              placeholder="Título de la sección"
            />
          </div>

          <div class="insp-field">
            <label class="insp-label" for="is-type">Tipo de sección</label>
            <SectionTypeSelect
              value={insp_sType}
              onchange={(t) => { insp_sType = t; markInspectorDirty(); }}
            />
          </div>

          <div class="insp-divider"></div>

          <div class="insp-field insp-field--inline">
            <label class="insp-label insp-label--inline" for="is-toc">
              Incluir en índice
              <span class="insp-hint">¿Aparece en la tabla de contenidos?</span>
            </label>
            <input id="is-toc" type="checkbox" class="insp-checkbox"
              bind:checked={insp_sIncludeToc}
              onchange={markInspectorDirty}
            />
          </div>

          <div class="insp-field insp-field--inline">
            <label class="insp-label insp-label--inline" for="is-right">
              Iniciar en página derecha
              <span class="insp-hint">La sección siempre empieza en página impar.</span>
            </label>
            <input id="is-right" type="checkbox" class="insp-checkbox"
              bind:checked={insp_sStartRight}
              onchange={markInspectorDirty}
            />
          </div>

          <div class="insp-divider"></div>

          <!-- Metadata del sistema -->
          <div class="insp-meta">
            <span class="insp-meta-row"><span class="insp-meta-key">ID</span><span class="insp-meta-val">{selectedSection.id.slice(0, 12)}…</span></span>
            <span class="insp-meta-row"><span class="insp-meta-key">Bloques</span><span class="insp-meta-val">{blocks.length}</span></span>
            <span class="insp-meta-row"><span class="insp-meta-key">Posición</span><span class="insp-meta-val">#{selectedSection.orderIndex + 1}</span></span>
          </div>

        </div>

      <!-- ─── Inspector: bloque ─────────────────────────────────────────── -->
      {:else if inspectorMode === 'block' && selectedBlock}
        <div class="inspector-form">

          <div class="insp-field">
            <label class="insp-label" for="ib-type">Tipo de bloque</label>
            <select id="ib-type" class="insp-select" bind:value={insp_bType} onchange={markInspectorDirty}>
              {#each ALL_BLOCK_TYPES as t}
                <option value={t}>{blockTypeLabel(t)}</option>
              {/each}
            </select>
          </div>

          {#if blockHasTextContent(insp_bType)}
            <div class="insp-field">
              <label class="insp-label" for="ib-text">Contenido de texto</label>
              <textarea
                id="ib-text" class="insp-textarea"
                bind:value={insp_bContentText}
                oninput={markInspectorDirty}
                rows={5}
                placeholder="Contenido del bloque (Markdown o texto plano)…"
              ></textarea>
            </div>
          {/if}

          <div class="insp-field">
            <label class="insp-label" for="ib-style">Variante de estilo</label>
            <select id="ib-style" class="insp-select" bind:value={insp_bStyleVariant} onchange={markInspectorDirty}>
              {#each ALL_STYLE_VARIANTS as v}
                <option value={v}>{styleVariantLabel(v)}</option>
              {/each}
            </select>
          </div>

          <div class="insp-divider"></div>
          <div class="insp-section-label">Opciones de paginación</div>

          <div class="insp-field insp-field--inline">
            <label class="insp-label insp-label--inline" for="ib-toc">
              Incluir en índice
              <span class="insp-hint">Solo aplica a encabezados.</span>
            </label>
            <input id="ib-toc" type="checkbox" class="insp-checkbox"
              bind:checked={insp_bIncludeToc} onchange={markInspectorDirty}
            />
          </div>

          <div class="insp-field insp-field--inline">
            <label class="insp-label insp-label--inline" for="ib-keep">
              Mantener junto
              <span class="insp-hint">Evita que se parta entre páginas.</span>
            </label>
            <input id="ib-keep" type="checkbox" class="insp-checkbox"
              bind:checked={insp_bKeepTogether} onchange={markInspectorDirty}
            />
          </div>

          <div class="insp-field insp-field--inline">
            <label class="insp-label insp-label--inline" for="ib-brbefore">
              Salto antes
              <span class="insp-hint">Fuerza nueva página antes del bloque.</span>
            </label>
            <input id="ib-brbefore" type="checkbox" class="insp-checkbox"
              bind:checked={insp_bBreakBefore} onchange={markInspectorDirty}
            />
          </div>

          <div class="insp-field insp-field--inline">
            <label class="insp-label insp-label--inline" for="ib-brafter">
              Salto después
              <span class="insp-hint">Fuerza nueva página después del bloque.</span>
            </label>
            <input id="ib-brafter" type="checkbox" class="insp-checkbox"
              bind:checked={insp_bBreakAfter} onchange={markInspectorDirty}
            />
          </div>

          <div class="insp-divider"></div>

          <!-- Metadata del sistema -->
          <div class="insp-meta">
            <span class="insp-meta-row"><span class="insp-meta-key">ID</span><span class="insp-meta-val">{selectedBlock.id.slice(0, 12)}…</span></span>
            <span class="insp-meta-row"><span class="insp-meta-key">Posición</span><span class="insp-meta-val">#{selectedBlock.orderIndex + 1}</span></span>
          </div>

        </div>
      {/if}

    </div><!-- end panel-body -->

    <!-- Footer del inspector: botón guardar -->
    {#if inspectorMode !== 'none'}
      <div class="panel-footer inspector-footer">
        {#if inspectorError}
          <div class="alert alert--error alert--compact">{inspectorError}</div>
        {/if}
        <button
          class="btn btn--primary btn--full"
          onclick={() => inspectorMode === 'block' ? saveBlock() : saveSection()}
          disabled={!inspectorDirty || inspectorSaving}
        >
          {#if inspectorSaving}
            <span class="spinner-sm"></span> Guardando…
          {:else if inspectorSaveOk}
            ✓ Guardado
          {:else}
            Guardar cambios
          {/if}
        </button>
      </div>
    {/if}
  </aside>

</div><!-- end content-page -->

<style>
  /* ═══════════════════════════════════════════════════════════════════════════
     SHELL PRINCIPAL
  ═══════════════════════════════════════════════════════════════════════════ */
  .content-page {
    display: flex;
    flex: 1;
    height: 100%;
    overflow: hidden;
    background: #0f0f1a;
    color: #e8e8f4;
    font-family: 'Helvetica Neue', Arial, sans-serif;
    position: relative;
  }

  /* Error global */
  .global-error {
    position: absolute;
    top: 0; left: 0; right: 0;
    z-index: 100;
    background: rgba(200,60,60,0.15);
    border-bottom: 1px solid rgba(200,80,80,0.3);
    color: #f09090;
    font-size: 12px;
    padding: 8px 16px 8px 40px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .global-error strong { color: #f09090; }
  .alert-close {
    margin-left: auto;
    background: none;
    border: none;
    color: #f09090;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    padding: 0 2px;
    opacity: 0.7;
  }
  .alert-close:hover { opacity: 1; }

  /* ═══════════════════════════════════════════════════════════════════════════
     PANELES
  ═══════════════════════════════════════════════════════════════════════════ */
  .panel {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    flex-shrink: 0;
  }

  .panel--sections {
    width: 236px;
    border-right: 1px solid rgba(255,255,255,0.06);
    background: #0b0b16;
  }

  .panel--blocks {
    flex: 1;
    min-width: 0;
    border-right: 1px solid rgba(255,255,255,0.06);
    background: #0f0f1a;
  }

  .panel--inspector {
    width: 272px;
    background: #0d0d1e;
  }

  /* Panel header */
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 14px;
    height: 44px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    flex-shrink: 0;
    gap: 8px;
  }

  .panel-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.3);
  }

  /* Panel body scrollable */
  .panel-body--scroll {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.08) transparent;
  }

  /* Panel footer */
  .panel-footer {
    flex-shrink: 0;
    border-top: 1px solid rgba(255,255,255,0.05);
    padding: 10px 12px;
  }

  .panel-footer-btn {
    width: 100%;
    background: rgba(255,255,255,0.04);
    border: 1px dashed rgba(255,255,255,0.12);
    border-radius: 6px;
    color: rgba(255,255,255,0.35);
    font-size: 12px;
    font-family: inherit;
    padding: 7px;
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
  }
  .panel-footer-btn:hover { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.65); }

  /* Estados vacíos y de carga */
  .panel-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px;
  }

  .panel-empty {
    padding: 20px 16px;
    color: rgba(255,255,255,0.3);
    font-size: 12px;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: center;
  }

  .panel-empty--center {
    flex: 1;
    justify-content: center;
    padding: 40px 32px;
    gap: 14px;
  }

  .panel-empty p { margin: 0; }

  /* Dirty dot */
  .dirty-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #7ab8e8;
    flex-shrink: 0;
    animation: pulse 1.5s ease-in-out infinite;
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     LISTA DE SECCIONES
  ═══════════════════════════════════════════════════════════════════════════ */
  .section-list {
    list-style: none;
    margin: 0;
    padding: 6px 0;
  }

  .section-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    cursor: pointer;
    border-radius: 0;
    transition: background 0.1s, border-color 0.1s, box-shadow 0.1s;
    border-left: 3px solid transparent;
  }

  .section-item:hover { background: rgba(255,255,255,0.04); }

  .section-item--active {
    background: rgba(122,184,232,0.12) !important;
    border-left: 3px solid #7ab8e8;
    box-shadow: inset 0 0 0 1px rgba(122,184,232,0.12);
    border-radius: 0 8px 8px 0;
  }

  /* Flechas de orden de sección */
  .section-arrows {
    display: flex;
    flex-direction: column;
    gap: 1px;
    flex-shrink: 0;
  }

  .arrow-btn {
    background: none;
    border: none;
    color: rgba(255,255,255,0.2);
    cursor: pointer;
    font-size: 7px;
    line-height: 1;
    padding: 1px 3px;
    border-radius: 3px;
    transition: color 0.1s, background 0.1s;
  }
  .arrow-btn:hover:not(:disabled) { color: rgba(255,255,255,0.7); background: rgba(255,255,255,0.07); }
  .arrow-btn:disabled { opacity: 0.2; cursor: default; }

  /* Info de la sección */
  .section-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .section-title-text {
    font-size: 12px;
    font-weight: 600;
    color: rgba(255,255,255,0.75);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .section-item--active .section-title-text { color: #7ab8e8; }

  .section-type-muted {
    font-size: 10px;
    color: rgba(255,255,255,0.32);
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .section-item--active .section-type-muted { color: rgba(122,184,232,0.65); }

  /* ═══════════════════════════════════════════════════════════════════════════
     PANEL CENTRAL — BLOQUES
  ═══════════════════════════════════════════════════════════════════════════ */
  .blocks-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    height: 52px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    flex-shrink: 0;
    gap: 12px;
  }

  .blocks-header-left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .blocks-section-title {
    font-size: 15px;
    font-weight: 700;
    color: rgba(255,255,255,0.9);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .blocks-section-badge {
    font-size: 10px;
    color: rgba(255,255,255,0.45);
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.08);
    padding: 3px 10px;
    border-radius: 10px;
    letter-spacing: 0.02em;
    white-space: nowrap;
    flex-shrink: 0;
    max-width: min(220px, 28vw);
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .blocks-body {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.08) transparent;
    padding: 8px 0;
  }

  /* Lista de bloques */
  .block-list {
    list-style: none;
    margin: 0;
    padding: 0 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .block-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.05);
    cursor: pointer;
    background: rgba(255,255,255,0.02);
    transition: background 0.12s, border-color 0.12s;
  }

  .block-item:hover {
    background: rgba(255,255,255,0.05);
    border-color: rgba(255,255,255,0.1);
  }

  .block-item--active {
    background: rgba(122,184,232,0.08) !important;
    border-color: rgba(122,184,232,0.25) !important;
  }

  /* Chip del tipo de bloque */
  .block-type-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    width: 110px;
  }

  .block-chip-icon {
    width: 14px; height: 14px;
    color: rgba(255,255,255,0.35);
    flex-shrink: 0;
  }

  .block-item--active .block-chip-icon { color: #7ab8e8; }

  .block-chip-label {
    font-size: 11px;
    font-weight: 600;
    color: rgba(255,255,255,0.4);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    white-space: nowrap;
  }

  .block-item--active .block-chip-label { color: #7ab8e8; }

  /* Preview del contenido */
  .block-preview { flex: 1; min-width: 0; }

  .block-preview-text {
    font-size: 12px;
    color: rgba(255,255,255,0.5);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
  }

  .block-preview-empty {
    font-size: 12px;
    color: rgba(255,255,255,0.18);
    font-style: italic;
  }

  /* Acciones de bloque */
  .block-actions {
    display: flex;
    align-items: center;
    gap: 3px;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.12s;
  }
  .block-item:hover .block-actions,
  .block-item--active .block-actions { opacity: 1; }

  /* ═══════════════════════════════════════════════════════════════════════════
     INSPECTOR
  ═══════════════════════════════════════════════════════════════════════════ */
  .inspector-empty {
    padding: 24px 16px;
    color: rgba(255,255,255,0.25);
    font-size: 12px;
    text-align: center;
    line-height: 1.6;
  }

  .inspector-form {
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .insp-field {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .insp-field--inline {
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
  }

  .insp-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: rgba(255,255,255,0.35);
  }

  .insp-label--inline {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
  }

  .insp-hint {
    font-size: 10px;
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
    color: rgba(255,255,255,0.2);
    line-height: 1.4;
  }

  .insp-input, .insp-select, .insp-textarea {
    width: 100%;
    padding: 7px 10px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 6px;
    color: #e8e8f4;
    font-size: 12px;
    font-family: inherit;
    outline: none;
    transition: border-color 0.12s;
  }

  .insp-input:focus, .insp-select:focus, .insp-textarea:focus {
    border-color: rgba(122,184,232,0.5);
    background: rgba(255,255,255,0.06);
  }

  .insp-input::placeholder, .insp-textarea::placeholder { color: rgba(255,255,255,0.18); }
  .insp-select option { background: #1a1a2e; color: #e8e8f4; }

  .insp-textarea { resize: vertical; min-height: 80px; }

  .insp-checkbox {
    width: 16px; height: 16px;
    accent-color: #7ab8e8;
    cursor: pointer;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .insp-divider {
    height: 1px;
    background: rgba(255,255,255,0.05);
  }

  .insp-section-label {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(255,255,255,0.2);
    padding-top: 2px;
  }

  /* Meta del sistema */
  .insp-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: rgba(255,255,255,0.02);
    border-radius: 6px;
    padding: 8px 10px;
  }

  .insp-meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 10px;
  }

  .insp-meta-key { color: rgba(255,255,255,0.25); }
  .insp-meta-val { color: rgba(255,255,255,0.5); font-family: monospace; }

  /* Footer inspector */
  .inspector-footer {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     BOTONES GLOBALES
  ═══════════════════════════════════════════════════════════════════════════ */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    border: none;
    text-decoration: none;
    line-height: 1;
    transition: opacity 0.12s, background 0.12s;
    white-space: nowrap;
  }
  .btn:disabled { opacity: 0.35; cursor: not-allowed; }

  .btn--sm { padding: 6px 12px; font-size: 11px; }

  .btn--full { width: 100%; justify-content: center; }

  .btn--primary { background: #7ab8e8; color: #0d1117; }
  .btn--primary:hover:not(:disabled) { background: #91c6f0; }

  .btn--ghost {
    background: rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.6);
    border: 1px solid rgba(255,255,255,0.1);
  }
  .btn--ghost:hover:not(:disabled) { background: rgba(255,255,255,0.1); }

  .btn--danger { background: rgba(220,70,70,0.85); color: #fff; }
  .btn--danger:hover:not(:disabled) { background: #dc4646; }

  /* Icon buttons */
  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px; height: 26px;
    border-radius: 5px;
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
    color: rgba(255,255,255,0.3);
    flex-shrink: 0;
  }
  .icon-btn:hover { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.7); }

  .icon-btn--accent { color: rgba(122,184,232,0.6); }
  .icon-btn--accent:hover { background: rgba(122,184,232,0.1); color: #7ab8e8; border-color: rgba(122,184,232,0.2); }

  .icon-btn--danger:hover { background: rgba(220,80,80,0.12); color: #e07070; border-color: rgba(220,80,80,0.25); }

  /* ═══════════════════════════════════════════════════════════════════════════
     MODALES
  ═══════════════════════════════════════════════════════════════════════════ */
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

  .modal {
    background: #14142a;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    padding: 24px 28px;
    max-width: 480px;
    width: 90%;
    max-height: 85vh;
    overflow-y: auto;
    box-shadow: 0 24px 64px rgba(0,0,0,0.6);
  }

  .modal--sm { max-width: 400px; }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }

  .modal-title {
    font-size: 15px;
    font-weight: 700;
    color: #fff;
    margin: 0;
  }

  .modal-close {
    background: none;
    border: none;
    color: rgba(255,255,255,0.35);
    font-size: 16px;
    cursor: pointer;
    padding: 2px 5px;
    border-radius: 4px;
    transition: color 0.12s;
  }
  .modal-close:hover { color: rgba(255,255,255,0.8); }

  .modal-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .modal-body-text {
    font-size: 13px;
    color: rgba(255,255,255,0.55);
    line-height: 1.6;
    margin: 10px 0 20px;
  }
  .modal-body-text strong { color: rgba(255,255,255,0.85); }

  .modal-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    padding-top: 4px;
  }

  /* Form elements (modal) */
  .form-field { display: flex; flex-direction: column; gap: 6px; }

  .form-field--row {
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .form-label--checkbox {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding-top: 2px;
    cursor: pointer;
  }

  .form-hint {
    font-size: 10px;
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
    color: rgba(255,255,255,0.28);
    line-height: 1.35;
  }

  .form-checkbox {
    width: 18px;
    height: 18px;
    accent-color: #7ab8e8;
    cursor: pointer;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .form-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: rgba(255,255,255,0.4);
  }

  .req { color: #7ab8e8; }
  .optional { font-weight: 400; text-transform: none; letter-spacing: 0; opacity: 0.6; }

  .form-input, .form-textarea {
    width: 100%;
    padding: 9px 12px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 7px;
    color: #e8e8f4;
    font-size: 13px;
    font-family: inherit;
    outline: none;
    transition: border-color 0.12s;
  }

  .form-input:focus, .form-textarea:focus {
    border-color: rgba(122,184,232,0.55);
    background: rgba(255,255,255,0.07);
  }

  .form-input::placeholder, .form-textarea::placeholder { color: rgba(255,255,255,0.22); }
  .form-textarea { resize: vertical; min-height: 72px; }

  /* Block type grid (modal) */
  .block-type-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .block-type-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 10px 6px;
    border-radius: 8px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    color: rgba(255,255,255,0.45);
    font-size: 10px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.1s, border-color 0.1s, color 0.1s;
  }

  .block-type-btn:hover { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.8); border-color: rgba(255,255,255,0.15); }

  .block-type-btn--active {
    background: rgba(122,184,232,0.12) !important;
    border-color: rgba(122,184,232,0.4) !important;
    color: #7ab8e8 !important;
  }

  .block-type-icon {
    width: 18px; height: 18px;
  }

  /* Alerts */
  .alert { border-radius: 6px; font-size: 12px; padding: 10px 12px; }
  .alert--error { background: rgba(200,60,60,0.12); border: 1px solid rgba(200,80,80,0.25); color: #f09090; }
  .alert--compact { padding: 8px 10px; font-size: 11px; }

  /* Spinners */
  .spinner-sm {
    width: 11px; height: 11px;
    border: 2px solid rgba(0,0,0,0.2);
    border-top-color: currentColor;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    display: inline-block;
    flex-shrink: 0;
  }

  .spinner-sm--light {
    border-color: rgba(255,255,255,0.15);
    border-top-color: #7ab8e8;
  }

  .spinner-md {
    width: 24px; height: 24px;
    border: 3px solid rgba(255,255,255,0.06);
    border-top-color: #7ab8e8;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  @keyframes pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 1; }
  }
</style>
