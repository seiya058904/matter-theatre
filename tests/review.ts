import Matter from 'matter-js';
import { buildSim, createEngine, settleAll, stepSim } from '../src/core/sim';
import { H, STEP, W, type SceneDef } from '../src/core/types';
import { OVERLAP } from '../src/show/ShowConfig';
import { neon } from '../src/styles/neon';
import { stubGpu, stubRenderer } from './stubRenderer';

/**
 * The watchability of a template as it plays in a show (entering after a segue): when the action
 * starts, when it peaks, how it ends, and where it happens in the camera's frame.
 */
export interface Review {
  id: string;
  dur: number;
  /** Seconds after the experiment begins until something visibly moves. */
  wake: number;
  /** Time of greatest kinetic energy, as a fraction of the clip. */
  peak: number;
  /** Kinetic energy over the last tenth of the clip, relative to the peak. */
  tail: number;
  /** Share of the frame covered by the action's bounding box (0..1). */
  cover: number;
  /** Distance of the action's centre from the frame's centre, in frame widths/heights. */
  off: [number, number];
  /** Moving bodies that were seen in frame and then left it (action running out of shot). */
  exits: number;
  /** Share of the frame covered by the whole set (everything drawn but the ground), at the start. */
  set: number;
  /** Centre of the set relative to the frame centre. */
  setOff: [number, number];
}

export function review(def: SceneDef, enterAt = OVERLAP): Review {
  const engine = createEngine(def);
  const sim = buildSim(def, engine, stubRenderer(), { style: neon, seed: 7, index: 0, duration: def.duration, enterAt, renderer: stubGpu });
  settleAll(sim);
  const all = () => Matter.Composite.allBodies(engine.world);
  const home = new Map(all().map((b) => [b, { x: b.position.x, y: b.position.y }]));
  const r = sim.r;
  const seen = new Set<Matter.Body>();
  const gone = new Set<Matter.Body>();
  const frame = (b: Matter.Body) => {
    const c = sim.camera;
    return { fx: ((b.position.x - c.x) * c.zoom) / W + 0.5, fy: ((b.position.y - c.y) * c.zoom) / H + 0.5 };
  };
  // The set as first seen: every drawn body except the ground, by its bounds.
  let s0 = Infinity;
  let s1 = -Infinity;
  let t0 = Infinity;
  let t1 = -Infinity;
  const ke: number[] = [];
  let wake = -1;
  // Union of where moving bodies have been, sampled in camera (frame) coordinates.
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const steps = Math.round(def.duration / STEP);
  const every = Math.round(0.25 / STEP);
  for (let k = 0; k < steps; k++) {
    const t = k * STEP;
    stepSim(sim, t, STEP);
    if (k === 1) {
      const c = sim.camera;
      for (const b of all()) {
        const v = r.views.get(b);
        if (!v || v.opts.role === 'ground' || v.opts.hidden) continue;
        s0 = Math.min(s0, ((b.bounds.min.x - c.x) * c.zoom) / W + 0.5);
        s1 = Math.max(s1, ((b.bounds.max.x - c.x) * c.zoom) / W + 0.5);
        t0 = Math.min(t0, ((b.bounds.min.y - c.y) * c.zoom) / H + 0.5);
        t1 = Math.max(t1, ((b.bounds.max.y - c.y) * c.zoom) / H + 0.5);
      }
    }
    if (k % every) continue;
    let e = 0;
    for (const b of all()) {
      if (b.isStatic) continue;
      const v2 = b.velocity.x ** 2 + b.velocity.y ** 2;
      if (Number.isFinite(b.mass)) e += 0.5 * b.mass * v2;
      const h = home.get(b);
      const { fx, fy } = frame(b);
      const inside = fx > 0 && fx < 1 && fy > 0 && fy < 1;
      if (inside) seen.add(b);
      else if (seen.has(b) && b.speed > 0.3) gone.add(b);
      if (!h || Math.hypot(b.position.x - h.x, b.position.y - h.y) < 25 || b.speed < 0.3) continue;
      if (wake < 0 && t >= enterAt) wake = t - enterAt;
      if (!inside) continue;
      x0 = Math.min(x0, fx);
      x1 = Math.max(x1, fx);
      y0 = Math.min(y0, fy);
      y1 = Math.max(y1, fy);
    }
    ke.push(e);
  }
  sim.inst.dispose?.();
  Matter.World.clear(engine.world, false);
  Matter.Engine.clear(engine);
  const max = Math.max(...ke, 1e-9);
  const peakI = ke.indexOf(max);
  const n = ke.length;
  const tailN = Math.max(1, Math.round(n * 0.1));
  const tail = ke.slice(n - tailN).reduce((a, b) => a + b, 0) / tailN / max;
  if (!Number.isFinite(x0)) x0 = x1 = y0 = y1 = 0.5;
  const inArea = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  const cl = (v: number) => Math.max(0, Math.min(1, v));
  const set = Math.max(0, cl(s1) - cl(s0)) * Math.max(0, cl(t1) - cl(t0));
  return {
    id: def.id,
    dur: def.duration,
    wake: +wake.toFixed(2),
    peak: +(peakI / n).toFixed(2),
    tail: +tail.toFixed(3),
    cover: +inArea.toFixed(2),
    off: [+((x0 + x1) / 2 - 0.5).toFixed(2), +((y0 + y1) / 2 - 0.5).toFixed(2)],
    exits: gone.size,
    set: +set.toFixed(2),
    setOff: [+((cl(s0) + cl(s1)) / 2 - 0.5).toFixed(2), +((cl(t0) + cl(t1)) / 2 - 0.5).toFixed(2)],
  };
}
