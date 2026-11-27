import { PortalAccount } from '../types/portal';

/** URL Web App Google Apps Script (lihat PANDUAN_AKUN_SHEET.md). Diisi lewat VITE_LOGIN_API_URL. */
const LOGIN_API_URL = ((import.meta.env.VITE_LOGIN_API_URL as string | undefined) || '').trim();

const TOKEN_KEY = 'slo_session_token';

/** Token sesi hasil login. Disimpan di sessionStorage: bertahan saat refresh, hilang saat tab ditutup / logout. */
let sessionToken: string | null = (() => {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
})();

const setToken = (t: string | null): void => {
  sessionToken = t;
  try {
    if (t) sessionStorage.setItem(TOKEN_KEY, t);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* abaikan */
  }
};

/** Dipanggil saat server menyatakan token tidak valid / kedaluwarsa. */
let authExpiredHandler: (() => void) | null = null;
export const setAuthExpiredHandler = (fn: (() => void) | null): void => {
  authExpiredHandler = fn;
};

export const hasSessionToken = (): boolean => Boolean(sessionToken);
export const clearSessionToken = (): void => setToken(null);

/** Akhiri sesi di server (token dihapus), lalu bersihkan token di memori. Tidak melempar error. */
export async function serverLogout(): Promise<void> {
  const token = sessionToken;
  setToken(null);
  if (!token) return;
  try {
    await callApi({ action: 'logout', token }, 8000);
  } catch {
    /* abaikan: token tetap kedaluwarsa sendiri */
  }
}

export class ApiAuthError extends Error {}
/** Server menolak karena perubahan di luar hak peran pengguna. */
export class ApiForbiddenError extends Error {}

interface ApiReply {
  ok?: boolean;
  error?: string;
  code?: string;
  account?: PortalAccount;
  accounts?: ManagedAccount[];
  password?: string;
  token?: string;
  file?: unknown;
  state?: string;
  updatedAt?: string;
  updatedBy?: string;
  folderUrl?: string;
}

/** Kirim satu permintaan ke Apps Script. Semua aksi lewat satu pintu, satu akun pemilik. */
async function callApi(body: Record<string, unknown>, timeoutMs = 20000): Promise<ApiReply> {
  if (!LOGIN_API_URL) {
    throw new Error('Server akun belum dikonfigurasi. Isi VITE_LOGIN_API_URL (lihat PANDUAN_AKUN_SHEET.md).');
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // text/plain menghindari preflight CORS yang tidak didukung Apps Script
    const res = await fetch(LOGIN_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow',
      signal: ctrl.signal,
    });
    return (await res.json()) as ApiReply;
  } catch {
    throw new Error('Tidak dapat menghubungi server akun. Periksa internet dan URL Apps Script.');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Cek username & password ke tab "Akun" di Google Sheet lewat Apps Script.
 * Password dicek di sisi Google; yang kembali hanya data akun (tanpa password) dan token sesi.
 */
export async function verifyLogin(username: string, password: string): Promise<PortalAccount> {
  const data = await callApi({ action: 'login', username, password });
  if (!data.ok || !data.account) {
    throw new Error(data.error || 'Username atau password tidak sesuai.');
  }
  setToken(data.token || null);
  return data.account;
}

async function callWithSession(body: Record<string, unknown>, timeoutMs?: number): Promise<ApiReply> {
  if (!sessionToken) throw new ApiAuthError('Belum login.');
  const data = await callApi({ ...body, token: sessionToken }, timeoutMs);
  if (!data.ok && data.code === 'AUTH') {
    setToken(null);
    authExpiredHandler?.();
    throw new ApiAuthError(data.error || 'Sesi berakhir. Silakan login ulang.');
  }
  return data;
}

export interface RemoteFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
  savedAt: string;
  /** Kunci subfolder di Drive: surat-tugas | surat-jalan | jsa | scan-ttd | laporan | inventaris | skttk. */
  folder?: string;
}

/** Simpan file ke Google Drive akun pemilik script. */
export async function remotePutFile(file: RemoteFile): Promise<void> {
  const data = await callWithSession({ action: 'putFile', file }, 60000);
  if (!data.ok) throw new Error(data.error || 'Gagal menyimpan dokumen ke server.');
}

/** Ambil file dari Drive pemilik script. null bila tidak ada. */
export async function remoteGetFile(id: string): Promise<RemoteFile | null> {
  const data = await callWithSession({ action: 'getFile', id }, 60000);
  if (data.ok && data.file) return data.file as RemoteFile;
  if (data.code === 'NOT_FOUND') return null;
  throw new Error(data.error || 'Gagal mengambil dokumen dari server.');
}

export async function remoteDeleteFile(id: string): Promise<void> {
  const data = await callWithSession({ action: 'deleteFile', id });
  if (!data.ok) throw new Error(data.error || 'Gagal menghapus dokumen di server.');
}

export class ApiNotFoundError extends Error {}
export class ApiConflictError extends Error {}

export interface RemoteDbInfo {
  updatedAt: string;
  updatedBy?: string;
  folderUrl: string;
}

/** Simpan seluruh data portal ke server. baseUpdatedAt = versi server yang terakhir dibaca ('' bila belum ada). */
export async function remotePutDb(state: unknown, baseUpdatedAt: string): Promise<RemoteDbInfo> {
  const data = await callWithSession(
    { action: 'putDb', state: JSON.stringify(state), baseUpdatedAt },
    60000
  );
  if (!data.ok) {
    if (data.code === 'CONFLICT') throw new ApiConflictError(data.error);
    if (data.code === 'FORBIDDEN') throw new ApiForbiddenError(data.error);
    throw new Error(data.error || 'Gagal menyimpan database ke server.');
  }
  return { updatedAt: data.updatedAt || '', folderUrl: data.folderUrl || '' };
}

/** Muat data portal dari server. */
export async function remoteGetDb<T>(): Promise<{ state: T; info: RemoteDbInfo }> {
  const data = await callWithSession({ action: 'getDb' }, 60000);
  if (!data.ok || !data.state) {
    if (data.code === 'NOT_FOUND') throw new ApiNotFoundError(data.error);
    throw new Error(data.error || 'Gagal memuat database dari server.');
  }
  return {
    state: JSON.parse(data.state) as T,
    info: { updatedAt: data.updatedAt || '', updatedBy: data.updatedBy, folderUrl: data.folderUrl || '' },
  };
}

/** Versi terakhir di server (ringan). null bila belum ada database. */
export async function remoteDbVersion(): Promise<string | null> {
  const data = await callWithSession({ action: 'dbInfo' });
  if (data.ok) return data.updatedAt || '';
  if (data.code === 'NOT_FOUND') return null;
  throw new Error(data.error || 'Gagal memeriksa database server.');
}

/** Akun seperti tercatat di tab "Akun" (tanpa password). Dikelola Admin Teknis. */
export interface ManagedAccount {
  username: string;
  nama: string;
  email: string;
  role: 'direktur' | 'teknis' | 'sales' | 'pjt' | 'inspektor';
  group?: string;
  inspectorId?: string;
  pjtName?: string;
  aktif: boolean;
}

const needOk = (data: ApiReply, fallback: string): void => {
  if (!data.ok) throw new Error(data.error || fallback);
};

/** Admin: daftar semua akun. */
export async function listAccounts(): Promise<ManagedAccount[]> {
  const data = await callWithSession({ action: 'listAccounts' });
  needOk(data, 'Gagal memuat daftar akun.');
  return data.accounts || [];
}

/** Admin: tambah akun baru (isNew + password) atau ubah akun yang ada. */
export async function saveAccount(
  account: ManagedAccount & { password?: string },
  isNew: boolean
): Promise<void> {
  const data = await callWithSession({ action: 'saveAccount', account, isNew });
  needOk(data, 'Gagal menyimpan akun.');
}

/** Admin: reset password. Password baru (acak) dikembalikan sekali untuk disampaikan ke pengguna. */
export async function resetAccountPassword(username: string): Promise<string> {
  const data = await callWithSession({ action: 'resetPassword', username });
  needOk(data, 'Gagal mereset password.');
  return data.password || '';
}

/** Semua pengguna: ganti password sendiri. */
export async function changeOwnPassword(oldPassword: string, newPassword: string): Promise<void> {
  const data = await callWithSession({ action: 'changePassword', oldPassword, newPassword });
  needOk(data, 'Gagal mengganti password.');
}
