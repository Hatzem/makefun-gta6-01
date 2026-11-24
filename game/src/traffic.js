// Cars: traffic that drives the streets, parked cars waiting to be
// taken, and the driving model the player uses once behind the wheel.

import {
  HORIZONTAL_STREETS, VERTICAL_STREETS, WORLD_H, WORLD_W,
  clampToWorld, randomRoadPoint, resolveBuildingHit,
} from './city.js';
import { chance, pick, range, rangeInt } from './random.js';
import { playCrash } from './audio.js';

export const CAR_COLORS = [
  '#e84c3d', '#f2c94c', '#4f8fd0', '#7bc96f', '#e8e8e8',
  '#ff8a3d', '#b678ff', '#37c8e8', '#8c6a4f', '#3a3f4a',
];

const CAR_LEN = 34;
const CAR_WID = 17;

export function makeCar(rng, x, y, angle, opts) {
  const o = opts || {};
  return {
    x, y, angle, speed: 0, r: 15,
    color: o.color || pick(rng, CAR_COLORS),
    parked: !!o.parked,
    police: !!o.police,
    driver: o.driver || null,   // 'player', 'traffic', or null
    axis: o.axis || 'h',        // traffic cars drive along a street line
    dir: o.dir || 1,
    cruise: o.cruise || range(rng, 130, 190),
    turnAt: null,
    stuckFor: 0,
    crashAt: -999,
    id: o.id || 0,
  };
}

export function spawnTraffic(G, count) {
  for (let i = 0; i < count; i += 1) {
    const pt = randomRoadPoint(G.rng);
    const onVertical = VERTICAL_STREETS.some((cx) => Math.abs(pt.x - cx) < 1);
    const axis = onVertical ? 'v' : 'h';
    const angle = axis === 'h' ? (chance(G.rng, 0.5) ? 0 : Math.PI) : (chance(G.rng, 0.5) ? Math.PI / 2 : -Math.PI / 2);
    const car = makeCar(G.rng, pt.x, pt.y, angle, {
      axis, driver: 'traffic', id: G.nextCarId++,
    });
    car.speed = car.cruise * 0.8;
    // Sit on the right-hand lane of the street, not its centre line.
    if (axis === 'h') car.y += Math.cos(angle) * 9;
    else car.x += -Math.sin(angle) * 9;
    G.traffic.push(car);
  }
}

export function spawnParked(G, count) {
  const spots = G.city.spots.slice();
  for (let i = 0; i < count && spots.length; i += 1) {
    const spot = spots.splice(Math.floor(G.rng() * spots.length), 1)[0];
    const car = makeCar(G.rng, spot.x, spot.y, chance(G.rng, 0.5) ? 0 : Math.PI, {
      parked: true, id: G.nextCarId++,
    });
    G.parked.push(car);
  }
}

function nearestCrossingStreet(car) {
  if (car.axis === 'h') {
    let best = VERTICAL_STREETS[0];
    let bestD = Infinity;
    for (const cx of VERTICAL_STREETS) {
      const d = Math.abs(car.x - cx);
      if (d < bestD) { bestD = d; best = cx; }
    }
    return { at: best, dist: bestD };
  }
  let best = HORIZONTAL_STREETS[0];
  let bestD = Infinity;
  for (const cy of HORIZONTAL_STREETS) {
    const d = Math.abs(car.y - cy);
    if (d < bestD) { bestD = d; best = cy; }
  }
  return { at: best, dist: bestD };
}

function carAhead(G, car, gap) {
  for (const other of G.traffic) {
    if (other === car || other.parked) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const along = car.axis === 'h' ? dx * Math.cos(car.angle) + dy * Math.sin(car.angle) : dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (along > 0 && along < gap && side < 22) return other;
  }
  return null;
}

export function stepTrafficCar(G, car, dt) {
  if (car.driver !== 'traffic') return;
  // Ease toward cruise speed, slower when another car is ahead.
  const ahead = carAhead(G, car, 90);
  const target = ahead ? Math.min(car.cruise, ahead.speed * 0.9) : car.cruise;
  car.speed += (target - car.speed) * Math.min(1, dt * 1.5);

  // At an intersection, sometimes turn left or right onto the crossing street.
  const cross = nearestCrossingStreet(car);
  if (cross.dist < 26 && car.turnAt !== cross.at && chance(G.rng, 0.35)) {
    car.turnAt = cross.at;
    const turnLeft = chance(G.rng, 0.5);
    car.angle += turnLeft ? -Math.PI / 2 : Math.PI / 2;
    if (car.axis === 'h') {
      car.axis = 'v';
      car.x = cross.at - Math.sin(car.angle) * 9;
    } else {
      car.axis = 'h';
      car.y = cross.at + Math.cos(car.angle) * 9;
    }
  }

  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;

  // Hold the right-hand lane of the street we are on.
  if (car.axis === 'h') {
    const cy = HORIZONTAL_STREETS.reduce((a, b) => (Math.abs(b - car.y) < Math.abs(a - car.y) ? b : a));
    car.y = cy + Math.cos(car.angle) * 9;
  } else {
    const cx = VERTICAL_STREETS.reduce((a, b) => (Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a));
    car.x = cx - Math.sin(car.angle) * 9;
  }

  // Loop around the far edge instead of piling up at the border.
  if (car.x < -40) car.x = WORLD_W + 30;
  if (car.x > WORLD_W + 40) car.x = -30;
  if (car.y < -40) car.y = WORLD_H + 30;
  if (car.y > WORLD_H + 40) car.y = -30;
}

// The player's driving model: arcade steering, drag, and a little drift.
export function stepDrivenCar(G, car, dt, up, down, steer) {
  const maxForward = 430;
  const maxReverse = 140;
  if (up) car.speed += 620 * dt;
  if (down) car.speed -= car.speed > 5 ? 900 * dt : 420 * dt;
  car.speed -= car.speed * 0.55 * dt; // rolling drag
  car.speed = Math.max(-maxReverse, Math.min(maxForward, car.speed));
  const grip = 2.6 * Math.min(1, Math.abs(car.speed) / 140 + 0.25);
  car.angle += steer * grip * dt * (car.speed >= 0 ? 1 : -1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;

  const hitWall = resolveBuildingHit(G.city, car);
  if (hitWall) {
    if (Math.abs(car.speed) > 160 && G.time - car.crashAt > 0.4) {
      playCrash();
      car.crashAt = G.time;
      G.spawnBurst(car.x, car.y, '#ffb347', 8);
    }
    car.speed *= -0.25;
  }
  clampToWorld(car, 18);

  // Bumping other cars: push apart, slow both, make noise when it hurts.
  for (const other of G.traffic) {
    if (other === car || other.parked) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.01 && d < 34) {
      const push = (34 - d) / 2;
      const nx = dx / d;
      const ny = dy / d;
      car.x -= nx * push;
      car.y -= ny * push;
      other.x += nx * push;
      other.y += ny * push;
      const impact = Math.abs(car.speed - other.speed);
      if (impact > 120 && G.time - car.crashAt > 0.4) {
        playCrash();
        car.crashAt = G.time;
        G.spawnBurst(car.x, car.y, '#ff6b5e', 6);
      }
      car.speed *= 0.82;
      other.speed *= 0.9;
    }
  }
}

export function carBounds(car) {
  return { w: CAR_LEN, h: CAR_WID };
}

export function spawnBurstInto(G, x, y, color, n) {
  for (let i = 0; i < n; i += 1) {
    const a = G.rng() * Math.PI * 2;
    const sp = range(G.rng, 30, 130);
    G.particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: range(G.rng, 0.3, 0.7), max: 0.7, color,
      size: rangeInt(G.rng, 2, 5),
    });
  }
}
