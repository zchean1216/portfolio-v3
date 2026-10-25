// Star field: a movable, resizable element drawn only from the space library:
// dot stars, the sparkle + 8-point star images, the traced constellations (they draw in, then a data packet
// runs the main line), vignette dust, satellite images floating inside it, tumbling asteroids and the odd surprise comet.
// pace scales every motion at once (1 = normal, 2 = twice as fast). In fill mode (e.fill) it covers its whole section and
// the counts are per screen-sized area, so a long page gets proportionally more. Always slowly moving; it never
// follows the cursor. Constellations, sparkles and satellites fade out while they pass behind text, buttons or images
// (clear: 0 turns that off). Settings live on the config entry (e.field). Paused off screen and in hidden tabs, still with reduced motion.
(function () {
  if (window.StarField) return;
  var rmQ = matchMedia('(prefers-reduced-motion: reduce)');
  var IMG = 'images/space/';
  var SPARKS = [IMG + 'deco/deco-1.webp', IMG + 'deco/deco-2.webp'];
  var SATS = [1, 2, 4].map(function (n) { return IMG + 'satellite/satellite-' + n + '.webp'; });
  var ROCKS = [1, 2, 3, 4].map(function (n) { return IMG + 'asteroid/asteroid-' + n + '.webp'; });
  var COMETS = [1, 2, 3, 4].map(function (n) { return IMG + 'comet/comet-' + n + '.webp'; });
  var DEF = { seed: 11, stars: 260, sparkles: 18, dust: 40, constellations: 1, constSize: 140, satellites: 2, satSize: 40, speed: 3, dir: 200, opStars: 0.7, opSparkles: 1, opDust: 1, opConst: 0.5, opSat: 1, clear: 1,
    asteroids: 0, astMin: 14, astMax: 44, opAst: 0.7, comets: 0, cometSize: 70, pace: 1 };
  var SCREEN = 1440 * 900, MAX_PX = 6e6; // fill mode: counts are per screen of area; canvas capped at ~6 megapixels
  // library images render exactly like the standalone elements: full strength in light mode, 0.7 + chalk in dark mode
  var DARK_DIM = 0.7;
  var PACKET_SPEED = 60; // px/s along a constellation line

  function rng(s) { s = (s >>> 0) || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function S(e) { var f = e.field || {}, o = {}; for (var k in DEF) o[k] = f[k] != null ? f[k] : DEF[k]; return o; }
  function wrap(v, m) { return ((v % m) + m) % m; }

  // ---------- sprites (library images, plus a cream "chalk" copy for dark mode) ----------
  var SPR = {};
  function sprite(src, cb) {
    if (SPR[src]) { if (SPR[src].ok) cb(); else SPR[src].wait.push(cb); return; }
    var s = SPR[src] = { ok: false, wait: [cb] }, im = new Image(); im.decoding = 'async';
    im.onload = function () {
      var d = document.createElement('canvas'); d.width = im.naturalWidth; d.height = im.naturalHeight;
      var x = d.getContext('2d'); x.drawImage(im, 0, 0);
      try { var px = x.getImageData(0, 0, d.width, d.height), p = px.data; for (var q = 0; q < p.length; q += 4) { var L = (0.2126 * p[q] + 0.7152 * p[q + 1] + 0.0722 * p[q + 2]) / 255, al = Math.max(0, Math.min(1, 1.6 * p[q + 3] / 255 - 1.7 * L)); p[q] = 236; p[q + 1] = 230; p[q + 2] = 222; p[q + 3] = Math.round(al * 255); } x.putImageData(px, 0, 0); } catch (e) {}
      s.img = im; s.dark = d; s.ar = im.naturalHeight / im.naturalWidth; s.ok = true; s.wait.forEach(function (f) { f(); }); s.wait = [];
    };
    im.onerror = function () { s.wait = []; };
    im.src = src;
  }

  // ---------- constellations (geometry from the art kit, normalised to a box of width 1) ----------
  function constShape(i) {
    var C = window.SpaceArt && window.SpaceArt.constData && window.SpaceArt.constData(i); if (!C) return null;
    var xs = C.stars.map(function (s) { return s[0]; }), ys = C.stars.map(function (s) { return s[1]; }), pad = 50;
    var x0 = Math.min.apply(0, xs) - pad, y0 = Math.min.apply(0, ys) - pad, w = Math.max.apply(0, xs) - x0 + pad;
    var stars = C.stars.map(function (s) { return { x: (s[0] - x0) / w, y: (s[1] - y0) / w, t: s[2], r: s[3] / w }; });
    var paths = C.paths.map(function (p) { var pts = p.map(function (k) { return stars[k]; }), len = 0; for (var j = 1; j < pts.length; j++) len += Math.hypot(pts[j].x - pts[j - 1].x, pts[j].y - pts[j - 1].y); return { pts: pts, len: len }; });
    return { stars: stars, paths: paths, ar: (Math.max.apply(0, ys) - y0 + pad) / w };
  }
  function starPath(x, cx, cy, t, r) {
    x.beginPath();
    if (t === 'd') { x.arc(cx, cy, r, 0, 6.283); return; }
    if (t === 'p') { var k = r * 0.16; x.moveTo(cx, cy - r); x.quadraticCurveTo(cx + k, cy - k, cx + r, cy); x.quadraticCurveTo(cx + k, cy + k, cx, cy + r); x.quadraticCurveTo(cx - k, cy + k, cx - r, cy); x.quadraticCurveTo(cx - k, cy - k, cx, cy - r); x.closePath(); return; }
    for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; if (i) x.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)); else x.moveTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)); }
    x.closePath();
  }

  // ---------- seeded layout (positions are 0..1 of the section, so it fits any size) ----------
  function layout(F, k) {
    k = k || 1;
    var r = rng(F.seed * 7919 + 101), L = { stars: [], sparks: [], dust: [], consts: [], sats: [], asts: [] }, i, N = function (v) { return Math.round(v * k); };
    for (i = 0; i < N(F.stars); i++) L.stars.push({ u: r(), v: r(), s: r() < 0.12 ? 1.9 + r() * 0.6 : 0.8 + r() * 0.8, d: 0.35 + r() * 0.65, per: 1.6 + r() * 4, ph: r() * 6.283, a: 0.5 + r() * 0.5 });
    for (i = 0; i < N(F.sparkles); i++) L.sparks.push({ u: r(), v: r(), k: r() < 0.6 ? 0 : 1, size: 7 + r() * 13, d: 0.5 + r() * 0.5, per: 3 + r() * 5, ph: r() * 6.283, rot: (r() - 0.5) * 0.6 });
    for (i = 0; i < N(F.dust); i++) L.dust.push({ u: r(), v: r(), s: 0.35 + r() * 0.8, a: 0.15 + r() * 0.5, d: 1.3 + r() * 0.9, per: 4 + r() * 6, ph: r() * 6.283 });
    var n = Math.max(0, Math.round(F.constellations)), pool = []; for (i = 0; i < (window.SpaceArt && window.SpaceArt.constCount || 4); i++) pool.push(i);
    for (i = pool.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp; }
    for (i = 0; i < n; i++) L.consts.push({ i: pool[i % pool.length], u: (i + 0.5) / n + (r() - 0.5) * 0.3 / n, v: 0.22 + r() * 0.56, k: 0.8 + r() * 0.4, rot: (r() - 0.5) * 0.4, ph: r() * 4, tw: pool.map(function () { return r() * 6.283; }) });
    for (i = 0; i < N(F.asteroids); i++) L.asts.push({ u: r(), v: r(), t: r(), src: ROCKS[Math.floor(r() * ROCKS.length)], d: 0.6 + r() * 0.9, rot: r() * 6.283, rs: (r() < 0.5 ? -1 : 1) * (0.15 + r() * 0.5), bob: r() * 6.283 });
    var ns = N(F.satellites);
    for (i = 0; i < ns; i++) L.sats.push({ src: SATS[Math.floor(r() * SATS.length)], u: 0.15 + 0.7 * ((i + 0.5) / ns + (r() - 0.5) * 0.3 / ns), v: 0.2 + r() * 0.6, ax: 0.03 + r() * 0.05, ay: 0.04 + r() * 0.06, px: 26 + r() * 22, py: 19 + r() * 17, ph: r() * 6.283, rot: (r() - 0.5) * 0.6, k: 0.8 + r() * 0.4, flip: r() < 0.5 });
    return L;
  }

  function mount(wrapEl, e) {
    var cv = wrapEl.querySelector('canvas') || wrapEl.appendChild(document.createElement('canvas'));
    cv.setAttribute('aria-hidden', 'true');
    var st = { e: e, F: S(e), vis: false, raf: 0, sim: 0, last: 0, W: 0, H: 0, dpr: 1, drawAt: null, bg: '#efebe5', k: 1, comets: [], nextComet: null };
    st.L = layout(st.F, 1); wrapEl.__af = st;
    function areaK() { return st.e.fill && st.W ? Math.max(1, st.W * st.H / SCREEN) : 1; }
    var shapes = {};
    function shape(i) { if (!shapes[i]) shapes[i] = constShape(i); return shapes[i]; }
    function readBg() { st.bg = getComputedStyle(document.documentElement).getPropertyValue('--p-bg').trim() || (dark() ? '#141a1f' : '#efebe5'); }
    function dark() { return document.documentElement.getAttribute('data-theme') === 'dark'; }
    // page content in this section (text, buttons, images), relative to the field; refreshed every second
    var obs = [], obsAt = 0;
    function scan() {
      obsAt = performance.now(); obs = [];
      var sec = wrapEl.closest('section,main,footer') || wrapEl.parentElement, wr = wrapEl.getBoundingClientRect(), rg = document.createRange(), tw = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT), n;
      var add = function (r) { if (r.width > 1 && r.height > 1) obs.push([r.left - wr.left, r.top - wr.top, r.right - wr.left, r.bottom - wr.top]); };
      while ((n = tw.nextNode())) { if (!n.nodeValue.trim() || !n.parentElement || n.parentElement.closest('[data-sl-layer],script,style,[data-sl-panel]')) continue; rg.selectNodeContents(n); [].forEach.call(rg.getClientRects(), add); }
      sec.querySelectorAll('img,button,a,input,[data-hero-photo]').forEach(function (el) { if (!el.closest('[data-sl-layer],[data-sl-panel]')) add(el.getBoundingClientRect()); });
    }
    function blocked(l, t, r, b, pad) { var p = pad || 10; for (var i = 0; i < obs.length; i++) { var o = obs[i]; if (l - p < o[2] && r + p > o[0] && t - p < o[3] && b + p > o[1]) return true; } return false; }
    function fade(o, l, t, r, b, still) { var tgt = st.F.clear && blocked(l, t, r, b) ? 0 : 1; o.f = o.f == null || still ? tgt : o.f + (tgt - o.f) * 0.07; return o.f; }
    function size() {
      var bw = wrapEl.offsetWidth, bh = wrapEl.offsetHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
      dpr = Math.max(0.75, Math.min(dpr, Math.sqrt(MAX_PX / Math.max(1, bw * bh))));
      st.W = bw; st.H = bh; st.dpr = dpr;
      var k = areaK(); if (Math.abs(k - st.k) / st.k > 0.1) { st.k = k; st.L = layout(st.F, k); }
      cv.width = Math.max(1, Math.round(bw * dpr)); cv.height = Math.max(1, Math.round(bh * dpr));
      draw();
    }
    function draw() {
      if (!st.W) return;
      var x = cv.getContext('2d'), F = st.F, W = st.W, H = st.H, dk = dark(), still = rmQ.matches || st.e.anim === false;
      var now = performance.now();
      if (!still) { if (st.last) st.sim += Math.min(0.1, (now - st.last) / 1000) * Math.max(0, F.pace); st.last = now; }
      var t = still ? 0 : st.sim;
      var ang = F.dir * Math.PI / 180, vx = Math.cos(ang) * F.speed, vy = Math.sin(ang) * F.speed;
      var ink = dk ? '#ece6de' : '#968779', dustC = dk ? '#ece6de' : '#9b887c'; // light: the sepia line colour of the library art
      if (F.clear && performance.now() - obsAt > 1000) scan();
      x.setTransform(st.dpr, 0, 0, st.dpr, 0, 0); x.clearRect(0, 0, W, H); x.imageSmoothingQuality = 'high';
      var ex = Math.max(1, W * 0.1), ey = Math.max(1, H * 0.1), edge = function (px, py) { return Math.max(0, Math.min(1, px / ex, (W - px) / ex, py / ey, (H - py) / ey)); };

      // dust: the fastest, faintest layer
      x.fillStyle = dustC;
      st.L.dust.forEach(function (d) {
        var px = wrap(d.u * W + vx * d.d * t, W), py = wrap(d.v * H + vy * d.d * t, H), tw = still ? 0.7 : 0.5 + 0.5 * Math.sin(t * 6.283 / d.per + d.ph);
        x.globalAlpha = Math.min(1, F.opDust * d.a * (0.5 + 0.5 * tw) * (dk ? 0.55 : 0.8)) * edge(px, py); x.beginPath(); x.arc(px, py, d.s, 0, 6.283); x.fill();
      });
      // dot stars
      x.fillStyle = ink;
      st.L.stars.forEach(function (s) {
        var px = wrap(s.u * W + vx * s.d * t, W), py = wrap(s.v * H + vy * s.d * t, H), tw = still ? 0.75 : 0.5 + 0.5 * Math.sin(t * 6.283 / s.per + s.ph);
        x.globalAlpha = Math.min(1, F.opStars * s.a * (0.35 + 0.75 * tw)) * edge(px, py); x.beginPath(); x.arc(px, py, s.s * (0.85 + 0.3 * tw), 0, 6.283); x.fill();
        if (s.s > 1.8) { var g = s.s * (2.2 + 2 * tw); x.globalAlpha *= 0.5; x.fillRect(px - g, py - 0.35, g * 2, 0.7); x.fillRect(px - 0.35, py - g, 0.7, g * 2); } // bright stars get a tiny cross glint
      });
      // sparkle + 8-point star images
      st.L.sparks.forEach(function (s) {
        var sp = SPR[SPARKS[s.k]]; if (!sp || !sp.ok) return;
        var m = s.size, px = wrap(s.u * (W + 2 * m) + vx * s.d * t, W + 2 * m) - m, py = wrap(s.v * (H + 2 * m) + vy * s.d * t, H + 2 * m) - m;
        var tw = still ? 0.8 : 0.5 + 0.5 * Math.sin(t * 6.283 / s.per + s.ph), sz = s.size * (0.75 + 0.35 * tw);
        var fv = fade(s, px - m / 2, py - m / 2, px + m / 2, py + m / 2, still); if (fv < 0.01) return;
        x.globalAlpha = F.opSparkles * (0.55 + 0.45 * tw) * (dk ? DARK_DIM : 1) * fv * edge(px, py); // same flicker range as the sparkle elements
        x.save(); x.translate(px, py); x.rotate(s.rot); x.drawImage(dk ? sp.dark : sp.img, -sz / 2, -sz * sp.ar / 2, sz, sz * sp.ar); x.restore();
      });
      // constellations: draw in once, then a packet runs the main line
      var drawn = still || st.drawAt == null ? (still ? 1 : 0) : Math.min(1, (t - st.drawAt) / 1.6);
      st.L.consts.forEach(function (c) {
        var sh = shape(c.i); if (!sh) return;
        var cw = F.constSize * c.k, ch = cw * sh.ar, mw = cw + 40, mh = ch + 40;
        if (c.bx == null) { c.bx = c.u * (W + mw); c.by = c.v * (H + mh); }
        var ox = wrap(c.bx + vx * 0.5 * t, W + mw) - mw / 2 - cw / 2, oy = wrap(c.by + vy * 0.5 * t, H + mh) - mh / 2 - ch / 2;
        var fv = fade(c, ox, oy, ox + cw, oy + ch, still);
        // hidden behind content for a while: reappear somewhere clear (it fades back in from there)
        if (fv < 0.02 && F.clear) {
          if (c.hid == null) c.hid = t;
          if (t - c.hid > 4 || still) {
            for (var tries = 0; tries < 24; tries++) {
              var nx = 8 + Math.random() * Math.max(1, W - cw - 16), ny = 8 + Math.random() * Math.max(1, H - ch - 16);
              if (!blocked(nx, ny, nx + cw, ny + ch, 40) && !st.L.consts.some(function (o) { return o !== c && o.box && nx < o.box[2] && nx + cw > o.box[0] && ny < o.box[3] && ny + ch > o.box[1]; })) {
                c.bx = nx + mw / 2 + cw / 2 - vx * 0.5 * t; c.by = ny + mh / 2 + ch / 2 - vy * 0.5 * t; c.f = still ? 1 : 0; c.hid = null; ox = nx; oy = ny; fv = c.f; break;
              }
            }
            if (c.hid != null) c.hid = t - 2; // nowhere clear right now: try again in a couple of seconds
          }
        } else c.hid = null;
        c.box = [ox, oy, ox + cw, oy + ch];
        if (fv < 0.01) return;
        x.save(); x.translate(ox + cw / 2, oy + ch / 2); x.rotate(c.rot); x.translate(-cw / 2, -ch / 2);
        var ce = edge(ox + cw / 2, oy + ch / 2); fv *= ce; if (fv < 0.01) { x.restore(); return; }
        x.globalAlpha = F.opConst * (dk ? 0.75 : 0.7) * fv; x.strokeStyle = ink; x.lineWidth = 1; x.lineJoin = x.lineCap = 'round';
        sh.paths.forEach(function (p) {
          var L = p.len * cw; x.setLineDash(drawn < 1 ? [L * drawn, L] : []);
          x.beginPath(); p.pts.forEach(function (q, k) { if (k) x.lineTo(q.x * cw, q.y * cw); else x.moveTo(q.x * cw, q.y * cw); }); x.stroke();
        });
        x.setLineDash([]);
        x.globalAlpha = F.opConst * fv; x.lineWidth = 1.2;
        if (dk) { x.shadowColor = 'rgba(236,230,222,.55)'; x.shadowBlur = 4; }
        sh.stars.forEach(function (s, k) {
          var tw = still ? 1 : 0.88 + 0.12 * Math.sin(t * 1.4 + c.tw[k % c.tw.length] + k);
          starPath(x, s.x * cw, s.y * cw, s.t, Math.max(1.5, s.r * cw * tw));
          x.fillStyle = s.t === 'S' || dk ? ink : st.bg; x.fill(); x.stroke();
        });
        x.shadowBlur = 0;
        // packet
        var main = sh.paths[0];
        if (!still && drawn >= 1 && main && main.pts.length > 1) {
          var Lm = main.len * cw, per = Lm / PACKET_SPEED + 3, at = wrap(t - st.drawAt - 1.6 - c.ph, per) * PACKET_SPEED;
          if (at < Lm) {
            var acc = 0;
            for (var k = 1; k < main.pts.length; k++) {
              var a0 = main.pts[k - 1], a1 = main.pts[k], seg = Math.hypot(a1.x - a0.x, a1.y - a0.y) * cw;
              if (acc + seg >= at) { var f = (at - acc) / seg, pf = Math.min(1, at / 30, (Lm - at) / 30);
                x.globalAlpha = Math.min(1, F.opConst * 1.8) * pf * fv; x.fillStyle = dk ? '#e8a58c' : '#ab6a55';
                if (dk) { x.shadowColor = 'rgba(232,165,140,.9)'; x.shadowBlur = 6; }
                x.beginPath(); x.arc((a0.x + (a1.x - a0.x) * f) * cw, (a0.y + (a1.y - a0.y) * f) * cw, 2.4, 0, 6.283); x.fill(); x.shadowBlur = 0; break; }
              acc += seg;
            }
          }
        }
        x.restore();
      });
      // asteroids: drift with the field at their own depth and tumble
      st.L.asts.forEach(function (a) {
        var sp = SPR[a.src]; if (!sp || !sp.ok) return;
        var size = F.astMin + (F.astMax - F.astMin) * a.t, m = size;
        var px = wrap(a.u * (W + 2 * m) + vx * a.d * t, W + 2 * m) - m, py = wrap(a.v * (H + 2 * m) + vy * a.d * t + Math.sin(t * 0.5 + a.bob) * 4, H + 2 * m) - m;
        var hw = size / 2, fv = fade(a, px - hw, py - hw, px + hw, py + hw, still); if (fv < 0.01) return;
        x.globalAlpha = F.opAst * (dk ? DARK_DIM : 1) * fv * edge(px, py);
        x.save(); x.translate(px, py); x.rotate(a.rot + a.rs * t); x.drawImage(dk ? sp.dark : sp.img, -hw, -hw * sp.ar, size, size * sp.ar); x.restore();
      });
      // surprise comets: now and then one streaks across the part of the field you are looking at
      if (!still && F.comets > 0) {
        if (st.nextComet == null) st.nextComet = t + (0.3 + Math.random()) * 60 / F.comets;
        if (t >= st.nextComet) {
          st.nextComet = t + (0.5 + Math.random()) * 60 / F.comets;
          var wr = wrapEl.getBoundingClientRect(), vt = Math.max(0, -wr.top), vb = Math.min(H, innerHeight - wr.top);
          if (vb - vt > 80) {
            var ltr = Math.random() < 0.5, ang = (ltr ? 20 : 160) + (Math.random() - 0.5) * 30, len = Math.min(W, 900) * (0.45 + Math.random() * 0.3);
            var x1 = ltr ? W * (0.05 + Math.random() * 0.4) : W * (0.55 + Math.random() * 0.4), y1 = vt + (vb - vt) * (0.1 + Math.random() * 0.45);
            var rad = ang * Math.PI / 180;
            st.comets.push({ x1: x1, y1: y1, x2: x1 + Math.cos(rad) * len, y2: y1 + Math.sin(rad) * len, t0: t, dur: 2.4 + Math.random() * 1.2, rot: rad + 50 * Math.PI / 180, size: F.cometSize * (0.75 + Math.random() * 0.5) });
          }
        }
        st.comets = st.comets.filter(function (c) {
          var p = (t - c.t0) / c.dur; if (p >= 1) return false;
          var sp = SPR[COMETS[Math.floor(t / 0.16) % COMETS.length]]; if (!sp || !sp.ok) return true;
          var e2 = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2, px = c.x1 + (c.x2 - c.x1) * e2, py = c.y1 + (c.y2 - c.y1) * e2;
          x.globalAlpha = (dk ? DARK_DIM : 0.85) * Math.min(1, p / 0.18, (1 - p) / 0.3) * (1 - 0.35 * p);
          var sz = c.size * (1 - 0.3 * p);
          x.save(); x.translate(px, py); x.rotate(c.rot); x.drawImage(dk ? sp.dark : sp.img, -sz / 2, -sz * sp.ar * 0.7, sz, sz * sp.ar); x.restore();
          return true;
        });
      }
      // satellites floating inside the field: slow wandering loops, gentle tilt
      st.L.sats.forEach(function (c) {
        var sp = SPR[c.src]; if (!sp || !sp.ok) return;
        var size = F.satSize * c.k, px = c.u * W + Math.sin(t * 6.283 / c.px + c.ph) * c.ax * W, py = c.v * H + Math.sin(t * 6.283 / c.py + c.ph * 1.7) * c.ay * H;
        var hw = size / 2, fv = fade(c, px - hw, py - hw, px + hw, py + hw, still); if (fv < 0.01) return;
        x.globalAlpha = F.opSat * (dk ? DARK_DIM : 1) * fv;
        x.save(); x.translate(px, py); x.rotate(c.rot + Math.sin(t * 6.283 / (c.px * 1.3) + c.ph) * 0.12); if (c.flip) x.scale(-1, 1);
        x.drawImage(dk ? sp.dark : sp.img, -hw, -hw * sp.ar, size, size * sp.ar); x.restore();
      });
      x.globalAlpha = 1;
    }
    function loop() {
      st.raf = 0;
      if (!wrapEl.isConnected) return st.destroy();
      if (!st.vis || document.hidden || rmQ.matches || st.e.anim === false) return;
      draw(); st.raf = requestAnimationFrame(loop);
    }
    st.run = function () {
      if (st.vis && st.drawAt == null) st.drawAt = st.sim;
      if (!st.raf) st.last = 0; // resume without a jump after being off screen
      if (!st.raf && st.vis && !document.hidden && !rmQ.matches && st.e.anim !== false) st.raf = requestAnimationFrame(loop); else draw();
    };
    st.update = function (e2) { var old = JSON.stringify(st.F) + st.k, fill = !!st.e.fill; st.e = e2; st.F = S(e2); if (fill !== !!e2.fill) size(); st.k = areaK(); if (JSON.stringify(st.F) + st.k !== old) { st.L = layout(st.F, st.k); obsAt = 0; } st.run(); };
    st.theme = function () { readBg(); st.run(); };
    st.size = size; st.draw = draw;
    readBg();
    SPARKS.concat(SATS, ROCKS, COMETS).forEach(function (s) { sprite(s, draw); });
    var ro = new ResizeObserver(size), io = new IntersectionObserver(function (es) { st.vis = es[0].isIntersecting; st.run(); }, { rootMargin: '120px' });
    ro.observe(wrapEl); io.observe(wrapEl); LIVE.push(st); st.el = wrapEl;
    st.destroy = function () { if (st.dead) return; st.dead = true; if (st.raf) cancelAnimationFrame(st.raf); st.raf = 0; ro.disconnect(); io.disconnect(); st.comets = []; st.L = layout(st.F, 0); };
    size(); st.run();
    return st;
  }
  // fields whose page went away (even while paused off screen) are cleaned up within a few seconds
  var LIVE = [];
  setInterval(function () { LIVE = LIVE.filter(function (s) { if (s.el && !s.el.isConnected) { s.destroy(); return false; } return !s.dead; }); }, 4000);
  function all() { document.querySelectorAll('[data-sf]').forEach(function (w) { if (w.__af && !w.__af.dead) w.__af.theme(); }); }
  document.addEventListener('visibilitychange', all);
  rmQ.addEventListener && rmQ.addEventListener('change', all);
  // theme colours are set by the page just before data-theme flips, so re-read on the next frame
  new MutationObserver(function () { requestAnimationFrame(all); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.StarField = { mount: mount, defaults: DEF };
})();
