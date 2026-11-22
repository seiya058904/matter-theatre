import { lighten } from './color';
import { fillShapes, glow, inset, path, strokeShapes } from './draw';
import type { StyleDef } from './types';

export const glass: StyleDef = {
  id: 'glass',
  name: { zh: '琉璃', en: 'Crystal Glass' },
  mood: { zh: '半透明晶体、边缘高光与水下焦散', en: 'Translucent crystal, rim highlights and underwater caustics' },
  font: '"Segoe UI Light", "PingFang SC", "Microsoft YaHei Light", sans-serif',
  text: 0xeef4ff,
  accent: '#9d8cff',
  ramp: [0x7ef9ff, 0x9d8cff, 0xff9de2, 0xfff1a8, 0x7ef9ff],
  accentColor: 0xffffff,
  structure: 0x90a8cc,
  ground: 0x7286aa,
  backgrounds: [
    { id: 'caustic', name: { zh: '深水焦散', en: 'Deep Caustics' }, mode: 10, colors: [0x040a18, 0x0a2340, 0x6fe3ff] },
    { id: 'prism', name: { zh: '棱镜光谱', en: 'Prism Light' }, mode: 11, colors: [0x06060e, 0x151536, 0xa58cff] },
  ],
  blend: 'normal',
  trail: { kind: 'soft', width: 10, alpha: 0.5, length: 26, blend: 'add' },
  particleKinds: ['shard', 'dot'],
  particleBlend: 'add',

  drawBody(g, shapes, look) {
    const c = look.color;
    const structural = look.role === 'structure' || look.role === 'ground';
    if (!structural) glow(g, shapes, lighten(c, 0.3), 0.6);
    fillShapes(g, shapes, c, structural ? 0.12 : 0.24);
    fillShapes(g, shapes.map((s) => (s.kind === 'circle' ? { ...s, r: s.r * 0.55 } : s.kind === 'poly' ? { ...s, pts: inset(s.pts, 0.55) } : s)), lighten(c, 0.4), structural ? 0.04 : 0.1);
    strokeShapes(g, shapes, 2, lighten(c, 0.35), structural ? 0.5 : 0.9);
    for (const s of shapes) {
      if (s.kind === 'circle') {
        const x = s.x ?? 0;
        const y = s.y ?? 0;
        g.moveTo(x + Math.cos(-2.7) * s.r * 0.74, y + Math.sin(-2.7) * s.r * 0.74);
        g.arc(x, y, s.r * 0.74, -2.7, -1.5).stroke({ width: Math.max(2, s.r * 0.12), color: 0xffffff, alpha: 0.75, cap: 'round' });
        g.circle(x + s.r * 0.35, y + s.r * 0.4, Math.max(1.5, s.r * 0.08)).fill({ color: 0xffffff, alpha: 0.5 });
      } else if (s.kind === 'poly') {
        const q = inset(s.pts, 0.78);
        path(g, [q[q.length - 1], q[0]]).stroke({ width: 2.5, color: 0xffffff, alpha: 0.6, cap: 'round' });
        strokeShapes(g, [{ kind: 'poly', pts: q }], 1, 0xffffff, 0.16);
      }
    }
  },
  drawFlash(g, shapes) {
    fillShapes(g, shapes, 0xffffff, 0.4);
  },
  drawLink(g, pts, look, w) {
    path(g, pts).stroke({ width: Math.max(1, w * 0.7), color: lighten(look.color, 0.5), alpha: 0.7, cap: 'round', join: 'round' });
  },
  impact(fx, x, y, s, color) {
    fx.burst({ x, y, n: 1 + Math.round(s * 8), speed: [100, 180 + 420 * s], life: [0.5, 1.0], size: [4, 9], color: [lighten(color, 0.5), lighten(color, 0.2)], kind: 'shard', gravity: 700, drag: 0.3, spin: [4, 12], alpha: 0.75 });
    fx.ring({ x, y, r1: 18 + 80 * s, width: 1.2, color: 0xffffff, life: 0.5 });
  },
  finish: { grain: 0.03, vignette: 0.55, chroma: 2.4, contrast: 1.04, saturation: 1.05, vignetteColor: 0x02040c, halo: 0.35 },
};
