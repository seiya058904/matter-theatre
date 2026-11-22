import { darken, lighten } from './color';
import { fillShapes, path, strokeShapes } from './draw';
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

  drawBody(g, shapes, look) {
    const c = look.color;
    fillShapes(g, shapes, c, 1);
    strokeShapes(g, shapes, 1.4, darken(c, 0.22), 0.55);
    for (const s of shapes) {
      if (s.kind === 'circle') {
        g.circle(s.x ?? 0, s.y ?? 0, s.r * 0.62).stroke({ width: 1, color: darken(c, 0.15), alpha: 0.3 });
      } else if (s.kind === 'poly' && look.role === 'ground') {
        const top = Math.min(...s.pts.map((p) => p.y));
        const xs = s.pts.map((p) => p.x);
        g.moveTo(Math.min(...xs), top + 3).lineTo(Math.max(...xs), top + 3).stroke({ width: 2, color: lighten(c, 0.4), alpha: 0.6 });
      } else if (s.kind === 'poly' && s.pts.length >= 4) {
        const a = s.pts[0];
        const b = s.pts[Math.floor(s.pts.length / 2)];
        g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 1, color: lighten(c, 0.35), alpha: 0.3 });
      }
    }
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
