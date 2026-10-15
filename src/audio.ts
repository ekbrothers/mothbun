// Sound effects are synthesized with Web Audio. The background music is a streamed,
// looping mp3 ("Game 8-bit On" by moodmode, royalty-free from Pixabay).
// Browsers only allow audio after a tap or key press, so unlock() is called from the
// first input event.

const VOLUME = 0.22;
const MUSIC_VOLUME = 0.35;

export class Sound {
  muted: boolean;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: HTMLAudioElement | null = null;
  private musicStarted = false;

  constructor() {
    let saved = false;
    try {
      saved = localStorage.getItem('mothbun-muted') === '1';
    } catch {
      /* storage blocked */
    }
    this.muted = saved;
    document.addEventListener('visibilitychange', () => {
      if (!this.music || !this.musicStarted) return;
      if (document.hidden) this.music.pause();
      else void this.music.play().catch(() => {});
    });
  }

  unlock() {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : VOLUME;
        this.master.connect(this.ctx.destination);
      } catch {
        return;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    this.startMusic();
  }

  // Starts on the first gesture even when muted (as a muted element), so unmuting
  // later works without needing another gesture.
  private startMusic() {
    if (this.musicStarted) return;
    if (!this.music) {
      this.music = new Audio(import.meta.env.BASE_URL + 'audio/music.mp3');
      this.music.loop = true;
      this.music.preload = 'auto';
      this.music.volume = MUSIC_VOLUME;
    }
    this.music.muted = this.muted;
    this.music
      .play()
      .then(() => (this.musicStarted = true))
      .catch(() => {
        /* blocked or failed; try again on the next gesture */
      });
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : VOLUME;
    if (this.music) this.music.muted = this.muted;
    try {
      localStorage.setItem('mothbun-muted', this.muted ? '1' : '0');
    } catch {
      /* storage blocked */
    }
  }

  private tone(f0: number, f1: number, dur: number, type: OscillatorType, vol = 1, delay = 0) {
    const { ctx, master } = this;
    if (!ctx || !master || this.muted) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, freq: number, delay = 0) {
    const { ctx, master } = this;
    if (!ctx || !master || this.muted) return;
    const t = ctx.currentTime + delay;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(g).connect(master);
    src.start(t);
  }

  jump() {
    this.tone(300, 620, 0.12, 'square', 0.45);
  }
  orb() {
    this.tone(990, 990, 0.07, 'triangle', 0.6);
    this.tone(1480, 1480, 0.12, 'triangle', 0.5, 0.06);
  }
  hit() {
    this.noise(0.25, 0.9, 1200);
    this.tone(200, 55, 0.3, 'square', 0.5);
  }
  glare() {
    this.tone(1400, 260, 0.28, 'sawtooth', 0.3);
  }
  stun() {
    this.tone(520, 780, 0.08, 'square', 0.35);
    this.tone(780, 1170, 0.1, 'square', 0.35, 0.08);
  }
  // streetcar bell: two clangs
  bell() {
    for (const d of [0, 0.32]) {
      this.tone(1320, 1300, 0.5, 'triangle', 0.5, d);
      this.tone(1980, 1950, 0.35, 'sine', 0.25, d);
    }
  }
  pop() {
    this.noise(0.18, 0.5, 2500);
    this.tone(160, 60, 0.2, 'sine', 0.5);
  }
  over() {
    [392, 330, 262, 196].forEach((f, i) => this.tone(f, f * 0.98, 0.22, 'square', 0.4, i * 0.18));
  }
  clear() {
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, f, 0.16, 'square', 0.35, i * 0.12));
  }
}
