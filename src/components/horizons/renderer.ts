import { COMPOSITE, DOWN, UP, VERT, WORLD } from "./shaders";

/**
 * The film's GPU side: the programs, the textures and the passes, and nothing
 * about the Qur'an. `HorizonsFilm` works out what the world is each frame and
 * hands it here as numbers.
 *
 * The world is drawn at a fraction of the screen — how large a fraction is
 * decided by the frame rate, and moved as it changes, so a phone gets a
 * softer picture rather than a stuttering one — into a floating-point target
 * where the sun can be a hundred times brighter than the sand. The glow is
 * made by halving that four times and adding the halves back. The last pass
 * is drawn at the screen's own resolution, so the film's grain and the
 * niche's edge are sharp whatever the world was drawn at.
 */

export interface Frame {
  time: number;
  cam: [number, number, number];
  rot: Float32Array;
  focal: number;
  sun: [number, number, number];
  moon: [number, number, number];
  sunCol: [number, number, number];
  moonCol: [number, number, number];
  skyUp: [number, number, number];
  sunI: number;
  moonI: number;
  a: [number, number, number, number];
  b: [number, number, number, number];
  c: [number, number, number, number];
  d: [number, number, number, number];
  fire: [number, number, number];
  exposure: number;
  e: [number, number, number, number];
  f: [number, number, number, number];
  bolt: [number, number, number, number];
  meteor: [number, number, number, number];
  meteorT: [number, number];
  g: [number, number, number, number];
  dim: number;
  niche: [number, number];
  /** A landmark near the camera: where its foot stands, and which (0 none, 1 the Ḥaram, 2 the Noble Sanctuary). */
  mark: [number, number, number, number];
  /** The city under the camera, and where it is, for its glow from orbit. */
  here: [number, number, number];
  /** How bright the stars are tonight, and the moon's face: drawn at the screen's resolution. */
  starAmt: number;
  moonP: [number, number, number];
}

interface Target {
  fb: WebGLFramebuffer;
  tex: WebGLTexture;
  w: number;
  h: number;
}

type Program = { prog: WebGLProgram; loc: Map<string, WebGLUniformLocation | null> };

/** Quality, from cheapest to dearest: [march steps, cloud steps, shadow steps, tree distance]. */
const TIERS: [number, number, number, number][] = [
  [80, 10, 8, 300],
  [110, 14, 12, 520],
  [150, 20, 18, 760],
  [190, 28, 24, 950],
];

export class Renderer {
  private gl: WebGL2RenderingContext;
  private world: Program;
  private down: Program;
  private up: Program;
  private comp: Program;
  private quad: WebGLVertexArrayObject;
  private noise: WebGLTexture;
  private strips: WebGLTexture[] = [];
  private stripInfo: [number, number] = [10, 1];
  private worldTarget: Target | null = null;
  private chain: Target[] = [];
  private ups: Target[] = [];
  private hdr: boolean;
  private format: { internal: number; type: number };
  /** The fraction of the screen the world is drawn at. */
  scale: number;
  private tier: number;
  private maxScale: number;
  private frameTimes: number[] = [];
  private lastFrame = 0;
  private settleUntil = 0;

  constructor(private canvas: HTMLCanvasElement, mobile: boolean) {
    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error("webgl2");
    this.gl = gl;
    this.hdr = !!gl.getExtension("EXT_color_buffer_float") || !!gl.getExtension("EXT_color_buffer_half_float");
    gl.getExtension("OES_texture_float_linear");
    this.format = this.hdr ? { internal: gl.RGBA16F, type: gl.HALF_FLOAT } : { internal: gl.RGBA8, type: gl.UNSIGNED_BYTE };
    this.tier = mobile ? 1 : 2;
    this.scale = mobile ? 0.5 : 0.62;
    this.maxScale = mobile ? 0.7 : 0.85;

    this.world = this.program(WORLD);
    this.down = this.program(DOWN);
    this.up = this.program(UP);
    this.comp = this.program(COMPOSITE);

    const vao = gl.createVertexArray();
    const buf = gl.createBuffer();
    if (!vao || !buf) throw new Error("webgl2");
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.quad = vao;

    this.noise = this.makeNoise();
  }

  private program(fragment: string): Program {
    const gl = this.gl;
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type);
      if (!sh) throw new Error("shader");
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(sh);
        gl.deleteShader(sh);
        throw new Error(`shader: ${log}`);
      }
      return sh;
    };
    const prog = gl.createProgram();
    if (!prog) throw new Error("program");
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragment));
    gl.bindAttribLocation(prog, 0, "aPos");
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`link: ${gl.getProgramInfoLog(prog)}`);
    return { prog, loc: new Map() };
  }

  private u(p: Program, name: string): WebGLUniformLocation | null {
    if (!p.loc.has(name)) p.loc.set(name, this.gl.getUniformLocation(p.prog, name));
    return p.loc.get(name) ?? null;
  }

  /**
   * Random values a texel, with the second channel the first moved by
   * (37, 17) — which is what lets one 2D lookup stand in for a 3D noise.
   */
  private makeNoise(): WebGLTexture {
    const gl = this.gl;
    const N = 256;
    const r = new Uint8Array(N * N);
    let seed = 1234567;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed >>> 24;
    };
    for (let i = 0; i < N * N; i++) r[i] = rand();
    const data = new Uint8Array(N * N * 4);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const i = (y * N + x) * 4;
        data[i] = r[y * N + x];
        data[i + 1] = r[((y + 17) & 255) * N + ((x + 37) & 255)];
        data[i + 2] = rand();
        data[i + 3] = rand();
      }
    }
    const tex = gl.createTexture();
    if (!tex) throw new Error("texture");
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    return tex;
  }

  /** The land along the camera's line, as the director laid it out. */
  setStrip(strip: { data: Float32Array[]; width: number; dz: number }) {
    const gl = this.gl;
    for (const t of this.strips) gl.deleteTexture(t);
    this.strips = strip.data.map((row) => {
      const tex = gl.createTexture();
      if (!tex) throw new Error("texture");
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, strip.width, 1, 0, gl.RGBA, gl.FLOAT, row);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return tex;
    });
    this.stripInfo = [strip.dz, strip.width];
  }

  private target(w: number, h: number): Target {
    const gl = this.gl;
    const tex = gl.createTexture();
    const fb = gl.createFramebuffer();
    if (!tex || !fb) throw new Error("target");
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, this.format.internal, w, h, 0, gl.RGBA, this.format.type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { fb, tex, w, h };
  }

  private drop(t: Target | null) {
    if (!t) return;
    this.gl.deleteFramebuffer(t.fb);
    this.gl.deleteTexture(t.tex);
  }

  /** Make the targets fit the canvas and the scale. */
  private fit() {
    const W = Math.max(2, Math.round(this.canvas.width * this.scale));
    const H = Math.max(2, Math.round(this.canvas.height * this.scale));
    if (this.worldTarget && this.worldTarget.w === W && this.worldTarget.h === H) return;
    this.drop(this.worldTarget);
    this.chain.forEach((t) => this.drop(t));
    this.ups.forEach((t) => this.drop(t));
    this.worldTarget = this.target(W, H);
    this.chain = [];
    this.ups = [];
    let w = W;
    let h = H;
    for (let i = 0; i < 4; i++) {
      w = Math.max(1, w >> 1);
      h = Math.max(1, h >> 1);
      this.chain.push(this.target(w, h));
      if (i < 3) this.ups.push(this.target(w, h));
    }
  }

  /**
   * Keep the frame inside its budget: drawn smaller when frames come slowly,
   * larger again when there is room. Changes are spaced out, so the picture
   * does not pump.
   */
  private budget(now: number) {
    if (this.lastFrame) this.frameTimes.push(now - this.lastFrame);
    this.lastFrame = now;
    if (this.frameTimes.length < 40 || now < this.settleUntil) return;
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const typical = sorted[Math.floor(sorted.length * 0.5)];
    this.frameTimes = [];
    if (typical > 27) {
      if (this.scale > 0.4) this.scale = Math.max(0.36, this.scale - 0.08);
      else if (this.tier > 0) this.tier -= 1;
      this.settleUntil = now + 1500;
    } else if (typical < 15) {
      if (this.tier < TIERS.length - 1 && this.scale >= this.maxScale - 0.05) this.tier += 1;
      else if (this.scale < this.maxScale) this.scale = Math.min(this.maxScale, this.scale + 0.05);
      this.settleUntil = now + 2500;
    }
  }

  resize(width: number, height: number, dpr: number) {
    const ratio = Math.min(dpr, 2);
    const w = Math.max(2, Math.round(width * ratio));
    const h = Math.max(2, Math.round(height * ratio));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  private bind(unit: number, tex: WebGLTexture) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
  }

  render(f: Frame, now: number) {
    const gl = this.gl;
    this.budget(now);
    this.fit();
    const wt = this.worldTarget as Target;
    const [steps, cloudSteps, shadowSteps, treeDist] = TIERS[this.tier];

    // ── the world ───────────────────────────────────────────────────────
    gl.bindVertexArray(this.quad);
    gl.bindFramebuffer(gl.FRAMEBUFFER, wt.fb);
    gl.viewport(0, 0, wt.w, wt.h);
    const w = this.world;
    gl.useProgram(w.prog);
    this.bind(0, this.noise);
    this.strips.forEach((t, i) => this.bind(1 + i, t));
    gl.uniform1i(this.u(w, "uNoise"), 0);
    gl.uniform1i(this.u(w, "uS0"), 1);
    gl.uniform1i(this.u(w, "uS1"), 2);
    gl.uniform1i(this.u(w, "uS2"), 3);
    gl.uniform1i(this.u(w, "uS3"), 4);
    gl.uniform4fv(this.u(w, "uMark"), f.mark);
    gl.uniform3fv(this.u(w, "uHere"), f.here);
    gl.uniform2f(this.u(w, "uStrip"), this.stripInfo[0], this.stripInfo[1]);
    gl.uniform2f(this.u(w, "uRes"), wt.w, wt.h);
    gl.uniform1f(this.u(w, "uTime"), f.time);
    gl.uniform3fv(this.u(w, "uCam"), f.cam);
    gl.uniformMatrix3fv(this.u(w, "uRot"), false, f.rot);
    gl.uniform1f(this.u(w, "uFocal"), f.focal);
    gl.uniform3fv(this.u(w, "uSun"), f.sun);
    gl.uniform3fv(this.u(w, "uMoon"), f.moon);
    gl.uniform3fv(this.u(w, "uSunCol"), f.sunCol);
    gl.uniform3fv(this.u(w, "uMoonCol"), f.moonCol);
    gl.uniform3fv(this.u(w, "uSkyUp"), f.skyUp);
    gl.uniform1f(this.u(w, "uSunI"), f.sunI);
    gl.uniform1f(this.u(w, "uMoonI"), f.moonI);
    gl.uniform4fv(this.u(w, "uA"), f.a);
    gl.uniform4fv(this.u(w, "uB"), f.b);
    gl.uniform4fv(this.u(w, "uC"), f.c);
    gl.uniform4fv(this.u(w, "uD"), f.d);
    gl.uniform3fv(this.u(w, "uFirePos"), f.fire);
    gl.uniform4f(this.u(w, "uQ"), steps, cloudSteps, shadowSteps, treeDist);
    // Eight-bit targets cannot hold the sun a hundred times over the sand, so
    // there the exposure is applied as the world is drawn, and undone after.
    gl.uniform1f(this.u(w, "uOut"), this.hdr ? 1 : f.exposure * 0.5);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // ── the glow ────────────────────────────────────────────────────────
    gl.useProgram(this.down.prog);
    gl.uniform1i(this.u(this.down, "uSrc"), 0);
    let src = wt;
    this.chain.forEach((t, i) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
      gl.viewport(0, 0, t.w, t.h);
      this.bind(0, src.tex);
      gl.uniform2f(this.u(this.down, "uTexel"), 0.5 / src.w, 0.5 / src.h);
      gl.uniform1f(this.u(this.down, "uFirst"), i === 0 ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      src = t;
    });
    gl.useProgram(this.up.prog);
    gl.uniform1i(this.u(this.up, "uSrc"), 0);
    gl.uniform1i(this.u(this.up, "uBase"), 1);
    let small = this.chain[3];
    for (let i = 2; i >= 0; i--) {
      const out = this.ups[i];
      gl.bindFramebuffer(gl.FRAMEBUFFER, out.fb);
      gl.viewport(0, 0, out.w, out.h);
      this.bind(0, small.tex);
      this.bind(1, this.chain[i].tex);
      gl.uniform2f(this.u(this.up, "uTexel"), 1 / small.w, 1 / small.h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      small = out;
    }

    // ── the finish ──────────────────────────────────────────────────────
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    const c = this.comp;
    gl.useProgram(c.prog);
    this.bind(0, wt.tex);
    this.bind(1, this.ups[0].tex);
    this.bind(2, this.chain[2].tex);
    this.bind(3, this.noise);
    gl.uniform1i(this.u(c, "uWorld"), 0);
    gl.uniform1i(this.u(c, "uGlow"), 1);
    gl.uniform1i(this.u(c, "uSoft"), 2);
    gl.uniform1i(this.u(c, "uNoise"), 3);
    gl.uniform2f(this.u(c, "uRes"), this.canvas.width, this.canvas.height);
    gl.uniform1f(this.u(c, "uTime"), f.time);
    gl.uniform1f(this.u(c, "uExposure"), this.hdr ? f.exposure : 1);
    gl.uniform1f(this.u(c, "uIn"), this.hdr ? 1 : 2);
    gl.uniform4fv(this.u(c, "uE"), f.e);
    gl.uniform4fv(this.u(c, "uF"), f.f);
    gl.uniform4fv(this.u(c, "uBolt"), f.bolt);
    gl.uniform4fv(this.u(c, "uMet"), f.meteor);
    gl.uniform2fv(this.u(c, "uMetT"), f.meteorT);
    gl.uniform4fv(this.u(c, "uG"), f.g);
    gl.uniform1f(this.u(c, "uDim"), f.dim);
    gl.uniform2fv(this.u(c, "uNiche"), f.niche);
    gl.uniformMatrix3fv(this.u(c, "uRot"), false, f.rot);
    gl.uniform1f(this.u(c, "uFocal"), f.focal);
    gl.uniform1f(this.u(c, "uTurn"), f.d[0]);
    // Without the range, the exposure was already applied to the world: the
    // lights set over it are given it here instead.
    const lift = this.hdr ? 1 : f.exposure;
    gl.uniform1f(this.u(c, "uStarAmt"), f.starAmt * lift);
    gl.uniform3fv(this.u(c, "uMoonDir"), f.moon);
    gl.uniform3fv(this.u(c, "uSunDir"), f.sun);
    gl.uniform3f(this.u(c, "uMoonP"), f.moonP[0], f.moonP[1], f.moonP[2] * lift);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Whether the GPU can keep the bright parts bright: without it the glow is weaker. */
  get highRange() {
    return this.hdr;
  }

  dispose() {
    const gl = this.gl;
    this.drop(this.worldTarget);
    this.chain.forEach((t) => this.drop(t));
    this.ups.forEach((t) => this.drop(t));
    this.strips.forEach((t) => gl.deleteTexture(t));
    gl.deleteTexture(this.noise);
    [this.world, this.down, this.up, this.comp].forEach((p) => gl.deleteProgram(p.prog));
  }
}
