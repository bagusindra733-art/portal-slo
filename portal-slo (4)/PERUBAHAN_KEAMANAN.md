# Perubahan Keamanan Portal SLO

## Yang diubah
**google-apps-script/Code.gs (server)**
- Hak akses per peran ditegakkan di server: tiap peran hanya bisa mengubah bagian `database.json` miliknya
  (tabel `DB_SECTION_ROLES` dan `PROJ_FIELDS` di bagian atas file). Hapus proyek hanya Admin (`teknis`).
- Dokumen di Drive punya izin baca/tulis per folder (`FILE_ROLES`); klien tidak bisa membaca/menimpa dokumen internal.
- Password: hash SHA-256 berulang (400 putaran) + salt; password lama (teks biasa / hash lama) otomatis ditingkatkan saat login berhasil.
  Password awal dibuat lebih acak. Login gagal diberi jeda 0,8 detik.
- Logout menghapus token di server. Cadangan `database-backup.json` dibuat otomatis (maks. tiap 10 menit).

**Frontend**
- Logout menghapus token di server, serta data lokal (localStorage + IndexedDB) untuk akun staf. Akun klien tidak dihapus karena datanya hanya lokal.
- Bila server menolak perubahan (FORBIDDEN), data dikembalikan dari server dan muncul pemberitahuan.
- Iframe pratinjau dokumen diberi `sandbox` (script diblokir).
- `vercel.json`: header keamanan (HSTS, CSP, X-Frame-Options, dll.).
- `firebase-applet-config.json` dihapus (tidak dipakai).

## Cara pasang
1. Buka Apps Script -> ganti seluruh isi dengan `google-apps-script/Code.gs` baru -> Save.
2. **Deploy -> Manage deployments -> Edit -> New version -> Deploy** (URL `/exec` tetap).
3. Di Google Sheet: menu **Portal SLO -> Amankan password (hash)**. Semua pengguna sebaiknya ganti password awal.
4. Deploy ulang frontend ke Vercel (zip ini).
5. **Tes tiap peran** (Admin, Marketing, PJT, Tenaga Teknik, Direktur, Klien): jalankan satu alur kerja penuh.
   - Bila ada aksi yang tiba-tiba "ditolak server": di Apps Script buka Project Settings -> Script Properties,
     tambah `RBAC_MODE` = `log`. Perubahan tidak ditolak, tetapi pelanggaran dicatat di **Executions** (kata "RBAC:").
     Sesuaikan tabel hak akses di `Code.gs`, lalu hapus properti itu (kembali ke mode ketat).
6. Pulihkan data bila perlu: salin isi `database-backup.json` di folder Drive ke `database.json`.

## Batasan yang perlu diketahui
- Apps Script tidak punya bcrypt/Argon2 dan tidak bisa membaca IP penyerang. Password kuat tetap penting, dan batas 5x salah
  masih bisa dipakai orang untuk mengunci akun tertentu sementara (10 menit).
- Aturan kolom proyek per peran disusun dari kode dan panduan; mungkin perlu penyesuaian setelah tes alur nyata.
- Kolom `status`, `workflowStage`, dan `log` proyek boleh diubah semua peran penulis karena dipakai di seluruh alur.
