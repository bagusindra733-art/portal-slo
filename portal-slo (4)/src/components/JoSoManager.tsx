import React, { useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  Download,
  Edit3,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Link2,
  Lock,
  Plus,
  Search,
  Send,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  JENIS_INSTALASI_SOJO,
  JoSoDetailItem,
  JoSoDocument,
  JoSoRecord,
  JoSoStatus,
  Project,
  Role,
  SATUAN_SOJO,
  SalesReadiness,
  STATUS_SOJO_LIST,
} from '../types/portal';
import {
  calcJoSoTotals,
  downloadTextFile,
  formatDateShort,
  formatDateTime,
  formatDecimalId,
  formatFileSize,
  formatRupiah,
  isoToday,
  prepFile,
  SALES_READINESS_LABEL,
} from '../utils/portalUtils';

interface JoSoManagerProps {
  role: Role;
  records: JoSoRecord[];
  projects: Project[];
  initialEditId?: string | null;
  onClearInitialEditId?: () => void;
  onSaveRecord: (record: JoSoRecord, syncMode: 'auto' | 'none') => void;
  onDeleteRecord: (id: string) => void;
  onOpenProject: (projectId: string) => void;
  onCreateSuratTugasFromJoSo: (record: JoSoRecord) => void;
  onToast: (msg: string) => void;
}

type EditorTab = 'penawaran' | 'joso' | 'document';

const STATUS_BADGE: Record<JoSoStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  submit: 'bg-sky-50 text-sky-700 border-sky-200',
  approved: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  in_progress: 'bg-amber-50 text-amber-800 border-amber-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
};

function createEmptyRecord(): JoSoRecord {
  const today = isoToday();
  const exp = new Date();
  exp.setMonth(exp.getMonth() + 3);
  const expIso = exp.toISOString().slice(0, 10);
  return {
    id: `joso-${Date.now()}`,
    tanggalPenawaran: today,
    noPenawaran: '',
    perihal: 'Penawaran SLO',
    lampiran: '1 (Satu) Lembar',
    tanggalPermintaan: today,
    kepadaAlamat: '',
    jenisInstalasiPenawaran: JENIS_INSTALASI_SOJO[0],
    status: 'submit',
    masaBerlaku: 30,
    ppnRate: 11,
    items: [
      {
        id: `it-${Date.now()}`,
        itemName: '',
        satuan: 'Unit',
        price: 0,
        qty: 1,
      },
    ],
    poNo: '',
    title: '',
    poDate: today,
    poExpiredDate: expIso,
    dp: 50,
    pelangganAlamat: '',
    jenisInstalasiJo: JENIS_INSTALASI_SOJO[5],
    paymentTerm: 'DP 50, PL 50',
    documents: [],
    updatedAt: new Date().toISOString(),
  };
}

export function JoSoManager({
  role,
  records,
  projects,
  initialEditId,
  onClearInitialEditId,
  onSaveRecord,
  onDeleteRecord,
  onOpenProject,
  onCreateSuratTugasFromJoSo,
  onToast,
}: JoSoManagerProps) {
  const [editingRecord, setEditingRecord] = useState<JoSoRecord | null>(null);
  const [editorTab, setEditorTab] = useState<EditorTab>('penawaran');
  const [syncWithProject, setSyncWithProject] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Document upload draft inside Tab 3
  const [docNameInput, setDocNameInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  const clientPresets = useMemo(() => {
    const set = new Set<string>([
      'PT. Indonesia Morowali Industrial Park | Gedung IMIP, Jl. Batu Mulia 8, RT. 007 RW.007 Kel. Maruya Utara Kec. Kembangan Kota Adm Jakarta Barat',
    ]);
    projects.forEach((p) => {
      if (p.perusahaan) {
        set.add(`${p.perusahaan} | ${p.kota}`);
      }
    });
    records.forEach((r) => {
      if (r.kepadaAlamat) set.add(r.kepadaAlamat);
      if (r.pelangganAlamat) set.add(r.pelangganAlamat);
    });
    return Array.from(set);
  }, [projects, records]);

  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      if (statusFilter !== 'all' && rec.status !== statusFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        rec.noPenawaran.toLowerCase().includes(q) ||
        rec.poNo.toLowerCase().includes(q) ||
        rec.title.toLowerCase().includes(q) ||
        rec.kepadaAlamat.toLowerCase().includes(q) ||
        rec.pelangganAlamat.toLowerCase().includes(q) ||
        rec.jenisInstalasiPenawaran.toLowerCase().includes(q)
      );
    });
  }, [records, searchQuery, statusFilter]);

  const recapStats = useMemo(() => {
    let totalValue = 0;
    let totalDocs = 0;
    let activeCount = 0;
    records.forEach((r) => {
      totalValue += calcJoSoTotals(r).total;
      totalDocs += r.documents.length;
      if (['submit', 'approved', 'in_progress', 'completed'].includes(r.status)) {
        activeCount += 1;
      }
    });
    return {
      totalCount: records.length,
      totalValue,
      activeCount,
      totalDocs,
    };
  }, [records]);

  const openEditor = (rec: JoSoRecord, tab: EditorTab = 'penawaran') => {
    setEditingRecord(JSON.parse(JSON.stringify(rec)) as JoSoRecord);
    setEditorTab(tab);
    setSyncWithProject(true);
    setDocNameInput('');
    setSelectedFile(null);
    setFileInputKey((k) => k + 1);
  };

  useEffect(() => {
    if (!initialEditId) return;
    const found = records.find((r) => r.id === initialEditId);
    if (found) {
      openEditor(found, 'penawaran');
    }
    onClearInitialEditId?.();
  }, [initialEditId, records, onClearInitialEditId]);

  const handleSave = (sendToAdmin = false) => {
    if (!editingRecord) return;
    if (!editingRecord.noPenawaran.trim() && !editingRecord.poNo.trim() && !editingRecord.title.trim()) {
      onToast('Isi minimal No Penawaran, PO No, atau Title sebelum menyimpan');
      return;
    }
    if (sendToAdmin && !editingRecord.poNo.trim()) {
      onToast('Isi PO No terlebih dahulu sebelum mengirim status pekerjaan ke Admin');
      setEditorTab('joso');
      return;
    }
    const nowIso = new Date().toISOString();
    const readiness: SalesReadiness | undefined = sendToAdmin
      ? editingRecord.salesReadiness || 'ready_wait_dp'
      : editingRecord.salesReadiness;
    const cleaned: JoSoRecord = {
      ...editingRecord,
      pelangganAlamat: editingRecord.pelangganAlamat.trim() || editingRecord.kepadaAlamat.trim(),
      kepadaAlamat: editingRecord.kepadaAlamat.trim() || editingRecord.pelangganAlamat.trim(),
      salesReadiness: readiness,
      sentToAdminAt: sendToAdmin ? nowIso : editingRecord.sentToAdminAt,
      status: sendToAdmin && editingRecord.status === 'draft' ? 'submit' : editingRecord.status,
      updatedAt: nowIso,
    };
    const effectiveSync: 'auto' | 'none' = sendToAdmin ? 'auto' : syncWithProject ? 'auto' : 'none';
    onSaveRecord(cleaned, effectiveSync);
    setEditingRecord(null);
    if (sendToAdmin && readiness) {
      onToast(
        `PO "${cleaned.poNo}" disimpan & pesan "${SALES_READINESS_LABEL[readiness]}" dikirim ke Admin Teknis`
      );
    } else {
      onToast(
        effectiveSync === 'auto'
          ? `Data SO/JO "${cleaned.title || cleaned.noPenawaran || cleaned.poNo}" disimpan & disinkronkan ke Menu Pekerjaan`
          : `Data SO/JO "${cleaned.title || cleaned.noPenawaran || cleaned.poNo}" disimpan ke Rekap SO/JO`
      );
    }
  };

  const isReadOnly = role === 'direktur';

  if (role !== 'sales' && role !== 'direktur') {
    return (
      <div className="rounded-2xl bg-white border border-slate-200/80 p-8 shadow-xs max-w-2xl mx-auto text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-700 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="font-display text-lg font-extrabold text-slate-900">
          Akses JO / SO Khusus Peran Sales &amp; Review Direktur
        </h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          Menu Rekap &amp; Edit Penawaran / Job Order / Sales Order dikelola oleh tim{' '}
          <b>Sales / Keuangan</b> dan dapat ditinjau (hanya baca) oleh <b>Direktur</b>.
        </p>
      </div>
    );
  }

  const handleExportCsv = () => {
    const headers = [
      'ID',
      'No Penawaran',
      'Tanggal Penawaran',
      'Perihal',
      'Status',
      'PO No',
      'Title',
      'PO Date',
      'PO Expired Date',
      'DP (%)',
      'Payment Term',
      'Pelanggan | Alamat',
      'Jenis Instalasi Penawaran',
      'Jenis Instalasi JO',
      'Jumlah',
      'PPN',
      'Total',
      'Jumlah Dokumen',
    ];
    const rows = filteredRecords.map((r) => {
      const { jumlah, ppn, total } = calcJoSoTotals(r);
      return [
        r.id,
        r.noPenawaran,
        r.tanggalPenawaran,
        r.perihal,
        r.status,
        r.poNo,
        r.title,
        r.poDate,
        r.poExpiredDate,
        String(r.dp),
        r.paymentTerm,
        r.pelangganAlamat || r.kepadaAlamat,
        r.jenisInstalasiPenawaran,
        r.jenisInstalasiJo,
        String(jumlah),
        String(ppn),
        String(total),
        String(r.documents.length),
      ];
    });
    const csv = [headers, ...rows]
      .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    downloadTextFile(`rekap-so-jo-${isoToday()}.csv`, csv, 'text/csv;charset=utf-8');
    onToast('Rekap SO/JO berhasil diekspor ke CSV');
  };

  // ======================== EDIT JO/SO 3-TAB VIEW ========================
  if (editingRecord) {
    const totals = calcJoSoTotals(editingRecord);

    const updateItem = (itemId: string, patch: Partial<JoSoDetailItem>) => {
      setEditingRecord((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
            }
          : prev
      );
    };

    const addItemRow = () => {
      setEditingRecord((prev) =>
        prev
          ? {
              ...prev,
              items: [
                ...prev.items,
                {
                  id: `it-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                  itemName: '',
                  satuan: 'Unit',
                  price: 0,
                  qty: 1,
                },
              ],
            }
          : prev
      );
    };

    const removeItemRow = (itemId: string) => {
      setEditingRecord((prev) =>
        prev
          ? {
              ...prev,
              items:
                prev.items.length > 1
                  ? prev.items.filter((it) => it.id !== itemId)
                  : [{ id: `it-${Date.now()}`, itemName: '', satuan: 'Unit', price: 0, qty: 1 }],
            }
          : prev
      );
    };

    const handleUploadDoc = async () => {
      if (!selectedFile) {
        onToast('Pilih file dokumen terlebih dahulu');
        return;
      }
      try {
        const meta = await prepFile(selectedFile);
        const newDoc: JoSoDocument = {
          id: `doc-${Date.now()}`,
          docName: docNameInput.trim() || selectedFile.name.replace(/\.[^.]+$/, ''),
          filePath: meta.name,
          fileSize: meta.size,
          uploadedAt: new Date().toISOString(),
        };
        setEditingRecord((prev) =>
          prev ? { ...prev, documents: [...prev.documents, newDoc] } : prev
        );
        setDocNameInput('');
        setSelectedFile(null);
        setFileInputKey((k) => k + 1);
        onToast(`Dokumen "${newDoc.docName}" ditambahkan`);
      } catch (err) {
        onToast(err instanceof Error ? err.message : 'Gagal membaca berkas');
      }
    };

    const removeDocument = (docId: string) => {
      setEditingRecord((prev) =>
        prev ? { ...prev, documents: prev.documents.filter((d) => d.id !== docId) } : prev
      );
    };

    return (
      <div className="rounded-2xl bg-white border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Top Tab Navigation matching screenshots + Proyek sync selector */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/60 px-5 pt-3">
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-sm font-bold text-slate-700 mr-4 pb-3">
              {isReadOnly ? 'Review JO/SO (Hanya Baca)' : 'Edit JO/SO'}
            </span>

            {(
              [
                ['penawaran', 'Penawaran'],
                ['joso', 'Job Order/Sales Order'],
                ['document', 'Job Order/Sales Order Document'],
              ] as [EditorTab, string][]
            ).map(([key, label]) => {
              const active = editorTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setEditorTab(key)}
                  className={`px-4 py-2.5 text-xs sm:text-sm font-medium rounded-t-lg border-x border-t transition-colors cursor-pointer -mb-px ${
                    active
                      ? 'bg-white border-slate-200 text-[#6D28D9] font-semibold'
                      : 'bg-transparent border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {!isReadOnly && (
            <div className="flex items-center gap-2 pb-2">
              <Link2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <select
                value={
                  !syncWithProject
                    ? '__none__'
                    : editingRecord.projectId || '__new__'
                }
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '__none__') {
                    setSyncWithProject(false);
                  } else if (v === '__new__') {
                    setSyncWithProject(true);
                    setEditingRecord({ ...editingRecord, projectId: undefined });
                  } else {
                    setSyncWithProject(true);
                    setEditingRecord({ ...editingRecord, projectId: v });
                  }
                }}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 max-w-[260px]"
                title="Sinkronkan dengan Proyek & Tugas"
              >
                <option value="__new__">+ Sinkron: Buat/Perbarui Proyek Otomatis</option>
                {projects.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    Sinkron ke {pr.no} ({pr.perusahaan})
                  </option>
                ))}
                <option value="__none__">Jangan sinkronkan ke Proyek</option>
              </select>
            </div>
          )}
        </div>

        {isReadOnly && (
          <div className="mx-5 md:mx-6 mt-5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs text-amber-900 font-medium">
            <b>Mode Review Direktur (Baca Saja):</b> Anda dapat meninjau seluruh data Penawaran, JO/SO, dan Dokumen tanpa hak mengubah atau menghapus data.
          </div>
        )}

        <div className="p-5 md:p-6 space-y-6">
          <fieldset disabled={isReadOnly} className="contents">
          {/* TAB 1: PENAWARAN */}
          {editorTab === 'penawaran' && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-3.5 text-xs">
                {/* Left Column */}
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr] items-center gap-2">
                    <label className="font-semibold text-slate-700">Tanggal Penawaran</label>
                    <input
                      type="date"
                      value={editingRecord.tanggalPenawaran}
                      onChange={(e) =>
                        setEditingRecord({ ...editingRecord, tanggalPenawaran: e.target.value })
                      }
                      className="h-9 rounded-lg border border-slate-200 bg-slate-50/80 px-3 text-xs text-slate-800 focus:bg-white focus:border-violet-400 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr] items-center gap-2">
                    <label className="font-semibold text-slate-700">No Penawaran</label>
                    <input
                      type="text"
                      value={editingRecord.noPenawaran}
                      onChange={(e) =>
                        setEditingRecord({ ...editingRecord, noPenawaran: e.target.value })
                      }
                      placeholder="Contoh: 131.A/SDP/PNW/IX/2026"
                      className="h-9 rounded-lg border border-slate-200 bg-slate-50/80 px-3 text-xs text-slate-800 focus:bg-white focus:border-violet-400 outline-none font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr] items-center gap-2">
                    <label className="font-semibold text-slate-700">Perihal</label>
                    <input
                      type="text"
                      value={editingRecord.perihal}
                      onChange={(e) =>
                        setEditingRecord({ ...editingRecord, perihal: e.target.value })
                      }
                      className="h-9 rounded-lg border border-slate-200 bg-slate-50/80 px-3 text-xs text-slate-800 focus:bg-white focus:border-violet-400 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr] items-center gap-2">
                    <label className="font-semibold text-slate-700">Lampiran</label>
                    <input
                      type="text"
                      value={editingRecord.lampiran}
                      onChange={(e) =>
                        setEditingRecord({ ...editingRecord, lampiran: e.target.value })
                      }
                      className="h-9 rounded-lg border border-slate-200 bg-slate-50/80 px-3 text-xs text-slate-800 focus:bg-white focus:border-violet-400 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr] items-center gap-2">
                    <label className="font-semibold text-slate-700">Tanggal Permintaan</label>
                    <input
                      type="date"
                      value={editingRecord.tanggalPermintaan}
                      onChange={(e) =>
                        setEditingRecord({ ...editingRecord, tanggalPermintaan: e.target.value })
                      }
                      className="h-9 rounded-lg border border-slate-200 bg-slate-50/80 px-3 text-xs text-slate-800 focus:bg-white focus:border-violet-400 outline-none"
                    />
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] items-start gap-2">
                    <label className="font-semibold text-slate-700 sm:pt-2">Kepada | Alamat</label>
                    <div className="space-y-1.5">
                      <select
                        value={
                          clientPresets.includes(editingRecord.kepadaAlamat)
                            ? editingRecord.kepadaAlamat
                            : '__custom__'
                        }
                        onChange={(e) => {
                          if (e.target.value !== '__custom__') {
                            setEditingRecord({
                              ...editingRecord,
                              kepadaAlamat: e.target.value,
                              pelangganAlamat: editingRecord.pelangganAlamat || e.target.value,
                            });
                          }
                        }}
                        className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50/80 px-3 text-xs text-slate-800 focus:bg-white focus:border-violet-400 outline-none"
                      >
                        {clientPresets.map((preset) => (
                          <option key={preset} value={preset}>
                            {preset}
                          </option>
                        ))}
                        <option value="__custom__">— Input Manual Pelanggan / Alamat —</option>
                      </select>
                      <input
                        type="text"
                        value={editingRecord.kepadaAlamat}
                        onChange={(e) =>
                          setEditingRecord({ ...editingRecord, kepadaAlamat: e.target.value })
                        }
                        placeholder="Nama Perusahaan | Alamat Lengkap"
                        className="w-full h-8 rounded-lg border border-slate-200 px-3 text-xs text-slate-700 focus:border-violet-400 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] items-center gap-2">
                    <label className="font-semibold text-slate-700">Jenis Instalasi</label>
                    <select
                      value={
                        JENIS_INSTALASI_SOJO.includes(editingRecord.jenisInstalasiPenawaran)
                          ? editingRecord.jenisInstalasiPenawaran
                          : JENIS_INSTALASI_SOJO[0]
                      }
                      onChange={(e) =>
                        setEditingRecord({
                          ...editingRecord,
                          jenisInstalasiPenawaran: e.target.value,
                        })
                      }
                      className="h-9 rounded-lg border border-slate-200 bg-slate-50/80 px-3 text-xs text-slate-800 focus:bg-white focus:border-violet-400 outline-none"
                    >
                      {JENIS_INSTALASI_SOJO.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] items-center gap-2">
                    <label className="font-semibold text-slate-700">Status</label>
                    <select
                      value={editingRecord.status}
                      onChange={(e) =>
                        setEditingRecord({
                          ...editingRecord,
                          status: e.target.value as JoSoStatus,
                        })
                      }
                      className="h-9 rounded-lg border border-slate-200 bg-slate-50/80 px-3 text-xs text-slate-800 focus:bg-white focus:border-violet-400 outline-none"
                    >
                      {STATUS_SOJO_LIST.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] items-center gap-2">
                    <label className="font-semibold text-slate-700">Masa Berlaku</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        value={editingRecord.masaBerlaku}
                        onChange={(e) =>
                          setEditingRecord({
                            ...editingRecord,
                            masaBerlaku: Number(e.target.value) || 0,
                          })
                        }
                        className="flex-1 h-9 rounded-lg border border-slate-200 bg-slate-50/80 px-3 text-xs text-slate-800 focus:bg-white focus:border-violet-400 outline-none tabular-nums"
                      />
                      <span className="text-xs font-medium text-slate-600">Hari</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detail Item Section */}
              <div className="pt-2 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <h3 className="font-display text-base font-bold text-slate-800">Detail Item</h3>
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 text-xs font-semibold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah Item
                  </button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left border-collapse min-w-[740px]">
                    <thead>
                      <tr className="bg-[#F4F3FF] text-slate-700 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                        <th className="py-3 px-3.5">ITEM NAME</th>
                        <th className="py-3 px-3 text-center w-32">HARGA SATUAN</th>
                        <th className="py-3 px-3 text-right w-44">PRICE</th>
                        <th className="py-3 px-3 text-center w-24">QTY</th>
                        <th className="py-3 px-3.5 text-right w-44">SUB TOTAL</th>
                        <th className="py-3 px-2 text-center w-12" aria-label="Hapus"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {editingRecord.items.map((item) => {
                        const subTotal = Math.round(
                          (Number(item.price) || 0) * (Number(item.qty) || 0)
                        );
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/70">
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={item.itemName}
                                onChange={(e) =>
                                  updateItem(item.id, { itemName: e.target.value })
                                }
                                placeholder="Contoh: SLO Gardu Induk..."
                                className="w-full h-8 rounded-md border border-slate-200 px-2.5 text-xs text-slate-800 focus:border-violet-400 outline-none"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <select
                                value={item.satuan}
                                onChange={(e) =>
                                  updateItem(item.id, { satuan: e.target.value })
                                }
                                className="w-full h-8 rounded-md border border-slate-200 px-2 text-xs text-center text-slate-700 focus:border-violet-400 outline-none"
                              >
                                {SATUAN_SOJO.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2 px-2">
                              <input
                                type="number"
                                min={0}
                                value={item.price}
                                onChange={(e) =>
                                  updateItem(item.id, { price: Number(e.target.value) || 0 })
                                }
                                className="w-full h-8 rounded-md border border-slate-200 px-2.5 text-xs text-right tabular-nums text-slate-800 focus:border-violet-400 outline-none"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <input
                                type="number"
                                min={1}
                                value={item.qty}
                                onChange={(e) =>
                                  updateItem(item.id, { qty: Math.max(0, Number(e.target.value)) })
                                }
                                className="w-full h-8 rounded-md border border-slate-200 px-2 text-xs text-center tabular-nums text-slate-800 focus:border-violet-400 outline-none"
                              />
                            </td>
                            <td className="py-2 px-3.5 text-right font-semibold tabular-nums text-slate-800">
                              {formatDecimalId(subTotal)}
                            </td>
                            <td className="py-2 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => removeItemRow(item.id)}
                                title="Hapus baris"
                                className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="border-t border-slate-200 bg-slate-50/50 text-xs">
                      <tr className="border-b border-slate-200">
                        <td colSpan={4} className="py-2.5 px-3.5 text-right font-bold text-slate-700">
                          Jumlah
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-bold tabular-nums text-slate-900">
                          {formatDecimalId(totals.jumlah)}
                        </td>
                        <td />
                      </tr>
                      <tr className="border-b border-slate-200">
                        <td colSpan={4} className="py-2 px-3.5 text-right font-bold text-slate-700">
                          <span className="inline-flex items-center gap-1.5 justify-end">
                            PPN
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={editingRecord.ppnRate}
                              onChange={(e) =>
                                setEditingRecord({
                                  ...editingRecord,
                                  ppnRate: Number(e.target.value) || 0,
                                })
                              }
                              className="w-14 h-7 rounded border border-slate-200 bg-white px-1.5 text-center text-xs font-semibold tabular-nums"
                            />
                            %
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-bold tabular-nums text-slate-900">
                          {formatDecimalId(totals.ppn)}
                        </td>
                        <td />
                      </tr>
                      <tr>
                        <td colSpan={4} className="py-2.5 px-3.5 text-right font-extrabold text-slate-900">
                          Total
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-extrabold tabular-nums text-slate-900">
                          {formatDecimalId(totals.total)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: JOB ORDER / SALES ORDER */}
          {editorTab === 'joso' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-4 text-xs">
              {/* Left Column */}
              <div className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-[190px_1fr] items-center gap-2">
                  <label className="font-semibold text-slate-700">PO No</label>
                  <input
                    type="text"
                    value={editingRecord.poNo}
                    onChange={(e) =>
                      setEditingRecord({ ...editingRecord, poNo: e.target.value })
                    }
                    placeholder="Contoh: 058/SPK/SDP/X/2026"
                    className="h-9 rounded-lg border border-slate-200 px-3 text-xs text-slate-800 focus:border-violet-400 outline-none font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-[190px_1fr] items-center gap-2">
                  <label className="font-semibold text-slate-700">Title</label>
                  <input
                    type="text"
                    value={editingRecord.title}
                    onChange={(e) =>
                      setEditingRecord({ ...editingRecord, title: e.target.value })
                    }
                    placeholder="Contoh: SLO GI PT.IMIP"
                    className="h-9 rounded-lg border border-slate-200 px-3 text-xs text-slate-800 focus:border-violet-400 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-[190px_1fr] items-center gap-2">
                  <label className="font-semibold text-slate-700">PO Date</label>
                  <input
                    type="date"
                    value={editingRecord.poDate}
                    onChange={(e) =>
                      setEditingRecord({ ...editingRecord, poDate: e.target.value })
                    }
                    className="h-9 rounded-lg border border-slate-200 px-3 text-xs text-slate-800 focus:border-violet-400 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-[190px_1fr] items-center gap-2">
                  <label className="font-semibold text-slate-700">
                    PO Delivery Date/Expired Date
                  </label>
                  <input
                    type="date"
                    value={editingRecord.poExpiredDate}
                    onChange={(e) =>
                      setEditingRecord({ ...editingRecord, poExpiredDate: e.target.value })
                    }
                    className="h-9 rounded-lg border border-slate-200 px-3 text-xs text-slate-800 focus:border-violet-400 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-[190px_1fr] items-center gap-2">
                  <label className="font-semibold text-slate-700">DP</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={editingRecord.dp}
                    onChange={(e) =>
                      setEditingRecord({ ...editingRecord, dp: Number(e.target.value) || 0 })
                    }
                    className="h-9 rounded-lg border border-slate-200 px-3 text-xs text-slate-800 focus:border-violet-400 outline-none tabular-nums"
                  />
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr] items-start gap-2">
                  <label className="font-semibold text-slate-700 sm:pt-2">Pelanggan | Alamat</label>
                  <div className="space-y-1.5">
                    <select
                      value={
                        clientPresets.includes(editingRecord.pelangganAlamat)
                          ? editingRecord.pelangganAlamat
                          : '__custom__'
                      }
                      onChange={(e) => {
                        if (e.target.value !== '__custom__') {
                          setEditingRecord({
                            ...editingRecord,
                            pelangganAlamat: e.target.value,
                          });
                        }
                      }}
                      className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs text-slate-800 focus:border-violet-400 outline-none"
                    >
                      {clientPresets.map((preset) => (
                        <option key={preset} value={preset}>
                          {preset}
                        </option>
                      ))}
                      <option value="__custom__">— Input Manual Pelanggan / Alamat —</option>
                    </select>
                    <input
                      type="text"
                      value={editingRecord.pelangganAlamat}
                      onChange={(e) =>
                        setEditingRecord({ ...editingRecord, pelangganAlamat: e.target.value })
                      }
                      placeholder="Nama Pelanggan | Alamat Lengkap"
                      className="w-full h-8 rounded-lg border border-slate-200 px-3 text-xs text-slate-700 focus:border-violet-400 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr] items-center gap-2">
                  <label className="font-semibold text-slate-700">Jenis Instalasi</label>
                  <select
                    value={
                      JENIS_INSTALASI_SOJO.includes(editingRecord.jenisInstalasiJo)
                        ? editingRecord.jenisInstalasiJo
                        : JENIS_INSTALASI_SOJO[5]
                    }
                    onChange={(e) =>
                      setEditingRecord({ ...editingRecord, jenisInstalasiJo: e.target.value })
                    }
                    className="h-9 rounded-lg border border-slate-200 px-3 text-xs text-slate-800 focus:border-violet-400 outline-none"
                  >
                    {JENIS_INSTALASI_SOJO.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr] items-center gap-2">
                  <label className="font-semibold text-slate-700">Payment Term</label>
                  <input
                    type="text"
                    value={editingRecord.paymentTerm}
                    onChange={(e) =>
                      setEditingRecord({ ...editingRecord, paymentTerm: e.target.value })
                    }
                    placeholder="Contoh: DP 50, PL 50"
                    className="h-9 rounded-lg border border-slate-200 px-3 text-xs text-slate-800 focus:border-violet-400 outline-none"
                  />
                </div>
              </div>

              {/* Pesan Status Pekerjaan Sales -> Admin */}
              <div className="lg:col-span-2 mt-2 rounded-xl border border-violet-200 bg-violet-50/50 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="font-display text-sm font-bold text-slate-900">
                      Pesan Status Pekerjaan ke Admin Teknis
                    </h4>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Setelah penawaran &amp; PO terbit, pilih status kesiapan pekerjaan lalu kirim ke Admin untuk diteruskan ke PJT.
                    </p>
                  </div>
                  {editingRecord.sentToAdminAt && (
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-semibold">
                      Terkirim ke Admin · {formatDateTime(editingRecord.sentToAdminAt)}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(
                    [
                      [
                        'ready_wait_dp',
                        'Siap Dikerjakan (Menunggu DP)',
                        'PO sudah terbit, pekerjaan siap diproses Admin & PJT sambil menunggu pembayaran DP.',
                      ],
                      [
                        'ready_no_dp',
                        'Siap Dikerjakan (Tanpa DP)',
                        'PO sudah terbit dan pekerjaan dapat langsung dijalankan tanpa menunggu DP.',
                      ],
                    ] as [SalesReadiness, string, string][]
                  ).map(([val, title, desc]) => {
                    const active = (editingRecord.salesReadiness || 'ready_wait_dp') === val;
                    return (
                      <label
                        key={val}
                        className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                          active
                            ? 'bg-white border-violet-500 shadow-2xs'
                            : 'bg-white/60 border-slate-200 hover:bg-white'
                        }`}
                      >
                        <input
                          type="radio"
                          name="salesReadiness"
                          checked={active}
                          onChange={() =>
                            setEditingRecord({ ...editingRecord, salesReadiness: val })
                          }
                          className="mt-0.5 accent-violet-600"
                        />
                        <div>
                          <div className="text-xs font-bold text-slate-900">{title}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Pesan / Catatan Sales untuk Admin Teknis
                  </label>
                  <textarea
                    rows={2}
                    value={editingRecord.salesMessage || ''}
                    onChange={(e) =>
                      setEditingRecord({ ...editingRecord, salesMessage: e.target.value })
                    }
                    placeholder="Contoh: PO sudah terbit, mohon diteruskan ke PJT untuk penunjukan Leader Tenaga Teknik..."
                    className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-800 focus:border-violet-400 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: JOB ORDER / SALES ORDER DOCUMENT */}
          {editorTab === 'document' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Document List Table */}
              <div className="lg:col-span-6 overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-300/80 text-slate-800 text-[11px] font-bold uppercase tracking-wider">
                      <th className="py-3 px-3.5">DOC NAME</th>
                      <th className="py-3 px-3.5">FILE PATH</th>
                      <th className="py-3 px-2 text-center w-14">AKSI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {editingRecord.documents.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-6 px-4 text-center text-slate-400">
                          Belum ada dokumen terunggah untuk SO/JO ini.
                        </td>
                      </tr>
                    ) : (
                      editingRecord.documents.map((doc) => (
                        <tr key={doc.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3.5 font-semibold text-slate-800">
                            {doc.docName}
                          </td>
                          <td className="py-2.5 px-3.5 font-mono text-slate-600">
                            <div>{doc.filePath}</div>
                            {doc.fileSize && (
                              <div className="text-[10px] text-slate-400">
                                {formatFileSize(doc.fileSize)} · {formatDateShort(doc.uploadedAt)}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeDocument(doc.id)}
                              title="Hapus Dokumen"
                              className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Upload Controls */}
              <div className="lg:col-span-6 flex flex-wrap items-center gap-2.5 pt-1">
                <input
                  type="text"
                  value={docNameInput}
                  onChange={(e) => setDocNameInput(e.target.value)}
                  placeholder="Nama Dokumen (mis. PO / SPK)"
                  className="flex-1 min-w-[180px] h-9 rounded-lg border border-slate-200 px-3 text-xs text-slate-800 focus:border-violet-400 outline-none"
                />
                <input
                  key={fileInputKey}
                  type="file"
                  accept=".pdf,image/*,.doc,.docx,.xls,.xlsx"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="text-xs text-slate-600 max-w-[210px] file:mr-2 file:py-1.5 file:px-2.5 file:rounded file:border file:border-slate-300 file:text-xs file:bg-slate-100 hover:file:bg-slate-200"
                />
                <button
                  type="button"
                  onClick={handleUploadDoc}
                  className="inline-flex items-center gap-1.5 px-4 h-9 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold shadow-xs cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" /> Upload
                </button>
              </div>
            </div>
          )}

          </fieldset>

          {/* Bottom Action Bar (Back, Save, Save & Send to Admin) */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="px-4 py-2 rounded-lg bg-[#06B6D4] hover:bg-[#0891B2] text-white text-xs font-semibold shadow-xs cursor-pointer"
              >
                Back
              </button>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => handleSave(false)}
                  className="px-4 py-2 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold shadow-xs cursor-pointer"
                >
                  Save
                </button>
              )}
            </div>
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => handleSave(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" /> Simpan &amp; Kirim Pesan ke Admin
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ======================== REKAP SO/JO VIEW ========================
  return (
    <div className="space-y-5">
      {isReadOnly && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-900 font-medium">
          <b>Mode Review Direktur (Baca Saja):</b> Seluruh Rekap Penawaran, Job Order / Sales Order, dan dokumen dapat ditinjau tanpa hak input, ubah, atau hapus data.
        </div>
      )}
      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] text-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-100">
              Total Rekap SO/JO
            </span>
            <Briefcase className="w-5 h-5 text-blue-100" />
          </div>
          <div className="font-display text-3xl font-extrabold tabular-nums mt-2">
            {recapStats.totalCount}
          </div>
          <div className="text-xs text-blue-100 mt-1">Tersimpan di aplikasi &amp; Google Sheets</div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#6D28D9] text-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-violet-100">
              Total Nilai (Incl. PPN)
            </span>
            <FileSpreadsheet className="w-5 h-5 text-violet-100" />
          </div>
          <div className="font-display text-xl xl:text-2xl font-extrabold tabular-nums mt-2 truncate">
            {formatRupiah(recapStats.totalValue)}
          </div>
          <div className="text-xs text-violet-100 mt-1">Akumulasi seluruh item penawaran</div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-[#10B981] to-[#059669] text-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-100">
              SO/JO Aktif / Submit
            </span>
            <CheckCircle2 className="w-5 h-5 text-emerald-100" />
          </div>
          <div className="font-display text-3xl font-extrabold tabular-nums mt-2">
            {recapStats.activeCount}
          </div>
          <div className="text-xs text-emerald-100 mt-1">Status submit, approved, atau proses</div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-[#0EA5E9] to-[#0284C7] text-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-100">
              Dokumen Lampiran
            </span>
            <FolderOpen className="w-5 h-5 text-sky-100" />
          </div>
          <div className="font-display text-3xl font-extrabold tabular-nums mt-2">
            {recapStats.totalDocs}
          </div>
          <div className="text-xs text-sky-100 mt-1">File PO/SPK &amp; dokumen order</div>
        </div>
      </div>

      {/* Filter & Actions Bar */}
      <div className="rounded-2xl bg-white border border-slate-200/80 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[260px]">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari No Penawaran, PO No, Title, atau Pelanggan..."
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 text-xs focus:border-violet-400 outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-700"
          >
            <option value="all">Semua Status</option>
            {STATUS_SOJO_LIST.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 h-9 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Ekspor CSV
          </button>
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => openEditor(createEmptyRecord(), 'penawaran')}
              className="inline-flex items-center gap-1.5 px-4 h-9 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Buat SO/JO Baru
            </button>
          )}
        </div>
      </div>

      {/* Recap SO/JO Table */}
      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">Rekap SO / JO</h2>
            <p className="text-xs text-slate-500">
              Daftar Penawaran, Job Order / Sales Order, dan Dokumen Order PT. Sabda Duta Paramitha
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500 tabular-nums">
            {filteredRecords.length} data
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[960px]">
            <thead>
              <tr className="bg-[#0F1E3D] text-white text-[11px] font-bold uppercase tracking-wider">
                <th className="py-3 px-4">No Penawaran &amp; PO No</th>
                <th className="py-3 px-4">Title &amp; Pelanggan</th>
                <th className="py-3 px-4">Jenis Instalasi</th>
                <th className="py-3 px-4">Tgl PO / Expired</th>
                <th className="py-3 px-4 text-center">Status &amp; Term</th>
                <th className="py-3 px-4 text-right">Total (Incl. PPN)</th>
                <th className="py-3 px-4 text-center">Dok</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    Tidak ada data SO/JO yang cocok. Klik &ldquo;Buat SO/JO Baru&rdquo; untuk menambah.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => {
                  const totals = calcJoSoTotals(rec);
                  const linkedProj = projects.find(
                    (pr) => pr.id === rec.projectId || pr.joSoId === rec.id
                  );
                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 align-top">
                        <div className="font-mono font-bold text-slate-900">
                          {rec.noPenawaran || '-'}
                        </div>
                        <div className="font-mono text-[11px] text-violet-700 font-semibold mt-0.5">
                          PO: {rec.poNo || '-'}
                        </div>
                        {linkedProj && (
                          <button
                            type="button"
                            onClick={() => onOpenProject(linkedProj.id)}
                            className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 text-[10px] font-mono font-bold cursor-pointer"
                            title="Buka di Proyek & Tugas"
                          >
                            <Link2 className="w-2.5 h-2.5" /> {linkedProj.no}
                          </button>
                        )}
                      </td>
                      <td className="py-3.5 px-4 align-top max-w-[260px]">
                        <div className="font-bold text-slate-900">{rec.title || rec.perihal}</div>
                        <div className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                          {rec.pelangganAlamat || rec.kepadaAlamat || '-'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 align-top max-w-[210px]">
                        <div className="font-medium text-slate-800">
                          {rec.jenisInstalasiJo || rec.jenisInstalasiPenawaran}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {rec.items.length} item penawaran
                        </div>
                      </td>
                      <td className="py-3.5 px-4 align-top font-mono text-[11px] text-slate-600">
                        <div>PO: {formatDateShort(rec.poDate)}</div>
                        <div className="text-slate-400 mt-0.5">
                          Exp: {formatDateShort(rec.poExpiredDate)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 align-top text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                            STATUS_BADGE[rec.status]
                          }`}
                        >
                          {rec.status}
                        </span>
                        <div className="text-[11px] text-slate-500 mt-1">
                          DP {rec.dp}% · {rec.paymentTerm || '-'}
                        </div>
                        {rec.salesReadiness && (
                          <div
                            className={`mt-1 inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                              rec.sentToAdminAt
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {rec.sentToAdminAt ? '✓ Admin: ' : 'Draft: '}
                            {SALES_READINESS_LABEL[rec.salesReadiness]}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 align-top text-right font-bold tabular-nums text-slate-900">
                        <div>{formatDecimalId(totals.total)}</div>
                        <div className="text-[10px] font-normal text-slate-400 mt-0.5">
                          DPP: {formatDecimalId(totals.jumlah)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 align-top text-center">
                        <button
                          type="button"
                          onClick={() => openEditor(rec, 'document')}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] cursor-pointer"
                        >
                          {rec.documents.length}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 align-top text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditor(rec, 'penawaran')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 text-[11px] font-semibold cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3" /> {isReadOnly ? 'Tinjau JO/SO' : 'Edit JO/SO'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onCreateSuratTugasFromJoSo(rec)}
                            title="Lihat di Dokumen Surat Tugas"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-[11px] font-semibold cursor-pointer"
                          >
                            <FileText className="w-3 h-3" /> Surat Tugas
                          </button>
                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(rec.id)}
                              title="Hapus Rekap"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal (no window.confirm) */}
      {confirmDeleteId && (
        <div className="no-print fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="font-display text-base font-extrabold text-slate-900">
              Hapus Data SO/JO?
            </h3>
            <p className="text-xs text-slate-600">
              Data SO/JO ini akan dihapus dari Rekap SO/JO. Jangan lupa tekan Simpan ke Sheets jika ingin memperbarui Google Sheets.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteRecord(confirmDeleteId);
                  setConfirmDeleteId(null);
                  onToast('Data SO/JO dihapus dari rekap');
                }}
                className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
