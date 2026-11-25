/** Shared GLSL snippets. */
export const NOISE = /* glsl */ `
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x), mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x),u.y); }
float fbm(vec2 p){ float v=0., a=.5; mat2 m=mat2(1.6,1.2,-1.2,1.6); for(int i=0;i<5;i++){ v+=a*noise(p); p=m*p; a*=.5; } return v; }
float fbm3(vec2 p){ float v=0., a=.5; mat2 m=mat2(1.6,1.2,-1.2,1.6); for(int i=0;i<3;i++){ v+=a*noise(p); p=m*p; a*=.5; } return v; }
`;

export const MESH_VERT = /* glsl */ `
in vec2 aPosition;
in vec2 aUV;
out vec2 vUV;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main(){
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
}
`;

/**
 * One background shader, sixteen hand-designed environments (two per style).
 * uCam carries the active camera (x/y offset in screen heights, z zoom) for parallax.
 */
export const BG_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 finalColor;
uniform float uTime;
uniform float uMode;
uniform vec2 uRes;
uniform vec3 uCam;
uniform vec3 uColA;
uniform vec3 uColB;
uniform vec3 uColC;
${NOISE}

float bayer4(vec2 p){
  ivec2 i = ivec2(mod(p, 4.0));
  int idx = i.x + i.y * 4;
  float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
  return m[idx] / 16.0;
}
float gridLine(float v, float w){ float d = abs(fract(v - 0.5) - 0.5) / max(fwidth(v), 1e-4); return 1.0 - min(d / w, 1.0); }

void main(){
  vec2 uv = vUV;
  float asp = uRes.x / uRes.y;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0);
  vec2 cam = uCam.xy;
  float t = uTime;
  int m = int(uMode + 0.5);
  vec3 col = uColA;

  if (m == 0) { // Neon: aurora over a starfield
    col = mix(uColA, uColB, smoothstep(-0.1, 1.1, uv.y));
    vec2 q = p + cam * 0.12;
    float n = fbm(vec2(q.x * 1.3 + t * 0.025, q.y * 2.0 - t * 0.04));
    float yb = q.y + 0.18 + 0.16 * sin(q.x * 1.7 + t * 0.12) - (n - 0.5) * 0.5;
    float band = exp(-yb * yb * 18.0);
    float curtain = fbm3(vec2(q.x * 9.0 + n * 3.0, t * 0.12));
    col += uColC * band * (0.25 + 0.75 * curtain) * 0.32;
    col += mix(uColC, vec3(0.9,0.3,1.0), 0.5) * exp(-pow(yb + 0.12, 2.0) * 30.0) * 0.09 * curtain;
    vec2 sp = (p + cam * 0.04) * 150.0; vec2 id = floor(sp); float h = hash(id);
    float star = step(0.987, h) * smoothstep(0.45, 0.0, length(fract(sp) - 0.5)) * (0.55 + 0.45 * sin(t * 1.7 + h * 80.0));
    col += star * 0.9 * (1.0 - uv.y * 0.8);
  } else if (m == 1) { // Neon: perspective grid horizon
    float hz = 0.6 + cam.y * 0.08;
    col = mix(uColA, uColB, smoothstep(0.0, hz, uv.y));
    col += uColC * exp(-abs(uv.y - hz) * 18.0) * 0.38;
    col += uColC * exp(-length((uv - vec2(0.5 - cam.x * 0.05, hz)) * vec2(asp, 3.0)) * 3.0) * 0.25;
    if (uv.y > hz) {
      float d = uv.y - hz;
      float z = 0.3 / d;
      float gx = (p.x + cam.x * 0.3) * z * 2.0;
      float gz = z + t * 0.35;
      float line = max(gridLine(gx, 1.2), gridLine(gz, 1.2));
      col = mix(col, uColA * 0.5, smoothstep(0.0, 0.25, d) * 0.6);
      col += uColC * line * smoothstep(0.0, 0.3, d) * 0.55 * (0.6 + 0.4 * exp(-d * 3.0));
    }
    vec2 sp = (p + cam * 0.03) * 120.0; float h = hash(floor(sp));
    col += step(0.992, h) * smoothstep(0.4, 0.0, length(fract(sp) - 0.5)) * step(uv.y, hz) * 0.6;
  } else if (m == 2) { // Paper: fibrous sheet under a soft window light
    float f = fbm3((p + cam * 0.02) * vec2(70.0, 9.0)) * 0.5 + fbm3((p + cam * 0.02) * vec2(9.0, 70.0)) * 0.5;
    col = uColA * (0.955 + 0.07 * f);
    col = mix(col, uColB, smoothstep(0.2, 1.3, length(p - vec2(-0.6, -0.5))) * 0.45);
    col -= step(0.9975, hash(floor(uv * uRes / 2.0))) * 0.06;
    col += uColC * exp(-length(p - vec2(-0.7, -0.6)) * 1.4) * 0.08;
  } else if (m == 3) { // Paper: layered cut-paper hills
    col = mix(uColA, uColB, smoothstep(0.0, 0.9, uv.y));
    for (int i = 0; i < 5; i++) {
      float fi = float(i);
      float x = p.x + cam.x * (0.03 + fi * 0.05) + fi * 3.1;
      float h = 0.55 + fi * 0.085 + 0.055 * sin(x * (1.3 + fi * 0.45) + fi) + 0.025 * sin(x * 4.3 + fi * 2.0) + cam.y * 0.02 * fi;
      vec3 hc = mix(uColB, uColC, 0.15 + fi * 0.2);
      float shadow = smoothstep(h - 0.03, h, uv.y) * (1.0 - step(h, uv.y));
      col = mix(col, col * 0.86, shadow * 0.7);
      col = mix(col, hc, step(h, uv.y));
    }
    col *= 0.97 + 0.05 * fbm3(p * 90.0);
  } else if (m == 6) { // Ink: rice paper with drifting wash
    vec2 q = p + cam * 0.03;
    float f = fbm3(q * vec2(40.0, 6.0)) * 0.6 + fbm3(q * vec2(6.0, 40.0)) * 0.4;
    col = uColA * (0.95 + 0.07 * f);
    float wash = smoothstep(0.55, 0.85, fbm(q * 1.4 + vec2(t * 0.01, 0.0)));
    col = mix(col, uColB, wash * 0.16);
    col = mix(col, uColB, smoothstep(0.5, 1.4, length(p)) * 0.18);
  } else if (m == 7) { // Ink: misty mountains
    col = uColA;
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      float x = p.x * (1.0 + fi * 0.3) + cam.x * (0.03 + fi * 0.06) + fi * 7.0;
      float h = 0.42 + fi * 0.13 - 0.22 * fbm3(vec2(x * 1.2, fi)) - 0.08 * abs(sin(x * 2.0 + fi));
      float body = smoothstep(h, h + 0.002, uv.y);
      float fade = smoothstep(h + 0.25 - fi * 0.04, h, uv.y);
      float ink = (0.18 + fi * 0.17) * fade;
      col = mix(col, uColB, body * ink * (0.75 + 0.25 * fbm3(vec2(x * 8.0, uv.y * 20.0))));
    }
    col = mix(col, uColA, smoothstep(0.75, 1.0, uv.y) * 0.6);
    col *= 0.96 + 0.05 * fbm3(p * 80.0);
  } else if (m == 10) { // Glass: caustic light under deep water
    col = mix(uColB, uColA, smoothstep(-0.2, 1.0, uv.y));
    vec2 q = (p + cam * 0.08) * 3.0;
    float c = 0.0;
    vec2 w = q;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      w += vec2(sin(w.y * 1.7 + t * 0.35 + fi), cos(w.x * 1.5 - t * 0.3 + fi * 2.0)) * 0.45;
      c += 0.6 / (1.0 + 40.0 * abs(sin(w.x * 1.2) * cos(w.y * 1.1)));
    }
    col += uColC * c * 0.12 * (1.2 - uv.y);
  } else if (m == 11) { // Glass: prism spectrum
    col = mix(uColA, uColB, uv.y);
    vec2 q = p + cam * 0.06;
    float d = q.x * 0.6 + q.y * 0.8 + 0.1 * sin(t * 0.15);
    vec3 spec = 0.5 + 0.5 * cos(6.28318 * (d * 1.2 + vec3(0.0, 0.33, 0.67)));
    float band = exp(-pow((q.y - q.x * 0.35 + 0.05) * 3.2, 2.0));
    col += spec * band * 0.22;
    col += uColC * exp(-length(q - vec2(-0.55, -0.3)) * 2.5) * 0.25;
  } else if (m == 16) { // Cartoon: bright sky with drifting cloud puffs and soft hills
    col = mix(uColA, uColB, smoothstep(0.0, 0.9, uv.y));
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      vec2 q = p * (1.6 - fi * 0.35) + vec2(t * (0.012 + fi * 0.006) + cam.x * (0.05 + fi * 0.04) + fi * 3.7, fi * 0.21 + cam.y * 0.04);
      vec2 cell = vec2(floor(q.x * 1.3), 0.0);
      float h = hash(cell + fi * 11.0);
      vec2 c0 = vec2((cell.x + 0.5) / 1.3, -0.28 + h * 0.22 + fi * 0.06);
      vec2 d = (q - c0) * vec2(1.0, 1.9);
      float puff = length(d) - (0.13 + 0.05 * h);
      puff = min(puff, length(d - vec2(0.12, 0.03)) - (0.09 + 0.03 * h));
      puff = min(puff, length(d + vec2(0.12, -0.04)) - (0.08 + 0.02 * h));
      float a = smoothstep(0.012, -0.004, puff) * step(0.35, h) * (0.95 - fi * 0.18);
      col = mix(col, mix(uColC, uColB, 0.15 + fi * 0.15), a);
      col = mix(col, col * 0.92, smoothstep(0.03, 0.0, abs(puff + 0.015)) * a * 0.25);
    }
    float hill = 0.82 + 0.035 * sin(p.x * 3.1 + cam.x * 0.6) + 0.02 * sin(p.x * 7.3 + 1.0);
    col = mix(col, vec3(0.62, 0.86, 0.58), smoothstep(hill, hill + 0.003, uv.y) * 0.9);
    float hill2 = 0.9 + 0.03 * sin(p.x * 2.3 + cam.x * 1.1 + 2.0);
    col = mix(col, vec3(0.47, 0.76, 0.46), smoothstep(hill2, hill2 + 0.003, uv.y));
  } else { // Cartoon: slowly turning sunburst
    vec2 q = p + cam * 0.06;
    float a = atan(q.y + 0.65, q.x) + t * 0.03;
    float rays = step(0.5, fract(a / 6.28318 * 18.0));
    col = mix(uColA, uColB, rays * 0.65);
    col = mix(col, uColC, exp(-length(q + vec2(0.0, 0.65)) * 2.2) * 0.8);
    col *= 1.0 - 0.12 * smoothstep(0.6, 1.4, length(p));
  }
  finalColor = vec4(col, 1.0);
}
`;

/**
 * Final grade — the only full-screen pass: optional pixelation and CRT curve, chroma,
 * a cheap single-pass halo, contrast/saturation/tint/sepia, light leak, paper, film
 * scratches, scanlines, vignette and grain.
 */
export const FINISH_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform highp vec4 uInputSize;
uniform highp vec4 uOutputFrame;
uniform vec4 uInputClamp;
uniform float uTime;
uniform float uGrain;
uniform float uVignette;
uniform float uChroma;
uniform float uPaper;
uniform float uScan;
uniform float uPosterize;
uniform float uContrast;
uniform float uSat;
uniform float uLeak;
uniform float uPixel;
uniform float uCurve;
uniform float uScratch;
uniform float uSepia;
uniform float uHalo;
uniform float uRes;
uniform vec3 uTint;
uniform vec3 uVigColor;
${NOISE}
vec4 tex(vec2 c){ return texture(uTexture, clamp(c, uInputClamp.xy, uInputClamp.zw)); }
void main(){
  vec2 size = uOutputFrame.zw;
  vec2 uv = vTextureCoord * uInputSize.xy / size;
  if (uCurve > 0.0) {
    vec2 cc = uv - 0.5;
    cc *= 1.0 + uCurve * dot(cc, cc);
    uv = cc + 0.5;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { finalColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  }
  if (uScratch > 0.0) uv.y += sin(uTime * 23.0) * 0.0006 * uScratch;
  vec2 px = uv * size;
  if (uPixel > 0.0) {
    float cell = uPixel * uRes;
    px = (floor(px / cell) + 0.5) * cell;
  }
  vec2 coord = px / uInputSize.xy;
  vec2 c = uv - 0.5;
  vec3 rgb = tex(coord).rgb;
  if (uChroma > 0.0) {
    vec2 off = c * length(c) * uChroma * 2.0 * uRes * uInputSize.zw;
    rgb.r = tex(coord + off).r;
    rgb.b = tex(coord - off).b;
  }
  if (uHalo > 0.0) {
    vec3 acc = vec3(0.0);
    vec2 stepPx = uInputSize.zw * uRes;
    // Eight taps on a rotated spiral: a soft glow around bright pixels at a fixed, small cost.
    for (int i = 0; i < 8; i++) {
      float fi = float(i);
      float a = fi * 2.39996 + 0.4;
      vec2 d = vec2(cos(a), sin(a)) * (6.0 + fi * 2.2);
      acc += max(tex(coord + d * stepPx).rgb - 0.45, 0.0);
    }
    rgb += acc * (uHalo / 6.0);
  }
  rgb = (rgb - 0.5) * uContrast + 0.5;
  float l = dot(rgb, vec3(0.299, 0.587, 0.114));
  rgb = mix(vec3(l), rgb, uSat);
  if (uSepia > 0.0) {
    vec3 sep = vec3(dot(rgb, vec3(0.393, 0.769, 0.189)), dot(rgb, vec3(0.349, 0.686, 0.168)), dot(rgb, vec3(0.272, 0.534, 0.131)));
    rgb = mix(rgb, sep, uSepia);
  }
  rgb *= uTint;
  if (uLeak > 0.0) {
    vec2 lc = vec2(0.05 + 0.1 * sin(uTime * 0.21), 0.1 + 0.08 * sin(uTime * 0.17));
    float leak = exp(-length((uv - lc) * vec2(1.6, 1.0)) * 2.8) * (0.6 + 0.4 * sin(uTime * 0.37));
    rgb += vec3(1.0, 0.45, 0.18) * leak * uLeak * 0.3;
    rgb += vec3(1.0, 0.7, 0.4) * exp(-length((uv - vec2(1.0, 0.95)) * 1.8) * 3.0) * uLeak * 0.1;
  }
  if (uPaper > 0.0) {
    vec2 q = gl_FragCoord.xy / (3.0 * uRes);
    float f = fbm3(q * 0.35) * 0.6 + noise(q * 2.3) * 0.4;
    rgb *= 1.0 - uPaper * 0.12 * (f - 0.35);
    rgb *= 1.0 - uPaper * 0.05 * smoothstep(0.6, 1.0, noise(vec2(q.x * 0.08, q.y * 1.7)));
  }
  if (uScratch > 0.0) {
    float frame = floor(uTime * 14.0);
    for (int i = 0; i < 2; i++) {
      float fi = float(i);
      float on = step(0.55, hash(vec2(frame, fi * 7.0)));
      float sx = hash(vec2(frame * 1.3, fi + 3.0));
      float line = smoothstep(1.4 * uRes, 0.0, abs(px.x - sx * size.x));
      rgb = mix(rgb, vec3(1.0, 0.96, 0.88), line * on * uScratch * 0.35);
    }
    rgb *= 1.0 - uScratch * 0.04 * hash(vec2(frame, 1.0));
  }
  if (uPosterize > 0.0) rgb = floor(rgb * uPosterize + 0.5) / uPosterize;
  if (uScan > 0.0) rgb *= 1.0 - uScan * (0.5 + 0.5 * sin(px.y * 3.14159 / max(uRes * (uPixel > 0.0 ? uPixel * 0.5 : 1.5), 1.0)));
  float v = smoothstep(0.85, 0.15, length(c * vec2(1.0, 1.2)));
  rgb = mix(uVigColor, rgb, mix(1.0, v, uVignette));
  float g = hash(gl_FragCoord.xy + floor(fract(uTime * 7.13) * 977.0) * vec2(1.618, 2.718)) - 0.5;
  rgb += g * uGrain;
  finalColor = vec4(clamp(rgb, 0.0, 1.0), 1.0);
}
`;

/** Ink-bleed reveal used as a transition (applied to the incoming scene). */
export const INK_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform highp vec4 uInputSize;
uniform highp vec4 uOutputFrame;
uniform float uProgress;
uniform vec2 uOrigin;
${NOISE}
void main(){
  vec2 px = vTextureCoord * uInputSize.xy;
  vec2 uv = px / uOutputFrame.zw;
  vec4 c = texture(uTexture, vTextureCoord);
  float asp = uOutputFrame.z / uOutputFrame.w;
  float d = length((uv - uOrigin) * vec2(asp, 1.0));
  float n = fbm(uv * 5.0) * 0.55 + fbm(uv * 22.0) * 0.12;
  float front = uProgress * 2.1 - 0.15;
  float a = 1.0 - smoothstep(front - 0.12, front, d + n * 0.6);
  finalColor = c * a;
}
`;
