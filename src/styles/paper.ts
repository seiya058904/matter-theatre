import { darken, lighten } from './color';
import { centroid, fillShapes, outline, path, scaleShape, sizeOf, srand, strokeShapes, traceShape } from './draw';
import type { StyleDef } from './types';

export const paper: StyleDef = {
  id: 'paper',
  name: { zh: '纸艺剪影', en: 'Paper Craft' },
  mood: { zh: '层叠剪纸、柔和投影与缝线轨迹', en: 'Layered cut paper, soft shadows and stitched paths' },
  font: '"Georgia", "Songti SC", "SimSun", serif',
  text: 0x3d3027,
  accent: '#e76f51',
  ramp: [0xe76f51, 0xf4a261, 0xe9c46a, 0x2a9d8f, 0x264653],
  accentColor: 0xd62828,
  structure: 0x8d7b68,
  ground: 0xc9b393,
  backgrounds: [
    { id: 'fibre', name: { zh: '手工纸纤维', en: 'Handmade Sheet' }, mode: 2, colors: [0xf4ede1, 0xe2d3bb, 0xfff4dc] },
    { id: 'hills', name: { zh: '剪纸山丘', en: 'Paper Hills' }, mode: 3, colors: [0xfbefdc, 0xf2c6a0, 0x4f7f78] },
  ],
  blend: 'normal',
  shadow: { dx: 6, dy: 10, alpha: 0.2, soft: 10, color: 0x3a2412 },
  trail: { kind: 'dash', width: 5, alpha: 0.55, length: 40, blend: 'normal' },
  particleKinds: ['flake'],
  particleBlend: 'normal',
  water: { color: 0x7fb9c8, alpha: 0.5 },

  drawBody(g, shapes, look) {
    const c = look.color;
    const piece = look.role !== 'ground';
    // The sheet behind: every cut piece sits on a slightly larger, darker layer of card.
    if (piece) strokeShapes(g, shapes, 4, darken(c, 0.32), 1);
    fillShapes(g, shapes, c, 1);
    shapes.forEach((s, i) => {
      if (!piece || sizeOf(s) < 11) return;
      // A second, lighter piece glued on top (hero bodies), and the fibres of the card.
      if (look.role === 'hero' || look.role === 'accent') {
        const top = scaleShape(s, 0.68);
        traceShape(g, top).fill({ color: lighten(c, 0.14), alpha: 0.75 });
        traceShape(g, top).stroke({ width: 1, color: darken(c, 0.2), alpha: 0.35, join: 'round' });
      }
      const o = outline(s);
      const ctr = centroid(o);
      const n = Math.min(7, 2 + Math.round(sizeOf(s) / 14));
      for (let k = 0; k < n; k++) {
        const p = o[Math.floor(srand(look.seed + i, k) * o.length)];
        const t = 0.15 + 0.6 * srand(look.seed + i, k + 31);
        const x = ctr.x + (p.x - ctr.x) * t;
        const y = ctr.y + (p.y - ctr.y) * t;
        const a = srand(look.seed + i, k + 57) * Math.PI;
        const l = 2 + srand(look.seed + i, k + 83) * Math.min(7, sizeOf(s) * 0.25);
        g.moveTo(x - Math.cos(a) * l, y - Math.sin(a) * l).lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l).stroke({ width: 0.8, color: lighten(c, 0.35), alpha: 0.4, cap: 'round' });
      }
    });
    for (const s of shapes) {
      if (s.kind === 'poly' && look.role === 'ground') {
        const top = Math.min(...s.pts.map((p) => p.y));
        const xs = s.pts.map((p) => p.x);
        g.moveTo(Math.min(...xs), top + 3).lineTo(Math.max(...xs), top + 3).stroke({ width: 2, color: lighten(c, 0.4), alpha: 0.6 });
      } else if (s.kind === 'circle' && s.r > 8) {
        // A cut disc catches the light along its upper edge.
        const x = s.x ?? 0;
        const y = s.y ?? 0;
        g.moveTo(x + Math.cos(-2.6) * s.r * 0.8, y + Math.sin(-2.6) * s.r * 0.8)
          .arc(x, y, s.r * 0.8, -2.6, -1.1)
          .stroke({ width: Math.max(1.5, s.r * 0.08), color: lighten(c, 0.45), alpha: 0.55, cap: 'round' });
      }
    }
    // A thin darker cut edge, as on real card.
    strokeShapes(g, shapes, 1.3, darken(c, 0.25), 0.5);
  },
  drawFlash(g, shapes) {
    fillShapes(g, shapes, 0xfff8e8, 0.35);
  },
  drawLink(g, pts, look, w) {
    path(g, pts).stroke({ width: Math.max(1.2, w * 0.8), color: darken(look.color, 0.35), alpha: 0.9, cap: 'round', join: 'round' });
  },
  impact(fx, x, y, s, color) {
    fx.burst({ x, y, n: 2 + Math.round(s * 9), speed: [80, 140 + 320 * s], life: [0.9, 1.7], size: [9, 16], color: [color, lighten(color, 0.3), 0xfff4e0], kind: 'flake', gravity: 520, drag: 0.25, flutter: true, spin: [2, 7] });
  },
  finish: { grain: 0.025, vignette: 0.3, paper: 0.7, contrast: 1.0, saturation: 0.96, vignetteColor: 0x5a4632 },
};
