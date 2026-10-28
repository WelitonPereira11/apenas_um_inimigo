import Phaser from 'phaser';

export default class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }
  create() {
    document.title = 'ORFEU';
    document.getElementById('objective-hud')?.style.setProperty('display', 'none');
    document.getElementById('interaction-prompt')?.style.setProperty('display', 'none');
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#06080b');
    this.add.rectangle(width / 2, height / 2, width, height, 0x06080b);
    const grid = this.add.graphics().setAlpha(0.16); grid.lineStyle(1, 0x66747c, 0.28);
    for (let x = 40; x < width; x += 80) grid.lineBetween(x, 0, x, height);
    for (let y = 40; y < height; y += 80) grid.lineBetween(0, y, width, y);
    this.add.rectangle(width * 0.76, height * 0.5, width * 0.28, height * 0.72, 0x0d1318, 0.8).setStrokeStyle(2, 0x43515a, 0.45);
    this.add.rectangle(width * 0.76, height * 0.5, 8, height * 0.72, 0x5c252d, 0.25);
    this.add.text(width * 0.28, height * 0.27, 'ORFEU', { fontFamily: 'Georgia, serif', fontSize: Math.max(48, width * 0.07), color: '#e7e1d7', letterSpacing: 10 }).setOrigin(0.5);
    this.add.text(width * 0.28, height * 0.39, 'COMPLEXO DE PESQUISA SUBTERRÂNEA', { fontFamily: 'monospace', fontSize: 13, color: '#9da8aa', letterSpacing: 2 }).setOrigin(0.5);
    this.add.text(width * 0.28, height * 0.52, 'STATUS DA INSTALAÇÃO\n\nENERGIA: OFFLINE\nSINAL: DETECTADO\nCONTENÇÃO: ---', { fontFamily: 'monospace', fontSize: 15, color: '#c6cfcb', lineSpacing: 6, backgroundColor: '#0b1014', padding: { x: 18, y: 14 } }).setOrigin(0.5);
    const makeButton = (label, y, primary = false) => {
      const button = this.add.rectangle(width * 0.28, y, 220, 48, primary ? 0x172027 : 0x0d1318, 0.95).setStrokeStyle(1, primary ? 0xa8b5b4 : 0x66747c, 0.9).setInteractive({ useHandCursor: true });
      this.add.text(width * 0.28, y, label, { fontFamily: 'monospace', fontSize: 16, color: '#e3e4dc', letterSpacing: 2 }).setOrigin(0.5);
      button.on('pointerover', () => button.setStrokeStyle(2, 0xc17b76)); button.on('pointerout', () => button.setStrokeStyle(1, primary ? 0xa8b5b4 : 0x66747c, 0.9)); return button;
    };
    const start = makeButton('INICIAR', height * 0.64, true);
    const how = makeButton('COMO JOGAR', height * 0.72);
    const credits = makeButton('CRÉDITOS', height * 0.88);
    start.on('pointerdown', () => this.scene.start(sessionStorage.getItem('orfeu_intro_seen') === 'true' ? 'GameScene' : 'IntroScene'));
    how.on('pointerdown', () => this.showInfo('WASD  MOVER\nSHIFT  CORRER\nE  INTERAGIR\nQ  USAR ITEM\n\nRESTAURE OS 3 CIRCUITOS\nE ENCONTRE A SAÍDA.'));
    credits.on('pointerdown', () => this.scene.start('CreditsScene'));
  }
  showInfo(text) {
    if (this.infoGroup) this.infoGroup.destroy(true); const { width, height } = this.scale;
    this.infoGroup = this.add.container(0, 0); this.infoGroup.add(this.add.rectangle(width / 2, height / 2, width * 0.76, height * 0.52, 0x05080b, 0.98).setStrokeStyle(1, 0x859296));
    this.infoGroup.add(this.add.text(width / 2, height * 0.43, text, { fontFamily: 'monospace', fontSize: 17, color: '#dce4df', align: 'center', lineSpacing: 8 }).setOrigin(0.5));
    const close = this.add.text(width / 2, height * 0.68, '[ CLIQUE PARA FECHAR ]', { fontFamily: 'monospace', fontSize: 12, color: '#aab5b6' }).setOrigin(0.5).setInteractive(); close.on('pointerdown', () => this.infoGroup.destroy(true)); this.infoGroup.add(close);
  }
  update() { document.getElementById('objective-hud')?.style.setProperty('display', 'none'); document.getElementById('interaction-prompt')?.style.setProperty('display', 'none'); }
}
