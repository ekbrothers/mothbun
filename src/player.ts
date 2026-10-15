import type { Input } from './input';
import { TUNING as T } from './tuning';

// Mothbun's movement. Units are art pixels; y is the foot height above the street
// (0 on the ground, positive is up).
export class Player {
  y = 0;
  vy = 0;
  grounded = true;
  gliding = false;
  invuln = 0;
  glareT = 0; // time left on the current beam
  glareCd = 0; // time until the next beam
  private sinceGround = 0;
  private landT = 0;
  private walkT = 0;

  reset() {
    Object.assign(this, { y: 0, vy: 0, grounded: true, gliding: false, invuln: 0, glareT: 0, glareCd: 0, sinceGround: 0, landT: 0 });
  }

  // Returns true on the frame a jump starts. `floor` is the height of whatever is under
  // the feet: 0 for the street, or a vehicle roof he was already at or above.
  update(dt: number, input: Input, runSpeed: number, floor = 0): boolean {
    this.sinceGround = this.grounded ? 0 : this.sinceGround + dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.landT = Math.max(0, this.landT - dt);
    this.glareT = Math.max(0, this.glareT - dt);
    this.glareCd = Math.max(0, this.glareCd - dt);
    this.walkT += dt * (runSpeed / 220);

    let jumped = false;
    if (input.pressedWithin(T.jumpBufferMs) && this.sinceGround <= T.coyote && this.vy <= 0) {
      input.consume();
      this.vy = T.jumpVelocity;
      this.grounded = false;
      this.sinceGround = T.coyote + 1;
      jumped = true;
    }

    if (!input.held && this.vy > 0) this.vy -= T.gravity * dt * T.jumpCut;
    this.vy -= T.gravity * dt;

    this.gliding = !this.grounded && input.held && this.vy < 0;
    if (this.gliding) this.vy = Math.max(this.vy, -T.glideFall);

    this.y += this.vy * dt;
    if (this.y <= floor && this.vy <= 0) {
      if (!this.grounded) this.landT = 0.1;
      this.y = floor;
      this.vy = 0;
      this.grounded = true;
    } else {
      this.grounded = false; // jumped, or ran off the end of a roof
    }
    return jumped;
  }

  tryGlare(): boolean {
    if (this.glareCd > 0) return false;
    this.glareT = T.glareDuration;
    this.glareCd = T.glareCooldown;
    return true;
  }

  // Sprite sheet cell. Jump row: 0 crouch, 1 launch, 2 peak (wings spread), 3 land.
  frame(rows: { walk: number; jump: number }): { row: number; col: number } {
    if (!this.grounded) return { row: rows.jump, col: this.gliding || Math.abs(this.vy) < 180 ? 2 : 1 };
    if (this.landT > 0) return { row: rows.jump, col: 3 };
    return { row: rows.walk, col: Math.floor(this.walkT * 7) % 4 };
  }

  // Collision box around the body relative to the foot anchor (x right, y up).
  // Based on the body, not the frame, since the wing-spread frame is much wider.
  static readonly BODY = { left: -28 * T.playerScale, right: 12 * T.playerScale, bottom: 0, top: 72 * T.playerScale };
  // The glowing eye, where the glare beam starts.
  static readonly EYE = { x: 4 * T.playerScale, y: 52 * T.playerScale };
}
