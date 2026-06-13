import Phaser from 'phaser';
import type { Port, PortSceneData, CharacterType } from '../types';

export class PortScene extends Phaser.Scene {
  private port!: Port;
  private character!: CharacterType;

  constructor() {
    super({ key: 'PortScene' });
  }

  init(data: PortSceneData): void {
    this.port = data.port;
    this.character = data.character;
  }

  create(): void {
    const { width, height } = this.scale;
    const port = this.port;
    const cardW = 620, cardH = 440;
    const cx = width / 2, cy = height / 2;

    // Dim overlay
    this.add.rectangle(cx, cy, width, height, 0x000000, 0.75)
      .setInteractive(); // block clicks through

    // Card container (for tween)
    const cardContainer = this.add.container(cx, cy);

    // Card background
    const cardBg = this.add.rectangle(0, 0, cardW, cardH, 0x1a0d00, 0.97)
      .setStrokeStyle(3, 0xffdd88);

    // ── Top: region color band ──
    const regionColors: Record<string, number> = {
      asia: 0x8b0000, europe: 0x1a3a7a, africa: 0x8b6000,
      americas: 0x006b35, oceania: 0x006b8b, middleeast: 0x8b6b00,
    };
    const bandColor = regionColors[port.region] ?? 0x2d1b00;
    const band = this.add.rectangle(0, -cardH / 2 + 36, cardW, 72, bandColor, 0.9);

    // ── City name ──
    const cityKo = this.add.text(0, -cardH / 2 + 22, port.nameKo, {
      fontSize: '38px', color: '#ffdd88', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);

    const cityEn = this.add.text(0, -cardH / 2 + 58, `${port.nameEn}  ·  ${port.countryKo}`, {
      fontSize: '16px', color: '#aaddff',
    }).setOrigin(0.5);

    // ── Landmark ──
    const lmLabel = this.add.text(-cardW / 2 + 20, -cardH / 2 + 92, '🏛️ 대표 명소', {
      fontSize: '14px', color: '#ffdd88', fontStyle: 'bold',
    });
    const lmName = this.add.text(-cardW / 2 + 20, -cardH / 2 + 112, port.landmark.nameKo, {
      fontSize: '17px', color: '#ffffff', fontStyle: 'bold',
    });
    const lmDesc = this.add.text(-cardW / 2 + 20, -cardH / 2 + 134, port.landmark.descKo, {
      fontSize: '13px', color: '#cccccc',
      wordWrap: { width: cardW - 40 },
    });

    // ── Specialties ──
    const spLabel = this.add.text(-cardW / 2 + 20, -cardH / 2 + 176, '✨ 특산품', {
      fontSize: '14px', color: '#ffdd88', fontStyle: 'bold',
    });

    const spItems = port.specialties.map((s, i) => {
      const sx = -cardW / 2 + 20 + i * (cardW - 40) / 3;
      const sy = -cardH / 2 + 198;
      const box = this.add.rectangle(sx + 80, sy + 30, (cardW - 40) / 3 - 8, 60, 0xffffff, 0.06)
        .setStrokeStyle(1, 0x555555);
      const nameKo = this.add.text(sx + 80, sy + 18, s.nameKo, {
        fontSize: '15px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5);
      const nameEn = this.add.text(sx + 80, sy + 38, s.nameEn, {
        fontSize: '12px', color: '#aaddff',
      }).setOrigin(0.5);
      const desc = this.add.text(sx + 80, sy + 56, s.descKo, {
        fontSize: '11px', color: '#bbbbbb',
        wordWrap: { width: (cardW - 40) / 3 - 12 },
        align: 'center',
      }).setOrigin(0.5, 0);
      return [box, nameKo, nameEn, desc];
    }).flat();

    // ── Fun fact ──
    const factBg = this.add.rectangle(0, cardH / 2 - 70, cardW - 20, 52, 0xffff00, 0.07)
      .setStrokeStyle(1, 0xffdd00, 0.5);
    const factLabel = this.add.text(-cardW / 2 + 20, cardH / 2 - 90, '💡 재미있는 사실!', {
      fontSize: '13px', color: '#ffff88', fontStyle: 'bold',
    });
    const fact = this.add.text(0, cardH / 2 - 68, port.funFact, {
      fontSize: '13px', color: '#ffffcc',
      wordWrap: { width: cardW - 40 },
      align: 'center',
    }).setOrigin(0.5);

    // ── Character speech bubble ──
    const charColor = this.character === 'jun' ? '#aaddff' : '#ffaaaa';
    const charMsg = this.character === 'jun'
      ? `"드디어 찾았다! 여기가 바로 ${port.nameKo}이구나!"`
      : `"여기가 ${port.nameKo}이구나. 노트에 기록해야겠어!"`;
    const speech = this.add.text(0, cardH / 2 - 18, charMsg, {
      fontSize: '13px', color: charColor, fontStyle: 'italic',
    }).setOrigin(0.5);

    // ── Close button ──
    const closeBtn = this.add.text(cardW / 2 - 18, -cardH / 2 + 18, '✕', {
      fontSize: '22px', color: '#ffffff',
      backgroundColor: 'rgba(180,40,40,0.7)',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.closeScene());
    closeBtn.on('pointerover', () => closeBtn.setStyle({ backgroundColor: 'rgba(220,60,60,0.9)' }));
    closeBtn.on('pointerout', () => closeBtn.setStyle({ backgroundColor: 'rgba(180,40,40,0.7)' }));

    // Add all to container
    cardContainer.add([
      cardBg, band,
      cityKo, cityEn,
      lmLabel, lmName, lmDesc,
      spLabel, ...spItems,
      factBg, factLabel, fact,
      speech, closeBtn,
    ]);

    // Entrance tween
    cardContainer.setScale(0.85, 0);
    this.tweens.add({
      targets: cardContainer,
      scaleX: 1, scaleY: 1,
      duration: 280,
      ease: 'Back.Out',
    });

    // ESC to close
    this.input.keyboard!.once('keydown-ESC', () => this.closeScene());
  }

  private closeScene(): void {
    this.tweens.add({
      targets: this.children.getAll(),
      alpha: 0,
      duration: 200,
      onComplete: () => {
        this.scene.stop();
        this.scene.resume('WorldMapScene');
      },
    });
  }
}
