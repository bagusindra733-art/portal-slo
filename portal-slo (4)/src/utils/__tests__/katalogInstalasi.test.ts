import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import sloTerbit from '../../data/sloTerbit.json';
import {
  KATALOG_INSTALASI,
  ambilKlasifikasi,
  daftarBidang,
  daftarJenis,
  daftarSatuan,
  daftarSubBidang,
  klasifikasiDariJenisPekerjaan,
  parseKapasitasNilai,
  satuanJenisPekerjaan,
  teksKapasitasNilai,
  validasiKlasifikasi,
} from '../../data/katalogInstalasi';
import { kategoriItemPenawaran, salesOrderDariPenawaran } from '../penawaranUtils';
import { instalasiDariItems, syncJoSoToProject, syncProjectToJoSo } from '../portalUtils';
import { JENIS_INSTALASI_SOJO, type JoSoRecord, type Project, type SuratPenawaran } from '../../types/portal';

type Baris = { bidang: string; subBidang: string; jenis: string; kapasitas: string };
const djk = sloTerbit as Baris[];

const satuanDariTeks = (kap: string): string => {
  const m = /^[\d.,]+\s*(.*)$/.exec(kap.trim());
  const u = (m?.[1] ?? '').trim();
  return u === 'kva kVA' ? 'kVA' : u;
};

describe('katalog instalasi turunan data DJK', () => {
  it('setiap baris DJK punya bidang → sub bidang → jenis yang ada di katalog', () => {
    for (const r of djk) {
      expect(daftarJenis(r.bidang, r.subBidang), `${r.bidang} / ${r.subBidang}`).toContain(r.jenis);
    }
  });

  it('setiap jenis di katalog benar-benar muncul di data DJK (tidak ada jenis rekaan)', () => {
    const ada = new Set(djk.map((r) => `${r.bidang}|${r.subBidang}|${r.jenis}`));
    for (const b of KATALOG_INSTALASI)
      for (const s of b.subBidang)
        for (const j of s.jenis) expect(ada.has(`${b.nama}|${s.nama}|${j.nama}`), j.nama).toBe(true);
  });

  it('satuan bawaan = satuan yang paling sering dipakai DJK untuk jenis itu', () => {
    const hitung = new Map<string, Map<string, number>>();
    for (const r of djk) {
      const u = satuanDariTeks(r.kapasitas);
      if (!u) continue;
      const k = `${r.bidang}|${r.subBidang}|${r.jenis}`;
      const m = hitung.get(k) ?? new Map<string, number>();
      m.set(u, (m.get(u) ?? 0) + 1);
      hitung.set(k, m);
    }
    for (const [k, m] of hitung) {
      const [b, s, j] = k.split('|');
      const teratas = [...m.entries()].sort((a, c) => c[1] - a[1])[0][0];
      expect(daftarSatuan(b, s, j)[0], j).toBe(teratas);
    }
  });

  it('salah ketik DJK tidak dianggap satuan sah', () => {
    const pltd = 'INSTALASI PEMBANGKIT LISTRIK TENAGA DIESEL (PLTD) PERMANEN';
    expect(daftarSatuan('Pembangkitan Tenaga Listrik', 'Pembangkit Listrik Tenaga Diesel', pltd)).not.toContain('VA');
    expect(daftarSatuan('Distribusi Tenaga Listrik', 'Jaringan Distribusi Tenaga Listrik Tegangan Menengah', 'INSTALASI SALURAN KABEL TEGANGAN MENENGAH (SKTM)')).not.toContain('kVA');
  });

  it('pilihan bertingkat kosong bila tingkat di atasnya belum dipilih', () => {
    expect(daftarBidang().length).toBe(4);
    expect(daftarSubBidang('')).toEqual([]);
    expect(daftarJenis('Gardu Induk')).toEqual([]);
    expect(daftarSatuan('x', 'y', 'z')).toEqual([]);
  });
});

describe('parseKapasitasNilai', () => {
  it.each([
    ['750', 750],
    ['562,5', 562.5],
    ['2.5', 2.5],
    ['0.385', 0.385],
    ['47.33', 47.33],
    ['1.250', 1250],
    ['1.250,5', 1250.5],
    ['1.250.000', 1250000],
    [' 12 ', 12],
  ])('%s → %s', (teks, hasil) => {
    expect(parseKapasitasNilai(teks)).toBe(hasil);
  });

  it.each([[''], ['abc'], ['-5'], ['1,2,3'], ['12 kW'], [',5']])('"%s" → null', (teks) => {
    expect(parseKapasitasNilai(teks)).toBeNull();
  });

  it('teks isian bisa dibaca ulang menjadi angka yang sama', () => {
    for (const n of [750, 562.5, 0.385, 1250.5, 0]) expect(parseKapasitasNilai(teksKapasitasNilai(n))).toBe(n);
    expect(teksKapasitasNilai(null)).toBe('');
    expect(teksKapasitasNilai(undefined)).toBe('');
  });
});

describe('validasiKlasifikasi', () => {
  it('semua kosong = sah (rekaman lama tetap bisa disimpan)', () => {
    expect(validasiKlasifikasi({})).toBeNull();
    expect(validasiKlasifikasi({}, 'PLTS | Pembangkit Listrik Tenaga Surya')).toBeNull();
  });
  it('angka wajib disertai satuan dan tidak boleh negatif', () => {
    expect(validasiKlasifikasi({ kapasitasNilai: 10 }, 'PLTS | Pembangkit Listrik Tenaga Surya')).toMatch(/satuan/);
    expect(validasiKlasifikasi({ kapasitasNilai: -1, kapasitasSatuan: 'kW' }, 'PLTS | x')).toMatch(/angka/);
  });
  it('satuan harus yang diizinkan untuk Jenis Pekerjaan', () => {
    const dasar = { kapasitasNilai: 10 };
    const plts = 'PLTS | Pembangkit Listrik Tenaga Surya';
    expect(validasiKlasifikasi({ ...dasar, kapasitasSatuan: 'kWp' }, plts)).toBeNull();
    expect(validasiKlasifikasi({ ...dasar, kapasitasSatuan: 'MVA' }, plts)).toMatch(/tidak diizinkan/);
  });
});

describe('Jenis Pekerjaan menentukan Bidang dan Sub Bidang', () => {
  it('setiap entri JENIS_INSTALASI_SOJO punya Bidang, Sub Bidang, dan satuan', () => {
    for (const j of JENIS_INSTALASI_SOJO) {
      const k = klasifikasiDariJenisPekerjaan(j);
      expect(k.klasifikasiBidang, j).toBeTruthy();
      expect(k.klasifikasiSubBidang, j).toBeTruthy();
      expect(satuanJenisPekerjaan(j).length, j).toBeGreaterThan(0);
    }
  });
  it('daftar Pembangkit, Transmisi, dan Distribusi sesuai permintaan', () => {
    const kode = JENIS_INSTALASI_SOJO.map((j) => j.split('|')[0].trim());
    expect(kode.filter((k) => !/^(Pemanfaatan|Transmisi|Distribusi)/.test(k))).toEqual(
      ['BESS', 'PLTB', 'PLTBm', 'PLTD', 'PLTG', 'PLTGU', 'PLTS', 'PLTU']
    );
    expect(kode.filter((k) => k.startsWith('Transmisi'))).toEqual(['Transmisi 0', 'Transmisi 1', 'Transmisi 2', 'Transmisi 3']);
    expect(kode.filter((k) => k.startsWith('Distribusi'))).toEqual(['Distribusi 0', 'Distribusi 1', 'Distribusi 2', 'Distribusi 3', 'Distribusi 4', 'Distribusi 5']);
  });
  it('jenis lama / tak dikenal tidak menurunkan apa pun', () => {
    expect(klasifikasiDariJenisPekerjaan('Transmisi | Instalasi Transmisi Tenaga Listrik (GI / SUTT / SUTET)')).toEqual({});
    expect(satuanJenisPekerjaan('')).toEqual([]);
  });
});

describe('kolom baru berdampingan dengan kolom kapasitas lama', () => {
  const klas = {
    klasifikasiBidang: 'Pembangkitan Tenaga Listrik',
    klasifikasiSubBidang: 'Pembangkit Listrik Tenaga Diesel',
    klasifikasiJenis: 'INSTALASI PEMBANGKIT LISTRIK TENAGA DIESEL (PLTD) PERMANEN',
    kapasitasNilai: 750,
    kapasitasSatuan: 'kVA',
  };

  it('ambilKlasifikasi hanya membawa kolom baru yang ada', () => {
    expect(ambilKlasifikasi(undefined)).toEqual({});
    expect(ambilKlasifikasi({ ...klas, kapasitas: '1 MW' } as never)).toEqual(klas);
    expect(Object.keys(ambilKlasifikasi({ klasifikasiBidang: 'x' }))).toEqual(['klasifikasiBidang']);
  });

  it('Create Order menyalin klasifikasi dari penawaran dan tidak menyentuh kolom kapasitas lama', () => {
    const pnw = {
      id: 'p1', tanggal: '2026-07-24', noPenawaran: 'N1', perihal: '', lampiran: '', tanggalPermintaan: '',
      pelangganId: 'x', pelangganNama: 'PT X', jenisPekerjaan: 'PLTD | Pembangkit Listrik Tenaga Diesel (PLTD)',
      status: 'submit', masaBerlaku: 30, ppn: 'PPN', denganHormat: '', catatan: '', caraPembayaran: '',
      items: [], createdAt: '', updatedAt: '', ...klas,
    } as SuratPenawaran;
    const so = salesOrderDariPenawaran(pnw, undefined, [], 'PT X', '2026-07-25');
    expect(ambilKlasifikasi(so)).toEqual(klas);
    expect(so.kapasitas).toBeUndefined();
  });

  it('penawaran lama tanpa klasifikasi menghasilkan SO tanpa kolom baru', () => {
    const pnw = { id: 'p2', items: [], jenisPekerjaan: 'PLTD', status: 'draft', ppn: 'Non PPN', masaBerlaku: 30 } as unknown as SuratPenawaran;
    const so = salesOrderDariPenawaran(pnw, undefined, [], 'PT Y', '2026-07-25');
    expect(ambilKlasifikasi(so)).toEqual({});
  });

  it('sinkron proyek → SO mempertahankan kapasitas lama apa adanya dan kolom baru', () => {
    const proj = {
      id: 'pr1', no: 'RFQ-1', perusahaan: 'PT Z', kota: 'Surabaya', jenis: 'Pembangkit', sub: 'PLTD',
      kap: '999 kVA', status: 'rfq', files: [], penawaran: null, po: null, log: [],
    } as unknown as Project;
    const existing = { id: 'j1', items: [], documents: [], kapasitas: '150 kV', ...klas } as unknown as JoSoRecord;
    const hasil = syncProjectToJoSo(proj, existing);
    expect(hasil.kapasitas).toBe('150 kV');
    expect(ambilKlasifikasi(hasil)).toEqual(klas);
  });
});

describe('klasifikasi tidak boleh tercetak', () => {
  it.each(['PenawaranDoc.tsx', 'WorkOrderDoc.tsx'])('%s tidak membaca kolom klasifikasi/kapasitas baru', (nama) => {
    const sumber = readFileSync(fileURLToPath(new URL(`../../components/${nama}`, import.meta.url)), 'utf8');
    expect(sumber).not.toMatch(/klasifikasi|kapasitasNilai|kapasitasSatuan|katalogInstalasi/i);
  });
});

describe('kategori item penawaran', () => {
  it('pilihan eksplisit dipakai; data lama ditebak dari nama', () => {
    expect(kategoriItemPenawaran({ nama: 'SLO PLTU Unit #1', kategori: 'jasa' })).toBe('jasa');
    expect(kategoriItemPenawaran({ nama: 'Biaya cetak sertifikat', kategori: 'lainnya' })).toBe('lainnya');
    expect(kategoriItemPenawaran({ nama: 'Transport dan akomodasi 8 x kedatangan' })).toBe('mobilisasi');
    expect(kategoriItemPenawaran({ nama: 'SLO PLTU Unit #1 65 MW' })).toBe('jasa');
  });
  it('Create Order membawa kategori ke Sales Order; "lainnya" dibiarkan tanpa kategori', () => {
    const it = (id: string, nama: string, kategori?: 'jasa' | 'mobilisasi' | 'lainnya') =>
      ({ id, nama, kategori, jenisInstalasi: '', satuan: 'Unit', qty: 1, harga: 100 });
    const pnw = {
      id: 'p3', tanggal: '2026-07-24', noPenawaran: 'N3', jenisPekerjaan: 'PLTU | Pembangkit Listrik Tenaga Uap',
      status: 'submit', masaBerlaku: 30, ppn: 'PPN',
      items: [it('a', 'SLO PLTU', 'jasa'), it('b', 'Transport', 'mobilisasi'), it('c', 'Biaya lain', 'lainnya'), it('d', 'Akomodasi tim')],
    } as unknown as SuratPenawaran;
    const so = salesOrderDariPenawaran(pnw, undefined, [], 'PT X', '2026-07-25');
    expect(so.items.map((x) => x.kategori)).toEqual(['jasa', 'mobilisasi', undefined, 'mobilisasi']);
  });
});

describe('daftar instalasi proyek dari Detail Item', () => {
  const item = (id: string, itemName: string, jenisInstalasi?: string, kategori: 'jasa' | 'mobilisasi' = 'jasa') =>
    ({ id, itemName, satuan: 'Unit', price: 100, qty: 1, kategori, jenisInstalasi });
  const TM = 'Pemanfaatan-1 | Instalasi Pemanfaatan Tenaga Listrik Tegangan Menengah';
  const PLTD = 'PLTD | Pembangkit Listrik Tenaga Diesel';
  const TT = 'Pemanfaatan-2 | Instalasi Pemanfaatan Tenaga Listrik Tegangan Tinggi';

  it('dua jenis atau lebih -> satu instalasi per jenis, mobilisasi tidak dihitung', () => {
    const hasil = instalasiDariItems([
      item('1', 'SLO IPTL TM', TM),
      item('2', 'SLO PLTD', PLTD),
      item('3', 'SLO PLTD unit 2', PLTD),
      item('4', 'SLO IPTL TT', TT),
      item('5', 'Transport', undefined, 'mobilisasi'),
    ]);
    expect(hasil.map((x) => x.nama)).toEqual([TM, PLTD, TT]);
    expect(hasil.every((x) => x.noAgenda === '')).toBe(true);
  });
  it('satu jenis saja -> tidak diisi otomatis', () => {
    expect(instalasiDariItems([item('1', 'SLO A', PLTD), item('2', 'SLO B', PLTD)])).toEqual([]);
    expect(instalasiDariItems([item('1', 'SLO A'), item('2', 'SLO B')], PLTD)).toEqual([]);
  });
  it('proyek baru dari SO multi-jenis mendapat daftar instalasi; proyek yang sudah punya daftar tidak ditimpa', () => {
    const rec = {
      id: 'j9', items: [item('1', 'SLO IPTL TM', TM), item('2', 'SLO PLTD', PLTD)], documents: [],
      status: 'draft', jenisInstalasiJo: PLTD, kapasitas: '', ppnRate: 11, poNo: 'PO-1', noPenawaran: 'N',
    } as unknown as JoSoRecord;
    const baru = syncJoSoToProject(rec, undefined, 1);
    expect(baru.instalasi?.map((x) => x.nama)).toEqual([TM, PLTD]);
    const sudahIsi = { ...baru, instalasi: [{ id: 'x', nama: 'Gardu A', noAgenda: '123' }] } as Project;
    expect(syncJoSoToProject(rec, sudahIsi, 2).instalasi).toEqual(sudahIsi.instalasi);
    const kosongDisengaja = { ...baru, instalasi: [] } as Project;
    expect(syncJoSoToProject(rec, kosongDisengaja, 2).instalasi).toEqual([]);
  });
});
