import { useEffect, useRef, useState } from 'react';
import { AppDatabaseState, Role } from '../types/portal';
import { seedDatabase } from '../utils/portalUtils';
import {
  ApiConflictError,
  ApiNotFoundError,
  remoteDbVersion,
  remoteGetDb,
  remotePutDb,
} from '../services/accountApi';

export type SyncStatus = 'off' | 'loading' | 'saved' | 'saving' | 'error';

const SAVE_DELAY_MS = 2000;
const POLL_MS = 45000;

const canWrite = (role: Role) => role === 'teknis' || role === 'sales' || role === 'pjt' || role === 'inspektor';
const canRead = (role: Role) => role !== 'klien';

/** Peran tidak ikut disimpan: itu milik sesi masing-masing pengguna. */
const snapshot = (db: AppDatabaseState) => JSON.stringify({ ...db, role: null });

/**
 * Sinkron otomatis data portal ke server (Drive akun pemilik Apps Script):
 * muat saat login, simpan otomatis setelah ada perubahan, dan ambil perubahan orang lain berkala.
 */
export function useServerSync(
  loggedIn: boolean,
  db: AppDatabaseState,
  setDb: (next: AppDatabaseState) => void,
  onToast: (msg: string) => void
) {
  const [status, setStatus] = useState<SyncStatus>('off');
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  const dbRef = useRef(db);
  dbRef.current = db;
  const ready = useRef(false); // sudah selesai muat awal
  const serverAt = useRef(''); // versi server terakhir yang dipegang
  const savedJson = useRef(''); // isi terakhir yang sama dengan server
  const busy = useRef(false);
  const toastRef = useRef(onToast);
  toastRef.current = onToast;

  const apply = (remote: AppDatabaseState, at: string) => {
    const role = dbRef.current.role;
    const next = { ...seedDatabase(), ...remote, role };
    savedJson.current = snapshot(next);
    serverAt.current = at;
    setLastSyncAt(at || new Date().toISOString());
    setDb(next);
  };

  const pull = async () => {
    const { state, info } = await remoteGetDb<AppDatabaseState>();
    apply(state, info.updatedAt);
  };

  const push = async () => {
    const current = dbRef.current;
    const json = snapshot(current);
    const info = await remotePutDb({ ...current, role: current.role }, serverAt.current);
    savedJson.current = json;
    serverAt.current = info.updatedAt;
    setLastSyncAt(info.updatedAt);
  };

  // Muat awal (dipakai saat login, dan dicoba ulang berkala bila gagal)
  const initialLoad = async (isCancelled: () => boolean = () => false) => {
    const role = dbRef.current.role;
    busy.current = true;
    setStatus('loading');
    try {
      try {
        await pull();
      } catch (err) {
        if (!(err instanceof ApiNotFoundError)) throw err;
        serverAt.current = '';
        if (canWrite(role)) await push(); // server masih kosong: isi dengan data sekarang
      }
      if (!isCancelled()) {
        ready.current = true;
        setStatus('saved');
      }
    } catch {
      if (!isCancelled()) setStatus('error');
    } finally {
      busy.current = false;
    }
  };

  useEffect(() => {
    ready.current = false;
    if (!loggedIn || !canRead(dbRef.current.role)) {
      setStatus('off'); // belum login, atau klien (hanya lokal)
      return;
    }
    let cancelled = false;
    void initialLoad(() => cancelled);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  // Simpan otomatis (ditunda 2 detik setelah perubahan terakhir)
  useEffect(() => {
    if (!ready.current || !canWrite(db.role)) return;
    if (snapshot(db) === savedJson.current) return;
    const timer = setTimeout(async () => {
      if (busy.current) return;
      busy.current = true;
      setStatus('saving');
      try {
        await push();
        setStatus('saved');
      } catch (err) {
        if (err instanceof ApiConflictError) {
          try {
            await pull();
            setStatus('saved');
            toastRef.current('Data diperbarui pengguna lain — versi terbaru dimuat dari server.');
          } catch {
            setStatus('error');
          }
        } else {
          setStatus('error');
        }
      } finally {
        busy.current = false;
      }
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db]);

  // Ambil perubahan orang lain berkala (hanya bila tidak ada perubahan yang belum tersimpan)
  useEffect(() => {
    if (!loggedIn || !canRead(db.role)) return;
    const id = setInterval(async () => {
      if (busy.current) return;
      if (!ready.current) {
        void initialLoad(); // muat awal sebelumnya gagal: coba lagi
        return;
      }
      if (snapshot(dbRef.current) !== savedJson.current) return;
      busy.current = true;
      try {
        const version = await remoteDbVersion();
        if (version !== null && version !== serverAt.current) {
          await pull();
        }
        setStatus((s) => (s === 'error' ? 'saved' : s));
      } catch {
        // abaikan: dicoba lagi di putaran berikutnya
      } finally {
        busy.current = false;
      }
    }, POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn, db.role]);

  return { status, lastSyncAt };
}
