# Feedback on v3 (input for the next round)

Recorded 2026-11-23 from the owner's review of the deployed v3. No work has started on these yet.

## 1. Templates (top priority)

- The library lacks distinctive, creative and genuinely fun templates. This is the main problem.
- Some existing templates have problems: they look unnatural, are not interesting enough, or are not creative enough.

## 2. Compose UI and overall interface: redesign and restructure

- The compose UI and the whole interface are poorly designed: uncoordinated, unnatural, with overlapping elements.
- The design language needs rethinking from the ground up. This covers how panels pop up, the UI motion, and tap/click feedback.
- The UI takes up too much of the picture, and it feels unnatural.
- Minimise dragging and scrolling. Keep everything on one fixed, non-scrolling screen, with controls in stable positions.
- Anything that can be dragged should look draggable in a natural way. The current design language there is wrong.

## 3. Looks and physical presentation

- The different looks (Neon, Paper, Ink, Glass, Cartoon) have unnatural details.
- The physics on screen looks unnatural in places.

## 4. Segues and fine-tuning

- Template-to-template segues and joins need tuning.
- Many specific details need tuning across the board.
- The front end needs visual polish.

## 5. Physics authenticity

- Audit whether all physics code is real and genuinely driven by the engine (Matter.js), with no faked motion.
- The result must be both truly physical and refined and beautiful.

## Status after v4 (2026-11-23)

What this round changed for each point above. The next review should judge these on the live show.

1. **Templates.**
   - Fifteen new templates: Ring Escape, Marble Race, Rolling Race, Trebuchet (replacing the mangonel), Ball Pit, Bounce Sorter, Three-Body Ballet, Sink or Float, Overloaded (a new Fluids family), Water Balloon, Bed of Nails, Harmonograph (replacing Spring Lissajous), Standing Waves and Cut the Rope.
   - Eleven weaker ones retired: Recoil Carts, Curling, Falling Choir, Friction Glide, Cascade Bounce, Cairn, Log Pile, Rope Drape, Coupled Pendulums, Mangonel and Spring Lissajous.
   - The soft-body family was rebuilt on a rubber-and-gas model, and Domino Stairs was redesigned.
   - The house show now opens with the new templates.
2. **Interface.**
   - New design language: a theatre control booth. While watching, there is only a capsule of controls.
   - While composing, everything sits on one fixed screen with no scrolling. The stage glides into a rounded monitor, the looks sit in a top bar as gels, the library is on the right, and the running order is a strip of cue cards that shrink to fit.
   - Cue cards show a grip, lift and follow the pointer, and the others make room. Library cards can be clicked to add or dragged into place.
   - Popovers grow out of their control, and every press gives feedback.
3. **Looks and presentation.**
   - Removed the clock-hand line on Neon balls and Paper's random crease, and toned down Glass chromatic aberration.
   - Added water for every look, and an impact squash with spring-back for Cartoon.
   - Fixed trails streaking after a jump.
4. **Segues.** The backdrop no longer jumps at a segue. Dissolve is staggered (no muddy double exposure), glide breathes less, and the floor drop now drops the floor instead of making it vanish.
5. **Physics authenticity.** The audit found and fixed:
   - Matter's fourfold inertia.
   - Static bodies losing their material.
   - 16-sided "circles" that would not roll.
   - Rotating gravity standing in for a turning container (Tumbling Room, Hourglass, Kaleidoscope).
   - Unequal forces in Binary Star.
   - Cams that slid instead of turning.
   - Springs applied twice.

   Every template is checked by `director.qa()` for NaN, escaped bodies and a calm start.

Still open:
- A few templates start with a gentle wobble rather than perfect rest (Jelly Rain, Jelly Steps, Rope Bridge, Seesaw Toss, Avalanche and Trapdoor Shelves).
- Fluids has only two templates.
- Thumbnails of the retired templates are still in `public/thumbs/*/` until someone approves deleting them.
