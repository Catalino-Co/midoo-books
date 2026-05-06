<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { getLayoutSettings } from '$lib/services/layout.service';
  import {
    BOOK_STYLE_ROLE_CATALOG,
    cloneBookStyles,
    resolveBookStyles,
    updateBookStyles,
    buildDefaultBookStyles,
    buildBookStyleCss,
    type BookStyleDefinition,
    type BookStyleMap,
    type BookStyleRole,
  } from '$lib/services/styles.service';

  let bookId = $derived($page.params.bookId);

  let loading = $state(true);
  let saving = $state(false);
  let error = $state<string | null>(null);
  let saveOk = $state(false);

  let styles = $state<BookStyleMap | null>(null);
  let defaultStyles = $state<BookStyleMap | null>(null);
  let selectedRole = $state<BookStyleRole>('PARAGRAPH');

  const textAlignOptions = [
    { value: 'left', label: 'Izquierda' },
    { value: 'center', label: 'Centrado' },
    { value: 'right', label: 'Derecha' },
    { value: 'justify', label: 'Justificado' },
  ] as const;

  const fontWeightOptions = [
    { value: 400, label: '400 · Regular' },
    { value: 500, label: '500 · Medio' },
    { value: 600, label: '600 · Semibold' },
    { value: 700, label: '700 · Bold' },
  ] as const;

  let currentStyle = $derived(styles?.[selectedRole] ?? null);
  let currentMeta = $derived(BOOK_STYLE_ROLE_CATALOG.find(entry => entry.role === selectedRole) ?? BOOK_STYLE_ROLE_CATALOG[0]);
  let selectedPreviewCss = $derived(currentStyle ? buildBookStyleCss(currentStyle) : '');

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    loading = true;
    error = null;
    try {
      const layout = await getLayoutSettings(bookId);
      defaultStyles = buildDefaultBookStyles(layout);
      styles = resolveBookStyles(layout);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  function patchSelectedStyle(patch: Partial<BookStyleDefinition>) {
    if (!styles || !currentStyle) return;
    styles = {
      ...styles,
      [selectedRole]: {
        ...styles[selectedRole],
        ...patch,
      },
    };
  }

  function resetSelectedStyle() {
    if (!styles || !defaultStyles) return;
    styles = {
      ...styles,
      [selectedRole]: cloneBookStyles(defaultStyles)[selectedRole],
    };
  }

  async function saveStyles() {
    if (!styles) return;
    saving = true;
    error = null;
    saveOk = false;
    try {
      await updateBookStyles(bookId, styles);
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
</script>

<svelte:head>
  <title>Estilos — MIDOO BOOKS</title>
</svelte:head>

<div class="styles-page">
  <header class="page-head">
    <div>
      <h1 class="page-title">Estilos del libro</h1>
      <p class="page-lead">
        Ajusta los estilos globales del libro para títulos, texto corrido, citas, TOC y apertura de capítulo.
      </p>
    </div>
    <div class="head-actions">
      <a class="preview-link" href="/books/{bookId}/preview">Abrir preview</a>
      <button type="button" class="save-btn" onclick={() => void saveStyles()} disabled={saving || loading || !styles}>
        {saving ? 'Guardando…' : 'Guardar estilos'}
      </button>
    </div>
  </header>

  {#if error}
    <div class="state-box state-box--error">{error}</div>
  {/if}

  {#if loading}
    <div class="state-box">Cargando estilos editoriales…</div>
  {:else if styles && currentStyle}
    <div class="styles-grid">
      <aside class="panel panel--list">
        <h2 class="panel-title">Estilos base</h2>
        <div class="style-list">
          {#each BOOK_STYLE_ROLE_CATALOG as entry (entry.role)}
            <button
              type="button"
              class="style-item"
              class:style-item--active={entry.role === selectedRole}
              onclick={() => { selectedRole = entry.role; }}
            >
              <span class="style-item__label">{entry.label}</span>
              <span class="style-item__desc">{entry.description}</span>
            </button>
          {/each}
        </div>
      </aside>

      <section class="panel panel--editor">
        <div class="editor-head">
          <div>
            <h2 class="panel-title">{currentMeta.label}</h2>
            <p class="panel-lead">{currentMeta.description}</p>
          </div>
          <button type="button" class="ghost-btn" onclick={resetSelectedStyle}>Restaurar este estilo</button>
        </div>

        <div class="field-row">
          <div class="field field--grow">
            <label for="font-size">Font size (pt)</label>
            <input
              id="font-size"
              class="input"
              type="number"
              min="8"
              max="72"
              step="0.1"
              value={currentStyle.fontSize}
              oninput={(e) => patchSelectedStyle({ fontSize: Number((e.currentTarget as HTMLInputElement).value) })}
            />
          </div>
          <div class="field field--grow">
            <label for="line-height">Line height</label>
            <input
              id="line-height"
              class="input"
              type="number"
              min="1"
              max="2.4"
              step="0.05"
              value={currentStyle.lineHeight}
              oninput={(e) => patchSelectedStyle({ lineHeight: Number((e.currentTarget as HTMLInputElement).value) })}
            />
          </div>
        </div>

        <div class="field-row">
          <div class="field field--grow">
            <label for="text-align">Alineación</label>
            <select
              id="text-align"
              class="input"
              value={currentStyle.textAlign}
              onchange={(e) => patchSelectedStyle({ textAlign: (e.currentTarget as HTMLSelectElement).value as typeof currentStyle.textAlign })}
            >
              {#each textAlignOptions as option}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </div>
          <div class="field field--grow">
            <label for="font-weight">Peso</label>
            <select
              id="font-weight"
              class="input"
              value={String(currentStyle.fontWeight)}
              onchange={(e) => patchSelectedStyle({ fontWeight: Number((e.currentTarget as HTMLSelectElement).value) as typeof currentStyle.fontWeight })}
            >
              {#each fontWeightOptions as option}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </div>
        </div>

        <div class="field-row">
          <div class="field field--grow">
            <label for="margin-top">Espacio antes (pt)</label>
            <input
              id="margin-top"
              class="input"
              type="number"
              min="0"
              max="72"
              step="0.5"
              value={currentStyle.marginTop}
              oninput={(e) => patchSelectedStyle({ marginTop: Number((e.currentTarget as HTMLInputElement).value) })}
            />
          </div>
          <div class="field field--grow">
            <label for="margin-bottom">Espacio después (pt)</label>
            <input
              id="margin-bottom"
              class="input"
              type="number"
              min="0"
              max="72"
              step="0.5"
              value={currentStyle.marginBottom}
              oninput={(e) => patchSelectedStyle({ marginBottom: Number((e.currentTarget as HTMLInputElement).value) })}
            />
          </div>
        </div>

        <div class="field-row">
          <div class="field field--grow">
            <label for="letter-spacing">Letter spacing (em)</label>
            <input
              id="letter-spacing"
              class="input"
              type="number"
              min="-0.1"
              max="0.4"
              step="0.01"
              value={currentStyle.letterSpacing}
              oninput={(e) => patchSelectedStyle({ letterSpacing: Number((e.currentTarget as HTMLInputElement).value) })}
            />
          </div>
          <div class="field field--grow">
            <label for="max-width">Max width (%)</label>
            <input
              id="max-width"
              class="input"
              type="number"
              min="20"
              max="100"
              step="1"
              value={currentStyle.maxWidth ?? ''}
              placeholder="Sin límite"
              oninput={(e) => {
                const raw = (e.currentTarget as HTMLInputElement).value;
                patchSelectedStyle({ maxWidth: raw === '' ? null : Number(raw) });
              }}
            />
          </div>
        </div>

        <div class="field">
          <label for="color">Color (opcional)</label>
          <input
            id="color"
            class="input"
            type="text"
            value={currentStyle.color ?? ''}
            placeholder="#1a1a22"
            oninput={(e) => {
              const raw = (e.currentTarget as HTMLInputElement).value.trim();
              patchSelectedStyle({ color: raw || null });
            }}
          />
        </div>

        <div class="sample-card">
          <span class="sample-card__eyebrow">Vista rápida</span>
          <div class="sample-card__sheet">
            <div class="sample-card__text" style={selectedPreviewCss}>
              {currentMeta.sampleText}
            </div>
          </div>
          <p class="sample-card__hint">
            Guarda y abre la vista previa para ver el efecto real sobre la paginación y la composición del libro.
          </p>
        </div>

        {#if saveOk}
          <p class="save-ok">Estilos guardados correctamente.</p>
        {/if}
      </section>
    </div>
  {/if}
</div>

<style>
  .styles-page {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 20px 24px 32px;
    min-height: 0;
  }
  .page-head {
    width: 100%;
    max-width: 1180px;
    margin: 0 auto 18px;
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-start;
  }
  .page-title {
    margin: 0 0 6px;
    font-size: 30px;
    line-height: 1.1;
    color: rgba(255,255,255,0.96);
  }
  .page-lead {
    margin: 0;
    max-width: 700px;
    font-size: 14px;
    line-height: 1.55;
    color: rgba(255,255,255,0.58);
  }
  .head-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .preview-link,
  .save-btn,
  .ghost-btn,
  .style-item {
    font-family: inherit;
  }
  .preview-link,
  .save-btn,
  .ghost-btn {
    border-radius: 10px;
    text-decoration: none;
    transition: border-color 0.14s, background 0.14s, color 0.14s;
  }
  .preview-link {
    padding: 10px 14px;
    border: 1px solid rgba(255,255,255,0.1);
    color: rgba(255,255,255,0.8);
    background: rgba(255,255,255,0.04);
  }
  .save-btn {
    padding: 10px 14px;
    border: 1px solid rgba(122,184,232,0.34);
    background: rgba(122,184,232,0.14);
    color: #d8ecff;
    cursor: pointer;
  }
  .save-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .ghost-btn {
    padding: 8px 12px;
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.04);
    color: rgba(255,255,255,0.72);
    cursor: pointer;
  }
  .state-box {
    max-width: 1180px;
    margin: 0 auto;
    width: 100%;
    padding: 14px 16px;
    border-radius: 14px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.7);
  }
  .state-box--error {
    background: rgba(220,80,80,0.12);
    border-color: rgba(220,80,80,0.35);
    color: #ffb9b9;
    margin-bottom: 14px;
  }
  .styles-grid {
    width: 100%;
    max-width: 1180px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 260px minmax(0, 1fr);
    gap: 16px;
    min-height: 0;
  }
  .panel {
    border-radius: 18px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    padding: 18px;
  }
  .panel-title {
    margin: 0 0 8px;
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(255,255,255,0.88);
  }
  .panel-lead {
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
    color: rgba(255,255,255,0.52);
  }
  .style-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 14px;
  }
  .style-item {
    width: 100%;
    text-align: left;
    border-radius: 12px;
    padding: 12px 13px;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.03);
    color: inherit;
    cursor: pointer;
  }
  .style-item--active {
    border-color: rgba(122,184,232,0.55);
    background: rgba(122,184,232,0.12);
  }
  .style-item__label {
    display: block;
    font-size: 13px;
    font-weight: 700;
    color: rgba(255,255,255,0.88);
  }
  .style-item__desc {
    display: block;
    margin-top: 4px;
    font-size: 11px;
    line-height: 1.45;
    color: rgba(255,255,255,0.42);
  }
  .editor-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 16px;
  }
  .field,
  .field-row {
    margin-bottom: 14px;
  }
  .field-row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .field label {
    display: block;
    margin-bottom: 6px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(255,255,255,0.52);
  }
  .input {
    width: 100%;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.05);
    color: rgba(255,255,255,0.92);
    padding: 10px 12px;
    font-size: 13px;
    color-scheme: dark;
  }
  .sample-card {
    margin-top: 20px;
    border-radius: 16px;
    padding: 16px;
    background: rgba(8, 10, 18, 0.72);
    border: 1px solid rgba(122,184,232,0.12);
  }
  .sample-card__eyebrow {
    display: inline-block;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(255,255,255,0.42);
    margin-bottom: 10px;
  }
  .sample-card__sheet {
    min-height: 220px;
    border-radius: 10px;
    background: #fafaf8;
    padding: 26px;
    color: #1a1a22;
    display: flex;
    align-items: flex-start;
  }
  .sample-card__text {
    width: 100%;
  }
  .sample-card__hint,
  .save-ok {
    margin: 10px 0 0;
    font-size: 12px;
    line-height: 1.45;
  }
  .sample-card__hint {
    color: rgba(255,255,255,0.44);
  }
  .save-ok {
    color: #b9f3cb;
  }
  @media (max-width: 980px) {
    .page-head,
    .editor-head,
    .styles-grid,
    .field-row,
    .head-actions {
      display: flex;
      flex-direction: column;
    }
    .styles-grid {
      gap: 14px;
    }
  }
</style>
