/**
 * Satu-satunya pintu pengambilan data SLO Terbit.
 *
 * Saat ini: membaca file hasil konversi Excel (src/data/sloTerbit.json,
 * dibuat oleh scripts/xlsx_to_slo_terbit.py).
 * Nanti, bila API tersedia: cukup ganti isi getSloTerbit() (mis. fetch ke
 * endpoint) selama bentuk datanya tetap SloRecord[]. Tampilan tidak perlu diubah.
 */

export type SloRecord = {
  tglPermohonan: string;
  tglRegistrasi: string;
  noAgenda: string;
  pemilik: string;
  instalasi: string;
  jenis: string;
  kapasitas: string;
  verifikator: string;
  nidi: string;
  bidang: string;
  subBidang: string;
  tipe: string;
  lokasi: string;
  desa: string;
  kecamatan: string;
  kota: string;
  provinsi: string;
  lon: number | null;
  lat: number | null;
  tglTerbit: string;
  tglHabis: string;
  noSlo: string;
  noRegister: string;
};

export async function getSloTerbit(): Promise<SloRecord[]> {
  const mod = await import('../data/sloTerbit.json');
  return mod.default as SloRecord[];
}
