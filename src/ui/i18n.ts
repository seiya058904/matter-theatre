import type { Lang } from '../core/types';

const dict = {
  compose: { zh: '编排', en: 'Compose' },
  done: { zh: '完成', en: 'Done' },
  export: { zh: '导出视频', en: 'Export video' },
  play: { zh: '播放', en: 'Play' },
  pause: { zh: '暂停', en: 'Pause' },
  prev: { zh: '上一段', en: 'Previous' },
  next: { zh: '下一段', en: 'Next' },
  fullscreen: { zh: '全屏', en: 'Fullscreen' },
  lang: { zh: 'EN', en: '中' },
  langName: { zh: '切换到英文', en: 'Switch to Chinese' },
  order: { zh: '演出顺序', en: 'Running order' },
  orderHint: { zh: '点卡片播放 · 拖动换位 · 圆钮是转场', en: 'Click a card to play it · drag to reorder · the knobs are the segues' },
  loopBack: { zh: '回到开头', en: 'Back to the start' },
  library: { zh: '模板库', en: 'Library' },
  look: { zh: '画风', en: 'Look' },
  backdrop: { zh: '背景', en: 'Backdrop' },
  segueDefault: { zh: '默认转场', en: 'Default segue' },
  houseShows: { zh: '馆藏编排', en: 'House shows' },
  shuffle: { zh: '随机编排', en: 'Shuffle' },
  share: { zh: '复制链接', en: 'Copy link' },
  copied: { zh: '链接已复制', en: 'Link copied' },
  reset: { zh: '恢复馆藏精选', en: 'Back to the house selection' },
  remove: { zh: '移除', en: 'Remove' },
  added: { zh: '已加入：{name}', en: 'Added: {name}' },
  removed: { zh: '已移除：{name}', en: 'Removed: {name}' },
  addTo: { zh: '加入演出', en: 'Add to the show' },
  empty: { zh: '还没有片段。点右边模板库里的任意一张卡片，把它加进来。', en: 'Nothing here yet. Click any card in the library to add it.' },
  len0: { zh: '短', en: 'S' },
  len1: { zh: '中', en: 'M' },
  len2: { zh: '长', en: 'L' },
  lenTitle: { zh: '时长：短 / 中 / 长（点一下切换）', en: 'Length: short / medium / long (click to change)' },
  inShow: { zh: '演出中 ×{n}', en: 'In show ×{n}' },
  'link.auto': { zh: '自动', en: 'Auto' },
  'link.glide': { zh: '横移', en: 'Glide' },
  'link.dissolve': { zh: '溶解', en: 'Dissolve' },
  'link.iris': { zh: '光圈', en: 'Iris' },
  'link.ink': { zh: '墨晕', en: 'Ink bleed' },
  'link.zoom': { zh: '推进', en: 'Zoom' },
  'link.dip': { zh: '沉入', en: 'Dip' },
  'link.drop': { zh: '坠落', en: 'Floor drop' },
  autoPicked: { zh: '自动：{name}', en: 'Auto: {name}' },
  segueInto: { zh: '进入第 {n} 段的转场', en: 'Segue into item {n}' },
  dropNeedsFloor: { zh: '上一段没有可以打开的地板', en: 'The previous template has no floor to open' },
  exportTitle: { zh: '导出整场演出', en: 'Export the whole show' },
  exportNote: { zh: '整场约 {s} 秒，会实时录制成视频。录制期间请让这个标签页保持在前台。', en: 'The show runs about {s} s and is recorded in real time. Keep this tab in front while it records.' },
  resolution: { zh: '分辨率', en: 'Resolution' },
  format: { zh: '格式', en: 'Format' },
  start: { zh: '开始录制', en: 'Start recording' },
  cancel: { zh: '取消', en: 'Cancel' },
  preparingRecording: { zh: '正在准备录制', en: 'Preparing to record' },
  recording: { zh: '录制中', en: 'Recording' },
  exportFailed: { zh: '视频录制失败，请重试', en: 'Recording failed. Try again.' },
  exported: { zh: '视频已导出，开始下载', en: 'Video exported, download started' },
  unsupported: { zh: '这个浏览器不能录制视频，请换用最新版 Chrome 或 Edge。', en: 'This browser cannot record video. Use a current Chrome or Edge.' },
  hint: { zh: '空格 播放/暂停　← → 换段　E 编排　F 全屏', en: 'Space play/pause   ← → change   E compose   F fullscreen' },
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
