# Alur Kerja Portal SLO

1. **Marketing** membuat JO / SO (SPK). Setelah selesai, kirim pemberitahuan ke Admin: *pekerjaan tanpa DP* atau *menunggu DP*. Rekap JO/SO tersimpan di menu **Rekap JO / SO** (bisa diekspor CSV).
2. **Admin** menerima pemberitahuan lalu meneruskan ke **PJT**.
3. **PJT** menunjuk **Leader / PIC** (nama PJT otomatis tidak bisa dipilih sebagai tenaga teknik pada proyek yang sama).
4. **Leader wajib** mengirim pemberitahuan status: *Siap Uji*, *Kekurangan Dokumen*, atau *Akun SiUjang Bermasalah*. Status selain Siap Uji masuk ke inbox kendala Admin.
5. Setelah pemberitahuan terkirim, Leader memilih **anggota tim & alat**, membuat **Surat Tugas, JSA, Surat Jalan Alat** (langkah **ST, JSA & Surat Jalan** di Menu Pekerjaan — klik kotak langkahnya pada Alur Pekerjaan SLO atau tombol dokumen; simpan PDF di sana). Nama petugas di JSA & Tool Keeper Surat Jalan otomatis mengikuti Tenaga Teknik di Surat Tugas, dan alat dipilih dari data Alat Uji / alat tim proyek, lalu kirim ke PJT.
6. **PJT mereview** dokumen persiapan (setujui atau kembalikan untuk revisi). Bila disetujui, otomatis diteruskan ke Direktur.
7. **Direktur Utama** mereview, memberi komentar, lalu menandatangani (TTE) **Surat Tugas** — atau mengembalikan untuk revisi.
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
