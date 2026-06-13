import Phaser from 'phaser';
import type { CharacterType, Port, GameState, WorldMapSceneData } from '../types';
import portsData from '../data/ports';

const WORLD_W = 40960;
const WORLD_H = 20480;
const SHIP_SPEED = 280;
const PORT_RADIUS = 550;
const TOTAL_SPECIALTIES = 150;

function lonToX(lon: number): number {
  return (lon + 180) / 360 * WORLD_W;
}
function latToY(lat: number): number {
  return (90 - lat) / 180 * WORLD_H;
}

export class WorldMapScene extends Phaser.Scene {
  private ship!: Phaser.GameObjects.Container;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private keySpace!: Phaser.Input.Keyboard.Key;
  private character: CharacterType = 'jun';
  private ports: Port[] = [];
  private discoveredPorts: Set<string> = new Set();
  private collectedSpecialties: Set<string> = new Set();
  private portMarkers: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private anchorHint!: Phaser.GameObjects.Text;
  private hudText!: Phaser.GameObjects.Text;
  private specialtyText!: Phaser.GameObjects.Text;
  private rankText!: Phaser.GameObjects.Text;
  private nearbyPort: Port | null = null;
  private shipStartX = lonToX(129.0);
  private shipStartY = latToY(35.0);
  private landPolygons: number[][][] = [];
  private landBounds: number[][] = [];
  private gameStartTime = 0;

  constructor() {
    super({ key: 'WorldMapScene' });
  }

  preload(): void {
    if (!this.textures.exists('worldmap')) {
      this.load.image('worldmap', 'assets/world-map.svg');
    }
    if (!this.cache.json.has('landPolygons')) {
      this.load.json('landPolygons', 'assets/land-polygons.json');
    }
  }

  init(data: WorldMapSceneData): void {
    this.character = data.character ?? 'jun';
    this.loadGameState();
    this.gameStartTime = Date.now();
  }

  create(): void {
    // Land polygons for collision
    const lpData = this.cache.json.get('landPolygons');
    if (lpData) {
      this.landPolygons = lpData.polygons as number[][][];
      this.landBounds = lpData.bounds as number[][];
    }

    // World map image
    const mapImg = this.textures.exists('worldmap')
      ? this.add.image(WORLD_W / 2, WORLD_H / 2, 'worldmap')
      : null;
    if (mapImg) mapImg.setDisplaySize(WORLD_W, WORLD_H);
    else this.drawFallbackMap();

    // Port markers
    this.ports = portsData.ports;
    this.drawPortMarkers();

    // Player ship
    this.createShip();

    // Camera: follow ship within world bounds
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(this.ship, true, 0.08, 0.08);
    this.cameras.main.fadeIn(500);

    // HUD (fixed to camera — all elements use setScrollFactor(0))
    this.createHUD();

    // Anchor hint (world-space object above nearby port)
    this.anchorHint = this.add.text(0, 0, '⚓ Space 로 발견!', {
      fontSize: '14px',
      color: '#ffdd88',
      backgroundColor: 'rgba(0,0,0,0.75)',
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
    this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  }

  update(_time: number, delta: number): void {
    this.handleShipMovement(delta);
    this.checkPortProximity();

    if (Phaser.Input.Keyboard.JustDown(this.keySpace) && this.nearbyPort) {
      this.discoverPort(this.nearbyPort);
    }
  }

  resumeFromOverlay(): void {
    this.scene.resume();
  }

  // ── Movement ──────────────────────────────────────────────────────────────

  private handleShipMovement(delta: number): void {
    const speed = SHIP_SPEED * (delta / 1000);
    let dx = 0, dy = 0;

    if (this.cursors.left.isDown || this.wasd.A.isDown) dx = -speed;
    else if (this.cursors.right.isDown || this.wasd.D.isDown) dx = speed;
    if (this.cursors.up.isDown || this.wasd.W.isDown) dy = -speed;
    else if (this.cursors.down.isDown || this.wasd.S.isDown) dy = speed;

    if (dx === 0 && dy === 0) return;

    const newX = Phaser.Math.Clamp(this.ship.x + dx, 16, WORLD_W - 16);
    const newY = Phaser.Math.Clamp(this.ship.y + dy, 16, WORLD_H - 16);

    if (!this.isOnLand(newX, newY)) {
      this.ship.setPosition(newX, newY);
    } else if (!this.isOnLand(newX, this.ship.y)) {
      this.ship.setPosition(newX, this.ship.y);
    } else if (!this.isOnLand(this.ship.x, newY)) {
      this.ship.setPosition(this.ship.x, newY);
    }

    this.ship.setRotation(Math.atan2(dy, dx) - Math.PI / 2);
  }

  private isOnLand(px: number, py: number): boolean {
    for (let i = 0; i < this.landBounds.length; i++) {
      const [minX, minY, maxX, maxY] = this.landBounds[i];
      if (px < minX || px > maxX || py < minY || py > maxY) continue;
      const poly = this.landPolygons[i];
      let inside = false;
      for (let j = 0, k = poly.length - 1; j < poly.length; k = j++) {
        const xi = poly[j][0], yi = poly[j][1];
        const xk = poly[k][0], yk = poly[k][1];
        if ((yi > py) !== (yk > py) &&
            px < ((xk - xi) * (py - yi)) / (yk - yi) + xi) {
          inside = !inside;
        }
      }
      if (inside) return true;
    }
    return false;
  }

  // ── Port proximity ────────────────────────────────────────────────────────

  private checkPortProximity(): void {
    let closest: Port | null = null;
    let minDist = PORT_RADIUS;

    for (const port of this.ports) {
      if (this.discoveredPorts.has(port.id)) continue;
      const dist = Phaser.Math.Distance.Between(
        this.ship.x, this.ship.y,
        lonToX(port.coords.lon), latToY(port.coords.lat),
      );
      if (dist < minDist) { minDist = dist; closest = port; }
    }

    if (closest !== this.nearbyPort) {
      this.nearbyPort = closest;
      if (closest) {
        this.anchorHint
          .setPosition(lonToX(closest.coords.lon), latToY(closest.coords.lat) - 16)
          .setVisible(true);
      } else {
        this.anchorHint.setVisible(false);
      }
    }
  }

  // ── Discovery ─────────────────────────────────────────────────────────────

  private discoverPort(port: Port): void {
    if (this.discoveredPorts.has(port.id)) return;
    this.discoveredPorts.add(port.id);
    this.nearbyPort = null;
    this.anchorHint.setVisible(false);

    // Collect specialties
    port.specialties.forEach(s => {
      this.collectedSpecialties.add(`${port.id}:${s.icon}`);
    });

    // Update marker to discovered style
    const g = this.portMarkers.get(port.id);
    if (g) {
      const px = lonToX(port.coords.lon);
      const py = latToY(port.coords.lat);
      g.clear();
      g.fillStyle(0x44ff88);
      g.fillCircle(px, py, 7);
      g.fillStyle(0x22cc66, 0.4);
      g.fillCircle(px, py, 14);
    }

    this.updateHUD();
    this.saveGameState();
    this.cameras.main.flash(300, 255, 255, 100, false);

    // Victory: all specialties collected
    if (this.collectedSpecialties.size >= TOTAL_SPECIALTIES) {
      setTimeout(() => {
        this.scene.start('VictoryScene', {
          character: this.character,
          totalTime: Date.now() - this.gameStartTime,
        });
      }, 600);
      return;
    }

    this.scene.launch('PortScene', {
      port,
      character: this.character,
      collectedSpecialties: [...this.collectedSpecialties],
    });
    this.scene.pause();
  }

  // ── Drawing ───────────────────────────────────────────────────────────────

  private drawPortMarkers(): void {
    this.ports.forEach(port => {
      const g = this.add.graphics();
      const px = lonToX(port.coords.lon);
      const py = latToY(port.coords.lat);
      const discovered = this.discoveredPorts.has(port.id);

      g.fillStyle(discovered ? 0x44ff88 : 0xe8c870);
      g.fillCircle(px, py, discovered ? 7 : 5);
      if (discovered) {
        g.fillStyle(0x22cc66, 0.4);
        g.fillCircle(px, py, 14);
      }
      this.portMarkers.set(port.id, g);
    });
  }

  private createShip(): void {
    const g = this.add.graphics();
    const color = this.character === 'jun' ? 0x2389a8 : 0xb83030;

    g.fillStyle(0x2d1b00);
    g.fillRect(-8, 2, 16, 10);
    g.fillStyle(color, 0.9);
    g.fillTriangle(0, -14, -7, 4, 7, 4);
    g.fillStyle(0x8b6914);
    g.fillRect(-1, -14, 2, 18);

    this.ship = this.add.container(this.shipStartX, this.shipStartY, [g]).setDepth(10);
  }

  // Fallback: draw simple continent shapes if SVG didn't load
  private drawFallbackMap(): void {
    const g = this.add.graphics();
    // Ocean
    g.fillStyle(0x1a6b8a);
    g.fillRect(0, 0, WORLD_W, WORLD_H);

    // Grid lines
    g.lineStyle(1, 0x1e7ba0, 0.2);
    for (let x = 0; x <= WORLD_W; x += 256) g.lineBetween(x, 0, x, WORLD_H);
    for (let y = 0; y <= WORLD_H; y += 256) g.lineBetween(0, y, WORLD_W, y);

    // Simple continent blocks (scaled up ×4 from original)
    const land = (x: number, y: number, w: number, h: number) => {
      g.fillStyle(0x7ab648, 0.9);
      g.fillRect(x, y, w, h);
    };
    land(1480, 780, 520, 360);   // Europe
    land(2000, 780, 1240, 480);  // Asia
    land(1560, 1080, 440, 660);  // Africa
    land(600, 800, 520, 560);    // North America
    land(940, 1380, 340, 360);   // South America
    land(3100, 1560, 440, 220);  // Oceania
    land(2120, 1060, 360, 280);  // Middle East
  }

  // ── HUD ───────────────────────────────────────────────────────────────────

  private createHUD(): void {
    const { width } = this.scale;

    this.add.rectangle(width / 2, 32, width, 64, 0x0a1628, 0.92)
      .setScrollFactor(0).setDepth(19);

    this.add.text(16, 10, '🌍 세계 탐험', {
      fontSize: '20px', color: '#ffdd88', fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(20);

    this.hudText = this.add.text(16, 34, '발견: 0 / 50 항구', {
      fontSize: '14px', color: '#aaddff',
    }).setScrollFactor(0).setDepth(20);

    this.specialtyText = this.add.text(190, 34, '특산품: 0 / 150', {
      fontSize: '14px', color: '#ffcc88',
    }).setScrollFactor(0).setDepth(20);

    this.rankText = this.add.text(360, 34, '🚢 견습 선원', {
      fontSize: '13px', color: '#88cc88',
    }).setScrollFactor(0).setDepth(20);

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
        collectedSpecialties: [...this.collectedSpecialties],
        character: this.character,
      });
      this.scene.pause();
    });

    this.updateHUD();
  }

  private updateHUD(): void {
    const portCount = this.discoveredPorts.size;
    const spCount = this.collectedSpecialties.size;
    this.hudText.setText(`발견: ${portCount} / 50 항구`);
    this.specialtyText.setText(`특산품: ${spCount} / 150`);
    this.rankText.setText(this.getRank(portCount));
  }

  private getRank(count: number): string {
    if (count >= 31) return '🌍 세계 일주 달인';
    if (count >= 16) return '🗺️ 항해사';
    if (count >= 6) return '⚓ 탐험가';
    return '🚢 견습 선원';
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  private loadGameState(): void {
    const saved = localStorage.getItem('worldExplorerState');
    if (!saved) return;
    try {
      const state: GameState = JSON.parse(saved);
      if (state.character === this.character) {
        this.discoveredPorts = new Set(state.discoveredPorts ?? []);
        this.collectedSpecialties = new Set(state.collectedSpecialties ?? []);
        if (state.playerLat != null && state.playerLon != null) {
          this.shipStartX = lonToX(state.playerLon);
          this.shipStartY = latToY(state.playerLat);
        }
      }
    } catch {
      // ignore corrupt save
    }
  }

  private saveGameState(): void {
    const lon = (this.ship?.x ?? this.shipStartX) / WORLD_W * 360 - 180;
    const lat = 90 - (this.ship?.y ?? this.shipStartY) / WORLD_H * 180;
    const state: GameState = {
      character: this.character,
      discoveredPorts: [...this.discoveredPorts],
      collectedSpecialties: [...this.collectedSpecialties],
      isCompleted: this.collectedSpecialties.size >= TOTAL_SPECIALTIES,
      playerLat: lat,
      playerLon: lon,
      lastPlayed: new Date().toISOString(),
    };
    localStorage.setItem('worldExplorerState', JSON.stringify(state));
  }
}
