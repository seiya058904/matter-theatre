# v5 Flagship Iteration — Plan & Handoff

Living plan for the v5 round ("no new bulk, all quality"). Whoever picks this up next — human or AI —
should read this file first, then continue from **Next up**. Update the status table and the log at
the end of every working session.

## Goal

Polish the existing Matter Theatre to showcase quality: 63 templates, 5 looks, the watch and compose
UI, physical realism and runtime stability. Audience: viewers who want an immersive show and video
creators who compose and export.

### Hard rules (from the brief — never break these)

- **Pure physics.** Motion comes only from real laws and initial conditions (release, open a gate, cut
  a string, a visible motor, tilting a container). No hidden corrective forces, clamping, teleporting
  or tweened fakes.
- **Deterministic.** Same seed + show config ⇒ identical frames live and in export, regardless of
  frame rate, resolution or performance tricks (`tests/physics.test.ts` checks bit-for-bit replays).
- **Clean stage.** No text, title cards, credits or watermarks on stage.
- **Templates are style-agnostic.** Templates pick roles (`hero`, `accent`, `structure`…), never
  colours; all 63 × 5 = 315 combinations must look native.
- **Fixed scope.** Do not add or remove templates (63), looks (5) or segues (7). No accounts, cloud,
  audio, timeline editor or on-stage captions. Keep the play → compose → URL share → local export loop.
- **Regression gate per phase.** Re-verify affected templates and core paths; no new physics blow-ups,
  leaks or performance regressions.

### Acceptance criteria

1. All 63 templates run their full cycle in all 5 looks: nothing escapes the stage, no tunnelling or
   jams, no chain reaction stalls, no console errors, no memory growth over long loops.
2. Smooth everywhere: dense granular/soft scenes, rapid cuts, all 7 segues (incl. floor drop), opening
   and closing Compose, 720p/1080p export — no visible hitches or flicker.
3. Flagship-grade art: the 5 looks clearly distinct in material, light, impact feedback, trails and
   endings; UI restrained and consistent.
4. Every template has a clear opening, a full middle and a natural ending within 9–15 s, and live
   playback matches the exported video.
5. Compose ordering, per-item segue overrides, URL share restore, shortcuts, fullscreen, `npm test`
   and `npm run build` all pass; Compose thumbnails match the real opening frames.

## Status

| Phase | Scope | Status |
| :--- | :--- | :--- |
| P0 | Bug audit, stability, frame-time spikes, calm starts, headless physics suite | **Done** (`482cb60`) |
| P1 | Template physics & composition polish | **Done** (`4aea02a`, CI fix, P1 finish) |
| P2 | Looks, impact feedback, backdrops & segues | Not started |
| P3 | UI art & interaction polish, thumbnails | Not started (thumbnails kept in sync so far) |

## Next up

### P1 remainder — done

- [x] Trail-driven templates checked live (Playwright, real rendering): all read correctly. The
      double-pendulum "straight chords" were a snapshot artefact; stadium-billiards' straight chords are
      the physics.
- [x] ring-escape: all 5 balls out by ~8.4 s of 14 (gap phases, width and ring speeds retuned).
- [x] bounce-ladder: lower gravity and a smaller toss; the lively balls still arc at the end, none leave frame.
- [x] Small subjects reframed: newton-cradle, balance-scale, cam-wave.
- [x] Mass/material pass: rope-cut's light links stretched under the heavy balls (none reached its cup) —
      now an inextensible string carries each ball; balance-scale was still swinging at the end — now
      tips, sways and settles level. Rope and soft families reviewed live, no other defects found.
- [x] `outcomes.test.ts`: rope-cut, balance-scale, domino-growth, domino-stairs, chain-slide added;
      ring-escape tightened to all 5 balls.

### P2 — Looks, feedback, segues

- [ ] Neon: layered glow without blown-out highlights.
- [ ] Paper: thicker multi-layer cut paper, fibre texture, soft drop shadows.
- [ ] Ink: wet/dry ink tones, dry-brush strokes, rice-paper white space.
- [ ] Glass: refraction layers, rim highlights, dark caustic mood.
- [ ] Cartoon: clean heavy outlines, bright flat fills, squash-and-stretch life.
- [ ] Impact feedback scaled by impulse (light touch restrained, heavy hit punchy), particles and
      trails matched to each look and never hiding the subject.
- [ ] Backdrops (2 per look) recede to support the foreground.
- [ ] Segue curves and edges, especially **floor drop** and **ink bleed**.

### P3 — UI & interaction

- [ ] Unify watch bar, Compose bench, pickers and export dialog: type scale, spacing, icons, contrast,
      micro-motion. Controls hidden by default, appear quietly on interaction, exit softly.
- [ ] Keyboard shortcuts, preview/reorder/single-item preview smoothness, export progress & cancel.
- [ ] Responsive centring across aspect ratios, zoom and fullscreen.
- [ ] Regenerate thumbnails for any template or look whose opening frame changes (`docs/thumbnails.md`).

## How to work

- `npm run dev` (Vite; port may differ), `npm test`, `npm run build`.
- **Headless suites** (`tests/`): `physics.test.ts` (health + determinism), `outcomes.test.ts` (story
  payloads arrive), `templates.test.ts`, `core.test.ts`. `REVIEW=1 npx vitest run tests/zz-review.test.ts
  --reporter=verbose` prints wake/peak/tail/framing per template (`IDS=a,b` to filter).
- **Contact sheets** (visual review): in the dev page (`?pause&only=galton`), call
  `__mt.director.snapshot(def, t, width)` for several times `t` per template, draw them onto one canvas
  and screenshot it with Playwright. Snapshots show bodies but not trails.
- **Probing**: build a sim in a scratch vitest file with `createEngine` / `buildSim` / `settleAll` /
  `stepSim` (see `tests/outcomes.test.ts`) and log positions; use `enterAt: OVERLAP` to match a show.
  Delete scratch tests afterwards.
- After changing any template's opening frame, regenerate its thumbnails in all 5 looks.
- Commit per phase with a clear message; keep this file's status and log current.

## Log

- **2026-11-25 · P0** — Smoother off-screen preparation, non-blocking seeks, calm starts, GPU
  pre-warming, headless physics suite (`482cb60`).
- **2026-11-25 · P1** — Fixed stalls in trapdoor-shelf, size-sieve, avalanche, ring-escape; fixed a
  P0 regression in soft-bloom (jellies spawned through the bowl); cargo-boat and seesaw-toss now play
  the story their blurbs tell; reframed/re-paced 11 templates; added `outcomes.test.ts`; regenerated 90
  thumbnails; documented Matter friction quirks in README (`4aea02a`).
- **2026-11-25 · CI fix** — First CI run of P0/P1 failed the calm-start check for `kaleidoscope` on
  Node 22 (local Node 24 passed). Root cause was real: several piles were only just at rest for seed 7
  and crept for other seeds (shows use random seeds). Lengthened presettles (kaleidoscope, hourglass,
  size-sieve), packed rotating-drum's grains without overlap (and split its colours so the mixing
  reads), and made `physics.test.ts` check the calm start for seeds 8 and 11 as well.
- **2026-11-25 · P1 finish** — ring-escape all 5 out; bounce-ladder fuller second half; closer cameras
  for newton-cradle, balance-scale, cam-wave; fixed rope-cut (stretching ropes, balls missed every cup)
  and balance-scale (never settled); five new outcome tests; regenerated 25 thumbnails. Note: run the
  Playwright CLI from outside the repo, or it writes `.playwright-cli/` logs into the working tree.
