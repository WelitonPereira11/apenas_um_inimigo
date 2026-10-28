export default class AudioSystem {
  constructor() {
    this.context = null;
    this.master = 0.12;
    this.werewolf = new Audio('/assets/werewolf-sound-effect.mp4');
    this.werewolf.preload = 'auto';
    this.werewolf.volume = 0.72;
    this.music = new Audio('/assets/fundo.m4a');
    this.music.loop = true;
    this.music.preload = 'auto';
    this.musicVolume = 0.12;
    this.music.volume = this.musicVolume;
    this.cabinet = new Audio('/assets/armario.mp3');
    this.cabinet.preload = 'auto';
    this.cabinet.volume = 0.65;
    this.supplyCabinet = new Audio('/assets/armario2.mp3');
    this.supplyCabinet.preload = 'auto';
    this.supplyCabinet.volume = 0.65;
    this.fuse = new Audio('/assets/fusivel.mp3');
    this.fuse.preload = 'auto';
    this.fuse.volume = 0.65;
  }
  unlock() {
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      this.context = new AudioContextClass();
    }
    if (this.context.state === 'suspended') this.context.resume();
    this.startMusic();
  }

  startMusic() { this.music.play().catch(() => {}); }
  setMusicVolume(value) {
    this.musicVolume = Math.max(0, Math.min(0.5, value));
    this.music.volume = this.musicVolume;
  }
  changeMusicVolume(amount) { this.setMusicVolume(this.musicVolume + amount); }
  tone(frequency, duration = 0.12, type = 'sine', volume = 1, endFrequency = frequency) {
    this.unlock(); if (!this.context) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain(); oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(this.master * volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(now); oscillator.stop(now + duration + 0.02);
  }
  pickup() { this.tone(420, 0.16, 'triangle', 1.2, 720); }
  step(running = false) { this.tone(running ? 105 : 78, 0.055, 'square', running ? 0.55 : 0.32, 48); }
  open() { this.tone(180, 0.24, 'sawtooth', 0.55, 310); }
  search() { this.tone(260, 0.18, 'triangle', 0.45, 190); }
  hide() { this.tone(130, 0.28, 'sine', 0.5, 85); }
  cabinetDoor() {
    this.unlock();
    this.cabinet.pause();
    this.cabinet.currentTime = 0;
    this.cabinet.play().catch(() => {});
  }
  supplyCabinetDoor() {
    this.unlock();
    this.supplyCabinet.pause();
    this.supplyCabinet.currentTime = 0;
    this.supplyCabinet.play().catch(() => {});
  }
  fuseInstall() {
    this.unlock();
    this.fuse.pause();
    this.fuse.currentTime = 0;
    this.fuse.play().catch(() => {});
  }
  install() { this.tone(320, 0.25, 'triangle', 0.65, 520); }
  interaction() { this.tone(220, 0.10, 'square', 0.6, 180); }
  chase() { this.tone(95, 0.28, 'sawtooth', 0.8, 55); }
  werewolfHowl() {
    this.unlock();
    this.werewolf.pause();
    this.werewolf.currentTime = 0;
    this.werewolf.play().catch(() => {});
  }
  warning() { this.tone(150, 0.22, 'sine', 0.8, 100); }
  victory() { this.tone(360, 0.45, 'triangle', 1.1, 720); }
  defeat() { this.tone(110, 0.55, 'sawtooth', 1.1, 42); }
}
