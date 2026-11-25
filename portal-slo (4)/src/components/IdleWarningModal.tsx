import { Clock } from 'lucide-react';

interface IdleWarningModalProps {
  secondsLeft: number;
  onStay: () => void;
  onLogout: () => void;
}

export function IdleWarningModal({ secondsLeft, onStay, onLogout }: IdleWarningModalProps) {
  return (
    <div className="no-print fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="idle-title"
        aria-describedby="idle-desc"
        className="w-full max-w-sm rounded-2xl bg-white p-5 text-slate-900 shadow-xl space-y-3"
      >
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-500" aria-hidden="true" />
          <h3 id="idle-title" className="font-display text-base font-bold">
            Sesi akan berakhir
          </h3>
        </div>
        <p id="idle-desc" className="text-sm text-slate-600">
          Anda tidak aktif beberapa saat. Demi keamanan data, Anda akan keluar otomatis dalam{' '}
          <span className="font-bold text-slate-900">{secondsLeft} detik</span>.
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onLogout}
            className="px-4 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
          >
            Keluar Sekarang
          </button>
          <button
            type="button"
            autoFocus
            onClick={onStay}
            className="px-4 h-9 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold cursor-pointer"
          >
            Tetap Masuk
          </button>
        </div>
      </div>
    </div>
  );
}
