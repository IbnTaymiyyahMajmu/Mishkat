"use client";

import { usePlayer } from "@/lib/audio/player";
import { useChapters } from "@/lib/store/chapters";
import { useSettings, type Repeat } from "@/lib/store/settings";
import { RECITERS } from "@/lib/quran/resources";
import { formatClock } from "@/lib/text";
import styles from "./Transport.module.css";

const SPEEDS = [0.75, 1, 1.25, 1.5];
const REPEATS: Repeat[] = ["off", "ayah", "surah"];
const REPEAT_LABEL: Record<Repeat, string> = {
  off: "Repeat off",
  ayah: "Repeat ayah",
  surah: "Repeat surah",
};

export function Transport() {
  const { open, playing, currentKey, elapsed, duration, error, toggle, stop, step, seek } = usePlayer();
  const { settings, update } = useSettings();
  const { byId } = useChapters();

  if (!open || !currentKey) return null;

  const surah = byId(Number(currentKey.split(":")[0]));
  const reciter = RECITERS.find((r) => r.id === settings.reciterId);
  const progress = duration > 0 ? (elapsed / duration) * 100 : 0;

  const onScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (duration > 0) seek((Number(e.target.value) / 100) * duration);
  };

  return (
    <div className={styles.bar}>
      <label className={styles.scrubWrap}>
        <span className="sr-only">Seek within this ayah</span>
        <input
          className={styles.scrub}
          type="range"
          min={0}
          max={100}
          step={0.1}
          value={Number.isFinite(progress) ? progress : 0}
          onChange={onScrub}
          disabled={duration === 0}
          style={{ "--progress": `${progress}%` } as React.CSSProperties}
        />
      </label>

      <div className={styles.row}>
        <button onClick={toggle} className={`btn btn-icon btn-primary ${styles.play}`} aria-label={playing ? "Pause" : "Play"}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            {playing ? <path d="M10 4H6v16h4zM18 4h-4v16h4z" /> : <path d="m6 4 14 8-14 8z" />}
          </svg>
        </button>

        <button onClick={() => step(-1)} className={`btn btn-icon ${styles.small}`} aria-label="Previous ayah">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 20 9 12l10-8z" />
            <path d="M5 19V5" />
          </svg>
        </button>
        <button onClick={() => step(1)} className={`btn btn-icon ${styles.small}`} aria-label="Next ayah">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
            <path d="m5 4 10 8-10 8z" />
            <path d="M19 5v14" />
          </svg>
        </button>

        <div className={styles.now}>
          <div className={styles.nowTitle}>
            {surah ? `${surah.name_simple} · ` : ""}
            {currentKey}
          </div>
          <div className={styles.nowMeta}>
            {error ? error : `${reciter?.label ?? "Reciter"} · ${formatClock(elapsed)} / ${formatClock(duration)}`}
          </div>
        </div>

        <div className={styles.controls}>
          <button
            onClick={() => update({ repeat: REPEATS[(REPEATS.indexOf(settings.repeat) + 1) % REPEATS.length] })}
            className={`btn btn-secondary ${styles.chip} ${settings.repeat !== "off" ? "btn-on" : ""}`}
          >
            {REPEAT_LABEL[settings.repeat]}
          </button>
          <button
            onClick={() => update({ speed: SPEEDS[(SPEEDS.indexOf(settings.speed) + 1) % SPEEDS.length] })}
            className={`btn btn-secondary ${styles.chip} ${styles.numeric}`}
          >
            {settings.speed}×
          </button>
          <button
            onClick={() => update({ follow: !settings.follow })}
            className={`btn btn-secondary ${styles.chip} ${settings.follow ? "btn-on" : ""}`}
            aria-pressed={settings.follow}
          >
            Follow
          </button>
        </div>

        <button onClick={stop} className={`btn btn-icon ${styles.small}`} aria-label="Close the player">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
