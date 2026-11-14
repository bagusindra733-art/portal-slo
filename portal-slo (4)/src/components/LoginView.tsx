import React, { useEffect, useState } from 'react';
import { ChevronDown, Eye, EyeOff, KeyRound, Lock, User, Zap } from 'lucide-react';
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

const REMEMBER_KEY = 'portal-slo-remember-user';

/** Kawat transmisi (koordinat grup menara). Dipakai dua kali: kawat statis + aliran arus */
const WIRES = [
  'M208 174 Q 40 230 -120 190',
  'M392 174 Q 560 230 700 190',
  'M180 256 Q 20 316 -120 276',
  'M420 256 Q 580 316 700 276',
  'M150 346 Q -20 410 -120 360',
  'M450 346 Q 620 410 700 360',
];

/** Ilustrasi menara transmisi bertema listrik (SVG asli, tanpa gambar eksternal) */
function PowerScene() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 520 640"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
    >
      <defs>
        <radialGradient id="slo-glow" cx="50%" cy="42%" r="55%">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.38" />
          <stop offset="55%" stopColor="#2563EB" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#0B1221" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="slo-horizon" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="slo-bolt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
        <filter id="slo-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <filter id="slo-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>

        <g id="slo-tower" fill="none" stroke="#7DD3FC" strokeWidth="1.7" strokeLinejoin="round">
          {/* rangka utama */}
          <path d="M294 130 L288 210 L280 300 L262 420 L240 540" />
          <path d="M306 130 L312 210 L320 300 L338 420 L360 540" />
          <path d="M294 130H306 M288 210H312 M280 300H320 M262 420H338 M240 540H360" />
          <path d="M294 130 L312 210 M306 130 L288 210 M288 210 L320 300 M312 210 L280 300 M280 300 L338 420 M320 300 L262 420 M262 420 L360 540 M338 420 L240 540" />
          <path d="M300 96 L294 130 M300 96 L306 130" />
          {/* lengan */}
          <path d="M208 150H392 M208 150 L292 178 M392 150 L308 178 M208 150 L296 134 M392 150 L304 134" />
          <path d="M180 232H420 M180 232 L289 266 M420 232 L311 266 M180 232 L291 214 M420 232 L309 214" />
          <path d="M150 322H450 M150 322 L276 362 M450 322 L324 362 M150 322 L279 304 M450 322 L321 304" />
          {/* isolator */}
          <path d="M208 150V170 M392 150V170 M180 232V252 M420 232V252 M150 322V342 M450 322V342" />
          <g fill="#BAE6FD" stroke="none">
            <circle cx="208" cy="174" r="3" />
            <circle cx="392" cy="174" r="3" />
            <circle cx="180" cy="256" r="3" />
            <circle cx="420" cy="256" r="3" />
            <circle cx="150" cy="346" r="3" />
            <circle cx="450" cy="346" r="3" />
          </g>
        </g>
      </defs>

      <rect width="520" height="640" fill="#0B1221" />
      <rect width="520" height="640" fill="url(#slo-glow)" />

      {/* lantai grid perspektif */}
      <ellipse cx="260" cy="545" rx="300" ry="46" fill="url(#slo-horizon)" />
      <g stroke="#38BDF8" strokeWidth="1" opacity="0.28">
        {[552, 566, 586, 614].map((y) => (
          <path key={y} d={`M0 ${y}H520`} />
        ))}
        {[-260, -170, -80, 10, 100, 190, 260, 330, 420, 510, 600, 690, 780].map((x) => (
          <path key={x} d={`M260 540 L${x} 640`} />
        ))}
      </g>
      <path d="M0 540H520" stroke="#38BDF8" strokeWidth="1.5" opacity="0.5" />

      {/* menara jauh */}
      <g opacity="0.32">
        <use href="#slo-tower" transform="translate(-60 351) scale(0.35)" />
        <use href="#slo-tower" transform="translate(180 351) scale(0.35)" />
        <use href="#slo-tower" transform="translate(-130 378) scale(0.25)" />
        <use href="#slo-tower" transform="translate(255 378) scale(0.25)" />
      </g>

      {/* menara utama + kawat */}
      <g transform="translate(-40 0)">
        <g fill="none" stroke="#38BDF8" strokeWidth="1.4" opacity="0.65">
          {WIRES.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
        <g fill="none" stroke="#E0F2FE" strokeWidth="2" strokeLinecap="round">
          {WIRES.map((d, i) => (
            <path
              key={d}
              d={d}
              className="slo-flow"
              style={{ animationDelay: `${-(i % 3) * 0.5}s` }}
            />
          ))}
        </g>
        <use href="#slo-tower" />
        <circle cx="300" cy="96" r="3.5" fill="#E0F2FE" />
        <circle cx="300" cy="96" r="9" fill="#38BDF8" opacity="0.5" filter="url(#slo-soft)" className="slo-pulse" />
      </g>

      {/* busur listrik dari puncak menara */}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M260 96 L252 80 L266 66 L254 50 L268 34 L258 16"
          stroke="#38BDF8"
          strokeWidth="5"
          opacity="0.7"
          filter="url(#slo-soft)"
          className="slo-arc"
        />
        <path
          d="M260 96 L252 80 L266 66 L254 50 L268 34 L258 16"
          stroke="#F0F9FF"
          strokeWidth="1.8"
          className="slo-arc"
        />
        <path
          d="M260 96 L271 84 L262 70 L276 58 L268 44"
          stroke="#F0F9FF"
          strokeWidth="1.4"
          className="slo-arc slo-arc-b"
        />
      </g>

      {/* petir */}
      <g transform="translate(350 24) scale(0.5)">
        <polygon
          points="170,30 112,142 148,142 122,240 212,108 172,108 206,30"
          fill="#F59E0B"
          opacity="0.75"
          filter="url(#slo-blur)"
          className="slo-pulse"
        />
        <polygon
          points="170,30 112,142 148,142 122,240 212,108 172,108 206,30"
          fill="url(#slo-bolt)"
        />
      </g>

      {/* percikan */}
      <g fill="#E0F2FE">
        {[
          [70, 120, 1.6, 0],
          [118, 210, 1.2, 0.6],
          [440, 250, 1.6, 1.1],
          [470, 140, 1.2, 0.3],
          [60, 330, 1.4, 0.9],
          [500, 380, 1.2, 1.5],
        ].map(([cx, cy, r, d]) => (
          <circle
            key={`${cx}-${cy}`}
            cx={cx}
            cy={cy}
            r={r}
            className="slo-pulse"
            style={{ animationDelay: `${d}s` }}
          />
        ))}
      </g>
    </svg>
  );
}

const fieldWrap =
  'flex items-center gap-2.5 h-12 rounded-xl border border-transparent bg-slate-100 px-3.5 text-slate-800 transition focus-within:border-blue-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-600/10';
const fieldInput =
  'flex-1 min-w-0 bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none';

export function LoginView({ onGoogleLogin, onPortalLogin, googleLoading, authError }: LoginViewProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [googleAccountId, setGoogleAccountId] = useState<string | null>(null);

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

  const handleSelectQuickAccount = (acc: PortalAccount) => {
    setUsername(acc.username);
    setPassword(acc.password);
    setGoogleAccountId(acc.id);
    setError(null);
    setInfo(null);
  };

  const handlePortalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const u = username.trim().toLowerCase();
    const matched = PORTAL_ACCOUNTS.find(
      (a) => a.username.toLowerCase() === u && a.password === password
    );
    if (!matched) {
      setError('Username atau password tidak sesuai.');
      return;
    }
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
  };

  const handleGoogle = () => {
    setError(null);
    setInfo(null);
    const u = username.trim().toLowerCase();
    const account =
      PORTAL_ACCOUNTS.find((a) => a.username.toLowerCase() === u) ||
      PORTAL_ACCOUNTS.find((a) => a.id === googleAccountId);
    if (!account) {
      setError('Isi username Anda dulu (atau pilih dari Daftar Akun), lalu klik Masuk dengan Google.');
      return;
    }
    void onGoogleLogin(account);
  };

  const shownError = error || authError;

  return (
    <div className="relative min-h-dvh w-full overflow-x-hidden bg-[#0B1221] flex items-center justify-center px-4 py-8 font-sans">
      {/* Latar bergaya dasbor: navy + cahaya biru/sky + grid halus */}
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-[#0F1B35] via-[#0B1221] to-[#0B1428]" />
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(#38BDF8 1px, transparent 1px), linear-gradient(90deg, #38BDF8 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />
      <div aria-hidden="true" className="pointer-events-none absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-blue-600/25 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-44 -right-32 h-[540px] w-[540px] rounded-full bg-sky-400/15 blur-3xl" />

      <div className="relative z-10 grid w-full max-w-[1040px] grid-cols-1 gap-3 rounded-[28px] bg-[#F8FAFC] p-3 shadow-2xl shadow-black/50 lg:grid-cols-[1.02fr_1fr]">
        {/* Panel ilustrasi */}
        <section className="relative isolate min-h-[216px] overflow-hidden rounded-[20px] lg:min-h-[620px]">
          <PowerScene />
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#0B1221] via-[#0B1221]/75 to-transparent" />

          <div className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-300 slo-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/90">{ORG}</span>
          </div>

          <div className="absolute inset-x-6 bottom-5 lg:inset-x-8 lg:bottom-8">
            <h2 className="font-display text-2xl font-extrabold uppercase leading-[1.04] tracking-tight text-white sm:text-3xl lg:text-[2.9rem]">
              <span className="inline lg:block">Uji.</span>{' '}
              <span className="inline lg:block">Laik.</span>{' '}
              <span className="inline bg-gradient-to-r from-sky-300 to-blue-400 bg-clip-text text-transparent lg:block">
                Operasi.
              </span>
            </h2>
            <p className="mt-3 hidden max-w-[19rem] text-xs leading-relaxed text-slate-300 lg:block">
              Portal manajemen Sertifikat Laik Operasi: dari Surat Tugas, Surat Jalan Alat, hingga JSA dan TTE.
            </p>
          </div>
        </section>

        {/* Form login */}
        <section className="flex flex-col justify-center px-3 py-7 sm:px-8 lg:px-10">
          <div className="mx-auto w-full max-w-[360px]">
            <div className="mb-5 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#38BDF8] shadow-lg shadow-blue-600/30">
                <Zap className="h-6 w-6 fill-amber-300 text-amber-300" />
              </div>
            </div>

            <h1 className="text-center font-display text-2xl font-extrabold uppercase tracking-tight text-slate-900">
              Selamat Datang
            </h1>
            <p className="mb-6 mt-1.5 text-center text-xs text-slate-500">
              Masukkan username dan password akun Portal SLO Anda
            </p>

            {shownError && (
              <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
                {shownError}
              </div>
            )}
            {info && (
              <div role="status" className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-xs font-medium text-sky-800">
                {info}
              </div>
            )}

            <form onSubmit={handlePortalSubmit} className="space-y-4" autoComplete="on">
              <div>
                <label htmlFor="login-username" className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Username
                </label>
                <div className={fieldWrap}>
                  <User className="h-4 w-4 shrink-0 text-slate-400" />
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
                <label htmlFor="login-password" className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Password
                </label>
                <div className={fieldWrap}>
                  <Lock className="h-4 w-4 shrink-0 text-slate-400" />
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
                    aria-label="Tampilkan atau sembunyikan password"
                    className="shrink-0 cursor-pointer text-slate-400 hover:text-slate-700"
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <label className="flex cursor-pointer select-none items-center gap-2 text-slate-600">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-3.5 w-3.5 accent-blue-600"
                  />
                  Ingat saya
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setInfo('Untuk reset password, hubungi Admin Teknis PT. Sabda Duta Paramitha.');
                  }}
                  className="cursor-pointer font-semibold text-blue-700 hover:underline"
                >
                  Lupa password?
                </button>
              </div>

              <button
                type="submit"
                className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-sm font-semibold text-white shadow-lg shadow-blue-600/30 transition hover:brightness-110 active:scale-[0.99]"
              >
                <Zap className="h-4 w-4 fill-amber-300 text-amber-300" />
                Masuk
              </button>
            </form>

            <div className="my-4 flex items-center gap-3 text-[11px] text-slate-400">
              <span className="h-px flex-1 bg-slate-200" /> atau <span className="h-px flex-1 bg-slate-200" />
            </div>

            <button type="button" onClick={handleGoogle} disabled={googleLoading} className="gsi-material-button">
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

            {/* Daftar akun (tertutup secara default) */}
            <div className="mt-5 rounded-xl border border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => setAccountsOpen((v) => !v)}
                aria-expanded={accountsOpen}
                className="flex w-full cursor-pointer items-center justify-between px-3.5 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                <span className="flex items-center gap-2">
                  <KeyRound className="h-3.5 w-3.5 text-blue-600" /> Daftar akun (klik untuk isi otomatis)
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${accountsOpen ? 'rotate-180' : ''}`} />
              </button>
              {accountsOpen && (
                <div className="max-h-56 space-y-2.5 overflow-y-auto border-t border-slate-100 p-3">
                  {GROUP_ORDER.map((grp) => {
                    const list = PORTAL_ACCOUNTS.filter((a) => a.group === grp);
                    if (list.length === 0) return null;
                    return (
                      <div key={grp}>
                        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{grp}</div>
                        <div className="space-y-1">
                          {list.map((acc) => {
                            const active = username.trim().toLowerCase() === acc.username.toLowerCase();
                            return (
                              <button
                                key={acc.id}
                                type="button"
                                onClick={() => handleSelectQuickAccount(acc)}
                                className={`w-full cursor-pointer rounded-lg border px-2.5 py-1.5 text-left transition ${
                                  active
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                                }`}
                              >
                                <div className="truncate text-[11px] font-bold text-slate-800">
                                  {acc.name} <span className="font-medium text-slate-400">· {ROLE_LABELS[acc.role]}</span>
                                </div>
                                <div className="font-mono text-[10px] text-blue-700">
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
              )}
            </div>

            <p className="mt-4 text-center text-[11px] text-slate-400">
              Akun dibuat oleh Admin Teknis. Belum punya akun? Hubungi admin.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
