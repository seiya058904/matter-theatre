import Matter from 'matter-js';

type Vector = Matter.Vector;
type AxisOverlap = { axis: Vector; overlap: number };
type OverlapAxes = (out: AxisOverlap, a: Vector[], b: Vector[], axes: Vector[]) => void;
type Detector = Parameters<typeof Matter.Detector.collisions>[0];

// Matter 0.20 calls this internal SAT hook with the first polygon's own axes.
// Keep the stock detector, contact generation, pair order and solver.
const collision = Matter.Collision as typeof Matter.Collision & { _overlapAxes?: OverlapAxes };
const originalOverlap = collision._overlapAxes;
const originalDetect = Matter.Detector.collisions;
const supported = (Matter as typeof Matter & { version?: string }).version === '0.20.0' && originalOverlap !== undefined;

interface Projections {
  axes: Vector[];
  stamps: Float64Array;
  min: Float64Array;
  max: Float64Array;
}

const projections = new WeakMap<Vector[], Projections>();
let pass = 0;

/** Reuse the projections of a polygon onto its own axes within a broadphase pass. */
function overlapAxes(out: AxisOverlap, a: Vector[], b: Vector[], axes: Vector[]): void {
  if (a.length < 10) {
    originalOverlap!(out, a, b, axes);
    return;
  }
  let p = projections.get(a);
  const count = axes.length;
  if (!p || p.axes !== axes || p.min.length !== count) {
    p = { axes, stamps: new Float64Array(count), min: new Float64Array(count), max: new Float64Array(count) };
    projections.set(a, p);
  }
  // On the first visit for this polygon, an early separating axis may leave some entries cold.
  const ax = a[0].x;
  const ay = a[0].y;
  const bx = b[0].x;
  const by = b[0].y;
  const aLength = a.length;
  const bLength = b.length;
  let overlapMin = Number.MAX_VALUE;
  let axisIndex = 0;
  for (let i = 0; i < count; i++) {
    const { x, y } = axes[i];
    if (p.stamps[i] !== pass) {
      let min = ax * x + ay * y;
      let max = min;
      for (let j = 1; j < aLength; j++) {
        const v = a[j];
        const dot = v.x * x + v.y * y;
        if (dot > max) max = dot;
        else if (dot < min) min = dot;
      }
      p.min[i] = min;
      p.max[i] = max;
      p.stamps[i] = pass;
    }
    let min = bx * x + by * y;
    let max = min;
    for (let j = 1; j < bLength; j++) {
      const v = b[j];
      const dot = v.x * x + v.y * y;
      if (dot > max) max = dot;
      else if (dot < min) min = dot;
    }
    const ab = p.max[i] - min;
    const ba = max - p.min[i];
    const overlap = ab < ba ? ab : ba;
    if (overlap < overlapMin) {
      overlapMin = overlap;
      axisIndex = i;
      if (overlap <= 0) break;
    }
  }
  out.axis = axes[axisIndex];
  out.overlap = overlapMin;
}

function detect(detector: Detector): ReturnType<typeof originalDetect> {
  if (detector.bodies.length < 64) return originalDetect(detector);
  pass++;
  collision._overlapAxes = overlapAxes;
  try {
    return originalDetect(detector);
  } finally {
    collision._overlapAxes = originalOverlap;
  }
}

/** Scope the SAT cache to collision detection, so event handlers and direct queries use Matter as usual. */
export function updatePhysics(engine: Matter.Engine, ms: number): void {
  if (!supported) {
    Matter.Engine.update(engine, ms);
    return;
  }
  const previous = Matter.Detector.collisions;
  Matter.Detector.collisions = detect;
  try {
    Matter.Engine.update(engine, ms);
  } finally {
    Matter.Detector.collisions = previous;
  }
}
