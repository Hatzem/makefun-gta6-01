// The minimap: a small live map of Sunset Harbor drawn in the HUD's
// corner, with the player, cars, cruisers and the mission marker on it.

import { STREET_W, VERTICAL_STREETS, HORIZONTAL_STREETS, WORLD_H, WORLD_W } from './city.js';
import { playerPos } from './player.js';

export function drawMinimap(ctx, G, x, y, w, h) {
  const sx = w / WORLD_W;
  const sy = h / WORLD_H;
  ctx.save();
  ctx.translate(x, y);
  // Panel.
  ctx.fillStyle = 'rgba(12, 16, 24, 0.82)';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  // Streets, so the map reads as a map.
  ctx.fillStyle = '#4a545f';
  for (const cx of VERTICAL_STREETS) {
    ctx.fillRect(cx * sx - (STREET_W / 2) * sx, 0, STREET_W * sx, h);
  }
  for (const cy of HORIZONTAL_STREETS) {
    ctx.fillRect(0, cy * sy - (STREET_W / 2) * sy, w, STREET_W * sy);
  }
  // City blocks.
  ctx.fillStyle = '#5a6b52';
  for (const b of G.city.buildings) {
    ctx.fillRect(b.x * sx, b.y * sy, Math.max(1, b.w * sx), Math.max(1, b.h * sy));
  }
  // Parks.
  ctx.fillStyle = '#3f7a44';
  for (const pk of G.city.parks) {
    ctx.fillRect(pk.x * sx, pk.y * sy, pk.w * sx, pk.h * sy);
  }
  // Mission marker.
  if (G.mission && G.mission.state === 'active') {
    const pulse = 3 + Math.sin(G.time * 5) * 1.5;
    ctx.fillStyle = '#37e08a';
    ctx.beginPath();
    ctx.arc(G.mission.marker.x * sx, G.mission.marker.y * sy, pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  // Parked cars.
  ctx.fillStyle = '#9aa0a8';
  for (const car of G.parked) {
    ctx.fillRect(car.x * sx - 1, car.y * sy - 1, 2, 2);
  }
  // Traffic.
  ctx.fillStyle = '#ffd23d';
  for (const car of G.traffic) {
    if (car === G.player.car) continue;
    ctx.fillRect(car.x * sx - 1.5, car.y * sy - 1.5, 3, 3);
  }
  // Police, flashing.
  const flash = Math.floor(G.time * 4) % 2 === 0;
  ctx.fillStyle = flash ? '#ff4d4d' : '#4d7dff';
  for (const car of G.police) {
    ctx.beginPath();
    ctx.arc(car.x * sx, car.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player.
  const pos = playerPos(G.player);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(pos.x * sx, pos.y * sy, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#37e08a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(pos.x * sx, pos.y * sy, 5.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
