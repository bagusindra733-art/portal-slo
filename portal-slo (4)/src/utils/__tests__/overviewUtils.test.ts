import { describe, expect, it } from 'vitest';
import type { JoSoRecord, Project, SuratPenawaran } from '../../types/portal';
import type { InstalasiRow } from '../portalUtils';
import { giliranSaya } from '../portalUtils';
import {
  hariSejak,
  hitungPipeline,
  hitungTahapInstalasi,
  instalasiMenungguSaya,
  instalasiTanpaLaporan,
  instalasiTerlihat,
  kumpulkanPekerjaan,
  langkahIndex,
  penawaranBerjalan,
  salesOrderBulanIni,
  tindakanMarketing,
  tindakanSaya,
} from '../overviewUtils';

const NOW = new Date('2026-11-28T10:00:00Z').getTime();
const daysAgo = (n: number) => new Date(NOW - n * 86400000).toISOString();

const proj = (over: Partial<Project> & { id: string }): Project =>
  ({
    no: over.id,
    perusahaan: `PT ${over.id}`,
    kota: 'Surabaya',
    jenis: 'TT',
    sub: 'GI',
    kap: '150 kV',
    status: 'rfq',
    files: [],
    penawaran: null,
    team: null,
    docs: { issued: false, ack: false },
    att: [],
    form: { items: {}, photos: [], submitted: false },
    finds: [],
    bap: null,
    pjt: null,
    slo: null,
    po: null,
    transfer: null,
    log: [],
    ...over,
  }) as Project;

const rec = (over: Partial<JoSoRecord> & { id: string }): JoSoRecord =>
  ({ poNo: `PO-${over.id}`, title: `Judul ${over.id}`, perihal: '', poDate: '2026-11-03', ...over }) as JoSoRecord;

const pw = (over: Partial<SuratPenawaran> & { id: string }): SuratPenawaran =>
  ({ noPenawaran: `PNW-${over.id}`, perihal: `Perihal ${over.id}`, pelangganNama: 'PT X', status: 'draft', tanggal: '2026-11-01', updatedAt: daysAgo(2), ...over }) as SuratPenawaran;

// Proyek di tiap langkah alur
const diAdmin = proj({ id: 'adm', log: [[daysAgo(1), 'x']] }); // belum dipilih
const diPjt = proj({ id: 'pjt', pjtName: 'Kusno Hadi Bitoyo', workflowStage: 'forwarded_to_pjt', log: [[daysAgo(5), 'x']] });
const diLeader = proj({
  id: 'ldr',
  pjtName: 'Kusno Hadi Bitoyo',
  workflowStage: 'leader_assigned',
  team: { lead: 'i1', ins: ['i2'], tools: [] },
  log: [[daysAgo(2), 'x']],
});
const diDirektur = proj({
  id: 'dir',
  pjtName: 'Kusno Hadi Bitoyo',
  workflowStage: 'leader_assigned',
  team: { lead: 'i1', ins: [], tools: [] },
  prepReview: { status: 'submitted' } as Project['prepReview'],
  log: [[daysAgo(7), 'x']],
});
const diSlo = proj({
  id: 'slo',
  pjtName: 'Ahmad Fauzan Hamdhani',
  workflowStage: 'leader_assigned',
  team: { lead: 'i1', ins: [], tools: [] },
  directorReview: { status: 'signed' } as Project['directorReview'],
  log: [[daysAgo(0), 'x']],
});
const selesai = proj({ id: 'done', status: 'slo', pjtName: 'Kusno Hadi Bitoyo', workflowStage: 'leader_assigned', sloNotice: { at: daysAgo(9), by: 'Sistem', note: '' } as Project['sloNotice'] });

describe('langkahIndex', () => {
  it('memetakan proyek ke langkah 1–6 (indeks 1..6)', () => {
    expect(langkahIndex(undefined)).toBe(1); // Sales Order tanpa proyek = menunggu Admin
    expect(langkahIndex(diAdmin)).toBe(1);
    expect(langkahIndex(diPjt)).toBe(2);
    expect(langkahIndex(diLeader)).toBe(3);
    expect(langkahIndex(diDirektur)).toBe(4);
    expect(langkahIndex(diSlo)).toBe(5);
    expect(langkahIndex(selesai)).toBe(6);
  });
});

describe('kumpulkanPekerjaan', () => {
  const records = [rec({ id: 'a', projectId: 'pjt' }), rec({ id: 'b' }), rec({ id: 'c', projectId: 'ldr' })];
  const projects = [diPjt, diLeader, diAdmin];

  it('menyatukan Sales Order, proyek terkait, dan proyek lama tanpa SO', () => {
    const out = kumpulkanPekerjaan(records, projects, projects, false);
    expect(out.map((o) => o.key)).toEqual(['so-a', 'so-b', 'so-c', 'pr-adm']);
    expect(out[1].project).toBeUndefined();
  });

  it('peran terbatas hanya melihat proyek miliknya', () => {
    const out = kumpulkanPekerjaan(records, projects, [diLeader], true);
    expect(out.map((o) => o.key)).toEqual(['so-c']);
  });
});

describe('hitungPipeline', () => {
  it('menghitung per langkah, selesai, dan yang macet (> 3 hari)', () => {
    const items = kumpulkanPekerjaan([], [diAdmin, diPjt, diLeader, diDirektur, diSlo, selesai], [], false);
    const { langkah, selesai: n } = hitungPipeline(items, 4, NOW);
    expect(langkah.map((l) => l.count)).toEqual([4, 1, 1, 1, 1, 1]);
    expect(n).toBe(1);
    expect(langkah.map((l) => l.macet)).toEqual([0, 0, 1, 0, 1, 0]); // diPjt 5 hari, diDirektur 7 hari
  });

  it('pekerjaan SLO terbit tidak dihitung macet', () => {
    const { langkah } = hitungPipeline(kumpulkanPekerjaan([], [selesai], [], false), 0, NOW);
    expect(langkah.every((l) => l.count === 0 && l.macet === 0)).toBe(true);
  });
});

describe('tindakanSaya', () => {
  const records = [rec({ id: 'baru', poDate: '2026-11-20' })]; // SO belum jadi proyek
  const projects = [diAdmin, diPjt, diLeader, diDirektur, diSlo, selesai];
  const items = kumpulkanPekerjaan(records, projects, projects, false);

  it('Admin: SO belum dipilih + proyek di Layanan SLO, yang paling lama menunggu paling atas', () => {
    const t = tindakanSaya(items, 'teknis', '', '', NOW);
    expect(t.map((x) => x.key)).toEqual(['so-baru', 'pr-adm', 'pr-slo']);
    expect(t.find((x) => x.key === 'so-baru')?.aksi).toBe('Pilih PJT');
    expect(t.find((x) => x.key === 'pr-slo')?.aksi).toBe('Input Layanan SLO');
    // 8 hari (SO baru, dari poDate) > 1 hari (adm) > 0 hari (slo)
    expect(t.map((x) => x.hari)).toEqual([8, 1, 0]);
    expect(t[0].macet).toBe(true);
    expect(t[1].macet).toBe(false);
  });

  it('PJT hanya melihat pekerjaannya sendiri di langkah 3', () => {
    const t = tindakanSaya(items, 'pjt', '', 'Kusno Hadi Bitoyo', NOW);
    expect(t.map((x) => x.key)).toEqual(['pr-pjt']);
    expect(t[0].aksi).toBe('Tunjuk Leader & Tim');
    expect(t[0].macet).toBe(true);
    expect(tindakanSaya(items, 'pjt', '', 'Ahmad Fauzan Hamdhani', NOW)).toEqual([]);
  });

  it('Direktur: Surat Tugas menunggu TTD membuka panel review', () => {
    const t = tindakanSaya(items, 'direktur', '', '', NOW);
    expect(t.map((x) => x.key)).toEqual(['pr-dir']);
    expect(t[0].buka).toEqual({ type: 'project', projectId: 'dir', row: 'director' });
  });

  it('Tenaga Teknik: hanya pekerjaan tim saya di langkah 4', () => {
    expect(tindakanSaya(items, 'inspektor', 'i2', '', NOW).map((x) => x.key)).toEqual(['pr-ldr']);
    expect(tindakanSaya(items, 'inspektor', 'i9', '', NOW)).toEqual([]);
  });

  it('Marketing tidak memakai giliran pekerjaan', () => {
    expect(tindakanSaya(items, 'sales', '', '', NOW)).toEqual([]);
  });

  it('selalu sejalan dengan giliranSaya (angka sama dengan "Perlu tindakan saya" di Daftar Pekerjaan)', () => {
    for (const [role, id, name] of [
      ['teknis', '', ''],
      ['pjt', '', 'Kusno Hadi Bitoyo'],
      ['direktur', '', ''],
      ['inspektor', 'i1', ''],
    ] as const) {
      const expected = items.filter((it) => giliranSaya(it.project, role, id, name)).length;
      expect(tindakanSaya(items, role, id, name, NOW)).toHaveLength(expected);
    }
  });
});

describe('Marketing', () => {
  const list = [
    pw({ id: '1', status: 'draft' }),
    pw({ id: '2', status: 'submit' }),
    pw({ id: '3', status: 'approved' }),
    pw({ id: '4', status: 'rejected' }),
    pw({ id: '5', status: 'approved' }),
  ];
  const records = [rec({ id: 'r', penawaranId: '3' })];

  it('penawaranBerjalan: bukan rejected dan belum jadi Sales Order', () => {
    expect(penawaranBerjalan(list, records).map((x) => x.id)).toEqual(['1', '2', '5']);
  });

  it('tindakanMarketing: draft → kirim, submit/approved belum PO → Buat PO', () => {
    const t = tindakanMarketing(list, records, NOW);
    expect(t.map((x) => [x.key, x.aksi])).toEqual([
      ['pw-1', 'Selesaikan & kirim penawaran'],
      ['pw-2', 'Buat PO'],
      ['pw-5', 'Buat PO'],
    ]);
  });

  it('salesOrderBulanIni menghitung PO di bulan & tahun yang sama', () => {
    const rs = [rec({ id: '1', poDate: '2026-11-02' }), rec({ id: '2', poDate: '2026-10-30' }), rec({ id: '3', poDate: '2025-11-02' })];
    expect(salesOrderBulanIni(rs, new Date(2026, 10, 28))).toBe(1);
  });
});

describe('instalasi', () => {
  const p1 = proj({
    id: 'p1',
    pjtName: 'Kusno Hadi Bitoyo',
    team: { lead: 'i1', ins: ['i2'], tools: [] },
    reports: [{ instalasiId: 'a2' }] as Project['reports'],
  });
  const p2 = proj({ id: 'p2', pjtName: 'Ahmad Fauzan Hamdhani', team: { lead: 'i3', ins: [], tools: [] } });
  const row = (p: Project, id: string, tahap: InstalasiRow['tahap'], teamIds?: string[]): InstalasiRow => ({
    p,
    ins: { id, nama: id, noAgenda: id, teamIds },
    tahap,
  });
  const rows = [
    row(p1, 'a1', 'pengerjaan_tt'),
    row(p1, 'a2', 'pengerjaan_tt', ['i9']),
    row(p1, 'a3', 'pengesahan_pjt'),
    row(p2, 'b1', 'verifikasi_lit'),
    row(p2, 'b2', 'evaluasi_djk'),
    row(p2, 'b3', 'slo_terbit'),
  ];

  it('hitungTahapInstalasi', () => {
    const h = hitungTahapInstalasi(rows);
    expect(h.total).toBe(6);
    expect(h.terbit).toBe(1);
    expect(h.perTahap.pengerjaan_tt).toBe(2);
    expect(h.perTahap.cetak_slo).toBe(0);
  });

  it('Tenaga Teknik hanya melihat instalasi miliknya (SiUjang, atau tim proyek bila kosong)', () => {
    expect(instalasiTerlihat(rows, 'inspektor', 'i2').map((r) => r.ins.id)).toEqual(['a1', 'a3']);
    expect(instalasiTerlihat(rows, 'inspektor', 'i9').map((r) => r.ins.id)).toEqual(['a2']);
    expect(instalasiTerlihat(rows, 'teknis', '')).toHaveLength(6);
  });

  it('instalasiMenungguSaya per peran', () => {
    expect(instalasiMenungguSaya(rows, 'inspektor', 'i2', '').map((r) => r.ins.id)).toEqual(['a1']);
    expect(instalasiMenungguSaya(rows, 'pjt', '', 'Kusno Hadi Bitoyo').map((r) => r.ins.id)).toEqual(['a3']);
    expect(instalasiMenungguSaya(rows, 'teknis', '', '').map((r) => r.ins.id)).toEqual(['b1']); // evaluasi DJK bukan giliran Admin
    expect(instalasiMenungguSaya(rows, 'direktur', '', '')).toEqual([]);
  });

  it('instalasiTanpaLaporan', () => {
    expect(instalasiTanpaLaporan(rows).map((r) => r.ins.id)).toEqual(['a1']);
  });
});

describe('hariSejak', () => {
  it('menghitung hari penuh dan menolak tanggal kosong/tidak valid', () => {
    expect(hariSejak(daysAgo(3), NOW)).toBe(3);
    expect(hariSejak('', NOW)).toBeNull();
    expect(hariSejak('bukan-tanggal', NOW)).toBeNull();
  });
});
