/**
 * separator-content.ts — bloque SEPARATOR con ornamento (content_json).
 *
 * Ornamentos propios de MIDOO (trazados originales en SVG, color = currentColor):
 * se usan bajo títulos de capítulo, entre escenas o al final de una sección.
 * El alto de cada estilo es fijo y lo comparten el motor (paginación) y el render.
 */

export const SEPARATOR_ORNAMENTS = ['line', 'diamond', 'flourish', 'laurel', 'asterism', 'dots', 'space'] as const;
export type SeparatorOrnament = (typeof SEPARATOR_ORNAMENTS)[number];

export interface SeparatorBlockContent {
  ornament: SeparatorOrnament;
}

export const DEFAULT_SEPARATOR_CONTENT: SeparatorBlockContent = { ornament: 'line' };

export function parseSeparatorContent(contentJson: string | null | undefined): SeparatorBlockContent {
  if (!contentJson?.trim()) return { ...DEFAULT_SEPARATOR_CONTENT };
  try {
    const o = JSON.parse(contentJson) as Record<string, unknown>;
    const ornament = typeof o?.ornament === 'string'
      && (SEPARATOR_ORNAMENTS as readonly string[]).includes(o.ornament)
      ? o.ornament as SeparatorOrnament
      : DEFAULT_SEPARATOR_CONTENT.ornament;
    return { ornament };
  } catch {
    return { ...DEFAULT_SEPARATOR_CONTENT };
  }
}

export function serializeSeparatorContent(c: SeparatorBlockContent): string | null {
  return c.ornament === DEFAULT_SEPARATOR_CONTENT.ornament ? null : JSON.stringify({ ornament: c.ornament });
}

export function separatorOrnamentLabel(o: SeparatorOrnament): string {
  switch (o) {
    case 'line':     return 'Línea fina';
    case 'diamond':  return 'Línea con rombo';
    case 'flourish': return 'Floritura';
    case 'laurel':   return 'Rama de laurel';
    case 'asterism': return 'Asterismo (⁂)';
    case 'dots':     return 'Tres puntos';
    case 'space':    return 'Espacio en blanco';
  }
}

/** Alto total del bloque en px CSS (96 dpi). Lo usa el motor y el render. */
export function separatorHeightPx(o: SeparatorOrnament): number {
  switch (o) {
    case 'line':  return 24;
    case 'space': return 24;
    case 'dots':  return 26;
    default:      return 34;
  }
}

/** Carácter equivalente para formatos de texto (EPUB/Markdown). null = usar <hr/>. */
export function separatorTextGlyph(o: SeparatorOrnament): string | null {
  switch (o) {
    case 'diamond':  return '—  ◆  —';
    case 'flourish': return '❦';
    case 'laurel':   return '❧';
    case 'asterism': return '⁂';
    case 'dots':     return '·  ·  ·';
    case 'space':    return '';
    default:         return null;
  }
}

/**
 * SVG del ornamento. viewBox 120×16; se escala por alto en el render.
 * Trazados dibujados para MIDOO (no proceden de ninguna fuente tipográfica).
 */
export function separatorOrnamentSvg(o: SeparatorOrnament): string {
  const open = '<svg viewBox="0 0 120 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">';
  switch (o) {
    case 'line':
      return `${open}<path d="M30 8 H90" stroke-width="0.7"/></svg>`;
    case 'diamond':
      return `${open}<path d="M14 8 H50 M70 8 H106" stroke-width="0.7"/>`
        + '<path d="M60 3.5 L64.5 8 L60 12.5 L55.5 8 Z" fill="currentColor" stroke="none"/>'
        + '<circle cx="52" cy="8" r="0.9" fill="currentColor" stroke="none"/>'
        + '<circle cx="68" cy="8" r="0.9" fill="currentColor" stroke="none"/></svg>';
    case 'flourish': {
      // Mitad izquierda; la derecha es su reflejo.
      const half = '<path d="M57 8 C51 8 47.5 3.2 42 3.2 C36.5 3.2 34 7.6 37 10.2 C39.4 12.2 42.6 10.4 41.4 8.2" stroke-width="0.9"/>'
        + '<path d="M42 3.2 C33 3.2 27 8 18 8 C14 8 11.5 6.6 10 5.4" stroke-width="0.7"/>';
      return `${open}${half}<g transform="translate(120 0) scale(-1 1)">${half}</g>`
        + '<path d="M60 4.6 L63.2 8 L60 11.4 L56.8 8 Z" fill="currentColor" stroke="none"/></svg>';
    }
    case 'laurel':
      return `${open}${laurelPaths()}</svg>`;
    case 'asterism': {
      const star = (cx: number, cy: number) => {
        const r = 2.6;
        const d = [0, 60, 120].map(a => {
          const rad = (a * Math.PI) / 180;
          const dx = (Math.cos(rad) * r).toFixed(2);
          const dy = (Math.sin(rad) * r).toFixed(2);
          return `M${(cx - +dx).toFixed(2)} ${(cy - +dy).toFixed(2)} L${(cx + +dx).toFixed(2)} ${(cy + +dy).toFixed(2)}`;
        }).join(' ');
        return `<path d="${d}" stroke-width="0.9"/>`;
      };
      return `${open}${star(60, 4.2)}${star(54.5, 11.6)}${star(65.5, 11.6)}</svg>`;
    }
    case 'dots':
      return `${open}<circle cx="50" cy="8" r="1.3" fill="currentColor" stroke="none"/>`
        + '<circle cx="60" cy="8" r="1.3" fill="currentColor" stroke="none"/>'
        + '<circle cx="70" cy="8" r="1.3" fill="currentColor" stroke="none"/></svg>';
    case 'space':
      return '';
  }
}

/**
 * Rama de laurel horizontal: tallo fino con hojas alternas arriba y abajo, simétrica
 * respecto al centro y con un pequeño brote central. Trazado original de MIDOO.
 */
function laurelPaths(): string {
  const leaf = (x: number, up: boolean, dir: 1 | -1, size: number): string => {
    // Hoja en forma de almendra que nace del tallo (y=8) y se inclina hacia fuera.
    const y0 = 8;
    const tipX = x + dir * size * 0.9;
    const tipY = up ? y0 - size * 0.95 : y0 + size * 0.95;
    const c1x = x + dir * size * 0.05;
    const c1y = up ? y0 - size * 0.75 : y0 + size * 0.75;
    const c2x = x + dir * size * 0.85;
    const c2y = up ? y0 - size * 0.2 : y0 + size * 0.2;
    const f = (n: number) => n.toFixed(2);
    return `<path d="M${f(x)} ${y0} C${f(c1x)} ${f(c1y)} ${f(tipX)} ${f(tipY)} ${f(tipX)} ${f(tipY)} `
      + `C${f(tipX)} ${f(tipY)} ${f(c2x)} ${f(c2y)} ${f(x)} ${y0} Z" stroke-width="0.6"/>`;
  };
  const half = (dir: 1 | -1): string => {
    const parts: string[] = [];
    // Tallo
    parts.push(`<path d="M${60 + dir * 4} 8 Q${60 + dir * 30} ${8.6} ${60 + dir * 52} 7.4" stroke-width="0.7"/>`);
    // Hojas: alternas, más pequeñas hacia la punta
    const xs = [9, 17, 25, 33, 41, 48];
    xs.forEach((d, i) => {
      const size = 6.2 - i * 0.55;
      parts.push(leaf(60 + dir * d, true, dir, size));
      parts.push(leaf(60 + dir * (d + 3.5), false, dir, size * 0.95));
    });
    return parts.join('');
  };
  const bud = '<circle cx="60" cy="8" r="1.5" fill="currentColor" stroke="none"/>'
    + '<path d="M56.2 8 Q58 5.6 60 6.3 M63.8 8 Q62 10.4 60 9.7" stroke-width="0.6"/>';
  return half(-1) + half(1) + bud;
}
