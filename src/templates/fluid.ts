import { W, type SceneDef } from '../core/types';
import { Bodies, afloat, ball, compound, dolly, polygon, rect, release, staticRect, water, type MBody, type Pt } from './kit';

/**
 * Archimedes — eight things of very different density are dropped into a tank one after another.
 * Each splashes in; the light ones bob up and float at exactly the depth their density asks for,
 * the heavy ones sink. The water level rises with every one.
 */
const archimedes: SceneDef = {
  id: 'archimedes',
  theme: 'fluid',
  title: { zh: '沉与浮', en: 'Sink or Float' },
  law: { zh: '阿基米德原理', en: "Archimedes' principle" },
  blurb: { zh: '软木、木条、冰块、砖头、石块、钢球……依次落进水箱：轻的浮起，按各自的密度露出不同的高度；重的沉底。每落进一样，水面都升高一点。', en: 'Cork, wood, ice, brick, stone and steel drop into a tank in turn: each floats at the depth its density demands, or sinks, and the water rises a little each time.' },
  duration: 13,
  energy: 2,
  endState: 'settle',
  setup(ctx) {
    const { tl } = ctx;
    const x0 = 330;
    const x1 = 1590;
    const level = 600;
    const bottom = 960;
    staticRect(ctx, x0 - 14, 760, 28, 440, 'structure');
    staticRect(ctx, x1 + 14, 760, 28, 440, 'structure');
    staticRect(ctx, W / 2, bottom + 14, x1 - x0 + 56, 28, 'structure');
    // Densities relative to water (0.002): cork 0.2, beach ball 0.1, wood 0.55, ice 0.9, brick 1.9, stone 2.6, steel 7.8.
    const things: MBody[] = [];
    const y = 210;
    const xs = [440, 590, 745, 900, 1060, 1215, 1370, 1490];
    const ph = (rel: number) => ({ isStatic: true, density: 0.002 * rel, friction: 0.4, restitution: 0.15, frictionAir: 0.001 });
    things.push(ball(ctx, xs[0], y, 34, { role: 'hero', hue: 0.05, weight: 1 }, ph(0.2)));
    things.push(rect(ctx, xs[1], y, 170, 44, { role: 'hero', hue: 0.18, weight: 1 }, ph(0.55)));
    things.push(rect(ctx, xs[2], y, 96, 96, { role: 'hero', hue: 0.55, weight: 1 }, { ...ph(0.9), chamfer: { radius: 16 } }));
    things.push(ball(ctx, xs[3], y, 52, { role: 'hero', hue: 0.85, weight: 1 }, ph(0.1)));
    things.push(rect(ctx, xs[4], y, 120, 54, { role: 'hero', hue: 0.32, weight: 1 }, ph(1.9)));
    things.push(polygon(ctx, xs[5], y, 6, 40, { role: 'hero', hue: 0.68, weight: 1 }, ph(2.6)));
    things.push(ball(ctx, xs[6], y, 28, { role: 'accent', weight: 1 }, ph(7.8)));
    things.push(rect(ctx, xs[7], y, 210, 26, { role: 'hero', hue: 0.42, weight: 1 }, ph(0.5)));
    water(ctx, { x0, x1, level, bottom });
    ctx.r.impactMin = 3.5;
    dolly(ctx, W / 2, 560, 0.97, 1.03, W / 2, 590);
    return {
      entry: { x: W / 2, y: level },
      enter: () => things.forEach((b, i) => tl.at(tl.t + 0.15 + i * 0.75, () => release(b))),
    };
  },
};

/**
 * Cargo Boat — a little hull floats on the air it encloses. Crates are lowered in one by one and
 * it settles deeper each time, until the last, heaviest one lists it past its gunwale: water pours
 * in, the air pocket floods and the boat goes down. The wooden crates float free.
 */
const cargoBoat: SceneDef = {
  id: 'cargo-boat',
  theme: 'fluid',
  title: { zh: '满载', en: 'Overloaded' },
  law: { zh: '排水量与稳性', en: 'Displacement and stability' },
  blurb: { zh: '小船靠船舱里的空气排开水而浮着。货箱一只只吊进船里，船越压越深；最后一只最重的压偏了船身，船舷没入水面，水灌进船舱，小船沉了下去，木箱却浮了上来。', en: 'A little hull floats on the air it holds. Crates go in one by one and it sinks deeper; the last, heaviest one lists it past the gunwale, water pours in and down it goes — the wooden crates float free.' },
  duration: 14,
  energy: 3,
  endState: 'settle',
  presettle: 1.2,
  setup(ctx) {
    const { tl } = ctx;
    const level = 640;
    const cx = W / 2;
    // The hull: a floor, two raked sides, and the air it encloses (a sensor part: it displaces water, cargo passes into it).
    const top = level - 120;
    const bw = 420;
    const h = 184;
    const lean = 34;
    const floorY = top + h;
    const hullParts = [
      Bodies.rectangle(cx, floorY, bw, 18),
      Bodies.fromVertices(cx - bw / 2 - lean / 2 + 4, top + h / 2, [[{ x: -lean / 2 - 9, y: -h / 2 }, { x: -lean / 2 + 9, y: -h / 2 }, { x: lean / 2 + 9, y: h / 2 }, { x: lean / 2 - 9, y: h / 2 }]]),
      Bodies.fromVertices(cx + bw / 2 + lean / 2 - 4, top + h / 2, [[{ x: lean / 2 - 9, y: -h / 2 }, { x: lean / 2 + 9, y: -h / 2 }, { x: -lean / 2 + 9, y: h / 2 }, { x: -lean / 2 - 9, y: h / 2 }]]),
    ];
    const airVerts: Pt[] = [
      { x: -bw / 2 - lean + 12, y: -h / 2 + 4 },
      { x: bw / 2 + lean - 12, y: -h / 2 + 4 },
      { x: bw / 2 - 10, y: h / 2 - 10 },
      { x: -bw / 2 + 10, y: h / 2 - 10 },
    ];
    const air = Bodies.fromVertices(cx, top + h / 2 - 4, [airVerts], { isSensor: true, density: 0.000001 });
    (air.plugin as { buoyancy?: number }).buoyancy = 1;
    const hull = compound(ctx, [...hullParts, air], { role: 'structure', weight: 1 }, { density: 0.0026, friction: 0.6, frictionAir: 0.002 });
    // Gunwale corners in the hull's own frame: when one dips below the water, it pours in.
    const gun = [
      { x: -bw / 2 - lean + 2 - hull.position.x + cx, y: top - hull.position.y },
      { x: bw / 2 + lean - 2 - hull.position.x + cx, y: top - hull.position.y },
    ];
    const sea = water(ctx, { x0: -500, x1: W + 500, level, bottom: 1300 });
    // A steel hull: heavier than water, it floats only on the air it encloses.
    afloat(hull, sea);
    // The seabed, out of sight below the frame.
    staticRect(ctx, W / 2, 1320, W + 1200, 40, 'ground');
    // Crates hang from the gantry in two rows, dropped one at a time: three on the lower row, then two above.
    const specs = [
      { w: 80, dx: 0, y: 440, rel: 1.6, hue: 0.1 },
      { w: 76, dx: -112, y: 440, rel: 1.2, hue: 0.32 },
      { w: 76, dx: 112, y: 440, rel: 1.2, hue: 0.12 },
      { w: 64, dx: -56, y: 300, rel: 0.6, hue: 0.36 },
      { w: 112, dx: 60, y: 280, rel: 4.2, hue: 0.9 },
    ];
    const crates = specs.map((s, i) => rect(ctx, cx + s.dx, s.y, s.w, s.w, { role: i === 4 ? 'accent' : 'hero', hue: s.hue, weight: 1 }, { isStatic: true, density: 0.002 * s.rel, friction: 0.7, restitution: 0.05 }));
    ctx.r.drawBack((g) => {
      const c = ctx.style.structure;
      g.moveTo(cx - 330, 150).lineTo(cx + 330, 150).stroke({ width: 10, color: c, alpha: 0.6, cap: 'round' });
      for (const q of specs as { dx: number; y: number; w: number; done?: boolean }[]) if (!q.done) g.moveTo(cx + q.dx, 150).lineTo(cx + q.dx, q.y - q.w / 2).stroke({ width: 2, color: c, alpha: 0.7 });
    });
    let flood = 0;
    ctx.force(() => {
      const c = Math.cos(hull.angle);
      const s = Math.sin(hull.angle);
      let depth = 0;
      for (const p of gun) {
        const y = hull.position.y + p.x * s + p.y * c;
        depth = Math.max(depth, y - sea.level);
      }
      if (depth > 0) flood = Math.min(1, flood + Math.min(depth, 40) * 0.0005);
      (air.plugin as { buoyancy?: number }).buoyancy = 1 - flood;
    });
    dolly(ctx, cx, 560, 1.02, 0.96, cx, 600);
    return {
      entry: { x: cx, y: level },
      enter: () =>
        crates.forEach((b, i) =>
          tl.at(tl.t + 0.3 + i * 1.6 + (i === 4 ? 0.6 : 0), () => {
            (specs[i] as { done?: boolean }).done = true;
            release(b);
          }),
        ),
    };
  },
};

export const FLUID: SceneDef[] = [archimedes, cargoBoat];
