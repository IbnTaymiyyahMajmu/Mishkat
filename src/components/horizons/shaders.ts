/**
 * The world, drawn.
 *
 * One fragment shader draws the whole of it for every pixel: the land is a
 * height field marched along the ray, the sky is sunlight (or moonlight)
 * scattered by the air as it really is — blue overhead, red through the long
 * air at the horizon — the clouds are marched as a layer of vapour lit from
 * the sun, and the sea is a mirror of that sky roughened by the wind. It is
 * drawn at a fraction of the screen's resolution into a floating-point
 * target, then softened into a glow (`DOWN`, `UP`) and finished in
 * `COMPOSITE`, which is where the veil and the lamp, rain and lightning, and
 * the film's own grade are laid on.
 *
 * Kept in step with director.ts: `pathX`, `undul` and `floorOf` are the same
 * functions there, because the camera, flying over the land in JavaScript,
 * must not fly into what the shader has drawn.
 */

export const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const COMMON = `
float n2(vec2 x) {
  vec2 p = floor(x);
  vec2 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return textureLod(uNoise, (p + f + 0.5) / 256.0, 0.0).x;
}
float n3(vec3 x) {
  vec3 p = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  vec2 uv = p.xy + vec2(37.0, 17.0) * p.z + f.xy;
  vec2 rg = textureLod(uNoise, (uv + 0.5) / 256.0, 0.0).xy;
  return mix(rg.x, rg.y, f.z);
}
vec2 hash2(vec2 cell) {
  return texelFetch(uNoise, ivec2(mod(cell, 256.0)), 0).zw;
}
const mat2 ROT = mat2(1.6, 1.2, -1.2, 1.6);
float fbm(vec2 p, int oct) {
  float a = 0.5, s = 0.0, n = 0.0;
  for (int i = 0; i < 9; i++) {
    if (i >= oct) break;
    s += a * n2(p);
    n += a;
    p = ROT * p;
    a *= 0.5;
  }
  return s / n;
}

// ── the lights of the sky, drawn where they are sharp ─────────────────────

/** The sky turning about the pole, which stands 21 degrees over the northern horizon — behind. */
mat3 turnAbout(float a) {
  vec3 axis = normalize(vec3(0.0, sin(0.366), -cos(0.366)));
  float s = sin(a), c = cos(a);
  return mat3(
    c + axis.x * axis.x * (1.0 - c), axis.y * axis.x * (1.0 - c) + axis.z * s, axis.z * axis.x * (1.0 - c) - axis.y * s,
    axis.x * axis.y * (1.0 - c) - axis.z * s, c + axis.y * axis.y * (1.0 - c), axis.z * axis.y * (1.0 - c) + axis.x * s,
    axis.x * axis.z * (1.0 - c) + axis.y * s, axis.y * axis.z * (1.0 - c) - axis.x * s, c + axis.z * axis.z * (1.0 - c)
  );
}

/** The stars: points a pixel across, most of them faint, a few bright, all of them turning with the hour. */
vec3 pointStars(vec3 rd, float turn, float px, float time) {
  vec3 q = turnAbout(turn) * rd;
  vec3 col = vec3(0.0);
  for (int layer = 0; layer < 3; layer++) {
    float scale = layer == 0 ? 55.0 : layer == 1 ? 120.0 : 260.0;
    vec3 g = q * scale;
    vec3 cell = floor(g);
    vec3 f = g - cell;
    vec4 h = textureLod(uNoise, (cell.xy + cell.z * vec2(37.0, 17.0) + 0.5) / 256.0, 0.0);
    float keep = layer == 0 ? 0.6 : layer == 1 ? 0.55 : 0.5;
    if (h.y < keep) continue;
    vec3 pos = vec3(h.z, h.w, fract(h.x * 13.7)) * 0.8 + 0.1;
    float d = length(f - pos) / scale;
    float bright = layer == 0 ? pow(h.x, 4.0) * 0.5 : layer == 1 ? pow(h.x, 5.0) * 0.12 : pow(h.x, 3.0) * 0.035;
    float twinkle = 0.7 + 0.3 * sin(time * (1.7 + 4.0 * h.y) + h.z * 40.0);
    float spot = exp(-d * d / (px * px));
    vec3 tint = mix(vec3(0.72, 0.8, 1.0), vec3(1.0, 0.84, 0.62), fract(h.w * 7.3));
    col += tint * bright * spot * twinkle;
  }
  return col;
}

/** The moon's face: lit on the side towards the sun, by as much as its phase. */
vec3 moonFace(vec3 rd, vec3 m, vec3 sun, float phase, float size) {
  float cosA = dot(rd, m);
  float ang = acos(clamp(cosA, -1.0, 1.0));
  if (ang > size * 1.05) return vec3(0.0);
  vec3 up = abs(m.y) > 0.99 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
  vec3 sAxis = sun - m * dot(sun, m);
  sAxis = length(sAxis) > 1e-4 ? normalize(sAxis) : normalize(cross(up, m));
  vec3 tAxis = cross(m, sAxis);
  vec2 uv = vec2(dot(rd - m * cosA, sAxis), dot(rd - m * cosA, tAxis)) / size;
  float r2 = dot(uv, uv);
  if (r2 >= 1.0) return vec3(0.0);
  float edge = smoothstep(1.0, 0.94, sqrt(r2));
  vec3 nrm = vec3(uv, sqrt(1.0 - r2));
  float phi = phase * 6.2831853;
  vec3 L = normalize(vec3(sin(phi), 0.0, -cos(phi)));
  float lit = max(dot(nrm, L), 0.0);
  lit = smoothstep(0.0, 0.1, lit) * (0.55 + 0.45 * lit);
  float maria = 0.66 + 0.34 * smoothstep(0.38, 0.68, fbm(uv * 2.0 + 7.0, 5));
  vec3 surface = vec3(1.0, 0.97, 0.9) * maria * (0.84 + 0.16 * nrm.z);
  return surface * (lit + 0.006) * edge;
}
`;

export const WORLD = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;

uniform vec2 uRes;
uniform float uTime;
uniform vec3 uCam;
uniform mat3 uRot;
uniform float uFocal;
uniform vec3 uSun;
uniform vec3 uMoon;
uniform vec3 uSunCol;
uniform vec3 uMoonCol;
uniform float uSunI;
uniform float uMoonI;
uniform vec3 uSkyUp;
uniform vec4 uA;   // cloud, rain, flash, wind
uniform vec4 uB;   // stars, haze, revive, dry
uniform vec4 uC;   // phase, moon size, sun size, night
uniform vec4 uD;   // star turn, fire, strata glow, seam
uniform vec3 uFirePos;
uniform vec4 uQ;   // march steps, cloud steps, shadow steps, tree distance
uniform sampler2D uS0;
uniform sampler2D uS1;
uniform sampler2D uS2;
uniform sampler2D uS3;
// A landmark set on the land: where its foot stands, and which (1 the Ḥaram, 2 the Noble Sanctuary).
uniform vec4 uMark;
// The city under the camera — how much, and where — for its glow from orbit.
uniform vec3 uHere;
uniform vec2 uStrip;
uniform sampler2D uNoise;
// 1 where the targets hold any brightness; otherwise the exposure, applied here so the darks survive eight bits.
uniform float uOut;

// A zero the compiler cannot see is zero: a loop that starts from it is kept
// a loop, and not written out once for every turn of it — which, with the
// landmarks and the map of the Levant, would make the shader too large for
// some drivers to build.
#define ZERO min(int(uTime), 0)

// The colour moonlight is seen as (astro.ts has the same): the eye at night
// sees the moon's light, and the sky it lights, silver-blue.
const vec3 MOONTINT = vec3(0.8, 0.95, 1.3);

${COMMON}

const float CB = 1500.0;
const float CT = 2700.0;

// ── the land ──────────────────────────────────────────────────────────────

vec4 strip(sampler2D s, float z) {
  return textureLod(s, vec2((z / uStrip.x + 0.5) / uStrip.y, 0.5), 0.0);
}
float pathX(float z, float st) {
  return (120.0 * sin(z * 0.0011) + 55.0 * sin(z * 0.0027 + 1.3) + 18.0 * sin(z * 0.0061 + 0.4)) * (1.0 - st);
}
float undul(float z) {
  return 2.2 * sin(z * 0.0057) + 1.4 * sin(z * 0.0131 + 2.0);
}
// A = sea, mount, dune, coast · B = fields, trees, palms, river · C = harrah, seam, strata, straight
float floorOf(vec4 A, vec4 B, vec4 C) {
  return 6.0 - 26.0 * A.x + 24.0 * A.y + 5.0 * A.z + 4.0 * C.x - 9.0 * B.w * (1.0 - A.x);
}

float ridged(vec2 p, int oct) {
  float a = 0.5, s = 0.0, w = 1.0;
  for (int i = 0; i < 9; i++) {
    if (i >= oct) break;
    float n = 1.0 - abs(n2(p) * 2.0 - 1.0);
    n *= n;
    s += n * a * w;
    w = clamp(n * 1.7, 0.0, 1.0);
    p = ROT * p;
    a *= 0.5;
  }
  return s;
}
float dunes(vec2 p) {
  float w = n2(p * 0.0021) + 0.5 * n2(p * 0.0047);
  float s = (p.x * 0.9 + p.y * 0.42) * 0.0105 + w * 3.2;
  float f = fract(s);
  float crest = f < 0.74 ? f / 0.74 : (1.0 - f) / 0.26;
  crest = crest * crest * (3.0 - 2.0 * crest);
  return crest * (0.4 + 0.8 * n2(p * 0.0014)) + n2(p * 0.06) * 0.03;
}

struct Land { vec4 A; vec4 B; vec4 C; vec4 D; float c; float side; };

/** A city's lots: where in its block a point is, whether the lot is built on, and two random values of its own. */
/*
 * A city's lots. A new town is laid out square, fifteen metres to a lot. An
 * old town is smaller and older than any plan: nine metres to a house, its
 * lanes turning as they go, no two lots quite square. "old" is how much of
 * the second there is.
 */
vec4 cityLot(vec2 p, float old, out float built) {
  float size = mix(15.0, 9.0, old);
  float ang = 0.64 + old * (n2(p * 0.0035) - 0.5) * 1.7;
  float c = cos(ang), s = sin(ang);
  vec2 q = mat2(c, -s, s, c) * p / size;
  q += old * (vec2(n2(p * 0.021), n2(p * 0.021 + 5.0)) - 0.5) * 0.7;
  vec2 cell = floor(q);
  vec2 f = fract(q);
  vec4 h = texelFetch(uNoise, ivec2(mod(cell + 57.0, 256.0)), 0);
  float lane = mix(0.13, 0.09, old);
  float inside = step(lane, f.x) * step(f.x, 1.0 - lane) * step(lane, f.y) * step(f.y, 1.0 - lane);
  built = inside * step(mix(0.14, 0.06, old), h.y);
  return vec4(f, h.x, h.z);
}

/** How many metres a pixel spans on the ground here, seen from the camera. */
float pixelAt(vec2 p) {
  return length(vec3(p - uCam.xz, uCam.y)) * 2.0 / (uFocal * uRes.y);
}

/** 1 where a town's lots are too small for a pixel to tell one from the next. */
float lotsUnseen(vec2 p, float old) {
  return smoothstep(0.4, 1.0, pixelAt(p) / mix(15.0, 9.0, old));
}

/** 1 on a landmark's own footprint — the platform, the mosque — where no house stands. */
float markFoot(vec2 p) {
  if (uMark.w < 0.5) return 0.0;
  vec2 q = p - uMark.xz;
  if (uMark.w > 1.5) return step(abs(q.x), 150.0) * step(abs(q.y), 245.0);
  return step(length(q), 250.0);
}

/** How much city there is here: thick along the camera's line, giving way to the groves on the hills round it. */
float cityAt(Land L, vec2 p) {
  return L.D.x * smoothstep(1500.0, 550.0, abs(L.side)) * (1.0 - markFoot(p));
}

/** A line d metres away, w wide, seen at fw metres a pixel: thinner than a pixel, it dims rather than flickers. */
float lineOf(float d, float w, float fw) {
  float W = max(w, fw);
  return smoothstep(W, W * 0.25, d) * (w / W);
}

float terrain(vec2 p, int oct, out Land L) {
  float st = strip(uS2, p.y).w;
  float side = p.x - pathX(p.y, st);
  float d = abs(side);
  float c = smoothstep(34.0, 240.0, d);
  float zw = p.y + (n2(p * 0.0013) - 0.5) * 260.0 * c;
  L.A = strip(uS0, zw);
  L.B = strip(uS1, zw);
  L.C = strip(uS2, zw);
  L.D = strip(uS3, zw);
  L.c = c;
  L.side = side;
  float base = floorOf(L.A, L.B, L.C) + undul(p.y) * (1.0 - L.A.x);
  float land = 1.0 - 0.88 * L.A.x;
  float relief = fbm(p * 0.0017, min(oct, 5)) * 30.0 * land * (1.0 - 0.6 * L.A.z);
  if (L.A.y > 0.01) {
    // The ridges for the mountains' bones; past five octaves their creases
    // only turn to scales, so the finer relief is a softer noise.
    float r = ridged(p * 0.00078 + 3.1, min(oct, 5));
    float soft = oct > 5 ? (fbm(p * 0.006 + 7.0, oct - 4) - 0.5) * 34.0 : 0.0;
    relief += (pow(r, 1.35) * 640.0 + soft * r) * L.A.y * smoothstep(60.0, 680.0, d);
  }
  if (L.A.z > 0.01) relief += dunes(p) * 32.0 * L.A.z;
  if (L.C.x > 0.01) relief += (fbm(p * 0.009, 3) - 0.38) * 9.0 * L.C.x;
  float shore = -L.A.w * 34.0 * smoothstep(-50.0, -650.0, side);
  float fine = (n2(p * 0.03) - 0.5) * 1.3 + (n2(p * 0.13) - 0.5) * 0.35;
  // The ground under the camera's line is never a floor: it swells and dips
  // a few metres, and the dunes cross it lower than they stand off it.
  float near = (fbm(p * 0.0045, min(oct, 4)) - 0.5) * 9.0 * land;
  if (L.A.z > 0.01) near += dunes(p) * 11.0 * L.A.z;
  float h = base + relief * c + near * (1.0 - c) + fine + shore;
  // A landmark stands on level ground of its own — for Jerusalem, the whole
  // walled Old City.
  if (uMark.w > 0.5) {
    float r = uMark.w > 1.5 ? 820.0 : 260.0;
    h = mix(h, uMark.y, smoothstep(r + 220.0, r, length(p - uMark.xz)));
  }
  // A city: its blocks stand a few storeys over the streets between them —
  // except on a landmark's own ground.
  float city = L.D.x * smoothstep(1500.0, 550.0, d) * (1.0 - markFoot(p));
  if (city > 0.05) {
    float built;
    float old = L.D.y;
    vec4 lot = cityLot(p, old, built);
    // An old house is two or three storeys of stone, and many have a small
    // dome on the roof — Jerusalem's own skyline.
    float storeys = mix(3.0 + 10.0 * lot.z * lot.z, 4.5 + 5.5 * lot.z, old);
    vec2 fc = lot.xy - 0.5;
    float roofDome = old * step(0.66, lot.w) * 2.2 * sqrt(max(0.0, 1.0 - 14.0 * dot(fc, fc)));
    // Seen from high up, a house is smaller than a pixel: the town is laid
    // as one even roofscape there, so it does not seethe as the camera moves.
    float sub = lotsUnseen(p, old);
    h += city * mix(built * (storeys + roofDome), mix(4.0, 5.2, old), sub);
  }
  return h;
}

float terrainH(vec2 p, int oct) {
  Land L;
  return terrain(p, oct, L);
}

// Palms, olives and orchard trees, on a jittered grid, where the strip says
// there are any. Only near: far off, a grove is a colour on the ground.
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}
/**
 * Date palms and orchard trees, on a jittered grid where the strip says there
 * are any — gathered into groves the way an oasis grows them, thinning to a
 * palm here and there between. "rel" is how far up the tree the point is,
 * for the shade its own crown casts.
 */
float trees(vec3 p, Land L, float h, out float kind, out float rel) {
  kind = 0.0;
  rel = 1.0;
  // None in a city's streets, and none on a landmark's own ground, which has
  // its own trees — the hill's groves would grow up through its paving.
  float dens = max(L.B.y, L.B.z) * (1.0 - cityAt(L, p.xz)) * (1.0 - markFoot(p.xz));
  if (dens < 0.05 || h < 0.9 || abs(L.side) < 9.0) return 1e5;
  const float S = 11.0;
  vec2 cell = floor(p.xz / S);
  vec2 r = hash2(cell);
  float grove = smoothstep(0.32, 0.72, n2(cell * 0.12 + 3.0));
  if (r.x > dens * (0.1 + 0.62 * grove)) return 1e5;
  vec2 jit = fract(r * vec2(13.7, 29.3));
  vec2 ctr = (cell + 0.18 + 0.64 * jit) * S;
  vec3 q = p - vec3(ctr.x, h - 0.3, ctr.y);
  bool palm = fract(r.y * 7.13) < L.B.z / (L.B.y + L.B.z + 1e-3);
  if (palm) {
    float H = 7.0 + 7.5 * fract(r.x * 31.7);
    vec2 lean = (vec2(fract(r.y * 17.3), fract(r.x * 5.1)) - 0.5) * 1.8;
    float s = clamp(q.y / H, 0.0, 1.0);
    // The trunk, leaning and curving a little as a palm's does.
    float trunk = length(q.xz - lean * s * s) - (0.34 - 0.1 * s);
    trunk = max(trunk, max(-q.y, q.y - H));
    // The fronds: nine of them, rising from the crown and arching down.
    vec3 k = q - vec3(lean.x, H, lean.y);
    float rr = length(k.xz);
    float sector = 6.2831853 / 9.0;
    float a = atan(k.z, k.x) + r.x * 6.2831853;
    float da = a - (floor(a / sector) + 0.5) * sector;
    vec2 f = vec2(rr * cos(da), rr * sin(da));
    float len = 4.6 + 1.2 * jit.x;
    float xc = clamp(f.x, 0.0, len);
    float yc = 0.42 * xc - 0.13 * xc * xc;
    float w = 0.1 + 0.9 * sin(3.14159 * xc / len);
    float frond = (length(vec2((k.y - yc) / 0.16, f.y / w)) - 1.0) * 0.16;
    frond = max(frond, abs(f.x - xc));
    float crown = min(frond, length(k) - 0.7);
    kind = crown < trunk ? 2.0 : 3.0;
    rel = kind > 2.5 ? 0.35 + 0.65 * s : 0.75 + 0.25 * clamp(xc / len, 0.0, 1.0);
    return min(trunk, crown) * 0.8;
  }
  // An olive, an orchard tree: a low crown of a few rounded masses.
  float H = 2.6 + 1.8 * jit.y;
  float R = 2.4 + 1.3 * jit.x;
  vec3 c1 = q - vec3(0.0, H + R * 0.45, 0.0);
  vec3 c2 = q - vec3(R * 0.55 * (jit.x - 0.5) * 2.0, H + R * 0.3, R * 0.5 * (jit.y - 0.5) * 2.0);
  float crown = min(length(c1 * vec3(1.0, 1.35, 1.0)) - R, length(c2 * vec3(1.0, 1.4, 1.0)) - R * 0.75);
  crown += (n3(q * 0.9 + r.x * 9.0) - 0.5) * 0.9;
  float trunk = sdCapsule(q, vec3(0.0), vec3(0.0, H + 0.6, 0.0), 0.28);
  kind = crown < trunk ? 1.0 : 3.0;
  rel = clamp((q.y - H * 0.6) / (R * 1.6), 0.0, 1.0) * 0.6 + 0.4;
  return min(trunk, crown * 0.6);
}

// ── the air ───────────────────────────────────────────────────────────────

const float RE = 6360e3;
const float RA = 6420e3;
const vec3 BR = vec3(5.8e-6, 13.5e-6, 33.1e-6);

vec2 sphere(vec3 ro, vec3 rd, float r) {
  float b = dot(ro, rd);
  float c = dot(ro, ro) - r * r;
  float h = b * b - c;
  if (h < 0.0) return vec2(-1.0);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}

vec3 scatter(vec3 rd, vec3 light, float intensity) {
  float bm = 21e-6 * (1.0 + uB.y * 3.0 + uA.y * 2.0);
  vec3 ro = vec3(0.0, RE + max(uCam.y, 2.0), 0.0);
  float tMax = sphere(ro, rd, RA).y;
  float seg = tMax / 8.0;
  vec3 sumR = vec3(0.0), sumM = vec3(0.0);
  float odR = 0.0, odM = 0.0;
  for (int i = 0; i < 8; i++) {
    vec3 p = ro + rd * (seg * (float(i) + 0.5));
    float h = length(p) - RE;
    float dR = exp(-h / 8000.0) * seg;
    float dM = exp(-h / 1200.0) * seg;
    odR += dR;
    odM += dM;
    float tl = sphere(p, light, RA).y;
    float segL = tl / 4.0;
    float lR = 0.0, lM = 0.0;
    bool lit = true;
    for (int j = 0; j < 4; j++) {
      vec3 q = p + light * (segL * (float(j) + 0.5));
      float hl = length(q) - RE;
      if (hl < 0.0) { lit = false; break; }
      lR += exp(-hl / 8000.0) * segL;
      lM += exp(-hl / 1200.0) * segL;
    }
    if (lit) {
      vec3 att = exp(-(BR * (odR + lR) + bm * 1.1 * (odM + lM)));
      sumR += att * dR;
      sumM += att * dM;
    }
  }
  float mu = dot(rd, light);
  float pr = 0.0597 * (1.0 + mu * mu);
  float g = 0.76;
  float pm = 0.1194 * ((1.0 - g * g) * (1.0 + mu * mu)) / ((2.0 + g * g) * pow(1.0 + g * g - 2.0 * g * mu, 1.5));
  return intensity * (sumR * BR * pr + sumM * bm * pm);
}

vec3 atmosphere(vec3 rd) {
  vec3 d = normalize(vec3(rd.x, max(rd.y, 0.004), rd.z));
  vec3 c = vec3(0.0);
  if (uSun.y > -0.32) c += scatter(d, uSun, uSunI);
  if (uMoonI > 0.0 && uMoon.y > -0.2) c += scatter(d, uMoon, uMoonI) * MOONTINT;
  // The faint glow of the night sky itself, so that a moonless night is a
  // deep blue and not a hole.
  c += vec3(0.0011, 0.0016, 0.0036) * (1.0 - 0.6 * d.y) * uC.w;
  return c;
}

// ── the lights of the sky ─────────────────────────────────────────────────

/** The Milky Way, along a great circle, with its lanes of dust: soft enough to draw at the world's resolution. */
vec3 milkyWay(vec3 rd) {
  vec3 q = turnAbout(uD.x) * rd;
  vec3 n = normalize(vec3(0.35, 0.55, 0.76));
  float b = dot(q, n);
  float band = exp(-b * b / 0.02);
  float cloud = fbm(q.xz * 6.0 + q.y * 3.0, 5);
  float dust = smoothstep(0.42, 0.7, fbm(q.zy * 11.0 + 4.0, 4));
  return vec3(0.55, 0.6, 0.78) * band * cloud * (1.0 - 0.8 * dust) * 0.006;
}

/** The glow the moon makes of the air around it. Its face is drawn in the finish, where it is sharp. */
vec3 moonHalo(vec3 rd) {
  float size = 0.0105 * uC.y;
  float ang = acos(clamp(dot(rd, uMoon), -1.0, 1.0));
  return uMoonCol * (0.006 * exp(-ang / (size * 5.0)) + 0.0015 * exp(-ang / (size * 22.0))) * (0.3 + 0.7 * uC.w);
}

vec3 sunDisc(vec3 rd) {
  float size = 0.0068 * uC.z;
  float ang = acos(clamp(dot(rd, uSun), -1.0, 1.0));
  float limb = clamp(1.0 - ang / size, 0.0, 1.0);
  return uSunCol * (smoothstep(0.0, 0.03, limb) * (0.6 + 0.4 * sqrt(limb)) * 520.0);
}

// ── clouds ────────────────────────────────────────────────────────────────

/*
 * The cloud's density. "detail" is how much of its finest structure is
 * wanted: all of it overhead, none of it towards the horizon, where it would
 * only shimmer between pixels. The finest layer fades to its own average, so
 * the cloud keeps its weight as it loses its grain.
 */
float cloudD(vec3 p, float detail) {
  float wind = 0.3 + uA.w;
  vec3 q = p * 0.00036 + vec3(uTime * 0.0045 * wind, 0.0, uTime * 0.0022);
  float n = n3(q) * 0.5 + n3(q * 2.03) * 0.25 + n3(q * 4.07) * 0.125;
  n += mix(0.03125, n3(q * 8.13) * 0.0625, detail);
  n /= 0.9375;
  float hgt = clamp((p.y - CB) / (CT - CB), 0.0, 1.0);
  float shape = smoothstep(0.0, 0.2, hgt) * smoothstep(1.0, 0.4, hgt);
  float cover = uA.x;
  return clamp((n - (1.02 - cover * 0.78)) * 2.3 * shape, 0.0, 1.0);
}

vec4 clouds(vec3 ro, vec3 rd, float tLimit, vec3 sky) {
  if (uA.x < 0.02) return vec4(0.0);
  float t0, t1;
  if (abs(rd.y) < 1e-3) return vec4(0.0);
  float a = (CB - ro.y) / rd.y;
  float b = (CT - ro.y) / rd.y;
  t0 = max(min(a, b), 0.0);
  t1 = min(max(a, b), min(tLimit, 90000.0));
  // Far off, a cloud is mostly the air in front of it: past forty kilometres
  // there is none to draw.
  if (t1 <= t0 || t0 > 42000.0) return vec4(0.0);
  // A ray that only grazes the layer would cross it in steps kilometres
  // apart, and neighbouring pixels would find unrelated cloud: so it is
  // marched only so far into it, in steps no longer than the cloud's grain.
  t1 = min(t1, t0 + 7000.0);
  int steps = int(uQ.y);
  float dt = (t1 - t0) / float(steps);
  float t = t0 + dt * 0.5;
  vec3 acc = vec3(0.0);
  float trans = 1.0;
  float mu = dot(rd, uSun);
  float phase = 0.6 * (1.0 / (4.0 * 3.14159)) * (1.0 - 0.36) / pow(1.36 - 1.2 * mu, 1.5) + 0.4 * 0.08;
  vec3 sunLight = uSunCol * max(uSun.y + 0.05, 0.0) * 7.0 + uMoonCol * 0.06;
  vec3 amb = sky * 0.9 + vec3(0.002, 0.003, 0.006);
  // Long strides through clear air; short steps once inside cloud, so its
  // edge is found where it is and not wherever a stride happened to land.
  float fineLeft = 0.0;
  for (int i = 0; i < 96; i++) {
    if (i >= steps * 3 || t > t1 || trans < 0.03) break;
    vec3 p = ro + rd * t;
    float detail = smoothstep(22000.0, 3500.0, t);
    float d = cloudD(p, detail);
    if (d > 0.005 && fineLeft <= 0.0) {
      // Just found it: back up a stride and come in again slowly.
      fineLeft = 8.0;
      t = max(t0, t - dt * 0.75);
      continue;
    }
    float fine = dt * 0.25;
    if (d > 0.005) {
      float l1 = cloudD(p + uSun * 140.0, 0.0);
      float l2 = cloudD(p + uSun * 420.0, 0.0);
      float shadow = exp(-(l1 + l2) * 3.0);
      float hgt = clamp((p.y - CB) / (CT - CB), 0.0, 1.0);
      vec3 col = sunLight * shadow * phase * 6.0 + amb * (0.35 + 0.65 * hgt);
      col *= 1.0 - 0.75 * uA.y;
      col += vec3(0.75, 0.8, 1.0) * uA.z * 2.6 * (0.4 + 0.6 * (1.0 - hgt));
      float absorb = exp(-d * fine * 0.0042);
      acc += trans * (1.0 - absorb) * col;
      trans *= absorb;
      fineLeft = 8.0;
    } else {
      // Out of it again: a few short steps more, then stride on.
      fineLeft -= 1.0;
    }
    t += fineLeft > 0.0 ? fine : dt;
  }
  // The air between the eye and the cloud.
  float air = 1.0 - exp(-t0 * 0.00006);
  acc = mix(acc, sky * (1.0 - trans), air);
  float fade = smoothstep(42000.0, 18000.0, t0);
  return vec4(acc, 1.0 - trans) * fade;
}

// ── fog, and the sea ──────────────────────────────────────────────────────

float fogAmount(vec3 ro, vec3 rd, float t) {
  float a = 0.000055 + uB.y * 0.00026 + uA.y * 0.0007 + uA.x * 0.00005;
  float b = 0.0012;
  float k = rd.y * b;
  float f = a * exp(-max(ro.y, 0.0) * b) * (abs(k) > 1e-6 ? (1.0 - exp(-t * k)) / k : t);
  return 1.0 - exp(-f);
}

vec3 waveNormal(vec2 p, float t) {
  float w = 0.25 + uA.w * 1.4;
  vec2 g = vec2(0.0);
  vec2 dirs[4] = vec2[4](vec2(0.9, 0.43), vec2(-0.6, 0.8), vec2(0.2, -0.98), vec2(-0.85, -0.5));
  float freqs[4] = float[4](0.045, 0.08, 0.15, 0.31);
  for (int i = 0; i < 4; i++) {
    float ph = dot(p, dirs[i]) * freqs[i] + uTime * (0.7 + float(i) * 0.45);
    g += dirs[i] * cos(ph) * freqs[i] * (1.6 / (1.0 + float(i)));
  }
  vec2 e = vec2(0.6, 0.0);
  vec2 q = p * 0.35 + uTime * vec2(0.4, 0.2);
  float n0 = n2(q);
  g += vec2(n2(q + e.xy) - n0, n2(q + e.yx) - n0) * (0.6 + 0.9 * smoothstep(8.0, 60.0, t));
  float fade = 1.0 / (1.0 + t * 0.0016);
  g *= w * fade;
  return normalize(vec3(-g.x, 1.0, -g.y));
}

// ── shading the ground ────────────────────────────────────────────────────

float shadowTo(vec3 p, vec3 l) {
  if (l.y < 0.0) return 0.0;
  float res = 1.0;
  float t = 3.0;
  int steps = int(uQ.z);
  for (int i = 0; i < 40; i++) {
    if (i >= steps) break;
    vec3 q = p + l * t;
    if (q.y > 900.0) break;
    float h = q.y - terrainH(q.xz, 4);
    res = min(res, 9.0 * h / t);
    if (res < 0.02) break;
    t += clamp(h * 0.7, 4.0, 160.0);
  }
  return clamp(res, 0.0, 1.0);
}

float cloudShadow(vec3 p) {
  if (uA.x < 0.05) return 1.0;
  vec3 q = p + uSun * ((CB + 500.0 - p.y) / max(uSun.y, 0.08));
  return 1.0 - 0.8 * smoothstep(0.1, 0.5, cloudD(vec3(q.x, CB + 520.0, q.z), 0.0));
}

vec3 groundColour(vec3 p, vec3 n, Land L, float kind) {
  float slope = 1.0 - n.y;
  float revive = uB.z;
  float dry = uB.w;
  float dist = length(p - uCam);
  float detail = smoothstep(1800.0, 150.0, dist);
  vec3 sand = mix(vec3(0.58, 0.42, 0.27), vec3(0.68, 0.52, 0.35), n2(p.xz * 0.004));
  sand *= 0.86 + 0.28 * mix(0.5, n2(p.xz * 0.05) * 0.7 + n2(p.xz * 0.6) * 0.3, detail);
  // Rock streaked down its fall line, as weathered granite is.
  vec2 fall = normalize(n.xz + 1e-4);
  vec2 along = vec2(dot(p.xz, fall), dot(p.xz, vec2(-fall.y, fall.x)));
  float streak = n2(vec2(along.x * 0.02, along.y * 0.25)) * 0.6 + n2(p.xz * 0.013 + 5.0) * 0.4;
  vec3 rock = mix(vec3(0.3, 0.23, 0.18), vec3(0.47, 0.35, 0.26), streak);
  vec3 col = sand;
  float rocky = smoothstep(0.22, 0.5, slope) + L.A.y * smoothstep(0.08, 0.28, slope);
  col = mix(col, rock, clamp(rocky, 0.0, 1.0));
  // Tracks white and red in the mountains, and jet black (35:27).
  if (L.C.z > 0.01) {
    float band = fract(p.y * 0.0125 + n2(p.xz * 0.003) * 1.4);
    vec3 strata = band < 0.33 ? vec3(0.86, 0.83, 0.78) : band < 0.66 ? vec3(0.62, 0.24, 0.14) : vec3(0.06, 0.055, 0.05);
    col = mix(col, strata, L.C.z * smoothstep(0.1, 0.35, slope + L.A.y * 0.2));
  }
  // The harrah: black basalt.
  col = mix(col, vec3(0.075, 0.068, 0.062) * (0.8 + 0.4 * n2(p.xz * 0.05)), L.C.x * 0.92);
  // What grows: the fields, greening as the earth is revived, yellowing as it dries.
  vec3 grass = mix(vec3(0.09, 0.2, 0.045), vec3(0.17, 0.3, 0.07), n2(p.xz * 0.02));
  grass = mix(grass, vec3(0.52, 0.42, 0.17), dry);
  float wet = smoothstep(5.0, 0.6, p.y) * (L.B.w + 0.4 * L.A.w);
  float grow = clamp(L.B.x * revive * 1.25 + wet * 0.8 + (L.B.y + L.B.z) * 0.35, 0.0, 1.0);
  grow *= smoothstep(0.42, 0.12, slope) * smoothstep(0.4, 1.4, p.y);
  float patches = smoothstep(0.3, 0.6, n2(p.xz * 0.012) + 0.3 * n2(p.xz * 0.07));
  col = mix(col, grass, grow * mix(0.55, 1.0, patches));
  // A grove, seen from far off: the canopy as a colour.
  float canopy = clamp((L.B.y + L.B.z) * 0.9, 0.0, 1.0) * smoothstep(0.3, 0.1, slope) * L.c;
  col = mix(col, mix(vec3(0.06, 0.12, 0.035), vec3(0.3, 0.27, 0.12), dry) , canopy * 0.55 * smoothstep(250.0, 900.0, length(p - uCam)));
  // Stones, and the scrub of the desert — acacia and tamarisk — scattered over the open ground.
  // Turned and warped off the noise's own grid, or the stones fall into rows.
  vec2 sp2 = mat2(0.8, -0.6, 0.6, 0.8) * p.xz;
  sp2 += (vec2(n2(p.xz * 0.04), n2(p.xz * 0.04 + 9.0)) - 0.5) * 18.0;
  float stones = smoothstep(0.74, 0.86, n2(sp2 * 0.31)) * detail * smoothstep(0.4, 0.15, slope);
  col *= 1.0 - 0.38 * stones * (1.0 - L.C.x);
  float scrub = smoothstep(0.8, 0.9, n2(sp2 * 0.055 + 17.0)) * smoothstep(0.35, 0.1, slope) * (1.0 - 0.8 * L.A.y) * smoothstep(0.8, 2.5, p.y);
  col = mix(col, mix(vec3(0.12, 0.13, 0.06), vec3(0.2, 0.16, 0.08), dry), scrub * 0.75 * (0.6 + 0.4 * revive));
  // A city by day: roofs of pale stone, the streets between them in shade.
  float city = cityAt(L, p.xz);
  if (city > 0.02) {
    float built;
    float old = L.D.y;
    vec4 lot = cityLot(p.xz, old, built);
    // New roofs of concrete; old ones of the pale gold limestone the city is built of.
    vec3 roofs = mix(vec3(0.58, 0.54, 0.47), vec3(0.72, 0.68, 0.6), lot.w);
    // (At night an old town's stone roofs are dark: its light is in its lanes.)
    roofs = mix(roofs, mix(vec3(0.66, 0.58, 0.45), vec3(0.78, 0.7, 0.55), lot.z) * (1.0 - 0.75 * uC.w), old);
    roofs *= 0.88 + 0.24 * n2(p.xz * 0.9);
    vec3 lots = mix(vec3(0.26, 0.24, 0.21), roofs, built);
    // Far off, the lots are a single even colour: their own mean.
    vec3 even = mix(vec3(0.26, 0.24, 0.21), mix(vec3(0.65, 0.61, 0.53), vec3(0.72, 0.64, 0.5) * (1.0 - 0.75 * uC.w), old), 0.62);
    col = mix(col, mix(lots, even, lotsUnseen(p.xz, old)), city * 0.95);
  }
  // Wet sand at the water's edge.
  col = mix(col, col * 0.55, smoothstep(1.4, 0.2, p.y) * (1.0 - L.C.x));
  // The trees themselves: palm fronds a dark yellow-green, olive leaves a
  // grey-green, the trunks the brown of the fibre on them.
  if (kind > 0.5) {
    vec3 leaf = kind > 1.5 && kind < 2.5 ? vec3(0.1, 0.15, 0.045) : vec3(0.16, 0.19, 0.11);
    if (kind > 2.5) leaf = vec3(0.17, 0.12, 0.08);
    leaf *= 0.85 + 0.3 * n2(p.xz * 1.7 + p.y);
    col = mix(leaf, vec3(0.38, 0.32, 0.15), dry * 0.55);
  }
  // Rain darkens everything it falls on.
  col *= 1.0 - 0.32 * uA.y;
  return col;
}

// ── landmarks ─────────────────────────────────────────────────────────────

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}
float sdCyl(vec3 p, float r, float h) {
  vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}
/** An octagonal prism standing upright: r its inradius, h its half height. */
float sdOct(vec3 p, float r, float h) {
  const vec3 k = vec3(-0.9238795325, 0.3826834323, 0.4142135623);
  vec3 q = abs(vec3(p.x, p.z, p.y));
  q.xy -= 2.0 * min(dot(vec2(k.x, k.y), q.xy), 0.0) * vec2(k.x, k.y);
  q.xy -= 2.0 * min(dot(vec2(-k.x, k.y), q.xy), 0.0) * vec2(-k.x, k.y);
  q.xy -= vec2(clamp(q.x, -k.z * r, k.z * r), r);
  vec2 d = vec2(length(q.xy) * sign(q.y), q.z - h);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

/*
 * The Noble Sanctuary's trees, at most one to a 21-metre square: most along
 * the platform's edges, a few out in the open, none on the terrace or before
 * the mosque. x, y where it stands; z its crown's reach; w what it is — 1 an
 * olive, low and round; 2 an umbrella pine, a broad crown on a bare trunk;
 * 3 a cypress, a dark flame. 0, no tree.
 */
vec4 sanctTree(vec2 p) {
  vec2 tc = floor(p / 21.0);
  vec4 th = texelFetch(uNoise, ivec2(mod(tc + 13.0, 256.0)), 0);
  vec2 c = (tc + 0.26 + 0.48 * th.zw) * 21.0;
  float rim = min(132.0 - abs(c.x), 226.0 - abs(c.y));
  bool stands = th.x > mix(0.42, 0.92, smoothstep(10.0, 34.0, rim)) && rim > 3.0
    && length(c - vec2(0.0, -35.0)) > 84.0 && !(abs(c.x) < 40.0 && abs(c.y - 200.0) < 52.0);
  if (!stands) return vec4(0.0);
  float kind = th.y > 0.7 ? 3.0 : th.y > 0.5 ? 2.0 : 1.0;
  float r = kind > 2.5 ? 1.7 : kind > 1.5 ? 3.2 + 0.9 * th.z : 2.7 + 0.8 * th.w;
  return vec4(c, r, kind);
}

/*
 * The Noble Sanctuary in Jerusalem, at its own scale in metres, north along
 * -z in its own frame: the platform on its walls; a little north of its
 * middle, on a raised terrace, the Dome of the Rock — octagon, drum, and the
 * gold dome — and beside it to the east the small Dome of the Chain; at its
 * south end al-Masjid al-Aqsa, its porch of seven arches, its hall and its
 * grey dome over the qibla; its four minarets on the edges; and the walls of
 * the Old City about it on the west and the north. (The world has north
 * along +z, as the camera came up from Makkah: the caller turns it round.)
 */
float sanctuary(vec3 p, out float m) {
  float d = sdBox(p - vec3(0.0, 2.5, 0.0), vec3(140.0, 5.0, 235.0));
  m = 10.0;
  // The Old City's walls, the sanctuary in their south-east corner, with
  // their battlements.
  vec3 w = p - vec3(355.0, 6.0, -212.0);
  float walls = max(sdBox(w, vec3(500.0, 6.0, 452.0)), -sdBox(w, vec3(495.0, 60.0, 447.0)));
  walls = max(walls, -sdBox(vec3(fract((p.x + p.z) / 3.0) - 0.5, p.y - 12.2, 0.0), vec3(0.22, 0.9, 1e3)));
  if (walls < d) { d = walls; m = 16.0; }
  // The trees. A ray is not let step from one square into the next past
  // the edge between them, or it would land inside a crown it never saw.
  if (p.y < 24.0 && abs(p.x) < 140.0 && abs(p.z) < 235.0) {
    vec4 tr = sanctTree(p.xz);
    if (tr.w > 0.5) {
      vec3 tp = p - vec3(tr.x, 7.5, tr.y);
      float lump = (n2(p.xz * 0.8 + p.y * 0.6) - 0.5) * 0.9;
      float tree;
      if (tr.w > 2.5) tree = (length((tp - vec3(0.0, 8.0, 0.0)) * vec3(1.0, 0.22, 1.0)) - tr.z) * 0.95;
      else if (tr.w > 1.5) {
        // An umbrella pine's crown is not one round mass but a few, clumped.
        vec2 o = (vec2(n2(tr.xy * 0.37), n2(tr.xy * 0.37 + 4.0)) - 0.5) * tr.z * 0.9;
        vec3 sq = vec3(1.0, 2.0, 1.0);
        float r3 = tr.z * 0.62;
        tree = min(length((tp - vec3(o.x, 10.3, o.y)) * sq) - r3,
               min(length((tp - vec3(-o.y - 0.3 * tr.z, 9.8, o.x)) * sq) - r3,
                   length((tp - vec3(o.y, 9.6, -o.x - 0.3 * tr.z)) * sq) - r3)) / 2.0;
        tree = min(tree, sdCapsule(tp, vec3(0.0), vec3(0.0, 9.6, 0.0), 0.35));
      }
      else tree = (length((tp - vec3(0.0, 3.4, 0.0)) * vec3(1.0, 1.25, 1.0)) - tr.z) / 1.25;
      tree = (tree + lump) * 0.6;
      if (tree < d) { d = tree; m = 17.0; }
    }
    vec2 f = fract(p.xz / 21.0) * 21.0;
    d = min(d, min(min(f.x, 21.0 - f.x), min(f.y, 21.0 - f.y)) + 1.0);
  }
  vec3 q = p - vec3(0.0, 7.5, -35.0);
  float terrace = sdBox(q - vec3(0.0, 1.2, 0.0), vec3(72.0, 1.2, 72.0));
  if (terrace < d) { d = terrace; m = 10.0; }
  float oct = sdOct(q - vec3(0.0, 9.0, 0.0), 25.0, 6.6);
  if (oct < d) { d = oct; m = 11.0; }
  float drum = sdCyl(q - vec3(0.0, 19.6, 0.0), 12.0, 4.2);
  if (drum < d) { d = drum; m = 12.0; }
  vec3 dq = q - vec3(0.0, 23.6, 0.0);
  float dome = max(length(dq * vec3(1.0, 0.85, 1.0)) - 11.8, -dq.y);
  dome = min(dome, sdCapsule(q, vec3(0.0, 35.0, 0.0), vec3(0.0, 39.5, 0.0), 0.4));
  if (dome < d) { d = dome; m = 13.0; }
  // The Dome of the Chain: a ring of columns under a small dome, east of the Rock.
  vec3 cq = q - vec3(-38.0, 2.4, 0.0);
  float chain = sdCyl(cq - vec3(0.0, 2.4, 0.0), 6.6, 2.4);
  if (chain < d) { d = chain; m = 18.0; }
  float chainDome = max(length(cq - vec3(0.0, 4.8, 0.0)) - 3.9, 4.8 - cq.y);
  if (chainDome < d) { d = chainDome; m = 15.0; }
  // al-Masjid al-Aqsa: its hall, a raised nave down the middle under a
  // pitched roof, and across its north front a porch of seven arches.
  vec3 a = p - vec3(0.0, 7.5, 200.0);
  float hall = sdBox(a - vec3(0.0, 6.5, 2.0), vec3(27.0, 6.5, 38.0));
  float nave = max(sdBox(a - vec3(0.0, 14.0, 0.0), vec3(9.0, 3.0, 36.0)), abs(a.x) * 0.45 + a.y - 18.0);
  hall = min(hall, nave);
  vec3 ar = a - vec3(0.0, 0.0, -38.5);
  float bay = 54.0 / 7.0;
  vec2 ap = vec2(ar.x - bay * clamp(floor(ar.x / bay + 0.5), -3.0, 3.0), ar.y - 4.2);
  float arch = ap.y < 0.0 ? max(abs(ap.x) - 2.5, -ap.y - 4.2) : length(ap) - 2.5;
  float porch = max(sdBox(ar - vec3(0.0, 5.0, 0.0), vec3(27.0, 5.0, 3.5)), -max(arch, abs(ar.z) - 3.7));
  hall = min(hall, porch);
  if (hall < d) { d = hall; m = 14.0; }
  // Its dome stands at the south end, over the qibla, on a drum.
  float adrum = sdCyl(a - vec3(0.0, 14.5, 27.0), 9.2, 2.0);
  if (adrum < d) { d = adrum; m = 14.0; }
  vec3 ad = a - vec3(0.0, 16.5, 27.0);
  float adome = max(length(ad * vec3(1.0, 1.15, 1.0)) - 8.8, -ad.y);
  if (adome < d) { d = adome; m = 15.0; }
  // The four minarets on the sanctuary's edges, floodlit: three square, of
  // the Mamluks — at the north-west corner, at the Chain Gate, at the
  // south-west corner — and a round one at the Gate of the Tribes.
  if (abs(p.x) > 70.0 || abs(p.z) > 160.0) {
    const vec4 mins[4] = vec4[4](vec4(128.0, -226.0, 38.0, 0.0), vec4(-95.0, -231.0, 30.0, 1.0),
                                 vec4(137.0, 62.0, 36.0, 0.0), vec4(133.0, 226.0, 24.0, 0.0));
    for (int i = ZERO; i < 4; i++) {
      vec3 mq = p - vec3(mins[i].x, 7.5, mins[i].y);
      float H = mins[i].z;
      bool isRound = mins[i].w > 0.5;
      float shaft = isRound ? sdCyl(mq - vec3(0.0, (H - 5.0) * 0.5, 0.0), 2.6, (H - 5.0) * 0.5)
                          : sdBox(mq - vec3(0.0, (H - 5.0) * 0.5, 0.0), vec3(3.1, (H - 5.0) * 0.5, 3.1));
      float gallery = isRound ? sdCyl(mq - vec3(0.0, H - 9.0, 0.0), 3.5, 0.5) : sdBox(mq - vec3(0.0, H - 9.0, 0.0), vec3(3.9, 0.5, 3.9));
      float body = min(shaft, gallery);
      if (body < d) { d = body; m = 18.0; }
      float cap = min(max(length(mq - vec3(0.0, H - 5.0, 0.0)) - 2.4, H - 5.0 - mq.y),
                      sdCapsule(mq, vec3(0.0, H - 3.0, 0.0), vec3(0.0, H + 0.5, 0.0), 0.18));
      if (cap < d) { d = cap; m = 19.0; }
    }
  }
  return d;
}

/*
 * al-Masjid al-Haram as it is seen from above at night: the white floor round
 * the Ka'bah, the colonnade in a ring about it, the courtyards and storeys
 * beyond — and at the centre the Ka'bah, dark, with its band of gold.
 */
float haramShape(vec3 p, out float m) {
  // The mataf: the white floor round the Ka'bah.
  float d = sdCyl(p - vec3(0.0, 0.15, 0.0), 64.0, 0.15);
  m = 20.0;
  // The courts about it, marble too, open to the sky.
  float court = min(sdBox(p - vec3(0.0, 0.05, 0.0), vec3(107.0, 0.05, 107.0)),
                    min(sdBox(p - vec3(-120.0, 0.05, 150.0), vec3(55.0, 0.05, 30.0)), sdBox(p - vec3(140.0, 0.05, -150.0), vec3(50.0, 0.05, 28.0))));
  if (court < d) { d = court; m = 28.0; }
  // The Ka'bah.
  float kaaba = sdBox(p - vec3(0.0, 7.0, 0.0), vec3(5.9, 7.0, 6.4));
  if (kaaba < d) { d = kaaba; m = 21.0; }
  // The Hijr of Isma'il: the low white wall in a half-circle on its north side.
  vec3 hq = p - vec3(-0.5, 0.65, -8.5);
  float hijr = max(max(abs(length(hq.xz) - 7.4) - 0.7, abs(hq.y) - 0.65), hq.z);
  if (hijr < d) { d = hijr; m = 26.0; }
  // The Maqam of Ibrahim: a small gilded shrine before the door.
  float maqam = sdCyl(p - vec3(4.5, 1.2, 11.5), 0.9, 1.2);
  if (maqam < d) { d = maqam; m = 27.0; }
  // The old portico round the mataf, roofed bay by bay with small domes.
  float rr = length(p.xz);
  float riwaq = max(abs(rr - 84.0) - 11.0, abs(p.y - 5.0) - 5.0);
  if (riwaq < d) { d = riwaq; m = 22.0; }
  if (rr > 70.0 && rr < 98.0 && p.y < 14.0) {
    float ang = atan(p.z, p.x);
    for (int ring = 0; ring < 2; ring++) {
      float R = ring == 0 ? 78.5 : 89.5;
      float n = ring == 0 ? 96.0 : 112.0;
      float a = (floor(ang / 6.2831853 * n) + 0.5) / n * 6.2831853;
      float dome = max(length(p - vec3(cos(a) * R, 10.0, sin(a) * R)) - 2.6, 10.0 - p.y);
      if (dome < d) { d = dome; m = 23.0; }
    }
  }
  // The newer storeys about it, with courts open to the sky in them.
  // (The courts are cut with boxes far taller than the building: cut flush,
  // the distance just over the roofline falls to nothing, and the open court
  // reads to the ray as a lid.)
  float outer = max(sdBox(p - vec3(0.0, 15.0, 0.0), vec3(230.0, 15.0, 200.0)), -sdBox(p - vec3(0.0, 15.0, 0.0), vec3(108.0, 60.0, 108.0)));
  outer = max(outer, -sdBox(p - vec3(-120.0, 15.0, 150.0), vec3(55.0, 60.0, 30.0)));
  outer = max(outer, -sdBox(p - vec3(140.0, 15.0, -150.0), vec3(50.0, 60.0, 28.0)));
  if (outer < d) { d = outer; m = 22.0; }
  // The minarets, tall and slender, at the corners and the great gates.
  if (abs(p.x) > 200.0 || abs(p.z) > 170.0) {
    vec2 spots[8] = vec2[8](vec2(-230.0, -200.0), vec2(230.0, -200.0), vec2(-230.0, 200.0), vec2(230.0, 200.0),
      vec2(0.0, -200.0), vec2(-30.0, 200.0), vec2(-230.0, 0.0), vec2(230.0, 30.0));
    for (int i = 0; i < 8; i++) {
      vec3 mq = p - vec3(spots[i].x, 0.0, spots[i].y);
      float shaft = sdCyl(mq - vec3(0.0, 56.0, 0.0), 3.4 - 0.012 * clamp(mq.y, 0.0, 112.0), 56.0);
      if (shaft < d) { d = shaft; m = 24.0; }
      float lamp = length(mq - vec3(0.0, 115.0, 0.0)) - 2.3;
      if (lamp < d) { d = lamp; m = 25.0; }
    }
  }
  return d;
}

float landmark(vec3 p, out float m) {
  m = 0.0;
  // The sanctuary is drawn with its north along -z; the world's north is +z.
  return uMark.w > 1.5 ? sanctuary(vec3(-p.x, p.y, -p.z), m) : haramShape(p, m);
}

/** How far out a landmark reaches, and how high: the bounds it is looked for within. */
vec2 markReach() {
  return uMark.w > 1.5 ? vec2(1050.0, 56.0) : vec2(330.0, 125.0);
}

/** A landmark's own colour, and the light it gives at night from its floodlights. */
vec3 markColour(float m, vec3 q, vec3 n, out vec3 glow) {
  float dark = uC.w;
  if (uMark.w > 1.5) {
    q.xz = -q.xz;
    n.xz = -n.xz;
  }
  vec3 c = vec3(0.76, 0.68, 0.54) * (0.85 + 0.25 * n2(q.xz * 0.4));
  // The platform's paving, its lamps in rows, and the warm pool each throws.
  vec2 lg = abs(fract(q.xz / 28.0) - 0.5) * 28.0;
  glow = vec3(1.0, 0.8, 0.52) * (0.012 + 0.03 * exp(-dot(lg, lg) / 60.0) + 0.12 * smoothstep(1.4, 0.0, length(lg)));
  if (uMark.w > 1.5 && m < 10.5 && q.y < 7.8) {
    // The shade of a tree on the paving: the lamps' light kept off it.
    vec4 tr = sanctTree(q.xz);
    if (tr.w > 0.5) {
      float shade = smoothstep(tr.z + 0.6, tr.z * 0.4, length(q.xz - tr.xy)) * (tr.w > 2.5 ? 0.5 : 0.85);
      glow *= 1.0 - 0.3 * shade;
      c *= 1.0 - 0.2 * shade;
    }
  }
  if (m > 10.5 && m < 11.5) {
    // The octagon: marble below; blue and green tile above, and in each of
    // its eight faces seven arched windows, lit from within.
    vec3 r = q - vec3(0.0, 7.5, -35.0);
    float ang = atan(r.z, r.x) / 6.2831853 * 8.0;
    float along = fract(ang) * 7.0;
    float arch = step(0.25, fract(along)) * step(fract(along), 0.75);
    float win = arch * step(abs(r.y - 12.6), 2.2);
    bool tile = r.y > 10.5;
    c = tile ? mix(vec3(0.07, 0.26, 0.5), vec3(0.09, 0.35, 0.42), n2(q.xy * 1.5)) : vec3(0.84, 0.82, 0.77);
    c *= 1.0 - 0.55 * win;
    glow = vec3(0.4, 0.58, 0.95) * 0.02 + vec3(1.0, 0.78, 0.48) * win * 0.09;
  } else if (m > 11.5 && m < 12.5) {
    // The drum, its sixteen windows lit.
    vec3 r = q - vec3(0.0, 27.1, -35.0);
    float win = step(0.35, fract(atan(r.z, r.x) / 6.2831853 * 16.0)) * step(fract(atan(r.z, r.x) / 6.2831853 * 16.0), 0.65) * step(abs(r.y), 1.8);
    c = mix(vec3(0.09, 0.28, 0.52), vec3(0.02), win);
    glow = vec3(0.4, 0.58, 0.95) * 0.018 + vec3(1.0, 0.75, 0.42) * win * 0.12;
  } else if (m > 12.5 && m < 13.5) {
    // The dome: gold, its ribs catching the light.
    vec3 r = q - vec3(0.0, 31.1, -35.0);
    float rib = 0.85 + 0.15 * smoothstep(0.3, 0.0, abs(fract(atan(r.z, r.x) / 6.2831853 * 32.0) - 0.5));
    c = vec3(0.96, 0.72, 0.28) * rib;
    glow = vec3(1.0, 0.72, 0.3) * (0.08 + 0.05 * smoothstep(-0.2, 0.9, n.y)) * rib;
  } else if (m > 15.5 && m < 16.5) {
    // The walls of the Old City, in their pale stone, floodlit.
    c = vec3(0.78, 0.7, 0.56) * (0.85 + 0.25 * n2(q.xz * 0.2 + q.y));
    glow = vec3(1.0, 0.78, 0.48) * 0.035;
  } else if (m > 16.5 && m < 17.5) {
    // An olive's leaves grey-green, a pine's darker, a cypress all but black;
    // each lit from beneath by the lamps on the paving, its crown's underside
    // the warmest.
    float kind = sanctTree(q.xz).w;
    vec3 leaf = kind > 2.5 ? vec3(0.04, 0.075, 0.035) : kind > 1.5 ? vec3(0.075, 0.115, 0.055) : vec3(0.11, 0.125, 0.09);
    c = leaf * (0.75 + 0.5 * n2(q.xz * 1.6 + q.y * 1.3));
    float under = clamp(0.3 - n.y, 0.0, 1.0);
    glow = c * vec3(1.0, 0.88, 0.62) * (0.4 + 0.55 * under) * (0.75 + 0.5 * n2(q.xz * 2.1 + q.y));
  } else if (m > 13.5 && m < 14.5) {
    // al-Aqsa's stone, and the lamps within its porch.
    c = vec3(0.74, 0.68, 0.57) * (0.9 + 0.2 * n2(q.xz * 0.5 + q.y));
    glow = vec3(1.0, 0.86, 0.6) * 0.022;
    vec3 a = q - vec3(0.0, 7.5, 200.0);
    float bay = 54.0 / 7.0;
    float ax = a.x - bay * clamp(floor(a.x / bay + 0.5), -3.0, 3.0);
    float inPorch = step(-41.9, a.z) * step(a.z, -35.9) * step(abs(ax), 2.6) * step(a.y, 6.8);
    glow += vec3(1.0, 0.78, 0.46) * 0.16 * inPorch;
  } else if (m > 14.5 && m < 15.5) {
    // A dome of lead, silver-grey, with its ribs.
    vec3 r = q - vec3(0.0, 24.0, 227.0);
    float rib = 0.88 + 0.12 * smoothstep(0.25, 0.0, abs(fract(atan(r.z, r.x) / 6.2831853 * 24.0) - 0.5));
    c = vec3(0.5, 0.53, 0.56) * rib;
    glow = vec3(0.82, 0.88, 0.98) * 0.03 * rib;
  } else if (m > 17.5 && m < 18.5) {
    // The minarets' stone (and the Dome of the Chain's), floodlit from the
    // foot; and over each minaret's gallery its lantern, lit.
    c = vec3(0.8, 0.73, 0.6) * (0.88 + 0.24 * n2(q.xz * 0.7 + q.y * 0.5));
    float H = q.x > 0.0 ? (q.z < -100.0 ? 38.0 : q.z < 150.0 ? 36.0 : 24.0) : 30.0;
    float above = q.y - 7.5 - (H - 9.0);
    float lantern = step(0.5, above) * step(above, 3.2) * step(abs(n.y), 0.5);
    glow = vec3(1.0, 0.82, 0.55) * (0.03 + 0.05 * smoothstep(24.0, 8.0, q.y)) + vec3(1.0, 0.8, 0.5) * 0.22 * lantern;
  } else if (m > 18.5 && m < 19.5) {
    c = vec3(0.5, 0.52, 0.54);
    glow = vec3(0.85, 0.9, 1.0) * 0.03;
  } else if (m > 19.5 && m < 20.5) {
    // The mataf, the brightest thing in the valley.
    c = vec3(0.96, 0.96, 0.94);
    glow = vec3(0.96, 0.97, 1.0) * 0.42;
  } else if (m > 20.5 && m < 21.5) {
    bool band = q.y > 9.0 && q.y < 10.3;
    c = band ? vec3(0.78, 0.6, 0.26) : vec3(0.012);
    glow = band ? vec3(1.0, 0.8, 0.4) * 0.05 : vec3(0.0);
  } else if (m > 21.5 && m < 22.5) {
    // The storeys: pale stone, their arcades lit from within, their roofs set with lamps.
    c = vec3(0.86, 0.84, 0.8);
    if (n.y > 0.7) {
      vec2 rl = abs(fract(q.xz / 16.0) - 0.5) * 16.0;
      glow = vec3(1.0, 0.88, 0.7) * (0.028 + 0.32 * smoothstep(1.1, 0.0, length(rl)));
    } else {
      float run = abs(n.x) > abs(n.z) ? q.z : q.x;
      float arch = step(0.22, fract(run / 5.5)) * step(fract(run / 5.5), 0.78) * step(0.3, fract(q.y / 6.0)) * step(fract(q.y / 6.0), 0.85);
      c *= 1.0 - 0.4 * arch;
      glow = vec3(1.0, 0.86, 0.64) * (0.05 + 0.2 * arch);
    }
  } else if (m > 22.5 && m < 23.5) {
    c = vec3(0.6, 0.6, 0.62);
    glow = vec3(1.0, 0.84, 0.58) * 0.05;
  } else if (m > 23.5 && m < 24.5) {
    c = vec3(0.88, 0.86, 0.8);
    glow = vec3(1.0, 0.92, 0.8) * (0.08 + 0.18 * step(0.92, fract(q.y / 18.0)));
  } else if (m > 24.5 && m < 25.5) {
    c = vec3(0.6, 1.0, 0.7);
    glow = vec3(0.25, 1.0, 0.45) * 0.9;
  } else if (m > 25.5 && m < 26.5) {
    c = vec3(0.95, 0.95, 0.93);
    glow = vec3(0.96, 0.97, 1.0) * 0.35;
  } else if (m > 26.5 && m < 27.5) {
    c = vec3(0.95, 0.76, 0.32);
    glow = vec3(1.0, 0.8, 0.4) * 0.18;
  } else if (m > 27.5) {
    c = vec3(0.9, 0.9, 0.88);
    glow = vec3(1.0, 0.93, 0.82) * 0.13;
  }
  glow *= dark;
  return c;
}

// ── cities at night ───────────────────────────────────────────────────────

/*
 * A city's lights at night. Arterial roads in sodium orange on a loose grid
 * turned off the compass; streets between them; and the windows and
 * courtyards of its houses — a point to each lot when near, an even glow when
 * far, so that nothing flickers between pixels as the camera moves. Bright
 * and dim quarters, and next to none on the steep mountainsides. fw is how
 * many metres a pixel spans there; level is 1 on level ground.
 */
vec3 cityGlow(vec3 p, float city, float old, float fw, float level) {
  if (city < 0.02) return vec3(0.0);
  float quarter = 0.3 + 0.95 * fbm(p.xz * 0.0012 + 2.0, 3);
  float dens = city * mix(0.06, 1.0, level) * quarter;
  // The roads bend with the lie of the land, as roads do: the grid is
  // pulled about by a slow noise, so no avenue runs ruler-straight for long.
  vec2 q = mat2(0.8, -0.6, 0.6, 0.8) * p.xz + (vec2(n2(p.xz * 0.0018), n2(p.xz * 0.0018 + 7.0)) - 0.5) * 220.0;
  vec2 ga = abs(fract(q / 240.0 + vec2(0.13, 0.41)) - 0.5) * 240.0;
  vec2 gs = abs(fract(q / 60.0) - 0.5) * 60.0;
  float arter = lineOf(min(ga.x, ga.y), 5.0, fw);
  float street = lineOf(min(gs.x, gs.y), 2.0, fw) * 0.6;
  float built;
  vec4 lot = cityLot(p.xz, old, built);
  float size = mix(15.0, 9.0, old);
  float unseen = lotsUnseen(p.xz, old);
  // A lamp in a courtyard or over a door, one lot in so many — fewer in an
  // old town, whose light is in its lanes.
  float pt = smoothstep(0.22, 0.0, length(lot.xy - 0.25 - 0.5 * vec2(lot.w, lot.z))) * step(mix(0.35, 0.72, old), lot.z) * built;
  float near = smoothstep(3.0, 0.8, fw);
  float windows = mix(mix(0.28, pt, near), pt * near + 0.1 * unseen, old);
  // An old town's lanes, lit by lamps on its walls: a warm thread between
  // every pair of houses, drawn as a line so that, thinner than a pixel, it
  // dims rather than flickers; once the houses themselves are smaller than a
  // pixel, a warm haze over the whole. The stone roofs between stay dark.
  float edge = min(min(lot.x, 1.0 - lot.x), min(lot.y, 1.0 - lot.y)) * size;
  float lanes = mix(lineOf(edge, mix(0.13, 0.09, old) * size, fw) * 1.4, 0.33, unseen) * old;
  vec3 sodium = vec3(1.0, 0.52, 0.18);
  vec3 warm = vec3(1.0, 0.78, 0.5);
  vec3 white = vec3(0.86, 0.9, 1.0);
  arter *= 1.0 - 0.7 * old;
  street *= 1.0 - 0.8 * old;
  return (sodium * arter * 0.12 + mix(sodium, warm, 0.5) * street * 0.05
        + mix(warm, white, lot.w * (1.0 - old)) * windows * 0.07 + warm * lanes * 0.15) * dens
        // Seen from high, a town is not an even glow: its blocks and its open
        // ground, a hundred metres or so across, bright and dark.
        * mix(1.0, 0.25 + 1.5 * fbm(p.xz * 0.009 + 5.0, 3), unseen);
}

// ── from above the air ────────────────────────────────────────────────────

/* The air along a ray between two distances: what it scatters towards the eye, and what it lets through. */
vec3 airlight(vec3 o, vec3 rd, vec3 light, float intensity, float tA, float tB, out vec3 through) {
  float bm = 21e-6 * (1.0 + uB.y * 2.0);
  float seg = (tB - tA) / 10.0;
  vec3 sumR = vec3(0.0), sumM = vec3(0.0);
  float odR = 0.0, odM = 0.0;
  for (int i = ZERO; i < 10; i++) {
    vec3 p = o + rd * (tA + seg * (float(i) + 0.5));
    float h = max(length(p) - RE, 0.0);
    float dR = exp(-h / 8000.0) * seg;
    float dM = exp(-h / 1200.0) * seg;
    odR += dR;
    odM += dM;
    if (sphere(p, light, RE).x > 0.0) continue;
    float segL = sphere(p, light, RA).y / 4.0;
    float lR = 0.0, lM = 0.0;
    for (int j = 0; j < 4; j++) {
      vec3 q = p + light * (segL * (float(j) + 0.5));
      float hl = max(length(q) - RE, 0.0);
      lR += exp(-hl / 8000.0) * segL;
      lM += exp(-hl / 1200.0) * segL;
    }
    vec3 att = exp(-(BR * (odR + lR) + bm * 1.1 * (odM + lM)));
    sumR += att * dR;
    sumM += att * dM;
  }
  through = exp(-(BR * odR + bm * 1.1 * odM));
  float mu = dot(rd, light);
  float pr = 0.0597 * (1.0 + mu * mu);
  float g = 0.76;
  float pm = 0.1194 * ((1.0 - g * g) * (1.0 + mu * mu)) / ((2.0 + g * g) * pow(1.0 + g * g - 2.0 * g * mu, 1.5));
  return intensity * (sumR * BR * pr + sumM * bm * pm);
}

// ── the Levant, as it is ──────────────────────────────────────────────────
//
// The country the Night Journey rises from, in kilometres east (x) and north
// (y) of the Noble Sanctuary: the coasts as outlines, the inland seas, the
// cities each as bright as it is large, and the roads and rivers that string
// lights between them. Drawn where the camera climbs out of the air over
// Jerusalem, so that what lies under it is the real place.

const vec2 COAST[51] = vec2[51](
  // The Mediterranean: from El Arish up the coast of Palestine, Lebanon and
  // Syria to the Gulf of Iskenderun, west along Anatolia, and back east along
  // the shore of Egypt and the Nile's delta.
  vec2(-135.0, -72.0), vec2(-94.0, -54.0), vec2(-76.0, -29.0), vec2(-64.0, -12.0), vec2(-56.0, 2.0),
  vec2(-44.0, 34.0), vec2(-36.0, 61.0), vec2(-33.0, 80.0), vec2(-27.0, 117.0), vec2(-18.0, 113.0),
  vec2(-16.0, 128.0), vec2(-13.0, 146.0), vec2(-3.0, 166.0), vec2(13.0, 198.0), vec2(22.0, 236.0),
  vec2(38.0, 260.0), vec2(53.0, 297.0), vec2(61.0, 345.0), vec2(51.0, 415.0), vec2(56.0, 452.0),
  vec2(68.0, 477.0), vec2(88.0, 535.0), vec2(52.0, 554.0), vec2(-57.0, 557.0), vec2(-123.0, 503.0),
  vec2(-230.0, 472.0), vec2(-305.0, 531.0), vec2(-428.0, 568.0), vec2(-530.0, 492.0), vec2(-1700.0, 500.0),
  vec2(-1700.0, -150.0), vec2(-593.0, -105.0), vec2(-503.0, -64.0), vec2(-487.0, -51.0), vec2(-456.0, -36.0),
  vec2(-409.0, -22.0), vec2(-320.0, -28.0), vec2(-277.0, -57.0), vec2(-211.0, -70.0),
  // Cyprus: from Cape Andreas west along the north coast, and back by the south.
  vec2(-61.0, 434.0), vec2(-81.0, 424.0), vec2(-183.0, 397.0), vec2(-218.0, 402.0), vec2(-216.0, 380.0),
  vec2(-266.0, 362.0), vec2(-266.0, 330.0), vec2(-208.0, 310.0), vec2(-152.0, 347.0), vec2(-109.0, 353.0),
  vec2(-122.0, 371.0), vec2(-98.0, 402.0)
);

// x, y; how bright; how far its streets reach.
const vec4 TOWNS[33] = vec4[33](
  vec4(0.0, 0.0, 1.0, 6.0),          // Jerusalem
  vec4(3.0, 15.0, 0.35, 3.0),        // Ramallah
  vec4(-1.0, -9.0, 0.3, 2.5),        // Bethlehem
  vec4(-13.0, -28.0, 0.4, 3.5),      // Hebron
  vec4(2.0, 49.0, 0.35, 3.5),        // Nablus
  vec4(-38.0, 30.0, 1.7, 12.0),      // Jaffa and the towns about it
  vec4(-72.0, -30.0, 0.6, 6.0),      // Gaza
  vec4(-42.0, -59.0, 0.5, 5.0),      // Beersheba
  vec4(-20.0, 113.0, 0.8, 7.0),      // Haifa
  vec4(66.0, 19.0, 1.3, 10.0),       // Amman
  vec4(83.0, 29.0, 0.5, 5.0),        // Zarqa
  vec4(58.0, 86.0, 0.5, 5.0),        // Irbid
  vec4(27.0, 232.0, 1.1, 8.0),       // Beirut
  vec4(100.0, 192.0, 1.2, 10.0),     // Damascus
  vec4(57.0, 295.0, 0.6, 5.0),       // Tripoli
  vec4(140.0, 328.0, 0.6, 6.0),      // Homs
  vec4(57.0, 413.0, 0.4, 4.0),       // Latakia
  vec4(182.0, 491.0, 0.9, 9.0),      // Aleppo
  vec4(-177.0, 376.0, 0.5, 5.0),     // Nicosia
  vec4(-205.0, 320.0, 0.35, 4.0),    // Limassol
  vec4(-57.0, 564.0, 0.6, 6.0),      // Mersin
  vec4(8.0, 585.0, 0.8, 8.0),        // Adana
  vec4(-20.0, -247.0, 0.5, 4.0),     // Aqaba and Eilat
  vec4(-377.0, -193.0, 2.6, 22.0),   // Cairo
  vec4(-490.0, -72.0, 1.2, 10.0),    // Alexandria
  vec4(-276.0, -62.0, 0.6, 5.0),     // Port Said
  vec4(-280.0, -131.0, 0.45, 4.0),   // Ismailia
  vec4(-253.0, -200.0, 0.45, 4.0),   // Suez
  vec4(126.0, -377.0, 0.4, 4.0),     // Tabuk
  vec4(413.0, -811.0, 1.0, 9.0),     // al-Madinah
  vec4(380.0, -1141.0, 1.3, 11.0),   // Jeddah
  vec4(434.0, -1150.0, 1.1, 9.0),    // Makkah
  vec4(861.0, 170.0, 1.4, 13.0)      // Baghdad
);

// The highways between them, end to end.
const vec4 ROADS[12] = vec4[12](
  vec4(0.0, 0.0, -38.0, 30.0), vec4(0.0, 0.0, -13.0, -28.0), vec4(-13.0, -28.0, -42.0, -59.0),
  vec4(0.0, 0.0, 2.0, 49.0), vec4(66.0, 19.0, 58.0, 86.0), vec4(58.0, 86.0, 100.0, 192.0),
  vec4(100.0, 192.0, 140.0, 328.0), vec4(140.0, 328.0, 182.0, 491.0), vec4(66.0, 19.0, 47.0, -175.0),
  vec4(47.0, -175.0, -20.0, -247.0), vec4(-377.0, -193.0, -490.0, -72.0), vec4(-377.0, -193.0, -253.0, -200.0)
);

float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}

/* The distance to one of the outlines in COAST, negative inside it. */
float outline(vec2 p, int a, int n) {
  float d = 1e12;
  float s = 1.0;
  for (int k = ZERO; k < n; k++) {
    vec2 vi = COAST[a + k];
    vec2 vj = COAST[a + (k == 0 ? n - 1 : k - 1)];
    vec2 e = vj - vi;
    vec2 w = p - vi;
    vec2 b = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
    d = min(d, dot(b, b));
    bvec3 c = bvec3(p.y >= vi.y, p.y < vj.y, e.x * w.y > e.y * w.x);
    if (all(c) || all(not(c))) s = -s;
  }
  return s * sqrt(d);
}

/* How far from the water, in km, negative on it; and how far from the Mediterranean's own shore. */
float waterAt(vec2 g, out float med) {
  med = outline(g, 0, 39);
  float w = max(med, -outline(g, 39, 12));
  w = min(w, segDist(g, vec2(28.5, -4.0), vec2(22.5, -50.0)) - 7.0);       // the Dead Sea
  w = min(w, segDist(g, vec2(19.0, -60.0), vec2(17.0, -78.0)) - 3.5);      // its southern pans
  w = min(w, length((g - vec2(33.5, 115.7)) / vec2(6.0, 10.0)) * 6.0 - 6.0); // the Sea of Galilee
  w = min(w, segDist(g, vec2(-22.0, -249.0), vec2(-80.0, -480.0)) - 10.0); // the Gulf of Aqaba
  w = min(w, segDist(g, vec2(-253.0, -205.0), vec2(-125.0, -500.0)) - 13.0); // the Gulf of Suez
  w = min(w, segDist(g, vec2(-110.0, -500.0), vec2(20.0, -505.0)) - 28.0); // and the Red Sea
  w = min(w, segDist(g, vec2(-30.0, -560.0), vec2(80.0, -745.0)) - 90.0);
  w = min(w, segDist(g, vec2(80.0, -745.0), vec2(274.0, -1141.0)) - 95.0);
  return w;
}

/*
 * Villages and suburbs: one at most to a 1.6 km square, more where the
 * country is more settled, each a small pool of lights. Smaller than a pixel,
 * a village is drawn as a point of the same total light, widened to the
 * pixel, so it neither vanishes nor flickers; smaller than a pixel by far,
 * the country as its mean.
 */
float villagesAt(vec2 g, float pop, float pkm) {
  const float CELL = 1.6;
  vec2 c = floor(g / CELL);
  vec4 h = texelFetch(uNoise, ivec2(mod(c + 91.0, 256.0)), 0);
  float r = 0.1 + 0.3 * h.w * h.w;
  float mean = 3.1416 * r * r / (CELL * CELL) * pop * 0.85;
  float far = smoothstep(CELL * 0.4, CELL, pkm);
  if (h.x > pop * 0.85) return mean * far;
  vec2 at = (c + 0.3 + 0.4 * h.yz) * CELL;
  float R = max(r, pkm * 0.7);
  vec2 dv = g - at;
  float seen = exp(-dot(dv, dv) / (R * R)) * (r * r) / (R * R);
  seen *= mix(0.4 + 1.2 * n2(g * 9.0), 1.0, smoothstep(0.03, 0.12, pkm));
  return mix(seen, mean, far) * (0.25 + 1.5 * h.z * h.z);
}

/*
 * The Levant's lights at night: each city a bright knot with quarters bright
 * and dim, its suburbs and villages scattered round it; the coastal plain
 * built up nearly from Gaza to Haifa; the highways strung between; and the
 * Nile, a ribbon of light along its valley and a fan of it over the delta.
 * pkm is how many kilometres a pixel spans.
 */
float levantLights(vec2 g, float pkm) {
  float core = 0.0, spread = 0.0;
  for (int i = ZERO; i < 33; i++) {
    vec4 t = TOWNS[i];
    vec2 dv = g - t.xy;
    float d2 = dot(dv, dv);
    if (d2 > 100.0 * t.w * t.w) continue;
    float d = sqrt(d2);
    core += t.z * exp(-d / (t.w * 0.45));
    spread += t.z * exp(-d / (t.w * 2.2));
  }
  float plain = exp(-max(segDist(g, vec2(-70.0, -25.0), vec2(-22.0, 112.0)) - 7.0, 0.0) / 6.0);
  float nile = min(segDist(g, vec2(-377.0, -193.0), vec2(-383.0, -510.0)),
               min(segDist(g, vec2(-383.0, -510.0), vec2(-245.0, -676.0)), segDist(g, vec2(-245.0, -676.0), vec2(-220.0, -854.0))));
  vec2 fromCairo = g - vec2(-377.0, -193.0);
  float fan = atan(fromCairo.x, fromCairo.y);
  float delta = smoothstep(-0.88, -0.72, fan) * smoothstep(0.72, 0.56, fan) * smoothstep(200.0, 150.0, length(fromCairo));
  float pop = spread * 0.5 + plain * 0.55 + exp(-nile / 5.0) * 0.7 + delta * 0.65;
  // And the empty country: the wilderness of Judah falling from Jerusalem to
  // the Dead Sea, the Negev to the south, the desert east of the King's
  // Highway — dark between the lights, as they are.
  float empty = max(smoothstep(10.0, 4.0, segDist(g, vec2(15.0, 8.0), vec2(13.0, -58.0))),
                max(smoothstep(-55.0, -95.0, g.y) * smoothstep(60.0, 30.0, abs(g.x + 10.0)),
                    smoothstep(90.0, 135.0, g.x - 0.25 * g.y) * smoothstep(400.0, 300.0, g.y)));
  pop *= 1.0 - 0.9 * empty;
  // Quarters of a city, and finer, its streets — each laid as its own mean
  // once a pixel is wider than it.
  float quarters = fbm(g * 0.55 + 3.0, 4);
  float streets = mix(fbm(g * 2.4 + 8.0, 3), 0.5, smoothstep(0.15, 0.5, pkm));
  float lights = core * (0.3 + 0.9 * quarters) * (0.5 + streets);
  lights += villagesAt(g, min(pop, 1.0), pkm) * 0.8;
  // The highways: faint, wandering with the land, lit more where a village
  // stands by them than between.
  vec2 gw = g + (vec2(n2(g * 0.12), n2(g * 0.12 + 3.0)) - 0.5) * 4.0;
  float roads = 0.0;
  for (int i = ZERO; i < 12; i++) roads = max(roads, lineOf(segDist(gw, ROADS[i].xy, ROADS[i].zw), 0.15, pkm));
  lights += roads * 0.1 * (0.25 + smoothstep(0.4, 0.8, n2(g * 0.9)));
  return lights;
}

/*
 * The earth from above its air: its curve, the thin bright rim of the air
 * along it, deserts and seas and the cloud over them by day, the lights of
 * its towns by night — and the city the camera rose from, still glowing
 * under it. Over Jerusalem it is the real country round it.
 */
vec3 planetView(vec3 ro, vec3 rd, out float mask) {
  mask = 1.0;
  vec3 o = vec3(0.0, RE + ro.y, 0.0);
  vec2 atm = sphere(o, rd, RA);
  vec2 gnd = sphere(o, rd, RE);
  bool ground = gnd.x > 0.0;
  if (atm.y < 0.0) return vec3(0.0);
  float tA = max(atm.x, 0.0);
  float tB = ground ? gnd.x : atm.y;
  vec3 through, unused;
  vec3 air = airlight(o, rd, uSun, uSunI, tA, tB, through);
  if (uMoonI > 0.0) air += airlight(o, rd, uMoon, uMoonI, tA, tB, unused) * 0.45 * MOONTINT;
  if (!ground) {
    // The airglow: a faint green layer high in the air, seen edge-on along
    // the earth's rim on its night side.
    float tm = max(-dot(o, rd), 0.0);
    vec3 pc = o + rd * tm;
    float hmin = length(pc) - RE;
    float nightAt = 1.0 - smoothstep(-0.15, 0.1, dot(normalize(pc), uSun));
    air += vec3(0.28, 0.9, 0.38) * 0.02 * exp(-pow((hmin - 95000.0) / 6500.0, 2.0)) * (0.25 + 0.75 * nightAt);
    return air;
  }
  mask = 0.0;
  vec3 s = o + rd * gnd.x;
  vec3 n = s / RE;
  vec2 w = ro.xz + n.xz * RE;
  float pm = gnd.x * 2.0 / (uFocal * uRes.y);
  bool levant = uMark.w > 1.5;
  vec2 g = (w - uMark.xz) / 1000.0;
  float sea, green = 0.0, nileGreen = 0.0;
  if (levant) {
    // The coasts as they are, frayed a little at a finer scale than the outline.
    float med;
    float wat = waterAt(g, med) + (fbm(g * 0.09 + 5.0, 4) - 0.5) * 7.0 + (n2(g * 0.6) - 0.5) * 1.5;
    float edge = pm * 0.001 + 0.3;
    sea = smoothstep(edge, -edge, wat);
    // The hills behind the coast green with olive and pine; the south and the
    // east desert; the Nile's banks dark with fields.
    green = smoothstep(95.0, 25.0, abs(med)) * smoothstep(-70.0, -25.0, g.y);
    vec2 fromCairo = g - vec2(-377.0, -193.0);
    float fan = atan(fromCairo.x, fromCairo.y);
    nileGreen = max(smoothstep(-0.88, -0.72, fan) * smoothstep(0.72, 0.56, fan) * smoothstep(200.0, 150.0, length(fromCairo)),
                    exp(-min(segDist(g, vec2(-377.0, -193.0), vec2(-383.0, -510.0)),
                         min(segDist(g, vec2(-383.0, -510.0), vec2(-245.0, -676.0)), segDist(g, vec2(-245.0, -676.0), vec2(-220.0, -854.0)))) / 6.0));
  } else {
    float cont = fbm(w * 2.4e-6 + vec2(3.1, 7.4), 6);
    sea = smoothstep(0.47, 0.44, cont);
  }
  float rough = ridged(w * 1.1e-5, 5);
  vec3 desert = mix(vec3(0.6, 0.43, 0.27), vec3(0.74, 0.58, 0.4), fbm(w * 7e-6, 4));
  desert = mix(desert, vec3(0.3, 0.23, 0.17), smoothstep(0.35, 0.7, rough) * 0.6);
  desert = mix(desert, vec3(0.16, 0.2, 0.09), smoothstep(0.62, 0.76, fbm(w * 5e-6 + 9.0, 4)) * (levant ? 0.15 : 0.5));
  desert = mix(desert, vec3(0.24, 0.25, 0.15) * (0.8 + 0.4 * fbm(g * 0.2, 3)), green * 0.75);
  desert = mix(desert, vec3(0.08, 0.13, 0.05), nileGreen * 0.85);
  vec3 alb = mix(desert, vec3(0.004, 0.02, 0.05), sea);
  // (The night of the Journey is clear: over the Levant, only a little high cloud.)
  float cloudy = smoothstep(0.56, 0.8, fbm(w * 9e-6 + uTime * vec2(0.002, 0.001), 5)) * (levant ? 0.05 + 0.15 * uA.x : 0.4 + 0.6 * uA.x);
  float day = dot(n, uSun);
  vec3 sunAt = mix(vec3(1.0, 0.42, 0.14), vec3(1.0, 0.97, 0.92), smoothstep(0.0, 0.35, day)) * 2.5 * smoothstep(-0.06, 0.08, day);
  vec3 surface = alb * sunAt * max(day, 0.0);
  surface = mix(surface, vec3(0.95) * sunAt * max(day, 0.0), cloudy);
  surface += sea * (1.0 - cloudy) * sunAt * pow(max(dot(reflect(rd, n), uSun), 0.0), 260.0) * 5.0;
  // By moonlight: the land silver-grey, the cloud brighter than it, and on
  // the sea the moon's broad glitter.
  float mlit = max(dot(n, uMoon), 0.0);
  surface += mix(alb, vec3(0.8), cloudy) * uMoonCol * mlit * 0.65;
  float mg = max(dot(reflect(rd, n), uMoon), 0.0);
  surface += sea * (1.0 - cloudy) * uMoonCol * (pow(mg, 260.0) * 1.4 + pow(mg, 24.0) * 0.06);
  // The night side: towns in clusters, villages scattered between, the lit
  // roads that join them — and the city the camera rose from, a bright knot
  // right under it.
  float dark = 1.0 - smoothstep(-0.12, 0.05, day);
  float land = 1.0 - sea;
  float towns, cluster;
  if (levant) {
    towns = levantLights(g, pm * 0.001) * land * 1.5;
    cluster = smoothstep(0.6, 2.0, towns);
  } else {
    float settled = smoothstep(0.32, 0.6, fbm(w * 5e-6 + 3.0, 3));
    cluster = pow(smoothstep(0.56, 0.84, fbm(w * 2.2e-5 + 4.0, 5)), 1.5) * settled;
    float village = smoothstep(0.72, 0.9, n2(w * 2.4e-4 + 1.0)) * settled;
    float roadD = abs(n2(w * 1.2e-5 + 7.0) - 0.5) / 1.2e-5;
    float road = lineOf(roadD, 80.0, pm) * settled;
    float dh = length(w - uHere.yz);
    float here = uHere.x * (exp(-dh / 5000.0) * (0.4 + fbm(w * 4e-4, 4)) + exp(-dh / 1100.0) * 1.6);
    towns = (cluster + village * 0.3 + road * 0.6) * land + here * 2.2;
  }
  surface += mix(vec3(1.0, 0.52, 0.2), vec3(1.0, 0.82, 0.58), cluster) * towns * dark * 0.07 * (1.0 - cloudy * 0.75);
  return surface * through + air;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = (frag - 0.5 * uRes) / uRes.y;
  vec3 rd = normalize(uRot * vec3(uv.x * 2.0, uv.y * 2.0, uFocal));
  vec3 ro = uCam;

  // Above the air, the land is the curve of the earth; rising out of the
  // air, the land below gives way to it. (Worked out in this one place, for
  // both: the shader is compiled once per use of a function.)
  vec3 planet = vec3(0.0);
  float planetMask = 0.0;
  if (ro.y > 14000.0) {
    planet = planetView(ro, rd, planetMask);
    planet += (milkyWay(rd) * 3.0 * uB.x + sunDisc(rd) + moonHalo(rd) * 0.5) * planetMask;
  }
  if (ro.y > 17500.0) {
    outColor = vec4(max(planet, 0.0) * uOut, planetMask);
    return;
  }

  vec3 sky = atmosphere(rd);
  float night = uC.w;
  vec3 col;
  float tHit = 1e9;
  float skyMask = 0.0;

  // Beneath the sea: the darknesses of 24:40, and the light coming down.
  if (ro.y < 0.0) {
    float depth = -ro.y;
    // What light comes down: the sun's by day, the moon's by night — and
    // less of it the deeper, until it is darkness upon darkness.
    vec3 down = uSunCol * max(uSun.y, 0.0) + uMoonCol * max(uMoon.y, 0.0) * 1.5 + uSkyUp * 0.6 + vec3(0.0008, 0.0016, 0.003);
    vec3 water = vec3(0.035, 0.27, 0.32);
    col = down * water * 1.5 * exp(-depth * 0.05) * (0.22 + 0.78 * smoothstep(-0.6, 0.9, rd.y));
    if (rd.y > 0.02) {
      // The underside of the waves overhead: wave upon wave.
      float tw = depth / rd.y;
      vec3 sp = ro + rd * tw;
      vec3 n = waveNormal(sp.xz, tw * 0.2);
      float ripple = 0.55 + 0.45 * n2(sp.xz * 0.08 + uTime * 0.25);
      float window = smoothstep(0.55, 0.75, rd.y + (n.x + n.z) * 0.18);
      vec3 through = sky * 1.6 + uSunCol * 0.6 * pow(max(dot(rd, uSun), 0.0), 24.0) + uMoonCol * 2.0 * pow(max(dot(rd, uMoon), 0.0), 40.0);
      vec3 under = down * water * 2.2 * ripple * exp(-depth * 0.03);
      col = mix(col, mix(under, through, window), exp(-tw * 0.045));
      float crest = pow(max(0.0, 1.0 - abs(n.x * 3.0 + n.z * 2.0)), 6.0);
      col += down * water * crest * 2.4 * exp(-tw * 0.05);
    } else {
      float t = -ro.y;
      vec2 c = ro.xz + rd.xz * (t / max(-rd.y, 0.05));
      float floorH = terrainH(c, 4);
      float tb = (floorH - ro.y) / rd.y;
      if (tb > 0.0 && tb < 120.0) {
        vec3 bed = vec3(0.5, 0.42, 0.3) * (0.12 + 0.88 * n2(c * 0.2)) * exp(-depth * 0.05);
        float caustic = pow(n2(c * 0.35 + uTime * 0.6) * n2(c * 0.27 - uTime * 0.5), 2.0) * 3.0;
        bed *= 0.3 + caustic * exp(-depth * 0.08);
        col = mix(bed * down * 0.4, col, 1.0 - exp(-tb * 0.08));
      }
    }
    // Shafts of light falling through the water.
    float shaft = pow(fbm(vec2(rd.x * 7.0 + rd.z * 2.0 + uTime * 0.04, rd.z * 1.5), 3), 3.0) * smoothstep(-0.3, 0.7, rd.y);
    col += down * vec3(0.3, 0.7, 0.8) * shaft * 1.1 * exp(-depth * 0.045);
    // Motes drifting in the water near the lens — what makes it water, and not the dark of space.
    vec2 mq = frag / (uRes.y * 0.045) + vec2(sin(uTime * 0.1) * 0.6, uTime * 0.12);
    vec2 mc = floor(mq);
    vec4 mh = texelFetch(uNoise, ivec2(mod(mc, 256.0)), 0);
    float mote = smoothstep(0.07, 0.0, length(fract(mq) - mh.zw)) * step(0.84, mh.x);
    col += (down * vec3(0.4, 0.8, 0.9) * 0.6 + vec3(0.0012, 0.0018, 0.002)) * mote;
    // Glints in the water: the pearls brought out of both seas.
    float glint = step(0.996, textureLod(uNoise, frag / 256.0 + floor(uTime * 3.0) * 0.17, 0.0).z);
    col += vec3(1.0, 0.95, 0.85) * glint * 0.3 * exp(-depth * 0.04) * uD.w;
    outColor = vec4(col * uOut, 0.0);
    return;
  }

  // ── march the land ──────────────────────────────────────────────────────
  float t = 1.0;
  float tMax = 9000.0 + uCam.y * 14.0;
  bool hit = false;
  float kind = 0.0;
  Land L;
  int steps = int(uQ.x);
  for (int i = 0; i < 260; i++) {
    if (i >= steps) break;
    vec3 p = ro + rd * t;
    if (p.y > 1300.0 && rd.y > 0.0) break;
    int oct = t < 600.0 ? 6 : t < 2500.0 ? 5 : 4;
    float h = terrain(p.xz, oct, L);
    float dh = p.y - h;
    float step = dh * (t < 400.0 ? 0.42 : 0.55);
    if (t < uQ.w && dh < 18.0 && dh > -1.0) {
      float k, rl;
      float dt = trees(p, L, h, k, rl);
      if (dt < step) {
        step = dt;
        if (dt < 0.02 * t) { kind = k; hit = true; tHit = t; break; }
      }
      step = min(step, 6.5);
    }
    if (uMark.w > 0.5) {
      vec3 mp = p - uMark.xyz;
      vec2 reach = markReach();
      if (dot(mp.xz, mp.xz) < reach.x * reach.x && mp.y < reach.y) {
        float mm;
        float dm = landmark(mp, mm);
        // A floor or a low wall lies within a hand of the ground: whichever of
        // the two is nearer is the one the ray meets.
        if (dm < 0.0015 * t + 0.01 && dm <= dh) { kind = mm; hit = true; tHit = t; break; }
        step = min(step, dm);
      }
    }
    if (dh < 0.0012 * t) { hit = true; tHit = t; break; }
    t += max(step, 0.02 + t * 0.0016);
    if (t > tMax) break;
  }

  // A ray that ran out of steps or of distance, still low over the land, has
  // met it far off: drawn as the haze it is lost in, not as a hole of sky.
  if (!hit && rd.y < 0.06 && (ro + rd * t).y < 1300.0) {
    hit = true;
    tHit = min(t, tMax);
    kind = 0.0;
  }

  // The water's surface, at the level of the sea.
  float tw = rd.y < 0.0 ? -ro.y / rd.y : 1e9;
  bool water = tw < tHit && tw < tMax;

  if (water) {
    vec3 p = ro + rd * tw;
    Land W;
    float bed = terrain(p.xz, 4, W);
    float depth = max(-bed, 0.0);
    vec3 n = waveNormal(p.xz, tw);
    vec3 refl = reflect(rd, n);
    // A wave's face turned down towards the water reflects the water beside
    // it, not a sky under the horizon.
    float facesDown = smoothstep(0.03, -0.08, refl.y);
    refl.y = max(refl.y, 0.012);
    float fres = 0.02 + 0.98 * pow(1.0 - max(dot(-rd, n), 0.0), 5.0);
    vec3 skyR = atmosphere(refl);
    if (night > 0.2) skyR += (milkyWay(refl) + pointStars(refl, uD.x, 3.0 / (uFocal * uRes.y), uTime) * 0.12) * night * uB.x;
    skyR += moonHalo(refl) + moonFace(refl, uMoon, uSun, uC.x, 0.0105 * uC.y) * length(uMoonCol) * 0.6;
    float spec = pow(max(dot(refl, uSun), 0.0), mix(1400.0, 260.0, uA.w)) * 22.0 * (1.0 - facesDown);
    float mspec = pow(max(dot(refl, uMoon), 0.0), 300.0) * 6.0;
    vec3 deep = vec3(0.004, 0.04, 0.06);
    vec3 shallowC = vec3(0.03, 0.2, 0.2);
    // Two seas, a barrier between them they do not overrun (55:19–20).
    float seam = uD.w * W.C.y;
    if (seam > 0.01) {
      float s = W.side - 18.0 + (n2(p.xz * 0.01) - 0.5) * 70.0 + (n2(p.xz * 0.05) - 0.5) * 12.0;
      vec3 other = vec3(0.025, 0.06, 0.035);
      deep = mix(deep, s > 0.0 ? other : vec3(0.0, 0.07, 0.11), seam);
      shallowC = mix(shallowC, s > 0.0 ? vec3(0.09, 0.14, 0.08) : vec3(0.02, 0.24, 0.28), seam);
      float line = smoothstep(3.0, 0.0, abs(s)) * seam;
      deep += vec3(0.25) * line * (0.4 + 0.6 * n2(p.xz * 0.3 + uTime));
    }
    float shallow = exp(-depth * 0.35);
    vec3 body = mix(deep, shallowC, shallow);
    vec3 light = uSunCol * max(uSun.y, 0.0) + uMoonCol * max(uMoon.y, 0.0) * 0.6 + sky * 0.5;
    vec3 under = body * light;
    vec3 bedCol = vec3(0.62, 0.5, 0.34) * light * 0.5;
    under = mix(under, bedCol, shallow * 0.65);
    skyR = mix(skyR, under * 0.8, facesDown);
    col = mix(under, skyR, fres) + uSunCol * spec * (1.0 - uA.x * 0.8) + uMoonCol * mspec;
    // Foam on the shore, and on the crests when the wind is up.
    float foam = smoothstep(1.3, 0.0, depth) * smoothstep(0.35, 0.6, n2(p.xz * 0.25 + uTime * 0.3));
    foam += smoothstep(0.78, 0.95, n2(p.xz * 0.06 + uTime * 0.12)) * smoothstep(0.4, 1.0, uA.w) * 0.6;
    col += light * foam * 0.5;
    col = mix(col, sky, fogAmount(ro, rd, tw));
    tHit = tw;
  } else if (hit) {
    vec3 p = ro + rd * tHit;
    vec3 n;
    float treeRel = 1.0;
    if (kind > 9.5) {
      vec3 mp = p - uMark.xyz;
      float mm;
      // Four taps at a tetrahedron's corners, in a loop kept a loop.
      n = vec3(0.0);
      for (int i = ZERO; i < 4; i++) {
        vec3 e = 0.5773 * (2.0 * vec3(float(((i + 3) >> 1) & 1), float((i >> 1) & 1), float(i & 1)) - 1.0);
        n += e * landmark(mp + e * 0.08, mm);
      }
      n = normalize(n);
      terrain(p.xz, 3, L);
    } else if (kind > 0.5) {
      vec2 e = vec2(0.15, 0.0);
      Land T;
      float h0 = terrain(p.xz, 3, T);
      float k, rl;
      float d0 = trees(p, T, h0, k, treeRel);
      n = normalize(vec3(
        trees(p + e.xyy, T, h0, k, rl) - d0,
        trees(p + e.yxy, T, h0, k, rl) - d0,
        trees(p + e.yyx, T, h0, k, rl) - d0));
      L = T;
    } else {
      // The normal is taken over about a pixel, so that relief finer than a
      // pixel shades as the mean of it rather than as glitter.
      float e = max(0.35 + tHit * 0.0018, tHit * 1.2 / (uFocal * uRes.y));
      int oct = tHit < 250.0 ? 8 : tHit < 900.0 ? 7 : tHit < 2500.0 ? 5 : 4;
      float h0 = terrain(p.xz, oct, L);
      float hx = terrainH(p.xz + vec2(e, 0.0), oct);
      float hz = terrainH(p.xz + vec2(0.0, e), oct);
      n = normalize(vec3(h0 - hx, e, h0 - hz));
    }
    vec3 markGlow = vec3(0.0);
    vec3 alb = kind > 9.5 ? markColour(kind, p - uMark.xyz, n, markGlow) : groundColour(p, n, L, kind);
    // Under its own crown a tree is in shade.
    if (kind > 0.5 && kind < 9.5) alb *= 0.45 + 0.55 * treeRel;
    float sh = 1.0;
    if (uSun.y > -0.05) sh = tHit < 5000.0 ? shadowTo(p + n * 0.4, uSun) : 1.0;
    sh *= cloudShadow(p);
    float dif = max(dot(n, uSun), 0.0) * sh;
    float mdif = max(dot(n, uMoon), 0.0);
    float amb = 0.5 + 0.5 * n.y;
    vec3 skyUp = uSkyUp * 0.9 + vec3(0.0015, 0.0022, 0.0045) * night;
    vec3 bounce = alb * uSunCol * max(uSun.y, 0.0) * 0.12;
    col = alb * (uSunCol * dif * 1.05 + skyUp * amb * 1.2 + uMoonCol * mdif * 0.5 + bounce);
    col += vec3(0.6, 0.7, 1.0) * uA.z * 0.5 * alb * amb;
    // The lights of a city by night, and a landmark's floodlights.
    if (kind < 9.5) col += cityGlow(p, cityAt(L, p.xz), L.D.y, tHit * 2.0 / (uFocal * uRes.y), smoothstep(0.4, 0.12, 1.0 - n.y)) * night;
    col += markGlow;
    // The gold of the dome catches the sun, and the sky.
    if (kind > 12.5 && kind < 13.5) {
      vec3 r = reflect(rd, n);
      col += alb * (uSunCol * pow(max(dot(r, uSun), 0.0), 24.0) * 2.5 + uSkyUp * 0.5 * max(r.y, 0.0));
    }
    // And the lead of the grey domes catches the moon.
    if (kind > 14.5 && kind < 15.5 || kind > 18.5 && kind < 19.5) {
      vec3 r = reflect(rd, n);
      col += alb * (uSunCol * pow(max(dot(r, uSun), 0.0), 40.0) * 1.2 + uMoonCol * pow(max(dot(r, uMoon), 0.0), 30.0) * 6.0);
    }
    // The fire kindled (36:80, 56:71): its light on the ground near it.
    if (uD.y > 0.01) {
      vec3 fl = uFirePos - p;
      float fd = length(fl);
      float flick = 0.8 + 0.2 * n2(vec2(uTime * 7.0, 3.0));
      col += alb * vec3(1.0, 0.45, 0.12) * uD.y * flick * max(dot(n, fl / fd), 0.0) * 900.0 / (fd * fd + 30.0);
    }
    float fog = max(fogAmount(ro, rd, tHit), smoothstep(tMax * 0.45, tMax * 0.95, tHit));
    col = mix(col, sky, fog);
  } else {
    // ── the sky ─────────────────────────────────────────────────────────
    col = sky;
    float horizonFade = smoothstep(-0.02, 0.06, rd.y);
    if (night > 0.02) col += milkyWay(rd) * night * uB.x * horizonFade * (1.0 - uA.x * 0.9);
    col += moonHalo(rd) * horizonFade;
    col += sunDisc(rd) * horizonFade;
    skyMask = horizonFade;
    tHit = 1e9;
  }

  // Cloud over all of it, where the ray passes through the layer.
  vec4 cl = clouds(ro, rd, tHit, sky);
  col = col * (1.0 - cl.a) + cl.rgb;
  skyMask *= 1.0 - cl.a;

  // The fire's glow, where it can be seen.
  if (uD.y > 0.01) {
    vec3 fd = uFirePos - ro;
    float dist = length(fd);
    if (dist < tHit + 2.0) {
      float ang = acos(clamp(dot(rd, fd / dist), -1.0, 1.0));
      float r = 2.2 / dist;
      float flick = 0.75 + 0.25 * n2(vec2(uTime * 9.0, 1.0));
      col += vec3(1.0, 0.52, 0.16) * uD.y * flick * (exp(-ang / r) * 60.0 + exp(-ang / (r * 7.0)) * 2.0);
    }
  }

  // Rising out of the air: the land below gives way to the earth's curve.
  if (ro.y > 14000.0) {
    float k = smoothstep(14000.0, 17500.0, ro.y);
    col = mix(col, planet, k);
    skyMask = mix(skyMask, planetMask, k);
  }

  // The alpha says how much of the open sky this pixel is: where the finish
  // may set the stars and the moon's face.
  outColor = vec4(max(col, 0.0) * uOut, skyMask);
}`;

/** Halved, and the brightest kept: the first step of the glow. */
export const DOWN = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform float uFirst;
void main() {
  vec3 c = vec3(0.0);
  c += texture(uSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  c += texture(uSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb;
  c += texture(uSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb;
  c += texture(uSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  c *= 0.25;
  if (uFirst > 0.5) c = min(c, vec3(60.0));
  outColor = vec4(c, 1.0);
}`;

/** Doubled, and added to the level above: the glow spreading. */
export const UP = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uSrc;
uniform sampler2D uBase;
uniform vec2 uTexel;
void main() {
  vec3 c = vec3(0.0);
  c += texture(uSrc, vUv + uTexel * vec2(-1.0, 0.0)).rgb * 2.0;
  c += texture(uSrc, vUv + uTexel * vec2(1.0, 0.0)).rgb * 2.0;
  c += texture(uSrc, vUv + uTexel * vec2(0.0, -1.0)).rgb * 2.0;
  c += texture(uSrc, vUv + uTexel * vec2(0.0, 1.0)).rgb * 2.0;
  c += texture(uSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  c += texture(uSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb;
  c += texture(uSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb;
  c += texture(uSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  c += texture(uSrc, vUv).rgb * 4.0;
  c /= 16.0;
  outColor = vec4(c + texture(uBase, vUv).rgb, 1.0);
}`;

/**
 * The film's own finish: exposure for the hour, the glow, rain across the
 * lens, lightning, the veil and the lamp, the niche the film opens out of and
 * closes into, and a grade.
 */
export const COMPOSITE = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uWorld;
uniform sampler2D uGlow;
uniform sampler2D uSoft;
uniform sampler2D uNoise;
uniform vec2 uRes;
uniform float uTime;
uniform float uExposure;
uniform vec4 uE;     // veil, lamp, aperture, flash (a seek)
uniform vec4 uF;     // rain, hail, wind, night
uniform vec4 uBolt;  // x, top, bottom, brightness
uniform vec4 uMet;   // x0, y0, x1, y1
uniform vec2 uMetT;  // progress, brightness
uniform vec4 uG;     // mirage, horizon y, warmth, motion
uniform float uDim;
uniform float uIn;
// Where the closed niche stands: its centre's height and its size, in the
// screen's height from the middle. Fitted by the page into the room left
// above whatever card is showing.
uniform vec2 uNiche;
// To set the stars and the moon's face at the screen's own resolution.
uniform mat3 uRot;
uniform float uFocal;
uniform float uTurn;
uniform float uStarAmt;
uniform vec3 uMoonDir;
uniform vec3 uSunDir;
uniform vec3 uMoonP;   // phase, size, brightness

${COMMON}

float sdNiche(vec2 p, float w, float h) {
  vec2 q = vec2(abs(p.x), p.y);
  // The sides and the arch overlap where they meet, so the join is no edge.
  float body = max(q.x - w * 0.5, max(-(q.y + h), q.y - 0.06 * w));
  float R = w * 0.82;
  vec2 c = vec2(w * 0.5 - R, 0.0);
  float arch = max(length(q - c) - R, -q.y - 0.06 * w);
  return min(body, arch);
}

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

float lineDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  vec2 uv = vUv;
  float aspect = uRes.x / uRes.y;
  vec2 sp = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);

  // A mirage: the air over hot ground wavering, near the horizon.
  if (uG.x > 0.01) {
    float band = exp(-pow((uv.y - uG.y) / 0.06, 2.0));
    uv.x += (n2(vec2(uv.y * 160.0, uTime * 3.0)) - 0.5) * 0.004 * band * uG.x;
    uv.y += (n2(vec2(uv.x * 90.0, uTime * 2.0)) - 0.5) * 0.003 * band * uG.x;
  }

  vec3 world = texture(uWorld, uv).rgb * uIn;
  vec3 glow = texture(uGlow, uv).rgb * uIn;
  vec3 soft = texture(uSoft, uv).rgb * uIn;
  vec3 c = world + glow * 0.055 + max(glow - 2.5, 0.0) * 0.06;

  // The stars and the moon, sharp, wherever the world left open sky.
  float mask = texture(uWorld, uv).a;
  if (mask > 0.001) {
    vec3 rd = normalize(uRot * vec3(sp.x * 2.0, sp.y * 2.0, uFocal));
    vec3 lights = vec3(0.0);
    if (uStarAmt > 0.001) lights += pointStars(rd, uTurn, 1.25 / (uFocal * uRes.y), uTime) * uStarAmt;
    if (uMoonP.z > 0.001) lights += moonFace(rd, uMoonDir, uSunDir, uMoonP.x, uMoonP.y) * uMoonP.z;
    c += lights * mask;
  }

  // Rain across the view, slanting with the wind.
  if (uF.x > 0.01) {
    vec2 r = uv * vec2(aspect, 1.0);
    r.x += r.y * (0.08 + uF.z * 0.35);
    float streaks = 0.0;
    for (int i = 0; i < 3; i++) {
      float s = 1.0 + float(i) * 0.7;
      vec2 q = r * vec2(130.0 * s, 4.0 * s) + vec2(float(i) * 17.0, uTime * (9.0 + float(i) * 3.0));
      float n = n2(q);
      streaks += smoothstep(0.82 - uF.x * 0.12, 1.0, n) * (0.6 - float(i) * 0.15);
    }
    c = mix(c, soft * 0.8, uF.x * 0.25);
    c += vec3(0.6, 0.65, 0.7) * streaks * uF.x * (0.04 + 0.4 * dot(soft, vec3(0.33)));
  }
  // Hail: white, and falling hard.
  if (uF.y > 0.01) {
    vec2 q = uv * vec2(aspect, 1.0) * 60.0 + vec2(0.0, uTime * 22.0);
    vec2 cell = floor(q);
    vec2 h = textureLod(uNoise, (cell + 0.5) / 256.0, 0.0).zw;
    float d = length(fract(q) - h);
    c += vec3(0.85) * smoothstep(0.08, 0.0, d) * step(0.7, h.x) * uF.y * 0.6;
  }
  // Lightning: a bolt, and the flash it makes.
  if (uBolt.w > 0.01) {
    float y = uv.y;
    if (y < uBolt.y && y > uBolt.z) {
      float jag = (n2(vec2(y * 26.0, uBolt.x * 50.0)) - 0.5) * 0.06 + (n2(vec2(y * 90.0, uBolt.x * 20.0)) - 0.5) * 0.015;
      float x = uBolt.x + jag;
      float d = abs(uv.x - x) * aspect;
      c += vec3(0.85, 0.9, 1.0) * uBolt.w * (exp(-d * 900.0) * 30.0 + exp(-d * 60.0) * 1.4);
    }
  }
  // A shooting star.
  if (uMetT.y > 0.01) {
    vec2 a = vec2(uMet.x * aspect, uMet.y);
    vec2 b = vec2(uMet.z * aspect, uMet.w);
    vec2 head = mix(a, b, uMetT.x);
    vec2 tail = mix(a, b, max(0.0, uMetT.x - 0.18));
    vec2 p = vec2(uv.x * aspect, uv.y);
    float d = lineDist(p, tail, head);
    float along = clamp(dot(p - tail, head - tail) / max(dot(head - tail, head - tail), 1e-6), 0.0, 1.0);
    c += vec3(0.9, 0.95, 1.0) * uMetT.y * along * (exp(-d * 2500.0) * 3.0 + exp(-d * 300.0) * 0.15);
  }

  c *= uExposure;

  // The veil: the unseen, which is not drawn. The world falls back, out of
  // focus, and the lamp's light comes down over it.
  float v = uE.x;
  // Nothing of the world is left to be made out: a little of its light,
  // warmed, and no shape.
  vec3 veiled = soft * uExposure * 0.1;
  float luma = dot(veiled, vec3(0.299, 0.587, 0.114));
  veiled = mix(veiled, vec3(luma) * vec3(1.0, 0.78, 0.52), 0.8);
  c = mix(c, veiled, clamp(v * 1.6, 0.0, 1.0) * 0.97);
  vec2 lampAt = vec2(0.0, 0.58);
  float lr = length((sp - lampAt) * vec2(1.0, 1.25));
  float lampGlow = (exp(-lr * 3.4) * 0.85 + exp(-lr * 1.25) * 0.22);
  vec3 lampCol = vec3(1.0, 0.7, 0.34);
  c += lampCol * lampGlow * (v * 1.35 + uE.y * 0.8);
  // The embers rising past it.
  float embers = 0.0;
  for (int i = 0; i < 3; i++) {
    float s = 22.0 + float(i) * 14.0;
    vec2 q = vec2(sp.x * s, sp.y * s - uTime * (0.35 + float(i) * 0.12) * s * 0.06);
    q.x += sin(q.y * 0.6 + float(i) * 2.0 + uTime * 0.4) * 0.35;
    vec2 cell = floor(q);
    vec2 h = textureLod(uNoise, (cell + vec2(float(i) * 31.0, 7.0) + 0.5) / 256.0, 0.0).zw;
    float d = length(fract(q) - 0.2 - 0.6 * h);
    float twinkle = 0.5 + 0.5 * sin(uTime * (1.5 + h.x * 3.0) + h.y * 30.0);
    embers += smoothstep(0.07, 0.0, d) * step(0.78, h.y) * twinkle;
  }
  c += lampCol * embers * (v * 0.9 + uE.y * 0.6) * 0.9;

  // The niche the film opens out of, and closes into — and which the
  // parable of the light (24:35) brings back.
  float ap = uE.z;
  if (ap < 0.999) {
    float s = mix(uNiche.y, 4.2, ap * ap);
    vec2 np = sp - vec2(0.0, uNiche.x * (1.0 - ap));
    float d = sdNiche(np / s, 0.62, 0.62) * s;
    float inside = smoothstep(0.004, -0.004, d);
    vec3 wall = vec3(0.045, 0.03, 0.018) * (0.75 + 0.25 * n2(sp * 40.0));
    wall += lampCol * 0.08 * exp(-length(np) * 3.0);
    float rim = exp(-abs(d) * 160.0) * 0.5;
    vec3 inner = c + lampCol * (exp(-length(np - vec2(0.0, 0.36 * s)) * 9.0 / max(s, 0.2)) * 1.4 * (1.0 - ap));
    // The lamp in its glass, the glass as if it were a brilliant star (24:35).
    if (uE.y > 0.01) {
      vec2 lp = np - vec2(0.0, -0.17 * s);
      float lr = length(lp) / max(s, 0.05);
      float core = exp(-lr * 40.0) * 5.0 + exp(-lr * 10.0) * 0.8;
      float thin = 0.0035 * s + 0.0006;
      float spikes = exp(-abs(lp.x) / thin) * exp(-abs(lp.y) / (0.1 * s)) + exp(-abs(lp.y) / thin) * exp(-abs(lp.x) / (0.1 * s));
      inner += vec3(1.0, 0.86, 0.6) * (core + spikes * 0.7) * uE.y;
    }
    c = mix(wall + lampCol * rim * 0.6, inner, inside);
  }

  // Grade: the shadows a little cool at night, the light a little warm by day.
  c = aces(c);
  c = pow(c, vec3(0.94));
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, 1.08);
  c = mix(c, c * vec3(0.9, 0.97, 1.12), uF.w * 0.35 * (1.0 - l));
  c *= mix(vec3(1.0), vec3(1.04, 1.0, 0.94), uG.z);
  float vig = smoothstep(1.25, 0.25, length(sp * vec2(0.85, 1.0)));
  c *= mix(0.62, 1.0, vig);
  // A seek, a loop: through a breath of light rather than a cut.
  // A jump — a seek, a loop going round — is taken through a breath of
  // dark, never a flash of white.
  c = mix(c, vec3(0.028, 0.02, 0.014), uE.w * 0.92);
  c *= 1.0 - uDim;
  float grain = textureLod(uNoise, gl_FragCoord.xy / 256.0 + fract(uTime * vec2(0.37, 0.71)), 0.0).z - 0.5;
  c += grain * (0.025 + 0.02 * uF.w);
  outColor = vec4(c, 1.0);
}`;
