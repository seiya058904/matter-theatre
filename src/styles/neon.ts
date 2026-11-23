import { lighten } from './color';
import { fillShapes, glow, glowLine, path, strokeShapes } from './draw';
import type { StyleDef } from './types';

export const neon: StyleDef = {
  id: 'neon',
  name: { zh: '霓虹夜光', en: 'Neon Noir' },
  mood: { zh: '发光线框、流光拖尾与午夜极光', en: 'Glowing wireframes, light trails and midnight aurora' },
  font: '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
  text: 0xe6ecff,
  accent: '#3df0ff',
  ramp: [0x00e5ff, 0x4d7cff, 0xb44dff, 0xff3db8, 0xffb347],
  accentColor: 0xfff3a0,
  structure: 0x5868ff,
  ground: 0x3a44a8,
  backgrounds: [
    { id: 'aurora', name: { zh: '午夜极光', en: 'Midnight Aurora' }, mode: 0, colors: [0x03040c, 0x0b0a26, 0x1fe6c0] },
    { id: 'horizon', name: { zh: '网格地平线', en: 'Grid Horizon' }, mode: 1, colors: [0x06021a, 0x2a0a3e, 0xff3dc8] },
  ],
  blend: 'add',
  trail: { kind: 'soft', width: 14, alpha: 0.85, length: 30, blend: 'add' },
  particleKinds: ['spark', 'dot'],
  particleBlend: 'add',
  water: { color: 0x2fd8ff, alpha: 0.13 },

  drawBody(g, shapes, look) {
    const c = look.color;
    if (look.role === 'ground') {
      fillShapes(g, shapes, c, 0.06);
      strokeShapes(g, shapes, 1.6, c, 0.6);
      return;
    }
    const structural = look.role === 'structure';
    glow(g, shapes, c, structural ? 0.5 : 1);
    fillShapes(g, shapes, c, structural ? 0.06 : 0.14);
    strokeShapes(g, shapes, structural ? 1.8 : 2.4 + (look.weight ?? 0) * 1.2, c, 0.95);
    strokeShapes(g, shapes, 1, lighten(c, 0.75), structural ? 0.3 : 0.75);
    for (const s of shapes) {
      if (s.kind === 'circle' && s.r > 9 && !structural) {
        // A small marker light near the rim: it shows the spin without looking like a clock hand.
        const x = s.x ?? 0;
        const y = s.y ?? 0;
        const d = s.r * 0.62;
        g.circle(x + d, y, Math.max(1.6, s.r * 0.11)).fill({ color: lighten(c, 0.8), alpha: 0.9 });
        g.circle(x + d, y, Math.max(3, s.r * 0.22)).fill({ color: c, alpha: 0.18 });
      }
    }
  },
  drawFlash(g, shapes, look) {
    fillShapes(g, shapes, lighten(look.color, 0.55), 0.5);
  },
  drawLink(g, pts, look, w) {
    glowLine(g, pts, look.color, w, 0.8);
    path(g, pts).stroke({ width: w, color: look.color, alpha: 0.8, cap: 'round', join: 'round' });
  },
  impact(fx, x, y, s, color) {
    fx.burst({ x, y, n: 2 + Math.round(s * 10), speed: [120, 200 + 700 * s], life: [0.2, 0.45], size: [5, 11], color: [color, lighten(color, 0.4)], kind: 'spark', stretch: 3, drag: 0.02, alpha: 0.85 });
    if (s > 0.15) fx.ring({ x, y, r1: 22 + 110 * s, width: 1.2 + 2 * s, color, life: 0.45 + 0.3 * s });
  },
  finish: { grain: 0.04, vignette: 0.55, chroma: 1.4, contrast: 1.06, saturation: 1.1, vignetteColor: 0x010108, halo: 0.55 },
};
