// motion + interactions for the portfolio. all the loops live here so react re-renders don't kill them
(function () {
  if (window.__pfx) { window.__pfx.scan(); return; }
  var P = window.__pfx = { ready: false };
  var EASE = 'cubic-bezier(.19,1,.22,1)';
  var INK = '#1f2b33', CREAM = '#efebe5', TERRA = '#ab6a55', SAGE = '#5d6b55';
  var fine = matchMedia('(pointer: fine)').matches;
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches || localStorage.getItem('pfx-calm') === '1';
  var docEl = document.documentElement;

  function root() { return document.querySelector('[data-pfx-root]'); }
  function opt(k, d) { var r = root(); var v = r && r.getAttribute('data-' + k); return v == null || v === '' ? d : v; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  var st = document.createElement('style');
  st.textContent = 'html.pfx-cur, html.pfx-cur *{cursor:none!important}';
  document.head.appendChild(st);

  // scroll reveals
  var pending = [];
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); pending.push(e.target.__rev || e.target); } });
    flush();
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

  function flush() { if (!P.ready) return; var l = pending; pending = []; l.forEach(show); }

  function prep(el) {
    if (el.__pfx) return; el.__pfx = 1;
    if (calm) return;
    var t = el.getAttribute('data-reveal');
    el.style.transition = 'none';
    if (t === 'rise') el.style.transform = 'translateY(110%)';
    else if (t === 'up') { el.style.opacity = '0'; el.style.transform = 'translateY(48px)'; }
    else if (t === 'mask') el.style.clipPath = 'inset(0 0 100% 0)';
    else if (t === 'wipe') el.style.clipPath = 'inset(0 100% 0 0)';
    else if (t === 'line') { el.style.transform = 'scaleX(0)'; el.style.transformOrigin = 'left center'; }
    else if (t === 'pop') { el.style.opacity = '0'; el.style.transform = 'scale(.6)'; }
    else if (t === 'draw') { el.style.strokeDashoffset = '100'; }
    else if (t === 'sweep') { el.style.backgroundSize = '0% 100%'; }
    else if (t === 'slideL' || t === 'slideR') { el.style.opacity = '0'; el.style.transform = 'translate3d(' + (t === 'slideL' ? -60 : 60) + 'px,24px,0) rotate(' + (t === 'slideL' ? -3 : 3) + 'deg)'; }
    else if (t === 'type') { if (el.__txt == null) el.__txt = el.textContent; el.textContent = '\u200b'; el.style.borderRight = '2px solid currentColor'; el.style.paddingRight = '2px'; }
    else if (t === 'jump') { el.style.backgroundSize = '0% 100%'; el.__col = el.style.color; }
    else el.style.opacity = '0';
    el.__hidden = 1;
        var tgt = t === 'rise' && el.parentElement ? el.parentElement : el;
    tgt.__rev = el;
    io.observe(tgt);
  }

  function show(el) {
    if (!el.__hidden) return; el.__hidden = 0;
    var d = +(el.getAttribute('data-delay') || 0);
    var t = el.getAttribute('data-reveal');
    var dur = t === 'mask' ? 1.4 : t === 'rise' ? 1.25 : 1.1;
    el.style.transition = 'transform ' + dur + 's ' + EASE + ' ' + d + 'ms, opacity .9s ease ' + d + 'ms, clip-path ' + dur + 's ' + EASE + ' ' + d + 'ms, stroke-dashoffset ' + (t === 'draw' ? 0.9 : dur) + 's cubic-bezier(.65,0,.35,1) ' + d + 'ms';
    void el.offsetWidth;
    if (t === 'type') {
      var s = el.__txt || '', i = 0;
      setTimeout(function () {
        var iv = setInterval(function () {
          i++; el.textContent = s.slice(0, i) || '\u200b';
          if (i >= s.length) { clearInterval(iv); setTimeout(function () { el.style.borderRight = '2px solid transparent'; }, 900); }
        }, 32);
      }, d);
      return;
    }
    if (t === 'jump') {
      el.style.transition = 'background-size .55s cubic-bezier(.65,0,.35,1) ' + d + 'ms, color .3s ease ' + (d + 250) + 'ms'; void el.offsetWidth;
      el.style.backgroundSize = '100% 100%'; el.style.color = 'var(--p-bg,#efebe5)';
      if (el.animate) el.animate([{ transform: 'scale(1) rotate(0deg)' }, { transform: 'scale(1.16) rotate(-4deg)', offset: .45 }, { transform: 'scale(.96) rotate(1deg)', offset: .75 }, { transform: 'scale(1.04) rotate(-2deg)' }], { duration: 950, delay: d + 300, easing: 'cubic-bezier(.2,.9,.3,1.2)', fill: 'forwards' });
      return;
    }
    if (t === 'sweep') { el.style.transition = 'background-size .9s cubic-bezier(.65,0,.35,1) ' + d + 'ms'; void el.offsetWidth; el.style.backgroundSize = '100% 100%'; return; }
    el.style.transform = ''; el.style.opacity = ''; el.style.clipPath = ''; if (t === 'draw') el.style.strokeDashoffset = '0';
    if (el.hasAttribute('data-count')) count(el, d);
  }

  function revealAll() {
    document.querySelectorAll('[data-reveal]').forEach(function (el) {
      if (el.__hidden) { el.__hidden = 0; io.unobserve(el); el.style.transition = 'none'; el.style.transform = ''; el.style.opacity = ''; el.style.clipPath = ''; if (el.getAttribute('data-reveal') === 'draw') el.style.strokeDashoffset = '0'; if (el.getAttribute('data-reveal') === 'sweep') el.style.backgroundSize = '100% 100%'; if (el.getAttribute('data-reveal') === 'type' && el.__txt != null) { el.textContent = el.__txt; el.style.borderRight = ''; }
      if (el.getAttribute('data-reveal') === 'jump') { el.style.backgroundSize = '100% 100%'; el.style.color = 'var(--p-bg,#efebe5)'; el.style.transform = 'scale(1.04) rotate(-2deg)'; } }
    });
  }

  function count(el, delay) {
    var target = parseFloat(el.getAttribute('data-count')); var suf = el.getAttribute('data-suffix') || '';
    if (isNaN(target)) return;
    var t0 = performance.now() + delay, D = 1700;
    (function step(t) {
      if (!el.isConnected) return;
      var p = clamp((t - t0) / D, 0, 1); var e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      el.textContent = Math.round(e * target) + suf;
      if (p < 1) requestAnimationFrame(step);
    })(performance.now());
  }

  // intro animation on first load
  function intro() {
    if (opt('intro', 'true') === 'false' || calm) { P.ready = true; flush(); return; }
    // the rocket launch (reduced motion keeps the simple counter below)
    if (window.LoaderFX && !matchMedia('(prefers-reduced-motion: reduce)').matches) { window.LoaderFX(function () { P.ready = true; flush(); }); return; }
    var el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;z-index:10000;background:' + INK + ';color:' + CREAM + ';display:flex;flex-direction:column;justify-content:space-between;padding:26px 32px;box-sizing:border-box;font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;clip-path:inset(0 0 0 0);transition:clip-path 1.1s ' + EASE;
    el.innerHTML = '<div style="display:flex;justify-content:space-between;gap:16px"><span>Jayden Chia</span><span>IT &amp; Security &middot; Melbourne</span></div>' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap"><span data-n style="font-family:Archivo,sans-serif;font-stretch:125%;font-weight:800;font-size:clamp(96px,20vw,300px);line-height:.8;letter-spacing:-.05em">000</span><span data-s>Powering on</span></div>' +
      '<div data-bar style="position:absolute;left:0;bottom:0;height:3px;width:0;background:' + TERRA + '"></div>';
    document.body.appendChild(el); P._loader = el;
    var n = el.querySelector('[data-n]'), bar = el.querySelector('[data-bar]'), s = el.querySelector('[data-s]');
    var msgs = ['Patching the floor', 'Scoping DHCP', 'Arming EDR', 'Syncing identity', 'All green'];
    var t0 = performance.now(), D = 1600;
    (function step(t) {
      var p = clamp((t - t0) / D, 0, 1), e = 1 - Math.pow(1 - p, 3);
      n.textContent = String(Math.round(e * 100)).padStart(3, '0');
      bar.style.width = (e * 100) + '%';
      s.textContent = msgs[Math.min(msgs.length - 1, Math.floor(e * msgs.length))];
      if (p < 1) requestAnimationFrame(step);
      else {
        setTimeout(function () { el.style.clipPath = 'inset(0 0 100% 0)'; }, 120);
        setTimeout(function () { P.ready = true; flush(); }, 380);
        setTimeout(function () { el.remove(); }, 1400);
      }
    })(t0);
  }

  // page transition
  function panel(bg, z) {
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;z-index:' + z + ';background:' + bg + ';transform:translateY(100%);transition:transform .7s ' + EASE + ';pointer-events:none';
    document.body.appendChild(d); return d;
  }
  P.wipe = function (cb) {
    if (calm) { cb(); return; }
    var a = panel(TERRA, 9995), b = panel(INK, 9996);
    b.innerHTML = '<div style="position:absolute;left:32px;bottom:28px;font-family:\'IBM Plex Mono\',monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:' + CREAM + '">Loading</div>';
    void a.offsetWidth;
    a.style.transform = 'translateY(0)';
    setTimeout(function () { b.style.transform = 'translateY(0)'; }, 90);
    setTimeout(function () { cb(); }, 760);
    setTimeout(function () { b.style.transform = 'translateY(-100%)'; }, 900);
    setTimeout(function () { a.style.transform = 'translateY(-100%)'; }, 980);
    setTimeout(function () { a.remove(); b.remove(); }, 1800);
  };

  P.setCalm = function (v) {
    calm = !!v;
    localStorage.setItem('pfx-calm', calm ? '1' : '0');
    if (calm) {
      revealAll();
      (P.par || []).forEach(function (el) { el.style.transform = ''; });
    }
  };
  P.isCalm = function () { return calm; };

  // dark mode + toggles
  function setToggle(el, on) {
    el.__on = on;
    var k = el.querySelector('[data-knob]');
    if (k) k.style.transform = on ? 'translateX(.53em)' : '';
    el.style.background = on ? SAGE : TERRA;
  }
  function bindToggles() {
    document.querySelectorAll('[data-toggle]').forEach(function (el) {
      if (el.__tb) return; el.__tb = 1;
      el.addEventListener('click', function () { setToggle(el, !el.__on); });
      el.addEventListener('mouseenter', function () { el.__hover = 1; setToggle(el, !el.__on); });
      el.addEventListener('mouseleave', function () { el.__hover = 0; });
    });
  }
  setInterval(function () {
    if (calm) return;
    document.querySelectorAll('[data-toggle]').forEach(function (el) { if (!el.__hover) setToggle(el, !el.__on); });
  }, 2400);

  // melbourne clock in contact
  var fmt;
  try { fmt = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne', weekday: 'short', hour: 'numeric', minute: '2-digit' }); } catch (e) { fmt = null; }
  function clock() {
    var s = fmt ? fmt.format(new Date()) : new Date().toLocaleTimeString();
    s = 'MEL  ' + s.replace(',', '').toUpperCase();
    document.querySelectorAll('[data-clock]').forEach(function (el) { if (el.textContent !== s) el.textContent = s; });
  }
  setInterval(clock, 15000);

  // custom cursor (desktop only)
  var cur = null, pv = null;
  function buildCursor() {
    if (!fine || cur) return;
    var ring = document.createElement('div');
    ring.style.cssText = 'position:fixed;left:0;top:0;width:80px;height:80px;border-radius:50%;border:1.5px solid ' + CREAM + ';box-sizing:border-box;pointer-events:none;z-index:9998;mix-blend-mode:difference;display:none;align-items:center;justify-content:center;transition:background .3s ease,border-color .3s ease';
    var lab = document.createElement('span');
    lab.style.cssText = 'font-family:"IBM Plex Mono",monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#000;opacity:0;transition:opacity .25s ease';
    ring.appendChild(lab);
    var dot = document.createElement('div');
    dot.style.cssText = 'position:fixed;left:0;top:0;width:6px;height:6px;border-radius:50%;background:' + CREAM + ';pointer-events:none;z-index:9999;mix-blend-mode:difference;display:none';
    document.body.appendChild(ring); document.body.appendChild(dot);
    cur = { ring: ring, dot: dot, lab: lab, k: 0.45, kt: 0.45 };

    pv = document.createElement('div');
    pv.style.cssText = 'position:fixed;left:0;top:0;width:250px;box-sizing:border-box;padding:14px 16px 13px;background:color-mix(in oklab, var(--p-bg,#efebe5) 62%, transparent);-webkit-backdrop-filter:blur(16px) saturate(1.4);backdrop-filter:blur(16px) saturate(1.4);border:1px solid color-mix(in oklab, var(--p-ink,#1f2b33) 12%, transparent);box-shadow:0 18px 40px -22px rgba(31,43,51,.45);color:var(--p-ink,#1f2b33);pointer-events:none;z-index:9990;opacity:0;display:flex;flex-direction:column;gap:8px;will-change:transform,opacity,filter';
    pv.innerHTML = '<div style="display:flex;align-items:center;gap:8px;font-family:\'IBM Plex Mono\',monospace;font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;opacity:.7"><span style="width:6px;height:6px;border-radius:50%;background:#7a8a5e;box-shadow:0 0 0 3px rgba(122,138,94,.18)"></span><span data-pn></span><span>&middot;</span><span data-pk></span></div>' +
      '<div data-ps style="font-family:\'Instrument Serif\',serif;font-style:italic;font-size:22px;line-height:1.15;letter-spacing:-.005em"></div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:#ab6a55">Tap to read &#8599;</div>';
    pv = null;
  }

  var mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my, px = mx, py = my, ps = 0, pT = 0;
  window.addEventListener('mousemove', function (e) {
    mx = e.clientX; my = e.clientY;
    (P.mag || []).forEach(function (el) {
      if (!el.isConnected || calm) return;
      var r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, dx = mx - cx, dy = my - cy;
      if (Math.abs(dx) < r.width / 2 + 36 && Math.abs(dy) < r.height / 2 + 36) {
        if (!el.__mt) { el.__mt = 1; el.style.transition = 'transform .6s ' + EASE; }
        el.style.transform = 'translate(' + (dx * 0.28) + 'px,' + (dy * 0.36) + 'px)'; el.__m = 1;
      } else if (el.__m) { el.__m = 0; el.style.transform = ''; }
    });
  }, { passive: true });

  document.addEventListener('mouseover', function (e) {
    var t = e.target && e.target.closest ? e.target : null;
    if (!t) return;
    var row = t.closest('[data-pv-num]');
    if (pv) {
      if (row && !calm) {
        pv.querySelector('[data-pn]').textContent = row.getAttribute('data-pv-num') || '';
        pv.querySelector('[data-pk]').textContent = row.getAttribute('data-pv-kicker') || '';
        pv.querySelector('[data-ps]').textContent = row.getAttribute('data-pv-stat') || '';
        pT = 1;
      } else pT = 0;
    }
    if (cur) {
      var h = t.closest('[data-cursor],a,button');
      var label = h ? (h.getAttribute('data-cursor') || '') : '';
      if (row) label = '';
      cur.kt = h ? (label ? 1 : 0.7) : 0.45;
      cur.lab.textContent = label; cur.lab.style.opacity = label ? '1' : '0';
      cur.ring.style.background = label ? CREAM : 'transparent';
    }
  });

  // main rAF loop
  var lastY = scrollY, vel = 0, sd = 1;
  function tick() {
    var y = scrollY; vel += ((y - lastY) - vel) * 0.12; lastY = y;
    if (vel > 0.4) sd = 1; else if (vel < -0.4) sd = -1;
    var W = innerWidth, H = innerHeight;

    if (cur) {
      var on = opt('cursor', 'true') !== 'false' && !calm;
      var disp = on ? 'flex' : 'none';
      if (cur.ring.style.display !== disp) { cur.ring.style.display = disp; cur.dot.style.display = on ? 'block' : 'none'; docEl.classList.toggle('pfx-cur', on); }
      if (on) {
        rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18; cur.k += (cur.kt - cur.k) * 0.16;
        cur.dot.style.transform = 'translate3d(' + (mx - 3) + 'px,' + (my - 3) + 'px,0)';
        cur.ring.style.transform = 'translate3d(' + (rx - 40) + 'px,' + (ry - 40) + 'px,0) scale(' + cur.k + ')';
      }
    }
    if (pv) {
      ps += (pT - ps) * 0.09; px += (mx - px) * 0.09; py += (my - py) * 0.09;
      var rot = clamp((mx - px) * 0.025, -4, 4);
      var x = px + 22; if (x + 250 > W - 12) x = px - 272;
      var yy = clamp(py + 22, 12, H - 140);
      pv.style.opacity = ps.toFixed(3);
      pv.style.filter = 'blur(' + ((1 - ps) * 8).toFixed(2) + 'px)';
      pv.style.transform = 'translate3d(' + x + 'px,' + (yy + (1 - ps) * 10) + 'px,0) rotate(' + rot + 'deg) scale(' + (0.94 + 0.06 * ps) + ')';
    }

    (P.marq || []).forEach(function (m) {
      if (!m.isConnected) return;
      var t = m.__t || (m.__t = m.querySelector('[data-track]')); if (!t || !t.isConnected) { m.__t = null; return; }
      var half = t.scrollWidth / 2; if (!half) return;
      var d = +(m.getAttribute('data-marquee')) || 1;
      var mul = +(m.getAttribute('data-speed-mul')) || 1;
      if (!calm) m.__x = (m.__x || 0) - (0.55 + Math.min(Math.abs(vel) * 0.4, 16)) * d * sd * mul;
      else m.__x = m.__x || 0;
      if (m.__x <= -half) m.__x += half; if (m.__x > 0) m.__x -= half;
      var sk = calm || mul < 1 ? 0 : clamp(-vel * 0.3, -12, 12);
      t.style.transform = 'translate3d(' + m.__x + 'px,0,0) skewX(' + sk.toFixed(2) + 'deg)';
    });

    (P.hs || []).forEach(function (s) {
      if (!s.isConnected) return;
      var r = s.getBoundingClientRect(), total = r.height - H; if (total <= 0) return;
      var p = clamp(-r.top / total, 0, 1);
      var tr = s.querySelector('[data-htrack]'), bar = s.querySelector('[data-hprog]');
      if (tr) { var dist = Math.max(0, tr.scrollWidth - W + 64); tr.style.transform = 'translate3d(' + (-p * dist) + 'px,0,0)'; }
      if (bar) bar.style.width = (p * 100).toFixed(2) + '%';
    });

    if (!calm) (P.par || []).forEach(function (el) {
      if (!el.isConnected) return;
      var r = el.getBoundingClientRect(); if (r.bottom < -200 || r.top > H + 200) return;
      var off = (r.top + r.height / 2 - H / 2) * (+el.getAttribute('data-speed') || 0);
      el.style.transform = 'translate3d(0,' + off.toFixed(1) + 'px,0)';
    });

    (P.glow || []).forEach(function (el) {
      if (!el.isConnected) return;
      var r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > H) return;
      var inside = mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom;
      var tx = mx - r.left, ty = my - r.top;
      if (el.__ga == null) { el.__ga = 0; el.__gx = tx; el.__gy = ty; }
      el.__ga += ((inside ? 1 : 0) - el.__ga) * 0.07;
      el.__gx += (tx - el.__gx) * 0.14; el.__gy += (ty - el.__gy) * 0.14;
      if (el.__ga < 0.002 && !inside) { if (el.__gon) { el.__gon = 0; el.style.setProperty('--ga', '0'); } return; }
      el.__gon = 1;
      el.style.setProperty('--ga', el.__ga.toFixed(3));
      el.style.setProperty('--gx', el.__gx.toFixed(1) + 'px');
      el.style.setProperty('--gy', el.__gy.toFixed(1) + 'px');
    });

    q('[data-pathmap]').forEach(function (m) {
      var r = m.getBoundingClientRect(); if (r.bottom < -100 || r.top > H + 100) return;
      var fill = m.querySelector('[data-pathfill]'), tok = m.querySelector('[data-pathtoken]');
      var span = r.height - 48; var p = clamp((H * 0.55 - r.top - 24) / span, 0, 1);
      var prev = m.__p == null ? p : m.__p;
      m.__p = m.__p == null ? p : m.__p + (p - m.__p) * 0.12;
      var y = 24 + m.__p * span;
      var v = (m.__p - prev) * span; var k = clamp(Math.abs(v) * 0.015, 0, 0.1);
      if (fill) fill.style.height = (m.__p * span).toFixed(1) + 'px';
      if (tok) { tok.style.top = y.toFixed(1) + 'px'; tok.style.transform = 'scale(' + (1 - k * 0.5).toFixed(3) + ',' + (1 + k).toFixed(3) + ')'; tok.style.opacity = m.__p > 0.003 && m.__p < 0.997 ? '1' : (m.__p >= 0.997 ? '1' : '0'); }
      // levels light up when the rocket reaches them (and go back out when it leaves); no rocket: follow the line
      var rk = m.querySelector('[data-rocket] > [data-rk-body] > img'), rkY = null;
      if (rk) { var kr = rk.getBoundingClientRect(); if (kr.height) rkY = kr.top + kr.height / 2 - r.top; }
      Array.prototype.forEach.call(m.querySelectorAll('[data-lvnode]'), function (n) {
        if (n.__pulse == null) { n.__pulse = n.style.animation || ''; n.style.animation = ''; }
        var nr = n.getBoundingClientRect(), ny = nr.top + nr.height / 2 - r.top; var passed = rkY != null ? rkY >= ny - 2 : ny <= y + 2;
        if (n.__passed === passed) return; var first = n.__passed == null; n.__passed = passed;
        if (passed && !first) {
          n.style.transition = 'background 1.1s cubic-bezier(.22,1,.36,1), color 1.1s cubic-bezier(.22,1,.36,1), border-color 1.1s cubic-bezier(.22,1,.36,1)';
          var ring = document.createElement('span');
          ring.style.cssText = 'position:absolute;left:50%;top:50%;width:48px;height:48px;margin:-24px 0 0 -24px;border-radius:50%;border:1px solid #ab6a55;pointer-events:none;z-index:-1';
          n.parentElement.appendChild(ring);
          if (ring.animate) ring.animate([{ transform: 'scale(1)', opacity: .7 }, { transform: 'scale(' + (innerWidth < 761 ? 1.15 : 1.9) + ')', opacity: 0 }], { duration: 1600, easing: 'cubic-bezier(.22,1,.36,1)' }).onfinish = function () { ring.remove(); }; else ring.remove();
        }
        n.style.background = passed ? '#ab6a55' : 'var(--p-bg,#efebe5)'; n.style.color = passed ? '#f7f3ed' : 'var(--p-ink,#1f2b33)';
        n.style.animation = passed ? n.__pulse : ''; // "you are here" pulse only once it's reached
      });
    });

        if (P.ready && ++P._f % 20 === 0) {
      q('[data-reveal]').forEach(function (el) {
        if (!el.__hidden) return;
        var box = (el.getAttribute('data-reveal') === 'rise' && el.parentElement ? el.parentElement : el).getBoundingClientRect();
        if (box.bottom > 0 && box.top < H * 0.96) show(el);
      });
    }

    requestAnimationFrame(tick);
  }
  P._f = 0;

  // re-scan the dom when content changes
  function q(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function toolkit() {
    var rows = q('[data-tk]').map(function (w) { return w.parentElement; });
    rows.forEach(function (row) {
      if (row.__tk) return; row.__tk = 1;
      row.style.transition = (row.style.transition ? row.style.transition + ',' : '') + 'opacity .5s ease, filter .5s ease';
      row.addEventListener('mouseenter', function () {
        q('[data-tk]').forEach(function (w) { var r = w.parentElement; var me = r === row; r.style.opacity = me ? '1' : '.28'; r.style.filter = me ? '' : 'saturate(.4)'; });
        var t = row.querySelector('[data-tkt]'); if (t) t.style.color = t.getAttribute('data-alt');
      });
      row.addEventListener('mouseleave', function () {
        q('[data-tk]').forEach(function (w) { var r = w.parentElement; r.style.opacity = ''; r.style.filter = ''; });
        var t = row.querySelector('[data-tkt]'); if (t) t.style.color = t.getAttribute('data-base');
      });
    });
  }
  function railTips() {
    q('aside[aria-label="Quick menu"] > a, aside[aria-label="Quick menu"] > button').forEach(function (el) {
      if (el.__tip) return;
      var tip = document.createElement('span'); el.__tip = tip;
      tip.textContent = el.getAttribute('aria-label') === 'Toggle dark mode' ? 'Dark mode' : el.getAttribute('aria-label') === 'Download resume' ? 'Resume' : el.getAttribute('aria-label');
      tip.setAttribute('aria-hidden', 'true');
      tip.style.cssText = "position:absolute;right:calc(100% + 10px);left:auto;top:50%;margin:0;width:max-content;transform:translate(8px,-50%);opacity:0;pointer-events:none;white-space:nowrap;padding:6px 11px;background:var(--p-ink,#1f2b33);color:var(--p-bg,#efebe5);font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;font-weight:500;line-height:1.2;transition:opacity .25s ease,transform .45s cubic-bezier(.16,1,.3,1)";
      el.style.position = 'relative'; el.removeAttribute('title');
      el.appendChild(tip);
      el.addEventListener('mouseenter', function () { tip.style.opacity = '1'; tip.style.transform = 'translate(0,-50%)'; });
      el.addEventListener('mouseleave', function () { tip.style.opacity = '0'; tip.style.transform = 'translate(8px,-50%)'; });
      el.addEventListener('focus', function () { tip.style.opacity = '1'; tip.style.transform = 'translate(0,-50%)'; });
      el.addEventListener('blur', function () { tip.style.opacity = '0'; tip.style.transform = 'translate(8px,-50%)'; });
    });
  }
  P.scan = function () {
    q('[data-reveal]').forEach(prep);
    P.marq = q('[data-marquee]'); P.hs = q('[data-hscroll]'); P.par = q('[data-speed]'); P.mag = q('[data-magnetic]'); P.glow = q('[data-glow]');
    bindToggles(); clock(); railTips();
    P.glow.forEach(function (el) {
      if (el.__gb) return; el.__gb = 1;
      function set(on) {
        var s = el.querySelector('[data-sub]'), si = el.querySelector('[data-subin]'), t = el.querySelector('[data-ttl]'), a = el.querySelector('[data-arr]');
        if (s) s.style.gridTemplateRows = on ? '1fr' : '0fr';
        if (si) { si.style.opacity = on ? '1' : '0'; si.style.transform = on ? 'translateY(0)' : 'translateY(8px)'; si.style.filter = on ? 'blur(0)' : 'blur(4px)'; }
        var fl = el.querySelector('[data-fill]'), br = el.querySelector('[data-bar]'), ln = el.querySelector('[data-line]'), nm = el.querySelector('[data-num]');
        Array.prototype.forEach.call(el.querySelectorAll('[data-wave]'), function (w, i) { w.style.transitionDelay = on ? (i * 35) + 'ms' : '0ms'; w.style.transform = on ? 'translateY(-5px)' : ''; });
        var fn = el.querySelector('[data-fname]'); if (fn) fn.style.backgroundSize = on ? '100% 100%' : '0% 100%';
        if (fl) fl.style.transform = on ? 'scaleX(1)' : 'scaleX(0)';
        if (br) br.style.transform = on ? 'scaleY(1)' : 'scaleY(0)';
        if (ln) ln.style.transform = on ? 'scaleX(1)' : 'scaleX(0)';
        if (nm) nm.style.color = on ? '#ab6a55' : '';
        if (t) { t.style.transform = on ? 'translateX(4px)' : ''; var alt = t.getAttribute('data-alt'), base = t.getAttribute('data-base'); t.style.color = on ? (alt || '#ab6a55') : (base || ''); }
        if (a) { a.style.transform = on ? 'rotate(45deg)' : ''; a.style.background = on ? 'var(--p-ink,#1f2b33)' : ''; a.style.color = on ? 'var(--p-bg,#efebe5)' : ''; a.style.borderColor = on ? 'var(--p-ink,#1f2b33)' : ''; }
      }
      el.addEventListener('mouseenter', function () { set(true); });
      el.addEventListener('mouseleave', function () { set(false); });
    });
    if (!P._intro && root()) { P._intro = 1; intro(); }
  };

  function boot() {
    buildCursor();
    var tmr;
    new MutationObserver(function () { clearTimeout(tmr); tmr = setTimeout(P.scan, 50); }).observe(document.body, { childList: true, subtree: true });
    P.scan();
    setTimeout(function () {
      if (P._loader && P._loader.isConnected) P._loader.remove();
      if (!P.ready) { P._intro = 1; P.ready = true; revealAll(); }
    }, 4500);
    requestAnimationFrame(tick);
  }
  if (document.body) boot(); else document.addEventListener('DOMContentLoaded', boot);
})();
