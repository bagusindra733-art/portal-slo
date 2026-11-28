import { describe, expect, it } from 'vitest';
import { bidangLabel, pembangkitVsLainnya, sloTrendPerTahun } from '../sloTrend';

const r = (bidang: string, tglTerbit: string) => ({ bidang, tglTerbit });

describe('sloTrendPerTahun', () => {
  it('menghitung per bidang per tahun dan total', () => {
    const t = sloTrendPerTahun([
      r('Pembangkitan Tenaga Listrik', '2024-01-05'),
      r('Pembangkitan Tenaga Listrik', '2024-06-01'),
      r('Pembangkitan Tenaga Listrik', '2025-02-02'),
      r('Distribusi Tenaga Listrik', '2025-03-03'),
    ]);
    expect(t.years).toEqual([2024, 2025]);
    expect(t.rows.map((x) => x.label)).toEqual(['Pembangkit', 'Distribusi']);
    expect(t.rows[0].perTahun).toEqual({ 2024: 2, 2025: 1 });
    expect(t.total.total).toBe(4);
    expect(t.total.perTahun).toEqual({ 2024: 2, 2025: 2 });
  });

  it('mengisi tahun yang kosong di antara rentang', () => {
    const t = sloTrendPerTahun([r('A', '2022-01-01'), r('A', '2025-01-01')]);
    expect(t.years).toEqual([2022, 2023, 2024, 2025]);
  });

  it('mengabaikan tanggal terbit kosong / tidak valid', () => {
    const t = sloTrendPerTahun([r('A', ''), r('A', 'abc'), r('A', '2025-05-05')]);
    expect(t.total.total).toBe(1);
  });

  it('data kosong aman', () => {
    const t = sloTrendPerTahun([]);
    expect(t.years).toEqual([]);
    expect(t.rows).toEqual([]);
    expect(t.total.total).toBe(0);
  });

  it('label bidang dipersingkat, bidang tak dikenal dipertahankan', () => {
    expect(bidangLabel('Instalasi Pemanfaatan Tenaga Listrik')).toBe('Pemanfaatan');
    expect(bidangLabel('Bidang Baru')).toBe('Bidang Baru');
    expect(bidangLabel('')).toBe('Lainnya');
  });
});

describe('pembangkitVsLainnya', () => {
  it('memisahkan pembangkit dari bidang lain, jumlahnya sama dengan total', () => {
    const t = sloTrendPerTahun([
      r('Pembangkitan Tenaga Listrik', '2024-01-01'),
      r('Pembangkitan Tenaga Listrik', '2025-01-01'),
      r('Transmisi Tenaga Listrik', '2025-02-01'),
      r('Distribusi Tenaga Listrik', '2025-03-01'),
    ]);
    const v = pembangkitVsLainnya(t);
    expect(v.pembangkit).toEqual([1, 1]);
    expect(v.lainnya).toEqual([0, 2]);
  });

  it('tanpa data pembangkit semua masuk "lainnya"', () => {
    const v = pembangkitVsLainnya(sloTrendPerTahun([r('Transmisi Tenaga Listrik', '2025-02-01')]));
    expect(v.pembangkit).toEqual([0]);
    expect(v.lainnya).toEqual([1]);
  });
});
