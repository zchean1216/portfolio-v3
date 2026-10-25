# Working on this portfolio

Read README.md first (how to run, build, deploy, and where files live). This file is the process and the decisions
behind the current site, so a new session can continue without rediscovering them.

## Owner's preferences (keep these)

- **Art comes from the library or from the owner.** Never generate replacement art. If something new is needed, ask
  the owner to generate it, then process it (below).
- **Nothing follows the cursor.** Space art never drifts with the mouse. The only scroll effect is the hero art
  rising slightly as you scroll away.
- **Same colours as the library in both themes.** Light mode: ink line art on cream. Dark mode: cream "chalk" line
  art. Fire is the only coloured art (palette below).
- **Dark mode is the default.** A visitor who picks light keeps it (`localStorage pfx-theme`).
- **Things must stay put at every screen size** (see Positioning). Check 390, 768, 1024, 1440 and 1920 wide.
- **Don't disturb the owner's editor tab.** Test in a separate browser tab. Saving `space-layout.json` while they have
  unsaved editor changes can clash: the editor keeps a draft and merges, but ask before big JSON rewrites.

## Positioning (public/js/space-layout.js)

Each placed element (`desktop` / `mobile` lists in `public/data/space-layout.json`) lives in a host section
(`section` key → `HOSTS` selectors: home sections, `page-*` About inner pages, `case-*` case studies).

- `x`, `w`: % of the section width. `y`: % of section height. `h`: % of section **width** (keeps shape).
- `ay` (**content anchor**): the element's height position is tied to the nearest content edge:
  `{ p: child-index path from the section ('' = the section itself), s: 't'|'b', o: offset in section widths }`.
  It's recomputed on resize, so elements move with their text and cards instead of drifting.
- `area` (backdrops, star fields, asteroid field): a stretch of the section.
  - `{ l, r }`: fractions of the section width.
  - `{ t, b }`: fractions of its height, used as fallbacks.
  - `at` / `ab`: anchors for the top and bottom edges. Same shape as `ay`, plus `h` (another host key) or `q` (a
    section selector) when the anchor is outside its own section.
- **Backdrops stand on a divider line.** `ab` points at the nearest rule or border (`lineFor`). `focus: [x, 1]` keeps
  the picture's bottom on that line. Pictures cover their area (sides trimmed on narrow screens) and are never
  stretched.
- `fill: true` star fields cover their whole section (all phone star fields).
- `near.pin`: the older pinning method, still used by a few hero pieces.
- The timeline rocket's asset has `rail: true`, so it always rides the timeline line.
- The editor re-anchors on release: drag, arrows, resize and section moves all call `SL.anchorFrom`.

## Editor

`http://localhost:5173/?edit=1` (dev only, `public/dev/space-edit.js`). Drag and resize, the panel for
section / size / opacity / motion / "Keep in view", **P** to preview, **Save** writes the JSON through the dev
server (`vite.config.js` POST `/__space-layout`). Library showcase: `/dev/space-assets/`.

## Adding new art (the process used so far)

1. Put the source somewhere the dev server can serve (for example `public/dev/`, temporarily) and process it in a
   browser canvas:
   - cut sprite sheets into pieces by finding blank columns or rows
   - turn the cream paper into transparency with colour-to-alpha against the paper colour (sampled from a corner)
   - crop and align (for stages or frames, align on a shared anchor point so cross-fades don't jump)
2. Save with POST `/__save-asset?path=images/space/<folder>/<name>.webp` (dev server only; webp/png only), then remove
   the temporary source.
3. Register it in `space-layout.json` → `assets` (kinds: `ang` sparkles, `scene` layered mixes, `backdrop`, `stars`,
   `field`, `vignette`, `const`, `orbit`, `fixed`, `ground`, ...).
4. Colour: light mode uses the `sl-ink` SVG filter, dark mode `sl-chalk` (cream). Line art should be drawn ink-on-cream
   so both filters work.

**Backdrops** (`kind: "backdrop"`) are a JPG plus `iw` / `ih` and `parts`. Each part is
`[name, x, y, w, h, motion, ...params]` in source pixels, cut out with soft masks and animated. Motions: `bob`,
`drift`, `glide`, `tw`, `dot`, `twc`, `spin`, `puff`, `drive`, `glow`, `patch`. Strength per placement: `motion`.

**Fire palette** (rocket flames and the loader friction): orange `#ec7a3b`, yellow `#f6c45a`, core `#fff3d0`,
strokes `#b4502c` / `#d98a3a`. Glow: `drop-shadow(0 0 10px rgba(255,140,60,.85))`.

## Loading screen (public/js/loader-fx.js)

Rocket on its pad:
- **Countdown:** T-03 → T-01, with smoke and the flame growing.
- **Liftoff:** the number becomes altitude, and the stars streak into speed lines.
- **Friction:** `images/space/friction/friction-1..2.webp` cross-fade by speed over the nose, drawn in front of the
  rocket.
- **Reveal:** the sky lifts away to show the page.

Visitors with reduced motion get the simple counter in `main.js`. Rejected along the way (don't bring back without
asking):
- a comet loader
- friction stages 3–4
- the glow and arc friction effects
- a red nose cone
- the rocket tilting or swaying

## Testing

- Use the dev server for work and `npm run preview` (the production build) for final checks.
- An automated or hidden browser tab doesn't run animation frames. Replace `requestAnimationFrame` with a
  `setTimeout` version to play animations, or pin the loader's clock to freeze a moment. ResizeObserver also needs a
  drawn frame; taking a screenshot forces one.
- Measure layout with `offsetTop` chains (they ignore reveal transforms), not `getBoundingClientRect`, when checking
  anchors.
- Final QA:
  - all 9 pages (home, What I do now, How I got here, Plot twist, five case studies) at 390, 768, 1440 and 1920 wide
  - scroll each page fully
  - 0 broken images, 0 sideways overflow, 0 console errors, 0 failed requests
  - no loader overlay left behind, every element faded in

## Release

`npm run build` → zip the **contents** of `dist/` → Netlify **Deploys** drag-and-drop. The site visibility must be
**Public** for visitors and link previews. When the résumé changes, replace `public/files/Jayden_Chia_Resume.pdf`
and bump the `?v=` on its three links in `index.html`.
