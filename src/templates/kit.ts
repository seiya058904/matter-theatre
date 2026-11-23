import Matter from 'matter-js';
import type { Role, SceneContext } from '../core/types';
import type { BodyOpts } from '../render/SceneRenderer';

/**
 * The device kit: small, honest building blocks for templates. Nothing here moves a body by
 * hand. Bodies are made, held, released, hinged, linked or driven by visible machines, and every
 * force is a real law (Hooke, ideal gas, Archimedes, Newton, Coulomb) registered with
 * `ctx.force`, so it acts on every physics step — also while a template settles off-screen.
 */

export const Bodies = Matter.Bodies;
export const Body = Matter.Body;
export const Composite = Matter.Composite;
export const Constraint = Matter.Constraint;
export type MBody = Matter.Body;
export type Pt = { x: number; y: number };
type Phys = Matter.IChamferableBodyDefinition;

export type Ctx = SceneContext;

/**
 * True moments of inertia. Matter multiplies every body's inertia by four for stability, which
 * makes balls roll at half the right acceleration and blocks tip in slow motion.
 */
(Matter.Body as unknown as { _inertiaScale: number })._inertiaScale = 1;

/** Energy-preserving default: Matter's own 0.01 air drag eats ~45 % of motion per second. */
const AIR = 0.001;

type Material = { friction?: number; restitution?: number; frictionStatic?: number };

/**
 * Matter resets the material of a body created static (restitution 0, friction 1), so a
 * static floor or cushion silently loses what it was given. This puts it back.
 */
function keep(b: MBody, m: Material, friction: number): void {
  for (const p of b.parts) {
    p.friction = m.friction ?? friction;
    p.restitution = m.restitution ?? 0;
    if (m.frictionStatic !== undefined) p.frictionStatic = m.frictionStatic;
  }
}

/**
 * Bodies created with `isStatic: true` never regain mass when released in Matter,
 * so held bodies are created dynamic and then frozen with Body.setStatic.
 */
function make<T extends { isStatic?: boolean; frictionAir?: number } & Material>(phys: T, build: (p: T) => MBody): MBody {
  const p = { frictionAir: AIR, ...phys };
  if (!p.isStatic) return build(p);
  const b = build({ ...p, isStatic: false });
  Body.setStatic(b, true);
  keep(b, p, 0.1);
  return b;
}

// ---------------------------------------------------------------- primitives

export function staticRect(ctx: Ctx, x: number, y: number, w: number, h: number, role: BodyOpts['role'] = 'ground', angle = 0, phys: Phys = {}): MBody {
  const b = Bodies.rectangle(x, y, w, h, { ...phys, isStatic: true, angle });
  keep(b, phys, 0.8);
  ctx.r.add(ctx.world, b, { role, impacts: false });
  return b;
}

export function staticCircle(ctx: Ctx, x: number, y: number, r: number, role: BodyOpts['role'] = 'structure', phys: Matter.IBodyDefinition = {}): MBody {
  const b = Bodies.circle(x, y, r, { ...phys, isStatic: true });
  keep(b, phys, 0.8);
  ctx.r.add(ctx.world, b, { role, impacts: false });
  return b;
}

/** A static convex shape from local vertices (scenery that bodies touch: spikes, wedges, hulls). */
export function staticShape(ctx: Ctx, x: number, y: number, verts: Pt[], role: BodyOpts['role'] = 'structure', phys: Phys = {}): MBody {
  const b = Bodies.fromVertices(x, y, [verts], { ...phys, isStatic: true });
  keep(b, phys, 0.8);
  ctx.r.add(ctx.world, b, { role, impacts: false });
  return b;
}

export function ground(ctx: Ctx, y = 1000, w = 7000, x = 960, phys: Phys = {}): MBody {
  return staticRect(ctx, x, y + 40, w, 80, 'ground', 0, phys);
}

export function rect(ctx: Ctx, x: number, y: number, w: number, h: number, view: BodyOpts, phys: Phys = {}): MBody {
  const b = make(phys, (p) => Bodies.rectangle(x, y, w, h, { chamfer: { radius: Math.min(w, h) * 0.12 }, ...p }));
  ctx.r.add(ctx.world, b, view);
  return b;
}

/**
 * A rigid body built from parts, with its true moment of inertia (Matter sums the parts' own
 * inertias but omits the parallel-axis term). `phys.density` applies to parts left at the default.
 */
export function compound(ctx: Ctx, parts: MBody[], view: BodyOpts, phys: Matter.IBodyDefinition = {}): MBody {
  const { density, ...rest } = phys;
  if (density !== undefined) for (const p of parts) if (p.density === 0.001) Body.setDensity(p, density);
  const b = Body.create({ parts, frictionAir: 0.002, ...rest });
  let inertia = 0;
  for (const p of b.parts.slice(1)) inertia += p.inertia + p.mass * ((p.position.x - b.position.x) ** 2 + (p.position.y - b.position.y) ** 2);
  Body.setInertia(b, inertia);
  ctx.r.add(ctx.world, b, view);
  return b;
}

export function circle(ctx: Ctx, x: number, y: number, r: number, view: BodyOpts, phys: Matter.IBodyDefinition = {}): MBody {
  const b = make(phys, (p) => Bodies.circle(x, y, r, p));
  ctx.r.add(ctx.world, b, view);
  return b;
}

/**
 * A ball that really rolls. Matter's circles are polygons with as many sides as their radius
 * (a 15 px marble is a 16-gon, which tips face to face instead of rolling on slopes under ~11°);
 * this one has `sides` faces, so it rolls on any slope steeper than 180°/sides.
 */
export function ball(ctx: Ctx, x: number, y: number, r: number, view: BodyOpts, phys: Matter.IBodyDefinition = {}, sides = 40): MBody {
  const b = make(phys, (p) => Bodies.polygon(x, y, sides, r, { ...p, circleRadius: r } as Matter.IChamferableBodyDefinition));
  ctx.r.add(ctx.world, b, view);
  return b;
}

export function polygon(ctx: Ctx, x: number, y: number, sides: number, r: number, view: BodyOpts, phys: Phys = {}): MBody {
  const b = make(phys, (p) => Bodies.polygon(x, y, sides, r, { chamfer: { radius: r * 0.08 }, ...p }));
  ctx.r.add(ctx.world, b, view);
  return b;
}

/** A convex body from local vertices (centred automatically). */
export function shape(ctx: Ctx, x: number, y: number, verts: Pt[], view: BodyOpts, phys: Phys = {}): MBody {
  const b = make(phys, (p) => Bodies.fromVertices(x, y, [verts], p));
  ctx.r.add(ctx.world, b, view);
  return b;
}

/**
 * A padded surface (felt, rubber, a bed of sand). Matter combines restitution with max(), which
 * would let a bouncy ball bounce just as high off felt as off steel; padded surfaces take the
 * lower value instead, decided at the moment of contact.
 */
export function cushion(ctx: Ctx, bodies: MBody[], e = 0.05): void {
  const set = new Set(bodies);
  Matter.Events.on(ctx.engine, 'collisionStart', (ev) => {
    for (const p of ev.pairs) if (set.has(p.bodyA.parent) || set.has(p.bodyB.parent)) p.restitution = Math.min(p.restitution, e);
  });
}

/**
 * A template's tunable constants. In development, `globalThis.__tune[id]` overrides them, so the
 * QA probe can sweep a parameter without rebuilding.
 */
export function tuned<T extends Record<string, number>>(id: string, defaults: T): T {
  const o = (globalThis as { __tune?: Record<string, Partial<T>> }).__tune?.[id];
  return o ? { ...defaults, ...o } : defaults;
}

/** A body's real mass, also while it is held (Matter reports a static body's mass as Infinity). */
export function massOf(b: MBody): number {
  const o = (b as MBody & { _original?: { mass: number } })._original;
  return b.isStatic && o ? o.mass : b.mass;
}

/** Lets go of held bodies: the only "intervention" an experiment ever makes. */
export function release(...bodies: MBody[]): void {
  for (const b of bodies) {
    if (b.isStatic) Body.setStatic(b, false);
    // A held body may have been put to sleep where sleeping is on; let go, it is awake.
    Matter.Sleeping.set(b, false);
  }
}

/** Cuts a constraint (a string snips, a pouch lets go). */
export function cut(ctx: Ctx, c: Matter.Constraint): void {
  c.label = 'cut';
  Composite.remove(ctx.world, c);
}

/** Removes a gate / pin / latch body. */
export function open(ctx: Ctx, ...bodies: MBody[]): void {
  for (const b of bodies) ctx.r.remove(ctx.world, b);
}

// ---------------------------------------------------------------- walls, tracks, containers

/** A chain of static walls through the given points (tracks, bowls, funnels). */
export function wallPath(ctx: Ctx, pts: Pt[], thick = 14, role: BodyOpts['role'] = 'structure', phys: Phys = {}): MBody[] {
  const out: MBody[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    out.push(staticRect(ctx, (a.x + b.x) / 2, (a.y + b.y) / 2, len + thick * 0.6, thick, role, Math.atan2(b.y - a.y, b.x - a.x), { friction: 0.05, ...phys }));
  }
  return out;
}

/**
 * The same walls as one static compound body, so a machine can turn or carry the whole
 * container at once (`turn`, `drive`). Drawn as one piece.
 */
export function wallBody(ctx: Ctx, pts: Pt[], thick = 14, role: BodyOpts['role'] = 'structure', phys: Phys = {}, closed = false, view: Partial<BodyOpts> = {}): MBody {
  const parts: MBody[] = [];
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    parts.push(Bodies.rectangle((a.x + b.x) / 2, (a.y + b.y) / 2, len + thick * 0.6, thick, { angle: Math.atan2(b.y - a.y, b.x - a.x) }));
  }
  const body = Body.create({ parts, isStatic: true });
  keep(body, { friction: 0.05, ...phys }, 0.05);
  ctx.r.add(ctx.world, body, { role, impacts: false, ...view });
  return body;
}

/** Points along an arc (angles in radians, y down). */
export function arcPts(cx: number, cy: number, r: number, a0: number, a1: number, n: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return out;
}

/** Open-topped box; returns [left, floor, right]. */
export function box(ctx: Ctx, cx: number, top: number, w: number, h: number, thick = 16, role: BodyOpts['role'] = 'structure'): MBody[] {
  return [
    staticRect(ctx, cx - w / 2, top + h / 2, thick, h, role),
    staticRect(ctx, cx, top + h, w + thick, thick, role),
    staticRect(ctx, cx + w / 2, top + h / 2, thick, h, role),
  ];
}

/** Funnel with a removable gate at its mouth. */
export function funnel(ctx: Ctx, cx: number, top: number, w: number, mouth: number, h: number, wallTop = top - 500): { walls: MBody[]; gate: MBody } {
  const walls = [
    ...wallPath(ctx, [{ x: cx - w / 2, y: wallTop }, { x: cx - w / 2, y: top }, { x: cx - mouth / 2, y: top + h }]),
    ...wallPath(ctx, [{ x: cx + w / 2, y: wallTop }, { x: cx + w / 2, y: top }, { x: cx + mouth / 2, y: top + h }]),
  ];
  const gate = staticRect(ctx, cx, top + h + 8, mouth + 40, 12, 'accent');
  return { walls, gate };
}

/** A grid of balls packed into a rectangle (fills hoppers). */
export function fill(ctx: Ctx, x0: number, y0: number, cols: number, rows: number, r: number, view: (i: number, row: number, col: number) => BodyOpts, phys: Matter.IBodyDefinition = {}): MBody[] {
  const out: MBody[] = [];
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      const x = x0 + col * r * 2.15 + (row % 2) * r;
      const y = y0 - row * r * 2.05;
      out.push(circle(ctx, x, y, r, view(out.length, row, col), phys));
    }
  return out;
}

// ---------------------------------------------------------------- constraints

/** A fixed pivot to a body (pendulum string or hinge when length is 0). */
export function pin(ctx: Ctx, b: MBody, x: number, y: number, opts: Partial<Matter.IConstraintDefinition> = {}, draw: false | BodyOpts['role'] = 'structure', width = 1.5): Matter.Constraint {
  const c = Constraint.create({ pointA: { x, y }, bodyB: b, stiffness: 1, ...opts });
  Composite.add(ctx.world, c);
  if (draw) ctx.r.constraint(c, draw, width);
  return c;
}

export function link(ctx: Ctx, a: MBody, b: MBody, opts: Partial<Matter.IConstraintDefinition> = {}, draw: false | BodyOpts['role'] = 'structure', width = 1.5): Matter.Constraint {
  const c = Constraint.create({ bodyA: a, bodyB: b, stiffness: 1, ...opts });
  Composite.add(ctx.world, c);
  if (draw) ctx.r.constraint(c, draw, width);
  return c;
}

/** A pendulum hanging from (px, py), displaced by `angle` and held until released. */
export function pendulum(ctx: Ctx, px: number, py: number, len: number, r: number, angle: number, view: BodyOpts, phys: Matter.IBodyDefinition = {}, held = true): { bob: MBody; c: Matter.Constraint } {
  const bob = circle(ctx, px + Math.sin(angle) * len, py + Math.cos(angle) * len, r, view, { frictionAir: 0, ...phys, isStatic: held });
  const c = pin(ctx, bob, px, py, { length: len });
  return { bob, c };
}

/**
 * A rope of small links between two points (either end may be free).
 * Links never collide with each other; the rope is drawn as one smooth line.
 */
export function rope(ctx: Ctx, a: Pt, b: Pt, n: number, opts: { r?: number; pinA?: boolean; pinB?: boolean; hue?: number; role?: BodyOpts['role']; width?: number; density?: number; stiffness?: number; air?: number; collide?: boolean; group?: number } = {}): MBody[] {
  const group = opts.group ?? Body.nextGroup(true);
  const r = opts.r ?? 5;
  const nodes: MBody[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const node = Bodies.circle(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, r, { collisionFilter: opts.collide === false ? { group, category: 0x0001, mask: 0 } : { group }, frictionAir: opts.air ?? 0.004, density: opts.density ?? 0.003 });
    Composite.add(ctx.world, node);
    ctx.r.track(node);
    nodes.push(node);
  }
  const seg = Math.hypot(b.x - a.x, b.y - a.y) / n;
  for (let i = 0; i < n; i++) Composite.add(ctx.world, Constraint.create({ bodyA: nodes[i], bodyB: nodes[i + 1], length: seg, stiffness: opts.stiffness ?? 1 }));
  if (opts.pinA !== false) pin(ctx, nodes[0], a.x, a.y, { length: 0 }, false);
  if (opts.pinB) pin(ctx, nodes[n], b.x, b.y, { length: 0 }, false);
  ctx.r.link(() => nodes.map((x) => ctx.r.ipos(x)), opts.role ?? 'structure', opts.width ?? 3, opts.hue ?? 0.5);
  return nodes;
}

/**
 * A column of beads queued above a nozzle and let go one at a time (lowest first).
 * Waiting beads touch nothing, so a released bead simply falls — no overlap kicks.
 */
export function drip(ctx: Ctx, x: number, y: number, n: number, r: number, view: BodyOpts | ((i: number) => BodyOpts), phys: Matter.IBodyDefinition | ((i: number) => Matter.IBodyDefinition) = {}): { beads: MBody[]; next: () => MBody | undefined } {
  const beads: MBody[] = [];
  for (let i = 0; i < n; i++) {
    const v = typeof view === 'function' ? view(i) : view;
    const p = typeof phys === 'function' ? phys(i) : phys;
    const b = circle(ctx, x, y - i * (r * 2 + 2), r, v, { ...p, isStatic: true });
    b.collisionFilter = { group: 0, category: 0x0001, mask: 0 };
    beads.push(b);
  }
  let k = 0;
  return {
    beads,
    next: () => {
      const b = beads[k++];
      if (!b) return;
      b.collisionFilter.mask = 0xffffffff;
      release(b);
      return b;
    },
  };
}

// ---------------------------------------------------------------- springs

export interface Spring {
  a: MBody | null;
  pa: Pt;
  b: MBody;
  pb: Pt;
  rest: number;
  k: number;
  damping: number;
  /** A broken spring exerts nothing (a snapped band, a torn skin). */
  broken?: boolean;
}

/** Stiffness (Matter units, mass / ms²) that gives `mass` a natural frequency of `hz`. */
export function springK(mass: number, hz: number): number {
  const w = (2 * Math.PI * hz) / 1000;
  return mass * w * w;
}

function attach(body: MBody | null, p: Pt, out: Pt): Pt {
  if (!body) {
    out.x = p.x;
    out.y = p.y;
    return out;
  }
  const c = Math.cos(body.angle);
  const s = Math.sin(body.angle);
  out.x = body.position.x + p.x * c - p.y * s;
  out.y = body.position.y + p.x * s + p.y * c;
  return out;
}

/**
 * A Hookean spring between a body point and a fixed point (a = null) or another body.
 * Matter's soft constraints bleed their energy within a couple of seconds; this one is a
 * true force law, so it rings like a real spring. Points are in each body's local frame.
 * Drawn as a coil unless `draw` is false.
 */
export function spring(ctx: Ctx, a: MBody | null, pa: Pt, b: MBody, pb: Pt, rest: number, k: number, opts: { damping?: number; draw?: BodyOpts['role'] | false; coils?: number; amp?: number; width?: number; hue?: number } = {}): Spring {
  const sp: Spring = { a, pa, b, pb, rest, k, damping: opts.damping ?? 0 };
  ctx.force(() => applySprings([sp]));
  if (opts.draw !== false) {
    const coils = opts.coils ?? 9;
    const amp = opts.amp ?? 9;
    const pts: Pt[] = Array.from({ length: coils * 2 + 4 }, () => ({ x: 0, y: 0 }));
    const A = { x: 0, y: 0 };
    const B = { x: 0, y: 0 };
    const r = ctx.r;
    r.link(
      () => {
        if (sp.broken) return [];
        const ia = a ? r.ipos(a) : null;
        const ib = r.ipos(b);
        attach(a, pa, A);
        attach(b, pb, B);
        if (ia && a) {
          A.x += ia.x - a.position.x;
          A.y += ia.y - a.position.y;
        }
        B.x += ib.x - b.position.x;
        B.y += ib.y - b.position.y;
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const n = pts.length - 1;
        for (let i = 0; i <= n; i++) {
          const f = i === 0 ? 0 : i === n ? 1 : 0.08 + ((i - 1) / (n - 2)) * 0.84;
          const side = i <= 1 || i >= n - 1 ? 0 : i % 2 ? amp : -amp;
          pts[i].x = A.x + dx * f + nx * side;
          pts[i].y = A.y + dy * f + ny * side;
        }
        return pts;
      },
      opts.draw ?? 'structure',
      opts.width ?? 2,
      opts.hue ?? 0.5,
    );
  }
  return sp;
}

const scratchA = { x: 0, y: 0 };
const scratchB = { x: 0, y: 0 };
const zero = { x: 0, y: 0 };
const force = { x: 0, y: 0 };
const at = { x: 0, y: 0 };

/** Applies Hooke's law (with optional dashpot damping) for each spring. */
export function applySprings(list: Spring[]): void {
  const A = scratchA;
  const B = scratchB;
  for (const sp of list) {
    if (sp.broken) continue;
    attach(sp.a, sp.pa, A);
    attach(sp.b, sp.pb, B);
    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const len = Math.hypot(dx, dy) || 1e-6;
    const nx = dx / len;
    const ny = dy / len;
    let f = -sp.k * (len - sp.rest);
    if (sp.damping) {
      const vb = sp.b.velocity;
      const va = sp.a ? sp.a.velocity : zero;
      f -= sp.damping * ((vb.x - va.x) * nx + (vb.y - va.y) * ny);
    }
    // Matter copies these values, so the scratch objects can be reused.
    if (!sp.b.isStatic) {
      at.x = B.x;
      at.y = B.y;
      force.x = nx * f;
      force.y = ny * f;
      Body.applyForce(sp.b, at, force);
    }
    if (sp.a && !sp.a.isStatic) {
      at.x = A.x;
      at.y = A.y;
      force.x = -nx * f;
      force.y = -ny * f;
      Body.applyForce(sp.a, at, force);
    }
  }
}

// ---------------------------------------------------------------- soft bodies (rubber skin + ideal gas)

export interface Soft {
  nodes: MBody[];
  skin: Spring[];
  /** Node radius (the skin's thickness). */
  node: number;
  popped: boolean;
  centre(): Pt;
  /** Tears the skin next to node `at` and lets the gas out. */
  pop(at: number): void;
}

function polyArea(nodes: MBody[]): number {
  let a = 0;
  const n = nodes.length;
  for (let i = 0; i < n; i++) {
    const p = nodes[i].position;
    const q = nodes[(i + 1) % n].position;
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

/**
 * A soft body as real ones are made: a closed rubber skin (rim nodes joined by Hookean springs,
 * pre-stretched by `inflate`) holding a gas at the pressure that balances it (Laplace: P = T / R).
 * The gas obeys P·A = const, so the body flattens on impact, bulges, and springs back.
 */
export function softBody(
  ctx: Ctx,
  x: number,
  y: number,
  R: number,
  view: { hue: number; role?: Role; front?: boolean },
  o: { n?: number; hz?: number; inflate?: number; density?: number; friction?: number; restitution?: number; air?: number; held?: boolean; damping?: number; bend?: number; gas?: boolean } = {},
): Soft {
  const { world, r } = ctx;
  const n = o.n ?? Math.max(16, Math.min(40, Math.round((2 * Math.PI * R) / 15)));
  const sin = Math.sin(Math.PI / n);
  const node = (R * sin) / (1 + sin);
  const Rc = R - node;
  const chord = 2 * Rc * sin;
  const group = Body.nextGroup(true);
  const nodes: MBody[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const b = Bodies.circle(x + Math.cos(a) * Rc, y + Math.sin(a) * Rc, node, {
      collisionFilter: { group },
      density: o.density ?? 0.004,
      friction: o.friction ?? 0.6,
      frictionStatic: 0.8,
      restitution: o.restitution ?? 0.15,
      frictionAir: o.air ?? 0.003,
    });
    Composite.add(world, b);
    r.track(b);
    nodes.push(b);
  }
  const m = nodes[0].mass;
  if (o.held) for (const b of nodes) Body.setStatic(b, true);
  const k = springK(m, o.hz ?? 9);
  // Dashpot as a fraction of critical damping (velocities are in px per 1/60 s).
  const damping = ((o.damping ?? 0.08) * 2 * Math.sqrt(k * m)) / 16.67;
  const inflate = o.inflate ?? 0.12;
  const rest = chord / (1 + inflate);
  const skin: Spring[] = [];
  for (let i = 0; i < n; i++) skin.push({ a: nodes[i], pa: zero, b: nodes[(i + 1) % n], pb: zero, rest, k, damping });
  const bend: Spring[] = [];
  const kb = k * (o.bend ?? 0.25);
  if (kb > 0) for (let i = 0; i < n; i++) bend.push({ a: nodes[i], pa: zero, b: nodes[(i + 2) % n], pb: zero, rest: 2 * Rc * Math.sin((2 * Math.PI) / n), k: kb, damping: damping * 0.5 });
  // Laplace: the gas pressure that balances the stretched skin of a circle, P = T / R.
  const signed = polyArea(nodes);
  const orient = Math.sign(signed) || 1;
  const A0 = Math.abs(signed);
  const T = k * (chord - rest);
  let gas = o.gas === false ? 0 : (T / Rc) * A0;
  const soft: Soft = {
    nodes,
    skin,
    node,
    popped: false,
    centre() {
      let cx = 0;
      let cy = 0;
      for (const b of nodes) {
        cx += b.position.x;
        cy += b.position.y;
      }
      return { x: cx / n, y: cy / n };
    },
    pop(at) {
      if (soft.popped) return;
      soft.popped = true;
      gas = 0;
      (nodes[0].plugin as { popped?: boolean }).popped = true;
      const i = ((at % n) + n) % n;
      skin[i].broken = true;
      for (const s of bend) if (s.a === nodes[i] || s.a === nodes[(i - 1 + n) % n]) s.broken = true;
      // The skin is now an open strip, drawn from one torn edge to the other.
      r.unblob(nodes);
      const order = Array.from({ length: n }, (_, k2) => nodes[(i + 1 + k2) % n]);
      r.link(() => order.map((b) => r.ipos(b)), view.role ?? 'hero', node * 1.6, view.hue);
    },
  };
  ctx.force(() => {
    applySprings(skin);
    if (bend.length) applySprings(bend);
    if (gas <= 0) return;
    // Orientation is fixed at birth: a crushed, momentarily inside-out skin is still pushed outward.
    const A = polyArea(nodes) * orient;
    const P = gas / Math.max(A, A0 * 0.25);
    const s = 0.5 * P * orient;
    for (let i = 0; i < n; i++) {
      const p = nodes[i];
      const q = nodes[(i + 1) % n];
      const ex = q.position.x - p.position.x;
      const ey = q.position.y - p.position.y;
      // Outward normal of the edge, scaled by its length: the pressure force on that stretch of skin.
      force.x = ey * s;
      force.y = -ex * s;
      if (!p.isStatic) Body.applyForce(p, p.position, force);
      if (!q.isStatic) Body.applyForce(q, q.position, force);
    }
  });
  r.blob(nodes, view.role ?? 'hero', view.hue, node, view.front);
  return soft;
}

// ---------------------------------------------------------------- water (Archimedes)

export interface Water {
  x0: number;
  x1: number;
  bottom: number;
  /** Current mean level (rises as bodies displace water). */
  level: number;
  density: number;
  /** Visual surface height at x (the wave field on top of the mean level). */
  surface(x: number): number;
  /** Area of a body currently under water. */
  submerged(b: MBody): number;
}

/** Area and centroid of the part of a polygon below the horizontal line y = L. */
function clipBelow(vs: Matter.Vector[], L: number, out: { a: number; x: number; y: number }): void {
  let a = 0;
  let cx = 0;
  let cy = 0;
  const pts: number[] = [];
  const n = vs.length;
  for (let i = 0; i < n; i++) {
    const p = vs[i];
    const q = vs[(i + 1) % n];
    const pin = p.y >= L;
    const qin = q.y >= L;
    if (pin) pts.push(p.x, p.y);
    if (pin !== qin) {
      const t = (L - p.y) / (q.y - p.y);
      pts.push(p.x + (q.x - p.x) * t, L);
    }
  }
  const m = pts.length / 2;
  for (let i = 0; i < m; i++) {
    const x0 = pts[i * 2];
    const y0 = pts[i * 2 + 1];
    const x1 = pts[((i + 1) % m) * 2];
    const y1 = pts[((i + 1) % m) * 2 + 1];
    const c = x0 * y1 - x1 * y0;
    a += c;
    cx += (x0 + x1) * c;
    cy += (y0 + y1) * c;
  }
  if (Math.abs(a) < 1e-6) {
    out.a = 0;
    return;
  }
  out.a = Math.abs(a / 2);
  out.x = cx / (3 * a);
  out.y = cy / (3 * a);
}

/** Area and centroid of the part of a circle below the line y = L. */
function circleBelow(x: number, y: number, r: number, L: number, out: { a: number; x: number; y: number }): void {
  const d = L - y;
  if (d >= r) {
    out.a = 0;
    return;
  }
  out.x = x;
  if (d <= -r) {
    out.a = Math.PI * r * r;
    out.y = y;
    return;
  }
  const th = 2 * Math.acos(d / r);
  out.a = 0.5 * r * r * (th - Math.sin(th));
  const s = Math.sin(th / 2);
  out.y = y + (4 * r * s * s * s) / (3 * (th - Math.sin(th)));
}

/**
 * A tank of water. Buoyancy is Archimedes' law on the submerged area of every part (applied at
 * its centroid, so floating bodies right themselves), with a quadratic drag; the level rises
 * with the water displaced. The surface carries a damped wave equation stirred by whatever
 * crosses it — the only purely visual part.
 */
export function water(ctx: Ctx, o: { x0: number; x1: number; level: number; bottom: number; density?: number; drag?: number; waves?: boolean; splash?: boolean; front?: boolean }): Water {
  const { engine, r, world } = ctx;
  const density = o.density ?? 0.002;
  const drag = o.drag ?? 1;
  const base = o.level;
  const N = Math.max(24, Math.round((o.x1 - o.x0) / 14));
  const dx = (o.x1 - o.x0) / (N - 1);
  const h = new Float32Array(N);
  const hv = new Float32Array(N);
  const subs = new Map<MBody, number>();
  const was = new Map<MBody, boolean>();
  const tmp = { a: 0, x: 0, y: 0 };
  const wv: Water = {
    x0: o.x0,
    x1: o.x1,
    bottom: o.bottom,
    level: base,
    density,
    surface(x) {
      const f = Math.max(0, Math.min(N - 1.001, (x - o.x0) / dx));
      const i = Math.floor(f);
      return wv.level + h[i] + (h[i + 1] - h[i]) * (f - i);
    },
    submerged: (b) => subs.get(b) ?? 0,
  };
  ctx.force(() => {
    const g = engine.gravity.y * engine.gravity.scale;
    const L = wv.level;
    let displaced = 0;
    subs.clear();
    const all = Composite.allBodies(world);
    // Dry air pockets (inside a hull): whatever sits in one is not in the water.
    const pockets: Matter.Body[] = [];
    for (const b of all) if (!b.isStatic && b.parts.length > 1) for (const p of b.parts) if (p.isSensor && ((p.plugin as { buoyancy?: number })?.buoyancy ?? 1) > 0.35) pockets.push(p);
    for (const b of all) {
      if (b.isStatic || b.bounds.max.y <= L || b.bounds.max.x < o.x0 || b.bounds.min.x > o.x1) continue;
      if (pockets.length && pockets.some((p) => p.parent !== b && Matter.Vertices.contains(p.vertices, b.position))) continue;
      const parts = b.parts.length > 1 ? b.parts.slice(1) : [b];
      let total = 0;
      for (const p of parts) {
        if (p.circleRadius) circleBelow(p.position.x, p.position.y, p.circleRadius, L, tmp);
        else clipBelow(p.vertices, L, tmp);
        if (tmp.a <= 0) continue;
        // An air pocket (a sensor part, e.g. the inside of a hull) displaces water like the hull around
        // it, and the water drags on that whole shape; `plugin.buoyancy` < 1 means it has partly flooded.
        let wet = tmp.a;
        if (p.isSensor) wet = tmp.a * ((p.plugin as { buoyancy?: number })?.buoyancy ?? 1);
        total += wet;
        // Velocity of the water-borne centroid (px per ms), including the body's spin.
        const rx = tmp.x - b.position.x;
        const ry = tmp.y - b.position.y;
        const vx = (b.velocity.x - ry * b.angularVelocity) / 16.67;
        const vy = (b.velocity.y + rx * b.angularVelocity) / 16.67;
        const sp = Math.hypot(vx, vy);
        // Form drag ½·ρ·C_d·D·v² (C_d ≈ 0.5, D the wetted size), plus a little viscous drag.
        const k = drag * density * (0.28 * Math.sqrt(tmp.a) * sp + 0.0002 * tmp.a);
        at.x = tmp.x;
        at.y = tmp.y;
        force.x = -k * vx;
        force.y = -density * wet * g - k * vy;
        Body.applyForce(b, at, force);
      }
      if (total > 0) {
        subs.set(b, total);
        displaced += total;
        // Rotational drag: water resists spinning.
        b.torque -= drag * 0.00002 * total * b.angularVelocity * (density / 0.002);
      }
    }
    // Conservation of water: the level rises by the displaced area spread over the tank.
    wv.level = base - displaced / (o.x1 - o.x0);
    if (o.waves === false) return;
    // Stir the surface where bodies cross it, then advance a damped wave equation.
    for (const [b] of subs) {
      if (b.bounds.min.y > L + 4) continue;
      const vy = b.velocity.y;
      const i0 = Math.max(0, Math.floor((b.bounds.min.x - o.x0) / dx));
      const i1 = Math.min(N - 1, Math.ceil((b.bounds.max.x - o.x0) / dx));
      for (let i = i0; i <= i1; i++) hv[i] += vy * 0.3;
      const inside = b.position.y > L;
      const before = was.get(b);
      if (o.splash !== false && before === false && inside && b.speed > 3) {
        const s = Math.min(1, (b.speed - 3) / 14);
        r.fx.burst({ x: b.position.x, y: L - 2, n: 4 + Math.round(s * 14), speed: [120, 260 + 520 * s], life: [0.45, 0.9], size: [4, 9 + 6 * s], color: [ctx.style.water.color, 0xffffff], kind: 'dot', gravity: 1500, drag: 0.4, angle: -Math.PI / 2, spread: 1.9, alpha: 0.85 });
      }
      was.set(b, inside);
    }
    for (const b of was.keys()) if (!subs.has(b)) was.set(b, false);
    const c2 = 0.55;
    for (let i = 0; i < N; i++) {
      const l = h[i > 0 ? i - 1 : i];
      const rr = h[i < N - 1 ? i + 1 : i];
      hv[i] += (c2 * (l + rr - 2 * h[i]) - 0.02 * h[i]) * 1 - hv[i] * 0.035;
    }
    for (let i = 0; i < N; i++) h[i] = Math.max(-46, Math.min(46, h[i] + hv[i] * 0.12));
    h[0] = h[1];
    h[N - 1] = h[N - 2];
  });
  for (const b of Composite.allBodies(world)) if (!b.isStatic) was.set(b, false);
  const pts: Pt[] = Array.from({ length: N }, () => ({ x: 0, y: 0 }));
  const look = r.look('hero', 0.5, undefined, ctx.style.water.color);
  const draw = (g: import('pixi.js').Graphics) => {
    for (let i = 0; i < N; i++) {
      pts[i].x = o.x0 + i * dx;
      pts[i].y = wv.level + h[i];
    }
    const poly: number[] = [];
    for (const p of pts) poly.push(p.x, p.y);
    poly.push(o.x1, o.bottom, o.x0, o.bottom);
    g.poly(poly, true).fill({ color: ctx.style.water.color, alpha: ctx.style.water.alpha });
    ctx.style.drawLink(g, pts, look, 3);
  };
  if (o.front === false) r.drawBack(draw);
  else r.drawFront(draw);
  return wv;
}

/** Area of a body below the line y = L (an air pocket counts by how much of it is still dry). */
export function submergedArea(b: MBody, L: number): number {
  const tmp = { a: 0, x: 0, y: 0 };
  let total = 0;
  for (const p of b.parts.length > 1 ? b.parts.slice(1) : [b]) {
    if (p.circleRadius) circleBelow(p.position.x, p.position.y, p.circleRadius, L, tmp);
    else clipBelow(p.vertices, L, tmp);
    total += p.isSensor ? tmp.a * ((p.plugin as { buoyancy?: number })?.buoyancy ?? 1) : tmp.a;
  }
  return total;
}

/** Sets a floating body at its equilibrium draft before anything is seen, so it does not bob at the start. */
export function afloat(b: MBody, w: Water): void {
  const need = massOf(b) / w.density;
  let lo = -600;
  let hi = 600;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    Body.translate(b, { x: 0, y: mid });
    const a = submergedArea(b, w.level);
    Body.translate(b, { x: 0, y: -mid });
    if (a < need) lo = mid;
    else hi = mid;
  }
  Body.translate(b, { x: 0, y: (lo + hi) / 2 });
}

// ---------------------------------------------------------------- fields

/**
 * Newton's law of gravitation between every pair of bodies: F = K·mᵢ·mⱼ / r², equal and
 * opposite, with a small softening length. K is in px³/ms² per unit mass.
 */
export function gravitate(ctx: Ctx, bodies: MBody[], K: number, soft = 6): void {
  const s2 = soft * soft;
  ctx.force(() => {
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i];
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j];
        const dx = b.position.x - a.position.x;
        const dy = b.position.y - a.position.y;
        const d2 = dx * dx + dy * dy + s2;
        const inv = 1 / Math.sqrt(d2);
        const f = (K * a.mass * b.mass) / d2;
        a.force.x += dx * inv * f;
        a.force.y += dy * inv * f;
        b.force.x -= dx * inv * f;
        b.force.y -= dy * inv * f;
      }
    }
  });
}

/**
 * Newtonian attraction toward a fixed mass at (cx, cy): F = G·m / r² with a small
 * softening length. `g` is the field strength in "gravities at 300 px".
 */
export function attract(b: MBody, cx: number, cy: number, g: number, soft = 30): void {
  const dx = cx - b.position.x;
  const dy = cy - b.position.y;
  const d2 = dx * dx + dy * dy + soft * soft;
  const inv = 1 / Math.sqrt(d2);
  const f = (g * 0.001 * b.mass * 90000) / d2;
  b.force.x += dx * inv * f;
  b.force.y += dy * inv * f;
}

/** Circular-orbit speed (Matter velocity units) for `attract` with strength g at radius r. */
export const orbitSpeed = (g: number, r: number) => Math.sqrt((g * 1000 * 90000) / Math.max(r, 1)) / 60;

// ---------------------------------------------------------------- machines

/** Matter 0.20's velocity-carrying setters (the third argument is missing from the typings). */
export const setPositionV = Body.setPosition as unknown as (b: MBody, p: Matter.Vector, updateVelocity?: boolean) => void;
export const setAngleV = Body.setAngle as unknown as (b: MBody, a: number, updateVelocity?: boolean) => void;
/** Turns a body about a point (Matter's typings omit the point argument). */
export const rotateAbout = Body.rotate as unknown as (b: MBody, angle: number, point: Matter.Vector, updateVelocity?: boolean) => void;

/** Drives a static body around its own centre at angular speed `w` (rad/s), carrying contact velocity. */
export function spin(b: MBody, w: number, dt: number): void {
  setAngleV(b, b.angle + w * dt, true);
}

/** A motor turns a static body by `da` about a fixed pivot this step; contacts feel the motion. */
export function turn(b: MBody, da: number, pivot: Pt): void {
  rotateAbout(b, da, pivot, true);
}

/** Moves a static body to a target position this step, carrying contact velocity. */
export function drive(b: MBody, x: number, y: number): void {
  setPositionV(b, { x, y }, true);
}

/** A machine stops: its body no longer carries velocity into its contacts. */
export function halt(b: MBody): void {
  const k = b as MBody & { positionPrev: Pt; anglePrev: number };
  k.positionPrev.x = b.position.x;
  k.positionPrev.y = b.position.y;
  k.anglePrev = b.angle;
}

/** A compound static rotor (hub + paddles), meant to be turned with `spin`. */
export function rotor(ctx: Ctx, x: number, y: number, hub: number, arm: number, blades: number, thick = 14, role: BodyOpts['role'] = 'structure'): MBody {
  const parts: MBody[] = [Bodies.circle(x, y, hub)];
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2;
    parts.push(Bodies.rectangle(x + Math.cos(a) * (hub + arm / 2), y + Math.sin(a) * (hub + arm / 2), arm, thick, { angle: a }));
  }
  const b = Body.create({ parts, isStatic: true });
  keep(b, { friction: 0.3 }, 0.3);
  ctx.r.add(ctx.world, b, { role, impacts: false });
  return b;
}

// ---------------------------------------------------------------- camera

/** A slow, steady dolly across the whole template: calm framing that still breathes. */
export function dolly(ctx: Ctx, x: number, y: number, z0: number, z1: number, x1 = x, y1 = y): void {
  ctx.camera.set(x, y, z0);
  ctx.camera.stiffness = 0.3;
  ctx.tl.during(0, ctx.duration, (p) => {
    const e = p * p * (3 - 2 * p);
    ctx.camera.to(x + (x1 - x) * e, y + (y1 - y) * e, z0 + (z1 - z0) * e);
  });
}
