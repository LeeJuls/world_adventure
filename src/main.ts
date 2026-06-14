import Phaser from 'phaser';
import { TitleScene } from './scenes/TitleScene';
import { CharacterSelectScene } from './scenes/CharacterSelectScene';
import { WorldMapScene } from './scenes/WorldMapScene';
import { PortScene } from './scenes/PortScene';
import { LogbookScene } from './scenes/LogbookScene';
import { VictoryScene } from './scenes/VictoryScene';
import { SaveSlotScene } from './scenes/SaveSlotScene';
import { AudioControlScene } from './scenes/AudioControlScene';
import { audio } from './audio/AudioManager';

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
    SaveSlotScene,
    AudioControlScene, // last → renders on top; runs in parallel as a persistent overlay
  ],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

const game = new Phaser.Game(config);
audio.init(game);

// Dev-only test hooks (excluded from production builds via the DEV guard + dynamic import)
if ((import.meta as any).env?.DEV) {
  (window as any).__game = game;
  void import('./dev/questHarness').then((m) => m.installQuestHarness(game));
}
