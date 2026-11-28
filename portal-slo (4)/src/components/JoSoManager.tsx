import React, { useEffect, useMemo, useState } from 'react';
import { usePersistedState } from '../hooks/usePersistedState';
import {
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Info,
  Link2,
  Lock,
  Plus,
  Search,
  Send,
  Trash2,
  Upload,
  Wallet,
  Zap,
} from 'lucide-react';
import {
  JENIS_INSTALASI_SOJO,
  JOSO_STATUS_LABEL,
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
import { WorkOrderModal } from './WorkOrderDoc';
import {
  calcJoSoTotals,
  defaultWoCatatan,
  downloadTextFile,
  formatDateShort,
  formatDateTime,
  formatDecimalId,
  formatFileSize,
  formatRupiah,
  getPelanggan,
  composePelangganAlamat,
  isoToday,
  itemKategori,
  parseJenisInstalasiToProject,
  prepFile,
  splitJasaMobilisasi,
  SALES_READINESS_LABEL,
  mapProjectStatusToJoSoStatus,
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
  /** Database TTD (opsional) untuk tanda tangan di Work Order. */
  signatures?: Record<string, string>;
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

const INPUT =
  'w-full h-9 rounded-lg border border-slate-200 bg-slate-50/80 px-3 text-xs text-slate-800 focus:bg-white focus:border-violet-400 outline-none';

function Section({
  icon,
  title,
  desc,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  desc?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200/90 bg-white">
      <header className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
        <div className="flex items-start gap-2.5">
          <span className="w-7 h-7 shrink-0 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center">
            {icon}
          </span>
          <div>
            <h3 className="font-display text-sm font-bold text-slate-900">{title}</h3>
            {desc && <p className="text-[11px] text-slate-500 mt-0.5">{desc}</p>}
          </div>
        </div>
        {action}
      </header>
      <div className="p-4 space-y-4 text-xs">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-slate-700 mb-1">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[10.5px] leading-snug text-slate-500">{hint}</p>}
    </div>
  );
}

interface ClientPreset {
  key: string;
  nama: string;
  alamat: string;
  kota: string;
}

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
    namaPerusahaan: '',
    alamatPerusahaan: '',
    kota: '',
    kapasitas: '',
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
        kategori: 'jasa',
      },
    ],
    poNo: '',
    title: '',
    poDate: today,
    poExpiredDate: expIso,
    dp: 50,
    pelangganAlamat: '',
    jenisInstalasiJo: JENIS_INSTALASI_SOJO[0],
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
  signatures,
}: JoSoManagerProps) {
  const [editingRecord, setEditingRecord] = usePersistedState<JoSoRecord | null>('joso.editingRecord', null);
  const [editorTab, setEditorTab] = usePersistedState<EditorTab>('joso.editorTab', 'penawaran');
  const [woRecord, setWoRecord] = usePersistedState<JoSoRecord | null>('joso.woRecord', null);
  const [syncWithProject, setSyncWithProject] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = usePersistedState('joso.search', '');
  const [statusFilter, setStatusFilter] = usePersistedState<string>('joso.statusFilter', 'all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Document upload draft inside Tab 3
  const [docNameInput, setDocNameInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  const clientPresets = useMemo<ClientPreset[]>(() => {
    const map = new Map<string, ClientPreset>();
    const add = (nama: string, alamat: string, kota: string) => {
      const n = nama.trim();
      if (!n) return;
      const key = n.toLowerCase();
      const cur = map.get(key);
      if (!cur) {
        map.set(key, { key, nama: n, alamat: alamat.trim(), kota: kota.trim() });
      } else {
        if (!cur.alamat && alamat.trim()) cur.alamat = alamat.trim();
        if (!cur.kota && kota.trim()) cur.kota = kota.trim();
      }
    };
    records.forEach((r) => {
      const pl = getPelanggan(r);
      add(pl.nama, pl.alamat, pl.kota);
    });
    projects.forEach((p) => add(p.perusahaan, '', p.kota.length <= 40 ? p.kota : ''));
    add(
      'PT. Indonesia Morowali Industrial Park',
      'Gedung IMIP, Jl. Batu Mulia 8, RT. 007 RW.007 Kel. Maruya Utara Kec. Kembangan',
      'Jakarta Barat'
    );
    return Array.from(map.values());
  }, [projects, records]);

  /**
   * Status yang ditampilkan di rekap. Begitu proyek terkait sudah berjalan/selesai (diubah PJT atau
   * Tenaga Teknik yang tidak boleh menulis rekap ini di server), status diambil langsung dari proyek
   * sehingga selalu terbaru tanpa menunggu rekap disimpan ulang.
   */
  const statusOf = (rec: JoSoRecord): JoSoRecord['status'] => {
    if (rec.status === 'cancelled') return rec.status;
    const proj = projects.find((p) => p.id === rec.projectId || p.joSoId === rec.id);
    if (!proj) return rec.status;
    const derived = mapProjectStatusToJoSoStatus(proj.status);
    return derived === 'in_progress' || derived === 'completed' ? derived : rec.status;
  };

  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      if (statusFilter !== 'all' && statusOf(rec) !== statusFilter) return false;
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
  }, [records, projects, searchQuery, statusFilter]);

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
    const copy = JSON.parse(JSON.stringify(rec)) as JoSoRecord;
    if (copy.namaPerusahaan === undefined) {
      // Data lama: urai dari teks "Nama | Alamat" dan lengkapi dari proyek terkait
      const pl = getPelanggan(rec);
      const linked = projects.find((p) => p.id === rec.projectId || p.joSoId === rec.id);
      const projKota =
        linked?.kota && linked.kota !== pl.alamat && linked.kota.length <= 40 ? linked.kota : '';
      copy.namaPerusahaan = pl.nama;
      copy.alamatPerusahaan = pl.alamat;
      copy.kota = projKota;
      copy.kapasitas =
        linked?.kap && linked.kap !== 'Sesuai Kontrak SO/JO' ? linked.kap : copy.kapasitas || '';
    }
    copy.kapasitas = copy.kapasitas || '';
    copy.jenisInstalasiJo = copy.jenisInstalasiPenawaran;
    setEditingRecord(copy);
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
    const nama = (editingRecord.namaPerusahaan || '').trim();
    const alamat = (editingRecord.alamatPerusahaan || '').trim();
    const kota = (editingRecord.kota || '').trim();
    if (!nama) {
      onToast('Isi Nama Perusahaan terlebih dahulu');
      setEditorTab('penawaran');
      return;
    }
    if ((sendToAdmin || syncWithProject) && !kota) {
      onToast('Isi Kota / Kabupaten — dipakai di Daftar Pekerjaan & Surat Tugas');
      setEditorTab('penawaran');
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
      namaPerusahaan: nama,
      alamatPerusahaan: alamat,
      kota,
      kapasitas: (editingRecord.kapasitas || '').trim(),
      pelangganAlamat: composePelangganAlamat(nama, alamat, kota),
      kepadaAlamat: composePelangganAlamat(nama, alamat, kota),
      jenisInstalasiJo: editingRecord.jenisInstalasiPenawaran,
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
          ? `Data SO/JO "${cleaned.title || cleaned.noPenawaran || cleaned.poNo}" disimpan & disinkronkan ke Daftar Pekerjaan`
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
      'Pelanggan',
      'Alamat',
      'Kota',
      'Kapasitas',
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
        JOSO_STATUS_LABEL[statusOf(r)],
        r.poNo,
        r.title,
        r.poDate,
        r.poExpiredDate,
        String(r.dp),
        r.paymentTerm,
        getPelanggan(r).nama || r.pelangganAlamat || r.kepadaAlamat,
        getPelanggan(r).alamat,
        getPelanggan(r).kota,
        r.kapasitas || '',
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

    const pel = {
      nama: editingRecord.namaPerusahaan || '',
      alamat: editingRecord.alamatPerusahaan || '',
      kota: editingRecord.kota || '',
    };
    const set = (patch: Partial<JoSoRecord>) =>
      setEditingRecord((prev) => (prev ? { ...prev, ...patch } : prev));
    const { jasa, mob } = splitJasaMobilisasi(editingRecord.items);
    const projInfo = parseJenisInstalasiToProject(editingRecord.jenisInstalasiPenawaran);
    const dpNominal = Math.round((totals.total * (Number(editingRecord.dp) || 0)) / 100);
    const berlakuSampai = (() => {
      if (!editingRecord.tanggalPenawaran) return '';
      const dt = new Date(`${editingRecord.tanggalPenawaran}T12:00:00`);
      dt.setDate(dt.getDate() + (Number(editingRecord.masaBerlaku) || 0));
      return dt.toISOString().slice(0, 10);
    })();

    const onDpChange = (raw: number) => {
      const v = Math.min(100, Math.max(0, raw || 0));
      const oldAuto = `DP ${editingRecord.dp}, PL ${100 - editingRecord.dp}`;
      const keepAuto = !editingRecord.paymentTerm.trim() || editingRecord.paymentTerm === oldAuto;
      set({ dp: v, paymentTerm: keepAuto ? `DP ${v}, PL ${100 - v}` : editingRecord.paymentTerm });
    };

    const checks: { label: string; ok: boolean; step: EditorTab }[] = [
      { label: 'Nama perusahaan & kota', ok: Boolean(pel.nama.trim() && pel.kota.trim()), step: 'penawaran' },
      { label: 'No Penawaran', ok: Boolean(editingRecord.noPenawaran.trim()), step: 'penawaran' },
      {
        label: 'Item penawaran berharga',
        ok: editingRecord.items.some((i) => i.itemName.trim() && Number(i.price) > 0),
        step: 'penawaran',
      },
      { label: 'PO No & Title', ok: Boolean(editingRecord.poNo.trim() && editingRecord.title.trim()), step: 'joso' },
      { label: 'Dokumen PO / SPK terunggah', ok: editingRecord.documents.length > 0, step: 'document' },
    ];
    const stepDone: Record<EditorTab, boolean> = {
      penawaran: checks[0].ok && checks[1].ok && checks[2].ok,
      joso: checks[3].ok,
      document: checks[4].ok,
    };
    const STEPS: [EditorTab, string, string][] = [
      ['penawaran', 'Penawaran', 'Pelanggan, instalasi & harga'],
      ['joso', 'PO / Job Order', 'Nomor PO, jadwal & DP'],
      ['document', 'Dokumen & Kirim', 'Unggah PO & kirim ke Admin'],
    ];
    const stepIdx = STEPS.findIndex(([k]) => k === editorTab);
    const missing = (v: string) =>
      v.trim() ? (
        <span className="font-semibold text-slate-800 text-right">{v}</span>
      ) : (
        <span className="font-semibold text-amber-600">Belum diisi</span>
      );

    return (
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
        {/* ============ KOLOM UTAMA ============ */}
        <div className="rounded-2xl bg-white border border-slate-200/90 shadow-xs overflow-hidden">
          {/* Header + Stepper */}
          <div className="px-5 md:px-6 pt-5 pb-4 border-b border-slate-100 bg-gradient-to-b from-violet-50/60 to-white">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-extrabold text-slate-900">
                  {isReadOnly ? 'Review JO / SO (Hanya Baca)' : 'Form JO / SO'}
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Isi 3 langkah berikut. Data otomatis dipakai di Daftar Pekerjaan, Surat Tugas, dan Rekap.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-600">
                Langkah {stepIdx + 1} dari {STEPS.length}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
              {STEPS.map(([key, label, sub], i) => {
                const active = key === editorTab;
                const done = stepDone[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setEditorTab(key)}
                    className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors cursor-pointer ${
                      active
                        ? 'bg-white border-violet-400 shadow-2xs ring-1 ring-violet-200'
                        : 'bg-white/60 border-slate-200 hover:bg-white'
                    }`}
                  >
                    <span
                      className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                        done
                          ? 'bg-emerald-500 text-white'
                          : active
                          ? 'bg-[#7C3AED] text-white'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {done ? <Check className="w-4 h-4" /> : i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-xs font-bold ${active ? 'text-violet-700' : 'text-slate-800'}`}>
                        {label}
                      </span>
                      <span className="block text-[10.5px] text-slate-500 truncate">{sub}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {isReadOnly && (
            <div className="mx-5 md:mx-6 mt-5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs text-amber-900 font-medium">
              <b>Mode Review Direktur (Baca Saja):</b> Anda dapat meninjau seluruh data Penawaran, JO/SO, dan Dokumen tanpa hak mengubah atau menghapus data.
            </div>
          )}

          <div className="p-5 md:p-6 space-y-5">
            <fieldset disabled={isReadOnly} className="contents">
              {/* ================= LANGKAH 1: PENAWARAN ================= */}
              {editorTab === 'penawaran' && (
                <>
                  <Section
                    icon={<Building2 className="w-4 h-4" />}
                    title="Data Pelanggan"
                    desc="Dipakai sebagai Perusahaan & Kota di Proyek, serta Pemilik & Lokasi di Surat Tugas."
                  >
                    <Field label="Pilih pelanggan tersimpan" hint="Atau lewati dan isi manual di bawah.">
                      <select
                        value={clientPresets.find((c) => c.nama === pel.nama)?.key || ''}
                        onChange={(e) => {
                          const c = clientPresets.find((x) => x.key === e.target.value);
                          if (c) {
                            set({
                              namaPerusahaan: c.nama,
                              alamatPerusahaan: c.alamat,
                              kota: c.kota,
                            });
                          }
                        }}
                        className={INPUT}
                      >
                        <option value="">— Pelanggan baru / isi manual —</option>
                        {clientPresets.map((c) => (
                          <option key={c.key} value={c.key}>
                            {c.nama}
                            {c.kota ? ` — ${c.kota}` : ''}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="Nama Perusahaan" required>
                        <input
                          type="text"
                          value={pel.nama}
                          onChange={(e) => set({ namaPerusahaan: e.target.value })}
                          placeholder="PT. Indonesia Morowali Industrial Park"
                          className={INPUT}
                        />
                      </Field>
                      <Field
                        label="Kota / Kabupaten"
                        required
                        hint="Cukup nama kota, tanpa alamat jalan."
                      >
                        <input
                          type="text"
                          value={pel.kota}
                          onChange={(e) => set({ kota: e.target.value })}
                          placeholder="Morowali"
                          className={INPUT}
                        />
                      </Field>
                    </div>
                    <Field label="NPWP" hint="Tampil di Work Order. Boleh dikosongkan.">
                      <input
                        type="text"
                        value={editingRecord.npwp || ''}
                        onChange={(e) => set({ npwp: e.target.value })}
                        placeholder="00.331.098.5-101.4000"
                        className={`${INPUT} font-mono`}
                      />
                    </Field>
                    <Field label="Alamat Lengkap" hint="Jalan, kelurahan, kecamatan. Tercetak di surat penawaran dan Work Order.">
                      <textarea
                        value={pel.alamat}
                        onChange={(e) => set({ alamatPerusahaan: e.target.value })}
                        rows={2}
                        placeholder="Gedung IMIP, Jl. Batu Mulia 8, Kel. Maruya Utara, Kec. Kembangan"
                        className="w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-violet-400 outline-none"
                      />
                    </Field>
                  </Section>

                  <Section
                    icon={<FileText className="w-4 h-4" />}
                    title="Informasi Penawaran"
                    desc="Isi data surat penawaran yang dikirim ke pelanggan."
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="No Penawaran" required>
                        <input
                          type="text"
                          value={editingRecord.noPenawaran}
                          onChange={(e) => set({ noPenawaran: e.target.value })}
                          placeholder="131.A/SDP/PNW/IX/2026"
                          className={`${INPUT} font-mono`}
                        />
                      </Field>
                      <Field label="Tanggal Penawaran">
                        <input
                          type="date"
                          value={editingRecord.tanggalPenawaran}
                          onChange={(e) => set({ tanggalPenawaran: e.target.value })}
                          className={INPUT}
                        />
                      </Field>
                      <Field label="Perihal" hint="Judul surat penawaran, mis. “Penawaran SLO”.">
                        <input
                          type="text"
                          value={editingRecord.perihal}
                          onChange={(e) => set({ perihal: e.target.value })}
                          className={INPUT}
                        />
                      </Field>
                      <Field label="Lampiran">
                        <input
                          type="text"
                          value={editingRecord.lampiran}
                          onChange={(e) => set({ lampiran: e.target.value })}
                          className={INPUT}
                        />
                      </Field>
                      <Field label="Tanggal Permintaan Pelanggan" hint="Tanggal pelanggan meminta penawaran.">
                        <input
                          type="date"
                          value={editingRecord.tanggalPermintaan}
                          onChange={(e) => set({ tanggalPermintaan: e.target.value })}
                          className={INPUT}
                        />
                      </Field>
                      <Field
                        label="Masa Berlaku (hari)"
                        hint={berlakuSampai ? `Penawaran berlaku sampai ${formatDateShort(berlakuSampai)}.` : undefined}
                      >
                        <input
                          type="number"
                          min={1}
                          value={editingRecord.masaBerlaku}
                          onChange={(e) => set({ masaBerlaku: Number(e.target.value) || 0 })}
                          className={`${INPUT} tabular-nums`}
                        />
                      </Field>
                      <Field label="Status Penawaran">
                        <select
                          value={editingRecord.status}
                          onChange={(e) => set({ status: e.target.value as JoSoStatus })}
                          className={INPUT}
                        >
                          {STATUS_SOJO_LIST.map((st) => (
                            <option key={st} value={st}>
                              {JOSO_STATUS_LABEL[st]}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  </Section>

                  <Section
                    icon={<Zap className="w-4 h-4" />}
                    title="Instalasi yang Diuji"
                    desc="Diisi sekali di sini, otomatis dipakai di Proyek, Surat Tugas, dan langkah PO."
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="Jenis Instalasi" required>
                        <select
                          value={
                            JENIS_INSTALASI_SOJO.includes(editingRecord.jenisInstalasiPenawaran)
                              ? editingRecord.jenisInstalasiPenawaran
                              : JENIS_INSTALASI_SOJO[0]
                          }
                          onChange={(e) =>
                            set({
                              jenisInstalasiPenawaran: e.target.value,
                              jenisInstalasiJo: e.target.value,
                            })
                          }
                          className={INPUT}
                        >
                          {JENIS_INSTALASI_SOJO.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Kapasitas" hint="Contoh: 150 kV, 20 kV, 2x50 MW. Masuk ke kolom Kapasitas di Proyek.">
                        <input
                          type="text"
                          value={editingRecord.kapasitas || ''}
                          onChange={(e) => set({ kapasitas: e.target.value })}
                          placeholder="150 kV"
                          className={INPUT}
                        />
                      </Field>
                    </div>
                  </Section>

                  <Section
                    icon={<Wallet className="w-4 h-4" />}
                    title="Rincian Item & Harga"
                    desc="Pilih kategori tiap item: Jasa (uji/SLO) atau Mobilisasi (transport & akomodasi)."
                    action={
                      <button
                        type="button"
                        onClick={addItemRow}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 text-xs font-semibold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Tambah Item
                      </button>
                    }
                  >
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-left border-collapse min-w-[820px]">
                        <thead>
                          <tr className="bg-[#F4F3FF] text-slate-700 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                            <th className="py-3 px-3.5">Nama Item</th>
                            <th className="py-3 px-2 text-center w-32">Kategori</th>
                            <th className="py-3 px-2 text-center w-24">Satuan</th>
                            <th className="py-3 px-3 text-right w-40">Harga Satuan (Rp)</th>
                            <th className="py-3 px-2 text-center w-20">Qty</th>
                            <th className="py-3 px-3.5 text-right w-40">Sub Total</th>
                            <th className="py-3 px-2 w-10" aria-label="Hapus"></th>
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
                                    onChange={(e) => updateItem(item.id, { itemName: e.target.value })}
                                    placeholder="SLO Gardu Induk 150 kV"
                                    className="w-full h-8 rounded-md border border-slate-200 px-2.5 text-xs text-slate-800 focus:border-violet-400 outline-none"
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <select
                                    value={itemKategori(item)}
                                    onChange={(e) =>
                                      updateItem(item.id, {
                                        kategori: e.target.value as 'jasa' | 'mobilisasi',
                                      })
                                    }
                                    className="w-full h-8 rounded-md border border-slate-200 px-1.5 text-xs text-slate-700 focus:border-violet-400 outline-none"
                                  >
                                    <option value="jasa">Jasa</option>
                                    <option value="mobilisasi">Mobilisasi</option>
                                  </select>
                                </td>
                                <td className="py-2 px-2">
                                  <select
                                    value={item.satuan}
                                    onChange={(e) => updateItem(item.id, { satuan: e.target.value })}
                                    className="w-full h-8 rounded-md border border-slate-200 px-1.5 text-xs text-center text-slate-700 focus:border-violet-400 outline-none"
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
                            <td colSpan={5} className="py-2.5 px-3.5 text-right font-bold text-slate-700">
                              Jumlah
                            </td>
                            <td className="py-2.5 px-3.5 text-right font-bold tabular-nums text-slate-900">
                              {formatDecimalId(totals.jumlah)}
                            </td>
                            <td />
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td colSpan={5} className="py-2 px-3.5 text-right font-bold text-slate-700">
                              <span className="inline-flex items-center gap-1.5 justify-end">
                                PPN
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={editingRecord.ppnRate}
                                  onChange={(e) => set({ ppnRate: Number(e.target.value) || 0 })}
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
                            <td colSpan={5} className="py-2.5 px-3.5 text-right font-extrabold text-slate-900">
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
                  </Section>
                </>
              )}

              {/* ================= LANGKAH 2: PO / JOB ORDER ================= */}
              {editorTab === 'joso' && (
                <>
                  <Section
                    icon={<FileText className="w-4 h-4" />}
                    title="Data PO / SPK dari Pelanggan"
                    desc="Isi setelah pelanggan menerbitkan PO atau SPK."
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="PO No" required>
                        <input
                          type="text"
                          value={editingRecord.poNo}
                          onChange={(e) => set({ poNo: e.target.value })}
                          placeholder="058/SPK/SDP/X/2026"
                          className={`${INPUT} font-mono`}
                        />
                      </Field>
                      <Field
                        label="Title (Nama Proyek)"
                        required
                        hint="Nama yang tampil di Daftar Pekerjaan dan Rekap."
                      >
                        <input
                          type="text"
                          value={editingRecord.title}
                          onChange={(e) => set({ title: e.target.value })}
                          placeholder="SLO GI PT.IMIP"
                          className={INPUT}
                        />
                      </Field>
                      <Field label="Tanggal PO">
                        <input
                          type="date"
                          value={editingRecord.poDate}
                          onChange={(e) => set({ poDate: e.target.value })}
                          className={INPUT}
                        />
                      </Field>
                      <Field
                        label="Batas Waktu Pekerjaan / PO Expired"
                        hint="Tanggal terakhir pekerjaan harus selesai menurut PO."
                      >
                        <input
                          type="date"
                          value={editingRecord.poExpiredDate}
                          onChange={(e) => set({ poExpiredDate: e.target.value })}
                          className={INPUT}
                        />
                      </Field>
                    </div>
                  </Section>

                  <Section
                    icon={<Wallet className="w-4 h-4" />}
                    title="Pembayaran"
                    desc="Payment Term terisi otomatis dari DP, tetapi tetap bisa diubah."
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field
                        label="DP (%)"
                        hint={`Nominal DP ≈ ${formatRupiah(dpNominal)} dari total ${formatRupiah(totals.total)} (incl. PPN).`}
                      >
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={editingRecord.dp}
                          onChange={(e) => onDpChange(Number(e.target.value))}
                          className={`${INPUT} tabular-nums`}
                        />
                      </Field>
                      <Field label="Payment Term" hint="Contoh: DP 30, Termin 1 40, PL 30.">
                        <input
                          type="text"
                          value={editingRecord.paymentTerm}
                          onChange={(e) => set({ paymentTerm: e.target.value })}
                          className={INPUT}
                        />
                      </Field>
                    </div>
                  </Section>

                  <Section
                    icon={<FileText className="w-4 h-4" />}
                    title="Kontak & Catatan Work Order"
                    desc="Dicetak pada dokumen Work Order yang ditandatangani pelanggan."
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="Kontak Personal (Nama)" hint="Penanggung jawab PO di pihak pelanggan.">
                        <input
                          type="text"
                          value={editingRecord.kontakNama || ''}
                          onChange={(e) => set({ kontakNama: e.target.value })}
                          placeholder="Nirmawanuddin"
                          className={INPUT}
                        />
                      </Field>
                      <Field label="Kontak Personal (Telepon / WA)">
                        <input
                          type="text"
                          value={editingRecord.kontakTelp || ''}
                          onChange={(e) => set({ kontakTelp: e.target.value })}
                          placeholder="0852-1020-1510"
                          className={INPUT}
                        />
                      </Field>
                    </div>
                    <Field
                      label="Catatan Work Order"
                      hint="Satu butir per baris. Kosongkan untuk memakai catatan otomatis dari DP (lihat contoh abu-abu)."
                    >
                      <textarea
                        value={editingRecord.catatanWo || ''}
                        onChange={(e) => set({ catatanWo: e.target.value })}
                        rows={4}
                        placeholder={defaultWoCatatan(editingRecord.dp).join('\n')}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-violet-400 outline-none"
                      />
                    </Field>
                  </Section>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-bold text-slate-800 inline-flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-violet-600" /> Diambil otomatis dari langkah 1
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditorTab('penawaran')}
                        className="text-[11px] font-semibold text-violet-700 hover:underline cursor-pointer"
                      >
                        Ubah di langkah 1
                      </button>
                    </div>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Pelanggan</dt>
                        <dd>{missing(pel.nama)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Kota</dt>
                        <dd>{missing(pel.kota)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Jenis Instalasi</dt>
                        <dd className="font-semibold text-slate-800 text-right">
                          {editingRecord.jenisInstalasiPenawaran.split('|')[0].trim()}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Kapasitas</dt>
                        <dd>{missing(editingRecord.kapasitas || '')}</dd>
                      </div>
                    </dl>
                  </div>
                </>
              )}

              {/* ================= LANGKAH 3: DOKUMEN & KIRIM ================= */}
              {editorTab === 'document' && (
                <>
                  <Section
                    icon={<FolderOpen className="w-4 h-4" />}
                    title="Dokumen PO / SPK"
                    desc="Unggah PO/SPK resmi dari pelanggan (PDF, gambar, Word, atau Excel)."
                  >
                    {editingRecord.documents.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 py-6 text-center text-xs text-slate-400">
                        Belum ada dokumen terunggah untuk SO/JO ini.
                      </div>
                    ) : (
                      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                        {editingRecord.documents.map((doc) => (
                          <li key={doc.id} className="flex items-center gap-3 px-3.5 py-2.5 text-xs">
                            <FileText className="w-4 h-4 text-violet-500 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-slate-800 truncate">{doc.docName}</div>
                              <div className="font-mono text-[10.5px] text-slate-500 truncate">
                                {doc.filePath}
                                {doc.fileSize ? ` · ${formatFileSize(doc.fileSize)} · ${formatDateShort(doc.uploadedAt)}` : ''}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeDocument(doc.id)}
                              title="Hapus Dokumen"
                              className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex flex-wrap items-center gap-2.5">
                      <input
                        type="text"
                        value={docNameInput}
                        onChange={(e) => setDocNameInput(e.target.value)}
                        placeholder="Nama dokumen (mis. PO / SPK)"
                        className="flex-1 min-w-[180px] h-9 rounded-lg border border-slate-200 px-3 text-xs text-slate-800 focus:border-violet-400 outline-none"
                      />
                      <input
                        key={fileInputKey}
                        type="file"
                        accept=".pdf,image/*,.doc,.docx,.xls,.xlsx"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        className="text-xs text-slate-600 max-w-[230px] file:mr-2 file:py-1.5 file:px-2.5 file:rounded file:border file:border-slate-300 file:text-xs file:bg-slate-100 hover:file:bg-slate-200"
                      />
                      <button
                        type="button"
                        onClick={handleUploadDoc}
                        className="inline-flex items-center gap-1.5 px-4 h-9 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold shadow-xs cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" /> Upload
                      </button>
                    </div>
                  </Section>

                  <Section
                    icon={<Send className="w-4 h-4" />}
                    title="Kirim Status Pekerjaan ke Admin"
                    desc="Setelah PO terbit, pilih status kesiapan. Admin meneruskannya ke PJT."
                    action={
                      editingRecord.sentToAdminAt ? (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-semibold">
                          Terkirim · {formatDateTime(editingRecord.sentToAdminAt)}
                        </span>
                      ) : undefined
                    }
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {(
                        [
                          [
                            'ready_wait_dp',
                            'Siap Dikerjakan (Menunggu DP)',
                            'PO sudah terbit, Admin & PJT mulai memproses sambil menunggu pembayaran DP.',
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
                                ? 'bg-violet-50/60 border-violet-500 shadow-2xs'
                                : 'bg-white border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="radio"
                              name="salesReadiness"
                              checked={active}
                              onChange={() => set({ salesReadiness: val })}
                              className="mt-0.5 accent-violet-600"
                            />
                            <div>
                              <div className="text-xs font-bold text-slate-900">{title}</div>
                              <div className="text-[11px] text-slate-600 mt-0.5">{desc}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                    {Number(editingRecord.dp) === 0 && (editingRecord.salesReadiness || 'ready_wait_dp') === 'ready_wait_dp' && (
                      <p className="text-[11px] text-amber-700 font-medium">
                        DP pada langkah 2 bernilai 0%. Pertimbangkan memilih “Tanpa DP”.
                      </p>
                    )}
                    <Field label="Catatan untuk Admin (opsional)">
                      <textarea
                        value={editingRecord.salesMessage || ''}
                        onChange={(e) => set({ salesMessage: e.target.value })}
                        rows={3}
                        placeholder="Contoh: PO sudah terbit, mohon diteruskan ke PJT untuk penunjukan Leader Tenaga Teknik."
                        className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-800 focus:border-violet-400 outline-none"
                      />
                    </Field>
                  </Section>
                </>
              )}
            </fieldset>

            {/* Bar aksi */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Kembali ke Rekap
                </button>
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => handleSave(false)}
                    className="px-4 py-2 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold shadow-xs cursor-pointer"
                  >
                    Simpan
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {stepIdx > 0 && (
                  <button
                    type="button"
                    onClick={() => setEditorTab(STEPS[stepIdx - 1][0])}
                    className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Sebelumnya
                  </button>
                )}
                {stepIdx < STEPS.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setEditorTab(STEPS[stepIdx + 1][0])}
                    className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                  >
                    Lanjut <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  !isReadOnly && (
                    <button
                      type="button"
                      onClick={() => handleSave(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" /> Simpan &amp; Kirim ke Admin
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ============ PANEL SAMPING ============ */}
        <aside className="space-y-4 xl:sticky xl:top-4">
          <div className="rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#6D28D9] text-white p-5 shadow-sm">
            <div className="text-[11px] font-bold uppercase tracking-wider text-violet-100">
              Total (incl. PPN {editingRecord.ppnRate}%)
            </div>
            <div className="font-display text-2xl font-extrabold tabular-nums mt-1 break-words">
              {formatRupiah(totals.total)}
            </div>
            <div className="mt-3 pt-3 border-t border-white/20 grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <div className="text-violet-200">Sebelum PPN</div>
                <div className="font-semibold tabular-nums">{formatRupiah(totals.jumlah)}</div>
              </div>
              <div>
                <div className="text-violet-200">DP {editingRecord.dp}%</div>
                <div className="font-semibold tabular-nums">{formatRupiah(dpNominal)}</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200/90 shadow-xs p-4">
            <h3 className="font-display text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-blue-600" /> Tampil di Daftar Pekerjaan
            </h3>
            <p className="text-[10.5px] text-slate-500 mt-0.5 mb-3">Pratinjau data yang akan dikirim ke Proyek.</p>
            <dl className="space-y-1.5 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Perusahaan</dt>
                <dd>{missing(pel.nama)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Kota</dt>
                <dd>{missing(pel.kota)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Jenis</dt>
                <dd className="font-semibold text-slate-800 text-right">
                  {projInfo.jenis} · {projInfo.sub}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Kapasitas</dt>
                <dd>{missing(editingRecord.kapasitas || '')}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Jasa</dt>
                <dd className="font-semibold tabular-nums text-slate-800">{formatRupiah(jasa)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Mobilisasi</dt>
                <dd className="font-semibold tabular-nums text-slate-800">{formatRupiah(mob)}</dd>
              </div>
            </dl>

            {!isReadOnly && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <label className="block text-[10.5px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Sinkron ke
                </label>
                <select
                  value={!syncWithProject ? '__none__' : editingRecord.projectId || '__new__'}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '__none__') {
                      setSyncWithProject(false);
                    } else if (v === '__new__') {
                      setSyncWithProject(true);
                      set({ projectId: undefined });
                    } else {
                      setSyncWithProject(true);
                      set({ projectId: v });
                    }
                  }}
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700"
                  title="Sinkronkan dengan Proyek & Tugas"
                >
                  <option value="__new__">Buat / perbarui proyek otomatis</option>
                  {projects.map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      Proyek {pr.no} ({pr.perusahaan})
                    </option>
                  ))}
                  <option value="__none__">Jangan sinkronkan ke Proyek</option>
                </select>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setWoRecord(editingRecord)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 hover:bg-violet-100 text-violet-800 text-xs font-bold px-4 py-3 shadow-xs cursor-pointer"
          >
            <FileText className="w-4 h-4" /> Lihat &amp; Unduh Work Order (PDF)
          </button>

          <div className="rounded-2xl bg-white border border-slate-200/90 shadow-xs p-4">
            <h3 className="font-display text-sm font-bold text-slate-900 mb-2.5">Kelengkapan Data</h3>
            <ul className="space-y-1.5">
              {checks.map((c) => (
                <li key={c.label}>
                  <button
                    type="button"
                    onClick={() => setEditorTab(c.step)}
                    className="w-full flex items-center gap-2 text-left text-xs cursor-pointer group"
                  >
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                        c.ok ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-transparent'
                      }`}
                    >
                      <Check className="w-3 h-3" />
                    </span>
                    <span className={c.ok ? 'text-slate-700' : 'text-slate-500 group-hover:text-violet-700'}>
                      {c.label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>
        {woRecord && (
          <WorkOrderModal
            record={woRecord}
            signatures={signatures}
            onClose={() => setWoRecord(null)}
            onToast={onToast}
          />
        )}
      </div>
    );
  }

  // ======================== REKAP SO/JO VIEW ========================
  return (
    <div className="space-y-5">
      {woRecord && (
        <WorkOrderModal
          record={woRecord}
          signatures={signatures}
          onClose={() => setWoRecord(null)}
          onToast={onToast}
        />
      )}
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
                {JOSO_STATUS_LABEL[st]}
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
                          {(() => {
                            const pl = getPelanggan(rec);
                            return pl.nama
                              ? `${pl.nama}${pl.kota ? ` · ${pl.kota}` : ''}`
                              : rec.pelangganAlamat || rec.kepadaAlamat || '-';
                          })()}
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
                            STATUS_BADGE[statusOf(rec)]
                          }`}
                        >
                          {JOSO_STATUS_LABEL[statusOf(rec)]}
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
                          <button
                            type="button"
                            onClick={() => setWoRecord(rec)}
                            title="Lihat & unduh Work Order (PDF)"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[11px] font-semibold cursor-pointer"
                          >
                            <Download className="w-3 h-3" /> Work Order
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
