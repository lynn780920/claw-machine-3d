/**
 * Arcade 3D Web Audio Synthesizer Engine
 * - Soft, cute, cheerful BGM loop (馬卡龍歡樂可愛背景音樂)
 * - Win Celebration Fanfare Jingle (夾中中獎慶祝音效)
 * - Scratchcard scratch & win SFX
 */
export class SoundEngine {
  private ctx: AudioContext | null = null;
  private bgmGain: GainNode | null = null;
  private isMuted: boolean = false;
  private isBgmPlaying: boolean = false;
  private bgmIntervalId: number | null = null;

  constructor() {
    // AudioContext will be initialized on first user click gesture
  }

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = this.isMuted ? 0 : 0.08; // Soft background volume
      this.bgmGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public startBGM() {
    if (this.isBgmPlaying) return;
    this.initCtx();
    this.isBgmPlaying = true;

    // Cute 8-note macaron melody loop
    const melody = [523.25, 659.25, 783.99, 1046.5, 880.0, 698.46, 783.99, 659.25];
    let noteIndex = 0;

    this.bgmIntervalId = window.setInterval(() => {
      if (!this.ctx || !this.isBgmPlaying || this.isMuted) return;

      const osc = this.ctx.createOscillator();
      const noteGain = this.ctx.createGain();

      osc.type = 'triangle'; // Soft cute tone
      const freq = melody[noteIndex % melody.length];
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      noteGain.gain.setValueAtTime(0.06, this.ctx.currentTime);
      noteGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

      osc.connect(noteGain);
      noteGain.connect(this.bgmGain!);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.36);

      noteIndex++;
    }, 400);
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.bgmGain && this.ctx) {
      this.bgmGain.gain.setValueAtTime(this.isMuted ? 0 : 0.08, this.ctx.currentTime);
    }
    if (!this.isBgmPlaying && !this.isMuted) {
      this.startBGM();
    }
    return this.isMuted;
  }

  // 🎉 Win Celebration Fanfare Jingle
  public playWinSFX() {
    this.initCtx();
    if (!this.ctx || this.isMuted) return;

    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]; // C5, E5, G5, C6, E6
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx!.currentTime + idx * 0.12);

      gain.gain.setValueAtTime(0.25, this.ctx!.currentTime + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx!.currentTime + idx * 0.12 + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(this.ctx!.currentTime + idx * 0.12);
      osc.stop(this.ctx!.currentTime + idx * 0.12 + 0.45);
    });
  }

  // 🎫 Scratchcard Scratching sound effect
  public playScratchSFX() {
    this.initCtx();
    if (!this.ctx || this.isMuted) return;

    const bufferSize = this.ctx.sampleRate * 0.05; // 50ms noise burst
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1200;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start();
  }
}

export const soundEngine = new SoundEngine();
