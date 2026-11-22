import { describe, expect, it } from 'vitest';
import { fontMetadataFromFilename, isFontExtension, readFontMetadata } from './font-metadata';

describe('fontMetadataFromFilename', () => {
  it.each([
    ['Quattrocento-Regular.ttf',        'Quattrocento',        400, 'normal'],
    ['Quattrocento-Bold.ttf',           'Quattrocento',        700, 'normal'],
    ['EBGaramond-SemiBoldItalic.otf',   'EB Garamond',         600, 'italic'],
    ['GlacialIndifference-Regular.otf', 'Glacial Indifference', 400, 'normal'],
    ['CourierPrime_Italic.woff2',       'Courier Prime',       400, 'italic'],
    ['Belleza.woff',                    'Belleza',             400, 'normal'],
  ])('%s → %s %i %s', (file, family, weight, style) => {
    expect(fontMetadataFromFilename(file)).toEqual({ family, weight, style });
  });
});

describe('readFontMetadata', () => {
  it('usa el nombre de archivo si el contenido no es TTF/OTF', () => {
    const woff2 = Buffer.from('wOF2-no-es-sfnt');
    expect(readFontMetadata(woff2, 'Lora-BoldItalic.woff2')).toEqual({ family: 'Lora', weight: 700, style: 'italic' });
  });
});

describe('isFontExtension', () => {
  it('reconoce ttf/otf/woff/woff2 sin importar mayúsculas', () => {
    expect(['.TTF', '.otf', '.woff', '.Woff2'].every(isFontExtension)).toBe(true);
    expect(isFontExtension('.png')).toBe(false);
  });
});
