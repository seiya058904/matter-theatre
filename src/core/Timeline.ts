type Cue = { t: number; fn: () => void; done: boolean };
type Span = { a: number; b: number; fn: (p: number) => void; ended: boolean };

/**
 * Beat sheet for a scene. Cues fire on physics time, so the same show
 * always unfolds the same way regardless of display frame rate.
 */
export class Timeline {
  private cues: Cue[] = [];
  private spans: Span[] = [];
  t = 0;

  at(t: number, fn: () => void): this {
    this.cues.push({ t, fn, done: false });
    return this;
  }

  /** Calls fn(p) with p in [0,1] while a <= t <= b, and once more with p=1. */
  during(a: number, b: number, fn: (p: number) => void): this {
    this.spans.push({ a, b, fn, ended: false });
    return this;
  }

  every(start: number, interval: number, count: number, fn: (i: number) => void): this {
    for (let i = 0; i < count; i++) this.at(start + i * interval, () => fn(i));
    return this;
  }

  advance(t: number): void {
    this.t = t;
    for (const c of this.cues) {
      if (!c.done && t >= c.t) {
        c.done = true;
        c.fn();
      }
    }
    for (const s of this.spans) {
      if (s.ended || t < s.a) continue;
      if (t >= s.b) {
        s.ended = true;
        s.fn(1);
      } else s.fn((t - s.a) / (s.b - s.a));
    }
  }
}
