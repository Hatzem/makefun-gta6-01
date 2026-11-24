// The wanted level and the Harbor PD. Stars rise with crimes and fade
// when the player stays quiet and out of sight; cruisers spawn, chase,
// ram, and bust a slow player who lets them get close.

import { randomRoadPoint } from './city.js';
import { makeCar } from './traffic.js';
import { playerPos } from './player.js';
import { playBusted, playCrash } from './audio.js';

export const MAX_WANTED = 5;

export function wantedCruisers(wanted) {
  if (wanted <= 0) return 0;
  return Math.min(1 + wanted, 4);
}

export function addWanted(G, stars, what) {
  const p = G.player;
  const before = p.wanted;
  p.wanted = Math.max(0, Math.min(MAX_WANTED, p.wanted + stars));
  p.lastCrimeAt = G.time;
  p.quietFor = 0;
  if (p.wanted > before) {
    G.flashMessage(what + '  +' + (p.wanted - before) + '★');
  }
}

export function updateWanted(G, dt) {
  const p = G.player;
  p.quietFor = G.time - p.lastCrimeAt;
  if (p.wanted === 0) return;
  // Fade one star after ten quiet seconds with no cruiser nearby.
  const near = G.police.some((c) => {
    const pos = playerPos(p);
    return Math.hypot(c.x - pos.x, c.y - pos.y) < 520;
  });
  if (p.quietFor > 10 && !near) {
    p.decayTimer = (p.decayTimer || 0) + dt;
    if (p.decayTimer > 6) {
      p.wanted -= 1;
      p.decayTimer = 0;
      G.flashMessage('Heat dying down…  ' + p.wanted + '★');
    }
  } else {
    p.decayTimer = 0;
  }
}

function spawnCruiser(G) {
  const pos = playerPos(G.player);
  const p = G.player;
  // Cruisers join the chase from behind the player, not head-on: they
  // approach along the player's heading and ram from the rear, the way
  // a pursuit actually works (and the way that reads on screen).
  const hx = Math.cos(p.car ? p.car.angle : p.angle);
  const hy = Math.sin(p.car ? p.car.angle : p.angle);
  let pt = randomRoadPoint(G.rng);
  let tries = 0;
  let behind = false;
  while (tries < 16) {
    const d = Math.hypot(pt.x - pos.x, pt.y - pos.y);
    const dot = (pt.x - pos.x) * hx + (pt.y - pos.y) * hy;
    if (d >= 480 && dot < 0) { behind = true; break; }
    pt = randomRoadPoint(G.rng);
    tries += 1;
  }
  if (!behind) {
    tries = 0;
    while (Math.hypot(pt.x - pos.x, pt.y - pos.y) < 480 && tries < 12) {
      pt = randomRoadPoint(G.rng);
      tries += 1;
    }
  }
  const car = makeCar(G.rng, pt.x, pt.y, 0, {
    police: true, color: '#f5f5f5', driver: 'police', id: G.nextCarId++,
  });
  car.speed = 260;
  car.cruise = 300 + G.player.wanted * 32;
  G.police.push(car);
  return car;
}

export function updatePolice(G, dt, now) {
  const want = wantedCruisers(G.player.wanted);
  while (G.police.length < want) spawnCruiser(G);
  while (G.police.length > want) G.police.pop();

  const pos = playerPos(G.player);
  const p = G.player;
  for (const car of G.police) {
    const dx = pos.x - car.x;
    const dy = pos.y - car.y;
    const dist = Math.hypot(dx, dy) || 1;
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    const target = Math.min(car.cruise, 240 + dist * 0.35);
    car.speed += (target - car.speed) * Math.min(1, dt * 1.2);
    const prevX = car.x;
    const prevY = car.y;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;

    // Slide along buildings instead of driving through them.
    const hitWall = (function hit() {
      for (const b of G.city.buildings) {
        const cx = Math.max(b.x, Math.min(car.x, b.x + b.w));
        const cy = Math.max(b.y, Math.min(car.y, b.y + b.h));
        if (Math.hypot(car.x - cx, car.y - cy) < 15) return true;
      }
      return false;
    })();
    if (hitWall) {
      car.x = prevX;
      car.y = prevY;
      car.angle += 0.9;
      car.speed *= 0.7;
    }
    car.x = Math.max(18, Math.min(2582, car.x));
    car.y = Math.max(18, Math.min(2062, car.y));

    // Ram the player's car: shove it and slow it, but only once per
    // hit — a cruiser glued to the bumper must not pin the player to 0.
    if (p.car) {
      const d = Math.hypot(car.x - p.car.x, car.y - p.car.y);
      if (d < 36) {
        const push = 130 * dt;
        p.car.x += Math.cos(car.angle) * push;
        p.car.y += Math.sin(car.angle) * push;
        if (now - car.crashAt > 0.6) {
          p.car.speed *= 0.85;
          playCrash();
          car.crashAt = now;
          G.spawnBurst(p.car.x, p.car.y, '#9fb7ff', 6);
        }
      }
    }

    // Bust: the player is slow and a cruiser is right on them.
    const speed = p.car ? Math.abs(p.car.speed) : 0;
    if (dist < 30 && speed < 60) {
      p.bustTimer += dt;
      if (p.bustTimer > 1.6) {
        G.busted = { reason: 'Busted by the Harbor PD.', fine: 150 };
        playBusted();
        p.bustTimer = 0;
      }
    } else {
      p.bustTimer = Math.max(0, p.bustTimer - dt * 2);
    }

    // A cruiser stuck far behind the action respawns closer.
    if (dist > 1100) {
      const fresh = spawnCruiser(G);
      const idx = G.police.indexOf(car);
      if (idx >= 0) G.police[idx] = fresh;
    }
  }
}
