// Frame-rate aware exponential smoothing
// rate is the percent of the gap we close every frame (Fast to slow motion)
//  dt is ticker.deltaTime (frames, not ms).

// Many independent values easing at once, one per key (price level, row index).
export class Eased {
  // Map of independent animations
  private values = new Map<number, number>();
  private rate: number;

  constructor(rate = 0.22) {
    this.rate = rate;
  }

  // Advances the value for `key` toward `target` by one frame and returns it.
  to(key: number, target: number, dt = 1): number {
    const cur = this.values.get(key);

    // At the first sight of a key adopt target
    // Prevents levels from sliding in from where the previous occupant of that row was
    if (cur === undefined) {
      this.values.set(key, target);
      return target;
    }
    
    const k = 1 - Math.pow(1 - this.rate, dt);
    const next = cur + (target - cur) * k;
    
    this.values.set(key, Math.abs(target - next) < 1e-4 ? target : next);
    return next;
  }

  // Drop keys that are no longer on screen
  keep(live: Set<number>): void {
    for (const key of this.values.keys()) if (!live.has(key)) this.values.delete(key);
  }
}

// One eased value with no key
// For chart-wide quantities (axis maxima, mid price) 
// Where a jump would make the whole panel lurch. Slower default rate.
export class Smooth {
  private value?: number;
  private rate: number;
  constructor(rate = 0.12) {
    this.rate = rate;
  }

  to(target: number, dt = 1): number {
    // Snap on the first call rather than easing up from nothing.
    // NOTE: this also snaps whenever the current value is exactly 0.
    if (this.value === undefined || this.value === 0) {
      this.value = target;
      return target;
    }
    const k = 1 - Math.pow(1 - this.rate, dt);
    this.value += (target - this.value) * k;
    return this.value;
  }
}

// Decaying highlight keyed by price level.
// Stores only the timestamp of the last hit
export class Flash {
  private hits = new Map<number, number>();
  private decay:number;
  constructor(decay = 450) {
    this.decay = decay;
  }

  // Marks `key` as just-changed at time `now` (ms). Re-hitting restarts the fade.
  hit(key: number, now: number): void {
    this.hits.set(key, now);
  }

  // 1 at the moment of the hit, falling linearly to 0 after `decay` ms
  alpha(key: number, now: number): number {
    const at = this.hits.get(key);
    if (at === undefined) return 0;
    const t = (now - at) / this.decay;
    if (t >= 1) {
      this.hits.delete(key);
      return 0;
    }
    return 1 - t;
  }
}
