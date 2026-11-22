/** Tipos mínimos del paquete `hyphen` (ISC), que no publica declaraciones. */
declare module 'hyphen/es' {
  interface HyphenateOptions {
    /** Carácter insertado (por defecto U+00AD, guion blando). */
    hyphenChar?: string;
    /** Longitud mínima de palabra a partir (por defecto 5). */
    minWordLength?: number;
    /** No partir dentro de etiquetas HTML. */
    html?: boolean;
    debug?: boolean;
  }
  const hyphenator: {
    hyphenateSync(text: string, options?: HyphenateOptions): string;
    hyphenate(text: string, options?: HyphenateOptions): Promise<string>;
  };
  export default hyphenator;
}
