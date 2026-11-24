import React, { useState } from 'react';
import { Download, FileText, HardHat, Plus, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { CAT_K3, CAT_SKTTK, CompanyDoc, Inspector, MAX_FILE_BYTES } from '../types/portal';
import {
  certStatus,
  formatFileSize,
  hasK3,
  inspectorLocked,
  k3Status,
} from '../utils/portalUtils';
import {
  blobToDataUrl,
  getVaultFile,
  putVaultFile,
  triggerDataUrlDownload,
} from '../utils/fileVault';

export type CertKind = 'skttk' | 'k3';

interface Props {
  canEdit: boolean;
  userName: string;
  inspectors: Inspector[];
  companyDocs: CompanyDoc[];
  onUpdateInspector: (id: string, patch: Partial<Inspector>) => void;
  onAddInspector: (ins: Inspector, docs: CompanyDoc[]) => void;
  onAttachCertDoc: (inspectorId: string, kind: CertKind, doc: CompanyDoc) => void;
  onRemoveCertDoc: (inspectorId: string, kind: CertKind) => void;
  onToast: (msg: string) => void;
  /** Disisipkan di antara tabel sertifikat dan form tambah (mis. database tanda tangan). */
  middle?: React.ReactNode;
}

const BADGE_CLASSES: Record<'ok' | 'info' | 'warn' | 'crit', string> = {
  ok: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  info: 'bg-sky-50 text-sky-700 border border-sky-200',
  warn: 'bg-amber-50 text-amber-800 border border-amber-200',
  crit: 'bg-red-50 text-red-700 border border-red-200',
};

const ACCEPT = '.pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg';
const inputCls = 'w-full h-9 rounded-lg border border-slate-200 px-2.5 text-sm';
const dateCls =
  'h-8 rounded-lg border border-slate-200 px-2 text-xs disabled:bg-slate-50 disabled:text-slate-600';

/** Simpan file sertifikat ke brankas (Drive + lokal) dan buat entri Inventaris yang tertaut ke inspektor. */
async function storeCertFile(
  file: File,
  inspector: { id: string; nama: string },
  kind: CertKind,
  userName: string
): Promise<{ doc: CompanyDoc; synced: boolean }> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`${file.name} melebihi batas 5 MB (${formatFileSize(file.size)})`);
  }
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
    folder: 'skttk', // database Sertifikat Kompetensi & K3 (folder "7." di Drive)
  });
  const category = kind === 'skttk' ? CAT_SKTTK : CAT_K3;
  const doc: CompanyDoc = {
    id,
    category,
    title: `${category} – ${inspector.nama}`,
    note: '',
    vaultFileId: id,
    name: file.name,
    size: file.size,
    mimeType,
    uploadedAt: nowIso,
    uploadedBy: userName,
    inspectorId: inspector.id,
    certType: kind,
  };
  return { doc, synced };
}

function CertFileCell({
  doc,
  canEdit,
  busy,
  onPick,
  onDownload,
  onRemove,
}: {
  doc?: CompanyDoc;
  canEdit: boolean;
  busy: boolean;
  onPick: (file: File) => void;
  onDownload: () => void;
  onRemove: () => void;
}) {
  const pick = (
    <input
      type="file"
      accept={ACCEPT}
      className="hidden"
      disabled={busy}
      onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (f) onPick(f);
      }}
    />
  );
  if (!doc) {
    return canEdit ? (
      <label className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-dashed border-blue-300 text-blue-700 hover:bg-blue-50 text-[11px] font-semibold cursor-pointer">
        <Upload className="w-3.5 h-3.5" /> {busy ? 'Mengunggah…' : 'Unggah file'}
        {pick}
      </label>
    ) : (
      <span className="text-[11px] text-slate-400">Belum ada file</span>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <FileText className="w-4 h-4 text-blue-600 shrink-0" />
      <span className="max-w-[130px] truncate text-[11px] text-slate-700" title={doc.name}>
        {doc.name}
      </span>
      <button
        type="button"
        onClick={onDownload}
        title="Unduh file"
        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer"
      >
        <Download className="w-3.5 h-3.5" />
      </button>
      {canEdit && (
        <>
          <label
            title="Ganti file"
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            {pick}
          </label>
          <button
            type="button"
            onClick={onRemove}
            title="Hapus file"
            className="p-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-700 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </div>
  );
}

function StatusBadge({ locked }: { locked: boolean }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${
        locked ? BADGE_CLASSES.crit : BADGE_CLASSES.ok
      }`}
    >
      {locked ? 'Terkunci' : 'Dapat ditugaskan'}
    </span>
  );
}

export function PersonelSertifikat({
  canEdit,
  userName,
  inspectors,
  companyDocs,
  onUpdateInspector,
  onAddInspector,
  onAttachCertDoc,
  onRemoveCertDoc,
  onToast,
  middle,
}: Props) {
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // Form: tambah inspektor baru (SKTTK wajib, K3 opsional)
  const [iNama, setINama] = useState('');
  const [sReg, setSReg] = useState('');
  const [sDate, setSDate] = useState('');
  const [sFile, setSFile] = useState<File | null>(null);
  const [kReg, setKReg] = useState('');
  const [kDate, setKDate] = useState('');
  const [kFile, setKFile] = useState<File | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [saving, setSaving] = useState(false);

  // Form: lengkapi K3 untuk inspektor yang sudah terdaftar
  const [k3InsId, setK3InsId] = useState('');
  const [k3Reg, setK3Reg] = useState('');
  const [k3Date, setK3Date] = useState('');
  const [k3File, setK3File] = useState<File | null>(null);
  const [k3FormKey, setK3FormKey] = useState(0);

  const docOf = (id?: string) => (id ? companyDocs.find((d) => d.id === id) : undefined);
  const withK3 = inspectors.filter(hasK3);
  const withoutK3 = inspectors.filter((i) => !hasK3(i));

  const download = async (doc: CompanyDoc) => {
    const rec = await getVaultFile(doc.vaultFileId);
    if (!rec) {
      onToast('Berkas tidak ditemukan di server maupun perangkat ini');
      return;
    }
    triggerDataUrlDownload(rec.dataUrl, doc.name);
  };

  const uploadFor = async (ins: Inspector, kind: CertKind, file: File) => {
    const key = `${ins.id}-${kind}`;
    setBusyKey(key);
    try {
      const { doc, synced } = await storeCertFile(file, ins, kind, userName);
      onAttachCertDoc(ins.id, kind, doc);
      if (!synced) onToast('File tersimpan di perangkat ini saja — server dokumen tidak terjangkau');
      else onToast(`File ${kind === 'skttk' ? 'SKTTK' : 'K3'} ${ins.nama} tersimpan dan muncul di Inventaris`);
    } catch (err: unknown) {
      onToast(err instanceof Error ? err.message : 'Gagal mengunggah file');
    } finally {
      setBusyKey(null);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!iNama.trim() || !sDate) {
      onToast('Lengkapi nama inspektor dan tanggal berlaku SKTTK');
      return;
    }
    const hasK3Input = Boolean(kReg.trim() || kDate || kFile);
    if (hasK3Input && !kDate) {
      onToast('Isi tanggal berlaku K3, atau kosongkan seluruh isian K3 bila inspektor tidak memiliki K3');
      return;
    }
    setSaving(true);
    try {
      const id = `i-${Date.now()}`;
      const nama = iNama.trim();
      const docs: CompanyDoc[] = [];
      const ins: Inspector = {
        id,
        nama,
        noReg: sReg.trim() || '-',
        serkom: sDate,
        k3: kDate || '',
        k3NoReg: kDate ? kReg.trim() || '-' : undefined,
      };
      let allSynced = true;
      if (sFile) {
        const r = await storeCertFile(sFile, { id, nama }, 'skttk', userName);
        ins.serkomDocId = r.doc.id;
        docs.push(r.doc);
        allSynced = allSynced && r.synced;
      }
      if (kDate && kFile) {
        const r = await storeCertFile(kFile, { id, nama }, 'k3', userName);
        ins.k3DocId = r.doc.id;
        docs.push(r.doc);
        allSynced = allSynced && r.synced;
      }
      onAddInspector(ins, docs);
      if (!allSynced) onToast('File tersimpan di perangkat ini saja — server dokumen tidak terjangkau');
      setINama('');
      setSReg('');
      setSDate('');
      setSFile(null);
      setKReg('');
      setKDate('');
      setKFile(null);
      setFormKey((k) => k + 1);
      onToast('Inspektor berhasil ditambahkan');
    } catch (err: unknown) {
      onToast(err instanceof Error ? err.message : 'Gagal menyimpan inspektor');
    } finally {
      setSaving(false);
    }
  };

  const handleAddK3 = async (e: React.FormEvent) => {
    e.preventDefault();
    const ins = inspectors.find((i) => i.id === k3InsId);
    if (!ins || !k3Date) {
      onToast('Pilih inspektor dan isi tanggal berlaku K3');
      return;
    }
    setSaving(true);
    try {
      let doc: CompanyDoc | null = null;
      let synced = true;
      if (k3File) {
        const r = await storeCertFile(k3File, ins, 'k3', userName);
        doc = r.doc;
        synced = r.synced;
      }
      onUpdateInspector(ins.id, { k3: k3Date, k3NoReg: k3Reg.trim() || '-' });
      if (doc) onAttachCertDoc(ins.id, 'k3', doc);
      if (!synced) onToast('File tersimpan di perangkat ini saja — server dokumen tidak terjangkau');
      setK3InsId('');
      setK3Reg('');
      setK3Date('');
      setK3File(null);
      setK3FormKey((k) => k + 1);
      onToast(`Sertifikat K3 ${ins.nama} ditambahkan`);
    } catch (err: unknown) {
      onToast(err instanceof Error ? err.message : 'Gagal menyimpan sertifikat K3');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* ===== TABEL 1: Sertifikat Kompetensi (SKTTK) ===== */}
      <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          <h3 className="font-display text-base font-bold text-slate-900">
            Personel Inspektor &amp; Sertifikat Kompetensi (SKTTK)
          </h3>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left border-collapse min-w-[860px]">
            <thead>
              <tr className="bg-[#0F1E3D] text-white text-[11px] uppercase tracking-wider">
                <th className="py-2.5 px-3.5">Nama</th>
                <th className="py-2.5 px-3.5">No. Registrasi</th>
                <th className="py-2.5 px-3.5">Sertifikat Kompetensi (SKTTK) s.d.</th>
                <th className="py-2.5 px-3.5">Status</th>
                <th className="py-2.5 px-3.5">File</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {inspectors.map((i) => {
                const a = certStatus(i.serkom);
                const doc = docOf(i.serkomDocId);
                return (
                  <tr key={i.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3.5 font-semibold text-slate-900">{i.nama}</td>
                    <td className="py-2.5 px-3.5 font-mono text-slate-600">{i.noReg}</td>
                    <td className="py-2.5 px-3.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={i.serkom}
                          disabled={!canEdit}
                          onChange={(e) => onUpdateInspector(i.id, { serkom: e.target.value })}
                          className={dateCls}
                        />
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${BADGE_CLASSES[a.k]}`}
                        >
                          {a.t}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3.5">
                      <StatusBadge locked={inspectorLocked(i)} />
                    </td>
                    <td className="py-2.5 px-3.5">
                      <CertFileCell
                        doc={doc}
                        canEdit={canEdit}
                        busy={busyKey === `${i.id}-skttk`}
                        onPick={(f) => void uploadFor(i, 'skttk', f)}
                        onDownload={() => doc && void download(doc)}
                        onRemove={() => onRemoveCertDoc(i.id, 'skttk')}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== TABEL 2: Sertifikat K3 (di bawah SKTTK, hanya yang memiliki K3) ===== */}
      <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-1">
          <HardHat className="w-4 h-4 text-blue-600" />
          <h3 className="font-display text-base font-bold text-slate-900">Sertifikat K3</h3>
        </div>
        <p className="text-[11px] text-slate-500 mb-4">
          Tidak semua inspektor memiliki sertifikat K3. Inspektor tanpa K3 tidak tampil di tabel ini dan tidak
          terkunci karena K3.
          {withoutK3.length > 0 && ` Saat ini ${withoutK3.length} inspektor belum memiliki K3.`}
        </p>
        {withK3.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center rounded-xl border border-dashed border-slate-200">
            Belum ada inspektor dengan sertifikat K3.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse min-w-[860px]">
              <thead>
                <tr className="bg-[#0F1E3D] text-white text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-3.5">Nama</th>
                  <th className="py-2.5 px-3.5">No. Registrasi</th>
                  <th className="py-2.5 px-3.5">Sertifikat K3 s.d.</th>
                  <th className="py-2.5 px-3.5">Status</th>
                  <th className="py-2.5 px-3.5">File</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {withK3.map((i) => {
                  const b = k3Status(i)!;
                  const doc = docOf(i.k3DocId);
                  return (
                    <tr key={i.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3.5 font-semibold text-slate-900">{i.nama}</td>
                      <td className="py-2.5 px-3.5">
                        {canEdit ? (
                          <input
                            key={`${i.id}-${i.k3NoReg || ''}`}
                            defaultValue={i.k3NoReg && i.k3NoReg !== '-' ? i.k3NoReg : ''}
                            placeholder="No. registrasi K3"
                            onBlur={(e) => {
                              const v = e.target.value.trim() || '-';
                              if (v !== (i.k3NoReg || '-')) onUpdateInspector(i.id, { k3NoReg: v });
                            }}
                            className="h-8 w-40 rounded-lg border border-slate-200 px-2 text-xs font-mono"
                          />
                        ) : (
                          <span className="font-mono text-slate-600">{i.k3NoReg || '-'}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={i.k3}
                            disabled={!canEdit}
                            onChange={(e) => onUpdateInspector(i.id, { k3: e.target.value })}
                            className={dateCls}
                          />
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${BADGE_CLASSES[b.k]}`}
                          >
                            {b.t}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3.5">
                        <StatusBadge locked={inspectorLocked(i)} />
                      </td>
                      <td className="py-2.5 px-3.5">
                        <CertFileCell
                          doc={doc}
                          canEdit={canEdit}
                          busy={busyKey === `${i.id}-k3`}
                          onPick={(f) => void uploadFor(i, 'k3', f)}
                          onDownload={() => doc && void download(doc)}
                          onRemove={() => onRemoveCertDoc(i.id, 'k3')}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-slate-500 mt-3">
          Semua file SKTTK dan K3 yang diunggah tersimpan di database Sertifikat Kompetensi &amp; K3 dan otomatis
          muncul di menu <b>Inventaris Perusahaan</b> (cari “sertifikat kompetensi” atau “K3”).
        </p>
      </div>

      {middle}

      {/* ===== FORM: tambah inspektor — input SKTTK dan K3 dipisah ===== */}
      {canEdit && (
        <form
          key={formKey}
          onSubmit={(e) => void handleAdd(e)}
          className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs space-y-4"
        >
          <h3 className="font-display text-sm font-bold text-slate-900">Tambah Inspektor</h3>

          <div className="max-w-md">
            <label className="block text-xs text-slate-500 mb-1">Nama Lengkap</label>
            <input value={iNama} onChange={(e) => setINama(e.target.value)} className={inputCls} />
          </div>

          <div className="rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" /> Sertifikat Kompetensi (SKTTK)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">No. Registrasi SKTTK</label>
                <input value={sReg} onChange={(e) => setSReg(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">SKTTK Berlaku s.d.</label>
                <input
                  type="date"
                  value={sDate}
                  onChange={(e) => setSDate(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Upload File SKTTK (PDF/JPG/PNG, maks. 5 MB)</label>
                <input
                  type="file"
                  accept={ACCEPT}
                  onChange={(e) => setSFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-semibold"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <HardHat className="w-3.5 h-3.5 text-blue-600" /> Sertifikat K3{' '}
              <span className="font-medium text-slate-500">(opsional — kosongkan bila tidak memiliki)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">No. Registrasi K3</label>
                <input value={kReg} onChange={(e) => setKReg(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">K3 Berlaku s.d.</label>
                <input
                  type="date"
                  value={kDate}
                  onChange={(e) => setKDate(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Upload File K3 (PDF/JPG/PNG, maks. 5 MB)</label>
                <input
                  type="file"
                  accept={ACCEPT}
                  onChange={(e) => setKFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-semibold"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-60 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> {saving ? 'Menyimpan…' : 'Simpan Inspektor'}
          </button>
        </form>
      )}

      {/* ===== FORM: lengkapi K3 untuk inspektor yang sudah terdaftar ===== */}
      {canEdit && withoutK3.length > 0 && (
        <form
          key={`k3-${k3FormKey}`}
          onSubmit={(e) => void handleAddK3(e)}
          className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs space-y-3"
        >
          <h3 className="font-display text-sm font-bold text-slate-900">
            Tambah Sertifikat K3 untuk Inspektor Terdaftar
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Inspektor</label>
              <select
                value={k3InsId}
                onChange={(e) => setK3InsId(e.target.value)}
                className={`${inputCls} bg-white`}
              >
                <option value="">Pilih inspektor…</option>
                {withoutK3.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nama}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">No. Registrasi K3</label>
              <input value={k3Reg} onChange={(e) => setK3Reg(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">K3 Berlaku s.d.</label>
              <input
                type="date"
                value={k3Date}
                onChange={(e) => setK3Date(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Upload File K3</label>
              <input
                type="file"
                accept={ACCEPT}
                onChange={(e) => setK3File(e.target.files?.[0] || null)}
                className="block w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-semibold"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-60 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Simpan Sertifikat K3
          </button>
        </form>
      )}
    </>
  );
}

