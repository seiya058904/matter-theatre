import type { Director } from '../core/Director';
import type { Stage } from '../core/Stage';
import type { Family, Lang, SceneDef } from '../core/types';
import { Rng } from '../core/rng';
import { TEMPLATES, FAMILIES, templateById } from '../templates';
import { STYLES, styleById } from '../styles';
import { css, ramp } from '../styles/color';
import { LINKS, type LinkMode, type Segue, type ShowConfig } from '../show/ShowConfig';
import { PRESETS, shuffleShow } from '../show/presets';
import { encodeShow } from '../show/serialize';
import { Recorder, download, pickFormat } from '../export/Recorder';
import { getLang, setLang, t, type Key } from './i18n';

const svg = (d: string, fill = false) => `<svg viewBox="0 0 24 24" class="${fill ? 'f' : 's'}" aria-hidden="true">${d}</svg>`;

const ICON = {
  play: svg('<path d="M8 5.5v13l10.5-6.5z"/>', true),
  pause: svg('<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/>', true),
  prev: svg('<path d="M6 5h2v14H6zM19 5.5v13L9.5 12z"/>', true),
  next: svg('<path d="M16 5h2v14h-2zM5 5.5v13L14.5 12z"/>', true),
  compose: svg('<rect x="3.5" y="4" width="17" height="10" rx="2"/><path d="M5 19h3M10.5 19h3M16 19h3"/>'),
  export: svg('<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14"/>'),
  full: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  close: svg('<path d="M7 7l10 10M17 7 7 17"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  shuffle: svg('<path d="M4 7h3.5l9 10H20M4 17h3.5l2.5-2.8M14 9.8 16.5 7H20M17.5 4.5 20 7l-2.5 2.5M17.5 14.5 20 17l-2.5 2.5"/>'),
  link: svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  loop: svg('<path d="M17 7H8a4 4 0 0 0 0 8h1M14 4l3 3-3 3M7 17h9a4 4 0 0 0 0-8h-1"/>'),
  chevron: svg('<path d="M7 10l5 5 5-5"/>'),
  grip: svg('<circle cx="9" cy="8" r="1.3"/><circle cx="15" cy="8" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="16" r="1.3"/><circle cx="15" cy="16" r="1.3"/>', true),
};

/** One glyph per segue, drawn like chalk diagrams. */
const SEGUE_ICON: Record<LinkMode, string> = {
  auto: svg('<path d="M12 3v5M12 16v5M3 12h5M16 12h5"/><circle cx="12" cy="12" r="2"/>'),
  glide: svg('<path d="M3 12h15M14 7l5 5-5 5M3 7h6M3 17h6"/>'),
  dissolve: svg('<circle cx="9" cy="12" r="5.5"/><circle cx="15" cy="12" r="5.5"/>'),
  iris: svg('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/>'),
  ink: svg('<path d="M12 4c2.6 0 3.6 2.4 5.6 3.6s2.8 3.8 1 5.8-1.6 5.6-5.6 5.6-5.4-1.4-6.6-4.4.2-4.6 1.8-6.4S9.6 4 12 4z"/>'),
  zoom: svg('<rect x="8.5" y="8.5" width="7" height="7"/><path d="M4 4l4 4M20 4l-4 4M4 20l4-4M20 20l-4-4"/>'),
  dip: svg('<path d="M4 5h16M12 8v9M8 13l4 4 4-4M4 20h16"/>'),
  drop: svg('<path d="M3 9h6M15 9h6M12 3v13M8 12l4 4 4-4M7 21h10"/>'),
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

function button(html: string, label: string, onClick: (e: MouseEvent) => void, cls = 'icon'): HTMLButtonElement {
  const b = el('button', cls, html);
  b.type = 'button';
  b.title = label;
  b.setAttribute('aria-label', label);
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick(e);
  });
  return b;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const pad = (n: number) => String(n).padStart(2, '0');
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Reorder {
  from: number;
  to: number;
  startX: number;
  step: number;
  cards: HTMLElement[];
}

/**
 * Two states. Watching: the picture fills the window; a small capsule of controls floats over its
 * lower edge only while the pointer moves. Composing: the stage glides into a rounded monitor; a
 * slim bar of looks runs along the top, the template library stands on the right, and the running
 * order lies along the bottom as a row of cue cards joined by segue knobs — all on one fixed screen.
 */
export class App {
  cfg: ShowConfig;
  private root = document.getElementById('ui')!;
  private stageEl = document.getElementById('stage')!;
  private brand = el('div', 'brand');
  private transport = el('div', 'transport');
  private bar = el('div', 'bar');
  private barHead = el('i', 'bar-head');
  private playBtn!: HTMLButtonElement;
  private now = el('div', 'now');
  private clock = el('span', 'clock');
  private monitor = el('div', 'monitor');
  private top = el('header', 'topbar');
  private library = el('aside', 'library');
  private deck = el('section', 'deck');
  private strip = el('ol', 'strip');
  private popover = el('div', 'popover');
  private toastEl = el('div', 'toast');
  private hint = el('div', 'hint');
  private family: Family = 'collision';
  private idleTimer = 0;
  private thumbs = new Map<string, string>();
  private thumbQueue: { def: SceneDef; imgs: HTMLImageElement[] }[] = [];
  private thumbBusy = false;
  private thumbGen = 0;
  private recording = false;
  private recorder = new Recorder();
  private lastIndex = -1;
  private composing = false;
  private reorder: Reorder | null = null;
  private recBox: HTMLElement | null = null;

  constructor(
    private stage: Stage,
    private director: Director,
    initial: ShowConfig,
    /** Remember the show for the next visit (off while a preview URL is open, until the show is edited). */
    private persist = true,
  ) {
    this.cfg = initial;
    this.deck.setAttribute('aria-label', t('order'));
    this.library.setAttribute('aria-label', t('library'));
    this.deck.append(this.strip);
    this.root.append(this.monitor, this.brand, this.top, this.library, this.deck, this.transport, this.popover, this.toastEl, this.hint);
    this.buildTransport();
    this.director.onItem = () => this.onItem();
    this.apply(initial, 0);
    this.bindInput();
    this.hint.textContent = t('hint');
    setTimeout(() => this.hint.classList.add('gone'), 6500);
    window.addEventListener('resize', () => this.layout());
    this.layout();
  }

  // ---------------- show state ----------------

  /** Applies a show. `keep`: an edit — the template on stage carries on if it is still item `startItem`. */
  apply(cfg: ShowConfig, startItem = 0, keep = false): void {
    this.cfg = cfg;
    const style = styleById(cfg.style);
    this.director.load(cfg, style, clamp(startItem, 0, Math.max(0, cfg.segments.length - 1)), { keep });
    document.documentElement.style.setProperty('--accent', style.accent);
    if (this.persist) localStorage.setItem('mt.show.v4', encodeShow(cfg));
    history.replaceState(null, '', '#show=' + encodeShow(cfg));
    this.renderBrand();
    this.renderBar();
    if (this.composing) this.renderCompose();
  }

  /**
   * Edits the show. By default the template on stage carries on (it is re-timed in the new running
   * order); `jumpTo` moves the show to that item instead.
   */
  private update(mut: (c: ShowConfig) => void, jumpTo?: number, playingAt?: number): void {
    const c = clone(this.cfg);
    mut(c);
    this.persist = true;
    if (jumpTo !== undefined) this.apply(c, jumpTo);
    else this.apply(c, playingAt ?? this.director.currentIndex, true);
  }

  /** A whole new show chosen by the visitor (a house show or a shuffle). */
  private choose(cfg: ShowConfig): void {
    this.persist = true;
    this.apply(cfg, 0);
  }

  private onItem(): void {
    this.renderBar();
    if (this.composing) this.markStrip();
  }

  // ---------------- transport (both states) ----------------

  private buildTransport(): void {
    this.transport.innerHTML = '';
    this.bar = el('div', 'bar');
    this.barHead = el('i', 'bar-head');
    this.playBtn = button(ICON.pause, t('pause'), () => this.togglePlay(), 'icon play');
    const keys = el('div', 'keys');
    keys.append(button(ICON.prev, t('prev'), () => this.step(-1)), this.playBtn, button(ICON.next, t('next'), () => this.step(1)));
    const side = el('div', 'side');
    side.append(
      button(`${ICON.compose}<span>${t('compose')}</span>`, t('compose'), () => this.toggleCompose(), 'pill quiet compose'),
      button(ICON.export, t('export'), () => this.openExport(), 'icon export'),
      button(t('lang'), t('langName'), () => this.toggleLang(), 'icon lang'),
      button(ICON.full, t('fullscreen'), () => this.toggleFull(), 'icon'),
    );
    this.bar.append(this.barHead);
    this.bar.addEventListener('click', (e) => {
      const r = this.bar.getBoundingClientRect();
      const d = this.director;
      const at = ((e.clientX - r.left) / r.width) * d.total;
      const i = d.items.findIndex((it) => at >= it.start && at < it.start + it.dur);
      if (i >= 0) d.seek(i);
    });
    const mid = el('div', 'mid');
    mid.append(this.now, this.bar, this.clock);
    this.transport.append(keys, mid, side);
    this.renderBar();
  }

  private renderBrand(): void {
    const s = styleById(this.cfg.style);
    this.brand.innerHTML = `<b>物理剧场</b><span>Matter Theatre</span><em>${s.name[getLang()]}</em>`;
  }

  /** The show's progress line: one segment per template, in the look's colours. */
  private renderBar(): void {
    const d = this.director;
    this.bar.querySelectorAll('.seg').forEach((n) => n.remove());
    const lang = getLang();
    const st = styleById(this.cfg.style);
    d.items.forEach((it, i) => {
      const seg = el('span', 'seg' + (i === d.currentIndex ? ' on' : ''));
      seg.style.left = `${(it.start / Math.max(d.total, 1e-6)) * 100}%`;
      seg.style.width = `${(it.dur / Math.max(d.total, 1e-6)) * 100}%`;
      seg.style.setProperty('--c', css(ramp(st.ramp, d.items.length > 1 ? i / (d.items.length - 1) : 0.5)));
      seg.dataset.label = `${pad(i + 1)}  ${it.def.title[lang]}`;
      this.bar.insertBefore(seg, this.barHead);
    });
    const cur = d.items[d.currentIndex];
    this.now.innerHTML = cur ? `<b>${pad(d.currentIndex + 1)}</b><span>${cur.def.title[lang]}</span><em>${cur.def.law[lang]}</em>` : '';
  }

  tick(): void {
    const d = this.director;
    if (d.total > 0) {
      const p = Math.min(1, d.passTime / d.total);
      this.barHead.style.left = `${p * 100}%`;
      this.clock.textContent = `${fmt(d.passTime)} / ${fmt(d.total)}`;
      if (this.composing) {
        const it = d.items[d.currentIndex];
        const card = this.strip.querySelector<HTMLElement>(`.cue[data-i="${d.currentIndex}"]`);
        if (it && card) card.style.setProperty('--p', String(clamp((d.passTime - it.start) / it.dur, 0, 1)));
      }
    }
    if (d.currentIndex !== this.lastIndex) {
      this.lastIndex = d.currentIndex;
      this.renderBar();
      if (this.composing) this.markStrip();
    }
    const playing = d.playing;
    if (this.playBtn.dataset.state !== String(playing)) {
      this.playBtn.dataset.state = String(playing);
      this.playBtn.innerHTML = playing ? ICON.pause : ICON.play;
      this.playBtn.title = playing ? t('pause') : t('play');
      this.playBtn.setAttribute('aria-label', this.playBtn.title);
    }
    if (this.recording) this.updateRecProgress();
  }

  private step(dir: 1 | -1): void {
    const d = this.director;
    const n = d.items.length;
    if (!n) return;
    d.seek((d.currentIndex + dir + n) % n);
  }

  private togglePlay(): void {
    this.director.playing = !this.director.playing;
    this.wake();
  }

  private toggleLang(): void {
    const next: Lang = getLang() === 'zh' ? 'en' : 'zh';
    setLang(next);
    this.buildTransport();
    this.renderBrand();
    this.hint.textContent = t('hint');
    if (this.composing) this.renderCompose();
  }

  private toggleFull(): void {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  }

  private bindInput(): void {
    const wake = () => this.wake();
    window.addEventListener('pointermove', wake);
    window.addEventListener('pointerdown', (e) => {
      wake();
      if (!this.popover.contains(e.target as Node)) this.closePopover();
    });
    window.addEventListener('keydown', (e) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (this.recording) {
        if (e.key === 'Escape') this.stopRecording(true);
        return;
      }
      if (e.code === 'Space' && !(e.target as HTMLElement)?.closest('button')) {
        e.preventDefault();
        this.togglePlay();
      } else if (e.key === 'ArrowRight' && !e.altKey) this.step(1);
      else if (e.key === 'ArrowLeft' && !e.altKey) this.step(-1);
      else if (e.key === 'e' || e.key === 'E') this.toggleCompose();
      else if (e.key === 'f' || e.key === 'F') this.toggleFull();
      else if (e.key === 'Escape') {
        if (this.popover.classList.contains('open')) this.closePopover();
        else this.toggleCompose(false);
      }
      wake();
    });
    this.wake();
  }

  private wake(): void {
    document.body.classList.remove('idle');
    clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => {
      if (this.director.playing && !this.composing && !this.transport.matches(':hover')) document.body.classList.add('idle');
    }, 2400);
  }

  private toast(msg: string): void {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    clearTimeout(Number(this.toastEl.dataset.t));
    this.toastEl.dataset.t = String(setTimeout(() => this.toastEl.classList.remove('show'), 2000));
  }

  // ---------------- layout ----------------

  /**
   * Places everything for the current state. While composing, the full-window canvas is moved and
   * scaled by a compositor transform so its 16:9 picture lands exactly in the monitor, and clipped
   * to the monitor's rounded corners — nothing is re-rendered.
   */
  private layout(): void {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const pw = Math.min(W, (H * 16) / 9);
    const ph = (pw * 9) / 16;
    const px = (W - pw) / 2;
    const py = (H - ph) / 2;
    const st = this.stageEl.style;
    const rootStyle = document.documentElement.style;
    if (!this.composing) {
      st.transform = 'translate(0px, 0px) scale(1)';
      st.clipPath = `inset(0px 0px 0px 0px round 0px)`;
      return;
    }
    const g = W < 1200 ? 10 : 16;
    // Narrow or portrait windows stack the library under the monitor instead of beside it.
    const narrow = W < 860 || H > W * 1.05;
    document.body.classList.toggle('narrow', narrow);
    const topH = 56;
    const n = Math.max(1, this.cfg.segments.length);
    const stripW = W - g * 2;
    // Cue cards shrink to fit the whole running order on one line.
    const knob = 28;
    const cardW = clamp((stripW - 24 - n * knob) / n, 56, 168);
    const cardH = Math.round((cardW * 9) / 16);
    const stripH = Math.max(cardH, 46) + 30;
    const libW = narrow ? 0 : Math.round(clamp(W * 0.22, 288, 380));
    const transportH = 48;
    const area: Rect = { x: g, y: topH + g * 0.5, w: W - libW - g * (narrow ? 2 : 3), h: H - topH - stripH - transportH - g * 2.5 };
    if (narrow) area.h = Math.min(area.h, H * 0.34);
    const mw = Math.min(area.w, (area.h * 16) / 9);
    const mh = (mw * 9) / 16;
    const mon: Rect = { x: area.x + (area.w - mw) / 2, y: area.y, w: mw, h: mh };
    const s = mon.w / pw;
    st.transform = `translate(${mon.x - px * s}px, ${mon.y - py * s}px) scale(${s})`;
    const r = 12 / s;
    st.clipPath = `inset(${py}px ${W - px - pw}px ${H - py - ph}px ${px}px round ${r}px)`;
    const set = (k: string, v: number) => rootStyle.setProperty(k, `${Math.round(v * 10) / 10}px`);
    set('--mon-x', mon.x);
    set('--mon-y', mon.y);
    set('--mon-w', mon.w);
    set('--mon-h', mon.h);
    set('--lib-w', libW);
    set('--strip-h', stripH);
    set('--card-w', cardW);
    set('--card-h', cardH);
    set('--gap', g);
    set('--top-h', topH);
  }

  // ---------------- composing ----------------

  private toggleCompose(force?: boolean): void {
    const open = force ?? !this.composing;
    if (open === this.composing) return;
    this.composing = open;
    document.body.classList.toggle('composing', open);
    this.closePopover();
    if (open) {
      const cur = this.director.items[this.director.currentIndex];
      if (cur) this.family = cur.def.theme;
      this.renderCompose();
    }
    this.layout();
    this.wake();
  }

  private renderCompose(): void {
    this.thumbQueue = [];
    this.thumbGen++;
    this.renderTop();
    this.renderStrip();
    this.renderLibrary();
    this.layout();
  }

  /**
   * Thumbnails ship pre-rendered (public/thumbs/<look>/<id>.jpg), so composing never simulates
   * anything. Only a missing file falls back to rendering one in idle time.
   */
  private thumb(def: SceneDef): HTMLImageElement {
    const img = el('img');
    img.alt = '';
    img.decoding = 'async';
    img.draggable = false;
    const key = this.cfg.style + '/' + this.cfg.bg + '/' + def.id;
    const cached = this.thumbs.get(key);
    if (cached) {
      img.src = cached;
      return img;
    }
    img.addEventListener(
      'error',
      () => {
        const q = this.thumbQueue.find((x) => x.def === def);
        if (q) q.imgs.push(img);
        else this.thumbQueue.push({ def, imgs: [img] });
        this.pumpThumbs();
      },
      { once: true },
    );
    img.src = `${import.meta.env.BASE_URL}thumbs/${this.cfg.style}/${def.id}.jpg`;
    return img;
  }

  /** The top bar: looks as gels, the backdrop, the default segue, house shows and the show's actions. */
  private renderTop(): void {
    const lang = getLang();
    this.top.innerHTML = '';
    const brand = el('div', 'wordmark', `<b>物理剧场</b><span>Matter Theatre</span>`);
    const looks = el('div', 'group gels');
    looks.setAttribute('role', 'radiogroup');
    looks.setAttribute('aria-label', t('look'));
    for (const st of STYLES) {
      const stops = [0, 0.25, 0.5, 0.75, 1].map((k) => css(ramp(st.ramp, k))).join(',');
      const on = st.id === this.cfg.style;
      const b = button(`<i style="background:conic-gradient(from 210deg,${stops},${css(ramp(st.ramp, 0))})"></i><span>${st.name[lang]}</span>`, `${st.name[lang]} — ${st.mood[lang]}`, () => this.update((c) => (c.style = st.id)), 'gel' + (on ? ' on' : ''));
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(on));
      looks.append(b);
    }
    const style = styleById(this.cfg.style);
    const drops = el('div', 'seg-ctl');
    drops.setAttribute('role', 'radiogroup');
    drops.setAttribute('aria-label', t('backdrop'));
    drops.style.setProperty('--i', String(this.cfg.bg));
    drops.append(el('i', 'thumb-ind'));
    style.backgrounds.forEach((bg, i) => {
      const b = button(bg.name[lang], `${t('backdrop')}: ${bg.name[lang]}`, () => this.update((c) => (c.bg = i as 0 | 1)), i === this.cfg.bg ? 'on' : '');
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(i === this.cfg.bg));
      drops.append(b);
    });
    const segue = button(`${SEGUE_ICON[this.cfg.link]}<span>${t(`link.${this.cfg.link}` as Key)}</span>${ICON.chevron}`, t('segueDefault'), (e) => this.openLinkMenu(e.currentTarget as HTMLElement), 'drop-btn');
    const segWrap = el('div', 'labelled');
    segWrap.append(el('small', '', t('segueDefault')), segue);
    const shows = button(`<span>${t('houseShows')}</span>${ICON.chevron}`, t('houseShows'), (e) => this.openShowsMenu(e.currentTarget as HTMLElement), 'drop-btn');
    const acts = el('div', 'acts');
    acts.append(
      shows,
      button(ICON.shuffle, t('shuffle'), () => this.choose(shuffleShow(new Rng((Math.random() * 1e9) | 0), 12, this.cfg.style)), 'icon'),
      button(ICON.link, t('share'), () => this.share(), 'icon'),
      button(ICON.export, t('export'), () => this.openExport(), 'icon export'),
      button(t('lang'), t('langName'), () => this.toggleLang(), 'icon lang'),
      button(t('done'), t('done'), () => this.toggleCompose(false), 'pill'),
    );
    this.top.append(brand, looks, drops, segWrap, acts);
  }

  /** The running order: cue cards joined by segue knobs; the last knob loops back to the start. */
  private renderStrip(): void {
    const lang = getLang();
    this.strip.innerHTML = '';
    this.strip.classList.toggle('empty', !this.cfg.segments.length);
    if (!this.cfg.segments.length) {
      const e = el('li', 'strip-empty');
      e.textContent = t('empty');
      this.strip.append(e);
      return;
    }
    const st = styleById(this.cfg.style);
    const n = this.cfg.segments.length;
    this.cfg.segments.forEach((seg, i) => {
      const def = templateById(seg.id);
      if (!def) return;
      const li = el('li', 'cue');
      li.dataset.i = String(i);
      li.tabIndex = 0;
      li.title = `${pad(i + 1)} ${def.title[lang]} — ${def.law[lang]}`;
      li.setAttribute('aria-label', li.title);
      li.style.setProperty('--c', css(ramp(st.ramp, n > 1 ? i / (n - 1) : 0.5)));
      const pic = el('div', 'pic');
      pic.append(this.thumb(def), el('b', 'num', pad(i + 1)), el('span', 'grip', ICON.grip));
      const len = button(t(`len${seg.len}` as Key), t('lenTitle'), () => this.update((c) => (c.segments[i].len = ((seg.len + 1) % 3) as 0 | 1 | 2)), 'len' + (seg.len !== 1 ? ' set' : ''));
      const rm = button(ICON.close, t('remove'), () => this.removeAt(i), 'rm');
      li.append(pic, len, rm);
      li.addEventListener('pointerdown', (e) => this.pressCue(e, li, i));
      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.director.seek(i);
        else if (e.key === 'Delete' || e.key === 'Backspace') this.removeAt(i);
        else if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
          e.preventDefault();
          this.move(i, i + (e.key === 'ArrowLeft' ? -1 : 1), true);
        }
      });
      this.strip.append(li);
      this.strip.append(this.knob((i + 1) % n, i === n - 1));
    });
    this.markStrip();
  }

  private removeAt(i: number): void {
    const def = templateById(this.cfg.segments[i]?.id ?? '');
    const cur = this.director.currentIndex;
    // Removing the cue on stage moves on to its neighbour; removing any other leaves the stage alone.
    if (cur === i) this.update((c) => c.segments.splice(i, 1), Math.max(0, Math.min(i, this.cfg.segments.length - 2)));
    else this.update((c) => c.segments.splice(i, 1), undefined, cur > i ? cur - 1 : cur);
    if (def) this.toast(t('removed', { name: def.title[getLang()] }));
  }

  private move(from: number, to: number, focus = false): void {
    const n = this.cfg.segments.length;
    to = clamp(to, 0, n - 1);
    if (to === from) return;
    // The cue on stage keeps playing wherever it now stands.
    const cur = this.director.currentIndex;
    const at = cur === from ? to : cur > from && cur <= to ? cur - 1 : cur < from && cur >= to ? cur + 1 : cur;
    this.update(
      (c) => {
        const [m] = c.segments.splice(from, 1);
        c.segments.splice(to, 0, m);
      },
      undefined,
      at,
    );
    if (focus) this.strip.querySelector<HTMLElement>(`.cue[data-i="${to}"]`)?.focus();
  }

  private knob(into: number, isLoop: boolean): HTMLLIElement {
    const li = el('li', 'joint' + (isLoop ? ' loop' : ''));
    const seg = this.cfg.segments[into];
    const auto = this.director.items[into]?.segue ?? 'dissolve';
    const chosen = seg?.segue;
    const shown: LinkMode = chosen ?? (this.cfg.link === 'auto' ? auto : this.cfg.link);
    const name = t(`link.${shown}` as Key);
    const label = `${t('segueInto', { n: into + 1 })} · ${chosen ? name : t('autoPicked', { name })}${isLoop ? ' · ' + t('loopBack') : ''}`;
    const b = button(SEGUE_ICON[shown], label, (e) => this.openSeguePicker(into, e.currentTarget as HTMLElement), 'knob' + (chosen ? ' set' : ''));
    li.append(b);
    if (isLoop) li.append(el('span', 'loop-mark', ICON.loop));
    return li;
  }

  private markStrip(): void {
    const cur = this.director.currentIndex;
    this.strip.querySelectorAll<HTMLElement>('.cue').forEach((n) => {
      const on = Number(n.dataset.i) === cur;
      n.classList.toggle('live', on);
      if (on) n.style.setProperty('--p', '0');
    });
  }

  // ---------------- drag to reorder (cards follow the pointer) ----------------

  private pressCue(e: PointerEvent, card: HTMLElement, index: number): void {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;
    card.setPointerCapture(e.pointerId);
    card.classList.add('pressed');
    const onMove = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 6) {
        moved = true;
        this.beginReorder(card, index, startX);
      }
      if (moved) this.moveReorder(ev.clientX);
    };
    const onUp = (ev: PointerEvent) => {
      card.removeEventListener('pointermove', onMove);
      card.removeEventListener('pointerup', onUp);
      card.removeEventListener('pointercancel', onUp);
      card.classList.remove('pressed');
      if (moved) this.endReorder(ev.type === 'pointercancel');
      else this.director.seek(index);
    };
    card.addEventListener('pointermove', onMove);
    card.addEventListener('pointerup', onUp);
    card.addEventListener('pointercancel', onUp);
  }

  private beginReorder(card: HTMLElement, from: number, startX: number): void {
    const cards = Array.from(this.strip.querySelectorAll<HTMLElement>('.cue'));
    const step = cards.length > 1 ? cards[1].getBoundingClientRect().left - cards[0].getBoundingClientRect().left : card.offsetWidth;
    this.reorder = { from, to: from, startX, step, cards };
    this.strip.classList.add('reordering');
    card.classList.add('lifted');
    this.closePopover();
  }

  private moveReorder(x: number): void {
    const r = this.reorder;
    if (!r) return;
    const n = r.cards.length;
    const dx = clamp(x - r.startX, -r.from * r.step - 20, (n - 1 - r.from) * r.step + 20);
    r.to = clamp(r.from + Math.round(dx / r.step), 0, n - 1);
    r.cards.forEach((c, j) => {
      if (j === r.from) c.style.transform = `translateX(${dx}px) translateY(-6px) scale(1.06)`;
      else if (j > r.from && j <= r.to) c.style.transform = `translateX(${-r.step}px)`;
      else if (j < r.from && j >= r.to) c.style.transform = `translateX(${r.step}px)`;
      else c.style.transform = '';
    });
  }

  private endReorder(cancel: boolean): void {
    const r = this.reorder;
    this.reorder = null;
    if (!r) return;
    const card = r.cards[r.from];
    if (cancel || r.to === r.from) {
      this.strip.classList.remove('reordering');
      r.cards.forEach((c) => (c.style.transform = ''));
      card.classList.remove('lifted');
      return;
    }
    // Settle into the slot, then commit.
    card.style.transform = `translateX(${(r.to - r.from) * r.step}px)`;
    card.classList.remove('lifted');
    setTimeout(() => {
      this.strip.classList.remove('reordering');
      this.move(r.from, r.to);
    }, 160);
  }

  // ---------------- library ----------------

  /** Family tabs and the cards of one family. Click a card to add it; drag it onto the strip to place it. */
  private renderLibrary(): void {
    const lang = getLang();
    this.library.innerHTML = '';
    const fams = el('nav', 'families');
    fams.setAttribute('aria-label', t('library'));
    for (const f of FAMILIES) {
      const b = button(f.name[lang], f.name[lang], () => {
        this.family = f.id;
        this.renderLibrary();
      }, 'fam' + (f.id === this.family ? ' on' : ''));
      fams.append(b);
    }
    const grid = el('div', 'cards');
    const counts = new Map<string, number>();
    for (const s of this.cfg.segments) counts.set(s.id, (counts.get(s.id) ?? 0) + 1);
    const defs = TEMPLATES.filter((x) => x.theme === this.family);
    for (const def of defs) {
      const card = el('button', 'card');
      card.type = 'button';
      card.title = def.blurb[lang];
      const pic = el('div', 'pic');
      pic.append(this.thumb(def));
      const c = counts.get(def.id);
      if (c) pic.append(el('span', 'badge', t('inShow', { n: c })));
      pic.append(el('span', 'add', ICON.plus));
      const meta = el('div', 'meta', `<b>${def.title[lang]}</b><em>${def.law[lang]}</em>`);
      card.append(pic, meta);
      card.addEventListener('pointerdown', (e) => this.pressCard(e, card, def));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.addTemplate(def, this.cfg.segments.length);
        }
      });
      grid.append(card);
    }
    this.library.append(fams, grid);
  }

  private addTemplate(def: SceneDef, at: number): void {
    const cur = this.director.currentIndex;
    this.update((c) => c.segments.splice(at, 0, { id: def.id, len: 1 }), this.cfg.segments.length ? undefined : 0, cur >= at ? cur + 1 : cur);
    this.toast(t('added', { name: def.title[getLang()] }));
  }

  /** A library card: a click adds it at the end; dragging it lifts a copy that can be dropped anywhere on the strip. */
  private pressCard(e: PointerEvent, card: HTMLElement, def: SceneDef): void {
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let ghost: HTMLElement | null = null;
    let at = -1;
    const marker = el('i', 'insert');
    card.setPointerCapture(e.pointerId);
    card.classList.add('pressed');
    const onMove = (ev: PointerEvent) => {
      if (!ghost && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 8) {
        ghost = el('div', 'ghost');
        const img = card.querySelector('img');
        if (img) ghost.append(img.cloneNode() as HTMLImageElement);
        document.body.append(ghost);
        this.strip.append(marker);
        document.body.classList.add('dragging-card');
      }
      if (!ghost) return;
      ghost.style.transform = `translate(${ev.clientX - 60}px, ${ev.clientY - 40}px) rotate(-3deg)`;
      at = this.insertionAt(ev.clientX, ev.clientY);
      marker.classList.toggle('on', at >= 0);
      if (at >= 0) marker.style.left = `${this.insertionX(at)}px`;
    };
    const onUp = () => {
      card.removeEventListener('pointermove', onMove);
      card.removeEventListener('pointerup', onUp);
      card.removeEventListener('pointercancel', onUp);
      card.classList.remove('pressed');
      document.body.classList.remove('dragging-card');
      marker.remove();
      if (ghost) {
        ghost.remove();
        if (at >= 0) this.addTemplate(def, at);
      } else this.addTemplate(def, this.cfg.segments.length);
    };
    card.addEventListener('pointermove', onMove);
    card.addEventListener('pointerup', onUp);
    card.addEventListener('pointercancel', onUp);
  }

  /** Where on the strip a dragged card would go (or -1 when it is not over the strip). */
  private insertionAt(x: number, y: number): number {
    const r = this.deck.getBoundingClientRect();
    if (y < r.top - 30 || y > r.bottom + 10) return -1;
    const cards = Array.from(this.strip.querySelectorAll<HTMLElement>('.cue'));
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i].getBoundingClientRect();
      if (x < c.left + c.width / 2) return i;
    }
    return cards.length;
  }

  private insertionX(at: number): number {
    const cards = Array.from(this.strip.querySelectorAll<HTMLElement>('.cue'));
    const s = this.strip.getBoundingClientRect();
    if (!cards.length) return 12;
    if (at >= cards.length) return cards[cards.length - 1].getBoundingClientRect().right - s.left + 10;
    return cards[at].getBoundingClientRect().left - s.left - 10;
  }

  // ---------------- popovers ----------------

  /** One popover, grown out of the control that opened it. */
  private openPopover(anchor: HTMLElement, build: (box: HTMLElement) => void, place: 'above' | 'below'): void {
    this.popover.innerHTML = '';
    this.popover.className = 'popover ' + place;
    build(this.popover);
    const a = anchor.getBoundingClientRect();
    const w = this.popover.offsetWidth;
    const h = this.popover.offsetHeight;
    const left = clamp(a.left + a.width / 2 - w / 2, 10, window.innerWidth - w - 10);
    const topY = place === 'above' ? a.top - h - 12 : a.bottom + 10;
    this.popover.style.left = `${left}px`;
    this.popover.style.top = `${topY}px`;
    this.popover.style.setProperty('--ax', `${a.left + a.width / 2 - left}px`);
    requestAnimationFrame(() => this.popover.classList.add('open'));
    (this.popover.querySelector('.opt.on') as HTMLElement | null)?.focus({ preventScroll: true });
  }

  private closePopover(): void {
    this.popover.classList.remove('open');
  }

  private segueOptions(box: HTMLElement, current: LinkMode, pick: (s: LinkMode) => void, disable: (s: LinkMode) => boolean): void {
    const grid = el('div', 'opts');
    for (const s of LINKS) {
      const dis = disable(s);
      const b = button(`${SEGUE_ICON[s]}<span>${t(`link.${s}` as Key)}</span>`, dis ? t('dropNeedsFloor') : t(`link.${s}` as Key), () => {
        this.closePopover();
        pick(s);
      }, 'opt' + (s === current ? ' on' : ''));
      b.disabled = dis;
      grid.append(b);
    }
    box.append(grid);
  }

  private openSeguePicker(into: number, anchor: HTMLElement): void {
    const n = this.cfg.segments.length;
    const from = templateById(this.cfg.segments[(into - 1 + n) % n]?.id ?? '');
    const current: LinkMode = this.cfg.segments[into]?.segue ?? 'auto';
    this.openPopover(
      anchor,
      (box) => {
        box.append(el('p', 'pop-title', t('segueInto', { n: into + 1 })));
        this.segueOptions(
          box,
          current,
          (s) =>
            this.update((c) => {
              if (s === 'auto') delete c.segments[into].segue;
              else c.segments[into].segue = s as Segue;
            }),
          (s) => s === 'drop' && !from?.canDrop,
        );
      },
      'above',
    );
  }

  private openLinkMenu(anchor: HTMLElement): void {
    this.openPopover(
      anchor,
      (box) => {
        box.append(el('p', 'pop-title', t('segueDefault')));
        this.segueOptions(box, this.cfg.link, (s) => this.update((c) => (c.link = s)), () => false);
      },
      'below',
    );
  }

  private openShowsMenu(anchor: HTMLElement): void {
    const lang = getLang();
    this.openPopover(
      anchor,
      (box) => {
        const list = el('div', 'shows');
        for (const p of PRESETS) {
          const st = styleById(p.cfg.style);
          const on = encodeShow(p.cfg) === encodeShow(this.cfg);
          list.append(
            button(`<i style="background:linear-gradient(90deg,${st.ramp.map(css).join(',')})"></i><b>${p.name[lang]}</b><small>${p.note[lang]}</small>`, p.name[lang], () => {
              this.closePopover();
              this.choose(clone(p.cfg));
            }, 'opt show' + (on ? ' on' : '')),
          );
        }
        box.append(list);
      },
      'below',
    );
  }

  /**
   * Thumbnails are simulated and rendered one at a time in idle time while composing,
   * then cached for the session so each is built once.
   */
  private pumpThumbs(): void {
    if (this.thumbBusy) return;
    const next = this.thumbQueue.shift();
    if (!next || !this.composing) return;
    this.thumbBusy = true;
    const gen = this.thumbGen;
    const run = () => {
      const key = this.cfg.style + '/' + this.cfg.bg + '/' + next.def.id;
      if (gen !== this.thumbGen) {
        this.thumbBusy = false;
        this.pumpThumbs();
        return;
      }
      try {
        const url = this.thumbs.get(key) ?? this.director.thumbnail(next.def, 320);
        this.thumbs.set(key, url);
        for (const img of next.imgs) img.src = url;
      } catch (err) {
        console.warn('thumbnail failed', next.def.id, err);
      }
      this.thumbBusy = false;
      this.pumpThumbs();
    };
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
    if (idle) idle(run, { timeout: 700 });
    else setTimeout(run, 120);
  }

  private share(): void {
    const url = location.origin + location.pathname + '#show=' + encodeShow(this.cfg);
    navigator.clipboard?.writeText(url).then(
      () => this.toast(t('copied')),
      () => this.toast(url),
    );
  }

  // ---------------- export ----------------

  private openExport(): void {
    const fmtInfo = pickFormat();
    const dlg = el('div', 'modal');
    const box = el('div', 'dialog');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', t('exportTitle'));
    const close = () => {
      dlg.classList.remove('open');
      setTimeout(() => dlg.remove(), 200);
    };
    if (!fmtInfo) {
      box.innerHTML = `<h2>${t('exportTitle')}</h2><p>${t('unsupported')}</p>`;
      const row = el('div', 'row');
      row.append(button(t('cancel'), t('cancel'), close, 'pill quiet'));
      box.append(row);
    } else {
      box.innerHTML = `<h2>${t('exportTitle')}</h2><p>${t('exportNote', { s: Math.round(this.director.total) })}</p>
        <label>${t('resolution')}</label>
        <div class="seg-ctl res" style="--i:1"><i class="thumb-ind"></i><button type="button" data-w="1280" data-h="720">720p</button><button type="button" class="on" data-w="1920" data-h="1080">1080p</button></div>
        <label>${t('format')}</label><p class="fmt">${fmtInfo.label}</p>`;
      const row = el('div', 'row');
      const go = button(t('start'), t('start'), () => {
        const on = box.querySelector<HTMLButtonElement>('.res .on')!;
        close();
        this.startRecording(Number(on.dataset.w), Number(on.dataset.h));
      }, 'pill');
      row.append(button(t('cancel'), t('cancel'), close, 'pill quiet'), go);
      box.append(row);
      const ctl = box.querySelector<HTMLElement>('.res')!;
      ctl.querySelectorAll<HTMLButtonElement>('button').forEach((b, i) =>
        b.addEventListener('click', () => {
          ctl.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
          b.classList.add('on');
          ctl.style.setProperty('--i', String(i));
        }),
      );
    }
    dlg.append(box);
    dlg.addEventListener('pointerdown', (e) => e.target === dlg && close());
    this.root.append(dlg);
    requestAnimationFrame(() => dlg.classList.add('open'));
    box.querySelector<HTMLButtonElement>('.row .pill:last-child')?.focus();
  }

  private startRecording(w: number, h: number): void {
    const format = pickFormat();
    if (!format) return;
    this.toggleCompose(false);
    this.recording = true;
    document.body.classList.add('recording');
    this.stage.lockSize(w, h);
    this.director.loop = false;
    this.director.load(this.cfg, styleById(this.cfg.style), 0, { sync: true });
    this.recorder.start(this.stage.app.canvas as HTMLCanvasElement, format, w >= 1920 ? 16e6 : 8e6);
    this.recBox = el('div', 'recbox');
    this.root.append(this.recBox);
    this.director.onEnd = () => setTimeout(() => this.stopRecording(false), 1200);
  }

  private updateRecProgress(): void {
    if (!this.recBox) return;
    const d = this.director;
    const p = Math.min(1, d.time / d.total);
    this.recBox.innerHTML = `<i></i><span>${t('recording')}　${fmt(d.time)} / ${fmt(d.total)}　Esc ${t('cancel')}</span><em style="width:${p * 100}%"></em>`;
  }

  private async stopRecording(cancel: boolean): Promise<void> {
    if (!this.recording) return;
    this.recording = false;
    this.director.onEnd = null;
    this.director.loop = true;
    const format = pickFormat()!;
    if (cancel) this.recorder.cancel();
    else {
      const blob = await this.recorder.stop();
      const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
      download(blob, `matter-theatre-${this.cfg.style}-${stamp}.${format.ext}`);
      this.toast(t('exported'));
    }
    this.recBox?.remove();
    this.recBox = null;
    document.body.classList.remove('recording');
    this.stage.unlockSize();
    this.director.seek(0);
    this.layout();
  }
}
