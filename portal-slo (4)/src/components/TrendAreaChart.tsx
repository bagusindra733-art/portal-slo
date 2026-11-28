import { useId, useState } from 'react';

export interface TrendSeries {
  name: string;
  color: string;
  values: number[];
}

const W = 640;
const H = 250;
const PAD = { l: 38, r: 22, t: 14, b: 46 };

/** Kurva halus yang tidak melewati titik data (monotone cubic) → tidak ada nilai di bawah nol. */
function segments(pts: [number, number][]): string[] {
  const n = pts.length;
  if (n < 2) return [];
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((pts[i + 1][1] - pts[i][1]) / (pts[i + 1][0] - pts[i][0]));
  const m: number[] = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return pts.slice(0, -1).map(([x0, y0], i) => {
    const [x1, y1] = pts[i + 1];
    const dx = (x1 - x0) / 3;
    return `C${x0 + dx},${y0 + m[i] * dx} ${x1 - dx},${y1 - m[i + 1] * dx} ${x1},${y1}`;
  });
}

/** Batas sumbu-Y yang rapi (kelipatan 1/2/5 × 10^k), sekitar 4 garis bantu. */
function niceScale(max: number): { top: number; step: number } {
  if (max <= 0) return { top: 4, step: 1 };
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 5, 10].find((k) => k * pow >= raw) ?? 10) * pow;
  return { top: Math.ceil(max / step) * step, step };
}

/** Grafik area halus bergradien, legenda di kanan atas, titik penanda tahun di sumbu bawah. */
export function TrendAreaChart({
  years,
  series,
  partialLast = false,
  title,
  className = 'mt-5',
}: {
  years: number[];
  series: TrendSeries[];
  /** Tahun terakhir belum penuh → segmen terakhir putus-putus. */
  partialLast?: boolean;
  title?: string;
  className?: string;
}) {
  const uid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);
  const n = years.length;
  const active = hover ?? Math.max(0, n - 1);

  const { top, step } = niceScale(Math.max(...series.flatMap((s) => s.values), 0));
  const plotW = W - PAD.l - PAD.r;
  const base = H - PAD.b;
  const plotH = base - PAD.t;
  const inset = n > 1 ? 18 : 0;
  const xAt = (i: number) => (n > 1 ? PAD.l + inset + (i * (plotW - inset * 2)) / (n - 1) : PAD.l + plotW / 2);
  const yAt = (v: number) => base - (v / top) * plotH;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);

  const onMove = (clientX: number, el: SVGSVGElement) => {
    const r = el.getBoundingClientRect();
    const vx = ((clientX - r.left) / r.width) * W;
    let best = 0;
    for (let i = 1; i < n; i++) if (Math.abs(xAt(i) - vx) < Math.abs(xAt(best) - vx)) best = i;
    setHover(best);
  };

  const tipLeft = Math.min(Math.max((xAt(active) / W) * 100, 14), 86);

  return (
    <div className={`${className} rounded-2xl border border-slate-200/80 bg-white p-4 md:p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        {title && <h4 className="font-display text-sm font-bold text-slate-900">{title}</h4>}
        <ul className="flex items-center gap-4 ml-auto text-xs text-slate-500">
          {series.map((s) => (
            <li key={s.name} className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
              {s.name}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto touch-pan-y select-none"
          role="img"
          aria-label={`${title ?? 'Tren'}: ${years
            .map((y, i) => `${y} ${series.map((s) => `${s.name} ${s.values[i] ?? 0}`).join(', ')}`)
            .join('; ')}`}
          onMouseMove={(e) => onMove(e.clientX, e.currentTarget)}
          onMouseLeave={() => setHover(null)}
          onTouchStart={(e) => onMove(e.touches[0].clientX, e.currentTarget)}
          onTouchMove={(e) => onMove(e.touches[0].clientX, e.currentTarget)}
        >
          <defs>
            {series.map((s, k) => (
              <linearGradient key={s.name} id={`${uid}-g${k}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.34" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0.02" />
              </linearGradient>
            ))}
          </defs>

          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={yAt(t)} y2={yAt(t)} stroke="#E2E8F0" strokeDasharray={t === 0 ? undefined : '3 4'} />
              <text x={PAD.l - 10} y={yAt(t) + 4} textAnchor="end" fontSize="11" fill="#64748B">
                {t}
              </text>
            </g>
          ))}

          {n > 0 && (
            <line x1={xAt(active)} x2={xAt(active)} y1={PAD.t} y2={base} stroke="#94A3B8" strokeDasharray="3 4" opacity="0.7" />
          )}

          {series.map((s, k) => {
            const pts = s.values.map((v, i) => [xAt(i), yAt(v)] as [number, number]);
            const segs = segments(pts);
            if (!segs.length) return null;
            const solid = partialLast && segs.length > 1 ? segs.slice(0, -1) : segs;
            const tail = partialLast && segs.length > 1 ? segs[segs.length - 1] : null;
            const start = `M${pts[0][0]},${pts[0][1]}`;
            const lastPt = pts[pts.length - 1];
            return (
              <g key={s.name}>
                <path
                  d={`${start} ${segs.join(' ')} L${lastPt[0]},${base} L${pts[0][0]},${base} Z`}
                  fill={`url(#${uid}-g${k})`}
                />
                <path d={`${start} ${solid.join(' ')}`} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" />
                {tail && (
                  <path
                    d={`M${pts[pts.length - 2][0]},${pts[pts.length - 2][1]} ${tail}`}
                    fill="none"
                    stroke={s.color}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray="2 6"
                  />
                )}
                <circle cx={pts[active][0]} cy={pts[active][1]} r="5" fill="white" stroke={s.color} strokeWidth="2.5" />
              </g>
            );
          })}

          {years.map((y, i) => (
            <g key={y}>
              <circle
                cx={xAt(i)}
                cy={base}
                r={i === active ? 5.5 : 4.5}
                fill={i === active ? '#0F1E3D' : 'white'}
                stroke={i === active ? 'white' : '#CBD5E1'}
                strokeWidth={i === active ? 2 : 1.5}
              />
              <text
                x={xAt(i)}
                y={base + 26}
                textAnchor="middle"
                fontSize="12"
                fontWeight={i === active ? 700 : 400}
                fill={i === active ? '#0F172A' : '#64748B'}
              >
                {y}
                {partialLast && i === n - 1 ? '*' : ''}
              </text>
            </g>
          ))}
        </svg>

        {n > 0 && (
          <div
            className="pointer-events-none absolute top-1 -translate-x-1/2 rounded-xl bg-[#0F1E3D] text-white px-3 py-2 text-xs shadow-lg"
            style={{ left: `${tipLeft}%` }}
          >
            <div className="font-bold mb-0.5">
              {years[active]}
              {partialLast && active === n - 1 ? ' (berjalan)' : ''}
            </div>
            {series.map((s) => (
              <div key={s.name} className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                {s.name}: <b className="tabular-nums">{s.values[active] ?? 0}</b>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
