<script lang="ts">
  /**
   * SectionTypeSelect — Selector personalizado de tipo de sección.
   *
   * Reemplaza el <select> nativo para tener control visual completo:
   *   - Cabeceras de grupo con fondo oscuro + negrita
   *   - Opciones con el mismo fondo que las cabeceras
   *   - Estado seleccionado resaltado en azul
   *   - Cierra al hacer clic fuera o pulsar Escape
   */

  import { onMount } from 'svelte';
  import {
    SECTION_TYPES_BY_GROUP,
    SECTION_GROUP_LABELS,
    sectionTypeLabel,
    type SectionTypeGroup,
  } from '$lib/core/editorial/section-type-catalog';
  import type { SectionType } from '$lib/core/domain/index';

  // ── Props ─────────────────────────────────────────────────────────────────
  interface Props {
    value:    SectionType;
    disabled?: boolean;
    onchange?: (value: SectionType) => void;
  }

  let { value, disabled = false, onchange }: Props = $props();

  // ── Estado ────────────────────────────────────────────────────────────────
  let open      = $state(false);
  let container = $state<HTMLDivElement | null>(null);

  let displayLabel = $derived(sectionTypeLabel(value));

  // ── Interacción ───────────────────────────────────────────────────────────
  function toggle() {
    if (!disabled) open = !open;
  }

  function select(type: SectionType) {
    open = false;
    if (type !== value) onchange?.(type);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') open = false;
  }

  // Cierra al hacer clic fuera del componente
  function handleOutsideClick(e: MouseEvent) {
    if (container && !container.contains(e.target as Node)) {
      open = false;
    }
  }

  onMount(() => {
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="sts-root"
  class:sts-root--open={open}
  class:sts-root--disabled={disabled}
  bind:this={container}
  onkeydown={handleKeydown}
>
  <!-- Trigger -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="sts-trigger"
    role="combobox"
    aria-expanded={open}
    aria-haspopup="listbox"
    aria-controls="sts-panel"
    tabindex={disabled ? -1 : 0}
    onclick={toggle}
    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
  >
    <span class="sts-trigger-label">{displayLabel}</span>
    <svg
      class="sts-chevron"
      class:sts-chevron--open={open}
      width="12" height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  </div>

  <!-- Dropdown panel -->
  {#if open}
    <div class="sts-panel" id="sts-panel" role="listbox">
      {#each Object.entries(SECTION_TYPES_BY_GROUP) as [group, metas]}
        <!-- Cabecera de grupo -->
        <div class="sts-group-header">
          {SECTION_GROUP_LABELS[group as SectionTypeGroup]}
        </div>
        <!-- Opciones del grupo -->
        {#each metas as meta}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div
            class="sts-option"
            class:sts-option--selected={meta.type === value}
            role="option"
            aria-selected={meta.type === value}
            tabindex={0}
            onclick={() => select(meta.type)}
            onkeydown={(e) => { if (e.key === 'Enter') select(meta.type); }}
          >
            {#if meta.type === value}
              <svg class="sts-check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            {:else}
              <span class="sts-check-placeholder"></span>
            {/if}
            {meta.label}
          </div>
        {/each}
      {/each}
    </div>
  {/if}
</div>

<style>
  /* ── Contenedor ─────────────────────────────────────────────────────────── */
  .sts-root {
    position: relative;
    width: 100%;
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 12px;
  }

  /* ── Trigger ────────────────────────────────────────────────────────────── */
  .sts-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 7px 10px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 6px;
    color: #e8e8f4;
    cursor: pointer;
    user-select: none;
    transition: border-color 0.12s, background 0.12s;
    outline: none;
  }

  .sts-trigger:hover:not(.sts-root--disabled .sts-trigger) {
    background: rgba(255,255,255,0.06);
    border-color: rgba(255,255,255,0.14);
  }

  .sts-root--open .sts-trigger {
    border-color: rgba(122,184,232,0.5);
    background: rgba(255,255,255,0.06);
  }

  .sts-root--disabled .sts-trigger {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .sts-trigger-label {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sts-chevron {
    flex-shrink: 0;
    color: rgba(255,255,255,0.4);
    transition: transform 0.15s;
  }

  .sts-chevron--open {
    transform: rotate(180deg);
  }

  /* ── Panel ──────────────────────────────────────────────────────────────── */
  .sts-panel {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    z-index: 200;
    background: #1a1a2e;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px;
    box-shadow: 0 12px 36px rgba(0,0,0,0.55);
    overflow-y: auto;
    max-height: 320px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.1) transparent;
    padding: 4px 0;
  }

  /* ── Cabecera de grupo ──────────────────────────────────────────────────── */
  .sts-group-header {
    padding: 7px 12px 5px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(122,184,232,0.55);
    background: #1a1a2e;     /* mismo fondo que las opciones */
    border-top: 1px solid rgba(255,255,255,0.05);
    user-select: none;
    /* El primer grupo no necesita borde superior */
  }

  .sts-group-header:first-child {
    border-top: none;
    padding-top: 5px;
  }

  /* ── Opción ─────────────────────────────────────────────────────────────── */
  .sts-option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 12px;
    color: rgba(255,255,255,0.72);
    cursor: pointer;
    outline: none;
    transition: background 0.08s, color 0.08s;
    background: #1a1a2e;     /* mismo fondo que las cabeceras */
  }

  .sts-option:hover {
    background: rgba(122,184,232,0.1);
    color: #e8e8f4;
  }

  .sts-option--selected {
    color: #7ab8e8;
    background: rgba(122,184,232,0.08);
  }

  /* Ícono de check / placeholder para alinear texto */
  .sts-check {
    color: #7ab8e8;
    flex-shrink: 0;
  }

  .sts-check-placeholder {
    display: inline-block;
    width: 12px;
    flex-shrink: 0;
  }
</style>
