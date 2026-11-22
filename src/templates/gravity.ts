import Matter from 'matter-js';
import { W, type SceneDef } from '../core/types';
import { easeInOutSine } from '../core/ease';
import { Bodies, Body, Composite, Constraint, circle, dolly, ground, open, polygon, rect, release, staticCircle, staticRect, wallPath, arcPts, type MBody, type Pt } from './kit';

/** Falling Choir — shapes released together from heights tuned by h = ½gt² land as an arpeggio. */
const choir: SceneDef = {
  id: 'falling-choir',
  theme: 'gravity',
  title: { zh: '落体合唱', en: 'Falling Choir' },
  law: { zh: '自由落体 h = ½gt²', en: 'Free fall, h = ½gt²' },
  blurb: { zh: '十二个物体同时松手，高度按 h = ½gt² 计算，依次落地，像琶音一样点亮琴键。', en: 'Twelve shapes released at once from tuned heights land in sequence, an arpeggio on the keys.' },
  duration: 10,
  energy: 2,
  endState: 'settle',
  canDrop: true,
  setup(ctx) {
    const { r } = ctx;
    const n = 12;
    const keyY = 900;
    const keyW = 118;
    const x0 = W / 2 - ((n - 1) * (keyW + 10)) / 2;
    const glow = new Array(n).fill(0);
    const keys: MBody[] = [];
    for (let i = 0; i < n; i++) keys.push(staticRect(ctx, x0 + i * (keyW + 10), keyY, keyW, 18, 'structure', 0, { restitution: 0.4 }));
    r.drawBack((g, dt) => {
      for (let i = 0; i < n; i++) {
        glow[i] = Math.max(0, glow[i] - dt * 0.9);
        const c = r.color('hero', i / (n - 1));
        const x = x0 + i * (keyW + 10) - keyW / 2;
        g.rect(x, keyY + 12, keyW, 150).fill({ color: c, alpha: 0.05 + glow[i] * 0.4 });
        g.rect(x, keyY - 9 - glow[i] * 8, keyW, 4).fill({ color: c, alpha: 0.15 + glow[i] * 0.85 });
      }
    });
    const held: MBody[] = [];
    for (let i = 0; i < n; i++) {
      const t = 0.42 + i * 0.16;
      const y = keyY - 9 - 0.5 * 1000 * t * t - 26;
      const x = x0 + i * (keyW + 10);
      const view = { role: 'hero' as const, hue: i / (n - 1), trail: 1.2 };
      const phys = { isStatic: true, restitution: 0.5, friction: 0.2, frictionAir: 0 };
      const kind = i % 3;
      held.push(kind === 0 ? circle(ctx, x, y, 24, view, phys) : kind === 1 ? polygon(ctx, x, y, 3, 30, view, phys) : rect(ctx, x, y, 44, 44, view, phys));
    }
    Matter.Events.on(ctx.engine, 'collisionStart', (e) => {
      for (const p of e.pairs) {
        const k = keys.indexOf(p.bodyA) >= 0 ? keys.indexOf(p.bodyA) : keys.indexOf(p.bodyB);
        if (k >= 0) glow[k] = 1;
      }
    });
    dolly(ctx, W / 2, 560, 1.0, 1.04, W / 2, 600);
    return { entry: { x: W / 2, y: 500 }, floors: keys, enter: () => release(...held) };
  },
};

/** Brachistochrone — line, arc and cycloid race between the same two points; the cycloid wins. */
const brachistochrone: SceneDef = {
  id: 'brachistochrone',
  theme: 'gravity',
  title: { zh: '最速降线', en: 'Brachistochrone' },
  law: { zh: '能量守恒 · 最速降线', en: 'Energy conservation · fastest descent' },
  blurb: { zh: '直线、圆弧、摆线三条无摩擦轨道，起点终点相同，摆线最先到达；之后每颗球都几乎回到出发的高度。', en: 'Line, arc and cycloid share start and finish; the cycloid wins, and every ball climbs back almost to its start.' },
  duration: 12,
  energy: 2,
  endState: 'periodic',
  setup(ctx) {
    const { r, world, engine } = ctx;
    engine.gravity.scale = 0.0005;
    const A = { x: 330, y: 300 };
    const B = { x: 1470, y: 740 };
    const rad = 16;
    const thick = 10;
    const dx = B.x - A.x;
    const dy = B.y - A.y;
    let lo = 0.01;
    let hi = 2 * Math.PI - 0.01;
    for (let i = 0; i < 80; i++) {
      const m = (lo + hi) / 2;
      if ((m - Math.sin(m)) / (1 - Math.cos(m)) < dx / dy) lo = m;
      else hi = m;
    }
    const te = (lo + hi) / 2;
    const R = dy / (1 - Math.cos(te));
    const len = Math.hypot(dx, dy);
    const C = { x: (A.x + B.x) / 2 + (dy / len) * 600, y: (A.y + B.y) / 2 + (-dx / len) * 600 };
    const ra = Math.hypot(A.x - C.x, A.y - C.y);
    const a0 = Math.atan2(A.y - C.y, A.x - C.x);
    let a1 = Math.atan2(B.y - C.y, B.x - C.x);
    if (a1 > a0) a1 -= Math.PI * 2;
    const curves: ((u: number) => Pt)[] = [
      (u) => ({ x: A.x + dx * u, y: A.y + dy * u }),
      (u) => ({ x: C.x + Math.cos(a0 + (a1 - a0) * u) * ra, y: C.y + Math.sin(a0 + (a1 - a0) * u) * ra }),
      (u) => ({ x: A.x + R * (te * u - Math.sin(te * u)), y: A.y + R * (1 - Math.cos(te * u)) }),
    ];
    const tail = (u: number): Pt => {
      if (u < 0.35) return { x: B.x + (u / 0.35) * 160, y: B.y };
      const qa = (Math.PI / 2) * ((u - 0.35) / 0.65);
      return { x: B.x + 160 + Math.sin(qa) * 300, y: B.y - (1 - Math.cos(qa)) * 300 };
    };
    const balls: MBody[] = [];
    const paths: Pt[][] = [];
    const arrived: number[] = [];
    curves.forEach((f, i) => {
      const cat = 1 << (i + 1);
      const pts: Pt[] = [];
      for (let k = 0; k <= 70; k++) pts.push(f(k / 70));
      for (let k = 1; k <= 24; k++) pts.push(tail(k / 24));
      paths.push(pts.map((p) => ({ x: p.x, y: p.y + rad + 2 })));
      for (let k = 0; k < pts.length - 1; k++) {
        const a = pts[k];
        const b = pts[k + 1];
        const tx = b.x - a.x;
        const ty = b.y - a.y;
        const L = Math.hypot(tx, ty) || 1;
        let ox = -ty / L;
        let oy = tx / L;
        if (oy < 0) {
          ox = -ox;
          oy = -oy;
        }
        const off = rad + thick / 2;
        Composite.add(world, Bodies.rectangle((a.x + b.x) / 2 + ox * off, (a.y + b.y) / 2 + oy * off, L + 2, thick, { isStatic: true, angle: Math.atan2(ty, tx), friction: 0, collisionFilter: { category: cat, mask: cat } }));
      }
      balls.push(circle(ctx, A.x + 0.5, A.y - 0.5, rad, { role: 'hero', hue: i / 2, trail: 2.2, weight: 1, impacts: false }, { isStatic: true, friction: 0, frictionAir: 0, restitution: 0, collisionFilter: { category: cat, mask: cat } }));
    });
    r.drawBack((g) => {
      paths.forEach((pts, i) => ctx.style.drawLink(g, pts, r.look('hero', i / 2), 3));
      g.rect(A.x - 3, A.y - 60, 6, 80).fill({ color: ctx.style.structure, alpha: 0.7 });
      g.rect(B.x - 2, B.y - 120, 4, 160).fill({ color: ctx.style.accentColor, alpha: 0.8 });
    });
    r.drawFront((g) => arrived.forEach((i, rank) => g.circle(B.x, B.y - 150 - rank * 34, 11 - rank * 2).fill({ color: r.color('hero', i / 2), alpha: 0.95 })));
    dolly(ctx, W / 2 + 40, 560, 0.98, 1.02);
    return {
      entry: A,
      enter: () => release(...balls),
      step: () =>
        balls.forEach((b, i) => {
          if (!arrived.includes(i) && b.position.x >= B.x) {
            arrived.push(i);
            r.fx.ring({ x: B.x, y: b.position.y, r1: 70 - arrived.length * 14, width: 2, color: r.color('hero', i / 2), life: 0.7 });
          }
        }),
    };
  },
};

/** Friction Glide — identical strikers push identical pucks; rougher lanes stop them sooner. */
const frictionGlide: SceneDef = {
  id: 'friction-glide',
  theme: 'gravity',
  title: { zh: '摩擦滑行', en: 'Friction Glide' },
  law: { zh: '摩擦力做功', en: 'Work done by friction' },
  blurb: { zh: '五个相同的摆锤给五块相同的滑块同样的一击，唯一的不同是地面的粗糙程度。', en: 'Identical strikers give identical pucks the same push; only the lanes differ in roughness.' },
  duration: 11,
  energy: 2,
  endState: 'settle',
  setup(ctx) {
    const { r, world } = ctx;
    const lanes = 5;
    const mus = [0.018, 0.026, 0.038, 0.056, 0.085];
    const pucks: MBody[] = [];
    const bobs: MBody[] = [];
    const stops: (Pt | null)[] = new Array(lanes).fill(null);
    const startX = 352;
    for (let i = 0; i < lanes; i++) {
      const y = 330 + i * 140;
      staticRect(ctx, 1070, y + 7, 1500, 14, 'structure', 0, { friction: 1, frictionStatic: 0 });
      pucks.push(rect(ctx, startX, y - 18, 64, 36, { role: 'hero', hue: i / (lanes - 1), trail: 1.5, weight: 1 }, { friction: mus[i], frictionStatic: 0, frictionAir: 0, density: 0.002, restitution: 0.6, chamfer: { radius: 14 } }));
      const pivot = { x: 250, y: y - 26 - 230 };
      const ang = -1.3;
      const bob = circle(ctx, pivot.x + Math.sin(ang) * 230, pivot.y + Math.cos(ang) * 230, 22, { role: 'accent', weight: 1, impacts: false }, { isStatic: true, density: 0.012, frictionAir: 0, restitution: 0.8 });
      const c = Constraint.create({ pointA: pivot, bodyB: bob, length: 230, stiffness: 1 });
      Composite.add(world, c);
      r.constraint(c, 'structure', 1.5);
      bobs.push(bob);
      r.drawBack((g) => {
        const k = i / (lanes - 1);
        for (let x = 320; x < 1810; x += 24 - k * 14) g.rect(x, y + 1, 2, 3 + k * 4).fill({ color: ctx.style.structure, alpha: 0.18 + k * 0.25 });
      });
    }
    r.drawFront((g) => {
      const pts = stops.filter((p): p is Pt => !!p);
      pts.forEach((p) => g.circle(p.x, p.y, 5).fill({ color: ctx.style.accentColor, alpha: 0.9 }));
      if (pts.length >= 2) ctx.style.drawLink(g, pts, r.look('accent'), 1.5);
    });
    dolly(ctx, W / 2, 600, 0.98, 1.02);
    let t0 = -1;
    return {
      entry: { x: startX, y: 600 },
      enter: () => release(...bobs),
      step: (t) => {
        if (t0 < 0) t0 = t;
        pucks.forEach((p, i) => {
          if (!stops[i] && t - t0 > 1 && p.speed < 0.05 && p.position.x > startX + 20) stops[i] = { x: p.position.x + 32, y: p.position.y - 30 };
        });
      },
    };
  },
};

/** Projectile Fan — twelve balls launched at the same speed and different angles draw a family of parabolas. */
const projectileFan: SceneDef = {
  id: 'projectile-fan',
  theme: 'gravity',
  title: { zh: '抛射扇面', en: 'Projectile Fan' },
  law: { zh: '抛体运动', en: 'Projectile motion' },
  blurb: { zh: '同一速率、不同角度依次抛出的十二颗球，轨迹叠成一把抛物线之伞，45° 飞得最远。', en: 'Twelve balls thrown at one speed and different angles draw an umbrella of parabolas; 45° goes furthest.' },
  duration: 11,
  energy: 3,
  endState: 'settle',
  canDrop: true,
  setup(ctx) {
    const { tl } = ctx;
    const origin = { x: 230, y: 930 };
    const fl = ground(ctx, 980, 5000);
    const speed = 20;
    const balls: MBody[] = [];
    const n = 12;
    for (let i = 0; i < n; i++) {
      const b = circle(ctx, origin.x, origin.y - i * 0.01, 14, { role: 'hero', hue: i / (n - 1), trail: 4.5, weight: 1 }, { isStatic: true, restitution: 0.1, friction: 0.4, frictionAir: 0 });
      b.collisionFilter.group = -2;
      balls.push(b);
    }
    staticRect(ctx, origin.x - 40, origin.y + 25, 120, 50, 'structure');
    // A comb of slots along the floor: each ball drops into the slot where it lands.
    for (let x = 520; x <= 1860; x += 44) staticRect(ctx, x, 958, 6, 44, 'structure', 0, { restitution: 0.1 });
    staticRect(ctx, 1900, 880, 20, 200, 'structure');
    dolly(ctx, W / 2, 580, 1.0, 0.97);
    return {
      entry: origin,
      floors: [fl],
      enter: () =>
        balls.forEach((b, i) =>
          tl.at(tl.t + i * 0.14, () => {
            const a = ((14 + (i * 68) / (n - 1)) * Math.PI) / 180;
            release(b);
            Body.setVelocity(b, { x: Math.cos(a) * speed, y: -Math.sin(a) * speed });
          }),
        ),
    };
  },
};

/** Tumbling Room — the room turns over a quarter at a time; its furniture slides and tumbles. */
const tumblingRoom: SceneDef = {
  id: 'tumbling-room',
  theme: 'gravity',
  title: { zh: '翻转房间', en: 'Tumbling Room' },
  law: { zh: '转动参考系中的重力', en: 'Gravity in a turning room' },
  blurb: { zh: '房间每次翻转九十度，重力随之换向，房里的"家具"一次次滑落、翻滚、重新堆叠。', en: 'The room turns a quarter at a time; its furniture slides, tumbles and restacks.' },
  duration: 12,
  energy: 3,
  endState: 'settle',
  presettle: 1,
  setup(ctx) {
    const { engine, camera, tl, rng } = ctx;
    const cx = W / 2;
    const cy = 540;
    const s = 640;
    staticRect(ctx, cx, cy - s / 2 - 12, s + 48, 24, 'structure');
    staticRect(ctx, cx, cy + s / 2 + 12, s + 48, 24, 'structure');
    staticRect(ctx, cx - s / 2 - 12, cy, 24, s, 'structure');
    staticRect(ctx, cx + s / 2 + 12, cy, 24, s, 'structure');
    const pieces: [number, number, number][] = [[150, 60, 0.05], [90, 90, 0.25], [60, 140, 0.45], [120, 40, 0.6], [70, 70, 0.8], [40, 40, 0.95], [100, 30, 0.35]];
    let x = cx - s / 2 + 40;
    for (const [w, h, hue] of pieces) {
      rect(ctx, x + w / 2, cy + s / 2 - h / 2 - 2, w, h, { role: 'hero', hue, weight: 1 }, { friction: 0.5, restitution: 0.15, density: 0.002 });
      x += w + 8;
      if (x > cx + s / 2 - 120) x = cx - s / 2 + 60;
    }
    circle(ctx, cx + 120, cy + s / 2 - 120, 34, { role: 'accent', weight: 1 }, { friction: 0.05, restitution: 0.3 });
    void rng;
    const setPhi = (a: number) => {
      engine.gravity.x = Math.sin(a);
      engine.gravity.y = Math.cos(a);
      camera.angle = camera.targetAngle = a;
    };
    camera.set(cx, cy, 1.0);
    camera.stiffness = 0.5;
    let phi = 0;
    const turn = (at: number) =>
      tl.during(at, at + 1.3, (p) => {
        setPhi(phi + (Math.PI / 2) * easeInOutSine(p));
        if (p >= 1) phi += Math.PI / 2;
      });
    return {
      entry: { x: cx, y: cy },
      enter: () => {
        const t0 = tl.t;
        turn(t0 + 0.2);
        turn(t0 + 2.6);
        turn(t0 + 5.0);
      },
    };
  },
};

/** Trapdoor Shelves — three hinged trapdoors open in turn and a cargo of shapes cascades down. */
const trapdoors: SceneDef = {
  id: 'trapdoor-shelf',
  theme: 'gravity',
  title: { zh: '活板门货架', en: 'Trapdoor Shelves' },
  law: { zh: '重力与铰链', en: 'Gravity and hinges' },
  blurb: { zh: '三层货架的活板门依次打开，满载的形体一层层倾泻而下，落进底部的盆里。', en: 'Three trapdoors swing open in turn; their cargo cascades shelf by shelf into the basin below.' },
  duration: 11,
  energy: 3,
  endState: 'settle',
  presettle: 0.8,
  setup(ctx) {
    const { r, rng, tl, world } = ctx;
    const latches: MBody[] = [];
    const w = 340;
    // Each shelf sits under the spill of the one above; doors hinge on the left, latch on the right.
    const shelves = [
      { x: 540, y: 300 },
      { x: 720, y: 520 },
      { x: 900, y: 740 },
    ];
    shelves.forEach((s, i) => {
      for (const side of i === 0 ? [-1, 1] : [1]) staticRect(ctx, s.x + side * (w / 2 + 12), s.y - 80, 14, 140, 'structure');
      const door = rect(ctx, s.x, s.y, w, 16, { role: 'debris', hue: i / 2 }, { density: 0.003, friction: 0.3 });
      Composite.add(world, Constraint.create({ pointA: { x: s.x - w / 2, y: s.y }, bodyB: door, pointB: { x: -w / 2, y: 0 }, length: 0, stiffness: 1 }));
      staticCircle(ctx, s.x - w / 2, s.y, 7, 'structure');
      r.track(door);
      latches.push(staticRect(ctx, s.x + w / 2 - 8, s.y + 16, 30, 16, 'accent'));
      for (let k = 0; k < 10; k++) {
        const x = s.x - w / 2 + 38 + (k % 5) * 66 + rng.range(-3, 3);
        const y = s.y - 32 - Math.floor(k / 5) * 50;
        const view = { role: 'hero' as const, hue: (i * 0.33 + k * 0.03) % 1 };
        if (k % 3 === 0) circle(ctx, x, y, 22, view, { friction: 0.3, restitution: 0.15 });
        else if (k % 3 === 1) rect(ctx, x, y, 40, 40, view, { friction: 0.4, restitution: 0.1 });
        else polygon(ctx, x, y + 4, 3, 26, view, { friction: 0.4, restitution: 0.1 });
      }
    });
    const basin = [...wallPath(ctx, [{ x: 770, y: 930 }, { x: 800, y: 1000 }, { x: 1420, y: 1000 }, { x: 1450, y: 930 }], 18), ground(ctx, 1030, 4000), staticRect(ctx, 250, 900, 20, 260, 'structure'), staticRect(ctx, 1700, 900, 20, 260, 'structure')];
    dolly(ctx, 900, 580, 0.94, 0.98);
    return {
      entry: { x: 720, y: 520 },
      floors: basin,
      enter: () => latches.forEach((l, i) => tl.at(tl.t + 0.3 + i * 1.7, () => open(ctx, l))),
    };
  },
};

/** Cascade Bounce — balls ricochet down a zigzag of tilted plates into a bowl. */
const cascade: SceneDef = {
  id: 'cascade-bounce',
  theme: 'gravity',
  title: { zh: '台阶弹球', en: 'Cascade Bounce' },
  law: { zh: '反射与能量损失', en: 'Reflection and energy loss' },
  blurb: { zh: '几颗球从高处落下，在之字排列的斜板之间来回弹跳，每撞一次都点亮一块板。', en: 'Balls ricochet down a zigzag of tilted plates, lighting each one they strike.' },
  duration: 11,
  energy: 3,
  endState: 'settle',
  setup(ctx) {
    const { tl } = ctx;
    const plates: [number, number, number][] = [
      [760, 300, 0.32], [1150, 420, -0.32], [760, 560, 0.32], [1150, 690, -0.32], [800, 830, 0.25],
    ];
    for (const [x, y, a] of plates) staticRect(ctx, x, y, 300, 18, 'structure', a, { restitution: 0.8 });
    staticCircle(ctx, 960, 470, 16, 'accent', { restitution: 0.9 });
    staticCircle(ctx, 960, 740, 16, 'accent', { restitution: 0.9 });
    const bowl = [...wallPath(ctx, arcPts(1200, 760, 260, Math.PI * 0.15, Math.PI * 0.85, 12), 16), ground(ctx, 1060, 4000)];
    const balls: MBody[] = [];
    for (let i = 0; i < 4; i++) balls.push(circle(ctx, 700 + i * 24, 120 - i * 10, 16, { role: 'hero', hue: i / 3, trail: 2.5, weight: 1 }, { isStatic: true, restitution: 0.75, friction: 0.05, frictionAir: 0 }));
    dolly(ctx, 960, 540, 0.98, 1.03);
    return {
      entry: { x: 760, y: 220 },
      floors: bowl,
      enter: () => balls.forEach((b, i) => tl.at(tl.t + i * 0.9, () => release(b))),
    };
  },
};

export const GRAVITY: SceneDef[] = [choir, brachistochrone, frictionGlide, projectileFan, tumblingRoom, trapdoors, cascade];
export type { Pt };
