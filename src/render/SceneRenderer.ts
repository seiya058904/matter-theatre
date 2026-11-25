import { Container, Graphics, GraphicsContext, MeshRope, Point, RenderTexture, Sprite, Texture, type Renderer } from 'pixi.js';
import Matter from 'matter-js';
import type { Role } from '../core/types';
import type { Look, Pt, Shape, StyleDef, TrailKind } from '../styles/types';
import { Fx, particleTexture } from './Fx';
import { mix, ramp } from '../styles/color';

type Body = Matter.Body;

export interface BodyOpts {
  role: Role;
  /** Position along the style ramp (hero/debris). */
  hue?: number;
  /** Explicit colour override (rarely needed). */
  color?: number;
  /** Trail length multiplier (true = 1). */
  trail?: boolean | number;
  weight?: number;
  /** Physics-only body (still interpolated, never drawn). */
  hidden?: boolean;
  /** Draw above everything else in the scene. */
  front?: boolean;
  /** Emit collision feedback for this body (default true). */
  impacts?: boolean;
}

type Interp = Body & { _px?: number; _py?: number; _pa?: number };

/** Trails take one sample per this much show time. */
const TRAIL_DT = 1 / 60;

const trailTex = new Map<TrailKind, Texture>();

/** Rope textures: u runs tail → head, so the taper and fade are baked in. */
function trailTexture(kind: TrailKind): Texture {
  const hit = trailTex.get(kind);
  if (hit) return hit;
  const Wd = 256;
  const Hd = 32;
  const c = document.createElement('canvas');
  c.width = Wd;
  c.height = Hd;
  const g = c.getContext('2d')!;
  const img = g.createImageData(Wd, Hd);
  for (let x = 0; x < Wd; x++) {
    const u = x / (Wd - 1);
    const half = 0.12 + 0.88 * Math.pow(u, 0.8);
    for (let y = 0; y < Hd; y++) {
      const v = Math.abs(y / (Hd - 1) - 0.5) * 2;
      let a = 0;
      if (kind === 'soft') a = Math.exp(-Math.pow(v / half, 2) * 2.6) * Math.pow(u, 1.5);
      else if (kind === 'crisp') a = (v < half * 0.55 ? 1 : v < half * 0.7 ? 0.5 : 0) * Math.pow(u, 1.2);
      else if (kind === 'brush') {
        const edge = half * (0.75 + 0.25 * Math.sin(x * 0.37) * Math.sin(x * 0.11 + y));
        a = (v < edge ? 0.9 : 0) * Math.pow(u, 0.9) * (0.75 + 0.25 * Math.sin(x * 1.7 + y * 0.9));
      } else if (kind === 'dash') a = (v < 0.35 && Math.floor(u * 18) % 2 === 0 ? 1 : 0) * Math.pow(u, 0.7);
      else if (kind === 'blocks') a = (v < half * 0.6 && x % 22 < 14 ? 1 : 0) * (Math.ceil(u * 6) / 6);
      const i = (y * Wd + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(Math.max(0, Math.min(1, a)) * 255);
    }
  }
  g.putImageData(img, 0, 0);
  const t = Texture.from(c);
  trailTex.set(kind, t);
  return t;
}

/**
 * Builds every trail and particle texture up front and draws each once off-screen, so it is
 * already on the GPU: the first impact or trail of a show never hitches.
 */
export function prewarmTextures(renderer?: Renderer): void {
  const textures = [
    ...(['soft', 'crisp', 'brush', 'dash', 'blocks'] as TrailKind[]).map(trailTexture),
    ...(['dot', 'spark', 'square', 'shard', 'flake', 'blot', 'mote'] as const).map(particleTexture),
  ];
  if (!renderer) return;
  const holder = new Container();
  textures.forEach((t, i) => {
    const s = new Sprite(t);
    s.position.set(i * 4, 0);
    s.scale.set(0.05);
    holder.addChild(s);
  });
  const rt = RenderTexture.create({ width: 64, height: 16 });
  renderer.render({ container: holder, target: rt, clear: true });
  holder.destroy({ children: true });
  rt.destroy(true);
}

/** A motion trail drawn as one GPU rope mesh (no per-frame geometry building on the CPU). */

class Trail {
  readonly rope: MeshRope;
  private hist: Pt[] = [];
  private points: Point[];
  constructor(
    readonly n: number,
    kind: TrailKind,
    width: number,
    blend: StyleDef['trail']['blend'],
    color: number,
    x: number,
    y: number,
  ) {
    this.points = Array.from({ length: n }, (_, i) => new Point(x + i * 0.01, y));
    this.rope = new MeshRope({ texture: trailTexture(kind), points: this.points, width, textureScale: 0 });
    this.rope.blendMode = blend;
    this.rope.tint = color;
    for (let i = 0; i < n; i++) this.hist.push({ x, y });
  }
  /** Collapses the trail onto one point (after a headless jump, so it does not draw one long streak). */
  reset(x: number, y: number): void {
    for (let i = 0; i < this.n; i++) {
      this.hist[i].x = x;
      this.hist[i].y = y;
      this.points[i].set(x + i * 0.01, y + i * 0.003);
    }
  }

  /**
   * Advances the trail: `steps` new samples (one per 1/60 s of show time, so a trail is equally long
   * at any refresh rate), spread from the last sample to the body; otherwise only the head follows.
   */
  push(x: number, y: number, steps: number): void {
    const last = this.hist[this.n - 1];
    const lx = last.x;
    const ly = last.y;
    for (let k = 1; k <= steps; k++) {
      const h = this.hist.shift()!;
      h.x = lx + ((x - lx) * k) / steps;
      h.y = ly + ((y - ly) * k) / steps;
      this.hist.push(h);
    }
    if (!steps) {
      last.x = x;
      last.y = y;
    }
    for (let i = 0; i < this.n; i++) {
      // A tiny monotonic offset keeps the rope's normals defined when a body rests.
      this.points[i].set(this.hist[i].x + i * 0.01, this.hist[i].y + i * 0.003);
    }
  }
}

/**
 * Shared, reference-counted geometry. Identical bodies (same shape, colour and look) draw
 * from one tessellated GraphicsContext, so spawning a template costs almost nothing.
 */
const contexts = new Map<string, { ctx: GraphicsContext; refs: number }>();

function shapeKey(shapes: Shape[]): string {
  let k = '';
  for (const s of shapes) {
    if (s.kind === 'circle') k += `c${Math.round(s.r * 4)},${Math.round((s.x ?? 0) * 4)},${Math.round((s.y ?? 0) * 4)};`;
    else for (const p of s.pts) k += `${Math.round(p.x * 4)},${Math.round(p.y * 4)} `;
    k += '|';
  }
  return k;
}

function acquire(key: string, draw: (g: Graphics) => void): GraphicsContext {
  const hit = contexts.get(key);
  if (hit) {
    hit.refs++;
    return hit.ctx;
  }
  const ctx = new GraphicsContext();
  const g = new Graphics(ctx);
  draw(g);
  g.destroy();
  contexts.set(key, { ctx, refs: 1 });
  return ctx;
}

function releaseCtx(key: string): void {
  const hit = contexts.get(key);
  if (!hit) return;
  if (--hit.refs <= 0) {
    hit.ctx.destroy();
    contexts.delete(key);
  }
}

/** Number of live shared geometries (for QA). */
export const contextCount = () => contexts.size;

/** Geometries already drawn once (tessellated and prepared on the GPU). */
const warmed = new WeakSet<GraphicsContext>();
let warmTarget: RenderTexture | null = null;

export class BodyView {
  flash = 0;
  alpha = 1;
  scale = 1;
  trail: Trail | null = null;
  /** Transform node; holds the body graphic and its impact highlight. */
  readonly node = new Container();
  gfx: Graphics;
  hi: Graphics | null = null;
  shadow: Graphics | null = null;
  /** Cartoon squash-and-stretch rig (render only). */
  sq: Container | null = null;
  inner: Container | null = null;
  stretch = 1;
  /** Impact squash: a damped spring (render only) along the last contact normal. */
  squash = 0;
  squashV = 0;
  squashDir = 0;
  built = false;
  /** The shared geometries this view draws with. */
  readonly ctxs: GraphicsContext[] = [];
  private keys: string[] = [];

  constructor(
    readonly body: Body,
    readonly look: Look,
    readonly opts: BodyOpts,
    private style: StyleDef,
    private shadowLayer: Container | null,
  ) {
    this.gfx = new Graphics();
  }

  /** Builds the Pixi side (shared geometry, highlight, shadow). Deferred while a template is off-screen. */
  build(): void {
    if (this.opts.hidden || this.built) return;
    this.built = true;
    const shapes = shapesOf(this.body);
    const st = this.style;
    // Seeds are bucketed so that look-alike bodies share geometry.
    const bucket = Math.floor(this.look.seed * 4);
    const look = { ...this.look, seed: (bucket + 0.5) / 4 };
    const base = `${st.id}|${look.role}|${look.color}|${look.weight ?? 0}|${bucket}|${shapeKey(shapes)}`;
    const kBody = 'b' + base;
    const kHi = 'h' + base;
    this.keys.push(kBody, kHi);
    this.gfx = new Graphics(acquire(kBody, (g) => st.drawBody(g, shapes, look)));
    this.gfx.blendMode = st.blend;
    this.hi = new Graphics(acquire(kHi, (g) => st.drawFlash(g, shapes, look)));
    this.ctxs.length = 0;
    this.ctxs.push(this.gfx.context, this.hi.context);
    this.hi.blendMode = st.flashBlend ?? 'add';
    this.hi.alpha = 0;
    this.hi.visible = false;
    const role = this.opts.role;
    if (st.squash && !this.body.isStatic && (role === 'hero' || role === 'accent' || role === 'debris')) {
      this.sq = new Container();
      this.inner = new Container();
      this.node.addChild(this.sq);
      this.sq.addChild(this.inner);
      this.inner.addChild(this.gfx, this.hi);
    } else {
      this.node.addChild(this.gfx, this.hi);
    }
    if (this.shadowLayer && st.shadow && this.opts.role !== 'ghost') {
      const sh = st.shadow;
      const kSh = 's' + base;
      this.keys.push(kSh);
      this.shadow = new Graphics(
        acquire(kSh, (g) => {
          for (const s of shapes) {
            // Soft edge from a wide translucent stroke: a blur without a blur filter.
            if (sh.soft > 0) traceShape(g, s).stroke({ width: sh.soft, color: sh.color, alpha: 0.35, join: 'round' });
            traceShape(g, s).fill({ color: sh.color, alpha: 1 });
          }
        }),
      );
      this.shadowLayer.addChild(this.shadow);
      this.ctxs.push(this.shadow.context);
    }
  }

  /** Rebuild after the body's shape or look changed. */
  redraw(): void {
    if (this.opts.hidden) return;
    if (!this.built) return;
    this.built = false;
    this.release();
    this.node.removeChildren();
    this.sq?.destroy({ children: false });
    this.inner?.destroy({ children: false });
    this.sq = this.inner = null;
    this.gfx.destroy();
    this.hi?.destroy();
    this.shadow?.destroy();
    this.shadow = null;
    this.build();
  }

  private release(): void {
    for (const k of this.keys) releaseCtx(k);
    this.keys = [];
  }

  destroy(): void {
    this.node.destroy({ children: true });
    this.shadow?.destroy();
    this.trail?.rope.destroy();
    this.release();
  }
}

/** Shapes of a body in its local (unrotated) frame. */
export function shapesOf(b: Body): Shape[] {
  // Sensor parts (an air pocket inside a hull) are physics only.
  const parts = b.parts.length > 1 ? b.parts.slice(1).filter((p) => !p.isSensor) : [b];
  const c = Math.cos(-b.angle);
  const s = Math.sin(-b.angle);
  const local = (x: number, y: number) => {
    const dx = x - b.position.x;
    const dy = y - b.position.y;
    return { x: dx * c - dy * s, y: dx * s + dy * c };
  };
  return parts.map((p): Shape => {
    if (p.circleRadius) {
      const o = local(p.position.x, p.position.y);
      return { kind: 'circle', r: p.circleRadius, x: o.x, y: o.y };
    }
    return { kind: 'poly', pts: p.vertices.map((v) => local(v.x, v.y)) };
  });
}

/** Traces a shape path (no fill/stroke). */
export function traceShape(g: Graphics, s: Shape): Graphics {
  if (s.kind === 'circle') return g.circle(s.x ?? 0, s.y ?? 0, s.r);
  if (s.kind === 'poly') return g.poly(s.pts.flatMap((p) => [p.x, p.y]), true);
  return traceSmooth(g, s.pts);
}

/** Closed quadratic spline through midpoints: a soft, organic outline. */
export function traceSmooth(g: Graphics, pts: Pt[]): Graphics {
  const n = pts.length;
  if (n < 3) return g;
  const m = (a: Pt, b: Pt) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const s = m(pts[n - 1], pts[0]);
  g.moveTo(s.x, s.y);
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = m(p, pts[(i + 1) % n]);
    g.quadraticCurveTo(p.x, p.y, q.x, q.y);
  }
  return g.closePath();
}

interface LinkItem {
  pts: () => Pt[];
  look: Look;
  width: number;
}
interface BlobItem {
  bodies: Body[];
  look: Look;
  inflate: number;
  front: boolean;
}
type Drawer = (g: Graphics, dt: number) => void;

/** A persistent pen line, kept as frozen chunks so only the newest stretch is rebuilt each frame. */
class Pen {
  readonly layer = new Container();
  private pts: Pt[] = [];
  private live = new Graphics();
  private dirty = false;
  constructor(
    private style: StyleDef,
    private look: Look,
    private width: number,
  ) {
    this.layer.addChild(this.live);
  }
  add(x: number, y: number): void {
    const last = this.pts[this.pts.length - 1];
    if (last && Math.hypot(x - last.x, y - last.y) < 1.5) return;
    this.pts.push({ x, y });
    this.dirty = true;
  }
  render(): void {
    if (!this.dirty) return;
    this.dirty = false;
    this.live.clear();
    if (this.pts.length > 1) this.style.drawLink(this.live, this.pts, this.look, this.width);
    if (this.pts.length >= 96) {
      // Freeze this chunk and start the next one from its last point.
      this.live = new Graphics();
      this.layer.addChild(this.live);
      this.pts = [this.pts[this.pts.length - 1]];
    }
  }
}

/**
 * Owns everything a scene draws. Body graphics are built once and only transformed
 * per frame; trails are GPU ropes; positions are interpolated between physics steps so
 * motion stays smooth at any refresh rate.
 */
export class SceneRenderer {
  readonly root = new Container();
  readonly shadowLayer = new Container();
  readonly back = new Graphics();
  readonly trailLayer = new Container();
  readonly linkG = new Graphics();
  readonly penLayer = new Container();
  readonly bodyLayer = new Container();
  readonly blobG = new Graphics();
  readonly frontLayer = new Container();
  readonly blobFrontG = new Graphics();
  readonly front = new Graphics();
  readonly fx: Fx;
  readonly views = new Map<Body, BodyView>();
  private tracked = new Set<Interp>();
  private links: LinkItem[] = [];
  private blobs: BlobItem[] = [];
  private pens: Pen[] = [];
  private backDrawers: Drawer[] = [];
  private frontDrawers: Drawer[] = [];
  private alpha = 1;
  private seedN = 0;
  private cooldown = new WeakMap<Body, number>();
  /** Show time not yet turned into trail samples. */
  private trailAcc = 0;
  private trailSteps = 0;
  impactMin = 2.5;
  impactRange = 14;
  impactsEnabled = true;
  /** While true, new views queue their Pixi construction instead of building at once. */
  defer = false;
  private queue: BodyView[] = [];
  /** Built views whose geometry has not been tessellated yet. */
  private cold: BodyView[] = [];

  constructor(
    readonly style: StyleDef,
    readonly engine: Matter.Engine,
    seed = 1,
  ) {
    this.fx = new Fx(style, seed);
    if (style.shadow) this.shadowLayer.alpha = style.shadow.alpha;
    this.blobG.blendMode = style.blend;
    this.blobFrontG.blendMode = style.blend;
    this.linkG.blendMode = style.blend === 'add' ? 'add' : 'normal';
    this.penLayer.blendMode = this.linkG.blendMode;
    this.root.addChild(this.back, this.shadowLayer, this.penLayer, this.trailLayer, this.linkG, this.bodyLayer, this.blobG, this.frontLayer, this.blobFrontG, this.front, this.fx.layer);
    Matter.Events.on(engine, 'collisionStart', this.onCollide);
  }

  // ---------- colours ----------
  color(role: Role, hue = 0.5): number {
    const st = this.style;
    switch (role) {
      case 'hero':
        return st.discrete ? st.ramp[Math.round(Math.min(1, Math.max(0, hue)) * (st.ramp.length - 1))] : ramp(st.ramp, hue);
      case 'debris':
        return mix(ramp(st.ramp, hue), st.structure, 0.35);
      case 'accent':
        return st.accentColor;
      case 'structure':
        return st.structure;
      case 'ground':
        return st.ground;
      case 'ghost':
        return st.text;
    }
  }

  look(role: Role, hue = 0.5, weight?: number, color?: number): Look {
    this.seedN = (this.seedN + 0.6180339887) % 1;
    return { role, color: color ?? this.color(role, hue), seed: this.seedN, weight };
  }

  // ---------- registration ----------
  body(b: Body, opts: BodyOpts): BodyView {
    const v = new BodyView(b, this.look(opts.role, opts.hue, opts.weight, opts.color), opts, this.style, this.shadowLayer);
    if (!opts.hidden) (opts.front ? this.frontLayer : this.bodyLayer).addChild(v.node);
    this.views.set(b, v);
    this.track(b);
    if (this.defer) this.queue.push(v);
    else this.finish(v);
    return v;
  }

  private finish(v: BodyView): void {
    v.build();
    if (this.defer) this.cold.push(v);
    const opts = v.opts;
    const b = v.body;
    if (opts.trail && !opts.hidden && !v.trail) {
      const t = this.style.trail;
      const n = Math.max(6, Math.round(t.length * (opts.trail === true ? 1 : opts.trail)));
      const w = t.width * (b.circleRadius ? Math.min(1.6, Math.max(0.6, b.circleRadius / 14)) : 1);
      v.trail = new Trail(n, t.kind, w, t.blend, v.look.color, b.position.x, b.position.y);
      this.trailLayer.addChild(v.trail.rope);
    }
    this.syncView(v, 0);
  }

  /** Builds up to `n` queued views; returns how many are still waiting. */
  flush(n = Infinity): number {
    let k = 0;
    while (this.queue.length && k++ < n) {
      const v = this.queue.shift()!;
      if (this.views.get(v.body) === v) this.finish(v);
    }
    return this.queue.length;
  }

  /**
   * Draws queued geometry once, off-screen and a few shapes at a time, until `deadline`
   * (performance.now()), so a template coming on stage does not spend its first visible frame
   * tessellating and preparing hundreds of shapes. Returns how many views are left.
   */
  warm(renderer: Renderer, deadline: number): number {
    warmTarget ??= RenderTexture.create({ width: 4, height: 4 });
    while (this.cold.length && performance.now() < deadline) {
      const batch = new Container();
      while (this.cold.length && batch.children.length < 24) {
        const v = this.cold.pop()!;
        if (this.views.get(v.body) !== v) continue;
        for (const c of v.ctxs) {
          if (warmed.has(c)) continue;
          warmed.add(c);
          const g = new Graphics(c);
          g.blendMode = v.gfx.blendMode;
          batch.addChild(g);
        }
      }
      if (batch.children.length) renderer.render({ container: batch, target: warmTarget, clear: true });
      batch.destroy({ children: true, context: false });
    }
    return this.cold.length;
  }

  track(b: Body): void {
    const i = b as Interp;
    i._px = b.position.x;
    i._py = b.position.y;
    i._pa = b.angle;
    this.tracked.add(i);
  }

  add(world: Matter.World, b: Body, opts: BodyOpts): BodyView {
    Matter.Composite.add(world, b);
    return this.body(b, opts);
  }

  remove(world: Matter.World, b: Body): void {
    Matter.Composite.remove(world, b, true);
    const v = this.views.get(b);
    if (v) {
      v.destroy();
      this.views.delete(b);
    }
    this.tracked.delete(b as Interp);
  }

  /** Draws a line through moving points every frame. */
  link(pts: () => Pt[], role: Role, width = 2, hue = 0.5): void {
    this.links.push({ pts, look: this.look(role, hue), width });
  }

  constraint(c: Matter.Constraint, role: Role = 'structure', width = 2, hue = 0.5): void {
    if (c.bodyA) this.track(c.bodyA);
    if (c.bodyB) this.track(c.bodyB);
    // A constraint that has been cut (label 'cut') simply stops being drawn.
    this.link(() => (c.label === 'cut' ? [] : [this.anchor(c.bodyA, c.pointA), this.anchor(c.bodyB, c.pointB)]), role, width, hue);
  }

  blob(bodies: Body[], role: Role, hue = 0.5, inflate = 0, front = false): void {
    bodies.forEach((b) => this.track(b));
    this.blobs.push({ bodies, look: this.look(role, hue, 1), inflate, front });
  }

  /** Stops drawing a closed blob (its skin tore and is drawn as an open strip instead). */
  unblob(bodies: Body[]): void {
    this.blobs = this.blobs.filter((b) => b.bodies !== bodies);
  }

  /** A pen that leaves a permanent line (harmonographs, drawing machines). */
  pen(role: Role, hue = 0.5, width = 2): { add(x: number, y: number): void } {
    const p = new Pen(this.style, this.look(role, hue, 1), width);
    this.penLayer.addChild(p.layer);
    this.pens.push(p);
    return p;
  }

  drawBack(fn: Drawer): void {
    this.backDrawers.push(fn);
  }

  drawFront(fn: Drawer): void {
    this.frontDrawers.push(fn);
  }

  // ---------- interpolation ----------
  ipos(b: Body): Pt {
    const i = b as Interp;
    if (i._px === undefined) return { x: b.position.x, y: b.position.y };
    const a = this.alpha;
    return { x: i._px + (b.position.x - i._px) * a, y: i._py! + (b.position.y - i._py!) * a };
  }

  iangle(b: Body): number {
    const i = b as Interp;
    return i._pa === undefined ? b.angle : i._pa + (b.angle - i._pa) * this.alpha;
  }

  anchor(b: Body | null | undefined, p: Matter.Vector | undefined): Pt {
    const px = p?.x ?? 0;
    const py = p?.y ?? 0;
    if (!b) return { x: px, y: py };
    const q = this.ipos(b);
    return { x: q.x + px, y: q.y + py };
  }

  snapshot(): void {
    for (const b of this.tracked) {
      b._px = b.position.x;
      b._py = b.position.y;
      b._pa = b.angle;
    }
  }

  // ---------- collision feedback ----------
  private onCollide = (e: Matter.IEventCollision<Matter.Engine>) => {
    if (!this.impactsEnabled) return;
    for (const pair of e.pairs) {
      const a = pair.bodyA.parent;
      const b = pair.bodyB.parent;
      const va = this.views.get(a);
      const vb = this.views.get(b);
      if ((!va || va.opts.impacts === false) && (!vb || vb.opts.impacts === false)) continue;
      const n = pair.collision.normal;
      const rel = Math.abs((a.velocity.x - b.velocity.x) * n.x + (a.velocity.y - b.velocity.y) * n.y);
      if (rel < this.impactMin) continue;
      // Cool-downs run on the engine's clock, so the same contacts flash the same way every time.
      const now = this.engine.timing.timestamp / 1000;
      if ((this.cooldown.get(a) ?? -1) > now && (this.cooldown.get(b) ?? -1) > now) continue;
      this.cooldown.set(a, now + 0.09);
      this.cooldown.set(b, now + 0.09);
      const col = pair.collision as unknown as { supports: Matter.Vector[]; supportCount?: number };
      const sp = (col.supportCount ?? col.supports.length) > 0 && col.supports[0] ? col.supports[0] : { x: (a.position.x + b.position.x) / 2, y: (a.position.y + b.position.y) / 2 };
      const s = Math.min(1, (rel - this.impactMin) / this.impactRange);
      const hero = va && va.opts.role !== 'ground' && va.opts.role !== 'structure' ? va : vb && vb.opts.role !== 'ground' ? vb : (va ?? vb!);
      if (va) va.flash = Math.max(va.flash, 0.3 + s * 0.6);
      if (vb) vb.flash = Math.max(vb.flash, 0.3 + s * 0.6);
      // Cartoon rigs squash along the contact normal, then spring back (render only).
      const dir = Math.atan2(n.y, n.x);
      for (const v of [va, vb]) {
        if (!v?.sq) continue;
        v.squashV = Math.min(v.squashV, -(2.5 + s * 9));
        v.squashDir = dir;
      }
      this.style.impact(this.fx, sp.x, sp.y, s, hero.look.color);
    }
  };

  // ---------- frame ----------
  private syncView(v: BodyView, dt: number): void {
    const b = v.body as Interp;
    const k = this.alpha;
    const px = b._px === undefined ? b.position.x : b._px + (b.position.x - b._px) * k;
    const py = b._py === undefined ? b.position.y : b._py + (b.position.y - b._py) * k;
    const a = b._pa === undefined ? b.angle : b._pa + (b.angle - b._pa) * k;
    v.node.position.set(px, py);
    v.node.rotation = a;
    v.node.alpha = v.alpha;
    v.node.scale.set(v.scale);
    if (v.sq && v.inner) {
      if (dt > 0) {
        // Impact squash: a stiff, lightly damped spring (about 6 Hz).
        const w = 38;
        v.squashV += (-w * w * v.squash - 2 * 0.32 * w * v.squashV) * dt;
        v.squash = Math.max(-0.34, Math.min(0.3, v.squash + v.squashV * dt));
      }
      // Only genuinely fast motion stretches (velocity is in px per 1/60 s).
      const vel = v.body.velocity;
      const speed = Math.hypot(vel.x, vel.y);
      const target = 1 + Math.min(Math.max(0, speed - 9) / 70, 0.16);
      if (dt > 0) v.stretch += (target - v.stretch) * Math.min(1, dt * 12);
      let dir: number;
      let k: number;
      if (Math.abs(v.squash) > 0.012) {
        dir = v.squashDir - a;
        k = 1 + v.squash;
      } else {
        dir = speed > 0.3 ? Math.atan2(vel.y, vel.x) - a : 0;
        k = v.stretch;
      }
      v.sq.rotation = dir;
      v.sq.scale.set(k, 1 / k);
      v.inner.rotation = -dir;
    }
    if (v.hi) {
      if (dt > 0 && v.flash > 0) v.flash *= Math.pow(0.01, dt);
      v.hi.alpha = v.flash;
      v.hi.visible = v.flash > 0.01;
    }
    if (v.shadow) {
      const sh = this.style.shadow!;
      v.shadow.position.set(px + sh.dx, py + sh.dy);
      v.shadow.rotation = a;
      v.shadow.alpha = v.alpha;
      v.shadow.scale.set(v.scale);
    }
    if (v.trail) {
      if (dt > 0) v.trail.push(px, py, this.trailSteps);
      v.trail.rope.alpha = this.style.trail.alpha * v.alpha;
    }
  }

  render(alpha: number, dt: number): void {
    this.alpha = alpha;
    this.trailSteps = 0;
    if (dt > 0) {
      this.trailAcc += dt;
      while (this.trailAcc >= TRAIL_DT - 1e-7 && this.trailSteps < 4) {
        this.trailAcc -= TRAIL_DT;
        this.trailSteps++;
      }
      if (this.trailAcc > TRAIL_DT) this.trailAcc = 0;
    }
    if (this.backDrawers.length) {
      this.back.clear();
      for (const d of this.backDrawers) d(this.back, dt);
    }
    for (const v of this.views.values()) this.syncView(v, dt);
    if (this.links.length) {
      this.linkG.clear();
      for (const l of this.links) {
        const pts = l.pts();
        if (pts.length > 1) this.style.drawLink(this.linkG, pts, l.look, l.width);
      }
    }
    for (const p of this.pens) p.render();
    if (this.blobs.length || this.blobG.context.instructions.length || this.blobFrontG.context.instructions.length) {
      this.blobG.clear();
      this.blobFrontG.clear();
      for (const b of this.blobs) {
        const pts = b.bodies.map((x) => this.ipos(x));
        if (b.inflate) {
          let cx = 0;
          let cy = 0;
          for (const p of pts) {
            cx += p.x;
            cy += p.y;
          }
          cx /= pts.length;
          cy /= pts.length;
          for (const p of pts) {
            const dx = p.x - cx;
            const dy = p.y - cy;
            const d = Math.hypot(dx, dy) || 1;
            p.x += (dx / d) * b.inflate;
            p.y += (dy / d) * b.inflate;
          }
        }
        this.style.drawBody(b.front ? this.blobFrontG : this.blobG, [{ kind: 'blob', pts }], b.look);
      }
    }
    if (this.frontDrawers.length) {
      this.front.clear();
      for (const d of this.frontDrawers) d(this.front, dt);
    }
    this.fx.update(dt);
  }

  /** Restarts every trail at its body's current position (after a headless jump). */
  resetTrails(): void {
    for (const v of this.views.values()) if (v.trail) v.trail.reset(v.body.position.x, v.body.position.y);
  }

  destroy(): void {
    Matter.Events.off(this.engine, 'collisionStart', this.onCollide);
    for (const v of this.views.values()) v.destroy();
    this.views.clear();
    this.tracked.clear();
    this.cold.length = 0;
    this.fx.destroy();
    this.root.destroy({ children: true });
  }
}
