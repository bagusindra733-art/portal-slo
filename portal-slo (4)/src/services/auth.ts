import { initializeApp, getApps } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { PORTAL_ACCOUNTS, ROLE_LABELS, Role } from '../types/portal';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.setCustomParameters({ prompt: 'select_account' });

let isSigningIn = false;
// Access token is strictly cached in memory (never localStorage or sessionStorage)
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: (user: User | null) => void
) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthFailure?.(user);
      }
    } else {
      cachedAccessToken = null;
      onAuthFailure?.(null);
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Token akses Google tidak diterima. Silakan coba masuk kembali.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => cachedAccessToken;

export const logoutGoogle = async (): Promise<void> => {
  await auth.signOut();
  cachedAccessToken = null;
};

/** Terjemahkan kode error Firebase ke pesan Bahasa Indonesia */
export const authErrorMessage = (err: unknown): string => {
  const code = (err as { code?: string })?.code || '';
  switch (code) {
    case 'auth/invalid-email':
      return 'Format email tidak valid.';
    case 'auth/email-already-in-use':
      return 'Email sudah terdaftar. Silakan masuk atau gunakan Lupa Password.';
    case 'auth/weak-password':
      return 'Password terlalu lemah. Gunakan minimal 8 karakter.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Username/email atau password tidak sesuai.';
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.';
    case 'auth/network-request-failed':
      return 'Koneksi internet bermasalah. Periksa jaringan Anda.';
    case 'auth/operation-not-allowed':
      return 'Fitur email/password belum diaktifkan di Firebase (Authentication → Sign-in method).';
    default:
      return err instanceof Error ? err.message : 'Terjadi kesalahan. Silakan coba lagi.';
  }
};

/** Daftar akun baru (otomatis berperan Klien), lalu keluar agar pengguna login manual */
export const emailSignUp = async (name: string, email: string, password: string): Promise<void> => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  await auth.signOut();
};

export const emailSignIn = async (email: string, password: string): Promise<User> => {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
};

export const sendResetEmail = async (email: string): Promise<void> => {
  await sendPasswordResetEmail(auth, email);
};

export interface AuthProfile {
  role: Role;
  inspectorId?: string;
  pjtName?: string;
  username?: string;
}

/** Baca peran dari custom claims Firebase (diatur lewat `npm run seed:staff`); tanpa claim = Klien */
export const getAuthProfile = async (user: User): Promise<AuthProfile> => {
  const { claims } = await user.getIdTokenResult(true);
  const role = typeof claims.role === 'string' && claims.role in ROLE_LABELS ? (claims.role as Role) : 'klien';
  return {
    role,
    inspectorId: typeof claims.inspectorId === 'string' ? claims.inspectorId : undefined,
    pjtName: typeof claims.pjtName === 'string' ? claims.pjtName : undefined,
    username: PORTAL_ACCOUNTS.find((a) => a.email.toLowerCase() === (user.email || '').toLowerCase())?.username,
  };
};

/** Ubah username staf menjadi email; input yang sudah berupa email dikembalikan apa adanya */
export const resolveLoginEmail = (identifier: string): string => {
  const id = identifier.trim().toLowerCase();
  const staff = PORTAL_ACCOUNTS.find((a) => a.username.toLowerCase() === id);
  return staff ? staff.email : identifier.trim();
};
