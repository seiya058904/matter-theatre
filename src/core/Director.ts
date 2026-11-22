import { Container, Graphics, Rectangle, Sprite } from 'pixi.js';
import Matter from 'matter-js';
import { Camera } from './Camera';
import { Timeline } from './Timeline';
import { Rng, hashString } from './rng';
import { clamp, easeInOutSine, easeOutCubic, smooth } from './ease';
import { H, STEP, W, type SceneContext, type SceneDef, type SceneInstance } from './types';
import { SceneRenderer } from '../render/SceneRenderer';
import type { Stage } from './Stage';
import type { StyleDef } from '../styles/types';
import { LEN_SCALE, OVERLAP, type Segue, type ShowConfig } from '../show/ShowConfig';
import { InkRevealFilter } from '../fx/filters';
import { schedule } from '../show/schedule';
import { chooseSegues } from '../show/segues';

export interface Item {
  def: SceneDef;
  dur: number;
  /** Start within one pass of the running order. */
  start: number;
  /** Segue used when this item comes in. */
  segue: Segue;
}

interface Running {
  item: Item;
  /** Position in the running order. */
  index: number;
  /** Global start time of this run. */
  start: number;
  inst: SceneInstance;
  engine: Matter.Engine;
  r: SceneRenderer;
  camera: Camera;
  tl: Timeline;
  root: Container;
  camC: Container;
  entered: boolean;
  enterAt: number;
  local: number;
  slow: { from: number; to: number; t0: number; ease: number; hold: number } | null;
  /** Off-screen settling steps still to run before the run is shown. */
  settle: number;
  dropped: boolean;
}

/** At most this many physics steps per rendered frame; beyond it time is dropped, never piled up. */
const MAX_STEPS = 4;
/** The next template is built this long before its segue starts (spreads cost away from the cut). */
const PREBUILD = 2.2;
/** Off-screen settling steps per frame. */
const SETTLE_PER_FRAME = 5;

/**
 * Plays a running order of templates: builds each one early, settles it off-screen,
 * runs every live template on a fixed 120 Hz step, performs the segues and loops.
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
  private nextIndex = 0;
  private nextStart = 0;
  private passStart = 0;
  private acc = 0;
  private visualTime = 0;
  private style!: StyleDef;
  private cfg!: ShowConfig;
  private iris = new Graphics();
  private ink = new InkRevealFilter();
  private inkArea = new Rectangle(-240, -240, W + 480, H + 480);
  private fadeIn = 1;
  private ended = false;
  private headless = false;

  constructor(
    private stage: Stage,
    private lookup: (id: string) => SceneDef | undefined,
  ) {}

  // ---------------- running order ----------------

  load(cfg: ShowConfig, style: StyleDef, startAt = 0): void {
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
    this.seek(startAt);
  }

  /** Restart playback from the beginning of item `index`. */
  seek(index: number): void {
    for (const r of this.running) this.disposeRun(r);
    if (this.pending) this.disposeRun(this.pending);
    this.running = [];
    this.pending = null;
    this.acc = 0;
    this.ended = false;
    this.playing = true;
    if (!this.items.length) return;
    index = clamp(Math.round(index), 0, this.items.length - 1);
    this.time = this.items[index].start;
    this.passStart = 0;
    this.nextIndex = index;
    this.nextStart = this.time;
    const run = this.build(index, this.time, 0.6);
    this.finishSettle(run);
    this.activate(run);
    this.fadeIn = 0;
  }

  get currentIndex(): number {
    const r = this.running[this.running.length - 1];
    return r ? r.index : 0;
  }

  /** Time within the current pass of the running order. */
  get passTime(): number {
    return Math.max(0, Math.min(this.total, this.time - this.passStart));
  }

  get bodyCount(): number {
    return this.running.reduce((n, r) => n + Matter.Composite.allBodies(r.engine.world).length, 0);
  }

  // ---------------- lifecycle ----------------

  private build(index: number, start: number, enterAt: number, parent: Container = this.stage.scenes): Running {
    const item = this.items[index];
    const def = item.def;
    const engine = Matter.Engine.create({ gravity: { x: def.gravity?.x ?? 0, y: def.gravity?.y ?? 1, scale: 0.001 } });
    engine.positionIterations = 8;
    engine.velocityIterations = 6;
    engine.constraintIterations = 3;
    const camera = new Camera();
    const r = new SceneRenderer(this.style, engine);
    r.defer = true;
    const tl = new Timeline();
    const rng = new Rng((this.cfg.seed ^ hashString(def.id) ^ (index * 2654435761)) >>> 0);
    const root = new Container();
    const camC = new Container();
    camC.addChild(r.root);
    root.addChild(camC);
    root.visible = false;
    parent.addChild(root);
    const run: Running = { item, index, start, inst: null as unknown as SceneInstance, engine, r, camera, tl, root, camC, entered: false, enterAt, slow: null, local: 0, settle: Math.round((def.presettle ?? 0) * 120), dropped: false };
    const ctx: SceneContext = {
      engine,
      world: engine.world,
      root: r.root,
      style: this.style,
      camera,
      tl,
      rng,
      r,
      renderer: this.stage.app.renderer,
      duration: item.dur,
      enterAt,
      slowmo: (to, hold, ease = 0.35) => {
        run.slow = { from: engine.timing.timeScale, to, t0: run.local, ease, hold };
      },
    };
    run.inst = def.setup(ctx);
    return run;
  }

  /** Off-screen settling: physics only, the template's clock does not run. */
  private settleSteps(run: Running, n: number): void {
    for (let i = 0; i < n && run.settle > 0; i++, run.settle--) {
      run.r.snapshot();
      Matter.Engine.update(run.engine, STEP * 1000);
    }
  }

  private finishSettle(run: Running): void {
    this.settleSteps(run, run.settle);
    run.r.flush();
    run.r.defer = false;
  }

  private activate(run: Running): void {
    run.root.visible = true;
    this.running.push(run);
    this.onItem?.(run.index);
    const next = run.index + 1;
    if (next < this.items.length) {
      this.nextIndex = next;
      this.nextStart = run.start + run.item.dur - OVERLAP;
    } else if (this.loop) {
      this.nextIndex = 0;
      this.nextStart = run.start + run.item.dur - OVERLAP;
    } else {
      this.nextIndex = -1;
    }
  }

  private stepRun(run: Running, local: number, dt: number): void {
    run.local = local;
    if (run.slow) {
      const s = run.slow;
      const k = local - s.t0;
      let scale: number;
      if (k < s.ease) scale = s.from + (s.to - s.from) * smooth(k / s.ease);
      else if (k < s.ease + s.hold) scale = s.to;
      else if (k < s.ease * 3 + s.hold) scale = s.to + (1 - s.to) * smooth((k - s.ease - s.hold) / (s.ease * 2));
      else {
        scale = 1;
        run.slow = null;
      }
      run.engine.timing.timeScale = scale;
    }
    run.r.snapshot();
    if (!run.entered && local >= run.enterAt) {
      run.entered = true;
      run.inst.enter?.();
    }
    run.tl.advance(local);
    run.inst.step?.(local, dt);
    Matter.Engine.update(run.engine, dt * 1000);
    if (this.headless) run.camera.update(dt);
  }

  private disposeRun(r: Running): void {
    r.inst.dispose?.();
    r.r.destroy();
    Matter.World.clear(r.engine.world, false);
    Matter.Engine.clear(r.engine);
    r.root.destroy({ children: true });
  }

  private toWorld(r: Running, p: { x: number; y: number }): { x: number; y: number } {
    return this.stage.world.toLocal(r.camC.toGlobal(p));
  }

  // ---------------- frame loop ----------------

  frame(dtReal: number): void {
    const dt = this.playing ? Math.min(dtReal, 0.1) : 0;
    if (this.playing && !this.ended) {
      this.acc += dt;
      let n = 0;
      while (this.acc >= STEP && n < MAX_STEPS) {
        this.tick();
        this.acc -= STEP;
        n++;
        if (this.ended) break;
      }
      if (this.acc > STEP) this.acc = STEP * 0.5;
      // Spread the next template's preparation over the frames before it appears.
      if (this.pending) {
        if (this.pending.settle > 0) this.settleSteps(this.pending, SETTLE_PER_FRAME);
        this.pending.r.flush(24);
      }
    }
    this.visualTime += dtReal;
    if (this.fadeIn < 1) this.fadeIn = Math.min(1, this.fadeIn + Math.min(dtReal, 0.1) * 1.4);
    this.render(this.ended ? 1 : this.acc / STEP, dt);
  }

  private tick(): void {
    this.time += STEP;
    if (this.nextIndex >= 0 && !this.pending && this.time >= this.nextStart - PREBUILD) {
      this.pending = this.build(this.nextIndex, this.nextStart, OVERLAP);
    }
    if (this.pending && this.time >= this.nextStart) {
      const run = this.pending;
      this.pending = null;
      this.finishSettle(run);
      if (run.index === 0 && this.running.length) this.passStart = run.start;
      this.activate(run);
      if (run.item.segue === 'drop') this.openFloors(this.running[this.running.length - 2]);
    }
    for (const run of this.running) this.stepRun(run, this.time - run.start, STEP);
    while (this.running.length > 1 && this.time >= this.running[0].start + this.running[0].item.dur) {
      this.disposeRun(this.running.shift()!);
    }
    const last = this.running[this.running.length - 1];
    if (this.nextIndex < 0 && last && this.time >= last.start + last.item.dur) {
      this.ended = true;
      this.playing = false;
      this.onEnd?.();
    }
  }

  /** "Floor drop": the outgoing template's floors open and everything falls away under gravity. */
  private openFloors(run: Running | undefined): void {
    if (!run || run.dropped) return;
    run.dropped = true;
    for (const b of run.inst.floors ?? []) {
      Matter.Composite.remove(run.engine.world, b, true);
      const v = run.r.views.get(b);
      if (v) v.alpha = 0;
    }
    for (const b of Matter.Composite.allBodies(run.engine.world)) Matter.Sleeping.set(b, false);
  }

  /** Simulates forward (without rendering) to local time `t` of the current item. */
  fastForward(t: number): void {
    const run = this.running[this.running.length - 1];
    if (!run) return;
    const target = run.start + t;
    this.headless = true;
    let guard = 0;
    while (this.time < target && !this.ended && guard++ < 120 * 120) this.tick();
    this.headless = false;
  }

  // ---------------- thumbnails & QA ----------------

  private offscreen(def: SceneDef, enterAt: number): { run: Running; holder: Container; setupMs: number } {
    const holder = new Container();
    const saved = this.items;
    this.items = [{ def, dur: def.duration, start: 0, segue: 'dissolve' }];
    const t0 = performance.now();
    const run = this.build(0, 0, enterAt, holder);
    const setupMs = performance.now() - t0;
    this.items = saved;
    run.root.visible = true;
    return { run, holder, setupMs };
  }

  /** A still of the template's establishing state over the current backdrop and grade. */
  thumbnail(def: SceneDef, width = 320): string {
    const { run, holder } = this.offscreen(def, 1e9);
    const bg = new Sprite(this.stage.bg.sprite.texture);
    bg.width = W;
    bg.height = H;
    holder.addChildAt(bg, 0);
    run.settle = Math.min(run.settle, 90);
    this.finishSettle(run);
    this.headless = true;
    for (let t = 0; t < 0.2; t += STEP) this.stepRun(run, t, STEP);
    this.headless = false;
    this.applyCamera(run);
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
    this.headless = true;
    for (let t = 0; t < seconds; t += STEP) {
      const s0 = performance.now();
      this.stepRun(run, t, STEP);
      const ms = performance.now() - s0;
      worstStep = Math.max(worstStep, ms);
      sumStep += ms;
      steps++;
      if (t > 0.1 && t < 0.55) for (const b of bodies()) if (!b.isStatic) maxStartSpeed = Math.max(maxStartSpeed, b.speed);
    }
    this.headless = false;
    let moved = 0;
    for (const b of bodies()) {
      if (!Number.isFinite(b.position.x) || !Number.isFinite(b.position.y)) nan = true;
      if (Math.abs(b.position.x - W / 2) > 6000 || Math.abs(b.position.y - H / 2) > 6000) escaped++;
      const p = startPos.get(b);
      if (p) moved = Math.max(moved, Math.hypot(b.position.x - p.x, b.position.y - p.y));
    }
    const t0 = performance.now();
    this.applyCamera(run);
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
    this.headless = true;
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
    this.headless = false;
    this.disposeRun(run);
    holder.destroy({ children: true });
    return out;
  }

  // ---------------- rendering ----------------

  private applyCamera(run: Running): void {
    const c = run.camera;
    run.camC.pivot.set(c.x + c.shakeX, c.y + c.shakeY);
    run.camC.position.set(W / 2, H / 2);
    run.camC.scale.set(c.zoom);
    run.camC.rotation = c.angle + c.shakeA;
  }

  private render(alpha: number, dt: number): void {
    for (const run of this.running) {
      if (dt > 0) run.camera.update(dt);
      this.applyCamera(run);
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
    if (primary) {
      const c = primary.camera;
      const slide = (primary.root.x - W / 2) / W;
      this.stage.bg.update(this.stage.app.renderer, this.visualTime, (c.x - W / 2) / H + slide * 0.5, (c.y - H / 2) / H, c.zoom);
    }
    if (this.stage.finish) this.stage.finish.time = this.visualTime;
  }

  private renderSegue(alpha: number): void {
    const live = this.running.length >= 2;
    const B = this.running[this.running.length - 1];
    const A = this.running[this.running.length - 2];
    const p = live ? clamp((this.time + alpha * STEP - B.start) / OVERLAP) : 1;
    const kind = live ? B.item.segue : null;
    if (!(live && kind === 'iris' && p < 1) && this.iris.parent) this.iris.parent.removeChild(this.iris);
    if (!live || !kind) return;
    const e = easeInOutSine(p);
    const breath = Math.sin(Math.PI * p);
    switch (kind) {
      case 'glide': {
        // One long take: both stages sit side by side and the view travels between them.
        const s = 1 - 0.07 * breath;
        A.root.position.set(W / 2 - W * e * s, H / 2);
        B.root.position.set(W / 2 + W * (1 - e) * s, H / 2);
        A.root.scale.set(s);
        B.root.scale.set(s);
        break;
      }
      case 'dissolve': {
        // Crossfade with a shared drift so motion never stops.
        A.root.alpha = 1 - e;
        B.root.alpha = e;
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
        A.root.position.y = H / 2 + H * 0.18 * Math.pow(p, 1.5);
        A.root.alpha = 1 - smooth(clamp((p - 0.35) / 0.55));
        B.root.position.y = H / 2 - H * 0.35 * (1 - e);
        B.root.alpha = smooth(clamp(p / 0.7));
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
        A.root.alpha = 1 - smooth(clamp(p * 1.3 - 0.3));
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
    for (const r of this.running) this.disposeRun(r);
    if (this.pending) this.disposeRun(this.pending);
    this.running = [];
    this.pending = null;
  }
}
