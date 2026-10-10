// One button: tap, click, space, or up arrow. Tracks whether it is held and
// whether it was pressed since the last frame.
export class Input {
  held = false;
  private pressedAt = -Infinity;

  constructor(target: HTMLElement) {
    const down = () => {
      if (!this.held) this.pressedAt = performance.now();
      this.held = true;
    };
    const up = () => (this.held = false);

    target.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      down();
    });
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
    addEventListener('blur', up);

    const isKey = (e: KeyboardEvent) => ['Space', 'ArrowUp', 'KeyW', 'Enter'].includes(e.code);
    addEventListener('keydown', (e) => {
      if (!isKey(e)) return;
      e.preventDefault();
      if (!e.repeat) down();
    });
    addEventListener('keyup', (e) => {
      if (isKey(e)) up();
    });
  }

  // True if the button went down within the last `windowMs`. Used for jump buffering.
  pressedWithin(windowMs: number): boolean {
    return performance.now() - this.pressedAt <= windowMs;
  }

  // Lets demo mode drive the button.
  set(held: boolean) {
    if (held && !this.held) this.pressedAt = performance.now();
    this.held = held;
  }

  consume() {
    this.pressedAt = -Infinity;
  }
}
