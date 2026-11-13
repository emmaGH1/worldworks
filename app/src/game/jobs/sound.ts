// Synthesized feedback only. No audio assets or network; unlock on the player's first gesture.
const low = new URLSearchParams(location.search).get('lowfx') === '1';
let ctx: AudioContext | undefined, hum: OscillatorNode | undefined, gain: GainNode | undefined;
let muted = false;
try { muted = localStorage.getItem('ww-sound-muted') === '1'; } catch { /* storage off */ }
let portalOn = false;
function tone(freq: number, duration: number, delay = 0, volume = 0.04) {
  if (!ctx || ctx.state !== 'running' || muted || low) return;
  const o = ctx.createOscillator(), g = ctx.createGain(), at = ctx.currentTime + delay;
  o.type = 'sine'; o.frequency.setValueAtTime(freq, at); o.frequency.exponentialRampToValueAtTime(freq * 1.3, at + duration);
  g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(volume, at + 0.008); g.gain.exponentialRampToValueAtTime(0.001, at + duration);
  o.connect(g).connect(ctx.destination); o.start(at); o.stop(at + duration + 0.02); o.onended = () => { o.disconnect(); g.disconnect(); };
}
function syncHum() {
  if (!ctx || muted || low || !portalOn) { hum?.stop(); hum?.disconnect(); gain?.disconnect(); hum = undefined; gain = undefined; return; }
  if (hum) return;
  hum = ctx.createOscillator(); gain = ctx.createGain(); hum.frequency.value = 110; gain.gain.value = 0.012; hum.connect(gain).connect(ctx.destination); hum.start();
}
export const sound = {
  get muted() { return muted || low; },
  unlock() { if (low) return; try { ctx ??= new AudioContext(); void ctx.resume().catch(() => {}); syncHum(); } catch { /* audio unavailable */ } },
  mute(value: boolean) { muted = value; try { localStorage.setItem('ww-sound-muted', value ? '1' : '0'); } catch { /* storage off */ } syncHum(); },
  play(kind: 'coin' | 'place' | 'pass' | 'fail' | 'gem') {
    if (kind === 'pass' || kind === 'gem') [523, 659, 784, ...(kind === 'gem' ? [1047] : [])].forEach((f, i) => tone(f, 0.22, i * 0.09));
    else tone(kind === 'coin' ? 880 : kind === 'place' ? 330 : 130, kind === 'fail' ? 0.22 : 0.09);
  },
  portal(on: boolean) { portalOn = on; syncHum(); },
  stop() { portalOn = false; syncHum(); void ctx?.close().catch(() => {}); ctx = undefined; },
};
