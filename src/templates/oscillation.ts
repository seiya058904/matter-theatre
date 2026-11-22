import { W, type SceneDef } from '../core/types';
import { Bodies, Body, Composite, Constraint, applySprings, circle, dolly, ground, rect, release, rope, spring, springK, type MBody, type Spring } from './kit';

/** Pendulum Wave — fifteen tuned pendulums drift through snakes, braids and two clean rows. */
const pendulumWave: SceneDef = {
  id: 'pendulum-wave',
  theme: 'oscillation',
  title: { zh: '摆波', en: 'Pendulum Wave' },
  law: { zh: '周期 T = 2π√(L/g)', en: 'Period T = 2π√(L/g)' },
  blurb: { zh: '十五个摆长经过调谐的单摆，相位逐渐错开，舞出蛇形、辫状与双排图案。', en: 'Fifteen tuned pendulums drift out of phase into snakes, braids and two clean rows.' },
  duration: 14,
  energy: 1,
  endState: 'periodic',
  setup(ctx) {
    const { engine, r, world } = ctx;
    engine.gravity.scale = 0.004;
    const g = 4000;
    const n = 15;
    const cycle = 24;
    const pivotY = 120;
    const amp = 0.3;
    const bobs: MBody[] = [];
    const pivots: number[] = [];
    const group = Body.nextGroup(true);
    for (let i = 0; i < n; i++) {
      const T = cycle / (10 + i);
      const L = g * Math.pow(T / (2 * Math.PI), 2);
      const x = W / 2 + (i - (n - 1) / 2) * 84;
      pivots.push(x);
      const b = Bodies.circle(x + Math.sin(amp) * L, pivotY + Math.cos(amp) * L, 16, { frictionAir: 0, collisionFilter: { group } });
      Body.setStatic(b, true);
      r.add(world, b, { role: 'hero', hue: i / (n - 1), trail: 2.4, weight: 1, impacts: false });
      const c = Constraint.create({ pointA: { x, y: pivotY }, bodyB: b, length: L, stiffness: 1 });
      Composite.add(world, c);
      r.constraint(c, 'structure', 1.2);
      bobs.push(b);
    }
    r.link(() => bobs.map((b) => r.ipos(b)), 'accent', 1.5);
    r.drawBack((gr) => gr.roundRect(pivots[0] - 80, pivotY - 16, pivots[n - 1] - pivots[0] + 160, 14, 7).fill({ color: ctx.style.structure, alpha: 0.7 }));
    dolly(ctx, W / 2, 470, 1.1, 0.98, W / 2, 440);
    return { entry: { x: W / 2, y: 400 }, enter: () => release(...bobs) };
  },
};

/** Double Pendulum — seven double pendulums a hair apart move as one, then fan out forever. */
const chaos: SceneDef = {
  id: 'double-pendulum',
  theme: 'oscillation',
  title: { zh: '双摆混沌', en: 'Double Pendulum' },
  law: { zh: '混沌 · 对初值的敏感依赖', en: 'Chaos: sensitive dependence' },
  blurb: { zh: '七个双摆的初始角度只差千分之二弧度，起初如影随形，几次摆动之后便彻底分道扬镳。', en: 'Seven double pendulums a hair apart move as one, then fan out forever.' },
  duration: 13,
  energy: 3,
  endState: 'periodic',
  setup(ctx) {
    const { r, world, engine } = ctx;
    engine.gravity.scale = 0.0016;
    const pivot = { x: W / 2, y: 330 };
    const L1 = 200;
    const L2 = 180;
    const n = 7;
    const group = Body.nextGroup(true);
    const held: MBody[] = [];
    for (let i = 0; i < n; i++) {
      const t1 = 2.5;
      const t2 = 2.5 + (i - (n - 1) / 2) * 0.002;
      const p1 = { x: pivot.x + Math.sin(t1) * L1, y: pivot.y + Math.cos(t1) * L1 };
      const p2 = { x: p1.x + Math.sin(t2) * L2, y: p1.y + Math.cos(t2) * L2 };
      const b1 = Bodies.circle(p1.x, p1.y, 13, { frictionAir: 0, density: 0.004, collisionFilter: { group } });
      const b2 = Bodies.circle(p2.x, p2.y, 14, { frictionAir: 0, density: 0.004, collisionFilter: { group } });
      Composite.add(world, [b1, b2]);
      r.body(b1, { role: 'structure', impacts: false });
      r.body(b2, { role: 'hero', hue: i / (n - 1), trail: 4, weight: 1, impacts: false });
      const c1 = Constraint.create({ pointA: pivot, bodyB: b1, length: L1, stiffness: 1 });
      const c2 = Constraint.create({ bodyA: b1, bodyB: b2, length: L2, stiffness: 1 });
      Composite.add(world, [c1, c2]);
      r.constraint(c1, 'structure', 2);
      r.constraint(c2, 'hero', 2, i / (n - 1));
      Body.setStatic(b1, true);
      Body.setStatic(b2, true);
      held.push(b1, b2);
    }
    r.drawBack((g) => g.circle(pivot.x, pivot.y, 8).fill({ color: ctx.style.structure, alpha: 0.9 }));
    dolly(ctx, W / 2, 470, 1.12, 1.2, W / 2, 480);
    return { entry: pivot, enter: () => release(...held) };
  },
};

/** Spring Lissajous — three bobs on crossed springs of different stiffness ratios draw Lissajous figures. */
const lissajous: SceneDef = {
  id: 'spring-lissajous',
  theme: 'oscillation',
  title: { zh: '弹簧谐振图', en: 'Spring Lissajous' },
  law: { zh: '二维简谐振动', en: 'Two-dimensional harmonic motion' },
  blurb: { zh: '三颗重锤被横竖两组刚度不同的弹簧张紧，两个方向的频率比各不相同，画出三幅缓慢变幻的利萨如图形。', en: 'Bobs held by crossed springs of different stiffness swing at two frequencies and draw slowly turning Lissajous figures.' },
  duration: 13,
  energy: 1,
  endState: 'periodic',
  gravity: { x: 0, y: 0 },
  setup(ctx) {
    const { r } = ctx;
    // Frequency ratios x:y and the stiffness ratio each needs (pre-tensioned springs, 10 % transverse).
    const set = [
      { ratio: 2, kr: 6.5 },
      { ratio: 1.5, kr: 2.774 },
      { ratio: 4 / 3, kr: 2.041 },
    ];
    const held: MBody[] = [];
    const springs: Spring[] = [];
    const kicks: { b: MBody; vy: number }[] = [];
    const D = 230;
    set.forEach((q, i) => {
      const cx = 420 + i * 540;
      const cy = 540;
      const bob = circle(ctx, cx + 130, cy, 16, { role: 'hero', hue: i / 2, trail: 14, weight: 1, impacts: false }, { isStatic: true, frictionAir: 0, density: 0.004 });
      const m = Math.PI * 16 * 16 * 0.004;
      const wx = (2 * Math.PI * 0.34) / 1000;
      const k1 = (m * wx * wx) / (2 + 0.2 * q.kr);
      const k2 = k1 * q.kr;
      for (const [px, py, k] of [[cx - D, cy, k1], [cx + D, cy, k1], [cx, cy - D, k2], [cx, cy + D, k2]] as const)
        springs.push(spring(ctx, null, { x: px, y: py }, bob, { x: 0, y: 0 }, D * 0.9, k, { coils: 7, amp: 6, width: 1.4 }));
      r.drawBack((g) => g.rect(cx - D, cy - D, D * 2, D * 2).stroke({ width: 1.5, color: ctx.style.structure, alpha: 0.35 }));
      held.push(bob);
      // Plucked sideways as it is let go: amplitude ~110 px in y.
      kicks.push({ b: bob, vy: ((wx * q.ratio * 1000 * 110) / 60) * (i % 2 ? -1 : 1) });
    });
    dolly(ctx, W / 2, 540, 1.0, 1.05);
    return {
      entry: { x: W / 2, y: 540 },
      enter: () => {
        release(...held);
        for (const k of kicks) Body.setVelocity(k.b, { x: 0, y: k.vy });
      },
      step: () => applySprings(springs),
    };
  },
};

/** Coupled Pendulums — two pendulums joined by a weak spring trade their energy back and forth. */
const coupled: SceneDef = {
  id: 'coupled-pendulums',
  theme: 'oscillation',
  title: { zh: '耦合摆', en: 'Coupled Pendulums' },
  law: { zh: '耦合振动与拍频', en: 'Coupled oscillation and beats' },
  blurb: { zh: '两对摆用细弹簧相连，一只摆起，能量便在两只之间来回转移，此起彼伏。', en: 'Pendulums joined by a weak spring hand their energy back and forth, one swinging while the other rests.' },
  duration: 14,
  energy: 1,
  endState: 'periodic',
  setup(ctx) {
    const { world, r, engine } = ctx;
    engine.gravity.scale = 0.0022;
    const pairs = [
      // Coupling chosen for beat periods of about 7 s and 4.5 s.
      { x: 620, k: 2.46e-6, hue: 0.1 },
      { x: 1300, k: 4.15e-6, hue: 0.65 },
    ];
    const held: MBody[] = [];
    const springs: Spring[] = [];
    const len = 420;
    const py = 200;
    for (const p of pairs) {
      const bobs = [-1, 1].map((s, j) => {
        const px = p.x + s * 150;
        const ang = j === 0 ? -0.42 : 0;
        const b = circle(ctx, px + Math.sin(ang) * len, py + Math.cos(ang) * len, 30, { role: 'hero', hue: p.hue + j * 0.15, trail: 2.2, weight: 1, impacts: false }, { isStatic: true, frictionAir: 0, density: 0.004 });
        const c = Constraint.create({ pointA: { x: px, y: py }, bodyB: b, length: len, stiffness: 1 });
        Composite.add(world, c);
        r.constraint(c, 'structure', 1.5);
        return b;
      });
      const m = Math.PI * 30 * 30 * 0.004;
      springs.push(spring(ctx, bobs[0], { x: 0, y: 0 }, bobs[1], { x: 0, y: 0 }, 300, p.k * m, { draw: 'accent', coils: 12, amp: 7, width: 1.5 }));
      held.push(...bobs);
      r.drawBack((g) => g.roundRect(p.x - 260, py - 14, 520, 12, 6).fill({ color: ctx.style.structure, alpha: 0.7 }));
    }
    dolly(ctx, W / 2, 470, 1.02, 1.06);
    return { entry: { x: W / 2, y: 500 }, enter: () => release(...held), step: () => applySprings(springs) };
  },
};

/** Wrecking Ball — a heavy ball on a chain swings into a settled brick wall. */
const wreckingBall: SceneDef = {
  id: 'wrecking-ball',
  theme: 'oscillation',
  title: { zh: '破坏球', en: 'Wrecking Ball' },
  law: { zh: '摆的势能化为冲击', en: 'Pendulum energy becomes impact' },
  blurb: { zh: '挂在长链上的重球从高处荡下，撞进砖墙，砖块四散；重球余势未消，继续摆荡。', en: 'A heavy ball on a long chain swings down into a brick wall and keeps swinging through the rubble.' },
  duration: 11,
  energy: 5,
  endState: 'periodic',
  presettle: 1,
  canDrop: true,
  setup(ctx) {
    const { world, r } = ctx;
    const gy = 940;
    const fl = ground(ctx, gy, 5000);
    for (let row = 0; row < 9; row++)
      for (let k = 0; k < 4; k++) rect(ctx, 1260 + k * 62 + (row % 2) * 31, gy - 20 - row * 40, 60, 38, { role: 'hero', hue: row / 9 }, { friction: 0.7, density: 0.0015 });
    const pivot = { x: 900, y: 60 };
    const links = rope(ctx, pivot, { x: 420, y: 380 }, 12, { r: 6, density: 0.004 });
    const ball = circle(ctx, 400, 400, 64, { role: 'accent', trail: 1.2, weight: 1 }, { density: 0.02, frictionAir: 0.0005 });
    Composite.add(world, Constraint.create({ bodyA: links[links.length - 1], bodyB: ball, length: 70, stiffness: 1 }));
    for (const b of links) Body.setStatic(b, true);
    Body.setStatic(ball, true);
    r.impactMin = 4;
    dolly(ctx, 1000, 560, 0.95, 1.02);
    return { entry: { x: 1300, y: gy - 200 }, floors: [fl], enter: () => release(...links, ball) };
  },
};

/** Spring Organ — twelve masses on springs of rising stiffness bounce in a shimmering wave. */
const springOrgan: SceneDef = {
  id: 'spring-organ',
  theme: 'oscillation',
  title: { zh: '弹簧波管风琴', en: 'Spring Organ' },
  law: { zh: '频率 ∝ √(k/m)', en: 'Frequency ∝ √(k/m)' },
  blurb: { zh: '十二个质量块挂在刚度递增的弹簧上，同时下拉松开，各自以不同频率起伏，汇成流动的波浪，十二秒后重新对齐。', en: 'Twelve masses on ever-stiffer springs are pulled down and let go; their rhythms ripple into waves and realign.' },
  duration: 13,
  energy: 1,
  endState: 'periodic',
  setup(ctx) {
    const { r, engine } = ctx;
    const n = 12;
    const held: MBody[] = [];
    const springs: Spring[] = [];
    const top = 140;
    const level = top + 380;
    const g = engine.gravity.y * engine.gravity.scale;
    const masses: MBody[] = [];
    for (let i = 0; i < n; i++) {
      const x = 330 + i * 115;
      // Frequencies (6 + i) / 12 Hz: every mass completes whole cycles in 12 s and they realign.
      const hz = (6 + i) / 12;
      const m = rect(ctx, x, level + 110, 64, 40, { role: 'hero', hue: i / (n - 1), trail: 1.4, weight: 1, impacts: false }, { isStatic: true, frictionAir: 0, density: 0.003 });
      m.collisionFilter.group = -4;
      const mass = 64 * 40 * 0.003;
      const k = springK(mass, hz);
      // Rest length chosen so every mass hangs at the same level.
      springs.push(spring(ctx, null, { x, y: top }, m, { x: 0, y: -20 }, level - 20 - top - (mass * g) / k, k, { coils: 10, amp: 7, width: 1.5 }));
      held.push(m);
      masses.push(m);
    }
    r.link(() => masses.map((m) => r.ipos(m)), 'accent', 1.5);
    r.drawBack((gr) => gr.roundRect(260, top - 16, 1400, 14, 7).fill({ color: ctx.style.structure, alpha: 0.7 }));
    dolly(ctx, W / 2, 520, 1.02, 1.06);
    return { entry: { x: W / 2, y: 520 }, enter: () => release(...held), step: () => applySprings(springs) };
  },
};

export const OSCILLATION: SceneDef[] = [pendulumWave, chaos, lissajous, coupled, wreckingBall, springOrgan];
