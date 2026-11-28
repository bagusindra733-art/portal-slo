/** Grafik garis mini (dipakai ringkasan SLO Terbit). */
export function Sparkline({
  values,
  color,
  dashedTail = false,
  label,
}: {
  values: number[];
  color: string;
  /** Segmen terakhir digambar putus-putus (mis. tahun berjalan yang belum penuh). */
  dashedTail?: boolean;
  /** Teks alternatif / tooltip. */
  label?: string;
}) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const pt = (v: number, idx: number): [number, number] => [
    (idx / Math.max(values.length - 1, 1)) * 68 + 4,
    20 - ((v - min) / span) * 14,
  ];
  const coords = values.map(pt);
  const toStr = (c: [number, number][]) => c.map(([x, y]) => `${x},${y}`).join(' ');
  const cut = dashedTail && coords.length > 2;

  return (
    <svg viewBox="0 0 76 24" className="w-18 h-6" role={label ? 'img' : undefined} aria-label={label}>
      {label && <title>{label}</title>}
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={toStr(cut ? coords.slice(0, -1) : coords)}
      />
      {cut && (
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="2 3"
          points={toStr(coords.slice(-2))}
        />
      )}
      {coords.map(([x, y], idx) => (
        <circle key={idx} cx={x} cy={y} r="1.8" fill={cut && idx === coords.length - 1 ? 'white' : color} stroke={color} strokeWidth="1" />
      ))}
    </svg>
  );
}
