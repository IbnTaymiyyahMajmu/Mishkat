"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { LINES, PAGES, ayatOn, colourPagesDrawn, loadPage, loadPageFont, pageOf, pageStart, placeOf, type MushafPage } from "@/lib/quran/pages";
import type { Family } from "@/lib/quran/tajweed";
import { TajweedLegend } from "@/components/tajweed/TajweedLegend";
import { PALETTE, useTajweedPalette } from "./useTajweedPalette";
import { SURAH_NAMES } from "@/lib/quran/surahNames";
import { noteRead } from "@/lib/store/reading";
import { useSettings } from "@/lib/store/settings";
import { arabicNumber, isValidVerseKey } from "@/lib/text";
import { useSwipe } from "@/lib/useSwipe";
import { useLocale } from "@/lib/i18n";
import { useSurahNames } from "@/lib/i18n/surah";
import { PageIndex } from "./PageIndex";
import styles from "./PageView.module.css";

/**
 * The muṣḥaf, a page at a time: `/mushaf/?p=42`, or `/mushaf/?v=2:255` for the
 * page an ayah is on.
 *
 * One page of the Madīnah muṣḥaf on the screen, its fifteen lines as they are
 * printed and every word on the line it is printed on. It is set in the
 * page's own font (see `lib/quran/pages.ts`) at whatever size makes the
 * longest line exactly as wide as the page, and the other lines are spread to
 * that width, as the printer's are.
 *
 * A page is turned the way the book is: the next page is to the left, so it
 * is brought in by a stroke to the right, by the arrow on the left, and by
 * the left arrow key. Pressing the line at the head of the page opens the
 * index — by surah, by juzʾ and the quarters of its two ḥizbs, or by the
 * number of the page.
 *
 * Of the reader's settings it takes the light, and tajweed: with tajweed on,
 * the page is the Complex's tajweed muṣḥaf — the same page, its letters in
 * the colours of their rules, given this site's colours so there is one key
 * to learn (`useTajweedPalette`). The size is the page's, and there is no
 * translation: this is the view for a reader who wants the page they know.
 */

const noSubscription = () => () => {};
const BASMALA = "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ";
/**
 * The basmala in the muṣḥaf's own hand. Each page's font numbers its words
 * from the same place, and the first four words of the first page are the
 * basmala — so, set in the first page's font, these four are it, drawn by the
 * hand that drew the rest of the page.
 */
const BASMALA_DRAWN = [0xfc41, 0xfc42, 0xfc43, 0xfc44].map((code) => String.fromCharCode(code));

function wholeIn(raw: string | null, lo: number, hi: number): number {
  const n = Number(raw);
  return raw !== null && Number.isInteger(n) && n >= lo && n <= hi ? n : 0;
}

export function PageView() {
  const ready = useSyncExternalStore(noSubscription, () => true, () => false);
  const params = useSearchParams();
  const router = useRouter();
  const { settings, update, lastRead, setLastRead } = useSettings();
  // The tajweed pages need a browser that draws a font's own colours.
  const drawsColour = useSyncExternalStore(noSubscription, colourPagesDrawn, () => false);
  const tajweed = settings.tajweed && drawsColour;
  const [focus, setFocus] = useState<Family[]>([]);
  const { t, n } = useLocale();
  const names = useSurahNames();

  // ── which page ────────────────────────────────────────────────────────────
  const askedAyah = params.get("v") ?? "";
  const ayah = isValidVerseKey(askedAyah) ? askedAyah : "";
  const page =
    wholeIn(params.get("p"), 1, PAGES) ||
    (ayah ? pageOf(ayah) : 0) ||
    (ready && lastRead ? pageOf(lastRead.verseKey ?? `${lastRead.surah}:1`) : 1);

  /** Which way the last turn went, so the page can come in from that side. */
  const [turned, setTurned] = useState<"next" | "prev" | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [indexOpen, setIndexOpen] = useState(false);

  const go = (to: number, way: "next" | "prev" | null = null) => {
    const target = Math.min(PAGES, Math.max(1, to));
    setTurned(way);
    setPicked(null);
    router.replace(`/mushaf/?p=${target}`, { scroll: false });
  };
  const turn = (way: "next" | "prev") => {
    const to = page + (way === "next" ? 1 : -1);
    if (to >= 1 && to <= PAGES) go(to, way);
  };

  // ── the page and its font ─────────────────────────────────────────────────
  const [held, setHeld] = useState<{ data: MushafPage; family: string | null; tajweed: boolean; opening: string | null } | null>(null);
  const [failed, setFailed] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    // The font is waited for with the page, so the lines are never drawn once
    // in a face that is not theirs and then again in the one that is. Without
    // it the page is still set, from its words as text.
    const font = loadPageFont(page, tajweed).catch(() => null);
    loadPage(page)
      .then(async (data) => {
        // A page with a basmala on it wants the first page's font as well.
        const drawn = data.lines.some((l) => l.kind === "basmala") ? loadPageFont(1).catch(() => null) : null;
        const [family, opening] = await Promise.all([font, drawn]);
        return { data, family, tajweed: tajweed && !!family, opening: family ? opening : null };
      })
      .then(
        (next) => {
          if (!alive) return;
          setHeld(next);
          setFailed(null);
        },
        () => alive && setFailed(page),
      );
    // The pages either side are made ready while this one is read.
    const ahead = setTimeout(() => {
      for (const near of [page + 1, page - 1]) {
        if (near < 1 || near > PAGES) continue;
        void loadPage(near).catch(() => {});
        void loadPageFont(near, tajweed).catch(() => {});
      }
    }, 600);
    return () => {
      alive = false;
      clearTimeout(ahead);
    };
  }, [ready, page, attempt, tajweed]);

  const shown = held?.data.page === page ? held : null;

  // ── the size of the type ──────────────────────────────────────────────────
  // Every line is first set at a known size and left as long as it wants to
  // be; the longest of them says how large the type can be for the page to
  // fill its width. Nothing is assumed about the font, so the same sum sets
  // the page from plain text when the font could not be had.
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [fit, setFit] = useState<{ page: number; size: number; short: boolean[] } | null>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const measure = () => setWidth(sheet.clientWidth);
    measure();
    const watching = new ResizeObserver(measure);
    watching.observe(sheet);
    return () => watching.disconnect();
  }, [ready]);

  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet || !shown || !width) return;
    const rows = [...sheet.querySelectorAll<HTMLElement>("[data-line]")];
    const PROBE = 100;
    const lengths = rows.map((row) => {
      row.style.fontSize = `${PROBE}px`;
      row.style.width = "max-content";
      const length = row.getBoundingClientRect().width;
      row.style.fontSize = "";
      row.style.width = "";
      return length;
    });
    const longest = Math.max(...lengths, 1);
    // The first two pages stand in a frame, which takes an em of the width.
    const frame = shown.data.page <= 2 ? 1 : 0;
    // Not past what fifteen lines of it would need of the screen's height.
    const size = Math.min(width / (longest / PROBE + frame), 46);
    setFit({ page: shown.data.page, size, short: lengths.map((l) => l < longest * 0.9) });
  }, [shown, width]);

  const fitted = fit && shown && fit.page === shown.data.page ? fit : null;
  useTajweedPalette(shown?.tajweed ? shown.family : null, focus, sheetRef);

  // ── keeping the place, and what was read ──────────────────────────────────
  useEffect(() => {
    if (!shown) return;
    const key = pageStart(page);
    setLastRead({ surah: Number(key.split(":")[0]), verseKey: key });
  }, [shown, page, setLastRead]);

  useEffect(() => {
    if (!shown) return;
    // A page is read when it has been open about as long as it takes to read:
    // a third of a second a word, and not less than ten seconds.
    const needed = Math.min(120, Math.max(10, shown.data.words * 0.33));
    let spent = 0;
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      spent += 1;
      if (spent >= needed) {
        clearInterval(id);
        noteRead(ayatOn(page));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [shown, page]);

  // ── turning ───────────────────────────────────────────────────────────────
  const swipe = useSwipe(turn, !indexOpen);
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (indexOpen || e.metaKey || e.ctrlKey || e.altKey || target?.closest("input, select, textarea")) return;
    if (e.key === "ArrowLeft" || e.key === "PageDown") turn("next");
    else if (e.key === "ArrowRight" || e.key === "PageUp") turn("prev");
    else if (e.key === "Escape") setPicked(null);
  });
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const place = placeOf(page);
  const lit = picked ?? (ayah && pageOf(ayah) === page ? ayah : null);
  const surahLine = place.surahs.map((s) => names.name(s)).join(" · ");
  const pickedSurah = picked ? Number(picked.split(":")[0]) : 0;

  return (
    <div className={`page-shell ${styles.shell}`}>
      <div className={styles.bar}>
        <button type="button" className={styles.turn} onClick={() => turn("next")} disabled={page >= PAGES} aria-label={t("pages.next")} title={t("pages.next")}>
          <Chevron left />
        </button>
        <button type="button" className={styles.where} onClick={() => setIndexOpen(true)} aria-haspopup="dialog" aria-expanded={indexOpen}>
          <span className={`${styles.whereSurah} ${names.arabic ? "surah-ar" : ""}`}>{surahLine}</span>
          <span className={styles.wherePlace}>
            {t("pages.place", { page: n(page), juz: n(place.juz), hizb: n(place.hizb) })}
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M1 1l4 4 4-4" />
            </svg>
          </span>
        </button>
        <button type="button" className={styles.turn} onClick={() => turn("prev")} disabled={page <= 1} aria-label={t("pages.prev")} title={t("pages.prev")}>
          <Chevron />
        </button>
        {/* What the colours mean, while the page is in colour. */}
        {shown?.tajweed && (
          <div className={styles.legend}>
            <TajweedLegend map={null} focus={focus} onFocus={setFocus} compact />
          </div>
        )}
      </div>

      <div className={styles.stage} ref={swipe}>
        <div
          ref={sheetRef}
          className={styles.sheet}
          data-frame={page <= 2 || undefined}
          style={fitted ? { fontSize: `${fitted.size}px` } : undefined}
        >
          {failed === page && !shown ? (
            <div className={styles.state}>
              <p>{t("mushaf.unreached")}</p>
              <button type="button" className="btn btn-primary" onClick={() => setAttempt((x) => x + 1)}>
                {t("common.tryAgain")}
              </button>
            </div>
          ) : !shown ? (
            <div className={styles.ghost} aria-label={t("common.loadingText")}>
              {Array.from({ length: page <= 2 ? 8 : LINES }, (_, i) => (
                <i key={i} />
              ))}
            </div>
          ) : (
            <div
              key={page}
              className={styles.leaf}
              data-turned={turned ?? undefined}
              data-ready={fitted ? "" : undefined}
              style={shown.family ? { fontFamily: `"${shown.family}"`, fontPalette: shown.tajweed ? PALETTE : undefined } : undefined}
              data-plain={shown.family ? undefined : ""}
              lang="ar"
              dir="rtl"
            >
              {shown.data.lines.map((line, i) =>
                line.kind === "words" ? (
                  <p key={i} className={styles.line} data-line="" data-short={fitted?.short[i] || undefined}>
                    {line.words.map((word, j) => (
                      <span
                        key={j}
                        className={styles.word}
                        data-on={lit === word.key || undefined}
                        data-end={word.end || undefined}
                        onClick={() => setPicked((held) => (held === word.key ? null : word.key))}
                      >
                        {shown.family && word.glyph ? word.glyph : word.end ? arabicNumber(word.key.split(":")[1]) : word.text}
                      </span>
                    ))}
                  </p>
                ) : line.kind === "name" ? (
                  <p key={i} className={styles.name}>
                    <span>سورة {SURAH_NAMES[line.surah - 1].arabic}</span>
                  </p>
                ) : line.kind === "basmala" ? (
                  shown.opening ? (
                    <p key={i} className={styles.basmalaDrawn} style={{ fontFamily: `"${shown.opening}"` }} aria-label={BASMALA}>
                      {BASMALA_DRAWN.map((glyph) => (
                        <span key={glyph} aria-hidden="true">
                          {glyph}
                        </span>
                      ))}
                    </p>
                  ) : (
                    <p key={i} className={styles.basmala}>
                      {BASMALA}
                    </p>
                  )
                ) : (
                  <p key={i} className={styles.empty} aria-hidden="true" />
                ),
              )}
            </div>
          )}
        </div>
        <div className={styles.foot}>
          <div className={styles.folio} aria-hidden="true">
            {arabicNumber(page)}
          </div>
          {/* The page's own colour, as the muṣḥaf view's bar has it: the same
              setting as everywhere, so the reader who reads in colour finds
              the pages in colour too. */}
          {drawsColour && (
            <button
              type="button"
              className={`btn btn-secondary ${settings.tajweed ? "btn-on" : ""} ${styles.tajweed}`}
              aria-pressed={settings.tajweed}
              title={t("settings.tajweedOn")}
              onClick={() => update({ tajweed: !settings.tajweed })}
            >
              {t("panel.tajweed")}
            </button>
          )}
        </div>
      </div>

      {/* The ayah that was touched: named, and with the way to it in the reader. */}
      <div className={styles.picked} data-open={picked ? "" : undefined} inert={!picked}>
        {picked && (
          <>
            <span className={styles.pickedName}>
              <span className={names.arabic ? "surah-ar" : undefined}>{names.name(pickedSurah)}</span> {picked}
            </span>
            <Link href={`/read/${pickedSurah}/#${picked}`} className="btn btn-primary">
              {t("pages.openReader")}
            </Link>
            <Link href={`/ayah/?v=${picked}`} className="btn btn-secondary">
              {t("ulum.open")}
            </Link>
          </>
        )}
      </div>

      <PageIndex open={indexOpen} page={page} onClose={() => setIndexOpen(false)} onGo={(to) => (setIndexOpen(false), go(to))} />
    </div>
  );
}

function Chevron({ left = false }: { left?: boolean }) {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={left ? "M8 1.5L1.5 8 8 14.5" : "M2 1.5L8.5 8 2 14.5"} />
    </svg>
  );
}
