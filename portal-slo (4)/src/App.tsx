import { Fragment, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Wrench,
  BellRing,
  Building2,
  FileSpreadsheet,
  LogOut,
  RotateCcw,
  Trophy,
  Menu,
  X,
  Printer,
  CheckCircle2,
  Archive,
  FolderArchive,
  KeyRound,
  UserCog,
  AppWindow,
  ClipboardList,
  Grid3x3,
  SquarePen,
  Table2,
} from 'lucide-react';
import {
  ALAT_PILIHAN,
  AppDatabaseState,
  CompanyDoc,
  normalizeDocCategory,
  DOC_CONFIG,
  DocArchiveRecord,
  JENIS_ST,
  JenisSTKey,
  JoSoRecord,
  JsaData,
  MAX_FILE_BYTES,
  Pelanggan,
  SuratPenawaran,
  Project,
  ROLE_LABELS,
  SavedDocType,
  SignedScanMeta,
  SuratJalanData,
  SuratTugasData,
  UserSession,
} from './types/portal';
import {
  computeAlerts,
  formatFileSize,
  isSamePersonName,
  isLeaderReadyForDocs,
  isoToday,
  SAVED_DOC_LABELS,
  seedDatabase,
  syncJoSoToProject,
  syncJsaWithSuratTugas,
  syncProjectToJoSo,
} from './utils/portalUtils';
import { blobToDataUrl, clearLocalVault, deleteVaultFile, putVaultFile } from './utils/fileVault';
import { newId, suggestNoPenawaran } from './utils/penawaranUtils';
import { printWithPdfFallback } from './utils/pdfExport';
import { serverLogout, hasSessionToken, setAuthExpiredHandler } from './services/accountApi';
import { LoginView } from './components/LoginView';
import { DashboardOverview } from './components/DashboardOverview';
import type { DocTab } from './components/DocEditorSuite';
import { useServerSync } from './hooks/useServerSync';
import { clearPersistedUi } from './hooks/usePersistedState';
import { contohPelanggan, contohPenawaran, contohSalesOrder } from './data/contohPenjualan';
import { GantiPasswordModal } from './components/GantiPasswordModal';
import { IdleWarningModal } from './components/IdleWarningModal';
import { useIdleLogout } from './hooks/useIdleLogout';
import { lazyRetry } from './utils/lazyRetry';

// Halaman besar dimuat saat menunya dibuka (code splitting), bukan sekaligus saat login.
const DaftarPekerjaan = lazyRetry(() => import('./components/DaftarPekerjaan'), 'DaftarPekerjaan');
const ProjectWorkflow = lazyRetry(() => import('./components/ProjectWorkflow'), 'ProjectWorkflow');
const DocEditorSuite = lazyRetry(() => import('./components/DocEditorSuite'), 'DocEditorSuite');
const ResourcesManager = lazyRetry(() => import('./components/ResourcesManager'), 'ResourcesManager');
const RekapDokumen = lazyRetry(() => import('./components/RekapDokumen'), 'RekapDokumen');
const InventarisPerusahaan = lazyRetry(() => import('./components/InventarisPerusahaan'), 'InventarisPerusahaan');
const KelolaAkun = lazyRetry(() => import('./components/KelolaAkun'), 'KelolaAkun');
const PanduanMenu = lazyRetry(() => import('./components/PanduanMenu'), 'PanduanMenu');
const LayananSlo = lazyRetry(() => import('./components/LayananSlo'), 'LayananSlo');
const InputPelanggan = lazyRetry(() => import('./components/PelangganMenu'), 'InputPelanggan');
const DataPelanggan = lazyRetry(() => import('./components/PelangganMenu'), 'DataPelanggan');
const InputPenawaran = lazyRetry(() => import('./components/PenawaranMenu'), 'InputPenawaran');
const DataPenawaran = lazyRetry(() => import('./components/PenawaranMenu'), 'DataPenawaran');
const CreateOrder = lazyRetry(() => import('./components/SalesOrderMenu'), 'CreateOrder');
const DataSalesOrder = lazyRetry(() => import('./components/SalesOrderMenu'), 'DataSalesOrder');
const AplikasiMenu = lazyRetry(() => import('./components/AplikasiMenu'), 'AplikasiMenu');

function ViewLoading() {
  return (
    <div className="flex items-center justify-center py-24 text-sm text-slate-400" role="status" aria-live="polite">
      Memuat halaman…
    </div>
  );
}

/** Penanda aktif pada tab ikon: satu bentuk yang bergeser ke tab terpilih (lebar tombol 44px + jarak 4px). */
function segPillStyle(idx: number): CSSProperties {
  return {
    position: 'absolute',
    left: 4,
    top: 4,
    width: 44,
    height: 40,
    borderRadius: 8,
    background: '#0f172a',
    transform: `translateX(${Math.max(idx, 0) * 48}px)`,
    opacity: idx < 0 ? 0 : 1,
    transition: 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1), opacity 150ms',
  };
}

type DokumenTabId = 'rekap-dokumen' | 'inventaris' | 'personel' | 'alat';

/** Tab di dalam menu Dokumen. Hanya ikon; nama muncul sebagai tooltip (title) dan label aksesibilitas. */
function DokumenTabs({
  active,
  tabs,
  onChange,
}: {
  active: DokumenTabId;
  tabs: { id: DokumenTabId; label: string; icon: typeof Archive; count?: number }[];
  onChange: (id: DokumenTabId) => void;
}) {
  if (tabs.length < 2) return null;
  const idx = tabs.findIndex((t) => t.id === active);
  return (
    <div role="tablist" aria-label="Isi menu Dokumen" className="relative mb-4 inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-xs">
      <span aria-hidden="true" className="seg-pill" style={segPillStyle(idx)} />
      {tabs.map((t) => {
        const Icon = t.icon;
        const on = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={on}
            aria-label={t.label}
            title={t.label}
            onClick={() => onChange(t.id)}
            className={`relative z-10 w-11 h-10 rounded-lg flex items-center justify-center cursor-pointer transition-colors duration-200 ${
              on ? 'text-white' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Icon className="w-[18px] h-[18px]" />
            {typeof t.count === 'number' && t.count > 0 && (
              <span
                className={`absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full text-[10px] leading-4 font-bold text-center transition-colors duration-200 ${
                  on ? 'bg-yellow-400 text-slate-900' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

type ActiveTab =
  | 'panduan'
  | 'overview'
  | 'proyek'
  | 'rekap-dokumen'
  | 'layanan-slo'
  | 'inventaris'
  | 'personel'
  | 'alat'
  | 'peringatan'
  | 'akun'
  | 'profil'
  | 'aplikasi'
  | 'input-pelanggan'
  | 'data-pelanggan'
  | 'input-penawaran'
  | 'data-penawaran'
  | 'input-sales-order'
  | 'data-sales-order';

const STORAGE_DB_KEY = 'portal-slo-react-v1';

/** Keluar otomatis bila tidak aktif (menit). Bisa diubah lewat VITE_IDLE_MINUTES; 0 = nonaktif. */
const IDLE_MINUTES = Number(import.meta.env.VITE_IDLE_MINUTES ?? 15);
const IDLE_MS = (Number.isFinite(IDLE_MINUTES) ? IDLE_MINUTES : 15) * 60_000;
const IDLE_WARN_MS = 60_000;

/** Halaman Master Data → Pelanggan, Penawaran dan Sales Order (hanya Marketing, Admin & Direktur; lihat SALES_MENU_ROLES). */
const PELANGGAN_TABS: ActiveTab[] = [
  'input-pelanggan',
  'data-pelanggan',
  'input-penawaran',
  'data-penawaran',
  'input-sales-order',
  'data-sales-order',
];

/** Menu yang boleh diakses tiap peran (Overview & Inventaris selalu tersedia). */
const TAB_ACCESS: Record<UserSession['role'], ActiveTab[]> = {
  // Direktur: review, komentar & TTD Surat Tugas
  direktur: ['panduan', 'overview', 'proyek', 'layanan-slo', 'rekap-dokumen', 'inventaris', 'personel', 'alat', 'peringatan', 'profil', 'aplikasi', ...PELANGGAN_TABS.filter((t) => t !== 'input-sales-order')],
  // Admin: kontrol penuh
  teknis: ['panduan', 'overview', 'proyek', 'layanan-slo', 'rekap-dokumen', 'inventaris', 'personel', 'alat', 'peringatan', 'akun', 'profil', 'aplikasi', ...PELANGGAN_TABS],
  // Marketing: hanya JO & SO (+ pemberitahuan ke Admin di Daftar Pekerjaan)
  sales: ['panduan', 'overview', 'proyek', 'layanan-slo', 'inventaris', 'profil', 'aplikasi', ...PELANGGAN_TABS],
  // PJT: atur leader, review dokumen & laporan
  pjt: ['panduan', 'overview', 'proyek', 'layanan-slo', 'rekap-dokumen', 'inventaris', 'personel', 'alat', 'peringatan', 'profil', 'aplikasi'],
  // Tenaga Teknik: ST, JSA, Surat Jalan (langkah alur di Daftar Pekerjaan), laporan
  inspektor: ['panduan', 'overview', 'proyek', 'layanan-slo', 'rekap-dokumen', 'inventaris', 'personel', 'alat', 'peringatan', 'profil', 'aplikasi'],
};

/**
 * Menu "Penjualan" (Pelanggan, Penawaran, Sales Order). Hanya terlihat oleh Marketing, Admin & Direktur.
 * Satu item di sidebar; di dalamnya tiga tab ikon. Tiap tab menampilkan daftar datanya,
 * dan formulir input dibuka lewat tombol "Tambah" (bukan menu terpisah).
 */
const SALES_MENU_ROLES: UserSession['role'][] = ['sales', 'teknis', 'direktur'];

const PENJUALAN_SECTIONS: {
  id: string;
  label: string;
  icon: typeof Grid3x3;
  data: ActiveTab;
  input: ActiveTab;
  tambah: string;
}[] = [
  { id: 'pelanggan', label: 'Pelanggan', icon: Building2, data: 'data-pelanggan', input: 'input-pelanggan', tambah: 'Tambah Pelanggan' },
  { id: 'penawaran', label: 'Penawaran', icon: SquarePen, data: 'data-penawaran', input: 'input-penawaran', tambah: 'Buat Penawaran' },
  { id: 'sales-order', label: 'Sales Order', icon: Table2, data: 'data-sales-order', input: 'input-sales-order', tambah: 'Create Order' },
];

function TombolTambah({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 h-8 rounded-md bg-gradient-to-br from-violet-500 to-purple-400 text-white text-xs font-bold shadow-sm shadow-violet-500/30 cursor-pointer"
    >
      <span aria-hidden="true" className="text-sm leading-none">+</span> {label}
    </button>
  );
}

/** Tab ikon di menu Penjualan. Tombol Tambah ada di toolbar tiap daftar (sejajar kotak Search). */
function PenjualanBar({
  activeTab,
  canAccess,
  onNavigate,
}: {
  activeTab: ActiveTab;
  canAccess: (tab: ActiveTab) => boolean;
  onNavigate: (tab: ActiveTab) => void;
}) {
  const sections = PENJUALAN_SECTIONS.filter((x) => canAccess(x.data));
  const current = sections.find((x) => x.data === activeTab || x.input === activeTab);
  return (
    <div className="mb-4">
      <div role="tablist" aria-label="Isi menu Penjualan" className="relative inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-xs">
        <span aria-hidden="true" className="seg-pill" style={segPillStyle(sections.findIndex((x) => x.id === current?.id))} />
        {sections.map((x) => {
          const Icon = x.icon;
          const on = current?.id === x.id;
          return (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={on}
              aria-label={x.label}
              title={x.label}
              onClick={() => onNavigate(x.data)}
              className={`relative z-10 w-11 h-10 rounded-lg flex items-center justify-center cursor-pointer transition-colors duration-200 ${
                on ? 'text-white' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-[18px] h-[18px]" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Peran yang boleh membuka editor ST, JSA & Surat Jalan (langkah alur di Daftar Pekerjaan). */
/** Peran yang boleh mengubah rekap JO/SO di server (harus sama dengan DB_SECTION_ROLES.joSoRecords di Code.gs). */
const JOSO_WRITER_ROLES: UserSession['role'][] = ['teknis', 'sales', 'direktur'];

const DOC_EDITOR_ROLES: UserSession['role'][] = ['direktur', 'pjt', 'inspektor'];

/**
 * Salinan data kerja di perangkat hanya disimpan di sessionStorage (hilang saat tab ditutup),
 * karena sumber data sebenarnya ada di server. Salinan lama di localStorage (versi sebelumnya)
 * yang bisa tertinggal di komputer bersama dibuang di sini.
 */
function purgeLegacyLocalCache() {
  try {
    localStorage.removeItem(STORAGE_DB_KEY);
  } catch {
    /* abaikan */
  }
}

function loadInitialDatabase(): AppDatabaseState {
  purgeLegacyLocalCache();
  try {
    const raw = hasSessionToken() ? sessionStorage.getItem(STORAGE_DB_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppDatabaseState>;
      const seeded = seedDatabase();
      if (parsed && Array.isArray(parsed.proj) && Array.isArray(parsed.insp) && Array.isArray(parsed.tools)) {
        const existingInspIds = new Set(parsed.insp.map((i) => i.id));
        const mergedInsp = [
          ...parsed.insp,
          ...seeded.insp.filter((si) => !existingInspIds.has(si.id)),
        ];
        const mergedProj = parsed.proj.map((projItem) => {
          if (projItem.pjtName) return projItem;
          const seededMatch = seeded.proj.find((sp) => sp.id === projItem.id);
          return seededMatch?.pjtName ? { ...projItem, pjtName: seededMatch.pjtName } : projItem;
        });
        return {
          ...seeded,
          ...parsed,
          insp: mergedInsp,
          proj: mergedProj,
          suratTugas: parsed.suratTugas || seeded.suratTugas,
          suratJalan: parsed.suratJalan || seeded.suratJalan,
          jsa: parsed.jsa || seeded.jsa,
          joSoRecords:
            Array.isArray(parsed.joSoRecords) && parsed.joSoRecords.length > 0
              ? parsed.joSoRecords
              : seeded.joSoRecords,
          docArchives: Array.isArray(parsed.docArchives) ? parsed.docArchives : seeded.docArchives,
          pelanggan: Array.isArray(parsed.pelanggan) ? parsed.pelanggan : seeded.pelanggan,
          suratPenawaran: Array.isArray(parsed.suratPenawaran) ? parsed.suratPenawaran : seeded.suratPenawaran,
          companyDocs: Array.isArray(parsed.companyDocs)
            ? parsed.companyDocs.map((d) => ({ ...d, category: normalizeDocCategory(d.category) }))
            : seeded.companyDocs,
        };
      }
    }
  } catch {
    // Fallback to clean seed
  }
  return seedDatabase();
}

const TAB_META: Record<ActiveTab, { title: string; subtitle: string }> = {
  'input-penawaran': {
    title: 'INPUT PENAWARAN',
    subtitle: 'Penawaran: Buat / Ubah Surat Penawaran',
  },
  'data-penawaran': {
    title: 'DATA PENAWARAN',
    subtitle: 'Penawaran: Daftar Surat Penawaran',
  },
  'input-sales-order': {
    title: 'CREATE ORDER',
    subtitle: 'Sales Order: Penawaran yang Siap Dibuatkan Purchase Order (Job Order/Sales Order)',
  },
  'data-sales-order': {
    title: 'DATA SALES ORDER',
    subtitle: 'Sales Order: Daftar Job Order/Sales Order & Cetak Work Order',
  },
  'input-pelanggan': {
    title: 'INPUT PELANGGAN',
    subtitle: 'Master Data: Tambah / Ubah Data Pelanggan',
  },
  'data-pelanggan': {
    title: 'DATA PELANGGAN',
    subtitle: 'Master Data: Daftar Pelanggan',
  },
  overview: {
    title: 'OVERVIEW',
    subtitle: 'Pekerjaan yang Perlu Anda Tindaklanjuti, Pipeline Alur & Statistik SLO',
  },
  panduan: {
    title: 'MULAI DI SINI',
    subtitle: 'Panduan Singkat Sesuai Peran Anda, Alur Pekerjaan & Arti Istilah',
  },
  proyek: {
    title: 'DAFTAR PEKERJAAN',
    subtitle: 'Daftar Pekerjaan, Pilih Penanggung Jawab Teknik & History Proses Pekerjaan',
  },
  'layanan-slo': {
    title: 'LAYANAN SLO',
    subtitle: 'Pemeriksaan & Pengujian, Registrasi SLO dan Penerbitan SLO',
  },
  'rekap-dokumen': {
    title: 'REKAP DOKUMEN & SCAN TTD',
    subtitle: 'Arsip PDF Surat Tugas, Surat Jalan Alat & JSA',
  },
  inventaris: {
    title: 'INVENTARIS PERUSAHAAN',
    subtitle: 'Dokumen Resmi Perusahaan: Legalitas, Perizinan, Sertifikat, SOP & Template',
  },
  personel: {
    title: 'PERSONEL & TTK',
    subtitle: 'Sertifikat Kompetensi (SKTTK) & Sertifikat K3 Inspektor',
  },
  alat: {
    title: 'ALAT UJI & KALIBRASI',
    subtitle: 'Inventaris Alat Ukur Lapangan & Masa Berlaku Kalibrasi',
  },
  peringatan: {
    title: 'PERINGATAN MASA BERLAKU',
    subtitle: 'Pemantauan H-60, H-30, H-7 & Penguncian Otomatis Kedaluwarsa',
  },
  akun: {
    title: 'KELOLA AKUN',
    subtitle: 'Tambah Pengguna, Ubah Peran, Nonaktifkan Akun & Reset Password',
  },
  profil: {
    title: 'PROFIL LIT',
    subtitle: 'Identitas Lembaga Inspeksi Teknik & Ketentuan Layanan',
  },
  aplikasi: {
    title: 'APLIKASI',
    subtitle: 'Kumpulan Aplikasi Bantu untuk Pekerjaan Lapangan',
  },
};

const SESSION_KEY = 'slo_session';
const NAV_KEY = 'slo_nav';

const VALID_TABS: ActiveTab[] = [
  'panduan', 'overview', 'proyek', 'layanan-slo', 'rekap-dokumen', 'inventaris',
  'personel', 'alat', 'peringatan', 'akun', 'profil', 'aplikasi', ...PELANGGAN_TABS,
];
const VALID_DOCS: DocTab[] = ['surat-tugas', 'surat-jalan', 'jsa'];

type NavState = { tab: ActiveTab; proj: string | null; doc: DocTab | null };

/** Baca sesi login yang tersimpan (hanya valid bila token server masih ada). */
function readStoredSession(): UserSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw && hasSessionToken() ? (JSON.parse(raw) as UserSession) : null;
  } catch {
    return null;
  }
}

/** Pulihkan menu terakhir yang dibuka setelah refresh (F5). Jatuh ke Overview bila tidak ada / tidak diizinkan. */
function readStoredNav(): NavState {
  const fallback: NavState = { tab: 'overview', proj: null, doc: null };
  try {
    const sess = readStoredSession();
    if (!sess) return fallback;
    const stateFromHistory = window.history.state as Partial<NavState> | null;
    const raw = sessionStorage.getItem(NAV_KEY);
    const st = (stateFromHistory?.tab ? stateFromHistory : raw ? JSON.parse(raw) : null) as Partial<NavState> | null;
    if (!st || !st.tab || !VALID_TABS.includes(st.tab)) return fallback;
    if (!TAB_ACCESS[sess.role]?.includes(st.tab)) return fallback;
    const doc =
      st.tab === 'proyek' && st.doc && VALID_DOCS.includes(st.doc) && DOC_EDITOR_ROLES.includes(sess.role)
        ? st.doc
        : null;
    return { tab: st.tab, proj: typeof st.proj === 'string' ? st.proj : null, doc };
  } catch {
    return fallback;
  }
}

export default function App() {
  const [db, setDb] = useState<AppDatabaseState>(() => {
    const initial = loadInitialDatabase();
    // Role langsung dari sesi agar guard akses menu tidak menendang ke Overview saat refresh
    const sess = readStoredSession();
    return sess ? { ...initial, role: sess.role } : initial;
  });
  // pulihkan sesi hanya bila token server juga masih ada
  const [session, setSession] = useState<UserSession | null>(readStoredSession);
  const [authError, setAuthError] = useState<string | null>(null);

  const [initialNav] = useState<NavState>(readStoredNav);
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialNav.tab);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialNav.proj);
  /** Editor ST / Surat Jalan / JSA yang terbuka di dalam Daftar Pekerjaan (langkah 5 alur). */
  const [docView, setDocView] = useState<DocTab | null>(initialNav.doc);
  const [activeInspectorId, setActiveInspectorId] = useState<string>('i1');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [panduanOpen, setPanduanOpen] = useState(false);
  const [editingPelangganId, setEditingPelangganId] = useState<string | null>(null);
  const [editingPenawaranId, setEditingPenawaranId] = useState<string | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [printingGlobal, setPrintingGlobal] = useState(false);
  const [changePwOpen, setChangePwOpen] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
  };

  useEffect(() => {
    if (!toastMsg) return;
    const timer = setTimeout(() => setToastMsg(null), 3500);
    return () => clearTimeout(timer);
  }, [toastMsg]);

  // Salinan sementara untuk refresh (F5): hanya saat sudah login, hanya di sessionStorage.
  useEffect(() => {
    try {
      if (session) sessionStorage.setItem(STORAGE_DB_KEY, JSON.stringify(db));
      else sessionStorage.removeItem(STORAGE_DB_KEY);
    } catch {
      // Ignore quota errors
    }
  }, [db, session]);

  const sync = useServerSync(Boolean(session), db, setDb, showToast);
  const syncLabel =
    sync.status === 'saving'
      ? 'Menyimpan ke server…'
      : sync.status === 'loading'
      ? 'Memuat dari server…'
      : sync.status === 'error'
      ? 'Gagal sinkron — mencoba lagi'
      : sync.status === 'saved'
      ? 'Tersimpan di server'
      : 'Lokal (tanpa server)';

  const alerts = useMemo(() => computeAlerts(db.insp, db.tools), [db.insp, db.tools]);

  const handlePortalLogin = (newSession: UserSession) => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    } catch {
      /* abaikan */
    }
    setAuthError(null);
    setSession(newSession);
    setDb((prev) => ({ ...prev, role: newSession.role }));
    if (newSession.inspectorId) {
      setActiveInspectorId(newSession.inspectorId);
    }
    setActiveTab('overview');
    showToast(`Selamat datang, ${newSession.name}`);
  };

  const handleLogout = async () => {
    void serverLogout(); // hapus token di server
    try {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(NAV_KEY);
      clearPersistedUi();
    } catch {
      /* abaikan */
    }
    setSession(null);
    // Staf: data kerja ada di server, jadi salinan di perangkat ini dihapus (aman di komputer bersama).
    try {
      sessionStorage.removeItem(STORAGE_DB_KEY);
      localStorage.removeItem(STORAGE_DB_KEY); // sisa versi lama
    } catch {
      /* abaikan */
    }
    void clearLocalVault();
    setDb({ ...seedDatabase(), role: db.role });
    setSelectedProjectId(null);
    setDocView(null);
    setMobileMenuOpen(false);
  };

  // Pulihkan role & inspektor setelah refresh (sesi dipulihkan dari sessionStorage)
  useEffect(() => {
    if (session) {
      setDb((prev) => (prev.role === session.role ? prev : { ...prev, role: session.role }));
      if (session.inspectorId) setActiveInspectorId(session.inspectorId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Token kedaluwarsa di server -> kembali ke halaman login
  const logoutRef = useRef(handleLogout);
  logoutRef.current = handleLogout;
  useEffect(() => {
    setAuthExpiredHandler(() => {
      setAuthError('Sesi berakhir. Silakan login ulang.');
      void logoutRef.current();
    });
    return () => setAuthExpiredHandler(null);
  }, []);

  // Keluar otomatis saat tidak aktif (peringatan 60 detik sebelumnya)
  const idle = useIdleLogout(
    Boolean(session) && IDLE_MS > IDLE_WARN_MS,
    () => {
      setAuthError('Anda keluar otomatis karena tidak aktif. Silakan login ulang.');
      void logoutRef.current();
    },
    { idleMs: IDLE_MS, warnMs: IDLE_WARN_MS }
  );

  // Simpan menu aktif agar tetap di menu yang sama setelah refresh
  useEffect(() => {
    if (!session) return;
    try {
      sessionStorage.setItem(
        NAV_KEY,
        JSON.stringify({ tab: activeTab, proj: selectedProjectId, doc: docView })
      );
    } catch {
      /* abaikan */
    }
  }, [session, activeTab, selectedProjectId, docView]);

  useEffect(() => {
    if (activeTab !== 'proyek' && docView) setDocView(null);
  }, [activeTab, docView]);

  useEffect(() => {
    if (docView && !DOC_EDITOR_ROLES.includes(db.role)) setDocView(null);
  }, [docView, db.role]);

  useEffect(() => {
    if (!TAB_ACCESS[db.role].includes(activeTab)) {
      setActiveTab('overview');
    }
  }, [activeTab, db.role]);

  /** Logo Portal SLO: kembali ke halaman utama (Overview). */
  const goHome = () => {
    setActiveTab('overview');
    setSelectedProjectId(null);
    setDocView(null);
    setMobileMenuOpen(false);
  };

  // Tombol Kembali (HP/browser) mengikuti menu yang pernah dibuka, bukan keluar dari aplikasi.
  const navFromPop = useRef(false);
  const lastNavKey = useRef<string | null>(null);

  useEffect(() => {
    if (!session) {
      lastNavKey.current = null;
      return;
    }
    const key = `${activeTab}|${selectedProjectId ?? ''}|${docView ?? ''}`;
    const state = { tab: activeTab, proj: selectedProjectId, doc: docView };
    if (lastNavKey.current === null) {
      window.history.replaceState(state, '');
      lastNavKey.current = key;
      return;
    }
    if (key === lastNavKey.current) return;
    lastNavKey.current = key;
    if (navFromPop.current) {
      navFromPop.current = false;
      return;
    }
    window.history.pushState(state, '');
  }, [session, activeTab, selectedProjectId, docView]);

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const st = e.state as { tab?: ActiveTab; proj?: string | null; doc?: DocTab | null } | null;
      if (!st?.tab) return;
      setMobileMenuOpen(false);
      if (`${st.tab}|${st.proj ?? ''}|${st.doc ?? ''}` !== lastNavKey.current) navFromPop.current = true;
      setActiveTab(st.tab);
      setSelectedProjectId(st.proj ?? null);
      setDocView(st.doc ?? null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (!panduanOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPanduanOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panduanOpen]);

  const handleNavigate = (tab: string) => {
    if (!TAB_ACCESS[db.role].includes(tab as ActiveTab)) {
      showToast('Menu ini tidak tersedia untuk peran Anda');
      return;
    }
    if (tab === 'input-pelanggan') setEditingPelangganId(null);
    if (tab === 'input-penawaran') setEditingPenawaranId(null);
    setActiveTab(tab as ActiveTab);
    setDocView(null);
    if (tab !== 'proyek') {
      setSelectedProjectId(null);
    }
    setMobileMenuOpen(false);
  };

  /** Buka editor ST / Surat Jalan / JSA sebagai langkah alur di Daftar Pekerjaan. */
  const openDocEditor = (docTab: DocTab) => {
    if (!DOC_EDITOR_ROLES.includes(db.role)) {
      showToast('Dokumen ST, JSA & Surat Jalan tidak tersedia untuk peran Anda');
      return;
    }
    setActiveTab('proyek');
    setDocView(docTab);
    setMobileMenuOpen(false);
  };

  /** Daftar Pekerjaan → Pilih Pekerjaan: Admin menentukan PJT (Kusno / Fauzan), proyek dibuat bila belum ada, lalu diteruskan ke PJT. */
  const handlePilihPekerjaan = (target: { recId?: string; projectId?: string }, pjtName: string, note: string) => {
    let label = '';
    setDb((prev) => {
      const rec = target.recId ? prev.joSoRecords.find((r) => r.id === target.recId) : undefined;
      let proj = prev.proj.find((p) => p.id === target.projectId || (rec && (p.id === rec.projectId || p.joSoId === rec.id)));
      let nextSeq = prev.seq;
      let created = false;
      if (!proj && rec) {
        proj = syncJoSoToProject(rec, undefined, prev.seq + 1);
        nextSeq = prev.seq + 1;
        created = true;
      }
      if (!proj) return prev;
      label = rec?.poNo || proj.no;
      const chosen: Project = {
        ...proj,
        pjtName,
        workflowStage: 'forwarded_to_pjt',
        adminForwardNote: note,
        log: [
          ...proj.log,
          [new Date().toISOString(), proj.pjtName && proj.pjtName !== pjtName && proj.workflowStage === 'forwarded_to_pjt'
            ? `Admin mengganti PJT dari ${proj.pjtName} ke ${pjtName}${note ? ` — catatan: ${note}` : ''}`
            : `Admin memilih pekerjaan & menunjuk PJT ${pjtName}${note ? ` — catatan: ${note}` : ''}; diteruskan ke PJT untuk menunjuk Leader TTK`],
        ],
      };
      return {
        ...prev,
        seq: nextSeq,
        proj: created ? [chosen, ...prev.proj] : prev.proj.map((p) => (p.id === chosen.id ? chosen : p)),
        joSoRecords: rec && JOSO_WRITER_ROLES.includes(prev.role)
          ? prev.joSoRecords.map((r) => (r.id === rec.id ? { ...r, projectId: chosen.id } : r))
          : prev.joSoRecords,
      };
    });
    showToast(`Pekerjaan ${label}: PJT ${pjtName}`);
  };

  /** Daftar Pekerjaan → PJT menunjuk Leader Tenaga Teknik (logika sama dengan panel di alur detail). */
  const handleTunjukLeader = (projectId: string, leaderId: string, memberIds: string[] = []) => {
    const p = db.proj.find((x) => x.id === projectId);
    const lead = db.insp.find((i) => i.id === leaderId);
    if (!p || !lead) return;
    const pjt = p.pjtName || session?.pjtName || session?.name || '';
    if (isSamePersonName(lead.nama, pjt)) {
      showToast('Nama PJT tidak dapat menjadi Leader pada pekerjaan yang sama. Pilih Tenaga Teknik lain.');
      return;
    }
    const members = (memberIds.length ? memberIds : p.team?.ins || []).filter(
      (id) => !isSamePersonName(db.insp.find((i) => i.id === id)?.nama, pjt)
    );
    handleUpdateProject({
      ...p,
      pjtName: pjt,
      team: { ins: Array.from(new Set([leaderId, ...members])), tools: p.team?.tools || [], lead: leaderId },
      workflowStage: p.workflowStage === 'published_work' ? 'published_work' : 'leader_assigned',
      status: ['rfq', 'offered', 'approved', 'payproof'].includes(p.status) ? 'paid' : p.status,
      log: [...p.log, [new Date().toISOString(), `PJT (${pjt}) menugaskan Leader ${lead.nama}${members.filter((id) => id !== leaderId).length ? ` & ${members.filter((id) => id !== leaderId).length} anggota tim` : ''}`]],
    });
    showToast(`${lead.nama} ditugaskan sebagai Leader — akses pembuatan Surat Tugas, JSA & Surat Jalan terbuka`);
  };

  const handleOpenProject = (projectId: string, row?: 'prep_docs' | 'director') => {
    // Langsung membuka panel langkah yang dipilih dari kolom Action (dibaca ProjectWorkflow saat tampil).
    try {
      if (row) sessionStorage.setItem('alur.resume', `${projectId}|${row}`);
    } catch {
      /* penyimpanan tidak tersedia */
    }
    setSelectedProjectId(projectId);
    setDocView(null);
    setActiveTab('proyek');
    setMobileMenuOpen(false);
  };

  /** Admin: ke menu Layanan SLO untuk input Verifikasi LIT & No. Agenda DJK. */
  const handleOpenLayananSlo = () => {
    setSelectedProjectId(null);
    setDocView(null);
    setActiveTab('layanan-slo');
    setMobileMenuOpen(false);
  };

  const handleUpdateProject = (updated: Project) => {
    setDb((prev) => {
      // Server hanya mengizinkan Admin, Sales & Direktur mengubah rekap JO/SO (lihat DB_SECTION_ROLES
      // di Code.gs). Peran lain (PJT, Tenaga Teknik) hanya memperbarui proyek, kalau tidak server menolak.
      if (!JOSO_WRITER_ROLES.includes(prev.role)) {
        return {
          ...prev,
          proj: prev.proj.map((p) => (p.id === updated.id ? updated : p)),
        };
      }
      const existingJoSo = prev.joSoRecords.find(
        (r) => r.id === updated.joSoId || r.projectId === updated.id
      );
      if (!existingJoSo) {
        // Direktur tidak berhak mengisi `joSoId` pada proyek (Code.gs PROJ_FIELDS). Untuk proyek lama tanpa
        // Sales Order, cukup perbarui proyeknya; rekap JO/SO dibuat oleh Admin/Marketing.
        if (prev.role === 'direktur') {
          return { ...prev, proj: prev.proj.map((p) => (p.id === updated.id ? updated : p)) };
        }
        const createdJoSo = syncProjectToJoSo(updated);
        const linkedProj = { ...updated, joSoId: createdJoSo.id };
        return {
          ...prev,
          proj: prev.proj.map((p) => (p.id === updated.id ? linkedProj : p)),
          joSoRecords: [createdJoSo, ...prev.joSoRecords],
        };
      }
      const syncedJoSo = syncProjectToJoSo(updated, existingJoSo);
      return {
        ...prev,
        proj: prev.proj.map((p) =>
          p.id === updated.id ? { ...updated, joSoId: syncedJoSo.id } : p
        ),
        joSoRecords: prev.joSoRecords.map((r) => (r.id === syncedJoSo.id ? syncedJoSo : r)),
      };
    });
  };

  const handleOpenProjectDocInEditor = (project: Project, docTab: DocTab) => {
    // Tenaga Teknik wajib mengirim status "Siap Uji" sebelum Surat Tugas / JSA / Surat Jalan dibuat
    if (db.role === 'inspektor' && !isLeaderReadyForDocs(project)) {
      showToast('Kirim status pekerjaan "Siap Uji" terlebih dahulu sebelum membuat Surat Tugas');
      return;
    }
    const jenisKey: JenisSTKey =
      project.jenis === 'TT'
        ? 'transmisi'
        : project.jenis === 'TM'
        ? 'distribusi'
        : 'pembangkit';

    const cfg = JENIS_ST[jenisKey];
    const teamNames = (project.team?.ins || [])
      .map((id) => db.insp.find((i) => i.id === id)?.nama || '')
      .filter(Boolean);

    const leadName =
      db.insp.find((i) => i.id === project.team?.lead)?.nama ||
      teamNames[0] ||
      DOC_CONFIG.tenagaTeknik[0];

    const kapNumMatch = project.kap.match(/(\d+(?:[.,]\d+)?)/g);
    const parsedUnit =
      kapNumMatch && kapNumMatch.length >= 2 ? kapNumMatch[0] : String(cfg.unit);
    const parsedKap =
      kapNumMatch && kapNumMatch.length >= 2
        ? kapNumMatch[1]
        : kapNumMatch?.[0] || String(cfg.kap);
    const parsedSatuan =
      cfg.satuanOpsi.find((s) => project.kap.toUpperCase().includes(s.toUpperCase())) ||
      cfg.satuan;

    const today = isoToday();
    const nowIso = new Date().toISOString();
    const nextPjt = project.pjtName || db.suratTugas.pjt;
    // Kolom 1 = Leader, kolom 2, 3, dst = anggota
    const filteredTeamNames = [
      ...(leadName && !isSamePersonName(leadName, nextPjt) ? [leadName] : []),
      ...teamNames.filter(
        (n) => !isSamePersonName(n, nextPjt) && !isSamePersonName(n, leadName)
      ),
    ];

    const nextSt: SuratTugasData = {
      ...db.suratTugas,
      projectId: project.id,
      jenisAktif: jenisKey,
      jenisPekerjaan: cfg.jenis,
      tipe: cfg.tipeOpsi.find((t) => project.sub.toUpperCase().includes(t.toUpperCase())) || cfg.tipe,
      tipeManual: '',
      unit: parsedUnit,
      kap: parsedKap,
      satuan: parsedSatuan,
      pemilik: project.perusahaan,
      lokasi: project.kota,
      pjt: nextPjt,
      tenagaTeknik: filteredTeamNames.length
        ? filteredTeamNames
        : db.suratTugas.tenagaTeknik.filter((n) => !isSamePersonName(n, nextPjt)),
      mulai: db.suratTugas.mulai || today,
      selesai: db.suratTugas.selesai || today,
      tgl: today,
      tte: project.docTte?.suratTugas,
      updatedAt: nowIso,
    };

    const projectTools = (project.team?.tools || [])
      .map((tid) => db.tools.find((t) => t.id === tid))
      .filter((t): t is NonNullable<typeof t> => Boolean(t));

    const nextSj: SuratJalanData =
      projectTools.length > 0
        ? {
            ...db.suratJalan,
            suratTugasId: nextSt.id,
            items: [
              { id: 'sj-auto-bag', nama: ALAT_PILIHAN[0], manualNama: '', jml: '1', unit: 'Unit', seri: '', ket: '-' },
              ...projectTools.map((t, idx) => ({
                id: `sj-auto-${idx}-${t.id}`,
                nama: ALAT_PILIHAN.includes(t.nama) ? t.nama : '__manual__',
                manualNama: ALAT_PILIHAN.includes(t.nama) ? '' : t.nama,
                jml: '1',
                unit: 'Unit',
                seri: t.sn,
                ket: 'Didalam tas Koper',
              })),
            ],
            tte: project.docTte?.suratJalan,
            updatedAt: nowIso,
          }
        : {
            ...db.suratJalan,
            tte: project.docTte?.suratJalan,
            updatedAt: nowIso,
          };

    // Nama ketua & pelaksana JSA mengikuti daftar Tenaga Teknik di Surat Tugas
    const nextJsa: JsaData = syncJsaWithSuratTugas(nextSt, {
      ...db.jsa,
      suratTugasId: nextSt.id,
      ketua: leadName,
      tte: project.docTte?.jsa,
      updatedAt: nowIso,
    });

    // Bila dokumen sudah pernah disimpan, pakai versi tersimpan (isian Leader tidak hilang saat direview / direvisi)
    const latestSnap = (t: SavedDocType) =>
      db.docArchives
        .filter((a) => a.projectId === project.id && a.docType === t && a.snapshot)
        .sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0]?.snapshot;
    const snapSt = latestSnap('surat-tugas')?.suratTugas;
    const snapSj = latestSnap('surat-jalan')?.suratJalan;
    const snapJsa = latestSnap('jsa')?.jsa;

    setDb((prev) => ({
      ...prev,
      suratTugas: snapSt
        ? { ...snapSt, tte: project.docTte?.suratTugas }
        : nextSt,
      suratJalan: snapSj
        ? { ...snapSj, tte: project.docTte?.suratJalan }
        : nextSj,
      jsa: snapJsa ? { ...snapJsa, tte: project.docTte?.jsa } : nextJsa,
    }));
    setSelectedProjectId(project.id);
    openDocEditor(docTab);
    showToast(`Data proyek ${project.no} dimuat ke editor ${docTab.replace('-', ' ').toUpperCase()}`);
  };

  /** Wizard Leader: setelah dokumen tersimpan, tim & alat proyek mengikuti isi Surat Tugas & Surat Jalan. */
  const handleWizardSave = () => {
    setDb((prev) => {
      const pid = prev.suratTugas.projectId;
      const proj = prev.proj.find((x) => x.id === pid);
      if (!proj || !proj.team) return prev;
      // Server hanya mengizinkan Leader proyek mengubah `team` (lihat checkProj_ di Code.gs). Anggota tim biasa
      // tetap bisa menyimpan dokumen, tetapi penyelarasan tim & alat dilewati agar penyimpanan tidak ditolak.
      if (prev.role === 'inspektor' && session?.inspectorId !== proj.team.lead) return prev;
      const names = prev.suratTugas.tenagaTeknik;
      const insIds = prev.insp
        .filter((i) => names.some((n) => isSamePersonName(n, i.nama)))
        .map((i) => i.id);
      const ins = Array.from(new Set([proj.team.lead, ...insIds]));
      const toolIds = prev.tools
        .filter((t) => t.sn && prev.suratJalan.items.some((it) => (it.seri || '').trim() === t.sn))
        .map((t) => t.id);
      const nextTeam = { ...proj.team, ins, tools: toolIds.length ? toolIds : proj.team.tools };
      return {
        ...prev,
        proj: prev.proj.map((x) => (x.id === proj.id ? { ...x, team: nextTeam } : x)),
      };
    });
  };

  const handleApplyTteToEditors = (
    project: Project,
    docTte: NonNullable<Project['docTte']>
  ) => {
    const nowIso = new Date().toISOString();
    setDb((prev) => ({
      ...prev,
      suratTugas: {
        ...prev.suratTugas,
        projectId: prev.suratTugas.projectId || project.id,
        tte: docTte.suratTugas || prev.suratTugas.tte,
        updatedAt: nowIso,
      },
      suratJalan: {
        ...prev.suratJalan,
        tte: docTte.suratJalan || prev.suratJalan.tte,
        updatedAt: nowIso,
      },
      jsa: {
        ...prev.jsa,
        tte: docTte.jsa || prev.jsa.tte,
        updatedAt: nowIso,
      },
    }));
  };

  const handleSaveJoSoRecord = (record: JoSoRecord, syncMode: 'auto' | 'none') => {
    setDb((prev) => {
      let nextRecord = { ...record };
      let nextProjects = prev.proj;
      let nextSeq = prev.seq;

      if (syncMode === 'auto') {
        const existingProj = prev.proj.find(
          (p) => p.id === record.projectId || p.joSoId === record.id
        );
        const syncedProj = syncJoSoToProject(nextRecord, existingProj, prev.seq + 1);
        nextRecord = { ...nextRecord, projectId: syncedProj.id };
        if (existingProj) {
          nextProjects = prev.proj.map((p) => (p.id === syncedProj.id ? syncedProj : p));
        } else {
          nextProjects = [syncedProj, ...prev.proj];
          nextSeq = prev.seq + 1;
        }
      }

      const exists = prev.joSoRecords.some((r) => r.id === nextRecord.id);
      return {
        ...prev,
        seq: nextSeq,
        proj: nextProjects,
        joSoRecords: exists
          ? prev.joSoRecords.map((r) => (r.id === nextRecord.id ? nextRecord : r))
          : [nextRecord, ...prev.joSoRecords],
      };
    });
  };

  const handleDeleteJoSoRecord = (id: string) => {
    setDb((prev) => ({
      ...prev,
      joSoRecords: prev.joSoRecords.filter((r) => r.id !== id),
      proj: prev.proj.map((p) => (p.joSoId === id ? { ...p, joSoId: undefined } : p)),
    }));
  };

  const handleSavePelanggan = (rec: Pelanggan) => {
    const isEdit = db.pelanggan.some((r) => r.id === rec.id);
    setDb((prev) => ({
      ...prev,
      pelanggan: isEdit ? prev.pelanggan.map((r) => (r.id === rec.id ? rec : r)) : [...prev.pelanggan, rec],
    }));
    showToast(isEdit ? 'Data pelanggan diperbarui' : 'Pelanggan baru disimpan');
    setEditingPelangganId(null);
    handleNavigate('data-pelanggan');
  };

  const handleDeletePelanggan = (id: string) => {
    setDb((prev) => ({ ...prev, pelanggan: prev.pelanggan.filter((r) => r.id !== id) }));
    showToast('Pelanggan dihapus');
  };

  const handleSavePenawaran = (rec: SuratPenawaran) => {
    const isEdit = db.suratPenawaran.some((r) => r.id === rec.id);
    setDb((prev) => ({
      ...prev,
      suratPenawaran: isEdit ? prev.suratPenawaran.map((r) => (r.id === rec.id ? rec : r)) : [rec, ...prev.suratPenawaran],
    }));
    showToast(isEdit ? 'Penawaran diperbarui' : 'Penawaran baru disimpan');
    setEditingPenawaranId(null);
    handleNavigate('data-penawaran');
  };

  const handleDeletePenawaran = (id: string) => {
    setDb((prev) => ({ ...prev, suratPenawaran: prev.suratPenawaran.filter((r) => r.id !== id) }));
    showToast('Penawaran dihapus');
  };

  /** Salin penawaran: nomor baru, tanggal hari ini, status draft — lalu langsung dibuka untuk diedit. */
  const handleDuplicatePenawaran = (id: string) => {
    const src = db.suratPenawaran.find((r) => r.id === id);
    if (!src) return;
    const today = isoToday();
    const now = new Date().toISOString();
    const copy: SuratPenawaran = {
      ...src,
      id: newId('pnw'),
      tanggal: today,
      noPenawaran: suggestNoPenawaran(db.suratPenawaran, today),
      status: 'draft',
      items: src.items.map((it) => ({ ...it, id: newId('pit') })),
      createdAt: now,
      updatedAt: now,
    };
    setDb((prev) => ({ ...prev, suratPenawaran: [copy, ...prev.suratPenawaran] }));
    setEditingPenawaranId(copy.id);
    setActiveTab('input-penawaran');
    setMobileMenuOpen(false);
    showToast('Penawaran disalin — periksa lalu simpan');
  };

  /** Simpan Sales Order (Create Order / Edit). Data memakai rekap JO/SO yang sama; tidak otomatis membuat proyek. */
  const handleSaveSalesOrder = (rec: JoSoRecord, isNew: boolean) => {
    handleSaveJoSoRecord(rec, 'none');
    showToast(isNew ? `Sales Order ${rec.poNo} dibuat` : `Sales Order ${rec.poNo} diperbarui`);
    if (isNew) handleNavigate('data-sales-order');
  };

  const handleDeleteSalesOrder = (id: string) => {
    handleDeleteJoSoRecord(id);
    showToast('Sales Order dihapus');
  };

  const handleAddPelangganQuick = (rec: Pelanggan) => {
    setDb((prev) => ({ ...prev, pelanggan: [...prev.pelanggan, rec] }));
  };

  const handleSaveDocArchive = (record: DocArchiveRecord) => {
    setDb((prev) => {
      const idx = prev.docArchives.findIndex(
        (d) =>
          d.id === record.id ||
          (d.docType === record.docType &&
            d.docNomor === record.docNomor &&
            (d.projectId || null) === (record.projectId || null))
      );
      const nextArchives =
        idx >= 0
          ? prev.docArchives.map((d, i) => (i === idx ? { ...d, ...record } : d))
          : [record, ...prev.docArchives];
      return {
        ...prev,
        docArchives: nextArchives,
      };
    });
  };

  const handleUploadSignedScan = async (
    projectId: string | null,
    docType: SavedDocType,
    file: File,
    archiveId?: string
  ) => {
    if (file.size > MAX_FILE_BYTES) {
      showToast(`${file.name} melebihi batas 5 MB (${formatFileSize(file.size)})`);
      return;
    }
    const nowIso = new Date().toISOString();
    const scanId = `scan-${docType}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const dataUrl = await blobToDataUrl(file);
    const mimeType =
      file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

    const synced = await putVaultFile({
      id: scanId,
      name: file.name,
      mimeType,
      size: file.size,
      dataUrl,
      savedAt: nowIso,
      folder: 'scan-ttd',
    });
    if (!synced) {
      showToast('Scan tersimpan di perangkat ini saja — server dokumen tidak terjangkau. Coba unggah ulang.');
    }

    const scanMeta: SignedScanMeta = {
      id: scanId,
      vaultFileId: scanId,
      name: file.name,
      size: file.size,
      mimeType,
      uploadedAt: nowIso,
      uploadedBy: session?.name || 'Tenaga Teknik',
    };

    setDb((prev) => {
      const nextProj = projectId
        ? prev.proj.map((p) => {
            if (p.id !== projectId) return p;
            return {
              ...p,
              signedScans: {
                ...(p.signedScans || {}),
                [docType]: scanMeta,
              },
              log: [
                ...p.log,
                [
                  nowIso,
                  `Scan TTD manual ${SAVED_DOC_LABELS[docType]} diunggah (${file.name}) oleh ${scanMeta.uploadedBy}`,
                ] as [string, string],
              ],
            };
          })
        : prev.proj;

      const nextArchives = prev.docArchives.map((rec) => {
        const matchByArchive = archiveId && rec.id === archiveId;
        const matchByProject =
          projectId && rec.projectId === projectId && rec.docType === docType;
        if (matchByArchive || matchByProject) {
          return {
            ...rec,
            manualScan: scanMeta,
          };
        }
        return rec;
      });

      return {
        ...prev,
        proj: nextProj,
        docArchives: nextArchives,
      };
    });

    showToast(`Scan TTD manual ${SAVED_DOC_LABELS[docType]} (${file.name}) berhasil diunggah`);
  };

  const handleAttachCertDoc = (inspectorId: string, kind: 'skttk' | 'k3', doc: CompanyDoc) => {
    setDb((prev) => {
      const field = kind === 'skttk' ? 'serkomDocId' : 'k3DocId';
      const oldId = prev.insp.find((i) => i.id === inspectorId)?.[field];
      if (oldId && oldId !== doc.id) {
        const old = prev.companyDocs.find((d) => d.id === oldId);
        if (old) void deleteVaultFile(old.vaultFileId);
      }
      return {
        ...prev,
        insp: prev.insp.map((i) => (i.id === inspectorId ? { ...i, [field]: doc.id } : i)),
        companyDocs: [doc, ...prev.companyDocs.filter((d) => d.id !== oldId)],
      };
    });
  };

  const handleDeleteDocArchive = (archiveId: string) => {
    const target = db.docArchives.find((d) => d.id === archiveId);
    if (target?.vaultPdfId) {
      void deleteVaultFile(target.vaultPdfId);
    }
    setDb((prev) => ({
      ...prev,
      docArchives: prev.docArchives.filter((d) => d.id !== archiveId),
    }));
    showToast('Arsip dokumen dihapus dari rekap');
  };

  const handleOpenArchiveInEditor = (rec: DocArchiveRecord) => {
    if (rec.snapshot) {
      setDb((prev) => ({
        ...prev,
        suratTugas: rec.snapshot?.suratTugas || prev.suratTugas,
        suratJalan: rec.snapshot?.suratJalan || prev.suratJalan,
        jsa: rec.snapshot?.jsa || prev.jsa,
      }));
    }
    if (rec.projectId) setSelectedProjectId(rec.projectId);
    openDocEditor(rec.docType);
    showToast(`Dokumen ${SAVED_DOC_LABELS[rec.docType]} (${rec.docNomor}) dibuka di editor`);
  };

  const handleResetDemoData = async () => {
    const next = { ...seedDatabase(), role: db.role };
    setDb(next);
    setSelectedProjectId(null);
    setConfirmResetOpen(false);
    const ok = await sync.saveNow(next);
    showToast(
      ok
        ? 'Data portal dikembalikan ke contoh awal dan sudah tersimpan di server.'
        : 'Data direset di layar ini, tetapi GAGAL tersimpan ke server. Jangan refresh; cek status sinkron lalu ulangi.',
    );
  };

  /** Ganti hanya Pelanggan, Penawaran, dan Sales Order contoh; data lain (proyek, personel, dll.) tidak diubah. */
  const handleLoadContohPenjualan = async () => {
    const pel = contohPelanggan();
    const pnw = contohPenawaran(pel);
    const so = contohSalesOrder(pel, pnw);
    const soLama = new Set(['joso-1', 'joso-2']); // contoh lama bawaan
    const pelAsli = db.pelanggan.filter((x) => !x.id.startsWith('pel-contoh-'));
    const maxId = Math.max(0, ...pelAsli.map((x) => parseInt(x.idPelanggan, 10)).filter(Number.isFinite));
    const next: AppDatabaseState = {
      ...db,
      pelanggan: [...pelAsli, ...pel.map((x, i) => ({ ...x, idPelanggan: String(maxId + i + 1) }))],
      suratPenawaran: [...pnw, ...db.suratPenawaran.filter((x) => !x.id.startsWith('pnw-contoh-'))],
      joSoRecords: [
        ...so,
        ...db.joSoRecords.filter((x) => !x.id.startsWith('so-contoh-') && !soLama.has(x.id)),
      ],
      proj: db.proj.map((p) => (p.joSoId && soLama.has(p.joSoId) ? { ...p, joSoId: undefined } : p)),
    };
    setDb(next);
    setConfirmResetOpen(false);
    const ok = await sync.saveNow(next);
    showToast(
      ok
        ? 'Contoh Pelanggan, Penawaran, dan Sales Order dimuat dan tersimpan di server.'
        : 'Contoh dimuat di layar ini, tetapi GAGAL tersimpan ke server. Jangan refresh; cek status sinkron lalu ulangi.',
    );
  };

  const handleGlobalPrintOrPdf = async () => {
    if (printingGlobal) return;
    setPrintingGlobal(true);
    try {
      const a4Node = document.querySelector('.a4-paper') as HTMLElement | null;
      const targetEl = a4Node || workspaceRef.current;
      const safeTitle = currentTabInfo.title.replace(/[^a-zA-Z0-9_-]+/g, '-');
      const fileName = `Portal-SLO-${safeTitle}.pdf`;
      await printWithPdfFallback({
        element: targetEl,
        filename: fileName,
        singlePageFit: Boolean(a4Node),
        marginMm: a4Node ? 0 : 8,
        onFallbackToPdf: () => {
          showToast(`Mode preview membatasi cetak — mengunduh "${fileName}" langsung`);
        },
      });
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Gagal mencetak / membuat PDF');
    } finally {
      setPrintingGlobal(false);
    }
  };

  if (!session) {
    return (
      <LoginView
        inspectors={db.insp}
        onPortalLogin={handlePortalLogin}
        authError={authError}
      />
    );
  }

  const navItems: {
    id: ActiveTab;
    label: string;
    icon: typeof LayoutDashboard;
    badge?: number;
  }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    // Satu menu "Penjualan" (tab ikon Pelanggan / Penawaran / Sales Order) menggantikan tiga grup submenu.
    { id: 'data-pelanggan', label: 'Penjualan', icon: Table2 },
    { id: 'proyek', label: 'Daftar Pekerjaan', icon: FolderKanban, badge: db.proj.length },
    { id: 'layanan-slo', label: 'Layanan SLO', icon: ClipboardList },
    // Satu menu "Dokumen" berisi empat tab ikon: Rekap Dokumen, Inventaris, Personel TTK, Alat Uji (lihat DokumenTabs).
    // Peran tanpa akses Rekap (mis. Sales) langsung masuk ke Inventaris.
    {
      id: TAB_ACCESS[db.role].includes('rekap-dokumen') ? 'rekap-dokumen' : 'inventaris',
      label: 'Dokumen',
      icon: Archive,
      badge: (db.docArchives.length + db.companyDocs.length) || undefined,
    },
  ].filter((item) => TAB_ACCESS[db.role].includes(item.id as ActiveTab)) as {
    id: ActiveTab;
    label: string;
    icon: typeof LayoutDashboard;
    badge?: number;
  }[];

  // Menu jarang dipakai: ikon kecil di bawah sidebar (Profil LIT, Aplikasi, Kelola Akun untuk Admin).
  const footerTabs = (
    [
      { id: 'profil', label: 'Profil LIT', icon: Building2 },
      { id: 'aplikasi', label: 'Aplikasi', icon: AppWindow },
      { id: 'akun', label: 'Kelola Akun', icon: UserCog },
    ] as { id: ActiveTab; label: string; icon: typeof Building2 }[]
  ).filter((t) => TAB_ACCESS[db.role].includes(t.id));

  const dokumenTabs = (
    [
      { id: 'rekap-dokumen', label: 'Rekap Dokumen & Scan TTD', icon: Archive, count: db.docArchives.length },
      { id: 'inventaris', label: 'Inventaris Perusahaan', icon: FolderArchive, count: db.companyDocs.length },
      { id: 'personel', label: 'Personel TTK (SKTTK & K3)', icon: Users, count: undefined },
      { id: 'alat', label: 'Alat Uji & Kalibrasi', icon: Wrench, count: undefined },
    ] as { id: DokumenTabId; label: string; icon: typeof Archive; count?: number }[]
  ).filter((t) => TAB_ACCESS[db.role].includes(t.id));

  // Proyek yang boleh dilihat di Layanan SLO — aturan yang sama dengan daftar di Daftar Pekerjaan.
  const layananProjects = db.proj.filter((p) => {
    if (db.role === 'inspektor') {
      const id = session.inspectorId || activeInspectorId;
      return (
        Boolean(p.team && (p.team.lead === id || p.team.ins.includes(id))) ||
        Boolean(p.instalasi?.some((i) => i.teamIds?.includes(id)))
      );
    }
    if (db.role === 'pjt') {
      const me = session.pjtName || session.name;
      const id = session.inspectorId || activeInspectorId;
      const asTtk = Boolean(p.team && (p.team.lead === id || p.team.ins.includes(id)));
      return asTtk || Boolean(p.pjtName && isSamePersonName(p.pjtName, me));
    }
    return true;
  });

  const currentTabInfo = TAB_META[activeTab];
  // Surat Tugas/JSA/Surat Jalan dibuat Tenaga Teknik (& Admin). PJT hanya mereview untuk proyek miliknya.
  const linkedStProject = db.proj.find((x) => x.id === db.suratTugas.projectId);
  // Tenaga Teknik: hanya Leader & anggota tim yang ditunjuk pada proyek terkait yang boleh mengisi dokumen.
  const myInspectorId = session.inspectorId || activeInspectorId;
  const notInProjectTeam =
    db.role === 'inspektor' &&
    !(
      linkedStProject?.team &&
      (linkedStProject.team.lead === myInspectorId || linkedStProject.team.ins.includes(myInspectorId))
    );
  const docEditorReadOnly =
    db.role === 'direktur' ||
    db.role === 'sales' ||
    notInProjectTeam ||
    (db.role === 'pjt' &&
      Boolean(linkedStProject?.pjtName) &&
      isSamePersonName(linkedStProject?.pjtName, session.pjtName || session.name));
  const isDocEditor = activeTab === 'proyek' && docView !== null;
  const docProject = db.proj.find((x) => x.id === selectedProjectId) || linkedStProject || null;

  return (
    <div className="min-h-screen w-full bg-[#0B1221] flex flex-col lg:flex-row font-sans">
      {/* Mobile top bar */}
      <header className="no-print lg:hidden flex items-center justify-between px-4 py-3 bg-[#0B1221] text-white border-b border-white/10">
        <button
          type="button"
          onClick={goHome}
          aria-label="Ke halaman utama"
          className="flex items-center gap-2.5 text-left cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-yellow-400 text-[#0F1E3D] flex items-center justify-center font-display font-extrabold text-sm">
            S
          </div>
          <div>
            <div className="font-display font-extrabold text-sm tracking-tight leading-none">
              PORTAL SLO
            </div>
            <div className="text-[10px] font-bold text-yellow-300 uppercase tracking-wider mt-0.5">
              PT. Sabda Duta Paramitha
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setMobileMenuOpen((v) => !v)}
          className="p-2 rounded-lg bg-white/10 hover:bg-white/15"
          aria-label="Toggle Menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Dark Midnight Navy Left Sidebar (matching reference dashboard) */}
      <aside
        className={`no-print ${
          mobileMenuOpen ? 'flex' : 'hidden'
        } lg:flex flex-col w-full lg:w-64 xl:w-68 shrink-0 bg-[#0B1221] text-white px-4 py-6 justify-between border-b lg:border-b-0 border-white/10 lg:sticky lg:top-0 lg:h-screen lg:self-start lg:overflow-y-auto`}
      >
        <div>
          {/* Brand Header */}
          <button
            type="button"
            onClick={goHome}
            aria-label="Ke halaman utama"
            className="hidden lg:flex items-center gap-3 px-2 mb-7 text-left cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-yellow-400 flex items-center justify-center shadow-lg shadow-yellow-400/20 shrink-0">
              <span className="font-display font-extrabold text-lg text-[#0F1E3D]">S</span>
            </div>
            <div className="min-w-0">
              <div className="font-display font-extrabold text-base tracking-tight text-white leading-tight">
                PORTAL SLO
              </div>
              <div className="text-[11px] font-bold text-yellow-300 tracking-wide uppercase truncate">
                PT. SABDA DUTA PARAMITHA
              </div>
            </div>
          </button>

          {/* Primary Navigation */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.label === 'Penjualan'
                  ? PELANGGAN_TABS.includes(activeTab)
                  : item.label === 'Dokumen'
                  ? activeTab === 'rekap-dokumen' || activeTab === 'inventaris' || activeTab === 'personel' || activeTab === 'alat'
                  : activeTab === item.id;
              return (
                <Fragment key={item.id}>
                <button
                  type="button"
                  onClick={() => handleNavigate(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-yellow-400 text-[#0F1E3D] shadow-lg shadow-yellow-400/20 font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <span className="flex items-center gap-3 truncate">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#0F1E3D]' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {typeof item.badge === 'number' && item.badge > 0 && (
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums ${
                        item.id === 'peringatan'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                          : isActive
                          ? 'bg-[#0F1E3D]/15 text-[#0F1E3D]'
                          : 'bg-white/10 text-slate-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
                </Fragment>
              );
            })}

            <div className="pt-2 mt-2 border-t border-white/10 px-3.5 py-2 flex items-center gap-2 text-xs text-slate-300">
              <span
                className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                  sync.status === 'saved' ? 'bg-emerald-400' : sync.status === 'error' ? 'bg-red-400' : 'bg-slate-500'
                } ${sync.status === 'saving' || sync.status === 'loading' ? 'animate-pulse' : ''}`}
              />
              {syncLabel}
            </div>
          </nav>
        </div>

        {/* Bottom Quote / Mission Card & User Session Footer */}
        <div className="mt-6 space-y-3">
          <div className="hidden [@media(min-height:860px)]:block rounded-2xl bg-[#111C33] border border-white/10 p-4 text-center">
            <div className="w-9 h-9 rounded-full bg-amber-500/15 border border-amber-400/30 flex items-center justify-center mx-auto mb-2.5">
              <Trophy className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              “Keselamatan kerja &amp; akurasi uji kelaikan operasi adalah fondasi keandalan sistem kelistrikan nasional.”
            </p>
          </div>

          <div role="toolbar" aria-label="Pengaturan" className="flex items-center gap-1 rounded-xl bg-white/[0.04] border border-white/10 p-1">
            {footerTabs.map((t) => {
              const FIcon = t.icon;
              const on = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  title={t.label}
                  aria-label={t.label}
                  onClick={() => handleNavigate(t.id)}
                  className={`flex-1 h-9 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
                    on ? 'bg-yellow-400 text-[#0F1E3D]' : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <FIcon className="w-4 h-4" />
                </button>
              );
            })}
          </div>

          <div className="rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2.5 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white truncate">{session.name}</div>
              <div className="text-[11px] text-slate-400 truncate">
                {session.mode === 'google' ? session.email : ROLE_LABELS[db.role]}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setChangePwOpen(true)}
              title="Ganti Password"
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            >
              <KeyRound className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              title="Keluar / Ganti Akun"
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Light Workspace Canvas */}
      <main className="flex-1 bg-[#F8FAFC] lg:rounded-tl-[28px] min-h-screen flex flex-col overflow-x-hidden">
        {/* Crisp Top Bar */}
        <header className="no-print bg-white border-b border-slate-200/80 lg:rounded-tl-[28px] px-5 md:px-7 py-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-lg md:text-xl font-extrabold text-slate-900 tracking-tight">
              {isDocEditor ? 'ST, JSA & SURAT JALAN' : currentTabInfo.title}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {isDocEditor
                ? 'Langkah 5 Alur Pekerjaan SLO: Surat Tugas, Surat Jalan Alat & JSA Keselamatan (dibuat Leader, direview PJT)'
                : currentTabInfo.subtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Panduan singkat: dibuka sebagai dialog */}
            <button
              type="button"
              onClick={() => setPanduanOpen(true)}
              title="Panduan singkat"
              aria-label="Buka panduan singkat"
              className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer font-bold text-sm"
            >
              ?
            </button>

            {/* Peringatan masa berlaku: lonceng dengan jumlah peringatan */}
            {TAB_ACCESS[db.role].includes('peringatan') && (
              <button
                type="button"
                onClick={() => handleNavigate('peringatan')}
                title={alerts.length > 0 ? `Peringatan masa berlaku (${alerts.length})` : 'Peringatan masa berlaku'}
                aria-label={`Peringatan masa berlaku${alerts.length > 0 ? `, ${alerts.length} peringatan` : ''}`}
                className={`relative inline-flex items-center justify-center w-9 h-9 rounded-xl border transition-colors cursor-pointer ${
                  activeTab === 'peringatan'
                    ? 'bg-amber-50 border-amber-300 text-amber-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <BellRing key={alerts.length} className={`w-4 h-4 ${alerts.length > 0 ? 'bell-ring' : ''}`} />
                {alerts.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-amber-500 text-white text-[10px] leading-4 font-bold text-center">
                    {alerts.length}
                  </span>
                )}
              </button>
            )}

            {/* Authenticated Account & Role Pill */}
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-1.5 shadow-2xs">
              <div className="text-xs leading-tight">
                <span className="font-bold text-slate-900">{session.name}</span>
                <span className="text-slate-400 mx-1.5">·</span>
                <span className="font-semibold text-blue-700">{ROLE_LABELS[db.role]}</span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="ml-1 px-2 py-0.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 cursor-pointer"
              >
                Ganti Akun
              </button>
            </div>

            {/* Status simpan otomatis ke server */}
            <span
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border ${
                sync.status === 'saved'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : sync.status === 'error'
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">{syncLabel}</span>
            </span>

            {/* Quick Reset Button (Admin Only) */}
            {db.role === 'teknis' && (
              <button
                type="button"
                onClick={() => setConfirmResetOpen(true)}
                title="Reset Data Contoh"
                className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}

            {/* Royal Indigo Print Button (matching reference dashboard top-right icon button) */}
            <button
              type="button"
              disabled={printingGlobal}
              onClick={handleGlobalPrintOrPdf}
              title="Cetak / Simpan PDF"
              className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-[#6366F1] to-[#4F46E5] text-white shadow-sm shadow-indigo-500/30 hover:opacity-95 disabled:opacity-60 transition-opacity cursor-pointer"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Active View Content */}
        <div
          ref={workspaceRef}
          // Berganti halaman = isi memudar masuk. Tab dalam satu menu (Dokumen / Penjualan) tidak memuat ulang
          // wadah ini, supaya penanda tab bisa bergeser mulus.
          key={`${
            ['rekap-dokumen', 'inventaris', 'personel', 'alat'].includes(activeTab)
              ? 'dokumen'
              : PELANGGAN_TABS.includes(activeTab)
              ? 'penjualan'
              : activeTab
          }:${selectedProjectId ? 'detail' : ''}`}
          className="view-enter flex-1 p-5 md:p-7"
        >
          <Suspense fallback={<ViewLoading />}>
          {activeTab === 'overview' && (
            <DashboardOverview
              state={db}
              syncLabel={syncLabel}
              visibleProjects={layananProjects}
              myInspectorId={session.inspectorId || activeInspectorId}
              pjtName={session.pjtName || session.name}
              onOpenProject={handleOpenProject}
              onNavigate={handleNavigate}
            />
          )}

          {isDocEditor && docView && (
            <div className="space-y-4">
              <div className="no-print flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setDocView(null)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  ← Kembali ke Daftar Pekerjaan
                </button>
                {docProject && (
                  <span className="text-xs text-slate-600">
                    Proyek: <b className="text-slate-900">{docProject.no}</b> — {docProject.perusahaan}
                  </span>
                )}
              </div>
            <DocEditorSuite
              activeDoc={docView}
              onChangeDoc={(doc) => setDocView(doc)}
              suratTugas={db.suratTugas}
              suratJalan={db.suratJalan}
              jsa={db.jsa}
              projects={db.proj}
              inspectors={db.insp}
              tools={db.tools}
              readOnly={docEditorReadOnly}
              hideForm={db.role === 'direktur'}
              currentUserName={session.name}
              docArchives={db.docArchives}
              onUpdateSuratTugas={(next) =>
                setDb((prev) => ({
                  ...prev,
                  suratTugas: next,
                  // Nama petugas JSA & Tool Keeper selalu mengikuti Surat Tugas
                  jsa: syncJsaWithSuratTugas(next, prev.jsa),
                }))
              }
              onUpdateSuratJalan={(next) => setDb((prev) => ({ ...prev, suratJalan: next }))}
              onUpdateJsa={(next) => setDb((prev) => ({ ...prev, jsa: next }))}
              onSaveDocArchive={handleSaveDocArchive}
              onOpenRekapDokumen={() => setActiveTab('rekap-dokumen')}
              onToast={showToast}
              signatures={db.signatures || {}}
              wizard={
                (db.role === 'inspektor' || db.role === 'pjt') &&
                !docEditorReadOnly &&
                Boolean(linkedStProject) &&
                (!linkedStProject?.prepReview || linkedStProject.prepReview.status === 'revision')
              }
              onWizardSave={handleWizardSave}
              onWizardFinish={() => {
                if (linkedStProject) setSelectedProjectId(linkedStProject.id);
                setDocView(null);
                showToast('Ketiga dokumen tersimpan — kirim ke PJT dari halaman proyek');
              }}
            />
            </div>
          )}

          {activeTab === 'akun' && db.role === 'teknis' && (
            <KelolaAkun
              inspectors={db.insp.map((i) => ({ id: i.id, nama: i.nama }))}
              currentUsername={session.username}
              onToast={showToast}
            />
          )}

          {activeTab === 'inventaris' && (
            <>
            <DokumenTabs active="inventaris" tabs={dokumenTabs} onChange={(id) => setActiveTab(id)} />
            <InventarisPerusahaan
              role={db.role}
              userName={session.name}
              docs={db.companyDocs}
              inspectors={db.insp}
              onAdd={(doc: CompanyDoc) => setDb((prev) => ({ ...prev, companyDocs: [doc, ...prev.companyDocs] }))}
              onDelete={(id) =>
                setDb((prev) => ({ ...prev, companyDocs: prev.companyDocs.filter((d) => d.id !== id) }))
              }
              onToast={showToast}
            />
            </>
          )}

          {activeTab === 'layanan-slo' && (
            <LayananSlo
              projects={layananProjects}
              role={db.role}
              inspectorId={session.inspectorId || activeInspectorId}
              userName={session.name}
              inspectors={db.insp}
              onUpdateProject={handleUpdateProject}
              onOpenProject={handleOpenProject}
              onToast={showToast}
            />
          )}

          {activeTab === 'panduan' && <PanduanMenu role={db.role} />}
          {activeTab === 'aplikasi' && <AplikasiMenu />}

          {PELANGGAN_TABS.includes(activeTab) && (
            <PenjualanBar
              activeTab={activeTab}
              canAccess={(t) => TAB_ACCESS[db.role].includes(t)}
              onNavigate={(t) => handleNavigate(t)}
            />
          )}

          {activeTab === 'input-pelanggan' && (
            <InputPelanggan
              key={editingPelangganId ?? 'baru'}
              records={db.pelanggan}
              editingId={editingPelangganId}
              onSave={handleSavePelanggan}
              onBack={() => handleNavigate('data-pelanggan')}
              onToast={showToast}
            />
          )}

          {activeTab === 'input-penawaran' && (
            <InputPenawaran
              key={editingPenawaranId ?? 'baru'}
              records={db.suratPenawaran}
              pelanggan={db.pelanggan}
              editingId={editingPenawaranId}
              onSave={handleSavePenawaran}
              onAddPelanggan={handleAddPelangganQuick}
              onBack={() => handleNavigate('data-penawaran')}
              onToast={showToast}
            />
          )}

          {activeTab === 'data-penawaran' && (
            <DataPenawaran
              toolbarAction={<TombolTambah label="Buat Penawaran" onClick={() => handleNavigate('input-penawaran')} />}
              records={db.suratPenawaran}
              pelanggan={db.pelanggan}
              signatures={db.signatures}
              onEdit={(id) => {
                setEditingPenawaranId(id);
                setActiveTab('input-penawaran');
              }}
              onDelete={handleDeletePenawaran}
              onDuplicate={handleDuplicatePenawaran}
              onToast={showToast}
            />
          )}

          {activeTab === 'input-sales-order' && (
            <CreateOrder
              penawaran={db.suratPenawaran}
              pelanggan={db.pelanggan}
              salesOrders={db.joSoRecords}
              onSave={(rec) => handleSaveSalesOrder(rec, true)}
              onToast={showToast}
            />
          )}

          {activeTab === 'data-sales-order' && (
            <DataSalesOrder
              toolbarAction={
                TAB_ACCESS[db.role].includes('input-sales-order') ? (
                  <TombolTambah label="Create Order" onClick={() => handleNavigate('input-sales-order')} />
                ) : undefined
              }
              readOnly={db.role === 'direktur'}
              records={db.joSoRecords}
              pelanggan={db.pelanggan}
              projects={db.proj}
              signatures={db.signatures}
              onSave={(rec) => handleSaveSalesOrder(rec, false)}
              onDelete={handleDeleteSalesOrder}
              onToast={showToast}
            />
          )}

          {activeTab === 'data-pelanggan' && (
            <DataPelanggan
              toolbarAction={<TombolTambah label="Tambah Pelanggan" onClick={() => handleNavigate('input-pelanggan')} />}
              records={db.pelanggan}
              onEdit={(id) => {
                setEditingPelangganId(id);
                setActiveTab('input-pelanggan');
              }}
              onDelete={handleDeletePelanggan}
            />
          )}

          {activeTab === 'rekap-dokumen' && (
            <>
            <DokumenTabs active="rekap-dokumen" tabs={dokumenTabs} onChange={(id) => setActiveTab(id)} />
            <RekapDokumen
              role={db.role}
              readOnly={db.role === 'direktur' || db.role === 'sales'}
              archives={db.docArchives}
              projects={db.proj}
              onUploadSignedScan={handleUploadSignedScan}
              onOpenArchiveInEditor={handleOpenArchiveInEditor}
              onOpenProject={handleOpenProject}
              onDeleteArchive={handleDeleteDocArchive}
              onToast={showToast}
            />
            </>
          )}

          {activeTab === 'proyek' && !isDocEditor && !selectedProjectId && (
            <DaftarPekerjaan
              role={db.role}
              records={db.joSoRecords}
              projects={db.proj}
              visibleProjects={layananProjects}
              inspectors={db.insp}
              pjtName={session.pjtName || session.name}
              myInspectorId={session.inspectorId || activeInspectorId}
              onPilihPekerjaan={handlePilihPekerjaan}
              onTunjukLeader={handleTunjukLeader}
              onOpenProject={handleOpenProject}
              onLayananSlo={handleOpenLayananSlo}
            />
          )}

          {((activeTab === 'proyek' && !isDocEditor && selectedProjectId) || activeTab === 'profil') && (
            <ProjectWorkflow
              mode={activeTab}
              role={db.role}
              session={session}
              state={db}
              selectedProjectId={selectedProjectId}
              activeInspectorId={activeInspectorId}
              onSelectInspector={setActiveInspectorId}
              onSelectProject={setSelectedProjectId}
              onUpdateProject={handleUpdateProject}
              onOpenProjectDocInEditor={handleOpenProjectDocInEditor}
              onApplyTteToEditors={handleApplyTteToEditors}
              onOpenLayananSlo={handleOpenLayananSlo}
              onUploadSignedScan={handleUploadSignedScan}
              onToast={showToast}
            />
          )}

          {(activeTab === 'peringatan' || activeTab === 'personel' || activeTab === 'alat') && (
            <>
            {activeTab !== 'peringatan' && <DokumenTabs active={activeTab} tabs={dokumenTabs} onChange={(id) => setActiveTab(id)} />}
            <ResourcesManager
              mode={activeTab}
              inspectors={db.insp}
              tools={db.tools}
              paidProjectsCount={db.proj.filter((p) => p.status === 'paid').length}
              signatures={db.signatures || {}}
              onSetSignature={(name, dataUrl) =>
                setDb((prev) => {
                  const next = { ...(prev.signatures || {}) };
                  if (dataUrl) next[name] = dataUrl;
                  else delete next[name];
                  return { ...prev, signatures: next };
                })
              }
              canEdit={db.role === 'teknis'}
              companyDocs={db.companyDocs}
              userName={session.name}
              onUpdateInspector={(id, patch) => {
                setDb((prev) => {
                  const before = prev.insp.find((i) => i.id === id);
                  const renamed = before && patch.nama && patch.nama !== before.nama ? patch.nama : null;
                  let signatures = prev.signatures;
                  if (renamed && before && signatures && signatures[before.nama]) {
                    // TTD di Database TTD memakai nama sebagai kunci: ikut dipindahkan ke nama baru
                    const { [before.nama]: sig, ...rest } = signatures;
                    signatures = { ...rest, [renamed]: sig };
                  }
                  return {
                    ...prev,
                    signatures,
                    insp: prev.insp.map((i) => (i.id === id ? { ...i, ...patch } : i)),
                    companyDocs: renamed
                      ? prev.companyDocs.map((d) =>
                          d.inspectorId === id ? { ...d, title: `${d.category} – ${renamed}` } : d
                        )
                      : prev.companyDocs,
                  };
                });
              }}
              onAddInspector={(ins, docs) => {
                setDb((prev) => ({
                  ...prev,
                  insp: [...prev.insp, ins],
                  companyDocs: [...docs, ...prev.companyDocs],
                }));
              }}
              onAttachCertDoc={handleAttachCertDoc}
              onRemoveCertDoc={(inspectorId, kind) => {
                setDb((prev) => {
                  const field = kind === 'skttk' ? 'serkomDocId' : 'k3DocId';
                  const oldId = prev.insp.find((i) => i.id === inspectorId)?.[field];
                  if (!oldId) return prev;
                  const old = prev.companyDocs.find((d) => d.id === oldId);
                  if (old) void deleteVaultFile(old.vaultFileId);
                  return {
                    ...prev,
                    insp: prev.insp.map((i) => (i.id === inspectorId ? { ...i, [field]: undefined } : i)),
                    companyDocs: prev.companyDocs.filter((d) => d.id !== oldId),
                  };
                });
                showToast('File sertifikat dihapus');
              }}
              onUpdateToolDate={(id, value) => {
                setDb((prev) => ({
                  ...prev,
                  tools: prev.tools.map((t) => (t.id === id ? { ...t, cal: value } : t)),
                }));
              }}
              onAddTool={(tool) => {
                setDb((prev) => ({ ...prev, tools: [...prev.tools, tool] }));
              }}
              onToast={showToast}
            />
            </>
          )}
          </Suspense>
        </div>
        {!isDocEditor && (
          <footer className="no-print px-5 md:px-7 pb-5 pt-1 text-center text-[11px] text-slate-400">
            Design by <span className="font-semibold text-slate-500">Bagus Indra</span>
          </footer>
        )}
      </main>

      {changePwOpen && <GantiPasswordModal onClose={() => setChangePwOpen(false)} onToast={showToast} />}

      {idle.secondsLeft !== null && (
        <IdleWarningModal
          secondsLeft={idle.secondsLeft}
          onStay={idle.stayActive}
          onLogout={() => void handleLogout()}
        />
      )}

      {/* Reset Demo Data Confirmation Modal (no window.confirm) */}
      {confirmResetOpen && (
        <div className="no-print fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="font-display text-lg font-extrabold text-slate-900">
              Reset atau Muat Data Contoh?
            </h3>
            <p className="text-sm text-slate-600">
              Reset penuh mengembalikan proyek, personel, alat uji, dokumen, pelanggan, penawaran, dan sales order ke data contoh awal. Perubahan ikut tersimpan otomatis ke server, sehingga data asli di server akan tertimpa.
            </p>
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmResetOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void handleLoadContohPenjualan()}
                className="px-4 py-2 rounded-xl border border-violet-200 bg-violet-50 text-sm font-semibold text-violet-700 hover:bg-violet-100"
              >
                Muat contoh Pelanggan, Penawaran &amp; SO saja
              </button>
              <button
                type="button"
                onClick={() => void handleResetDemoData()}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold"
              >
                Ya, Reset Data
              </button>
            </div>
          </div>
        </div>
      )}

      {panduanOpen && (
        <div
          className="no-print fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-start justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Panduan singkat"
          onClick={() => setPanduanOpen(false)}
        >
          <div className="w-full max-w-4xl my-6 rounded-2xl bg-slate-50 border border-slate-200 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-3 bg-white rounded-t-2xl border-b border-slate-200">
              <h3 className="font-display text-base font-extrabold text-slate-900">Panduan singkat</h3>
              <button
                type="button"
                onClick={() => setPanduanOpen(false)}
                className="px-3 h-8 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Tutup
              </button>
            </div>
            <div className="p-5">
              <Suspense fallback={<ViewLoading />}>
                <PanduanMenu role={db.role} />
              </Suspense>
            </div>
          </div>
        </div>
      )}

      {/* Non-intrusive Toast Notification */}
      {toastMsg && (
        <div key={toastMsg} role="status" className="toast-in no-print fixed bottom-5 right-5 z-50 flex items-center gap-2.5 bg-[#0F172A] text-white text-sm font-medium px-4 py-3 rounded-xl shadow-xl border border-white/10">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
