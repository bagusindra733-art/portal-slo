import React, { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Lock, Mail, User, UserPlus, Zap } from 'lucide-react';
import { ORG, Inspector, UserSession } from '../types/portal';
import {
  authErrorMessage,
  emailSignIn,
  emailSignUp,
  getAuthProfile,
  resolveLoginEmail,
  sendResetEmail,
} from '../services/auth';

interface LoginViewProps {
  inspectors?: Inspector[];
  onGoogleLogin: () => Promise<void>;
  onPortalLogin: (session: UserSession) => void;
  googleLoading: boolean;
  authError: string | null;
}

type Mode = 'login' | 'signup' | 'forgot';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputWrap =
  'flex items-center gap-2.5 h-12 rounded-xl border border-white/20 bg-white/[0.06] px-3.5 text-white focus-within:border-sky-400 focus-within:bg-white/10 transition';
const inputCls =
  'flex-1 min-w-0 bg-transparent text-sm text-white placeholder-slate-400 outline-none';

export function LoginView({ onGoogleLogin, onPortalLogin, googleLoading, authError }: LoginViewProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setInfo(null);
    setPassword('');
    setConfirm('');
    setShowPass(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const loginEmail = resolveLoginEmail(identifier);
      if (!EMAIL_RE.test(loginEmail)) {
        setError('Username/email atau password tidak sesuai.');
        return;
      }
      const user = await emailSignIn(loginEmail, password);
      const profile = await getAuthProfile(user);
      onPortalLogin({
        mode: 'portal',
        username: profile.username,
        name: user.displayName || user.email || 'Pengguna',
        email: user.email || '',
        role: profile.role,
        inspectorId: profile.inspectorId,
        pjtName: profile.pjtName,
      });
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (name.trim().length < 3) return setError('Nama lengkap minimal 3 karakter.');
    if (!EMAIL_RE.test(email.trim())) return setError('Format email tidak valid.');
    if (password.length < 8) return setError('Password minimal 8 karakter.');
    if (password !== confirm) return setError('Konfirmasi password tidak sama.');
    setBusy(true);
    try {
      await emailSignUp(name.trim(), email.trim(), password);
      setIdentifier(email.trim());
      switchMode('login');
      setInfo('Akun berhasil dibuat. Silakan masuk.');
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!EMAIL_RE.test(email.trim())) return setError('Masukkan email yang valid.');
    setBusy(true);
    try {
      await sendResetEmail(email.trim());
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code !== 'auth/user-not-found') {
        setError(authErrorMessage(err));
        setBusy(false);
        return;
      }
    }
    // Pesan sama baik email terdaftar maupun tidak, agar email orang lain tidak bisa ditebak
    setInfo('Jika email terdaftar, tautan reset password sudah dikirim. Cek kotak masuk atau folder spam.');
    setBusy(false);
  };

  const shownError = error || authError;

  return (
    <div className="relative min-h-dvh w-full overflow-x-hidden flex items-center justify-center px-4 py-8 font-[Poppins,system-ui,sans-serif]">
      {/* Latar seragam dengan dasbor */}
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-[#0F1B35] via-[#0B1221] to-[#0B1428]" />
      <div aria-hidden="true" className="pointer-events-none absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-blue-600/25 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-44 -right-32 h-[540px] w-[540px] rounded-full bg-sky-400/15 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute top-1/2 left-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative z-10 w-full max-w-[380px] rounded-[28px] border border-white/15 bg-white/[0.07] p-6 sm:p-8 text-white shadow-2xl backdrop-blur-xl">
        <div className="mb-5 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white shadow">
            <Zap className="h-5 w-5 fill-amber-400 text-amber-500" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-wide">PORTAL SLO</div>
            <div className="text-[10px] uppercase tracking-wider text-white/80">{ORG}</div>
          </div>
        </div>

        {mode !== 'login' && (
          <button
            type="button"
            onClick={() => switchMode('login')}
            className="mb-3 -mt-1 inline-flex items-center gap-1.5 text-xs text-white/90 hover:text-white cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Login
          </button>
        )}

        <h1 className="text-3xl font-semibold leading-tight">
          {mode === 'login' ? 'Login' : mode === 'signup' ? 'Sign Up' : 'Lupa Password'}
        </h1>
        <p className="mt-1 mb-5 text-xs text-white/90">
          {mode === 'login' && 'Selamat datang kembali, silakan login ke akun Anda'}
          {mode === 'signup' && 'Buat akun Klien untuk mengajukan dan memantau SLO'}
          {mode === 'forgot' && 'Masukkan email akun Anda, kami kirim tautan untuk reset password'}
        </p>

        {shownError && (
          <div role="alert" className="mb-3 rounded-xl border border-red-200/70 bg-red-500/30 px-3.5 py-2.5 text-xs font-medium">
            {shownError}
          </div>
        )}
        {info && (
          <div role="status" className="mb-3 rounded-xl border border-emerald-200/70 bg-emerald-500/30 px-3.5 py-2.5 text-xs font-medium">
            {info}
          </div>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-3.5" autoComplete="on">
            <label className={inputWrap}>
              <input
                type="text"
                name="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Username atau Email"
                autoComplete="username"
                autoCapitalize="none"
                required
                className={inputCls}
              />
              <User className="h-4 w-4 shrink-0 text-white/80" />
            </label>
            <label className={inputWrap}>
              <input
                type={showPass ? 'text' : 'password'}
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                required
                className={inputCls}
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                aria-label="Tampilkan atau sembunyikan password"
                className="shrink-0 text-white/80 hover:text-white cursor-pointer"
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </label>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-3.5 w-3.5 accent-blue-500"
                />
                Remember me
              </label>
              <button type="button" onClick={() => switchMode('forgot')} className="underline-offset-2 hover:underline cursor-pointer">
                Lupa password?
              </button>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="h-12 w-full rounded-xl bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-sm font-semibold text-white shadow-lg transition hover:brightness-110 disabled:opacity-60 cursor-pointer"
            >
              {busy ? 'Memproses...' : 'Login'}
            </button>

            <div className="flex items-center gap-3 text-[11px] text-white/80">
              <span className="h-px flex-1 bg-white/40" /> atau <span className="h-px flex-1 bg-white/40" />
            </div>

            <button
              type="button"
              onClick={() => void onGoogleLogin()}
              disabled={googleLoading}
              className="gsi-material-button"
            >
              <div className="gsi-material-button-state" />
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon">
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    <path fill="none" d="M0 0h48v48H0z" />
                  </svg>
                </div>
                <span className="gsi-material-button-contents">
                  {googleLoading ? 'Menghubungkan Google...' : 'Masuk dengan Google'}
                </span>
              </div>
            </button>

            <p className="pt-1 text-center text-xs">
              Belum punya akun?{' '}
              <button type="button" onClick={() => switchMode('signup')} className="font-bold hover:underline cursor-pointer">
                Sign Up
              </button>
            </p>
          </form>
        )}

        {mode === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-3.5" autoComplete="on">
            <label className={inputWrap}>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama Lengkap"
                autoComplete="name"
                required
                className={inputCls}
              />
              <User className="h-4 w-4 shrink-0 text-white/80" />
            </label>
            <label className={inputWrap}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                autoComplete="email"
                autoCapitalize="none"
                required
                className={inputCls}
              />
              <Mail className="h-4 w-4 shrink-0 text-white/80" />
            </label>
            <label className={inputWrap}>
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (min. 8 karakter)"
                autoComplete="new-password"
                required
                className={inputCls}
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                aria-label="Tampilkan atau sembunyikan password"
                className="shrink-0 text-white/80 hover:text-white cursor-pointer"
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </label>
            <label className={inputWrap}>
              <input
                type={showPass ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Ulangi Password"
                autoComplete="new-password"
                required
                className={inputCls}
              />
              <Lock className="h-4 w-4 shrink-0 text-white/80" />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-sm font-semibold text-white shadow-lg transition hover:brightness-110 disabled:opacity-60 cursor-pointer"
            >
              <UserPlus className="h-4 w-4" />
              {busy ? 'Memproses...' : 'Daftar'}
            </button>
            <p className="pt-1 text-center text-xs">
              Sudah punya akun?{' '}
              <button type="button" onClick={() => switchMode('login')} className="font-bold hover:underline cursor-pointer">
                Login
              </button>
            </p>
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={handleForgot} className="space-y-3.5">
            <label className={inputWrap}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email terdaftar"
                autoComplete="email"
                autoCapitalize="none"
                required
                className={inputCls}
              />
              <Mail className="h-4 w-4 shrink-0 text-white/80" />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="h-12 w-full rounded-xl bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-sm font-semibold text-white shadow-lg transition hover:brightness-110 disabled:opacity-60 cursor-pointer"
            >
              {busy ? 'Mengirim...' : 'Kirim Tautan Reset'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
