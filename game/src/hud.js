// Canvas 2D heads-up display for Tradewind Courier.
//
// A transparent overlay canvas drawn on top of the 3D view. Everything is
// bright-on-dark and lit like real instruments: a compass strip across the top,
// an attitude indicator (artificial horizon), an altimeter dial and an airspeed
// dial at the bottom corners, vertical throttle / fuel / damage bars, a row of
// warning lights, the mission objective with its timer and the running score,
// and large centred messages for events. All of it is a pure function of the
// view object handed to draw(), so the HUD never owns game state.
import { PALETTE, FONT } from './config.js';

// Display-only conversions. World units are arcade-scaled; these make the
// numbers read like a light aircraft without changing the simulation.
const FT_PER_UNIT = 10;
const KT_PER_UNIT = 1.1;

const INK = PALETTE.hud;
const DIM = PALETTE.hudDim;
const WARN = PALETTE.warn;
const ACCENT = PALETTE.accent;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function panel(ctx, x, y, w, h, radius) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
  ctx.fillStyle = 'rgba(8, 20, 30, 0.55)';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(150, 200, 230, 0.35)';
  ctx.stroke();
  ctx.restore();
}

function label(ctx, text, x, y, size, color, align) {
  ctx.save();
  ctx.font = `${size}px ${FONT}`;
  ctx.fillStyle = color || INK;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
  ctx.restore();
}

// A round dial with a sweeping needle, used for the airspeed and altimeter.
function dial(ctx, cx, cy, r, value, max, title, unit, color) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(6, 16, 24, 0.7)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(150, 200, 230, 0.5)';
  ctx.stroke();

  // Tick marks around the top three quarters of the dial.
  const start = Math.PI * 0.75;
  const sweep = Math.PI * 1.5;
  for (let i = 0; i <= 10; i += 1) {
    const a = start + (i / 10) * sweep;
    const inner = i % 5 === 0 ? r - 10 : r - 6;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    ctx.lineTo(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2));
    ctx.strokeStyle = i % 5 === 0 ? INK : DIM;
    ctx.lineWidth = i % 5 === 0 ? 2 : 1;
    ctx.stroke();
  }

  // Needle.
  const t = clamp(value / max, 0, 1);
  const a = start + t * sweep;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(a) * (r - 12), cy + Math.sin(a) * (r - 12));
  ctx.strokeStyle = color || ACCENT;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = color || ACCENT;
  ctx.fill();

  label(ctx, title, cx, cy - r - 6, 12, DIM, 'center');
  label(ctx, `${Math.round(value)}`, cx, cy + r * 0.55, 15, INK, 'center');
  label(ctx, unit, cx, cy + r * 0.55 + 14, 10, DIM, 'center');
  ctx.restore();
}

// Artificial horizon: a blue/brown ball that rolls and pitches with the plane.
function attitude(ctx, cx, cy, r, pitch, roll) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-roll);
  const pitchPx = clamp(pitch, -1, 1) * r * 0.9;
  ctx.fillStyle = '#3f7fc4';
  ctx.fillRect(-r * 2, -r * 2 + pitchPx, r * 4, r * 2);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-r * 2, pitchPx, r * 4, r * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r * 2, pitchPx);
  ctx.lineTo(r * 2, pitchPx);
  ctx.stroke();
  ctx.restore();

  // Fixed aircraft reference mark + bezel on top.
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(180, 220, 245, 0.7)';
  ctx.stroke();
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.5, cy);
  ctx.lineTo(cx - r * 0.15, cy);
  ctx.moveTo(cx + r * 0.15, cy);
  ctx.lineTo(cx + r * 0.5, cy);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = ACCENT;
  ctx.fill();
  ctx.restore();
}

// A vertical gauge bar with a fill level and a title.
function vbar(ctx, x, y, w, h, frac, title, color, warn) {
  panel(ctx, x - 6, y - 18, w + 12, h + 30, 6);
  label(ctx, title, x + w / 2, y - 6, 11, DIM, 'center');
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(x, y, w, h);
  const fh = clamp(frac, 0, 1) * h;
  ctx.fillStyle = warn ? WARN : color;
  ctx.fillRect(x, y + h - fh, w, fh);
  ctx.strokeStyle = 'rgba(180,220,245,0.5)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

// The compass strip: a scrolling tape of headings with a centre caret.
function compass(ctx, cx, y, width, headingDeg) {
  const pxPerDeg = 3.2;
  ctx.save();
  panel(ctx, cx - width / 2, y - 16, width, 30, 6);
  ctx.beginPath();
  ctx.rect(cx - width / 2, y - 16, width, 30);
  ctx.clip();
  const base = Math.round(headingDeg);
  for (let d = base - 60; d <= base + 60; d += 5) {
    const x = cx + (d - headingDeg) * pxPerDeg;
    const norm = ((d % 360) + 360) % 360;
    const major = norm % 30 === 0;
    ctx.beginPath();
    ctx.moveTo(x, y + 8);
    ctx.lineTo(x, y + (major ? -2 : 3));
    ctx.strokeStyle = major ? INK : DIM;
    ctx.lineWidth = major ? 2 : 1;
    ctx.stroke();
    if (major) label(ctx, String(norm), x, y - 4, 10, INK, 'center');
  }
  ctx.restore();
  // Centre caret.
  ctx.save();
  ctx.fillStyle = ACCENT;
  ctx.beginPath();
  ctx.moveTo(cx, y + 12);
  ctx.lineTo(cx - 6, y + 20);
  ctx.lineTo(cx + 6, y + 20);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function warnLight(ctx, x, y, text, on, color) {
  ctx.save();
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, 74, 22, 5);
  else ctx.rect(x, y, 74, 22);
  ctx.fillStyle = on ? color : 'rgba(40, 50, 60, 0.6)';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = on ? '#ffffff' : 'rgba(150,200,230,0.3)';
  ctx.stroke();
  label(ctx, text, x + 37, y + 16, 12, on ? '#08131c' : DIM, 'center');
  ctx.restore();
}

// A soft coloured vignette that pulses when the aircraft is in trouble, so a
// stall or a dry tank is felt at the edge of vision as well as read on a light.
function vignette(ctx, w, h, color, strength) {
  if (strength <= 0) return;
  ctx.save();
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.7);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, color);
  ctx.globalAlpha = Math.min(0.6, strength);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

export function createHUD(canvas) {
  const ctx = canvas.getContext('2d');
  let W = canvas.clientWidth || 1280;
  let H = canvas.clientHeight || 800;
  let dpr = 1;

  function resize(cssW, cssH, ratio) {
    W = cssW;
    H = cssH;
    dpr = ratio || 1;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
  }

  function clear() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // view: { state, mission, score, best, objective, time, warnings, message, cameraMode }
  function draw(view) {
    clear();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const s = view.state;
    if (!s) return;

    const speedKt = s.speed * KT_PER_UNIT;
    const altFt = Math.max(0, s.y) * FT_PER_UNIT;
    const headingDeg = ((s.heading * 180) / Math.PI + 360) % 360;
    const warn = view.warnings || {};

    // Edge-of-vision warning tint (stall / low fuel), pulsing with time.
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 180);
    if (warn.stall) vignette(ctx, W, H, 'rgba(255,60,50,0.9)', 0.25 + 0.3 * pulse);
    else if (warn.lowFuel) vignette(ctx, W, H, 'rgba(255,150,40,0.9)', 0.2 + 0.2 * pulse);

    // Top: compass strip + mission objective + score.
    compass(ctx, W / 2, 34, Math.min(420, W * 0.4), headingDeg);

    panel(ctx, 16, 16, 250, 64, 8);
    label(ctx, 'OBJECTIVE', 28, 36, 11, DIM);
    label(ctx, view.objective || '', 28, 56, 15, INK);
    if (view.time != null) {
      const t = Math.max(0, view.time);
      const mm = Math.floor(t / 60);
      const ss = Math.floor(t % 60);
      label(ctx, `${mm}:${String(ss).padStart(2, '0')}`, 254, 56, 16, t < 15 ? WARN : ACCENT, 'right');
    }

    panel(ctx, W - 216, 16, 200, 64, 8);
    label(ctx, 'SCORE', W - 204, 36, 11, DIM);
    label(ctx, String(view.score || 0), W - 204, 60, 22, INK);
    label(ctx, `BEST ${view.best || 0}`, W - 28, 60, 12, DIM, 'right');

    // Warning lights row (top-right, under the score panel).
    warnLight(ctx, W - 216, 90, 'STALL', !!warn.stall, WARN);
    warnLight(ctx, W - 136, 90, 'LOW FUEL', !!warn.lowFuel, '#ff9f43');
    warnLight(ctx, W - 56, 90, 'GEAR', !!warn.gear, '#4cd07a');

    // Bottom-left: airspeed dial + altimeter dial.
    const dialR = Math.min(64, H * 0.1);
    dial(ctx, 90, H - 90, dialR, speedKt, 160, 'AIRSPEED', 'kt', ACCENT);
    dial(ctx, 90 + dialR * 2 + 30, H - 90, dialR, altFt, 6000, 'ALTIMETER', 'ft', '#7fd0ff');

    // Bottom-centre: attitude indicator.
    attitude(ctx, W / 2, H - 90, Math.min(72, H * 0.11), s.pitch, s.roll);

    // Bottom-right: throttle / fuel / damage vertical bars.
    const bx = W - 150;
    const by = H - 250;
    const bh = 170;
    vbar(ctx, bx, by, 26, bh, s.throttle, 'THR', '#4cd07a', false);
    vbar(ctx, bx + 44, by, 26, bh, s.fuel / 100, 'FUEL', '#7fd0ff', s.fuel < 20);
    vbar(ctx, bx + 88, by, 26, bh, s.damage / 100, 'DMG', '#ff8a5a', s.damage > 60);
    label(ctx, s.flaps ? 'FLAPS ▼' : 'FLAPS —', bx + 44, by + bh + 22, 11, s.flaps ? ACCENT : DIM, 'center');

    // Camera mode tag.
    label(ctx, view.cameraMode === 'cockpit' ? 'COCKPIT' : 'CHASE', W - 28, H - 18, 12, DIM, 'right');

    // Centre message (big, centred) for events / warnings.
    if (view.message) {
      ctx.save();
      ctx.font = `700 40px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const mw = ctx.measureText(view.message).width;
      ctx.fillStyle = 'rgba(8, 20, 30, 0.6)';
      ctx.fillRect(W / 2 - mw / 2 - 24, H / 2 - 34, mw + 48, 68);
      ctx.fillStyle = view.messageColor || WARN;
      ctx.fillText(view.message, W / 2, H / 2);
      ctx.restore();
    }
  }

  resize(W, H, dpr);
  return { resize, draw, clear };
}