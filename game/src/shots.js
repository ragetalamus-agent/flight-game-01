// Screenshot staging for ?shot=cover|rings|land|cockpit.
//
// Each scene builds a fresh world from the seed, takes the real flight model
// (physics.step) and flies it forward for a fixed number of 1/60 s ticks under a
// small autopilot that steers toward the next ring or the runway. Because the
// world is seeded and the autopilot is a pure function of the state, the same
// seed always produces the same frame — which is what the screenshot harness
// relies on. Nothing here is drawn; it returns the state and a few HUD fields
// for main.js to render.
import { STEP, FLIGHT } from './config.js';
import { initialState, step } from './physics.js';

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Proportional autopilot: bank toward the target's bearing, pitch to hold the
// target's altitude (damped by vertical speed), and hold a throttle setting.
function steer(state, target, throttle) {
  const desired = Math.atan2(target.z - state.z, target.x - state.x);
  const err = wrapAngle(desired - state.heading);
  const roll = clamp(err * 1.6, -1, 1);
  const dy = target.y - state.y;
  // Clamp the nose-down limit so a fast plane never dives into overspeed damage.
  const pitch = clamp(dy * 0.015 - state.vs * 0.06, -0.2, 1);
  return {
    pitch,
    roll,
    rudder: 0,
    throttleUp: state.throttle < throttle - 0.02,
    throttleDown: state.throttle > throttle + 0.02,
    flapsToggle: false,
    gearToggle: false,
  };
}

// Fly `seconds` worth of ticks from `state`, steering toward `target` each tick.
// Returns the final state. `stop` (optional) halts early when it returns true.
function fly(state, target, throttle, seconds, world, stop) {
  const ticks = Math.round(seconds / STEP);
  let s = state;
  for (let i = 0; i < ticks; i += 1) {
    const input = steer(s, target, throttle);
    const res = step(s, input, STEP, world);
    s = res.state;
    if (!s.alive) break;
    if (stop && stop(s)) break;
  }
  return s;
}

// A point on final approach to the home runway, lined up with its heading and
// out over the water so the low, slow frame stays clear of the island's hills.
function approachState(world, altitude, speed, throttle) {
  const r = world.runway;
  const s = initialState(world);
  const back = 520;
  s.x = r.position.x - Math.cos(r.heading) * back;
  s.z = r.position.z - Math.sin(r.heading) * back;
  s.y = altitude;
  s.heading = r.heading;
  s.speed = speed;
  s.throttle = throttle;
  s.gear = true;
  s.flaps = true;
  s.vs = -1.0;
  s.onGround = false;
  return s;
}

/**
 * Stage the named scene and return what main.js needs to paint it:
 *   { state, cameraMode, objective, time, score, best, message }
 * Any unknown name falls back to the cover scene.
 */
export function stageShot(name, world) {
  const scene = name === 'rings' || name === 'land' || name === 'cockpit' ? name : 'cover';

  if (scene === 'cover') {
    // Low pass over the home strip with a slight bank so the wing catches the
    // light and the aircraft reads as a plane, not a pillar. Target is offset
    // to the right so the autopilot banks naturally toward it. The runway strip
    // (grey) sits ahead with ocean/islands around it.
    const r = world.runway;
    const start = initialState(world);
    const back = 300;
    start.x = r.position.x - Math.cos(r.heading) * back;
    start.z = r.position.z - Math.sin(r.heading) * back;
    start.y = 46;
    start.heading = r.heading;
    start.speed = 112;
    start.throttle = 1;
    start.gear = false;
    start.flaps = false;
    start.vs = 0;
    start.onGround = false;
    // Target offset to the right of the runway centerline -> natural right bank.
    const target = {
      x: r.position.x + Math.cos(r.heading) * 600,
      y: 46,
      z: r.position.z + Math.sin(r.heading) * 600 + 180,
    };
    const s = fly(start, target, 1, 1.5, world);
    return {
      state: s,
      cameraMode: 'chase',
      objective: 'FREE FLIGHT',
      time: null,
      score: 0,
      best: 0,
      message: null,
    };
  }

  if (scene === 'rings') {
    // Fly the ring course until a glowing ring is close ahead. Full throttle
    // holds altitude; the pitch clamp keeps the fast plane out of overspeed.
    const start = initialState(world);
    start.throttle = 1;
    const ring = world.rings[1] || world.rings[0];
    const target = { x: ring.position.x, y: ring.position.y, z: ring.position.z };
    const s = fly(start, target, 1, 16, world, (st) => {
      const d = Math.hypot(st.x - ring.position.x, st.z - ring.position.z);
      return d < ring.radius * 1.6;
    });
    return {
      state: s,
      cameraMode: 'chase',
      objective: `RING RUN — ring 1 of ${world.rings.length}`,
      time: 96,
      score: 0,
      best: 0,
      message: null,
    };
  }

  // land: gear-down, flaps-out final approach aligned with the home runway
  // strip, low enough that the grey strip fills the center ahead unmistakably.
  if (scene === 'land') {
    const r = world.runway;
    const start = approachState(world, 40, 65, 0.45);
    // Start close (200 back) at low altitude so the strip fills the frame.
    start.x = r.position.x - Math.cos(r.heading) * 200;
    start.z = r.position.z - Math.sin(r.heading) * 200;
    const target = {
      x: r.position.x,
      y: 8,
      z: r.position.z,
    };
    const s = fly(start, target, 0.45, 1.5, world);
    return {
      state: s,
      cameraMode: 'chase',
      objective: 'FINAL APPROACH',
      time: null,
      score: 0,
      best: 0,
      message: null,
    };
  }

  // cockpit: use the same stabilized approach as the landing shot (proven to
// show the runway strip clearly) but with cockpit camera. The grey strip
// fills the center ahead, with ocean/islands context.
  if (scene === 'cockpit') {
    const r = world.runway;
    const start = approachState(world, 40, 65, 0.45);
    // Same as landing: start 200 back at 40 ft.
    start.x = r.position.x - Math.cos(r.heading) * 200;
    start.z = r.position.z - Math.sin(r.heading) * 200;
    const target = {
      x: r.position.x,
      y: 8,
      z: r.position.z,
    };
    const s = fly(start, target, 0.45, 1.5, world);
    return {
      state: s,
      cameraMode: 'cockpit',
      objective: 'FINAL APPROACH',
      time: null,
      score: 0,
      best: 0,
      message: null,
    };
  }
}