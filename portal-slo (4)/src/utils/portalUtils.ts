import {
  ALAT_PILIHAN,
  AppDatabaseState,
  BULAN,
  DOC_CONFIG,
  Finding,
  Inspector,
  JENIS_INSTALASI_SOJO,
  JENIS_ST,
  JSA_ALAT,
  JSA_APD,
  JSA_BAHAYA,
  JSA_JENIS,
  JoSoRecord,
  JoSoStatus,
  JsaData,
  MANUAL_KEY,
  MAX_FILE_BYTES,
  ORG,
  Project,
  ProjectStatus,
  SalesReadiness,
  SavedDocType,
  SuratTugasData,
  TESTS,
  Tool,
  TteInfo,
} from '../types/portal';

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function isoToday(): string {
  return toIsoDate(new Date());
}

export function addDays(days: number): string {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() + days);
  return toIsoDate(base);
}

export function dayDiff(isoDate: string): number {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  const target = new Date(`${isoDate}T00:00:00`);
  return Math.round((target.getTime() - base.getTime()) / 86400000);
}

export function formatTanggal(iso: string): string {
  if (!iso) return '…';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  const [th, bln, hr] = parts;
  const idx = Number(bln) - 1;
  return `${hr} ${BULAN[idx] || bln} ${th}`;
}

export function formatDateShort(s?: string | null): string {
  if (!s) return '-';
  const d = new Date(s.length > 10 ? s : `${s}T00:00:00`);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(s: string): string {
  return new Date(s).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRupiah(n: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n || 0);
}

export function formatDecimalId(n: number): string {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

export function calcJoSoTotals(rec: Pick<JoSoRecord, 'items' | 'ppnRate'>): {
  jumlah: number;
  ppn: number;
  total: number;
} {
  const jumlah = rec.items.reduce(
    (sum, item) => sum + Math.round((Number(item.price) || 0) * (Number(item.qty) || 0)),
    0
  );
  const ppn = Math.round((jumlah * (Number(rec.ppnRate) || 0)) / 100);
  return { jumlah, ppn, total: jumlah + ppn };
}

export function formatFileSize(n: number): string {
  return n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

const LOCAL_CITIES = ['surabaya', 'sidoarjo', 'gresik'];

export function isLocalCity(kota: string): boolean {
  const s = String(kota || '').toLowerCase();
  return LOCAL_CITIES.some((c) => s.includes(c));
}

export function routeDoc(kota: string): 'SPT' | 'SPD' {
  return isLocalCity(kota) ? 'SPT' : 'SPD';
}

export const SALES_READINESS_LABEL: Record<SalesReadiness, string> = {
  ready_wait_dp: 'Siap Dikerjakan (Menunggu DP)',
  ready_no_dp: 'Siap Dikerjakan (Tanpa DP)',
};

export function createTteStamp(signerName: string, signerRole: string): TteInfo {
  const now = new Date();
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return {
    enabled: true,
    signerName,
    signerRole,
    signedAt: now.toISOString(),
    code: `TTE-SDP-${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}-${rnd}`,
  };
}

export interface CertBadge {
  k: 'ok' | 'info' | 'warn' | 'crit';
  t: string;
  n: number;
  lock?: boolean;
}

export function certStatus(d: string, isTool = false): CertBadge {
  const n = dayDiff(d);
  if (n < 0) return { k: 'crit', t: 'Kedaluwarsa', n, lock: true };
  if (!isTool && n <= 7) return { k: 'crit', t: 'H-7', n };
  if (n <= 30) return { k: 'warn', t: 'H-30', n };
  if (!isTool && n <= 60) return { k: 'info', t: 'H-60', n };
  return { k: 'ok', t: 'Berlaku', n };
}

export interface AlertItem {
  id: string;
  owner: string;
  what: string;
  date: string;
  cert: CertBadge;
}

export function computeAlerts(insp: Inspector[], tools: Tool[]): AlertItem[] {
  const list: AlertItem[] = [];
  insp.forEach((i) => {
    (
      [
        ['Serkom TTK', i.serkom],
        ['Sertifikat K3', i.k3],
      ] as [string, string][]
    ).forEach(([what, date]) => {
      const c = certStatus(date, false);
      if (c.k !== 'ok') {
        list.push({ id: `${i.id}-${what}`, owner: i.nama, what, date, cert: c });
      }
    });
  });
  tools.forEach((t) => {
    const c = certStatus(t.cal, true);
    if (c.k !== 'ok') {
      list.push({ id: `${t.id}-cal`, owner: `${t.nama} (${t.sn})`, what: 'Kalibrasi', date: t.cal, cert: c });
    }
  });
  return list.sort((a, b) => a.cert.n - b.cert.n);
}

export function testDate(p: Project): string {
  const ins = p.att
    .filter((x) => x.type === 'in')
    .map((x) => x.at.slice(0, 10))
    .sort();
  return ins[0] || isoToday();
}

export function usedTools(p: Project): string[] {
  const set = new Set<string>();
  Object.values(p.form.items).forEach((item) => {
    if (item.alat) set.add(item.alat);
  });
  return Array.from(set);
}

export interface EvalCheckItem {
  t: string;
  ok: boolean;
  note?: string;
}

export function checksEvaluation(p: Project, insp: Inspector[], tools: Tool[]): EvalCheckItem[] {
  const findInsp = (id: string) => insp.find((x) => x.id === id);
  const findTool = (id: string) => tools.find((x) => x.id === id);
  const team = (p.team ? p.team.ins : []).map(findInsp).filter((x): x is Inspector => Boolean(x));
  const td = testDate(p);
  const r: EvalCheckItem[] = [];

  const reportCount = (p.reports || []).length;
  r.push({
    t: 'Laporan pengujian (dibuat manual) sudah diunggah Tenaga Teknik',
    ok: reportCount > 0,
    note: reportCount
      ? `${reportCount} berkas laporan`
      : 'Belum ada laporan yang diunggah ke sistem',
  });

  const miss = team.filter(
    (i) => !p.att.some((a) => a.ins === i.id && a.type === 'in') || !p.att.some((a) => a.ins === i.id && a.type === 'out')
  );
  const simCount = p.att.filter((a) => a.mode !== 'live').length;
  r.push({
    t: 'Absensi selfie masuk dan pulang anggota tim (informasi, tidak wajib)',
    ok: true,
    note:
      (miss.length ? `Belum lengkap: ${miss.map((i) => i.nama).join(', ')}` : '') +
      (simCount ? `${miss.length ? ' · ' : ''}${simCount} foto mode simulasi` : ''),
  });

  const badI = team.filter((i) => i.serkom < td || i.k3 < td);
  r.push({
    t: `Serkom TTK dan sertifikat K3 inspektor berlaku pada tanggal uji (${formatDateShort(td)})`,
    ok: team.length > 0 && badI.length === 0,
    note: badI.map((i) => i.nama).join(', '),
  });

  const ut = usedTools(p);
  const badT = ut.map(findTool).filter((t) => !t || t.cal < td);
  r.push({
    t: 'Kalibrasi alat yang dipakai berlaku pada tanggal uji',
    ok: ut.length > 0 && badT.length === 0,
    note: badT.map((t) => t?.nama || '').filter(Boolean).join(', '),
  });

  r.push({
    t: 'Paket dokumen (Surat Tugas, Surat Jalan Alat, JSA, SPT/SPD) terbit dan dikonfirmasi',
    ok: p.docs.issued && p.docs.ack,
  });

  const openFinds = p.finds.filter((f: Finding) => f.st === 'open').length;
  r.push({
    t: 'Seluruh temuan ketidaksesuaian sudah ditutup klien',
    ok: openFinds === 0,
    note: openFinds ? `${openFinds} temuan terbuka` : '',
  });

  r.push({
    t: 'BAP bertanda tangan digital terunggah',
    ok: Boolean(p.bap),
  });

  return r;
}

/** Daftar nama Tenaga Teknik pada Surat Tugas (tanpa baris kosong / duplikat). */
export function suratTugasPetugas(st: SuratTugasData): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of st.tenagaTeknik) {
    const n = raw.trim();
    const key = n.toLowerCase();
    if (!n || seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
}

/** Leader = Tenaga Teknik pada kolom 1 Surat Tugas, anggota = kolom 2, 3, dst. */
export function suratTugasLeader(st: SuratTugasData): string {
  return suratTugasPetugas(st)[0] || '';
}

/**
 * Petugas pada Surat Jalan Alat: hanya Leader. Bila Leader adalah Tool Keeper tetap
 * (Abdul Rozaq), diganti anggota pertama yang dipilih di Surat Tugas.
 */
export function suratJalanPetugas(st: SuratTugasData): string {
  const names = suratTugasPetugas(st);
  const leader = names[0] || '';
  if (leader && !isSamePersonName(leader, DOC_CONFIG.toolKeeper)) return leader;
  return names.slice(1).find((n) => !isSamePersonName(n, DOC_CONFIG.toolKeeper)) || '';
}

/**
 * Samakan nama di JSA dengan Surat Tugas: Ketua Tim harus salah satu Tenaga Teknik di ST
 * (bila tidak, diambil nama pertama), pelaksana = Tenaga Teknik lainnya. Objek lama
 * dikembalikan apa adanya bila sudah sinkron.
 */
export function syncJsaWithSuratTugas(st: SuratTugasData, jsa: JsaData): JsaData {
  const names = suratTugasPetugas(st);
  const currentKetua = jsa.ketua.trim();
  const ketua =
    names.find((n) => isSamePersonName(n, currentKetua)) || names[0] || '';
  const pelaksana = names.filter((n) => !isSamePersonName(n, ketua));
  const samePelaksana =
    pelaksana.length === jsa.pelaksana.length && pelaksana.every((n, i) => n === jsa.pelaksana[i]);
  if (ketua === jsa.ketua && samePelaksana) return jsa;
  return { ...jsa, ketua, pelaksana, updatedAt: new Date().toISOString() };
}

export function instalasiTeks(st: SuratTugasData): string {
  const cfg = JENIS_ST[st.jenisAktif];
  const tipeVal = (st.tipe === MANUAL_KEY ? st.tipeManual : st.tipe).trim();
  return cfg.fmt(tipeVal, st.unit.trim(), st.kap.trim(), st.satuan);
}

export function formatSuratTugasNomor(st: SuratTugasData): string {
  return `${st.nomorUrut || '001'}/SDP/ST/${st.nomorBulan}/${st.nomorTahun}`;
}

export function formatSuratJalanNomor(st: SuratTugasData): string {
  return `${st.nomorUrut || '001'}/SDP-TK/${st.nomorBulan}/${st.nomorTahun}`;
}

export function formatJsaNomor(st: SuratTugasData): string {
  return `${st.nomorUrut || '001'}/SDP/JSA/${st.nomorBulan}/${st.nomorTahun}`;
}

export function seedDatabase(): AppDatabaseState {
  const makeProject = (partial: Partial<Project> & Pick<Project, 'id' | 'no' | 'perusahaan' | 'kota' | 'jenis' | 'sub' | 'kap' | 'status'>): Project => ({
    files: ['NIB', 'NIDI', 'SLD'].map((k) => ({ k, name: `${k.toLowerCase()}-contoh.pdf`, size: 480000 })),
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
    ...partial,
  });

  const nowIso = new Date().toISOString();

  return {
    role: 'teknis',
    seq: 4,
    seq2: 1,
    insp: [
      { id: 'i1', nama: 'Bagus Indra Surya Binardo', noReg: 'TTK-0001-SDP', serkom: addDays(420), k3: addDays(300) },
      { id: 'i2', nama: 'Frizal Aditya Junitio R', noReg: 'TTK-0002-SDP', serkom: addDays(25), k3: addDays(210) },
      { id: 'i3', nama: 'Ahmad Fauzan Hamdhani', noReg: 'TTK-0003-SDP', serkom: addDays(5), k3: addDays(150) },
      { id: 'i4', nama: 'Yudi Surya Prakasa', noReg: 'TTK-0004-SDP', serkom: addDays(-10), k3: addDays(180) },
      { id: 'i5', nama: 'Abdul Rozaq', noReg: 'TTK-0005-SDP', serkom: addDays(52), k3: addDays(400) },
      { id: 'i6', nama: 'Kusno Hadi Bitoyo', noReg: 'PJT/TTK-0006-SDP', serkom: addDays(365), k3: addDays(365) },
    ],
    tools: [
      { id: 't1', nama: 'Insulation Tester 5 kV(Tahanan Isolasi)', sn: 'IT-5010-01', cal: addDays(200) },
      { id: 't2', nama: 'Earth Tester (Pembumian)', sn: 'ET-2026-02', cal: addDays(20) },
      { id: 't3', nama: 'Earth Clamp Tester (Pembumian)', sn: 'EC-2026-03', cal: addDays(300) },
      { id: 't4', nama: 'Relay Test Set', sn: 'RT-2026-04', cal: addDays(-5) },
      { id: 't5', nama: 'Multi Environment Meter (Kebisingan)', sn: 'MEM-2026-05', cal: addDays(150) },
      { id: 't6', nama: 'Power Quality Analyzer', sn: 'PQA-2026-06', cal: addDays(90) },
      { id: 't7', nama: 'Thermal Imager (Suhu)', sn: 'TI-2026-07', cal: addDays(400) },
      { id: 't8', nama: 'Hi-Pot Tester', sn: 'HP-2026-08', cal: addDays(120) },
      { id: 't9', nama: 'Vibration Meter (Getaran)', sn: 'VM-2026-09', cal: addDays(75) },
    ],
    proj: [
      makeProject({
        id: 'p1',
        no: 'RFQ-2611-001',
        perusahaan: 'PT. Indonesia Guang Ching Nickel And Stainless Steel',
        kota: 'Kab. Morowali',
        jenis: 'Pembangkit',
        sub: 'PLTU',
        kap: '2 x 150 MW',
        status: 'paid',
        penawaran: { no: '131.A/SDP/PNW/IX/2026', jasa: 1789093500, mob: 161500250, ppn: 11, at: nowIso },
        po: { k: 'PO/SPK', name: '058/SPK/SDP/X/2026', size: 642000 },
        joSoId: 'joso-1',
        salesReadiness: 'ready_wait_dp',
        salesMessage: 'PO telah terbit (058/SPK/SDP/X/2026), pekerjaan siap dikerjakan menunggu DP 50%.',
        workflowStage: 'sent_to_admin',
        log: [
          [nowIso, 'Sales menerbitkan penawaran & PO — status: Siap Dikerjakan (Menunggu DP)'],
        ],
      }),
      makeProject({
        id: 'p2',
        no: 'RFQ-2611-002',
        perusahaan: 'PT Contoh Smelter Nusantara',
        kota: 'Gresik',
        jenis: 'Pembangkit',
        sub: 'PLTD',
        kap: '25 MW',
        status: 'rfq',
        workflowStage: 'draft',
        log: [[nowIso, 'RFQ diajukan oleh klien']],
      }),
      makeProject({
        id: 'p3',
        no: 'RFQ-2611-003',
        perusahaan: 'PT Contoh Tambang Energi',
        kota: 'Kutai Timur',
        jenis: 'TT',
        sub: 'Transmisi TT/GI',
        kap: '150 kV',
        status: 'scheduled',
        penawaran: { no: 'PNW-2611-003', jasa: 45000000, mob: 12500000, ppn: 11, at: nowIso },
        team: { ins: ['i1', 'i2'], tools: ['t1', 't2', 't6'], lead: 'i1' },
        docs: { issued: true, ack: false },
        pjtName: 'Kusno Hadi Bitoyo',
        salesReadiness: 'ready_no_dp',
        workflowStage: 'published_work',
        publishedToWorkMenu: true,
        log: [[nowIso, 'Paket dokumen TTE terbit & diteruskan ke Admin untuk Menu Pekerjaan']],
      }),
      makeProject({
        id: 'p4',
        no: 'RFQ-2611-004',
        perusahaan: 'PT Industri Baja Makmur',
        kota: 'Sidoarjo',
        jenis: 'TM',
        sub: 'Distribusi TM',
        kap: '2500 kVA',
        status: 'slo',
        penawaran: { no: '142/SDP/PNW/X/2026', jasa: 15000000, mob: 1500000, ppn: 11, at: nowIso },
        team: { ins: ['i1'], tools: ['t1', 't2'], lead: 'i1' },
        docs: { issued: true, ack: true },
        pjtName: 'Kusno Hadi Bitoyo',
        pjt: { at: isoToday() },
        slo: { no: 'SLO/2026/0001', date: isoToday(), file: 'SLO-Industri-Baja.pdf', size: 842000 },
        po: { k: 'PO/SPK', name: '064/SPK/SDP/X/2026', size: 420000 },
        joSoId: 'joso-2',
        salesReadiness: 'ready_no_dp',
        workflowStage: 'published_work',
        publishedToWorkMenu: true,
        log: [[nowIso, 'SLO resmi diterbitkan']],
      }),
    ],
    suratTugas: {
      id: 'st-1',
      projectId: 'p1',
      jenisAktif: 'pembangkit',
      nomorUrut: '078',
      nomorBulan: '10',
      nomorTahun: '2026',
      penandatanganIdx: 0,
      pjt: DOC_CONFIG.pjt[0],
      tenagaTeknik: ['Bagus Indra Surya Binardo'],
      jenisPekerjaan: JENIS_ST.pembangkit.jenis,
      tipe: 'PLTU',
      tipeManual: '',
      unit: '2',
      kap: '150',
      satuan: 'MW',
      pemilik: 'PT. Indonesia Guang Ching Nickel And Stainless Steel',
      lokasi: 'Kawasan PT. IMIP – Jl. Trans Sulawesi, Kel. Fatufia, Kec. Bahodopi, Kab. Morowali, Prov. Sulawesi Tengah',
      mulai: '2026-10-06',
      selesai: '2026-10-10',
      kota: 'Surabaya',
      tgl: '2026-10-05',
      updatedAt: nowIso,
    },
    suratJalan: {
      id: 'sj-1',
      suratTugasId: 'st-1',
      items: [
        { id: 'sj-i1', nama: ALAT_PILIHAN[0], manualNama: '', jml: '1', unit: 'Unit', seri: '', ket: '-' },
        { id: 'sj-i2', nama: 'Insulation Tester 5 kV(Tahanan Isolasi)', manualNama: '', jml: '1', unit: 'Set', seri: 'IT-5010-01', ket: 'Didalam tas Koper' },
        { id: 'sj-i3', nama: 'Helm Safety + Ear Plug', manualNama: '', jml: '2', unit: 'Unit', seri: '', ket: 'Didalam tas Koper' },
        { id: 'sj-i4', nama: 'Multi Environment Meter (Kebisingan)', manualNama: '', jml: '1', unit: 'Unit', seri: 'MEM-2026-05', ket: 'Didalam tas Koper' },
        { id: 'sj-i5', nama: 'Earth Tester (Pembumian)', manualNama: '', jml: '1', unit: 'Unit', seri: 'ET-2026-02', ket: 'Didalam tas Koper' },
        { id: 'sj-i6', nama: 'Earth Clamp Tester (Pembumian)', manualNama: '', jml: '1', unit: 'Unit', seri: 'EC-2026-03', ket: 'Didalam tas Koper' },
      ],
      kendTampil: true,
      kendaraan: 'Xpander',
      keeper: 'Abdul Rozaq',
      ttdIdx: 1,
      updatedAt: nowIso,
    },
    jsa: {
      id: 'jsa-1',
      suratTugasId: 'st-1',
      ketua: 'Bagus Indra Surya Binardo',
      pelaksana: ['Frizal Aditya Junitio R'],
      jenisChecks: JSA_JENIS.map(([, c]) => c),
      kegiatan: 'Pemeriksaan & Inspeksi',
      alatChecks: JSA_ALAT.map(([, c]) => c),
      bahayaChecks: JSA_BAHAYA.map(([, c]) => c),
      apdChecks: JSA_APD.map(([, c]) => c),
      updatedAt: nowIso,
    },
    joSoRecords: [
      {
        id: 'joso-1',
        projectId: 'p1',
        tanggalPenawaran: '2026-09-14',
        noPenawaran: '131.A/SDP/PNW/IX/2026',
        perihal: 'Penawaran SLO',
        lampiran: '1 (Satu) Lembar',
        tanggalPermintaan: '2025-02-10',
        kepadaAlamat:
          'PT. Indonesia Morowali Industrial Park | Gedung IMIP, Jl. Batu Mulia 8, RT. 007 RW.007 Kel. Maruya Utara Kec. Kembangan Kota Adm Jakarta Barat',
        jenisInstalasiPenawaran: 'PLTU | Pembangkit Listrik Tenaga Uap (PLTU)',
        status: 'submit',
        masaBerlaku: 30,
        ppnRate: 11,
        items: [
          { id: 'it-1', itemName: 'SLO Gardu Induk Dexin 3', satuan: 'Unit', price: 251514000, qty: 1 },
          { id: 'it-2', itemName: 'SLO Gardu Induk Hub #2 Stasiun #2', satuan: 'Unit', price: 726988500, qty: 1 },
          { id: 'it-3', itemName: 'SLO Gardu Induk Hub #7 Stasiun #7', satuan: 'Unit', price: 369735000, qty: 1 },
          { id: 'it-4', itemName: 'SLO Gardu Induk Hub #8 Stasiun #8', satuan: 'Unit', price: 440856000, qty: 1 },
          { id: 'it-5', itemName: 'Transport dan Akomodasi 6 x Kedatangan', satuan: 'Unit', price: 161500250, qty: 1 },
        ],
        poNo: '058/SPK/SDP/X/2026',
        title: 'SLO GI PT.IMIP',
        poDate: '2026-10-10',
        poExpiredDate: '2027-01-10',
        dp: 50,
        pelangganAlamat:
          'PT. Indonesia Morowali Industrial Park | Gedung IMIP, Jl. Batu Mulia 8, RT. 007 RW.007 Kel. Maruya Utara Kec. Kembangan Kota Adm Jakarta Barat',
        jenisInstalasiJo: 'Pemanfaatan-2 | Instalasi Pemanfaatan Tenaga Listrik Tegangan Tinggi',
        paymentTerm: 'DP 50, PL 50',
        documents: [
          {
            id: 'doc-1',
            docName: 'SPK / Purchase Order Resmi',
            filePath: '058-SPK-SDP-X-2026-IMIP.pdf',
            fileSize: 642000,
            uploadedAt: nowIso,
          },
        ],
        salesReadiness: 'ready_wait_dp',
        salesMessage: 'PO telah terbit (058/SPK/SDP/X/2026), pekerjaan siap dikerjakan menunggu DP 50%.',
        sentToAdminAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'joso-2',
        projectId: 'p4',
        tanggalPenawaran: '2026-10-02',
        noPenawaran: '142/SDP/PNW/X/2026',
        perihal: 'Penawaran SLO',
        lampiran: '1 (Satu) Lembar',
        tanggalPermintaan: '2026-09-28',
        kepadaAlamat: 'PT Industri Baja Makmur | Kawasan Industri Berbek, Sidoarjo, Jawa Timur',
        jenisInstalasiPenawaran: 'Distribusi | Instalasi Distribusi Tenaga Listrik (JTM / JTR / SKTM)',
        status: 'approved',
        masaBerlaku: 30,
        ppnRate: 11,
        items: [
          { id: 'it-21', itemName: 'Uji Laik Operasi Distribusi TM 2500 kVA', satuan: 'Unit', price: 15000000, qty: 1 },
          { id: 'it-22', itemName: 'Mobilisasi Tim & Alat Area Sidoarjo', satuan: 'Lot', price: 1500000, qty: 1 },
        ],
        poNo: '064/SPK/SDP/X/2026',
        title: 'SLO Distribusi TM PT Industri Baja Makmur',
        poDate: '2026-10-05',
        poExpiredDate: '2026-12-05',
        dp: 100,
        pelangganAlamat: 'PT Industri Baja Makmur | Kawasan Industri Berbek, Sidoarjo, Jawa Timur',
        jenisInstalasiJo: 'Pemanfaatan-1 | Instalasi Pemanfaatan Tenaga Listrik Tegangan Menengah',
        paymentTerm: 'Cash 100%',
        documents: [],
        updatedAt: nowIso,
      },
    ],
    docArchives: [],
    companyDocs: [],
  };
}

export function prepFile(f: File): Promise<{ name: string; size: number; thumb?: string }> {
  if (/^image\//.test(f.type)) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scaleTo = (max: number, q: number) => {
          const r = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * r);
          c.height = Math.round(img.height * r);
          c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
          const dataUrl = c.toDataURL('image/jpeg', q);
          return { url: dataUrl, size: Math.round(dataUrl.length * 0.75) };
        };
        let out = scaleTo(1600, 0.82);
        if (out.size > MAX_FILE_BYTES) out = scaleTo(1200, 0.6);
        if (out.size > MAX_FILE_BYTES) {
          reject(new Error(`${f.name} masih lebih dari 5 MB setelah kompresi`));
          return;
        }
        const thumb = scaleTo(160, 0.6).url;
        resolve({ name: f.name, size: out.size, thumb });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Gambar tidak dapat dibaca'));
      };
      img.src = url;
    });
  }
  if (f.size > MAX_FILE_BYTES) {
    return Promise.reject(new Error(`${f.name} melebihi 5 MB (${formatFileSize(f.size)})`));
  }
  return Promise.resolve({ name: f.name, size: f.size });
}

export function downloadTextFile(filename: string, content: string, mime = 'text/html;charset=utf-8'): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function buildPenawaranHtml(p: Project): string {
  if (!p.penawaran) return '';
  const a = p.penawaran;
  const sub = a.jasa + a.mob;
  const ppnVal = Math.round((sub * a.ppn) / 100);
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Penawaran ${a.no}</title>
  <style>body{font-family:sans-serif;max-width:780px;margin:28px auto;color:#111}h2{text-align:center;text-transform:uppercase}.ph{border-bottom:3px double #111;padding-bottom:8px;text-align:center}table{width:100%;border-collapse:collapse;margin:12px 0}th,td{border:1px solid #999;padding:6px 10px;text-align:left}th{background:#eef0f3}</style>
  </head><body>
  <div class="ph"><b>${ORG}</b><br><small>IUJPTL · Akreditasi KAN/ESDM · Jl. GayungKebonsari VII/2 Surabaya 60231</small></div>
  <h2>Penawaran Resmi</h2><p style="text-align:center">Nomor: ${a.no}</p>
  <table><tr><th style="width:30%">Kepada</th><td>${p.perusahaan}</td></tr><tr><th>Lokasi</th><td>${p.kota} (${isLocalCity(p.kota) ? 'dalam area Surabaya/Sidoarjo/Gresik' : 'luar area'})</td></tr><tr><th>Objek</th><td>Instalasi ${p.jenis} — ${p.sub}, ${p.kap}</td></tr></table>
  <table><tr><th>Uraian</th><th style="text-align:right">Biaya</th></tr><tr><td>Jasa pengujian & penerbitan SLO</td><td style="text-align:right">${formatRupiah(a.jasa)}</td></tr><tr><td>Mobilisasi</td><td style="text-align:right">${formatRupiah(a.mob)}</td></tr><tr><td>Subtotal</td><td style="text-align:right">${formatRupiah(sub)}</td></tr><tr><td>PPN ${a.ppn}%</td><td style="text-align:right">${formatRupiah(ppnVal)}</td></tr><tr><th>Total</th><th style="text-align:right">${formatRupiah(sub + ppnVal)}</th></tr></table>
  <p>Pembayaran melalui transfer bank dan konfirmasi manual oleh bagian Keuangan.</p></body></html>`;
}

export function buildSpkSpdHtml(p: Project, insp: Inspector[]): string {
  const spt = routeDoc(p.kota) === 'SPT';
  const no = `${spt ? 'SPT' : 'SPD'}/${p.no.replace('RFQ-', '')}`;
  const names = (p.team?.ins || [])
    .map((id) => insp.find((x) => x.id === id)?.nama || '')
    .filter(Boolean)
    .join(', ');
  const leadName = insp.find((x) => x.id === p.team?.lead)?.nama || 'Ketua Tim';
  const tte = p.docTte?.sptSpd;
  const tteBox = (label: string) =>
    tte?.enabled
      ? `<div style="border:1px solid #047857;background:#ecfdf5;color:#065f46;border-radius:6px;padding:6px 8px;margin:8px auto;font-size:10px;max-width:210px;font-family:sans-serif;text-align:left">
          <b>TTE TERVERIFIKASI</b><br>
          Oleh: ${label}<br>
          Kode: <code>${tte.code}</code><br>
          Tgl: ${formatDateShort(tte.signedAt)}
        </div>`
      : '<br><br><br>';

  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${no}</title>
  <style>body{font-family:"Times New Roman",serif;max-width:780px;margin:28px auto;color:#111}h2{text-align:center;text-transform:uppercase}.ph{border-bottom:3px double #111;padding-bottom:8px;text-align:center}table{width:100%;border-collapse:collapse;margin:12px 0}th,td{border:1px solid #999;padding:6px 10px;text-align:left}th{background:#eef0f3}.sign{display:flex;justify-content:space-between;margin-top:36px}</style>
  </head><body>
  <div class="ph"><b>${ORG}</b><br><small>IUJPTL · Akreditasi KAN/ESDM · Jl. GayungKebonsari VII/2 Surabaya 60231</small></div>
  <h2>${spt ? 'Surat Perintah Tugas (SPT)' : 'Surat Perintah Dinas (SPD)'}</h2>
  <p style="text-align:center">Nomor: ${no}</p>
  <p>${spt ? 'Lokasi proyek berada di wilayah Surabaya/Sidoarjo/Gresik, sehingga diterbitkan Surat Perintah Tugas (SPT).' : 'Lokasi proyek berada di luar wilayah Surabaya/Sidoarjo/Gresik (seluruh Indonesia), sehingga diterbitkan Surat Perintah Dinas (SPD).'}</p>
  <table><tr><th style="width:30%">Ketua Tim (Leader)</th><td>${leadName}</td></tr><tr><th>Personel</th><td>${names || '-'}</td></tr><tr><th>Tujuan</th><td>${p.perusahaan} — ${p.kota}</td></tr><tr><th>Pekerjaan</th><td>Pengujian instalasi ${p.jenis} (${p.sub})</td></tr><tr><th>Tanggal terbit</th><td>${formatDateShort(isoToday())}</td></tr></table>
  <div class="sign">
    <div style="text-align:center;min-width:210px">Pemberi perintah${tteBox(`Manajemen ${ORG}`)}<b>Manajemen ${ORG}</b></div>
    <div style="text-align:center;min-width:210px">Penerima perintah${tteBox(leadName)}<b>${leadName}</b></div>
  </div>
  </body></html>`;
}

export function buildSloValidationHtml(p: Project): string {
  if (!p.slo) return '';
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Validasi ${p.slo.no}</title>
  <style>body{font-family:sans-serif;max-width:760px;margin:28px auto;color:#111}h2{text-align:center;text-transform:uppercase}.ph{border-bottom:3px double #111;padding-bottom:8px;text-align:center}table{width:100%;border-collapse:collapse;margin:14px 0}th,td{border:1px solid #999;padding:6px 10px;text-align:left}th{background:#eef0f3;width:30%}</style>
  </head><body>
  <div class="ph"><b>${ORG}</b><br><small>IUJPTL · Akreditasi KAN/ESDM · Surabaya</small></div>
  <h2>Lembar Validasi SLO</h2>
  <p style="text-align:center">Nomor: ${p.slo.no}</p>
  <table><tr><th>Klien</th><td>${p.perusahaan}</td></tr><tr><th>Lokasi</th><td>${p.kota}</td></tr><tr><th>Objek</th><td>${p.jenis} — ${p.sub}, ${p.kap}</td></tr><tr><th>Tanggal Terbit</th><td>${formatDateShort(p.slo.date)}</td></tr><tr><th>Berkas Resmi</th><td>${p.slo.file} (${formatFileSize(p.slo.size)})</td></tr></table>
  </body></html>`;
}

export const STATUS_COLORS: Record<ProjectStatus, { bg: string; text: string; dot: string }> = {
  rfq: { bg: 'bg-sky-50', text: 'text-sky-700', dot: '#0284C7' },
  offered: { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: '#4F46E5' },
  approved: { bg: 'bg-amber-50', text: 'text-amber-700', dot: '#D97706' },
  payproof: { bg: 'bg-orange-50', text: 'text-orange-700', dot: '#EA580C' },
  paid: { bg: 'bg-blue-50', text: 'text-blue-700', dot: '#2563EB' },
  scheduled: { bg: 'bg-violet-50', text: 'text-violet-700', dot: '#7C3AED' },
  testing: { bg: 'bg-amber-50', text: 'text-amber-800', dot: '#F59E0B' },
  submitted: { bg: 'bg-purple-50', text: 'text-purple-700', dot: '#9333EA' },
  approvedPJT: { bg: 'bg-teal-50', text: 'text-teal-700', dot: '#0D9488' },
  slo: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: '#16A34A' },
};

export function extractCompanyAndCity(rawAddr: string): { perusahaan: string; kota: string } {
  const cleaned = String(rawAddr || '').trim();
  if (!cleaned) return { perusahaan: 'Klien Baru', kota: 'Surabaya' };
  const parts = cleaned.split('|').map((s) => s.trim()).filter(Boolean);
  const perusahaan = parts[0] || cleaned;
  const kota = parts.length > 1 ? parts.slice(1).join(', ') : 'Surabaya';
  return { perusahaan, kota };
}

export function parseJenisInstalasiToProject(inst: string): {
  jenis: Project['jenis'];
  sub: string;
} {
  const low = String(inst || '').toLowerCase();
  if (low.includes('transmisi') || low.includes('sutt') || low.includes('gardu induk') || low.includes('pemanfaatan-2')) {
    return { jenis: 'TT', sub: 'Transmisi TT/GI' };
  }
  if (low.includes('distribusi') || low.includes('jtm') || low.includes('jtr') || low.includes('pemanfaatan-1') || low.includes('pemanfaatan-0')) {
    return { jenis: 'TM', sub: 'Distribusi TM' };
  }
  const code = inst.split('|')[0]?.trim() || 'PLTU';
  return { jenis: 'Pembangkit', sub: code };
}

export function mapJoSoStatusToProjectStatus(
  joStatus: JoSoStatus,
  current?: ProjectStatus
): ProjectStatus {
  // Don't regress a project that is already in field execution or SLO issued
  if (current && ['scheduled', 'testing', 'submitted', 'approvedPJT', 'slo'].includes(current)) {
    if (joStatus === 'completed') return 'slo';
    return current;
  }
  switch (joStatus) {
    case 'draft':
      return 'rfq';
    case 'submit':
      return 'offered';
    case 'approved':
      return 'approved';
    case 'in_progress':
      return 'paid';
    case 'completed':
      return 'slo';
    case 'cancelled':
      return current || 'rfq';
  }
}

export function mapProjectStatusToJoSoStatus(status: ProjectStatus): JoSoStatus {
  switch (status) {
    case 'rfq':
      return 'draft';
    case 'offered':
      return 'submit';
    case 'approved':
    case 'payproof':
      return 'approved';
    case 'paid':
    case 'scheduled':
    case 'testing':
    case 'submitted':
    case 'approvedPJT':
      return 'in_progress';
    case 'slo':
      return 'completed';
  }
}

export function syncJoSoToProject(
  rec: JoSoRecord,
  existing: Project | undefined,
  nextSeq: number
): Project {
  const nowIso = new Date().toISOString();
  const rawAddr = rec.pelangganAlamat || rec.kepadaAlamat || '';
  const { perusahaan, kota } = extractCompanyAndCity(rawAddr);
  const { jenis, sub } = parseJenisInstalasiToProject(
    rec.jenisInstalasiPenawaran || rec.jenisInstalasiJo
  );

  let jasa = 0;
  let mob = 0;
  rec.items.forEach((it) => {
    const subTotal = Math.round((Number(it.price) || 0) * (Number(it.qty) || 0));
    const nm = it.itemName.toLowerCase();
    if (nm.includes('transport') || nm.includes('akomodasi') || nm.includes('mobilisasi')) {
      mob += subTotal;
    } else {
      jasa += subTotal;
    }
  });

  const penawaranObj =
    rec.noPenawaran || jasa > 0 || mob > 0
      ? {
          no: rec.noPenawaran || existing?.penawaran?.no || `PNW-${pad2(nextSeq)}`,
          jasa,
          mob,
          ppn: Number.isFinite(rec.ppnRate) ? rec.ppnRate : 11,
          at: rec.tanggalPenawaran ? `${rec.tanggalPenawaran}T08:00:00.000Z` : nowIso,
        }
      : existing?.penawaran || null;

  const firstItemName = rec.items[0]?.itemName || rec.title || `${sub}`;
  const kapMatch = firstItemName.match(/\d+(?:[.,]\d+)?\s*(?:MW|kW|MVA|kVA|kV)/i);
  const kapText = existing?.kap || (kapMatch ? kapMatch[0] : 'Sesuai Kontrak SO/JO');

  const poMeta = rec.poNo
    ? existing?.po || {
        k: 'PO/SPK',
        name: rec.poNo,
        size: rec.documents[0]?.fileSize || 420000,
      }
    : existing?.po || null;

  const hasSalesMsg = Boolean(rec.salesReadiness && rec.sentToAdminAt);
  const nextStatus =
    hasSalesMsg && (!existing || ['rfq', 'offered', 'approved', 'payproof'].includes(existing.status))
      ? 'paid'
      : mapJoSoStatusToProjectStatus(rec.status, existing?.status);

  const nextWorkflowStage =
    existing?.workflowStage && existing.workflowStage !== 'draft'
      ? existing.workflowStage
      : hasSalesMsg
      ? 'sent_to_admin'
      : 'draft';

  if (existing) {
    return {
      ...existing,
      perusahaan: perusahaan || existing.perusahaan,
      kota: kota || existing.kota,
      jenis,
      sub,
      kap: kapText,
      status: nextStatus,
      penawaran: penawaranObj,
      po: poMeta,
      joSoId: rec.id,
      salesReadiness: rec.salesReadiness || existing.salesReadiness,
      salesMessage: rec.salesMessage ?? existing.salesMessage,
      workflowStage: nextWorkflowStage,
      log: [
        ...existing.log,
        [
          nowIso,
          hasSalesMsg
            ? `Sales mengirim pesan ke Admin: ${SALES_READINESS_LABEL[rec.salesReadiness!]}`
            : `Disinkronkan dari Rekap SO/JO (${rec.poNo || rec.noPenawaran || rec.title})`,
        ],
      ],
    };
  }

  const d = new Date();
  const ym = `${String(d.getFullYear()).slice(-2)}${pad2(d.getMonth() + 1)}`;
  return {
    id: rec.projectId || `p-${Date.now()}`,
    no: `RFQ-${ym}-${String(nextSeq).padStart(3, '0')}`,
    perusahaan,
    kota,
    jenis,
    sub,
    kap: kapText,
    status: nextStatus,
    files: rec.documents.map((doc) => ({
      k: doc.docName,
      name: doc.filePath,
      size: doc.fileSize || 350000,
    })),
    penawaran: penawaranObj,
    team: null,
    docs: { issued: false, ack: false },
    att: [],
    form: { items: {}, photos: [], submitted: false },
    finds: [],
    bap: null,
    pjt: null,
    slo: null,
    po: poMeta,
    transfer: null,
    joSoId: rec.id,
    salesReadiness: rec.salesReadiness,
    salesMessage: rec.salesMessage,
    workflowStage: nextWorkflowStage,
    log: [
      [
        nowIso,
        hasSalesMsg
          ? `Sales menerbitkan JO/SO & mengirim ke Admin: ${SALES_READINESS_LABEL[rec.salesReadiness!]}`
          : `Proyek dibuat otomatis dari Rekap SO/JO (${rec.poNo || rec.noPenawaran || rec.title})`,
      ],
    ],
  };
}

export function syncProjectToJoSo(proj: Project, existing?: JoSoRecord): JoSoRecord {
  const nowIso = new Date().toISOString();
  const today = isoToday();
  const exp = new Date();
  exp.setMonth(exp.getMonth() + 3);
  const expIso = exp.toISOString().slice(0, 10);

  const addr = `${proj.perusahaan} | ${proj.kota}`;
  const defaultInst =
    proj.jenis === 'TT'
      ? JENIS_INSTALASI_SOJO[8]
      : proj.jenis === 'TM'
      ? JENIS_INSTALASI_SOJO[9]
      : JENIS_INSTALASI_SOJO.find((o) => o.toLowerCase().includes(proj.sub.toLowerCase())) ||
        JENIS_INSTALASI_SOJO[0];

  const defaultJoInst =
    proj.jenis === 'TT'
      ? JENIS_INSTALASI_SOJO[5]
      : proj.jenis === 'TM'
      ? JENIS_INSTALASI_SOJO[6]
      : defaultInst;

  let items = existing?.items || [];
  if (proj.penawaran && (!existing || existing.items.length === 0 || existing.items.every((i) => i.price === 0))) {
    items = [
      {
        id: `it-jasa-${proj.id}`,
        itemName: `Jasa Uji Laik Operasi ${proj.jenis} (${proj.sub}) ${proj.kap}`,
        satuan: 'Unit',
        price: proj.penawaran.jasa,
        qty: 1,
      },
      ...(proj.penawaran.mob > 0
        ? [
            {
              id: `it-mob-${proj.id}`,
              itemName: `Transport & Mobilisasi (${proj.kota})`,
              satuan: 'Lot',
              price: proj.penawaran.mob,
              qty: 1,
            },
          ]
        : []),
    ];
  } else if (items.length === 0) {
    items = [
      {
        id: `it-init-${proj.id}`,
        itemName: `Uji Laik Operasi ${proj.jenis} (${proj.sub}) ${proj.kap}`,
        satuan: 'Unit',
        price: 0,
        qty: 1,
      },
    ];
  }

  const docs = [...(existing?.documents || [])];
  if (proj.po && !docs.some((d) => d.filePath === proj.po!.name)) {
    docs.push({
      id: `doc-po-${Date.now()}`,
      docName: 'PO / SPK Klien',
      filePath: proj.po.name,
      fileSize: proj.po.size,
      uploadedAt: nowIso,
    });
  }

  return {
    id: existing?.id || proj.joSoId || `joso-${Date.now()}`,
    projectId: proj.id,
    tanggalPenawaran: existing?.tanggalPenawaran || (proj.penawaran?.at ? proj.penawaran.at.slice(0, 10) : today),
    noPenawaran: proj.penawaran?.no || existing?.noPenawaran || proj.no.replace('RFQ-', 'PNW-'),
    perihal: existing?.perihal || 'Penawaran SLO',
    lampiran: existing?.lampiran || '1 (Satu) Lembar',
    tanggalPermintaan: existing?.tanggalPermintaan || today,
    kepadaAlamat: existing?.kepadaAlamat || addr,
    jenisInstalasiPenawaran: existing?.jenisInstalasiPenawaran || defaultInst,
    status: mapProjectStatusToJoSoStatus(proj.status),
    masaBerlaku: existing?.masaBerlaku || 30,
    ppnRate: proj.penawaran?.ppn ?? existing?.ppnRate ?? 11,
    items,
    poNo: existing?.poNo || proj.po?.name || '',
    title: existing?.title || `SLO ${proj.jenis} ${proj.perusahaan}`,
    poDate: existing?.poDate || today,
    poExpiredDate: existing?.poExpiredDate || expIso,
    dp: existing?.dp ?? 50,
    pelangganAlamat: existing?.pelangganAlamat || addr,
    jenisInstalasiJo: existing?.jenisInstalasiJo || defaultJoInst,
    paymentTerm: existing?.paymentTerm || 'DP 50, PL 50',
    documents: docs,
    salesReadiness: proj.salesReadiness || existing?.salesReadiness,
    salesMessage: proj.salesMessage ?? existing?.salesMessage,
    sentToAdminAt: existing?.sentToAdminAt,
    updatedAt: nowIso,
  };
}

export function isSamePersonName(a?: string | null, b?: string | null): boolean {
  const x = String(a || '').trim().toLowerCase();
  const y = String(b || '').trim().toLowerCase();
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

/** Cari gambar TTD (data URL) berdasarkan nama. Kecocokan persis dulu, lalu longgar. */
export function findSignature(
  signatures: Record<string, string> | undefined,
  name?: string | null
): string | undefined {
  const target = String(name || '').trim();
  if (!target || !signatures) return undefined;
  const keys = Object.keys(signatures);
  const exact = keys.find((k) => k.trim().toLowerCase() === target.toLowerCase());
  if (exact) return signatures[exact];
  const loose = keys.find((k) => isSamePersonName(k, target));
  return loose ? signatures[loose] : undefined;
}

export const REQUIRED_SIGNED_DOCS: SavedDocType[] = ['surat-tugas', 'surat-jalan', 'jsa'];

export const SAVED_DOC_LABELS: Record<SavedDocType, string> = {
  'surat-tugas': 'Surat Tugas',
  'surat-jalan': 'Surat Jalan Alat',
  jsa: 'JSA Keselamatan',
};

export function getMissingSignedScans(p: Project): SavedDocType[] {
  return REQUIRED_SIGNED_DOCS.filter((docType) => !p.signedScans?.[docType]);
}

export function hasAllRequiredSignedScans(p: Project): boolean {
  return getMissingSignedScans(p).length === 0;
}




/** Anggota tim (termasuk Leader) pada proyek. */
export function isTeamMember(p: Project, insId: string): boolean {
  return Boolean(p.team && (p.team.lead === insId || p.team.ins.includes(insId)));
}

export type FlowStepKey =
  | 'spk'
  | 'admin'
  | 'pjt_leader'
  | 'leader_notice'
  | 'prep_docs'
  | 'pjt_review'
  | 'director'
  | 'report'
  | 'pjt_report'
  | 'slo';

export const FLOW_STEPS: { key: FlowStepKey; label: string; owner: string }[] = [
  { key: 'spk', label: 'SPK & Pemberitahuan', owner: 'Marketing' },
  { key: 'admin', label: 'Teruskan ke PJT', owner: 'Admin' },
  { key: 'pjt_leader', label: 'Tunjuk Leader/PIC', owner: 'PJT' },
  { key: 'leader_notice', label: 'Status Pekerjaan', owner: 'Leader' },
  { key: 'prep_docs', label: 'ST, JSA & Surat Jalan', owner: 'Leader' },
  { key: 'pjt_review', label: 'Review Dokumen', owner: 'PJT' },
  { key: 'director', label: 'Review & TTD Surat Tugas', owner: 'Direktur' },
  { key: 'report', label: 'Laporan Pengujian', owner: 'Tenaga Teknik' },
  { key: 'pjt_report', label: 'Review Laporan', owner: 'PJT' },
  { key: 'slo', label: 'SLO Terbit', owner: 'Admin & PJT' },
];

/** Indeks langkah aktif (0..9) pada alur kerja baru; 10 = selesai. */
export function currentFlowIndex(p: Project): number {
  if (p.sloNotice) return 10;
  if (p.status === 'slo') return 9;
  if (p.status === 'approvedPJT') return 9;
  if (p.status === 'submitted') return 8;
  if (p.status === 'testing' || p.directorReview?.status === 'signed') return 7;
  if (p.directorReview?.status === 'pending' && p.prepReview?.status === 'approved') return 6;
  if (p.prepReview?.status === 'submitted') return 5;
  if (p.leaderStatus) return 4;
  if (p.team?.lead) return 3;
  if (p.workflowStage === 'forwarded_to_pjt') return 2;
  if (p.salesReadiness || p.workflowStage === 'sent_to_admin') return 1;
  return 0;
}
