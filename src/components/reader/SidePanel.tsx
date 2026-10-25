"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useLocale, type MessageKey } from "@/lib/i18n";
import { useClosedByBack } from "@/lib/back";
import styles from "./SidePanel.module.css";

export type PanelMode = "word" | "translations" | "tafsir" | "quran" | "notes" | "tajweed";

export interface PanelState {
  mode: PanelMode;
  verseKey: string;
  wordPosition?: number;
  /** The rule of tajweed the panel was opened on, by its name in the corpus. */
  rule?: string;
}

const KICKER: Record<PanelMode, MessageKey> = {
  word: "panel.word",
  translations: "panel.translations",
  tafsir: "panel.tafsir",
  quran: "panel.quran",
  notes: "panel.notes",
  tajweed: "panel.tajweed",
};

/**
 * What the panel can be about, in two steps rather than one long row: first
 * the thing — the word, the ayah, or the reader's own notes — and then, under
 * it, which way of looking at that thing. Never more than three of either, so
 * every choice is in sight at once on a phone, and the first thing a reader
 * meets is the question they actually have: about this word, or this ayah?
 */
type Level = "word" | "ayah" | "notes";

const LEVEL_OF: Record<PanelMode, Level> = {
  word: "word",
  tajweed: "word",
  translations: "ayah",
  tafsir: "ayah",
  quran: "ayah",
  notes: "notes",
};

const LEVELS: Level[] = ["word", "ayah", "notes"];

const UNDER: Record<Level, PanelMode[]> = {
  word: ["word", "tajweed"],
  ayah: ["translations", "tafsir", "quran"],
  notes: ["notes"],
};

const LEVEL_LABEL: Record<Level, MessageKey> = {
  word: "panel.level.word",
  ayah: "panel.level.ayah",
  notes: "panel.notes",
};

const UNDER_LABEL: Record<PanelMode, MessageKey> = {
  word: "panel.sub.word",
  tajweed: "panel.tajweed",
  translations: "panel.translations",
  tafsir: "panel.tafsir",
  quran: "panel.quran",
  notes: "panel.notes",
};

const LEVEL_ICON: Record<Level, ReactNode> = {
  // A letter: the word.
  word: <text x="12" y="17" textAnchor="middle" fontSize="15" fill="currentColor" stroke="none" fontFamily="var(--font-amiri), serif">ع</text>,
  // The sign that ends an ayah.
  ayah: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2" />
    </>
  ),
  notes: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </>
  ),
};

interface Props {
  state: PanelState;
  title: string;
  onSwitch: (mode: PanelMode) => void;
  onClose: () => void;
  /** How many notes the reader has on this ayah: shown on the way to them. */
  noteCount?: number;
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
export function SidePanel({ state, title, onSwitch, onClose, noteCount = 0, children }: Props) {
  const ref = useRef<HTMLElement>(null);
  const { t, n } = useLocale();
  const level = LEVEL_OF[state.mode];
  // Each level goes back to the way of looking at it the reader last chose.
  const lastUnder = useRef<Record<Level, PanelMode>>({ word: "word", ayah: "tafsir", notes: "notes" });
  useEffect(() => {
    lastUnder.current[LEVEL_OF[state.mode]] = state.mode;
  }, [state.mode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useClosedByBack(true, onClose);

  // Scroll the panel back to the top when it changes what it is about, rather
  // than leaving the reader halfway down the previous ayah's tafsir.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [state.mode, state.verseKey, state.wordPosition]);


  return (
    <aside ref={ref} className={styles.panel} aria-label={t("panel.label", { kind: t(KICKER[state.mode]), key: state.verseKey })}>
      <div className={styles.head}>
        <div className={styles.headText}>
          <div className={`kicker kicker-sm ${styles.kicker}`}>{t(KICKER[state.mode])}</div>
          <div className={styles.title}>{title}</div>
        </div>
        <button onClick={onClose} className={`btn btn-icon ${styles.close}`} aria-label={t("panel.close")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      <nav className={styles.nav} aria-label={t("panel.tabs")}>
        <div className={styles.levels} role="tablist">
          {LEVELS.map((l) => (
            <button
              key={l}
              role="tab"
              aria-selected={level === l}
              onClick={() => onSwitch(lastUnder.current[l])}
              className={`${styles.level} ${level === l ? styles.levelOn : ""}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {LEVEL_ICON[l]}
              </svg>
              <span>{t(LEVEL_LABEL[l])}</span>
              {l === "notes" && noteCount > 0 && <span className={styles.badge}>{n(noteCount)}</span>}
            </button>
          ))}
        </div>
        {UNDER[level].length > 1 && (
          <div className={styles.unders} role="tablist">
            {UNDER[level].map((mode) => (
              <button
                key={mode}
                role="tab"
                aria-selected={state.mode === mode}
                onClick={() => onSwitch(mode)}
                className={`${styles.under} ${state.mode === mode ? styles.underOn : ""}`}
              >
                {t(UNDER_LABEL[mode])}
              </button>
            ))}
          </div>
        )}
      </nav>

      <div className={styles.scroll} ref={scrollRef}>
        {children}
      </div>
    </aside>
  );
}
