# Portal SLO — PT. Sabda Duta Paramitha

Sistem manajemen Sertifikasi Laik Operasi (Surat Tugas, Surat Jalan Alat, JSA, Rekap, Inventaris).
Frontend: React + Vite + Tailwind. Server: Google Apps Script + Google Sheets/Drive (`google-apps-script/Code.gs`).

## Menjalankan lokal
1. `npm install` (atau `bun install`)
2. Buat file `.env.local`, isi:
   ```
   VITE_LOGIN_API_URL=<URL Web App Apps Script yang berakhiran /exec>
   VITE_IDLE_MINUTES=15
   ```
   `VITE_IDLE_MINUTES` = lama tidak aktif sebelum keluar otomatis (menit); `0` untuk menonaktifkan.
3. `npm run dev`

## Dokumen lain
- `PANDUAN_AKUN_SHEET.md` — pengaturan akun di Google Sheet
- `ALUR_KERJA.md` — alur kerja tiap peran
- `PERUBAHAN_KEAMANAN.md` — catatan keamanan dan cara pasang server

## Lint & Test

```bash
bun install          # atau npm install
npm run lint         # tsc --noEmit + ESLint
npm test             # Vitest (unit test fungsi kritis di src/utils/__tests__)
```

Cakupan awal: `portalUtils.ts` — perhitungan harga/PPN, status & penguncian sertifikat,
Surat Tugas/Jalan/JSA, sinkronisasi JO/SO ↔ Proyek, evaluasi kelayakan, dan alur kerja.
