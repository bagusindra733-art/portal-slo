import { useEffect, useState, type ReactNode } from 'react';
import type { KlasifikasiInstalasiFields } from '../types/portal';
import {
  daftarSatuan,
  klasifikasiDariJenisPekerjaan,
  parseKapasitasNilai,
  satuanJenisPekerjaan,
  teksKapasitasNilai,
} from '../data/katalogInstalasi';

const inputCls =
  'w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-600 disabled:cursor-not-allowed';

function Row({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[170px_1fr] gap-1.5 sm:gap-4 sm:items-start">
      <label className="text-sm font-bold text-slate-800 sm:pt-2.5">{label}</label>
      <div>
        {children}
        {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}

interface Props {
  value: KlasifikasiInstalasiFields;
  /** Jenis Pekerjaan / Jenis Instalasi yang dipilih di formulir; dari sini Bidang, Sub Bidang, dan satuan diturunkan. */
  jenisPekerjaan: string;
  onChange: (patch: Partial<KlasifikasiInstalasiFields>) => void;
}

/**
 * Kapasitas (angka + satuan). Bidang dan Sub Bidang tidak dipilih lagi di sini: keduanya otomatis mengikuti
 * Jenis Pekerjaan, begitu juga daftar satuannya. Hanya data internal: tidak dipakai di dokumen cetak.
 * Terkunci otomatis di dalam <fieldset disabled>.
 */
export function KlasifikasiKapasitasFields({ value, jenisPekerjaan, onChange }: Props) {
  const turunan = klasifikasiDariJenisPekerjaan(jenisPekerjaan);
  const dikenal = !!turunan.klasifikasiBidang;
  const bidang = dikenal ? turunan.klasifikasiBidang : value.klasifikasiBidang;
  const sub = dikenal ? turunan.klasifikasiSubBidang : value.klasifikasiSubBidang;
  const satuanSah = dikenal
    ? satuanJenisPekerjaan(jenisPekerjaan)
    : daftarSatuan(value.klasifikasiBidang, value.klasifikasiSubBidang, value.klasifikasiJenis);

  // Teks ketikan disimpan terpisah agar "2," tidak langsung berubah jadi "2" saat angkanya dibaca.
  const [teks, setTeks] = useState(() => teksKapasitasNilai(value.kapasitasNilai));
  const teksTakValid = teks.trim() !== '' && parseKapasitasNilai(teks) === null;

  // Samakan Bidang / Sub Bidang / satuan dengan Jenis Pekerjaan yang dipilih.
  useEffect(() => {
    if (!dikenal) return;
    const patch: Partial<KlasifikasiInstalasiFields> = {};
    if (value.klasifikasiBidang !== turunan.klasifikasiBidang) patch.klasifikasiBidang = turunan.klasifikasiBidang;
    if (value.klasifikasiSubBidang !== turunan.klasifikasiSubBidang) patch.klasifikasiSubBidang = turunan.klasifikasiSubBidang;
    if (value.klasifikasiJenis) patch.klasifikasiJenis = ''; // pilihan jenis dari katalog lama tidak dipakai lagi
    const adaIsi = value.kapasitasNilai !== null && value.kapasitasNilai !== undefined;
    const satuanTakSah = !!value.kapasitasSatuan && !satuanSah.includes(value.kapasitasSatuan);
    if (satuanTakSah || (adaIsi && !value.kapasitasSatuan)) patch.kapasitasSatuan = satuanSah[0] ?? '';
    if (Object.keys(patch).length > 0) onChange(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jenisPekerjaan, value.klasifikasiBidang, value.klasifikasiSubBidang, value.klasifikasiJenis, value.kapasitasSatuan]);

  const ketikNilai = (t: string) => {
    setTeks(t);
    const nilai = parseKapasitasNilai(t);
    onChange(nilai !== null && !value.kapasitasSatuan && satuanSah[0] ? { kapasitasNilai: nilai, kapasitasSatuan: satuanSah[0] } : { kapasitasNilai: nilai });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
      <div>
        <h4 className="text-sm font-bold text-slate-800">Kapasitas Instalasi</h4>
        <p className="text-xs text-slate-500">
          Data internal — tidak ikut tercetak di Surat Penawaran maupun Work Order.
          {bidang && sub && (
            <>
              {' '}
              Bidang &amp; Sub Bidang otomatis dari Jenis Pekerjaan: {bidang} / {sub}.
            </>
          )}
        </p>
      </div>
      <Row
        label="Kapasitas"
        hint={
          teksTakValid ? (
            <span className="text-red-500">Angka tidak valid. Contoh: 750 atau 562,5</span>
          ) : (
            'Isi angka, lalu pilih satuan. Desimal dengan koma, mis. 562,5.'
          )
        }
      >
        <div className="flex items-center gap-2">
          <input
            inputMode="decimal"
            className={inputCls}
            value={teks}
            placeholder="mis. 750"
            onChange={(e) => ketikNilai(e.target.value)}
            aria-invalid={teksTakValid}
          />
          <select
            className={`${inputCls} !w-32 shrink-0`}
            value={value.kapasitasSatuan ?? ''}
            disabled={satuanSah.length === 0}
            onChange={(e) => onChange({ kapasitasSatuan: e.target.value })}
            aria-label="Satuan kapasitas"
          >
            {satuanSah.length === 0 && <option value="">Satuan</option>}
            {satuanSah.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </Row>
    </div>
  );
}
