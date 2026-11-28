import { useEffect, useMemo, useState } from 'react';
import { getSloTerbit, type SloRecord } from '../services/sloTerbitApi';
import { Search, RefreshCw, FileSpreadsheet, X, ChevronLeft, ChevronRight, MapPin, BadgeCheck } from 'lucide-react';

export type { SloRecord };

type Masa = 'aktif' | 'segera' | 'habis';
const MASA_LABEL: Record<Masa, string> = { aktif: 'Berlaku', segera: 'Segera habis (≤ 60 hr)', habis: 'Kedaluwarsa' };
const MASA_STYLE: Record<Masa, string> = {
  aktif: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  segera: 'bg-amber-50 text-amber-700 border-amber-200',
  habis: 'bg-red-50 text-red-700 border-red-200',
};
const SUMBER = 'Non-LISDES';
const LIT = 'SABDA DUTA PARAMITHA';
const COLS = [
  'No', '', 'Tgl. Permohonan Sertifikasi', 'Tgl. Permohonan Registrasi', 'No. Agenda', 'Nama Pemilik',
  'Nama Instalasi', 'Jenis Instalasi', 'Kapasitas/Daya', 'Sumber Permohonan', 'LIT', 'Verifikator', 'NIDI',
  'Bidang', 'Sub Bidang', 'Tipe Layanan', 'Lokasi Instalasi', 'Provinsi', 'Kota / Kabupaten', 'Tanggal Terbit',
  'Tanggal Habis Masa Berlaku', 'Posisi', 'No. SLO', 'No. Register SLO',
];
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const todayIso = () => new Date().toISOString().slice(0, 10);
const daysBetween = (fromIso: string, toIso: string) =>
  Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000);

function masaOf(tglHabis: string, today: string): Masa {
  const d = daysBetween(today, tglHabis);
  return d < 0 ? 'habis' : d <= 60 ? 'segera' : 'aktif';
}

const fmtDate = (iso: string) => {
  if (!iso) return '-';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

/** 2026-10-17 → 17 Oktober 2026 */
const fmtDateLong = (iso: string) => {
  const [y, m, d] = (iso || '').slice(0, 10).split('-');
  return y && m && d ? `${Number(d)} ${BULAN[Number(m) - 1]} ${y}` : '-';
};

const norm = (s: string) => s.toLowerCase();

const selectCls =
  'h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 cursor-pointer min-w-0';

function csvEscape(v: unknown) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function SloTerbit() {
  const [data, setData] = useState<SloRecord[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [q, setQ] = useState('');
  const [bidang, setBidang] = useState('');
  const [provinsi, setProvinsi] = useState('');
  const [tipe, setTipe] = useState('');
  const [masa, setMasa] = useState<'' | Masa>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filterOpen, setFilterOpen] = useState(true);
  const [detail, setDetail] = useState<SloRecord | null>(null);

  useEffect(() => {
    let alive = true;
    getSloTerbit()
      .then((rows) => alive && setData(rows))
      .catch(() => alive && setLoadError(true));
    return () => {
      alive = false;
    };
  }, []);

  const today = todayIso();
  const opts = useMemo(() => {
    const uniq = (f: (r: SloRecord) => string) => [...new Set((data ?? []).map(f).filter(Boolean))].sort();
    return { bidang: uniq((r) => r.bidang), provinsi: uniq((r) => r.provinsi), tipe: uniq((r) => r.tipe) };
  }, [data]);

  const filtered = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    return (data ?? []).filter((r) => {
      if (bidang && r.bidang !== bidang) return false;
      if (provinsi && r.provinsi !== provinsi) return false;
      if (tipe && r.tipe !== tipe) return false;
      if (masa && masaOf(r.tglHabis, today) !== masa) return false;
      if (!words.length) return true;
      const hay = norm(
        [r.pemilik, r.instalasi, r.noSlo, r.noRegister, r.noAgenda, r.nidi, r.kota, r.provinsi, r.jenis, r.lokasi].join(' ')
      );
      return words.every((w) => hay.includes(w));
    });
  }, [data, q, bidang, provinsi, tipe, masa, today]);

  const stats = useMemo(() => {
    const all = data ?? [];
    let aktif = 0;
    let segera = 0;
    let habis = 0;
    for (const r of all) {
      const m = masaOf(r.tglHabis, today);
      if (m === 'aktif') aktif++;
      else if (m === 'segera') segera++;
      else habis++;
    }
    return { total: all.length, aktif, segera, habis };
  }, [data, today]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const rows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const hasFilter = Boolean(q || bidang || provinsi || tipe || masa);

  const resetFilters = () => {
    setQ('');
    setBidang('');
    setProvinsi('');
    setTipe('');
    setMasa('');
    setPage(1);
  };

  const exportCsv = () => {
    const head = [
      'No. SLO', 'No. Register SLO', 'Tgl. Terbit', 'Masa Berlaku Sampai', 'Nama Pemilik', 'Nama Instalasi',
      'Jenis Instalasi', 'Kapasitas/Daya', 'Bidang', 'Sub Bidang', 'Tipe Layanan', 'Lokasi Instalasi',
      'Kota/Kabupaten', 'Provinsi', 'NIDI', 'No. Agenda',
    ];
    const lines = [head.map(csvEscape).join(';')];
    for (const r of filtered) {
      lines.push(
        [
          r.noSlo, r.noRegister, r.tglTerbit, r.tglHabis, r.pemilik, r.instalasi, r.jenis, r.kapasitas, r.bidang,
          r.subBidang, r.tipe, r.lokasi, r.kota, r.provinsi, r.nidi, r.noAgenda,
        ]
          .map(csvEscape)
          .join(';')
      );
    }
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `slo-terbit-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loadError) {
    return (
      <div className="rounded-2xl bg-white border border-red-200 p-6 text-sm text-red-700">
        Data SLO Terbit gagal dimuat. Muat ulang halaman, atau periksa file <code>src/data/sloTerbit.json</code>.
      </div>
    );
  }
  if (!data) {
    return <div className="rounded-2xl bg-white border border-slate-200/80 p-8 text-center text-sm text-slate-500">Memuat data SLO Terbit…</div>;
  }

  const statCards: { label: string; value: number; cls: string; filter: '' | Masa }[] = [
    { label: 'SLO Terbit', value: stats.total, cls: 'from-[#1D4ED8] to-[#2563EB] shadow-blue-600/20', filter: '' },
    { label: 'Masih Berlaku', value: stats.aktif, cls: 'from-[#15803D] to-[#22C55E] shadow-emerald-600/20', filter: 'aktif' },
    { label: 'Segera Habis (≤ 60 hr)', value: stats.segera, cls: 'from-[#EA580C] to-[#F97316] shadow-orange-600/20', filter: 'segera' },
    { label: 'Kedaluwarsa', value: stats.habis, cls: 'from-[#B91C1C] to-[#EF4444] shadow-red-600/20', filter: 'habis' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        {statCards.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => {
              setMasa(c.filter);
              setPage(1);
            }}
            className={`text-left rounded-2xl p-4 bg-gradient-to-br ${c.cls} text-white shadow-md hover:brightness-105 transition cursor-pointer ${
              masa === c.filter ? 'ring-2 ring-offset-2 ring-slate-900/70' : ''
            }`}
          >
            <div className="font-display text-2xl font-extrabold tabular-nums leading-tight">{c.value}</div>
            <div className="text-xs font-semibold text-white/85 mt-0.5">{c.label}</div>
          </button>
        ))}
      </div>

      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs p-4 md:p-5 space-y-4">
        <div>
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 font-display text-sm font-bold text-[#4F46E5] cursor-pointer"
          >
            <ChevronRight className={`w-4 h-4 transition-transform ${filterOpen ? 'rotate-90' : ''}`} />
            Pencarian Data
          </button>
          {filterOpen && (
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Cari pemilik, instalasi, No. SLO, register, kota…"
                  className="w-full h-10 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                />
              </div>
              <select value={bidang} onChange={(e) => { setBidang(e.target.value); setPage(1); }} className={selectCls} aria-label="Bidang">
                <option value="">Semua bidang</option>
                {opts.bidang.map((o) => <option key={o}>{o}</option>)}
              </select>
              <select value={provinsi} onChange={(e) => { setProvinsi(e.target.value); setPage(1); }} className={selectCls} aria-label="Provinsi">
                <option value="">Semua provinsi</option>
                {opts.provinsi.map((o) => <option key={o}>{o}</option>)}
              </select>
              <select value={tipe} onChange={(e) => { setTipe(e.target.value); setPage(1); }} className={selectCls} aria-label="Tipe layanan">
                <option value="">Semua tipe layanan</option>
                {opts.tipe.map((o) => <option key={o}>{o}</option>)}
              </select>
              <select value={masa} onChange={(e) => { setMasa(e.target.value as '' | Masa); setPage(1); }} className={selectCls} aria-label="Masa berlaku">
                <option value="">Semua masa berlaku</option>
                {(Object.keys(MASA_LABEL) as Masa[]).map((m) => <option key={m} value={m}>{MASA_LABEL[m]}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 text-xs text-slate-600">
            Show
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs cursor-pointer"
            >
              {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            entries
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            <button
              type="button"
              onClick={exportCsv}
              title="Unduh hasil filter (CSV, bisa dibuka di Excel)"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-teal-200 bg-teal-50 text-teal-700 text-xs font-semibold hover:bg-teal-100 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-[12px] whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-600">
                {COLS.map((c) => (
                  <th key={c} className="px-3 py-3 font-bold">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={r.noSlo} className="hover:bg-blue-50/40 align-middle">
                  <td className="px-3 py-3 text-center tabular-nums text-slate-500">{(safePage - 1) * pageSize + i + 1}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDetail(r)}
                        title="Lihat detail"
                        className="w-7 h-7 rounded-md bg-teal-500 hover:bg-teal-600 text-white flex items-center justify-center cursor-pointer"
                      >
                        <Search className="w-3.5 h-3.5" />
                      </button>
                      {r.lat !== null && r.lon !== null ? (
                        <a
                          href={`https://www.google.com/maps?q=${r.lat},${r.lon}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Buka lokasi di peta"
                          className="w-7 h-7 rounded-md bg-indigo-500 hover:bg-indigo-600 text-white flex items-center justify-center"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <span className="w-7 h-7 rounded-md bg-slate-200 text-slate-400 flex items-center justify-center">
                          <MapPin className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-700">{fmtDateLong(r.tglPermohonan)}</td>
                  <td className="px-3 py-3 text-slate-700">{fmtDateLong(r.tglRegistrasi)}</td>
                  <td className="px-3 py-3 font-mono text-slate-800">{r.noAgenda}</td>
                  <td className="px-3 py-3 min-w-[220px] max-w-[260px] whitespace-normal font-semibold text-slate-900 leading-snug">{r.pemilik}</td>
                  <td className="px-3 py-3 min-w-[200px] max-w-[240px] whitespace-normal text-slate-700 leading-snug">{r.instalasi}</td>
                  <td className="px-3 py-3 min-w-[220px] max-w-[260px] whitespace-normal text-slate-700 leading-snug">{r.jenis}</td>
                  <td className="px-3 py-3 text-slate-700">{r.kapasitas || '-'}</td>
                  <td className="px-3 py-3 text-slate-700">{SUMBER}</td>
                  <td className="px-3 py-3 font-semibold text-[#B45309]">{LIT}</td>
                  <td className="px-3 py-3 text-slate-700">{r.verifikator}</td>
                  <td className="px-3 py-3 font-mono text-slate-800">{r.nidi}</td>
                  <td className="px-3 py-3 min-w-[160px] whitespace-normal text-slate-700">{r.bidang}</td>
                  <td className="px-3 py-3 min-w-[180px] whitespace-normal text-slate-700">{r.subBidang}</td>
                  <td className="px-3 py-3 text-slate-700">{r.tipe}</td>
                  <td className="px-3 py-3 min-w-[240px] max-w-[300px] whitespace-normal text-slate-700 leading-snug">{r.lokasi}</td>
                  <td className="px-3 py-3 text-slate-700">{r.provinsi}</td>
                  <td className="px-3 py-3 text-slate-700">{r.kota}</td>
                  <td className="px-3 py-3 font-semibold text-[#DC2626]">{fmtDateLong(r.tglTerbit)}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full border text-xs font-semibold ${MASA_STYLE[masaOf(r.tglHabis, today)]}`}>
                      {fmtDateLong(r.tglHabis)}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-block px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200 text-xs font-semibold">SLO Terbit</span>
                  </td>
                  <td className="px-3 py-3 font-mono font-semibold text-slate-900">{r.noSlo}</td>
                  <td className="px-3 py-3 font-mono text-slate-700">{r.noRegister}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={COLS.length} className="px-3 py-10 text-center text-sm text-slate-500 whitespace-normal">
                    Tidak ada SLO yang cocok dengan pencarian / filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            Showing {filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1} to {Math.min(safePage * pageSize, filtered.length)} of {filtered.length} entries
            {filtered.length !== data.length && ` (filtered from ${data.length} total entries)`}
            {hasFilter && (
              <button type="button" onClick={resetFilters} className="ml-2 inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline cursor-pointer">
                <X className="w-3.5 h-3.5" /> Hapus filter
              </button>
            )}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage(safePage - 1)}
              className="inline-flex items-center gap-1 h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Previous
            </button>
            <span className="text-xs text-slate-500 tabular-nums">{safePage} / {pageCount}</span>
            <button
              type="button"
              disabled={safePage >= pageCount}
              onClick={() => setPage(safePage + 1)}
              className="inline-flex items-center gap-1 h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {detail && <DetailModal r={detail} today={today} onClose={() => setDetail(null)} />}
    </div>
  );
}

function DetailModal({ r, today, onClose }: { r: SloRecord; today: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const m = masaOf(r.tglHabis, today);
  const alamat = [r.lokasi, r.desa && `Desa/Kel. ${r.desa}`, r.kecamatan && `Kec. ${r.kecamatan}`, r.kota, r.provinsi]
    .filter(Boolean)
    .join(', ');
  const fields: [string, string][] = [
    ['No. SLO', r.noSlo],
    ['No. Register SLO', r.noRegister],
    ['No. Agenda', r.noAgenda],
    ['NIDI', r.nidi],
    ['Nama Pemilik', r.pemilik],
    ['Nama Instalasi', r.instalasi],
    ['Jenis Instalasi', r.jenis],
    ['Kapasitas / Daya', r.kapasitas || '-'],
    ['Bidang', r.bidang],
    ['Sub Bidang', r.subBidang],
    ['Tipe Layanan', r.tipe],
    ['Tgl. Permohonan Sertifikasi', fmtDate(r.tglPermohonan.slice(0, 10))],
    ['Tgl. Permohonan Registrasi', fmtDate(r.tglRegistrasi.slice(0, 10))],
    ['Tgl. Terbit', fmtDate(r.tglTerbit.slice(0, 10))],
    ['Berlaku s/d', fmtDate(r.tglHabis)],
    ['Lokasi Instalasi', alamat],
  ];
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#0284C7] to-[#38BDF8] flex items-center justify-center shrink-0">
              <BadgeCheck className="w-5 h-5 text-white" />
            </span>
            <div className="min-w-0">
              <h3 className="font-display font-extrabold text-base text-slate-900 leading-tight">Detail SLO Terbit</h3>
              <span className={`inline-block mt-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${MASA_STYLE[m]}`}>
                {MASA_LABEL[m]}
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <dl className="p-5 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {fields.map(([k, v]) => (
            <div key={k} className={k === 'Lokasi Instalasi' || k === 'Jenis Instalasi' ? 'sm:col-span-2' : ''}>
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">{k}</dt>
              <dd className="text-sm text-slate-900 mt-0.5 break-words">{v || '-'}</dd>
            </div>
          ))}
        </dl>
        {r.lat !== null && r.lon !== null && (
          <div className="px-5 pb-5">
            <a
              href={`https://www.google.com/maps?q=${r.lat},${r.lon}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700"
            >
              <MapPin className="w-3.5 h-3.5" /> Buka lokasi di peta
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default SloTerbit;
