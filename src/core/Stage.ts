import { Application, Container, Graphics } from 'pixi.js';
import { BackgroundLayer } from '../fx/Background';
import { FinishFilter } from '../fx/filters';
import type { StyleDef } from '../styles/types';
import { H, W } from './types';

/** Resolution ladder used by the adaptive quality governor. */
const LADDER = [1.5, 1.25, 1, 0.85, 0.7];

/**
 * The Pixi application: a half-resolution procedural backdrop, a design-space world
 * (1920×1080, letterboxed to fit) and one full-screen finishing pass.
 *
 * A small governor watches frame times and steps the render resolution down (or back
 * up) so playback stays smooth on any machine.
 */
export class Stage {
  readonly app = new Application();
  readonly bg = new BackgroundLayer();
  readonly world = new Container();
  readonly scenes = new Container();
  readonly overlay = new Container();
  /** A black curtain over the whole stage, closed while the look changes. */
  readonly curtain = new Graphics();
  finish: FinishFilter | null = null;
  style: StyleDef | null = null;
  scale = 1;
  private fixed: { w: number; h: number } | null = null;
  private bgIndex = -1;
  private level = 0;
  private frames: number[] = [];
  private cooldown = 0;

  async init(host: HTMLElement): Promise<void> {
    const dpr = window.devicePixelRatio || 1;
    this.level = LADDER.findIndex((r) => r <= dpr + 0.01);
    if (this.level < 0) this.level = LADDER.length - 1;
    await this.app.init({
      resizeTo: window,
      antialias: true,
      autoDensity: true,
      resolution: LADDER[this.level],
      preference: 'webgl',
      background: '#000000',
      powerPreference: 'high-performance',
    });
    host.appendChild(this.app.canvas);
    this.world.addChild(this.scenes, this.overlay);
    this.app.stage.eventMode = 'none';
    this.curtain.visible = false;
    this.app.stage.addChild(this.bg.sprite, this.world, this.curtain);
    this.app.stage.filterArea = this.app.screen;
    this.app.renderer.on('resize', () => this.layout());
    this.app.canvas.addEventListener('webglcontextrestored', () => this.layout());
    this.layout();
  }

  get width(): number {
    return this.app.screen.width;
  }

  get height(): number {
    return this.app.screen.height;
  }

  get resolution(): number {
    return this.app.renderer.resolution;
  }

  layout(): void {
    const w = this.width;
    const h = this.height;
    this.bg.resize(w, h);
    this.scale = Math.min(w / W, h / H);
    this.world.scale.set(this.scale);
    this.world.position.set((w - W * this.scale) / 2, (h - H * this.scale) / 2);
    this.curtain.clear().rect(0, 0, w, h).fill(0x000000);
    if (this.finish) this.finish.res = this.resolution;
  }

  setCurtain(a: number): void {
    this.curtain.alpha = a;
    this.curtain.visible = a > 0.001;
  }

  applyStyle(style: StyleDef, bgIndex: number): void {
    if (this.usesStyle(style, bgIndex)) return;
    const newLook = this.style !== style;
    this.style = style;
    this.bgIndex = bgIndex;
    this.bg.set(style.backgrounds[bgIndex] ?? style.backgrounds[0]);
    if (!newLook) return;
    this.finish?.destroy();
    this.finish = new FinishFilter(style.finish);
    this.finish.res = this.resolution;
    this.app.stage.filters = [this.finish];
  }

  usesStyle(style: StyleDef, bgIndex: number): boolean {
    return this.style === style && this.bgIndex === bgIndex;
  }

  /** Called once per frame with the real frame time (ms). */
  govern(ms: number): void {
    if (this.fixed) return;
    this.frames.push(ms);
    if (this.frames.length < 90) return;
    const sorted = [...this.frames].sort((a, b) => a - b);
    const p75 = sorted[Math.floor(sorted.length * 0.75)];
    this.frames = [];
    if (this.cooldown-- > 0) return;
    const dpr = window.devicePixelRatio || 1;
    if (p75 > 19 && this.level < LADDER.length - 1) this.setLevel(this.level + 1);
    else if (p75 < 12 && this.level > 0 && LADDER[this.level - 1] <= dpr + 0.01) this.setLevel(this.level - 1);
  }

  private setLevel(i: number): void {
    this.level = i;
    this.cooldown = 2;
    this.app.renderer.resolution = LADDER[i];
    this.app.resize();
    this.layout();
  }

  /** Locks the canvas to an exact pixel size (video export). */
  lockSize(w: number, h: number): void {
    this.fixed = { w, h };
    this.app.resizeTo = null as unknown as HTMLElement;
    this.app.renderer.resolution = 1;
    this.app.renderer.resize(w, h);
    const c = this.app.canvas;
    c.style.width = '100vw';
    c.style.height = `${(100 * h) / w}vw`;
    c.style.maxHeight = '100vh';
    c.style.objectFit = 'contain';
    this.layout();
  }

  unlockSize(): void {
    if (!this.fixed) return;
    this.fixed = null;
    const c = this.app.canvas;
    c.style.width = c.style.height = c.style.maxHeight = c.style.objectFit = '';
    this.app.renderer.resolution = LADDER[this.level];
    this.app.resizeTo = window;
    this.app.resize();
    this.layout();
  }
}
