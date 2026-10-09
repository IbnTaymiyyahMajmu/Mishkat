"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePlayerControls, usePlayerProgress, usePlayerStatus } from "@/lib/audio/player";
import { useChapters } from "@/lib/store/chapters";
import { useSettings, type Repeat } from "@/lib/store/settings";
import { RECITERS } from "@/lib/quran/resources";
import { formatClock } from "@/lib/text";
import { useLocale, type MessageKey } from "@/lib/i18n";
import { useSurahNames } from "@/lib/i18n/surah";
import styles from "./Transport.module.css";

/** Slow enough to follow an unfamiliar word, fast enough to review a page. */
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const REPEATS: Repeat[] = ["off", "ayah", "surah"];
const REPEAT_LABEL: Record<Repeat, MessageKey> = {
  off: "player.repeat.off",
  ayah: "player.repeat.ayah",
  surah: "player.repeat.surah",
};

/** How many times an ayah is heard, and how many times the passage is gone over. */
const EACH = [1, 2, 3, 5, 10];
/** Nought is until stopped: a passage is sometimes simply left running. */
const TIMES = [1, 2, 3, 5, 10, 0];

const times = (n: number) => (n === 0 ? "∞" : `${n}×`);

export function Transport() {
  const { open, playing, currentKey, error, loop, loopAt, echoing } = usePlayerStatus();
  const { elapsed, duration } = usePlayerProgress();
  const { toggle, stop, step, seek, loopPassage, endLoop, passageAround } = usePlayerControls();
  const { settings, update } = useSettings();
  const { byId } = useChapters();
  const { t, arabicScript } = useLocale();
  const names = useSurahNames();
  const reciterName = (r: { label: string; labelArabic: string }) => (arabicScript ? r.labelArabic : r.label);

  // Voice and pace belong to the recitation, so they are reachable from the
  // transport itself rather than only from the settings page — the reader who
  // wants a slower ʿAfasy is listening, not configuring, and on a phone the
  // settings page is two navigations and a lost place away.
  const [tuning, setTuning] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  // The passage offered for looping. Chosen when the panel is opened — the
  // loop already running, or else from the ayah being recited to the end of
  // its rukūʿ — and after that it is the reader's, and does not move under
  // them as the recitation moves on.
  const [passage, setPassage] = useState<{ from: number; to: number } | null>(null);

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

  const surahNumber = currentKey ? Number(currentKey.split(":")[0]) : 0;
  const ayahNumber = currentKey ? Number(currentKey.split(":")[1]) : 0;
  const surah = byId(surahNumber);
  const ayahCount = Math.max(surah?.verses_count ?? 0, passage?.to ?? 0, loop?.to ?? 0, ayahNumber);
  const ayat = useMemo(() => Array.from({ length: ayahCount }, (_, i) => i + 1), [ayahCount]);

  if (!open || !currentKey) return null;

  const reciter = RECITERS.find((r) => r.id === settings.reciterId);
  const progress = duration > 0 ? (elapsed / duration) * 100 : 0;

  const onScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (duration > 0) seek((Number(e.target.value) / 100) * duration);
  };

  const toggleTuning = () => {
    if (!tuning) {
      setPassage(loop ? { from: loop.from, to: loop.to } : passageAround(currentKey));
    }
    setTuning(!tuning);
  };

  // ── the loop ──────────────────────────────────────────────────────────────
  const chosen = passage ?? { from: ayahNumber, to: ayahNumber };
  const habit = { each: settings.loopEach, times: settings.loopTimes, echo: settings.loopEcho };

  /** A change made while the loop is running takes effect in the loop. */
  const choosePassage = (next: { from: number; to: number }) => {
    setPassage(next);
    if (loop) loopPassage({ ...habit, ...next }, false);
  };
  const chooseHabit = (next: Partial<typeof habit>) => {
    // Only what was chosen is written. Writing all three from what this render
    // knew put back the old count when two were changed in quick succession.
    if (next.each !== undefined) update({ loopEach: next.each });
    if (next.times !== undefined) update({ loopTimes: next.times });
    if (next.echo !== undefined) update({ loopEcho: next.echo });
    if (loop) loopPassage({ from: loop.from, to: loop.to, ...habit, ...next }, false);
  };
  const chooseRepeat = (repeat: Repeat) => {
    // Repeating the ayah or the surah is a different thing to be doing.
    endLoop();
    update({ repeat });
  };

  // A run of ayat is two numbers and a dash, and is kept reading left to
  // right — 12–18 — on a page that reads the other way.
  const span = loop
    ? loop.from === loop.to
      ? t("player.spanOne", { n: loop.from })
      : `\u2066${loop.from}–${loop.to}\u2069`
    : "";
  const clock = `${formatClock(elapsed)} / ${formatClock(duration)}`;
  const pass = loop
    ? loop.times
      ? t("player.passOf", { n: loopAt.pass, total: loop.times })
      : t("player.pass", { n: loopAt.pass })
    : "";
  const meta = error
    ? t(error)
    : echoing
      ? t("player.turn")
      : loop
        ? [
            t("player.looping", { span }),
            pass,
            loop.each > 1 ? t("player.hearing", { n: loopAt.turn, total: loop.each }) : "",
            clock,
          ]
            .filter(Boolean)
            .join(" · ")
        : `${reciter ? reciterName(reciter) : t("player.reciter")} · ${clock}`;

  return (
    <div className={styles.bar} ref={barRef}>
      <label className={styles.scrubWrap}>
        <span className="sr-only">{t("player.seek")}</span>
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
        <div className={styles.panel} role="group" aria-label={t("player.settings")}>
          <section className={styles.group}>
            <h2 className={styles.groupTitle}>{t("player.reciter")}</h2>
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
                  {reciterName(r)}
                </button>
              ))}
            </div>
            <p className={styles.groupNote}>
              {t("player.reciterNote")}
            </p>
          </section>

          {/* Memorising is the thing a recitation is most often put on for,
              and it wants more than "repeat": a few ayat, each heard several
              times, the run of them gone over again, and room to say it back. */}
          <section className={styles.group}>
            <h2 className={styles.groupTitle}>{t("player.memorise")}</h2>
            <div className={styles.passage}>
              <label className={styles.end}>
                <span className={styles.endLabel}>{t("player.from")}</span>
                <select
                  className={styles.select}
                  value={chosen.from}
                  onChange={(e) => {
                    const from = Number(e.target.value);
                    choosePassage({ from, to: Math.max(from, chosen.to) });
                  }}
                >
                  {ayat.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.end}>
                <span className={styles.endLabel}>{t("player.to")}</span>
                <select
                  className={styles.select}
                  value={chosen.to}
                  onChange={(e) => {
                    const to = Number(e.target.value);
                    choosePassage({ from: Math.min(chosen.from, to), to });
                  }}
                >
                  {ayat.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>

              {loop ? (
                <button onClick={endLoop} className={`btn btn-secondary btn-on ${styles.chip}`}>
                  {t("player.stopLoop")}
                </button>
              ) : (
                <button
                  onClick={() => loopPassage({ ...habit, ...chosen }, true)}
                  className={`btn btn-primary ${styles.chip}`}
                >
                  {t("player.loop")}
                </button>
              )}
            </div>

            <div className={styles.habits}>
              <div className={styles.habit}>
                <span className={styles.habitLabel}>{t("player.each")}</span>
                <div className={styles.chips} role="group" aria-label={t("player.eachLabel")}>
                  {EACH.map((n) => (
                    <button
                      key={n}
                      onClick={() => chooseHabit({ each: n })}
                      aria-pressed={habit.each === n}
                      className={`btn btn-secondary ${styles.chip} ${styles.numeric} ${
                        habit.each === n ? "btn-on" : ""
                      }`}
                    >
                      {times(n)}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.habit}>
                <span className={styles.habitLabel}>{t("player.passage")}</span>
                <div className={styles.chips} role="group" aria-label={t("player.passageLabel")}>
                  {TIMES.map((n) => (
                    <button
                      key={n}
                      onClick={() => chooseHabit({ times: n })}
                      aria-pressed={habit.times === n}
                      aria-label={n === 0 ? t("player.untilStopped") : undefined}
                      className={`btn btn-secondary ${styles.chip} ${styles.numeric} ${
                        habit.times === n ? "btn-on" : ""
                      }`}
                    >
                      {times(n)}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.habit}>
                <span className={styles.habitLabel}>{t("player.after")}</span>
                <div className={styles.chips}>
                  <button
                    onClick={() => chooseHabit({ echo: !habit.echo })}
                    aria-pressed={habit.echo}
                    className={`btn btn-secondary ${styles.chip} ${habit.echo ? "btn-on" : ""}`}
                  >
                    {t(habit.echo ? "player.echoOn" : "player.echoOff")}
                  </button>
                </div>
              </div>
            </div>

            <p className={styles.groupNote}>
              {loop
                ? t("player.going", {
                    span,
                    surah: surah ? names.name(surah.id) : t("player.thisSurah"),
                    progress: [
                      pass,
                      loop.each > 1 ? t("player.hearingThis", { n: loopAt.turn, total: loop.each }) : "",
                    ]
                      .filter(Boolean)
                      .join(", "),
                  })
                : t("player.offer")}
            </p>
          </section>

          <div className={styles.groupRow}>
            <section className={styles.group}>
              <h2 className={styles.groupTitle}>{t("player.speed")}</h2>
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
              <h2 className={styles.groupTitle}>{t("player.repeat")}</h2>
              <div className={styles.chips}>
                {REPEATS.map((r) => {
                  // A passage being looped is what is repeating; none of these is.
                  const on = !loop && settings.repeat === r;
                  return (
                    <button
                      key={r}
                      onClick={() => chooseRepeat(r)}
                      aria-pressed={on}
                      className={`btn btn-secondary ${styles.chip} ${on ? "btn-on" : ""}`}
                    >
                      {t(REPEAT_LABEL[r])}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className={styles.group}>
              <h2 className={styles.groupTitle}>{t("player.follow")}</h2>
              <div className={styles.chips}>
                <button
                  onClick={() => update({ follow: !settings.follow })}
                  aria-pressed={settings.follow}
                  className={`btn btn-secondary ${styles.chip} ${settings.follow ? "btn-on" : ""}`}
                >
                  {t(settings.follow ? "player.following" : "player.staying")}
                </button>
              </div>
            </section>
          </div>
        </div>
      )}

      <div className={styles.row}>
        <button onClick={toggle} className={`btn btn-icon btn-primary ${styles.play}`} aria-label={t(playing ? "player.pause" : "player.play")}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            {playing ? <path d="M10 4H6v16h4zM18 4h-4v16h4z" /> : <path d="m6 4 14 8-14 8z" />}
          </svg>
        </button>

        <button onClick={() => step(-1)} className={`btn btn-icon ${styles.small}`} aria-label={t("player.prev")}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 20 9 12l10-8z" />
            <path d="M5 19V5" />
          </svg>
        </button>
        <button onClick={() => step(1)} className={`btn btn-icon ${styles.small}`} aria-label={t("player.next")}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
            <path d="m5 4 10 8-10 8z" />
            <path d="M19 5v14" />
          </svg>
        </button>

        <div className={styles.now}>
          <div className={styles.nowTitle}>
            {surah ? `${names.name(surah.id)} · ` : ""}
            {currentKey}
          </div>
          <div className={`${styles.nowMeta} ${echoing ? styles.nowTurn : ""}`} aria-live={echoing ? "polite" : undefined}>
            {meta}
          </div>
        </div>

        <div className={styles.controls}>
          {loop ? (
            <button
              onClick={endLoop}
              className={`btn btn-secondary btn-on ${styles.chip} ${styles.numeric}`}
              title={t("player.stopLoopTitle")}
            >
              {t("player.loopChip", { span })}
            </button>
          ) : (
            <button
              onClick={() => update({ repeat: REPEATS[(REPEATS.indexOf(settings.repeat) + 1) % REPEATS.length] })}
              className={`btn btn-secondary ${styles.chip} ${settings.repeat !== "off" ? "btn-on" : ""}`}
            >
              {t(REPEAT_LABEL[settings.repeat])}
            </button>
          )}
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
            {t("player.follow")}
          </button>
        </div>

        <button
          onClick={toggleTuning}
          className={`btn btn-icon ${styles.small} ${tuning || loop ? "btn-on" : ""}`}
          aria-expanded={tuning}
          aria-label={t("player.tune")}
          title={t("player.tune")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h10M18 18h2" />
            <circle cx="16" cy="6" r="2" />
            <circle cx="8" cy="12" r="2" />
            <circle cx="16" cy="18" r="2" />
          </svg>
        </button>

        <button onClick={stop} className={`btn btn-icon ${styles.small}`} aria-label={t("player.close")}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
