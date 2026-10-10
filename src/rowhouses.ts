import { makeCanvas } from './building';

// Over-the-Rhine style brick rowhouses drawn in code, filling the street between the
// landmark buildings. Each house is rendered once to its own canvas.
// `at` is the camera position where the house is centered on screen, the same
// convention the landmark pieces use.

export interface Rowhouse {
  at: number;
  canvas: HTMLCanvasElement;
}

const BRICKS = ['#5a2a2c', '#4f3326', '#433a4c', '#5b4030', '#4a2f42', '#3c3f50'];
const OUTLINE = '#0b0914';
const STORY = 46;

// Seeded random so the street looks the same on every run.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * f))));
  return `rgb(${c[0]} ${c[1]} ${c[2]})`;
}

function drawHouse(rand: () => number): HTMLCanvasElement {
  const stories = 3 + Math.floor(rand() * 2);
  const cols = rand() < 0.5 ? 3 : 2;
  const w = cols === 3 ? 76 + Math.floor(rand() * 10) : 56 + Math.floor(rand() * 10);
  const h = stories * STORY + 22;
  const [c, ctx] = makeCanvas(w + 4, h);
  const brick = BRICKS[Math.floor(rand() * BRICKS.length)];

  // body and brick texture
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(2, 8, w, h - 8);
  ctx.fillStyle = brick;
  ctx.fillRect(3, 9, w - 2, h - 10);
  ctx.fillStyle = shade(brick, 0.8);
  for (let i = 0; i < (w * h) / 40; i++) ctx.fillRect(3 + Math.floor(rand() * (w - 4)), 9 + Math.floor(rand() * (h - 10)), 2, 1);

  // bracketed cornice
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(0, 0, w + 4, 12);
  ctx.fillStyle = shade(brick, 0.55);
  ctx.fillRect(1, 1, w + 2, 9);
  ctx.fillStyle = shade(brick, 1.25);
  ctx.fillRect(1, 1, w + 2, 2);
  for (let x = 5; x < w; x += 9) {
    ctx.fillStyle = shade(brick, 0.4);
    ctx.fillRect(x, 10, 3, 5);
  }

  // windows: tall and narrow with stone lintels and sills
  const ww = 10, wh = 24;
  const gap = (w - cols * ww) / (cols + 1);
  for (let st = 0; st < stories - 1; st++) {
    const y = 22 + st * STORY;
    for (let i = 0; i < cols; i++) {
      const x = Math.round(3 + gap + i * (ww + gap));
      const lit = rand() < 0.35;
      ctx.fillStyle = '#8c8296';
      ctx.fillRect(x - 2, y - 4, ww + 4, 3);
      ctx.fillRect(x - 1, y + wh + 1, ww + 2, 2);
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x - 1, y - 1, ww + 2, wh + 2);
      ctx.fillStyle = lit ? '#d99a48' : '#1c1a36';
      ctx.fillRect(x, y, ww, wh);
      ctx.fillStyle = lit ? '#f4cf86' : '#2c2a4e';
      ctx.fillRect(x + 1, y + 1, ww - 2, Math.floor(wh / 2) - 1);
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x, y + Math.floor(wh / 2), ww, 1);
    }
  }

  // ground floor: a door with a transom, and a shop window or another window
  const gy = 22 + (stories - 1) * STORY;
  const doorX = rand() < 0.5 ? 8 : w - 22;
  ctx.fillStyle = '#8c8296';
  ctx.fillRect(3, gy - 6, w - 2, 3);
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(doorX - 1, gy + 2, 16, h - gy - 2);
  ctx.fillStyle = '#2a1a1e';
  ctx.fillRect(doorX, gy + 9, 14, h - gy - 9);
  ctx.fillStyle = rand() < 0.5 ? '#e0a650' : '#26244a';
  ctx.fillRect(doorX, gy + 3, 14, 5);
  const shopX = doorX < w / 2 ? doorX + 22 : 8;
  const shopW = w - 36;
  if (shopW > 14) {
    const lit = rand() < 0.5;
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(shopX - 1, gy + 4, shopW + 2, 26);
    ctx.fillStyle = lit ? '#c98a44' : '#1c1a36';
    ctx.fillRect(shopX, gy + 5, shopW, 24);
    ctx.fillStyle = lit ? '#efc27a' : '#2c2a4e';
    ctx.fillRect(shopX + 1, gy + 6, shopW - 2, 8);
  }
  return c;
}

// Fills [from, to] with houses, leaving the `skip` ranges open for landmarks and the river.
export function buildRowhouses(from: number, to: number, skip: [number, number][], parallax: number): Rowhouse[] {
  const rand = rng(1859);
  const houses: Rowhouse[] = [];
  let at = from;
  while (at < to) {
    const canvas = drawHouse(rand);
    const span = canvas.width / parallax;
    const center = at + span / 2;
    if (!skip.some(([a, b]) => center + span / 2 > a && center - span / 2 < b)) houses.push({ at: center, canvas });
    // houses share walls, with the odd alley between blocks
    at += span + (rand() < 0.15 ? 30 / parallax : -2 / parallax);
  }
  return houses;
}
