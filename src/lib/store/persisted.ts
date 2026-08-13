/**
 * A value kept in localStorage and read through `useSyncExternalStore`.
 *
 * Loading persisted state on mount and calling setState is the obvious way to
 * do this and the wrong one: it renders the default first, then replaces it,
 * so the reader watches their own settings arrive a frame late. Treating the
 * browser's storage as what it is — an external store React subscribes to —
 * removes that flash, removes the effect, and makes a second tab agree with
 * the first for nothing.
 */
export interface PersistedStore<T> {
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => T;
  getServerSnapshot: () => T;
  set: (next: T) => void;
}

export function createPersistedStore<T>(
  key: string,
  fallback: T,
  revive: (stored: unknown, fallback: T) => T,
): PersistedStore<T> {
  const listeners = new Set<() => void>();
  // getSnapshot is called on every render and must return a stable reference
  // for unchanged data, or React re-renders forever.
  let cachedRaw: string | null | undefined;
  let cachedValue: T = fallback;

  const notify = () => listeners.forEach((l) => l());

  const getSnapshot = (): T => {
    if (typeof localStorage === "undefined") return fallback;
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(key);
    } catch {
      return fallback; // private mode
    }
    if (raw === cachedRaw) return cachedValue;
    cachedRaw = raw;
    try {
      cachedValue = raw ? revive(JSON.parse(raw), fallback) : fallback;
    } catch {
      cachedValue = fallback;
    }
    return cachedValue;
  };

  return {
    subscribe(onChange) {
      listeners.add(onChange);
      const onStorage = (e: StorageEvent) => {
        if (e.key === key || e.key === null) onChange();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(onChange);
        window.removeEventListener("storage", onStorage);
      };
    },
    getSnapshot,
    getServerSnapshot: () => fallback,
    set(next) {
      try {
        const serialised = JSON.stringify(next);
        localStorage.setItem(key, serialised);
        cachedRaw = serialised;
        cachedValue = next;
      } catch {
        // Storage refused; hold the value for this session so the interface
        // still responds to what the reader just chose.
        cachedRaw = undefined;
        cachedValue = next;
      }
      notify();
    },
  };
}
