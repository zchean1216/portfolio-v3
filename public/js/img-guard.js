// Image safety net: if an image fails to load (flaky mobile connection, a dropped request), try it again a couple of
// times, and again when the connection comes back. If it still can't load, hide it quietly instead of showing the
// browser's broken-image icon and alt text. Works for every <img>, including ones added later by the page.
(function () {
  if (window.__imgGuard) return; window.__imgGuard = 1;
  var DELAYS = [800, 2500], failed = [];
  function retry(img) {
    var n = img.__tries || 0;
    if (n >= DELAYS.length) { img.style.visibility = 'hidden'; if (failed.indexOf(img) < 0) failed.push(img); return; }
    img.__tries = n + 1;
    var src = img.getAttribute('src'), set = img.getAttribute('srcset');
    setTimeout(function () {
      if (!img.isConnected) return;
      // re-assigning makes the browser request it again (failed loads aren't cached)
      if (set) { img.removeAttribute('srcset'); img.setAttribute('srcset', set); }
      if (src) { img.removeAttribute('src'); img.setAttribute('src', src); }
    }, DELAYS[n]);
  }
  document.addEventListener('error', function (e) {
    var img = e.target;
    if (img && img.tagName === 'IMG' && img.getAttribute('src') && !/^data:/.test(img.getAttribute('src'))) retry(img);
  }, true);
  document.addEventListener('load', function (e) {
    var img = e.target;
    if (img && img.tagName === 'IMG' && img.__tries) { img.style.visibility = ''; img.__tries = 0; }
  }, true);
  addEventListener('online', function () {
    failed.splice(0).forEach(function (img) { if (img.isConnected) { img.__tries = 0; retry(img); } });
  });
})();
