"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { audioUrl } from "../quran/api";
import type { Verse } from "../quran/types";
import { highlight, wordDomId } from "../highlight";
import { useSettings } from "../store/settings";

/**
 * Recitation.
 *
 * The design prototype faked this with a timer, because it had no audio. Here
 * it is a real `<audio>` element streaming from the recitation CDN, and the
 * word that lights up is the word being recited: the corpus ships timing
 * segments per ayah — `[index, position, startMs, endMs]` — and the same
 * painter that handles hover paints the recited word, so following the
 * recitation and following the mouse are one mechanism, not two.
 */

export interface PlayerQueue {
  surah: number;
  verses: Verse[];
}

interface PlayerContextValue {
  open: boolean;
  playing: boolean;
  /** The ayah currently loaded in the transport, playing or paused. */
  currentKey: string | null;
  /** Seconds into the surah, not into the ayah. */
  elapsed: number;
  /** How long the whole surah runs in this voice. */
  duration: number;
  /** Set when the reciter has no audio for the ayah, or the network refused. */
  error: string | null;

  setQueue: (queue: PlayerQueue) => void;
  play: (verseKey: string) => void;
  toggle: () => void;
  stop: () => void;
  step: (delta: number) => void;
  /** Move to a place in the surah, which may be in another ayah. */
  seek: (seconds: number) => void;
}

/**
 * How long an ayah runs, before it has been heard.
 *
 * The corpus carries no duration, but it carries the end of the last word,
 * which falls within a breath of the end of the recording. That is enough to
 * lay out the length of a surah before a note of it has been fetched; the true
 * length replaces the estimate as each recording reports it.
 */
function ayahSeconds(verse: Verse): number {
  const segments = verse.audio?.segments;
  if (!segments?.length) return 0;
  return segments[segments.length - 1][3] / 1000;
}

const Ctx = createContext<PlayerContextValue | null>(null);

/** The ayah playing, the one behind it, and the one fetched ahead. */
const BUFFER_KEEP = 3;

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { settings, update } = useSettings();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<PlayerQueue>({ surah: 0, verses: [] });
  const currentRef = useRef<string | null>(null);
  // `load` is rebuilt when its dependencies change; the audio listeners are
  // mounted once, so they reach the current one through this rather than
  // closing over a stale copy.
  const loadRef = useRef<((key: string, autoplay: boolean, at?: number) => void) | null>(null);
  // An ayah the recitation was on when the reciter changed, waiting for the
  // queue to come back in the new voice. See the note by `setQueue`.
  const resumeRef = useRef<{ key: string; playing: boolean } | null>(null);

  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Settings the audio callbacks read. Kept in refs so changing the speed or
  // the repeat mode never re-subscribes the element's event listeners — and
  // written after the commit, not during render, so a render that React throws
  // away cannot leave the audio element following settings nobody chose.
  const speedRef = useRef(settings.speed);
  const repeatRef = useRef(settings.repeat);
  const followRef = useRef(settings.follow);

  useEffect(() => {
    speedRef.current = settings.speed;
    repeatRef.current = settings.repeat;
    followRef.current = settings.follow;
  }, [settings.speed, settings.repeat, settings.follow]);

  const verseAt = useCallback((key: string | null) => {
    if (!key) return undefined;
    return queueRef.current.verses.find((v) => v.verse_key === key);
  }, []);

  /** Ask the reader to bring an ayah into view. Decoupled via a DOM event so
   *  the player does not need a handle on the reader's scroll container. */
  const requestScroll = useCallback((key: string) => {
    if (!followRef.current) return;
    window.dispatchEvent(new CustomEvent("mishkat:scroll-to-verse", { detail: { key } }));
  }, []);

  // ── the next ayah, fetched before it is due ───────────────────────────────
  /**
   * Every ayah is a separate file on the recitation CDN, so moving to the next
   * one used to begin with a round trip: the element was handed a URL it had
   * never seen and stayed silent until enough of it had arrived. Between two
   * ayahs that is heard as a stutter, and on a phone's connection it is heard
   * often. So while an ayah plays, the one after it is fetched whole and held
   * as a blob; when its turn comes the element is handed something already in
   * memory and carries on in the same breath.
   */
  const bufferRef = useRef(new Map<string, string>());
  const fetchingRef = useRef(new Set<string>());
  /** The recording in the element, whose buffer is never dropped under it. */
  const playingUrlRef = useRef<string | null>(null);

  const prefetch = useCallback((url: string) => {
    const buffers = bufferRef.current;
    if (buffers.has(url) || fetchingRef.current.has(url)) return;
    fetchingRef.current.add(url);
    void fetch(url)
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (blob) buffers.set(url, URL.createObjectURL(blob));
        // Insertion order is recitation order, so the oldest entry is the ayah
        // furthest behind — never the one being recited, which is skipped in
        // case the reader has stepped back into it.
        for (const [old, objectUrl] of buffers) {
          if (buffers.size <= BUFFER_KEEP) break;
          if (old === playingUrlRef.current) continue;
          URL.revokeObjectURL(objectUrl);
          buffers.delete(old);
        }
      })
      .catch(() => {
        // A prefetch that fails costs nothing: the element is handed the URL
        // instead, which is what it used to be handed in every case.
      })
      .finally(() => fetchingRef.current.delete(url));
  }, []);

  /** The recording after the current ayah — the wrap-around included, since
   *  repeating the surah crosses the same seam. */
  const prefetchNext = useCallback(() => {
    const verses = queueRef.current.verses;
    const i = verses.findIndex((v) => v.verse_key === currentRef.current);
    if (i < 0) return;
    const next = verses[i + 1] ?? (repeatRef.current === "surah" ? verses[0] : undefined);
    if (next?.audio?.url) prefetch(audioUrl(next.audio.url));
  }, [prefetch]);

  const forgetBuffers = useCallback(() => {
    for (const objectUrl of bufferRef.current.values()) URL.revokeObjectURL(objectUrl);
    bufferRef.current.clear();
    playingUrlRef.current = null;
  }, []);

  // ── the length of the surah ───────────────────────────────────────────────
  /**
   * The transport measures the recitation rather than the file in the element:
   * a reader who has settled into al-Mulk wants to know they are four minutes
   * into twenty, not six seconds into ten. Every ayah's length is estimated
   * from its timings up front and corrected the moment its recording is
   * loaded, so the surah has a length from the first frame and a true one by
   * the time it has been heard.
   */
  const lengthsRef = useRef(new Map<string, number>());
  /** Seconds of recitation lying before the ayah in the element. */
  const offsetRef = useRef(0);
  /** A place within an ayah still loading, applied when it can be. */
  const pendingSeekRef = useRef<number | null>(null);
  /**
   * Whether the recitation is meant to be running, which is not the same as
   * whether the element happens to be playing this instant: handing it a new
   * source pauses it until playback has been arranged again. A drag along the
   * scrub bar asks for a dozen places in a second, and each one has to know
   * that the reader is listening — the element, mid-load, would say otherwise.
   */
  const wantsPlayRef = useRef(false);

  const remeasure = useCallback(() => {
    let total = 0;
    let before = 0;
    for (const v of queueRef.current.verses) {
      if (v.verse_key === currentRef.current) before = total;
      total += lengthsRef.current.get(v.verse_key) ?? ayahSeconds(v);
    }
    offsetRef.current = before;
    setDuration(total);
  }, []);

  const load = useCallback(
    (key: string, autoplay: boolean, at = 0) => {
      const verse = verseAt(key);
      const el = audioRef.current;
      if (!el) return;
      if (!verse?.audio?.url) {
        setError("This reciter has no recording for that ayah.");
        setPlaying(false);
        return;
      }
      setError(null);
      currentRef.current = key;
      setCurrentKey(key);
      setOpen(true);
      const url = audioUrl(verse.audio.url);
      playingUrlRef.current = url;
      el.src = bufferRef.current.get(url) ?? url;
      el.playbackRate = speedRef.current;
      pendingSeekRef.current = at > 0 ? at : null;
      remeasure();
      setElapsed(offsetRef.current + at);
      if (autoplay) {
        wantsPlayRef.current = true;
        void el.play().catch(() => {
          // Autoplay policies: the reader must have gestured. The transport is
          // open and paused, which is a state they can act on.
          setPlaying(false);
        });
      }
      requestScroll(key);
    },
    [remeasure, requestScroll, verseAt],
  );

  const play = useCallback((key: string) => load(key, true), [load]);

  const step = useCallback(
    (delta: number) => {
      const verses = queueRef.current.verses;
      const i = verses.findIndex((v) => v.verse_key === currentRef.current);
      const next = verses[i + delta];
      if (next) load(next.verse_key, true);
    },
    [load],
  );

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      if (!currentRef.current) return;
      wantsPlayRef.current = true;
      void el.play().catch(() => setPlaying(false));
    } else {
      wantsPlayRef.current = false;
      el.pause();
    }
  }, []);

  const stop = useCallback(() => {
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
    currentRef.current = null;
    wantsPlayRef.current = false;
    forgetBuffers();
    lengthsRef.current.clear();
    offsetRef.current = 0;
    pendingSeekRef.current = null;
    highlight.setRecite(null);
    setPlaying(false);
    setOpen(false);
    setCurrentKey(null);
    setElapsed(0);
    setDuration(0);
    setError(null);
  }, [forgetBuffers]);

  /** The scrub bar spans the surah, so the place asked for is often in another
   *  ayah: find the one it falls in and, if it is not the one playing, take up
   *  the recitation there. */
  const seek = useCallback(
    (seconds: number) => {
      const el = audioRef.current;
      const verses = queueRef.current.verses;
      if (!el || !verses.length) return;
      const target = Math.max(0, seconds);
      let before = 0;
      for (let i = 0; i < verses.length; i += 1) {
        const verse = verses[i];
        const length = lengthsRef.current.get(verse.verse_key) ?? ayahSeconds(verse);
        // The last ayah catches anything past the end, so dragging to the far
        // right lands on the close of the surah rather than nowhere.
        if (target < before + length || i === verses.length - 1) {
          const into = target - before;
          if (verse.verse_key === currentRef.current) {
            el.currentTime = Number.isFinite(el.duration)
              ? Math.min(Math.max(0, into), el.duration)
              : Math.max(0, into);
          } else {
            load(verse.verse_key, wantsPlayRef.current, into);
          }
          return;
        }
        before += length;
      }
    },
    [load],
  );

  const setQueue = useCallback(
    (queue: PlayerQueue) => {
      const changedSurah = queue.surah !== queueRef.current.surah;
      queueRef.current = queue;
      // Moving to another surah abandons the recitation rather than playing an
      // ayah the reader is no longer looking at.
      if (changedSurah && currentRef.current) {
        resumeRef.current = null;
        stop();
        return;
      }
      // Lengths are a property of the recording, so a queue arriving in a new
      // voice is measured again from the timings that came with it.
      lengthsRef.current.clear();
      remeasure();
      // A queue that arrived because the reciter changed. The surah has to be
      // fetched again for the new voice's recordings, so the ayah was put aside
      // when the reciter was picked and is taken up again here — in the same
      // place, in the new voice. Until this lands the previous recitation is
      // still playing, so the change is a handover rather than a silence.
      const resume = resumeRef.current;
      if (resume && queue.verses.some((v) => v.verse_key === resume.key && v.audio?.url)) {
        resumeRef.current = null;
        loadRef.current?.(resume.key, resume.playing);
      }
    },
    [remeasure, stop],
  );

  // ── the element and its events ────────────────────────────────────────────
  useEffect(() => {
    const el = new Audio();
    el.preload = "auto";
    audioRef.current = el;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onLoaded = () => {
      const key = currentRef.current;
      // The estimate has served its turn for this ayah: the recording itself
      // now says how long it is.
      if (key && Number.isFinite(el.duration)) lengthsRef.current.set(key, el.duration);
      const at = pendingSeekRef.current;
      pendingSeekRef.current = null;
      if (at != null) el.currentTime = Math.min(Math.max(0, at), el.duration || at);
      remeasure();
      setElapsed(offsetRef.current + el.currentTime);
    };
    const onError = () => {
      setError("That recitation could not be loaded.");
      setPlaying(false);
    };

    // The next ayah is fetched once this one has stopped competing for the
    // connection: when the browser says it can play through, and failing that
    // a couple of seconds in, since not every mobile browser says so.
    const onCanPlayThrough = () => prefetchNext();

    const onTimeUpdate = () => {
      setElapsed(offsetRef.current + el.currentTime);
      paintRecitedWord(el.currentTime);
      if (el.currentTime > 2) prefetchNext();
    };

    const paintRecitedWord = (seconds: number) => {
      const key = currentRef.current;
      const verse = key ? queueRef.current.verses.find((v) => v.verse_key === key) : undefined;
      const segments = verse?.audio?.segments;
      if (!key || !segments?.length) return;
      const ms = seconds * 1000;
      // Segments are in order, and an ayah has at most a few hundred words, so
      // a scan is cheaper than the bookkeeping a binary search would need.
      let position: number | null = null;
      for (const seg of segments) {
        const [, pos, start, end] = seg;
        if (ms >= start && ms < end) {
          position = pos;
          break;
        }
      }
      highlight.setRecite(position == null ? null : wordDomId(key, position));
    };

    const onEnded = () => {
      const repeat = repeatRef.current;
      const key = currentRef.current;
      const verses = queueRef.current.verses;
      highlight.setRecite(null);

      if (repeat === "ayah" && key) {
        el.currentTime = 0;
        void el.play().catch(() => setPlaying(false));
        return;
      }
      const i = verses.findIndex((v) => v.verse_key === key);
      const next = verses[i + 1];
      if (next) {
        loadRef.current?.(next.verse_key, true);
        return;
      }
      if (repeat === "surah" && verses[0]) {
        loadRef.current?.(verses[0].verse_key, true);
        return;
      }
      // The surah is finished: nothing is meant to be playing until asked.
      wantsPlayRef.current = false;
      setPlaying(false);
    };

    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("loadedmetadata", onLoaded);
    el.addEventListener("canplaythrough", onCanPlayThrough);
    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("ended", onEnded);
    el.addEventListener("error", onError);

    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("loadedmetadata", onLoaded);
      el.removeEventListener("canplaythrough", onCanPlayThrough);
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("error", onError);
      el.pause();
      audioRef.current = null;
      forgetBuffers();
      highlight.setRecite(null);
    };
  }, [prefetchNext, forgetBuffers, remeasure]);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = settings.speed;
  }, [settings.speed]);

  // Scroll to the ayah as the recitation moves to it.
  useEffect(() => {
    if (currentKey) requestScroll(currentKey);
  }, [currentKey, requestScroll]);

  // Changing reciter mid-recitation keeps the place rather than losing it: the
  // ayah is set aside here, and `setQueue` picks it up when the surah comes
  // back carrying the new reciter's recordings.
  const reciterRef = useRef(settings.reciterId);
  useEffect(() => {
    if (reciterRef.current === settings.reciterId) return;
    reciterRef.current = settings.reciterId;
    const key = currentRef.current;
    if (key) resumeRef.current = { key, playing: !audioRef.current?.paused };
  }, [settings.reciterId]);

  useEffect(() => {
    if (!settings.follow) return;
    if (currentKey) requestScroll(currentKey);
  }, [settings.follow, currentKey, requestScroll]);

  // Media keys and the OS lock screen.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    ms.setActionHandler("play", () => toggle());
    ms.setActionHandler("pause", () => toggle());
    ms.setActionHandler("previoustrack", () => step(-1));
    ms.setActionHandler("nexttrack", () => step(1));
    return () => {
      ms.setActionHandler("play", null);
      ms.setActionHandler("pause", null);
      ms.setActionHandler("previoustrack", null);
      ms.setActionHandler("nexttrack", null);
    };
  }, [toggle, step]);

  const value = useMemo(
    () => ({ open, playing, currentKey, elapsed, duration, error, setQueue, play, toggle, stop, step, seek }),
    [open, playing, currentKey, elapsed, duration, error, setQueue, play, toggle, stop, step, seek],
  );

  // Speed and repeat live in settings so they survive a reload; the transport
  // reads them from there rather than keeping a second copy.
  void update;

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return ctx;
}
