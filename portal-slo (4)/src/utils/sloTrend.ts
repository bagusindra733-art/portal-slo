export interface SloTrendRow {
  bidang: string;
  label: string;
  total: number;
  /** tahun -> jumlah SLO terbit */
  perTahun: Record<number, number>;
}

export interface SloTrend {
  /** Rentang tahun berurutan (tahun tanpa data tetap ada, bernilai 0). */
  years: number[];
  rows: SloTrendRow[];
  total: SloTrendRow;
}

const BIDANG_SHORT: Record<string, string> = {
  'Pembangkitan Tenaga Listrik': 'Pembangkit',
  'Transmisi Tenaga Listrik': 'Transmisi',
  'Distribusi Tenaga Listrik': 'Distribusi',
  'Instalasi Pemanfaatan Tenaga Listrik': 'Pemanfaatan',
};

export const bidangLabel = (b: string): string => BIDANG_SHORT[b] ?? (b || 'Lainnya');

/** Hitung SLO terbit per bidang per tahun (tahun dari Tanggal Terbit). Baris urut dari yang terbanyak. */
export function sloTrendPerTahun(records: { bidang: string; tglTerbit: string }[]): SloTrend {
  const byBidang = new Map<string, Record<number, number>>();
  const all: Record<number, number> = {};
  let minY = Infinity;
  let maxY = -Infinity;

  for (const r of records) {
    const y = Number((r.tglTerbit || '').slice(0, 4));
    if (!Number.isInteger(y) || y < 1900 || y > 2999) continue;
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    const m = byBidang.get(r.bidang) ?? {};
    m[y] = (m[y] ?? 0) + 1;
    byBidang.set(r.bidang, m);
    all[y] = (all[y] ?? 0) + 1;
  }

  const years: number[] = [];
  if (Number.isFinite(minY)) for (let y = minY; y <= maxY; y++) years.push(y);

  const sum = (m: Record<number, number>) => Object.values(m).reduce((a, b) => a + b, 0);
  const rows = [...byBidang.entries()]
    .map(([bidang, perTahun]) => ({ bidang, label: bidangLabel(bidang), total: sum(perTahun), perTahun }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));

  return { years, rows, total: { bidang: '', label: 'Semua bidang', total: sum(all), perTahun: all } };
}

export const BIDANG_PEMBANGKIT = 'Pembangkitan Tenaga Listrik';

/** Nilai per tahun untuk grafik: Pembangkit vs sisanya (Transmisi, Distribusi, Pemanfaatan, dst.). */
export function pembangkitVsLainnya(t: SloTrend): { pembangkit: number[]; lainnya: number[] } {
  const row = t.rows.find((r) => r.bidang === BIDANG_PEMBANGKIT);
  const pembangkit = t.years.map((y) => row?.perTahun[y] ?? 0);
  const lainnya = t.years.map((y, i) => (t.total.perTahun[y] ?? 0) - pembangkit[i]);
  return { pembangkit, lainnya };
}
