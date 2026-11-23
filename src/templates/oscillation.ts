import { H, W, type SceneDef } from '../core/types';
import { Bodies, Body, Composite, Constraint, circle, dolly, drive, ground, massOf, rect, release, rope, spring, springK, staticCircle, staticRect, tuned, type MBody, type Spring } from './kit';

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
    // Running bond: odd courses start and end with half bricks, so every brick sits on two below.
    for (let row = 0; row < 9; row++) {
      const y = gy - 20 - row * 40;
      const ph = { friction: 0.7, density: 0.0015 };
      if (row % 2 === 0) for (let k = 0; k < 4; k++) rect(ctx, 1260 + k * 62, y, 60, 38, { role: 'hero', hue: row / 9 }, ph);
      else {
        rect(ctx, 1245, y, 29, 38, { role: 'hero', hue: row / 9 }, ph);
        for (let k = 0; k < 3; k++) rect(ctx, 1291 + k * 62, y, 60, 38, { role: 'hero', hue: row / 9 }, ph);
        rect(ctx, 1477, y, 29, 38, { role: 'hero', hue: row / 9 }, ph);
      }
    }
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
    return { entry: { x: W / 2, y: 520 }, enter: () => release(...held) };
  },
};

/**
 * Harmonograph — a pen held between two pairs of springs tuned almost exactly 3 : 2. Released,
 * it swings in both directions at once and slowly loses energy, drawing a rosette that turns and
 * spirals inward. The drawing stays on the paper.
 */
const harmonograph: SceneDef = {
  id: 'harmonograph',
  theme: 'oscillation',
  title: { zh: '谐振画', en: 'Harmonograph' },
  law: { zh: '两个方向的阻尼振动', en: 'Two damped oscillations at once' },
  blurb: { zh: '一支笔被横竖两组弹簧牵着，两个方向的频率几乎正好是 3∶2。松手后它同时在两个方向上摆动，又慢慢失去能量，在纸上留下一朵缓缓旋转、向内收拢的花。', en: 'A pen held by two pairs of springs tuned almost exactly 3:2 swings both ways at once and slowly loses energy, leaving a rosette that turns and spirals inward.' },
  duration: 14,
  energy: 1,
  endState: 'periodic',
  gravity: { x: 0, y: 0 },
  setup(ctx) {
    const { r } = ctx;
    const C = { x: W / 2, y: H / 2 };
    const Dx = 640;
    const Dy = 450;
    const bob = circle(ctx, C.x + 300, C.y - 60, 14, { role: 'accent', weight: 1, impacts: false }, { isStatic: true, frictionAir: 0.0016, density: 0.004 });
    const m = massOf(bob);
    // Stiffnesses for x : y = 2 : 3 (slightly detuned so the figure precesses). Each pair is
    // pre-stretched by 10 %, which also gives it a little sideways stiffness.
    const wx = (2 * Math.PI * 0.4) / 1000;
    const wy = wx * 1.5 * 1.004;
    const Kx = m * wx * wx;
    const Ky = m * wy * wy;
    const k1 = (2 * Kx - 0.2 * Ky) / 3.96;
    const k2 = (2 * Ky - 0.2 * Kx) / 3.96;
    for (const [ax, ay, k, D] of [[C.x - Dx, C.y, k1, Dx], [C.x + Dx, C.y, k1, Dx], [C.x, C.y - Dy, k2, Dy], [C.x, C.y + Dy, k2, Dy]] as const)
      spring(ctx, null, { x: ax, y: ay }, bob, { x: 0, y: 0 }, D * 0.9, k, { coils: 12, amp: 7, width: 1.3 });
    r.drawBack((g) => {
      for (const [ax, ay] of [[C.x - Dx, C.y], [C.x + Dx, C.y], [C.x, C.y - Dy], [C.x, C.y + Dy]]) g.circle(ax, ay, 9).fill({ color: ctx.style.structure, alpha: 0.9 });
    });
    const pen = r.pen('hero', 0.55, 2);
    let on = false;
    let k = 0;
    dolly(ctx, C.x, C.y, 1.0, 1.06);
    return {
      entry: C,
      enter: () => {
        release(bob);
        Body.setVelocity(bob, { x: 0, y: wy * 230 * 16.67 });
        on = true;
      },
      step: () => {
        if (on && ++k % 2 === 0) pen.add(bob.position.x, bob.position.y);
      },
    };
  },
};

/**
 * Standing Waves — a taut string, one end shaken by a motor. The motor steps up through the
 * string's resonances and the string stands in one, two, three, then four loops; the nodes stay still.
 */
const standingWave: SceneDef = {
  id: 'standing-wave',
  theme: 'oscillation',
  title: { zh: '驻波', en: 'Standing Waves' },
  law: { zh: '共振与简正模式', en: 'Resonance and normal modes' },
  blurb: { zh: '一根张紧的弦，一端由电机上下抖动。抖动频率一档档升高，弦依次共振成一段、两段、三段、四段的驻波，节点处纹丝不动。', en: 'A taut string is shaken at one end; as the motor steps up through its resonances it stands in one, two, three, then four loops, the nodes perfectly still.' },
  duration: 14,
  energy: 2,
  endState: 'periodic',
  gravity: { x: 0, y: 0 },
  setup(ctx) {
    const { r, tl } = ctx;
    const T = tuned('standing-wave', { amp: 34, air: 0.003, hold: 3.1 });
    const n = 40;
    const x0 = 250;
    const x1 = 1670;
    const y0 = 540;
    const a = (x1 - x0) / n;
    const driver = staticRect(ctx, x0, y0, 22, 64, 'accent');
    const end = staticCircle(ctx, x1, y0, 10, 'structure');
    const beads: MBody[] = [];
    for (let i = 1; i < n; i++) beads.push(circle(ctx, x0 + i * a, y0, 5, { role: 'structure', impacts: false }, { frictionAir: T.air, density: 0.004, collisionFilter: { group: -7 } }));
    // Tension for a fundamental of 0.5 Hz: c = 2·L·f, T = μ·c²; the string is pre-stretched by 25 %.
    const mu = beads[0].mass / a;
    const c = (2 * (x1 - x0) * 0.5) / 1000;
    const eps = 0.25;
    const k = (mu * c * c) / (a * eps);
    const chain = [driver, ...beads, end];
    for (let i = 0; i < chain.length - 1; i++) spring(ctx, chain[i], { x: 0, y: 0 }, chain[i + 1], { x: 0, y: 0 }, a * (1 - eps), k, { draw: false });
    r.link(() => chain.map((b) => r.ipos(b)), 'hero', 3, 0.5);
    // A long exposure: the band each point of the string sweeps out.
    const env = new Float32Array(chain.length);
    const look = r.look('hero', 0.5);
    r.drawBack((g, dt) => {
      const fade = Math.exp(-dt / 0.5);
      const up: number[] = [];
      const down: number[] = [];
      chain.forEach((b, i) => {
        env[i] = Math.max(env[i] * fade, Math.abs(b.position.y - y0));
        up.push(b.position.x, y0 - env[i]);
        down.unshift(b.position.x, y0 + env[i]);
      });
      g.poly([...up, ...down], true).fill({ color: look.color, alpha: 0.1 });
      g.moveTo(x0 - 40, y0).lineTo(x1 + 40, y0).stroke({ width: 1, color: ctx.style.structure, alpha: 0.25 });
    });
    let f = 0;
    let phase = 0;
    let on = false;
    const mode = (at: number, hz: number) => tl.during(at, at + 0.6, (p) => (f = f + (hz - f) * p));
    dolly(ctx, W / 2, y0, 1.0, 1.04);
    return {
      entry: { x: x0, y: y0 },
      enter: () => {
        on = true;
        const t0 = tl.t;
        mode(t0, 0.5);
        mode(t0 + T.hold, 1.0);
        mode(t0 + T.hold * 2, 1.5);
        mode(t0 + T.hold * 3, 2.0);
      },
      step: (_t, dt) => {
        if (!on) return;
        phase += 2 * Math.PI * f * dt;
        drive(driver, x0, y0 + Math.sin(phase) * T.amp);
      },
    };
  },
};

export const OSCILLATION: SceneDef[] = [pendulumWave, chaos, harmonograph, wreckingBall, springOrgan, standingWave];
