import { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  Plus,
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
  ProjectInstalasi,
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
  legacyReports,
  normAgenda,
  reportsOfInstalasi,
  SAVED_DOC_LABELS,
  usesInstalasiFlow,
} from '../utils/portalUtils';
import {
  blobToDataUrl,
  deleteVaultFile,
  getVaultFile,
  putVaultFile,
  triggerDataUrlDownload,
} from '../utils/fileVault';
import type { DocTab } from './DocEditorSuite';

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
  isStepClickable,
}: {
  p: Project;
  /** Langkah yang sedang dibuka pengguna (disorot, mis. editor ST/JSA/Surat Jalan). */
  focusKey?: FlowStepKey;
  /** Bila diisi, kotak langkah dapat diklik (mis. membuka editor dokumen). */
  onStepClick?: (key: FlowStepKey) => void;
  /** Bila diisi, hanya langkah yang lolos filter ini yang dapat diklik (sesuai hak akses peran). */
  isStepClickable?: (key: FlowStepKey) => boolean;
}) {
  const idx = currentFlowIndex(p);
  return (
    <div className="rounded-2xl bg-white border border-slate-200/80 p-4 shadow-xs">
      <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
        Alur Pekerjaan SLO
      </div>
      <ol className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {FLOW_STEPS.map((s, i) => {
          const done = i < idx;
          const active = i === idx;
          const focused = focusKey === s.key;
          const clickable = Boolean(onStepClick) && (isStepClickable ? isStepClickable(s.key) : true);
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
              className={`rounded-xl border px-2.5 py-2 text-xs leading-tight ${
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
  reports: reportsOverride,
  canDeleteId,
  onDelete,
  onToast,
}: {
  p: Project;
  /** Daftar khusus (mis. laporan satu instalasi). Kosong = semua laporan proyek. */
  reports?: TestReportFile[];
  canDeleteId?: (r: TestReportFile) => boolean;
  onDelete?: (r: TestReportFile) => void;
  onToast: (msg: string) => void;
}) {
  const reports = reportsOverride ?? p.reports ?? [];
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
            <div className="text-xs text-slate-500 mt-0.5">
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
export function LeaderStatusPanel({
  p,
  session,
  activeIns,
  onUpdateProject,
  onToast,
  onDone,
}: BaseProps & { onDone?: () => void }) {
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
    onToast(
      choice === 'siap_uji'
        ? 'Status "Siap Uji" dikirim ke Admin & PJT. Surat Tugas, JSA & Surat Jalan Alat kini dapat dibuat.'
        : `Pemberitahuan "${LEADER_STATUS_LABEL[choice]}" dikirim ke Admin & PJT. Surat Tugas baru dapat dibuat setelah status "Siap Uji" dikirim.`
    );
    if (choice === 'siap_uji') onDone?.();
  };

  return (
    <div
      id={`panel-status-pekerjaan-${p.id}`}
      className="rounded-2xl bg-white border-2 border-amber-300 p-5 shadow-xs space-y-3 scroll-mt-24"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            Langkah Wajib: Pemberitahuan Status Pekerjaan
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Kirim pemberitahuan ke Admin &amp; PJT sebelum membuat Surat Tugas, JSA, Surat Jalan dan memilih
            anggota tim. Surat Tugas hanya dapat dibuat bila status yang dikirim <b>Siap Uji</b>.
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

      {current && current.status !== 'siap_uji' && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-xs text-amber-900">
          <b>Surat Tugas belum dapat dibuat.</b> Status terakhir &quot;{LEADER_STATUS_LABEL[current.status]}&quot;.
          Selesaikan kendalanya, lalu kirim pemberitahuan status <b>Siap Uji</b>.
        </div>
      )}

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
      <span className="ml-2 font-mono text-xs opacity-70">{formatDateTime(s.sentAt)}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Dokumen persiapan: Leader kirim → PJT review → Direktur TTD     */
/* ------------------------------------------------------------------ */
const PREP_DOCS: SavedDocType[] = ['surat-tugas', 'surat-jalan', 'jsa'];

const WIZARD_STEPS: { doc: SavedDocType; title: string; short: string }[] = [
  { doc: 'surat-tugas', title: 'Buat Surat Tugas', short: 'Surat Tugas' },
  { doc: 'surat-jalan', title: 'Buat Surat Jalan Alat', short: 'Surat Jalan' },
  { doc: 'jsa', title: 'Buat JSA', short: 'JSA' },
];

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
          {d === 'surat-tugas' && p.docTte?.suratTugas?.enabled ? ' (TTE)' : ''}
        </button>
      ))}
    </div>
  );
}

export function PrepSubmitPanel({
  p,
  state,
  activeIns,
  onUpdateProject,
  onToast,
  onOpenDoc,
}: BaseProps & {
  onOpenDoc: (project: Project, tab: DocTab) => void;
}) {
  const savedFor = (d: SavedDocType) =>
    state.docArchives.some((a) => a.projectId === p.id && a.docType === d);
  const missing = WIZARD_STEPS.filter((st) => !savedFor(st.doc));
  const rev = p.prepReview;
  const locked = rev?.status === 'submitted' || rev?.status === 'approved';

  const submit = () => {
    if (missing.length) {
      onToast(`Belum bisa dikirim. Buat dulu: ${missing.map((m) => m.title.replace('Buat ', '')).join(', ')} — klik tombolnya di atas, isi, lalu Simpan.`);
      return;
    }
    onUpdateProject(
      appendLog(
        {
          ...p,
          prepReview: {
            status: 'approved',
            submittedAt: new Date().toISOString(),
            submittedBy: activeIns.nama,
          },
          directorReview: { status: 'pending', comments: p.directorReview?.comments || [] },
        },
        `${p.team?.lead === activeIns.id ? 'Leader' : 'Anggota tim'} ${activeIns.nama} mengirim Surat Tugas, Surat Jalan Alat & JSA ke Direktur untuk review & TTD`
      )
    );
    onToast('Surat Tugas, Surat Jalan Alat & JSA dikirim ke Direktur untuk review & TTD');
  };

  return (
    <div className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-violet-100 text-violet-800 text-xs font-bold uppercase tracking-wider">
            Leader &amp; Tim Tenaga Teknik
          </span>
          <h3 className="font-display text-base font-bold text-slate-900 mt-1">Buat Surat Tugas</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Alur: <b>Surat Tugas</b> → <b>Surat Jalan Alat</b> → <b>JSA</b> → kirim ke <b>Direktur</b> (review &amp; TTD) →
            diteruskan ke <b>Admin</b> untuk input Layanan SLO. Anggota tim dipilih di Surat Tugas, alat uji dipilih di
            Surat Jalan Alat.
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
            {rev.status === 'revision' ? 'Perlu Revisi' : 'Terkirim ke Direktur'}
          </span>
        )}
      </div>

      {rev?.status === 'revision' && rev.pjtNote && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-800">
          <b>Catatan revisi{rev.pjtBy ? ` dari ${rev.pjtBy}` : ''}:</b> {rev.pjtNote}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {WIZARD_STEPS.map((st, idx) => {
          const saved = savedFor(st.doc);
          const prevSaved = idx === 0 || savedFor(WIZARD_STEPS[idx - 1].doc);
          const disabled = !locked && !prevSaved;
          return (
            <div
              key={st.doc}
              className={`rounded-xl border p-3 space-y-2 ${
                saved ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center ${
                    saved ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {saved ? '✓' : idx + 1}
                </span>
                <span className="text-xs font-bold text-slate-900">{st.title.replace('Buat ', '')}</span>
              </div>
              <div className="text-xs text-slate-600">{saved ? 'Tersimpan' : 'Belum dibuat'}</div>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onOpenDoc(p, st.doc as DocTab)}
                className="w-full px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold cursor-pointer"
              >
                {locked ? `Lihat ${st.short}` : saved ? `Ubah ${st.short}` : st.title}
              </button>
            </div>
          );
        })}
      </div>
      {!locked && (
        <p className="text-xs text-slate-500">
          Setelah Surat Tugas dibuat pilih <b>Simpan &amp; Lanjutkan ke Surat Jalan Alat</b>; setelah Surat
          Jalan Alat pilih <b>Simpan &amp; Lanjutkan ke JSA</b>; lalu kembali ke sini untuk mengirim ke Direktur.
        </p>
      )}

      {!locked && (
        <button
          type="button"
          disabled={missing.length > 0}
          onClick={submit}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
          {rev?.status === 'revision' ? 'Kirim Ulang ke Direktur' : 'Kirim ke Direktur'}
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
          Review Surat Tugas, Surat Jalan Alat &amp; JSA
        </h3>
        <span className="text-xs font-mono text-slate-500">
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
                    `PJT ${pjtName} mereview Surat Tugas, Surat Jalan Alat & JSA dan meneruskan ke Direktur untuk TTD`
                  )
                );
                setNote('');
                onToast('Diteruskan ke Direktur untuk review & TTD Surat Tugas');
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
            >
              Teruskan ke Direktur (untuk di-TTD)
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
            ? `✓ Direview & diteruskan ke Direktur${rev.pjtAt ? ` (${formatDateTime(rev.pjtAt)})` : ''}`
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
        // Alur baru hanya untuk proyek yang Surat Tugasnya di-TTD setelah update ini.
        flowVersion: 2,
        // Setelah TTD otomatis diteruskan ke Admin untuk input Layanan SLO.
        workflowStage: 'published_work',
        publishedToWorkMenu: true,
        directorReview: {
          ...dr,
          status: 'signed',
          signedBy: session.name,
          signedAt: nowIso,
        },
      },
      `Direktur ${session.name} menandatangani (TTE) Surat Tugas dan meneruskan ke Admin untuk input Layanan SLO`
    );
    onUpdateProject(updated);
    onApplyTteToEditors?.(updated, nextDocTte);
    onToast('Surat Tugas berhasil ditandatangani (TTE) — diteruskan ke Admin untuk input Layanan SLO');
  };

  const returnForRevision = () => {
    const text = comment.trim();
    if (!text) {
      onToast('Tulis alasan revisi di kolom komentar, lalu klik Kembalikan untuk Revisi lagi.');
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
            Surat Tugas, Surat Jalan Alat & JSA dikirim langsung oleh Leader untuk direview & di-TTD.
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
            : 'Belum dikirim Leader'}
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
                <span className="font-mono text-xs text-slate-500">{formatDateTime(c.at)}</span>
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
            <p className="text-xs text-slate-500">
              Tombol TTD aktif setelah Leader mengirim dokumen persiapan.
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

      {dr.status === 'signed' && (
        <div className="rounded-xl bg-violet-50 border border-violet-200 px-3 py-2 text-xs text-violet-900 font-semibold">
          ✓ Sudah diteruskan ke Admin untuk input Layanan SLO (Verifikasi LIT) &amp; No. Agenda DJK.
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

  // Alur baru: laporan diunggah per instalasi di Layanan SLO → Pengerjaan TT.
  if (usesInstalasiFlow(p)) {
    const list = p.instalasi ?? [];
    return (
      <div className={card}>
        <div>
          <h3 className="font-display text-base font-bold text-slate-900">Laporan Pengujian</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Laporan kini diunggah <b>per instalasi</b> di menu <b>Layanan SLO → Pengerjaan TT</b>, lalu
            diteruskan ke PJT dari sana.
          </p>
        </div>
        {list.map((i) => (
          <div key={i.id} className="space-y-1.5">
            <div className="text-xs font-bold text-slate-800">{i.nama || '(tanpa nama)'}</div>
            <ReportList p={p} reports={reportsOfInstalasi(p, i.id)} onToast={onToast} />
          </div>
        ))}
        {legacyReports(p).length > 0 && (
          <div className="space-y-1.5">
            <div className="text-xs font-bold text-slate-800">Laporan lama (tingkat proyek)</div>
            <ReportList p={p} reports={legacyReports(p)} onToast={onToast} />
          </div>
        )}
      </div>
    );
  }

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
        folder: 'laporan',
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
          <p className="text-xs text-slate-500">Maks. 5 MB per berkas.</p>
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
        <p className="text-xs text-slate-500">
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
  if (p.sloNotice?.auto) {
    return (
      <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-900 flex items-start gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <span>
          <b>Proyek selesai otomatis: semua instalasi sudah SLO Terbit</b> ({formatDateTime(p.sloNotice.at)}).
          Tidak perlu konfirmasi manual dari PJT.
        </span>
      </div>
    );
  }
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


/* ------------------------------------------------------------------ */
/* Instalasi & No. Agenda DJK (kunci penghubung ke Layanan SLO)        */
/* ------------------------------------------------------------------ */

const INSTALASI_EDITORS: Role[] = ['teknis'];

export function InstalasiDjkPanel({ p, role, state, onUpdateProject, onToast }: Pick<BaseProps, 'p' | 'role' | 'state' | 'onUpdateProject' | 'onToast'>) {
  const canEdit = INSTALASI_EDITORS.includes(role);
  const saved = p.instalasi ?? [];
  const [rows, setRows] = useState<ProjectInstalasi[]>(saved);
  const [open, setOpen] = useState(false);

  const dirty = JSON.stringify(rows) !== JSON.stringify(saved);

  const update = (id: string, patch: Partial<ProjectInstalasi>) =>
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const addRow = () =>
    setRows((r) => [...r, { id: `ins-${Date.now()}-${r.length}`, nama: '', noAgenda: '' }]);

  const save = () => {
    const cleaned = rows
      .map((r) => ({ ...r, nama: r.nama.trim(), noAgenda: r.noAgenda.trim() }))
      .filter((r) => r.nama || r.noAgenda);
    const keys = cleaned.map((r) => normAgenda(r.noAgenda)).filter(Boolean);
    const dupInside = keys.find((k, i) => keys.indexOf(k) !== i);
    if (dupInside) {
      onToast('No. Agenda DJK ganda dalam proyek ini — satu instalasi harus punya nomor sendiri');
      return;
    }
    const used = new Map<string, string>();
    for (const other of state.proj) {
      if (other.id === p.id) continue;
      for (const ins of other.instalasi ?? []) {
        if (ins.noAgenda) used.set(normAgenda(ins.noAgenda), other.perusahaan);
      }
    }
    const clash = keys.find((k) => used.has(k));
    if (clash) {
      onToast(`No. Agenda ${clash} sudah dipakai proyek ${used.get(clash)}`);
      return;
    }
    onUpdateProject(
      appendLog({ ...p, instalasi: cleaned }, `Instalasi & No. Agenda DJK diperbarui (${cleaned.length} instalasi)`)
    );
    setRows(cleaned);
    onToast('Instalasi & No. Agenda DJK tersimpan');
  };

  const missing = saved.filter((r) => !r.noAgenda).length;

  return (
    <div className="rounded-2xl bg-white border border-slate-200/80 p-4 shadow-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 text-left cursor-pointer"
      >
        <span>
          <span className="block text-xs font-bold uppercase tracking-wider text-slate-500">
            Instalasi &amp; No. Agenda DJK
          </span>
          <span className="block text-xs text-slate-500 mt-0.5">
            {saved.length === 0
              ? 'Belum diisi — Admin mengisinya saat menginput ke DJK (Layanan SLO → Verifikasi LIT)'
              : `${saved.length} instalasi${missing ? ` · ${missing} belum ada No. Agenda` : ' · lengkap'}`}
          </span>
        </span>
        <span className="text-xs font-semibold text-blue-700">{open ? 'Tutup' : canEdit ? 'Isi / Ubah' : 'Lihat'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          {rows.length === 0 && <p className="text-xs text-slate-500">Belum ada instalasi.</p>}
          {rows.map((r, i) => (
            <div key={r.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] items-end">
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Nama Instalasi #{i + 1}</span>
                <input
                  value={r.nama}
                  disabled={!canEdit}
                  onChange={(e) => update(r.id, { nama: e.target.value })}
                  placeholder="mis. GITET 500kV Depok - Bay Line 1"
                  className="mt-1 w-full h-10 rounded-xl border border-slate-200 px-3 text-sm disabled:bg-slate-50"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">No. Agenda DJK</span>
                <input
                  value={r.noAgenda}
                  disabled={!canEdit}
                  onChange={(e) => update(r.id, { noAgenda: e.target.value })}
                  placeholder="mis. 00091.30-09-2021.2"
                  className="mt-1 w-full h-10 rounded-xl border border-slate-200 px-3 text-sm font-mono disabled:bg-slate-50"
                />
              </label>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setRows((x) => x.filter((y) => y.id !== r.id))}
                  title="Hapus instalasi"
                  className="h-10 w-10 rounded-xl border border-slate-200 text-slate-500 hover:text-red-600 hover:bg-red-50 flex items-center justify-center cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          {canEdit && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={addRow}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Instalasi
              </button>
              <button
                type="button"
                disabled={!dirty}
                onClick={save}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-gradient-to-br from-[#2563EB] to-[#3B82F6] text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Simpan
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
