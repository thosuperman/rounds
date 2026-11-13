import { useEffect, useState } from 'react';
import { deviceAvailability, type DeviceAvailability } from './ai/hybrid';

export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

/** Subscribe to a live Firestore query helper of the form watchX(cb) => unsubscribe. */
export function useLive<T>(watch: ((cb: (rows: T[]) => void) => () => void) | null, deps: unknown[] = []) {
  const [rows, setRows] = useState<T[]>([]);
  useEffect(() => {
    if (!watch) return;
    return watch(setRows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return rows;
}

export function useDeviceModel() {
  const [state, setState] = useState<DeviceAvailability | 'checking'>('checking');
  useEffect(() => {
    let alive = true;
    const check = () => deviceAvailability().then((s) => alive && setState(s));
    check();
    const t = setInterval(check, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return [state, setState] as const;
}
