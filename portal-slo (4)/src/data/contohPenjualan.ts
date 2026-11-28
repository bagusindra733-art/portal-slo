/**
 * Data contoh (fiktif) untuk Master Data Pelanggan, Penawaran, dan Sales Order.
 * Semua nama perusahaan, alamat, telepon, dan NPWP di sini rekaan, hanya untuk demo.
 * Dipakai oleh seedDatabase() dan tombol "kembalikan ke contoh awal".
 */
import {
  DOC_CONFIG,
  JENIS_INSTALASI_SOJO,
  type JoSoDetailItem,
  type JoSoRecord,
  type JoSoStatus,
  type Pelanggan,
  type SuratPenawaran,
} from '../types/portal';
import {
  DEFAULT_CARA_PEMBAYARAN,
  DEFAULT_CATATAN,
  DEFAULT_DATA_PERSYARATAN,
  DEFAULT_UP,
  PPN_RATE,
} from '../utils/penawaranUtils';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const bulanRomawi = (iso: string) => ROMAN[Number(iso.slice(5, 7)) - 1];
const tahun = (iso: string) => iso.slice(0, 4);

/* ------------------------------------------------------------------ */
/* 10 pelanggan                                                        */
/* ------------------------------------------------------------------ */

type PelRow = [
  prefix: string,
  nama: string,
  alamat: string,
  provinsi: string,
  kabKota: string,
  namaPic: string,
  telp: string,
  email: string,
  npwp: string,
  klasifikasi: string,
  kualifikasi: string,
];

const PEL_ROWS: PelRow[] = [
  ['PT', 'Surya Mandiri Logam', 'Jl. Raya Gresik KM 12, Kec. Kebomas', 'JAWA TIMUR', 'KABUPATEN GRESIK', 'Hendra Wijaya', '081234500101', 'k3@suryamandirilogam.example', '01.234.567.8-611.000', 'Manufaktur Logam', 'Non Small Business'],
  ['PT', 'Tirta Energi Nusantara', 'Kawasan SIER Rungkut Blok C-14', 'JAWA TIMUR', 'KOTA SURABAYA', 'Dewi Kusumawati', '081234500102', 'umum@tirtaenergi.example', '02.345.678.9-612.000', 'Pengolahan Air & Energi', 'Non Small Business'],
  ['CV', 'Mitra Karya Elektrik', 'Jl. Ahmad Yani No. 88, Kec. Waru', 'JAWA TIMUR', 'KABUPATEN SIDOARJO', 'Slamet Riyadi', '081234500103', 'admin@mitrakaryaelektrik.example', '03.456.789.0-643.000', 'Kontraktor Kelistrikan', 'Small Business'],
  ['PT', 'Kaltim Prima Agro', 'Jl. Poros Bontang-Sangatta KM 7', 'KALIMANTAN TIMUR', 'KABUPATEN KUTAI TIMUR', 'Rudi Hartanto', '081234500104', 'engineering@kaltimprimaagro.example', '04.567.890.1-724.000', 'Perkebunan Sawit', 'Non Small Business'],
  ['PT', 'Bumi Sejahtera Pangan', 'Jl. Raya Mojosari No. 45, Kec. Mojosari', 'JAWA TIMUR', 'KABUPATEN MOJOKERTO', 'Ratna Sari', '081234500105', 'ratna@bumisejahterapangan.example', '05.678.901.2-613.000', 'Industri Makanan', 'Non Small Business'],
  ['PT', 'Samudra Cold Storage', 'Jl. Tanjung Perak Timur No. 9', 'JAWA TIMUR', 'KOTA SURABAYA', 'Agus Prasetyo', '081234500106', 'ops@samudracold.example', '06.789.012.3-614.000', 'Pergudangan Pendingin', 'Small Business'],
  ['PT', 'Cahaya Bintang Tekstil', 'Jl. Raya Porong KM 30, Kec. Porong', 'JAWA TIMUR', 'KABUPATEN SIDOARJO', 'Linda Hermawan', '081234500107', 'maintenance@cahayabintang.example', '07.890.123.4-615.000', 'Industri Tekstil', 'Non Small Business'],
  ['PT', 'Nusa Tenggara Mineral', 'Jl. Lintas Sumbawa Barat KM 21', 'NUSA TENGGARA BARAT', 'KABUPATEN SUMBAWA BARAT', 'Made Suartana', '081234500108', 'electrical@nusamineral.example', '08.901.234.5-908.000', 'Pertambangan', 'Non Small Business'],
  ['UD', 'Berkah Jaya Teknik', 'Jl. Diponegoro No. 21', 'JAWA TENGAH', 'KOTA SEMARANG', 'Imam Santoso', '081234500109', 'berkahjayateknik@example.com', '09.012.345.6-518.000', 'Jasa Teknik', 'Agent'],
  ['PT', 'Sulawesi Smelter Utama', 'Kawasan Industri Morosi Blok B', 'SULAWESI TENGGARA', 'KABUPATEN KONAWE', 'Andi Mappaseng', '081234500110', 'plant@sulawesismelter.example', '10.123.456.7-826.000', 'Smelter Nikel', 'Non Small Business'],
];

export function contohPelanggan(): Pelanggan[] {
  return PEL_ROWS.map((r, i) => {
    const at = `2026-0${i < 5 ? 6 : 7}-${String(5 + i * 2).padStart(2, '0')}T03:00:00.000Z`;
    return {
      id: `pel-contoh-${i + 1}`,
      idPelanggan: String(i + 1),
      email: r[7],
      nama: r[1],
      alamat: r[2],
      provinsi: r[3],
      kabKota: r[4],
      namaPic: r[5],
      telp1: r[6],
      telp2: '',
      npwp: r[8],
      companyType: 'Company',
      companyPrefix: r[0],
      companyClassification: r[9],
      companyQualification: r[10],
      createdAt: at,
      updatedAt: at,
    };
  });
}

/* ------------------------------------------------------------------ */
/* 10 penawaran                                                        */
/* ------------------------------------------------------------------ */

type ItemRow = [nama: string, satuan: string, qty: number, harga: number, kategori: 'jasa' | 'mobilisasi'];

interface PnwRow {
  pel: number; // indeks pelanggan (0-9)
  tanggal: string;
  permintaan: string;
  jenis: number; // indeks JENIS_INSTALASI_SOJO
  perihal: string;
  status: string;
  ppn: 'PPN' | 'Non PPN';
  items: ItemRow[];
}

const PNW_ROWS: PnwRow[] = [
  {
    pel: 0, tanggal: '2026-07-06', permintaan: '2026-06-29', jenis: 1, perihal: 'Penawaran SLO PLTD 2 x 1.000 kVA', status: 'approved', ppn: 'PPN',
    items: [
      ['SLO PLTD Genset #1 1.000 kVA', 'Unit', 1, 18500000, 'jasa'],
      ['SLO PLTD Genset #2 1.000 kVA', 'Unit', 1, 18500000, 'jasa'],
      ['Uji emisi gas buang & pembumian', 'Paket', 1, 6000000, 'jasa'],
      ['Transport dan akomodasi Gresik', 'Lot', 1, 1500000, 'mobilisasi'],
    ],
  },
  {
    pel: 1, tanggal: '2026-07-21', permintaan: '2026-07-14', jenis: 6, perihal: 'Penawaran SLO Instalasi Pemanfaatan TM 1.600 kVA', status: 'approved', ppn: 'PPN',
    items: [
      ['SLO Pemanfaatan TM Gardu 1.600 kVA', 'Unit', 1, 14000000, 'jasa'],
      ['Pengujian relay proteksi & kabel TM', 'Paket', 1, 7500000, 'jasa'],
    ],
  },
  {
    pel: 2, tanggal: '2026-08-04', permintaan: '2026-07-30', jenis: 9, perihal: 'Penawaran SLO Distribusi JTM 20 kV', status: 'submit', ppn: 'PPN',
    items: [
      ['SLO Jaringan Distribusi JTM 20 kV 4,5 kms', 'Paket', 1, 21000000, 'jasa'],
      ['SLO Gardu Distribusi 400 kVA', 'Unit', 3, 4200000, 'jasa'],
      ['Mobilisasi Tim & Alat Sidoarjo', 'Lot', 1, 1200000, 'mobilisasi'],
    ],
  },
  {
    pel: 3, tanggal: '2026-08-18', permintaan: '2026-08-10', jenis: 1, perihal: 'Penawaran SLO PLTD 3 x 1.250 kVA', status: 'approved', ppn: 'PPN',
    items: [
      ['SLO PLTD Genset 1.250 kVA', 'Unit', 3, 21500000, 'jasa'],
      ['Uji emisi gas buang', 'Unit', 3, 2500000, 'jasa'],
      ['Transport dan akomodasi 4 x kedatangan', 'Unit', 4, 9750000, 'mobilisasi'],
    ],
  },
  {
    pel: 4, tanggal: '2026-09-01', permintaan: '2026-08-24', jenis: 2, perihal: 'Penawaran SLO PLTS Atap 1,2 MWp', status: 'approved', ppn: 'PPN',
    items: [
      ['SLO PLTS Atap 1,2 MWp', 'Paket', 1, 38000000, 'jasa'],
      ['Pengujian inverter & sistem pembumian', 'Paket', 1, 9500000, 'jasa'],
      ['Mobilisasi Tim & Alat Mojokerto', 'Lot', 1, 2000000, 'mobilisasi'],
    ],
  },
  {
    pel: 5, tanggal: '2026-09-15', permintaan: '2026-09-08', jenis: 7, perihal: 'Penawaran SLO Instalasi Pemanfaatan TR', status: 'submit', ppn: 'Non PPN',
    items: [
      ['SLO Instalasi Pemanfaatan TR 345 kVA', 'Unit', 1, 8500000, 'jasa'],
      ['Pengukuran pembumian & thermografi panel', 'Paket', 1, 3200000, 'jasa'],
    ],
  },
  {
    pel: 6, tanggal: '2026-10-02', permintaan: '2026-09-25', jenis: 6, perihal: 'Penawaran SLO Pemanfaatan TM 2.000 kVA', status: 'approved', ppn: 'PPN',
    items: [
      ['SLO Pemanfaatan TM 2.000 kVA', 'Unit', 1, 16500000, 'jasa'],
      ['Uji kualitas daya (power quality)', 'Paket', 1, 5500000, 'jasa'],
      ['Mobilisasi Tim & Alat Sidoarjo', 'Lot', 1, 1200000, 'mobilisasi'],
    ],
  },
  {
    pel: 7, tanggal: '2026-10-20', permintaan: '2026-10-12', jenis: 8, perihal: 'Penawaran SLO Gardu Induk 150 kV', status: 'submit', ppn: 'PPN',
    items: [
      ['SLO Gardu Induk 150 kV Bay Trafo #1', 'Unit', 1, 185000000, 'jasa'],
      ['SLO Gardu Induk 150 kV Bay Penghantar #1', 'Unit', 2, 96000000, 'jasa'],
      ['Transport dan akomodasi 5 x kedatangan', 'Unit', 5, 14500000, 'mobilisasi'],
    ],
  },
  {
    pel: 8, tanggal: '2026-11-05', permintaan: '2026-10-30', jenis: 7, perihal: 'Penawaran SLO Instalasi Pemanfaatan TR', status: 'draft', ppn: 'PPN',
    items: [
      ['SLO Instalasi Pemanfaatan TR 197 kVA', 'Unit', 1, 6500000, 'jasa'],
      ['Mobilisasi Tim & Alat Semarang', 'Lot', 1, 2800000, 'mobilisasi'],
    ],
  },
  {
    pel: 9, tanggal: '2026-11-19', permintaan: '2026-11-10', jenis: 0, perihal: 'Penawaran SLO PLTU 2 x 65 MW', status: 'rejected', ppn: 'PPN',
    items: [
      ['SLO PLTU Unit #1 65 MW', 'Unit', 1, 640000000, 'jasa'],
      ['SLO PLTU Unit #2 65 MW', 'Unit', 1, 640000000, 'jasa'],
      ['Transport dan akomodasi 8 x kedatangan', 'Unit', 8, 18000000, 'mobilisasi'],
    ],
  },
];

/** Penawaran nomor 21 dst. (nomor 11-20 dicadangkan untuk Sales Order lama di bawah). */
const NOMOR_PNW_AWAL = 21;

const noPenawaran = (i: number, tanggal: string) => `${NOMOR_PNW_AWAL + i}/SDP/PNW/${bulanRomawi(tanggal)}/${tahun(tanggal)}`;

export function contohPenawaran(pelanggan: Pelanggan[]): SuratPenawaran[] {
  const ttd = DOC_CONFIG.penandatangan[0]?.nama ?? DOC_CONFIG.workOrder.penandatangan.nama;
  const rows = PNW_ROWS.map((r, i): SuratPenawaran => {
    const pel = pelanggan[r.pel];
    const at = `${r.tanggal}T02:00:00.000Z`;
    return {
      id: `pnw-contoh-${i + 1}`,
      tanggal: r.tanggal,
      noPenawaran: noPenawaran(i, r.tanggal),
      perihal: r.perihal,
      lampiran: '1 (Satu) Lembar',
      up: DEFAULT_UP,
      penandatangan: ttd,
      tanggalPermintaan: r.permintaan,
      pelangganId: pel.id,
      pelangganNama: `${pel.companyPrefix}${pel.companyPrefix.length <= 3 ? '.' : ''} ${pel.nama}`,
      jenisPekerjaan: JENIS_INSTALASI_SOJO[r.jenis],
      status: r.status,
      masaBerlaku: 30,
      ppn: r.ppn,
      denganHormat:
        `<p>Menindaklanjuti permintaan mengenai ${r.perihal.replace(/^Penawaran /, '')} ` +
        `yang berlokasi di ${pel.kabKota.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase())}, ` +
        'maka dengan ini disampaikan penawaran harga sebagai berikut:</p>',
      catatan: DEFAULT_CATATAN,
      caraPembayaran: DEFAULT_CARA_PEMBAYARAN,
      dataPersyaratan: DEFAULT_DATA_PERSYARATAN,
      items: r.items.map(([nama, satuan, qty, harga], k) => ({
        id: `pnw-contoh-${i + 1}-it${k + 1}`,
        nama,
        jenisInstalasi: JENIS_INSTALASI_SOJO[r.jenis],
        satuan,
        qty,
        harga,
      })),
      createdAt: at,
      updatedAt: at,
    };
  });
  // Terbaru di atas, sama seperti urutan saat penawaran baru disimpan.
  return rows.reverse();
}

/* ------------------------------------------------------------------ */
/* 10 sales order                                                      */
/* ------------------------------------------------------------------ */

interface SoRow {
  /** Indeks penawaran (0-9) asal SO; null = SO lama tanpa penawaran di daftar. */
  pnw: number | null;
  /** Hanya untuk SO lama (pnw null). */
  lama?: { pel: number; tanggal: string; permintaan: string; nomor: number; jenis: number; perihal: string; items: ItemRow[] };
  poDate: string;
  durasiBulan: number;
  dp: number;
  status: JoSoStatus;
  title: string;
}

const SO_ROWS: SoRow[] = [
  {
    pnw: null, poDate: '2026-05-12', durasiBulan: 3, dp: 50, status: 'completed', title: 'SLO PLTD PT Surya Mandiri Logam (Perpanjangan)',
    lama: {
      pel: 0, tanggal: '2026-05-04', permintaan: '2026-04-27', nomor: 11, jenis: 1, perihal: 'Penawaran Perpanjangan SLO PLTD 1 x 750 kVA',
      items: [
        ['Perpanjangan SLO PLTD 750 kVA', 'Unit', 1, 12500000, 'jasa'],
        ['Mobilisasi Tim & Alat Gresik', 'Lot', 1, 1000000, 'mobilisasi'],
      ],
    },
  },
  {
    pnw: null, poDate: '2026-05-28', durasiBulan: 2, dp: 100, status: 'completed', title: 'SLO Pemanfaatan TR Cold Storage Samudra',
    lama: {
      pel: 5, tanggal: '2026-05-18', permintaan: '2026-05-11', nomor: 12, jenis: 7, perihal: 'Penawaran SLO Instalasi Pemanfaatan TR',
      items: [['SLO Instalasi Pemanfaatan TR 240 kVA', 'Unit', 1, 7800000, 'jasa']],
    },
  },
  {
    pnw: null, poDate: '2026-06-16', durasiBulan: 3, dp: 30, status: 'in_progress', title: 'SLO Distribusi TM Tirta Energi',
    lama: {
      pel: 1, tanggal: '2026-06-03', permintaan: '2026-05-27', nomor: 13, jenis: 9, perihal: 'Penawaran SLO Distribusi JTM 20 kV',
      items: [
        ['SLO Jaringan Distribusi JTM 20 kV 2,1 kms', 'Paket', 1, 15500000, 'jasa'],
        ['Mobilisasi Tim & Alat Surabaya', 'Lot', 1, 900000, 'mobilisasi'],
      ],
    },
  },
  { pnw: 0, poDate: '2026-07-15', durasiBulan: 3, dp: 50, status: 'completed', title: 'SLO PLTD 2 x 1.000 kVA PT Surya Mandiri Logam' },
  { pnw: 1, poDate: '2026-07-29', durasiBulan: 3, dp: 50, status: 'in_progress', title: 'SLO Pemanfaatan TM 1.600 kVA PT Tirta Energi' },
  { pnw: 3, poDate: '2026-08-27', durasiBulan: 4, dp: 40, status: 'in_progress', title: 'SLO PLTD 3 x 1.250 kVA PT Kaltim Prima Agro' },
  { pnw: 4, poDate: '2026-09-10', durasiBulan: 3, dp: 50, status: 'approved', title: 'SLO PLTS Atap 1,2 MWp PT Bumi Sejahtera Pangan' },
  { pnw: 6, poDate: '2026-10-09', durasiBulan: 3, dp: 100, status: 'approved', title: 'SLO Pemanfaatan TM 2.000 kVA PT Cahaya Bintang' },
  { pnw: 2, poDate: '2026-08-14', durasiBulan: 2, dp: 50, status: 'cancelled', title: 'SLO Distribusi JTM CV Mitra Karya Elektrik (dibatalkan pelanggan)' },
  { pnw: 5, poDate: '2026-09-24', durasiBulan: 2, dp: 0, status: 'submit', title: 'SLO Pemanfaatan TR Samudra Cold Storage (Gudang 2)' },
];

const tambahBulan = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setMonth(d.getMonth() + n);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export function contohSalesOrder(pelanggan: Pelanggan[], penawaran: SuratPenawaran[]): JoSoRecord[] {
  const ttd = DOC_CONFIG.penandatangan[0]?.nama ?? DOC_CONFIG.workOrder.penandatangan.nama;
  // Nomor PO urut per tahun mengikuti tanggal PO.
  const urut = [...SO_ROWS].sort((a, b) => a.poDate.localeCompare(b.poDate));
  const poNoOf = (r: SoRow) => `${String(urut.indexOf(r) + 1).padStart(3, '0')}/WO/SDP/${bulanRomawi(r.poDate)}/${tahun(r.poDate)}`;

  const rows = SO_ROWS.map((r, i): JoSoRecord => {
    let pel: Pelanggan;
    let tanggalPenawaran: string;
    let noPnw: string;
    let perihal: string;
    let permintaan: string;
    let jenis: string;
    let ppnRate: number;
    let masaBerlaku = 30;
    let items: JoSoDetailItem[];
    let penawaranId: string | undefined;

    if (r.pnw !== null) {
      const p = penawaran.find((x) => x.id === `pnw-contoh-${r.pnw! + 1}`)!;
      pel = pelanggan.find((x) => x.id === p.pelangganId)!;
      tanggalPenawaran = p.tanggal;
      noPnw = p.noPenawaran;
      perihal = p.perihal;
      permintaan = p.tanggalPermintaan;
      jenis = p.jenisPekerjaan;
      ppnRate = p.ppn === 'PPN' ? PPN_RATE : 0;
      masaBerlaku = p.masaBerlaku;
      penawaranId = p.id;
      items = p.items.map((it, k) => ({
        id: `so-contoh-${i + 1}-it${k + 1}`,
        itemName: it.nama,
        satuan: it.satuan,
        price: it.harga,
        qty: it.qty,
        kategori: PNW_ROWS[r.pnw!].items[k][4],
      }));
    } else {
      const l = r.lama!;
      pel = pelanggan[l.pel];
      tanggalPenawaran = l.tanggal;
      noPnw = `${l.nomor}/SDP/PNW/${bulanRomawi(l.tanggal)}/${tahun(l.tanggal)}`;
      perihal = l.perihal;
      permintaan = l.permintaan;
      jenis = JENIS_INSTALASI_SOJO[l.jenis];
      ppnRate = PPN_RATE;
      items = l.items.map(([itemName, satuan, qty, price, kategori], k) => ({
        id: `so-contoh-${i + 1}-it${k + 1}`,
        itemName,
        satuan,
        price,
        qty,
        kategori,
      }));
    }

    const nama = `${pel.companyPrefix}${pel.companyPrefix.length <= 3 ? '.' : ''} ${pel.nama}`;
    const alamatLengkap = `${nama} | ${pel.alamat}, ${pel.kabKota}`;
    const poNo = poNoOf(r);
    const at = `${r.poDate}T04:00:00.000Z`;
    const selesai = r.status === 'completed';

    return {
      id: `so-contoh-${i + 1}`,
      ...(penawaranId ? { penawaranId } : {}),
      tanggalPenawaran,
      noPenawaran: noPnw,
      perihal,
      lampiran: '1 (Satu) Lembar',
      tanggalPermintaan: permintaan,
      kepadaAlamat: alamatLengkap,
      namaPerusahaan: nama,
      alamatPerusahaan: pel.alamat,
      kota: pel.kabKota,
      npwp: pel.npwp,
      kontakNama: pel.namaPic,
      kontakTelp: pel.telp1,
      penandatangan: ttd,
      jenisInstalasiPenawaran: jenis,
      status: r.status,
      masaBerlaku,
      ppnRate,
      items,
      poNo,
      title: r.title,
      poDate: r.poDate,
      poExpiredDate: tambahBulan(r.poDate, r.durasiBulan),
      dp: r.dp,
      pelangganAlamat: alamatLengkap,
      jenisInstalasiJo: jenis,
      paymentTerm: r.dp >= 100 ? 'Cash 100%' : r.dp <= 0 ? 'Termin 100% setelah SLO terbit' : `DP ${r.dp}, PL ${100 - r.dp}`,
      documents: [],
      ...(selesai ? { salesMessage: `Pekerjaan ${poNo} selesai, SLO telah terbit.` } : {}),
      updatedAt: at,
    };
  });
  // Terbaru di atas.
  return rows.sort((a, b) => b.poDate.localeCompare(a.poDate));
}
