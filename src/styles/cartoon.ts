import { darken, lighten } from './color';
import { fillShapes, inset, path, strokeShapes } from './draw';
import type { StyleDef } from './types';

const LINE = 0x2b2d42;

export const cartoon: StyleDef = {
  id: 'cartoon',
  name: { zh: '简笔卡通', en: 'Cartoon' },
  mood: { zh: '粗描边、明快平涂、会被挤扁的弹跳与云朵天空', en: 'Bold outlines, bright flat colour, squashy bounces and a cloud-dotted sky' },
  font: '"Nunito", "Varela Round", "PingFang SC", "Microsoft YaHei", sans-serif',
  text: LINE,
  accent: '#ff6b6b',
  ramp: [0xff6b6b, 0xffb347, 0xffd93d, 0x6bcb77, 0x4d96ff, 0xc77dff],
  accentColor: 0xff6b6b,
  structure: 0x5c6b8a,
  ground: 0x7cc576,
  backgrounds: [
    { id: 'sky', name: { zh: '晴空云朵', en: 'Cloudy Sky' }, mode: 16, colors: [0x8fd3ff, 0xd6f1ff, 0xffffff] },
    { id: 'sunburst', name: { zh: '放射阳光', en: 'Sunburst' }, mode: 17, colors: [0xffe6a8, 0xffd27a, 0xfff6dc] },
  ],
  blend: 'normal',
  flashBlend: 'normal',
  squash: true,
  shadow: { dx: 0, dy: 12, alpha: 0.18, soft: 8, color: 0x1d2b4f },
  trail: { kind: 'crisp', width: 9, alpha: 0.35, length: 14, blend: 'normal' },
  particleKinds: ['dot', 'shard'],
  particleBlend: 'normal',

  drawBody(g, shapes, look) {
    const c = look.color;
    const role = look.role;
    if (role === 'ground') {
      fillShapes(g, shapes, c, 1);
      for (const s of shapes) {
        if (s.kind !== 'poly') continue;
        const top = Math.min(...s.pts.map((p) => p.y));
        const xs = s.pts.map((p) => p.x);
        g.rect(Math.min(...xs), top, Math.max(...xs) - Math.min(...xs), 10).fill({ color: lighten(c, 0.25) });
      }
      strokeShapes(g, shapes, 4, darken(c, 0.45), 1);
      return;
    }
    const fill = role === 'structure' ? c : c;
    fillShapes(g, shapes, fill, 1);
    for (const s of shapes) {
      if (s.kind === 'circle') {
        const x = s.x ?? 0;
        const y = s.y ?? 0;
        // Shade on the lower right, a crisp shine on the upper left.
        g.circle(x + s.r * 0.18, y + s.r * 0.2, s.r * 0.78).fill({ color: darken(fill, 0.12), alpha: 0.45 });
        g.circle(x - s.r * 0.08, y - s.r * 0.1, s.r * 0.72).fill({ color: fill });
        if (s.r > 7) g.ellipse(x - s.r * 0.38, y - s.r * 0.42, s.r * 0.2, s.r * 0.13).fill({ color: 0xffffff, alpha: 0.9 });
      } else if (s.kind === 'poly' && role !== 'structure') {
        g.poly(inset(s.pts, 0.72).flatMap((p) => [p.x, p.y]), true).fill({ color: lighten(fill, 0.18), alpha: 0.55 });
      } else if (s.kind === 'blob') {
        g.poly(inset(s.pts, 0.7).flatMap((p) => [p.x, p.y]), true).fill({ color: lighten(fill, 0.2), alpha: 0.4 });
      }
    }
    strokeShapes(g, shapes, role === 'structure' ? 3.5 : 4.5, LINE, 1);
  },
  drawFlash(g, shapes) {
    fillShapes(g, shapes, 0xffffff, 0.55);
  },
  drawLink(g, pts, look, w) {
    path(g, pts).stroke({ width: w + 4, color: LINE, alpha: 1, cap: 'round', join: 'round' });
    path(g, pts).stroke({ width: Math.max(1, w), color: lighten(look.color, 0.2), alpha: 1, cap: 'round', join: 'round' });
  },
  impact(fx, x, y, s, color) {
    fx.burst({ x, y, n: 2 + Math.round(s * 5), speed: [40, 90 + 160 * s], life: [0.35, 0.6], size: [16, 26 + 20 * s], color: 0xffffff, kind: 'dot', drag: 0.05, grow: 1.7, alpha: 0.85 });
    if (s > 0.35) fx.burst({ x, y, n: 2 + Math.round(s * 4), speed: [160, 320 + 260 * s], life: [0.4, 0.7], size: [12, 20], color: [0xffd93d, color], kind: 'shard', drag: 0.1, gravity: 600, spin: [4, 9] });
    if (s > 0.55) fx.ring({ x, y, r1: 26 + 50 * s, width: 4, color: LINE, life: 0.3 });
  },
  finish: { grain: 0.012, vignette: 0.18, contrast: 1.04, saturation: 1.08, vignetteColor: 0x2d3a5c },
};
