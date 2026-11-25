import { damp } from './ease';
import { W, H } from './types';

/** An interpolated view of the camera between two physics steps. */
export interface CameraView {
  x: number;
  y: number;
  zoom: number;
  angle: number;
}

/**
 * Critically-damped 2D camera. Scenes set `target`/`zoom`/`angle` (or a follow
 * function) and the camera glides there. It advances on the template's physics clock and is
 * interpolated between steps like the bodies, so framing is smooth at any refresh rate and
 * identical in a live show and in an exported video.
 */
export class Camera {
  x = W / 2;
  y = H / 2;
  zoom = 1;
  angle = 0;
  target = { x: W / 2, y: H / 2 };
  targetZoom = 1;
  targetAngle = 0;
  /** Higher = snappier. 1–2 reads as a slow, deliberate dolly. */
  stiffness = 1.6;
  follow: (() => { x: number; y: number } | null) | null = null;
  private trauma = 0;
  private clock = 0;
  shakeX = 0;
  shakeY = 0;
  shakeA = 0;
  private prev: CameraView | null = null;
  private out: CameraView = { x: W / 2, y: H / 2, zoom: 1, angle: 0 };

  set(x: number, y: number, zoom = this.zoom, angle = this.angle): void {
    this.x = this.target.x = x;
    this.y = this.target.y = y;
    this.zoom = this.targetZoom = zoom;
    this.angle = this.targetAngle = angle;
    this.prev = null;
  }

  to(x: number, y: number, zoom = this.targetZoom, angle = this.targetAngle): void {
    this.target.x = x;
    this.target.y = y;
    this.targetZoom = zoom;
    this.targetAngle = angle;
  }

  /** A short, small tremor for genuinely violent impacts. */
  shake(amount: number): void {
    this.trauma = Math.min(0.6, this.trauma + amount);
  }

  /** Remembers the current pose (called before each physics step). */
  snapshot(): void {
    const p = (this.prev ??= { x: 0, y: 0, zoom: 1, angle: 0 });
    p.x = this.x + this.shakeX;
    p.y = this.y + this.shakeY;
    p.zoom = this.zoom;
    p.angle = this.angle + this.shakeA;
  }

  /** The pose `alpha` of the way from the previous step to the current one. */
  view(alpha = 1): CameraView {
    const o = this.out;
    const x = this.x + this.shakeX;
    const y = this.y + this.shakeY;
    const a = this.angle + this.shakeA;
    const p = this.prev;
    if (!p || alpha >= 1) {
      o.x = x;
      o.y = y;
      o.zoom = this.zoom;
      o.angle = a;
    } else {
      o.x = p.x + (x - p.x) * alpha;
      o.y = p.y + (y - p.y) * alpha;
      o.zoom = p.zoom * Math.pow(this.zoom / p.zoom, alpha);
      o.angle = p.angle + (a - p.angle) * alpha;
    }
    return o;
  }

  update(dt: number): void {
    this.clock += dt;
    const f = this.follow?.();
    if (f) {
      this.target.x = f.x;
      this.target.y = f.y;
    }
    const k = damp(this.stiffness, dt);
    this.x += (this.target.x - this.x) * k;
    this.y += (this.target.y - this.y) * k;
    // Zoom eases in log space so push-ins and pull-backs feel equally smooth.
    this.zoom = Math.exp(Math.log(this.zoom) + (Math.log(this.targetZoom) - Math.log(this.zoom)) * k);
    this.angle += (this.targetAngle - this.angle) * k;
    this.trauma = Math.max(0, this.trauma - dt * 1.8);
    const s = this.trauma * this.trauma;
    const t = this.clock * 30;
    this.shakeX = s * 14 * (Math.sin(t * 1.13) + Math.sin(t * 2.71) * 0.5);
    this.shakeY = s * 14 * (Math.sin(t * 1.37 + 3) + Math.sin(t * 3.11) * 0.5);
    this.shakeA = s * 0.01 * Math.sin(t * 0.93 + 7);
  }
}
