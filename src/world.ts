import { TUNING as T } from './tuning';

// Vehicles and light orbs. Positions are in world x (the camera scrolls right).
// Scooter riders come at Mothbun; pedal wagons and the streetcar roll the same way he
// runs, only slower, and their roofs are platforms he can land on. Running into any of
// them costs a life.

export type VehicleKind = 'scooter' | 'wagon' | 'streetcar';

interface KindSpec {
  sprite: 'scooter' | 'pedal-wagon' | 'streetcar';
  hx: number; // hitbox left edge, from the sprite's left edge
  w: number;
  h: number; // hitbox height; for platforms this is the roof height
  vx: number; // world speed, positive is the same way Mothbun runs
  platform: boolean;
}

export const KINDS: Record<VehicleKind, KindSpec> = {
  scooter: { sprite: 'scooter', hx: 10, w: 56, h: 96, vx: -T.scooterSpeed, platform: false },
  wagon: { sprite: 'pedal-wagon', hx: 0, w: 180, h: 112, vx: T.wagonSpeed, platform: true },
  streetcar: { sprite: 'streetcar', hx: 4, w: 566, h: 124, vx: T.streetcarSpeed, platform: true },
};

export interface Obstacle {
  kind: VehicleKind;
  x: number; // sprite left edge
  vx: number;
  hit: boolean; // ran into it; it turns see-through and harmless
  stunned: number; // seconds since the glare hit it, or -1
  warned: boolean; // streetcar bell rung
}

export interface Orb {
  x: number;
  y: number;
  taken: boolean;
  phase: number;
}

// hitbox in world space
export const box = (o: Obstacle) => {
  const k = KINDS[o.kind];
  return { x0: o.x + k.hx, x1: o.x + k.hx + k.w, top: k.h };
};

export class World {
  obstacles: Obstacle[] = [];
  orbs: Orb[] = [];
  // Planned by where Mothbun will meet the next vehicle (his world x at that moment),
  // since vehicles move and their spawn point depends on their speed.
  private nextMeet = 0;
  private nextKind: VehicleKind = 'scooter';
  private sinceStreetcar = 0;

  reset(startX: number) {
    this.obstacles = [];
    this.orbs = [];
    this.nextMeet = startX + 1300;
    this.nextKind = 'scooter';
    this.sinceStreetcar = 0;
  }

  // `px` is Mothbun's world x. Nothing is met past `endX`, so the end of the level is clear.
  update(dt: number, camX: number, px: number, viewW: number, speed: number, difficulty: number, endX: number) {
    for (const o of this.obstacles) {
      if (o.stunned >= 0) {
        o.stunned += dt;
        o.vx *= Math.max(0, 1 - dt * 3); // the scooter skids to a stop
      }
      o.x += o.vx * dt;
    }
    while (this.nextMeet < endX) {
      const k = KINDS[this.nextKind];
      // spawn once the vehicle would be just off the right edge when placed on course
      const t = (this.nextMeet - px) / speed;
      const x = this.nextMeet - k.vx * t - k.hx;
      if (x > camX + viewW + 60) break;
      this.spawn(x, speed, difficulty);
    }
    const gone = camX - 700;
    this.obstacles = this.obstacles.filter((o) => box(o).x1 > gone);
    this.orbs = this.orbs.filter((o) => o.x > gone && !o.taken);
  }

  private spawn(x: number, speed: number, difficulty: number) {
    const kind = this.nextKind;
    const k = KINDS[kind];
    this.obstacles.push({ kind, x, vx: k.vx, hit: false, stunned: -1, warned: false });

    // how far Mothbun runs while passing it (long for slow platforms he rides across)
    const pass = (k.w * speed) / (speed - k.vx);
    const m = this.nextMeet;
    if (k.platform) {
      // a line of orbs over the roof, along the path he runs while riding it
      const n = Math.max(3, Math.floor(pass / 60));
      for (let i = 0; i < n; i++) this.orbs.push({ x: m + 30 + (i * (pass - 60)) / (n - 1), y: k.h + 34, taken: false, phase: Math.random() * 6 });
    } else if (Math.random() < 0.7) {
      // an arc of orbs over the scooter
      for (let i = 0; i < 5; i++) {
        const f = i / 4;
        this.orbs.push({ x: m + (f - 0.5) * 150, y: 60 + Math.sin(f * Math.PI) * 100, taken: false, phase: Math.random() * 6 });
      }
    }

    // gaps shrink as the run gets harder, but scale with speed so jumps stay possible
    const gap = speed * (1.3 - 0.35 * difficulty) + Math.random() * speed * 1.4;
    this.nextMeet = m + pass + gap;

    this.sinceStreetcar++;
    const roll = Math.random();
    if (difficulty > 0.15 && this.sinceStreetcar > 6 && roll < 0.2) {
      this.nextKind = 'streetcar';
      this.sinceStreetcar = 0;
    } else {
      this.nextKind = difficulty > 0.08 && roll < 0.45 ? 'wagon' : 'scooter';
    }
  }
}
