import Phaser from 'phaser';
import type { CharacterType, Port, GameState, WorldMapSceneData } from '../types';
import portsData from '../data/ports';

const WORLD_W = 40960;
const WORLD_H = 20480;
const SHIP_SPEED = 280;
const PORT_RADIUS = 550;
const TOTAL_SPECIALTIES = 150;
const MINI_W = 200;
const MINI_H = 100;

function lonToX(lon: number): number {
  return (lon + 180) / 360 * WORLD_W;
}
function latToY(lat: number): number {
  return (90 - lat) / 180 * WORLD_H;
}

interface ContinentDef {
  id: string;
  nameKo: string;
  isStart: boolean;
  ports: string[];
  box: [number, number, number, number]; // [lonMin, latMax, lonMax, latMin]
}

const CONTINENT_DEFS: ContinentDef[] = [
  { id: 'east_asia',               nameKo: '동아시아',           isStart: true,  ports: ['seoul','tokyo','beijing','shanghai','hongkong'],                           box: [105,48,152,18] },
  { id: 'southeast_asia',          nameKo: '동남아시아',          isStart: false, ports: ['singapore','bangkok','jakarta','hanoi'],                                    box: [115,25,122,-14] },
  { id: 'south_asia',              nameKo: '남아시아',            isStart: false, ports: ['mumbai','kolkata','karachi'],                                               box: [58,35,98,2] },
  { id: 'middle_east',             nameKo: '중동',               isStart: false, ports: ['dubai','riyadh'],                                                           box: [33,38,62,8] },
  { id: 'western_europe',          nameKo: '서유럽',             isStart: false, ports: ['lisbon','madrid','paris','london','amsterdam','berlin','barcelona'],         box: [-18,58,20,33] },
  { id: 'northern_europe',         nameKo: '북유럽',             isStart: false, ports: ['oslo','stockholm','copenhagen'],                                             box: [-5,72,32,52] },
  { id: 'southern_europe',         nameKo: '남유럽·지중해',       isStart: false, ports: ['rome','venice','athens','istanbul'],                                         box: [4,50,38,32] },
  { id: 'eastern_europe',          nameKo: '동유럽·러시아',       isStart: false, ports: ['moscow'],                                                                   box: [18,68,52,46] },
  { id: 'north_africa',            nameKo: '북아프리카',          isStart: false, ports: ['cairo','casablanca','alexandria'],                                           box: [-20,40,38,18] },
  { id: 'west_africa',             nameKo: '서아프리카',          isStart: false, ports: ['lagos','dakar'],                                                            box: [-26,20,12,-2] },
  { id: 'east_africa',             nameKo: '동아프리카',          isStart: false, ports: ['zanzibar','nairobi'],                                                       box: [28,6,52,-14] },
  { id: 'southern_africa',         nameKo: '남아프리카',          isStart: false, ports: ['cape_town'],                                                               box: [8,-18,38,-42] },
  { id: 'north_america',           nameKo: '북아메리카',          isStart: false, ports: ['new_york','washington_dc','los_angeles','chicago'],                         box: [-130,54,-60,24] },
  { id: 'central_america',         nameKo: '중앙아메리카·카리브해', isStart: false, ports: ['havana','mexico_city'],                                                     box: [-120,30,-70,8] },
  { id: 'western_south_america',   nameKo: '남아메리카 서부',     isStart: false, ports: ['lima','santiago'],                                                          box: [-84,-3,-62,-42] },
  { id: 'eastern_south_america',   nameKo: '남아메리카 동부',     isStart: false, ports: ['rio_de_janeiro','buenos_aires'],                                            box: [-70,-3,-32,-40] },
  { id: 'oceania',                 nameKo: '오세아니아',          isStart: false, ports: ['sydney','melbourne','auckland'],                                             box: [136,-28,180,-48] },
];

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
  private posText!: Phaser.GameObjects.Text;
  private nearbyPort: Port | null = null;
  private miniMapStatic!: Phaser.GameObjects.Graphics;
  private miniMapDynamic!: Phaser.GameObjects.Graphics;
  private shipStartX = lonToX(129.0);
  private shipStartY = latToY(35.0);
  private landPolygons: number[][][] = [];
  private landBounds: number[][] = [];
  private gameStartTime = 0;
  private saveSlot: number | null = null;
  private discoveredContinents: Set<string> = new Set();
  private portToContinent: Map<string, string> = new Map();
  private fogGraphics: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private fogLabels: Map<string, Phaser.GameObjects.Text> = new Map();
  private pendingContinentReveal: string | null = null;
  private isOverviewOpen = false;
  private mapOverlayContainer: Phaser.GameObjects.Container | null = null;

  constructor() {
    super({ key: 'WorldMapScene' });
  }

  preload(): void {
    if (!this.cache.json.has('landPolygons')) {
      this.load.json('landPolygons', 'assets/land-polygons.json');
    }
  }

  init(data: WorldMapSceneData): void {
    this.character = data.character ?? 'jun';
    this.saveSlot = data.saveSlot ?? null;
    this.discoveredPorts = new Set();
    this.collectedSpecialties = new Set();
    this.discoveredContinents = new Set(['east_asia']);
    this.shipStartX = lonToX(129.0);
    this.shipStartY = latToY(35.0);
    this.buildPortContinentIndex();
    if (this.saveSlot !== null) {
      this.loadGameState(this.saveSlot);
    }
    this.gameStartTime = Date.now();
  }

  create(): void {
    this.buildPortContinentIndex();

    // Land polygons for collision
    const lpData = this.cache.json.get('landPolygons');
    if (lpData) {
      this.landPolygons = lpData.polygons as number[][][];
      this.landBounds = lpData.bounds as number[][];
    }

    // Vector map — always sharp at any zoom
    this.drawVectorMap();

    // Fog of war (depth 3 — above map, below port markers)
    this.createFog();

    // Port markers (depth 5 — visible through fog as navigation hints)
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
    this.createMiniMap();

    // Listen for scene resume (after PortScene / SaveSlotScene / LogbookScene closes)
    this.events.on('resume', this.onSceneResume, this);

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
    this.updateMiniMap();

    const lon = this.ship.x / WORLD_W * 360 - 180;
    const lat = 90 - this.ship.y / WORLD_H * 180;
    this.posText.setText(
      `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}  ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`
    );

    if (Phaser.Input.Keyboard.JustDown(this.keySpace) && this.nearbyPort) {
      this.discoverPort(this.nearbyPort);
    }
  }

  resumeFromOverlay(): void {
    this.scene.resume();
  }

  // ── Movement ──────────────────────────────────────────────────────────────

  private handleShipMovement(delta: number): void {
    if (this.isOverviewOpen) return;
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
        if (Math.abs(xi - xk) > WORLD_W / 2) continue;
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
      const dist = Phaser.Math.Distance.Between(
        this.ship.x, this.ship.y,
        lonToX(port.coords.lon), latToY(port.coords.lat),
      );
      if (dist < minDist) { minDist = dist; closest = port; }
    }

    if (closest !== this.nearbyPort) {
      this.nearbyPort = closest;
      if (closest) {
        const isVisited = this.discoveredPorts.has(closest.id);
        const hint = isVisited
          ? `📖 ${closest.nameKo} 다시보기 (Space)`
          : '⚓ Space 로 발견!';
        this.anchorHint
          .setPosition(lonToX(closest.coords.lon), latToY(closest.coords.lat) - 16)
          .setText(hint)
          .setVisible(true);
      } else {
        this.anchorHint.setVisible(false);
      }
    }
  }

  // ── Discovery ─────────────────────────────────────────────────────────────

  private discoverPort(port: Port): void {
    this.nearbyPort = null;
    this.anchorHint.setVisible(false);

    const isNew = !this.discoveredPorts.has(port.id);

    if (isNew) {
      this.discoveredPorts.add(port.id);

      port.specialties.forEach(s => {
        this.collectedSpecialties.add(`${port.id}:${s.icon}`);
      });

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
      this.cameras.main.flash(300, 255, 255, 100, false);

      // Fog reveal — check if this port belongs to an undiscovered continent
      const continentId = this.portToContinent.get(port.id) ?? '';
      if (continentId && !this.discoveredContinents.has(continentId)) {
        this.revealContinent(continentId);
      }

      if (this.collectedSpecialties.size >= TOTAL_SPECIALTIES) {
        setTimeout(() => {
          this.scene.start('VictoryScene', {
            character: this.character,
            totalTime: Date.now() - this.gameStartTime,
          });
        }, 600);
        return;
      }
    }

    this.scene.launch('PortScene', {
      port,
      character: this.character,
      collectedSpecialties: [...this.collectedSpecialties],
      isNewVisit: isNew,
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
      g.setDepth(5);
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

  private drawVectorMap(): void {
    const g = this.add.graphics();

    // Ocean background
    g.fillStyle(0x1a6b8a);
    g.fillRect(0, 0, WORLD_W, WORLD_H);

    // Grid lines (lon/lat every 30°)
    g.lineStyle(1, 0x1e7ba0, 0.25);
    for (let lon = -150; lon <= 150; lon += 30) {
      const x = (lon + 180) / 360 * WORLD_W;
      g.lineBetween(x, 0, x, WORLD_H);
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const y = (90 - lat) / 180 * WORLD_H;
      g.lineBetween(0, y, WORLD_W, y);
    }

    // Land polygons — split at antimeridian to avoid cross-map artifacts
    g.fillStyle(0x7ab648, 1);
    this.landPolygons.forEach(poly => {
      if (poly.length < 3) return;
      g.beginPath();
      g.moveTo(poly[0][0], poly[0][1]);
      for (let i = 1; i < poly.length; i++) {
        if (Math.abs(poly[i][0] - poly[i - 1][0]) > WORLD_W / 2) {
          g.closePath(); g.fillPath();
          g.beginPath(); g.moveTo(poly[i][0], poly[i][1]);
        } else {
          g.lineTo(poly[i][0], poly[i][1]);
        }
      }
      g.closePath();
      g.fillPath();
    });

    g.lineStyle(1, 0x5a8a32, 0.7);
    this.landPolygons.forEach(poly => {
      if (poly.length < 3) return;
      g.beginPath();
      g.moveTo(poly[0][0], poly[0][1]);
      for (let i = 1; i < poly.length; i++) {
        if (Math.abs(poly[i][0] - poly[i - 1][0]) > WORLD_W / 2) {
          g.closePath(); g.strokePath();
          g.beginPath(); g.moveTo(poly[i][0], poly[i][1]);
        } else {
          g.lineTo(poly[i][0], poly[i][1]);
        }
      }
      g.closePath();
      g.strokePath();
    });
  }

  // ── Mini-map ──────────────────────────────────────────────────────────────

  private createMiniMap(): void {
    const { width, height } = this.scale;
    const ox = width - MINI_W - 8;
    const oy = height - MINI_H - 8;

    // Static layer: rebuilt on each continent discovery via rebuildMiniMapStatic()
    this.miniMapStatic = this.add.graphics().setScrollFactor(0).setDepth(21);
    this.rebuildMiniMapStatic();

    // Label (depth 23, above static/dynamic)
    this.add.text(ox + 4, oy + 2, '미니맵', {
      fontSize: '9px', color: '#aaddff',
    }).setScrollFactor(0).setDepth(23);

    // Dynamic layer (ports + ship + viewport rect)
    this.miniMapDynamic = this.add.graphics().setScrollFactor(0).setDepth(22);

    // Transparent click area over minimap to open world overview
    const clickArea = this.add.rectangle(
      ox + MINI_W / 2, oy + MINI_H / 2, MINI_W, MINI_H, 0x000000, 0,
    ).setScrollFactor(0).setDepth(24).setInteractive({ useHandCursor: true });
    clickArea.on('pointerdown', () => this.toggleMapOverview());
  }

  private rebuildMiniMapStatic(): void {
    const { width, height } = this.scale;
    const ox = width - MINI_W - 8;
    const oy = height - MINI_H - 8;
    const sx = MINI_W / WORLD_W;
    const sy = MINI_H / WORLD_H;
    const g = this.miniMapStatic;
    g.clear();

    // Dark base — covers entire minimap (fog for all undiscovered areas)
    g.fillStyle(0x040a14, 1.0);
    g.fillRect(ox, oy, MINI_W, MINI_H);

    // For each discovered continent: reveal ocean + draw land polygons in its bounding box
    CONTINENT_DEFS.forEach(def => {
      if (!this.discoveredContinents.has(def.id)) return;
      const fx = ox + lonToX(def.box[0]) * sx;
      const fy = oy + latToY(def.box[1]) * sy;
      const fw = (lonToX(def.box[2]) - lonToX(def.box[0])) * sx;
      const fh = (latToY(def.box[3]) - latToY(def.box[1])) * sy;

      // Ocean reveal
      g.fillStyle(0x1a6b8a, 0.9);
      g.fillRect(fx, fy, fw, fh);

      // Land polygons filtered to this continent box
      const wx1 = lonToX(def.box[0]), wy1 = latToY(def.box[1]);
      const wx2 = lonToX(def.box[2]), wy2 = latToY(def.box[3]);
      g.fillStyle(0x5a8a32, 1);
      this.landPolygons.forEach((poly, i) => {
        if (poly.length < 3) return;
        const [bx1, by1, bx2, by2] = this.landBounds[i];
        if (bx1 > wx2 || bx2 < wx1 || by1 > wy2 || by2 < wy1) return;

        let pts: { x: number; y: number }[] = [];
        let prevMx = -999, prevMy = -999;

        const flush = () => {
          if (pts.length < 3) { pts = []; prevMx = -999; prevMy = -999; return; }
          g.beginPath();
          g.moveTo(pts[0].x, pts[0].y);
          for (let j = 1; j < pts.length; j++) g.lineTo(pts[j].x, pts[j].y);
          g.closePath();
          g.fillPath();
          pts = []; prevMx = -999; prevMy = -999;
        };

        for (let k = 0; k < poly.length; k++) {
          if (k > 0 && Math.abs(poly[k][0] - poly[k - 1][0]) > WORLD_W / 2) flush();
          const mx = ox + poly[k][0] * sx;
          const my = oy + poly[k][1] * sy;
          if (Math.abs(mx - prevMx) > 0.5 || Math.abs(my - prevMy) > 0.5) {
            pts.push({ x: mx, y: my });
            prevMx = mx; prevMy = my;
          }
        }
        flush();
      });
    });

    // Border
    g.lineStyle(1, 0xffffff, 0.6);
    g.strokeRect(ox, oy, MINI_W, MINI_H);
  }

  private updateMiniMap(): void {
    const { width, height } = this.scale;
    const ox = width - MINI_W - 8;
    const oy = height - MINI_H - 8;
    const sx = MINI_W / WORLD_W;
    const sy = MINI_H / WORLD_H;
    const g = this.miniMapDynamic;
    g.clear();

    // Camera viewport rect
    const cam = this.cameras.main;
    const vx = ox + cam.scrollX * sx;
    const vy = oy + cam.scrollY * sy;
    const vw = cam.width * sx;
    const vh = cam.height * sy;
    g.lineStyle(1, 0xffffff, 0.5);
    g.strokeRect(vx, vy, vw, vh);

    // Port dots (discovered continents only)
    for (const port of this.ports) {
      const contId = this.portToContinent.get(port.id);
      if (!contId || !this.discoveredContinents.has(contId)) continue;
      const mx = ox + lonToX(port.coords.lon) * sx;
      const my = oy + latToY(port.coords.lat) * sy;
      const found = this.discoveredPorts.has(port.id);
      g.fillStyle(found ? 0x44ff88 : 0xe8c870, 1);
      g.fillCircle(mx, my, found ? 2.5 : 2);
    }

    // Ship dot
    g.fillStyle(0xffffff, 1);
    g.fillCircle(ox + this.ship.x * sx, oy + this.ship.y * sy, 3);
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

    this.posText = this.add.text(510, 34, '', {
      fontSize: '13px', color: '#ccddff',
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(20);

    const saveBtn = this.add.text(width - 130, 32, '💾 저장', {
      fontSize: '16px',
      color: '#aaffcc',
      backgroundColor: 'rgba(30,90,50,0.7)',
      padding: { x: 10, y: 6 },
    }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(20).setInteractive({ useHandCursor: true });

    saveBtn.on('pointerover', () => saveBtn.setAlpha(0.8));
    saveBtn.on('pointerout', () => saveBtn.setAlpha(1));
    saveBtn.on('pointerdown', () => {
      this.scene.launch('SaveSlotScene', { mode: 'save', gameState: this.buildCurrentGameState() });
      this.scene.pause();
    });

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

  private loadGameState(slot: number): void {
    const saved = localStorage.getItem(`worldExplorer_slot_${slot}`);
    if (!saved) return;
    try {
      const state: GameState = JSON.parse(saved);
      this.discoveredPorts = new Set(state.discoveredPorts ?? []);
      this.collectedSpecialties = new Set(state.collectedSpecialties ?? []);
      if (state.playerLat != null && state.playerLon != null) {
        this.shipStartX = lonToX(state.playerLon);
        this.shipStartY = latToY(state.playerLat);
      }

      // Restore discovered continents (east_asia always included)
      const base = new Set<string>(['east_asia']);
      if (state.discoveredContinents && state.discoveredContinents.length > 0) {
        this.discoveredContinents = new Set([...base, ...state.discoveredContinents]);
      } else {
        // Migrate old saves: derive continents from discovered ports
        this.discoveredContinents = base;
        for (const portId of state.discoveredPorts ?? []) {
          const cid = this.portToContinent.get(portId);
          if (cid) this.discoveredContinents.add(cid);
        }
      }
    } catch {
      // ignore corrupt save
    }
  }

  private createFog(): void {
    for (const def of CONTINENT_DEFS) {
      if (this.discoveredContinents.has(def.id)) continue;

      const x = lonToX(def.box[0]);
      const y = latToY(def.box[1]);
      const w = lonToX(def.box[2]) - x;
      const h = latToY(def.box[3]) - y;

      const gfx = this.add.graphics();
      gfx.fillStyle(0x040a14, 0.82);
      gfx.fillRect(x, y, w, h);
      gfx.setDepth(3);
      this.fogGraphics.set(def.id, gfx);

      const rawSize = Math.round(Math.min(w, h) * 0.12);
      const fontSize = Math.max(rawSize, 80);
      const lbl = this.add.text(x + w / 2, y + h / 2, '???', {
        fontSize: `${fontSize}px`,
        color: '#8899aa',
        stroke: '#000000',
        strokeThickness: Math.round(fontSize * 0.07),
      }).setOrigin(0.5).setDepth(3);
      this.fogLabels.set(def.id, lbl);
    }
  }

  private revealContinent(continentId: string): void {
    const gfx = this.fogGraphics.get(continentId);
    if (!gfx) return; // already revealed or in progress (double-call guard)

    const lbl = this.fogLabels.get(continentId);
    // Remove from maps immediately so double-calls become no-ops
    this.fogGraphics.delete(continentId);
    this.fogLabels.delete(continentId);
    this.discoveredContinents.add(continentId);

    this.tweens.add({
      targets: [gfx, lbl].filter(Boolean),
      alpha: 0,
      duration: 1400,
      ease: 'Cubic.Out',
      onComplete: () => { gfx.destroy(); lbl?.destroy(); },
    });

    // Banner displayed after scene resumes (avoids mid-animation freeze during pause)
    this.pendingContinentReveal = continentId;
  }

  private onSceneResume(): void {
    if (this.pendingContinentReveal) {
      const id = this.pendingContinentReveal;
      this.pendingContinentReveal = null;
      const def = CONTINENT_DEFS.find(d => d.id === id);
      if (def) {
        this.showContinentBanner(def.nameKo);
        this.rebuildMiniMapStatic();
      }
    }
  }

  private showContinentBanner(nameKo: string): void {
    const { width } = this.scale;
    const banner = this.add.text(width / 2, 60, `🌍 새로운 대륙 발견!  ${nameKo}`, {
      fontSize: '22px', color: '#ffdd44', fontStyle: 'bold',
      backgroundColor: 'rgba(0,16,48,0.90)',
      padding: { x: 20, y: 10 },
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(30).setAlpha(0);

    this.tweens.chain({
      targets: banner,
      tweens: [
        { y: 84, alpha: 1, duration: 400, ease: 'Cubic.Out' },
        { alpha: 1, duration: 2500 },
        { alpha: 0, duration: 500, ease: 'Cubic.In', onComplete: () => banner.destroy() },
      ],
    });
  }

  private toggleMapOverview(): void {
    if (this.mapOverlayContainer) { this.hideMapOverview(); return; }
    this.showMapOverview();
  }

  private showMapOverview(): void {
    if (this.mapOverlayContainer) return;
    this.isOverviewOpen = true;

    const { width, height } = this.scale;
    const container = this.add.container(width / 2, height / 2);
    container.setScrollFactor(0).setDepth(40);
    this.mapOverlayContainer = container;

    const MX = -320, MY = -140, MW = 640, MH = 300;
    const sx = MW / WORLD_W;
    const sy = MH / WORLD_H;

    container.add(this.add.rectangle(0, 0, 720, 400, 0x0a1628, 0.96).setStrokeStyle(2, 0xffdd88));
    container.add(this.add.text(0, -180, '🗺 세계 탐험 현황', {
      fontSize: '20px', color: '#ffdd88', fontStyle: 'bold',
    }).setOrigin(0.5));

    const closeBtn = this.add.text(342, -182, '✕', {
      fontSize: '18px', color: '#fff',
      backgroundColor: 'rgba(180,40,40,0.7)',
      padding: { x: 7, y: 3 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.hideMapOverview());
    container.add(closeBtn);

    const mapGfx = this.add.graphics();

    // Step 1: entire map is dark (unknown)
    mapGfx.fillStyle(0x020408, 1);
    mapGfx.fillRect(MX, MY, MW, MH);

    // Step 2: reveal ocean for discovered continents only
    CONTINENT_DEFS.forEach(def => {
      if (!this.discoveredContinents.has(def.id)) return;
      const fx = MX + lonToX(def.box[0]) * sx;
      const fy = MY + latToY(def.box[1]) * sy;
      const fw = (lonToX(def.box[2]) - lonToX(def.box[0])) * sx;
      const fh = (latToY(def.box[3]) - latToY(def.box[1])) * sy;
      mapGfx.fillStyle(0x1a6b8a, 1);
      mapGfx.fillRect(fx, fy, fw, fh);
    });

    // Step 3: draw land polygons — only those whose bounding box intersects a discovered box
    const discoveredWorldBoxes = CONTINENT_DEFS
      .filter(d => this.discoveredContinents.has(d.id))
      .map(d => [lonToX(d.box[0]), latToY(d.box[1]), lonToX(d.box[2]), latToY(d.box[3])] as const);

    mapGfx.fillStyle(0x5a8a32, 1);
    this.landPolygons.forEach((poly, i) => {
      if (poly.length < 3) return;
      const [bx1, by1, bx2, by2] = this.landBounds[i];
      const inDiscovered = discoveredWorldBoxes.some(([dx1, dy1, dx2, dy2]) =>
        bx1 <= dx2 && bx2 >= dx1 && by1 <= dy2 && by2 >= dy1
      );
      if (!inDiscovered) return;

      let pts: { x: number; y: number }[] = [];
      let prevMx = -999, prevMy = -999;

      const flush = () => {
        if (pts.length < 3) { pts = []; prevMx = -999; prevMy = -999; return; }
        mapGfx.beginPath();
        mapGfx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) mapGfx.lineTo(pts[i].x, pts[i].y);
        mapGfx.closePath();
        mapGfx.fillPath();
        pts = []; prevMx = -999; prevMy = -999;
      };

      for (let k = 0; k < poly.length; k++) {
        if (k > 0 && Math.abs(poly[k][0] - poly[k - 1][0]) > WORLD_W / 2) flush();
        const mx = MX + poly[k][0] * sx;
        const my = MY + poly[k][1] * sy;
        if (Math.abs(mx - prevMx) > 0.5 || Math.abs(my - prevMy) > 0.5) {
          pts.push({ x: mx, y: my });
          prevMx = mx; prevMy = my;
        }
      }
      flush();
    });

    // Step 4: re-cover undiscovered areas (handles polygon bleed from adjacent continents)
    CONTINENT_DEFS.forEach(def => {
      if (this.discoveredContinents.has(def.id)) return;
      const fx = MX + lonToX(def.box[0]) * sx;
      const fy = MY + latToY(def.box[1]) * sy;
      const fw = (lonToX(def.box[2]) - lonToX(def.box[0])) * sx;
      const fh = (latToY(def.box[3]) - latToY(def.box[1])) * sy;
      mapGfx.fillStyle(0x020408, 1);
      mapGfx.fillRect(fx, fy, fw, fh);
    });

    container.add(mapGfx);

    // Continent labels (discovered only)
    CONTINENT_DEFS.forEach(def => {
      if (!this.discoveredContinents.has(def.id)) return;
      const lx = MX + (lonToX(def.box[0]) + lonToX(def.box[2])) / 2 * sx;
      const ly = MY + (latToY(def.box[1]) + latToY(def.box[3])) / 2 * sy;
      container.add(this.add.text(lx, ly, def.nameKo, {
        fontSize: '9px', color: '#ffdd88',
      }).setOrigin(0.5));
    });

    // Port dots (only for discovered continents)
    const portG = this.add.graphics();
    this.ports.forEach(p => {
      const contId = this.portToContinent.get(p.id);
      if (!contId || !this.discoveredContinents.has(contId)) return;
      const dx = MX + lonToX(p.coords.lon) * sx;
      const dy = MY + latToY(p.coords.lat) * sy;
      if (this.discoveredPorts.has(p.id)) {
        portG.fillStyle(0x44ff88, 1); portG.fillCircle(dx, dy, 3);
      } else {
        portG.fillStyle(0xe8c870, 1); portG.fillCircle(dx, dy, 2);
      }
    });
    container.add(portG);

    // Stats
    const nCont = this.discoveredContinents.size;
    container.add(this.add.text(0, 170,
      `발견: ${this.discoveredPorts.size} / 50 항구   ·   ${nCont} / 17 대륙`, {
        fontSize: '13px', color: '#aaddff',
      }).setOrigin(0.5));

    // ESC to close
    const onEsc = () => this.hideMapOverview();
    this.input.keyboard!.once('keydown-ESC', onEsc);
    container.setData('escHandler', onEsc);
  }

  private hideMapOverview(): void {
    if (!this.mapOverlayContainer) return;
    const onEsc = this.mapOverlayContainer.getData('escHandler');
    if (onEsc) this.input.keyboard!.off('keydown-ESC', onEsc);
    this.mapOverlayContainer.destroy();
    this.mapOverlayContainer = null;
    this.isOverviewOpen = false;
  }

  private buildPortContinentIndex(): void {
    for (const def of CONTINENT_DEFS) {
      for (const portId of def.ports) {
        this.portToContinent.set(portId, def.id);
      }
    }
  }

  private buildCurrentGameState(): GameState {
    const lon = (this.ship?.x ?? this.shipStartX) / WORLD_W * 360 - 180;
    const lat = 90 - (this.ship?.y ?? this.shipStartY) / WORLD_H * 180;
    return {
      character: this.character,
      discoveredPorts: [...this.discoveredPorts],
      collectedSpecialties: [...this.collectedSpecialties],
      isCompleted: this.collectedSpecialties.size >= TOTAL_SPECIALTIES,
      playerLat: lat,
      playerLon: lon,
      lastPlayed: new Date().toISOString(),
      discoveredContinents: [...this.discoveredContinents],
    };
  }
}
