import { describe, expect, it } from 'vitest';
import { TEMPLATES, templateById } from '../src/templates';
import { runHeadless, type Health } from './headless';

/**
 * Every template, run headless from its off-screen settling to the end of its clip, exactly as the
 * Director runs it. Node's V8 computes Math.sin & co. slightly differently from a browser's, so
 * these are health checks with margins; the in-browser QA report is the ground truth for looks.
 */

/** Bodies a template may legitimately leave out of shot at its end (with the reason). */
const OFFSTAGE: Record<string, number> = {
  // The finished marble rolls on past the finish line, out of frame.
  'marble-race': 1,
  // The pipe's water reservoir sits above the frame.
  'shishi-odoshi': 1,
  // A gravitational slingshot genuinely ejects light bodies.
  'binary-star': 2,
  accretion: 3,
};

const results = new Map<string, Health>();
const health = (id: string): Health => {
  let h = results.get(id);
  if (!h) {
    h = runHeadless(templateById(id)!);
    results.set(id, h);
  }
  return h;
};

describe('every template, headless', () => {
  for (const def of TEMPLATES) {
    it(def.id, () => {
      const h = health(def.id);
      expect(h.nan, 'NaN position').toBe(false);
      expect(h.lost, 'bodies lost out of shot').toBeLessThanOrEqual(OFFSTAGE[def.id] ?? 0);
      // A calm start: nothing visibly drifts before the experiment begins.
      if (!def.movingStart) expect(h.startDrift, 'calm start').toBeLessThan(4);
      expect(h.moved, 'something visibly happens').toBeGreaterThan(30);
    }, 30000);
  }
});

describe('determinism', () => {
  it('replays a template bit for bit', () => {
    for (const id of ['galton', 'newton-cradle', 'soft-bloom', 'trebuchet', 'three-body', 'domino-growth', 'archimedes', 'kaleidoscope']) {
      const a = health(id).hash;
      const b = runHeadless(templateById(id)!).hash;
      expect(b, id).toBe(a);
    }
  }, 60000);
});
