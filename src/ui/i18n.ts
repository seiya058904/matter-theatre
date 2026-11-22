import type { Lang } from '../core/types';

const dict = {
  compose: { zh: '编排', en: 'Compose' },
  done: { zh: '完成', en: 'Done' },
  export: { zh: '导出', en: 'Export' },
  play: { zh: '播放', en: 'Play' },
  pause: { zh: '暂停', en: 'Pause' },
  prev: { zh: '上一段', en: 'Previous' },
  next: { zh: '下一段', en: 'Next' },
  fullscreen: { zh: '全屏', en: 'Fullscreen' },
  lang: { zh: 'EN', en: '中' },
  langName: { zh: '切换到英文', en: 'Switch to Chinese' },
  order: { zh: '演出顺序', en: 'Running order' },
  orderNote: { zh: '拖动可换位，圆钮是两段之间的转场，点一下可改', en: 'Drag to reorder · the round knobs are the segues, click one to change it' },
  loopBack: { zh: '回到开头', en: 'Back to the start' },
  library: { zh: '模板库', en: 'Templates' },
  styleTitle: { zh: '画风', en: 'Look' },
  background: { zh: '背景', en: 'Backdrop' },
  segueDefault: { zh: '默认转场', en: 'Default segue' },
  houseShows: { zh: '馆藏编排', en: 'House shows' },
  shuffle: { zh: '随机编排', en: 'Shuffle' },
  share: { zh: '复制链接', en: 'Copy link' },
  copied: { zh: '链接已复制', en: 'Link copied' },
  reset: { zh: '恢复默认', en: 'Reset' },
  remove: { zh: '移除', en: 'Remove' },
  added: { zh: '已加入：{name}', en: 'Added: {name}' },
  addHint: { zh: '点击卡片：加入并播放', en: 'Click a card to add and play it' },
  empty: { zh: '还没有片段，从下面的模板库挑一个', en: 'Nothing here yet: pick a template below' },
  len0: { zh: '短', en: 'S' },
  len1: { zh: '中', en: 'M' },
  len2: { zh: '长', en: 'L' },
  lenTitle: { zh: '时长：短 / 中 / 长', en: 'Length: short / medium / long' },
  inShow: { zh: '已在演出中', en: 'In the show' },
  'link.auto': { zh: '自动', en: 'Auto' },
  'link.glide': { zh: '横移', en: 'Glide' },
  'link.dissolve': { zh: '溶解', en: 'Dissolve' },
  'link.iris': { zh: '光圈', en: 'Iris' },
  'link.ink': { zh: '墨晕', en: 'Ink bleed' },
  'link.zoom': { zh: '推进', en: 'Zoom' },
  'link.dip': { zh: '沉入', en: 'Dip' },
  'link.drop': { zh: '坠落', en: 'Floor drop' },
  autoPicked: { zh: '自动：{name}', en: 'Auto: {name}' },
  dropNeedsFloor: { zh: '上一段没有可打开的地板', en: 'The previous template has no floor to open' },
  exportTitle: { zh: '导出整场演出', en: 'Export the whole show' },
  exportNote: { zh: '整场演出约 {s} 秒，会实时录制。录制时请让这个标签页保持在前台。', en: 'The show runs about {s}s and is recorded in real time. Keep this tab in front while it records.' },
  resolution: { zh: '分辨率', en: 'Resolution' },
  format: { zh: '格式', en: 'Format' },
  start: { zh: '开始录制', en: 'Start recording' },
  cancel: { zh: '取消', en: 'Cancel' },
  recording: { zh: '录制中', en: 'Recording' },
  exported: { zh: '已导出，开始下载', en: 'Exported, download started' },
  unsupported: { zh: '这个浏览器不支持录制视频，请换用最新版 Chrome 或 Edge。', en: 'This browser cannot record video. Try a current Chrome or Edge.' },
  hint: { zh: '空格 播放/暂停　← → 换段　E 编排　F 全屏', en: 'Space play/pause   ← → segment   E compose   F fullscreen' },
} satisfies Record<string, { zh: string; en: string }>;

export type Key = keyof typeof dict;

let lang: Lang = (localStorage.getItem('mt.lang') as Lang) || (navigator.language.startsWith('zh') ? 'zh' : 'en');

export const getLang = () => lang;
export const setLang = (l: Lang) => {
  lang = l;
  localStorage.setItem('mt.lang', l);
  document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en';
};
export const t = (k: Key, vars: Record<string, string | number> = {}) =>
  dict[k][lang].replace(/\{(\w+)\}/g, (_, v) => String(vars[v] ?? ''));
