import { Suspense, useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  UserCheck,
  Wrench,
  ClipboardCheck,
  FileSearch,
  CalendarPlus,
  CalendarClock,
  CalendarRange,
  CalendarCheck,
  FileCog,
  Printer,
  BadgeCheck,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import { lazyRetry } from '../utils/lazyRetry';
import type { DjkPosisi, Inspector, InstalasiTahap, Project, Role } from '../types/portal';
import { buildInstalasiRows, normAgenda, type InstalasiRow } from '../utils/portalUtils';
import { getSloTerbit, getDjkPosisi } from '../services/sloTerbitApi';
import { LayananTahapList } from './LayananTahapList';

const SloTerbit = lazyRetry(() => import('./SloTerbit'), 'SloTerbit');

type Sel = { tahap: InstalasiTahap; posisi?: DjkPosisi };
type Layanan = { id: string; label: string; sub?: string; icon: LucideIcon; sel?: Sel };

const GROUPS: { title: string; subtitle: string; accent: string; items: Layanan[] }[] = [
  {
    title: 'Pemeriksaan dan Pengujian',
    subtitle: 'Input ke DJK, pengerjaan laporan oleh Tenaga Teknik, pengesahan PJT & evaluasi LIT',
    accent: 'from-[#2563EB] to-[#3B82F6]',
    items: [
      { id: 'verifikasi-lit', label: 'Verifikasi LIT', icon: UserCheck, sel: { tahap: 'verifikasi_lit' } },
      { id: 'pengerjaan-tt', label: 'Pengerjaan TT', icon: Wrench, sel: { tahap: 'pengerjaan_tt' } },
      { id: 'pengesahan-pjt', label: 'Pengesahan PJT', icon: ClipboardCheck, sel: { tahap: 'pengesahan_pjt' } },
      { id: 'evaluasi-lit', label: 'Evaluasi LIT', icon: FileSearch, sel: { tahap: 'evaluasi_lit' } },
    ],
  },
  {
    title: 'Registrasi SLO',
    subtitle: 'Menunggu proses evaluasi DJK',
    accent: 'from-[#6366F1] to-[#4F46E5]',
    items: [
      { id: 'djk-prepare', label: 'Evaluasi DJK', sub: 'Prepare', icon: CalendarPlus, sel: { tahap: 'evaluasi_djk', posisi: 'prepare' } },
      { id: 'djk-review-1', label: 'Evaluasi DJK', sub: 'Review 1', icon: CalendarClock, sel: { tahap: 'evaluasi_djk', posisi: 'review1' } },
      { id: 'djk-review-2', label: 'Evaluasi DJK', sub: 'Review 2', icon: CalendarRange, sel: { tahap: 'evaluasi_djk', posisi: 'review2' } },
      { id: 'djk-approve', label: 'Evaluasi DJK', sub: 'Approve', icon: CalendarCheck, sel: { tahap: 'evaluasi_djk', posisi: 'approve' } },
    ],
  },
  {
    title: 'Penerbitan SLO',
    subtitle: 'Pembuatan, pencetakan & daftar SLO terbit',
    accent: 'from-[#0284C7] to-[#38BDF8]',
    items: [
      { id: 'generate-slo', label: 'Generate SLO', icon: FileCog, sel: { tahap: 'generate_slo' } },
      { id: 'cetak-slo', label: 'Cetak SLO', icon: Printer, sel: { tahap: 'cetak_slo' } },
      { id: 'slo-terbit', label: 'SLO Terbit', icon: BadgeCheck },
    ],
  },
];

/** Menu Layanan SLO — tahap permohonan berjalan per instalasi (kunci: No. Agenda DJK). */
export function LayananSlo({
  projects,
  role,
  inspectorId,
  userName,
  inspectors,
  onUpdateProject,
  onOpenProject,
  onToast,
}: {
  /** Proyek yang boleh dilihat peran yang sedang login. */
  projects: Project[];
  role: Role;
  /** ID Tenaga Teknik milik pengguna (bila ada). */
  inspectorId: string;
  /** Nama pengguna yang sedang login (tercatat sebagai pengunggah laporan). */
  userName: string;
  inspectors: Inspector[];
  onUpdateProject: (p: Project) => void;
  onOpenProject: (projectId: string) => void;
  onToast: (msg: string) => void;
}) {
  const [showTerbit, setShowTerbit] = useState(false);
  const [sel, setSel] = useState<Sel | null>(null);
  const [terbit, setTerbit] = useState<{ set: Set<string>; noSlo: Record<string, string>; total: number }>({
    set: new Set(),
    noSlo: {},
    total: 0,
  });
  const [posisiExcel, setPosisiExcel] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    getSloTerbit()
      .then((rows) => {
        if (!alive) return;
        const set = new Set<string>();
        const noSlo: Record<string, string> = {};
        for (const r of rows) {
          const k = normAgenda(r.noAgenda);
          set.add(k);
          noSlo[k] = r.noSlo;
        }
        setTerbit({ set, noSlo, total: rows.length });
      })
      .catch(() => {});
    getDjkPosisi()
      .then((m) => alive && setPosisiExcel(m))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const rows = useMemo(() => {
    const all = buildInstalasiRows(projects, { terbit: terbit.set, posisiExcel });
    if (role !== 'inspektor') return all;
    // Tenaga Teknik hanya melihat instalasi yang ditugaskan kepadanya (daftar SiUjang);
    // bila instalasi belum punya daftar sendiri, ikut tim proyek.
    return all.filter((r) =>
      r.ins.teamIds?.length
        ? r.ins.teamIds.includes(inspectorId)
        : Boolean(r.p.team && (r.p.team.lead === inspectorId || r.p.team.ins.includes(inspectorId)))
    );
  }, [projects, terbit.set, posisiExcel, role, inspectorId]);

  const countOf = (s: Sel) =>
    rows.filter((r: InstalasiRow) => r.tahap === s.tahap && (!s.posisi || r.posisi === s.posisi)).length;

  const back = (label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
    >
      <ArrowLeft className="w-3.5 h-3.5" /> {label}
    </button>
  );

  if (showTerbit) {
    return (
      <div className="space-y-4">
        {back('Kembali ke Layanan SLO', () => setShowTerbit(false))}
        <h2 className="font-display font-extrabold text-lg text-slate-900 tracking-tight">SLO Terbit</h2>
        <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Memuat…</div>}>
          <SloTerbit />
        </Suspense>
      </div>
    );
  }

  if (sel) {
    return (
      <div className="space-y-4">
        {back('Kembali ke Layanan SLO', () => setSel(null))}
        <LayananTahapList
          tahap={sel.tahap}
          posisi={sel.posisi}
          rows={rows.filter((r) => r.tahap === sel.tahap && (!sel.posisi || r.posisi === sel.posisi))}
          allProjects={projects}
          inspectors={inspectors}
          role={role}
          userName={userName}
          inspectorId={inspectorId}
          noSloByAgenda={terbit.noSlo}
          onUpdateProject={onUpdateProject}
          onOpenProject={onOpenProject}
          onToast={onToast}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {GROUPS.map((group) => (
        <section key={group.title} className="rounded-2xl bg-white border border-slate-200/80 shadow-xs p-5 md:p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className={`w-1.5 h-9 rounded-full bg-gradient-to-b ${group.accent}`} />
            <div className="min-w-0">
              <h3 className="font-display text-sm font-bold uppercase tracking-wide text-slate-900">{group.title}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{group.subtitle}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {group.items.map((item) => {
              const Icon = item.icon;
              const count = item.sel ? countOf(item.sel) : item.id === 'slo-terbit' && terbit.total ? terbit.total : null;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => (item.sel ? setSel(item.sel) : setShowTerbit(true))}
                  className="group flex items-center gap-3.5 text-left rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 hover:bg-white hover:border-blue-300 hover:shadow-md hover:shadow-blue-600/10 transition cursor-pointer"
                >
                  <span
                    className={`w-11 h-11 rounded-xl bg-gradient-to-br ${group.accent} flex items-center justify-center shadow-sm shrink-0 transition-transform group-hover:scale-105`}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display font-extrabold text-[14px] text-slate-900 leading-tight">{item.label}</span>
                    {item.sub && <span className="block mt-0.5 text-xs font-semibold text-blue-700">{item.sub}</span>}
                  </span>
                  {count !== null ? (
                    <span className="font-display text-2xl font-extrabold text-slate-900 tabular-nums leading-none">{count}</span>
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 shrink-0 transition-colors" />
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export default LayananSlo;
