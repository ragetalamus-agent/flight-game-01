// Archipelago world for Tradewind Courier.
//
// Seeded procedural terrain: one home island with a runway, four smaller
// islands each with a short strip, ocean, beaches and low hills. Everything is
// deterministic from the seed: island placement, runway/strip layout and ring
// course are all derived from the seeded RNG, and heightAt(x, z) is a pure
// function of the world coordinates.
import { createRandom } from './random.js';
import { WORLD } from './config.js';

const SEA = WORLD.seaLevel;

// Surface bands keyed to height, used for terrain colouring and for placing
// things on the ground.
const BEACH_MAX = 1.5;
const GRASS_MAX = 10;

// Deterministic hash noise in [0, 1) for hills and beach detail. Pure function
// of grid cell and seed, so heightAt(x, z) is reproducible.
function islandHash(nx, nz, seed) {
  let h = (nx * 73856093) ^ (nz * 19349663) ^ (seed | 0);
  h = (h ^ (h >>> 16)) * 0x45d9f3b;
  h = (h ^ (h >>> 16)) * 0x45d9f3b;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function surfaceType(h) {
  if (h < 0) return 'ocean';
  if (h < BEACH_MAX) return 'beach';
  if (h < GRASS_MAX) return 'grass';
  return 'rock';
}

export function createWorld(seed = WORLD.seed) {
  const random = createRandom(seed);
  const islands = [];
  const strips = [];

  // Home island at the origin.
  const home = {
    kind: 'home',
    center: { x: 0, z: 0 },
    radius: 460,
    peak: 80,
    beach: 3,
  };
  islands.push(home);

  // Four outlying islands scattered around the home island, each with a strip.
  const stripLen = WORLD.stripRunway.length;
  const stripWid = WORLD.stripRunway.width;
  for (let i = 0; i < WORLD.islandCount - 1; i += 1) {
    const angle = (i / (WORLD.islandCount - 1)) * Math.PI * 2 + 0.6;
    const dist = 700 + random.float() * 700;
    const radius = 140 + random.float() * 140;
    const peak = 20 + random.float() * 35;
    const cx = Math.cos(angle) * dist;
    const cz = Math.sin(angle) * dist;
    const island = {
      kind: 'strip',
      center: { x: cx, z: cz },
      radius,
      peak,
      beach: 2,
    };
    islands.push(island);
    strips.push({
      position: { x: cx, z: cz },
      heading: angle + Math.PI / 2,
      length: stripLen,
      width: stripWid,
    });
  }

  // Home runway aligned with the local x axis.
  const runway = {
    position: { x: 0, z: 0 },
    heading: 0,
    length: WORLD.homeRunway.length,
    width: WORLD.homeRunway.width,
  };

  // Glowing rings laid out along a flight path that visits the strips, so they
  // sit on sensible flight paths between islands.
  const rings = [];
  const ringRadius = WORLD.ringRadius;
  const ringAlt = WORLD.ringAltitude;
  const path = [home.center, ...strips.map((s) => s.position)];
  const segLen = [];
  let total = 0;
  for (let i = 1; i < path.length; i += 1) {
    const d = Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
    segLen.push(d);
    total += d;
  }
  for (let r = 1; r <= WORLD.ringCount; r += 1) {
    const target = (r / (WORLD.ringCount + 1)) * total;
    let acc = 0;
    let seg = 0;
    for (let i = 0; i < segLen.length; i += 1) {
      if (acc + segLen[i] >= target) {
        seg = i;
        break;
      }
      acc += segLen[i];
    }
    const a = path[seg];
    const b = path[seg + 1];
    const t = segLen[seg] === 0 ? 0 : (target - acc) / segLen[seg];
    const x = a.x + (b.x - a.x) * t + (random.float() - 0.5) * 22;
    const z = a.z + (b.z - a.z) * t + (random.float() - 0.5) * 22;
    rings.push({ position: { x, z, y: ringAlt }, radius: ringRadius });
  }

  // Height at any x/z. Ocean is flat at sea level; each island contributes a
  // smooth hill that falls to zero at its coastline, plus deterministic noise
  // for beaches and low hills. Pure function — no random stream at query time.
  function heightAt(x, z) {
    let h = SEA;
    for (const island of islands) {
      const dx = x - island.center.x;
      const dz = z - island.center.z;
      const d = Math.hypot(dx, dz);
      if (d >= island.radius) continue;
      const t = 1 - d / island.radius;
      let base = island.peak * t * t * t;
      const nx = Math.floor(x / 22);
      const nz = Math.floor(z / 22);
      base += island.peak * 0.12 * (islandHash(nx, nz, seed) - 0.5);
      base += island.peak * 0.08 * (islandHash(nx + 7, nz + 5, seed) - 0.5) * t;
      if (base > h) h = base;
    }
    return h;
  }

  return {
    seed,
    heightAt,
    surfaceType: (x, z) => surfaceType(heightAt(x, z)),
    seaLevel: SEA,
    ceiling: WORLD.ceiling,
    oceanSize: WORLD.oceanSize,
    runway,
    strips,
    rings,
    islands,
  };
}
