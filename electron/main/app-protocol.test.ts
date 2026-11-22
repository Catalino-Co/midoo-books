import { describe, expect, it, vi } from 'vitest';
import { join } from 'path';

vi.mock('electron', () => ({ app: {}, net: {}, protocol: {} }));

import { resolveAppRequest } from './app-protocol';

const ROOT = join('/opt', 'midoo', 'build');
const files = new Set([
  join(ROOT, '200.html'),
  join(ROOT, 'favicon.png'),
  join(ROOT, '_app', 'immutable', 'entry', 'start.abc.js'),
]);
const exists = (p: string) => files.has(p);
const resolve = (url: string) => resolveAppRequest(url, ROOT, '200.html', exists);

describe('resolveAppRequest (protocolo app://midoo/)', () => {
  it('sirve archivos existentes del build', () => {
    expect(resolve('app://midoo/_app/immutable/entry/start.abc.js')).toEqual({
      kind: 'file',
      path: join(ROOT, '_app', 'immutable', 'entry', 'start.abc.js'),
    });
  });

  it('ignora query y hash', () => {
    expect(resolve('app://midoo/favicon.png?v=2#x')).toEqual({ kind: 'file', path: join(ROOT, 'favicon.png') });
  });

  it('devuelve el fallback SPA para rutas de la app', () => {
    for (const url of ['app://midoo/', 'app://midoo/library', 'app://midoo/books/abc-123/content?section=1']) {
      expect(resolve(url)).toEqual({ kind: 'fallback', path: join(ROOT, '200.html') });
    }
  });

  it('responde 404 para recursos con extensión que no existen', () => {
    expect(resolve('app://midoo/_app/immutable/chunks/missing.js')).toEqual({ kind: 'error', status: 404 });
  });

  it('bloquea path traversal codificado', () => {
    expect(resolve('app://midoo/..%2F..%2Fsecret.txt')).toEqual({ kind: 'error', status: 403 });
    expect(resolve('app://midoo/_app%2F..%2F..%2F..%2Fetc%2Fpasswd')).toEqual({ kind: 'error', status: 403 });
  });

  it('nunca resuelve fuera del build (el parser de URL colapsa ../ y %2e%2e)', () => {
    for (const url of ['app://midoo/../../etc/passwd', 'app://midoo/%2e%2e/%2e%2e/etc/passwd']) {
      const r = resolve(url);
      if (r.kind !== 'error') expect(r.path.startsWith(ROOT)).toBe(true);
    }
  });

  it('rechaza otros hosts y URLs malformadas', () => {
    expect(resolve('app://otro/library')).toEqual({ kind: 'error', status: 404 });
    expect(resolve('app://midoo/%E0%A4%A')).toEqual({ kind: 'error', status: 400 });
    expect(resolve('app://midoo/a%00b')).toEqual({ kind: 'error', status: 400 });
  });
});
