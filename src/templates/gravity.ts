import { W, type SceneDef } from '../core/types';
import { easeInOutSine } from '../core/ease';
import { Bodies, Body, Composite, Constraint, arcPts, ball, compound, dolly, ground, halt, open, polygon, rect, release, staticCircle, staticRect, turn, wallBody, wallPath, type MBody, type Pt } from './kit';

/** Brachistochrone — line, arc and cycloid race between the same two points; the cycloid wins. */
const brachistochrone: SceneDef = {
  id: 'brachistochrone',
  theme: 'gravity',
  title: { zh: '最速降线', en: 'Brachistochrone' },
  law: { zh: '能量守恒 · 最速降线', en: 'Energy conservation · fastest descent' },
  blurb: { zh: '直线、圆弧、摆线三条无摩擦轨道，起点终点相同，摆线最先到达；之后每颗球都几乎回到出发的高度。', en: 'Line, arc and cycloid share start and finish; the cycloid wins, and every ball climbs back almost to its start.' },
  duration: 12,
  energy: 2,
  endState: 'periodic',
  setup(ctx) {
    const { r, world, engine } = ctx;
    engine.gravity.scale = 0.0005;
    const A = { x: 330, y: 300 };
    const B = { x: 1470, y: 740 };
    const rad = 16;
    const thick = 10;
    const dx = B.x - A.x;
    const dy = B.y - A.y;
    let lo = 0.01;
    let hi = 2 * Math.PI - 0.01;
    for (let i = 0; i < 80; i++) {
      const m = (lo + hi) / 2;
      if ((m - Math.sin(m)) / (1 - Math.cos(m)) < dx / dy) lo = m;
      else hi = m;
    }
    const te = (lo + hi) / 2;
    const R = dy / (1 - Math.cos(te));
    const len = Math.hypot(dx, dy);
    const C = { x: (A.x + B.x) / 2 + (dy / len) * 600, y: (A.y + B.y) / 2 + (-dx / len) * 600 };
    const ra = Math.hypot(A.x - C.x, A.y - C.y);
    const a0 = Math.atan2(A.y - C.y, A.x - C.x);
    let a1 = Math.atan2(B.y - C.y, B.x - C.x);
    if (a1 > a0) a1 -= Math.PI * 2;
    const curves: ((u: number) => Pt)[] = [
      (u) => ({ x: A.x + dx * u, y: A.y + dy * u }),
      (u) => ({ x: C.x + Math.cos(a0 + (a1 - a0) * u) * ra, y: C.y + Math.sin(a0 + (a1 - a0) * u) * ra }),
      (u) => ({ x: A.x + R * (te * u - Math.sin(te * u)), y: A.y + R * (1 - Math.cos(te * u)) }),
    ];
    const tail = (u: number): Pt => {
      if (u < 0.35) return { x: B.x + (u / 0.35) * 160, y: B.y };
      const qa = (Math.PI / 2) * ((u - 0.35) / 0.65);
      return { x: B.x + 160 + Math.sin(qa) * 300, y: B.y - (1 - Math.cos(qa)) * 300 };
    };
    const balls: MBody[] = [];
    const paths: Pt[][] = [];
    const arrived: number[] = [];
    curves.forEach((f, i) => {
      const cat = 1 << (i + 1);
      const pts: Pt[] = [];
      for (let k = 0; k <= 70; k++) pts.push(f(k / 70));
      for (let k = 1; k <= 24; k++) pts.push(tail(k / 24));
      paths.push(pts.map((p) => ({ x: p.x, y: p.y + rad + 2 })));
      for (let k = 0; k < pts.length - 1; k++) {
        const a = pts[k];
        const b = pts[k + 1];
        const tx = b.x - a.x;
        const ty = b.y - a.y;
        const L = Math.hypot(tx, ty) || 1;
        let ox = -ty / L;
        let oy = tx / L;
        if (oy < 0) {
          ox = -ox;
          oy = -oy;
        }
        const off = rad + thick / 2;
        Composite.add(world, Bodies.rectangle((a.x + b.x) / 2 + ox * off, (a.y + b.y) / 2 + oy * off, L + 2, thick, { isStatic: true, angle: Math.atan2(ty, tx), friction: 0, collisionFilter: { category: cat, mask: cat } }));
      }
      balls.push(ball(ctx, A.x + 0.5, A.y - 0.5, rad, { role: 'hero', hue: i / 2, trail: 2.2, weight: 1, impacts: false }, { isStatic: true, friction: 0, frictionAir: 0, restitution: 0, collisionFilter: { category: cat, mask: cat } }));
    });
    // Looks are made once: a hand-drawn look takes its wobble from the look's seed.
    const looks = paths.map((_p, i) => r.look('hero', i / 2));
    r.drawBack((g) => {
      paths.forEach((pts, i) => ctx.style.drawLink(g, pts, looks[i], 3));
      g.rect(A.x - 3, A.y - 60, 6, 80).fill({ color: ctx.style.structure, alpha: 0.7 });
      g.rect(B.x - 2, B.y - 120, 4, 160).fill({ color: ctx.style.accentColor, alpha: 0.8 });
    });
    r.drawFront((g) => arrived.forEach((i, rank) => g.circle(B.x, B.y - 150 - rank * 34, 11 - rank * 2).fill({ color: r.color('hero', i / 2), alpha: 0.95 })));
    dolly(ctx, W / 2 + 40, 560, 0.98, 1.02);
    return {
      entry: A,
      enter: () => release(...balls),
      step: () =>
        balls.forEach((b, i) => {
          if (!arrived.includes(i) && b.position.x >= B.x) {
            arrived.push(i);
            r.fx.ring({ x: B.x, y: b.position.y, r1: 70 - arrived.length * 14, width: 2, color: r.color('hero', i / 2), life: 0.7 });
          }
        }),
    };
  },
};

/** Projectile Fan — twelve balls launched at the same speed and different angles draw a family of parabolas. */
const projectileFan: SceneDef = {
  id: 'projectile-fan',
  theme: 'gravity',
  title: { zh: '抛射扇面', en: 'Projectile Fan' },
  law: { zh: '抛体运动', en: 'Projectile motion' },
  blurb: { zh: '同一速率、不同角度依次抛出的十二颗球，轨迹叠成一把抛物线之伞，45° 飞得最远。', en: 'Twelve balls thrown at one speed and different angles draw an umbrella of parabolas; 45° goes furthest.' },
  duration: 11,
  energy: 3,
  endState: 'settle',
  canDrop: true,
  setup(ctx) {
    const { tl } = ctx;
    const origin = { x: 230, y: 930 };
    const fl = ground(ctx, 980, 5000);
    const speed = 20;
    const balls: MBody[] = [];
    const n = 12;
    for (let i = 0; i < n; i++) {
      const b = ball(ctx, origin.x, origin.y - i * 0.01, 14, { role: 'hero', hue: i / (n - 1), trail: 4.5, weight: 1 }, { isStatic: true, restitution: 0.1, friction: 0.4, frictionAir: 0 });
      b.collisionFilter.group = -2;
      balls.push(b);
    }
    staticRect(ctx, origin.x - 40, origin.y + 25, 120, 50, 'structure');
    // A comb of slots along the floor: each ball drops into the slot where it lands.
    for (let x = 520; x <= 1860; x += 44) staticRect(ctx, x, 958, 6, 44, 'structure', 0, { restitution: 0.1 });
    staticRect(ctx, 1900, 880, 20, 200, 'structure');
    dolly(ctx, W / 2, 580, 1.0, 0.97);
    return {
      entry: origin,
      floors: [fl],
      enter: () =>
        balls.forEach((b, i) =>
          tl.at(tl.t + i * 0.14, () => {
            const a = ((14 + (i * 68) / (n - 1)) * Math.PI) / 180;
            release(b);
            Body.setVelocity(b, { x: Math.cos(a) * speed, y: -Math.sin(a) * speed });
          }),
        ),
    };
  },
};

/** Trapdoor Shelves — three hinged trapdoors open in turn and a cargo of shapes cascades down. */
const trapdoors: SceneDef = {
  id: 'trapdoor-shelf',
  theme: 'gravity',
  title: { zh: '活板门货架', en: 'Trapdoor Shelves' },
  law: { zh: '重力与铰链', en: 'Gravity and hinges' },
  blurb: { zh: '三层货架的活板门依次打开，满载的形体一层层倾泻而下，落进底部的盆里。', en: 'Three trapdoors swing open in turn; their cargo cascades shelf by shelf into the basin below.' },
  duration: 11,
  energy: 3,
  endState: 'settle',
  // Loaded shelves: cargo leaning on cargo takes a while to stop creeping.
  presettle: 7,
  setup(ctx) {
    const { r, rng, tl, world } = ctx;
    ctx.engine.constraintIterations = 8;
    const latches: MBody[] = [];
    const doors: MBody[] = [];
    const w = 340;
    // Each shelf sits under the spill of the one above; doors hinge on the left, latch on the right.
    const shelves = [
      { x: 540, y: 300 },
      { x: 720, y: 520 },
      { x: 900, y: 740 },
    ];
    shelves.forEach((s, i) => {
      // Cargo spills off the latch end (right), so every shelf can be walled at both ends.
      for (const side of [-1, 1]) staticRect(ctx, s.x + side * (w / 2 + 12), s.y - 80, 14, 140, 'structure');
      const door = rect(ctx, s.x, s.y, w, 16, { role: 'debris', hue: i / 2 }, { density: 0.003, friction: 0.3 });
      Composite.add(world, Constraint.create({ pointA: { x: s.x - w / 2, y: s.y }, bodyB: door, pointB: { x: -w / 2, y: 0 }, length: 0, stiffness: 1 }));
      // The hinge pin is drawn, not felt: the door turns about the constraint.
      staticCircle(ctx, s.x - w / 2, s.y, 7, 'structure', { collisionFilter: { group: 0, category: 0x0002, mask: 0 } });
      r.track(door);
      latches.push(staticRect(ctx, s.x + w / 2 - 8, s.y + 16, 30, 16, 'accent'));
      // Hinged at one end and latched at the other, a closed door is rigid: it is held until its latch opens.
      Body.setStatic(door, true);
      doors.push(door);
      for (let k = 0; k < 10; k++) {
        const x = s.x - w / 2 + 38 + (k % 5) * 66 + rng.range(-3, 3);
        const y = s.y - 36 - Math.floor(k / 5) * 52;
        const view = { role: 'hero' as const, hue: (i * 0.33 + k * 0.03) % 1 };
        if (k % 3 === 0) ball(ctx, x, y, 22, view, { friction: 0.3, restitution: 0.15 });
        else if (k % 3 === 1) rect(ctx, x, y, 40, 40, view, { friction: 0.4, restitution: 0.1 });
        else polygon(ctx, x, y + 4, 3, 26, view, { friction: 0.4, restitution: 0.1 });
      }
    });
    const basin = [...wallPath(ctx, [{ x: 770, y: 930 }, { x: 800, y: 1000 }, { x: 1420, y: 1000 }, { x: 1450, y: 930 }], 18), ground(ctx, 1030, 4000), staticRect(ctx, 250, 900, 20, 260, 'structure'), staticRect(ctx, 1700, 900, 20, 260, 'structure')];
    dolly(ctx, 900, 580, 0.94, 0.98);
    return {
      entry: { x: 720, y: 520 },
      floors: basin,
      enter: () =>
        latches.forEach((l, i) =>
          tl.at(tl.t + 0.3 + i * 1.7, () => {
            open(ctx, l);
            release(doors[i]);
          }),
        ),
    };
  },
};

/** Tumbling Room — a motor turns the room a quarter at a time; its furniture slides and tumbles. */
const tumblingRoom: SceneDef = {
  id: 'tumbling-room',
  theme: 'gravity',
  title: { zh: '翻转房间', en: 'Tumbling Room' },
  law: { zh: '转动的房间与不变的重力', en: 'A turning room, gravity unchanged' },
  blurb: { zh: '电机把整个房间每次翻转九十度，镜头跟着房间一起转；房里的"家具"一次次滑落、翻滚、重新堆叠。', en: 'A motor turns the whole room a quarter at a time and the camera turns with it; its furniture slides, tumbles and restacks.' },
  duration: 12,
  energy: 3,
  endState: 'settle',
  presettle: 1,
  setup(ctx) {
    const { camera, tl } = ctx;
    const C = { x: W / 2, y: 540 };
    const s = 640;
    const h = s / 2 + 12;
    const room = wallBody(ctx, [{ x: C.x - h, y: C.y - h }, { x: C.x + h, y: C.y - h }, { x: C.x + h, y: C.y + h }, { x: C.x - h, y: C.y + h }], 24, 'structure', { friction: 0.6 }, true);
    const pieces: [number, number, number][] = [[150, 60, 0.05], [90, 90, 0.25], [60, 140, 0.45], [120, 40, 0.6], [70, 70, 0.8], [40, 40, 0.95], [100, 30, 0.35]];
    let x = C.x - s / 2 + 40;
    for (const [w, hh, hue] of pieces) {
      rect(ctx, x + w / 2, C.y + s / 2 - hh / 2 - 2, w, hh, { role: 'hero', hue, weight: 1 }, { friction: 0.5, restitution: 0.15, density: 0.002 });
      x += w + 8;
      if (x > C.x + s / 2 - 120) x = C.x - s / 2 + 60;
    }
    ball(ctx, C.x + 120, C.y + s / 2 - 120, 34, { role: 'accent', weight: 1 }, { friction: 0.05, restitution: 0.3 });
    camera.set(C.x, C.y, 1.0);
    camera.stiffness = 0.5;
    let target = 0;
    let turned = 0;
    const turnAt = (at: number, from: number) => tl.during(at, at + 1.3, (p) => (target = from + (Math.PI / 2) * easeInOutSine(p)));
    return {
      entry: { x: C.x, y: C.y },
      enter: () => {
        const t0 = tl.t;
        turnAt(t0 + 0.2, 0);
        turnAt(t0 + 2.6, Math.PI / 2);
        turnAt(t0 + 5.0, Math.PI);
      },
      step: () => {
        // The motor follows the programmed angle; the camera turns with the room.
        const da = target - turned;
        if (da !== 0) turn(room, da, C);
        else halt(room);
        turned = target;
        camera.angle = camera.targetAngle = -turned;
      },
    };
  },
};

/**
 * Marble Race — eight marbles let go together down a long run of ramps, past a spinner, over
 * bumps and through a field of pegs; the camera keeps with the leader to the finish.
 */
const marbleRace: SceneDef = {
  id: 'marble-race',
  theme: 'gravity',
  title: { zh: '弹珠竞速', en: 'Marble Race' },
  law: { zh: '滚动、碰撞与运气', en: 'Rolling, collisions and luck' },
  blurb: { zh: '八颗弹珠同时出发，冲下一段段折返的长坡，穿过风车、颠过小坡、落进钉阵，镜头一路跟着领头的那颗，直到终点排出名次。', en: 'Eight marbles start together down a run of switchback ramps, past a spinner, over bumps and through pegs; the camera follows the leader to the finish.' },
  duration: 15,
  energy: 4,
  endState: 'settle',
  presettle: 1.6,
  canDrop: true,
  setup(ctx) {
    const { r, world, engine, camera, tl } = ctx;
    engine.gravity.scale = 0.003;
    const rail = { friction: 0.6, frictionStatic: 0.15, restitution: 0.1 };
    const T = 16;
    // Start shelf and gate.
    wallPath(ctx, [{ x: 120, y: 100 }, { x: 120, y: 160 }, { x: 540, y: 226 }], T, 'structure', rail);
    const gate = staticRect(ctx, 548, 176, 14, 90, 'accent');
    // A: long run to the right, ending in a curved bumper.
    wallPath(ctx, [{ x: 530, y: 236 }, { x: 1560, y: 512 }], T, 'structure', rail);
    wallPath(ctx, arcPts(1560, 512, 150, -Math.PI * 0.42, Math.PI * 0.18, 8), T, 'structure', { friction: 0.2, restitution: 0.2 });
    // B: back to the left, with a free spinner on the way.
    wallPath(ctx, [{ x: 1690, y: 660 }, { x: 340, y: 1020 }], T, 'structure', rail);
    wallPath(ctx, arcPts(340, 1020, 150, Math.PI * 0.82, Math.PI * 1.42, 8), T, 'structure', { friction: 0.2, restitution: 0.2 });
    const hub = { x: 1060, y: 734 };
    const spinner = compound(ctx, [Bodies.rectangle(hub.x, hub.y, 150, 12), Bodies.rectangle(hub.x, hub.y, 12, 150), Bodies.circle(hub.x, hub.y, 14)], { role: 'accent', weight: 1, impacts: false }, { density: 0.0016, frictionAir: 0.01, friction: 0.1 });
    Composite.add(world, Constraint.create({ pointA: hub, bodyB: spinner, length: 0, stiffness: 1 }));
    // C: to the right again, over three bumps.
    wallPath(ctx, [{ x: 190, y: 1160 }, { x: 1560, y: 1530 }], T, 'structure', rail);
    // Three little kicks: each lifts the marbles off the rail for a moment.
    for (const bx of [620, 940, 1260]) staticCircle(ctx, bx, 1160 + ((bx - 190) / 1370) * 370 + 5, 16, 'accent', { friction: 0.3 });
    // D: off the end into a field of pegs, funnelled to the final straight.
    const pegs: Pt[] = [];
    for (let row = 0; row < 6; row++)
      for (let k = 0; k < 6 - (row % 2); k++) pegs.push({ x: 1360 + k * 82 + (row % 2) * 41, y: 1660 + row * 62 });
    for (const p of pegs) staticCircle(ctx, p.x, p.y, 9, 'structure', { restitution: 0.3 });
    wallPath(ctx, [{ x: 1290, y: 1580 }, { x: 1300, y: 2040 }, { x: 1520, y: 2160 }], T, 'structure', { friction: 0.1 });
    wallPath(ctx, [{ x: 1840, y: 1580 }, { x: 1830, y: 2040 }, { x: 1600, y: 2160 }], T, 'structure', { friction: 0.1 });
    // E: the final straight to the left, ending in a trough where they queue in finishing order.
    const fin = wallPath(ctx, [{ x: 1692, y: 2150 }, { x: 1680, y: 2200 }, { x: 640, y: 2400 }, { x: 330, y: 2390 }, { x: 300, y: 2310 }], T, 'structure', rail);
    const finishX = 760;
    r.drawBack((g) => {
      const c = ctx.style.accentColor;
      for (let k = 0; k < 8; k++) g.rect(finishX - 6, 2200 + k * 22, 12, 11).fill({ color: c, alpha: k % 2 ? 0.25 : 0.85 });
    });
    const marbles: MBody[] = [];
    for (let i = 0; i < 8; i++) {
      // A little apart, so the row never locks up: touching balls that roll the same way rub against each other.
      const x = 512 - i * 37;
      marbles.push(ball(ctx, x, 160 + ((x - 120) / 420) * 66 - 24, 15, { role: 'hero', hue: i / 7, trail: 1.6, weight: 1 }, { friction: 0.14, frictionStatic: 0.1, restitution: 0.45, density: 0.003, frictionAir: 0.0008 }));
    }
    const finished: MBody[] = [];
    r.drawFront((g) => {
      finished.forEach((b, k) => {
        const p = r.ipos(b);
        if (k < 3) g.circle(p.x, p.y, 15 + 10 - k * 3).stroke({ width: 3 - k * 0.6, color: ctx.style.accentColor, alpha: 0.9 });
      });
    });
    camera.set(700, 420, 0.92);
    camera.stiffness = 1.4;
    let racing = false;
    camera.follow = () => {
      if (!racing) return null;
      const sorted = marbles.filter((b) => !finished.includes(b)).sort((a, b) => b.position.y - a.position.y);
      const lead = sorted[0] ?? finished[finished.length - 1];
      const second = sorted[1] ?? lead;
      return { x: Math.max(760, Math.min(1160, (lead.position.x * 2 + second.position.x) / 3)), y: Math.max(420, Math.min(2000, (lead.position.y * 2 + second.position.y) / 3 - 60)) };
    };
    return {
      entry: { x: 548, y: 200 },
      floors: fin,
      enter: () => {
        open(ctx, gate);
        tl.at(tl.t + 0.4, () => (racing = true));
      },
      step: () => {
        for (const b of marbles) {
          if (finished.includes(b) || b.position.y < 2180 || b.position.x > finishX) continue;
          finished.push(b);
          r.fx.ring({ x: b.position.x, y: b.position.y, r1: finished.length === 1 ? 140 : 70, width: 3, color: r.color('hero', marbles.indexOf(b) / 7), life: 0.6 });
        }
      },
    };
  },
};

/**
 * Rolling Race — a hoop, a disc, a ball and a frictionless block start together down identical
 * slopes. The block, with nothing to spin, wins; the hoop, with all its mass at the rim, comes last.
 */
const rollingRace: SceneDef = {
  id: 'rolling-race',
  theme: 'gravity',
  title: { zh: '滚动竞速', en: 'Rolling Race' },
  law: { zh: '转动惯量分走了动能', en: 'Spinning takes its share of the energy' },
  blurb: { zh: '圆环、圆盘、实心球和一块无摩擦滑块从同一高度沿同样的斜坡出发：不用转的滑块最快，质量全在边上的圆环最慢。', en: 'A hoop, a disc, a ball and a frictionless block race down identical slopes: the block, which need not spin, wins; the hoop comes last.' },
  duration: 11,
  energy: 2,
  endState: 'settle',
  canDrop: true,
  setup(ctx) {
    const { r, engine } = ctx;
    engine.gravity.scale = 0.0018;
    const lanes = 4;
    const x0 = 200;
    const x1 = 1720;
    const drop = 190;
    const R = 34;
    const floors: MBody[] = [];
    const runners: MBody[] = [];
    const held: MBody[] = [];
    for (let k = 0; k < lanes; k++) {
      const y0 = 170 + k * 215;
      floors.push(staticRect(ctx, (x0 + x1) / 2, y0 + drop / 2 + 8, Math.hypot(x1 - x0, drop) + 20, 16, 'structure', Math.atan2(drop, x1 - x0), { friction: 0.9 }));
      staticRect(ctx, x1 + 30, y0 + drop - 40, 16, 110, 'structure');
      const sx = x0 + 80;
      const sy = y0 + ((sx - x0) / (x1 - x0)) * drop - R - 1;
      let b: MBody;
      if (k === 0) {
        b = rect(ctx, sx, sy + R - 26, 64, 52, { role: 'hero', hue: 0.05, weight: 1, trail: 1.2 }, { friction: 0, frictionStatic: 0, density: 0.002, isStatic: true });
      } else if (k === 1) {
        // A solid sphere: I = 2/5·m·r² once it is let go (a disc in the plane would have 1/2).
        b = ball(ctx, sx, sy, R, { role: 'hero', hue: 0.35, weight: 1, trail: 1.2 }, { friction: 0.9, density: 0.002, isStatic: true });
      } else if (k === 2) {
        b = ball(ctx, sx, sy, R, { role: 'hero', hue: 0.65, weight: 1, trail: 1.2 }, { friction: 0.9, density: 0.002, isStatic: true });
      } else {
        // A real hoop: its mass all at the rim, so I ≈ m·r² comes out of the geometry itself.
        const parts: MBody[] = [];
        const n = 28;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          parts.push(Bodies.rectangle(sx + Math.cos(a) * (R - 4), sy + Math.sin(a) * (R - 4), 2 * R * Math.sin(Math.PI / n) + 2, 8, { angle: a + Math.PI / 2 }));
        }
        b = compound(ctx, parts, { role: 'hero', hue: 0.95, weight: 1, trail: 1.2 }, { friction: 0.9, density: 0.004 });
        Body.setStatic(b, true);
      }
      runners.push(b);
      held.push(b);
    }
    const sphere = runners[1];
    const finish = x1 - 140;
    const order: number[] = [];
    r.drawBack((g) => {
      for (let k = 0; k < 9; k++) g.rect(finish - 5, 150 + k * 100, 10, 50).fill({ color: ctx.style.accentColor, alpha: 0.6 });
    });
    r.drawFront((g) => {
      order.forEach((k, rank) => {
        const y0 = 170 + k * 215;
        g.circle(x1 + 90, y0 + drop - 70, 16 - rank * 3).fill({ color: r.color('hero', [0.05, 0.35, 0.65, 0.95][k]), alpha: 0.95 });
      });
    });
    dolly(ctx, W / 2, 520, 0.98, 1.02);
    return {
      entry: { x: x0 + 80, y: 400 },
      floors,
      enter: () => {
        release(...held);
        Body.setInertia(sphere, 0.4 * sphere.mass * R * R);
      },
      step: () => {
        runners.forEach((b, k) => {
          if (!order.includes(k) && b.position.x >= finish) order.push(k);
        });
      },
    };
  },
};

export const GRAVITY: SceneDef[] = [brachistochrone, projectileFan, tumblingRoom, trapdoors, marbleRace, rollingRace];
export type { Pt };
