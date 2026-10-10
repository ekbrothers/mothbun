import { loadAssets, type Assets, type BuildingName } from './assets';
import { BuildingView } from './building';
import { Input } from './input';
import { Player } from './player';
import { World, type Obstacle } from './world';

// Internal resolution: 560 art pixels tall, width follows the screen's aspect ratio.
const VH = 560;
const STREET = 56; // height of sidewalk + road below the ground line
const FONT = '"Press Start 2P", monospace';
const START_SPEED = 230;
const MAX_SPEED = 430;
const LIVES = 3;

// Level 1 set pieces, repeating. Buildings sit behind the street and scroll slower.
const BUILDING_PARALLAX = 0.6;
const LOOP = 3600;
const PIECES: { name: BuildingName; x: number }[] = [
  { name: 'music-hall', x: 300 },
  { name: 'mother-of-god', x: 2100 },
];

type State = 'loading' | 'title' | 'playing' | 'over';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const input = new Input(canvas);
const player = new Player();
const world = new World();

let assets: Assets;
let views: Record<BuildingName, BuildingView>;
let state: State = 'loading';
let W = 0, H = VH, ground = VH - STREET;
// ?t=<seconds> starts the clock later, handy for checking a projection.
let time = Number(new URLSearchParams(location.search).get('t')) || 0, camX = 0, speed = START_SPEED, runTime = 0;
let lives = LIVES, orbCount = 0, distance = 0, best = readBest(), shake = 0, overT = 0;

// ?demo plays itself: starts a run and jumps on its own.
const demo = new URLSearchParams(location.search).has('demo');

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
const score = () => Math.floor(distance / 10) + orbCount * 25;
const playerX = () => Math.round(Math.min(W * 0.25, 260));

function startRun() {
  state = 'playing';
  player.reset();
  speed = START_SPEED;
  runTime = 0;
  lives = LIVES;
  orbCount = 0;
  distance = 0;
  world.reset(camX);
  input.consume();
}

function endRun() {
  state = 'over';
  overT = 0;
  if (score() > best) {
    best = score();
    try {
      localStorage.setItem('mothbun-best', String(best));
    } catch {
      /* storage blocked, keep best for this session only */
    }
  }
}

function readBest(): number {
  try {
    return Number(localStorage.getItem('mothbun-best')) || 0;
  } catch {
    return 0;
  }
}

function update(dt: number) {
  time += dt;
  for (const v of Object.values(views)) v.update(dt, time);
  shake = Math.max(0, shake - dt * 3);

  if (state === 'title') {
    camX += 18 * dt;
    if ((demo || input.pressedWithin(200)) && !portrait()) startRun();
    return;
  }

  if (state === 'over') {
    overT += dt;
    if (overT > 0.8 && (demo || input.pressedWithin(200))) startRun();
    return;
  }

  if (portrait()) return; // wait for landscape

  runTime += dt;
  const difficulty = Math.min(1, runTime / 90);
  speed = START_SPEED + (MAX_SPEED - START_SPEED) * difficulty;
  camX += speed * dt;
  distance += speed * dt;
  if (demo) autopilot();
  player.update(dt, input, speed);
  world.update(camX, W, speed, difficulty);

  // collisions in world space
  const px = camX + playerX();
  const b = Player.BODY;
  const box = { x0: px + b.left, x1: px + b.right, y0: player.y + b.bottom, y1: player.y + b.top };
  for (const o of world.obstacles) {
    if (o.hit || player.invuln > 0) continue;
    if (box.x1 > o.x && box.x0 < o.x + o.w && box.y1 > o.y && box.y0 < o.y + o.h) {
      o.hit = true;
      lives--;
      player.invuln = 1.4;
      shake = 1;
      if (lives <= 0) return endRun();
    }
  }
  for (const orb of world.orbs) {
    if (orb.x > box.x0 - 10 && orb.x < box.x1 + 10 && orb.y > box.y0 - 10 && orb.y < box.y1 + 10) {
      orb.taken = true;
      orbCount++;
    }
  }
}

function autopilot() {
  const px = camX + playerX();
  const next = world.obstacles.find((o) => !o.hit && o.kind !== 'swarm' && o.x + o.w > px - 20);
  const lead = next ? next.x - px : Infinity;
  if (player.grounded) input.set(lead > 0 && lead < speed * 0.3);
  else input.set(player.vy > 0 || lead < 40);
}

// ---------- drawing ----------

function draw() {
  ctx.save();
  if (shake > 0) ctx.translate(Math.round((Math.random() - 0.5) * 8 * shake), Math.round((Math.random() - 0.5) * 6 * shake));
  drawSky();
  drawSkyline();
  drawBuildings();
  drawStreet();
  if (state === 'playing' || state === 'over') {
    drawOrbs();
    for (const o of world.obstacles) drawObstacle(o);
  }
  drawPlayer();
  ctx.restore();

  if (state === 'title') drawTitle();
  if (state === 'playing') drawHud();
  if (state === 'over') drawGameOver();
  if (portrait() && state !== 'over') drawRotateHint();
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
  const off = (camX * 0.25) % skyline.width;
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

function drawBuildings() {
  const scroll = camX * BUILDING_PARALLAX;
  for (const p of PIECES) {
    const v = views[p.name];
    const base = ((p.x - scroll) % LOOP + LOOP) % LOOP;
    for (const x of [base - LOOP, base]) {
      if (x > W || x + v.width < 0) continue;
      ctx.drawImage(v.render(time), Math.round(x), ground - v.height);
    }
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
  for (let i = -1; i < W / dash + 2; i++) ctx.fillRect(Math.round(i * dash - ((camX * 1) % dash)), ground + 30, 40, 4);
}

function drawPlayer() {
  const { meta, sheet } = assets;
  const { frameWidth: fw, frameHeight: fh, anchor } = meta;
  if (player.invuln > 0 && Math.floor(time * 16) % 2 === 0) return;
  const { row, col } =
    state === 'playing' ? player.frame(meta.rows) : { row: meta.rows.idle, col: Math.floor(time * 3) % 4 };
  const x = playerX() - anchor.x;
  const y = Math.round(ground - player.y - anchor.y);
  ctx.drawImage(sheet, col * fw, row * fh, fw, fh, x, y, fw, fh);
}

function drawObstacle(o: Obstacle) {
  const x = Math.round(o.x - camX);
  if (x > W || x + o.w < 0) return;
  const y = Math.round(ground - o.y - o.h);
  ctx.globalAlpha = o.hit ? 0.35 : 1;
  if (o.kind === 'swarm') {
    // a jittering cloud of moth dots
    ctx.fillStyle = '#d9cfae';
    for (let i = 0; i < 26; i++) {
      const dx = (Math.sin(i * 12.9898 + time * (3 + (i % 4))) * 0.5 + 0.5) * o.w;
      const dy = (Math.cos(i * 78.233 + time * (4 + (i % 3))) * 0.5 + 0.5) * o.h;
      ctx.fillRect(Math.round(x + dx), Math.round(y + dy), 3, 2);
    }
  } else {
    ctx.fillStyle = '#0b0914';
    ctx.fillRect(x - 1, y - 1, o.w + 2, o.h + 2);
    ctx.fillStyle = o.kind === 'goose' ? '#e8e4da' : '#5a6b3a';
    ctx.fillRect(x, y, o.w, o.h);
    if (o.kind === 'hunter') {
      // flashlight beam pointed back at the rabbit
      ctx.fillStyle = 'rgba(255, 240, 170, 0.18)';
      ctx.beginPath();
      ctx.moveTo(x, y + 20);
      ctx.lineTo(x - 120, y - 10);
      ctx.lineTo(x - 120, y + 60);
      ctx.fill();
      ctx.fillStyle = '#fff4b0';
      ctx.fillRect(x - 4, y + 18, 6, 5);
    } else {
      ctx.fillStyle = '#e08a2a';
      ctx.fillRect(x + o.w - 2, y + 6, 8, 4);
    }
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

function text(str: string, x: number, y: number, size = 16, color = '#f3eedc', align: CanvasTextAlign = 'left') {
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#0b0914';
  ctx.fillText(str, x + 2, y + 2);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

function drawTitle() {
  const { logo } = assets;
  const s = Math.max(1, Math.floor(Math.min((W * 0.85) / logo.width, 170 / logo.height)));
  const lw = logo.width * s, lh = logo.height * s;
  const lx = Math.round((W - lw) / 2), ly = Math.round(H * 0.1 + Math.sin(time * 1.5) * 3);
  ctx.drawImage(logo, lx, ly, lw, lh);
  if (Math.floor(time * 1.6) % 2 === 0 && !portrait()) text('TAP TO START', W / 2, ly + lh + 36, 16, '#f3eedc', 'center');
  text('TAP: JUMP   HOLD: GLIDE', W / 2, H - 30, 8, '#b9b0d6', 'center');
  if (best > 0) text(`BEST ${best}`, W - 16, 16, 8, '#b9b0d6', 'right');
}

function drawHud() {
  text(`SCORE ${String(score()).padStart(6, '0')}`, 16, 16, 16);
  for (let i = 0; i < LIVES; i++) {
    const x = W - 24 - i * 26;
    ctx.fillStyle = '#0b0914';
    ctx.fillRect(x - 2, 14, 18, 18);
    ctx.fillStyle = i < lives ? '#ff2a2a' : '#3a2230';
    ctx.fillRect(x, 16, 14, 14);
    if (i < lives) {
      ctx.fillStyle = '#ffb0a0';
      ctx.fillRect(x + 3, 19, 4, 4);
    }
  }
}

function drawGameOver() {
  ctx.fillStyle = 'rgba(8, 6, 20, 0.6)';
  ctx.fillRect(0, 0, W, H);
  text('GAME OVER', W / 2, H * 0.28, 32, '#ff4a3a', 'center');
  text(`SCORE ${score()}`, W / 2, H * 0.28 + 64, 16, '#f3eedc', 'center');
  text(`BEST ${best}`, W / 2, H * 0.28 + 92, 16, '#b9b0d6', 'center');
  if (overT > 0.8 && Math.floor(time * 1.6) % 2 === 0) text('TAP TO TRY AGAIN', W / 2, H * 0.28 + 150, 16, '#f3eedc', 'center');
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
    [assets] = await Promise.all([loadAssets(), document.fonts.load(`16px ${FONT}`)]);
  } catch (err) {
    console.error(err);
    drawLoading('COULD NOT LOAD THE GAME');
    return;
  }
  views = {
    'music-hall': new BuildingView(assets.buildings['music-hall'], 0),
    'mother-of-god': new BuildingView(assets.buildings['mother-of-god'], 1),
  };
  // start the title with Music Hall centered
  camX = (PIECES[0].x + views['music-hall'].width / 2 - W / 2) / BUILDING_PARALLAX;
  state = 'title';
  input.consume();
  // ?skip=<seconds> fast-forwards the simulation before the first frame (testing aid)
  const skip = Number(new URLSearchParams(location.search).get('skip')) || 0;
  for (let i = 0; i < skip * 60; i++) update(1 / 60);
  requestAnimationFrame((t) => {
    last = t;
    frame(t);
  });
}

boot();
