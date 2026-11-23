import type { Container, Renderer } from 'pixi.js';
import type Matter from 'matter-js';
import type { StyleDef } from '../styles/types';
import type { Camera } from './Camera';
import type { Timeline } from './Timeline';
import type { Rng } from './rng';
import type { SceneRenderer } from '../render/SceneRenderer';

export type L10n = { zh: string; en: string };
export type Lang = keyof L10n;

/** Design resolution: every scene is authored in this coordinate space. */
export const W = 1920;
export const H = 1080;

/** Physics runs at a fixed 120 Hz; scripts are evaluated on physics time. */
export const STEP = 1 / 120;

/** Families of templates; each shows one kind of physical behaviour. */
export type Family = 'collision' | 'gravity' | 'granular' | 'stacking' | 'oscillation' | 'rope' | 'soft' | 'fluid' | 'machine' | 'chain' | 'field' | 'pattern';
/** Kept as an alias so older code paths read naturally. */
export type Theme = Family;

/** How a template ends — drives which segues suit it. */
export type EndState = 'settle' | 'periodic' | 'flow';

/**
 * Visual role of a body. Scenes never pick colours; they pick roles and
 * the active style decides what each role looks like.
 */
export type Role = 'hero' | 'accent' | 'structure' | 'debris' | 'ground' | 'ghost';

export interface SceneContext {
  engine: Matter.Engine;
  world: Matter.World;
  root: Container;
  style: StyleDef;
  camera: Camera;
  tl: Timeline;
  rng: Rng;
  r: SceneRenderer;
  /** For scenes that compose offscreen (e.g. the kaleidoscope's mirrors). */
  renderer: Renderer;
  /** Segment duration in seconds (already scaled by the chosen length). */
  duration: number;
  /** Seconds after which the segue has finished and the experiment may begin. */
  enterAt: number;
  /** Time dilation for a beat: the whole template runs slower for a moment, like a high-speed camera. */
  slowmo(scale: number, hold: number, ease?: number): void;
  /**
   * Registers a physical law (a spring, a field, buoyancy, gas pressure) evaluated before every
   * physics step — also while the template settles off-screen, so a soft body never sags before it is seen.
   */
  force(fn: () => void): void;
}

export interface SceneInstance {
  /** Fixed-step logic (t = scene-local seconds). Must not push bodies around. */
  step?(t: number, dt: number): void;
  /** The experiment begins (things are let go). Called once, after the segue. */
  enter?(): void;
  /** Called after the scene's views were synced for this frame. */
  afterRender?(): void;
  /** Visual focus of the scene, used as the origin of iris / ink / zoom segues. */
  entry: { x: number; y: number };
  /** Static bodies that can be opened for a "floor drop" exit (everything then falls away). */
  floors?: Matter.Body[];
  dispose?(): void;
}

/**
 * A template: one self-contained physics clip. It opens in a calm establishing state,
 * `enter()` lets go, it shows one clear moment, and it ends composed.
 */
export interface SceneDef {
  id: string;
  /** Family of behaviour (named `theme` for historical reasons). */
  theme: Family;
  title: L10n;
  blurb: L10n;
  /** One line on the physical law the template shows (UI only, never drawn on stage). */
  law: L10n;
  /** Base duration (s). The moment must happen before ~80% of it. */
  duration: number;
  /** 1 = contemplative … 5 = violent. Used for pacing. */
  energy: 1 | 2 | 3 | 4 | 5;
  endState: EndState;
  /** Seconds of off-screen settling before the template is first seen (stacks, piles). */
  presettle?: number;
  /** Moves from its very first frame (orbits, gases) rather than starting at rest. */
  movingStart?: boolean;
  /** Its floor can be opened at the end (enables the "floor drop" segue). */
  canDrop?: boolean;
  gravity?: { x: number; y: number };
  setup(ctx: SceneContext): SceneInstance;
}
