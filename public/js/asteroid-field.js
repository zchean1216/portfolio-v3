// Asteroid field: one canvas that fills its section. Seeded layout, 3 depth layers, drift + tumble,
// twinkling dust, scroll parallax, a clear lane on the Path timeline. Settings live on the config entry (e.field).
(function () {
  if (window.AsteroidField) return;
  var rmQ = matchMedia('(prefers-reduced-motion: reduce)');
  var DEF = { seed: 7, asteroids: 46, dots: 150, minSize: 14, maxSize: 64, opBack: 0.22, opMid: 0.4, opFront: 0.6, speed: 8, dir: 35, lane: 120 };
  var LAYERS = [{ k: 'back', share: 0.6, sz: [0, 0.3], sp: 0.55, par: 0.03 }, { k: 'mid', share: 0.3, sz: [0.3, 0.65], sp: 1, par: 0.07 }, { k: 'front', share: 0.1, sz: [0.65, 1], sp: 1.6, par: 0.13 }];
  var sprites = null, spriteSrcs = null;
  function rng(s) { s = (s >>> 0) || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function loadSprites(srcs, cb) {
    if (sprites && spriteSrcs === srcs.join('|')) return cb();
    spriteSrcs = srcs.join('|'); var left = srcs.length, out = [];
    srcs.forEach(function (src, i) {
      var im = new Image(); im.decoding = 'async';
      im.onload = function () {
        var d = document.createElement('canvas'); d.width = im.naturalWidth; d.height = im.naturalHeight;
        var x = d.getContext('2d'); x.drawImage(im, 0, 0);
        try { var px = x.getImageData(0, 0, d.width, d.height), p = px.data; for (var q = 0; q < p.length; q += 4) { var L = (0.2126 * p[q] + 0.7152 * p[q + 1] + 0.0722 * p[q + 2]) / 255, al = Math.max(0, Math.min(1, 1.6 * p[q + 3] / 255 - 1.7 * L)); p[q] = 236; p[q + 1] = 230; p[q + 2] = 222; p[q + 3] = Math.round(al * 255); } x.putImageData(px, 0, 0); } catch (e) {}
        out[i] = { img: im, dark: d, ar: im.naturalHeight / im.naturalWidth }; if (!--left) { sprites = out.filter(Boolean); cb(); }
      };
      im.onerror = function () { if (!--left) { sprites = out.filter(Boolean); cb(); } };
      im.src = src;
    });
  }
  function S(e) { var f = e.field || {}, o = {}; for (var k in DEF) o[k] = f[k] != null ? f[k] : DEF[k]; return o; }
  function layout(F) {
    var r = rng(F.seed * 9301 + 49297), ast = [], dots = [], n = Math.max(0, Math.round(F.asteroids));
    LAYERS.forEach(function (L, li) {
      var c = li === 2 ? Math.max(1, Math.round(n * L.share)) : Math.round(n * L.share);
      for (var i = 0; i < c; i++) {
        var t = L.sz[0] + r() * (L.sz[1] - L.sz[0]);
        ast.push({ L: li, u: r(), v: r(), size: F.minSize + (F.maxSize - F.minSize) * t, sp: L.sp * (0.7 + r() * 0.6), rot: r() * 6.283, rs: (r() < 0.5 ? -1 : 1) * (0.03 + r() * 0.12), spr: Math.floor(r() * 64) });
      }
    });
    for (var j = 0; j < Math.round(F.dots); j++) dots.push({ u: r(), v: r(), s: [0.8, 1.3, 2][Math.floor(r() * 3)], per: 3 + r() * 4, ph: r() * 6.283, a: 0.35 + r() * 0.5 });
    return { ast: ast, dots: dots };
  }
  function mount(wrap, e, srcs) {
    var cv = wrap.querySelector('canvas') || wrap.appendChild(document.createElement('canvas'));
    cv.setAttribute('aria-hidden', 'true');
    var st = { e: e, F: S(e), L: null, vis: false, raf: 0, t0: performance.now(), W: 0, H: 0, dpr: 1 };
    st.L = layout(st.F); wrap.__af = st;
    function size() {
      var r = wrap.getBoundingClientRect(), dpr = Math.min(1.5, window.devicePixelRatio || 1);
      st.W = r.width; st.H = r.height; st.dpr = dpr;
      cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round(r.height * dpr));
      draw();
    }
    function laneX() {
      var rail = wrap.closest('section') && wrap.closest('section').querySelector('[data-rail]');
      if (!rail) return null; var a = rail.getBoundingClientRect(), b = wrap.getBoundingClientRect(); return a.left + a.width / 2 - b.left;
    }
    function draw() {
      if (!st.W || !sprites) return;
      var x = cv.getContext('2d'), F = st.F, W = st.W, H = st.H, still = rmQ.matches || st.e.anim === false;
      var t = still ? 0 : (performance.now() - st.t0) / 1000;
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      var secTop = still ? 0 : wrap.getBoundingClientRect().top;
      var ang = F.dir * Math.PI / 180, vx = Math.cos(ang) * F.speed, vy = Math.sin(ang) * F.speed;
      var lx = laneX(), half = F.lane / 2, ops = [F.opBack, F.opMid, F.opFront], dim = dark ? 0.6 : 1;
      var nowZ = performance.now(); if (!st.zt || nowZ - st.zt > 600) { st.zt = nowZ; var wr = wrap.getBoundingClientRect(); st.zones = []; (wrap.closest('[data-sl-layer]') || wrap.parentElement).querySelectorAll('[data-vig-box]').forEach(function (z) { var r = z.getBoundingClientRect(); st.zones.push([r.left - wr.left, r.top - wr.top, r.right - wr.left, r.bottom - wr.top]); }); }
      var zf = function (x0, y0) { var f = 1; (st.zones || []).forEach(function (z) { var dx = Math.max(z[0] - x0, 0, x0 - z[2]), dy = Math.max(z[1] - y0, 0, y0 - z[3]), d = Math.sqrt(dx * dx + dy * dy); f = Math.min(f, d >= 90 ? 1 : 0.1 + 0.9 * d / 90); }); return f; };
      x.setTransform(st.dpr, 0, 0, st.dpr, 0, 0); x.clearRect(0, 0, W, H);
      // dust (moves with the back layer)
      x.fillStyle = dark ? '#ece6de' : '#1f2b33';
      var pb = -secTop * LAYERS[0].par;
      st.L.dots.forEach(function (d) {
        var px = ((d.u * W + vx * t * 0.4) % W + W) % W, py = ((d.v * H + vy * t * 0.4 + pb) % H + H) % H;
        var tw = still ? 0.75 : 0.5 + 0.5 * Math.sin(t * 6.283 / d.per + d.ph);
        x.globalAlpha = d.a * (0.35 + 0.65 * tw) * (dark ? 0.8 : 0.78) * zf(px, py);
        x.beginPath(); x.arc(px, py, d.s * (0.85 + 0.25 * tw), 0, 6.283); x.fill();
      });
      for (var li = 0; li < 3; li++) {
        var par = -secTop * LAYERS[li].par;
        for (var i = 0; i < st.L.ast.length; i++) {
          var a = st.L.ast[i]; if (a.L !== li) continue;
          var sp = sprites[a.spr % sprites.length], s = a.size, m = s;
          var px = ((a.u * (W + 2 * m) + vx * a.sp * t) % (W + 2 * m) + (W + 2 * m)) % (W + 2 * m) - m;
          var py = ((a.v * (H + 2 * m) + vy * a.sp * t + par) % (H + 2 * m) + (H + 2 * m)) % (H + 2 * m) - m;
          var al = ops[li] * dim;
          if (lx != null) { var dd = Math.abs(px - lx) - half - s / 2; if (dd < 0) continue; if (dd < 40) al *= dd / 40; }
          x.globalAlpha = Math.min(1, al * (dark ? 1 : 1.3)) * zf(px, py);
          x.save(); x.translate(px, py); x.rotate(a.rot + a.rs * t);
          var h = s * sp.ar; x.drawImage(dark ? sp.dark : sp.img, -s / 2, -h / 2, s, h); x.restore();
        }
      }
      x.globalAlpha = 1;
    }
    function loop() {
      st.raf = 0;
      if (!wrap.isConnected) return st.destroy();
      if (!st.vis || document.hidden || rmQ.matches || st.e.anim === false) return;
      draw(); st.raf = requestAnimationFrame(loop);
    }
    st.run = function () { if (!st.raf && st.vis && !document.hidden && !rmQ.matches && st.e.anim !== false) st.raf = requestAnimationFrame(loop); else draw(); };
    st.update = function (e2) { var old = JSON.stringify(st.F); st.e = e2; st.F = S(e2); if (JSON.stringify(st.F) !== old) st.L = layout(st.F); st.run(); };
    st.size = size;
    var ro = new ResizeObserver(size), io = new IntersectionObserver(function (es) { st.vis = es[0].isIntersecting; st.run(); }, { rootMargin: '120px' });
    ro.observe(wrap); io.observe(wrap); LIVE.push(st); st.el = wrap;
    st.destroy = function () { if (st.dead) return; st.dead = true; if (st.raf) cancelAnimationFrame(st.raf); st.raf = 0; ro.disconnect(); io.disconnect(); };
    loadSprites(srcs, function () { size(); st.run(); });
    return st;
  }
  var LIVE = [];
  setInterval(function () { LIVE = LIVE.filter(function (s) { if (s.el && !s.el.isConnected) { s.destroy(); return false; } return !s.dead; }); }, 4000);
  function all() { document.querySelectorAll('[data-af]').forEach(function (w) { if (w.__af && !w.__af.dead) w.__af.run(); }); }
  document.addEventListener('visibilitychange', all);
  rmQ.addEventListener && rmQ.addEventListener('change', all);
  new MutationObserver(all).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.AsteroidField = { mount: mount, defaults: DEF };
})();
