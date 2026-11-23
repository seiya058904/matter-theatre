import type { Graphics } from 'pixi.js';
import type { L10n, Role } from '../core/types';
import type { Fx } from '../render/Fx';
import type { FinishOpts } from '../fx/filters';

export type Pt = { x: number; y: number };

export type Shape =
  | { kind: 'circle'; r: number; x?: number; y?: number }
  | { kind: 'poly'; pts: Pt[] }
  /** Closed smooth outline (soft bodies). */
  | { kind: 'blob'; pts: Pt[] };

export interface Look {
  role: Role;
  /** Resolved colour of this element. */
  color: number;
  /** Stable per-element seed in [0,1) for hand-made variation. */
  seed: number;
  /** Optional emphasis 0..1 (hero bodies drawn bolder). */
  weight?: number;
}

export interface Background {
  id: string;
  name: L10n;
  /** Index into the background shader's mode switch. */
  mode: number;
  colors: [number, number, number];
}

export type ParticleKind = 'dot' | 'spark' | 'square' | 'shard' | 'flake' | 'blot' | 'mote';

/** How motion trails are textured (rendered as GPU rope meshes). */
export type TrailKind = 'soft' | 'crisp' | 'brush' | 'dash' | 'blocks';

export interface StyleDef {
  id: string;
  name: L10n;
  mood: L10n;
  /** CSS font stack for captions. */
  font: string;
  /** Text colour for captions/labels. */
  text: number;
  /** UI accent (CSS) used by the editor when this style is active. */
  accent: string;
  /** Gradient used for hero bodies (scenes pick a position along it). */
  ramp: number[];
  /** Pick ramp stops exactly instead of blending between them. */
  discrete?: boolean;
  accentColor: number;
  structure: number;
  ground: number;
  backgrounds: [Background, Background];
  /** Blend mode of the impact highlight overlay (default add). */
  flashBlend?: 'normal' | 'add';
  /** Bodies' blend mode. */
  blend: 'normal' | 'add' | 'multiply';
  /** Render-only squash and stretch along the direction of motion (cartoon). */
  squash?: boolean;
  /** Offset shadow under bodies (soft edge is drawn, never blurred on the GPU). */
  shadow?: { dx: number; dy: number; alpha: number; soft: number; color: number };
  trail: { kind: TrailKind; width: number; alpha: number; length: number; blend: 'normal' | 'add' | 'multiply' };
  particleKinds: ParticleKind[];
  particleBlend: 'normal' | 'add';
  /** How water is drawn in this look (fill over submerged bodies, plus the surface line). */
  water: { color: number; alpha: number };

  drawBody(g: Graphics, shapes: Shape[], look: Look): void;
  /** Overlay drawn on impact (alpha driven by flash). */
  drawFlash(g: Graphics, shapes: Shape[], look: Look): void;
  drawLink(g: Graphics, pts: Pt[], look: Look, width: number): void;
  impact(fx: Fx, x: number, y: number, strength: number, color: number): void;
  /** The single full-screen grade applied to the whole frame. */
  finish: FinishOpts;
}
