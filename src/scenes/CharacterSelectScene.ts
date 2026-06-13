import Phaser from 'phaser';
import type { CharacterType } from '../types';

export class CharacterSelectScene extends Phaser.Scene {
  private selectedChar: CharacterType | null = null;

  constructor() {
    super({ key: 'CharacterSelectScene' });
  }

  create(): void {
    const { width, height } = this.scale;

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x0a1628);

    // Stars
    for (let i = 0; i < 60; i++) {
      const sx = Phaser.Math.Between(0, width);
      const sy = Phaser.Math.Between(0, height * 0.6);
      this.add.circle(sx, sy, Phaser.Math.FloatBetween(0.5, 1.5), 0xffffff, 0.7);
    }

    // Title
    this.add.text(width / 2, 56, '누구와 함께 떠날까?', {
      fontSize: '38px',
      color: '#ffdd88',
      fontStyle: 'bold',
      stroke: '#2d1b00',
      strokeThickness: 4,
    }).setOrigin(0.5);

    // Character cards
    this.createCharCard(width / 4, height / 2 + 10, 'jun',
      '항해사 준', 'Jun the Navigator',
      '밝고 호기심 많은 항해사!\n세계 곳곳을 누비며\n신기한 것을 발견해요.',
      0x1a4a7a, 0x2389a8);

    this.createCharCard(3 * width / 4, height / 2 + 10, 'ara',
      '탐험가 아라', 'Ara the Explorer',
      '용감하고 지식욕 강한 탐험가!\n각 나라의 비밀을\n노트에 기록해요.',
      0x7a1a1a, 0xb83030);

    this.cameras.main.fadeIn(500);
  }

  private createCharCard(
    cx: number, cy: number,
    char: CharacterType,
    nameKo: string, nameEn: string,
    desc: string,
    bgColor: number, accentColor: number
  ): void {
    const cardW = 300, cardH = 380;
    const container = this.add.container(cx, cy);

    // Card background
    const bg = this.add.rectangle(0, 0, cardW, cardH, bgColor, 0.9)
      .setStrokeStyle(3, accentColor);

    // Character pixel art sprite
    const sprite = this.drawCharSprite(0, -80, char, accentColor);

    // Name
    const nameText = this.add.text(0, 40, nameKo, {
      fontSize: '26px',
      color: '#ffdd88',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const nameEnText = this.add.text(0, 72, nameEn, {
      fontSize: '15px',
      color: '#aaddff',
    }).setOrigin(0.5);

    // Description
    const descText = this.add.text(0, 118, desc, {
      fontSize: '14px',
      color: '#dddddd',
      align: 'center',
      lineSpacing: 4,
    }).setOrigin(0.5);

    // Select button
    const btn = this.add.text(0, 164, '선택하기!', {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: `#${accentColor.toString(16).padStart(6, '0')}`,
      padding: { x: 28, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    container.add([bg, sprite, nameText, nameEnText, descText, btn]);

    // Interactions
    const onSelect = () => this.selectCharacter(char);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', onSelect);
    btn.on('pointerdown', onSelect);

    bg.on('pointerover', () => {
      this.tweens.add({ targets: container, y: cy - 8, duration: 150, ease: 'Quad.Out' });
      bg.setStrokeStyle(4, 0xffffff);
    });
    bg.on('pointerout', () => {
      this.tweens.add({ targets: container, y: cy, duration: 150, ease: 'Quad.Out' });
      bg.setStrokeStyle(3, accentColor);
    });
  }

  private drawCharSprite(x: number, y: number, char: CharacterType, color: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    const c = color;
    const skin = 0xe8b87a;

    // Body
    g.fillStyle(c);
    g.fillRect(x - 14, y + 10, 28, 36);

    // Head
    g.fillStyle(skin);
    g.fillRect(x - 10, y - 16, 20, 22);

    // Hat / Bandana
    if (char === 'jun') {
      // Blue captain hat
      g.fillStyle(c);
      g.fillRect(x - 12, y - 22, 24, 8);
      g.fillRect(x - 8, y - 26, 16, 6);
    } else {
      // Red bandana
      g.fillStyle(0xcc2222);
      g.fillRect(x - 12, y - 22, 24, 10);
    }

    // Eyes
    g.fillStyle(0x222222);
    g.fillRect(x - 5, y - 8, 3, 3);
    g.fillRect(x + 2, y - 8, 3, 3);

    // Legs
    g.fillStyle(0x333366);
    g.fillRect(x - 10, y + 46, 10, 20);
    g.fillRect(x + 0, y + 46, 10, 20);

    return g;
  }

  private selectCharacter(char: CharacterType): void {
    this.selectedChar = char;
    this.cameras.main.fadeOut(400);
    this.time.delayedCall(400, () => {
      this.scene.start('WorldMapScene', { character: char });
    });
  }
}
