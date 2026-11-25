import type { Graphics } from 'pixi.js';
import { centroid, fillShapes, jitter, path, scaleShape, sizeOf, srand, subdivide } from './draw';
import type { Pt, Shape, StyleDef } from './types';
import { traceSmooth } from '../render/SceneRenderer';

const SUMI = 0x1b1b1b;
const PAPER = 0xefe8d9;
const CINNABAR = 0xb8322a;

function brush(g: Graphics, s: Shape, seed: number, width: number, alpha: number, color: number): void {
  if (s.kind === 'circle') {
    // Ensō: an open circle drawn in one breath, thick to thin.
    const x = s.x ?? 0;
    const y = s.y ?? 0;
    const a0 = seed * Math.PI * 2;
    const segs = 10;
    const span = Math.PI * 1.82;
    for (let i = 0; i < segs; i++) {
      const t0 = i / segs;
      const t1 = (i + 1) / segs;
      const r = s.r * (1 + 0.03 * Math.sin(i + seed * 9));
      g.moveTo(x + Math.cos(a0 + span * t0) * r, y + Math.sin(a0 + span * t0) * r);
      g.arc(x, y, r, a0 + span * t0, a0 + span * t1);
      g.stroke({ width: width * (1.6 - t0 * 1.2), color, alpha: alpha * (1 - t0 * 0.35), cap: 'round' });
    }
    return;
  }
  const pts = s.kind === 'blob' ? s.pts : subdivide(s.pts, 16);
  const j = jitter(pts, Math.min(3.5, width * 1.1), seed * 13);
  if (s.kind === 'blob') traceSmooth(g, j).stroke({ width, color, alpha, join: 'round' });
  else path(g, j, true).stroke({ width, color, alpha, join: 'round', cap: 'round' });
}

export const ink: StyleDef = {
  id: 'ink',
  name: { zh: '水墨', en: 'Ink Wash' },
  mood: { zh: '墨分五色，留痕于宣纸', en: 'Five shades of ink, traces left on rice paper' },
  font: '"STKaiti", "KaiTi", "Kaiti SC", serif',
  text: 0x1f1f1f,
  accent: '#c0392b',
  ramp: [0x161616, 0x2f2f2f, 0x4a4a4a, 0x262626],
  accentColor: CINNABAR,
  structure: 0x4a4a4a,
  ground: 0x2a2a2a,
  backgrounds: [
    { id: 'rice', name: { zh: '宣纸', en: 'Rice Paper' }, mode: 6, colors: [0xefe8d9, 0x3a3a3a, 0x000000] },
    { id: 'mountain', name: { zh: '远山', en: 'Distant Peaks' }, mode: 7, colors: [0xf1ebdf, 0x2e3838, 0x000000] },
  ],
  blend: 'normal',
  flashBlend: 'normal',
  trail: { kind: 'brush', width: 18, alpha: 0.3, length: 60, blend: 'normal' },
  particleKinds: ['blot', 'mote'],
  particleBlend: 'normal',
  water: { color: 0x55615f, alpha: 0.16 },

  drawBody(g, shapes, look) {
    const c = look.color;
    const role = look.role;
    const base = role === 'hero' ? 0.78 : role === 'accent' ? 0.92 : role === 'debris' ? 0.55 : role === 'ground' ? 0.85 : 0.22;
    const loaded = role === 'hero' || role === 'debris';
    // Shades of ink: each piece is laid with a wetter or drier brush (the body cache keeps a few tones).
    const density = loaded ? Math.min(0.95, base * (0.7 + 0.5 * srand(look.seed, 3))) : base;
    // Wet ink bleeds a little into the paper around the stroke.
    if (loaded || role === 'accent') fillShapes(g, shapes.map((s) => scaleShape(s, 1 + 3 / Math.max(6, sizeOf(s)))), c, 0.1);
    fillShapes(g, shapes, c, density);
    if (loaded)
      shapes.forEach((s, i) => {
        // Dry brush (feibai): the paper shows through in streaks along the stroke.
        if (s.kind !== 'poly' || sizeOf(s) < 14) return;
        const o = s.pts;
        const ctr = centroid(o);
        // The brush travels along the piece's longest edge.
        let ux = 1, uy = 0, len = 0;
        for (let k = 0; k < o.length; k++) {
          const a = o[k], b = o[(k + 1) % o.length];
          const d = Math.hypot(b.x - a.x, b.y - a.y);
          if (d > len) [len, ux, uy] = [d, (b.x - a.x) / d, (b.y - a.y) / d];
        }
        const thick = Math.min(...o.map((p) => Math.abs((p.x - ctr.x) * -uy + (p.y - ctr.y) * ux))) || sizeOf(s) * 0.3;
        const span = Math.max(...o.map((p) => Math.abs((p.x - ctr.x) * ux + (p.y - ctr.y) * uy)));
        for (let k = 0; k < 2; k++) {
          const off = (srand(look.seed + i, k + 17) - 0.5) * 1.4 * thick;
          const l0 = -span * (0.55 + 0.3 * srand(look.seed + i, k + 5));
          const l1 = span * (0.35 + 0.45 * srand(look.seed + i, k + 11));
          path(g, [
            { x: ctr.x + ux * l0 - uy * off, y: ctr.y + uy * l0 + ux * off },
            { x: ctr.x + ux * l1 - uy * off, y: ctr.y + uy * l1 + ux * off },
          ]).stroke({ width: 1 + srand(look.seed + i, k + 23) * 1.2, color: PAPER, alpha: 0.2, cap: 'round' });
        }
      });
    shapes.forEach((s, i) => {
      brush(g, s, look.seed + i * 0.17, role === 'structure' ? 2.2 : 3, 0.9, role === 'accent' ? c : SUMI);
      if (role !== 'ground' && s.kind !== 'circle' && s.kind !== 'blob') brush(g, s, look.seed + 0.5 + i, 1, 0.35, SUMI);
    });
  },
  drawFlash(g, shapes) {
    fillShapes(g, shapes, CINNABAR, 0.3);
  },
  drawLink(g, pts, look, w) {
    const j: Pt[] = pts.map((p, i) => ({ x: p.x + (srand(look.seed, i) - 0.5) * 1.5, y: p.y + (srand(look.seed, i + 9) - 0.5) * 1.5 }));
    path(g, j).stroke({ width: w + 1, color: SUMI, alpha: 0.85, cap: 'round', join: 'round' });
  },
  impact(fx, x, y, s, color) {
    fx.burst({ x, y, n: 1 + Math.round(s * 5), speed: [30, 70 + 220 * s], life: [1.4, 2.6], size: [6, 8 + 12 * s], color: color === CINNABAR ? color : SUMI, kind: 'blot', drag: 0.01, alpha: 0.7, grow: 1.25 });
    fx.burst({ x, y, n: Math.round(s * 8), speed: [200, 560], life: [0.8, 1.5], size: [2, 5], color: SUMI, kind: 'mote', drag: 0.004, alpha: 0.65 });
  },
  finish: { grain: 0.03, vignette: 0.35, paper: 0.9, contrast: 1.05, saturation: 0.85, vignetteColor: 0x6b6050 },
};
