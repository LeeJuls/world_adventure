import Phaser from 'phaser';
import type { Port, LogbookSceneData } from '../types';
import portsData from '../data/ports';

export class LogbookScene extends Phaser.Scene {
  private discoveredPorts: string[] = [];

  constructor() {
    super({ key: 'LogbookScene' });
  }

  init(data: LogbookSceneData): void {
    this.discoveredPorts = data.discoveredPorts ?? [];
  }

  create(): void {
    const { width, height } = this.scale;
    const count = this.discoveredPorts.length;

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x0d0a00);

    // Parchment texture
    const pg = this.add.graphics();
    pg.fillStyle(0x1a1200, 0.6);
    pg.fillRoundedRect(20, 20, width - 40, height - 40, 12);
    pg.lineStyle(2, 0xffdd88, 0.5);
    pg.strokeRoundedRect(20, 20, width - 40, height - 40, 12);

    // Title
    this.add.text(width / 2, 52, '📖 탐험 기록장', {
      fontSize: '36px', color: '#ffdd88', fontStyle: 'bold',
      stroke: '#2d1b00', strokeThickness: 3,
    }).setOrigin(0.5);

    // Rank + progress
    const rank = this.getRank(count);
    this.add.text(width / 2, 94, `${rank}  |  발견한 도시: ${count} / 50`, {
      fontSize: '18px', color: '#aaddff',
    }).setOrigin(0.5);

    // Progress bar
    const barW = 600;
    this.add.rectangle(width / 2, 120, barW + 4, 14, 0x333333).setOrigin(0.5);
    const filled = Math.round(barW * (count / 50));
    if (filled > 0) {
      this.add.rectangle(width / 2 - barW / 2 + filled / 2, 120, filled, 10, 0x44dd88).setOrigin(0.5);
    }

    // Port grid
    const allPorts = portsData.ports;
    const cols = 10;
    const cellW = 95, cellH = 58;
    const rows = Math.ceil(allPorts.length / cols);
    const gridW = cols * cellW;
    const startX = (width - gridW) / 2 + cellW / 2;
    const startY = 148;

    allPorts.forEach((port: Port, i: number) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = startX + col * cellW;
      const cy = startY + row * cellH;
      const discovered = this.discoveredPorts.includes(port.id);

      // Cell background
      const cellBg = this.add.rectangle(cx, cy, cellW - 4, cellH - 6,
        discovered ? 0x1a4a2a : 0x1a1a1a, 0.9
      ).setStrokeStyle(1, discovered ? 0x44dd88 : 0x333333);

      // Stamp effect for discovered
      if (discovered) {
        this.add.circle(cx, cy, 20, 0x44dd88, 0.15);
        this.add.text(cx, cy - 12, '✓', { fontSize: '12px', color: '#44dd88' }).setOrigin(0.5);
      }

      this.add.text(cx, cy + (discovered ? 0 : -5), port.nameKo, {
        fontSize: '11px',
        color: discovered ? '#ffffff' : '#444444',
        fontStyle: discovered ? 'bold' : 'normal',
      }).setOrigin(0.5);

      this.add.text(cx, cy + 14, port.nameEn, {
        fontSize: '9px',
        color: discovered ? '#aaddff' : '#333333',
      }).setOrigin(0.5);

      // Tooltip on hover
      if (discovered) {
        cellBg.setInteractive({ useHandCursor: true });
        cellBg.on('pointerover', () => this.showTooltip(port, cx, cy - cellH / 2 - 4));
        cellBg.on('pointerout', () => this.hideTooltip());
      }

      void cellBg;
    });

    // Region legend
    const regionLabels: [string, string, number][] = [
      ['아시아', 'Asia', 0xcc4444],
      ['유럽', 'Europe', 0x4466cc],
      ['아프리카', 'Africa', 0xcc9900],
      ['아메리카', 'Americas', 0x44aa44],
      ['오세아니아', 'Oceania', 0x449999],
      ['중동', 'Middle East', 0xaaaa44],
    ];
    const legendY = startY + rows * cellH + 16;
    regionLabels.forEach(([ko, , color], i) => {
      const lx = 60 + i * 160;
      this.add.rectangle(lx, legendY, 12, 12, color).setOrigin(0.5);
      this.add.text(lx + 10, legendY, ko, { fontSize: '12px', color: '#bbbbbb' }).setOrigin(0, 0.5);
    });

    // Back button
    const backBtn = this.add.text(width / 2, height - 36, '← 지도로 돌아가기', {
      fontSize: '20px', color: '#ffffff',
      backgroundColor: 'rgba(35,137,168,0.8)',
      padding: { x: 24, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    backBtn.on('pointerover', () => backBtn.setAlpha(0.8));
    backBtn.on('pointerout', () => backBtn.setAlpha(1));
    backBtn.on('pointerdown', () => {
      this.scene.stop();
      this.scene.resume('WorldMapScene');
    });

    this.input.keyboard!.once('keydown-ESC', () => {
      this.scene.stop();
      this.scene.resume('WorldMapScene');
    });
  }

  private tooltip: Phaser.GameObjects.Container | null = null;

  private showTooltip(port: Port, x: number, y: number): void {
    this.hideTooltip();
    const { width } = this.scale;
    const tx = Phaser.Math.Clamp(x, 120, width - 120);
    const bg = this.add.rectangle(0, 0, 220, 56, 0x2d1b00, 0.95).setStrokeStyle(1, 0xffdd88);
    const name = this.add.text(0, -14, port.nameKo, { fontSize: '14px', color: '#ffdd88', fontStyle: 'bold' }).setOrigin(0.5);
    const sp = this.add.text(0, 8, port.specialties.map(s => s.nameKo).join(' · '), { fontSize: '11px', color: '#aaaaaa' }).setOrigin(0.5);
    this.tooltip = this.add.container(tx, y).add([bg, name, sp]).setDepth(50);
  }

  private hideTooltip(): void {
    this.tooltip?.destroy();
    this.tooltip = null;
  }

  private getRank(count: number): string {
    if (count >= 31) return '🌍 세계 일주 달인';
    if (count >= 16) return '🗺️ 항해사';
    if (count >= 6) return '⚓ 탐험가';
    return '🚢 견습 선원';
  }
}
