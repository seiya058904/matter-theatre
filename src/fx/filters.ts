import { Filter, GlProgram } from 'pixi.js';
import { vertex } from 'pixi-filters';
import { FINISH_FRAG, INK_FRAG } from './glsl';
import { vec3 } from '../styles/color';

export interface FinishOpts {
  grain?: number;
  vignette?: number;
  chroma?: number;
  paper?: number;
  scan?: number;
  posterize?: number;
  contrast?: number;
  saturation?: number;
  leak?: number;
  tint?: number;
  vignetteColor?: number;
  /** Pixelation cell size in CSS pixels (0 = off). */
  pixel?: number;
  /** CRT barrel curvature (0 = off). */
  curve?: number;
  /** Film scratches and gate weave (0 = off). */
  scratch?: number;
  /** Sepia toning amount. */
  sepia?: number;
  /** Soft halo around bright areas, computed in the same pass (0 = off). */
  halo?: number;
}

/**
 * The only full-screen pass in the renderer. Every style's "look" — grain, halo,
 * paper, CRT, film, pixelation — is a parameter set for this one shader, so the
 * GPU cost per frame is constant whatever style is chosen.
 */
export class FinishFilter extends Filter {
  readonly u: Record<string, number | Float32Array>;

  constructor(o: FinishOpts) {
    super({
      glProgram: GlProgram.from({ vertex, fragment: FINISH_FRAG, name: 'mt-finish' }),
      resources: {
        finishUniforms: {
          uTime: { value: 0, type: 'f32' },
          uGrain: { value: o.grain ?? 0.04, type: 'f32' },
          uVignette: { value: o.vignette ?? 0.3, type: 'f32' },
          uChroma: { value: o.chroma ?? 0, type: 'f32' },
          uPaper: { value: o.paper ?? 0, type: 'f32' },
          uScan: { value: o.scan ?? 0, type: 'f32' },
          uPosterize: { value: o.posterize ?? 0, type: 'f32' },
          uContrast: { value: o.contrast ?? 1, type: 'f32' },
          uSat: { value: o.saturation ?? 1, type: 'f32' },
          uLeak: { value: o.leak ?? 0, type: 'f32' },
          uPixel: { value: o.pixel ?? 0, type: 'f32' },
          uCurve: { value: o.curve ?? 0, type: 'f32' },
          uScratch: { value: o.scratch ?? 0, type: 'f32' },
          uSepia: { value: o.sepia ?? 0, type: 'f32' },
          uHalo: { value: o.halo ?? 0, type: 'f32' },
          uRes: { value: 1, type: 'f32' },
          uTint: { value: new Float32Array(vec3(o.tint ?? 0xffffff)), type: 'vec3<f32>' },
          uVigColor: { value: new Float32Array(vec3(o.vignetteColor ?? 0x000000)), type: 'vec3<f32>' },
        },
      },
    });
    this.u = (this.resources.finishUniforms as { uniforms: Record<string, number | Float32Array> }).uniforms;
  }

  set time(t: number) {
    this.u.uTime = t;
  }

  /** Renderer resolution, so pixel-sized effects stay constant in CSS pixels. */
  set res(r: number) {
    this.u.uRes = r;
  }
}

/** Ink-bleed reveal mask for the incoming scene. */
export class InkRevealFilter extends Filter {
  readonly u: Record<string, number | Float32Array>;
  constructor() {
    super({
      glProgram: GlProgram.from({ vertex, fragment: INK_FRAG, name: 'mt-ink-reveal' }),
      resources: {
        inkUniforms: {
          uProgress: { value: 0, type: 'f32' },
          uOrigin: { value: new Float32Array([0.5, 0.5]), type: 'vec2<f32>' },
        },
      },
    });
    this.u = (this.resources.inkUniforms as { uniforms: Record<string, number | Float32Array> }).uniforms;
  }
  set progress(p: number) {
    this.u.uProgress = p;
  }
  origin(x: number, y: number): void {
    (this.u.uOrigin as Float32Array).set([x, y]);
  }
}
