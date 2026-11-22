import { H, W, type SceneDef } from '../core/types';
import { easeInOutSine } from '../core/ease';
import { Body, attract, circle, dolly, orbitSpeed, polygon, staticRect, wallPath, arcPts, type MBody } from './kit';

/** Kepler's Orrery — planets launched at different speeds trace closed ellipses around a star. */
const kepler: SceneDef = {
  id: 'kepler',
  theme: 'field',
  title: { zh: '开普勒行星仪', en: "Kepler's Orrery" },
  law: { zh: '万有引力 F ∝ 1/r²', en: 'Gravitation, F ∝ 1/r²' },
  blurb: { zh: '行星以略有不同的速度出发，画出椭圆：近日点疾行，远日点徐缓，轨道首尾相接。', en: 'Planets trace closed ellipses: fast near the star, slow far away.' },
  duration: 13,
  energy: 1,
  endState: 'periodic',
  movingStart: true,
  gravity: { x: 0, y: 0 },
  setup(ctx) {
    const { r } = ctx;
    const cx = W / 2;
    const cy = H / 2;
    const G = 1.5;
    const star = circle(ctx, cx, cy, 46, { role: 'accent', weight: 1, front: true, impacts: false }, { isStatic: true });
    const starView = r.views.get(star)!;
    const group = Body.nextGroup(true);
    const specs = [
      { r: 150, f: 1.0, size: 9, hue: 0.0 },
      { r: 220, f: 0.86, size: 11, hue: 0.2 },
      { r: 300, f: 1.12, size: 13, hue: 0.4 },
      { r: 390, f: 0.8, size: 15, hue: 0.6 },
      { r: 470, f: 0.95, size: 12, hue: 0.8 },
      { r: 520, f: 0.55, size: 7, hue: 1.0 },
    ];
    const bodies = specs.map((s, i) => {
      const a = i * 2.1;
      const b = circle(ctx, cx + Math.cos(a) * s.r, cy + Math.sin(a) * s.r, s.size, { role: 'hero', hue: s.hue, trail: 7, weight: 1, impacts: false }, { frictionAir: 0, collisionFilter: { group } });
      const v = orbitSpeed(G, s.r) * s.f;
      Body.setVelocity(b, { x: -Math.sin(a) * v, y: Math.cos(a) * v });
      return b;
    });
    dolly(ctx, cx, cy, 0.86, 0.95);
    return {
      entry: { x: cx, y: cy },
      step: (t) => {
        starView.scale = 1 + 0.03 * Math.sin(t * 2.2);
        for (const b of bodies) attract(b, cx, cy, G, 20);
      },
    };
  },
};

/** Binary Star — two suns circle their common centre; a disc of dust is shepherded around them. */
const binary: SceneDef = {
  id: 'binary-star',
  theme: 'field',
  title: { zh: '双星', en: 'Binary Star' },
  law: { zh: '二体引力与共同质心', en: 'Two bodies, one centre of mass' },
  blurb: { zh: '两颗恒星绕着共同质心旋转，外围一圈尘埃被它们的引力轮番牵引，搅出螺旋。', en: 'Two suns circle their shared centre while a ring of dust is tugged into spirals.' },
  duration: 13,
  energy: 2,
  endState: 'periodic',
  movingStart: true,
  gravity: { x: 0, y: 0 },
  setup(ctx) {
    const { rng } = ctx;
    const cx = W / 2;
    const cy = H / 2;
    const G = 1.2;
    const d = 62;
    const group = Body.nextGroup(true);
    const a = circle(ctx, cx - d, cy, 30, { role: 'accent', weight: 1, front: true, trail: 3, impacts: false }, { frictionAir: 0, collisionFilter: { group } });
    const b = circle(ctx, cx + d, cy, 22, { role: 'hero', hue: 0.1, weight: 1, front: true, trail: 3, impacts: false }, { frictionAir: 0, collisionFilter: { group } });
    // Mutual orbit: each star falls toward the other.
    const v = orbitSpeed(G, d) * 0.5;
    Body.setVelocity(a, { x: 0, y: -v });
    Body.setVelocity(b, { x: 0, y: v });
    const dust: MBody[] = [];
    for (let i = 0; i < 90; i++) {
      const ang = rng.range(0, Math.PI * 2);
      const rr = rng.range(330, 520);
      const p = circle(ctx, cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr, rng.range(3, 6), { role: 'hero', hue: 0.4 + rng.range(0, 0.5), trail: i % 3 === 0 ? 1.2 : false, impacts: false }, { frictionAir: 0, collisionFilter: { group } });
      const s = orbitSpeed(G * 2, rr);
      Body.setVelocity(p, { x: -Math.sin(ang) * s, y: Math.cos(ang) * s });
      dust.push(p);
    }
    dolly(ctx, cx, cy, 0.9, 1.0);
    return {
      entry: { x: cx, y: cy },
      step: () => {
        attract(a, b.position.x, b.position.y, G, 20);
        attract(b, a.position.x, a.position.y, G, 20);
        for (const p of dust) {
          attract(p, a.position.x, a.position.y, G, 30);
          attract(p, b.position.x, b.position.y, G, 30);
        }
      },
    };
  },
};

/** Coulomb Bowl — like charges confined in a round bowl push apart into concentric shells. */
const coulombBowl: SceneDef = {
  id: 'coulomb-bowl',
  theme: 'field',
  title: { zh: '库仑晶体', en: 'Coulomb Crystal' },
  law: { zh: '同号电荷相斥', en: 'Like charges repel' },
  blurb: { zh: '一群同号电荷被关进圆形容器，彼此排斥，在阻尼中排成整齐的同心壳层。', en: 'Like charges trapped in a round bowl push each other apart into neat concentric shells.' },
  duration: 13,
  energy: 1,
  endState: 'settle',
  gravity: { x: 0, y: 0 },
  setup(ctx) {
    const { rng, tl, r } = ctx;
    const cx = W / 2;
    const cy = H / 2;
    const R = 380;
    wallPath(ctx, arcPts(cx, cy, R + 12, 0, Math.PI * 2, 48), 20, 'structure', { restitution: 0.2 });
    const items: MBody[] = [];
    for (let i = 0; i < 46; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = Math.sqrt(rng.next()) * 120;
      items.push(circle(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, 13, { role: 'hero', hue: (d / 120) * 0.8, weight: 1 }, { frictionAir: 0.06, restitution: 0.2, density: 0.001 }));
    }
    r.impactMin = 6;
    let k = 0;
    dolly(ctx, cx, cy, 1.05, 1.0);
    return {
      entry: { x: cx, y: cy },
      enter: () => tl.during(tl.t, tl.t + 1.5, (p) => (k = easeInOutSine(p))),
      step: () => {
        if (k <= 0) return;
        const K = 0.5 * k;
        for (let i = 0; i < items.length; i++)
          for (let j = i + 1; j < items.length; j++) {
            const a = items[i];
            const b = items[j];
            const dx = b.position.x - a.position.x;
            const dy = b.position.y - a.position.y;
            const d2 = dx * dx + dy * dy;
            const d = Math.sqrt(d2) || 1;
            const f = K / (d2 + 400);
            Body.applyForce(a, a.position, { x: (-dx / d) * f, y: (-dy / d) * f });
            Body.applyForce(b, b.position, { x: (dx / d) * f, y: (dy / d) * f });
          }
      },
    };
  },
};

/** Ionic Clusters — opposite charges attract, like charges repel; chains and lattices assemble. */
const ionic: SceneDef = {
  id: 'coulomb',
  theme: 'field',
  title: { zh: '离子聚簇', en: 'Ionic Clusters' },
  law: { zh: '库仑定律 F ∝ q₁q₂/r²', en: "Coulomb's law" },
  blurb: { zh: '带电圆片悬浮在黏滞介质中：异性相吸、同性相斥，无序自发组织成链条与晶格。', en: 'Opposites attract, likes repel, and order assembles itself into chains and lattices.' },
  duration: 13,
  energy: 2,
  endState: 'settle',
  gravity: { x: 0, y: 0 },
  setup(ctx) {
    const { r, tl, rng } = ctx;
    const cx = W / 2;
    const cy = H / 2;
    const n = 72;
    const items: { b: MBody; q: number }[] = [];
    for (let i = 0; i < n; i++) {
      const q = i % 2 === 0 ? 1 : -1;
      const b = circle(ctx, cx + rng.range(-640, 640), cy + rng.range(-330, 330), 14, { role: 'hero', hue: q > 0 ? 0.05 : 0.62, weight: 1 }, { frictionAir: 0.06, restitution: 0.2, friction: 0.3, density: 0.001 });
      items.push({ b, q });
    }
    staticRect(ctx, cx, cy - 430, 1700, 20, 'structure', 0, { restitution: 0.3 });
    staticRect(ctx, cx, cy + 430, 1700, 20, 'structure', 0, { restitution: 0.3 });
    staticRect(ctx, cx - 850, cy, 20, 880, 'structure', 0, { restitution: 0.3 });
    staticRect(ctx, cx + 850, cy, 20, 880, 'structure', 0, { restitution: 0.3 });
    r.impactMin = 4;
    let k = 0;
    dolly(ctx, cx, cy, 1.0, 1.08);
    return {
      entry: { x: cx, y: cy },
      enter: () => tl.during(tl.t, tl.t + 1.5, (p) => (k = p)),
      step: () => {
        if (k <= 0) return;
        const K = 0.5 * k;
        for (let i = 0; i < n; i++) {
          const a = items[i];
          for (let j = i + 1; j < n; j++) {
            const b = items[j];
            const dx = b.b.position.x - a.b.position.x;
            const dy = b.b.position.y - a.b.position.y;
            const d2 = dx * dx + dy * dy;
            if (d2 > 420 * 420) continue;
            const d = Math.sqrt(d2) || 1;
            const f = (K * a.q * b.q) / (d2 + 400);
            Body.applyForce(a.b, a.b.position, { x: (-dx / d) * f, y: (-dy / d) * f });
            Body.applyForce(b.b, b.b.position, { x: (dx / d) * f, y: (dy / d) * f });
          }
        }
      },
    };
  },
};

/** Accretion — debris on plunging orbits falls onto a small core and builds a planet. */
const accretion: SceneDef = {
  id: 'accretion',
  theme: 'field',
  title: { zh: '吸积成星', en: 'Accretion' },
  law: { zh: '引力吸积', en: 'Gravitational accretion' },
  blurb: { zh: '碎片沿着坠落的轨道撞向小小的核心，非弹性碰撞耗散能量，碎片彼此粘合，一颗行星就此成形。', en: 'Debris on plunging orbits strikes a small core, sheds its energy and sticks: a planet forms.' },
  duration: 13,
  energy: 3,
  endState: 'settle',
  movingStart: true,
  gravity: { x: 0, y: 0 },
  setup(ctx) {
    const { rng } = ctx;
    const cx = W / 2;
    const cy = H / 2;
    const G = 2.2;
    circle(ctx, cx, cy, 54, { role: 'accent', weight: 1, impacts: false }, { isStatic: true, friction: 1, restitution: 0 });
    const debris: MBody[] = [];
    for (let i = 0; i < 130; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(240, 680);
      const size = rng.range(6, 15);
      const view = { role: 'hero' as const, hue: (a / (Math.PI * 2) + d / 1400) % 1, trail: i % 5 === 0 ? 0.8 : false };
      const ph = { frictionAir: 0, restitution: 0, friction: 0.9, frictionStatic: 2, density: 0.002 };
      const b = rng.next() < 0.35 ? polygon(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, rng.pick([3, 4, 5]), size * 1.3, view, ph) : circle(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, size, view, ph);
      const v = orbitSpeed(G, d) * rng.range(0.45, 0.8);
      Body.setVelocity(b, { x: -Math.sin(a) * v, y: Math.cos(a) * v });
      debris.push(b);
    }
    ctx.r.impactMin = 3;
    dolly(ctx, cx, cy, 0.82, 1.08);
    return { entry: { x: cx, y: cy }, step: () => debris.forEach((b) => attract(b, cx, cy, G, 20)) };
  },
};

export const FIELD: SceneDef[] = [kepler, binary, coulombBowl, ionic, accretion];
