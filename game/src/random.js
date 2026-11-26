// Seeded pseudo-random generator (mulberry32). One integer seed always yields
// the same stream, which is what lets `?seed=N` rebuild an identical archipelago
// and makes screenshot staging reproducible.

function mulberry32(seed) {
  let state = seed | 0;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build a generator from an integer seed.
 *   float()        -> a number in [0, 1)
 *   int(min, max)  -> an integer in [min, max] inclusive
 *   pick(array)    -> a random element (undefined only for an empty array)
 */
export function createRandom(seed) {
  const next = mulberry32(seed);
  return {
    float: next,
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    pick(items) {
      if (!items || items.length === 0) return undefined;
      return items[Math.floor(next() * items.length)];
    },
    bool() {
      return next() < 0.5;
    },
  };
}