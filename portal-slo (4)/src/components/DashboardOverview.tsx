import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Layers,
  Lock,
  PieChart,
  Workflow,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import {
  AppDatabaseState,
  ROLE_LABELS,
  type InstalasiTahap,
  type Project,
  type UserSession,
} from '../types/portal';
import {
  HARI_MACET,
  TAHAP_LABEL,
  buildInstalasiRows,
  certStatus,
  computeAlerts,
  normAgenda,
} from '../utils/portalUtils';
import {
  URUTAN_TAHAP,
  hitungJenis,
  hitungPipeline,
  hitungTahapInstalasi,
  instalasiMenungguSaya,
  instalasiTanpaLaporan,
  instalasiTerlihat,
  kumpulkanPekerjaan,
  langkahIndex,
  penawaranBerjalan,
  salesOrderBulanIni,
  tindakanMarketing,
  tindakanSaya,
  type TindakanItem,
  type TujuanBuka,
} from '../utils/overviewUtils';
import { sloTrendPerTahun } from '../utils/sloTrend';
import { SloTrendCard } from './SloTrendCard';
import { getDjkPosisi, getSloTerbit, type SloRecord } from '../services/sloTerbitApi';

type Role = UserSession['role'];

interface DashboardOverviewProps {
  state: AppDatabaseState;
  syncLabel: string;
  /** Proyek yang boleh dilihat peran ini (aturan sama dengan Daftar Pekerjaan & Layanan SLO). */
  visibleProjects: Project[];
  myInspectorId: string;
  pjtName: string;
  onOpenProject: (projectId: string, row?: 'prep_docs' | 'director') => void;
  onNavigate: (tab: string) => void;
}

const CARD = 'rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs';
const H3 = 'font-display text-sm font-bold uppercase tracking-wide text-slate-900';
const LINK = 'text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 cursor-pointer';
const MAX_TINDAKAN = 8;

/** Label singkat 6 langkah untuk kartu pipeline (label lengkap ada di FLOW_STEPS). */
const LANGKAH_SINGKAT = [
  'Penawaran & Sales Order',
  'Pilih PJT',
  'Tunjuk Leader & Tim',
  'ST, JSA & Surat Jalan',
  'Review & TTD',
  'Layanan SLO',
];

/** Langkah alur yang dikerjakan tiap peran (disorot di pipeline). */
const LANGKAH_PERAN: Record<Role, number[]> = {
  sales: [0],
  teknis: [1, 5],
  pjt: [2],
  inspektor: [3],
  direktur: [4],
};

const PEMEGANG_TAHAP: Record<InstalasiTahap, Role | 'djk' | null> = {
  verifikasi_lit: 'teknis',
  pengerjaan_tt: 'inspektor',
  pengesahan_pjt: 'pjt',
  evaluasi_lit: 'teknis',
  evaluasi_djk: 'djk',
  generate_slo: 'teknis',
  cetak_slo: 'teknis',
  slo_terbit: null,
};

const PEMEGANG_LABEL: Record<string, string> = {
  teknis: 'Admin',
  inspektor: 'Tenaga Teknik',
  pjt: 'PJT',
  djk: 'DJK',
};

/** Peran yang punya akses ke menu Penawaran/Sales Order (lihat TAB_ACCESS di App.tsx). */
const AKSES_PENJUALAN: Role[] = ['sales', 'teknis', 'direktur'];
const AKSES_PERINGATAN: Role[] = ['teknis', 'pjt', 'inspektor', 'direktur'];

interface DonutSlice {
  label: string;
  count: number;
  color: string;
}

function DonutChart({
  slices,
  centerTitle,
  centerSub,
}: {
  slices: DonutSlice[];
  centerTitle: string | number;
  centerSub: string;
}) {
  const total = slices.reduce((acc, s) => acc + s.count, 0) || 1;
  const r = 54;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="@container w-full">
      <div className="flex flex-col @md:flex-row items-center gap-5 @md:gap-6">
        <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
          <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90" role="img" aria-label={`${centerSub}: ${centerTitle}`}>
            <circle cx="70" cy="70" r={r} fill="none" stroke="#E2E8F0" strokeWidth="22" />
            {slices.map((s) => {
              if (s.count <= 0) return null;
              const dash = (s.count / total) * c;
              const el = (
                <circle
                  key={s.label}
                  cx="70"
                  cy="70"
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="22"
                  strokeDasharray={`${dash} ${c - dash}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += dash;
              return el;
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="font-display text-2xl font-extrabold text-slate-900 tabular-nums leading-none">
              {centerTitle}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 mt-1">{centerSub}</span>
          </div>
        </div>

        <ul className="flex-1 min-w-0 w-full divide-y divide-slate-100">
          {slices.map((s) => {
            const pct = Math.round((s.count / total) * 100);
            return (
              <li
                key={s.label}
                className={`flex items-center justify-between text-xs gap-3 py-2 first:pt-0 last:pb-0 ${
                  s.count <= 0 ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="text-slate-700 truncate font-medium" title={s.label}>
                    {s.label}
                  </span>
                </div>
                <span className="shrink-0 whitespace-nowrap tabular-nums">
                  <span className="font-bold text-slate-900">{s.count}</span>
                  <span className="text-slate-400 ml-1.5 inline-block min-w-[2.75rem] text-right">{pct}%</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/** Baris angka di panel per peran; bisa diklik bila `onClick` ada. */
function StatRow({
  label,
  value,
  hint,
  tone = 'default',
  onClick,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'default' | 'warn' | 'danger' | 'good';
  onClick?: () => void;
}) {
  const valueCls =
    tone === 'danger'
      ? 'text-red-600'
      : tone === 'warn'
        ? 'text-amber-600'
        : tone === 'good'
          ? 'text-emerald-600'
          : 'text-slate-900';
  const inner = (
    <>
      <span className="min-w-0 text-left">
        <span className="block text-xs font-semibold text-slate-800">{label}</span>
        {hint && <span className="block text-xs text-slate-500 mt-0.5">{hint}</span>}
      </span>
      <span className="flex items-center gap-1.5 shrink-0">
        <span className={`font-display text-xl font-extrabold tabular-nums ${valueCls}`}>{value}</span>
        {onClick && <ChevronRight className="w-4 h-4 text-slate-400" />}
      </span>
    </>
  );
  const cls = 'w-full flex items-center justify-between gap-3 py-2.5 border-b border-slate-100 last:border-b-0';
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} cursor-pointer hover:bg-slate-50 -mx-2 px-2 rounded-lg`}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

/** Ikon kecil berwarna di samping judul kartu. */
function IkonJudul({ icon: Icon, cls }: { icon: LucideIcon; cls: string }) {
  return (
    <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${cls}`} aria-hidden="true">
      <Icon className="w-4 h-4" />
    </span>
  );
}

/** Kartu angka ringkas di banner atas. */
function KpiTile({
  label,
  value,
  sub,
  valueCls = 'text-yellow-300',
  onClick,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  valueCls?: string;
  onClick?: () => void;
}) {
  const cls = 'w-full h-full text-left rounded-xl bg-white/10 px-4 py-3 text-white ring-1 ring-white/15';
  const body = (
    <>
      <span className="block text-xs font-semibold text-blue-100">{label}</span>
      <span className={`block font-display text-3xl font-extrabold tabular-nums leading-tight mt-0.5 ${valueCls}`}>{value}</span>
      {sub && <span className="block text-xs text-blue-200 mt-0.5">{sub}</span>}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} cursor-pointer hover:bg-white/15 transition`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function HariLabel({ hari, macet }: { hari: number | null; macet: boolean }) {
  if (hari === null) return null;
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-xs font-bold whitespace-nowrap ${
        macet ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
      }`}
    >
      {hari === 0 ? 'Baru hari ini' : `${hari} hari menunggu`}
    </span>
  );
}

export function DashboardOverview({
  state,
  syncLabel,
  visibleProjects,
  myInspectorId,
  pjtName,
  onOpenProject,
  onNavigate,
}: DashboardOverviewProps) {
  const role = state.role;
  const [sloData, setSloData] = useState<SloRecord[] | null>(null);
  const [posisiExcel, setPosisiExcel] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    getSloTerbit()
      .then((rows) => alive && setSloData(rows))
      .catch(() => {});
    getDjkPosisi()
      .then((m) => alive && setPosisiExcel(m))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const restricted = role === 'pjt' || role === 'inspektor';

  const items = useMemo(
    () => kumpulkanPekerjaan(state.joSoRecords, state.proj, visibleProjects, restricted),
    [state.joSoRecords, state.proj, visibleProjects, restricted]
  );

  const penawaranAktif = useMemo(
    () => penawaranBerjalan(state.suratPenawaran, state.joSoRecords),
    [state.suratPenawaran, state.joSoRecords]
  );

  const pipeline = useMemo(() => hitungPipeline(items, penawaranAktif.length), [items, penawaranAktif.length]);

  const tindakan = useMemo<TindakanItem[]>(
    () =>
      role === 'sales'
        ? tindakanMarketing(state.suratPenawaran, state.joSoRecords)
        : tindakanSaya(items, role, myInspectorId, pjtName),
    [role, items, myInspectorId, pjtName, state.suratPenawaran, state.joSoRecords]
  );

  // Instalasi per tahap Layanan SLO — aturan yang sama dengan menu Layanan SLO.
  const instalasiRows = useMemo(() => {
    const terbit = new Set<string>();
    for (const r of sloData ?? []) terbit.add(normAgenda(r.noAgenda));
    return instalasiTerlihat(buildInstalasiRows(visibleProjects, { terbit, posisiExcel }), role, myInspectorId);
  }, [visibleProjects, sloData, posisiExcel, role, myInspectorId]);
  const tahap = useMemo(() => hitungTahapInstalasi(instalasiRows), [instalasiRows]);
  const instalasiSaya = useMemo(
    () => instalasiMenungguSaya(instalasiRows, role, myInspectorId, pjtName),
    [instalasiRows, role, myInspectorId, pjtName]
  );

  const alerts = useMemo(() => computeAlerts(state.insp, state.tools), [state.insp, state.tools]);
  const jenis = hitungJenis(items.map((i) => i.project).filter((p): p is Project => Boolean(p)));
  const jumlahProyek = jenis.Pembangkit + jenis.TT + jenis.TM;

  /* ---------- navigasi ---------- */
  const bukaDaftar = (filter: string) => {
    try {
      sessionStorage.setItem('daftar.filter', filter);
    } catch {
      /* penyimpanan tidak tersedia: tetap buka daftar tanpa filter */
    }
    onNavigate('proyek');
  };
  const buka = (t: TujuanBuka) => {
    if (t.type === 'project') onOpenProject(t.projectId, t.row);
    else if (t.type === 'daftar') bukaDaftar('mine');
    else if (t.type === 'layanan') onNavigate('layanan-slo');
    else onNavigate(t.tab);
  };

  const aktif = items.length - pipeline.selesai;
  const myLangkah = LANGKAH_PERAN[role];
  const bisaPenjualan = AKSES_PENJUALAN.includes(role);
  const macetTotal = pipeline.langkah.reduce((n, l) => n + l.macet, 0);
  const tindakanTampil = tindakan.slice(0, MAX_TINDAKAN);
  const tindakanSisa = tindakan.length - tindakanTampil.length;
  const lihatSemuaTindakan = () => (role === 'sales' ? onNavigate('data-penawaran') : bukaDaftar('mine'));

  /* ---------- panel per peran ---------- */
  const alertKunci = alerts.filter((a) => a.cert.lock).length;
  const alertHampir = alerts.length - alertKunci;
  const tahunIni = new Date().getFullYear();
  const trend = useMemo(() => (sloData ? sloTrendPerTahun(sloData) : null), [sloData]);
  const terbitTahunIni = trend?.total.perTahun[tahunIni] ?? 0;
  const terbitTahunLalu = trend?.total.perTahun[tahunIni - 1] ?? 0;

  const panel = (() => {
    switch (role) {
      case 'teknis': {
        const belumPilih = items.filter((i) => !i.project || langkahIndex(i.project) === 1).length;
        return (
          <>
            <StatRow
              label="Belum dipilih PJT"
              hint="Sales Order menunggu diteruskan ke PJT"
              value={belumPilih}
              tone={belumPilih > 0 ? 'warn' : 'good'}
              onClick={() => bukaDaftar('langkah:1')}
            />
            <StatRow
              label="Instalasi menunggu Admin"
              hint="Verifikasi LIT, Evaluasi LIT, Generate & Cetak SLO"
              value={instalasiSaya.length}
              tone={instalasiSaya.length > 0 ? 'warn' : 'good'}
              onClick={() => onNavigate('layanan-slo')}
            />
            <StatRow
              label="Sertifikat & kalibrasi terkunci"
              hint="SKTTK, K3, atau kalibrasi alat kedaluwarsa"
              value={alertKunci}
              tone={alertKunci > 0 ? 'danger' : 'good'}
              onClick={() => onNavigate('peringatan')}
            />
            <StatRow
              label="Akan habis masa berlaku"
              hint="SKTTK, K3 & kalibrasi dalam 60 hari"
              value={alertHampir}
              tone={alertHampir > 0 ? 'warn' : 'good'}
              onClick={() => onNavigate('peringatan')}
            />
          </>
        );
      }
      case 'sales': {
        const draft = state.suratPenawaran.filter((x) => x.status === 'draft').length;
        const belumPo = tindakan.filter((t) => t.aksi === 'Buat PO').length;
        return (
          <>
            <StatRow
              label="Penawaran draft"
              hint="Belum dikirim"
              value={draft}
              tone={draft > 0 ? 'warn' : 'default'}
              onClick={() => onNavigate('data-penawaran')}
            />
            <StatRow
              label="Penawaran belum dibuatkan PO"
              hint="Status submit / approved"
              value={belumPo}
              tone={belumPo > 0 ? 'warn' : 'good'}
              onClick={() => onNavigate('input-sales-order')}
            />
            <StatRow
              label="Sales Order bulan ini"
              value={salesOrderBulanIni(state.joSoRecords)}
              onClick={() => onNavigate('data-sales-order')}
            />
            <StatRow label="Total Sales Order" value={state.joSoRecords.length} onClick={() => onNavigate('data-sales-order')} />
          </>
        );
      }
      case 'pjt': {
        const pengesahan = instalasiSaya.length;
        return (
          <>
            <StatRow
              label="Perlu menunjuk Leader"
              hint="Pekerjaan yang diteruskan Admin kepada Anda"
              value={tindakan.length}
              tone={tindakan.length > 0 ? 'warn' : 'good'}
              onClick={() => bukaDaftar('mine')}
            />
            <StatRow
              label="Instalasi menunggu pengesahan"
              hint="Laporan menunggu Anda sahkan"
              value={pengesahan}
              tone={pengesahan > 0 ? 'warn' : 'good'}
              onClick={() => onNavigate('layanan-slo')}
            />
            <StatRow label="Pekerjaan aktif" value={aktif} onClick={() => bukaDaftar('')} />
            <StatRow label="Pekerjaan selesai (SLO terbit)" value={pipeline.selesai} tone="good" onClick={() => bukaDaftar('langkah:6')} />
          </>
        );
      }
      case 'inspektor': {
        const saya = state.insp.find((i) => i.id === myInspectorId);
        const sk = saya ? certStatus(saya.serkom) : null;
        const tanpaLaporan = instalasiTanpaLaporan(instalasiSaya).length;
        return (
          <>
            <StatRow label="Pekerjaan tim saya" value={aktif} onClick={() => bukaDaftar('')} />
            <StatRow
              label="Instalasi perlu laporan"
              hint={tanpaLaporan > 0 ? `${tanpaLaporan} belum punya laporan sama sekali` : 'Laporan diunggah per instalasi'}
              value={instalasiSaya.length}
              tone={instalasiSaya.length > 0 ? 'warn' : 'good'}
              onClick={() => onNavigate('layanan-slo')}
            />
            {sk && (
              <StatRow
                label="Masa berlaku SKTTK saya"
                hint={sk.lock ? 'Kedaluwarsa — tidak bisa ditugaskan' : sk.t}
                value={sk.lock ? 'Habis' : `${sk.n} hr`}
                tone={sk.lock || sk.k === 'crit' ? 'danger' : sk.k === 'warn' ? 'warn' : 'good'}
                onClick={() => onNavigate('peringatan')}
              />
            )}
          </>
        );
      }
      case 'direktur':
        return (
          <>
            <StatRow
              label="Surat Tugas menunggu TTD"
              value={tindakan.length}
              tone={tindakan.length > 0 ? 'warn' : 'good'}
              onClick={() => bukaDaftar('mine')}
            />
            <StatRow label="Total pekerjaan" hint={`${aktif} aktif`} value={items.length} onClick={() => bukaDaftar('')} />
            <StatRow
              label="Pekerjaan selesai (SLO terbit)"
              value={pipeline.selesai}
              tone="good"
              onClick={() => bukaDaftar('langkah:6')}
            />
            <StatRow
              label="Instalasi SLO terbit"
              hint={`dari ${tahap.total} instalasi di Layanan SLO`}
              value={tahap.terbit}
              tone="good"
              onClick={() => onNavigate('layanan-slo')}
            />
            {sloData && (
              <StatRow
                label={`SLO terbit ${tahunIni}`}
                hint={`${terbitTahunLalu} pada ${tahunIni - 1} (data Excel DJK)`}
                value={terbitTahunIni}
              />
            )}
          </>
        );
    }
  })();

  const panelJudul: Record<Role, string> = {
    teknis: 'Perlu perhatian Admin',
    sales: 'Penjualan',
    pjt: 'Pekerjaan PJT',
    inspektor: 'Pekerjaan saya',
    direktur: 'Ringkasan eksekutif',
  };

  const topAlerts = alerts.slice(0, 3);
  const persenTerbit = tahap.total ? Math.round((tahap.terbit / tahap.total) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Banner ringkasan */}
      <section className="rounded-2xl bg-gradient-to-br from-[#0F1E3D] to-[#172F63] border-b-4 border-b-yellow-400 p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-extrabold text-white">Apa yang perlu dikerjakan sekarang</h2>
            <p className="text-xs text-blue-100 mt-0.5">
              Tampilan untuk <b className="text-white">{ROLE_LABELS[role]}</b>
              {macetTotal > 0 && (
                <>
                  {' · '}
                  <span className="font-semibold text-amber-300">
                    {macetTotal} pekerjaan diam lebih dari {HARI_MACET} hari
                  </span>
                </>
              )}
            </p>
          </div>
          <span className="text-xs text-blue-200">{syncLabel}</span>
        </div>
        <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiTile
            label="Pekerjaan aktif"
            value={aktif}
            sub={`${pipeline.selesai} sudah selesai`}
                        onClick={() => bukaDaftar('')}
          />
          <KpiTile
            label="Perlu tindakan saya"
            value={tindakan.length}
            sub={tindakan.length > 0 ? 'Buka daftar tindakan' : 'Tidak ada yang menunggu'}
                        onClick={lihatSemuaTindakan}
          />
          <KpiTile
            label={`Diam > ${HARI_MACET} hari`}
            value={macetTotal}
            sub={macetTotal > 0 ? 'Perlu ditindaklanjuti' : 'Semua berjalan lancar'}
            valueCls={macetTotal > 0 ? 'text-red-300' : 'text-yellow-300'}
          />
          <KpiTile
            label="SLO terbit"
            value={tahap.terbit}
            sub={`dari ${tahap.total} instalasi (${persenTerbit}%)`}
                        onClick={() => onNavigate('layanan-slo')}
          />
        </div>
      </section>

      {/* Baris 1: Perlu tindakan saya + panel per peran */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className={`lg:col-span-8 min-w-0 ${CARD}`} aria-labelledby="ov-tindakan">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 id="ov-tindakan" className={`${H3} inline-flex items-center gap-2`}>
              <IkonJudul icon={ClipboardCheck} cls="bg-yellow-300 text-[#0F1E3D]" />
              Perlu tindakan saya{' '}
              <span
                className={`ml-1 rounded-full px-2 py-0.5 text-xs font-bold normal-case tracking-normal ${
                  tindakan.length > 0 ? 'bg-yellow-200 text-yellow-900' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {tindakan.length}
              </span>
            </h3>
            {tindakan.length > 0 && (
              <button type="button" onClick={lihatSemuaTindakan} className={LINK}>
                {role === 'sales' ? 'Lihat penawaran' : 'Buka di Daftar Pekerjaan'} <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {tindakan.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-5 text-sm text-emerald-800">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>Tidak ada pekerjaan yang menunggu tindakan Anda saat ini.</span>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                {tindakanTampil.map((t) => (
                  <li key={t.key}>
                    <button
                      type="button"
                      onClick={() => buka(t.buka)}
                      className={`w-full text-left px-3.5 py-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 cursor-pointer hover:bg-slate-50 transition-colors ${
                        t.macet ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-transparent'
                      }`}
                    >
                      <span className="min-w-0 flex-1 basis-56">
                        <span className="block text-xs font-bold text-slate-900 truncate">{t.judul}</span>
                        <span className="block text-xs text-slate-500 font-mono truncate">{t.sub}</span>
                      </span>
                      <span className="inline-flex items-center gap-2 shrink-0">
                        <HariLabel hari={t.hari} macet={t.macet} />
                        <span className="rounded-lg bg-yellow-200 px-2.5 py-1 text-xs font-bold text-yellow-900 whitespace-nowrap">
                          {t.aksi}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {tindakanSisa > 0 && (
                <button type="button" onClick={lihatSemuaTindakan} className={`${LINK} mt-3`}>
                  +{tindakanSisa} pekerjaan lainnya <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
        </section>

        <section className={`lg:col-span-4 min-w-0 ${CARD}`}>
          <h3 className={`${H3} mb-1.5 inline-flex items-center gap-2`}>
            <IkonJudul icon={Zap} cls="bg-yellow-300 text-[#0F1E3D]" />
            {panelJudul[role]}
          </h3>
          <div>{panel}</div>
          {role === 'teknis' && topAlerts.length > 0 && (
            <ul className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
              {topAlerts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate text-slate-700">
                    <b className="font-semibold">{a.owner}</b> · {a.what}
                  </span>
                  <span className={`shrink-0 font-bold tabular-nums ${a.cert.lock ? 'text-red-600' : 'text-amber-600'}`}>
                    {a.cert.lock ? 'Kedaluwarsa' : `${a.cert.n} hr`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Baris 2: Pipeline 6 langkah */}
      <section className={`${CARD}`} aria-labelledby="ov-pipeline">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 id="ov-pipeline" className={`${H3} inline-flex items-center gap-2`}>
            <IkonJudul icon={Workflow} cls="bg-yellow-300 text-[#0F1E3D]" />
            Pipeline pekerjaan (6 langkah)
          </h3>
          <button type="button" onClick={() => bukaDaftar('')} className={LINK}>
            Daftar Pekerjaan <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <ol className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {pipeline.langkah.map((l) => {
            const mine = myLangkah.includes(l.index);
            const klik = l.index === 0 ? bisaPenjualan : true;
            const onClick = () => (l.index === 0 ? onNavigate('data-penawaran') : bukaDaftar(`langkah:${l.index}`));
            const body = (
              <>
                <span className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-500">Langkah {l.index + 1}</span>
                  {mine && <span className="rounded bg-yellow-200 px-1.5 text-xs font-bold text-yellow-900">Anda</span>}
                </span>
                <span className={`block font-display text-2xl font-extrabold tabular-nums mt-1 leading-none text-[#0F1E3D]`}>
                  {l.count}
                </span>
                <span className="block text-xs font-semibold text-slate-800 mt-1.5 leading-snug">
                  {LANGKAH_SINGKAT[l.index]}
                </span>
                <span className="block text-xs text-slate-500">{l.owner}</span>
                {l.macet > 0 && (
                  <span className="mt-1.5 inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-xs font-bold text-red-700">
                    <AlertTriangle className="w-3 h-3" /> {l.macet} macet
                  </span>
                )}
              </>
            );
            const cls = `w-full h-full text-left rounded-xl border p-3 transition ${
              mine
                ? 'border-yellow-400 bg-yellow-50 ring-1 ring-yellow-300'
                : l.index === 5
                  ? 'border-emerald-200 bg-emerald-50/60'
                  : 'border-slate-200 bg-white'
            }`;
            return (
              <li key={l.index} title={l.index === 0 ? 'Penawaran yang belum dibuatkan Sales Order' : l.label}>
                {klik ? (
                  <button type="button" onClick={onClick} className={`${cls} cursor-pointer hover:border-blue-300 hover:shadow-sm`}>
                    {body}
                  </button>
                ) : (
                  <div className={cls}>{body}</div>
                )}
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-xs text-slate-500">
          Langkah 1 menghitung penawaran yang belum dibuatkan Sales Order; langkah 2–6 menghitung pekerjaan.{' '}
          {pipeline.selesai > 0 && (
            <button type="button" onClick={() => bukaDaftar('langkah:6')} className="font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">
              {pipeline.selesai} pekerjaan sudah selesai (SLO terbit)
            </button>
          )}
        </p>
      </section>

      {/* Baris 3: Pipeline instalasi + portofolio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className={`lg:col-span-8 min-w-0 ${CARD}`} aria-labelledby="ov-instalasi">
          <div className="flex items-center justify-between gap-3 mb-1">
            <h3 id="ov-instalasi" className={`${H3} inline-flex items-center gap-2`}>
              <IkonJudul icon={Layers} cls="bg-yellow-300 text-[#0F1E3D]" />
              Instalasi per tahap Layanan SLO
            </h3>
            <button type="button" onClick={() => onNavigate('layanan-slo')} className={LINK}>
              Layanan SLO <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs text-slate-600 mb-3">
            <b className="text-slate-900 tabular-nums">{tahap.terbit}</b> dari{' '}
            <b className="text-slate-900 tabular-nums">{tahap.total}</b> instalasi SLO terbit
            {tahap.total > 0 && <span className="text-slate-400"> ({persenTerbit}%)</span>}
          </p>
          <div
            className="h-2 rounded-full bg-slate-100 overflow-hidden mb-4"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={tahap.total}
            aria-valuenow={tahap.terbit}
            aria-label="Instalasi SLO terbit"
          >
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${persenTerbit}%` }} />
          </div>
          {tahap.total === 0 ? (
            <p className="text-xs text-slate-500">
              Belum ada instalasi di Layanan SLO. Instalasi masuk setelah Surat Tugas ditandatangani Direktur.
            </p>
          ) : (
            <ol className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {URUTAN_TAHAP.map((t, i) => {
                const pemegang = PEMEGANG_TAHAP[t];
                const mine = pemegang === role;
                return (
                  <li key={t}>
                    <button
                      type="button"
                      onClick={() => onNavigate('layanan-slo')}
                      className={`w-full h-full text-left rounded-xl border p-2.5 cursor-pointer hover:border-blue-300 transition ${
                        mine
                          ? 'border-yellow-400 bg-yellow-50 ring-1 ring-yellow-300'
                          : t === 'slo_terbit'
                            ? 'border-emerald-200 bg-emerald-50/60'
                            : 'border-slate-200 bg-white'
                      }`}
                    >
                      <span className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-slate-500">{i + 1}</span>
                        {pemegang && (
                          <span className={`text-xs font-semibold ${mine ? 'text-yellow-900' : 'text-slate-500'}`}>
                            {mine ? 'Anda' : PEMEGANG_LABEL[pemegang]}
                          </span>
                        )}
                      </span>
                      <span className="block font-display text-xl font-extrabold tabular-nums text-slate-900 leading-tight">
                        {tahap.perTahap[t]}
                      </span>
                      <span className="block text-xs font-semibold text-slate-700 leading-snug">{TAHAP_LABEL[t]}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section className={`lg:col-span-4 min-w-0 overflow-hidden ${CARD}`}>
          <h3 className={`${H3} mb-4 inline-flex items-center gap-2`}>
            <IkonJudul icon={PieChart} cls="bg-yellow-300 text-[#0F1E3D]" />
            Portofolio per jenis instalasi
          </h3>
          {jumlahProyek === 0 ? (
            <p className="text-xs text-slate-500 flex items-center gap-2">
              <Lock className="w-3.5 h-3.5" /> Belum ada proyek.
            </p>
          ) : (
            <DonutChart
              slices={[
                { label: 'Pembangkit', count: jenis.Pembangkit, color: '#FACC15' },
                { label: 'Transmisi TT / GI', count: jenis.TT, color: '#1E3A8A' },
                { label: 'Distribusi TM', count: jenis.TM, color: '#94A3B8' },
              ]}
              centerTitle={jumlahProyek}
              centerSub="PROYEK"
            />
          )}
        </section>
      </div>

      {/* Baris 4: Tren SLO Terbit per tahun (data Excel DJK) */}
      {sloData && sloData.length > 0 && (
        <SloTrendCard
          data={sloData}
          layout="split"
          action={
            <button type="button" onClick={() => onNavigate('layanan-slo')} className={LINK}>
              Lihat SLO Terbit <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          }
        />
      )}
    </div>
  );
}
