import { it } from 'vitest';
import { TEMPLATES } from '../src/templates';
import { review } from './review';

/**
 * Watchability report (wake-up time, peak, tail, framing) for composition passes. Not a check: run it
 * on demand with `REVIEW=1 npx vitest run tests/zz-review.test.ts --reporter=verbose` (IDS=a,b to filter).
 */
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
it.skipIf(!env.REVIEW)('review', () => {
  const only = env.IDS?.split(',');
  const rows = TEMPLATES.filter((d) => !only || only.includes(d.id)).map((d) => review(d));
  console.log('REVIEW' + JSON.stringify(rows));
}, 900000);
