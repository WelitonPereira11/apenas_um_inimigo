import Phaser from 'phaser';
import { STORY_TEXT } from '../data/storyText.js';

export default class IntroScene extends Phaser.Scene {
  constructor() { super('IntroScene'); }

  create() {
    sessionStorage.setItem('orfeu_intro_seen', 'true');
    this.finished = false;
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#030508');
    this.add.rectangle(width / 2, height / 2, width, height, 0x030508);
    this.scan = this.add.rectangle(0, height * 0.5, width, 1, 0x9aa9b2, 0.08).setOrigin(0);
    this.tweens.add({ targets: this.scan, y: height * 0.9, duration: 5000, repeat: -1 });
    this.title = this.add.text(width / 2, height * 0.5, '', { fontFamily: 'monospace', fontSize: 24, color: '#d9dedb', align: 'center', lineSpacing: 8 }).setOrigin(0.5);
    this.skip = this.add.text(width - 24, height - 22, '[ESPAÇO] PULAR', { fontFamily: 'monospace', fontSize: 12, color: '#7e898d' }).setOrigin(1, 1);
    this.input.keyboard.on('keydown-SPACE', () => this.finish());
    this.input.keyboard.on('keydown-ENTER', () => this.finish());
    this.input.once('pointerdown', () => this.finish());
    this.scale.on('resize', ({ width: w, height: h }) => { this.title.setPosition(w / 2, h * 0.5); this.skip.setPosition(w - 24, h - 22); });
    this.playSequence();
  }

  playSequence() {
    const scenes = [
      '2037\n\nCOMPLEXO ORFEU\nSUBNÍVEL DE PESQUISA 03',
      '17 ANOS SEM ATIVIDADE.\n\nHÁ 6 HORAS,\nUM SINAL DE EMERGÊNCIA FOI DETECTADO.',
      'CENTRAL:\n“EQUIPE ORFEU, CONFIRMEM ENTRADA.”\n\n“DESÇAM ATÉ O SUBNÍVEL 03.”\n“IDENTIFIQUEM A ORIGEM DO SINAL.”',
      'SUBNÍVEL -02\n\nSUBNÍVEL -03\n\nFALHA DE ENERGIA.',
      'SINAL PERDIDO.\nCOMUNICAÇÃO OFFLINE.\nELEVADOR OFFLINE.\nPORTAS DE EMERGÊNCIA BLOQUEADAS.',
      'SISTEMA ORFEU\n\nENERGIA PRINCIPAL: OFFLINE\n\nCIRCUITOS:\n01 — OFFLINE    02 — OFFLINE    03 — OFFLINE\n\nSAÍDA DE EMERGÊNCIA: BLOQUEADA',
      'PARA LIBERAR A SAÍDA:\n\nRESTAURE OS CIRCUITOS.\n\nENCONTRE UMA FORMA DE SAIR.'
    ];
    this.sequence = scenes;
    this.sequenceIndex = 0;
    this.showSequenceText();
  }

  showSequenceText() {
    if (this.finished) return;
    this.title.setText(this.sequence[this.sequenceIndex]).setAlpha(0);
    this.tweens.add({ targets: this.title, alpha: 1, duration: 450 });
    this.sequenceTimer = this.time.delayedCall(3200, () => {
      this.tweens.add({ targets: this.title, alpha: 0, duration: 350, onComplete: () => {
        this.sequenceIndex += 1;
        if (this.sequenceIndex >= this.sequence.length) this.finish();
        else this.showSequenceText();
      }});
    });
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    this.sequenceTimer?.remove(false);
    this.tweens.killAll();
    this.scene.start('GameScene');
  }
}
