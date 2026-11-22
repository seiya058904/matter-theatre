import Matter from 'matter-js';
import { H, W, type SceneDef } from '../core/types';
import { lerp, smooth } from '../core/ease';
import { Bodies, Body, Composite, Constraint, circle, dolly, ground, link, rect, release, setPositionV, staticRect, type MBody } from './kit';

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
          const k2 = a + dt / 0.5;
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

/** Recoil Carts — a compressed spring between a heavy and a light cart is let go. */
const recoil: SceneDef = {
  id: 'recoil-carts',
  theme: 'collision',
  title: { zh: '反冲双车', en: 'Recoil Carts' },
  law: { zh: '动量守恒 · 反冲', en: 'Recoil: momentum conserved' },
  blurb: { zh: '压缩的弹簧夹在一重一轻两辆小车之间。松开后两车反向冲出，轻车跑得远、重车跑得近。', en: 'A compressed spring between a heavy and a light cart is let go: they fly apart, the light one faster.' },
  duration: 10,
  energy: 3,
  endState: 'settle',
  presettle: 0.4,
  setup(ctx) {
    const { r, world } = ctx;
    const gy = 820;
    ground(ctx, gy, 4000);
    staticRect(ctx, 130, gy - 60, 30, 120, 'structure', 0, { restitution: 0.4 });
    staticRect(ctx, 1790, gy - 60, 30, 120, 'structure', 0, { restitution: 0.4 });
    const cart = (x: number, w: number, h: number, dens: number, hue: number) => {
      const body = rect(ctx, x, gy - 26 - h / 2, w, h, { role: 'hero', hue, weight: 1 }, { density: dens, friction: 0.3 });
      const wheels = [-1, 1].map((s) => {
        const wh = circle(ctx, x + s * (w / 2 - 22), gy - 18, 18, { role: 'structure' }, { density: dens * 0.5, friction: 0.9 });
        link(ctx, body, wh, { pointA: { x: s * (w / 2 - 22), y: h / 2 - 4 }, length: 0 }, false);
        wh.collisionFilter.group = -3;
        return wh;
      });
      body.collisionFilter.group = -3;
      return { body, wheels };
    };
    const heavy = cart(860, 220, 70, 0.006, 0.1);
    const light = cart(1060, 130, 54, 0.0018, 0.7);
    // The spring (drawn as a zigzag) and the latch that keeps it compressed.
    const spring = Constraint.create({ bodyA: heavy.body, bodyB: light.body, pointA: { x: 110, y: 0 }, pointB: { x: -65, y: 0 }, length: 230, stiffness: 0.035, damping: 0.02 });
    const latch = Constraint.create({ bodyA: heavy.body, bodyB: light.body, pointA: { x: 110, y: 0 }, pointB: { x: -65, y: 0 }, length: 20, stiffness: 1 });
    Composite.add(world, [spring, latch]);
    let springOn = true;
    r.drawFront((g) => {
      if (!springOn) return;
      const a = r.anchor(heavy.body, Matter.Vector.rotate({ x: 110, y: 0 }, heavy.body.angle));
      const b = r.anchor(light.body, Matter.Vector.rotate({ x: -65, y: 0 }, light.body.angle));
      const n = 10;
      g.moveTo(a.x, a.y);
      for (let i = 1; i < n; i++) g.lineTo(a.x + ((b.x - a.x) * i) / n, a.y + (i % 2 ? -10 : 10));
      g.lineTo(b.x, b.y).stroke({ width: 3, color: ctx.style.accentColor, alpha: 0.9, join: 'round' });
    });
    dolly(ctx, W / 2, 620, 1.18, 0.92);
    return {
      entry: { x: 960, y: gy - 60 },
      enter: () => Composite.remove(world, latch),
      step: () => {
        // The spring only pushes: once it reaches its natural length it leaves the carts.
        if (springOn && Matter.Vector.magnitude(Matter.Vector.sub(light.body.position, heavy.body.position)) > 175 + 230 - 40) {
          springOn = false;
          Composite.remove(world, spring);
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

/** Curling — one stone glides the length of the ice and knocks out a guard. */
const curling: SceneDef = {
  id: 'curling',
  theme: 'collision',
  title: { zh: '冰壶', en: 'Curling' },
  law: { zh: '滑动摩擦与碰撞', en: 'Sliding friction and collisions' },
  blurb: { zh: '冰壶缓缓滑过整条冰道，轻轻一碰，把守在大本营前的对手壶撞出。', en: 'A stone glides the length of the ice and gently knocks the guard out of the house.' },
  duration: 12,
  energy: 1,
  endState: 'settle',
  gravity: { x: 0, y: 0 },
  setup(ctx) {
    const { r } = ctx;
    const cy = H / 2;
    const lane = { x0: 120, x1: 1800, h: 420 };
    staticRect(ctx, W / 2, cy - lane.h / 2 - 10, lane.x1 - lane.x0, 20, 'structure', 0, { restitution: 0.6 });
    staticRect(ctx, W / 2, cy + lane.h / 2 + 10, lane.x1 - lane.x0, 20, 'structure', 0, { restitution: 0.6 });
    const house = { x: 1540, y: cy };
    r.drawBack((g) => {
      const c = ctx.style.structure;
      for (const [rr, a] of [[180, 0.12], [120, 0.18], [60, 0.24], [18, 0.5]] as const) g.circle(house.x, house.y, rr).fill({ color: c, alpha: a });
      g.moveTo(lane.x0, cy).lineTo(lane.x1, cy).stroke({ width: 1.5, color: c, alpha: 0.25 });
      g.moveTo(house.x, cy - lane.h / 2).lineTo(house.x, cy + lane.h / 2).stroke({ width: 1.5, color: c, alpha: 0.25 });
    });
    const stone = { restitution: 0.85, friction: 0.05, frictionAir: 0.0062, density: 0.003 };
    circle(ctx, house.x - 210, cy + 26, 34, { role: 'hero', hue: 0.85, weight: 1 }, stone);
    circle(ctx, house.x + 40, cy - 70, 34, { role: 'hero', hue: 0.85, weight: 1 }, stone);
    circle(ctx, house.x + 120, cy + 95, 34, { role: 'hero', hue: 0.2, weight: 1 }, stone);
    const shot = circle(ctx, 230, cy + 10, 34, { role: 'hero', hue: 0.2, trail: 2.5, weight: 1 }, stone);
    dolly(ctx, 900, cy, 1.0, 1.05, 1180);
    return { entry: { x: 230, y: cy }, enter: () => Body.setVelocity(shot, { x: 8.2, y: 0.15 }) };
  },
};

export const COLLISION: SceneDef[] = [cradle, stackDrop, breakShot, restitution, recoil, gas, curling];
