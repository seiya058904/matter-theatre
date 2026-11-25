import type { Graphics } from 'pixi.js';
import type { Pt, Shape } from './types';
import { traceShape } from '../render/SceneRenderer';

export { traceShape };

/** Deterministic pseudo-random in [0,1) from a seed and index. */
export const srand = (seed: number, i: number) => {
  const x = Math.sin(seed * 9301.17 + i * 49297.3) * 233280.5;
  return x - Math.floor(x);
};

export function centroid(pts: Pt[]): Pt {
  let x = 0, y = 0;
  for (const p of pts) { x += p.x; y += p.y; }
  return { x: x / pts.length, y: y / pts.length };
}

export function inset(pts: Pt[], k: number): Pt[] {
  const c = centroid(pts);
  return pts.map((p) => ({ x: c.x + (p.x - c.x) * k, y: c.y + (p.y - c.y) * k }));
}

export function scaleShape(s: Shape, k: number): Shape {
  if (s.kind === 'circle') return { ...s, r: s.r * k };
  return { ...s, pts: inset(s.pts, k) };
}

/** Points on the outline facing a direction (radians, screen space), pulled in towards the centre. */
export function arcOf(pts: Pt[], from: number, to: number, k = 0.8): Pt[] {
  const c = centroid(pts);
  const out: Pt[] = [];
  for (const p of pts) {
    const a = Math.atan2(p.y - c.y, p.x - c.x);
    if (a >= from && a <= to) out.push({ x: c.x + (p.x - c.x) * k, y: c.y + (p.y - c.y) * k, a } as Pt & { a: number });
  }
  return out.sort((p, q) => (p as Pt & { a: number }).a - (q as Pt & { a: number }).a);
}

/** Rough size of a shape (radius, or farthest vertex from its centroid). */
export function sizeOf(s: Shape): number {
  if (s.kind === 'circle') return s.r;
  const c = centroid(s.pts);
  return Math.max(...s.pts.map((p) => Math.hypot(p.x - c.x, p.y - c.y)));
}

export function jitter(pts: Pt[], amt: number, seed: number): Pt[] {
  return pts.map((p, i) => ({ x: p.x + (srand(seed, i) - 0.5) * amt, y: p.y + (srand(seed, i + 77) - 0.5) * amt }));
}

/** Subdivides a closed polygon so hand-drawn jitter reads as a brush edge. */
export function subdivide(pts: Pt[], step: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let k = 0; k < n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  }
  return out;
}

export function circlePts(cx: number, cy: number, r: number, n = 28): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return out;
}

export function outline(s: Shape): Pt[] {
  return s.kind === 'circle' ? circlePts(s.x ?? 0, s.y ?? 0, s.r, Math.max(16, Math.min(48, Math.round(s.r * 0.8)))) : s.pts;
}

export function path(g: Graphics, pts: Pt[], closed = false): Graphics {
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  if (closed) g.closePath();
  return g;
}

export function dashed(g: Graphics, pts: Pt[], dash: number, gap: number, width: number, color: number, alpha: number): void {
  let on = true;
  let left = dash;
  for (let i = 0; i < pts.length - 1; i++) {
    let a = pts[i];
    const b = pts[i + 1];
    let seg = Math.hypot(b.x - a.x, b.y - a.y);
    while (seg > 0) {
      const d = Math.min(left, seg);
      const t = d / seg;
      const c = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      if (on) g.moveTo(a.x, a.y).lineTo(c.x, c.y);
      a = c;
      seg -= d;
      left -= d;
      if (left <= 0) {
        on = !on;
        left = on ? dash : gap;
      }
    }
  }
  g.stroke({ width, color, alpha, cap: 'round' });
}

/** Tapered stroke from tail (thin, transparent) to head (full). */
export function tapered(g: Graphics, pts: Pt[], color: number, width: number, alpha: number, every = 1): void {
  const n = pts.length;
  for (let i = every; i < n; i += every) {
    const k = i / (n - 1);
    const a = pts[i - every], b = pts[i];
    g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: Math.max(0.5, width * k), color, alpha: alpha * k * k, cap: 'round' });
  }
}

export function fillShapes(g: Graphics, shapes: Shape[], color: number, alpha = 1): void {
  for (const s of shapes) traceShape(g, s).fill({ color, alpha });
}

export function strokeShapes(g: Graphics, shapes: Shape[], width: number, color: number, alpha = 1, join: 'miter' | 'round' = 'round'): void {
  for (const s of shapes) traceShape(g, s).stroke({ width, color, alpha, join, alignment: 0.5 });
}

/** Faux bloom: wide, faint strokes under the real outline (drawn once, costs nothing per frame). */
export function glow(g: Graphics, shapes: Shape[], color: number, strength = 1): void {
  for (const s of shapes) {
    // Halo width follows the body's size so small particles never smear into each other.
    const size = s.kind === 'circle' ? s.r : Math.max(...s.pts.map((p) => Math.hypot(p.x, p.y)));
    if (size < 8) continue;
    const w = Math.min(14, size * 0.9);
    traceShape(g, s).stroke({ width: w, color, alpha: 0.05 * strength, join: 'round' });
    traceShape(g, s).stroke({ width: w * 0.5, color, alpha: 0.12 * strength, join: 'round' });
  }
}

export function glowLine(g: Graphics, pts: Pt[], color: number, width: number, strength = 1): void {
  path(g, pts).stroke({ width: width + 10, color, alpha: 0.05 * strength, cap: 'round', join: 'round' });
  path(g, pts).stroke({ width: width + 4, color, alpha: 0.12 * strength, cap: 'round', join: 'round' });
}
