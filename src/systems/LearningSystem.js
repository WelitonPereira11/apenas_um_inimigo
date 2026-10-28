export default class LearningSystem {
  constructor(scene) {
    this.scene = scene;
    this.runUsage = 0;
    this.routeUsage = {};
    this.escapeCount = 0;
    this.chaseCount = 0;
    this.timeSpentRunning = 0;
    this.hideCount = 0;
    this.hideLevel = 0;
    this.hideUsage = {};
    this.runLevel = 0;
    this.routeCooldowns = new Map();
  }

  update(delta, player, waypoints) {
    const dt = delta / 1000;
    if ((player.keys.SHIFT.isDown || player.isRunning) && player.body.velocity.lengthSq() > 0) {
      this.runUsage += dt;
      this.timeSpentRunning += dt;
      const nextLevel = Math.min(3, Math.floor(this.timeSpentRunning / 10));
      if (nextLevel > this.runLevel) {
        this.runLevel = nextLevel;
        this.scene.showLearningFeedback();
      }
    }

    for (const waypoint of waypoints) {
      const distance = Math.hypot(player.x - waypoint.x, player.y - waypoint.y);
      const cooldown = this.routeCooldowns.get(waypoint.id) || 0;
      if (distance < 55 && cooldown <= 0) {
        this.routeUsage[waypoint.id] = (this.routeUsage[waypoint.id] || 0) + 1;
        this.routeCooldowns.set(waypoint.id, 1.5);
      }
    }
    for (const [id, remaining] of this.routeCooldowns) this.routeCooldowns.set(id, Math.max(0, remaining - dt));
  }

  recordChase() { this.chaseCount += 1; }
  recordEscape() { this.escapeCount += 1; }
  recordHide(spot = null) {
    this.hideCount += 1;
    if (spot?.id) this.hideUsage[spot.id] = (this.hideUsage[spot.id] || 0) + 1;
    const nextLevel = this.hideCount >= 6 ? 3 : this.hideCount >= 4 ? 2 : this.hideCount >= 2 ? 1 : 0;
    if (nextLevel > this.hideLevel) {
      this.hideLevel = nextLevel;
      this.scene.showLearningFeedback();
    }
  }

  getPreferredHidingSpot(spots) {
    const known = spots.filter((spot) => this.hideUsage[spot.id] > 0);
    if (!known.length) return null;
    return [...known].sort((a, b) => (this.hideUsage[b.id] || 0) - (this.hideUsage[a.id] || 0))[0];
  }

  getChaseSpeedMultiplier() { return 1 + this.runLevel * 0.05; }
  getSearchDuration() {
    if (this.escapeCount >= 5) return 8000;
    if (this.escapeCount >= 3) return 6000;
    return 4000;
  }

  choosePatrolWaypoint(current, waypoints) {
    const options = (current.connections || []).filter((index) => waypoints[index]);
    if (!options.length) return null;
    const weighted = [];
    for (const index of options) {
      const usage = this.routeUsage[waypoints[index].id] || 0;
      const weight = Math.min(5, 1 + usage * 0.5);
      for (let i = 0; i < weight; i += 1) weighted.push(index);
    }
    return weighted[Math.floor(Math.random() * weighted.length)];
  }

  getTopRoute() {
    const entries = Object.entries(this.routeUsage);
    if (!entries.length) return '-';
    return entries.sort((a, b) => b[1] - a[1])[0][0];
  }
}
