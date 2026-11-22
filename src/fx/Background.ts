import { Container, Geometry, Mesh, RenderTexture, Shader, Sprite, type Renderer } from 'pixi.js';
import { BG_FRAG, MESH_VERT } from './glsl';
import type { Background as BgDef } from '../styles/types';
import { vec3 } from '../styles/color';

/**
 * Full-screen procedural environment. The shader is evaluated into a half-resolution
 * texture (backdrops are soft by design) and stretched to the screen — a quarter of
 * the pixel cost of drawing it directly.
 */
export class BackgroundLayer {
  readonly sprite = new Sprite();
  readonly mesh: Mesh<Geometry, Shader>;
  private holder = new Container();
  private rt: RenderTexture | null = null;
  private u: Record<string, unknown>;
  private w = 1;
  private h = 1;
  scale = 0.5;

  constructor() {
    const geometry = new Geometry({
      attributes: {
        aPosition: [0, 0, 1, 0, 1, 1, 0, 1],
        aUV: [0, 0, 1, 0, 1, 1, 0, 1],
      },
      indexBuffer: [0, 1, 2, 0, 2, 3],
    });
    const shader = Shader.from({
      gl: { vertex: MESH_VERT, fragment: BG_FRAG, name: 'mt-background' },
      resources: {
        bgUniforms: {
          uTime: { value: 0, type: 'f32' },
          uMode: { value: 0, type: 'f32' },
          uRes: { value: new Float32Array([1920, 1080]), type: 'vec2<f32>' },
          uCam: { value: new Float32Array([0, 0, 1]), type: 'vec3<f32>' },
          uColA: { value: new Float32Array(3), type: 'vec3<f32>' },
          uColB: { value: new Float32Array(3), type: 'vec3<f32>' },
          uColC: { value: new Float32Array(3), type: 'vec3<f32>' },
        },
      },
    });
    this.mesh = new Mesh({ geometry, shader });
    this.holder.addChild(this.mesh);
    this.u = (shader.resources.bgUniforms as { uniforms: Record<string, unknown> }).uniforms;
  }

  set(bg: BgDef): void {
    this.u.uMode = bg.mode;
    (this.u.uColA as Float32Array).set(vec3(bg.colors[0]));
    (this.u.uColB as Float32Array).set(vec3(bg.colors[1]));
    (this.u.uColC as Float32Array).set(vec3(bg.colors[2]));
  }

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    const tw = Math.max(2, Math.round(w * this.scale));
    const th = Math.max(2, Math.round(h * this.scale));
    if (!this.rt || this.rt.width !== tw || this.rt.height !== th) {
      this.rt?.destroy(true);
      this.rt = RenderTexture.create({ width: tw, height: th, resolution: 1, antialias: false });
      this.sprite.texture = this.rt;
    }
    this.mesh.scale.set(tw, th);
    this.sprite.width = w;
    this.sprite.height = h;
    // Pixel-art backdrops use uRes for their grid, so feed the on-screen size.
    (this.u.uRes as Float32Array).set([w, h]);
  }

  update(renderer: Renderer, time: number, camX: number, camY: number, zoom: number): void {
    this.u.uTime = time;
    (this.u.uCam as Float32Array).set([camX, camY, zoom]);
    if (this.rt) renderer.render({ container: this.holder, target: this.rt, clear: true });
    this.sprite.width = this.w;
    this.sprite.height = this.h;
  }
}
