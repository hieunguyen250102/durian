// Tiny Web Audio synth so the game needs no audio files.

let ctx: AudioContext | null = null;
let muted = (() => {
  try {
    return localStorage.getItem('durian.muted') === '1';
  } catch {
    return false;
  }
})();

export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem('durian.muted', m ? '1' : '0');
  } catch {
    /* storage unavailable */
  }
}

function ac() {
  if (muted) return null;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; delay?: number; slide?: number } = {}) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + (opts.delay ?? 0);
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t);
  if (opts.slide) osc.frequency.exponentialRampToValueAtTime(opts.slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.2, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noise(dur: number, opts: { delay?: number; gain?: number; from?: number; to?: number } = {}) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + (opts.delay ?? 0);
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(opts.from ?? 2500, t);
  f.frequency.exponentialRampToValueAtTime(opts.to ?? 900, t + dur);
  const g = a.createGain();
  g.gain.value = opts.gain ?? 0.25;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

export const sfx = {
  card(delay = 0) {
    noise(0.16, { delay, gain: 0.35 });
  },
  flip() {
    noise(0.08, { gain: 0.25, from: 4000, to: 2000 });
    tone(660, 0.08, { type: 'triangle', gain: 0.06, delay: 0.04 });
  },
  pop() {
    tone(520, 0.12, { type: 'triangle', gain: 0.15, slide: 880 });
  },
  bell() {
    // Inharmonic partials give a hand-bell timbre.
    for (const [f, g] of [[1318, 0.22], [2637, 0.1], [3640, 0.06], [880, 0.08]] as const) {
      tone(f, 1.8, { gain: g });
      tone(f, 1.4, { gain: g * 0.7, delay: 0.28 });
    }
  },
  gorilla() {
    tone(140, 0.5, { type: 'sawtooth', gain: 0.08, slide: 70 });
    tone(210, 0.35, { type: 'square', gain: 0.04, slide: 90, delay: 0.05 });
  },
  angry() {
    tone(110, 0.7, { type: 'sawtooth', gain: 0.12, slide: 55 });
    tone(165, 0.6, { type: 'sawtooth', gain: 0.08, slide: 60, delay: 0.08 });
    noise(0.4, { gain: 0.15, from: 400, to: 120 });
  },
  good() {
    [523, 659, 784].forEach((f, i) => tone(f, 0.25, { type: 'triangle', gain: 0.12, delay: i * 0.09 }));
  },
  win() {
    [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, 0.3, { type: 'triangle', gain: 0.13, delay: i * 0.12 }));
  },
  tick() {
    tone(900, 0.05, { type: 'square', gain: 0.03 });
  },
};
