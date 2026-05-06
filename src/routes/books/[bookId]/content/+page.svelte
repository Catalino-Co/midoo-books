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
  import { goto }      from '$app/navigation';
  import {
    listSections, createSection, updateSection, deleteSection, moveSectionInList,
    duplicateSection,
    listBlocks,   updateBlock,   deleteBlock,   moveBlockInList,
    createBlockInSection,
    sectionTypeLabel,
    getSectionCreationDefaults,
    getSectionEditorialPreset,
    resolveSectionEditorialRules,
    sectionPropertyIsOverridden,
    sectionOpeningBehaviorLabel,
    sectionDefaultTextAlignLabel,
    blockTypeLabel,   blockTypeIcon,    ALL_BLOCK_TYPES,
    blockEditorSurface,
    blockShowsIncludeInToc,
    blockShowsStyleVariant,
    blockShowsLayoutControls,
    blockShowsFlowOptions,
    blockHasEditableText,
    blockContentPreview,
    styleVariantLabel, ALL_STYLE_VARIANTS,
    resolveBlockLayout,
    defaultBlockLayout,
    mergeLayoutIntoMetadata,
    blockLayoutPreviewClassNames,
    blockLayoutEditorWrapClassNames,
    BLOCK_TEXT_ALIGN_OPTIONS,
    BLOCK_WIDTH_MODE_OPTIONS,
    BLOCK_EMPHASIS_OPTIONS,
    textAlignLabel,
    widthModeLabel,
    emphasisLabel,
    importMarkdownBlocksToSection,
    parseMarkdownToBlockDrafts,
    buildMarkdownImportPreview,
    validateMarkdownForImport,
    type MarkdownImportMode,
    type MarkdownImportPreview,
    type BlockTextAlign,
    type BlockWidthMode,
    type BlockEmphasis,
    parseImageBlockContent,
    serializeImageBlockContent,
    parseChapterOpeningContent,
    serializeChapterOpeningContent,
    EMPTY_CHAPTER_OPENING_CONTENT,
    CHAPTER_OPENING_TEXT_POSITION_VALUES,
    CHAPTER_OPENING_TEXT_ALIGN_VALUES,
    CHAPTER_OPENING_TEXT_COLOR_MODE_VALUES,
    chapterOpeningPreviewRootClassNames,
    chapterOpeningTextPositionLabel,
    chapterOpeningTextAlignLabel,
    chapterOpeningTextColorModeLabel,
    type ChapterOpeningTextPosition,
    type ChapterOpeningTextAlign,
    type ChapterOpeningTextColorMode,
  } from '$lib/services/content.service';
  import {
    listAssets,
    pickAndImportAssets,
    assetDisplayUrl,
  } from '$lib/services/assets.service';
  import { getLayoutSettings } from '$lib/services/layout.service';
  import {
    bookStyleRoleLabel,
    resolveEffectiveBookStyleInfoForBlock,
    buildResolvedBookStyleDebug,
    type ResolvedBookStyleInfo,
  } from '$lib/services/styles.service';
  import {
    loadBookLayoutSnapshot,
    computePaginatedPreview,
    findPreviewLocationForSelection,
  } from '$lib/services/preview-layout.service';
  import SectionTypeSelect from '$lib/components/SectionTypeSelect.svelte';
  import BookMarkdownImportModal from '$lib/components/BookMarkdownImportModal.svelte';
  import type {
    DocumentSection, SectionType,
    DocumentBlock,   BlockType, BlockStyleVariant,
    Asset,
    LayoutSettings,
  } from '$lib/core/domain/index';
  import { DEFAULT_SECTION_TYPE, DEFAULT_BLOCK_TYPE } from '$lib/core/domain/index';

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
  let openingPreview  = $state(false);

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

  // Creación de bloques (modal Insertar + atajos en fila / estado vacío)
  let quickBlockType         = $state<BlockType>(DEFAULT_BLOCK_TYPE);
  let addingBlock            = $state(false);
  let showInsertBlockModal   = $state(false);
  let insertBlockError       = $state<string | null>(null);

  // Importación Markdown por sección (PARTE 6A)
  let showMdImportModal      = $state(false);
  let mdImportText           = $state('');
  let mdImportMode           = $state<MarkdownImportMode>('append');
  let mdImportError          = $state<string | null>(null);
  let mdImporting            = $state(false);
  let mdFileInput            = $state<HTMLInputElement | null>(null);

  // Importación manuscrito Markdown — libro completo (PARTE 6B)
  let showBookMarkdownImport = $state(false);

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
  let selectedSectionRules = $derived(selectedSection ? resolveSectionEditorialRules(selectedSection) : null);
  let newSectionPreset = $derived(getSectionEditorialPreset(newSectionType));
  let inspectorSectionPreset = $derived(getSectionEditorialPreset(insp_sType));
  let bookLayoutSettings     = $state<LayoutSettings | null>(null);
  let selectedBlockStyleInfo = $derived<ResolvedBookStyleInfo | null>(
    selectedBlock && selectedSection && bookLayoutSettings
      ? resolveEffectiveBookStyleInfoForBlock(bookLayoutSettings, selectedSection, selectedBlock)
      : null
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
  let insp_bType           = $state<BlockType>(DEFAULT_BLOCK_TYPE);
  let insp_bContentText    = $state('');
  let insp_bStyleVariant   = $state<BlockStyleVariant>('default');
  let insp_bIncludeToc     = $state(false);
  let insp_bKeepTogether   = $state(false);
  let insp_bBreakBefore    = $state(false);
  let insp_bBreakAfter     = $state(false);

  let insp_bTextAlign      = $state<BlockTextAlign>('left');
  let insp_bWidthMode      = $state<BlockWidthMode>('full');
  let insp_bEmphasis       = $state<BlockEmphasis>('normal');

  let insp_bImageAssetId   = $state('');
  let insp_bImageAlt       = $state('');
  let insp_bImageCaption   = $state('');
  let insp_bImageFillPage  = $state(false);

  let insp_bCoLabel          = $state('');
  let insp_bCoTitle          = $state('');
  let insp_bCoAssetId        = $state('');
  let insp_bCoTextPosition   = $state<ChapterOpeningTextPosition>('bottom-left');
  let insp_bCoTextAlign      = $state<ChapterOpeningTextAlign>('left');
  let insp_bCoOverlay        = $state(true);
  let insp_bCoTextColorMode  = $state<ChapterOpeningTextColorMode>('light');

  let bookAssets           = $state<Asset[]>([]);

  // Suciedad del inspector
  let inspectorDirty = $state(false);
  let lastSyncedContentQuery = $state('');

  // ── Carga inicial ─────────────────────────────────────────────────────────
  onMount(async () => {
    await loadSections();
    await loadBookAssets();
    await loadBookStylesContext();
  });

  $effect(() => {
    if (bookId) void loadBookAssets();
  });

  $effect(() => {
    if (bookId) void loadBookStylesContext();
  });

  async function loadBookAssets() {
    try {
      bookAssets = await listAssets(bookId);
    } catch {
      bookAssets = [];
    }
  }

  async function loadBookStylesContext() {
    try {
      bookLayoutSettings = await getLayoutSettings(bookId);
    } catch {
      bookLayoutSettings = null;
    }
  }

  async function importImagesForBlock() {
    try {
      const added = await pickAndImportAssets(bookId);
      await loadBookAssets();
      if (added.length > 0) {
        const lastId = added[added.length - 1].id;
        if (insp_bType === 'IMAGE') {
          insp_bImageAssetId = lastId;
          markInspectorDirty();
        } else if (insp_bType === 'CHAPTER_OPENING') {
          insp_bCoAssetId = lastId;
          markInspectorDirty();
        }
      }
    } catch (e) {
      globalError = e instanceof Error ? e.message : String(e);
    }
  }

  function resetChapterOpeningInspector() {
    const d = EMPTY_CHAPTER_OPENING_CONTENT;
    insp_bCoLabel         = d.chapterLabel;
    insp_bCoTitle         = d.title;
    insp_bCoAssetId       = '';
    insp_bCoTextPosition  = d.textPosition;
    insp_bCoTextAlign     = d.textAlign;
    insp_bCoOverlay       = d.overlay;
    insp_bCoTextColorMode = d.textColorMode;
  }

  function blockPreviewIsMuted(block: DocumentBlock): boolean {
    if (block.blockType === 'PAGE_BREAK' || block.blockType === 'SEPARATOR') return false;
    if (block.blockType === 'IMAGE') {
      const img = parseImageBlockContent(block.contentJson);
      if (img.assetId) return false;
      return !block.contentText.trim();
    }
    if (block.blockType === 'CHAPTER_OPENING') {
      const co = parseChapterOpeningContent(block.contentJson);
      if (co.assetId) return false;
      return !co.chapterLabel.trim() && !co.title.trim();
    }
    return !block.contentText.trim();
  }

  async function loadSections() {
    loadingSections = true;
    globalError     = null;
    try {
      sections = await listSections(bookId);
      // Seleccionar la primera sección automáticamente
      if (sections.length > 0 && !selectedSectionId) {
        await selectSection(sections[0].id);
      }
      await syncSelectionFromRoute();
    } catch (e) {
      globalError = e instanceof Error ? e.message : String(e);
    } finally {
      loadingSections = false;
    }
  }

  $effect(() => {
    if (!loadingSections && sections.length > 0) {
      void syncSelectionFromRoute();
    }
  });

  async function syncSelectionFromRoute() {
    const sectionId = $page.url.searchParams.get('sectionId');
    const blockId = $page.url.searchParams.get('blockId');
    const routeKey = `${sectionId ?? ''}::${blockId ?? ''}`;
    if (!routeKey.replace(/:/g, '') || routeKey === lastSyncedContentQuery) return;

    const routeSection = sectionId ? sections.find(section => section.id === sectionId) : null;
    if (!routeSection) return;

    lastSyncedContentQuery = routeKey;
    if (selectedSectionId !== routeSection.id) {
      await selectSection(routeSection.id);
    }

    if (blockId) {
      const routeBlock = blocks.find(block => block.id === blockId);
      if (routeBlock) {
        selectedBlockId = routeBlock.id;
        syncBlockToInspector(routeBlock);
      }
    } else {
      selectedBlockId = null;
      syncSectionToInspector();
    }
  }

  // ── Selección de sección ──────────────────────────────────────────────────
  async function selectSection(id: string) {
    if (selectedSectionId === id) return;
    await flushInspectorIfNeeded();
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
  async function selectBlock(id: string) {
    if (selectedBlockId === id) return;
    await flushInspectorIfNeeded();
    selectedBlockId = id;
    const block = blocks.find(b => b.id === id);
    if (block) syncBlockToInspector(block);
    resetInspectorDirty();
  }

  async function clearBlockSelection() {
    await flushInspectorIfNeeded();
    selectedBlockId = null;
    syncSectionToInspector();
  }

  async function openCurrentSelectionInPreview() {
    if (openingPreview || !selectedSectionId) return;
    openingPreview = true;
    globalError = null;
    try {
      const snapshot = await loadBookLayoutSnapshot(bookId);
      const layout = computePaginatedPreview(snapshot);
      const target = findPreviewLocationForSelection(layout, {
        sectionId: selectedSectionId,
        blockId: selectedBlockId,
      });
      const href = target
        ? `/books/${bookId}/preview?page=${target.physicalPageNumber}`
        : `/books/${bookId}/preview`;
      await goto(href);
    } catch (e) {
      globalError = e instanceof Error ? e.message : String(e);
    } finally {
      openingPreview = false;
    }
  }

  async function flushInspectorIfNeeded() {
    if (!inspectorDirty || inspectorSaving) return;
    if (inspectorMode === 'block' && selectedBlockId) {
      await saveBlock();
    } else if (inspectorMode === 'section' && selectedSectionId) {
      await saveSection();
    }
  }

  async function onInspectorBlur() {
    await flushInspectorIfNeeded();
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
    const L             = resolveBlockLayout(block);
    insp_bTextAlign     = L.textAlign;
    insp_bWidthMode     = L.widthMode;
    insp_bEmphasis      = L.emphasis;
    if (block.blockType === 'IMAGE') {
      const img = parseImageBlockContent(block.contentJson);
      insp_bImageAssetId = img.assetId ?? '';
      insp_bImageAlt     = img.altText;
      insp_bImageCaption = img.caption;
      insp_bImageFillPage = img.fillPage;
    } else {
      insp_bImageAssetId = '';
      insp_bImageAlt     = '';
      insp_bImageCaption = '';
      insp_bImageFillPage = false;
    }
    if (block.blockType === 'CHAPTER_OPENING') {
      const co = parseChapterOpeningContent(block.contentJson);
      insp_bCoLabel         = co.chapterLabel;
      insp_bCoTitle         = co.title;
      insp_bCoAssetId       = co.assetId ?? '';
      insp_bCoTextPosition  = co.textPosition;
      insp_bCoTextAlign     = co.textAlign;
      insp_bCoOverlay       = co.overlay;
      insp_bCoTextColorMode = co.textColorMode;
    } else {
      resetChapterOpeningInspector();
    }
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

  function onInspectorSectionTypeChange(nextType: SectionType) {
    const previousPreset = getSectionEditorialPreset(insp_sType);
    const nextPreset = getSectionEditorialPreset(nextType);
    const keepExistingTocOverride = insp_sIncludeToc !== previousPreset.includeInToc;
    const keepExistingRightOverride = insp_sStartRight !== previousPreset.startOnRightPage;

    insp_sType = nextType;
    if (!keepExistingTocOverride) insp_sIncludeToc = nextPreset.includeInToc;
    if (!keepExistingRightOverride) insp_sStartRight = nextPreset.startOnRightPage;
    markInspectorDirty();
    void onInspectorBlur();
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
      const prev      = blocks.find(b => b.id === selectedBlockId);
      const layoutMeta = mergeLayoutIntoMetadata(prev?.metadataJson ?? null, {
        textAlign: insp_bTextAlign,
        widthMode: insp_bWidthMode,
        emphasis:  insp_bEmphasis,
      });

      let contentJsonPayload: string | null | undefined = undefined;
      if (insp_bType === 'IMAGE') {
        contentJsonPayload = serializeImageBlockContent({
          assetId: insp_bImageAssetId.trim() !== '' ? insp_bImageAssetId.trim() : null,
          altText: insp_bImageAlt,
          caption: insp_bImageCaption,
          fillPage: insp_bImageFillPage,
        });
      } else if (insp_bType === 'CHAPTER_OPENING') {
        contentJsonPayload = serializeChapterOpeningContent({
          chapterLabel: insp_bCoLabel,
          title:        insp_bCoTitle,
          assetId:      insp_bCoAssetId.trim() !== '' ? insp_bCoAssetId.trim() : null,
          textPosition: insp_bCoTextPosition,
          textAlign:    insp_bCoTextAlign,
          overlay:      insp_bCoOverlay,
          textColorMode: insp_bCoTextColorMode,
        });
      } else if (
        (prev?.blockType === 'IMAGE' && insp_bType !== 'IMAGE')
        || (prev?.blockType === 'CHAPTER_OPENING' && insp_bType !== 'CHAPTER_OPENING')
      ) {
        contentJsonPayload = null;
      }

      const noMainText = insp_bType === 'IMAGE' || insp_bType === 'CHAPTER_OPENING';
      const updated = await updateBlock(selectedBlockId, {
        blockType:       insp_bType,
        contentText:     noMainText ? '' : insp_bContentText,
        styleVariant:    insp_bStyleVariant,
        includeInToc:    insp_bIncludeToc,
        keepTogether:    insp_bKeepTogether,
        pageBreakBefore: insp_bBreakBefore,
        pageBreakAfter:  insp_bBreakAfter,
        metadataJson:    layoutMeta,
        ...(contentJsonPayload !== undefined ? { contentJson: contentJsonPayload } : {}),
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

  // ── Creación rápida de bloques ────────────────────────────────────────────
  let coQuickTypeHint = $derived(
    quickBlockType === 'CHAPTER_OPENING' && selectedSection?.sectionType !== 'CHAPTER'
      ? 'Sugerencia: «Apertura de capítulo» encaja mejor en secciones tipo Capítulo.'
      : null,
  );

  async function addBlockQuick(where: 'end' | 'after') {
    if (!selectedSectionId || addingBlock) return;
    if (where === 'after' && !selectedBlockId) return;
    addingBlock = true;
    globalError = null;
    insertBlockError = null;
    const openingHint = coQuickTypeHint;
    if (openingHint) {
      globalError = openingHint;
      setTimeout(() => {
        if (globalError === openingHint) globalError = null;
      }, 4500);
    }
    try {
      const afterId = where === 'after' ? selectedBlockId : null;
      const created = await createBlockInSection(selectedSectionId, blocks, afterId, {
        blockType:   quickBlockType,
        contentText: '',
      });
      blocks = await listBlocks(selectedSectionId);
      await selectBlock(created.id);
      showInsertBlockModal = false;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      globalError = msg;
      insertBlockError = msg;
    } finally {
      addingBlock = false;
    }
  }

  async function addBlockBelow(afterBlockId: string) {
    if (!selectedSectionId || addingBlock) return;
    addingBlock = true;
    globalError = null;
    const openingHint = coQuickTypeHint;
    if (openingHint) {
      globalError = openingHint;
      setTimeout(() => {
        if (globalError === openingHint) globalError = null;
      }, 4500);
    }
    try {
      const created = await createBlockInSection(selectedSectionId, blocks, afterBlockId, {
        blockType:   quickBlockType,
        contentText: '',
      });
      blocks = await listBlocks(selectedSectionId);
      await selectBlock(created.id);
    } catch (e) {
      globalError = e instanceof Error ? e.message : String(e);
    } finally {
      addingBlock = false;
    }
  }

  function openInsertBlockModal() {
    insertBlockError = null;
    showInsertBlockModal = true;
  }

  // ── Eliminar bloque ───────────────────────────────────────────────────────
  async function doDeleteBlock() {
    if (!confirmDeleteBlock || deleting) return;
    await flushInspectorIfNeeded();
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
    await flushInspectorIfNeeded();
    try {
      blocks = await moveBlockInList(blocks, blockId, dir);
    } catch (e) {
      globalError = e instanceof Error ? e.message : String(e);
    }
  }

  let inspSurface = $derived(blockEditorSurface(insp_bType));

  let inspEditorWrapClass = $derived(
    blockLayoutEditorWrapClassNames(
      {
        textAlign: insp_bTextAlign,
        widthMode: insp_bWidthMode,
        emphasis:  insp_bEmphasis,
      },
      insp_bStyleVariant,
    ),
  );

  let mdImportPreview = $derived.by((): MarkdownImportPreview | null => {
    if (!mdImportText.trim()) return null;
    const drafts = parseMarkdownToBlockDrafts(mdImportText);
    if (drafts.length === 0) return null;
    return buildMarkdownImportPreview(drafts);
  });

  /** Etiqueta de tipo de bloque para claves devueltas por `Object.entries`. */
  function previewBlockTypeLabel(t: string): string {
    return blockTypeLabel(t as BlockType);
  }

  function openMdImportModal() {
    mdImportError = null;
    mdImportText = '';
    mdImportMode = 'append';
    showMdImportModal = true;
  }

  function closeMdImportModal() {
    if (mdImporting) return;
    showMdImportModal = false;
    mdImportError = null;
  }

  function onMdFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      mdImportText = String(r.result ?? '');
      mdImportError = null;
    };
    r.onerror = () => {
      mdImportError = 'No se pudo leer el archivo.';
    };
    r.readAsText(f);
    input.value = '';
  }

  async function onBookMarkdownImported() {
    await flushInspectorIfNeeded();
    selectedSectionId = null;
    selectedBlockId   = null;
    await loadSections();
    await loadBookAssets();
    if (sections.length > 0) {
      await selectSection(sections[0].id);
    } else {
      blocks = [];
    }
  }

  async function confirmMdImport() {
    if (!selectedSectionId || mdImporting) return;
    const v = validateMarkdownForImport(mdImportText);
    if (!v.ok) {
      mdImportError = v.message;
      return;
    }
    const drafts = parseMarkdownToBlockDrafts(mdImportText);
    if (drafts.length === 0) {
      mdImportError =
        'No se detectaron bloques. Usa párrafos, # título, ## subtítulo, > cita, ---, [[PAGE_BREAK]] o ![alt](ruta).';
      return;
    }
    if (mdImportMode === 'replace' && blocks.length > 0) {
      const ok = confirm(
        `¿Reemplazar los ${blocks.length} bloque(s) actuales por ${drafts.length} importado(s)? Esta acción no se puede deshacer.`,
      );
      if (!ok) return;
    }
    await flushInspectorIfNeeded();
    mdImporting = true;
    mdImportError = null;
    globalError = null;
    try {
      blocks = await importMarkdownBlocksToSection(
        selectedSectionId,
        mdImportText,
        mdImportMode,
        blocks,
      );
      showMdImportModal = false;
      selectedBlockId = null;
      syncSectionToInspector();
    } catch (e) {
      mdImportError = e instanceof Error ? e.message : String(e);
    } finally {
      mdImporting = false;
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
          <p class="modal-hint modal-hint--insert">
            Preset: TOC {newSectionPreset.includeInToc ? 'sí' : 'no'} · recto {newSectionPreset.startOnRightPage ? 'sí' : 'no'} ·
            folio {newSectionPreset.showPageNumber ? 'visible' : 'oculto'} · {sectionOpeningBehaviorLabel(newSectionPreset.defaultOpeningBehavior)}
          </p>
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

{#if showInsertBlockModal}
  <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="insert-block-title">
    <div class="modal modal--insert-block">
      <div class="modal-header">
        <h3 id="insert-block-title" class="modal-title">Insertar bloque</h3>
        <button
          type="button"
          class="modal-close"
          onclick={() => { showInsertBlockModal = false; insertBlockError = null; }}
          disabled={addingBlock}
        >✕</button>
      </div>
      <div class="modal-form modal-form--flush">
        {#if insertBlockError}
          <div class="alert alert--error">{insertBlockError}</div>
        {/if}
        <div class="form-field">
          <label class="form-label" for="ib-modal-type">Tipo de bloque</label>
          <select
            id="ib-modal-type"
            class="form-input form-select"
            bind:value={quickBlockType}
            disabled={addingBlock}
          >
            {#each ALL_BLOCK_TYPES as t}
              <option value={t}>{blockTypeLabel(t)}</option>
            {/each}
          </select>
        </div>
        {#if coQuickTypeHint}
          <p class="modal-hint modal-hint--soft">{coQuickTypeHint}</p>
        {/if}
        <p class="modal-hint modal-hint--insert">
          Elige dónde colocar el bloque. «Debajo del seleccionado» usa el bloque activo en la lista (resaltado).
        </p>
        <div class="modal-actions modal-actions--stack">
          <button
            type="button"
            class="btn btn--primary btn--full"
            disabled={addingBlock}
            onclick={() => addBlockQuick('end')}
          >
            {#if addingBlock}<span class="spinner-sm"></span> Insertando…{:else}Al final de la sección{/if}
          </button>
          <button
            type="button"
            class="btn btn--ghost btn--full"
            disabled={addingBlock || !selectedBlockId}
            title={selectedBlockId ? '' : 'Selecciona un bloque en la lista'}
            onclick={() => addBlockQuick('after')}
          >
            Debajo del bloque seleccionado
          </button>
        </div>
        <p class="modal-footnote">Los textos se guardan al salir del campo o con «Guardar cambios» en el inspector.</p>
        <button
          type="button"
          class="btn btn--ghost btn--full btn--mt"
          disabled={addingBlock}
          onclick={() => { showInsertBlockModal = false; insertBlockError = null; }}
        >
          Cancelar
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showMdImportModal}
  <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="md-import-title">
    <div class="modal modal--md-import">
      <div class="modal-header">
        <h3 id="md-import-title" class="modal-title">Importar Markdown</h3>
        <button type="button" class="modal-close" onclick={closeMdImportModal} disabled={mdImporting}>✕</button>
      </div>
      <div class="modal-form modal-form--flush">
        <p class="modal-hint modal-hint--insert">
          Solo afecta a la sección actual. No se crean secciones nuevas desde <code class="md-code">#</code>.
          Reglas: <code class="md-code">#</code> / <code class="md-code">##</code>, párrafos (línea en blanco), <code class="md-code">&gt;</code> cita,
          <code class="md-code">---</code>, <code class="md-code">[[PAGE_BREAK]]</code>, <code class="md-code">![alt](ruta)</code>.
        </p>

        {#if mdImportError}
          <div class="alert alert--error">{mdImportError}</div>
        {/if}

        <div class="form-field">
          <label class="form-label" for="md-paste">Pegar Markdown</label>
          <textarea
            id="md-paste"
            class="form-textarea md-import-textarea"
            bind:value={mdImportText}
            disabled={mdImporting}
            placeholder="# Capítulo en esta sección&#10;&#10;Párrafo uno.&#10;&#10;## Subtítulo&#10;&#10;> Una cita&#10;&#10;---&#10;&#10;[[PAGE_BREAK]]"
            rows={10}
          ></textarea>
        </div>

        <div class="form-field form-field--row-md">
          <input
            bind:this={mdFileInput}
            type="file"
            accept=".md,.markdown,text/markdown,text/plain"
            class="sr-only"
            onchange={onMdFileChange}
          />
          <button
            type="button"
            class="btn btn--ghost btn--sm"
            disabled={mdImporting}
            onclick={() => mdFileInput?.click()}
          >
            Cargar archivo .md
          </button>
        </div>

        <div class="form-field">
          <span class="form-label">Inserción</span>
          <div class="md-import-mode">
            <label class="md-radio">
              <input type="radio" name="md-mode" value="append" bind:group={mdImportMode} disabled={mdImporting} />
              <span>Agregar al final</span>
            </label>
            <label class="md-radio">
              <input type="radio" name="md-mode" value="replace" bind:group={mdImportMode} disabled={mdImporting} />
              <span>Reemplazar bloques actuales</span>
            </label>
          </div>
        </div>

        {#if mdImportPreview}
          <div class="md-import-preview">
            <div class="md-import-preview-title">Vista previa</div>
            <p class="md-import-preview-meta">
              <strong>{mdImportPreview.blockCount}</strong> bloque(s) ·
              {#each Object.entries(mdImportPreview.byType) as [t, n], j (t)}
                {j > 0 ? ' · ' : ''}{previewBlockTypeLabel(t)}: {n}
              {/each}
            </p>
            <ul class="md-import-preview-list">
              {#each mdImportPreview.samples as s, idx (idx)}
                <li>
                  <span class="md-import-preview-type">{blockTypeLabel(s.type)}</span>
                  <span class="md-import-preview-excerpt">{s.excerpt}</span>
                </li>
              {/each}
            </ul>
            {#if mdImportPreview.blockCount > mdImportPreview.samples.length}
              <p class="md-import-preview-more">… y {mdImportPreview.blockCount - mdImportPreview.samples.length} más</p>
            {/if}
          </div>
        {:else if mdImportText.trim()}
          <p class="modal-hint">No se detectaron bloques con el contenido actual.</p>
        {/if}

        <div class="modal-actions modal-actions--stack">
          <button
            type="button"
            class="btn btn--primary btn--full"
            disabled={mdImporting || !mdImportPreview}
            onclick={() => confirmMdImport()}
          >
            {#if mdImporting}
              <span class="spinner-sm"></span> Importando…
            {:else}
              Confirmar importación
            {/if}
          </button>
          <button type="button" class="btn btn--ghost btn--full" disabled={mdImporting} onclick={closeMdImportModal}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<BookMarkdownImportModal bind:open={showBookMarkdownImport} bookId={bookId} onImported={onBookMarkdownImported} />

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
      <div class="panel-header-actions">
        <button
          type="button"
          class="btn btn--sm btn--ghost"
          onclick={() => void openCurrentSelectionInPreview()}
          disabled={openingPreview || !selectedSectionId}
          title="Abrir en preview la página de la selección actual"
        >
          {openingPreview ? 'Abriendo…' : 'Vista previa aquí'}
        </button>
        <button
          type="button"
          class="btn btn--sm btn--ghost"
          title="Importar manuscrito Markdown (varias secciones)"
          onclick={() => (showBookMarkdownImport = true)}
        >
          MD libro
        </button>
        <button
          class="icon-btn icon-btn--accent"
          title="Nueva sección"
          onclick={openNewSectionModal}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
        </button>
      </div>
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
        <div class="blocks-header-actions">
          <button
            type="button"
            class="btn btn--sm btn--ghost"
            onclick={openMdImportModal}
            disabled={loadingBlocks}
            title="Importar Markdown en esta sección"
          >
            Importar Markdown
          </button>
          <button
            type="button"
            class="btn btn--sm btn--primary"
            onclick={openInsertBlockModal}
            disabled={loadingBlocks}
            title="Añadir un bloque nuevo"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
            Insertar
          </button>
        </div>
      </div>

      <!-- Cuerpo del panel de bloques -->
      <div class="blocks-body">
        {#if loadingBlocks}
          <div class="panel-loading">
            <div class="spinner-md"></div>
          </div>
        {:else if blocks.length === 0}
          <div class="panel-empty panel-empty--center panel-empty--write">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.35">
              <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            <p class="empty-write-title">Empieza a escribir esta sección</p>
            <p class="empty-write-hint">Añade un párrafo, un título o una cita; usa <strong>Importar Markdown</strong> o <strong>Insertar</strong> arriba. Reordena y refina cuando quieras.</p>
            <div class="empty-write-actions">
              <select class="quick-type-select quick-type-select--solo" bind:value={quickBlockType} disabled={addingBlock}>
                {#each ALL_BLOCK_TYPES as t}
                  <option value={t}>{blockTypeLabel(t)}</option>
                {/each}
              </select>
              {#if coQuickTypeHint}
                <p class="empty-co-hint">{coQuickTypeHint}</p>
              {/if}
              <button type="button" class="btn btn--sm btn--primary" disabled={addingBlock} onclick={() => addBlockQuick('end')}>
                {#if addingBlock}<span class="spinner-sm spinner-sm--light"></span>{:else}Primer bloque{/if}
              </button>
            </div>
          </div>
        {:else}
          <div class="manuscript-stage">
            <article class="manuscript-doc" aria-label="Documento de la sección">
              {#each blocks as block, i (block.id)}
                <div class="manuscript-insert-row">
                  <button
                    type="button"
                    class="manuscript-insert-btn"
                    title="Insertar bloque debajo"
                    disabled={addingBlock}
                    onclick={() => addBlockBelow(block.id)}
                  >+</button>
                </div>
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                <section
                  class="manuscript-block block-item"
                  class:block-item--active={selectedBlockId === block.id}
                  onclick={() => selectBlock(block.id)}
                >
                  <header class="manuscript-block-meta">
                    <span class="block-idx" title="Orden en la sección">#{i + 1}</span>
                    <div class="block-type-chip">
                      <svg class="block-chip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                        <path d={blockTypeIcon(block.blockType)}/>
                      </svg>
                      <span class="block-chip-label">{blockTypeLabel(block.blockType)}</span>
                    </div>
                    <div class="block-actions">
                      <button
                        type="button"
                        class="arrow-btn"
                        title="Subir"
                        disabled={i === 0}
                        onclick={(e) => { e.stopPropagation(); moveBlock(block.id, 'up'); }}
                      >▲</button>
                      <button
                        type="button"
                        class="arrow-btn"
                        title="Bajar"
                        disabled={i === blocks.length - 1}
                        onclick={(e) => { e.stopPropagation(); moveBlock(block.id, 'down'); }}
                      >▼</button>
                      <button
                        type="button"
                        class="icon-btn icon-btn--danger"
                        title="Eliminar"
                        onclick={(e) => { e.stopPropagation(); confirmDeleteBlock = block; }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>
                      </button>
                    </div>
                  </header>

                  <div
                    class="block-preview manuscript-block-content {block.blockType === 'CHAPTER_OPENING' ? '' : blockLayoutPreviewClassNames(block)}"
                    class:block-preview--with-thumb={block.blockType === 'IMAGE' && parseImageBlockContent(block.contentJson).assetId}
                    class:block-preview--co-wrap={block.blockType === 'CHAPTER_OPENING'}
                  >
                    {#if block.blockType === 'CHAPTER_OPENING'}
                      {@const co = parseChapterOpeningContent(block.contentJson)}
                      <div class="block-preview-co {chapterOpeningPreviewRootClassNames(co)}">
                        {#if co.assetId}
                          {@const ast = bookAssets.find(a => a.id === co.assetId)}
                          {#if ast}
                            <img
                              class="block-preview-co__img"
                              src={assetDisplayUrl(bookId, ast.storagePath)}
                              alt=""
                            />
                          {:else}
                            <div class="block-preview-co__ph">Asset no encontrado</div>
                          {/if}
                        {:else}
                          <div class="block-preview-co__ph">Sin imagen</div>
                        {/if}
                        <div class="block-preview-co__text">
                          {#if co.chapterLabel.trim()}
                            <span class="block-preview-co__label">{co.chapterLabel}</span>
                          {/if}
                          {#if co.title.trim()}
                            <span class="block-preview-co__title">{co.title}</span>
                          {/if}
                        </div>
                      </div>
                    {:else if block.blockType === 'IMAGE'}
                      {@const ic = parseImageBlockContent(block.contentJson)}
                      {#if ic.assetId}
                        {@const ast = bookAssets.find(a => a.id === ic.assetId)}
                        {#if ast}
                          <img
                            class="block-preview-thumb"
                            src={assetDisplayUrl(bookId, ast.storagePath)}
                            alt=""
                          />
                        {/if}
                      {/if}
                    {/if}
                    {#if block.blockType !== 'CHAPTER_OPENING'}
                      <span class="block-preview-text" class:block-preview-text--muted={blockPreviewIsMuted(block)}>
                        {blockContentPreview(block)}
                      </span>
                    {/if}
                  </div>
                </section>
              {/each}
            </article>
          </div>
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
          <p class="inspector-empty-lead">Listo para escribir</p>
          <p>Elige una sección a la izquierda. Para editar texto, selecciona un bloque en el panel central; sus campos aparecerán aquí.</p>
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
              onblur={onInspectorBlur}
              maxlength={200}
              placeholder="Título de la sección"
            />
          </div>

          <div class="insp-field">
            <label class="insp-label" for="is-type">Tipo de sección</label>
            <SectionTypeSelect
              value={insp_sType}
              onchange={onInspectorSectionTypeChange}
            />
          </div>

          <div class="insp-preset-card">
            <div class="insp-preset-title">Preset editorial del tipo</div>
            <div class="insp-preset-grid">
              <span class="insp-preset-chip" class:insp-preset-chip--override={selectedSection ? sectionPropertyIsOverridden(selectedSection, 'includeInToc') : false}>
                TOC: {inspectorSectionPreset.includeInToc ? 'sí' : 'no'}
              </span>
              <span class="insp-preset-chip" class:insp-preset-chip--override={selectedSection ? sectionPropertyIsOverridden(selectedSection, 'startOnRightPage') : false}>
                Recto: {inspectorSectionPreset.startOnRightPage ? 'sí' : 'no'}
              </span>
              <span class="insp-preset-chip">
                Folio: {inspectorSectionPreset.showPageNumber ? 'visible' : 'oculto'}
              </span>
              <span class="insp-preset-chip">
                Cabecera: {inspectorSectionPreset.allowHeader ? 'permitida' : 'oculta'}
              </span>
              <span class="insp-preset-chip">
                Pie: {inspectorSectionPreset.allowFooter ? 'permitido' : 'oculto'}
              </span>
              <span class="insp-preset-chip">
                Apertura: {sectionOpeningBehaviorLabel(inspectorSectionPreset.defaultOpeningBehavior)}
              </span>
              <span class="insp-preset-chip">
                Alineación: {sectionDefaultTextAlignLabel(inspectorSectionPreset.defaultTextAlign)}
              </span>
              <span class="insp-preset-chip">
                Página propia: {inspectorSectionPreset.isStandalonePage ? 'sí' : 'no'}
              </span>
            </div>
            <p class="insp-preset-note">
              El tipo propone estos defaults al crear la sección. `Incluir en índice` e `Iniciar en página derecha` se pueden sobrescribir manualmente.
            </p>
          </div>

          <div class="insp-divider"></div>

          <div class="insp-field insp-field--inline">
            <label class="insp-label insp-label--inline" for="is-toc">
              Incluir en índice
              <span class="insp-hint">¿Aparece en la tabla de contenidos?</span>
            </label>
            <input id="is-toc" type="checkbox" class="insp-checkbox"
              bind:checked={insp_sIncludeToc}
              onchange={() => { markInspectorDirty(); onInspectorBlur(); }}
            />
          </div>

          <div class="insp-field insp-field--inline">
            <label class="insp-label insp-label--inline" for="is-right">
              Iniciar en página derecha
              <span class="insp-hint">La sección siempre empieza en página impar.</span>
            </label>
            <input id="is-right" type="checkbox" class="insp-checkbox"
              bind:checked={insp_sStartRight}
              onchange={() => { markInspectorDirty(); onInspectorBlur(); }}
            />
          </div>

          <div class="insp-divider"></div>

          <!-- Metadata del sistema -->
          <div class="insp-meta">
            <span class="insp-meta-row"><span class="insp-meta-key">ID</span><span class="insp-meta-val">{selectedSection.id.slice(0, 12)}…</span></span>
            <span class="insp-meta-row"><span class="insp-meta-key">Bloques</span><span class="insp-meta-val">{blocks.length}</span></span>
            <span class="insp-meta-row"><span class="insp-meta-key">Posición</span><span class="insp-meta-val">#{selectedSection.orderIndex + 1}</span></span>
            {#if selectedSectionRules}
              <span class="insp-meta-row"><span class="insp-meta-key">Folio efectivo</span><span class="insp-meta-val">{selectedSectionRules.showPageNumber ? 'Permitido' : 'Oculto'}</span></span>
              <span class="insp-meta-row"><span class="insp-meta-key">Cabecera efectiva</span><span class="insp-meta-val">{selectedSectionRules.allowHeader ? 'Permitida' : 'Oculta'}</span></span>
              <span class="insp-meta-row"><span class="insp-meta-key">Pie efectivo</span><span class="insp-meta-val">{selectedSectionRules.allowFooter ? 'Permitido' : 'Oculto'}</span></span>
            {/if}
          </div>

        </div>

      <!-- ─── Inspector: bloque ─────────────────────────────────────────── -->
      {:else if inspectorMode === 'block' && selectedBlock}
        <div class="inspector-form">

          <button type="button" class="insp-back-section" onclick={() => clearBlockSelection()}>
            ← Propiedades de la sección
          </button>

          <div class="insp-field">
            <label class="insp-label" for="ib-type">Tipo de bloque</label>
            <select
              id="ib-type"
              class="insp-select"
              bind:value={insp_bType}
              onchange={() => {
                const L = defaultBlockLayout(insp_bType, insp_bStyleVariant);
                insp_bTextAlign = L.textAlign;
                insp_bWidthMode = L.widthMode;
                insp_bEmphasis  = L.emphasis;
                if (insp_bType === 'IMAGE') {
                  insp_bImageAssetId = '';
                  insp_bImageAlt     = '';
                  insp_bImageCaption = '';
                } else {
                  insp_bImageAssetId = '';
                  insp_bImageAlt     = '';
                  insp_bImageCaption = '';
                }
                if (insp_bType === 'CHAPTER_OPENING') {
                  if (
                    selectedBlock?.blockType === 'CHAPTER_OPENING'
                    && selectedBlock.id === selectedBlockId
                  ) {
                    const co = parseChapterOpeningContent(selectedBlock.contentJson);
                    insp_bCoLabel         = co.chapterLabel;
                    insp_bCoTitle         = co.title;
                    insp_bCoAssetId       = co.assetId ?? '';
                    insp_bCoTextPosition  = co.textPosition;
                    insp_bCoTextAlign     = co.textAlign;
                    insp_bCoOverlay       = co.overlay;
                    insp_bCoTextColorMode = co.textColorMode;
                  } else {
                    resetChapterOpeningInspector();
                  }
                } else {
                  resetChapterOpeningInspector();
                }
                markInspectorDirty();
                onInspectorBlur();
              }}
            >
              {#each ALL_BLOCK_TYPES as t}
                <option value={t}>{blockTypeLabel(t)}</option>
              {/each}
            </select>
          </div>

          {#if selectedBlockStyleInfo}
            <div class="insp-preset-card insp-preset-card--style-role">
              <div class="insp-preset-title">Rol editorial efectivo en preview</div>
              <div class="insp-preset-grid">
                <span class="insp-preset-chip insp-preset-chip--accent">
                  Rol: {bookStyleRoleLabel(selectedBlockStyleInfo.role)}
                </span>
                <span class="insp-preset-chip">
                  Base: {selectedBlockStyleInfo.baseStyle.fontSize} pt / {selectedBlockStyleInfo.baseStyle.lineHeight}
                </span>
                <span class="insp-preset-chip">
                  Final: {selectedBlockStyleInfo.finalStyle.fontSize} pt / {selectedBlockStyleInfo.finalStyle.lineHeight}
                </span>
                <span class="insp-preset-chip">
                  Alineación: {selectedBlockStyleInfo.finalStyle.textAlign}
                </span>
                <span class="insp-preset-chip">
                  Ancho: {selectedBlockStyleInfo.finalStyle.maxWidth ?? 'auto'}
                </span>
                <span class="insp-preset-chip">
                  Peso: {selectedBlockStyleInfo.finalStyle.fontWeight}
                </span>
              </div>
              <p class="insp-preset-note">
                Este bloque se renderiza con el estilo global <strong>{bookStyleRoleLabel(selectedBlockStyleInfo.role)}</strong>,
                combinado con los overrides locales que existan.
              </p>
              <p class="insp-debug-note" title={buildResolvedBookStyleDebug(selectedBlockStyleInfo)}>
                {buildResolvedBookStyleDebug(selectedBlockStyleInfo)}
              </p>
            </div>
          {/if}

          {#if inspSurface === 'short'}
            <div class="insp-field">
              <label class="insp-label" for="ib-text">Texto</label>
              <div class={inspEditorWrapClass}>
                <textarea
                  id="ib-text"
                  class="insp-textarea insp-textarea--short"
                  bind:value={insp_bContentText}
                  oninput={markInspectorDirty}
                  onblur={onInspectorBlur}
                  rows={3}
                  maxlength={2000}
                  placeholder="Título o encabezado…"
                ></textarea>
              </div>
            </div>
          {:else if inspSurface === 'large'}
            <div class="insp-field">
              <label class="insp-label" for="ib-text">Contenido</label>
              <div class={inspEditorWrapClass}>
                <textarea
                  id="ib-text"
                  class="insp-textarea insp-textarea--write"
                  bind:value={insp_bContentText}
                  oninput={markInspectorDirty}
                  onblur={onInspectorBlur}
                  rows={14}
                  placeholder="Escribe aquí. Puedes usar párrafos simples; el formato rico llegará más adelante."
                ></textarea>
              </div>
            </div>
          {:else if inspSurface === 'medium'}
            <div class="insp-field">
              <label class="insp-label" for="ib-text">Texto centrado</label>
              <div class={inspEditorWrapClass}>
                <textarea
                  id="ib-text"
                  class="insp-textarea"
                  bind:value={insp_bContentText}
                  oninput={markInspectorDirty}
                  onblur={onInspectorBlur}
                  rows={6}
                  maxlength={1500}
                  placeholder="Línea o frase centrada (dedicatoria, epígrafe…)…"
                ></textarea>
              </div>
            </div>
          {:else if inspSurface === 'image_placeholder'}
            <div class="insp-field">
              <label class="insp-label" for="ib-asset">Imagen del libro</label>
              <p class="insp-hint insp-hint--block">
                Elige un asset importado en <strong>Assets</strong> o añade archivos aquí. Una misma imagen puede usarse en varios bloques.
              </p>
              {#if insp_bImageAssetId}
                {@const sel = bookAssets.find(a => a.id === insp_bImageAssetId)}
                {#if sel}
                  <div class="insp-image-preview">
                    <img src={assetDisplayUrl(bookId, sel.storagePath)} alt={insp_bImageAlt || ''} />
                  </div>
                {/if}
              {:else}
                <div class="insp-image-placeholder">Sin imagen asignada</div>
              {/if}
              <select
                id="ib-asset"
                class="insp-select"
                bind:value={insp_bImageAssetId}
                onchange={() => { markInspectorDirty(); onInspectorBlur(); }}
              >
                <option value="">— Sin imagen —</option>
                {#each bookAssets as a}
                  <option value={a.id}>{a.originalName}</option>
                {/each}
              </select>
              <button
                type="button"
                class="btn btn--ghost btn--sm btn--full insp-image-import"
                onclick={() => void importImagesForBlock()}
              >
                + Importar imágenes nuevas…
              </button>
            </div>
            <div class="insp-field">
              <label class="insp-label" for="ib-img-alt">Texto alternativo (bloque)</label>
              <input
                id="ib-img-alt"
                class="insp-input"
                bind:value={insp_bImageAlt}
                oninput={markInspectorDirty}
                onblur={onInspectorBlur}
                maxlength={500}
                placeholder="Descripción breve para accesibilidad"
              />
            </div>
            <div class="insp-field">
              <label class="insp-label" for="ib-img-cap">Leyenda visible</label>
              <textarea
                id="ib-img-cap"
                class="insp-textarea insp-textarea--short"
                bind:value={insp_bImageCaption}
                oninput={markInspectorDirty}
                onblur={onInspectorBlur}
                rows={3}
                maxlength={2000}
                placeholder="Pie de foto (opcional)"
              ></textarea>
            </div>
            <div class="insp-field insp-field--inline">
              <label class="insp-label insp-label--inline" for="ib-img-fillpage">
                Ocupar toda la página
                <span class="insp-hint">
                  Usa esta imagen como página completa en la preview paginada.
                </span>
              </label>
              <input
                id="ib-img-fillpage"
                type="checkbox"
                class="insp-checkbox"
                bind:checked={insp_bImageFillPage}
                onchange={() => { markInspectorDirty(); onInspectorBlur(); }}
              />
            </div>
          {:else if inspSurface === 'chapter_opening'}
            <div class="insp-field">
              <label class="insp-label" for="ib-co-label">Etiqueta del capítulo</label>
              <input
                id="ib-co-label"
                class="insp-input"
                bind:value={insp_bCoLabel}
                oninput={markInspectorDirty}
                onblur={onInspectorBlur}
                maxlength={120}
                placeholder="Ej: Capítulo 1:"
              />
            </div>
            <div class="insp-field">
              <label class="insp-label" for="ib-co-title">Título principal</label>
              <input
                id="ib-co-title"
                class="insp-input"
                bind:value={insp_bCoTitle}
                oninput={markInspectorDirty}
                onblur={onInspectorBlur}
                maxlength={300}
                placeholder="Ej: El llamado en la orilla"
              />
            </div>
            <div class="insp-field">
              <label class="insp-label" for="ib-co-asset">Imagen del libro</label>
              <p class="insp-hint insp-hint--block">
                Elige un asset en <strong>Assets</strong> o importa aquí. Vista previa orientativa para la maquetación final.
              </p>
              <div class="insp-co-preview {chapterOpeningPreviewRootClassNames({
                chapterLabel: insp_bCoLabel,
                title: insp_bCoTitle,
                assetId: insp_bCoAssetId.trim() !== '' ? insp_bCoAssetId.trim() : null,
                textPosition: insp_bCoTextPosition,
                textAlign: insp_bCoTextAlign,
                overlay: insp_bCoOverlay,
                textColorMode: insp_bCoTextColorMode,
              })}">
                {#if insp_bCoAssetId}
                  {@const sel = bookAssets.find(a => a.id === insp_bCoAssetId)}
                  {#if sel}
                    <img
                      class="insp-co-preview__img"
                      src={assetDisplayUrl(bookId, sel.storagePath)}
                      alt=""
                    />
                  {:else}
                    <div class="insp-co-preview__ph">Asset no encontrado</div>
                  {/if}
                {:else}
                  <div class="insp-co-preview__ph">Sin imagen</div>
                {/if}
                <div class="insp-co-preview__text">
                  {#if insp_bCoLabel.trim()}
                    <span class="insp-co-preview__label">{insp_bCoLabel}</span>
                  {/if}
                  {#if insp_bCoTitle.trim()}
                    <span class="insp-co-preview__title">{insp_bCoTitle}</span>
                  {/if}
                </div>
              </div>
              <select
                id="ib-co-asset"
                class="insp-select"
                bind:value={insp_bCoAssetId}
                onchange={() => { markInspectorDirty(); onInspectorBlur(); }}
              >
                <option value="">— Sin imagen —</option>
                {#each bookAssets as a}
                  <option value={a.id}>{a.originalName}</option>
                {/each}
              </select>
              <button
                type="button"
                class="btn btn--ghost btn--sm btn--full insp-image-import"
                onclick={() => void importImagesForBlock()}
              >
                + Importar imágenes nuevas…
              </button>
            </div>
            <div class="insp-field">
              <label class="insp-label" for="ib-co-pos">Posición del texto</label>
              <select
                id="ib-co-pos"
                class="insp-select"
                bind:value={insp_bCoTextPosition}
                onchange={() => { markInspectorDirty(); onInspectorBlur(); }}
              >
                {#each CHAPTER_OPENING_TEXT_POSITION_VALUES as p}
                  <option value={p}>{chapterOpeningTextPositionLabel(p)}</option>
                {/each}
              </select>
            </div>
            <div class="insp-field">
              <label class="insp-label" for="ib-co-ta">Alineación del texto</label>
              <select
                id="ib-co-ta"
                class="insp-select"
                bind:value={insp_bCoTextAlign}
                onchange={() => { markInspectorDirty(); onInspectorBlur(); }}
              >
                {#each CHAPTER_OPENING_TEXT_ALIGN_VALUES as a}
                  <option value={a}>{chapterOpeningTextAlignLabel(a)}</option>
                {/each}
              </select>
            </div>
            <div class="insp-field insp-field--inline">
              <label class="insp-label insp-label--inline" for="ib-co-overlay">
                Superposición (overlay)
                <span class="insp-hint">Oscurece ligeramente la imagen detrás del texto.</span>
              </label>
              <input
                id="ib-co-overlay"
                type="checkbox"
                class="insp-checkbox"
                bind:checked={insp_bCoOverlay}
                onchange={() => { markInspectorDirty(); onInspectorBlur(); }}
              />
            </div>
            <div class="insp-field">
              <label class="insp-label" for="ib-co-tone">Tono del texto</label>
              <select
                id="ib-co-tone"
                class="insp-select"
                bind:value={insp_bCoTextColorMode}
                onchange={() => { markInspectorDirty(); onInspectorBlur(); }}
              >
                {#each CHAPTER_OPENING_TEXT_COLOR_MODE_VALUES as m}
                  <option value={m}>{chapterOpeningTextColorModeLabel(m)}</option>
                {/each}
              </select>
            </div>
          {:else if inspSurface === 'static_page_break'}
            <div class="insp-static-note">
              <p>Este bloque fuerza un salto de página en la maquetación final. No lleva texto.</p>
            </div>
          {:else if inspSurface === 'none'}
            <div class="insp-static-note insp-static-note--subtle">
              <p>Separador visual. Opcionalmente puedes añadir una nota interna (no se mostrará como texto principal hasta definir estilo).</p>
              <div class={inspEditorWrapClass}>
                <textarea
                  class="insp-textarea insp-textarea--short"
                  bind:value={insp_bContentText}
                  oninput={markInspectorDirty}
                  onblur={onInspectorBlur}
                  rows={2}
                  placeholder="Nota opcional…"
                ></textarea>
              </div>
            </div>
          {/if}

          {#if blockShowsLayoutControls(insp_bType)}
            <div class="insp-divider"></div>
            <div class="insp-section-label">Presentación</div>

            <div class="insp-field">
              <label class="insp-label" for="ib-align">Alineación</label>
              <select
                id="ib-align"
                class="insp-select"
                bind:value={insp_bTextAlign}
                onchange={() => { markInspectorDirty(); onInspectorBlur(); }}
              >
                {#each BLOCK_TEXT_ALIGN_OPTIONS as a}
                  <option value={a}>{textAlignLabel(a)}</option>
                {/each}
              </select>
            </div>

            <div class="insp-field">
              <label class="insp-label" for="ib-width">Ancho del texto</label>
              <select
                id="ib-width"
                class="insp-select"
                bind:value={insp_bWidthMode}
                onchange={() => { markInspectorDirty(); onInspectorBlur(); }}
              >
                {#each BLOCK_WIDTH_MODE_OPTIONS as w}
                  <option value={w}>{widthModeLabel(w)}</option>
                {/each}
              </select>
            </div>

            <div class="insp-field">
              <label class="insp-label" for="ib-emph">Énfasis</label>
              <select
                id="ib-emph"
                class="insp-select"
                bind:value={insp_bEmphasis}
                onchange={() => { markInspectorDirty(); onInspectorBlur(); }}
              >
                {#each BLOCK_EMPHASIS_OPTIONS as e}
                  <option value={e}>{emphasisLabel(e)}</option>
                {/each}
              </select>
            </div>
          {/if}

          {#if blockShowsStyleVariant(insp_bType)}
            <div class="insp-field">
              <label class="insp-label" for="ib-style">Variante editorial</label>
              <select
                id="ib-style"
                class="insp-select"
                bind:value={insp_bStyleVariant}
                onchange={() => {
                  const L = defaultBlockLayout(insp_bType, insp_bStyleVariant);
                  insp_bTextAlign = L.textAlign;
                  insp_bWidthMode = L.widthMode;
                  insp_bEmphasis  = L.emphasis;
                  markInspectorDirty();
                  onInspectorBlur();
                }}
              >
                {#each ALL_STYLE_VARIANTS as v}
                  <option value={v}>{styleVariantLabel(v)}</option>
                {/each}
              </select>
            </div>
          {/if}

          {#if blockShowsIncludeInToc(insp_bType)}
            <div class="insp-divider"></div>
            <div class="insp-field insp-field--inline">
              <label class="insp-label insp-label--inline" for="ib-toc">
                Incluir en índice
                <span class="insp-hint">Para títulos en la tabla de contenidos (cuando exista).</span>
              </label>
              <input
                id="ib-toc"
                type="checkbox"
                class="insp-checkbox"
                bind:checked={insp_bIncludeToc}
                onchange={() => { markInspectorDirty(); onInspectorBlur(); }}
              />
            </div>
          {/if}

          {#if blockShowsFlowOptions(insp_bType)}
            <div class="insp-divider"></div>
            <div class="insp-section-label">Flujo de página</div>

            <div class="insp-field insp-field--inline">
              <label class="insp-label insp-label--inline" for="ib-brbefore">
                Salto antes
              </label>
              <input
                id="ib-brbefore"
                type="checkbox"
                class="insp-checkbox"
                bind:checked={insp_bBreakBefore}
                onchange={() => { markInspectorDirty(); onInspectorBlur(); }}
              />
            </div>

            <div class="insp-field insp-field--inline">
              <label class="insp-label insp-label--inline" for="ib-brafter">
                Salto después
              </label>
              <input
                id="ib-brafter"
                type="checkbox"
                class="insp-checkbox"
                bind:checked={insp_bBreakAfter}
                onchange={() => { markInspectorDirty(); onInspectorBlur(); }}
              />
            </div>
          {/if}

          <div class="insp-divider"></div>
          <div class="insp-meta">
            <span class="insp-meta-row"><span class="insp-meta-key">Posición</span><span class="insp-meta-val">#{selectedBlock.orderIndex + 1}</span></span>
          </div>

        </div>
      {/if}

    </div><!-- end panel-body -->

    <!-- Footer del inspector: botón guardar -->
    {#if inspectorMode !== 'none'}
      <div class="panel-footer inspector-footer">
        <button
          class="btn btn--ghost btn--full"
          type="button"
          onclick={() => void openCurrentSelectionInPreview()}
          disabled={openingPreview || !selectedSectionId}
        >
          {openingPreview ? 'Abriendo preview…' : 'Ir a esta página en preview'}
        </button>
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
    min-height: 0;
    display: flex;
    flex-direction: column;
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

  .panel-header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
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

  .blocks-header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .blocks-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.08) transparent;
    padding: 8px 0;
  }

  /* FASE A — canvas de escritura tipo manuscrito */
  .manuscript-stage {
    padding: 20px 0 28px;
    min-height: 100%;
  }
  .manuscript-doc {
    width: min(760px, calc(100% - 36px));
    margin: 0 auto;
    padding: 22px 26px 28px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: linear-gradient(180deg, #f7f5ef 0%, #f2efe7 100%);
    color: #171717;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.2);
  }
  .manuscript-insert-row {
    display: flex;
    justify-content: center;
    margin: 2px 0 6px;
  }
  .manuscript-insert-btn {
    width: 20px;
    height: 20px;
    border-radius: 999px;
    border: 1px solid rgba(0, 0, 0, 0.16);
    background: rgba(255, 255, 255, 0.85);
    color: rgba(0, 0, 0, 0.55);
    font-size: 13px;
    line-height: 1;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .manuscript-insert-btn:hover:not(:disabled) {
    color: #1b3552;
    border-color: rgba(27, 53, 82, 0.42);
    background: #fff;
  }
  .manuscript-insert-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .manuscript-block.block-item {
    display: block;
    padding: 8px 8px 10px;
    border-radius: 8px;
    border: 1px solid transparent;
    background: transparent;
    cursor: text;
    transition: background 0.12s, border-color 0.12s;
  }
  .manuscript-block.block-item:hover {
    background: rgba(40, 66, 97, 0.05);
    border-color: rgba(40, 66, 97, 0.16);
  }
  .manuscript-block.block-item.block-item--active {
    background: rgba(53, 99, 153, 0.09) !important;
    border-color: rgba(53, 99, 153, 0.3) !important;
  }
  .manuscript-block-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    opacity: 0.72;
  }
  .manuscript-block-content.block-preview {
    max-width: 100%;
  }
  .manuscript-doc .block-idx {
    width: auto;
    min-width: 24px;
    text-align: left;
    color: rgba(0, 0, 0, 0.36);
  }
  .manuscript-doc .block-type-chip {
    width: auto;
    gap: 5px;
  }
  .manuscript-doc .block-chip-icon {
    color: rgba(0, 0, 0, 0.38);
  }
  .manuscript-doc .block-chip-label {
    color: rgba(0, 0, 0, 0.5);
    letter-spacing: 0.05em;
  }
  .manuscript-doc .block-item--active .block-chip-label,
  .manuscript-doc .block-item--active .block-chip-icon {
    color: #285184;
  }
  .manuscript-doc .block-actions {
    margin-left: auto;
    opacity: 0;
  }
  .manuscript-doc .block-item:hover .block-actions,
  .manuscript-doc .block-item--active .block-actions {
    opacity: 1;
  }
  .manuscript-doc .block-preview-text {
    white-space: pre-wrap;
    overflow: visible;
    text-overflow: clip;
    display: block;
    color: #1b1b1b;
    font-family: 'Georgia', 'Times New Roman', serif;
    font-size: 17px;
    line-height: 1.6;
    letter-spacing: 0.002em;
  }
  .manuscript-doc .block-preview--em-muted .block-preview-text {
    opacity: 0.72;
  }
  .manuscript-doc .block-preview--em-strong .block-preview-text {
    color: #171717;
    font-weight: 600;
  }
  .manuscript-doc .block-preview--var-rights .block-preview-text {
    font-size: 15px;
    opacity: 0.7;
  }
  .manuscript-doc .block-preview--var-dedication .block-preview-text {
    font-style: italic;
  }
  .manuscript-doc .block-preview--ta-center .block-preview-text {
    text-align: center;
  }
  .manuscript-doc .block-preview--ta-right .block-preview-text {
    text-align: right;
  }
  .manuscript-doc .block-preview--ta-justify .block-preview-text {
    text-align: justify;
  }
  .manuscript-doc .block-preview-thumb {
    width: min(180px, 38%);
    height: auto;
    aspect-ratio: 4 / 3;
    border-radius: 8px;
  }
  .manuscript-doc .block-preview-co {
    max-height: 180px;
    border-radius: 8px;
  }

  .quick-type-select {
    flex: 1;
    min-width: 140px;
    padding: 7px 10px;
    border-radius: 6px;
    border: 1px solid rgba(255,255,255,0.12);
    background-color: #1f1f35;
    color: #e8e8f4;
    font-size: 12px;
    font-family: inherit;
    color-scheme: dark;
  }

  .quick-type-select--solo {
    flex: 0 1 auto;
    min-width: 160px;
  }

  .quick-type-select option {
    background-color: #1a1a2e;
    color: #e8e8f4;
  }

  .panel-empty--write {
    max-width: 340px;
    margin: 0 auto;
  }

  .empty-write-title {
    font-size: 14px;
    font-weight: 600;
    color: rgba(255,255,255,0.72);
    margin: 0;
  }

  .empty-write-hint {
    font-size: 12px;
    color: rgba(255,255,255,0.38);
    line-height: 1.5;
    margin: 0;
  }

  .empty-write-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    margin-top: 4px;
  }

  .empty-co-hint {
    flex-basis: 100%;
    width: 100%;
    text-align: center;
    font-size: 11px;
    line-height: 1.45;
    color: rgba(255, 210, 150, 0.82);
    margin: 2px 0 0;
  }

  .inspector-empty-lead {
    font-size: 13px;
    font-weight: 600;
    color: rgba(255,255,255,0.55);
    margin: 0 0 8px;
  }

  .insp-back-section {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0 0 10px;
    margin: 0 0 8px;
    border: none;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    background: none;
    color: rgba(122,184,232,0.85);
    font-size: 11px;
    font-family: inherit;
    cursor: pointer;
  }

  .insp-back-section:hover {
    color: #7ab8e8;
  }

  /* PARTE 7 — reflejo de layout en el inspector */
  .insp-editor-visual {
    width: 100%;
  }
  .insp-editor-visual--ta-center .insp-textarea {
    text-align: center;
  }
  .insp-editor-visual--ta-right .insp-textarea {
    text-align: right;
  }
  .insp-editor-visual--ta-justify .insp-textarea {
    text-align: justify;
  }
  .insp-editor-visual--wm-narrow .insp-textarea {
    max-width: 14rem;
    margin-inline: auto;
    display: block;
  }
  .insp-editor-visual--wm-medium .insp-textarea {
    max-width: 22rem;
    margin-inline: auto;
    display: block;
  }
  .insp-editor-visual--em-muted .insp-textarea {
    opacity: 0.78;
  }
  .insp-editor-visual--em-strong .insp-textarea {
    font-weight: 600;
  }
  .insp-editor-visual--var-dedication .insp-textarea {
    font-style: italic;
    letter-spacing: 0.02em;
  }
  .insp-editor-visual--var-rights .insp-textarea {
    font-size: 12px;
  }
  .insp-editor-visual--var-pull-quote .insp-textarea,
  .insp-editor-visual--var-quote-large .insp-textarea {
    font-weight: 600;
  }

  .insp-textarea--write {
    min-height: 220px;
    line-height: 1.55;
    font-size: 13px;
  }

  .insp-textarea--short {
    min-height: 64px;
  }

  .insp-static-note {
    font-size: 12px;
    line-height: 1.55;
    color: rgba(255,255,255,0.45);
    padding: 10px 12px;
    background: rgba(255,255,255,0.03);
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.06);
  }

  .insp-static-note--subtle p {
    margin: 0 0 10px;
  }

  .insp-hint--block {
    margin: 0 0 8px;
  }

  .insp-image-preview {
    border-radius: 8px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.4);
    margin-bottom: 8px;
    max-height: 140px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .insp-image-preview img {
    max-width: 100%;
    max-height: 140px;
    object-fit: contain;
  }

  .insp-image-placeholder {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.28);
    padding: 14px;
    text-align: center;
    border: 1px dashed rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    margin-bottom: 8px;
  }

  .insp-image-import {
    margin-top: 8px;
  }

  .insp-co-preview {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 10;
    max-height: 160px;
    border-radius: 8px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.42);
    margin-bottom: 10px;
  }
  .insp-co-preview__img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .insp-co-preview__ph {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.32);
  }
  .insp-co-preview__text {
    position: absolute;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 12px;
    max-width: 90%;
  }
  .insp-co-preview.co-preview--pos-top-left .insp-co-preview__text {
    top: 6px;
    left: 6px;
  }
  .insp-co-preview.co-preview--pos-top-right .insp-co-preview__text {
    top: 6px;
    right: 6px;
    align-items: flex-end;
  }
  .insp-co-preview.co-preview--pos-bottom-left .insp-co-preview__text {
    bottom: 6px;
    left: 6px;
  }
  .insp-co-preview.co-preview--pos-bottom-right .insp-co-preview__text {
    bottom: 6px;
    right: 6px;
    align-items: flex-end;
  }
  .insp-co-preview.co-preview--pos-center .insp-co-preview__text {
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    align-items: center;
    text-align: center;
  }
  .insp-co-preview.co-preview--ta-left .insp-co-preview__text {
    text-align: left;
  }
  .insp-co-preview.co-preview--ta-center .insp-co-preview__text {
    text-align: center;
  }
  .insp-co-preview.co-preview--ta-right .insp-co-preview__text {
    text-align: right;
  }
  .insp-co-preview.co-preview--overlay::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.58), transparent 52%);
  }
  .insp-co-preview.co-preview--tone-light .insp-co-preview__label,
  .insp-co-preview.co-preview--tone-light .insp-co-preview__title {
    color: rgba(255, 255, 255, 0.96);
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.55);
  }
  .insp-co-preview.co-preview--tone-dark .insp-co-preview__label,
  .insp-co-preview.co-preview--tone-dark .insp-co-preview__title {
    color: rgba(20, 20, 28, 0.95);
    text-shadow: 0 0 6px rgba(255, 255, 255, 0.35);
  }
  .insp-co-preview.co-preview--tone-auto .insp-co-preview__label,
  .insp-co-preview.co-preview--tone-auto .insp-co-preview__title {
    color: rgba(255, 255, 255, 0.94);
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
  }
  .insp-co-preview__label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    opacity: 0.92;
  }
  .insp-co-preview__title {
    font-size: 15px;
    font-weight: 700;
    line-height: 1.2;
  }

  .block-idx {
    font-size: 10px;
    font-weight: 600;
    color: rgba(255,255,255,0.22);
    width: 22px;
    flex-shrink: 0;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .text-btn {
    background: none;
    border: none;
    color: rgba(122,184,232,0.65);
    font-size: 10px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 4px;
  }

  .text-btn:hover:not(:disabled) {
    color: #7ab8e8;
    background: rgba(122,184,232,0.08);
  }

  .text-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .text-btn--compact {
    letter-spacing: 0.02em;
  }

  .block-preview-text--muted {
    color: rgba(255,255,255,0.22) !important;
    font-style: italic;
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
    gap: 8px;
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
    width: 128px;
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
  .block-preview {
    flex: 1;
    min-width: 0;
  }

  /* PARTE 7 — preview según layout editorial */
  .block-preview--ta-center {
    text-align: center;
  }
  .block-preview--ta-right {
    text-align: right;
  }
  .block-preview--ta-justify {
    text-align: justify;
  }
  .block-preview--wm-narrow {
    max-width: 12rem;
    margin-inline: auto;
  }
  .block-preview--wm-medium {
    max-width: 19rem;
    margin-inline: auto;
  }
  .block-preview--em-muted .block-preview-text {
    opacity: 0.62;
  }
  .block-preview--em-strong .block-preview-text {
    font-weight: 600;
    color: rgba(255, 255, 255, 0.62);
  }
  .block-preview--var-dedication .block-preview-text {
    font-style: italic;
    letter-spacing: 0.03em;
  }
  .block-preview--var-pull-quote .block-preview-text,
  .block-preview--var-quote-large .block-preview-text {
    font-weight: 600;
  }
  .block-preview--var-rights .block-preview-text {
    font-size: 11px;
    opacity: 0.55;
  }

  .block-preview--with-thumb {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .block-preview-thumb {
    width: 40px;
    height: 40px;
    object-fit: cover;
    border-radius: 6px;
    flex-shrink: 0;
    background: rgba(0, 0, 0, 0.35);
  }

  .block-preview--co-wrap {
    flex: 1;
    min-width: 0;
    display: block;
  }

  .block-preview-co {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    max-height: 72px;
    border-radius: 7px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.4);
  }
  .block-preview-co__img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .block-preview-co__ph {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    color: rgba(255, 255, 255, 0.32);
  }
  .block-preview-co__text {
    position: absolute;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 4px 6px;
    max-width: 90%;
  }
  .block-preview-co.co-preview--pos-top-left .block-preview-co__text {
    top: 2px;
    left: 2px;
  }
  .block-preview-co.co-preview--pos-top-right .block-preview-co__text {
    top: 2px;
    right: 2px;
    align-items: flex-end;
  }
  .block-preview-co.co-preview--pos-bottom-left .block-preview-co__text {
    bottom: 2px;
    left: 2px;
  }
  .block-preview-co.co-preview--pos-bottom-right .block-preview-co__text {
    bottom: 2px;
    right: 2px;
    align-items: flex-end;
  }
  .block-preview-co.co-preview--pos-center .block-preview-co__text {
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    align-items: center;
    text-align: center;
  }
  .block-preview-co.co-preview--ta-left .block-preview-co__text {
    text-align: left;
  }
  .block-preview-co.co-preview--ta-center .block-preview-co__text {
    text-align: center;
  }
  .block-preview-co.co-preview--ta-right .block-preview-co__text {
    text-align: right;
  }
  .block-preview-co.co-preview--overlay::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.52), transparent 55%);
  }
  .block-preview-co.co-preview--tone-light .block-preview-co__label,
  .block-preview-co.co-preview--tone-light .block-preview-co__title {
    color: rgba(255, 255, 255, 0.95);
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.55);
  }
  .block-preview-co.co-preview--tone-dark .block-preview-co__label,
  .block-preview-co.co-preview--tone-dark .block-preview-co__title {
    color: rgba(22, 22, 30, 0.95);
    text-shadow: 0 0 4px rgba(255, 255, 255, 0.4);
  }
  .block-preview-co.co-preview--tone-auto .block-preview-co__label,
  .block-preview-co.co-preview--tone-auto .block-preview-co__title {
    color: rgba(255, 255, 255, 0.92);
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
  }
  .block-preview-co__label {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    line-height: 1.1;
  }
  .block-preview-co__title {
    font-size: 10px;
    font-weight: 700;
    line-height: 1.15;
  }

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

  .insp-select {
    color-scheme: dark;
    background-color: #1f1f35;
  }

  .insp-select:focus {
    background-color: #252542;
  }

  .insp-select option {
    background-color: #1a1a2e;
    color: #e8e8f4;
  }

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

  .insp-preset-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    border-radius: 8px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
  }

  .insp-preset-title {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.38);
  }

  .insp-preset-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .insp-preset-chip {
    display: inline-flex;
    align-items: center;
    padding: 5px 8px;
    border-radius: 999px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.62);
    font-size: 10px;
    line-height: 1;
  }

  .insp-preset-chip--override {
    border-color: rgba(122,184,232,0.35);
    color: #a7d5f7;
    background: rgba(122,184,232,0.08);
  }

  .insp-preset-chip--accent {
    border-color: rgba(122,184,232,0.45);
    color: #d6ecff;
    background: rgba(122,184,232,0.12);
  }

  .insp-preset-note {
    margin: 0;
    font-size: 10px;
    line-height: 1.45;
    color: rgba(255,255,255,0.3);
  }

  .insp-debug-note {
    margin: 0;
    font-size: 10px;
    line-height: 1.45;
    color: rgba(255,255,255,0.24);
    word-break: break-word;
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

  .modal--insert-block {
    max-width: 420px;
    /* Menú nativo del <select> en Chromium/Electron: evita lista blanca ilegible */
    color-scheme: dark;
  }

  .modal--md-import {
    max-width: 520px;
    color-scheme: dark;
  }

  .modal-form--flush {
    gap: 14px;
  }

  .form-select {
    cursor: pointer;
    color-scheme: dark;
  }

  /* Select del modal: fondo sólido oscuro (el rgba del .form-input a veces rompe el popup nativo) */
  .form-input.form-select {
    background-color: #1f1f35;
    color: #e8e8f4;
    border-color: rgba(255,255,255,0.14);
  }

  .form-input.form-select:focus {
    background-color: #252542;
    border-color: rgba(122,184,232,0.55);
  }

  .form-input.form-select option {
    background-color: #1a1a2e;
    color: #e8e8f4;
  }

  .modal-hint {
    font-size: 12px;
    line-height: 1.5;
    color: rgba(255,255,255,0.45);
    margin: 0;
  }

  .modal-hint--insert {
    margin: -6px 0 0;
  }

  .modal-hint--soft {
    color: rgba(255, 210, 150, 0.88);
    margin: 4px 0 0;
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

  .md-code {
    font-family: ui-monospace, 'Cascadia Code', 'Segoe UI Mono', monospace;
    font-size: 0.92em;
    padding: 1px 5px;
    border-radius: 4px;
    background: rgba(255,255,255,0.08);
    color: rgba(200,220,255,0.95);
  }

  .md-import-textarea {
    min-height: 200px;
    font-family: ui-monospace, 'Cascadia Code', 'Segoe UI Mono', monospace;
    font-size: 12px;
    line-height: 1.45;
  }

  .form-field--row-md {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-top: -4px;
  }

  .md-import-mode {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 4px;
  }

  .md-radio {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: rgba(255,255,255,0.78);
    cursor: pointer;
  }

  .md-radio input {
    accent-color: #7ab8e8;
  }

  .md-import-preview {
    padding: 12px 14px;
    border-radius: 8px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
  }

  .md-import-preview-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.42);
    margin: 0 0 8px;
  }

  .md-import-preview-meta {
    font-size: 12px;
    color: rgba(255,255,255,0.55);
    margin: 0 0 10px;
    line-height: 1.45;
  }

  .md-import-preview-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 200px;
    overflow-y: auto;
    scrollbar-width: thin;
  }

  .md-import-preview-list li {
    display: flex;
    gap: 10px;
    align-items: baseline;
    font-size: 12px;
    line-height: 1.35;
  }

  .md-import-preview-type {
    flex-shrink: 0;
    font-size: 10px;
    font-weight: 600;
    color: rgba(122,184,232,0.9);
    min-width: 5.5rem;
  }

  .md-import-preview-excerpt {
    color: rgba(255,255,255,0.55);
    word-break: break-word;
  }

  .md-import-preview-more {
    font-size: 11px;
    color: rgba(255,255,255,0.35);
    margin: 8px 0 0;
  }

  .modal-actions--stack {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    padding-top: 2px;
  }

  .modal-footnote {
    font-size: 10px;
    line-height: 1.45;
    color: rgba(255,255,255,0.32);
    margin: 0;
    text-align: center;
  }

  .btn--mt {
    margin-top: 6px;
  }

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
