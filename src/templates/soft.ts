import { W, H, type SceneDef } from '../core/types';
import { Body, arcPts, dolly, softBlob, staticRect, wallPath, type MBody } from './kit';

const bowlOf = (cx: number) => {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= 20; i++) {
    const a = Math.PI * (0.06 + (0.88 * i) / 20);
    pts.push({ x: cx + Math.cos(a) * 560, y: 430 + Math.sin(a) * 520 });
  }
  return pts;
};

/** Soft Bloom — jelly blossoms drop into a bowl one by one, squash and stack. */
const softBloom: SceneDef = {
  id: 'soft-bloom',
  theme: 'soft',
  title: { zh: '软体花园', en: 'Soft Bloom' },
  law: { zh: '胡克定律 F = −kx', en: "Hooke's law, F = −kx" },
  blurb: { zh: '由弹簧环构成的果冻花一颗颗落入花钵，挤压、回弹、颤动、堆叠。', en: 'Jelly blossoms made of spring rings drop into a bowl, squash, wobble and stack.' },
  duration: 13,
  energy: 2,
  endState: 'settle',
  presettle: 0.8,
  setup(ctx) {
    const { r, tl, rng } = ctx;
    const cx = W / 2;
    wallPath(ctx, bowlOf(cx), 22, 'structure', { friction: 0.6 });
    r.impactMin = 5;
    softBlob(ctx, cx - 120, 460, 78, 0.1);
    softBlob(ctx, cx + 170, 520, 64, 0.35);
    for (let k = 0; k < 6; k++) tl.at(ctx.enterAt + k * 0.75, () => softBlob(ctx, cx + rng.range(-240, 240), -170, rng.range(54, 88), (0.55 + k * 0.17) % 1));
    tl.at(ctx.enterAt + 5, () => softBlob(ctx, cx, -320, 140, 0.95));
    dolly(ctx, cx, 560, 0.98, 0.92, cx, 520);
    return { entry: { x: cx, y: 600 } };
  },
};

/** Jelly Steps — three jelly blobs tumble down a staircase, squashing on every landing. */
const jellySteps: SceneDef = {
  id: 'jelly-steps',
  theme: 'soft',
  title: { zh: '果冻落阶', en: 'Jelly Steps' },
  law: { zh: '弹性形变与恢复', en: 'Elastic deformation' },
  blurb: { zh: '三团果冻沿台阶一级级弹落，每次落地都被压扁，又颤巍巍地恢复原形。', en: 'Three jelly blobs bounce down a staircase, squashing flat on each step and wobbling back.' },
  duration: 12,
  energy: 2,
  endState: 'settle',
  presettle: 0.8,
  setup(ctx) {
    const steps: MBody[] = [];
    // A gently sloping top shelf, then a staircase down to the right.
    steps.push(staticRect(ctx, 300, 320, 560, 24, 'structure', 0.2, { friction: 0.08 }));
    for (let i = 1; i < 6; i++) steps.push(staticRect(ctx, 520 + i * 200, 360 + i * 110, 230, 26, 'structure', 0, { friction: 0.6 }));
    staticRect(ctx, 1750, 1000, 700, 26, 'ground');
    staticRect(ctx, 20, 240, 20, 200, 'structure');
    softBlob(ctx, 460, 270, 52, 0.05, 0.06);
    softBlob(ctx, 330, 250, 48, 0.4, 0.06);
    softBlob(ctx, 190, 225, 44, 0.75, 0.06);
    // A gate at the lip of the shelf holds them until the segment begins.
    const stopper = staticRect(ctx, 590, 300, 16, 120, 'accent');
    dolly(ctx, 1000, 600, 0.92, 0.98, 1100, 640);
    return {
      entry: { x: 420, y: 300 },
      floors: steps,
      enter: () => ctx.r.remove(ctx.world, stopper),
    };
  },
};

/** Soft Collision — two large jelly bodies drift together in zero gravity, collide and wobble apart. */
const softCollide: SceneDef = {
  id: 'soft-collision',
  theme: 'soft',
  title: { zh: '零重力软碰', en: 'Soft Collision' },
  law: { zh: '非刚体碰撞中的能量', en: 'Energy in a soft collision' },
  blurb: { zh: '失重中两团巨大的软体相向漂来，撞在一起，变形、旋转，颤动着分开。', en: 'Two big jelly bodies drift together in zero gravity, collide, spin and wobble apart.' },
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
    const a = softBlob(ctx, 480, H / 2 - 50, 150, 0.1, 0.04, 0);
    const b = softBlob(ctx, 1440, H / 2 + 50, 120, 0.6, 0.04, 0);
    for (const p of a) Body.setVelocity(p, { x: 2.6, y: 0.2 });
    for (const p of b) Body.setVelocity(p, { x: -3.0, y: -0.1 });
    dolly(ctx, W / 2, H / 2, 0.95, 1.05);
    return { entry: { x: W / 2, y: H / 2 } };
  },
};

/** Bouncing Ring — a hollow soft ring drops onto tilted plates and flexes on every bounce. */
const ring: SceneDef = {
  id: 'bouncing-ring',
  theme: 'soft',
  title: { zh: '软环弹跳', en: 'Bouncing Ring' },
  law: { zh: '弹性储能与回弹', en: 'Stored elastic energy' },
  blurb: { zh: '一个柔软的圆环落在倾斜的板上，被压扁、弹起、翻滚，在每次碰撞中储存又释放能量。', en: 'A soft ring drops onto tilted plates, flattening, springing back and tumbling down.' },
  duration: 11,
  energy: 3,
  endState: 'settle',
  setup(ctx) {
    const plates: MBody[] = [];
    plates.push(staticRect(ctx, 760, 520, 520, 22, 'structure', 0.3, { restitution: 0.6 }));
    plates.push(staticRect(ctx, 1240, 760, 520, 22, 'structure', -0.28, { restitution: 0.6 }));
    plates.push(...wallPath(ctx, arcPts(800, 760, 300, Math.PI * 0.2, Math.PI * 0.85, 10), 20));
    const blob = softBlob(ctx, 620, 120, 70, 0.3, 0.09);
    for (const p of blob) Body.setStatic(p, true);
    dolly(ctx, 960, 560, 0.98, 1.03);
    return {
      entry: { x: 760, y: 400 },
      floors: plates,
      enter: () => {
        for (const p of blob) Body.setStatic(p, false);
      },
    };
  },
};

export const SOFT: SceneDef[] = [softBloom, jellySteps, softCollide, ring];
