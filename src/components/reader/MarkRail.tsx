"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  cluster,
  juzBands,
  juzBreaks,
  namedMarks,
  rukuStops,
  sajdaMarks,
  type Cluster,
  type Mark,
} from "@/lib/quran/marks";
import { readStop, writeStop } from "@/lib/store/stops";
import type { Verse } from "@/lib/quran/types";
import { useT } from "@/lib/i18n";
import styles from "./MarkRail.module.css";

/**
 * The surah, drawn down the side of it.
 *
 * The rail is the whole surah at a glance and a way of moving through it: how
 * far in the reader is, where the juz turn over, where a reciter is meant to
 * break, where the ۩ fall, and where they themselves stopped last time. Every
 * one of those is read off the corpus (see lib/quran/marks.ts), so it is right
 * for all one hundred and fourteen surahs without any of them being a case.
 *
 * Reading position is painted straight onto the DOM rather than held in state.
 * A long surah is thousands of nodes and the position changes on every scroll
 * frame; re-rendering the reader to move a seven-pixel dot would be the most
 * expensive thing on the page.
 */

/** Two marks closer together than this share a button. */
const MERGE_PCT = 4.5;

/** How close the preview card may come to the top or bottom of the reader. */
const EDGE = 12;

interface Props {
  surah: number;
  verses: Verse[];
  /** Total ayat, known from the chapter table before the text has arrived. */
  total: number;
  /** A passage being looped in this surah, drawn so its extent can be seen. */
  loop: { from: number; to: number } | null;
  scrollerRef: React.RefObject<HTMLDivElement | null>;
  onJump: (ayah: number) => void;
}

export function MarkRail({ surah, verses, total, loop, scrollerRef, onJump }: Props) {
  const t = useT();
  const railRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const previewKickerRef = useRef<HTMLDivElement>(null);
  const previewTextRef = useRef<HTMLDivElement>(null);
  const previewNoteRef = useRef<HTMLDivElement>(null);

  const atRef = useRef(1);
  const draggingRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Taken once, when the surah opens: this is where you stopped *last* time and
  // must not follow you down the page as you read.
  const [checkpoint] = useState(() => (typeof window === "undefined" ? null : readStop(surah)));

  // The surah's own length, not however much of it has arrived. A long surah
  // comes in pages, and measuring the rail against the pages so far redrew it
  // six times over as al-Baqarah loaded — every mark sliding up the rail and
  // the reader's own position with them. The chapter table knows the length
  // from the start; what has arrived is the fallback for when it does not.
  const n = Math.max(total, verses.length);
  const pctOf = useCallback((ayah: number) => (n > 1 ? ((ayah - 1) / (n - 1)) * 100 : 0), [n]);

  const bands = useMemo(() => juzBands(verses), [verses]);
  const stops = useMemo(() => rukuStops(verses), [verses]);
  const juz = useMemo(() => juzBreaks(verses), [verses]);

  const clusters = useMemo(() => {
    const marks: Mark[] = [...sajdaMarks(surah, verses), ...namedMarks(surah, n)];
    if (checkpoint && checkpoint <= n) {
      marks.push({ ayah: checkpoint, kind: "stop", label: "rail.stopped" });
    }
    return cluster(marks, n, MERGE_PCT);
  }, [verses, surah, n, checkpoint]);

  const verseAt = useCallback(
    (ayah: number) => verses.find((v) => v.verse_number === ayah),
    [verses],
  );

  /** The opening of an ayah, for the preview card. */
  const opening = useCallback(
    (ayah: number) => {
      const v = verseAt(ayah);
      if (!v) return "…";
      const words = (v.words ?? [])
        .filter((w) => w.char_type_name === "word")
        .slice(0, 6)
        .map((w) => w.text_uthmani ?? w.text ?? "")
        .join(" ");
      return words || v.text_uthmani?.split(" ").slice(0, 6).join(" ") || "…";
    },
    [verseAt],
  );

  const noteFor = useCallback(
    (ayah: number): string => {
      const found = clusters
        .flatMap((c) => c.items)
        .filter((m) => m.ayah === ayah)
        .map((m) => (m.kind === "sajda" ? `۩ ${t(m.label)}` : t(m.label)));
      if (found.length) return found.join("  ·  ");
      return stops.includes(ayah) ? t("rail.ruku") : "";
    },
    [clusters, stops, t],
  );

  // ── the preview, painted directly ─────────────────────────────────────────
  const showAt = useCallback(
    (ayah: number, note?: string, kicker?: string) => {
      const pct = pctOf(ayah);

      // The cursor is the thing that points, so it sits at the true height and
      // is never moved. Its content is written before the card is placed: the
      // card is as tall as its note is long, and it cannot be fitted to the
      // screen until it holds what it is going to hold.
      if (cursorRef.current) {
        cursorRef.current.style.top = `${pct}%`;
        cursorRef.current.classList.add(styles.cursorOn);
      }
      if (previewKickerRef.current) {
        const j = verseAt(ayah)?.juz_number;
        previewKickerRef.current.textContent =
          kicker ?? [t("common.ayahN", { n: ayah }), j ? t("common.juzN", { n: j }) : ""].filter(Boolean).join(" · ");
      }
      if (previewTextRef.current) previewTextRef.current.textContent = opening(ayah);
      if (previewNoteRef.current) {
        const text = note ?? noteFor(ayah);
        previewNoteRef.current.textContent = text;
        previewNoteRef.current.style.display = text ? "block" : "none";
      }

      const card = previewRef.current;
      const track = trackRef.current;
      const rail = railRef.current;
      if (!card || !track || !rail) return;
      card.classList.add(styles.previewOn);

      // The card is centred on the ayah, so at either end of a surah half of it
      // would hang off the screen — the last ayah of al-Baqarah sits at the foot
      // of the rail, and the note under it was being cut in half. It is held
      // inside the rail instead, which is the height of the reader itself.
      const half = card.offsetHeight / 2;
      const top = track.offsetTop + (pct / 100) * track.clientHeight;
      const lowest = EDGE + half;
      const highest = rail.clientHeight - EDGE - half;
      const held =
        highest < lowest
          ? // Taller than the reader is deep, which takes a very short window
            // and a long note. Centred is the least bad place for it.
            rail.clientHeight / 2
          : Math.min(Math.max(top, lowest), highest);
      card.style.top = `${held - track.offsetTop}px`;
    },
    [pctOf, verseAt, opening, noteFor, t],
  );

  const showGroup = useCallback(
    (c: Cluster) => {
      const first = c.items[0].ayah;
      const last = c.items[c.items.length - 1].ayah;
      showAt(
        first,
        c.items.map((m) => t("rail.mark", { ayah: m.ayah, label: t(m.label) })).join("  ·  "),
        first === last ? t("common.ayahN", { n: first }) : t("common.ayahRange", { from: first, to: last }),
      );
    },
    [showAt, t],
  );

  const hide = useCallback(() => {
    if (draggingRef.current) return;
    cursorRef.current?.classList.remove(styles.cursorOn);
    previewRef.current?.classList.remove(styles.previewOn);
  }, []);

  /** Which ayah a pointer at this height is over. */
  const ayahAtY = useCallback(
    (clientY: number) => {
      const track = trackRef.current;
      if (!track) return 1;
      const r = track.getBoundingClientRect();
      const f = r.height ? Math.min(1, Math.max(0, (clientY - r.top) / r.height)) : 0;
      return Math.min(n, Math.max(1, Math.round(f * (n - 1)) + 1));
    },
    [n],
  );

  // ── where the reader is ───────────────────────────────────────────────────
  const paint = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!fillRef.current || !markerRef.current) return;

    let at = 1;
    if (scroller) {
      // offsetTop is already laid out, so reading the position costs no forced
      // reflow even with every ayah of a long surah on the page.
      const line = scroller.scrollTop + 96;
      const rendered = scroller.querySelectorAll<HTMLElement>("[data-verse]");
      for (const el of rendered) {
        if (el.offsetTop > line) break;
        const ayah = Number(el.getAttribute("data-verse")?.split(":")[1]);
        if (ayah > at) at = ayah;
      }
      // The last ayah is never scrolled past — the page ends under it — so the
      // rail would stop just short of full without this. Only when the surah is
      // all there, though: the reader is at the foot of a chunk far more often
      // than at the end of al-Baqarah, and claiming otherwise would both fill
      // the rail and record a stopping place they never reached.
      const last = rendered[rendered.length - 1]?.getAttribute("data-verse")?.split(":")[1];
      const complete = Number(last) === n;
      if (complete && scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 40) at = n;
    }

    const pct = pctOf(at);
    fillRef.current.style.height = `${pct}%`;
    markerRef.current.style.top = `${pct}%`;
    if (readoutRef.current) readoutRef.current.textContent = `${at} / ${n}`;
    if (sliderRef.current) {
      sliderRef.current.setAttribute("aria-valuenow", String(at));
      sliderRef.current.setAttribute("aria-valuetext", t("common.ayahOf", { n: at, total: n }));
    }

    // A juz label the marker has drawn level with steps aside rather than being
    // painted over: the readout and the labels share one column.
    const track = trackRef.current;
    if (track) {
      const h = track.clientHeight || 1;
      for (const el of track.querySelectorAll<HTMLElement>("[data-juz-pct]")) {
        const d = Math.abs(((Number(el.dataset.juzPct) - pct) / 100) * h);
        el.style.opacity = d < 16 ? "0" : "1";
      }
    }

    if (atRef.current !== at) {
      atRef.current = at;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => writeStop(surah, at), 900);
    }
  }, [scrollerRef, pctOf, n, surah, t]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    paint();
    scroller.addEventListener("scroll", paint, { passive: true });
    return () => scroller.removeEventListener("scroll", paint);
  }, [scrollerRef, paint]);

  // Ayat arriving or being rendered move every mark, so the position is
  // repainted when the surah grows as well as when it is scrolled.
  useEffect(() => {
    paint();
  }, [paint, verses.length]);

  // Leaving within a second of stopping used to lose the stopping place: the
  // write was still waiting on its timer and the timer was simply cancelled.
  // The place is known, so it is written on the way out instead.
  useEffect(
    () => () => {
      if (!saveTimer.current) return;
      clearTimeout(saveTimer.current);
      writeStop(surah, atRef.current);
    },
    [surah],
  );

  // ── dragging ──────────────────────────────────────────────────────────────
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const from = ayahAtY(e.clientY);
      draggingRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      showAt(from);
      onJump(from);

      const move = (ev: PointerEvent) => {
        if (draggingRef.current) showAt(ayahAtY(ev.clientY));
      };
      const done = () => {
        draggingRef.current = false;
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", done);
        hide();
      };
      const up = (ev: PointerEvent) => {
        const to = ayahAtY(ev.clientY);
        if (to !== from) onJump(to);
        done();
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      // A drag the browser takes over — a touch it decides is a scroll — ends
      // in a cancel and never in an up. Without this the rail stayed in mid-
      // drag for good, its preview card stuck open over the text.
      window.addEventListener("pointercancel", done);
    },
    [ayahAtY, showAt, onJump, hide],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const at = atRef.current;
      const step = e.shiftKey ? 10 : 1;
      const to =
        e.key === "ArrowDown" || e.key === "ArrowRight"
          ? Math.min(n, at + step)
          : e.key === "ArrowUp" || e.key === "ArrowLeft"
            ? Math.max(1, at - step)
            : e.key === "Home"
              ? 1
              : e.key === "End"
                ? n
                : null;
      if (to === null) return;
      e.preventDefault();
      showAt(to);
      onJump(to);
    },
    [n, showAt, onJump],
  );

  if (n <= 3) return null;

  return (
    <div ref={railRef} className={styles.rail}>
      <div
        ref={sliderRef}
        className={styles.slider}
        role="slider"
        tabIndex={0}
        aria-label={t("rail.slider", { count: n })}
        aria-valuemin={1}
        aria-valuemax={n}
        aria-valuenow={1}
        aria-orientation="vertical"
        onPointerDown={onPointerDown}
        onPointerMove={(e) => !draggingRef.current && showAt(ayahAtY(e.clientY))}
        onPointerLeave={hide}
        onKeyDown={onKeyDown}
        onBlur={hide}
      />

      <div ref={trackRef} className={styles.track}>
        <span className={`${styles.cap} ${styles.capTop}`} />
        <span className={`${styles.cap} ${styles.capBottom}`} />

        {/* Alternate juz, washed the faintest gold. */}
        {bands.map((b) => (
          <span
            key={`${b.from}-${b.to}`}
            className={styles.band}
            style={{ top: `${pctOf(b.from)}%`, height: `${pctOf(b.to) - pctOf(b.from)}%` }}
          />
        ))}

        {/* The passage being looped, so it is seen as a stretch of the surah. */}
        {loop && (
          <span
            className={styles.loop}
            style={{
              top: `${pctOf(Math.min(loop.from, n))}%`,
              height: `${pctOf(Math.min(loop.to, n)) - pctOf(Math.min(loop.from, n))}%`,
            }}
          />
        )}

        {/* Every place a reciter is meant to break. */}
        {stops.map((ayah) => (
          <span key={ayah} className={styles.stop} style={{ top: `${pctOf(ayah)}%` }} />
        ))}

        {clusters.map((c) => {
          const one = c.items.length === 1 ? c.items[0] : null;
          const first = c.items[0];
          const last = c.items[c.items.length - 1];
          return (
            <button
              key={`${first.ayah}-${c.items.length}`}
              className={styles.mark}
              style={{ top: `${c.pct}%` }}
              onClick={() => onJump(first.ayah)}
              onPointerEnter={() => (one ? showAt(one.ayah) : showGroup(c))}
              onPointerLeave={hide}
              onFocus={() => (one ? showAt(one.ayah) : showGroup(c))}
              onBlur={hide}
              aria-label={
                one
                  ? t("rail.mark", { ayah: one.ayah, label: t(one.label) })
                  : first.ayah === last.ayah
                    ? // Several marks on one ayah — Āyat al-Kursī is also where
                      // a great many readers stop — so name the ayah once.
                      t("rail.mark", { ayah: first.ayah, label: c.items.map((m) => t(m.label)).join(" · ") })
                    : t("rail.marks", { count: c.items.length, from: first.ayah, to: last.ayah })
              }
            >
              {one?.kind === "sajda" && <span className={styles.sajda}>۩</span>}
              {one?.kind === "named" && <span className={styles.ring} />}
              {one?.kind === "stop" && <span className={styles.checkpoint} />}
              {!one && <span className={styles.group}>{c.items.length}</span>}
            </button>
          );
        })}

        {juz.map((j) => (
          <span key={`line-${j.n}`} className={styles.juzLine} style={{ top: `${pctOf(j.ayah)}%` }} />
        ))}
        {juz.map((j) => (
          <button
            key={`label-${j.n}`}
            className={styles.juzLabel}
            style={{ top: `${pctOf(j.ayah)}%` }}
            data-juz-pct={pctOf(j.ayah)}
            onClick={() => onJump(j.ayah)}
            onPointerEnter={() => showAt(j.ayah, t("rail.juzBegins", { n: j.n }))}
            onPointerLeave={hide}
            onFocus={() => showAt(j.ayah, t("rail.juzBegins", { n: j.n }))}
            onBlur={hide}
            aria-label={t("rail.juzBeginsAt", { n: j.n, ayah: j.ayah })}
          >
            {t("common.juzN", { n: j.n })}
          </button>
        ))}

        <div ref={fillRef} className={styles.fill} />
        <div ref={cursorRef} className={styles.cursor} />

        <div ref={markerRef} className={styles.marker}>
          <span className={styles.dot} />
          <span ref={readoutRef} className={styles.readout} />
        </div>

        <div ref={previewRef} className={styles.preview}>
          <div ref={previewKickerRef} className={styles.previewKicker} />
          <div ref={previewTextRef} dir="rtl" className={styles.previewText} />
          <div ref={previewNoteRef} className={styles.previewNote} />
        </div>
      </div>
    </div>
  );
}
