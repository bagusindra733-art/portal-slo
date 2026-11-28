/* eslint-disable @typescript-eslint/no-explicit-any */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

const RELOAD_KEY = 'slo_chunk_reload';

type Comp<M, K extends keyof M> = Extract<M[K], ComponentType<any>>;

/**
 * React.lazy untuk komponen dengan named export (tipe props tetap terjaga).
 * Bila file halaman gagal dimuat (misalnya setelah deploy baru nama file berubah),
 * halaman dimuat ulang satu kali agar mendapat versi terbaru.
 */
export function lazyRetry<M extends Record<string, any>, K extends keyof M>(
  loader: () => Promise<M>,
  exportName: K
): LazyExoticComponent<Comp<M, K>> {
  return lazy<Comp<M, K>>(async () => {
    try {
      const mod = await loader();
      try {
        sessionStorage.removeItem(RELOAD_KEY);
      } catch {
        /* abaikan */
      }
      return { default: mod[exportName] as Comp<M, K> };
    } catch (err) {
      let alreadyReloaded = true;
      try {
        alreadyReloaded = sessionStorage.getItem(RELOAD_KEY) === '1';
        if (!alreadyReloaded) sessionStorage.setItem(RELOAD_KEY, '1');
      } catch {
        /* abaikan */
      }
      if (!alreadyReloaded) window.location.reload();
      throw err;
    }
  });
}
