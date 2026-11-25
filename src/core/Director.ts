import { Container, Graphics, Rectangle, Sprite } from 'pixi.js';
import Matter from 'matter-js';
import { clamp, easeInOutSine, easeOutCubic, smooth } from './ease';
import { H, STEP, W, type SceneDef } from './types';
import { SceneRenderer } from '../render/SceneRenderer';
import type { Stage } from './Stage';
import type { StyleDef } from '../styles/types';
import { LEN_SCALE, OVERLAP, type Segue, type ShowConfig } from '../show/ShowConfig';
import { InkRevealFilter } from '../fx/filters';
import { schedule } from '../show/schedule';
import { chooseSegues } from '../show/segues';
import { buildSim, createEngine, sceneSeed, settleAll, settleStep, stepSim, type Sim } from './sim';

export interface Item {
  def: SceneDef;
  dur: number;
  /** Start within one pass of the running order. */
  start: number;
  /** Segue used when this item comes in. */
  segue: Segue;
}

interface Running extends Sim {
  item: Item;
  /** Position in the running order. */
  index: number;
  /** Global start time of this run. */
  start: number;
  root: Container;
  camC: Container;
  /** Floor drop in progress: the floors fall away faster than anything standing on them. */
  drop: { v: number; t: number } | null;
  /** How this run came in, and over how long (a jump comes in faster than a planned segue). */
  segue: Segue | null;
  segueLen: number;
}

/** A requested jump to another item: prepared off-screen while the current picture keeps playing. */
interface Jump {
  run: Running;
  /** The look changes too: the stage closes to black, switches, and opens on the new look. */
  look: boolean;
}

/** At most this many physics steps per rendered frame; beyond it time is dropped, never piled up. */
const MAX_STEPS = 4;
/** Shortest and longest lead with which the next template is built before its segue starts. */
const LEAD_MIN = 3;
const LEAD_MAX = 6;
/** Main-thread time per frame given to preparing the next template (settling and building views). */
const BUDGET_MS = 2.5;
/** The most a frame may give when preparation is late (spread thin rather than paid at the cut). */
const BUDGET_MAX = 7;
/** Rough cost of building and tessellating one body's views (ms), for planning. */
const VIEW_MS = 0.12;
/** A jump (skip, card click, edit) comes in through the backdrop over this long. */
const JUMP_LEN = 0.5;
/** Seconds for the curtain to close and to open again around a change of look. */
const CURTAIN_CLOSE = 0.22;
const CURTAIN_OPEN = 0.34;

/**
 * Plays a running order of templates: builds each one early, settles it off-screen in small
 * time slices, runs every live template on a fixed 120 Hz step, performs the segues and loops.
 * Everything visible (camera, particles, trails, backdrop) advances on the show's own clock,
 * so a show looks the same at any refresh rate and in an exported video.
 */
export class Director {
  items: Item[] = [];
  /** Length of one pass of the running order. */
  total = 0;
  time = 0;
  playing = true;
  /** Loop the running order (the live show); off for exports. */
  loop = true;
  onItem: ((index: number) => void) | null = null;
  onEnd: (() => void) | null = null;

  private running: Running[] = [];
  private pending: Running | null = null;
  private jump: Jump | null = null;
  private nextIndex = 0;
  private nextStart = 0;
  private lead = LEAD_MIN;
  private passStart = 0;
  private acc = 0;
  /** Show clock (time + interpolation) at the last rendered frame. */
  private vclock = 0;
  private visualTime = 0;
  private frameDt = 1 / 60;
  private curtain = 0;
  private style!: StyleDef;
  private cfg!: ShowConfig;
  private iris = new Graphics();
  private ink = new InkRevealFilter();
  private inkArea = new Rectangle(-240, -240, W + 480, H + 480);
  private fadeIn = 1;
  private ended = false;
  /** Measured settling cost per template (ms per step), so heavy ones are prepared earlier. */
  private stepCost = new Map<string, number>();

  constructor(
    private stage: Stage,
    private lookup: (id: string) => SceneDef | undefined,
  ) {}

  // ---------------- running order ----------------

  /**
   * Loads a running order and plays it from item `startAt`.
   * - `sync`: prepare at once (exports, QA); the call blocks until the item is ready.
   * - `keep`: an edit of the running order; if item `startAt` is the template already playing,
   *   it simply carries on (nothing restarts), otherwise the show jumps there.
   * Otherwise the show jumps: the item is prepared in small slices while the picture keeps playing.
   */
  load(cfg: ShowConfig, style: StyleDef, startAt = 0, how: { sync?: boolean; keep?: boolean } = {}): void {
    const look = !this.style || style.id !== this.style.id || cfg.bg !== this.cfg.bg;
    this.cfg = cfg;
    this.style = style;
    const defs: { def: SceneDef; scale: number; segue?: Segue }[] = [];
    for (const s of cfg.segments) {
      const def = this.lookup(s.id);
      if (def) defs.push({ def, scale: LEN_SCALE[s.len] ?? 1, segue: s.segue });
    }
    const durs = defs.map((d) => d.def.duration * d.scale);
    const plan = schedule(durs);
    const segues = chooseSegues(defs.map((d) => d.def), cfg.link, style.id, cfg.seed, defs.map((d) => d.segue));
    this.items = defs.map((d, i) => ({ def: d.def, dur: durs[i], start: plan.starts[i], segue: segues[i] }));
    this.total = plan.total;
    if (!this.items.length) {
      this.clear();
      if (look) this.stage.applyStyle(style, cfg.bg);
      return;
    }
    const index = clamp(Math.round(startAt), 0, this.items.length - 1);
    if (how.sync) {
      this.clear();
      if (look) this.stage.applyStyle(style, cfg.bg);
      const run = this.build(index, this.items[index].start, 0.6);
      this.finishSettle(run);
      this.land({ run, look: false });
      return;
    }
    if (how.keep && !look && this.carryOn(index)) return;
    this.goTo(index, look);
  }

  /** Jumps to item `index` (skips, the progress bar, a cue card). */
  seek(index: number): void {
    if (!this.items.length) return;
    this.goTo(clamp(Math.round(index), 0, this.items.length - 1), false);
  }

  private goTo(index: number, look: boolean): void {
    if (this.jump) {
      look = look || this.jump.look;
      this.disposeRun(this.jump.run);
    }
    if (this.pending) this.disposeRun(this.pending);
    this.pending = null;
    this.ended = false;
    this.playing = true;
    // A jump starts the item from its beginning, as a seek always has (same enter time, same physics).
    const run = this.build(index, this.items[index].start, 0.6);
    this.jump = { run, look: look && this.running.length > 0 };
    if (look && !this.running.length) this.stage.applyStyle(this.style, this.cfg.bg);
  }

  /** An edit that leaves the playing template in place: re-time it in the new running order. */
  private carryOn(index: number): boolean {
    const prim = this.running[this.running.length - 1];
    const it = this.items[index];
    if (this.jump || !prim || prim.item.def.id !== it.def.id || Math.abs(prim.item.dur - it.dur) > 1e-9) return false;
    const shift = it.start - prim.start;
    for (const r of this.running) r.start += shift;
    this.time += shift;
    this.vclock += shift;
    this.passStart = 0;
    prim.item = it;
    prim.index = index;
    if (this.pending) this.disposeRun(this.pending);
    this.pending = null;
    this.ended = false;
    this.scheduleAfter(prim);
    return true;
  }

  get currentIndex(): number {
    if (this.jump) return this.jump.run.index;
    const r = this.running[this.running.length - 1];
    return r ? r.index : 0;
  }

  /** Time within the current pass of the running order. */
  get passTime(): number {
    return Math.max(0, Math.min(this.total, this.time - this.passStart));
  }

  /** True while an item is still being prepared (exports wait for it). */
  get preparing(): boolean {
    return !!this.jump;
  }

  get bodyCount(): number {
    return this.running.reduce((n, r) => n + Matter.Composite.allBodies(r.engine.world).length, 0);
  }

  // ---------------- lifecycle ----------------

  private make(item: Item, index: number, start: number, enterAt: number, parent: Container): Running {
    const def = item.def;
    const engine = createEngine(def);
    const r = new SceneRenderer(this.style, engine, sceneSeed(this.cfg.seed, def.id, index));
    r.defer = true;
    const root = new Container();
    const camC = new Container();
    camC.addChild(r.root);
    root.addChild(camC);
    root.visible = false;
    parent.addChild(root);
    const sim = buildSim(def, engine, r, { style: this.style, seed: this.cfg.seed, index, duration: item.dur, enterAt, renderer: this.stage.app.renderer });
    return Object.assign(sim, { item, index, start, root, camC, drop: null, segue: item.segue, segueLen: OVERLAP });
  }

  private build(index: number, start: number, enterAt: number): Running {
    return this.make(this.items[index], index, start, enterAt, this.stage.scenes);
  }

  private finishSettle(run: Running): void {
    settleAll(run);
    run.r.flush();
    run.r.defer = false;
  }

  /**
   * This frame's share of preparing what comes next: settle steps and view building, within a
   * time budget. Only the order of work across frames changes — never the physics.
   */
  private prepare(): void {
    if (!this.jump && !this.pending && this.nextIndex >= 0 && this.items.length && this.time >= this.nextStart - this.lead) {
      // Building is one frame's whole share of the work.
      this.pending = this.build(this.nextIndex, this.nextStart, OVERLAP);
      return;
    }
    const run = this.jump?.run ?? this.pending;
    if (!run) return;
    const t0 = performance.now();
    let budget = BUDGET_MS;
    if (run === this.pending) {
      // Spread what is left evenly over the frames before the cut, so none of it lands on the cut.
      const frames = Math.max(1, (this.nextStart - this.time) / Math.max(this.frameDt, 1 / 240));
      const left = run.settle * (this.stepCost.get(run.def.id) ?? 0.8) + run.r.flush(0) * VIEW_MS;
      budget = clamp((left / frames) * 1.3, BUDGET_MS, BUDGET_MAX);
    }
    const deadline = t0 + budget;
    if (run.settle > 0) {
      let n = 0;
      do {
        settleStep(run);
        n++;
      } while (run.settle > 0 && performance.now() < deadline);
      const per = (performance.now() - t0) / n;
      const was = this.stepCost.get(run.def.id);
      this.stepCost.set(run.def.id, was === undefined ? per : was * 0.6 + per * 0.4);
    }
    while (run.settle <= 0 && performance.now() < deadline && run.r.flush(6) > 0);
    const cold = run.settle <= 0 && run.r.flush(0) === 0 ? run.r.warm(this.stage.app.renderer, deadline) : 1;
    if (this.jump && cold === 0 && (!this.jump.look || this.curtain >= 1)) {
      run.r.defer = false;
      this.land(this.jump);
    }
  }

  /** Seconds ahead of its segue at which the next template should start being prepared. */
  private leadFor(def: SceneDef): number {
    const steps = Math.round((def.presettle ?? 0) * 120);
    const ms = steps * (this.stepCost.get(def.id) ?? 0.8) + 24;
    const seconds = (ms / BUDGET_MS) * Math.max(this.frameDt, 1 / 120);
    return clamp(seconds * 1.3 + 0.6, LEAD_MIN, LEAD_MAX);
  }

  /** A prepared jump comes in: the clock moves to the item's place in the running order. */
  private land(j: Jump): void {
    this.jump = null;
    const run = j.run;
    const shift = run.start - this.time;
    for (const r of this.running) r.start += shift;
    this.time = run.start;
    this.vclock += shift;
    this.passStart = 0;
    this.acc = 0;
    this.ended = false;
    if (j.look) {
      this.stage.applyStyle(this.style, this.cfg.bg);
      while (this.running.length) this.disposeRun(this.running.shift()!);
    }
    while (this.running.length > 1) this.disposeRun(this.running.shift()!);
    if (this.running.length) {
      run.segue = 'dip';
      run.segueLen = JUMP_LEN;
    } else {
      run.segue = null;
      if (!j.look) this.fadeIn = 0;
    }
    run.r.flush();
    this.activate(run);
  }

  private activate(run: Running): void {
    run.root.visible = true;
    this.running.push(run);
    this.onItem?.(run.index);
    this.scheduleAfter(run);
  }

  private scheduleAfter(run: Running): void {
    const next = run.index + 1;
    if (next < this.items.length || this.loop) {
      this.nextIndex = next < this.items.length ? next : 0;
      this.nextStart = run.start + run.item.dur - OVERLAP;
      this.lead = this.leadFor(this.items[this.nextIndex].def);
    } else {
      this.nextIndex = -1;
    }
  }

  private stepRun(run: Running, local: number, dt: number): void {
    stepSim(run, local, dt, run.drop ? () => this.dropFloors(run, dt) : undefined);
  }

  private disposeRun(r: Running): void {
    r.inst.dispose?.();
    r.r.destroy();
    Matter.World.clear(r.engine.world, false);
    Matter.Engine.clear(r.engine);
    r.root.destroy({ children: true });
  }

  private clear(): void {
    for (const r of this.running) this.disposeRun(r);
    if (this.pending) this.disposeRun(this.pending);
    if (this.jump) this.disposeRun(this.jump.run);
    this.running = [];
    this.pending = null;
    this.jump = null;
    this.acc = 0;
    this.ended = false;
    this.playing = true;
    this.passStart = 0;
    this.time = 0;
    this.vclock = 0;
  }

  private toWorld(r: Running, p: { x: number; y: number }): { x: number; y: number } {
    return this.stage.world.toLocal(r.camC.toGlobal(p));
  }

  // ---------------- frame loop ----------------

  frame(dtReal: number): void {
    const real = Math.min(Math.max(dtReal, 0), 0.1);
    this.frameDt += (real - this.frameDt) * 0.1;
    if (this.playing && !this.ended && !(this.jump && !this.running.length)) {
      this.acc += real;
      let n = 0;
      while (this.acc >= STEP && n < MAX_STEPS) {
        this.tick();
        this.acc -= STEP;
        n++;
        if (this.ended) break;
      }
      if (this.acc > STEP) this.acc = STEP * 0.5;
    }
    this.prepare();
    // The curtain is part of the interface (a change of look), not of the show.
    if (this.jump?.look) this.curtain = Math.min(1, this.curtain + real / CURTAIN_CLOSE);
    else if (this.curtain > 0) this.curtain = Math.max(0, this.curtain - real / CURTAIN_OPEN);
    this.stage.setCurtain(smooth(this.curtain));
    const alpha = this.ended ? 1 : this.acc / STEP;
    const clock = this.time + alpha * STEP;
    let vdt = clock - this.vclock;
    if (vdt < 0 || vdt > 0.25) vdt = 0;
    this.vclock = clock;
    this.visualTime += vdt;
    if (this.fadeIn < 1) this.fadeIn = Math.min(1, this.fadeIn + (this.playing ? vdt : real) * 1.4);
    this.render(alpha, vdt);
  }

  private tick(): void {
    this.time += STEP;
    if (!this.jump && this.nextIndex >= 0 && this.time >= this.nextStart) {
      // Normally prepared long before; built here only if the machine fell far behind.
      const run = this.pending ?? this.build(this.nextIndex, this.nextStart, OVERLAP);
      this.pending = null;
      this.finishSettle(run);
      if (run.index === 0 && this.running.length) this.passStart = run.start;
      this.activate(run);
      if (run.segue === 'drop') this.openFloors(this.running[this.running.length - 2]);
    }
    for (const run of this.running) this.stepRun(run, this.time - run.start, STEP);
    while (this.running.length > 1 && this.time >= this.running[1].start + this.running[1].segueLen) {
      this.disposeRun(this.running.shift()!);
    }
    const last = this.running[this.running.length - 1];
    if (!this.jump && this.nextIndex < 0 && last && this.time >= last.start + last.item.dur) {
      this.ended = true;
      this.playing = false;
      this.onEnd?.();
    }
  }

  /**
   * "Floor drop": the outgoing template's floors fall away, accelerating faster than gravity,
   * so everything that stood on them is simply left in free fall.
   */
  private openFloors(run: Running | undefined): void {
    if (!run || run.drop || !run.inst.floors?.length) return;
    run.drop = { v: 0, t: 0 };
    for (const b of Matter.Composite.allBodies(run.engine.world)) Matter.Sleeping.set(b, false);
  }

  private dropFloors(run: Running, dt: number): void {
    const d = run.drop!;
    d.t += dt;
    // 4 g: the floor outruns anything resting on it, which therefore falls freely.
    d.v += 4000 * dt;
    const setPos = Matter.Body.setPosition as unknown as (b: Matter.Body, p: Matter.Vector, updateVelocity: boolean) => void;
    for (const b of run.inst.floors ?? []) {
      setPos(b, { x: b.position.x, y: b.position.y + d.v * dt }, true);
      const v = run.r.views.get(b);
      if (v) v.alpha = Math.max(0, 1 - d.t / 0.7);
    }
  }

  /** Simulates forward (without rendering) to local time `t` of the current item. */
  fastForward(t: number): void {
    const run = this.running[this.running.length - 1];
    if (!run) return;
    const target = run.start + t;
    let guard = 0;
    while (this.time < target && !this.ended && guard++ < 120 * 120) this.tick();
    this.vclock = this.time;
    for (const r of this.running) r.r.resetTrails();
  }

  // ---------------- thumbnails & QA ----------------

  private offscreen(def: SceneDef, enterAt: number): { run: Running; holder: Container; setupMs: number } {
    const holder = new Container();
    const t0 = performance.now();
    const run = this.make({ def, dur: def.duration, start: 0, segue: 'dissolve' }, 0, 0, enterAt, holder);
    const setupMs = performance.now() - t0;
    run.root.visible = true;
    return { run, holder, setupMs };
  }

  private still(run: Running, holder: Container, width: number): string {
    const bg = new Sprite(this.stage.bg.sprite.texture);
    bg.width = W;
    bg.height = H;
    holder.addChildAt(bg, 0);
    run.r.resetTrails();
    this.applyCamera(run, 1);
    run.r.render(1, 1 / 60);
    run.inst.afterRender?.();
    if (this.stage.finish) holder.filters = [this.stage.finish];
    const canvas = this.stage.app.renderer.extract.canvas({ target: holder, frame: new Rectangle(0, 0, W, H), resolution: width / W }) as HTMLCanvasElement;
    const url = canvas.toDataURL('image/jpeg', 0.85);
    holder.filters = null;
    this.disposeRun(run);
    holder.destroy({ children: true });
    return url;
  }

  /** A still of the template's establishing state over the current backdrop and grade. */
  thumbnail(def: SceneDef, width = 320): string {
    const { run, holder } = this.offscreen(def, 1e9);
    run.settle = Math.min(run.settle, 360);
    this.finishSettle(run);
    for (let t = 0; t < 0.2; t += STEP) this.stepRun(run, t, STEP);
    return this.still(run, holder, width);
  }

  /** A still of the template at local time t (QA contact sheets): simulated headless, rendered once. */
  snapshot(def: SceneDef, t: number, width = 320): string {
    const { run, holder } = this.offscreen(def, 0.6);
    this.finishSettle(run);
    for (let k = 0; k * STEP < t; k++) this.stepRun(run, k * STEP, STEP);
    return this.still(run, holder, width);
  }

  /** Headless health check of one template (used by the QA harness). */
  qa(def: SceneDef, seconds = 10): Record<string, number | string | boolean> {
    const { run, holder, setupMs } = this.offscreen(def, 0.6);
    const settleT0 = performance.now();
    this.finishSettle(run);
    const settleMs = performance.now() - settleT0;
    const bodies = () => Matter.Composite.allBodies(run.engine.world);
    const total = bodies().length;
    const dynamic = bodies().filter((b) => !b.isStatic).length;
    let maxStartSpeed = 0;
    let worstStep = 0;
    let sumStep = 0;
    let steps = 0;
    let nan = false;
    let escaped = 0;
    const startPos = new Map(bodies().map((b) => [b, { x: b.position.x, y: b.position.y }]));
    for (let t = 0; t < seconds; t += STEP) {
      const s0 = performance.now();
      this.stepRun(run, t, STEP);
      const ms = performance.now() - s0;
      worstStep = Math.max(worstStep, ms);
      sumStep += ms;
      steps++;
      if (t > 0.1 && t < 0.55) for (const b of bodies()) if (!b.isStatic) maxStartSpeed = Math.max(maxStartSpeed, b.speed);
    }
    let moved = 0;
    let endSpeed = 0;
    for (const b of bodies()) if (!b.isStatic) endSpeed = Math.max(endSpeed, b.speed);
    for (const b of bodies()) {
      if (!Number.isFinite(b.position.x) || !Number.isFinite(b.position.y)) nan = true;
      if (Math.abs(b.position.x - W / 2) > 6000 || Math.abs(b.position.y - H / 2) > 6000) escaped++;
      const p = startPos.get(b);
      if (p) moved = Math.max(moved, Math.hypot(b.position.x - p.x, b.position.y - p.y));
    }
    const t0 = performance.now();
    this.applyCamera(run, 1);
    run.r.render(1, 1 / 60);
    const renderMs = performance.now() - t0;
    this.disposeRun(run);
    holder.destroy({ children: true });
    return {
      id: def.id,
      setupMs: +setupMs.toFixed(2),
      settleMs: +settleMs.toFixed(1),
      stepMean: +(sumStep / steps).toFixed(3),
      stepWorst: +worstStep.toFixed(2),
      renderMs: +renderMs.toFixed(2),
      total,
      dynamic,
      nan,
      escaped,
      moved: Math.round(moved),
      endSpeed: +endSpeed.toFixed(2),
      startSpeed: +maxStartSpeed.toFixed(2),
      calmStart: def.movingStart ? true : maxStartSpeed < 0.6,
    };
  }

  /** Development probe: runs a template headlessly and samples where its moving bodies are. */
  probe(def: SceneDef, times: number[], inspect?: (world: Matter.World, t: number) => unknown): Record<string, unknown>[] {
    const { run, holder } = this.offscreen(def, 0.6);
    if (inspect) inspect(run.engine.world, -1);
    this.finishSettle(run);
    const out: Record<string, unknown>[] = [];
    const end = Math.max(...times);
    let k = 0;
    for (let t = 0; t <= end + 1e-6; t += STEP) {
      this.stepRun(run, t, STEP);
      while (k < times.length && t >= times[k] - 1e-9) {
        const dyn = Matter.Composite.allBodies(run.engine.world).filter((b) => !b.isStatic);
        const heroes = dyn.filter((b) => {
          const role = run.r.views.get(b)?.opts.role;
          return role === 'hero' || role === 'accent';
        });
        out.push({
          t: times[k],
          n: dyn.length,
          inView: dyn.filter((b) => b.position.x > -40 && b.position.x < W + 40 && b.position.y > -40 && b.position.y < H + 40).length,
          maxSpeed: +dyn.reduce((m, b) => Math.max(m, b.speed), 0).toFixed(2),
          heroes: heroes.slice(0, 14).map((b) => [Math.round(b.position.x), Math.round(b.position.y), +b.angle.toFixed(2)]),
          dyn: dyn.slice(0, 4).map((b) => [Math.round(b.position.x), Math.round(b.position.y), +b.angle.toFixed(2), +b.speed.toFixed(1)]),
          cam: [Math.round(run.camera.x), Math.round(run.camera.y), +run.camera.zoom.toFixed(2)],
          x: inspect?.(run.engine.world, times[k]),
        });
        k++;
      }
    }
    this.disposeRun(run);
    holder.destroy({ children: true });
    return out;
  }

  // ---------------- rendering ----------------

  private applyCamera(run: Running, alpha: number): void {
    const c = run.camera.view(alpha);
    run.camC.pivot.set(c.x, c.y);
    run.camC.position.set(W / 2, H / 2);
    run.camC.scale.set(c.zoom);
    run.camC.rotation = c.angle;
  }

  private render(alpha: number, dt: number): void {
    for (const run of this.running) {
      this.applyCamera(run, alpha);
      run.root.pivot.set(W / 2, H / 2);
      run.root.position.set(W / 2, H / 2);
      run.root.scale.set(1);
      run.root.alpha = 1;
      run.root.mask = null;
      run.root.filters = null;
      run.r.render(alpha, dt);
      run.inst.afterRender?.();
    }
    if (this.fadeIn < 1) {
      const r = this.running[this.running.length - 1];
      if (r) r.root.alpha = easeOutCubic(this.fadeIn);
    }
    this.renderSegue(alpha);
    const primary = this.running[this.running.length - 1];
    let b = { x: 0, y: 0, z: 1 };
    if (primary) {
      // The backdrop's parallax follows the camera, blended across a segue so it never jumps;
      // tall templates (a camera far below the frame) are eased so the sky does not run away.
      const cam = (r: Running) => {
        const c = r.camera.view(alpha);
        const slide = (r.root.x - W / 2) / W;
        const dy = (c.y - H / 2) / H;
        return { x: (c.x - W / 2) / H + slide * 0.5, y: dy / (1 + Math.abs(dy) * 0.8), z: c.zoom };
      };
      b = cam(primary);
      const prev = this.running[this.running.length - 2];
      if (prev) {
        const a = cam(prev);
        const e = easeInOutSine(clamp((this.time + alpha * STEP - primary.start) / primary.segueLen));
        b = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, z: a.z + (b.z - a.z) * e };
      }
    }
    this.stage.bg.update(this.stage.app.renderer, this.visualTime, b.x, b.y, b.z);
    if (this.stage.finish) this.stage.finish.time = this.visualTime;
  }

  private renderSegue(alpha: number): void {
    const live = this.running.length >= 2;
    const B = this.running[this.running.length - 1];
    const A = this.running[this.running.length - 2];
    const p = live ? clamp((this.time + alpha * STEP - B.start) / B.segueLen) : 1;
    const kind = live ? B.segue : null;
    if (!(live && kind === 'iris' && p < 1) && this.iris.parent) this.iris.parent.removeChild(this.iris);
    if (!live || !kind) return;
    const e = easeInOutSine(p);
    const breath = Math.sin(Math.PI * p);
    switch (kind) {
      case 'glide': {
        // One long take: both stages sit side by side and the view travels between them.
        const s = 1 - 0.045 * breath;
        A.root.position.set(W / 2 - W * e * s, H / 2);
        B.root.position.set(W / 2 + W * (1 - e) * s, H / 2);
        A.root.scale.set(s);
        B.root.scale.set(s);
        break;
      }
      case 'dissolve': {
        // A staggered crossfade (less double exposure on opaque looks) with a shared drift.
        A.root.alpha = 1 - smooth(clamp(p / 0.72));
        B.root.alpha = smooth(clamp((p - 0.28) / 0.72));
        A.root.position.x = W / 2 - 70 * e;
        B.root.position.x = W / 2 + 70 * (1 - e);
        A.root.scale.set(1 + 0.02 * e);
        B.root.scale.set(1.02 - 0.02 * e);
        break;
      }
      case 'dip': {
        // Down to the backdrop and back up.
        A.root.alpha = 1 - smooth(clamp(p * 2));
        B.root.alpha = smooth(clamp(p * 2 - 1));
        B.root.scale.set(1.03 - 0.03 * smooth(clamp(p * 2 - 1)));
        break;
      }
      case 'zoom': {
        // Push into the outgoing focal point; the next stage resolves out of it.
        const f = this.toWorld(A, A.inst.entry);
        const s = 1 + 1.1 * Math.pow(e, 1.6);
        A.root.pivot.set(f.x, f.y);
        A.root.position.set(f.x, f.y);
        A.root.scale.set(s);
        A.root.alpha = 1 - smooth(clamp((p - 0.25) / 0.55));
        B.root.alpha = smooth(clamp((p - 0.2) / 0.6));
        B.root.scale.set(0.9 + 0.1 * easeOutCubic(p));
        break;
      }
      case 'drop': {
        // The floor opened at the cut; the old stage falls away and the new one settles in from above.
        // The old stage is gone before the new one is solid (no long double exposure), and the new one
        // comes down quickly and lands softly.
        A.root.position.y = H / 2 + H * 0.18 * Math.pow(p, 1.5);
        A.root.alpha = 1 - smooth(clamp((p - 0.15) / 0.45));
        B.root.position.y = H / 2 - H * 0.35 * (1 - easeOutCubic(p));
        B.root.alpha = smooth(clamp((p - 0.12) / 0.5));
        break;
      }
      case 'iris': {
        const c = this.toWorld(B, B.inst.entry);
        this.iris.clear().circle(c.x, c.y, Math.max(1, Math.hypot(W, H) * 1.05 * e)).fill(0xffffff);
        if (!this.iris.parent) this.stage.world.addChild(this.iris);
        B.root.mask = p < 1 ? this.iris : null;
        A.root.alpha = 1 - 0.75 * e;
        A.root.scale.set(1 + 0.03 * e);
        break;
      }
      case 'ink': {
        const area = this.inkArea;
        const local = B.root.toLocal(B.camC.toGlobal(B.inst.entry));
        this.ink.origin((local.x - area.x) / area.width, (local.y - area.y) / area.height);
        this.ink.progress = p;
        if (p < 1) {
          B.root.filters = [this.ink];
          B.root.filterArea = area;
        }
        // The old scene washes out as the ink spreads, so it never shows through the new one's paper.
        A.root.alpha = 1 - smooth(clamp(p * 1.7 - 0.2));
        break;
      }
    }
  }

  /** Compiles every shader and builds every shared texture before the first frame is shown. */
  prewarm(): void {
    const probe = new Container();
    const g = new Graphics().rect(0, 0, 64, 64).fill(0xffffff);
    probe.addChild(g);
    probe.filters = [this.ink];
    probe.filterArea = new Rectangle(0, 0, 64, 64);
    const target = new Container();
    target.addChild(probe);
    if (this.stage.finish) target.filters = [this.stage.finish];
    this.stage.app.renderer.render({ container: target });
    this.stage.bg.update(this.stage.app.renderer, 0, 0, 0, 1);
    target.destroy({ children: true });
  }

  dispose(): void {
    this.clear();
  }
}
