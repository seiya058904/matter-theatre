# Matter Theatre · 物理剧场

A composable physics show built on [Matter.js](https://brm.io/matter-js/) and [PixiJS](https://pixijs.com/).

Open the page and the show starts: a hand-picked running order of short physics templates, joined by smooth segues, playing in a loop. There is no title card, no ending and no text inside the picture. Open **Compose** to arrange your own running order from 60 templates, choose one of five looks and the segue at every junction, then export the whole show as a video.

## Principles

- **Only physics moves things.** Gravity, contacts, friction, restitution, constraints, Hookean springs, inverse-square and Coulomb fields drive everything. A template may only set initial conditions and then *let go*: release a ball, open a gate or a latch, cut a string, start a visible motor, or turn a container. Nothing is nudged, clamped or teleported afterwards.
- **Templates are building blocks.** Each one is a self-contained clip of 9 to 15 s: a calm establishing state, one release, a clear visual moment, a composed end. Any template can follow any other.
- **No stutter.** Physics runs at a fixed 120 Hz with render interpolation. The next template is built and pre-settled off-screen in small slices during the previous one. Shaders, textures and shared geometry are prepared before the first frame.

## Templates (60, in 11 families)

| Family | Templates |
|---|---|
| Collision | Newton's Cradle · Stacked Drop · Break Shot · Bounce Ladder · Recoil Carts · Gas Expansion · Curling |
| Gravity | Falling Choir · Brachistochrone · Friction Glide · Projectile Fan · Tumbling Room · Trapdoor Shelves · Cascade Bounce |
| Granular | Galton Cascade · Hourglass · Avalanche · Water Wheel · Rotating Drum · Size Sieve · Sand Strata |
| Balance | Balance Scale · Roly-poly · Pyramid Demolition · Log Pile · Calder Mobile · Cairn |
| Oscillation | Pendulum Wave · Double Pendulum · Spring Lissajous · Coupled Pendulums · Wrecking Ball · Spring Organ |
| Ropes | Rope Bridge · Chain Slide · Bead Curtain · Rope Drape |
| Soft bodies | Soft Bloom · Jelly Steps · Soft Collision · Bouncing Ring |
| Machines | Ferris Wheel · Shishi-odoshi · Mangonel · Overbalanced Wheel · Cam Wave · Slingshot |
| Chain reactions | Growing Dominoes · Domino Stairs · Seesaw Toss · Pendulum Relay · Rube Relay |
| Fields | Kepler's Orrery · Binary Star · Coulomb Crystal · Ionic Clusters · Accretion |
| Patterns | Kaleidoscope · Stadium Billiards · Settled Mosaic |

Two physics notes:

- Matter's soft constraints lose most of their energy within about two seconds. Springs that should keep ringing (Lissajous, Spring Organ, Coupled Pendulums) use a true Hookean force (`spring()` in the kit) instead.
- Matter's compound bodies omit the parallel-axis term from their moment of inertia. `compound()` restores it, which is what keeps levers, buckets and wheels stable.

## Looks

Five complete looks: **Neon** (glowing outlines, aurora or grid horizon), **Paper** (layered cut paper with soft shadows), **Ink** (brush strokes on rice paper), **Glass** (refractive gems) and **Cartoon** (bold outlines, flat colour, squash and stretch). Each look defines materials, impacts, particles, trails, two procedural backdrops and one finishing grade.

## Segues

Glide (one long take), dissolve, iris, ink bleed, zoom-through, dip, and **floor drop**, where the outgoing template's floor opens and everything falls away. **Auto** picks one per junction from how the outgoing template ends (settled, periodic or flowing) and never repeats the previous one. Each junction can be overridden from the running-order strip.

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production bundle in dist/
npm test         # unit tests (vitest)
```

Keyboard: `Space` play/pause · `←` `→` previous/next template · `E` compose · `F` fullscreen · `Esc` close or cancel a recording.

### URL parameters (previews and QA)

| Parameter | Effect |
|---|---|
| `#show=…` | A shared show (written automatically while you compose) |
| `?only=galton,kepler` | Play only these templates |
| `?all` | Play every template in library order |
| `?style=ink&bg=1&link=dissolve` | Override look, backdrop and default segue |
| `?item=3&t=6&pause` | Jump to template 3 at 6 s and pause |

In the console, `__mt.director.qa(def)` reports setup and step timings, body counts and escaped bodies for a template; `__mt.director.probe(def, times)` samples where its bodies are.

## Architecture

```
src/
  core/       Stage (Pixi app, letterboxed 1920×1080 space, finish pass, quality governor),
              Director (schedule, off-screen prebuild and presettle, segues, loop, thumbnails, QA), Camera, Timeline, Rng
  render/     SceneRenderer (shared GraphicsContexts, interpolated views, rope trails, impacts), Fx (pooled particles)
  fx/         GLSL: procedural backdrops, finishing grade, ink-bleed reveal
  styles/     five StyleDefs
  templates/  kit.ts (physical building blocks) and one file per family
  show/       ShowConfig, presets and shuffle, segue selection, schedule, URL serialization
  ui/         watch chrome, compose bench, export dialog, i18n
  export/     MediaRecorder wrapper
public/thumbs/<look>/<template>.jpg   pre-rendered library thumbnails
```

**Templates never pick colours.** A template gives each body a *role* (`hero`, `accent`, `structure`, `ground`) and a position along the look's colour ramp; the look decides the rest, so every template works in every look.

Each template has its own Matter engine, renderer, camera and seeded RNG, and its script runs on physics time, so a show unfolds the same way every time and an export matches the preview.

### Thumbnails

Library thumbnails are pre-rendered into `public/thumbs`, so composing never runs a simulation. After adding or changing a template, regenerate them as described in [docs/thumbnails.md](docs/thumbnails.md). A missing file falls back to rendering in idle time.

## Video export

Export records the whole running order once, in real time, to MP4 (H.264) when the browser supports it and WebM otherwise, at 720p or 1080p. Keep the tab in the foreground while recording.

## License

Private project. Matter.js (MIT) and PixiJS (MIT) are used as dependencies.
