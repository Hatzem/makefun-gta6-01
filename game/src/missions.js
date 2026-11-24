// Missions and free-roam goals for Sunset Harbor. Each mission names a
// target marker across town, a clock, and a payout; the tracker reports
// progress, win and fail so the HUD and the end screens can show it.

import { randomRoadPoint } from './city.js';
import { playerPos } from './player.js';
import { playCash, playWin } from './audio.js';

export const MISSIONS = [
  {
    id: 'getaway',
    name: 'Getaway',
    short: 'Steal a car, reach the green marker in 90s.',
    brief: 'The crew needs wheels and a driver. Take any car, then get to the green marker before the clock runs out.',
    time: 90,
    reward: 500,
    startWanted: 0,
  },
  {
    id: 'delivery',
    name: 'Hot Delivery',
    short: 'Deliver the package across town in 120s — the cops are already on you.',
    brief: 'A package for the Harborlight docks, and the Harbor PD got tipped off. Two stars from the start. Lose them or outrun them.',
    time: 120,
    reward: 800,
    startWanted: 2,
  },
];

export function startMission(G, id) {
  const def = MISSIONS.find((m) => m.id === id);
  if (!def) return null;
  const pos = playerPos(G.player);
  let marker = randomRoadPoint(G.rng);
  let tries = 0;
  while (Math.hypot(marker.x - pos.x, marker.y - pos.y) < 900 && tries < 20) {
    marker = randomRoadPoint(G.rng);
    tries += 1;
  }
  G.mission = {
    def,
    marker,
    timeLeft: def.time,
    state: 'active',   // active | won | failed
    banner: null,
    bannerAt: 0,
  };
  if (def.startWanted > 0) {
    G.player.wanted = def.startWanted;
    G.player.lastCrimeAt = G.time;
  }
  G.flashMessage(def.name + ' — ' + def.short);
  return G.mission;
}

export function startFreeRoam(G) {
  G.mission = null;
  G.flashMessage('Free roam — explore Sunset Harbor, grab cash, stay out of trouble.');
  spawnPickups(G, 6);
}

export function spawnPickups(G, count) {
  for (let i = 0; i < count; i += 1) {
    const pt = randomRoadPoint(G.rng);
    G.pickups.push({
      x: pt.x + 26, y: pt.y + 26,
      value: 25, bob: G.rng() * Math.PI * 2,
    });
  }
}

export function updateMission(G, dt, now) {
  const m = G.mission;
  if (!m || m.state !== 'active') return;
  m.timeLeft -= dt;
  const pos = playerPos(G.player);
  const d = Math.hypot(m.marker.x - pos.x, m.marker.y - pos.y);
  const inCar = !!G.player.car;
  if (d < 52 && inCar) {
    m.state = 'won';
    m.banner = 'MISSION COMPLETE — ' + m.def.name + '  +$' + m.def.reward;
    m.bannerAt = now;
    G.player.money += m.def.reward;
    G.save.bestMoney = Math.max(G.save.bestMoney, G.player.money);
    G.save.missionsDone[m.def.id] = true;
    G.save.totalEarned += m.def.reward;
    G.persistSave();
    playWin();
    return;
  }
  if (m.timeLeft <= 0) {
    m.state = 'failed';
    m.banner = 'MISSION FAILED — ' + m.def.name + ' (out of time)';
    m.bannerAt = now;
  }
  if (G.busted) {
    m.state = 'failed';
    m.banner = 'MISSION FAILED — busted';
    m.bannerAt = now;
  }
}

export function updatePickups(G, now) {
  const p = G.player;
  const pos = playerPos(p);
  for (let i = G.pickups.length - 1; i >= 0; i -= 1) {
    const pk = G.pickups[i];
    pk.bob += 0.05;
    if (Math.hypot(pk.x - pos.x, pk.y - pos.y) < 34) {
      G.pickups.splice(i, 1);
      p.money += pk.value;
      G.save.bestMoney = Math.max(G.save.bestMoney, p.money);
      G.save.totalEarned += pk.value;
      G.persistSave();
      playCash();
      G.spawnBurst(pk.x, pk.y, '#ffd23d', 10);
      G.flashMessage('+$' + pk.value);
    }
  }
  if (G.pickups.length < 3 && !G.mission) spawnPickups(G, 3);
}

export function missionObjective(G) {
  const m = G.mission;
  if (!m) return 'Free roam — find cash pickups ($) around the city.';
  if (m.state === 'won') return m.banner;
  if (m.state === 'failed') return m.banner;
  const need = G.player.car ? 'Drive to the green marker' : 'Get in a car first (E near a car)';
  return m.def.name + ': ' + need + ' — ' + Math.ceil(m.timeLeft) + 's left';
}
