import { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  MessageSquare,
  PenLine,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  AppDatabaseState,
  DirectorReview,
  Inspector,
  LEADER_STATUS_LABEL,
  LeaderAdminMessage,
  LeaderWorkStatus,
  MAX_FILE_BYTES,
  Project,
  ReviewComment,
  Role,
  SavedDocType,
  TestReportFile,
  UserSession,
} from '../types/portal';
import {
  createTteStamp,
  currentFlowIndex,
  FLOW_STEPS,
  FlowStepKey,
  formatDateTime,
  formatFileSize,
  SAVED_DOC_LABELS,
} from '../utils/portalUtils';
import {
  blobToDataUrl,
  deleteVaultFile,
  getVaultFile,
  putVaultFile,
  triggerDataUrlDownload,
} from '../utils/fileVault';
import { DocTab } from './DocEditorSuite';

interface BaseProps {
  p: Project;
  role: Role;
  session: UserSession;
  state: AppDatabaseState;
  activeIns: Inspector;
  onUpdateProject: (updated: Project) => void;
  onToast: (msg: string) => void;
}

const appendLog = (p: Project, msg: string): Project => ({
  ...p,
  log: [...p.log, [new Date().toISOString(), msg]],
});

const card = 'rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs space-y-3';

/* ------------------------------------------------------------------ */
/* 0. Penelusur alur kerja (tampil untuk semua peran)                  */
/* ------------------------------------------------------------------ */
export function FlowTracker({
  p,
  focusKey,
  onStepClick,
}: {
  p: Project;
  /** Langkah yang sedang dibuka pengguna (disorot, mis. editor ST/JSA/Surat Jalan). */
  focusKey?: FlowStepKey;
  /** Bila diisi, kotak langkah dapat diklik (mis. membuka editor dokumen). */
  onStepClick?: (key: FlowStepKey) => void;
}) {
  const idx = currentFlowIndex(p);
  return (
    <div className="rounded-2xl bg-white border border-slate-200/80 p-4 shadow-xs">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2.5">
        Alur Pekerjaan SLO
      </div>
      <ol className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {FLOW_STEPS.map((s, i) => {
          const done = i < idx;
          const active = i === idx;
          const focused = focusKey === s.key;
          const clickable = Boolean(onStepClick);
          return (
            <li
              key={s.key}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              aria-current={focused ? 'step' : undefined}
              title={clickable ? `Buka langkah: ${s.label}` : undefined}
              onClick={clickable ? () => onStepClick?.(s.key) : undefined}
              onKeyDown={
                clickable
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onStepClick?.(s.key);
                      }
                    }
                  : undefined
              }
              className={`rounded-xl border px-2.5 py-2 text-[11px] leading-tight ${
                clickable ? 'cursor-pointer hover:brightness-95' : ''
              } ${
                focused
                  ? 'bg-blue-50 border-blue-500 text-blue-900 ring-2 ring-blue-300'
                  : done
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : active
                  ? 'bg-blue-50 border-blue-400 text-blue-900 ring-2 ring-blue-200'
                  : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}
            >
              <div className="font-bold">
                {done ? '✓ ' : `${i + 1}. `}
                {s.label}
              </div>
              <div className="mt-0.5 opacity-80">{s.owner}</div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Berkas laporan: daftar + unduh                                      */
/* ------------------------------------------------------------------ */
export function ReportList({
  p,
  canDeleteId,
  onDelete,
  onToast,
}: {
  p: Project;
  canDeleteId?: (r: TestReportFile) => boolean;
  onDelete?: (r: TestReportFile) => void;
  onToast: (msg: string) => void;
}) {
  const reports = p.reports || [];
  if (reports.length === 0) {
    return <p className="text-xs text-slate-500">Belum ada laporan pengujian yang diunggah.</p>;
  }
  const download = async (r: TestReportFile) => {
    const rec = await getVaultFile(r.vaultFileId);
    if (!rec) {
      onToast('Berkas tidak ditemukan di server maupun perangkat ini');
      return;
    }
    triggerDataUrlDownload(rec.dataUrl, r.name);
  };
  return (
    <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
      {reports.map((r) => (
        <div key={r.id} className="p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="min-w-0">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="truncate">{r.title || r.name}</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {r.name} · {formatFileSize(r.size)} · diunggah {r.uploadedBy} ·{' '}
              {formatDateTime(r.uploadedAt)}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void download(r)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 font-semibold text-slate-700 inline-flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Unduh
            </button>
            {canDeleteId?.(r) && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(r)}
                className="px-2.5 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Hapus
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 1. Leader/PIC: pemberitahuan status pekerjaan (WAJIB)              */
/* ------------------------------------------------------------------ */
export function LeaderStatusPanel({ p, session, activeIns, onUpdateProject, onToast }: BaseProps) {
  const [choice, setChoice] = useState<LeaderWorkStatus>(p.leaderStatus?.status || 'siap_uji');
  const [note, setNote] = useState('');
  const current = p.leaderStatus;

  const send = () => {
    if (choice !== 'siap_uji' && !note.trim()) {
      onToast(`Jelaskan detail untuk status "${LEADER_STATUS_LABEL[choice]}"`);
      return;
    }
    const nowIso = new Date().toISOString();
    const sender = session.name || activeIns.nama;
    const msg: LeaderAdminMessage = {
      id: `lm-${Date.now()}`,
      category: LEADER_STATUS_LABEL[choice],
      note: note.trim(),
      senderName: sender,
      senderId: activeIns.id,
      sentAt: nowIso,
      // "Siap Uji" hanya informasi; dua status lain perlu ditindaklanjuti Admin
      status: choice === 'siap_uji' ? 'resolved' : 'open',
      adminReply: choice === 'siap_uji' ? 'Informasi: pekerjaan siap uji (tanpa tindak lanjut).' : undefined,
      resolvedAt: choice === 'siap_uji' ? nowIso : undefined,
    };
    onUpdateProject(
      appendLog(
        {
          ...p,
          leaderStatus: {
            status: choice,
            note: note.trim(),
            sentBy: sender,
            sentById: activeIns.id,
            sentAt: nowIso,
          },
          leaderMessages: [...(p.leaderMessages || []), msg],
        },
        `Leader ${sender} mengirim pemberitahuan status: ${LEADER_STATUS_LABEL[choice]}`
      )
    );
    setNote('');
    onToast(`Pemberitahuan "${LEADER_STATUS_LABEL[choice]}" dikirim ke Admin & PJT`);
  };

  return (
    <div className="rounded-2xl bg-white border-2 border-amber-300 p-5 shadow-xs space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            Langkah Wajib: Pemberitahuan Status Pekerjaan
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Kirim pemberitahuan ke Admin &amp; PJT sebelum membuat Surat Tugas, JSA, Surat Jalan dan memilih
            anggota tim. Pengujian baru dapat dimulai bila status terakhir <b>Siap Uji</b>.
          </p>
        </div>
        {current && (
          <span
            className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
              current.status === 'siap_uji'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            Status terakhir: {LEADER_STATUS_LABEL[current.status]}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {(Object.keys(LEADER_STATUS_LABEL) as LeaderWorkStatus[]).map((k) => (
          <label
            key={k}
            className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-semibold cursor-pointer ${
              choice === k
                ? 'bg-amber-50 border-amber-500 text-amber-900'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <input
              type="radio"
              name={`leaderStatus-${p.id}`}
              checked={choice === k}
              onChange={() => setChoice(k)}
              className="accent-amber-600"
            />
            {LEADER_STATUS_LABEL[k]}
          </label>
        ))}
      </div>

      <textarea
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={
          choice === 'siap_uji'
            ? 'Catatan (opsional): jadwal uji, kesiapan dokumen & lokasi…'
            : choice === 'kekurangan_dokumen'
            ? 'Sebutkan dokumen yang kurang (mis. izin lingkungan, SLD, dokumen teknik)…'
            : 'Sebutkan nama akun SiUjang & masalahnya (mis. perlu reset)…'
        }
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
      />

      <button
        type="button"
        onClick={send}
        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer"
      >
        <Send className="w-3.5 h-3.5" /> Kirim Pemberitahuan ke Admin &amp; PJT
      </button>
    </div>
  );
}

/** Ringkasan status leader (read-only) untuk PJT / Admin / Direktur. */
export function LeaderStatusSummary({ p }: { p: Project }) {
  if (!p.leaderStatus) {
    return (
      <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-600">
        Leader belum mengirim pemberitahuan status pekerjaan (Siap Uji / Kekurangan Dokumen / Akun SiUjang
        bermasalah).
      </div>
    );
  }
  const s = p.leaderStatus;
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-xs ${
        s.status === 'siap_uji'
          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
          : 'bg-amber-50 border-amber-200 text-amber-900'
      }`}
    >
      <b>Status dari Leader ({s.sentBy}): {LEADER_STATUS_LABEL[s.status]}</b>
      {s.note ? <> — {s.note}</> : null}
      <span className="ml-2 font-mono text-[11px] opacity-70">{formatDateTime(s.sentAt)}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Dokumen persiapan: Leader kirim → PJT review → Direktur TTD     */
/* ------------------------------------------------------------------ */
const PREP_DOCS: SavedDocType[] = ['surat-tugas', 'jsa', 'surat-jalan'];

function docButtons(
  p: Project,
  onOpenDoc: (project: Project, tab: DocTab) => void
) {
  return (
    <div className="flex flex-wrap gap-2">
      {PREP_DOCS.map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onOpenDoc(p, d as DocTab)}
          className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold cursor-pointer"
        >
          Lihat {SAVED_DOC_LABELS[d]}
          {p.docTte?.[d === 'surat-tugas' ? 'suratTugas' : d === 'jsa' ? 'jsa' : 'suratJalan']?.enabled
            ? ' (TTE)'
            : ''}
        </button>
      ))}
    </div>
  );
}

export function PrepSubmitPanel({
  p,
  state,
  activeIns,
  draftIns,
  draftTools,
  onUpdateProject,
  onToast,
  onOpenDoc,
}: BaseProps & {
  draftIns: string[];
  draftTools: string[];
  onOpenDoc: (project: Project, tab: DocTab) => void;
}) {
  const savedFor = (d: SavedDocType) =>
    state.docArchives.some((a) => a.projectId === p.id && a.docType === d);
  const missing = PREP_DOCS.filter((d) => !savedFor(d));
  const rev = p.prepReview;
  const locked = rev?.status === 'submitted' || rev?.status === 'approved';
  const leaderOk = Boolean(p.leaderStatus);

  const submit = () => {
    if (!leaderOk) {
      onToast('Kirim pemberitahuan status pekerjaan terlebih dahulu');
      return;
    }
    if (missing.length) {
      onToast(
        `Simpan PDF dulu di langkah ST, JSA & Surat Jalan: ${missing.map((d) => SAVED_DOC_LABELS[d]).join(', ')}`
      );
      return;
    }
    if (!draftTools.length) {
      onToast('Pilih minimal 1 alat uji untuk Surat Jalan Alat');
      return;
    }
    const members = Array.from(new Set([p.team!.lead, ...draftIns]));
    const stamp = () => createTteStamp(activeIns.nama, 'Leader Tenaga Teknik');
    onUpdateProject(
      appendLog(
        {
          ...p,
          team: { lead: p.team!.lead, ins: members, tools: draftTools },
          docTte: {
            ...(p.docTte || {}),
            suratJalan: stamp(),
            jsa: stamp(),
            sptSpd: stamp(),
          },
          prepReview: {
            status: 'submitted',
            submittedAt: new Date().toISOString(),
            submittedBy: activeIns.nama,
          },
          directorReview: undefined,
        },
        `Leader ${activeIns.nama} mengirim dokumen persiapan SLO ke PJT untuk direview`
      )
    );
    onToast('Dokumen persiapan dikirim ke PJT untuk direview');
  };

  return (
    <div className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-bold text-slate-900">
            Kirim Dokumen Persiapan ke PJT
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Alur: Leader → <b>PJT review</b> → <b>Direktur review, komentar &amp; TTD Surat Tugas</b>.
          </p>
        </div>
        {rev && (
          <span
            className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
              rev.status === 'approved'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : rev.status === 'revision'
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-blue-50 text-blue-700 border-blue-200'
            }`}
          >
            {rev.status === 'approved'
              ? 'Disetujui PJT'
              : rev.status === 'revision'
              ? 'Perlu Revisi'
              : 'Menunggu Review PJT'}
          </span>
        )}
      </div>

      {rev?.status === 'revision' && rev.pjtNote && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-800">
          <b>Catatan revisi{rev.pjtBy ? ` dari ${rev.pjtBy}` : ''}:</b> {rev.pjtNote}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-[11px]">
        {PREP_DOCS.map((d) => (
          <div
            key={d}
            className={`rounded-lg border px-2.5 py-2 ${
              savedFor(d)
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-white border-slate-200 text-slate-600'
            }`}
          >
            <div className="font-bold">{SAVED_DOC_LABELS[d]}</div>
            <div className="mt-0.5">{savedFor(d) ? '✓ Tersimpan' : 'Belum disimpan'}</div>
          </div>
        ))}
      </div>

      {docButtons(p, onOpenDoc)}

      {!locked && (
        <button
          type="button"
          onClick={submit}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
          {rev?.status === 'revision' ? 'Kirim Ulang ke PJT' : 'Kirim ke PJT untuk Direview'}
        </button>
      )}
    </div>
  );
}

export function PjtPrepReviewPanel({
  p,
  session,
  onUpdateProject,
  onToast,
  onOpenDoc,
}: BaseProps & { onOpenDoc: (project: Project, tab: DocTab) => void }) {
  const [note, setNote] = useState('');
  const rev = p.prepReview;
  if (!rev) return null;
  const pjtName = p.pjtName || session.pjtName || session.name;

  return (
    <div className="rounded-2xl bg-white border-2 border-indigo-300 p-5 shadow-xs space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-base font-bold text-slate-900">
          Review Dokumen Persiapan SLO (sebelum ke Direktur)
        </h3>
        <span className="text-[11px] font-mono text-slate-500">
          dikirim {rev.submittedBy} · {formatDateTime(rev.submittedAt)}
        </span>
      </div>
      {docButtons(p, onOpenDoc)}

      {rev.status === 'submitted' ? (
        <>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Catatan PJT (wajib bila meminta revisi)…"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                onUpdateProject(
                  appendLog(
                    {
                      ...p,
                      prepReview: {
                        ...rev,
                        status: 'approved',
                        pjtBy: pjtName,
                        pjtAt: new Date().toISOString(),
                        pjtNote: note.trim(),
                      },
                      directorReview: { status: 'pending', comments: p.directorReview?.comments || [] },
                    },
                    `PJT ${pjtName} menyetujui dokumen persiapan & meneruskan ke Direktur`
                  )
                );
                setNote('');
                onToast('Disetujui — diteruskan ke Direktur untuk review & TTD Surat Tugas');
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
            >
              Setujui &amp; Teruskan ke Direktur
            </button>
            <button
              type="button"
              onClick={() => {
                if (!note.trim()) {
                  onToast('Isi catatan revisi terlebih dahulu');
                  return;
                }
                onUpdateProject(
                  appendLog(
                    {
                      ...p,
                      prepReview: {
                        ...rev,
                        status: 'revision',
                        pjtBy: pjtName,
                        pjtAt: new Date().toISOString(),
                        pjtNote: note.trim(),
                      },
                    },
                    `PJT ${pjtName} mengembalikan dokumen persiapan untuk revisi`
                  )
                );
                setNote('');
                onToast('Dikembalikan ke Leader untuk revisi');
              }}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Kembalikan untuk Revisi
            </button>
          </div>
        </>
      ) : (
        <div
          className={`rounded-xl px-3 py-2 text-xs font-semibold ${
            rev.status === 'approved'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {rev.status === 'approved'
            ? `✓ Disetujui PJT${rev.pjtAt ? ` (${formatDateTime(rev.pjtAt)})` : ''}`
            : `Dikembalikan untuk revisi: ${rev.pjtNote || '-'}`}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Direktur: review, komentar, TTD Surat Tugas                      */
/* ------------------------------------------------------------------ */
export function DirectorReviewPanel({
  p,
  role,
  session,
  onUpdateProject,
  onToast,
  onOpenDoc,
  onApplyTteToEditors,
}: BaseProps & {
  onOpenDoc: (project: Project, tab: DocTab) => void;
  onApplyTteToEditors?: (project: Project, docTte: NonNullable<Project['docTte']>) => void;
}) {
  const [comment, setComment] = useState('');
  const dr: DirectorReview = p.directorReview || { status: 'pending', comments: [] };
  const isDirector = role === 'direktur';
  const canComment = isDirector;
  const waitingDirector =
    p.prepReview?.status === 'approved' && dr.status !== 'signed' && p.directorReview !== undefined;

  const pushComment = (text: string): DirectorReview => {
    const c: ReviewComment = {
      id: `rc-${Date.now()}`,
      by: session.name,
      role,
      text,
      at: new Date().toISOString(),
    };
    return { ...dr, comments: [...dr.comments, c] };
  };

  const addComment = () => {
    const text = comment.trim();
    if (!text) return;
    onUpdateProject(
      appendLog({ ...p, directorReview: pushComment(text) }, `Direktur memberi komentar: "${text}"`)
    );
    setComment('');
    onToast('Komentar tersimpan');
  };

  const signNow = () => {
    const stamp = createTteStamp(session.name, 'Direktur Utama');
    const nowIso = new Date().toISOString();
    const nextDocTte = { ...(p.docTte || {}), suratTugas: stamp };
    const nextStatus = ['rfq', 'offered', 'approved', 'payproof', 'paid'].includes(p.status)
      ? ('scheduled' as const)
      : p.status;
    const updated = appendLog(
      {
        ...p,
        docTte: nextDocTte,
        docs: { ...p.docs, issued: true },
        status: nextStatus,
        workflowStage: 'published_work',
        publishedToWorkMenu: true,
        directorReview: {
          ...dr,
          status: 'signed',
          signedBy: session.name,
          signedAt: nowIso,
        },
      },
      `Direktur ${session.name} menandatangani (TTE) Surat Tugas`
    );
    onUpdateProject(updated);
    onApplyTteToEditors?.(updated, nextDocTte);
    onToast('Surat Tugas berhasil ditandatangani (TTE)');
  };

  const returnForRevision = () => {
    const text = comment.trim();
    if (!text) {
      onToast('Tulis komentar sebagai alasan revisi');
      return;
    }
    const withComment = pushComment(text);
    onUpdateProject(
      appendLog(
        {
          ...p,
          directorReview: { ...withComment, status: 'revision' },
          prepReview: p.prepReview
            ? {
                ...p.prepReview,
                status: 'revision',
                pjtBy: session.name,
                pjtAt: new Date().toISOString(),
                pjtNote: `Direktur: ${text}`,
              }
            : p.prepReview,
        },
        `Direktur mengembalikan dokumen untuk revisi: "${text}"`
      )
    );
    setComment('');
    onToast('Dikembalikan ke Leader untuk revisi');
  };

  return (
    <div className="rounded-2xl bg-white border-2 border-indigo-300 p-5 shadow-xs space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
            <PenLine className="w-4 h-4 text-indigo-600" /> Review, Komentar &amp; TTD Surat Tugas
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Surat Tugas diteruskan oleh PJT setelah dokumen persiapan direview.
          </p>
        </div>
        <span
          className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
            dr.status === 'signed'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : dr.status === 'revision'
              ? 'bg-red-50 text-red-700 border-red-200'
              : waitingDirector
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : 'bg-slate-50 text-slate-600 border-slate-200'
          }`}
        >
          {dr.status === 'signed'
            ? '✓ Surat Tugas Ditandatangani'
            : dr.status === 'revision'
            ? 'Dikembalikan untuk Revisi'
            : waitingDirector
            ? 'Menunggu Direktur'
            : 'Belum diteruskan PJT'}
        </span>
      </div>

      {docButtons(p, onOpenDoc)}

      {dr.comments.length > 0 && (
        <div className="space-y-1.5">
          {dr.comments.map((c) => (
            <div key={c.id} className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-indigo-600" /> {c.by}
                </span>
                <span className="font-mono text-[10px] text-slate-500">{formatDateTime(c.at)}</span>
              </div>
              <p className="text-slate-700 mt-1">{c.text}</p>
            </div>
          ))}
        </div>
      )}

      {canComment && dr.status !== 'signed' && (
        <>
          <textarea
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tulis komentar / catatan review Direktur…"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addComment}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
            >
              Simpan Komentar
            </button>
            {waitingDirector && (
              <>
                <button
                  type="button"
                  onClick={signNow}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5" /> Tanda Tangani Surat Tugas (TTE)
                </button>
                <button
                  type="button"
                  onClick={returnForRevision}
                  className="px-4 py-2 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold cursor-pointer"
                >
                  Kembalikan untuk Revisi
                </button>
              </>
            )}
          </div>
          {!waitingDirector && (
            <p className="text-[11px] text-slate-500">
              Tombol TTD aktif setelah PJT menyetujui &amp; meneruskan dokumen persiapan.
            </p>
          )}
        </>
      )}

      {dr.status === 'signed' && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800 font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Surat Tugas ditandatangani {dr.signedBy}
          {dr.signedAt ? ` · ${formatDateTime(dr.signedAt)}` : ''} (TTE {p.docTte?.suratTugas?.code})
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Laporan pengujian (manual → upload) oleh Leader & Anggota        */
/* ------------------------------------------------------------------ */
export function ReportUploadPanel({
  p,
  role,
  session,
  activeIns,
  onUpdateProject,
  onToast,
  canSubmit,
}: BaseProps & { canSubmit: boolean }) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const frozen = p.status === 'submitted' || p.status === 'approvedPJT' || p.status === 'slo';
  const isLeader = p.team?.lead === activeIns.id;

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
      const id = `rpt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
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
      });
      if (!synced) onToast('Laporan tersimpan di perangkat ini saja — server dokumen tidak terjangkau');
      const rec: TestReportFile = {
        id,
        vaultFileId: id,
        name: file.name,
        size: file.size,
        mimeType,
        title: title.trim() || file.name,
        uploadedAt: nowIso,
        uploadedBy: session.name || activeIns.nama,
        uploadedById: activeIns.id,
      };
      onUpdateProject(
        appendLog(
          { ...p, reports: [...(p.reports || []), rec] },
          `${rec.uploadedBy} mengunggah laporan pengujian: ${rec.title}`
        )
      );
      setTitle('');
      onToast(`Laporan "${rec.title}" berhasil diunggah`);
    } catch (err: unknown) {
      onToast(err instanceof Error ? err.message : 'Gagal mengunggah laporan');
    } finally {
      setBusy(false);
    }
  };

  const submitToPjt = () => {
    if (!(p.reports || []).length) {
      onToast('Unggah minimal 1 laporan pengujian sebelum dikirim ke PJT');
      return;
    }
    onUpdateProject(
      appendLog(
        {
          ...p,
          status: 'submitted',
          form: { ...p.form, submitted: true },
          pjt: null,
          reportReview: { status: 'pending' },
        },
        `Leader ${activeIns.nama} mengirim ${(p.reports || []).length} laporan pengujian ke PJT`
      )
    );
    onToast('Laporan pengujian dikirim ke PJT untuk direview');
  };

  const canEditFiles = !frozen && (role === 'inspektor' || role === 'pjt');

  return (
    <div className={card}>
      <div>
        <h3 className="font-display text-base font-bold text-slate-900">Laporan Pengujian (Upload)</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Laporan dibuat <b>manual</b> lalu diunggah ke sistem. Leader dan seluruh anggota tim dapat
          mengunggah. Laporan wajib ada sebelum dikirim ke PJT dan sebelum SLO dicetak.
        </p>
      </div>

      {p.reportReview?.status === 'revision' && p.reportReview.note && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-800">
          <b>Dikembalikan PJT untuk revisi:</b> {p.reportReview.note}
        </div>
      )}

      <ReportList
        p={p}
        onToast={onToast}
        canDeleteId={(r) => canEditFiles && (r.uploadedById === activeIns.id || isLeader)}
        onDelete={(r) => {
          void deleteVaultFile(r.vaultFileId);
          onUpdateProject(
            appendLog(
              { ...p, reports: (p.reports || []).filter((x) => x.id !== r.id) },
              `Laporan "${r.title}" dihapus`
            )
          );
          onToast('Laporan dihapus');
        }}
      />

      {canEditFiles && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Judul laporan (mis. Laporan Pengujian Tahanan Isolasi)"
            className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs bg-white"
          />
          <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer">
            <Upload className="w-4 h-4" /> {busy ? 'Mengunggah…' : 'Unggah Laporan (PDF / Foto / Word / Excel)'}
            <input
              type="file"
              className="hidden"
              disabled={busy}
              accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
              onChange={(e) => {
                void upload(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
          <p className="text-[11px] text-slate-500">Maks. 5 MB per berkas.</p>
        </div>
      )}

      {canSubmit && isLeader && p.status === 'testing' && (
        <button
          type="button"
          onClick={submitToPjt}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold cursor-pointer"
        >
          <Send className="w-4 h-4" /> Kirim Laporan ke PJT untuk Direview
        </button>
      )}
      {canSubmit && !isLeader && p.status === 'testing' && (
        <p className="text-[11px] text-slate-500">
          Pengiriman ke PJT dilakukan oleh Leader setelah semua laporan anggota terkumpul.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 5. PJT: informasikan SLO sudah terbit / selesai                     */
/* ------------------------------------------------------------------ */
export function SloNoticePanel({ p, role, session, onUpdateProject, onToast }: BaseProps) {
  const [note, setNote] = useState('');
  if (p.sloNotice) {
    return (
      <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-900 flex items-start gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <span>
          <b>PJT {p.sloNotice.by} menginformasikan: SLO sudah terbit / pekerjaan selesai</b> (
          {formatDateTime(p.sloNotice.at)}).{p.sloNotice.note ? ` ${p.sloNotice.note}` : ''}
        </span>
      </div>
    );
  }
  if (p.status === 'approvedPJT') {
    return (
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-xs text-blue-800">
        Laporan sudah disetujui PJT. Menunggu <b>Admin</b> mencetak/menerbitkan SLO. Setelah SLO terbit,
        PJT wajib menginformasikan penyelesaian di sini.
      </div>
    );
  }
  if (p.status !== 'slo') return null;
  if (role !== 'pjt') {
    return (
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-800">
        SLO sudah terbit. Menunggu PJT menginformasikan bahwa pekerjaan selesai.
      </div>
    );
  }
  const pjtName = p.pjtName || session.pjtName || session.name;
  return (
    <div className="rounded-2xl bg-white border-2 border-emerald-300 p-5 shadow-xs space-y-3">
      <h3 className="font-display text-base font-bold text-slate-900">
        Langkah Wajib: Informasikan SLO Terbit / Selesai
      </h3>
      <p className="text-xs text-slate-500">
        SLO {p.slo?.no} sudah diterbitkan. Kirim informasi penyelesaian ke Admin, Marketing, Direktur dan
        tim teknik.
      </p>
      <textarea
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Catatan (opsional)…"
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
      />
      <button
        type="button"
        onClick={() => {
          onUpdateProject(
            appendLog(
              { ...p, sloNotice: { at: new Date().toISOString(), by: pjtName, note: note.trim() } },
              `PJT ${pjtName} menginformasikan SLO ${p.slo?.no || ''} sudah terbit / pekerjaan selesai`
            )
          );
          setNote('');
          onToast('Informasi SLO terbit/selesai dikirim');
        }}
        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
      >
        <Send className="w-3.5 h-3.5" /> Informasikan SLO Terbit / Selesai
      </button>
    </div>
  );
}
