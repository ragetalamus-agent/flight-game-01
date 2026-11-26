// Arcade flight model for Tradewind Courier. Pure functions, no DOM/three.
import { FLIGHT, FUEL, DAMAGE } from './config.js';

export const EVENTS = {
  STALL: 'STALL',
  CRASH: 'CRASH',
  HARD_LANDING: 'HARD_LANDING',
  TERRAIN: 'TERRAIN',
  OVERSPEED: 'OVERSPEED',
  ENGINE_OUT: 'ENGINE_OUT',
  RING: 'RING',
  LANDING: 'LANDING',
  TAKEOFF: 'TAKEOFF',
};

export function initialState(world) {
  const r = world.runway;
  return {
    x: r.position.x - r.length * 0.4,
    y: world.heightAt(r.position.x, r.position.z) + 4,
    z: r.position.z,
    heading: r.heading,
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    fuel: FUEL.capacity,
    damage: 0,
    gear: true,
    flaps: false,
    vs: 0,
    onGround: true,
    alive: true,
  };
}

function runwayAt(world, x, z) {
  const runways = [world.runway, ...world.strips];
  for (const rw of runways) {
    const dx = x - rw.position.x;
    const dz = z - rw.position.z;
    const c = Math.cos(-rw.heading);
    const s = Math.sin(-rw.heading);
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    if (Math.abs(lx) <= rw.length / 2 && Math.abs(lz) <= rw.width / 2) {
      return rw;
    }
  }
  return null;
}

function onRunway(world, x, z) {
  return runwayAt(world, x, z) !== null;
}

export function step(state, input, dt, world) {
  const s = { ...state };
  const ev = [];
  if (!s.alive) return { state: s, events: ev };

  // inputs
  const pitchIn = input.pitch || 0;
  const rollIn = input.roll || 0;
  const rudderIn = input.rudder || 0;
  const thrUp = input.throttleUp ? 1 : 0;
  const thrDown = input.throttleDown ? 1 : 0;
  if (thrUp) s.throttle = Math.min(1, s.throttle + 0.5 * dt);
  if (thrDown) s.throttle = Math.max(0, s.throttle - 0.5 * dt);
  if (input.flapsToggle) s.flaps = !s.flaps;
  if (input.gearToggle) s.gear = !s.gear;

  const engineOut = s.fuel <= 0;
  if (engineOut && s.throttle > 0) { s.throttle = 0; ev.push(EVENTS.ENGINE_OUT); }

  const targetSpeed = engineOut ? 0 : FLIGHT.minSpeed + (FLIGHT.maxSpeed - FLIGHT.minSpeed) * s.throttle;
  let accel = (targetSpeed - s.speed) * (FLIGHT.accel * dt);
  accel -= FLIGHT.drag * s.speed * dt * 0.5;
  if (s.flaps) accel -= FLIGHT.flapDrag * dt * 4;
  s.speed += accel;
  s.speed = Math.max(0, Math.min(FLIGHT.maxSpeed + 10, s.speed));

  // fuel drain
  const burn = FUEL.idleBurn + (FUEL.fullBurn - FUEL.idleBurn) * s.throttle;
  s.fuel = Math.max(0, s.fuel - burn * dt);
  if (s.fuel === 0 && state.fuel > 0) ev.push(EVENTS.ENGINE_OUT);

  // stall
  const stall = s.speed < FLIGHT.stallSpeed;
  const auth = stall ? FLIGHT.pitchAuthority * 0.4 : Math.min(1, s.speed / (FLIGHT.stallSpeed * 1.6)) * 0.55 + 0.45;
  const pitchAuth = auth;
  const rollAuth = auth;

  // terrain height
  const terrainH = world.heightAt(s.x, s.z);
  const onGround = s.y <= terrainH + 0.5;
  // on runway overrides

  // controls -> pitch/roll rates
  const pitchRate = FLIGHT.pitchRate * pitchAuth;
  const rollRate = FLIGHT.rollRate * rollAuth;
  s.pitch += pitchIn * pitchRate * dt;
  s.roll += rollIn * rollRate * dt;
  s.roll = Math.max(-1.2, Math.min(1.2, s.roll));
  s.pitch = Math.max(-1.0, Math.min(1.0, s.pitch));
  // rudder yaw
  s.heading += (rudderIn * FLIGHT.yawRate + Math.sin(s.roll) * 0.6) * dt;

  // stall nose drop
  if (stall) {
    s.pitch -= FLIGHT.stallSink * 0.02 * dt * 60;
    ev.push(EVENTS.STALL);
  }

  // vertical speed / lift
  const lift = (s.speed / FLIGHT.maxSpeed) * FLIGHT.liftFactor * (1 + (s.flaps ? FLIGHT.flapLift - 1 : 0));
  const vsTarget = (s.pitch * 8 - FLIGHT.gravity * 0.3) + (onGround ? 0 : 0);
  // gravity
  let vs = s.vs;
  vs += (-FLIGHT.gravity + lift * FLIGHT.gravity) * dt;
  if (stall) vs -= FLIGHT.stallSink * dt;
  // pitch contributes climb
  vs += s.pitch * 6 * dt;
  s.vs = vs;

  // position update
  const fwd = s.speed;
  s.x += Math.cos(s.heading) * Math.cos(s.pitch) * fwd * dt;
  s.z += Math.sin(s.heading) * Math.cos(s.pitch) * fwd * dt;
  s.y += s.vs * dt;

  // ground collision
  const groundH = world.heightAt(s.x, s.z);
  if (s.y < groundH) {
    // landing attempt
    const sink = -s.vs;
    const rw = runwayAt(world, s.x, s.z);
    const onRw = rw !== null;
    // damage
    if (sink > FLIGHT.crashSink) {
      s.damage = 100; s.alive = false; ev.push(EVENTS.CRASH);
    } else {
      if (sink > FLIGHT.hardLanding) { s.damage = Math.min(100, s.damage + DAMAGE.hardLandingHit); ev.push(EVENTS.HARD_LANDING); }
      if (!onRw) { s.damage = Math.min(100, s.damage + DAMAGE.terrainHit); ev.push(EVENTS.TERRAIN); }
      // landing quality event
      ev.push(EVENTS.LANDING);
    }
    s.y = groundH;
    s.vs = 0;
    s.onGround = true;
    // refuel if on strip/runway
    if (onRw) s.fuel = FUEL.capacity;
    // reset speeds for landing
    s.speed *= 0.6;
  } else {
    s.onGround = false;
  }

  // overspeed in dive
  if (s.speed > FLIGHT.overspeedDive && s.pitch < -0.3) {
    s.damage = Math.min(100, s.damage + DAMAGE.overspeedHit * dt * 60);
    ev.push(EVENTS.OVERSPEED);
  }
  if (s.damage >= 100 && s.alive) { s.alive = false; ev.push(EVENTS.CRASH); }

  // takeoff detection: if on ground and speed high enough, lift off
  if (s.onGround && s.speed > FLIGHT.stallSpeed * 1.1) {
    // allow liftoff
    s.onGround = false;
    s.y += 0.5;
    ev.push(EVENTS.TAKEOFF);
  }

  // clamp y
  s.y = Math.max(groundH, Math.min(world.ceiling, s.y));

  // heading normalize
  while (s.heading > Math.PI) s.heading -= Math.PI * 2;
  while (s.heading < -Math.PI) s.heading += Math.PI * 2;

  return { state: s, events: ev };
}

export function landingQuality(state, world) {
  const rw = runwayAt(world, state.x, state.z);
  if (!rw) return null;
  const dx = state.x - rw.position.x;
  const dz = state.z - rw.position.z;
  const c = Math.cos(-rw.heading); const ss = Math.sin(-rw.heading);
  const lz = dx * ss + dz * c;
  return { onRunway: true, centerlineOffset: lz, speed: state.speed };
}
