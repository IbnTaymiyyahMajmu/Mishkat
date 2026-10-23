"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePlayerControls, usePlayerStatus } from "@/lib/audio/player";
import { useSettings } from "@/lib/store/settings";
import { useChapters } from "@/lib/store/chapters";
import { useSurah } from "@/lib/quran/useSurah";
import { useSurahTranslations } from "@/lib/quran/useSurahTranslations";
import { fetchVerseWithWords } from "@/lib/quran/api";
import { RECITERS } from "@/lib/quran/resources";
import type { Verse, Word } from "@/lib/quran/types";
import { useTranslationShelf } from "@/components/translations/useTranslationShelf";
import { arabicNumber, plainText } from "@/lib/text";
import { useLocale } from "@/lib/i18n";
import { useSurahNames } from "@/lib/i18n/surah";
import { fetchScore, type Score } from "@/lib/horizons/score";
import { Film, hourColour, moonPhase, type Caption } from "@/lib/horizons/director";
import { useFilmLoop, type FilmMoment, type Look, type Motion } from "./useFilmLoop";
import styles from "./Horizons.module.css";

/**
 * Horizons: a surah recited over the signs it names.
 *
 * One unbroken flight over a land laid out from the surah itself, the sky
 * turning at the word the reciter is saying — the sun as وَٱلشَّمْسِ is said,
 * the rain at مَآءً — and the words themselves over it, lit as they are
 * recited, with the meaning of each sign set beside what it named. For a
 * reader who finds it hard to sit still with a page, it is something to
 * watch that is never anything but the recitation; for anyone, a way of
 * seeing what the Qur'an points at when it says "look".
 *
 * What is shown, and what is never shown, is set out in
 * `src/lib/horizons/signs.ts`. The film itself is `useFilmLoop` and the
 * director; this is the page around it — the niche it opens from, the words,
 * the ribbon of the surah, and the controls, which keep out of the way.
 */

type WordsMode = "ayah" | "word" | "none";

const WORDS_LABEL = {
  ayah: "horizons.words.ayah",
  word: "horizons.words.word",
  none: "horizons.words.none",
} as const;
const MOTION_LABEL = {
  full: "horizons.motion.full",
  gentle: "horizons.motion.gentle",
  still: "horizons.motion.still",
} as const;

interface Prefs {
  words: WordsMode;
  translation: boolean;
  motion: Motion;
}

const PREFS_KEY = "mishkat.horizons.v1";
const NO_VERSES: Verse[] = [];

function loadPrefs(): Prefs {
  const calm = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const fallback: Prefs = { words: "ayah", translation: true, motion: calm ? "gentle" : "full" };
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null") as Partial<Prefs> | null;
    if (!raw) return fallback;
    return {
      words: raw.words === "word" || raw.words === "none" ? raw.words : "ayah",
      translation: raw.translation !== false,
      motion: raw.motion === "gentle" || raw.motion === "still" ? raw.motion : fallback.motion,
    };
  } catch {
    return fallback;
  }
}

/** A pause mark — where the reciter may stop for breath — ends a phrase. */
const PAUSE = /[ۖ-ۜ]/;

const wordsOf = (v: Verse | undefined): Word[] => v?.words?.filter((w) => w.char_type_name === "word") ?? [];

/** The ayah in the phrases it is breathed in, each short enough to stand on one line. */
function phrasesOf(words: Word[], longest: number): Word[][] {
  const out: Word[][] = [];
  let run: Word[] = [];
  for (const w of words) {
    run.push(w);
    if (PAUSE.test(w.text_uthmani ?? "")) {
      out.push(run);
      run = [];
    }
  }
  if (run.length) out.push(run);
  return out.flatMap((p) => {
    if (p.length <= longest) return [p];
    const parts = Math.ceil(p.length / longest);
    const size = Math.ceil(p.length / parts);
    return Array.from({ length: parts }, (_, i) => p.slice(i * size, (i + 1) * size));
  });
}

interface Shown {
  id: number;
  sign: string;
  arabic: string;
  gloss: string;
  ref: string;
}

export function HorizonsPage({ surah }: { surah: number }) {
  const { t, arrows, arabicScript } = useLocale();
  const names = useSurahNames();
  const { byId } = useChapters();
  const { settings } = useSettings();
  const controls = usePlayerControls();
  const { currentKey, playing } = usePlayerStatus();
  const chapter = byId(surah);

  const { verses, loading, loadingMore, error, reload } = useSurah(surah, settings.reciterId, settings.glossLanguage);
  const { ids } = useTranslationShelf();
  const firstTranslation = useMemo(() => ids.slice(0, 1), [ids]);
  const translations = useSurahTranslations(surah, firstTranslation);

  const [score, setScore] = useState<Score | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void fetchScore(surah).then((s) => alive && setScore(s));
    return () => {
      alive = false;
    };
  }, [surah]);

  // Read on the first render: nothing the page first shows depends on them,
  // so the page as exported and the page as hydrated still agree.
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const changePrefs = useCallback((next: Partial<Prefs>) => {
    setPrefs((p) => {
      const merged = { ...p, ...next };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(merged));
      } catch {
        /* a private window: kept for the visit */
      }
      return merged;
    });
  }, []);

  // ── the film ────────────────────────────────────────────────────────────
  const complete = !loading && !loadingMore && verses.length > 0 && verses.length === (chapter?.verses_count ?? verses.length);
  const pace = prefs.motion === "full" ? 1 : prefs.motion === "gentle" ? 0.55 : 0.12;
  // The hour it is where the viewer is, under tonight's moon — read once,
  // when the surah opens, so that the land does not shift under a change of
  // setting halfway through.
  const [start] = useState(() => {
    const now = new Date();
    return { hour: now.getHours() + now.getMinutes() / 60, phase: moonPhase(now) };
  });
  // Laid out from the first page of the surah as soon as it arrives, so the
  // opening is drawn at once, and again as the rest comes in. It can be
  // begun once the whole of it is here.
  const laid = useMemo(
    () => (score && verses.length ? new Film(score, verses, { hour: start.hour, phase: start.phase, pace }) : null),
    [score, verses, start, pace],
  );
  const film = complete ? laid : null;
  const ribbon = useMemo(() => film?.ribbon() ?? [], [film]);

  // The surah goes to the player as it does from the reader, so a
  // recitation already under way in it carries on into the film unbroken.
  useEffect(() => {
    if (!verses.length || loadingMore) return;
    controls.setQueue({ surah, verses });
  }, [controls, surah, verses, loadingMore]);

  const reciting = !!currentKey && currentKey.startsWith(`${surah}:`);
  const [begun, setBegun] = useState<number | null>(null);
  const [chrome, setChrome] = useState(true);
  const [tuning, setTuning] = useState(false);
  // Arriving with the surah already being recited, the niche is open from the
  // start. Adjusted during render rather than in an effect, so the opening
  // card is never drawn for a frame over a film already under way.
  if (begun === null && reciting && playing) setBegun(-1e6);

  const begin = useCallback(() => {
    if (!film) return;
    setBegun(performance.now());
    setChrome(true);
    if (reciting) {
      if (!playing) controls.toggle();
    } else controls.play(film.timings[0]?.key ?? `${surah}:1`);
  }, [film, reciting, playing, controls, surah]);

  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const look = useRef<Look>({ yaw: 0, pitch: 0, held: false });
  // The room left above the opening or closing card, for the niche to stand in.
  const room = useRef<{ top: number; bottom: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLElement>(null);
  const [moment, setMoment] = useState<FilmMoment>({ index: 0, position: 0 });
  const [captions, setCaptions] = useState<Shown[]>([]);
  const [veil, setVeil] = useState(0);
  const [lamp, setLamp] = useState(0);
  const [bow, setBow] = useState(0);
  const [ended, setEnded] = useState(false);
  const captionId = useRef(0);
  const versesRef = useRef(verses);
  useEffect(() => {
    versesRef.current = verses;
  }, [verses]);

  const onCaption = (c: Caption) => {
    const v = versesRef.current[c.ayah];
    const w = wordsOf(v)[c.position - 1];
    if (!v || !w) return;
    const id = ++captionId.current;
    const shown: Shown = {
      id,
      sign: c.sign,
      arabic: (w.text_uthmani ?? "").replace(PAUSE, "").trim(),
      gloss: w.translation?.text ?? "",
      ref: v.verse_key,
    };
    setCaptions((list) => [...list.slice(-1), shown]);
    window.setTimeout(() => setCaptions((list) => list.filter((x) => x.id !== id)), 4600);
  };
  const onState = (s: { veil: number; lamp: number; ended: boolean; bow: number }) => {
    setVeil(Math.round(s.veil * 10) / 10);
    setLamp(Math.round(s.lamp * 10) / 10);
    setBow(s.bow > 0.5 ? 1 : 0);
    setEnded(s.ended);
  };

  const { failed } = useFilmLoop({
    canvas,
    film: laid,
    surah,
    controls,
    speed: settings.speed,
    motion: prefs.motion,
    begun,
    look,
    room,
    onMoment: setMoment,
    onCaption,
    onState,
  });

  // ── the chrome, which keeps out of the way while the film plays ─────────
  // While it plays, the controls go after a few still seconds, and come back
  // at a touch, a movement of the mouse or a key; paused, or with the
  // settings open, they stay.
  const hideTimer = useRef<number | null>(null);
  const wake = () => {
    setChrome(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setChrome(false), 3200);
  };
  useEffect(() => {
    if (!playing || tuning) return;
    const id = window.setTimeout(() => setChrome(false), 3200);
    return () => window.clearTimeout(id);
  }, [playing, tuning]);
  useEffect(() => () => void (hideTimer.current && window.clearTimeout(hideTimer.current)), []);
  const showChrome = chrome || !playing || tuning || begun === null;

  // The screen stays on while the surah is recited, as it would for a film.
  useEffect(() => {
    if (!playing || !reciting || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let alive = true;
    void navigator.wakeLock
      .request("screen")
      .then((l) => {
        if (alive) lock = l;
        else void l.release();
      })
      .catch(() => {});
    return () => {
      alive = false;
      void lock?.release().catch(() => {});
    };
  }, [playing, reciting]);

  // The site's messages move to the head of the screen while a film is open.
  useEffect(() => {
    document.body.dataset.watching = "";
    return () => {
      delete document.body.dataset.watching;
    };
  }, []);

  const rootRef = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void rootRef.current?.requestFullscreen?.().catch(() => {});
  }, []);

  const playPause = useCallback(() => {
    if (begun === null || !reciting) begin();
    else controls.toggle();
  }, [begun, reciting, begin, controls]);

  // The keys, read through a ref so the listener is added once and always
  // acts on this render's state.
  const onKey = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest("input, textarea, select, [contenteditable]")) return;
    if (e.key === " " || e.key === "k") {
      e.preventDefault();
      playPause();
    } else if (e.key === "ArrowRight") controls.step(arabicScript ? -1 : 1);
    else if (e.key === "ArrowLeft") controls.step(arabicScript ? 1 : -1);
    else if (e.key === "f") toggleFull();
    else if (e.key === "w") changePrefs({ words: prefs.words === "ayah" ? "word" : prefs.words === "word" ? "none" : "ayah" });
    else if (e.key === "Escape" && tuning) setTuning(false);
    else return;
    wake();
  };
  const keyRef = useRef(onKey);
  useEffect(() => {
    keyRef.current = onKey;
  });
  useEffect(() => {
    const on = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  // ── looking around: a drag turns the camera, and it drifts back ─────────
  const drag = useRef<{ x: number; y: number; yaw: number; pitch: number; moved: boolean } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, yaw: look.current.yaw, pitch: look.current.pitch, moved: false };
    look.current.held = true;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    wake();
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) d.moved = true;
    const k = 2.4 / Math.max(320, Math.min(window.innerWidth, window.innerHeight));
    look.current.yaw = Math.max(-1.1, Math.min(1.1, d.yaw - dx * k));
    look.current.pitch = Math.max(-0.6, Math.min(0.75, d.pitch + dy * k));
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    look.current.held = false;
    if (d && !d.moved) setChrome((c) => !c);
  };

  // ── the 41:53 epigraph, in the corpus's words ───────────────────────────
  const [epigraph, setEpigraph] = useState<Word[] | null>(null);
  useEffect(() => {
    let alive = true;
    void fetchVerseWithWords("41:53", ids[0] ?? 20).then((v) => {
      if (alive && v) setEpigraph(wordsOf(v).slice(0, 6));
    });
    return () => {
      alive = false;
    };
  }, [ids]);

  // ── what is on screen ───────────────────────────────────────────────────
  const verse = verses[moment.index] ?? NO_VERSES[0];
  const words = wordsOf(verse);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(max-width: 640px)");
    const on = () => setNarrow(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  const phrases = useMemo(() => phrasesOf(words, narrow ? 5 : 9), [words, narrow]);
  const phrase = useMemo(() => {
    if (!phrases.length) return [];
    const at = Math.max(1, moment.position);
    return phrases.find((p) => p.some((w) => w.position === at)) ?? phrases[0];
  }, [phrases, moment.position]);
  const lastPhrase = phrases.length > 0 && phrase === phrases[phrases.length - 1];
  const rendering = verse ? translations.byVerse.get(verse.verse_key)?.[0] : undefined;
  const translationText = useMemo(() => (rendering ? plainText(rendering.text) : ""), [rendering]);
  const through = words.length ? Math.max(0, moment.position - 1) / Math.max(1, words.length - 1) : 0;
  const nowWord = words.find((w) => w.position === moment.position);

  // A long translation is let scroll up through its box as the ayah is
  // recited, rather than cut off or crowding the picture.
  const transRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const box = transRef.current;
    const text = box?.firstElementChild as HTMLElement | null;
    if (!box || !text) return;
    box.style.setProperty("--overflow", `${Math.max(0, text.scrollHeight - box.clientHeight)}px`);
  }, [translationText, prefs.translation, prefs.words, narrow, moment.index]);

  const total = film ? film.timings[film.timings.length - 1].start + film.timings[film.timings.length - 1].duration : 0;
  const head = film && verse
    ? (film.timings[moment.index].start + (film.timings[moment.index].words[Math.max(0, moment.position - 1)] ?? 0)) / Math.max(1, total)
    : 0;

  const reciter = RECITERS.find((r) => r.id === settings.reciterId);
  const reciterName = reciter ? (arabicScript ? reciter.labelArabic : reciter.label) : "";
  const surahName = names.name(surah);

  // The signs this surah names, for the card at its end: each once, where it first came.
  const signs = useMemo(() => {
    if (!film) return [];
    const seen = new Set<string>();
    const out: Shown[] = [];
    for (const c of film.captions) {
      if (seen.has(c.sign)) continue;
      const v = verses[c.ayah];
      const w = wordsOf(v)[c.position - 1];
      if (!v || !w) continue;
      seen.add(c.sign);
      out.push({
        id: out.length,
        sign: c.sign,
        arabic: (w.text_uthmani ?? "").replace(PAUSE, "").trim(),
        gloss: w.translation?.text ?? "",
        ref: v.verse_key,
      });
    }
    return out;
  }, [film, verses]);

  // Measured whenever the card that is showing changes size.
  const stage = begun === null ? "opening" : ended ? "end" : "film";
  useEffect(() => {
    const card = cardRef.current;
    if (!card || stage === "film") return;
    const measure = () => {
      const top = (topRef.current?.getBoundingClientRect().bottom ?? 60) + 6;
      const bottom = card.getBoundingClientRect().top - 10;
      room.current = { top, bottom: Math.max(top + 20, bottom) };
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(card);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [stage, epigraph, signs.length]);

  const fallbackSky = useMemo(() => (failed ? hourColour(start.hour) : null), [failed, start.hour]);

  return (
    <div
      ref={rootRef}
      className={styles.film}
      data-chrome={showChrome ? "on" : "off"}
      data-stage={stage}
      data-veil={veil > 0.55 && lamp < 0.5 ? "on" : "off"}
      onPointerMove={wake}
    >
      <canvas
        ref={setCanvas}
        className={styles.canvas}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-hidden="true"
      />
      {fallbackSky && (
        <div
          className={styles.fallback}
          style={{ background: `linear-gradient(rgb(${fallbackSky.join(" ")}), #0b0805)` }}
        >
          <p>{t("horizons.noGl")}</p>
        </div>
      )}
      <div className={styles.scrim} aria-hidden="true" />

      <header ref={topRef} className={styles.top}>
        <Link href={`/read/${surah}/`} className={styles.back}>
          {arrows.prev} <span>{t("horizons.back", { surah: surahName })}</span>
        </Link>
        <div className={styles.topActions}>
          <button
            className={styles.icon}
            onClick={() => setTuning((v) => !v)}
            aria-expanded={tuning}
            aria-label={t("horizons.settings")}
            title={t("horizons.settings")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
              <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
              <circle cx="16" cy="7" r="2" />
              <circle cx="10" cy="17" r="2" />
            </svg>
          </button>
          <button
            className={styles.icon}
            onClick={toggleFull}
            aria-label={t(full ? "horizons.exitFullscreen" : "horizons.fullscreen")}
            title={t(full ? "horizons.exitFullscreen" : "horizons.fullscreen")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {full ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
            </svg>
          </button>
        </div>
      </header>

      {tuning && (
        <div className={styles.tuning} role="group" aria-label={t("horizons.settings")}>
          <div className={styles.tuneRow}>
            <span className={styles.tuneLabel}>{t("horizons.wordsLabel")}</span>
            <div className={styles.segmented}>
              {(["ayah", "word", "none"] as WordsMode[]).map((m) => (
                <button key={m} aria-pressed={prefs.words === m} onClick={() => changePrefs({ words: m })}>
                  {t(WORDS_LABEL[m])}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.tuneRow}>
            <span className={styles.tuneLabel}>{t("horizons.motion")}</span>
            <div className={styles.segmented}>
              {(["full", "gentle", "still"] as Motion[]).map((m) => (
                <button key={m} aria-pressed={prefs.motion === m} onClick={() => changePrefs({ motion: m })}>
                  {t(MOTION_LABEL[m])}
                </button>
              ))}
            </div>
          </div>
          <label className={styles.tuneCheck}>
            <input
              type="checkbox"
              checked={prefs.translation}
              onChange={(e) => changePrefs({ translation: e.target.checked })}
            />
            <span>{t("horizons.translation")}</span>
          </label>
          <p className={styles.tuneNote}>{t("horizons.drag")}</p>
        </div>
      )}

      <div className={styles.captions} aria-live="polite">
        {captions.map((c) => (
          <div key={c.id} className={styles.caption}>
            <span className={`quran ${styles.captionArabic}`} lang="ar" dir="rtl">
              {c.arabic}
            </span>
            {c.gloss && <span className={styles.captionGloss}>{c.gloss}</span>}
          </div>
        ))}
      </div>

      {/* Said of the unseen only — not of the niche of 24:35, which is a parable and is shown. */}
      {begun !== null && veil > 0.55 && lamp < 0.5 && <p className={styles.unseen}>{t("horizons.unseen")}</p>}
      {begun !== null && bow > 0 && (
        <p className={styles.bow} aria-label={t("horizons.bow")}>
          ۩
        </p>
      )}

      {begun !== null && verse && !ended && prefs.words !== "none" && (
        <div className={styles.words} data-mode={prefs.words}>
          {prefs.words === "ayah" ? (
            <p className={`quran ${styles.phrase}`} lang="ar" dir="rtl">
              {phrase.map((w) => (
                <span
                  key={w.position}
                  className={styles.word}
                  data-state={w.position === moment.position ? "now" : w.position < moment.position ? "past" : "next"}
                >
                  {w.text_uthmani}{" "}
                </span>
              ))}
              {lastPhrase && <span className={styles.ayahEnd}>{arabicNumber(verse.verse_number)}</span>}
            </p>
          ) : (
            <div className={styles.single}>
              <p className={`quran ${styles.singleArabic}`} lang="ar" dir="rtl" key={nowWord?.position ?? 0}>
                {(nowWord ?? words[0])?.text_uthmani}
              </p>
              <p className={styles.singleGloss}>{(nowWord ?? words[0])?.translation?.text}</p>
            </div>
          )}
          {prefs.translation && translationText && prefs.words === "ayah" && (
            <div ref={transRef} className={styles.translation} lang={rendering?.lang || undefined}>
              <p style={{ transform: `translateY(calc(var(--overflow, 0px) * ${-through.toFixed(3)}))` }}>{translationText}</p>
            </div>
          )}
        </div>
      )}

      <footer className={styles.bottom}>
        {film && (
          <div className={styles.ribbon}>
            <div className={styles.ribbonTrack}>
              {film.timings.map((tm, i) => (
                <button
                  key={tm.key}
                  className={styles.ribbonAyah}
                  style={{ flexGrow: tm.duration, background: ribbon[i] }}
                  onClick={() => {
                    if (begun === null) setBegun(performance.now());
                    controls.play(tm.key);
                  }}
                  aria-label={t("common.ayahN", { n: i + 1 })}
                  title={t("common.ayahN", { n: i + 1 })}
                />
              ))}
            </div>
            <span className={styles.ribbonHead} style={{ insetInlineStart: `${head * 100}%` }} aria-hidden="true" />
          </div>
        )}
        <div className={styles.controls}>
          <button className={styles.icon} onClick={() => controls.step(-1)} disabled={!reciting} aria-label={t("horizons.prev")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={styles.flip}>
              <path d="M7 6h2v12H7zM10 12l9-6v12z" />
            </svg>
          </button>
          <button className={styles.play} onClick={playPause} disabled={!film} aria-label={t(playing && reciting ? "horizons.pause" : "horizons.play")}>
            {playing && reciting ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5l11 7-11 7z" />
              </svg>
            )}
          </button>
          <button className={styles.icon} onClick={() => controls.step(1)} disabled={!reciting} aria-label={t("horizons.next")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={styles.flip}>
              <path d="M15 6h2v12h-2zM14 12L5 18V6z" />
            </svg>
          </button>
          <span className={styles.where}>
            {chapter ? t("common.ayahOf", { n: (verse?.verse_number ?? 1), total: chapter.verses_count }) : ""}
            {reciterName && <span className={styles.whereReciter}> · {reciterName}</span>}
          </span>
        </div>
      </footer>

      {begun === null && (
        <section className={styles.opening}>
          <div ref={cardRef} className={styles.openingInner}>
            <p className={styles.kicker}>
              {t("horizons.title")} · <span lang="ar">آفاق</span>
            </p>
            <h1 className={styles.title}>
              <span className="surah-ar" lang="ar">{chapter?.name_arabic ?? ""}</span>
              {!names.arabic && <span className={styles.titleLatin}>{surahName}</span>}
            </h1>
            {!names.arabic && names.meaning(surah) && <p className={styles.meaning}>{names.meaning(surah)}</p>}
            {epigraph && (
              <figure className={styles.epigraph}>
                <p className={`quran ${styles.epigraphArabic}`} lang="ar" dir="rtl">
                  {epigraph.map((w) => w.text_uthmani).join(" ")}
                </p>
                <figcaption>
                  {epigraph.map((w) => w.translation?.text).filter(Boolean).join(" ")} <cite>41:53</cite>
                </figcaption>
              </figure>
            )}
            {error ? (
              <button className={styles.begin} onClick={reload}>
                {t("common.tryAgain")}
              </button>
            ) : (
              <button className={styles.begin} onClick={begin} disabled={!film}>
                {film ? t("horizons.begin") : t("horizons.preparing")}
              </button>
            )}
            {reciterName && <p className={styles.reciter}>{t("horizons.recitedBy", { name: reciterName })}</p>}
            <details className={styles.about}>
              <summary>{t("horizons.shownTitle")}</summary>
              <p>{t("horizons.shown")}</p>
              <p>
                <b>{t("horizons.memoryTitle")}</b> {t("horizons.memory")}
              </p>
            </details>
            {score === null && <p className={styles.reciter}>{t("horizons.noScore")}</p>}
          </div>
        </section>
      )}

      {ended && (
        <section className={styles.end}>
          <div ref={cardRef} className={styles.endInner}>
            <p className={styles.kicker}>{surahName}</p>
            <h2 className={styles.endTitle}>{t("horizons.signsTitle")}</h2>
            {signs.length ? (
              <ul className={styles.signs}>
                {signs.map((s) => (
                  <li key={s.sign}>
                    <button
                      onClick={() => {
                        setEnded(false);
                        controls.play(s.ref);
                      }}
                    >
                      <span className={`quran ${styles.signArabic}`} lang="ar" dir="rtl">
                        {s.arabic}
                      </span>
                      <span className={styles.signGloss}>{s.gloss}</span>
                      <span className={styles.signRef}>{s.ref}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.endNote}>{t("horizons.signsNone")}</p>
            )}
            <div className={styles.endActions}>
              <button
                className={styles.begin}
                onClick={() => {
                  setEnded(false);
                  controls.play(film?.timings[0]?.key ?? `${surah}:1`);
                }}
              >
                {t("horizons.again")}
              </button>
              {surah < 114 && (
                <Link href={`/read/${surah + 1}/horizons/`} className={styles.endLink}>
                  {t("horizons.nextSurah", { surah: names.name(surah + 1) })} {arrows.next}
                </Link>
              )}
              <Link href={`/read/${surah}/`} className={styles.endLink}>
                {t("horizons.read")}
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
