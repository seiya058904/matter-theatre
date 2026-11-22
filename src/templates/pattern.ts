import { Container, Graphics, RenderTexture, Sprite } from 'pixi.js';
import { H, W, type SceneDef } from '../core/types';
import { Body, arcPts, circle, dolly, polygon, rect, release, staticRect, wallPath, type MBody } from './kit';

/** Kaleidoscope — beads tumble in one 60° mirror cell as the tube turns; the cell is mirrored six ways. */
const kaleidoscope: SceneDef = {
  id: 'kaleidoscope',
  theme: 'pattern',
  title: { zh: '万花筒', en: 'Kaleidoscope' },
  law: { zh: '转动参考系中的重力', en: 'Gravity in a turning frame' },
  blurb: { zh: '珠子与碎片在 60° 镜面腔里翻滚，镜筒缓缓转动，重力随之换向；腔室被镜像六次，化作曼陀罗。', en: 'Beads tumble in a 60° mirror cell as the tube turns, mirrored six ways into a mandala.' },
  duration: 13,
  energy: 2,
  endState: 'periodic',
  presettle: 1.2,
  setup(ctx) {
    const { r, engine, rng, renderer } = ctx;
    const cx = W / 2;
    const cy = H / 2;
    const R = 470;
    const axis = Math.PI / 2;
    const half = Math.PI / 6;
    const wall = (a: number) => staticRect(ctx, cx + Math.cos(a) * R * 0.5, cy + Math.sin(a) * R * 0.5, R + 20, 8, 'structure', a, { friction: 0.1, restitution: 0.3 });
    wall(axis - half);
    wall(axis + half);
    for (let i = 0; i < 10; i++) {
      const a = axis - half + ((i + 0.5) / 10) * half * 2;
      staticRect(ctx, cx + Math.cos(a) * R, cy + Math.sin(a) * R, 2 * R * Math.sin(half / 10) + 10, 10, 'structure', a + Math.PI / 2, { friction: 0.1, restitution: 0.3 });
    }
    for (let i = 0; i < 34; i++) {
      const a = axis + rng.range(-half * 0.6, half * 0.6);
      const d = rng.range(R * 0.5, R * 0.9);
      const x = cx + Math.cos(a) * d;
      const y = cy + Math.sin(a) * d;
      const view = { role: 'hero' as const, hue: rng.next(), weight: 1 };
      const ph = { restitution: 0.35, friction: 0.08, frictionAir: 0.01, density: 0.002 };
      const kind = i % 3;
      if (kind === 0) circle(ctx, x, y, rng.range(10, 20), view, ph);
      else if (kind === 1) polygon(ctx, x, y, 3, rng.range(14, 24), view, ph);
      else rect(ctx, x, y, rng.range(10, 16), rng.range(34, 52), view, ph);
    }
    r.impactMin = 6;
    const host = r.root.parent!;
    host.removeChild(r.root);
    const src = new Container();
    const mask = new Graphics();
    mask.moveTo(cx, cy);
    for (let i = 0; i <= 24; i++) {
      const a = axis - half + (i / 24) * half * 2;
      mask.lineTo(cx + Math.cos(a) * (R + 6), cy + Math.sin(a) * (R + 6));
    }
    mask.closePath().fill(0xffffff);
    src.addChild(r.root, mask);
    r.root.mask = mask;
    const size = Math.ceil((R + 24) * 2);
    const rt = RenderTexture.create({ width: size, height: size, resolution: Math.min(renderer.resolution, 1.5), antialias: true });
    src.position.set(size / 2 - cx, size / 2 - cy);
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
    let phi = 0;
    let turning = false;
    dolly(ctx, cx, cy, 0.95, 1.0);
    return {
      entry: { x: cx, y: cy },
      enter: () => (turning = true),
      step: (_t, dt) => {
        if (!turning) return;
        phi += dt * 0.5;
        engine.gravity.x = -Math.sin(phi);
        engine.gravity.y = Math.cos(phi);
      },
      afterRender: () => renderer.render({ container: src, target: rt, clear: true }),
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
    const ball = { restitution: 1, friction: 0, frictionAir: 0, frictionStatic: 0, inertia: Infinity };
    const a = circle(ctx, c1.x + 120, c1.y + 10, 10, { role: 'hero', hue: 0.1, trail: 22, weight: 1, impacts: false }, { ...ball, isStatic: true });
    const b = circle(ctx, c2.x + 60, c2.y + 30, 10, { role: 'hero', hue: 0.65, trail: 22, weight: 1, impacts: false }, { ...ball, isStatic: true });
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
      tiles.push(k === 0 ? rect(ctx, x, y, rng.range(30, 60), rng.range(24, 44), view, ph) : k === 1 ? polygon(ctx, x, y, 3, rng.range(20, 32), view, ph) : k === 2 ? polygon(ctx, x, y, rng.pick([5, 6]), rng.range(18, 26), view, ph) : circle(ctx, x, y, rng.range(14, 22), view, ph));
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

export const PATTERN: SceneDef[] = [kaleidoscope, stadium, mosaic];
