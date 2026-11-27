import { useMemo, type ReactNode } from 'react';
import { BULAN } from '../types/portal';
import { pembangkitVsLainnya, sloTrendPerTahun } from '../utils/sloTrend';
import { Sparkline } from './Sparkline';
import { TrendAreaChart } from './TrendAreaChart';

const todayIso = () => new Date().toISOString().slice(0, 10);

const fmtLong = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${Number(d)} ${BULAN[Number(m) - 1]} ${y}` : '-';
};

/**
 * Ringkasan SLO Terbit per tahun: tabel per bidang + grafik area.
 * Dipakai di halaman SLO Terbit (susun atas-bawah) dan Dashboard (berdampingan).
 */
export function SloTrendCard({
  data,
  layout = 'stack',
  action,
  today = todayIso(),
}: {
  data: { bidang: string; tglTerbit: string }[];
  layout?: 'stack' | 'split';
  /** Tombol/tautan di pojok kanan atas judul. */
  action?: ReactNode;
  today?: string;
}) {
  const trend = useMemo(() => sloTrendPerTahun(data), [data]);
  if (trend.years.length === 0) return null;

  const thisYear = new Date().getFullYear();
  const partial = trend.years[trend.years.length - 1] === thisYear;
  const all = [...trend.rows, trend.total];
  const v = pembangkitVsLainnya(trend);

  const table = (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-left border-collapse min-w-[560px]">
        <thead>
          <tr className="bg-[#0F1E3D] text-white text-[11px] uppercase tracking-wider">
            <th className="py-2.5 px-3.5 font-semibold">Bidang</th>
            <th className="py-2.5 px-3.5 font-semibold text-right">Total</th>
            {trend.years.map((y) => (
              <th key={y} className="py-2.5 px-3 font-semibold text-right">
                {y}
                {partial && y === thisYear ? '*' : ''}
              </th>
            ))}
            <th className="py-2.5 px-3.5 font-semibold text-center">Tren</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-xs">
          {all.map((row, idx) => {
            const isTotal = idx === all.length - 1;
            const values = trend.years.map((y) => row.perTahun[y] ?? 0);
            return (
              <tr key={row.label} className={isTotal ? 'bg-slate-50 font-bold' : 'hover:bg-slate-50 transition-colors'}>
                <td className="py-2.5 px-3.5 font-semibold text-slate-800">{row.label}</td>
                <td className="py-2.5 px-3.5 text-right font-mono tabular-nums text-slate-900">{row.total}</td>
                {values.map((n, i) => (
                  <td
                    key={trend.years[i]}
                    className={`py-2.5 px-3 text-right font-mono tabular-nums ${n ? 'text-slate-700' : 'text-slate-300'}`}
                  >
                    {n}
                  </td>
                ))}
                <td className="py-2 px-3.5">
                  <div className="flex justify-center">
                    <Sparkline
                      values={values}
                      color={isTotal ? '#16A34A' : '#2563EB'}
                      dashedTail={partial}
                      label={`${row.label}: ${trend.years.map((y, i) => `${y} ${values[i]}`).join(', ')}`}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const chart = (
    <TrendAreaChart
      className={layout === 'split' ? '' : 'mt-5'}
      title="Tren SLO Terbit per Tahun"
      years={trend.years}
      partialLast={partial}
      series={[
        { name: 'Pembangkit', color: '#2563EB', values: v.pembangkit },
        { name: 'Transmisi, Distribusi & Pemanfaatan', color: '#38BDF8', values: v.lainnya },
      ]}
    />
  );

  return (
    <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="font-display text-sm font-bold uppercase tracking-wide text-slate-900">
          Ringkasan SLO Terbit per Tahun
        </h3>
        {action}
      </div>
      {layout === 'split' ? (
        <div className="grid gap-5 xl:grid-cols-2 items-start">
          {table}
          {chart}
        </div>
      ) : (
        <>
          {table}
          {chart}
        </>
      )}
      {partial && (
        <p className="text-[11px] text-slate-500 mt-2">
          * Tahun berjalan (data sampai {fmtLong(today)}), garis putus-putus pada tren menandakan tahun belum penuh.
        </p>
      )}
    </div>
  );
}
