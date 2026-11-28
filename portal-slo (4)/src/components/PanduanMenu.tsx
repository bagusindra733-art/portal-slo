import { ISTILAH } from '../data/istilah';
import type { UserSession } from '../types/portal';

type Role = UserSession['role'];

const ALUR = [
  { n: 1, siapa: 'Marketing', apa: 'Buat Penawaran & Sales Order' },
  { n: 2, siapa: 'Admin', apa: 'Pilih PJT sesuai bidang' },
  { n: 3, siapa: 'PJT', apa: 'Tunjuk Leader & tim' },
  { n: 4, siapa: 'Leader & tim', apa: 'Buat Surat Tugas, Surat Jalan & JSA → kirim ke Direktur' },
  { n: 5, siapa: 'Direktur', apa: 'Review & TTD → otomatis ke Admin' },
  { n: 6, siapa: 'Admin', apa: 'Input Layanan SLO sampai SLO terbit' },
];

const PANDUAN: Record<Role, { judul: string; langkahAnda: number[]; tugas: string[]; menu: string[] }> = {
  sales: {
    judul: 'Marketing',
    langkahAnda: [1],
    tugas: [
      'Buat data Pelanggan, lalu Penawaran, lalu Sales Order.',
      'Setelah Sales Order jadi, pekerjaan otomatis tampil di Admin.',
      'Pantau posisi pekerjaan di Daftar Pekerjaan (tombol History).',
    ],
    menu: ['Create Order', 'Data Sales Order', 'Daftar Pekerjaan'],
  },
  teknis: {
    judul: 'Admin',
    langkahAnda: [2, 6],
    tugas: [
      'Di Daftar Pekerjaan, klik "Pilih PJT" pada pekerjaan baru.',
      'Setelah Direktur TTD, klik "Input Layanan SLO" untuk Verifikasi LIT dan No. Agenda DJK.',
      'Lanjutkan tiap instalasi di menu Layanan SLO sampai SLO terbit (pekerjaan otomatis selesai).',
    ],
    menu: ['Daftar Pekerjaan', 'Layanan SLO'],
  },
  pjt: {
    judul: 'PJT (Penanggung Jawab Teknik)',
    langkahAnda: [3],
    tugas: [
      'Di Daftar Pekerjaan, klik "Tunjuk Leader & Tim" pada pekerjaan yang diteruskan Admin.',
      'Pilih satu Leader, lalu centang anggota tim. Nama Anda sendiri tidak bisa dipilih.',
      'Personel dengan SKTTK/K3 kedaluwarsa tidak bisa dipilih — cek menu Peringatan.',
    ],
    menu: ['Daftar Pekerjaan', 'Personel TTK'],
  },
  inspektor: {
    judul: 'Tenaga Teknik (Leader & Anggota)',
    langkahAnda: [4],
    tugas: [
      'Di Daftar Pekerjaan, tombol "Buat ST, JSA & Surat Jalan" muncul saat giliran tim Anda.',
      'Urutannya: Surat Tugas → Surat Jalan Alat → JSA (pakai "Simpan & Lanjutkan").',
      'Setelah ketiganya tersimpan, klik "Kirim ke Direktur". Bila dikembalikan, perbaiki lalu kirim ulang.',
    ],
    menu: ['Daftar Pekerjaan', 'Alat Uji'],
  },
  direktur: {
    judul: 'Direktur Utama',
    langkahAnda: [5],
    tugas: [
      'Di Daftar Pekerjaan, klik "Review & TTD" pada pekerjaan bertanda "Giliran Anda".',
      'Baca dokumen, beri komentar bila perlu, lalu "Tanda Tangani Surat Tugas (TTE)".',
      'Bila tidak sesuai, tulis alasan di kolom komentar lalu "Kembalikan untuk Revisi".',
    ],
    menu: ['Daftar Pekerjaan', 'Rekap Dokumen'],
  },
};

export function PanduanMenu({ role }: { role: Role }) {
  const g = PANDUAN[role];
  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-5 md:p-6">
        <h2 className="font-display text-xl font-extrabold text-slate-900">Mulai di sini — peran Anda: {g.judul}</h2>
        <p className="mt-1 text-sm text-slate-600">
          Pekerjaan Anda ada di menu <b>{g.menu.join('</b> dan <b>')}</b>. Cari tombol ungu di kolom <b>Action</b>.
        </p>
        <ol className="mt-4 space-y-2">
          {g.tugas.map((t, i) => (
            <li key={t} className="flex gap-3 text-sm text-slate-800">
              <span className="shrink-0 w-7 h-7 rounded-full bg-violet-600 text-white font-bold flex items-center justify-center text-sm">
                {i + 1}
              </span>
              <span className="pt-0.5">{t}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-5 md:p-6">
        <h3 className="font-display text-base font-extrabold text-slate-900">Alur pekerjaan: 6 langkah</h3>
        <ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ALUR.map((a) => {
            const mine = g.langkahAnda.includes(a.n);
            return (
              <li
                key={a.n}
                className={`rounded-xl border p-3 text-sm ${mine ? 'border-violet-400 bg-violet-50' : 'border-slate-200 bg-white'}`}
              >
                <span className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Langkah {a.n} · {a.siapa}
                  {mine && <span className="ml-2 rounded bg-violet-600 px-1.5 py-0.5 text-white">Bagian Anda</span>}
                </span>
                <span className="mt-1 block text-slate-800">{a.apa}</span>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-5 md:p-6">
        <h3 className="font-display text-base font-extrabold text-slate-900">Arti istilah</h3>
        <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {Object.entries(ISTILAH).map(([k, v]) => (
            <div key={k} className="text-sm">
              <dt className="font-bold text-slate-900">
                {k} <span className="font-normal text-slate-500">— {v.panjang}</span>
              </dt>
              <dd className="text-slate-600">{v.arti}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

export default PanduanMenu;
