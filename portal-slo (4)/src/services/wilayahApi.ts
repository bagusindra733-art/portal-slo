import { PROVINSI_LIST, getKabKota } from '../data/wilayah';

/**
 * API Wilayah Indonesia (https://github.com/emsifa/api-wilayah-indonesia).
 * Nama dari API sudah huruf besar, mis. "JAWA TIMUR", "KABUPATEN SIDOARJO", "KOTA SURABAYA".
 * Bila API tidak bisa dijangkau, dipakai daftar bawaan di src/data/wilayah.ts.
 * Domain API harus ada di connect-src pada Content-Security-Policy (vercel.json).
 */
const BASE = 'https://emsifa.github.io/api-wilayah-indonesia/api';
const TIMEOUT_MS = 8000;

export interface Wilayah {
  id: string;
  name: string;
}

/** Urut abjad (A–Z) menurut nama. */
const byNama = (a: Wilayah, b: Wilayah) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' });

const provCache: { list: Wilayah[] | null } = { list: null };
const regCache = new Map<string, Wilayah[]>();

async function fetchJson(path: string): Promise<Wilayah[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/${path}`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: unknown = await res.json();
    if (!Array.isArray(data)) throw new Error('Format tidak dikenal');
    return data
      .filter((x): x is { id: string | number; name: string } => !!x && typeof x.name === 'string' && x.id != null)
      .map((x) => ({ id: String(x.id), name: x.name.trim().toUpperCase() }))
      .sort(byNama);
  } finally {
    clearTimeout(timer);
  }
}

/** Daftar provinsi. `fromApi=false` berarti memakai daftar bawaan (offline). */
export async function loadProvinsi(): Promise<{ list: Wilayah[]; fromApi: boolean }> {
  if (provCache.list) return { list: provCache.list, fromApi: true };
  try {
    const list = await fetchJson('provinces.json');
    if (list.length === 0) throw new Error('Kosong');
    provCache.list = list;
    return { list, fromApi: true };
  } catch {
    return { list: PROVINSI_LIST.map((name) => ({ id: name, name })).sort(byNama), fromApi: false };
  }
}

/** Daftar kabupaten/kota satu provinsi. Mengembalikan daftar bawaan bila API gagal. */
export async function loadKabKota(prov: Wilayah, fromApi: boolean): Promise<Wilayah[]> {
  const local = () => getKabKota(prov.name).map((name) => ({ id: name, name })).sort(byNama);
  if (!fromApi) return local();
  const cached = regCache.get(prov.id);
  if (cached) return cached;
  try {
    const list = await fetchJson(`regencies/${encodeURIComponent(prov.id)}.json`);
    if (list.length === 0) throw new Error('Kosong');
    regCache.set(prov.id, list);
    return list;
  } catch {
    return local();
  }
}
