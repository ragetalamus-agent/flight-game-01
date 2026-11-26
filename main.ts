// Tradewind Courier — make.fun entry packer.
//
// Node 22, standard library only. The playable game is the plain static
// folder `game/` sitting next to this file (an index.html plus ES modules and a
// vendored three.js, all offline). Packing does three things:
//   1. copies `game/` and `screenshots/` into MAKEFUN_OUTPUT_DIR (default
//      /output) so the grader has a single tidy tree,
//   2. writes `dossier.json` in that output, the summary the judge reads first,
//      built by the vendored make.fun library with the scorer's own caps.
//
// Usage (outside the grader's container, point the output somewhere writable):
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// Caps mirror the scorer's gate so a bad entry fails here, not at submission:
// text_max_bytes bounds dossier.json itself; screenshots max 4 and each <=256
// KiB; game/ <=993 files and <=48 MiB with every path <=1000 bytes.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
