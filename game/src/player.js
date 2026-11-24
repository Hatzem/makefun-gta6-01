// The player on foot: walking, getting hurt, and getting in and out of
// cars. Driving itself lives in traffic.js, next to the other cars.

import { clampToWorld, resolveBuildingHit } from './city.js';
import { makePed } from './pedestrians.js';
import { playCrash } from './audio.js';

export const WALK_SPEED = 175;

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, r: 11,
    health: 100, money: 0,
    car: null,           // the car object the player is driving, or null
    wanted: 0,
    lastCrimeAt: -999,
    quietFor: 0,         // seconds since the last crime
    hurtAt: -999,        // last time the player took damage
    bustTimer: 0,
    invulnerableUntil: 0,
  };
}

export function playerPos(p) {
  return p.car ? { x: p.car.x, y: p.car.y } : { x: p.x, y: p.y };
}

export function playerSpeed(p) {
  return p.car ? Math.abs(p.car.speed) : 0;
}

export function stepOnFoot(G, dt, ix, iy) {
  const p = G.player;
  if (p.car) return;
  const len = Math.hypot(ix, iy);
  if (len > 0.01) {
    const nx = ix / len;
    const ny = iy / len;
    p.x += nx * WALK_SPEED * dt;
    p.y += ny * WALK_SPEED * dt;
    p.angle = Math.atan2(ny, nx);
  }
  resolveBuildingHit(G.city, p);
  clampToWorld(p, 14);
}

export function damagePlayer(G, amount, now) {
  const p = G.player;
  if (now < p.invulnerableUntil) return;
  p.health = Math.max(0, p.health - amount);
  p.hurtAt = now;
  p.invulnerableUntil = now + 0.6;
  if (p.health <= 0) {
    G.busted = { reason: 'You were taken to the hospital.', fine: 100 };
  }
}

export function nearestCar(G, maxDist) {
  const p = G.player;
  let best = null;
  let bestD = maxDist;
  const all = G.traffic.concat(G.parked);
  for (const car of all) {
    if (car.police) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function enterCar(G, car) {
  const p = G.player;
  if (!car || p.car) return false;
  // Stealing a parked car is a small crime; yanking a driver out is worse,
  // and the driver runs off on foot.
  if (car.parked) {
    G.addWanted(1, 'Grand theft auto');
  } else if (car.driver === 'traffic') {
    G.addWanted(2, 'Carjacking');
    const driver = makePed(G.rng, car.x + 24, car.y + 24);
    driver.fleeing = true;
    driver.fleeUntil = G.time + 4;
    driver.angle = Math.atan2(driver.y - car.y, driver.x - car.x);
    G.peds.push(driver);
    car.driver = null;
  }
  p.car = car;
  car.parked = false;
  car.driver = 'player';
  const idx = G.parked.indexOf(car);
  if (idx >= 0) G.parked.splice(idx, 1);
  if (!G.traffic.includes(car)) G.traffic.push(car);
  return true;
}

export function exitCar(G) {
  const p = G.player;
  const car = p.car;
  if (!car) return false;
  car.speed = 0;
  car.driver = null;
  car.parked = true;
  p.car = null;
  // Step out to the side of the car.
  const side = car.angle + Math.PI / 2;
  p.x = car.x + Math.cos(side) * 26;
  p.y = car.y + Math.sin(side) * 26;
  p.angle = car.angle;
  resolveBuildingHit(G.city, p);
  clampToWorld(p, 14);
  if (!G.parked.includes(car)) G.parked.push(car);
  const idx = G.traffic.indexOf(car);
  if (idx >= 0) G.traffic.splice(idx, 1);
  return true;
}

// A traffic car clipped the player on foot.
export function checkCarHitsPlayer(G, now) {
  const p = G.player;
  if (p.car) return;
  for (const car of G.traffic) {
    if (Math.abs(car.speed) < 40) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < 24) {
      damagePlayer(G, 12, now);
      playCrash();
      // Shove the player clear of the road.
      const a = Math.atan2(p.y - car.y, p.x - car.x);
      p.x += Math.cos(a) * 30;
      p.y += Math.sin(a) * 30;
      clampToWorld(p, 14);
    }
  }
}
