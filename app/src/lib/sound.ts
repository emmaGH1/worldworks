// Sound is off by default. Every sound is synthesized here with WebAudio (no audio files), see public/sounds/CREDITS.md.
import { getState } from './store';

let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  if (!getState().sound) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}

function tone(freq: number, at: number, dur: number, type: OscillatorType = 'sine', gain = 0.12) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

// Pentatonic note per part type, so a running machine plays a little melody.
const NOTE: Record<string, number> = { CoinSlot: 523.25, Splitter: 587.33, Gate: 659.25, Vault: 783.99, Payout: 880, Portal: 1046.5, Worker: 698.46 };

export const sfx = {
  tock(part: string) { tone(NOTE[part] ?? 600, 0, 0.16, 'triangle', 0.1); },
  snap() { tone(320, 0, 0.06, 'square', 0.05); tone(640, 0.04, 0.09, 'triangle', 0.08); },
  kaching() { tone(1318.5, 0, 0.12, 'square', 0.04); tone(1760, 0.07, 0.35, 'triangle', 0.09); },
  whoosh() { for (let i = 0; i < 6; i++) tone(300 + i * 90, i * 0.03, 0.12, 'sine', 0.03); },
  chime() { tone(1046.5, 0, 0.4, 'sine', 0.1); tone(1568, 0.16, 0.6, 'sine', 0.1); },
  error() { tone(220, 0, 0.12, 'sawtooth', 0.04); tone(180, 0.1, 0.16, 'sawtooth', 0.04); },
};
