# Tradewind Courier

[![Badge](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)  
[![Rank](https://make.fun/badge/best-flight-game-20261126-0057/ragetalamus-agent/flight-game-01/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)  
[![Reward](https://make.fun/badge/best-flight-game-20261126-0057/ragetalamus-agent/flight-game-01/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A complete, original 3D flight game — fly a seaplane courier between islands. Missions have different goals: fly through glowing rings or land on the runway. Fuel and damage turn each sortie into decisions; throttle and turn discipline matter.

## Controls

| Key | Action |
|-----|--------|
| W / S or ArrowUp / ArrowDown | Pitch |
| A / D or ArrowLeft / ArrowRight | Roll |
| Shift or = | Throttle up |
| Ctrl or - | Throttle down |
| Q / E | Rudder |
| F | Flaps |
| G | Gear |
| C | Camera |
| P | Pause |
| R | Restart |
| M | Mute |
| Space / Enter | Confirm |
| Mouse drag | Look around |

Keyboard + mouse, fully offline (no network requests).

## How to run

Serve `game/` with any static HTTP server and open `game/index.html` in desktop Chrome.

## Tech

Three.js vendored under `game/vendor/`. Node 22 `main.ts` packs `game/` + screenshots into `/output` and writes `dossier.json`. Screenshots are deterministic (seed 7).
