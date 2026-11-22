import { OVERLAP } from './ShowConfig';

/** Start times for back-to-back segments that overlap by OVERLAP seconds, and the total length. */
export function schedule(durations: number[], overlap = OVERLAP): { starts: number[]; total: number } {
  const starts: number[] = [];
  let t = 0;
  durations.forEach((d, i) => {
    starts.push(t);
    t += d - (i < durations.length - 1 ? overlap : 0);
  });
  return { starts, total: durations.length ? t : 0 };
}
