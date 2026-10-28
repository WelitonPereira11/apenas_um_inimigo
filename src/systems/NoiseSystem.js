import Phaser from 'phaser';

export default class NoiseSystem {
  constructor(scene) {
    this.scene = scene;
    this.events = [];
    this.nextId = 1;
    this.lastEvent = null;
  }

  emitNoise({ x, y, intensity, type, duration = 1200 }) {
    const event = { id: this.nextId++, x, y, intensity, type, remaining: duration };
    this.events.push(event);
    this.lastEvent = event;
    return event;
  }

  update(delta) {
    this.events.forEach((event) => { event.remaining -= delta; });
    this.events = this.events.filter((event) => event.remaining > 0);
  }

  getRelevantNoise(monster) {
    const candidates = this.events
      .filter((event) => Phaser.Math.Distance.Between(monster.x, monster.y, event.x, event.y) <= event.intensity * 2 * this.scene.getThreatNoiseRangeMultiplier())
      .sort((a, b) => b.intensity - a.intensity);
    return candidates[0] || null;
  }
}
