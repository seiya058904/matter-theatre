import Matter from 'matter-js';
import { buildSim, createEngine, settleAll, stepSim } from '../src/core/sim';
import { H, STEP, W, type SceneDef } from '../src/core/types';
import { neon } from '../src/styles/neon';
import { stubGpu, stubRenderer } from './stubRenderer';

export interface Health {
  id: string;
  nan: boolean;
  /** Fastest dynamic body shortly after the start. */
  startSpeed: number;
  /** Farthest any dynamic body drifts between 0.1 s and 0.55 s (a calm start barely moves). */
  startDrift: number;
  /** Fastest dynamic body at the end. */
  endSpeed: number;
  /** Dynamic bodies that end the clip well outside the camera's view. */
  lost: number;
  /** Largest distance any dynamic body travelled. */
  moved: number;
  /** Fingerprint of the final state (determinism). */
  hash: string;
  ms: number;
}

/** Runs a template headlessly from its off-screen settling to the end of its clip. */
export function runHeadless(def: SceneDef, o: { seed?: number; seconds?: number; enterAt?: number } = {}): Health {
  const t0 = performance.now();
  const engine = createEngine(def);
  const r = stubRenderer();
  const seconds = o.seconds ?? def.duration;
  const sim = buildSim(def, engine, r, { style: neon, seed: o.seed ?? 7, index: 0, duration: seconds, enterAt: o.enterAt ?? 0.6, renderer: stubGpu });
  settleAll(sim);
  const dyn = () => Matter.Composite.allBodies(engine.world).filter((b) => !b.isStatic);
  // Held bodies are static until let go, so every body's starting place is remembered.
  const start = new Map(Matter.Composite.allBodies(engine.world).map((b) => [b, { x: b.position.x, y: b.position.y }]));
  let startSpeed = 0;
  let startDrift = 0;
  let nan = false;
  const early = new Map<Matter.Body, { x: number; y: number }>();
  const steps = Math.round(seconds / STEP);
  for (let k = 0; k < steps; k++) {
    const t = k * STEP;
    stepSim(sim, t, STEP);
    if (t > 0.1 && t < 0.55)
      for (const b of dyn()) {
        startSpeed = Math.max(startSpeed, b.speed);
        const p = early.get(b);
        if (!p) early.set(b, { x: b.position.x, y: b.position.y });
        else startDrift = Math.max(startDrift, Math.hypot(b.position.x - p.x, b.position.y - p.y));
      }
  }
  let endSpeed = 0;
  let lost = 0;
  let moved = 0;
  const cam = sim.camera;
  const hw = W / 2 / cam.zoom + 260;
  const hh = H / 2 / cam.zoom + 260;
  let h = 2166136261;
  const mix = (v: number) => {
    h ^= Math.round(v * 1000);
    h = Math.imul(h, 16777619);
  };
  for (const b of Matter.Composite.allBodies(engine.world)) {
    if (!Number.isFinite(b.position.x) || !Number.isFinite(b.position.y)) nan = true;
    mix(b.position.x);
    mix(b.position.y);
    mix(b.angle);
    if (b.isStatic) continue;
    endSpeed = Math.max(endSpeed, b.speed);
    if (Math.abs(b.position.x - cam.x) > hw || Math.abs(b.position.y - cam.y) > hh) lost++;
    const p = start.get(b);
    if (p) moved = Math.max(moved, Math.hypot(b.position.x - p.x, b.position.y - p.y));
  }
  sim.inst.dispose?.();
  Matter.World.clear(engine.world, false);
  Matter.Engine.clear(engine);
  return { id: def.id, nan, startSpeed: +startSpeed.toFixed(2), startDrift: +startDrift.toFixed(2), endSpeed: +endSpeed.toFixed(2), lost, moved: Math.round(moved), hash: (h >>> 0).toString(36), ms: Math.round(performance.now() - t0) };
}
