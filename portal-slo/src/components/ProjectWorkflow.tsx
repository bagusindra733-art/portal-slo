import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Briefcase,
  Building2,
  Camera,
  CheckCircle2,
  Download,
  Eye,
  FileCheck,
  FilePlus2,
  FileText,
  Mail,
  MessageSquare,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Upload,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  AppDatabaseState,
  AttendanceRecord,
  DOC_CONFIG,
  FileMeta,
  Inspector,
  JENIS_PROYEK,
  LEADER_ISSUE_PRESETS,
  LeaderAdminMessage,
  ORG,
  Project,
  Role,
  SalesReadiness,
  SavedDocType,
  STATUS_LABEL,
  STEP_INDEX,
  STEPS,
  TESTS,
  Tool,
  UserSession,
} from '../types/portal';
import {
  buildPenawaranHtml,
  buildSloValidationHtml,
  buildSpkSpdHtml,
  certStatus,
  checksEvaluation,
  createTteStamp,
  downloadTextFile,
  formatDateShort,
  formatDateTime,
  formatFileSize,
  formatRupiah,
  getMissingSignedScans,
  hasAllRequiredSignedScans,
  isLocalCity,
  isSamePersonName,
  isoToday,
  prepFile,
  REQUIRED_SIGNED_DOCS,
  routeDoc,
  SALES_READINESS_LABEL,
  SAVED_DOC_LABELS,
  STATUS_COLORS,
} from '../utils/portalUtils';
import { getVaultFile, triggerDataUrlDownload } from '../utils/fileVault';
import { exportElementToPdf } from '../utils/pdfExport';
import { QrBadge } from './QrBadge';
import { CameraModal } from './CameraModal';
import { DocTab } from './DocEditorSuite';

interface ProjectWorkflowProps {
  mode: 'proyek' | 'profil' | 'baru';
  role: Role;
  session: UserSession;
  state: AppDatabaseState;
  selectedProjectId: string | null;
  activeInspectorId: string;
  onSelectInspector: (id: string) => void;
  onSelectProject: (id: string | null) => void;
  onUpdateProject: (updated: Project) => void;
  onCreateProject: (created: Project) => void;
  onGoToBaru: () => void;
  onOpenProjectDocInEditor: (project: Project, docTab: DocTab) => void;
  onApplyTteToEditors?: (project: Project, docTte: NonNullable<Project['docTte']>) => void;
  onOpenJoSoEditor?: (joSoId: string) => void;
  onUploadSignedScan?: (
    projectId: string | null,
    docType: SavedDocType,
    file: File,
    archiveId?: string
  ) => Promise<void>;
  onToast: (msg: string) => void;
}

export function ProjectWorkflow({
  mode,
  role,
  session,
  state,
  selectedProjectId,
  activeInspectorId,
  onSelectInspector: _onSelectInspector,
  onSelectProject,
  onUpdateProject,
  onCreateProject,
  onGoToBaru,
  onOpenProjectDocInEditor,
  onApplyTteToEditors,
  onOpenJoSoEditor,
  onUploadSignedScan,
  onToast,
}: ProjectWorkflowProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [adminViewFilter, setAdminViewFilter] = useState<
    'all' | 'inbox' | 'kendala' | 'menu_pekerjaan'
  >('all');

  // New RFQ Draft state
  const [rfqPt, setRfqPt] = useState('');
  const [rfqKota, setRfqKota] = useState('');
  const [rfqJenis, setRfqJenis] = useState(JENIS_PROYEK[0][0]);
  const [rfqKap, setRfqKap] = useState('');
  const [rfqUnit, setRfqUnit] = useState<'kVA' | 'MVA' | 'MW'>('kVA');
  const [rfqDocs, setRfqDocs] = useState<Record<string, FileMeta>>({});

  // Sales Offer & Readiness state
  const [jasaVal, setJasaVal] = useState<number>(15000000);
  const [mobVal, setMobVal] = useState<number>(1500000);
  const [ppnVal, setPpnVal] = useState<number>(11);
  const [sloUploadMeta, setSloUploadMeta] = useState<FileMeta | null>(null);
  const [salesReadyChoice, setSalesReadyChoice] = useState<SalesReadiness>('ready_wait_dp');
  const [salesReadyMsg, setSalesReadyMsg] = useState('');

  // Teknis -> PJT -> Leader Assignment state
  const [adminForwardNote, setAdminForwardNote] = useState('');
  const [adminTargetPjt, setAdminTargetPjt] = useState('');
  const [pjtSelectedLead, setPjtSelectedLead] = useState('');
  const [leaderMembers, setLeaderMembers] = useState<string[]>([]);
  const [leaderTools, setLeaderTools] = useState<string[]>([]);
  const [selectedIns, setSelectedIns] = useState<string[]>([]);
  const [selectedLead, setSelectedLead] = useState<string>('');
  const [selectedTools, setSelectedTools] = useState<string[]>([]);

  // Leader Tenaga Teknik -> Admin Teknis Kendala/Keterangan state
  const [leaderIssueCategory, setLeaderIssueCategory] = useState<string>(LEADER_ISSUE_PRESETS[0]);
  const [leaderIssueCustom, setLeaderIssueCustom] = useState('');
  const [leaderIssueNote, setLeaderIssueNote] = useState('');
  const [adminIssueReplyMap, setAdminIssueReplyMap] = useState<Record<string, string>>({});

  // Inspektor Findings & Camera state
  const [findingRef, setFindingRef] = useState('PUIL');
  const [findingText, setFindingText] = useState('');
  const [camModal, setCamModal] = useState<{ project: Project; type: 'in' | 'out' } | null>(null);

  // PJT note state
  const [pjtNote, setPjtNote] = useState('');

  // Preview Modal HTML & Signed Scan Preview Modal
  const [previewDoc, setPreviewDoc] = useState<{ title: string; html: string; filename: string } | null>(null);
  const [uploadingScanType, setUploadingScanType] = useState<SavedDocType | null>(null);
  const [scanPreviewModal, setScanPreviewModal] = useState<{
    title: string;
    name: string;
    mimeType: string;
    dataUrl: string;
  } | null>(null);
  const previewIframeRef = useRef<HTMLIFrameElement>(null);

  const appendLog = (p: Project, msg: string): Project => ({
    ...p,
    log: [...p.log, [new Date().toISOString(), msg]],
  });

  // 1. PROFIL LIT VIEW
  if (mode === 'profil') {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="rounded-2xl bg-white border border-slate-200/80 p-6 shadow-xs">
            <h3 className="font-display text-base font-bold text-slate-900 mb-3">
              Legalitas Lembaga Inspeksi Teknik
            </h3>
            <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-slate-500 font-medium">Lembaga</dt>
              <dd className="font-semibold text-slate-900">{ORG}</dd>
              <dt className="text-slate-500 font-medium">IUJPTL</dt>
              <dd className="text-slate-700 font-mono">Terdaftar Kementerian ESDM</dd>
              <dt className="text-slate-500 font-medium">Akreditasi</dt>
              <dd className="text-slate-700 font-mono">KAN LSSM-053-IDN / ESDM</dd>
              <dt className="text-slate-500 font-medium">Kantor</dt>
              <dd className="text-slate-700">Jl. GayungKebonsari VII/2, Surabaya 60231</dd>
            </dl>
          </div>
          <div className="rounded-2xl bg-white border border-slate-200/80 p-6 shadow-xs">
            <h3 className="font-display text-base font-bold text-slate-900 mb-3">
              Ruang Lingkup Sertifikasi Laik Operasi
            </h3>
            <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-700">
              <li>Distribusi Tenaga Listrik Tegangan Menengah (TM)</li>
              <li>Transmisi Tegangan Tinggi (TT) &amp; Gardu Induk (GI)</li>
              <li>Pembangkit Tenaga Listrik: PLTD, PLTU, PLTG, PLTGU, PLTS, PLTA, PLTP, BESS</li>
              <li>Instalasi Pemanfaatan Tenaga Listrik Konsumen / Industri</li>
            </ul>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200/80 p-6 shadow-xs">
          <h3 className="font-display text-base font-bold text-slate-900 mb-3">
            Alur Layanan Sertifikasi Laik Operasi
          </h3>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-700">
            <li>Ajukan RFQ dan unggah dokumen awal (NIB, NIDI, SLD)</li>
            <li>Terima penawaran resmi, setujui, lalu lakukan pembayaran dan unggah PO &amp; bukti transfer</li>
            <li>Admin Teknis menugaskan tim inspektor &amp; alat uji dengan paket Surat Tugas, Surat Jalan, JSA, dan SPT/SPD</li>
            <li>Pengujian lapangan dengan absensi selfie GPS dan pengisian LHPP</li>
            <li>Evaluasi Penanggung Jawab Teknik (PJT) dan penerbitan SLO ber-QR</li>
          </ol>
          {(role === 'teknis' || role === 'klien') && (
            <button
              type="button"
              onClick={onGoToBaru}
              className="mt-5 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 inline-flex items-center gap-2 cursor-pointer"
            >
              <FilePlus2 className="w-4 h-4" /> Ajukan RFQ Baru
            </button>
          )}
        </div>
      </div>
    );
  }

  // 2. AJUKAN RFQ VIEW
  if (mode === 'baru') {
    if (role !== 'teknis' && role !== 'klien') {
      return (
        <div className="rounded-2xl bg-white border border-slate-200/80 p-6 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-amber-700">
            <Eye className="w-5 h-5" />
            <h3 className="font-display text-base font-bold text-slate-900">
              Pengajuan RFQ Baru Hanya Melalui Admin / Klien
            </h3>
          </div>
          <p className="text-sm text-slate-600">
            Sesuai tata kelola portal, tugas input permohonan RFQ baru dilakukan oleh{' '}
            <b>Admin Teknis</b> (atau pengajuan langsung dari <b>Klien</b>). Akun{' '}
            <b>{role === 'direktur' ? 'Direktur (Review Only)' : 'Anda'}</b> tidak dapat menginput
            RFQ baru.
          </p>
        </div>
      );
    }

    const docFields: [string, string, boolean][] = [
      ['NIB', 'NIB', true],
      ['NIDI', 'NIDI', true],
      ['SLD', 'Single Line Diagram (SLD)', true],
      ['Spesifikasi', 'Spesifikasi peralatan utama', false],
      ['Layout', 'Layout pembumian', false],
    ];

    const handleUploadDraft = async (key: string, files: FileList | null) => {
      if (!files?.length) return;
      try {
        const meta = await prepFile(files[0]);
        setRfqDocs((prev) => ({ ...prev, [key]: { k: key, ...meta } }));
        onToast(`Berkas ${key} diterima`);
      } catch (err: unknown) {
        onToast(err instanceof Error ? err.message : 'Gagal membaca berkas');
      }
    };

    const handleSubmitRfq = (e: React.FormEvent) => {
      e.preventDefault();
      if (!rfqPt.trim() || !rfqKota.trim() || !rfqKap.trim()) {
        onToast('Lengkapi nama perusahaan, kota lokasi, dan kapasitas daya');
        return;
      }
      const missing = ['NIB', 'NIDI', 'SLD'].filter((k) => !rfqDocs[k]);
      if (missing.length > 0) {
        onToast(`Unggah dokumen wajib: ${missing.join(', ')}`);
        return;
      }
      const [jenis, sub] = rfqJenis.split('|') as [Project['jenis'], string];
      const nextSeq = state.seq + 1;
      const no = `RFQ-2611-${String(nextSeq).padStart(3, '0')}`;
      const newProj: Project = {
        id: `p-${Date.now()}`,
        no,
        perusahaan: rfqPt.trim(),
        kota: rfqKota.trim(),
        jenis,
        sub,
        kap: `${rfqKap.trim()} ${rfqUnit}`,
        status: 'rfq',
        files: Object.values(rfqDocs),
        penawaran: null,
        team: null,
        docs: { issued: false, ack: false },
        att: [],
        form: { items: {}, photos: [], submitted: false },
        finds: [],
        bap: null,
        pjt: null,
        slo: null,
        po: null,
        transfer: null,
        log: [[new Date().toISOString(), 'RFQ diajukan klien']],
      };
      onCreateProject(newProj);
      setRfqPt('');
      setRfqKota('');
      setRfqKap('');
      setRfqDocs({});
      onToast(`RFQ berhasil dikirim: ${no}`);
    };

    return (
      <form
        onSubmit={handleSubmitRfq}
        className="rounded-2xl bg-white border border-slate-200/80 p-6 shadow-xs space-y-5"
      >
        <div>
          <h3 className="font-display text-lg font-bold text-slate-900">
            Ajukan Permintaan Penawaran (RFQ)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Maks. 5 MB per berkas; gambar dikompres otomatis. Penentuan SPT/SPD otomatis berdasarkan lokasi proyek.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Nama Perusahaan / Pemohon
            </label>
            <input
              value={rfqPt}
              onChange={(e) => setRfqPt(e.target.value)}
              placeholder="Contoh: PT Industri Energi Nusantara"
              className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Kota / Kabupaten Lokasi Proyek
            </label>
            <input
              list="kota-rfq-list"
              value={rfqKota}
              onChange={(e) => setRfqKota(e.target.value)}
              placeholder="Surabaya / Gresik / Kutai Timur"
              className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
            />
            <datalist id="kota-rfq-list">
              <option value="Surabaya" />
              <option value="Sidoarjo" />
              <option value="Gresik" />
              <option value="Mojokerto" />
              <option value="Jakarta" />
              <option value="Balikpapan" />
              <option value="Kutai Timur" />
              <option value="Kab. Morowali" />
            </datalist>
            <p className="mt-1 text-[11px] text-slate-500">
              {rfqKota.trim()
                ? `Dokumen otomatis: ${routeDoc(rfqKota)} (${isLocalCity(rfqKota) ? 'Surabaya/Sidoarjo/Gresik' : 'seluruh Indonesia luar area lokal'})`
                : 'Penerbitan SPT (Surabaya/Sidoarjo/Gresik) atau SPD (luar area) ditentukan otomatis dari lokasi.'}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Jenis Instalasi
            </label>
            <select
              value={rfqJenis}
              onChange={(e) => setRfqJenis(e.target.value)}
              className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
            >
              {JENIS_PROYEK.map(([val, lbl]) => (
                <option key={val} value={val}>
                  {lbl}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Kapasitas Daya
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                step="any"
                value={rfqKap}
                onChange={(e) => setRfqKap(e.target.value)}
                placeholder="150"
                className="flex-1 h-10 rounded-xl border border-slate-200 px-3 text-sm tabular-nums"
              />
              <select
                value={rfqUnit}
                onChange={(e) => setRfqUnit(e.target.value as 'kVA' | 'MVA' | 'MW')}
                className="w-24 h-10 rounded-xl border border-slate-200 px-2.5 text-sm"
              >
                <option value="kVA">kVA</option>
                <option value="MVA">MVA</option>
                <option value="MW">MW</option>
              </select>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
            Dokumen Awal Persyaratan
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {docFields.map(([k, lbl, req]) => (
              <div key={k} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {lbl} {req && <span className="text-red-500">*</span>}
                  {rfqDocs[k] && (
                    <span className="ml-2 text-emerald-700 font-medium">
                      ✓ {rfqDocs[k].name} ({formatFileSize(rfqDocs[k].size)})
                    </span>
                  )}
                </label>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(e) => handleUploadDraft(k, e.target.files)}
                  className="text-xs text-slate-600 w-full"
                />
              </div>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 shadow-sm inline-flex items-center gap-2 cursor-pointer"
        >
          <Send className="w-4 h-4" /> Kirim RFQ
        </button>
      </form>
    );
  }

  // 3. PROJECT DETAIL VIEW
  const selectedProject = selectedProjectId
    ? state.proj.find((p) => p.id === selectedProjectId) || null
    : null;

  useEffect(() => {
    if (!selectedProject) return;
    setAdminForwardNote(selectedProject.adminForwardNote || '');
    setAdminTargetPjt(selectedProject.pjtName || '');
    setPjtSelectedLead(selectedProject.team?.lead || '');
    setLeaderMembers(
      selectedProject.team?.ins.length
        ? selectedProject.team.ins
        : selectedProject.team?.lead
        ? [selectedProject.team.lead]
        : []
    );
    setLeaderTools(selectedProject.team?.tools || []);
    setSalesReadyChoice(selectedProject.salesReadiness || 'ready_wait_dp');
    setSalesReadyMsg(selectedProject.salesMessage || '');
  }, [selectedProject?.id, selectedProject?.team?.lead]);

  const currentPjtName = session.pjtName || (role === 'pjt' ? session.name : '');
  const resolvedInspectorId = session.inspectorId || activeInspectorId;
  const activeIns: Inspector =
    state.insp.find((i) => i.id === resolvedInspectorId) || state.insp[0];

  if (selectedProject) {
    const p = selectedProject;
    const isAssignedAsTtkHere =
      role === 'pjt' &&
      Boolean(
        p.team &&
          (p.team.ins.includes(activeIns.id) || p.team.lead === activeIns.id) &&
          !isSamePersonName(p.pjtName, currentPjtName)
      );
    const stepIdx = STEP_INDEX[p.status];
    const findIns = (id: string) => state.insp.find((x) => x.id === id);
    const findTool = (id: string) => state.tools.find((x) => x.id === id);
    const openFindingsCard = (canAdd: boolean, canClose: boolean) => (
      <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs space-y-3">
        <h3 className="font-display text-base font-bold text-slate-900">
          Temuan Ketidaksesuaian
        </h3>
        {p.finds.length === 0 ? (
          <p className="text-xs text-slate-500">Belum ada temuan tercatat.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {p.finds.map((f) => (
              <div key={f.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs">
                  <span className="font-bold text-slate-900">{f.ref}</span> ·{' '}
                  <span className="text-slate-700">{f.txt}</span>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {formatDateShort(f.at)}
                    {f.closed ? ` · ditutup ${formatDateShort(f.closed)}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                      f.st === 'open' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {f.st === 'open' ? 'Terbuka' : 'Ditutup'}
                  </span>
                  {canClose && f.st === 'open' && (
                    <button
                      type="button"
                      onClick={() => {
                        const nextFinds = p.finds.map((x) =>
                          x.id === f.id ? { ...x, st: 'closed' as const, closed: isoToday() } : x
                        );
                        onUpdateProject(appendLog({ ...p, finds: nextFinds }, 'Klien menutup temuan'));
                        onToast('Perbaikan temuan dikonfirmasi');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-800 cursor-pointer"
                    >
                      Konfirmasi perbaikan
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {canAdd && (
          <div className="pt-3 border-t border-slate-100 space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <select
                value={findingRef}
                onChange={(e) => setFindingRef(e.target.value)}
                className="h-9 rounded-lg border border-slate-200 px-2.5 text-xs font-medium"
              >
                <option value="PUIL">PUIL</option>
                <option value="SPLN">SPLN</option>
                <option value="IEC">IEC</option>
              </select>
              <input
                value={findingText}
                onChange={(e) => setFindingText(e.target.value)}
                placeholder="Contoh: tahanan pembumian panel melebihi batas..."
                className="sm:col-span-3 h-9 rounded-lg border border-slate-200 px-3 text-xs"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                if (!findingText.trim()) {
                  onToast('Tulis uraian temuan terlebih dahulu');
                  return;
                }
                const next = appendLog(
                  {
                    ...p,
                    finds: [
                      ...p.finds,
                      {
                        id: `f-${Date.now()}`,
                        ref: findingRef,
                        txt: findingText.trim(),
                        st: 'open',
                        at: isoToday(),
                      },
                    ],
                  },
                  'Temuan ketidaksesuaian dicatat'
                );
                onUpdateProject(next);
                setFindingText('');
                onToast('Temuan dicatat');
              }}
              className="px-3.5 py-2 rounded-lg bg-slate-800 text-white text-xs font-semibold hover:bg-slate-900 cursor-pointer"
            >
              Catat Temuan
            </button>
          </div>
        )}
      </div>
    );

    const renderAttendanceList = (onlyInsId?: string) => {
      const items = p.att.filter((a) => !onlyInsId || a.ins === onlyInsId);
      if (!items.length) return <p className="text-xs text-slate-500 mt-2">Belum ada absensi selfie.</p>;
      return (
        <div className="mt-3 divide-y divide-slate-100">
          {items.map((a) => {
            const ins = findIns(a.ins);
            return (
              <div key={a.id} className="py-2.5 flex items-center gap-3">
                <img
                  src={a.img}
                  alt={`Selfie ${ins?.nama || ''}`}
                  className="w-16 h-16 rounded-lg object-cover border border-slate-200 shrink-0"
                />
                <div className="text-xs min-w-0">
                  <div className="font-bold text-slate-900">
                    {a.type === 'in' ? 'Check-in' : 'Check-out'} · {ins?.nama || '-'}{' '}
                    <span
                      className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        a.mode === 'live' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      {a.mode === 'live' ? 'Kamera + GPS' : 'Simulasi'}
                    </span>
                  </div>
                  <div className="text-slate-500 font-mono mt-0.5">{formatDateTime(a.at)}</div>
                  <div className="text-slate-500 font-mono">
                    {a.lat != null && a.lon != null
                      ? `${a.lat.toFixed(5)}, ${a.lon.toFixed(5)} (±${Math.round(a.acc)} m)`
                      : 'GPS tidak tersedia'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );
    };

    const renderSignedScansChecklist = (canUpload: boolean) => {
      const uploadedCount = REQUIRED_SIGNED_DOCS.filter((dt) => Boolean(p.signedScans?.[dt])).length;
      const allDone = uploadedCount === REQUIRED_SIGNED_DOCS.length;
      return (
        <div
          className={`rounded-xl border p-3.5 space-y-2.5 ${
            allDone
              ? 'bg-emerald-50/70 border-emerald-200'
              : 'bg-amber-50/80 border-amber-200'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-amber-700" />
                Wajib Upload Ulang Scan Dokumen TTD Manual Tenaga Teknik
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Setelah Surat Tugas, Surat Jalan Alat, dan JSA dicetak (print) dan dimintakan tanda tangan manual Tenaga Teknik, scan dan unggah kembali ketiga dokumen sebelum melanjutkan ke pengujian.
              </p>
            </div>
            <span
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 ${
                allDone
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-900'
              }`}
            >
              {uploadedCount} / 3 Scan Terunggah
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {REQUIRED_SIGNED_DOCS.map((docType) => {
              const scan = p.signedScans?.[docType];
              const archivedPdf = (state.docArchives || []).find(
                (a) => a.projectId === p.id && a.docType === docType
              );
              return (
                <div
                  key={docType}
                  className={`rounded-xl border p-3 space-y-2 ${
                    scan
                      ? 'bg-white border-emerald-300'
                      : 'bg-white border-amber-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        {SAVED_DOC_LABELS[docType]}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {archivedPdf
                          ? `PDF Rekap: ${archivedPdf.docNomor}`
                          : 'Belum disimpan ke Rekap PDF'}
                      </div>
                    </div>
                    {scan ? (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        ✓ Scan OK
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                        Wajib Scan
                      </span>
                    )}
                  </div>

                  {scan ? (
                    <div className="space-y-1 text-[11px]">
                      <div className="font-medium text-slate-700 truncate" title={scan.name}>
                        {scan.name} ({formatFileSize(scan.size)})
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {scan.uploadedBy} · {formatDateTime(scan.uploadedAt)}
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-500 italic">
                      Belum ada scan TTD manual yang diunggah.
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    {scan && (
                      <button
                        type="button"
                        onClick={async () => {
                          const vf = await getVaultFile(scan.vaultFileId);
                          if (!vf?.dataUrl) {
                            onToast(`File scan "${scan.name}" tersimpan di perangkat pengunggah.`);
                            return;
                          }
                          setScanPreviewModal({
                            title: `Scan TTD Manual — ${SAVED_DOC_LABELS[docType]} (${p.no})`,
                            name: scan.name,
                            mimeType: scan.mimeType || vf.mimeType,
                            dataUrl: vf.dataUrl,
                          });
                        }}
                        className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3 h-3" /> Lihat Scan
                      </button>
                    )}

                    {canUpload && onUploadSignedScan && (
                      <label
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer ${
                          scan
                            ? 'border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                            : 'bg-amber-600 hover:bg-amber-700 text-white'
                        }`}
                      >
                        <Upload className="w-3 h-3" />
                        {uploadingScanType === docType
                          ? 'Mengunggah…'
                          : scan
                          ? 'Ganti Scan'
                          : 'Upload Scan TTD'}
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          className="hidden"
                          disabled={uploadingScanType === docType}
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            e.target.value = '';
                            if (!f) return;
                            setUploadingScanType(docType);
                            try {
                              await onUploadSignedScan(p.id, docType, f);
                            } finally {
                              setUploadingScanType(null);
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    const renderResultCard = () => (
      <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs">
        <h3 className="font-display text-base font-bold text-slate-900 mb-3">
          Ringkasan Hasil Uji (LHPP)
        </h3>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left border-collapse min-w-[520px]">
            <thead>
              <tr className="bg-slate-100 text-slate-600 text-[11px] uppercase">
                <th className="py-2 px-3">Mata Uji</th>
                <th className="py-2 px-3">Nilai</th>
                <th className="py-2 px-3">Hasil</th>
                <th className="py-2 px-3">Alat (No. Seri)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {TESTS[p.jenis].map(([key, label, unit]) => {
                const it = p.form.items[key] || {};
                const tool = it.alat ? findTool(it.alat) : null;
                return (
                  <tr key={key}>
                    <td className="py-2 px-3 font-medium text-slate-800">{label}</td>
                    <td className="py-2 px-3 font-mono tabular-nums text-slate-700">
                      {it.nilai || '-'} {unit}
                    </td>
                    <td className="py-2 px-3">
                      {it.hasil ? (
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            it.hasil === 'lulus'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {it.hasil === 'lulus' ? 'Sesuai' : 'Tidak sesuai'}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-600">{tool ? tool.sn : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );

    const renderSloCard = () =>
      p.slo && (
        <div className="rounded-2xl bg-white border border-emerald-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-base font-bold text-emerald-800">
              SLO Resmi Terbit
            </h3>
            <span className="text-xs font-mono font-bold text-emerald-700">{p.slo.no}</span>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <QrBadge value={`SLO|${p.slo.no}|${p.perusahaan}|${p.slo.date}`} />
            <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-xs">
              <dt className="text-slate-500">Nomor SLO</dt>
              <dd className="font-mono font-semibold text-slate-900">{p.slo.no}</dd>
              <dt className="text-slate-500">Tanggal Terbit</dt>
              <dd className="text-slate-800">{formatDateShort(p.slo.date)}</dd>
              <dt className="text-slate-500">Berkas Resmi</dt>
              <dd className="text-slate-800">
                {p.slo.file} ({formatFileSize(p.slo.size)})
              </dd>
            </dl>
          </div>
          <button
            type="button"
            onClick={() =>
              downloadTextFile(
                `validasi-${p.slo!.no.replace(/\//g, '-')}.html`,
                buildSloValidationHtml(p)
              )
            }
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" /> Unduh Lembar Validasi SLO
          </button>
        </div>
      );

    const stCol = STATUS_COLORS[p.status];

    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => onSelectProject(null)}
          className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke daftar proyek
        </button>

        {/* Project Summary & Stepper */}
        <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">{p.perusahaan}</h2>
              <p className="text-xs text-slate-500 mt-0.5 font-mono">
                {p.no} · {p.kota} · {p.jenis} ({p.sub}) · {p.kap}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(() => {
                const linkedJoSo = (state.joSoRecords || []).find(
                  (j) => j.id === p.joSoId || j.projectId === p.id
                );
                if ((role !== 'sales' && role !== 'direktur') || !linkedJoSo || !onOpenJoSoEditor)
                  return null;
                return (
                  <button
                    type="button"
                    onClick={() => onOpenJoSoEditor(linkedJoSo.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200 text-xs font-semibold cursor-pointer"
                    title={
                      role === 'direktur'
                        ? 'Tinjau JO/SO Terkait (Read-Only Direktur)'
                        : 'Buka & Edit JO/SO Terkait (Khusus Sales)'
                    }
                  >
                    <Briefcase className="w-3.5 h-3.5" />
                    {role === 'direktur'
                      ? `Tinjau: ${linkedJoSo.poNo || linkedJoSo.noPenawaran || 'JO/SO'}`
                      : linkedJoSo.poNo || linkedJoSo.noPenawaran || 'Edit JO/SO'}
                  </button>
                );
              })()}
              {p.pjtName && (
                <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold">
                  PJT: {p.pjtName}
                </span>
              )}
              {(p.publishedToWorkMenu || p.workflowStage === 'published_work') && (
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                  ✓ Menu Pekerjaan
                </span>
              )}
              <span
                className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold"
                title={
                  isLocalCity(p.kota)
                    ? 'SPT: Surabaya, Sidoarjo, Gresik'
                    : 'SPD: Seluruh Indonesia kecuali Surabaya, Sidoarjo, Gresik'
                }
              >
                {routeDoc(p.kota)} ({isLocalCity(p.kota) ? 'Sby/Sda/Gresik' : 'Luar Area'})
              </span>
              <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${stCol.bg} ${stCol.text}`}>
                {STATUS_LABEL[p.status]}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto -mx-1 px-1 pb-1">
          <div className="grid grid-cols-7 gap-1 pt-2 min-w-[460px]">
            {STEPS.map((s, idx) => (
              <div
                key={s}
                className={`border-t-4 pt-1.5 text-center text-[11px] leading-tight ${
                  idx < stepIdx
                    ? 'border-emerald-500 text-slate-800 font-medium'
                    : idx === stepIdx
                      ? 'border-blue-600 text-blue-700 font-bold'
                      : 'border-slate-200 text-slate-400'
                }`}
              >
                {s}
              </div>
            ))}
          </div>
          </div>
        </div>

        {/* ROLE PANEL: KLIEN */}
        {role === 'klien' && (
          <div className="space-y-4">
            {p.status === 'rfq' && (
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-xs text-blue-800">
                RFQ diterima. Tim Sales sedang memeriksa berkas dan menyusun penawaran resmi.
              </div>
            )}
            {p.status === 'offered' && p.penawaran && (
              <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs space-y-3">
                <h3 className="font-display text-base font-bold text-slate-900">
                  Penawaran Resmi ({p.penawaran.no})
                </h3>
                <p className="text-sm text-slate-700 font-semibold">
                  Total:{' '}
                  {formatRupiah(
                    Math.round((p.penawaran.jasa + p.penawaran.mob) * (1 + p.penawaran.ppn / 100))
                  )}{' '}
                  (termasuk PPN {p.penawaran.ppn}%)
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewDoc({
                        title: `Penawaran ${p.penawaran!.no}`,
                        html: buildPenawaranHtml(p),
                        filename: `penawaran-${p.no}.html`,
                      })
                    }
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Lihat Penawaran
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateProject(
                        appendLog({ ...p, status: 'approved' }, 'Klien menyetujui penawaran')
                      );
                      onToast('Penawaran disetujui. Silakan unggah PO dan bukti transfer.');
                    }}
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 cursor-pointer"
                  >
                    Setujui Penawaran
                  </button>
                </div>
              </div>
            )}

            {p.status === 'approved' && (
              <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs space-y-3">
                <h3 className="font-display text-base font-bold text-slate-900">
                  Unggah Dokumen Pembayaran
                </h3>
                <p className="text-xs text-slate-500">
                  Unggah PO/SPK dan bukti transfer (maks. 5 MB). Bagian Keuangan akan memverifikasi secara manual.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      PO / SPK {p.po && <span className="text-emerald-700">✓ {p.po.name}</span>}
                    </label>
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        try {
                          const meta = await prepFile(f);
                          const nextPo = { k: 'PO/SPK', ...meta };
                          const bothReady = Boolean(nextPo && p.transfer);
                          onUpdateProject(
                            appendLog(
                              {
                                ...p,
                                po: nextPo,
                                status: bothReady ? 'payproof' : p.status,
                              },
                              'PO/SPK diunggah klien'
                            )
                          );
                          onToast('PO/SPK diterima');
                        } catch (err: unknown) {
                          onToast(err instanceof Error ? err.message : 'Gagal membaca berkas');
                        }
                      }}
                      className="text-xs w-full"
                    />
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Bukti Transfer{' '}
                      {p.transfer && <span className="text-emerald-700">✓ {p.transfer.name}</span>}
                    </label>
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        try {
                          const meta = await prepFile(f);
                          const nextTf = { k: 'Bukti transfer', ...meta };
                          const bothReady = Boolean(p.po && nextTf);
                          onUpdateProject(
                            appendLog(
                              {
                                ...p,
                                transfer: nextTf,
                                status: bothReady ? 'payproof' : p.status,
                              },
                              'Bukti transfer diunggah klien'
                            )
                          );
                          onToast('Bukti transfer diterima');
                        } catch (err: unknown) {
                          onToast(err instanceof Error ? err.message : 'Gagal membaca berkas');
                        }
                      }}
                      className="text-xs w-full"
                    />
                  </div>
                </div>
              </div>
            )}

            {p.finds.length > 0 && openFindingsCard(false, true)}
            {renderSloCard()}
          </div>
        )}

        {/* ROLE PANEL: SALES */}
        {role === 'sales' && (
          <div className="space-y-4">
            {p.status === 'rfq' && (
              <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs space-y-4">
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900">
                    Susun Penawaran Resmi
                  </h3>
                  <p className="text-xs text-slate-500">
                    Mobilisasi {isLocalCity(p.kota) ? 'dalam area Surabaya/Sidoarjo/Gresik' : 'luar kota'}.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Jasa Pengujian (Rp)</label>
                    <input
                      type="number"
                      min={0}
                      value={jasaVal}
                      onChange={(e) => setJasaVal(Number(e.target.value))}
                      className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Mobilisasi (Rp)</label>
                    <input
                      type="number"
                      min={0}
                      value={mobVal}
                      onChange={(e) => setMobVal(Number(e.target.value))}
                      className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">PPN (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={ppnVal}
                      onChange={(e) => setPpnVal(Number(e.target.value))}
                      className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm tabular-nums"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (jasaVal <= 0) {
                      onToast('Isi nominal jasa pengujian terlebih dahulu');
                      return;
                    }
                    const pnwNo = `PNW-${p.no.replace('RFQ-', '')}`;
                    onUpdateProject(
                      appendLog(
                        {
                          ...p,
                          status: 'offered',
                          penawaran: {
                            no: pnwNo,
                            jasa: jasaVal,
                            mob: mobVal || 0,
                            ppn: Number.isNaN(ppnVal) ? 11 : ppnVal,
                            at: new Date().toISOString(),
                          },
                        },
                        `Penawaran ${pnwNo} diterbitkan`
                      )
                    );
                    onToast(`Penawaran ${pnwNo} diterbitkan`);
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 cursor-pointer"
                >
                  Terbitkan Penawaran
                </button>
              </div>
            )}

            {p.penawaran && p.status !== 'rfq' && (
              <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-sm font-bold text-slate-900">
                    Penawaran {p.penawaran.no}
                  </h3>
                  <p className="text-xs text-slate-500">Diterbitkan {formatDateShort(p.penawaran.at)}</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setPreviewDoc({
                      title: `Penawaran ${p.penawaran!.no}`,
                      html: buildPenawaranHtml(p),
                      filename: `penawaran-${p.no}.html`,
                    })
                  }
                  className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Lihat / Unduh Penawaran
                </button>
              </div>
            )}

            {p.status === 'payproof' && (
              <div className="rounded-2xl bg-white border border-amber-200 p-5 shadow-xs space-y-3">
                <h3 className="font-display text-base font-bold text-slate-900">
                  Verifikasi Pembayaran
                </h3>
                <p className="text-xs text-slate-600">
                  Cocokkan bukti transfer dengan rekening perusahaan, lalu konfirmasi agar Admin Teknis dapat meneruskan ke PJT.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateProject(
                      appendLog({ ...p, status: 'paid' }, 'Pembayaran diverifikasi Keuangan')
                    );
                    onToast('Pembayaran terverifikasi — siap dikirim ke Admin');
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 cursor-pointer"
                >
                  Pembayaran Sesuai, Verifikasi
                </button>
              </div>
            )}

            {/* Pesan Status Pekerjaan Sales -> Admin Teknis */}
            <div className="rounded-2xl bg-white border border-violet-200 p-5 shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900">
                    Kirim Pesan Kesiapan Pekerjaan ke Admin Teknis
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Setelah Penawaran &amp; PO terbit, beritahu Admin status pekerjaan untuk diteruskan ke PJT.
                  </p>
                </div>
                {p.salesReadiness && (
                  <span className="px-2.5 py-1 rounded-lg bg-violet-50 text-violet-700 border border-violet-200 text-xs font-semibold">
                    Status: {SALES_READINESS_LABEL[p.salesReadiness]}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(
                  [
                    ['ready_wait_dp', 'Siap Dikerjakan (Menunggu DP)'],
                    ['ready_no_dp', 'Siap Dikerjakan (Tanpa DP)'],
                  ] as [SalesReadiness, string][]
                ).map(([val, label]) => (
                  <label
                    key={val}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-semibold cursor-pointer ${
                      salesReadyChoice === val
                        ? 'bg-violet-50 border-violet-500 text-violet-900'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="projSalesReady"
                      checked={salesReadyChoice === val}
                      onChange={() => setSalesReadyChoice(val)}
                      className="accent-violet-600"
                    />
                    {label}
                  </label>
                ))}
              </div>

              <textarea
                rows={2}
                value={salesReadyMsg}
                onChange={(e) => setSalesReadyMsg(e.target.value)}
                placeholder="Pesan untuk Admin Teknis (misal: PO sudah terbit, mohon diteruskan ke PJT)..."
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs"
              />

              <button
                type="button"
                onClick={() => {
                  const nextStage =
                    p.workflowStage && p.workflowStage !== 'draft'
                      ? p.workflowStage
                      : ('sent_to_admin' as const);
                  onUpdateProject(
                    appendLog(
                      {
                        ...p,
                        salesReadiness: salesReadyChoice,
                        salesMessage: salesReadyMsg.trim(),
                        workflowStage: nextStage,
                        status: ['rfq', 'offered', 'approved', 'payproof'].includes(p.status)
                          ? 'paid'
                          : p.status,
                      },
                      `Sales mengirim pesan ke Admin: ${SALES_READINESS_LABEL[salesReadyChoice]}`
                    )
                  );
                  onToast(
                    `Pesan "${SALES_READINESS_LABEL[salesReadyChoice]}" dikirim ke Admin Teknis`
                  );
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" /> Kirim Pesan Status ke Admin
              </button>
            </div>

            {p.status === 'approvedPJT' && (
              <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs space-y-4">
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900">
                    Terbitkan SLO Resmi
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    PJT sudah menyetujui kelayakan operasi. Ekspor ringkasan ke SiUjang Gatrik (CSV), lalu unggah PDF SLO resmi.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const rows = [
                      ['No', 'Perusahaan', 'Lokasi', 'Jenis', 'Sub', 'Kapasitas', 'Mata uji', 'Nilai', 'Hasil', 'No seri alat'],
                      ...TESTS[p.jenis].map(([k, lbl]) => {
                        const it = p.form.items[k] || {};
                        const tl = it.alat ? findTool(it.alat) : null;
                        return [
                          p.no,
                          p.perusahaan,
                          p.kota,
                          p.jenis,
                          p.sub,
                          p.kap,
                          lbl,
                          it.nilai || '',
                          it.hasil || '',
                          tl?.sn || '',
                        ];
                      }),
                    ];
                    const csv = rows
                      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
                      .join('\n');
                    downloadTextFile(`siujang-${p.no}.csv`, csv, 'text/csv;charset=utf-8');
                    onToast('File CSV SiUjang Gatrik diunduh');
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4" /> Ekspor Data SiUjang Gatrik (CSV)
                </button>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Unggah PDF SLO Resmi{' '}
                    {sloUploadMeta && (
                      <span className="text-emerald-700">
                        ✓ {sloUploadMeta.name} ({formatFileSize(sloUploadMeta.size)})
                      </span>
                    )}
                  </label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        const meta = await prepFile(f);
                        setSloUploadMeta(meta);
                      } catch (err: unknown) {
                        onToast(err instanceof Error ? err.message : 'Gagal membaca berkas');
                      }
                    }}
                    className="text-xs w-full"
                  />
                </div>

                <button
                  type="button"
                  disabled={!sloUploadMeta}
                  onClick={() => {
                    if (!sloUploadMeta) return;
                    const sloNo = `SLO/${new Date().getFullYear()}/${String(state.seq2 + 1).padStart(4, '0')}`;
                    onUpdateProject(
                      appendLog(
                        {
                          ...p,
                          status: 'slo',
                          slo: {
                            no: sloNo,
                            date: isoToday(),
                            file: sloUploadMeta.name,
                            size: sloUploadMeta.size,
                          },
                        },
                        `SLO diterbitkan (${sloNo})`
                      )
                    );
                    setSloUploadMeta(null);
                    onToast(`SLO ${sloNo} diterbitkan ke klien`);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-45 cursor-pointer"
                >
                  Terbitkan SLO ke Klien
                </button>
              </div>
            )}

            {renderSloCard()}
          </div>
        )}

        {/* ROLE PANEL: ADMIN TEKNIS */}
        {role === 'teknis' && (
          <div className="space-y-4">
            {/* Pesan & Kendala Pekerjaan dari Leader Tenaga Teknik */}
            {p.leaderMessages && p.leaderMessages.length > 0 && (
              <div className="rounded-2xl bg-white border-2 border-amber-300 p-5 shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <h3 className="font-display text-base font-bold text-slate-900">
                      Pesan Keterangan / Kendala Pekerjaan dari Leader Tenaga Teknik
                    </h3>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
                    {p.leaderMessages.filter((m) => m.status === 'open').length} Belum Ditindaklanjuti
                  </span>
                </div>

                <div className="space-y-2.5">
                  {p.leaderMessages
                    .slice()
                    .reverse()
                    .map((msg) => (
                      <div
                        key={msg.id}
                        className={`rounded-xl border p-3.5 space-y-2 text-xs ${
                          msg.status === 'open'
                            ? 'bg-amber-50/60 border-amber-200'
                            : 'bg-emerald-50/50 border-emerald-200'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-slate-900 text-white text-[11px] font-bold">
                              {msg.category}
                            </span>
                            <span className="font-semibold text-slate-700">
                              Dari Leader: {msg.senderName}
                            </span>
                            <span className="font-mono text-[11px] text-slate-500">
                              {formatDateTime(msg.sentAt)}
                            </span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              msg.status === 'open'
                                ? 'bg-amber-200/80 text-amber-900'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {msg.status === 'open' ? 'Menunggu Tindak Lanjut Admin' : '✓ Ditindaklanjuti'}
                          </span>
                        </div>

                        {msg.note && (
                          <p className="text-slate-800 bg-white/80 rounded-lg border border-slate-200/70 px-3 py-2">
                            {msg.note}
                          </p>
                        )}

                        {msg.status === 'open' ? (
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <input
                              type="text"
                              value={adminIssueReplyMap[msg.id] || ''}
                              onChange={(e) =>
                                setAdminIssueReplyMap((prev) => ({
                                  ...prev,
                                  [msg.id]: e.target.value,
                                }))
                              }
                              placeholder="Tulis balasan / arahan tindak lanjut Admin..."
                              className="flex-1 min-w-[220px] h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const replyTxt = (adminIssueReplyMap[msg.id] || '').trim();
                                const nextMsgs: LeaderAdminMessage[] = (p.leaderMessages || []).map(
                                  (m) =>
                                    m.id === msg.id
                                      ? {
                                          ...m,
                                          status: 'resolved' as const,
                                          adminReply:
                                            replyTxt || 'Sudah ditindaklanjuti oleh Admin Teknis.',
                                          resolvedAt: new Date().toISOString(),
                                        }
                                      : m
                                );
                                onUpdateProject(
                                  appendLog(
                                    { ...p, leaderMessages: nextMsgs },
                                    `Admin Teknis menindaklanjuti kendala "${msg.category}" dari ${msg.senderName}`
                                  )
                                );
                                setAdminIssueReplyMap((prev) => {
                                  const next = { ...prev };
                                  delete next[msg.id];
                                  return next;
                                });
                                onToast(`Kendala "${msg.category}" ditandai sudah ditindaklanjuti`);
                              }}
                              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                            >
                              Tandai Ditindaklanjuti &amp; Balas
                            </button>
                          </div>
                        ) : (
                          msg.adminReply && (
                            <div className="text-[11px] text-emerald-900 bg-white/80 rounded-lg border border-emerald-200 px-3 py-2">
                              <b>Balasan Admin Teknis</b>
                              {msg.resolvedAt ? ` (${formatDateTime(msg.resolvedAt)})` : ''}:{' '}
                              {msg.adminReply}
                            </div>
                          )
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Pesan dari Sales & Teruskan ke PJT */}
            {(p.salesReadiness ||
              (p.workflowStage && p.workflowStage !== 'draft') ||
              p.status === 'paid') && (
              <div className="rounded-2xl bg-white border border-blue-200 p-5 shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-blue-600" />
                    <h3 className="font-display text-base font-bold text-slate-900">
                      Pesan Status Pekerjaan dari Tim Sales
                    </h3>
                  </div>
                  {p.salesReadiness && (
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                        p.salesReadiness === 'ready_no_dp'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      {SALES_READINESS_LABEL[p.salesReadiness]}
                    </span>
                  )}
                </div>

                {p.salesMessage && (
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700">
                    <span className="font-bold text-slate-900">Pesan Sales: </span>
                    {p.salesMessage}
                  </div>
                )}

                <div className="text-xs text-slate-600">
                  Lingkup Area: <b>{p.kota}</b> → Dokumen Tugas Lapangan:{' '}
                  <span className="font-bold text-blue-700">
                    {routeDoc(p.kota)} (
                    {isLocalCity(p.kota)
                      ? 'Surabaya / Sidoarjo / Gresik'
                      : 'Seluruh Indonesia di luar Surabaya, Sidoarjo, Gresik'}
                    )
                  </span>
                </div>

                {(!p.workflowStage ||
                  p.workflowStage === 'draft' ||
                  p.workflowStage === 'sent_to_admin') && (
                  <div className="pt-2 border-t border-slate-100 space-y-2.5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Pilih PJT Penanggung Jawab (opsional)
                        </label>
                        <select
                          value={adminTargetPjt}
                          onChange={(e) => setAdminTargetPjt(e.target.value)}
                          className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium"
                        >
                          <option value="">Terbuka untuk PJT (Kusno / Ahmad Fauzan)</option>
                          {DOC_CONFIG.pjt.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Catatan Admin untuk PJT (opsional)
                        </label>
                        <input
                          type="text"
                          value={adminForwardNote}
                          onChange={(e) => setAdminForwardNote(e.target.value)}
                          placeholder="Contoh: Mohon PJT menunjuk Leader Tenaga Teknik"
                          className="w-full h-9 rounded-xl border border-slate-200 px-3 text-xs"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const chosenPjt = adminTargetPjt.trim() || undefined;
                        onUpdateProject(
                          appendLog(
                            {
                              ...p,
                              pjtName: chosenPjt ?? p.pjtName,
                              workflowStage: 'forwarded_to_pjt',
                              adminForwardNote: adminForwardNote.trim(),
                            },
                            `Admin Teknis meneruskan pesan Sales ke PJT${
                              chosenPjt ? ` (${chosenPjt})` : ''
                            } untuk penunjukan Leader TTK`
                          )
                        );
                        onToast(
                          chosenPjt
                            ? `Pekerjaan diteruskan ke PJT ${chosenPjt}`
                            : 'Pekerjaan diteruskan ke PJT untuk menunjuk Leader Tenaga Teknik'
                        );
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" /> Teruskan ke PJT (Tugaskan Leader)
                    </button>
                  </div>
                )}

                {p.workflowStage === 'forwarded_to_pjt' && (
                  <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-3 text-xs text-indigo-800 font-medium">
                    ✓ Sudah diteruskan ke <b>PJT{p.pjtName ? ` (${p.pjtName})` : ''}</b>. Menunggu PJT menunjuk Leader Tenaga Teknik.
                  </div>
                )}

                {p.workflowStage === 'leader_assigned' && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 font-medium">
                    ⏳ Leader Tenaga Teknik sudah ditunjuk (
                    <b>{findIns(p.team?.lead || '')?.nama || '-'}</b>). Menunggu Leader melengkapi
                    anggota, Surat Tugas, JSA, Surat Jalan, {routeDoc(p.kota)}, TTE &amp; meneruskan ke Menu Pekerjaan.
                  </div>
                )}

                {(p.workflowStage === 'published_work' || p.publishedToWorkMenu) && (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    Dokumen lengkap ber-TTE telah diteruskan Leader &amp; tampil di Menu Pekerjaan Admin.
                  </div>
                )}
              </div>
            )}

            {p.status === 'paid' && !p.team && p.workflowStage !== 'forwarded_to_pjt' && (
              <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs space-y-4">
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900">
                    Penugasan Langsung Inspektor &amp; Alat Uji (Opsional)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Anda juga dapat langsung memilih tim di sini atau meneruskan ke PJT di atas agar PJT menunjuk Leader Tenaga Teknik. Inspektor/alat kedaluwarsa otomatis terkunci.
                  </p>
                </div>

                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                    Pilih Inspektor (TTK)
                  </div>
                  <div className="space-y-1.5">
                    {state.insp
                      .filter((ins) => !isSamePersonName(ins.nama, p.pjtName))
                      .map((ins) => {
                      const a = certStatus(ins.serkom);
                      const b = certStatus(ins.k3);
                      const lock = Boolean(a.lock || b.lock);
                      const checked = selectedIns.includes(ins.id);
                      return (
                        <label
                          key={ins.id}
                          className={`flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl border text-xs ${
                            lock
                              ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
                              : checked
                                ? 'bg-blue-50 border-blue-400 cursor-pointer'
                                : 'bg-white border-slate-200 hover:bg-slate-50 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              disabled={lock}
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedIns((prev) => [...prev, ins.id]);
                                } else {
                                  setSelectedIns((prev) => prev.filter((id) => id !== ins.id));
                                  if (selectedLead === ins.id) setSelectedLead('');
                                }
                              }}
                            />
                            <span className="font-semibold text-slate-900">{ins.nama}</span>
                            <span className="font-mono text-slate-500">{ins.noReg}</span>
                          </div>
                          <span className="text-[11px] font-medium text-slate-600">
                            Serkom: <b>{a.t}</b> · K3: <b>{b.t}</b>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Ketua Tim
                  </label>
                  <select
                    value={selectedLead}
                    onChange={(e) => setSelectedLead(e.target.value)}
                    className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
                  >
                    <option value="">Pilih ketua tim dari inspektor terpilih…</option>
                    {selectedIns.map((id) => {
                      const ins = findIns(id);
                      return ins ? (
                        <option key={id} value={id}>
                          {ins.nama}
                        </option>
                      ) : null;
                    })}
                  </select>
                </div>

                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                    Pilih Alat Uji
                  </div>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                    {state.tools.map((t) => {
                      const c = certStatus(t.cal, true);
                      const checked = selectedTools.includes(t.id);
                      return (
                        <label
                          key={t.id}
                          className={`flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl border text-xs ${
                            c.lock
                              ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
                              : checked
                                ? 'bg-blue-50 border-blue-400 cursor-pointer'
                                : 'bg-white border-slate-200 hover:bg-slate-50 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              disabled={Boolean(c.lock)}
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedTools((prev) => [...prev, t.id]);
                                } else {
                                  setSelectedTools((prev) => prev.filter((id) => id !== t.id));
                                }
                              }}
                            />
                            <span className="font-semibold text-slate-900">{t.nama}</span>
                            <span className="font-mono text-slate-500">{t.sn}</span>
                          </div>
                          <span className="text-[11px] font-medium text-slate-600">
                            Kalibrasi s.d. {formatDateShort(t.cal)} (<b>{c.t}</b>)
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!selectedIns.length) {
                      onToast('Pilih minimal satu inspektor');
                      return;
                    }
                    if (!selectedLead || !selectedIns.includes(selectedLead)) {
                      onToast('Pilih ketua tim dari inspektor yang ditugaskan');
                      return;
                    }
                    if (!selectedTools.length) {
                      onToast('Pilih minimal satu alat uji');
                      return;
                    }
                    const nextProj = appendLog(
                      {
                        ...p,
                        team: { ins: selectedIns, tools: selectedTools, lead: selectedLead },
                        docs: { issued: true, ack: false },
                        status: 'scheduled',
                      },
                      `Paket dokumen terbit: Surat Tugas, Surat Jalan Alat, JSA, ${routeDoc(p.kota)}`
                    );
                    onUpdateProject(nextProj);
                    onToast(`4 dokumen diterbitkan (${routeDoc(p.kota)})`);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 cursor-pointer"
                >
                  Terbitkan Paket 4 Dokumen
                </button>
              </div>
            )}

            {p.team && (
              <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-base font-bold text-slate-900">
                    Paket Dokumen Pengujian
                  </h3>
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                      p.docs.ack ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
                    }`}
                  >
                    {p.docs.ack ? 'Dikonfirmasi Ketua Tim' : 'Belum dikonfirmasi'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenProjectDocInEditor(p, 'surat-tugas')}
                    className="px-3.5 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" /> Surat Tugas (PDF A4)
                    {p.docTte?.suratTugas?.enabled && (
                      <span className="ml-1 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px]">
                        TTE
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenProjectDocInEditor(p, 'surat-jalan')}
                    className="px-3.5 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" /> Surat Jalan Alat (PDF A4)
                    {p.docTte?.suratJalan?.enabled && (
                      <span className="ml-1 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px]">
                        TTE
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenProjectDocInEditor(p, 'jsa')}
                    className="px-3.5 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" /> JSA (PDF A4)
                    {p.docTte?.jsa?.enabled && (
                      <span className="ml-1 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px]">
                        TTE
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewDoc({
                        title: `Dokumen ${routeDoc(p.kota)}`,
                        html: buildSpkSpdHtml(p, state.insp),
                        filename: `${routeDoc(p.kota).toLowerCase()}-${p.no}.html`,
                      })
                    }
                    className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" /> {routeDoc(p.kota)}
                    {p.docTte?.sptSpd?.enabled && (
                      <span className="ml-1 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px]">
                        TTE
                      </span>
                    )}
                  </button>
                </div>

                {renderSignedScansChecklist(true)}
              </div>
            )}

            {p.att.length > 0 && (
              <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs">
                <h3 className="font-display text-base font-bold text-slate-900">
                  Log Absensi Selfie Lapangan
                </h3>
                {renderAttendanceList()}
              </div>
            )}

            {p.finds.length > 0 && openFindingsCard(false, false)}
          </div>
        )}

        {/* ROLE PANEL: INSPEKTOR / LEADER TENAGA TEKNIK (atau PJT yang ditugaskan sebagai TTK) */}
        {(role === 'inspektor' || isAssignedAsTtkHere) && (
          <div className="space-y-4">
            {isAssignedAsTtkHere && (
              <div className="rounded-xl bg-violet-50 border border-violet-200 px-4 py-3 text-xs text-violet-900 flex flex-wrap items-center justify-between gap-2">
                <span>
                  <b>Mode Tenaga Teknik ({activeIns.nama}):</b> Pada proyek ini PJT adalah{' '}
                  <b>{p.pjtName}</b>, dan Anda ditugaskan sebagai{' '}
                  <b>{p.team?.lead === activeIns.id ? 'Leader Tenaga Teknik' : 'Anggota Tenaga Teknik'}</b>.
                </span>
              </div>
            )}
            {!p.team ? (
              <div className="rounded-xl bg-slate-100 p-4 text-xs text-slate-600">
                Proyek ini belum memiliki penugasan Leader / Tim Tenaga Teknik dari PJT.
              </div>
            ) : (
              <>
                {/* Panel Khusus Leader Tenaga Teknik: Tambah Anggota, Alat, ST/SJ/JSA/SPT-SPD, TTE Semua, Teruskan ke Admin */}
                {p.team.lead === activeIns.id && (
                  <div className="rounded-2xl bg-white border-2 border-violet-200 p-5 shadow-xs space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-violet-100 text-violet-800 text-[10px] font-bold uppercase tracking-wider">
                          <UserCheck className="w-3 h-3" /> Leader Tenaga Teknik
                        </span>
                        <h3 className="font-display text-base font-bold text-slate-900 mt-1">
                          Persiapan Tim, Dokumen ({routeDoc(p.kota)}) &amp; TTE Lengkap
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Tambahkan anggota tim, pilih alat uji, siapkan Surat Tugas, JSA, Surat Jalan, dan{' '}
                          <b>{routeDoc(p.kota)}</b> (
                          {isLocalCity(p.kota)
                            ? 'SPT: Surabaya, Sidoarjo, Gresik'
                            : 'SPD: seluruh Indonesia kecuali Surabaya, Sidoarjo, Gresik'}
                          ), bubuhkan TTE pada semua dokumen, lalu teruskan ke Admin.
                        </p>
                      </div>
                      {p.publishedToWorkMenu && (
                        <span className="px-3 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold">
                          ✓ Sudah Tampil di Menu Pekerjaan
                        </span>
                      )}
                    </div>

                    {/* 1. Anggota Tim & Alat Uji */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-violet-600" /> Tambah Anggota Tenaga Teknik
                        </div>
                        {p.pjtName && (
                          <p className="text-[11px] text-indigo-700 mb-2">
                            PJT proyek (<b>{p.pjtName}</b>) otomatis tidak tercantum di daftar Tenaga Teknik.
                          </p>
                        )}
                        <div className="space-y-1.5">
                          {state.insp
                            .filter((ins) => !isSamePersonName(ins.nama, p.pjtName))
                            .map((ins) => {
                            const a = certStatus(ins.serkom);
                            const b = certStatus(ins.k3);
                            const lock = Boolean(a.lock || b.lock);
                            const isLeader = ins.id === p.team?.lead;
                            const checked = isLeader || leaderMembers.includes(ins.id);
                            return (
                              <label
                                key={ins.id}
                                className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border text-xs ${
                                  lock && !isLeader
                                    ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
                                    : checked
                                    ? 'bg-violet-50 border-violet-300 cursor-pointer'
                                    : 'bg-white border-slate-200 hover:bg-slate-50 cursor-pointer'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    disabled={(lock && !isLeader) || isLeader}
                                    checked={checked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setLeaderMembers((prev) =>
                                          Array.from(new Set([...prev, ins.id]))
                                        );
                                      } else {
                                        setLeaderMembers((prev) =>
                                          prev.filter((id) => id !== ins.id)
                                        );
                                      }
                                    }}
                                  />
                                  <span className="font-semibold text-slate-900">{ins.nama}</span>
                                  {isLeader && (
                                    <span className="px-1.5 py-0.5 rounded bg-violet-600 text-white text-[10px] font-bold">
                                      Leader
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-slate-500">{ins.noReg}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                          Pilih Alat Uji Terkalibrasi (Surat Jalan)
                        </div>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {state.tools.map((t) => {
                            const c = certStatus(t.cal, true);
                            const checked = leaderTools.includes(t.id);
                            return (
                              <label
                                key={t.id}
                                className={`flex items-center justify-between gap-2 p-2 rounded-xl border text-xs ${
                                  c.lock
                                    ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
                                    : checked
                                    ? 'bg-blue-50 border-blue-300 cursor-pointer'
                                    : 'bg-white border-slate-200 hover:bg-slate-50 cursor-pointer'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <input
                                    type="checkbox"
                                    disabled={Boolean(c.lock)}
                                    checked={checked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setLeaderTools((prev) =>
                                          Array.from(new Set([...prev, t.id]))
                                        );
                                      } else {
                                        setLeaderTools((prev) =>
                                          prev.filter((id) => id !== t.id)
                                        );
                                      }
                                    }}
                                  />
                                  <span className="font-semibold text-slate-900 truncate">
                                    {t.nama}
                                  </span>
                                </div>
                                <span className="font-mono text-[10px] text-slate-500 shrink-0">
                                  {t.sn} ({c.t})
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* 2. Status TTE 4 Dokumen */}
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          Status Tanda Tangan Elektronik (TTE) Semua Dokumen
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const finalMembers = Array.from(
                              new Set([p.team!.lead, ...leaderMembers])
                            );
                            const nextDocTte = {
                              suratTugas: createTteStamp(activeIns.nama, 'Leader Tenaga Teknik'),
                              suratJalan: createTteStamp(activeIns.nama, 'Leader Tenaga Teknik'),
                              jsa: createTteStamp(activeIns.nama, 'Leader Tenaga Teknik'),
                              sptSpd: createTteStamp(activeIns.nama, 'Leader Tenaga Teknik'),
                            };
                            const updatedProj = appendLog(
                              {
                                ...p,
                                team: {
                                  ins: finalMembers,
                                  tools: leaderTools,
                                  lead: p.team!.lead,
                                },
                                docs: { ...p.docs, issued: true },
                                docTte: nextDocTte,
                              },
                              `Leader ${activeIns.nama} membubuhkan TTE pada Surat Tugas, Surat Jalan, JSA, dan ${routeDoc(p.kota)}`
                            );
                            onUpdateProject(updatedProj);
                            onApplyTteToEditors?.(updatedProj, nextDocTte);
                            onToast(
                              `TTE berhasil dibubuhkan ke seluruh dokumen (Surat Tugas, Surat Jalan, JSA, ${routeDoc(p.kota)})`
                            );
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" /> Bubuhkan TTE Semua Dokumen
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                        {(
                          [
                            ['Surat Tugas', p.docTte?.suratTugas],
                            ['Surat Jalan Alat', p.docTte?.suratJalan],
                            ['JSA Keselamatan', p.docTte?.jsa],
                            [routeDoc(p.kota), p.docTte?.sptSpd],
                          ] as [string, Project['docTte'] extends infer _ ? { enabled?: boolean; code?: string } | undefined : never][]
                        ).map(([lbl, info]) => (
                          <div
                            key={lbl}
                            className={`rounded-lg border px-2.5 py-2 ${
                              info?.enabled
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                : 'bg-white border-slate-200 text-slate-600'
                            }`}
                          >
                            <div className="font-bold">{lbl}</div>
                            <div className="font-mono text-[10px] mt-0.5">
                              {info?.enabled ? `✓ TTE (${info.code})` : 'Belum TTE'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 3. Simpan Tim & Teruskan ke Admin (Menu Pekerjaan) */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          const finalMembers = Array.from(
                            new Set([p.team!.lead, ...leaderMembers])
                          );
                          onUpdateProject(
                            appendLog(
                              {
                                ...p,
                                team: {
                                  ins: finalMembers,
                                  tools: leaderTools,
                                  lead: p.team!.lead,
                                },
                              },
                              `Leader memperbarui anggota (${finalMembers.length} orang) & alat (${leaderTools.length} unit)`
                            )
                          );
                          onToast('Daftar anggota & alat tim disimpan');
                        }}
                        className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                      >
                        Simpan Anggota &amp; Alat Tim
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const finalMembers = Array.from(
                            new Set([p.team!.lead, ...leaderMembers])
                          );
                          if (!leaderTools.length) {
                            onToast('Pilih minimal 1 alat uji untuk Surat Jalan Alat');
                            return;
                          }
                          const allTteReady =
                            p.docTte?.suratTugas?.enabled &&
                            p.docTte?.suratJalan?.enabled &&
                            p.docTte?.jsa?.enabled &&
                            p.docTte?.sptSpd?.enabled;
                          if (!allTteReady) {
                            onToast(
                              `Klik "Bubuhkan TTE Semua Dokumen" terlebih dahulu sebelum meneruskan ke Admin`
                            );
                            return;
                          }
                          const nextStatus = ['rfq', 'offered', 'approved', 'payproof', 'paid'].includes(
                            p.status
                          )
                            ? 'scheduled'
                            : p.status;
                          onUpdateProject(
                            appendLog(
                              {
                                ...p,
                                team: {
                                  ins: finalMembers,
                                  tools: leaderTools,
                                  lead: p.team!.lead,
                                },
                                docs: { issued: true, ack: true },
                                workflowStage: 'published_work',
                                publishedToWorkMenu: true,
                                status: nextStatus,
                              },
                              `Leader ${activeIns.nama} meneruskan pekerjaan & dokumen ber-TTE ke Menu Pekerjaan Admin`
                            )
                          );
                          onToast(
                            'Berhasil diteruskan ke Admin dan ditampilkan di Menu Pekerjaan!'
                          );
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" /> Teruskan ke Admin (Tampilkan di Menu Pekerjaan)
                      </button>
                    </div>

                    {/* 4. Kirim Pesan / Kendala Pekerjaan ke Admin Teknis */}
                    <div className="pt-3 border-t border-slate-100 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <MessageSquare className="w-4 h-4 text-amber-600" />
                          Kirim Pesan Keterangan / Kendala Pekerjaan ke Admin Teknis
                        </div>
                        <span className="text-[11px] text-slate-500">
                          Laporan langsung masuk ke inbox Admin Teknis pada Menu Pekerjaan
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {LEADER_ISSUE_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setLeaderIssueCategory(preset)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                              leaderIssueCategory === preset
                                ? 'bg-amber-600 text-white border-amber-600'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50'
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>

                      {leaderIssueCategory === 'Kendala Lainnya' && (
                        <input
                          type="text"
                          value={leaderIssueCustom}
                          onChange={(e) => setLeaderIssueCustom(e.target.value)}
                          placeholder="Tulis jenis kendala lainnya..."
                          className="w-full h-9 rounded-xl border border-slate-200 px-3 text-xs"
                        />
                      )}

                      <textarea
                        rows={2}
                        value={leaderIssueNote}
                        onChange={(e) => setLeaderIssueNote(e.target.value)}
                        placeholder="Jelaskan detail kendala atau keterangan pekerjaan (misal: nama akun SiUjang yang perlu di-reset, izin lingkungan/izin kerja yang belum tersedia, atau daftar dokumen teknik yang kurang)..."
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                      />

                      <button
                        type="button"
                        onClick={() => {
                          const categoryLabel =
                            leaderIssueCategory === 'Kendala Lainnya'
                              ? leaderIssueCustom.trim() || 'Kendala Lainnya'
                              : leaderIssueCategory;
                          const newMsg: LeaderAdminMessage = {
                            id: `lm-${Date.now()}`,
                            category: categoryLabel,
                            note: leaderIssueNote.trim(),
                            senderName: activeIns.nama,
                            senderId: activeIns.id,
                            sentAt: new Date().toISOString(),
                            status: 'open',
                          };
                          onUpdateProject(
                            appendLog(
                              {
                                ...p,
                                leaderMessages: [...(p.leaderMessages || []), newMsg],
                              },
                              `Leader ${activeIns.nama} mengirim kendala "${categoryLabel}" ke Admin Teknis`
                            )
                          );
                          setLeaderIssueNote('');
                          setLeaderIssueCustom('');
                          onToast(`Pesan kendala "${categoryLabel}" terkirim ke Admin Teknis`);
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" /> Kirim Pesan / Kendala ke Admin Teknis
                      </button>

                      {p.leaderMessages && p.leaderMessages.length > 0 && (
                        <div className="space-y-2 pt-2">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Riwayat Pesan Kendala ke Admin Teknis ({p.leaderMessages.length})
                          </div>
                          {p.leaderMessages
                            .slice()
                            .reverse()
                            .map((msg) => (
                              <div
                                key={msg.id}
                                className={`rounded-xl border p-3 text-xs space-y-1 ${
                                  msg.status === 'open'
                                    ? 'bg-amber-50/50 border-amber-200'
                                    : 'bg-emerald-50/50 border-emerald-200'
                                }`}
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-bold text-slate-900">
                                    {msg.category}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      msg.status === 'open'
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-emerald-100 text-emerald-800'
                                    }`}
                                  >
                                    {msg.status === 'open'
                                      ? 'Menunggu Tindak Lanjut Admin'
                                      : '✓ Ditindaklanjuti Admin'}
                                  </span>
                                </div>
                                {msg.note && <p className="text-slate-700">{msg.note}</p>}
                                <div className="text-[10px] font-mono text-slate-500">
                                  Dikirim oleh {msg.senderName} · {formatDateTime(msg.sentAt)}
                                </div>
                                {msg.adminReply && (
                                  <div className="mt-1 rounded-lg bg-white border border-emerald-200 px-2.5 py-1.5 text-[11px] text-emerald-900">
                                    <b>Balasan Admin:</b> {msg.adminReply}
                                  </div>
                                )}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {(['scheduled', 'testing', 'submitted'].includes(p.status) || p.team) && (
                  <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs space-y-3">
                    <h3 className="font-display text-base font-bold text-slate-900">
                      1. Paket Dokumen Wajib (Buat &amp; Cetak PDF A4)
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const syncedProj: Project = p.team
                            ? {
                                ...p,
                                team: {
                                  ...p.team,
                                  ins: Array.from(new Set([p.team.lead, ...leaderMembers])),
                                  tools: leaderTools,
                                },
                              }
                            : p;
                          onOpenProjectDocInEditor(syncedProj, 'surat-tugas');
                        }}
                        className="px-3 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold cursor-pointer"
                      >
                        Surat Tugas
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const syncedProj: Project = p.team
                            ? {
                                ...p,
                                team: {
                                  ...p.team,
                                  ins: Array.from(new Set([p.team.lead, ...leaderMembers])),
                                  tools: leaderTools,
                                },
                              }
                            : p;
                          onOpenProjectDocInEditor(syncedProj, 'surat-jalan');
                        }}
                        className="px-3 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold cursor-pointer"
                      >
                        Surat Jalan Alat
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const syncedProj: Project = p.team
                            ? {
                                ...p,
                                team: {
                                  ...p.team,
                                  ins: Array.from(new Set([p.team.lead, ...leaderMembers])),
                                  tools: leaderTools,
                                },
                              }
                            : p;
                          onOpenProjectDocInEditor(syncedProj, 'jsa');
                        }}
                        className="px-3 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold cursor-pointer"
                      >
                        JSA
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewDoc({
                            title: routeDoc(p.kota),
                            html: buildSpkSpdHtml(p, state.insp),
                            filename: `${routeDoc(p.kota).toLowerCase()}-${p.no}.html`,
                          })
                        }
                        className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                      >
                        {routeDoc(p.kota)} ({isLocalCity(p.kota) ? 'Sby/Sda/Gresik' : 'Luar Area'})
                      </button>
                    </div>

                    {renderSignedScansChecklist(true)}

                    {p.docs.ack ? (
                      <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg">
                        <CheckCircle2 className="w-4 h-4" /> Dokumen telah dikonfirmasi Ketua Tim
                      </div>
                    ) : p.team.lead === activeIns.id ? (
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateProject(
                            appendLog(
                              { ...p, docs: { ...p.docs, ack: true } },
                              'Ketua tim mengonfirmasi dokumen'
                            )
                          );
                          onToast('Dokumen dikonfirmasi');
                        }}
                        className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 cursor-pointer"
                      >
                        Saya Ketua Tim, dokumen sudah diunduh dan dibaca
                      </button>
                    ) : (
                      <div className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
                        Menunggu konfirmasi Ketua Tim ({findIns(p.team.lead)?.nama || '-'}).
                      </div>
                    )}

                    {p.status === 'scheduled' && (() => {
                      const missingScans = getMissingSignedScans(p);
                      const scansReady = hasAllRequiredSignedScans(p);
                      return (
                        <div className="pt-2 space-y-2">
                          {!scansReady && (
                            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-xs text-amber-900">
                              <b>Belum dapat lanjut ke Pengujian:</b> Wajib print, mintakan tanda tangan manual Tenaga Teknik, lalu upload scan dokumen:{' '}
                              <b>{missingScans.map((d) => SAVED_DOC_LABELS[d]).join(', ')}</b>.
                            </div>
                          )}
                          <button
                            type="button"
                            disabled={!(p.docs.issued && p.docs.ack && scansReady)}
                            onClick={() => {
                              if (!scansReady) {
                                onToast(
                                  `Unggah scan TTD manual terlebih dahulu (${missingScans
                                    .map((d) => SAVED_DOC_LABELS[d])
                                    .join(', ')})`
                                );
                                return;
                              }
                              onUpdateProject(
                                appendLog({ ...p, status: 'testing' }, 'Pengujian lapangan dimulai (scan TTD manual lengkap)')
                              );
                              onToast('Status proyek: Pengujian Lapangan');
                            }}
                            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-45 cursor-pointer"
                          >
                            Mulai Pengujian
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {p.pjt?.note && p.status === 'testing' && (
                  <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-800">
                    <b>Dikembalikan PJT untuk revisi:</b> {p.pjt.note}
                  </div>
                )}

                {(p.status === 'testing' || p.status === 'submitted') && (
                  <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs space-y-3">
                    <h3 className="font-display text-base font-bold text-slate-900">
                      2. Absensi Selfie Lokasi ({activeIns.nama})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Foto langsung dari kamera dengan watermark waktu, GPS, lokasi proyek, dan nama.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(() => {
                        const hasIn = p.att.some((a) => a.ins === activeIns.id && a.type === 'in');
                        const hasOut = p.att.some((a) => a.ins === activeIns.id && a.type === 'out');
                        return (
                          <>
                            <button
                              type="button"
                              disabled={hasIn}
                              onClick={() => setCamModal({ project: p, type: 'in' })}
                              className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-45 inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <Camera className="w-4 h-4" /> Check-in
                            </button>
                            <button
                              type="button"
                              disabled={!hasIn || hasOut}
                              onClick={() => setCamModal({ project: p, type: 'out' })}
                              className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs font-semibold hover:bg-slate-50 disabled:opacity-45 inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <Camera className="w-4 h-4" /> Check-out
                            </button>
                          </>
                        );
                      })()}
                    </div>
                    {renderAttendanceList(activeIns.id)}
                  </div>
                )}

                {p.status === 'testing' && (
                  <>
                    <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-display text-base font-bold text-slate-900">
                          3. Formulir Uji LHPP ({p.jenis})
                        </h3>
                        <span className="text-[11px] text-emerald-700 font-medium">
                          Draf tersimpan otomatis
                        </span>
                      </div>

                      <div className="divide-y divide-slate-100">
                        {TESTS[p.jenis].map(([key, label, unit]) => {
                          const it = p.form.items[key] || {};
                          const updateItem = (patch: Partial<typeof it>) => {
                            onUpdateProject({
                              ...p,
                              form: {
                                ...p.form,
                                items: {
                                  ...p.form.items,
                                  [key]: { ...it, ...patch },
                                },
                              },
                            });
                          };
                          const assignedTools = p.team!.tools.map(findTool).filter(Boolean) as Tool[];

                          return (
                            <div key={key} className="py-3 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                              <div className="sm:col-span-12 text-xs font-bold text-slate-800">
                                {label} <span className="font-normal text-slate-500">({unit})</span>
                              </div>
                              <div className="sm:col-span-3">
                                <label className="block text-[11px] text-slate-500 mb-1">Nilai ukur</label>
                                <input
                                  value={it.nilai || ''}
                                  onChange={(e) => updateItem({ nilai: e.target.value })}
                                  className="w-full h-9 rounded-lg border border-slate-200 px-2.5 text-xs font-mono"
                                />
                              </div>
                              <div className="sm:col-span-3">
                                <label className="block text-[11px] text-slate-500 mb-1">Hasil</label>
                                <select
                                  value={it.hasil || ''}
                                  onChange={(e) =>
                                    updateItem({ hasil: e.target.value as 'lulus' | 'tidak' | '' })
                                  }
                                  className="w-full h-9 rounded-lg border border-slate-200 px-2 text-xs"
                                >
                                  <option value="">—</option>
                                  <option value="lulus">Sesuai</option>
                                  <option value="tidak">Tidak sesuai</option>
                                </select>
                              </div>
                              <div className="sm:col-span-3">
                                <label className="block text-[11px] text-slate-500 mb-1">Alat (No. Seri)</label>
                                <select
                                  value={it.alat || ''}
                                  onChange={(e) => updateItem({ alat: e.target.value })}
                                  className="w-full h-9 rounded-lg border border-slate-200 px-2 text-xs"
                                >
                                  <option value="">—</option>
                                  {assignedTools.map((tl) => (
                                    <option key={tl.id} value={tl.id}>
                                      {tl.nama} · {tl.sn}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="sm:col-span-3">
                                <label className="block text-[11px] text-slate-500 mb-1">Catatan</label>
                                <input
                                  value={it.cat || ''}
                                  onChange={(e) => updateItem({ cat: e.target.value })}
                                  className="w-full h-9 rounded-lg border border-slate-200 px-2.5 text-xs"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {openFindingsCard(true, false)}

                    <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs space-y-4">
                      <h3 className="font-display text-base font-bold text-slate-900">
                        4. Bukti Foto Pengujian &amp; BAP
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Foto Bukti Pengujian (kompresi otomatis)
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={async (e) => {
                              const files = Array.from(e.target.files || []);
                              if (!files.length) return;
                              try {
                                const metas = await Promise.all(files.map(prepFile));
                                onUpdateProject(
                                  appendLog(
                                    {
                                      ...p,
                                      form: {
                                        ...p.form,
                                        photos: [...p.form.photos, ...metas],
                                      },
                                    },
                                    `${metas.length} foto bukti uji diunggah`
                                  )
                                );
                                onToast('Foto bukti uji diunggah');
                              } catch (err: unknown) {
                                onToast(err instanceof Error ? err.message : 'Gagal unggah foto');
                              }
                            }}
                            className="text-xs w-full"
                          />
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            BAP Bertanda Tangan Digital{' '}
                            {p.bap && <span className="text-emerald-700">✓ {p.bap.name}</span>}
                          </label>
                          <input
                            type="file"
                            accept=".pdf,image/*"
                            onChange={async (e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              try {
                                const meta = await prepFile(f);
                                onUpdateProject(
                                  appendLog({ ...p, bap: meta }, 'BAP bertanda tangan diunggah')
                                );
                                onToast('BAP diunggah');
                              } catch (err: unknown) {
                                onToast(err instanceof Error ? err.message : 'Gagal unggah BAP');
                              }
                            }}
                            className="text-xs w-full"
                          />
                        </div>
                      </div>

                      {p.form.photos.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {p.form.photos.map((ph, i) =>
                            ph.thumb ? (
                              <img
                                key={i}
                                src={ph.thumb}
                                alt={ph.name}
                                className="w-16 h-16 rounded-lg object-cover border border-slate-200"
                              />
                            ) : null
                          )}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          const allFilled = TESTS[p.jenis].every(([k]) => {
                            const x = p.form.items[k];
                            return x && x.hasil && x.alat;
                          });
                          if (!allFilled) {
                            onToast('Lengkapi hasil dan alat untuk semua mata uji LHPP');
                            return;
                          }
                          const teamOk = p.team!.ins.every(
                            (id) =>
                              p.att.some((a) => a.ins === id && a.type === 'in') &&
                              p.att.some((a) => a.ins === id && a.type === 'out')
                          );
                          if (!teamOk) {
                            onToast('Absensi masuk dan pulang semua anggota tim belum lengkap');
                            return;
                          }
                          if (!p.bap) {
                            onToast('Unggah BAP terlebih dahulu');
                            return;
                          }
                          onUpdateProject(
                            appendLog(
                              {
                                ...p,
                                form: { ...p.form, submitted: true },
                                status: 'submitted',
                                pjt: null,
                              },
                              'LHPP dikirim ke PJT'
                            )
                          );
                          onToast('Hasil uji (LHPP) berhasil dikirim ke PJT');
                        }}
                        className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-4 h-4" /> Kirim Hasil Uji (LHPP) ke PJT
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* ROLE PANEL: PJT */}
        {role === 'pjt' && !isAssignedAsTtkHere && (
          <div className="space-y-4">
            {/* Penugasan Leader Tenaga Teknik oleh PJT */}
            {(p.workflowStage === 'forwarded_to_pjt' ||
              p.workflowStage === 'leader_assigned' ||
              p.workflowStage === 'published_work' ||
              (p.salesReadiness && !p.team)) && (
              <div className="rounded-2xl bg-white border border-indigo-200 p-5 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-base font-bold text-slate-900">
                      Penunjukan Leader Tenaga Teknik (PJT: {p.pjtName || currentPjtName})
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Pesan dari Admin Teknis / Sales untuk menunjuk personel sebagai Leader Tenaga Teknik. Nama PJT aktif otomatis dikecualikan dari daftar Tenaga Teknik.
                    </p>
                  </div>
                  {p.team?.lead && (
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                      Leader: {findIns(p.team.lead)?.nama || '-'}
                    </span>
                  )}
                </div>

                {(p.salesReadiness || p.salesMessage || p.adminForwardNote) && (
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs space-y-1">
                    {p.salesReadiness && (
                      <div>
                        <span className="font-bold text-slate-800">Status dari Sales: </span>
                        <span className="font-semibold text-violet-700">
                          {SALES_READINESS_LABEL[p.salesReadiness]}
                        </span>
                      </div>
                    )}
                    {p.salesMessage && (
                      <div className="text-slate-700">
                        <span className="font-bold text-slate-800">Pesan Sales: </span>
                        {p.salesMessage}
                      </div>
                    )}
                    {p.adminForwardNote && (
                      <div className="text-slate-700">
                        <span className="font-bold text-slate-800">Catatan Admin: </span>
                        {p.adminForwardNote}
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Pilih Leader Tenaga Teknik (Serkom &amp; K3 Aktif)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {state.insp
                      .filter((ins) => !isSamePersonName(ins.nama, p.pjtName || currentPjtName))
                      .map((ins) => {
                      const a = certStatus(ins.serkom);
                      const b = certStatus(ins.k3);
                      const lock = Boolean(a.lock || b.lock);
                      const selected = pjtSelectedLead === ins.id;
                      return (
                        <label
                          key={ins.id}
                          className={`flex items-center justify-between gap-2 p-3 rounded-xl border text-xs ${
                            lock
                              ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
                              : selected
                              ? 'bg-indigo-50 border-indigo-500 cursor-pointer'
                              : 'bg-white border-slate-200 hover:bg-slate-50 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="pjtLeaderPick"
                              disabled={lock}
                              checked={selected}
                              onChange={() => setPjtSelectedLead(ins.id)}
                              className="accent-indigo-600"
                            />
                            <div>
                              <div className="font-bold text-slate-900">{ins.nama}</div>
                              <div className="font-mono text-[10px] text-slate-500">{ins.noReg}</div>
                            </div>
                          </div>
                          <span className="text-[10px] font-semibold text-slate-600">
                            Serkom: {a.t} · K3: {b.t}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!pjtSelectedLead) {
                      onToast('Pilih 1 Tenaga Teknik sebagai Leader terlebih dahulu');
                      return;
                    }
                    const effectivePjt = p.pjtName || currentPjtName;
                    if (isSamePersonName(findIns(pjtSelectedLead)?.nama, effectivePjt)) {
                      onToast('Nama PJT proyek tidak dapat menjadi Leader Tenaga Teknik pada proyek yang sama');
                      return;
                    }
                    const leadObj = findIns(pjtSelectedLead);
                    const existingMembers = (p.team?.ins || []).filter(
                      (id) => !isSamePersonName(findIns(id)?.nama, effectivePjt)
                    );
                    const nextMembers = Array.from(
                      new Set([pjtSelectedLead, ...existingMembers])
                    );
                    onUpdateProject(
                      appendLog(
                        {
                          ...p,
                          pjtName: effectivePjt,
                          team: {
                            ins: nextMembers,
                            tools: p.team?.tools || [],
                            lead: pjtSelectedLead,
                          },
                          workflowStage:
                            p.workflowStage === 'published_work'
                              ? 'published_work'
                              : 'leader_assigned',
                          status: ['rfq', 'offered', 'approved', 'payproof'].includes(p.status)
                            ? 'paid'
                            : p.status,
                        },
                        `PJT (${effectivePjt}) menugaskan Leader Tenaga Teknik: ${leadObj?.nama || pjtSelectedLead}`
                      )
                    );
                    onToast(
                      `${leadObj?.nama || 'Tenaga Teknik'} ditugaskan sebagai Leader Tenaga Teknik`
                    );
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
                >
                  <UserCheck className="w-4 h-4" /> Tugaskan Leader Tenaga Teknik
                </button>
              </div>
            )}

            {p.status === 'submitted' ? (
              <>
                {(() => {
                  const list = checksEvaluation(p, state.insp, state.tools);
                  const allOk = list.every((x) => x.ok);
                  return (
                    <>
                      <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs space-y-3">
                        <h3 className="font-display text-base font-bold text-slate-900">
                          Daftar Periksa Evaluasi PJT
                        </h3>
                        <div className="divide-y divide-slate-100">
                          {list.map((chk, idx) => (
                            <div key={idx} className="py-2.5 flex items-start gap-3 text-xs">
                              <span
                                className={`w-6 h-6 rounded-full flex items-center justify-center font-bold shrink-0 ${
                                  chk.ok
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-red-50 text-red-700'
                                }`}
                              >
                                {chk.ok ? '✓' : '!'}
                              </span>
                              <div>
                                <div className="font-medium text-slate-800">{chk.t}</div>
                                {chk.note && (
                                  <div className="text-[11px] text-slate-500 mt-0.5">{chk.note}</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {renderResultCard()}

                      <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs">
                        <h3 className="font-display text-base font-bold text-slate-900">
                          Log Absensi Selfie
                        </h3>
                        {renderAttendanceList()}
                      </div>

                      <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs space-y-3">
                        <h3 className="font-display text-base font-bold text-slate-900">
                          Keputusan Evaluasi PJT
                        </h3>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">
                            Catatan (wajib diisi bila dikembalikan untuk revisi)
                          </label>
                          <textarea
                            rows={2}
                            value={pjtNote}
                            onChange={(e) => setPjtNote(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 p-2.5 text-xs"
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={!allOk}
                            onClick={() => {
                              onUpdateProject(
                                appendLog(
                                  {
                                    ...p,
                                    status: 'approvedPJT',
                                    pjt: { at: isoToday() },
                                  },
                                  'PJT menyetujui kelayakan operasi'
                                )
                              );
                              onToast('Kelayakan operasi disetujui PJT');
                            }}
                            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-45 cursor-pointer"
                          >
                            Setujui Kelayakan Operasi
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!pjtNote.trim()) {
                                onToast('Isi catatan revisi terlebih dahulu');
                                return;
                              }
                              onUpdateProject(
                                appendLog(
                                  {
                                    ...p,
                                    status: 'testing',
                                    pjt: { note: pjtNote.trim() },
                                    form: { ...p.form, submitted: false },
                                  },
                                  'PJT mengembalikan untuk revisi'
                                )
                              );
                              setPjtNote('');
                              onToast('Dikembalikan ke tim inspektor untuk revisi');
                            }}
                            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                          >
                            Kembalikan untuk Revisi
                          </button>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </>
            ) : (
              <>
                <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-xs text-blue-800">
                  {p.pjt?.at
                    ? `Disetujui PJT pada ${formatDateShort(p.pjt.at)}.`
                    : 'Proyek belum masuk tahap evaluasi PJT.'}
                </div>
                {p.form.submitted && renderResultCard()}
                {renderSloCard()}
              </>
            )}
          </div>
        )}

        {/* ROLE PANEL: DIREKTUR (FULL REVIEW ONLY / READ-ONLY) */}
        {role === 'direktur' && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-indigo-50 border border-indigo-200 p-4 text-xs text-indigo-950 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  <b>Mode Review Direktur (Read-Only):</b> Anda dapat melihat seluruh progress proyek,
                  penawaran, penugasan PJT &amp; Tim TTK, dokumen tugas ber-TTE, pesan kendala, hasil
                  LHPP, dan SLO tanpa hak input atau perubahan data.
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-indigo-800 font-bold text-[11px]">
                Hanya Lihat
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs space-y-2 text-xs">
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Ringkasan Sales, Admin &amp; PJT
                </h3>
                <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5">
                  <dt className="text-slate-500">Status Sales</dt>
                  <dd className="font-semibold text-slate-900">
                    {p.salesReadiness ? SALES_READINESS_LABEL[p.salesReadiness] : '-'}
                  </dd>
                  <dt className="text-slate-500">Pesan Sales</dt>
                  <dd className="text-slate-700">{p.salesMessage || '-'}</dd>
                  <dt className="text-slate-500">Catatan Admin</dt>
                  <dd className="text-slate-700">{p.adminForwardNote || '-'}</dd>
                  <dt className="text-slate-500">PJT Penanggung Jawab</dt>
                  <dd className="font-semibold text-indigo-800">{p.pjtName || '-'}</dd>
                  <dt className="text-slate-500">Jenis Tugas Area</dt>
                  <dd className="font-semibold text-blue-700">
                    {routeDoc(p.kota)} ({isLocalCity(p.kota) ? 'Surabaya/Sidoarjo/Gresik' : 'Luar Area'})
                  </dd>
                  {p.penawaran && (
                    <>
                      <dt className="text-slate-500">Penawaran ({p.penawaran.no})</dt>
                      <dd className="font-mono font-semibold text-slate-900">
                        {formatRupiah(
                          Math.round((p.penawaran.jasa + p.penawaran.mob) * (1 + p.penawaran.ppn / 100))
                        )}
                      </dd>
                    </>
                  )}
                </dl>
              </div>

              <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs space-y-3 text-xs">
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Tim Tenaga Teknik, Alat Uji &amp; Dokumen Tugas
                </h3>
                {p.team ? (
                  <>
                    <div className="space-y-1 text-slate-700">
                      <div>
                        <b>Leader TTK:</b> {findIns(p.team.lead)?.nama || '-'}
                      </div>
                      <div>
                        <b>Anggota Tim:</b>{' '}
                        {p.team.ins.map((id) => findIns(id)?.nama).filter(Boolean).join(', ') || '-'}
                      </div>
                      <div>
                        <b>Alat Uji:</b>{' '}
                        {p.team.tools.map((id) => findTool(id)?.nama).filter(Boolean).join(', ') || '-'}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onOpenProjectDocInEditor(p, 'surat-tugas')}
                        className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold cursor-pointer"
                      >
                        Lihat Surat Tugas {p.docTte?.suratTugas?.enabled ? '(TTE)' : ''}
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenProjectDocInEditor(p, 'surat-jalan')}
                        className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold cursor-pointer"
                      >
                        Lihat Surat Jalan {p.docTte?.suratJalan?.enabled ? '(TTE)' : ''}
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenProjectDocInEditor(p, 'jsa')}
                        className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold cursor-pointer"
                      >
                        Lihat JSA {p.docTte?.jsa?.enabled ? '(TTE)' : ''}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewDoc({
                            title: `Pratinjau ${routeDoc(p.kota)}`,
                            html: buildSpkSpdHtml(p, state.insp),
                            filename: `${routeDoc(p.kota).toLowerCase()}-${p.no}.html`,
                          })
                        }
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                      >
                        Lihat {routeDoc(p.kota)} {p.docTte?.sptSpd?.enabled ? '(TTE)' : ''}
                      </button>
                    </div>
                    <div className="pt-2">
                      {renderSignedScansChecklist(false)}
                    </div>
                  </>
                ) : (
                  <p className="text-slate-500">Tim Tenaga Teknik &amp; alat belum ditugaskan.</p>
                )}
              </div>
            </div>

            {p.leaderMessages && p.leaderMessages.length > 0 && (
              <div className="rounded-2xl bg-white border border-amber-200 p-5 shadow-xs space-y-2.5">
                <h3 className="font-display text-sm font-bold text-slate-900 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-amber-600" />
                  Catatan Kendala Pekerjaan (Leader TTK → Admin Teknis)
                </h3>
                <div className="space-y-2 text-xs">
                  {p.leaderMessages
                    .slice()
                    .reverse()
                    .map((msg) => (
                      <div
                        key={msg.id}
                        className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-1"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-slate-900">
                            {msg.category} — {msg.senderName}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              msg.status === 'open'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {msg.status === 'open' ? 'Menunggu Admin' : '✓ Ditindaklanjuti'}
                          </span>
                        </div>
                        {msg.note && <p className="text-slate-700">{msg.note}</p>}
                        {msg.adminReply && (
                          <p className="text-emerald-800">
                            <b>Balasan Admin:</b> {msg.adminReply}
                          </p>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {p.att.length > 0 && (
              <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs">
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Absensi Selfie &amp; GPS Lapangan
                </h3>
                {renderAttendanceList()}
              </div>
            )}

            {p.form.submitted && renderResultCard()}
            {p.finds.length > 0 && openFindingsCard(false, false)}
            {p.pjt && (
              <div className="rounded-2xl bg-white border border-slate-200/80 p-4 text-xs text-slate-700">
                <b>Catatan / Keputusan PJT:</b> {p.pjt.note || 'Disetujui PJT'}
                {p.pjt.at ? ` (${formatDateShort(p.pjt.at)})` : ''}
              </div>
            )}
            {renderSloCard()}
          </div>
        )}

        {/* FILES & HISTORY */}
        <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs space-y-3">
          <h3 className="font-display text-sm font-bold text-slate-900">Berkas &amp; Riwayat</h3>
          {(() => {
            const allFiles = [
              ...p.files,
              ...(p.po ? [p.po] : []),
              ...(p.transfer ? [p.transfer] : []),
              ...(p.bap ? [{ k: 'BAP', ...p.bap }] : []),
            ];
            return allFiles.length > 0 ? (
              <div className="divide-y divide-slate-100 text-xs">
                {allFiles.map((f, idx) => (
                  <div key={idx} className="py-1.5 flex items-center justify-between gap-2">
                    <span>
                      <b className="text-slate-800">{f.k || 'Berkas'}</b>{' '}
                      <span className="text-slate-500">{f.name}</span>
                    </span>
                    <span className="font-mono text-slate-500 tabular-nums">
                      {formatFileSize(f.size)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Belum ada berkas terunggah.</p>
            );
          })()}

          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
            {p.log
              .slice()
              .reverse()
              .slice(0, 6)
              .map(([ts, msg], idx) => (
                <div key={idx}>
                  <span className="font-mono">{formatDateTime(ts)}</span> — {msg}
                </div>
              ))}
          </div>
        </div>

        {/* Camera Modal */}
        {camModal && (
          <CameraModal
            project={camModal.project}
            inspector={activeIns}
            type={camModal.type}
            onClose={() => setCamModal(null)}
            onCapture={(rec: AttendanceRecord) => {
              onUpdateProject(
                appendLog(
                  { ...p, att: [...p.att, rec] },
                  `${activeIns.nama} ${rec.type === 'in' ? 'check-in' : 'check-out'} (${
                    rec.mode === 'live' ? 'kamera + GPS' : 'simulasi'
                  })`
                )
              );
              setCamModal(null);
              onToast('Absensi berhasil dicatat');
            }}
          />
        )}

        {/* Document Preview Modal */}
        {previewDoc && (
          <div
            className="fixed inset-0 z-50 bg-slate-950/65 flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setPreviewDoc(null)}
          >
            <div
              className="w-full max-w-3xl rounded-2xl bg-white p-5 shadow-2xl space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <h3 className="font-display text-base font-bold text-slate-900">
                  {previewDoc.title}
                </h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const bodyEl = previewIframeRef.current?.contentDocument?.body;
                      if (!bodyEl) {
                        onToast('Dokumen belum siap untuk diekspor ke PDF');
                        return;
                      }
                      const pdfName = previewDoc.filename.replace(/\.html?$/i, '.pdf');
                      await exportElementToPdf(bodyEl, {
                        filename: pdfName,
                        singlePageFit: true,
                        marginMm: 6,
                      });
                      onToast(`PDF "${pdfName}" berhasil diunduh`);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 cursor-pointer"
                  >
                    Unduh PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadTextFile(previewDoc.filename, previewDoc.html)}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 cursor-pointer"
                  >
                    Unduh HTML
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDoc(null)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </div>
              <iframe
                ref={previewIframeRef}
                title={previewDoc.title}
                srcDoc={previewDoc.html}
                className="w-full h-[65vh] rounded-xl border border-slate-200 bg-white"
              />
            </div>
          </div>
        )}

        {/* Signed Scan Preview Modal */}
        {scanPreviewModal && (
          <div
            className="fixed inset-0 z-50 bg-slate-950/65 flex items-center justify-center p-4"
            onClick={() => setScanPreviewModal(null)}
          >
            <div
              className="w-full max-w-3xl max-h-[90dvh] rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
                <div className="min-w-0">
                  <h3 className="font-display text-sm font-bold text-slate-900 truncate">
                    {scanPreviewModal.title}
                  </h3>
                  <p className="text-xs text-slate-500 truncate">{scanPreviewModal.name}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      triggerDataUrlDownload(scanPreviewModal.dataUrl, scanPreviewModal.name)
                    }
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Unduh Scan
                  </button>
                  <button
                    type="button"
                    onClick={() => setScanPreviewModal(null)}
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto bg-slate-100 p-4 flex items-center justify-center">
                {scanPreviewModal.mimeType.startsWith('image/') ||
                scanPreviewModal.dataUrl.startsWith('data:image/') ? (
                  <img
                    src={scanPreviewModal.dataUrl}
                    alt={scanPreviewModal.name}
                    className="max-w-full max-h-[70vh] rounded-lg shadow-sm border border-slate-200 bg-white"
                  />
                ) : (
                  <iframe
                    src={scanPreviewModal.dataUrl}
                    title={scanPreviewModal.name}
                    className="w-full h-[70vh] rounded-lg border border-slate-200 bg-white"
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 4. PROJECT LIST VIEW (filtered by role & search)
  const insLocked =
    role === 'inspektor' &&
    Boolean(certStatus(activeIns.serkom).lock || certStatus(activeIns.k3).lock);

  const visibleProjects = state.proj.filter((p) => {
    if (role === 'inspektor') {
      if (!p.team || (!p.team.ins.includes(activeIns.id) && p.team.lead !== activeIns.id)) {
        return false;
      }
    }
    if (role === 'pjt') {
      const assignedAsTtk = Boolean(
        p.team &&
          (p.team.ins.includes(activeIns.id) || p.team.lead === activeIns.id) &&
          !isSamePersonName(p.pjtName, currentPjtName)
      );
      const belongsToMyPjtName = p.pjtName
        ? isSamePersonName(p.pjtName, currentPjtName)
        : false;
      const openForwardQueue =
        p.workflowStage === 'forwarded_to_pjt' &&
        (!p.pjtName || isSamePersonName(p.pjtName, currentPjtName));

      if (!assignedAsTtk && !belongsToMyPjtName && !openForwardQueue) {
        return false;
      }
    }
    if (role === 'teknis') {
      if (adminViewFilter === 'inbox') {
        const isIncoming =
          Boolean(p.salesReadiness) &&
          (!p.workflowStage || p.workflowStage === 'draft' || p.workflowStage === 'sent_to_admin');
        if (!isIncoming) return false;
      } else if (adminViewFilter === 'kendala') {
        const hasOpenIssue = (p.leaderMessages || []).some((m) => m.status === 'open');
        if (!hasOpenIssue) return false;
      } else if (adminViewFilter === 'menu_pekerjaan') {
        if (!p.publishedToWorkMenu && p.workflowStage !== 'published_work') return false;
      }
    }
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        p.perusahaan.toLowerCase().includes(q) ||
        p.no.toLowerCase().includes(q) ||
        p.kota.toLowerCase().includes(q) ||
        p.sub.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const adminInboxProjects =
    role === 'teknis'
      ? state.proj.filter(
          (p) =>
            Boolean(p.salesReadiness) &&
            (!p.workflowStage || p.workflowStage === 'draft' || p.workflowStage === 'sent_to_admin')
        )
      : [];

  const adminLeaderIssueProjects =
    role === 'teknis'
      ? state.proj.filter((p) => (p.leaderMessages || []).some((m) => m.status === 'open'))
      : [];

  const adminPublishedCount = state.proj.filter(
    (p) => p.publishedToWorkMenu || p.workflowStage === 'published_work'
  ).length;

  const pjtPendingAssign =
    role === 'pjt'
      ? state.proj.filter(
          (p) =>
            p.workflowStage === 'forwarded_to_pjt' &&
            (!p.pjtName || isSamePersonName(p.pjtName, currentPjtName))
        )
      : [];

  return (
    <div className="space-y-4">
      {role === 'direktur' && (
        <div className="rounded-2xl bg-indigo-50 border border-indigo-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-indigo-950">
            <Eye className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>
              <b>Mode Review Direktur (Read-Only):</b> Menampilkan seluruh daftar pekerjaan dan
              proyek di portal. Tugas input data dikhususkan pada <b>Admin</b>.
            </span>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-[11px] font-bold text-indigo-800">
            Hanya Lihat
          </span>
        </div>
      )}

      {role === 'inspektor' && (
        <div className="rounded-2xl bg-white border border-slate-200/80 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Tenaga Teknik Aktif:
            </span>
            <span className="px-3 py-1 rounded-lg bg-violet-50 border border-violet-200 text-xs font-bold text-violet-900">
              {activeIns.nama} ({activeIns.noReg})
            </span>
            <span className="text-[11px] text-slate-500">
              Menampilkan hanya proyek di mana Anda ditunjuk sebagai Leader atau Anggota tim.
            </span>
          </div>
          <div className="text-xs font-medium text-slate-600">
            Serkom: <b>{certStatus(activeIns.serkom).t}</b> · K3:{' '}
            <b>{certStatus(activeIns.k3).t}</b>
          </div>
        </div>
      )}

      {role === 'pjt' && (
        <div className="rounded-2xl bg-white border border-indigo-200/80 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">
              PJT Aktif:
            </span>
            <span className="px-3 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-900">
              {currentPjtName}
            </span>
            <span className="text-[11px] text-slate-500">
              Dapat mengakses proyek atas nama Anda sebagai PJT, serta proyek di mana Anda ditunjuk sebagai Tenaga Teknik oleh PJT lain.
            </span>
          </div>
          <div className="text-xs font-medium text-slate-600">
            Serkom: <b>{certStatus(activeIns.serkom).t}</b> · K3:{' '}
            <b>{certStatus(activeIns.k3).t}</b>
          </div>
        </div>
      )}

      {insLocked && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-800 flex items-center gap-2.5">
          <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
          <span>
            <b>Akun terkunci.</b> Sertifikat Serkom/K3 Anda kedaluwarsa, sehingga tidak dapat ditugaskan. Hubungi Admin Teknis.
          </span>
        </div>
      )}

      {/* Admin Teknis: Pesan Kendala dari Leader Tenaga Teknik Banner */}
      {role === 'teknis' && adminLeaderIssueProjects.length > 0 && (
        <div className="rounded-2xl bg-amber-50 border border-amber-300 p-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              Pesan Keterangan / Kendala Pekerjaan dari Leader TTK ({adminLeaderIssueProjects.length}{' '}
              Proyek)
            </div>
            <span className="text-[11px] font-semibold text-amber-800">
              Klik proyek untuk membalas &amp; menindaklanjuti
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {adminLeaderIssueProjects.map((pr) => {
              const openMsgs = (pr.leaderMessages || []).filter((m) => m.status === 'open');
              const latest = openMsgs[openMsgs.length - 1];
              return (
                <div
                  key={pr.id}
                  className="rounded-xl bg-white border border-amber-200 p-3 flex flex-wrap items-center justify-between gap-2 shadow-2xs"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {pr.perusahaan}{' '}
                      <span className="font-mono text-[11px] font-normal text-slate-500">
                        ({pr.no})
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {openMsgs.map((m) => (
                        <span
                          key={m.id}
                          className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold"
                        >
                          {m.category}
                        </span>
                      ))}
                    </div>
                    {latest && (
                      <div className="text-[11px] text-slate-600 line-clamp-1">
                        <b>{latest.senderName}:</b> {latest.note || latest.category}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectProject(pr.id)}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold shrink-0 cursor-pointer"
                  >
                    Tindak Lanjuti
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Admin Teknis: Pesan Masuk dari Tim Sales Banner */}
      {role === 'teknis' && adminInboxProjects.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-r from-blue-50 to-violet-50 border border-blue-200 p-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
              <Mail className="w-4 h-4 text-blue-600" />
              Pesan Masuk dari Tim Sales ({adminInboxProjects.length} Pekerjaan Siap Diteruskan ke PJT)
            </div>
            <span className="text-[11px] font-semibold text-slate-600">
              Klik pekerjaan untuk meneruskan ke PJT
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {adminInboxProjects.map((pr) => (
              <div
                key={pr.id}
                className="rounded-xl bg-white border border-blue-200/80 p-3 flex flex-wrap items-center justify-between gap-2 shadow-2xs"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">{pr.perusahaan}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {pr.no} · {pr.kota} ({routeDoc(pr.kota)})
                  </div>
                  {pr.salesReadiness && (
                    <span className="mt-1 inline-block px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                      {SALES_READINESS_LABEL[pr.salesReadiness]}
                    </span>
                  )}
                  {pr.salesMessage && (
                    <div className="text-[11px] text-slate-600 italic mt-1 line-clamp-1">
                      &ldquo;{pr.salesMessage}&rdquo;
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onSelectProject(pr.id)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold shrink-0 cursor-pointer"
                >
                  Teruskan ke PJT
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PJT: Pending Leader Assignment Banner */}
      {role === 'pjt' && pjtPendingAssign.length > 0 && (
        <div className="rounded-2xl bg-indigo-50 border border-indigo-200 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-indigo-900">
            <b>{pjtPendingAssign.length} pekerjaan</b> diteruskan Admin Teknis dan menunggu PJT menunjuk{' '}
            <b>Leader Tenaga Teknik</b>.
          </div>
          <button
            type="button"
            onClick={() => onSelectProject(pjtPendingAssign[0].id)}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
          >
            Tugaskan Leader ({pjtPendingAssign[0].perusahaan})
          </button>
        </div>
      )}

      {/* Admin Teknis: Filter Tabs for Menu Pekerjaan vs Pesan Sales vs Kendala Leader */}
      {role === 'teknis' && (
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ['all', `Semua Pekerjaan (${state.proj.length})`],
              ['inbox', `Pesan Masuk Sales (${adminInboxProjects.length})`],
              ['kendala', `Kendala Leader (${adminLeaderIssueProjects.length})`],
              ['menu_pekerjaan', `Menu Pekerjaan Aktif (${adminPublishedCount})`],
            ] as ['all' | 'inbox' | 'kendala' | 'menu_pekerjaan', string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setAdminViewFilter(key)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                adminViewFilter === key
                  ? 'bg-[#0F1E3D] text-white border-[#0F1E3D]'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari perusahaan, nomor RFQ, kota..."
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-white text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
        >
          <option value="all">Semua Status</option>
          {(Object.keys(STATUS_LABEL) as Array<keyof typeof STATUS_LABEL>).map((st) => (
            <option key={st} value={st}>
              {STATUS_LABEL[st]}
            </option>
          ))}
        </select>
      </div>

      {/* Project Cards List */}
      {visibleProjects.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200/80 p-8 text-center text-sm text-slate-500">
          Tidak ada proyek yang sesuai untuk ditampilkan pada tampilan ini.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {visibleProjects.map((p) => {
            const st = STATUS_COLORS[p.status];
            const isLeaderHere =
              (role === 'inspektor' ||
                (role === 'pjt' && !isSamePersonName(p.pjtName, currentPjtName))) &&
              p.team?.lead === activeIns.id;
            const isMemberHere =
              (role === 'inspektor' ||
                (role === 'pjt' && !isSamePersonName(p.pjtName, currentPjtName))) &&
              !isLeaderHere &&
              Boolean(p.team?.ins.includes(activeIns.id));
            const openIssueCount = (p.leaderMessages || []).filter((m) => m.status === 'open').length;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectProject(p.id)}
                className="text-left rounded-2xl bg-white border border-slate-200/80 p-4 shadow-xs hover:border-blue-500 transition cursor-pointer flex flex-col justify-between gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-display text-base font-bold text-slate-900 truncate">
                        {p.perusahaan}
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                        {p.no} · {p.kota}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0 ${st.bg} ${st.text}`}
                  >
                    {STATUS_LABEL[p.status]}
                  </span>
                </div>

                {/* Workflow badges strip */}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold">
                  {openIssueCount > 0 && (
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                      ⚠ {openIssueCount} Kendala Leader
                    </span>
                  )}
                  {p.pjtName && (
                    <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200">
                      PJT: {p.pjtName}
                    </span>
                  )}
                  {p.salesReadiness && (
                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                      {SALES_READINESS_LABEL[p.salesReadiness]}
                    </span>
                  )}
                  {p.workflowStage === 'forwarded_to_pjt' && (
                    <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                      Diteruskan ke PJT
                    </span>
                  )}
                  {p.workflowStage === 'leader_assigned' && (
                    <span className="px-2 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200">
                      Leader Ditunjuk ({state.insp.find((i) => i.id === p.team?.lead)?.nama || '-'})
                    </span>
                  )}
                  {(p.publishedToWorkMenu || p.workflowStage === 'published_work') && (
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      ✓ Menu Pekerjaan (TTE Lengkap)
                    </span>
                  )}
                  {isLeaderHere && (
                    <span className="px-2 py-0.5 rounded bg-violet-600 text-white">
                      Anda Leader TTK
                    </span>
                  )}
                  {isMemberHere && (
                    <span className="px-2 py-0.5 rounded bg-blue-600 text-white">
                      Anggota TTK ({p.team?.ins.length || 0} personel)
                    </span>
                  )}
                  {p.status === 'scheduled' && p.team && (() => {
                    const cnt = REQUIRED_SIGNED_DOCS.filter((dt) => Boolean(p.signedScans?.[dt])).length;
                    return (
                      <span
                        className={`px-2 py-0.5 rounded border ${
                          cnt === 3
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        Scan TTD: {cnt}/3
                      </span>
                    );
                  })()}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
                  <span>
                    {p.jenis} — {p.sub} · <b>{p.kap}</b>
                  </span>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const linkedJoSo = (state.joSoRecords || []).find(
                        (j) => j.id === p.joSoId || j.projectId === p.id
                      );
                      if (!linkedJoSo || (role !== 'sales' && role !== 'direktur')) return null;
                      return (
                        <span className="px-2 py-0.5 rounded bg-violet-50 text-violet-700 font-mono text-[10px] font-bold">
                          SO/JO: {linkedJoSo.poNo || linkedJoSo.noPenawaran}
                        </span>
                      );
                    })()}
                    <span className="font-semibold text-blue-700 inline-flex items-center gap-1">
                      <FileCheck className="w-3.5 h-3.5" /> {routeDoc(p.kota)}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
