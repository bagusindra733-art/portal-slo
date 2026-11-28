import type { FlowStepKey } from '../utils/portalUtils';

/** Kunci panel yang dibuka dari halaman detail pekerjaan. */
export type AlurRowKey = FlowStepKey | 'instalasi' | 'berkas';

/**
 * Pintasan panel di halaman detail pekerjaan (semua peran). Alur/langkah tidak ditampilkan lagi di sini:
 * riwayat ada di tombol History, tombol kerja ada di kolom Action Daftar Pekerjaan.
 */
export function PintasanPanel({ onOpen }: { onOpen: (key: AlurRowKey) => void }) {
  const cls =
    'inline-flex items-center px-4 h-10 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-bold hover:bg-slate-50 cursor-pointer';
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => onOpen('instalasi')} className={cls}>
        Instalasi &amp; No. Agenda DJK
      </button>
      <button type="button" onClick={() => onOpen('berkas')} className={cls}>
        Berkas &amp; Riwayat
      </button>
    </div>
  );
}

export default PintasanPanel;
