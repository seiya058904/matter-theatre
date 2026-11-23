import type { L10n, SceneDef } from '../core/types';
import type { LinkMode, ShowConfig } from './ShowConfig';
import { Rng } from '../core/rng';
import { TEMPLATES } from '../templates';
import { STYLES } from '../styles';

export interface Preset {
  id: string;
  name: L10n;
  note: L10n;
  cfg: ShowConfig;
}

const show = (style: string, bg: 0 | 1, link: LinkMode, ids: string[], seed = 7): ShowConfig => ({
  v: 1,
  style,
  bg,
  link,
  seed,
  segments: ids.map((id) => ({ id, len: 1 })),
});

/**
 * The house running order: hand-picked for watchability — calm openings, rising energy,
 * a peak, a breath, and a different family at every step.
 */
export const CURATED = [
  'ring-escape', 'pendulum-wave', 'marble-race', 'archimedes', 'three-body', 'trebuchet', 'water-balloon', 'galton',
  'domino-growth', 'harmonograph', 'ball-pit', 'newton-cradle', 'bed-of-nails', 'kaleidoscope', 'wrecking-ball', 'cargo-boat',
];

export const PRESETS: Preset[] = [
  { id: 'house', name: { zh: '馆藏精选', en: 'House Selection' }, note: { zh: '霓虹 · 十六段精选，自动衔接', en: 'Neon · sixteen favourites, auto segues' }, cfg: show('neon', 0, 'auto', CURATED) },
  { id: 'paper-toys', name: { zh: '纸上玩具', en: 'Paper Toys' }, note: { zh: '纸艺 · 弹珠、机关、小船与果冻', en: 'Paper · marbles, gadgets, boats and jelly' }, cfg: show('paper', 1, 'auto', ['marble-race', 'jelly-steps', 'bounce-sorter', 'domino-stairs', 'archimedes', 'roly-poly', 'shishi-odoshi', 'rope-cut', 'calder-mobile', 'cargo-boat', 'size-sieve', 'rube-relay'], 11) },
  { id: 'ink-scroll', name: { zh: '水墨长卷', en: 'Ink Scroll' }, note: { zh: '水墨 · 摆动、流沙与笔迹', en: 'Ink · swing, sand and brushwork' }, cfg: show('ink', 1, 'auto', ['pendulum-wave', 'harmonograph', 'hourglass', 'bead-curtain', 'double-pendulum', 'archimedes', 'avalanche', 'spring-organ', 'standing-wave', 'brachistochrone'], 5) },
  { id: 'glass-cosmos', name: { zh: '琉璃宇宙', en: 'Glass Cosmos' }, note: { zh: '琉璃 · 轨道、电荷与光', en: 'Glass · orbits, charges and light' }, cfg: show('glass', 0, 'auto', ['three-body', 'binary-star', 'kaleidoscope', 'coulomb-bowl', 'kepler', 'water-balloon', 'stadium-billiards', 'soft-collision', 'accretion', 'gas-expansion', 'coulomb', 'ring-escape'], 17) },
  { id: 'cartoon-fair', name: { zh: '卡通游乐园', en: 'Cartoon Fair' }, note: { zh: '卡通 · 弹跳、抛掷与机关', en: 'Cartoon · bounces, throws and gadgets' }, cfg: show('cartoon', 0, 'auto', ['ring-escape', 'bed-of-nails', 'seesaw-toss', 'ferris-wheel', 'projectile-fan', 'bouncing-ring', 'slingshot', 'ball-pit', 'pendulum-relay', 'rolling-race', 'tumbling-room', 'pyramid-demolition', 'trebuchet'], 23) },
];

export const DEFAULT_SHOW = PRESETS[0].cfg;

/**
 * Rhythm-aware shuffle: energy breathes (calm → lively → peak → release), a family never
 * returns within three steps, and no template repeats.
 */
export function shuffleShow(rng: Rng, count = 12, styleId?: string): ShowConfig {
  const arc = [1, 2, 3, 4, 2, 3, 5, 2, 1, 3, 4, 2, 3, 5, 1];
  const order: SceneDef[] = [];
  const used = new Set<string>();
  for (let i = 0; i < count; i++) {
    const want = arc[i % arc.length];
    const recent = order.slice(-3).map((d) => d.theme);
    const pool = TEMPLATES.filter((t) => !used.has(t.id) && !recent.includes(t.theme));
    const scored = pool.map((t) => ({ t, s: Math.abs(t.energy - want) + rng.next() * 1.4 }));
    scored.sort((a, b) => a.s - b.s);
    const pick = scored[0]?.t ?? rng.pick(TEMPLATES);
    used.add(pick.id);
    order.push(pick);
  }
  const style = styleId ?? rng.pick(STYLES).id;
  return { v: 1, style, bg: rng.next() < 0.5 ? 0 : 1, link: 'auto', seed: Math.floor(rng.next() * 1e6), segments: order.map((d) => ({ id: d.id, len: 1 })) };
}
