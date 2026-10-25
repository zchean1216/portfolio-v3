// Vignettes: one placed element = a small space scene (hero + rocks + dust + sparkles), moved/resized as a group.
// Plus: moon shadow phases, comet flybys. Motion is continuous (sine-eased), paused off screen / hidden tab, still with reduced motion.
(function () {
  if (window.SpaceVignette) return;
  var rmQ = matchMedia('(prefers-reduced-motion: reduce)');
  var IMG = 'images/space/';
  var HERO = {
    moon: { src: IMG + 'moon/moon-1.webp', ar: 1.0, moon: true },
    jupiter: { src: [IMG + 'jupiter/jupiter-1.webp', IMG + 'jupiter/jupiter-2.webp'], ar: 1.0 },
    'gas-b': { src: IMG + 'jupiter/jupiter-3.webp', ar: 1.0 },
    'gas-c': { src: IMG + 'jupiter/jupiter-4.webp', ar: 1.0 },
    ringed: { src: [IMG + 'planet/planet-1.webp', IMG + 'planet/planet-3.webp', IMG + 'planet/planet-4.webp'], ar: 0.61 },
    satellite: { src: [IMG + 'satellite/satellite-1.webp', IMG + 'satellite/satellite-2.webp', IMG + 'satellite/satellite-4.webp'], ar: 0.6 },
    mini: { src: IMG + 'deco/deco-3.webp', ar: 0.55 },
    none: null
  };
  var ROCKS = [1, 2, 3, 4].map(function (n) { return IMG + 'asteroid/asteroid-' + n + '.webp'; });
  var SPARK = IMG + 'deco/deco-1.webp', CLUSTER = IMG + 'deco/deco-4.webp';
  function rng(s) { s = (s >>> 0) || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function pick(v, r) { return Array.isArray(v) ? v[Math.floor(r() * v.length)] : v; }
  function img(src, css, extra) { return '<img src="' + src + '" alt="" draggable="false" decoding="async" style="display:block;width:100%;height:auto;' + (css || '') + '"' + (extra || '') + '>'; }
  var uid = 0;

  // ---------- build ----------
  function build(box, e) {
    var v = e.vig || {}, r = rng((v.seed || 1) * 7919 + 13), preset = v.preset || 'cluster', OV = v.ov || {};
    var W = 100, H = 100 * ((e.h || e.w) / e.w); // local units: box width = 100
    var hero = HERO[v.hero || 'none'], heroW = hero ? (v.heroSize || (preset === 'ringed-debris' ? 62 : preset === 'trail' ? 26 : 44)) : 0;
    var hx = v.hx != null ? v.hx : 50, hy = v.hy != null ? v.hy : H / 2;
    var parts = [], rocks = [], dust = [], id = 'v' + (++uid);
    var heroH = hero ? heroW * hero.ar : 0;
    // dust: densest near the hero, fading with distance
    var nd = v.dust != null ? v.dust : 20 + Math.floor(r() * 21);
    for (var i = 0; i < nd; i++) {
      var ang = r() * 6.283, rad;
      if (preset === 'trail') { var tt = r(); ang = (v.trailFrom || 2.4) + tt * (v.trailSpan || 0.9); rad = (v.trailR || 40) + (r() - 0.5) * 3; dust.push({ x: 50 + Math.cos(ang) * rad, y: H / 2 + Math.sin(ang) * rad, s: 0.35 + r() * 0.6, a: 0.75 * (1 - tt) + 0.1 }); continue; }
      rad = (hero ? heroW * 0.42 : 8) + Math.pow(r(), 1.8) * (Math.min(W, H) * 0.48);
      var far = Math.min(1, rad / (Math.min(W, H) * 0.5));
      dust.push({ x: hx + Math.cos(ang) * rad * 1.15, y: hy + Math.sin(ang) * rad * 0.85, s: 0.3 + r() * 0.7 * (1 - far * 0.5), a: 0.85 - far * 0.65 });
    }
    // rocks: loose uneven arc, 1/6 to 1/3 of the hero, never evenly spaced
    var nr = v.rocks != null ? v.rocks : 2 + Math.floor(r() * 3), base = r() * 6.283, arc = 1.6 + r() * 1.4, ref = hero ? heroW : 30;
    var used = []; for (var k = 0; k < nr; k++) used.push(r());
    used.sort();
    for (k = 0; k < nr; k++) {
      var t = used[k] + (r() - 0.5) * 0.12, a0 = base + t * arc;
      var sz = ref * (1 / 6 + r() * (1 / 3 - 1 / 6)) * (hero ? 1 : 1.3);
      var orbitR = (hero ? heroW * 0.55 : 6) + sz * 0.6 + r() * 12;
      rocks.push({ src: ROCKS[Math.floor(r() * 4)], sz: sz, R: orbitR, sq: 0.7 + r() * 0.25, a0: a0, amp: 0.12 + r() * 0.22, per: 26 + r() * 30, ph: r() * 6.283, rot: r() * 360, spin: (r() < 0.5 ? -1 : 1) * (3 + r() * 9) });
    }
    if (preset === 'ringed-debris') { // a ring of small debris orbiting with the ring's tilt
      var nd2 = v.debris || 9;
      for (k = 0; k < nd2; k++) rocks.push({ src: ROCKS[Math.floor(r() * 4)], sz: heroW * (0.05 + r() * 0.06), ring: true, R: heroW * (0.62 + r() * 0.12), sq: 0.24, tilt: -0.42, a0: k / nd2 * 6.283 + r() * 0.5, w: 6.283 / (80 + r() * 40), rot: r() * 360, spin: (r() < 0.5 ? -1 : 1) * (4 + r() * 8) });
    }
    var maxS = Math.max.apply(0, rocks.map(function (q) { return q.sz; }).concat([1]));
    // markup
    var dustSvg = '<svg data-vdust data-vkey="d" viewBox="0 0 ' + W + ' ' + H.toFixed(2) + '" preserveAspectRatio="none" aria-hidden="true" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible">' +
      dust.map(function (d) { return '<circle data-tw cx="' + d.x.toFixed(2) + '" cy="' + d.y.toFixed(2) + '" r="' + d.s.toFixed(2) + '" fill="var(--sa-dust,#9b887c)" opacity="' + Math.max(0.08, d.a).toFixed(2) + '"></circle>'; }).join('') + '</svg>';
    parts.push(dustSvg);
    if (preset === 'sat-pair') {
      var A = { x: 24, y: H * 0.36 }, B = { x: 76, y: H * 0.66 };
      parts.push('<svg viewBox="0 0 100 ' + H.toFixed(2) + '" preserveAspectRatio="none" aria-hidden="true" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible"><line x1="' + A.x + '" y1="' + A.y.toFixed(1) + '" x2="' + B.x + '" y2="' + B.y.toFixed(1) + '" stroke="var(--sa-line)" stroke-width="1" stroke-dasharray="3 5" vector-effect="non-scaling-stroke"></line><circle data-vsig r="1.1" fill="#ab6a55" cx="' + A.x + '" cy="' + A.y.toFixed(1) + '"></circle></svg>');
      [[A, 0], [B, 1]].forEach(function (p) { var s = HERO.satellite.src[p[1] ? 2 : 0], w = 30; parts.push('<span data-vhero data-vkey="h' + p[1] + '" style="position:absolute;left:' + (p[0].x - w / 2) + '%;top:' + ((p[0].y - w * 0.3) / H * 100).toFixed(2) + '%;width:' + w + '%"><span data-vdrift><span data-vfloat>' + img(s) + '</span></span></span>'); });
      box.__sig = { A: A, B: B, per: 7 + r() * 3 };
    }
    rocks.forEach(function (q, i) {
      var depth = q.sz / maxS, op = (0.4 + 0.6 * depth), blur = depth < 0.45 ? 'filter:blur(.5px);' : '';
      q.el = 'r' + i; var o = OV['r' + i] || {}; q.dx = o.dx || 0; q.dy = o.dy || 0; if (o.s) q.sz *= o.s; if (o.del) q.del = 1;
      parts.push('<span data-vrock="' + i + '" data-vkey="r' + i + '" style="' + (q.del ? 'display:none;' : '') + 'position:absolute;left:0;top:0;width:' + q.sz.toFixed(2) + '%;opacity:' + op.toFixed(2) + ';' + blur + 'will-change:transform">' + img(q.src) + '</span>');
    });
    if (hero) {
      var hsrc = v.heroSrc || pick(hero.src, r), shadow = '';
      if (hero.moon) { var mk = 'url(&quot;' + hsrc + '&quot;) center / 100% 100% no-repeat'; shadow = '<svg data-vmoon viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" style="position:absolute;inset:0;width:100%;height:100%;-webkit-mask:' + mk + ';mask:' + mk + '"><defs><filter id="' + id + 'b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.2"></feGaussianBlur></filter></defs><rect data-vlit x="0" y="0" width="100" height="100" fill="#ece6de"></rect><circle data-vshadow cx="-70" cy="50" r="54" fill="var(--sa-shadow,#2b3238)" filter="url(#' + id + 'b)"></circle></svg>'; }
      parts.push('<span data-vhero data-vkey="h" style="position:absolute;left:' + (hx - heroW / 2).toFixed(2) + '%;top:' + ((hy - heroH / 2) / H * 100).toFixed(2) + '%;width:' + heroW + '%;z-index:2"><span data-vdrift><span data-vfloat style="position:relative;display:block">' + img(hsrc) + shadow + '</span></span></span>');
      if (v.hero === 'satellite' && v.signal) parts.push('<svg data-sig="1" viewBox="0 0 60 30" aria-hidden="true" style="position:absolute;left:' + (hx - 14) + '%;top:' + ((hy - heroH / 2 - 16) / H * 100).toFixed(2) + '%;width:28%;overflow:visible;fill:none;stroke:var(--sa-line);stroke-width:1.5;stroke-linecap:round;stroke-dasharray:3 4;transform:rotate(' + (v.signal || 0) + 'deg)"><path d="M18 26 Q30 14 42 26"></path><path d="M10 22 Q30 2 50 22"></path><path d="M2 18 Q30 -10 58 18"></path></svg>');
    }
    var ns = v.sparkles != null ? v.sparkles : 2 + Math.floor(r() * 2);
    for (k = 0; k < ns; k++) { var sa = r() * 6.283, sr = 0.36 + r() * 0.12, sw = 3 + r() * 3.5; parts.push('<span data-vspark data-vkey="s' + k + '" style="position:absolute;left:' + (hx + Math.cos(sa) * W * sr - sw / 2).toFixed(2) + '%;top:' + ((hy + Math.sin(sa) * H * sr) / H * 100 - sw).toFixed(2) + '%;width:' + sw.toFixed(2) + '%">' + img(k === 0 && ns > 2 ? CLUSTER : SPARK) + '</span>'); }
    box.innerHTML = '<div data-vig style="position:absolute;inset:0">' + parts.join('') + '</div>';
    box.querySelectorAll('[data-vkey]:not([data-vrock])').forEach(function (n) {
      var o = OV[n.getAttribute('data-vkey')]; if (!o) return;
      if (o.del) { n.style.display = 'none'; return; }
      var s = o.s || 1, dx = o.dx || 0, dy = (o.dy || 0) / H * 100;
      if (n.hasAttribute('data-vdust')) { n.style.inset = 'auto'; n.style.width = (100 * s) + '%'; n.style.height = (100 * s) + '%'; n.style.left = (50 - 50 * s + dx) + '%'; n.style.top = (50 - 50 * s + dy) + '%'; return; }
      var l = parseFloat(n.style.left), t = parseFloat(n.style.top), w = parseFloat(n.style.width);
      n.style.width = (w * s) + '%'; n.style.left = (l + dx - (w * s - w) / 2) + '%'; n.style.top = (t + dy - (w * s - w) / 2 * (100 / H)) + '%';
    });
    box.__v = { rocks: rocks, hx: hx, hy: hy, W: W, H: H, t0: performance.now() - r() * 60000 };
    // staggered CSS motion (all ease-in-out, all different)
    box.querySelectorAll('[data-vfloat]').forEach(function (n) { n.style.animation = 'smFloat ' + (6 + r() * 3).toFixed(2) + 's ease-in-out ' + (-r() * 9).toFixed(2) + 's infinite, smSway ' + (11 + r() * 8).toFixed(2) + 's ease-in-out ' + (-r() * 19).toFixed(2) + 's infinite'; n.style.setProperty('--amp', (6 + r() * 4).toFixed(1) + 'px'); });
    box.querySelectorAll('[data-vdrift]').forEach(function (n) { n.style.display = 'block'; n.style.animation = 'smDrift ' + (24 + r() * 14).toFixed(1) + 's ease-in-out ' + (-r() * 30).toFixed(1) + 's infinite'; n.style.setProperty('--dx', (3 + r() * 4).toFixed(1) + 'px'); n.style.setProperty('--dy', (2 + r() * 3).toFixed(1) + 'px'); });
    box.querySelectorAll('[data-tw]').forEach(function (c) { c.style.transformBox = 'fill-box'; c.style.transformOrigin = 'center'; c.style.animation = 'smStar ' + (3 + r() * 4).toFixed(2) + 's ease-in-out ' + (-r() * 7).toFixed(2) + 's infinite'; });
    var dv = box.querySelector('[data-vdust]'); if (dv) { dv.style.animation = 'smDrift ' + (28 + r() * 12).toFixed(1) + 's ease-in-out ' + (-r() * 30).toFixed(1) + 's infinite'; dv.style.setProperty('--dx', '2px'); dv.style.setProperty('--dy', '1.5px'); }
    box.querySelectorAll('[data-vspark]').forEach(function (n) { n.style.animation = 'smSpk ' + (3 + r() * 4).toFixed(2) + 's ease-in-out ' + (-r() * 7).toFixed(2) + 's infinite'; });
    box.__phase = v.phase || 'auto';
    moonTo(box, true);
    frame(box, performance.now());
  }

  // ---------- per-frame rock motion ----------
  function frame(box, now) {
    var V = box.__v; if (!V) return;
    var still = rmQ.matches, t = still ? 0 : (now - V.t0) / 1000, bw = box.clientWidth || 1, k = bw / 100;
    var els = box.querySelectorAll('[data-vrock]');
    V.rocks.forEach(function (q, i) {
      var el = els[i]; if (!el) return;
      var th = q.ring ? q.a0 + t * q.w : q.a0 + q.amp * Math.sin(t * 6.283 / q.per + q.ph);
      var x = Math.cos(th) * q.R, y = Math.sin(th) * q.R * q.sq;
      if (q.ring) { var c = Math.cos(q.tilt), s = Math.sin(q.tilt), x2 = x * c - y * s, y2 = x * s + y * c; x = x2; y = y2; el.style.zIndex = Math.sin(th) < 0 ? 1 : 3; }
      var px = (V.hx + x - q.sz / 2 + (q.dx || 0)) * k, py = (V.hy + y + (q.dy || 0)) * k - q.sz * k / 2;
      el.style.transform = 'translate(' + px.toFixed(1) + 'px,' + py.toFixed(1) + 'px) rotate(' + (q.rot + t * q.spin).toFixed(1) + 'deg)';
    });
    if (box.__sig) { var sg = box.querySelector('[data-vsig]'); if (sg) { var p = still ? 0.5 : 0.5 - 0.5 * Math.cos(t * 6.283 / box.__sig.per); sg.setAttribute('cx', (box.__sig.A.x + (box.__sig.B.x - box.__sig.A.x) * p).toFixed(2)); sg.setAttribute('cy', (box.__sig.A.y + (box.__sig.B.y - box.__sig.A.y) * p).toFixed(2)); } }
  }
  var LIVE = [], raf = 0;
  var io = new IntersectionObserver(function (es) { es.forEach(function (x) { x.target.__vis = x.isIntersecting; if (x.isIntersecting && x.target.__pendingMoon) moonTo(x.target, false); }); kick(); }, { rootMargin: '120px' });
  function kick() { if (!raf && !rmQ.matches && !document.hidden) raf = requestAnimationFrame(loop); }
  function loop(now) {
    raf = 0; var any = false;
    LIVE = LIVE.filter(function (b) { if (b.isConnected) return true; io.unobserve(b); return false; });
    LIVE.forEach(function (b) { if (b.__vis && b.__anim !== false) { frame(b, now); any = true; } });
    if (any && !document.hidden && !rmQ.matches) raf = requestAnimationFrame(loop);
  }
  document.addEventListener('visibilitychange', kick);

  // ---------- moon shadow: full in light, glides to a crescent in dark ----------
  var FULL = -70, CRESCENT = 30;
  function ease(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function moonTo(box, instant) {
    var sh = box.querySelector('[data-vshadow]'); if (!sh) return;
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    var target = rmQ.matches ? FULL : box.__phase === 'crescent' ? CRESCENT : box.__phase === 'full' ? FULL : (dark ? CRESCENT : FULL);
    var from = parseFloat(sh.getAttribute('cx'));
    if (instant || !box.__vis) { sh.setAttribute('cx', target); box.__pendingMoon = false; return; }
    cancelAnimationFrame(box.__mraf); var t0 = performance.now();
    (function step(now) { var p = Math.min(1, (now - t0) / 1200); sh.setAttribute('cx', (from + (target - from) * ease(p)).toFixed(2)); if (p < 1) box.__mraf = requestAnimationFrame(step); })(t0);
  }
  new MutationObserver(function () { LIVE.forEach(function (b) { if (b.__vis) moonTo(b, false); else { b.__pendingMoon = true; moonTo(b, true); } }); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  rmQ.addEventListener && rmQ.addEventListener('change', function () { LIVE.forEach(function (b) { moonTo(b, true); frame(b, performance.now()); }); kick(); });

  function mount(box, e) {
    box.setAttribute('data-vig-box', '');
    build(box, e); box.__anim = e.anim;
    if (!box.__reg) { box.__reg = 1; LIVE.push(box); io.observe(box); }
    box.__key = JSON.stringify([e.vig, e.w, e.h]);
    kick();
  }
  function update(box, e) {
    box.__anim = e.anim;
    var key = JSON.stringify([e.vig, e.w, e.h]); if (key !== box.__key) { box.__key = key; build(box, e); }
    else frame(box, performance.now());
  }

  // ---------- comet flybys ----------
  var CF = [1, 2, 3, 4].map(function (n) { return IMG + 'comet/comet-' + n + '.webp'; });
  CF.forEach(function (s) { var i = new Image(); i.src = s; });
  var flying = false, ZONES = [];
  function zone(name, host, fn) { ZONES.push({ name: name, host: host, path: fn }); }
  function onScreen(el) { var r = el.getBoundingClientRect(); return r.bottom > 80 && r.top < innerHeight - 80 && r.height > 0; }
  function fly(name, durMs) {
    if (flying || rmQ.matches || document.hidden) return false;
    var zs = ZONES.filter(function (z) { var h = document.querySelector(z.host); return h && (name ? z.name === name : z.name !== 'hero' && onScreen(h)); });
    if (!zs.length) return false;
    var z = zs[Math.floor(Math.random() * zs.length)], host = document.querySelector(z.host), P = z.path(host); if (!P) return false;
    var layer = host.querySelector(':scope > [data-sl-layer]') || host;
    flying = true;
    var c = document.createElement('div'), w = P.w || 70;
    c.setAttribute('aria-hidden', 'true'); c.setAttribute('data-comet', '');
    c.style.cssText = 'position:absolute;left:0;top:0;width:' + w + 'px;pointer-events:none;z-index:1;opacity:0';
    c.innerHTML = '<div data-ang style="aspect-ratio:1/1.39;--xf:120ms">' + CF.map(function (s, i) { return '<img data-i="' + (i + 1) + '" src="' + s + '" alt=""' + (i ? '' : ' data-on=""') + '>'; }).join('') + '</div>';
    layer.appendChild(c);
    var ang = Math.atan2(P.y2 - P.y1, P.x2 - P.x1) * 180 / Math.PI, rot = ang + 50; // art heads up-right (about -50deg)
    var k = 1, fl = setInterval(function () { k = k % 4 + 1; c.querySelectorAll('img').forEach(function (im) { if (+im.getAttribute('data-i') === k) im.setAttribute('data-on', ''); else im.removeAttribute('data-on'); }); }, 160);
    var tr = function (x, y, s) { return 'translate(' + (x - w / 2) + 'px,' + (y - w * 0.7) + 'px) rotate(' + rot + 'deg) scale(' + s + ')'; };
    var dur = durMs || (3000 + Math.random() * 1000);
    var an = c.animate([{ transform: tr(P.x1, P.y1, P.s1 || 1), opacity: 0 }, { opacity: 0.7, offset: 0.18 }, { opacity: 0.6, offset: 0.7 }, { transform: tr(P.x2, P.y2, P.s2 || 1), opacity: 0 }], { duration: dur, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'forwards' });
    an.onfinish = function () { clearInterval(fl); c.remove(); flying = false; };
    return true;
  }
  function schedule() { setTimeout(function () { if (!fly()) { setTimeout(schedule, 0); return; } schedule(); }, 40000 + Math.random() * 30000); }
  zone('path', '#path', function (host) { // from the "?" circle, heading away into the distance
    var map = host.querySelector('[data-mpath]'), q = map && map.nextElementSibling && map.nextElementSibling.firstElementChild; if (!q) return null;
    var hr = host.getBoundingClientRect(), qr = q.getBoundingClientRect(), x = qr.left - hr.left + qr.width / 2, y = qr.top - hr.top + qr.height / 2, side = Math.random() < 0.5 ? -1 : 1;
    return { x1: x + side * 60, y1: y, x2: x + side * (260 + Math.random() * 80), y2: y - 30 - Math.random() * 40, s1: 0.9, s2: 0.3, w: 60 };
  });
  zone('footer', 'footer', function (host) { // across the sky above the moon landscape
    var hr = host.getBoundingClientRect(), W = hr.width, H = hr.height, ltr = Math.random() < 0.6;
    var x1 = W * (ltr ? 0.2 + Math.random() * 0.1 : 0.72 + Math.random() * 0.08), x2 = x1 + (ltr ? 1 : -1) * W * (0.3 + Math.random() * 0.12);
    return { x1: x1, y1: H * (0.43 + Math.random() * 0.04), x2: x2, y2: H * (0.39 + Math.random() * 0.03), s1: 0.85, s2: 0.6, w: 56 };
  });
  zone('hero', '#top', function (host) {
    var W = host.offsetWidth, H = Math.min(host.offsetHeight, innerHeight);
    return { x1: W * 0.12, y1: H * 0.3, x2: W * 0.82, y2: H * 0.1, s1: 0.8, s2: 0.55, w: 58 };
  });
  schedule();

  window.SpaceVignette = { mount: mount, update: update, fly: fly, zone: zone, HERO: HERO };
})();
