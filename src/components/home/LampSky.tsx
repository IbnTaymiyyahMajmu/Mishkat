"use client";

import { useSettings } from "@/lib/store/settings";
import styles from "./LampSky.module.css";

/**
 * The sky the landing page is read against — one for each reading light.
 *
 * Evening is مِشْكَاةٍ itself: the niche that holds the lamp, its halo, the
 * shaft it throws down the page and the embers it sends up. Day replaces the
 * lamp with a sun and its shafts, and the embers with the dust they light.
 * Night keeps the niche and cools it to starlight.
 *
 * All three skies stay mounted and cross-fade on `--mk-scene-*`, so the sky is
 * right in the first painted frame rather than after hydration, and changing
 * the light is a dissolve rather than a cut. Only the lit sky's motes are
 * rendered, though: an ember animating at zero opacity still costs a composite
 * every frame, and there can be a hundred of them.
 *
 * Purely decorative and entirely CSS: no canvas, no animation frame, nothing
 * for React to re-render once the light is chosen. The whole thing is inert to
 * the reader and to the screen reader alike, and the global reduced-motion rule
 * stills it.
 */

/** `[left%, diameter, alpha, glowBlur (0 for none), path, seconds, delay]` */
type Mote = [number, number, number, number, "A" | "B" | "C", number, number];

/**
 * A mote field, spread evenly across the width and then jittered, so it reads
 * as scattered without ever leaving a bare stretch. Deterministic, so the
 * server and the browser draw the same sky.
 */
function motes(count: number, slow: number, fast: number, seed: number): Mote[] {
  const paths: Mote[4][] = ["A", "B", "C"];
  let n = seed;
  const rand = () => {
    n = (n * 1664525 + 1013904223) % 4294967296;
    return n / 4294967296;
  };
  return Array.from({ length: count }, (_, i) => {
    const lane = ((i + 0.5) / count) * 100;
    return [
      round(Math.min(97, Math.max(2, lane + (rand() - 0.5) * (80 / count)))),
      round(2.6 + rand() * 0.9),
      round(0.47 + rand() * 0.35),
      rand() < 0.5 ? 8 + Math.round(rand() * 2) : 0,
      paths[i % 3],
      round(slow + rand() * (fast - slow)),
      round(rand() * 40),
    ];
  });
}

interface Star {
  /** Where it sits, in per cent of the sky. */
  left: number;
  top: number;
  /** The core, in pixels, and how bright it is before anything moves. */
  size: number;
  alpha: number;
  /** Blue-white, plain white, or the warm cast of a cooler star. */
  tint: 0 | 1 | 2;
  /** How bright this one is relative to the field — drives the glare around it. */
  mag: number;
  /** The slow swell: its period, its phase, and the floor it breathes down to. */
  slow: number;
  slowFrom: number;
  swell: number;
  /** The fast flicker: which of the three shapes, its period, its phase, its floor. */
  pattern: 1 | 2 | 3;
  fast: number;
  fastFrom: number;
  floor: number;
  /** Bright stars break into colour as well as brightness; most do not. */
  chroma: number;
  chromaFrom: number;
}

/** Blue-white, white, warm — roughly what the eye picks out of a clear sky. */
const TINTS = ["214,230,255", "246,249,255", "255,224,180"] as const;

/**
 * Where the stars are, and how each one scintillates.
 *
 * Real starlight does not switch on and off. What the eye sees is scintillation:
 * the column of air above the observer bending the light a little differently
 * from one moment to the next, so a star wavers around its own brightness
 * without ever leaving. Four things follow from that, and each is built in here:
 *
 * — Nothing is extinguished. Every star has a floor it never dims past, so the
 *   field shimmers instead of blinking.
 * — The wavering does not repeat. Each star carries a fast flicker and a slow
 *   swell on unrelated periods; because the two sit on nested elements their
 *   opacities multiply, and the product only comes back around after minutes.
 * — It is not uniform. There is more air to look through near the horizon, so
 *   stars low in the sky waver hardest and ones overhead barely move. A planet
 *   does not scintillate at all, and about one star in six here is that steady.
 * — Brightness is not uniform either. Faint stars vastly outnumber bright ones,
 *   and only the bright ones carry visible glare or break into colour.
 *
 * Placement is random rather than spread down even lanes: an even spread reads
 * as a row of dots, where a real field clumps and leaves gaps. Stars close to
 * the niche are dropped rather than drawn, because a light that near washes
 * them out — which opens a clearing around the lamp for free. Deterministic, so
 * the server and the browser draw the same sky.
 */
function stars(count: number, seed: number): Star[] {
  let n = seed;
  const rand = () => {
    n = (n * 1664525 + 1013904223) % 4294967296;
    return n / 4294967296;
  };

  const out: Star[] = [];
  for (let tries = 0; out.length < count && tries < count * 60; tries++) {
    const left = round(1 + rand() * 98);
    const top = round(1 + Math.pow(rand(), 1.4) * 42);

    // Two stars landing on the same spot read as one fat blob rather than as a
    // pair, so the second is redrawn. The threshold is loose enough that the
    // clumping and the bare stretches — the things that make it a sky — survive.
    if (out.some((s) => Math.abs(s.left - left) < 1.5 && Math.abs(s.top - top) < 2.6)) continue;

    // How far this is from the lamp burning just off the top edge, and so how
    // much of it survives being that close to a light.
    const dx = (left - 50) / 50;
    const dy = top / 44;
    const seen = Math.min(1, Math.max(0, (Math.sqrt(dx * dx * 0.7 + dy * dy) - 0.16) / 0.6));

    const mag = Math.pow(rand(), 2.4);
    const alpha = round((0.28 + mag * 0.56) * seen);
    if (alpha < 0.09) continue; // washed out by the niche; not worth an element

    // Thicker air toward the horizon, plus a share of stars that simply sit
    // still. A steady star also breathes more slowly than a wavering one.
    const calm = rand() < 0.17;
    const swim = 0.34 + (top / 44) * 0.44 + rand() * 0.3;
    const fast = calm ? round(5.6 + rand() * 4.2) : round(1.8 + rand() * 2.7);

    out.push({
      left,
      top,
      size: round(0.9 + mag * 2.4),
      alpha,
      tint: rand() < 0.17 ? 2 : rand() < 0.55 ? 0 : 1,
      mag: round(mag),
      slow: round(7 + rand() * 10),
      slowFrom: 0,
      swell: round(0.8 + rand() * 0.14),
      pattern: (1 + Math.floor(rand() * 3)) as 1 | 2 | 3,
      fast,
      fastFrom: 0,
      floor: calm ? round(0.93 - rand() * 0.05) : round(0.9 - Math.min(0.4, swim * 0.36)),
      chroma: mag > 0.66 && rand() < 0.7 ? round(3.1 + rand() * 3.6) : 0,
      chromaFrom: 0,
    });
  }

  // Every cycle starts part-way through. Without this the whole field waits out
  // its delay at full brightness and then sets off together, which is the one
  // thing a sky never does.
  for (const s of out) {
    s.slowFrom = round(-rand() * s.slow);
    s.fastFrom = round(-rand() * s.fast);
    s.chromaFrom = round(-rand() * s.chroma);
  }
  return out;
}

/**
 * Glare, not the star. A faint star is a bare point; only a bright one spills
 * far enough past itself to show a halo, so both the reach and the strength of
 * this climb steeply with magnitude.
 */
function starGlow(s: Star): string {
  const reach = (s.size * 2.4 + s.mag * 7).toFixed(1);
  const spread = (0.4 + s.mag * 1.7).toFixed(1);
  return `0 0 ${reach}px ${spread}px rgba(${TINTS[s.tint]},${(0.08 + s.mag * 0.3).toFixed(2)})`;
}

/**
 * The counter-tint that rides on top of a bright star. Scintillation splits
 * colour as well as brightness — the air disperses it — so as this fades in and
 * out the star reads as drifting between cool and warm rather than merely
 * dimming. Only the brightest carry one; on the rest there would be nothing
 * bright enough to disperse.
 */
function chromaGlow(s: Star): string {
  const rgb = s.tint === 2 ? TINTS[0] : TINTS[2];
  return `0 0 ${(s.size * 3 + s.mag * 8).toFixed(1)}px ${(0.6 + s.mag * 1.4).toFixed(1)}px rgba(${rgb},${(s.mag * 0.34).toFixed(2)})`;
}

const round = (n: number) => Math.round(n * 10) / 10;

const EVENING_EMBERS = motes(28, 24, 43, 20250814);
const DAY_MOTES = motes(26, 14, 24, 970411);
const NIGHT_EMBERS = motes(26, 16, 27, 616131);
const NIGHT_STARS = stars(62, 114255);

/** The glow around a mote is proportional to how bright the mote is. */
function glow(blur: number, alpha: number, rgb: string): string | undefined {
  if (!blur) return undefined;
  return `0 0 ${blur}px 2px rgba(${rgb},${(alpha * 0.41).toFixed(2)})`;
}

function MoteField({ field, rgb, glowRgb }: { field: Mote[]; rgb: string; glowRgb: string }) {
  return (
    <div className={styles.motes}>
      {field.map(([left, size, alpha, blur, path, seconds, delay], i) => (
        <span
          key={i}
          className={`${styles.mote} ${styles[`mote${path}`]}`}
          style={{
            left: `${left}%`,
            width: size,
            height: size,
            background: `rgba(${rgb},${alpha})`,
            boxShadow: glow(blur, alpha, glowRgb),
            animationDuration: `${seconds}s`,
            animationDelay: `${delay}s`,
          }}
        />
      ))}
    </div>
  );
}

export function LampSky() {
  const { settings } = useSettings();
  const light = settings.theme;

  return (
    <div aria-hidden="true" className={styles.sky}>
      {/* — evening: the lamp in its niche — */}
      <div className={`${styles.scene} ${styles.sceneEve}`}>
        <div className={`${styles.layer} ${styles.wash}`} />
        <div className={`${styles.layer} ${styles.halo}`} />
        <div className={`${styles.layer} ${styles.core}`} />
        <div className={`${styles.layer} ${styles.flame}`} />
        <div className={`${styles.layer} ${styles.wick}`} />
        <div className={`${styles.layer} ${styles.shaft}`} />
        <div className={`${styles.layer} ${styles.smokeA}`} />
        <div className={`${styles.layer} ${styles.smokeB}`} />
        <div className={`${styles.layer} ${styles.wallA}`} />
        <div className={`${styles.layer} ${styles.wallB}`} />
        {light === "evening" && (
          <MoteField field={EVENING_EMBERS} rgb="255,224,164" glowRgb="226,190,124" />
        )}
        <div className={styles.vignette} />
      </div>

      {/* — day: the sun and the shafts it drops through the room — */}
      <div className={`${styles.scene} ${styles.sceneDay}`}>
        <div className={styles.dayWash} />
        <div className={styles.sun} />
        <div className={`${styles.ray} ${styles.rayA}`} />
        <div className={`${styles.ray} ${styles.rayB}`} />
        <div className={`${styles.ray} ${styles.rayC}`} />
        {light === "day" && <MoteField field={DAY_MOTES} rgb="126,88,32" glowRgb="168,124,56" />}
        <div className={styles.vignette} />
      </div>

      {/* — night: the same niche, gone cold, under stars — */}
      <div className={`${styles.scene} ${styles.sceneNight}`}>
        <div className={`${styles.layer} ${styles.nightWash}`} />
        <div className={`${styles.layer} ${styles.nightHalo}`} />
        <div className={`${styles.layer} ${styles.nightCore}`} />
        <div className={`${styles.layer} ${styles.nightFlame}`} />
        <div className={`${styles.layer} ${styles.nightWick}`} />
        <div className={`${styles.layer} ${styles.nightShaft}`} />
        <div className={`${styles.layer} ${styles.nightSmokeA}`} />
        <div className={`${styles.layer} ${styles.nightSmokeB}`} />
        {light === "night" && (
          <>
            <div className={styles.motes}>
              {NIGHT_STARS.map((s, i) => (
                <span
                  key={i}
                  className={styles.star}
                  style={
                    {
                      left: `${s.left}%`,
                      top: `${s.top}%`,
                      width: s.size,
                      height: s.size,
                      animationDuration: `${s.slow}s`,
                      animationDelay: `${s.slowFrom}s`,
                      "--mk-star-swell": s.swell,
                    } as React.CSSProperties
                  }
                >
                  <span
                    className={`${styles.starCore} ${styles[`scint${s.pattern}`]}`}
                    style={
                      {
                        background: `rgba(${TINTS[s.tint]},${s.alpha})`,
                        boxShadow: starGlow(s),
                        animationDuration: `${s.fast}s`,
                        animationDelay: `${s.fastFrom}s`,
                        "--mk-star-floor": s.floor,
                      } as React.CSSProperties
                    }
                  />
                  {s.chroma > 0 && (
                    <span
                      className={styles.starChroma}
                      style={{
                        boxShadow: chromaGlow(s),
                        animationDuration: `${s.chroma}s`,
                        animationDelay: `${s.chromaFrom}s`,
                      }}
                    />
                  )}
                </span>
              ))}
            </div>
            <MoteField field={NIGHT_EMBERS} rgb="236,246,255" glowRgb="184,212,252" />
          </>
        )}
        <div className={styles.vignette} />
      </div>
    </div>
  );
}
