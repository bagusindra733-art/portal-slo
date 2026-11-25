import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addDays,
  calcJoSoTotals,
  certStatus,
  checksEvaluation,
  computeAlerts,
  currentFlowIndex,
  defaultWoCatatan,
  dayDiff,
  extractCompanyAndCity,
  findSignature,
  formatFileSize,
  formatJsaNomor,
  formatRupiah,
  formatSuratJalanNomor,
  formatSuratTugasNomor,
  formatTanggal,
  getMissingSignedScans,
  hasAllRequiredSignedScans,
  inspectorLocked,
  isLeaderReadyForDocs,
  isLocalCity,
  isSamePersonName,
  isTeamMember,
  itemKategori,
  mapJoSoStatusToProjectStatus,
  mapProjectStatusToJoSoStatus,
  parseJenisInstalasiToProject,
  routeDoc,
  seedDatabase,
  splitJasaMobilisasi,
  suratJalanPetugas,
  suratTugasLeader,
  suratTugasPetugas,
  syncJoSoToProject,
  syncJsaWithSuratTugas,
} from '../portalUtils';
import { DOC_CONFIG } from '../../types/portal';
import type {
  Inspector,
  JoSoDetailItem,
  JoSoRecord,
  JsaData,
  Project,
  SuratTugasData,
  Tool,
} from '../../types/portal';

// Helper: objek parsial dianggap utuh; tes hanya mengisi field yang relevan.
const asType = <T>(v: unknown): T => v as T;

const item = (over: Partial<JoSoDetailItem> = {}): JoSoDetailItem => ({
  id: 'i1',
  itemName: 'Uji SLO',
  satuan: 'Paket',
  price: 1000,
  qty: 1,
  ...over,
});

const insp = (over: Partial<Inspector> = {}): Inspector => ({
  id: 'ins1',
  nama: 'Budi',
  noReg: 'REG-1',
  serkom: '2030-01-01',
  k3: '',
  ...over,
});

const st = (over: Partial<SuratTugasData> = {}): SuratTugasData =>
  asType<SuratTugasData>({
    id: 'st1',
    tenagaTeknik: [],
    nomorUrut: '',
    nomorBulan: 'XI',
    nomorTahun: '2026',
    ...over,
  });

const proj = (over: Partial<Project> = {}): Project =>
  asType<Project>({
    id: 'p1',
    no: 'RFQ-2611-001',
    perusahaan: 'PT Contoh',
    kota: 'Surabaya',
    jenis: 'TM',
    sub: 'Distribusi TM',
    kap: '10 MVA',
    status: 'rfq',
    team: null,
    docs: { issued: false, ack: false },
    att: [],
    form: { items: {}, photos: [], submitted: false },
    finds: [],
    bap: null,
    log: [],
    ...over,
  });

// Waktu dibekukan agar fungsi berbasis tanggal deterministik (waktu lokal).
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 24, 12, 0, 0)); // 24 Nov 2026, siang
});
afterEach(() => vi.useRealTimers());

describe('perhitungan harga JO/SO', () => {
  it('menjumlahkan item, membulatkan per item, lalu menghitung PPN', () => {
    const r = calcJoSoTotals({ ppnRate: 11, items: [item({ price: 1000000, qty: 2 }), item({ price: 500, qty: 1.5 })] });
    expect(r.jumlah).toBe(2000750); // 2.000.000 + round(750)
    expect(r.ppn).toBe(Math.round((2000750 * 11) / 100));
    expect(r.total).toBe(r.jumlah + r.ppn);
  });

  it('tahan terhadap nilai kosong / bukan angka', () => {
    const r = calcJoSoTotals({
      ppnRate: asType<number>(undefined),
      items: [item({ price: asType<number>('abc'), qty: 3 }), item({ price: asType<number>('2500'), qty: asType<number>('2') })],
    });
    expect(r).toEqual({ jumlah: 5000, ppn: 0, total: 5000 });
  });

  it('daftar item kosong menghasilkan nol', () => {
    expect(calcJoSoTotals({ items: [], ppnRate: 11 })).toEqual({ jumlah: 0, ppn: 0, total: 0 });
  });

  it('itemKategori: pilihan eksplisit menang, selain itu ditebak dari nama', () => {
    expect(itemKategori({ itemName: 'Transport Surabaya', kategori: 'jasa' })).toBe('jasa');
    expect(itemKategori({ itemName: 'Biaya TRANSPORT' })).toBe('mobilisasi');
    expect(itemKategori({ itemName: 'Akomodasi tim' })).toBe('mobilisasi');
    expect(itemKategori({ itemName: 'Mobilisasi alat' })).toBe('mobilisasi');
    expect(itemKategori({ itemName: 'Uji SLO 150 kV' })).toBe('jasa');
  });

  it('splitJasaMobilisasi memisahkan nilai per kategori', () => {
    const r = splitJasaMobilisasi([
      item({ price: 1000, qty: 2 }),
      item({ itemName: 'Transport', price: 300, qty: 1 }),
      item({ itemName: 'x', kategori: 'mobilisasi', price: 200, qty: 1 }),
    ]);
    expect(r).toEqual({ jasa: 2000, mob: 500 });
  });

  it('formatRupiah memakai format id-ID tanpa desimal dan menangani NaN', () => {
    expect(formatRupiah(1500000).replace(/\s/g, ' ')).toMatch(/^Rp\s?1\.500\.000$/);
    expect(formatRupiah(NaN).replace(/\s/g, ' ')).toMatch(/^Rp\s?0$/);
  });

  it('defaultWoCatatan: skenario DP 0, sebagian, penuh, dan di luar rentang', () => {
    expect(defaultWoCatatan(0)[0]).toBe('100% Setelah SLO Terbit');
    expect(defaultWoCatatan(30).slice(0, 2)).toEqual([
      '30% DP Sebelum Penjadwalan Sertifikat Laik Operasi (SLO)',
      '70% Setelah SLO Terbit',
    ]);
    expect(defaultWoCatatan(100)[0]).toMatch(/^100% Pembayaran Sebelum/);
    expect(defaultWoCatatan(250)[0]).toMatch(/^100% Pembayaran Sebelum/); // di-clamp
    expect(defaultWoCatatan(-5)[0]).toBe('100% Setelah SLO Terbit');
    expect(defaultWoCatatan(30).at(-1)).toBe('Biaya Sudah Termasuk Pajak');
  });
});

describe('tanggal & format', () => {
  it('formatTanggal', () => {
    expect(formatTanggal('2026-11-24')).toBe('24 November 2026');
    expect(formatTanggal('')).toBe('…');
    expect(formatTanggal('bukan-tanggal-valid-x')).toBe('bukan-tanggal-valid-x');
  });

  it('dayDiff & addDays konsisten terhadap hari ini', () => {
    expect(dayDiff(addDays(0))).toBe(0);
    expect(dayDiff(addDays(7))).toBe(7);
    expect(dayDiff(addDays(-3))).toBe(-3);
    expect(addDays(1)).toBe('2026-11-25');
    expect(addDays(7)).toBe('2026-12-01'); // lintas bulan
  });

  it('formatFileSize', () => {
    expect(formatFileSize(10)).toBe('1 KB');
    expect(formatFileSize(2048)).toBe('2 KB');
    expect(formatFileSize(5 * 1048576)).toBe('5.0 MB');
  });
});

describe('status sertifikat & penguncian inspektor', () => {
  it('certStatus untuk inspektor (batas H-7 / H-30 / H-60)', () => {
    expect(certStatus(addDays(-1))).toMatchObject({ k: 'crit', t: 'Kedaluwarsa', lock: true });
    expect(certStatus(addDays(0))).toMatchObject({ k: 'crit', t: 'H-7' });
    expect(certStatus(addDays(7))).toMatchObject({ k: 'crit', t: 'H-7' });
    expect(certStatus(addDays(8))).toMatchObject({ k: 'warn', t: 'H-30' });
    expect(certStatus(addDays(30))).toMatchObject({ k: 'warn', t: 'H-30' });
    expect(certStatus(addDays(31))).toMatchObject({ k: 'info', t: 'H-60' });
    expect(certStatus(addDays(60))).toMatchObject({ k: 'info', t: 'H-60' });
    expect(certStatus(addDays(61))).toMatchObject({ k: 'ok', t: 'Berlaku' });
  });

  it('certStatus untuk alat tidak punya tingkat H-7 dan H-60', () => {
    expect(certStatus(addDays(3), true).k).toBe('warn');
    expect(certStatus(addDays(45), true).k).toBe('ok');
    expect(certStatus(addDays(-1), true).lock).toBe(true);
  });

  it('inspectorLocked: SKTTK kedaluwarsa mengunci', () => {
    expect(inspectorLocked(insp({ serkom: addDays(-1) }))).toBe(true);
  });

  it('inspectorLocked: K3 kosong tidak mengunci, K3 kedaluwarsa mengunci', () => {
    expect(inspectorLocked(insp({ serkom: addDays(400), k3: '' }))).toBe(false);
    expect(inspectorLocked(insp({ serkom: addDays(400), k3: addDays(-2) }))).toBe(true);
    expect(inspectorLocked(insp({ serkom: addDays(400), k3: addDays(400) }))).toBe(false);
  });

  it('computeAlerts: hanya yang tidak "ok", terurut dari yang paling mendesak', () => {
    const inspectors = [
      insp({ id: 'a', nama: 'A', serkom: addDays(20), k3: addDays(-5) }),
      insp({ id: 'b', nama: 'B', serkom: addDays(500), k3: '' }),
    ];
    const tools: Tool[] = [
      { id: 't1', nama: 'Megger', sn: 'SN1', cal: addDays(10) },
      { id: 't2', nama: 'Clamp', sn: 'SN2', cal: addDays(300) },
    ];
    const alerts = computeAlerts(inspectors, tools);
    expect(alerts.map((a) => a.id)).toEqual(['a-Sertifikat K3', 't1-cal', 'a-Sertifikat Kompetensi (SKTTK)']);
    expect(alerts[0].cert.k).toBe('crit');
    expect(alerts[1].owner).toBe('Megger (SN1)');
    expect(alerts.some((a) => a.id.startsWith('b-'))).toBe(false);
  });
});

describe('Surat Tugas / Surat Jalan / JSA', () => {
  it('suratTugasPetugas membuang baris kosong dan duplikat (tidak peka huruf besar)', () => {
    expect(suratTugasPetugas(st({ tenagaTeknik: ['  Andi ', '', 'andi', 'Budi', '   '] }))).toEqual(['Andi', 'Budi']);
  });

  it('suratTugasLeader = nama pertama, kosong bila tidak ada', () => {
    expect(suratTugasLeader(st({ tenagaTeknik: ['Andi', 'Budi'] }))).toBe('Andi');
    expect(suratTugasLeader(st({ tenagaTeknik: [] }))).toBe('');
  });

  it('suratJalanPetugas: Leader biasa dipakai; Tool Keeper diganti anggota pertama lainnya', () => {
    expect(suratJalanPetugas(st({ tenagaTeknik: ['Andi', DOC_CONFIG.toolKeeper] }))).toBe('Andi');
    expect(suratJalanPetugas(st({ tenagaTeknik: [DOC_CONFIG.toolKeeper, 'Budi'] }))).toBe('Budi');
    expect(suratJalanPetugas(st({ tenagaTeknik: [DOC_CONFIG.toolKeeper] }))).toBe('');
    expect(suratJalanPetugas(st({ tenagaTeknik: [] }))).toBe('');
  });

  it('syncJsaWithSuratTugas: mengembalikan objek yang sama bila sudah sinkron', () => {
    const jsa = asType<JsaData>({ ketua: 'Andi', pelaksana: ['Budi'], updatedAt: 'x' });
    expect(syncJsaWithSuratTugas(st({ tenagaTeknik: ['Andi', 'Budi'] }), jsa)).toBe(jsa);
  });

  it('syncJsaWithSuratTugas: ketua yang tidak ada di ST diganti nama pertama', () => {
    const jsa = asType<JsaData>({ ketua: 'Orang Lain', pelaksana: [], updatedAt: 'x' });
    const out = syncJsaWithSuratTugas(st({ tenagaTeknik: ['Andi', 'Budi', 'Citra'] }), jsa);
    expect(out).not.toBe(jsa);
    expect(out.ketua).toBe('Andi');
    expect(out.pelaksana).toEqual(['Budi', 'Citra']);
  });

  it('syncJsaWithSuratTugas: ketua yang masih valid dipertahankan', () => {
    const jsa = asType<JsaData>({ ketua: 'budi', pelaksana: [], updatedAt: 'x' });
    const out = syncJsaWithSuratTugas(st({ tenagaTeknik: ['Andi', 'Budi'] }), jsa);
    expect(out.ketua).toBe('Budi');
    expect(out.pelaksana).toEqual(['Andi']);
  });

  it('penomoran dokumen dengan nomor urut bawaan 001', () => {
    const s = st({ nomorUrut: '', nomorBulan: 'XI', nomorTahun: '2026' });
    expect(formatSuratTugasNomor(s)).toBe('001/SDP/ST/XI/2026');
    expect(formatSuratJalanNomor(s)).toBe('001/SDP-TK/XI/2026');
    expect(formatJsaNomor({ ...s, nomorUrut: '012' })).toBe('012/SDP/JSA/XI/2026');
  });
});

describe('nama & tanda tangan', () => {
  it('isSamePersonName: cocok longgar, tolak kosong', () => {
    expect(isSamePersonName('Abdul Rozaq', 'abdul rozaq')).toBe(true);
    expect(isSamePersonName('Ir. Abdul Rozaq, ST', 'Abdul Rozaq')).toBe(true);
    expect(isSamePersonName('Andi', 'Budi')).toBe(false);
    expect(isSamePersonName('', '')).toBe(false);
    expect(isSamePersonName(null, 'Andi')).toBe(false);
  });

  it('findSignature: persis dulu, lalu longgar, lalu undefined', () => {
    const sigs = { 'Andi Wijaya': 'data:A', Andi: 'data:B' };
    expect(findSignature(sigs, 'andi')).toBe('data:B'); // persis menang atas longgar
    expect(findSignature(sigs, 'Wijaya')).toBe('data:A');
    expect(findSignature(sigs, 'Zzz')).toBeUndefined();
    expect(findSignature(undefined, 'Andi')).toBeUndefined();
    expect(findSignature(sigs, '')).toBeUndefined();
  });
});

describe('routing dokumen & parsing instalasi', () => {
  it('isLocalCity / routeDoc: Surabaya-Sidoarjo-Gresik = SPT, selain itu SPD', () => {
    expect(isLocalCity('Kab. Sidoarjo')).toBe(true);
    expect(routeDoc('GRESIK')).toBe('SPT');
    expect(routeDoc('Jakarta')).toBe('SPD');
    expect(routeDoc('')).toBe('SPD');
  });

  it('extractCompanyAndCity', () => {
    expect(extractCompanyAndCity('')).toEqual({ perusahaan: 'Klien Baru', kota: 'Surabaya' });
    expect(extractCompanyAndCity('PT A')).toEqual({ perusahaan: 'PT A', kota: 'Surabaya' });
    expect(extractCompanyAndCity('PT A | Jl. X | Malang')).toEqual({ perusahaan: 'PT A', kota: 'Jl. X, Malang' });
  });

  it('parseJenisInstalasiToProject', () => {
    expect(parseJenisInstalasiToProject('SUTT 150 kV')).toEqual({ jenis: 'TT', sub: 'Transmisi TT/GI' });
    expect(parseJenisInstalasiToProject('Gardu Induk')).toMatchObject({ jenis: 'TT' });
    expect(parseJenisInstalasiToProject('Distribusi JTM')).toEqual({ jenis: 'TM', sub: 'Distribusi TM' });
    expect(parseJenisInstalasiToProject('PLTU | Pembangkit')).toEqual({ jenis: 'Pembangkit', sub: 'PLTU' });
    expect(parseJenisInstalasiToProject('')).toEqual({ jenis: 'Pembangkit', sub: 'PLTU' });
  });
});

describe('pemetaan status JO/SO ↔ Proyek', () => {
  it('JO/SO → Proyek untuk proyek baru', () => {
    expect(mapJoSoStatusToProjectStatus('draft')).toBe('rfq');
    expect(mapJoSoStatusToProjectStatus('submit')).toBe('offered');
    expect(mapJoSoStatusToProjectStatus('approved')).toBe('approved');
    expect(mapJoSoStatusToProjectStatus('in_progress')).toBe('paid');
    expect(mapJoSoStatusToProjectStatus('completed')).toBe('slo');
    expect(mapJoSoStatusToProjectStatus('cancelled')).toBe('rfq');
  });

  it('tidak memundurkan proyek yang sudah di lapangan, kecuali completed', () => {
    expect(mapJoSoStatusToProjectStatus('draft', 'testing')).toBe('testing');
    expect(mapJoSoStatusToProjectStatus('in_progress', 'approvedPJT')).toBe('approvedPJT');
    expect(mapJoSoStatusToProjectStatus('cancelled', 'scheduled')).toBe('scheduled');
    expect(mapJoSoStatusToProjectStatus('completed', 'testing')).toBe('slo');
  });

  it('cancelled mempertahankan status awal proyek', () => {
    expect(mapJoSoStatusToProjectStatus('cancelled', 'offered')).toBe('offered');
  });

  it('Proyek → JO/SO', () => {
    expect(mapProjectStatusToJoSoStatus('rfq')).toBe('draft');
    expect(mapProjectStatusToJoSoStatus('offered')).toBe('submit');
    expect(mapProjectStatusToJoSoStatus('payproof')).toBe('approved');
    expect(mapProjectStatusToJoSoStatus('testing')).toBe('in_progress');
    expect(mapProjectStatusToJoSoStatus('slo')).toBe('completed');
  });
});

describe('syncJoSoToProject', () => {
  const rec = (over: Partial<JoSoRecord> = {}): JoSoRecord =>
    asType<JoSoRecord>({
      id: 'jo1',
      status: 'draft',
      ppnRate: 11,
      items: [item({ price: 1000, qty: 1 }), item({ itemName: 'Transport', price: 200, qty: 1 })],
      documents: [],
      noPenawaran: 'PNW-1',
      tanggalPenawaran: '2026-11-01',
      namaPerusahaan: 'PT Baru',
      kota: 'Malang',
      jenisInstalasiPenawaran: 'Distribusi JTM',
      jenisInstalasiJo: '',
      poNo: '',
      title: 'Judul',
      pelangganAlamat: '',
      kepadaAlamat: '',
      ...over,
    });

  it('membuat proyek baru dengan nomor RFQ, penawaran, dan log awal', () => {
    const p = syncJoSoToProject(rec(), undefined, 7);
    expect(p.no).toBe('RFQ-2611-007');
    expect(p.perusahaan).toBe('PT Baru');
    expect(p.kota).toBe('Malang');
    expect(p.jenis).toBe('TM');
    expect(p.status).toBe('rfq');
    expect(p.penawaran).toMatchObject({ no: 'PNW-1', jasa: 1000, mob: 200, ppn: 11 });
    expect(p.joSoId).toBe('jo1');
    expect(p.workflowStage).toBe('draft');
    expect(p.log).toHaveLength(1);
  });

  it('data lama: perusahaan & kota diurai dari teks "Nama | Kota"', () => {
    const p = syncJoSoToProject(rec({ namaPerusahaan: '', kota: '', pelangganAlamat: 'PT Lama | Gresik' }), undefined, 1);
    expect(p.perusahaan).toBe('PT Lama');
    expect(p.kota).toBe('Gresik');
  });

  it('pesan Sales ke Admin langsung menaikkan status ke "paid" dan tahap "sent_to_admin"', () => {
    const p = syncJoSoToProject(
      rec({ salesReadiness: 'ready_no_dp', sentToAdminAt: '2026-11-02T00:00:00Z' }),
      undefined,
      1
    );
    expect(p.status).toBe('paid');
    expect(p.workflowStage).toBe('sent_to_admin');
    expect(p.log[0][1]).toContain('Siap Dikerjakan (Tanpa DP)');
  });

  it('pesan Sales tidak menimpa proyek yang sudah lanjut (mis. testing)', () => {
    const existing = proj({ status: 'testing', workflowStage: 'forwarded_to_pjt', log: [['t0', 'awal']] });
    const p = syncJoSoToProject(
      rec({ salesReadiness: 'ready_no_dp', sentToAdminAt: '2026-11-02T00:00:00Z' }),
      existing,
      9
    );
    expect(p.status).toBe('testing');
    expect(p.workflowStage).toBe('forwarded_to_pjt');
    expect(p.log).toHaveLength(2); // log lama dipertahankan + entri baru
    expect(p.log[0]).toEqual(['t0', 'awal']);
  });

  it('sinkron ke proyek yang ada: mempertahankan id/no, memperbarui data', () => {
    const existing = proj({ id: 'keep', no: 'RFQ-KEEP', perusahaan: 'Lama', kap: '1 MW' });
    const p = syncJoSoToProject(rec({ kapasitas: '150 kV' }), existing, 99);
    expect(p.id).toBe('keep');
    expect(p.no).toBe('RFQ-KEEP');
    expect(p.perusahaan).toBe('PT Baru');
    expect(p.kap).toBe('150 kV');
  });

  it('kapasitas ditebak dari nama item bila belum diisi', () => {
    const p = syncJoSoToProject(
      rec({ kapasitas: '', items: [item({ itemName: 'Uji SLO 2,5 MW', price: 1, qty: 1 })] }),
      undefined,
      1
    );
    expect(p.kap).toBe('2,5 MW');
  });
});

describe('dokumen bertanda tangan & tim', () => {
  it('getMissingSignedScans / hasAllRequiredSignedScans', () => {
    expect(getMissingSignedScans(proj())).toEqual(['surat-tugas', 'surat-jalan', 'jsa']);
    const partial = proj({ signedScans: asType({ 'surat-tugas': { name: 'a' } }) });
    expect(getMissingSignedScans(partial)).toEqual(['surat-jalan', 'jsa']);
    const full = proj({ signedScans: asType({ 'surat-tugas': {}, 'surat-jalan': {}, jsa: {} }) });
    expect(hasAllRequiredSignedScans(full)).toBe(true);
    expect(hasAllRequiredSignedScans(partial)).toBe(false);
  });

  it('isLeaderReadyForDocs hanya untuk status "siap_uji"', () => {
    expect(isLeaderReadyForDocs(proj())).toBe(false);
    expect(isLeaderReadyForDocs(proj({ leaderStatus: asType({ status: 'kekurangan_dokumen' }) }))).toBe(false);
    expect(isLeaderReadyForDocs(proj({ leaderStatus: asType({ status: 'siap_uji' }) }))).toBe(true);
  });

  it('isTeamMember: leader dan anggota, bukan orang lain / tanpa tim', () => {
    const p = proj({ team: asType({ lead: 'L', ins: ['A', 'B'] }) });
    expect(isTeamMember(p, 'L')).toBe(true);
    expect(isTeamMember(p, 'B')).toBe(true);
    expect(isTeamMember(p, 'Z')).toBe(false);
    expect(isTeamMember(proj(), 'L')).toBe(false);
  });
});

describe('currentFlowIndex (alur kerja SLO)', () => {
  it('maju sesuai tahap', () => {
    expect(currentFlowIndex(proj())).toBe(0);
    expect(currentFlowIndex(proj({ workflowStage: 'sent_to_admin' }))).toBe(1);
    expect(currentFlowIndex(proj({ salesReadiness: 'ready_no_dp' }))).toBe(1);
    expect(currentFlowIndex(proj({ workflowStage: 'forwarded_to_pjt' }))).toBe(2);
    expect(currentFlowIndex(proj({ team: asType({ lead: 'L', ins: [] }) }))).toBe(3);
    expect(currentFlowIndex(proj({ leaderStatus: asType({ status: 'siap_uji' }) }))).toBe(4);
    expect(currentFlowIndex(proj({ prepReview: asType({ status: 'submitted' }) }))).toBe(5);
    expect(
      currentFlowIndex(
        proj({ prepReview: asType({ status: 'approved' }), directorReview: asType({ status: 'pending' }) })
      )
    ).toBe(6);
    expect(currentFlowIndex(proj({ directorReview: asType({ status: 'signed' }) }))).toBe(7);
    expect(currentFlowIndex(proj({ status: 'testing' }))).toBe(7);
    expect(currentFlowIndex(proj({ status: 'submitted' }))).toBe(8);
    expect(currentFlowIndex(proj({ status: 'approvedPJT' }))).toBe(9);
    expect(currentFlowIndex(proj({ status: 'slo' }))).toBe(9);
  });

  it('sloNotice = selesai (10), mengalahkan status lain', () => {
    expect(currentFlowIndex(proj({ status: 'rfq', sloNotice: asType({}) }))).toBe(10);
  });
});

describe('checksEvaluation', () => {
  const tools: Tool[] = [{ id: 't1', nama: 'Megger', sn: 'S1', cal: '2027-01-01' }];
  const base = (over: Partial<Project> = {}) =>
    proj({
      team: asType({ lead: 'ins1', ins: ['ins1'] }),
      att: asType([
        { ins: 'ins1', type: 'in', at: '2026-11-20T08:00:00Z', mode: 'live' },
        { ins: 'ins1', type: 'out', at: '2026-11-20T16:00:00Z', mode: 'live' },
      ]),
      form: asType({ items: { a: { alat: 't1' } }, photos: [], submitted: true }),
      reports: asType([{ name: 'lap.pdf' }]),
      docs: { issued: true, ack: true },
      bap: asType({ name: 'bap.pdf' }),
      ...over,
    });

  it('semua syarat terpenuhi', () => {
    const r = checksEvaluation(base(), [insp({ serkom: '2027-01-01' })], tools);
    expect(r).toHaveLength(7);
    expect(r.every((c) => c.ok)).toBe(true);
  });

  it('mendeteksi SKTTK kedaluwarsa pada tanggal uji', () => {
    const r = checksEvaluation(base(), [insp({ serkom: '2026-11-19' })], tools);
    expect(r[2].ok).toBe(false);
    expect(r[2].note).toBe('Budi');
  });

  it('K3 yang dimiliki dan kedaluwarsa pada tanggal uji = gagal; tidak punya K3 = lulus', () => {
    expect(checksEvaluation(base(), [insp({ serkom: '2027-01-01', k3: '2026-11-01' })], tools)[2].ok).toBe(false);
    expect(checksEvaluation(base(), [insp({ serkom: '2027-01-01', k3: '' })], tools)[2].ok).toBe(true);
  });

  it('kalibrasi alat kedaluwarsa atau alat tidak ditemukan = gagal', () => {
    const old: Tool[] = [{ id: 't1', nama: 'Megger', sn: 'S1', cal: '2026-01-01' }];
    const r1 = checksEvaluation(base(), [insp()], old);
    expect(r1[3].ok).toBe(false);
    expect(r1[3].note).toBe('Megger');
    expect(checksEvaluation(base(), [insp()], [])[3].ok).toBe(false);
  });

  it('tanpa alat terpakai / tanpa tim = gagal', () => {
    expect(checksEvaluation(base({ form: asType({ items: {}, photos: [], submitted: false }) }), [insp()], tools)[3].ok).toBe(false);
    expect(checksEvaluation(base({ team: null }), [insp()], tools)[2].ok).toBe(false);
  });

  it('temuan terbuka, laporan, paket dokumen, dan BAP', () => {
    const r = checksEvaluation(
      base({
        finds: asType([{ st: 'open' }, { st: 'closed' }, { st: 'open' }]),
        reports: [],
        docs: { issued: true, ack: false },
        bap: null,
      }),
      [insp()],
      tools
    );
    expect(r[0].ok).toBe(false);
    expect(r[4].ok).toBe(false);
    expect(r[5]).toMatchObject({ ok: false, note: '2 temuan terbuka' });
    expect(r[6].ok).toBe(false);
  });
});

describe('seedDatabase', () => {
  it('menghasilkan data awal yang konsisten', () => {
    const db = seedDatabase();
    const ids = db.proj.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(db.proj.length).toBeGreaterThan(0);
    expect(db.seq).toBeGreaterThan(0);
    // Setiap anggota tim merujuk inspektor yang ada
    const inspIds = new Set(db.insp.map((i) => i.id));
    db.proj.forEach((p) => p.team?.ins.forEach((id) => expect(inspIds.has(id)).toBe(true)));
  });
});
