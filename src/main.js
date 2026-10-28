import Phaser from 'phaser';
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';
import IntroScene from './scenes/IntroScene.js';
import CreditsScene from './scenes/CreditsScene.js';
import EndingScene from './scenes/EndingScene.js';
import './style.css';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#08090d',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    min: { width: 320, height: 240 }
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false }
  },
  scene: [MenuScene, IntroScene, EndingScene, CreditsScene, GameScene]
};

new Phaser.Game(config);
