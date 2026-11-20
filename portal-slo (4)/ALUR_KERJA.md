# Alur Kerja Portal SLO

1. **Marketing** membuat JO / SO (SPK). Setelah selesai, kirim pemberitahuan ke Admin: *pekerjaan tanpa DP* atau *menunggu DP*. Rekap JO/SO tersimpan di menu **Rekap JO / SO** (bisa diekspor CSV).
2. **Admin** menerima pemberitahuan lalu meneruskan ke **PJT**.
3. **PJT** menunjuk **Leader / PIC** (nama PJT otomatis tidak bisa dipilih sebagai tenaga teknik pada proyek yang sama).
4. **Leader wajib** mengirim pemberitahuan status: *Siap Uji*, *Kekurangan Dokumen*, atau *Akun SiUjang Bermasalah*. Status selain Siap Uji masuk ke inbox kendala Admin.
5. Setelah pemberitahuan terkirim, Leader membuka **Buat Surat Tugas** (anggota tim dipilih di Surat Tugas) → **Simpan & Lanjutkan ke Surat Jalan Alat** (alat uji dipilih di Surat Jalan) → **Simpan & Lanjutkan ke JSA**. Setelah ketiganya tersimpan, Leader klik **Kirim ke PJT untuk Direview**.
6. **PJT** menerima notifikasi *Review Surat Tugas, Surat Jalan Alat & JSA*. Bila sesuai, PJT memilih **Teruskan ke Direktur (untuk di-TTD)**, atau mengembalikan untuk revisi.
7. **Direktur Utama** mereview, memberi komentar, menandatangani (TTE) **Surat Tugas**, lalu memilih **Teruskan ke TT untuk Dikerjakan** — atau mengembalikan untuk revisi.
8. Pengujian dimulai (syarat: Surat Tugas ber-TTD Direktur, scan TTD manual terunggah, status terakhir Siap Uji).
9. **Laporan pengujian dibuat manual dan diunggah** ke sistem oleh Leader dan/atau anggota. Leader mengirim ke PJT.
10. **PJT mereview laporan** (setujui → ke Admin, atau kembalikan untuk revisi).
11. **Admin** mencetak/menerbitkan SLO — hanya bisa bila laporan sudah diunggah.
12. **PJT wajib menginformasikan** bahwa SLO sudah terbit / pekerjaan selesai.

Menu **Inventaris Perusahaan**: dokumen resmi perusahaan. Admin menambah/menghapus; peran lain melihat & mengunduh.

## Hak akses Admin (revisi)

- Panel **Penugasan Langsung Inspektor & Alat Uji** dihapus dari akses Admin. Tim & alat ditentukan oleh PJT (menunjuk Leader) dan Leader.
- Panel **Kontrol Admin atas Alur Pekerjaan** (ganti PJT/Leader, reset status, buka ulang review, kembalikan ke pengujian) dihapus.
- Admin tidak lagi membuka/mengubah editor Surat Tugas, JSA, Surat Jalan, tidak mengunggah scan TTD, dan tidak menghapus laporan milik user. Admin hanya memantau status; tiap user memegang kendali atas pekerjaannya.

## Database TTD (Tanda Tangan)

- Menu **Personel** → *Database TTD*: Admin mengunggah 1 gambar TTD per nama (PNG/JPG). Margin dipangkas, latar putih dibuat transparan, ukuran diseragamkan otomatis.
- Di **Surat Jalan Alat** (Tool Keeper, Petugas, Menyetujui) dan **JSA** (Ketua Tim, Pelaksana), kolom tanda tangan terisi otomatis sesuai nama yang dipilih. Ukuran tampil di PDF baku (kotak tetap, gambar dipaskan tanpa distorsi).
- TTD **Surat Tugas** oleh Direktur tetap memakai TTE (QR) seperti sebelumnya.
- Nama yang tidak ada di database dibiarkan kosong (untuk TTD manual).
