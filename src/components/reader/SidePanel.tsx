"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./SidePanel.module.css";

export type PanelMode = "word" | "tafsir" | "notes";

export interface PanelState {
  mode: PanelMode;
  verseKey: string;
  wordPosition?: number;
}

const KICKER: Record<PanelMode, string> = {
  word: "Word study",
  tafsir: "Tafsir",
  notes: "Notes",
};

interface Props {
  state: PanelState;
  title: string;
  onSwitch: (mode: PanelMode) => void;
  onClose: () => void;
  children: ReactNode;
}

/**
 * The study surface. Beside the text on a wide screen, a bottom sheet on a
 * phone — the same component either way, because a reader who opens tafsir on
 * a laptop and finishes it on a phone should not meet two different things.
 *
 * It never covers the ayah it is about on desktop: the reader column narrows
 * instead, so the text stays in view while it is being studied.
 */
export function SidePanel({ state, title, onSwitch, onClose, children }: Props) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Scroll the panel back to the top when it changes what it is about, rather
  // than leaving the reader halfway down the previous ayah's tafsir.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [state.mode, state.verseKey, state.wordPosition]);

  const modes: PanelMode[] = ["word", "tafsir", "notes"];

  return (
    <aside ref={ref} className={styles.panel} aria-label={`${KICKER[state.mode]} for ${state.verseKey}`}>
      <div className={styles.head}>
        <div className={styles.headText}>
          <div className={`kicker kicker-sm ${styles.kicker}`}>{KICKER[state.mode]}</div>
          <div className={styles.title}>{title}</div>
        </div>
        <button onClick={onClose} className={`btn btn-icon ${styles.close}`} aria-label="Close the study panel">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Study view">
        {modes.map((mode) => (
          <button
            key={mode}
            role="tab"
            aria-selected={state.mode === mode}
            onClick={() => onSwitch(mode)}
            className={`${styles.tab} ${state.mode === mode ? styles.tabOn : ""}`}
          >
            {KICKER[mode]}
          </button>
        ))}
      </div>

      <div className={styles.scroll} ref={scrollRef}>
        {children}
      </div>
    </aside>
  );
}
