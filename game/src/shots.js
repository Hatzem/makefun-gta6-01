// Screenshot scenes behind ?shot=1|2|3|4 (with &seed=1). Each one plays
// the real game forward from a fresh city for a fixed number of steps,
// steered by a tiny autopilot, so the frame is what a short session of
// the game really looks like — and the same seed always gives the same
// frame. The scenes are:
//   1 — on foot downtown, HUD and minimap visible
//   2 — driving through traffic
//   3 — a police chase at three stars
//   4 — a delivery mission in progress

import { HORIZONTAL_STREETS, VERTICAL_STREETS, nearestStreetPoint } from './city.js';
import { enterCar, nearestCar } from './player.js';
import { startMission } from './missions.js';

const STEP = 1 / 60;

function driveToward(G, tx, ty, dt) {
  const p = G.player;
  if (!p.car) return;
  const car = p.car;
  // Route along streets, not straight through blocks: first along the
  // horizontal street the car starts on, then down the vertical street
  // nearest the target, then to the target itself.
  if (!G.shotRoute) {
    const startStreetY = nearestStreetPoint(car.x, car.y).y;
    const targetStreet = nearestStreetPoint(tx, ty);
    G.shotRoute = [
      { x: targetStreet.x, y: startStreetY },
      { x: targetStreet.x, y: targetStreet.y },
      { x: tx, y: ty },
    ];
    G.shotLeg = 0;
  }
  const wp = G.shotRoute[Math.min(G.shotLeg, G.shotRoute.length - 1)];
  const dx = wp.x - car.x;
  const dy = wp.y - car.y;
  if (Math.hypot(dx, dy) < 36 && G.shotLeg < G.shotRoute.length - 1) {
    G.shotLeg += 1;
    return;
  }
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = diff > 0.12 ? 1 : diff < -0.12 ? -1 : 0;
  // Brake into sharp corners so the car makes the turn instead of
  // sliding wide into the buildings.
  const sharp = Math.abs(diff) > 1.1;
  G.driveCar(dt, !sharp, sharp, steer);
}

function walkToward(G, tx, ty, dt) {
  const p = G.player;
  const dx = tx - p.x;
  const dy = ty - p.y;
  const len = Math.hypot(dx, dy) || 1;
  G.walkPlayer(dt, dx / len, dy / len);
}

export function stageShot(G, name) {
  const seconds = name === '1' ? 6 : name === '2' ? 6 : name === '3' ? 6 : 12;
  const total = Math.floor(seconds / STEP);

  if (name === '1') {
    // On foot in Neon Row: walk toward the nearest street corner.
    const tx = VERTICAL_STREETS[4];
    const ty = HORIZONTAL_STREETS[3];
    for (let i = 0; i < total; i += 1) {
      walkToward(G, tx, ty, STEP);
      G.stepWorld(STEP, true);
    }
    return;
  }

  // Shots 2–4 all start behind the wheel of a parked car.
  const car = nearestCar(G, 400);
  if (car) {
    const p = G.player;
    p.x = car.x + 30;
    p.y = car.y;
    enterCar(G, car);
  }

  if (name === '2') {
    const tx = VERTICAL_STREETS[7];
    const ty = HORIZONTAL_STREETS[5];
    for (let i = 0; i < total; i += 1) {
      driveToward(G, tx, ty, STEP);
      G.stepWorld(STEP, true);
    }
    return;
  }

  if (name === '3') {
    G.player.wanted = 3;
    G.player.lastCrimeAt = G.time;
    const tx = VERTICAL_STREETS[2];
    const ty = HORIZONTAL_STREETS[6];
    for (let i = 0; i < total; i += 1) {
      driveToward(G, tx, ty, STEP);
      G.stepWorld(STEP, true);
    }
    return;
  }

  // Shot 4: delivery mission, driving for the marker.
  startMission(G, 'delivery');
  const m = G.mission;
  for (let i = 0; i < total; i += 1) {
    driveToward(G, m.marker.x, m.marker.y, STEP);
    G.stepWorld(STEP, true);
  }
}
