import React, { useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  Eye,
  EyeOff,
  FileSpreadsheet,
  KeyRound,
  ShieldCheck,
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

const GROUP_NOTE: Record<PortalAccount['group'], string> = {
  Direktur: 'Meninjau semua data, tanpa hak ubah',
  Admin: 'Input data dan kelola portal',
  Marketing: 'Akses sama untuk kedua akun',
  PJT: 'Penanggung jawab teknik, bisa menjadi TTK',
  'Tenaga Teknik': 'Leader dan anggota tim terpilih',
  Klien: 'Pemohon SLO',
};

/** Diagram satu garis (single line diagram) sebagai ciri visual halaman masuk. */
function SingleLineDiagram() {
  const line = 'rgba(148,163,184,0.5)';
  const amber = '#F5B301';
  return (
    <svg
      viewBox="0 0 400 310"
      role="img"
      aria-label="Diagram satu garis: sumber listrik, busbar, tiga penyulang, dan satu instalasi yang dinyatakan laik operasi"
      className="w-full h-auto max-w-[420px]"
      fill="none"
      strokeLinecap="round"
    >
      {/* Sumber & trafo */}
      <path d="M200 8 V62" stroke={line} strokeWidth="2" />
      <circle cx="200" cy="80" r="18" stroke={line} strokeWidth="2" />
      <circle cx="200" cy="98" r="18" stroke={line} strokeWidth="2" />
      <path d="M200 116 V150" stroke={line} strokeWidth="2" />

      {/* Busbar */}
      <path d="M36 150 H364" stroke="#E2E8F0" strokeWidth="5" />

      {/* Penyulang kiri & kanan */}
      {[80, 320].map((x) => (
        <g key={x}>
          <path d={`M${x} 150 V186`} stroke={line} strokeWidth="2" />
          <rect x={x - 7} y="186" width="14" height="16" rx="2" stroke={line} strokeWidth="2" />
          <path d={`M${x} 202 V248`} stroke={line} strokeWidth="2" />
          <circle cx={x} cy="262" r="13" stroke={line} strokeWidth="2" />
        </g>
      ))}

      {/* Penyulang tengah: instalasi laik operasi */}
      <path d="M200 150 V186" stroke={amber} strokeWidth="3" />
      <rect x="193" y="186" width="14" height="16" rx="2" fill={amber} stroke={amber} strokeWidth="2" />
      <path d="M200 202 V248" stroke={amber} strokeWidth="3" />
      <circle cx="200" cy="262" r="13" stroke={amber} strokeWidth="3" />
      <path d="M194 262 l4.5 4.5 l8 -9" stroke={amber} strokeWidth="2.5" strokeLinejoin="round" />
      <text
        x="200"
        y="298"
        textAnchor="middle"
        fill={amber}
        fontSize="13"
        fontWeight="600"
        fontFamily="'DM Sans', system-ui, sans-serif"
      >
        Laik operasi
      </text>
    </svg>
  );
}

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
  const [accountsOpen, setAccountsOpen] = useState(false);

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
      setLoginError('Username atau password tidak sesuai. Periksa daftar akun cepat di bawah.');
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

  const inputBase =
    'w-full h-12 rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900 placeholder:text-slate-400 transition-colors focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-600/15';

  return (
    <div className="min-h-dvh w-full bg-[#0B1221] text-white flex flex-col lg:grid lg:grid-cols-[minmax(360px,5fr)_7fr]">
      {/* Panel merek */}
      <section
        aria-label="Tentang Portal SLO"
        className="relative flex flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-6 sm:px-10 lg:px-12 lg:py-12 lg:justify-between lg:min-h-dvh overflow-hidden"
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#F5B301] text-[#0B1221] flex items-center justify-center font-display font-extrabold text-xl shrink-0">
            S
          </div>
          <div className="min-w-0">
            <div className="font-display font-extrabold text-lg leading-tight tracking-tight">
              Portal SLO
            </div>
            <div className="text-sm text-slate-300 truncate">{ORG}</div>
          </div>
        </div>

        <div className="hidden lg:flex flex-col gap-8 my-10">
          <div className="space-y-3">
            <h1 className="font-display text-3xl xl:text-4xl font-extrabold leading-[1.15] tracking-tight max-w-md">
              Dokumen uji laik operasi, dari surat tugas sampai JSA
            </h1>
            <p className="text-slate-300 leading-relaxed max-w-md">
              Surat tugas, surat jalan alat uji, dan JSA disusun dalam satu tempat, lalu disimpan
              ke Google Sheets.
            </p>
          </div>
          <SingleLineDiagram />
        </div>

        <ul className="hidden lg:grid gap-3 text-sm text-slate-300">
          <li className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-sky-400 shrink-0" aria-hidden="true" />
            Sertifikat dan tanda tangan elektronik dapat diverifikasi
          </li>
          <li className="flex items-center gap-3">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400 shrink-0" aria-hidden="true" />
            Data tersinkron ke Google Sheets
          </li>
        </ul>
      </section>

      {/* Panel formulir */}
      <main className="flex-1 bg-[#F6F7F9] text-slate-900 rounded-t-3xl lg:rounded-none flex justify-center items-start lg:items-center px-5 pt-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-10 lg:px-14 lg:py-12">
        <div className="w-full max-w-md lg:max-w-lg">
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-slate-900">
            Masuk ke portal
          </h2>
          <p className="text-sm text-slate-600 mt-1 mb-6">
            Gunakan username dan password akun Anda, atau masuk dengan Google.
          </p>

          {(authError || loginError) && (
            <div
              role="alert"
              className="mb-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800"
            >
              {loginError || authError}
            </div>
          )}

          <form onSubmit={handlePortalSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-username" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Username
              </label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Contoh: admin, marketing1"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                className={`${inputBase} font-mono`}
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  autoComplete="current-password"
                  required
                  className={`${inputBase} font-mono pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600"
                  aria-label={showPass ? 'Sembunyikan password' : 'Tampilkan password'}
                  aria-pressed={showPass}
                >
                  {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full h-12 rounded-xl bg-[#0B1221] text-white font-semibold text-base hover:bg-[#16233E] active:bg-[#0B1221] transition-colors flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <span>Masuk</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </form>

          <div className="flex items-center gap-3 my-6" role="separator" aria-label="atau">
            <div className="h-px flex-1 bg-slate-300" />
            <span className="text-sm text-slate-500">atau</span>
            <div className="h-px flex-1 bg-slate-300" />
          </div>

          <div className="space-y-3">
            <div>
              <label htmlFor="login-google-account" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Akun portal untuk sesi Google
              </label>
              <select
                id="login-google-account"
                value={googleAccountId}
                onChange={(e) => setGoogleAccountId(e.target.value)}
                className="w-full h-12 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-600/15"
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
                  {googleLoading ? 'Menghubungkan akun Google...' : 'Masuk dengan Google'}
                </span>
              </div>
            </button>
          </div>

          {/* Akun cepat */}
          <div className="mt-8 border-t border-slate-300 pt-4">
            <button
              type="button"
              onClick={() => setAccountsOpen((v) => !v)}
              aria-expanded={accountsOpen}
              aria-controls="login-quick-accounts"
              className="w-full flex items-center justify-between gap-3 py-2 text-left cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <KeyRound className="w-4 h-4 text-slate-500" aria-hidden="true" />
                Pilih akun cepat
              </span>
              <ChevronDown
                className={`w-5 h-5 text-slate-500 transition-transform ${accountsOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>

            {accountsOpen && (
              <div id="login-quick-accounts" className="mt-3 space-y-4 max-h-[22rem] overflow-y-auto pr-1">
                <p className="text-xs text-slate-500">
                  Ketuk salah satu akun untuk mengisi username dan password otomatis.
                </p>
                {GROUP_ORDER.map((grp) => {
                  const groupAccounts = PORTAL_ACCOUNTS.filter((a) => a.group === grp);
                  if (groupAccounts.length === 0) return null;
                  return (
                    <div key={grp}>
                      <div className="text-sm font-semibold text-slate-800">{grp}</div>
                      <div className="text-xs text-slate-500 mb-1.5">{GROUP_NOTE[grp]}</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {groupAccounts.map((acc) => {
                          const active = username.trim().toLowerCase() === acc.username.toLowerCase();
                          return (
                            <button
                              key={acc.id}
                              type="button"
                              onClick={() => handleSelectQuickAccount(acc)}
                              aria-pressed={active}
                              className={`text-left min-h-12 px-3 py-2 rounded-xl border cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
                                active
                                  ? 'bg-[#0B1221] border-[#0B1221] text-white'
                                  : 'bg-white border-slate-300 text-slate-800 hover:border-slate-500'
                              }`}
                            >
                              <div className="text-sm font-semibold truncate">{acc.name}</div>
                              <div
                                className={`text-xs font-mono truncate ${
                                  active ? 'text-amber-300' : 'text-slate-500'
                                }`}
                              >
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
        </div>
      </main>
    </div>
  );
}
