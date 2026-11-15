# Akun & Password di Google Sheet

Login Portal SLO sekarang membaca akun dari tab **Akun** di Google Sheet. Password dicek oleh
Google Apps Script (di sisi Google), jadi tidak ada password di kode maupun di browser.

## Pasang (sekali saja, ±5 menit)

1. Buka Google Sheet database Anda (atau buat baru) → **Extensions → Apps Script**.
2. Hapus isi editor, tempel seluruh isi `google-apps-script/Code.gs`, klik **Save**.
3. Pilih fungsi **setupAkun** di menu atas → **Run** → beri izin. Tab **Akun** terisi 12 akun awal dengan **password acak**; daftarnya tampil sekali di kotak dialog, catat lalu bagikan ke masing-masing orang.
4. **Deploy → New deployment → jenis: Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Klik Deploy, salin **Web app URL** (berakhiran `/exec`).
5. Pasang URL itu sebagai environment variable `VITE_LOGIN_API_URL`
   - Lokal: buat file `.env` berisi `VITE_LOGIN_API_URL="https://script.google.com/macros/s/.../exec"`
   - Vercel: Settings → Environment Variables → tambahkan, lalu Redeploy.
6. Jalankan ulang aplikasi. Login memakai username/password dari tab Akun.

## Penyimpanan dokumen (Drive akun 1)

PDF arsip dan scan TTD sekarang disimpan di **Google Drive pemilik Apps Script** (akun 1), di folder
`Portal SLO - Dokumen`, bukan di browser/Drive pengunjung. Pengunjung tidak perlu (dan tidak bisa) login
dengan Gmail sendiri; tombol "Masuk dengan Google" sudah dihapus.

Setelah menempel `Code.gs` versi terbaru:

1. Jalankan fungsi **setupDokumen** sekali → **Run** → beri izin Drive. Folder dibuat otomatis.
2. **Deploy → Manage deployments → Edit → New version → Deploy** (URL `/exec` tetap sama).

Cara kerja: login berhasil → Apps Script memberi token sesi (berlaku maks. 6 jam, hanya di memori
browser). Simpan/ambil/hapus file wajib membawa token itu; tanpa login, file tidak bisa diakses.
**Database proyek** (tombol *Sinkron Server*) juga disimpan sebagai `database.json` di folder yang sama:
*Simpan ke Server* (Admin, Marketing, PJT, Inspektor) menimpa data server, *Muat dari Server* mengganti
data di perangkat. Direktur hanya bisa memuat; klien tidak punya akses database.

Akun `klien` boleh unggah dan melihat, tetapi tidak boleh menghapus. Batas file 5 MB.

## Menambah / mengubah akun

Cukup edit tab **Akun** di Google Sheet, tanpa deploy ulang:

| kolom | isi |
|---|---|
| username | huruf kecil, unik (mis. `budi`) |
| password | teks biasa, atau hasil menu **Portal SLO → Amankan password (hash)** |
| nama, email | tampil di portal |
| role | `direktur`, `teknis`, `sales`, `pjt`, `inspektor`, `klien` |
| group | `Direktur`, `Admin`, `Marketing`, `PJT`, `Tenaga Teknik`, `Klien` |
| inspectorId | untuk `pjt`/`inspektor`: `i1`…`i5` sesuai data Personel (kosong untuk lainnya) |
| pjtName | khusus role `pjt` |
| aktif | `TRUE` / `FALSE` (FALSE = tidak bisa login) |

## Keamanan

- Password awal acak dan hanya ada di Sheet Anda, bukan di repo GitHub. Jangan menaruh password asli di file apa pun yang di-commit.
- Jalankan menu **Portal SLO → Amankan password (hash)** supaya password di sheet tidak terbaca siapa pun
  yang membuka Sheet. Password baru yang diketik biasa bisa di-hash lagi dengan menu yang sama.
- Batasi akses edit Sheet hanya untuk Admin.
- Salah password 5x berturut-turut mengunci username itu selama 10 menit.
- Setelah mengubah `Code.gs`, buat **New deployment** (atau Manage deployments → Edit → New version).
