import { describe, expect, it } from 'vitest';
import { Rng, hashString } from '../src/core/rng';
import { Timeline } from '../src/core/Timeline';
import { schedule } from '../src/show/schedule';
import { decodeShow, encodeShow } from '../src/show/serialize';
import type { ShowConfig } from '../src/show/ShowConfig';

describe('Rng', () => {
  it('is deterministic for a seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const xs = Array.from({ length: 50 }, () => a.next());
    expect(xs).toEqual(Array.from({ length: 50 }, () => b.next()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });
  it('differs across seeds and hashes strings stably', () => {
    expect(new Rng(1).next()).not.toBe(new Rng(2).next());
    expect(hashString('galton')).toBe(hashString('galton'));
    expect(hashString('galton')).not.toBe(hashString('hourglass'));
  });
});

describe('Timeline', () => {
  it('fires cues once, in order, on reaching their time', () => {
    const tl = new Timeline();
    const log: string[] = [];
    tl.at(0.5, () => log.push('a')).at(1, () => log.push('b'));
    tl.advance(0.4);
    expect(log).toEqual([]);
    tl.advance(0.6);
    tl.advance(0.7);
    expect(log).toEqual(['a']);
    tl.advance(2);
    expect(log).toEqual(['a', 'b']);
  });
  it('drives spans from 0 to 1 and always delivers the final value', () => {
    const tl = new Timeline();
    const ps: number[] = [];
    tl.during(1, 2, (p) => ps.push(p));
    tl.advance(0.5);
    tl.advance(1.5);
    tl.advance(5);
    tl.advance(6);
    expect(ps).toEqual([0.5, 1]);
  });
});

describe('schedule', () => {
  it('overlaps consecutive segments and sums the total', () => {
    const { starts, total } = schedule([8, 14, 12], 2);
    expect(starts).toEqual([0, 6, 18]);
    expect(total).toBe(30);
  });
  it('handles empty and single shows', () => {
    expect(schedule([])).toEqual({ starts: [], total: 0 });
    expect(schedule([5], 2)).toEqual({ starts: [0], total: 5 });
  });
});

describe('show encoding', () => {
  const cfg: ShowConfig = {
    v: 1,
    style: 'ink',
    bg: 1,
    link: 'iris',
    seed: 123456,
    segments: [
      { id: 'galton', len: 0 },
      { id: 'domino-growth', len: 2 },
    ],
  };
  const scenes = new Set(['galton', 'domino-growth']);
  it('round-trips', () => {
    const text = encodeShow(cfg);
    expect(decodeShow(text, (id) => scenes.has(id), (id) => id === 'ink')).toEqual(cfg);
  });
  it('drops unknown scenes and rejects unknown styles', () => {
    expect(decodeShow('ink.0.dissolve.1~galton:1,nope:1', (id) => scenes.has(id), () => true)?.segments).toEqual([{ id: 'galton', len: 1 }]);
    expect(decodeShow('nostyle.0.dissolve.1~galton:1', () => true, () => false)).toBeNull();
    expect(decodeShow('garbage', () => true, () => true)).toBeNull();
  });
});

describe('show encoding with segue overrides', () => {
  it('keeps a per-segment segue and ignores unknown ones', () => {
    const cfg: ShowConfig = { v: 1, style: 'neon', bg: 0, link: 'auto', seed: 7, segments: [{ id: 'galton', len: 1 }, { id: 'kepler', len: 1, segue: 'iris' }] };
    const text = encodeShow(cfg);
    expect(text).toContain('kepler:1:iris');
    expect(decodeShow(text, () => true, () => true)).toEqual(cfg);
    expect(decodeShow('neon.0.auto.7~galton:1:warp', () => true, () => true)?.segments).toEqual([{ id: 'galton', len: 1 }]);
  });
});
