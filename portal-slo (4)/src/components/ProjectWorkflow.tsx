import React, { useEffect, useState } from 'react';
import { usePersistedState } from '../hooks/usePersistedState';
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Eye,
  FileCheck,
  Mail,
  Search,
  ShieldAlert,
} from 'lucide-react';
import {
  AppDatabaseState,
  Inspector,
  LEADER_STATUS_LABEL,
  ORG,
  Project,
  Role,
  SavedDocType,
  STATUS_LABEL,
  UserSession,
} from '../types/portal';
import {
  certStatus,
  formatDateTime,
  formatFileSize,
  isLeaderReadyForDocs,
  inspectorLocked,
  isLocalCity,
  isSamePersonName,
  k3Status,
  routeDoc,
  SALES_READINESS_LABEL,
  STATUS_COLORS,
} from '../utils/portalUtils';
import type { DocTab } from './DocEditorSuite';
import {
  DirectorReviewPanel,
  InstalasiDjkPanel,
  PrepSubmitPanel,
} from './FlowPanels';
import { PintasanPanel, type AlurRowKey } from './AlurTabel';

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
  /** Admin: buka menu Layanan SLO (langkah 6 alur). */
  onOpenLayananSlo?: () => void;
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
  onOpenProjectDocInEditor: openDocRaw,
  onApplyTteToEditors,
  onToast,
}: ProjectWorkflowProps) {
  const [searchQuery, setSearchQuery] = usePersistedState('proyek.search', '');
  const [statusFilter, setStatusFilter] = usePersistedState<string>('proyek.statusFilter', 'all');
  const [adminViewFilter, setAdminViewFilter] = usePersistedState<
    'all' | 'inbox' | 'kendala' | 'menu_pekerjaan'
  >('proyek.adminView', 'all');

  // Panel "Status Pekerjaan" (Tenaga Teknik) dibuka manual lewat kotak alur bila status sudah Siap Uji
  // Editor dokumen menggantikan halaman ini; langkah yang terbuka diingat agar popup dibuka lagi saat kembali.
  const [openRow, setOpenRow] = useState<AlurRowKey | null>(() => {
    try {
      const [id, key] = (sessionStorage.getItem('alur.resume') || '').split('|');
      if (id && id === selectedProjectId && key) return key as AlurRowKey;
    } catch {
      /* penyimpanan tidak tersedia */
    }
    return null;
  });
  useEffect(() => {
    try {
      sessionStorage.removeItem('alur.resume');
    } catch {
      /* penyimpanan tidak tersedia */
    }
  }, []);
  const onOpenProjectDocInEditor = (project: Project, docTab: DocTab) => {
    try {
      if (openRow) sessionStorage.setItem('alur.resume', `${project.id}|${openRow}`);
    } catch {
      /* penyimpanan tidak tersedia */
    }
    openDocRaw(project, docTab);
  };

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

    /** Buka panel dari tombol pintasan (Instalasi & Berkas). */
    const handleOpenRow = (key: AlurRowKey) => setOpenRow(key);
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
              {p.pjtName && (
                <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold">
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

        <PintasanPanel onOpen={handleOpenRow} />

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

        {/* ROLE PANEL: INSPEKTOR / LEADER TENAGA TEKNIK (atau PJT yang ditugaskan sebagai TTK) */}
        {(role === 'inspektor' || isAssignedAsTtkHere) && (
          <div className="space-y-4">
            {isAssignedAsTtkHere && (
              <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-800 flex flex-wrap items-center justify-between gap-2">
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

{show('prep_docs') && (
<>
                {/* Leader & anggota tim: Buat Surat Tugas → Surat Jalan Alat → JSA → kirim ke Direktur */}
                {(p.team.lead === activeIns.id || p.team.ins.includes(activeIns.id)) && (isLeaderReadyForDocs(p) || Boolean(p.prepReview)) && (
                  <>
                    {p.publishedToWorkMenu && (
                      <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-xs text-emerald-800 font-bold">
                        ✓ Surat Tugas ber-TTE sudah diteruskan Direktur ke Admin untuk input Layanan SLO
                      </div>
                    )}
                    <PrepSubmitPanel {...flowBase} onOpenDoc={onOpenProjectDocInEditor} />
                  </>
                )}
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
            <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4 text-xs text-blue-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  <b>Mode Direktur Utama:</b> Anda meninjau progress proyek, memberi komentar, dan
                  menandatangani (TTE) Surat Tugas yang diteruskan PJT. Data lain tidak dapat diubah.
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-white border border-blue-200 text-blue-800 font-bold text-xs">
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

          </div>
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

          <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 space-y-1">
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
        <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-blue-800">
            <Eye className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              <b>Direktur Utama:</b> Pekerjaan bertanda <b>Menunggu TTD Direktur</b> sudah direview PJT dan
              siap Anda periksa, komentari, dan tandatangani (Surat Tugas).
            </span>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-white border border-blue-200 text-xs font-bold text-blue-800">
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
            <span className="px-3 py-1 rounded-lg bg-blue-50 border border-blue-200 text-xs font-bold text-blue-800">
              {activeIns.nama} ({activeIns.noReg})
            </span>
            <span className="text-xs text-slate-500">
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
        <div className="rounded-2xl bg-white border border-blue-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
              PJT Aktif:
            </span>
            <span className="px-3 py-1 rounded-lg bg-blue-50 border border-blue-200 text-xs font-bold text-blue-800">
              {currentPjtName}
            </span>
            <span className="text-xs text-slate-500">
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
            <span className="text-xs font-semibold text-amber-800">
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
                      <span className="font-mono text-xs font-normal text-slate-500">
                        ({pr.no})
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {openMsgs.map((m) => (
                        <span
                          key={m.id}
                          className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-xs font-bold"
                        >
                          {m.category}
                        </span>
                      ))}
                    </div>
                    {latest && (
                      <div className="text-xs text-slate-600 line-clamp-1">
                        <b>{latest.senderName}:</b> {latest.note || latest.category}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectProject(pr.id)}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shrink-0 cursor-pointer"
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
        <div className="rounded-2xl bg-gradient-to-r from-blue-50 to-blue-50 border border-blue-200 p-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
              <Mail className="w-4 h-4 text-blue-600" />
              Pesan Masuk dari Tim Sales ({adminInboxProjects.length} Pekerjaan Siap Diteruskan ke PJT)
            </div>
            <span className="text-xs font-semibold text-slate-600">
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
                  <div className="text-xs text-slate-500 mt-0.5">
                    {pr.no} · {pr.kota} ({routeDoc(pr.kota)})
                  </div>
                  {pr.salesReadiness && (
                    <span className="mt-1 inline-block px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold">
                      {SALES_READINESS_LABEL[pr.salesReadiness]}
                    </span>
                  )}
                  {pr.salesMessage && (
                    <div className="text-xs text-slate-600 italic mt-1 line-clamp-1">
                      &ldquo;{pr.salesMessage}&rdquo;
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onSelectProject(pr.id)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shrink-0 cursor-pointer"
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
        <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-blue-800">
            <b>{pjtPendingAssign.length} pekerjaan</b> diteruskan Admin Teknis dan menunggu PJT menunjuk{' '}
            <b>Leader Tenaga Teknik</b>.
          </div>
          <button
            type="button"
            onClick={() => onSelectProject(pjtPendingAssign[0].id)}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
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
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
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
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 ${st.bg} ${st.text}`}
                  >
                    {STATUS_LABEL[p.status]}
                  </span>
                </div>

                {/* Workflow badges strip */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
                  {openIssueCount > 0 && (
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                      ⚠ {openIssueCount} Kendala Leader
                    </span>
                  )}
                  {p.pjtName && (
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                      PJT: {p.pjtName}
                    </span>
                  )}
                  {p.salesReadiness && (
                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                      {SALES_READINESS_LABEL[p.salesReadiness]}
                    </span>
                  )}
                  {p.workflowStage === 'forwarded_to_pjt' && (
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
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
                    <span className="px-2 py-0.5 rounded bg-blue-600 text-white">
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
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      Leader Ditunjuk ({state.insp.find((i) => i.id === p.team?.lead)?.nama || '-'})
                    </span>
                  )}
                  {(p.publishedToWorkMenu || p.workflowStage === 'published_work') && (
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      ✓ Daftar Pekerjaan (TTE Lengkap)
                    </span>
                  )}
                  {isLeaderHere && (
                    <span className="px-2 py-0.5 rounded bg-blue-600 text-white">
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
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-mono text-xs font-bold">
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
