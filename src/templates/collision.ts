import Matter from 'matter-js';
import { H, W, type SceneDef } from '../core/types';
import { lerp, smooth } from '../core/ease';
import { Bodies, Body, Composite, Constraint, circle, cushion, dolly, drip, ground, release, setPositionV, staticRect, wallPath, type MBody } from './kit';

/** Newton's Cradle — one ball is let go; momentum passes straight through the row. */
const cradle: SceneDef = {
  id: 'newton-cradle',
  theme: 'collision',
  title: { zh: '牛顿摆', en: "Newton's Cradle" },
  law: { zh: '动量守恒', en: 'Conservation of momentum' },
  blurb: { zh: '松开一颗球，动量穿过整排小球，只把最远的那颗推开。', en: 'Let one ball go: momentum passes through the row and lifts only the last.' },
  duration: 11,
  energy: 2,
  endState: 'periodic',
  setup(ctx) {
    const { r, world, engine } = ctx;
    engine.gravity.scale = 0.0026;
    const n = 5;
    const rad = 40;
    const len = 380;
    const pivotY = 250;
    const x0 = W / 2 - ((n - 1) * rad * 2) / 2;
    const balls: MBody[] = [];
    for (let i = 0; i < n; i++) {
      const px = x0 + i * rad * 2;
      const b = Bodies.circle(px, pivotY + len, rad, { inertia: Infinity, restitution: 1, friction: 0, frictionAir: 0.0001, slop: 1, density: 0.004 });
      r.add(world, b, { role: 'hero', hue: i / (n - 1), trail: i === 0 || i === n - 1 ? 1.6 : false, weight: 1 });
      const c = Constraint.create({ pointA: { x: px, y: pivotY }, bodyB: b, length: len, stiffness: 1 });
      Composite.add(world, c);
      r.constraint(c, 'structure', 1.5);
      balls.push(b);
    }
    const lifted = balls[0];
    const ang = -0.85;
    Body.setPosition(lifted, { x: x0 + Math.sin(ang) * len, y: pivotY + Math.cos(ang) * len });
    Body.setStatic(lifted, true);
    r.drawBack((g) => {
      const c = ctx.style.structure;
      const left = x0 - 330;
      const right = x0 + (n - 1) * rad * 2 + 330;
      g.roundRect(left, pivotY - 20, right - left, 14, 7).fill({ color: c, alpha: 0.7 });
      g.rect(left + 6, pivotY - 10, 8, len + rad + 230).fill({ color: c, alpha: 0.35 });
      g.rect(right - 14, pivotY - 10, 8, len + rad + 230).fill({ color: c, alpha: 0.35 });
      g.roundRect(left - 40, pivotY + len + rad + 210, right - left + 80, 16, 6).fill({ color: c, alpha: 0.5 });
    });
    dolly(ctx, W / 2, 530, 1.0, 1.08);
    return { entry: { x: W / 2, y: pivotY + len }, enter: () => release(lifted) };
  },
};

/** Stacked Drop — stacks of one to four balls fall together; momentum is handed upward. */
const stackDrop: SceneDef = {
  id: 'stack-drop',
  theme: 'collision',
  title: { zh: '叠球弹射', en: 'Stacked Drop' },
  law: { zh: '动量逐级传递', en: 'Momentum handed upward' },
  blurb: { zh: '一到四颗叠放的球同时落下，动量由重到轻层层上传，顶端那颗越飞越高。', en: 'Stacks of one to four balls fall; momentum climbs from heavy to light and the top ball soars.' },
  duration: 12,
  energy: 4,
  endState: 'settle',
  canDrop: true,
  setup(ctx) {
    const { r, camera } = ctx;
    const floor = 900;
    const drop = 140;
    const fl = staticRect(ctx, W / 2, floor + 40, 6000, 80, 'ground', 0, { restitution: 0.8 });
    const radii = [30, 25, 21, 17];
    const dens = [0.006, 0.003, 0.0016, 0.0009];
    const tops: MBody[] = [];
    const held: MBody[] = [];
    [1, 2, 3, 4].forEach((count, si) => {
      const x = 420 + si * 360;
      staticRect(ctx, x - 33, floor - 260, 4, 520, 'structure', 0, { friction: 0 });
      staticRect(ctx, x + 33, floor - 260, 4, 520, 'structure', 0, { friction: 0 });
      let y = floor - drop;
      let top: MBody | null = null;
      for (let k = 0; k < count; k++) {
        const rr = radii[k];
        y -= rr;
        top = circle(ctx, x, y, rr, { role: 'hero', hue: (si + k * 0.6) / 5, trail: k === count - 1 ? 3 : false, weight: 1 }, { isStatic: true, restitution: 0.85, friction: 0, frictionAir: 0, density: dens[k] });
        held.push(top);
        y -= rr + 0.5;
      }
      tops.push(top!);
    });
    r.impactMin = 4;
    camera.set(W / 2, 560, 0.92);
    camera.stiffness = 0.7;
    let launched = false;
    return {
      entry: { x: W / 2, y: floor - 200 },
      floors: [fl],
      enter: () => {
        release(...held);
        launched = true;
      },
      step: () => {
        if (!launched) return;
        const hi = Math.min(...tops.map((t) => t.position.y), floor - 400);
        const span = floor + 80 - hi;
        camera.to(W / 2, (hi + floor + 80) / 2, Math.min(0.95, (H * 0.86) / span));
      },
    };
  },
};

/** Break Shot — top-down billiard break: one strike, sixteen balls, elastic collisions. */
const breakShot: SceneDef = {
  id: 'break-shot',
  theme: 'collision',
  title: { zh: '台球开局', en: 'Break Shot' },
  law: { zh: '弹性碰撞', en: 'Elastic collisions' },
  blurb: { zh: '俯视球台，母球一击散开三角阵，动量在十六颗球之间分配。', en: 'One strike breaks the rack; momentum is shared out across sixteen balls.' },
  duration: 11,
  energy: 4,
  endState: 'settle',
  gravity: { x: 0, y: 0 },
  setup(ctx) {
    const { r } = ctx;
    const tw = 1480;
    const th = 760;
    const cx = W / 2;
    const cy = 540;
    const L = cx - tw / 2;
    const T = cy - th / 2;
    const cush = { restitution: 0.9, friction: 0 };
    staticRect(ctx, cx, T - 14, tw + 56, 28, 'structure', 0, cush);
    staticRect(ctx, cx, T + th + 14, tw + 56, 28, 'structure', 0, cush);
    staticRect(ctx, L - 14, cy, 28, th, 'structure', 0, cush);
    staticRect(ctx, L + tw + 14, cy, 28, th, 'structure', 0, cush);
    const pockets = [
      { x: L + 10, y: T + 10 }, { x: cx, y: T - 4 }, { x: L + tw - 10, y: T + 10 },
      { x: L + 10, y: T + th - 10 }, { x: cx, y: T + th + 4 }, { x: L + tw - 10, y: T + th - 10 },
    ];
    r.drawBack((g) => {
      g.roundRect(L, T, tw, th, 18).fill({ color: ctx.style.structure, alpha: 0.1 });
      g.roundRect(L + 14, T + 14, tw - 28, th - 28, 12).stroke({ width: 1.5, color: ctx.style.structure, alpha: 0.3 });
      g.moveTo(L + tw * 0.25, T + 14).lineTo(L + tw * 0.25, T + th - 14).stroke({ width: 1.5, color: ctx.style.structure, alpha: 0.22 });
      for (const p of pockets) g.circle(p.x, p.y, 30).fill({ color: 0x000000, alpha: 0.45 }).stroke({ width: 2, color: ctx.style.structure, alpha: 0.45 });
    });
    const rad = 22;
    const ball = { restitution: 0.95, friction: 0.005, frictionAir: 0.006, density: 0.002 };
    const balls: MBody[] = [];
    const apexX = L + tw * 0.7;
    let k = 0;
    for (let col = 0; col < 5; col++)
      for (let row = 0; row <= col; row++) balls.push(circle(ctx, apexX + col * rad * 1.75, cy + (row - col / 2) * rad * 2.02, rad, { role: 'hero', hue: k++ / 14, trail: 1.8, weight: 1 }, ball));
    const cue = circle(ctx, L + tw * 0.22, cy, rad, { role: 'accent', trail: 2.4, weight: 1 }, { ...ball, density: 0.0024 });
    balls.push(cue);
    let broke = false;
    Matter.Events.on(ctx.engine, 'collisionStart', (e) => {
      if (broke) return;
      for (const p of e.pairs) if ((p.bodyA === cue || p.bodyB === cue) && balls.includes(p.bodyA === cue ? p.bodyB : p.bodyA)) {
        broke = true;
        ctx.slowmo(0.25, 0.4, 0.25);
      }
    });
    dolly(ctx, cx, cy, 1.0, 1.04);
    const sinking = new Map<MBody, number>();
    return {
      entry: { x: L + tw * 0.22, y: cy },
      enter: () => Body.setVelocity(cue, { x: 44, y: 0.5 }),
      step: (_t, dt) => {
        for (const b of balls) {
          if (sinking.has(b)) continue;
          if (pockets.some((q) => Math.hypot(b.position.x - q.x, b.position.y - q.y) < 32)) {
            sinking.set(b, 0);
            b.collisionFilter.mask = 0;
          }
        }
        for (const [b, a] of sinking) {
          const v = r.views.get(b);
          const k2 = a + dt / 0.3;
          sinking.set(b, k2);
          if (v) {
            v.alpha = 1 - smooth(Math.min(1, k2));
            v.scale = lerp(1, 0.6, Math.min(1, k2));
          }
        }
      },
    };
  },
};

/** Restitution Ladder — eleven balls, restitution 0 → 1, dropped together. */
const restitution: SceneDef = {
  id: 'bounce-ladder',
  theme: 'collision',
  title: { zh: '弹性阶梯', en: 'Bounce Ladder' },
  law: { zh: '恢复系数 e', en: 'Coefficient of restitution' },
  blurb: { zh: '恢复系数从 0 到 1 的十一颗球同时落下，弹跳轨迹画出一族衰减曲线。', en: 'Eleven balls, restitution 0 to 1, fall together; their trails draw decaying arcs.' },
  duration: 11,
  energy: 2,
  endState: 'settle',
  canDrop: true,
  setup(ctx) {
    const { r } = ctx;
    const n = 11;
    const gy = 860;
    const fl = ground(ctx, gy, 6000);
    staticRect(ctx, 1890, gy - 120, 20, 240, 'structure', 0, { restitution: 0.5 });
    const balls: MBody[] = [];
    for (let i = 0; i < n; i++) {
      const e = i / (n - 1);
      balls.push(circle(ctx, 280 + i * 136, 190, 20, { role: 'hero', hue: e, trail: 3.5, weight: 1 }, { isStatic: true, restitution: e * 0.995, friction: 0, frictionAir: 0, frictionStatic: 0, slop: 0.01 }));
    }
    r.impactMin = 3;
    dolly(ctx, W / 2, 540, 1.0, 0.96, W / 2 + 40);
    return {
      entry: { x: W / 2, y: 190 },
      floors: [fl],
      enter: () => {
        for (const b of balls) {
          release(b);
          // A gentle sideways toss so each bounce draws an arc.
          Body.setVelocity(b, { x: 0.9, y: 0 });
        }
      },
    };
  },
};

/** Gas Expansion — a partition slides away and a packed gas floods the empty half. */
const gas: SceneDef = {
  id: 'gas-expansion',
  theme: 'collision',
  title: { zh: '气体扩散', en: 'Gas Expansion' },
  law: { zh: '分子碰撞与扩散', en: 'Molecular collisions and diffusion' },
  blurb: { zh: '隔板抽离，挤在左半边的"分子"涌向空无一物的右半边，直到均匀充满整个容器。', en: 'The partition lifts and a crowded gas floods the empty half until it fills the box.' },
  duration: 11,
  energy: 3,
  endState: 'periodic',
  movingStart: true,
  gravity: { x: 0, y: 0 },
  setup(ctx) {
    const { rng } = ctx;
    const cx = W / 2;
    const cy = H / 2;
    const bw = 1500;
    const bh = 760;
    const elastic = { restitution: 1, friction: 0 };
    staticRect(ctx, cx, cy - bh / 2 - 12, bw + 48, 24, 'structure', 0, elastic);
    staticRect(ctx, cx, cy + bh / 2 + 12, bw + 48, 24, 'structure', 0, elastic);
    staticRect(ctx, cx - bw / 2 - 12, cy, 24, bh, 'structure', 0, elastic);
    staticRect(ctx, cx + bw / 2 + 12, cy, 24, bh, 'structure', 0, elastic);
    const wallX = cx - 160;
    const wall = staticRect(ctx, wallX, cy, 16, bh, 'accent', 0, elastic);
    for (let i = 0; i < 80; i++) {
      const x = rng.range(cx - bw / 2 + 20, wallX - 20);
      const y = rng.range(cy - bh / 2 + 20, cy + bh / 2 - 20);
      const b = circle(ctx, x, y, 10, { role: 'hero', hue: rng.next(), impacts: false }, { restitution: 1, friction: 0, frictionAir: 0, frictionStatic: 0, inertia: Infinity });
      const a = rng.range(0, Math.PI * 2);
      Body.setVelocity(b, { x: Math.cos(a) * 4, y: Math.sin(a) * 4 });
    }
    let lift = false;
    let y = cy;
    dolly(ctx, cx, cy, 1.0, 1.04);
    return {
      entry: { x: wallX, y: cy },
      enter: () => (lift = true),
      step: (_t, dt) => {
        if (!lift || y < -400) return;
        // The partition is a visible sliding gate.
        y -= dt * 900;
        setPositionV(wall, { x: wallX, y }, true);
      },
    };
  },
};

/**
 * Bounce Sorter — how cranberries are really graded: berries drop one by one onto a hard, tilted
 * plate. Firm ones bounce high enough to clear a wall into the far bin; soft ones barely bounce
 * and slide into the near one. Restitution alone does the sorting.
 */
const bounceSorter: SceneDef = {
  id: 'bounce-sorter',
  theme: 'collision',
  title: { zh: '弹跳分拣', en: 'Bounce Sorter' },
  law: { zh: '恢复系数决定去向', en: 'Restitution decides the bin' },
  blurb: { zh: '越橘真正的分拣方法：果子一颗颗落在倾斜的硬板上，结实的弹得又高又远，越过挡墙落进远处的箱子；发软的几乎不弹，滑进近处的箱子。', en: 'How cranberries are really graded: firm berries bounce over a wall into the far bin, soft ones barely bounce and slide into the near one.' },
  duration: 12,
  energy: 3,
  endState: 'settle',
  canDrop: true,
  setup(ctx) {
    const { r, tl, engine, rng } = ctx;
    engine.gravity.scale = 0.0016;
    const n = 26;
    const kinds = Array.from({ length: n }, () => rng.next() < 0.55);
    // The hopper's nozzle, the anvil plate, the wall, and two bins.
    const feed = drip(
      ctx,
      470,
      230,
      n,
      13,
      (i) => (kinds[i] ? { role: 'hero', hue: 0.04, weight: 1, trail: 0.9 } : { role: 'debris', hue: 0.62 }),
      (i) => ({ restitution: kinds[i] ? 0.86 : 0.08, friction: 0.25, density: 0.002, frictionAir: 0.0006 }),
    );
    for (const s of [-1, 1]) staticRect(ctx, 470 + s * 22, 150, 8, 260, 'structure');
    const anvil = staticRect(ctx, 520, 640, 250, 22, 'accent', 0.42, { friction: 0.1 });
    const wallX = 790;
    const sep = staticRect(ctx, wallX, 840, 16, 300, 'structure');
    const floors = [...wallPath(ctx, [{ x: 600, y: 760 }, { x: 610, y: 990 }, { x: wallX, y: 990 }], 14), ...wallPath(ctx, [{ x: wallX, y: 990 }, { x: 1652, y: 990 }], 14)];
    // The bins are lined with felt: whatever lands there stays there.
    const back = staticRect(ctx, 1660, 560, 24, 860, 'structure');
    cushion(ctx, [...floors, sep, back], 0.04);
    const glow = { v: 0 };
    Matter.Events.on(engine, 'collisionStart', (e) => {
      for (const p of e.pairs) if (p.bodyA === anvil || p.bodyB === anvil) glow.v = 1;
    });
    r.drawBack((g, dt) => {
      glow.v = Math.max(0, glow.v - dt * 4);
      g.circle(520, 640, 40 + glow.v * 30).fill({ color: ctx.style.accentColor, alpha: 0.06 + glow.v * 0.14 });
    });
    ctx.r.impactMin = 3;
    dolly(ctx, 980, 560, 1.0, 1.04, 1000, 600);
    return {
      entry: { x: 520, y: 600 },
      floors,
      enter: () => {
        for (let i = 0; i < n; i++) tl.at(tl.t + 0.1 + i * 0.3, () => feed.next());
      },
    };
  },
};

export const COLLISION: SceneDef[] = [cradle, stackDrop, breakShot, restitution, gas, bounceSorter];
