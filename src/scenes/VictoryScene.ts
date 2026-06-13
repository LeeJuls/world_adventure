import Phaser from 'phaser';
import type { VictorySceneData, CharacterType } from '../types';

export class VictoryScene extends Phaser.Scene {
  private character: CharacterType = 'jun';
  private totalTime = 0;

  constructor() {
    super({ key: 'VictoryScene' });
  }

  init(data: VictorySceneData): void {
    this.character = data.character ?? 'jun';
    this.totalTime = data.totalTime ?? 0;
  }

  create(): void {
    const { width, height } = this.scale;
    const cx = width / 2, cy = height / 2;

    this.add.rectangle(cx, cy, width, height, 0x0a1628);
    this.createStars();

    // Soft glow
    const glow = this.add.graphics();
    glow.fillStyle(0xffdd00, 0.05);
    glow.fillCircle(cx, cy - 40, 280);

    // Trophy
    const trophy = this.add.text(cx, 76, '🏆', { fontSize: '64px' }).setOrigin(0.5);
    this.tweens.add({
      targets: trophy,
      scaleX: 1.15, scaleY: 1.15,
      yoyo: true, repeat: -1,
      duration: 900, ease: 'Sine.InOut',
    });

    // Title
    this.add.text(cx, 160, '축하합니다!', {
      fontSize: '50px', color: '#ffdd88', fontStyle: 'bold',
      stroke: '#2d1b00', strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(cx, 218, '세계 모든 특산품을 수집했어요!', {
      fontSize: '21px', color: '#ffffff',
    }).setOrigin(0.5);

    // Character message
    const msg = this.character === 'jun'
      ? '"와! 드디어 전 세계를 다 탐험했다!\n진정한 세계 일주 달인이야!"'
      : '"모든 특산품을 모았어!\n이제 세계 어디에 뭐가 있는지 다 알아!"';
    this.add.text(cx, 288, msg, {
      fontSize: '16px',
      color: this.character === 'jun' ? '#aaddff' : '#ffaaaa',
      fontStyle: 'italic',
      align: 'center',
    }).setOrigin(0.5);

    // Stats panel
    const panelG = this.add.graphics();
    panelG.fillStyle(0xffffff, 0.05);
    panelG.lineStyle(1, 0xffdd88, 0.4);
    panelG.fillRoundedRect(cx - 220, 336, 440, 80, 8);
    panelG.strokeRoundedRect(cx - 220, 336, 440, 80, 8);

    this.add.text(cx - 100, 366, '⚓ 발견한 항구', {
      fontSize: '13px', color: '#aaddff',
    }).setOrigin(0.5);
    this.add.text(cx - 100, 390, '50 / 50', {
      fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(cx + 100, 366, '✨ 수집한 특산품', {
      fontSize: '13px', color: '#ffcc88',
    }).setOrigin(0.5);
    this.add.text(cx + 100, 390, '150 / 150', {
      fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);

    // Time
    this.add.text(cx, 432, `⏱️ 탐험 시간: ${this.formatTime(this.totalTime)}`, {
      fontSize: '15px', color: '#88cc88',
    }).setOrigin(0.5);

    // Play again
    const replayBtn = this.add.text(cx, height - 68, '🔄 다시 탐험하기', {
      fontSize: '22px', color: '#ffffff',
      backgroundColor: 'rgba(35,137,168,0.8)',
      padding: { x: 28, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    replayBtn.on('pointerover', () =>
      replayBtn.setStyle({ backgroundColor: 'rgba(50,180,220,0.9)' }));
    replayBtn.on('pointerout', () =>
      replayBtn.setStyle({ backgroundColor: 'rgba(35,137,168,0.8)' }));
    replayBtn.on('pointerdown', () => {
      localStorage.removeItem('worldExplorerState');
      this.cameras.main.fadeOut(400);
      setTimeout(() => this.scene.start('CharacterSelectScene'), 420);
    });

    this.cameras.main.fadeIn(600);
  }

  private createStars(): void {
    const { width, height } = this.scale;
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.7);
    for (let i = 0; i < 80; i++) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, height);
      const r = Phaser.Math.Between(1, 2);
      g.fillRect(x, y, r, r);
    }
  }

  private formatTime(ms: number): string {
    const sec = Math.floor(ms / 1000);
    const m = Math.floor(sec / 60);
    const h = Math.floor(m / 60);
    const s = sec % 60;
    const mm = m % 60;
    if (h > 0) return `${h}시간 ${mm}분 ${s}초`;
    return `${mm}분 ${s}초`;
  }
}
