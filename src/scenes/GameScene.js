import Phaser from 'phaser';
import Player from '../entities/Player.js';
import Monster, { MONSTER_STATES, VISION_RANGE } from '../entities/Monster.js';
import LearningSystem from '../systems/LearningSystem.js';
import NoiseSystem from '../systems/NoiseSystem.js';
import AudioSystem from '../systems/AudioSystem.js';
import { STORY_TEXT } from '../data/storyText.js';

const VISUAL_CONFIG = {
  darknessAlpha: 0.88,
  poweredDarknessAlpha: 0.62,
  playerLightRadius: 180,
  poweredLightRadius: 260,
  emergencyLightAlpha: 0.20
};

export default class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  preload() {
    this.load.on('loaderror', (file) => {
      if (file.key.startsWith('player-')) console.error(`[ORFEU] Falha ao carregar sprite do jogador: ${file.src}`);
    });
    for (let i = 1; i <= 16; i += 1) {
      this.load.image(`monster-idle-${i}`, `/assets/monster/idle/${i}.png`);
      this.load.image(`monster-walk-${i}`, `/assets/monster/walk/${i}.png`);
      this.load.image(`monster-run-${i}`, `/assets/monster/run/${i}.png`);
    }
    for (const direction of ['north', 'south', 'east', 'west']) {
      for (let i = 0; i < 12; i += 1) this.load.image(`player-${direction}-${i}`, `/assets/player/${direction}/${String(i).padStart(2, '0')}.png?v=teacher1`);
    }
    for (let i = 1; i <= 3; i += 1) this.load.image(`body-${i}`, `/assets/bodies/body-${i}.png?v=bodies2`);
  }

  create() {
    // Ative esta única flag para testar visão, waypoints, corpos e aprendizado.
    this.DEBUG_MODE = false;
    this.DEBUG_MONSTER = this.DEBUG_MODE;
    this.DEBUG_LEARNING = this.DEBUG_MODE;
    this.DEBUG_PHYSICS = this.DEBUG_MODE;
    this.isGameOver = false;
    this.isVictory = false;
    this.fusesCollected = 0;
    this.installedFuses = 0;
    this.threatLevel = 0;
    this.carryingFuse = false;
    this.hasShownHeavyFuseFeedback = false;
    this.heavyFuseFeedbackPending = false;
    this.playerHeldItem = null;
    this.playerShieldActive = false;
    this.captureGraceTimer = 0;
    this.flareTimer = 0;
    this.searchingSupply = false;
    this.searchProgress = 0;
    this.installingFuse = false;
    this.installProgress = 0;
    this.powerRestored = false;
    this.finalHuntActive = false;
    this.messageTimer = null;
    this.learning = new LearningSystem(this);
    this.noise = new NoiseSystem(this);
    this.audio = new AudioSystem();
    // Navegadores bloqueiam WebAudio até uma ação real do jogador.
    this.input.on('pointerdown', () => this.audio.unlock());
    this.input.keyboard.on('keydown', (event) => {
      this.audio.unlock();
      if (event.key === '+' || event.key === '=') this.audio.changeMusicVolume(0.03);
      if (event.key === '-' || event.key === '_') this.audio.changeMusicVolume(-0.03);
      if (this.musicVolumeHud) this.musicVolumeHud.setText(`MÚSICA: ${Math.round(this.audio.musicVolume * 100)}%  (+ / -)`);
    });
    this.noiseTimer = 0;
    this.footstepTimer = 0;
    this.hasShownChaseHint = false;
    this.hasShownHidingHint = false;
    this.tutorialDismissed = false;
    this.tutorialActive = true;
    this.isMobile = Boolean(this.sys.game.device.input.touch && (window.innerWidth < 900 || window.matchMedia('(pointer: coarse)').matches));
    this.joystickPointerId = null;
    this.joystickCenter = new Phaser.Math.Vector2();
    this.joystickRadius = 64;
    this.touchDirection = new Phaser.Math.Vector2();
    this.worldWidth = 2400; this.worldHeight = 1500;
    this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);
    this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);
    this.add.rectangle(this.worldWidth / 2, this.worldHeight / 2, this.worldWidth, this.worldHeight, 0x101117).setDepth(-10);
    this.createMap();
    this.createVisualEnvironment();
    this.createObjectives();
    this.createDocuments();
    this.createHidingSpots();
    this.createSupplyContainers();
    this.createBodies();
    this.createDoors();
    this.player = new Player(this, 420, 360);
    this.physics.add.collider(this.player, this.walls);
    this.createMonster();
    this.monsters.forEach((monster) => this.physics.add.collider(monster, this.walls));
    if (this.DEBUG_PHYSICS) {
      if (!this.physics.world.debugGraphic) this.physics.world.createDebugGraphic();
      this.physics.world.drawDebug = true;
    } else {
      this.physics.world.drawDebug = false;
    }
    // A visão só muda o estado. Game over acontece exclusivamente por contato físico.
    this.monsters.forEach((monster) => this.physics.add.overlap(this.player, monster, this.handlePlayerCaught, null, this));
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setZoom(Math.min(this.scale.width / 960, this.scale.height / 540));
    this.createAtmosphere();
    this.createLighting();
    this.add.text(24, 24, 'WASD mover  •  SHIFT correr  •  E interagir', { fontFamily: 'Arial', fontSize: 16, color: '#c1b9b9', backgroundColor: '#090a0dcc', padding: { x: 10, y: 8 } }).setScrollFactor(0).setDepth(9999);
    this.debugText = this.add.text(24, 70, '', { fontFamily: 'monospace', fontSize: 14, color: '#ffcf70', backgroundColor: '#090a0dcc', padding: { x: 8, y: 6 } }).setScrollFactor(0).setDepth(9999);
    this.threatDebugText = this.add.text(24, 220, '', { fontFamily: 'monospace', fontSize: 14, color: '#ff9a78', backgroundColor: '#090a0dcc', padding: { x: 8, y: 6 } }).setScrollFactor(0).setDepth(9999).setVisible(this.DEBUG_MODE);
    this.learningText = this.add.text(24, 250, '', { fontFamily: 'monospace', fontSize: 14, color: '#91d9b0', backgroundColor: '#090a0dcc', padding: { x: 8, y: 6 } }).setScrollFactor(0).setDepth(9999);
    this.objectiveHud = document.getElementById('objective-hud');
    this.musicVolumeHud = this.add.text(this.scale.width - 24, 24, 'MÚSICA: 12%  (+ / -)', { fontFamily: 'Arial', fontSize: 13, color: '#c1b9b9', backgroundColor: '#090a0dcc', padding: { x: 8, y: 6 } }).setOrigin(1, 0).setScrollFactor(0).setDepth(9999);
    this.interactionPrompt = document.getElementById('interaction-prompt');
    this.createStaminaHud();
    this.messageText = this.add.text(this.scale.width / 2, this.scale.height - 118 - this.scale.height * 0.10, '', {
      fontFamily: 'Georgia', fontSize: 18, color: '#eee5db', align: 'center',
      wordWrap: { width: Math.min(760, this.scale.width - 48), useAdvancedWrap: true },
      backgroundColor: '#090a0dcc', padding: { x: 12, y: 8 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10004);
    this.danger = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x8f1420, 0).setScrollFactor(0).setDepth(9);
    this.scale.on('resize', ({ width, height }) => this.danger.setPosition(width / 2, height / 2).setSize(width, height));
    this.scale.on('resize', ({ width, height }) => this.messageText.setPosition(width / 2, height - 118 - height * 0.10));
    this.createMobileControls();
    if (this.sys.settings.data?.testVictory) this.time.delayedCall(100, () => this.showVictory());
  }

  createStaminaHud() {
    const x = this.scale.width - 190;
    this.staminaLabel = this.add.text(x, 22, 'STAMINA', {
      fontFamily: 'Arial', fontSize: 13, color: '#c9d5cf', backgroundColor: '#090a0dcc', padding: { x: 6, y: 4 }
    }).setScrollFactor(0).setDepth(9999);
    this.staminaBar = this.add.graphics().setScrollFactor(0).setDepth(9999);
    this.scale.on('resize', ({ width }) => this.staminaLabel.setPosition(width - 190, 22));
  }

  updateStaminaHud() {
    if (!this.staminaBar || !this.player) return;
    const width = 150;
    const x = this.scale.width - 184;
    const y = 48;
    const ratio = Phaser.Math.Clamp(this.player.stamina / this.player.maxStamina, 0, 1);
    const low = ratio < 0.25;
    this.staminaBar.clear();
    this.staminaBar.fillStyle(0x090a0d, 0.9).fillRoundedRect(x, y, width, 12, 4);
    this.staminaBar.fillStyle(low ? 0xb85b52 : 0x8ba99b, 0.95).fillRoundedRect(x + 2, y + 2, (width - 4) * ratio, 8, 3);
    this.staminaBar.lineStyle(1, 0x9aa8a4, 0.7).strokeRoundedRect(x, y, width, 12, 4);
    this.staminaBar.setAlpha(low ? 0.75 + Math.sin(this.time.now / 180) * 0.25 : 1);
  }

  getThreatSpeedMultiplier() {
    const finalHuntBonus = this.finalHuntActive ? 0.05 : 0;
    const fuseBonus = this.installedFuses * 0.20;
    return (1 + fuseBonus) * (1 + Math.min(0.10, this.threatLevel * (0.10 / 3)) + finalHuntBonus);
  }

  getMonsterVisionRange() {
    return VISION_RANGE * (1 + this.installedFuses * 0.20);
  }

  applyFuseProgression() {
    const lightRadius = this.powerRestored
      ? VISUAL_CONFIG.poweredLightRadius
      : VISUAL_CONFIG.playerLightRadius * (1 + this.installedFuses * 0.30);
    const darknessAlpha = Phaser.Math.Clamp(
      VISUAL_CONFIG.darknessAlpha - this.installedFuses * 0.055,
      0.68,
      VISUAL_CONFIG.darknessAlpha
    );
    if (this.lightingDarkness) {
      this.tweens.add({ targets: this.lightingDarkness, alpha: darknessAlpha, duration: 700 });
    }
    if (this.lightingLight) {
      this.tweens.add({
        targets: this.lightingLight,
        displayWidth: lightRadius * 2,
        displayHeight: lightRadius * 2,
        duration: 900,
        ease: 'Sine.easeOut'
      });
    }
    this.monster?.scene?.audio?.werewolfHowl();
    this.addMonsterForFuse();
    this.showMessage(`ELE FICOU MAIS ATENTO.\nCIRCUITO RESTAURADO: ${this.installedFuses}/3`, 1800);
  }

  getThreatSearchBonus() {
    return this.threatLevel * 1000 + (this.finalHuntActive ? 1500 : 0);
  }

  getThreatNoiseRangeMultiplier() {
    return 1 + this.threatLevel * 0.10;
  }

  startFinalHunt() {
    if (this.finalHuntActive) return;
    this.finalHuntActive = true;
    this.showMessage(STORY_TEXT.finalHunt, 2400);
    this.showMessage('A INSTALAÇÃO DESPERTOU ELE.', 1800);
  }

  showIntroAndTutorial() {
    const backdrop = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x05070b, 0.88)
      .setOrigin(0.5).setScrollFactor(0).setDepth(10004);
    const intro = this.add.text(this.scale.width / 2, this.scale.height * 0.18, STORY_TEXT.intro.join('\n'), {
      fontFamily: 'Georgia', fontSize: 18, color: '#e6dfd4', align: 'center', lineSpacing: 2,
      wordWrap: { width: Math.min(720, this.scale.width - 48) }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10005);
    const warning = this.add.text(this.scale.width / 2, this.scale.height * 0.36, 'Não deixe que ele aprenda seus padrões.', {
      fontFamily: 'Georgia', fontSize: 20, color: '#c6b8b1'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10005).setAlpha(0);
    const controls = this.isMobile ? 'JOYSTICK — MOVER\nPUXE ATÉ O LIMITE — CORRER\nAÇÕES AUTOMÁTICAS / SAIR' : 'WASD — MOVER\nSHIFT — CORRER\nE — INTERAGIR / ESCONDER';
    const tutorial = this.add.text(this.scale.width / 2, this.scale.height * 0.58,
      `${controls}\n\nENCONTRE 3 FUSÍVEIS.\nRESTAURE A ENERGIA.\nENCONTRE A ÚNICA SAÍDA.`, {
        fontFamily: 'Arial', fontSize: 18, color: '#f1dfb0', align: 'center',
        backgroundColor: '#090a0ddd', padding: { x: 18, y: 14 }, lineSpacing: 5
      }).setOrigin(0.5).setScrollFactor(0).setDepth(10005);
    this.tutorialObjects = [backdrop, intro, warning, tutorial];
    this.tweens.chain({ targets: warning, tweens: [
      { alpha: 1, delay: 900, duration: 500 },
      { alpha: 0, delay: 1500, duration: 700 }
    ] });
    this.time.delayedCall(5000, () => this.dismissTutorial());
  }

  dismissTutorial() {
    if (this.tutorialDismissed) return;
    this.tutorialDismissed = true;
    this.tutorialActive = false;
    this.tutorialObjects?.forEach((object) => this.tweens.add({ targets: object, alpha: 0, duration: 500, onComplete: () => object.destroy() }));
  }

  createMobileControls() {
    if (!this.isMobile) return;

    const { width, height } = this.scale;
    this.joystickCenter.set(92, height - 98);
    this.joystickBase = this.add.circle(this.joystickCenter.x, this.joystickCenter.y, this.joystickRadius, 0x15212b, 0.82)
      .setStrokeStyle(3, 0x9db6c1, 0.85).setScrollFactor(0).setDepth(10001).setInteractive();
    this.joystickKnob = this.add.circle(this.joystickCenter.x, this.joystickCenter.y, 27, 0x8baebb, 0.92)
      .setStrokeStyle(2, 0xe0f0f2, 0.9).setScrollFactor(0).setDepth(10002);
    this.mobileHint = this.add.text(92, height - 22, 'PUXE PARA MOVER', {
      fontFamily: 'Arial', fontSize: 11, color: '#cbdde0', backgroundColor: '#090a0dcc', padding: { x: 6, y: 4 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10003);
    this.exitHidingButton = this.add.rectangle(width - 106, height - 92, 166, 64, 0x641f2b, 0.95)
      .setStrokeStyle(2, 0xe19a91).setScrollFactor(0).setDepth(10001).setInteractive().setVisible(false);
    this.exitHidingLabel = this.add.text(width - 106, height - 92, 'SAIR', {
      fontFamily: 'Arial', fontSize: 20, color: '#fff3ed', fontStyle: 'bold'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10002).setVisible(false);
    this.orientationWarning = this.add.text(width / 2, 48, 'VIRE O CELULAR NA HORIZONTAL', {
      fontFamily: 'Arial', fontSize: 17, color: '#ffe5a8', backgroundColor: '#090a0ddd', padding: { x: 12, y: 8 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10003).setVisible(height > width);

    this.joystickBase.on('pointerdown', (pointer) => {
      this.joystickPointerId = pointer.id;
      this.updateJoystick(pointer);
    });
    this.exitHidingButton.on('pointerdown', () => {
      if (this.player.isHidden && !this.isGameOver && !this.isVictory) this.exitHidingSpot();
    });
    this.joystickMoveHandler = (pointer) => {
      if (pointer.id === this.joystickPointerId) this.updateJoystick(pointer);
    };
    this.joystickUpHandler = (pointer) => {
      if (pointer.id === this.joystickPointerId) this.resetJoystick();
    };
    this.input.on('pointermove', this.joystickMoveHandler);
    this.input.on('pointerup', this.joystickUpHandler);
    this.input.on('pointerupoutside', this.joystickUpHandler);
    this.scale.on('resize', this.mobileResizeHandler = ({ width: nextWidth, height: nextHeight }) => {
      this.joystickCenter.set(92, nextHeight - 98);
      this.joystickBase.setPosition(this.joystickCenter.x, this.joystickCenter.y);
      this.joystickKnob.setPosition(this.joystickCenter.x, this.joystickCenter.y);
      this.mobileHint.setPosition(92, nextHeight - 22);
      this.exitHidingButton.setPosition(nextWidth - 106, nextHeight - 92);
      this.exitHidingLabel.setPosition(nextWidth - 106, nextHeight - 92);
      this.orientationWarning.setPosition(nextWidth / 2, 48).setVisible(nextHeight > nextWidth);
    });
    this.events.once('shutdown', () => {
      this.input.off('pointermove', this.joystickMoveHandler);
      this.input.off('pointerup', this.joystickUpHandler);
      this.input.off('pointerupoutside', this.joystickUpHandler);
      if (this.mobileResizeHandler) this.scale.off('resize', this.mobileResizeHandler);
    });
  }

  updateJoystick(pointer) {
    const dx = pointer.x - this.joystickCenter.x;
    const dy = pointer.y - this.joystickCenter.y;
    const distance = Math.min(this.joystickRadius, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);
    const knobX = this.joystickCenter.x + Math.cos(angle) * distance;
    const knobY = this.joystickCenter.y + Math.sin(angle) * distance;
    this.joystickKnob.setPosition(knobX, knobY);
    this.touchDirection.set(Math.cos(angle) * (distance / this.joystickRadius), Math.sin(angle) * (distance / this.joystickRadius));
    this.player?.setTouchInput(this.touchDirection, distance >= this.joystickRadius * 0.75);
  }

  resetJoystick() {
    this.joystickPointerId = null;
    this.touchDirection.set(0, 0);
    this.joystickKnob.setPosition(this.joystickCenter.x, this.joystickCenter.y);
    this.player?.setTouchInput(this.touchDirection, false);
  }

  createMonster() {
    this.patrolPoints = [
      { id: 'A', x: 1900, y: 420, connections: [1] },
      { id: 'B', x: 2100, y: 420, connections: [0, 2] },
      { id: 'C', x: 2100, y: 820, connections: [1, 3] },
      { id: 'D', x: 1750, y: 820, connections: [2, 4] },
      { id: 'E', x: 1550, y: 900, connections: [3, 5] },
      { id: 'F', x: 1450, y: 1250, connections: [4, 6] },
      { id: 'G', x: 900, y: 1250, connections: [5, 7] },
      { id: 'H', x: 700, y: 900, connections: [6, 8] },
      { id: 'I', x: 700, y: 820, connections: [7] }
    ];
    const startWaypoint = Phaser.Math.Between(0, this.patrolPoints.length - 1);
    this.monster = new Monster(this, this.patrolPoints[startWaypoint].x, this.patrolPoints[startWaypoint].y, this.patrolPoints);
    this.monster.targetWaypoint = startWaypoint;
    this.monsters = [this.monster];
  }

  addMonsterForFuse() {
    const available = this.patrolPoints.filter((point) => this.monsters.every((monster) => Phaser.Math.Distance.Between(monster.x, monster.y, point.x, point.y) > 180));
    const point = Phaser.Utils.Array.GetRandom(available.length ? available : this.patrolPoints);
    const monster = new Monster(this, point.x, point.y, this.patrolPoints);
    monster.targetWaypoint = this.patrolPoints.indexOf(point);
    this.monsters.push(monster);
    this.physics.add.collider(monster, this.walls);
    this.physics.add.overlap(this.player, monster, this.handlePlayerCaught, null, this);
  }

  createVisualEnvironment() {
    const floor = this.add.graphics().setDepth(-9);
    floor.fillStyle(0x141820, 0.9).fillRect(80, 80, this.worldWidth - 160, this.worldHeight - 160);
    floor.lineStyle(1, 0x27313b, 0.11);
    for (let x = 120; x < this.worldWidth - 80; x += 120) floor.lineBetween(x, 80, x, this.worldHeight - 80);
    for (let y = 120; y < this.worldHeight - 80; y += 120) floor.lineBetween(80, y, this.worldWidth - 80, y);

    const wallDetails = this.add.graphics().setDepth(2);
    for (const [x, y, w, h] of this.wallLayout) {
      // Os valores do mapa representam o centro da parede; Graphics desenha a partir do canto.
      const left = x - w / 2;
      const top = y - h / 2;
      wallDetails.fillStyle(0x151c23, 0.92).fillRect(left, top, w, h);
      wallDetails.fillStyle(0x070a0e, 0.45).fillRect(left + 7, top + 8, w - 14, h - 14);
      wallDetails.lineStyle(2, 0x65737b, 0.72).strokeRect(left, top, w, h);
      if (w > 160) {
        wallDetails.lineStyle(1, 0x71808a, 0.20);
        for (let px = left + 80; px < left + w - 20; px += 120) wallDetails.lineBetween(px, top + 8, px, top + h - 8);
      }
    }
    const ambient = this.add.graphics().setDepth(1);
    for (const [x, y, color] of [[680, 330, 0x577e9b], [1480, 980, 0x577e9b], [2200, 1160, 0x8b3038]]) {
      ambient.fillStyle(color, 0.08).fillCircle(x, y, 95);
      ambient.fillStyle(color, 0.18).fillCircle(x, y, 8);
    }
    this.tweens.add({ targets: ambient, alpha: 0.65, duration: 1600, yoyo: true, repeat: -1 });
    const dust = this.add.graphics().setDepth(2);
    for (const [x, y] of [[340, 280], [820, 560], [1120, 1040], [1780, 560], [2140, 940], [580, 1320]]) dust.fillStyle(0x91a5ad, 0.16).fillCircle(x, y, 2);
    this.tweens.add({ targets: dust, x: 12, y: -8, duration: 7000, yoyo: true, repeat: -1 });
    this.add.text(620, 1160, 'SALA ELÉTRICA', { fontFamily: 'Arial', fontSize: 13, color: '#617682' }).setDepth(3);
    this.add.text(1840, 1160, 'SAÍDA', { fontFamily: 'Arial', fontSize: 13, color: '#60464a' }).setDepth(3);
  }

  createObjectives() {
    const makeFuse = (x, y, id) => {
      const object = this.add.graphics().setPosition(x, y).setDepth(102);
      object.fillStyle(0xc58b2b, 1).fillRoundedRect(-10, -16, 20, 32, 4);
      object.lineStyle(2, 0xffe79a, 0.95).strokeRoundedRect(-10, -16, 20, 32, 4);
      object.fillStyle(0x69757a, 1).fillRect(-7, -12, 14, 4).fillRect(-7, 8, 14, 4);
      object.fillStyle(0xfff0a0, 1).fillCircle(0, 0, 3);
      const glow = this.add.circle(x, y, 42, 0xffd95d, 0.16).setDepth(101);
      // O alpha final Ã© controlado por updateLighting(). O tween sÃ³ pulsa a escala,
      // para nunca fazer um objeto distante voltar a brilhar.
      this.tweens.add({ targets: glow, scale: 1.12, duration: 1200, yoyo: true, repeat: -1 });
      return { id, object, glow, collected: false };
    };
    // Sorteia três pontos de uma lista de áreas livres a cada nova partida.
    // Os pontos foram escolhidos fora das paredes e dos spawns principais.
    const fusePositions = [
      { x: 220, y: 360 }, { x: 300, y: 920 }, { x: 360, y: 1320 },
      { x: 760, y: 360 }, { x: 920, y: 900 }, { x: 1120, y: 1260 },
      { x: 1360, y: 300 }, { x: 1450, y: 980 }, { x: 1780, y: 900 },
      { x: 2050, y: 560 }, { x: 2100, y: 820 }, { x: 2200, y: 1350 }
    ];
    const selectedFusePositions = Phaser.Utils.Array.Shuffle([...fusePositions]).slice(0, 3);
    this.fuses = selectedFusePositions.map((position, index) => makeFuse(position.x, position.y, index + 1));
    this.powerPanel = this.add.graphics().setDepth(102);
    this.powerPanel.setPosition(700, 1250);
    this.powerPanel.fillStyle(0x26323a, 1).fillRoundedRect(-26, -35, 52, 70, 5);
    this.powerPanel.lineStyle(3, 0x91a9b2, 0.9).strokeRoundedRect(-26, -35, 52, 70, 5);
    this.powerPanel.lineStyle(1, 0x657b83, 0.7).strokeRect(-18, -10, 36, 34);
    this.powerPanel.fillStyle(0x56666d, 1).fillCircle(-10, 2, 3).fillCircle(10, 2, 3);
    this.panelLight = this.add.circle(700, 1225, 7, 0xa52f38, 0.9).setDepth(103);
    this.exitDoor = this.add.graphics().setDepth(102);
    this.exitDoor.setPosition(2200, 1250);
    this.exitDoor.fillStyle(0x171b20, 1).fillRoundedRect(-35, -55, 70, 110, 5);
    this.exitDoor.lineStyle(3, 0x7b6263, 0.9).strokeRoundedRect(-35, -55, 70, 110, 5);
    this.exitDoor.fillStyle(0x252e35, 1).fillRect(-25, -43, 50, 76);
    this.exitDoor.fillStyle(0x9b7270, 1).fillCircle(12, -2, 3);
    this.exitLight = this.add.circle(2200, 1180, 6, 0x4b252a, 0.8).setDepth(103);
  }

  createDocuments() {
    const entries = [
      ['REGISTRO DE PESQUISA 07', 'O espécime não reage apenas ao estímulo.\nEle registra repetição.\nQuando repetimos um procedimento,\nele começa a antecipá-lo.', 520, 260],
      ['MEMORANDO DE SEGURANÇA', 'Evite utilizar a mesma rota durante evacuações.\nO comportamento do espécime sugere\nreconhecimento de padrões espaciais.', 1180, 520],
      ['RELATÓRIO DE CONTENÇÃO', 'Os armários deixaram de ser seguros.\nEle começou a verificar locais\nonde os funcionários costumavam se esconder.', 1660, 1080],
      ['ÚLTIMA TRANSMISSÃO', 'NÃO RESTAURE O TERCEIRO CIRCUITO.\nSe o sistema voltar completamente,\na contenção também será energizada.', 760, 1180]
    ];
    this.documents = entries.map(([title, text, x, y], index) => {
      const object = this.add.rectangle(x, y, 22, 28, 0xc9c2a5, 0.9).setStrokeStyle(2, 0x665f50).setDepth(101);
      return { id: `DOCUMENT_${index + 1}`, title, text, x, y, object, read: false };
    });
  }

  createHidingSpots() {
    const candidates = Phaser.Utils.Array.Shuffle([
      [300, 300], [700, 900], [1450, 1250], [2200, 1200],
      [300, 780], [760, 980], [1450, 980], [2050, 900],
      [1000, 300], [1850, 560], [1100, 1350]
    ]);
    const positions = [];
    for (const position of candidates) {
      if (positions.every((selected) => Phaser.Math.Distance.Between(selected[0], selected[1], position[0], position[1]) >= 210)) {
        positions.push(position);
      }
      if (positions.length === 7) break;
    }
    const makeSpot = (id, x, y) => {
      const object = this.add.graphics().setDepth(102);
      object.fillStyle(0x151b20, 1).fillRoundedRect(x - 21, y - 38, 42, 76, 3);
      object.lineStyle(2, 0x71808a, 0.95).strokeRoundedRect(x - 21, y - 38, 42, 76, 3);
      object.lineStyle(1, 0x43545d, 0.8).lineBetween(x, y - 34, x, y + 34);
      object.fillStyle(0x8a9a9b, 0.9).fillCircle(x - 5, y, 2).fillCircle(x + 5, y, 2);
      object.lineStyle(1, 0x52636b, 0.7).lineBetween(x - 14, y - 25, x - 5, y - 25).lineBetween(x + 5, y - 25, x + 14, y - 25);
      return { id, x, y, object };
    };
    this.hidingSpots = positions.map(([x, y], index) => makeSpot(`HIDING_SPOT_${String.fromCharCode(65 + index)}`, x, y));
  }

  createDoors() {
    const makeDoor = (id, x, y, width = 54, height = 18) => {
      const object = this.add.rectangle(x, y, width, height, 0x49343a).setStrokeStyle(2, 0xc1847c).setDepth(102);
      this.physics.add.existing(object, true);
      this.walls.add(object);
      object.body.enable = false;
      return { id, x, y, object, closed: false, monsterTimer: 0 };
    };
    this.doors = [
      makeDoor('COMMON_DOOR_A', 760, 560),
      makeDoor('COMMON_DOOR_B', 1550, 980),
      makeDoor('COMMON_DOOR_C', 1800, 900)
    ];
  }

  createSupplyContainers() {
    const candidates = Phaser.Utils.Array.Shuffle([
      [260, 560], [360, 1080], [820, 820], [1080, 440],
      [1350, 1180], [1580, 520], [1850, 880], [2140, 1320],
      [280, 1240], [820, 1180], [1320, 560], [2050, 1320]
    ]);
    const positions = candidates
      .filter(([x, y]) => this.hidingSpots.every((spot) => Phaser.Math.Distance.Between(x, y, spot.x, spot.y) >= 150))
      .slice(0, 8);
    const contents = Phaser.Utils.Array.Shuffle(['EMPTY', 'EMPTY', 'FLARE', 'FLARE', 'EMERGENCY_CHARGE', 'ADRENALINE', 'NOISE_DEVICE', 'EMPTY']);
    this.supplyContainers = positions.map(([x, y], index) => {
      const object = this.add.graphics().setPosition(x, y).setDepth(102);
      object.fillStyle(0x35424a, 1).fillRoundedRect(-22, -16, 44, 32, 4);
      object.lineStyle(2, 0x8c9aa0, 0.8).strokeRoundedRect(-22, -16, 44, 32, 4);
      object.lineStyle(1, 0x65747a, 0.7).lineBetween(-14, -7, 14, -7).lineBetween(-14, 7, 14, 7);
      object.fillStyle(0x9b7d45, 0.9).fillRect(-4, -2, 8, 4);
      return { id: `SUPPLY_${index + 1}`, x, y, object, content: contents[index], searched: false };
    });
  }

  createBodies() {
    // Corpos fixos, apenas decorativos: nÃ£o possuem body fÃ­sico nem interaÃ§Ã£o.
    const positions = [
      [620, 520, 1, 0.46],
      [1320, 620, 2, 0.055],
      [1980, 1240, 3, 0.40]
    ];
    const comments = [
      'O uniforme ainda está quente.',
      'Ele não teve tempo de fugir.',
      'As marcas no chão não parecem humanas.'
    ];
    this.bodies = positions.map(([x, y, index, scale], bodyIndex) => ({
      x, y, comment: comments[bodyIndex], commented: false,
      object: this.add.image(x, y, `body-${index}`).setScale(scale).setDepth(101).setAlpha(0.92)
    }));
  }

  setDoorState(door, closed) {
    door.closed = closed;
    door.object.body.enable = closed;
    door.object.setFillStyle(closed ? 0x49343a : 0x657267);
    door.object.setStrokeStyle(2, closed ? 0xc1847c : 0xa8d0ad);
    this.audio.open();
  }

  updateDoors(delta) {
    if (!this.doors) return;
    for (const door of this.doors) {
      const playerDistance = Phaser.Math.Distance.Between(this.player.x, this.player.y, door.x, door.y);
      const monsterDistance = Math.min(...this.monsters.map((monster) => Phaser.Math.Distance.Between(monster.x, monster.y, door.x, door.y)));
      if (playerDistance < 72 && !this.interactionPrompt.textContent) {
        this.interactionPrompt.textContent = door.closed ? '[E] ABRIR' : '[E] FECHAR';
        if (Phaser.Input.Keyboard.JustDown(this.player.keys.E)) this.setDoorState(door, !door.closed);
      }
      if (door.closed && monsterDistance < 34) {
        door.monsterTimer += delta;
        const openDelay = Math.max(500, 1500 - this.threatLevel * 250);
        if (door.monsterTimer >= openDelay) {
          this.setDoorState(door, false);
          door.monsterTimer = 0;
        }
      } else if (!door.closed) {
        door.monsterTimer = 0;
      }
    }
  }

  createMap() {
    this.walls = this.physics.add.staticGroup();
    this.wallLayout = [
      [1200, 40, 2400, 80], [1200, 1460, 2400, 80], [40, 750, 80, 1500], [2360, 750, 80, 1500],
      [500, 250, 80, 420], [500, 650, 520, 80], [900, 250, 600, 80], [1200, 400, 80, 380],
      [1700, 250, 80, 500], [1700, 700, 500, 80], [850, 1050, 700, 80], [500, 1100, 80, 500],
      [1600, 1250, 80, 420], [1900, 1050, 500, 80], [1200, 820, 500, 70]
    ];
    for (const [x, y, w, h] of this.wallLayout) {
      const wall = this.add.rectangle(x, y, w, h, 0x292a32).setVisible(false);
      this.walls.add(wall); wall.body.updateFromGameObject();
    }
    this.add.text(1840, 920, 'CORREDOR', { fontFamily: 'Georgia', fontSize: 18, color: '#5c5962' });
  }

  createAtmosphere() {
    const size = 900, canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d'), gradient = ctx.createRadialGradient(450, 450, 90, 450, 450, 450);
    gradient.addColorStop(0, 'rgba(0,0,0,0)'); gradient.addColorStop(0.42, 'rgba(0,0,0,0.28)'); gradient.addColorStop(1, 'rgba(0,0,0,0.88)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, size, size);
    this.textures.addCanvas('vignette', canvas);
    this.vignette = this.add.image(this.scale.width / 2, this.scale.height / 2, 'vignette').setScrollFactor(0).setDepth(10).setDisplaySize(this.scale.width * 1.5, this.scale.height * 1.5);
    this.scale.on('resize', ({ width, height }) => this.vignette.setPosition(width / 2, height / 2).setDisplaySize(width * 1.5, height * 1.5));
  }

  createLighting() {
    const { width, height } = this.scale;
    this.lightingDarkness = this.add.rectangle(width / 2, height / 2, width, height, 0x020307, VISUAL_CONFIG.darknessAlpha)
      .setScrollFactor(0).setDepth(100);
    if (!this.textures.exists('player-light')) {
      const canvas = document.createElement('canvas');
      canvas.width = 512; canvas.height = 512;
      const context = canvas.getContext('2d');
      const gradient = context.createRadialGradient(256, 256, 18, 256, 256, 256);
      gradient.addColorStop(0, 'rgba(232,224,197,0.58)');
      gradient.addColorStop(0.39, 'rgba(205,198,177,0.34)');
      gradient.addColorStop(0.68, 'rgba(150,160,156,0.14)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      context.fillStyle = gradient; context.fillRect(0, 0, 512, 512);
      this.textures.addCanvas('player-light', canvas);
    }
    // A luz fica em WORLD SPACE, como o jogador. A câmera faz o scroll/zoom dos dois.
    this.lightingLight = this.add.image(this.player.x, this.player.y, 'player-light')
      .setDisplaySize(VISUAL_CONFIG.playerLightRadius * 2, VISUAL_CONFIG.playerLightRadius * 2)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(101);
    this.scale.on('resize', ({ width: nextWidth, height: nextHeight }) => {
      this.lightingDarkness.setPosition(nextWidth / 2, nextHeight / 2).setSize(nextWidth, nextHeight);
    });
  }

  updateLighting() {
    if (!this.lightingLight || !this.player) return;
    this.lightingLight.setPosition(this.player.x, this.player.y);
    const itemVisibility = (x, y) => {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y);
      const radius = Math.max(1, this.lightingLight.displayWidth / 2);
      const fadeStart = radius * 0.55;

      // Fora do raio da luz, o objeto fica praticamente invisÃ­vel.
      if (distance >= radius) return 0.02;
      if (distance <= fadeStart) return 1;
      return Phaser.Math.Clamp(1 - (distance - fadeStart) / (radius - fadeStart), 0.02, 1);
    };
    this.fuses?.forEach((fuse) => {
      if (!fuse.collected) {
        const alpha = itemVisibility(fuse.object.x, fuse.object.y);
        fuse.object.setAlpha(alpha);
        fuse.glow.setAlpha(0.16 * alpha);
      }
    });
    this.supplyContainers?.forEach((container) => container.object.setAlpha(itemVisibility(container.x, container.y)));
    this.hidingSpots?.forEach((spot) => spot.object?.setAlpha(itemVisibility(spot.x, spot.y)));
    this.documents?.forEach((storyDocument) => storyDocument.object.setAlpha(itemVisibility(storyDocument.x, storyDocument.y)));
    this.bodies?.forEach((body) => body.object.setAlpha(0.92 * itemVisibility(body.x, body.y)));
    this.doors?.forEach((door) => door.object.setAlpha(itemVisibility(door.x, door.y)));
    if (this.powerPanel) this.powerPanel.setAlpha(itemVisibility(this.powerPanel.x, this.powerPanel.y));
    if (this.panelLight) this.panelLight.setAlpha(0.9 * itemVisibility(this.panelLight.x, this.panelLight.y));
    if (this.exitDoor) this.exitDoor.setAlpha(itemVisibility(this.exitDoor.x, this.exitDoor.y));
    if (this.exitLight) this.exitLight.setAlpha(0.8 * itemVisibility(this.exitLight.x, this.exitLight.y));

    // Luzes ambientais tambÃ©m obedecem ao mesmo limite, sem afetar sua lÃ³gica.
    this.poweredLights?.forEach((light) => {
      const baseAlpha = light.getData('baseAlpha') ?? VISUAL_CONFIG.emergencyLightAlpha;
      light.setAlpha(baseAlpha * itemVisibility(light.x, light.y));
    });
  }

  activatePowerVisuals() {
    if (this.powerVisualsActive) return;
    this.powerVisualsActive = true;
    this.tweens.add({ targets: this.lightingDarkness, alpha: VISUAL_CONFIG.poweredDarknessAlpha, duration: 1400 });
    const poweredRadius = VISUAL_CONFIG.poweredLightRadius * (1 + this.installedFuses * 0.30);
    this.tweens.add({ targets: this.lightingLight, displayWidth: poweredRadius * 2, displayHeight: poweredRadius * 2, duration: 1400 });
    const ambientLights = [
      [680, 330, 0x719bc0], [1480, 980, 0x719bc0], [2200, 1160, 0x9c4c4c]
    ];
    this.poweredLights = ambientLights.map(([x, y, color]) => this.add.circle(x, y, 80, color, VISUAL_CONFIG.emergencyLightAlpha).setDepth(2).setData('baseAlpha', VISUAL_CONFIG.emergencyLightAlpha));
    this.poweredLights.forEach((light) => this.tweens.add({ targets: light, scale: 1.06, duration: 1600, yoyo: true, repeat: -1 }));
  }

  hasClearPath(from, to) {
    const line = new Phaser.Geom.Line(from.x, from.y, to.x, to.y);
    const walls = this.walls.getChildren().filter((wall) => !wall.body || wall.body.enable);
    for (const wall of walls) {
      const wallBounds = wall.getBounds();
      if (Phaser.Geom.Intersects.LineToRectangle(line, wallBounds)) return false;
    }
    return true;
  }

  showLearningFeedback() {
    if (this.learningFeedback) this.learningFeedback.destroy();
    this.learningFeedback = this.add.text(this.scale.width / 2, 110, 'ELE PERCEBEU UM PADRÃO.', {
      fontFamily: 'Georgia', fontSize: 20, color: '#d8c7a3'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(9999);
    this.tweens.add({ targets: this.learningFeedback, alpha: 0, delay: 1400, duration: 600, onComplete: () => this.learningFeedback?.destroy() });
  }

  showMessage(message, duration = 2000) {
    if (this.messageTimer) this.messageTimer.remove(false);
    this.messageText.setText(message).setAlpha(1);
    this.messageTimer = this.time.delayedCall(duration, () => { this.messageText.setText(''); });
  }

  updateObjectiveInteraction() {
    if (this.documentUi && Phaser.Input.Keyboard.JustDown(this.player.keys.E)) {
      this.documentUi.remove();
      this.documentUi = null;
      return;
    }
    if (this.searchingSupply) {
      this.player.setVelocity(0, 0);
      this.interactionPrompt.textContent = `VASCULHANDO... ${Math.floor(this.searchProgress * 100)}%`;
      if (!this.isMobile && !this.player.keys.E.isDown) this.cancelSupplySearch();
      return;
    }
    if (this.installingFuse) {
      this.player.setVelocity(0, 0);
      this.interactionPrompt.textContent = `INSTALANDO FUSÍVEL... ${Math.floor(this.installProgress * 100)}%`;
      if (!this.isMobile && !this.player.keys.E.isDown) this.cancelFuseInstallation();
      return;
    }
    if (this.player.isHidden) {
      this.interactionPrompt.textContent = this.isMobile ? 'TOQUE EM SAIR' : '[E] SAIR';
      if (this.exitHidingButton) {
        this.exitHidingButton.setVisible(this.isMobile);
        this.exitHidingLabel.setVisible(this.isMobile);
      }
      if (!this.isMobile && Phaser.Input.Keyboard.JustDown(this.player.keys.E)) this.exitHidingSpot();
      return;
    }
    if (this.exitHidingButton) {
      this.exitHidingButton.setVisible(false);
      this.exitHidingLabel.setVisible(false);
    }
    const nearbyBody = this.bodies?.find((body) => Phaser.Math.Distance.Between(this.player.x, this.player.y, body.x, body.y) < 120);
    if (nearbyBody) {
      this.interactionPrompt.textContent = 'CORPO ENCONTRADO';
      if (!nearbyBody.commented) {
        nearbyBody.commented = true;
        this.showMessage(nearbyBody.comment, 3200);
      }
      return;
    }
    const nearbyDocument = this.documents?.find((document) => !document.read && Phaser.Math.Distance.Between(this.player.x, this.player.y, document.x, document.y) < 65);
    if (nearbyDocument) {
      this.interactionPrompt.textContent = '[E] LER DOCUMENTO';
      if (Phaser.Input.Keyboard.JustDown(this.player.keys.E)) {
        nearbyDocument.read = true;
        nearbyDocument.object.setVisible(false);
        this.showDocument(nearbyDocument);
      }
      return;
    }
    const nearbySpot = this.hidingSpots.find((spot) => Phaser.Math.Distance.Between(this.player.x, this.player.y, spot.x, spot.y) < 70);
    if (nearbySpot) {
      if (!this.hasShownHidingHint) {
        this.hasShownHidingHint = true;
        this.showMessage('Você pode se esconder aqui.', 2200);
      }
      this.interactionPrompt.textContent = this.isMobile ? 'ESCONDER AUTOMATICAMENTE' : '[E] ESCONDER';
      if (this.isMobile || Phaser.Input.Keyboard.JustDown(this.player.keys.E)) this.enterHidingSpot(nearbySpot);
      return;
    }
    const nearbySupply = this.supplyContainers.find((container) => !container.searched && Phaser.Math.Distance.Between(this.player.x, this.player.y, container.x, container.y) < 70);
    if (nearbySupply) {
      this.interactionPrompt.textContent = '[E] VASCULHAR';
      if (this.isMobile || Phaser.Input.Keyboard.JustDown(this.player.keys.E)) this.startSupplySearch(nearbySupply);
      return;
    }
    const nearbyFuse = this.fuses.find((fuse) => !fuse.collected && Phaser.Math.Distance.Between(this.player.x, this.player.y, fuse.object.x, fuse.object.y) < 75);
    const panelDistance = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.powerPanel.x, this.powerPanel.y);
    const exitDistance = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.exitDoor.x, this.exitDoor.y);
    if (nearbyFuse) {
      this.interactionPrompt.textContent = '[E] PEGAR FUSÍVEL';
      if (this.isMobile || Phaser.Input.Keyboard.JustDown(this.player.keys.E)) {
        if (this.carryingFuse) {
          this.showMessage('VOCÊ JÁ ESTÁ CARREGANDO UM FUSÍVEL.', 1800);
          return;
        }
        nearbyFuse.collected = true; nearbyFuse.object.setVisible(false); nearbyFuse.glow.setVisible(false); this.fusesCollected += 1;
        this.audio.pickup();
        this.carryingFuse = true;
        if (!this.hasShownHeavyFuseFeedback) {
          this.hasShownHeavyFuseFeedback = true;
          this.heavyFuseFeedbackPending = true;
          this.showMessage('ESTÁ PESADO.', 1600);
        }
        this.showMessage(this.fusesCollected === 3 ? 'TODOS OS FUSÍVEIS ENCONTRADOS.\nENCONTRE O PAINEL ELÉTRICO.' : `FUSÍVEL ENCONTRADO\n${this.fusesCollected}/3`);
      }
      if (this.heavyFuseFeedbackPending) {
        this.heavyFuseFeedbackPending = false;
        this.time.delayedCall(40, () => this.showMessage('ESTÁ PESADO.', 1600));
      }
      return;
    }
    if (panelDistance < 80) {
      if (this.carryingFuse) {
        this.interactionPrompt.textContent = '[E] INSTALAR FUSÍVEL';
        if (this.isMobile || this.player.keys.E.isDown) this.startFuseInstallation();
        return;
      }
      if (this.fusesCollected < 3) {
        this.interactionPrompt.textContent = `ENERGIA DESLIGADA\nFALTAM ${3 - this.fusesCollected} FUSÍVEIS`;
      } else {
        this.interactionPrompt.textContent = this.powerRestored ? 'ENERGIA RESTAURADA' : '[E] RESTAURAR ENERGIA';
        if (!this.powerRestored && (this.isMobile || Phaser.Input.Keyboard.JustDown(this.player.keys.E))) {
          this.powerRestored = true; this.activatePowerVisuals(); this.startFinalHunt(); this.showMessage('A ENERGIA VOLTOU.\nENCONTRE A SAÍDA.');
          this.panelLight.setFillStyle(0x64d889, 0.9);
          this.exitLight.setFillStyle(0x73d99a, 0.9);
          // A visibilidade por distÃ¢ncia Ã© aplicada em updateLighting(); o tween
          // pulsa somente a escala da luz da saÃ­da.
          this.tweens.add({ targets: this.exitLight, scale: 1.5, duration: 800, yoyo: true, repeat: -1 });
        }
      }
      return;
    }
    if (exitDistance < 90) {
      this.interactionPrompt.textContent = this.powerRestored ? '[E] ESCAPAR' : 'SEM ENERGIA.';
      if (this.powerRestored && (this.isMobile || Phaser.Input.Keyboard.JustDown(this.player.keys.E))) this.showVictory();
      return;
    }
    this.interactionPrompt.textContent = '';
  }

  startSupplySearch(container) {
    if (this.searchingSupply || container.searched) return;
    if (this.playerHeldItem) {
      this.showMessage('VOCÊ SÓ PODE CARREGAR UM ITEM.', 1800);
      return;
    }
    this.searchingSupply = true;
    this.searchProgress = 0;
    this.searchTarget = container;
    this.player.isSearchingSupply = true;
    this.audio.supplyCabinetDoor();
    this.noise.emitNoise({
      x: container.x,
      y: container.y,
      intensity: 110,
      type: 'CABINET_OPEN',
      duration: 1800
    });
  }

  showDocument(storyDocument) {
    if (this.documentUi) this.documentUi.remove();
    const panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;left:24px;top:50%;transform:translateY(-50%);width:min(390px,calc(100vw - 48px));max-height:70vh;box-sizing:border-box;overflow:auto;padding:22px 24px;background:rgba(8,11,14,.97);border:1px solid #879394;color:#e0e2dc;z-index:100000;font-family:Georgia,serif;line-height:1.45;white-space:pre-line;pointer-events:auto;';
    panel.innerHTML = `<div style="font-family:monospace;font-size:14px;color:#c17b76;text-align:center;margin-bottom:16px">${storyDocument.title}</div><div style="font-size:16px">${storyDocument.text}</div><div style="font-family:monospace;font-size:11px;color:#8f9a9a;text-align:center;margin-top:18px">[E] FECHAR</div>`;
    document.body.appendChild(panel);
    this.documentUi = panel;
    this.time.delayedCall(6500, () => {
      if (this.documentUi) { this.documentUi.remove(); this.documentUi = null; }
    });
  }

  cancelSupplySearch() {
    this.searchingSupply = false;
    this.searchProgress = 0;
    this.searchTarget = null;
    this.player.isSearchingSupply = false;
  }

  finishSupplySearch() {
    const container = this.searchTarget;
    if (!container) return;
    container.searched = true;
    this.searchingSupply = false;
    this.searchProgress = 0;
    this.searchTarget = null;
    this.player.isSearchingSupply = false;
    if (container.content === 'EMPTY') this.showMessage('VAZIO.', 1400);
    else {
      this.playerHeldItem = container.content;
      this.showMessage(`ITEM ENCONTRADO: ${this.getItemLabel(container.content)}\n${this.getItemDescription(container.content)}`, 2400);
    }
  }

  getItemLabel(item) {
    return ({ FLARE: 'SINALIZADOR', EMERGENCY_CHARGE: 'CARGA DE EMERGÊNCIA', ADRENALINE: 'ADRENALINA', NOISE_DEVICE: 'DISPOSITIVO SONORO' })[item] || item;
  }

  getItemDescription(item) {
    return ({
      FLARE: 'Aumenta sua área de luz por alguns segundos.',
      EMERGENCY_CHARGE: 'Protege contra um contato do monstro.',
      ADRENALINE: 'Aumenta sua velocidade temporariamente.',
      NOISE_DEVICE: 'Cria um ruído para distrair o monstro.'
    })[item] || 'Item desconhecido.';
  }

  startFuseInstallation() {
    if (this.installingFuse || !this.carryingFuse) return;
    this.installingFuse = true;
    this.installProgress = 0;
    this.player.isInstallingFuse = true;
    this.player.setVelocity(0, 0);
    this.audio.fuseInstall();
  }

  useHeldItem() {
    if (!this.playerHeldItem || this.isGameOver || this.isVictory) return;
    const item = this.playerHeldItem;
    if (item === 'FLARE') {
      this.playerHeldItem = null;
      this.flareTimer = 25000;
      this.lightingLight.setDisplaySize(900, 900);
      this.showMessage('FLARE DE EMERGÊNCIA ATIVADO.', 1600);
    } else if (item === 'EMERGENCY_CHARGE') {
      this.playerHeldItem = null;
      this.playerShieldActive = true;
      this.showMessage('CARGA DE EMERGÊNCIA PRONTA.', 1600);
    } else if (item === 'ADRENALINE') {
      this.playerHeldItem = null;
      this.player.adrenalineTimer = 6000;
      this.showMessage('ADRENALINA ATIVADA.', 1600);
    } else if (item === 'NOISE_DEVICE') {
      this.playerHeldItem = null;
      this.noise.emitNoise({ x: this.player.x, y: this.player.y, intensity: 180, type: 'NOISE_DEVICE', duration: 2200 });
      this.showMessage('DISTRAÇÃO SONORA LANÇADA.', 1600);
    }
  }

  cancelFuseInstallation() {
    this.installingFuse = false;
    this.installProgress = 0;
    this.player.isInstallingFuse = false;
  }

  finishFuseInstallation() {
    this.installingFuse = false;
    this.installProgress = 0;
    this.player.isInstallingFuse = false;
    this.carryingFuse = false;
    this.installedFuses += 1;
    // A progressÃ£o do monstro e da iluminaÃ§Ã£o acontece somente ao instalar.
    this.applyFuseProgression();
    const circuitMessage = this.installedFuses === 1 ? STORY_TEXT.circuitOne : this.installedFuses === 2 ? STORY_TEXT.circuitTwo : STORY_TEXT.circuitThree;
    this.time.delayedCall(60, () => this.showMessage(circuitMessage, this.installedFuses === 3 ? 3400 : 2200));
    this.audio.interaction();
    this.threatLevel = Math.min(3, this.installedFuses);
    this.noise.emitNoise({ x: this.powerPanel.x, y: this.powerPanel.y, intensity: 180, type: 'FUSE_INSTALL', duration: 2200 });
    this.showMessage(`FUSÍVEL INSTALADO\n${this.installedFuses}/3`, 1800);
    if (this.installedFuses === 3) {
      this.powerRestored = true;
      this.startFinalHunt();
      this.activatePowerVisuals();
      this.panelLight.setFillStyle(0x64d889, 0.9);
      this.exitLight.setFillStyle(0x73d99a, 0.9);
      this.showMessage('SISTEMA ENERGIZADO.\nENCONTRE A SAÍDA.', 2400);
    }
  }

  enterHidingSpot(spot) {
    this.audio.cabinetDoor();
    this.player.isHidden = true;
    this.player.hiddenSpot = spot;
    this.player.setPosition(spot.x, spot.y).setAlpha(0.18);
    this.learning.recordHide(spot);
    this.audio.hide();
  }

  exitHidingSpot() {
    this.audio.cabinetDoor();
    this.player.isHidden = false;
    this.player.hiddenSpot = null;
    this.player.setAlpha(1);
  }

  showVictory() {
    if (this.isVictory) return;
    this.isVictory = true;
    this.scene.start('EndingScene');
    return;
    /* Legacy victory overlay kept unreachable for safe rollback. */
    /*
    this.audio.victory();
    this.isVictory = true; this.player.setVelocity(0, 0); this.monsters.forEach((monster) => monster.setVelocity(0, 0));
    this.interactionPrompt.textContent = '';
    this.interactionPrompt.style.display = 'none';
    this.objectiveHud.style.display = 'none';
    this.debugText.setVisible(false);
    this.learningText.setVisible(false);
    this.monsters.forEach((monster) => monster.debugGraphics.clear());
    this.physics.world.drawDebug = false;
    if (this.physics.world.debugGraphic) this.physics.world.debugGraphic.clear();
    this.vignette.setVisible(false);
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.96).setScrollFactor(0).setDepth(99999);
    this.add.text(width / 2, height * 0.32, 'VOCÊ ESCAPOU.', { fontFamily: 'Georgia', fontSize: 38, color: '#eee5db' }).setOrigin(0.5).setScrollFactor(0).setDepth(100000);
    this.add.text(width / 2, height * 0.42, 'Mas ele aprendeu você.', { fontFamily: 'Georgia', fontSize: 20, color: '#c6b8b1' }).setOrigin(0.5).setScrollFactor(0).setDepth(100000);
    const again = this.add.rectangle(width / 2, height * 0.58, 250, 58, 0x641f2b).setStrokeStyle(2, 0xb75c60).setInteractive({ useHandCursor: true }).setScrollFactor(0).setDepth(100000);
    this.add.text(width / 2, height * 0.58, 'JOGAR NOVAMENTE', { fontFamily: 'Georgia', fontSize: 17, color: '#fff0e8' }).setOrigin(0.5).setScrollFactor(0).setDepth(100001);
    const menu = this.add.rectangle(width / 2, height * 0.70, 250, 58, 0x292a32).setStrokeStyle(2, 0x77747b).setInteractive({ useHandCursor: true }).setScrollFactor(0).setDepth(100000);
    this.add.text(width / 2, height * 0.70, 'MENU', { fontFamily: 'Georgia', fontSize: 17, color: '#fff0e8' }).setOrigin(0.5).setScrollFactor(0).setDepth(100001);
    again.on('pointerdown', () => this.scene.restart());
    menu.on('pointerdown', () => this.scene.start('MenuScene'));
    */
  }

  hasPhysicalOverlap() {
    const playerBody = this.player?.body;
    if (!playerBody || !playerBody.enable) return false;
    return this.monsters?.some((monster) => this.hasPhysicalOverlapWith(monster)) ?? false;
  }

  hasPhysicalOverlapWith(monster) {
    const playerBody = this.player?.body;
    const monsterBody = monster?.body;
    if (!playerBody || !monsterBody || !playerBody.enable || !monsterBody.enable) return false;
    return Phaser.Geom.Intersects.RectangleToRectangle(
      new Phaser.Geom.Rectangle(playerBody.left, playerBody.top, playerBody.width, playerBody.height),
      new Phaser.Geom.Rectangle(monsterBody.left, monsterBody.top, monsterBody.width, monsterBody.height)
    );
  }

  handlePlayerCaught(player, caughtMonster) {
    if (this.isGameOver) return;
    this.caughtMonster = caughtMonster;
    if (this.captureGraceTimer > 0) return;
    if (this.player.isHidden && !caughtMonster.isCheckingHidingSpot) return;

    if (this.playerShieldActive) {
      this.playerShieldActive = false;
      this.captureGraceTimer = 2000;
      caughtMonster.setVelocity(0, 0);
      caughtMonster.stunTimer = 1800;
      this.showMessage('A CARGA ABSORVEU O IMPACTO.', 1800);
      this.audio.warning();
      return;
    }

    console.trace('handlePlayerCaught chamado');
    if (!this.hasPhysicalOverlap()) {
      console.warn('GAME OVER BLOQUEADO: player e monster não estão encostando.');
      return;
    }

    console.log('GAME OVER CONFIRMADO: contato físico PLAYER/MONSTER.');
    this.audio.defeat();
    console.trace('GAME OVER EXECUTADO');
    console.trace('PLAYER CONTROLS DISABLED');
    this.isGameOver = true; this.player.setVelocity(0, 0); this.monsters.forEach((monster) => monster.setVelocity(0, 0));
    this.player.body.enable = false;
    this.monsters.forEach((monster) => { monster.body.enable = false; });
    this.tweens.add({ targets: this.danger, alpha: 0.82, duration: 700 });
    const { width, height } = this.scale;
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.78)
      .setScrollFactor(0).setDepth(9999);
    const message = this.add.text(width / 2, height * 0.38, 'ELE ENCONTROU VOCÊ.', {
      fontFamily: 'Georgia', fontSize: 32, color: '#eee5db', letterSpacing: 2
    }).setOrigin(0.5).setScrollFactor(0).setDepth(9999);
    const button = this.add.rectangle(width / 2, height * 0.58, 260, 64, 0x641f2b)
      .setScrollFactor(0).setDepth(9999).setStrokeStyle(2, 0xb75c60).setInteractive({ useHandCursor: true });
    const buttonLabel = this.add.text(width / 2, height * 0.58, 'TENTAR NOVAMENTE', {
      fontFamily: 'Georgia', fontSize: 18, color: '#fff0e8', letterSpacing: 1
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10000);
    button.on('pointerover', () => button.setFillStyle(0x8d2b38));
    button.on('pointerout', () => button.setFillStyle(0x641f2b));
    button.on('pointerdown', () => this.scene.restart());
    this.gameOverUi = { overlay, message, button, buttonLabel };
  }

  update(time, delta) {
    if (this.isVictory) return;
    this.updateLighting();
    if (this.isMobile && (this.isGameOver || this.player.isHidden)) this.resetJoystick();
    this.objectiveHud.style.display = this.tutorialActive ? 'none' : 'block';
    this.interactionPrompt.style.display = this.tutorialActive ? 'none' : 'block';
    this.player.update(delta);
    this.captureGraceTimer = Math.max(0, this.captureGraceTimer - delta);
    if (Phaser.Input.Keyboard.JustDown(this.player.keys.Q)) this.useHeldItem();
    if (this.flareTimer > 0) {
      this.flareTimer = Math.max(0, this.flareTimer - delta);
      if (this.flareTimer === 0) {
        const baseRadius = this.powerRestored ? VISUAL_CONFIG.poweredLightRadius : VISUAL_CONFIG.playerLightRadius;
        const radius = baseRadius * (1 + this.installedFuses * 0.30);
        this.lightingLight.setDisplaySize(radius * 2, radius * 2);
      }
    }
    this.updateStaminaHud();
    this.noise.update(delta);
    this.noiseTimer += delta;
    this.footstepTimer += delta;
    if (this.player.body.velocity.lengthSq() > 0 && this.footstepTimer >= (this.player.isRunning ? 260 : 430)) {
      this.audio.step(this.player.isRunning);
      this.footstepTimer = 0;
    }
    const noiseInterval = this.player.isRunning ? 350 : 900;
    if (this.player.body.velocity.lengthSq() > 0 && this.noiseTimer >= noiseInterval) {
      this.noise.emitNoise({
        x: this.player.x,
        y: this.player.y,
        intensity: this.player.isRunning ? 100 : 20,
        type: this.player.isRunning ? 'RUN' : 'WALK',
        duration: this.player.isRunning ? 1000 : 650
      });
      this.noiseTimer = 0;
    }
    if (this.installingFuse) {
      if (!this.isMobile && !this.player.keys.E.isDown) this.cancelFuseInstallation();
      else {
        this.installProgress = Math.min(1, this.installProgress + delta / 4000);
        if (this.installProgress >= 1) this.finishFuseInstallation();
      }
    }
    if (this.searchingSupply) {
      if (!this.isMobile && !this.player.keys.E.isDown) this.cancelSupplySearch();
      else {
        this.searchProgress = Math.min(1, this.searchProgress + delta / 2000);
        if (this.searchProgress >= 1) this.finishSupplySearch();
      }
    }
    if (!this.tutorialDismissed && this.player.body.velocity.lengthSq() > 25) this.dismissTutorial();
    this.learning.update(delta, this.player, this.patrolPoints);
    this.monsters.forEach((monster) => monster.update(time, delta));
    this.updateObjectiveInteraction();
    this.updateDoors(delta);
    const objective = this.fusesCollected < 3 ? 'ENCONTRE OS FUSÍVEIS' : (!this.powerRestored ? 'ENCONTRE O PAINEL ELÉTRICO' : 'ENCONTRE A SAÍDA');
    this.objectiveHud.textContent = `FUSÍVEIS: ${this.fusesCollected}/3\nOBJETIVO: ${objective}`;
    this.objectiveHud.textContent = `FUSÍVEL: ${this.carryingFuse ? 'CARREGANDO' : 'NENHUM'}\nFUSÍVEIS INSTALADOS: ${this.installedFuses}/3\nOBJETIVO: ${this.carryingFuse ? 'LEVE O FUSÍVEL AO PAINEL' : (this.installedFuses < 3 ? 'ENCONTRE UM FUSÍVEL' : 'ENCONTRE A SAÍDA')}`;
    this.objectiveHud.textContent += `\n${this.playerHeldItem ? `[Q] ${this.getItemLabel(this.playerHeldItem)}\n${this.getItemDescription(this.playerHeldItem)}` : 'ITEM: NENHUM'}`;
    this.objectiveHud.textContent = this.objectiveHud.textContent.replace('FUSÍVEIS INSTALADOS:', 'CIRCUITOS RESTAURADOS:');
    if (this.DEBUG_MODE && !this.isGameOver) {
      this.threatDebugText.setText(`THREAT LEVEL: ${this.threatLevel}\nCARRYING FUSE: ${this.carryingFuse ? 'YES' : 'NO'}\nINSTALLED FUSES: ${this.installedFuses}/3`);
    } else {
      this.threatDebugText.setText('');
    }
    if (this.DEBUG_MONSTER && !this.isGameOver) {
      const distance = Math.round(Phaser.Math.Distance.Between(this.player.x, this.player.y, this.monster.x, this.monster.y));
      const searchTimeLeft = this.monster.state === MONSTER_STATES.SEARCH ? Math.max(0, (this.learning.getSearchDuration() - this.monster.searchTimer) / 1000).toFixed(1) : '0.0';
      this.debugText.setText(`STATE: ${this.monster.state}\nDISTANCE: ${distance}\nCAN SEE: ${this.monster.canSeePlayer(this.player) ? 'YES' : 'NO'}\nLAST KNOWN X: ${Math.round(this.monster.lastKnownPlayerPosition.x)}\nLAST KNOWN Y: ${Math.round(this.monster.lastKnownPlayerPosition.y)}\nSEARCH TIME LEFT: ${searchTimeLeft}s\nSEARCH TARGET: ${Math.round(this.monster.searchTarget.x)}, ${Math.round(this.monster.searchTarget.y)}\nESCAPES: ${this.learning.escapeCount}\nPHYSICAL OVERLAP: ${this.hasPhysicalOverlap() ? 'YES' : 'NO'}\nPLAYER CONTROLS: ${this.isGameOver ? 'DISABLED' : 'ENABLED'}\nGAME OVER: ${this.isGameOver ? 'YES' : 'NO'}\nMONSTER VX: ${Math.round(this.monster.body.velocity.x)}\nMONSTER VY: ${Math.round(this.monster.body.velocity.y)}`);
    } else this.debugText.setText('');
    if (this.DEBUG_LEARNING && !this.isGameOver) {
      this.learningText.setText(`RUN LEVEL: ${this.learning.runLevel}\nRUN TIME: ${this.learning.timeSpentRunning.toFixed(1)}s\nESCAPES: ${this.learning.escapeCount}\nSEARCH TIME: ${(this.learning.getSearchDuration() / 1000).toFixed(0)}s\nTOP ROUTE: ${this.learning.getTopRoute()}\nCHASE SPEED: ${Math.round(this.monster.chaseSpeed * this.learning.getChaseSpeedMultiplier())}\nHIDE COUNT: ${this.learning.hideCount}\nHIDE LEVEL: ${this.learning.hideLevel}`);
    } else this.learningText.setText('');
    const dangerTarget = this.monsters.some((monster) => monster.state === MONSTER_STATES.CHASE) && !this.isGameOver ? 0.14 : 0;
    this.danger.alpha = Phaser.Math.Linear(this.danger.alpha, dangerTarget, 0.08);
  }
}
