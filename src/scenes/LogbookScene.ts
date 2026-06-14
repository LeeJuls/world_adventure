import Phaser from 'phaser';
import type { Port, LogbookSceneData } from '../types';
import portsData from '../data/ports';
import { QUESTS } from '../data/quests';

export class LogbookScene extends Phaser.Scene {
  private discoveredPorts: string[] = [];
  private collectedSpecialties: Set<string> = new Set();
  private completedQuests: string[] = [];

  constructor() {
    super({ key: 'LogbookScene' });
  }

  init(data: LogbookSceneData): void {
    this.discoveredPorts = data.discoveredPorts ?? [];
    this.collectedSpecialties = new Set(data.collectedSpecialties ?? []);
    this.completedQuests = data.completedQuests ?? [];
  }

  create(): void {
    const { width, height } = this.scale;
    const portCount = this.discoveredPorts.length;
    const spCount = this.collectedSpecialties.size;

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x0d0a00);

    const pg = this.add.graphics();
    pg.fillStyle(0x1a1200, 0.6);
    pg.fillRoundedRect(20, 20, width - 40, height - 40, 12);
    pg.lineStyle(2, 0xffdd88, 0.5);
    pg.strokeRoundedRect(20, 20, width - 40, height - 40, 12);

    // Title
    this.add.text(width / 2, 50, '📖 탐험 기록장', {
      fontSize: '34px', color: '#ffdd88', fontStyle: 'bold',
      stroke: '#2d1b00', strokeThickness: 3,
    }).setOrigin(0.5);

    // Rank + stats
    const rank = this.getRank(portCount);
    // Quest mission count joins the stats line (denominator = QUESTS.length, never hardcoded).
    this.add.text(width / 2, 88,
      `${rank}  |  항구: ${portCount}/50  ·  특산품: ${spCount}/150  ·  🏆 임무: ${this.completedQuests.length}/${QUESTS.length}`, {
      fontSize: '16px', color: '#aaddff',
    }).setOrigin(0.5);

    // Port progress bar
    const barW = 580;
    const barX = width / 2 - barW / 2;
    this.add.text(barX, 107, '🗺️ 항구 탐험', { fontSize: '12px', color: '#aaddff' });
    this.add.rectangle(width / 2, 122, barW + 4, 12, 0x222222).setOrigin(0.5);
    if (portCount > 0) {
      const fill = Math.round(barW * portCount / 50);
      this.add.rectangle(barX + fill / 2, 122, fill, 8, 0x44dd88).setOrigin(0.5);
    }

    // Specialty progress bar
    this.add.text(barX, 135, '✨ 특산품 수집', { fontSize: '12px', color: '#ffcc88' });
    this.add.rectangle(width / 2, 150, barW + 4, 12, 0x222222).setOrigin(0.5);
    if (spCount > 0) {
      const fill2 = Math.round(barW * spCount / 150);
      this.add.rectangle(barX + fill2 / 2, 150, fill2, 8, 0xffaa33).setOrigin(0.5);
    }
    // Percentage label
    this.add.text(barX + barW + 8, 150, `${Math.round(spCount / 150 * 100)}%`, {
      fontSize: '11px', color: '#ffcc88',
    }).setOrigin(0, 0.5);

    // Port grid
    const allPorts = portsData.ports;
    const cols = 10;
    const cellW = 95, cellH = 58;
    const rows = Math.ceil(allPorts.length / cols);
    const gridW = cols * cellW;
    const startX = (width - gridW) / 2 + cellW / 2;
    const startY = 168;

    allPorts.forEach((port: Port, i: number) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = startX + col * cellW;
      const cy = startY + row * cellH;
      const discovered = this.discoveredPorts.includes(port.id);
      const spCollected = port.specialties.filter(
        s => this.collectedSpecialties.has(`${port.id}:${s.icon}`)
      ).length;

      const cellBg = this.add.rectangle(cx, cy, cellW - 4, cellH - 6,
        discovered ? 0x1a4a2a : 0x1a1a1a, 0.9
      ).setStrokeStyle(1, discovered ? 0x44dd88 : 0x333333);

      if (discovered) {
        this.add.circle(cx, cy, 20, 0x44dd88, 0.12);
        this.add.text(cx, cy - 12, '✓', { fontSize: '12px', color: '#44dd88' })
          .setOrigin(0.5);
        // Specialty dots
        const dotSpacing = 10;
        const dotsStartX = cx - dotSpacing;
        for (let d = 0; d < 3; d++) {
          const dotX = dotsStartX + d * dotSpacing;
          this.add.circle(dotX, cy + 20, 3,
            d < spCollected ? 0xffaa33 : 0x444444, d < spCollected ? 1 : 0.6);
        }
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
    const legendY = startY + rows * cellH + 12;
    regionLabels.forEach(([ko, , color], i) => {
      const lx = 50 + i * 160;
      this.add.rectangle(lx, legendY, 10, 10, color).setOrigin(0.5);
      this.add.text(lx + 8, legendY, ko, { fontSize: '11px', color: '#bbbbbb' })
        .setOrigin(0, 0.5);
    });

    // Back button
    const backBtn = this.add.text(width / 2, height - 34, '← 지도로 돌아가기', {
      fontSize: '18px', color: '#ffffff',
      backgroundColor: 'rgba(35,137,168,0.8)',
      padding: { x: 24, y: 8 },
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
    const spCount = port.specialties.filter(
      s => this.collectedSpecialties.has(`${port.id}:${s.icon}`)
    ).length;

    const bg = this.add.rectangle(0, 0, 240, 58, 0x2d1b00, 0.95)
      .setStrokeStyle(1, 0xffdd88);
    const name = this.add.text(0, -16, port.nameKo, {
      fontSize: '14px', color: '#ffdd88', fontStyle: 'bold',
    }).setOrigin(0.5);
    const sp = this.add.text(0, 4, port.specialties.map(s => s.nameKo).join(' · '), {
      fontSize: '11px', color: '#aaaaaa',
    }).setOrigin(0.5);
    const spBadge = this.add.text(0, 20, `특산품 ${spCount}/3 수집`, {
      fontSize: '11px', color: spCount === 3 ? '#ffaa33' : '#666666',
    }).setOrigin(0.5);

    this.tooltip = this.add.container(tx, y)
      .add([bg, name, sp, spBadge]).setDepth(50);
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
