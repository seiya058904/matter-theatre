import Matter from 'matter-js';
import { Stage } from './core/Stage';
import { Director } from './core/Director';
import { TEMPLATES, templateById } from './templates';
import { STYLES, styleById } from './styles';
import type { ShowConfig } from './show/ShowConfig';
import { DEFAULT_SHOW } from './show/presets';
import { decodeShow } from './show/serialize';
import { App } from './ui/App';
import { getLang, setLang } from './ui/i18n';
import { prewarmTextures } from './render/SceneRenderer';

/** Query parameters that preview or test a show without becoming the visitor's saved show. */
const PREVIEW = ['only', 'all', 'style', 'bg', 'link', 'item', 'pause', 'qa'];

function initialShow(q: URLSearchParams): ShowConfig {
  const isScene = (id: string) => !!templateById(id);
  const isStyle = (id: string) => STYLES.some((s) => s.id === id);
  const fromHash = location.hash.startsWith('#show=') ? decodeShow(decodeURIComponent(location.hash.slice(6)), isScene, isStyle) : null;
  const saved = localStorage.getItem('mt.show.v4');
  let base: ShowConfig = fromHash ?? (saved ? decodeShow(saved, isScene, isStyle) : null) ?? JSON.parse(JSON.stringify(DEFAULT_SHOW));
  if (!base.segments.length) base = JSON.parse(JSON.stringify(DEFAULT_SHOW));
  // Preview/QA overrides: ?only=a,b  ?all  ?style=ink  ?bg=1  ?link=glide
  const only = q.get('only');
  if (only) base.segments = only.split(',').filter(isScene).map((id) => ({ id, len: 1 as const }));
  if (q.has('all')) base.segments = TEMPLATES.map((t) => ({ id: t.id, len: 1 as const }));
  if (q.get('style') && isStyle(q.get('style')!)) base.style = q.get('style')!;
  if (q.get('bg')) base.bg = q.get('bg') === '1' ? 1 : 0;
  if (q.get('link')) base.link = q.get('link') as ShowConfig['link'];
  return base;
}

async function boot(): Promise<void> {
  const q = new URLSearchParams(location.search);
  setLang(getLang());
  const stage = new Stage();
  await stage.init(document.getElementById('stage')!);
  const director = new Director(stage, templateById);
  const cfg = initialShow(q);
  stage.applyStyle(styleById(cfg.style), cfg.bg);
  // Compile shaders and build shared textures before anything is shown.
  prewarmTextures(stage.app.renderer);
  director.prewarm();
  const app = new App(stage, director, cfg, !PREVIEW.some((k) => q.has(k)));
  if (q.has('item')) {
    director.load(cfg, styleById(cfg.style), Number(q.get('item')), { sync: true });
    const t = Number(q.get('t') ?? 0);
    if (t) director.fastForward(t);
    if (q.has('pause')) director.playing = false;
  }
  stage.app.ticker.add((tk) => {
    director.frame(tk.deltaMS / 1000);
    app.tick();
    stage.govern(tk.deltaMS);
  });
  Object.assign(window, { __mt: { stage, director, app, TEMPLATES, STYLES, styleById, Matter } });
}

boot();
