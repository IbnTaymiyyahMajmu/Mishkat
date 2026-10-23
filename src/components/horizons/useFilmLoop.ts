"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type { PlayerControls } from "@/lib/audio/player";
import { Film, OUTRO, pathX, type Caption } from "@/lib/horizons/director";
import { lightFor } from "@/lib/horizons/astro";
import { Renderer, type Frame } from "./renderer";

export type Motion = "full" | "gentle" | "still";

export interface Look {
  yaw: number;
  pitch: number;
  /** A finger or the mouse is holding the view: it does not drift back yet. */
  held: boolean;
}

export interface FilmMoment {
  /** The ayah being recited, as an index into the surah, and the word in it (0 before its first). */
  index: number;
  position: number;
}

interface Args {
  canvas: HTMLCanvasElement | null;
  film: Film | null;
  surah: number;
  controls: PlayerControls;
  /** The pace the recitation is played at, from the settings. */
  speed: number;
  motion: Motion;
  /** When the reader pressed Begin, by `performance.now()`; null before. */
  begun: number | null;
  look: MutableRefObject<Look>;
  /** The room above the card on screen, in CSS pixels from the top: where the closed niche is fitted. */
  room: MutableRefObject<{ top: number; bottom: number } | null>;
  onMoment: (m: FilmMoment) => void;
  onCaption: (c: Caption) => void;
  /** Said a few times a second: how veiled the world is, and whether the film has reached its end. */
  onState: (s: { veil: number; lamp: number; ended: boolean; bow: number }) => void;
}

const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** The camera's orientation as the shader wants it: right, up and forward, column by column. */
function rotation(yaw: number, pitch: number, roll: number): Float32Array {
  const f = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  // Right is taken from the heading alone, so that a camera tipped past
  // straight down — looking back on the place it rises from — does not turn
  // the picture over.
  const r = [Math.cos(yaw), 0, -Math.sin(yaw)];
  let u = [f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]];
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  const r2 = r.map((v, i) => v * cr + u[i] * sr);
  u = [f[1] * r2[2] - f[2] * r2[1], f[2] * r2[0] - f[0] * r2[2], f[0] * r2[1] - f[1] * r2[0]];
  return new Float32Array([...r2, ...u, ...f]);
}

/** The niche's height (1.09 of its scale, 0.62 of it below its centre), fitted into the room given. */
function nicheIn(room: { top: number; bottom: number } | null, height: number): [number, number] {
  if (!room || height <= 0) return [0.08, 0.4];
  const yt = 0.5 - room.top / height;
  const yb = 0.5 - room.bottom / height;
  const span = Math.max(0.02, yt - yb);
  const scale = Math.max(0.06, Math.min(0.4, (span / 1.09) * 0.88));
  return [yb + 0.62 * scale + (span - 1.09 * scale) / 2, scale];
}

/** The landmark near the camera, as the shader takes it. */
function markOf(film: Film, z: number): [number, number, number, number] {
  const m = film.landmarkNear(z);
  return m ? [m.x, m.y, m.z, m.kind === "haram" ? 1 : 2] : [0, 0, 0, 0];
}

/** How golden the hour is: most at sunrise and sunset. */
function golden(hour: number) {
  const h = ((hour % 24) + 24) % 24;
  return Math.exp(-((h - 6.4) ** 2) / 1.6) + Math.exp(-((h - 17.8) ** 2) / 1.6);
}

/**
 * The film's frame loop: reads where the recitation is, turns it into film
 * time, asks the director what the world is at that time, and draws it.
 *
 * Film time is kept by its own clock between readings of the player's — the
 * element's clock moves in steps, and a camera moved in steps judders — and
 * pulled gently back to the player's whenever the two drift. A jump (a seek,
 * a loop going round, the next ayah chosen) is taken through a breath of
 * light rather than a cut.
 */
export function useFilmLoop(args: Args): { failed: boolean } {
  const [failed, setFailed] = useState(false);
  const live = useRef(args);
  useEffect(() => {
    live.current = args;
  });

  const { canvas, surah } = args;

  // The renderer lives as long as the canvas does. The film is handed to it
  // as each version of it arrives — the first page of a long surah, then the
  // whole — so the niche and tonight's sky are there from the first moment,
  // and a change of pace lays the land out again without a pause.
  useEffect(() => {
    if (!canvas) return;
    const mobile = window.matchMedia("(pointer: coarse)").matches || Math.min(window.innerWidth, window.innerHeight) < 600;
    let renderer: Renderer;
    try {
      renderer = new Renderer(canvas, mobile);
    } catch (e) {
      // Said after the effect, as a failure reported by the GPU is: the page
      // then shows the light without the land.
      console.warn("horizons:", e);
      const id = window.setTimeout(() => setFailed(true), 0);
      return () => window.clearTimeout(id);
    }

    let current: Film | null = null;
    let recitedEnd = 0;
    let firstKey = `${surah}:1`;
    let t = 0;
    let last = performance.now();
    let flash = 0;
    let bolt = { start: -1e9, x: 0.5, bottom: 0.4, visible: true };
    let nextBolt = 0;
    let meteor = { start: -1e9, x0: 0, y0: 0, x1: 0, y1: 0 };
    let nextMeteor = 0;
    let fireZ: number | null = null;
    let outro = false;
    let shown = { index: -1, position: -1 };
    let stateAt = 0;
    let lastCaptionT = 0;
    let frameId = 0;
    let lost = false;
    const start = performance.now();

    const onLost = (e: Event) => {
      e.preventDefault();
      lost = true;
      cancelAnimationFrame(frameId);
    };
    canvas.addEventListener("webglcontextlost", onLost);

    const frame = (now: number) => {
      frameId = requestAnimationFrame(frame);
      if (lost || document.hidden) {
        last = now;
        return;
      }
      const a = live.current;
      if (a.film !== current) {
        current = a.film;
        if (current) {
          renderer.setStrip(current.strip);
          recitedEnd = current.duration - OUTRO;
          firstKey = current.timings[0]?.key ?? firstKey;
        }
      }
      const film = current;
      if (!film) {
        last = now;
        return;
      }
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const wall = (now - start) / 1000;

      // ── where the recitation is ───────────────────────────────────────
      const clock = a.controls.clock();
      const ours = clock.key ? clock.key.startsWith(`${surah}:`) : false;
      const lastKey = film.timings[film.timings.length - 1]?.key;
      const atEnd =
        ours && clock.key === lastKey && !clock.playing && clock.recorded !== null && clock.seconds >= clock.recorded - 0.08;
      if (a.begun !== null && atEnd) outro = true;
      if (ours && clock.playing) outro = false;

      let target: number | null = null;
      if (outro) target = null;
      else if (ours && clock.key) target = film.timeOf(clock.key, clock.seconds, clock.recorded ?? undefined);
      else if (a.begun === null) target = film.timeOf(firstKey, 0);

      if (outro) {
        t = Math.min(film.duration, Math.max(t, recitedEnd) + dt);
      } else if (target !== null) {
        if (ours && clock.playing) t += dt * a.speed;
        const err = target - t;
        if (Math.abs(err) > 1.4) {
          if (a.begun !== null && Math.abs(err) > 2.5) flash = 1;
          t = target;
          lastCaptionT = t;
        } else {
          t += err * Math.min(1, dt * 3.5);
        }
      }

      // ── the captions crossed since the last frame ─────────────────────
      if (t > lastCaptionT) {
        if (t - lastCaptionT < 2.5) {
          for (const c of film.captions) if (c.t > lastCaptionT && c.t <= t) a.onCaption(c);
        }
        lastCaptionT = t;
      } else if (t < lastCaptionT - 0.5) lastCaptionT = t;

      const place = film.placeAt(t);
      if (place.index !== shown.index || place.position !== shown.position) {
        shown = place;
        a.onMoment(place);
      }

      // ── the world at this moment ──────────────────────────────────────
      const sky = film.sky(t);
      const gentle = a.motion === "gentle" ? 1 : 0;
      const still = a.motion === "still" ? 1 : 0;
      sky.sweep *= 1 - 0.6 * gentle - still;
      const cam = film.camera(t, sky, wall * (1 - 0.6 * gentle - 0.9 * still));
      const look = a.look.current;
      if (!look.held) {
        const k = Math.exp(-dt * 1.1);
        look.yaw *= k;
        look.pitch *= k;
      }
      const yaw = cam.yaw + look.yaw;
      // Down to straight down and a little past it: the Night Journey looks on
      // the desert from above, and rising over Jerusalem looks back on it, so
      // that the city stands above the verse's words rather than behind them.
      const pitch = Math.max(-1.78, Math.min(1.35, cam.pitch + look.pitch));
      const roll = cam.roll * (1 - gentle - still);
      const light = lightFor(sky.hour, sky, cam.y);

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      renderer.resize(w, h, window.devicePixelRatio || 1);
      const aspect = w / Math.max(1, h);
      const focal = Math.max(aspect * 0.95, 1.15);

      // Lightning: a bolt now and then while the storm holds, and the cloud lit by it.
      if (sky.storm > 0.25) {
        if (now > nextBolt) {
          bolt = { start: now, x: 0.18 + Math.random() * 0.64, bottom: 0.3 + Math.random() * 0.15, visible: Math.random() < 0.65 };
          nextBolt = now + ((2.2 + Math.random() * 5) / sky.storm) * 1000;
        }
      }
      const bt = (now - bolt.start) / 1000;
      // Never more than a few flashes a second, and in the calmer motions a
      // single soft swell rather than a flicker.
      const strike =
        a.motion !== "full"
          ? bt < 1.4 ? Math.sin(Math.min(1, bt / 0.25) * Math.PI * 0.5) * Math.exp(-bt * 2.4) * 0.6 : 0
          : bt < 0.06 ? 1 : bt < 0.14 ? 0.3 : bt < 0.22 ? 0.8 : bt < 1.2 ? Math.exp(-(bt - 0.22) * 8) : 0;
      // A shooting star, on a night that has them.
      if (sky.meteor > 0.3 && light.night > 0.4 && now > nextMeteor) {
        const dir = Math.random() < 0.5 ? -1 : 1;
        const x0 = 0.18 + Math.random() * 0.64;
        const y0 = 0.72 + Math.random() * 0.22;
        meteor = { start: now, x0, y0, x1: x0 + dir * (0.14 + Math.random() * 0.22), y1: y0 - (0.1 + Math.random() * 0.16) };
        nextMeteor = now + ((2.4 + Math.random() * 4) / sky.meteor) * 1000;
      }
      const mt = (now - meteor.start) / 900;
      // The fire is lit at a place on the land ahead, and stays there.
      if (sky.fire > 0.05 && fireZ === null) fireZ = cam.z + 260;
      if (sky.fire < 0.02) fireZ = null;
      const fz = fireZ ?? cam.z + 260;
      const fl = film.landAtZ(fz);
      const fire: [number, number, number] = [pathX(fz, fl.straight) + 34, Math.max(0, film.groundAt(fz)) + 1.1, fz];

      // The niche the film opens out of, and closes back into at the end —
      // and which the parable of the light brings back for a while.
      let aperture = a.begun === null ? 0 : smooth((now - a.begun) / 3600);
      if (t > recitedEnd + 9) aperture = Math.min(aperture, 1 - smooth((t - recitedEnd - 9) / 7) * 0.96);
      aperture = Math.min(aperture, 1 - 0.74 * smooth((sky.lamp - 0.55) / 0.45));

      flash = Math.max(0, flash - dt * 2.8);
      const horizonY = 0.5 - (Math.tan(pitch) * focal) / 2;

      const f: Frame = {
        time: wall,
        cam: [cam.x, cam.y, cam.z],
        rot: rotation(yaw, pitch, roll),
        focal,
        sun: light.sun,
        moon: light.moon,
        sunCol: light.sunCol,
        moonCol: light.moonCol,
        skyUp: light.skyUp,
        sunI: light.sunI,
        moonI: light.moonI,
        a: [sky.cloud, sky.rain, strike * 0.45 * Math.min(1, sky.storm * 1.4), sky.wind],
        b: [sky.stars, sky.haze, sky.revive, sky.dry],
        c: [sky.phase, 1.6 + 2.6 * sky.moon, 1 + 1.6 * sky.sun, light.night],
        d: [(sky.hour / 24) * Math.PI * 2 + 1.2, sky.fire, 0, 1],
        fire,
        // The eye opens under water, as it does at night.
        exposure: light.exposure * (1 + 2.2 * sky.under),
        e: [sky.veil, sky.lamp, aperture, smooth(flash)],
        f: [sky.rain, sky.hail, sky.wind, light.night],
        bolt: [bolt.x, 0.98, bolt.bottom, bolt.visible ? strike * 0.7 * Math.min(1, sky.storm * 1.3) : 0],
        meteor: [meteor.x0, meteor.y0, meteor.x1, meteor.y1],
        meteorT: [Math.min(1, mt), mt < 1 ? Math.sin(Math.PI * mt) * sky.meteor : 0],
        g: [sky.mirage, horizonY, 0.25 + 0.6 * golden(sky.hour) * (1 - light.night), 0],
        dim: sky.dim * 0.62,
        niche: nicheIn(a.room.current, h),
        // Out of the air the stars are there by day as well.
        starAmt: sky.stars * Math.max(light.night, smooth(sky.space * 1.4)) * (1 - 0.92 * sky.cloud * (1 - sky.space)) * (1 - 0.6 * sky.rain),
        mark: markOf(film, cam.z),
        here: [film.landAtZ(cam.z).city, cam.x, cam.z],
        moonP: [sky.phase, 0.0105 * (1.6 + 2.6 * sky.moon), 0.3 * (1 - 0.85 * sky.cloud) * (light.moonI > 0 || light.night < 0.5 ? 1 : 0)],
      };
      try {
        renderer.render(f, now);
      } catch (e) {
        console.warn("horizons:", e);
        cancelAnimationFrame(frameId);
        setFailed(true);
        return;
      }

      if (now - stateAt > 200) {
        stateAt = now;
        a.onState({ veil: sky.veil, lamp: sky.lamp, ended: t > recitedEnd + 5, bow: sky.bow });
      }
    };
    frameId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(frameId);
      canvas.removeEventListener("webglcontextlost", onLost);
      // Deferred: React's development double-mount would otherwise hand the
      // second mount a context already being torn down.
      setTimeout(() => {
        try {
          renderer.dispose();
        } catch {
          /* the context went with the page */
        }
      }, 0);
    };
  }, [canvas, surah]);

  return { failed };
}
