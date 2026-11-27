import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Edit3, Plus, Search, Trash2 } from 'lucide-react';
import {
  COMPANY_PREFIX_OPTIONS,
  COMPANY_QUALIFICATION_OPTIONS,
  COMPANY_TYPE_OPTIONS,
  Pelanggan,
} from '../types/portal';
import { Wilayah, loadKabKota, loadProvinsi } from '../services/wilayahApi';

/** Nama tampil di tabel: awalan badan usaha + nama, mis. "PT. Alam Raya Kencana Mas". */
export function namaPelangganLengkap(p: Pick<Pelanggan, 'companyPrefix' | 'nama'>): string {
  const pre = p.companyPrefix || '';
  if (!pre) return p.nama;
  return `${pre}${pre.length <= 3 ? '.' : ''} ${p.nama}`;
}

const inputCls =
  'w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:bg-slate-50 disabled:text-slate-400';

function Row({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-1.5 sm:gap-4 sm:items-start">
      <label className="text-sm font-bold text-slate-800 sm:pt-2.5">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <div>{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Input Pelanggan (tambah & ubah)                                    */
/* ------------------------------------------------------------------ */

interface InputProps {
  records: Pelanggan[];
  /** id baris yang diubah; null = pelanggan baru */
  editingId: string | null;
  onSave: (p: Pelanggan) => void;
  onBack: () => void;
  onToast: (msg: string) => void;
}

function nextIdPelanggan(records: Pelanggan[]): string {
  const nums = records.map((r) => parseInt(r.idPelanggan, 10)).filter((n) => Number.isFinite(n));
  return String((nums.length ? Math.max(...nums) : 0) + 1);
}

export function InputPelanggan({ records, editingId, onSave, onBack, onToast }: InputProps) {
  const editing = editingId ? records.find((r) => r.id === editingId) : undefined;

  const [form, setForm] = useState<Omit<Pelanggan, 'id' | 'createdAt' | 'updatedAt'>>(() => ({
    idPelanggan: editing?.idPelanggan ?? nextIdPelanggan(records),
    email: editing?.email ?? '',
    nama: editing?.nama ?? '',
    alamat: editing?.alamat ?? '',
    provinsi: editing?.provinsi ?? '',
    kabKota: editing?.kabKota ?? '',
    namaPic: editing?.namaPic ?? '',
    telp1: editing?.telp1 ?? '',
    telp2: editing?.telp2 ?? '',
    npwp: editing?.npwp ?? '',
    companyType: editing?.companyType ?? COMPANY_TYPE_OPTIONS[0],
    companyPrefix: editing?.companyPrefix ?? 'PT',
    companyClassification: editing?.companyClassification ?? '',
    companyQualification: editing?.companyQualification ?? COMPANY_QUALIFICATION_OPTIONS[0],
  }));

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Provinsi & Kab/Kota diambil dari API Wilayah Indonesia (cadangan: daftar bawaan bila offline)
  const [provList, setProvList] = useState<Wilayah[]>([]);
  const [fromApi, setFromApi] = useState(true);
  const [provLoading, setProvLoading] = useState(true);
  const [kabKotaList, setKabKotaList] = useState<string[]>([]);
  const [kabLoading, setKabLoading] = useState(false);

  useEffect(() => {
    let off = false;
    loadProvinsi().then((r) => {
      if (off) return;
      setProvList(r.list);
      setFromApi(r.fromApi);
      setProvLoading(false);
    });
    return () => {
      off = true;
    };
  }, []);

  useEffect(() => {
    const prov = provList.find((p) => p.name === form.provinsi);
    if (!prov) {
      setKabKotaList([]);
      return;
    }
    let off = false;
    setKabLoading(true);
    loadKabKota(prov, fromApi).then((list) => {
      if (off) return;
      setKabKotaList(list.map((k) => k.name));
      setKabLoading(false);
    });
    return () => {
      off = true;
    };
  }, [form.provinsi, provList, fromApi]);

  const handleSave = () => {
    const idp = form.idPelanggan.trim();
    const nama = form.nama.trim();
    if (!idp) return onToast('ID Pelanggan wajib diisi');
    if (!nama) return onToast('Nama Pelanggan wajib diisi');
    if (records.some((r) => r.id !== editingId && r.idPelanggan.trim() === idp)) {
      return onToast(`ID Pelanggan ${idp} sudah dipakai pelanggan lain`);
    }
    const email = form.email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return onToast('Format email tidak valid');

    const now = new Date().toISOString();
    onSave({
      ...form,
      idPelanggan: idp,
      nama,
      email,
      alamat: form.alamat.trim(),
      namaPic: form.namaPic.trim(),
      telp1: form.telp1.trim(),
      telp2: form.telp2.trim(),
      npwp: form.npwp.trim(),
      companyClassification: form.companyClassification.trim(),
      id: editing?.id ?? `plg-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      createdAt: editing?.createdAt ?? now,
      updatedAt: now,
    });
  };

  return (
    <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="px-5 py-4 bg-violet-50/60 border-b border-slate-200/70 text-sm text-slate-700">
        {editing ? 'Ubah Pelanggan' : 'Input Pelanggan'}
      </div>
      <div className="p-5 md:p-6">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-10 gap-y-4">
          {/* Kolom kiri */}
          <div className="space-y-4">
            <Row label="ID Pelanggan" required>
              <input className={inputCls} value={form.idPelanggan} onChange={(e) => set('idPelanggan', e.target.value)} />
            </Row>
            <Row label="Email">
              <input type="email" className={inputCls} value={form.email} onChange={(e) => set('email', e.target.value)} />
            </Row>
            <Row label="Nama Pelanggan" required>
              <input className={inputCls} value={form.nama} onChange={(e) => set('nama', e.target.value)} />
            </Row>
            <Row label="Alamat">
              <textarea
                rows={3}
                className={`${inputCls} h-auto py-2 resize-y`}
                value={form.alamat}
                onChange={(e) => set('alamat', e.target.value)}
              />
            </Row>
            <Row label="Provinsi : Kab/Kota">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  className={inputCls}
                  value={form.provinsi}
                  onChange={(e) => setForm((f) => ({ ...f, provinsi: e.target.value, kabKota: '' }))}
                >
                  <option value="">{provLoading ? 'Memuat provinsi…' : '-- Pilih Provinsi --'}</option>
                  {provList.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                  {/* data lama di luar daftar tetap bisa tampil */}
                  {form.provinsi && !provList.some((p) => p.name === form.provinsi) && (
                    <option value={form.provinsi}>{form.provinsi}</option>
                  )}
                </select>
                <select
                  className={inputCls}
                  value={form.kabKota}
                  disabled={!form.provinsi}
                  onChange={(e) => set('kabKota', e.target.value)}
                >
                  <option value="">{kabLoading ? 'Memuat kab/kota…' : '-- Pilih Kab/Kota --'}</option>
                  {kabKotaList.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                  {/* data lama di luar daftar tetap bisa tampil */}
                  {form.kabKota && !kabKotaList.includes(form.kabKota) && <option value={form.kabKota}>{form.kabKota}</option>}
                </select>
              </div>
            </Row>
            <Row label="Nama PIC">
              <input className={inputCls} value={form.namaPic} onChange={(e) => set('namaPic', e.target.value)} />
            </Row>
            <Row label="Telepon / HP">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input inputMode="tel" className={inputCls} value={form.telp1} onChange={(e) => set('telp1', e.target.value)} />
                <input inputMode="tel" className={inputCls} value={form.telp2} onChange={(e) => set('telp2', e.target.value)} />
              </div>
            </Row>
          </div>

          {/* Kolom kanan */}
          <div className="space-y-4">
            <Row label="NPWP">
              <input className={inputCls} value={form.npwp} onChange={(e) => set('npwp', e.target.value)} />
            </Row>
            <Row label="Company Type">
              <select className={inputCls} value={form.companyType} onChange={(e) => set('companyType', e.target.value)}>
                {COMPANY_TYPE_OPTIONS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </Row>
            <Row label="Company Prefix">
              <select className={inputCls} value={form.companyPrefix} onChange={(e) => set('companyPrefix', e.target.value)}>
                {COMPANY_PREFIX_OPTIONS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </Row>
            <Row label="Company Classification">
              <input
                className={inputCls}
                value={form.companyClassification}
                onChange={(e) => set('companyClassification', e.target.value)}
              />
            </Row>
            <Row label="Company Qualification">
              <select
                className={inputCls}
                value={form.companyQualification}
                onChange={(e) => set('companyQualification', e.target.value)}
              >
                {COMPANY_QUALIFICATION_OPTIONS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </Row>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="px-4 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-sky-400 text-white text-xs font-bold shadow-sm shadow-cyan-500/30 cursor-pointer"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-purple-400 text-white text-xs font-bold shadow-sm shadow-violet-500/30 cursor-pointer"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Data Pelanggan (tabel)                                             */
/* ------------------------------------------------------------------ */

interface DataProps {
  records: Pelanggan[];
  onAdd: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

type SortKey = 'no' | 'id' | 'nama' | 'alamat' | 'kota' | 'telp';

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'no', label: 'No' },
  { key: 'id', label: 'ID Pelanggan' },
  { key: 'nama', label: 'Nama' },
  { key: 'alamat', label: 'Alamat' },
  { key: 'kota', label: 'Kab. Kota' },
  { key: 'telp', label: 'Telp' },
];

const PAGE_SIZES = [10, 25, 50, 100];

export function DataPelanggan({ records, onAdd, onEdit, onDelete }: DataProps) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'no', dir: 'asc' });
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    const base = records.map((r, i) => ({
      r,
      no: i + 1,
      nama: namaPelangganLengkap(r),
      telp: [r.telp1, r.telp2].filter(Boolean).join(' / '),
    }));
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? base.filter((x) =>
          [x.r.idPelanggan, x.nama, x.r.alamat, x.r.kabKota, x.r.provinsi, x.r.namaPic, x.r.email, x.telp]
            .join(' ')
            .toLowerCase()
            .includes(needle),
        )
      : base;
    const val = (x: (typeof base)[number]): string | number =>
      sort.key === 'no' ? x.no : sort.key === 'id' ? x.r.idPelanggan : sort.key === 'nama' ? x.nama
      : sort.key === 'alamat' ? x.r.alamat : sort.key === 'kota' ? x.r.kabKota : x.telp;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), 'id', { numeric: true, sensitivity: 'base' }) * dir;
    });
  }, [records, q, sort]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const cur = Math.min(page, totalPages);
  const start = (cur - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  const toggleSort = (key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
    setPage(1);
  };

  const handleDelete = (id: string, nama: string) => {
    if (window.confirm(`Hapus pelanggan "${nama}"? Tindakan ini tidak bisa dibatalkan.`)) onDelete(id);
  };

  return (
    <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="px-5 py-4 bg-violet-50/60 border-b border-slate-200/70 flex items-center justify-between gap-3">
        <span className="text-sm text-slate-700">Data Pelanggan</span>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 px-4 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-400 text-white text-xs font-bold shadow-sm shadow-violet-500/30 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>

      <div className="p-5 md:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <label className="flex items-center gap-2">
            Tampilkan
            <select
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {PAGE_SIZES.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
            data
          </label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Cari pelanggan…"
              className="h-8 w-56 rounded-md border border-slate-200 pl-8 pr-2 text-xs outline-none focus:border-violet-400"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left border-collapse min-w-[860px]">
            <thead>
              <tr className="bg-violet-50/70">
                {COLUMNS.map((c) => {
                  const active = sort.key === c.key;
                  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
                  return (
                    <th
                      key={c.key}
                      onClick={() => toggleSort(c.key)}
                      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                      className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-800 border-r border-slate-200 cursor-pointer select-none whitespace-nowrap"
                    >
                      <span className="flex items-center justify-between gap-2">
                        {c.label}
                        <Icon className={`w-3 h-3 ${active ? 'text-violet-600' : 'text-slate-300'}`} />
                      </span>
                    </th>
                  );
                })}
                <th className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-800">Action</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">
                    {records.length === 0 ? 'Belum ada data pelanggan. Klik Add untuk menambahkan.' : 'Tidak ada data yang cocok.'}
                  </td>
                </tr>
              ) : (
                pageRows.map((x) => (
                  <tr key={x.r.id} className="border-t border-slate-100 hover:bg-slate-50/70 text-sm text-slate-700">
                    <td className="px-4 py-3.5 tabular-nums">{x.no}</td>
                    <td className="px-4 py-3.5">{x.r.idPelanggan}</td>
                    <td className="px-4 py-3.5">{x.nama}</td>
                    <td className="px-4 py-3.5">{x.r.alamat}</td>
                    <td className="px-4 py-3.5">{x.r.kabKota}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap">{x.telp}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          title="Ubah"
                          aria-label={`Ubah ${x.nama}`}
                          onClick={() => onEdit(x.r.id)}
                          className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-sky-400 text-white flex items-center justify-center cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          title="Hapus"
                          aria-label={`Hapus ${x.nama}`}
                          onClick={() => handleDelete(x.r.id, x.nama)}
                          className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-rose-400 text-white flex items-center justify-center cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <span>
            {rows.length === 0 ? 'Menampilkan 0 data' : `Menampilkan ${start + 1}–${start + pageRows.length} dari ${rows.length} data`}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={cur <= 1}
              onClick={() => setPage(cur - 1)}
              aria-label="Halaman sebelumnya"
              className="w-8 h-8 rounded-md border border-slate-200 flex items-center justify-center disabled:opacity-40 cursor-pointer disabled:cursor-default"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 tabular-nums">
              {cur} / {totalPages}
            </span>
            <button
              type="button"
              disabled={cur >= totalPages}
              onClick={() => setPage(cur + 1)}
              aria-label="Halaman berikutnya"
              className="w-8 h-8 rounded-md border border-slate-200 flex items-center justify-center disabled:opacity-40 cursor-pointer disabled:cursor-default"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
