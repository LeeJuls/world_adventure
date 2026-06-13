import Phaser from 'phaser';

const PALETTE = {
  ocean: 0x1a6b8a,
  oceanLight: 0x2389a8,
  land: 0x7ab648,
  gold: 0xffdd88,
  white: 0xffffff,
  darkBg: 0x0a1628,
  uiBg: 0x2d1b00,
};

export class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
  }

  create(): void {
    const { width, height } = this.scale;

    // Ocean background
    this.add.rectangle(width / 2, height / 2, width, height, PALETTE.darkBg);

    // Animated wave pattern
    const waveGfx = this.add.graphics();
    this.drawWaves(waveGfx, width, height);

    // Title
    this.add.text(width / 2, height / 2 - 100, '세계 탐험', {
      fontSize: '72px',
      color: '#ffdd88',
      fontStyle: 'bold',
      stroke: '#2d1b00',
      strokeThickness: 6,
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 - 30, 'World Explorer', {
      fontSize: '30px',
      color: '#aaddff',
      stroke: '#0a1628',
      strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 + 10, '— 초등학교 4학년 세계 지리 탐험 게임 —', {
      fontSize: '16px',
      color: '#88bbcc',
    }).setOrigin(0.5);

    // Start button
    const hasSave = !!localStorage.getItem('worldExplorerState');
    const startBtn = this.createButton(width / 2, height / 2 + 80, '탐험 시작!', PALETTE.oceanLight);
    startBtn.on('pointerdown', () => {
      this.cameras.main.fadeOut(400);
      setTimeout(() => this.scene.start('CharacterSelectScene'), 420);
    });

    if (hasSave) {
      const contBtn = this.createButton(width / 2, height / 2 + 140, '이어하기', 0x2a7a2a);
      contBtn.on('pointerdown', () => {
        const state = JSON.parse(localStorage.getItem('worldExplorerState')!);
        this.cameras.main.fadeOut(400);
        setTimeout(() =>
          this.scene.start('WorldMapScene', { character: state.character }), 420
        );
      });
    }

    // Ship decoration
    this.createDecorativeShip(width * 0.15, height * 0.7);

    this.cameras.main.fadeIn(600);
  }

  private drawWaves(g: Phaser.GameObjects.Graphics, w: number, h: number): void {
    g.fillStyle(PALETTE.ocean, 0.4);
    for (let y = h * 0.5; y < h; y += 40) {
      g.fillRect(0, y, w, 20);
    }
  }

  private createButton(x: number, y: number, label: string, color: number): Phaser.GameObjects.Text {
    const btn = this.add.text(x, y, label, {
      fontSize: '28px',
      color: '#ffffff',
      backgroundColor: `#${color.toString(16).padStart(6, '0')}`,
      padding: { x: 36, y: 14 },
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setAlpha(0.8));
    btn.on('pointerout', () => btn.setAlpha(1.0));
    return btn;
  }

  private createDecorativeShip(x: number, y: number): void {
    const g = this.add.graphics();
    g.fillStyle(PALETTE.uiBg);
    // Hull
    g.fillRect(x - 24, y, 48, 16);
    // Mast
    g.fillStyle(0x8b6914);
    g.fillRect(x - 2, y - 40, 4, 42);
    // Sail
    g.fillStyle(PALETTE.white, 0.85);
    g.fillTriangle(x + 2, y - 38, x + 2, y - 8, x + 26, y - 22);

    this.tweens.add({
      targets: g,
      y: '+= 6',
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }
}
