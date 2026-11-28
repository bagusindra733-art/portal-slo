import { useMemo, useState, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  History,
  Users,
  Repeat,
  Search,
  UserCheck,
  X,
} from 'lucide-react';
import { DOC_CONFIG, Inspector, JoSoRecord, Project, UserSession } from '../types/portal';
import {
  FLOW_STEPS,
  certStatus,
  currentFlowIndex,
  formatDateTime,
  getPelanggan,
  inspectorLocked,
  isSamePersonName,
  k3Status,
} from '../utils/portalUtils';

/** Baris Daftar Pekerjaan: satu Sales Order (+ proyek terkait bila sudah dibuat). */
export interface PekerjaanRow {
  key: string;
  no: number;
  poNo: string;
  title: string;
  pelanggan: string;
  /** Teks langkah aktif, mis. "Review Dokumen · PJT". */
  langkah: string;
  /** Pekerjaan menunggu tindakan pengguna yang sedang login. */
  giliran: boolean;
  rec?: JoSoRecord;
  project?: Project;
}

export interface PilihPekerjaanTarget {
  recId?: string;
  projectId?: string;
}

/** Pekerjaan dianggap sudah dipilih bila PJT sudah ditunjuk dan sudah diteruskan (bukan lagi draft/inbox Admin). */
export function pekerjaanSudahDipilih(p?: Project): boolean {
  if (!p || !p.pjtName) return false;
  return Boolean(p.workflowStage && p.workflowStage !== 'draft' && p.workflowStage !== 'sent_to_admin');
}

/** Pekerjaan masih bisa ganti PJT selama Leader belum ditunjuk. */
export function bisaGantiPjt(p?: Project): boolean {
  return Boolean(p && pekerjaanSudahDipilih(p) && p.workflowStage === 'forwarded_to_pjt' && !p.team?.lead);
}

const HARI_MACET = 3;

/** Lama pekerjaan di langkah sekarang, dihitung dari catatan aktivitas terakhir. Null bila selesai/tidak ada catatan. */
export function hariDiLangkah(p?: Project): number | null {
  if (!p || p.sloNotice || p.status === 'slo' || p.log.length === 0) return null;
  const t = new Date(p.log[p.log.length - 1][0]).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

function HariBadge({ hari }: { hari: number }) {
  const macet = hari > HARI_MACET;
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${
        macet ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
      }`}
    >
      {hari === 0 ? 'Hari ini di langkah ini' : `${hari} hari di langkah ini`}
      {macet ? ' · perlu ditindaklanjuti' : ''}
    </span>
  );
}

/** PJT boleh menunjuk/mengganti Leader selama Leader belum mengirim status pekerjaan. */
export function bisaTunjukLeader(p: Project | undefined, pjtName: string): boolean {
  return Boolean(
    p &&
      pekerjaanSudahDipilih(p) &&
      isSamePersonName(p.pjtName, pjtName) &&
      (p.workflowStage === 'forwarded_to_pjt' || p.workflowStage === 'leader_assigned') &&
      !p.leaderStatus
  );
}

/** Ringkas progres instalasi SLO, mis. "2 dari 3 instalasi SLO terbit". Kosong bila belum ada instalasi. */
export function ringkasInstalasi(p?: Project): string {
  const list = p?.instalasi || [];
  if (list.length === 0) return '';
  const terbit = list.filter((i) => i.tahap === 'slo_terbit').length;
  return `${terbit} dari ${list.length} instalasi SLO terbit`;
}

function textLangkah(p?: Project): string {
  if (!p || !pekerjaanSudahDipilih(p)) return 'Belum dipilih Admin';
  const idx = currentFlowIndex(p);
  const base = idx >= FLOW_STEPS.length ? 'Selesai — SLO terbit' : `${FLOW_STEPS[idx].label} · ${FLOW_STEPS[idx].owner}`;
  return base;
}

/** Apakah pekerjaan menunggu tindakan pengguna ini (berdasarkan peran & langkah aktif)? */
export function giliranSaya(p: Project | undefined, role: UserSession['role'], myInspectorId: string, pjtName: string): boolean {
  if (role === 'teknis') return !pekerjaanSudahDipilih(p) || Boolean(p && currentFlowIndex(p) === 9 && p.status === 'approvedPJT');
  if (!p || !pekerjaanSudahDipilih(p)) return false;
  const idx = currentFlowIndex(p);
  if (role === 'pjt') {
    if (!isSamePersonName(p.pjtName, pjtName)) return false;
    return idx === 2 || idx === 5 || idx === 8 || (idx === 9 && p.status === 'slo');
  }
  if (role === 'direktur') return idx === 6;
  if (role === 'inspektor') {
    const leader = p.team?.lead === myInspectorId;
    const member = Boolean(p.team?.ins.includes(myInspectorId));
    if (idx === 3 || idx === 4) return leader;
    if (idx === 7) return leader || member;
  }
  return false;
}

type SortKey = 'no' | 'poNo' | 'title' | 'pelanggan' | 'langkah';
const PAGE_SIZES = [10, 25, 50, 100];

const COLS: { key: SortKey; label: string }[] = [
  { key: 'no', label: 'No' },
  { key: 'poNo', label: 'No PO' },
  { key: 'title', label: 'Title' },
  { key: 'pelanggan', label: 'Pelanggan' },
  { key: 'langkah', label: 'Langkah Sekarang' },
];

interface Props {
  role: UserSession['role'];
  records: JoSoRecord[];
  projects: Project[];
  /** Proyek yang boleh dilihat peran ini (Admin/Marketing/Direktur = semua). */
  visibleProjects: Project[];
  onPilihPekerjaan: (target: PilihPekerjaanTarget, pjtName: string, note: string) => void;
  inspectors: Inspector[];
  /** ID Tenaga Teknik pengguna (untuk penanda giliran). */
  myInspectorId: string;
  /** Nama PJT yang sedang login. */
  pjtName: string;
  onTunjukLeader: (projectId: string, leaderId: string) => void;
  onOpenProject: (projectId: string) => void;
}

export function DaftarPekerjaan({
  role,
  records,
  projects,
  visibleProjects,
  inspectors,
  myInspectorId,
  pjtName,
  onPilihPekerjaan,
  onTunjukLeader,
  onOpenProject,
}: Props) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'no', dir: 'asc' });
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [pilihRow, setPilihRow] = useState<PekerjaanRow | null>(null);
  const [gantiMode, setGantiMode] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);
  const [leaderRow, setLeaderRow] = useState<PekerjaanRow | null>(null);
  const [historyRow, setHistoryRow] = useState<PekerjaanRow | null>(null);

  const canPick = role === 'teknis';
  // PJT & Tenaga Teknik hanya melihat pekerjaan yang sudah diteruskan kepada mereka.
  const restricted = role === 'pjt' || role === 'inspektor';

  const rows = useMemo<PekerjaanRow[]>(() => {
    const visibleIds = new Set(visibleProjects.map((p) => p.id));
    const linked = new Set<string>();
    const out: Omit<PekerjaanRow, 'no'>[] = [];

    for (const rec of records) {
      const project = projects.find((p) => p.id === rec.projectId || p.joSoId === rec.id);
      if (project) linked.add(project.id);
      if (restricted && !(project && visibleIds.has(project.id))) continue;
      out.push({
        key: `so-${rec.id}`,
        poNo: rec.poNo || '-',
        title: rec.title || rec.perihal || '-',
        pelanggan: getPelanggan(rec).nama || '-',
        langkah: textLangkah(project),
        giliran: giliranSaya(project, role, myInspectorId, pjtName),
        rec,
        project,
      });
    }
    // Proyek lama yang belum punya Sales Order tetap tampil.
    for (const p of projects) {
      if (linked.has(p.id)) continue;
      if (restricted && !visibleIds.has(p.id)) continue;
      out.push({
        key: `pr-${p.id}`,
        poNo: p.po?.name || '-',
        title: `${p.sub}${p.kap ? ` ${p.kap}` : ''}`.trim(),
        pelanggan: p.perusahaan,
        langkah: textLangkah(p),
        giliran: giliranSaya(p, role, myInspectorId, pjtName),
        project: p,
      });
    }
    return out.map((r, i) => ({ ...r, no: i + 1 }));
  }, [records, projects, visibleProjects, restricted, role, myInspectorId, pjtName]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = onlyMine ? rows.filter((r) => r.giliran) : rows;
    const list = needle
      ? base.filter((r) => `${r.poNo} ${r.title} ${r.pelanggan} ${r.langkah}`.toLowerCase().includes(needle))
      : base;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      const va = a[sort.key];
      const vb = b[sort.key];
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), 'id', { numeric: true, sensitivity: 'base' }) * dir;
    });
  }, [rows, q, sort, onlyMine]);

  const jumlahGiliran = rows.filter((r) => r.giliran).length;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const cur = Math.min(page, totalPages);
  const start = (cur - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);

  const toggleSort = (key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
    setPage(1);
  };

  return (
    <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="px-5 py-4 bg-violet-50/60 border-b border-slate-200/70 text-sm text-slate-700">
        Daftar Pekerjaan: pilih pekerjaan untuk menentukan Penanggung Jawab Teknik (PJT), lalu pantau prosesnya lewat History.
      </div>
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
          <button
            type="button"
            onClick={() => {
              setOnlyMine((v) => !v);
              setPage(1);
            }}
            aria-pressed={onlyMine}
            className={`inline-flex items-center gap-2 h-8 px-3 rounded-md border text-xs font-bold cursor-pointer ${
              onlyMine ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            Perlu tindakan saya
            <span className={`rounded-full px-1.5 text-[10px] ${onlyMine ? 'bg-white/25' : jumlahGiliran > 0 ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'}`}>
              {jumlahGiliran}
            </span>
          </button>
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
          <table className="w-full text-left border-collapse" style={{ minWidth: 1000 }}>
            <thead>
              <tr className="bg-violet-50/70">
                {COLS.map((c) => {
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
                  <td colSpan={COLS.length + 1} className="px-4 py-10 text-center text-sm text-slate-400">
                    {rows.length === 0 ? 'Belum ada pekerjaan.' : onlyMine ? 'Tidak ada pekerjaan yang menunggu tindakan Anda.' : 'Tidak ada data yang cocok.'}
                  </td>
                </tr>
              ) : (
                pageRows.map((r) => {
                  const dipilih = pekerjaanSudahDipilih(r.project);
                  return (
                    <tr key={r.key} className="border-t border-slate-100 hover:bg-slate-50/70 text-sm text-slate-700">
                      <td className="px-4 py-4 tabular-nums w-14">{r.no}</td>
                      <td className="px-4 py-4 whitespace-nowrap">{r.poNo}</td>
                      <td className="px-4 py-4">
                        {r.title}
                        {!r.rec && r.project && (
                          <span className="mt-1 block text-[11px] text-amber-700">
                            Belum ada Sales Order · Ref {r.project.no}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">{r.pelanggan}</td>
                      <td className="px-4 py-4">
                        <span className="block text-slate-800">{r.langkah}</span>
                        {ringkasInstalasi(r.project) && (
                          <span className="mt-0.5 block text-[11px] text-slate-500">{ringkasInstalasi(r.project)}</span>
                        )}
                        {r.giliran && (
                          <span className="mt-1 inline-block rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">
                            Giliran Anda
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {canPick && (
                            <button
                              type="button"
                              disabled={dipilih}
                              onClick={() => {
                                setGantiMode(false);
                                setPilihRow(r);
                              }}
                              title={dipilih ? `Sudah dipilih — PJT: ${r.project?.pjtName}` : 'Pilih pekerjaan & tentukan PJT'}
                              className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-purple-400 text-white text-xs font-bold shadow-sm shadow-violet-500/30 cursor-pointer disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-500 disabled:shadow-none disabled:cursor-not-allowed"
                            >
                              {dipilih ? <CheckCircle2 className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                              {dipilih ? 'Sudah Dipilih' : 'Pilih Pekerjaan'}
                            </button>
                          )}
                          {canPick && bisaGantiPjt(r.project) && (
                            <button
                              type="button"
                              onClick={() => {
                                setGantiMode(true);
                                setPilihRow(r);
                              }}
                              title="Ganti PJT (bisa selama Leader belum ditunjuk)"
                              className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-violet-200 bg-white text-violet-700 text-xs font-bold hover:bg-violet-50 cursor-pointer"
                            >
                              <Repeat className="w-3.5 h-3.5" /> Ganti PJT
                            </button>
                          )}
                          {role === 'pjt' && bisaTunjukLeader(r.project, pjtName) && (
                            <button
                              type="button"
                              onClick={() => setLeaderRow(r)}
                              className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-400 text-white text-xs font-bold shadow-sm shadow-emerald-500/30 cursor-pointer"
                            >
                              <Users className="w-3.5 h-3.5" /> {r.project?.team?.lead ? 'Ganti Leader' : 'Tunjuk Leader'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => (r.project ? onOpenProject(r.project.id) : setHistoryRow(r))}
                            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-sky-400 text-white text-xs font-bold shadow-sm shadow-cyan-500/30 cursor-pointer"
                          >
                            <History className="w-3.5 h-3.5" /> History
                          </button>
                        </div>
                        {dipilih ? (
                          <div className="mt-1.5 space-y-1">
                            <p className="text-[11px] text-slate-500">
                              PJT: <b className="text-slate-700">{r.project?.pjtName}</b>
                              {!bisaGantiPjt(r.project) && ' · PJT dikunci (Leader sudah ditunjuk)'}
                            </p>
                            {r.project?.team?.lead && (
                              <p className="text-[11px] text-slate-500">
                                Leader: <b className="text-slate-700">{inspectors.find((i) => i.id === r.project?.team?.lead)?.nama || '-'}</b>
                              </p>
                            )}
                            {hariDiLangkah(r.project) !== null && <HariBadge hari={hariDiLangkah(r.project)!} />}
                          </div>
                        ) : (
                          !canPick && <p className="mt-1.5 text-[11px] text-slate-400">Menunggu Admin memilih pekerjaan</p>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <span>
            {filtered.length === 0
              ? 'Menampilkan 0 data'
              : `Menampilkan ${start + 1}–${start + pageRows.length} dari ${filtered.length} data`}
          </span>
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
            <span className="px-3 h-8 rounded-md bg-violet-500 text-white font-bold flex items-center">{cur}</span>
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

      {pilihRow && (
        <PilihPjtModal
          row={pilihRow}
          ganti={gantiMode}
          onClose={() => setPilihRow(null)}
          onConfirm={(pjt, note) => {
            onPilihPekerjaan({ recId: pilihRow.rec?.id, projectId: pilihRow.project?.id }, pjt, note);
            setPilihRow(null);
          }}
        />
      )}

      {leaderRow?.project && (
        <TunjukLeaderModal
          row={leaderRow}
          inspectors={inspectors.filter((i) => !isSamePersonName(i.nama, leaderRow.project?.pjtName))}
          onClose={() => setLeaderRow(null)}
          onConfirm={(id) => {
            onTunjukLeader(leaderRow.project!.id, id);
            setLeaderRow(null);
          }}
        />
      )}

      {historyRow && (
        <HistoryModal
          // Ambil data terbaru dari state (proyek bisa berubah saat modal terbuka)
          row={{
            ...historyRow,
            project:
              projects.find((p) => p.id === historyRow.project?.id || (historyRow.rec && p.joSoId === historyRow.rec.id)) ??
              historyRow.project,
          }}
          onClose={() => setHistoryRow(null)}
                  />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modal: Pilih Penanggung Jawab Teknik                                 */
/* ------------------------------------------------------------------ */

function ModalShell({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  return (
    <div
      className="no-print fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-display text-lg font-extrabold text-slate-900">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function PilihPjtModal({
  row,
  ganti,
  onClose,
  onConfirm,
}: {
  row: PekerjaanRow;
  ganti: boolean;
  onClose: () => void;
  onConfirm: (pjt: string, note: string) => void;
}) {
  const [pjt, setPjt] = useState('');
  const [note, setNote] = useState(ganti ? row.project?.adminForwardNote || '' : '');
  const lama = ganti ? row.project?.pjtName : undefined;

  return (
    <ModalShell title={ganti ? 'Ganti Penanggung Jawab Teknik' : 'Pilih Penanggung Jawab Teknik'} subtitle={`${row.poNo} · ${row.title} · ${row.pelanggan}`} onClose={onClose}>
      <div className="space-y-4">
        {lama && (
          <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
            PJT saat ini: <b>{lama}</b>. Pekerjaan akan berpindah ke PJT yang baru.
          </p>
        )}
        <fieldset className="space-y-2">
          <legend className="text-xs font-bold text-slate-700 mb-1">Penanggung Jawab Teknik (PJT)</legend>
          {DOC_CONFIG.pjt.filter((name) => name !== lama).map((name) => (
            <label
              key={name}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm cursor-pointer ${
                pjt === name ? 'border-violet-400 bg-violet-50 text-violet-900 font-semibold' : 'border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <input type="radio" name="pjt" value={name} checked={pjt === name} onChange={() => setPjt(name)} className="accent-violet-600" />
              {name}
            </label>
          ))}
        </fieldset>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Catatan untuk PJT (opsional)</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Contoh: Mohon PJT menunjuk Leader Tenaga Teknik"
            className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          />
        </div>
        <p className="text-[11px] text-slate-500">
          {ganti
            ? 'PJT hanya bisa diganti selama Leader belum ditunjuk. Setelah Leader ditunjuk, PJT dikunci.'
            : 'Setelah dipilih, tombol Pilih Pekerjaan dikunci dan pekerjaan diteruskan ke PJT untuk menunjuk Leader Tenaga Teknik.'}
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 h-10 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
            Batal
          </button>
          <button
            type="button"
            disabled={!pjt}
            onClick={() => onConfirm(pjt, note.trim())}
            className="px-4 h-10 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {ganti ? 'Ganti PJT' : 'Pilih & Teruskan'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function TunjukLeaderModal({
  row,
  inspectors,
  onClose,
  onConfirm,
}: {
  row: PekerjaanRow;
  inspectors: Inspector[];
  onClose: () => void;
  onConfirm: (leaderId: string) => void;
}) {
  const [pick, setPick] = useState(row.project?.team?.lead || '');
  return (
    <ModalShell title="Tunjuk Leader Tenaga Teknik" subtitle={`${row.poNo} · ${row.title} · ${row.pelanggan}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-[11px] text-slate-500">
          Nama PJT otomatis tidak bisa dipilih sebagai Leader. Personel dengan sertifikat/K3 kedaluwarsa tidak dapat dipilih.
        </p>
        <div className="space-y-2">
          {inspectors.map((ins) => {
            const lock = inspectorLocked(ins);
            const a = certStatus(ins.serkom);
            const b = k3Status(ins);
            return (
              <label
                key={ins.id}
                className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
                  lock
                    ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
                    : pick === ins.id
                    ? 'border-emerald-400 bg-emerald-50 cursor-pointer'
                    : 'border-slate-200 hover:bg-slate-50 cursor-pointer'
                }`}
              >
                <span className="flex items-center gap-3">
                  <input type="radio" name="leader" disabled={lock} checked={pick === ins.id} onChange={() => setPick(ins.id)} className="accent-emerald-600" />
                  <span>
                    <span className="block font-semibold text-slate-800">{ins.nama}</span>
                    <span className="block font-mono text-[10px] text-slate-500">{ins.noReg}</span>
                  </span>
                </span>
                <span className="text-[10px] font-semibold text-slate-600 text-right">
                  SKTTK: {a.t}
                  <br />K3: {b ? b.t : 'Tidak ada'}
                </span>
              </label>
            );
          })}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 h-10 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
            Batal
          </button>
          <button
            type="button"
            disabled={!pick}
            onClick={() => onConfirm(pick)}
            className="px-4 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Tugaskan Leader
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ------------------------------------------------------------------ */
/* Modal: History proses pekerjaan                                      */
/* ------------------------------------------------------------------ */

function HistoryModal({
  row,
  onClose,
}: {
  row: PekerjaanRow;
  onClose: () => void;
}) {
  const p = row.project;
  const idx = p ? currentFlowIndex(p) : 0;
  const selesai = idx >= FLOW_STEPS.length;
  const logs = p ? [...p.log].reverse() : [];

  return (
    <ModalShell title="History Pekerjaan" subtitle={`${row.poNo} · ${row.title} · ${row.pelanggan}`} onClose={onClose}>
      <div className="space-y-5">
        <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-700">
          {!p ? (
            <>Pekerjaan belum dipilih. Admin perlu menekan <b>Pilih Pekerjaan</b> dan menentukan PJT.</>
          ) : selesai ? (
            <b className="text-emerald-700">Pekerjaan selesai — SLO sudah terbit.</b>
          ) : (
            <>
              Posisi saat ini: <b className="text-violet-700">{FLOW_STEPS[idx].label}</b> (oleh {FLOW_STEPS[idx].owner}) · Langkah{' '}
              {idx + 1} dari {FLOW_STEPS.length}
              {p.pjtName && (
                <>
                  {' '}· PJT: <b>{p.pjtName}</b>
                </>
              )}
            </>
          )}
        </div>

        {hariDiLangkah(p) !== null && (
          <div>
            <HariBadge hari={hariDiLangkah(p)!} />
          </div>
        )}

        <ol className="space-y-0">
          {FLOW_STEPS.map((s, i) => {
            const done = p ? i < idx : false;
            const active = p ? i === idx && !selesai : i === 0;
            return (
              <li key={s.key} className="flex gap-3">
                <div className="flex flex-col items-center">
                  {done ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  ) : (
                    <Circle className={`w-5 h-5 shrink-0 ${active ? 'text-violet-500 fill-violet-100' : 'text-slate-300'}`} />
                  )}
                  {i < FLOW_STEPS.length - 1 && <span className={`w-px flex-1 min-h-4 ${done ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
                </div>
                <div className="pb-3 -mt-0.5">
                  <p className={`text-sm ${active ? 'font-bold text-violet-800' : done ? 'font-semibold text-slate-800' : 'text-slate-400'}`}>
                    {s.label}
                    {active && <span className="ml-2 text-[10px] font-bold uppercase bg-violet-100 text-violet-700 rounded px-1.5 py-0.5">Sedang berjalan</span>}
                  </p>
                  <p className="text-[11px] text-slate-400">{s.owner}</p>
                </div>
              </li>
            );
          })}
        </ol>

        {logs.length > 0 && (
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2">Catatan Aktivitas</h4>
            <ul className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {logs.map(([at, msg], i) => (
                <li key={`${at}-${i}`} className="text-xs text-slate-700 border-l-2 border-violet-200 pl-3">
                  <span className="block text-[10px] text-slate-400">{formatDateTime(at)}</span>
                  {msg}
                </li>
              ))}
            </ul>
          </div>
        )}

      </div>
    </ModalShell>
  );
}

export default DaftarPekerjaan;
