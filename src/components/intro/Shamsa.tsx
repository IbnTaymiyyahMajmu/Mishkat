"use client";

import { useMemo, type CSSProperties } from "react";
import type { Passage } from "@/lib/intros/types";
import styles from "./Shamsa.module.css";

/**
 * The medallion at the head of an introduction: the surah, seen whole.
 *
 * A manuscript of the Qur'an opens on a *shamsa* — a sunburst of gold — and
 * this is drawn in that tradition, but it is not only ornament. Everything on
 * its rim is the surah's own:
 *
 *   the ticks   one for the end of every ayah, set where that ayah ends when
 *               the surah is laid round the circle by its words — so a long
 *               ayah is a wide gap and a run of short ones is a comb;
 *   the band    the passages of the surah's map, each as long as it is;
 *   the marks   a diamond where a juz' of the muṣḥaf begins inside the surah,
 *               a ring where there is an ayah of prostration.
 *
 * It begins at the top and runs to the left, as the text does. A passage on
 * the band can be pointed at, and says what it is; chosen, it takes the reader
 * down the page to where that passage is set out.
 *
 * The rosette inside the band is the same for every surah. The band and the
 * rim never are, which is the point: no two surahs have the same face.
 */

const C = 300;
const R = {
  tickIn: 266,
  tickOut: 278,
  tickLong: 284,
  bandIn: 238,
  bandOut: 258,
  petalTip: 226,
  petalBase: 164,
  star: 152,
  disc: 96,
};

/** A point at radius `r`, `turn` of the way round — from the top, turning to the left. */
function at(r: number, turn: number): [number, number] {
  const a = -Math.PI / 2 - turn * 2 * Math.PI;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
}

const f = (n: number) => n.toFixed(2);
const pt = (r: number, turn: number) => at(r, turn).map(f).join(" ");

/** A stretch of the band, between two turns. */
function arc(from: number, to: number, inner: number, outer: number): string {
  const big = to - from > 0.5 ? 1 : 0;
  return (
    `M ${pt(outer, from)} A ${outer} ${outer} 0 ${big} 0 ${pt(outer, to)} ` +
    `L ${pt(inner, to)} A ${inner} ${inner} 0 ${big} 1 ${pt(inner, from)} Z`
  );
}

const PETALS = 16;

/** One lancet of the rosette, pointing outward at `turn`. */
function petal(turn: number): string {
  const half = 0.5 / PETALS;
  const mid = (R.petalBase + R.petalTip) / 2 + 8;
  return (
    `M ${pt(R.petalBase, turn - half)} ` +
    `Q ${pt(mid, turn - half * 0.92)} ${pt(R.petalTip, turn)} ` +
    `Q ${pt(mid, turn + half * 0.92)} ${pt(R.petalBase, turn + half)}`
  );
}

/** A square on the star's circle, turned by an eighth for the second of the pair. */
function square(offset: number): string {
  return [0, 1, 2, 3].map((k) => at(R.star, offset + k / 4).map(f).join(",")).join(" ");
}

interface Props {
  /** The surah's name in Arabic, set in the heart of it. */
  name: string;
  /** How many words each ayah has. */
  ayahWords: number[];
  /** The map of the surah. Empty where none is written: the rim is still the surah's own. */
  passages: Passage[];
  /** Ayat at which a juz' begins. */
  juz: number[];
  /** Ayat of prostration. */
  sajdah: number[];
  /** Which passage is picked out, or -1. */
  active: number;
  onActive: (index: number) => void;
  /** Says a passage aloud to a screen reader: "Ayat 9–26, The Companions of the Cave". */
  label: (passage: Passage) => string;
  /** What the whole figure is, for a reader who cannot see it. */
  title: string;
}

export function Shamsa({ name, ayahWords, passages, juz, sajdah, active, onActive, label, title }: Props) {
  const geometry = useMemo(() => {
    // Where each ayah ends, as a turn of the circle.
    const total = ayahWords.reduce((sum, n) => sum + n, 0) || 1;
    const ends: number[] = [];
    let run = 0;
    for (const n of ayahWords) {
      run += n;
      ends.push(run / total);
    }
    const startOf = (ayah: number) => (ayah <= 1 ? 0 : (ends[ayah - 2] ?? 0));
    const endOf = (ayah: number) => ends[ayah - 1] ?? 1;

    // A hair of space between passages, so the band reads as pieces.
    const gap = passages.length > 1 ? Math.min(0.0028, 0.2 / ayahWords.length) : 0;
    const count = ayahWords.length;
    const every = count > 160 ? 50 : count > 60 ? 10 : count > 24 ? 5 : 0;

    return {
      bands: passages.map((p) => arc(startOf(p.from) + gap, endOf(p.to) - gap, R.bandIn, R.bandOut)),
      ticks: ends.map((turn, i) => {
        const long = every > 0 && (i + 1) % every === 0;
        return `M ${pt(R.tickIn, turn)} L ${pt(long ? R.tickLong : R.tickOut, turn)}`;
      }),
      juz: juz.filter((a) => a > 1).map((a) => at(R.tickLong + 9, startOf(a))),
      sajdah: sajdah.map((a) => at(R.tickLong + 9, (startOf(a) + endOf(a)) / 2)),
      thin: count > 120,
    };
  }, [ayahWords, passages, juz, sajdah]);

  // The name is one word or three; the heart of the medallion is one size.
  const letters = name.replace(/[ً-ْٰ\s]/g, "").length;
  const size = letters <= 3 ? 76 : letters <= 5 ? 62 : letters <= 7 ? 52 : letters <= 9 ? 44 : 36;

  return (
    <svg viewBox="0 0 600 600" className={styles.shamsa} role="group" aria-label={title}>
      <defs>
        <linearGradient id="shamsa-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" className={styles.goldA} />
          <stop offset="0.5" className={styles.goldB} />
          <stop offset="1" className={styles.goldA} />
        </linearGradient>
        <radialGradient id="shamsa-glow">
          <stop offset="0" className={styles.glowIn} />
          <stop offset="1" className={styles.glowOut} />
        </radialGradient>
        {/* The flower's circles all pass through the centre, where the name
            is; they are kept to the ring between the star and the heart. */}
        <clipPath id="shamsa-between">
          <path
            clipRule="evenodd"
            d={
              `M ${C - R.star} ${C} a ${R.star} ${R.star} 0 1 0 ${2 * R.star} 0 a ${R.star} ${R.star} 0 1 0 ${-2 * R.star} 0 Z ` +
              `M ${C - R.disc} ${C} a ${R.disc} ${R.disc} 0 1 0 ${2 * R.disc} 0 a ${R.disc} ${R.disc} 0 1 0 ${-2 * R.disc} 0 Z`
            }
          />
        </clipPath>
      </defs>

      <circle cx={C} cy={C} r={300} fill="url(#shamsa-glow)" className={styles.halo} />

      {/* ── the rim: every ayah ─────────────────────────────────────────── */}
      <g className={`${styles.ticks} ${geometry.thin ? styles.ticksThin : ""}`} aria-hidden="true">
        {geometry.ticks.map((d, i) => (
          <path key={i} d={d} style={{ "--k": (i / geometry.ticks.length).toFixed(3) } as CSSProperties} />
        ))}
      </g>
      <g className={styles.marks} aria-hidden="true">
        {/* Where the surah begins. */}
        <path d={`M ${C} ${C - R.tickLong - 16} l 5 8 l -5 8 l -5 -8 Z`} className={styles.head} />
        {geometry.juz.map(([x, y], i) => (
          <path key={`j${i}`} d={`M ${f(x)} ${f(y - 5)} l 4 5 l -4 5 l -4 -5 Z`} className={styles.juz} />
        ))}
        {geometry.sajdah.map(([x, y], i) => (
          <circle key={`s${i}`} cx={f(x)} cy={f(y)} r={4} className={styles.sajdah} />
        ))}
      </g>

      {/* ── the band: the passages ──────────────────────────────────────── */}
      <circle cx={C} cy={C} r={R.bandOut + 3.5} className={styles.ring} pathLength={1} />
      <circle cx={C} cy={C} r={R.bandIn - 3.5} className={styles.ring} pathLength={1} />
      {geometry.bands.length > 0 ? (
        <g>
          {geometry.bands.map((d, i) => (
            <a
              key={i}
              href={`#passage-${passages[i].from}`}
              aria-label={label(passages[i])}
              className={`${styles.band} ${i % 2 ? styles.bandOdd : ""} ${active === i ? styles.bandOn : ""}`}
              style={{ animationDelay: `${Math.min(900, 380 + i * 55)}ms` }}
              onMouseEnter={() => onActive(i)}
              onFocus={() => onActive(i)}
              onClick={(event) => {
                // On a screen with no pointer to hover with, the first touch
                // says what the passage is and the second goes to it.
                if (active !== i) {
                  event.preventDefault();
                  onActive(i);
                }
              }}
            >
              <path d={d} />
            </a>
          ))}
        </g>
      ) : (
        <circle cx={C} cy={C} r={(R.bandIn + R.bandOut) / 2} className={styles.bandBlank} />
      )}

      {/* A light that goes once round the band, the way the surah is read. */}
      <circle cx={C} cy={C} r={(R.bandIn + R.bandOut) / 2} className={styles.comet} pathLength={1} aria-hidden="true" />

      {/* ── the rosette ─────────────────────────────────────────────────── */}
      <g className={styles.rosette} aria-hidden="true">
        <g className={styles.petals}>
          {Array.from({ length: PETALS }, (_, i) => (
            <path key={i} d={petal(i / PETALS)} />
          ))}
        </g>
        <circle cx={C} cy={C} r={R.petalBase - 4} className={styles.ring} pathLength={1} />
        <g className={styles.star}>
          <polygon points={square(0)} />
          <polygon points={square(1 / 8)} />
        </g>
        <g className={styles.flower} clipPath="url(#shamsa-between)">
          {Array.from({ length: 8 }, (_, i) => {
            const [x, y] = at(R.star / 2, i / 8 + 1 / 16);
            return <circle key={i} cx={f(x)} cy={f(y)} r={R.star / 2} />;
          })}
        </g>
      </g>

      {/* ── the heart: the name ─────────────────────────────────────────── */}
      <circle cx={C} cy={C} r={R.disc} className={styles.disc} />
      <circle cx={C} cy={C} r={R.disc} className={styles.ring} pathLength={1} />
      <circle cx={C} cy={C} r={R.disc - 7} className={styles.ringFine} />
      <text
        x={C}
        y={C}
        className={styles.name}
        fill="url(#shamsa-gold)"
        style={{ fontSize: size }}
        textAnchor="middle"
        dominantBaseline="central"
        direction="rtl"
        lang="ar"
        aria-hidden="true"
      >
        {name}
      </text>
    </svg>
  );
}
