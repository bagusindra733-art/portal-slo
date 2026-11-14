import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  Truck,
  ShieldAlert,
  Users,
  Wrench,
  BellRing,
  FilePlus2,
  Building2,
  FileSpreadsheet,
  LogOut,
  RotateCcw,
  Trophy,
  Menu,
  X,
  Printer,
  CheckCircle2,
  Briefcase,
  Archive,
} from 'lucide-react';
import {
  ALAT_PILIHAN,
  AppDatabaseState,
  DOC_CONFIG,
  DocArchiveRecord,
  JENIS_ST,
  JenisSTKey,
  JoSoRecord,
  JsaData,
  MAX_FILE_BYTES,
  PORTAL_ACCOUNTS,
  Project,
  ROLE_LABELS,
  Role,
  SavedDocType,
  SheetsSyncMeta,
  SignedScanMeta,
  SuratJalanData,
  SuratTugasData,
  UserSession,
} from './types/portal';
import {
  computeAlerts,
  formatFileSize,
  isSamePersonName,
  isoToday,
  SAVED_DOC_LABELS,
  seedDatabase,
  syncJoSoToProject,
  syncProjectToJoSo,
} from './utils/portalUtils';
import { blobToDataUrl, deleteVaultFile, putVaultFile } from './utils/fileVault';
import { printWithPdfFallback } from './utils/pdfExport';
import { googleSignIn, initAuth, logoutGoogle } from './services/auth';
import { LoginView } from './components/LoginView';
import { DashboardOverview } from './components/DashboardOverview';
import { DocEditorSuite, DocTab } from './components/DocEditorSuite';
import { ProjectWorkflow } from './components/ProjectWorkflow';
import { ResourcesManager } from './components/ResourcesManager';
import { SheetsDatabaseModal } from './components/SheetsDatabaseModal';
import { JoSoManager } from './components/JoSoManager';
import { RekapDokumen } from './components/RekapDokumen';

type ActiveTab =
  | 'overview'
  | 'proyek'
  | 'rekap-sojo'
  | 'surat-tugas'
  | 'surat-jalan'
  | 'jsa'
  | 'rekap-dokumen'
  | 'personel'
  | 'alat'
  | 'peringatan'
  | 'baru'
  | 'profil';

const STORAGE_DB_KEY = 'portal-slo-react-v1';
const STORAGE_META_KEY = 'portal-slo-sheets-meta-v1';

const DEFAULT_SHEETS_META: SheetsSyncMeta = {
  spreadsheetId: '',
  spreadsheetTitle: '',
  spreadsheetUrl: '',
  lastSyncAt: null,
  syncStatus: 'disconnected',
};

function loadInitialDatabase(): AppDatabaseState {
  try {
    const raw = localStorage.getItem(STORAGE_DB_KEY);
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
        };
      }
    }
  } catch {
    // Fallback to clean seed
  }
  return seedDatabase();
}

function loadInitialSheetsMeta(): SheetsSyncMeta {
  try {
    const raw = localStorage.getItem(STORAGE_META_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SheetsSyncMeta>;
      return {
        ...DEFAULT_SHEETS_META,
        ...parsed,
        syncStatus: parsed.spreadsheetId ? 'connected' : 'disconnected',
      };
    }
  } catch {
    // Ignore storage error
  }
  return DEFAULT_SHEETS_META;
}

const TAB_META: Record<ActiveTab, { title: string; subtitle: string }> = {
  overview: {
    title: 'OVERVIEW',
    subtitle: 'Ringkasan Operasional, Kesiapan Personel & Statistik SLO',
  },
  proyek: {
    title: 'MENU PEKERJAAN & TUGAS',
    subtitle: 'Menu Pekerjaan, Pesan Sales & Alur Kerja Uji Laik Operasi (RFQ hingga SLO)',
  },
  'rekap-sojo': {
    title: 'REKAP & EDIT SO / JO',
    subtitle: 'Manajemen Penawaran, Job Order / Sales Order & Pesan ke Admin (Sales & Review Direktur)',
  },
  'surat-tugas': {
    title: 'SURAT TUGAS',
    subtitle: 'Editor & Output PDF Resmi PT. Sabda Duta Paramitha (Format A4)',
  },
  'surat-jalan': {
    title: 'SURAT JALAN ALAT',
    subtitle: 'Daftar Peralatan Pengujian & Kendaraan Operasional Lapangan',
  },
  jsa: {
    title: 'JOB SAFETY ANALYSIS',
    subtitle: 'Identifikasi Bahaya, APD & Kesiapan Keselamatan Kerja (JSA)',
  },
  'rekap-dokumen': {
    title: 'REKAP DOKUMEN & SCAN TTD',
    subtitle: 'Arsip PDF Surat Tugas, Surat Jalan Alat, JSA & Upload Scan TTD Manual Tenaga Teknik',
  },
  personel: {
    title: 'PERSONEL & TTK',
    subtitle: 'Sertifikat Kompetensi (Serkom) & Sertifikat K3 Inspektor',
  },
  alat: {
    title: 'ALAT UJI & KALIBRASI',
    subtitle: 'Inventaris Alat Ukur Lapangan & Masa Berlaku Kalibrasi',
  },
  peringatan: {
    title: 'PERINGATAN MASA BERLAKU',
    subtitle: 'Pemantauan H-60, H-30, H-7 & Penguncian Otomatis Kedaluwarsa',
  },
  baru: {
    title: 'AJUKAN RFQ BARU',
    subtitle: 'Registrasi Permohonan Uji Laik Operasi & Berkas Persyaratan',
  },
  profil: {
    title: 'PROFIL LIT',
    subtitle: 'Identitas Lembaga Inspeksi Teknik & Ketentuan Layanan',
  },
};

export default function App() {
  const [db, setDb] = useState<AppDatabaseState>(loadInitialDatabase);
  const [sheetsMeta, setSheetsMeta] = useState<SheetsSyncMeta>(loadInitialSheetsMeta);
  const [session, setSession] = useState<UserSession | null>(null);
  // Access token is kept strictly in memory (never in localStorage/sessionStorage)
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [editingJoSoId, setEditingJoSoId] = useState<string | null>(null);
  const [activeInspectorId, setActiveInspectorId] = useState<string>('i1');
  const [sheetsModalOpen, setSheetsModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [printingGlobal, setPrintingGlobal] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
  };

  useEffect(() => {
    if (!toastMsg) return;
    const timer = setTimeout(() => setToastMsg(null), 3500);
    return () => clearTimeout(timer);
  }, [toastMsg]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_DB_KEY, JSON.stringify(db));
    } catch {
      // Ignore quota errors
    }
  }, [db]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_META_KEY, JSON.stringify(sheetsMeta));
    } catch {
      // Ignore quota errors
    }
  }, [sheetsMeta]);

  useEffect(() => {
    const unsubscribe = initAuth(
      (_user, token) => {
        setAccessToken(token);
      },
      (user) => {
        if (!user) {
          setAccessToken(null);
        }
      }
    );
    return () => unsubscribe();
  }, []);

  const alerts = useMemo(() => computeAlerts(db.insp, db.tools), [db.insp, db.tools]);

  const handleGoogleLogin = async () => {
    setAuthError(null);
    setGoogleLoading(true);
    try {
      const { user, accessToken: token } = await googleSignIn();
      setAccessToken(token);
      // Peran ditentukan dari email Google yang cocok dengan akun internal; selain itu menjadi Klien
      const email = (user.email || '').toLowerCase();
      const account = PORTAL_ACCOUNTS.find((a) => a.email.toLowerCase() === email);
      const role: Role = account?.role ?? 'klien';
      setDb((prev) => ({ ...prev, role }));
      setSession({
        mode: 'google',
        username: account?.username,
        name: account?.name || user.displayName || 'Pengguna Google',
        email: user.email || '',
        photoURL: user.photoURL || undefined,
        role,
        inspectorId: account?.inspectorId,
        pjtName: account?.pjtName,
      });
      if (account?.inspectorId) {
        setActiveInspectorId(account.inspectorId);
      }
      setActiveTab(role === 'klien' ? 'proyek' : 'overview');
      showToast(`Masuk dengan Google sebagai ${user.displayName || user.email} (${ROLE_LABELS[role]})`);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Gagal masuk dengan Google. Pastikan pop-up diizinkan dan coba lagi.';
      setAuthError(message);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleConnectFromModal = async () => {
    setGoogleLoading(true);
    try {
      const { user, accessToken: token } = await googleSignIn();
      setAccessToken(token);
      setSession((prev) =>
        prev
          ? {
              ...prev,
              mode: 'google',
              name: user.displayName || prev.name,
              email: user.email || prev.email,
              photoURL: user.photoURL || prev.photoURL,
            }
          : {
              mode: 'google',
              name: user.displayName || 'Pengguna Google',
              email: user.email || '',
              photoURL: user.photoURL || undefined,
              role: db.role,
            }
      );
      showToast('Akun Google terhubung untuk Google Sheets & Drive.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menghubungkan akun Google');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handlePortalLogin = (newSession: UserSession) => {
    setAuthError(null);
    setSession(newSession);
    setDb((prev) => ({ ...prev, role: newSession.role }));
    if (newSession.inspectorId) {
      setActiveInspectorId(newSession.inspectorId);
    }
    setActiveTab(newSession.role === 'klien' ? 'proyek' : 'overview');
    showToast(`Selamat datang, ${newSession.name}`);
  };

  const handleLogout = async () => {
    try {
      await logoutGoogle();
    } catch {
      // Ignore if not signed into Firebase
    }
    setAccessToken(null);
    setSession(null);
    setSelectedProjectId(null);
    setMobileMenuOpen(false);
  };

  useEffect(() => {
    if (activeTab === 'rekap-sojo' && db.role !== 'sales' && db.role !== 'direktur') {
      setActiveTab('proyek');
    }
    if (activeTab === 'baru' && db.role !== 'teknis' && db.role !== 'klien') {
      setActiveTab('proyek');
    }
  }, [activeTab, db.role]);

  const handleNavigate = (tab: string) => {
    if (tab === 'rekap-sojo' && db.role !== 'sales' && db.role !== 'direktur') {
      showToast('Akses Rekap & Edit JO / SO hanya tersedia untuk Sales & Review Direktur');
      return;
    }
    if (tab === 'baru' && db.role !== 'teknis' && db.role !== 'klien') {
      showToast('Pengajuan RFQ baru hanya dapat diinput oleh Admin atau Klien');
      return;
    }
    setActiveTab(tab as ActiveTab);
    if (tab !== 'proyek') {
      setSelectedProjectId(null);
    }
    setMobileMenuOpen(false);
  };

  const handleOpenProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    setActiveTab('proyek');
    setMobileMenuOpen(false);
  };

  const handleUpdateProject = (updated: Project) => {
    setDb((prev) => {
      const existingJoSo = prev.joSoRecords.find(
        (r) => r.id === updated.joSoId || r.projectId === updated.id
      );
      if (!existingJoSo) {
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

  const handleCreateProject = (created: Project) => {
    setDb((prev) => {
      const syncedJoSo = syncProjectToJoSo(created);
      const linkedProject: Project = { ...created, joSoId: syncedJoSo.id };
      return {
        ...prev,
        seq: prev.seq + 1,
        proj: [linkedProject, ...prev.proj],
        joSoRecords: [syncedJoSo, ...prev.joSoRecords],
      };
    });
    setSelectedProjectId(created.id);
    setActiveTab('proyek');
  };

  const handleOpenProjectDocInEditor = (project: Project, docTab: DocTab) => {
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
    const filteredTeamNames = teamNames.filter((n) => !isSamePersonName(n, nextPjt));

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
      tte: project.docTte?.suratTugas || db.suratTugas.tte,
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
            tte: project.docTte?.suratJalan || db.suratJalan.tte,
            updatedAt: nowIso,
          }
        : {
            ...db.suratJalan,
            tte: project.docTte?.suratJalan || db.suratJalan.tte,
            updatedAt: nowIso,
          };

    const nextJsa: JsaData = {
      ...db.jsa,
      suratTugasId: nextSt.id,
      ketua: leadName,
      pelaksana: teamNames.filter((n) => n !== leadName),
      tte: project.docTte?.jsa || db.jsa.tte,
      updatedAt: nowIso,
    };

    setDb((prev) => ({
      ...prev,
      suratTugas: nextSt,
      suratJalan: nextSj,
      jsa: nextJsa,
    }));
    setActiveTab(docTab);
    showToast(`Data proyek ${project.no} dimuat ke editor ${docTab.replace('-', ' ').toUpperCase()}`);
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

  const handleOpenJoSoEditor = (joSoId: string) => {
    if (db.role !== 'sales' && db.role !== 'direktur') {
      showToast('Akses JO / SO hanya untuk peran Sales & Review Direktur');
      return;
    }
    setEditingJoSoId(joSoId);
    setActiveTab('rekap-sojo');
    setMobileMenuOpen(false);
  };

  const handleCreateSuratTugasFromJoSo = (record: JoSoRecord) => {
    const rawAddr = record.pelangganAlamat || record.kepadaAlamat || '';
    const [pemilikPart, ...alamatRest] = rawAddr.split('|').map((s) => s.trim());
    const combinedInst = `${record.jenisInstalasiJo} ${record.jenisInstalasiPenawaran}`.toLowerCase();
    const jenisKey: JenisSTKey = combinedInst.includes('transmisi')
      ? 'transmisi'
      : combinedInst.includes('distribusi')
      ? 'distribusi'
      : combinedInst.includes('pemanfaatan')
      ? 'pemanfaatan'
      : 'pembangkit';
    const cfg = JENIS_ST[jenisKey];
    const today = isoToday();

    setDb((prev) => ({
      ...prev,
      suratTugas: {
        ...prev.suratTugas,
        jenisAktif: jenisKey,
        jenisPekerjaan: cfg.jenis,
        tipe: cfg.tipe,
        pemilik: pemilikPart || prev.suratTugas.pemilik,
        lokasi: alamatRest.join(' | ') || rawAddr || prev.suratTugas.lokasi,
        tgl: today,
        updatedAt: new Date().toISOString(),
      },
    }));
    setActiveTab('surat-tugas');
    showToast(`Data SO/JO "${record.title || record.poNo || record.noPenawaran}" dimuat ke Surat Tugas`);
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

    await putVaultFile({
      id: scanId,
      name: file.name,
      mimeType,
      size: file.size,
      dataUrl,
      savedAt: nowIso,
    });

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
    setActiveTab(rec.docType);
    setMobileMenuOpen(false);
    showToast(`Dokumen ${SAVED_DOC_LABELS[rec.docType]} (${rec.docNomor}) dibuka di editor`);
  };

  const handleResetDemoData = () => {
    const fresh = seedDatabase();
    setDb({ ...fresh, role: db.role });
    setSelectedProjectId(null);
    setConfirmResetOpen(false);
    showToast('Data portal dikembalikan ke contoh awal.');
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
        onGoogleLogin={handleGoogleLogin}
        onPortalLogin={handlePortalLogin}
        googleLoading={googleLoading}
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
    ...(db.role === 'sales' || db.role === 'direktur'
      ? [{ id: 'rekap-sojo' as ActiveTab, label: 'Rekap JO / SO', icon: Briefcase, badge: db.joSoRecords.length }]
      : []),
    { id: 'proyek', label: 'Menu Pekerjaan', icon: FolderKanban, badge: db.proj.length },
    { id: 'surat-tugas', label: 'Surat Tugas', icon: FileText },
    { id: 'surat-jalan', label: 'Surat Jalan Alat', icon: Truck },
    { id: 'jsa', label: 'JSA Keselamatan', icon: ShieldAlert },
    { id: 'rekap-dokumen', label: 'Rekap Dokumen', icon: Archive, badge: db.docArchives.length || undefined },
    { id: 'personel', label: 'Personel TTK', icon: Users },
    { id: 'alat', label: 'Alat Uji', icon: Wrench },
    { id: 'peringatan', label: 'Peringatan', icon: BellRing, badge: alerts.length || undefined },
    ...(db.role === 'teknis' || db.role === 'klien'
      ? [{ id: 'baru' as ActiveTab, label: 'Ajukan RFQ', icon: FilePlus2 }]
      : []),
    { id: 'profil', label: 'Profil LIT', icon: Building2 },
  ];

  const currentTabInfo = TAB_META[activeTab];
  const isDocEditor =
    activeTab === 'surat-tugas' || activeTab === 'surat-jalan' || activeTab === 'jsa';

  return (
    <div className="min-h-screen w-full bg-[#0B1221] flex flex-col lg:flex-row font-sans">
      {/* Mobile top bar */}
      <header className="no-print lg:hidden flex items-center justify-between px-4 py-3 bg-[#0B1221] text-white border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2563EB] to-[#3B82F6] flex items-center justify-center font-display font-extrabold text-sm">
            S
          </div>
          <div>
            <div className="font-display font-extrabold text-sm tracking-tight leading-none">
              PORTAL SLO
            </div>
            <div className="text-[10px] font-bold text-[#38BDF8] uppercase tracking-wider mt-0.5">
              PT. Sabda Duta Paramitha
            </div>
          </div>
        </div>
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
        } lg:flex flex-col w-full lg:w-64 xl:w-68 shrink-0 bg-[#0B1221] text-white px-4 py-6 justify-between border-b lg:border-b-0 border-white/10`}
      >
        <div>
          {/* Brand Header */}
          <div className="hidden lg:flex items-center gap-3 px-2 mb-7">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#38BDF8] flex items-center justify-center shadow-lg shadow-blue-600/30 shrink-0">
              <span className="font-display font-extrabold text-lg text-white">S</span>
            </div>
            <div className="min-w-0">
              <div className="font-display font-extrabold text-base tracking-tight text-white leading-tight">
                PORTAL SLO
              </div>
              <div className="text-[11px] font-bold text-[#38BDF8] tracking-wide uppercase truncate">
                PT. SABDA DUTA PARAMITHA
              </div>
            </div>
          </div>

          {/* Primary Navigation */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavigate(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white shadow-lg shadow-blue-600/30 font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <span className="flex items-center gap-3 truncate">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {typeof item.badge === 'number' && item.badge > 0 && (
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums ${
                        item.id === 'peringatan'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                          : isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-white/10 text-slate-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

            <div className="pt-2 mt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  setSheetsModalOpen(true);
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium text-emerald-300 hover:text-white hover:bg-emerald-500/15 transition-all"
              >
                <span className="flex items-center gap-3 truncate">
                  <FileSpreadsheet className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span className="truncate">Database Sheets</span>
                </span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    sheetsMeta.spreadsheetId ? 'bg-emerald-400' : 'bg-slate-500'
                  }`}
                />
              </button>
            </div>
          </nav>
        </div>

        {/* Bottom Quote / Mission Card & User Session Footer */}
        <div className="mt-6 space-y-3">
          <div className="rounded-2xl bg-[#111C33] border border-white/10 p-4 text-center">
            <div className="w-9 h-9 rounded-full bg-amber-500/15 border border-amber-400/30 flex items-center justify-center mx-auto mb-2.5">
              <Trophy className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              “Keselamatan kerja &amp; akurasi uji kelaikan operasi adalah fondasi keandalan sistem kelistrikan nasional.”
            </p>
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
              {currentTabInfo.title}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">{currentTabInfo.subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
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

            {/* Google Sheets Status Button */}
            <button
              type="button"
              onClick={() => setSheetsModalOpen(true)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                sheetsMeta.spreadsheetId
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">
                {sheetsMeta.spreadsheetId ? 'Sheets Terhubung' : 'Hubungkan Sheets'}
              </span>
            </button>

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
        <div ref={workspaceRef} className="flex-1 p-5 md:p-7">
          {activeTab === 'overview' && (
            <DashboardOverview
              state={db}
              sheetsMeta={sheetsMeta}
              onOpenProject={handleOpenProject}
              onNavigate={handleNavigate}
              onOpenSheetsModal={() => setSheetsModalOpen(true)}
            />
          )}

          {activeTab === 'rekap-sojo' && (
            <JoSoManager
              role={db.role}
              records={db.joSoRecords}
              projects={db.proj}
              initialEditId={editingJoSoId}
              onClearInitialEditId={() => setEditingJoSoId(null)}
              onSaveRecord={handleSaveJoSoRecord}
              onDeleteRecord={handleDeleteJoSoRecord}
              onOpenProject={handleOpenProject}
              onCreateSuratTugasFromJoSo={handleCreateSuratTugasFromJoSo}
              onToast={showToast}
            />
          )}

          {isDocEditor && (
            <DocEditorSuite
              activeDoc={activeTab as DocTab}
              onChangeDoc={(doc) => setActiveTab(doc)}
              suratTugas={db.suratTugas}
              suratJalan={db.suratJalan}
              jsa={db.jsa}
              projects={db.proj}
              inspectors={db.insp}
              tools={db.tools}
              readOnly={db.role === 'direktur'}
              currentUserName={session.name}
              docArchives={db.docArchives}
              onUpdateSuratTugas={(next) => setDb((prev) => ({ ...prev, suratTugas: next }))}
              onUpdateSuratJalan={(next) => setDb((prev) => ({ ...prev, suratJalan: next }))}
              onUpdateJsa={(next) => setDb((prev) => ({ ...prev, jsa: next }))}
              onSaveDocArchive={handleSaveDocArchive}
              onOpenRekapDokumen={() => setActiveTab('rekap-dokumen')}
              onToast={showToast}
            />
          )}

          {activeTab === 'rekap-dokumen' && (
            <RekapDokumen
              role={db.role}
              readOnly={db.role === 'direktur'}
              archives={db.docArchives}
              projects={db.proj}
              onUploadSignedScan={handleUploadSignedScan}
              onOpenArchiveInEditor={handleOpenArchiveInEditor}
              onOpenProject={handleOpenProject}
              onDeleteArchive={handleDeleteDocArchive}
              onToast={showToast}
            />
          )}

          {(activeTab === 'proyek' || activeTab === 'profil' || activeTab === 'baru') && (
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
              onCreateProject={handleCreateProject}
              onGoToBaru={() => setActiveTab('baru')}
              onOpenProjectDocInEditor={handleOpenProjectDocInEditor}
              onApplyTteToEditors={handleApplyTteToEditors}
              onOpenJoSoEditor={handleOpenJoSoEditor}
              onUploadSignedScan={handleUploadSignedScan}
              onToast={showToast}
            />
          )}

          {(activeTab === 'peringatan' || activeTab === 'personel' || activeTab === 'alat') && (
            <ResourcesManager
              mode={activeTab}
              inspectors={db.insp}
              tools={db.tools}
              paidProjectsCount={db.proj.filter((p) => p.status === 'paid').length}
              canEdit={db.role === 'teknis'}
              onUpdateInspectorDate={(id, field, value) => {
                setDb((prev) => ({
                  ...prev,
                  insp: prev.insp.map((i) => (i.id === id ? { ...i, [field]: value } : i)),
                }));
              }}
              onAddInspector={(ins) => {
                setDb((prev) => ({ ...prev, insp: [...prev.insp, ins] }));
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
          )}
        </div>
      </main>

      {/* Google Sheets Database Sync Modal */}
      <SheetsDatabaseModal
        isOpen={sheetsModalOpen}
        onClose={() => setSheetsModalOpen(false)}
        accessToken={accessToken}
        sheetsMeta={sheetsMeta}
        state={db}
        readOnly={db.role === 'direktur'}
        onGoogleLoginRequest={handleGoogleConnectFromModal}
        onUpdateMeta={setSheetsMeta}
        onReplaceState={(next) => setDb(next)}
        onToast={showToast}
      />

      {/* Reset Demo Data Confirmation Modal (no window.confirm) */}
      {confirmResetOpen && (
        <div className="no-print fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="font-display text-lg font-extrabold text-slate-900">
              Reset Data Portal ke Awal?
            </h3>
            <p className="text-sm text-slate-600">
              Tindakan ini akan mengembalikan proyek, personel, alat uji, serta dokumen Surat Tugas, Surat Jalan, dan JSA di penyimpanan lokal ke data contoh awal. Data yang sudah tersimpan di Google Sheets tidak berubah.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmResetOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleResetDemoData}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold"
              >
                Ya, Reset Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Non-intrusive Toast Notification */}
      {toastMsg && (
        <div className="no-print fixed bottom-5 right-5 z-50 flex items-center gap-2.5 bg-[#0F172A] text-white text-sm font-medium px-4 py-3 rounded-xl shadow-xl border border-white/10">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
