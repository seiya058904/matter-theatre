import { describe, expect, it } from 'vitest';
import { TEMPLATES, FAMILIES, templateById } from '../src/templates';
import { PRESETS, CURATED, shuffleShow } from '../src/show/presets';
import { chooseSegues } from '../src/show/segues';
import { SEGUES } from '../src/show/ShowConfig';
import { Rng } from '../src/core/rng';

describe('template library', () => {
  it('has sixty templates with unique ids in known families', () => {
    expect(TEMPLATES.length).toBe(60);
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
    const fams = new Set(FAMILIES.map((f) => f.id));
    for (const t of TEMPLATES) expect(fams.has(t.theme)).toBe(true);
    for (const f of FAMILIES) expect(TEMPLATES.some((t) => t.theme === f.id)).toBe(true);
  });
  it('describes every template fully, in both languages', () => {
    for (const t of TEMPLATES) {
      for (const k of ['title', 'law', 'blurb'] as const) {
        expect(t[k].zh.length, `${t.id}.${k}.zh`).toBeGreaterThan(0);
        expect(t[k].en.length, `${t.id}.${k}.en`).toBeGreaterThan(0);
      }
      expect(t.duration).toBeGreaterThanOrEqual(9);
      expect(t.duration).toBeLessThanOrEqual(15);
      expect(t.energy).toBeGreaterThanOrEqual(1);
      expect(t.energy).toBeLessThanOrEqual(5);
      expect(['settle', 'periodic', 'flow']).toContain(t.endState);
    }
  });
  it('builds presets only from real templates', () => {
    for (const p of PRESETS) for (const s of p.cfg.segments) expect(templateById(s.id), `${p.id}:${s.id}`).toBeTruthy();
    expect(CURATED.every((id) => templateById(id))).toBe(true);
  });
  it('shuffles without repeats and keeps families apart', () => {
    const show = shuffleShow(new Rng(42), 12, 'neon');
    const ids = show.segments.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const fams = ids.map((id) => templateById(id)!.theme);
    for (let i = 1; i < fams.length; i++) expect(fams[i]).not.toBe(fams[i - 1]);
  });
});

describe('segues', () => {
  const defs = CURATED.map((id) => templateById(id)!);
  it('auto never repeats a segue and only drops floors that can open', () => {
    for (const style of ['neon', 'ink']) {
      const s = chooseSegues(defs, 'auto', style, 9);
      expect(s.length).toBe(defs.length);
      for (let i = 0; i < s.length; i++) {
        expect(SEGUES).toContain(s[i]);
        if (i > 0) expect(s[i]).not.toBe(s[i - 1]);
        if (s[i] === 'drop') expect(defs[(i - 1 + defs.length) % defs.length].canDrop).toBe(true);
      }
    }
  });
  it('honours overrides, but turns an impossible drop into a dip', () => {
    const overrides = defs.map(() => undefined as (typeof SEGUES)[number] | undefined);
    overrides[3] = 'iris';
    const firstNoFloor = defs.findIndex((d, i) => i > 0 && !defs[i - 1].canDrop);
    overrides[firstNoFloor] = 'drop';
    const s = chooseSegues(defs, 'glide', 'neon', 1, overrides);
    expect(s[3]).toBe('iris');
    expect(s[firstNoFloor]).toBe('dip');
    expect(s[1]).toBe(firstNoFloor === 1 ? 'dip' : 'glide');
  });
});
