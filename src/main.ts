import Phaser from 'phaser';
import { TitleScene } from './scenes/TitleScene';
import { CharacterSelectScene } from './scenes/CharacterSelectScene';
import { WorldMapScene } from './scenes/WorldMapScene';
import { PortScene } from './scenes/PortScene';
import { LogbookScene } from './scenes/LogbookScene';
import { VictoryScene } from './scenes/VictoryScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1024,
  height: 576,
  backgroundColor: '#0a1628',
  parent: document.body,
  scene: [
    TitleScene,
    CharacterSelectScene,
    WorldMapScene,
    PortScene,
    LogbookScene,
    VictoryScene,
  ],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);
