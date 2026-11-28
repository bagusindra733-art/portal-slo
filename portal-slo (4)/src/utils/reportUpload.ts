import { MAX_FILE_BYTES, type TestReportFile } from '../types/portal';
import { blobToDataUrl, putVaultFile } from './fileVault';
import { formatFileSize } from './portalUtils';

export interface ReportUploadResult {
  rec?: TestReportFile;
  /** Pesan kegagalan (berkas terlalu besar dsb.). */
  error?: string;
  /** false = hanya tersimpan di perangkat ini (server dokumen tidak terjangkau). */
  synced?: boolean;
}

/** Simpan satu berkas laporan ke brankas & bentuk catatannya (dipakai Layanan SLO). */
export async function uploadReportFile(
  file: File,
  opts: { title: string; uploadedBy: string; uploadedById: string; instalasiId?: string }
): Promise<ReportUploadResult> {
  if (file.size > MAX_FILE_BYTES) {
    return { error: `${file.name} melebihi batas 5 MB (${formatFileSize(file.size)})` };
  }
  const nowIso = new Date().toISOString();
  const id = `rpt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const mimeType =
    file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');
  const dataUrl = await blobToDataUrl(file);
  const synced = await putVaultFile({
    id,
    name: file.name,
    mimeType,
    size: file.size,
    dataUrl,
    savedAt: nowIso,
    folder: 'laporan',
  });
  return {
    synced,
    rec: {
      id,
      vaultFileId: id,
      name: file.name,
      size: file.size,
      mimeType,
      title: opts.title.trim() || file.name,
      uploadedAt: nowIso,
      uploadedBy: opts.uploadedBy,
      uploadedById: opts.uploadedById,
      ...(opts.instalasiId ? { instalasiId: opts.instalasiId } : {}),
    },
  };
}
