import Matter from 'matter-js';
import { W, type SceneDef } from '../core/types';
import { Bodies, Body, Composite, Constraint, ball, compound, cut, dolly, ground, rect, drip, release, rope, rotateAbout, staticCircle, staticRect, tuned, turn, wallPath, type MBody, type Pt } from './kit';

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
      ball(ctx, gx, gy + 5, 15, { role: 'accent', impacts: false }, { density: 0.001, friction: 0.05, restitution: 0.3 });
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

/**
 * Trebuchet — a hinged counterweight drops, the long arm whips over the top and drags its sling
 * round behind it; at the top of the swing the pouch lets go and the stone flies into a castle.
 */
const TREB = { L1: 320, L2: 92, phi0: 1.95, sling: 230, cw: 0.011, release: 0.62, px: 560, py: 640 };
const trebuchet: SceneDef = {
  id: 'trebuchet',
  theme: 'machine',
  title: { zh: '配重投石机', en: 'Trebuchet' },
  law: { zh: '势能 → 甩动 → 抛射', en: 'A falling weight whips a sling' },
  blurb: { zh: '扳机松开，沉重的配重下坠，长臂猛地抡起，投索在空中甩出一道弧线，在最高处松脱——石弹越过大半个画面，砸进远处的城堡。', en: 'The trigger lets go: the counterweight drops, the long arm whips up, the sling swings over and lets go at the top, and the stone flies into the castle.' },
  duration: 13,
  energy: 5,
  endState: 'settle',
  presettle: 1,
  canDrop: true,
  setup(ctx) {
    const { world, r, engine } = ctx;
    engine.constraintIterations = 10;
    const gy = 940;
    const fl = ground(ctx, gy, 6000);
    const T = tuned('trebuchet', TREB);
    const P = { x: T.px, y: T.py };
    const { L1, L2, phi0 } = T;
    const u = { x: Math.cos(phi0), y: Math.sin(phi0) };
    const tip = { x: P.x + u.x * L1, y: P.y + u.y * L1 };
    const hingeW = { x: P.x - u.x * L2, y: P.y - u.y * L2 };
    const group = Body.nextGroup(true);
    const mid = { x: (tip.x + hingeW.x) / 2, y: (tip.y + hingeW.y) / 2 };
    const arm = rect(ctx, mid.x, mid.y, L1 + L2 + 28, 18, { role: 'debris', hue: 0.3, weight: 1, impacts: false }, { angle: phi0, density: 0.0024, frictionAir: 0.0004, collisionFilter: { group }, isStatic: true });
    const local = (w: Pt) => ({ x: w.x - arm.position.x, y: w.y - arm.position.y });
    Composite.add(world, Constraint.create({ pointA: P, bodyB: arm, pointB: local(P), length: 0, stiffness: 1 }));
    // The counterweight hangs from a pin at the end of the short arm and swings freely.
    const cw = rect(ctx, hingeW.x, hingeW.y + 60, 124, 112, { role: 'accent', weight: 1 }, { density: T.cw, frictionAir: 0.0004, collisionFilter: { group }, isStatic: true });
    Composite.add(world, Constraint.create({ bodyA: arm, pointA: local(hingeW), bodyB: cw, pointB: { x: 0, y: -60 }, length: 0, stiffness: 1 }));
    // The stone lies in the trough under the frame; the sling runs back to the tip of the arm.
    const stoneAt = { x: tip.x + T.sling, y: gy - 24 };
    const stone = ball(ctx, stoneAt.x, stoneAt.y, 24, { role: 'hero', hue: 0.08, trail: 3.4, weight: 1 }, { density: 0.007, friction: 0.05, restitution: 0.15, frictionAir: 0.0006, collisionFilter: { group } });
    const sling = rope(ctx, tip, { x: stoneAt.x - 24, y: stoneAt.y }, 9, { pinA: false, r: 4, group, density: 0.0012, width: 2.5, role: 'structure', air: 0.0004 });
    Composite.add(world, Constraint.create({ bodyA: arm, pointA: local(tip), bodyB: sling[0], length: 0, stiffness: 1 }));
    const pouch = Constraint.create({ bodyA: sling[sling.length - 1], bodyB: stone, pointB: { x: -24, y: 0 }, length: 0, stiffness: 1 });
    Composite.add(world, pouch);
    // The trigger: a short rope from a stake in the ground holds the arm cocked.
    const trigger = Constraint.create({ pointA: { x: tip.x, y: gy - 2 }, bodyB: arm, pointB: local(tip), length: Math.max(2, gy - 2 - tip.y), stiffness: 1 });
    Composite.add(world, trigger);
    r.constraint(trigger, 'accent', 2);
    // The frame is scenery: two legs and a crossbar the arm swings through.
    r.drawBack((g) => {
      const c = ctx.style.structure;
      g.moveTo(P.x - 150, gy).lineTo(P.x, P.y).lineTo(P.x + 150, gy).stroke({ width: 14, color: c, alpha: 0.75, join: 'round', cap: 'round' });
      g.moveTo(P.x - 92, gy - 150).lineTo(P.x + 92, gy - 150).stroke({ width: 8, color: c, alpha: 0.5, cap: 'round' });
      g.circle(P.x, P.y, 14).fill({ color: c, alpha: 0.95 });
    });
    // The castle.
    const castle: MBody[] = [];
    for (let row = 0; row < 7; row++)
      for (let k = 0; k < 3; k++) castle.push(rect(ctx, 1500 + k * 64 + (row % 2) * 6, gy - 26 - row * 52, 62, 50, { role: 'hero', hue: 0.45 + row * 0.07 }, { friction: 0.7, density: 0.0014 }));
    for (let k = 0; k < 2; k++) castle.push(rect(ctx, 1500 + k * 128, gy - 26 - 7 * 52, 40, 50, { role: 'hero', hue: 0.95 }, { friction: 0.7, density: 0.0014 }));
    const castleSet = new Set(castle);
    ctx.r.impactMin = 4;
    let fired = false;
    let flying = false;
    let hit = false;
    Matter.Events.on(engine, 'collisionStart', (e) => {
      if (hit || !flying) return;
      for (const p of e.pairs)
        if ((p.bodyA === stone && castleSet.has(p.bodyB)) || (p.bodyB === stone && castleSet.has(p.bodyA))) {
          hit = true;
          ctx.slowmo(0.3, 0.45, 0.2);
          ctx.camera.shake(0.35);
        }
    });
    dolly(ctx, 900, 560, 0.94, 0.98, 1020, 570);
    return {
      entry: { x: P.x, y: P.y },
      floors: [fl],
      enter: () => {
        fired = true;
        cut(ctx, trigger);
        release(arm, cw);
      },
      step: () => {
        if (flying && !hit) ctx.camera.to(Math.max(820, Math.min(1260, stone.position.x)), Math.max(380, Math.min(600, stone.position.y + 260)), 0.9);
        if (!fired || flying) return;
        // The prong is set for a throw about 45° upward: the pouch opens as the stone sweeps through it.
        const v = stone.velocity;
        if (stone.position.y < gy - 160 && v.x > 0 && -v.y > v.x * Math.tan(T.release) && -v.y < v.x * Math.tan(T.release + 0.2)) {
          flying = true;
          cut(ctx, pouch);
        }
      },
    };
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
      const wgt = ball(ctx, wx, wy, 22, { role: 'hero', hue: i / n, weight: 1, trail: 1.2 }, { density: 0.006, frictionAir: 0.006 });
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

/** Cam Wave — a row of eccentric cams turns on one shaft, each a little ahead of the last; the followers ride them as a travelling wave. */
const camWave: SceneDef = {
  id: 'cam-wave',
  theme: 'machine',
  title: { zh: '凸轮波', en: 'Cam Wave' },
  presettle: 0.4,
  law: { zh: '凸轮机构 · 相位差生成波', en: 'Phased cams make a wave' },
  blurb: { zh: '一根轴上并排装着十四个偏心凸轮，每个比前一个转前一点；随动杆骑在凸轮上起落，杆顶连成一道向前流动的波浪。', en: 'Fourteen eccentric cams turn on one shaft, each a little ahead of the last; the followers riding them ripple as a travelling wave.' },
  duration: 13,
  energy: 1,
  endState: 'periodic',
  setup(ctx) {
    const { r } = ctx;
    const n = 14;
    const axisY = 800;
    const e = 46;
    const R = 58;
    const cams: { body: MBody; axle: Pt }[] = [];
    const rods: MBody[] = [];
    const x0 = W / 2 - ((n - 1) * 96) / 2;
    for (let i = 0; i < n; i++) {
      const axle = { x: x0 + i * 96, y: axisY };
      const phase = (i / n) * Math.PI * 2;
      // An eccentric disc: it turns about an axle `e` off its centre.
      const body = staticCircle(ctx, axle.x + Math.cos(phase) * e, axle.y + Math.sin(phase) * e, R, 'structure', { friction: 0 });
      Body.setAngle(body, phase);
      cams.push({ body, axle });
      const rod = rect(ctx, axle.x, axisY + Math.sin(phase) * e - R - 152, 26, 300, { role: 'hero', hue: i / (n - 1), weight: 1, impacts: false }, { inertia: Infinity, friction: 0, frictionAir: 0.02, density: 0.001 });
      // Guides long enough to hold the follower over its whole stroke.
      staticRect(ctx, axle.x - 20, axisY - 320, 8, 180, 'structure', 0, { friction: 0 });
      staticRect(ctx, axle.x + 20, axisY - 320, 8, 180, 'structure', 0, { friction: 0 });
      rods.push(rod);
    }
    r.link(() => rods.map((b) => ({ x: r.ipos(b).x, y: r.ipos(b).y - 150 })), 'accent', 3);
    r.drawBack((g) => {
      g.moveTo(x0 - 80, axisY).lineTo(x0 + (n - 1) * 96 + 80, axisY).stroke({ width: 10, color: ctx.style.structure, alpha: 0.55, cap: 'round' });
    });
    r.drawFront((g) => {
      for (const c of cams) g.circle(c.axle.x, c.axle.y, 7).fill({ color: ctx.style.structure, alpha: 0.95 });
    });
    let w = 0;
    let on = false;
    dolly(ctx, W / 2, 570, 1.2, 1.26);
    return {
      entry: { x: W / 2, y: 600 },
      enter: () => (on = true),
      step: (_t, dt) => {
        if (on) w = Math.min(2.2, w + dt * 0.8);
        // One shaft, one motor: every cam turns by the same angle about its own axle.
        for (const c of cams) turn(c.body, -w * dt, c.axle);
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
    const stone = ball(ctx, anchor.x - SLING_PULL, anchor.y + 40, 24, { role: 'accent', trail: 3, weight: 1 }, { isStatic: true, density: 0.004, friction: 0.4 });
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

export const MACHINE: SceneDef[] = [ferris, shishi, trebuchet, overbalanced, camWave, slingshot];
