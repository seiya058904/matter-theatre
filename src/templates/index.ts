import type { Family, L10n, SceneDef } from '../core/types';
import { COLLISION } from './collision';
import { GRAVITY } from './gravity';
import { GRANULAR } from './granular';
import { STACKING } from './stacking';
import { OSCILLATION } from './oscillation';
import { ROPE } from './rope';
import { SOFT } from './soft';
import { FLUID } from './fluid';
import { MACHINE } from './machine';
import { CHAIN } from './chain';
import { FIELD } from './field';
import { PATTERN } from './pattern';

/** The template library, grouped by family of behaviour. */
export const TEMPLATES: SceneDef[] = [...COLLISION, ...GRAVITY, ...GRANULAR, ...STACKING, ...OSCILLATION, ...ROPE, ...SOFT, ...FLUID, ...MACHINE, ...CHAIN, ...FIELD, ...PATTERN];

export const FAMILIES: { id: Family; name: L10n }[] = [
  { id: 'collision', name: { zh: '碰撞 · 动量', en: 'Collision' } },
  { id: 'gravity', name: { zh: '重力 · 下落', en: 'Gravity' } },
  { id: 'granular', name: { zh: '颗粒 · 流动', en: 'Granular' } },
  { id: 'stacking', name: { zh: '堆叠 · 平衡', en: 'Balance' } },
  { id: 'oscillation', name: { zh: '摆 · 振动', en: 'Oscillation' } },
  { id: 'rope', name: { zh: '绳 · 链', en: 'Ropes' } },
  { id: 'soft', name: { zh: '软体 · 气球', en: 'Soft bodies' } },
  { id: 'fluid', name: { zh: '流体 · 浮力', en: 'Fluids' } },
  { id: 'machine', name: { zh: '机械 · 机构', en: 'Machines' } },
  { id: 'chain', name: { zh: '连锁机关', en: 'Chain reactions' } },
  { id: 'field', name: { zh: '场 · 轨道', en: 'Fields' } },
  { id: 'pattern', name: { zh: '混沌 · 图案', en: 'Patterns' } },
];

export const templateById = (id: string): SceneDef | undefined => TEMPLATES.find((t) => t.id === id);
