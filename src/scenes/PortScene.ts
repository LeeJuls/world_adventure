import Phaser from 'phaser';
import type { Port, PortSceneData, CharacterType } from '../types';
import type { WorldMapScene } from './WorldMapScene';
import portsData from '../data/ports';

const COUNTRY_CODES: Record<string, string> = {
  'South Korea': 'kr', 'Japan': 'jp', 'China': 'cn',
  'Hong Kong': 'hk', 'Singapore': 'sg', 'Thailand': 'th',
  'India': 'in', 'Indonesia': 'id', 'Vietnam': 'vn',
  'Pakistan': 'pk', 'Portugal': 'pt', 'Spain': 'es',
  'France': 'fr', 'United Kingdom': 'gb', 'Netherlands': 'nl',
  'Germany': 'de', 'Italy': 'it', 'Greece': 'gr',
  'Turkey': 'tr', 'Norway': 'no', 'Sweden': 'se',
  'Denmark': 'dk', 'Russia': 'ru', 'Egypt': 'eg',
  'Morocco': 'ma', 'Nigeria': 'ng', 'South Africa': 'za',
  'Tanzania': 'tz', 'Kenya': 'ke', 'Senegal': 'sn',
  'United States': 'us', 'Brazil': 'br', 'Argentina': 'ar',
  'Cuba': 'cu', 'Mexico': 'mx', 'Peru': 'pe',
  'Chile': 'cl', 'Australia': 'au', 'New Zealand': 'nz',
  'United Arab Emirates': 'ae', 'Saudi Arabia': 'sa',
};

interface QuizQuestion {
  descKo: string;
  correctAnswer: string;
  options: string[];
}

export class PortScene extends Phaser.Scene {
  private port!: Port;
  private character!: CharacterType;
  private collectedSpecialties: Set<string> = new Set();
  private isNewVisit = false;
  private cardContainer!: Phaser.GameObjects.Container;
  private readonly cardW = 832;
  private readonly cardH = 530;

  constructor() {
    super({ key: 'PortScene' });
  }

  init(data: PortSceneData): void {
    this.port = data.port;
    this.character = data.character;
    this.collectedSpecialties = new Set(data.collectedSpecialties ?? []);
    this.isNewVisit = data.isNewVisit ?? false;
  }

  preload(): void {
    const cc = COUNTRY_CODES[this.port.countryEn];
    if (cc) {
      const key = `flag-${cc}`;
      if (!this.textures.exists(key)) {
        this.load.image(key, `https://flagcdn.com/w80/${cc}.png`);
      }
    }
  }

  create(): void {
    const { width, height } = this.scale;
    const { cardW, cardH } = this;
    const cx = width / 2, cy = height / 2;

    this.add.rectangle(cx, cy, width, height, 0x000000, 0.75).setInteractive();

    this.cardContainer = this.add.container(cx, cy);

    const cardBg = this.add.rectangle(0, 0, cardW, cardH, 0x1a0d00, 0.97)
      .setStrokeStyle(3, 0xffdd88);

    const regionColors: Record<string, number> = {
      asia: 0x8b0000, europe: 0x1a3a7a, africa: 0x8b6000,
      americas: 0x006b35, oceania: 0x006b8b, middleeast: 0x8b6b00,
    };
    const band = this.add.rectangle(0, -cardH / 2 + 36, cardW, 72,
      regionColors[this.port.region] ?? 0x2d1b00, 0.9);

    const cityKo = this.add.text(0, -cardH / 2 + 22, this.port.nameKo, {
      fontSize: '38px', color: '#ffdd88', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);

    const cityEn = this.add.text(0, -cardH / 2 + 58,
      `${this.port.nameEn}  ·  ${this.port.countryKo}`, {
        fontSize: '16px', color: '#aaddff',
      }).setOrigin(0.5);

    const cc = COUNTRY_CODES[this.port.countryEn];
    const flagKey = cc ? `flag-${cc}` : '';
    const flagImg = (flagKey && this.textures.exists(flagKey))
      ? this.add.image(-cardW / 2 + 46, -cardH / 2 + 36, flagKey).setDisplaySize(60, 40)
      : null;

    const closeBtn = this.add.text(cardW / 2 - 18, -cardH / 2 + 18, '✕', {
      fontSize: '22px', color: '#ffffff',
      backgroundColor: 'rgba(180,40,40,0.7)',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.closeScene());
    closeBtn.on('pointerover', () => closeBtn.setStyle({ backgroundColor: 'rgba(220,60,60,0.9)' }));
    closeBtn.on('pointerout', () => closeBtn.setStyle({ backgroundColor: 'rgba(180,40,40,0.7)' }));

    const headerItems: Phaser.GameObjects.GameObject[] = [cardBg, band, cityKo, cityEn, closeBtn];
    if (flagImg) headerItems.push(flagImg);
    this.cardContainer.add(headerItems);

    this.cardContainer.setScale(0.85, 0);
    this.tweens.add({
      targets: this.cardContainer,
      scaleX: 1, scaleY: 1,
      duration: 280,
      ease: 'Back.Out',
    });

    this.input.keyboard!.once('keydown-ESC', () => this.closeScene());

    if (this.isNewVisit) {
      this.createQuizPhase();
    } else {
      this.createInfoPhase();
    }
  }

  // ── Quiz ──────────────────────────────────────────────────────────────────

  private generateQuiz(): QuizQuestion {
    const target = this.port.specialties[0];
    const correct = target.nameKo;

    const pool: string[] = [];
    for (const p of portsData.ports) {
      if (p.id === this.port.id) continue;
      for (const s of p.specialties) {
        if (s.nameKo !== correct && !pool.includes(s.nameKo)) {
          pool.push(s.nameKo);
        }
      }
    }

    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    const opts = [correct, ...pool.slice(0, 3)];
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }

    return { descKo: target.descKo, correctAnswer: correct, options: opts };
  }

  private createQuizPhase(): void {
    const { cardW, cardH } = this;
    const quiz = this.generateQuiz();
    const objs: Phaser.GameObjects.GameObject[] = [];

    const title = this.add.text(0, -cardH / 2 + 94, '🎯 특산품 퀴즈!', {
      fontSize: '20px', color: '#ffdd88', fontStyle: 'bold',
    }).setOrigin(0.5);

    const hintBg = this.add.rectangle(0, -cardH / 2 + 172, cardW - 50, 88,
      0xffffff, 0.06).setStrokeStyle(1, 0x8899ff, 0.5);

    const hintText = this.add.text(0, -cardH / 2 + 172, quiz.descKo, {
      fontSize: '14px', color: '#ddddff',
      wordWrap: { width: cardW - 80 },
      align: 'center',
    }).setOrigin(0.5);

    const question = this.add.text(0, -cardH / 2 + 242, '이것은 무엇일까요?', {
      fontSize: '16px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);

    objs.push(title, hintBg, hintText, question);

    const buttons: Phaser.GameObjects.Text[] = [];

    quiz.options.forEach((opt, i) => {
      const by = -cardH / 2 + 284 + i * 50;
      const btn = this.add.text(0, by, opt, {
        fontSize: '15px', color: '#ffffff',
        backgroundColor: 'rgba(35,100,168,0.65)',
        padding: { x: 20, y: 8 },
        fixedWidth: 440,
        align: 'center',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      btn.setData('opt', opt);
      btn.on('pointerover', () => {
        if (!btn.getData('locked')) btn.setStyle({ backgroundColor: 'rgba(60,150,220,0.85)' });
      });
      btn.on('pointerout', () => {
        if (!btn.getData('locked')) btn.setStyle({ backgroundColor: 'rgba(35,100,168,0.65)' });
      });
      btn.on('pointerdown', () => this.handleAnswer(btn, opt, quiz.correctAnswer, buttons, objs));

      buttons.push(btn);
      objs.push(btn);
    });

    const charColor = this.character === 'jun' ? '#aaddff' : '#ffaaaa';
    const charHint = this.character === 'jun'
      ? '"이 특산품의 이름이 뭘까? 잘 생각해봐!"'
      : '"설명을 잘 읽으면 답을 찾을 수 있어!"';
    const speech = this.add.text(0, cardH / 2 - 18, charHint, {
      fontSize: '13px', color: charColor, fontStyle: 'italic',
    }).setOrigin(0.5);
    objs.push(speech);

    this.cardContainer.add(objs);
  }

  private handleAnswer(
    clicked: Phaser.GameObjects.Text,
    chosen: string,
    correct: string,
    buttons: Phaser.GameObjects.Text[],
    quizObjs: Phaser.GameObjects.GameObject[],
  ): void {
    buttons.forEach(b => { b.setData('locked', true); b.disableInteractive(); });

    const isCorrect = chosen === correct;

    // First-visit correct answer → progress quiz quests (reverse call into the paused WorldMapScene).
    if (this.isNewVisit && isCorrect) {
      (this.scene.get('WorldMapScene') as WorldMapScene).recordQuizPass(this.port.id, true);
    }

    buttons.forEach(b => {
      if (b.getData('opt') === correct) {
        b.setStyle({ backgroundColor: 'rgba(30,160,80,0.9)' });
      } else if (b === clicked && !isCorrect) {
        b.setStyle({ backgroundColor: 'rgba(180,40,40,0.9)' });
      }
    });

    const msg = isCorrect ? '🎉 정답이에요!' : `정답은 "${correct}"이에요!`;
    const fb = this.add.text(0, 0, msg, {
      fontSize: '20px', color: isCorrect ? '#44ff88' : '#ffcc44',
      fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
      backgroundColor: 'rgba(0,0,0,0.82)',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5);
    this.cardContainer.add(fb);

    setTimeout(() => {
      quizObjs.forEach(o => o.destroy());
      fb.destroy();
      this.createInfoPhase();
    }, isCorrect ? 800 : 1500);
  }

  // ── Info card ─────────────────────────────────────────────────────────────

  private createInfoPhase(): void {
    const port = this.port;
    const { cardW, cardH } = this;

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

    const spLabelText = this.isNewVisit ? '✨ 특산품 발견!' : '✨ 특산품';
    const spLabel = this.add.text(-cardW / 2 + 20, -cardH / 2 + 185, spLabelText, {
      fontSize: '14px', color: '#ffdd88', fontStyle: 'bold',
    });

    const spCellW = (cardW - 40) / 3;
    const spItems = port.specialties.flatMap((s, i) => {
      const sx = -cardW / 2 + 20 + i * spCellW;
      const sy = -cardH / 2 + 207;
      const strokeColor = this.isNewVisit ? 0x44ff88 : 0x888888;

      const box = this.add.rectangle(sx + spCellW / 2, sy + 50, spCellW - 8, 100,
        0xffffff, 0.07).setStrokeStyle(1, strokeColor, 0.6);

      const badgeText = this.isNewVisit ? '✨ NEW!' : '✓ 수집완료';
      const badgeColor = this.isNewVisit ? '#44ff88' : '#88ff88';
      const badge = this.add.text(sx + spCellW - 6, sy + 4, badgeText, {
        fontSize: '12px', color: badgeColor,
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

    const charColor = this.character === 'jun' ? '#aaddff' : '#ffaaaa';
    const charMsg = this.character === 'jun'
      ? `"드디어 찾았다! 여기가 바로 ${port.nameKo}이구나!"`
      : `"여기가 ${port.nameKo}이구나. 노트에 기록해야겠어!"`;
    const speech = this.add.text(0, cardH / 2 - 14, charMsg, {
      fontSize: '14px', color: charColor, fontStyle: 'italic',
    }).setOrigin(0.5);

    this.cardContainer.add([
      lmLabel, lmName, lmDesc,
      spLabel, ...spItems,
      factBg, factLabel, fact,
      speech,
    ]);
  }

  // ── Close ─────────────────────────────────────────────────────────────────

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
