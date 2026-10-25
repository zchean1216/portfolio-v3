# Jayden Chia · IT & Security portfolio

Static site (plain HTML + classic scripts, originally from Claude Design) run with Vite.
Live: https://jaydenchia.netlify.app

## Run it

Needs Node 18+ (built with Node 22).

```
npm install        # once
npm run dev        # http://localhost:5173, reloads on save
npm run build      # production files in dist/
npm run preview    # serve dist/ at http://localhost:4173
```

## Deploy (Netlify)

`npm run build`, then drag the `dist` folder (or a zip of its contents) onto Deploys in Netlify.
`netlify.toml` also lets Netlify build it from a Git repo (`npm run build`, publish `dist`, Node 22).

## Where things are

- `index.html`: the whole page (home, About inner pages, five case studies), styles and app logic.
- `public/js/`
  - `main.js`: reveals, page transitions, magnetic UI, the timeline progress.
  - `loader-fx.js`: the rocket launch loading screen (countdown, liftoff, friction stages).
  - `space-layout.js`: places every space element from `public/data/space-layout.json`. Elements are tied to nearby page content, and backdrops stand on their divider line, so nothing drifts at other screen sizes.
  - `star-field.js`, `asteroid-field.js`, `space-vignette.js`, `space-motion.js`, `space-assets.js`, `hero-fx.js`: the animated space art.
  - `img-guard.js`: retries images that fail to load and hides them if they still fail.
  - `runtime.js`: the Claude Design template runtime.
- `public/data/space-layout.json`: the full art library (`assets`) and where each piece is placed (`desktop`, `mobile`).
- `public/images/space/`: the space art library (line art, backdrops, rocket, friction stages).
- `public/files/Jayden_Chia_Resume.pdf`: the résumé the Resume buttons download. Links carry `?v=YYYYMMDD`; bump it when the file changes.
- `public/dev/`: editor tools only (never shipped).

## Moving and resizing the space art

Open http://localhost:5173/?edit=1 (dev server only). Drag or resize elements, use the panel for size, section, motion and opacity, then click **Save**. That writes `public/data/space-layout.json`. Press P to preview without the edit outlines.

## Build output

`vite.config.js` strips the editor, trims the layout file to placed art, leaves out unused images and points link previews at the live URL (override with `SITE_URL=...`).

## Notes

- Dark mode is the default; a visitor's choice of light is remembered.
- Art rule: use the existing library or newly supplied art; don't generate replacements.
