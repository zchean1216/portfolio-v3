// slow, out-of-sync motion for the space line art. transforms + opacity only.
// elements opt in with data-sm="spark|const|orbit|ringed|planet|moon|sat".
(function () {
  if (window.__sm) return; window.__sm = 1;

  var rmQ = matchMedia('(prefers-reduced-motion: reduce)');
  function rm() { return rmQ.matches; }
  var DEPTH = { dots: 3, spark: 12, 'const': 8, orbit: 4, ringed: 5, planet: 5, moon: 5, sat: 6, asteroid: 5, glint: 12 };
  var els = [], hidden = document.hidden;
  function R(a, b) { return a + Math.random() * (b - a); }
  function vary(el, a, b, k) { k = k || ''; var d = R(a, b); el.style.setProperty('--d' + k, d.toFixed(2) + 's'); el.style.setProperty('--dl' + k, (-R(0, d)).toFixed(2) + 's'); }

  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      var el = e.target;
      el.__vis = e.isIntersecting;
      if (e.isIntersecting) { el.removeAttribute('data-off'); if (el.__draw) el.__draw(); if (el.__packet) el.__packet.wake(); }
      else el.setAttribute('data-off', '');
    });
  }, { rootMargin: '80px' });

  function initConst(el) {
    var svg = el.tagName.toLowerCase() === 'svg' ? el : el.querySelector('svg');
    var poly = svg && svg.querySelector('polyline'); if (!poly) return;
    var polys = Array.prototype.slice.call(svg.querySelectorAll('polyline'));
    svg.querySelectorAll('circle:not([data-packet]), [data-star]').forEach(function (c) { vary(c, 3, 7); });
    if (rm()) return;
    var vb = svg.viewBox.baseVal, w = svg.getBoundingClientRect().width;
    if (!w || !vb || !vb.width) return;
    var scale = w / vb.width;
    polys.forEach(function (pl) { var L = Math.ceil(pl.getTotalLength() * scale) + 4; pl.style.strokeDasharray = L; pl.style.strokeDashoffset = L; });
    var pts = []; for (var i = 0; i < poly.points.numberOfItems; i++) { var q = poly.points.getItem(i); pts.push({ x: q.x, y: q.y }); }
    var c = svg.querySelector('[data-packet]');
    if (c) { c.setAttribute('r', (2.2 / scale).toFixed(2)); c.style.transformBox = 'view-box'; }
    el.__draw = function () {
      el.__draw = null;
      polys.forEach(function (pl, i) { pl.style.transition = 'stroke-dashoffset 1.5s cubic-bezier(.65,0,.35,1) ' + (i ? 0.25 + i * 0.12 : 0) + 's'; });
      requestAnimationFrame(function () { polys.forEach(function (pl) { pl.style.strokeDashoffset = 0; }); });
      setTimeout(function () { el.__drawn = true; if (el.__packet) el.__packet.wake(); }, 1600);
    };
    if (!c) return;
    var k = 0, running = false;
    function place(p, anim) { c.style.transition = anim ? 'transform 1.2s cubic-bezier(.45,0,.55,1), opacity .5s ease' : 'opacity .5s ease'; c.style.transform = 'translate(' + p.x + 'px,' + p.y + 'px)'; }
    function step() {
      if (!el.__vis || hidden || rm()) { running = false; return; }
      if (k === 0) { place(pts[0], false); c.getBoundingClientRect(); c.style.opacity = '1'; k = 1; setTimeout(step, 600); return; }
      if (k < pts.length) { place(pts[k], true); k++; setTimeout(step, k < pts.length ? R(1500, 2400) : 1400); return; }
      c.style.opacity = '0'; k = 0; setTimeout(step, R(2500, 5000));
    }
    el.__packet = { wake: function () { if (!running && el.__drawn && el.__vis && !hidden && !rm()) { running = true; setTimeout(step, R(300, 1500)); } } };
  }

  function init(el) {
    el.__sm = 1;
    var t = el.getAttribute('data-sm');
    if (t === 'dots') { vary(el, 22, 34); el.style.setProperty('--dx', R(3, 7).toFixed(1) + 'px'); el.style.setProperty('--dy', R(2, 5).toFixed(1) + 'px'); el.querySelectorAll('circle').forEach(function (c) { vary(c, 2.2, 6.5); }); }
    else if (t === 'spark' || t === 'glint') { vary(el, 3, 7); vary(el, 8, 18, '3'); vary(el, 1.8, 3.4, '4'); }
    else if (t === 'const') initConst(el);
    else if (t === 'orbit') el.querySelectorAll('[data-orb-spk]').forEach(function (s) { vary(s, 3, 7); });
    else if (t === 'ringed' || t === 'planet' || t === 'moon') {
      vary(el, 6, 9); el.style.setProperty('--amp', R(6, 10).toFixed(1) + 'px');
      if (t === 'ringed') vary(el, 7, 11, '2');
      if (t === 'moon') el.style.setProperty('--dl2', (-R(0, 120)).toFixed(1) + 's');
    } else if (t === 'asteroid') {
      vary(el, 6, 9); el.style.setProperty('--amp', R(4, 8).toFixed(1) + 'px'); vary(el, 70, 140, '2');
      el.style.setProperty('--dir2', Math.random() < 0.5 ? 'normal' : 'reverse');
    } else if (t === 'sat') el.style.setProperty('--dl', (-R(0, 20)).toFixed(1) + 's');
    else if (t === 'comet') { vary(el, 5, 8); el.__k = Math.floor(R(0, 4)); }
    else if (t === 'nebula') vary(el, 12, 18);
    else if (t === 'meteor') vary(el, 2.8, 4.4);
    else if (t === 'belt') vary(el, 14, 20);
    else if (t === 'astro') vary(el, 8, 12);
    el.__hero = !!el.closest('#top');
    el.__depth = el.hasAttribute('data-sm-still') || (el.parentElement && el.parentElement.closest('[data-sm]')) ? 0 : (DEPTH[t] || 0);
    el.setAttribute('data-off', '');
    io.observe(el); els.push(el);
  }
  function scan() {
    els = els.filter(function (e) { if (e.isConnected) return true; io.unobserve(e); return false; });
    document.querySelectorAll('[data-sm]').forEach(function (el) { if (!el.__sm) init(el); });
  }
  setInterval(scan, 1000); scan();

  // comet tails: step through the four tail frames, like the flyby comets
  setInterval(function () {
    if (hidden || rm()) return;
    els.forEach(function (el) {
      if (!el.__vis || el.getAttribute('data-sm') !== 'comet') return;
      var imgs = el.querySelectorAll('[data-ang]>img'); if (imgs.length < 2) return;
      el.__k = (el.__k + 1) % imgs.length;
      imgs.forEach(function (im, i) { if (i === el.__k) im.setAttribute('data-on', ''); else im.removeAttribute('data-on'); });
    });
  }, 160);

  document.addEventListener('visibilitychange', function () {
    hidden = document.hidden;
    if (hidden) document.documentElement.setAttribute('data-tabhidden', '');
    else { document.documentElement.removeAttribute('data-tabhidden'); els.forEach(function (e) { if (e.__packet) e.__packet.wake(); }); }
  });

  // depth: scroll only (hero elements drift up at their own rate as you scroll away). nothing follows the cursor
  var ts = 0, cs = 0, raf = 0;
  var loop = function () {
    raf = 0; if (hidden || rm()) return;
    cs += (ts - cs) * 0.12;
    els.forEach(function (e) { if (e.__vis && e.__depth) e.style.translate = '0px ' + (e.__hero ? -cs * e.__depth * 0.012 : 0).toFixed(2) + 'px'; });
    if (Math.abs(ts - cs) > 0.2) raf = requestAnimationFrame(loop);
  };
  addEventListener('scroll', function () {
    if (rm()) return;
    ts = Math.min(scrollY, innerHeight * 1.5);
    if (!raf) raf = requestAnimationFrame(loop);
  }, { passive: true });
})();
