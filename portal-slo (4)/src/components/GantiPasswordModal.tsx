import { FormEvent, useState } from 'react';
import { X } from 'lucide-react';
import { changeOwnPassword } from '../services/accountApi';

const INPUT =
  'w-full h-10 rounded-lg border border-slate-200 bg-slate-50/80 px-3 text-sm text-slate-800 focus:bg-white focus:border-violet-400 outline-none';

export function GantiPasswordModal({ onClose, onToast }: { onClose: () => void; onToast: (m: string) => void }) {
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPw.length < 8) return setError('Password baru minimal 8 karakter.');
    if (newPw !== confirmPw) return setError('Konfirmasi password tidak sama.');
    if (newPw === oldPw) return setError('Password baru harus berbeda dari password lama.');
    setBusy(true);
    try {
      await changeOwnPassword(oldPw, newPw);
      onToast('Password berhasil diganti');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengganti password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-5 space-y-3 text-slate-900">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-bold">Ganti Password</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <label className="block text-xs font-semibold text-slate-700 space-y-1">
          Password Lama
          <input type="password" autoComplete="current-password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} className={INPUT} />
        </label>
        <label className="block text-xs font-semibold text-slate-700 space-y-1">
          Password Baru (min. 8 karakter)
          <input type="password" autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className={INPUT} />
        </label>
        <label className="block text-xs font-semibold text-slate-700 space-y-1">
          Ulangi Password Baru
          <input type="password" autoComplete="new-password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className={INPUT} />
        </label>
        {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer">
            Batal
          </button>
          <button type="submit" disabled={busy || !oldPw || !newPw} className="px-4 h-9 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold disabled:opacity-60 cursor-pointer">
            {busy ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </form>
    </div>
  );
}
