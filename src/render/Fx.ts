import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { ParticleKind, StyleDef } from '../styles/types';
import { easeOutCubic, easeOutExpo } from '../core/ease';

type Range = number | [number, number];
const pickR = (r: Range) => (typeof r === 'number' ? r : r[0] + Math.random() * (r[1] - r[0]));

export interface BurstOpts {
  x: number;
  y: number;
  n: number;
  speed: Range;
  life: Range;
  size: Range;
  color: number | number[];
  kind?: ParticleKind;
  /** Pixels / s^2 */
  gravity?: number;
  /** Per-second velocity retention (0..1, lower = more drag). */
  drag?: number;
  spin?: Range;
  /** Emission direction (rad) and spread (rad). Default: all around. */
  angle?: number;
  spread?: number;
  /** Size multiplier at end of life. */
  grow?: number;
  alpha?: number;
  /** Stretch sprite along velocity (sparks). */
  stretch?: number;
  /** Paper flake flutter. */
  flutter?: boolean;
}

interface P {
  s: Sprite;
  vx: number;
  vy: number;
  life: number;
  age: number;
  size: number;
  grow: number;
  g: number;
  drag: number;
  spin: number;
  alpha: number;
  stretch: number;
  flutter: number;
}

interface Ring {
  g: Graphics;
  x: number;
  y: number;
  r0: number;
  r1: number;
  life: number;
  age: number;
  width: number;
  color: number;
  dashed: boolean;
}

const texCache = new Map<ParticleKind, Texture>();

/** White particle textures generated once; sprites are tinted per particle. */
export function particleTexture(kind: ParticleKind): Texture {
  const hit = texCache.get(kind);
  if (hit) return hit;
  const S = 64;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d')!;
  x.fillStyle = '#fff';
  switch (kind) {
    case 'dot':
    case 'mote': {
      const gr = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(kind === 'dot' ? 0.25 : 0.5, 'rgba(255,255,255,0.65)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gr;
      x.fillRect(0, 0, S, S);
      break;
    }
    case 'spark': {
      const gr = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.4, 'rgba(255,255,255,0.5)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gr;
      x.beginPath();
      x.ellipse(S / 2, S / 2, S / 2, S / 7, 0, 0, Math.PI * 2);
      x.fill();
      break;
    }
    case 'square':
      x.fillRect(8, 8, S - 16, S - 16);
      break;
    case 'shard':
      x.beginPath();
      x.moveTo(S * 0.5, 4);
      x.lineTo(S - 6, S - 10);
      x.lineTo(10, S * 0.7);
      x.closePath();
      x.fill();
      break;
    case 'flake':
      x.fillRect(4, S * 0.25, S - 8, S * 0.5);
      x.fillStyle = 'rgba(0,0,0,0.12)';
      x.fillRect(4, S * 0.62, S - 8, S * 0.13);
      break;
    case 'blot': {
      x.beginPath();
      const n = 22;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = S * (0.3 + 0.09 * Math.sin(a * 3 + 1) + 0.05 * Math.sin(a * 7 + 2));
        const px = S / 2 + Math.cos(a) * r;
        const py = S / 2 + Math.sin(a) * r;
        if (i === 0) x.moveTo(px, py);
        else x.lineTo(px, py);
      }
      x.closePath();
      x.filter = 'blur(1.2px)';
      x.fill();
      break;
    }
  }
  const t = Texture.from(c);
  texCache.set(kind, t);
  return t;
}

/**
 * Per-scene particles and impact rings (world space). Everything is pooled:
 * nothing is allocated while a show plays, which keeps frame times flat.
 */
export class Fx {
  readonly layer = new Container();
  private pool: Sprite[] = [];
  private ps: P[] = [];
  private rings: Ring[] = [];
  private ringPool: Graphics[] = [];
  maxParticles = 600;
  maxRings = 20;

  constructor(public style: StyleDef) {}

  burst(o: BurstOpts): void {
    const kind = o.kind ?? this.style.particleKinds[0];
    const tex = particleTexture(kind);
    const n = Math.min(o.n, this.maxParticles - this.ps.length);
    for (let i = 0; i < n; i++) {
      let s = this.pool.pop();
      if (!s) {
        s = new Sprite();
        s.anchor.set(0.5);
        this.layer.addChild(s);
      }
      s.texture = tex;
      s.blendMode = this.style.particleBlend;
      s.tint = Array.isArray(o.color) ? o.color[(Math.random() * o.color.length) | 0] : o.color;
      s.position.set(o.x, o.y);
      s.rotation = Math.random() * Math.PI * 2;
      s.visible = true;
      const a = o.angle !== undefined ? o.angle + (Math.random() - 0.5) * (o.spread ?? Math.PI * 2) : Math.random() * Math.PI * 2;
      const sp = pickR(o.speed);
      const size = pickR(o.size);
      s.scale.set(size / 64);
      s.alpha = 0;
      this.ps.push({
        s,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: pickR(o.life),
        age: 0,
        size,
        grow: o.grow ?? 0.2,
        g: o.gravity ?? 0,
        drag: o.drag ?? 0.2,
        spin: o.spin !== undefined ? pickR(o.spin) * (Math.random() < 0.5 ? -1 : 1) : 0,
        alpha: o.alpha ?? 1,
        stretch: o.stretch ?? 0,
        flutter: o.flutter ? Math.random() * 10 : -1,
      });
    }
  }

  ring(o: { x: number; y: number; r0?: number; r1: number; life?: number; width?: number; color: number; dashed?: boolean }): void {
    if (this.rings.length >= this.maxRings) return;
    let g = this.ringPool.pop();
    if (!g) {
      g = new Graphics();
      this.layer.addChild(g);
    }
    g.visible = true;
    g.blendMode = this.style.particleBlend;
    this.rings.push({ g, x: o.x, y: o.y, r0: o.r0 ?? 4, r1: o.r1, life: o.life ?? 0.7, age: 0, width: o.width ?? 2, color: o.color, dashed: !!o.dashed });
  }

  get count(): number {
    return this.ps.length;
  }

  update(dt: number): void {
    if (dt <= 0) return;
    for (let i = this.ps.length - 1; i >= 0; i--) {
      const p = this.ps[i];
      p.age += dt;
      const k = p.age / p.life;
      if (k >= 1) {
        p.s.visible = false;
        this.pool.push(p.s);
        this.ps[i] = this.ps[this.ps.length - 1];
        this.ps.pop();
        continue;
      }
      const d = Math.pow(p.drag, dt);
      p.vx *= d;
      p.vy = p.vy * d + p.g * dt;
      if (p.flutter >= 0) {
        p.flutter += dt * 9;
        p.vx += Math.sin(p.flutter) * 40 * dt;
      }
      p.s.x += p.vx * dt;
      p.s.y += p.vy * dt;
      const sz = (p.size / 64) * (1 + (p.grow - 1) * k);
      if (p.stretch > 0) {
        const sp = Math.hypot(p.vx, p.vy);
        p.s.rotation = Math.atan2(p.vy, p.vx);
        p.s.scale.set(sz * (1 + (sp / 300) * p.stretch), sz);
      } else {
        p.s.rotation += p.spin * dt;
        p.s.scale.set(p.flutter >= 0 ? sz * Math.cos(p.flutter * 0.7) : sz, sz);
      }
      // Soft in, soft out: no particle ever pops.
      p.s.alpha = p.alpha * Math.min(1, p.age * 14) * (1 - k * k);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.age += dt;
      const k = r.age / r.life;
      r.g.clear();
      if (k >= 1) {
        r.g.visible = false;
        this.ringPool.push(r.g);
        this.rings.splice(i, 1);
        continue;
      }
      const rad = r.r0 + (r.r1 - r.r0) * easeOutExpo(k);
      const a = (1 - easeOutCubic(k)) * Math.min(1, r.age * 20);
      if (r.dashed) {
        const segs = 28;
        for (let s = 0; s < segs; s += 2) {
          const a0 = (s / segs) * Math.PI * 2 + k;
          r.g.arc(r.x, r.y, rad, a0, a0 + (Math.PI * 2) / segs);
          r.g.stroke({ width: r.width, color: r.color, alpha: a });
        }
      } else {
        r.g.circle(r.x, r.y, rad).stroke({ width: r.width * (1 - k * 0.6), color: r.color, alpha: a });
      }
    }
  }

  destroy(): void {
    this.layer.destroy({ children: true });
    this.ps = [];
    this.pool = [];
    this.rings = [];
    this.ringPool = [];
  }
}
