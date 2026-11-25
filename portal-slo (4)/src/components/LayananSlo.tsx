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
} from 'lucide-react';

type Layanan = { id: string; label: string; sub?: string; icon: LucideIcon };

const GROUPS: { title: string; subtitle: string; accent: string; items: Layanan[] }[] = [
  {
    title: 'Pemeriksaan dan Pengujian',
    subtitle: 'Verifikasi, pengerjaan lapangan, pengesahan & evaluasi LIT',
    accent: 'from-[#2563EB] to-[#3B82F6]',
    items: [
      { id: 'verifikasi-lit', label: 'Verifikasi LIT', icon: UserCheck },
      { id: 'pengerjaan-tt', label: 'Pengerjaan TT', icon: Wrench },
      { id: 'pengesahan-pjt', label: 'Pengesahan PJT', icon: ClipboardCheck },
      { id: 'evaluasi-lit', label: 'Evaluasi LIT', icon: FileSearch },
    ],
  },
  {
    title: 'Registrasi SLO',
    subtitle: 'Evaluasi DJK dari persiapan hingga persetujuan',
    accent: 'from-[#6366F1] to-[#4F46E5]',
    items: [
      { id: 'djk-prepare', label: 'Evaluasi DJK', sub: 'Prepare', icon: CalendarPlus },
      { id: 'djk-review-1', label: 'Evaluasi DJK', sub: 'Review 1', icon: CalendarClock },
      { id: 'djk-review-2', label: 'Evaluasi DJK', sub: 'Review 2', icon: CalendarRange },
      { id: 'djk-approve', label: 'Evaluasi DJK', sub: 'Approve', icon: CalendarCheck },
    ],
  },
  {
    title: 'Penerbitan SLO',
    subtitle: 'Pembuatan, pencetakan & daftar SLO terbit',
    accent: 'from-[#0284C7] to-[#38BDF8]',
    items: [
      { id: 'generate-slo', label: 'Generate SLO', icon: FileCog },
      { id: 'cetak-slo', label: 'Cetak SLO', icon: Printer },
      { id: 'slo-terbit', label: 'SLO Terbit', icon: BadgeCheck },
    ],
  },
];

/** Menu Layanan SLO — halaman tiap layanan belum tersedia, klik menampilkan pesan "masih dalam perbaikan". */
export function LayananSlo({ onToast }: { onToast: (msg: string) => void }) {
  return (
    <div className="space-y-5">
      {GROUPS.map((group) => (
        <section key={group.title} className="rounded-2xl bg-white border border-slate-200/80 shadow-xs p-5 md:p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className={`w-1.5 h-9 rounded-full bg-gradient-to-b ${group.accent}`} />
            <div className="min-w-0">
              <h3 className="font-display text-sm font-bold uppercase tracking-wide text-slate-900">
                {group.title}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">{group.subtitle}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {group.items.map((item) => {
              const Icon = item.icon;
              const name = item.sub ? `${item.label} (${item.sub})` : item.label;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onToast(`${name} — masih dalam perbaikan`)}
                  className="group flex items-center gap-3.5 text-left rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 hover:bg-white hover:border-blue-300 hover:shadow-md hover:shadow-blue-600/10 transition cursor-pointer"
                >
                  <span
                    className={`w-11 h-11 rounded-xl bg-gradient-to-br ${group.accent} flex items-center justify-center shadow-sm shrink-0 transition-transform group-hover:scale-105`}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display font-extrabold text-[14px] text-slate-900 leading-tight">
                      {item.label}
                    </span>
                    {item.sub && (
                      <span className="block mt-0.5 text-xs font-semibold text-blue-700">{item.sub}</span>
                    )}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 shrink-0 transition-colors" />
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
