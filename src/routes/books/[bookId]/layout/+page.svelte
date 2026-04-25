<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { listSections, sectionTypeLabel } from '$lib/services/content.service';
  import {
    getLayoutSettings,
    updateLayoutSettings,
    FRONTMATTER_NUMBERING_STYLE_OPTIONS,
    frontmatterNumberingStyleLabel,
    parseHiddenPageNumberSectionTypes,
    parseLayoutTocConfig,
    serializeLayoutTocConfig,
  } from '$lib/services/layout.service';
  import type { DocumentSection, SectionType, FrontmatterNumberingStyle } from '$lib/core/domain/index';
  import { DEFAULT_HIDE_PAGE_NUMBER_SECTION_TYPES } from '$lib/core/domain/index';

  let bookId = $derived($page.params.bookId);

  let loading = $state(true);
  let saving = $state(false);
  let error = $state<string | null>(null);
  let saveOk = $state(false);

  let sections = $state<DocumentSection[]>([]);

  let showPageNumbers = $state(true);
  let frontmatterStyle = $state<FrontmatterNumberingStyle>('roman-lower');
  let pageNumberStart = $state(1);
  let bodyStartsAtSectionId = $state('__auto__');
  let showFooter = $state(true);
  let showHeader = $state(false);
  let hiddenTypes = $state<SectionType[]>([...DEFAULT_HIDE_PAGE_NUMBER_SECTION_TYPES]);
  let tocShowTitle = $state(true);
  let tocTitleText = $state('Índice');
  let tocShowDotLeaders = $state(true);

  const hideTypeOptions: SectionType[] = ['COVER', 'BACK_COVER', 'RIGHTS', 'DEDICATION', 'TOC'];

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    loading = true;
    error = null;
    try {
      const [layout, bookSections] = await Promise.all([
        getLayoutSettings(bookId),
        listSections(bookId),
      ]);
      sections = [...bookSections].sort((a, b) => a.orderIndex - b.orderIndex);
      showPageNumbers = layout.showPageNumbers;
      frontmatterStyle = layout.frontmatterNumberingStyle;
      pageNumberStart = layout.pageNumberStart;
      bodyStartsAtSectionId = layout.bodyStartsAtSectionId ?? '__auto__';
      showFooter = layout.showFooter;
      showHeader = layout.showHeader;
      hiddenTypes = parseHiddenPageNumberSectionTypes(layout.hideNumberOnSectionTypes) as SectionType[];
      const tocConfig = parseLayoutTocConfig(layout.tocConfigJson);
      tocShowTitle = tocConfig.showTitle;
      tocTitleText = tocConfig.titleText;
      tocShowDotLeaders = tocConfig.showDotLeaders;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  function toggleHiddenType(type: SectionType, checked: boolean) {
    hiddenTypes = checked
      ? [...new Set([...hiddenTypes, type])]
      : hiddenTypes.filter(value => value !== type);
  }

  async function saveSettings() {
    saving = true;
    error = null;
    saveOk = false;
    try {
      await updateLayoutSettings(bookId, {
        showPageNumbers,
        frontmatterNumberingStyle: frontmatterStyle,
        pageNumberStart: Math.max(1, Math.floor(pageNumberStart || 1)),
        bodyNumberingStyle: 'arabic',
        bodyStartsAtSectionId: bodyStartsAtSectionId === '__auto__' ? null : bodyStartsAtSectionId,
        hideNumberOnSectionTypes: JSON.stringify(hiddenTypes),
        showFooter,
        showHeader,
        tocConfigJson: serializeLayoutTocConfig({
          showTitle: tocShowTitle,
          titleText: tocTitleText.trim() || 'Índice',
          showDotLeaders: tocShowDotLeaders,
        }),
      });
      saveOk = true;
      setTimeout(() => {
        saveOk = false;
      }, 2200);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      saving = false;
    }
  }

  let chapterCandidates = $derived(
    sections.filter(section => section.sectionType === 'CHAPTER' || section.sectionType === 'PROLOGUE' || section.sectionType === 'AUTHOR_NOTE')
  );
</script>

<svelte:head>
  <title>Maqueta — MIDOO BOOKS</title>
</svelte:head>

<div class="layout-page">
  <header class="page-head">
    <div>
      <h1 class="page-title">Numeración editorial</h1>
      <p class="page-lead">
        Configura preliminares, comienzo del cuerpo y pie/cabecera básicos para la vista previa paginada.
      </p>
    </div>
    <a class="preview-link" href="/books/{bookId}/preview">Abrir preview</a>
  </header>

  {#if loading}
    <div class="state-box">Cargando ajustes editoriales…</div>
  {:else}
    <div class="layout-grid">
      <section class="panel">
        <h2 class="panel-title">Numeración</h2>

        <label class="toggle-row">
          <span>
            <strong>Mostrar numeración editorial</strong>
            <small>Activa el cálculo y el render del folio visible.</small>
          </span>
          <input type="checkbox" bind:checked={showPageNumbers} />
        </label>

        <div class="field">
          <label for="frontmatter-style">Preliminares</label>
          <select id="frontmatter-style" class="input" bind:value={frontmatterStyle}>
            {#each FRONTMATTER_NUMBERING_STYLE_OPTIONS as option}
              <option value={option}>{frontmatterNumberingStyleLabel(option)}</option>
            {/each}
          </select>
        </div>

        <div class="field">
          <label for="page-number-start">Número inicial del cuerpo</label>
          <input
            id="page-number-start"
            class="input"
            type="number"
            min="1"
            step="1"
            bind:value={pageNumberStart}
          />
        </div>

        <div class="field">
          <label for="body-start">Inicio del cuerpo principal</label>
          <select id="body-start" class="input" bind:value={bodyStartsAtSectionId}>
            <option value="__auto__">Detectar primer capítulo automáticamente</option>
            {#each chapterCandidates as section (section.id)}
              <option value={section.id}>
                {section.title || sectionTypeLabel(section.sectionType)}
              </option>
            {/each}
          </select>
          <p class="field-help">
            Desde esta sección empieza la numeración arábiga del cuerpo.
          </p>
        </div>
      </section>

      <section class="panel">
        <h2 class="panel-title">Cabecera y pie</h2>

        <label class="toggle-row">
          <span>
            <strong>Mostrar pie de página</strong>
            <small>Usa el número editorial visible cuando aplique.</small>
          </span>
          <input type="checkbox" bind:checked={showFooter} />
        </label>

        <label class="toggle-row">
          <span>
            <strong>Mostrar cabecera</strong>
            <small>Versión básica: título de sección o del libro.</small>
          </span>
          <input type="checkbox" bind:checked={showHeader} />
        </label>
      </section>

      <section class="panel">
        <h2 class="panel-title">Índice automático</h2>

        <label class="toggle-row">
          <span>
            <strong>Mostrar título del índice</strong>
            <small>Se usa cuando una sección `TOC` o un marcador `[[TOC]]` renderizan el índice.</small>
          </span>
          <input type="checkbox" bind:checked={tocShowTitle} />
        </label>

        <div class="field">
          <label for="toc-title">Título visible</label>
          <input
            id="toc-title"
            class="input"
            type="text"
            maxlength="80"
            bind:value={tocTitleText}
          />
        </div>

        <label class="toggle-row">
          <span>
            <strong>Mostrar puntos guía</strong>
            <small>Render ligero en preview entre el título y el número de página.</small>
          </span>
          <input type="checkbox" bind:checked={tocShowDotLeaders} />
        </label>
      </section>

      <section class="panel panel--wide">
        <h2 class="panel-title">Ocultar número en tipos especiales</h2>
        <p class="panel-lead">
          Estas páginas siguen participando del flujo editorial, pero el número puede quedar oculto.
        </p>
        <div class="type-grid">
          {#each hideTypeOptions as type}
            <label class="type-chip">
              <input
                type="checkbox"
                checked={hiddenTypes.includes(type)}
                onchange={(event) => toggleHiddenType(type, (event.currentTarget as HTMLInputElement).checked)}
              />
              <span>{sectionTypeLabel(type)}</span>
            </label>
          {/each}
        </div>
      </section>
    </div>

    {#if error}
      <div class="alert alert--error">{error}</div>
    {/if}

    <div class="actions">
      {#if saveOk}
        <span class="save-ok">Guardado.</span>
      {/if}
      <button class="btn btn--ghost" type="button" onclick={() => void loadData()} disabled={saving}>
        Recargar
      </button>
      <button class="btn btn--primary" type="button" onclick={() => void saveSettings()} disabled={saving}>
        {saving ? 'Guardando…' : 'Guardar ajustes'}
      </button>
    </div>
  {/if}
</div>

<style>
  .layout-page {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 24px 28px 36px;
    overflow-y: auto;
  }

  .page-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 18px;
  }

  .page-title {
    margin: 0 0 6px;
    font-size: 22px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.9);
  }

  .page-lead {
    margin: 0;
    max-width: 52rem;
    font-size: 13px;
    line-height: 1.55;
    color: rgba(255, 255, 255, 0.48);
  }

  .preview-link {
    color: #7ab8e8;
    text-decoration: none;
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
  }

  .state-box,
  .alert {
    max-width: 720px;
    padding: 14px 16px;
    border-radius: 10px;
    font-size: 13px;
  }

  .state-box {
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.44);
  }

  .alert--error {
    background: rgba(220, 80, 80, 0.12);
    border: 1px solid rgba(220, 80, 80, 0.35);
    color: #ffb0b0;
  }

  .layout-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(260px, 1fr));
    gap: 16px;
    align-items: start;
  }

  .panel {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .panel--wide {
    grid-column: 1 / -1;
  }

  .panel-title {
    margin: 0;
    font-size: 14px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.86);
  }

  .panel-lead {
    margin: -4px 0 0;
    font-size: 12px;
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.42);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.42);
  }

  .field-help {
    margin: 0;
    font-size: 11px;
    line-height: 1.45;
    color: rgba(255, 255, 255, 0.34);
  }

  .input {
    width: 100%;
    padding: 9px 11px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.05);
    color: #e8e8f4;
    font-size: 13px;
    font-family: inherit;
  }

  .toggle-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 14px;
    padding: 12px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .toggle-row:last-of-type {
    border-bottom: none;
  }

  .toggle-row strong {
    display: block;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.82);
  }

  .toggle-row small {
    display: block;
    margin-top: 4px;
    font-size: 11px;
    line-height: 1.45;
    color: rgba(255, 255, 255, 0.38);
  }

  .toggle-row input,
  .type-chip input {
    accent-color: #7ab8e8;
  }

  .type-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .type-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 9px 12px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.72);
    font-size: 12px;
  }

  .actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
  }

  .save-ok {
    margin-right: auto;
    font-size: 12px;
    color: #87d7a4;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 9px 16px;
    border-radius: 8px;
    border: 1px solid transparent;
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
  }

  .btn--ghost {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.72);
  }

  .btn--primary {
    background: #7ab8e8;
    color: #10131a;
  }

  .btn:disabled {
    opacity: 0.55;
    cursor: default;
  }
</style>
