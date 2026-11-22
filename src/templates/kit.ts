import Matter from 'matter-js';
import type { SceneContext } from '../core/types';
import type { BodyOpts } from '../render/SceneRenderer';

/**
 * The device kit: small, honest building blocks for templates. Nothing here applies
 * hidden forces — bodies are made, held, released, hinged, linked or driven by visible
 * kinematic machines; fields only implement real laws (inverse-square attraction).
 */

export const Bodies = Matter.Bodies;
export const Body = Matter.Body;
export const Composite = Matter.Composite;
export const Constraint = Matter.Constraint;
export type MBody = Matter.Body;
export type Pt = { x: number; y: number };
type Phys = Matter.IChamferableBodyDefinition;

export type Ctx = SceneContext;

/** Energy-preserving default: Matter's own 0.01 air drag eats ~45 % of motion per second. */
const AIR = 0.001;

/**
 * Bodies created with `isStatic: true` never regain mass when released in Matter,
 * so held bodies are created dynamic and then frozen with Body.setStatic.
 */
function make<T extends { isStatic?: boolean; frictionAir?: number }>(phys: T, build: (p: T) => MBody): MBody {
  const p = { frictionAir: AIR, ...phys };
  if (!p.isStatic) return build(p);
  const b = build({ ...p, isStatic: false });
  Body.setStatic(b, true);
  return b;
}

// ---------------------------------------------------------------- primitives

export function staticRect(ctx: Ctx, x: number, y: number, w: number, h: number, role: BodyOpts['role'] = 'ground', angle = 0, phys: Phys = {}): MBody {
  const b = Bodies.rectangle(x, y, w, h, { isStatic: true, angle, friction: 0.6, ...phys });
  ctx.r.add(ctx.world, b, { role, impacts: false });
  return b;
}

export function staticCircle(ctx: Ctx, x: number, y: number, r: number, role: BodyOpts['role'] = 'structure', phys: Matter.IBodyDefinition = {}): MBody {
  const b = Bodies.circle(x, y, r, { isStatic: true, ...phys });
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
 * A rigid body built from parts. Matter sums the parts' own inertias but omits the
 * parallel-axis term, which leaves levers and wheels far too easy to spin; this restores
 * the true moment of inertia. `phys.density` applies to parts left at the default density.
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

/** Lets go of held bodies: the only "intervention" an experiment ever makes. */
export function release(...bodies: MBody[]): void {
  for (const b of bodies) if (b.isStatic) Body.setStatic(b, false);
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
export function rope(ctx: Ctx, a: Pt, b: Pt, n: number, opts: { r?: number; pinA?: boolean; pinB?: boolean; hue?: number; role?: BodyOpts['role']; width?: number; density?: number; stiffness?: number } = {}): MBody[] {
  const group = Body.nextGroup(true);
  const r = opts.r ?? 5;
  const nodes: MBody[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const node = Bodies.circle(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, r, { collisionFilter: { group }, frictionAir: 0.004, density: opts.density ?? 0.003 });
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

/** Ring soft body: rim particles on springs (Hooke), drawn as one smooth blob. */
export function softBlob(ctx: Ctx, x: number, y: number, R: number, hue: number, stiff = 0.045, air = 0.002): MBody[] {
  const { world, r } = ctx;
  const n = Math.max(12, Math.round(R / 6));
  const group = Body.nextGroup(true);
  const pr = Math.max(5, R * 0.16);
  const center = Bodies.circle(x, y, R * 0.3, { collisionFilter: { group }, density: 0.002, frictionAir: air });
  Composite.add(world, center);
  const rim: MBody[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    rim.push(Bodies.circle(x + Math.cos(a) * (R - pr), y + Math.sin(a) * (R - pr), pr, { collisionFilter: { group }, friction: 0.4, restitution: 0.1, density: 0.002, frictionAir: air }));
  }
  Composite.add(world, rim);
  for (let i = 0; i < n; i++) {
    Composite.add(world, Constraint.create({ bodyA: rim[i], bodyB: rim[(i + 1) % n], stiffness: 0.9, damping: 0.05 }));
    Composite.add(world, Constraint.create({ bodyA: rim[i], bodyB: rim[(i + 2) % n], stiffness: 0.25, damping: 0.05 }));
    Composite.add(world, Constraint.create({ bodyA: center, bodyB: rim[i], stiffness: stiff, damping: 0.03 }));
  }
  r.track(center);
  r.blob(rim, 'hero', hue, pr);
  return [center, ...rim];
}

/**
 * A column of beads queued above a nozzle and let go one at a time (lowest first).
 * Waiting beads touch nothing, so a released bead simply falls — no overlap kicks.
 */
export function drip(ctx: Ctx, x: number, y: number, n: number, r: number, view: BodyOpts, phys: Matter.IBodyDefinition = {}): { beads: MBody[]; next: () => void } {
  const beads: MBody[] = [];
  for (let i = 0; i < n; i++) {
    const b = circle(ctx, x, y - i * (r * 2 + 2), r, view, { ...phys, isStatic: true });
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
}

/** Stiffness (Matter units, mass / ms²) that gives `mass` a natural frequency of `hz`. */
export function springK(mass: number, hz: number): number {
  const w = (2 * Math.PI * hz) / 1000;
  return mass * w * w;
}

const scratch = { x: 0, y: 0 };
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
 * true force law (applied every step by applySprings), so it rings like a real spring.
 * Points are in each body's local frame. Drawn as a coil unless `draw` is false.
 */
export function spring(ctx: Ctx, a: MBody | null, pa: Pt, b: MBody, pb: Pt, rest: number, k: number, opts: { damping?: number; draw?: BodyOpts['role'] | false; coils?: number; amp?: number; width?: number; hue?: number } = {}): Spring {
  const sp: Spring = { a, pa, b, pb, rest, k, damping: opts.damping ?? 0 };
  if (opts.draw !== false) {
    const coils = opts.coils ?? 9;
    const amp = opts.amp ?? 9;
    const pts: Pt[] = Array.from({ length: coils * 2 + 4 }, () => ({ x: 0, y: 0 }));
    const A = { x: 0, y: 0 };
    const B = { x: 0, y: 0 };
    const r = ctx.r;
    r.link(
      () => {
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

/** Applies every spring's force for this step (call from the template's step). */
const scratchB = { x: 0, y: 0 };
const zero = { x: 0, y: 0 };
const force = { x: 0, y: 0 };
const at = { x: 0, y: 0 };
export function applySprings(list: Spring[]): void {
  const A = scratch;
  const B = scratchB;
  for (const sp of list) {
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

/** A domino hinged at its leading foot — the honest, reliable way to topple a row in Matter. */
export function hingedDomino(ctx: Ctx, x: number, baseY: number, w: number, h: number, view: BodyOpts, dir = 1): MBody {
  const b = Bodies.rectangle(x, baseY - h / 2, w, h, { friction: 0.4, density: 0.002, frictionAir: 0.0005, chamfer: { radius: Math.min(3, w * 0.2) } });
  ctx.r.add(ctx.world, b, view);
  const foot = { x: x + (dir * w) / 2, y: baseY };
  Composite.add(ctx.world, Constraint.create({ pointA: foot, bodyB: b, pointB: { x: (dir * w) / 2, y: h / 2 }, length: 0, stiffness: 1 }));
  return b;
}

// ---------------------------------------------------------------- machines

/** Matter 0.20's velocity-carrying setters (the third argument is missing from the typings). */
export const setPositionV = Body.setPosition as unknown as (b: MBody, p: Matter.Vector, updateVelocity?: boolean) => void;
export const setAngleV = Body.setAngle as unknown as (b: MBody, a: number, updateVelocity?: boolean) => void;
/** Turns a body about a point (Matter's typings omit the point argument). */
export const rotateAbout = Body.rotate as unknown as (b: MBody, angle: number, point: Matter.Vector) => void;

/** Drives a static body around a fixed centre at angular speed `w` (rad/s), carrying contact velocity. */
export function spin(b: MBody, w: number, dt: number): void {
  setAngleV(b, b.angle + w * dt, true);
}

/** Moves a static body to a target position this step, carrying contact velocity. */
export function drive(b: MBody, x: number, y: number): void {
  setPositionV(b, { x, y }, true);
}

/** A compound static rotor (hub + paddles), meant to be turned with `spin`. */
export function rotor(ctx: Ctx, x: number, y: number, hub: number, arm: number, blades: number, thick = 14, role: BodyOpts['role'] = 'structure'): MBody {
  const parts: MBody[] = [Bodies.circle(x, y, hub)];
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2;
    parts.push(Bodies.rectangle(x + Math.cos(a) * (hub + arm / 2), y + Math.sin(a) * (hub + arm / 2), arm, thick, { angle: a }));
  }
  const b = Body.create({ parts, isStatic: true, friction: 0.3 });
  ctx.r.add(ctx.world, b, { role, impacts: false });
  return b;
}

// ---------------------------------------------------------------- fields

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
  Body.applyForce(b, b.position, { x: dx * inv * f, y: dy * inv * f });
}

/** Circular-orbit speed (Matter velocity units) for `attract` with strength g at radius r. */
export const orbitSpeed = (g: number, r: number) => Math.sqrt((g * 1000 * 90000) / Math.max(r, 1)) / 60;

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
