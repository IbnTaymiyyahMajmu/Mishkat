"use client";

import { useMemo, type ReactNode } from "react";
import structure from "@/content/structure.json";
import { TOTAL_WORDS, wordsIn, type Portion } from "@/lib/quran/khatm";
import { ENOUGH } from "@/lib/store/plan";
import styles from "./Plan.module.css";

/**
 * The Qurʾān as a circle, cut into the days of a plan.
 *
 * Round from the top, as a clock is read, with the length of each day's arc
 * its share of the words — so a long day looks long. The thirty juzʾ are the
 * ticks outside it. A day fills with gold as it is read, the day the reader is
 * on is lit, and a bead sits at the first ayah they have still to read: the
 * whole of a reading, and where in it they are, at a glance.
 */

const R = 84;
const TICK_IN = 95;
const TICK_OUT = 100;

/** Where an ayah's end falls on the circle, in degrees from the top. */
const at = (index: number) => (wordsIn(1, Math.max(0, index)) / TOTAL_WORDS) * 360;

function point(r: number, deg: number): string {
  const a = ((deg - 90) * Math.PI) / 180;
  return `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
}

function arc(r: number, a0: number, a1: number): string {
  if (a1 - a0 >= 359.99) {
    // A whole circle is two halves: an arc cannot end where it began.
    return `M ${point(r, 0)} A ${r} ${r} 0 1 1 ${point(r, 180)} A ${r} ${r} 0 1 1 ${point(r, 360)}`;
  }
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${point(r, a0)} A ${r} ${r} 0 ${large} 1 ${point(r, a1)}`;
}

export function KhatmRing({
  portions,
  read,
  today = -1,
  from = 1,
  bead = 0,
  done = false,
  label,
  children,
}: {
  portions: Portion[];
  /** How much of each portion is read, 0 to 1. */
  read?: number[];
  /** The portion to light. */
  today?: number;
  /** Where the reading began: before it is drawn as read already. */
  from?: number;
  /** The first ayah still to read. */
  bead?: number;
  /** The whole reading is read. */
  done?: boolean;
  label: string;
  children?: ReactNode;
}) {
  const arcs = useMemo(() => {
    const n = portions.length;
    // A hair between days while they can be told apart; past that the gaps
    // would be all there was to see.
    const gap = n <= 40 ? 0.9 : n <= 120 ? 0.3 : 0;
    return portions.map((p) => {
      const a0 = at(p.from - 1) + gap / 2;
      const a1 = Math.max(a0 + 0.05, at(p.to) - gap / 2);
      return { a0, a1, track: arc(R, a0, a1) };
    });
  }, [portions]);

  const ticks = useMemo(
    () =>
      structure.juz.map((start, i) => {
        const deg = at(start - 1);
        const long = i % 5 === 0;
        return `M ${point(long ? TICK_IN - 3 : TICK_IN, deg)} L ${point(TICK_OUT, deg)}`;
      }),
    [],
  );

  const beadDeg = bead > 0 ? at(bead - 1) : -1;

  return (
    <div className={`${styles.ring} ${done ? styles.ringDone : ""}`}>
      <svg viewBox="-110 -110 220 220" role="img" aria-label={label} className={styles.ringSvg}>
        <path d={ticks.join(" ")} className={styles.ringTicks} />
        <circle r={R} className={styles.ringGround} />
        {from > 1 && <path d={arc(R, 0, at(from - 1))} className={styles.ringBefore} />}
        {arcs.map((a, i) => {
          const r = read?.[i] ?? 0;
          const full = done || r >= ENOUGH;
          const lit = i === today;
          return (
            <g key={i}>
              <path d={a.track} className={`${styles.ringDay} ${lit ? styles.ringDayLit : ""}`} />
              {(full || r > 0) && (
                <path
                  d={full ? a.track : arc(R, a.a0, a.a0 + (a.a1 - a.a0) * r)}
                  className={styles.ringRead}
                />
              )}
            </g>
          );
        })}
        {beadDeg >= 0 && !done && (
          <g transform={`rotate(${beadDeg.toFixed(2)})`}>
            <circle cy={-R} r={7.5} className={styles.ringHalo} />
            <circle cy={-R} r={3.6} className={styles.ringBead} />
          </g>
        )}
      </svg>
      <div className={styles.ringCentre}>{children}</div>
    </div>
  );
}
