// Mission logic for Tradewind Courier.
import { MISSIONS } from './config.js';

export const MISSION_IDS = ['ring', 'hop', 'courier'];

export function setupMission(id, world) {
  if (id === 'ring') {
    return { id, ringIndex: 0, rings: world.rings.slice(), score: 0, time: MISSIONS.ring.timeLimit, done: false, failed: false, landed: [] };
  }
  if (id === 'hop') {
    return { id, stopIndex: 0, targets: world.strips.slice(0, MISSIONS.hop.stops), score: 0, done: false, failed: false, landed: [] };
  }
  if (id === 'courier') {
    return { id, phase: 'pickup', score: 0, time: MISSIONS.courier.timeLimit, done: false, failed: false, cargo: false, delivered: false };
  }
  throw new Error('unknown mission ' + id);
}

export function objectiveText(m) {
  if (m.id === 'ring') return `Fly through ring ${m.ringIndex + 1} of ${m.rings.length}`;
  if (m.id === 'hop') return `Land on strip ${m.stopIndex + 1} of ${m.targets.length}`;
  if (m.id === 'courier') return m.phase === 'pickup' ? 'Pick up cargo at home strip' : 'Deliver cargo to far strip';
  return '';
}

export function stepMission(m, state, world, dt, events) {
  const mm = { ...m };
  if (mm.done || mm.failed) return mm;

  if (mm.id === 'ring') {
    mm.time -= dt;
    if (mm.time < 0) mm.time = 0;
    if (mm.time <= 0) { mm.failed = true; return mm; }
    const ring = mm.rings[mm.ringIndex];
    if (ring) {
      const d = Math.hypot(state.x - ring.position.x, state.z - ring.position.z);
      const dy = Math.abs(state.y - ring.position.y);
      if (d < ring.radius && dy < ring.radius) {
        mm.score += MISSIONS.ring.perRing;
        mm.ringIndex += 1;
        events.push('RING');
        if (mm.ringIndex >= mm.rings.length) {
          mm.score += Math.floor(mm.time * MISSIONS.ring.timeBonus);
          mm.done = true;
        }
      }
    }
    return mm;
  }

  if (mm.id === 'hop') {
    const target = mm.targets[mm.stopIndex];
    if (target && state.onGround && events.includes('LANDING')) {
      // check on runway near target
      const d = Math.hypot(state.x - target.position.x, state.z - target.position.z);
      if (d < target.length) {
        mm.score += MISSIONS.hop.perLanding;
        mm.landed.push(mm.stopIndex);
        mm.stopIndex += 1;
        if (mm.stopIndex >= mm.targets.length) mm.done = true;
      }
    }
    return mm;
  }

  if (mm.id === 'courier') {
    mm.time -= dt;
    if (mm.time <= 0 && !mm.delivered) { mm.failed = true; return mm; }
    if (mm.phase === 'pickup' && state.onGround) {
      const home = world.runway;
      const d = Math.hypot(state.x - home.position.x, state.z - home.position.z);
      if (d < home.length) { mm.cargo = true; mm.phase = 'deliver'; mm.score += MISSIONS.courier.pickupBonus; }
    }
    if (mm.phase === 'deliver' && state.onGround && mm.cargo) {
      const far = world.strips[world.strips.length - 1];
      const d = Math.hypot(state.x - far.position.x, state.z - far.position.z);
      if (d < far.length) {
        mm.delivered = true; mm.done = true; mm.score += MISSIONS.courier.deliveryBonus;
      }
    }
    return mm;
  }
  return mm;
}

export function scoreMission(m) {
  return m.score || 0;
}
