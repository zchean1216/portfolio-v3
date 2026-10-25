// Hero extra: one comet across the top half of the hero on the first visit, behind the text.
(function () {
  if (window.HeroFX) return;
  var rmQ = matchMedia('(prefers-reduced-motion: reduce)');
  var st = document.createElement('style');
  st.textContent = 'html[data-theme="dark"] [data-comet] img{filter:url(#sl-chalk)}';
  document.head.appendChild(st);
  function comet() {
    try { if (sessionStorage.getItem('pfx-hero-comet')) return; } catch (e) {}
    if (rmQ.matches || !window.SpaceVignette || !window.SpaceVignette.zone) return;
    setTimeout(function () {
      if (scrollY > innerHeight * .5) return;
      if (window.SpaceVignette.fly('hero', 3000)) try { sessionStorage.setItem('pfx-hero-comet', '1'); } catch (e) {}
    }, 2000);
  }
  var tries = 0;
  (function wait() { if (document.querySelector('#top [data-sl-layer]')) return comet(); if (++tries < 80) setTimeout(wait, 150); })();
  // "switch me off" payoff: one comet across the hero when the visitor turns the lights off
  var wasDark = document.documentElement.getAttribute('data-theme') === 'dark', ready = false;
  setTimeout(function () { ready = true; wasDark = document.documentElement.getAttribute('data-theme') === 'dark'; }, 1500);
  new MutationObserver(function () {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (ready && dark && !wasDark && !rmQ.matches && window.SpaceVignette && scrollY < innerHeight * .5) setTimeout(function () { window.SpaceVignette.fly('hero', 2800); }, 450);
    wasDark = dark;
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  window.HeroFX = {};
})();
