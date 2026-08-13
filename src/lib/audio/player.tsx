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
  elapsed: number;
  duration: number;
  /** Set when the reciter has no audio for the ayah, or the network refused. */
  error: string | null;

  setQueue: (queue: PlayerQueue) => void;
  play: (verseKey: string) => void;
  toggle: () => void;
  stop: () => void;
  step: (delta: number) => void;
  seek: (seconds: number) => void;
}

const Ctx = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { settings, update } = useSettings();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<PlayerQueue>({ surah: 0, verses: [] });
  const currentRef = useRef<string | null>(null);
  // `load` is rebuilt when its dependencies change; the audio listeners are
  // mounted once, so they reach the current one through this rather than
  // closing over a stale copy.
  const loadRef = useRef<((key: string, autoplay: boolean) => void) | null>(null);

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

  const load = useCallback(
    (key: string, autoplay: boolean) => {
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
      el.src = audioUrl(verse.audio.url);
      el.playbackRate = speedRef.current;
      setElapsed(0);
      setDuration(0);
      if (autoplay) {
        void el.play().catch(() => {
          // Autoplay policies: the reader must have gestured. The transport is
          // open and paused, which is a state they can act on.
          setPlaying(false);
        });
      }
      requestScroll(key);
    },
    [requestScroll, verseAt],
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
      void el.play().catch(() => setPlaying(false));
    } else {
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
    highlight.setRecite(null);
    setPlaying(false);
    setOpen(false);
    setCurrentKey(null);
    setElapsed(0);
    setDuration(0);
    setError(null);
  }, []);

  const seek = useCallback((seconds: number) => {
    const el = audioRef.current;
    if (el && Number.isFinite(el.duration)) {
      el.currentTime = Math.min(Math.max(0, seconds), el.duration);
    }
  }, []);

  const setQueue = useCallback(
    (queue: PlayerQueue) => {
      const changedSurah = queue.surah !== queueRef.current.surah;
      queueRef.current = queue;
      // Moving to another surah abandons the recitation rather than playing an
      // ayah the reader is no longer looking at.
      if (changedSurah && currentRef.current) stop();
    },
    [stop],
  );

  // ── the element and its events ────────────────────────────────────────────
  useEffect(() => {
    const el = new Audio();
    el.preload = "auto";
    audioRef.current = el;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onLoaded = () => setDuration(el.duration || 0);
    const onError = () => {
      setError("That recitation could not be loaded.");
      setPlaying(false);
    };

    const onTimeUpdate = () => {
      setElapsed(el.currentTime);
      paintRecitedWord(el.currentTime);
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
      setPlaying(false);
    };

    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("loadedmetadata", onLoaded);
    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("ended", onEnded);
    el.addEventListener("error", onError);

    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("loadedmetadata", onLoaded);
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("error", onError);
      el.pause();
      audioRef.current = null;
      highlight.setRecite(null);
    };
  }, []);

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

  // Changing reciter mid-recitation should keep the place, not lose it.
  const reciterRef = useRef(settings.reciterId);
  useEffect(() => {
    if (reciterRef.current === settings.reciterId) return;
    reciterRef.current = settings.reciterId;
    if (currentRef.current) stop();
  }, [settings.reciterId, stop]);

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
