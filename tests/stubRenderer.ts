import Matter from 'matter-js';
import { Container, type Renderer } from 'pixi.js';
import type { Role } from '../src/core/types';
import type { BodyOpts, SceneRenderer } from '../src/render/SceneRenderer';

/**
 * A stand-in for the SceneRenderer with the same surface templates use, drawing nothing.
 * Physics never depends on drawing, so a template runs here exactly as it does on stage.
 */
export function stubRenderer(): SceneRenderer {
  const views = new Map<Matter.Body, { opts: BodyOpts; alpha: number; scale: number; flash: number; redraw(): void }>();
  const host = new Container();
  const root = new Container();
  host.addChild(root);
  const look = (role: Role, _hue = 0.5, weight?: number, color?: number) => ({ role, color: color ?? 0xffffff, seed: 0.5, weight });
  const r = {
    root,
    views,
    fx: { muted: false, count: 0, burst() {}, ring() {} },
    impactMin: 2.5,
    impactRange: 14,
    impactsEnabled: true,
    defer: false,
    color: () => 0xffffff,
    look,
    body(b: Matter.Body, opts: BodyOpts) {
      const v = { opts, alpha: 1, scale: 1, flash: 0, redraw() {} };
      views.set(b, v);
      return v;
    },
    add(world: Matter.World, b: Matter.Body, opts: BodyOpts) {
      Matter.Composite.add(world, b);
      return r.body(b, opts);
    },
    remove(world: Matter.World, b: Matter.Body) {
      Matter.Composite.remove(world, b, true);
      views.delete(b);
    },
    track() {},
    link() {},
    constraint() {},
    blob() {},
    unblob() {},
    pen: () => ({ add() {} }),
    drawBack() {},
    drawFront() {},
    ipos: (b: Matter.Body) => ({ x: b.position.x, y: b.position.y }),
    iangle: (b: Matter.Body) => b.angle,
    anchor: (b: Matter.Body | null | undefined, p?: Matter.Vector) => ({ x: (b?.position.x ?? 0) + (p?.x ?? 0), y: (b?.position.y ?? 0) + (p?.y ?? 0) }),
    snapshot() {},
    flush: () => 0,
    render() {},
    resetTrails() {},
    destroy() {},
  };
  return r as unknown as SceneRenderer;
}

/** A GPU renderer stand-in for templates that compose off-screen (they only render in afterRender). */
export const stubGpu = { resolution: 1, render() {} } as unknown as Renderer;
