import React, { useEffect, useRef, useState } from 'react';
import { usePersistedState } from '../hooks/usePersistedState';
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
  Mail,
  MessageSquare,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Upload,
  UserCheck,
  X,
} from 'lucide-react';
import {
  AppDatabaseState,
  AttendanceRecord,
  DOC_CONFIG,
  FileMeta,
  Inspector,
  LEADER_ISSUE_PRESETS,
  LEADER_STATUS_LABEL,
  LeaderAdminMessage,
  ORG,
  Project,
  Role,
  SalesReadiness,
  SavedDocType,
  STATUS_LABEL,
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
  isLeaderReadyForDocs,
  inspectorLocked,
  isLocalCity,
  isSamePersonName,
  k3Status,
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
import type { DocTab } from './DocEditorSuite';
import {
  DirectorReviewPanel,
  InstalasiDjkPanel,
  LeaderStatusPanel,
  LeaderStatusSummary,
  PjtPrepReviewPanel,
  PrepSubmitPanel,
  ReportList,
  ReportUploadPanel,
  SloNoticePanel,
} from './FlowPanels';
import { AlurTabel, type AlurRowKey } from './AlurTabel';

const ROW_TITLES: Record<AlurRowKey, string> = {
  spk: 'SPK & Pemberitahuan',
  admin: 'Teruskan ke PJT',
  pjt_leader: 'Tunjuk Leader/PIC',
  leader_notice: 'Status Pekerjaan',
  prep_docs: 'ST, JSA & Surat Jalan',
  pjt_review: 'Review Dokumen',
  director: 'Review & TTD Surat Tugas',
  report: 'Laporan Pengujian',
  pjt_report: 'Review Laporan',
  slo: 'SLO Terbit',
  instalasi: 'Instalasi & No. Agenda DJK',
  berkas: 'Berkas & Riwayat',
};

interface ProjectWorkflowProps {
  mode: 'proyek' | 'profil';
  role: Role;
  session: UserSession;
  state: AppDatabaseState;
  selectedProjectId: string | null;
  activeInspectorId: string;
  onSelectInspector: (id: string) => void;
  onSelectProject: (id: string | null) => void;
  onUpdateProject: (updated: Project) => void;
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
  onOpenProjectDocInEditor,
  onApplyTteToEditors,
  onOpenJoSoEditor,
  onUploadSignedScan,
  onToast,
}: ProjectWorkflowProps) {
  const [searchQuery, setSearchQuery] = usePersistedState('proyek.search', '');
  const [statusFilter, setStatusFilter] = usePersistedState<string>('proyek.statusFilter', 'all');
  const [adminViewFilter, setAdminViewFilter] = usePersistedState<
    'all' | 'inbox' | 'kendala' | 'menu_pekerjaan'
  >('proyek.adminView', 'all');

  // Sales Offer & Readiness state
  const [jasaVal, setJasaVal] = useState<number>(15000000);
  const [mobVal, setMobVal] = useState<number>(1500000);
  const [ppnVal, setPpnVal] = useState<number>(11);
  const [sloUploadMeta, setSloUploadMeta] = useState<FileMeta | null>(null);

  // Teknis -> PJT -> Leader Assignment state
  const [pjtSelectedLead, setPjtSelectedLead] = useState('');

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
  // Panel "Status Pekerjaan" (Tenaga Teknik) dibuka manual lewat kotak alur bila status sudah Siap Uji
  const [openRow, setOpenRow] = useState<AlurRowKey | null>(null);
  const [statusPanelOpen, setStatusPanelOpen] = usePersistedState('proyek.statusPanel', false);
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
            <li>Marketing membuat JO / SO (SPK) dan memberi pemberitahuan ke Admin (pekerjaan tanpa DP / menunggu DP)</li>
            <li>Admin meneruskan ke PJT; PJT menunjuk Leader / PIC</li>
            <li>Leader wajib memberi status pekerjaan; Surat Tugas, JSA, Surat Jalan Alat hanya dapat dibuat bila status Siap Uji (Kekurangan Dokumen atau Akun SiUjang bermasalah harus diselesaikan dulu)</li>
            <li>PJT mereview dokumen persiapan; Direktur Utama mereview, memberi komentar, dan menandatangani Surat Tugas</li>
            <li>Pengujian lapangan; laporan dibuat manual lalu diunggah Leader / anggota ke sistem</li>
            <li>PJT mereview laporan, Admin mencetak SLO, dan PJT menginformasikan bahwa SLO sudah terbit / selesai</li>
          </ol>
        </div>
      </div>
    );
  }

  // 3. PROJECT DETAIL VIEW
  const selectedProject = selectedProjectId
    ? state.proj.find((p) => p.id === selectedProjectId) || null
    : null;

  useEffect(() => {
    if (!selectedProject) return;
    setPjtSelectedLead(selectedProject.team?.lead || '');
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
    const flowBase = {
      p,
      role,
      session,
      state,
      activeIns,
      onUpdateProject,
      onToast,
    };

    // ---- Hak akses kotak "Alur Pekerjaan SLO" ----
    const isTtView = role === 'inspektor' || isAssignedAsTtkHere;
    /** Buka panel langkah dari tabel (aturan akses Tenaga Teknik sama seperti sebelumnya). */
    const handleOpenRow = (key: AlurRowKey) => {
      if (isTtView && key === 'prep_docs' && !isLeaderReadyForDocs(p)) {
        onToast('Kirim status pekerjaan "Siap Uji" terlebih dahulu sebelum membuat Surat Tugas');
        setStatusPanelOpen(true);
        setOpenRow('leader_notice');
        return;
      }
      if (isTtView && key === 'leader_notice') setStatusPanelOpen(true);
      setOpenRow(key);
    };
    const show = (...keys: AlurRowKey[]) => openRow !== null && keys.includes(openRow);

    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => onSelectProject(null)}
          className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Daftar Pekerjaan
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
                  ✓ Daftar Pekerjaan
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
        </div>

        <AlurTabel p={p} effectiveRole={isTtView ? 'inspektor' : role} inspectors={state.insp} onOpen={handleOpenRow} />

        {openRow && (
          <div
            className="no-print fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center p-3 sm:p-6 overflow-y-auto"
            onClick={() => setOpenRow(null)}
          >
            <div
              className="w-full max-w-4xl my-4 rounded-2xl bg-slate-50 shadow-2xl border border-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-3 bg-white rounded-t-2xl border-b border-slate-200">
                <h3 className="font-display text-base font-extrabold text-slate-900">
                  {ROW_TITLES[openRow]} — {p.perusahaan}
                </h3>
                <button
                  type="button"
                  onClick={() => setOpenRow(null)}
                  aria-label="Tutup"
                  className="px-3 h-8 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Tutup
                </button>
              </div>
              <div className="p-5 space-y-4">
{show('instalasi') && (
<>
        <InstalasiDjkPanel key={p.id} p={p} role={role} state={state} onUpdateProject={onUpdateProject} onToast={onToast} />
</>
)}

        {/* ROLE PANEL: SALES */}
        {role === 'sales' && (
          <div className="space-y-4">
{show('slo') && (
<>
            {renderSloCard()}
</>
)}
          </div>
        )}

        {/* ROLE PANEL: ADMIN TEKNIS */}
        {role === 'teknis' && (
          <div className="space-y-4">
{show('slo') && (
<>
            {role === 'teknis' && p.status === 'approvedPJT' && (
              <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs space-y-4">
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900">
                    Terbitkan SLO Resmi
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    PJT sudah menyetujui laporan pengujian. Ekspor ringkasan ke SiUjang Gatrik (CSV), lalu cetak/unggah PDF SLO resmi. Setelah terbit, PJT wajib menginformasikan bahwa SLO selesai.
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
                  disabled={!sloUploadMeta || (p.reports || []).length === 0}
                  onClick={() => {
                    if (!sloUploadMeta) return;
                    if ((p.reports || []).length === 0) {
                      onToast('Laporan pengujian wajib diunggah Tenaga Teknik sebelum SLO dicetak');
                      return;
                    }
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
                    onToast(`SLO ${sloNo} diterbitkan — menunggu informasi PJT`);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-45 cursor-pointer"
                >
                  Terbitkan / Cetak SLO
                </button>
              </div>
            )}
</>
)}

{show('leader_notice') && (
<>
            <LeaderStatusSummary p={p} />
</>
)}
{show('report') && (
<>
            {p.reports && p.reports.length > 0 && (
              <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs space-y-3">
                <h3 className="font-display text-base font-bold text-slate-900">Laporan Pengujian</h3>
                <ReportList p={p} onToast={onToast} />
              </div>
            )}
</>
)}
{show('leader_notice') && (
<>
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
</>
)}

{show('admin', 'spk') && (
<>
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
                  <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800 font-medium">
                    Pekerjaan ini belum diteruskan ke PJT. Admin meneruskannya lewat tombol <b>Pilih Pekerjaan</b> di
                    halaman <b>Daftar Pekerjaan</b>.
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
                    anggota, Surat Tugas, JSA, Surat Jalan, {routeDoc(p.kota)}, TTE &amp; meneruskan ke Daftar Pekerjaan.
                  </div>
                )}

                {(p.workflowStage === 'published_work' || p.publishedToWorkMenu) && (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    Dokumen lengkap ber-TTE telah diteruskan Leader &amp; tampil di Daftar Pekerjaan Admin.
                  </div>
                )}
              </div>
            )}
</>
)}


{show('pjt_leader') && (
<>
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

                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
                  Surat Tugas, Surat Jalan Alat &amp; JSA disiapkan dan dikelola oleh
                  Leader / PJT / Direktur. Admin hanya memantau status dan tidak dapat membuka atau mengubah dokumen tersebut.
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {([
                      ['Surat Tugas', p.docTte?.suratTugas?.enabled],
                    ] as [string, boolean | undefined][]).map(([label, tte]) => (
                      <span
                        key={label}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          tte ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {label}: {tte ? 'TTE' : 'belum TTE'}
                      </span>
                    ))}
                  </div>
                </div>

              </div>
            )}
</>
)}

{show('report') && (
<>
            {p.att.length > 0 && (
              <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs">
                <h3 className="font-display text-base font-bold text-slate-900">
                  Log Absensi Selfie Lapangan
                </h3>
                {renderAttendanceList()}
              </div>
            )}
</>
)}

{show('report') && (
<>
            {p.finds.length > 0 && openFindingsCard(false, false)}
</>
)}
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
{show('leader_notice') && (
<>
                {/* Pemberitahuan status pekerjaan (wajib) */}
                {p.team.lead === activeIns.id ? (
                  // Pesan hilang setelah Leader memilih "Siap Uji"; dibuka lagi lewat kotak "Status Pekerjaan"
                  !isLeaderReadyForDocs(p) || statusPanelOpen ? (
                    <LeaderStatusPanel {...flowBase} onDone={() => setStatusPanelOpen(false)} />
                  ) : null
                ) : (
                  <LeaderStatusSummary p={p} />
                )}
</>
)}

{show('leader_notice', 'report') && (
<>
                {p.leaderStatus && p.team.lead !== activeIns.id && (
                  <div className="rounded-xl bg-violet-50 border border-violet-200 px-4 py-3 text-xs text-violet-900">
                    Anda anggota tim. Leader <b>{findIns(p.team.lead)?.nama || '-'}</b> menyiapkan dokumen &amp;
                    anggota; Anda dapat ikut mengerjakan dan mengunggah <b>laporan pengujian</b> setelah
                    pengujian dimulai.
                  </div>
                )}
</>
)}

{show('prep_docs') && (
<>
                {/* Leader: Buat Surat Tugas → Surat Jalan Alat → JSA → kirim ke PJT */}
                {p.team.lead === activeIns.id && (isLeaderReadyForDocs(p) || Boolean(p.prepReview)) && (
                  <>
                    {p.publishedToWorkMenu && (
                      <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-xs text-emerald-800 font-bold">
                        ✓ Surat Tugas ber-TTE sudah diteruskan Direktur &amp; tampil di Daftar Pekerjaan
                      </div>
                    )}
                    <PrepSubmitPanel {...flowBase} onOpenDoc={onOpenProjectDocInEditor} />
                  </>
                )}
</>
)}

{show('prep_docs') && (
<>
                {(isLeaderReadyForDocs(p) || ['testing', 'submitted'].includes(p.status)) && (
                  <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs space-y-3">
                    <h3 className="font-display text-base font-bold text-slate-900">
                      Paket Dokumen: Surat Tugas, JSA &amp; Surat Jalan Alat (Buat, Simpan PDF &amp; Cetak A4)
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onOpenProjectDocInEditor(p, 'surat-tugas');
                        }}
                        className="px-3 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold cursor-pointer"
                      >
                        Surat Tugas
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onOpenProjectDocInEditor(p, 'surat-jalan');
                        }}
                        className="px-3 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold cursor-pointer"
                      >
                        Surat Jalan Alat
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onOpenProjectDocInEditor(p, 'jsa');
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
                      const forwardedToTt = Boolean(p.publishedToWorkMenu) || p.workflowStage === 'published_work';
                      const directorOk =
                        (p.directorReview?.status === 'signed' && forwardedToTt) ||
                        (!p.prepReview && Boolean(p.docTte?.suratTugas?.enabled));
                      return (
                        <div className="pt-2 space-y-2">
                          {!directorOk && (
                            <div className="rounded-xl bg-indigo-50 border border-indigo-200 px-3.5 py-2.5 text-xs text-indigo-900">
                              <b>Menunggu Direktur:</b> Surat Tugas harus direview PJT, ditandatangani Direktur, dan diteruskan
                              ke Tenaga Teknik sebelum pengujian dimulai.
                            </div>
                          )}
                          {p.leaderStatus?.status !== 'siap_uji' && (
                            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-xs text-amber-900">
                              <b>Status terakhir bukan &quot;Siap Uji&quot;.</b> Kirim pemberitahuan status baru
                              &quot;Siap Uji&quot; setelah kendala selesai.
                            </div>
                          )}
                          <button
                            type="button"
                            disabled={
                              !(p.docs.issued && p.docs.ack && directorOk) ||
                              p.leaderStatus?.status !== 'siap_uji'
                            }
                            onClick={() => {
                              onUpdateProject(
                                appendLog({ ...p, status: 'testing' }, 'Pengujian lapangan dimulai')
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
</>
)}

{show('report') && (
<>
                {p.pjt?.note && p.status === 'testing' && (
                  <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-800">
                    <b>Dikembalikan PJT untuk revisi:</b> {p.pjt.note}
                  </div>
                )}
</>
)}

{show('report') && (
<>
                {['testing', 'submitted', 'approvedPJT', 'slo'].includes(p.status) && (
                  <div id={`panel-laporan-pengujian-${p.id}`} className="scroll-mt-24">
                    <ReportUploadPanel {...flowBase} canSubmit />
                  </div>
                )}
</>
)}

{show('report') && (
<>
                {(p.status === 'testing' || p.status === 'submitted') && (
                  <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs space-y-3">
                    <h3 className="font-display text-base font-bold text-slate-900">
                      Absensi Selfie Lokasi (opsional) — ({activeIns.nama})
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
</>
)}

{show('report') && (
<>
                {p.status === 'testing' && (
                  <>
                    {openFindingsCard(true, false)}

                    <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs space-y-4">
                      <h3 className="font-display text-base font-bold text-slate-900">
                        Bukti Foto Pengujian &amp; BAP (opsional)
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


                    </div>
                  </>
                )}
</>
)}
              </>
            )}
          </div>
        )}

        {/* ROLE PANEL: PJT */}
        {role === 'pjt' && !isAssignedAsTtkHere && (
          <div className="space-y-4">
{show('leader_notice') && (
<>
            <LeaderStatusSummary p={p} />
</>
)}
{show('pjt_review') && (
<>
            {p.prepReview && (
              <PjtPrepReviewPanel {...flowBase} onOpenDoc={onOpenProjectDocInEditor} />
            )}
</>
)}
{show('pjt_leader') && (
<>
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
                    Pilih Leader Tenaga Teknik (SKTTK &amp; K3 Aktif)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {state.insp
                      .filter((ins) => !isSamePersonName(ins.nama, p.pjtName || currentPjtName))
                      .map((ins) => {
                      const a = certStatus(ins.serkom);
                      const b = k3Status(ins);
                      const lock = inspectorLocked(ins);
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
                            SKTTK: {a.t} · K3: {b ? b.t : 'Tidak ada'}
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
</>
)}

{show('pjt_report', 'slo') && (
<>
            {p.status === 'submitted' ? (
              <>
                {(() => {
                  const list = checksEvaluation(p, state.insp, state.tools);
                  const allOk = list.every((x) => x.ok);
                  return (
                    <>
                      <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs space-y-3">
                        <h3 className="font-display text-base font-bold text-slate-900">
                          Review Laporan Pengujian oleh PJT
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

                      <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs space-y-3">
                        <h3 className="font-display text-base font-bold text-slate-900">
                          Laporan Pengujian dari Tenaga Teknik
                        </h3>
                        <ReportList p={p} onToast={onToast} />
                      </div>

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
                                    reportReview: {
                                      status: 'approved',
                                      by: p.pjtName || currentPjtName,
                                      at: new Date().toISOString(),
                                    },
                                  },
                                  'PJT menyetujui laporan pengujian & meneruskan ke Admin untuk penerbitan SLO'
                                )
                              );
                              onToast('Laporan disetujui — diteruskan ke Admin untuk penerbitan SLO');
                            }}
                            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-45 cursor-pointer"
                          >
                            Setujui Laporan &amp; Kirim ke Admin
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
                                    reportReview: {
                                      status: 'revision',
                                      note: pjtNote.trim(),
                                      by: p.pjtName || currentPjtName,
                                      at: new Date().toISOString(),
                                    },
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
</>
)}
          </div>
        )}

        {/* ROLE PANEL: DIREKTUR (FULL REVIEW ONLY / READ-ONLY) */}
        {role === 'direktur' && (
          <div className="space-y-4">
{show('director') && (
<>
            <div className="rounded-2xl bg-indigo-50 border border-indigo-200 p-4 text-xs text-indigo-950 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  <b>Mode Direktur Utama:</b> Anda meninjau progress proyek, memberi komentar, dan
                  menandatangani (TTE) Surat Tugas yang diteruskan PJT. Data lain tidak dapat diubah.
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-indigo-800 font-bold text-[11px]">
                Review · Komentar · TTD
              </span>
            </div>
</>
)}

{show('director') && (
<>
            <DirectorReviewPanel
              {...flowBase}
              onOpenDoc={onOpenProjectDocInEditor}
              onApplyTteToEditors={onApplyTteToEditors}
            />
</>
)}
{show('leader_notice') && (
<>
            <LeaderStatusSummary p={p} />
</>
)}
{show('report') && (
<>
            {p.reports && p.reports.length > 0 && (
              <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs space-y-3">
                <h3 className="font-display text-sm font-bold text-slate-900">Laporan Pengujian</h3>
                <ReportList p={p} onToast={onToast} />
              </div>
            )}
</>
)}

{show('admin', 'spk') && (
<>
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
                  </>
                ) : (
                  <p className="text-slate-500">Tim Tenaga Teknik &amp; alat belum ditugaskan.</p>
                )}
              </div>
            </div>
</>
)}

{show('leader_notice') && (
<>
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
</>
)}

{show('report') && (
<>
            {p.att.length > 0 && (
              <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs">
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Absensi Selfie &amp; GPS Lapangan
                </h3>
                {renderAttendanceList()}
              </div>
            )}
</>
)}

{show('report') && (
<>
            {p.form.submitted && renderResultCard()}
</>
)}
{show('report') && (
<>
            {p.finds.length > 0 && openFindingsCard(false, false)}
</>
)}
{show('pjt_report') && (
<>
            {p.pjt && (
              <div className="rounded-2xl bg-white border border-slate-200/80 p-4 text-xs text-slate-700">
                <b>Catatan / Keputusan PJT:</b> {p.pjt.note || 'Disetujui PJT'}
                {p.pjt.at ? ` (${formatDateShort(p.pjt.at)})` : ''}
              </div>
            )}
</>
)}
{show('slo') && (
<>
            {renderSloCard()}
</>
)}
          </div>
        )}

{show('slo') && (
<>
        {role !== 'sales' && <SloNoticePanel {...flowBase} />}
</>
)}

{show('berkas') && (
<>
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
</>
)}

              </div>
            </div>
          </div>
        )}

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
                sandbox="allow-same-origin"
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
              className="w-full max-w-3xl max-h-[90vh] rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col"
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
    role === 'inspektor' && inspectorLocked(activeIns);

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
              <b>Direktur Utama:</b> Pekerjaan bertanda <b>Menunggu TTD Direktur</b> sudah direview PJT dan
              siap Anda periksa, komentari, dan tandatangani (Surat Tugas).
            </span>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-[11px] font-bold text-indigo-800">
            {state.proj.filter((x) => x.prepReview?.status === 'approved' && x.directorReview?.status === 'pending').length}{' '}
            menunggu TTD
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
            SKTTK: <b>{certStatus(activeIns.serkom).t}</b> · K3:{' '}
            <b>{k3Status(activeIns)?.t ?? 'Tidak ada'}</b>
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
            SKTTK: <b>{certStatus(activeIns.serkom).t}</b> · K3:{' '}
            <b>{k3Status(activeIns)?.t ?? 'Tidak ada'}</b>
          </div>
        </div>
      )}

      {/* PJT: notifikasi review Surat Tugas, Surat Jalan Alat & JSA dari Leader */}
      {role === 'pjt' &&
        (() => {
          const toReview = state.proj.filter(
            (x) =>
              x.prepReview?.status === 'submitted' &&
              (!x.pjtName || isSamePersonName(x.pjtName, currentPjtName))
          );
          if (!toReview.length) return null;
          return (
            <div className="rounded-2xl bg-blue-50 border-2 border-blue-300 p-4 space-y-2">
              <div className="text-sm font-bold text-blue-900">
                Review Surat Tugas, Surat Jalan Alat &amp; JSA ({toReview.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {toReview.map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    onClick={() => onSelectProject(x.id)}
                    className="px-3 py-1.5 rounded-lg bg-white border border-blue-200 text-xs font-semibold text-blue-800 hover:bg-blue-100 cursor-pointer"
                  >
                    {x.no} — {x.perusahaan}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

      {insLocked && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-800 flex items-center gap-2.5">
          <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
          <span>
            <b>Akun terkunci.</b> Sertifikat SKTTK/K3 Anda kedaluwarsa, sehingga tidak dapat ditugaskan. Hubungi Admin Teknis.
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

      {/* Admin Teknis: Filter Tabs for Daftar Pekerjaan vs Pesan Sales vs Kendala Leader */}
      {role === 'teknis' && (
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ['all', `Semua Pekerjaan (${state.proj.length})`],
              ['inbox', `Pesan Masuk Sales (${adminInboxProjects.length})`],
              ['kendala', `Kendala Leader (${adminLeaderIssueProjects.length})`],
              ['menu_pekerjaan', `Daftar Pekerjaan Aktif (${adminPublishedCount})`],
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
                  {p.workflowStage === 'leader_assigned' && !p.leaderStatus && (
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                      Menunggu Status dari Leader
                    </span>
                  )}
                  {p.leaderStatus && (
                    <span
                      className={`px-2 py-0.5 rounded border ${
                        p.leaderStatus.status === 'siap_uji'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      {LEADER_STATUS_LABEL[p.leaderStatus.status]}
                    </span>
                  )}
                  {p.prepReview?.status === 'submitted' && (
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      Menunggu Review PJT
                    </span>
                  )}
                  {p.prepReview?.status === 'revision' && (
                    <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
                      Dokumen Perlu Revisi
                    </span>
                  )}
                  {p.prepReview?.status === 'approved' && p.directorReview?.status === 'pending' && (
                    <span className="px-2 py-0.5 rounded bg-indigo-600 text-white">
                      Menunggu TTD Direktur
                    </span>
                  )}
                  {p.directorReview?.status === 'signed' && !p.publishedToWorkMenu && p.workflowStage !== 'published_work' && (
                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                      Menunggu Diteruskan ke TT
                    </span>
                  )}
                  {p.directorReview?.status === 'signed' && (
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      ✓ Surat Tugas Ditandatangani
                    </span>
                  )}
                  {(p.reports?.length || 0) > 0 && (
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      {p.reports!.length} Laporan
                    </span>
                  )}
                  {p.status === 'slo' && !p.sloNotice && (
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                      Menunggu Info SLO dari PJT
                    </span>
                  )}
                  {p.sloNotice && (
                    <span className="px-2 py-0.5 rounded bg-emerald-600 text-white">✓ SLO Selesai</span>
                  )}
                  {p.workflowStage === 'leader_assigned' && (
                    <span className="px-2 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200">
                      Leader Ditunjuk ({state.insp.find((i) => i.id === p.team?.lead)?.nama || '-'})
                    </span>
                  )}
                  {(p.publishedToWorkMenu || p.workflowStage === 'published_work') && (
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      ✓ Daftar Pekerjaan (TTE Lengkap)
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
