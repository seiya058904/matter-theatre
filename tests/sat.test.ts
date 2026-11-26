import Matter from 'matter-js';
import { expect, it } from 'vitest';
import { updatePhysics } from '../src/core/physics';
import { createEngine } from '../src/core/sim';
import { STEP } from '../src/core/types';
import { templateById } from '../src/templates';

function fixture() {
  const engine = createEngine(templateById('ball-pit')!);
  const floor = Matter.Bodies.rectangle(200, 120, 400, 20, { isStatic: true });
  const beads = Array.from({ length: 84 }, (_, i) => {
    const b = Matter.Bodies.circle(28 + (i % 14) * 19, 28 - Math.floor(i / 14) * 19, 10 + (i % 3) * 0.1);
    Matter.Body.setAngularVelocity(b, (i % 7 - 3) * 0.02);
    return b;
  });
  Matter.Composite.add(engine.world, [floor, ...beads]);
  return { engine, floor, beads };
}

it('reuses SAT projections without changing contacts or body state', () => {
  const vanilla = fixture();
  const cached = fixture();
  const stockDetect = Matter.Detector.collisions;
  for (let i = 0; i < 360; i++) {
    const angle = Math.sin(i / 48) * 0.14;
    Matter.Body.setAngle(vanilla.floor, angle);
    Matter.Body.setAngle(cached.floor, angle);
    Matter.Engine.update(vanilla.engine, STEP * 1000);
    updatePhysics(cached.engine, STEP * 1000);
    expect(Matter.Detector.collisions).toBe(stockDetect);
    const state = ({ engine, beads }: ReturnType<typeof fixture>) => ({
      poses: beads.map((b) => {
        const { positionPrev, anglePrev } = b as Matter.Body & { positionPrev: Matter.Vector; anglePrev: number };
        return [b.position.x, b.position.y, b.angle, positionPrev.x, positionPrev.y, anglePrev];
      }),
      contacts: (engine.pairs.list as Matter.Pair[]).map(({ collision: c }) => [c.depth, c.normal.x, c.normal.y, c.tangent.x, c.tangent.y]),
    });
    expect(state(cached)).toEqual(state(vanilla));
  }
});
