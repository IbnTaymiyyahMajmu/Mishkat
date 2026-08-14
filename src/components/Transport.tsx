"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePlayer } from "@/lib/audio/player";
import { useChapters } from "@/lib/store/chapters";
import { useSettings, type Repeat } from "@/lib/store/settings";
import { RECITERS } from "@/lib/quran/resources";
import { formatClock } from "@/lib/text";
import styles from "./Transport.module.css";

/** Slow enough to follow an unfamiliar word, fast enough to review a page. */
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
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

  // Voice and pace belong to the recitation, so they are reachable from the
  // transport itself rather than only from the settings page — the reader who
  // wants a slower ʿAfasy is listening, not configuring, and on a phone the
  // settings page is two navigations and a lost place away.
  const [tuning, setTuning] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  const closeTuning = useCallback(() => setTuning(false), []);

  useEffect(() => {
    if (!tuning) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeTuning();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!barRef.current?.contains(e.target as Node)) closeTuning();
    };
    // Capture, so Escape closes the panel before the reader's page sees it.
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [tuning, closeTuning]);

  // Nothing to tune once the transport has gone: the panel should not be
  // waiting, still open, the next time a reader presses play. Adjusted during
  // render rather than in an effect, so it never renders in the stale state.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) setTuning(false);
  }

  if (!open || !currentKey) return null;

  const surah = byId(Number(currentKey.split(":")[0]));
  const reciter = RECITERS.find((r) => r.id === settings.reciterId);
  const progress = duration > 0 ? (elapsed / duration) * 100 : 0;

  const onScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (duration > 0) seek((Number(e.target.value) / 100) * duration);
  };

  return (
    <div className={styles.bar} ref={barRef}>
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

      {tuning && (
        <div className={styles.panel} role="group" aria-label="Recitation settings">
          <section className={styles.group}>
            <h2 className={styles.groupTitle}>Reciter</h2>
            <div className={styles.chips}>
              {RECITERS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => update({ reciterId: r.id })}
                  aria-pressed={settings.reciterId === r.id}
                  className={`btn btn-secondary ${styles.chip} ${
                    settings.reciterId === r.id ? "btn-on" : ""
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <p className={styles.groupNote}>
              The surah is fetched again in the new voice; the recitation carries on where it is.
            </p>
          </section>

          <div className={styles.groupRow}>
            <section className={styles.group}>
              <h2 className={styles.groupTitle}>Speed</h2>
              <div className={styles.chips}>
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    onClick={() => update({ speed: s })}
                    aria-pressed={settings.speed === s}
                    className={`btn btn-secondary ${styles.chip} ${styles.numeric} ${
                      settings.speed === s ? "btn-on" : ""
                    }`}
                  >
                    {s}×
                  </button>
                ))}
              </div>
            </section>

            <section className={styles.group}>
              <h2 className={styles.groupTitle}>Repeat</h2>
              <div className={styles.chips}>
                {REPEATS.map((r) => (
                  <button
                    key={r}
                    onClick={() => update({ repeat: r })}
                    aria-pressed={settings.repeat === r}
                    className={`btn btn-secondary ${styles.chip} ${
                      settings.repeat === r ? "btn-on" : ""
                    }`}
                  >
                    {REPEAT_LABEL[r]}
                  </button>
                ))}
              </div>
            </section>

            <section className={styles.group}>
              <h2 className={styles.groupTitle}>Follow</h2>
              <div className={styles.chips}>
                <button
                  onClick={() => update({ follow: !settings.follow })}
                  aria-pressed={settings.follow}
                  className={`btn btn-secondary ${styles.chip} ${settings.follow ? "btn-on" : ""}`}
                >
                  {settings.follow ? "Scrolling with it" : "Staying put"}
                </button>
              </div>
            </section>
          </div>
        </div>
      )}

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

        <button
          onClick={() => setTuning((t) => !t)}
          className={`btn btn-icon ${styles.small} ${tuning ? "btn-on" : ""}`}
          aria-expanded={tuning}
          aria-label="Reciter, speed and repeat"
          title="Reciter, speed and repeat"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h10M18 18h2" />
            <circle cx="16" cy="6" r="2" />
            <circle cx="8" cy="12" r="2" />
            <circle cx="16" cy="18" r="2" />
          </svg>
        </button>

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
