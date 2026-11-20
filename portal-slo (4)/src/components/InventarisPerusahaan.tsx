import { useMemo, useState } from 'react';
import { Download, FileText, FolderArchive, Search, Trash2, Upload } from 'lucide-react';
import {
  COMPANY_DOC_CATEGORIES,
  CompanyDoc,
  MAX_FILE_BYTES,
  Role,
} from '../types/portal';
import { formatDateTime, formatFileSize } from '../utils/portalUtils';
import {
  blobToDataUrl,
  deleteVaultFile,
  getVaultFile,
  putVaultFile,
  triggerDataUrlDownload,
} from '../utils/fileVault';

interface Props {
  role: Role;
  userName: string;
  docs: CompanyDoc[];
  onAdd: (doc: CompanyDoc) => void;
  onDelete: (id: string) => void;
  onToast: (msg: string) => void;
}

export function InventarisPerusahaan({ role, userName, docs, onAdd, onDelete, onToast }: Props) {
  const canManage = role === 'teknis'; // Admin mengelola; peran lain hanya melihat & mengunduh
  const [category, setCategory] = useState(COMPANY_DOC_CATEGORIES[0]);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [filterCat, setFilterCat] = useState('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return docs.filter(
      (d) =>
        (filterCat === 'all' || d.category === filterCat) &&
        (!q ||
          d.title.toLowerCase().includes(q) ||
          d.name.toLowerCase().includes(q) ||
          d.note.toLowerCase().includes(q))
    );
  }, [docs, query, filterCat]);

  const upload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      onToast(`${file.name} melebihi batas 5 MB (${formatFileSize(file.size)})`);
      return;
    }
    setBusy(true);
    try {
      const nowIso = new Date().toISOString();
      const id = `cdoc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const mimeType =
        file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');
      const dataUrl = await blobToDataUrl(file);
      const synced = await putVaultFile({
        id,
        name: file.name,
        mimeType,
        size: file.size,
        dataUrl,
        savedAt: nowIso,
        folder: category.startsWith('SKTTK') ? 'skttk' : 'inventaris',
      });
      if (!synced) onToast('Dokumen tersimpan di perangkat ini saja — server dokumen tidak terjangkau');
      onAdd({
        id,
        category,
        title: title.trim() || file.name,
        note: note.trim(),
        vaultFileId: id,
        name: file.name,
        size: file.size,
        mimeType,
        uploadedAt: nowIso,
        uploadedBy: userName,
      });
      setTitle('');
      setNote('');
      onToast(`Dokumen "${title.trim() || file.name}" ditambahkan ke Inventaris`);
    } catch (err: unknown) {
      onToast(err instanceof Error ? err.message : 'Gagal mengunggah dokumen');
    } finally {
      setBusy(false);
    }
  };

  const download = async (d: CompanyDoc) => {
    const rec = await getVaultFile(d.vaultFileId);
    if (!rec) {
      onToast('Berkas tidak ditemukan di server maupun perangkat ini');
      return;
    }
    triggerDataUrlDownload(rec.dataUrl, d.name);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center">
            <FolderArchive className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">Inventaris Perusahaan</h2>
            <p className="text-xs text-slate-500">
              Dokumen resmi PT. Sabda Duta Paramitha: legalitas, perizinan, sertifikat, SOP, template dan
              kontrak.
              {canManage ? ' Admin dapat menambah dan menghapus dokumen.' : ' Anda dapat melihat dan mengunduh.'}
            </p>
          </div>
        </div>
        <span className="px-3 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">
          {docs.length} dokumen
        </span>
      </div>

      {canManage && (
        <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs space-y-3">
          <h3 className="font-display text-sm font-bold text-slate-900">Tambah Dokumen Perusahaan</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Kategori</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm bg-white"
              >
                {COMPANY_DOC_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Judul Dokumen</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Sertifikat Akreditasi KAN LIT"
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Keterangan (opsional, mis. masa berlaku)
              </label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Berlaku s/d 12 Desember 2027"
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
              />
            </div>
          </div>
          <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer">
            <Upload className="w-4 h-4" /> {busy ? 'Mengunggah…' : 'Pilih Berkas & Unggah (maks. 5 MB)'}
            <input
              type="file"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                void upload(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      )}

      <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari dokumen…"
              className="w-full h-10 rounded-xl border border-slate-200 pl-9 pr-3 text-sm"
            />
          </div>
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 px-3 text-sm bg-white"
          >
            <option value="all">Semua kategori</option>
            {COMPANY_DOC_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">
            {docs.length === 0
              ? 'Belum ada dokumen perusahaan di inventaris.'
              : 'Tidak ada dokumen yang cocok dengan pencarian.'}
          </p>
        ) : (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {filtered.map((d) => (
              <div key={d.id} className="p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="font-bold text-sm text-slate-900">{d.title}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">
                      {d.category}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {d.name} · {formatFileSize(d.size)} · {d.uploadedBy} · {formatDateTime(d.uploadedAt)}
                  </div>
                  {d.note && <div className="text-xs text-slate-600 mt-0.5">{d.note}</div>}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void download(d)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Unduh
                  </button>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => {
                        void deleteVaultFile(d.vaultFileId);
                        onDelete(d.id);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Hapus
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
