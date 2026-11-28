import { useCallback, useEffect, useRef, useState } from 'react';

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'click',
];

interface IdleOptions {
  /** Lama tanpa aktivitas sebelum keluar otomatis (ms). */
  idleMs: number;
  /** Berapa lama peringatan ditampilkan sebelum keluar (ms). */
  warnMs: number;
}

/**
 * Keluar otomatis bila pengguna tidak aktif. Memakai penanda waktu (bukan setTimeout panjang)
 * sehingga tetap akurat saat tab di latar belakang / laptop sempat tidur.
 * Saat peringatan tampil, gerakan mouse tidak membatalkannya: pengguna harus menekan "Tetap Masuk".
 */
export function useIdleLogout(enabled: boolean, onTimeout: () => void, { idleMs, warnMs }: IdleOptions) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const lastActivity = useRef(Date.now());
  const warning = useRef(false);
  const timeoutRef = useRef(onTimeout);
  timeoutRef.current = onTimeout;

  const stayActive = useCallback(() => {
    lastActivity.current = Date.now();
    warning.current = false;
    setSecondsLeft(null);
  }, []);

  useEffect(() => {
    if (!enabled) {
      warning.current = false;
      setSecondsLeft(null);
      return;
    }
    lastActivity.current = Date.now();

    const onActivity = () => {
      if (!warning.current) lastActivity.current = Date.now();
    };
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));

    const timer = window.setInterval(() => {
      const idle = Date.now() - lastActivity.current;
      if (idle >= idleMs) {
        warning.current = false;
        setSecondsLeft(null);
        timeoutRef.current();
      } else if (idle >= idleMs - warnMs) {
        warning.current = true;
        setSecondsLeft(Math.ceil((idleMs - idle) / 1000));
      }
    }, 1000);

    return () => {
      window.clearInterval(timer);
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, onActivity));
    };
  }, [enabled, idleMs, warnMs]);

  return { secondsLeft, stayActive };
}
