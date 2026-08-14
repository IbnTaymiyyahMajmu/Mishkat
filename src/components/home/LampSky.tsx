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
 * All three skies stay mounted and only one is lit, on `--mk-scene-*`, so the
 * sky is right in the first painted frame rather than after hydration. Only the
 * lit sky's motes are rendered, though: an ember animating at zero opacity
 * still costs a composite every frame, and there can be a hundred of them.
 *
 * Purely decorative and entirely CSS: no canvas, no animation frame, nothing
 * for React to re-render once the light is chosen. The whole thing is inert to
 * the reader and to the screen reader alike, and the global reduced-motion rule
 * stills it.
 */

/** `[left%, diameter, alpha, glowBlur (0 for none), path, seconds, delay]` */
type Mote = [number, number, number, number, "A" | "B" | "C", number, number];

/** `[left%, top%, diameter, alpha, warm, seconds, delay]` */
type Star = [number, number, number, number, boolean, number, number];

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

/** Stars sit in the top fifth of the sky, where the niche's light does not reach. */
function stars(count: number, seed: number): Star[] {
  let n = seed;
  const rand = () => {
    n = (n * 1664525 + 1013904223) % 4294967296;
    return n / 4294967296;
  };
  return Array.from({ length: count }, (_, i) => [
    round(((i + 0.5) / count) * 100 + (rand() - 0.5) * 8),
    round(1 + rand() * 19),
    round(1.2 + rand() * 1.4),
    round(0.46 + rand() * 0.45),
    rand() < 0.22,
    round(3.4 + rand() * 6),
    round(rand() * 10),
  ]);
}

const round = (n: number) => Math.round(n * 10) / 10;

const EVENING_EMBERS = motes(28, 24, 43, 20250814);
const DAY_MOTES = motes(26, 14, 24, 970411);
const NIGHT_EMBERS = motes(26, 16, 27, 616131);
const NIGHT_STARS = stars(30, 114255);

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
              {NIGHT_STARS.map(([left, top, size, alpha, warm, seconds, delay], i) => (
                <span
                  key={i}
                  className={styles.star}
                  style={{
                    left: `${left}%`,
                    top: `${top}%`,
                    width: size,
                    height: size,
                    background: warm
                      ? `rgba(255,234,196,${alpha})`
                      : `rgba(232,241,255,${alpha})`,
                    boxShadow: `0 0 ${(size * 4).toFixed(1)}px 2px rgba(${
                      warm ? "255,224,164" : "200,222,255"
                    },0.26)`,
                    animationDuration: `${seconds}s`,
                    animationDelay: `${delay}s`,
                  }}
                />
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
