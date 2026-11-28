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
  parseKapasitasNilai,
  teksKapasitasNilai,
  validasiKlasifikasi,
} from '../../data/katalogInstalasi';
import { salesOrderDariPenawaran } from '../penawaranUtils';
import { syncProjectToJoSo } from '../portalUtils';
import type { JoSoRecord, Project, SuratPenawaran } from '../../types/portal';

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
  const B = 'Pembangkitan Tenaga Listrik';
  const S = 'Pembangkit Listrik Tenaga Surya';
  const J = 'INSTALASI PEMBANGKIT LISTRIK TENAGA SURYA (PLTS)';

  it('semua kosong = sah (rekaman lama tetap bisa disimpan)', () => {
    expect(validasiKlasifikasi({})).toBeNull();
  });
  it('tiga tingkat harus lengkap atau kosong semua', () => {
    expect(validasiKlasifikasi({ klasifikasiBidang: B })).toMatch(/Lengkapi/);
    expect(validasiKlasifikasi({ klasifikasiBidang: B, klasifikasiSubBidang: S })).toMatch(/Lengkapi/);
  });
  it('angka wajib disertai jenis dan satuan', () => {
    expect(validasiKlasifikasi({ kapasitasNilai: 10 })).toMatch(/Jenis Instalasi/);
    expect(validasiKlasifikasi({ klasifikasiBidang: B, klasifikasiSubBidang: S, klasifikasiJenis: J, kapasitasNilai: 10 })).toMatch(/satuan/);
    expect(validasiKlasifikasi({ kapasitasNilai: -1 })).toMatch(/angka/);
  });
  it('satuan harus yang diizinkan untuk jenis itu', () => {
    const dasar = { klasifikasiBidang: B, klasifikasiSubBidang: S, klasifikasiJenis: J, kapasitasNilai: 10 };
    expect(validasiKlasifikasi({ ...dasar, kapasitasSatuan: 'kWp' })).toBeNull();
    expect(validasiKlasifikasi({ ...dasar, kapasitasSatuan: 'MVA' })).toMatch(/tidak diizinkan/);
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
