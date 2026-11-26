# Matter Theatre

- Read `docs/v5-plan.md` for the current handoff. `src/core/sim.ts` owns the physics shared by playback and headless tests. `src/core/Director.ts` schedules, pre-settles and transitions scenes. Author physical behavior in `src/templates/`, appearance in `src/styles/`, and show ordering and serialization in `src/show/`.
- Preserve deterministic replay with an isolated Matter.js engine and seeded RNG per scene, a fixed 120 Hz step and show-clock effects. Keep Pixi rendering interpolated. Pre-settling must leave scene time untouched. Register physical laws through `ctx.force` so settling and playback apply them alike.
- Preserve template IDs used by shared show URLs. For template edits, check the physical outcome and refresh Compose thumbnails via `docs/thumbnails.md`. Update both languages in `src/ui/i18n.ts` for UI copy changes.
- Use Node 22 as in CI, then `npm ci` and `npm run dev`. `npm test` covers headless physics, determinism and outcomes. `npm run build` type-checks and writes relative-path `dist/`. The Pages workflow tests and deploys qualifying pushes to `master` and skips Markdown-only pushes.
