import { damp } from './ease';
import { W, H } from './types';

/**
 * Critically-damped 2D camera. Scenes set `target`/`zoom`/`angle` (or a follow
 * function) and the camera glides there; it is advanced on real frame time, so its
 * motion is even on screen whatever the physics step count was that frame.
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

  set(x: number, y: number, zoom = this.zoom, angle = this.angle): void {
    this.x = this.target.x = x;
    this.y = this.target.y = y;
    this.zoom = this.targetZoom = zoom;
    this.angle = this.targetAngle = angle;
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
