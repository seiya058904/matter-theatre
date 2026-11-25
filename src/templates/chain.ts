import Matter from 'matter-js';
import { W, type SceneDef } from '../core/types';
import { Bodies, Composite, Constraint, ball, compound, dolly, ground, pin, rect, release, rotateAbout, staticRect, wallPath, type Ctx, type MBody } from './kit';
import type { BodyOpts } from '../render/SceneRenderer';

/** A free-standing domino: square-edged and high-friction, so it stands flat and pivots on its front edge as a real one does. */
function domino(ctx: Ctx, x: number, baseY: number, w: number, h: number, view: BodyOpts): MBody {
  return rect(ctx, x, baseY - h / 2, w, h, view, { friction: 0.8, frictionStatic: 1, restitution: 0.02, density: 0.002, frictionAir: 0.0005, chamfer: undefined });
}

/** Domino Growth — hinged dominoes grow 7 % each; a tiny tap ends by ringing a bell. */
const dominoGrowth: SceneDef = {
  id: 'domino-growth',
  theme: 'chain',
  title: { zh: '递增多米诺', en: 'Growing Dominoes' },
  law: { zh: '势能逐级放大', en: 'Potential energy, amplified' },
  blurb: { zh: '每块骨牌都比前一块高一点，轻轻一推，波越传越猛，最后一块敲响铜铃。', en: 'Each domino stands a little taller than the last; a tiny tap swells into a wave that rings a bell.' },
  duration: 12,
  energy: 3,
  endState: 'settle',
  presettle: 0.6,
  canDrop: true,
  setup(ctx) {
    ctx.engine.gravity.scale = 0.0036;
    // A domino at rest stays at rest until something strikes it (no contact jitter can tip it).
    ctx.engine.enableSleeping = true;
    const gy = 900;
    const fl = ground(ctx, gy, 5000);
    const n = 22;
    let x = 300;
    let h = 54;
    const doms: MBody[] = [];
    for (let i = 0; i < n; i++) {
      doms.push(domino(ctx, x, gy, Math.max(10, h * 0.16), h, { role: 'hero', hue: i / (n - 1) }));
      x += h * 0.56;
      h *= 1.07;
    }
    const last = doms[n - 1];
    const bellX = last.position.x + h * 0.9;
    const bell = ball(ctx, bellX, gy - 140, 44, { role: 'accent', weight: 1 }, { density: 0.004, frictionAir: 0.002 });
    pin(ctx, bell, bellX, gy - 460, { length: 320 }, 'structure', 2);
    staticRect(ctx, bellX, gy - 470, 160, 14, 'structure');
    staticRect(ctx, 150, gy - 120, 260, 14, 'structure', 0.42, { friction: 0.02 });
    const starter = ball(ctx, 60, gy - 200, 16, { role: 'accent', trail: 1.5, weight: 1 }, { isStatic: true, density: 0.004, friction: 0.02 });
    dolly(ctx, 960, 640, 1.05, 0.98, 1000, 620);
    return { entry: { x: 300, y: gy - 60 }, floors: [fl], enter: () => release(starter) };
  },
};

/** Domino Stairs — hinged dominoes cascade down four steps, each last piece swinging over the edge. */
const dominoStairs: SceneDef = {
  id: 'domino-stairs',
  theme: 'chain',
  title: { zh: '多米诺阶梯', en: 'Domino Stairs' },
  law: { zh: '能量逐级释放', en: 'Energy released step by step' },
  blurb: { zh: '骨牌沿四级台阶依次倒下，每级最后一块越过边缘，砸醒下一级的第一块。', en: 'Dominoes topple down four steps; each last one swings over the edge and wakes the next.' },
  duration: 12,
  energy: 3,
  endState: 'settle',
  setup(ctx) {
    ctx.engine.gravity.scale = 0.005;
    const doms: MBody[] = [];
    const per = 5;
    const steps = 6;
    const h = 72;
    const gap = 40;
    let x0 = 300;
    let y = 300;
    for (let st = 0; st < steps; st++) {
      // Short steps: each run ends at its edge and the next begins one gap on, 30 px lower, so a
      // falling domino always meets the next one high on its face.
      const last = x0 + (per - 1) * gap;
      const left = x0 - 34;
      const edge = last + 8;
      staticRect(ctx, (left + edge) / 2, y + 10, edge - left, 20, 'structure');
      for (let k = 0; k < per; k++) doms.push(domino(ctx, x0 + k * gap, y, 12, h, { role: 'hero', hue: (st * per + k) / (steps * per - 1) }));
      x0 = last + gap;
      y += 30;
    }
    // A floor far below catches whatever goes over an edge.
    staticRect(ctx, 960, 1070, 3000, 40, 'ground');
    // A last ball, knocked off the final step onto the floor.
    staticRect(ctx, x0 + 200, y + 10, 520, 20, 'structure');
    ball(ctx, x0 - 20, y - 16, 16, { role: 'accent', trail: 1.5, weight: 1 }, { density: 0.002, friction: 0.05, restitution: 0.3 });
    staticRect(ctx, 180, 260, 220, 14, 'structure', 0.38, { friction: 0.02 });
    const starter = ball(ctx, 90, 210, 15, { role: 'accent', trail: 1.5, weight: 1 }, { isStatic: true, density: 0.004, friction: 0.02 });
    dolly(ctx, 930, 430, 1.12, 1.18, 990, 450);
    return { entry: { x: 330, y: 300 }, enter: () => release(starter) };
  },
};

/** Seesaw Toss — a heavy ball drops onto a seesaw and lobs a light ball into a basket. */
const seesawToss: SceneDef = {
  id: 'seesaw-toss',
  theme: 'chain',
  title: { zh: '跷跷板投篮', en: 'Seesaw Toss' },
  law: { zh: '杠杆与动量传递', en: 'Lever and momentum' },
  blurb: { zh: '重球沿坡滚下砸在跷跷板高的一端，另一端的轻球被高高抛起，划出弧线。', en: 'A heavy ball drops onto the high end of a seesaw and lobs a light ball high across the stage.' },
  duration: 11,
  energy: 4,
  endState: 'settle',
  presettle: 4,
  canDrop: true,
  setup(ctx) {
    const { world } = ctx;
    const gy = 940;
    const fl = ground(ctx, gy, 5000);
    const pivot = { x: 820, y: 800 };
    staticRect(ctx, pivot.x, (pivot.y + gy) / 2 + 8, 30, gy - pivot.y - 16, 'structure');
    const plank = compound(ctx, [Bodies.rectangle(pivot.x, pivot.y, 520, 16), Bodies.rectangle(pivot.x + 252, pivot.y - 16, 8, 24)], { role: 'debris', hue: 0.4 }, { density: 0.0015, friction: 0.8 });
    Composite.add(world, Constraint.create({ pointA: pivot, bodyB: plank, pointB: { x: pivot.x - plank.position.x, y: pivot.y - plank.position.y }, length: 0, stiffness: 1 }));
    rotateAbout(plank, 0.26, pivot);
    const lp = Matter.Vector.add(pivot, Matter.Vector.rotate({ x: 222, y: -29 }, 0.26));
    const light = ball(ctx, lp.x, lp.y, 20, { role: 'hero', hue: 0.1, trail: 4, weight: 1 }, { density: 0.0008, restitution: 0.3, friction: 0.5 });
    wallPath(ctx, [{ x: 120, y: 260 }, { x: 420, y: 430 }, { x: 520, y: 450 }], 16, 'structure', { friction: 0.01 });
    const heavy = ball(ctx, 140, 220, 32, { role: 'accent', trail: 1.5, weight: 1 }, { isStatic: true, density: 0.012, friction: 0.02 });
    // A basket to catch the light ball.
    wallPath(ctx, [{ x: 1300, y: 600 }, { x: 1320, y: 740 }, { x: 1460, y: 740 }, { x: 1480, y: 600 }], 12);
    staticRect(ctx, 1390, 840, 16, 200, 'structure');
    staticRect(ctx, 1880, 860, 20, 160, 'structure');
    void light;
    dolly(ctx, 960, 560, 0.94, 0.98);
    return { entry: { x: pivot.x, y: pivot.y }, floors: [fl], enter: () => release(heavy) };
  },
};

/** Pendulum Relay — ever-smaller pendulums pass a swing down the line; every hand-off speeds it up. */
const pendulumRelay: SceneDef = {
  id: 'pendulum-relay',
  theme: 'chain',
  title: { zh: '摆锤接力', en: 'Pendulum Relay' },
  law: { zh: '大撞小，速度放大', en: 'Heavy strikes light: speed grows' },
  blurb: { zh: '九只摆锤一只比一只小。第一只落下，撞击一路传递，每传一次速度就放大一点，最后一只被高高甩起。', en: 'Nine pendulums, each smaller than the last: a single swing is passed down the line and grows at every hand-off.' },
  duration: 12,
  energy: 3,
  endState: 'periodic',
  setup(ctx) {
    const { r } = ctx;
    const beamY = 170;
    const L = 500;
    const gap = 58;
    const n = 9;
    const radii = Array.from({ length: n }, (_, i) => 44 * Math.pow(0.88, i));
    let span = 0;
    for (let i = 0; i < n - 1; i++) span += radii[i] + radii[i + 1] + gap;
    let x = W / 2 - span / 2 + 60;
    const bobs: MBody[] = [];
    const xs: number[] = [];
    for (let i = 0; i < n; i++) {
      if (i > 0) x += radii[i - 1] + radii[i] + gap;
      xs.push(x);
      const start = i === 0 ? -0.9 : 0;
      const b = ball(ctx, x + Math.sin(start) * L, beamY + Math.cos(start) * L, radii[i], { role: 'hero', hue: i / (n - 1), trail: 2.2, weight: 1 }, { isStatic: i === 0, frictionAir: 0, friction: 0, restitution: 0.92, density: 0.002 });
      pin(ctx, b, x, beamY, { length: L }, 'structure', 1.2);
      bobs.push(b);
    }
    r.drawBack((g) => g.roundRect(xs[0] - 90, beamY - 14, xs[n - 1] - xs[0] + 180, 12, 6).fill({ color: ctx.style.structure, alpha: 0.75 }));
    dolly(ctx, W / 2, 520, 0.94, 0.98);
    return { entry: { x: xs[0], y: beamY + L }, enter: () => release(bobs[0]) };
  },
};

/** Rube Relay — a rolling ball, a pendulum, a row of dominoes and a last ball dropping into a cup. */
const rubeRelay: SceneDef = {
  id: 'rube-relay',
  theme: 'chain',
  title: { zh: '机关接力', en: 'Rube Relay' },
  law: { zh: '能量沿机关逐级传递', en: 'Energy handed from part to part' },
  blurb: { zh: '小球滚下坡撞响摆锤，摆锤推倒第一块骨牌，骨牌一路倒下，最后一块把另一颗球推下高台，落进杯中。', en: 'A ball rolls into a pendulum, the pendulum topples a domino run, and the last domino nudges a ball into a cup.' },
  duration: 12,
  energy: 3,
  endState: 'settle',
  setup(ctx) {
    ctx.engine.gravity.scale = 0.0028;
    ctx.engine.enableSleeping = true;
    const flat = 441;
    // 1. The ramp ends in a short flat run aimed at the pendulum bob.
    wallPath(ctx, [{ x: 110, y: 170 }, { x: 500, y: flat + 29 }, { x: 600, y: flat + 29 }], 14, 'structure', { friction: 0.02 });
    ground(ctx, 1010, 4000);
    const a = ball(ctx, 140, 122, 22, { role: 'accent', trail: 1.6, weight: 1 }, { isStatic: true, density: 0.006, friction: 0.02, restitution: 0.1 });
    // 2. The pendulum.
    const bob = ball(ctx, 640, flat, 26, { role: 'hero', hue: 0.1, weight: 1, trail: 1.2 }, { density: 0.002, frictionAir: 0, restitution: 0.3 });
    pin(ctx, bob, 640, flat - 300, { length: 300 }, 'structure', 1.4);
    // 3. Nine hinged dominoes on a shelf.
    const shelf = flat + 39;
    staticRect(ctx, 920, shelf + 10, 490, 20, 'structure');
    for (let i = 0; i < 9; i++) domino(ctx, 692 + i * 50, shelf, 14, 90, { role: 'hero', hue: 0.2 + (i / 8) * 0.6 });
    // 4. The last ball waits at the shelf's edge; a chute and a cup catch it.
    ball(ctx, 1150, shelf - 18, 18, { role: 'accent', trail: 1.6, weight: 1 }, { density: 0.003, friction: 0.3, restitution: 0.1 });
    wallPath(ctx, [{ x: 1120, y: 620 }, { x: 1470, y: 730 }], 14, 'structure', { friction: 0.02 });
    wallPath(ctx, [{ x: 1520, y: 790 }, { x: 1530, y: 880 }, { x: 1640, y: 880 }, { x: 1650, y: 790 }], 12);
    dolly(ctx, 900, 560, 0.96, 1.0);
    return { entry: { x: 640, y: flat }, enter: () => release(a) };
  },
};

export const CHAIN: SceneDef[] = [dominoGrowth, dominoStairs, seesawToss, pendulumRelay, rubeRelay];
