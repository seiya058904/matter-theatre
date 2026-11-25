import Matter from 'matter-js';
import { describe, expect, it } from 'vitest';
import { buildSim, createEngine, settleAll, stepSim } from '../src/core/sim';
import { STEP } from '../src/core/types';
import { LEN_SCALE, OVERLAP } from '../src/show/ShowConfig';
import { neon } from '../src/styles/neon';
import { templateById } from '../src/templates';
import { stubGpu, stubRenderer } from './stubRenderer';

/**
 * A template's moment actually happens: played headless exactly as in a show (entering after a segue),
 * its payload ends up where the story says. Guards against the misfires a health check cannot see —
 * cargo that never leaves a shelf, beads jammed on a grate, a toss that misses its basket.
 */
function finale(id: string, o: { len?: number; enterAt?: number } = {}): Matter.Body[] {
  const def = templateById(id)!;
  // A cue can be shortened or lengthened (LEN_SCALE); the first cue and jumps enter early (0.6 s).
  const duration = def.duration * (o.len ?? 1);
  const engine = createEngine(def);
  const sim = buildSim(def, engine, stubRenderer(), { style: neon, seed: 7, index: 0, duration, enterAt: o.enterAt ?? OVERLAP, renderer: stubGpu });
  settleAll(sim);
  const steps = Math.round(duration / STEP);
  for (let k = 0; k < steps; k++) stepSim(sim, k * STEP, STEP);
  return Matter.Composite.allBodies(engine.world).filter((b) => !b.isStatic);
}

const radius = (bs: Matter.Body[], r: number) => bs.filter((b) => Math.abs((b.circleRadius ?? 0) - r) < 0.5);

describe('every payload arrives', () => {
  it('trapdoor-shelf: all three shelves empty into the basin', () => {
    const cargo = finale('trapdoor-shelf').filter((b) => b.bounds.max.x - b.bounds.min.x < 200);
    expect(cargo.length).toBe(30);
    for (const b of cargo) expect(b.position.y, `cargo #${b.id}`).toBeGreaterThan(820);
  });

  it('size-sieve: large beads roll on into their bin, small ones fall through', () => {
    const bs = finale('size-sieve');
    for (const b of radius(bs, 19)) expect(b.position.x, `large #${b.id}`).toBeGreaterThan(1350);
    // A sieve is not perfect: a small bead riding on a large one may be carried over the end.
    const small = radius(bs, 6.5);
    expect(small.filter((b) => b.position.x < 1340).length / small.length).toBeGreaterThan(0.6);
  });

  it('seesaw-toss: the light ball lands in the basket', () => {
    const [light] = radius(finale('seesaw-toss'), 20);
    expect(light.position.x).toBeGreaterThan(166);
    expect(light.position.x).toBeLessThan(334);
    expect(light.position.y).toBeGreaterThan(850);
  });

  it('soft-bloom: every jelly stays inside the bowl', () => {
    for (const b of finale('soft-bloom')) expect(b.position.y, `node #${b.id}`).toBeLessThan(955);
  });

  it('cargo-boat: the hull sinks and the wooden crates float up', () => {
    const bs = finale('cargo-boat');
    const hull = bs.find((b) => b.parts.length > 2)!;
    expect(hull.position.y).toBeGreaterThan(900);
    // By the end the first wooden crates are back at the surface (the rest are still rising).
    expect(bs.filter((b) => b.parts.length === 1 && b.position.y < 700).length).toBeGreaterThanOrEqual(2);
  });

  it('avalanche: most of the mound pours off the ledge', () => {
    const grains = radius(finale('avalanche'), 9.5);
    expect(grains.filter((b) => b.position.x > 560).length / grains.length).toBeGreaterThan(0.6);
  });

  it('rope-cut: each ball flies into the cup placed for it', () => {
    // Cups stand where a swing's bottom speed and the drop to the rim say each ball lands.
    const cups = [751, 1121, 1462];
    const balls = radius(finale('rope-cut'), 20).sort((a, b) => a.position.x - b.position.x);
    expect(balls.length).toBe(3);
    balls.forEach((b, i) => {
      expect(Math.abs(b.position.x - cups[i]), `ball ${i}`).toBeLessThan(50);
      expect(b.position.y, `ball ${i}`).toBeGreaterThan(900);
    });
  });

  it('balance-scale: the weights stay in their pans and the beam settles near level', () => {
    for (const len of LEN_SCALE)
      for (const enterAt of [0.6, OVERLAP]) {
        const at = `len ${len}, enter ${enterAt}`;
        const bs = finale('balance-scale', { len, enterAt });
        const beam = bs.find((b) => b.bounds.max.x - b.bounds.min.x > 700)!;
        const weights = bs.filter((b) => b.bounds.max.x - b.bounds.min.x < 80);
        expect(weights.length, at).toBe(3);
        // Pans hang at x = 600 and 1320 (beam ends ±360 from the centre); a weight that slid off would
        // be far below them.
        for (const w of weights) {
          expect(Math.min(Math.abs(w.position.x - 600), Math.abs(w.position.x - 1320)), `${at} #${w.id}`).toBeLessThan(80);
          expect(w.position.y, `${at} #${w.id}`).toBeLessThan(720);
        }
        // Clips cut short end while the beam is still swaying gently; full and long ones end near level.
        expect(Math.abs(beam.angle), at).toBeLessThan(len < 1 ? 0.08 : 0.04);
        expect(Math.abs(beam.angularVelocity) * 120, `${at} rad/s`).toBeLessThan(0.1);
      }
  });

  it('domino-growth and domino-stairs: every domino falls', () => {
    for (const id of ['domino-growth', 'domino-stairs']) {
      const dominoes = finale(id).filter((b) => !b.circleRadius);
      expect(dominoes.length, id).toBeGreaterThan(20);
      for (const b of dominoes) expect(Math.abs(b.angle), `${id} #${b.id}`).toBeGreaterThan(1);
    }
  });

  it('chain-slide: the whole chain ends up in the basket', () => {
    const links = radius(finale('chain-slide'), 7);
    expect(links.length).toBe(45);
    for (const b of links) expect(b.position.y, `link #${b.id}`).toBeGreaterThan(900);
  });

  it('ring-escape: every ball breaks out of all five rings', () => {
    const balls = radius(finale('ring-escape'), 14);
    expect(balls.length).toBe(5);
    for (const b of balls) expect(b.position.y, `ball #${b.id}`).toBeGreaterThan(870);
  });
}, 120000);
