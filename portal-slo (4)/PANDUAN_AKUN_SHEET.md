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
   Bila dijalankan dari editor, hasilnya tampil di **Log eksekusi** (bukan dialog); dari spreadsheet tampil sebagai dialog.
   Jika script dibuat standalone (bukan dari Extensions > Apps Script di spreadsheet), isi Script Property `SPREADSHEET_ID` dengan ID spreadsheet Anda.
2. **Deploy → Manage deployments → Edit → New version → Deploy** (URL `/exec` tetap sama).

Cara kerja: login berhasil → Apps Script memberi token sesi (berlaku maks. 6 jam, hanya di memori
browser). Simpan/ambil/hapus file wajib membawa token itu; tanpa login, file tidak bisa diakses.
**Database proyek** juga otomatis: saat login data dimuat dari server (`database.json` di folder yang sama),
setiap perubahan disimpan otomatis ±2 detik kemudian, dan perubahan pengguna lain diambil tiap ±45 detik.
Status tampil di pojok atas ("Tersimpan di server"). Tidak ada menu atau tombol sinkron.
Bila server masih kosong, login pertama oleh Admin/Marketing/PJT/Inspektor mengisinya dengan data awal.
Jika dua orang menyimpan bersamaan, yang kedua otomatis memuat versi terbaru (mencegah saling menimpa).
Direktur ikut menyimpan ke server (komentar review & TTD Surat Tugas); klien bekerja lokal saja (tidak punya akses database server).

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

## Perubahan alur & hak akses (versi terbaru)

Setelah memperbarui `Code.gs` (Direktur kini boleh menyimpan database), buat **New version** pada deployment.
Kolom `role` di tab Akun **tidak berubah**; hanya tampilannya yang diganti:

| role di Sheet | Tampil sebagai | Hak akses |
|---|---|---|
| `direktur` | Direktur Utama | Review, komentar, TTD Surat Tugas dari PJT |
| `teknis` | Admin | Kontrol penuh semua menu & alur |
| `sales` | Marketing | Hanya JO & SO (rekap tersimpan) + pemberitahuan ke Admin |
| `pjt` | PJT | Teruskan/tunjuk Leader, review dokumen persiapan & laporan, informasikan SLO terbit |
| `inspektor` | Tenaga Teknik | Surat Tugas, JSA, Surat Jalan, anggota tim, upload laporan |

Rincian alur ada di `ALUR_KERJA.md`.
