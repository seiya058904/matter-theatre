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
| P2 | Looks, impact feedback, backdrops & segues | **Done** (P2 commit) |
| P3 | UI art & interaction polish, thumbnails | **Done** (P3 commit) |

## Next up

### P1 remainder — done

- [x] Trail-driven templates checked live (Playwright, real rendering): all read correctly. The
      double-pendulum "straight chords" were a snapshot artefact; stadium-billiards' straight chords are
      the physics.
- [x] ring-escape: all 5 balls out by ~8.4 s of 14 (gap phases, width, ring speeds and rim bounce
      retuned). The system is chaotic: the tuning was chosen for margin (all 5 out in 99/99 runs with
      start positions nudged by up to 1e-4 px), not just for one run that happens to work.
- [x] bounce-ladder: lower gravity and a smaller toss; the lively balls still arc at the end, none leave frame.
- [x] Small subjects reframed: newton-cradle, balance-scale, cam-wave.
- [x] Mass/material pass: rope-cut's light links stretched under the heavy balls (none reached its cup) —
      now an inextensible string carries each ball; balance-scale was still swinging at the end — now
      tips, sways and settles near level (within ~0.04 rad); its weights land centred, since an
      off-centre one tilted the hanging pan and crept off it on long cues. Rope and soft families reviewed live, no other defects found.
- [x] `outcomes.test.ts`: rope-cut, balance-scale, domino-growth, domino-stairs, chain-slide added;
      ring-escape tightened to all 5 balls.

### P2 — Looks, feedback, segues — done

- [x] Neon: checked live in dense scenes (galton) — no blow-out; aurora backdrop pulled back.
- [x] Paper: each piece sits on a darker card layer, hero pieces carry a second glued layer, card fibres.
- [x] Ink: per-piece wet/dry tone, a faint wet bleed, dry-brush (feibai) streaks along each stroke.
- [x] Glass: refraction band inside the rim, crisper rim and hairline, highlights on soft blobs too;
      caustic backdrop dimmed for a darker mood.
- [x] Cartoon: already met the brief (outlines, flat fills, squash) — unchanged.
- [x] Impact feedback weighed by the pair's reduced mass (impulse, not just speed); render only.
- [x] Segues: floor drop no longer double-exposes for ~1 s and lands with an ease-out; ink bleed fades
      the old scene out just as the ink front reaches the frame's farthest corner.

Not done (judged unnecessary): new particle kinds or per-look trail changes — live review found them
fitting already.

### P3 — UI & interaction — done

- [x] Reviewed watch bar, Compose, pickers and export dialog: the type scale, spacing and motion were
      already consistent; controls hide when idle and fade softly. No restyle needed.
- [x] Responsive fixes: below 860 px the Compose toolbar scrolls with its actions (and Done) pinned
      right — Done used to be cut off; on phones the watch bar no longer overlaps its buttons, and each
      action appears once; portrait windows use the stacked layout with 16:9 library cards (cards used
      to be cropped tall, with titles clipped); keyboard hints hidden on touch-only screens.
- [x] End-to-end check (Playwright): Compose, segue override, reorder (Alt+←/→), share URL restore,
      ←/→ and Space, 720p export start with progress and Esc cancel — no console errors.
- [x] Thumbnails regenerated wherever an opening frame changed (P1: 25, P2: 252).

Not verified: real fullscreen (F) — headless browsers cannot enter it.

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
- **2026-11-25 · P2** — Paper/ink/glass body rendering refined, impact feedback by impulse, dimmer
  neon/glass backdrops, cleaner floor-drop and ink-bleed segues; regenerated 252 thumbnails (cartoon
  unchanged).
- **2026-11-25 · P3** — Responsive Compose/watch bar fixes for narrow, phone and portrait windows;
  full core-flow check in a real browser.
- **2026-11-25 · Audit fixes** — An independent audit found two real defects in P1. balance-scale: the
  heavy weight landed off-centre, crept off its pan on 1.25× cues and the beam flipped (the old test
  passed only because the beam happened to swing through level at t = 11); weights now land centred
  and the test covers every cue length and both entry times, checking weights stay in their pans and
  the beam is near level and slow. ring-escape: "all 5 out" sat on a chaotic edge (a 1e-10 nudge lost a
  ball in ~1 of 4 runs); wider gaps and a softer rim give a margin. Also tied the ink-bleed fade to the
  ink front. Lesson: an outcome test must check the state is stable (and run at every cue length), not
  sample one instant.
