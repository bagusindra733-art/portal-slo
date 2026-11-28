import { useMemo, useState, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Edit3,
  Plus,
  Printer,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  DOC_CONFIG,
  JENIS_INSTALASI_SOJO,
  PENAWARAN_PPN_OPTIONS,
  PENAWARAN_STATUS_OPTIONS,
  Pelanggan,
  SuratPenawaran,
  SuratPenawaranItem,
  SATUAN_SOJO,
} from '../types/portal';
import { RichTextEditor } from './RichTextEditor';
import { PenawaranModal } from './PenawaranDoc';
import { InputPelanggan, namaPelangganLengkap } from './PelangganMenu';
import { sanitizeHtml } from '../utils/sanitizeHtml';
import {
  DEFAULT_CARA_PEMBAYARAN,
  DEFAULT_CATATAN,
  DEFAULT_DATA_PERSYARATAN,
  DEFAULT_DENGAN_HORMAT,
  DEFAULT_UP,
  hitungPenawaran,
  terbilangRupiah,
  newId,
  suggestNoPenawaran,
} from '../utils/penawaranUtils';
import { isoToday } from '../utils/portalUtils';

const inputCls =
  'w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100';
const btnCyan =
  'px-4 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-sky-400 text-white text-xs font-bold shadow-sm shadow-cyan-500/30 cursor-pointer';
const btnViolet =
  'px-4 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-purple-400 text-white text-xs font-bold shadow-sm shadow-violet-500/30 cursor-pointer';

const nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
const rp = (n: number) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(n || 0));

const tglPanjang = (iso: string) => {
  const d = new Date(`${(iso || '').slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

function Row({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-1.5 sm:gap-4 sm:items-start">
      <label className="text-sm font-bold text-slate-800 sm:pt-2.5">{label}</label>
      <div>
        {children}
        {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pilih pelanggan (dropdown dengan pencarian)                         */
/* ------------------------------------------------------------------ */

function PelangganPicker({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const selected = options.find((o) => o.id === value);
  const list = options.filter((o) => o.label.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setQ('');
          setOpen((v) => !v);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`${inputCls} flex items-center justify-between text-left cursor-pointer`}
      >
        <span className={`truncate ${selected ? '' : 'text-slate-400'}`}>{selected?.label ?? '-- Pilih Pelanggan --'}</span>
        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute z-40 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
            <div className="p-2 border-b border-slate-100">
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari pelanggan…"
                className="w-full h-9 rounded-md border border-slate-200 px-2.5 text-sm outline-none focus:border-violet-400"
              />
            </div>
            <ul role="listbox" className="max-h-60 overflow-auto py-1">
              {list.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">Tidak ditemukan</li>}
              {list.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={o.id === value}
                    onClick={() => {
                      onChange(o.id);
                      setOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-violet-50 cursor-pointer ${
                      o.id === value ? 'bg-violet-50 font-semibold' : ''
                    }`}
                  >
                    {o.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Add Pelanggan: memakai form yang sama dengan menu Input Pelanggan   */
/* ------------------------------------------------------------------ */

function AddPelangganModal({
  records,
  onSave,
  onClose,
  onToast,
}: {
  records: Pelanggan[];
  onSave: (p: Pelanggan) => void;
  onClose: () => void;
  onToast: (m: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-3 sm:p-6" role="dialog" aria-modal="true">
      <div className="w-full max-w-5xl rounded-2xl bg-white shadow-xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-5 py-3.5 bg-violet-50/60 border-b border-slate-200">
          <div className="text-sm text-slate-700">Input Pelanggan</div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 md:p-6">
          <InputPelanggan embedded records={records} editingId={null} onSave={onSave} onBack={onClose} onToast={onToast} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Input / Edit SuratPenawaran (Header · Detail Item · Lampiran)            */
/* ------------------------------------------------------------------ */

interface InputProps {
  records: SuratPenawaran[];
  pelanggan: Pelanggan[];
  editingId: string | null;
  onSave: (p: SuratPenawaran) => void;
  onAddPelanggan: (p: Pelanggan) => void;
  onBack: () => void;
  onToast: (msg: string) => void;
}

type TabKey = 'header' | 'detail' | 'lampiran';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'header', label: 'Header' },
  { key: 'detail', label: 'Detail Item' },
  { key: 'lampiran', label: 'Lampiran' },
];

type ItemDraft = { nama: string; jenisInstalasi: string; satuan: string; qty: string; harga: string };
const emptyDraft = (): ItemDraft => ({ nama: '', jenisInstalasi: JENIS_INSTALASI_SOJO[0] ?? '', satuan: SATUAN_SOJO[0], qty: '1', harga: '' });

const digits = (s: string) => s.replace(/\D/g, '');
const fmtDigits = (s: string) => (s ? new Intl.NumberFormat('id-ID').format(Number(s)) : '');

export function InputPenawaran({ records, pelanggan, editingId, onSave, onAddPelanggan, onBack, onToast }: InputProps) {
  const editing = editingId ? records.find((r) => r.id === editingId) : undefined;
  const [tab, setTab] = useState<TabKey>('header');
  const [addPelOpen, setAddPelOpen] = useState(false);

  const [form, setForm] = useState(() => {
    const tanggal = editing?.tanggal ?? isoToday();
    return {
      tanggal,
      noPenawaran: editing?.noPenawaran ?? suggestNoPenawaran(records, tanggal),
      perihal: editing?.perihal ?? 'Penawaran SLO',
      lampiran: editing?.lampiran ?? '1 (Satu) Lembar',
      up: editing?.up ?? DEFAULT_UP,
      penandatangan: editing?.penandatangan ?? DOC_CONFIG.workOrder.penandatangan.nama,
      tanggalPermintaan: editing?.tanggalPermintaan ?? '',
      pelangganId: editing?.pelangganId ?? '',
      jenisPekerjaan: editing?.jenisPekerjaan ?? JENIS_INSTALASI_SOJO[0] ?? '',
      status: editing?.status ?? 'draft',
      masaBerlaku: String(editing?.masaBerlaku ?? 30),
      ppn: editing?.ppn ?? PENAWARAN_PPN_OPTIONS[0],
      denganHormat: editing?.denganHormat ?? DEFAULT_DENGAN_HORMAT,
      catatan: editing?.catatan ?? DEFAULT_CATATAN,
      caraPembayaran: editing?.caraPembayaran ?? DEFAULT_CARA_PEMBAYARAN,
      dataPersyaratan: editing ? editing.dataPersyaratan ?? '' : DEFAULT_DATA_PERSYARATAN,
    };
  });
  const [items, setItems] = useState<SuratPenawaranItem[]>(editing?.items ?? []);
  const [draft, setDraft] = useState<ItemDraft>(emptyDraft);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const pelOptions = useMemo(
    () =>
      pelanggan
        .map((p) => ({ id: p.id, label: namaPelangganLengkap(p) }))
        .sort((a, b) => a.label.localeCompare(b.label, 'id', { sensitivity: 'base' })),
    [pelanggan],
  );

  const hitung = hitungPenawaran(items, form.ppn);

  const changeTanggal = (v: string) => {
    setForm((f) => ({
      ...f,
      tanggal: v,
      noPenawaran: editing ? f.noPenawaran : suggestNoPenawaran(records, v),
    }));
  };

  /* ---- detail item ---- */
  const submitItem = () => {
    const nama = draft.nama.trim();
    const qty = Number(draft.qty.replace(',', '.'));
    const harga = Number(digits(draft.harga));
    if (!nama) return onToast('Item Name wajib diisi');
    if (!Number.isFinite(qty) || qty <= 0) return onToast('QTY harus lebih dari 0');
    const row: SuratPenawaranItem = {
      id: editingItemId ?? newId('pit'),
      nama,
      jenisInstalasi: draft.jenisInstalasi,
      satuan: draft.satuan,
      qty,
      harga,
    };
    setItems((prev) => (editingItemId ? prev.map((x) => (x.id === editingItemId ? row : x)) : [...prev, row]));
    setDraft(emptyDraft());
    setEditingItemId(null);
  };

  const startEditItem = (it: SuratPenawaranItem) => {
    setEditingItemId(it.id);
    setDraft({ nama: it.nama, jenisInstalasi: it.jenisInstalasi, satuan: it.satuan, qty: String(it.qty), harga: String(it.harga) });
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
    if (editingItemId === id) {
      setEditingItemId(null);
      setDraft(emptyDraft());
    }
  };

  /* ---- simpan ---- */
  const handleSave = () => {
    // Nomor baru selalu dihitung ulang saat disimpan (menghindari bentrok); nomor penawaran yang diedit tetap.
    const no = editing ? form.noPenawaran.trim() : suggestNoPenawaran(records, form.tanggal);
    if (!form.tanggal) return (setTab('header'), onToast('Tanggal SuratPenawaran wajib diisi'));
    if (!no) return (setTab('header'), onToast('No SuratPenawaran wajib diisi'));
    if (records.some((r) => r.id !== editingId && r.noPenawaran.trim().toLowerCase() === no.toLowerCase())) {
      return (setTab('header'), onToast(`No SuratPenawaran ${no} sudah dipakai`));
    }
    const pel = pelanggan.find((p) => p.id === form.pelangganId);
    if (!pel) return (setTab('header'), onToast('Pilih Pelanggan terlebih dahulu'));
    if (editingItemId) return (setTab('detail'), onToast('Selesaikan dulu perubahan item (klik Update) atau hapus item tersebut'));

    const now = new Date().toISOString();
    onSave({
      id: editing?.id ?? newId('pnw'),
      tanggal: form.tanggal,
      noPenawaran: no,
      perihal: form.perihal.trim(),
      lampiran: form.lampiran.trim(),
      up: form.up.trim(),
      penandatangan: form.penandatangan,
      tanggalPermintaan: form.tanggalPermintaan,
      pelangganId: pel.id,
      pelangganNama: namaPelangganLengkap(pel),
      jenisPekerjaan: form.jenisPekerjaan,
      status: form.status,
      masaBerlaku: Math.max(0, Math.round(Number(form.masaBerlaku) || 0)),
      ppn: form.ppn,
      denganHormat: sanitizeHtml(form.denganHormat),
      catatan: sanitizeHtml(form.catatan),
      caraPembayaran: sanitizeHtml(form.caraPembayaran),
      dataPersyaratan: sanitizeHtml(form.dataPersyaratan),
      items,
      createdAt: editing?.createdAt ?? now,
      updatedAt: now,
    });
  };

  const actions = (
    <div className="mt-6 flex items-center gap-2">
      <button type="button" onClick={onBack} className={btnCyan}>
        Back
      </button>
      <button type="button" onClick={handleSave} className={btnViolet}>
        Save
      </button>
    </div>
  );

  return (
    <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-end gap-x-6 px-5 pt-3 bg-violet-50/60 border-b border-slate-200/70">
        <span className="text-sm text-slate-700 pb-3">{editing ? 'Edit SuratPenawaran' : 'Input SuratPenawaran'}</span>
        <div role="tablist" className="flex items-end gap-1">
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

      <div className="p-5 md:p-6">
        {/* ---------------- Header ---------------- */}
        {tab === 'header' && (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-10 gap-y-4">
              <div className="space-y-4">
                <Row label="Tanggal SuratPenawaran">
                  <input type="date" className={inputCls} value={form.tanggal} onChange={(e) => changeTanggal(e.target.value)} />
                </Row>
                <Row
                  label="No SuratPenawaran"
                  hint="Otomatis: urutan/SDP/PNW/bulan (romawi)/tahun mengikuti tanggal surat. Tidak bisa diubah."
                >
                  <input
                    className={`${inputCls} bg-slate-50 text-slate-600 cursor-not-allowed`}
                    value={form.noPenawaran}
                    readOnly
                    aria-readonly="true"
                  />
                </Row>
                <Row label="Perihal (Hal)">
                  <input className={inputCls} value={form.perihal} onChange={(e) => set('perihal', e.target.value)} />
                </Row>
                <Row label="Lampiran">
                  <input className={inputCls} value={form.lampiran} onChange={(e) => set('lampiran', e.target.value)} />
                </Row>
                <Row label="Up" hint="Tercetak setelah alamat: &quot;Up …&quot;">
                  <input className={inputCls} value={form.up} onChange={(e) => set('up', e.target.value)} />
                </Row>
                <Row label="Penandatangan" hint="Tercetak di tanda tangan surat penawaran.">
                  <select className={inputCls} value={form.penandatangan} onChange={(e) => set('penandatangan', e.target.value)}>
                    {DOC_CONFIG.penandatangan.map((p) => (
                      <option key={p.nama} value={p.nama}>
                        {p.nama} — {p.jabatan}
                      </option>
                    ))}
                  </select>
                </Row>
                <Row label="Tanggal Permintaan">
                  <input
                    type="date"
                    className={inputCls}
                    value={form.tanggalPermintaan}
                    onChange={(e) => set('tanggalPermintaan', e.target.value)}
                  />
                </Row>
              </div>

              <div className="space-y-4">
                <Row label="Pelanggan">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <PelangganPicker options={pelOptions} value={form.pelangganId} onChange={(id) => set('pelangganId', id)} />
                    </div>
                    <button
                      type="button"
                      onClick={() => setAddPelOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-400 text-white text-xs font-bold shadow-sm shadow-violet-500/30 cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Pelanggan
                    </button>
                  </div>
                </Row>
                <Row label="Jenis Pekerjaan">
                  <select className={inputCls} value={form.jenisPekerjaan} onChange={(e) => set('jenisPekerjaan', e.target.value)}>
                    {JENIS_INSTALASI_SOJO.map((j) => (
                      <option key={j}>{j}</option>
                    ))}
                  </select>
                </Row>
                <Row label="Status">
                  <select className={inputCls} value={form.status} onChange={(e) => set('status', e.target.value)}>
                    {PENAWARAN_STATUS_OPTIONS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </Row>
                <Row label="Masa Berlaku">
                  <div className="flex items-center gap-3">
                    <input
                      inputMode="numeric"
                      className={inputCls}
                      value={form.masaBerlaku}
                      onChange={(e) => set('masaBerlaku', digits(e.target.value))}
                    />
                    <span className="text-sm text-slate-500">Hari</span>
                  </div>
                </Row>
                <Row label="PPN">
                  <select className={inputCls} value={form.ppn} onChange={(e) => set('ppn', e.target.value)}>
                    {PENAWARAN_PPN_OPTIONS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-400">PPN = tambah 11% pada Jumlah; Non PPN = tanpa PPN.</p>
                </Row>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              <Row label="Paragraf Pembuka" hint="Isi bagian dalam [ ] sebelum dicetak.">
                <RichTextEditor value={form.denganHormat} onChange={(v) => set('denganHormat', v)} minHeight={140} />
              </Row>
              <Row label="Catatan" hint="Daftar bernomor di bawah Terbilang (halaman 1).">
                <RichTextEditor value={form.catatan} onChange={(v) => set('catatan', v)} minHeight={140} />
              </Row>
            </div>
            {actions}
          </>
        )}

        {/* ---------------- Detail Item ---------------- */}
        {tab === 'detail' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1.4fr_1.4fr_1fr_0.7fr_1fr] gap-3">
              <label className="text-xs text-slate-600">
                Item Name
                <input className={`${inputCls} mt-1`} value={draft.nama} onChange={(e) => setDraft((d) => ({ ...d, nama: e.target.value }))} />
              </label>
              <label className="text-xs text-slate-600">
                Jenis Instalasi
                <select
                  className={`${inputCls} mt-1`}
                  value={draft.jenisInstalasi}
                  onChange={(e) => setDraft((d) => ({ ...d, jenisInstalasi: e.target.value }))}
                >
                  {JENIS_INSTALASI_SOJO.map((j) => (
                    <option key={j}>{j}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-600">
                Satuan Harga
                <select className={`${inputCls} mt-1`} value={draft.satuan} onChange={(e) => setDraft((d) => ({ ...d, satuan: e.target.value }))}>
                  {SATUAN_SOJO.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-600">
                QTY
                <input
                  inputMode="decimal"
                  className={`${inputCls} mt-1`}
                  value={draft.qty}
                  onChange={(e) => setDraft((d) => ({ ...d, qty: e.target.value.replace(/[^\d.,]/g, '') }))}
                />
              </label>
              <label className="text-xs text-slate-600">
                Price
                <input
                  inputMode="numeric"
                  className={`${inputCls} mt-1`}
                  value={fmtDigits(digits(draft.harga))}
                  onChange={(e) => setDraft((d) => ({ ...d, harga: digits(e.target.value) }))}
                />
              </label>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <button type="button" onClick={submitItem} className={btnViolet}>
                {editingItemId ? 'Update' : 'Add'}
              </button>
              {editingItemId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingItemId(null);
                    setDraft(emptyDraft());
                  }}
                  className={btnCyan}
                >
                  Batal
                </button>
              )}
            </div>

            <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse min-w-[860px]">
                <thead>
                  <tr className="bg-violet-50/70 text-[11px] font-extrabold uppercase tracking-wider text-slate-800">
                    <th className="px-4 py-3">Item Name</th>
                    <th className="px-4 py-3">Jenis Instalasi</th>
                    <th className="px-4 py-3">Satuan Harga</th>
                    <th className="px-4 py-3 text-right">Price</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="px-4 py-3 text-right">Sub Total</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                        Belum ada item. Isi form di atas lalu klik Add.
                      </td>
                    </tr>
                  )}
                  {items.map((it) => (
                    <tr key={it.id} className="border-t border-slate-100 text-sm text-slate-700 align-top">
                      <td className="px-4 py-3.5">{it.nama}</td>
                      <td className="px-4 py-3.5">{it.jenisInstalasi}</td>
                      <td className="px-4 py-3.5">{it.satuan}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums">{rp(it.harga)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums">{nf.format(it.qty)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums">{rp(it.qty * it.harga)}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-1.5 w-fit">
                          <button
                            type="button"
                            title="Ubah"
                            aria-label={`Ubah ${it.nama}`}
                            onClick={() => startEditItem(it)}
                            className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-sky-400 text-white flex items-center justify-center cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            title="Hapus"
                            aria-label={`Hapus ${it.nama}`}
                            onClick={() => removeItem(it.id)}
                            className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-rose-400 text-white flex items-center justify-center cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {[
                    ['Jumlah', hitung.jumlah],
                    [hitung.rate ? `PPN ${hitung.rate}%` : 'PPN (Non PPN)', hitung.ppn],
                    ['Jumlah Total', hitung.total],
                  ].map(([label, val], i) => (
                    <tr key={label as string} className={`${i === 0 ? 'border-t border-slate-200 ' : ''}text-sm font-bold text-slate-800`}>
                      <td colSpan={5} className="px-4 py-2.5 text-right">
                        {label}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{rp(val as number)}</td>
                      <td />
                    </tr>
                  ))}
                  <tr className="text-xs text-slate-600">
                    <td colSpan={7} className="px-4 pb-3 text-right">
                      Terbilang: <span className="font-semibold">{terbilangRupiah(hitung.total)}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            {actions}
          </>
        )}

        {/* ---------------- Lampiran ---------------- */}
        {tab === 'lampiran' && (
          <>
            <div className="space-y-5">
              <Row label="Persyaratan SLO Pembangkit" hint='Halaman 2. Judul "Persyaratan SLO Pembangkit:" tercetak otomatis; isi daftar & cara pembayaran di sini.'>
                <RichTextEditor value={form.caraPembayaran} onChange={(v) => set('caraPembayaran', v)} minHeight={260} />
              </Row>
              <Row label="Data Uji Laik Operasi" hint="Halaman 2. Daftar data yang disediakan Kontraktor/Pemilik Instalasi.">
                <RichTextEditor value={form.dataPersyaratan} onChange={(v) => set('dataPersyaratan', v)} minHeight={200} />
              </Row>
            </div>
            {actions}
          </>
        )}
      </div>

      {addPelOpen && (
        <AddPelangganModal
          records={pelanggan}
          onClose={() => setAddPelOpen(false)}
          onToast={onToast}
          onSave={(p) => {
            onAddPelanggan(p);
            set('pelangganId', p.id);
            setAddPelOpen(false);
            onToast(`Pelanggan "${namaPelangganLengkap(p)}" ditambahkan`);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Data SuratPenawaran                                                      */
/* ------------------------------------------------------------------ */

interface DataProps {
  records: SuratPenawaran[];
  pelanggan: Pelanggan[];
  signatures?: Record<string, string>;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onToast: (msg: string) => void;
}

type SortKey = 'no' | 'tanggal' | 'vendor' | 'nomor';
const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'no', label: 'No' },
  { key: 'tanggal', label: 'Tanggal' },
  { key: 'vendor', label: 'Vendor' },
  { key: 'nomor', label: 'No SuratPenawaran' },
];
const PAGE_SIZES = [10, 25, 50, 100];

export function DataPenawaran({ records, pelanggan, signatures, onEdit, onDelete, onDuplicate, onToast }: DataProps) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'no', dir: 'asc' });
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [printId, setPrintId] = useState<string | null>(null);

  const vendorOf = (r: SuratPenawaran) => {
    const p = pelanggan.find((x) => x.id === r.pelangganId);
    return p ? namaPelangganLengkap(p) : r.pelangganNama;
  };

  const rows = useMemo(() => {
    const base = records.map((r, i) => ({ r, no: i + 1, vendor: vendorOf(r) }));
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? base.filter((x) => [x.r.noPenawaran, x.vendor, tglPanjang(x.r.tanggal), x.r.perihal].join(' ').toLowerCase().includes(needle))
      : base;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sort.key === 'no') return (a.no - b.no) * dir;
      if (sort.key === 'tanggal') return a.r.tanggal.localeCompare(b.r.tanggal) * dir;
      const va = sort.key === 'vendor' ? a.vendor : a.r.noPenawaran;
      const vb = sort.key === 'vendor' ? b.vendor : b.r.noPenawaran;
      return va.localeCompare(vb, 'id', { numeric: true, sensitivity: 'base' }) * dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, pelanggan, q, sort]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const cur = Math.min(page, totalPages);
  const start = (cur - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);
  const printRec = printId ? records.find((r) => r.id === printId) : undefined;

  const toggleSort = (key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
    setPage(1);
  };

  const iconBtn = 'w-8 h-8 rounded-lg text-white flex items-center justify-center cursor-pointer';

  return (
    <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="px-5 py-4 bg-violet-50/60 border-b border-slate-200/70 text-sm text-slate-700">Data SuratPenawaran</div>

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
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left border-collapse min-w-[820px]">
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
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
                    {records.length === 0 ? 'Belum ada penawaran. Tambahkan lewat menu Input SuratPenawaran.' : 'Tidak ada data yang cocok.'}
                  </td>
                </tr>
              ) : (
                pageRows.map((x) => (
                  <tr key={x.r.id} className="border-t border-slate-100 hover:bg-slate-50/70 text-sm text-slate-700">
                    <td className="px-4 py-4 tabular-nums">{x.no}</td>
                    <td className="px-4 py-4 whitespace-nowrap">{tglPanjang(x.r.tanggal)}</td>
                    <td className="px-4 py-4">{x.vendor}</td>
                    <td className="px-4 py-4 whitespace-nowrap">{x.r.noPenawaran}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1.5 w-fit">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            title="Cetak / PDF"
                            aria-label={`Cetak ${x.r.noPenawaran}`}
                            onClick={() => setPrintId(x.r.id)}
                            className={`${iconBtn} bg-gradient-to-br from-violet-500 to-purple-400`}
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            title="Ubah"
                            aria-label={`Ubah ${x.r.noPenawaran}`}
                            onClick={() => onEdit(x.r.id)}
                            className={`${iconBtn} bg-gradient-to-br from-cyan-500 to-sky-400`}
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            title="Hapus"
                            aria-label={`Hapus ${x.r.noPenawaran}`}
                            onClick={() => {
                              if (window.confirm(`Hapus penawaran "${x.r.noPenawaran}"? Tindakan ini tidak bisa dibatalkan.`)) onDelete(x.r.id);
                            }}
                            className={`${iconBtn} bg-gradient-to-br from-red-500 to-rose-400`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => onDuplicate(x.r.id)}
                          className="inline-flex items-center justify-center gap-1.5 h-8 px-4 rounded-lg bg-gradient-to-br from-cyan-500 to-sky-400 text-white text-xs font-bold cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" /> Duplicate
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
          <span>{rows.length === 0 ? 'Menampilkan 0 data' : `Menampilkan ${start + 1}–${start + pageRows.length} dari ${rows.length} data`}</span>
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

      {printRec && (
        <PenawaranModal
          record={printRec}
          pelanggan={pelanggan.find((p) => p.id === printRec.pelangganId)}
          signatures={signatures}
          onClose={() => setPrintId(null)}
          onToast={onToast}
        />
      )}
    </div>
  );
}
