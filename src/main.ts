import { loadAssets, type Assets } from './assets';
import { Sound } from './audio';
import { BuildingView, makeCanvas } from './building';
import { Input, type Zone } from './input';
import { pixelText, tint } from './pixel-text';
import { buildRowhouses, type Rowhouse } from './rowhouses';
import { Player } from './player';
import { TUNING as T } from './tuning';
import { KINDS, World, box as hitbox, type Obstacle } from './world';

// Internal resolution: 560 art pixels tall, width follows the screen's aspect ratio.
const VH = 560;
const STREET = 56; // height of sidewalk + road below the ground line
const FONT = '"Press Start 2P", monospace';
const RIVER = 34; // river height above the ground line

type State = 'loading' | 'title' | 'playing' | 'finale' | 'clear' | 'over';

// Level 1 front-loads the landmarks so even a short play sees them: Music Hall, the
// Roebling Bridge, Mother of God, and Union Terminal all pass in the first half minute. Rowhouses fill
// the rest, and Mother of God returns at the end for the finale. Each set piece is centered on screen when the camera reaches
// `at`, and scrolls at its own parallax (farther back is slower).
interface Piece {
  view: BuildingView;
  at: number;
  parallax: number;
  bridge?: boolean;
}

// camera positions where each early landmark is centered
const BRIDGE_AT = 3200;
const CHURCH_EARLY_AT = 6500;
const MUSEUM_AT = 7900; // Cincinnati Museum Center at Union Terminal

const params = new URLSearchParams(location.search);
const demo = params.has('demo'); // plays itself
const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const input = new Input(canvas, zoneAt);
const sound = new Sound();
const player = new Player();
const world = new World((kind) => assets.vehicles[KINDS[kind].sprite].variants ?? 1);
input.onGesture = () => sound.unlock();

let assets: Assets;
let pieces: Piece[] = [];
let rowhouses: Rowhouse[] = [];
const STREET_PARALLAX = 0.6;
let church: BuildingView;
let state: State = 'loading';
let W = 0, H = VH, ground = VH - STREET;
let time = Number(params.get('t')) || 0; // ?t=<seconds> offsets the projection clock
let camX = 0, speed = T.startSpeed, brakeFrom = 0;
let lives = T.lives, orbCount = 0, stuns = 0, distance = 0, bonus = 0;
let best = readBest(), shake = 0, stateT = 0, nextBurst = 0;

interface Spark { x: number; y: number; vx: number; vy: number; life: number; hue: number }
let sparks: Spark[] = [];

const stars = Array.from({ length: 160 }, () => ({ x: Math.random(), y: Math.random() * 0.75, b: Math.random() }));
const skyline = buildSkyline(2400);

function resize() {
  H = VH;
  W = Math.max(1, Math.round((innerWidth * VH) / innerHeight));
  canvas.width = W;
  canvas.height = H;
  ground = H - STREET;
  ctx.imageSmoothingEnabled = false;
}

const portrait = () => W < VH * 1.1;
const score = () => Math.floor(distance / 10) + orbCount * T.orbPoints + stuns * T.stunPoints + bonus;
const playerX = () => Math.round(Math.min(W * 0.25, 260));

// on-screen buttons, in art pixels
const glareBtn = () => ({ x: 74, y: H - 84, r: 42 });
const muteBtn = () => ({ x: W - 46, y: 10, w: 34, h: 30 });

function zoneAt(x: number, y: number): Zone {
  const m = muteBtn();
  if (x >= m.x && x <= m.x + m.w && y >= m.y && y <= m.y + m.h) return 'mute';
  const g = glareBtn();
  if (state === 'playing' && Math.hypot(x - g.x, y - g.y) <= g.r + 24) return 'glare';
  return 'jump';
}

function setState(s: State) {
  state = s;
  stateT = 0;
  input.consume();
}

function startRun() {
  setState('playing');
  player.reset();
  camX = 0;
  speed = T.startSpeed;
  brakeFrom = 0;
  lives = T.lives;
  orbCount = stuns = distance = bonus = 0;
  sparks = [];
  church.finale = false;
  world.reset(camX);
}

function saveBest() {
  if (score() <= best) return;
  best = score();
  try {
    localStorage.setItem('mothbun-best', String(best));
  } catch {
    /* storage blocked, keep best for this session only */
  }
}

function readBest(): number {
  try {
    return Number(localStorage.getItem('mothbun-best')) || 0;
  } catch {
    return 0;
  }
}

// ---------- update ----------

function update(dt: number) {
  time += dt;
  stateT += dt;
  for (const p of pieces) p.view.update(dt, time);
  shake = Math.max(0, shake - dt * 3);
  updateSparks(dt);
  if (input.takeMute()) sound.toggleMute();

  const tapped = demo || input.pressedWithin(200);
  switch (state) {
    case 'title':
      if (tapped && !portrait()) startRun();
      return;
    case 'over':
    case 'clear':
      if (stateT > 1 && tapped) startRun();
      return;
    case 'finale':
      updateFinale(dt, tapped);
      return;
    case 'playing':
      if (!portrait()) updateRun(dt);
      return;
  }
}

function updateRun(dt: number) {
  const remaining = T.levelLength - distance;
  const progress = Math.min(1, distance / T.levelLength);
  speed = T.startSpeed + (T.maxSpeed - T.startSpeed) * progress;
  if (remaining < T.brakeDistance) {
    if (!brakeFrom) brakeFrom = speed;
    speed = Math.max(30, brakeFrom * Math.sqrt(Math.max(0, remaining) / T.brakeDistance));
  }
  const step = Math.min(speed * dt, Math.max(0, remaining));
  camX += step;
  distance += step;

  const px = camX + playerX();
  const b = Player.BODY;
  world.update(dt, camX, px, W, speed, progress, T.levelLength - T.brakeDistance - 500 + playerX());

  // the roof he's standing on, or one he's above and could land on
  let floor = 0;
  for (const o of world.obstacles) {
    const h = hitbox(o);
    if (KINDS[o.kind].platform && !o.hit && px + b.right > h.x0 && px + b.left < h.x1 && player.y >= h.top - 2) floor = Math.max(floor, h.top);
  }

  if (demo) autopilot();
  if (input.takeGlare() && player.tryGlare()) sound.glare();
  if (player.update(dt, input, speed, floor)) sound.jump();

  for (const o of world.obstacles) {
    if (o.kind === 'streetcar' && !o.warned && o.x - camX < W + KINDS.streetcar.margin + 20) {
      o.warned = true;
      sound.bell();
    }
  }

  // glare beam knocks scooter riders off and stops strollers; it does nothing to the big vehicles
  if (player.glareT > 0) {
    const x0 = px + Player.EYE.x, x1 = x0 + T.glareRange;
    const ey = player.y + Player.EYE.y;
    for (const o of world.obstacles) {
      if (KINDS[o.kind].platform || o.hit || o.stunned >= 0) continue;
      const h = hitbox(o);
      if (h.x0 < x1 && h.x1 > x0 && ey - T.glareHeight / 2 < h.top) {
        o.stunned = 0;
        stuns++;
        sound.stun();
      }
    }
  }

  const box = { x0: px + b.left, x1: px + b.right, y0: player.y + b.bottom, y1: player.y + b.top };
  for (const o of world.obstacles) {
    if (o.hit || o.stunned >= 0) continue;
    const h = hitbox(o);
    if (!(box.x1 > h.x0 && box.x0 < h.x1 && box.y0 < h.top)) continue;
    // still blinking from the last hit: let him pass through instead of hitting it twice
    if (player.invuln > 0) {
      if (KINDS[o.kind].platform) o.hit = true;
      continue;
    }
    o.hit = true;
    lives--;
    player.invuln = 1.4;
    shake = 1;
    sound.hit();
    if (lives <= 0) {
      saveBest();
      sound.over();
      return setState('over');
    }
  }
  for (const orb of world.orbs) {
    if (orb.x > box.x0 - 10 && orb.x < box.x1 + 10 && orb.y > box.y0 - 10 && orb.y < box.y1 + 10) {
      orb.taken = true;
      orbCount++;
      sound.orb();
    }
  }

  if (remaining <= 0 && player.grounded) {
    setState('finale');
    church.finale = true;
    nextBurst = 0.6;
  }
}

function updateFinale(dt: number, tapped: boolean) {
  player.update(dt, input, 0);
  nextBurst -= dt;
  if (nextBurst <= 0 && stateT < 6.5) {
    burst();
    nextBurst = 0.35 + Math.random() * 0.4;
  }
  if (stateT > 8 || (stateT > 2 && tapped)) {
    church.finale = false;
    bonus = lives * T.lifeBonus;
    saveBest();
    sound.clear();
    setState('clear');
  }
}

function burst() {
  const cx = W / 2 + (Math.random() - 0.5) * Math.min(W * 0.6, 520);
  const cy = 70 + Math.random() * 130;
  const hue = Math.random() * 360;
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2, v = 70 + Math.random() * 90;
    sparks.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1.1 + Math.random() * 0.4, hue: hue + Math.random() * 40 });
  }
  sound.pop();
}

function updateSparks(dt: number) {
  for (const s of sparks) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vy += 70 * dt;
    s.life -= dt;
  }
  sparks = sparks.filter((s) => s.life > 0);
}

function autopilot() {
  const px = camX + playerX();
  const ahead = world.obstacles
    .filter((o) => !o.hit && o.stunned < 0 && hitbox(o).x1 > px + Player.BODY.left)
    .sort((a, b) => hitbox(a).x0 - hitbox(b).x0);
  const scooter = ahead.find((o) => !KINDS[o.kind].platform && hitbox(o).x0 - px < 260);
  if (scooter && player.grounded && player.y === 0) input.queueGlare();
  // jump scooters when the glare is cooling down, and jump onto roofs ahead
  const next = ahead.find((o) => KINDS[o.kind].platform || (player.glareCd > 0 && player.glareT <= 0));
  // seconds until it reaches him, counting its own speed
  const eta = next ? (hitbox(next).x0 - px - Player.BODY.right) / (speed - next.vx) : Infinity;
  const onIt = next ? player.y >= KINDS[next.kind].h : false;
  const jumpAt = { scooter: 0.3, stroller: 0.3, wagon: 0.38, streetcar: 0.35 }[next?.kind ?? 'scooter'];
  if (player.grounded) input.set(!onIt && eta > 0 && eta < jumpAt);
  else input.set(player.vy > 0);
}

// ---------- drawing ----------

function draw() {
  ctx.save();
  if (shake > 0) ctx.translate(Math.round((Math.random() - 0.5) * 8 * shake), Math.round((Math.random() - 0.5) * 6 * shake));
  drawSky();
  drawSkyline();
  drawSparks(); // fireworks go off behind the buildings
  drawRowhouses();
  for (const p of pieces) drawPiece(p);
  drawStreet();
  if (state !== 'title') {
    drawOrbs();
    for (const o of world.obstacles) drawObstacle(o);
  }
  drawPlayer();
  drawBeam();
  ctx.restore();

  if (state === 'title') drawTitle();
  if (state === 'playing' || state === 'finale') drawHud();
  if (state === 'over') drawGameOver();
  if (state === 'clear') drawClear();
  drawMute();
  if (portrait() && (state === 'title' || state === 'playing')) drawRotateHint();
}

function drawSky() {
  const g = ctx.createLinearGradient(0, 0, 0, ground);
  g.addColorStop(0, '#0d0a22');
  g.addColorStop(1, '#2b2152');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#d8d2f0';
  for (const s of stars) {
    const x = (((s.x * W * 2 - camX * 0.05) % W) + W) % W;
    ctx.globalAlpha = 0.35 + 0.65 * s.b * (0.8 + 0.2 * Math.sin(time * 2 + s.x * 40));
    ctx.fillRect(Math.round(x), Math.round(s.y * ground), 2, 2);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#efe6c9';
  ctx.beginPath();
  ctx.arc(Math.round(W * 0.82), 78, 26, 0, Math.PI * 2);
  ctx.fill();
}

interface SkyBlock { x: number; w: number; h: number; lit: [number, number][] }

function buildSkyline(width: number): { width: number; blocks: SkyBlock[] } {
  const blocks: SkyBlock[] = [];
  for (let x = 0; x < width; ) {
    const w = 40 + Math.floor(Math.random() * 90);
    const h = 60 + Math.floor(Math.random() * 170);
    const lit: [number, number][] = [];
    for (let i = 0; i < (w * h) / 900; i++) {
      lit.push([4 + Math.floor((Math.random() * (w - 8)) / 6) * 6, 6 + Math.floor((Math.random() * (h - 12)) / 8) * 8]);
    }
    blocks.push({ x, w, h, lit });
    x += w + Math.floor(Math.random() * 10);
  }
  return { width, blocks };
}

function drawSkyline() {
  const off = (((camX * 0.25) % skyline.width) + skyline.width) % skyline.width;
  for (const rep of [0, skyline.width, skyline.width * 2]) {
    for (const b of skyline.blocks) {
      const x = Math.round(b.x + rep - off);
      if (x > W || x + b.w < 0) continue;
      ctx.fillStyle = '#1b1640';
      ctx.fillRect(x, ground - b.h, b.w, b.h);
      ctx.fillStyle = '#c9a25e';
      for (const [lx, ly] of b.lit) ctx.fillRect(x + lx, ground - b.h + ly, 2, 3);
    }
  }
}

function drawRowhouses() {
  for (const r of rowhouses) {
    const x = Math.round(W / 2 - r.canvas.width / 2 + (r.at - camX) * STREET_PARALLAX);
    if (x > W || x + r.canvas.width < 0) continue;
    ctx.drawImage(r.canvas, x, ground - r.canvas.height);
  }
}

function drawPiece(p: Piece) {
  const v = p.view;
  const x = Math.round(W / 2 - v.width / 2 + (p.at - camX) * p.parallax);
  if (p.bridge) {
    const rx = x - 140, rw = v.width + 220;
    if (rx > W || rx + rw < 0) return;
    drawRiver(x, rx, rw, v.width);
    ctx.drawImage(v.render(time), x, ground - RIVER + 10 - v.height);
    return;
  }
  if (x > W || x + v.width < 0) return;
  ctx.drawImage(v.render(time), x, ground - v.height);
}

function drawRiver(x: number, rx: number, rw: number, bw: number) {
  const g = ctx.createLinearGradient(rx, 0, rx + rw, 0);
  g.addColorStop(0, 'rgba(16, 20, 52, 0)');
  g.addColorStop(0.15, 'rgba(16, 20, 52, 1)');
  g.addColorStop(0.85, 'rgba(16, 20, 52, 1)');
  g.addColorStop(1, 'rgba(16, 20, 52, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(rx, ground - RIVER, rw, RIVER);
  // light from the cables shimmering on the water
  for (let i = 0; i < 26; i++) {
    const sx = x + 20 + ((i * 97) % (bw - 60));
    const sy = ground - RIVER + 12 + ((i * 7) % (RIVER - 16));
    const on = Math.sin(time * 3 + i * 1.7) > 0.2;
    ctx.fillStyle = on ? 'rgba(255, 190, 90, 0.55)' : 'rgba(120, 150, 255, 0.35)';
    ctx.fillRect(sx + Math.round(Math.sin(time * 2 + i) * 2), sy, 6 + (i % 3) * 2, 1);
  }
}

function drawStreet() {
  ctx.fillStyle = '#4a4458';
  ctx.fillRect(0, ground, W, 8);
  ctx.fillStyle = '#2c2836';
  ctx.fillRect(0, ground + 8, W, H - ground - 8);
  ctx.fillStyle = '#6b6478';
  const seam = 32;
  for (let i = -1; i < W / seam + 2; i++) ctx.fillRect(Math.round(i * seam - (camX % seam)), ground, 2, 8);
  ctx.fillStyle = '#5c5468';
  const dash = 96;
  for (let i = -1; i < W / dash + 2; i++) ctx.fillRect(Math.round(i * dash - (camX % dash)), ground + 30, 40, 4);
}

function drawPlayer() {
  const { meta, sheet } = assets;
  const { frameWidth: fw, frameHeight: fh, anchor } = meta;
  if (player.invuln > 0 && Math.floor(time * 16) % 2 === 0) return;
  const { row, col } =
    state === 'playing' ? player.frame(meta.rows) : { row: meta.rows.idle, col: Math.floor(time * 3) % 4 };
  const k = T.playerScale;
  const x = Math.round(playerX() - anchor.x * k);
  const y = Math.round(ground - player.y - anchor.y * k);
  ctx.drawImage(sheet, col * fw, row * fh, fw, fh, x, y, Math.round(fw * k), Math.round(fh * k));
}

function drawBeam() {
  if (player.glareT <= 0) return;
  const a = player.glareT / T.glareDuration;
  const x = playerX() + Player.EYE.x;
  const y = Math.round(ground - player.y - Player.EYE.y);
  const len = Math.round(T.glareRange * Math.min(1, (1 - a) * 4 + 0.2));
  ctx.globalAlpha = 0.25 * a;
  ctx.fillStyle = '#ff2a2a';
  ctx.fillRect(x, y - T.glareHeight / 2, len, T.glareHeight);
  ctx.globalAlpha = 0.9 * a * (Math.random() < 0.15 ? 0.5 : 1);
  ctx.fillRect(x, y - 3, len, 6);
  ctx.fillStyle = '#ffd0c0';
  ctx.fillRect(x, y - 1, len, 2);
  ctx.fillRect(x - 4, y - 4, 8, 8);
  ctx.globalAlpha = 1;
}

function drawObstacle(o: Obstacle) {
  const strip = assets.vehicles[KINDS[o.kind].sprite];
  const { frameWidth: fw, frameHeight: fh } = strip;
  const x = Math.round(o.x - camX);
  if (x > W || x + fw < 0) return;
  let f: number;
  if (o.kind === 'scooter') f = o.stunned >= 0 ? 4 : Math.floor(time * 8) % 4;
  else if (o.kind === 'stroller') f = o.stunned >= 0 ? 4 : Math.floor(time * 6) % 4;
  else if (o.kind === 'wagon') f = Math.floor(time * 6) % 4;
  else f = Math.floor(time * 3) % 2;
  ctx.globalAlpha = o.hit ? 0.35 : o.kind === 'scooter' && o.stunned > 1.2 ? Math.max(0, 1 - (o.stunned - 1.2) * 2) : 1;
  const sy = o.variant * fh;
  if (o.vx < 0 && o.kind === 'streetcar') {
    // the art faces right; mirror it so it drives toward Mothbun
    ctx.save();
    ctx.translate(x + fw, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(strip.img, f * fw, sy, fw, fh, 0, ground - fh, fw, fh);
    ctx.restore();
  } else {
    ctx.drawImage(strip.img, f * fw, sy, fw, fh, x, ground - fh, fw, fh);
  }
  ctx.globalAlpha = 1;
}

function drawOrbs() {
  for (const o of world.orbs) {
    const x = Math.round(o.x - camX);
    if (x < -20 || x > W + 20) continue;
    const y = Math.round(ground - o.y + Math.sin(time * 4 + o.phase) * 3);
    const hue = (time * 60 + o.x * 0.2) % 360;
    ctx.fillStyle = `hsl(${hue} 90% 60% / 0.25)`;
    ctx.fillRect(x - 8, y - 8, 16, 16);
    ctx.fillStyle = `hsl(${hue} 90% 65%)`;
    ctx.fillRect(x - 5, y - 5, 10, 10);
    ctx.fillStyle = '#fffbe8';
    ctx.fillRect(x - 2, y - 2, 4, 4);
  }
}

function drawSparks() {
  for (const s of sparks) {
    ctx.globalAlpha = Math.min(1, s.life * 1.5);
    ctx.fillStyle = `hsl(${s.hue % 360} 95% 62%)`;
    ctx.fillRect(Math.round(s.x) - 2, Math.round(s.y) - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
}

function text(str: string, x: number, y: number, size = 16, color = '#f3eedc', align: CanvasTextAlign = 'left') {
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#0b0914';
  ctx.fillText(str, x + 2, y + 2);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

// "GOES TO BLINK" under the logo, in the pixel font at the logo's pixel size.
// Each BLINK letter has its own color cycle and blinks out now and then.
let subtitle: { goesTo: HTMLCanvasElement; letters: HTMLCanvasElement[]; tinted: HTMLCanvasElement[] };

function buildSubtitle() {
  const letters = [...'BLINK'].map((ch) => pixelText(ch, 16, FONT));
  subtitle = {
    goesTo: tint(pixelText('GOES TO', 8, FONT), '#e8e2d0'),
    letters,
    tinted: letters.map((l) => makeCanvas(l.width, l.height)[0]),
  };
}

function drawTitle() {
  const { logo } = assets;
  const s = Math.max(1, Math.floor(Math.min((W * 0.92) / logo.width, 220 / logo.height)));
  const lw = logo.width * s, lh = logo.height * s;
  const bob = Math.round(Math.sin(time * 1.5) * 3);
  const lx = Math.round((W - lw) / 2), ly = Math.round(H * 0.04) + bob;
  ctx.drawImage(logo, lx, ly, lw, lh);

  // subtitle in native pixels: GOES TO (8 px tall) beside BLINK (16 px tall), bottoms aligned
  const { goesTo, letters, tinted } = subtitle;
  const gap = 6, letterW = 16;
  const nativeW = goesTo.width + gap + letterW * letters.length + 2;
  const sx = Math.round(W / 2 - (nativeW * s) / 2);
  const sy = ly + lh - s * 2;
  ctx.drawImage(goesTo, sx, sy + 8 * s, goesTo.width * s, goesTo.height * s);
  letters.forEach((l, i) => {
    const off = (time * 1.3 + i * 0.41) % 4;
    if (off < 0.09) return; // a quick blink
    tint(l, `hsl(${(time * 70 + i * 55) % 360} 95% 62%)`, tinted[i]);
    ctx.drawImage(tinted[i], sx + (goesTo.width + gap + i * letterW) * s, sy, l.width * s, l.height * s);
  });

  const below = sy + 18 * s + 18;
  if (Math.floor(time * 1.6) % 2 === 0 && !portrait()) text('TAP TO START', W / 2, below, 16, '#f3eedc', 'center');
  text('TAP: JUMP   HOLD: GLIDE   EYE BUTTON OR X: GLARE', W / 2, H - 30, 8, '#b9b0d6', 'center');
  if (best > 0) text(`BEST ${best}`, 16, 16, 8, '#b9b0d6');
}

function drawHud() {
  text(`SCORE ${String(score()).padStart(6, '0')}`, 16, 16, 16);
  for (let i = 0; i < T.lives; i++) {
    const x = W - 76 - i * 26;
    ctx.fillStyle = '#0b0914';
    ctx.fillRect(x - 2, 14, 18, 18);
    ctx.fillStyle = i < lives ? '#ff2a2a' : '#3a2230';
    ctx.fillRect(x, 16, 14, 14);
    if (i < lives) {
      ctx.fillStyle = '#ffb0a0';
      ctx.fillRect(x + 3, 19, 4, 4);
    }
  }

  // progress from Music Hall to Mother of God
  const bw = Math.min(260, W * 0.25), bx = Math.round(W / 2 - bw / 2), by = 22;
  const f = Math.min(1, distance / T.levelLength);
  ctx.fillStyle = '#0b0914';
  ctx.fillRect(bx - 2, by - 2, bw + 4, 8);
  ctx.fillStyle = '#3a3358';
  ctx.fillRect(bx, by, bw, 4);
  ctx.fillStyle = '#ff2a2a';
  ctx.fillRect(bx, by, Math.round(bw * f), 4);
  ctx.fillStyle = '#f3eedc';
  ctx.fillRect(bx + bw - 3, by - 6, 4, 16);

  if (state === 'playing') drawGlareButton();
}

function drawGlareButton() {
  const { x, y, r } = glareBtn();
  const ready = player.glareCd <= 0;
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#0b0914';
  ctx.beginPath();
  ctx.arc(x, y, r + 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ready ? '#3a1020' : '#1c1426';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  if (!ready) {
    // cooldown sweep
    ctx.fillStyle = '#3a1020';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - player.glareCd / T.glareCooldown));
    ctx.fill();
  }
  // a pixel eye
  ctx.globalAlpha = ready ? 1 : 0.5;
  ctx.fillStyle = '#ff2a2a';
  ctx.fillRect(x - 18, y - 6, 36, 12);
  ctx.fillRect(x - 12, y - 12, 24, 24);
  ctx.fillStyle = '#ffd0c0';
  ctx.fillRect(x - 4, y - 4, 8, 8);
  ctx.globalAlpha = 1;
  // label for the first few seconds of a run
  if (stateT < 6 && Math.floor(time * 3) % 2 === 0) text('GLARE', x, y - r - 22, 8, '#ffb0a0', 'center');
}

function drawMute() {
  if (state === 'loading') return;
  const { x, y, w, h } = muteBtn();
  ctx.fillStyle = 'rgba(11, 9, 20, 0.6)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#d8d2f0';
  ctx.fillRect(x + 7, y + 11, 5, 8);
  ctx.fillRect(x + 12, y + 8, 3, 14);
  ctx.fillRect(x + 15, y + 5, 3, 20);
  if (sound.muted) {
    ctx.fillStyle = '#ff4a3a';
    for (let i = 0; i < 9; i++) {
      ctx.fillRect(x + 20 + i, y + 10 + i, 2, 2);
      ctx.fillRect(x + 28 - i, y + 10 + i, 2, 2);
    }
  } else {
    ctx.fillRect(x + 21, y + 11, 2, 8);
    ctx.fillRect(x + 25, y + 8, 2, 14);
  }
}

function drawGameOver() {
  ctx.fillStyle = 'rgba(8, 6, 20, 0.6)';
  ctx.fillRect(0, 0, W, H);
  text('GAME OVER', W / 2, H * 0.28, 32, '#ff4a3a', 'center');
  text(`SCORE ${score()}`, W / 2, H * 0.28 + 64, 16, '#f3eedc', 'center');
  text(`BEST ${best}`, W / 2, H * 0.28 + 92, 16, '#b9b0d6', 'center');
  if (stateT > 1 && Math.floor(time * 1.6) % 2 === 0) text('TAP TO TRY AGAIN', W / 2, H * 0.28 + 150, 16, '#f3eedc', 'center');
}

function drawClear() {
  ctx.fillStyle = 'rgba(8, 6, 20, 0.55)';
  ctx.fillRect(0, 0, W, H);
  const top = H * 0.16;
  text('LEVEL CLEAR', W / 2, top, 32, `hsl(${(time * 70) % 360} 95% 65%)`, 'center');
  const rows: [string, number][] = [
    ['DISTANCE', Math.floor(distance / 10)],
    [`ORBS x${orbCount}`, orbCount * T.orbPoints],
    [`STUNS x${stuns}`, stuns * T.stunPoints],
    [`LIVES x${lives}`, bonus],
  ];
  rows.forEach(([label, pts], i) => {
    text(label, W / 2 - 170, top + 70 + i * 28, 16, '#d8d2f0');
    text(String(pts), W / 2 + 170, top + 70 + i * 28, 16, '#f3eedc', 'right');
  });
  text(`SCORE ${score()}`, W / 2, top + 196, 16, '#ffe08a', 'center');
  text(`BEST ${best}`, W / 2, top + 224, 16, '#b9b0d6', 'center');
  if (stateT > 1 && Math.floor(time * 1.6) % 2 === 0) text('TAP TO PLAY AGAIN', W / 2, top + 270, 16, '#f3eedc', 'center');
}

function drawRotateHint() {
  ctx.fillStyle = 'rgba(8, 6, 20, 0.75)';
  ctx.fillRect(0, H * 0.55, W, 90);
  text('TURN YOUR PHONE', W / 2, H * 0.55 + 24, 16, '#f3eedc', 'center');
  text('SIDEWAYS', W / 2, H * 0.55 + 52, 16, '#f3eedc', 'center');
}

function drawLoading(msg: string) {
  ctx.fillStyle = '#0d0a22';
  ctx.fillRect(0, 0, W, H);
  ctx.font = `16px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#b9b0d6';
  ctx.fillText(msg, W / 2, H / 2);
}

// ---------- boot ----------

let last = 0;
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

async function boot() {
  resize();
  addEventListener('resize', resize);
  drawLoading('LOADING');
  try {
    [assets] = await Promise.all([loadAssets(), document.fonts.load(`16px ${FONT}`), document.fonts.load(`8px ${FONT}`)]);
  } catch (err) {
    console.error(err);
    drawLoading('COULD NOT LOAD THE GAME');
    return;
  }
  buildSubtitle();
  church = new BuildingView(assets.buildings['mother-of-god'], 1);
  pieces = [
    { view: new BuildingView(assets.buildings['music-hall'], 0), at: 0, parallax: 0.6 },
    {
      view: new BuildingView({ dark: assets.bridge, windows: [], mask: assets.bridgeTowers }, 2.3, 0.6),
      at: BRIDGE_AT,
      parallax: 0.35,
      bridge: true,
    },
    { view: new BuildingView(assets.buildings['mother-of-god'], 2), at: CHURCH_EARLY_AT, parallax: 0.6 },
    { view: new BuildingView(assets.buildings['museum-center'], 3), at: MUSEUM_AT, parallax: 0.6 },
    { view: church, at: T.levelLength, parallax: 0.6 },
  ];
  // rowhouses everywhere except around the landmarks and along the river by the bridge
  const L = T.levelLength;
  const clear = (at: number, w: number): [number, number] => [at - (w / 2 + 40) / STREET_PARALLAX, at + (w / 2 + 40) / STREET_PARALLAX];
  rowhouses = buildRowhouses(-3000, L + 3000, [
    clear(0, pieces[0].view.width),
    [BRIDGE_AT - 2600, MUSEUM_AT],
    clear(MUSEUM_AT, assets.buildings['museum-center'].dark.width),
    clear(L, church.width),
  ], STREET_PARALLAX);
  setState('title');
  // ?skip=<seconds> fast-forwards the simulation before the first frame (testing aid)
  const skip = Number(params.get('skip')) || 0;
  for (let i = 0; i < skip * 60; i++) update(1 / 60);
  requestAnimationFrame((t) => {
    last = t;
    frame(t);
  });
}

boot();
