import type { Graphics } from 'pixi.js';
import { fillShapes, jitter, path, srand, subdivide } from './draw';
import type { Pt, Shape, StyleDef } from './types';
import { traceSmooth } from '../render/SceneRenderer';

const SUMI = 0x1b1b1b;
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
    const density = role === 'hero' ? 0.78 : role === 'accent' ? 0.92 : role === 'debris' ? 0.55 : role === 'ground' ? 0.85 : 0.22;
    fillShapes(g, shapes, c, density);
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
