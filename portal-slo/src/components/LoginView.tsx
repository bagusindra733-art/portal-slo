import React, { useState } from 'react';
import {
  ShieldCheck,
  Zap,
  ArrowRight,
  FileSpreadsheet,
  UserCheck,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  Inspector,
  ORG,
  PORTAL_ACCOUNTS,
  PortalAccount,
  ROLE_LABELS,
  UserSession,
} from '../types/portal';

interface LoginViewProps {
  inspectors: Inspector[];
  onGoogleLogin: (account: PortalAccount) => Promise<void>;
  onPortalLogin: (session: UserSession) => void;
  googleLoading: boolean;
  authError: string | null;
}

const GROUP_ORDER: PortalAccount['group'][] = [
  'Direktur',
  'Admin',
  'Marketing',
  'PJT',
  'Tenaga Teknik',
  'Klien',
];

export function LoginView({
  onGoogleLogin,
  onPortalLogin,
  googleLoading,
  authError,
}: LoginViewProps) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [showPass, setShowPass] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [googleAccountId, setGoogleAccountId] = useState<string>(PORTAL_ACCOUNTS[0].id);

  const selectedGoogleAccount =
    PORTAL_ACCOUNTS.find((a) => a.id === googleAccountId) || PORTAL_ACCOUNTS[0];

  const handleSelectQuickAccount = (acc: PortalAccount) => {
    setUsername(acc.username);
    setPassword(acc.password);
    setGoogleAccountId(acc.id);
    setLoginError(null);
  };

  const handlePortalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const u = username.trim().toLowerCase();
    const matched = PORTAL_ACCOUNTS.find(
      (a) => a.username.toLowerCase() === u && a.password === password
    );
    if (!matched) {
      setLoginError('Username atau password tidak sesuai. Periksa daftar akun di bawah.');
      return;
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
  };

  return (
    <div className="min-h-screen w-full bg-[#0B1221] text-white flex items-center justify-center p-4 md:p-8 relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full bg-blue-600/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-44 -right-32 w-[540px] h-[540px] rounded-full bg-emerald-500/15 blur-3xl"
      />

      <div className="relative z-10 w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 rounded-3xl overflow-hidden shadow-2xl border border-white/10 bg-[#101A2F]">
        {/* Left Branding & Credentials Directory */}
        <div className="lg:col-span-6 p-7 md:p-9 flex flex-col justify-between bg-gradient-to-br from-[#0F1B35] via-[#132242] to-[#0B1428] border-b lg:border-b-0 lg:border-r border-white/10">
          <div>
            <div className="flex items-center gap-3.5 mb-6">
              <div className="w-11 h-11 rounded-xl bg-white text-[#1E40AF] flex items-center justify-center shadow-lg">
                <Zap className="w-6 h-6 fill-amber-400 text-amber-500" />
              </div>
              <div>
                <div className="font-display font-extrabold text-xl tracking-tight text-white">
                  PORTAL SLO
                </div>
                <div className="text-xs font-semibold tracking-wider text-sky-400 uppercase">
                  {ORG}
                </div>
              </div>
            </div>

            <h1 className="font-display text-2xl font-bold leading-snug text-white mb-2">
              Sistem Manajemen Uji Laik Operasi &amp; Dokumen Kerja
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed mb-5">
              Akses berbasis akun personal untuk 1 Direktur (Review Only), 1 Admin, 2 Marketing,
              2 Penanggung Jawab Teknik (PJT), dan 5 Tenaga Teknik (Leader &amp; Anggota terpilih) dengan sinkronisasi Google Sheets.
            </p>

            {/* Quick Credential Directory */}
            <div className="rounded-2xl bg-[#0B1428]/80 border border-white/10 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-sky-300 uppercase tracking-wider">
                  <KeyRound className="w-3.5 h-3.5" /> Daftar Akun (Klik untuk Isi Otomatis)
                </div>
                <span className="text-[10px] text-slate-400">Username / Password</span>
              </div>

              <div className="space-y-2.5 max-h-[310px] overflow-y-auto pr-1">
                {GROUP_ORDER.map((grp) => {
                  const groupAccounts = PORTAL_ACCOUNTS.filter((a) => a.group === grp);
                  const subtitle =
                    grp === 'Direktur'
                      ? '1 Orang — Review Semua Data (Read-Only)'
                      : grp === 'Admin'
                      ? '1 Orang — Tugas Input & Kelola Portal'
                      : grp === 'Marketing'
                      ? '2 Orang — Akses Sama'
                      : grp === 'PJT'
                      ? '2 Orang — Sesuai Nama & Bisa Jadi TTK'
                      : grp === 'Tenaga Teknik'
                      ? '5 Orang — Akses Leader & Anggota Terpilih'
                      : 'Pemohon SLO';
                  return (
                    <div key={grp} className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                        <span>{grp}</span>
                        <span>{subtitle}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {groupAccounts.map((acc) => {
                          const active =
                            username.trim().toLowerCase() === acc.username.toLowerCase();
                          return (
                            <button
                              key={acc.id}
                              type="button"
                              onClick={() => handleSelectQuickAccount(acc)}
                              className={`text-left px-2.5 py-2 rounded-lg border transition cursor-pointer ${
                                active
                                  ? 'bg-blue-600/30 border-sky-400 text-white'
                                  : 'bg-white/[0.04] border-white/10 text-slate-200 hover:bg-white/[0.09]'
                              }`}
                            >
                              <div className="text-[11px] font-bold truncate">{acc.name}</div>
                              <div className="text-[10px] font-mono text-sky-300 mt-0.5">
                                {acc.username} / {acc.password}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2.5">
            <div className="rounded-xl bg-[#16233E]/90 border border-white/10 p-3 flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0" />
              <div className="text-[11px] text-slate-300 leading-tight">
                Kontrol Sertifikat &amp; TTE Terverifikasi
              </div>
            </div>
            <div className="rounded-xl bg-[#16233E]/90 border border-white/10 p-3 flex items-center gap-2.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="text-[11px] text-slate-300 leading-tight">
                Database Google Sheets Real-Time
              </div>
            </div>
          </div>
        </div>

        {/* Right Login Form Panel */}
        <div className="lg:col-span-6 bg-[#F8FAFC] text-slate-900 p-7 md:p-10 flex flex-col justify-center">
          <div className="max-w-md w-full mx-auto">
            <h2 className="font-display text-2xl font-bold text-slate-900 mb-1">
              Masuk ke Portal SLO
            </h2>
            <p className="text-sm text-slate-500 mb-5">
              Masukkan username dan password akun Anda atau hubungkan dengan Google.
            </p>

            {(authError || loginError) && (
              <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs font-medium text-red-700">
                {loginError || authError}
              </div>
            )}

            {/* Username & Password Login Form */}
            <form onSubmit={handlePortalSubmit} className="space-y-3.5">
              <div>
                <label
                  htmlFor="login-username"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1"
                >
                  Username
                </label>
                <input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Contoh: admin, marketing1, kusno, bagus"
                  required
                  className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-mono text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password"
                    required
                    className="w-full h-10 rounded-xl border border-slate-200 bg-white pl-3.5 pr-10 text-sm font-mono text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                    aria-label="Tampilkan atau sembunyikan password"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full h-11 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white font-semibold text-sm shadow-md shadow-blue-600/25 hover:brightness-105 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <UserCheck className="w-4 h-4" />
                <span>Masuk dengan Username &amp; Password</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#F8FAFC] px-3 text-slate-400 font-medium">
                  Atau masuk dengan Google (Sheets)
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label
                  htmlFor="login-google-account"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5"
                >
                  Akun Portal untuk Sesi Google
                </label>
                <select
                  id="login-google-account"
                  value={googleAccountId}
                  onChange={(e) => setGoogleAccountId(e.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800"
                >
                  {PORTAL_ACCOUNTS.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.group} — {acc.name} ({ROLE_LABELS[acc.role]})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => onGoogleLogin(selectedGoogleAccount)}
                disabled={googleLoading}
                className="gsi-material-button"
              >
                <div className="gsi-material-button-state" />
                <div className="gsi-material-button-content-wrapper">
                  <div className="gsi-material-button-icon">
                    <svg
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                      style={{ display: 'block' }}
                    >
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      />
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      />
                      <path fill="none" d="M0 0h48v48H0z" />
                    </svg>
                  </div>
                  <span className="gsi-material-button-contents">
                    {googleLoading ? 'Menghubungkan Akun Google...' : 'Sign in with Google'}
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
