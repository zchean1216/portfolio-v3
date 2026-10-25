// Loading screen: the rocket on its launch pad counts down, lifts off (the number becomes altitude, and friction
// builds over the nose through two drawn stages as it climbs) and the sky lifts away behind it to show the page.
// window.LoaderFX(ready): calls ready() once while still covered, so the hero is settled when it's revealed.
(function () {
  var INK = '#1f2b33', CREAM = '#efebe5', EASE = 'cubic-bezier(.19,1,.22,1)';
  var MONO = '"IBM Plex Mono",monospace';
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // shared frame: the same top line as before, a star sky, a counter and a status line
  function frame() {
    var el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'position:fixed;inset:0;z-index:10000;background:' + INK + ';color:' + CREAM + ';overflow:hidden;font-family:' + MONO + ';font-size:11px;letter-spacing:.16em;text-transform:uppercase';
    el.innerHTML =
      '<svg width="0" height="0" style="position:absolute">' +
      '<filter id="ld-chalk" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 0.925  0 0 0 0 0.902  0 0 0 0 0.871  -0.361 -1.216 -0.123 1.6 0"/></filter></svg>' +
      '<canvas data-ld-sky style="position:absolute;inset:0;width:100%;height:100%"></canvas>' +
      '<div style="position:absolute;left:32px;right:32px;top:26px;display:flex;justify-content:space-between;gap:16px"><span>Jayden Chia</span><span>IT &amp; Security &middot; Melbourne</span></div>' +
      '<div style="position:absolute;left:32px;right:32px;bottom:26px;display:flex;justify-content:space-between;align-items:flex-end;gap:16px">' +
      '<span data-ld-n style="font-family:Archivo,sans-serif;font-stretch:125%;font-weight:800;font-size:clamp(56px,10vw,132px);line-height:.8;letter-spacing:-.05em;font-variant-numeric:tabular-nums">000</span>' +
      '<span data-ld-s style="text-align:right"></span></div>';
    document.body.appendChild(el);
    var cv = el.querySelector('[data-ld-sky]'), ctx = cv.getContext('2d'), dpr = Math.min(2, devicePixelRatio || 1), W = innerWidth, H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var stars = []; for (var i = 0; i < (W < 760 ? 70 : 140); i++) stars.push({ x: Math.random() * W, y: Math.random() * H, r: .4 + Math.random() * 1, a: .2 + Math.random() * .6, sp: .5 + Math.random() * 2, ph: Math.random() * 6.3 });
    return { el: el, n: el.querySelector('[data-ld-n]'), s: el.querySelector('[data-ld-s]'), ctx: ctx, W: W, H: H, stars: stars };
  }
  function drawStars(f, t, streak) { // streak: px of downward speed-line (rocket climbing)
    var c = f.ctx; c.clearRect(0, 0, f.W, f.H); c.fillStyle = CREAM; c.strokeStyle = CREAM;
    f.stars.forEach(function (s) {
      var a = s.a * (.6 + .4 * Math.sin(t / 1000 * s.sp + s.ph)); c.globalAlpha = a;
      if (streak > 1) { s.y += streak * (s.r / 1.4); if (s.y > f.H) { s.y -= f.H + 20; s.x = Math.random() * f.W; } c.lineWidth = s.r; c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x, s.y - streak * 3 * s.r); c.stroke(); }
      else { c.beginPath(); c.arc(s.x, s.y, s.r, 0, 6.283); c.fill(); }
    });
    c.globalAlpha = 1;
  }
  function count(f, e, msgs, pad) { f.n.textContent = (pad || '') + String(Math.round(e * 100)).padStart(3, '0'); f.s.textContent = msgs[Math.min(msgs.length - 1, Math.floor(e * msgs.length))]; }

  // ---------- rocket ----------
  var FLAME = '<svg viewBox="0 0 40 60" style="display:block;width:100%;height:auto"><path d="M7 1 Q20 -1 33 1 C35 17 31 34 20 58 C9 34 5 17 7 1 Z" fill="#ec7a3b" stroke="#b4502c" stroke-width="1.6" stroke-linejoin="round"/><path d="M13 3 Q20 2 27 3 C28 15 25 27 20 42 C15 27 12 15 13 3 Z" fill="#f6c45a" stroke="#d98a3a" stroke-width="1.2" stroke-linejoin="round"/><path d="M20 8 C21 15 21 21 20 27" fill="none" stroke="#fff3d0" stroke-width="1.4" stroke-linecap="round"/></svg>';
  var RK = 'images/space/rocket/rocket-body.webp';
  function rocket(ready, done) {
    var f = frame(), t0 = performance.now(), COUNT = 900, CLIMB = 1250, readied = false;
    var rw = clamp(f.W * .075, 56, 108), rh = rw * 613 / 324, base = f.H * .74;
    var pad = document.createElement('div');
    pad.style.cssText = 'position:absolute;left:50%;top:' + base + 'px;width:' + Math.min(420, f.W * .6) + 'px;transform:translateX(-50%);border-top:1px solid rgba(239,235,229,.35);padding-top:10px;text-align:center;font-size:10px;opacity:.7';
    pad.textContent = 'Launch pad 01 · Melbourne';
    var rk = document.createElement('div');
    rk.style.cssText = 'position:absolute;left:50%;top:' + (base - rh) + 'px;width:' + rw + 'px;margin-left:' + (-rw / 2) + 'px;will-change:transform';
    // friction: two drawn stages (light touch -> stronger) over the nose, aligned on the arch's tip and cross-faded by heat
    var FW = rw * 1.55, FH = FW * 503 / 300, fx = rw / 2 - .5435 * FW, fy = -.01 * FH - rw * .14;
    var fr = '<span data-fr style="position:absolute;left:' + fx.toFixed(1) + 'px;top:' + fy.toFixed(1) + 'px;width:' + FW.toFixed(1) + 'px;height:' + FH.toFixed(1) + 'px;transform-origin:54.35% 1%;opacity:0;pointer-events:none;filter:drop-shadow(0 0 10px rgba(255,140,60,.85))">'; // same glow as the engine flame
    for (var fi = 1; fi <= 2; fi++) fr += '<img src="images/space/friction/friction-' + fi + '.webp" alt="" style="position:absolute;inset:0;width:100%;height:100%;opacity:0">';
    rk.innerHTML = '<span data-fl style="position:absolute;left:35%;top:94%;width:30%;transform-origin:50% 0;transform:scaleY(.3);filter:drop-shadow(0 0 10px rgba(255,140,60,.85))">' + FLAME + '</span>' +
      '<span style="position:absolute;inset:0;background:' + INK + ';-webkit-mask:url(' + RK + ') top/100% auto no-repeat;mask:url(' + RK + ') top/100% auto no-repeat"></span>' +
      '<img src="' + RK + '" alt="" style="position:relative;display:block;width:100%;height:auto;filter:url(#ld-chalk)">' + fr + '</span>'; // the friction sits in front of the rocket
    f.el.appendChild(pad); f.el.appendChild(rk);
    var fl = rk.querySelector('[data-fl]'), frBox = rk.querySelector('[data-fr]'), frImgs = frBox.querySelectorAll('img'), puffs = [];
    function puff(x, y, big) {
      var s = document.createElement('span'), sz = (big ? 34 : 18) + Math.random() * 20, dir = Math.random() < .5 ? -1 : 1;
      s.style.cssText = 'position:absolute;left:' + (x - sz / 2) + 'px;top:' + (y - sz / 2) + 'px;width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;background:radial-gradient(circle,rgba(255,186,128,' + (big ? .55 : .45) + '),rgba(206,190,178,.32) 42%,rgba(206,190,178,0) 70%);pointer-events:none';
      f.el.appendChild(s); puffs.push(s);
      s.animate([{ transform: 'translate(0,0) scale(.4)', opacity: .9 }, { transform: 'translate(' + (dir * (40 + Math.random() * 90)) + 'px,' + (-10 + Math.random() * 20) + 'px) scale(1.8)', opacity: 0 }], { duration: 900 + Math.random() * 500, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' }).onfinish = function () { s.remove(); };
    }
    var lastPuff = 0;
    (function step(t) {
      var el = t - t0, y = 0, streak = 0, flame = .3;
      if (el < COUNT) { // countdown on the pad: shake builds, flame grows, smoke rolls out
        var k = el / COUNT, n = 3 - Math.floor(k * 3);
        f.n.textContent = 'T-0' + n; f.s.textContent = ['Systems check', 'Fuelling', 'Ignition'][Math.min(2, Math.floor(k * 3))];
        flame = .3 + k * .5;
        rk.style.transform = 'translate(' + ((Math.random() - .5) * k * 3).toFixed(1) + 'px,0)';
        if (k > .55 && t - lastPuff > 70) { lastPuff = t; puff(f.W / 2, base - 4, false); }
      } else { // liftoff: accelerate up and out; the number becomes altitude
        var p = clamp((el - COUNT) / CLIMB, 0, 1), e = p * p * p;
        y = e * (base + rh * 1.6); streak = 2 + e * 22; flame = .9 + Math.random() * .25;
        rk.style.transform = 'translate(0,' + (-y).toFixed(1) + 'px)'; // straight up
        pad.style.opacity = String(.7 * (1 - p));
        if (p < .25 && t - lastPuff > 50) { lastPuff = t; puff(f.W / 2, base - 4, true); }
        var heat = clamp((p - .12) / .3, 0, 1) * clamp((1 - p) / .25, 0, 1); // builds with speed, fades as it leaves the sky
        var st = clamp(heat * 1.15 + (Math.random() - .5) * .35, 0, 1); // which drawing: 0 = first touch, 1 = stronger
        frImgs.forEach(function (im, i) { im.style.opacity = Math.max(0, 1 - Math.abs(st - i)).toFixed(2); });
        frBox.style.opacity = Math.min(1, heat * 2.4).toFixed(2); // as bold as the engine flame at its peak
        frBox.style.transform = 'scale(' + (.97 + Math.random() * .05).toFixed(3) + ',' + (.94 + heat * .08 + Math.random() * .06).toFixed(3) + ')';
        count(f, Math.min(1, p * 1.1), ['Liftoff', 'Max Q', 'Orbit'], '');
        f.n.textContent = 'ALT ' + f.n.textContent;
        if (!readied && p > .4) { readied = true; ready(); }
        if (p >= 1) return lift(f, done);
      }
      fl.style.transform = 'scaleY(' + flame.toFixed(2) + ')';
      drawStars(f, t, streak);
      requestAnimationFrame(step);
    })(t0);
  }
  function lift(f, done) { // the sky follows the rocket up and off the page
    f.el.style.transition = 'transform .9s ' + EASE;
    f.el.style.transform = 'translateY(-100%)';
    setTimeout(function () { f.el.remove(); done && done(); }, 950);
  }

  window.LoaderFX = function (ready, done) { rocket(ready, done); };
})();
