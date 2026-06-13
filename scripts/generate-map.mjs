import { feature } from 'topojson-client';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const topoPath = resolve(projectRoot, 'node_modules/world-atlas/land-110m.json');
const topology = JSON.parse(readFileSync(topoPath, 'utf-8'));

const geo = feature(topology, topology.objects.land);

const W = 40960, H = 20480;

function project(lon, lat) {
  return [(lon + 180) / 360 * W, (90 - lat) / 180 * H];
}

function ringToPath(ring) {
  return ring.map(([lon, lat], i) => {
    const [x, y] = project(lon, lat);
    return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
  }).join('') + 'Z';
}

function geomToPath(geom) {
  if (!geom) return '';
  if (geom.type === 'Polygon') return geom.coordinates.map(ringToPath).join('');
  if (geom.type === 'MultiPolygon') return geom.coordinates.flatMap(p => p.map(ringToPath)).join('');
  return '';
}

const features = geo.features || [geo];
const pathData = features
  .map(f => { const d = geomToPath(f.geometry || f); return d ? '  <path d="' + d + '"/>' : ''; })
  .filter(Boolean)
  .join('\n');

let grid = '';
for (let lon = -150; lon <= 150; lon += 30) {
  const x = (lon + 180) / 360 * W;
  grid += '<line x1="' + x.toFixed(1) + '" y1="0" x2="' + x.toFixed(1) + '" y2="' + H + '" stroke="#1e7ba0" stroke-width="1" opacity="0.25"/>';
}
for (let lat = -60; lat <= 60; lat += 30) {
  const y = (90 - lat) / 180 * H;
  grid += '<line x1="0" y1="' + y.toFixed(1) + '" x2="' + W + '" y2="' + y.toFixed(1) + '" stroke="#1e7ba0" stroke-width="1" opacity="0.25"/>';
}

// Rasterize at 4096x2048 (fits WebGL texture limits) but viewBox spans the full coordinate space
const RENDER_W = 4096, RENDER_H = 2048;
const svg = '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="' + RENDER_W + '" height="' + RENDER_H + '" viewBox="0 0 ' + W + ' ' + H + '">\n  <rect width="' + W + '" height="' + H + '" fill="#1a6b8a"/>\n  ' + grid + '\n  <g fill="#7ab648" stroke="#5a8a32" stroke-width="0.8" stroke-opacity="0.6">\n' + pathData + '\n  </g>\n</svg>';

const outDir = resolve(projectRoot, 'public/assets');
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'world-map.svg'), svg);
console.log('Generated world-map.svg (' + Math.round(svg.length / 1024) + 'KB)');

// Generate land-polygons.json for collision detection
const polygons = [];
const bounds = [];

function splitRingAtAntimeridian(pts, W) {
  let hasCrossing = false;
  for (let i = 0; i < pts.length; i++) {
    if (Math.abs(pts[(i + 1) % pts.length][0] - pts[i][0]) > W / 2) {
      hasCrossing = true; break;
    }
  }
  if (!hasCrossing) return [pts];

  const result = [];
  let cur = [];
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    cur.push(pts[i]);
    if (Math.abs(pts[j][0] - pts[i][0]) > W / 2) {
      const [x0, y0] = pts[i], [x1, y1] = pts[j];
      let t, xClose, xOpen;
      if (x0 > W / 2) { t = (W - x0) / (x1 + W - x0); xClose = W; xOpen = 0; }
      else             { t = x0 / (x0 + W - x1);         xClose = 0; xOpen = W; }
      const yc = Math.round(y0 + t * (y1 - y0));
      cur.push([xClose, yc]);
      result.push(cur);
      cur = [[xOpen, yc]];
    }
  }
  if (result.length % 2 === 0 && cur.length > 0) result[0] = [...cur, ...result[0]];
  else if (cur.length >= 3) result.push(cur);
  return result.filter(r => r.length >= 3);
}

const landFeatures = geo.features || [geo];
landFeatures.forEach(f => {
  const geom = f.geometry || f;
  if (!geom) return;
  let rings = [];
  if (geom.type === 'Polygon') {
    rings = [geom.coordinates[0]];
  } else if (geom.type === 'MultiPolygon') {
    rings = geom.coordinates.map(p => p[0]);
  }
  rings.forEach(ring => {
    if (!ring || ring.length < 3) return;
    const rawPts = ring.map(([lon, lat]) => [
      Math.round((lon + 180) / 360 * W),
      Math.round((90 - lat) / 180 * H),
    ]);
    for (const pts of splitRingAtAntimeridian(rawPts, W)) {
      const xs = pts.map(p => p[0]);
      const ys = pts.map(p => p[1]);
      polygons.push(pts);
      bounds.push([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]);
    }
  });
});

const lpJson = JSON.stringify({ polygons, bounds });
writeFileSync(resolve(outDir, 'land-polygons.json'), lpJson);
console.log('Generated land-polygons.json (' + Math.round(lpJson.length / 1024) + 'KB, ' + polygons.length + ' polygons)');
