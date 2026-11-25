import Matter from 'matter-js';
import type { Graphics } from 'pixi.js';
import { W, type SceneDef } from '../core/types';
import { easeInOutCubic, easeInOutSine } from '../core/ease';
import { Bodies, Body, Composite, Constraint, arcPts, circle, dolly, ground, fill, funnel, halt, open, release, rotor, spin, staticRect, turn, wallBody, wallPath, type MBody, type Pt } from './kit';

/** Galton Cascade — a hopper opens above a peg lattice; beads pile into a bell curve. */
const galton: SceneDef = {
  id: 'galton',
  theme: 'granular',
  title: { zh: '概率瀑布', en: 'Galton Cascade' },
  law: { zh: '随机碰撞汇成正态分布', en: 'Random bounces make a bell curve' },
  blurb: { zh: '料斗打开，珠子穿过钉阵，在随机碰撞中左右摇摆，最终汇成一条正态分布。', en: 'Beads take a random walk through the pegs and together draw a bell curve.' },
  duration: 13,
  energy: 2,
  endState: 'settle',
  presettle: 2.5,
  canDrop: true,
  setup(ctx) {
    const { r, rng } = ctx;
    const cx = W / 2;
    const rows = 12;
    const sp = 46;
    const top = 330;
    const pegs = new Set<MBody>();
    for (let row = 0; row < rows; row++) {
      const n = row + 3;
      for (let k = 0; k < n; k++) pegs.add(circle(ctx, cx + (k - (n - 1) / 2) * sp, top + row * 34, 5, { role: 'structure', impacts: false }, { isStatic: true, restitution: 0.4, friction: 0.02 }));
    }
    const { gate } = funnel(ctx, cx, 120, 660, 92, 142, -420);
    const binTop = top + rows * 34 + 26;
    const floorY = 1030;
    const bins = rows + 4;
    for (let k = 0; k <= bins; k++) staticRect(ctx, cx + (k - bins / 2) * sp, (binTop + floorY) / 2, 6, floorY - binTop, 'structure', 0, { friction: 0.02 });
    const fl = staticRect(ctx, cx, floorY + 10, bins * sp + 40, 20, 'ground');
    // Side guards along the lattice keep every bead on the board.
    for (const s of [-1, 1]) wallPath(ctx, [{ x: cx + s * 70, y: 296 }, { x: cx + s * (bins / 2) * sp, y: binTop }], 10);
    r.impactsEnabled = false;
    fill(ctx, cx - 292, 100, 30, 5, 8.5, (_i, row) => ({ role: 'hero', hue: row / 5, impacts: false }), { restitution: 0.25, friction: 0.01, frictionAir: 0.004, density: 0.002 });
    void rng;
    Matter.Events.on(ctx.engine, 'collisionStart', (e) => {
      for (const p of e.pairs) {
        const peg = pegs.has(p.bodyA) ? p.bodyA : pegs.has(p.bodyB) ? p.bodyB : null;
        const v = peg && r.views.get(peg);
        if (v) v.flash = 1;
      }
    });
    dolly(ctx, cx, 470, 0.92, 1.02, cx, 590);
    return { entry: { x: cx, y: 270 }, floors: [fl], enter: () => open(ctx, gate) };
  },
};

/** Hourglass — sand pours through the neck; then a motor turns the glass over and it pours again. */
const hourglass: SceneDef = {
  id: 'hourglass',
  theme: 'granular',
  title: { zh: '沙漏翻转', en: 'Hourglass' },
  law: { zh: '颗粒流与重力', en: 'Granular flow under gravity' },
  blurb: { zh: '砂粒穿过细颈流下；随后电机把整只沙漏翻转过来，镜头随之转动，彩色地层再次倾泻。', en: 'Sand pours through the neck; then a motor turns the glass over, the camera turning with it, and the strata flow back.' },
  duration: 13,
  energy: 2,
  endState: 'flow',
  presettle: 4,
  setup(ctx) {
    const { camera, tl, rng } = ctx;
    const C = { x: W / 2, y: 540 };
    const half = 360;
    const neck = 36;
    const width = (y: number) => neck + 250 * Math.pow(Math.sin((Math.PI * Math.abs(y)) / 420), 0.85);
    const left: Pt[] = [];
    const right: Pt[] = [];
    for (let i = 0; i <= 36; i++) {
      const y = -half + (i / 36) * half * 2;
      left.push({ x: C.x - width(y), y: C.y + y });
      right.push({ x: C.x + width(y), y: C.y + y });
    }
    // The glass is one rigid body, so the motor can turn the whole of it.
    const glass = wallBody(ctx, [...left, ...right.slice().reverse()], 16, 'structure', { friction: 0.05 }, true);
    const frame = (g: Graphics) => {
      const c = ctx.style.structure;
      g.roundRect(C.x - 330, C.y - half - 46, 660, 26, 8).fill({ color: c, alpha: 0.5 });
      g.roundRect(C.x - 330, C.y + half + 20, 660, 26, 8).fill({ color: c, alpha: 0.5 });
      for (const sx of [-1, 1]) g.rect(C.x + sx * 318 - 5, C.y - half - 30, 10, half * 2 + 60).fill({ color: c, alpha: 0.35 });
    };
    ctx.r.drawBack((g) => {
      // The wooden frame turns with the glass.
      const a = ctx.r.iangle(glass);
      g.setTransform(Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), C.x - C.x * Math.cos(a) + C.y * Math.sin(a), C.y - C.x * Math.sin(a) - C.y * Math.cos(a));
      frame(g);
      g.setTransform(1, 0, 0, 1, 0, 0);
    });
    const rad = 11;
    for (let row = 0; row < 11; row++)
      for (let col = -11; col <= 11; col++) {
        const y = C.y - half + 44 + row * (rad * 2.05);
        const x = C.x + col * rad * 2.05 + (row % 2) * rad;
        if (Math.abs(x - C.x) > width(y - C.y) - rad * 2) continue;
        circle(ctx, x + rng.range(-1, 1), y, rad, { role: 'hero', hue: Math.floor(row / 2.2) / 4, impacts: false }, { friction: 0.02, frictionStatic: 0.1, restitution: 0.1, density: 0.002, frictionAir: 0.004 });
      }
    ctx.r.impactsEnabled = false;
    const gate = staticRect(ctx, C.x, C.y, neck * 2 + 10, 10, 'accent');
    camera.set(C.x, C.y, 0.98);
    camera.stiffness = 0.6;
    let target = 0;
    let turned = 0;
    return {
      entry: { x: C.x, y: C.y },
      enter: () => {
        open(ctx, gate);
        const t0 = tl.t;
        tl.during(t0 + 4.4, t0 + 7.2, (p) => (target = Math.PI * easeInOutSine(p)));
        tl.during(t0 + 4.4, t0 + 7.2, (p) => (camera.targetZoom = 0.98 - 0.1 * Math.sin(Math.PI * p)));
      },
      step: () => {
        const da = target - turned;
        if (da !== 0) turn(glass, da, C);
        else halt(glass);
        turned = target;
        camera.angle = camera.targetAngle = -turned;
      },
    };
  },
};

/** Avalanche — a gate lets a mound of grains loose down a staircase slope. */
const avalanche: SceneDef = {
  id: 'avalanche',
  theme: 'granular',
  title: { zh: '雪崩阶梯', en: 'Avalanche' },
  law: { zh: '休止角与颗粒流', en: 'Angle of repose' },
  blurb: { zh: '挡板抽开，堆在高台上的颗粒沿阶梯倾泻而下，在坡底堆出新的休止角。', en: 'A gate lifts and a mound of grains pours down the stairs, rebuilding its angle of repose below.' },
  duration: 11,
  energy: 3,
  endState: 'settle',
  // The mound needs this long to come fully to rest before it is seen.
  presettle: 6,
  canDrop: true,
  setup(ctx) {
    const { rng } = ctx;
    // The ledge tilts toward the gate: once it lifts the whole mound slumps and pours, rather than only
    // its front grains trickling away.
    const tilt = 0.2;
    const shelfY = (x: number) => 316 + (x - 330) * Math.tan(tilt) - 10;
    staticRect(ctx, 330, 316, 420, 20, 'structure', tilt, { friction: 0 });
    staticRect(ctx, 130, 220, 20, 240, 'structure');
    const gate = staticRect(ctx, 548, 300, 16, 150, 'accent');
    const steps: MBody[] = [];
    for (let i = 0; i < 6; i++) steps.push(staticRect(ctx, 640 + i * 180, 400 + i * 95, 200, 20, 'structure', 0.12, { friction: 0.1 }));
    const fl = staticRect(ctx, W / 2, 1000, 3000, 30, 'ground', 0, { friction: 0.8 });
    for (let i = 0; i < 110; i++) {
      const x = 160 + (i % 18) * 21 + rng.range(-2, 2);
      const y = shelfY(x) - 10 - Math.floor(i / 18) * 21;
      circle(ctx, x, y, 9.5, { role: 'hero', hue: Math.floor(i / 18) / 6, impacts: false }, { friction: 0.08, frictionStatic: 0.15, restitution: 0.05, density: 0.002, frictionAir: 0.002 });
    }
    ctx.r.impactsEnabled = false;
    dolly(ctx, 900, 560, 0.95, 1.0, 1000, 600);
    return { entry: { x: 330, y: 280 }, floors: [fl, ...steps], enter: () => open(ctx, gate) };
  },
};

/** Ball Water-Wheel — a stream of balls spins up a free paddle wheel. */
const waterWheel: SceneDef = {
  id: 'water-wheel',
  theme: 'granular',
  title: { zh: '滚珠水车', en: 'Marble Water-Wheel' },
  law: { zh: '冲量与转动', en: 'Impulse and rotation' },
  blurb: { zh: '料斗打开，一股珠流冲击自由转动的叶轮，叶轮越转越快，珠子被甩进下方的槽。', en: 'A stream of marbles hits a free paddle wheel and spins it up faster and faster.' },
  duration: 12,
  energy: 3,
  endState: 'flow',
  presettle: 2,
  setup(ctx) {
    const { world, r } = ctx;
    const { gate } = funnel(ctx, 760, 150, 380, 60, 110, -380);
    fill(ctx, 760 - 165, 120, 16, 7, 9, (i) => ({ role: 'hero', hue: (i % 16) / 15, impacts: false }), { friction: 0.02, restitution: 0.3, density: 0.002 });
    const cx = 900;
    const cy = 560;
    const parts: MBody[] = [Bodies.circle(cx, cy, 40)];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      parts.push(Bodies.rectangle(cx + Math.cos(a) * 120, cy + Math.sin(a) * 120, 160, 14, { angle: a }));
    }
    const wheel = Body.create({ parts, frictionAir: 0.002, density: 0.002 });
    r.add(world, wheel, { role: 'accent', weight: 1, impacts: false });
    Composite.add(world, Constraint.create({ pointA: { x: cx, y: cy }, bodyB: wheel, length: 0, stiffness: 1 }));
    wallPath(ctx, [{ x: 420, y: 760 }, { x: 560, y: 920 }, { x: 1500, y: 960 }, { x: 1620, y: 820 }], 18);
    ground(ctx, 1040, 4000);
    staticRect(ctx, 40, 900, 30, 300, 'structure');
    staticRect(ctx, 1880, 900, 30, 300, 'structure');
    r.impactsEnabled = false;
    // Framed from the hopper's rim to the floor: the whole run of marbles stays in shot.
    dolly(ctx, 910, 500, 0.96, 1.0, 920, 520);
    return { entry: { x: 760, y: 260 }, enter: () => open(ctx, gate) };
  },
};

/** Rotating Drum — a motor turns a drum half full of grains; the surface keeps avalanching. */
const drum: SceneDef = {
  id: 'rotating-drum',
  theme: 'granular',
  title: { zh: '旋转滚筒', en: 'Rotating Drum' },
  law: { zh: '颗粒在旋转容器中的流动', en: 'Granular flow in a turning drum' },
  blurb: { zh: '电机带动半满的滚筒缓缓转动，颗粒表面不断崩塌、翻滚，两种颜色渐渐混合。', en: 'A motor turns a half-full drum; the surface keeps avalanching and two colours slowly mix.' },
  duration: 12,
  energy: 2,
  endState: 'periodic',
  presettle: 3,
  setup(ctx) {
    const { world, r, rng } = ctx;
    const cx = W / 2;
    const cy = 540;
    const R = 330;
    const parts: MBody[] = [];
    const n = 30;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      parts.push(Bodies.rectangle(cx + Math.cos(a) * (R + 10), cy + Math.sin(a) * (R + 10), 2 * (R + 10) * Math.sin(Math.PI / n) + 6, 20, { angle: a + Math.PI / 2 }));
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      parts.push(Bodies.rectangle(cx + Math.cos(a) * (R - 25), cy + Math.sin(a) * (R - 25), 50, 12, { angle: a }));
    }
    const shell = Body.create({ parts, isStatic: true, friction: 0.8 });
    r.add(world, shell, { role: 'structure', impacts: false });
    // Grains packed row by row from just above the bottom lifter (never overlapping, so the pile starts calm),
    // one colour on each side: the turning drum mixes them.
    const g = 13;
    let placed = 0;
    for (let row = 0; placed < 120; row++) {
      const y = cy + R - 62 - g - row * g * 1.75;
      const half = Math.sqrt(Math.max(0, (R - 30) ** 2 - (y - cy) ** 2)) - g - 4;
      for (let x = cx - half + (row % 2) * g; x <= cx + half && placed < 120; x += g * 2.05) {
        circle(ctx, x + rng.range(-0.5, 0.5), y, g, { role: 'hero', hue: x < cx ? 0.7 : 0.1, impacts: false }, { friction: 0.4, restitution: 0.1, density: 0.002, frictionAir: 0.003 });
        placed++;
      }
    }
    r.impactsEnabled = false;
    let w = 0;
    let on = false;
    dolly(ctx, cx, cy, 1.0, 1.05);
    return {
      entry: { x: cx, y: cy },
      enter: () => (on = true),
      step: (_t, dt) => {
        if (on) w = Math.min(0.55, w + dt * 0.4);
        if (w > 0) spin(shell, w, dt);
      },
    };
  },
};

/** Size Sieve — a mixed pour runs down a slotted grate: small beads drop through, large ones roll on. */
const sieve: SceneDef = {
  id: 'size-sieve',
  theme: 'granular',
  title: { zh: '颗粒筛分', en: 'Size Sieve' },
  law: { zh: '按尺寸分离', en: 'Separation by size' },
  blurb: { zh: '大小混杂的珠子倾泻在开缝的斜筛上，小珠从缝里漏下，大珠一路滚到尽头，自动分成两堆。', en: 'A mixed pour runs down a slotted grate: small beads slip through, large ones roll on into their own bin.' },
  duration: 12,
  energy: 2,
  endState: 'settle',
  presettle: 3.5,
  canDrop: true,
  setup(ctx) {
    const { rng, tl } = ctx;
    // The grate: short bars along a slope with gaps that pass only the small beads. A large bead sits only
    // shallowly in a gap (it would roll out of one on any slope over asin(gap / 2R) ≈ 28°) and keeps rolling.
    const a = { x: 430, y: 420 };
    const b = { x: 1330, y: 720 };
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const ux = (b.x - a.x) / len;
    const uy = (b.y - a.y) / len;
    const ang = Math.atan2(uy, ux);
    const bar = 30;
    const gap = 18;
    for (let d = 0; d < len; d += bar + gap) staticRect(ctx, a.x + ux * (d + bar / 2), a.y + uy * (d + bar / 2), bar, 10, 'structure', ang, { friction: 0.3 });
    wallPath(ctx, [{ x: 262, y: 272 }, { x: a.x - 6, y: a.y - 4 }], 12, 'structure', { friction: 0 });
    // Catch tray for the small beads, a bin for the large.
    const fl1 = wallPath(ctx, [{ x: 380, y: 700 }, { x: 420, y: 900 }, { x: 1290, y: 900 }, { x: 1330, y: 790 }], 16);
    const fl2 = wallPath(ctx, [{ x: 1350, y: 790 }, { x: 1380, y: 900 }, { x: 1640, y: 900 }, { x: 1670, y: 700 }], 16);
    // The hopper above the head of the grate.
    const { gate } = funnel(ctx, 340, 150, 260, 90, 90, -260);
    // Large beads are slick and roll the whole grate; small ones grip, so they slow enough to drop through
    // a gap rather than skip across it.
    const beads: MBody[] = [];
    for (let i = 0; i < 60; i++) {
      const big = i % 3 === 0;
      const r = big ? 19 : 6.5;
      beads.push(circle(ctx, 245 + (i % 6) * 38 + rng.range(-2, 2), 130 - Math.floor(i / 6) * 38, r, { role: 'hero', hue: big ? 0.08 : 0.55 + rng.range(0, 0.15), impacts: false }, { friction: big ? 0.05 : 0.6, restitution: big ? 0.15 : 0.05, density: 0.002 }));
    }
    ctx.r.impactsEnabled = false;
    dolly(ctx, 960, 540, 0.98, 1.03);
    return { entry: { x: 430, y: 420 }, floors: [...fl1, ...fl2], enter: () => tl.at(tl.t + 0.1, () => open(ctx, gate)) };
  },
};

/** Sand Strata — three hoppers open in turn and lay coloured strata into a glass slot. */
const strata: SceneDef = {
  id: 'sand-strata',
  theme: 'granular',
  title: { zh: '分层沙画', en: 'Sand Strata' },
  law: { zh: '颗粒堆积与分层', en: 'Granular layering' },
  blurb: { zh: '三个料斗轮流开闸，三色砂粒在窄玻璃槽里层层堆起，形成起伏的地层。', en: 'Three hoppers open in turn and lay rolling coloured strata in a narrow glass.' },
  duration: 13,
  energy: 1,
  endState: 'settle',
  presettle: 2.5,
  canDrop: true,
  setup(ctx) {
    const { tl, rng } = ctx;
    const cx = W / 2;
    const gw = 520;
    const top = 520;
    const bottom = 980;
    staticRect(ctx, cx - gw / 2, (top + bottom) / 2, 14, bottom - top, 'structure');
    staticRect(ctx, cx + gw / 2, (top + bottom) / 2, 14, bottom - top, 'structure');
    const fl = staticRect(ctx, cx, bottom + 7, gw + 14, 14, 'structure');
    const gates: MBody[] = [];
    const hx = [cx - 360, cx, cx + 360];
    hx.forEach((x, i) => {
      const { gate } = funnel(ctx, x, 180, 220, 66, 120, -200);
      gates.push(gate);
      for (let k = 0; k < 44; k++) circle(ctx, x - 90 + (k % 11) * 18 + rng.range(-1, 1), 160 - Math.floor(k / 11) * 18, 7.5, { role: 'hero', hue: i / 2, impacts: false }, { friction: 0.25, frictionStatic: 0.4, restitution: 0.02, density: 0.002, frictionAir: 0.004 });
    });
    // Chutes from the outer hoppers toward the glass.
    wallPath(ctx, [{ x: cx - 440, y: 316 }, { x: cx - 120, y: 470 }], 12);
    wallPath(ctx, [{ x: cx + 440, y: 316 }, { x: cx + 120, y: 470 }], 12);
    ctx.r.impactsEnabled = false;
    dolly(ctx, cx, 560, 0.98, 1.06, cx, 640);
    return {
      entry: { x: cx, y: 300 },
      floors: [fl],
      enter: () => [1, 0, 2].forEach((g, k) => tl.at(tl.t + 0.2 + k * 2.4, () => open(ctx, gates[g]))),
    };
  },
};

/** Ball Pit — a cannonball drops into a pit of two hundred light balls: a crater, a splash, a slow refill. */
const ballPit: SceneDef = {
  id: 'ball-pit',
  theme: 'granular',
  title: { zh: '球池炮弹', en: 'Ball Pit' },
  law: { zh: '冲击在颗粒中扩散', en: 'An impact spreading through grains' },
  blurb: { zh: '两颗沉重的铁球先后砸进铺满彩球的球池，砸出深坑，溅起一片彩球雨，再被慢慢填平。', en: 'Two heavy balls drop into a pit of light coloured balls: a crater, a splash of colour, a slow refill.' },
  duration: 12,
  energy: 4,
  endState: 'settle',
  presettle: 1.6,
  canDrop: true,
  setup(ctx) {
    const { rng, tl, engine } = ctx;
    engine.gravity.scale = 0.0016;
    const pit = wallPath(ctx, [{ x: 250, y: 600 }, { x: 290, y: 960 }, { x: 1630, y: 960 }, { x: 1670, y: 600 }], 18, 'structure', { friction: 0.3 });
    const fl = ground(ctx, 1030, 4000);
    for (let i = 0; i < 230; i++) {
      const col = i % 36;
      const row = Math.floor(i / 36);
      const r = rng.range(14, 18.5);
      circle(ctx, 330 + col * 35.5 + (row % 2) * 17 + rng.range(-2, 2), 930 - row * 33, r, { role: 'hero', hue: rng.next(), impacts: false }, { friction: 0.05, restitution: 0.45, density: 0.001, frictionAir: 0.002 });
    }
    const big = { density: 0.03, restitution: 0.15, friction: 0.2, frictionAir: 0.0004, isStatic: true };
    const a = circle(ctx, 820, 110, 54, { role: 'accent', weight: 1, trail: 1.2 }, big);
    const b = circle(ctx, 1290, -260, 42, { role: 'accent', weight: 1, trail: 1.2 }, big);
    ctx.r.impactMin = 6;
    let hits = 0;
    Matter.Events.on(engine, 'collisionStart', (e) => {
      for (const p of e.pairs) {
        const ball = p.bodyA === a || p.bodyA === b ? p.bodyA : p.bodyB === a || p.bodyB === b ? p.bodyB : null;
        if (!ball || ball.plugin.hit) continue;
        ball.plugin.hit = true;
        hits++;
        ctx.camera.shake(0.3);
        if (hits === 1) ctx.slowmo(0.35, 0.35, 0.18);
      }
    });
    dolly(ctx, W / 2, 600, 1.0, 1.05, W / 2, 640);
    return {
      entry: { x: 820, y: 780 },
      floors: [...pit, fl],
      enter: () => {
        release(a);
        tl.at(tl.t + 3.2, () => release(b));
      },
    };
  },
};

export const GRANULAR: SceneDef[] = [galton, hourglass, avalanche, waterWheel, drum, sieve, strata, ballPit];
export { easeInOutCubic, arcPts, rotor };
