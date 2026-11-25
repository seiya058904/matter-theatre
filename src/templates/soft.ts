import { W, H, type SceneDef } from '../core/types';
import { Body, arcPts, circle, dolly, ground, release, softBody, staticCircle, staticRect, staticShape, tuned, wallPath, type MBody, type Pt, type Soft } from './kit';

const bowlOf = (cx: number) => {
  const pts: Pt[] = [];
  for (let i = 0; i <= 20; i++) {
    const a = Math.PI * (0.06 + (0.88 * i) / 20);
    pts.push({ x: cx + Math.cos(a) * 560, y: 430 + Math.sin(a) * 520 });
  }
  return pts;
};

/** True when point p lies inside the closed outline through the soft body's skin nodes. */
function inside(s: Soft, p: Pt): boolean {
  let c = false;
  const n = s.nodes;
  for (let i = 0, j = n.length - 1; i < n.length; j = i++) {
    const a = n[i].position;
    const b = n[j].position;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

/** How far a point has pushed in past the skin (0 when it is outside). */
function depthInside(s: Soft, p: Pt): number {
  if (!inside(s, p)) return 0;
  let d = Infinity;
  const n = s.nodes;
  for (let i = 0; i < n.length; i++) {
    const a = n[i].position;
    const b = n[(i + 1) % n.length].position;
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * ex + (p.y - a.y) * ey) / (ex * ex + ey * ey || 1)));
    d = Math.min(d, Math.hypot(a.x + ex * t - p.x, a.y + ey * t - p.y));
  }
  return d + s.node;
}

/** The skin node nearest a point (where a puncture tears). */
function nearest(s: Soft, p: Pt): number {
  let best = 0;
  let d = Infinity;
  s.nodes.forEach((b, i) => {
    const q = Math.hypot(b.position.x - p.x, b.position.y - p.y);
    if (q < d) {
      d = q;
      best = i;
    }
  });
  return best;
}

/** Jelly Rain — inflated jelly balls fall one by one into a bowl, squash against each other and pile up. */
const jellyRain: SceneDef = {
  id: 'soft-bloom',
  theme: 'soft',
  title: { zh: '果冻雨', en: 'Jelly Rain' },
  law: { zh: '橡皮膜张力与气体压强', en: 'Skin tension and gas pressure' },
  blurb: { zh: '一颗颗充气果冻落进碗里，互相挤压、变形、回弹，最后颤巍巍地堆成一堆。', en: 'Inflated jellies drop into a bowl one by one, squash against each other, spring back and pile up.' },
  duration: 13,
  energy: 2,
  endState: 'settle',
  // Jellies resting in a curved bowl keep easing into place for a long while.
  presettle: 9,
  setup(ctx) {
    const { tl, rng } = ctx;
    const cx = W / 2;
    wallPath(ctx, bowlOf(cx), 22, 'structure', { friction: 0.6 });
    ctx.r.impactMin = 4;
    // Two jellies already lie at the bottom of the bowl, set down where they come to rest.
    // (Centres sit one radius above the bowl's inner face: a skin node outside the wall would fall through it.)
    softBody(ctx, cx - 140, 832, 84, { hue: 0.1 }, { hz: 10, inflate: 0.3, damping: 0.22 });
    softBody(ctx, cx + 160, 840, 70, { hue: 0.3 }, { hz: 10, inflate: 0.3, damping: 0.22 });
    const held: Soft[] = [];
    // Held above the frame in three columns and three rows, clear of one another: a jelly let go must
    // never come to rest on one still held.
    const col = [-250, 250, 0, -250, 250, 0, 0];
    const row = [0, 0, 0, 1, 1, 1, 2];
    for (let k = 0; k < 7; k++) {
      const R = k === 6 ? 118 : rng.range(52, 86);
      const x = cx + col[k] + (k === 6 ? 0 : rng.range(-40, 40));
      held.push(softBody(ctx, x, -R - 60 - row[k] * 260, R, { hue: (0.5 + k * 0.17) % 1 }, { hz: k === 6 ? 8.5 : 10, inflate: 0.3, air: 0.006, damping: 0.14, held: true }));
    }
    dolly(ctx, cx, 580, 0.96, 0.9, cx, 540);
    return {
      entry: { x: cx, y: 620 },
      enter: () => held.forEach((s, k) => tl.at(tl.t + k * 0.7 + (k === 6 ? 0.5 : 0), () => release(...s.nodes))),
    };
  },
};

/** Jelly Steps — three jelly balls tumble down a staircase, squashing on every landing. */
const jellySteps: SceneDef = {
  id: 'jelly-steps',
  theme: 'soft',
  title: { zh: '果冻落阶', en: 'Jelly Steps' },
  law: { zh: '弹性形变与恢复', en: 'Elastic deformation' },
  blurb: { zh: '三团果冻沿台阶一级级弹落，每次落地都被压扁，又颤巍巍地恢复原形。', en: 'Three jellies bounce down a staircase, squashing flat on each step and wobbling back.' },
  duration: 12,
  energy: 2,
  endState: 'settle',
  // Jellies leaning on the gate rock gently for a long while; they are seen only once still.
  presettle: 12,
  canDrop: true,
  setup(ctx) {
    const steps: MBody[] = [];
    steps.push(staticRect(ctx, 300, 330, 560, 24, 'structure', 0.16, { friction: 0.2 }));
    for (let i = 1; i < 6; i++) steps.push(staticRect(ctx, 520 + i * 200 - (i === 1 ? 40 : 0), 370 + i * 110, 230 + (i === 1 ? 80 : 0), 26, 'structure', 0.09, { friction: 0.35 }));
    steps.push(staticRect(ctx, 960, 1070, 2400, 40, 'ground'));
    steps.push(staticRect(ctx, 1650, 1000, 600, 26, 'ground'));
    staticRect(ctx, 20, 240, 20, 260, 'structure');
    staticRect(ctx, 1900, 880, 24, 260, 'structure');
    softBody(ctx, 468, 280, 60, { hue: 0.05 }, { hz: 9, inflate: 0.3, damping: 0.14 });
    softBody(ctx, 344, 262, 56, { hue: 0.4 }, { hz: 9, inflate: 0.3, damping: 0.14 });
    softBody(ctx, 228, 246, 50, { hue: 0.75 }, { hz: 9, inflate: 0.3, damping: 0.14 });
    // A gate at the lip of the shelf holds them until the template begins.
    const stopper = staticRect(ctx, 590, 290, 16, 140, 'accent');
    dolly(ctx, 1000, 600, 0.92, 0.98, 1100, 640);
    return {
      entry: { x: 420, y: 300 },
      floors: steps,
      enter: () => ctx.r.remove(ctx.world, stopper),
    };
  },
};

/** Soft Collision — two big jelly bodies drift together in zero gravity, collide and wobble apart. */
const softCollide: SceneDef = {
  id: 'soft-collision',
  theme: 'soft',
  title: { zh: '零重力软碰', en: 'Soft Collision' },
  law: { zh: '非刚体碰撞中的能量', en: 'Energy in a soft collision' },
  blurb: { zh: '失重中两团巨大的充气软体相向漂来，撞成扁饼，又鼓胀着弹开，余波在表面久久荡漾。', en: 'Two big inflated bodies drift together in zero gravity, squash flat, bulge and bounce apart, still rippling.' },
  duration: 12,
  energy: 2,
  endState: 'flow',
  movingStart: true,
  gravity: { x: 0, y: 0 },
  setup(ctx) {
    const box = { restitution: 0.6, friction: 0.1 };
    staticRect(ctx, W / 2, 70, 1760, 20, 'structure', 0, box);
    staticRect(ctx, W / 2, H - 70, 1760, 20, 'structure', 0, box);
    staticRect(ctx, 80, H / 2, 20, 940, 'structure', 0, box);
    staticRect(ctx, W - 80, H / 2, 20, 940, 'structure', 0, box);
    const a = softBody(ctx, 500, H / 2 - 40, 160, { hue: 0.1 }, { hz: 5, damping: 0.03, air: 0 });
    const b = softBody(ctx, 1420, H / 2 + 40, 128, { hue: 0.6 }, { hz: 5, damping: 0.03, air: 0 });
    for (const p of a.nodes) Body.setVelocity(p, { x: 3.4, y: 0.25 });
    for (const p of b.nodes) Body.setVelocity(p, { x: -3.8, y: -0.15 });
    dolly(ctx, W / 2, H / 2, 0.95, 1.05);
    return { entry: { x: W / 2, y: H / 2 } };
  },
};

/** Rubber Ball — an inflated ball drops onto tilted plates and flattens on every bounce. */
const rubberBall: SceneDef = {
  id: 'bouncing-ring',
  theme: 'soft',
  title: { zh: '橡皮球', en: 'Rubber Ball' },
  law: { zh: '弹性储能与回弹', en: 'Stored elastic energy' },
  blurb: { zh: '一只充足气的橡皮球落在倾斜的板上，被压扁、弹起、翻滚，每次碰撞都把能量存进橡皮和气里，再还回来。', en: 'An inflated rubber ball drops onto tilted plates, flattening, springing back and tumbling down.' },
  duration: 11,
  energy: 3,
  endState: 'settle',
  canDrop: true,
  setup(ctx) {
    const plates: MBody[] = [];
    plates.push(staticRect(ctx, 760, 520, 520, 22, 'structure', 0.3, { restitution: 0.3 }));
    plates.push(staticRect(ctx, 1240, 760, 520, 22, 'structure', -0.28, { restitution: 0.3 }));
    plates.push(...wallPath(ctx, arcPts(800, 760, 300, Math.PI * 0.2, Math.PI * 0.85, 10), 20));
    const ball = softBody(ctx, 620, 120, 70, { hue: 0.3 }, { hz: 9, inflate: 0.22, held: true, restitution: 0.4, damping: 0.04 });
    dolly(ctx, 960, 560, 0.98, 1.03);
    return { entry: { x: 760, y: 400 }, floors: plates, enter: () => release(...ball.nodes) };
  },
};

/**
 * Bed of Nails — the same balloon falls on a single nail and on a bed of nails. One sharp point
 * takes the whole weight and pierces the skin; spread over many points, the load never does.
 */
const bedOfNails: SceneDef = {
  id: 'bed-of-nails',
  theme: 'soft',
  title: { zh: '钉床', en: 'Bed of Nails' },
  law: { zh: '压强 = 力 / 面积', en: 'Pressure is force over area' },
  blurb: { zh: '两只一样的气球同时落下：左边只有一根钉子，全部重量压在一个尖上，噗地扎破；右边是一整床钉子，力被分摊，气球弹了弹，安然无恙。', en: 'Two identical balloons drop: one onto a single nail, which takes all the weight and pops it; one onto a bed of nails, which shares it out.' },
  duration: 12,
  energy: 3,
  endState: 'settle',
  presettle: 0.3,
  canDrop: true,
  setup(ctx) {
    const { r, tl } = ctx;
    const gy = 900;
    const fl = ground(ctx, gy, 4000);
    const tips: Pt[] = [];
    // Every nail is the same: a shaft with a slightly rounded point.
    const nail = (x: number, h: number) => {
      staticShape(ctx, x, gy - h / 3, [{ x: -8, y: h / 3 }, { x: 8, y: h / 3 }, { x: 0, y: (-2 * h) / 3 }], 'structure', { friction: 0.4 });
      staticCircle(ctx, x, gy - h + 6, 4.5, 'structure', { friction: 0.4 });
      return { x, y: gy - h + 6 };
    };
    // Left: one nail. Right: a bed of twenty-one of the same nails.
    tips.push(nail(620, 120));
    const bed: Pt[] = [];
    for (let i = 0; i < 21; i++) bed.push(nail(1110 + i * 19, 120));
    staticRect(ctx, 1300, gy - 6, 440, 12, 'structure');
    const T = tuned('bed-of-nails', { y: 450, depth: 22 });
    const make = (x: number, hue: number) => softBody(ctx, x, T.y, 96, { hue }, { hz: 7, inflate: 0.16, held: true, density: 0.006, restitution: 0.2 });
    const left = make(620, 0.05);
    const right = make(1300, 0.6);
    const balloons = [left, right];
    const check = () => {
      for (const s of balloons) {
        if (s.popped) continue;
        const sharp = s === left ? tips : bed;
        for (const p of sharp) {
          // A point that carries the whole weight drives deep into the rubber and pierces it;
          // shared among twenty-one points, the load only dents it.
          if (depthInside(s, p) < T.depth) continue;
          s.pop(nearest(s, p));
          r.fx.ring({ x: p.x, y: p.y - 30, r1: 170, width: 3, color: ctx.style.accentColor, life: 0.45 });
          ctx.style.impact(r.fx, p.x, p.y - 20, 1, ctx.style.accentColor);
          ctx.camera.shake(0.25);
          ctx.slowmo(0.3, 0.5, 0.15);
          break;
        }
      }
    };
    dolly(ctx, 960, 640, 1.22, 1.3, 960, 690);
    return {
      entry: { x: W / 2, y: 700 },
      floors: [fl],
      enter: () => tl.at(tl.t + 0.2, () => balloons.forEach((s) => release(...s.nodes))),
      step: () => check(),
    };
  },
};

/**
 * Water Balloon — a rubber skin stretched around water. The first one lands and wobbles like a
 * heavy jelly; the second lands on a spike, the skin tears and snaps back, and the water lets go.
 */
const waterBalloon: SceneDef = {
  id: 'water-balloon',
  theme: 'soft',
  title: { zh: '水气球', en: 'Water Balloon' },
  law: { zh: '张紧的橡皮膜与不可压缩的水', en: 'A stretched skin around incompressible water' },
  blurb: { zh: '第一只水气球落地，像一团沉甸甸的果冻那样晃荡；第二只落在尖刺上，橡皮膜被刺破、瞬间回缩，里面的水还保持着球形，然后哗地散开。', en: 'One water balloon lands and wobbles like heavy jelly; the next lands on a spike, its skin tears and snaps back, and the water lets go.' },
  duration: 12,
  energy: 4,
  endState: 'settle',
  canDrop: true,
  setup(ctx) {
    const { r, tl } = ctx;
    const gy = 930;
    const fl = ground(ctx, gy, 5000);
    staticRect(ctx, 150, gy - 160, 24, 320, 'structure');
    staticRect(ctx, 1770, gy - 160, 24, 320, 'structure');
    const spike = { x: 1180, y: gy - 130 };
    staticShape(ctx, spike.x, gy - 130 / 3, [{ x: -15, y: 130 / 3 }, { x: 15, y: 130 / 3 }, { x: 0, y: (-2 * 130) / 3 }], 'accent', { friction: 0.4 });
    const waterColor = ctx.style.water.color;
    const balloon = (x: number, y: number, R: number, hue: number) => {
      // Balloon rubber is stretched to over twice its rest length: when it tears it snaps back hard into
      // a small shred. (Softer per unit stretch, so the skin's tension at rest is what it was.)
      const skin = softBody(ctx, x, y, R, { hue, front: true }, { hz: 10.3, inflate: 1.2, held: true, gas: false, density: 0.007, damping: 0.06, bend: 0.12, restitution: 0.1 });
      const beads: MBody[] = [];
      const br = 8.5;
      const inner = R - skin.node * 2 - br;
      for (let row = -12; row <= 12; row++)
        for (let col = -12; col <= 12; col++) {
          const bx = col * br * 2.05 + (row % 2 ? br : 0);
          const by = row * br * 1.78;
          if (Math.hypot(bx, by) > inner) continue;
          beads.push(circle(ctx, x + bx, y + by, br, { role: 'hero', color: waterColor, impacts: false }, { isStatic: true, friction: 0.001, frictionStatic: 0, restitution: 0.05, density: 0.0014, frictionAir: 0.002 }));
        }
      return { skin, beads };
    };
    const a = balloon(700, 280, 96, 0.15);
    const b = balloon(spike.x - 6, -120, 96, 0.7);
    let popped = false;
    dolly(ctx, 960, 650, 1.14, 1.22, 990, 700);
    return {
      entry: { x: W / 2, y: 620 },
      floors: [fl],
      enter: () => {
        release(...a.skin.nodes, ...a.beads);
        tl.at(tl.t + 2.4, () => release(...b.skin.nodes, ...b.beads));
      },
      step: () => {
        if (popped || !inside(b.skin, { x: spike.x, y: spike.y - 1 })) return;
        popped = true;
        b.skin.pop(nearest(b.skin, spike));
        r.fx.ring({ x: spike.x, y: spike.y - 40, r1: 220, width: 3, color: waterColor, life: 0.5 });
        ctx.camera.shake(0.2);
        ctx.slowmo(0.22, 0.9, 0.12);
      },
    };
  },
};

export const SOFT: SceneDef[] = [jellyRain, jellySteps, softCollide, rubberBall, bedOfNails, waterBalloon];
