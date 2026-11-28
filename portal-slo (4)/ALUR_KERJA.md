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

## Revisi Form JO/SO Marketing (Revisi_9)

- Form dibuat bertahap (3 langkah): **Penawaran → PO / Job Order → Dokumen & Kirim**, dengan panel samping berisi total, pratinjau data yang tampil di Daftar Pekerjaan, dan daftar kelengkapan.
- **Data pelanggan dipisah**: Nama Perusahaan, Kota/Kabupaten, Alamat Lengkap (tidak perlu lagi memakai tanda `|`). Kota wajib diisi bila disinkronkan ke Proyek.
- **Jenis Instalasi** hanya diisi sekali (langkah 1) dan otomatis dipakai di Proyek, Surat Tugas, dan JO. Ditambah kolom **Kapasitas**.
- **Kategori item** (Jasa / Mobilisasi) dipilih eksplisit di tabel item, tidak lagi ditebak dari nama item.
- Status penawaran memakai label Indonesia; **DP (%)** menampilkan nominal Rp dan mengisi **Payment Term** otomatis.
- Data lama otomatis diurai saat dibuka (nama dari teks lama, kota dari proyek terkait bila ada).

## Work Order (Revisi_10)

- Dari data JO/SO otomatis dibuat dokumen **Work Order** (A4) lengkap: kop PT Sabda Duta Paramitha, data pelanggan (Nama, NPWP, Alamat), No PO, Tanggal, Kontak Personal, tabel Uraian/Jumlah, Sub Total, PPN, Total, blok Approved By / Agree By (Direktur), catatan pembayaran, rekening bank, dan NB.
- Akses: tombol **Work Order** di setiap baris Rekap JO/SO, atau **Lihat & Unduh Work Order (PDF)** di panel samping form. Pratinjau memakai data yang sedang diisi (belum perlu disimpan).
- Input baru: **NPWP** (langkah 1), **Kontak Personal** dan **Catatan Work Order** (langkah 2). Catatan kosong = otomatis dari DP (mis. 50% DP sebelum penjadwalan SLO, 50% setelah SLO terbit, biaya sudah termasuk pajak).
- Data tetap perusahaan (alamat kop, telepon, bank, no. rekening, NB, penandatangan) ada di `DOC_CONFIG.workOrder` pada `src/types/portal.ts`.
- TTD Direktur tampil bila ada di Database TTD (Menu Personel); bila tidak ada, ruang dibiarkan kosong untuk TTD manual.

## Layanan SLO (tahap per instalasi, kunci = No. Agenda DJK)

Setelah **Surat Tugas di-TTD Direktur**, tiap instalasi proyek masuk Layanan SLO dan berjalan sendiri-sendiri:

1. **Verifikasi LIT** — Admin menginput ke web DJK (manual; otomatis bila nanti ada API), lalu di portal mengisi nama instalasi, **No. Agenda DJK**, memilih Tenaga Teknik (sesuai SiUjang), dan klik *Sudah diinput ke DJK*.
2. **Pengerjaan TT** — hanya Tenaga Teknik yang ditugaskan pada instalasi itu yang melihatnya (kosong = ikut tim proyek). **Laporan diunggah per instalasi** di baris instalasi; tombol *Teruskan ke PJT* terkunci sampai instalasi itu punya minimal 1 laporan.
3. **Pengesahan PJT** — PJT membuka/mengunduh laporan instalasi itu, lalu *Sahkan & teruskan ke Admin* atau *Kembalikan untuk revisi* (catatan wajib).
4. **Evaluasi LIT** — Admin meneruskan ke DJK lewat web DJK, lalu klik *Sudah diteruskan ke DJK*.
5. **Evaluasi DJK** (Prepare / Review 1 / Review 2 / Approve) — diubah Admin lewat dropdown, atau otomatis dari Excel DJK (kolom *Posisi*).
6. **Generate SLO → Cetak SLO → SLO Terbit** — instalasi turun otomatis ke *Generate SLO* begitu No. Agenda-nya ada di data SLO Terbit (Excel DJK).

Memperbarui data dari Excel DJK: `python3 scripts/xlsx_to_slo_terbit.py file1.xlsx [file2.xlsx ...]`, lalu deploy ulang.
Setelah menempel `Code.gs` baru, **deploy ulang** Apps Script (kolom `instalasi` ditambahkan untuk peran PJT & Tenaga Teknik).

### Penutupan proyek otomatis & proyek lama

- Begitu **semua instalasi** dalam satu proyek berstatus *SLO Terbit*, proyek otomatis ditandai selesai (status SLO terbit + pemberitahuan sistem). PJT tidak perlu lagi mengabari manual (langkah 12 alur lama); cukup membaca pemberitahuan di halaman proyek.
- Laporan baru diberi penanda instalasi (`instalasiId`). Laporan lama tanpa penanda tetap tersimpan dan tampil sebagai "Laporan lama (tingkat proyek)".
- Proyek yang Surat Tugasnya di-TTD Direktur setelah update ini diberi penanda `flowVersion: 2` (alur baru: unggah laporan hanya lewat Layanan SLO). Proyek tanpa penanda tetap memakai alur lama.

## Menu Sales Order (Revisi_7)

- Submenu **Input Sales Order** diganti nama menjadi **Create Order**. Isinya daftar penawaran berstatus **submit/approved** yang belum dibuatkan PO (tombol **Create PO**). Penawaran yang sudah jadi Sales Order tidak muncul lagi di daftar.
- **Create PO** membuka form dengan 3 tab: **Penawaran** (isi sama dengan Input Penawaran, hanya tampil), **Purchase Order**, dan **Purchase Order Document**.
- **Purchase Order**: PO No otomatis `urut/WO/SDP/bulan romawi/tahun` (mis. `041/WO/SDP/VII/2026`, urut 3 digit, mengikuti PO Date dan tidak bisa diubah), Title, PO Date, PO Delivery Date/Expired Date, DP (%), Pelanggan | Alamat, Jenis Instalasi, Payment Term, dan **Penandatangan** (pilihan sama seperti Penawaran).
- **Purchase Order Document**: nama dokumen + unggah berkas (maks. 5 MB). Isi berkas **tersimpan di server** (Google Drive, subfolder "8. Dokumen PO (Sales Order)") dan bisa dilihat (ikon mata, untuk PDF dan gambar) atau diunduh lagi dari tabel. Berkas yang dihapus di form ikut terhapus dari server saat **Save**; bila form ditutup lewat **Back**, berkas yang baru diunggah dibuang. Menghapus Sales Order ikut menghapus berkasnya. Hanya Marketing, Admin, dan Direktur yang bisa membuka berkas ini.
- Setelah **Save**, data masuk ke **Data Sales Order**: No, Tanggal, No.PO, Nama Perusahaan, Item (selesai/total), Nilai (jumlah sebelum PPN), dengan aksi ubah, hapus, dan **cetak Work Order** (penandatangan sesuai pilihan di tab Purchase Order).
- Data disimpan di rekap JO/SO yang sama (tidak otomatis membuat proyek). Hak akses: Marketing, Admin, dan Direktur.

## Daftar Pekerjaan (pengganti Menu Pekerjaan)

- Menu **Menu Pekerjaan** diganti nama menjadi **Daftar Pekerjaan**. Halaman utamanya berupa tabel seperti Sales Order dengan kolom **No, No PO, Title, Pelanggan, Action** (cari, urut, halaman).
- **Pilih Pekerjaan** (hanya Admin): memilih Penanggung Jawab Teknik **Kusno Hadi Bitoyo** atau **Ahmad Fauzan Hamdhani**. Proyek dibuat otomatis bila belum ada, lalu pekerjaan diteruskan ke PJT (sama dengan langkah 2 alur). Setelah dipilih, tombol berubah menjadi **Sudah Dipilih** dan tidak aktif.
- **History** (semua peran): menampilkan posisi proses (10 langkah dari SPK hingga SLO Terbit), catatan aktivitas, dan tombol **Buka Alur Pekerjaan** untuk masuk ke alur detail (Leader, ST/JSA/Surat Jalan, review, laporan).
- **PJT** hanya menerima pekerjaan yang diteruskan Admin kepadanya (lalu menunjuk Leader); pekerjaan PJT lain atau yang belum diteruskan tidak tampil. **Tenaga Teknik** hanya melihat pekerjaan timnya.
- Panel "Teruskan ke PJT" lama di halaman detail proyek dihapus; **Daftar Pekerjaan → Pilih Pekerjaan** adalah satu-satunya pintu Admin meneruskan ke PJT.
- **Ganti PJT**: Admin dapat mengganti PJT selama Leader belum ditunjuk. Setelah Leader ditunjuk, PJT dikunci.
- Tiap pekerjaan menampilkan **lama di langkah sekarang** (dari catatan aktivitas terakhir); lebih dari 3 hari ditandai merah "perlu ditindaklanjuti".
- Proyek lama tanpa Sales Order tetap tampil, dengan No PO `-` dan keterangan "Belum ada Sales Order · Ref RFQ-…" di bawah Title (nomor RFQ tidak lagi dicampur ke kolom No PO).
- **Marketing** hanya melihat **History** (tanpa tombol Buka Alur Pekerjaan). **Direktur** tetap bisa membuka alur karena mereview & menandatangani Surat Tugas di sana.
