// Procedural audio for Tradewind Courier, synthesised entirely with the WebAudio
// API — there are no sound files. A continuous engine hum tracks the throttle, a
// band of filtered noise rises with airspeed for wind, and short one-shot voices
// cover the ring chime, the landing thud, the crash and the menu click. A master
// gain node implements the mute toggle.
//
// Browsers block audio until a user gesture, so nothing is created until init()
// is called from the first key press or click; every other method is a no-op
// before then.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let windSrc = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;
  let started = false;

  function makeNoiseBuffer(context, seconds) {
    const len = Math.floor(context.sampleRate * seconds);
    const buffer = context.createBuffer(1, len, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function init() {
    if (started) {
      if (ctx && ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = typeof window !== 'undefined'
      ? window.AudioContext || window.webkitAudioContext
      : null;
    if (!AC) return;
    try {
      ctx = new AC();
    } catch {
      ctx = null;
      return;
    }
    started = true;

    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(ctx.destination);

    // Engine: a sawtooth through a lowpass, pitch and level driven by throttle.
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 60;
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 400;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0.0;
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();

    // Wind: looped white noise through a bandpass, level driven by airspeed.
    windSrc = ctx.createBufferSource();
    windSrc.buffer = makeNoiseBuffer(ctx, 2);
    windSrc.loop = true;
    windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 700;
    windFilter.Q.value = 0.7;
    windGain = ctx.createGain();
    windGain.gain.value = 0.0;
    windSrc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);
    windSrc.start();
  }

  function now() {
    return ctx ? ctx.currentTime : 0;
  }

  // A short pitched blip with an exponential decay envelope.
  function blip(freq, dur, type, peak) {
    if (!ctx) return;
    const t = now();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak || 0.3, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.2));
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + (dur || 0.2) + 0.02);
  }

  // A filtered noise burst with a decay envelope, for thud / crash.
  function noiseBurst(dur, freq, peak, type) {
    if (!ctx) return;
    const t = now();
    const src = ctx.createBufferSource();
    src.buffer = makeNoiseBuffer(ctx, dur);
    const f = ctx.createBiquadFilter();
    f.type = type || 'lowpass';
    f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.3), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak || 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  return {
    init,
    update(state) {
      if (!ctx || !engineOsc) return;
      const t = now();
      const throttle = state && state.throttle ? state.throttle : 0;
      const speed = state && state.speed ? state.speed : 0;
      const fuel = state && state.fuel != null ? state.fuel : 100;
      const engineOn = state && state.alive !== false && fuel > 0;
      // A low tank makes the engine run rough: the pitch wobbles as it sputters.
      const sputter = engineOn && fuel < 15 ? (Math.sin(t * 22) * 0.5 + 0.5) * 14 : 0;
      const baseFreq = 55 + throttle * 120 - sputter;
      engineOsc.frequency.setTargetAtTime(baseFreq, t, 0.08);
      engineFilter.frequency.setTargetAtTime(300 + throttle * 900, t, 0.08);
      const running = engineOn ? 0.05 + throttle * 0.12 : 0.0;
      engineGain.gain.setTargetAtTime(running * (fuel < 15 ? 0.6 + 0.4 * Math.abs(Math.sin(t * 18)) : 1), t, 0.1);
      const windLevel = Math.min(0.22, (speed / 120) * 0.22);
      windGain.gain.setTargetAtTime(windLevel, t, 0.15);
      windFilter.frequency.setTargetAtTime(500 + speed * 6, t, 0.15);
    },
    ring() {
      blip(880, 0.12, 'sine', 0.35);
      setTimeout(() => blip(1320, 0.16, 'sine', 0.3), 70);
    },
    thud() {
      noiseBurst(0.35, 220, 0.6, 'lowpass');
      blip(70, 0.3, 'sine', 0.4);
    },
    crash() {
      noiseBurst(1.1, 900, 0.8, 'lowpass');
      blip(48, 0.9, 'sawtooth', 0.5);
    },
    click() {
      blip(520, 0.06, 'square', 0.18);
    },
    setMuted(value) {
      muted = !!value;
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.9, now(), 0.05);
    },
    toggleMute() {
      this.setMuted(!muted);
      return muted;
    },
    isMuted() {
      return muted;
    },
    suspend() {
      if (ctx && ctx.state === 'running') ctx.suspend();
    },
    resume() {
      if (ctx && ctx.state === 'suspended') ctx.resume();
    },
  };
}