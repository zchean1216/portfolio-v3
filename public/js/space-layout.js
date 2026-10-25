// renders every space element from data/space-layout.json into its section.
// the saved config is the only thing that sets position and size:
//   x, y  = centre as % of the section width / height (anchor:"bottom" makes y the bottom edge)
//   w, h  = % of the section width (so the shape is the same on every screen)
//   rotate, opacity, z (layer order), anim, hidden
// the outer wrapper carries position/size; animations run on the inner element only.
(function () {
  if (window.SpaceLayout) return;
  var HOSTS = { top: '#top', about: '#about > div', toolbox: 'section[data-screen-label="Toolbox"]', work: '#work', desk: 'section[data-screen-label="IT desk"]', path: '#path', contact: '#contact', footer: 'footer', name: '[data-sl-name]', orbit: '[data-sl-orbit]',
    // inner pages (they replace the home page, so they need their own layers)
    'page-about': 'main[data-screen-label="About me"]', 'page-story': 'main[data-screen-label="How I got here"]', 'page-twist': 'main[data-screen-label="Plot twist"]',
    'case-network': 'main[data-case="network"]', 'case-threatintel': 'main[data-case="threatintel"]', 'case-access': 'main[data-case="access"]',
    'case-awareness': 'main[data-case="awareness"]', 'case-migration': 'main[data-case="migration"]' };
  var SL = window.SpaceLayout = { cfg: null, mode: null, editing: false, hosts: HOSTS, render: render, apply: apply, bp: bp, applyFixed: applyFixed, overlaps: overlaps, mark: mark, hostOf: hostOf, pinFrom: pinFrom };

  var host = location.hostname;
  var local = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
  if (local && /[?&]edit=1(&|$)/.test(location.search)) { // the editor only exists on your machine (it isn't deployed)
    var es = document.createElement('script'); es.src = 'dev/space-edit.js?v=' + Date.now(); document.head.appendChild(es);
  }

  // dark mode line art: dark pixels -> cream, light fills -> transparent, mid tones -> faint cream (luminance to alpha)
  (function () {
    if (document.getElementById('sl-chalk')) return;
    var d = document.createElement('div'); d.setAttribute('aria-hidden', 'true'); d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    d.innerHTML = '<svg width="0" height="0" focusable="false"><filter id="sl-chalk" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 0.925  0 0 0 0 0.902  0 0 0 0 0.871  -0.361 -1.216 -0.123 1.6 0"></feColorMatrix></filter><filter id="sl-ink" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  -0.638 -2.146 -0.217 2.85 0"></feColorMatrix></filter></svg>';
    (document.body || document.documentElement).appendChild(d);
  })();
  var st = document.createElement('style');
  st.textContent = '[data-sl-host]{position:relative;isolation:isolate}' +
    '[data-sl-layer]{position:absolute;inset:0;pointer-events:none;z-index:-1}' +
    '[data-sl-el]:not([data-sl-fixed]){position:absolute;box-sizing:border-box;transition:opacity 1.6s cubic-bezier(.22,1,.36,1) var(--sl-fd,0s)}' +
    '[data-sl-el][data-sl-wait]{opacity:0}' + // fades in the first time it scrolls into view (opacity only, nothing moves)
    '[data-sl-in]{position:absolute;inset:0;opacity:calc(var(--o,1) * var(--sl-dim,1));transition:opacity .6s ease,filter .6s ease}' +
    '[data-sl-in]>img{display:block;width:100%;height:100%;object-fit:fill}' +
    '[data-sl-in]>svg{display:block;width:100%;height:100%;overflow:visible}' +
    '[data-sl-in] [data-xf]{position:absolute!important;inset:0}' +
    '[data-sl-in] video{display:block;width:100%;height:100%;object-fit:cover;pointer-events:none;-webkit-mask-image:radial-gradient(closest-side,#000 55%,transparent 100%);mask-image:radial-gradient(closest-side,#000 55%,transparent 100%)}' +
    'html[data-theme="dark"] [data-sl-video] video{filter:invert(1) contrast(.9);opacity:.6}' +
    // cream-ground clips: push the paper to pure white, then multiply so only the drawing shows on the page colour
    '[data-sl-blend] video{opacity:0!important;filter:none!important}' +
    '[data-sl-blend] canvas{position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;-webkit-mask-image:radial-gradient(closest-side,#000 70%,transparent 100%);mask-image:radial-gradient(closest-side,#000 70%,transparent 100%)}' +
    '[data-sl-in][data-sl-kind="sat"]{display:flex;flex-direction:column;align-items:center}' +
    '[data-sl-in][data-sl-kind="sat"]>svg{flex:none;width:48%;height:auto;margin-bottom:4px}' +
    '[data-sl-in][data-sl-kind="sat"]>[data-sat-body]{flex:1 1 0;min-height:0;width:100%;display:flex!important;align-items:center;justify-content:center}' +
    '[data-sl-in][data-sl-kind="sat"] [data-sat-body] img{width:100%;height:100%;object-fit:contain}' +
    '[data-sl-in][data-sl-kind="ground"]{overflow:hidden;background:var(--p-bg,#efebe5);-webkit-mask-image:linear-gradient(to right,transparent,#000 12%,#000 88%,transparent),linear-gradient(to bottom,transparent,#000 42%);-webkit-mask-composite:source-in;mask-image:linear-gradient(to right,transparent,#000 12%,#000 88%,transparent),linear-gradient(to bottom,transparent,#000 42%);mask-composite:intersect}' +
    '[data-sl-in][data-sl-kind="ground"]>img{position:absolute;left:-4%;top:0;width:108%;height:auto;max-width:none;margin-top:-45.6%}' +
    'html[data-theme="dark"] [data-sl-img]>[data-sl-in]{--sl-dim:.7}' +
    // dark mode chalk: filter the still pictures, not the moving wrapper, so the browser filters once and then just moves the result
    'html[data-theme="dark"] [data-sl-img]>[data-sl-in]:not([data-sl-kind="scene"]) img,html[data-theme="dark"] [data-sl-img]>[data-sl-in]:not([data-sl-kind="scene"])>svg,html[data-theme="dark"] [data-sl-img]>[data-sl-in][data-sl-kind="scene"]{filter:url(#sl-chalk)}' +
    '@keyframes slOrb{to{transform:rotate(360deg)}}[data-orbiter] img{transition:filter .6s ease}html[data-theme="dark"] [data-orbiter] img{filter:url(#sl-chalk)}' +
    'html[data-tabhidden] [data-orbiter],html[data-tabhidden] [data-orbiter]>span{animation-play-state:paused}' +
    '@media (prefers-reduced-motion: reduce){[data-orbiter],[data-orbiter]>span{animation:none!important}}' +
    '[data-sl-in][data-sl-kind="field"] canvas{display:block;width:100%;height:100%}' +
    '[data-sl-in][data-sl-kind="stars"] canvas{display:block;width:100%;height:100%}' +
    '[data-ang]{position:relative;display:block;width:100%;height:100%}' +
    '[data-ang]>img{position:absolute;inset:0;width:100%;height:100%;max-width:none;object-fit:contain;opacity:0;transition:opacity var(--xf,.6s) ease}' +
    '[data-ang]>img[data-on]{opacity:1}' +
    '[data-sm="spark"]>[data-ang],[data-sm="glint"]>[data-ang]{transform-origin:center;animation:smSpk var(--d,5s) ease-in-out var(--dl,0s) infinite,smTwk var(--d4,2.6s) linear var(--dl4,0s) infinite,smFlash var(--d3,11s) ease-out var(--dl3,0s) infinite}' +
    '@keyframes smTwk{0%{opacity:.7}9%{opacity:1}17%{opacity:.55}26%{opacity:.95}33%{opacity:.75}41%{opacity:1}52%{opacity:.6}61%{opacity:.9}70%{opacity:.7}78%{opacity:1}88%{opacity:.62}100%{opacity:.7}}' +
    '@keyframes smFlash{0%,90%,100%{scale:1;filter:none}93%{scale:1.45;filter:drop-shadow(0 0 5px rgba(171,106,85,.55))}96%{scale:1.1;filter:none}}' +
    'html[data-theme="dark"] [data-sm="spark"]>[data-ang],html[data-theme="dark"] [data-sm="glint"]>[data-ang]{animation-name:smSpk,smTwk,smFlashD}' +
    '@keyframes smFlashD{0%,90%,100%{scale:1;filter:none}93%{scale:1.45;filter:drop-shadow(0 0 6px rgba(236,230,222,.85))}96%{scale:1.1;filter:none}}' +
    '@keyframes smGlint{0%,93%,100%{scale:1}96%{scale:1.4}}' +
    '[data-sm="const"] [data-star]{transform-box:fill-box;transform-origin:center;animation:smStar var(--d,5s) ease-in-out var(--dl,0s) infinite}' +
    // new library art: nebula breathes, meteor shower streaks along its heading, asteroid belt drifts, astronaut floats.
    // works on an element's image box ([data-ang]) or a scene layer's image; --bpk = motion strength
    '[data-sm="nebula"]>*{transform-origin:center;animation:smNebula var(--d,14s) ease-in-out var(--dl,0s) infinite alternate}' +
    '@keyframes smNebula{from{scale:calc(1 - .035 * var(--bpk,1));rotate:calc(-2.5deg * var(--bpk,1));opacity:max(0,calc(1 - .18 * var(--bpk,1)))}to{scale:calc(1 + .035 * var(--bpk,1));rotate:calc(2.5deg * var(--bpk,1));opacity:1}}' +
    '[data-sm="meteor"]>*{animation:smMeteor var(--d,3.4s) cubic-bezier(.45,0,.7,1) var(--dl,0s) infinite}' +
    '@keyframes smMeteor{0%{translate:calc(var(--mx,-.7) * -6% * var(--bpk,1)) calc(var(--my,.7) * -6% * var(--bpk,1));opacity:max(0,calc(1 - var(--bpk,1)))}18%{opacity:1}72%{opacity:1}100%{translate:calc(var(--mx,-.7) * 9% * var(--bpk,1)) calc(var(--my,.7) * 9% * var(--bpk,1));opacity:max(0,calc(1 - var(--bpk,1)))}}' +
    '[data-sm="belt"]>*{transform-origin:center;animation:smBelt var(--d,16s) ease-in-out var(--dl,0s) infinite alternate}' +
    '@keyframes smBelt{from{translate:calc(-1.6% * var(--bpk,1)) calc(1.1% * var(--bpk,1));rotate:calc(-2deg * var(--bpk,1))}to{translate:calc(1.6% * var(--bpk,1)) calc(-1.1% * var(--bpk,1));rotate:calc(2deg * var(--bpk,1))}}' +
    '[data-sm="astro"]>*{transform-origin:50% 45%;animation:smAstro var(--d,10s) ease-in-out var(--dl,0s) infinite alternate}' +
    '@keyframes smAstro{from{translate:calc(-1% * var(--bpk,1)) calc(3% * var(--bpk,1));rotate:calc(-8deg * var(--bpk,1))}to{translate:calc(1.5% * var(--bpk,1)) calc(-3.5% * var(--bpk,1));rotate:calc(8deg * var(--bpk,1))}}' +
    // scene layers that reuse the existing motions
    '[data-scene-l][data-sm="planet"]>img,[data-scene-l][data-sm="asteroid"]>img{animation:smFloat var(--d,7s) ease-in-out var(--dl,0s) infinite}' +
    '[data-scene-l][data-sm="spark"]>img,[data-scene-l][data-sm="glint"]>img{transform-origin:center;animation:smSpk var(--d,5s) ease-in-out var(--dl,0s) infinite,smTwk var(--d4,2.6s) linear var(--dl4,0s) infinite,smFlash var(--d3,11s) ease-out var(--dl3,0s) infinite}' +
    'html[data-theme="dark"] [data-scene-l][data-sm="spark"]>img,html[data-theme="dark"] [data-scene-l][data-sm="glint"]>img{animation-name:smSpk,smTwk,smFlashD}' +
    // comet: tail frames flick (space-motion.js) while it glides a little along its heading (the art points up-right)
    '[data-sm="comet"]>[data-ang]{animation:smComet var(--d,6s) ease-in-out var(--dl,0s) infinite alternate}' +
    '@keyframes smComet{from{translate:-3% 3%}to{translate:3% -3%}}' +
    '[data-sm="comet"] [data-ang]>img{transition:opacity 120ms ease}' +
    '[data-sm="planet"]>[data-ang]{animation:smFloat var(--d,7s) ease-in-out var(--dl,0s) infinite}' +
    '[data-sm="asteroid"]>[data-ang]{animation:smFloat var(--d,7s) ease-in-out var(--dl,0s) infinite,smSpin var(--d2,100s) linear var(--dl2,0s) infinite;animation-direction:normal,var(--dir2,normal)}' +
    '[data-sat-body]>[data-ang]{animation:smSat 20s linear var(--dl,0s) infinite}' +
    ':root{--sa-dust:#9b887c;--sa-shadow:#2b3238}html[data-theme="dark"]{--sa-dust:#ece6de;--sa-shadow:#0d1114}' +
    '[data-vshadow]{fill-opacity:.42}html[data-theme="dark"] [data-vshadow]{fill-opacity:.88}' +
    '[data-vig] img{transition:filter .6s ease}html[data-theme="dark"] [data-vig] img{filter:url(#sl-chalk)}' +
    '[data-vrock]{will-change:transform}' + // rocks move every frame: own layer, so the chalked picture is drawn once
    'html[data-theme="dark"] [data-vhero]{opacity:.85}html[data-theme="dark"] [data-vrock]>img{opacity:.6}html[data-theme="dark"] [data-vspark]{opacity:.6}' +
    'html[data-theme="dark"] [data-vshadow]{fill:var(--p-bg,#141b20);fill-opacity:.72!important}' +
    '[data-vlit]{opacity:0;transition:opacity .6s ease}html[data-theme="dark"] [data-vlit]{opacity:.25}' +
    '[data-sm="const"] polyline,[data-sm="const"] [data-star]{transition:stroke .6s ease,fill .6s ease,filter .6s ease}' +
    'html[data-theme="dark"] [data-sm="const"] polyline{stroke:#ece6de;stroke-opacity:.32}' +
    'html[data-theme="dark"] [data-sm="const"] [data-star]{stroke:#ece6de;fill:#ece6de;fill-opacity:.85;filter:drop-shadow(0 0 3px rgba(236,230,222,.55))}' +
    'html[data-theme="dark"] [data-sm="const"] [data-packet]{fill:#e8a58c;filter:drop-shadow(0 0 4px rgba(232,165,140,.9))}' +
    '[data-sl-layer="top"]{overflow-x:clip}' +
    // backdrops: big scene illustrations, always behind every other element; paper keyed out, soft edges
    '[data-sl-backdrop]>[data-sl-in]{-webkit-mask-image:linear-gradient(to right,transparent,#000 7%,#000 93%,transparent),linear-gradient(to bottom,transparent,#000 7%,#000 93%,transparent);-webkit-mask-composite:source-in;mask-image:linear-gradient(to right,transparent,#000 7%,#000 93%,transparent),linear-gradient(to bottom,transparent,#000 7%,#000 93%,transparent);mask-composite:intersect}' +
    '[data-sl-backdrop][data-sl-area]>[data-sl-in]{overflow:hidden}' +
    '[data-bd-box]{position:absolute;inset:0}' +
    '[data-bd-box]>img{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:fill;filter:url(#sl-ink);transition:filter .6s ease}' +
    'html[data-theme="dark"] [data-bd-box]>img{filter:url(#sl-chalk)}' +
    '[data-bp]{position:absolute;overflow:visible;pointer-events:none}[data-bpi]{position:absolute;inset:0;transform-origin:center}' +
    '[data-bpg]{position:absolute;inset:0;background-repeat:no-repeat;filter:url(#sl-ink);transition:filter .6s ease}html[data-theme="dark"] [data-bpg]{filter:url(#sl-chalk)}' +
    // --bpk = motion strength (0 = still, 1 = default, 2 = twice as strong)
    '[data-bp="bob"]>[data-bpi]{animation:bpBob var(--d,7s) ease-in-out var(--dl,0s) infinite alternate,bpTilt var(--d2,10s) ease-in-out var(--dl2,0s) infinite alternate}' +
    '@keyframes bpBob{from{translate:calc(-1.5% * var(--bpk,1)) calc(2.5% * var(--bpk,1))}to{translate:calc(1.5% * var(--bpk,1)) calc(-3.5% * var(--bpk,1))}}' +
    '@keyframes bpTilt{from{rotate:calc(-3deg * var(--bpk,1))}to{rotate:calc(3deg * var(--bpk,1))}}' +
    '[data-bp="drift"]>[data-bpi]{animation:bpDrift var(--d,18s) ease-in-out var(--dl,0s) infinite alternate}' +
    '@keyframes bpDrift{from{translate:calc(-0.8% * var(--bpk,1) * var(--pa,1)) calc(0.6% * var(--bpk,1) * var(--pa,1));rotate:calc(-0.8deg * var(--bpk,1) * var(--pa,1))}to{translate:calc(0.8% * var(--bpk,1) * var(--pa,1)) calc(-0.9% * var(--bpk,1) * var(--pa,1));rotate:calc(0.8deg * var(--bpk,1) * var(--pa,1))}}' +
    // galaxy: a slow swirl back and forth around its centre
    '[data-bp="spin"]>[data-bpi]{animation:bpSpin var(--d,16s) ease-in-out var(--dl,0s) infinite alternate}' +
    '@keyframes bpSpin{from{rotate:calc(-9deg * var(--bpk,1) * var(--pa,1));scale:calc(1 - .02 * var(--bpk,1) * var(--pa,1))}to{rotate:calc(9deg * var(--bpk,1) * var(--pa,1));scale:calc(1 + .02 * var(--bpk,1) * var(--pa,1))}}' +
    // moon: slowly brightens and swells a touch, with a soft glow
    '[data-bp="glow"]>[data-bpi]{animation:bpGlow var(--d,8s) ease-in-out var(--dl,0s) infinite alternate}' +
    '@keyframes bpGlow{from{opacity:max(0,calc(1 - .2 * var(--bpk,1)));scale:1;filter:none}to{opacity:1;scale:calc(1 + .012 * var(--bpk,1));filter:drop-shadow(0 0 calc(10px * var(--bpk,1)) rgba(171,106,85,.35))}}' +
    'html[data-theme="dark"] [data-bp="glow"]>[data-bpi]{animation-name:bpGlowD}' +
    '@keyframes bpGlowD{from{opacity:max(0,calc(1 - .2 * var(--bpk,1)));scale:1;filter:none}to{opacity:1;scale:calc(1 + .012 * var(--bpk,1));filter:drop-shadow(0 0 calc(12px * var(--bpk,1)) rgba(236,230,222,.5))}}' +
    // smoke: rises and swells a little, then settles
    '[data-bp="puff"]>[data-bpi]{transform-origin:50% 100%;animation:bpPuff var(--d,7s) ease-in-out var(--dl,0s) infinite alternate}' +
    '@keyframes bpPuff{from{translate:0 0;scale:1;opacity:1}to{translate:0 calc(-2.5% * var(--bpk,1));scale:calc(1 + .025 * var(--bpk,1));opacity:max(.4,calc(1 - .12 * var(--bpk,1)))}}' +
    // rover: drives along its trail, fades out, comes round again
    '[data-bp="drive"]>[data-bpi]{animation:bpDrive var(--d,14s) linear var(--dl,0s) infinite}' +
    '@keyframes bpDrive{0%{translate:calc(var(--fx,0) * var(--bpk,1)) calc(var(--fy,0) * var(--bpk,1));opacity:max(0,calc(1 - var(--bpk,1)))}8%{opacity:1}50%{translate:0 0}86%{opacity:1}100%{translate:calc(var(--tx,0) * var(--bpk,1)) calc(var(--ty,0) * var(--bpk,1));opacity:max(0,calc(1 - var(--bpk,1)))}}' +
    '[data-bp="glide"]>[data-bpi]{animation:bpGlide var(--d,7s) ease-in-out var(--dl,0s) infinite alternate}' +
    '@keyframes bpGlide{from{translate:0 0}to{translate:calc(var(--gx,0) * var(--bpk,1)) calc(var(--gy,0) * var(--bpk,1))}}' +
    '[data-bp="tw"]>[data-bpi]{animation:bpSpk var(--d,5s) ease-in-out var(--dl,0s) infinite,bpTwk var(--d4,2.6s) linear var(--dl4,0s) infinite,bpFlash var(--d3,11s) ease-out var(--dl3,0s) infinite}' +
    'html[data-theme="dark"] [data-bp="tw"]>[data-bpi]{animation-name:bpSpk,bpTwk,bpFlashD}' +
    '@keyframes bpSpk{0%,100%{scale:calc(1 - .14 * var(--bpk,1));rotate:calc(-5deg * var(--bpk,1))}50%{scale:calc(1 + .06 * var(--bpk,1));rotate:calc(5deg * var(--bpk,1))}}' +
    '@keyframes bpTwk{0%,100%{opacity:max(0,calc(1 - .3 * var(--bpk,1)))}17%{opacity:max(0,calc(1 - .45 * var(--bpk,1)))}9%,41%,78%{opacity:1}52%{opacity:max(0,calc(1 - .4 * var(--bpk,1)))}88%{opacity:max(0,calc(1 - .38 * var(--bpk,1)))}}' +
    '@keyframes bpFlash{0%,90%,100%{scale:1;filter:none}93%{scale:calc(1 + .45 * var(--bpk,1));filter:drop-shadow(0 0 5px rgba(171,106,85,.55))}96%{scale:calc(1 + .1 * var(--bpk,1));filter:none}}' +
    '@keyframes bpFlashD{0%,90%,100%{scale:1;filter:none}93%{scale:calc(1 + .45 * var(--bpk,1));filter:drop-shadow(0 0 6px rgba(236,230,222,.85))}96%{scale:calc(1 + .1 * var(--bpk,1));filter:none}}' +
    '[data-bp="dot"]>[data-bpi]{animation:bpDot var(--d,3s) ease-in-out var(--dl,0s) infinite}' +
    '@keyframes bpDot{0%,100%{opacity:1;scale:1}35%{opacity:max(0,calc(1 - .55 * var(--bpk,1)));scale:calc(1 - .1 * var(--bpk,1))}60%{opacity:1;scale:calc(1 + .08 * var(--bpk,1))}80%{opacity:max(0,calc(1 - .3 * var(--bpk,1)))}}' +
    '[data-bp="twc"]>[data-bpi]{animation:bpTwc var(--d,6s) ease-in-out var(--dl,0s) infinite alternate}' +
    '@keyframes bpTwc{from{opacity:1}to{opacity:max(0,calc(1 - .35 * var(--bpk,1)))}}' +
    '@media (prefers-reduced-motion: reduce){[data-bpi]{animation:none!important}}' +
    '[data-sl-hidden]{display:none!important}';
  document.head.appendChild(st);

  // seamless video loop: two copies of the clip; the next one fades in on top before the current one ends
  var rmQ = matchMedia('(prefers-reduced-motion: reduce)'), XF = 0.9;
  function go(v) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
  function xfRun(w) {
    var ok = w.__vis && !document.hidden && !rmQ.matches;
    if (!ok) { w.__v.forEach(function (v) { v.pause(); }); return; }
    go(w.__v[w.__a]); if (w.__fading) go(w.__v[1 - w.__a]);
    if (!w.__raf) w.__raf = requestAnimationFrame(function tick() {
      w.__raf = 0;
      if (!w.isConnected || !w.__vis || document.hidden || rmQ.matches) return;
      var cur = w.__v[w.__a], nxt = w.__v[1 - w.__a];
      if (!w.__fading && cur.duration && cur.duration - cur.currentTime <= XF) {
        w.__fading = true;
        nxt.currentTime = 0; nxt.style.transition = 'none'; nxt.style.opacity = '0'; nxt.style.zIndex = '2'; cur.style.zIndex = '1';
        go(nxt); nxt.getBoundingClientRect();
        nxt.style.transition = 'opacity ' + XF + 's linear'; nxt.style.opacity = '1';
        setTimeout(function () { cur.pause(); cur.currentTime = 0; cur.style.transition = 'none'; cur.style.opacity = '0'; cur.style.zIndex = '0'; w.__a = 1 - w.__a; w.__fading = false; }, XF * 1000 + 40);
      }
      w.__raf = requestAnimationFrame(tick);
    });
  }
  // blend mode: ONE shared decoder per clip (not one per copy). Its paper is keyed to transparent each frame
  // into a master canvas; every placed copy just draws that canvas, mirrored at random so copies differ.
  var XFB = 1.6, BL = {};
  function blendSrc(src) {
    if (BL[src]) return BL[src];
    var b = BL[src] = { users: [], a: 0, fading: false, raf: 0 };
    b.v = [0, 1].map(function () { var v = document.createElement('video'); v.src = src; v.muted = true; v.playsInline = true; v.preload = 'auto'; v.setAttribute('playsinline', ''); return v; });
    b.cv = document.createElement('canvas'); b.cx = b.cv.getContext('2d', { willReadFrequently: true });
    b.v[0].addEventListener('loadedmetadata', function () { var v = b.v[0]; b.cv.width = Math.min(480, v.videoWidth); b.cv.height = Math.round(b.cv.width * v.videoHeight / v.videoWidth); b.bg = 0; });
    b.v[0].addEventListener('loadeddata', function () { frame(b); paint(b); });
    return b;
  }
  function frame(b) {
    var cur = b.v[b.a], nxt = b.v[1 - b.a], t = 0;
    if (!b.fading && cur.duration && cur.duration - cur.currentTime <= XFB) { b.fading = true; b.f0 = performance.now(); nxt.currentTime = 0; go(nxt); }
    if (b.fading) { t = Math.min(1, (performance.now() - b.f0) / (XFB * 1000)); if (t >= 1) { cur.pause(); cur.currentTime = 0; b.a = 1 - b.a; b.fading = false; cur = nxt; nxt = b.v[1 - b.a]; t = 0; } }
    if (cur.readyState < 2 || !b.cv.width) return;
    var W = b.cv.width, H = b.cv.height, o = b.cx;
    o.globalAlpha = 1; o.drawImage(cur, 0, 0, W, H);
    if (t > 0 && nxt.readyState >= 2) { o.globalAlpha = t; o.drawImage(nxt, 0, 0, W, H); }
    var im = o.getImageData(0, 0, W, H), p = im.data, i, g, a;
    if (!b.bg) { var sm = 0; [[2, 2], [W - 3, 2], [2, H - 3], [W - 3, H - 3]].forEach(function (q) { var k = (q[1] * W + q[0]) * 4; sm += (p[k] + p[k + 1] + p[k + 2]) / 3; }); b.bg = sm / 4 - 4; }
    var bg = b.bg, span = bg - 50, dark = document.documentElement.getAttribute('data-theme') === 'dark';
    var cr = dark ? 236 : 31, cg = dark ? 230 : 43, cb = dark ? 222 : 51, k2 = dark ? 204 : 255;
    for (i = 0; i < p.length; i += 4) { g = (p[i] + p[i + 1] + p[i + 2]) / 3; a = (bg - g) / span; a = a <= 0 ? 0 : a >= 1 ? 1 : a; p[i] = cr; p[i + 1] = cg; p[i + 2] = cb; p[i + 3] = a * k2; }
    o.putImageData(im, 0, 0);
  }
  function paint(b) {
    b.users.forEach(function (u) {
      if (!u.isConnected || (!u.__vis && u.__drawn)) return;
      var c = u.__cv, r = u.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      var W = Math.max(16, Math.round(r.width * dpr)), H = Math.max(16, Math.round(r.height * dpr));
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
      var x = c.getContext('2d'); x.clearRect(0, 0, W, H);
      var s = Math.max(W / b.cv.width, H / b.cv.height), dw = b.cv.width * s, dh = b.cv.height * s;
      x.save(); if (u.__flip) { x.translate(W, 0); x.scale(-1, 1); } x.drawImage(b.cv, (W - dw) / 2, (H - dh) / 2, dw, dh); x.restore(); u.__drawn = 1;
    });
  }
  function blendRun(b) {
    b.users = b.users.filter(function (u) { return u.isConnected; });
    var ok = !document.hidden && !rmQ.matches && b.users.some(function (u) { return u.__vis; });
    if (!ok) { b.v.forEach(function (v) { v.pause(); }); return; }
    go(b.v[b.a]); if (b.fading) go(b.v[1 - b.a]);
    if (!b.raf) b.raf = requestAnimationFrame(function tick() { b.raf = 0; if (document.hidden || rmQ.matches) return; frame(b); paint(b); if (b.users.some(function (u) { return u.__vis; })) b.raf = requestAnimationFrame(tick); else b.v.forEach(function (v) { v.pause(); }); });
  }
  function blendInit(w) {
    var b = blendSrc(w.getAttribute('data-blend-src'));
    w.__cv = w.querySelector('canvas'); w.__flip = Math.random() < 0.5; w.__b = b; b.users.push(w);
    if (b.cv.width) paint(b);
  }
  var vio = new IntersectionObserver(function (es) { es.forEach(function (e) { e.target.__vis = e.isIntersecting; if (e.target.__b) blendRun(e.target.__b); else xfRun(e.target); }); }, { rootMargin: '100px' });
  function xfInit(w) { w.__v = Array.prototype.slice.call(w.querySelectorAll('video')); w.__a = 0; w.__v.forEach(function (v) { v.muted = true; }); if (w.hasAttribute('data-blend-src')) blendInit(w); vio.observe(w); }
  function xfAll() { document.querySelectorAll('[data-xf]').forEach(function (w) { if (w.__b) blendRun(w.__b); else if (w.__v) xfRun(w); }); }
  document.addEventListener('visibilitychange', xfAll);
  new MutationObserver(function () { Object.keys(BL).forEach(function (k) { var b = BL[k]; b.users.forEach(function (u) { u.__drawn = 0; }); frame(b); paint(b); }); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  rmQ.addEventListener && rmQ.addEventListener('change', xfAll);

  var NS = 'vector-effect="non-scaling-stroke"';
  var SPARK = '<svg viewBox="-11 -11 22 22" preserveAspectRatio="none" aria-hidden="true" focusable="false" style="fill:none;stroke:var(--sa-line);stroke-width:1.5;stroke-linejoin:round"><path d="M0 -10 Q1.4 -1.4 10 0 Q1.4 1.4 0 10 Q-1.4 1.4 -10 0 Q-1.4 -1.4 0 -10 Z" ' + NS + '></path></svg>';
  var PK = '<circle data-packet="1" r="2.2" fill="#ab6a55" stroke="none" style="opacity:0"></circle>';
  var SAT = '<svg data-sig="1" viewBox="0 0 60 30" aria-hidden="true" focusable="false" style="overflow:visible;fill:none;stroke:var(--sa-line);stroke-width:1.5;stroke-linecap:round;stroke-dasharray:3 4"><path d="M2 28 A28 28 0 0 1 58 28" ' + NS + ' style="animation-delay:.9s"></path><path d="M10 28 A20 20 0 0 1 50 28" ' + NS + ' style="animation-delay:.45s"></path><path d="M18 28 A12 12 0 0 1 42 28" ' + NS + ' style="animation-delay:0s"></path></svg>' +
    '<span data-sat-body="1">__ANG__</span>';
  function angHTML(a) { return '<span data-ang>' + a.angles.map(function (src, i) { return '<img data-i="' + (i + 1) + '" src="' + src + '" alt="" draggable="false" decoding="async" loading="eager">'; }).join('') + '</span>'; }
  function ring(r, o) { return '<circle r="' + r + '" stroke-width="1" stroke-dasharray="2 7" opacity="' + o + '" ' + NS + '></circle>'; }
  var ORBIT = '<svg viewBox="-200 -200 400 400" preserveAspectRatio="none" aria-hidden="true" focusable="false" style="fill:none;stroke:var(--p-ink,#1f2b33);stroke-linecap:round">' + ring(72, .3) + ring(108, .22) + ring(148, .13) + ring(190, .06) + '</svg>' + ORBITERS();
  function ORBITERS() {
    var P = [['images/space/moon/moon-1.webp', 108, 60, 2.6, 200], ['images/space/jupiter/jupiter-1.webp', 148, 90, 3.2, 35], ['images/space/planet/planet-1.webp', 72, 120, 3.9, 290]];
    return P.map(function (p) {
      var rp = (p[1] / 400 * 100).toFixed(2);
      return '<span data-orbiter aria-hidden="true" style="position:absolute;inset:0;rotate:' + p[4] + 'deg;animation:slOrb ' + p[2] + 's linear infinite"><span style="position:absolute;left:calc(50% + ' + rp + '%);top:50%;width:' + p[3] + '%;translate:-50% -50%;rotate:-' + p[4] + 'deg;animation:slOrb ' + p[2] + 's linear infinite reverse"><img src="' + p[0] + '" alt="" draggable="false" decoding="async" style="display:block;width:100%;height:auto;opacity:.55"></span></span>';
    }).join('');
  }

  // ring orbit: dashed rings (viewBox units, half-size 200) + library images circling on them, from the asset config
  function ringOrbit(a) {
    var rings = (a.rings || [[90, .3], [130, .22], [175, .12]]).map(function (q) { return ring(q[0], q[1]); }).join('');
    var orb = (a.orbiters || []).map(function (p) {
      var rp = (p[1] / 400 * 100).toFixed(2);
      return '<span data-orbiter aria-hidden="true" style="position:absolute;inset:0;rotate:' + p[4] + 'deg;animation:slOrb ' + p[2] + 's linear infinite"><span style="position:absolute;left:calc(50% + ' + rp + '%);top:50%;width:' + p[3] + '%;translate:-50% -50%;rotate:-' + p[4] + 'deg;animation:slOrb ' + p[2] + 's linear infinite reverse"><img src="' + p[0] + '" alt="" draggable="false" decoding="async" style="display:block;width:100%;height:auto;opacity:' + (p[5] == null ? .7 : p[5]) + '"></span></span>';
    }).join('');
    return '<svg viewBox="-200 -200 400 400" preserveAspectRatio="none" aria-hidden="true" focusable="false" style="fill:none;stroke:var(--p-ink,#1f2b33);stroke-linecap:round">' + rings + '</svg>' + orb;
  }

  // live backdrop: objects floating in empty sky are cut from the same image and animated on their own layer;
  // the still picture gets matching holes so nothing is doubled. a.parts = [[name, x, y, w, h, motion, dx, dy]] in image px.
  // CSS mask (as an SVG image): keep = [x, y, w, h] softened area (null = the whole image, unsoftened), holes = list of [x, y, w, h]; edges are inset FEATHER*1.5 and blurred by FEATHER,
  // identically for the still picture and the pieces, so where they meet the two halves add back up with no visible seam
  var FEATHER = 2;
  function softMask(w, h, keep, holes) {
    var f = FEATHER, i = f * 1.5, r = function (q, k, on, off) {
      if (q.c) return '<circle cx="' + q.c[0] + '" cy="' + q.c[1] + '" r="' + Math.max(0, q.c[2] - k) + '" fill="' + on + '"/>' + (q.cut || []).map(function (pg) { return '<polygon fill="' + off + '" points="' + pg.map(function (pt) { return pt[0] + ',' + pt[1]; }).join(' ') + '"/>'; }).join('');
      if (q.e) return '<ellipse cx="' + q.e[0] + '" cy="' + q.e[1] + '" rx="' + Math.max(0, q.e[2] - k) + '" ry="' + Math.max(0, q.e[3] - k) + '" transform="rotate(' + (q.e[4] || 0) + ' ' + q.e[0] + ' ' + q.e[1] + ')"' + (on ? ' fill="' + on + '"' : '') + '/>' + (q.cut || []).map(function (pg) { return '<polygon fill="' + off + '" points="' + pg.map(function (pt) { return pt[0] + ',' + pt[1]; }).join(' ') + '"/>'; }).join('');
      return '<rect x="' + (q[0] + k) + '" y="' + (q[1] + k) + '" width="' + Math.max(0, q[2] - 2 * k) + '" height="' + Math.max(0, q[3] - 2 * k) + '"/>';
    };
    var full = !keep;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none"><defs><filter id="b" x="-2%" y="-2%" width="104%" height="104%"><feGaussianBlur stdDeviation="' + f + '"/></filter>' +
      '<mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="' + w + '" height="' + h + '"><g fill="#fff">' + (full ? '<rect width="' + w + '" height="' + h + '"/>' : r(keep, i, '#fff', '#000')) + '</g><g fill="#000">' + holes.map(function (q) { return r(q, i, '#000', '#fff'); }).join('') + '</g></mask></defs>' +
      '<g filter="url(#b)"><rect width="' + w + '" height="' + h + '" fill="#000" mask="url(#m)"/></g></svg>';
    return "url('data:image/svg+xml," + encodeURIComponent(svg) + "')";
  }
  function shapeOf(p, ox, oy) {
    ox = ox || 0; oy = oy || 0;
    var o = p[6], cutOf = function () { return (o.cut || []).map(function (pg) { return pg.map(function (pt) { return [pt[0] - ox, pt[1] - oy]; }); }); };
    if (o && o.c) return { c: [o.c[0] - ox, o.c[1] - oy, o.c[2]], cut: cutOf() };
    if (o && o.e) return { e: [o.e[0] - ox, o.e[1] - oy, o.e[2], o.e[3], o.e[4] || 0], cut: cutOf() };
    return p[5] === 'spin' ? { e: [p[1] + p[3] / 2 - ox, p[2] + p[4] / 2 - oy, p[6] || p[3] / 2, p[7] || p[4] / 2, p[8] || 0] } : [p[1] - ox, p[2] - oy, p[3], p[4]]; }
  function backdropHTML(a, live) {
    var img = '<img src="' + a.src + '" alt="" draggable="false" decoding="async"';
    if (!live || !a.parts || !a.parts.length) return '<span data-bd-box>' + img + '></span>';
    var W = a.iw, H = a.ih, R = function (lo, hi) { return (lo + Math.random() * (hi - lo)).toFixed(2); };
    var moving = a.parts.filter(function (p) { return p[5] !== 'patch'; });
    var svg = softMask(W, H, null, moving.map(function (p) { return shapeOf(p); }));
    var html = '<span data-bd-box>' + img + ' style="-webkit-mask-image:' + svg + ';mask-image:' + svg + '">';
    var area = function (p) { return p[3] * p[4]; };
    // patches (static ground that fills in behind something that moves away, e.g. the rover) go underneath everything
    a.parts.filter(function (p) { return p[5] === 'patch'; }).concat(moving).forEach(function (p) {
      var i = a.parts.indexOf(p);
      var x = p[1], y = p[2], w = p[3], h = p[4], m = p[5], cx = x + w / 2, cy = y + h / 2;
      var edge = 1; // the frame's soft edges fade pieces and picture together
      // where pieces overlap, the smaller one owns that patch: punch it out of this piece so nothing is drawn twice
      var own = moving.filter(function (q) { var j = a.parts.indexOf(q); return p[5] !== 'patch' && j !== i && (area(q) < area(p) || (area(q) === area(p) && j < i)) && q[1] < x + w && q[1] + q[3] > x && q[2] < y + h && q[2] + q[4] > y; });
      var pm = softMask(w, h, shapeOf(p, x, y), own.map(function (q) { return shapeOf(q, x, y); }));
      var vars = m === 'tw' ? '--d:' + R(3, 7) + 's;--dl:-' + R(0, 7) + 's;--d3:' + R(8, 18) + 's;--dl3:-' + R(0, 18) + 's;--d4:' + R(1.8, 3.4) + 's;--dl4:-' + R(0, 3) + 's'
        : m === 'dot' ? '--d:' + R(1.6, 4.2) + 's;--dl:-' + R(0, 4) + 's'
        : m === 'twc' ? '--d:' + R(5, 8) + 's;--dl:-' + R(0, 8) + 's'
        : m === 'drift' ? '--d:' + R(16, 22) + 's;--dl:-' + R(0, 20) + 's;--pa:' + (p[6] == null ? 1 : p[6])
        : m === 'spin' ? '--d:' + R(14, 18) + 's;--dl:-' + R(0, 14) + 's;--pa:' + ((p[6] && p[6].pa) || 1)
        : m === 'glow' ? '--d:' + R(7, 10) + 's;--dl:-' + R(0, 8) + 's'
        : m === 'puff' ? '--d:7s;--dl:0s' // every puff of one plume breathes together
        : m === 'drive' ? '--d:' + (p[10] || 14) + 's;--fx:' + p[6] + '%;--fy:' + p[7] + '%;--tx:' + p[8] + '%;--ty:' + p[9] + '%'
        : m === 'patch' ? ''
        : m === 'glide' ? '--d:' + R(6, 9) + 's;--dl:-' + R(0, 8) + 's;--gx:' + (p[6] || 0) + '%;--gy:' + (p[7] || 0) + '%'
        : '--d:' + R(6, 9) + 's;--dl:-' + R(0, 9) + 's;--d2:' + R(8, 12) + 's;--dl2:-' + R(0, 12) + 's';
      var sx = m === 'patch' ? p[6] : x, sy = m === 'patch' ? p[7] : y;
      var bg = 'background-image:url(' + a.src + ');background-size:' + (W / w * 100).toFixed(3) + '% ' + (H / h * 100).toFixed(3) + '%;background-position:' + (W === w ? 0 : sx / (W - w) * 100).toFixed(4) + '% ' + (H === h ? 0 : sy / (H - h) * 100).toFixed(4) + '%' + (pm ? ';-webkit-mask-image:' + pm + ';mask-image:' + pm : '');
      html += '<span data-bp="' + m + '" style="left:' + (x / W * 100).toFixed(3) + '%;top:' + (y / H * 100).toFixed(3) + '%;width:' + (w / W * 100).toFixed(3) + '%;height:' + (h / H * 100).toFixed(3) + '%;opacity:' + Math.max(0, edge).toFixed(2) + '">' +
        '<span data-bpi style="' + vars + '"><span data-bpg style="' + bg + '"></span></span></span>';
    });
    return html + '</span>';
  }

  // ---- backdrop areas: the backdrop owns a rectangle of its section (fractions of the section's width AND height),
  // and the picture covers it: always its full width, and its full height (trimming the sides on narrow screens, never
  // stretching). e.focus picks which part stays in view when it's trimmed.
  // e.area = { l, t, r, b } (can go past 0..1 to spill over the section's edges), e.focus = [fx, fy] = which part to keep.
  function fitBox(d, a, e) {
    var box = d.querySelector('[data-bd-box]'); if (!box) return;
    var W = d.offsetWidth, H = d.offsetHeight; if (!W || !H) return;
    var ar = a.ih && a.iw ? a.ih / a.iw : (a.aspect || 0.56), bw = Math.max(W, H / ar), bh = bw * ar, f = e.focus || [0.5, 0.5]; // cover the area: full width, and on narrow screens the full height too (the sides are trimmed), never stretched
    box.style.inset = 'auto'; box.style.left = ((W - bw) * f[0]).toFixed(1) + 'px'; box.style.top = ((H - bh) * f[1]).toFixed(1) + 'px';
    box.style.width = bw.toFixed(1) + 'px'; box.style.height = bh.toFixed(1) + 'px';
  }
  var AREA_RO = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(function (es) {
    es.forEach(function (en) {
      var d = en.target;
      if (!d.isConnected) { if (d.__inPage) AREA_RO.unobserve(d); return; } // removed: stop watching (not yet added: wait for it)
      d.__inPage = true;
      if (!d.__e || !d.__e.area) { AREA_RO.unobserve(d); return; }
      fitBox(d, d.__a, d.__e);
    });
  }) : null;
  // ---- content anchors: an element's height position (and a backdrop's top and bottom edges) is tied to the nearest piece
  // of page content (a heading, paragraph, card...). On other screen sizes text wraps and sections grow, and the element
  // moves with that content instead of drifting. { p: child-index path from the section, s: 't' | 'b' (that content's
  // top or bottom edge), o: offset in section widths }. Anything that can't be found falls back to the stored % position.
  function relY(host, n) { // top of n inside the section, ignoring transforms (reveal animations)
    var y = 0, c = n;
    while (c && c !== host) { y += c.offsetTop; var op = c.offsetParent; if (!op || (op !== host && !host.contains(op))) return null; if (op !== host) y += op.clientTop; c = op; }
    return c === host ? y : null;
  }
  function nodeAt(host, p) { if (p === '') return host; var n = host, ks = String(p).split('.'); for (var i = 0; i < ks.length && n; i++) n = n.children[+ks[i]]; return n && n !== host ? n : null; } // '' = the section itself
  function docY(n) { var y = 0; while (n) { y += n.offsetTop; n = n.offsetParent; if (n) y += n.clientTop; } return y; } // page position, ignoring transforms
  function edgeY(host, A) { // A.h: the content sits in another section (e.g. a backdrop's line just past its own section)
    var base = !A ? null : A.h ? document.querySelector(HOSTS[A.h]) : A.q ? document.querySelector(A.q) : host; if (!base) return null; // A.q: any page section, by selector
    var n = nodeAt(base, A.p); if (!n || !(n instanceof HTMLElement) || (n !== base && !n.offsetParent)) return null;
    var y = n === base ? 0 : relY(base, n); if (y == null) return null;
    if (base !== host) y += docY(base) - docY(host);
    return y + (A.s === 'b' ? n.offsetHeight : 0) + A.o * host.offsetWidth;
  }
  function hostKeyOf(n) { // the innermost section that holds n
    var best = null, bl = 1e9;
    Object.keys(HOSTS).forEach(function (k) { var h = document.querySelector(HOSTS[k]); if (!h || !h.contains(n)) return; var dpt = 0, c = n; while (c && c !== h) { dpt++; c = c.parentElement; } if (dpt < bl) { bl = dpt; best = k; } });
    return best;
  }
  // backdrops stand on a line: the divider rule (a thin full-width line, or a top / bottom border that isn't a card's)
  // nearest to y (px inside the section), within max px
  function lineFor(host, y, max) {
    var hy = docY(host), HW = host.offsetWidth, best = null, bd = max;
    [['t', 0], ['b', host.offsetHeight]].forEach(function (q) { var dd = Math.abs(q[1] - y); if (dd < bd) { bd = dd; best = { p: '', s: q[0], o: 0 }; } }); // its own section's top and end count as lines too
    document.querySelectorAll('body *').forEach(function (n) {
      if (!(n instanceof HTMLElement) || !n.offsetParent || n.offsetWidth < HW * 0.3 || n.closest('[data-sl-layer],[data-sl-panel],[data-sl-fixed]')) return;
      var cs = getComputedStyle(n), t = docY(n) - hy, c = [];
      var box = parseFloat(cs.borderLeftWidth) > 0 || parseFloat(cs.borderRightWidth) > 0;
      if (n.offsetHeight <= 3 && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') c.push(['t', t]);
      if (!box && parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none') c.push(['t', t]);
      if (!box && parseFloat(cs.borderBottomWidth) > 0 && cs.borderBottomStyle !== 'none') c.push(['b', t + n.offsetHeight]);
      c.forEach(function (q) {
        var dd = Math.abs(q[1] - y); if (dd >= bd) return;
        var k = hostKeyOf(n), base = k && document.querySelector(HOSTS[k]), sel = null;
        if (!base) { base = n.closest('section[id],[data-screen-label]'); if (!base) return; sel = base.id ? '#' + base.id : base.tagName.toLowerCase() + '[data-screen-label="' + base.getAttribute('data-screen-label') + '"]'; }
        bd = dd; best = { p: pathOf(base, n), s: q[0], o: 0 }; if (base !== host) { if (sel) best.q = sel; else best.h = k; }
      });
    });
    return best && best.p != null ? best : null;
  }
  SL.lineFor = lineFor; SL.edgeY = edgeY;
  function pathOf(host, n) { var p = []; while (n && n !== host) { p.unshift(Array.prototype.indexOf.call(n.parentElement.children, n)); n = n.parentElement; } return n === host ? p.join('.') : null; }
  function anchorFor(host, y) { // the content edge nearest to y (px inside the section); outer blocks win ties
    var HW = host.offsetWidth, HH = host.offsetHeight, best = null, bd = 1e9;
    [['t', 0], ['b', HH]].forEach(function (q) { var dd = Math.abs(q[1] - y); if (dd < bd - 0.5) { bd = dd; best = { p: '', s: q[0], o: Math.round((y - q[1]) / HW * 10000) / 10000 }; } }); // the section's own edges
    host.querySelectorAll('*').forEach(function (n) {
      if (!(n instanceof HTMLElement) || n.closest('[data-sl-layer],[data-sl-panel],[data-sl-fixed],script,style,template')) return;
      var h = n.offsetHeight; if (h < 12 || n.offsetWidth < 60 || !n.offsetParent) return;
      var cs = getComputedStyle(n); if (cs.display === 'inline' || cs.position === 'absolute' || cs.position === 'fixed') return;
      var t = relY(host, n); if (t == null) return;
      [['t', t], ['b', t + h]].forEach(function (q) { var dd = Math.abs(q[1] - y); if (dd < bd - 0.5) { bd = dd; best = { p: pathOf(host, n), s: q[0], o: Math.round((y - q[1]) / HW * 10000) / 10000 }; } });
    });
    return best && best.p != null ? best : null;
  }
  // editor: after a move / resize, re-tie the element to the content nearest its new spot
  function anchorFrom(e) {
    var host = hostOf(e), a = SL.cfg.assets[e.asset] || {}; if (!host || !host.offsetWidth) return;
    if (e.area) { areaFrom(e); return; }
    if (a.kind === 'fixed' || e.near || fillMode(a, e)) { delete e.ay; return; }
    var ay = anchorFor(host, e.y / 100 * host.offsetHeight); if (ay) e.ay = ay; else delete e.ay;
  }
  SL.anchorFrom = anchorFrom;

  function applyArea(e, d, a) {
    var A = e.area, host = hostOf(e);
    if (host && host.offsetHeight && (A.at || A.ab)) { // edges tied to content: follow it at this screen size
      var HH = host.offsetHeight, ty = edgeY(host, A.at), by = edgeY(host, A.ab);
      if (ty != null) A.t = Math.round(ty / HH * 1e5) / 1e5;
      if (by != null) A.b = Math.round(Math.max(by, (ty != null ? ty : A.t * HH) + 20) / HH * 1e5) / 1e5;
    }
    d.setAttribute('data-sl-area', '');
    d.style.left = (A.l * 100).toFixed(3) + '%'; d.style.top = (A.t * 100).toFixed(3) + '%';
    d.style.width = ((A.r - A.l) * 100).toFixed(3) + '%'; d.style.height = ((A.b - A.t) * 100).toFixed(3) + '%';
    d.style.bottom = ''; d.style.aspectRatio = ''; d.style.visibility = ''; d.style.transformOrigin = '';
    d.style.transform = e.rotate ? 'rotate(' + e.rotate + 'deg)' : 'none';
    // keep x / y / w / h describing the area as it is right now, so the editor starts from what you see
    if (host && host.offsetWidth) { var HW = host.offsetWidth, HH = host.offsetHeight; e.x = Math.round((A.l + A.r) * 5000) / 100; e.y = Math.round((A.t + A.b) * 5000) / 100; e.w = Math.round((A.r - A.l) * 10000) / 100; e.h = Math.round((A.b - A.t) * HH / HW * 10000) / 100; delete e.anchor; delete e.near; }
    d.__e = e; d.__a = a; fitBox(d, a, e); if (AREA_RO) AREA_RO.observe(d);
  }
  // editor: turn x / y / w / h (centre and size, % of the section width; y % of its height) back into an area
  function areaFrom(e, quick) { // quick: mid-drag, skip finding the content (done when the drag ends)
    var host = hostOf(e); if (!host || !host.offsetWidth || !e.area) return;
    var HW = host.offsetWidth, HH = host.offsetHeight, h = (e.h != null ? e.h : e.w * 0.56) / 100 * HW / HH;
    var r4 = function (v) { return Math.round(v * 10000) / 10000; };
    var A = { l: r4(e.x / 100 - e.w / 200), r: r4(e.x / 100 + e.w / 200), t: r4(e.y / 100 - h / 2), b: r4(e.y / 100 + h / 2) };
    if (!quick) {
      var at = anchorFor(host, A.t * HH), ab = anchorFor(host, A.b * HH); if (at) A.at = at; if (ab) A.ab = ab;
      var kind = (SL.cfg.assets[e.asset] || {}).kind, ln = lineFor(host, A.b * HH, HW * 0.06);
      if (kind === 'backdrop') { if (ln) { A.ab = ln; e.focus = [(e.focus || [0.5])[0], 1]; } } // near a divider line: stand on it
      else { var lt = lineFor(host, A.t * HH, HW * 0.06); if (lt) A.at = lt; if (ln) A.ab = ln; } // fields: both edges stick to nearby lines / the section's edges
    }
    e.area = A;
  }
  SL.areaFrom = areaFrom; SL.fitBox = fitBox;

  function sceneHTML(a) {
    return (a.layers || []).map(function (l) {
      var st = 'position:absolute;left:' + l.x + '%;top:' + l.y + '%;width:' + l.w + '%;translate:-50% -50%;rotate:' + (l.rot || 0) + 'deg;z-index:' + (l.z || 0) + ';opacity:' + (l.op == null ? 1 : l.op) + (l.flip ? ';scale:-1 1' : '') + (l.mx != null ? ';--mx:' + l.mx + ';--my:' + l.my : '');
      return '<span data-scene-l' + (l.anim ? ' data-sm="' + l.anim + '"' : '') + ' style="' + st + '"><img src="' + l.src + '" alt="" draggable="false" decoding="async" style="display:block;width:100%;height:auto"></span>';
    }).join('');
  }
  function inner(a) {
    var A = window.SpaceArt;
    if (a.kind === 'scene') return sceneHTML(a);
    if (a.kind === 'img') return '<img src="' + a.src + '" alt="" draggable="false" decoding="async">';
    if (a.kind === 'ground') return '<img data-ground-img="1" src="' + a.src + '"' + (a.cropTop != null ? ' style="margin-top:-' + (a.cropTop * 108).toFixed(2) + '%"' : '') + ' alt="" draggable="false" decoding="async" width="2048" height="2048">';
    if (a.kind === 'video' && a.blend) return '<span data-xf data-blend-src="' + a.src + '?v=2"><canvas aria-hidden="true"></canvas></span>';
    if (a.kind === 'video') { var V = '<video src="' + a.src + '?v=2" muted playsinline preload="auto" disablepictureinpicture tabindex="-1"'; return '<span data-xf>' + V + ' style="position:absolute;inset:0;z-index:1"></video>' + V + ' style="position:absolute;inset:0;z-index:0;opacity:0"></video></span>'; }
    if (a.kind === 'field' || a.kind === 'stars') return '<canvas aria-hidden="true"></canvas>';
    if (a.kind === 'vignette') return '';
    if (a.kind === 'sat') return SAT.replace('__ANG__', a.angles ? angHTML(a) : '');
    if (a.kind === 'ang') return angHTML(a);
    if (a.kind === 'orbit') return ORBIT;
    if (a.kind === 'ring-orbit') return ringOrbit(a);
    if (a.kind === 'const' && A) return A.constellation(a.i).replace('</svg>', PK + '</svg>');
    if (a.kind === 'svg' && A && A[a.fn]) return a.fn === 'dotField' ? A.dotField(600, 300, 26, 11) : A[a.fn](a.arg);
    return '';
  }
  function hostOf(e) { return document.querySelector(HOSTS[e.section]); }
  // asteroid fields fill their section unless moved (fill: false); star fields only when asked to (fill: true)
  function fillMode(a, e) { return a.kind === 'field' ? e.fill !== false : a.kind === 'stars' ? e.fill === true : false; }
  SL.fillMode = fillMode;
  // position + size from config only
  function apply(e, d) {
    d = d || document.querySelector('[data-sl-id="' + e.id + '"]'); if (!d) return;
    var a = SL.cfg.assets[e.asset] || {};
    if (a.kind === 'fixed') return applyFixed(e);
    if (fillMode(a, e)) { // fills the whole section, always the very back
      // keep x / y / w / h describing that box, so a move or resize in the editor starts from exactly what you see
      var fh = hostOf(e); if (fh && fh.offsetWidth) { e.x = 50; e.y = 50; e.w = 100; e.h = Math.round(fh.offsetHeight / fh.offsetWidth * 10000) / 100; e.rotate = 0; delete e.anchor; }
      d.style.left = d.style.top = '0'; d.style.width = d.style.height = '100%'; d.style.bottom = ''; d.style.transform = 'none'; d.style.aspectRatio = ''; d.style.zIndex = '0';
      var fn = d.querySelector(':scope > [data-sl-in]'); if (fn) { fn.style.setProperty('--o', a.kind === 'stars' || e.opacity == null ? 1 : e.opacity); if (fn.__af) fn.__af.update(e); }
      if (e.hidden) d.setAttribute('data-sl-hidden', ''); else d.removeAttribute('data-sl-hidden');
      return;
    }
    if (e.area && (a.kind === 'backdrop' || a.kind === 'stars' || a.kind === 'field')) { // a fixed stretch of its section (fields in fill mode returned above)
      applyArea(e, d, a);
      d.style.zIndex = a.kind === 'backdrop' ? -1000 + (e.z || 0) : a.kind === 'field' ? 0 : (e.z || 0) + 2;
      var na = d.querySelector(':scope > [data-sl-in]'); if (na) { na.style.setProperty('--o', a.kind === 'stars' || e.opacity == null ? 1 : e.opacity); na.style.setProperty('--bpk', e.motion == null ? 1 : e.motion); }
      if (e.hidden) d.setAttribute('data-sl-hidden', ''); else d.removeAttribute('data-sl-hidden');
      return;
    }
    if (d.hasAttribute('data-sl-area')) { d.removeAttribute('data-sl-area'); var ob = d.querySelector('[data-bd-box]'); if (ob) ob.style.cssText = ''; }
    if (e.near) near(e);
    else if (e.ay) { var ah = hostOf(e), ay = ah && ah.offsetHeight ? edgeY(ah, e.ay) : null; if (ay != null) e.y = Math.round(ay / ah.offsetHeight * 1e5) / 1e3; } // follow its content
    d.style.visibility = e.__nh ? 'hidden' : '';
    var h = e.h != null ? e.h : e.w * (a.aspect || 1);
    d.style.left = e.x + '%';
    if (e.anchor === 'bottom') { d.style.top = 'auto'; d.style.bottom = (100 - e.y) + '%'; d.style.transform = 'translate(-50%,0) rotate(' + (e.rotate || 0) + 'deg)'; d.style.transformOrigin = '50% 100%'; }
    else { d.style.bottom = ''; d.style.top = e.y + '%'; d.style.transform = 'translate(-50%,-50%) rotate(' + (e.rotate || 0) + 'deg)'; d.style.transformOrigin = ''; }
    d.style.width = e.w + '%'; d.style.height = ''; // (a field leaving fill mode still has height: 100%)
    d.style.aspectRatio = e.w + ' / ' + h;
    d.style.zIndex = a.kind === 'backdrop' ? -1000 + (e.z || 0) : a.kind === 'field' ? 0 : e.asset === 'dot-field' ? 1 : (e.z || 0) + 2; // backdrops behind everything, then star-field dots
    var n = d.querySelector(':scope > [data-sl-in]'); if (n) n.style.setProperty('--o', a.kind === 'stars' || e.opacity == null ? 1 : e.opacity); // star fields: each layer has its own absolute opacity
    if (e.hidden) d.setAttribute('data-sl-hidden', ''); else d.removeAttribute('data-sl-hidden');
    angSync(d, e);
    if ((a.kind === 'stars' || a.kind === 'field') && n && n.__af) n.__af.update(e);
    if ((a.kind === 'backdrop' || a.kind === 'scene' || a.strength) && n) n.style.setProperty('--bpk', e.motion == null ? 1 : e.motion);
    if (a.kind === 'vignette' && n && window.SpaceVignette) { if (n.__reg) window.SpaceVignette.update(n, e); else window.SpaceVignette.mount(n, e); }
  }
  // runtime anchors so a placement survives any screen width (cleared once moved by hand in edit mode)
  function findText(host, t) { var all = [].concat(t), best = null; host.querySelectorAll('*').forEach(function (el) { if (el.closest('[data-sl-layer]')) return; var tx = el.textContent; if (all.every(function (q) { return tx.indexOf(q) >= 0; }) && (!best || tx.length <= best.textContent.length)) best = el; }); return best; }
  // layout rect relative to the host, ignoring reveal transforms (offset chain)
  function rectIn(el, host) {
    var x = 0, y = 0, n = el, hp = host;
    while (n && n !== document.body) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    var hx = 0, hy = 0; n = hp; while (n && n !== document.body) { hx += n.offsetLeft; hy += n.offsetTop; n = n.offsetParent; }
    return { l: x - hx, t: y - hy, w: el.offsetWidth, h: el.offsetHeight, r: x - hx + el.offsetWidth, b: y - hy + el.offsetHeight };
  }
  // pin: tie an element to real page elements so it keeps its spot at every screen size.
  //   near.pin = { to, at: [fx, fy], by: 'page' | 'w' | 'h', s, ar }   (or the older { sel, box: { l: [sel, edge], r, t, b } })
  //   to  = a named area of the hero (PIN_TO below); each one adapts when the hero stacks on phones and tablets
  //   box = reference box (each side from an element's edge; missing sides use sel's rect)
  //   at  = centre as a fraction of the box (y is the bottom edge when anchor: 'bottom'); can go outside 0..1
  //   s   = element width as a fraction of the box width (by 'w') or height (by 'h'); ar = height / width
  //   req = [selA, edgeA, selB, edgeB, minPx, maxPx?]: only show while B's edge minus A's edge is within min..max
  //         (e.g. hero columns side by side). A list of these means all must hold.
  var PH = '[data-hero-photo]', HR = '[data-hero-r]';
  function q(sel, host) { var el = document.querySelector(sel); return el ? rectIn(el, host) : null; }
  function bx(l, t, r, b) { return r - l < 1 || b - t < 1 ? null : { l: l, t: t, r: r, b: b, w: r - l, h: b - t }; }
  var PIN_TO = {
    hero: function (h) { return bx(0, 0, h.offsetWidth, h.offsetHeight); },
    photo: function (h) { var p = q(PH, h); return p && bx(p.l, p.t, p.r, p.b); },
    gap: function (h) { // beside the photo: up to the comments column, or to the page edge when stacked
      var p = q(PH, h), c = q(HR, h); if (!p) return null;
      var side = c && c.l > p.r, gut = p.l; return bx(p.r, p.t, side ? c.l : h.offsetWidth - gut, p.b);
    },
    right: function (h) { var c = q(HR, h); return c && bx(c.l, c.t, c.r, c.b); },
    below: function (h) { // under the hero: from the "press start" button down to the About section
      var st = q('[data-start]', h), ab = q('#about > div', h); return st && ab && bx(0, st.b, h.offsetWidth, ab.t);
    },
    // a section's top or bottom edge (P.ref, P.side). The box is one page-width tall, so the distance from the edge
    // scales with the page width just like the element's size does: it keeps its place against the content at any screen size.
    edge: function (h, P) {
      var r = P && q(P.ref, h); if (!r) return null; var y = P.side === 'bottom' ? r.b : r.t; return bx(0, y, h.offsetWidth, y + h.offsetWidth);
    }
  };
  var SECTIONS = 'section[id], section[data-screen-label], main[data-screen-label], footer';
  function nearestEdge(e, host, P) { // the section boundary closest to the element's reference point
    var py = e.y / 100 * host.offsetHeight, best = null;
    document.querySelectorAll(SECTIONS).forEach(function (s) {
      var r = rectIn(s, host), ref = s.id ? '#' + s.id : s.hasAttribute('data-screen-label') ? s.tagName.toLowerCase() + '[data-screen-label="' + s.getAttribute('data-screen-label') + '"]' : 'footer';
      [['top', r.t], ['bottom', r.b]].forEach(function (c) { var d = Math.abs(c[1] - py); if (!best || d < best.d) best = { d: d, ref: ref, side: c[0] }; });
    });
    if (best) { P.ref = best.ref; P.side = best.side; }
  }
  SL.PIN_TO = PIN_TO;
  function pinBox(P, host) {
    if (P.to) return PIN_TO[P.to] ? PIN_TO[P.to](host, P) : null;
    var base = P.sel && document.querySelector(P.sel), br = base && rectIn(base, host), B = P.box || {}, o = {};
    var side = function (k) { var q = B[k]; if (!q) return br ? br[k] : null; var el = document.querySelector(q[0]); if (!el) return null; var r = rectIn(el, host); return r[q[1] || k]; };
    o.l = side('l'); o.r = side('r'); o.t = side('t'); o.b = side('b');
    if (o.l == null || o.r == null || o.t == null || o.b == null) return null;
    o.w = Math.max(1, o.r - o.l); o.h = Math.max(1, o.b - o.t); return o;
  }
  function pinFrom(e) { // editor: turn the element's current x / y / w / h back into pin values
    var P = e.near && e.near.pin, host = hostOf(e); if (!P || !host) return;
    if (P.to === 'edge') nearestEdge(e, host, P); // re-attach to whichever edge it's now closest to
    var B = pinBox(P, host); if (!B) return; var HW = host.offsetWidth, HH = host.offsetHeight;
    var wpx = e.w / 100 * HW, hpx = (e.h != null ? e.h : e.w) / 100 * HW;
    P.at = [Math.round(((e.x / 100 * HW) - B.l) / B.w * 1000) / 1000, Math.round(((e.y / 100 * HH) - B.t) / B.h * 1000) / 1000];
    P.s = Math.round(wpx / (P.by === 'page' ? HW : P.by === 'h' ? B.h : B.w) * 10000) / 10000; P.ar = Math.round(hpx / wpx * 10000) / 10000;
  }
  function near(e) {
    var host = hostOf(e); if (!host) return; var HW = host.offsetWidth, HH = host.offsetHeight; if (!HW) return;
    var N = e.near, px, py, maxW = Infinity, maxH = Infinity;
    if (e.__w0) { e.w = e.__w0[0]; e.h = e.__w0[1]; }
    var cap = Math.min(1, 1440 / HW); // keep the 1440 composition size on very wide screens
    if (N.card != null) {
      var map = host.querySelector('[data-mpath]'), cards = host.querySelectorAll('[data-mcard]'), card = cards[N.card], rail = host.querySelector('[data-rail]'); if (!map || !card || !rail) return;
      var mr = rectIn(map, host), cr = rectIn(card, host), rx = rectIn(rail, host).l + 1.5, right = cr.l + cr.w / 2 > rx;
      var c0 = right ? Math.max(0, mr.l - 40) : rx + 40, c1 = right ? rx - 40 : Math.min(HW, mr.r + 40);
      px = (c0 + c1) / 2 + (N.dx || 0) / 100 * HW; py = cr.t + cr.h / 2 + (N.dy || 0) / 100 * Math.min(HW, 1440); maxW = (c1 - c0) * 0.92;
      var up = 0, dn = HH; [].forEach.call(cards, function (c) { var q = rectIn(c, host); if ((q.l + q.w / 2 > rx) === right) return; if (q.b <= cr.t + cr.h / 2) up = Math.max(up, q.b); else if (q.t >= cr.t + cr.h / 2) dn = Math.min(dn, q.t); });
      maxH = (Math.min(py - up, dn - py) - 18) * 2;
    } else if (N.pin) {
      var P = N.pin, B3 = pinBox(P, host), ok = !!B3;
      if (ok && P.req) (Array.isArray(P.req[0]) ? P.req : [P.req]).forEach(function (q) {
        var qa = document.querySelector(q[0]), qb = document.querySelector(q[2]); if (!ok || !qa || !qb) { ok = false; return; }
        var dd = rectIn(qb, host)[q[3]] - rectIn(qa, host)[q[1]]; ok = dd >= (q[4] || 0) && (q[5] == null || dd <= q[5]);
      });
      if (!ok) { Object.defineProperty(e, '__nh', { value: true, writable: true, enumerable: false, configurable: true }); return; }
      var at3 = P.at || [0.5, 0.5], a3 = (SL.cfg.assets[e.asset] || {}), ar = P.ar || a3.aspect || 1;
      var wpx3 = (P.s || 0.5) * (P.by === 'page' ? HW : P.by === 'h' ? B3.h : B3.w);
      e.x = Math.round((B3.l + B3.w * at3[0]) / HW * 1000) / 10; e.y = Math.round((B3.t + B3.h * at3[1]) / HH * 1000) / 10;
      e.w = Math.round(wpx3 / HW * 10000) / 100; e.h = Math.round(wpx3 * ar / HW * 10000) / 100;
      Object.defineProperty(e, '__nh', { value: false, writable: true, enumerable: false, configurable: true });
      return;
    } else if (N.text) {
      var t = findText(host, N.text); if (!t) return;
      var tr = rectIn(t, host), at = N.at || [0.5, 1];
      px = tr.l + tr.w * at[0] + (N.ox || 0); py = tr.t + tr.h * at[1] + (N.oy || 0);
    } else if (N.host) {
      var at2 = N.at || [1, 1]; px = HW * at2[0] + (N.ox || 0); py = HH * at2[1] + (N.oy || 0);
    } else return;
    e.x = Math.round(px / HW * 1000) / 10; e.y = Math.round(py / HH * 1000) / 10;
    var wpx = e.w / 100 * HW * cap, hpx = (e.h || e.w) / 100 * HW * cap, k = Math.min(cap, cap * maxW / wpx, cap * maxH / hpx);
    if (k < 1) { if (!e.__w0) Object.defineProperty(e, '__w0', { value: [e.w, e.h], writable: true, enumerable: false }); e.w = Math.round(e.w * k * 100) / 100; e.h = Math.round(e.h * k * 100) / 100; }
    // optional keep-clear: hide (never move) when the box would touch these elements at this width
    var nh = false;
    if (N.clear) {
      var bw = e.w / 100 * HW * 0.85, bh2 = (e.h || e.w) / 100 * HW * 0.85, pad = N.pad || 0;
      host.querySelectorAll(N.clear).forEach(function (c) { if (c.closest('[data-sl-layer]')) return; var q = rectIn(c, host); if (q.l < px + bw / 2 + pad && q.r > px - bw / 2 - pad && q.t < py + bh2 / 2 + pad && q.b > py - bh2 / 2 - pad) nh = true; });
    }
    Object.defineProperty(e, '__nh', { value: nh, writable: true, enumerable: false, configurable: true });
  }
  // ---- one image per element (other angles only give copies variety) ----
  function angBase(e, a) {
    var set = a.autoSet || a.angles.map(function (_, i) { return i + 1; });
    var L = SL.cfg[SL.mode] || [], k = 0; for (var i = 0; i < L.length; i++) { if (L[i].id === e.id) break; if (L[i].asset === e.asset) k++; } return set[k % set.length];
  }
  function angShow(box, k) { box.querySelectorAll(':scope > img').forEach(function (im) { if (+im.getAttribute('data-i') === k) im.setAttribute('data-on', ''); else im.removeAttribute('data-on'); }); }
  function angSync(d, e) {
    var box = d.querySelector('[data-ang]'); if (!box) return;
    var a = SL.cfg.assets[e.asset] || {}; if (!a.angles) return;
    var k = e.angle != null && e.angle !== 'auto' ? Math.min(+e.angle, a.angles.length) : angBase(e, a);
    angShow(box, k);
    if (a.dirs) { var dv = a.dirs[(k - 1) % a.dirs.length], inn = d.querySelector(':scope > [data-sl-in]'); if (inn && dv) { inn.style.setProperty('--mx', dv[0]); inn.style.setProperty('--my', dv[1]); } }
  }
  // ---- timeline rocket: one straight image + code-drawn flame ----
  // timeline rocket: nose follows scroll direction (spring 180° turn), flies straight, flips nose up and lands above the "?"
  window.SLRocket = function (r, st) {
    var body = r.querySelector('[data-rk-body]'); if (!body) return;
    var left = st.left == null ? 9 : st.left, landed = left <= 0.02 && !st.moving;
    if (landed) r.setAttribute('data-landed', ''); else r.removeAttribute('data-landed');
    if (rmQ.matches) { body.style.rotate = '180deg'; r.style.setProperty('--fs', 0.35); return; }
    var now = performance.now(), top = r.offsetTop, v = 0;
    if (r.__lt != null) v = Math.abs(top - r.__lt) / Math.max(16, now - r.__ltime);
    r.__lt = top; r.__ltime = now; r.__v = st.moving ? (r.__v || 0) * 0.6 + v * 0.4 : 0;
    var dir = st.dir || 'down', near = left < 1.6, landing = near && dir === 'down';
    var base = dir === 'down' && !landing ? 180 : 0;
    if (r.__base !== base) { body.style.setProperty('--rk-turn', landing ? '.5s' : '.4s'); r.__base = base; }
    var fs = st.moving ? Math.min(1.7, 0.75 + r.__v * 0.9) : 0.4;
    if (near) fs *= Math.max(0, Math.min(1, left / 1.6));
    if (landed) fs = 0;
    r.style.setProperty('--fs', fs.toFixed(2));
    body.style.rotate = base + 'deg'; // flies straight along the line, nose first
  };
  function build(e) {
    var a = SL.cfg.assets[e.asset]; if (!a || a.kind === 'fixed') return null;
    var d = document.createElement('div');
    d.setAttribute('data-sl-el', ''); d.setAttribute('data-sl-id', e.id);
    if (a.kind === 'img' || a.kind === 'sat' || a.kind === 'ang' || a.kind === 'scene') d.setAttribute('data-sl-img', '');
    if (a.kind === 'video') { d.setAttribute('data-sl-video', ''); if (a.blend) d.setAttribute('data-sl-blend', ''); }
    if (a.kind === 'orbit') d.setAttribute('data-sl-orbit', '');
    if (a.kind === 'backdrop') d.setAttribute('data-sl-backdrop', '');
    var n = document.createElement('div'); n.setAttribute('data-sl-in', ''); n.setAttribute('data-sl-kind', a.kind);
    if (e.anim !== false && a.anim) n.setAttribute('data-sm', a.anim);
    if (e.parallax === false) n.setAttribute('data-sm-still', ''); // stays put: no mouse / scroll drift
    n.innerHTML = a.kind === 'backdrop' ? backdropHTML(a, e.anim !== false) : inner(a);
    n.querySelectorAll(':scope > svg').forEach(function (s) { if (a.kind === 'const') s.setAttribute('preserveAspectRatio', 'xMidYMid meet'); else if (a.kind !== 'sat') s.setAttribute('preserveAspectRatio', 'none'); s.removeAttribute('width'); });
    d.appendChild(n);
    apply(e, d);
    if (a.kind === 'video') xfInit(n.querySelector('[data-xf]'));
    if (a.kind === 'stars' && window.StarField) { n.setAttribute('data-sf', ''); window.StarField.mount(n, e); }
    else if (a.kind === 'field' && a.engine === 'stars') { if (window.StarField) { n.setAttribute('data-sf', ''); window.StarField.mount(n, e); } }
    else if (a.kind === 'field' && window.AsteroidField) { n.setAttribute('data-af', ''); window.AsteroidField.mount(n, e, a.srcs || []); }
    return d;
  }
  // elements that already exist in the page (rocket): vertical position stays scroll-driven,
  // x, w and h come from the config (x: null keeps it on the timeline line)
  function applyFixed(e) {
    var a = SL.cfg.assets[e.asset]; if (!a || a.kind !== 'fixed') return;
    var n = document.querySelector(a.target), h = hostOf(e); if (!n || !h) return;
    n.setAttribute('data-sl-el', ''); n.setAttribute('data-sl-id', e.id); n.setAttribute('data-sl-fixed', '');
    var W = h.getBoundingClientRect().width, hh = e.h != null ? e.h : e.w * (a.aspect || 1);
    n.style.setProperty(a.sizeVar, (e.w / 100 * W).toFixed(1) + 'px');
    n.style.height = (hh / 100 * W).toFixed(1) + 'px';
    if (a.rail) n.style.left = 'var(--rail-x,50%)'; // rides the timeline line: always centred on it
    else if (e.x != null && n.offsetParent) { var pr = n.offsetParent.getBoundingClientRect(), hr = h.getBoundingClientRect(); n.style.left = (hr.left + e.x / 100 * W - pr.left).toFixed(1) + 'px'; }
    else n.style.left = '';
    n.style.opacity = e.opacity == null ? '' : e.opacity;
    if (e.hidden) n.setAttribute('data-sl-hidden', ''); else n.removeAttribute('data-sl-hidden');
  }
  // entrance: each element fades in once, the first time it comes into view; no fade out
  var FADE = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting || !en.target.isConnected) { en.target.removeAttribute('data-sl-wait'); FADE.unobserve(en.target); } }); }) : null;
  function bp() { return SL.mode || (innerWidth < 768 ? 'mobile' : 'desktop'); }
  function render() {
    if (!SL.cfg) return;
    var mode = bp(), list = SL.cfg[mode] || [];
    Object.keys(HOSTS).forEach(function (k) {
      var h = document.querySelector(HOSTS[k]); if (!h) return;
      h.setAttribute('data-sl-host', k);
      var layer = null; for (var i = h.children.length - 1; i >= 0; i--) { var ch = h.children[i]; if (!ch.hasAttribute('data-sl-layer')) continue; if (ch.getAttribute('data-sl-layer') === k && !layer) layer = ch; else ch.remove(); }
      if (!layer) { layer = document.createElement('div'); layer.setAttribute('data-sl-layer', k); layer.setAttribute('aria-hidden', 'true'); h.appendChild(layer); }
      layer.querySelectorAll('[data-sf],[data-af]').forEach(function (n) { if (n.__af && n.__af.destroy) n.__af.destroy(); });
      layer.innerHTML = '';
      list.forEach(function (e) { if (e.section === k) { var el = build(e); if (el) layer.appendChild(el); else applyFixed(e); } });
      layer.querySelectorAll('[data-sl-area]').forEach(function (d) { fitBox(d, d.__a, d.__e); }); // in the page now: size the picture before the first paint
      if (FADE && !SL.editing && !rmQ.matches) layer.querySelectorAll(':scope > [data-sl-el]').forEach(function (d) { d.setAttribute('data-sl-wait', ''); d.style.setProperty('--sl-fd', (Math.random() * 0.35).toFixed(2) + 's'); FADE.observe(d); });
    });
    if (HOST_RO) { HOST_RO.disconnect(); Object.keys(HOSTS).forEach(function (k) { var h = document.querySelector(HOSTS[k]); if (h) HOST_RO.observe(h); }); }
    SL.rendered = mode;
    document.dispatchEvent(new CustomEvent('sl:render'));
    if (SL.editing) mark();
  }

  // warning only (edit mode): flag elements that overlap text, buttons, pills, inputs or cards. never moves anything.
  var PAD = 4;
  function obstacles(scope) {
    var out = [], w = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT), t, rg = document.createRange();
    while ((t = w.nextNode())) {
      if (!t.nodeValue.trim()) continue;
      var p = t.parentElement; if (!p || p.closest('[data-sl-layer],[data-sl-fixed],script,style,[data-sl-panel]')) continue;
      rg.selectNodeContents(t); var rs = rg.getClientRects();
      for (var i = 0; i < rs.length; i++) if (rs[i].width > 1) out.push(rs[i]);
    }
    scope.querySelectorAll('a,button,input,textarea,select,div,span,li,article,label').forEach(function (n) {
      if (n.closest('[data-sl-layer],[data-sl-fixed],[data-sl-panel]')) return;
      var r = n.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return;
      if (/^(A|BUTTON|INPUT|TEXTAREA|SELECT)$/.test(n.tagName)) { out.push(r); return; }
      var cs = getComputedStyle(n);
      var boxed = (parseFloat(cs.borderTopWidth) > 0 && parseFloat(cs.borderLeftWidth) > 0) || cs.boxShadow !== 'none';
      if (boxed && r.width * r.height < innerWidth * innerHeight * 0.6) out.push(r);
    });
    return out;
  }
  var cache = null;
  function overlaps(el) {
    var s = el.closest('section,footer') || document.body; cache = cache || new Map();
    if (!cache.has(s)) cache.set(s, obstacles(s));
    var r = el.getBoundingClientRect(); if (!r.width) return false;
    return cache.get(s).some(function (o) { return r.left + PAD < o.right && r.right - PAD > o.left && r.top + PAD < o.bottom && r.bottom - PAD > o.top; });
  }
  var mT = 0;
  function mark() {
    clearTimeout(mT);
    mT = setTimeout(function () {
      cache = null;
      document.querySelectorAll('[data-sl-el]').forEach(function (el) {
        var skip = el.hasAttribute('data-sl-backdrop') || !!el.querySelector('[data-sl-kind="field"],[data-sl-kind="stars"]') || el.hasAttribute('data-sl-orbit') || el.hasAttribute('data-sl-fixed') || (el.querySelector('[data-sl-kind="ground"]'));
        if (!skip && overlaps(el)) el.setAttribute('data-sl-hit', ''); else el.removeAttribute('data-sl-hit');
      });
      cache = null;
    }, 120);
  }

  function check() {
    if (!SL.cfg) return;
    if (SL.rendered !== bp()) return render();
    for (var k in HOSTS) { var h = document.querySelector(HOSTS[k]); if (h && !h.querySelector(':scope > [data-sl-layer="' + k + '"]')) return render(); }
  }
  function refit() { if (!SL.cfg) return; (SL.cfg[bp()] || []).forEach(function (e) { if (e.near || e.ay || e.area) apply(e); else applyFixed(e); }); }
  // a section changed height (text wrapped, a font loaded, a card reflowed): move its content-tied elements with it
  var HOST_RO = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(function (es) {
    if (!SL.cfg) return; var keys = {};
    es.forEach(function (en) { var k = en.target.getAttribute('data-sl-host'); if (k) keys[k] = 1; });
    (SL.cfg[bp()] || []).forEach(function (e) { if (keys[e.section] && (e.ay || e.area)) apply(e); });
  }) : null;
  setInterval(function () { if (SL.cfg && !document.hidden) (SL.cfg[bp()] || []).forEach(function (e) { if (e.near) apply(e); }); }, 1000);
  fetch('data/space-layout.json?v=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (c) { SL.cfg = c; SL.saved = JSON.stringify(c); render(); }).catch(function () {});
  setInterval(check, 800);
  matchMedia('(max-width: 767px)').addEventListener('change', function () { check(); });
  var rT = 0;
  addEventListener('resize', function () { check(); clearTimeout(rT); rT = setTimeout(refit, 150); });
})();
