import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';

/**
 * Lightweight always-on overlay scene that renders a single mute toggle in the
 * bottom-left corner. Runs in parallel above every other scene so the control is
 * available everywhere without each scene having to add it.
 */
export class AudioControlScene extends Phaser.Scene {
  private btn!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'AudioControlScene', active: true });
  }

  create(): void {
    const { height } = this.scale;
    this.btn = this.add.text(14, height - 12, this.icon(), {
      fontSize: '20px',
      backgroundColor: 'rgba(10,22,40,0.55)',
      padding: { x: 7, y: 4 },
    })
      .setOrigin(0, 1)
      .setScrollFactor(0)
      .setDepth(1000)
      .setInteractive({ useHandCursor: true });

    this.btn.on('pointerdown', () => {
      audio.toggleMute();
      audio.startBgm(); // doubles as an autoplay-unlock gesture if BGM hasn't started yet
      this.btn.setText(this.icon());
    });

    // Keep this overlay above whatever scene is currently active
    this.scene.bringToTop();
  }

  private icon(): string {
    return audio.muted ? '🔇' : '🔊';
  }
}
