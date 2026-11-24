// Everything Sunset Harbor shows: the city, the cars and people in it,
// the HUD with its minimap and stars, and the menu and busted screens.
// Drawing only reads the game state; it never changes it.

import {
  HORIZONTAL_STREETS, PITCH, STREET_W, VERTICAL_STREETS, WORLD_H, WORLD_W,
} from './city.js';
import { playerPos } from './player.js';
import { drawMinimap } from './minimap.js';
import { missionObjective } from './missions.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export function cameraFor(G, viewW, viewH) {
  const pos = playerPos(G.player);
  const x = Math.max(0, Math.min(WORLD_W - viewW, pos.x - viewW / 2));
  const y = Math.max(0, Math.min(WORLD_H - viewH, pos.y - viewH / 2));
  return { x, y };
}

function inView(cam, viewW, viewH, x, y, pad) {
  return x > cam.x - pad && x < cam.x + viewW + pad && y > cam.y - pad && y < cam.y + viewH + pad;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawGround(ctx, G, cam, viewW, viewH) {
  ctx.fillStyle = '#77875f';
  ctx.fillRect(cam.x, cam.y, viewW, viewH);
  // Streets.
  ctx.fillStyle = '#333842';
  for (const cx of VERTICAL_STREETS) {
    ctx.fillRect(cx - STREET_W / 2, cam.y, STREET_W, viewH);
  }
  for (const cy of HORIZONTAL_STREETS) {
    ctx.fillRect(cam.x, cy - STREET_W / 2, viewW, STREET_W);
  }
  // Pavements: pale strips along each street edge.
  ctx.fillStyle = '#9aa0a8';
  for (const cx of VERTICAL_STREETS) {
    ctx.fillRect(cx - STREET_W / 2 - 7, cam.y, 7, viewH);
    ctx.fillRect(cx + STREET_W / 2, cam.y, 7, viewH);
  }
  for (const cy of HORIZONTAL_STREETS) {
    ctx.fillRect(cam.x, cy - STREET_W / 2 - 7, viewW, 7);
    ctx.fillRect(cam.x, cy + STREET_W / 2, viewW, 7);
  }
  // Dashed centre lines.
  ctx.strokeStyle = '#d8c25a';
  ctx.lineWidth = 2;
  ctx.setLineDash([18, 22]);
  ctx.beginPath();
  for (const cx of VERTICAL_STREETS) {
    ctx.moveTo(cx, cam.y);
    ctx.lineTo(cx, cam.y + viewH);
  }
  for (const cy of HORIZONTAL_STREETS) {
    ctx.moveTo(cam.x, cy);
    ctx.lineTo(cam.x + viewW, cy);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  // District names, faint and large.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.font = '700 34px ' + FONT;
  ctx.textAlign = 'center';
  for (const d of G.city.districts) {
    const x = d.cx * PITCH;
    const y = d.cy * PITCH;
    if (inView(cam, viewW, viewH, x, y, 200)) ctx.fillText(d.name.toUpperCase(), x, y);
  }
  // Parks with trees.
  for (const pk of G.city.parks) {
    if (!inView(cam, viewW, viewH, pk.x, pk.y, 260)) continue;
    ctx.fillStyle = '#4a8a4f';
    ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
    ctx.fillStyle = '#2f6b34';
    for (let i = 0; i < 6; i += 1) {
      const tx = pk.x + 24 + ((i * 53) % (pk.w - 40));
      const ty = pk.y + 24 + ((i * 37) % (pk.h - 40));
      ctx.beginPath();
      ctx.arc(tx, ty, 12, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawBuildings(ctx, G, cam, viewW, viewH) {
  for (const b of G.city.buildings) {
    if (!inView(cam, viewW, viewH, b.x, b.y, 260)) continue;
    // Long sunset shadow.
    ctx.fillStyle = 'rgba(20, 16, 10, 0.28)';
    ctx.fillRect(b.x + 8 + b.height * 3, b.y + 10 + b.height * 3, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    // Windows.
    ctx.fillStyle = 'rgba(255, 244, 200, 0.75)';
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 24));
    for (let i = 0; i < cols; i += 1) {
      for (let j = 0; j < rows; j += 1) {
        if ((i * 7 + j * 3) % 4 === 0) continue;
        ctx.fillRect(b.x + 10 + i * 26, b.y + 10 + j * 24, 12, 10);
      }
    }
  }
}

function drawCarShape(ctx, car, now) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Wheels.
  ctx.fillStyle = '#14161a';
  ctx.fillRect(-13, -11, 9, 5);
  ctx.fillRect(4, -11, 9, 5);
  ctx.fillRect(-13, 6, 9, 5);
  ctx.fillRect(4, 6, 9, 5);
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -18, -9, 36, 18, 5);
  ctx.fill();
  // Cabin and windshield.
  ctx.fillStyle = 'rgba(20, 28, 40, 0.85)';
  ctx.fillRect(-4, -7, 12, 14);
  ctx.fillStyle = 'rgba(180, 220, 255, 0.55)';
  ctx.fillRect(8, -6, 4, 12);
  // Headlights.
  ctx.fillStyle = '#fff8c9';
  ctx.fillRect(16, -7, 2, 3);
  ctx.fillRect(16, 4, 2, 3);
  if (car.police) {
    const flash = Math.floor(now * 5) % 2 === 0;
    ctx.fillStyle = flash ? '#ff3b30' : '#2f6bff';
    ctx.fillRect(-2, -9, 5, 4);
    ctx.fillStyle = flash ? '#2f6bff' : '#ff3b30';
    ctx.fillRect(-2, 5, 5, 4);
    ctx.fillStyle = '#14161a';
    ctx.fillRect(-18, -9, 6, 18);
  }
  ctx.restore();
}

function drawWorld(ctx, G, cam, viewW, viewH, now) {
  drawGround(ctx, G, cam, viewW, viewH);
  drawBuildings(ctx, G, cam, viewW, viewH);

  // Cash pickups.
  for (const pk of G.pickups) {
    if (!inView(cam, viewW, viewH, pk.x, pk.y, 40)) continue;
    const bob = Math.sin(pk.bob) * 2;
    ctx.fillStyle = '#ffd23d';
    ctx.beginPath();
    ctx.arc(pk.x, pk.y + bob, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#a87c00';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#7a5c00';
    ctx.font = '700 13px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', pk.x, pk.y + bob + 0.5);
  }

  // Mission marker: a beam and a pulsing ring.
  if (G.mission && G.mission.state === 'active') {
    const m = G.mission.marker;
    const pulse = 26 + Math.sin(now * 4) * 7;
    ctx.fillStyle = 'rgba(55, 224, 138, 0.16)';
    ctx.fillRect(m.x - 14, cam.y, 28, viewH);
    ctx.strokeStyle = '#37e08a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(m.x, m.y, pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#37e08a';
    ctx.beginPath();
    ctx.arc(m.x, m.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const car of G.parked) {
    if (inView(cam, viewW, viewH, car.x, car.y, 60)) drawCarShape(ctx, car, now);
  }
  for (const car of G.traffic) {
    if (inView(cam, viewW, viewH, car.x, car.y, 60)) drawCarShape(ctx, car, now);
  }
  for (const car of G.police) {
    if (inView(cam, viewW, viewH, car.x, car.y, 60)) drawCarShape(ctx, car, now);
  }

  // A green ring marks the player's own car at a glance.
  if (G.player.car) {
    ctx.strokeStyle = '#37e08a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(G.player.car.x, G.player.car.y, 25, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Pedestrians.
  for (const ped of G.peds) {
    if (!inView(cam, viewW, viewH, ped.x, ped.y, 30)) continue;
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, ped.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath();
    ctx.arc(ped.x + Math.cos(ped.angle) * 3, ped.y + Math.sin(ped.angle) * 3, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // The player on foot.
  const p = G.player;
  if (!p.car) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2f9e44';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.angle) * 4, p.y + Math.sin(p.angle) * 4, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Particles.
  for (const pt of G.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
}

function drawHud(ctx, G, viewW, viewH, now) {
  // Top-left status panel.
  ctx.fillStyle = 'rgba(12, 16, 24, 0.78)';
  roundRect(ctx, 12, 12, 250, 92, 10);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // Wanted stars.
  let stars = '';
  for (let i = 0; i < 5; i += 1) stars += i < G.player.wanted ? '★' : '☆';
  ctx.font = '700 24px ' + FONT;
  ctx.fillStyle = G.player.wanted > 0 ? '#ffd23d' : 'rgba(255, 255, 255, 0.45)';
  ctx.fillText(stars, 24, 42);
  // Money and health.
  ctx.font = '700 20px ' + FONT;
  ctx.fillStyle = '#7dff9a';
  ctx.fillText('$' + G.player.money, 24, 70);
  ctx.fillStyle = '#ff6b5e';
  ctx.fillRect(24, 80, 110, 10);
  ctx.fillStyle = '#37e08a';
  ctx.fillRect(24, 80, 110 * Math.max(0, G.player.health / 100), 10);
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 12px ' + FONT;
  ctx.fillText('HP', 140, 89);

  // Minimap, top-right.
  drawMinimap(ctx, G, viewW - 196, 12, 184, 148);

  // Objective bar, bottom-centre.
  const objective = missionObjective(G);
  ctx.font = '600 15px ' + FONT;
  const ow = Math.min(viewW - 40, ctx.measureText(objective).width + 36);
  ctx.fillStyle = 'rgba(12, 16, 24, 0.78)';
  roundRect(ctx, (viewW - ow) / 2, viewH - 52, ow, 36, 9);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(objective, viewW / 2, viewH - 29);

  // Speed, bottom-right.
  if (G.player.car) {
    const mph = Math.round(Math.abs(G.player.car.speed) * 0.24);
    ctx.textAlign = 'right';
    ctx.font = '700 30px ' + FONT;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(mph + '', viewW - 24, viewH - 66);
    ctx.font = '600 12px ' + FONT;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText('MPH', viewW - 24, viewH - 50);
  }

  // Controls hint, bottom-left.
  ctx.textAlign = 'left';
  ctx.font = '600 12px ' + FONT;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.fillText('WASD drive / walk   •   E enter or leave a car   •   P pause', 14, viewH - 14);

  // Flash message under the stars.
  if (G.flash && now - G.flash.at < 3) {
    ctx.textAlign = 'left';
    ctx.font = '700 16px ' + FONT;
    ctx.fillStyle = '#ffd23d';
    ctx.fillText(G.flash.text, 24, 128);
  }

  // Mission banner.
  if (G.mission && G.mission.banner && now - G.mission.bannerAt < 4) {
    ctx.textAlign = 'center';
    ctx.font = '700 26px ' + FONT;
    ctx.fillStyle = G.mission.state === 'won' ? '#37e08a' : '#ff6b5e';
    ctx.fillText(G.mission.banner, viewW / 2, 150);
    ctx.font = '600 14px ' + FONT;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Press 1 or 2 for another mission, 3 to free roam', viewW / 2, 176);
  }

  // Bust warning when a cruiser is closing in.
  if (G.player.bustTimer > 0.2 && G.player.wanted > 0) {
    ctx.textAlign = 'center';
    ctx.font = '700 20px ' + FONT;
    ctx.fillStyle = '#ff3b30';
    ctx.fillText('THEY ARE ON YOU — DRIVE!', viewW / 2, 110);
  }
}

export function drawGame(ctx, G, viewW, viewH, now) {
  const cam = cameraFor(G, viewW, viewH);
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  drawWorld(ctx, G, cam, viewW, viewH, now);
  ctx.restore();
  drawHud(ctx, G, viewW, viewH, now);
}

export function drawMenu(ctx, G, viewW, viewH, now) {
  // The city idles behind the menu.
  const cam = cameraFor(G, viewW, viewH);
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  drawWorld(ctx, G, cam, viewW, viewH, now);
  ctx.restore();
  ctx.fillStyle = 'rgba(10, 12, 20, 0.62)';
  ctx.fillRect(0, 0, viewW, viewH);

  const cx = viewW / 2;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23d';
  ctx.font = '700 54px ' + FONT;
  ctx.fillText('SUNSET HARBOR', cx, 130);
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 19px ' + FONT;
  ctx.fillText('An open-world getaway — steal cars, dodge the Harbor PD, run the jobs.', cx, 164);

  const buttons = [
    { key: '1', label: '1 — Getaway', sub: 'Steal a car, reach the marker in 90s  •  $500' },
    { key: '2', label: '2 — Hot Delivery', sub: 'Across town in 120s with 2 stars already on you  •  $800' },
    { key: '3', label: '3 — Free Roam', sub: 'Explore the city, grab cash pickups, stay clean' },
  ];
  G.menuButtons = [];
  let y = 220;
  for (const b of buttons) {
    const bw = 520;
    const bh = 62;
    const bx = cx - bw / 2;
    const hover = G.mouse.x >= bx && G.mouse.x <= bx + bw && G.mouse.y >= y && G.mouse.y <= y + bh;
    ctx.fillStyle = hover ? 'rgba(255, 210, 61, 0.28)' : 'rgba(255, 255, 255, 0.10)';
    roundRect(ctx, bx, y, bw, bh, 10);
    ctx.fill();
    ctx.strokeStyle = '#ffd23d';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 20px ' + FONT;
    ctx.fillText(b.label, cx, y + 27);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = '600 13px ' + FONT;
    ctx.fillText(b.sub, cx, y + 48);
    G.menuButtons.push({ ...b, x: bx, y, w: bw, h: bh });
    y += 76;
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.font = '600 14px ' + FONT;
  ctx.fillText('WASD / arrows — walk and drive    •    E — enter or leave a car    •    P — pause', cx, y + 14);
  ctx.fillText('Crimes raise your wanted stars. Hide to cool off. Getting busted costs $150.', cx, y + 38);
  const done = Object.keys(G.save.missionsDone || {}).length;
  ctx.fillStyle = '#7dff9a';
  ctx.fillText(
    'Best money: $' + (G.save.bestMoney || 0) + '   •   Missions finished: ' + done + ' of 2   •   Total earned: $' + (G.save.totalEarned || 0),
    cx, y + 66,
  );
}

export function drawBusted(ctx, G, viewW, viewH) {
  ctx.fillStyle = 'rgba(10, 10, 14, 0.72)';
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff3b30';
  ctx.font = '700 52px ' + FONT;
  ctx.fillText('BUSTED', viewW / 2, viewH / 2 - 30);
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 18px ' + FONT;
  ctx.fillText(G.busted.reason, viewW / 2, viewH / 2 + 6);
  ctx.fillText('Fine: $' + G.busted.fine + ' — the Harbor PD impounded your ride.', viewW / 2, viewH / 2 + 34);
  ctx.fillStyle = '#ffd23d';
  ctx.font = '700 18px ' + FONT;
  ctx.fillText('Press R to get back on the street', viewW / 2, viewH / 2 + 72);
}

export function drawPaused(ctx, viewW, viewH) {
  ctx.fillStyle = 'rgba(10, 12, 20, 0.6)';
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 40px ' + FONT;
  ctx.fillText('PAUSED', viewW / 2, viewH / 2);
  ctx.font = '600 16px ' + FONT;
  ctx.fillText('Press P to keep playing', viewW / 2, viewH / 2 + 34);
}
