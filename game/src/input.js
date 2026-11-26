// Keyboard + mouse input for Tradewind Courier.
export function createInput(target = (typeof window !== 'undefined' ? window : null)) {
  const keys = {};
  const pressed = new Set();
  const oneShot = { confirm: false, pause: false, restart: false, camera: false, mute: false, flaps: false, gear: false };
  let mouseDx = 0, mouseDy = 0;
  let dragging = false;
  let lastX = 0, lastY = 0;

  const GAME_KEYS = new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Enter','KeyW','KeyS','KeyA','KeyD','ShiftLeft','ShiftRight','ControlLeft','ControlRight','Equal','Minus','KeyQ','KeyE','KeyF','KeyG','KeyC','KeyP','KeyR','KeyM']);

  function keydown(e) {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    keys[e.code] = true;
    if (e.code === 'Space' || e.code === 'Enter') oneShot.confirm = true;
    if (e.code === 'KeyP') oneShot.pause = true;
    if (e.code === 'KeyR') oneShot.restart = true;
    if (e.code === 'KeyC') oneShot.camera = true;
    if (e.code === 'KeyM') oneShot.mute = true;
    if (e.code === 'KeyF') oneShot.flaps = true;
    if (e.code === 'KeyG') oneShot.gear = true;
  }
  function keyup(e) {
    keys[e.code] = false;
  }
  function blur() {
    for (const k in keys) keys[k] = false;
  }
  function mousedown(e) { dragging = true; lastX = e.clientX; lastY = e.clientY; }
  function mousemove(e) {
    if (!dragging) return;
    mouseDx += e.clientX - lastX;
    mouseDy += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
  }
  function mouseup() { dragging = false; }

  if (target) {
    target.addEventListener('keydown', keydown);
    target.addEventListener('keyup', keyup);
    target.addEventListener('blur', blur);
    if (target.addEventListener) {
      target.addEventListener('mousedown', mousedown);
      target.addEventListener('mousemove', mousemove);
      target.addEventListener('mouseup', mouseup);
    }
  }

  function consume(name) { const v = oneShot[name]; oneShot[name] = false; return v; }

  return {
    keys,
    isDown(code) { return !!keys[code]; },
    get inputState() {
      return {
        pitch: (keys['KeyW']||keys['ArrowUp'] ? -1 : 0) + (keys['KeyS']||keys['ArrowDown'] ? 1 : 0),
        roll: (keys['KeyA']||keys['ArrowLeft'] ? -1 : 0) + (keys['KeyD']||keys['ArrowRight'] ? 1 : 0),
        throttleUp: !!(keys['ShiftLeft']||keys['ShiftRight']||keys['Equal']),
        throttleDown: !!(keys['ControlLeft']||keys['ControlRight']||keys['Minus']),
        rudder: (keys['KeyQ'] ? -1 : 0) + (keys['KeyE'] ? 1 : 0),
        flapsToggle: consume('flaps'),
        gearToggle: consume('gear'),
      };
    },
    consume,
    get mouseDelta() { const d = { x: mouseDx, y: mouseDy }; mouseDx = 0; mouseDy = 0; return d; },
    oneShot,
    destroy() {
      if (target) {
        target.removeEventListener('keydown', keydown);
        target.removeEventListener('keyup', keyup);
        target.removeEventListener('mousedown', mousedown);
        target.removeEventListener('mousemove', mousemove);
        target.removeEventListener('mouseup', mouseup);
      }
    },
  };
}
