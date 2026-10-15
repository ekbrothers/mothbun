// Touch, mouse, and keyboard input. Taps land in a zone: the on-screen glare, mute, and
// fullscreen buttons, or anywhere else for jump. Jump tracks held state per pointer so a second
// finger on the glare button doesn't end a glide.
export type Zone = 'jump' | 'glare' | 'mute' | 'fullscreen';

const JUMP_KEYS = ['Space', 'ArrowUp', 'KeyW', 'Enter'];
const GLARE_KEYS = ['KeyX', 'KeyF', 'ShiftLeft', 'ShiftRight', 'ArrowRight'];

export class Input {
  // Called inside the input event, so it can do things browsers only allow right after
  // a tap or key press (start audio, go fullscreen).
  onGesture?: (touch: boolean, zone: Zone) => void;
  private jumpPointers = new Set<number>();
  private keyHeld = false;
  private pressedAt = -Infinity;
  private glareQueued = false;
  private muteQueued = false;

  constructor(canvas: HTMLCanvasElement, zoneAt: (x: number, y: number) => Zone) {
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      const zone = zoneAt(((e.clientX - r.left) / r.width) * canvas.width, ((e.clientY - r.top) / r.height) * canvas.height);
      this.onGesture?.(e.pointerType === 'touch', zone);
      if (zone === 'fullscreen') return;
      if (zone === 'glare') this.glareQueued = true;
      else if (zone === 'mute') this.muteQueued = true;
      else {
        if (!this.held) this.pressedAt = performance.now();
        this.jumpPointers.add(e.pointerId);
      }
    });
    const up = (e: PointerEvent) => this.jumpPointers.delete(e.pointerId);
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
    addEventListener('blur', () => {
      this.jumpPointers.clear();
      this.keyHeld = false;
    });

    addEventListener('keydown', (e) => {
      if (JUMP_KEYS.includes(e.code)) {
        e.preventDefault();
        this.onGesture?.(false, 'jump');
        if (!e.repeat && !this.held) this.pressedAt = performance.now();
        this.keyHeld = true;
      } else if (GLARE_KEYS.includes(e.code)) {
        e.preventDefault();
        this.onGesture?.(false, 'glare');
        if (!e.repeat) this.glareQueued = true;
      } else if (e.code === 'KeyM' && !e.repeat) {
        this.muteQueued = true;
      }
    });
    addEventListener('keyup', (e) => {
      if (JUMP_KEYS.includes(e.code)) this.keyHeld = false;
    });
  }

  get held() {
    return this.keyHeld || this.jumpPointers.size > 0;
  }

  // True if jump went down within the last `windowMs`. Used for jump buffering.
  pressedWithin(windowMs: number): boolean {
    return performance.now() - this.pressedAt <= windowMs;
  }

  consume() {
    this.pressedAt = -Infinity;
    this.glareQueued = false;
  }

  takeGlare(): boolean {
    const g = this.glareQueued;
    this.glareQueued = false;
    return g;
  }

  takeMute(): boolean {
    const m = this.muteQueued;
    this.muteQueued = false;
    return m;
  }

  // Lets demo mode drive the buttons.
  set(held: boolean) {
    if (held && !this.held) this.pressedAt = performance.now();
    this.keyHeld = held;
  }
  queueGlare() {
    this.glareQueued = true;
  }
}
