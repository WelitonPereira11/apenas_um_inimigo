import Phaser from 'phaser';

export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    if (!scene.textures.exists('player')) {
      const texture = scene.add.graphics().fillStyle(0xd5d0c8).fillCircle(12, 12, 12).generateTexture('player', 24, 24);
      texture.destroy();
    }
    super(scene, x, y, 'player');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setVisible(false);
    // O jogador fica acima da camada de escuridão para continuar legível.
    this.visual = scene.add.graphics().setDepth(102);
    this.assetVisual = null;
    const playerDirections = ['north', 'south', 'east', 'west'];
    const playerAssetsReady = playerDirections.every((direction) => scene.textures.exists(`player-${direction}-0`));
    if (playerAssetsReady) {
      for (const direction of ['north', 'south', 'east', 'west']) {
        const frames = Array.from({ length: 12 }, (_, index) => ({ key: `player-${direction}-${index}` }));
        const walkKey = `player-asset-${direction}`;
        const runKey = `player-asset-run-${direction}`;
        if (!scene.anims.exists(walkKey)) scene.anims.create({ key: walkKey, frames, frameRate: 10, repeat: -1 });
        if (!scene.anims.exists(runKey)) scene.anims.create({ key: runKey, frames, frameRate: 17, repeat: -1 });
      }
      // O ponto lÃ³gico do jogador fica nos pÃ©s; o asset possui o centro no
      // meio do quadro, entÃ£o o visual precisa ficar um pouco acima do body.
      this.assetVisual = scene.add.sprite(x, y - 8, 'player-south-0').setDepth(103).setScale(0.468).setVisible(true);
      this.visual.setVisible(false).setActive(false);
      this.assetVisual.play('player-asset-south');
      console.info('[ORFEU] Personagem teacher carregado como jogador.');
    } else {
      console.warn('[ORFEU] Sprites teacher incompletos; usando fallback procedural.');
    }
    this.visualShadow = scene.add.ellipse(x, y + 11, 26, 9, 0x000000, 0.45).setDepth(4);
    this.lastDirection = new Phaser.Math.Vector2(1, 0);
    // O sprite teacher ocupa mais altura que o fallback antigo. Um body 20x20
    // deixava os pÃ©s entrarem visualmente na parede antes da colisÃ£o ocorrer.
    // O tamanho do mapa e das paredes nÃ£o muda; apenas alinhamos o body ao
    // volume visÃ­vel do jogador.
    this.body.setSize(24, 30).setOffset(0, 0);
    this.setCollideWorldBounds(true);
    this.setDepth(5);
    this.keys = scene.input.keyboard.addKeys('W,A,S,D,SHIFT,E,Q');
    this.normalSpeed = 180;
    this.runSpeed = 300;
    this.isHidden = false;
    this.hiddenSpot = null;
    this.touchDirection = new Phaser.Math.Vector2();
    this.touchRun = false;
    this.maxStamina = 100;
    this.stamina = this.maxStamina;
    this.staminaDrainPerSecond = 22;
    this.staminaRecoveryPerSecond = 16;
    this.staminaRecoveryDelay = 1200;
    this.staminaRecoveryTimer = 0;
    this.isExhausted = false;
    this.isRunning = false;
    this.adrenalineTimer = 0;
  }

  setTouchInput(direction, running = false) {
    this.touchDirection.copy(direction);
    this.touchRun = running;
  }

  update(delta = 16.67) {
    if (this.isHidden || this.isInstallingFuse || this.isSearchingSupply) {
      this.setVelocity(0, 0);
      this.isRunning = false;
      this.updateStamina(delta, false);
      this.visual.setPosition(this.x, this.y).setAlpha(0.18);
      this.visualShadow.setPosition(this.x, this.y + 11).setAlpha(0.08);
      this.assetVisual?.setPosition(this.x, this.y - 8).setAlpha(0.18);
      this.assetVisual?.anims.stop();
      this.assetVisual?.setTexture('player-south-0');
      return;
    }
    const { W, A, S, D, SHIFT } = this.keys;
    this.adrenalineTimer = Math.max(0, this.adrenalineTimer - delta);
    const keyboardDirection = new Phaser.Math.Vector2(
      (D.isDown ? 1 : 0) - (A.isDown ? 1 : 0),
      (S.isDown ? 1 : 0) - (W.isDown ? 1 : 0)
    );
    const direction = keyboardDirection.lengthSq() > 0 ? keyboardDirection.normalize() : this.touchDirection;
    const runningRequested = keyboardDirection.lengthSq() > 0 ? SHIFT.isDown : this.touchRun;
    const carryingFuse = Boolean(this.scene.carryingFuse);
    const adrenalineMultiplier = this.adrenalineTimer > 0 ? 1.20 : 1;
    const walkSpeed = this.normalSpeed * (carryingFuse ? 0.95 : 1) * adrenalineMultiplier;
    const runSpeed = this.runSpeed * (carryingFuse ? 0.90 : 1) * adrenalineMultiplier;
    const running = runningRequested && direction.lengthSq() > 0 && this.stamina > 0 && !this.isExhausted;
    this.isRunning = running;
    this.updateStamina(delta, running, carryingFuse);
    this.setVelocity(direction.x * (running ? runSpeed : walkSpeed), direction.y * (running ? runSpeed : walkSpeed));
    if (direction.lengthSq() > 0) this.lastDirection.copy(direction);
    this.visual.setPosition(this.x, this.y).setRotation(Math.atan2(this.lastDirection.y, this.lastDirection.x) + Math.PI / 2).setAlpha(1);
    if (this.assetVisual) {
      this.assetVisual.setPosition(this.x, this.y - 8).setAlpha(1);
      const direction = Math.abs(this.lastDirection.x) >= Math.abs(this.lastDirection.y)
        ? (this.lastDirection.x > 0 ? 'east' : 'west')
        : (this.lastDirection.y > 0 ? 'south' : 'north');
      if (this.body.velocity.lengthSq() > 25) {
        this.assetVisual.anims.play(`${this.isRunning ? 'player-asset-run-' : 'player-asset-'}${direction}`, true);
      } else {
        this.assetVisual.anims.stop();
        this.assetVisual.setTexture(`player-${direction}-0`);
      }
    }
    this.visualShadow.setPosition(this.x, this.y + 11).setAlpha(0.45);
    this.visual.clear();
    this.visual.fillStyle(0xd5d0c8, 1).fillRoundedRect(-7, -1, 14, 17, 4);
    this.visual.fillStyle(0xe8e0d2, 1).fillCircle(0, -10, 6);
    this.visual.fillStyle(0xb9c5c7, 1).fillRect(-10, -3, 4, 10).fillRect(6, -3, 4, 10);
    this.visual.lineStyle(1, 0x65747a, 0.9).strokeRoundedRect(-7, -1, 14, 17, 4);
  }

  updateStamina(delta, running, carryingFuse = false) {
    const seconds = delta / 1000;
    if (running) {
      const drainMultiplier = carryingFuse ? 1.15 : 1;
      this.stamina = Math.max(0, this.stamina - this.staminaDrainPerSecond * drainMultiplier * seconds);
      this.staminaRecoveryTimer = 0;
      if (this.stamina <= 0) this.isExhausted = true;
      return;
    }
    if (this.stamina < this.maxStamina) {
      this.staminaRecoveryTimer += delta;
      if (this.staminaRecoveryTimer >= this.staminaRecoveryDelay) {
        this.stamina = Math.min(this.maxStamina, this.stamina + this.staminaRecoveryPerSecond * seconds);
        if (this.stamina >= 25) this.isExhausted = false;
      }
    } else {
      this.staminaRecoveryTimer = 0;
      this.isExhausted = false;
    }
  }
}
