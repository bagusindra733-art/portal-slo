import { useEffect, useMemo, useState } from 'react';
import { Copy, KeyRound, Pencil, Plus, RefreshCw, UserCheck, UserX, X } from 'lucide-react';
import {
  ManagedAccount,
  listAccounts,
  resetAccountPassword,
  saveAccount,
} from '../services/accountApi';
import { DOC_CONFIG } from '../types/portal';

const ROLE_OPTIONS: { value: ManagedAccount['role']; label: string }[] = [
  { value: 'direktur', label: 'Direktur' },
  { value: 'teknis', label: 'Admin Teknis' },
  { value: 'sales', label: 'Marketing' },
  { value: 'pjt', label: 'PJT' },
  { value: 'inspektor', label: 'Tenaga Teknik' },
];
const ROLE_LABEL = Object.fromEntries(ROLE_OPTIONS.map((r) => [r.value, r.label])) as Record<string, string>;

const INPUT =
  'w-full h-9 rounded-lg border border-slate-200 bg-slate-50/80 px-3 text-xs text-slate-800 focus:bg-white focus:border-violet-400 outline-none';

interface Props {
  inspectors: { id: string; nama: string }[];
  currentUsername?: string;
  onToast: (msg: string) => void;
}

type Draft = ManagedAccount & { password: string };
const emptyDraft = (): Draft => ({
  username: '',
  nama: '',
  email: '',
  role: 'inspektor',
  inspectorId: '',
  pjtName: '',
  aktif: true,
  password: '',
});

export function KelolaAkun({ inspectors, currentUsername, onToast }: Props) {
  const [accounts, setAccounts] = useState<ManagedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<{ draft: Draft; isNew: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<{ username: string; password: string } | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setAccounts(await listAccounts());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat akun.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) =>
      [a.username, a.nama, a.email, ROLE_LABEL[a.role]].some((v) => (v || '').toLowerCase().includes(q))
    );
  }, [accounts, query]);

  const submit = async () => {
    if (!editing) return;
    const { draft, isNew } = editing;
    if (!draft.username.trim() || !draft.nama.trim()) {
      onToast('Username dan Nama wajib diisi');
      return;
    }
    if (isNew && draft.password.length < 8) {
      onToast('Password awal minimal 8 karakter');
      return;
    }
    setBusy(true);
    try {
      await saveAccount(
        { ...draft, username: draft.username.trim().toLowerCase(), nama: draft.nama.trim() },
        isNew
      );
      onToast(isNew ? `Akun "${draft.username}" dibuat` : `Akun "${draft.username}" diperbarui`);
      setEditing(null);
      await load();
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Gagal menyimpan akun');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (a: ManagedAccount) => {
    const next = !a.aktif;
    if (!window.confirm(`${next ? 'Aktifkan' : 'Nonaktifkan'} akun "${a.username}"?`)) return;
    try {
      await saveAccount({ ...a, aktif: next }, false);
      onToast(`Akun "${a.username}" ${next ? 'diaktifkan' : 'dinonaktifkan'}`);
      await load();
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Gagal mengubah status akun');
    }
  };

  const reset = async (a: ManagedAccount) => {
    if (!window.confirm(`Reset password "${a.username}"? Password lama tidak berlaku lagi dan pengguna akan keluar dari sesinya.`)) return;
    try {
      const password = await resetAccountPassword(a.username);
      setRevealed({ username: a.username, password });
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Gagal mereset password');
    }
  };

  const set = (patch: Partial<Draft>) => setEditing((cur) => (cur ? { ...cur, draft: { ...cur.draft, ...patch } } : cur));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari username, nama, atau peran…"
          className={`${INPUT} max-w-xs`}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Muat ulang
          </button>
          <button
            type="button"
            onClick={() => setEditing({ draft: emptyDraft(), isNew: true })}
            className="inline-flex items-center gap-1.5 px-4 h-9 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Tambah Akun
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs p-3">
          {error} Pastikan Apps Script sudah diperbarui dengan Code.gs terbaru dan di-deploy ulang (versi baru).
        </div>
      )}

      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-100">
              <th className="py-3 px-4 font-semibold">Username</th>
              <th className="py-3 px-4 font-semibold">Nama</th>
              <th className="py-3 px-4 font-semibold">Peran</th>
              <th className="py-3 px-4 font-semibold">Status</th>
              <th className="py-3 px-4 font-semibold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  Memuat akun…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  Tidak ada akun.
                </td>
              </tr>
            )}
            {filtered.map((a) => (
              <tr key={a.username} className={a.aktif ? '' : 'bg-slate-50/70 text-slate-400'}>
                <td className="py-3 px-4 font-mono">
                  {a.username}
                  {a.username === currentUsername && (
                    <span className="ml-2 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-semibold">Anda</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <div className="font-semibold text-slate-800">{a.nama}</div>
                  <div className="text-xs text-slate-500">{a.email || '-'}</div>
                </td>
                <td className="py-3 px-4">{ROLE_LABEL[a.role] || a.role}</td>
                <td className="py-3 px-4">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                      a.aktif
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                  >
                    {a.aktif ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      title="Ubah"
                      onClick={() => setEditing({ draft: { ...a, password: '' }, isNew: false })}
                      className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Reset password"
                      onClick={() => void reset(a)}
                      className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                    </button>
                    {a.username !== currentUsername && (
                      <button
                        type="button"
                        title={a.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                        onClick={() => void toggleActive(a)}
                        className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer"
                      >
                        {a.aktif ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Akun dinonaktifkan tidak bisa login dan sesinya langsung berakhir. Akun tidak dihapus agar riwayat tetap utuh.
      </p>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl p-5 space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-slate-900">
                {editing.isNew ? 'Tambah Akun' : `Ubah Akun: ${editing.draft.username}`}
              </h3>
              <button type="button" onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-slate-700 space-y-1 block">
                Username
                <input
                  type="text"
                  value={editing.draft.username}
                  disabled={!editing.isNew}
                  onChange={(e) => set({ username: e.target.value })}
                  placeholder="contoh: budi.santoso"
                  className={`${INPUT} font-mono disabled:opacity-60`}
                />
              </label>
              <label className="text-xs font-semibold text-slate-700 space-y-1 block">
                Nama Lengkap
                <input type="text" value={editing.draft.nama} onChange={(e) => set({ nama: e.target.value })} className={INPUT} />
              </label>
              <label className="text-xs font-semibold text-slate-700 space-y-1 block sm:col-span-2">
                Email
                <input type="email" value={editing.draft.email} onChange={(e) => set({ email: e.target.value })} className={INPUT} />
              </label>
              <label className="text-xs font-semibold text-slate-700 space-y-1 block">
                Peran
                <select
                  value={editing.draft.role}
                  onChange={(e) => set({ role: e.target.value as ManagedAccount['role'] })}
                  className={INPUT}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              {editing.isNew && (
                <label className="text-xs font-semibold text-slate-700 space-y-1 block">
                  Password Awal (min. 8 karakter)
                  <input
                    type="text"
                    value={editing.draft.password}
                    onChange={(e) => set({ password: e.target.value })}
                    className={`${INPUT} font-mono`}
                  />
                </label>
              )}
              {(editing.draft.role === 'inspektor' || editing.draft.role === 'pjt') && (
                <label className="text-xs font-semibold text-slate-700 space-y-1 block sm:col-span-2">
                  Terhubung ke Personel (data TTK / sertifikat)
                  <select
                    value={editing.draft.inspectorId || ''}
                    onChange={(e) => set({ inspectorId: e.target.value })}
                    className={INPUT}
                  >
                    <option value="">— Tidak terhubung —</option>
                    {inspectors.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.nama}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {editing.draft.role === 'pjt' && (
                <label className="text-xs font-semibold text-slate-700 space-y-1 block sm:col-span-2">
                  Nama PJT (dipakai di proyek)
                  <select
                    value={editing.draft.pjtName || ''}
                    onChange={(e) => set({ pjtName: e.target.value })}
                    className={INPUT}
                  >
                    <option value="">— Sama dengan nama akun —</option>
                    {DOC_CONFIG.pjt.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void submit()}
                className="px-4 h-9 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold disabled:opacity-60 cursor-pointer"
              >
                {busy ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {revealed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-5 space-y-3">
            <h3 className="font-display text-base font-bold text-slate-900">Password Baru</h3>
            <p className="text-xs text-slate-600">
              Salin dan sampaikan ke <b>{revealed.username}</b>. Password ini hanya tampil sekali dan tidak bisa dilihat lagi.
              Sarankan pengguna segera menggantinya lewat ikon kunci di sidebar.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-slate-100 px-3 py-2 font-mono text-sm text-slate-900 select-all">
                {revealed.password}
              </code>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(revealed.password);
                  onToast('Password disalin');
                }}
                className="p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
                title="Salin"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setRevealed(null)}
                className="px-4 h-9 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
