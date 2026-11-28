import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Lock, User } from 'lucide-react';
import { Inspector, UserSession } from '../types/portal';
import { verifyLogin } from '../services/accountApi';

interface LoginViewProps {
  inspectors: Inspector[];
  onPortalLogin: (session: UserSession) => void;
  authError: string | null;
}

const REMEMBER_KEY = 'portal-slo-remember-user';

const fieldWrap =
  'flex items-center gap-2.5 h-12 rounded-xl border border-transparent bg-slate-100 px-3.5 text-slate-800 transition focus-within:border-yellow-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-yellow-400/25';
const fieldInput =
  'flex-1 min-w-0 bg-transparent text-sm text-slate-900 placeholder-slate-500 outline-none';

export function LoginView({ onPortalLogin, authError }: LoginViewProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        setUsername(saved);
        setRemember(true);
      }
    } catch {
      /* penyimpanan browser tidak tersedia: abaikan */
    }
  }, []);

  const handlePortalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const matched = await verifyLogin(username.trim(), password);
      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, matched.username);
        else localStorage.removeItem(REMEMBER_KEY);
      } catch {
        /* abaikan */
      }
      onPortalLogin({
        mode: 'portal',
        username: matched.username,
        name: matched.name,
        email: matched.email,
        role: matched.role,
        inspectorId: matched.inspectorId,
        pjtName: matched.pjtName,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal masuk. Coba lagi.');
    } finally {
      setBusy(false);
    }
  };

  const shownError = error || authError;

  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center bg-[#EEF2F7] p-4 font-sans">
      <div className="w-full max-w-[380px] rounded-2xl border border-slate-200 bg-white px-6 py-7 sm:px-8 sm:py-8">
        <h1 className="font-display text-2xl font-bold tracking-[-0.01em] text-slate-900">
          Masuk ke Portal SLO
        </h1>
        <p className="mb-6 mt-2 text-base text-slate-600">
          Gunakan username dan password dari Admin.
        </p>

        {shownError && (
          <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">
            {shownError}
          </div>
        )}
        {info && (
          <div role="status" className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-sm font-medium text-sky-800">
            {info}
          </div>
        )}

        <form onSubmit={handlePortalSubmit} className="space-y-3.5" autoComplete="on">
          <div>
            <label htmlFor="login-username" className="mb-1.5 block text-sm font-semibold text-slate-700">
              Username
            </label>
            <div className={fieldWrap}>
              <User className="h-4 w-4 shrink-0 text-slate-500" />
              <input
                id="login-username"
                type="text"
                name="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username"
                autoComplete="username"
                autoCapitalize="none"
                required
                className={fieldInput}
              />
            </div>
          </div>

          <div>
            <label htmlFor="login-password" className="mb-1.5 block text-sm font-semibold text-slate-700">
              Password
            </label>
            <div className={fieldWrap}>
              <Lock className="h-4 w-4 shrink-0 text-slate-500" />
              <input
                id="login-password"
                type={showPass ? 'text' : 'password'}
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                autoComplete="current-password"
                required
                className={fieldInput}
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? 'Sembunyikan password' : 'Tampilkan password'}
                aria-pressed={showPass}
                className="shrink-0 cursor-pointer text-slate-500 hover:text-slate-700"
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <label className="flex cursor-pointer select-none items-center gap-2 text-slate-700">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 accent-[#0F1E3D]"
              />
              Ingat saya
            </label>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setInfo('Untuk reset password, hubungi Admin Teknis PT. Sabda Duta Paramitha.');
              }}
              className="cursor-pointer font-semibold text-[#1E3A8A] hover:underline"
            >
              Lupa password?
            </button>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="flex h-12 w-full cursor-pointer items-center justify-center rounded-xl bg-yellow-400 text-sm font-bold text-[#0F1E3D] transition hover:bg-yellow-300 active:scale-[0.99] disabled:opacity-60"
          >
            {busy ? 'Memeriksa...' : 'Masuk'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-600">
          Akun dikelola Admin Teknis. Belum punya akun? Hubungi admin.
        </p>
      </div>
      <p className="mt-4 text-center text-xs text-slate-500">
        Design by <span className="font-semibold text-slate-600">Bagus Indra</span>
      </p>
    </div>
  );
}
