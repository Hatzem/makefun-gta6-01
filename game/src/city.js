// Sunset Harbor's map: a seeded grid city of streets, blocks, buildings
// and districts. Nothing here draws or moves; it only describes the place
// so the player, traffic, police and renderer can all share one truth.

import { chance, pick, range, rangeInt } from './random.js';

export const WORLD_W = 2600;
export const WORLD_H = 2080;
export const PITCH = 260;
export const STREET_W = 44;
export const COLS = 10;
export const ROWS = 8;

const DISTRICTS = [
  { name: 'Cedar Heights', cx: 5, cy: 0.5, color: '#e8b04b' },
  { name: 'Old Mill Row', cx: 1, cy: 3.5, color: '#c96f4a' },
  { name: 'Neon Row', cx: 4.5, cy: 3.5, color: '#ff5da2' },
  { name: 'Juniper Docks', cx: 8.5, cy: 3.5, color: '#5aa7a0' },
  { name: 'Harborlight', cx: 5, cy: 7, color: '#4f8fd0' },
];

const HOUSE_COLORS = ['#d98a5f', '#c96f4a', '#e8b04b', '#a87c4f', '#b5764f'];
const SHOP_COLORS = ['#ff5da2', '#ff8a3d', '#37c8e8', '#b678ff', '#ffd23d'];
const DOCK_COLORS = ['#5aa7a0', '#6b7f8c', '#4f8fd0', '#7d8aa0'];
const MILL_COLORS = ['#9a5f43', '#8c6a4f', '#7a5a48', '#a8763e'];

function districtAt(col, row) {
  if (row <= 1) return DISTRICTS[0];
  if (row >= 6) return DISTRICTS[4];
  if (col <= 2) return DISTRICTS[1];
  if (col >= 7) return DISTRICTS[3];
  return DISTRICTS[2];
}

function paletteFor(district) {
  if (district.name === 'Cedar Heights') return HOUSE_COLORS;
  if (district.name === 'Neon Row') return SHOP_COLORS;
  if (district.name === 'Juniper Docks') return DOCK_COLORS;
  return MILL_COLORS;
}

export function buildCity(rng) {
  const buildings = [];
  const parks = [];
  const spots = [];

  for (let col = 0; col < COLS; col += 1) {
    for (let row = 0; row < ROWS; row += 1) {
      const bx = col * PITCH + STREET_W;
      const by = row * PITCH + STREET_W;
      const bw = PITCH - STREET_W;
      const bh = PITCH - STREET_W;
      const district = districtAt(col, row);
      if (chance(rng, 0.12)) {
        parks.push({ x: bx, y: by, w: bw, h: bh, district: district.name });
        continue;
      }
      const count = rangeInt(rng, 1, 3);
      const palette = paletteFor(district);
      for (let i = 0; i < count; i += 1) {
        const w = range(rng, 60, bw - 24);
        const h = range(rng, 50, bh - 24);
        const x = bx + range(rng, 8, Math.max(9, bw - w - 8));
        const y = by + range(rng, 8, Math.max(9, bh - h - 8));
        buildings.push({
          x, y, w, h,
          color: pick(rng, palette),
          roof: pick(rng, ['#2c2f38', '#3a2f2a', '#22303a']),
          height: rangeInt(rng, 1, 4),
          district: district.name,
        });
      }
      // A couple of parked cars along the block's south edge.
      const nSpots = rangeInt(rng, 1, 2);
      for (let i = 0; i < nSpots; i += 1) {
        spots.push({
          x: bx + range(rng, 30, bw - 30),
          y: by + bh + STREET_W / 2 + 8,
          angle: 0,
        });
      }
    }
  }

  return { buildings, parks, spots, districts: DISTRICTS };
}

export function streetCenters(count) {
  const centers = [];
  for (let i = 0; i < count; i += 1) centers.push(i * PITCH + STREET_W / 2);
  return centers;
}

export const VERTICAL_STREETS = streetCenters(COLS);
export const HORIZONTAL_STREETS = streetCenters(ROWS);

export function onRoad(x, y) {
  const inV = VERTICAL_STREETS.some((cx) => Math.abs(x - cx) <= STREET_W / 2);
  const inH = HORIZONTAL_STREETS.some((cy) => Math.abs(y - cy) <= STREET_W / 2);
  return inV || inH;
}

export function nearestStreetPoint(x, y) {
  let bestX = VERTICAL_STREETS[0];
  let bestD = Infinity;
  for (const cx of VERTICAL_STREETS) {
    const d = Math.abs(x - cx);
    if (d < bestD) { bestD = d; bestX = cx; }
  }
  let bestY = HORIZONTAL_STREETS[0];
  bestD = Infinity;
  for (const cy of HORIZONTAL_STREETS) {
    const d = Math.abs(y - cy);
    if (d < bestD) { bestD = d; bestY = cy; }
  }
  return { x: bestX, y: bestY };
}

// Push a circle out of every building it overlaps. Returns true if it hit.
export function resolveBuildingHit(city, body) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
    const dx = body.x - cx;
    const dy = body.y - cy;
    const d2 = dx * dx + dy * dy;
    const r = body.r || 12;
    if (d2 < r * r) {
      hit = true;
      const d = Math.sqrt(d2) || 0.001;
      const push = (r - d) / d;
      body.x += dx * push;
      body.y += dy * push;
    }
  }
  return hit;
}

export function clampToWorld(body, margin) {
  const m = margin || 0;
  body.x = Math.max(m, Math.min(WORLD_W - m, body.x));
  body.y = Math.max(m, Math.min(WORLD_H - m, body.y));
}

export function randomRoadPoint(rng) {
  if (chance(rng, 0.5)) {
    return {
      x: pick(rng, VERTICAL_STREETS),
      y: range(rng, 60, WORLD_H - 60),
    };
  }
  return {
    x: range(rng, 60, WORLD_W - 60),
    y: pick(rng, HORIZONTAL_STREETS),
  };
}
