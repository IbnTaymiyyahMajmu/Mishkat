/**
 * Where the sun and the moon are, and what light they give, for an hour of
 * the film's day.
 *
 * The camera looks south, as a traveller out of Makkah towards Yemen would,
 * so the sun rises on the left, stands ahead at noon and sets on the right,
 * all of it in front of the lens. When a sign names the sun or the moon it is
 * brought into the frame — lowered, and turned towards the middle — which is
 * the one liberty the film takes with the sky.
 *
 * The light is worked out the way the shader works out the sky (the same
 * scattering, done once a frame here rather than once a pixel there), so the
 * ground is lit by the colour the sky actually is: white at noon, gold in the
 * evening, a deep blue under the moon.
 */

export type Vec3 = [number, number, number];

const norm = (v: Vec3): Vec3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const mix = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The direction of a body on the daily arc, `a` radians past rising. */
function arc(a: number, framing: number): Vec3 {
  const x = -Math.cos(a) * (0.78 - 0.42 * framing);
  let y = Math.sin(a) * 0.9;
  if (y > 0) y *= 1 - 0.55 * framing;
  return norm([x, y, 0.66 + 0.2 * framing]);
}

export function sunDirection(hour: number, emphasis: number): Vec3 {
  const a = ((((hour - 6) % 24) + 24) % 24) / 12 * Math.PI;
  return arc(a, emphasis);
}

/**
 * The moon lags the sun by its phase: new, it rides with the sun; full, it
 * rises as the sun sets. Named, it is brought up into the frame.
 */
export function moonDirection(hour: number, phase: number, emphasis: number): Vec3 {
  const a = ((((hour - 6) % 24) + 24) % 24) / 12 * Math.PI - phase * 2 * Math.PI;
  const real = arc(a, emphasis * 0.6);
  if (emphasis < 0.01) return real;
  const side = Math.cos(a) > 0 ? -0.32 : 0.32;
  const framed = norm([side, 0.3, 1]);
  return norm(mix(real, framed, emphasis * (real[1] < 0.12 ? 1 : 0.55)));
}

/** How much of the moon is lit, 0 to 1, for a phase. */
export function litFraction(phase: number): number {
  return (1 - Math.cos(phase * 2 * Math.PI)) / 2;
}

// ── the air ──────────────────────────────────────────────────────────────

const RE = 6360e3;
const RA = 6420e3;
const BR: Vec3 = [5.8e-6, 13.5e-6, 33.1e-6];

function sphereFar(o: Vec3, d: Vec3, r: number): number {
  const b = o[0] * d[0] + o[1] * d[1] + o[2] * d[2];
  const c = o[0] * o[0] + o[1] * o[1] + o[2] * o[2] - r * r;
  const h = b * b - c;
  return h < 0 ? -1 : -b + Math.sqrt(h);
}

/** Higher than this the camera is out of the air, and the sky is worked out as from space. */
export const ABOVE_AIR = 58000;

/** Whether the earth stands between a point this high and a body in this direction. */
function behindEarth(dir: Vec3, height: number): boolean {
  const r = RE + height;
  const b = r * dir[1];
  const disc = b * b - (r * r - RE * RE);
  return disc > 0 && -b - Math.sqrt(disc) > 0;
}

/** What fraction of a body's light reaches the ground, through the air towards it. */
export function transmittance(dir: Vec3, height: number, haze: number): Vec3 {
  // Above the air: the light arrives whole, unless the earth is in the way.
  if (height > ABOVE_AIR) return behindEarth(dir, height) ? [0, 0, 0] : [1, 1, 1];
  if (dir[1] < -0.12) return [0, 0, 0];
  const o: Vec3 = [0, RE + Math.max(2, height), 0];
  const t = sphereFar(o, dir, RA);
  const seg = t / 12;
  let odR = 0;
  let odM = 0;
  for (let i = 0; i < 12; i++) {
    const s = seg * (i + 0.5);
    const p: Vec3 = [o[0] + dir[0] * s, o[1] + dir[1] * s, o[2] + dir[2] * s];
    const h = Math.hypot(p[0], p[1], p[2]) - RE;
    if (h < 0) return [0, 0, 0];
    odR += Math.exp(-h / 8000) * seg;
    odM += Math.exp(-h / 1200) * seg;
  }
  const bm = 21e-6 * (1 + haze * 3) * 1.1;
  return [Math.exp(-(BR[0] * odR + bm * odM)), Math.exp(-(BR[1] * odR + bm * odM)), Math.exp(-(BR[2] * odR + bm * odM))];
}

/** Light scattered towards the eye from one direction of the sky, as the shader's `scatter`. */
export function scatter(rd: Vec3, light: Vec3, intensity: number, height: number, haze: number): Vec3 {
  const bm = 21e-6 * (1 + haze * 3);
  const o: Vec3 = [0, RE + Math.max(2, height), 0];
  const tMax = sphereFar(o, rd, RA);
  const seg = tMax / 8;
  const sumR: Vec3 = [0, 0, 0];
  const sumM: Vec3 = [0, 0, 0];
  let odR = 0;
  let odM = 0;
  for (let i = 0; i < 8; i++) {
    const s = seg * (i + 0.5);
    const p: Vec3 = [o[0] + rd[0] * s, o[1] + rd[1] * s, o[2] + rd[2] * s];
    const h = Math.hypot(p[0], p[1], p[2]) - RE;
    const dR = Math.exp(-h / 8000) * seg;
    const dM = Math.exp(-h / 1200) * seg;
    odR += dR;
    odM += dM;
    const tl = sphereFar(p, light, RA);
    const segL = tl / 4;
    let lR = 0;
    let lM = 0;
    let lit = true;
    for (let j = 0; j < 4; j++) {
      const sl = segL * (j + 0.5);
      const q: Vec3 = [p[0] + light[0] * sl, p[1] + light[1] * sl, p[2] + light[2] * sl];
      const hl = Math.hypot(q[0], q[1], q[2]) - RE;
      if (hl < 0) {
        lit = false;
        break;
      }
      lR += Math.exp(-hl / 8000) * segL;
      lM += Math.exp(-hl / 1200) * segL;
    }
    if (!lit) continue;
    for (let c = 0; c < 3; c++) {
      const att = Math.exp(-(BR[c] * (odR + lR) + bm * 1.1 * (odM + lM)));
      sumR[c] += att * dR;
      sumM[c] += att * dM;
    }
  }
  const mu = rd[0] * light[0] + rd[1] * light[1] + rd[2] * light[2];
  const pr = 0.0597 * (1 + mu * mu);
  const g = 0.76;
  const pm = (0.1194 * ((1 - g * g) * (1 + mu * mu))) / ((2 + g * g) * Math.pow(1 + g * g - 2 * g * mu, 1.5));
  return [0, 1, 2].map((c) => intensity * (sumR[c] * BR[c] * pr + sumM[c] * bm * pm)) as Vec3;
}

export interface Light {
  sun: Vec3;
  moon: Vec3;
  sunI: number;
  moonI: number;
  /** Direct light, at the camera. */
  sunCol: Vec3;
  moonCol: Vec3;
  /** The sky straight overhead: what lights the ground from above. */
  skyUp: Vec3;
  /** 0 by day, 1 by full night. */
  night: number;
  exposure: number;
}

export const SUN_I = 22;

/** The colour moonlight is seen as: its own luminance, shifted towards blue. */
const MOONLIGHT: Vec3 = [0.8, 0.95, 1.3];

export function lightFor(
  hour: number,
  sky: { sun: number; moon: number; phase: number; haze: number; cloud: number; rain: number; veil: number },
  height: number,
): Light {
  const sun = sunDirection(hour, sky.sun);
  const moon = moonDirection(hour, sky.phase, sky.moon);
  const night = smooth(0.06, -0.2, sun[1]);
  const lit = litFraction(sky.phase);
  // The moon, drawn larger than life when it is named, and a little brighter.
  const moonI = moon[1] > -0.2 ? (SUN_I / 38) * (0.15 + 0.85 * lit) * (1 + sky.moon * 0.6) * night : 0;
  const ts = transmittance(sun, height, sky.haze);
  const tm = transmittance(moon, height, sky.haze);
  const cloudDim = 1 - 0.7 * sky.cloud * sky.cloud - 0.2 * sky.rain;
  const sunCol = ts.map((v) => v * 2.5 * cloudDim) as Vec3;
  // Moonlight is sunlight, but the eye sees it silver-blue: by moonlight the
  // land is cool, and a town's own lights warm against it.
  const moonCol = tm.map((v, c) => v * 2.5 * (moonI / SUN_I) * cloudDim * MOONLIGHT[c]) as Vec3;
  const up: Vec3 = [0, 1, 0];
  const above = height > ABOVE_AIR;
  const s1 = !above && sun[1] > -0.32 ? scatter(up, sun, SUN_I, height, sky.haze) : [0, 0, 0];
  const s2 = !above && moonI > 0 ? scatter(up, moon, moonI, height, sky.haze).map((v, c) => v * MOONLIGHT[c]) : [0, 0, 0];
  const grey = 1 - 0.45 * sky.cloud;
  const skyUp: Vec3 = [0, 1, 2].map((c) => (s1[c] + s2[c]) * grey + sky.cloud * 0.12 * (s1[1] + s2[1])) as Vec3;
  // Exposure for the hour: the eye opens at night, so a moonlit valley is a
  // blue valley and not a black screen — and opens further under cloud.
  const exposure = (0.5 + 8.5 * Math.pow(night, 1.4)) * (1 + 0.55 * sky.cloud) * (1 + sky.veil * 0.4);
  return { sun, moon, sunI: SUN_I, moonI, sunCol, moonCol, skyUp, night, exposure };
}
