import { useState, type ReactNode } from 'react';
import type { KlasifikasiInstalasiFields } from '../types/portal';
import {
  daftarBidang,
  daftarJenis,
  daftarSatuan,
  daftarSubBidang,
  parseKapasitasNilai,
  teksKapasitasNilai,
} from '../data/katalogInstalasi';

const inputCls =
  'w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:bg-slate-50 disabled:text-slate-600 disabled:cursor-not-allowed';

function Row({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[170px_1fr] gap-1.5 sm:gap-4 sm:items-start">
      <label className="text-sm font-bold text-slate-800 sm:pt-2.5">{label}</label>
      <div>
        {children}
        {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      </div>
    </div>
  );
}

interface Props {
  value: KlasifikasiInstalasiFields;
  onChange: (patch: Partial<KlasifikasiInstalasiFields>) => void;
}

/**
 * Pilihan bertingkat Bidang -> Sub Bidang -> Jenis Instalasi dan kapasitas (angka + satuan).
 * Hanya data internal: komponen ini tidak dipakai di dokumen cetak. Terkunci otomatis di dalam <fieldset disabled>.
 */
export function KlasifikasiKapasitasFields({ value, onChange }: Props) {
  const bidang = value.klasifikasiBidang ?? '';
  const sub = value.klasifikasiSubBidang ?? '';
  const jenis = value.klasifikasiJenis ?? '';
  const satuanSah = daftarSatuan(bidang, sub, jenis);

  // Teks ketikan disimpan terpisah agar "2," tidak langsung berubah jadi "2" saat angkanya dibaca.
  const [teks, setTeks] = useState(() => teksKapasitasNilai(value.kapasitasNilai));
  const teksTakValid = teks.trim() !== '' && parseKapasitasNilai(teks) === null;

  const pilihBidang = (b: string) =>
    onChange({ klasifikasiBidang: b, klasifikasiSubBidang: '', klasifikasiJenis: '', kapasitasSatuan: '' });
  const pilihSub = (s: string) => onChange({ klasifikasiSubBidang: s, klasifikasiJenis: '', kapasitasSatuan: '' });
  const pilihJenis = (j: string) => {
    const sah = daftarSatuan(bidang, sub, j);
    const satuan = value.kapasitasSatuan && sah.includes(value.kapasitasSatuan) ? value.kapasitasSatuan : sah[0] ?? '';
    onChange({ klasifikasiJenis: j, kapasitasSatuan: satuan });
  };
  const ketikNilai = (t: string) => {
    setTeks(t);
    const nilai = parseKapasitasNilai(t);
    onChange(nilai !== null && !value.kapasitasSatuan && satuanSah[0] ? { kapasitasNilai: nilai, kapasitasSatuan: satuanSah[0] } : { kapasitasNilai: nilai });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
      <div>
        <h4 className="text-sm font-bold text-slate-800">Klasifikasi Instalasi</h4>
        <p className="text-xs text-slate-500">Data internal — tidak ikut tercetak di Surat Penawaran maupun Work Order.</p>
      </div>
      <Row label="Bidang">
        <select className={inputCls} value={bidang} onChange={(e) => pilihBidang(e.target.value)}>
          <option value="">-- Pilih Bidang --</option>
          {bidang && !daftarBidang().includes(bidang) && <option value={bidang}>{bidang}</option>}
          {daftarBidang().map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Sub Bidang">
        <select className={inputCls} value={sub} disabled={!bidang} onChange={(e) => pilihSub(e.target.value)}>
          <option value="">-- Pilih Sub Bidang --</option>
          {sub && !daftarSubBidang(bidang).includes(sub) && <option value={sub}>{sub}</option>}
          {daftarSubBidang(bidang).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Jenis Instalasi">
        <select className={inputCls} value={jenis} disabled={!sub} onChange={(e) => pilihJenis(e.target.value)}>
          <option value="">-- Pilih Jenis Instalasi --</option>
          {jenis && !daftarJenis(bidang, sub).includes(jenis) && <option value={jenis}>{jenis}</option>}
          {daftarJenis(bidang, sub).map((j) => (
            <option key={j} value={j}>
              {j}
            </option>
          ))}
        </select>
      </Row>
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
