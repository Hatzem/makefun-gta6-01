// Pedestrians: people walking the pavements of Sunset Harbor. They stroll
// along the sidewalk edge of a street, turn at corners, and run when a car
// bears down on them or a crime happens nearby.

import { HORIZONTAL_STREETS, VERTICAL_STREETS, clampToWorld, onRoad, randomRoadPoint } from './city.js';
import { chance, pick, range } from './random.js';

const SHIRTS = ['#e84c3d', '#f2c94c', '#4f8fd0', '#7bc96f', '#ff8a3d', '#b678ff', '#e8e8e8', '#37c8e8'];

export function makePed(rng, x, y) {
  const onVertical = VERTICAL_STREETS.some((cx) => Math.abs(x - cx) < 30);
  return {
    x, y, r: 8,
    angle: pick(rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]),
    speed: range(rng, 28, 52),
    shirt: pick(rng, SHIRTS),
    axis: onVertical ? 'v' : 'h',
    fleeing: false,
    fleeUntil: 0,
    turnIn: range(rng, 2, 6),
  };
}

export function spawnPeds(G, count) {
  for (let i = 0; i < count; i += 1) {
    const pt = randomRoadPoint(G.rng);
    // Step off the asphalt onto the pavement beside the street.
    const ped = makePed(G.rng, pt.x + 30, pt.y + 30);
    G.peds.push(ped);
  }
}

export function stepPed(G, ped, dt, now) {
  if (ped.fleeing && now > ped.fleeUntil) ped.fleeing = false;
  const speed = ped.fleeing ? ped.speed * 3.2 : ped.speed;
  ped.turnIn -= dt;
  if (ped.turnIn <= 0) {
    ped.turnIn = range(G.rng, 2, 7);
    if (!ped.fleeing && chance(G.rng, 0.5)) {
      ped.angle += chance(G.rng, 0.5) ? Math.PI / 2 : -Math.PI / 2;
    }
  }
  ped.x += Math.cos(ped.angle) * speed * dt;
  ped.y += Math.sin(ped.angle) * speed * dt;

  // Stay on the pavements: if we wandered onto the road, turn back.
  if (onRoad(ped.x, ped.y)) {
    ped.angle += Math.PI / 2;
    ped.x += Math.cos(ped.angle) * speed * dt;
    ped.y += Math.sin(ped.angle) * speed * dt;
  }
  clampToWorld(ped, 12);
}

export function stepPeds(G, dt, now) {
  const px = G.player.car ? G.player.car.x : G.player.x;
  const py = G.player.car ? G.player.car.y : G.player.y;
  const playerFast = G.player.car && Math.abs(G.player.car.speed) > 200;
  for (const ped of G.peds) {
    const d = Math.hypot(ped.x - px, ped.y - py);
    if (d < 130 && (playerFast || G.player.wanted > 0)) {
      if (!ped.fleeing) {
        ped.fleeing = true;
        ped.fleeUntil = now + 3;
        ped.angle = Math.atan2(ped.y - py, ped.x - px);
      }
    }
    stepPed(G, ped, dt, now);
  }
}

// A driven car ran a pedestrian over: that is a serious crime.
export function checkPedHits(G, now) {
  const p = G.player;
  if (!p.car) return;
  const car = p.car;
  if (Math.abs(car.speed) < 60) return;
  for (const ped of G.peds) {
    if (ped.fleeing && now < ped.fleeUntil + 1) continue;
    const d = Math.hypot(ped.x - car.x, ped.y - car.y);
    if (d < 26) {
      ped.fleeing = true;
      ped.fleeUntil = now + 4;
      ped.angle = Math.atan2(ped.y - car.y, ped.x - car.x);
      G.addWanted(2, 'Hit and run');
      G.spawnBurst(ped.x, ped.y, '#ff6b5e', 8);
    }
  }
}
