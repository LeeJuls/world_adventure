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

// Fog of war (classic, ship-centred reveal). 256 divides both world dims exactly → no overflow.
const FOG_CELL = 256;
const FOG_COLS = WORLD_W / FOG_CELL; // 160
const FOG_ROWS = WORLD_H / FOG_CELL; // 80
const REVEAL_RADIUS = 900;           // world units cleared around the ship as it sails
const FOG_COLOR = 0x040a14;          // opaque dark — hides unexplored map + port markers

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
  { id: 'east_asia',               nameKo: '동아시아',           isStart: true,  ports: ['seoul','tokyo','beijing','shanghai','hongkong'],                           box: [113,48,152,18] },
  { id: 'southeast_asia',          nameKo: '동남아시아',          isStart: false, ports: ['singapore','bangkok','jakarta','hanoi'],                                    box: [96,25,113,-14] },
  { id: 'south_asia',              nameKo: '남아시아',            isStart: false, ports: ['mumbai','kolkata','karachi'],                                               box: [58,35,98,2] },
  { id: 'middle_east',             nameKo: '중동',               isStart: false, ports: ['dubai','riyadh'],                                                           box: [33,38,62,8] },
  { id: 'western_europe',          nameKo: '서유럽',             isStart: false, ports: ['lisbon','madrid','paris','london','amsterdam','berlin','barcelona'],         box: [-18,58,20,33] },
  { id: 'northern_europe',         nameKo: '북유럽',             isStart: false, ports: ['oslo','stockholm','copenhagen'],                                             box: [-5,72,32,52] },
  { id: 'southern_europe',         nameKo: '남유럽·지중해',       isStart: false, ports: ['rome','venice','athens','istanbul'],                                         box: [4,50,38,32] },
  { id: 'eastern_europe',          nameKo: '동유럽·러시아',       isStart: false, ports: ['moscow'],                                                                   box: [18,68,52,46] },
  { id: 'north_africa',            nameKo: '북아프리카',          isStart: false, ports: ['cairo','casablanca','alexandria'],                                           box: [-20,40,38,18] },
  { id: 'west_africa',             nameKo: '서아프리카',          isStart: false, ports: ['lagos','dakar'],                                                            box: [-26,20,12,-2] },
  { id: 'east_africa',             nameKo: '동아프리카',          isStart: false, ports: ['zanzibar','nairobi'],                                                       box: [12,12,52,-14] },
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
  private miniMapBase!: Phaser.GameObjects.Graphics;
  private miniMapFog!: Phaser.GameObjects.Graphics;
  private miniMapDynamic!: Phaser.GameObjects.Graphics;
  private shipStartX = lonToX(125.8);
  private shipStartY = latToY(37.4);
  private landPolygons: number[][][] = [];
  private landBounds: number[][] = [];
  private gameStartTime = 0;
  private saveSlot: number | null = null;
  private discoveredContinents: Set<string> = new Set();
  private portToContinent: Map<string, string> = new Map();
  private revealed: Uint8Array = new Uint8Array(FOG_COLS * FOG_ROWS); // 1 = explored
  private fogDirty = true;
  private worldFog!: Phaser.GameObjects.Graphics; // depth 6 — over map+ports, under ship
  private revealable: Uint8Array = new Uint8Array(FOG_COLS * FOG_ROWS); // cells that CAN be explored
  private totalRevealable = 0; // denominator for the exploration % (computed once in initFog)
  private pendingContinentReveal: string | null = null;
  private isOverviewOpen = false;
  private mapOverlayObjects: Phaser.GameObjects.GameObject[] = [];
  private _overviewEscHandler: (() => void) | null = null;

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
    this.shipStartX = lonToX(125.8);
    this.shipStartY = latToY(37.4);
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

    // Port markers (depth 5 — hidden by fog until their area is explored)
    this.ports = portsData.ports;
    this.drawPortMarkers();

    // Fog of war (depth 6 — over map + port markers, under ship at depth 10)
    this.initFog();

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

    // Sailing into an undiscovered continent's region discovers it (banner + full reveal).
    if (!this.isOverviewOpen) {
      for (const def of CONTINENT_DEFS) {
        if (this.discoveredContinents.has(def.id)) continue;
        const [lonMin, latMax, lonMax, latMin] = def.box;
        if (lon >= lonMin && lon <= lonMax && lat >= latMin && lat <= latMax) {
          this.revealContinent(def.id, true);
          break; // one reveal per frame for banner clarity
        }
      }
    }

    // Redraw fog if the ship cleared new area or a continent was revealed this frame
    this.rebuildFog();

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

    // Classic fog of war: clear the area the ship sails through
    this.revealCircle(this.ship.x, this.ship.y, REVEAL_RADIUS);
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
    const sx = MINI_W / WORLD_W, sy = MINI_H / WORLD_H;

    // Base layer: full world map, drawn once (depth 20)
    this.miniMapBase = this.add.graphics().setScrollFactor(0).setDepth(20);
    this.drawWorldBase(this.miniMapBase, ox, oy, sx, sy);

    // Fog overlay (depth 21): rebuilt when exploration changes via rebuildFog()
    this.miniMapFog = this.add.graphics().setScrollFactor(0).setDepth(21);
    this.drawFogOverlay(this.miniMapFog, ox, oy, sx, sy);

    // Label (depth 23, above fog/dynamic)
    this.add.text(ox + 4, oy + 2, '미니맵', {
      fontSize: '9px', color: '#aaddff',
    }).setScrollFactor(0).setDepth(23);

    // Dynamic layer (ports + ship + viewport rect + border)
    this.miniMapDynamic = this.add.graphics().setScrollFactor(0).setDepth(22);

    // Transparent click area over minimap to open world overview
    const clickArea = this.add.rectangle(
      ox + MINI_W / 2, oy + MINI_H / 2, MINI_W, MINI_H, 0x000000, 0,
    ).setScrollFactor(0).setDepth(24).setInteractive({ useHandCursor: true });
    clickArea.on('pointerdown', () => this.toggleMapOverview());
  }

  // Draw the full world (ocean + all land) into g, scaled. Used by minimap & overview
  // as the base layer; the fog overlay is drawn on top to hide unexplored regions.
  private drawWorldBase(g: Phaser.GameObjects.Graphics, ox: number, oy: number, sx: number, sy: number): void {
    g.fillStyle(0x1a6b8a, 1);
    g.fillRect(ox, oy, WORLD_W * sx, WORLD_H * sy);

    g.fillStyle(0x5a8a32, 1);
    this.landPolygons.forEach(poly => {
      if (poly.length < 3) return;
      let pts: { x: number; y: number }[] = [];
      let pmx = -999, pmy = -999;
      const flush = () => {
        if (pts.length < 3) { pts = []; pmx = -999; pmy = -999; return; }
        g.beginPath();
        g.moveTo(pts[0].x, pts[0].y);
        for (let j = 1; j < pts.length; j++) g.lineTo(pts[j].x, pts[j].y);
        g.closePath();
        g.fillPath();
        pts = []; pmx = -999; pmy = -999;
      };
      for (let k = 0; k < poly.length; k++) {
        if (k > 0 && Math.abs(poly[k][0] - poly[k - 1][0]) > WORLD_W / 2) flush();
        const mx = ox + poly[k][0] * sx;
        const my = oy + poly[k][1] * sy;
        if (Math.abs(mx - pmx) > 0.5 || Math.abs(my - pmy) > 0.5) { pts.push({ x: mx, y: my }); pmx = mx; pmy = my; }
      }
      flush();
    });
  }

  // Draw the fog overlay (dark over unexplored cells) into g, scaled. Runs of adjacent
  // unexplored cells in a row are merged into a single rect to keep the rect count low.
  private drawFogOverlay(g: Phaser.GameObjects.Graphics, ox: number, oy: number, sx: number, sy: number): void {
    g.fillStyle(FOG_COLOR, 1);
    for (let r = 0; r < FOG_ROWS; r++) {
      let c = 0;
      while (c < FOG_COLS) {
        if (this.revealed[r * FOG_COLS + c]) { c++; continue; }
        let c2 = c;
        while (c2 < FOG_COLS && !this.revealed[r * FOG_COLS + c2]) c2++;
        // +1 bleed closes sub-pixel seams between cells at small (minimap) scales
        g.fillRect(ox + c * FOG_CELL * sx, oy + r * FOG_CELL * sy, (c2 - c) * FOG_CELL * sx + 1, FOG_CELL * sy + 1);
        c = c2;
      }
    }
  }

  // Mark all cells within radius r of world point (wx,wy) as explored. Returns true if anything changed.
  private revealCircle(wx: number, wy: number, r: number): boolean {
    const c0 = Math.max(0, Math.floor((wx - r) / FOG_CELL));
    const c1 = Math.min(FOG_COLS - 1, Math.floor((wx + r) / FOG_CELL));
    const r0 = Math.max(0, Math.floor((wy - r) / FOG_CELL));
    const r1 = Math.min(FOG_ROWS - 1, Math.floor((wy + r) / FOG_CELL));
    const r2 = r * r;
    let changed = false;
    for (let ry = r0; ry <= r1; ry++) {
      for (let cx = c0; cx <= c1; cx++) {
        const idx = ry * FOG_COLS + cx;
        if (this.revealed[idx]) continue;
        const dx = (cx + 0.5) * FOG_CELL - wx;
        const dy = (ry + 0.5) * FOG_CELL - wy;
        if (dx * dx + dy * dy <= r2) { this.revealed[idx] = 1; changed = true; }
      }
    }
    if (changed) this.fogDirty = true;
    return changed;
  }

  // Mark all cells inside a continent box [lonMin,latMax,lonMax,latMin] as explored.
  private revealBox(box: number[]): void {
    const c0 = Math.max(0, Math.floor(lonToX(box[0]) / FOG_CELL));
    const c1 = Math.min(FOG_COLS - 1, Math.floor((lonToX(box[2]) - 0.001) / FOG_CELL));
    const r0 = Math.max(0, Math.floor(latToY(box[1]) / FOG_CELL));
    const r1 = Math.min(FOG_ROWS - 1, Math.floor((latToY(box[3]) - 0.001) / FOG_CELL));
    for (let ry = r0; ry <= r1; ry++) {
      for (let cx = c0; cx <= c1; cx++) {
        const idx = ry * FOG_COLS + cx;
        if (!this.revealed[idx]) { this.revealed[idx] = 1; this.fogDirty = true; }
      }
    }
  }

  private initFog(): void {
    this.revealed = new Uint8Array(FOG_COLS * FOG_ROWS);
    // Reveal already-discovered continents (start = east_asia, or restored from a save)
    for (const def of CONTINENT_DEFS) {
      if (this.discoveredContinents.has(def.id)) this.revealBox(def.box);
    }
    // Reveal a generous area around the starting position
    this.revealCircle(this.shipStartX, this.shipStartY, REVEAL_RADIUS * 1.5);

    this.computeRevealable();

    this.worldFog = this.add.graphics().setDepth(6);
    this.fogDirty = true;
    this.rebuildFog();
  }

  // Precompute which cells CAN ever be explored → the denominator for the exploration %.
  // A cell counts if it is ocean, coastal land within REVEAL_RADIUS of ocean (a passing
  // ship clears it), or inside a continent box (revealed wholesale on discovery). This makes
  // 100% genuinely achievable (deep inland cells a ship can never reach are excluded).
  private computeRevealable(): void {
    const N = FOG_COLS * FOG_ROWS;
    this.revealable = new Uint8Array(N);
    const ocean = new Uint8Array(N);
    for (let r = 0; r < FOG_ROWS; r++) {
      for (let c = 0; c < FOG_COLS; c++) {
        if (!this.isOnLand((c + 0.5) * FOG_CELL, (r + 0.5) * FOG_CELL)) ocean[r * FOG_COLS + c] = 1;
      }
    }
    const rad = Math.ceil(REVEAL_RADIUS / FOG_CELL);
    const r2 = REVEAL_RADIUS * REVEAL_RADIUS;
    for (let r = 0; r < FOG_ROWS; r++) {
      for (let c = 0; c < FOG_COLS; c++) {
        if (!ocean[r * FOG_COLS + c]) continue;
        const cx = (c + 0.5) * FOG_CELL, cy = (r + 0.5) * FOG_CELL;
        for (let dr = -rad; dr <= rad; dr++) {
          for (let dc = -rad; dc <= rad; dc++) {
            const rr = r + dr, cc = c + dc;
            if (rr < 0 || rr >= FOG_ROWS || cc < 0 || cc >= FOG_COLS) continue;
            const ex = (cc + 0.5) * FOG_CELL - cx, ey = (rr + 0.5) * FOG_CELL - cy;
            if (ex * ex + ey * ey <= r2) this.revealable[rr * FOG_COLS + cc] = 1;
          }
        }
      }
    }
    for (const def of CONTINENT_DEFS) {
      const c0 = Math.max(0, Math.floor(lonToX(def.box[0]) / FOG_CELL));
      const c1 = Math.min(FOG_COLS - 1, Math.floor((lonToX(def.box[2]) - 0.001) / FOG_CELL));
      const r0 = Math.max(0, Math.floor(latToY(def.box[1]) / FOG_CELL));
      const r1 = Math.min(FOG_ROWS - 1, Math.floor((latToY(def.box[3]) - 0.001) / FOG_CELL));
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) this.revealable[r * FOG_COLS + c] = 1;
    }
    let total = 0;
    for (let i = 0; i < N; i++) total += this.revealable[i];
    this.totalRevealable = total;
  }

  // Map-opening progress (0-100): explored revealable cells / total revealable cells.
  // The numerator can't exceed the denominator, so the value is naturally ≤ 100.
  private explorationPercent(): number {
    if (!this.totalRevealable) return 0;
    let rc = 0;
    for (let i = 0; i < this.revealed.length; i++) if (this.revealed[i] && this.revealable[i]) rc++;
    return Math.min(100, Math.round(rc / this.totalRevealable * 100));
  }

  // Redraw fog on the main map + minimap when the explored set has changed.
  private rebuildFog(): void {
    if (!this.fogDirty) return;
    this.worldFog.clear();
    this.drawFogOverlay(this.worldFog, 0, 0, 1, 1);
    if (this.miniMapFog) {
      const { width, height } = this.scale;
      this.miniMapFog.clear();
      this.drawFogOverlay(this.miniMapFog, width - MINI_W - 8, height - MINI_H - 8, MINI_W / WORLD_W, MINI_H / WORLD_H);
    }
    this.fogDirty = false;
  }

  private updateMiniMap(): void {
    const { width, height } = this.scale;
    const ox = width - MINI_W - 8;
    const oy = height - MINI_H - 8;
    const sx = MINI_W / WORLD_W;
    const sy = MINI_H / WORLD_H;
    const g = this.miniMapDynamic;
    g.clear();

    // Border (drawn here so it stays above the fog overlay)
    g.lineStyle(1, 0xffffff, 0.6);
    g.strokeRect(ox, oy, MINI_W, MINI_H);

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

  private revealContinent(continentId: string, immediate = false): void {
    if (this.discoveredContinents.has(continentId)) return; // double-call guard
    this.discoveredContinents.add(continentId);

    const def = CONTINENT_DEFS.find(d => d.id === continentId);
    if (def) this.revealBox(def.box); // clear the whole continent's fog at once

    if (immediate) {
      // Discovered while actively sailing: show banner now (scene is running)
      if (def) this.showContinentBanner(def.nameKo);
    } else {
      // Discovered via port → PortScene pauses; defer banner to resume to avoid mid-animation freeze
      this.pendingContinentReveal = continentId;
    }
  }

  private onSceneResume(): void {
    this.fogDirty = true;
    this.rebuildFog();
    if (this.pendingContinentReveal) {
      const id = this.pendingContinentReveal;
      this.pendingContinentReveal = null;
      const def = CONTINENT_DEFS.find(d => d.id === id);
      if (def) this.showContinentBanner(def.nameKo);
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
    if (this.mapOverlayObjects.length > 0) { this.hideMapOverview(); return; }
    this.showMapOverview();
  }

  private showMapOverview(): void {
    if (this.mapOverlayObjects.length > 0) return;
    this.isOverviewOpen = true;

    const { width, height } = this.scale;
    const MX = width / 2 - 320;
    const MY = height / 2 - 140;
    const MW = 640;
    const MH = 300;
    const sx = MW / WORLD_W;
    const sy = MH / WORLD_H;

    const bg = this.add.rectangle(width / 2, height / 2, 720, 400, 0x0a1628, 0.96)
      .setStrokeStyle(2, 0xffdd88).setScrollFactor(0).setDepth(40);
    this.mapOverlayObjects.push(bg);

    const titleTxt = this.add.text(width / 2, height / 2 - 180, '🗺 세계 탐험 현황', {
      fontSize: '20px', color: '#ffdd88', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(41);
    this.mapOverlayObjects.push(titleTxt);

    // Map-opening progress bar + % (top of the modal, just under the title)
    const pct = this.explorationPercent();
    const barW = 320, barX = width / 2 - barW / 2, barY = height / 2 - 156;
    const track = this.add.rectangle(width / 2, barY, barW, 14, 0x06121f)
      .setStrokeStyle(1, 0x33506e).setScrollFactor(0).setDepth(41);
    this.mapOverlayObjects.push(track);
    const fill = this.add.rectangle(barX, barY, barW * pct / 100, 14, 0xffce5a)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(41);
    this.mapOverlayObjects.push(fill);
    const pctTxt = this.add.text(width / 2, barY, `탐험 현황 ${pct}%`, {
      fontSize: '11px', color: '#ffffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(42);
    this.mapOverlayObjects.push(pctTxt);

    const closeBtn = this.add.text(width / 2 + 342, height / 2 - 182, '✕', {
      fontSize: '18px', color: '#fff',
      backgroundColor: 'rgba(180,40,40,0.7)',
      padding: { x: 7, y: 3 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(41).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.hideMapOverview());
    this.mapOverlayObjects.push(closeBtn);

    // Map content — identical renderer to the minimap: full world base + fog overlay
    const mapGfx = this.add.graphics().setScrollFactor(0).setDepth(40);
    this.drawWorldBase(mapGfx, MX, MY, sx, sy);
    this.drawFogOverlay(mapGfx, MX, MY, sx, sy);
    mapGfx.lineStyle(1, 0xffffff, 0.4);
    mapGfx.strokeRect(MX, MY, MW, MH);
    this.mapOverlayObjects.push(mapGfx);

    // Discovered continent labels
    for (const def of CONTINENT_DEFS) {
      if (!this.discoveredContinents.has(def.id)) continue;
      const lx = MX + (lonToX(def.box[0]) + lonToX(def.box[2])) / 2 * sx;
      const ly = MY + (latToY(def.box[1]) + latToY(def.box[3])) / 2 * sy;
      const lbl = this.add.text(lx, ly, def.nameKo ?? def.id, {
        fontSize: '10px', color: '#ffdd88',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(41);
      this.mapOverlayObjects.push(lbl);
    }

    const portG = this.add.graphics().setScrollFactor(0).setDepth(41);
    this.ports.forEach(p => {
      const contId = this.portToContinent.get(p.id);
      if (!contId || !this.discoveredContinents.has(contId)) return;
      const dx = MX + lonToX(p.coords.lon) * sx;
      const dy = MY + latToY(p.coords.lat) * sy;
      if (this.discoveredPorts.has(p.id)) {
        portG.fillStyle(0x44ff88, 1);
        portG.fillCircle(dx, dy, 3);
      } else {
        portG.fillStyle(0xe8c870, 1);
        portG.fillCircle(dx, dy, 2);
      }
    });
    const shipMx = MX + this.ship.x * sx;
    const shipMy = MY + this.ship.y * sy;
    portG.fillStyle(0xffffff, 1);
    portG.fillCircle(shipMx, shipMy, 4);
    portG.lineStyle(1, 0xffdd88, 1);
    portG.strokeCircle(shipMx, shipMy, 6);
    this.mapOverlayObjects.push(portG);

    const statsText = this.add.text(
      width / 2, height / 2 + 170,
      '발견: ' + this.discoveredPorts.size + ' / 50 항구   ·   ' + this.discoveredContinents.size + ' / 17 대륙',
      { fontSize: '13px', color: '#aaddff' }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(41);
    this.mapOverlayObjects.push(statsText);

    const onEsc = () => this.hideMapOverview();
    this._overviewEscHandler = onEsc;
    this.input.keyboard!.once('keydown-ESC', onEsc);
  }

  private hideMapOverview(): void {
    if (this.mapOverlayObjects.length === 0) return;
    if (this._overviewEscHandler) {
      this.input.keyboard!.off('keydown-ESC', this._overviewEscHandler);
      this._overviewEscHandler = null;
    }
    this.mapOverlayObjects.forEach(obj => obj.destroy());
    this.mapOverlayObjects = [];
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
