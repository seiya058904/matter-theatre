import Matter from 'matter-js';
import { W, type SceneDef } from '../core/types';
import { Bodies, Body, Composite, Constraint, circle, compound, cut, dolly, drive, ground, open, rect, drip, release, rotateAbout, staticCircle, staticRect, wallPath, type MBody } from './kit';

/** Ferris Wheel — a motor turns the wheel; gondolas, each carrying a ball, swing freely. */
const ferris: SceneDef = {
  id: 'ferris-wheel',
  theme: 'machine',
  title: { zh: '摩天轮', en: 'Ferris Wheel' },
  law: { zh: '转动参考系与摆动', en: 'Rotation and free-hanging swing' },
  blurb: { zh: '电机缓缓转动大轮，八个吊厢始终自由下垂、轻轻摇摆，厢里的小球随之晃动。', en: 'A motor turns the wheel; eight gondolas hang free and sway, their passengers rolling inside.' },
  duration: 13,
  energy: 1,
  endState: 'periodic',
  presettle: 0.5,
  setup(ctx) {
    const { world, r } = ctx;
    const cx = W / 2;
    const cy = 470;
    const R = 340;
    const n = 8;
    const anchors: { x: number; y: number }[] = [];
    let angle = 0;
    let w = 0;
    let on = false;
    const place = () => {
      for (let i = 0; i < n; i++) {
        const a = angle + (i / n) * Math.PI * 2;
        anchors[i].x = cx + Math.cos(a) * R;
        anchors[i].y = cy + Math.sin(a) * R;
      }
    };
    for (let i = 0; i < n; i++) anchors.push({ x: 0, y: 0 });
    place();
    anchors.forEach((p, i) => {
      const gx = p.x;
      const gy = p.y + 55;
      const cup = compound(ctx, [Bodies.rectangle(gx, gy + 30, 110, 10), Bodies.rectangle(gx - 52, gy + 5, 10, 60), Bodies.rectangle(gx + 52, gy + 5, 10, 60)], { role: 'hero', hue: i / n, weight: 1, impacts: false }, { density: 0.002, frictionAir: 0.01 });
      Composite.add(world, Constraint.create({ pointA: p, bodyB: cup, pointB: { x: 0, y: -60 }, length: 12, stiffness: 1 }));
      circle(ctx, gx, gy + 5, 15, { role: 'accent', impacts: false }, { density: 0.001, friction: 0.05, restitution: 0.3 });
    });
    r.drawBack((g) => {
      const c = ctx.style.structure;
      g.circle(cx, cy, R).stroke({ width: 6, color: c, alpha: 0.75 });
      g.circle(cx, cy, R * 0.82).stroke({ width: 2, color: c, alpha: 0.35 });
      for (let i = 0; i < n * 2; i++) {
        const a = angle + (i / (n * 2)) * Math.PI * 2;
        g.moveTo(cx, cy).lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      }
      g.stroke({ width: 2, color: c, alpha: 0.4 });
      g.moveTo(cx - 260, 1000).lineTo(cx, cy).lineTo(cx + 260, 1000).stroke({ width: 10, color: c, alpha: 0.7, join: 'round' });
      g.circle(cx, cy, 26).fill({ color: c, alpha: 0.9 });
    });
    ground(ctx, 1000, 4000);
    dolly(ctx, cx, 520, 0.92, 0.98);
    return {
      entry: { x: cx, y: cy },
      enter: () => (on = true),
      step: (_t, dt) => {
        if (on) w = Math.min(0.32, w + dt * 0.12);
        angle += w * dt;
        place();
      },
    };
  },
};

/** Shishi-odoshi — a bamboo rocker fills from a drip, tips, empties and knocks back on its stone. */
const shishi: SceneDef = {
  id: 'shishi-odoshi',
  theme: 'machine',
  title: { zh: '鹿威し', en: 'Shishi-odoshi' },
  law: { zh: '力矩与重心转移', en: 'Shifting centre of mass' },
  blurb: { zh: '竹筒一端承接滴落的珠子，重心慢慢前移，终于翻转倾空，又"咚"地一声敲回石上。', en: 'A bamboo rocker fills drop by drop, tips and empties, then knocks back against its stone.' },
  duration: 14,
  energy: 1,
  endState: 'periodic',
  setup(ctx) {
    const { world, tl } = ctx;
    const pivot = { x: 900, y: 600 };
    // Trough from the node (near the pivot) to the open end; counterweight behind the pivot.
    const parts = [
      Bodies.rectangle(pivot.x + 150, pivot.y + 18, 360, 12),
      Bodies.rectangle(pivot.x - 30, pivot.y - 6, 12, 60),
      Bodies.rectangle(pivot.x - 90, pivot.y + 14, 110, 22, { density: 0.0083 }),
    ];
    const tube = compound(ctx, parts, { role: 'hero', hue: 0.35, weight: 1 }, { density: 0.0012, friction: 0.05 });
    Composite.add(world, Constraint.create({ pointA: pivot, bodyB: tube, pointB: { x: pivot.x - tube.position.x, y: pivot.y - tube.position.y }, length: 0, stiffness: 1 }));
    // Tilted about the pivot itself, resting on its stone.
    rotateAbout(tube, -0.32, pivot);
    staticCircle(ctx, pivot.x - 98, pivot.y + 101, 40, 'structure', { restitution: 0.1 });
    staticRect(ctx, pivot.x, pivot.y + 200, 30, 380, 'structure', 0, { collisionFilter: { group: 0, category: 0x0002, mask: 0 } });
    ground(ctx, 980, 4000);
    wallPath(ctx, [{ x: 1090, y: 850 }, { x: 1110, y: 960 }, { x: 1400, y: 960 }, { x: 1420, y: 850 }], 18);
    // The drip: a column of beads above the open end, let fall one at a time.
    const drops = drip(ctx, pivot.x + 250, 70, 14, 12, { role: 'accent', impacts: false }, { density: 0.0045, friction: 0.02, restitution: 0.15 });
    for (const s of [-1, 1]) staticRect(ctx, pivot.x + 250 + s * 22, 104, 8, 40, 'structure');
    dolly(ctx, 1000, 560, 0.98, 1.04);
    return {
      entry: { x: pivot.x + 200, y: pivot.y },
      enter: () => drops.beads.forEach((_d, i) => tl.at(tl.t + i * 0.6, drops.next)),
    };
  },
};

/** Mangonel — a dropping counterweight swings the throwing arm and lobs a stone at a stack. */
const CW_DENSITY = 0.014;
const mangonel: SceneDef = {
  id: 'mangonel',
  theme: 'machine',
  title: { zh: '投石车', en: 'Mangonel' },
  law: { zh: '杠杆与势能转化', en: 'Lever and stored energy' },
  blurb: { zh: '拔掉卡销，配重下坠，长臂猛然抡起，把石弹抛过半空，砸向远处的方块堆。', en: 'The pin is pulled, the counterweight falls and the arm lobs a stone at a distant stack.' },
  duration: 11,
  energy: 5,
  endState: 'settle',
  presettle: 0.6,
  canDrop: true,
  setup(ctx) {
    const { world } = ctx;
    const gy = 920;
    const fl = ground(ctx, gy, 5000);
    const pivot = { x: 560, y: 700 };
    const L = 340;
    // Built pointing left, then lowered: long beam with a cup at its tip, a heavy block on the short end.
    const cupX = pivot.x - L;
    const arm = compound(
      ctx,
      [
        Bodies.rectangle(pivot.x - L / 2 + 60, pivot.y, L + 120, 14),
        Bodies.rectangle(cupX + 4, pivot.y - 20, 10, 34),
        Bodies.rectangle(cupX + 52, pivot.y - 16, 10, 26),
        Bodies.rectangle(pivot.x + 112, pivot.y - 8, 84, 84, { density: CW_DENSITY }),
      ],
      { role: 'debris', hue: 0.3, weight: 1 },
      { frictionAir: 0.001 },
    );
    Composite.add(world, Constraint.create({ pointA: pivot, bodyB: arm, pointB: { x: pivot.x - arm.position.x, y: pivot.y - arm.position.y }, length: 0, stiffness: 1 }));
    const stone = circle(ctx, cupX + 28, pivot.y - 28, 18, { role: 'hero', hue: 0.05, trail: 3, weight: 1 }, { density: 0.0045, friction: 0.3, restitution: 0.1 });
    const rest = -0.35;
    rotateAbout(arm, rest, pivot);
    Body.setPosition(stone, Matter.Vector.add(pivot, Matter.Vector.rotate({ x: cupX + 28 - pivot.x, y: -28 }, rest)));
    // A prop under the counterweight holds everything still until it is knocked away.
    const propAt = Matter.Vector.add(pivot, Matter.Vector.rotate({ x: 112, y: 44 }, rest));
    const prop = staticRect(ctx, propAt.x, propAt.y, 84, 20, 'accent', rest, { friction: 0.8 });
    // Frame (scenery only: the arm swings through it).
    const ghost = { collisionFilter: { group: 0, category: 0x0002, mask: 0 } };
    const leg = staticRect(ctx, propAt.x, (propAt.y + gy) / 2, 14, gy - propAt.y, 'accent', 0, ghost);
    staticRect(ctx, pivot.x, (pivot.y + gy) / 2, 22, gy - pivot.y, 'structure', 0, ghost);
    staticRect(ctx, pivot.x - 60, (pivot.y - 120 + gy) / 2, 14, gy - pivot.y + 120, 'structure', 0.32, ghost);
    // Target stack on the right.
    for (let row = 0; row < 7; row++) for (let k = 0; k < 3; k++) rect(ctx, 940 + k * 52, gy - 25 - row * 50, 50, 48, { role: 'hero', hue: 0.5 + row * 0.06 }, { friction: 0.7, density: 0.0015 });
    ctx.r.impactMin = 4;
    dolly(ctx, 760, 600, 1.0, 1.03, 780, 590);
    return { entry: pivot, floors: [fl], enter: () => open(ctx, prop, leg) };
  },
};

/** Overbalanced Wheel — the classic perpetual-motion design, honestly simulated: it settles. */
const overbalanced: SceneDef = {
  id: 'overbalanced-wheel',
  theme: 'machine',
  title: { zh: '永动轮之谬', en: 'Overbalanced Wheel' },
  law: { zh: '没有永动机', en: 'No perpetual motion' },
  blurb: { zh: '经典的"永动轮"：铰接的重锤看似让一侧更重。松手后它转了几下，便停在了平衡点。', en: 'The classic perpetual-motion wheel: hinged weights promise endless turning; it rocks and stops.' },
  duration: 12,
  energy: 2,
  endState: 'settle',
  setup(ctx) {
    const { world, r } = ctx;
    const cx = W / 2;
    const cy = 480;
    const parts: MBody[] = [Bodies.circle(cx, cy, 34)];
    const n = 8;
    const R = 220;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      parts.push(Bodies.rectangle(cx + Math.cos(a) * R / 2, cy + Math.sin(a) * R / 2, R, 10, { angle: a }));
    }
    const wheel = compound(ctx, parts, { role: 'structure' }, { density: 0.002, frictionAir: 0.006 });
    Composite.add(world, Constraint.create({ pointA: { x: cx, y: cy }, bodyB: wheel, length: 0, stiffness: 1 }));
    const weights: MBody[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const tx = cx + Math.cos(a) * R;
      const ty = cy + Math.sin(a) * R;
      // Arms fold outward on one side, hang inward on the other — the "overbalance".
      const out = Math.cos(a) > 0 ? 1 : -0.4;
      const wx = tx + Math.cos(a) * 90 * out;
      const wy = ty + Math.sin(a) * 90 * out;
      const wgt = circle(ctx, wx, wy, 22, { role: 'hero', hue: i / n, weight: 1, trail: 1.2 }, { density: 0.006, frictionAir: 0.006 });
      wgt.collisionFilter.group = -5;
      const c = Constraint.create({ bodyA: wheel, pointA: { x: Math.cos(a) * R, y: Math.sin(a) * R }, bodyB: wgt, length: 90, stiffness: 1 });
      Composite.add(world, c);
      r.constraint(c, 'structure', 2);
      weights.push(wgt);
    }
    wheel.collisionFilter.group = -5;
    staticRect(ctx, cx, (cy + 1000) / 2, 24, 1000 - cy, 'structure', 0, { collisionFilter: { group: 0, category: 0x0002, mask: 0 } });
    ground(ctx, 1000, 4000);
    Body.setStatic(wheel, true);
    for (const wgt of weights) Body.setStatic(wgt, true);
    dolly(ctx, cx, 500, 1.02, 1.08);
    return {
      entry: { x: cx, y: cy },
      enter: () => {
        release(wheel, ...weights);
        // Given one good push, as every inventor did.
        Body.setAngularVelocity(wheel, 0.045);
        for (const w of weights) {
          const dx = w.position.x - cx;
          const dy = w.position.y - cy;
          Body.setVelocity(w, { x: -dy * 0.045, y: dx * 0.045 });
        }
      },
    };
  },
};

/** Cam Wave — a row of phased cams lifts followers; their heads ripple as a travelling wave. */
const camWave: SceneDef = {
  id: 'cam-wave',
  theme: 'machine',
  title: { zh: '凸轮波', en: 'Cam Wave' },
  law: { zh: '凸轮机构 · 相位差生成波', en: 'Phased cams make a wave' },
  blurb: { zh: '一排相位递增的偏心凸轮推动随动杆上下起落，杆顶连成一道流动的波浪。', en: 'A row of phased eccentric cams lifts followers whose tips ripple as a travelling wave.' },
  duration: 13,
  energy: 1,
  endState: 'periodic',
  setup(ctx) {
    const { r } = ctx;
    const n = 14;
    const axisY = 800;
    const e = 46;
    const cams: MBody[] = [];
    const rods: MBody[] = [];
    const x0 = W / 2 - ((n - 1) * 96) / 2;
    for (let i = 0; i < n; i++) {
      const x = x0 + i * 96;
      const phase = (i / n) * Math.PI * 2;
      cams.push(staticCircle(ctx, x, axisY + Math.sin(phase) * e, 58, 'structure', { friction: 0 }));
      const rod = rect(ctx, x, axisY - 58 - 150 + Math.sin(phase) * e - 2, 26, 300, { role: 'hero', hue: i / (n - 1), weight: 1, impacts: false }, { inertia: Infinity, friction: 0, frictionAir: 0.02, density: 0.001 });
      staticRect(ctx, x - 20, axisY - 380, 8, 160, 'structure', 0, { friction: 0 });
      staticRect(ctx, x + 20, axisY - 380, 8, 160, 'structure', 0, { friction: 0 });
      rods.push(rod);
    }
    r.link(() => rods.map((b) => ({ x: r.ipos(b).x, y: r.ipos(b).y - 150 })), 'accent', 3);
    r.drawBack((g) => g.moveTo(x0 - 80, axisY).lineTo(x0 + (n - 1) * 96 + 80, axisY).stroke({ width: 8, color: ctx.style.structure, alpha: 0.6 }));
    let w = 0;
    let on = false;
    let a = 0;
    dolly(ctx, W / 2, 600, 1.0, 1.05);
    return {
      entry: { x: W / 2, y: 600 },
      enter: () => (on = true),
      step: (_t, dt) => {
        if (on) w = Math.min(2.2, w + dt * 0.8);
        a += w * dt;
        cams.forEach((c, i) => drive(c, c.position.x, axisY + Math.sin(a + (i / n) * Math.PI * 2) * e));
      },
    };
  },
};

/** Slingshot — a stretched band flings a stone into a tower of blocks. */
const SLING_PULL = 200;
const SLING_K = 0.0014;
const slingshot: SceneDef = {
  id: 'slingshot',
  theme: 'machine',
  title: { zh: '弹弓攻塔', en: 'Slingshot' },
  law: { zh: '弹性势能转化为动能', en: 'Elastic energy becomes motion' },
  blurb: { zh: '拉满的皮筋松开，石弹呼啸而出，正中远处的积木塔。', en: 'The stretched band lets go and the stone whistles into a distant tower.' },
  duration: 11,
  energy: 5,
  endState: 'settle',
  presettle: 1,
  canDrop: true,
  setup(ctx) {
    const { world, r } = ctx;
    const gy = 940;
    const fl = ground(ctx, gy, 5000);
    const anchor = { x: 420, y: 640 };
    staticRect(ctx, anchor.x, (anchor.y + gy) / 2 + 20, 22, gy - anchor.y - 40, 'structure');
    const stone = circle(ctx, anchor.x - SLING_PULL, anchor.y + 40, 24, { role: 'accent', trail: 3, weight: 1 }, { isStatic: true, density: 0.004, friction: 0.4 });
    const band = Constraint.create({ pointA: anchor, bodyB: stone, length: 0, stiffness: SLING_K, damping: 0.01 });
    Composite.add(world, band);
    r.constraint(band, 'accent', 3);
    for (let row = 0; row < 8; row++) for (let k = 0; k < 2; k++) rect(ctx, 1460 + k * 74 + (row % 2) * 10, gy - 30 - row * 60, 70, 58, { role: 'hero', hue: row / 8 }, { friction: 0.7, density: 0.0012 });
    ctx.r.impactMin = 4;
    let attached = true;
    dolly(ctx, 1000, 600, 0.92, 0.96, 1060);
    return {
      entry: anchor,
      floors: [fl],
      enter: () => release(stone),
      step: () => {
        // The pouch lets go once the stone passes the fork.
        if (attached && stone.position.x > anchor.x + 20) {
          attached = false;
          cut(ctx, band);
        }
      },
    };
  },
};

export const MACHINE: SceneDef[] = [ferris, shishi, mangonel, overbalanced, camWave, slingshot];
