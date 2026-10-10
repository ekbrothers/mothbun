import type { BuildingArt, Rect } from './assets';

// A building facade with BLINK-style projections and windows that switch on and off.
// Layers, bottom to top: lights-off facade, projected light (screen blended and masked
// to the facade), then each lit window drawn at its own brightness.

interface WindowLight {
  rect: Rect;
  level: number;
  target: number;
  nextToggle: number;
  flicker: number;
}

type Pattern = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void;

const hsl = (h: number, s = 90, l = 50) => `hsl(${((h % 360) + 360) % 360} ${s}% ${l}%)`;

// Original abstract patterns drawn in code. Not based on any real BLINK artwork.
const PATTERNS: Pattern[] = [
  // rising color bands
  (ctx, w, h, t) => {
    const band = 28;
    for (let y = -band; y < h + band; y += band) {
      const yy = Math.round(((y - t * 40) % (h + band * 2) + h + band * 2) % (h + band * 2) - band);
      ctx.fillStyle = hsl(y * 2 + t * 30, 85, 42);
      ctx.fillRect(0, yy, w, band);
    }
  },
  // rings pulsing out from the center
  (ctx, w, h, t) => {
    ctx.fillStyle = '#100830';
    ctx.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h * 0.45;
    const step = 36, grow = (t * 60) % step;
    // largest first so smaller rings paint over it
    for (let r = Math.hypot(w, h) / 2 + step; r > 0; r -= step) {
      const ring = Math.round((r - grow) / step);
      ctx.fillStyle = hsl(280 + ring * 25 + t * 20, 90, ring % 2 ? 42 : 14);
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(0, r - grow), 0, Math.PI * 2);
      ctx.fill();
    }
  },
  // diagonal stripes sweeping across
  (ctx, w, h, t) => {
    ctx.fillStyle = '#081830';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.rotate(-0.5);
    for (let x = -h; x < w + h; x += 48) {
      ctx.fillStyle = hsl(170 + x * 0.3 + t * 25, 90, 45);
      ctx.fillRect(x + ((t * 90) % 48), -h, 18, h * 3);
    }
    ctx.restore();
  },
  // tiles flipping color
  (ctx, w, h, t) => {
    const s = 24;
    for (let y = 0; y < h; y += s)
      for (let x = 0; x < w; x += s) {
        const k = Math.sin(x * 0.07 + y * 0.05 + t * 2.2) + Math.sin(x * 0.02 - t * 1.3);
        ctx.fillStyle = hsl(30 + k * 60 + t * 15, 90, k > 0.6 ? 50 : 14);
        ctx.fillRect(x, y, s, s);
      }
  },
];

const SHOW_LEN = 7; // seconds per pattern
const FADE = 0.8;

export class BuildingView {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private light: HTMLCanvasElement;
  private lightCtx: CanvasRenderingContext2D;
  private windows: WindowLight[];
  private showOffset: number;

  constructor(private art: BuildingArt, seed: number) {
    const { width: w, height: h } = art.dark;
    [this.canvas, this.ctx] = makeCanvas(w, h);
    [this.light, this.lightCtx] = makeCanvas(w, h);
    this.showOffset = seed * 3.1;
    this.windows = art.windows.map((rect) => {
      const on = Math.random() < 0.7;
      return { rect, level: on ? 1 : 0, target: on ? 1 : 0, nextToggle: Math.random() * 8, flicker: 0 };
    });
  }

  get width() {
    return this.canvas.width;
  }
  get height() {
    return this.canvas.height;
  }

  // Projection strength 0..1 and which pattern is up at time t.
  private show(t: number) {
    const st = t + this.showOffset;
    const cycle = SHOW_LEN * PATTERNS.length + 4; // a short dark gap between full cycles
    const ct = st % cycle;
    if (ct >= SHOW_LEN * PATTERNS.length) return { strength: 0, pattern: 0, time: st };
    const pattern = Math.floor(ct / SHOW_LEN);
    const local = ct % SHOW_LEN;
    const strength = Math.min(1, local / FADE, (SHOW_LEN - local) / FADE);
    return { strength, pattern, time: st };
  }

  update(dt: number, t: number) {
    const { strength } = this.show(t);
    for (const w of this.windows) {
      w.nextToggle -= dt;
      if (w.nextToggle <= 0) {
        // during a show most windows go dark so the projection reads
        const pOn = strength > 0.5 ? 0.15 : 0.75;
        const on = Math.random() < pOn;
        if (on && w.target === 0) w.flicker = 0.35;
        w.target = on ? 1 : 0;
        w.nextToggle = 2 + Math.random() * 7;
      }
      const speed = w.target > w.level ? 6 : 3;
      w.level += Math.sign(w.target - w.level) * Math.min(Math.abs(w.target - w.level), speed * dt);
      if (w.flicker > 0) w.flicker -= dt;
    }
  }

  render(t: number): HTMLCanvasElement {
    const { ctx, art } = this;
    const { width: w, height: h } = this.canvas;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(art.dark, 0, 0);

    const show = this.show(t);
    if (show.strength > 0) {
      const lc = this.lightCtx;
      lc.globalCompositeOperation = 'source-over';
      lc.clearRect(0, 0, w, h);
      PATTERNS[show.pattern](lc, w, h, show.time);
      lc.globalCompositeOperation = 'destination-in';
      lc.drawImage(art.dark, 0, 0);
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.75 * show.strength;
      ctx.drawImage(this.light, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    }

    for (const win of this.windows) {
      let a = win.level;
      if (win.flicker > 0) a *= Math.random() < 0.5 ? 0.2 : 1;
      if (a < 0.02) continue;
      const [x, y, rw, rh] = win.rect;
      ctx.globalAlpha = a;
      ctx.drawImage(art.lights, x, y, rw, rh, x, y, rw, rh);
    }
    ctx.globalAlpha = 1;
    return this.canvas;
  }
}

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}
