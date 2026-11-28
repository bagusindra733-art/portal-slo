import type {
  InstalasiTahap,
  JoSoRecord,
  Project,
  SuratPenawaran,
  UserSession,
} from '../types/portal';
import {
  FLOW_STEPS,
  HARI_MACET,
  currentFlowIndex,
  giliranSaya,
  hariDiLangkah,
  isSamePersonName,
  pekerjaanSudahDipilih,
  reportsOfInstalasi,
  type InstalasiRow,
} from './portalUtils';

type Role = UserSession['role'];

/* ------------------------------------------------------------------ */
/* Daftar pekerjaan (satu Sales Order + proyek terkait)                  */
/* ------------------------------------------------------------------ */

export interface PekerjaanItem {
  key: string;
  rec?: JoSoRecord;
  project?: Project;
}

/**
 * Kumpulan pekerjaan yang tampil di Daftar Pekerjaan, dipakai bersama oleh Daftar Pekerjaan
 * dan Overview supaya angkanya selalu sama. Satu Sales Order = satu pekerjaan; proyek lama
 * tanpa Sales Order tetap ikut. `restricted` (PJT & Tenaga Teknik) hanya melihat proyek miliknya.
 */
export function kumpulkanPekerjaan(
  records: JoSoRecord[],
  projects: Project[],
  visibleProjects: Project[],
  restricted: boolean
): PekerjaanItem[] {
  const visibleIds = new Set(visibleProjects.map((p) => p.id));
  const linked = new Set<string>();
  const out: PekerjaanItem[] = [];

  for (const rec of records) {
    const project = projects.find((p) => p.id === rec.projectId || p.joSoId === rec.id);
    if (project) linked.add(project.id);
    if (restricted && !(project && visibleIds.has(project.id))) continue;
    out.push({ key: `so-${rec.id}`, rec, project });
  }
  for (const p of projects) {
    if (linked.has(p.id)) continue;
    if (restricted && !visibleIds.has(p.id)) continue;
    out.push({ key: `pr-${p.id}`, project: p });
  }
  return out;
}

/**
 * Langkah (0..5) tempat pekerjaan berada; 6 = selesai (SLO terbit).
 * Pekerjaan yang belum dipilih Admin selalu dihitung di langkah 2 (Pilih PJT).
 */
export function langkahIndex(p?: Project): number {
  if (!p) return 1;
  if (currentFlowIndex(p) >= 6) return 6;
  if (!pekerjaanSudahDipilih(p)) return 1;
  return Math.max(1, currentFlowIndex(p));
}

export interface PipelineLangkah {
  index: number;
  label: string;
  owner: string;
  count: number;
  /** Ada pekerjaan di langkah ini yang diam lebih dari HARI_MACET hari. */
  macet: number;
}

/** Penawaran yang masih berjalan dan belum dibuatkan Sales Order (langkah 1: Marketing). */
export function penawaranBerjalan(penawaran: SuratPenawaran[], records: JoSoRecord[]): SuratPenawaran[] {
  const sudahPo = new Set(records.map((r) => r.penawaranId).filter(Boolean));
  return penawaran.filter((x) => ['draft', 'submit', 'approved'].includes(x.status) && !sudahPo.has(x.id));
}

/** Jumlah pekerjaan di tiap langkah dari 6 langkah alur + jumlah yang sudah selesai. */
export function hitungPipeline(
  items: PekerjaanItem[],
  jumlahPenawaran: number,
  now = Date.now()
): { langkah: PipelineLangkah[]; selesai: number } {
  const langkah: PipelineLangkah[] = FLOW_STEPS.map((s, index) => ({
    index,
    label: s.label,
    owner: s.owner,
    count: index === 0 ? jumlahPenawaran : 0,
    macet: 0,
  }));
  let selesai = 0;
  for (const it of items) {
    const idx = langkahIndex(it.project);
    if (idx >= 6) {
      selesai += 1;
      continue;
    }
    langkah[idx].count += 1;
    const hari = hariDiLangkah(it.project, now);
    if (hari !== null && hari > HARI_MACET) langkah[idx].macet += 1;
  }
  return { langkah, selesai };
}

/* ------------------------------------------------------------------ */
/* Perlu tindakan saya                                                  */
/* ------------------------------------------------------------------ */

export type TujuanBuka =
  | { type: 'project'; projectId: string; row?: 'prep_docs' | 'director' }
  | { type: 'daftar' }
  | { type: 'layanan' }
  | { type: 'tab'; tab: string };

export interface TindakanItem {
  key: string;
  judul: string;
  sub: string;
  aksi: string;
  hari: number | null;
  macet: boolean;
  buka: TujuanBuka;
}

/** Selisih hari dari tanggal ISO (YYYY-MM-DD…) sampai sekarang; null bila tanggal tidak valid. */
export function hariSejak(iso?: string, now = Date.now()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now - t) / 86400000));
}

const sortTindakan = (a: TindakanItem, b: TindakanItem) =>
  (b.hari ?? -1) - (a.hari ?? -1) || a.judul.localeCompare(b.judul, 'id');

function aksiPekerjaan(role: Role, p: Project | undefined): { aksi: string; buka: TujuanBuka } {
  if (role === 'teknis') {
    if (!pekerjaanSudahDipilih(p)) return { aksi: 'Pilih PJT', buka: { type: 'daftar' } };
    return { aksi: 'Input Layanan SLO', buka: { type: 'layanan' } };
  }
  if (role === 'pjt') return { aksi: 'Tunjuk Leader & Tim', buka: { type: 'daftar' } };
  if (role === 'direktur') {
    return { aksi: 'Review & TTD Surat Tugas', buka: { type: 'project', projectId: p!.id, row: 'director' } };
  }
  return { aksi: 'Buat ST, JSA & Surat Jalan', buka: { type: 'project', projectId: p!.id, row: 'prep_docs' } };
}

/**
 * Pekerjaan yang sedang giliran peran ini, memakai aturan `giliranSaya` yang sama dengan tombol
 * "Perlu tindakan saya" di Daftar Pekerjaan. Urut dari yang paling lama menunggu.
 */
export function tindakanSaya(
  items: PekerjaanItem[],
  role: Role,
  myInspectorId: string,
  pjtName: string,
  now = Date.now()
): TindakanItem[] {
  const out: TindakanItem[] = [];
  for (const it of items) {
    if (!giliranSaya(it.project, role, myInspectorId, pjtName)) continue;
    const { aksi, buka } = aksiPekerjaan(role, it.project);
    const p = it.project;
    const hari = p ? hariDiLangkah(p, now) : hariSejak(it.rec?.poDate, now);
    const judul = it.rec?.title || it.rec?.perihal || (p ? `${p.sub}${p.kap ? ` ${p.kap}` : ''}`.trim() : '-');
    const pelanggan = it.rec ? it.rec.namaPerusahaan || p?.perusahaan || '' : p?.perusahaan || '';
    const po = it.rec?.poNo || p?.po?.name || '';
    out.push({
      key: it.key,
      judul: judul || '-',
      sub: [po, pelanggan].filter(Boolean).join(' · ') || '-',
      aksi,
      hari,
      macet: hari !== null && hari > HARI_MACET,
      buka,
    });
  }
  return out.sort(sortTindakan);
}

/** Marketing: penawaran yang perlu dilanjutkan (draft belum dikirim, atau submit/approved belum dibuatkan PO). */
export function tindakanMarketing(penawaran: SuratPenawaran[], records: JoSoRecord[], now = Date.now()): TindakanItem[] {
  const sudahPo = new Set(records.map((r) => r.penawaranId).filter(Boolean));
  const out: TindakanItem[] = [];
  for (const x of penawaran) {
    const hari = hariSejak(x.updatedAt || x.tanggal, now);
    const base = { key: `pw-${x.id}`, judul: x.perihal || x.noPenawaran || '-', sub: [x.noPenawaran, x.pelangganNama].filter(Boolean).join(' · ') || '-', hari, macet: hari !== null && hari > HARI_MACET };
    if (x.status === 'draft') {
      out.push({ ...base, aksi: 'Selesaikan & kirim penawaran', buka: { type: 'tab', tab: 'data-penawaran' } });
    } else if ((x.status === 'submit' || x.status === 'approved') && !sudahPo.has(x.id)) {
      out.push({ ...base, aksi: 'Buat PO', buka: { type: 'tab', tab: 'input-sales-order' } });
    }
  }
  return out.sort(sortTindakan);
}

/* ------------------------------------------------------------------ */
/* Instalasi (Layanan SLO)                                              */
/* ------------------------------------------------------------------ */

export const URUTAN_TAHAP: InstalasiTahap[] = [
  'verifikasi_lit',
  'pengerjaan_tt',
  'pengesahan_pjt',
  'evaluasi_lit',
  'evaluasi_djk',
  'generate_slo',
  'cetak_slo',
  'slo_terbit',
];

/** Jumlah instalasi per tahap Layanan SLO, plus total dan yang sudah terbit. */
export function hitungTahapInstalasi(rows: InstalasiRow[]): {
  perTahap: Record<InstalasiTahap, number>;
  total: number;
  terbit: number;
} {
  const perTahap = Object.fromEntries(URUTAN_TAHAP.map((t) => [t, 0])) as Record<InstalasiTahap, number>;
  for (const r of rows) perTahap[r.tahap] += 1;
  return { perTahap, total: rows.length, terbit: perTahap.slo_terbit };
}

/** Tahap yang dikerjakan tiap peran (sama dengan ACTOR di Layanan SLO). */
const TAHAP_PERAN: Record<Role, InstalasiTahap[]> = {
  teknis: ['verifikasi_lit', 'evaluasi_lit', 'generate_slo', 'cetak_slo'],
  pjt: ['pengesahan_pjt'],
  inspektor: ['pengerjaan_tt'],
  sales: [],
  direktur: [],
};

/**
 * Instalasi ini milik Tenaga Teknik tersebut: terdaftar di SiUjang untuk instalasi itu,
 * atau (bila daftar kosong) ia anggota tim proyek. Aturan sama dengan menu Layanan SLO.
 */
export const instalasiMilikInspektor = (r: InstalasiRow, inspectorId: string): boolean =>
  r.ins.teamIds?.length
    ? r.ins.teamIds.includes(inspectorId)
    : Boolean(r.p.team && (r.p.team.lead === inspectorId || r.p.team.ins.includes(inspectorId)));

/** Instalasi yang boleh dilihat peran ini di Layanan SLO (Tenaga Teknik hanya miliknya). */
export const instalasiTerlihat = (rows: InstalasiRow[], role: Role, inspectorId: string): InstalasiRow[] =>
  role === 'inspektor' ? rows.filter((r) => instalasiMilikInspektor(r, inspectorId)) : rows;

/** Instalasi yang menunggu peran ini. Untuk Tenaga Teknik hanya instalasi miliknya; untuk PJT hanya proyek PJT tersebut. */
export function instalasiMenungguSaya(
  rows: InstalasiRow[],
  role: Role,
  myInspectorId: string,
  pjtName: string
): InstalasiRow[] {
  const tahap = TAHAP_PERAN[role];
  return rows.filter((r) => {
    if (!tahap.includes(r.tahap)) return false;
    if (role === 'pjt') return isSamePersonName(r.p.pjtName, pjtName);
    if (role === 'inspektor') return instalasiMilikInspektor(r, myInspectorId);
    return true;
  });
}

/** Instalasi di Pengerjaan TT yang belum punya satu pun laporan (tombol Teruskan ke PJT masih terkunci). */
export const instalasiTanpaLaporan = (rows: InstalasiRow[]): InstalasiRow[] =>
  rows.filter((r) => r.tahap === 'pengerjaan_tt' && reportsOfInstalasi(r.p, r.ins.id).length === 0);

/* ------------------------------------------------------------------ */
/* Ringkasan umum                                                       */
/* ------------------------------------------------------------------ */

/** Jumlah Sales Order yang tanggal PO-nya jatuh di bulan & tahun yang sama dengan `now`. */
export function salesOrderBulanIni(records: JoSoRecord[], now = new Date()): number {
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return records.filter((r) => (r.poDate || '').slice(0, 7) === ym).length;
}

/** Jumlah proyek per jenis instalasi (untuk donut portofolio). */
export function hitungJenis(projects: Project[]): { Pembangkit: number; TT: number; TM: number } {
  return {
    Pembangkit: projects.filter((p) => p.jenis === 'Pembangkit').length,
    TT: projects.filter((p) => p.jenis === 'TT').length,
    TM: projects.filter((p) => p.jenis === 'TM').length,
  };
}
