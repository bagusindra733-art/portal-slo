import { useState } from 'react';
import { AlertCircle, Database, Download, ExternalLink, Upload, X } from 'lucide-react';
import { AppDatabaseState, SheetsSyncMeta } from '../types/portal';
import { remoteGetDb, remotePutDb } from '../services/accountApi';
import { formatDateTime } from '../utils/portalUtils';

interface SheetsDatabaseModalProps {
  isOpen: boolean;
  readOnly?: boolean;
  onClose: () => void;
  sheetsMeta: SheetsSyncMeta;
  state: AppDatabaseState;
  onUpdateMeta: (meta: SheetsSyncMeta) => void;
  onReplaceState: (next: AppDatabaseState) => void;
  onToast: (msg: string) => void;
}

/** Sinkronisasi data portal ke server (Google Drive akun pemilik). Tanpa login Google pengunjung. */
export function SheetsDatabaseModal({
  isOpen,
  readOnly = false,
  onClose,
  sheetsMeta,
  state,
  onUpdateMeta,
  onReplaceState,
  onToast,
}: SheetsDatabaseModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'push' | 'pull' | null>(null);

  if (!isOpen) return null;

  const run = async (kind: 'push' | 'pull') => {
    setConfirm(null);
    setLoading(true);
    setError(null);
    try {
      if (kind === 'push') {
        const info = await remotePutDb(state);
        onUpdateMeta({
          spreadsheetId: 'server',
          spreadsheetTitle: 'Server Portal SLO',
          spreadsheetUrl: info.folderUrl,
          lastSyncAt: info.updatedAt,
          syncStatus: 'connected',
        });
        onToast('Data portal berhasil disimpan ke server.');
      } else {
        const { state: next, info } = await remoteGetDb<AppDatabaseState>();
        onReplaceState({ ...next, role: state.role });
        onUpdateMeta({
          spreadsheetId: 'server',
          spreadsheetTitle: 'Server Portal SLO',
          spreadsheetUrl: info.folderUrl,
          lastSyncAt: info.updatedAt || new Date().toISOString(),
          syncStatus: 'connected',
        });
        onToast('Data portal berhasil dimuat dari server.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sinkronisasi gagal.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/65 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl my-8">
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-slate-900">Database Portal</h3>
              <p className="text-xs text-slate-500">
                Tersimpan di Google Drive akun pengelola. Tidak perlu login Google.
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

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 space-y-1">
          <div>
            Sinkron terakhir:{' '}
            <span className="font-semibold text-slate-800">
              {sheetsMeta.lastSyncAt ? formatDateTime(sheetsMeta.lastSyncAt) : 'belum pernah'}
            </span>
          </div>
          {sheetsMeta.spreadsheetUrl && (
            <a
              href={sheetsMeta.spreadsheetUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline"
            >
              Buka folder Drive <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            disabled={loading || readOnly}
            onClick={() => setConfirm('push')}
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold px-4 py-3 cursor-pointer"
          >
            <Upload className="w-4 h-4" /> Simpan ke Server
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => setConfirm('pull')}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-800 text-sm font-bold px-4 py-3 cursor-pointer"
          >
            <Download className="w-4 h-4" /> Muat dari Server
          </button>
        </div>
        {readOnly && (
          <p className="mt-2 text-[11px] text-slate-500">Peran Direktur hanya dapat memuat data (baca saja).</p>
        )}
        {loading && <p className="mt-3 text-xs text-slate-500">Memproses…</p>}

        {confirm && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
            <p className="text-xs text-amber-900">
              {confirm === 'push'
                ? 'Data di server akan DITIMPA dengan data di perangkat ini (proyek, personel, alat, dokumen).'
                : 'Data di perangkat ini akan DIGANTI dengan data dari server.'}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void run(confirm)}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer"
              >
                Ya, lanjutkan
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
