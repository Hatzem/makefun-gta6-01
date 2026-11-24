// Boot and the one loop for Sunset Harbor: input is read every frame,
// the world advances in fixed 1/60 s steps, and the renderer paints what
// is there. Screens: menu, play, paused, busted.
//
// ?seed=N fixes the city. ?shot=1|2|3|4 (with &seed=N) stages that scene
// instead of running the loop and sets window.__shotReady for a
// screenshot. ?test=1 runs the scripted play checks and writes them to
// #testlog and document.title.

import { makeRng } from './random.js';
import { buildCity } from './city.js';
import { createInput, PRESS_ENTER_CAR, PRESS_PAUSE, PRESS_RESTART, PRESS_START } from './input.js';
import { createPlayer, stepOnFoot, nearestCar, enterCar, exitCar, checkCarHitsPlayer } from './player.js';
import { spawnTraffic, spawnParked, stepTrafficCar, stepDrivenCar, spawnBurstInto } from './traffic.js';
import { spawnPeds, stepPeds, checkPedHits } from './pedestrians.js';
import { addWanted, updateWanted, updatePolice } from './police.js';
import { startMission, startFreeRoam, updateMission, updatePickups } from './missions.js';
import { drawGame, drawMenu, drawBusted, drawPaused } from './render.js';
import { stageShot } from './shots.js';
import { unlockAudio, setEngine, setSiren } from './audio.js';

const STEP = 1 / 60;
const SAVE_KEY = 'sunset-harbor-save-v1';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const testMode = params.get('test') === '1';
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const testEl = document.getElementById('testlog');

function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return { bestMoney: 0, totalEarned: 0, missionsDone: {} };
    const parsed = JSON.parse(raw);
    return {
      bestMoney: parsed.bestMoney || 0,
      totalEarned: parsed.totalEarned || 0,
      missionsDone: parsed.missionsDone || {},
    };
  } catch (err) {
    return { bestMoney: 0, totalEarned: 0, missionsDone: {} };
  }
}

function createGame() {
  const rng = makeRng(seed);
  const G = {
    rng,
    seed,
    time: 0,
    city: buildCity(rng),
    player: createPlayer(1300, 1040),
    traffic: [],
    parked: [],
    peds: [],
    police: [],
    pickups: [],
    particles: [],
    nextCarId: 1,
    mission: null,
    busted: null,
    flash: null,
    menuButtons: [],
    mouse: { x: 0, y: 0 },
    save: loadSave(),
  };
  G.addWanted = (stars, what) => addWanted(G, stars, what);
  G.flashMessage = (text) => { G.flash = { text, at: G.time }; };
  G.spawnBurst = (x, y, color, n) => spawnBurstInto(G, x, y, color, n);
  G.persistSave = () => {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(G.save));
    } catch (err) { /* storage off: the save lasts this visit only */ }
  };
  G.walkPlayer = (dt, nx, ny) => stepOnFoot(G, dt, nx, ny);
  G.driveCar = (dt, up, down, steer) => {
    if (G.player.car) stepDrivenCar(G, G.player.car, dt, up, down, steer);
  };
  G.stepWorld = (dt, harmless) => stepWorld(G, dt, harmless);
  spawnTraffic(G, 14);
  spawnParked(G, 10);
  spawnPeds(G, 22);
  return G;
}

function stepParticles(G, dt) {
  for (let i = G.particles.length - 1; i >= 0; i -= 1) {
    const pt = G.particles[i];
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    if (pt.life <= 0) G.particles.splice(i, 1);
  }
}

function stepWorld(G, dt, harmless) {
  G.time += dt;
  for (const car of G.traffic) stepTrafficCar(G, car, dt);
  stepPeds(G, dt, G.time);
  updateWanted(G, dt);
  updatePolice(G, dt, G.time);
  updateMission(G, dt, G.time);
  updatePickups(G, G.time);
  if (!harmless) {
    checkCarHitsPlayer(G, G.time);
    checkPedHits(G, G.time);
  }
  stepParticles(G, dt);
  // Slow health recovery when the player has been out of trouble a while.
  const p = G.player;
  if (p.health > 0 && p.health < 100 && G.time - p.hurtAt > 5) {
    p.health = Math.min(100, p.health + 2 * dt);
  }
}

function resize() {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(window.innerWidth * ratio);
  canvas.height = Math.round(window.innerHeight * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

const G = createGame();
window.__harbor = G;
const input = createInput(canvas);
let screen = 'menu';

function announce(message) {
  if (statusEl) statusEl.textContent = message;
}

function beginMission(id) {
  startMission(G, id);
  screen = 'play';
  announce('Mission started: ' + id);
}

function beginFreeRoam() {
  startFreeRoam(G);
  screen = 'play';
  announce('Free roam.');
}

function respawnAfterBust() {
  const fine = G.busted ? G.busted.fine : 150;
  G.player.money = Math.max(0, G.player.money - fine);
  G.player.health = 100;
  G.player.wanted = 0;
  G.player.bustTimer = 0;
  G.player.decayTimer = 0;
  if (G.player.car) {
    const idx = G.traffic.indexOf(G.player.car);
    if (idx >= 0) G.traffic.splice(idx, 1);
    G.player.car = null;
  }
  G.police.length = 0;
  G.mission = null;
  G.player.x = 1300;
  G.player.y = 1040;
  G.busted = null;
  screen = 'play';
  announce('Back on the street.');
}

function handleMenuInput(pressed, click) {
  if (pressed & PRESS_START) {
    // Digit keys pick a mission directly; anything else is free roam.
    const key = window.__lastKey;
    window.__lastKey = '';
    if (key === 'Digit1') beginMission('getaway');
    else if (key === 'Digit2') beginMission('delivery');
    else beginFreeRoam();
    return;
  }
  if (click) {
    for (const b of G.menuButtons) {
      if (click.x >= b.x && click.x <= b.x + b.w && click.y >= b.y && click.y <= b.y + b.h) {
        if (b.key === '1') beginMission('getaway');
        else if (b.key === '2') beginMission('delivery');
        else beginFreeRoam();
        return;
      }
    }
  }
}

function handlePlayInput(pressed) {
  if (pressed & PRESS_PAUSE) {
    screen = 'paused';
    announce('Paused.');
    return;
  }
  if (pressed & PRESS_ENTER_CAR) {
    if (G.player.car) exitCar(G);
    else {
      const car = nearestCar(G, 48);
      if (car) enterCar(G, car);
    }
  }
  if (pressed & PRESS_START) {
    const key = window.__lastKey;
    window.__lastKey = '';
    if (key === 'Digit1') beginMission('getaway');
    else if (key === 'Digit2') beginMission('delivery');
    else if (key === 'Digit3') beginFreeRoam();
  }
}

function stepPlay(dt) {
  const ix = input.axisX();
  const iy = input.axisY();
  if (G.player.car) {
    const up = iy < 0;
    const down = iy > 0;
    G.driveCar(dt, up, down, ix);
  } else {
    G.walkPlayer(dt, ix, iy);
  }
  stepWorld(G, dt);
  if (G.busted && screen === 'play') {
    screen = 'busted';
    announce('Busted. ' + G.busted.reason);
  }
  setEngine(G.player.car ? Math.abs(G.player.car.speed) / 430 : 0, !!G.player.car);
  setSiren(G.player.wanted > 0 && G.police.length > 0, dt);
}

function frame() {
  requestAnimationFrame(frame);
  G.mouse = input.mousePos();
  const pressed = input.takePressed();
  const click = input.takeClick();
  if (screen === 'menu') {
    handleMenuInput(pressed, click);
    stepWorld(G, STEP, true);
    drawMenu(ctx, G, window.innerWidth, window.innerHeight, G.time);
  } else if (screen === 'play') {
    handlePlayInput(pressed);
    stepPlay(STEP);
    drawGame(ctx, G, window.innerWidth, window.innerHeight, G.time);
  } else if (screen === 'paused') {
    if (pressed & PRESS_PAUSE) {
      screen = 'play';
      announce('Playing.');
    }
    drawGame(ctx, G, window.innerWidth, window.innerHeight, G.time);
    drawPaused(ctx, window.innerWidth, window.innerHeight);
  } else if (screen === 'busted') {
    if (pressed & PRESS_RESTART) respawnAfterBust();
    drawGame(ctx, G, window.innerWidth, window.innerHeight, G.time);
    drawBusted(ctx, G, window.innerWidth, window.innerHeight);
  }
}

// Remember which digit key started a mission (menu and in-play shortcuts).
window.addEventListener('keydown', (event) => {
  window.__lastKey = event.code;
  unlockAudio();
});
canvas.addEventListener('pointerdown', () => unlockAudio());
window.addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && screen === 'play') {
    screen = 'paused';
    announce('Paused.');
  }
});

function runShotMode() {
  screen = 'play';
  stageShot(G, shot);
  resize();
  // Keep repainting: a headless screenshot only captures a canvas that
  // the compositor has actually painted, and a single early draw can be
  // missed. The scene itself is staged and static, so every frame is
  // the same picture.
  function paint() {
    drawGame(ctx, G, window.innerWidth, window.innerHeight, G.time);
    requestAnimationFrame(paint);
  }
  requestAnimationFrame(paint);
  window.__shotReady = true;
}

function logTest(line) {
  if (testEl) testEl.textContent += line + '\n';
  // eslint-disable-next-line no-console
  console.log('[test] ' + line);
}

function runTests() {
  const results = [];
  function check(name, ok, detail) {
    results.push(name + ': ' + (ok ? 'PASS' : 'FAIL') + (detail ? ' — ' + detail : ''));
    logTest(results[results.length - 1]);
  }
  try {
    check('boot', !!G && !!G.city && G.city.buildings.length > 50, G.city.buildings.length + ' buildings');
    // 1. Walking moves the player.
    const x0 = G.player.x;
    const y0 = G.player.y;
    for (let i = 0; i < 60; i += 1) {
      G.walkPlayer(STEP, 1, 0);
      G.stepWorld(STEP);
    }
    check('walk', Math.abs(G.player.x - x0) > 100, 'moved ' + Math.round(G.player.x - x0) + 'px');
    // 2. Entering a parked car works and raises the wanted level.
    const parked = G.parked[0];
    G.player.x = parked.x + 20;
    G.player.y = parked.y;
    const wantedBefore = G.player.wanted;
    const entered = enterCar(G, parked);
    check('enter-car', entered && !!G.player.car, entered ? 'in car, wanted ' + wantedBefore + ' -> ' + G.player.wanted : 'no car entered');
    // 3. Driving builds speed.
    for (let i = 0; i < 120; i += 1) {
      G.driveCar(STEP, true, false, 0);
      G.stepWorld(STEP);
    }
    check('drive', Math.abs(G.player.car.speed) > 100, 'speed ' + Math.round(G.player.car.speed));
    // 4. Getaway mission completes at the marker.
    const moneyBefore = G.player.money;
    startMission(G, 'getaway');
    G.player.car.x = G.mission.marker.x;
    G.player.car.y = G.mission.marker.y;
    G.stepWorld(STEP);
    check('mission-getaway', G.mission.state === 'won', 'state=' + G.mission.state + ', money ' + moneyBefore + ' -> ' + G.player.money);
    // 5. Delivery mission starts hot and completes at the marker.
    startMission(G, 'delivery');
    const hot = G.player.wanted === 2;
    G.player.car.x = G.mission.marker.x;
    G.player.car.y = G.mission.marker.y;
    G.stepWorld(STEP);
    check('mission-delivery', hot && G.mission.state === 'won', 'hot=' + hot + ' state=' + G.mission.state);
    // 6. Police respond to three stars.
    G.player.wanted = 3;
    G.player.lastCrimeAt = G.time;
    for (let i = 0; i < 120; i += 1) G.stepWorld(STEP);
    check('police-chase', G.police.length >= 3, G.police.length + ' cruisers');
    // 7. A cash pickup pays out.
    const cashBefore = G.player.money;
    const pk = { x: G.player.car.x + 10, y: G.player.car.y, value: 25, bob: 0 };
    G.pickups.push(pk);
    G.stepWorld(STEP);
    check('pickup', G.player.money === cashBefore + 25, 'money ' + cashBefore + ' -> ' + G.player.money);
    // 8. Carjacking a moving car ejects its driver instead of crashing.
    const mover = G.traffic.find((c) => c.driver === 'traffic');
    const pedsBefore = G.peds.length;
    exitCar(G);
    G.player.x = mover.x + 20;
    G.player.y = mover.y;
    const jacked = enterCar(G, mover);
    check('carjack', jacked && !!G.player.car && G.peds.length === pedsBefore + 1, jacked ? 'driver fled on foot' : 'could not take the car');
  } catch (err) {
    check('exception', false, String(err && err.message ? err.message : err));
  }
  const failed = results.filter((r) => r.includes('FAIL')).length;
  document.title = failed === 0 ? 'TESTS PASS (' + results.length + '/' + results.length + ')' : 'TESTS FAIL: ' + failed;
  window.__testDone = true;
  window.__testResults = results;
}

window.addEventListener('error', (event) => {
  logTest('PAGE ERROR: ' + event.message);
});

resize();
if (shot) {
  runShotMode();
} else if (testMode) {
  resize();
  runTests();
  drawGame(ctx, G, window.innerWidth, window.innerHeight, G.time);
} else {
  announce('Sunset Harbor. Pick a job or take a free roam.');
  requestAnimationFrame(frame);
}
