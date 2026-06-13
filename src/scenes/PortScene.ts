import Phaser from 'phaser';
import type { Port, PortSceneData, CharacterType } from '../types';

export class PortScene extends Phaser.Scene {
  private port!: Port;
  private character!: CharacterType;
  private collectedSpecialties: Set<string> = new Set();

  constructor() {
    super({ key: 'PortScene' });
  }

  init(data: PortSceneData): void {
    this.port = data.port;
    this.character = data.character;
    this.collectedSpecialties = new Set(data.collectedSpecialties ?? []);
  }

  create(): void {
    const { width, height } = this.scale;
    const port = this.port;
    const cardW = 832, cardH = 530;
    const cx = width / 2, cy = height / 2;

    // Dim overlay
    this.add.rectangle(cx, cy, width, height, 0x000000, 0.75)
      .setInteractive();

    const cardContainer = this.add.container(cx, cy);

    const cardBg = this.add.rectangle(0, 0, cardW, cardH, 0x1a0d00, 0.97)
      .setStrokeStyle(3, 0xffdd88);

    // Region color band
    const regionColors: Record<string, number> = {
      asia: 0x8b0000, europe: 0x1a3a7a, africa: 0x8b6000,
      americas: 0x006b35, oceania: 0x006b8b, middleeast: 0x8b6b00,
    };
    const band = this.add.rectangle(0, -cardH / 2 + 36, cardW, 72,
      regionColors[port.region] ?? 0x2d1b00, 0.9);

    // City name
    const cityKo = this.add.text(0, -cardH / 2 + 22, port.nameKo, {
      fontSize: '38px', color: '#ffdd88', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);

    const cityEn = this.add.text(0, -cardH / 2 + 58,
      `${port.nameEn}  ·  ${port.countryKo}`, {
        fontSize: '16px', color: '#aaddff',
      }).setOrigin(0.5);

    // Landmark
    const lmLabel = this.add.text(-cardW / 2 + 20, -cardH / 2 + 92, '🏛️ 대표 명소', {
      fontSize: '14px', color: '#ffdd88', fontStyle: 'bold',
    });
    const lmName = this.add.text(-cardW / 2 + 20, -cardH / 2 + 112, port.landmark.nameKo, {
      fontSize: '17px', color: '#ffffff', fontStyle: 'bold',
    });
    const lmDesc = this.add.text(-cardW / 2 + 20, -cardH / 2 + 134, port.landmark.descKo, {
      fontSize: '14px', color: '#cccccc',
      wordWrap: { width: cardW - 40 },
    });

    // Specialties — all NEW since this is first visit
    const spLabel = this.add.text(-cardW / 2 + 20, -cardH / 2 + 185, '✨ 특산품 발견!', {
      fontSize: '14px', color: '#ffdd88', fontStyle: 'bold',
    });

    const spCellW = (cardW - 40) / 3;
    const spItems = port.specialties.flatMap((s, i) => {
      const sx = -cardW / 2 + 20 + i * spCellW;
      const sy = -cardH / 2 + 207;

      const box = this.add.rectangle(sx + spCellW / 2, sy + 50, spCellW - 8, 100,
        0xffffff, 0.07).setStrokeStyle(1, 0x44ff88, 0.6);

      const badge = this.add.text(sx + spCellW - 6, sy + 4, '✨ NEW!', {
        fontSize: '12px', color: '#44ff88',
        backgroundColor: 'rgba(0,50,0,0.7)',
        padding: { x: 4, y: 2 },
      }).setOrigin(1, 0);

      const nameKo = this.add.text(sx + spCellW / 2, sy + 22, s.nameKo, {
        fontSize: '17px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5);

      const nameEn = this.add.text(sx + spCellW / 2, sy + 44, s.nameEn, {
        fontSize: '13px', color: '#aaddff',
      }).setOrigin(0.5);

      const desc = this.add.text(sx + spCellW / 2, sy + 62, s.descKo, {
        fontSize: '12px', color: '#cccccc',
        wordWrap: { width: spCellW - 16 },
        align: 'center',
      }).setOrigin(0.5, 0);

      return [box, badge, nameKo, nameEn, desc];
    });

    // Fun fact
    const factBg = this.add.rectangle(0, cardH / 2 - 66, cardW - 20, 52,
      0xffff00, 0.06).setStrokeStyle(1, 0xffdd00, 0.4);
    const factLabel = this.add.text(-cardW / 2 + 20, cardH / 2 - 92, '💡 재미있는 사실!', {
      fontSize: '14px', color: '#ffff88', fontStyle: 'bold',
    });
    const fact = this.add.text(0, cardH / 2 - 66, port.funFact, {
      fontSize: '13px', color: '#ffffcc',
      wordWrap: { width: cardW - 40 },
      align: 'center',
    }).setOrigin(0.5);

    // Character speech
    const charColor = this.character === 'jun' ? '#aaddff' : '#ffaaaa';
    const charMsg = this.character === 'jun'
      ? `"드디어 찾았다! 여기가 바로 ${port.nameKo}이구나!"`
      : `"여기가 ${port.nameKo}이구나. 노트에 기록해야겠어!"`;
    const speech = this.add.text(0, cardH / 2 - 14, charMsg, {
      fontSize: '14px', color: charColor, fontStyle: 'italic',
    }).setOrigin(0.5);

    // Close button
    const closeBtn = this.add.text(cardW / 2 - 18, -cardH / 2 + 18, '✕', {
      fontSize: '22px', color: '#ffffff',
      backgroundColor: 'rgba(180,40,40,0.7)',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.closeScene());
    closeBtn.on('pointerover', () =>
      closeBtn.setStyle({ backgroundColor: 'rgba(220,60,60,0.9)' }));
    closeBtn.on('pointerout', () =>
      closeBtn.setStyle({ backgroundColor: 'rgba(180,40,40,0.7)' }));

    cardContainer.add([
      cardBg, band, cityKo, cityEn,
      lmLabel, lmName, lmDesc,
      spLabel, ...spItems,
      factBg, factLabel, fact,
      speech, closeBtn,
    ]);

    cardContainer.setScale(0.85, 0);
    this.tweens.add({
      targets: cardContainer,
      scaleX: 1, scaleY: 1,
      duration: 280,
      ease: 'Back.Out',
    });

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
