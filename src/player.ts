import type { Input } from './input';

// Mothbun's movement. Units are art pixels; y is the foot height above the street
// (0 on the ground, positive is up).
const GRAVITY = 2300;
const JUMP_V = 860;
const GLIDE_FALL = 85; // max fall speed while holding
const JUMP_BUFFER_MS = 120;
const COYOTE = 0.08;

export class Player {
  y = 0;
  vy = 0;
  grounded = true;
  gliding = false;
  invuln = 0;
  private sinceGround = 0;
  private landT = 0;
  private walkT = 0;

  reset() {
    Object.assign(this, { y: 0, vy: 0, grounded: true, gliding: false, invuln: 0, sinceGround: 0, landT: 0 });
  }

  update(dt: number, input: Input, runSpeed: number) {
    this.sinceGround = this.grounded ? 0 : this.sinceGround + dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.landT = Math.max(0, this.landT - dt);
    this.walkT += dt * (runSpeed / 220);

    if (input.pressedWithin(JUMP_BUFFER_MS) && this.sinceGround <= COYOTE && this.vy <= 0) {
      input.consume();
      this.vy = JUMP_V;
      this.grounded = false;
      this.sinceGround = COYOTE + 1;
    }

    // releasing early cuts the jump short
    if (!input.held && this.vy > 0) this.vy -= GRAVITY * dt * 1.2;
    this.vy -= GRAVITY * dt;

    this.gliding = !this.grounded && input.held && this.vy < 0;
    if (this.gliding) this.vy = Math.max(this.vy, -GLIDE_FALL);

    this.y += this.vy * dt;
    if (this.y <= 0) {
      if (!this.grounded) this.landT = 0.1;
      this.y = 0;
      this.vy = 0;
      this.grounded = true;
    }
  }

  // Sprite sheet cell. Jump row: 0 crouch, 1 launch, 2 peak (wings spread), 3 land.
  frame(rows: { walk: number; jump: number }): { row: number; col: number } {
    if (!this.grounded) return { row: rows.jump, col: this.gliding || Math.abs(this.vy) < 180 ? 2 : 1 };
    if (this.landT > 0) return { row: rows.jump, col: 3 };
    return { row: rows.walk, col: Math.floor(this.walkT * 7) % 4 };
  }

  // Collision box around the body relative to the foot anchor (x right, y up).
  // Based on the body, not the frame, since the wing-spread frame is much wider.
  static readonly BODY = { left: -28, right: 12, bottom: 0, top: 72 };
}
