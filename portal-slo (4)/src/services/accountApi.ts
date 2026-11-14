import { PortalAccount } from '../types/portal';

/** URL Web App Google Apps Script (lihat PANDUAN_AKUN_SHEET.md). Diisi lewat VITE_LOGIN_API_URL. */
const LOGIN_API_URL = ((import.meta.env.VITE_LOGIN_API_URL as string | undefined) || '').trim();

/**
 * Cek username & password ke tab "Akun" di Google Sheet lewat Apps Script.
 * Password dicek di sisi Google; yang kembali hanya data akun (tanpa password).
 */
export async function verifyLogin(username: string, password: string): Promise<PortalAccount> {
  if (!LOGIN_API_URL) {
    throw new Error('Server akun belum dikonfigurasi. Isi VITE_LOGIN_API_URL (lihat PANDUAN_AKUN_SHEET.md).');
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    // text/plain menghindari preflight CORS yang tidak didukung Apps Script
    const res = await fetch(LOGIN_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ username, password }),
      redirect: 'follow',
      signal: ctrl.signal,
    });
    const data = (await res.json()) as { ok?: boolean; error?: string; account?: PortalAccount };
    if (!data.ok || !data.account) {
      throw new Error(data.error || 'Username atau password tidak sesuai.');
    }
    return data.account;
  } catch (err) {
    if (err instanceof Error && !(err instanceof TypeError) && err.name !== 'AbortError' && !(err instanceof SyntaxError)) {
      throw err;
    }
    throw new Error('Tidak dapat menghubungi server akun. Periksa internet dan URL Apps Script.');
  } finally {
    clearTimeout(timer);
  }
}
