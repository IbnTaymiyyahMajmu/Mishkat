"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./Toast.module.css";

/** How long a message is shown unless it asks for longer. */
const BRIEF = 2400;

const Ctx = createContext<(message: string, ms?: number) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A confirmation is read at a glance. A message that has something to
  // explain — that a translation was withdrawn, and what is shown instead —
  // says how long it needs.
  const show = useCallback((text: string, ms = BRIEF) => {
    setMessage(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), ms);
  }, []);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  return (
    <Ctx.Provider value={show}>
      {children}
      {/* Announced politely: a copy confirmation should not interrupt a
          screen reader mid-ayah. */}
      <div className={styles.region} role="status" aria-live="polite">
        {message && <div className={styles.toast}>{message}</div>}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): (message: string, ms?: number) => void {
  return useContext(Ctx);
}
