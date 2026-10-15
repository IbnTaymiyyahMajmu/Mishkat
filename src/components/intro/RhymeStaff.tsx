"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties, type PointerEvent } from "react";
import type { Passage } from "@/lib/intros/types";
import { useLocale } from "@/lib/i18n";
import styles from "./RhymeStaff.module.css";

/**
 * The rhyme of a surah, drawn as a staff.
 *
 * Every ayah closes on a sound — its fāṣilah — and the sounds answer each
 * other for a stretch, then turn. Each closing sound the surah uses is a line
 * of the staff, and the surah is a line drawn along them, one step to an ayah:
 * a run of the same rhyme is a level stretch, and a turn of rhyme is the line
 * stepping to another. The passages the page divides the surah into are drawn
 * across it, so that whether the turns fall where the passages do is
 * something a reader sees rather than is told.
 *
 * Identity is position, not colour. Any two rhymes may sit side by side, so a
 * colour for each would ask the eye to tell six hues apart; a line of its own
 * for each, labelled with the sound in Arabic, asks it for nothing.
 *
 * The endings are computed from the text by `scripts/build-rhyme.mjs` — each
 * as it is said when the reciter stops on it — and handed in as
 * `family|ending`, one to an ayah.
 */

interface Props {
  surah: number;
  /** One to an ayah: `family|ending`, e.g. `īn|ون`. */
  codes: string[];
  passages: Passage[];
  /** The passage picked out elsewhere on the page, or -1. */
  active: number;
  onActive: (index: number) => void;
}

interface Lane {
  family: string;
  /** The endings heard on this line, commonest first. */
  endings: string[];
  count: number;
}

/** More lines than this and the rarest closes share the last one. */
const MOST_LANES = 6;
const LANE_HEIGHT = 30;
/** How wide one ayah is drawn, in the staff's own units. */
const UNIT = 12;
const OTHER = "*";
/** Past this many ayat a tick for each would be a comb; the line alone says it. */
const TICKS_UP_TO = 80;

/** Runs of the same value, as [from, to] counted from 1. */
function runsOf(values: string[]): { from: number; to: number; said: string }[] {
  const out: { from: number; to: number; said: string }[] = [];
  values.forEach((said, i) => {
    const last = out[out.length - 1];
    if (last && last.said === said) last.to = i + 1;
    else out.push({ from: i + 1, to: i + 1, said });
  });
  return out;
}

export function RhymeStaff({ surah, codes, passages, active, onActive }: Props) {
  const { t, n } = useLocale();
  const [peek, setPeek] = useState(0);

  const staff = useMemo(() => {
    const endings = codes.map((code) => {
      const [family, said] = code.split("|");
      return { family, said: said ?? "" };
    });

    const byFamily = new Map<string, Map<string, number>>();
    for (const { family, said } of endings) {
      const saids = byFamily.get(family) ?? new Map<string, number>();
      saids.set(said, (saids.get(said) ?? 0) + 1);
      byFamily.set(family, saids);
    }
    const total = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
    const families = [...byFamily].sort((a, b) => total(b[1]) - total(a[1]));

    const kept = families.length > MOST_LANES ? families.slice(0, MOST_LANES - 1) : families;
    const lanes: Lane[] = kept.map(([family, saids]) => ({
      family,
      endings: [...saids].sort((a, b) => b[1] - a[1]).map(([said]) => said),
      count: total(saids),
    }));
    if (families.length > MOST_LANES) {
      const rest = families.slice(MOST_LANES - 1);
      lanes.push({
        family: OTHER,
        endings: rest.map(([, saids]) => [...saids].sort((a, b) => b[1] - a[1])[0][0]),
        count: rest.reduce((sum, [, saids]) => sum + total(saids), 0),
      });
    }
    const laneOf = new Map(lanes.map((lane, i) => [lane.family, i]));
    const lane = endings.map(({ family }) => laneOf.get(family) ?? lanes.length - 1);

    // A turn is an ayah that closes on another sound than the one before it.
    const turns: number[] = [];
    for (let a = 1; a < endings.length; a++) if (endings[a].family !== endings[a - 1].family) turns.push(a + 1);
    const starts = new Set(passages.map((p) => p.from));
    const atPassage = turns.filter((ayah) => starts.has(ayah)).length;

    // Runs of one sound, for the list under the staff and for its description.
    const runs: { from: number; to: number; said: string }[] = [];
    endings.forEach(({ family, said }, i) => {
      const last = runs[runs.length - 1];
      if (last && endings[last.to - 1].family === family) last.to = i + 1;
      else runs.push({ from: i + 1, to: i + 1, said });
    });

    // Within one line, the ending can still change audibly: Maryam stays on a
    // long ā from its second ayah to its last, but on ـيا for the first half
    // and ـدا for the second. Where a run of one exact ending holds for a
    // while, and its line carries more than one such run, the ending is
    // written above the line where the run begins.
    const least = Math.max(3, Math.round(endings.length * 0.03));
    const sustained = runsOf(endings.map((e) => e.said)).filter((r) => r.to - r.from + 1 >= least);
    const marks: { from: number; lane: number; said: string }[] = [];
    lanes.forEach((_, l) => {
      const own = sustained.filter((r) => lane[r.from - 1] === l);
      if (new Set(own.map((r) => r.said)).size < 2) return;
      for (const r of own) {
        const before = marks.filter((m) => m.lane === l).pop();
        if (before?.said !== r.said) marks.push({ from: r.from, lane: l, said: r.said });
      }
    });

    return { endings, lanes, lane, turns, atPassage, runs, marks, top: lanes[0] };
  }, [codes, passages]);

  const count = codes.length;
  const width = count * UNIT;
  const height = staff.lanes.length * LANE_HEIGHT;
  const x = (ayah: number) => (ayah - 0.5) * UNIT;
  const y = (lane: number) => (lane + 0.5) * LANE_HEIGHT;

  // The line, a level stretch for each run and a step at each turn.
  const melody = useMemo(() => {
    let d = `M0 ${y(staff.lane[0])} H${x(1)}`;
    for (let a = 2; a <= count; a++) {
      const from = staff.lane[a - 2];
      const to = staff.lane[a - 1];
      if (to !== from) d += ` H${(a - 1) * UNIT} V${y(to)}`;
      d += ` H${x(a)}`;
    }
    return `${d} H${width}`;
  }, [staff, count, width]);

  const passageOf = (ayah: number) => passages.findIndex((p) => ayah >= p.from && ayah <= p.to);

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const fraction = rtl ? (box.right - e.clientX) / box.width : (e.clientX - box.left) / box.width;
    const ayah = Math.min(count, Math.max(1, Math.ceil(fraction * count)));
    setPeek(ayah);
    const p = passageOf(ayah);
    if (p >= 0 && p !== active) onActive(p);
  };

  const ending = (said: string) => `ـ${said}`;
  const shown = peek ? staff.endings[peek - 1] : null;
  const peekPassage = peek ? passageOf(peek) : -1;
  const share = Math.round((staff.top.count / count) * 100);
  const single = staff.lanes.length === 1;

  const summary = single
    ? t("intro.rhyme.one", { count })
    : t("intro.rhyme.summary", { percent: share, count: staff.turns.length });

  return (
    <div className={styles.staff} data-reveal="rhyme">
      <p className={styles.summary}>
        {summary}
        {!single && passages.length > 1 && (
          <>
            {" "}
            {staff.atPassage
              ? t("intro.rhyme.passages", { count: staff.atPassage })
              : t("intro.rhyme.passagesNone")}
          </>
        )}
      </p>

      <div className={styles.score} style={{ "--lanes": staff.lanes.length } as CSSProperties}>
        <ul className={styles.labels} aria-hidden="true">
          {staff.lanes.map((lane, i) => (
            <li
              key={lane.family}
              className={`${styles.label} ${shown && staff.lane[peek - 1] === i ? styles.labelOn : ""}`}
              style={{ height: LANE_HEIGHT }}
            >
              <span lang="ar" dir="rtl" className={styles.labelArabic}>
                {lane.family === OTHER ? "…" : lane.endings.slice(0, 3).map(ending).join(" ")}
              </span>
              <span className={styles.labelCount}>{n(lane.count)}</span>
            </li>
          ))}
        </ul>

        <div className={styles.plotWrap}>
        <svg
          className={styles.plot}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          style={{ height }}
          role="img"
          aria-label={`${t("intro.rhyme.label")} ${summary}`}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setPeek(0)}
        >
          {staff.lanes.map((lane, i) => (
            <line key={lane.family} className={styles.rule} x1={0} x2={width} y1={y(i)} y2={y(i)} vectorEffect="non-scaling-stroke" />
          ))}

          {passages.map((p, i) => (
            <g key={p.from}>
              {active === i && (
                <rect className={styles.band} x={(p.from - 1) * UNIT} width={(p.to - p.from + 1) * UNIT} y={0} height={height} />
              )}
              {p.from > 1 && (
                <line
                  className={styles.boundary}
                  x1={(p.from - 1) * UNIT}
                  x2={(p.from - 1) * UNIT}
                  y1={0}
                  y2={height}
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </g>
          ))}

          <path className={styles.melody} d={melody} vectorEffect="non-scaling-stroke" />

          {count <= TICKS_UP_TO &&
            staff.lane.map((l, i) => (
              <line
                key={i}
                className={styles.tick}
                x1={x(i + 1)}
                x2={x(i + 1)}
                y1={y(l) - 6}
                y2={y(l) + 6}
                vectorEffect="non-scaling-stroke"
              />
            ))}

          {peek > 0 && (
            <>
              <line className={styles.cursor} x1={x(peek)} x2={x(peek)} y1={0} y2={height} vectorEffect="non-scaling-stroke" />
              <line
                className={styles.cursorMark}
                x1={x(peek)}
                x2={x(peek)}
                y1={y(staff.lane[peek - 1]) - 9}
                y2={y(staff.lane[peek - 1]) + 9}
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
        </svg>
        <div className={styles.marks} aria-hidden="true">
          {staff.marks.map((m) => (
            // Placed in the page's direction, and written in Arabic's: a
            // direction on the placed element would turn which side its
            // offset is measured from.
            <span
              key={`${m.lane}-${m.from}`}
              className={styles.mark}
              style={{ insetInlineStart: `${((m.from - 1) / count) * 100}%`, top: m.lane * LANE_HEIGHT }}
            >
              <span lang="ar" dir="rtl">
                {ending(m.said)}
              </span>
            </span>
          ))}
        </div>
        </div>

        <div className={styles.ends} aria-hidden="true">
          <span>{t("common.ayahN", { n: 1 })}</span>
          <span>{t("common.ayahN", { n: count })}</span>
        </div>
      </div>

      <p className={styles.readout} aria-live="polite">
        {shown ? (
          <>
            <span className={styles.readoutAyah}>{t("common.ayahN", { n: peek })}</span>
            <span>
              {t("intro.rhyme.closes")}{" "}
              <span lang="ar" dir="rtl" className={styles.readoutArabic}>
                {ending(shown.said)}
              </span>
            </span>
            {peekPassage >= 0 && (
              <span lang="en" dir="ltr" className={styles.readoutPassage}>
                {passages[peekPassage].title}
              </span>
            )}
            <Link href={`/read/${surah}/#${surah}:${peek}`} className={styles.readoutGo}>
              {t("intro.rhyme.read", { n: peek })}
            </Link>
          </>
        ) : (
          <span className={styles.readoutHint}>{t("intro.rhyme.hint")}</span>
        )}
      </p>

      {!single && (
        <details className={styles.runs}>
          <summary>{t("intro.rhyme.runs", { count: staff.runs.length })}</summary>
          <ol>
            {staff.runs.map((run) => (
              <li key={run.from}>
                <Link href={`/read/${surah}/#${surah}:${run.from}`} className={styles.runRange}>
                  {run.from === run.to ? n(run.from) : `${n(run.from)}–${n(run.to)}`}
                </Link>
                <span lang="ar" dir="rtl" className={styles.runArabic}>
                  {ending(run.said)}
                </span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
