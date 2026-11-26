import Matter from 'matter-js';
import { it } from 'vitest';
import { buildSim, createEngine, settleAll, stepSim } from '../src/core/sim';
import { STEP, type SceneDef } from '../src/core/types';
import { neon } from '../src/styles/neon';
import { TEMPLATES } from '../src/templates';
import { stubGpu, stubRenderer } from './stubRenderer';

function sample(def: SceneDef) {
  const engine = createEngine(def);
  const run = buildSim(def, engine, stubRenderer(), {
    style: neon, seed: 7, index: 0, duration: def.duration, enterAt: 0.6, renderer: stubGpu,
  });
  const start = performance.now();
  settleAll(run);
  const settled = performance.now();
  const steps = Math.round(def.duration / STEP);
  for (let k = 0; k < steps; k++) stepSim(run, k * STEP, STEP);
  const finish = performance.now();
  run.inst.dispose?.();
  Matter.Composite.clear(engine.world, false);
  Matter.Engine.clear(engine);
  return { settle: settled - start, step: (finish - settled) / steps };
}

const median = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

it.skipIf(env.BENCHMARK !== '1')('benchmarks each template against the stock Matter detector', () => {
  const update = Matter.Engine.update;
  const stockDetector = Matter.Detector.collisions;
  let stock = false;
  Matter.Engine.update = (engine, ms) => {
    const detector = Matter.Detector.collisions;
    if (stock) Matter.Detector.collisions = stockDetector;
    try {
      return update(engine, ms);
    } finally {
      Matter.Detector.collisions = detector;
    }
  };
  try {
    const ids = env.IDS?.split(',');
    const defs = TEMPLATES.filter((d) => !ids || ids.includes(d.id));
    // Warm both paths before measuring and alternate which runs first.
    for (const def of defs) {
      stock = true;
      sample(def);
      stock = false;
      sample(def);
    }
    for (const def of defs) {
      const a: ReturnType<typeof sample>[] = [];
      const b: ReturnType<typeof sample>[] = [];
      for (let i = 0; i < 3; i++) {
        stock = i % 2 === 0;
        (stock ? a : b).push(sample(def));
        stock = !stock;
        (stock ? a : b).push(sample(def));
      }
      console.log(JSON.stringify({
        id: def.id,
        stockStepMs: median(a.map((s) => s.step)),
        stepMs: median(b.map((s) => s.step)),
        stockSettleMs: median(a.map((s) => s.settle)),
        settleMs: median(b.map((s) => s.settle)),
      }));
    }
  } finally {
    Matter.Engine.update = update;
  }
}, 180000);
