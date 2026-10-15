"use client";

import { useId, useMemo } from "react";
import { ENOUGH } from "@/lib/store/plan";
import type { Light } from "@/lib/store/light";
import styles from "./Niche.module.css";

/**
 * The reader's niche, drawn.
 *
 * A niche under a pointed arch, its back laid with a pattern of eight-pointed
 * stars, and a lamp hanging in it. Each day the reader has read lights one
 * tile of the pattern, nearest the lamp first, so the light is seen to spread
 * out from the lamp into the niche as the days go by; once every tile is lit,
 * each further day brightens them again from the lamp outwards. Round the
 * lamp's glass, thirty medallions, one to a juzʾ, gild as each is read
 * through. Every time all thirty shine, another lamp hangs in the niche.
 *
 * The flame is the one thing that answers to today: full when the reader has
 * read today, lower each day they have not, an ember after a week — and
 * nothing that was lit is ever put out.
 */

const W = 420;
const H = 520;
/** The niche's opening: its sides, the line its arch springs from, its floor. */
const L = 70;
const R = 350;
const SPRING = 230;
const FLOOR = 496;
/** The arch is two-centred: each half an arc of this radius about a point on the springing line. */
const RHO = 200;
const CX = (L + R) / 2;
const APEX = SPRING - Math.sqrt(RHO * RHO - (CX - (L + RHO)) ** 2);
/** The lamp's glass. */
const LAMP = { x: CX, y: 205 };
const ROSETTE = 57;
/** The tiles: one eight-pointed star at each point of a grid this far apart, a small four-pointed one between. */
const STEP = 24;

const insideArch = (x: number, y: number, m: number) => {
  if (y > FLOOR - m) return false;
  if (y >= SPRING) return x >= L + m && x <= R - m;
  return Math.hypot(x - (L + RHO), y - SPRING) <= RHO - m && Math.hypot(x - (R - RHO), y - SPRING) <= RHO - m;
};

function archPath(grow: number): string {
  const l = L - grow;
  const r = R + grow;
  const rho = RHO + grow;
  const apex = SPRING - Math.sqrt(rho * rho - (CX - (L + RHO)) ** 2);
  return `M${l} ${FLOOR + grow}L${l} ${SPRING}A${rho} ${rho} 0 0 1 ${CX} ${apex.toFixed(1)}A${rho} ${rho} 0 0 1 ${r} ${SPRING}L${r} ${FLOOR + grow}Z`;
}

/** An n-pointed star about a point, as a path. */
function star(x: number, y: number, points: number, outer: number, inner: number, turn = 0): string {
  const out: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = ((i * 180) / points + turn - 90) * (Math.PI / 180);
    out.push(`${(x + r * Math.cos(a)).toFixed(1)} ${(y + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${out.join("L")}Z`;
}

interface Tile {
  d: string;
  big: boolean;
}

/** Every tile of the pattern, in the order the light reaches them: out from the lamp. */
const TILES: Tile[] = (() => {
  const found: (Tile & { dist: number })[] = [];
  const add = (x: number, y: number, big: boolean) => {
    const reach = big ? STEP * 0.44 : STEP * 0.26;
    if (!insideArch(x, y, reach + 3)) return;
    const dist = Math.hypot(x - LAMP.x, y - LAMP.y);
    if (dist < ROSETTE + 16) return; // under the lamp's own light
    // A little unevenness, the same every time, so the light spreads as light
    // does and not as a ring drawn with compasses.
    const jitter = (((x * 73856093) ^ (y * 19349663)) >>> 0) % 1000;
    found.push({
      d: big ? star(x, y, 8, STEP * 0.44, STEP * 0.25, 22.5) : star(x, y, 4, STEP * 0.26, STEP * 0.1, 45),
      big,
      dist: dist + jitter / 120,
    });
  };
  for (let j = -1; j < 20; j++) {
    for (let k = -7; k <= 7; k++) {
      add(CX + k * STEP, 46 + j * STEP, true);
      add(CX + (k + 0.5) * STEP, 46 + (j + 0.5) * STEP, false);
    }
  }
  return found.sort((a, b) => a.dist - b.dist).map(({ d, big }) => ({ d, big }));
})();

/** How many days the niche holds before it begins to brighten instead. */
export const TILE_COUNT = TILES.length;

/** Where lamps are hung, one for each time the Qurʾān was read through. */
const HUNG = [
  [122, 182],
  [298, 182],
  [102, 270],
  [318, 270],
  [140, 352],
  [280, 352],
] as const;

/** The top of the niche above a point: where a hung lamp's chain is fixed. */
function archTop(x: number): number {
  const c = x <= CX ? L + RHO : R - RHO;
  return SPRING - Math.sqrt(Math.max(0, RHO * RHO - (x - c) ** 2));
}

/** A mosque lamp, about its glass, at a scale. */
function lampPath(x: number, y: number, k: number): string {
  const p = (dx: number, dy: number) => `${(x + dx * k).toFixed(1)} ${(y + dy * k).toFixed(1)}`;
  return `M${p(-19, -36)}L${p(19, -36)}Q${p(12, -24)} ${p(11, -12)}C${p(30, -6)} ${p(32, 16)} ${p(14, 24)}L${p(9, 31)}L${p(-9, 31)}L${p(-14, 24)}C${p(-32, 16)} ${p(-30, -6)} ${p(-11, -12)}Q${p(-12, -24)} ${p(-19, -36)}Z`;
}

function flamePath(x: number, y: number, size: number): string {
  const h = 15 * size;
  const w = 6 * size;
  return `M${x} ${y - h}C${x + w} ${y - h * 0.45} ${x + w * 0.9} ${y + 1} ${x} ${y + 3}C${x - w * 0.9} ${y + 1} ${x - w} ${y - h * 0.45} ${x} ${y - h}Z`;
}

function arc(r: number, a0: number, a1: number): string {
  const pt = (a: number) => {
    const t = ((a - 90) * Math.PI) / 180;
    return `${(LAMP.x + r * Math.cos(t)).toFixed(2)} ${(LAMP.y + r * Math.sin(t)).toFixed(2)}`;
  };
  return `M${pt(a0)}A${r} ${r} 0 0 1 ${pt(a1)}`;
}

/** How much was read on a day, as one of four strengths of light. */
function strength(count: number): number {
  if (count < 10) return 1;
  if (count < 50) return 2;
  if (count < 150) return 3;
  return 4;
}

export function NicheScene({
  light,
  fresh = 0,
  label,
  dayTitle,
  juzTitle,
}: {
  light: Light;
  /** Days new since the reader last looked: their tiles kindle as the page opens. */
  fresh?: number;
  label: string;
  dayTitle?: (day: string) => string;
  juzTitle?: (juz: number) => string;
}) {
  const lit = Math.min(light.lit, TILE_COUNT);
  /** Past a full niche, how many tiles have been brightened again. */
  const again = Math.max(0, Math.min(light.lit - TILE_COUNT, TILE_COUNT));
  const firstFresh = lit - Math.min(fresh, lit);

  // The flame answers to today; the glow round it, to the run of days.
  const flame =
    light.since < 0 ? 0 : light.since === 0 ? 1 : light.since === 1 ? 0.82 : light.since <= 6 ? 0.55 : 0.32;
  const glow = flame ? 64 + flame * 50 + Math.min(light.run, 40) * 1.4 : 0;

  const uid = useId().replace(/:/g, "");
  const id = (name: string) => `${name}-${uid}`;

  const petals = useMemo(
    () => Array.from({ length: 30 }, (_, j) => ({ j, a0: j * 12 + 1.2, a1: (j + 1) * 12 - 1.2 })),
    [],
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className={styles.scene}>
      <defs>
        <radialGradient id={id("niche-glow")}>
          <stop offset="0" stopColor="#fff1c8" stopOpacity="0.9" />
          <stop offset="0.3" stopColor="#f3c86e" stopOpacity="0.38" />
          <stop offset="1" stopColor="#f3c86e" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("niche-glass")} cx="0.45" cy="0.42">
          <stop offset="0" stopColor="#fff6dc" stopOpacity={flame ? 0.95 : 0.22} />
          <stop offset="1" stopColor="#d9ab5c" stopOpacity={flame ? 0.4 : 0.08} />
        </radialGradient>
        <radialGradient id={id("niche-wash")} cx={LAMP.x / W} cy={LAMP.y / H} r="0.75">
          <stop offset="0" stopColor="#f6d58c" stopOpacity={0.05 + Math.min(1, light.lit / 120) * 0.22} />
          <stop offset="1" stopColor="#f6d58c" stopOpacity="0" />
        </radialGradient>
        <clipPath id={id("niche-recess")}>
          <path d={archPath(0)} />
        </clipPath>
      </defs>

      {/* The niche: its frame, and the recess within it. */}
      <path d={archPath(16)} className={styles.frame} />
      <path d={archPath(8)} className={styles.frameLine} />
      <path d={archPath(0)} className={styles.recess} />

      <g clipPath={`url(#${id("niche-recess")})`}>
        <rect x={L} y={0} width={R - L} height={H} fill={`url(#${id("niche-wash")})`} />
        {TILES.map((tile, k) => {
          if (k >= lit) return <path key={k} d={tile.d} className={styles.tileDark} />;
          const day = light.days[k];
          const level = strength(light.perDay.get(day) ?? 0);
          const isToday = light.since === 0 && k === lit - 1;
          return (
            <path
              key={k}
              d={tile.d}
              className={[
                styles.tile,
                styles[`tile${level}`],
                k < again && styles.tileAgain,
                isToday && styles.tileToday,
                k >= firstFresh && styles.kindle,
              ]
                .filter(Boolean)
                .join(" ")}
              style={k >= firstFresh ? { animationDelay: `${300 + (k - firstFresh) * 110}ms` } : undefined}
            >
              {dayTitle && <title>{dayTitle(day)}</title>}
            </path>
          );
        })}
      </g>

      {/* The lamps hung for each reading finished: light upon light. */}
      {HUNG.slice(0, light.lamps).map(([x, y], i) => (
        <g key={i} className={styles.hung}>
          <line x1={x} y1={archTop(x) + 6} x2={x} y2={y - 16} className={styles.chain} />
          {/* A clearing in the pattern, so a lamp hung in a niche already full of light is still seen. */}
          <circle cx={x} cy={y} r={21} className={styles.hungBack} />
          <circle cx={x} cy={y} r={30} fill={`url(#${id("niche-glow")})`} className={styles.glow} />
          <path d={lampPath(x, y, 0.42)} fill={`url(#${id("niche-glass")})`} className={styles.lamp} />
          <path d={flamePath(x, y + 1, 0.45)} className={styles.flame} />
        </g>
      ))}

      {/* The lamp. */}
      {glow > 0 && <circle cx={LAMP.x} cy={LAMP.y} r={glow} fill={`url(#${id("niche-glow")})`} className={styles.glow} />}
      <line x1={CX} y1={APEX + 4} x2={CX} y2={128} className={styles.chain} />
      <path d={`M${CX} 128L${CX - 19} 169M${CX} 128L${CX} 169M${CX} 128L${CX + 19} 169`} className={styles.chain} />

      {/* Round the glass, a medallion for every juzʾ. */}
      {petals.map(({ j, a0, a1 }) => {
        const read = light.juz[j];
        const done = read >= ENOUGH;
        return (
          <g key={j}>
            <path d={arc(ROSETTE, a0, a1)} className={styles.petal} />
            {read > 0.02 && (
              <path d={arc(ROSETTE, a0, done ? a1 : a0 + (a1 - a0) * read)} className={done ? styles.petalDone : styles.petalPart} />
            )}
            {juzTitle && (
              <path d={arc(ROSETTE, a0, a1)} className={styles.petalHit}>
                <title>{juzTitle(j + 1)}</title>
              </path>
            )}
          </g>
        );
      })}

      <path d={lampPath(LAMP.x, LAMP.y, 1)} fill={`url(#${id("niche-glass")})`} className={`${styles.lamp} ${flame ? "" : styles.lampDark}`} />
      <path d={`M${LAMP.x - 16} ${LAMP.y - 30}H${LAMP.x + 16}`} className={styles.enamel} />
      <path d={`M${LAMP.x - 24} ${LAMP.y + 8}Q${LAMP.x} ${LAMP.y + 16} ${LAMP.x + 24} ${LAMP.y + 8}`} className={styles.enamel} />
      {flame > 0 && <path d={flamePath(LAMP.x, LAMP.y + 4, flame)} className={styles.flame} />}
    </svg>
  );
}
