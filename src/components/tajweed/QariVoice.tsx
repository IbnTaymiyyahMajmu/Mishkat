"use client";

import { useEffect } from "react";
import { QARIS, isQari, sayWord, stopVoice, useVoice, type VoiceMode } from "@/lib/audio/qari";
import { usePlayerControls, usePlayerStatus } from "@/lib/audio/player";
import { useSettings } from "@/lib/store/settings";
import { useLocale } from "@/lib/i18n";
import styles from "./QariVoice.module.css";

/**
 * A word in a Qari's voice: once, slowly, or listen and repeat — and whose
 * voice, chosen here, where it is wanted. See lib/audio/qari.ts.
 */
export function QariVoice({ verseKey, position }: { verseKey: string; position: number }) {
  const { settings, update } = useSettings();
  const voice = useVoice();
  const { t, n, arabicScript } = useLocale();
  const controls = usePlayerControls();
  const { playing } = usePlayerStatus();
  const id = `${verseKey}:${position}`;
  const mine = voice.word === id;

  // Another word, or the panel closed: the voice stops with it.
  useEffect(() => () => stopVoice(), [id]);

  const go = (mode: VoiceMode) => {
    if (mine && voice.mode === mode) {
      stopVoice();
      return;
    }
    // The recitation in the transport would talk over the teacher.
    if (playing) controls.toggle();
    void sayWord(settings.qari, verseKey, position, mode);
  };

  const button = (mode: VoiceMode, label: string, icon: React.ReactNode) => {
    const on = mine && voice.mode === mode;
    return (
      <button type="button" className={`${styles.button} ${on ? styles.on : ""}`} aria-pressed={on} onClick={() => go(mode)}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {on ? <path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor" stroke="none" /> : icon}
        </svg>
        {label}
      </button>
    );
  };

  return (
    <div className={styles.voice}>
      <div className={styles.buttons}>
        {button("word", t("qari.hear"), <path d="m7 4 13 8-13 8z" fill="currentColor" stroke="none" />)}
        {button(
          "slow",
          t("qari.slow"),
          <>
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 7.5V12l3 2" />
          </>,
        )}
        {button(
          "repeat",
          t("qari.repeat"),
          <>
            <path d="M4 12a8 8 0 0 1 13.7-5.6L20 9" />
            <path d="M20 4v5h-5" />
            <path d="M20 12a8 8 0 0 1-13.7 5.6L4 15" />
            <path d="M4 20v-5h5" />
          </>,
        )}
      </div>

      {mine && voice.mode === "repeat" && (
        <p className={`${styles.cue} ${voice.turn ? styles.cueTurn : ""}`} role="status">
          {voice.turn ? t("qari.yourTurn") : t("qari.listen", { n: n(voice.round) })}
          <span className={styles.rounds} aria-hidden="true">
            {[1, 2, 3].map((r) => (
              <span key={r} className={r <= voice.round ? styles.roundOn : ""} />
            ))}
          </span>
        </p>
      )}
      {voice.missing === id && <p className={styles.cue}>{t("qari.missing")}</p>}

      <label className={styles.pick}>
        <span>{t("qari.voice")}</span>
        <select
          value={settings.qari}
          onChange={(e) => {
            if (isQari(e.target.value)) {
              stopVoice();
              update({ qari: e.target.value });
            }
          }}
        >
          {QARIS.map((q) => (
            <option key={q.id} value={q.id}>
              {arabicScript ? q.arabic : q.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
