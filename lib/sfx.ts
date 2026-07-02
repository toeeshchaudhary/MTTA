// Tiny WebAudio sound kit — a subway-ish door chime + a MetroCard "swipe".
// Synthesised (no asset files), lazily created on first use (needs a user gesture),
// and globally gated by setSfxEnabled() which the public map wires to the admin's play.sounds.
let enabled = false;
let ctx: AudioContext | null = null;

export function setSfxEnabled(v: boolean) { enabled = v; }
export function sfxEnabled() { return enabled; }

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try { ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); } catch { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq: number, at: number, dur: number, peak = 0.07, type: OscillatorType = 'sine') {
  const c = ac(); if (!c) return;
  const t0 = c.currentTime + at;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type; osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}

// classic two-tone "bing-bong" — ascending on open
export function chimeOpen() {
  if (!enabled) return;
  tone(660, 0, 0.5, 0.06);
  tone(880, 0.14, 0.55, 0.06);
}
// descending on close — "doors closing"
export function chimeClose() {
  if (!enabled) return;
  tone(740, 0, 0.42, 0.05);
  tone(520, 0.12, 0.5, 0.05);
}
// a quick filtered-noise burst — MetroCard swipe
function swipeBurst(peak: number) {
  const c = ac(); if (!c) return;
  const t0 = c.currentTime;
  const len = Math.floor(c.sampleRate * 0.16);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource(); src.buffer = buf;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(900, t0); bp.frequency.exponentialRampToValueAtTime(3200, t0 + 0.14); bp.Q.value = 0.8;
  const g = c.createGain(); g.gain.setValueAtTime(peak, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
  src.connect(bp).connect(g).connect(c.destination);
  src.start(t0); src.stop(t0 + 0.18);
}
export function swipe() { if (!enabled) return; swipeBurst(0.12); }

// a soft tick played when stepping prev/next between stops. Deliberately NOT gated by the
// ambient-sound toggle — it's tactile feedback on an explicit tap, and the tap itself is the
// user gesture WebAudio needs. Kept quiet so it never feels like "sound is on".
export function navTick() { swipeBurst(0.05); }
