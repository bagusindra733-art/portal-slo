import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Lock, User } from 'lucide-react';
import { Inspector, ORG, UserSession } from '../types/portal';
import { verifyLogin } from '../services/accountApi';
import { FLOW_STEPS } from '../utils/portalUtils';

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
    <div className="flex h-dvh w-full items-center justify-center bg-[#0F1E3D] p-3 font-sans sm:p-5">
      <div className="grid h-full max-h-[680px] w-full max-w-[1040px] grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-3 rounded-[28px] bg-[#F8FAFC] p-3 shadow-2xl shadow-black/50 lg:grid-cols-[1.02fr_1fr] lg:grid-rows-1">
        {/* Panel kiri: alur kerja nyata yang dicakup portal */}
        <section
          aria-labelledby="login-alur"
          className="flex min-h-0 flex-col overflow-hidden rounded-[20px] bg-[#0F1E3D] px-6 py-5 text-white lg:px-9 lg:py-8"
        >
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-white px-2.5 py-1.5">
              <img src="/assets/logo-kiri.webp" alt="" className="h-7 w-auto lg:h-9" />
            </span>
            <span className="text-sm font-semibold text-white/90">{ORG}</span>
          </div>

          <h2
            id="login-alur"
            className="mt-4 font-display text-xl font-extrabold leading-tight tracking-tight sm:text-2xl lg:mt-8 lg:text-[2rem]"
          >
            Dari penawaran sampai SLO terbit, dalam satu portal.
          </h2>

          <ol className="mt-6 hidden min-h-0 flex-1 flex-col justify-center border-l border-white/15 lg:flex">
            {FLOW_STEPS.map((step, i) => (
              <li key={step.key} className="relative py-2 pl-6">
                <span
                  aria-hidden="true"
                  className="absolute -left-[13px] top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-yellow-400 text-xs font-bold text-[#0F1E3D]"
                >
                  {i + 1}
                </span>
                <div className="text-sm font-semibold leading-snug text-white">{step.label}</div>
                <div className="text-xs text-slate-300">{step.owner}</div>
              </li>
            ))}
          </ol>
        </section>

        {/* Form login */}
        <section className="flex min-h-0 flex-col justify-center overflow-y-auto px-3 py-4 sm:px-8 lg:px-10">
          <div className="mx-auto w-full max-w-[360px]">
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900">
              Masuk ke Portal SLO
            </h1>
            <p className="mb-5 mt-1.5 text-sm text-slate-600">
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

            <p className="mt-4 text-center text-xs text-slate-600">
              Akun dikelola Admin Teknis. Belum punya akun? Hubungi admin.
            </p>
            <p className="mt-1 text-center text-xs text-slate-500">
              Design by <span className="font-semibold text-slate-600">Bagus Indra</span>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
