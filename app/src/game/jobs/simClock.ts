/** Presentation clock only. Network calls and live choreography never use accelerated time. */
export class SimClock {
  fast = false;
  testing = false;
  live = false;
  get rate() { return this.fast && !this.live ? 4 : 1; }
  delta(seconds: number, simulated: boolean) { return Math.max(0, seconds) * (simulated ? this.rate : 1); }
  async wait(ms: number) {
    let left = ms, last = performance.now();
    while (left > 0) {
      await new Promise(resolve => setTimeout(resolve, Math.min(25, left)));
      const now = performance.now(); left -= this.delta(now - last, this.testing); last = now;
    }
  }
}
export const simClock = new SimClock();
