import type Matter from 'matter-js';
import { W, type SceneDef } from '../core/types';
import { Bodies, Body, Composite, Constraint, ball, compound, dolly, ground, link, pin, polygon, rect, release, staticCircle, staticRect, wallPath, type MBody, type Pt } from './kit';

/** Balance Scale — weights drop into the pans; the beam tips, then settles level. */
const balance: SceneDef = {
  id: 'balance-scale',
  theme: 'stacking',
  title: { zh: '天平称量', en: 'Balance Scale' },
  law: { zh: '力矩平衡', en: 'Balance of torques' },
  blurb: { zh: '砝码依次落进两只托盘，横梁先倾斜、再摇摆，最后在相等的力矩下归于水平。', en: 'Weights drop into the pans; the beam tips, sways and comes to rest when the torques match.' },
  duration: 11,
  energy: 1,
  endState: 'settle',
  setup(ctx) {
    const { world, r, tl } = ctx;
    ctx.engine.gravity.scale = 0.002;
    const cx = W / 2;
    const py = 330;
    // The column is scenery: it never touches the beam.
    staticRect(ctx, cx, (py + 990) / 2, 24, 990 - py, 'structure', 0, { collisionFilter: { group: 0, category: 0x0002, mask: 0 } });
    staticRect(ctx, cx, 990, 360, 24, 'ground');
    const beam = rect(ctx, cx, py + 30, 760, 16, { role: 'debris', hue: 0.5 }, { density: 0.002, frictionAir: 0.02 });
    // The knife-edge sits above the beam's centre of mass, so the balance rights itself.
    pin(ctx, beam, cx, py, { pointB: { x: 0, y: -30 }, length: 0 }, false);
    staticCircle(ctx, cx, py, 9, 'structure');
    const pan = (side: number) => {
      const p = rect(ctx, cx + side * 360, py + 330, 220, 14, { role: 'structure' }, { density: 0.004, frictionAir: 0.02, friction: 0.9 });
      const len = Math.hypot(300, 100);
      link(ctx, beam, p, { pointA: { x: side * 360, y: 0 }, pointB: { x: -100, y: 0 }, length: len }, 'structure', 1.2);
      link(ctx, beam, p, { pointA: { x: side * 360, y: 0 }, pointB: { x: 100, y: 0 }, length: len }, 'structure', 1.2);
      return p;
    };
    pan(-1);
    pan(1);
    // Each load lands centred on its pan: an off-centre weight tilts the hanging pan and creeps off it.
    const weights = [
      rect(ctx, cx - 360, py + 200, 70, 50, { role: 'hero', hue: 0.1, weight: 1 }, { isStatic: true, density: 0.004, friction: 0.9, restitution: 0 }),
      rect(ctx, cx + 327.5, py + 200, 50, 50, { role: 'hero', hue: 0.6, weight: 1 }, { isStatic: true, density: 0.0028, friction: 0.9, restitution: 0 }),
      rect(ctx, cx + 392.5, py + 200, 50, 50, { role: 'hero', hue: 0.7, weight: 1 }, { isStatic: true, density: 0.0028, friction: 0.9, restitution: 0 }),
    ];
    void world;
    void r;
    dolly(ctx, cx, 655, 1.26, 1.2);
    return { entry: { x: cx, y: py }, enter: () => weights.forEach((w, i) => tl.at(tl.t + 0.2 + i * 1.2, () => release(w))) };
  },
};

/** Roly-Poly — weighted toys are knocked by rolling balls and always rock back upright. */
const rolyPoly: SceneDef = {
  id: 'roly-poly',
  theme: 'stacking',
  title: { zh: '不倒翁', en: 'Roly-Poly' },
  law: { zh: '重心与稳定平衡', en: 'Low centre of mass, stable balance' },
  blurb: { zh: '重心很低的不倒翁被滚来的球撞歪，摇摇晃晃，总能自己回正。', en: 'Bottom-heavy toys get knocked by rolling balls and always rock back upright.' },
  duration: 11,
  energy: 2,
  endState: 'settle',
  setup(ctx) {
    const { world, r, tl } = ctx;
    const gy = 880;
    ground(ctx, gy, 4000);
    staticRect(ctx, 330, gy - 150, 440, 16, 'structure', 0.38);
    const toys: MBody[] = [];
    for (let i = 0; i < 4; i++) {
      const x = 760 + i * 260;
      const base = Bodies.circle(x, gy - 58, 58, { density: 0.012 });
      const head = Bodies.circle(x, gy - 140, 36, { density: 0.0004 });
      const toy = Body.create({ parts: [base, head], friction: 0.9, frictionAir: 0.002, restitution: 0.1 });
      r.add(world, toy, { role: 'hero', hue: i / 3, weight: 1 });
      toys.push(toy);
    }
    const balls = [0, 1, 2].map((i) => ball(ctx, 170 + i * 66, gy - 290 - i * 26, 30, { role: 'accent', trail: 1.5, weight: 1 }, { isStatic: true, density: 0.016, restitution: 0.3 }));
    dolly(ctx, 1000, 700, 1.05, 1.0);
    return { entry: { x: 1000, y: gy - 120 }, enter: () => balls.forEach((b, i) => tl.at(tl.t + i * 1.2, () => release(b))), dispose: () => void toys };
  },
};

/** Pyramid Demolition — a heavy ball rolls down a ramp into a settled pyramid of blocks. */
const pyramid: SceneDef = {
  id: 'pyramid-demolition',
  theme: 'stacking',
  title: { zh: '金字塔拆除', en: 'Pyramid Demolition' },
  law: { zh: '动能与堆叠稳定', en: 'Kinetic energy against a stack' },
  blurb: { zh: '一颗重球沿长坡滚下，撞进整齐的方块金字塔，砌体轰然散落。', en: 'A heavy ball rolls down a long ramp into a neat pyramid of blocks.' },
  duration: 11,
  energy: 5,
  endState: 'settle',
  presettle: 1.2,
  canDrop: true,
  setup(ctx) {
    const gy = 940;
    const fl = ground(ctx, gy, 5000);
    const s = 44;
    const rows = 9;
    const x0 = 1180;
    for (let row = 0; row < rows; row++) {
      const n = rows - row;
      for (let k = 0; k < n; k++) rect(ctx, x0 + (k - (n - 1) / 2) * (s + 1), gy - s / 2 - row * s, s, s, { role: 'hero', hue: row / rows }, { friction: 0.6, restitution: 0.05, density: 0.0012 });
    }
    wallPath(ctx, [{ x: 40, y: 180 }, { x: 520, y: 700 }, { x: 600, y: 745 }, { x: 680, y: 735 }, { x: 740, y: 705 }], 20, 'structure', { friction: 0.02 });
    const wreck = ball(ctx, 90, 160, 42, { role: 'accent', trail: 1.6, weight: 1 }, { density: 0.02, friction: 0.3, restitution: 0.1, isStatic: true });
    ctx.r.impactMin = 4;
    // Wide enough for the ramp's head and the far reach of the rubble.
    dolly(ctx, 900, 600, 0.95, 0.97, 960, 600);
    return { entry: { x: x0, y: gy - 200 }, floors: [fl], enter: () => release(wreck) };
  },
};

/** Calder Mobile — a balanced hanging mobile receives one extra pebble and re-finds its balance. */
const mobile: SceneDef = {
  id: 'calder-mobile',
  theme: 'stacking',
  title: { zh: '动态雕塑', en: 'Calder Mobile' },
  law: { zh: '杠杆平衡', en: 'Lever balance' },
  blurb: { zh: '三层平衡杆悬挂着各色形体，一颗小石子落进其中一只吊篮，整组摇摆、旋转，找到新的平衡。', en: 'A three-level mobile hangs in balance; one pebble lands in a basket and it sways to a new balance.' },
  duration: 12,
  energy: 1,
  endState: 'periodic',
  // A mobile turns slowly for a long time before it hangs still.
  presettle: 9,
  setup(ctx) {
    const { world, r } = ctx;
    const top = { x: W / 2, y: 150 };
    // Every bar hangs from a hook above its middle, so it rights itself like a real mobile.
    const lift = 40;
    const strings: Matter.Constraint[] = [];
    const local = (b: MBody, p: Pt) => ({ x: p.x - b.position.x, y: p.y - b.position.y });
    const tie = (a: MBody | null, pa: Pt, b: MBody, pb: Pt) => {
      const c = Constraint.create({ bodyA: a ?? undefined, pointA: a ? local(a, pa) : pa, bodyB: b, pointB: local(b, pb), length: Math.hypot(pb.x - pa.x, pb.y - pa.y), stiffness: 1 });
      strings.push(c);
      Composite.add(world, c);
    };
    const bar = (x: number, y: number, len: number, hue: number) =>
      compound(ctx, [Bodies.rectangle(x, y, len, 8), Bodies.rectangle(x, y - lift / 2, 5, lift)], { role: 'structure', hue }, { density: 0.0012, frictionAir: 0.008 });
    const air = { frictionAir: 0.008 };
    const y1 = top.y + 130;
    const y2 = y1 + 170;
    const y3 = y2 + 150;
    const b1 = bar(top.x, y1, 720, 0.5);
    tie(null, top, b1, { x: top.x, y: y1 - lift });
    const b2 = bar(top.x - 310, y2, 400, 0.3);
    tie(b1, { x: top.x - 310, y: y1 }, b2, { x: top.x - 310, y: y2 - lift });
    const b3 = bar(top.x + 327, y2, 360, 0.7);
    tie(b1, { x: top.x + 327, y: y1 }, b3, { x: top.x + 327, y: y2 - lift });
    const s1 = ball(ctx, top.x - 480, y3, 26, { role: 'hero', hue: 0.05, weight: 1 }, { density: 0.002, ...air });
    tie(b2, { x: top.x - 480, y: y2 }, s1, { x: top.x - 480, y: y3 - 24 });
    const s2 = polygon(ctx, top.x - 140, y3, 3, 32, { role: 'hero', hue: 0.2, weight: 1 }, { density: 0.0032, ...air });
    tie(b2, { x: top.x - 140, y: y2 }, s2, { x: top.x - 140, y: y3 - 12 });
    const s3 = rect(ctx, top.x + 177, y3, 44, 44, { role: 'hero', hue: 0.6, weight: 1 }, { density: 0.0021, ...air });
    tie(b3, { x: top.x + 177, y: y2 }, s3, { x: top.x + 177, y: y3 - 22 });
    // The basket, hung from the middle of its rim.
    const bx = top.x + 477;
    const basket = compound(ctx, [Bodies.rectangle(bx, y3 + 22, 84, 8), Bodies.rectangle(bx - 40, y3 - 14, 6, 72), Bodies.rectangle(bx + 40, y3 - 14, 6, 72)], { role: 'hero', hue: 0.8, weight: 1 }, { density: 0.0026, ...air });
    tie(b3, { x: bx, y: y2 }, basket, { x: bx, y: y3 - 22 });
    for (const c of strings) r.constraint(c, 'structure', 1);
    const pebble = ball(ctx, bx, y3 - 110, 11, { role: 'accent', weight: 1 }, { isStatic: true, density: 0.004, friction: 0.9, restitution: 0 });
    dolly(ctx, W / 2, 470, 1.05, 1.1);
    return { entry: { x: top.x, y: top.y + 200 }, enter: () => release(pebble) };
  },
};

export const STACKING: SceneDef[] = [balance, rolyPoly, pyramid, mobile];
