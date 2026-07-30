/**
 * Arcade 3D Web Audio Engine
 * - Plays User-Provided MP3 Background Music (背景音樂.mp3)
 * - Cheerful Magical Win Fanfare & Scratchcard SFX
 */
export class SoundEngine {
  private audioEl: HTMLAudioElement | null = null;
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isBgmPlaying: boolean = false;

  constructor() {
    // Lazy init audio
  }

  private initAudio() {
    if (!this.audioEl) {
      // Load user provided MP3 background music
      const baseUrl = import.meta.env.BASE_URL || '/';
      const bgmPath = baseUrl.endsWith('/') ? `${baseUrl}bgm.mp3` : `${baseUrl}/bgm.mp3`;
      
      this.audioEl = new Audio(bgmPath);
      this.audioEl.loop = true;
      this.audioEl.volume = 0.18; // Soft cute background volume
    }
  }

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public startBGM() {
    this.initAudio();
    if (this.audioEl && !this.isBgmPlaying && !this.isMuted) {
      this.audioEl.play().then(() => {
        this.isBgmPlaying = true;
      }).catch(() => {
        // Autoplay policy fallback
      });
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    this.initAudio();

    if (this.audioEl) {
      this.audioEl.muted = this.isMuted;
      if (!this.isMuted && this.audioEl.paused) {
        this.audioEl.play().catch(() => {});
        this.isBgmPlaying = true;
      }
    }
    return this.isMuted;
  }

  // 🎉 Cheerful Magical Win Fanfare SFX (高質感清亮魔幻中獎音效)
  public playWinSFX() {
    this.initCtx();
    if (!this.ctx || this.isMuted) return;

    // Sparkly chime arpeggio: C6, E6, G6, B6, C7, E7
    const notes = [1046.5, 1318.5, 1567.98, 1975.53, 2093.0, 2637.02];
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      const startTime = this.ctx!.currentTime + idx * 0.08;
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.45);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.46);
    });
  }

  // 🎫 Scratchcard Scratching sound effect
  public playScratchSFX() {
    this.initCtx();
    if (!this.ctx || this.isMuted) return;

    const bufferSize = this.ctx.sampleRate * 0.04;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1400;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.04);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start();
  }
}

export const soundEngine = new SoundEngine();
