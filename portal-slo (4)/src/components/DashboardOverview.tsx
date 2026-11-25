import {
  FolderKanban,
  Award,
  ClipboardCheck,
  AlertTriangle,
  ShieldAlert,
  Trophy,
  Star,
  FileSpreadsheet,
  FileText,
  ArrowUpRight,
} from 'lucide-react';
import { AppDatabaseState, Project, STATUS_LABEL } from '../types/portal';
import { certStatus, computeAlerts, inspectorLocked, k3Status, routeDoc } from '../utils/portalUtils';

interface DashboardOverviewProps {
  state: AppDatabaseState;
  syncLabel: string;
  onOpenProject: (projectId: string) => void;
  onNavigate: (tab: string) => void;
}

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
      <div className="relative w-40 h-40 shrink-0 flex items-center justify-center">
        <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
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
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mt-1">
            {centerSub}
          </span>
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
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                <span className="text-slate-700 truncate font-medium" title={s.label}>
                  {s.label}
                </span>
              </div>
              <span className="shrink-0 whitespace-nowrap tabular-nums">
                <span className="font-bold text-slate-900">{s.count}</span>
                <span className="text-slate-400 ml-1.5 inline-block min-w-[2.75rem] text-right">
                  {pct}%
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
    </div>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const pts = values
    .map((v, idx) => {
      const x = (idx / Math.max(values.length - 1, 1)) * 68 + 4;
      const y = 20 - ((v - min) / span) * 14;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox="0 0 76 24" className="w-18 h-6">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts}
      />
      {values.map((v, idx) => {
        const x = (idx / Math.max(values.length - 1, 1)) * 68 + 4;
        const y = 20 - ((v - min) / span) * 14;
        return <circle key={idx} cx={x} cy={y} r="1.8" fill={color} />;
      })}
    </svg>
  );
}

export function DashboardOverview({
  state,
  syncLabel,
  onOpenProject,
  onNavigate,
}: DashboardOverviewProps) {
  const projects = state.proj;
  const alerts = computeAlerts(state.insp, state.tools);
  const lockedCount = alerts.filter((a) => a.cert.lock).length;

  const sloCount = projects.filter((p) => p.status === 'slo').length;
  const readyCount = projects.filter((p) =>
    ['paid', 'scheduled', 'testing', 'submitted', 'approvedPJT'].includes(p.status)
  ).length;
  const rfqCount = projects.filter((p) => ['rfq', 'offered', 'approved', 'payproof'].includes(p.status)).length;
  const openFindings = projects.reduce(
    (sum, p) => sum + p.finds.filter((f) => f.st === 'open').length,
    0
  );

  // Donut 1: Project Status Breakdown
  const statusSlices: DonutSlice[] = [
    { label: 'SLO Terbit', count: sloCount, color: '#7C3AED' },
    { label: 'Pengujian & Dokumen', count: projects.filter((p) => ['scheduled', 'testing'].includes(p.status)).length, color: '#16A34A' },
    { label: 'Siap Penugasan', count: projects.filter((p) => p.status === 'paid').length, color: '#2563EB' },
    { label: 'RFQ & Penawaran', count: rfqCount, color: '#F97316' },
    { label: 'Evaluasi PJT', count: projects.filter((p) => ['submitted', 'approvedPJT'].includes(p.status)).length, color: '#EF4444' },
  ];

  // Bar Chart: Distribution by Installation Type + Readiness
  const barData = [
    {
      label: 'Pembangkit',
      value: projects.filter((p) => p.jenis === 'Pembangkit').length,
      color: '#2563EB',
    },
    {
      label: 'Transmisi TT',
      value: projects.filter((p) => p.jenis === 'TT').length,
      color: '#16A34A',
    },
    {
      label: 'Distribusi TM',
      value: projects.filter((p) => p.jenis === 'TM').length,
      color: '#7C3AED',
    },
    {
      label: 'Inspektor Aktif',
      value: state.insp.filter((i) => !inspectorLocked(i)).length,
      color: '#F97316',
    },
    {
      label: 'Alat Siap',
      value: state.tools.filter((t) => !certStatus(t.cal, true).lock).length,
      color: '#0EA5E9',
    },
  ];
  const barMax = Math.max(...barData.map((b) => b.value), 1);

  // Donut 2: SPT vs SPD
  const sptCount = projects.filter((p) => routeDoc(p.kota) === 'SPT').length;
  const spdCount = projects.filter((p) => routeDoc(p.kota) === 'SPD').length;
  const docSlices: DonutSlice[] = [
    { label: 'SPT (Sby/Sda/Grs)', count: sptCount, color: '#2563EB' },
    { label: 'SPD (Luar Area)', count: spdCount, color: '#16A34A' },
  ];

  // Ranked Inspectors
  const rankedInspectors = state.insp
    .map((ins) => {
      const assignedCount = projects.filter((p) => p.team?.ins.includes(ins.id)).length;
      const c1 = certStatus(ins.serkom);
      const c2 = k3Status(ins);
      const locked = inspectorLocked(ins);
      const minDays = c2 ? Math.min(c1.n, c2.n) : c1.n;
      return { ins, assignedCount, locked, minDays };
    })
    .sort((a, b) => Number(a.locked) - Number(b.locked) || b.assignedCount - a.assignedCount)
    .slice(0, 5);

  const rankBadgeStyles = [
    'bg-amber-400 text-amber-950',
    'bg-slate-300 text-slate-800',
    'bg-orange-400 text-orange-950',
    'bg-slate-200 text-slate-700',
    'bg-slate-200 text-slate-700',
  ];

  const sloRate = projects.length ? Math.round((sloCount / projects.length) * 100) : 0;

  // Performance summary rows by jenis instalasi
  const summaryRows = (['Pembangkit', 'TT', 'TM'] as const).map((jenis) => {
    const subset = projects.filter((p) => p.jenis === jenis);
    const done = subset.filter((p) => p.status === 'slo').length;
    const active = subset.filter((p) => p.status !== 'slo').length;
    const rate = subset.length ? Math.round((done / subset.length) * 100) : 0;
    const trend =
      jenis === 'Pembangkit'
        ? [1, 2, 2, 3, 4, Math.max(subset.length, 2)]
        : jenis === 'TT'
          ? [1, 1, 2, 2, 3, Math.max(subset.length, 1)]
          : [2, 2, 1, 3, 2, Math.max(subset.length, 1)];
    return {
      jenis: jenis === 'Pembangkit' ? 'Pembangkit (PLTU/PLTD/PLTS)' : jenis === 'TT' ? 'Transmisi TT / GI' : 'Distribusi TM',
      total: subset.length,
      active,
      done,
      rate,
      trend,
    };
  });

  return (
    <div className="space-y-5">
      {/* Row 1: 5 Gradient KPI Stat Cards matching reference image */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <button
          type="button"
          onClick={() => onNavigate('proyek')}
          className="text-left rounded-2xl p-4 bg-gradient-to-br from-[#1D4ED8] to-[#2563EB] text-white shadow-md shadow-blue-600/20 hover:brightness-105 transition cursor-pointer flex items-center gap-3.5"
        >
          <div className="w-11 h-11 rounded-full bg-white text-[#1D4ED8] flex items-center justify-center shrink-0">
            <FolderKanban className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-100 truncate">
              Total Proyek
            </div>
            <div className="font-display text-2xl font-extrabold tabular-nums leading-tight mt-0.5">
              {projects.length}
            </div>
            <div className="text-[11px] text-blue-100 mt-0.5 truncate">
              {rfqCount} tahap penawaran
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('proyek')}
          className="text-left rounded-2xl p-4 bg-gradient-to-br from-[#15803D] to-[#22C55E] text-white shadow-md shadow-emerald-600/20 hover:brightness-105 transition cursor-pointer flex items-center gap-3.5"
        >
          <div className="w-11 h-11 rounded-full bg-white text-[#16A34A] flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-100 truncate">
              SLO Terbit
            </div>
            <div className="font-display text-2xl font-extrabold tabular-nums leading-tight mt-0.5">
              {sloCount}
            </div>
            <div className="text-[11px] text-emerald-100 mt-0.5 truncate">
              {sloRate}% tingkat selesai
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('proyek')}
          className="text-left rounded-2xl p-4 bg-gradient-to-br from-[#6D28D9] to-[#7C3AED] text-white shadow-md shadow-purple-600/20 hover:brightness-105 transition cursor-pointer flex items-center gap-3.5"
        >
          <div className="w-11 h-11 rounded-full bg-white text-[#6D28D9] flex items-center justify-center shrink-0">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-purple-100 truncate">
              Operasional Aktif
            </div>
            <div className="font-display text-2xl font-extrabold tabular-nums leading-tight mt-0.5">
              {readyCount}
            </div>
            <div className="text-[11px] text-purple-100 mt-0.5 truncate">
              Penugasan & pengujian
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('peringatan')}
          className="text-left rounded-2xl p-4 bg-gradient-to-br from-[#EA580C] to-[#F97316] text-white shadow-md shadow-orange-600/20 hover:brightness-105 transition cursor-pointer flex items-center gap-3.5"
        >
          <div className="w-11 h-11 rounded-full bg-white text-[#EA580C] flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-orange-100 truncate">
              Peringatan Masa Berlaku
            </div>
            <div className="font-display text-2xl font-extrabold tabular-nums leading-tight mt-0.5">
              {alerts.length}
            </div>
            <div className="text-[11px] text-orange-100 mt-0.5 truncate">
              SKTTK, K3 & kalibrasi
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('peringatan')}
          className="text-left rounded-2xl p-4 bg-gradient-to-br from-[#0284C7] to-[#0EA5E9] text-white shadow-md shadow-sky-600/20 hover:brightness-105 transition cursor-pointer flex items-center gap-3.5"
        >
          <div className="w-11 h-11 rounded-full bg-white text-[#0284C7] flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-sky-100 truncate">
              Terkunci / Temuan
            </div>
            <div className="font-display text-2xl font-extrabold tabular-nums leading-tight mt-0.5">
              {lockedCount + openFindings}
            </div>
            <div className="text-[11px] text-sky-100 mt-0.5 truncate">
              {lockedCount} terkunci · {openFindings} temuan
            </div>
          </div>
        </button>
      </div>

      {/* Row 2: 3-Column Visual Charts + Top Inspektor & SPK/SPD */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Card 1: Result Summary Donut */}
        <div className="lg:col-span-4 min-w-0 overflow-hidden rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs flex flex-col">
          <div>
            <h3 className="font-display text-sm font-bold uppercase tracking-wide text-slate-900 mb-5">
              Ringkasan Status Proyek
            </h3>
            <DonutChart
              slices={statusSlices}
              centerTitle={projects.length}
              centerSub="TOTAL"
            />
          </div>
        </div>

        {/* Card 2: Vertical Bar Chart */}
        <div className="lg:col-span-4 rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <h3 className="font-display text-sm font-bold uppercase tracking-wide text-slate-900 mb-4">
            Distribusi Instalasi & Kesiapan
          </h3>
          <div className="h-44 flex items-end justify-between gap-3 pt-4 px-2 border-b border-slate-200">
            {barData.map((b) => {
              const heightPct = Math.max(12, Math.round((b.value / barMax) * 100));
              return (
                <div key={b.label} className="flex-1 flex flex-col items-center h-full justify-end">
                  <span className="text-xs font-bold text-slate-800 tabular-nums mb-1">
                    {b.value}
                  </span>
                  <div
                    className="w-full max-w-[36px] rounded-t-md transition-all duration-300"
                    style={{ height: `${heightPct}%`, backgroundColor: b.color }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex items-start justify-between gap-2 pt-2 px-1">
            {barData.map((b) => (
              <div
                key={b.label}
                className="flex-1 text-center text-[11px] font-medium text-slate-500 leading-tight"
              >
                {b.label}
              </div>
            ))}
          </div>
        </div>

        {/* Card 3: Top Performing Inspectors + Pass Rate SPK/SPD */}
        <div className="lg:col-span-4 space-y-5">
          <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-3.5">
              <Trophy className="w-4 h-4 text-slate-700" />
              <h3 className="font-display text-sm font-bold uppercase tracking-wide text-slate-900">
                Daftar Inspektor (TTK)
              </h3>
            </div>
            <div className="space-y-2.5">
              {rankedInspectors.map((item, idx) => (
                <div
                  key={item.ins.id}
                  className="flex items-center justify-between gap-2 py-1 border-b border-slate-100 last:border-b-0"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                        rankBadgeStyles[idx] || 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="text-xs font-semibold text-slate-800 truncate">
                      {item.ins.nama}
                    </span>
                  </div>
                  <span
                    className={`text-xs font-bold tabular-nums whitespace-nowrap ${
                      item.locked ? 'text-red-600' : 'text-emerald-600'
                    }`}
                  >
                    {item.locked ? 'Terkunci' : `${item.minDays} hr`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs">
            <h3 className="font-display text-sm font-bold uppercase tracking-wide text-slate-900 mb-3">
              Rasio Penugasan (SPT vs SPD)
            </h3>
            <DonutChart
              slices={docSlices}
              centerTitle={`${projects.length ? Math.round((sptCount / projects.length) * 100) : 0}%`}
              centerSub="LOKAL SPT"
            />
          </div>
        </div>
      </div>

      {/* Row 3: Performance Overview Table + Bottom Right Action Spotlight */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="font-display text-sm font-bold uppercase tracking-wide text-slate-900">
              Ringkasan Proyek & Antrean Terbaru
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('proyek')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 cursor-pointer"
            >
              Lihat semua proyek <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-[#0F1E3D] text-white text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-3.5 font-semibold">Kategori / Perusahaan</th>
                  <th className="py-2.5 px-3.5 font-semibold text-right">Total / Kapasitas</th>
                  <th className="py-2.5 px-3.5 font-semibold">Status</th>
                  <th className="py-2.5 px-3.5 font-semibold text-center">Dokumen</th>
                  <th className="py-2.5 px-3.5 font-semibold text-center">Tren</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {summaryRows.map((row) => (
                  <tr key={row.jenis} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3.5 font-semibold text-slate-800">{row.jenis}</td>
                    <td className="py-2.5 px-3.5 text-right font-mono tabular-nums text-slate-700">
                      {row.total} proyek ({row.rate}% SLO)
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-600">
                      {row.active} aktif · {row.done} selesai
                    </td>
                    <td className="py-2.5 px-3.5 text-center font-semibold text-blue-700">
                      ST · AL · JSA
                    </td>
                    <td className="py-2 px-3.5 flex justify-center">
                      <Sparkline values={row.trend} color={row.done > 0 ? '#16A34A' : '#2563EB'} />
                    </td>
                  </tr>
                ))}
                {projects.slice(0, 3).map((p: Project) => (
                  <tr
                    key={p.id}
                    onClick={() => onOpenProject(p.id)}
                    className="hover:bg-blue-50/50 transition-colors cursor-pointer"
                  >
                    <td className="py-2.5 px-3.5 font-medium text-slate-900">
                      <div>{p.perusahaan}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {p.no} · {p.kota}
                      </div>
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-mono tabular-nums text-slate-700">
                      {p.kap}
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-700 font-medium">
                      {STATUS_LABEL[p.status]}
                    </td>
                    <td className="py-2.5 px-3.5 text-center font-semibold text-slate-700">
                      {routeDoc(p.kota)}
                    </td>
                    <td className="py-2 px-3.5 flex justify-center">
                      <Sparkline
                        values={
                          p.status === 'slo'
                            ? [1, 3, 5, 7, 9, 10]
                            : p.status === 'rfq'
                              ? [2, 2, 1, 2, 2, 3]
                              : [2, 4, 4, 6, 7, 8]
                        }
                        color={p.status === 'slo' ? '#16A34A' : '#0284C7'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Right Spotlight Card */}
        <div className="lg:col-span-4 rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900">
                  Integrasi Database & Dokumen
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Data tersimpan otomatis di server. Cetak dokumen resmi Surat Tugas, Surat Jalan Alat, dan JSA dalam format A4 standar.
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-6 h-6 text-amber-600" />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-1 text-amber-500">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} className="w-4 h-4 fill-amber-400 text-amber-400" />
              ))}
              <span className="ml-2 text-xs font-semibold text-slate-600">
                {syncLabel}
              </span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => onNavigate('proyek')}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>Buka Menu Pekerjaan (ST, JSA &amp; Surat Jalan)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
