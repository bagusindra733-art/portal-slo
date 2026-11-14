import { PORTAL_ACCOUNTS, PortalAccount } from '../types/portal';

const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

export const hashPassword = async (username: string, password: string): Promise<string> => {
  const data = new TextEncoder().encode(`slo-portal:${username.toLowerCase()}:${password}`);
  return toHex(await crypto.subtle.digest('SHA-256', data));
};

/** Cari akun staf berdasarkan username atau email (tanpa membedakan huruf besar/kecil) */
export const findStaffAccount = (identifier: string): PortalAccount | undefined => {
  const id = identifier.trim().toLowerCase();
  return PORTAL_ACCOUNTS.find((a) => a.username.toLowerCase() === id || a.email.toLowerCase() === id);
};

export const verifyStaffPassword = async (
  account: PortalAccount,
  password: string
): Promise<boolean> => (await hashPassword(account.username, password)) === account.passwordHash;
