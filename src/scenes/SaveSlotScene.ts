import Phaser from 'phaser';
import type { SaveSlotSceneData, GameState } from '../types';

const SLOT_KEY = (n: number) => `worldExplorer_slot_${n}`;
const TOTAL_SLOTS = 20;

interface SlotData {
  slot: number;
  state: GameState | null;
}

export class SaveSlotScene extends Phaser.Scene {
  private mode: 'save' | 'load' = 'load';
  private pendingSaveState: GameState | null = null;
  private confirmOverlay: Phaser.GameObjects.Container | null = null;

  constructor() {
    super({ key: 'SaveSlotScene' });
  }

  init(data: SaveSlotSceneData): void {
    this.mode = data.mode;
    this.pendingSaveState = data.gameState ?? null;
    this.confirmOverlay = null;
  }

  create(): void {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    // Dimmed backdrop
    this.add.rectangle(cx, cy, width, height, 0x000000, 0.78).setInteractive();

    // Modal card
    const modalW = 940;
    const modalH = 520;
    this.add.rectangle(cx, cy, modalW, modalH, 0x0d1e2e, 0.97)
      .setStrokeStyle(2, 0xffdd88);

    // Title
    const title = this.mode === 'save' ? '💾 저장 슬롯 선택' : '📂 이어하기 — 슬롯 선택';
    this.add.text(cx, cy - modalH / 2 + 28, title, {
      fontSize: '22px', color: '#ffdd88', fontStyle: 'bold',
    }).setOrigin(0.5);

    // Close button
    const closeBtn = this.add.text(cx + modalW / 2 - 16, cy - modalH / 2 + 16, '✕', {
      fontSize: '20px', color: '#ffffff',
      backgroundColor: 'rgba(180,40,40,0.7)',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.closeScene());
    closeBtn.on('pointerover', () => closeBtn.setStyle({ backgroundColor: 'rgba(220,60,60,0.9)' }));
    closeBtn.on('pointerout', () => closeBtn.setStyle({ backgroundColor: 'rgba(180,40,40,0.7)' }));

    this.input.keyboard!.once('keydown-ESC', () => this.closeScene());

    this.buildGrid(cx, cy, modalW, modalH);
  }

  private loadAllSlots(): SlotData[] {
    const slots: SlotData[] = [];
    for (let i = 1; i <= TOTAL_SLOTS; i++) {
      const raw = localStorage.getItem(SLOT_KEY(i));
      let state: GameState | null = null;
      if (raw) {
        try { state = JSON.parse(raw); } catch { /* ignore */ }
      }
      slots.push({ slot: i, state });
    }
    return slots;
  }

  private buildGrid(cx: number, cy: number, modalW: number, modalH: number): void {
    const slots = this.loadAllSlots();

    const cols = 4;
    const rows = 5;
    const cardW = 210;
    const cardH = 76;
    const padX = 12;
    const padY = 10;
    const gridW = cols * cardW + (cols - 1) * padX;
    const gridH = rows * cardH + (rows - 1) * padY;
    const startX = cx - gridW / 2 + cardW / 2;
    const startY = cy - modalH / 2 + 64 + cardH / 2;

    slots.forEach(({ slot, state }) => {
      const col = (slot - 1) % cols;
      const row = Math.floor((slot - 1) / cols);
      const sx = startX + col * (cardW + padX);
      const sy = startY + row * (cardH + padY);

      this.buildSlotCard(sx, sy, cardW, cardH, slot, state);
    });
  }

  private buildSlotCard(
    sx: number, sy: number,
    cardW: number, cardH: number,
    slot: number, state: GameState | null,
  ): void {
    const isEmpty = state === null;
    const isLoadMode = this.mode === 'load';

    // Disabled in load mode when slot is empty
    const disabled = isLoadMode && isEmpty;

    const bgColor = isEmpty ? 0x1a1a2e : 0x1a3a5c;
    const strokeColor = isEmpty ? 0x444466 : 0x4488cc;

    const bg = this.add.rectangle(sx, sy, cardW, cardH, bgColor, disabled ? 0.4 : 0.9)
      .setStrokeStyle(1, strokeColor, disabled ? 0.3 : 0.8);

    this.add.text(sx - cardW / 2 + 8, sy - cardH / 2 + 6, `#${slot}`, {
      fontSize: '11px', color: '#667799',
    });

    if (isEmpty) {
      this.add.text(sx, sy, '빈 슬롯', {
        fontSize: '15px', color: '#445566',
        fontStyle: 'italic',
      }).setOrigin(0.5);
    } else {
      const charIcon = state!.character === 'jun' ? '⛵ 준' : '🗺 아라';
      const portsCount = (state!.discoveredPorts ?? []).length;
      const spCount = (state!.collectedSpecialties ?? []).length;
      const dateStr = state!.lastPlayed
        ? new Date(state!.lastPlayed).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '';

      this.add.text(sx - cardW / 2 + 8, sy - 18, `${charIcon}`, {
        fontSize: '13px', color: '#aaddff', fontStyle: 'bold',
      });
      this.add.text(sx - cardW / 2 + 8, sy, `항구 ${portsCount}/50  특산품 ${spCount}/150`, {
        fontSize: '12px', color: '#88ccee',
      });
      this.add.text(sx - cardW / 2 + 8, sy + 16, dateStr, {
        fontSize: '11px', color: '#556677',
      });
    }

    if (!disabled) {
      bg.setInteractive({ useHandCursor: true });

      const hoverOn = () => bg.setFillStyle(isEmpty ? 0x2a2a4e : 0x1a4a7c, 0.95);
      const hoverOff = () => bg.setFillStyle(bgColor, 0.9);

      bg.on('pointerover', hoverOn);
      bg.on('pointerout', hoverOff);
      bg.on('pointerdown', () => this.onSlotClick(slot, state));
    }
  }

  private onSlotClick(slot: number, existing: GameState | null): void {
    if (this.mode === 'save') {
      if (existing !== null) {
        this.showConfirm(slot);
      } else {
        this.doSave(slot);
      }
    } else {
      // Load mode
      if (existing !== null) {
        this.doLoad(slot, existing);
      }
    }
  }

  private doSave(slot: number): void {
    if (!this.pendingSaveState) return;
    const stateToSave: GameState = {
      ...this.pendingSaveState,
      lastPlayed: new Date().toISOString(),
    };
    localStorage.setItem(SLOT_KEY(slot), JSON.stringify(stateToSave));
    this.showSavedFeedback(slot);
  }

  private doLoad(slot: number, state: GameState): void {
    this.tweens.add({
      targets: this.children.getAll(),
      alpha: 0,
      duration: 200,
      onComplete: () => {
        this.scene.stop();
        this.scene.start('WorldMapScene', { character: state.character, saveSlot: slot });
      },
    });
  }

  private showConfirm(slot: number): void {
    if (this.confirmOverlay) return;
    const { width, height } = this.scale;
    const cx = width / 2, cy = height / 2;
    const container = this.add.container(cx, cy);
    this.confirmOverlay = container;

    const bg = this.add.rectangle(0, 0, 360, 160, 0x0d1e2e, 0.98)
      .setStrokeStyle(2, 0xff8844);
    const msg = this.add.text(0, -50, `슬롯 #${slot}을 덮어쓸까요?`, {
      fontSize: '18px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    const sub = this.add.text(0, -18, '기존 저장 데이터가 사라집니다.', {
      fontSize: '13px', color: '#ffcc88',
    }).setOrigin(0.5);

    const yesBtn = this.add.text(-70, 30, '덮어쓰기', {
      fontSize: '16px', color: '#ffffff',
      backgroundColor: 'rgba(180,40,40,0.85)',
      padding: { x: 14, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    yesBtn.on('pointerdown', () => {
      this.destroyConfirm();
      this.doSave(slot);
    });
    yesBtn.on('pointerover', () => yesBtn.setStyle({ backgroundColor: 'rgba(220,60,60,0.95)' }));
    yesBtn.on('pointerout', () => yesBtn.setStyle({ backgroundColor: 'rgba(180,40,40,0.85)' }));

    const noBtn = this.add.text(70, 30, '취소', {
      fontSize: '16px', color: '#ffffff',
      backgroundColor: 'rgba(40,80,130,0.85)',
      padding: { x: 14, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    noBtn.on('pointerdown', () => this.destroyConfirm());
    noBtn.on('pointerover', () => noBtn.setStyle({ backgroundColor: 'rgba(60,110,180,0.95)' }));
    noBtn.on('pointerout', () => noBtn.setStyle({ backgroundColor: 'rgba(40,80,130,0.85)' }));

    container.add([bg, msg, sub, yesBtn, noBtn]);
  }

  private destroyConfirm(): void {
    this.confirmOverlay?.destroy();
    this.confirmOverlay = null;
  }

  private showSavedFeedback(slot: number): void {
    const { width, height } = this.scale;
    this.add.text(width / 2, height / 2, `✅ 슬롯 #${slot}에 저장 완료!`, {
      fontSize: '22px', color: '#44ff88', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
      backgroundColor: 'rgba(0,0,0,0.85)',
      padding: { x: 24, y: 12 },
    }).setOrigin(0.5).setDepth(30);

    setTimeout(() => this.closeScene(), 1200);
  }

  private closeScene(): void {
    this.destroyConfirm();
    this.tweens.add({
      targets: this.children.getAll(),
      alpha: 0,
      duration: 180,
      onComplete: () => {
        this.scene.stop();
        if (this.mode === 'save') {
          this.scene.resume('WorldMapScene');
        } else {
          this.scene.start('TitleScene');
        }
      },
    });
  }
}
