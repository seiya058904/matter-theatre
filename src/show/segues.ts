import type { SceneDef } from '../core/types';
import { Rng } from '../core/rng';
import type { LinkMode, Segue } from './ShowConfig';

/** Segues that suit the way the outgoing template ends. */
const BY_END: Record<SceneDef['endState'], Segue[]> = {
  settle: ['dip', 'iris', 'zoom', 'dissolve', 'drop'],
  periodic: ['glide', 'dissolve', 'zoom', 'iris'],
  flow: ['glide', 'dissolve', 'drop', 'dip'],
};

/**
 * Picks the incoming segue for every item of a running order (index 0 = the loop seam).
 * A fixed choice is honoured everywhere except where it cannot work (a floor drop needs a
 * floor); "auto" chooses by the outgoing template's ending, favours the style's signature
 * segue and never repeats the previous one.
 */
export function chooseSegues(defs: SceneDef[], mode: LinkMode, styleId: string, seed: number, overrides: (Segue | undefined)[] = []): Segue[] {
  const n = defs.length;
  const out: Segue[] = new Array(n);
  const rng = new Rng((seed * 7919 + 17) >>> 0);
  let prev: Segue | null = null;
  for (let i = 0; i < n; i++) {
    const from = defs[(i - 1 + n) % n];
    let pick: Segue;
    const forced = overrides[i];
    if (forced) pick = forced === 'drop' && !from?.canDrop ? 'dip' : forced;
    else if (mode !== 'auto') pick = mode === 'drop' && !from?.canDrop ? 'dip' : mode;
    else {
      const pool = (from ? BY_END[from.endState] : BY_END.settle).filter((s) => s !== prev && (s !== 'drop' || from?.canDrop));
      const weights = pool.map((s) => (s === 'ink' ? 0 : 1) + (styleId === 'ink' && s === 'dissolve' ? 0.5 : 0));
      if (styleId === 'ink' && prev !== 'ink') {
        pool.push('ink');
        weights.push(2.2);
      }
      const sum = weights.reduce((a, b) => a + b, 0);
      let x = rng.next() * sum;
      pick = pool[pool.length - 1];
      for (let k = 0; k < pool.length; k++) {
        x -= weights[k];
        if (x <= 0) {
          pick = pool[k];
          break;
        }
      }
    }
    out[i] = pick;
    prev = pick;
  }
  return out;
}
