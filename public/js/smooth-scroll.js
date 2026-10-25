/* Smooth scroll (Lenis, loaded from the CDN in index.html) and the reveal fallback for browsers without animation-timeline.
   Both are skipped under prefers-reduced-motion. If the CDN is blocked the site scrolls natively. */
(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
  if (reduce.matches) return;

  if (window.Lenis) {
    var lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
    window.__lenis = lenis;
    (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(performance.now());
  }

  if (window.CSS && CSS.supports && CSS.supports('animation-timeline: view()')) return; // CSS does the reveals
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      e.target.classList.add('sv-go');
      e.target.classList.remove('sv-wait');
    });
  }, { threshold: 0.15 });
  function scan() {
    document.querySelectorAll('[data-sv]:not([data-sv-seen])').forEach(function (el) {
      el.setAttribute('data-sv-seen', '');
      var r = el.getBoundingClientRect();
      if (r.top < innerHeight && r.bottom > 0) return; // already on screen: leave it
      el.classList.add('sv-wait');
      io.observe(el);
    });
  }
  scan();
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true }); // the view changes without a page load
})();
