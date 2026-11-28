import { describe, expect, it } from 'vitest';
import { penawaranSiapPO, salesOrderDariPenawaran, suggestNoPO } from '../penawaranUtils';
import type { Pelanggan, SuratPenawaran } from '../../types/portal';

const pnw = (over: Partial<SuratPenawaran>): SuratPenawaran =>
  ({
    id: 'p1',
    tanggal: '2026-07-24',
    noPenawaran: '139/SDP/PNW/VII/2026',
    perihal: 'Penawaran SLO',
    lampiran: '1 (Satu) Lembar',
    tanggalPermintaan: '',
    pelangganId: 'pel1',
    pelangganNama: 'UD. Dedi Dewanto',
    jenisPekerjaan: 'PLTD | Pembangkit Listrik Tenaga Diesel (PLTD)',
    status: 'submit',
    masaBerlaku: 30,
    ppn: 'PPN',
    denganHormat: '',
    catatan: '',
    caraPembayaran: '',
    items: [{ id: 'i1', nama: 'SLO PLTD 1 x 750 kVA', jenisInstalasi: 'PLTD', satuan: 'Unit', qty: 1, harga: 9500000 }],
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as SuratPenawaran;

describe('suggestNoPO', () => {
  it('memakai format urut 3 digit/WO/SDP/bulan romawi/tahun', () => {
    expect(suggestNoPO([], '2026-07-15')).toBe('001/WO/SDP/VII/2026');
  });
  it('melanjutkan nomor terbesar pada tahun yang sama saja', () => {
    const recs = [
      { poNo: '041/WO/SDP/VII/2026', poDate: '2026-07-15' },
      { poNo: '040/WO/SDP/VII/2026', poDate: '2026-07-16' },
      { poNo: '037/WO/SDP/VII/2025', poDate: '2025-07-07' },
    ];
    expect(suggestNoPO(recs, '2026-07-24')).toBe('042/WO/SDP/VII/2026');
    expect(suggestNoPO(recs, '2025-08-01')).toBe('038/WO/SDP/VIII/2025');
  });
});

describe('penawaranSiapPO', () => {
  it('hanya submit/approved yang belum menjadi Sales Order', () => {
    const list = [
      pnw({ id: 'a', status: 'submit' }),
      pnw({ id: 'b', status: 'draft', noPenawaran: 'b' }),
      pnw({ id: 'c', status: 'approved', noPenawaran: 'c' }),
      pnw({ id: 'd', status: 'rejected', noPenawaran: 'd' }),
    ];
    const hasil = penawaranSiapPO(list, [{ penawaranId: 'c', noPenawaran: 'c' }]);
    expect(hasil.map((p) => p.id)).toEqual(['a']);
  });
});

describe('salesOrderDariPenawaran', () => {
  it('menyalin data penawaran dan menyiapkan PO baru', () => {
    const pel = { alamat: 'Jl. Raya 1', kabKota: 'Gresik', npwp: '01.2', namaPic: 'Budi', telp1: '0812', telp2: '' } as Pelanggan;
    const so = salesOrderDariPenawaran(pnw({ penandatangan: 'Nur Mahmula, SE' }), pel, [], 'UD. Dedi Dewanto', '2026-07-28');
    expect(so.penawaranId).toBe('p1');
    expect(so.poNo).toBe('001/WO/SDP/VII/2026');
    expect(so.ppnRate).toBe(11);
    expect(so.items[0]).toMatchObject({ itemName: 'SLO PLTD 1 x 750 kVA', price: 9500000, qty: 1 });
    expect(so.kontakNama).toBe('Budi');
    expect(so.penandatangan).toBe('Nur Mahmula, SE');
  });
  it('Non PPN → ppnRate 0', () => {
    const so = salesOrderDariPenawaran(pnw({ ppn: 'Non PPN' }), undefined, [], 'X', '2026-07-28');
    expect(so.ppnRate).toBe(0);
  });
});
