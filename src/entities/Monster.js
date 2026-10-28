import Phaser from 'phaser';

export const MONSTER_STATES = { PATROL: 'PATROL', CHASE: 'CHASE', SEARCH: 'SEARCH' };
export const VISION_RANGE = 300;

export default class Monster extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, waypoints) {
    if (!scene.textures.exists('monster')) {
      const graphics = scene.add.graphics().fillStyle(0x8f2630).fillCircle(16, 16, 16).lineStyle(2, 0xd05a5a).strokeCircle(16, 16, 15);
      graphics.generateTexture('monster', 32, 32); graphics.destroy();
    }
    super(scene, x, y, 'monster');
    scene.add.existing(this); scene.physics.add.existing(this);
    this.setVisible(false);
    this.visual = scene.add.graphics().setDepth(102);
    this.assetVisual = null;
    if (scene.textures.exists('monster-idle-1')) {
      const makeFrames = (prefix) => Array.from({ length: 16 }, (_, index) => ({ key: `${prefix}-${index + 1}` }));
      if (!scene.anims.exists('monster-asset-idle')) scene.anims.create({ key: 'monster-asset-idle', frames: makeFrames('monster-idle'), frameRate: 8, repeat: -1 });
      if (!scene.anims.exists('monster-asset-walk')) scene.anims.create({ key: 'monster-asset-walk', frames: makeFrames('monster-walk'), frameRate: 12, repeat: -1 });
      if (!scene.anims.exists('monster-asset-run')) scene.anims.create({ key: 'monster-asset-run', frames: makeFrames('monster-run'), frameRate: 16, repeat: -1 });
      this.assetVisual = scene.add.sprite(x, y, 'monster-idle-1').setDepth(102).setScale(0.924);
      this.visual.setVisible(false);
      this.assetVisual.play('monster-asset-idle');
    }
    this.visualShadow = scene.add.ellipse(x, y + 12, 36, 12, 0x000000, 0.55).setDepth(101);
    this.body.setCircle(14, 2, 2);
    this.setCollideWorldBounds(true); this.setDepth(4);
    this.waypoints = waypoints;
    this.state = MONSTER_STATES.PATROL;
    this.targetWaypoint = 0;
    this.lastKnownPlayerPosition = new Phaser.Math.Vector2(x, y);
    this.searchTimer = 0;
    this.searchAngle = 0;
    this.searchTarget = new Phaser.Math.Vector2(x, y);
    this.searchWaypointsRemaining = 0;
    this.searchHidingSpot = null;
    this.hidingCheckTimer = 0;
    this.isCheckingHidingSpot = false;
    this.lastNoiseId = 0;
    this.stunTimer = 0;
    this.lastHowlTime = -Infinity;
    this.patrolSpeed = 75; this.chaseSpeed = 145; this.searchSpeed = 55;
    this.facing = new Phaser.Math.Vector2(1, 0);
    this.debugGraphics = scene.add.graphics().setDepth(15);
    this.drawVisual();
  }

  update(time, delta) {
    if (this.scene.isGameOver) return;
    const player = this.scene.player;
    if (this.stunTimer > 0) {
      this.stunTimer = Math.max(0, this.stunTimer - delta);
      this.setVelocity(0, 0);
      this.visual.setPosition(this.x, this.y).setRotation(this.facing.angle() + Math.PI / 2);
      this.visualShadow.setPosition(this.x, this.y + 12);
      this.drawVisual();
      if (this.scene.DEBUG_MONSTER) this.drawDebug(player, false);
      else this.debugGraphics.clear();
      return;
    }
    if (this.state !== MONSTER_STATES.CHASE && this.isBlockedByWall()) {
      this.redirectAfterWallContact();
    }
    const canSee = this.canSeePlayer(player);
    if (canSee) {
      this.lastKnownPlayerPosition.set(player.x, player.y);
      if (this.state === MONSTER_STATES.CHASE && time - this.lastHowlTime >= 7000) {
        this.scene.audio?.werewolfHowl();
        this.lastHowlTime = time;
      }
      this.setState(MONSTER_STATES.CHASE);
    } else if (this.state === MONSTER_STATES.CHASE) {
      this.setState(MONSTER_STATES.SEARCH);
      this.searchTimer = 0;
      this.searchTarget.set(this.lastKnownPlayerPosition.x, this.lastKnownPlayerPosition.y);
      this.searchWaypointsRemaining = 2;
      this.searchHidingSpot = null;
      this.hidingCheckTimer = 0;
      this.isCheckingHidingSpot = false;
      if (!this.scene.hasClearPath(this, this.lastKnownPlayerPosition)) {
        const firstWaypoint = this.getSearchWaypoint();
        if (firstWaypoint) {
          this.searchTarget.set(firstWaypoint.x, firstWaypoint.y);
          this.searchWaypointsRemaining -= 1;
        }
      }
    }
    if (!canSee && this.scene.noise) {
      const noise = this.scene.noise.getRelevantNoise(this);
      if (noise && noise.id !== this.lastNoiseId) this.investigatePosition(noise);
    }

    switch (this.state) {
      case MONSTER_STATES.PATROL:
        this.moveToward(this.waypoints[this.targetWaypoint], this.patrolSpeed);
        break;
      case MONSTER_STATES.CHASE:
        this.updateChase(player);
        break;
      case MONSTER_STATES.SEARCH:
        this.updateSearch(delta);
        break;
    }
    if (this.scene.DEBUG_MONSTER) this.drawDebug(player, canSee);
    else this.debugGraphics.clear();
    this.visual.setPosition(this.x, this.y).setRotation(this.facing.angle() + Math.PI / 2);
    if (this.assetVisual) {
      this.assetVisual.setPosition(this.x, this.y)
        .setRotation(this.facing.angle() + Math.PI / 2)
        // O monstro nÃ£o participa da regra de visibilidade dos itens.
        // Ele deve permanecer totalmente visÃ­vel em qualquer distÃ¢ncia.
        .setAlpha(1);
      const moving = this.body.velocity.lengthSq() > 25;
      this.assetVisual.anims.play(moving ? (this.state === MONSTER_STATES.CHASE ? 'monster-asset-run' : 'monster-asset-walk') : 'monster-asset-idle', true);
    }
    this.visualShadow.setPosition(this.x, this.y + 12);
    this.visual.setAlpha(1);
    this.visualShadow.setAlpha(0.55);
    this.drawVisual();
  }

  drawVisual() {
    const g = this.visual;
    g.clear();
    g.fillStyle(0x17151b, 1).fillEllipse(0, 0, 27, 32);
    g.fillStyle(0x501d27, 1).fillTriangle(-12, -11, 0, -24, 8, -9);
    g.fillStyle(0x721f2b, 0.95).fillCircle(-6, -5, 3).fillCircle(6, -5, 3);
    g.lineStyle(2, 0x6f3038, 0.85).strokeEllipse(0, 0, 27, 32);
    g.lineStyle(2, 0x431b24, 0.9);
    g.lineBetween(-12, 7, -22, 14); g.lineBetween(12, 7, 22, 14);
  }

  setState(nextState) {
    if (this.state === nextState) return;
    if (nextState === MONSTER_STATES.CHASE) {
      console.log('ENTER CHASE');
      this.scene.learning.recordChase();
      if (!this.scene.hasShownFirstContact) {
        this.scene.hasShownFirstContact = true;
        this.scene.showMessage('VOCÊ NÃO ESTÁ SOZINHO.', 1600);
      }
      if (!this.scene.hasShownChaseHint) {
        this.scene.hasShownChaseHint = true;
        this.scene.showMessage('CORRA.', 1000);
        this.scene.audio?.chase();
        this.scene.audio?.werewolfHowl();
        this.lastHowlTime = this.scene.time.now;
      }
    }
    this.state = nextState;
  }

  investigatePosition(noise) {
    this.lastNoiseId = noise.id;
    if (this.state === MONSTER_STATES.CHASE) return;
    this.setState(MONSTER_STATES.SEARCH);
    this.searchTimer = 0;
    this.searchTarget.set(noise.x, noise.y);
    this.searchWaypointsRemaining = 0;
    this.searchHidingSpot = null;
    this.hidingCheckTimer = 0;
    this.isCheckingHidingSpot = false;
  }

  updateChase(player) {
    const direction = new Phaser.Math.Vector2(player.x - this.x, player.y - this.y);
    if (direction.lengthSq() === 0) {
      this.setVelocity(0, 0);
      return;
    }
    direction.normalize();
    if (this.body.blocked.left || this.body.blocked.right) direction.set(0, direction.y >= 0 ? 1 : -1);
    if (this.body.blocked.up || this.body.blocked.down) direction.set(direction.x >= 0 ? 1 : -1, 0);
    this.facing.copy(direction);
    const speedMultiplier = this.scene.learning.getChaseSpeedMultiplier() * this.scene.getThreatSpeedMultiplier();
    this.setVelocity(direction.x * this.chaseSpeed * speedMultiplier, direction.y * this.chaseSpeed * speedMultiplier);
  }

  updateSearch(delta) {
    const searchDuration = this.scene.learning.getSearchDuration() + this.scene.getThreatSearchBonus();
    if (!this.searchHidingSpot && this.shouldCheckHidingSpot()) {
      this.searchHidingSpot = this.getHidingSpotToCheck();
      if (this.searchHidingSpot) {
        this.searchTarget.set(this.searchHidingSpot.x, this.searchHidingSpot.y);
        this.isCheckingHidingSpot = false;
      }
    }
    if (this.searchHidingSpot) {
      const spotDistance = Phaser.Math.Distance.Between(this.x, this.y, this.searchHidingSpot.x, this.searchHidingSpot.y);
      if (spotDistance < 32) {
        this.setVelocity(0, 0);
        this.isCheckingHidingSpot = true;
        this.hidingCheckTimer += delta;
        if (this.hidingCheckTimer >= 1000) {
          this.searchHidingSpot = null;
          this.isCheckingHidingSpot = false;
          this.hidingCheckTimer = 0;
          this.searchWaypointsRemaining = Math.max(0, this.searchWaypointsRemaining - 1);
        }
      } else {
        this.moveToward(this.searchTarget, this.searchSpeed);
      }
      this.searchTimer += delta;
      if (this.searchTimer > searchDuration) {
        this.scene.learning.recordEscape(); this.setState(MONSTER_STATES.PATROL); this.searchTimer = 0;
      }
      return;
    }
    const targetDistance = Phaser.Math.Distance.Between(this.x, this.y, this.searchTarget.x, this.searchTarget.y);
    if (targetDistance < 22) {
      if (this.searchWaypointsRemaining > 0) {
        const next = this.getSearchWaypoint();
        if (next) {
          this.searchTarget.set(next.x, next.y);
          this.searchWaypointsRemaining -= 1;
        } else {
          this.searchWaypointsRemaining = 0;
        }
      } else {
        this.setVelocity(0, 0);
      }
    }
    this.moveToward(this.searchTarget, this.searchSpeed);
    this.searchTimer += delta;
    if (this.searchTimer > searchDuration) {
      this.scene.learning.recordEscape();
      this.setState(MONSTER_STATES.PATROL);
      this.searchTimer = 0;
      this.searchWaypointsRemaining = 0;
    }
  }

  isBlockedByWall() {
    const blocked = this.body.blocked;
    return blocked.left || blocked.right || blocked.up || blocked.down || this.body.velocity.lengthSq() < 4;
  }

  redirectAfterWallContact() {
    this.setVelocity(0, 0);
    if (this.state === MONSTER_STATES.PATROL) {
      this.chooseNextWaypoint();
      return;
    }
    const alternatives = this.waypoints
      .filter((point) => Phaser.Math.Distance.Between(this.x, this.y, point.x, point.y) > 50)
      .filter((point) => this.scene.hasClearPath(this, point));
    if (alternatives.length) {
      alternatives.sort((a, b) => Phaser.Math.Distance.Between(this.x, this.y, a.x, a.y) - Phaser.Math.Distance.Between(this.x, this.y, b.x, b.y));
      this.searchTarget.set(alternatives[0].x, alternatives[0].y);
      this.searchWaypointsRemaining = 0;
    }
  }

  shouldCheckHidingSpot() {
    const level = this.scene.learning.hideLevel;
    if (level <= 0 || this.searchTimer > this.scene.learning.getSearchDuration() * 0.85) return false;
    if (level >= 3 && this.getHidingSpotToCheck(true)) return true;
    return Math.random() < (level === 2 ? 0.008 : 0.003);
  }

  getHidingSpotToCheck(forceLastKnown = false) {
    const spots = this.scene.hidingSpots.filter((spot) => this.scene.hasClearPath(this, spot));
    if (this.scene.learning.hideLevel >= 2) {
      const preferred = this.scene.learning.getPreferredHidingSpot(spots);
      if (preferred && Phaser.Math.Distance.Between(this.x, this.y, preferred.x, preferred.y) < 420) return preferred;
    }
    const nearby = spots.filter((spot) => Phaser.Math.Distance.Between(spot.x, spot.y, this.lastKnownPlayerPosition.x, this.lastKnownPlayerPosition.y) < 180);
    const candidates = nearby.length ? nearby : (forceLastKnown ? [] : spots);
    if (!candidates.length) return null;
    candidates.sort((a, b) => Phaser.Math.Distance.Between(a.x, a.y, this.lastKnownPlayerPosition.x, this.lastKnownPlayerPosition.y) - Phaser.Math.Distance.Between(b.x, b.y, this.lastKnownPlayerPosition.x, this.lastKnownPlayerPosition.y));
    return candidates[0];
  }

  getSearchWaypoint() {
    const candidates = this.waypoints
      .filter((point) => Phaser.Math.Distance.Between(point.x, point.y, this.lastKnownPlayerPosition.x, this.lastKnownPlayerPosition.y) < 260)
      .filter((point) => this.scene.hasClearPath(this, point));
    if (!candidates.length) return null;
    candidates.sort((a, b) => Phaser.Math.Distance.Between(a.x, a.y, this.lastKnownPlayerPosition.x, this.lastKnownPlayerPosition.y) - Phaser.Math.Distance.Between(b.x, b.y, this.lastKnownPlayerPosition.x, this.lastKnownPlayerPosition.y));
    return candidates[0];
  }

  moveToward(target, speed) {
    if (!target) return;
    const direction = new Phaser.Math.Vector2(target.x - this.x, target.y - this.y);
    if (direction.length() < 18) {
      this.setVelocity(0, 0);
      if (this.state === MONSTER_STATES.PATROL) this.chooseNextWaypoint();
      return;
    }
    direction.normalize(); this.facing.copy(direction); this.setVelocity(direction.x * speed, direction.y * speed);
    if (this.body.blocked.left || this.body.blocked.right) {
      const side = direction.y >= 0 ? 1 : -1;
      this.setVelocity(0, side * speed);
    } else if (this.body.blocked.up || this.body.blocked.down) {
      const side = direction.x >= 0 ? 1 : -1;
      this.setVelocity(side * speed, 0);
    }
  }

  chooseNextWaypoint() {
    const current = this.waypoints[this.targetWaypoint];
    const options = (current.connections || []).filter((index) => this.waypoints[index]);
    const preferred = this.scene.learning.choosePatrolWaypoint(current, this.waypoints);
    if (preferred !== null) this.targetWaypoint = preferred;
  }

  canSeePlayer(player) {
    if (player.isHidden) return false;
    const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    if (distance > this.scene.getMonsterVisionRange()) return false;
    const directionToPlayer = new Phaser.Math.Vector2(player.x - this.x, player.y - this.y).normalize();
    const dot = this.facing.dot(directionToPlayer);
    if (distance > 80 && dot < 0.15) return false;
    return this.scene.hasClearPath(this, player);
  }

  drawDebug(player, canSee) {
    const g = this.debugGraphics; g.clear();
    g.lineStyle(2, 0xffc857, 0.45); g.strokeCircle(this.x, this.y, this.scene.getMonsterVisionRange());
    // A cor da linha representa somente parede bloqueando o segmento, não o cone de visão.
    const clearPath = this.scene.hasClearPath(this, player);
    g.lineStyle(3, clearPath ? 0x55e68a : 0xff5858, 0.95); g.lineBetween(this.x, this.y, player.x, player.y);
    for (const point of this.waypoints) { g.fillStyle(0x5ee6a8, 0.8); g.fillCircle(point.x, point.y, 6); }
  }
}
