import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Printer,
  Download,
  Layers,
  RefreshCw,
  Plus,
  Trash2,
  Link2,
  Archive,
  CheckCircle2,
  Clock,
  FileText,
  Truck,
  ShieldAlert,
} from 'lucide-react';
import { LOGO } from '../constants/logos';
import {
  ALAT_PILIHAN,
  DOC_CONFIG,
  DocArchiveRecord,
  Inspector,
  JENIS_ST,
  JenisSTKey,
  JSA_ALAT,
  JSA_APD,
  JSA_BAHAYA,
  JSA_JENIS,
  JsaData,
  KENDARAAN_PILIHAN,
  MANUAL_KEY,
  Project,
  SATUAN_ALAT,
  KET_PILIHAN,
  SuratJalanData,
  SuratJalanItem,
  SuratTugasData,
  Tool,
} from '../types/portal';
import {
  formatDateTime,
  formatJsaNomor,
  formatSuratJalanNomor,
  formatSuratTugasNomor,
  formatTanggal,
  instalasiTeks,
  certStatus,
  findSignature,
  isSamePersonName,
  isoToday,
  suratJalanPetugas,
  suratTugasPetugas,
  syncJsaWithSuratTugas,
} from '../utils/portalUtils';
import { exportElementToPdf, PdfExportResult, printWithPdfFallback } from '../utils/pdfExport';
import { putVaultFile } from '../utils/fileVault';
import { SignatureImg } from './SignatureImg';

export type DocTab = 'surat-tugas' | 'surat-jalan' | 'jsa';

interface DocEditorSuiteProps {
  activeDoc: DocTab;
  readOnly?: boolean;
  currentUserName?: string;
  docArchives?: DocArchiveRecord[];
  onChangeDoc: (doc: DocTab) => void;
  suratTugas: SuratTugasData;
  suratJalan: SuratJalanData;
  jsa: JsaData;
  projects: Project[];
  inspectors: Inspector[];
  tools: Tool[];
  onUpdateSuratTugas: (next: SuratTugasData) => void;
  onUpdateSuratJalan: (next: SuratJalanData) => void;
  onUpdateJsa: (next: JsaData) => void;
  onSaveDocArchive?: (record: DocArchiveRecord) => void;
  onOpenRekapDokumen?: () => void;
  onToast: (msg: string) => void;
  /** Database TTD (nama -> data URL gambar). */
  signatures?: Record<string, string>;
  /** Mode alur Leader: Surat Tugas → Surat Jalan Alat → JSA → kirim ke PJT. */
  wizard?: boolean;
  /** Dipanggil setelah tiap langkah wizard tersimpan (sinkron tim & alat ke proyek). */
  onWizardSave?: () => void;
  /** Dipanggil setelah JSA tersimpan (kembali ke halaman proyek untuk kirim ke PJT). */
  onWizardFinish?: () => void;
}

const BULAN_NUMS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const TAHUN_NUMS = Array.from({ length: 101 }, (_, i) => String(2000 + i));
const QTY_NUMS = Array.from({ length: 20 }, (_, i) => String(i + 1));
const NAMA_PDF: Record<DocTab, string> = {
  'surat-tugas': '1. Surat Tugas',
  'surat-jalan': '2. Surat Jalan Alat',
  jsa: '3. JSA',
};

export function DocEditorSuite({
  activeDoc,
  readOnly = false,
  currentUserName = 'Pengguna Portal',
  docArchives = [],
  onChangeDoc,
  suratTugas,
  suratJalan,
  jsa,
  projects,
  inspectors,
  tools,
  onUpdateSuratTugas,
  onUpdateSuratJalan,
  onUpdateJsa,
  onSaveDocArchive,
  onOpenRekapDokumen,
  onToast,
  signatures,
  wizard = false,
  onWizardSave,
  onWizardFinish,
}: DocEditorSuiteProps) {
  const [modalJenisOpen, setModalJenisOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [stageZoom, setStageZoom] = useState(1);
  const stageRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLElement>(null);

  // Combine CONFIG names + PJT dual-role + live inspectors, excluding active PJT
  const allTenagaTeknik = useMemo(() => {
    const set = new Set([
      ...DOC_CONFIG.tenagaTeknik,
      ...DOC_CONFIG.pjt,
      ...inspectors.map((i) => i.nama),
    ]);
    return Array.from(set).filter((n) => !isSamePersonName(n, suratTugas.pjt));
  }, [inspectors, suratTugas.pjt]);

  // Nama di JSA & Surat Jalan hanya berasal dari Tenaga Teknik yang tercantum di Surat Tugas
  const stPetugas = useMemo(() => suratTugas ? suratTugasPetugas(suratTugas) : [], [suratTugas]);
  const allJsaNames = stPetugas;
  // Surat Jalan: hanya Leader (bila Leader = Tool Keeper tetap, diganti anggota Surat Tugas)
  const sjPetugas = suratTugas ? suratJalanPetugas(suratTugas) : '';

  // Responsive paper zoom inside stage
  useEffect(() => {
    const updateZoom = () => {
      if (!stageRef.current) return;
      const w = stageRef.current.clientWidth;
      if (w > 0) {
        setStageZoom(Math.min(1, (w - 8) / 794));
      }
    };
    updateZoom();
    window.addEventListener('resize', updateZoom);
    return () => window.removeEventListener('resize', updateZoom);
  }, [activeDoc]);

  // Samakan data lama: ketua/pelaksana JSA & Tool Keeper mengikuti Surat Tugas
  useEffect(() => {
    if (readOnly) return;
    const syncedJsa = syncJsaWithSuratTugas(suratTugas, jsa);
    if (syncedJsa !== jsa) onUpdateJsa(syncedJsa);
    // Tool Keeper permanen
    if (suratJalan.keeper !== DOC_CONFIG.toolKeeper) {
      onUpdateSuratJalan({ ...suratJalan, keeper: DOC_CONFIG.toolKeeper, updatedAt: new Date().toISOString() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, stPetugas, jsa.ketua, jsa.pelaksana, suratJalan.keeper]);

  const stNomor = formatSuratTugasNomor(suratTugas);
  const sjNomor = formatSuratJalanNomor(suratTugas);
  const jsaNomor = formatJsaNomor(suratTugas);
  const stInstalasi = instalasiTeks(suratTugas);
  const stCfg = JENIS_ST[suratTugas.jenisAktif];
  // Tanda tangan Surat Tugas hanya Direktur Utama
  const stPenanda = DOC_CONFIG.penandatangan[0];
  const sjPenanda = DOC_CONFIG.penandatangan[suratJalan.ttdIdx] || DOC_CONFIG.penandatangan[1] || DOC_CONFIG.penandatangan[0];

  const currentDocNomor =
    activeDoc === 'surat-tugas' ? stNomor : activeDoc === 'surat-jalan' ? sjNomor : jsaNomor;

  const existingArchive = useMemo(
    () =>
      docArchives.find(
        (d) =>
          d.docType === activeDoc &&
          d.docNomor === currentDocNomor &&
          (d.projectId || null) === (suratTugas.projectId || null)
      ) ||
      docArchives.find((d) => d.docType === activeDoc && d.docNomor === currentDocNomor),
    [docArchives, activeDoc, currentDocNomor, suratTugas.projectId]
  );

  const getPdfFilename = () => {
    const cleanNomor = currentDocNomor.replace(/[\\/:*?"<>|]+/g, '-').trim();
    return `${NAMA_PDF[activeDoc]}${cleanNomor ? ` ${cleanNomor}` : ''}`;
  };

  /** Mengembalikan false bila PDF gagal tersimpan di server dokumen (hanya tersimpan lokal). */
  const persistPdfToArchive = async (
    action: 'saved_pdf' | 'printed',
    pdfResult?: PdfExportResult,
    { quietSyncWarning = false }: { quietSyncWarning?: boolean } = {}
  ): Promise<boolean> => {
    if (!onSaveDocArchive) return true;
    let serverOk = true;
    const nowIso = new Date().toISOString();
    const linkedProject = suratTugas.projectId
      ? projects.find((p) => p.id === suratTugas.projectId)
      : undefined;

    const archiveId =
      existingArchive?.id || `doc-${activeDoc}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const vaultPdfId = pdfResult
      ? existingArchive?.vaultPdfId || `vault-pdf-${archiveId}`
      : existingArchive?.vaultPdfId;

    if (pdfResult && vaultPdfId) {
      const synced = await putVaultFile({
        id: vaultPdfId,
        name: pdfResult.filename,
        mimeType: 'application/pdf',
        size: pdfResult.size,
        dataUrl: pdfResult.dataUrl,
        savedAt: nowIso,
        folder: activeDoc,
      });
      if (!synced) {
        serverOk = false;
        if (!quietSyncWarning) {
          onToast('PDF tersimpan di perangkat ini saja — server dokumen tidak terjangkau.');
        }
      }
    }

    const projectTte = linkedProject?.docTte;
    const tteEnabled = Boolean(
      activeDoc === 'surat-tugas'
        ? projectTte?.suratTugas?.enabled
        : activeDoc === 'surat-jalan'
        ? projectTte?.suratJalan?.enabled
        : projectTte?.jsa?.enabled
    );

    const personnelList =
      activeDoc === 'jsa'
        ? Array.from(new Set([jsa.ketua, ...jsa.pelaksana].map((s) => s.trim()).filter(Boolean)))
        : suratTugas.tenagaTeknik.map((s) => s.trim()).filter(Boolean);

    const record: DocArchiveRecord = {
      id: archiveId,
      docType: activeDoc,
      docNomor: currentDocNomor,
      fileName: pdfResult?.filename || `${getPdfFilename()}.pdf`,
      fileSize: pdfResult?.size || existingArchive?.fileSize || 0,
      vaultPdfId,
      projectId: suratTugas.projectId || null,
      projectNo: linkedProject?.no,
      perusahaan: suratTugas.pemilik || linkedProject?.perusahaan || '-',
      lokasi: suratTugas.lokasi || linkedProject?.kota || '-',
      tanggalDokumen: suratTugas.tgl || isoToday(),
      penanggungJawab: suratTugas.pjt,
      tenagaTeknik: personnelList,
      tteEnabled,
      savedAt: nowIso,
      savedBy: currentUserName,
      printedAt: action === 'printed' ? nowIso : existingArchive?.printedAt,
      lastAction: action,
      manualScan:
        existingArchive?.manualScan || linkedProject?.signedScans?.[activeDoc] || undefined,
      snapshot: {
        suratTugas: { ...suratTugas },
        suratJalan: { ...suratJalan },
        jsa: { ...jsa },
      },
    };
    onSaveDocArchive(record);
    return serverOk;
  };

  // Wizard Leader: simpan ke server saja (tanpa mengunduh file), lalu lanjut ke langkah berikutnya.
  const handleSaveAndContinue = async () => {
    if (!paperRef.current || exportingPdf) return;
    setExportingPdf(true);
    try {
      const name = getPdfFilename();
      const result = await exportElementToPdf(paperRef.current, {
        filename: `${name}.pdf`,
        singlePageFit: true,
        skipDownload: true,
      });
      const serverOk = await persistPdfToArchive('saved_pdf', result, { quietSyncWarning: true });
      if (!serverOk) {
        onToast('Gagal menyimpan ke server — periksa koneksi/login lalu coba lagi. Belum lanjut ke langkah berikutnya.');
        return;
      }
      onToast(`"${name}" tersimpan di server`);
      onWizardSave?.();
      if (activeDoc === 'surat-tugas') onChangeDoc('surat-jalan');
      else if (activeDoc === 'surat-jalan') onChangeDoc('jsa');
      else onWizardFinish?.();
    } catch (err: unknown) {
      onToast(err instanceof Error ? err.message : 'Gagal menyimpan dokumen');
    } finally {
      setExportingPdf(false);
    }
  };

  // Direct A4 PDF file download + store binary & metadata into Database (Rekap Dokumen)
  const handleDownloadPdf = async (after?: () => void) => {
    if (!paperRef.current || exportingPdf) return;
    setExportingPdf(true);
    try {
      const name = getPdfFilename();
      const result = await exportElementToPdf(paperRef.current, {
        filename: `${name}.pdf`,
        singlePageFit: true,
      });
      await persistPdfToArchive('saved_pdf', result);
      onToast(`PDF "${name}.pdf" diunduh & disimpan ke Rekap Dokumen`);
      after?.();
    } catch (err: unknown) {
      onToast(err instanceof Error ? err.message : 'Gagal membuat file PDF');
    } finally {
      setExportingPdf(false);
    }
  };

  // Auto-fit 1 page A4 print with automatic PDF download fallback & archive save
  const handlePrintPdf = async () => {
    if (exportingPdf) return;
    const docFilename = `${getPdfFilename()}.pdf`;
    setExportingPdf(true);
    try {
      const res = await printWithPdfFallback({
        element: paperRef.current,
        filename: docFilename,
        singlePageFit: true,
        captureArchiveEvenIfPrinted: true,
        prepareBeforePrint: () => {
          const prevTitle = document.title;
          document.title = getPdfFilename();
          const paper = paperRef.current;
          if (paper) {
            const HP = 1120;
            const prevZoom = paper.style.zoom;
            paper.style.zoom = '1';
            let h = paper.scrollHeight;
            if (activeDoc === 'surat-tugas') h += 90;
            const z = Math.min(1, HP / Math.max(h, HP));
            paper.style.setProperty('--print-zoom', String(z));
            paper.style.zoom = prevZoom;
          }
          return () => {
            document.title = prevTitle;
            if (paper) paper.style.removeProperty('--print-zoom');
          };
        },
        onFallbackToPdf: () => {
          onToast(`Mode preview membatasi cetak — mengunduh & menyimpan "${docFilename}"`);
        },
      });
      await persistPdfToArchive('printed', res.pdf);
      if (res.mode === 'printed') {
        onToast(`Dokumen "${currentDocNomor}" dicetak & tercatat di Rekap Dokumen`);
      }
    } catch (err: unknown) {
      onToast(err instanceof Error ? err.message : 'Gagal mencetak / mengunduh PDF');
    } finally {
      setExportingPdf(false);
    }
  };

  // Switch Jenis Surat Tugas (Pembangkit / Transmisi / Distribusi / Pemanfaatan)
  const applyJenisST = (jenisId: JenisSTKey) => {
    const cfg = JENIS_ST[jenisId];
    onUpdateSuratTugas({
      ...suratTugas,
      jenisAktif: jenisId,
      jenisPekerjaan: cfg.jenis,
      tipe: cfg.tipe,
      tipeManual: '',
      unit: String(cfg.unit),
      kap: String(cfg.kap),
      satuan: cfg.satuan,
      updatedAt: new Date().toISOString(),
    });
    setModalJenisOpen(false);
    onChangeDoc('surat-tugas');
    onToast(`Jenis Surat Tugas diubah ke ${cfg.nama}`);
  };

  // Sync from Portal SLO project
  const handleImportFromProject = (projectId: string) => {
    const p = projects.find((x) => x.id === projectId);
    if (!p) return;

    const jenisMap: Record<Project['jenis'], JenisSTKey> = {
      Pembangkit: 'pembangkit',
      TT: 'transmisi',
      TM: 'distribusi',
    };
    const jenisKey = jenisMap[p.jenis] || 'pembangkit';
    const cfg = JENIS_ST[jenisKey];
    const capMatch = p.kap.match(/(\d+(?:[.,]\d+)?)/);
    const unitMatch = p.kap.match(/(\d+)\s*[xX]\s*(\d+)/);

    const assignedNames = (p.team?.ins || [])
      .map((id) => inspectors.find((i) => i.id === id)?.nama || '')
      .filter(Boolean);

    const leadName =
      inspectors.find((i) => i.id === p.team?.lead)?.nama ||
      assignedNames[0] ||
      suratTugas.tenagaTeknik[0] ||
      '';

    const tipeCandidate = cfg.tipeOpsi.includes(p.sub) ? p.sub : MANUAL_KEY;
    const satuanCandidate =
      cfg.satuanOpsi.find((s) => p.kap.toLowerCase().includes(s.toLowerCase())) || cfg.satuan;

    const seqNum = p.no.split('-').pop() || suratTugas.nomorUrut;

    const nextPjt = p.pjtName || suratTugas.pjt;
    // Kolom 1 = Leader, kolom 2, 3, dst = anggota
    const filteredAssigned = [
      ...(leadName && !isSamePersonName(leadName, nextPjt) ? [leadName] : []),
      ...assignedNames.filter(
        (n) => !isSamePersonName(n, nextPjt) && !isSamePersonName(n, leadName)
      ),
    ];

    onUpdateSuratTugas({
      ...suratTugas,
      projectId: p.id,
      jenisAktif: jenisKey,
      nomorUrut: seqNum,
      pjt: nextPjt,
      jenisPekerjaan: cfg.jenis,
      tipe: tipeCandidate,
      tipeManual: tipeCandidate === MANUAL_KEY ? p.sub : '',
      unit: unitMatch ? unitMatch[1] : '1',
      kap: unitMatch ? unitMatch[2] : capMatch ? capMatch[1] : String(cfg.kap),
      satuan: satuanCandidate,
      pemilik: p.perusahaan,
      lokasi: p.kota,
      tenagaTeknik: filteredAssigned.length ? filteredAssigned : suratTugas.tenagaTeknik.filter((n) => !isSamePersonName(n, nextPjt)),
      updatedAt: new Date().toISOString(),
    });

    // Also sync Surat Jalan Alat if project has assigned tools
    if (p.team?.tools.length) {
      const mappedItems: SuratJalanItem[] = [
        { id: `sj-${Date.now()}-0`, nama: 'Tas Koper', manualNama: '', jml: '1', unit: 'Unit', seri: '', ket: '-' },
        ...p.team.tools.map((tid, idx) => {
          const t = tools.find((x) => x.id === tid);
          const nama = t?.nama || '';
          const inList = ALAT_PILIHAN.includes(nama);
          return {
            id: `sj-${Date.now()}-${idx + 1}`,
            nama: inList ? nama : MANUAL_KEY,
            manualNama: inList ? '' : nama,
            jml: '1',
            unit: 'Unit',
            seri: t?.sn || '',
            ket: 'Didalam tas Koper',
          };
        }),
      ];
      onUpdateSuratJalan({
        ...suratJalan,
        items: mappedItems,
        updatedAt: new Date().toISOString(),
      });
    }

    // Also sync JSA team
    if (assignedNames.length) {
      onUpdateJsa({
        ...jsa,
        ketua: leadName,
        pelaksana: assignedNames.filter((n) => n !== leadName),
        updatedAt: new Date().toISOString(),
      });
    }

    onToast(`Data proyek ${p.no} (${p.perusahaan}) dimuat ke dokumen`);
  };

  // Update helpers
  const updateST = (patch: Partial<SuratTugasData>) => {
    onUpdateSuratTugas({ ...suratTugas, ...patch, updatedAt: new Date().toISOString() });
  };

  const updateSJ = (patch: Partial<SuratJalanData>) => {
    onUpdateSuratJalan({ ...suratJalan, ...patch, updatedAt: new Date().toISOString() });
  };

  const updateJSA = (patch: Partial<JsaData>) => {
    onUpdateJsa({ ...jsa, ...patch, updatedAt: new Date().toISOString() });
  };

  // ---- Sinkron alat Surat Jalan dengan inventaris Alat Uji & tim proyek pada Surat Tugas ----
  const itemMatchesTool = (it: SuratJalanItem, t: Tool) =>
    Boolean(t.sn) && it.seri.trim() === t.sn && (it.nama === t.nama || it.manualNama === t.nama);

  const toolToItem = (t: Tool, idx: number): SuratJalanItem => {
    const inList = ALAT_PILIHAN.includes(t.nama);
    return {
      id: `sj-t-${Date.now()}-${idx}-${t.id}`,
      nama: inList ? t.nama : MANUAL_KEY,
      manualNama: inList ? '' : t.nama,
      jml: '1',
      unit: 'Unit',
      seri: t.sn,
      ket: 'Didalam tas Koper',
    };
  };

  const toggleTool = (t: Tool) => {
    const exists = suratJalan.items.some((it) => itemMatchesTool(it, t));
    updateSJ({
      items: exists
        ? suratJalan.items.filter((it) => !itemMatchesTool(it, t))
        : [...suratJalan.items, toolToItem(t, suratJalan.items.length)],
    });
  };

  const linkedProject = suratTugas.projectId
    ? projects.find((x) => x.id === suratTugas.projectId)
    : undefined;
  const projectTeamTools = (linkedProject?.team?.tools || [])
    .map((tid) => tools.find((x) => x.id === tid))
    .filter((t): t is Tool => Boolean(t));

  const syncToolsFromProject = () => {
    updateSJ({
      items: [
        { id: `sj-t-${Date.now()}-bag`, nama: ALAT_PILIHAN[0], manualNama: '', jml: '1', unit: 'Unit', seri: '', ket: '-' },
        ...projectTeamTools.map(toolToItem),
      ],
    });
    onToast('Daftar alat Surat Jalan disamakan dengan alat tim proyek');
  };

  // PJT terisi otomatis dari pilihan Admin (tanpa input); TTD Surat Tugas hanya Direktur Utama
  useEffect(() => {
    if (readOnly) return;
    const pjtProyek = (linkedProject?.pjtName || '').trim();
    const patch: Partial<SuratTugasData> = {};
    if (pjtProyek && suratTugas.pjt.trim() !== pjtProyek) patch.pjt = pjtProyek;
    if (suratTugas.penandatanganIdx !== 0) patch.penandatanganIdx = 0;
    const pjtAktif = pjtProyek || suratTugas.pjt;
    const tanpaPjt = suratTugas.tenagaTeknik.filter((n) => !isSamePersonName(n, pjtAktif));
    if (tanpaPjt.length !== suratTugas.tenagaTeknik.length) {
      patch.tenagaTeknik = tanpaPjt.length ? tanpaPjt : [''];
    }
    if (Object.keys(patch).length > 0) updateST(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, linkedProject?.pjtName, suratTugas.pjt, suratTugas.penandatanganIdx, suratTugas.tenagaTeknik]);

  // TTE Surat Tugas hanya tampil setelah Direktur menyetujui & menandatangani (tercatat di proyek)
  const stTte = linkedProject?.docTte?.suratTugas?.enabled ? linkedProject.docTte.suratTugas : undefined;

  const cleanTenagaTeknik = suratTugas.tenagaTeknik.map((n) => n.trim()).filter(Boolean);
  const cleanPelaksana = jsa.pelaksana.map((n) => n.trim()).filter(Boolean);
  const jsaRowsCount = Math.max(3, cleanPelaksana.length);

  return (
    <div className="space-y-4">
      {/* Top Toolbar (No-print) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white border border-slate-200/80 p-3.5 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          {(
            [
              ['surat-tugas', '1. Surat Tugas', FileText],
              ['surat-jalan', '2. Surat Jalan Alat', Truck],
              ['jsa', '3. JSA Keselamatan', ShieldAlert],
            ] as [DocTab, string, typeof FileText][]
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => onChangeDoc(id)}
              aria-current={activeDoc === id ? 'page' : undefined}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                activeDoc === id
                  ? 'bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {!readOnly && (
            <div className="flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-slate-400" />
              <select
                aria-label="Muat dari Proyek Portal SLO"
                value={suratTugas.projectId || ''}
                onChange={(e) => {
                  if (e.target.value) handleImportFromProject(e.target.value);
                }}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 focus:border-blue-600 focus:outline-none"
              >
                <option value="">Isi dari Proyek Portal SLO...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.no} — {p.perusahaan}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={exportingPdf}
              onClick={() => void handleDownloadPdf()}
              className="h-9 px-3.5 rounded-xl bg-gradient-to-r from-[#16A34A] to-[#15803D] text-white text-xs font-semibold shadow-sm hover:brightness-105 disabled:opacity-60 transition inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span>{exportingPdf ? 'Membuat PDF...' : 'Simpan PDF & Rekap'}</span>
            </button>
            <button
              type="button"
              disabled={exportingPdf}
              onClick={handlePrintPdf}
              className="h-9 px-3.5 rounded-xl bg-[#0F1E3D] text-white text-xs font-semibold shadow-sm hover:bg-slate-800 disabled:opacity-60 transition inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak</span>
            </button>
            {wizard && !readOnly && (
              <button
                type="button"
                disabled={exportingPdf}
                onClick={() => void handleSaveAndContinue()}
                className="h-9 px-3.5 rounded-xl bg-violet-600 text-white text-xs font-bold shadow-sm hover:bg-violet-700 disabled:opacity-60 transition inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {activeDoc === 'surat-tugas'
                    ? 'Simpan & Lanjutkan ke Surat Jalan Alat'
                    : activeDoc === 'surat-jalan'
                    ? 'Simpan & Lanjutkan ke JSA'
                    : 'Simpan & Selesai (Kirim ke PJT)'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Archive & Manual Signature Scan Status Strip (No-print) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-2.5 rounded-2xl bg-white border border-slate-200/80 px-4 py-2.5 shadow-2xs text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
            <Archive className="w-3.5 h-3.5 text-blue-600" />
            Arsip Database:
          </span>
          {existingArchive ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Tersimpan ({formatDateTime(existingArchive.savedAt)})
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-600 font-medium">
              <Clock className="w-3.5 h-3.5" />
              Belum disimpan — klik Simpan PDF untuk merekap ke database
            </span>
          )}
          {existingArchive?.manualScan ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-700 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Scan TTD Manual: {existingArchive.manualScan.name}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-800 font-medium">
              Scan TTD Manual Tenaga Teknik belum diunggah
            </span>
          )}
        </div>
        {onOpenRekapDokumen && (
          <button
            type="button"
            onClick={onOpenRekapDokumen}
            className="px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-blue-700 font-semibold text-xs cursor-pointer"
          >
            Buka Rekap Dokumen ({docArchives.length})
          </button>
        )}
      </div>

      {/* Editor + Live A4 Paper Split */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* LEFT PANEL: FORM */}
        <div className="doc-form no-print xl:col-span-4 rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs xl:sticky xl:top-5 xl:max-h-[calc(100vh-120px)] xl:overflow-y-auto">
          {readOnly && (
            <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-xs text-amber-900 font-medium">
              <b>Mode Review (Hanya Baca):</b> Pengubahan isi dokumen dinonaktifkan. Anda tetap dapat meninjau dokumen &amp; mencetak PDF.
            </div>
          )}
          <fieldset disabled={readOnly} className="contents">
          {activeDoc === 'surat-tugas' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900">Surat Tugas</h2>
                  <p className="text-xs text-slate-500">
                    Isi data di bawah, surat di sebelah kanan terisi otomatis.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setModalJenisOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>{stCfg.nama}</span>
                </button>
              </div>

              {/* Nomor Surat */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Nomor surat (urut / bulan / tahun)
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    value={suratTugas.nomorUrut}
                    onChange={(e) => updateST({ nomorUrut: e.target.value })}
                    inputMode="numeric"
                    className="w-16 h-9 rounded-lg border border-slate-200 px-2 text-center text-sm font-mono tabular-nums"
                  />
                  <span className="text-xs text-slate-500 font-mono shrink-0">/SDP/ST/</span>
                  <select
                    value={suratTugas.nomorBulan}
                    onChange={(e) => updateST({ nomorBulan: e.target.value })}
                    className="w-16 h-9 rounded-lg border border-slate-200 px-1.5 text-sm font-mono"
                  >
                    {BULAN_NUMS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-slate-500">/</span>
                  <select
                    value={suratTugas.nomorTahun}
                    onChange={(e) => updateST({ nomorTahun: e.target.value })}
                    className="w-20 h-9 rounded-lg border border-slate-200 px-1.5 text-sm font-mono"
                  >
                    {TAHUN_NUMS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pemberi Tugas — TTD Surat Tugas hanya Direktur Utama */}
              <div className="pt-3 border-t border-slate-100">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Pemberi tugas
                </div>
                <div className="f-readonly">
                  <span className="font-semibold text-slate-800">{DOC_CONFIG.penandatangan[0].nama}</span>
                  <span className="text-slate-500"> ({DOC_CONFIG.penandatangan[0].jabatan})</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500 leading-snug">
                  Surat Tugas hanya ditandatangani Direktur Utama. PJT terisi otomatis sesuai pilihan Admin.
                </p>
              </div>

              {/* Tenaga Teknik: kolom 1 = Leader, kolom 2, 3, dst = anggota */}
              <div className="pt-3 border-t border-slate-100 space-y-2.5">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Tenaga Teknik (TT)
                </div>
                {(suratTugas.tenagaTeknik.length ? suratTugas.tenagaTeknik : ['']).map((nama, idx) => {
                  const isLeader = idx === 0;
                  const isManual = Boolean(nama && !allTenagaTeknik.includes(nama));
                  const selectVal = isManual ? MANUAL_KEY : nama;
                  return (
                    <div key={idx} className="space-y-1.5">
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                            isLeader ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {isLeader ? 'Leader' : `Anggota ${idx}`}
                        </span>
                        <span className="text-[11px] font-normal text-slate-400">kolom {idx + 1}</span>
                      </label>
                      <div className="flex gap-1.5">
                        <select
                          value={selectVal}
                          onChange={(e) => {
                            const next = suratTugas.tenagaTeknik.length ? [...suratTugas.tenagaTeknik] : [''];
                            next[idx] = e.target.value === MANUAL_KEY ? ' ' : e.target.value;
                            updateST({ tenagaTeknik: next });
                          }}
                          className="flex-1 h-9 rounded-lg border border-slate-200 px-2.5 text-sm min-w-0"
                        >
                          <option value="">{isLeader ? 'Pilih Leader…' : 'Pilih anggota…'}</option>
                          {allTenagaTeknik.map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                          <option value={MANUAL_KEY}>Lainnya (ketik manual)</option>
                        </select>
                        {!isLeader && (
                          <button
                            type="button"
                            onClick={() => {
                              const next = suratTugas.tenagaTeknik.filter((_, i) => i !== idx);
                              updateST({ tenagaTeknik: next });
                            }}
                            className="w-9 h-9 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center shrink-0 cursor-pointer"
                            aria-label="Hapus anggota"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      {(selectVal === MANUAL_KEY || isManual) && (
                        <input
                          type="text"
                          value={nama.trimStart()}
                          placeholder="Ketik nama lengkap"
                          onChange={(e) => {
                            const next = suratTugas.tenagaTeknik.length ? [...suratTugas.tenagaTeknik] : [''];
                            next[idx] = e.target.value;
                            updateST({ tenagaTeknik: next });
                          }}
                          className="w-full h-9 rounded-lg border border-slate-200 px-2.5 text-sm"
                        />
                      )}
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() =>
                    updateST({
                      tenagaTeknik: [
                        ...(suratTugas.tenagaTeknik.length ? suratTugas.tenagaTeknik : ['']),
                        '',
                      ],
                    })
                  }
                  className="w-full py-2 rounded-lg border border-dashed border-blue-300 bg-blue-50/70 text-blue-700 text-xs font-semibold hover:bg-blue-50 transition inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah Anggota
                </button>
              </div>

              {/* Pekerjaan */}
              <div className="pt-3 border-t border-slate-100 space-y-2.5">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Pekerjaan yang diselesaikan
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Jenis pekerjaan</label>
                  <input
                    value={suratTugas.jenisPekerjaan}
                    onChange={(e) => updateST({ jenisPekerjaan: e.target.value })}
                    className="w-full h-9 rounded-lg border border-slate-200 px-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Jenis instalasi</label>
                  <select
                    value={suratTugas.tipe}
                    onChange={(e) => updateST({ tipe: e.target.value })}
                    className="w-full h-9 rounded-lg border border-slate-200 px-2.5 text-sm"
                  >
                    {stCfg.tipeOpsi.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                    <option value={MANUAL_KEY}>Lainnya (ketik manual)</option>
                  </select>
                  {suratTugas.tipe === MANUAL_KEY && (
                    <input
                      value={suratTugas.tipeManual}
                      onChange={(e) => updateST({ tipeManual: e.target.value })}
                      placeholder="Ketik jenis instalasi"
                      className="mt-1.5 w-full h-9 rounded-lg border border-slate-200 px-2.5 text-sm"
                    />
                  )}
                </div>
                <div className={`grid gap-2 ${stCfg.tanpaUnit ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {!stCfg.tanpaUnit && (
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">{stCfg.lblUnit}</label>
                      <input
                        type="number"
                        min={1}
                        value={suratTugas.unit}
                        onChange={(e) => updateST({ unit: e.target.value })}
                        className="w-full h-9 rounded-lg border border-slate-200 px-2.5 text-sm tabular-nums"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">{stCfg.lblKap}</label>
                    <div className="flex gap-1.5">
                      <input
                        type="number"
                        min={1}
                        value={suratTugas.kap}
                        onChange={(e) => updateST({ kap: e.target.value })}
                        className="flex-1 min-w-0 h-9 rounded-lg border border-slate-200 px-2 text-sm tabular-nums"
                      />
                      <select
                        value={suratTugas.satuan}
                        onChange={(e) => updateST({ satuan: e.target.value })}
                        className="w-20 h-9 rounded-lg border border-slate-200 px-1.5 text-sm"
                      >
                        {stCfg.satuanOpsi.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Pemilik</label>
                  <input
                    value={suratTugas.pemilik}
                    onChange={(e) => updateST({ pemilik: e.target.value })}
                    className="w-full h-9 rounded-lg border border-slate-200 px-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Lokasi</label>
                  <textarea
                    rows={3}
                    value={suratTugas.lokasi}
                    onChange={(e) => updateST({ lokasi: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 p-2.5 text-sm"
                  />
                </div>
              </div>

              {/* Masa Berlaku & Tanggal */}
              <div className="pt-3 border-t border-slate-100 space-y-2.5">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Masa berlaku & Tanggal surat
                </div>
                {(
                  [
                    ['Mulai', 'mulai'],
                    ['Sampai', 'selesai'],
                  ] as [string, 'mulai' | 'selesai'][]
                ).map(([lbl, key]) => (
                  <div key={key}>
                    <label className="block text-xs text-slate-500 mb-1">{lbl}</label>
                    <div className="flex gap-1.5">
                      <input
                        type="date"
                        value={suratTugas[key]}
                        onChange={(e) => updateST({ [key]: e.target.value })}
                        className="flex-1 h-9 rounded-lg border border-slate-200 px-2.5 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => updateST({ [key]: isoToday() })}
                        className="px-2.5 h-9 rounded-lg border border-dashed border-blue-300 bg-blue-50 text-blue-700 text-xs font-semibold cursor-pointer whitespace-nowrap"
                      >
                        Hari ini
                      </button>
                    </div>
                  </div>
                ))}
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Kota</label>
                  <input
                    value={suratTugas.kota}
                    onChange={(e) => updateST({ kota: e.target.value })}
                    className="w-full h-9 rounded-lg border border-slate-200 px-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Tanggal surat</label>
                  <div className="flex gap-1.5">
                    <input
                      type="date"
                      value={suratTugas.tgl}
                      onChange={(e) => updateST({ tgl: e.target.value })}
                      className="flex-1 h-9 rounded-lg border border-slate-200 px-2.5 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => updateST({ tgl: isoToday() })}
                      className="px-2.5 h-9 rounded-lg border border-dashed border-blue-300 bg-blue-50 text-blue-700 text-xs font-semibold cursor-pointer whitespace-nowrap"
                    >
                      Hari ini
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeDoc === 'surat-jalan' && (
            <div className="space-y-4">
              <div className="pb-3 border-b border-slate-100">
                <h2 className="font-display text-lg font-bold text-slate-900">Surat Jalan Alat</h2>
                <p className="text-xs text-slate-500">
                  Nomor, tanggal, perusahaan, alamat, dan petugas otomatis mengikuti Surat Tugas.
                </p>
              </div>

              <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 space-y-1.5">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Petugas (Leader dari Surat Tugas)
                </div>
                <p className="text-xs text-slate-800 font-semibold">
                  {sjPetugas || 'Belum ada Leader di Surat Tugas.'}
                </p>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Bila Leader adalah {DOC_CONFIG.toolKeeper}, petugas diganti anggota pertama yang dipilih di Surat Tugas.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Alat Uji (data inventaris)
                  </div>
                  {projectTeamTools.length > 0 && (
                    <button
                      type="button"
                      onClick={syncToolsFromProject}
                      className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-[11px] font-semibold cursor-pointer"
                    >
                      Samakan dengan alat tim proyek
                    </button>
                  )}
                </div>
                <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                  {tools.map((t) => {
                    const c = certStatus(t.cal, true);
                    const added = suratJalan.items.some((it) => itemMatchesTool(it, t));
                    return (
                      <label
                        key={t.id}
                        className={`flex items-center justify-between gap-2 p-2 rounded-xl border text-xs ${
                          c.lock && !added
                            ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
                            : added
                            ? 'bg-blue-50 border-blue-300 cursor-pointer'
                            : 'bg-white border-slate-200 hover:bg-slate-50 cursor-pointer'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={added}
                            disabled={c.lock && !added}
                            onChange={() => toggleTool(t)}
                          />
                          <span className="font-semibold text-slate-900 truncate">{t.nama}</span>
                        </span>
                        <span className="font-mono text-[10px] text-slate-500 shrink-0">
                          {t.sn} ({c.t})
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Daftar alat
                </div>
                {suratJalan.items.map((item, idx) => {
                  const isManual = item.nama === MANUAL_KEY || (item.nama && !ALAT_PILIHAN.includes(item.nama));
                  const selectVal = isManual ? MANUAL_KEY : item.nama;
                  const updateItem = (patch: Partial<SuratJalanItem>) => {
                    const next = [...suratJalan.items];
                    next[idx] = { ...next[idx], ...patch };
                    updateSJ({ items: next });
                  };
                  return (
                    <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 space-y-2">
                      <div className="flex gap-1.5">
                        <select
                          value={selectVal}
                          onChange={(e) =>
                            updateItem({
                              nama: e.target.value,
                              manualNama: e.target.value === MANUAL_KEY ? item.manualNama : '',
                            })
                          }
                          className="flex-1 min-w-0 h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium"
                        >
                          <option value="">Pilih alat…</option>
                          {ALAT_PILIHAN.map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                          <option value={MANUAL_KEY}>Lainnya (ketik manual)</option>
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            updateSJ({ items: suratJalan.items.filter((x) => x.id !== item.id) })
                          }
                          className="w-9 h-9 rounded-lg border border-red-200 bg-red-50 text-red-600 flex items-center justify-center shrink-0 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {selectVal === MANUAL_KEY && (
                        <input
                          value={item.manualNama}
                          placeholder="Ketik nama alat"
                          onChange={(e) => updateItem({ manualNama: e.target.value })}
                          className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs"
                        />
                      )}
                      <div className="grid grid-cols-2 gap-1.5">
                        <select
                          value={item.jml}
                          onChange={(e) => updateItem({ jml: e.target.value })}
                          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs"
                        >
                          {QTY_NUMS.map((q) => (
                            <option key={q} value={q}>
                              {q}
                            </option>
                          ))}
                        </select>
                        <select
                          value={item.unit}
                          onChange={(e) => updateItem({ unit: e.target.value })}
                          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs"
                        >
                          {SATUAN_ALAT.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-5 gap-1.5">
                        <input
                          value={item.seri}
                          placeholder="No. seri"
                          onChange={(e) => updateItem({ seri: e.target.value })}
                          className="col-span-2 h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs"
                        />
                        <select
                          value={item.ket}
                          onChange={(e) => updateItem({ ket: e.target.value })}
                          className="col-span-3 h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs"
                        >
                          {KET_PILIHAN.map((k) => (
                            <option key={k} value={k}>
                              {k}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() =>
                    updateSJ({
                      items: [
                        ...suratJalan.items,
                        {
                          id: `sj-i-${Date.now()}`,
                          nama: '',
                          manualNama: '',
                          jml: '1',
                          unit: 'Unit',
                          seri: '',
                          ket: 'Didalam tas Koper',
                        },
                      ],
                    })
                  }
                  className="w-full py-2 rounded-lg border border-dashed border-blue-300 bg-blue-50/70 text-blue-700 text-xs font-semibold hover:bg-blue-50 transition inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah alat
                </button>
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Kendaraan yang dipakai
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={suratJalan.kendTampil}
                    onChange={(e) => updateSJ({ kendTampil: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  <span>Tampilkan kendaraan di surat / hasil print</span>
                </label>
                <select
                  value={suratJalan.kendaraan}
                  disabled={!suratJalan.kendTampil}
                  onChange={(e) => updateSJ({ kendaraan: e.target.value })}
                  className="w-full h-9 rounded-lg border border-slate-200 px-2.5 text-sm disabled:opacity-50"
                >
                  {KENDARAAN_PILIHAN.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Tool Keeper & Menyetujui
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Tool Keeper</label>
                  <div className="f-readonly">{DOC_CONFIG.toolKeeper}</div>
                  <p className="mt-1 text-[11px] text-slate-500 leading-snug">
                    Tool Keeper bersifat tetap (permanen).
                  </p>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Menyetujui</label>
                  <select
                    value={suratJalan.ttdIdx}
                    onChange={(e) => updateSJ({ ttdIdx: Number(e.target.value) })}
                    className="w-full h-9 rounded-lg border border-slate-200 px-2.5 text-sm"
                  >
                    {DOC_CONFIG.penandatangan.map((p, idx) => (
                      <option key={p.nama} value={idx}>
                        {p.nama}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeDoc === 'jsa' && (
            <div className="space-y-4">
              <div className="pb-3 border-b border-slate-100">
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Job Safety Analyst (JSA)
                </h2>
                <p className="text-xs text-slate-500">
                  Nomor, tanggal, lokasi, instalasi, dan periode otomatis mengikuti Surat Tugas.
                </p>
              </div>

              {/* Ketua Tim */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Penanggung jawab kegiatan (Ketua Tim)
                </div>
                <select
                  value={jsa.ketua}
                  onChange={(e) => updateJSA({ ketua: e.target.value })}
                  className="w-full h-9 rounded-lg border border-slate-200 px-2.5 text-sm"
                >
                  {allJsaNames.length === 0 && <option value="">Isi Tenaga Teknik di Surat Tugas…</option>}
                  {allJsaNames.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-500 leading-snug">
                  Pilihan nama diambil dari Tenaga Teknik pada Surat Tugas.
                </p>
              </div>

              {/* Pelaksana (otomatis dari Surat Tugas) */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Pelaksana kegiatan
                </div>
                {jsa.pelaksana.length > 0 ? (
                  <ul className="space-y-1.5">
                    {jsa.pelaksana.map((nama) => (
                      <li
                        key={nama}
                        className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-sm flex items-center text-slate-800"
                      >
                        {nama}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500">Belum ada pelaksana selain Ketua Tim.</p>
                )}
                <p className="text-[11px] text-slate-500 leading-snug">
                  Otomatis sama dengan Tenaga Teknik di Surat Tugas. Tambah / hapus nama di tab{' '}
                  <b>1. Surat Tugas</b>.
                </p>
              </div>

              {/* Jenis Pekerjaan */}
              <div className="pt-3 border-t border-slate-100">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Jenis pekerjaan
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {JSA_JENIS.map(([label], idx) => (
                    <label key={label} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(jsa.jenisChecks[idx])}
                        onChange={(e) => {
                          const next = [...jsa.jenisChecks];
                          next[idx] = e.target.checked;
                          updateJSA({ jenisChecks: next });
                        }}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Deskripsi Kegiatan */}
              <div className="pt-3 border-t border-slate-100">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Deskripsi kegiatan
                </label>
                <input
                  value={jsa.kegiatan}
                  onChange={(e) => updateJSA({ kegiatan: e.target.value })}
                  className="w-full h-9 rounded-lg border border-slate-200 px-2.5 text-sm"
                />
              </div>

              {/* Jenis Peralatan */}
              <div className="pt-3 border-t border-slate-100">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Jenis peralatan
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {JSA_ALAT.map(([label], idx) => (
                    <label key={label} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(jsa.alatChecks[idx])}
                        onChange={(e) => {
                          const next = [...jsa.alatChecks];
                          next[idx] = e.target.checked;
                          updateJSA({ alatChecks: next });
                        }}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Potensi Bahaya */}
              <div className="pt-3 border-t border-slate-100">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Potensi bahaya
                </div>
                <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-1">
                  {JSA_BAHAYA.map(([label], idx) => (
                    <label key={label} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(jsa.bahayaChecks[idx])}
                        onChange={(e) => {
                          const next = [...jsa.bahayaChecks];
                          next[idx] = e.target.checked;
                          updateJSA({ bahayaChecks: next });
                        }}
                      />
                      <span className="truncate">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* APD */}
              <div className="pt-3 border-t border-slate-100">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Alat Perlindungan Diri (APD)
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {JSA_APD.map(([label], idx) => (
                    <label key={label} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(jsa.apdChecks[idx])}
                        onChange={(e) => {
                          const next = [...jsa.apdChecks];
                          next[idx] = e.target.checked;
                          updateJSA({ apdChecks: next });
                        }}
                      />
                      <span className="truncate">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          </fieldset>

        </div>

        {/* RIGHT PANEL: EXACT A4 LIVE PAPER PREVIEW */}
        <div ref={stageRef} className="print-stage xl:col-span-8 overflow-x-auto pb-8">
          {activeDoc === 'surat-tugas' && (
            <article
              ref={paperRef}
              className="a4-paper"
              style={{ zoom: stageZoom }}
            >
              <header className="kop">
                <img className="logo-kiri" src={LOGO.kiri} alt="Sabda Duta Paramitha" />
                <img
                  className="logo-kanan"
                  src={LOGO.kanan}
                  alt="MSTC Certification dan KAN LSSM-053-IDN"
                />
              </header>

              <h2>SURAT TUGAS</h2>
              <div className="nomor">Nomor : {stNomor}</div>

              <p>Yang bertanda tangan di bawah ini :</p>
              <div className="kv">
                <span>Nama</span>
                <span>: {stPenanda.nama}</span>
              </div>
              <div className="kv">
                <span>Jabatan</span>
                <span>
                  : {stPenanda.jabatan} {DOC_CONFIG.perusahaan}
                </span>
              </div>

              <p style={{ marginTop: 10 }}>
                Dengan ini menugaskan Penanggung Jawab Teknik (PJT) dan Tenaga Teknik (TT) sebagai
                berikut :
              </p>

              <ul>
                <li>
                  Penanggung Jawab Teknik (PJT) :
                  <ol>
                    <li>{suratTugas.pjt || '…'}</li>
                  </ol>
                </li>
                <li>
                  Tenaga Teknik (TT) :
                  <ol>
                    {cleanTenagaTeknik.length > 0 ? (
                      cleanTenagaTeknik.map((n, i) => (
                        <li key={i}>
                          {DOC_CONFIG.awalanTT} {n}
                        </li>
                      ))
                    ) : (
                      <li style={{ listStyle: 'none' }}>…</li>
                    )}
                  </ol>
                </li>
                <li>Pekerjaan yang diselesaikan :</li>
              </ul>

              <p className="work">
                {suratTugas.jenisPekerjaan || '…'} {stInstalasi || '…'} milik{' '}
                {suratTugas.pemilik || '…'} yang berlokasi {suratTugas.lokasi || '…'}.
              </p>

              <p className="ind">
                Selanjutnya penerima tugas ini bertanggung jawab dan melaporkan hasil pekerjaan kepada
                pemberi tugas.
              </p>
              <p className="ind">
                Surat tugas ini berlaku mulai tanggal {formatTanggal(suratTugas.mulai)} sampai dengan{' '}
                {formatTanggal(suratTugas.selesai)} atau ketentuan lain di kemudian hari yang dapat
                membatalkan surat tugas ini.
              </p>
              <p className="ind">
                Demikian surat tugas ini dibuat, untuk dipergunakan sebagaimana mestinya.
              </p>

              <div className="sign">
                <div>
                  {suratTugas.kota || '…'}, {formatTanggal(suratTugas.tgl)}
                </div>
                <div>Pemberi Tugas</div>
                {stTte ? (
                  // Setelah di-ACC Direktur: TTD diambil dari Database TTD
                  <SignatureImg
                    src={findSignature(signatures, stPenanda.nama)}
                    alt={`TTD ${stPenanda.nama}`}
                    w={140}
                    h={64}
                  />
                ) : (
                  <div className="gap" />
                )}
                <br />
                <u>{stPenanda.nama}</u>
                <br />
                <span>{stPenanda.jabatan}</span>
              </div>

              <footer className="foot">
                Jl. GayungKebonsari VII/2
                <br />
                Telp 031-8291424 / Fax 031 8272454
                <br />
                Surabaya 60231
              </footer>
            </article>
          )}

          {activeDoc === 'surat-jalan' && (
            <article
              ref={paperRef}
              className="a4-paper long"
              style={{ zoom: stageZoom }}
            >
              <header className="kop">
                <img className="logo-kiri" src={LOGO.kiri} alt="Sabda Duta Paramitha" />
                <img
                  className="logo-kanan"
                  src={LOGO.kanan}
                  alt="MSTC Certification dan KAN LSSM-053-IDN"
                />
              </header>

              <div className="sj-head">
                <div>No. {sjNomor}</div>
                <div>
                  <div>
                    {suratTugas.kota || '…'}, {formatTanggal(suratTugas.tgl)}
                  </div>
                  <div>Kepada Yth,</div>
                  <div>{suratTugas.pemilik || '…'}</div>
                  <div>{suratTugas.lokasi || '…'}</div>
                </div>
              </div>

              <h2 className="sj-title">
                SURAT JALAN
                <br />
                PERALATAN KERJA
              </h2>

              <table className="tb sj">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>No</th>
                    <th style={{ width: 74 }}>Qty</th>
                    <th>Nama Alat</th>
                    <th style={{ width: 120 }}>NO Seri</th>
                    <th style={{ width: 150 }}>Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const validRows = suratJalan.items
                      .map((it) => ({
                        ...it,
                        displayNama: (it.nama === MANUAL_KEY ? it.manualNama : it.nama).trim(),
                      }))
                      .filter((it) => it.displayNama);

                    if (validRows.length === 0) {
                      return (
                        <tr>
                          <td className="c">1</td>
                          <td className="c" />
                          <td>…</td>
                          <td />
                          <td />
                        </tr>
                      );
                    }
                    return validRows.map((it, idx) => (
                      <tr key={it.id}>
                        <td className="c">{idx + 1}</td>
                        <td className="c">
                          {it.jml} {it.unit}
                        </td>
                        <td>{it.displayNama}</td>
                        <td>{it.seri}</td>
                        <td className="c">{it.ket}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>

              {suratJalan.kendTampil && (
                <div className="sj-kend">
                  Kendaraan yang dipakai : <b>{suratJalan.kendaraan || '…'}</b>
                </div>
              )}

              <div className="sj-sign">
                <div>
                  Tool Keeper,
                  <SignatureImg
                    src={findSignature(signatures, DOC_CONFIG.toolKeeper)}
                    alt={`TTD ${DOC_CONFIG.toolKeeper}`}
                    w={110}
                    h={46}
                  />
                  <span>{DOC_CONFIG.toolKeeper}</span>
                </div>
                <div>
                  Petugas,
                  <SignatureImg
                    src={findSignature(signatures, sjPetugas)}
                    alt={`TTD ${sjPetugas}`}
                    w={110}
                    h={46}
                  />
                  <span>{sjPetugas || '………………………'}</span>
                </div>
              </div>

              <div className="sj-ok">
                Menyetujui,
                <SignatureImg
                  src={findSignature(signatures, sjPenanda.nama)}
                  alt={`TTD ${sjPenanda.nama}`}
                  w={120}
                  h={50}
                />
                <span>{sjPenanda.nama}</span>
              </div>

              <footer className="foot">
                Jl. GayungKebonsari VII/2
                <br />
                Telp 031-8291424 / Fax 031 8272454
                <br />
                Surabaya 60231
              </footer>
            </article>
          )}

          {activeDoc === 'jsa' && (
            <article
              ref={paperRef}
              className="a4-paper jsa"
              style={{ zoom: stageZoom }}
            >
              <header className="kop">
                <img className="logo-kiri" src={LOGO.kiri} alt="Sabda Duta Paramitha" />
                <img
                  className="logo-kanan"
                  src={LOGO.kanan}
                  alt="MSTC Certification dan KAN LSSM-053-IDN"
                />
              </header>

              <table className="jt title">
                <colgroup>
                  <col style={{ width: '78%' }} />
                  <col style={{ width: '22%' }} />
                </colgroup>
                <tbody>
                  <tr>
                    <td>JOB&nbsp; SAFETY ANALYST (JSA)</td>
                    <td className="no">No : {jsaNomor}</td>
                  </tr>
                </tbody>
              </table>

              <table className="jt">
                <colgroup>
                  <col style={{ width: '14.5%' }} />
                  <col style={{ width: '13.5%' }} />
                  <col style={{ width: '14.5%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '13.5%' }} />
                </colgroup>
                <tbody>
                  <tr>
                    {JSA_JENIS.map(([lbl], idx) => (
                      <td key={lbl}>
                        <span className={`bx${jsa.jenisChecks[idx] ? ' on' : ''}`} />
                        {lbl}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>

              <table className="jt">
                <colgroup>
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '69%' }} />
                  <col style={{ width: '22%' }} />
                </colgroup>
                <tbody>
                  <tr>
                    <td>Lokasi</td>
                    <td>{suratTugas.pemilik || '…'}</td>
                    <td>Tanggal : {formatTanggal(suratTugas.tgl)}</td>
                  </tr>
                </tbody>
              </table>

              <table className="jt">
                <colgroup>
                  <col style={{ width: '78%' }} />
                  <col style={{ width: '22%' }} />
                </colgroup>
                <tbody>
                  <tr>
                    <td className="h">DESKRIPSI KEGIATAN</td>
                    <td className="h">Jenis Peralatan</td>
                  </tr>
                  <tr>
                    <td rowSpan={3}>
                      {`${jsa.kegiatan.trim()} ${stInstalasi}`.trim() || '…'}
                    </td>
                    <td>
                      <span className={`bx${jsa.alatChecks[0] ? ' on' : ''}`} />
                      {JSA_ALAT[0][0]}
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <span className={`bx${jsa.alatChecks[1] ? ' on' : ''}`} />
                      {JSA_ALAT[1][0]}
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <span className={`bx${jsa.alatChecks[2] ? ' on' : ''}`} />
                      {JSA_ALAT[2][0]}
                    </td>
                  </tr>
                </tbody>
              </table>

              <table className="jt">
                <tbody>
                  <tr>
                    <td className="h">POTENSI&nbsp; BAHAYA</td>
                  </tr>
                </tbody>
              </table>

              <table className="jt">
                <colgroup>
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '20%' }} />
                </colgroup>
                <tbody>
                  {Array.from({ length: Math.ceil(JSA_BAHAYA.length / 5) }, (_, r) => (
                    <tr key={r}>
                      {JSA_BAHAYA.slice(r * 5, r * 5 + 5).map(([lbl], c) => {
                        const idx = r * 5 + c;
                        return (
                          <td key={lbl}>
                            <span className={`bx${jsa.bahayaChecks[idx] ? ' on' : ''}`} />
                            {lbl}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>

              <table className="jt">
                <tbody>
                  <tr>
                    <td className="note">
                      Tindakan Keselamatan lain yang diperlukan
                      <br />
                      Selalu mengingatkan untuk tetap menggunakan APD dalam setiap pelaksanaan&nbsp;
                      pekerjaan
                    </td>
                  </tr>
                  <tr>
                    <td className="h">ALAT PERLINDUNGAN DIRI (APD)</td>
                  </tr>
                </tbody>
              </table>

              <table className="jt">
                <colgroup>
                  <col style={{ width: '33.333%' }} />
                  <col style={{ width: '33.333%' }} />
                  <col style={{ width: '33.334%' }} />
                </colgroup>
                <tbody>
                  {Array.from({ length: Math.ceil(JSA_APD.length / 3) }, (_, r) => (
                    <tr key={r}>
                      {JSA_APD.slice(r * 3, r * 3 + 3).map(([lbl], c) => {
                        const idx = r * 3 + c;
                        return (
                          <td key={lbl}>
                            <span className={`bx${jsa.apdChecks[idx] ? ' on' : ''}`} />
                            {lbl}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>

              <table className="jt">
                <tbody>
                  <tr>
                    <td className="h">Pelaksanaan Uji&nbsp; Laik Operasi</td>
                  </tr>
                  <tr>
                    <td className="note">
                      Saya menyatakan dalam&nbsp; keadaan <b>SEHAT</b>. Saya juga mematuhi ketentuan
                      Keselamatan Ketenagalistrikan(K2)
                      <br />
                      dan segala persyaratan yang diberlakukan (jika tidak setuju berikan alasan pada
                      kolom keterangan)
                    </td>
                  </tr>
                </tbody>
              </table>

              <table className="jt sg">
                <colgroup>
                  <col style={{ width: '24%' }} />
                  <col style={{ width: '23%' }} />
                  <col style={{ width: '30%' }} />
                  <col style={{ width: '23%' }} />
                </colgroup>
                <tbody>
                  <tr>
                    <td colSpan={2} className="h">
                      PENANGGUNG JAWAB&nbsp; KEGIATAN
                    </td>
                    <td colSpan={2} className="h">
                      PELAKSANA&nbsp; KEGIATAN
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={2} className="c">
                      Ketua&nbsp; Tim Uji Laik Operasi
                    </td>
                    <td colSpan={2} className="c">
                      Pelaksana Uji Laik Operasi
                    </td>
                  </tr>
                  <tr>
                    <td className="c">Nama</td>
                    <td className="c">Tandatangan</td>
                    <td className="c">Nama</td>
                    <td className="c">Tandatangan</td>
                  </tr>
                  {Array.from({ length: jsaRowsCount }, (_, i) => (
                    <tr key={i} style={{ height: 46 }}>
                      {i === 0 && (
                        <>
                          <td rowSpan={jsaRowsCount} className="c">
                            {jsa.ketua.trim()}
                          </td>
                          <td rowSpan={jsaRowsCount} className="c">
                            <SignatureImg
                              src={findSignature(signatures, jsa.ketua)}
                              alt={`TTD ${jsa.ketua}`}
                              w={96}
                              h={42}
                            />
                          </td>
                        </>
                      )}
                      <td className="dash">
                        {cleanPelaksana[i] ? `${i + 1}. ${cleanPelaksana[i]}` : ''}
                      </td>
                      <td className="dash c">
                        {cleanPelaksana[i] ? (
                          <SignatureImg
                            src={findSignature(signatures, cleanPelaksana[i])}
                            alt={`TTD ${cleanPelaksana[i]}`}
                            w={84}
                            h={34}
                          />
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <table className="jt">
                <tbody>
                  <tr>
                    <td className="c">
                      Pelaksanaan Uji Laik Operasi dilaksanakan seperti ketentuan di atas untuk
                      periode
                    </td>
                  </tr>
                </tbody>
              </table>
              <table className="jt">
                <colgroup>
                  <col style={{ width: '50%' }} />
                  <col style={{ width: '50%' }} />
                </colgroup>
                <tbody>
                  <tr>
                    <td>Dari :&nbsp; Tanggal {formatTanggal(suratTugas.mulai)}</td>
                    <td>Sampai:&nbsp; Tanggal {formatTanggal(suratTugas.selesai)}</td>
                  </tr>
                </tbody>
              </table>
            </article>
          )}
        </div>
      </div>

      {/* Modal Pemilihan Jenis Surat Tugas */}
      {modalJenisOpen && (
        <div
          className="no-print fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
          onClick={() => setModalJenisOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-bold text-slate-900">
              Pilih jenis Surat Tugas
            </h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Pilih jenis instalasi. Isian awal dan kalimat surat menyesuaikan pilihan.
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {(Object.keys(JENIS_ST) as JenisSTKey[]).map((key) => {
                const j = JENIS_ST[key];
                const isSelected = suratTugas.jenisAktif === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyJenisST(key)}
                    className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600/20'
                        : 'border-slate-200 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/40'
                    }`}
                  >
                    <div className="text-sm font-bold text-slate-900">{j.nama}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{j.ket}</div>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setModalJenisOpen(false)}
              className="mt-4 w-full py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
