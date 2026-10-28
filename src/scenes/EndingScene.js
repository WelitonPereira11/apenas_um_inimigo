import Phaser from 'phaser';
import { ENDING_TEXT } from '../data/endingText.js';

export default class EndingScene extends Phaser.Scene {
  constructor() { super('EndingScene'); }

  create() {
    const { width, height } = this.scale;
    this.finished = false;
    this.cameras.main.setBackgroundColor('#050507');
    this.add.rectangle(width / 2, height / 2, width, height, 0x050507).setDepth(0);
    this.add.graphics().lineStyle(1, 0x30323a, 0.16).lineBetween(width * 0.16, 0, width * 0.16, height).lineBetween(width * 0.84, 0, width * 0.84, height).setDepth(1);
    this.text = this.add.text(width / 2, height / 2, '', { fontFamily: 'Georgia, serif', fontSize: 24, color: '#e7e2d8', align: 'center', lineSpacing: 10, wordWrap: { width: width * 0.78 } }).setOrigin(0.5).setDepth(5);
    this.overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x050507, 1).setDepth(10);
    this.input.keyboard.on('keydown-SPACE', () => this.skip());
    this.input.keyboard.on('keydown-ESC', () => this.skip());
    this.scale.on('resize', this.resize, this);
    this.tweens.add({ targets: this.overlay, alpha: 0, duration: 1100, delay: 250 });
    this.runSequence();
  }

  runSequence() {
    let delay = 900;
    ENDING_TEXT.forEach((block, index) => {
      this.time.delayedCall(delay, () => {
        if (this.finished) return;
        this.text.setText(block.text).setFontSize(block.size).setColor(block.accent ? '#b47a78' : '#e7e2d8').setAlpha(0);
        this.tweens.add({ targets: this.text, alpha: 1, duration: 850 });
      });
      delay += 850 + block.hold;
      this.time.delayedCall(delay - 400, () => { if (!this.finished) this.tweens.add({ targets: this.text, alpha: 0, duration: 400 }); });
    });
    this.time.delayedCall(delay + 800, () => this.finish());
  }

  skip() { if (this.finished) return; this.finish(); }

  finish() {
    if (this.finished) return;
    this.finished = true;
    this.time.removeAllEvents();
    this.tweens.killAll();
    this.cameras.main.fade(900, 0, 0, 0);
    this.time.delayedCall(950, () => this.scene.start('CreditsScene'));
  }

  resize({ width, height }) { this.text.setPosition(width / 2, height / 2); this.overlay.setPosition(width / 2, height / 2).setSize(width, height); }
}
