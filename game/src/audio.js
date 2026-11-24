// Synthesized sound for Sunset Harbor. No audio files: every sound is
// built from WebAudio oscillators and noise, so the game stays offline.
// All calls are safe before the audio context exists (headless, or before
// the first key press unlocks sound).

let ctx = null;
let master = null;
let engineOsc = null;
let engineGain = null;
let engineFilter = null;
let sirenOsc = null;
let sirenGain = null;
let sirenTimer = 0;

export function unlockAudio() {
  try {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);

    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 50;
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();

    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 750;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
  } catch (err) {
    ctx = null;
  }
}

export function setEngine(speed01, driving) {
  if (!ctx || !engineOsc) return;
  const target = driving ? 0.05 + speed01 * 0.11 : 0;
  engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
  engineOsc.frequency.setTargetAtTime(48 + speed01 * 130, ctx.currentTime, 0.08);
}

export function setSiren(on, dt) {
  if (!ctx || !sirenOsc) return;
  if (!on) {
    sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    return;
  }
  sirenTimer += dt;
  const high = Math.floor(sirenTimer * 2.4) % 2 === 0;
  sirenOsc.frequency.setTargetAtTime(high ? 920 : 660, ctx.currentTime, 0.05);
  sirenGain.gain.setTargetAtTime(0.045, ctx.currentTime, 0.1);
}

function blip(freq, dur, type, vol, when) {
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const t = ctx.currentTime + (when || 0);
    gain.gain.setValueAtTime(vol || 0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  } catch (err) { /* headless: ignore */ }
}

export function playPickup() {
  blip(660, 0.09, 'sine', 0.22, 0);
  blip(990, 0.12, 'sine', 0.2, 0.07);
}

export function playCash() {
  blip(880, 0.08, 'triangle', 0.2, 0);
  blip(1174, 0.08, 'triangle', 0.2, 0.07);
  blip(1568, 0.14, 'triangle', 0.18, 0.14);
}

export function playCrash() {
  if (!ctx) return;
  try {
    const len = Math.floor(ctx.sampleRate * 0.18);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = 0.5;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 900;
    src.connect(filt);
    filt.connect(gain);
    gain.connect(master);
    src.start();
  } catch (err) { /* ignore */ }
  blip(90, 0.2, 'square', 0.25, 0);
}

export function playBusted() {
  blip(392, 0.16, 'square', 0.18, 0);
  blip(311, 0.16, 'square', 0.18, 0.16);
  blip(233, 0.3, 'square', 0.18, 0.32);
}

export function playWin() {
  blip(523, 0.12, 'triangle', 0.2, 0);
  blip(659, 0.12, 'triangle', 0.2, 0.11);
  blip(784, 0.12, 'triangle', 0.2, 0.22);
  blip(1046, 0.22, 'triangle', 0.2, 0.33);
}
