import {
  hasSessionToken,
  remoteDeleteFile,
  remoteGetFile,
  remotePutFile,
} from '../services/accountApi';

export interface VaultFileRecord {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
  savedAt: string;
  /** Subfolder tujuan di Google Drive (lihat SUBFOLDERS di Code.gs). */
  folder?: string;
}

const DB_NAME = 'portal_slo_file_vault';
const DB_VERSION = 1;
const STORE_NAME = 'files';

function openVaultDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB tidak tersedia di browser ini.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Gagal membuka brankas file IndexedDB.'));
  });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Gagal membaca file binary.'));
    reader.readAsDataURL(blob);
  });
}

async function putLocal(record: VaultFileRecord): Promise<void> {
  try {
    const db = await openVaultDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(record);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error || new Error('Gagal menyimpan file ke brankas lokal.'));
      };
    });
  } catch {
    // Fallback gracefully if IndexedDB is restricted in strict private mode
  }
}

async function getLocal(id: string): Promise<VaultFileRecord | null> {
  try {
    const db = await openVaultDb();
    return await new Promise<VaultFileRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => {
        db.close();
        resolve((req.result as VaultFileRecord | undefined) || null);
      };
      req.onerror = () => {
        db.close();
        reject(req.error || new Error('Gagal membaca file dari brankas lokal.'));
      };
    });
  } catch {
    return null;
  }
}

async function deleteLocal(id: string): Promise<void> {
  try {
    const db = await openVaultDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error || new Error('Gagal menghapus file dari brankas lokal.'));
      };
    });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Simpan dokumen: server (Google Drive akun pemilik) + salinan lokal sebagai cadangan.
 * Mengembalikan true bila berhasil tersimpan di server, false bila hanya tersimpan di perangkat ini.
 */
export async function putVaultFile(record: VaultFileRecord): Promise<boolean> {
  await putLocal(record);
  if (!hasSessionToken()) return false;
  try {
    await remotePutFile(record);
    return true;
  } catch {
    return false;
  }
}

/** Ambil dokumen: server lebih dulu (agar sama di semua perangkat), lalu salinan lokal. */
export async function getVaultFile(id: string): Promise<VaultFileRecord | null> {
  if (hasSessionToken()) {
    try {
      const remote = await remoteGetFile(id);
      if (remote) {
        void putLocal(remote);
        return remote;
      }
    } catch {
      // server tidak terjangkau: pakai salinan lokal
    }
  }
  return getLocal(id);
}

export async function deleteVaultFile(id: string): Promise<void> {
  await deleteLocal(id);
  if (!hasSessionToken()) return;
  try {
    await remoteDeleteFile(id);
  } catch {
    // abaikan: file yatim di Drive tidak mengganggu portal
  }
}

export function triggerDataUrlDownload(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
