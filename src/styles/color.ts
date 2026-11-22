/** Colour helpers. Colours are 0xRRGGBB numbers throughout. */
export const rgb = (c: number): [number, number, number] => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
export const toNum = (r: number, g: number, b: number) =>
  ((Math.round(r) & 255) << 16) | ((Math.round(g) & 255) << 8) | (Math.round(b) & 255);

export function mix(a: number, b: number, t: number): number {
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  return toNum(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

export const lighten = (c: number, t: number) => mix(c, 0xffffff, t);
export const darken = (c: number, t: number) => mix(c, 0x000000, t);

/** Sample a multi-stop gradient at t in [0,1]. */
export function ramp(stops: readonly number[], t: number): number {
  if (stops.length === 1) return stops[0];
  const x = Math.min(0.99999, Math.max(0, t)) * (stops.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const s = f * f * (3 - 2 * f);
  return mix(stops[i], stops[i + 1], s);
}

export const vec3 = (c: number): [number, number, number] => {
  const [r, g, b] = rgb(c);
  return [r / 255, g / 255, b / 255];
};

export const css = (c: number) => '#' + c.toString(16).padStart(6, '0');
