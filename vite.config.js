import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// The site is plain HTML + classic scripts (from Claude Design). Everything static lives in
// public/ so Vite serves and copies it untouched, keeping URLs and the design identical.
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
// GH_PAGES=1: GitHub Pages preview build, served from /portfolio/ and including the prototype page
const GH_PAGES = !!process.env.GH_PAGES;
const SAVES = { '/__space-layout': 'data/space-layout.json' };

function siteDevTools() {
  let lastSave = 0;
  return {
    name: 'site-dev-tools',
    configureServer(server) {
      // "Save" endpoint for the ?edit=1 space element editor (public/dev/space-edit.js)
      server.middlewares.use((req, res, next) => {
        const url = req.url.split('?')[0];
        if (req.method !== 'POST' || !SAVES[url]) return next();
        let body = '';
        req.on('data', (c) => { body += c; if (body.length > 2e6) req.destroy(); });
        req.on('end', () => {
          try {
            JSON.parse(body);
            lastSave = Date.now();
            fs.writeFileSync(path.join(PUBLIC, SAVES[url]), body);
            res.statusCode = 200; res.end('ok');
            console.log('saved', SAVES[url]);
          } catch (e) { res.statusCode = 400; res.end(String(e)); }
        });
      });
      // dev-only: save a processed library image (used when adding new art); only images/space/<folder>/<name>.webp|png
      server.middlewares.use((req, res, next) => {
        if (req.method !== 'POST' || !req.url.startsWith('/__save-asset')) return next();
        const rel = new URL(req.url, 'http://x').searchParams.get('path') || '';
        if (!/^images\/space\/[a-z0-9-]+\/[a-z0-9-]+\.(webp|png)$/.test(rel)) { res.statusCode = 400; return res.end('bad path'); }
        const chunks = []; let size = 0;
        req.on('data', (c) => { size += c.length; if (size > 8e6) req.destroy(); else chunks.push(c); });
        req.on('end', () => {
          const out = path.join(PUBLIC, rel); fs.mkdirSync(path.dirname(out), { recursive: true });
          lastSave = Date.now(); fs.writeFileSync(out, Buffer.concat(chunks)); res.end('ok'); console.log('saved', rel);
        });
      });
      // folder URLs inside public/ (e.g. /dev/space-assets/) serve that folder's index.html
      server.middlewares.use((req, res, next) => {
        const url = req.url.split('?')[0];
        if (req.method === 'GET' && url.length > 1 && url.endsWith('/') && fs.existsSync(path.join(PUBLIC, url, 'index.html'))) req.url = url + 'index.html';
        next();
      });
      // classic scripts/css/json in public/ aren't in Vite's module graph, so reload the page on any change
      server.watcher.add(PUBLIC);
      const reload = (file) => {
        if (!file.startsWith(PUBLIC)) return;
        if (Date.now() - lastSave < 1500) return; // don't wipe the editor after its own save
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('change', reload);
      server.watcher.on('add', reload);
      server.watcher.on('unlink', reload);
    },
    // production output: no dev tools, a layout file with only what's placed, and no unused art
    closeBundle() {
      const DIST = path.join(ROOT, 'dist');
      fs.rmSync(path.join(DIST, 'dev'), { recursive: true, force: true });

      // layout: keep the library entries that are actually placed (the full library stays in public/ for the editor)
      const layoutFile = path.join(DIST, 'data/space-layout.json');
      const cfg = JSON.parse(fs.readFileSync(layoutFile, 'utf8'));
      const placed = new Set([...(cfg.desktop || []), ...(cfg.mobile || [])].map((e) => e.asset));
      cfg.assets = Object.fromEntries(Object.entries(cfg.assets).filter(([k]) => placed.has(k)));
      const layoutText = JSON.stringify(cfg);
      fs.writeFileSync(layoutFile, layoutText);

      // art: an image ships if the layout names it, or the page code loads it (directly or from its folder)
      const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
      const code = [path.join(DIST, 'index.html'), ...walk(path.join(DIST, 'js')), ...walk(path.join(DIST, 'css'))].map((f) => fs.readFileSync(f, 'utf8')).join('\n');
      const removed = [];
      for (const file of walk(path.join(DIST, 'images'))) {
        const rel = path.relative(DIST, file).split(path.sep).join('/');
        const inSpace = rel.startsWith('images/space/'), sub = inSpace ? rel.slice('images/space/'.length) : rel.slice('images/'.length), dir = sub.includes('/') ? sub.split('/')[0] : '';
        const used = layoutText.includes(rel) || code.includes(sub) || code.includes(path.basename(rel)) || (dir && (code.includes(`'${dir}/`) || code.includes(`${dir}/${dir}-`)));
        if (!used && !GH_PAGES) { fs.rmSync(file); removed.push(rel); }
      }
      // tidy now-empty folders
      for (const d of walk(path.join(DIST, 'images')).map((f) => path.dirname(f)).concat(fs.readdirSync(path.join(DIST, 'images/space')).map((n) => path.join(DIST, 'images/space', n)))) {
        try { if (fs.statSync(d).isDirectory() && !fs.readdirSync(d).length) fs.rmdirSync(d); } catch (e) {}
      }
      if (removed.length) console.log(`  left out ${removed.length} unused image(s): ${removed.join(', ')}`);

      // link previews (LinkedIn, Slack, iMessage...) need absolute URLs. Netlify sets URL during its builds;
      // defaults to the live address; override with SITE_URL=... if the site moves
      const site = (process.env.SITE_URL || process.env.URL || 'https://jaydenchia.netlify.app').replace(/\/$/, '');
      const htmlFile = path.join(DIST, 'index.html');
      let html = fs.readFileSync(htmlFile, 'utf8');
      if (site) {
        html = html.replace('<meta property="og:image" content="images/', `<meta property="og:image" content="${site}/images/`)
          .replace('<meta property="og:type"', `<meta property="og:url" content="${site}/">\n<link rel="canonical" href="${site}/">\n<meta property="og:type"`);
        fs.writeFileSync(htmlFile, html);
        console.log('  link previews point at ' + site);
      } else console.log('  note: no SITE_URL set, so link-preview image paths stay relative');
    },
  };
}

export default defineConfig({
  plugins: [siteDevTools()],
  server: { port: 5173, open: false },
  base: GH_PAGES ? '/portfolio/' : '/',
  build: { outDir: 'dist', emptyOutDir: true, rollupOptions: GH_PAGES ? { input: ['index.html', 'proto-hero-v2.html'] } : {} },
});
