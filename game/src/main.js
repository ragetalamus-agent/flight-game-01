// Boot, the fixed-step loop and the screen flow for Tradewind Courier.
//
// The world advances in deterministic 1/60 s ticks no matter the display rate;
// input is sampled once per tick and the renderer paints the result. The game
// moves between title (mission select), play, paused, mission complete and
// crashed. ?seed=N fixes the archipelago; ?shot=<scene>&seed=N stages a single
// scene for the screenshot harness, paints it twice and raises __shotReady.
import * as THREE from 'three';
import { STEP, WORLD, FLIGHT, FUEL } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { buildPlane } from './plane.js';
import { createRenderer } from './render.js';
import { initialState, step, EVENTS, landingQuality } from './physics.js';
import { createInput } from './input.js';
import { MISSION_IDS, setupMission, objectiveText, stepMission, scoreMission } from './missions.js';
import { createHUD } from './hud.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const BEST_KEY = 'tradewind-courier-best';
const MAX_FRAME = 0.25;
const UP = new THREE.Vector3(0, 1, 0);
const FWD = new THREE.Vector3(1, 0, 0);
const LAT = new THREE.Vector3(0, 0, 1);
const QY = new THREE.Quaternion();
const QZ = new THREE.Quaternion();
const QX = new THREE.Quaternion();

const MISSION_LABEL = { ring: 'Ring Run', hop: 'Island Hop', courier: 'Courier' };

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : WORLD.seed;

// Make every source of randomness deterministic for this seed, so the clouds
// and ring animation the renderer builds are reproducible frame-to-frame.
Math.random = createRandom(seed ^ 0x9e3779b9).float;

const canvas = document.getElementById('game');
const hudCanvas = document.getElementById('hud');
const statusEl = document.getElementById('status');
const overlay = document.getElementById('overlay');

const world = createWorld(seed);
const renderer = createRenderer(canvas);
renderer.buildWorldMeshes(world);
// A soft ambient + fill from the chase-camera side so the aircraft reads clearly
// instead of being a backlit silhouette against the sun.
renderer.scene.add(new THREE.AmbientLight(0xffffff, 0.45));
const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
fillLight.position.set(-600, 400, -400);
renderer.scene.add(fillLight);
const plane = buildPlane();
renderer.scene.add(plane.group);
const hud = createHUD(hudCanvas);
const audio = createAudio();
const input = createInput(window);

const titleHTML = overlay ? overlay.innerHTML : '';

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}
function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage may be unavailable (private mode); the best then lasts this visit.
  }
}

let best = readBest();
let screen = 'title';
let state = initialState(world);
let mission = null;
let cameraMode = 'chase';
let accumulator = 0;
let last = performance.now();
let message = null;
let messageColor = null;
let messageTimer = 0;
let crashReason = '';

function announce(text) {
  if (statusEl) statusEl.textContent = text;
}

function setMessage(text, color, seconds) {
  message = text;
  messageColor = color || null;
  messageTimer = seconds || 1.4;
}

function applyPlaneTransform(s) {
  plane.group.position.set(s.x, s.y, s.z);
  QY.setFromAxisAngle(UP, -s.heading);
  QZ.setFromAxisAngle(LAT, s.pitch);
  QX.setFromAxisAngle(FWD, s.roll);
  plane.group.quaternion.copy(QY).multiply(QZ).multiply(QX);
  // Control-surface deflection for a visibly "flown" aircraft.
  const ail = plane.ailerons[0];
  if (ail) ail.rotation.x = (s.roll || 0) * 0.3;
  if (plane.ailerons[1]) plane.ailerons[1].rotation.x = -(s.roll || 0) * 0.3;
  if (plane.elevator) plane.elevator.rotation.z = (s.pitch || 0) * 0.3;
  if (plane.rudder) plane.rudder.rotation.y = 0;
  plane.propeller.rotation.x += 0.3 + (s.throttle || 0) * 0.9;
  for (const g of plane.gear) {
    const show = s.gear;
    g.strut.visible = show;
    g.wheel.visible = show;
  }
}

function showOverlay(html) {
  if (!overlay) return;
  overlay.innerHTML = html;
  overlay.style.display = 'flex';
}
function hideOverlay() {
  if (!overlay) return;
  overlay.style.display = 'none';
}

function wireTitle() {
  if (!overlay) return;
  for (const btn of overlay.querySelectorAll('[data-mission]')) {
    btn.addEventListener('click', () => {
      audio.init();
      audio.click();
      startMission(btn.getAttribute('data-mission'));
    });
  }
  const bestLine = overlay.querySelector('#best-line');
  if (bestLine) bestLine.textContent = String(best);
  const muteBtn = overlay.querySelector('[data-action="mute"]');
  if (muteBtn) {
    const sync = () => {
      const m = audio.isMuted();
      muteBtn.textContent = m ? 'Sound: off' : 'Sound: on';
      muteBtn.setAttribute('aria-pressed', m ? 'true' : 'false');
    };
    sync();
    muteBtn.addEventListener('click', () => {
      audio.init();
      audio.toggleMute();
      sync();
    });
  }
}

function startMission(id) {
  mission = setupMission(MISSION_IDS.includes(id) ? id : 'ring', world);
  state = initialState(world);
  accumulator = 0;
  message = null;
  messageTimer = 0;
  crashReason = '';
  screen = 'play';
  hideOverlay();
  announce(`Playing ${MISSION_LABEL[mission.id]}.`);
}

function finishMission() {
  screen = 'complete';
  const final = scoreMission(mission);
  if (final > best) {
    best = final;
    saveBest(best);
  }
  audio.init();
  audio.click();
  const rows = [
    ['Score', String(final)],
    ['Best', String(best)],
  ];
  const breakdown = rows.map(([k, v]) => `<div class="row"><span>${k}</span><b>${v}</b></div>`).join('');
  showOverlay(
    `<div class="panel"><h1>Mission Complete</h1><p class="sub">${MISSION_LABEL[mission.id]}</p>` +
      `${breakdown}<p class="hint">Press Space or click to return to the menu.</p>` +
      `<button class="primary" data-action="menu">Menu</button></div>`
  );
  wireMenuButton();
  announce(`Mission complete. Score ${final}. Best ${best}.`);
}

function crash(reason) {
  if (screen === 'crashed') return;
  screen = 'crashed';
  crashReason = reason || 'Aircraft lost.';
  const final = scoreMission(mission);
  if (final > best) {
    best = final;
    saveBest(best);
  }
  audio.crash();
  showOverlay(
    `<div class="panel"><h1>Crashed</h1><p class="sub">${crashReason}</p>` +
      `<div class="row"><span>Score</span><b>${final}</b></div>` +
      `<p class="hint">Press Space or click to try again.</p>` +
      `<button class="primary" data-action="retry">Retry</button> ` +
      `<button data-action="menu">Menu</button></div>`
  );
  wireMenuButton();
  announce(`Crashed. ${crashReason} Score ${final}.`);
}

function wireMenuButton() {
  if (!overlay) return;
  for (const btn of overlay.querySelectorAll('[data-action]')) {
    btn.addEventListener('click', () => {
      audio.init();
      audio.click();
      const action = btn.getAttribute('data-action');
      if (action === 'retry') startMission(mission ? mission.id : 'ring');
      else goTitle();
    });
  }
}

function goTitle() {
  screen = 'title';
  mission = null;
  state = initialState(world);
  message = null;
  messageTimer = 0;
  if (overlay) {
    overlay.innerHTML = titleHTML;
    overlay.style.display = 'flex';
  }
  wireTitle();
  announce('Title. Choose a mission.');
}

function togglePause() {
  if (screen === 'play') {
    screen = 'paused';
    showOverlay(
      `<div class="panel"><h1>Paused</h1><p class="hint">Press P or Space to resume.</p>` +
        `<button class="primary" data-action="resume">Resume</button> ` +
        `<button data-action="menu">Menu</button></div>`
    );
    wireMenuButton();
    announce('Paused.');
  } else if (screen === 'paused') {
    screen = 'play';
    hideOverlay();
    accumulator = 0;
    last = performance.now();
    announce('Playing.');
  }
}

function handleActions() {
  if (input.consume('mute')) audio.toggleMute();
  if (input.consume('camera')) cameraMode = cameraMode === 'chase' ? 'cockpit' : 'chase';
  if (input.consume('pause')) togglePause();
  if (input.consume('restart') && screen !== 'title') {
    if (mission) startMission(mission.id);
  }
  const confirm = input.consume('confirm');
  if (confirm) {
    audio.init();
    if (screen === 'paused') togglePause();
    else if (screen === 'complete' || screen === 'crashed') goTitle();
    else if (screen === 'title') startMission('ring');
  }
}

function handleEvents(events) {
  for (const e of events) {
    if (e === EVENTS.RING) {
      audio.ring();
      setMessage('RING', '#f2c94c', 1.1);
    } else if (e === EVENTS.LANDING) {
      audio.thud();
      setMessage('TOUCHDOWN', '#4cd07a', 1.1);
    } else if (e === EVENTS.HARD_LANDING) {
      setMessage('HARD LANDING', '#ff5a4d', 1.2);
    } else if (e === EVENTS.TERRAIN) {
      setMessage('TERRAIN STRIKE', '#ff5a4d', 1.2);
    } else if (e === EVENTS.OVERSPEED) {
      if (message !== 'OVERSPEED') setMessage('OVERSPEED', '#ff5a4d', 1.0);
    } else if (e === EVENTS.STALL) {
      if (message !== 'STALL') setMessage('STALL', '#ff5a4d', 0.6);
    } else if (e === EVENTS.ENGINE_OUT) {
      setMessage('ENGINE OUT — GLIDE', '#ff9f43', 2.0);
    } else if (e === EVENTS.TAKEOFF) {
      setMessage('AIRBORNE', '#4cd07a', 1.0);
    } else if (e === EVENTS.CRASH) {
      crash('The aircraft broke up.');
    }
  }
}

function stepPlay() {
  const res = step(state, input.inputState, STEP, world);
  state = res.state;
  const events = res.events.slice();
  mission = stepMission(mission, state, world, STEP, events);
  handleEvents(events);
  if (screen !== 'play') return;
  if (mission.done) {
    finishMission();
    return;
  }
  if (mission.failed) {
    crash(mission.id === 'courier' ? 'Out of time — cargo not delivered.' : 'Out of time.');
    return;
  }
  if (!state.alive) {
    crash('The aircraft was destroyed.');
  }
}

function currentView() {
  const warnings = {
    stall: state.speed < FLIGHT.stallSpeed && !state.onGround,
    lowFuel: state.fuel < FUEL.low,
    gear: state.gear,
  };
  return {
    state,
    objective: mission ? objectiveText(mission) : 'FREE FLIGHT',
    time: mission && mission.time != null ? mission.time : null,
    score: mission ? scoreMission(mission) : 0,
    best,
    warnings,
    message: messageTimer > 0 ? message : null,
    messageColor,
    cameraMode,
  };
}

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > MAX_FRAME) dt = MAX_FRAME;
  if (dt < 0) dt = 0;

  handleActions();

  if (screen === 'play') {
    accumulator += dt;
    let guard = 0;
    while (accumulator >= STEP && screen === 'play' && guard < 8) {
      stepPlay();
      accumulator -= STEP;
      guard += 1;
    }
  } else {
    accumulator = 0;
  }

  if (messageTimer > 0) {
    messageTimer -= dt;
    if (messageTimer <= 0) message = null;
  }

  applyPlaneTransform(state);
  audio.update(state);
  renderer.render({ planeGroup: plane.group, cameraMode, world, dt });

  if (screen === 'title') {
    hud.clear();
  } else {
    hud.draw(currentView());
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  state = scene.state;
  cameraMode = scene.cameraMode;
  screen = 'play';
  hideOverlay();
  applyPlaneTransform(state);
  let painted = 0;
  function paint() {
    renderer.render({ planeGroup: plane.group, cameraMode: scene.cameraMode, world, dt: 0 });
    hud.draw({
      state: scene.state,
      objective: scene.objective,
      time: scene.time,
      score: scene.score,
      best: scene.best,
      warnings: { stall: false, lowFuel: false, gear: scene.state.gear },
      message: scene.message,
      messageColor: null,
      cameraMode: scene.cameraMode,
    });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  hud.resize(w, h, Math.min(window.devicePixelRatio || 1, 2));
}
window.addEventListener('resize', onResize);

// Leaving the tab pauses a running game rather than flying it unseen.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && screen === 'play') {
    screen = 'paused';
    showOverlay(
      `<div class="panel"><h1>Paused</h1><p class="hint">Press P or Space to resume.</p>` +
        `<button class="primary" data-action="resume">Resume</button> ` +
        `<button data-action="menu">Menu</button></div>`
    );
    wireMenuButton();
    announce('Paused.');
  }
});

onResize();
wireTitle();
announce('Tradewind Courier. Choose a mission.');

// Read-only state probe for automated tests; only present with ?debug.
if (params.has('debug')) {
  window.__getState = () => ({
    x: state.x,
    y: state.y,
    z: state.z,
    speed: state.speed,
    throttle: state.throttle,
    pitch: state.pitch,
    fuel: state.fuel,
    alive: state.alive,
    screen,
  });
}

if (shotName) runShot(shotName);
else requestAnimationFrame(frame);