"use client";

import { useSyncExternalStore } from "react";

/**
 * A word in a teacher's voice.
 *
 * A word read on its own is not how a word is learned: it is learned from a
 * Qari, heard as he says it in its ayah, with the joins and the lengths that
 * belong there. So the word is cut from the Qari's own recitation of the whole
 * ayah — EveryAyah's recordings, one to an ayah — at the place quran-align
 * found it (Collin Fair, CC BY 4.0; `npm run gen:qari` writes the timings to
 * public/qari/). The Qaris offered are the clearest of the teaching
 * reciters, al-Ḥuṣarī's teaching recording among them.
 *
 * Three ways to hear it: once; slowly, at two-thirds the pace and the same
 * pitch; and listen and repeat — the Qari says it, then leaves a silence as
 * long again for the reader to say it back, three times over, as a teacher
 * does with a student sitting in front of him.
 */

export type QariId = "husary" | "husary-muallim" | "minshawi" | "abdul-basit" | "tablawi" | "afasy";

export interface Qari {
  id: QariId;
  /** The recording's folder at EveryAyah. */
  folder: string;
  name: string;
  arabic: string;
  /** A teaching recording: slower, every letter given its full measure. */
  teaching?: boolean;
}

export const QARIS: Qari[] = [
  { id: "husary", folder: "Husary_64kbps", name: "Maḥmūd Khalīl al-Ḥuṣarī", arabic: "محمود خليل الحصري" },
  {
    id: "husary-muallim",
    folder: "Husary_Muallim_128kbps",
    name: "al-Ḥuṣarī, teaching",
    arabic: "الحصري — المعلّم",
    teaching: true,
  },
  { id: "minshawi", folder: "Minshawy_Murattal_128kbps", name: "Muḥammad Ṣiddīq al-Minshāwī", arabic: "محمد صديق المنشاوي" },
  { id: "abdul-basit", folder: "Abdul_Basit_Murattal_64kbps", name: "ʿAbd al-Bāsiṭ ʿAbd al-Ṣamad", arabic: "عبد الباسط عبد الصمد" },
  { id: "tablawi", folder: "Mohammad_al_Tablaway_128kbps", name: "Muḥammad al-Ṭablāwī", arabic: "محمد الطبلاوي" },
  { id: "afasy", folder: "Alafasy_128kbps", name: "Mishārī al-ʿAfāsī", arabic: "مشاري العفاسي" },
];

export const DEFAULT_QARI: QariId = "husary";

export function isQari(value: unknown): value is QariId {
  return QARIS.some((q) => q.id === value);
}

export function qariOf(id: QariId): Qari {
  return QARIS.find((q) => q.id === id) ?? QARIS[0];
}

const pad = (n: number) => String(n).padStart(3, "0");

/** The Qari's recording of a whole ayah. */
export function ayahAudio(qari: QariId, surah: number, ayah: number): string {
  return `https://everyayah.com/data/${qariOf(qari).folder}/${pad(surah)}${pad(ayah)}.mp3`;
}

// ── the timings ─────────────────────────────────────────────────────────────

type Span = [number, number];
const HOME = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/qari`;
const held = new Map<string, Promise<(Span[] | null)[] | null>>();

function surahTimings(qari: QariId, surah: number) {
  const key = `${qari}/${surah}`;
  let p = held.get(key);
  if (!p) {
    p = fetch(`${HOME}/${key}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<(Span[] | null)[]>) : null))
      .catch(() => null);
    held.set(key, p);
  }
  return p;
}

/** Where a word falls in the Qari's recording of its ayah, or null where it was not found. */
export async function wordSpan(qari: QariId, surah: number, ayah: number, position: number): Promise<Span | null> {
  const ayat = await surahTimings(qari, surah);
  const words = ayat?.[ayah - 1];
  if (!words) return null;
  const at = words[position - 1];
  if (!at) return null;
  // A little before the word and a little after, but never into the next one.
  const next = words[position]?.[0];
  return [Math.max(0, at[0] - 30), next !== undefined ? Math.min(at[1] + 60, next + 10) : at[1] + 160];
}

// ── the voice ───────────────────────────────────────────────────────────────

export type VoiceMode = "word" | "slow" | "repeat" | "ayah";

export interface VoiceState {
  /** What is being played, and of which word: `"2:255:4"`. */
  mode: VoiceMode | null;
  word: string | null;
  /** In listen-and-repeat, the reader's turn to say it. */
  turn: boolean;
  /** Which of the three times. */
  round: number;
  /** The word could not be had in this Qari's voice. */
  missing: string | null;
}

const IDLE: VoiceState = { mode: null, word: null, turn: false, round: 0, missing: null };
let state: VoiceState = IDLE;
const listeners = new Set<() => void>();
let el: HTMLAudioElement | null = null;
/** Bumped by every new request, so an older one stops where it is. */
let ticket = 0;

function set(next: Partial<VoiceState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function audio(): HTMLAudioElement {
  if (!el) {
    el = new Audio();
    el.preload = "auto";
    el.crossOrigin = "anonymous";
  }
  return el;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function load(a: HTMLAudioElement, url: string) {
  if (a.src !== url) {
    a.src = url;
    a.load();
  }
  if (a.readyState >= 1) return;
  await new Promise<void>((resolve, reject) => {
    const ok = () => (cleanup(), resolve());
    const bad = () => (cleanup(), reject(new Error("audio")));
    const cleanup = () => {
      a.removeEventListener("loadedmetadata", ok);
      a.removeEventListener("error", bad);
    };
    a.addEventListener("loadedmetadata", ok);
    a.addEventListener("error", bad);
  });
}

/** Play from `start` to `end` milliseconds at a rate, and resolve when done or overtaken. */
async function playSpan(url: string, start: number, end: number | null, rate: number, mine: number) {
  const a = audio();
  await load(a, url);
  if (mine !== ticket) return;
  a.playbackRate = rate;
  a.currentTime = start / 1000;
  await a.play();
  const stop = end === null ? Infinity : end / 1000;
  while (mine === ticket && !a.paused && !a.ended && a.currentTime < stop) await wait(15);
  if (mine === ticket) a.pause();
}

export function stopVoice() {
  ticket++;
  el?.pause();
  set(IDLE);
}

/** Say a word in a Qari's voice, in one of the three ways — or the whole ayah. */
export async function sayWord(qari: QariId, verseKey: string, position: number, mode: VoiceMode) {
  const mine = ++ticket;
  el?.pause();
  const [surah, ayah] = verseKey.split(":").map(Number);
  const id = `${verseKey}:${position}`;
  const url = ayahAudio(qari, surah, ayah);
  set({ mode, word: id, turn: false, round: 0, missing: null });
  try {
    if (mode === "ayah") {
      await playSpan(url, 0, null, 1, mine);
    } else {
      const span = await wordSpan(qari, surah, ayah, position);
      if (mine !== ticket) return;
      if (!span) {
        set({ ...IDLE, missing: id });
        return;
      }
      const [start, end] = span;
      if (mode === "repeat") {
        for (let round = 1; round <= 3 && mine === ticket; round++) {
          set({ round, turn: false });
          await playSpan(url, start, end, 1, mine);
          if (mine !== ticket) return;
          // The reader's turn: as long as the word took, and a breath more.
          set({ turn: true });
          await wait((end - start) * 1.3 + 700);
        }
      } else {
        await playSpan(url, start, end, mode === "slow" ? 0.65 : 1, mine);
      }
    }
  } catch {
    if (mine === ticket) set({ ...IDLE, missing: id });
    return;
  }
  if (mine === ticket) set(IDLE);
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => void listeners.delete(l);
}

export function useVoice(): VoiceState {
  return useSyncExternalStore(subscribe, () => state, () => IDLE);
}
