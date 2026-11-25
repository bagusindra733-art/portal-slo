import { useEffect, useState } from 'react';

const PREFIX = 'slo_ui:';

/**
 * useState yang nilainya disimpan di sessionStorage, sehingga tampilan (tab, filter, pencarian,
 * editor yang terbuka) tetap sama setelah halaman di-refresh. Dihapus saat logout.
 */
export function usePersistedState<T>(key: string, initial: T) {
  const storageKey = PREFIX + key;
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw !== null) return JSON.parse(raw) as T;
    } catch {
      /* abaikan */
    }
    return initial;
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      /* abaikan */
    }
  }, [storageKey, value]);
  return [value, setValue] as const;
}

export function clearPersistedUi() {
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* abaikan */
  }
}
