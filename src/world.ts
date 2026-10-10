// Obstacles and light orbs. Positions are in world x (the camera scrolls right).
// Obstacles are placeholders until real enemy sprites exist.

export type ObstacleKind = 'goose' | 'hunter' | 'swarm';

export interface Obstacle {
  kind: ObstacleKind;
  x: number;
  y: number; // bottom edge above the street
  w: number;
  h: number;
  hit: boolean;
  stunned: number; // seconds since the glare hit it, or -1
}

export interface Orb {
  x: number;
  y: number;
  taken: boolean;
  phase: number;
}

const SIZES: Record<ObstacleKind, { w: number; h: number; y: number }> = {
  goose: { w: 34, h: 30, y: 0 }, // jump over
  hunter: { w: 26, h: 64, y: 0 }, // jump over with a full jump, or glare to stun
  swarm: { w: 70, h: 40, y: 96 }, // stay low and run under, glide over, or glare mid-jump
};

export class World {
  obstacles: Obstacle[] = [];
  orbs: Orb[] = [];
  private nextSpawn = 0;

  reset(startX: number) {
    this.obstacles = [];
    this.orbs = [];
    this.nextSpawn = startX + 900;
  }

  // Nothing spawns past `endX`, so the end of the level is clear.
  update(dt: number, camX: number, viewW: number, speed: number, difficulty: number, endX: number) {
    while (this.nextSpawn < Math.min(camX + viewW + 200, endX)) this.spawn(this.nextSpawn, speed, difficulty);
    const gone = camX - 200;
    this.obstacles = this.obstacles.filter((o) => o.x + o.w > gone);
    this.orbs = this.orbs.filter((o) => o.x > gone && !o.taken);
    for (const o of this.obstacles) if (o.stunned >= 0) o.stunned += dt;
  }

  private spawn(x: number, speed: number, difficulty: number) {
    const roll = Math.random();
    const kind: ObstacleKind =
      difficulty < 0.12 ? 'goose' : roll < 0.42 ? 'goose' : roll < 0.75 ? 'hunter' : 'swarm';
    const s = SIZES[kind];
    this.obstacles.push({ kind, x, y: s.y, w: s.w, h: s.h, hit: false, stunned: -1 });

    // an arc of orbs over ground obstacles, a low line under swarms
    if (Math.random() < 0.7) {
      const n = 5;
      for (let i = 0; i < n; i++) {
        const f = i / (n - 1);
        const ox = x + s.w / 2 + (f - 0.5) * 150;
        const oy = kind === 'swarm' ? 28 : 60 + Math.sin(f * Math.PI) * 90;
        this.orbs.push({ x: ox, y: oy, taken: false, phase: Math.random() * 6 });
      }
    }

    // gaps shrink as the run gets harder, but scale with speed so jumps stay possible
    const minGap = speed * (1.3 - 0.35 * difficulty);
    this.nextSpawn = x + minGap + Math.random() * speed * 1.4;
  }
}
