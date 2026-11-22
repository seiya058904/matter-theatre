import { W, type SceneDef } from '../core/types';
import { Body, Composite, Constraint, circle, dolly, ground, pin, rect, release, rope, staticCircle, staticRect, wallPath, type MBody } from './kit';

/** Rope Bridge — balls roll across a plank bridge slung between two cliffs; the deck ripples. */
const bridge: SceneDef = {
  id: 'rope-bridge',
  theme: 'rope',
  title: { zh: '吊桥滚球', en: 'Rope Bridge' },
  law: { zh: '张力与悬链', en: 'Tension and the catenary' },
  blurb: { zh: '木板吊桥横跨两崖，几颗球依次滚过，桥面随之起伏摇荡。', en: 'Balls roll across a plank bridge slung between cliffs; the deck ripples under each one.' },
  duration: 12,
  energy: 2,
  endState: 'settle',
  presettle: 0.8,
  setup(ctx) {
    const { world, r, tl } = ctx;
    const left = { x: 400, y: 560 };
    const right = { x: 1520, y: 560 };
    staticRect(ctx, left.x - 220, left.y + 240, 440, 480, 'ground');
    staticRect(ctx, right.x + 220, right.y + 240, 440, 480, 'ground');
    staticRect(ctx, 160, 420, 520, 18, 'structure', 0.28, { friction: 0.02 });
    const n = 16;
    const pw = (right.x - left.x) / n;
    const group = Body.nextGroup(true);
    const planks: MBody[] = [];
    for (let i = 0; i < n; i++) {
      const p = rect(ctx, left.x + pw * (i + 0.5), left.y, pw - 4, 14, { role: 'debris', hue: i / (n - 1) }, { density: 0.002, friction: 0.8, frictionAir: 0.01, collisionFilter: { group } });
      planks.push(p);
    }
    for (let i = 0; i < n - 1; i++) Composite.add(world, Constraint.create({ bodyA: planks[i], bodyB: planks[i + 1], pointA: { x: pw / 2 - 2, y: 0 }, pointB: { x: -pw / 2 + 2, y: 0 }, length: 4, stiffness: 0.9 }));
    pin(ctx, planks[0], left.x, left.y, { pointB: { x: -pw / 2 + 2, y: 0 }, length: 2 }, false);
    pin(ctx, planks[n - 1], right.x, right.y, { pointB: { x: pw / 2 - 2, y: 0 }, length: 2 }, false);
    r.link(() => [left, ...planks.map((p) => r.ipos(p)), right], 'structure', 2);
    const balls = [0, 1, 2].map((i) => circle(ctx, 60 + i * 50, 270 - i * 20, 26 - i * 3, { role: 'hero', hue: 0.15 + i * 0.3, trail: 1.5, weight: 1 }, { isStatic: true, density: 0.003, friction: 0.6, restitution: 0.2 }));
    dolly(ctx, W / 2, 520, 0.98, 1.04);
    return { entry: { x: W / 2, y: left.y }, enter: () => balls.forEach((b, i) => tl.at(tl.t + i * 1.6, () => release(b))) };
  },
};

/** Chain Slide — a chain lying on a high shelf is pulled off by its own hanging end. */
const chainSlide: SceneDef = {
  id: 'chain-slide',
  theme: 'rope',
  title: { zh: '滑落之链', en: 'Chain Slide' },
  law: { zh: '变质量系统的加速', en: 'A chain pulling itself off' },
  blurb: { zh: '长链平放在高架上，垂下的一端越来越重，把整条链越拉越快地拖下高台。', en: 'The hanging end of a chain grows heavier and drags the rest off the shelf faster and faster.' },
  duration: 11,
  energy: 3,
  endState: 'settle',
  presettle: 0.8,
  canDrop: true,
  setup(ctx) {
    const shelfY = 380;
    const slick = { friction: 0, frictionStatic: 0 };
    staticRect(ctx, 760, shelfY + 12, 1000, 24, 'structure', 0, slick);
    staticCircle(ctx, 1248, shelfY + 12, 12, 'structure', slick);
    const fl = ground(ctx, 980, 5000);
    wallPath(ctx, [{ x: 1150, y: 760 }, { x: 1180, y: 965 }, { x: 1500, y: 965 }, { x: 1530, y: 760 }], 14);
    // 44 links laid along the shelf; the last seven already hang over the rounded edge.
    const n = 44;
    const seg = 21.4;
    const corner = 37;
    const x0 = 1252 - corner * seg;
    const links = rope(ctx, { x: x0, y: shelfY - 7 }, { x: x0 + n * seg, y: shelfY - 7 }, n, { r: 7, pinA: false, density: 0.004, width: 5, role: 'hero', hue: 0.3 });
    for (let i = corner + 1; i <= n; i++) Body.setPosition(links[i], { x: 1268, y: shelfY - 7 + (i - corner) * seg });
    for (const l of links) Body.set(l, slick);
    const tip = circle(ctx, 1268, shelfY - 7 + (n - corner + 1) * seg, 11, { role: 'accent', weight: 1, trail: 2 }, { density: 0.004, ...slick });
    Composite.add(ctx.world, Constraint.create({ bodyA: links[n], bodyB: tip, length: seg, stiffness: 1 }));
    Body.setStatic(links[0], true);
    dolly(ctx, 1000, 560, 1.0, 0.94, 1100, 600);
    return { entry: { x: 1252, y: shelfY }, floors: [fl], enter: () => release(links[0]) };
  },
};

/** Bead Curtain — a pendulum ball swings through strings of beads. */
const curtain: SceneDef = {
  id: 'bead-curtain',
  theme: 'rope',
  title: { zh: '珠帘', en: 'Bead Curtain' },
  law: { zh: '碰撞与悬挂摆动', en: 'Impacts on hanging strings' },
  blurb: { zh: '十二串珠帘静静垂挂，一颗摆锤从侧面荡过，珠串依次被拨开，又摇摆着落回。', en: 'A pendulum ball swings through twelve strings of beads, which part and sway back.' },
  duration: 12,
  energy: 2,
  endState: 'periodic',
  setup(ctx) {
    const { r } = ctx;
    const top = 200;
    for (let i = 0; i < 12; i++) {
      const x = 700 + i * 48;
      const nodes = rope(ctx, { x, y: top }, { x, y: top + 420 }, 9, { r: 9, density: 0.002, width: 2, role: 'structure' });
      nodes.forEach((n, k) => {
        if (k > 0) r.body(n, { role: 'hero', hue: (i / 11 + k * 0.03) % 1, impacts: k === 9 });
      });
    }
    r.drawBack((g) => g.roundRect(660, top - 14, 600, 12, 6).fill({ color: ctx.style.structure, alpha: 0.7 }));
    const pivot = { x: 980, y: -120 };
    const len = 700;
    const ang = -0.85;
    const ball = circle(ctx, pivot.x + Math.sin(ang) * len, pivot.y + Math.cos(ang) * len, 40, { role: 'accent', trail: 1.6, weight: 1 }, { isStatic: true, density: 0.006, frictionAir: 0.0005 });
    pin(ctx, ball, pivot.x, pivot.y, { length: len }, 'structure', 2);
    dolly(ctx, W / 2, 480, 1.0, 1.06);
    return { entry: { x: 980, y: 420 }, enter: () => release(ball) };
  },
};

/** Rope Drape — a rope held straight is let go over a field of pegs and drapes into a drawing. */
const drape: SceneDef = {
  id: 'rope-drape',
  theme: 'rope',
  title: { zh: '绳落钉阵', en: 'Rope Drape' },
  law: { zh: '柔性体在重力下成形', en: 'A flexible body finds its shape' },
  blurb: { zh: '一条绷直的长绳被松开，落在疏落的钉阵上，自然缠挂成一幅线描。', en: 'A rope held straight is let go over scattered pegs and drapes itself into a line drawing.' },
  duration: 11,
  energy: 1,
  endState: 'settle',
  setup(ctx) {
    const { rng } = ctx;
    for (let i = 0; i < 26; i++) staticCircle(ctx, 360 + rng.range(0, 1200), 420 + rng.range(0, 420), rng.range(8, 16), 'structure', { friction: 0.6 });
    staticRect(ctx, W / 2, 990, 1500, 20, 'ground');
    const links = rope(ctx, { x: 300, y: 250 }, { x: 1620, y: 250 }, 60, { r: 6, pinA: false, density: 0.003, width: 4, role: 'hero', hue: 0.4 });
    for (const l of links) Body.setStatic(l, true);
    dolly(ctx, W / 2, 560, 0.98, 1.05);
    return { entry: { x: W / 2, y: 250 }, enter: () => release(...links) };
  },
};

export const ROPE: SceneDef[] = [bridge, chainSlide, curtain, drape];
