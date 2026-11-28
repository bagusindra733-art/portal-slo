import { useState, type ReactElement } from 'react';
import { ArrowLeft } from 'lucide-react';
import { TaggingFoto } from './TaggingFoto';

type AppId = 'tagging-foto';

/** Ikon bergaya gambar teknik (blueprint): garis tipis, garis sumbu putus-putus, dan garis dimensi. */
function GambarTeknikKamera({ className = '' }: { className?: string }) {
  const line = '#FFFFFF';
  const axis = '#7DD3FC';
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Gambar teknik kamera">
      <defs>
        <clipPath id="gt-kamera-clip">
          <circle cx="32" cy="32" r="32" />
        </clipPath>
        <pattern id="gt-kamera-grid" width="4" height="4" patternUnits="userSpaceOnUse">
          <path d="M4 0H0V4" fill="none" stroke="#FFFFFF" strokeOpacity=".13" strokeWidth=".5" />
        </pattern>
      </defs>
      <g clipPath="url(#gt-kamera-clip)">
        <rect width="64" height="64" fill="#0F3D7A" />
        <rect width="64" height="64" fill="url(#gt-kamera-grid)" />

        {/* Garis sumbu (putus-putus) */}
        <g stroke={axis} strokeWidth=".7" strokeDasharray="4 1.5 1 1.5" fill="none">
          <path d="M32 8V50" />
          <path d="M8 34H56" />
        </g>

        {/* Badan kamera */}
        <g stroke={line} strokeWidth="1.2" strokeLinejoin="round" fill="none">
          <rect x="14" y="22" width="36" height="24" rx="2" />
          <path d="M24 22l3-5h10l3 5" />
          <rect x="17" y="25" width="5" height="3" />
          <circle cx="32" cy="34" r="8" />
          <circle cx="32" cy="34" r="5" strokeWidth=".8" />
        </g>
        <circle cx="32" cy="34" r="1.4" fill={line} />

        {/* Garis dimensi */}
        <g stroke={axis} strokeWidth=".7" fill="none">
          <path d="M14 47v7M50 47v7" />
          <path d="M14 52H50" />
        </g>
        <g fill={axis}>
          <path d="M14 52l3.5-1.4v2.8z" />
          <path d="M50 52l-3.5-1.4v2.8z" />
        </g>
      </g>
      <circle cx="32" cy="32" r="31.5" fill="none" stroke="#FFFFFF" strokeOpacity=".35" strokeWidth="1" />
    </svg>
  );
}


const APPS: {
  id: AppId;
  name: string;
  desc: string;
  /** Ikon bergaya gambar teknik (sudah berbentuk lingkaran) */
  Art: (props: { className?: string }) => ReactElement;
}[] = [
  {
    id: 'tagging-foto',
    name: 'tagging foto.',
    desc: 'jam, tanggal & lokasi pada foto',
    Art: GambarTeknikKamera,
  },
];

export function AplikasiMenu() {
  const [openApp, setOpenApp] = useState<AppId | null>(null);
  const current = APPS.find((a) => a.id === openApp);

  if (current) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setOpenApp(null)}
          className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Aplikasi
        </button>
        <div className="flex items-center gap-2.5">
          <current.Art className="w-10 h-10 shrink-0" />
          <h2 className="font-display font-extrabold text-lg text-slate-900 tracking-tight">{current.name.replace(/\.$/, '')}</h2>
        </div>
        {current.id === 'tagging-foto' && <TaggingFoto />}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs p-6 md:p-8">
      <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
        {APPS.map((app) => (
          <button
            key={app.id}
            type="button"
            onClick={() => setOpenApp(app.id)}
            className="group flex items-center gap-4 text-left cursor-pointer rounded-2xl p-2 -m-2 hover:bg-slate-50 transition-colors"
          >
            <app.Art className="w-16 h-16 shrink-0 transition-transform group-hover:scale-105" />
            <span className="min-w-0">
              <span className="block font-display font-extrabold text-[15px] text-slate-900 leading-tight">
                {app.name}
              </span>
              <span className="block mt-0.5 text-[13px] text-slate-500 leading-snug">{app.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
