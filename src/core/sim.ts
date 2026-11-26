import Matter from 'matter-js';
import type { Renderer } from 'pixi.js';
import { Camera } from './Camera';
import { Timeline } from './Timeline';
import { Rng, hashString } from './rng';
import { smooth } from './ease';
import { updatePhysics } from './physics';
import { STEP, type SceneContext, type SceneDef, type SceneInstance } from './types';
import type { SceneRenderer } from '../render/SceneRenderer';
import type { StyleDef } from '../styles/types';

/**
 * The physics side of one running template, free of any drawing: the engine, the template's
 * clock and its registered laws. The Director wraps it with Pixi containers; the headless tests
 * run exactly the same code with a stand-in renderer, so what they check is what plays.
 */
export interface Sim {
  def: SceneDef;
  inst: SceneInstance;
  engine: Matter.Engine;
  r: SceneRenderer;
  camera: Camera;
  tl: Timeline;
  entered: boolean;
  enterAt: number;
  /** Template-local time of the last step. */
  local: number;
  slow: { from: number; to: number; t0: number; ease: number; hold: number } | null;
  /** Off-screen settling steps still to run before the template is shown. */
  settle: number;
  /** Physical laws registered by the template (springs, fields, buoyancy, gas pressure). */
  forces: (() => void)[];
}

export interface SimOptions {
  style: StyleDef;
  /** Show seed; mixed with the template id and its place in the running order. */
  seed: number;
  index: number;
  duration: number;
  enterAt: number;
  renderer: Renderer;
}

export function createEngine(def: SceneDef): Matter.Engine {
  const engine = Matter.Engine.create({ gravity: { x: def.gravity?.x ?? 0, y: def.gravity?.y ?? 1, scale: 0.001 } });
  engine.positionIterations = 8;
  engine.velocityIterations = 6;
  engine.constraintIterations = 4;
  return engine;
}

/** Seed of a template's own random stream (unchanged since v3, so saved shows replay identically). */
export function sceneSeed(seed: number, id: string, index: number): number {
  return (seed ^ hashString(id) ^ (index * 2654435761)) >>> 0;
}

/** Builds a template into `engine`, drawing through `r` (created by the caller on the same engine). */
export function buildSim(def: SceneDef, engine: Matter.Engine, r: SceneRenderer, o: SimOptions): Sim {
  const camera = new Camera();
  const tl = new Timeline();
  const rng = new Rng(sceneSeed(o.seed, def.id, o.index));
  const sim: Sim = {
    def,
    inst: null as unknown as SceneInstance,
    engine,
    r,
    camera,
    tl,
    entered: false,
    enterAt: o.enterAt,
    local: 0,
    slow: null,
    settle: Math.round((def.presettle ?? 0) * 120),
    forces: [],
  };
  const ctx: SceneContext = {
    engine,
    world: engine.world,
    root: r.root,
    style: o.style,
    camera,
    tl,
    rng,
    r,
    renderer: o.renderer,
    duration: o.duration,
    enterAt: o.enterAt,
    slowmo: (to, hold, ease = 0.35) => {
      sim.slow = { from: engine.timing.timeScale, to, t0: sim.local, ease, hold };
    },
    force: (fn) => {
      sim.forces.push(fn);
    },
  };
  sim.inst = def.setup(ctx);
  return sim;
}

/**
 * One off-screen settling step: physics only, the template's clock does not run. Collisions while
 * settling are part of arranging the set, not the show, so they leave no impact marks.
 */
export function settleStep(sim: Sim): void {
  if (sim.settle <= 0) return;
  const was = sim.r.impactsEnabled;
  sim.r.impactsEnabled = false;
  sim.r.fx.muted = true;
  // Only the last off-screen pose is needed for the first visible interpolation.
  if (sim.settle === 1) sim.r.snapshot();
  for (const f of sim.forces) f();
  updatePhysics(sim.engine, STEP * 1000);
  sim.r.impactsEnabled = was;
  sim.r.fx.muted = false;
  sim.settle--;
}

/** Runs every remaining settling step at once. */
export function settleAll(sim: Sim): void {
  while (sim.settle > 0) settleStep(sim);
}

/**
 * One fixed physics step at template-local time `local`. `before` runs after the template's own
 * step and before the laws (the Director uses it to carry opened floors away).
 */
export function stepSim(sim: Sim, local: number, dt: number, before?: () => void): void {
  sim.local = local;
  if (sim.slow) {
    const s = sim.slow;
    const k = local - s.t0;
    let scale: number;
    if (k < s.ease) scale = s.from + (s.to - s.from) * smooth(k / s.ease);
    else if (k < s.ease + s.hold) scale = s.to;
    else if (k < s.ease * 3 + s.hold) scale = s.to + (1 - s.to) * smooth((k - s.ease - s.hold) / (s.ease * 2));
    else {
      scale = 1;
      sim.slow = null;
    }
    sim.engine.timing.timeScale = scale;
  }
  sim.r.snapshot();
  sim.camera.snapshot();
  if (!sim.entered && local >= sim.enterAt) {
    sim.entered = true;
    sim.inst.enter?.();
  }
  sim.tl.advance(local);
  sim.inst.step?.(local, dt);
  before?.();
  for (const f of sim.forces) f();
  updatePhysics(sim.engine, dt * 1000);
  // The camera moves on the template's clock too, so framing is identical live and in an export.
  sim.camera.update(dt);
}
