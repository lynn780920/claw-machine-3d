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

  // 🪙 Metallic Coin Drop Clink SFX (清脆金屬投幣落幣聲)
  public playCoinDropSFX() {
    this.initCtx();
    if (!this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;
    // Two quick high metallic pings (coin slot entry + internal chute bounce)
    [
      { freq: 2800, delay: 0.0,  duration: 0.12, vol: 0.22 },
      { freq: 3600, delay: 0.08, duration: 0.18, vol: 0.28 }
    ].forEach(p => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(p.freq, t + p.delay);

      gain.gain.setValueAtTime(p.vol, t + p.delay);
      gain.gain.exponentialRampToValueAtTime(0.001, t + p.delay + p.duration);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(t + p.delay);
      osc.stop(t + p.delay + p.duration);
    });
  }

  // 🕹️ Claw Solenoid Snap / "二收" 合爪機械扣合音效
  public playClawCloseSFX() {
    this.initCtx();
    if (!this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;
    // Low mechanical click
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.06);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.065);
  }

  // 🚗 Carriage Servo Motor Movement Pulse (天車移動伺服馬達嗡鳴)
  private lastMotorSFXTime = 0;
  public playMotorStepSFX() {
    this.initCtx();
    if (!this.ctx || this.isMuted) return;
    const now = performance.now();
    if (now - this.lastMotorSFXTime < 120) return; // Throttle sound pulses
    this.lastMotorSFXTime = now;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.linearRampToValueAtTime(180, t + 0.05);

    gain.gain.setValueAtTime(0.04, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.055);
  }

  // 🏆 關卡突破音效 (Stage Clear Fanfare)
  public playStageClearSFX() {
    this.initCtx();
    if (!this.ctx || this.isMuted) return;

    // Victory fanfare: G4, C5, E5, G5, C6 (extended sparkling triumph)
    const melody = [
      { freq: 392.00, delay: 0.00, duration: 0.15 },
      { freq: 523.25, delay: 0.14, duration: 0.15 },
      { freq: 659.25, delay: 0.28, duration: 0.18 },
      { freq: 783.99, delay: 0.44, duration: 0.22 },
      { freq: 1046.50, delay: 0.65, duration: 0.60 },
      { freq: 1318.51, delay: 0.68, duration: 0.60 },
      { freq: 1567.98, delay: 0.72, duration: 0.80 },
    ];

    const t = this.ctx.currentTime;
    melody.forEach(n => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.freq, t + n.delay);

      gain.gain.setValueAtTime(0.25, t + n.delay);
      gain.gain.exponentialRampToValueAtTime(0.001, t + n.delay + n.duration);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(t + n.delay);
      osc.stop(t + n.delay + n.duration);
    });
  }

  // 💀 Game Over 時間耗盡失敗音效
  public playGameOverSFX() {
    this.initCtx();
    if (!this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;
    // Sad falling slide: F4 -> Eb4 -> D4 -> C#3
    const notes = [
      { freq: 349.23, delay: 0.0, duration: 0.25 },
      { freq: 311.13, delay: 0.22, duration: 0.25 },
      { freq: 293.66, delay: 0.44, duration: 0.30 },
      { freq: 138.59, delay: 0.72, duration: 0.70 }
    ];

    notes.forEach(n => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(n.freq, t + n.delay);
      osc.frequency.exponentialRampToValueAtTime(n.freq * 0.9, t + n.delay + n.duration);

      gain.gain.setValueAtTime(0.2, t + n.delay);
      gain.gain.exponentialRampToValueAtTime(0.001, t + n.delay + n.duration);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(t + n.delay);
      osc.stop(t + n.delay + n.duration);
    });
  }

  // ⏰ 倒數即將結束警示音效
  public playTimeWarningSFX() {
    this.initCtx();
    if (!this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.setValueAtTime(1760, t + 0.06);

    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  // 👑 全破大通關終極榮耀音效 (Grand Victory)
  public playGameVictorySFX() {
    this.initCtx();
    if (!this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;
    const notes = [
      { freq: 523.25, delay: 0.0, duration: 0.2 },
      { freq: 659.25, delay: 0.18, duration: 0.2 },
      { freq: 783.99, delay: 0.36, duration: 0.25 },
      { freq: 1046.50, delay: 0.58, duration: 0.5 },
      { freq: 1318.51, delay: 0.85, duration: 0.5 },
      { freq: 1567.98, delay: 1.15, duration: 0.9 }
    ];

    notes.forEach(n => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.freq, t + n.delay);

      gain.gain.setValueAtTime(0.3, t + n.delay);
      gain.gain.exponentialRampToValueAtTime(0.001, t + n.delay + n.duration);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(t + n.delay);
      osc.stop(t + n.delay + n.duration);
    });
  }
}

export const soundEngine = new SoundEngine();

