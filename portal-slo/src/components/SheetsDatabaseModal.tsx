import { useEffect, useState } from 'react';
import {
  FileSpreadsheet,
  PlusCircle,
  Download,
  Upload,
  ExternalLink,
  X,
  AlertCircle,
  CheckCircle2,
  Link2,
} from 'lucide-react';
import { AppDatabaseState, SheetsSyncMeta } from '../types/portal';
import {
  createDatabaseSpreadsheet,
  DriveSpreadsheetFile,
  listAppSpreadsheets,
  pullDatabaseFromSheets,
  pushDatabaseToSheets,
} from '../services/googleSheets';
import { formatDateTime } from '../utils/portalUtils';

interface SheetsDatabaseModalProps {
  isOpen: boolean;
  readOnly?: boolean;
  onClose: () => void;
  accessToken: string | null;
  sheetsMeta: SheetsSyncMeta;
  state: AppDatabaseState;
  onGoogleLoginRequest: () => Promise<void>;
  onUpdateMeta: (meta: SheetsSyncMeta) => void;
  onReplaceState: (next: AppDatabaseState) => void;
  onToast: (msg: string) => void;
}

interface PendingConfirm {
  title: string;
  description: string;
  confirmLabel: string;
  action: () => Promise<void>;
}

export function SheetsDatabaseModal({
  isOpen,
  readOnly = false,
  onClose,
  accessToken,
  sheetsMeta,
  state,
  onGoogleLoginRequest,
  onUpdateMeta,
  onReplaceState,
  onToast,
}: SheetsDatabaseModalProps) {
  const [newTitle, setNewTitle] = useState('Database Portal SLO — PT Sabda Duta Paramitha');
  const [customSheetId, setCustomSheetId] = useState(sheetsMeta.spreadsheetId || '');
  const [driveFiles, setDriveFiles] = useState<DriveSpreadsheetFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  useEffect(() => {
    if (!isOpen || !accessToken) return;
    setError(null);
    listAppSpreadsheets(accessToken)
      .then((files) => setDriveFiles(files))
      .catch((err: Error) => setError(err.message));
  }, [isOpen, accessToken]);

  if (!isOpen) return null;

  const extractSpreadsheetId = (input: string): string => {
    const trimmed = input.trim();
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : trimmed;
  };

  const handleCreateNew = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const meta = await createDatabaseSpreadsheet(accessToken, newTitle.trim() || 'Database Portal SLO', state);
      onUpdateMeta({
        spreadsheetId: meta.spreadsheetId,
        spreadsheetTitle: meta.properties.title,
        spreadsheetUrl: meta.spreadsheetUrl,
        lastSyncAt: new Date().toISOString(),
        syncStatus: 'connected',
      });
      setCustomSheetId(meta.spreadsheetId);
      const updatedList = await listAppSpreadsheets(accessToken);
      setDriveFiles(updatedList);
      onToast(`Spreadsheet "${meta.properties.title}" berhasil dibuat & disinkronkan!`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal membuat Spreadsheet');
    } finally {
      setLoading(false);
    }
  };

  const handlePull = async (targetId: string) => {
    if (!accessToken) return;
    const id = extractSpreadsheetId(targetId);
    if (!id) {
      setError('Masukkan ID atau URL Google Spreadsheet terlebih dahulu.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { state: pulledState, meta } = await pullDatabaseFromSheets(accessToken, id, state);
      onReplaceState(pulledState);
      onUpdateMeta({
        spreadsheetId: meta.spreadsheetId,
        spreadsheetTitle: meta.properties.title,
        spreadsheetUrl: meta.spreadsheetUrl,
        lastSyncAt: new Date().toISOString(),
        syncStatus: 'connected',
      });
      setCustomSheetId(meta.spreadsheetId);
      onToast(`Data berhasil dimuat dari "${meta.properties.title}"`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal membaca Google Sheets');
    } finally {
      setLoading(false);
    }
  };

  const requestPushWithConfirmation = (targetId: string) => {
    const id = extractSpreadsheetId(targetId);
    if (!id) {
      setError('Masukkan ID atau URL Google Spreadsheet terlebih dahulu.');
      return;
    }
    setPendingConfirm({
      title: 'Konfirmasi Simpan & Perbarui Google Sheets',
      description: `Operasi ini akan menimpa/memperbarui seluruh 7 tab database (Proyek: ${state.proj.length} baris, Inspektor: ${state.insp.length} baris, AlatUji: ${state.tools.length} baris, RekapSOJO: ${(state.joSoRecords || []).length} baris, SuratTugas, SuratJalan, dan JSA) pada Google Spreadsheet ID "${id}". Pastikan Anda ingin memperbarui data spreadsheet tersebut.`,
      confirmLabel: 'Konfirmasi & Simpan ke Sheets',
      action: async () => {
        if (!accessToken) return;
        setLoading(true);
        setError(null);
        try {
          const meta = await pushDatabaseToSheets(accessToken, id, state);
          onUpdateMeta({
            spreadsheetId: meta.spreadsheetId,
            spreadsheetTitle: meta.properties.title,
            spreadsheetUrl: meta.spreadsheetUrl,
            lastSyncAt: new Date().toISOString(),
            syncStatus: 'connected',
          });
          setCustomSheetId(meta.spreadsheetId);
          onToast(`Semua data berhasil disimpan ke "${meta.properties.title}"`);
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : 'Gagal menyimpan ke Google Sheets');
        } finally {
          setLoading(false);
        }
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/65 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl my-8">
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-slate-900">
                Database Google Sheets
              </h3>
              <p className="text-xs text-slate-500">
                Simpan dan baca Proyek, Inspektor, Alat Uji, Rekap SO/JO, Surat Tugas, Surat Jalan, & JSA
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!accessToken ? (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
            <h4 className="font-display text-sm font-bold text-slate-900">
              Hubungkan Akun Google Anda
            </h4>
            <p className="text-xs text-slate-600 mt-1.5 mb-5 max-w-md mx-auto">
              Untuk membuat atau menyinkronkan database ke Google Sheets, masuk dengan akun Google
              terlebih dahulu agar izin akses Google Sheets dan Google Drive aktif.
            </p>
            <div className="max-w-xs mx-auto">
              <button
                type="button"
                onClick={onGoogleLoginRequest}
                className="gsi-material-button"
              >
                <div className="gsi-material-button-content-wrapper">
                  <div className="gsi-material-button-icon">
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    </svg>
                  </div>
                  <span className="gsi-material-button-contents">Sign in with Google</span>
                </div>
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            {/* Active connection status */}
            {sheetsMeta.spreadsheetId && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 truncate">
                      {sheetsMeta.spreadsheetTitle}
                    </div>
                    <div className="text-xs text-slate-600 font-mono truncate">
                      ID: {sheetsMeta.spreadsheetId}
                    </div>
                    {sheetsMeta.lastSyncAt && (
                      <div className="text-[11px] text-emerald-700 mt-0.5">
                        Terakhir sinkron: {formatDateTime(sheetsMeta.lastSyncAt)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={sheetsMeta.spreadsheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-white border border-emerald-200 text-emerald-700 text-xs font-semibold hover:bg-emerald-50 inline-flex items-center gap-1.5"
                  >
                    Buka Sheets <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            )}

            {readOnly && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-xs text-amber-900 font-medium">
                <b>Mode Review (Hanya Baca):</b> Pengubahan atau penyimpanan ke Google Sheets dinonaktifkan. Anda tetap dapat memuat atau membuka tautan spreadsheet.
              </div>
            )}

            {/* Create new database spreadsheet */}
            {!readOnly && (
              <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  1. Buat Spreadsheet Database Baru
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Nama Spreadsheet baru"
                    className="flex-1 h-10 rounded-xl border border-slate-200 px-3 text-sm"
                  />
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleCreateNew}
                    className="h-10 px-4 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>{loading ? 'Memproses...' : 'Buat & Isi Database'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Connect or Sync existing spreadsheet */}
            <div className="rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                2. Sinkronkan dengan Spreadsheet yang Ada
              </div>

              {driveFiles.length > 0 && (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    Pilih dari Google Drive Anda (file aplikasi)
                  </label>
                  <select
                    value={customSheetId}
                    onChange={(e) => setCustomSheetId(e.target.value)}
                    className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
                  >
                    <option value="">Pilih spreadsheet…</option>
                    {driveFiles.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  Atau tempel ID / URL Google Spreadsheet
                </label>
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    value={customSheetId}
                    onChange={(e) => setCustomSheetId(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/... atau Spreadsheet ID"
                    className="flex-1 h-10 rounded-xl border border-slate-200 px-3 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  disabled={loading || !customSheetId.trim()}
                  onClick={() => handlePull(customSheetId)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 disabled:opacity-45 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Muat Data dari Sheets (Pull)</span>
                </button>
                {!readOnly && (
                  <button
                    type="button"
                    disabled={loading || !customSheetId.trim()}
                    onClick={() => requestPushWithConfirmation(customSheetId)}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-45 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Simpan Data ke Sheets (Push)</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Explicit Confirmation Modal for Spreadsheet Mutation (Mandatory per Skill) */}
      {pendingConfirm && (
        <div className="fixed inset-0 z-60 bg-slate-950/75 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h4 className="font-display text-base font-bold text-slate-900">
              {pendingConfirm.title}
            </h4>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              {pendingConfirm.description}
            </p>
            <div className="mt-5 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setPendingConfirm(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  const fn = pendingConfirm.action;
                  setPendingConfirm(null);
                  await fn();
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 cursor-pointer"
              >
                {pendingConfirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
