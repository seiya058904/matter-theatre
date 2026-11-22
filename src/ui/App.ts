import type { Director } from '../core/Director';
import type { Stage } from '../core/Stage';
import type { Family, Lang, SceneDef } from '../core/types';
import { Rng } from '../core/rng';
import { TEMPLATES, FAMILIES, templateById } from '../templates';
import { STYLES, styleById } from '../styles';
import { css, ramp } from '../styles/color';
import { LINKS, SEGUES, type LinkMode, type Segue, type ShowConfig } from '../show/ShowConfig';
import { DEFAULT_SHOW, PRESETS, shuffleShow } from '../show/presets';
import { encodeShow } from '../show/serialize';
import { Recorder, download, pickFormat } from '../export/Recorder';
import { getLang, setLang, t, type Key } from './i18n';

const svg = (d: string, fill = false) => `<svg viewBox="0 0 24 24" class="${fill ? 'f' : 's'}" aria-hidden="true">${d}</svg>`;

const ICON = {
  play: svg('<path d="M8 5.5v13l10.5-6.5z"/>', true),
  pause: svg('<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/>', true),
  prev: svg('<path d="M6 5h2v14H6zM19 5.5v13L9.5 12z"/>', true),
  next: svg('<path d="M16 5h2v14h-2zM5 5.5v13L14.5 12z"/>', true),
  compose: svg('<path d="M3 6h18M3 18h18M7 6v12M17 6v12"/>'),
  export: svg('<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14"/>'),
  full: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  shuffle: svg('<path d="M4 7h3.5l9 10H20M4 17h3.5l2.5-2.8M14 9.8 16.5 7H20M17.5 4.5 20 7l-2.5 2.5M17.5 14.5 20 17l-2.5 2.5"/>'),
  link: svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  reset: svg('<path d="M5 12a7 7 0 1 0 2-5M5 4v4h4"/>'),
  loop: svg('<path d="M17 7H8a4 4 0 0 0 0 8h1M14 4l3 3-3 3M7 17h9a4 4 0 0 0 0-8h-1"/>'),
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

/**
 * The interface has two states.
 * Watching: nothing but a hairline of progress at the bottom edge, with quiet controls on hover.
 * Composing: the stage rises into a framed monitor and an editing bench slides up beneath it —
 * the running order as a strip of frames joined by segue knobs, the template library and the looks.
 */
export class App {
  cfg: ShowConfig;
  private root = document.getElementById('ui')!;
  private brand = el('div', 'brand');
  private transport = el('div', 'transport');
  private rail = el('div', 'rail');
  private railHead = el('i', 'rail-head');
  private playBtn!: HTMLButtonElement;
  private now = el('div', 'now');
  private clock = el('span', 'clock');
  private monitor = el('div', 'monitor');
  private bench = el('section', 'bench');
  private stripEl = el('ol', 'strip');
  private libEl = el('div', 'library');
  private sideEl = el('div', 'side');
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
  private dragFrom = -1;
  private lastIndex = -1;

  constructor(
    private stage: Stage,
    private director: Director,
    initial: ShowConfig,
  ) {
    this.cfg = initial;
    this.bench.setAttribute('aria-label', t('compose'));
    this.root.append(this.brand, this.monitor, this.transport, this.bench, this.popover, this.toastEl, this.hint);
    this.buildTransport();
    this.buildBench();
    this.director.onItem = () => this.onItem();
    this.apply(initial, 0);
    this.bindInput();
    this.hint.textContent = t('hint');
    setTimeout(() => this.hint.classList.add('gone'), 7000);
    window.addEventListener('resize', () => this.layoutMonitor());
  }

  // ---------------- show state ----------------

  apply(cfg: ShowConfig, startItem = 0): void {
    const styleChanged = !this.stage.style || this.stage.style.id !== cfg.style || this.cfg.bg !== cfg.bg;
    this.cfg = cfg;
    const style = styleById(cfg.style);
    if (styleChanged || !this.stage.finish) this.stage.applyStyle(style, cfg.bg);
    this.director.load(cfg, style, Math.max(0, Math.min(startItem, cfg.segments.length - 1)));
    document.documentElement.style.setProperty('--accent', style.accent);
    localStorage.setItem('mt.show.v3', encodeShow(cfg));
    history.replaceState(null, '', '#show=' + encodeShow(cfg));
    this.renderBrand();
    this.renderRail();
    if (this.isComposing()) this.renderBench();
  }

  private update(mut: (c: ShowConfig) => void, startItem?: number): void {
    const c = clone(this.cfg);
    mut(c);
    this.apply(c, startItem ?? this.director.currentIndex);
  }

  private onItem(): void {
    this.renderRail();
    if (this.isComposing()) this.markStrip();
  }

  // ---------------- watching ----------------

  private buildTransport(): void {
    this.playBtn = button(ICON.pause, t('pause'), () => this.togglePlay(), 'icon play');
    const left = el('div', 'cluster');
    left.append(
      button(ICON.prev, t('prev'), () => this.step(-1)),
      this.playBtn,
      button(ICON.next, t('next'), () => this.step(1)),
      this.now,
    );
    const right = el('div', 'cluster');
    const lang = button('', t('langName'), () => this.toggleLang(), 'text lang');
    right.append(
      this.clock,
      button(`${ICON.compose}<span>${t('compose')}</span>`, t('compose'), () => this.toggleBench(), 'text compose'),
      button(`${ICON.export}<span>${t('export')}</span>`, t('export'), () => this.openExport(), 'text'),
      lang,
      button(ICON.full, t('fullscreen'), () => this.toggleFull()),
    );
    this.rail.append(this.railHead);
    this.rail.addEventListener('click', (e) => {
      const r = this.rail.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const d = this.director;
      const at = x * d.total;
      const i = d.items.findIndex((it) => at >= it.start && at < it.start + it.dur);
      if (i >= 0) d.seek(i);
    });
    const row = el('div', 'transport-row');
    row.append(left, right);
    this.transport.append(this.rail, row);
    this.refreshText();
  }

  private refreshText(): void {
    this.transport.querySelector('.lang')!.textContent = t('lang');
    this.hint.textContent = t('hint');
  }

  private renderBrand(): void {
    const s = styleById(this.cfg.style);
    this.brand.innerHTML = `<b>物理剧场</b><span>Matter Theatre</span><em>${s.name[getLang()]}</em>`;
  }

  /** The hairline: one tick per template, coloured along the look's ramp. */
  private renderRail(): void {
    const d = this.director;
    this.rail.querySelectorAll('.tick').forEach((n) => n.remove());
    if (!d.items.length) return;
    const st = styleById(this.cfg.style);
    const lang = getLang();
    d.items.forEach((it, i) => {
      const tick = el('span', 'tick' + (i === d.currentIndex ? ' on' : ''));
      tick.style.left = `${(it.start / d.total) * 100}%`;
      tick.style.width = `${(it.dur / d.total) * 100}%`;
      tick.style.setProperty('--c', css(ramp(st.ramp, d.items.length > 1 ? i / (d.items.length - 1) : 0.5)));
      tick.dataset.label = it.def.title[lang];
      this.rail.insertBefore(tick, this.railHead);
    });
    const cur = d.items[d.currentIndex];
    if (cur) this.now.innerHTML = `<b>${pad(d.currentIndex + 1)}</b><span>${cur.def.title[lang]}</span>`;
  }

  tick(): void {
    const d = this.director;
    if (d.total > 0) {
      const p = Math.min(1, d.passTime / d.total);
      this.railHead.style.transform = `translateX(${p * this.rail.clientWidth}px)`;
      this.clock.textContent = `${fmt(d.passTime)} / ${fmt(d.total)}`;
      if (this.isComposing()) {
        const it = d.items[d.currentIndex];
        const tile = this.stripEl.children[d.currentIndex * 2] as HTMLElement | undefined;
        if (it && tile) tile.style.setProperty('--p', String(Math.min(1, Math.max(0, (d.passTime - it.start) / it.dur))));
      }
    }
    if (d.currentIndex !== this.lastIndex) {
      this.lastIndex = d.currentIndex;
      this.renderRail();
      if (this.isComposing()) this.markStrip();
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
    // Rebuild the chrome in the new language.
    this.transport.innerHTML = '';
    this.rail = el('div', 'rail');
    this.railHead = el('i', 'rail-head');
    this.buildTransport();
    this.bench.innerHTML = '';
    this.buildBench();
    this.renderBrand();
    this.renderRail();
    if (this.isComposing()) this.renderBench();
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
      if (e.code === 'Space') {
        e.preventDefault();
        this.togglePlay();
      } else if (e.key === 'ArrowRight') this.step(1);
      else if (e.key === 'ArrowLeft') this.step(-1);
      else if (e.key === 'e' || e.key === 'E') this.toggleBench();
      else if (e.key === 'f' || e.key === 'F') this.toggleFull();
      else if (e.key === 'Escape') {
        if (this.popover.classList.contains('open')) this.closePopover();
        else this.toggleBench(false);
      }
      wake();
    });
    this.wake();
  }

  private wake(): void {
    document.body.classList.remove('idle');
    clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => {
      if (this.director.playing && !this.isComposing() && !this.transport.matches(':hover')) document.body.classList.add('idle');
    }, 2600);
  }

  private toast(msg: string): void {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    clearTimeout(Number(this.toastEl.dataset.t));
    this.toastEl.dataset.t = String(setTimeout(() => this.toastEl.classList.remove('show'), 2200));
  }

  // ---------------- composing ----------------

  private isComposing(): boolean {
    return document.body.classList.contains('composing');
  }

  private toggleBench(force?: boolean): void {
    const open = force ?? !this.isComposing();
    if (open === this.isComposing()) return;
    document.body.classList.toggle('composing', open);
    this.bench.setAttribute('aria-hidden', String(!open));
    this.closePopover();
    this.transport.querySelector('.compose span')!.textContent = open ? t('done') : t('compose');
    if (open) {
      const cur = this.director.items[this.director.currentIndex];
      if (cur) this.family = cur.def.theme;
      this.renderBench();
    }
    this.layoutMonitor();
    this.wake();
  }

  /** Shrinks the stage into a framed monitor above the bench (pure CSS transform: no re-render). */
  private layoutMonitor(): void {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const bench = this.bench.getBoundingClientRect().height || Math.min(470, Math.max(320, H * 0.46));
    const margin = 18;
    const s = Math.max(0.3, (H - bench - margin * 2 - 26) / H);
    const ty = margin + 26;
    document.documentElement.style.setProperty('--mon-s', s.toFixed(4));
    document.documentElement.style.setProperty('--mon-y', `${ty}px`);
    // The letterboxed 16:9 picture inside the full-window canvas, after the transform.
    const cw = Math.min(W, (H * 16) / 9);
    const ch = (cw * 9) / 16;
    const x0 = (W - cw) / 2;
    const y0 = (H - ch) / 2;
    const left = W / 2 + (x0 - W / 2) * s;
    const top = ty + y0 * s;
    Object.assign(this.monitor.style, { left: `${left}px`, top: `${top}px`, width: `${cw * s}px`, height: `${ch * s}px` });
  }

  private buildBench(): void {
    const head = el('header', 'bench-head');
    const title = el('h2');
    title.textContent = t('order');
    const note = el('p', 'bench-note');
    note.textContent = t('orderNote');
    head.append(title, note);
    const stripWrap = el('div', 'strip-wrap');
    stripWrap.append(this.stripEl);
    const lower = el('div', 'bench-lower');
    lower.append(this.libEl, this.sideEl);
    this.bench.append(head, stripWrap, lower);
    this.bench.setAttribute('aria-hidden', 'true');
  }

  private renderBench(): void {
    this.thumbQueue = [];
    this.thumbGen++;
    this.renderStrip();
    this.renderLibrary();
    this.renderSide();
    requestAnimationFrame(() => this.layoutMonitor());
  }

  /**
   * Thumbnails ship pre-rendered (public/thumbs/<look>/<id>.jpg), so composing never simulates
   * anything. Only a missing file falls back to rendering one in idle time.
   */
  private thumb(def: SceneDef, cls = ''): HTMLImageElement {
    const img = el('img', cls);
    img.alt = '';
    img.decoding = 'async';
    img.loading = 'lazy';
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

  /** The running order: frames joined by segue knobs, ending in a knob that loops back. */
  private renderStrip(): void {
    const lang = getLang();
    const d = this.director;
    this.stripEl.innerHTML = '';
    if (!this.cfg.segments.length) {
      const e = el('li', 'strip-empty');
      e.textContent = t('empty');
      this.stripEl.append(e);
      return;
    }
    const st = styleById(this.cfg.style);
    this.cfg.segments.forEach((seg, i) => {
      const def = templateById(seg.id);
      if (!def) return;
      const li = el('li', 'frame');
      li.draggable = true;
      li.tabIndex = 0;
      li.setAttribute('aria-label', `${pad(i + 1)} ${def.title[lang]}`);
      li.style.setProperty('--c', css(ramp(st.ramp, this.cfg.segments.length > 1 ? i / (this.cfg.segments.length - 1) : 0.5)));
      const pic = el('div', 'pic');
      pic.append(this.thumb(def));
      const cap = el('div', 'cap');
      cap.innerHTML = `<b>${pad(i + 1)}</b><span>${def.title[lang]}</span>`;
      const len = button(t(`len${seg.len}` as Key), t('lenTitle'), () => this.update((c) => (c.segments[i].len = ((seg.len + 1) % 3) as 0 | 1 | 2), i), 'len');
      const rm = button(ICON.close, t('remove'), () => this.update((c) => c.segments.splice(i, 1), Math.max(0, i - 1)), 'rm');
      li.append(pic, cap, len, rm);
      li.addEventListener('click', () => d.seek(i));
      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') d.seek(i);
        if (e.key === 'Delete' || e.key === 'Backspace') this.update((c) => c.segments.splice(i, 1), Math.max(0, i - 1));
      });
      li.addEventListener('dragstart', (e) => {
        this.dragFrom = i;
        li.classList.add('dragging');
        e.dataTransfer?.setData('text/plain', String(i));
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      });
      li.addEventListener('dragend', () => li.classList.remove('dragging'));
      li.addEventListener('dragover', (e) => {
        e.preventDefault();
        li.classList.add('over');
      });
      li.addEventListener('dragleave', () => li.classList.remove('over'));
      li.addEventListener('drop', (e) => {
        e.preventDefault();
        li.classList.remove('over');
        const from = this.dragFrom;
        this.dragFrom = -1;
        if (from < 0 || from === i) return;
        this.update((c) => {
          const [m] = c.segments.splice(from, 1);
          c.segments.splice(i, 0, m);
        }, i);
      });
      this.stripEl.append(li);
      // The knob after this frame is the segue into the next one (the last loops to the first).
      const into = (i + 1) % this.cfg.segments.length;
      this.stripEl.append(this.knob(into, i === this.cfg.segments.length - 1));
    });
    this.markStrip();
  }

  private knob(into: number, isLoop: boolean): HTMLLIElement {
    const li = el('li', 'joint' + (isLoop ? ' loop' : ''));
    const seg = this.cfg.segments[into];
    const auto = this.director.items[into]?.segue ?? 'dissolve';
    const chosen = seg?.segue;
    const shown: LinkMode = chosen ?? (this.cfg.link === 'auto' ? auto : this.cfg.link);
    const name = t(`link.${shown}` as Key);
    const label = chosen ? name : t('autoPicked', { name });
    const b = button(SEGUE_ICON[shown], `${label}${isLoop ? ' · ' + t('loopBack') : ''}`, (e) => this.openSeguePicker(into, e.currentTarget as HTMLElement), 'knob' + (chosen ? ' set' : ''));
    li.append(b);
    if (isLoop) li.append(el('span', 'loop-mark', ICON.loop));
    return li;
  }

  private markStrip(): void {
    const cur = this.director.currentIndex;
    Array.from(this.stripEl.children).forEach((n, k) => {
      if (!(n as HTMLElement).classList.contains('frame')) return;
      const on = k / 2 === cur;
      n.classList.toggle('live', on);
      if (on) (n as HTMLElement).style.setProperty('--p', '0');
    });
    const tile = this.stripEl.children[cur * 2] as HTMLElement | undefined;
    if (tile && this.isComposing()) {
      const wrap = this.stripEl.parentElement!;
      const l = tile.offsetLeft - wrap.clientWidth / 2 + tile.clientWidth / 2;
      wrap.scrollTo({ left: Math.max(0, l), behavior: 'smooth' });
    }
  }

  private openSeguePicker(into: number, anchor: HTMLElement): void {
    this.popover.innerHTML = '';
    const from = templateById(this.cfg.segments[(into - 1 + this.cfg.segments.length) % this.cfg.segments.length]?.id ?? '');
    const current = this.cfg.segments[into]?.segue;
    const opts: (Segue | 'auto')[] = ['auto', ...SEGUES];
    for (const s of opts) {
      const disabled = s === 'drop' && !from?.canDrop;
      const on = s === 'auto' ? !current : current === s;
      const b = button(`${SEGUE_ICON[s]}<span>${t(`link.${s}` as Key)}</span>`, disabled ? t('dropNeedsFloor') : t(`link.${s}` as Key), () => {
        this.closePopover();
        this.update((c) => {
          if (s === 'auto') delete c.segments[into].segue;
          else c.segments[into].segue = s;
        }, into);
      }, 'opt' + (on ? ' on' : ''));
      b.disabled = disabled;
      this.popover.append(b);
    }
    this.popover.classList.add('open');
    const r = anchor.getBoundingClientRect();
    const pw = 236;
    this.popover.style.left = `${Math.min(window.innerWidth - pw - 12, Math.max(12, r.left + r.width / 2 - pw / 2))}px`;
    this.popover.style.top = `${r.top - 12}px`;
    (this.popover.querySelector('.opt.on') as HTMLElement | null)?.focus();
  }

  private closePopover(): void {
    this.popover.classList.remove('open');
  }

  /** Family rail + the cards of one family. A click adds the template and plays it. */
  private renderLibrary(): void {
    const lang = getLang();
    this.libEl.innerHTML = '';
    const railEl = el('nav', 'families');
    railEl.setAttribute('aria-label', t('library'));
    for (const f of FAMILIES) {
      const count = TEMPLATES.filter((x) => x.theme === f.id).length;
      const b = button(`<span>${f.name[lang]}</span><small>${count}</small>`, f.name[lang], () => {
        this.family = f.id;
        this.renderLibrary();
      }, 'fam' + (f.id === this.family ? ' on' : ''));
      railEl.append(b);
    }
    const grid = el('div', 'cards');
    const inShow = new Set(this.cfg.segments.map((s) => s.id));
    for (const def of TEMPLATES.filter((x) => x.theme === this.family)) {
      const card = el('button', 'card' + (inShow.has(def.id) ? ' in' : ''));
      card.type = 'button';
      card.title = def.blurb[lang];
      const pic = el('div', 'pic');
      pic.append(this.thumb(def));
      if (inShow.has(def.id)) pic.append(el('span', 'badge', t('inShow')));
      const meta = el('div', 'meta');
      meta.innerHTML = `<b>${def.title[lang]}</b><em>${def.law[lang]}</em>`;
      card.append(pic, meta, el('span', 'plus', ICON.plus));
      card.addEventListener('click', () => {
        const at = this.cfg.segments.length;
        this.update((c) => c.segments.push({ id: def.id, len: 1 }), at);
        this.toast(t('added', { name: def.title[getLang()] }));
      });
      grid.append(card);
    }
    const head = el('p', 'lib-note');
    head.textContent = t('addHint');
    const right = el('div', 'lib-main');
    right.append(head, grid);
    this.libEl.append(railEl, right);
    railEl.querySelector('.fam.on')?.scrollIntoView({ block: 'nearest' });
  }

  private renderSide(): void {
    const lang = getLang();
    this.sideEl.innerHTML = '';
    // Looks: five lenses.
    const looks = el('div', 'block');
    looks.append(el('h3', '', t('styleTitle')));
    const lenses = el('div', 'lenses');
    for (const st of STYLES) {
      const stops = [0, 0.25, 0.5, 0.75, 1].map((k) => css(ramp(st.ramp, k))).join(',');
      const b = button(`<i style="background:conic-gradient(from 200deg,${stops},${css(ramp(st.ramp, 0))})"></i>`, `${st.name[lang]}: ${st.mood[lang]}`, () => this.update((c) => (c.style = st.id)), 'lens' + (st.id === this.cfg.style ? ' on' : ''));
      lenses.append(b);
    }
    const cur = styleById(this.cfg.style);
    const caption = el('p', 'lens-cap');
    caption.innerHTML = `<b>${cur.name[lang]}</b><span>${cur.mood[lang]}</span>`;
    looks.append(lenses, caption);
    const bgRow = el('div', 'toggle');
    bgRow.setAttribute('role', 'group');
    bgRow.setAttribute('aria-label', t('background'));
    styleById(this.cfg.style).backgrounds.forEach((bg, i) => {
      const b = button(bg.name[lang], `${t('background')}: ${bg.name[lang]}`, () => this.update((c) => (c.bg = i as 0 | 1)), i === this.cfg.bg ? 'on' : '');
      bgRow.append(b);
    });
    const bgLabel = el('label', '', t('background'));
    looks.append(bgLabel, bgRow);
    // Default segue.
    const segBlock = el('div', 'block');
    segBlock.append(el('h3', '', t('segueDefault')));
    const segRow = el('div', 'segues');
    for (const l of LINKS) {
      const b = button(SEGUE_ICON[l], t(`link.${l}` as Key), () => this.update((c) => (c.link = l)), 'seg' + (l === this.cfg.link ? ' on' : ''));
      segRow.append(b);
    }
    segBlock.append(segRow);
    // House shows.
    const shows = el('div', 'block');
    shows.append(el('h3', '', t('houseShows')));
    const list = el('div', 'shows');
    for (const p of PRESETS) {
      const st = styleById(p.cfg.style);
      const on = encodeShow(p.cfg) === encodeShow(this.cfg);
      const b = button(`<i style="background:linear-gradient(90deg,${st.ramp.map(css).join(',')})"></i><b>${p.name[lang]}</b><small>${p.note[lang]}</small>`, p.name[lang], () => this.apply(clone(p.cfg), 0), 'show' + (on ? ' on' : ''));
      list.append(b);
    }
    shows.append(list);
    const acts = el('div', 'acts');
    acts.append(
      button(`${ICON.shuffle}<span>${t('shuffle')}</span>`, t('shuffle'), () => this.apply(shuffleShow(new Rng((Math.random() * 1e9) | 0), 12, this.cfg.style), 0), 'text'),
      button(`${ICON.link}<span>${t('share')}</span>`, t('share'), () => this.share(), 'text'),
      button(`${ICON.reset}<span>${t('reset')}</span>`, t('reset'), () => this.apply(clone(DEFAULT_SHOW), 0), 'text'),
    );
    this.sideEl.append(looks, segBlock, shows, acts);
  }

  /**
   * Thumbnails are simulated and rendered one at a time in idle time while the bench is open,
   * then cached for the session so each is built once.
   */
  private pumpThumbs(): void {
    if (this.thumbBusy) return;
    const next = this.thumbQueue.shift();
    if (!next || !this.isComposing()) return;
    this.thumbBusy = true;
    const gen = this.thumbGen;
    const run = () => {
      const key = this.cfg.style + '/' + this.cfg.bg + '/' + next.def.id;
      if (gen !== this.thumbGen) {
        // The look changed while this one waited: it is stale.
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
    if (!fmtInfo) {
      box.innerHTML = `<h2>${t('exportTitle')}</h2><p>${t('unsupported')}</p>`;
      const row = el('div', 'row');
      row.append(button(t('cancel'), t('cancel'), () => dlg.remove(), 'pill ghost'));
      box.append(row);
    } else {
      box.innerHTML = `<h2>${t('exportTitle')}</h2><p>${t('exportNote', { s: Math.round(this.director.total) })}</p>
        <label>${t('resolution')}</label>
        <div class="toggle res"><button type="button" data-w="1280" data-h="720">720p</button><button type="button" class="on" data-w="1920" data-h="1080">1080p</button></div>
        <label>${t('format')}</label><p class="fmt">${fmtInfo.label}</p>`;
      const row = el('div', 'row');
      const go = button(t('start'), t('start'), () => {
        const on = box.querySelector<HTMLButtonElement>('.res .on')!;
        dlg.remove();
        this.startRecording(Number(on.dataset.w), Number(on.dataset.h));
      }, 'pill');
      row.append(button(t('cancel'), t('cancel'), () => dlg.remove(), 'pill ghost'), go);
      box.append(row);
      box.querySelectorAll<HTMLButtonElement>('.res button').forEach((b) =>
        b.addEventListener('click', () => {
          box.querySelectorAll('.res button').forEach((x) => x.classList.remove('on'));
          b.classList.add('on');
        }),
      );
    }
    dlg.append(box);
    dlg.addEventListener('click', (e) => e.target === dlg && dlg.remove());
    this.root.append(dlg);
    box.querySelector<HTMLButtonElement>('.pill:not(.ghost), .pill')?.focus();
  }

  private recBox: HTMLElement | null = null;

  private startRecording(w: number, h: number): void {
    const format = pickFormat();
    if (!format) return;
    this.toggleBench(false);
    this.recording = true;
    document.body.classList.add('recording');
    this.stage.lockSize(w, h);
    this.director.loop = false;
    this.director.load(this.cfg, styleById(this.cfg.style), 0);
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
  }
}
