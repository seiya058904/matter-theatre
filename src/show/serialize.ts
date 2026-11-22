import { LINKS, SEGUES, type LinkMode, type Segue, type SegmentRef, type ShowConfig } from './ShowConfig';

/**
 * Compact, human-readable show encoding for URL hashes:
 *   style.bg.link.seed~scene-id:len,scene-id:len
 */
export function encodeShow(c: ShowConfig): string {
  const head = [c.style, c.bg, c.link, c.seed.toString(36)].join('.');
  return head + '~' + c.segments.map((s) => `${s.id}:${s.len}${s.segue ? ':' + s.segue : ''}`).join(',');
}

export function decodeShow(text: string, isScene: (id: string) => boolean, isStyle: (id: string) => boolean): ShowConfig | null {
  const [head, body] = text.split('~');
  if (!head || body === undefined) return null;
  const [style, bg, link, seed] = head.split('.');
  if (!isStyle(style) || !LINKS.includes(link as LinkMode)) return null;
  const segments: SegmentRef[] = body
    .split(',')
    .filter(Boolean)
    .map((part) => {
      const [id, len, segue] = part.split(':');
      const l = Number(len);
      const ref: SegmentRef = { id, len: (l === 0 || l === 2 ? l : 1) as SegmentRef['len'] };
      if (segue && SEGUES.includes(segue as Segue)) ref.segue = segue as Segue;
      return ref;
    })
    .filter((s) => isScene(s.id));
  const n = parseInt(seed ?? '7', 36);
  return { v: 1, style, bg: bg === '1' ? 1 : 0, link: link as LinkMode, seed: Number.isFinite(n) ? n : 7, segments };
}
