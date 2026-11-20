# Alur Kerja Portal SLO

1. **Marketing** membuat JO / SO (SPK). Setelah selesai, kirim pemberitahuan ke Admin: *pekerjaan tanpa DP* atau *menunggu DP*. Rekap JO/SO tersimpan di menu **Rekap JO / SO** (bisa diekspor CSV).
2. **Admin** menerima pemberitahuan lalu meneruskan ke **PJT**.
3. **PJT** menunjuk **Leader / PIC** (nama PJT otomatis tidak bisa dipilih sebagai tenaga teknik pada proyek yang sama).
4. **Leader wajib** mengirim pemberitahuan status (kotak **Status Pekerjaan** di Alur Pekerjaan SLO): *Siap Uji*, *Kekurangan Dokumen*, atau *Akun SiUjang Bermasalah*. Status selain Siap Uji masuk ke inbox kendala Admin dan **Surat Tugas belum bisa dibuat** sampai Leader mengirim ulang status *Siap Uji*. Setelah memilih *Siap Uji*, panel pemberitahuan hilang.
5. Setelah status *Siap Uji* terkirim, Leader membuka **Buat Surat Tugas** (anggota tim dipilih di Surat Tugas) → **Simpan & Lanjutkan ke Surat Jalan Alat** (alat uji dipilih di Surat Jalan) → **Simpan & Lanjutkan ke JSA**. Setelah ketiganya tersimpan, Leader klik **Kirim ke PJT untuk Direview**.
6. **PJT** menerima notifikasi *Review Surat Tugas, Surat Jalan Alat & JSA*. Bila sesuai, PJT memilih **Teruskan ke Direktur (untuk di-TTD)**, atau mengembalikan untuk revisi.
7. **Direktur Utama** mereview, memberi komentar, menandatangani (TTE) **Surat Tugas**, lalu memilih **Teruskan ke TT untuk Dikerjakan** — atau mengembalikan untuk revisi.
8. Pengujian dimulai (syarat: Surat Tugas ber-TTD Direktur dan status terakhir Siap Uji; tidak perlu upload ulang scan karena ST, JSA & Surat Jalan memakai TTD tempel dan otomatis tersimpan di server).
9. **Laporan pengujian dibuat manual dan diunggah** ke sistem oleh Leader dan/atau anggota. Leader mengirim ke PJT.
10. **PJT mereview laporan** (setujui → ke Admin, atau kembalikan untuk revisi).
11. **Admin** mencetak/menerbitkan SLO — hanya bisa bila laporan sudah diunggah.
12. **PJT wajib menginformasikan** bahwa SLO sudah terbit / pekerjaan selesai.

Menu **Inventaris Perusahaan**: dokumen resmi perusahaan. Admin menambah/menghapus; peran lain melihat & mengunduh.

## Hak akses Admin (revisi)

- Panel **Penugasan Langsung Inspektor & Alat Uji** dihapus dari akses Admin. Tim & alat ditentukan oleh PJT (menunjuk Leader) dan Leader.
- Panel **Kontrol Admin atas Alur Pekerjaan** (ganti PJT/Leader, reset status, buka ulang review, kembalikan ke pengujian) dihapus.
- Admin tidak lagi membuka/mengubah editor Surat Tugas, JSA, Surat Jalan, dan tidak menghapus laporan milik user. Admin hanya memantau status; tiap user memegang kendali atas pekerjaannya.

## Database TTD (Tanda Tangan)

- Menu **Personel** → *Database TTD*: Admin mengunggah 1 gambar TTD per nama (PNG/JPG). Margin dipangkas, latar putih dibuat transparan, ukuran diseragamkan otomatis.
- Di **Surat Jalan Alat** (Tool Keeper, Petugas, Menyetujui) dan **JSA** (Ketua Tim, Pelaksana), kolom tanda tangan terisi otomatis sesuai nama yang dipilih. Ukuran tampil di PDF baku (kotak tetap, gambar dipaskan tanpa distorsi).
- TTD **Surat Tugas** oleh Direktur tetap memakai TTE (QR) seperti sebelumnya.
- Nama yang tidak ada di database dibiarkan kosong (untuk TTD manual).

## Revisi akses Tenaga Teknik (Revisi_4)

- **Surat Tugas**: input PJT dihapus — PJT terisi otomatis dari pilihan Admin saat meneruskan proyek. Pemberi tugas/TTD hanya Direktur Utama.
- **Tenaga Teknik**: kolom 1 = **Leader**, kolom 2, 3, dst = **Anggota** (Leader tidak bisa dihapus; tombol "Tambah Anggota").
- **Surat Tugas, Surat Jalan Alat, JSA**: pilihan *Bubuhkan TTE*, *Simpan PDF* dan *Cetak* di panel form dihapus. Fungsinya dipegang tombol di toolbar atas (Simpan PDF & Rekap, Cetak, Simpan & Lanjutkan).
- **Surat Jalan Alat**:
  - Tool Keeper **permanen Abdul Rozaq** (`DOC_CONFIG.toolKeeper`), tidak bisa dipilih.
  - Petugas hanya **Leader**; bila Leader = Abdul Rozaq, diganti anggota pertama di Surat Tugas.
  - Teks "Petugas," berada di atas TTD (bukan di samping nama).
  - Blok tanggal, "Kepada Yth", nama perusahaan & kota dipindah ke sisi kanan, sejajar dengan kolom Petugas di bawahnya.
- Gaya semua input form dokumen diseragamkan dengan website (kelas `.doc-form` di `src/index.css`); fungsinya tidak berubah.
- **TTD Direktur pada Surat Tugas** memakai gambar dari **Database TTD** (bukan lagi kotak TTE/QR), dan hanya tampil setelah Direktur Utama menyetujui & menandatangani (langkah 7). Sebelum itu (langkah 5, 6) area TTD kosong. Gambar TTD diambil menurut nama Direktur Utama di Menu Personel → Database TTD.
