import { neon } from './neon';
import { paper } from './paper';
import { ink } from './ink';
import { glass } from './glass';
import { cartoon } from './cartoon';
import type { StyleDef } from './types';

export const STYLES: StyleDef[] = [neon, paper, ink, glass, cartoon];

export const styleById = (id: string): StyleDef => STYLES.find((s) => s.id === id) ?? neon;
