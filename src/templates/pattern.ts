import { Container, Graphics, RenderTexture, Sprite } from 'pixi.js';
import Matter from 'matter-js';
import { H, W, type SceneDef } from '../core/types';
import { Bodies, Body, arcPts, ball, dolly, polygon, rect, release, staticRect, turn, wallBody, wallPath, type MBody, type Pt } from './kit';

/** Kaleidoscope — a motor turns a 60° mirror cell; its beads tumble, and the cell is mirrored six ways. */
const kaleidoscope: SceneDef = {
  id: 'kaleidoscope',
  theme: 'pattern',
  title: { zh: '万花筒', en: 'Kaleidoscope' },
  law: { zh: '转动容器中的翻滚', en: 'Tumbling in a turning cell' },
  blurb: { zh: '电机转动一个 60° 的镜面腔，腔里的珠子与碎片随之翻滚滑落；腔室被镜像六次，化作不断变幻的曼陀罗。', en: 'A motor turns a 60° mirror cell; its beads tumble, and the cell is mirrored six ways into a mandala.' },
  duration: 13,
  energy: 2,
  endState: 'periodic',
  // The beads' pile keeps creeping for several seconds whatever the seed: it is first seen once still.
  presettle: 5,
  setup(ctx) {
    const { r, rng, renderer } = ctx;
    const cx = W / 2;
    const cy = H / 2;
    const R = 470;
    const axis = Math.PI / 2;
    const half = Math.PI / 6;
    // The cell: two mirror walls and a rim, one rigid body a motor can turn.
    const rim = arcPts(cx, cy, R, axis + half, axis - half, 10);
    const outline = [{ x: cx, y: cy }, ...rim, { x: cx, y: cy }];
    const cell = wallBody(ctx, outline, 10, 'structure', { friction: 0.1, restitution: 0.3 });
    for (let i = 0; i < 34; i++) {
      const a = axis + rng.range(-half * 0.6, half * 0.6);
      const d = rng.range(R * 0.5, R * 0.9);
      const x = cx + Math.cos(a) * d;
      const y = cy + Math.sin(a) * d;
      const view = { role: 'hero' as const, hue: rng.next(), weight: 1 };
      const ph = { restitution: 0.35, friction: 0.08, frictionAir: 0.01, density: 0.002 };
      const kind = i % 3;
      if (kind === 0) ball(ctx, x, y, rng.range(10, 20), view, ph);
      else if (kind === 1) polygon(ctx, x, y, 3, rng.range(14, 24), view, ph);
      else rect(ctx, x, y, rng.range(10, 16), rng.range(34, 52), view, ph);
    }
    r.impactMin = 6;
    const host = r.root.parent!;
    host.removeChild(r.root);
    // The cell is rendered in its own (turning) frame, then mirrored six ways.
    const src = new Container();
    const frameC = new Container();
    const mask = new Graphics();
    mask.moveTo(cx, cy);
    for (let i = 0; i <= 24; i++) {
      const a = axis - half + (i / 24) * half * 2;
      mask.lineTo(cx + Math.cos(a) * (R + 6), cy + Math.sin(a) * (R + 6));
    }
    mask.closePath().fill(0xffffff);
    frameC.addChild(mask);
    frameC.pivot.set(cx, cy);
    frameC.position.set(cx, cy);
    src.addChild(r.root, frameC);
    r.root.mask = mask;
    const size = Math.ceil((R + 24) * 2);
    const rt = RenderTexture.create({ width: size, height: size, resolution: Math.min(renderer.resolution, 1.5), antialias: true });
    src.pivot.set(cx, cy);
    src.position.set(size / 2, size / 2);
    const mandala = new Container();
    mandala.position.set(cx, cy);
    for (const flip of [false, true])
      for (let k = 0; k < 3; k++) {
        const s = new Sprite(rt);
        s.anchor.set(0.5);
        s.rotation = (k * 2 * Math.PI) / 3;
        s.scale.set(1, flip ? -1 : 1);
        mandala.addChild(s);
      }
    const frame = new Graphics();
    frame.circle(cx, cy, R + 14).stroke({ width: 2, color: ctx.style.structure, alpha: 0.5 });
    for (let k = 0; k < 6; k++) {
      const a = axis - half + (k * Math.PI) / 3;
      frame.moveTo(cx, cy).lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    }
    frame.stroke({ width: 1, color: ctx.style.structure, alpha: 0.18 });
    host.addChild(mandala, frame);
    let w = 0;
    let on = false;
    dolly(ctx, cx, cy, 0.95, 1.0);
    return {
      entry: { x: cx, y: cy },
      enter: () => (on = true),
      step: (_t, dt) => {
        if (on) w = Math.min(0.5, w + dt * 0.35);
        if (w > 0) turn(cell, w * dt, { x: cx, y: cy });
      },
      afterRender: () => {
        // Counter-rotate the source so the turning cell always fills the same wedge.
        const phi = r.iangle(cell);
        src.rotation = -phi;
        frameC.rotation = phi;
        renderer.render({ container: src, target: rt, clear: true });
      },
      dispose: () => {
        rt.destroy(true);
        mask.destroy();
      },
    };
  },
};

/** Stadium vs Circle — one ball in a round table traces a rosette; one in a stadium fills it chaotically. */
const stadium: SceneDef = {
  id: 'stadium-billiards',
  theme: 'pattern',
  title: { zh: '体育场台球', en: 'Stadium Billiards' },
  law: { zh: '可积与混沌', en: 'Order versus chaos' },
  blurb: { zh: '圆形球台里的球画出规整的玫瑰线；换成体育场形状，轨迹很快便杂乱地铺满整个台面。', en: 'A ball in a round table traces a rosette; in a stadium-shaped one its path soon fills the table.' },
  duration: 13,
  energy: 1,
  endState: 'periodic',
  gravity: { x: 0, y: 0 },
  setup(ctx) {
    const cy = H / 2;
    const e = { restitution: 1, friction: 0 };
    // Circle table.
    const c1 = { x: 560, y: cy };
    wallPath(ctx, arcPts(c1.x, c1.y, 310, 0, Math.PI * 2, 56), 18, 'structure', e);
    // Stadium table: two half-circles joined by straight sides.
    const c2 = { x: 1360, y: cy };
    const rr = 230;
    const hl = 150;
    wallPath(ctx, arcPts(c2.x - hl, c2.y, rr, Math.PI / 2, Math.PI * 1.5, 26), 18, 'structure', e);
    wallPath(ctx, arcPts(c2.x + hl, c2.y, rr, -Math.PI / 2, Math.PI / 2, 26), 18, 'structure', e);
    wallPath(ctx, [{ x: c2.x - hl, y: c2.y - rr }, { x: c2.x + hl, y: c2.y - rr }], 18, 'structure', e);
    wallPath(ctx, [{ x: c2.x - hl, y: c2.y + rr }, { x: c2.x + hl, y: c2.y + rr }], 18, 'structure', e);
    const bp = { restitution: 1, friction: 0, frictionAir: 0, frictionStatic: 0, inertia: Infinity };
    const a = ball(ctx, c1.x + 120, c1.y + 10, 10, { role: 'hero', hue: 0.1, trail: 22, weight: 1, impacts: false }, { ...bp, isStatic: true });
    const b = ball(ctx, c2.x + 60, c2.y + 30, 10, { role: 'hero', hue: 0.65, trail: 22, weight: 1, impacts: false }, { ...bp, isStatic: true });
    dolly(ctx, W / 2, cy, 0.98, 1.03);
    return {
      entry: { x: W / 2, y: cy },
      enter: () => {
        release(a, b);
        Body.setVelocity(a, { x: 5.2, y: 7.9 });
        Body.setVelocity(b, { x: 5.2, y: 7.9 });
      },
    };
  },
};

/** Mosaic — a hundred assorted tiles are poured into a frame and settle into a mosaic. */
const mosaic: SceneDef = {
  id: 'settled-mosaic',
  theme: 'pattern',
  title: { zh: '马赛克沉降', en: 'Settled Mosaic' },
  law: { zh: '随机堆积', en: 'Random packing' },
  blurb: { zh: '上百块形状各异的彩片倾倒进画框，碰撞、翻滚、挤紧，最后静止成一幅马赛克。', en: 'A hundred assorted tiles pour into a frame, tumble and pack tight into a still mosaic.' },
  duration: 13,
  energy: 2,
  endState: 'settle',
  canDrop: true,
  setup(ctx) {
    const { tl, rng } = ctx;
    const cx = W / 2;
    const fw = 760;
    const top = 280;
    const bottom = 980;
    staticRect(ctx, cx - fw / 2, (top + bottom) / 2, 20, bottom - top, 'structure');
    staticRect(ctx, cx + fw / 2, (top + bottom) / 2, 20, bottom - top, 'structure');
    const fl = staticRect(ctx, cx, bottom + 10, fw + 20, 20, 'structure');
    const tiles: MBody[] = [];
    for (let i = 0; i < 88; i++) {
      const x = cx - fw / 2 + 75 + (i % 8) * 87 + rng.range(-6, 6);
      const y = -60 - Math.floor(i / 8) * 72;
      const view = { role: 'hero' as const, hue: rng.next(), impacts: false };
      const ph = { isStatic: true, friction: 0.6, restitution: 0.1, density: 0.002 };
      const k = i % 4;
      tiles.push(k === 0 ? rect(ctx, x, y, rng.range(30, 60), rng.range(24, 44), view, ph) : k === 1 ? polygon(ctx, x, y, 3, rng.range(20, 32), view, ph) : k === 2 ? polygon(ctx, x, y, rng.pick([5, 6]), rng.range(18, 26), view, ph) : ball(ctx, x, y, rng.range(14, 22), view, ph));
    }
    ctx.r.impactsEnabled = false;
    dolly(ctx, cx, 600, 0.94, 1.0, cx, 640);
    return {
      entry: { x: cx, y: 600 },
      floors: [fl],
      enter: () => {
        // Poured from the bottom row up, so no tile ever starts inside another.
        for (let k = 0; k < 11; k++) tl.at(tl.t + k * 0.3, () => release(...tiles.slice(k * 8, k * 8 + 8)));
      },
    };
  },
};

/**
 * Ring Escape — balls bounce inside five counter-rotating rings, each with one gap. Whenever a gap
 * swings beneath a ball it drops through to the next ring, until all of them are out.
 */
const ringEscape: SceneDef = {
  id: 'ring-escape',
  theme: 'pattern',
  title: { zh: '层层突围', en: 'Ring Escape' },
  law: { zh: '弹性碰撞与转动的边界', en: 'Elastic bounces inside turning walls' },
  blurb: { zh: '几颗球被关在五道反向转动的同心环里，每道环只有一个缺口。球在重力下不停弹跳，缺口一转到脚下，它就掉进下一层，直到全部突围。', en: 'Balls bounce inside five counter-rotating rings, each with a single gap; whenever a gap swings beneath a ball, it drops to the next ring.' },
  duration: 14,
  energy: 3,
  endState: 'flow',
  canDrop: true,
  setup(ctx) {
    const { r, world, engine } = ctx;
    engine.gravity.scale = 0.0016;
    const C = { x: W / 2, y: 470 };
    const radii = [112, 178, 244, 310, 376];
    const speeds = [1.7, -1.35, 1.1, -0.92, 0.8].map((v) => v * 1.3);
    const thick = 12;
    const rings = radii.map((R, i) => {
      // A gap about six ball-widths wide.
      const gap = 170 / R;
      // The gaps' starting phases are chosen so that each ring's gap comes round soon after the balls
      // have settled into it: all five break out around 8 s, leaving time to watch them land. Wide gaps
      // and a soft rim bounce give the escape a margin: the system is chaotic, and a tuning that only
      // just worked would lose a ball to float-level differences between machines.
      const start = Math.PI / 2 + 4.71 + i * 3;
      const n = Math.round(((Math.PI * 2 - gap) * R) / 24);
      const seg = ((Math.PI * 2 - gap) * R) / n;
      const parts: MBody[] = [];
      for (let k = 0; k < n; k++) {
        const a = start + gap / 2 + ((k + 0.5) / n) * (Math.PI * 2 - gap);
        parts.push(Bodies.rectangle(C.x + Math.cos(a) * R, C.y + Math.sin(a) * R, seg * 1.06, thick, { angle: a + Math.PI / 2 }));
      }
      const body = Body.create({ parts, isStatic: true });
      // Frictionless rims with a lively but losing bounce: a ball soon rests in its ring's trough and
      // drops through the gap as it sweeps past (a near-elastic rim keeps it airborne and trapped).
      for (const p of body.parts) {
        p.restitution = 0.4;
        p.friction = 0;
      }
      r.add(world, body, { role: 'structure', hidden: true });
      return { body, R, gap, start, glow: 0, w: speeds[i], look: r.look('hero', i / (radii.length - 1), 1) };
    });
    // A shallow tray catches the escapees.
    const fl = wallPath(ctx, [{ x: 150, y: 880 }, { x: 210, y: 1010 }, { x: 1710, y: 1010 }, { x: 1770, y: 880 }], 16, 'structure', { friction: 0.6 });
    const balls: MBody[] = [];
    const n = 5;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      balls.push(ball(ctx, C.x + Math.cos(a) * 34, C.y + Math.sin(a) * 34, 14, { role: 'hero', hue: i / (n - 1), trail: 2.2, weight: 1 }, { isStatic: true, restitution: 0.55, friction: 0.25, frictionAir: 0, density: 0.003 }));
    }
    const ringOf = new Map<MBody, (typeof rings)[number]>();
    for (const q of rings) ringOf.set(q.body, q);
    Matter.Events.on(engine, 'collisionStart', (e) => {
      for (const p of e.pairs) {
        const q = ringOf.get(p.bodyA.parent) ?? ringOf.get(p.bodyB.parent);
        if (q) q.glow = 1;
      }
    });
    const pts: Pt[] = [];
    r.drawBack((g, dt) => {
      for (const q of rings) {
        q.glow = Math.max(0, q.glow - dt * 2.4);
        const phi = q.start + r.iangle(q.body);
        const m = Math.max(24, Math.round(q.R / 7));
        pts.length = 0;
        for (let k = 0; k <= m; k++) {
          const a = phi + q.gap / 2 + (k / m) * (Math.PI * 2 - q.gap);
          pts.push({ x: C.x + Math.cos(a) * q.R, y: C.y + Math.sin(a) * q.R });
        }
        ctx.style.drawLink(g, pts, q.look, 6 + q.glow * 4);
      }
    });
    dolly(ctx, W / 2, 520, 1.0, 0.96, W / 2, 540);
    return {
      entry: { x: C.x, y: C.y },
      floors: fl,
      enter: () => release(...balls),
      step: (_t, dt) => {
        // The rings are motor-driven from the first frame; the balls wait at the centre.
        for (const q of rings) turn(q.body, q.w * dt, C);
      },
    };
  },
};

export const PATTERN: SceneDef[] = [kaleidoscope, stadium, mosaic, ringEscape];
