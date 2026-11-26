// Central tuning table for Tradewind Courier. Every magic number the flight
// model, the world generator, missions and HUD care about lives here so the rest
// of the code reads like prose. Distances are world units, speeds are world
// units/second unless a name says otherwise, angles are radians.

// Fixed simulation step: the world advances 1/60 s per tick no matter the
// display refresh rate, which keeps physics and replays deterministic.
export const STEP = 1 / 60;

// --- Flight model -----------------------------------------------------------
export const FLIGHT = {
  // Airspeed the engine can reach at full throttle, and the idle floor.
  maxSpeed: 120,
  minSpeed: 18,
  // How quickly airspeed chases the throttle target (per second).
  accel: 28,
  drag: 0.9,
  // Control authority scales with how fast air is flowing over the surfaces.
  pitchRate: 1.4,
  rollRate: 2.6,
  yawRate: 0.7,
  pitchAuthority: 0.55, // fraction of full authority at the stall speed
  // Below this airspeed the wing stops flying: nose drops, controls go soft.
  stallSpeed: 34,
  stallSink: 22,
  // Vertical motion from lift vs gravity, tuned for arcade feel.
  gravity: 32,
  liftFactor: 0.9,
  // Flaps add lift and drag for slow, steep approaches.
  flapLift: 1.25,
  flapDrag: 1.6,
  // Hard-landing and crash thresholds (vertical speed at touchdown).
  hardLanding: 9,
  crashSink: 22,
  overspeedDive: 95,
};

// --- Fuel -------------------------------------------------------------------
export const FUEL = {
  capacity: 100,
  // Units burned per second at idle and at full throttle.
  idleBurn: 0.6,
  fullBurn: 3.4,
  low: 20, // LOW FUEL warning threshold
};

// --- Damage -----------------------------------------------------------------
export const DAMAGE = {
  max: 100,
  terrainHit: 60,
  hardLandingHit: 22,
  overspeedHit: 8,
  // Landing quality scoring windows (vertical speed at touchdown).
  perfectSink: 3,
  goodSink: 6,
};

// --- World ------------------------------------------------------------------
export const WORLD = {
  seed: 7,
  oceanSize: 4000,
  // Home island plus four outlying strips.
  islandCount: 5,
  homeRunway: { length: 320, width: 40 },
  stripRunway: { length: 220, width: 30 },
  // Ring course for the RING RUN mission.
  ringCount: 6,
  ringRadius: 34,
  ringAltitude: 90,
  // Flight ceiling / floor the world clamps to.
  ceiling: 600,
  seaLevel: 0,
};

// --- Missions ---------------------------------------------------------------
export const MISSIONS = {
  ring: { timeLimit: 120, perRing: 100, timeBonus: 5 },
  hop: { stops: 3, perLanding: 250, alignmentBonus: 100 },
  courier: { timeLimit: 180, pickupBonus: 50, deliveryBonus: 500 },
};

// --- Presentation -----------------------------------------------------------
export const PALETTE = {
  sky: '#8fc7e8',
  horizon: '#dfeef7',
  ocean: '#2b6f8f',
  sand: '#e7d6a8',
  grass: '#5f9e52',
  rock: '#7b7f86',
  cloud: '#ffffff',
  plane: '#d94f3d',
  accent: '#f2c94c',
  hud: '#eaf6ff',
  hudDim: '#7fa8c0',
  warn: '#ff5a4d',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
