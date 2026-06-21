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
    listSections, createSection, updateSection, deleteSection, moveSectionInList, reorderSectionToIndex,
    duplicateSection,
    listBlocks,   updateBlock,   deleteBlock,   moveBlockInList, reorderBlockToIndex,
    createBlockInSection,
    createBlockFirstInSection,
    sectionTypeLabel,
    sectionTypeIconPath,
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
    parseTitlePageContent,
    serializeTitlePageContent,
    EMPTY_TITLE_PAGE_CONTENT,
    TITLE_PAGE_TEXT_ALIGN_VALUES,
    type TitlePageTextAlign,
    type MarkdownBookImportMode,
    type MarkdownImportMode,
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
    resolveBookStyles,
    buildBookStyleCss,
    type BookStyleMap,
    type ResolvedBookStyleInfo,
  } from '$lib/services/styles.service';
  import { resolveBookStyleRoleForBlock } from '$lib/core/editorial/book-styles';
  import SectionTypeSelect from '$lib/components/SectionTypeSelect.svelte';
  import MarkdownImportUnifiedModal from '$lib/components/MarkdownImportUnifiedModal.svelte';
  import type {
    DocumentSection, SectionType,
    DocumentBlock,   BlockType, BlockStyleVariant,
    CreateBlockInput,
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

  // Creación de bloques (paleta unificada + atajos en fila / estado vacío)
  let quickBlockType         = $state<BlockType>(DEFAULT_BLOCK_TYPE);
  let addingBlock            = $state(false);
  let showBlockPalette       = $state(false);
  let focusMode              = $state(false);
  let inspectorTab           = $state<'block' | 'format'>('block');
  let sectionBlockCounts     = $state<Record<string, number>>({});

  // ── Modo de edición ───────────────────────────────────────────────────
  type EditorMode = 'write' | 'layout';
  const EDITOR_MODE_KEY = 'midoo-editor-mode';

  function loadEditorMode(): EditorMode {
    if (typeof localStorage === 'undefined') return 'layout';
    const saved = localStorage.getItem(EDITOR_MODE_KEY);
    return saved === 'write' ? 'write' : 'layout';
  }

  let editorMode = $state<EditorMode>(loadEditorMode());

  function setEditorMode(mode: EditorMode) {
    editorMode = mode;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(EDITOR_MODE_KEY, mode);
    }
  }

  // ── Estadísticas de palabras ──────────────────────────────────────────
  /** Cuenta palabras en un string de texto. */
  function wordCount(text: string): number {
    const t = text?.trim();
    return t ? t.split(/\s+/).length : 0;
  }

  /**
   * Caché de word count por sección — se actualiza cada vez que se cargan
   * los bloques de una sección, acumulando datos mientras el usuario navega.
   */
  let sectionWordCounts = $state<Record<string, number>>({});

  /** Palabras en la sección actualmente cargada. */
  let currentSectionWordCount = $derived(
    blocks.reduce((sum, b) => sum + wordCount(b.contentText), 0)
  );

  /** Total acumulado de palabras en todas las secciones visitadas. */
  let bookWordCount = $derived(
    Object.values(sectionWordCounts).reduce((sum, c) => sum + c, 0)
  );

  /** Páginas estimadas (≈250 palabras/página en formato estándar). */
  function estimatedPages(words: number): number {
    return Math.max(1, Math.round(words / 250));
  }

  // Actualiza el caché de word count cuando cambian los bloques cargados.
  // IMPORTANTE: usar mutación de propiedad (obj[key] = v), NO spread ({ ...obj })
  // para evitar que Svelte 5 registre sectionWordCounts como dependencia del effect
  // y genere un loop reactivo infinito.
  $effect(() => {
    const count = currentSectionWordCount;  // dependencia intencional
    const id    = selectedSectionId;        // dependencia intencional
    if (id && !loadingBlocks) {
      sectionWordCounts[id] = count;        // mutación directa — no crea dependencia de lectura
    }
  });

  // ── Write Mode — estado ──────────────────────────────────────────────────

  /** ID del bloque al que hay que mover el foco tras crear/eliminar */
  let pendingFocusBlockId    = $state<string | null>(null);
  /** Inspector visible temporalmente en write mode (para bloques no-texto) */
  let showWriteInspector     = $state(false);
  /** Timers de guardado por bloque en write mode */
  const writeTimers          = new Map<string, ReturnType<typeof setTimeout>>();

  /** Estilos del libro resueltos para write mode */
  let bookStyles = $derived<BookStyleMap | null>(
    bookLayoutSettings ? resolveBookStyles(bookLayoutSettings) : null
  );

  // Enfocar el bloque pendiente tras cualquier cambio reactivo
  $effect(() => {
    if (!pendingFocusBlockId) return;
    const id = pendingFocusBlockId;
    // Dar un tick para que el DOM se actualice
    setTimeout(() => {
      const el = document.getElementById(`wbt-${id}`) as HTMLTextAreaElement | null;
      if (el) {
        el.focus();
        const len = el.value.length;
        el.selectionStart = len;
        el.selectionEnd   = len;
      }
      pendingFocusBlockId = null;
    }, 0);
  });

  // ── Write Mode — Svelte action: auto-resize textarea ─────────────────────
  function autoResizeAction(node: HTMLTextAreaElement, _text: string) {
    function resize() {
      node.style.height = '0';
      node.style.height = node.scrollHeight + 'px';
    }
    resize();
    node.addEventListener('input', resize);
    return {
      update(_: string) {
        if (document.activeElement !== node) resize();
      },
      destroy() { node.removeEventListener('input', resize); },
    };
  }

  // ── Write Mode — helpers visuales ────────────────────────────────────────

  /** Etiqueta del marcador en el margen izquierdo */
  function writeGutterLabel(type: BlockType): string {
    switch (type) {
      case 'HEADING_1':       return 'H1';
      case 'HEADING_2':       return 'H2';
      case 'HEADING_3':       return 'H3';
      case 'HEADING_4':       return 'H4';
      case 'PARAGRAPH':       return '¶';
      case 'QUOTE':           return '"';
      case 'CENTERED_PHRASE': return '⊙';
      case 'SEPARATOR':       return '—';
      case 'PAGE_BREAK':      return '↵';
      case 'IMAGE':           return '▣';
      case 'CHAPTER_OPENING': return '◈';
      case 'TITLE_PAGE':      return '◻';
      default:                return '·';
    }
  }

  /** CSS inline para la textarea de un bloque en write mode.
   *  Usa resolveEffectiveBookStyleInfoForBlock (igual que el preview) para
   *  respetar overrides de alineación, énfasis y variante del bloque. */
  function getWriteBlockCss(block: DocumentBlock): string {
    if (!bookLayoutSettings || !selectedSection) return '';
    const info = resolveEffectiveBookStyleInfoForBlock(bookLayoutSettings, selectedSection, block);
    if (!info) return '';
    return buildBookStyleCss(info.finalStyle, { includeMargins: false, includeMaxWidth: false });
  }

  /** Texto placeholder según tipo de bloque */
  function writeBlockPlaceholder(type: BlockType, index: number): string {
    if (index === 0 && type === 'PARAGRAPH') return 'Comienza a escribir…';
    switch (type) {
      case 'HEADING_1': return 'Título del capítulo';
      case 'HEADING_2': return 'Subtítulo';
      case 'HEADING_3': return 'Encabezado';
      case 'HEADING_4': return 'Epígrafe o etiqueta';
      case 'QUOTE':     return 'Cita o texto destacado…';
      case 'CENTERED_PHRASE': return 'Frase centrada, dedicatoria…';
      default:          return '';
    }
  }

  /** Resumen compacto de un bloque no-texto para la card en write mode */
  function writeMediaCardLabel(block: DocumentBlock): string {
    return blockContentPreview(block, 60) || blockTypeLabel(block.blockType);
  }

  // ── Write Mode — input y guardado ─────────────────────────────────────────

  function onWriteInput(e: Event, blockId: string) {
    const el   = e.target as HTMLTextAreaElement;
    const text = el.value;
    // Actualizar estado local inmediatamente
    blocks = blocks.map(b => b.id === blockId ? { ...b, contentText: text } : b);
    // Programar guardado con debounce de 800 ms
    if (writeTimers.has(blockId)) clearTimeout(writeTimers.get(blockId)!);
    writeTimers.set(blockId, setTimeout(async () => {
      writeTimers.delete(blockId);
      try { await updateBlock(blockId, { contentText: text }); } catch { /* silencioso */ }
    }, 800));
  }

  async function flushWriteBlockSave(blockId: string) {
    if (!writeTimers.has(blockId)) return;
    clearTimeout(writeTimers.get(blockId)!);
    writeTimers.delete(blockId);
    const block = blocks.find(b => b.id === blockId);
    if (block) {
      try { await updateBlock(blockId, { contentText: block.contentText }); } catch { /* silencioso */ }
    }
  }

  // ── Write Mode — teclado ──────────────────────────────────────────────────

  async function handleWriteKeydown(e: KeyboardEvent, blockId: string, blockIndex: number) {
    const el = e.target as HTMLTextAreaElement;

    // Enter (sin Shift) → nuevo párrafo debajo
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      await flushWriteBlockSave(blockId);
      if (!selectedSectionId || addingBlock) return;
      addingBlock = true;
      try {
        const created = await createBlockInSection(selectedSectionId, blocks, blockId, {
          blockType: 'PARAGRAPH', contentText: '',
        });
        blocks = await listBlocks(selectedSectionId);
        selectedBlockId     = created.id;
        pendingFocusBlockId = created.id;
      } catch (err) {
        globalError = err instanceof Error ? err.message : String(err);
      } finally {
        addingBlock = false;
      }
      return;
    }

    // Backspace al inicio del bloque
    if (e.key === 'Backspace' && el.selectionStart === 0 && el.selectionEnd === 0) {
      e.preventDefault();
      await flushWriteBlockSave(blockId);

      if (el.value === '') {
        // Bloque vacío → eliminar y focalizar el anterior
        if (blockIndex > 0) pendingFocusBlockId = blocks[blockIndex - 1].id;
        try {
          await deleteBlock(blockId);
          blocks = blocks.filter(b => b.id !== blockId);
          if (selectedBlockId === blockId) selectedBlockId = null;
        } catch (err) {
          globalError = err instanceof Error ? err.message : String(err);
        }
      } else if (blockIndex > 0) {
        // Bloque con texto → fusionar con el anterior si es editable
        const prev = blocks[blockIndex - 1];
        if (blockHasEditableText(blockEditorSurface(prev.blockType))) {
          const mergedText  = prev.contentText + el.value;
          const cursorAfter = prev.contentText.length;
          try {
            await updateBlock(prev.id, { contentText: mergedText });
            await deleteBlock(blockId);
            blocks = await listBlocks(selectedSectionId!);
            pendingFocusBlockId = prev.id;
            // Guardar posición de cursor para restaurarla después del foco
            setTimeout(() => {
              const prevEl = document.getElementById(`wbt-${prev.id}`) as HTMLTextAreaElement | null;
              if (prevEl) { prevEl.selectionStart = cursorAfter; prevEl.selectionEnd = cursorAfter; }
            }, 20);
          } catch (err) {
            globalError = err instanceof Error ? err.message : String(err);
          }
        }
      }
      return;
    }

    // Tab / Shift+Tab → navegar entre bloques
    if (e.key === 'Tab') {
      e.preventDefault();
      const targetIndex = e.shiftKey ? blockIndex - 1 : blockIndex + 1;
      if (targetIndex >= 0 && targetIndex < blocks.length) {
        const targetBlock = blocks[targetIndex];
        if (blockHasEditableText(blockEditorSurface(targetBlock.blockType))) {
          const targetEl = document.getElementById(`wbt-${targetBlock.id}`) as HTMLTextAreaElement | null;
          if (targetEl) { targetEl.focus(); selectedBlockId = targetBlock.id; }
        }
      }
      return;
    }

    // Ctrl+Shift+0-6 → cambio rápido de tipo de bloque
    if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
      const typeShortcuts: Record<string, BlockType> = {
        '0': 'PARAGRAPH',
        '1': 'HEADING_1',
        '2': 'HEADING_2',
        '3': 'HEADING_3',
        '4': 'HEADING_4',
        '5': 'QUOTE',
        '6': 'CENTERED_PHRASE',
      };
      if (typeShortcuts[e.key]) {
        e.preventDefault();
        await changeWriteBlockType(blockId, typeShortcuts[e.key]);
        return;
      }
    }

    // Escape → cerrar gutter picker si está abierto
    if (e.key === 'Escape' && gutterPickerBlockId) {
      e.preventDefault();
      gutterPickerBlockId = null;
      return;
    }
  }

  // Abrir inspector en write mode para bloques no-texto
  function openMediaBlockInWriteMode(blockId: string) {
    void selectBlock(blockId);
    showWriteInspector = true;
    inspectorTab = 'block';
  }

  // ── Write Mode — cambio de tipo de bloque ─────────────────────────────

  /** Tipos disponibles en el picker rápido del gutter */
  const WRITE_QUICK_TYPES: { type: BlockType; label: string; hint: string }[] = [
    { type: 'PARAGRAPH',       label: '¶',   hint: 'Párrafo' },
    { type: 'HEADING_1',       label: 'H1',  hint: 'Título principal' },
    { type: 'HEADING_2',       label: 'H2',  hint: 'Subtítulo' },
    { type: 'HEADING_3',       label: 'H3',  hint: 'Subtítulo 3' },
    { type: 'HEADING_4',       label: 'H4',  hint: 'Subtítulo 4' },
    { type: 'QUOTE',           label: '"',   hint: 'Cita' },
    { type: 'CENTERED_PHRASE', label: '⊙',  hint: 'Línea centrada' },
    { type: 'SEPARATOR',       label: '—',   hint: 'Separador' },
    { type: 'PAGE_BREAK',      label: '↵',   hint: 'Salto de página' },
  ];

  /** ID del bloque cuyo gutter picker está abierto */
  let gutterPickerBlockId = $state<string | null>(null);

  async function changeWriteBlockType(blockId: string, newType: BlockType) {
    gutterPickerBlockId = null;
    const prev = blocks.find(b => b.id === blockId);
    if (!prev || prev.blockType === newType) return;
    try {
      await updateBlock(blockId, { blockType: newType });
      blocks = blocks.map(b => b.id === blockId ? { ...b, blockType: newType } : b);
      // Refocalizar el mismo bloque
      pendingFocusBlockId = blockId;
    } catch (err) {
      globalError = err instanceof Error ? err.message : String(err);
    }
  }

  function toggleGutterPicker(blockId: string) {
    gutterPickerBlockId = gutterPickerBlockId === blockId ? null : blockId;
  }

  function closeGutterPicker() { gutterPickerBlockId = null; }

  // ── Drag & drop ───────────────────────────────────────────────────────────
  let dragSectionId          = $state<string | null>(null);
  let dragOverSectionIndex   = $state<number | null>(null);
  let dragBlockId            = $state<string | null>(null);
  let dragOverBlockIndex     = $state<number | null>(null);

  /** Comando / en textarea del inspector: menú de inserción de bloque siguiente */
  let slashMenuOpen          = $state(false);
  let slashMenuFilter        = $state('');
  let slashMenuLineStart     = $state(0);
  let slashMenuCaretEnd      = $state(0);
  let slashMenuSelectedIndex = $state(0);

  const SLASH_INSERT_TYPES: BlockType[] = [
    'PARAGRAPH',
    'HEADING_1',
    'HEADING_2',
    'QUOTE',
    'CENTERED_PHRASE',
    'SEPARATOR',
    'PAGE_BREAK',
    'IMAGE',
    'CHAPTER_OPENING',
  ];

  const SLASH_ALIASES: Partial<Record<BlockType, string[]>> = {
    PARAGRAPH:       ['p', 'parrafo', 'paragraph', 'texto'],
    HEADING_1:       ['h1', 'titulo', 'title'],
    HEADING_2:       ['h2', 'subtitulo', 'subtitle'],
    QUOTE:           ['cita', 'quote', 'blockquote'],
    CENTERED_PHRASE: ['centrado', 'centro', 'epigrafe', 'epígrafe', 'dedicatoria'],
    SEPARATOR:       ['separador', 'linea', 'línea', 'hr', '---'],
    PAGE_BREAK:      ['salto', 'page', 'pagina', 'página'],
    IMAGE:           ['imagen', 'img', 'foto', 'figure'],
    CHAPTER_OPENING: ['apertura', 'co'],
  };

  function stripAccents(s: string): string {
    return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  }

  let slashFilteredTypes = $derived.by(() => {
    const f = stripAccents(slashMenuFilter);
    if (!f) return SLASH_INSERT_TYPES;
    return SLASH_INSERT_TYPES.filter(t => {
      const label = stripAccents(blockTypeLabel(t));
      if (label.includes(f)) return true;
      const aliases = SLASH_ALIASES[t];
      return aliases?.some(a => {
        const aa = stripAccents(a);
        return aa.includes(f) || f.startsWith(aa) || aa.startsWith(f);
      }) ?? false;
    });
  });

  $effect(() => {
    if (!slashMenuOpen) return;
    const n = slashFilteredTypes.length;
    if (slashMenuSelectedIndex >= n) {
      slashMenuSelectedIndex = Math.max(0, n - 1);
    }
  });

  // Importación Markdown unificada (sección + libro)
  let showMarkdownImportModal = $state(false);
  let markdownImportNotice    = $state<string | null>(null);

  // Confirmación de borrado
  let confirmDeleteSection   = $state<DocumentSection | null>(null);
  let confirmDeleteBlock     = $state<DocumentBlock | null>(null);
  let deleting               = $state(false);

  // Inspector: feedback de guardado
  let inspectorSaving        = $state(false);
  let inspectorSaveOk        = $state(false);
  let inspectorError         = $state<string | null>(null);
  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

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

  let mdSectionContext = $derived(
    selectedSectionId && selectedSection
      ? {
          sectionId: selectedSectionId,
          title:     selectedSection.title || sectionTypeLabel(selectedSection.sectionType),
          blockCount: blocks.length,
        }
      : null,
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

  // ── Campos TITLE_PAGE ────────────────────────────────────────────────────
  let insp_bTpSeriesLabel    = $state('');
  let insp_bTpTitle          = $state('');
  let insp_bTpSubtitle       = $state('');
  let insp_bTpAuthorLine     = $state('');
  let insp_bTpPublisherInfo  = $state('');
  let insp_bTpTextAlign      = $state<TitlePageTextAlign>('center');

  let bookAssets           = $state<Asset[]>([]);

  // Suciedad del inspector
  let inspectorDirty = $state(false);
  let lastSyncedContentQuery = $state('');

  // ── Carga inicial ─────────────────────────────────────────────────────────
  onMount(async () => {
    await loadSections();
    await loadBookAssets();
    await loadBookStylesContext();

    function onGlobalKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape' && focusMode) {
        focusMode = false;
      }
    }
    document.addEventListener('keydown', onGlobalKeydown);
    return () => document.removeEventListener('keydown', onGlobalKeydown);
  });

  $effect(() => {
    if (bookId) void loadBookAssets();
  });

  $effect(() => {
    if (bookId) void loadBookStylesContext();
  });

  $effect(() => {
    if (selectedSectionId) {
      sectionBlockCounts[selectedSectionId] = blocks.length;
    }
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

  function resetTitlePageInspector() {
    const d = EMPTY_TITLE_PAGE_CONTENT;
    insp_bTpSeriesLabel   = d.seriesLabel;
    insp_bTpTitle         = d.title;
    insp_bTpSubtitle      = d.subtitle;
    insp_bTpAuthorLine    = d.authorLine;
    insp_bTpPublisherInfo = d.publisherInfo;
    insp_bTpTextAlign     = d.textAlign;
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
    closeSlashMenu();
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
    closeSlashMenu();
    await flushInspectorIfNeeded();
    selectedBlockId = id;
    const block = blocks.find(b => b.id === id);
    if (block) syncBlockToInspector(block);
    inspectorTab = 'block';
    resetInspectorDirty();
  }

  async function clearBlockSelection() {
    closeSlashMenu();
    await flushInspectorIfNeeded();
    selectedBlockId = null;
    syncSectionToInspector();
  }

  async function openCurrentSelectionInPreview() {
    if (openingPreview || !selectedSectionId) return;
    openingPreview = true;
    globalError = null;
    try {
      await flushInspectorIfNeeded();
      const url = new URL(`/books/${bookId}/preview`, window.location.origin);
      url.searchParams.set('sectionId', selectedSectionId);
      if (selectedBlockId) url.searchParams.set('blockId', selectedBlockId);
      await goto(url.pathname + url.search);
    } catch (e) {
      globalError = e instanceof Error ? e.message : String(e);
    } finally {
      openingPreview = false;
    }
  }

  function cancelAutoSave() {
    if (autoSaveTimer !== null) {
      clearTimeout(autoSaveTimer);
      autoSaveTimer = null;
    }
  }

  function scheduleAutoSave() {
    cancelAutoSave();
    autoSaveTimer = setTimeout(() => {
      autoSaveTimer = null;
      void performAutoSave();
    }, 800);
  }

  async function performAutoSave() {
    if (!inspectorDirty || inspectorSaving) return;
    if (inspectorMode === 'block' && selectedBlockId) {
      await saveBlock();
    } else if (inspectorMode === 'section' && selectedSectionId) {
      await saveSection();
    }
  }

  async function flushInspectorIfNeeded() {
    cancelAutoSave();
    await performAutoSave();
  }

  async function onInspectorBlur() {
    cancelAutoSave();
    await performAutoSave();
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
    if (block.blockType === 'TITLE_PAGE') {
      const tp = parseTitlePageContent(block.contentJson);
      insp_bTpSeriesLabel   = tp.seriesLabel;
      insp_bTpTitle         = tp.title;
      insp_bTpSubtitle      = tp.subtitle;
      insp_bTpAuthorLine    = tp.authorLine;
      insp_bTpPublisherInfo = tp.publisherInfo;
      insp_bTpTextAlign     = tp.textAlign;
    } else {
      resetTitlePageInspector();
    }
    resetInspectorDirty();
  }

  function resetInspectorDirty() {
    cancelAutoSave();
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
    scheduleAutoSave();
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
        setTimeout(() => (inspectorSaveOk = false), 2500);
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
    // Marcar clean ANTES del await para que cualquier markInspectorDirty()
    // que llegue DURANTE el guardado sea detectable al terminar.
    cancelAutoSave();
    inspectorDirty = false;
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
      } else if (insp_bType === 'TITLE_PAGE') {
        contentJsonPayload = serializeTitlePageContent({
          seriesLabel:   insp_bTpSeriesLabel,
          title:         insp_bTpTitle,
          subtitle:      insp_bTpSubtitle,
          authorLine:    insp_bTpAuthorLine,
          publisherInfo: insp_bTpPublisherInfo,
          textAlign:     insp_bTpTextAlign,
        });
      } else if (
        (prev?.blockType === 'IMAGE' && insp_bType !== 'IMAGE')
        || (prev?.blockType === 'CHAPTER_OPENING' && insp_bType !== 'CHAPTER_OPENING')
        || (prev?.blockType === 'TITLE_PAGE' && insp_bType !== 'TITLE_PAGE')
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
        inspectorSaveOk = true;
        setTimeout(() => (inspectorSaveOk = false), 2500);
        // Si llegaron cambios nuevos mientras guardábamos, programar otro guardado.
        if (inspectorDirty) scheduleAutoSave();
      }
    } catch (e) {
      inspectorError = e instanceof Error ? e.message : String(e);
      // Restaurar dirty para que el usuario pueda reintentar.
      inspectorDirty = true;
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
    } catch (e) {
      globalError = e instanceof Error ? e.message : String(e);
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

  async function insertGapAtIndex(i: number) {
    if (!selectedSectionId || addingBlock) return;
    const sorted = [...blocks].sort((a, b) => a.orderIndex - b.orderIndex);
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
      const payload: Omit<CreateBlockInput, 'sectionId'> = {
        blockType:   quickBlockType,
        contentText: '',
      };
      const created = i === 0
        ? await createBlockFirstInSection(selectedSectionId, blocks, payload)
        : await createBlockInSection(selectedSectionId, blocks, sorted[i - 1]!.id, payload);
      blocks = await listBlocks(selectedSectionId);
      await selectBlock(created.id);
    } catch (e) {
      globalError = e instanceof Error ? e.message : String(e);
    } finally {
      addingBlock = false;
    }
  }

  function blockCreatePayloadForType(type: BlockType): Omit<CreateBlockInput, 'sectionId'> {
    if (type === 'IMAGE') {
      return {
        blockType:   type,
        contentText: '',
        contentJson: serializeImageBlockContent({
          assetId: null,
          altText: '',
          caption: '',
          fillPage: false,
        }),
      };
    }
    if (type === 'CHAPTER_OPENING') {
      return {
        blockType:   type,
        contentText: '',
        contentJson: serializeChapterOpeningContent({ ...EMPTY_CHAPTER_OPENING_CONTENT }),
      };
    }
    if (type === 'TITLE_PAGE') {
      return {
        blockType:   type,
        contentText: '',
        contentJson: serializeTitlePageContent({ ...EMPTY_TITLE_PAGE_CONTENT }),
      };
    }
    return { blockType: type, contentText: '' };
  }

  function closeSlashMenu() {
    slashMenuOpen = false;
    slashMenuFilter = '';
    slashMenuLineStart = 0;
    slashMenuCaretEnd = 0;
    slashMenuSelectedIndex = 0;
  }

  function syncSlashMenuFromTextarea(el: HTMLTextAreaElement) {
    if (inspectorMode !== 'block' || !selectedBlockId || !blockHasEditableText(inspSurface)) {
      closeSlashMenu();
      return;
    }
    const v = el.value;
    const caret = el.selectionStart;
    const lineStart = v.lastIndexOf('\n', caret - 1) + 1;
    const lineToCaret = v.slice(lineStart, caret);
    const m = /^\/([\p{L}\p{N}_\-]*)$/u.exec(lineToCaret);
    if (m) {
      slashMenuOpen = true;
      slashMenuFilter = m[1] ?? '';
      slashMenuLineStart = lineStart;
      slashMenuCaretEnd = caret;
    } else {
      closeSlashMenu();
    }
  }

  function onInspectorContentInput(e: Event) {
    markInspectorDirty();
    const el = e.target;
    if (el instanceof HTMLTextAreaElement) syncSlashMenuFromTextarea(el);
  }

  function onInspectorContentSelect(e: Event) {
    const el = e.target;
    if (el instanceof HTMLTextAreaElement) syncSlashMenuFromTextarea(el);
  }

  function onInspectorContentKeydown(e: KeyboardEvent) {
    if (!slashMenuOpen || slashFilteredTypes.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      slashMenuSelectedIndex = Math.min(
        slashFilteredTypes.length - 1,
        slashMenuSelectedIndex + 1,
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      slashMenuSelectedIndex = Math.max(0, slashMenuSelectedIndex - 1);
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void insertBlockFromSlash(slashFilteredTypes[slashMenuSelectedIndex]!);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeSlashMenu();
    }
  }

  async function insertBlockFromSlash(type: BlockType) {
    if (!selectedSectionId || !selectedBlockId || addingBlock) return;
    const lineStart = slashMenuLineStart;
    const lineEnd = slashMenuCaretEnd;
    closeSlashMenu();
    addingBlock = true;
    globalError = null;
    const openingHint
      = type === 'CHAPTER_OPENING' && selectedSection?.sectionType !== 'CHAPTER'
        ? 'Sugerencia: «Apertura de capítulo» encaja mejor en secciones tipo Capítulo.'
        : null;
    if (openingHint) {
      globalError = openingHint;
      setTimeout(() => {
        if (globalError === openingHint) globalError = null;
      }, 4500);
    }
    try {
      const before = insp_bContentText.slice(0, lineStart);
      const after = insp_bContentText.slice(lineEnd);
      insp_bContentText = before + after;
      markInspectorDirty();
      await saveBlock();
      const payload = blockCreatePayloadForType(type);
      const created = await createBlockInSection(selectedSectionId, blocks, selectedBlockId, payload);
      blocks = await listBlocks(selectedSectionId);
      await selectBlock(created.id);
    } catch (e) {
      globalError = e instanceof Error ? e.message : String(e);
    } finally {
      addingBlock = false;
    }
  }

  async function insertTypedBlockQuick(type: BlockType) {
    if (!selectedSectionId || addingBlock) return;
    addingBlock = true;
    globalError = null;
    const openingHint
      = type === 'CHAPTER_OPENING' && selectedSection?.sectionType !== 'CHAPTER'
        ? 'Sugerencia: «Apertura de capítulo» encaja mejor en secciones tipo Capítulo.'
        : null;
    if (openingHint) {
      globalError = openingHint;
      setTimeout(() => {
        if (globalError === openingHint) globalError = null;
      }, 4500);
    }
    try {
      const payload = blockCreatePayloadForType(type);
      const afterId = selectedBlockId;
      const created = afterId
        ? await createBlockInSection(selectedSectionId, blocks, afterId, payload)
        : await createBlockInSection(selectedSectionId, blocks, null, payload);
      blocks = await listBlocks(selectedSectionId);
      await selectBlock(created.id);
    } catch (e) {
      globalError = e instanceof Error ? e.message : String(e);
    } finally {
      addingBlock = false;
    }
  }

  function applyInspectorBlockType(next: BlockType) {
    insp_bType = next;
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
    void onInspectorBlur();
  }

  function openBlockPalette() {
    showBlockPalette = true;
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

  // ── Drag & drop: secciones ────────────────────────────────────────────────
  function onSectionDragStart(e: DragEvent, sectionId: string) {
    dragSectionId = sectionId;
    e.dataTransfer!.effectAllowed = 'move';
    e.dataTransfer!.setData('text/plain', sectionId);
  }
  function onSectionDragOver(e: DragEvent, index: number) {
    if (!dragSectionId) return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
    dragOverSectionIndex = index;
  }
  function onSectionDragLeave() {
    dragOverSectionIndex = null;
  }
  async function onSectionDrop(e: DragEvent, toIndex: number) {
    e.preventDefault();
    dragOverSectionIndex = null;
    if (!dragSectionId) return;
    const fromId = dragSectionId;
    dragSectionId = null;
    try {
      sections = await reorderSectionToIndex(sections, fromId, toIndex);
    } catch (err) {
      globalError = err instanceof Error ? err.message : String(err);
    }
  }
  function onSectionDragEnd() {
    dragSectionId = null;
    dragOverSectionIndex = null;
  }

  // ── Drag & drop: bloques ──────────────────────────────────────────────────
  function onBlockDragStart(e: DragEvent, blockId: string) {
    dragBlockId = blockId;
    e.dataTransfer!.effectAllowed = 'move';
    e.dataTransfer!.setData('text/plain', blockId);
  }
  function onBlockDragOver(e: DragEvent, index: number) {
    if (!dragBlockId) return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
    dragOverBlockIndex = index;
  }
  function onBlockDragLeave() {
    dragOverBlockIndex = null;
  }
  async function onBlockDrop(e: DragEvent, toIndex: number) {
    e.preventDefault();
    dragOverBlockIndex = null;
    if (!dragBlockId) return;
    const fromId = dragBlockId;
    dragBlockId = null;
    await flushInspectorIfNeeded();
    try {
      blocks = await reorderBlockToIndex(blocks, fromId, toIndex);
    } catch (err) {
      globalError = err instanceof Error ? err.message : String(err);
    }
  }
  function onBlockDragEnd() {
    dragBlockId = null;
    dragOverBlockIndex = null;
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

  function onContentGlobalKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (showBlockPalette) {
        showBlockPalette = false;
        e.preventDefault();
      }
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      cancelAutoSave();
      void performAutoSave();
    }
  }

  function openMarkdownImportModal() {
    showMarkdownImportModal = true;
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

  async function onUnifiedBookImported(detail: {
    sectionCount: number;
    blockCount: number;
    mode: MarkdownBookImportMode;
  }) {
    const tail = detail.mode === 'replace' ? ' Se reemplazó el índice de secciones.' : ' Se añadieron al final.';
    markdownImportNotice = `Importación del libro: ${detail.sectionCount} sección(es), ${detail.blockCount} bloque(s).${tail}`;
    setTimeout(() => {
      markdownImportNotice = null;
    }, 7000);
    await onBookMarkdownImported();
  }

  async function onUnifiedSectionImported(detail: {
    blockCount: number;
    mode: MarkdownImportMode;
  }) {
    await flushInspectorIfNeeded();
    markdownImportNotice = `Importación en sección: ${detail.blockCount} bloque(s)${detail.mode === 'replace' ? ' (reemplazo)' : ' (al final)'}.`;
    setTimeout(() => {
      markdownImportNotice = null;
    }, 5500);
    if (selectedSectionId) {
      blocks = await listBlocks(selectedSectionId);
    }
    selectedBlockId = null;
    syncSectionToInspector();
  }

  // ── Acciones de DOM ───────────────────────────────────────────────────────

  function autoResize(node: HTMLTextAreaElement) {
    function resize() {
      node.style.height = 'auto';
      node.style.height = node.scrollHeight + 'px';
    }
    node.style.overflow = 'hidden';
    resize();
    node.addEventListener('input', resize);
    return { destroy: () => node.removeEventListener('input', resize) };
  }

  function focusEnd(node: HTMLTextAreaElement) {
    // Foca el textarea y mueve el cursor al final del contenido
    requestAnimationFrame(() => {
      node.focus();
      node.setSelectionRange(node.value.length, node.value.length);
    });
    return {};
  }
</script>

<svelte:head>
  <title>Contenido — MIDOO BOOKS</title>
</svelte:head>

<svelte:window onkeydown={onContentGlobalKeydown} />

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


<MarkdownImportUnifiedModal
  bind:open={showMarkdownImportModal}
  bookId={bookId}
  sectionContext={mdSectionContext}
  onImportedBook={onUnifiedBookImported}
  onImportedSection={onUnifiedSectionImported}
/>

<!-- ── Página principal ─────────────────────────────────────────────────── -->
<div class="content-page" class:content-page--focus={focusMode}>

  <!-- Error global -->
  {#if globalError}
    <div class="global-error">
      <strong>Error:</strong> {globalError}
      <button class="alert-close" onclick={() => (globalError = null)}>✕</button>
    </div>
  {/if}
  {#if markdownImportNotice}
    <div class="global-notice global-notice--ok">
      {markdownImportNotice}
      <button type="button" class="alert-close" onclick={() => (markdownImportNotice = null)}>✕</button>
    </div>
  {/if}

  <!-- ═════════════════ PANEL SECCIONES ════════════════════════════════════ -->
  <aside class="panel panel--sections" class:panel--hidden={focusMode || editorMode === 'write'} aria-hidden={focusMode || editorMode === 'write'}>
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
        <ul class="section-list" aria-label="Secciones del libro">
          {#each sections as section, i (section.id)}
            <li
              class="section-row"
              class:section-row--active={selectedSectionId === section.id}
              class:section-row--dragging={dragSectionId === section.id}
              class:section-row--drop-target={dragOverSectionIndex === i && dragSectionId !== section.id}
              ondragover={(e) => onSectionDragOver(e, i)}
              ondragleave={onSectionDragLeave}
              ondrop={(e) => onSectionDrop(e, i)}
            >
              <!-- Drag handle: only this element initiates dragging -->
              <span
                class="drag-handle drag-handle--section"
                draggable="true"
                title="Arrastrar para reordenar"
                aria-hidden="true"
                ondragstart={(e) => onSectionDragStart(e, section.id)}
                ondragend={onSectionDragEnd}
              >
                <svg width="14" height="18" viewBox="0 0 14 18" fill="currentColor">
                  <circle cx="4" cy="3"  r="1.8"/><circle cx="10" cy="3"  r="1.8"/>
                  <circle cx="4" cy="9"  r="1.8"/><circle cx="10" cy="9"  r="1.8"/>
                  <circle cx="4" cy="15" r="1.8"/><circle cx="10" cy="15" r="1.8"/>
                </svg>
              </span>

              <button
                type="button"
                class="section-item-main"
                class:section-item-main--active={selectedSectionId === section.id}
                aria-current={selectedSectionId === section.id ? 'true' : undefined}
                onclick={() => selectSection(section.id)}
              >
                <svg class="section-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d={sectionTypeIconPath(section.sectionType)}/>
                </svg>
                <span class="section-info">
                  <span class="section-title-text">
                    {section.title || sectionTypeLabel(section.sectionType)}
                  </span>
                  {#if section.title.trim()}
                    <span class="section-type-muted">{sectionTypeLabel(section.sectionType)}</span>
                  {/if}
                </span>
                {#if sectionWordCounts[section.id] !== undefined}
                  <span class="section-word-count" title="{sectionWordCounts[section.id]} palabras">
                    {sectionWordCounts[section.id] >= 1000
                      ? `${(sectionWordCounts[section.id] / 1000).toFixed(1)}k`
                      : sectionWordCounts[section.id]}
                    <span class="section-word-count__unit">¶</span>
                  </span>
                {:else if sectionBlockCounts[section.id] !== undefined}
                  <span class="section-blk-count" title="{sectionBlockCounts[section.id]} bloque(s)">
                    {sectionBlockCounts[section.id]}
                  </span>
                {/if}
              </button>

              <!-- Acciones: visibles en hover/activo -->
              <div class="section-actions">
                <button
                  type="button"
                  class="arrow-btn"
                  title="Subir"
                  disabled={i === 0}
                  onclick={() => moveSection(section.id, 'up')}
                >▲</button>
                <button
                  type="button"
                  class="arrow-btn"
                  title="Bajar"
                  disabled={i === sections.length - 1}
                  onclick={() => moveSection(section.id, 'down')}
                >▼</button>
                <button
                  type="button"
                  class="icon-btn"
                  title="Duplicar sección"
                  disabled={duplicatingSectionId === section.id}
                  onclick={() => onDuplicateSection(section)}
                >
                  {#if duplicatingSectionId === section.id}
                    <span class="spinner-sm spinner-sm--light"></span>
                  {:else}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  {/if}
                </button>
                <button
                  type="button"
                  class="icon-btn icon-btn--danger"
                  title="Eliminar sección"
                  onclick={() => (confirmDeleteSection = section)}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>
                </button>
              </div>
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
      <!-- ── Tabs de sección (solo modo escritura) ─────────────────────── -->
      {#if editorMode === 'write' && sections.length > 0}
        <div class="section-tabs" role="tablist" aria-label="Secciones del libro">
          {#each sections as sec (sec.id)}
            <button
              type="button"
              role="tab"
              class="section-tab"
              class:section-tab--active={selectedSectionId === sec.id}
              onclick={() => void selectSection(sec.id)}
              title={sectionTypeLabel(sec.sectionType)}
            >
              {sec.title || sectionTypeLabel(sec.sectionType)}
            </button>
          {/each}
          <button
            type="button"
            class="section-tab section-tab--add"
            onclick={openNewSectionModal}
            title="Nueva sección"
            aria-label="Nueva sección"
          >+</button>
        </div>
      {/if}

      <!-- Header del panel de bloques -->
      <div class="blocks-header">
        <div class="blocks-header-left">
          <h2 class="blocks-section-title">
            {selectedSection.title || sectionTypeLabel(selectedSection.sectionType)}
          </h2>
          <span class="blocks-section-badge">{sectionTypeLabel(selectedSection.sectionType)}</span>
        </div>
        <div class="blocks-header-actions">

          <!-- Toggle de modo: Escritura / Maquetación -->
          <div class="mode-toggle" role="group" aria-label="Modo de edición">
            <button
              type="button"
              class="mode-toggle__btn"
              class:mode-toggle__btn--active={editorMode === 'write'}
              onclick={() => setEditorMode('write')}
              title="Modo escritura — editor continuo sin paneles"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
              Escribir
            </button>
            <button
              type="button"
              class="mode-toggle__btn"
              class:mode-toggle__btn--active={editorMode === 'layout'}
              onclick={() => setEditorMode('layout')}
              title="Modo maquetación — paneles completos"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="18"/><rect x="14" y="3" width="7" height="10"/><rect x="14" y="17" width="7" height="4"/></svg>
              Maquetar
            </button>
          </div>

          {#if editorMode === 'layout'}
          <button
            type="button"
            class="btn btn--sm btn--ghost focus-toggle-btn"
            class:focus-toggle-btn--active={focusMode}
            onclick={() => { focusMode = !focusMode; }}
            title={focusMode ? 'Salir del modo enfocado (Esc)' : 'Modo escritura enfocado'}
          >
            {#if focusMode}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
              Salir
            {:else}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
              Enfocar
            {/if}
          </button>
          {/if}
          <button
            type="button"
            class="btn btn--sm btn--ghost"
            onclick={openMarkdownImportModal}
            disabled={loadingBlocks}
            title="Importar contenido desde Markdown"
          >
            Markdown
          </button>
          <div class="block-palette-wrap">
            <button
              type="button"
              class="btn btn--sm btn--primary"
              onclick={() => { showBlockPalette = !showBlockPalette; }}
              disabled={loadingBlocks}
              aria-expanded={showBlockPalette}
              aria-haspopup="true"
              title="Añadir bloque{selectedBlockId ? ' después del seleccionado' : ' al final'}"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
              Añadir
            </button>
            {#if showBlockPalette}
              <div class="block-palette" role="menu" aria-label="Tipo de bloque a insertar">
                <p class="block-palette-hint">
                  {selectedBlockId ? 'Insertar después del bloque seleccionado' : 'Insertar al final de la sección'}
                </p>
                <div class="block-palette-grid">
                  {#each SLASH_INSERT_TYPES as t (t)}
                    <button
                      type="button"
                      class="block-palette-item"
                      role="menuitem"
                      disabled={addingBlock}
                      onmousedown={(e) => e.preventDefault()}
                      onclick={() => { showBlockPalette = false; void insertTypedBlockQuick(t); }}
                    >
                      <svg class="block-palette-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                        <path d={blockTypeIcon(t)}/>
                      </svg>
                      <span class="block-palette-label">{blockTypeLabel(t)}</span>
                    </button>
                  {/each}
                </div>
                <div class="block-palette-footer">
                  <button
                    type="button"
                    class="block-palette-md-link"
                    onmousedown={(e) => e.preventDefault()}
                    onclick={() => { showBlockPalette = false; openMarkdownImportModal(); }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h10M4 18h7"/></svg>
                    Importar desde Markdown
                  </button>
                </div>
              </div>
            {/if}
          </div>
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
            <p class="empty-write-hint">Usa el botón <strong>+ Añadir</strong> del encabezado para insertar el primer bloque, o escribe <strong>/</strong> en el inspector para insertar el siguiente.</p>
            <button
              type="button"
              class="btn btn--sm btn--primary"
              disabled={addingBlock}
              onclick={openBlockPalette}
            >
              {#if addingBlock}<span class="spinner-sm spinner-sm--light"></span> Insertando…{:else}+ Añadir primer bloque{/if}
            </button>
          </div>
        {:else if editorMode === 'write'}
          <!-- ══════════════ MODO ESCRITURA ══════════════════════════════ -->
          <div class="write-stage" onclick={(e) => {
            if (e.target === e.currentTarget) { void clearBlockSelection(); showWriteInspector = false; }
          }}>
            <article class="write-doc" onclick={(e) => {
              if (e.target === e.currentTarget) { void clearBlockSelection(); showWriteInspector = false; }
            }}>
              {#each blocks as block, i (block.id)}
                <div
                  class="write-block write-block--{block.blockType}"
                  class:write-block--active={selectedBlockId === block.id}
                >
                  <!-- Marcador de tipo en el margen izquierdo (click → picker) -->
                  <div class="write-gutter-wrap">
                    <button
                      type="button"
                      class="write-gutter"
                      class:write-gutter--open={gutterPickerBlockId === block.id}
                      title="Cambiar tipo de bloque"
                      onclick={(e) => { e.stopPropagation(); selectedBlockId = block.id; toggleGutterPicker(block.id); }}
                    >{writeGutterLabel(block.blockType)}</button>

                    {#if gutterPickerBlockId === block.id}
                      <div class="gutter-picker" role="menu" aria-label="Tipo de bloque">
                        {#each WRITE_QUICK_TYPES as qt (qt.type)}
                          <button
                            type="button"
                            class="gutter-picker__item"
                            class:gutter-picker__item--active={block.blockType === qt.type}
                            role="menuitem"
                            title={qt.hint}
                            onclick={(e) => { e.stopPropagation(); void changeWriteBlockType(block.id, qt.type); }}
                          >
                            <span class="gutter-picker__label">{qt.label}</span>
                            <span class="gutter-picker__hint">{qt.hint}</span>
                          </button>
                        {/each}
                      </div>
                    {/if}
                  </div>

                  {#if blockHasEditableText(blockEditorSurface(block.blockType))}
                    <!-- Bloque de texto editable -->
                    <textarea
                      id="wbt-{block.id}"
                      class="write-textarea"
                      style={getWriteBlockCss(block)}
                      rows={1}
                      spellcheck="true"
                      placeholder={writeBlockPlaceholder(block.blockType, i)}
                      use:autoResizeAction={block.contentText}
                      onkeydown={(e) => handleWriteKeydown(e, block.id, i)}
                      oninput={(e) => onWriteInput(e, block.id)}
                      onblur={() => flushWriteBlockSave(block.id)}
                      onfocus={() => { selectedBlockId = block.id; showWriteInspector = false; }}
                    >{block.contentText}</textarea>

                  {:else if block.blockType === 'SEPARATOR'}
                    <div class="write-separator">· · ·</div>

                  {:else if block.blockType === 'PAGE_BREAK'}
                    <div class="write-page-break">
                      <span class="write-page-break__line"></span>
                      <span class="write-page-break__label">salto de página</span>
                      <span class="write-page-break__line"></span>
                    </div>

                  {:else if block.blockType === 'IMAGE'}
                    <!-- Imagen: mostrar la imagen real si hay asset asignado -->
                    {@const imgData = parseImageBlockContent(block.contentJson)}
                    {@const imgAsset = imgData.assetId ? bookAssets.find(a => a.id === imgData.assetId) : null}
                    <div
                      class="write-image"
                      class:write-image--active={selectedBlockId === block.id}
                    >
                      {#if imgAsset}
                        <img
                          src={assetDisplayUrl(bookId, imgAsset.storagePath)}
                          alt={imgData.altText || ''}
                          class="write-image__img"
                          class:write-image__img--fill={imgData.fillPage}
                        />
                        {#if imgData.caption?.trim()}
                          <p class="write-image__caption">{imgData.caption}</p>
                        {/if}
                      {:else}
                        <div class="write-image__placeholder">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                          <span>Sin imagen — clic para asignar</span>
                        </div>
                      {/if}
                      <!-- Overlay de editar en hover -->
                      <button
                        type="button"
                        class="write-image__edit-btn"
                        onclick={(e) => { e.stopPropagation(); openMediaBlockInWriteMode(block.id); }}
                        title="Configurar imagen"
                      >Editar imagen →</button>
                    </div>

                  {:else}
                    <!-- Bloques estructurados: CHAPTER_OPENING, TITLE_PAGE -->
                    <button
                      type="button"
                      class="write-media-card"
                      class:write-media-card--active={selectedBlockId === block.id}
                      onclick={(e) => { e.stopPropagation(); openMediaBlockInWriteMode(block.id); }}
                    >
                      <span class="write-media-card__type">{blockTypeLabel(block.blockType)}</span>
                      <span class="write-media-card__label">{writeMediaCardLabel(block)}</span>
                      <span class="write-media-card__edit">Editar →</span>
                    </button>
                  {/if}
                </div>
              {/each}

              <!-- Área de nuevo bloque al final -->
              {#if !addingBlock}
                <div
                  class="write-append"
                  role="button"
                  tabindex="0"
                  onclick={() => { void addBlockQuick('end'); }}
                  onkeydown={(e) => { if (e.key === 'Enter') void addBlockQuick('end'); }}
                >
                  Haz clic para continuar escribiendo <kbd>/</kbd> para insertar un bloque
                </div>
              {/if}
            </article>
          </div>

        {:else}
          <!-- ══════════════ MODO MAQUETACIÓN ════════════════════════════ -->
          <div class="manuscript-stage" onclick={(e) => { if (e.target === e.currentTarget) void clearBlockSelection(); }}>
            <article class="manuscript-doc" aria-label="Documento de la sección" onclick={(e) => { if (e.target === e.currentTarget) void clearBlockSelection(); }}>
              {#each blocks as block, i (block.id)}
                <div class="manuscript-insert-row">
                  <button
                    type="button"
                    class="manuscript-insert-btn"
                    title="Insertar bloque aquí"
                    disabled={addingBlock}
                    onclick={() => insertGapAtIndex(i)}
                  >+</button>
                </div>
                <section
                  class="manuscript-block block-item"
                  class:block-item--active={selectedBlockId === block.id}
                  class:block-item--dragging={dragBlockId === block.id}
                  class:block-item--drop-target={dragOverBlockIndex === i && dragBlockId !== block.id}
                  role="button"
                  tabindex="0"
                  aria-label="Bloque {i + 1}, {blockTypeLabel(block.blockType)}. Elegir para editar."
                  aria-current={selectedBlockId === block.id ? 'true' : undefined}
                  onclick={() => selectBlock(block.id)}
                  onkeydown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      void selectBlock(block.id);
                    }
                  }}
                  ondragover={(e) => onBlockDragOver(e, i)}
                  ondragleave={onBlockDragLeave}
                  ondrop={(e) => onBlockDrop(e, i)}
                >
                  <header class="manuscript-block-meta">
                    <!-- Drag handle: only this element initiates dragging -->
                    <span
                      class="drag-handle drag-handle--block"
                      draggable="true"
                      title="Arrastrar para reordenar"
                      aria-hidden="true"
                      ondragstart={(e) => onBlockDragStart(e, block.id)}
                      ondragend={onBlockDragEnd}
                    >
                      <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
                        <circle cx="3.5" cy="2.5"  r="1.6"/><circle cx="8.5" cy="2.5"  r="1.6"/>
                        <circle cx="3.5" cy="8"    r="1.6"/><circle cx="8.5" cy="8"    r="1.6"/>
                        <circle cx="3.5" cy="13.5" r="1.6"/><circle cx="8.5" cy="13.5" r="1.6"/>
                      </svg>
                    </span>
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

                  {#if selectedBlockId === block.id && blockHasEditableText(blockEditorSurface(block.blockType))}
                    <!-- ── Editor inline ──────────────────────────────────── -->
                    <div class="block-inline-editor" onclick={(e) => e.stopPropagation()}>
                      <div class="inline-format-bar">
                        <button type="button" class="inline-ctx-chip" class:inline-ctx-chip--on={insp_bType === 'HEADING_1'} onclick={() => applyInspectorBlockType('HEADING_1')}>H1</button>
                        <button type="button" class="inline-ctx-chip" class:inline-ctx-chip--on={insp_bType === 'HEADING_2'} onclick={() => applyInspectorBlockType('HEADING_2')}>H2</button>
                        <button type="button" class="inline-ctx-chip" class:inline-ctx-chip--on={insp_bType === 'HEADING_3'} onclick={() => applyInspectorBlockType('HEADING_3')}>H3</button>
                        <button type="button" class="inline-ctx-chip" class:inline-ctx-chip--on={insp_bType === 'HEADING_4'} onclick={() => applyInspectorBlockType('HEADING_4')}>H4</button>
                        <button type="button" class="inline-ctx-chip" class:inline-ctx-chip--on={insp_bType === 'PARAGRAPH'} onclick={() => applyInspectorBlockType('PARAGRAPH')}>¶</button>
                        <button type="button" class="inline-ctx-chip" class:inline-ctx-chip--on={insp_bType === 'QUOTE'} onclick={() => applyInspectorBlockType('QUOTE')}>Cita</button>
                        <button type="button" class="inline-ctx-chip" class:inline-ctx-chip--on={insp_bType === 'CENTERED_PHRASE'} onclick={() => applyInspectorBlockType('CENTERED_PHRASE')}>Centro</button>
                        <button type="button" class="inline-ctx-chip" class:inline-ctx-chip--on={insp_bType === 'SEPARATOR'} onclick={() => applyInspectorBlockType('SEPARATOR')}>—</button>
                        <button type="button" class="inline-ctx-chip" class:inline-ctx-chip--on={insp_bType === 'PAGE_BREAK'} onclick={() => applyInspectorBlockType('PAGE_BREAK')}>Salto</button>
                        <button type="button" class="inline-ctx-chip inline-ctx-chip--done" onclick={() => void clearBlockSelection()} title="Cerrar editor">✓ Listo</button>
                      </div>
                      <div class="inline-slash-host">
                        {#if slashMenuOpen}
                          <div class="slash-palette inline-slash-palette" role="listbox" aria-label="Insertar bloque siguiente">
                            {#each slashFilteredTypes as t, sIdx (t)}
                              <button
                                type="button"
                                class="slash-palette-row"
                                class:slash-palette-row--active={sIdx === slashMenuSelectedIndex}
                                role="option"
                                aria-selected={sIdx === slashMenuSelectedIndex}
                                onmousedown={(e) => e.preventDefault()}
                                onclick={() => void insertBlockFromSlash(t)}
                              >
                                <svg class="slash-palette-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                                  <path d={blockTypeIcon(t)}/>
                                </svg>
                                <span class="slash-palette-label">{blockTypeLabel(t)}</span>
                              </button>
                            {/each}
                          </div>
                        {/if}
                        <textarea
                          class="block-inline-textarea block-inline-textarea--{insp_bType.toLowerCase().replace(/_/g, '-')}"
                          bind:value={insp_bContentText}
                          use:autoResize
                          use:focusEnd
                          oninput={onInspectorContentInput}
                          onkeydown={onInspectorContentKeydown}
                          onselect={onInspectorContentSelect}
                          onblur={onInspectorBlur}
                          placeholder={
                            insp_bType === 'HEADING_1'         ? 'Título principal…'
                            : insp_bType === 'HEADING_2'       ? 'Subtítulo…'
                            : insp_bType === 'HEADING_3'       ? 'Subtítulo 3…'
                            : insp_bType === 'HEADING_4'       ? 'Subtítulo 4…'
                            : insp_bType === 'QUOTE'           ? 'Cita o epígrafe…'
                            : insp_bType === 'CENTERED_PHRASE' ? 'Frase centrada…'
                            : 'Escribe aquí. Usa / para insertar el siguiente bloque…'
                          }
                          aria-label="Contenido del bloque"
                        ></textarea>
                      </div>
                    </div>
                  {:else}
                  <!-- ── Preview de solo lectura ────────────────────────── -->
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
                  {/if}
                </section>
              {/each}
              <!-- Botón fijo al final de la lista -->
              <div class="manuscript-append-row">
                <button
                  type="button"
                  class="manuscript-append-btn"
                  title="Añadir bloque al final"
                  disabled={addingBlock}
                  onclick={() => insertGapAtIndex(blocks.length)}
                >+</button>
              </div>
            </article>
          </div>
        {/if}
      </div>
    {/if}

    <!-- ── Barra de estadísticas ──────────────────────────────────────── -->
    {#if selectedSectionId && !loadingBlocks}
      <div class="stats-bar" onclick={() => closeGutterPicker()}>
        <span class="stats-bar__section">
          <span class="stats-bar__label">Sección:</span>
          <strong>{currentSectionWordCount.toLocaleString('es')}</strong> palabras
          · ~{estimatedPages(currentSectionWordCount)} pág
        </span>
        {#if Object.keys(sectionWordCounts).length > 1}
          <span class="stats-bar__sep">│</span>
          <span class="stats-bar__book">
            <span class="stats-bar__label">Libro:</span>
            <strong>{bookWordCount.toLocaleString('es')}</strong> palabras
            · ~{estimatedPages(bookWordCount)} pág
          </span>
        {/if}

        <!-- Atajos de teclado (write mode) -->
        {#if editorMode === 'write'}
          <span class="stats-bar__sep stats-bar__sep--push">│</span>
          <span class="stats-bar__shortcuts">
            <kbd>Enter</kbd> nuevo bloque
            <kbd>⌫ inicio</kbd> fusionar
            <kbd>Tab</kbd> siguiente
            <kbd>Ctrl+Shift+1-4</kbd> H1–H4
            <kbd>/</kbd> tipos
          </span>
        {/if}
      </div>
    {/if}
  </main>

  <!-- ═════════════════ INSPECTOR ══════════════════════════════════════════ -->
  <aside class="panel panel--inspector" class:panel--hidden={focusMode || (editorMode === 'write' && !showWriteInspector)} aria-hidden={focusMode || (editorMode === 'write' && !showWriteInspector)}>
    <div class="panel-header">
      <span class="panel-title">
        {#if inspectorMode === 'block'}Inspector de bloque
        {:else if inspectorMode === 'section'}Inspector de sección
        {:else}Inspector{/if}
      </span>
      <!-- Botón cerrar inspector cuando está abierto desde write mode -->
      {#if editorMode === 'write' && showWriteInspector}
        <button
          type="button"
          class="icon-btn"
          title="Cerrar inspector y volver a escritura"
          onclick={() => { showWriteInspector = false; }}
          style="margin-left:auto;flex-shrink:0"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      {/if}
      {#if inspectorSaving}
        <span class="save-status save-status--saving">
          <span class="spinner-xs"></span>Guardando…
        </span>
      {:else if inspectorError}
        <span class="save-status save-status--error" title={inspectorError}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
          Error
        </span>
      {:else if inspectorSaveOk}
        <span class="save-status save-status--ok">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Guardado
        </span>
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

          <div class="insp-tab-bar">
            <button type="button" class="insp-tab" class:insp-tab--active={inspectorTab === 'block'} onclick={() => (inspectorTab = 'block')}>Bloque</button>
            <button type="button" class="insp-tab" class:insp-tab--active={inspectorTab === 'format'} onclick={() => (inspectorTab = 'format')}>Formato</button>
          </div>

          {#if inspectorTab === 'block'}

          <div class="insp-field">
            <label class="insp-label" for="ib-type">Tipo de bloque</label>
            <select
              id="ib-type"
              class="insp-select"
              bind:value={insp_bType}
              onchange={() => applyInspectorBlockType(insp_bType)}
            >
              {#each ALL_BLOCK_TYPES as t}
                <option value={t}>{blockTypeLabel(t)}</option>
              {/each}
            </select>
          </div>

          {#if inspSurface === 'image_placeholder'}
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
          {:else if inspSurface === 'title_page'}
            <!-- ── Inspector: TITLE_PAGE ─────────────────────────────── -->
            <p class="insp-hint insp-hint--block">
              Slots de posición fija para la portadilla del libro. Cada campo aparece en su zona vertical asignada en la página.
            </p>

            <div class="insp-field">
              <label class="insp-label" for="ib-tp-align">Alineación de texto</label>
              <select
                id="ib-tp-align"
                class="insp-select"
                bind:value={insp_bTpTextAlign}
                onchange={() => { markInspectorDirty(); onInspectorBlur(); }}
              >
                {#each TITLE_PAGE_TEXT_ALIGN_VALUES as a}
                  <option value={a}>{a === 'left' ? 'Izquierda' : a === 'center' ? 'Centrado' : 'Derecha'}</option>
                {/each}
              </select>
            </div>

            <div class="insp-tp-preview">
              <div class="insp-tp-preview__page" style="text-align:{insp_bTpTextAlign}">
                {#if insp_bTpSeriesLabel.trim()}<div class="insp-tp-preview__series">{insp_bTpSeriesLabel}</div>{/if}
                {#if insp_bTpTitle.trim()}<div class="insp-tp-preview__title">{insp_bTpTitle}</div>{/if}
                {#if insp_bTpSubtitle.trim()}<div class="insp-tp-preview__subtitle">{insp_bTpSubtitle}</div>{/if}
                {#if insp_bTpAuthorLine.trim()}<div class="insp-tp-preview__author">{insp_bTpAuthorLine}</div>{/if}
                {#if insp_bTpPublisherInfo.trim()}<div class="insp-tp-preview__publisher">{insp_bTpPublisherInfo}</div>{/if}
              </div>
            </div>

            <div class="insp-field">
              <label class="insp-label" for="ib-tp-series">Género / Serie <span class="insp-slot-badge">zona superior</span></label>
              <input id="ib-tp-series" class="insp-input" bind:value={insp_bTpSeriesLabel}
                oninput={markInspectorDirty} onblur={onInspectorBlur} maxlength={120}
                placeholder="Ej: Novela Ligera Ilustrada" />
            </div>

            <div class="insp-field">
              <label class="insp-label" for="ib-tp-title">Título principal <span class="insp-slot-badge insp-slot-badge--accent">zona central</span></label>
              <input id="ib-tp-title" class="insp-input" bind:value={insp_bTpTitle}
                oninput={markInspectorDirty} onblur={onInspectorBlur} maxlength={300}
                placeholder="Ej: Los Secretos de la Antigua Aldea del Sonido" />
            </div>

            <div class="insp-field">
              <label class="insp-label" for="ib-tp-subtitle">Subtítulo <span class="insp-slot-badge">zona central baja</span></label>
              <input id="ib-tp-subtitle" class="insp-input" bind:value={insp_bTpSubtitle}
                oninput={markInspectorDirty} onblur={onInspectorBlur} maxlength={200}
                placeholder="Ej: El misterio del bosque eterno (opcional)" />
            </div>

            <div class="insp-field">
              <label class="insp-label" for="ib-tp-author">Autor <span class="insp-slot-badge">zona inferior</span></label>
              <input id="ib-tp-author" class="insp-input" bind:value={insp_bTpAuthorLine}
                oninput={markInspectorDirty} onblur={onInspectorBlur} maxlength={200}
                placeholder="Ej: Escrito por Junior C. Rodriguez V." />
            </div>

            <div class="insp-field">
              <label class="insp-label" for="ib-tp-publisher">Editorial / Año <span class="insp-slot-badge">pie de página</span></label>
              <input id="ib-tp-publisher" class="insp-input" bind:value={insp_bTpPublisherInfo}
                oninput={markInspectorDirty} onblur={onInspectorBlur} maxlength={200}
                placeholder="Ej: Horizonte · 2025 (opcional)" />
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

          <div class="insp-divider"></div>
          <div class="insp-meta">
            <span class="insp-meta-row"><span class="insp-meta-key">Posición</span><span class="insp-meta-val">#{selectedBlock.orderIndex + 1}</span></span>
          </div>

          <div class="insp-divider"></div>
          <button
            type="button"
            class="btn btn--danger-ghost btn--full insp-delete-block-btn"
            onclick={() => (confirmDeleteBlock = selectedBlock)}
            disabled={deleting}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/>
            </svg>
            Eliminar bloque
          </button>

          {:else}
          <!-- ── Tab: Formato ── -->

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

          {/if}

        </div>
      {/if}

    </div><!-- end panel-body -->

    <!-- Footer del inspector -->
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
          <div class="alert alert--error alert--compact">
            <span>{inspectorError}</span>
            <button type="button" class="alert-close-inline" onclick={() => (inspectorError = null)}>✕</button>
          </div>
        {/if}
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
    background: var(--editor-surface-mid);
    color: var(--editor-text);
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

  .global-notice {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 99;
    font-size: 12px;
    padding: 8px 16px 8px 40px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .global-notice--ok {
    background: rgba(60, 140, 90, 0.18);
    border-bottom: 1px solid rgba(80, 160, 110, 0.35);
    color: #a8e8c8;
  }

  .global-notice--ok .alert-close {
    color: #a8e8c8;
  }

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
  .global-error .alert-close {
    color: #f09090;
  }
  .alert-close:hover { opacity: 1; }

  .alert-close-inline {
    background: none;
    border: none;
    color: #f09090;
    cursor: pointer;
    font-size: 11px;
    line-height: 1;
    padding: 0 2px;
    opacity: 0.6;
    flex-shrink: 0;
  }
  .alert-close-inline:hover { opacity: 1; }

  /* ═══════════════════════════════════════════════════════════════════════════
     MODO ESCRITURA ENFOCADO
  ═══════════════════════════════════════════════════════════════════════════ */
  .panel--hidden {
    width: 0 !important;
    min-width: 0 !important;
    overflow: hidden;
    border: none !important;
    flex-shrink: 0;
    transition: width 0.25s ease;
    pointer-events: none;
  }

  .content-page--focus .manuscript-doc {
    width: min(820px, calc(100% - 64px));
  }

  .content-page--focus .manuscript-stage {
    padding: 32px 0 80px;
  }

  .focus-toggle-btn {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .focus-toggle-btn--active {
    color: var(--editor-accent, #7ab8e8);
    border-color: var(--editor-accent-border, rgba(122,184,232,0.35));
  }

  /* ── Toggle de modo Escribir / Maquetar ─────────────────────────────── */
  .mode-toggle {
    display: flex;
    align-items: center;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.1);
    overflow: hidden;
    flex-shrink: 0;
  }
  .mode-toggle__btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    font-size: 11px;
    font-weight: 500;
    font-family: inherit;
    color: rgba(255,255,255,0.45);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
    white-space: nowrap;
  }
  .mode-toggle__btn + .mode-toggle__btn {
    border-left: 1px solid rgba(255,255,255,0.1);
  }
  .mode-toggle__btn:hover:not(.mode-toggle__btn--active) {
    background: rgba(255,255,255,0.07);
    color: rgba(255,255,255,0.7);
  }
  .mode-toggle__btn--active {
    background: rgba(122,184,232,0.15);
    color: #7ab8e8;
  }

  /* ── Tabs de sección (modo escritura) ───────────────────────────────── */
  .section-tabs {
    display: flex;
    align-items: center;
    overflow-x: auto;
    scrollbar-width: none;
    border-bottom: 1px solid var(--editor-border);
    background: var(--editor-surface-void);
    flex-shrink: 0;
    padding: 0 4px;
    gap: 2px;
  }
  .section-tabs::-webkit-scrollbar { display: none; }

  .section-tab {
    display: inline-flex;
    align-items: center;
    padding: 8px 14px;
    font-size: 12px;
    font-weight: 500;
    font-family: inherit;
    color: rgba(255,255,255,0.45);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    white-space: nowrap;
    transition: color 0.12s, border-color 0.12s;
    flex-shrink: 0;
    margin-bottom: -1px;
  }
  .section-tab:hover:not(.section-tab--active) {
    color: rgba(255,255,255,0.75);
  }
  .section-tab--active {
    color: #7ab8e8;
    border-bottom-color: #7ab8e8;
  }
  .section-tab--add {
    font-size: 16px;
    padding: 4px 10px;
    color: rgba(255,255,255,0.25);
    border-bottom: none;
  }
  .section-tab--add:hover { color: rgba(255,255,255,0.7); }

  /* ── Barra de estadísticas ──────────────────────────────────────────── */
  .stats-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 20px;
    height: 28px;
    font-size: 11px;
    color: rgba(255,255,255,0.3);
    border-top: 1px solid var(--editor-border);
    background: var(--editor-surface-void);
    flex-shrink: 0;
    user-select: none;
  }
  .stats-bar__label {
    color: rgba(255,255,255,0.18);
    margin-right: 3px;
  }
  .stats-bar strong {
    color: rgba(255,255,255,0.55);
    font-weight: 600;
  }
  .stats-bar__sep {
    color: rgba(255,255,255,0.12);
  }
  .stats-bar__sep--push {
    margin-left: auto;
  }
  .stats-bar__shortcuts {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 10px;
    color: rgba(255,255,255,0.2);
    overflow: hidden;
    white-space: nowrap;
  }
  .stats-bar__shortcuts kbd {
    display: inline-block;
    padding: 1px 5px;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 3px;
    font-size: 9px;
    font-family: monospace;
    background: rgba(255,255,255,0.04);
    color: rgba(255,255,255,0.3);
  }

  /* ── Word count en lista de secciones ───────────────────────────────── */
  .section-word-count {
    display: inline-flex;
    align-items: center;
    gap: 1px;
    font-size: 10px;
    font-variant-numeric: tabular-nums;
    color: rgba(255,255,255,0.35);
    background: rgba(255,255,255,0.06);
    border-radius: 4px;
    padding: 1px 5px;
    flex-shrink: 0;
  }
  .section-word-count__unit {
    font-size: 9px;
    opacity: 0.6;
  }
  .section-row--active .section-word-count {
    color: rgba(122,184,232,0.7);
    background: rgba(122,184,232,0.1);
  }

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
    border-right: 1px solid var(--editor-border);
    background: var(--editor-surface-void);
    transition: width 0.25s ease;
  }

  .panel--blocks {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--editor-border);
    background: var(--editor-surface-mid);
  }

  .panel--inspector {
    width: 272px;
    background: var(--editor-surface-inspector);
    transition: width 0.25s ease;
  }

  /* Panel header */
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 14px;
    height: 44px;
    border-bottom: 1px solid var(--editor-border);
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
    color: var(--editor-text-faint);
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
    color: var(--editor-text-faint);
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

  /* Save status — indicador compacto en el header del inspector */
  .save-status {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.02em;
    padding: 2px 7px;
    border-radius: 10px;
    flex-shrink: 0;
    white-space: nowrap;
  }

  .save-status--saving {
    color: var(--editor-accent);
    background: rgba(122, 184, 232, 0.1);
  }

  .save-status--ok {
    color: #6fcf97;
    background: rgba(111, 207, 151, 0.1);
    animation: save-ok-in 0.2s ease;
  }

  .save-status--error {
    color: #f09090;
    background: rgba(200, 80, 80, 0.12);
    cursor: help;
  }

  @keyframes save-ok-in {
    from { opacity: 0; transform: scale(0.9); }
    to   { opacity: 1; transform: scale(1); }
  }

  @media (prefers-reduced-motion: reduce) {
    .save-status--ok { animation: none; }
  }

  /* Spinner extra-pequeño para el indicador de guardado */
  .spinner-xs {
    width: 9px; height: 9px;
    border: 1.5px solid rgba(122, 184, 232, 0.3);
    border-top-color: var(--editor-accent);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     LISTA DE SECCIONES
  ═══════════════════════════════════════════════════════════════════════════ */
  .section-list {
    list-style: none;
    margin: 0;
    padding: 6px 0;
  }

  .section-row {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 0 4px 0 0;
    transition: opacity 0.15s;
  }
  .section-row--dragging {
    opacity: 0.35;
  }
  .section-row--drop-target {
    box-shadow: inset 0 2px 0 0 var(--editor-accent);
  }

  .section-item-main {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    margin: 0;
    padding: 8px 10px;
    background: none;
    border: none;
    border-left: 3px solid transparent;
    border-radius: 0 8px 8px 0;
    cursor: pointer;
    font: inherit;
    color: inherit;
    text-align: left;
    transition:
      background var(--editor-duration) var(--editor-ease),
      border-color var(--editor-duration) var(--editor-ease),
      box-shadow var(--editor-duration) var(--editor-ease);
  }

  .section-item-main:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .section-item-main:focus-visible {
    outline: 2px solid var(--editor-accent);
    outline-offset: 1px;
  }

  .section-item-main--active {
    background: rgba(122, 184, 232, 0.12) !important;
    border-left-color: var(--editor-accent);
    box-shadow: inset 0 0 0 1px var(--editor-accent-glow);
  }

  /* Acciones de sección: ocultas hasta hover/activo/focus */
  .section-actions {
    display: flex;
    align-items: center;
    gap: 1px;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity var(--editor-duration) var(--editor-ease);
  }

  .section-row:hover .section-actions,
  .section-row--active .section-actions,
  .section-row:focus-within .section-actions {
    opacity: 1;
  }

  /* Drag handle */
  .drag-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: rgba(255,255,255,0.45);
    cursor: grab;
    opacity: 1;
    transition: color 0.12s;
    user-select: none;
    -webkit-user-drag: element;
  }
  .drag-handle:hover  { color: rgba(255,255,255,0.85); }
  .drag-handle:active { cursor: grabbing; color: rgba(255,255,255,0.9); }
  .drag-handle--section { padding: 4px 4px 4px 8px; min-width: 26px; }
  .drag-handle--block   { padding: 2px 4px 2px 0;   min-width: 20px; }

  .arrow-btn {
    background: none;
    border: none;
    color: rgba(255,255,255,0.2);
    cursor: pointer;
    font-size: 7px;
    line-height: 1;
    padding: 1px 3px;
    border-radius: 3px;
    transition:
      color var(--editor-duration) var(--editor-ease),
      background var(--editor-duration) var(--editor-ease);
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
    color: var(--editor-text-soft);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .section-item-main--active .section-title-text {
    color: var(--editor-accent);
  }

  .section-type-muted {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.32);
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .section-item-main--active .section-type-muted {
    color: var(--editor-accent-muted);
  }

  /* Icono de tipo de sección */
  .section-type-icon {
    flex-shrink: 0;
    width: 13px;
    height: 13px;
    margin-right: 6px;
    color: rgba(255,255,255,0.3);
    transition: color 0.15s;
  }

  .section-item-main:hover .section-type-icon,
  .section-item-main--active .section-type-icon {
    color: rgba(255,255,255,0.6);
  }

  .section-item-main--active .section-type-icon {
    color: var(--editor-accent);
  }

  /* Contador de bloques */
  .section-blk-count {
    flex-shrink: 0;
    margin-left: 4px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 8px;
    background: rgba(255,255,255,0.07);
    color: rgba(255,255,255,0.35);
    font-size: 10px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    line-height: 16px;
    text-align: center;
    transition: background 0.15s, color 0.15s;
  }

  .section-item-main--active .section-blk-count {
    background: rgba(122,184,232,0.15);
    color: var(--editor-accent-muted);
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     PANEL CENTRAL — BLOQUES
  ═══════════════════════════════════════════════════════════════════════════ */
  .blocks-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    height: 52px;
    border-bottom: 1px solid var(--editor-border);
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

  /* ── Paleta unificada de inserción de bloques ──────────────────────────── */
  .block-palette-wrap {
    position: relative;
  }

  .block-palette {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    z-index: 40;
    width: 280px;
    border-radius: 10px;
    border: 1px solid var(--editor-border-strong);
    background: var(--editor-surface-elevated);
    box-shadow: var(--editor-shadow-popover);
    overflow: hidden;
    animation: palette-in var(--editor-duration) var(--editor-ease);
  }

  @keyframes palette-in {
    from { opacity: 0; transform: translateY(-6px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0)    scale(1); }
  }

  @media (prefers-reduced-motion: reduce) {
    .block-palette { animation: none; }
  }

  .block-palette-hint {
    margin: 0;
    padding: 9px 12px 7px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--editor-text-faint);
    border-bottom: 1px solid var(--editor-border);
  }

  .block-palette-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 2px;
    padding: 6px;
  }

  .block-palette-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    padding: 10px 6px 8px;
    border: none;
    border-radius: 7px;
    background: transparent;
    color: rgba(255, 255, 255, 0.75);
    font-family: inherit;
    cursor: pointer;
    transition: background var(--editor-duration) var(--editor-ease),
                color var(--editor-duration) var(--editor-ease);
  }

  .block-palette-item:hover:not(:disabled) {
    background: var(--editor-accent-soft);
    color: #d6ecff;
  }

  .block-palette-item:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .block-palette-icon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    opacity: 0.8;
  }

  .block-palette-item:hover:not(:disabled) .block-palette-icon {
    opacity: 1;
  }

  .block-palette-label {
    font-size: 10px;
    font-weight: 500;
    text-align: center;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .block-palette-footer {
    border-top: 1px solid var(--editor-border);
    padding: 6px;
  }

  .block-palette-md-link {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    padding: 8px 10px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: rgba(255, 255, 255, 0.45);
    font-size: 11px;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    transition: background var(--editor-duration) var(--editor-ease),
                color var(--editor-duration) var(--editor-ease);
  }

  .block-palette-md-link:hover {
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.75);
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

  /* ═══════════════════════════════════════════════════════════════════════════
     MODO ESCRITURA — write stage
  ═══════════════════════════════════════════════════════════════════════════ */

  .write-stage {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    background: #1c1c2a;
    padding: 40px 20px 100px;
    display: flex;
    justify-content: center;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.1) transparent;
  }

  .write-doc {
    width: 100%;
    max-width: 660px;
    background: #fafaf8;
    color: #1a1a22;
    border-radius: 3px;
    box-shadow:
      0 2px 8px rgba(0,0,0,0.15),
      0 16px 48px rgba(0,0,0,0.28);
    padding: 72px 80px 80px;
    min-height: 60vh;
    position: relative;
    font-family: 'Georgia', 'Times New Roman', serif;
    font-size: 12pt;
    line-height: 1.6;
  }

  /* ── Bloque base ──────────────────────────────────────────────────────── */
  .write-block {
    position: relative;
    display: flex;
    align-items: flex-start;
    margin-bottom: 0;
  }

  /* Margen izquierdo con tipo — wrapper para posicionamiento del picker */
  .write-gutter-wrap {
    position: absolute;
    left: -48px;
    top: 0;
    width: 40px;
  }

  .write-gutter {
    display: block;
    width: 100%;
    text-align: right;
    font-size: 9px;
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: rgba(0,0,0,0.25);
    opacity: 0;
    transition: opacity 0.12s, color 0.12s;
    cursor: pointer;
    user-select: none;
    padding: 3px 0;
    background: none;
    border: none;
    border-radius: 3px;
  }
  .write-block:hover .write-gutter,
  .write-block--active .write-gutter { opacity: 1; }
  .write-gutter:hover,
  .write-gutter--open {
    color: rgba(37,99,235,0.7);
    opacity: 1;
  }

  /* ── Gutter type picker ────────────────────────────────────────────── */
  .gutter-picker {
    position: absolute;
    top: 0;
    left: calc(100% + 4px);
    z-index: 40;
    background: #fff;
    border: 1px solid rgba(0,0,0,0.12);
    border-radius: 10px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.14), 0 1px 4px rgba(0,0,0,0.08);
    padding: 5px;
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 160px;
  }
  .gutter-picker__item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    border: none;
    background: transparent;
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    font-family: 'Helvetica Neue', Arial, sans-serif;
    transition: background 0.08s;
  }
  .gutter-picker__item:hover {
    background: rgba(37,99,235,0.08);
  }
  .gutter-picker__item--active {
    background: rgba(37,99,235,0.1);
  }
  .gutter-picker__label {
    font-size: 10px;
    font-weight: 700;
    width: 16px;
    text-align: center;
    color: rgba(37,99,235,0.8);
    flex-shrink: 0;
  }
  .gutter-picker__hint {
    font-size: 12px;
    color: rgba(0,0,0,0.6);
  }
  .gutter-picker__item--active .gutter-picker__hint {
    color: rgba(37,99,235,0.9);
    font-weight: 500;
  }

  /* ── Textarea editable ────────────────────────────────────────────────── */
  .write-textarea {
    width: 100%;
    background: transparent;
    border: none;
    outline: none;
    resize: none;
    overflow: hidden;
    color: #1a1a22;
    font-family: 'Georgia', 'Times New Roman', serif;
    font-size: 12pt;
    line-height: 1.6;
    padding: 0;
    margin: 0;
    white-space: pre-wrap;
    min-height: 1.6em;
    /* Highlight sutil cuando está activo */
    caret-color: #2563eb;
  }
  .write-textarea::placeholder {
    color: rgba(0,0,0,0.22);
    font-style: italic;
  }
  .write-textarea:focus { outline: none; }

  /* Espaciado entre bloques según tipo */
  .write-block--HEADING_1  { margin-top: 2em;    margin-bottom: 0.2em; }
  .write-block--HEADING_2  { margin-top: 1.6em;  margin-bottom: 0.15em; }
  .write-block--HEADING_3  { margin-top: 1.2em;  margin-bottom: 0.1em; }
  .write-block--HEADING_4  { margin-top: 0.8em;  margin-bottom: 0.1em; }
  .write-block--PARAGRAPH  { margin-top: 0;      }
  .write-block--QUOTE      { margin-top: 1em;    margin-bottom: 1em; }
  .write-block--CENTERED_PHRASE { margin-top: 1.4em; margin-bottom: 1.4em; }
  .write-block--SEPARATOR  { margin-top: 1.5em;  margin-bottom: 1.5em; }
  .write-block--PAGE_BREAK { margin-top: 1.2em;  margin-bottom: 1.2em; }
  .write-block--IMAGE,
  .write-block--CHAPTER_OPENING,
  .write-block--TITLE_PAGE { margin-top: 1.2em;  margin-bottom: 1.2em; }

  /* Cita: borde izquierdo visual */
  .write-block--QUOTE .write-textarea {
    border-left: 3px solid rgba(0,0,0,0.15);
    padding-left: 14px;
    color: rgba(0,0,0,0.72);
  }

  /* ── Decoradores: separador y salto de página ─────────────────────────── */
  .write-separator {
    width: 100%;
    text-align: center;
    font-size: 14px;
    color: rgba(0,0,0,0.25);
    letter-spacing: 0.4em;
    padding: 4px 0;
    user-select: none;
  }

  .write-page-break {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    user-select: none;
  }
  .write-page-break__line {
    flex: 1;
    height: 1px;
    background: rgba(0,0,0,0.12);
    border-bottom: 1px dashed rgba(0,0,0,0.15);
  }
  .write-page-break__label {
    font-size: 10px;
    font-family: 'Helvetica Neue', Arial, sans-serif;
    color: rgba(0,0,0,0.25);
    text-transform: uppercase;
    letter-spacing: 0.12em;
    white-space: nowrap;
  }

  /* ── Card de bloques no-texto (IMAGE, CO, TP) ─────────────────────────── */
  /* ── Imagen en write mode ────────────────────────────────────────────── */
  .write-image {
    position: relative;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    border-radius: 4px;
    overflow: hidden;
  }
  .write-image__img {
    display: block;
    max-width: 100%;
    height: auto;
    border-radius: 3px;
  }
  .write-image__img--fill {
    width: 100%;
    max-height: 320px;
    object-fit: cover;
  }
  .write-image__caption {
    font-size: 11px;
    color: rgba(0,0,0,0.45);
    text-align: center;
    font-style: italic;
    margin: 0;
    padding: 0 8px;
    font-family: 'Helvetica Neue', Arial, sans-serif;
  }
  .write-image__placeholder {
    width: 100%;
    min-height: 80px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: rgba(0,0,0,0.04);
    border: 1.5px dashed rgba(0,0,0,0.15);
    border-radius: 4px;
    color: rgba(0,0,0,0.35);
    font-size: 12px;
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-style: italic;
    padding: 20px;
    cursor: pointer;
  }
  /* Botón editar: oculto hasta hover */
  .write-image__edit-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    padding: 4px 10px;
    border-radius: 6px;
    border: none;
    background: rgba(0,0,0,0.55);
    color: #fff;
    font-size: 11px;
    font-family: 'Helvetica Neue', Arial, sans-serif;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.12s;
    backdrop-filter: blur(4px);
  }
  .write-image:hover .write-image__edit-btn,
  .write-image--active .write-image__edit-btn { opacity: 1; }

  .write-media-card {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-radius: 8px;
    border: 1.5px dashed rgba(0,0,0,0.15);
    background: rgba(0,0,0,0.03);
    cursor: pointer;
    text-align: left;
    font-family: 'Helvetica Neue', Arial, sans-serif;
    transition: border-color 0.12s, background 0.12s;
  }
  .write-media-card:hover,
  .write-media-card--active {
    border-color: rgba(37,99,235,0.4);
    background: rgba(37,99,235,0.04);
  }
  .write-media-card__type {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(0,0,0,0.35);
    flex-shrink: 0;
    white-space: nowrap;
  }
  .write-media-card__label {
    flex: 1;
    font-size: 12px;
    color: rgba(0,0,0,0.5);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-style: italic;
  }
  .write-media-card__edit {
    font-size: 11px;
    color: rgba(37,99,235,0.7);
    flex-shrink: 0;
    white-space: nowrap;
  }

  /* ── Área de añadir bloque al final ──────────────────────────────────── */
  .write-append {
    margin-top: 1.5em;
    padding: 10px 0;
    font-size: 12px;
    font-family: 'Helvetica Neue', Arial, sans-serif;
    color: rgba(0,0,0,0.2);
    cursor: text;
    font-style: italic;
    user-select: none;
    transition: color 0.12s;
  }
  .write-append:hover { color: rgba(0,0,0,0.35); }
  .write-append kbd {
    display: inline-block;
    padding: 1px 5px;
    border: 1px solid rgba(0,0,0,0.15);
    border-radius: 3px;
    font-size: 10px;
    font-family: monospace;
    font-style: normal;
    background: rgba(0,0,0,0.04);
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
    opacity: 0;
    transition: opacity var(--editor-duration) var(--editor-ease);
  }

  .manuscript-doc:hover .manuscript-insert-row,
  .manuscript-insert-row:hover,
  .manuscript-insert-row:focus-within,
  .manuscript-block.block-item:hover + .manuscript-insert-row {
    opacity: 1;
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

  /* Botón fijo al final de la lista de bloques */
  .manuscript-append-row {
    display: flex;
    justify-content: center;
    padding: 10px 0 18px;
  }

  .manuscript-append-btn {
    width: 28px;
    height: 28px;
    border-radius: 999px;
    border: 1.5px dashed rgba(0, 0, 0, 0.22);
    background: transparent;
    color: rgba(0, 0, 0, 0.35);
    font-size: 15px;
    line-height: 1;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
  }

  .manuscript-append-btn:hover:not(:disabled) {
    border-color: rgba(27, 53, 82, 0.5);
    border-style: solid;
    background: rgba(255,255,255,0.9);
    color: #1b3552;
  }

  .manuscript-append-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .manuscript-block.block-item {
    display: block;
    padding: 8px 8px 10px;
    border-radius: 8px;
    border: 1px solid transparent;
    background: transparent;
    cursor: pointer;
    transition:
      background var(--editor-duration) var(--editor-ease),
      border-color var(--editor-duration) var(--editor-ease),
      box-shadow var(--editor-duration) var(--editor-ease);
  }
  .manuscript-block.block-item:hover {
    background: rgba(40, 66, 97, 0.05);
    border-color: rgba(40, 66, 97, 0.16);
  }
  .manuscript-block.block-item:focus-visible {
    outline: 2px solid var(--editor-accent);
    outline-offset: 2px;
  }
  .manuscript-block.block-item.block-item--active {
    background: rgba(53, 99, 153, 0.09) !important;
    border-color: rgba(53, 99, 153, 0.3) !important;
    box-shadow:
      0 0 0 1px rgba(53, 99, 153, 0.12),
      inset 3px 0 0 rgba(122, 184, 232, 0.6);
  }
  .manuscript-block.block-item.block-item--dragging {
    opacity: 0.35;
  }
  .manuscript-block.block-item.block-item--drop-target {
    box-shadow: 0 -2px 0 0 var(--editor-accent), 0 0 0 1px var(--editor-accent-glow);
  }

  @media (prefers-reduced-motion: reduce) {
    .manuscript-block.block-item {
      transition: none;
    }
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
  .manuscript-doc .drag-handle {
    color: rgba(0, 0, 0, 0.35);
  }
  .manuscript-doc .drag-handle:hover {
    color: rgba(0, 0, 0, 0.75);
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
    border-bottom: 1px solid var(--editor-border);
    background: none;
    color: rgba(122,184,232,0.85);
    font-size: 11px;
    font-family: inherit;
    cursor: pointer;
  }

  .insp-back-section:hover {
    color: #7ab8e8;
  }

  /* ── Inspector tabs ── */
  .insp-tab-bar {
    display: flex;
    gap: 2px;
    padding: 8px 12px 0;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    margin-bottom: 4px;
  }

  .insp-tab {
    flex: 1;
    padding: 6px 4px;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: rgba(255,255,255,0.45);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    text-align: center;
    transition: color 0.15s, border-color 0.15s;
    margin-bottom: -1px;
  }

  .insp-tab:hover {
    color: rgba(255,255,255,0.75);
  }

  .insp-tab--active {
    color: #7ab8e8;
    border-bottom-color: #7ab8e8;
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

  /* ── Title Page inspector preview ──────────────────────────────────── */
  .insp-tp-preview {
    width: 100%;
    margin-bottom: 14px;
    border-radius: 8px;
    overflow: hidden;
    background: #fafaf8;
    border: 1px solid rgba(255,255,255,0.08);
  }
  .insp-tp-preview__page {
    padding: 14px 18px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-height: 110px;
    color: #1a1a22;
    font-family: 'Georgia', serif;
    font-size: 11px;
    line-height: 1.4;
  }
  .insp-tp-preview__series   { font-size: 9px; opacity: 0.55; letter-spacing: 0.04em; margin-bottom: 6px; }
  .insp-tp-preview__title    { font-size: 14px; font-weight: 700; line-height: 1.2; }
  .insp-tp-preview__subtitle { font-size: 11px; font-weight: 500; opacity: 0.75; }
  .insp-tp-preview__author   { font-size: 10px; opacity: 0.65; margin-top: 8px; }
  .insp-tp-preview__publisher{ font-size: 9px; opacity: 0.4; margin-top: auto; padding-top: 10px; }

  /* Badges de slot */
  .insp-slot-badge {
    display: inline-block;
    font-size: 9px;
    font-weight: 500;
    text-transform: none;
    letter-spacing: 0;
    padding: 1px 6px;
    border-radius: 4px;
    background: rgba(255,255,255,0.07);
    color: rgba(255,255,255,0.35);
    margin-left: 5px;
    vertical-align: middle;
  }
  .insp-slot-badge--accent {
    background: rgba(122,184,232,0.12);
    color: rgba(122,184,232,0.7);
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
    border-color: rgba(122,184,232,0.28) !important;
    box-shadow: inset 3px 0 0 rgba(122,184,232,0.55);
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

  /* ── Editor inline (panel central) ─────────────────────────────────────── */
  .block-inline-editor {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .inline-format-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 6px 0 8px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    margin-bottom: 6px;
  }

  .inline-ctx-chip {
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid rgba(0, 0, 0, 0.15);
    background: rgba(255, 255, 255, 0.55);
    color: #444;
    font-size: 11px;
    font-family: inherit;
    cursor: pointer;
    line-height: 1.6;
    transition: background 0.12s, color 0.12s;
  }
  .inline-ctx-chip:hover {
    background: rgba(0, 0, 0, 0.07);
  }
  .inline-ctx-chip--on {
    background: #2a2a4a;
    color: #fff;
    border-color: #2a2a4a;
  }
  .inline-ctx-chip--done {
    margin-left: auto;
    border-color: rgba(0, 0, 0, 0.2);
    color: #555;
  }
  .inline-ctx-chip--done:hover {
    background: rgba(0, 120, 0, 0.08);
    border-color: rgba(0, 120, 0, 0.35);
    color: #2a6a2a;
  }

  .inline-slash-host {
    position: relative;
  }

  .inline-slash-palette {
    position: absolute;
    bottom: calc(100% + 4px);
    left: 0;
    z-index: 200;
  }

  .block-inline-textarea {
    width: 100%;
    resize: none;
    overflow: hidden;
    border: none;
    outline: none;
    background: transparent;
    font-family: 'Georgia', 'Times New Roman', serif;
    color: #171717;
    line-height: 1.7;
    padding: 2px 0;
    min-height: 2.4em;
  }
  .block-inline-textarea::placeholder {
    color: rgba(0, 0, 0, 0.28);
    font-style: italic;
  }

  /* Typography variants matching manuscript styles */
  .block-inline-textarea--heading-1 {
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  .block-inline-textarea--heading-2 {
    font-size: 16px;
    font-weight: 600;
  }
  .block-inline-textarea--heading-3 {
    font-size: 14px;
    font-weight: 600;
    font-style: italic;
  }
  .block-inline-textarea--heading-4 {
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .block-inline-textarea--paragraph {
    font-size: 13px;
    text-align: justify;
  }
  .block-inline-textarea--quote {
    font-size: 13px;
    font-style: italic;
    padding-left: 14px;
    border-left: 3px solid rgba(0, 0, 0, 0.18);
  }
  .block-inline-textarea--centered-phrase {
    font-size: 14px;
    text-align: center;
    font-style: italic;
  }
  .block-inline-textarea--separator {
    text-align: center;
    font-size: 20px;
    letter-spacing: 0.4em;
    min-height: 1.6em;
  }

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

  .insp-context-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    padding: 6px 7px;
    border-radius: 7px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--editor-border);
  }

  .ctx-chip {
    padding: 3px 8px;
    border-radius: 5px;
    border: 1px solid var(--editor-border-strong);
    background: rgba(255, 255, 255, 0.04);
    color: var(--editor-text-muted);
    font-size: 10px;
    font-weight: 600;
    font-family: inherit;
    letter-spacing: 0.03em;
    cursor: pointer;
    transition:
      background var(--editor-duration) var(--editor-ease),
      border-color var(--editor-duration) var(--editor-ease),
      color var(--editor-duration) var(--editor-ease);
  }

  .ctx-chip:focus-visible {
    outline: 2px solid var(--editor-accent);
    outline-offset: 1px;
  }

  .ctx-chip:hover {
    color: rgba(255, 255, 255, 0.88);
    border-color: var(--editor-accent-border);
    background: rgba(122, 184, 232, 0.1);
  }

  .ctx-chip--on {
    color: #9fd4ff;
    border-color: rgba(122, 184, 232, 0.45);
    background: var(--editor-accent-soft);
  }

  .insp-slash-host {
    position: relative;
  }

  .slash-palette {
    position: absolute;
    left: 0;
    right: 0;
    bottom: calc(100% + 6px);
    z-index: 25;
    max-height: 200px;
    overflow-y: auto;
    padding: 4px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: #141428;
    box-shadow: 0 10px 26px rgba(0, 0, 0, 0.42);
  }

  .slash-palette-row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 8px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: rgba(255, 255, 255, 0.85);
    font-size: 11px;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    transition: background 0.08s;
  }

  .slash-palette-row:hover,
  .slash-palette-row--active {
    background: rgba(122, 184, 232, 0.16);
  }

  .slash-palette-ico {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    opacity: 0.72;
  }

  .slash-palette-label {
    flex: 1;
    min-width: 0;
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
    color: var(--editor-text-faint);
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

  .btn--danger-ghost {
    background: transparent;
    color: rgba(220,100,100,0.7);
    border: 1px solid rgba(220,80,80,0.2);
  }
  .btn--danger-ghost:hover:not(:disabled) {
    background: rgba(220,70,70,0.1);
    color: #e07070;
    border-color: rgba(220,80,80,0.4);
  }

  .insp-delete-block-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    margin-top: 4px;
    font-size: 12px;
  }

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
    color: var(--editor-text-faint);
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

  .modal-form--flush {
    gap: 14px;
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
