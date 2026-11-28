import type { SuratPenawaran, Pelanggan, JoSoRecord } from '../types/portal';
import { composePelangganAlamat } from './portalUtils';

/** ID Pelanggan berikutnya: nomor numerik terbesar + 1. */
export function nextIdPelanggan(records: Pelanggan[]): string {
  const nums = records.map((r) => parseInt(r.idPelanggan, 10)).filter((n) => Number.isFinite(n));
  return String((nums.length ? Math.max(...nums) : 0) + 1);
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

/** Usulan nomor penawaran: "{urut}/SDP/PNW/{bulan romawi}/{tahun}" (urut mengikuti nomor terbesar di tahun itu). */
export function suggestNoPenawaran(records: Pick<SuratPenawaran, 'noPenawaran' | 'tanggal'>[], tanggalIso: string): string {
  const d = new Date(`${(tanggalIso || '').slice(0, 10)}T00:00:00`);
  const valid = !Number.isNaN(d.getTime());
  const year = valid ? d.getFullYear() : new Date().getFullYear();
  const month = valid ? d.getMonth() : new Date().getMonth();
  let max = 0;
  for (const r of records) {
    if (!r.tanggal || new Date(`${r.tanggal.slice(0, 10)}T00:00:00`).getFullYear() !== year) continue;
    const m = /^(\d+)/.exec((r.noPenawaran || '').trim());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${max + 1}/SDP/PNW/${ROMAN[month]}/${year}`;
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export const PPN_RATE = 11;
export const DEFAULT_UP = 'Direktur Bapak/Ibu Pimpinan';

export interface HitungPenawaran {
  jumlah: number;
  ppn: number;
  total: number;
  /** Tarif PPN yang dipakai (0 bila Non PPN). */
  rate: number;
}

/** Jumlah, PPN 11% (hanya bila pilihan PPN = "PPN"), dan Jumlah Total. */
export function hitungPenawaran(items: { qty: number; harga: number }[], ppnOption: string): HitungPenawaran {
  const jumlah = items.reduce((s, it) => s + (it.qty || 0) * (it.harga || 0), 0);
  const rate = ppnOption === 'PPN' ? PPN_RATE : 0;
  const ppn = Math.round((jumlah * rate) / 100);
  return { jumlah, ppn, total: jumlah + ppn, rate };
}

const SATUAN = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];

function terbilangAngka(n: number): string {
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${terbilangAngka(n - 10)} Belas`;
  if (n < 100) return `${terbilangAngka(Math.floor(n / 10))} Puluh${n % 10 ? ` ${terbilangAngka(n % 10)}` : ''}`;
  if (n < 200) return `Seratus${n - 100 ? ` ${terbilangAngka(n - 100)}` : ''}`;
  if (n < 1000) return `${terbilangAngka(Math.floor(n / 100))} Ratus${n % 100 ? ` ${terbilangAngka(n % 100)}` : ''}`;
  if (n < 2000) return `Seribu${n - 1000 ? ` ${terbilangAngka(n - 1000)}` : ''}`;
  const units: [number, string][] = [
    [1e12, 'Triliun'],
    [1e9, 'Miliar'],
    [1e6, 'Juta'],
    [1e3, 'Ribu'],
  ];
  for (const [v, name] of units) {
    if (n >= v) {
      const rest = n % v;
      return `${terbilangAngka(Math.floor(n / v))} ${name}${rest ? ` ${terbilangAngka(rest)}` : ''}`;
    }
  }
  return '';
}

/** Terbilang rupiah, mis. 12210000 → "Dua Belas Juta Dua Ratus Sepuluh Ribu Rupiah". */
export function terbilangRupiah(value: number): string {
  const n = Math.round(Math.abs(value || 0));
  if (n === 0) return 'Nol Rupiah';
  return `${terbilangAngka(n)} Rupiah`;
}

/** Heading lama yang dulu ikut tersimpan di dalam isi Persyaratan; kini heading dicetak otomatis. */
export function stripHeadingPersyaratan(html: string): string {
  return (html || '').replace(/^\s*<p>\s*<b>\s*Persyaratan[^<]*<\/b>\s*<\/p>\s*/i, '');
}

export const DEFAULT_DENGAN_HORMAT =
  '<p>Menindaklanjuti permintaan mengenai [jenis layanan, mis. Perpanjangan SLO dan SKPPL PLTD 1 x 37.5 kVA] ' +
  'yang berlokasi di [lokasi instalasi] maka dengan ini disampaikan penawaran harga sebagai berikut:</p>';

export const DEFAULT_CATATAN =
  '<ol><li>Biaya belum termasuk PPN 11 %</li>' +
  '<li>Masa berlaku surat penawaran 30 hari sejak tanggal diterbitkan</li>' +
  '<li>Biaya tersebut sudah termasuk uji system pembumian (grounding) dan Uji Emisi Gas Buang pada lingkup SLO Pembangkit.</li>' +
  '<li>Sudah termasuk pendampingan pembuatan NIDI (Nomor Identitas Instalasi) melalui web Siujang Gatrik kementrian ESDM</li>' +
  '<li>Persyaratan, Cara Pembayaran, dan jadwal terlampir</li>' +
  '<li>Kontak Personal Ibu Nurma (085732914943) atau email sabda.duta@gmail.com</li></ol>';

/** Lampiran halaman 2 — daftar persyaratan & cara pembayaran (heading "Persyaratan SLO Pembangkit:" dicetak otomatis). */
export const DEFAULT_CARA_PEMBAYARAN =
  '<ol><li>Pada saat dilakukan pemeriksaan dan pengujian engine/genset dalam keadaan beroperasi dan berbeban</li>' +
  '<li>Biaya sudah termasuk transport dan akomodasi untuk 2 orang di lokasi selama pengujian untuk 1 kali kedatangan. ' +
  '<b>Apabila pekerjaan melebihi 1 kali kedatangan akibat ketidaksiapan instalasi, maka akan dikenakan biaya tambahan biaya transport dan akomodasi ditanggung pemilik instalasi.</b></li>' +
  '<li>Pemohon SLO wajib menyediakan sarana dan lubang pada exhaust untuk pengukuran emisi gas buang atau peralatan safety untuk naik ke atas lubang gas buang.</li>' +
  '<li>Cara Pembayaran sebagai berikut :' +
  '<ol type="a"><li>50% uang muka setelah SPK/PO/WO ditandatangani</li>' +
  '<li>50% setelah pemberitahuan SLO Terbit (copy SLO).</li>' +
  '<li>Penjadwalan pelaksanaan setelah diterima pembayaran DP 50 %</li>' +
  '<li>Pembayaran ke Rekening nomor : 14200.2688.2687 a/n. PT. Sabda Duta Paramitha Bank Mandiri KK. Ketintang Surabaya</li></ol></li></ol>';

/** Lampiran halaman 2 — data yang disediakan pemilik instalasi untuk Uji Laik Operasi. */
export const DEFAULT_DATA_PERSYARATAN =
  '<ol type="a"><li>NPWP Perusahaan</li>' +
  '<li>NIDI (Nomor Identitas Instalasi) melalui web Siujang Gatrik kementrian ESDM</li>' +
  '<li>IUPTL/IO (ijin Operasi / Laporan) dari P2T pelayanan perijinan terpadu</li>' +
  '<li>Gambar diagram satu garis (single line diagram) &amp; Grounding</li>' +
  '<li>Gambar tata letak instalasi/layout. Tata letak pemadam, system pentanahan</li>' +
  '<li>Lembar pengesahan AMDAL atau UKL-UPL dan Tanda Terima Laporan Berkala dari Dinas Terkait</li>' +
  '<li>Standart Operasi Prosedur (SOP)</li>' +
  '<li>Hasil pengujian komisioning yang telah dilaksanakan</li>' +
  '<li>Hasil Pengujian Lab Dampak Lingkungan</li></ol>';


/* ------------------------------------------------------------------ */
/* Sales Order (Create Order → Purchase Order / Work Order)            */
/* ------------------------------------------------------------------ */

/** Status penawaran yang sudah boleh dibuatkan PO (draft dan rejected belum). */
export const PENAWARAN_SIAP_PO = ['submit', 'approved'];

/** Penawaran yang siap di-create PO: statusnya submit/approved dan belum punya Sales Order. */
export function penawaranSiapPO(penawaran: SuratPenawaran[], salesOrders: Pick<JoSoRecord, 'penawaranId' | 'noPenawaran'>[]): SuratPenawaran[] {
  const idDipakai = new Set(salesOrders.map((r) => r.penawaranId).filter(Boolean));
  const noDipakai = new Set(salesOrders.map((r) => (r.noPenawaran || '').trim().toLowerCase()).filter(Boolean));
  return penawaran.filter(
    (p) => PENAWARAN_SIAP_PO.includes(p.status) && !idDipakai.has(p.id) && !noDipakai.has((p.noPenawaran || '').trim().toLowerCase()),
  );
}

/** Usulan nomor PO: "{urut 3 digit}/WO/SDP/{bulan romawi}/{tahun}", mis. 041/WO/SDP/VII/2026 (urut mengikuti nomor terbesar di tahun itu). */
export function suggestNoPO(records: Pick<JoSoRecord, 'poNo' | 'poDate'>[], tanggalIso: string): string {
  const d = new Date(`${(tanggalIso || '').slice(0, 10)}T00:00:00`);
  const valid = !Number.isNaN(d.getTime());
  const year = valid ? d.getFullYear() : new Date().getFullYear();
  const month = valid ? d.getMonth() : new Date().getMonth();
  let max = 0;
  for (const r of records) {
    const m = /^(\d+)\/WO\/SDP\/[IVX]+\/(\d{4})/i.exec((r.poNo || '').trim());
    const tahunNo = m ? Number(m[2]) : new Date(`${(r.poDate || '').slice(0, 10)}T00:00:00`).getFullYear();
    if (!m || tahunNo !== year) continue;
    max = Math.max(max, parseInt(m[1], 10));
  }
  return `${String(max + 1).padStart(3, '0')}/WO/SDP/${ROMAN[month]}/${year}`;
}

function tambahBulanIso(iso: string, bulan: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  d.setMonth(d.getMonth() + bulan);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Bentuk Sales Order baru dari satu penawaran (tab Penawaran terisi sama dengan Input Penawaran). */
export function salesOrderDariPenawaran(
  pnw: SuratPenawaran,
  pel: Pelanggan | undefined,
  records: Pick<JoSoRecord, 'poNo' | 'poDate'>[],
  nama: string,
  today: string,
): JoSoRecord {
  const alamat = pel?.alamat ?? '';
  const kota = pel?.kabKota ?? '';
  const kontakTelp = pel?.telp1 || pel?.telp2 || '';
  return {
    id: newId('joso'),
    penawaranId: pnw.id,
    tanggalPenawaran: pnw.tanggal,
    noPenawaran: pnw.noPenawaran,
    perihal: pnw.perihal,
    lampiran: pnw.lampiran,
    tanggalPermintaan: pnw.tanggalPermintaan,
    kepadaAlamat: composePelangganAlamat(nama, alamat, kota),
    namaPerusahaan: nama,
    alamatPerusahaan: alamat,
    kota,
    npwp: pel?.npwp ?? '',
    kontakNama: pel?.namaPic ?? '',
    kontakTelp,
    jenisInstalasiPenawaran: pnw.jenisPekerjaan,
    status: pnw.status === 'approved' ? 'approved' : 'submit',
    masaBerlaku: pnw.masaBerlaku,
    ppnRate: pnw.ppn === 'PPN' ? PPN_RATE : 0,
    items: pnw.items.map((it) => ({ id: newId('it'), itemName: it.nama, satuan: it.satuan, price: it.harga, qty: it.qty })),
    penandatangan: pnw.penandatangan,
    poNo: suggestNoPO(records, today),
    title: '',
    poDate: today,
    poExpiredDate: tambahBulanIso(today, 3),
    dp: 50,
    pelangganAlamat: composePelangganAlamat(nama, alamat, kota),
    jenisInstalasiJo: pnw.jenisPekerjaan,
    paymentTerm: '',
    documents: [],
    updatedAt: new Date().toISOString(),
  };
}
