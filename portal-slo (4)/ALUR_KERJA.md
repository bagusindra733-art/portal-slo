# Alur Kerja Portal SLO

Alur ringkas: **6 langkah**. Semua tindakan ada di kolom **Action** pada **Daftar Pekerjaan** — tombol yang muncul menyesuaikan peran dan langkah. Tombol **History** hanya untuk melihat riwayat, bukan untuk bekerja.

| # | Siapa | Apa yang dilakukan | Tombol di Action |
|---|-------|--------------------|------------------|
| 1 | **Marketing** | Membuat Penawaran dan Sales Order (JO/SO). | — (menu Penjualan) |
| 2 | **Admin** | Daftar Sales Order tampil di Admin, lalu diteruskan ke **PJT sesuai bidangnya**. | **Pilih PJT** (bisa **Ganti PJT** selama Leader belum ditunjuk) |
| 3 | **PJT** | Menunjuk **Leader dan tim**. | **Tunjuk Leader & Tim** |
| 4 | **Leader & tim** | Akses terbuka untuk Leader **dan anggota**; keduanya dapat membuat **Surat Tugas → Surat Jalan Alat → JSA**, lalu mengirim ke Direktur. | **Buat ST, JSA & Surat Jalan** (→ **Kirim ke Direktur**) |
| 5 | **Direktur** | Review, beri komentar, **TTD** Surat Tugas. Setelah TTD otomatis diteruskan ke Admin. Bila tidak sesuai → **kembali ke Leader** untuk revisi. | **Review & TTD** |
| 6 | **Admin** | Input **Layanan SLO (Verifikasi LIT)** dan buat **No. Agenda DJK ESDM** per instalasi, sampai **SLO terbit**. | **Input Layanan SLO** |

Catatan:
- Nama PJT otomatis tidak bisa dipilih sebagai Leader/anggota tim pada pekerjaan yang sama.
- **Pekerjaan selesai saat SLO terbit** (semua instalasi berstatus *SLO Terbit*; proyek ditutup otomatis).
- Tahap setelah Verifikasi LIT (pengerjaan TT, pengesahan PJT, evaluasi, generate & cetak SLO) berjalan per instalasi di menu **Layanan SLO**.
- Dihapus dari alur: pemberitahuan status Leader (*Siap Uji* dsb.), review dokumen oleh PJT, dan langkah "teruskan ke TT" oleh Direktur.
- Pekerjaan lama dengan status lama tetap terbaca (dipetakan ke langkah Admin).

## Kemudahan penggunaan
- **Panduan singkat**: tombol **?** di pojok kanan atas (dialog): tugas sesuai peran, alur 6 langkah (bagian Anda ditandai), dan arti istilah.
- Singkatan bergaris titik (PJT, dll.) menampilkan arti saat disentuh/diarahkan kursor. Kamus ada di `src/data/istilah.ts`.
- **Daftar Pekerjaan** tampil sebagai kartu di ponsel dan tabel di layar lebar.
- Teks UI minimal 12 px; tombol aksi setinggi 40 px.

Menu **Dokumen** (tab **Rekap Dokumen** dan tab **Inventaris Perusahaan**). Tab Inventaris Perusahaan: dokumen resmi perusahaan. Admin menambah/menghapus; peran lain melihat & mengunduh.

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
- Akses: tombol **Work Order** di setiap baris Data Sales Order, atau **Lihat & Unduh Work Order (PDF)** di panel samping form. Pratinjau memakai data yang sedang diisi (belum perlu disimpan).
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
- **History** (semua peran): langsung membuka tabel Alur Pekerjaan pekerjaan tersebut (tanpa tombol perantara). Untuk pekerjaan yang belum dipilih Admin, History menampilkan posisi proses awal.
- **PJT** hanya menerima pekerjaan yang diteruskan Admin kepadanya (lalu menunjuk Leader); pekerjaan PJT lain atau yang belum diteruskan tidak tampil. **Tenaga Teknik** hanya melihat pekerjaan timnya.
- Panel "Teruskan ke PJT" lama di halaman detail proyek dihapus; **Daftar Pekerjaan → Pilih Pekerjaan** adalah satu-satunya pintu Admin meneruskan ke PJT.
- **Ganti PJT**: Admin dapat mengganti PJT selama Leader belum ditunjuk. Setelah Leader ditunjuk, PJT dikunci.
- Tiap pekerjaan menampilkan **lama di langkah sekarang** (dari catatan aktivitas terakhir); lebih dari 3 hari ditandai merah "perlu ditindaklanjuti".
- Proyek lama tanpa Sales Order tetap tampil, dengan No PO `-` dan keterangan "Belum ada Sales Order · Ref RFQ-…" di bawah Title (nomor RFQ tidak lagi dicampur ke kolom No PO).
- **PJT**: tombol **Tunjuk Leader** (atau **Ganti Leader** sebelum Leader mengirim status pekerjaan) langsung ada di kolom Action Daftar Pekerjaan, tanpa perlu membuka alur detail.

## Alur Pekerjaan model tabel (halaman detail)

- Halaman detail pekerjaan (**Buka Alur Pekerjaan**) kini berupa **tabel langkah**: No, Langkah, Penanggung Jawab, Status (Selesai / Sedang berjalan / Menunggu), Action. Ditambah dua baris: **Instalasi & No. Agenda DJK** dan **Berkas & Riwayat**.
- Tombol **Kerjakan** (langkah yang sedang berjalan dan sesuai peran Anda) atau **Lihat** membuka panel langkah tersebut dalam jendela popup. Isi panel (kirim status, ST/JSA/Surat Jalan, review PJT, TTD Direktur, laporan, SLO) sama seperti sebelumnya; hanya tampil per langkah.
- Tenaga Teknik: langkah ST/JSA/Surat Jalan tetap mensyaratkan status **Siap Uji** terlebih dahulu.
- Membuka editor dokumen (Surat Tugas/JSA/Surat Jalan) menutup popup; setelah selesai, Anda kembali ke tabel.

## Penyempurnaan Daftar Pekerjaan

- Kolom **Langkah Sekarang** di tabel utama (langkah aktif + penanggung jawabnya, serta ringkasan "X dari Y instalasi SLO terbit" bila ada instalasi). Penanda **Giliran Anda** muncul pada pekerjaan yang menunggu tindakan Anda.
- Tombol **Perlu tindakan saya (N)** menyaring pekerjaan yang menunggu tindakan peran Anda: Admin (belum dipilih / terbitkan SLO), PJT (tunjuk Leader, review dokumen, review laporan, informasi SLO terbit), Leader (status pekerjaan, ST/JSA/Surat Jalan, laporan), Anggota (laporan), Direktur (review & TTD).
- Setelah menyimpan dokumen di editor Surat Tugas/JSA/Surat Jalan, popup langkah yang tadi dibuka otomatis terbuka kembali.

## Status tombol (selesai / menunggu)

Warna mengikuti tema website. Di **Daftar Pekerjaan → Action** dan **Layanan SLO**, tombol langkah punya tiga keadaan:

| Keadaan | Tampilan | Bisa diklik |
|---------|----------|-------------|
| Giliran Anda | Tombol aksi berwarna (ungu / hijau) | Ya |
| Sudah dikerjakan | Hijau muda, tanda ✓, teks berisi hasilnya (mis. "PJT: Kusno Hadi", "Terkirim ke Direktur", "Sudah ditandatangani", "SLO terbit") | Tidak |
| Menunggu langkah sebelumnya | Abu-abu, ikon gembok (mis. "Menunggu PJT") | Tidak |

Tombol **Ganti PJT** dan **Ganti Leader & Tim** tetap aktif selama masih diizinkan (Leader belum menunjuk/mengirim dokumen).

## Rekap JO/SO dihapus

- Menu **Rekap JO / SO** (dan editor lamanya) dihapus. Pembuatan dan perubahan Sales Order kini hanya lewat menu **Sales Order → Create Order / Data Sales Order**; datanya tetap sama.
- **Direktur** hanya bisa melihat Sales Order (ikon mata, isian terkunci, tanpa tombol Save/Hapus) dan tidak punya menu Create Order.
- Ikut hilang: tombol *Simpan & Kirim ke Admin*, *Ekspor CSV*, dan *Buat Surat Tugas dari JO/SO*. Surat Tugas dibuat Leader dari Daftar Pekerjaan.
- Tombol *Tinjau/Edit JO/SO Terkait* di halaman detail pekerjaan juga dihapus.

## Overview per peran

Overview menjawab **"apa yang perlu saya kerjakan sekarang?"**, bukan sekadar statistik. Semua angka dihitung dari alur 6 langkah dan tahap Layanan SLO per instalasi; tidak ada lagi data karangan.

**Untuk semua peran**

- **Perlu tindakan saya (N)** — pekerjaan yang sedang giliran peran Anda, urut dari yang paling lama menunggu. Aturan dan angkanya sama dengan tombol *Perlu tindakan saya* di Daftar Pekerjaan (memakai `giliranSaya`). Pekerjaan diam lebih dari 3 hari bergaris merah. Klik baris untuk membuka pekerjaan (Direktur & Leader langsung ke panel kerjanya).
- **Pipeline pekerjaan (6 langkah)** — jumlah pekerjaan di tiap langkah; langkah milik peran Anda disorot, dan angka yang macet ditandai. Klik kartu untuk membuka Daftar Pekerjaan yang sudah difilter ke langkah itu (chip filter bisa dihapus). Langkah 1 menghitung penawaran yang belum dibuatkan Sales Order.
- **Instalasi per tahap Layanan SLO** — jumlah instalasi di tiap tahap (Verifikasi LIT … SLO Terbit) dan ringkasan "X dari Y instalasi SLO terbit". Tenaga Teknik hanya menghitung instalasi miliknya, PJT hanya proyeknya.
- **Portofolio per jenis instalasi** dan **Tren SLO Terbit per tahun** (data Excel DJK).

**Panel tambahan per peran**

| Peran | Isi panel |
|-------|-----------|
| Admin | Belum dipilih PJT, instalasi menunggu Admin, sertifikat/kalibrasi terkunci dan akan habis (+ 3 yang paling mendesak) |
| Marketing | Penawaran draft, penawaran belum dibuatkan PO (daftar tindakan = penawaran yang perlu dilanjutkan), Sales Order bulan ini |
| PJT | Perlu menunjuk Leader, instalasi menunggu pengesahan, pekerjaan aktif/selesai |
| Tenaga Teknik | Pekerjaan tim saya, instalasi perlu laporan (berapa yang belum punya laporan), masa berlaku SKTTK saya |
| Direktur | Surat Tugas menunggu TTD, total/aktif/selesai, instalasi SLO terbit, SLO terbit tahun ini vs tahun lalu |

**Dihapus dari Overview:** kartu "Terkunci / Temuan" (pengujian & temuan sudah tidak ada di portal), donut status lama (`paid`, `testing`, `approvedPJT`, …), sparkline karangan, bintang & ikon piala yang tidak mengukur apa pun, peringkat inspektor, dan "Antrean Terbaru" (3 proyek pertama tanpa petunjuk siapa yang bertindak).

Kode: logika di `src/utils/overviewUtils.ts` (diuji di `src/utils/__tests__/overviewUtils.test.ts`), tampilan di `src/components/DashboardOverview.tsx`. Helper `giliranSaya`, `hariDiLangkah`, dan `pekerjaanSudahDipilih` kini ada di `portalUtils.ts` agar dipakai bersama Daftar Pekerjaan dan Overview.
