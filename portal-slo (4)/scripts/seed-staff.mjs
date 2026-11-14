// Membuat/memperbarui akun staf di Firebase Auth lengkap dengan peran (custom claims).
// Jalankan SEKALI di laptop Anda:
//   1. Firebase Console → Project settings → Service accounts → Generate new private key
//      simpan sebagai serviceAccountKey.json di folder proyek (sudah di .gitignore)
//   2. (opsional) ubah email di staff-directory.json menjadi email asli tiap orang
//   3. npm install && npm run seed:staff
// Password acak dicetak SEKALI di terminal. Staf bisa menggantinya lewat "Lupa password".
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json';
const staff = JSON.parse(readFileSync(new URL('../staff-directory.json', import.meta.url), 'utf8'));

initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))) });
const auth = getAuth();

const newPassword = () => randomBytes(9).toString('base64url');
const rows = [];

for (const s of staff) {
  const claims = { role: s.role };
  if (s.inspectorId) claims.inspectorId = s.inspectorId;
  if (s.pjtName) claims.pjtName = s.pjtName;
  try {
    const user = await auth.getUserByEmail(s.email);
    await auth.updateUser(user.uid, { displayName: s.name });
    await auth.setCustomUserClaims(user.uid, claims);
    rows.push({ username: s.username, email: s.email, role: s.role, password: '(akun sudah ada, tidak diubah)' });
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    const password = newPassword();
    const user = await auth.createUser({ email: s.email, password, displayName: s.name, emailVerified: false });
    await auth.setCustomUserClaims(user.uid, claims);
    rows.push({ username: s.username, email: s.email, role: s.role, password });
  }
}

console.table(rows);
console.log('\nSimpan password di atas sekarang; tidak akan ditampilkan lagi.');
