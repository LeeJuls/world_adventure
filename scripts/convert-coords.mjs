import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const coordMap = {
  seoul: { lat: 37.57, lon: 127.0 },
  tokyo: { lat: 35.68, lon: 139.69 },
  beijing: { lat: 39.91, lon: 116.39 },
  shanghai: { lat: 31.22, lon: 121.46 },
  hongkong: { lat: 22.32, lon: 114.17 },
  singapore: { lat: 1.35, lon: 103.82 },
  bangkok: { lat: 13.75, lon: 100.52 },
  mumbai: { lat: 19.08, lon: 72.88 },
  kolkata: { lat: 22.57, lon: 88.36 },
  jakarta: { lat: -6.21, lon: 106.85 },
  hanoi: { lat: 21.03, lon: 105.85 },
  karachi: { lat: 24.86, lon: 67.01 },
  lisbon: { lat: 38.72, lon: -9.14 },
  madrid: { lat: 40.42, lon: -3.70 },
  paris: { lat: 48.86, lon: 2.35 },
  london: { lat: 51.51, lon: -0.13 },
  amsterdam: { lat: 52.37, lon: 4.90 },
  berlin: { lat: 52.52, lon: 13.41 },
  rome: { lat: 41.90, lon: 12.50 },
  venice: { lat: 45.44, lon: 12.33 },
  athens: { lat: 37.98, lon: 23.73 },
  istanbul: { lat: 41.01, lon: 28.95 },
  barcelona: { lat: 41.39, lon: 2.16 },
  oslo: { lat: 59.91, lon: 10.75 },
  stockholm: { lat: 59.33, lon: 18.07 },
  copenhagen: { lat: 55.68, lon: 12.57 },
  moscow: { lat: 55.75, lon: 37.62 },
  cairo: { lat: 30.06, lon: 31.25 },
  casablanca: { lat: 33.59, lon: -7.62 },
  lagos: { lat: 6.45, lon: 3.40 },
  cape_town: { lat: -33.93, lon: 18.42 },
  zanzibar: { lat: -6.16, lon: 39.20 },
  nairobi: { lat: -1.29, lon: 36.82 },
  alexandria: { lat: 31.20, lon: 29.92 },
  dakar: { lat: 14.72, lon: -17.47 },
  new_york: { lat: 40.71, lon: -74.01 },
  washington_dc: { lat: 38.91, lon: -77.04 },
  los_angeles: { lat: 34.05, lon: -118.24 },
  chicago: { lat: 41.88, lon: -87.63 },
  rio_de_janeiro: { lat: -22.91, lon: -43.17 },
  buenos_aires: { lat: -34.61, lon: -58.37 },
  havana: { lat: 23.13, lon: -82.38 },
  mexico_city: { lat: 19.43, lon: -99.13 },
  lima: { lat: -12.05, lon: -77.04 },
  santiago: { lat: -33.46, lon: -70.65 },
  sydney: { lat: -33.87, lon: 151.21 },
  melbourne: { lat: -37.81, lon: 144.96 },
  auckland: { lat: -36.86, lon: 174.76 },
  dubai: { lat: 25.20, lon: 55.27 },
  riyadh: { lat: 24.69, lon: 46.72 },
};

const dataPath = resolve(projectRoot, 'content/cities-data.json');
const data = JSON.parse(readFileSync(dataPath, 'utf-8'));

const missing = [];
data.ports.forEach(port => {
  const c = coordMap[port.id];
  if (c) { port.coords = c; }
  else { missing.push(port.id); }
});

writeFileSync(dataPath, JSON.stringify(data, null, 2) + '\n');
console.log('Updated ' + data.ports.length + ' cities coords to lat/lon. Missing: ' + (missing.join(', ') || 'none'));
