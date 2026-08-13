import styles from "./LampSky.module.css";

/**
 * The lit niche the landing page is read against — مِشْكَاةٍ, the niche that
 * holds the lamp.
 *
 * Purely decorative and entirely CSS: no canvas, no animation frame, nothing
 * for React to re-render. The whole thing is inert to the reader and to the
 * screen reader alike, and the global reduced-motion rule stills it.
 */

/** `[left%, diameter, alpha, glowBlur (0 for none), path, seconds, delay]` */
type Ember = [number, number, number, number, "A" | "B" | "C", number, number];

const EMBERS: Ember[] = [
  [6, 3.0, 0.78, 9, "A", 26, 0],
  [12, 2.8, 0.62, 0, "B", 33, 5],
  [19, 3.0, 0.74, 9, "C", 29, 12],
  [25, 2.7, 0.55, 0, "A", 37, 3],
  [31, 3.0, 0.78, 9, "B", 24, 17],
  [37, 2.8, 0.58, 0, "C", 41, 9],
  [44, 2.9, 0.66, 9, "A", 31, 21],
  [50, 3.0, 0.74, 0, "B", 28, 14],
  [56, 2.7, 0.55, 8, "C", 35, 2],
  [62, 2.9, 0.7, 0, "A", 27, 19],
  [68, 2.8, 0.58, 8, "B", 39, 7],
  [74, 3.0, 0.78, 0, "C", 30, 24],
  [79, 2.8, 0.62, 8, "A", 34, 11],
  [84, 2.9, 0.7, 0, "B", 26, 16],
  [89, 2.6, 0.51, 8, "C", 43, 4],
  [94, 2.9, 0.66, 0, "A", 32, 22],
  [3, 2.7, 0.55, 8, "B", 38, 27],
  [15, 2.6, 0.47, 0, "C", 45, 30],
  [47, 2.7, 0.55, 8, "A", 36, 33],
  [71, 2.6, 0.47, 0, "B", 44, 26],
  [22, 2.6, 0.51, 8, "C", 40, 35],
  [86, 2.8, 0.58, 0, "A", 29, 39],
];

/** The glow around an ember is proportional to how bright the ember is. */
function emberGlow(blur: number, alpha: number): string | undefined {
  if (!blur) return undefined;
  const strength = (alpha * 0.41).toFixed(2);
  return `0 0 ${blur}px 2px rgba(226,190,124,${strength})`;
}

export function LampSky() {
  return (
    <div aria-hidden="true" className={styles.sky}>
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

      <div className={styles.embers}>
        {EMBERS.map(([left, size, alpha, blur, path, seconds, delay], i) => (
          <span
            key={i}
            className={`${styles.ember} ${styles[`ember${path}`]}`}
            style={{
              left: `${left}%`,
              width: size,
              height: size,
              background: `rgba(255,224,164,${alpha})`,
              boxShadow: emberGlow(blur, alpha),
              animationDuration: `${seconds}s`,
              animationDelay: `${delay}s`,
            }}
          />
        ))}
      </div>

      <div className={styles.vignette} />
    </div>
  );
}
