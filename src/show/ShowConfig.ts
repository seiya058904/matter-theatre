export type Segue = 'glide' | 'dissolve' | 'iris' | 'ink' | 'zoom' | 'dip' | 'drop';
export type LinkMode = Segue | 'auto';

export interface SegmentRef {
  id: string;
  /** 0 = short, 1 = standard, 2 = long */
  len: 0 | 1 | 2;
  /** Segue into this segment; absent = follow the show's mode. */
  segue?: Segue;
}

export interface ShowConfig {
  v: 1;
  segments: SegmentRef[];
  style: string;
  bg: 0 | 1;
  link: LinkMode;
  seed: number;
}

export const LEN_SCALE = [0.82, 1, 1.25] as const;

/** Seconds two templates overlap while the segue plays. */
export const OVERLAP = 2.4;

export const SEGUES: Segue[] = ['glide', 'dissolve', 'iris', 'ink', 'zoom', 'dip', 'drop'];
export const LINKS: LinkMode[] = ['auto', ...SEGUES];
