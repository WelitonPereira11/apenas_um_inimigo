import Phaser from 'phaser';
import { CREDITS_PARTICIPANTS } from '../data/endingText.js';

export default class CreditsScene extends Phaser.Scene {
  constructor() { super('CreditsScene'); }
  create() {
    const { width, height } = this.scale;
    this.done = false; this.offset = 0; this.cameras.main.setBackgroundColor('#050507');
    this.add.rectangle(width / 2, height / 2, width, height, 0x050507);
    const lines = this.add.graphics().setAlpha(0.12); lines.lineStyle(1, 0x66747c, 0.35);
    for (let y = 50; y < height; y += 90) lines.lineBetween(0, y, width, y);
    this.content = this.add.container(0, 0); const center = width / 2;
    const add = (text, y, style = {}) => this.content.add(this.add.text(center, y, text, { fontFamily: 'Georgia, serif', color: '#e7e2d8', align: 'center', ...style }).setOrigin(0.5));
    add('ORFEU', 80, { fontSize: 48, letterSpacing: 8 }); add('PARTE 1', 135, { fontFamily: 'monospace', fontSize: 15, color: '#969198', letterSpacing: 4 });
    add('OBRIGADO POR JOGAR ORFEU PARTE 1.', 230, { fontSize: 22 });
    add('Obrigado por chegar até o fim desta experiência.\n\nCada corredor explorado, cada decisão tomada\ne cada tentativa de escapar fez parte desta história.\n\nORFEU nasceu de ideias, testes, erros, ajustes\ne muitas decisões tomadas em pouco tempo.\n\nObrigado por fazer parte disso.', 370, { fontSize: 17, color: '#c9cfca', lineSpacing: 7, wordWrap: { width: Math.min(820, width - 50) } });
    add('PARTICIPANTES DO PROJETO', 650, { fontFamily: 'monospace', fontSize: 15, color: '#b47a78', letterSpacing: 2 });
    let y = 735; CREDITS_PARTICIPANTS.forEach(([name, school]) => { add(`${name}\n${school}`, y, { fontSize: 17, lineSpacing: 4 }); y += 92; });
    add('DESENVOLVIDO PARA\n\n1ª Edição da Game Jam IFPA-PGM\n\nTEMA\n\nAPENAS UM', y + 35, { fontFamily: 'monospace', fontSize: 15, color: '#aeb9b8', lineSpacing: 7 });
    add('ORFEU', y + 300, { fontSize: 40, letterSpacing: 7 });
    add('PARTE 1\n\nO Complexo continua ativo.\n\nFim da Parte 1.', y + 355, { fontSize: 19, lineSpacing: 9 });
    this.post = add('SINAL DETECTADO.\n\nORIGEM: DESCONHECIDA.\n\nLOCALIZAÇÃO: ---', y + 570, { fontFamily: 'monospace', fontSize: 15, color: '#b47a78', lineSpacing: 7 }).setAlpha(0);
    this.contentHeight = y + 700; this.buttons = this.createButtons();
    this.input.keyboard.on('keydown-SPACE', () => this.scroll(180)); this.input.keyboard.on('keydown-ESC', () => this.showButtons());
    this.input.keyboard.on('keydown-UP', () => this.scroll(-80)); this.input.keyboard.on('keydown-DOWN', () => this.scroll(80));
    this.input.on('wheel', (_p, _o, _dx, dy) => this.scroll(dy));
    this.time.delayedCall(700, () => this.tweens.add({ targets: this.post, alpha: 1, duration: 1000 }));
    this.scale.on('resize', this.resize, this);
  }
  createButtons() {
    const { width, height } = this.scale; const group = this.add.container(0, 0).setDepth(20).setVisible(false);
    const make = (label, y, action) => { const button = this.add.rectangle(width / 2, y, 230, 44, 0x111116, 0.98).setStrokeStyle(1, 0x77747b).setInteractive({ useHandCursor: true }); const text = this.add.text(width / 2, y, label, { fontFamily: 'monospace', fontSize: 13, color: '#e7e2d8' }).setOrigin(0.5); button.on('pointerover', () => button.setStrokeStyle(2, 0x6e2027)); button.on('pointerout', () => button.setStrokeStyle(1, 0x77747b)); button.on('pointerdown', action); group.add([button, text]); };
    make('JOGAR NOVAMENTE', height * 0.36, () => this.scene.start('GameScene', { skipIntro: true })); make('MENU PRINCIPAL', height * 0.50, () => this.scene.start('MenuScene')); make('CRÉDITOS', height * 0.64, () => this.scene.restart()); return group;
  }
  showButtons() { this.buttons.setVisible(true); this.content.setVisible(false); }
  scroll(amount) { this.offset = Phaser.Math.Clamp(this.offset - amount, -(this.contentHeight - this.scale.height + 80), 0); this.content.setY(this.offset); }
  resize({ width }) { this.buttons.list.forEach((item) => { if (item.setPosition) item.setX(width / 2); }); }
}
