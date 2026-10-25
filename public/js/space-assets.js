// space line-art kit. every element returns an inline svg string.
// colours live in two css vars: --sa-line (strokes) and --sa-fill (flat fills)
(function () {
  var S = 'fill="none" stroke="var(--sa-line)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"';
  var NS = 'vector-effect="non-scaling-stroke"';
  function svg(vb, inner, w) { return '<svg viewBox="' + vb + '" width="' + (w || '100%') + '" aria-hidden="true" style="display:block;overflow:visible;fill:none;stroke:var(--sa-line);stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round">' + inner + '</svg>'; }
  function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

  function sparkle(size) {
    var d = 'M0 -10 Q1.4 -1.4 10 0 Q1.4 1.4 0 10 Q-1.4 1.4 -10 0 Q-1.4 -1.4 0 -10 Z';
    return svg('-11 -11 22 22', '<path d="' + d + '" ' + NS + '></path>', ({ s: 14, m: 24, l: 40 })[size] || 24);
  }

  // poisson-disc sampling keeps the field even, no clumps
  function dotField(w, h, gap, seed) {
    w = w || 600; h = h || 300; gap = gap || 26; var r = rng(seed || 11), pts = [], tries = 0;
    while (tries < 4000) { tries++; var x = r() * w, y = r() * h, ok = true;
      for (var i = 0; i < pts.length; i++) { var dx = pts[i][0] - x, dy = pts[i][1] - y; if (dx * dx + dy * dy < gap * gap) { ok = false; break; } }
      if (ok) pts.push([x, y]); }
    var sizes = [1, 1.6, 2.4];
    return svg('0 0 ' + w + ' ' + h, pts.map(function (p) { var s = sizes[Math.floor(r() * 3)]; return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + s + '" fill="var(--sa-line)" stroke="none"></circle>'; }).join(''));
  }

  // traced from the constellation sheet: [x, y, type, size]; type s = 5-point star, p = 4-point sparkle, d = dot, S = filled 5-point
  // paths[0] is the main route (draw-in + data packet), the rest are branches
  var CONST = [
    { name: 'Southern Cross', stars: [[352,532,'s',46],[217,700,'s',46],[505,638,'s',38],[390,907,'s',46],[442,750,'s',24]], paths: [[0,3],[1,2]] },
    { name: 'Orion', stars: [[782,344,'s',12],[833,337,'s',12],[774,442,'s',12],[745,459,'s',12],[830,595,'p',34],[938,541,'s',16],[997,614,'p',22],[1182,597,'s',14],[1152,530,'s',11],[1180,563,'d',6],[1178,630,'s',11],[1150,702,'s',12],[905,800,'p',22],[935,782,'s',12],[965,762,'p',24],[862,972,'p',26],[1065,928,'p',34]],
      paths: [[3,4,5,6,14,16,15,12,4],[0,3],[1,2],[6,7],[8,9,7,10,11],[12,13,14]] },
    { name: 'Big Dipper', stars: [[1328,620,'s',20],[1467,598,'p',24],[1548,650,'p',22],[1645,707,'p',20],[1862,706,'p',30],[1828,826,'s',22],[1665,808,'s',22]], paths: [[0,1,2,3,4,5,6,3]] },
    { name: 'Scorpius', stars: [[2400,472,'s',16],[2436,538,'p',22],[2340,590,'p',14],[2435,618,'p',22],[2290,610,'S',34],[2255,660,'p',14],[2197,788,'p',22],[2190,876,'s',12],[2180,962,'p',22],[2110,992,'s',13],[2015,987,'p',22],[1965,925,'s',16],[1988,895,'s',10],[2025,855,'p',24]],
      paths: [[1,2,4,5,6,7,8,9,10,11,12,13],[0,1],[0,2],[2,3],[1,3]] }
  ];
  function starPath(x, y, t, r) {
    if (t === 'd') return '<circle data-star="1" cx="' + x + '" cy="' + y + '" r="' + r + '" fill="var(--sa-fill)" ' + NS + '></circle>';
    var d = '';
    if (t === 'p') { var k = r * 0.16; d = 'M' + x + ' ' + (y - r) + 'Q' + (x + k) + ' ' + (y - k) + ' ' + (x + r) + ' ' + y + 'Q' + (x + k) + ' ' + (y + k) + ' ' + x + ' ' + (y + r) + 'Q' + (x - k) + ' ' + (y + k) + ' ' + (x - r) + ' ' + y + 'Q' + (x - k) + ' ' + (y - k) + ' ' + x + ' ' + (y - r) + 'Z'; }
    else { for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; d += (i ? 'L' : 'M') + (x + rr * Math.cos(a)).toFixed(1) + ' ' + (y + rr * Math.sin(a)).toFixed(1); } d += 'Z'; }
    return '<path data-star="1" d="' + d + '" fill="' + (t === 'S' ? 'var(--sa-line)' : 'var(--sa-fill)') + '" stroke-linejoin="round" ' + NS + '></path>';
  }
  function constellation(i) {
    var c = CONST[i || 0], xs = c.stars.map(function (s) { return s[0]; }), ys = c.stars.map(function (s) { return s[1]; }), pad = 50;
    var x0 = Math.min.apply(0, xs) - pad, y0 = Math.min.apply(0, ys) - pad, w = Math.max.apply(0, xs) - Math.min.apply(0, xs) + pad * 2, h = Math.max.apply(0, ys) - Math.min.apply(0, ys) + pad * 2;
    var lines = c.paths.map(function (p) { return '<polyline points="' + p.map(function (k) { return c.stars[k][0] + ',' + c.stars[k][1]; }).join(' ') + '" stroke-width="1" ' + NS + '></polyline>'; }).join('');
    var stars = c.stars.map(function (s) { return starPath(s[0], s[1], s[2], s[3]); }).join('');
    return svg(x0 + ' ' + y0 + ' ' + w + ' ' + h, lines + stars).replace('<svg ', '<svg data-const-ar="1" ');
  }
  constellation.aspect = function (i) { var c = CONST[i], xs = c.stars.map(function (s) { return s[0]; }), ys = c.stars.map(function (s) { return s[1]; }); return (Math.max.apply(0, ys) - Math.min.apply(0, ys) + 100) / (Math.max.apply(0, xs) - Math.min.apply(0, xs) + 100); };

  function moonHorizon() {
    var W = 1200, y0 = 120, yc = 70;
    var yAt = function (x) { var t = x / W; return (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * yc + t * t * y0; };
    var o = '<path d="M0 ' + y0 + ' Q' + (W / 2) + ' ' + yc + ' ' + W + ' ' + y0 + '" ' + NS + '></path>';
    [[170, 44], [430, 70], [700, 36], [940, 58]].forEach(function (c) { var x = c[0], w = c[1], y = yAt(x) + 7;
      o += '<ellipse cx="' + x + '" cy="' + y.toFixed(1) + '" rx="' + w + '" ry="' + (w * 0.13).toFixed(1) + '" fill="var(--sa-fill)" ' + NS + '></ellipse>' +
        '<path d="M' + (x - w * 0.7) + ' ' + (y + 1).toFixed(1) + ' Q' + x + ' ' + (y + w * 0.12 + 2).toFixed(1) + ' ' + (x + w * 0.7) + ' ' + (y + 1).toFixed(1) + '" stroke-width="1" ' + NS + '></path>'; });
    return svg('0 40 1200 110', o);
  }

  function paperWaves() {
    var w = ['M0 70 C120 30 240 110 360 70 S600 30 720 70 V150 H0 Z', 'M0 95 C140 60 260 130 400 95 S620 60 720 95 V150 H0 Z', 'M0 120 C110 95 250 150 380 120 S610 95 720 120 V150 H0 Z'];
    return svg('0 20 720 130', w.map(function (d) { return '<path d="' + d + '" fill="var(--sa-fill)" ' + NS + '></path>'; }).join(''));
  }

  // tabler icons (MIT) outline paths, recoloured to the line colour
  var TABLER = {
    satellite: '<path d="M3.707 6.293l2.586 -2.586a1 1 0 0 1 1.414 0l5.586 5.586a1 1 0 0 1 0 1.414l-2.586 2.586a1 1 0 0 1 -1.414 0l-5.586 -5.586a1 1 0 0 1 0 -1.414z"></path><path d="M6 10l-3 3l3 3l3 -3"></path><path d="M10 6l3 -3l3 3l-3 3"></path><path d="M12 12l1.5 1.5"></path><path d="M14.5 17a2.5 2.5 0 0 0 2.5 -2.5"></path><path d="M15 21a6 6 0 0 0 6 -6"></path>',
    telescope: '<path d="M6 21l6 -5l6 5"></path><path d="M12 13v8"></path><path d="M3.294 13.678l.166 .281c.52 .88 1.624 1.265 2.605 .91l14.242 -5.165a1.023 1.023 0 0 0 .565 -1.456l-2.62 -4.705a1.087 1.087 0 0 0 -1.447 -.42l-.056 .032l-12.694 7.618c-1.02 .613 -1.357 1.897 -.76 2.905z"></path><path d="M14 5l3 5.5"></path>',
    rocket: '<path d="M4 13a8 8 0 0 1 7 7a6 6 0 0 0 3 -5a9 9 0 0 0 6 -8a3 3 0 0 0 -3 -3a9 9 0 0 0 -8 6a6 6 0 0 0 -5 3"></path><path d="M7 14a6 6 0 0 0 -3 6a6 6 0 0 0 6 -3"></path><path d="M15 9m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"></path>'
  };
  function icon(name) { return svg('0 0 24 24', TABLER[name].replace(/<path /g, '<path ' + NS + ' ')); }

  window.SpaceArt = { constData: function (i) { return CONST[i]; }, constCount: CONST.length, sparkle: sparkle, dotField: dotField, constellation: constellation, moonHorizon: moonHorizon, paperWaves: paperWaves, icon: icon };
})();
