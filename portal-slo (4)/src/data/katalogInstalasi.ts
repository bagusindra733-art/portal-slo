/**
 * Katalog klasifikasi instalasi: Bidang -> Sub Bidang -> Jenis Instalasi, beserta satuan kapasitas
 * yang diizinkan untuk tiap jenis. DATA INTERNAL: tidak boleh tercetak di Surat Penawaran maupun Work Order.
 *
 * Isi awal diturunkan dari 940 baris DJK di src/data/sloTerbit.json:
 * - nama bidang / sub bidang / jenis ditulis persis seperti di data DJK;
 * - satuan = satuan yang benar-benar muncul pada kolom Kapasitas/Daya jenis itu, yang paling sering dipakai di depan
 *   (jadi satuan bawaan). Salah ketik tidak dimasukkan: "VA" pada PLTD, "kVA" pada SKTM, dan "kva kVA" dibaca kVA.
 * Satuan yang di data hanya muncul 1-2 kali (mis. PLTGU hanya kVA, PLTB hanya MW) bisa ditambah langsung di sini.
 */
import type { KlasifikasiInstalasiFields } from '../types/portal';

export interface JenisInstalasiKatalog {
  nama: string;
  /** Satuan kapasitas yang diizinkan; yang pertama jadi bawaan. */
  satuan: string[];
}
export interface SubBidangKatalog {
  nama: string;
  jenis: JenisInstalasiKatalog[];
}
export interface BidangKatalog {
  nama: string;
  subBidang: SubBidangKatalog[];
}

export const KATALOG_INSTALASI: BidangKatalog[] = [
  {
    nama: 'Pembangkitan Tenaga Listrik',
    subBidang: [
      {
        nama: 'Pembangkit Listrik Tenaga Diesel',
        jenis: [
          { nama: 'INSTALASI PEMBANGKIT LISTRIK TENAGA DIESEL (PLTD) PERMANEN', satuan: ['kVA', 'kW'] },
          { nama: 'INSTALASI PEMBANGKIT LISTRIK TENAGA MESIN GAS (PLTMG)', satuan: ['kW', 'kVA'] },
        ],
      },
      {
        nama: 'Pembangkit Listrik Tenaga Uap',
        jenis: [
          { nama: 'INSTALASI PEMBANGKIT LISTRIK TENAGA UAP (PLTU)', satuan: ['MW', 'kVA'] },
        ],
      },
      {
        nama: 'Pembangkit Listrik Tenaga Biomassa',
        jenis: [
          { nama: 'INSTALASI PEMBANGKIT LISTRIK TENAGA BIOMASSA (PLTBm)', satuan: ['kVA', 'kW'] },
        ],
      },
      {
        nama: 'Pembangkit Listrik Tenaga Surya',
        jenis: [
          { nama: 'INSTALASI PEMBANGKIT LISTRIK TENAGA SURYA (PLTS)', satuan: ['kW', 'kWp'] },
        ],
      },
      {
        nama: 'Pembangkit Listrik Tenaga Gas',
        jenis: [
          { nama: 'INSTALASI PEMBANGKIT LISTRIK TENAGA GAS (PLTG)', satuan: ['kVA', 'kW'] },
        ],
      },
      {
        nama: 'Pembangkit Listrik Tenaga Biogas',
        jenis: [
          { nama: 'INSTALASI PEMBANGKIT LISTRIK TENAGA BIOGAS (PLTBg)', satuan: ['kVA', 'kW'] },
        ],
      },
      {
        nama: 'Pembangkit Listrik Tenaga Bayu',
        jenis: [
          { nama: 'INSTALASI PEMBANGKIT LISTRIK TENAGA BAYU (PLTB)', satuan: ['MW'] },
        ],
      },
      {
        nama: 'Pembangkit Listrik Tenaga Gas-Uap',
        jenis: [
          { nama: 'INSTALASI PEMBANGKIT LISTRIK TENAGA GAS UAP (PLTGU)', satuan: ['kVA'] },
        ],
      },
    ],
  },
  {
    nama: 'Transmisi Tenaga Listrik',
    subBidang: [
      {
        nama: 'Gardu Induk',
        jenis: [
          { nama: 'INSTALASI BAY LINE', satuan: ['kA', 'kV'] },
          { nama: 'INSTALASI BAY TRANSFORMATOR', satuan: ['MVA'] },
          { nama: 'INSTALASI BAY BUS COUPLER', satuan: ['kV', 'kA'] },
        ],
      },
      {
        nama: 'Jaringan Transmisi Tenaga Listrik Tegangan Tinggi, Tegangan Ekstra Tinggi dan/atau Tegangan Ultra Tinggi',
        jenis: [
          { nama: 'INSTALASI SALURAN KABEL TEGANGAN TINGGI (SKTT)', satuan: ['kV'] },
        ],
      },
    ],
  },
  {
    nama: 'Distribusi Tenaga Listrik',
    subBidang: [
      {
        nama: 'Jaringan Distribusi Tenaga Listrik Tegangan Menengah',
        jenis: [
          { nama: 'INSTALASI SALURAN KABEL TEGANGAN MENENGAH (SKTM)', satuan: ['kV', 'kms'] },
          { nama: 'INSTALASI GARDU DISTRIBUSI PASANGAN DALAM', satuan: ['kV', 'MVA', 'kVA'] },
          { nama: 'INSTALASI PERALATAN HUBUNG BAGI TEGANGAN MENENGAH', satuan: ['kV'] },
          { nama: 'INSTALASI SALURAN UDARA TEGANGAN MENENGAH (SUTM)', satuan: ['kV'] },
          { nama: 'INSTALASI GARDU DISTRIBUSI PASANGAN LUAR', satuan: ['kV'] },
        ],
      },
      {
        nama: 'Jaringan Distribusi Tenaga Listrik Tegangan Rendah',
        jenis: [
          { nama: 'INSTALASI SALURAN KABEL TEGANGAN RENDAH (SKTR)', satuan: ['kV'] },
        ],
      },
    ],
  },
  {
    nama: 'Instalasi Pemanfaatan Tenaga Listrik',
    subBidang: [
      {
        nama: 'Instalasi Pemanfaatan Tenaga Listrik Tegangan Menengah',
        jenis: [
          { nama: 'INSTALASI PEMANFAATAN TENAGA LISTRIK TEGANGAN MENENGAH', satuan: ['VA', 'kVA'] },
        ],
      },
      {
        nama: 'Instalasi Pemanfaatan Tenaga Listrik Tegangan Tinggi',
        jenis: [
          { nama: 'INSTALASI INSTALASI PEMANFAATAN TENAGA LISTRIK TEGANGAN TINGGI', satuan: ['VA', 'kVA'] },
        ],
      },
    ],
  },
];

/* ------------------- jenis pekerjaan -> bidang / sub bidang ------------------- */

const B_PEMBANGKIT = 'Pembangkitan Tenaga Listrik';
const B_TRANSMISI = 'Transmisi Tenaga Listrik';
const B_DISTRIBUSI = 'Distribusi Tenaga Listrik';
const B_PEMANFAATAN = 'Instalasi Pemanfaatan Tenaga Listrik';
const S_JTT = 'Jaringan Transmisi Tenaga Listrik Tegangan Tinggi, Tegangan Ekstra Tinggi dan/atau Tegangan Ultra Tinggi';
const S_JTM = 'Jaringan Distribusi Tenaga Listrik Tegangan Menengah';

interface KlasifikasiJenisPekerjaan {
  bidang: string;
  subBidang: string;
  satuan: string[];
}

/**
 * Kode Jenis Pekerjaan (bagian sebelum "|" pada JENIS_INSTALASI_SOJO, huruf kecil) -> Bidang, Sub Bidang, dan satuan
 * kapasitas yang diizinkan (yang pertama jadi bawaan). Bidang/Sub Bidang tidak diisi manual: ikut Jenis Pekerjaan.
 */
const KLASIFIKASI_JENIS_PEKERJAAN: Record<string, KlasifikasiJenisPekerjaan> = {
  bess: { bidang: B_PEMBANGKIT, subBidang: 'Battery Energy Storage System', satuan: ['MW', 'MWh', 'kW', 'kWh'] },
  pltb: { bidang: B_PEMBANGKIT, subBidang: 'Pembangkit Listrik Tenaga Bayu', satuan: ['MW'] },
  pltbm: { bidang: B_PEMBANGKIT, subBidang: 'Pembangkit Listrik Tenaga Biomassa', satuan: ['kVA', 'kW'] },
  pltd: { bidang: B_PEMBANGKIT, subBidang: 'Pembangkit Listrik Tenaga Diesel', satuan: ['kVA', 'kW'] },
  pltg: { bidang: B_PEMBANGKIT, subBidang: 'Pembangkit Listrik Tenaga Gas', satuan: ['kVA', 'kW'] },
  pltgu: { bidang: B_PEMBANGKIT, subBidang: 'Pembangkit Listrik Tenaga Gas-Uap', satuan: ['kVA', 'MW'] },
  plts: { bidang: B_PEMBANGKIT, subBidang: 'Pembangkit Listrik Tenaga Surya', satuan: ['kW', 'kWp'] },
  pltu: { bidang: B_PEMBANGKIT, subBidang: 'Pembangkit Listrik Tenaga Uap', satuan: ['MW', 'kVA'] },
  'pemanfaatan-2': { bidang: B_PEMANFAATAN, subBidang: 'Instalasi Pemanfaatan Tenaga Listrik Tegangan Tinggi', satuan: ['kVA', 'VA'] },
  'pemanfaatan-1': { bidang: B_PEMANFAATAN, subBidang: 'Instalasi Pemanfaatan Tenaga Listrik Tegangan Menengah', satuan: ['kVA', 'VA'] },
  'pemanfaatan-0': { bidang: B_PEMANFAATAN, subBidang: 'Instalasi Pemanfaatan Tenaga Listrik Tegangan Rendah', satuan: ['kVA', 'VA'] },
  'transmisi 0': { bidang: B_TRANSMISI, subBidang: 'Gardu Induk', satuan: ['MVA', 'kV', 'kA'] },
  'transmisi 1': { bidang: B_TRANSMISI, subBidang: S_JTT, satuan: ['kV'] },
  'transmisi 2': { bidang: B_TRANSMISI, subBidang: S_JTT, satuan: ['kV'] },
  'transmisi 3': { bidang: B_TRANSMISI, subBidang: S_JTT, satuan: ['kV'] },
  'distribusi 0': { bidang: B_DISTRIBUSI, subBidang: S_JTM, satuan: ['kV'] },
  'distribusi 1': { bidang: B_DISTRIBUSI, subBidang: S_JTM, satuan: ['kV'] },
  'distribusi 2': { bidang: B_DISTRIBUSI, subBidang: S_JTM, satuan: ['kV', 'kms'] },
  'distribusi 3': { bidang: B_DISTRIBUSI, subBidang: S_JTM, satuan: ['kV', 'MVA', 'kVA'] },
  'distribusi 4': { bidang: B_DISTRIBUSI, subBidang: S_JTM, satuan: ['kV'] },
  'distribusi 5': { bidang: B_DISTRIBUSI, subBidang: S_JTM, satuan: ['kV'] },
};

const klasifikasiJenisPekerjaan = (jenisPekerjaan?: string) =>
  KLASIFIKASI_JENIS_PEKERJAAN[(jenisPekerjaan || '').split('|')[0].trim().toLowerCase()];

/** Bidang + Sub Bidang dari Jenis Pekerjaan; objek kosong bila jenisnya tidak dikenal (mis. data lama). */
export function klasifikasiDariJenisPekerjaan(jenisPekerjaan?: string): KlasifikasiInstalasiFields {
  const k = klasifikasiJenisPekerjaan(jenisPekerjaan);
  return k ? { klasifikasiBidang: k.bidang, klasifikasiSubBidang: k.subBidang } : {};
}

/** Satuan kapasitas yang diizinkan untuk satu Jenis Pekerjaan; kosong bila tidak dikenal. */
export const satuanJenisPekerjaan = (jenisPekerjaan?: string): string[] =>
  klasifikasiJenisPekerjaan(jenisPekerjaan)?.satuan ?? [];

/* ---------------------------- pencarian ---------------------------- */

const cariBidang = (b?: string) => KATALOG_INSTALASI.find((x) => x.nama === b);
const cariSub = (b?: string, s?: string) => cariBidang(b)?.subBidang.find((x) => x.nama === s);
const cariJenis = (b?: string, s?: string, j?: string) => cariSub(b, s)?.jenis.find((x) => x.nama === j);

export const daftarBidang = (): string[] => KATALOG_INSTALASI.map((x) => x.nama);
export const daftarSubBidang = (b?: string): string[] => cariBidang(b)?.subBidang.map((x) => x.nama) ?? [];
export const daftarJenis = (b?: string, s?: string): string[] => cariSub(b, s)?.jenis.map((x) => x.nama) ?? [];
/** Satuan yang diizinkan untuk satu jenis; kosong bila jenis belum dipilih / tidak ada di katalog. */
export const daftarSatuan = (b?: string, s?: string, j?: string): string[] => cariJenis(b, s, j)?.satuan ?? [];

/* ------------------------------ kapasitas ------------------------------ */

/**
 * Baca angka kapasitas ketikan pengguna. Koma = desimal (format Indonesia, "562,5"), titik ribuan ("1.250,5").
 * Tanpa koma: titik tunggal diperlakukan desimal ("2.5", "0.385"), kecuali tepat 3 angka di belakangnya dan
 * bagian depan bukan 0 ("1.250" = 1250). Tidak valid / kosong -> null.
 */
export function parseKapasitasNilai(teks: string): number | null {
  const t = (teks || '').replace(/\s+/g, '');
  if (!/^\d[\d.,]*$/.test(t)) return null;
  let s = t;
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    const bagian = s.split('.');
    if (bagian.length > 2 || (bagian.length === 2 && bagian[1].length === 3 && bagian[0] !== '0')) s = bagian.join('');
  }
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Angka -> teks isian (koma desimal, tanpa pemisah ribuan agar bisa dibaca ulang persis). */
export const teksKapasitasNilai = (n: number | null | undefined): string =>
  n === null || n === undefined || !Number.isFinite(n) ? '' : String(n).replace('.', ',');

/* ------------------------------ rekaman ------------------------------ */

/** Ambil hanya kolom klasifikasi/kapasitas-baru dari sebuah rekaman (untuk disalin ke rekaman lain). */
export function ambilKlasifikasi(rec?: Partial<KlasifikasiInstalasiFields> | null): KlasifikasiInstalasiFields {
  const out: KlasifikasiInstalasiFields = {};
  if (!rec) return out;
  if (rec.klasifikasiBidang !== undefined) out.klasifikasiBidang = rec.klasifikasiBidang;
  if (rec.klasifikasiSubBidang !== undefined) out.klasifikasiSubBidang = rec.klasifikasiSubBidang;
  if (rec.klasifikasiJenis !== undefined) out.klasifikasiJenis = rec.klasifikasiJenis;
  if (rec.kapasitasNilai !== undefined) out.kapasitasNilai = rec.kapasitasNilai;
  if (rec.kapasitasSatuan !== undefined) out.kapasitasSatuan = rec.kapasitasSatuan;
  return out;
}

/**
 * Pesan kesalahan untuk ditampilkan saat Simpan; null bila sah. Semua kolom boleh dikosongkan.
 * Bidang/Sub Bidang mengikuti Jenis Pekerjaan, jadi yang diperiksa tinggal kapasitas dan satuannya.
 * `jenisPekerjaan` (bila ada dan dikenal) menentukan satuan yang diizinkan.
 */
export function validasiKlasifikasi(k: KlasifikasiInstalasiFields, jenisPekerjaan?: string): string | null {
  const diizinkan = klasifikasiJenisPekerjaan(jenisPekerjaan)
    ? satuanJenisPekerjaan(jenisPekerjaan)
    : daftarSatuan(k.klasifikasiBidang, k.klasifikasiSubBidang, k.klasifikasiJenis);
  const nilai = k.kapasitasNilai;
  if (nilai !== null && nilai !== undefined) {
    if (!Number.isFinite(nilai) || nilai < 0) return 'Kapasitas harus berupa angka 0 atau lebih';
    if (!k.kapasitasSatuan) return 'Pilih satuan kapasitas';
  }
  if (k.kapasitasSatuan && diizinkan.length > 0 && !diizinkan.includes(k.kapasitasSatuan)) {
    return `Satuan ${k.kapasitasSatuan} tidak diizinkan untuk jenis pekerjaan ini`;
  }
  return null;
}
