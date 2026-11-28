import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  Eye,
  Loader2,
  Printer,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  DOC_CONFIG,
  JENIS_INSTALASI_SOJO,
  JoSoDocument,
  JoSoRecord,
  MAX_FILE_BYTES,
  Pelanggan,
  Project,
  SuratPenawaran,
} from '../types/portal';
import { WorkOrderModal } from './WorkOrderDoc';
import { KlasifikasiKapasitasFields } from './KlasifikasiKapasitasFields';
import { validasiKlasifikasi } from '../data/katalogInstalasi';
import { blobToDataUrl, deleteVaultFile, getVaultFile, putVaultFile, triggerDataUrlDownload } from '../utils/fileVault';
import { namaPelangganLengkap } from './PelangganMenu';
import {
  newId,
  penawaranSiapPO,
  salesOrderDariPenawaran,
  suggestNoPO,
  terbilangRupiah,
} from '../utils/penawaranUtils';
import {
  calcJoSoTotals,
  composePelangganAlamat,
  formatDateShort,
  formatDecimalId,
  formatFileSize,
  getPelanggan,
  isoToday,
} from '../utils/portalUtils';

const inputCls =
  'w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:bg-slate-50 disabled:text-slate-600 disabled:cursor-not-allowed';
const btnCyan =
  'px-4 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-sky-400 text-white text-xs font-bold shadow-sm shadow-cyan-500/30 cursor-pointer';
const btnViolet =
  'px-4 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-purple-400 text-white text-xs font-bold shadow-sm shadow-violet-500/30 cursor-pointer';
const iconBtn = 'w-8 h-8 rounded-lg text-white flex items-center justify-center cursor-pointer';

const nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
const digits = (s: string) => s.replace(/\D/g, '');

const tglPanjang = (iso: string) => {
  const d = new Date(`${(iso || '').slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

function Row({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[170px_1fr] gap-1.5 sm:gap-4 sm:items-start">
      <label className="text-sm font-bold text-slate-800 sm:pt-2.5">{label}</label>
      <div>
        {children}
        {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tabel berurutan + pencarian + halaman (dipakai kedua daftar)        */
/* ------------------------------------------------------------------ */

interface Col<T> {
  key: string;
  label: string;
  align?: 'right';
  sortVal: (r: T) => string | number;
  render: (r: T) => ReactNode;
  nowrap?: boolean;
}

const PAGE_SIZES = [10, 25, 50, 100];

function SortableTable<T extends { id: string; no: number }>({
  title,
  rows,
  cols,
  searchText,
  renderAction,
  emptyText,
  minWidth = 820,
  toolbarAction,
}: {
  title: string;
  rows: T[];
  cols: Col<T>[];
  searchText: (r: T) => string;
  renderAction: (r: T) => ReactNode;
  emptyText: string;
  minWidth?: number;
  /** Tombol di sebelah kotak pencarian. */
  toolbarAction?: ReactNode;
}) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'no', dir: 'asc' });
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle ? rows.filter((r) => searchText(r).toLowerCase().includes(needle)) : rows;
    const col = cols.find((c) => c.key === sort.key);
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (!col) return 0;
      const va = col.sortVal(a);
      const vb = col.sortVal(b);
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), 'id', { numeric: true, sensitivity: 'base' }) * dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const cur = Math.min(page, totalPages);
  const start = (cur - 1) * pageSize;
  const pageRows = sorted.slice(start, start + pageSize);

  const toggleSort = (key: string) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
    setPage(1);
  };

  return (
    <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="px-5 py-4 bg-violet-50/60 border-b border-slate-200/70 text-sm text-slate-700">{title}</div>
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
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">
              Search:
              <span className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPage(1);
                  }}
                  className="h-8 w-56 rounded-md border border-slate-200 pl-8 pr-2 text-xs outline-none focus:border-violet-400"
                />
              </span>
            </label>
            {toolbarAction}
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left border-collapse" style={{ minWidth }}>
            <thead>
              <tr className="bg-violet-50/70">
                {cols.map((c) => {
                  const active = sort.key === c.key;
                  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
                  return (
                    <th
                      key={c.key}
                      onClick={() => toggleSort(c.key)}
                      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                      className="px-4 py-3 text-xs font-extrabold uppercase tracking-wider text-slate-800 border-r border-slate-200 cursor-pointer select-none whitespace-nowrap"
                    >
                      <span className="flex items-center justify-between gap-2">
                        {c.label}
                        <Icon className={`w-3 h-3 ${active ? 'text-violet-600' : 'text-slate-300'}`} />
                      </span>
                    </th>
                  );
                })}
                <th className="px-4 py-3 text-xs font-extrabold uppercase tracking-wider text-slate-800">Action</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={cols.length + 1} className="px-4 py-10 text-center text-sm text-slate-400">
                    {rows.length === 0 ? emptyText : 'Tidak ada data yang cocok.'}
                  </td>
                </tr>
              ) : (
                pageRows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/70 text-sm text-slate-700">
                    {cols.map((c) => (
                      <td
                        key={c.key}
                        className={`px-4 py-4 tabular-nums ${c.align === 'right' ? 'text-right' : ''} ${c.nowrap ? 'whitespace-nowrap' : ''}`}
                      >
                        {c.render(r)}
                      </td>
                    ))}
                    <td className="px-4 py-4">{renderAction(r)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <span>{sorted.length === 0 ? 'Menampilkan 0 data' : `Menampilkan ${start + 1}–${start + pageRows.length} dari ${sorted.length} data`}</span>
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

/* ------------------------------------------------------------------ */
/* Form Sales Order: Penawaran · Purchase Order · Purchase Order Document */
/* ------------------------------------------------------------------ */

type TabKey = 'penawaran' | 'po' | 'dokumen';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'penawaran', label: 'Penawaran' },
  { key: 'po', label: 'Purchase Order' },
  { key: 'dokumen', label: 'Purchase Order Document' },
];

interface FormProps {
  mode: 'create' | 'edit';
  record: JoSoRecord;
  /** Semua Sales Order (untuk nomor PO otomatis dan cek nomor kembar). */
  records: JoSoRecord[];
  pelanggan: Pelanggan[];
  onSave: (rec: JoSoRecord) => void;
  onBack: () => void;
  onToast: (msg: string) => void;
  /** Hanya lihat (Direktur): isian dikunci dan tombol Save disembunyikan. */
  readOnly?: boolean;
}

function SalesOrderForm({ mode, record, records, pelanggan, onSave, onBack, onToast, readOnly = false }: FormProps) {
  const [tab, setTab] = useState<TabKey>('penawaran');
  const [rec, setRec] = useState<JoSoRecord>(record);
  const [docName, setDocName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ name: string; title: string; mimeType: string; dataUrl: string } | null>(null);
  const [previewBusy, setPreviewBusy] = useState<string | null>(null);
  /** Berkas yang diunggah di sesi form ini (dibuang dari server bila form ditutup tanpa Save). */
  const baruRef = useRef<string[]>([]);
  /** Berkas tersimpan yang dihapus di form ini (benar-benar dihapus dari server saat Save). */
  const hapusRef = useRef<string[]>([]);

  const patch = (p: Partial<JoSoRecord>) => setRec((r) => ({ ...r, ...p }));
  const pel = getPelanggan(rec);
  const totals = calcJoSoTotals(rec);
  const labelPpn = Number(rec.ppnRate) ? `PPN ${rec.ppnRate}%` : 'PPN (Non PPN)';

  const pelOptions = useMemo(
    () =>
      pelanggan
        .map((p) => ({
          id: p.id,
          nama: namaPelangganLengkap(p),
          label: `${namaPelangganLengkap(p)} | ${[p.alamat, p.kabKota].filter(Boolean).join(' ')}`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, 'id', { sensitivity: 'base' })),
    [pelanggan],
  );
  const pelTerpilih = pelanggan.find((p) => namaPelangganLengkap(p) === pel.nama)?.id ?? '';

  const changePelanggan = (id: string) => {
    const p = pelanggan.find((x) => x.id === id);
    if (!p) return;
    const nama = namaPelangganLengkap(p);
    patch({
      namaPerusahaan: nama,
      alamatPerusahaan: p.alamat,
      kota: p.kabKota,
      npwp: p.npwp,
      kontakNama: p.namaPic,
      kontakTelp: p.telp1 || p.telp2 || '',
      kepadaAlamat: composePelangganAlamat(nama, p.alamat, p.kabKota),
      pelangganAlamat: composePelangganAlamat(nama, p.alamat, p.kabKota),
    });
  };

  const changePoDate = (v: string) => {
    patch({ poDate: v, poNo: mode === 'edit' ? rec.poNo : suggestNoPO(records, v) });
  };

  const uploadDoc = async () => {
    if (busy) return;
    if (!file) return onToast('Pilih file dokumen terlebih dahulu');
    if (file.size > MAX_FILE_BYTES) return onToast(`${file.name} melebihi batas 5 MB (${formatFileSize(file.size)})`);
    setBusy(true);
    try {
      const nowIso = new Date().toISOString();
      const id = `sopo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const mimeType = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');
      const dataUrl = await blobToDataUrl(file);
      const synced = await putVaultFile({ id, name: file.name, mimeType, size: file.size, dataUrl, savedAt: nowIso, folder: 'sales-order' });
      if (!synced) onToast('Dokumen tersimpan di perangkat ini saja — server dokumen tidak terjangkau');
      baruRef.current.push(id);
      const doc: JoSoDocument = {
        id: newId('doc'),
        docName: docName.trim() || file.name.replace(/\.[^.]+$/, ''),
        filePath: file.name,
        fileSize: file.size,
        uploadedAt: nowIso,
        vaultFileId: id,
        mimeType,
      };
      setRec((r) => ({ ...r, documents: [...r.documents, doc] }));
      setDocName('');
      setFile(null);
      setFileKey((k) => k + 1);
      onToast(`Dokumen "${doc.docName}" ditambahkan`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Gagal mengunggah dokumen');
    } finally {
      setBusy(false);
    }
  };

  const removeDoc = (d: JoSoDocument) => {
    if (d.vaultFileId) {
      if (baruRef.current.includes(d.vaultFileId)) {
        baruRef.current = baruRef.current.filter((x) => x !== d.vaultFileId);
        void deleteVaultFile(d.vaultFileId);
      } else {
        hapusRef.current.push(d.vaultFileId);
      }
    }
    setRec((r) => ({ ...r, documents: r.documents.filter((x) => x.id !== d.id) }));
  };

  const downloadDoc = async (d: JoSoDocument) => {
    if (!d.vaultFileId) return onToast('Berkas ini hanya tercatat namanya (data lama), isinya tidak tersimpan');
    const f = await getVaultFile(d.vaultFileId);
    if (!f) return onToast('Berkas tidak ditemukan di server maupun perangkat ini');
    triggerDataUrlDownload(f.dataUrl, d.filePath || f.name);
  };

  const previewDoc = async (d: JoSoDocument) => {
    if (!d.vaultFileId) return onToast('Berkas ini hanya tercatat namanya (data lama), isinya tidak tersimpan');
    if (previewBusy) return;
    setPreviewBusy(d.id);
    try {
      const f = await getVaultFile(d.vaultFileId);
      if (!f) return onToast('Berkas tidak ditemukan di server maupun perangkat ini');
      setPreview({ name: d.filePath || f.name, title: d.docName, mimeType: f.mimeType || d.mimeType || '', dataUrl: f.dataUrl });
    } finally {
      setPreviewBusy(null);
    }
  };

  /** Back: buang berkas yang baru diunggah tetapi tidak disimpan. */
  const handleBack = () => {
    baruRef.current.forEach((id) => void deleteVaultFile(id));
    baruRef.current = [];
    onBack();
  };

  const gagal = (t: TabKey, msg: string) => {
    setTab(t);
    onToast(msg);
  };

  const handleSave = () => {
    if (!rec.poDate) return gagal('po', 'PO Date wajib diisi');
    // Nomor PO baru selalu dihitung ulang saat disimpan (menghindari bentrok); nomor yang diedit tetap.
    const poNo = mode === 'edit' ? rec.poNo.trim() : suggestNoPO(records, rec.poDate);
    if (!poNo) return gagal('po', 'PO No wajib diisi');
    if (records.some((r) => r.id !== rec.id && (r.poNo || '').trim().toLowerCase() === poNo.toLowerCase())) {
      return gagal('po', `PO No ${poNo} sudah dipakai`);
    }
    const dp = Number(rec.dp);
    if (!Number.isFinite(dp) || dp < 0 || dp > 100) return gagal('po', 'DP harus antara 0 dan 100 (%)');
    const salahKlas = validasiKlasifikasi(rec, rec.jenisInstalasiJo);
    if (salahKlas) return gagal('po', salahKlas);
    hapusRef.current.forEach((id) => void deleteVaultFile(id));
    hapusRef.current = [];
    baruRef.current = [];
    onSave({ ...rec, poNo, dp, title: rec.title.trim(), paymentTerm: rec.paymentTerm.trim(), updatedAt: new Date().toISOString() });
  };

  const actions = (
    <div className="mt-6 flex items-center gap-2">
      <button type="button" onClick={handleBack} className={btnCyan}>
        Back
      </button>
      {!readOnly && (
        <button type="button" onClick={handleSave} className={btnViolet}>
          Save
        </button>
      )}
    </div>
  );

  return (
    <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-end gap-x-6 px-5 pt-3 bg-violet-50/60 border-b border-slate-200/70">
        <span className="text-sm text-slate-700 pb-3">{readOnly ? 'Lihat Sales Order (Hanya Baca)' : mode === 'edit' ? 'Edit Sales Order' : 'Form Sales Order'}</span>
        <div role="tablist" className="flex flex-wrap items-end gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm rounded-t-lg cursor-pointer ${
                tab === t.key ? 'bg-white text-violet-600 font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <fieldset disabled={readOnly} className="p-5 md:p-6 min-w-0 m-0 border-0">
        {/* ---------------- Penawaran (sama dengan Input Penawaran, hanya tampil) ---------------- */}
        {tab === 'penawaran' && (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-10 gap-y-4">
              <div className="space-y-4">
                <Row label="Tanggal Penawaran">
                  <input className={inputCls} value={tglPanjang(rec.tanggalPenawaran)} disabled />
                </Row>
                <Row label="No Penawaran">
                  <input className={inputCls} value={rec.noPenawaran} disabled />
                </Row>
                <Row label="Perihal">
                  <input className={inputCls} value={rec.perihal} disabled />
                </Row>
                <Row label="Lampiran">
                  <input className={inputCls} value={rec.lampiran} disabled />
                </Row>
                <Row label="Tanggal Permintaan">
                  <input className={inputCls} value={rec.tanggalPermintaan ? tglPanjang(rec.tanggalPermintaan) : '-'} disabled />
                </Row>
              </div>
              <div className="space-y-4">
                <Row label="Kepada | Alamat">
                  <input
                    className={inputCls}
                    value={composePelangganAlamat(pel.nama, pel.alamat, pel.kota)}
                    title={composePelangganAlamat(pel.nama, pel.alamat, pel.kota)}
                    disabled
                  />
                </Row>
                <Row label="Jenis Instalasi">
                  <input className={inputCls} value={rec.jenisInstalasiPenawaran} disabled />
                </Row>
                <Row label="Status">
                  <input className={inputCls} value={rec.status} disabled />
                </Row>
                <Row label="Masa Berlaku">
                  <div className="flex items-center gap-3">
                    <input className={inputCls} value={rec.masaBerlaku} disabled />
                    <span className="text-sm text-slate-500">Hari</span>
                  </div>
                </Row>
              </div>
            </div>

            <h3 className="mt-6 text-base font-bold text-slate-800 border-b border-slate-200 pb-3">Detail Item</h3>
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse min-w-[760px]">
                <thead>
                  <tr className="bg-violet-50/70 text-xs font-extrabold uppercase tracking-wider text-slate-800">
                    <th className="px-4 py-3">Item Name</th>
                    <th className="px-4 py-3 text-center">Harga Satuan</th>
                    <th className="px-4 py-3 text-right">Price</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="px-4 py-3 text-right">Sub Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rec.items.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                        Penawaran ini belum memiliki item.
                      </td>
                    </tr>
                  )}
                  {rec.items.map((it) => (
                    <tr key={it.id} className="border-t border-slate-100 text-sm text-slate-700">
                      <td className="px-4 py-3">{it.itemName}</td>
                      <td className="px-4 py-3 text-center">{it.satuan}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatDecimalId(it.price)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{nf.format(it.qty)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatDecimalId(Math.round(it.price * it.qty))}</td>
                    </tr>
                  ))}
                  {(
                    [
                      ['Jumlah', totals.jumlah],
                      [labelPpn, totals.ppn],
                      ['Total', totals.total],
                    ] as [string, number][]
                  ).map(([label, val], i) => (
                    <tr key={label} className={`${i === 0 ? 'border-t border-slate-200 ' : ''}text-sm font-bold text-slate-800`}>
                      <td colSpan={4} className="px-4 py-2.5 text-right">
                        {label}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatDecimalId(val)}</td>
                    </tr>
                  ))}
                  <tr className="text-xs text-slate-600">
                    <td colSpan={5} className="px-4 pb-3 text-right">
                      Terbilang: <span className="font-semibold">{terbilangRupiah(totals.total)}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            {actions}
          </>
        )}

        {/* ---------------- Purchase Order ---------------- */}
        {tab === 'po' && (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-10 gap-y-4">
              <div className="space-y-4">
                <Row label="PO No" hint="Otomatis: urutan/WO/SDP/bulan (romawi)/tahun mengikuti PO Date. Tidak bisa diubah.">
                  <input className={`${inputCls} cursor-not-allowed`} value={rec.poNo} readOnly aria-readonly="true" disabled />
                </Row>
                <Row label="Title">
                  <input className={inputCls} value={rec.title} onChange={(e) => patch({ title: e.target.value })} />
                </Row>
                <Row label="PO Date">
                  <input type="date" className={inputCls} value={rec.poDate} onChange={(e) => changePoDate(e.target.value)} />
                </Row>
                <Row label="PO Delivery Date / Expired Date">
                  <input type="date" className={inputCls} value={rec.poExpiredDate} onChange={(e) => patch({ poExpiredDate: e.target.value })} />
                </Row>
                <Row label="DP" hint="Persen uang muka (0–100). Menentukan catatan pembayaran di Work Order.">
                  <div className="flex items-center gap-3">
                    <input
                      inputMode="numeric"
                      className={inputCls}
                      value={String(rec.dp ?? '')}
                      onChange={(e) => patch({ dp: Number(digits(e.target.value).slice(0, 3)) })}
                    />
                    <span className="text-sm text-slate-500">%</span>
                  </div>
                </Row>
              </div>
              <div className="space-y-4">
                <Row label="Pelanggan | Alamat">
                  <select className={inputCls} value={pelTerpilih} onChange={(e) => changePelanggan(e.target.value)}>
                    {!pelTerpilih && <option value="">{composePelangganAlamat(pel.nama, pel.alamat, pel.kota) || '-- Pilih Pelanggan --'}</option>}
                    {pelOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Row>
                <Row label="Jenis Instalasi">
                  <select className={inputCls} value={rec.jenisInstalasiJo} onChange={(e) => patch({ jenisInstalasiJo: e.target.value })}>
                    {!JENIS_INSTALASI_SOJO.includes(rec.jenisInstalasiJo) && rec.jenisInstalasiJo && <option>{rec.jenisInstalasiJo}</option>}
                    {JENIS_INSTALASI_SOJO.map((j) => (
                      <option key={j}>{j}</option>
                    ))}
                  </select>
                </Row>
                <Row label="Payment Term">
                  <input className={inputCls} value={rec.paymentTerm} onChange={(e) => patch({ paymentTerm: e.target.value })} />
                </Row>
                <Row label="Penandatangan" hint="Tercetak di tanda tangan Work Order.">
                  <select
                    className={inputCls}
                    value={rec.penandatangan ?? DOC_CONFIG.workOrder.penandatangan.nama}
                    onChange={(e) => patch({ penandatangan: e.target.value })}
                  >
                    {DOC_CONFIG.penandatangan.map((p) => (
                      <option key={p.nama} value={p.nama}>
                        {p.nama} — {p.jabatan}
                      </option>
                    ))}
                  </select>
                </Row>
              </div>
            </div>
            <div className="mt-6">
              <KlasifikasiKapasitasFields value={rec} jenisPekerjaan={rec.jenisInstalasiJo} onChange={patch} />
            </div>
            {actions}
          </>
        )}

        {/* ---------------- Purchase Order Document ---------------- */}
        {tab === 'dokumen' && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-6">
              <div className="overflow-x-auto rounded-xl border border-slate-200 self-start">
                <table className="w-full text-left border-collapse min-w-[380px]">
                  <thead>
                    <tr className="bg-slate-200/70 text-xs font-extrabold uppercase tracking-wider text-slate-800">
                      <th className="px-4 py-3">Doc Name</th>
                      <th className="px-4 py-3">Berkas</th>
                      <th className="px-4 py-3 w-[116px]" />
                    </tr>
                  </thead>
                  <tbody>
                    {rec.documents.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-center text-sm text-slate-400">
                          Belum ada dokumen.
                        </td>
                      </tr>
                    )}
                    {rec.documents.map((d) => (
                      <tr key={d.id} className="border-t border-slate-100 text-sm text-slate-700 align-top">
                        <td className="px-4 py-3 font-medium text-slate-800">{d.docName}</td>
                        <td className="px-4 py-3 break-all">
                          {d.filePath}
                          {d.fileSize ? (
                            <span className="block text-xs text-slate-400">
                              {formatFileSize(d.fileSize)} · {formatDateShort(d.uploadedAt)}
                              {d.vaultFileId ? '' : ' · hanya nama tercatat'}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              title={d.vaultFileId ? 'Lihat dokumen' : 'Isi berkas tidak tersimpan'}
                              aria-label={`Lihat ${d.docName}`}
                              disabled={!d.vaultFileId || previewBusy === d.id}
                              onClick={() => void previewDoc(d)}
                              className="p-1.5 rounded-md text-slate-400 hover:text-violet-600 hover:bg-violet-50 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
                            >
                              {previewBusy === d.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                            </button>
                            <button
                              type="button"
                              title={d.vaultFileId ? 'Unduh dokumen' : 'Isi berkas tidak tersimpan'}
                              aria-label={`Unduh ${d.docName}`}
                              disabled={!d.vaultFileId}
                              onClick={() => void downloadDoc(d)}
                              className="p-1.5 rounded-md text-slate-400 hover:text-violet-600 hover:bg-violet-50 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              title="Hapus dokumen"
                              aria-label={`Hapus ${d.docName}`}
                              onClick={() => removeDoc(d)}
                              className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="self-start rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                <div className="text-sm font-bold text-slate-800">Tambah dokumen</div>
                <input
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  placeholder="Nama dokumen (mis. PO / SPK)"
                  aria-label="Nama dokumen"
                  className={inputCls}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    key={fileKey}
                    type="file"
                    accept=".pdf,image/*,.doc,.docx,.xls,.xlsx"
                    aria-label="Pilih berkas"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="flex-1 min-w-[200px] text-xs text-slate-600 file:mr-3 file:h-9 file:px-3 file:rounded-lg file:border file:border-slate-300 file:text-xs file:font-semibold file:bg-white hover:file:bg-slate-100 file:cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => void uploadDoc()}
                    disabled={busy}
                    className={`${btnViolet} inline-flex items-center justify-center gap-1.5 h-10 min-w-[110px] disabled:opacity-60`}
                  >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Upload
                  </button>
                </div>
                <p className="text-xs text-slate-400">PDF, gambar, Word, atau Excel. Maksimal 5 MB per berkas.</p>
              </div>
            </div>
            {actions}
          </>
        )}
      </fieldset>

      {preview && (
        <div className="no-print fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div
            role="dialog"
            aria-label={`Pratinjau ${preview.title}`}
            className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200">
              <div className="min-w-0">
                <h3 className="font-bold text-slate-900 text-sm truncate">{preview.title}</h3>
                <p className="text-xs text-slate-500 truncate">{preview.name}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => triggerDataUrlDownload(preview.dataUrl, preview.name)}
                  className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Unduh
                </button>
                <button
                  type="button"
                  aria-label="Tutup pratinjau"
                  onClick={() => setPreview(null)}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-slate-100 p-4 flex items-center justify-center">
              {preview.mimeType.startsWith('image/') || preview.dataUrl.startsWith('data:image/') ? (
                <img
                  src={preview.dataUrl}
                  alt={preview.name}
                  className="max-w-full max-h-[70vh] rounded-lg shadow-sm border border-slate-200 bg-white"
                />
              ) : preview.mimeType === 'application/pdf' || preview.dataUrl.startsWith('data:application/pdf') ? (
                <iframe src={preview.dataUrl} title={preview.name} className="w-full h-[70vh] rounded-lg border border-slate-200 bg-white" />
              ) : (
                <p className="py-16 text-sm text-slate-500 text-center">
                  Berkas Word/Excel tidak bisa dipratinjau di sini. Gunakan tombol Unduh untuk membukanya.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Create Order: daftar penawaran yang siap dibuatkan PO               */
/* ------------------------------------------------------------------ */

interface CreateRow {
  id: string;
  no: number;
  p: SuratPenawaran;
  vendor: string;
}

interface SalesOrderRow {
  id: string;
  no: number;
  r: JoSoRecord;
  nama: string;
  nilai: number;
}

interface CreateOrderProps {
  penawaran: SuratPenawaran[];
  pelanggan: Pelanggan[];
  salesOrders: JoSoRecord[];
  /** Simpan Sales Order baru; setelah itu pemanggil membuka Data Sales Order. */
  onSave: (rec: JoSoRecord) => void;
  onToast: (msg: string) => void;
}

export function CreateOrder({ penawaran, pelanggan, salesOrders, onSave, onToast }: CreateOrderProps) {
  const [draft, setDraft] = useState<JoSoRecord | null>(null);

  const rows = useMemo<CreateRow[]>(
    () =>
      penawaranSiapPO(penawaran, salesOrders).map((p, i) => {
        const pel = pelanggan.find((x) => x.id === p.pelangganId);
        return { id: p.id, no: i + 1, p, vendor: pel ? namaPelangganLengkap(pel) : p.pelangganNama };
      }),
    [penawaran, pelanggan, salesOrders],
  );

  if (draft) {
    return (
      <SalesOrderForm
        mode="create"
        record={draft}
        records={salesOrders}
        pelanggan={pelanggan}
        onSave={onSave}
        onBack={() => setDraft(null)}
        onToast={onToast}
      />
    );
  }

  const startCreate = (p: SuratPenawaran) => {
    const pel = pelanggan.find((x) => x.id === p.pelangganId);
    const nama = pel ? namaPelangganLengkap(pel) : p.pelangganNama;
    setDraft(salesOrderDariPenawaran(p, pel, salesOrders, nama, isoToday()));
  };

  return (
    <SortableTable<CreateRow>
      title="Data Penawaran [Job Order/Sales Order Preparation]"
      rows={rows}
      cols={[
        { key: 'no', label: 'No', sortVal: (r) => r.no, render: (r) => r.no },
        { key: 'tanggal', label: 'Tanggal', sortVal: (r) => r.p.tanggal, render: (r) => tglPanjang(r.p.tanggal), nowrap: true },
        { key: 'vendor', label: 'Vendor', sortVal: (r) => r.vendor, render: (r) => r.vendor },
        { key: 'nomor', label: 'No Penawaran', sortVal: (r) => r.p.noPenawaran, render: (r) => r.p.noPenawaran, nowrap: true },
      ]}
      searchText={(r) => [r.p.noPenawaran, r.vendor, tglPanjang(r.p.tanggal), r.p.perihal].join(' ')}
      emptyText="Belum ada penawaran yang siap dibuatkan PO. Penawaran berstatus submit atau approved muncul di sini."
      minWidth={720}
      renderAction={(r) => (
        <button type="button" onClick={() => startCreate(r.p)} className={`${btnViolet} h-9 shadow-md`}>
          Create PO
        </button>
      )}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Data Sales Order                                                    */
/* ------------------------------------------------------------------ */

interface DataSalesOrderProps {
  records: JoSoRecord[];
  pelanggan: Pelanggan[];
  projects: Project[];
  signatures?: Record<string, string>;
  onSave: (rec: JoSoRecord) => void;
  onDelete: (id: string) => void;
  onToast: (msg: string) => void;
  /** Hanya lihat (Direktur): tidak bisa mengubah atau menghapus. */
  readOnly?: boolean;
  /** Tombol di sebelah kotak pencarian (mis. "Create Order"). */
  toolbarAction?: ReactNode;
}

export function DataSalesOrder({ records, pelanggan, signatures, onSave, onDelete, onToast, readOnly = false, toolbarAction }: DataSalesOrderProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [printId, setPrintId] = useState<string | null>(null);

  const rows = useMemo<SalesOrderRow[]>(
    () =>
      records.map((r, i) => ({
        id: r.id,
        no: i + 1,
        r,
        nama: getPelanggan(r).nama,
        nilai: calcJoSoTotals(r).jumlah,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [records],
  );

  const editing = editingId ? records.find((r) => r.id === editingId) : undefined;
  if (editing) {
    return (
      <SalesOrderForm
        key={editing.id}
        mode="edit"
        record={editing}
        records={records}
        pelanggan={pelanggan}
        onSave={(rec) => {
          onSave(rec);
          setEditingId(null);
        }}
        onBack={() => setEditingId(null)}
        onToast={onToast}
        readOnly={readOnly}
      />
    );
  }

  const printRec = printId ? records.find((r) => r.id === printId) : undefined;

  return (
    <>
      <SortableTable<SalesOrderRow>
        title="Data Job Order/Sales Order"
        rows={rows}
        cols={[
          { key: 'no', label: 'No', sortVal: (x) => x.no, render: (x) => x.no },
          { key: 'tanggal', label: 'Tanggal', sortVal: (x) => x.r.poDate, render: (x) => x.r.poDate || '-', nowrap: true },
          { key: 'po', label: 'No.PO', sortVal: (x) => x.r.poNo, render: (x) => x.r.poNo || '-', nowrap: true },
          { key: 'nama', label: 'Nama Perusahaan', sortVal: (x) => x.nama, render: (x) => x.nama || '-' },
          { key: 'nilai', label: 'Nilai', align: 'right', sortVal: (x) => x.nilai, render: (x) => formatDecimalId(x.nilai), nowrap: true },
        ]}
        searchText={(x) => [x.r.poNo, x.nama, x.r.poDate, x.r.noPenawaran, x.r.title].join(' ')}
        emptyText="Belum ada Sales Order. Buat lewat tombol Create Order di atas."
        minWidth={900}
        toolbarAction={toolbarAction}
        renderAction={(x) => (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              title={readOnly ? 'Lihat' : 'Ubah'}
              aria-label={`${readOnly ? 'Lihat' : 'Ubah'} ${x.r.poNo}`}
              onClick={() => setEditingId(x.r.id)}
              className={`${iconBtn} bg-gradient-to-br from-cyan-500 to-sky-400`}
            >
              {readOnly ? <Eye className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
            </button>
            {!readOnly && (
            <button
              type="button"
              title="Hapus"
              aria-label={`Hapus ${x.r.poNo}`}
              onClick={() => {
                if (window.confirm(`Hapus Sales Order "${x.r.poNo || x.r.noPenawaran}"? Dokumen PO yang terunggah ikut dihapus. Tindakan ini tidak bisa dibatalkan.`)) {
                  x.r.documents.forEach((d) => d.vaultFileId && void deleteVaultFile(d.vaultFileId));
                  onDelete(x.r.id);
                }
              }}
              className={`${iconBtn} bg-gradient-to-br from-red-500 to-rose-400`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
            )}
            <button
              type="button"
              title="Cetak Work Order"
              aria-label={`Cetak ${x.r.poNo}`}
              onClick={() => setPrintId(x.r.id)}
              className={`${iconBtn} bg-gradient-to-br from-cyan-500 to-sky-400`}
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        )}
      />
      {printRec && <WorkOrderModal record={printRec} signatures={signatures} onClose={() => setPrintId(null)} onToast={onToast} />}
    </>
  );
}
