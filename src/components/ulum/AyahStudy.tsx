"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchVerseWithWords } from "@/lib/quran/api";
import { SURAH_NAMES } from "@/lib/quran/surahNames";
import type { Verse } from "@/lib/quran/types";
import { useChapters } from "@/lib/store/chapters";
import { useSettings } from "@/lib/store/settings";
import { isValidVerseKey, plainText } from "@/lib/text";
import { useClosedByBack } from "@/lib/back";
import { useLocale, type MessageKey } from "@/lib/i18n";
import { useSurahNames } from "@/lib/i18n/surah";
import { Navigator } from "@/components/navigator/Navigator";
import { passage } from "@/lib/ulum/books";
import { classOf, fetchMorph, lemmaOf, rootOf, stemOf, tags, type SurahMorph } from "@/lib/ulum/corpus";
import { readJadwal, waznOf, type Jadwal } from "@/lib/ulum/read";
import { POS_ARABIC } from "./terms";
import { ar, citations, local, type Read, type Sentence, type StudyCtx, type StudyWord } from "./study";
import { Lughah } from "./Lughah";
import { Sarf } from "./Sarf";
import { Nahw } from "./Nahw";
import { Balagha } from "./Balagha";
import { Qiraat } from "./Qiraat";
import { Asbab } from "./Asbab";
import { Mathur } from "./Mathur";
import { Mufassirun } from "./Mufassirun";
import { Ahkam } from "./Ahkam";
import { Munasabat } from "./Munasabat";
import { Fawaid } from "./Fawaid";
import { Sources } from "./Sources";
import styles from "./AyahStudy.module.css";

/**
 * One ayah, taken through the sciences of the Qurʾān one after another.
 *
 * The reader's panel answers what a word is and what the commentators said,
 * beside the text. This page is for sitting down with one ayah the way a
 * student sits with it in front of a teacher: its words, then the root each
 * grows from, the form each takes, what each does in its sentence, how it is
 * said, how else it is read, what it came down in answer to, what was
 * transmitted on it, what the commentators made of it, what it rules, where
 * the Qurʾān says it again, and what is to be taken from it.
 *
 * Every chapter is the books of that science, read on this ayah and set out —
 * the grammarians' parsing under the words they parse, the readings over the
 * words they are read on, the reports under the phrase they explain — and
 * nothing on it is the site's own claim about the ayah. A sentence about the
 * language is a book's sentence, in its own Arabic, under its own name, with
 * a link to the same place in the same book on tafsir.app. Where a book has
 * nothing on the ayah the page says so rather than fill the space. What is
 * the site's own is the arrangement, the counts, and the English names of the
 * grammarians' terms (`terms.ts`).
 *
 * The ayah is in the address — `/ayah/?v=2:255&w=7` — so a study can be linked
 * to and returned to. One exported page serves all 6,236.
 */

export const LAYERS = [
  { id: "lughah", ar: "اللغة", label: "ulum.ch.lughah" },
  { id: "sarf", ar: "الصرف", label: "ulum.ch.sarf" },
  { id: "nahw", ar: "النحو والإعراب", label: "ulum.ch.nahw" },
  { id: "balagha", ar: "البلاغة", label: "ulum.ch.balagha" },
  { id: "qiraat", ar: "القراءات", label: "ulum.ch.qiraat" },
  { id: "asbab", ar: "أسباب النزول", label: "ulum.ch.asbab" },
  { id: "mathur", ar: "التفسير بالمأثور", label: "ulum.ch.mathur" },
  { id: "mufassirun", ar: "أقوال المفسرين", label: "ulum.ch.mufassirun" },
  { id: "ahkam", ar: "الأحكام", label: "ulum.ch.ahkam" },
  { id: "munasabat", ar: "المناسبات", label: "ulum.ch.munasabat" },
  { id: "fawaid", ar: "الفوائد", label: "ulum.ch.fawaid" },
] as const satisfies readonly { id: string; ar: string; label: MessageKey }[];

type LayerId = (typeof LAYERS)[number]["id"];
const ALL_ON = Object.fromEntries(LAYERS.map((l) => [l.id, true])) as Record<LayerId, boolean>;

/** The sentence the page is grouped by, from the sentences al-Ṣāfī gives no place in the iʿrāb. */
function buildSentences(words: Omit<StudyWord, "j">[], jadwal: { j: Jadwal; read: Read } | null): Sentence[] {
  const n = words.length;
  const starts = new Map<number, Sentence["jumla"]>();
  if (jadwal) {
    for (const jumla of jadwal.j.jumal) {
      if (!jumla.main) continue;
      const l = local(jumla.at, jadwal.read, n);
      if (!l || jumla.at!.from < jadwal.read.at0) continue;
      if (!starts.has(l.from)) starts.set(l.from, jumla);
    }
  }
  const firsts = [...starts.keys()].sort((a, b) => a - b);
  if (!firsts.length || firsts[0] !== 1) firsts.unshift(1);
  return firsts.map((from, k) => {
    const to = (firsts[k + 1] ?? n + 1) - 1;
    return { n: k + 1, from, to, jumla: starts.get(from) ?? null, kind: kindOf(words.slice(from - 1, to)) };
  });
}

/**
 * Nominal or verbal, by the grammarians' rule: what the sentence opens with
 * once the particles before it are set aside — a verb, or anything else.
 */
function kindOf(words: Omit<StudyWord, "j">[]): "nominal" | "verbal" {
  for (const w of words) {
    for (const seg of w.segs) {
      const a = tags(seg[2]);
      if (a.includes("PREF")) continue;
      if (seg[1] === "V") return "verbal";
      if (seg[1] === "N") return "nominal";
      // An inna or its sisters makes the sentence after it nominal.
      if (a.some((t) => t.startsWith("FAM:إِنّ"))) return "nominal";
      break; // a particle standing alone; read on to the next word
    }
  }
  return "nominal";
}

export function AyahStudy() {
  const router = useRouter();
  const params = useSearchParams();
  const { settings, lastRead } = useSettings();
  const { byId } = useChapters();
  const { t, n: num, locale } = useLocale();
  const names = useSurahNames();

  const asked = params.get("v") ?? "";
  const key = isValidVerseKey(asked) ? asked : (lastRead?.verseKey ?? "2:255");
  const [surah, ayah] = key.split(":").map(Number);
  const total = byId(surah)?.verses_count ?? SURAH_NAMES[surah - 1]?.ayat ?? 0;
  const wordAsked = Number(params.get("w")) || 0;
  const scholar = params.get("depth") !== "student";

  // ── what the page reads before anything else ──────────────────────────────
  const [verse, setVerse] = useState<{ key: string; v: Verse | null } | null>(null);
  const [morph, setMorph] = useState<{ surah: number; m: SurahMorph } | null>(null);
  const [jadwal, setJadwal] = useState<{ key: string; j: Jadwal; read: Read } | null>(null);
  const [failed, setFailed] = useState(false);
  const [booksDown, setBooksDown] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchVerseWithWords(key, settings.translationId)
      .then((v) => alive && setVerse({ key, v }))
      .catch(() => alive && setVerse({ key, v: null }));
    return () => {
      alive = false;
    };
  }, [key, settings.translationId]);

  useEffect(() => {
    let alive = true;
    fetchMorph(surah)
      .then((m) => alive && setMorph({ surah, m }))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [surah]);

  const m = morph?.surah === surah ? morph.m : null;
  useEffect(() => {
    if (!m) return;
    let alive = true;
    passage("aljadwal", surah, ayah)
      .then((p) => {
        if (!alive) return;
        if (!p) {
          setJadwal(null);
          return;
        }
        const words: string[] = [];
        let at0 = 0;
        for (let a = p.from; a <= p.to; a++) {
          if (a === ayah) at0 = words.length;
          for (const segs of m.ayat[a - 1] ?? []) words.push(segs.map(([f]) => f).join(""));
        }
        const read: Read = { loading: false, failed: false, p, words, at0 };
        setJadwal({ key, j: readJadwal(p.text, words), read });
      })
      .catch(() => {
        if (!alive) return;
        setJadwal(null);
        setBooksDown(key);
      });
    return () => {
      alive = false;
    };
  }, [m, surah, ayah, key]);

  const v = verse?.key === key ? verse.v : null;
  const jd = jadwal?.key === key ? jadwal : null;

  const words: StudyWord[] = useMemo(() => {
    if (!m) return [];
    const corpus = m.ayat[ayah - 1] ?? [];
    const shown = (v?.words ?? []).filter((w) => w.char_type_name === "word");
    const base = corpus.map((segs, k) => ({
      i: k + 1,
      ar: shown[k]?.text_uthmani ?? segs.map(([f]) => f).join(""),
      tr: shown[k]?.transliteration?.text ?? "",
      en: shown[k]?.translation?.text ?? "",
      segs,
      root: rootOf(segs),
      lemma: lemmaOf(segs),
    }));
    const sentences = buildSentences(base, jd);
    return base.map((w) => ({ ...w, j: sentences.find((s) => s.from <= w.i && w.i <= s.to)?.n ?? 1 }));
  }, [m, ayah, v, jd]);

  const sentences = useMemo(
    () => (words.length ? buildSentences(words, jd) : []),
    [words, jd],
  );

  // ── the word being studied ────────────────────────────────────────────────
  const [selState, setSel] = useState<{ key: string; i: number } | null>(null);
  const sel = Math.max(1, Math.min(words.length || 1, selState?.key === key ? selState.i : wordAsked || 1));
  // A word picked dissolves the chapters out, and they come back reading it.
  const [pending, setPending] = useState<{ key: string; i: number } | null>(null);
  const fading = pending?.key === key;
  const pick = useCallback(
    (i: number) => {
      if (i === sel || i < 1 || i > words.length) return;
      setPending({ key, i });
    },
    [sel, words.length, key],
  );
  useEffect(() => {
    if (!pending) return;
    const id = setTimeout(() => {
      setSel(pending);
      setPending(null);
    }, 150);
    return () => clearTimeout(id);
  }, [pending]);

  // ← reads on: the ayah runs right to left, so the next word is to the left.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /INPUT|TEXTAREA|SELECT/.test(el.tagName)) return;
      if (e.key === "ArrowLeft") pick(sel + 1);
      if (e.key === "ArrowRight") pick(sel - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pick, sel]);

  // ── the depth, the lines under the words, the layers ──────────────────────
  const go = useCallback(
    (next: { v?: string; w?: number; depth?: "student" | "scholar" }) => {
      const vk = next.v ?? key;
      const w = next.w ?? (next.v ? 0 : sel);
      const d = next.depth ?? (scholar ? "scholar" : "student");
      const q = [`v=${vk}`, w > 1 ? `w=${w}` : "", d === "student" ? "depth=student" : ""].filter(Boolean).join("&");
      const turn = () => router.replace(`/ayah/?${q}`, { scroll: !!next.v });
      // A new ayah is a page turned. Where the browser can, it says so.
      if (next.v && "startViewTransition" in document && !matchMedia("(prefers-reduced-motion: reduce)").matches) document.startViewTransition(turn);
      else turn();
    },
    [key, sel, scholar, router],
  );

  const [lines, setLines] = useState(true);
  const [layers, setLayers] = useState(ALL_ON);
  const [viewOpen, setViewOpen] = useState(false);
  const closeView = useCallback(() => setViewOpen(false), []);
  useClosedByBack(viewOpen, closeView);
  const [navigating, setNavigating] = useState(false);
  const closeNavigator = useCallback(() => setNavigating(false), []);

  // The words rise into place one by one on arrival, and again on asking: the
  // verse is drawn afresh, and each word's rise waits its turn.
  const [reveal, setReveal] = useState(0);

  // ── where the reader is in the page ───────────────────────────────────────
  const scroller = useRef<HTMLDivElement>(null);
  const [seenSet, setSeen] = useState<{ key: string; ids: Set<string> }>({ key: "", ids: new Set() });
  const [active, setActive] = useState("word");
  const seenIds = seenSet.key === key ? seenSet.ids : null;

  useEffect(() => {
    const root = scroller.current;
    if (!root || !words.length || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const add = entries.filter((e) => e.isIntersecting).map((e) => e.target.getAttribute("data-ch") ?? "");
        if (!add.length) return;
        setSeen((prev) => {
          const ids = new Set(prev.key === key ? prev.ids : []);
          let changed = prev.key !== key;
          for (const id of add) {
            if (!id || ids.has(id)) continue;
            ids.add(id);
            changed = true;
          }
          return changed ? { key, ids } : prev;
        });
      },
      { root, rootMargin: "0px 0px -12% 0px" },
    );
    root.querySelectorAll("[data-ch]").forEach((el) => io.observe(el));
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const top = root.getBoundingClientRect().top;
        let act = "word";
        root.querySelectorAll("[data-ch]").forEach((el) => {
          if (el.getBoundingClientRect().top - top <= 200) act = el.getAttribute("data-ch") ?? act;
        });
        setActive(act);
      });
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      root.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [words.length, key, layers]);

  // The chapter being read is kept in sight in the strip of chapters.
  const tabsRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const strip = tabsRef.current;
    const tab = strip?.querySelector<HTMLElement>("[aria-current='true']");
    if (!strip || !tab) return;
    // By where each stands on the screen, which reads the same in either direction.
    const box = strip.getBoundingClientRect();
    const at = tab.getBoundingClientRect();
    if (at.left < box.left) strip.scrollBy({ left: at.left - box.left - 24, behavior: "smooth" });
    else if (at.right > box.right) strip.scrollBy({ left: at.right - box.right + 24, behavior: "smooth" });
  }, [active]);

  const jump = useCallback((id: string) => {
    const root = scroller.current;
    const el = root?.querySelector<HTMLElement>(`#s-${id}`);
    if (!root || !el) return;
    const top = el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - 110;
    root.scrollTo({ top, behavior: "smooth" });
  }, []);

  // The lens sticks just under the place bar, which is one line on a wide
  // screen and two on a phone: its height is measured rather than assumed.
  const placeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const bar = placeRef.current;
    const page = scroller.current;
    if (!bar || !page || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => page.style.setProperty("--place-h", `${bar.offsetHeight}px`));
    ro.observe(bar);
    return () => ro.disconnect();
  }, []);

  // A new ayah starts at the top, with nothing yet risen.
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [key]);

  // ── what every chapter is handed ──────────────────────────────────────────
  // A fresh colophon for every ayah. Made here rather than cleared in an
  // effect, because the chapters' own effects run first and would be wiped.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- a new one for each ayah
  const cited = useMemo(() => citations(), [key]);

  const cur = words[sel - 1];
  const sentence = sentences.find((s) => cur && s.from <= cur.i && cur.i <= s.to) ?? sentences[0];
  const translation = plainText(v?.translations?.[0]?.text ?? "");

  const ctx: StudyCtx | null = useMemo(() => {
    if (!m || !cur || !sentence) return null;
    return {
      key,
      surah,
      ayah,
      total,
      words,
      sentences,
      sel,
      pick,
      cur,
      sentence,
      scholar,
      booksDown: booksDown === key,
      morph: m,
      translation,
      seen: (id: string) => !!seenIds?.has(id),
      cite: cited.cite,
    };
  }, [m, cur, sentence, key, surah, ayah, total, words, sentences, sel, pick, scholar, booksDown, translation, seenIds, cited]);

  // ── the place, and the words of the sentence being studied ────────────────
  const surahName = names.name(surah);
  const chapter = byId(surah);
  const place = chapter?.revelation_place === "makkah" ? t("ulum.makki") : chapter ? t("ulum.madani") : "";
  const activeLayer = LAYERS.find((l) => l.id === active);
  const activeName =
    active === "word" ? t("ulum.ch.word") : active === "sources" ? t("ulum.ch.sources") : activeLayer ? t(activeLayer.label) : "";

  const wazn = useMemo(() => {
    if (!jd || !cur) return "";
    const r = jd.j.sarf.find((x) => {
      const l = local(x.at, jd.read, words.length);
      return l && l.from <= cur.i && cur.i <= l.to;
    });
    return r ? (waznOf(r.text) ?? "") : "";
  }, [jd, cur, words.length]);

  if (failed) {
    return (
      <div className={styles.page}>
        <div className={styles.wrap}>
          <p className={styles.silent}>{t("ulum.unreachable")}</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "word", num: "00", label: t("ulum.ch.word") },
    ...LAYERS.map((l, k) => ({ id: l.id, num: String(k + 1).padStart(2, "0"), label: t(l.label) })).filter(
      (x) => layers[x.id as LayerId],
    ),
    { id: "sources", num: "12", label: t("ulum.ch.sources") },
  ];

  const stem = cur ? stemOf(cur.segs) : undefined;
  const posAr = stem ? (POS_ARABIC[classOf(stem)] ?? "") : "";
  const prevKey = ayah > 1 ? `${surah}:${ayah - 1}` : surah > 1 ? `${surah - 1}:${SURAH_NAMES[surah - 2].ayat}` : "";
  const nextKey = ayah < total ? `${surah}:${ayah + 1}` : surah < 114 ? `${surah + 1}:1` : "";

  return (
    <div className={styles.page}>
      <div className={styles.lampThread} aria-hidden />
      <div className={styles.scroller} ref={scroller} data-scroller>
        {/* ── where this is ─────────────────────────────────────────────── */}
        <div className={styles.placeBar} ref={placeRef}>
          {prevKey ? (
            <Link className={styles.stepAyah} href={`/ayah/?v=${prevKey}`} title={t("ulum.prevAyah")} aria-label={t("ulum.prevAyah")}>
              <svg viewBox="0 0 24 24" aria-hidden className={styles.flipRtl}>
                <path d="m15 18-6-6 6-6" />
              </svg>
            </Link>
          ) : (
            <span />
          )}
          <button type="button" className={styles.place} onClick={() => setNavigating(true)}>
            <span className={styles.placeSurah}>
              <span className={styles.placeNum}>{num(surah)}</span>
              {surahName}
              <span className={styles.placeAr} lang="ar">
                {SURAH_NAMES[surah - 1]?.arabic}
              </span>
            </span>
            <span className={styles.placeMeta}>
              {t("ulum.placeLine", { ayah: num(ayah), i: num(sel), n: num(words.length || 0) })}
              {activeName ? ` · ${activeName}` : ""}
            </span>
          </button>
          {nextKey ? (
            <Link className={styles.stepAyah} href={`/ayah/?v=${nextKey}`} title={t("ulum.nextAyah")} aria-label={t("ulum.nextAyah")}>
              <svg viewBox="0 0 24 24" aria-hidden className={styles.flipRtl}>
                <path d="m9 18 6-6-6-6" />
              </svg>
            </Link>
          ) : (
            <span />
          )}
          <div className={styles.placeFill} style={{ transform: `scaleX(${words.length ? sel / words.length : 0})` }} />
        </div>

        {/* ── the stage: the ayah itself ────────────────────────────────── */}
        <section className={styles.stage}>
          <div className={styles.stageInner}>
            <div className={styles.stageTop}>
              <div className={styles.stageTitleBox}>
                <div className={styles.kicker}>{t("ulum.kicker")}</div>
                <div className={styles.stageTitleRow}>
                  <h1 className={styles.stageTitle}>
                    {surahName} {num(surah)}:{num(ayah)}
                  </h1>
                  <span className={styles.stageTitleAr} lang="ar" dir="rtl">
                    {SURAH_NAMES[surah - 1]?.arabic} · {ar(ayah)}
                  </span>
                </div>
                <div className={styles.stageMeta}>
                  {[
                    place,
                    v ? t("ulum.juzPage", { juz: num(v.juz_number), page: num(v.page_number) }) : "",
                    words.length ? t("ulum.wordCount", { count: words.length }) : "",
                    sentences.length ? t("ulum.sentenceCount", { count: sentences.length }) : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <div className={styles.stageControls}>
                <div className={styles.levels} role="group" aria-label={t("ulum.depth")}>
                  <button
                    type="button"
                    className={!scholar ? styles.levelOn : styles.level}
                    aria-pressed={!scholar}
                    onClick={() => go({ depth: "student" })}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden>
                      <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
                      <path d="M22 10v6" />
                      <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
                    </svg>
                    {t("ulum.student")}
                  </button>
                  <button
                    type="button"
                    className={scholar ? styles.levelOn : styles.level}
                    aria-pressed={scholar}
                    onClick={() => go({ depth: "scholar" })}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden>
                      <path d="M12 7v14" />
                      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
                    </svg>
                    {t("ulum.scholar")}
                  </button>
                </div>
                <button type="button" className="btn btn-secondary" onClick={() => setLines(!lines)}>
                  {lines ? t("ulum.hideLines") : t("ulum.showLines")}
                </button>
                <button type="button" className="btn btn-primary" onClick={() => setReveal((r) => r + 1)}>
                  <svg viewBox="0 0 24 24" aria-hidden className={styles.btnIcon}>
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                  {t("ulum.reveal")}
                </button>
              </div>
            </div>

            <div className={styles.verse} dir="rtl" lang="ar" key={`${key}#${reveal}`}>
              {sentences.map((s) => {
                const me = s.n === sentence?.n;
                return (
                  <div key={s.n} className={styles.jumla}>
                    {sentences.length > 1 && (
                      <button
                        type="button"
                        className={me ? styles.jumlaNumOn : styles.jumlaNum}
                        onClick={() => pick(s.from)}
                        title={t("ulum.pickSentence", { n: s.n })}
                      >
                        {ar(s.n)}
                      </button>
                    )}
                    <div className={styles.jumlaWords}>
                      {words
                        .filter((w) => w.j === s.n)
                        .map((w) => (
                          <button
                            key={w.i}
                            type="button"
                            className={`${styles.word} ${w.i === sel ? styles.wordOn : ""} ${styles.wordRisen}`}
                            style={{ animationDelay: `${(w.i - 1) * Math.min(60, 2600 / words.length)}ms` }}
                            onClick={() => pick(w.i)}
                          >
                            <span className={styles.wordAr}>{w.ar}</span>
                            {lines && (
                              <>
                                <span className={styles.wordTr} dir="ltr">
                                  {w.tr}
                                </span>
                                <span className={styles.wordEn} dir="ltr">
                                  {w.en}
                                </span>
                              </>
                            )}
                          </button>
                        ))}
                      {s.n === sentences.length && <span className={styles.ayahEnd}>{ar(ayah)}</span>}
                    </div>
                    <div className={me ? styles.jumlaLineOn : styles.jumlaLine} />
                  </div>
                );
              })}
            </div>

            {translation && (
              <div className={styles.meaning}>
                <div>
                  <div className={styles.kicker}>{t("ulum.meaning")}</div>
                  <div className={styles.meaningNote}>{v?.translations?.[0]?.resource_name ?? ""}</div>
                </div>
                <p className={styles.meaningText} lang={locale === "en" ? "en" : undefined}>
                  {translation}
                </p>
              </div>
            )}
            {sentences.length > 1 && (
              <p className={styles.stageNote}>{t("ulum.sentencesFrom")}</p>
            )}
          </div>
        </section>

        {/* ── the lens: the word in hand, and where to go ───────────────── */}
        <div className={styles.lens}>
          <div className={styles.lensInner}>
            <button type="button" className={styles.lensStep} onClick={() => pick(sel - 1)} title={t("ulum.prevWord")} aria-label={t("ulum.prevWord")}>
              <svg viewBox="0 0 24 24" aria-hidden className={styles.flipRtl}>
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <div className={styles.lensWord}>
              <span className={styles.lensAr} lang="ar">
                {cur?.ar}
              </span>
              <span className={styles.lensGloss}>
                <span className={styles.lensTr}>{cur?.tr}</span>
                <span className={styles.lensEn}>{cur?.en}</span>
              </span>
            </div>
            <button type="button" className={styles.lensStep} onClick={() => pick(sel + 1)} title={t("ulum.nextWord")} aria-label={t("ulum.nextWord")}>
              <svg viewBox="0 0 24 24" aria-hidden className={styles.flipRtl}>
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
            <div className={styles.lensRule} />
            <nav className={styles.tabs} aria-label={t("ulum.chapters")} ref={tabsRef}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={tab.id === active ? styles.tabOn : styles.tab}
                  aria-current={tab.id === active}
                  onClick={() => jump(tab.id)}
                >
                  <span className={styles.tabNum}>{tab.num}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
            <button
              type="button"
              className={`btn btn-secondary ${styles.viewBtn} ${viewOpen ? "btn-on" : ""}`}
              onClick={() => setViewOpen(!viewOpen)}
              aria-expanded={viewOpen}
            >
              <svg viewBox="0 0 24 24" aria-hidden className={styles.btnIcon}>
                <path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4" />
              </svg>
              <span className={styles.viewLabel}>{t("ulum.view")}</span>
              <span className={styles.viewActive}>{activeName}</span>
            </button>
          </div>
          {viewOpen && (
            <div className={styles.viewPop} role="dialog" aria-label={t("ulum.layers")}>
              <div className={styles.viewHead}>
                <span className={styles.kicker}>{t("ulum.layers")}</span>
                <span>
                  <button type="button" className="btn btn-ghost" onClick={() => setLayers(ALL_ON)}>
                    {t("ulum.showAll")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setLayers(Object.fromEntries(LAYERS.map((l) => [l.id, false])) as Record<LayerId, boolean>)}
                  >
                    {t("ulum.hideAll")}
                  </button>
                </span>
              </div>
              <div className={styles.viewGrid}>
                {LAYERS.map((l, k) => (
                  <div key={l.id} className={styles.viewRow}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={layers[l.id]}
                      className={layers[l.id] ? styles.checkOn : styles.check}
                      onClick={() => setLayers((x) => ({ ...x, [l.id]: !x[l.id] }))}
                      aria-label={t(l.label)}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden>
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className={styles.viewJump}
                      style={{ opacity: layers[l.id] ? 1 : 0.45 }}
                      onClick={() => {
                        if (!layers[l.id]) setLayers((x) => ({ ...x, [l.id]: true }));
                        setViewOpen(false);
                        requestAnimationFrame(() => requestAnimationFrame(() => jump(l.id)));
                      }}
                    >
                      <span className={styles.tabNum}>{String(k + 1).padStart(2, "0")}</span>
                      <span className={styles.viewName}>{t(l.label)}</span>
                      <span className={styles.viewAr} lang="ar">
                        {l.ar}
                      </span>
                    </button>
                  </div>
                ))}
              </div>
              <p className={styles.viewKeys}>{t("ulum.keys")}</p>
            </div>
          )}
        </div>

        {/* ── the chapters ──────────────────────────────────────────────── */}
        {ctx ? (
          <div className={fading ? styles.chaptersFading : styles.chapters}>
            <WordChapter ctx={ctx} wazn={wazn} posAr={posAr} jd={jd} />
            {layers.lughah && <Lughah ctx={ctx} />}
            {layers.sarf && <Sarf ctx={ctx} jd={jd} />}
            {layers.nahw && <Nahw ctx={ctx} jd={jd} />}
            {layers.balagha && <Balagha ctx={ctx} jd={jd} />}
            {layers.qiraat && <Qiraat ctx={ctx} />}
            {layers.asbab && <Asbab ctx={ctx} prevKey={prevKey} nextKey={nextKey} />}
            {layers.mathur && <Mathur ctx={ctx} />}
            {layers.mufassirun && <Mufassirun ctx={ctx} />}
            {layers.ahkam && <Ahkam ctx={ctx} />}
            {layers.munasabat && <Munasabat ctx={ctx} />}
            {layers.fawaid && <Fawaid ctx={ctx} jd={jd} />}
            <Sources ctx={ctx} cited={cited} />
          </div>
        ) : (
          <div className={styles.wrap}>
            <p className={styles.silent}>{t("ulum.loading")}</p>
          </div>
        )}
      </div>

      {navigating && (
        <Navigator
          surah={surah}
          ayah={ayah}
          onGo={(s, a) => {
            setNavigating(false);
            go({ v: `${s}:${a ?? 1}` });
          }}
          onClose={closeNavigator}
        />
      )}
    </div>
  );
}

// ── 00 · the word ───────────────────────────────────────────────────────────

const NICHE_OUTER = "M1 119V61A60 60 0 0 1 50 2.02A60 60 0 0 1 99 61V119Z";
const NICHE_INNER = "M7 113V61A54 54 0 0 1 50 8.13A54 54 0 0 1 93 61V113Z";
const NICHE_LAMP =
  "M45.8 18.1H54.2Q52.6 20.7 52.4 23.4C56.6 24.7 57 29.5 53.1 31.3L52 32.8H48L46.9 31.3C43 29.5 43.4 24.7 47.6 23.4Q47.4 20.7 45.8 18.1Z";

const ORDINAL_AR = ["", "الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة", "السابعة", "الثامنة", "التاسعة", "العاشرة"];

function WordChapter({ ctx, wazn, posAr, jd }: { ctx: StudyCtx; wazn: string; posAr: string; jd: { j: Jadwal; read: Read } | null }) {
  const { t, n: num } = useLocale();
  const { cur, sentence, sentences, words } = ctx;
  const sw = words.filter((w) => w.j === sentence.n);
  const place = sentence.jumla?.place ?? "";
  return (
    <section id="s-word" data-ch="word" className={styles.wordSection}>
      <div className={`${styles.wrap} ${styles.wordGrid}`}>
        <div className={styles.niche}>
          <svg viewBox="0 0 100 120" preserveAspectRatio="none" className={styles.nicheSvg} aria-hidden>
            <defs>
              <radialGradient id="ulumNicheGlow" cx="50%" cy="18%" r="80%">
                <stop offset="0" stopColor="var(--mk-gold)" stopOpacity="0.34" />
                <stop offset="0.55" stopColor="var(--mk-gold)" stopOpacity="0.08" />
                <stop offset="1" stopColor="var(--mk-gold)" stopOpacity="0" />
              </radialGradient>
            </defs>
            <path d={NICHE_INNER} fill="url(#ulumNicheGlow)" className={styles.nicheInner} vectorEffect="non-scaling-stroke" />
            <path d={NICHE_OUTER} fill="none" className={styles.nicheOuter} vectorEffect="non-scaling-stroke" />
            <path d="M50 8.4V18.1" fill="none" className={styles.nicheOuter} vectorEffect="non-scaling-stroke" />
            <path d={NICHE_LAMP} className={styles.nicheLamp} />
          </svg>
          <div className={styles.nicheWord} lang="ar">
            {cur.ar}
          </div>
          <div className={styles.nicheTr}>{cur.tr}</div>
          <div className={styles.nicheEn}>{cur.en}</div>
        </div>
        <div className={styles.wordSide}>
          <div className={styles.wordKickRow}>
            <span className={styles.kicker}>
              {t("ulum.wordOf", { i: num(cur.i), n: num(words.length), s: num(sentence.n), all: num(sentences.length) })}
            </span>
            {sentence.n <= 10 && sentences.length > 1 && (
              <span className={styles.wordKickAr} lang="ar">
                الجملة {ORDINAL_AR[sentence.n]}
              </span>
            )}
          </div>
          <div className={styles.ribbon} dir="rtl" lang="ar">
            {sw.map((w) => (
              <button key={w.i} type="button" className={w.i === cur.i ? styles.ribbonOn : styles.ribbonWord} onClick={() => ctx.pick(w.i)}>
                {w.ar}
              </button>
            ))}
          </div>
          <div className={styles.sentenceKind}>
            {t(sentence.kind === "verbal" ? "ulum.verbal" : "ulum.nominal")}
            <span lang="ar"> · {sentence.kind === "verbal" ? "جملة فعلية" : "جملة اسمية"}</span>
          </div>
          {place && ctx.scholar && (
            <p className={styles.sentencePlace} dir="rtl" lang="ar">
              {sentence.jumla?.quote ? `«${sentence.jumla.quote}» ` : ""}
              {place}
            </p>
          )}
          {jd && place && <p className={styles.fromBook}>{t("ulum.placeFrom")}</p>}
        </div>
      </div>
      <div className={styles.wrap}>
        <dl className={styles.glance}>
          {[
            [t("ulum.g.location"), `${ctx.surah}:${ctx.ayah}:${cur.i}`, false],
            [t("ulum.g.sentence"), t("ulum.g.nOf", { n: num(sentence.n), all: num(sentences.length) }), false],
            [t("ulum.g.pos"), posAr || "—", true],
            [t("ulum.g.root"), cur.root ? [...cur.root].join(" ") : "—", true],
            [t("ulum.g.lemma"), cur.lemma || "—", true],
            [t("ulum.g.pattern"), wazn || "—", true],
          ].map(([k, value, arabic], idx) => (
            <div key={idx} className={styles.glanceCell}>
              <dt>{k as string}</dt>
              <dd lang={arabic ? "ar" : undefined} className={arabic ? styles.glanceAr : undefined}>
                {value as string}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
