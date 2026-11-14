export type Role = 'teknis' | 'sales' | 'inspektor' | 'pjt' | 'direktur' | 'klien';

export type ProjectStatus =
  | 'rfq'
  | 'offered'
  | 'approved'
  | 'payproof'
  | 'paid'
  | 'scheduled'
  | 'testing'
  | 'submitted'
  | 'approvedPJT'
  | 'slo';

export interface FileMeta {
  k?: string;
  name: string;
  size: number;
  thumb?: string;
}

export interface Penawaran {
  no: string;
  jasa: number;
  mob: number;
  ppn: number;
  at: string;
}

export interface TeamAssignment {
  ins: string[];
  tools: string[];
  lead: string;
}

export interface AttendanceRecord {
  id: string;
  ins: string;
  type: 'in' | 'out';
  at: string;
  lat: number | null;
  lon: number | null;
  acc: number;
  img: string;
  mode: 'live' | 'sim';
}

export interface TestFormItem {
  nilai?: string;
  hasil?: 'lulus' | 'tidak' | '';
  alat?: string;
  cat?: string;
}

export interface Finding {
  id: string;
  ref: string;
  txt: string;
  st: 'open' | 'closed';
  at: string;
  closed?: string;
}

export interface SloRecord {
  no: string;
  date: string;
  file: string;
  size: number;
}

export type SalesReadiness = 'ready_wait_dp' | 'ready_no_dp';

export type WorkflowStage =
  | 'draft'
  | 'sent_to_admin'
  | 'forwarded_to_pjt'
  | 'leader_assigned'
  | 'published_work';

export type LeaderIssueCategory =
  | 'Izin Lingkungan Tidak Ada'
  | 'Izin Tidak Ada'
  | 'Kekurangan Dokumen Teknik'
  | 'Reset Akun SiUjang'
  | 'Kendala Lainnya';

export const LEADER_ISSUE_PRESETS: LeaderIssueCategory[] = [
  'Izin Lingkungan Tidak Ada',
  'Izin Tidak Ada',
  'Kekurangan Dokumen Teknik',
  'Reset Akun SiUjang',
  'Kendala Lainnya',
];

export interface LeaderAdminMessage {
  id: string;
  category: string;
  note: string;
  senderName: string;
  senderId: string;
  sentAt: string;
  status: 'open' | 'resolved';
  adminReply?: string;
  resolvedAt?: string;
}

export interface TteInfo {
  enabled: boolean;
  signerName: string;
  signerRole: string;
  signedAt: string;
  code: string;
}

export interface Project {
  id: string;
  no: string;
  perusahaan: string;
  kota: string;
  jenis: 'TM' | 'TT' | 'Pembangkit';
  sub: string;
  kap: string;
  status: ProjectStatus;
  files: FileMeta[];
  penawaran: Penawaran | null;
  team: TeamAssignment | null;
  docs: { issued: boolean; ack: boolean };
  att: AttendanceRecord[];
  form: {
    items: Record<string, TestFormItem>;
    photos: FileMeta[];
    submitted: boolean;
  };
  finds: Finding[];
  bap: FileMeta | null;
  pjt: { at?: string; note?: string } | null;
  slo: SloRecord | null;
  po: FileMeta | null;
  transfer: FileMeta | null;
  log: [string, string][];
  joSoId?: string;
  pjtName?: string;
  salesReadiness?: SalesReadiness;
  salesMessage?: string;
  adminForwardNote?: string;
  workflowStage?: WorkflowStage;
  publishedToWorkMenu?: boolean;
  docTte?: {
    suratTugas?: TteInfo;
    suratJalan?: TteInfo;
    jsa?: TteInfo;
    sptSpd?: TteInfo;
  };
  signedScans?: Partial<Record<SavedDocType, SignedScanMeta>>;
  leaderMessages?: LeaderAdminMessage[];
}

export type SavedDocType = 'surat-tugas' | 'surat-jalan' | 'jsa';

export interface SignedScanMeta {
  id: string;
  vaultFileId: string;
  name: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface DocArchiveRecord {
  id: string;
  docType: SavedDocType;
  docNomor: string;
  fileName: string;
  fileSize: number;
  vaultPdfId?: string;
  projectId: string | null;
  projectNo?: string;
  perusahaan: string;
  lokasi: string;
  tanggalDokumen: string;
  penanggungJawab: string;
  tenagaTeknik: string[];
  tteEnabled: boolean;
  savedAt: string;
  savedBy: string;
  printedAt?: string;
  lastAction: 'saved_pdf' | 'printed';
  manualScan?: SignedScanMeta;
  snapshot?: {
    suratTugas?: SuratTugasData;
    suratJalan?: SuratJalanData;
    jsa?: JsaData;
  };
}

export interface Inspector {
  id: string;
  nama: string;
  noReg: string;
  serkom: string;
  k3: string;
}

export interface Tool {
  id: string;
  nama: string;
  sn: string;
  cal: string;
}

export type JenisSTKey = 'pembangkit' | 'transmisi' | 'distribusi' | 'pemanfaatan';

export interface SuratTugasData {
  id: string;
  projectId: string | null;
  jenisAktif: JenisSTKey;
  nomorUrut: string;
  nomorBulan: string;
  nomorTahun: string;
  penandatanganIdx: number;
  pjt: string;
  tenagaTeknik: string[];
  jenisPekerjaan: string;
  tipe: string;
  tipeManual: string;
  unit: string;
  kap: string;
  satuan: string;
  pemilik: string;
  lokasi: string;
  mulai: string;
  selesai: string;
  kota: string;
  tgl: string;
  updatedAt: string;
  tte?: TteInfo;
}

export interface SuratJalanItem {
  id: string;
  nama: string;
  manualNama: string;
  jml: string;
  unit: string;
  seri: string;
  ket: string;
}

export interface SuratJalanData {
  id: string;
  suratTugasId: string;
  items: SuratJalanItem[];
  kendTampil: boolean;
  kendaraan: string;
  keeper: string;
  ttdIdx: number;
  updatedAt: string;
  tte?: TteInfo;
}

export interface JsaData {
  id: string;
  suratTugasId: string;
  ketua: string;
  pelaksana: string[];
  jenisChecks: boolean[];
  kegiatan: string;
  alatChecks: boolean[];
  bahayaChecks: boolean[];
  apdChecks: boolean[];
  updatedAt: string;
  tte?: TteInfo;
}

export type JoSoStatus = 'draft' | 'submit' | 'approved' | 'in_progress' | 'completed' | 'cancelled';

export interface JoSoDetailItem {
  id: string;
  itemName: string;
  satuan: string;
  price: number;
  qty: number;
}

export interface JoSoDocument {
  id: string;
  docName: string;
  filePath: string;
  fileSize?: number;
  uploadedAt: string;
}

export interface JoSoRecord {
  id: string;
  projectId?: string;
  // Tab 1: Penawaran
  tanggalPenawaran: string;
  noPenawaran: string;
  perihal: string;
  lampiran: string;
  tanggalPermintaan: string;
  kepadaAlamat: string;
  jenisInstalasiPenawaran: string;
  status: JoSoStatus;
  masaBerlaku: number;
  ppnRate: number;
  items: JoSoDetailItem[];
  // Tab 2: Job Order / Sales Order
  poNo: string;
  title: string;
  poDate: string;
  poExpiredDate: string;
  dp: number;
  pelangganAlamat: string;
  jenisInstalasiJo: string;
  paymentTerm: string;
  // Tab 3: Job Order / Sales Order Document
  documents: JoSoDocument[];
  // Pesan status pekerjaan Sales ke Admin
  salesReadiness?: SalesReadiness;
  salesMessage?: string;
  sentToAdminAt?: string;
  updatedAt: string;
}

export interface AppDatabaseState {
  role: Role;
  seq: number;
  seq2: number;
  insp: Inspector[];
  tools: Tool[];
  proj: Project[];
  suratTugas: SuratTugasData;
  suratJalan: SuratJalanData;
  jsa: JsaData;
  joSoRecords: JoSoRecord[];
  docArchives: DocArchiveRecord[];
}

export interface UserSession {
  mode: 'google' | 'portal';
  username?: string;
  name: string;
  email: string;
  photoURL?: string;
  role: Role;
  inspectorId?: string;
  pjtName?: string;
}

export interface PortalAccount {
  id: string;
  username: string;
  /** SHA-256 dari `slo-portal:<username>:<password>` — password asli tidak disimpan di kode */
  passwordHash: string;
  name: string;
  email: string;
  role: Role;
  inspectorId?: string;
  pjtName?: string;
  group: 'Direktur' | 'Admin' | 'Marketing' | 'PJT' | 'Tenaga Teknik' | 'Klien';
}

export const PORTAL_ACCOUNTS: PortalAccount[] = [
  {
    id: 'acc-direktur',
    username: 'direktur',
    passwordHash: '91ce2a311e6a0e165318f997e03635d4a12ea7c4d221bb0950e010b4cac52bb6',
    name: 'Direktur Utama PT. SDP',
    email: 'direktur@sabdadutaparamitha.co.id',
    role: 'direktur',
    group: 'Direktur',
  },
  {
    id: 'acc-admin',
    username: 'admin',
    passwordHash: '89ec1ccb56144261d441c3c1a9450d9da1f9073ba06217be74f3737eaeaf9f0b',
    name: 'Admin Teknis SDP',
    email: 'admin@sabdadutaparamitha.co.id',
    role: 'teknis',
    group: 'Admin',
  },
  {
    id: 'acc-mkt1',
    username: 'marketing1',
    passwordHash: 'e0b55c06fb5569532fc8cb4454dbc17dbbf4683a3c7e4470a217dd472f0da582',
    name: 'Marketing 1 (Tim Sales)',
    email: 'marketing1@sabdadutaparamitha.co.id',
    role: 'sales',
    group: 'Marketing',
  },
  {
    id: 'acc-mkt2',
    username: 'marketing2',
    passwordHash: 'e4b060f61096f61fe06e9a4666dcdf5371b6984914cc8398982e84cbf612e819',
    name: 'Marketing 2 (Tim Sales)',
    email: 'marketing2@sabdadutaparamitha.co.id',
    role: 'sales',
    group: 'Marketing',
  },
  {
    id: 'acc-pjt1',
    username: 'kusno',
    passwordHash: 'fd4316685f2f16dfa289695944635726f0f67620c55a2315fa2c6893c78ade83',
    name: 'Kusno Hadi Bitoyo',
    email: 'kusno@sabdadutaparamitha.co.id',
    role: 'pjt',
    inspectorId: 'i6',
    pjtName: 'Kusno Hadi Bitoyo',
    group: 'PJT',
  },
  {
    id: 'acc-pjt2',
    username: 'fauzan',
    passwordHash: '37c8da5141a5e6510ba20f3c8478cc8ffb7c1bb09d57aac90adf0124d50db312',
    name: 'Ahmad Fauzan Hamdhani',
    email: 'fauzan@sabdadutaparamitha.co.id',
    role: 'pjt',
    inspectorId: 'i3',
    pjtName: 'Ahmad Fauzan Hamdhani',
    group: 'PJT',
  },
  {
    id: 'acc-ttk1',
    username: 'bagus',
    passwordHash: '4dbde05b88eeeed390520a995da4aa4299d427bfbb10ed2cfdbc1946e0a107b5',
    name: 'Bagus Indra Surya Binardo',
    email: 'bagus@sabdadutaparamitha.co.id',
    role: 'inspektor',
    inspectorId: 'i1',
    group: 'Tenaga Teknik',
  },
  {
    id: 'acc-ttk2',
    username: 'frizal',
    passwordHash: '5dd10f17a8b5f471feae2bff71706ec10eee7a1ed10f78441390a8778c1945ae',
    name: 'Frizal Aditya Junitio R',
    email: 'frizal@sabdadutaparamitha.co.id',
    role: 'inspektor',
    inspectorId: 'i2',
    group: 'Tenaga Teknik',
  },
  {
    id: 'acc-ttk3',
    username: 'ahmad.fauzan',
    passwordHash: '22fe7818e4c411a662f01f096067ddf1b4977c8f02b4eb0eacb4d26662017a25',
    name: 'Ahmad Fauzan Hamdhani',
    email: 'ahmad.fauzan@sabdadutaparamitha.co.id',
    role: 'inspektor',
    inspectorId: 'i3',
    group: 'Tenaga Teknik',
  },
  {
    id: 'acc-ttk4',
    username: 'yudi',
    passwordHash: 'fc96506d5117087be5a39a07bbf9effea360ad53cba679263f2172feec9ec59e',
    name: 'Yudi Surya Prakasa',
    email: 'yudi@sabdadutaparamitha.co.id',
    role: 'inspektor',
    inspectorId: 'i4',
    group: 'Tenaga Teknik',
  },
  {
    id: 'acc-ttk5',
    username: 'rozaq',
    passwordHash: '8e1511a1debcc8de74da93c55a36e18ee31e80c9f0ae027aedb0406ad6f5ecf5',
    name: 'Abdul Rozaq',
    email: 'rozaq@sabdadutaparamitha.co.id',
    role: 'inspektor',
    inspectorId: 'i5',
    group: 'Tenaga Teknik',
  },
  {
    id: 'acc-klien',
    username: 'klien',
    passwordHash: 'ede4bf1480e885ea54bd70a8039dca677a147f86b8cd9ef57b7621f8c53957de',
    name: 'Perwakilan Pemohon SLO',
    email: 'klien@pemohon-slo.id',
    role: 'klien',
    group: 'Klien',
  },
];

export interface SheetsSyncMeta {
  spreadsheetId: string;
  spreadsheetTitle: string;
  spreadsheetUrl: string;
  lastSyncAt: string | null;
  syncStatus: 'disconnected' | 'connected' | 'syncing' | 'error';
  lastError?: string;
}

export const ORG = 'PT. Sabda Duta Paramitha';
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
export const MANUAL_KEY = '__manual__';

export const DOC_CONFIG = {
  perusahaan: 'PT. Sabda Duta Paramitha',
  awalanTT: 'Sdr.',
  penandatangan: [
    { nama: 'Ir. S. Djoko Purwanto, MMT', jabatan: 'Direktur Utama' },
    { nama: 'Nur Mahmula, SE', jabatan: 'Direktur' },
  ],
  pjt: ['Kusno Hadi Bitoyo', 'Ahmad Fauzan Hamdhani'],
  tenagaTeknik: [
    'Abdul Rozaq',
    'Ahmad Fauzan Hamdhani',
    'Bagus Indra Surya Binardo',
    'Frizal Aditya Junitio R',
    'Kusno Hadi Bitoyo',
    'Yudi Surya Prakasa',
  ],
};

export interface JenisSTConfig {
  nama: string;
  ket: string;
  jenis: string;
  tipeOpsi: string[];
  tipe: string;
  unit: number;
  kap: number;
  satuanOpsi: string[];
  satuan: string;
  tanpaUnit?: boolean;
  lblUnit: string;
  lblKap: string;
  fmt: (t: string, u: string, k: string, s: string) => string;
}

export const JENIS_ST: Record<JenisSTKey, JenisSTConfig> = {
  pembangkit: {
    nama: 'Pembangkit',
    ket: 'BESS, PLTD, PLTU, PLTS, dll.',
    jenis: 'Uji Laik Operasi Instalasi',
    tipeOpsi: ['BESS', 'PLTD', 'PLTU', 'PLTS', 'PLTB', 'PLTBM', 'PLTG', 'PLTGU'],
    tipe: 'PLTU',
    unit: 2,
    kap: 150,
    satuanOpsi: ['kVA', 'MVA', 'kW', 'MW'],
    satuan: 'MW',
    lblUnit: 'Jumlah unit',
    lblKap: 'Kapasitas per unit',
    fmt: (t, u, k, s) => [t, u, 'X', k, s].filter(Boolean).join(' '),
  },
  transmisi: {
    nama: 'Transmisi',
    ket: 'SUTT, SUTET, GI, dll.',
    jenis: 'Uji Laik Operasi Instalasi Transmisi Tenaga Listrik',
    tipeOpsi: ['SUTT', 'SUTET', 'SKTT', 'Gardu Induk'],
    tipe: 'SUTT',
    unit: 2,
    kap: 150,
    satuanOpsi: ['kV', 'kVA', 'MVA'],
    satuan: 'kV',
    tanpaUnit: true,
    lblUnit: 'Jumlah sirkuit',
    lblKap: 'Tegangan',
    fmt: (t, _u, k, s) => [t, k && `${k} ${s}`].filter(Boolean).join(' '),
  },
  distribusi: {
    nama: 'Distribusi',
    ket: 'JTM, JTR, gardu, dll.',
    jenis: 'Uji Laik Operasi Instalasi Distribusi Tenaga Listrik',
    tipeOpsi: ['JTM', 'JTR', 'SKTM', 'Gardu Distribusi'],
    tipe: 'JTM',
    unit: 1,
    kap: 20,
    satuanOpsi: ['kV', 'kVA', 'MVA'],
    satuan: 'kV',
    lblUnit: 'Jumlah penyulang',
    lblKap: 'Tegangan',
    fmt: (t, u, k, s) => [t, k && `${k} ${s}`, u && `${u} Penyulang`].filter(Boolean).join(' '),
  },
  pemanfaatan: {
    nama: 'Pemanfaatan',
    ket: 'Instalasi konsumen / industri',
    jenis: 'Uji Laik Operasi Instalasi Pemanfaatan Tenaga Listrik',
    tipeOpsi: ['Tegangan Rendah', 'Tegangan Menengah', 'Tegangan Tinggi'],
    tipe: 'Tegangan Menengah',
    unit: 1,
    kap: 1000,
    satuanOpsi: ['kVA', 'MVA', 'kW', 'MW'],
    satuan: 'kVA',
    tanpaUnit: true,
    lblUnit: 'Jumlah instalasi',
    lblKap: 'Daya tersambung',
    fmt: (t, _u, k, s) => [t, k && `Daya ${k} ${s}`].filter(Boolean).join(', '),
  },
};

export const ALAT_PILIHAN = [
  'Tas Koper',
  'Thermogun (suhu)',
  'Helm Safety + Ear Plug',
  'Multi Environment Meter (Kebisingan)',
  'Earth Tester (Pembumian)',
  'Earth Clamp Tester (Pembumian)',
  'Multimeter Clamp(Tang ampere)',
  'Vibration Meter (Getaran)',
  'Alat Ukur Emisi Gas Buang',
  'Mini Particle Counter (Partikulat)',
  'Insulation Tester 5 kV(Tahanan Isolasi)',
  'Thermal Imager (Suhu)',
  'Power Quality Analyzer',
  'Irradian',
  'Hi-Pot Tester',
  'Laptop',
  'Kamera SLR',
  'Kamera Pocket',
];

export const SATUAN_ALAT = ['Unit', 'Set', 'Pcs', 'Buah', 'Pasang'];
export const KET_PILIHAN = ['-', 'Didalam tas Koper', 'Koper sendiri'];
export const KENDARAAN_PILIHAN = ['Xpander', 'Terios', 'Panther'];

export const JSA_JENIS: [string, boolean][] = [
  ['Konstruksi', true],
  ['R Tertutup', true],
  ['Alat Angkat', false],
  ['Kerja Panas', true],
  ['Penggalian', false],
  ['Diketinggian', true],
  ['Lainnya', false],
];

export const JSA_ALAT: [string, boolean][] = [
  ['Mesin', true],
  ['Listrik', true],
  ['Peralatan Tangan', false],
];

export const JSA_BAHAYA: [string, boolean][] = [
  ['Lantai Licin', true], ['Bahaya Alat Listrik', true], ['Ketinggian', true], ['Lingkungan Ramai', false], ['Percikan Las', false],
  ['Bahaya Kebakaran', true], ['Kegagalan Alat', true], ['Pekerjaan Terdekat', false], ['Beban Berat', false], ['Leburan Besi Panas', false],
  ['Percikan Api', false], ['Objek Berayun', false], ['Sambungan Pipa', false], ['Tangga yang Kokoh', true], ['Asap', true],
  ['Radioaktif', false], ['Gas', false], ['Pihak Ketiga', true], ['Berangin', false], ['Benda Tajam', false],
  ['Jalan Darurat', false], ['Jepit/Perangkap', false], ['Orang Tanpa Ijin', true], ['Benturan Benda', false], ['Bising', true],
  ['Polusi Alam', false], ['Bahaya Cedera', false], ['Gelap (Malam)', false], ['Salah Komunikasi', true], ['Vibrasi/Getaran', true],
  ['Debu', true], ['Tersandung/Jatuh', true], ['Cuaca Buruk', true], ['Terhantam Benda', false], ['Terpapar Covid', false],
  ['Kegagalan Peralatan', true], ['Salah Penyetelan', false], ['Ergonomic', false], ['Lantai Berlubang', false], ['Uap Panas', true],
  ['Kegagalan Struktur', true], ['Keseleo', false], ['Kejatuhan Material', false], ['Tepian Bangunan', true], ['Tersengat Listrik', true],
];

export const JSA_APD: [string, boolean][] = [
  ['Helm Keselamatan', true], ['Sarung Tangan Katun', true], ['Tali Keselamatan', false],
  ['Sepatu Keselamatan', true], ['Sarung Tangan Karet', false], ['Masker', true],
  ['Kacamata Keselamatan', false], ['Sarung Tangan Kulit', false], ['Pelindung Pendengaran', true],
  ['Pelindung Muka/Las', false], ['Baju Kulit', false], ['Pelindung Radiasi Magnetik', false],
  ['Kacamata Debu', true], ['Rompi Keselamatan', true], ['Masker Gas', false],
];

export const TESTS: Record<'TM' | 'TT' | 'Pembangkit', [string, string, string][]> = {
  TM: [
    ['isolasi', 'Tahanan isolasi', 'MΩ'],
    ['kontak', 'Tahanan kontak', 'µΩ'],
    ['rasio', 'Rasio trafo (TTR)', '%'],
    ['relai', 'Relai proteksi', '—'],
    ['bumi', 'Tahanan pembumian', 'Ω'],
  ],
  TT: [
    ['isolasi', 'Tahanan isolasi', 'MΩ'],
    ['kontak', 'Tahanan kontak', 'µΩ'],
    ['rasio', 'Rasio trafo (TTR)', '%'],
    ['cb', 'Waktu kerja PMT (CB Analyzer)', 'ms'],
    ['tand', 'Tan delta', '%'],
    ['relai', 'Relai proteksi', '—'],
    ['bumi', 'Tahanan pembumian', 'Ω'],
    ['termo', 'Termografi', '°C'],
  ],
  Pembangkit: [
    ['isolasi', 'Tahanan isolasi generator', 'MΩ'],
    ['relai', 'Proteksi generator', '—'],
    ['bumi', 'Tahanan pembumian', 'Ω'],
    ['load', 'Load test pembangkit', 'kW'],
    ['pqa', 'Kualitas daya (PQA)', '%'],
    ['termo', 'Termografi', '°C'],
  ],
};

export const JENIS_PROYEK: [string, string][] = [
  ['TM|Distribusi TM', 'TM — Distribusi TM'],
  ['TT|Transmisi TT/GI', 'TT — Transmisi TT/GI'],
  ...['PLTD', 'PLTU', 'PLTG', 'PLTGU', 'PLTS', 'PLTA', 'PLTP'].map(
    (x): [string, string] => [`Pembangkit|${x}`, `Pembangkit — ${x}`]
  ),
];

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  rfq: 'Menunggu penawaran',
  offered: 'Penawaran terbit',
  approved: 'Menunggu pembayaran',
  payproof: 'Verifikasi pembayaran',
  paid: 'Siap dijadwalkan',
  scheduled: 'Paket dokumen terbit',
  testing: 'Pengujian lapangan',
  submitted: 'Evaluasi PJT',
  approvedPJT: 'Disetujui PJT',
  slo: 'SLO terbit',
};

export const STEP_INDEX: Record<ProjectStatus, number> = {
  rfq: 0,
  offered: 1,
  approved: 2,
  payproof: 2,
  paid: 3,
  scheduled: 3,
  testing: 4,
  submitted: 5,
  approvedPJT: 5,
  slo: 7,
};

export const STEPS = ['RFQ', 'Penawaran', 'Pembayaran', 'Jadwal & dokumen', 'Pengujian', 'Evaluasi PJT', 'SLO'];

export const ROLE_LABELS: Record<Role, string> = {
  direktur: 'Direktur (Review Only)',
  teknis: 'Admin (1 Akun)',
  sales: 'Marketing / Sales (2 Akun)',
  inspektor: 'Tenaga Teknik (5 Akun)',
  pjt: 'Penanggung Jawab Teknik (2 Akun)',
  klien: 'Klien / Pemohon',
};

export const JENIS_INSTALASI_SOJO: string[] = [
  'PLTU | Pembangkit Listrik Tenaga Uap (PLTU)',
  'PLTD | Pembangkit Listrik Tenaga Diesel (PLTD)',
  'PLTS | Pembangkit Listrik Tenaga Surya (PLTS)',
  'PLTG | Pembangkit Listrik Tenaga Gas (PLTG)',
  'PLTGU | Pembangkit Listrik Tenaga Gas dan Uap (PLTGU)',
  'Pemanfaatan-2 | Instalasi Pemanfaatan Tenaga Listrik Tegangan Tinggi',
  'Pemanfaatan-1 | Instalasi Pemanfaatan Tenaga Listrik Tegangan Menengah',
  'Pemanfaatan-0 | Instalasi Pemanfaatan Tenaga Listrik Tegangan Rendah',
  'Transmisi | Instalasi Transmisi Tenaga Listrik (GI / SUTT / SUTET)',
  'Distribusi | Instalasi Distribusi Tenaga Listrik (JTM / JTR / SKTM)',
];

export const SATUAN_SOJO: string[] = ['Unit', 'Set', 'Paket', 'Lot', 'Ls', 'Titik', 'Hari'];

export const STATUS_SOJO_LIST: JoSoStatus[] = [
  'draft',
  'submit',
  'approved',
  'in_progress',
  'completed',
  'cancelled',
];

