import React, { useMemo, useState } from 'react';
import { usePersistedState } from '../hooks/usePersistedState';
import {
  Archive,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  FolderKanban,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Truck,
  Upload,
  X,
} from 'lucide-react';
import {
  DocArchiveRecord,
  Project,
  Role,
  SavedDocType,
  SignedScanMeta,
} from '../types/portal';
import {
  formatDateShort,
  formatDateTime,
  formatFileSize,
  hasAllRequiredSignedScans,
  REQUIRED_SIGNED_DOCS,
  SAVED_DOC_LABELS,
} from '../utils/portalUtils';
import { getVaultFile, triggerDataUrlDownload } from '../utils/fileVault';

interface RekapDokumenProps {
  role: Role;
  readOnly?: boolean;
  archives: DocArchiveRecord[];
  projects: Project[];
  onUploadSignedScan: (
    projectId: string | null,
    docType: SavedDocType,
    file: File,
    archiveId?: string
  ) => Promise<void>;
  onOpenArchiveInEditor: (rec: DocArchiveRecord) => void;
  onOpenProject: (projectId: string) => void;
  onDeleteArchive: (archiveId: string) => void;
  onToast: (msg: string) => void;
}

const DOC_TYPE_STYLE: Record<SavedDocType, { badge: string; icon: typeof FileText }> = {
  'surat-tugas': { badge: 'bg-blue-50 text-blue-700 border-blue-200', icon: FileText },
  'surat-jalan': { badge: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: Truck },
  jsa: { badge: 'bg-amber-50 text-amber-800 border-amber-200', icon: ShieldAlert },
};

export function RekapDokumen({
  role,
  readOnly = false,
  archives,
  projects,
  onUploadSignedScan,
  onOpenArchiveInEditor,
  onOpenProject,
  onDeleteArchive,
  onToast,
}: RekapDokumenProps) {
  const [typeFilter, setTypeFilter] = usePersistedState<'all' | SavedDocType>('rekap.type', 'all');
  const [scanFilter, setScanFilter] = usePersistedState<'all' | 'pending' | 'uploaded'>('rekap.scan', 'all');
  const [query, setQuery] = usePersistedState('rekap.query', '');
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [previewScan, setPreviewScan] = useState<{
    title: string;
    name: string;
    mimeType: string;
    dataUrl: string;
  } | null>(null);

  const canUploadScan =
    !readOnly && (role === 'teknis' || role === 'inspektor' || role === 'pjt');
  const canDelete = !readOnly && role === 'teknis';

  const getEffectiveScan = (rec: DocArchiveRecord): SignedScanMeta | undefined => {
    if (rec.manualScan) return rec.manualScan;
    if (rec.projectId) {
      const proj = projects.find((p) => p.id === rec.projectId);
      if (proj?.signedScans?.[rec.docType]) return proj.signedScans[rec.docType];
    }
    return undefined;
  };

  const counts = useMemo(() => {
    let st = 0;
    let sj = 0;
    let jsaCount = 0;
    let scanned = 0;
    archives.forEach((a) => {
      if (a.docType === 'surat-tugas') st += 1;
      if (a.docType === 'surat-jalan') sj += 1;
      if (a.docType === 'jsa') jsaCount += 1;
      if (getEffectiveScan(a)) scanned += 1;
    });
    return {
      total: archives.length,
      st,
      sj,
      jsa: jsaCount,
      scanned,
      pending: archives.length - scanned,
    };
  }, [archives, projects]);

  const activeProjectsNeedScan = useMemo(
    () =>
      projects.filter(
        (p) =>
          p.status === 'scheduled' &&
          Boolean(p.team) &&
          !hasAllRequiredSignedScans(p)
      ),
    [projects]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return archives.filter((rec) => {
      if (typeFilter !== 'all' && rec.docType !== typeFilter) return false;
      const scan = getEffectiveScan(rec);
      if (scanFilter === 'uploaded' && !scan) return false;
      if (scanFilter === 'pending' && scan) return false;
      if (!q) return true;
      return (
        rec.docNomor.toLowerCase().includes(q) ||
        rec.perusahaan.toLowerCase().includes(q) ||
        rec.lokasi.toLowerCase().includes(q) ||
        (rec.projectNo || '').toLowerCase().includes(q) ||
        rec.penanggungJawab.toLowerCase().includes(q) ||
        rec.tenagaTeknik.some((n) => n.toLowerCase().includes(q)) ||
        rec.fileName.toLowerCase().includes(q)
      );
    });
  }, [archives, projects, typeFilter, scanFilter, query]);

  const handleDownloadArchivedPdf = async (rec: DocArchiveRecord) => {
    if (rec.vaultPdfId) {
      const vaultFile = await getVaultFile(rec.vaultPdfId);
      if (vaultFile?.dataUrl) {
        triggerDataUrlDownload(vaultFile.dataUrl, rec.fileName || vaultFile.name);
        onToast(`Mengunduh "${rec.fileName}"`);
        return;
      }
    }
    if (rec.snapshot) {
      onOpenArchiveInEditor(rec);
      onToast('File PDF lokal belum tersedia di perangkat ini — dokumen dibuka di editor agar dapat diunduh ulang.');
      return;
    }
    onToast('File PDF biner tidak ditemukan di penyimpanan browser ini.');
  };

  const handleViewOrDownloadScan = async (scan: SignedScanMeta, label: string) => {
    const vaultFile = await getVaultFile(scan.vaultFileId);
    if (!vaultFile?.dataUrl) {
      onToast(`File scan "${scan.name}" tersimpan di perangkat pengunggah.`);
      return;
    }
    setPreviewScan({
      title: `Scan TTD Manual — ${label}`,
      name: scan.name,
      mimeType: scan.mimeType || vaultFile.mimeType,
      dataUrl: vaultFile.dataUrl,
    });
  };

  return (
    <div className="space-y-5">
      {readOnly && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-900 font-medium">
          <b>Mode Review Direktur (Hanya Baca):</b> Anda dapat memantau seluruh arsip PDF dan status cetak. Hapus dokumen dinonaktifkan.
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-white border border-slate-200/80 p-4 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Total Arsip PDF
          </div>
          <div className="text-2xl font-display font-extrabold text-slate-900 mt-1 tabular-nums">
            {counts.total}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Tersimpan di database</div>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200/80 p-4 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
            Surat Tugas
          </div>
          <div className="text-2xl font-display font-extrabold text-slate-900 mt-1 tabular-nums">
            {counts.st}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Dokumen ST tersimpan</div>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200/80 p-4 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
            Surat Jalan Alat
          </div>
          <div className="text-2xl font-display font-extrabold text-slate-900 mt-1 tabular-nums">
            {counts.sj}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Dokumen alat tersimpan</div>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200/80 p-4 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-600">
            JSA Keselamatan
          </div>
          <div className="text-2xl font-display font-extrabold text-slate-900 mt-1 tabular-nums">
            {counts.jsa}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Dokumen JSA tersimpan</div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="rounded-2xl bg-white border border-slate-200/80 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          {(
            [
              ['all', `Semua (${counts.total})`],
              ['surat-tugas', `Surat Tugas (${counts.st})`],
              ['surat-jalan', `Surat Jalan Alat (${counts.sj})`],
              ['jsa', `JSA (${counts.jsa})`],
            ] as ['all' | SavedDocType, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTypeFilter(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                typeFilter === id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 flex-1 sm:flex-initial justify-end">
          <div className="relative min-w-[210px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nomor, PT, atau TTK…"
              className="w-full h-9 pl-8 pr-3 rounded-xl border border-slate-200 text-xs focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Document Archive Table */}
      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Archive className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="font-display font-bold text-slate-800 text-sm">
              {archives.length === 0
                ? 'Belum Ada PDF Dokumen yang Disimpan ke Rekap'
                : 'Tidak Ada Dokumen yang Cocok dengan Filter'}
            </div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Buka menu <b>Surat Tugas</b>, <b>Surat Jalan Alat</b>, atau <b>JSA Keselamatan</b> lalu klik tombol <b>Simpan PDF &amp; Rekap</b> atau <b>Cetak</b>. Setiap PDF otomatis tersimpan di sini.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Dokumen &amp; Nomor</th>
                  <th className="py-3 px-4">Proyek / Perusahaan</th>
                  <th className="py-3 px-4">PJT &amp; Tenaga Teknik</th>
                  <th className="py-3 px-4">Tersimpan / Cetak</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((rec) => {
                  const style = DOC_TYPE_STYLE[rec.docType];
                  const Icon = style.icon;
                  const scan = getEffectiveScan(rec);
                  const linkedProject = rec.projectId
                    ? projects.find((p) => p.id === rec.projectId)
                    : undefined;

                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/70 align-top">
                      <td className="py-3.5 px-4 space-y-1">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-bold ${style.badge}`}
                        >
                          <Icon className="w-3 h-3" />
                          {SAVED_DOC_LABELS[rec.docType]}
                        </span>
                        <div className="font-mono font-bold text-slate-900">
                          {rec.docNomor}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                          <span>Tgl: {formatDateShort(rec.tanggalDokumen)}</span>
                          {rec.tteEnabled && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold text-[10px]">
                              <ShieldCheck className="w-3 h-3" /> TTE
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 space-y-1 max-w-[240px]">
                        <div className="font-semibold text-slate-900">{rec.perusahaan}</div>
                        <div className="text-[11px] text-slate-500 truncate" title={rec.lokasi}>
                          {rec.lokasi}
                        </div>
                        {(linkedProject || rec.projectNo) && (
                          <button
                            type="button"
                            onClick={() => {
                              if (rec.projectId) onOpenProject(rec.projectId);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
                          >
                            <ExternalLink className="w-3 h-3" />
                            {linkedProject?.no || rec.projectNo}
                          </button>
                        )}
                      </td>

                      <td className="py-3.5 px-4 space-y-1 max-w-[220px]">
                        <div className="text-[11px] text-slate-700">
                          <span className="text-slate-400">PJT:</span>{' '}
                          <span className="font-semibold">{rec.penanggungJawab || '-'}</span>
                        </div>
                        <div className="text-[11px] text-slate-600">
                          <span className="text-slate-400">TTK:</span>{' '}
                          {rec.tenagaTeknik.length > 0 ? rec.tenagaTeknik.join(', ') : '-'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 space-y-1 whitespace-nowrap">
                        <div className="font-medium text-slate-800">
                          {formatDateTime(rec.savedAt)}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Oleh: {rec.savedBy} ·{' '}
                          {rec.fileSize > 0 ? formatFileSize(rec.fileSize) : 'Tersimpan'}
                        </div>
                        {rec.printedAt && (
                          <div className="text-[10px] text-indigo-700 font-semibold">
                            Dicetak: {formatDateTime(rec.printedAt)}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex flex-col items-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDownloadArchivedPdf(rec)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Download className="w-3 h-3" /> Unduh PDF
                          </button>
                          <div className="flex items-center gap-1">
                            {rec.snapshot && (
                              <button
                                type="button"
                                onClick={() => onOpenArchiveInEditor(rec)}
                                className="px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-[11px] font-semibold cursor-pointer"
                              >
                                Buka Editor
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                title="Hapus arsip dokumen"
                                onClick={() => onDeleteArchive(rec.id)}
                                className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* In-app Scan Preview Modal */}
      {previewScan && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
              <div className="min-w-0">
                <h3 className="font-display font-bold text-slate-900 text-sm truncate">
                  {previewScan.title}
                </h3>
                <p className="text-xs text-slate-500 truncate">{previewScan.name}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => triggerDataUrlDownload(previewScan.dataUrl, previewScan.name)}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Unduh Scan
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewScan(null)}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-slate-100 p-4 flex items-center justify-center">
              {previewScan.mimeType.startsWith('image/') ||
              previewScan.dataUrl.startsWith('data:image/') ? (
                <img
                  src={previewScan.dataUrl}
                  alt={previewScan.name}
                  className="max-w-full max-h-[70vh] rounded-lg shadow-sm border border-slate-200 bg-white"
                />
              ) : (
                <iframe
                  src={previewScan.dataUrl}
                  title={previewScan.name}
                  className="w-full h-[70vh] rounded-lg border border-slate-200 bg-white"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
