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
import type { MessageKey } from "../i18n/types";
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
 *
 * What the player knows is handed out in three pieces rather than one, because
 * they change at three very different rates. The controls never change. The
 * status — which ayah, playing or not — changes once an ayah. The clock changes
 * four times a second. A screen that only wants to know which ayah is being
 * recited must not be re-rendered by the clock: the reader is thousands of
 * nodes, and it was being rebuilt on every tick of a recitation it was merely
 * sitting beside.
 */

export interface PlayerQueue {
  surah: number;
  verses: Verse[];
}

/**
 * A passage gone over until it is known.
 *
 * This is how the Qur'an is memorised: a few ayat, each one heard several
 * times, then the run of them several times over, and — for anyone doing it
 * properly — a silence after each in which to say it back.
 */
export interface PassageLoop {
  surah: number;
  /** Ayah numbers, both inclusive. */
  from: number;
  to: number;
  /** How many times each ayah is recited before the next one. */
  each: number;
  /** How many times the passage is gone through; 0 is until it is stopped. */
  times: number;
  /** Leave a silence as long as the ayah after it, to recite it back in. */
  echo: boolean;
}

/** Where a loop has got to: which hearing of the ayah, which pass of the passage. */
export interface LoopPlace {
  turn: number;
  pass: number;
}

export interface PlayerControls {
  setQueue: (queue: PlayerQueue) => void;
  play: (verseKey: string) => void;
  /** What an ayah's own button does: pause it if it is the one loaded, else play it. */
  playOrPause: (verseKey: string) => void;
  toggle: () => void;
  stop: () => void;
  step: (delta: number) => void;
  /** Move to a place in the surah, which may be in another ayah. */
  seek: (seconds: number) => void;
  /**
   * Loop a passage. `begin` takes the recitation to the head of it and starts;
   * without it the loop is adjusted where it stands, which is what changing a
   * count halfway through should do.
   */
  loopPassage: (loop: Omit<PassageLoop, "surah">, begin: boolean) => void;
  endLoop: () => void;
  /** From this ayah to the end of its rukūʿ — a passage with a natural close. */
  passageAround: (verseKey: string | null) => { from: number; to: number } | null;
}

export interface PlayerStatus {
  open: boolean;
  playing: boolean;
  /** The ayah currently loaded in the transport, playing or paused. */
  currentKey: string | null;
  /**
   * Set when the reciter has no audio for the ayah, or the network refused: a
   * sentence the transport says in the language the reader reads.
   */
  error: MessageKey | null;
  loop: PassageLoop | null;
  loopAt: LoopPlace;
  /** In the silence after an ayah, left for the reader to recite it back. */
  echoing: boolean;
}

export interface PlayerProgress {
  /** Seconds into the surah, not into the ayah. */
  elapsed: number;
  /** How long the whole surah runs in this voice. */
  duration: number;
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
  // A segment can arrive short of its end time, and one of those must not turn
  // the length of the whole surah into NaN. `api.ts` has already made numbers
  // of the timings some reciters are served with as strings.
  const end = Number(segments[segments.length - 1][3]);
  return Number.isFinite(end) ? end / 1000 : 0;
}

function within(loop: PassageLoop, verse: Verse): boolean {
  return verse.verse_number >= loop.from && verse.verse_number <= loop.to;
}

const ControlsCtx = createContext<PlayerControls | null>(null);
const StatusCtx = createContext<PlayerStatus | null>(null);
const ProgressCtx = createContext<PlayerProgress | null>(null);

/** The ayah playing, the one behind it, and the one fetched ahead. */
const BUFFER_KEEP = 3;

const START: LoopPlace = { turn: 1, pass: 1 };

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<PlayerQueue>({ surah: 0, verses: [] });
  const currentRef = useRef<string | null>(null);

  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<MessageKey | null>(null);
  const [loop, setLoop] = useState<PassageLoop | null>(null);
  const [loopAt, setLoopAt] = useState<LoopPlace>(START);
  const [echoing, setEchoing] = useState(false);

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

  // The loop is read by the element's callbacks and shown by the transport, so
  // it is held twice: the ref is the truth the callbacks act on, the state is
  // what the screen is told.
  const loopRef = useRef<PassageLoop | null>(null);
  const loopAtRef = useRef<LoopPlace>(START);
  const echoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Paused in the silence after an ayah: resuming moves on, it does not replay. */
  const heldRef = useRef(false);

  const moveLoop = useCallback((at: LoopPlace) => {
    loopAtRef.current = at;
    setLoopAt(at);
  }, []);

  const dropLoop = useCallback(() => {
    loopRef.current = null;
    setLoop(null);
    moveLoop(START);
  }, [moveLoop]);

  const clearEcho = useCallback(() => {
    if (echoTimerRef.current) clearTimeout(echoTimerRef.current);
    echoTimerRef.current = null;
    setEchoing(false);
  }, []);

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
  /** Turned over when the buffers are dropped, so a fetch still in the air
   *  when that happens does not land a blob nobody will ever release. */
  const bufferEraRef = useRef(0);

  const prefetch = useCallback((url: string) => {
    const buffers = bufferRef.current;
    if (buffers.has(url) || fetchingRef.current.has(url)) return;
    fetchingRef.current.add(url);
    const era = bufferEraRef.current;
    void fetch(url)
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (!blob || era !== bufferEraRef.current) return;
        buffers.set(url, URL.createObjectURL(blob));
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

  /** The recording that will be wanted after the current ayah — the head of
   *  a looped passage and the wrap-around of a repeated surah included, since
   *  both cross the same seam. */
  const prefetchNext = useCallback(() => {
    const verses = queueRef.current.verses;
    const i = verses.findIndex((v) => v.verse_key === currentRef.current);
    if (i < 0) return;
    const active = loopRef.current;
    let next: Verse | undefined = verses[i + 1];
    if (active && within(active, verses[i])) {
      if (!next || !within(active, next)) next = verses.find((v) => within(active, v));
    } else if (!next && repeatRef.current === "surah") {
      next = verses[0];
    }
    if (next?.audio?.url && next !== verses[i]) prefetch(audioUrl(next.audio.url));
  }, [prefetch]);

  const forgetBuffers = useCallback(() => {
    for (const objectUrl of bufferRef.current.values()) URL.revokeObjectURL(objectUrl);
    bufferRef.current.clear();
    bufferEraRef.current += 1;
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
   *
   * A true length is a property of the recording, so it is kept against the
   * recording's address rather than against the ayah: a queue arriving in
   * another voice simply finds nothing measured yet, and nothing has to be
   * thrown away when the same queue is handed over a second time.
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

  const lengthOf = useCallback((verse: Verse) => {
    const url = verse.audio?.url;
    return (url ? lengthsRef.current.get(audioUrl(url)) : undefined) ?? ayahSeconds(verse);
  }, []);

  const remeasure = useCallback(() => {
    let total = 0;
    let before = 0;
    for (const v of queueRef.current.verses) {
      if (v.verse_key === currentRef.current) before = total;
      total += lengthOf(v);
    }
    offsetRef.current = before;
    setDuration(total);
  }, [lengthOf]);

  /** `play()` is refused when the reader has not gestured, and abandoned when
   *  a newer source or a pause overtakes it. Only the first is news. */
  const refused = useCallback((reason: unknown) => {
    if ((reason as { name?: string } | null)?.name === "AbortError") return;
    // Autoplay policies: the reader must have gestured. The transport is open
    // and paused, which is a state they can act on.
    wantsPlayRef.current = false;
    setPlaying(false);
  }, []);

  const load = useCallback(
    (key: string, autoplay: boolean, at = 0) => {
      const el = audioRef.current;
      if (!el) return;
      const verse = verseAt(key);
      clearEcho();
      heldRef.current = false;

      // Going anywhere outside a looped passage is leaving it. Moving within
      // it starts the count for the ayah arrived at.
      const active = loopRef.current;
      if (active) {
        if (!verse || !within(active, verse)) dropLoop();
        else if (key !== currentRef.current) moveLoop({ turn: 1, pass: loopAtRef.current.pass });
      }

      currentRef.current = key;
      setCurrentKey(key);
      setOpen(true);

      if (!verse?.audio?.url) {
        // Said in the transport, which is why it is opened first: with it shut
        // the message had nowhere to appear and the button did nothing at all.
        el.pause();
        el.removeAttribute("src");
        el.load();
        playingUrlRef.current = null;
        wantsPlayRef.current = false;
        remeasure();
        setElapsed(offsetRef.current);
        setError("player.noRecording");
        setPlaying(false);
        return;
      }

      setError(null);
      const url = audioUrl(verse.audio.url);
      playingUrlRef.current = url;
      el.src = bufferRef.current.get(url) ?? url;
      el.playbackRate = speedRef.current;
      pendingSeekRef.current = at > 0 ? at : null;
      remeasure();
      setElapsed(offsetRef.current + at);
      if (autoplay) {
        wantsPlayRef.current = true;
        void el.play().catch(refused);
      }
    },
    [clearEcho, dropLoop, moveLoop, refused, remeasure, verseAt],
  );

  const play = useCallback((key: string) => load(key, true), [load]);

  // ── what follows an ayah ──────────────────────────────────────────────────
  /**
   * Decided in one place, because three things ask it: the recording ending,
   * the silence after it running out, and a reader resuming from that silence.
   */
  const advance = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    const key = currentRef.current;
    const verses = queueRef.current.verses;
    const i = verses.findIndex((v) => v.verse_key === key);
    const here = verses[i];

    const again = () => {
      el.currentTime = 0;
      void el.play().catch(refused);
    };
    const rest = () => {
      // Nothing is meant to be playing until asked.
      wantsPlayRef.current = false;
      setPlaying(false);
    };

    const active = loopRef.current;
    if (active && here && within(active, here)) {
      const at = loopAtRef.current;
      if (at.turn < active.each) {
        moveLoop({ turn: at.turn + 1, pass: at.pass });
        again();
        return;
      }
      const next = verses[i + 1];
      if (next && within(active, next)) {
        load(next.verse_key, true);
        return;
      }
      const head = verses.find((v) => within(active, v)) ?? here;
      if (active.times === 0 || at.pass < active.times) {
        moveLoop({ turn: 1, pass: at.pass + 1 });
        if (head.verse_key === key) again();
        else load(head.verse_key, true);
        return;
      }
      // Every pass asked for has been made. The passage is left cued at its
      // head, so pressing play goes over it again rather than off into the
      // rest of the surah.
      moveLoop(START);
      load(head.verse_key, false);
      rest();
      return;
    }

    if (repeatRef.current === "ayah" && here) {
      again();
      return;
    }
    const next = verses[i + 1];
    if (here && next) {
      load(next.verse_key, true);
      return;
    }
    if (here && repeatRef.current === "surah" && verses[0]) {
      load(verses[0].verse_key, true);
      return;
    }
    rest();
  }, [load, moveLoop, refused]);

  const step = useCallback(
    (delta: number) => {
      const verses = queueRef.current.verses;
      const i = verses.findIndex((v) => v.verse_key === currentRef.current);
      if (i < 0) return;
      let next = verses[i + delta];
      // Stepping off the end of a looped passage comes round to its other end:
      // the buttons move within what is being memorised.
      const active = loopRef.current;
      if (active && within(active, verses[i]) && (!next || !within(active, next))) {
        const inside = verses.filter((v) => within(active, v));
        next = delta > 0 ? inside[0] : inside[inside.length - 1];
      }
      if (next) load(next.verse_key, true);
    },
    [load],
  );

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    // In the silence left for reciting back nothing is sounding, but the
    // session is running — so this is a pause, and it is the silence it stops.
    if (echoTimerRef.current) {
      clearEcho();
      heldRef.current = true;
      wantsPlayRef.current = false;
      setPlaying(false);
      return;
    }
    if (el.paused) {
      if (!currentRef.current) return;
      wantsPlayRef.current = true;
      if (heldRef.current) {
        heldRef.current = false;
        setPlaying(true);
        advance();
        return;
      }
      void el.play().catch(refused);
    } else {
      wantsPlayRef.current = false;
      el.pause();
    }
  }, [advance, clearEcho, refused]);

  const playOrPause = useCallback(
    (key: string) => {
      if (key === currentRef.current && playingUrlRef.current) toggle();
      else load(key, true);
    },
    [load, toggle],
  );

  const stop = useCallback(() => {
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
    currentRef.current = null;
    wantsPlayRef.current = false;
    heldRef.current = false;
    clearEcho();
    dropLoop();
    forgetBuffers();
    offsetRef.current = 0;
    pendingSeekRef.current = null;
    highlight.setRecite(null);
    setPlaying(false);
    setOpen(false);
    setCurrentKey(null);
    setElapsed(0);
    setDuration(0);
    setError(null);
  }, [clearEcho, dropLoop, forgetBuffers]);

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
        const length = lengthOf(verse);
        // The last ayah catches anything past the end, so dragging to the far
        // right lands on the close of the surah rather than nowhere.
        if (target < before + length || i === verses.length - 1) {
          const into = target - before;
          if (verse.verse_key === currentRef.current && playingUrlRef.current) {
            el.currentTime = Number.isFinite(el.duration)
              ? Math.min(Math.max(0, into), el.duration)
              : Math.max(0, into);
            // Dragged back into an ayah whose silence was running: it is being
            // listened to again, so the silence is over.
            const waiting = !!echoTimerRef.current;
            clearEcho();
            heldRef.current = false;
            if (waiting) void el.play().catch(refused);
          } else {
            load(verse.verse_key, wantsPlayRef.current, into);
          }
          return;
        }
        before += length;
      }
    },
    [clearEcho, lengthOf, load, refused],
  );

  const setQueue = useCallback(
    (queue: PlayerQueue) => {
      const changedSurah = queue.surah !== queueRef.current.surah;
      const current = currentRef.current;

      // Moving to another surah abandons the recitation rather than playing an
      // ayah the reader is no longer looking at.
      if (changedSurah && current) {
        queueRef.current = queue;
        stop();
        return;
      }

      if (current) {
        // The same surah, arriving again — a new translation, a new voice, or
        // the reader opening the surah the muṣḥaf view was already reciting.
        // It comes in pages, and until it holds the ayah being recited it is
        // not a queue this recitation can be moved onto: what follows that
        // ayah would be whatever happened to have arrived. So the queue in
        // hand is kept until the new one can take over.
        const arrived = queue.verses.find((v) => v.verse_key === current);
        if (!arrived) return;
        queueRef.current = queue;
        remeasure();
        // A different recording for the same ayah is a different voice. It is
        // taken up here — in the same place, in the new voice — and until now
        // the previous one was still playing, so the change is a handover
        // rather than a silence.
        const url = arrived.audio?.url ? audioUrl(arrived.audio.url) : null;
        if (url && url !== playingUrlRef.current) load(current, wantsPlayRef.current);
        return;
      }

      queueRef.current = queue;
      remeasure();
    },
    [load, remeasure, stop],
  );

  // ── looping a passage ─────────────────────────────────────────────────────
  const loopPassage = useCallback<PlayerControls["loopPassage"]>(
    (want, begin) => {
      const verses = queueRef.current.verses;
      const from = Math.max(1, Math.min(want.from, want.to));
      const to = Math.max(from, Math.max(want.from, want.to));
      const next: PassageLoop = {
        surah: queueRef.current.surah,
        from,
        to,
        each: Math.max(1, Math.round(want.each) || 1),
        times: Math.max(0, Math.round(want.times) || 0),
        echo: !!want.echo,
      };
      const head = verses.find((v) => within(next, v));
      if (!head) return;

      loopRef.current = next;
      setLoop(next);

      if (begin) {
        moveLoop(START);
        load(head.verse_key, true);
        return;
      }

      // Adjusted where it stands: the counts are pulled back inside the new
      // limits, and the recitation moves only if it has been left outside.
      const at = loopAtRef.current;
      moveLoop({
        turn: Math.min(at.turn, next.each),
        pass: next.times ? Math.min(at.pass, next.times) : at.pass,
      });
      const here = verseAt(currentRef.current);
      if (!here || !within(next, here)) {
        load(head.verse_key, wantsPlayRef.current);
      } else if (!next.echo && echoTimerRef.current) {
        clearEcho();
        advance();
      }
    },
    [advance, clearEcho, load, moveLoop, verseAt],
  );

  const endLoop = useCallback(() => {
    if (!loopRef.current) return;
    const waiting = !!echoTimerRef.current;
    clearEcho();
    dropLoop();
    // Ended in the silence after an ayah: the recitation carries on from there
    // as it ordinarily would, rather than sitting in a silence with no end.
    if (waiting) advance();
  }, [advance, clearEcho, dropLoop]);

  const passageAround = useCallback<PlayerControls["passageAround"]>(
    (key) => {
      const verses = queueRef.current.verses;
      const here = verseAt(key) ?? verses[0];
      if (!here) return null;
      let to = here.verse_number;
      if (here.ruku_number != null) {
        for (const v of verses) {
          if (v.ruku_number === here.ruku_number && v.verse_number > to) to = v.verse_number;
        }
      }
      return { from: here.verse_number, to };
    },
    [verseAt],
  );

  // ── the element and its events ────────────────────────────────────────────
  useEffect(() => {
    const el = new Audio();
    el.preload = "auto";
    audioRef.current = el;

    const onPlay = () => setPlaying(true);
    const onPause = () => {
      // A recording reaching its end pauses the element on the way to saying
      // it has ended. That is not the reader pausing: what happens next is for
      // `advance` to decide, and reporting a pause in between made the play
      // button blink once for every ayah.
      if (el.ended) return;
      setPlaying(false);
    };
    const onLoaded = () => {
      const url = playingUrlRef.current;
      // The estimate has served its turn for this ayah: the recording itself
      // now says how long it is.
      if (url && Number.isFinite(el.duration)) lengthsRef.current.set(url, el.duration);
      const at = pendingSeekRef.current;
      pendingSeekRef.current = null;
      if (at != null) el.currentTime = Math.min(Math.max(0, at), el.duration || at);
      remeasure();
      setElapsed(offsetRef.current + el.currentTime);
    };
    const onError = () => {
      // Emptying the element on purpose is not a failure to load anything.
      if (!playingUrlRef.current) return;
      wantsPlayRef.current = false;
      setError("player.failed");
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
      highlight.setRecite(null);
      const active = loopRef.current;
      const here = queueRef.current.verses.find((v) => v.verse_key === currentRef.current);
      if (active?.echo && here && within(active, here)) {
        // As long as the ayah took to hear, at the pace it was heard at: long
        // enough to say it back, and it scales with the ayah without asking
        // the reader to set a number of seconds.
        const length = Number.isFinite(el.duration) ? el.duration : ayahSeconds(here);
        setEchoing(true);
        echoTimerRef.current = setTimeout(
          () => {
            echoTimerRef.current = null;
            setEchoing(false);
            advance();
          },
          Math.max(1, length / (el.playbackRate || 1)) * 1000,
        );
        return;
      }
      advance();
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
      if (echoTimerRef.current) clearTimeout(echoTimerRef.current);
      echoTimerRef.current = null;
      forgetBuffers();
      highlight.setRecite(null);
    };
  }, [advance, prefetchNext, forgetBuffers, remeasure]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    // Both: handing the element a new source resets its rate to the default.
    el.defaultPlaybackRate = settings.speed;
    el.playbackRate = settings.speed;
  }, [settings.speed]);

  // Scroll to the ayah as the recitation moves to it — and when following is
  // switched back on, to wherever the recitation has got to meanwhile. Not on
  // every load: an ayah being repeated is already where it was, and a reader
  // who has scrolled away to look something up should not be pulled back to
  // it each time it comes round.
  useEffect(() => {
    if (!settings.follow) return;
    if (currentKey) requestScroll(currentKey);
  }, [settings.follow, currentKey, requestScroll]);

  // Media keys and the OS lock screen.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    // The keys say which they mean, so each does only that: a "pause" from a
    // headset that is already paused must not start the recitation.
    const running = () => !!echoTimerRef.current || audioRef.current?.paused === false;
    ms.setActionHandler("play", () => void (running() || toggle()));
    ms.setActionHandler("pause", () => void (running() && toggle()));
    ms.setActionHandler("previoustrack", () => step(-1));
    ms.setActionHandler("nexttrack", () => step(1));
    return () => {
      ms.setActionHandler("play", null);
      ms.setActionHandler("pause", null);
      ms.setActionHandler("previoustrack", null);
      ms.setActionHandler("nexttrack", null);
    };
  }, [toggle, step]);

  const controls = useMemo<PlayerControls>(
    () => ({ setQueue, play, playOrPause, toggle, stop, step, seek, loopPassage, endLoop, passageAround }),
    [setQueue, play, playOrPause, toggle, stop, step, seek, loopPassage, endLoop, passageAround],
  );
  const status = useMemo<PlayerStatus>(
    () => ({ open, playing, currentKey, error, loop, loopAt, echoing }),
    [open, playing, currentKey, error, loop, loopAt, echoing],
  );
  const progress = useMemo<PlayerProgress>(() => ({ elapsed, duration }), [elapsed, duration]);

  return (
    <ControlsCtx.Provider value={controls}>
      <StatusCtx.Provider value={status}>
        <ProgressCtx.Provider value={progress}>{children}</ProgressCtx.Provider>
      </StatusCtx.Provider>
    </ControlsCtx.Provider>
  );
}

function need<T>(value: T | null, hook: string): T {
  if (!value) throw new Error(`${hook} must be used inside <PlayerProvider>`);
  return value;
}

/** What can be done to the recitation. The same object for the whole session. */
export function usePlayerControls(): PlayerControls {
  return need(useContext(ControlsCtx), "usePlayerControls");
}

/** Which ayah, and whether it is sounding. Changes about once an ayah. */
export function usePlayerStatus(): PlayerStatus {
  return need(useContext(StatusCtx), "usePlayerStatus");
}

/** The clock. Changes several times a second — only the transport wants it. */
export function usePlayerProgress(): PlayerProgress {
  return need(useContext(ProgressCtx), "usePlayerProgress");
}
