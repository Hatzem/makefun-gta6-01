# Sunset Harbor — an open-world getaway

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Hatzem/makefun-gta6-01/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Hatzem/makefun-gta6-01/reward.svg)](https://make.fun/c/gta6-01)

A 2D top-down open-world crime game that runs entirely from static files — no build step, no network. Built for the make.fun **gta6-01** competition.

## The city

Sunset Harbor is a seeded grid city that is the same on every load: five districts (Cedar Heights, Old Mill Row, Neon Row, Juniper Docks, Harborlight), streets full of traffic, pedestrians on the pavements, and parked cars waiting to be taken.

## How to play

Open `game/index.html` in a desktop browser (or serve `game/` with any static server, e.g. `node serve.ts` and visit http://localhost:8080).

- **WASD / arrows** — walk, and drive once you are in a car
- **E** — enter or leave a car (taking one is a crime)
- **1** — Getaway mission: steal a car, reach the green marker in 90s ($500)
- **2** — Hot Delivery: across town in 120s with two wanted stars already on you ($800)
- **3** — Free roam: explore, grab cash pickups, stay clean
- **P** — pause, **R** — get back on the street after being busted

Crimes raise your wanted level (0–5 stars). The Harbor PD sends cruisers that chase, ram, and bust a slow driver. Stay quiet and out of sight and the heat dies down. Money and finished missions are saved in your browser.

## Sound

All sound is synthesized with WebAudio — engine hum, sirens, pickups, crashes. No audio files.

## Layout

- `game/index.html` — the page
- `game/src/city.js` — the seeded city (streets, blocks, districts)
- `game/src/player.js` — walking, entering and leaving cars
- `game/src/traffic.js` — traffic cars, parked cars, driving physics
- `game/src/pedestrians.js` — people on the pavements
- `game/src/police.js` — wanted level and police chases
- `game/src/missions.js` — the two missions, pickups, rewards
- `game/src/minimap.js` — the live minimap
- `game/src/render.js` — drawing the city, cars, HUD, menus
- `game/src/audio.js` — synthesized WebAudio sounds
- `game/src/input.js` — keyboard and mouse
- `game/src/shots.js` — the four screenshot scenes (`?shot=1..4`)
- `game/src/main.js` — boot, game loop, save, scripted tests (`?test=1`)
- `main.ts` — the make.fun entrypoint: copies `game/` + `screenshots/` to `/output` and writes `dossier.json`

Everything in this game — city, names, story, art, sounds — is original. Nothing is taken from any commercial game.
