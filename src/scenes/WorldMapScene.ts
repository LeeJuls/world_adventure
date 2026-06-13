import Phaser from 'phaser';
import type { CharacterType, Port, GameState, WorldMapSceneData } from '../types';
import portsData from '../data/ports';

const MAP_OFFSET_Y = 64;   // HUD height — map starts below this
const SHIP_SPEED = 160;    // px per second
const PORT_RADIUS = 55;    // proximity detection radius (px)

export class WorldMapScene extends Phaser.Scene {
  private ship!: Phaser.GameObjects.Container;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private keyA!: Phaser.Input.Keyboard.Key;
  private character: CharacterType = 'jun';
  private ports: Port[] = [];
  private discoveredPorts: Set<string> = new Set();
  private portMarkers: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private anchorHint!: Phaser.GameObjects.Text;
  private hudText!: Phaser.GameObjects.Text;
  private rankText!: Phaser.GameObjects.Text;
  private nearbyPort: Port | null = null;

  constructor() {
    super({ key: 'WorldMapScene' });
  }

  init(data: WorldMapSceneData): void {
    this.character = data.character ?? 'jun';
    this.loadGameState();
  }

  create(): void {
    const { width, height } = this.scale;

    // Ocean background
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a6b8a);

    // World map continents
    this.drawWorldMap();

    // Port markers
    this.ports = portsData.ports;
    this.drawPortMarkers();

    // Player ship
    this.createShip();

    // HUD
    this.createHUD();

    // Anchor hint (hidden by default)
    this.anchorHint = this.add.text(0, 0, '⚓ A 키로 발견!', {
      fontSize: '14px',
      color: '#ffdd88',
      backgroundColor: 'rgba(0,0,0,0.7)',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5, 1).setDepth(15).setVisible(false);

    // Input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.keyA = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);

    this.cameras.main.fadeIn(500);
  }

  update(_time: number, delta: number): void {
    this.handleShipMovement(delta);
    this.checkPortProximity();

    // A key to discover nearby port
    if (Phaser.Input.Keyboard.JustDown(this.keyA) && this.nearbyPort) {
      this.discoverPort(this.nearbyPort);
    }
  }

  // Called by PortScene/LogbookScene when they close
  resumeFromOverlay(): void {
    this.scene.resume();
  }

  private handleShipMovement(delta: number): void {
    const speed = SHIP_SPEED * (delta / 1000);
    const { width, height } = this.scale;
    let dx = 0, dy = 0;

    if (this.cursors.left.isDown || this.wasd.A.isDown) dx = -speed;
    else if (this.cursors.right.isDown || this.wasd.D.isDown) dx = speed;
    if (this.cursors.up.isDown || this.wasd.W.isDown) dy = -speed;
    else if (this.cursors.down.isDown || this.wasd.S.isDown) dy = speed;

    // Clamp within map bounds (below HUD)
    const nx = Phaser.Math.Clamp(this.ship.x + dx, 16, width - 16);
    const ny = Phaser.Math.Clamp(this.ship.y + dy, MAP_OFFSET_Y + 16, height - 16);
    this.ship.setPosition(nx, ny);

    // Rotate ship toward movement direction
    if (dx !== 0 || dy !== 0) {
      const angle = Math.atan2(dy, dx) - Math.PI / 2;
      this.ship.setRotation(angle);
    }
  }

  private checkPortProximity(): void {
    let closest: Port | null = null;
    let minDist = PORT_RADIUS;

    for (const port of this.ports) {
      if (this.discoveredPorts.has(port.id)) continue;
      const dist = Phaser.Math.Distance.Between(
        this.ship.x, this.ship.y,
        port.coords.x, port.coords.y + MAP_OFFSET_Y
      );
      if (dist < minDist) {
        minDist = dist;
        closest = port;
      }
    }

    if (closest !== this.nearbyPort) {
      this.nearbyPort = closest;
      if (closest) {
        this.anchorHint
          .setPosition(closest.coords.x, closest.coords.y + MAP_OFFSET_Y - 12)
          .setVisible(true);
      } else {
        this.anchorHint.setVisible(false);
      }
    }
  }

  private discoverPort(port: Port): void {
    if (this.discoveredPorts.has(port.id)) return;
    this.discoveredPorts.add(port.id);
    this.nearbyPort = null;
    this.anchorHint.setVisible(false);

    // Update port marker to discovered color
    const marker = this.portMarkers.get(port.id);
    if (marker) {
      marker.clear();
      marker.fillStyle(0x44ff88);
      marker.fillCircle(port.coords.x, port.coords.y + MAP_OFFSET_Y, 6);
      marker.fillStyle(0x22cc66, 0.4);
      marker.fillCircle(port.coords.x, port.coords.y + MAP_OFFSET_Y, 12);
    }

    this.updateHUD();
    this.saveGameState();

    // Discovery flash
    this.cameras.main.flash(300, 255, 255, 100, false);

    // Show port card
    this.scene.launch('PortScene', { port, character: this.character });
    this.scene.pause();
  }

  private drawWorldMap(): void {
    const g = this.add.graphics();
    const yo = MAP_OFFSET_Y;

    // Ocean grid lines (subtle)
    g.lineStyle(1, 0x1e7ba0, 0.2);
    for (let x = 0; x < 1024; x += 64) g.lineBetween(x, yo, x, 576);
    for (let y = yo; y < 576; y += 64) g.lineBetween(0, y, 1024, y);

    // Continents — simplified rectangles/polygons
    const drawLand = (color: number, alpha: number, shapes: number[][]) => {
      g.fillStyle(color, alpha);
      shapes.forEach(s => {
        if (s.length === 4) g.fillRect(s[0], s[1] + yo, s[2], s[3]);
      });
    };

    // Europe
    drawLand(0x6aad3a, 0.9, [
      [370, 195, 130, 90],
    ]);
    // Asia
    drawLand(0x7ab648, 0.9, [
      [500, 195, 310, 120],
    ]);
    // Africa
    drawLand(0x8ab830, 0.9, [
      [390, 270, 110, 165],
    ]);
    // Americas (N+S)
    drawLand(0x6aad3a, 0.9, [
      [150, 200, 130, 140],   // North America
      [235, 345, 85, 90],     // South America (upper)
      [250, 380, 70, 80],     // South America (lower)
    ]);
    // Oceania
    drawLand(0x7ab648, 0.9, [
      [775, 390, 110, 55],
    ]);
    // Middle East / Arabian Peninsula
    drawLand(0xc8b858, 0.85, [
      [530, 265, 90, 70],
    ]);

    // Coastline stroke
    g.lineStyle(2, 0x5a8a32, 0.6);
    [[370, 195, 130, 90], [500, 195, 310, 120], [390, 270, 110, 165],
     [150, 200, 130, 140], [235, 345, 85, 90], [775, 390, 110, 55]]
      .forEach(s => g.strokeRect(s[0], s[1] + yo, s[2], s[3]));
  }

  private drawPortMarkers(): void {
    this.ports.forEach(port => {
      const g = this.add.graphics();
      const discovered = this.discoveredPorts.has(port.id);
      const color = discovered ? 0x44ff88 : 0xe8c870;

      g.fillStyle(color);
      g.fillCircle(port.coords.x, port.coords.y + MAP_OFFSET_Y, 5);

      if (discovered) {
        g.fillStyle(0x22cc66, 0.4);
        g.fillCircle(port.coords.x, port.coords.y + MAP_OFFSET_Y, 11);
      }

      this.portMarkers.set(port.id, g);
    });
  }

  private createShip(): void {
    const g = this.add.graphics();
    const color = this.character === 'jun' ? 0x2389a8 : 0xb83030;

    // Hull
    g.fillStyle(0x2d1b00);
    g.fillRect(-8, 2, 16, 10);
    // Sail
    g.fillStyle(color, 0.9);
    g.fillTriangle(0, -14, -7, 4, 7, 4);
    // Mast
    g.fillStyle(0x8b6914);
    g.fillRect(-1, -14, 2, 18);

    this.ship = this.add.container(512, 320, [g]).setDepth(10);
  }

  private createHUD(): void {
    const { width } = this.scale;

    // HUD background
    this.add.rectangle(width / 2, 32, width, 64, 0x0a1628, 0.9).setDepth(19);

    // Game title
    this.add.text(16, 10, '🌍 세계 탐험', {
      fontSize: '20px', color: '#ffdd88', fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(20);

    // Discovery counter
    this.hudText = this.add.text(16, 34, '발견: 0 / 50', {
      fontSize: '16px', color: '#aaddff',
    }).setScrollFactor(0).setDepth(20);

    // Rank text
    this.rankText = this.add.text(220, 34, '🚢 견습 선원', {
      fontSize: '14px', color: '#88cc88',
    }).setScrollFactor(0).setDepth(20);

    // Logbook button
    const logBtn = this.add.text(width - 16, 32, '📖 기록장', {
      fontSize: '18px',
      color: '#ffdd88',
      backgroundColor: 'rgba(35,137,168,0.6)',
      padding: { x: 12, y: 6 },
    }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(20).setInteractive({ useHandCursor: true });

    logBtn.on('pointerover', () => logBtn.setAlpha(0.8));
    logBtn.on('pointerout', () => logBtn.setAlpha(1));
    logBtn.on('pointerdown', () => {
      this.scene.launch('LogbookScene', {
        discoveredPorts: [...this.discoveredPorts],
        character: this.character,
      });
      this.scene.pause();
    });

    this.updateHUD();
  }

  private updateHUD(): void {
    const count = this.discoveredPorts.size;
    this.hudText.setText(`발견: ${count} / 50`);
    this.rankText.setText(this.getRank(count));
  }

  private getRank(count: number): string {
    if (count >= 31) return '🌍 세계 일주 달인';
    if (count >= 16) return '🗺️ 항해사';
    if (count >= 6) return '⚓ 탐험가';
    return '🚢 견습 선원';
  }

  private loadGameState(): void {
    const saved = localStorage.getItem('worldExplorerState');
    if (saved) {
      try {
        const state: GameState = JSON.parse(saved);
        if (state.character === this.character) {
          this.discoveredPorts = new Set(state.discoveredPorts);
        }
      } catch {
        // ignore corrupt save
      }
    }
  }

  private saveGameState(): void {
    const state: GameState = {
      character: this.character,
      discoveredPorts: [...this.discoveredPorts],
      playerX: this.ship?.x ?? 512,
      playerY: this.ship?.y ?? 320,
      lastPlayed: new Date().toISOString(),
    };
    localStorage.setItem('worldExplorerState', JSON.stringify(state));
  }
}
