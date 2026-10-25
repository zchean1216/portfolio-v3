// local-only edit mode for space elements. loaded by space-layout.js on localhost with ?edit=1.
// run the dev server (npm run dev) so "Save" can write data/space-layout.json.
(function () {
  if (window.__slEdit) return; window.__slEdit = 1;
  var SL = window.SpaceLayout; if (!SL) return;
  var restored = null, sel = null, panel, ui = {}, undo = [], redo = [], pending = null, previewing = false, exitBtn = null;
  var M = "font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase";
  function wait() { if (!SL.cfg) return setTimeout(wait, 200); start(); }
  setTimeout(wait, 0);

  function list() { return SL.cfg[SL.mode]; }
  function find(id) { return list().filter(function (e) { return e.id === id; })[0]; }
  function nodeOf(id) { return document.querySelector('[data-sl-id="' + id + '"]'); }
  function asset(e) { return SL.cfg.assets[e.asset] || {}; }
  function isFixed(e) { return asset(e).kind === 'fixed'; }
  function r2(v) { return Math.round(v * 100) / 100; }
  function hostRect(e) { var h = SL.hostOf(e); return h ? h.getBoundingClientRect() : null; }
  function hOf(e) { return e.h != null ? e.h : e.w * (asset(e).aspect || 1); }

  // ---- history ----
  function snap() { return JSON.stringify({ desktop: SL.cfg.desktop, mobile: SL.cfg.mobile }); }
  function begin() { var se = sel && find(sel); if (se && se.near && !se.near.pin) { delete se.near; delete se.__w0; } if (!pending) pending = snap(); }
  function commit() { if (!pending) return; var now = snap(); if (now !== pending) { undo.push(pending); if (undo.length > 150) undo.shift(); redo = []; status('Unsaved changes'); } pending = null; SL.mark(); keepDraft(); }
  // unsaved work survives any reload (including the dev server's auto refresh): a draft is kept in this browser until you Save or Reset
  var DRAFT = 'sl-edit-draft';
  function savedLists() { try { var o = JSON.parse(SL.saved); return JSON.stringify({ desktop: o.desktop, mobile: o.mobile }); } catch (e) { return ''; } }
  function keepDraft() { try { var now = snap(); if (now === savedLists()) localStorage.removeItem(DRAFT); else localStorage.setItem(DRAFT, JSON.stringify({ at: Date.now(), lists: now, base: savedLists() })); } catch (e) {} }
  // three-way merge by element id: your unsaved edits win, but anything the file gained or changed since (e.g. added by
  // someone else while this tab was open) is kept rather than overwritten
  function mergeDraft(base, draft, file) {
    var out = {};
    ['desktop', 'mobile'].forEach(function (m) {
      var B = {}, F = {}, seen = {}, list = [];
      (base[m] || []).forEach(function (e) { B[e.id] = JSON.stringify(e); });
      (file[m] || []).forEach(function (e) { F[e.id] = e; });
      (draft[m] || []).forEach(function (e) {
        seen[e.id] = 1; var same = B[e.id] === JSON.stringify(e);
        if (same && F[e.id]) list.push(F[e.id]);   // you didn't touch it: take the file's version
        else if (same && !F[e.id]) return;          // you didn't touch it and the file removed it
        else list.push(e);                          // your edit
      });
      (file[m] || []).forEach(function (e) { if (!seen[e.id] && !(e.id in B)) list.push(e); }); // new in the file
      out[m] = list;
    });
    return out;
  }
  function dropDraft() { try { localStorage.removeItem(DRAFT); } catch (e) {} }
  function restore(s) { var o = JSON.parse(s); SL.cfg.desktop = o.desktop; SL.cfg.mobile = o.mobile; if (sel && !find(sel)) sel = null; SL.render(); fill(); keepDraft(); }
  function doUndo() { if (!undo.length) return; redo.push(snap()); restore(undo.pop()); status('Undo'); }
  function doRedo() { if (!redo.length) return; undo.push(snap()); restore(redo.pop()); status('Redo'); }
  function change(fn, rerender) { begin(); fn(); var pe = find(sel); if (pe && pe.near && pe.near.pin) SL.pinFrom(pe); if (pe && !(pe.near && pe.near.pin)) SL.anchorFrom(pe); if (rerender) SL.render(); else { var e = find(sel); if (e) SL.apply(e); } commit(); fill(); }

  function start() {
    SL.editing = true; SL.mode = innerWidth < 768 ? 'mobile' : 'desktop';
    if (!SL.cfg.mobile) SL.cfg.mobile = JSON.parse(JSON.stringify(SL.cfg.desktop));
    restored = null;
    try {
      var dr = JSON.parse(localStorage.getItem(DRAFT) || 'null');
      if (dr && dr.lists && dr.lists !== savedLists()) {
        var o = JSON.parse(dr.lists);
        if (dr.base && dr.base !== savedLists()) o = mergeDraft(JSON.parse(dr.base), o, JSON.parse(savedLists()));
        else if (!dr.base) o = mergeDraft({ desktop: [], mobile: [] }, o, JSON.parse(savedLists())); // old-style draft: keep anything new in the file
        SL.cfg.desktop = o.desktop; SL.cfg.mobile = o.mobile; restored = new Date(dr.at);
      }
    } catch (e) {}
    document.documentElement.setAttribute('data-sl-edit', '');
    var st = document.createElement('style');
    st.textContent = 'html[data-sl-edit] body{pointer-events:none}html[data-sl-edit] [data-sl-layer]{pointer-events:none}html[data-sl-edit] [data-sl-panel]{pointer-events:auto}' +
      'html[data-sl-edit] [data-sl-el]{pointer-events:auto!important;cursor:move;outline:1px dashed #ab6a55;outline-offset:0;user-select:none;-webkit-user-select:none;touch-action:none}' +
      'html[data-sl-edit] [data-sl-in]{translate:none!important}' +
      'html[data-sl-edit] [data-sl-hidden]{display:block!important}html[data-sl-edit] [data-sl-hidden]>[data-sl-in]{opacity:.18!important}' +
      'html[data-sl-edit] [data-sl-hidden]{outline-style:dotted}' +
      'html[data-sl-edit] [data-sl-hit]{outline:2px solid #d0342c!important}' +
      'html[data-sl-edit] [data-sl-sel]{outline:1.5px solid #2f6fdc!important;z-index:2147483000!important}' +
      '[data-sl-h]{position:absolute;width:9px;height:9px;margin:-4.5px 0 0 -4.5px;background:#fff;border:1.5px solid #2f6fdc;box-sizing:border-box;z-index:5;pointer-events:auto}' +
      '[data-sl-h="rot"]{border-radius:50%;cursor:grab}[data-sl-rotline]{position:absolute;left:50%;bottom:100%;width:0;height:22px;border-left:1.5px solid #2f6fdc;pointer-events:none}' +
      '[data-sl-panel] input[type=number]{width:100%;min-width:0;box-sizing:border-box;padding:5px 6px;border:1.5px solid #1f2b33;background:#fff;color:#1f2b33;font:13px Archivo,sans-serif}' +
      '[data-sl-panel] button{cursor:pointer;padding:7px 9px;border:1.5px solid #1f2b33;background:none;color:#1f2b33;' + M + '}' +
      '[data-sl-panel] button:hover{background:#efe7dc}[data-sl-panel] button[data-on]{background:#1f2b33;color:#f7f3ed}' +
      '[data-sl-lock]{position:absolute;right:-11px;top:-11px;width:22px;height:22px;display:flex;align-items:center;justify-content:center;background:#1f2b33;color:#f7f3ed;border-radius:50%;z-index:6;pointer-events:none}' +
      'html[data-sl-edit] [data-sl-group]{outline:1.5px dashed #2f6fdc!important;outline-offset:3px}' +
      'html[data-sl-edit] [data-sl-group] [data-vkey]{outline:1px dotted rgba(47,111,220,.55);cursor:move}' +
      'html[data-sl-edit] [data-sl-group] [data-vkey][data-sl-isel]{outline:1.5px solid #2f6fdc!important;outline-offset:1px}' +
      'html:not([data-sl-edit]) [data-sl-h],html:not([data-sl-edit]) [data-sl-rotline],html:not([data-sl-edit]) [data-sl-lock]{display:none!important}';
    document.head.appendChild(st);
    SL.render(); buildPanel();
    document.addEventListener('sl:render', function () { if (sel && nodeOf(sel)) decorate(nodeOf(sel)); });
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('click', function (ev) { if (ev.target.closest && ev.target.closest('[data-sl-el]') && !ev.target.closest('[data-sl-panel]')) { ev.preventDefault(); ev.stopPropagation(); } }, true);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('dblclick', onDbl, true);
    addEventListener('beforeunload', function (ev) { if (snap() !== savedSnap()) { ev.preventDefault(); ev.returnValue = ''; } });
  }
  function savedSnap() { var o = JSON.parse(SL.saved); return JSON.stringify({ desktop: o.desktop, mobile: o.mobile }); }

  // ---- selection + handles ----
  var HANDLES = [['nw', 0, 0, 'nwse'], ['n', 50, 0, 'ns'], ['ne', 100, 0, 'nesw'], ['e', 100, 50, 'ew'], ['se', 100, 100, 'nwse'], ['s', 50, 100, 'ns'], ['sw', 0, 100, 'nesw'], ['w', 0, 50, 'ew']];
  function clearDeco() { document.querySelectorAll('[data-sl-sel]').forEach(function (n) { n.removeAttribute('data-sl-sel'); n.querySelectorAll(':scope > [data-sl-h], :scope > [data-sl-rotline], :scope > [data-sl-lock]').forEach(function (h) { h.remove(); }); }); }
  // ---- pick the smallest element under the pointer, so nothing is unreachable behind big ones ----
  function pickAt(x, y, fallback) {
    var hits = [], seen = {};
    document.elementsFromPoint(x, y).forEach(function (n) { var el = n.closest && n.closest('[data-sl-el]'); if (el && !seen[el.getAttribute('data-sl-id')]) { seen[el.getAttribute('data-sl-id')] = 1; hits.push(el); } });
    if (!hits.length) return fallback;
    hits.sort(function (a, b) { var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return ra.width * ra.height - rb.width * rb.height; });
    return hits[0];
  }
  // ---- vignette groups: double click enters, Escape or clicking outside leaves ----
  var group = null, isel = null;
  function gEl() { return group && nodeOf(group); }
  function enterGroup(id) { leaveGroup(true); group = id; isel = null; var n = gEl(); if (n) n.setAttribute('data-sl-group', ''); clearDeco(); fill(); status('Inside the group. Click an item to select it, drag to move, + / - to resize, Delete to remove. Escape leaves.'); }
  function leaveGroup(quiet) { var n = gEl(); if (n) { n.removeAttribute('data-sl-group'); n.querySelectorAll('[data-sl-isel]').forEach(function (x) { x.removeAttribute('data-sl-isel'); }); } var was = group; group = null; isel = null; if (!quiet && was) { select(was); status('Left the group.'); } }
  function hiInner() { var n = gEl(); if (!n) return; n.setAttribute('data-sl-group', ''); n.querySelectorAll('[data-sl-isel]').forEach(function (x) { x.removeAttribute('data-sl-isel'); }); if (isel) { var t = n.querySelector('[data-vkey="' + isel + '"]'); if (t) t.setAttribute('data-sl-isel', ''); } }
  function ovOf(e, k) { e.vig = e.vig || {}; e.vig.ov = e.vig.ov || {}; return (e.vig.ov[k] = e.vig.ov[k] || {}); }
  function innerName(k) { return k === 'h' ? 'Hero object' : k === 'h0' ? 'Satellite 1' : k === 'h1' ? 'Satellite 2' : k === 'd' ? 'Dust cloud' : k[0] === 'r' ? 'Rock ' + (+k.slice(1) + 1) : k[0] === 's' ? 'Sparkle ' + (+k.slice(1) + 1) : k; }
  function innerChange(fn) { var e = find(group); if (!e || !isel) return; begin(); fn(ovOf(e, isel), e); SL.apply(e); commit(); hiInner(); fill(); }
  function onDbl(ev) {
    if (previewing) return;
    if (ev.target.closest && ev.target.closest('[data-sl-panel]')) return;
    var el = pickAt(ev.clientX, ev.clientY, null); if (!el) return;
    var e = find(el.getAttribute('data-sl-id')); if (!e || asset(e).kind !== 'vignette') return;
    ev.preventDefault(); ev.stopPropagation(); enterGroup(e.id);
  }
  function onGroupDown(ev) {
    var g = gEl(); if (!g) return false;
    if (!g.contains(ev.target)) { leaveGroup(true); return false; }
    var t = ev.target.closest('[data-vkey]'); ev.preventDefault(); ev.stopPropagation();
    if (!t) { isel = null; hiInner(); fill(); return true; }
    isel = t.getAttribute('data-vkey'); hiInner(); fill();
    var e = find(group), o = ovOf(e, isel), bw = g.offsetWidth || 1, sx = ev.clientX, sy = ev.clientY, dx0 = o.dx || 0, dy0 = o.dy || 0;
    begin();
    var mv = function (m) { o.dx = r2(dx0 + (m.clientX - sx) / bw * 100); o.dy = r2(dy0 + (m.clientY - sy) / bw * 100); SL.apply(e); hiInner(); };
    var up = function () { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); commit(); fill(); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
    return true;
  }
  function decorate(n) {
    clearDeco(); n.setAttribute('data-sl-sel', '');
    var e = find(sel), fx = e && isFixed(e);
    HANDLES.forEach(function (p) { var h = document.createElement('span'); h.setAttribute('data-sl-h', p[0]); h.style.left = p[1] + '%'; h.style.top = p[2] + '%'; h.style.cursor = p[3] + '-resize'; n.appendChild(h); });
    if (fx) { var lk = document.createElement('span'); lk.setAttribute('data-sl-h', 'lock'); lk.setAttribute('data-sl-lock', ''); lk.removeAttribute('data-sl-h'); lk.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>'; n.appendChild(lk); }
    if (!fx) { var l = document.createElement('span'); l.setAttribute('data-sl-rotline', ''); n.appendChild(l); var r = document.createElement('span'); r.setAttribute('data-sl-h', 'rot'); r.style.left = '50%'; r.style.top = 'calc(0% - 26px)'; n.appendChild(r); }
    clampHandles(n);
  }
  function select(id) { clearDeco(); sel = id; var n = id && nodeOf(id); if (n) decorate(n); fill(); }
  // handles that would sit off the side of the window (full-width elements) are pulled back in so you can grab them
  function clampHandles(n) {
    if (!n) return;
    n.querySelectorAll('[data-sl-h]').forEach(function (h) {
      h.style.translate = ''; var r = h.getBoundingClientRect(), dx = 0, edgeR = document.documentElement.clientWidth - 6;
      if (r.right > edgeR) dx = edgeR - r.right; else if (r.left < 6) dx = 6 - r.left;
      if (dx) h.style.translate = Math.round(dx) + 'px 0';
    });
  }
  addEventListener('resize', function () { if (sel) clampHandles(nodeOf(sel)); });

  // centre of an element in page px + its size in px (unrotated)
  function geo(e) {
    var H = hostRect(e); if (!H) return null;
    var wpx = e.w / 100 * H.width, hpx = hOf(e) / 100 * H.width;
    if (isFixed(e)) { var n = nodeOf(e.id), r = n.getBoundingClientRect(); return { H: H, cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: wpx, h: hpx }; }
    var cy = H.top + e.y / 100 * H.height; if (e.anchor === 'bottom') cy -= hpx / 2;
    return { H: H, cx: H.left + e.x / 100 * H.width, cy: cy, w: wpx, h: hpx };
  }
  function setGeo(e, g, cx, cy, w, h) {
    var H = g.H;
    if (SL.fillMode(asset(e), e)) e.fill = false;
    e.w = r2(Math.max(1, w) / H.width * 100); e.h = r2(Math.max(1, h) / H.width * 100);
    e.x = r2((cx - H.left) / H.width * 100);
    if (isFixed(e)) return;
    var y = cy; if (e.anchor === 'bottom') y += Math.max(1, h) / 2;
    e.y = r2((y - H.top) / H.height * 100);
    if (/^(backdrop|stars|field)$/.test(asset(e).kind) && !e.area) { e.area = {}; delete e.near; delete e.anchor; delete e.ay; } // backdrops and star / asteroid fields own a stretch of their section: switch on first move
    if (e.near && e.near.pin) SL.pinFrom(e); // pinned: store the move as an offset from what it's pinned to
    if (e.area) SL.areaFrom(e, true);         // backdrop area: store the new rectangle of its section (tied to content on release)
    else if (!e.near) delete e.ay;            // free while dragging; tied to the nearest content on release
  }

  function onDown(ev) {
    if (previewing || ev.button !== 0 || (ev.target.closest && ev.target.closest('[data-sl-panel]'))) return;
    if (group && onGroupDown(ev)) return;
    var hd = ev.target.closest && ev.target.closest('[data-sl-h]');
    if (!hd && sel) { var sn = nodeOf(sel); if (sn) sn.querySelectorAll('[data-sl-h]').forEach(function (h) { var hr = h.getBoundingClientRect(), pad = 4; if (!hd && ev.clientX >= hr.left - pad && ev.clientX <= hr.right + pad && ev.clientY >= hr.top - pad && ev.clientY <= hr.bottom + pad) hd = h; }); }
    var el = hd ? hd.closest('[data-sl-el]') : ev.target.closest && ev.target.closest('[data-sl-el]');
    if (!el) return;
    if (!hd) el = pickAt(ev.clientX, ev.clientY, el);
    ev.preventDefault(); ev.stopPropagation();
    var id = el.getAttribute('data-sl-id');
    if (id !== sel) select(id);
    var e = find(sel); if (!e) return;
    var g = geo(e); if (!g) return;
    var kind = hd ? hd.getAttribute('data-sl-h') : 'move', fx = isFixed(e);
    var sx = ev.clientX, sy = ev.clientY, th = (e.rotate || 0) * Math.PI / 180, c = Math.cos(th), s = Math.sin(th);
    begin();
    var mv = function (m) {
      var dx = m.clientX - sx, dy = m.clientY - sy;
      if (kind === 'move') { setGeo(e, g, g.cx + dx, fx ? g.cy : g.cy + dy, g.w, g.h); }
      else if (kind === 'rot') {
        var a = Math.atan2(m.clientY - g.cy, m.clientX - g.cx) * 180 / Math.PI + 90;
        if (m.shiftKey) a = Math.round(a / 15) * 15;
        a = ((a + 540) % 360) - 180; e.rotate = Math.round(a * 10) / 10;
      } else {
        var lx = dx * c + dy * s, ly = -dx * s + dy * c;
        var sxn = /e/.test(kind) ? 1 : /w/.test(kind) ? -1 : 0, syn = /s/.test(kind) ? 1 : /n/.test(kind) ? -1 : 0;
        var nw = g.w + sxn * lx, nh = g.h + syn * ly;
        if (sxn && syn && m.shiftKey) { var k = ((g.w + sxn * lx) / g.w + (g.h + syn * ly) / g.h) / 2; nw = g.w * k; nh = g.h * k; }
        nw = Math.max(2, nw); nh = Math.max(2, nh);
        var ox = sxn * (nw - g.w) / 2, oy = syn * (nh - g.h) / 2;
        var ccx = g.cx + ox * c - oy * s, ccy = g.cy + ox * s + oy * c;
        setGeo(e, g, ccx, fx ? g.cy : ccy, nw, nh);
      }
      SL.apply(e); fill(true);
    };
    var up = function () { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); if (!(e.near && e.near.pin)) { SL.anchorFrom(e); SL.apply(e); } commit(); fill(); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }

  var SEC_NAMES = { top: 'Hero', about: 'About', toolbox: 'Logo strip', work: 'Work', desk: 'IT desk dashboard', path: 'Path', contact: 'Contact', footer: 'Footer (clips anything outside it)',
    'page-about': 'About me page', 'page-story': 'How I got here page', 'page-twist': 'Plot twist page', 'case-network': 'Case: network', 'case-threatintel': 'Case: threat intel', 'case-access': 'Case: access', 'case-awareness': 'Case: awareness', 'case-migration': 'Case: migration' };
  function moveToSection(k) {
    var e = find(sel); if (!e || e.section === k) return;
    var n = nodeOf(e.id), to = document.querySelector(SL.hosts[k]); if (!n || !to) return;
    var r = n.getBoundingClientRect(), g = geo(e), H = to.getBoundingClientRect();
    var w = g ? g.w : r.width, h = g ? g.h : r.height, cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    change(function () {
      e.section = k;
      e.x = r2((cx - H.left) / H.width * 100); e.w = r2(w / H.width * 100); e.h = r2(h / H.width * 100);
      e.y = r2(((e.anchor === 'bottom' ? cy + h / 2 : cy) - H.top) / H.height * 100);
      if (e.near && e.near.pin) { if (k !== 'top' && e.near.pin.to && e.near.pin.to !== 'edge') e.near.pin = { to: 'edge', by: 'page', at: [0.5, 0.5], s: 1 }; if (!e.near.pin.to) delete e.near; }
    }, true);
    select(e.id); status('Moved to ' + (SEC_NAMES[k] || k) + '. Save to keep it.');
  }
  function fillSections(e) {
    var keys = Object.keys(SL.hosts).filter(function (k) { return k !== 'name' && k !== 'orbit' && (k === e.section || document.querySelector(SL.hosts[k])); });
    var key = keys.join('|') + '#' + e.section;
    if (ui.secSel.__key !== key) { ui.secSel.__key = key; ui.secSel.innerHTML = keys.map(function (k) { return '<option value="' + k + '">' + (SEC_NAMES[k] || k) + '</option>'; }).join(''); }
    ui.secSel.value = e.section;
  }
  function scaleSel(k) {
    var e = find(sel); if (!e || isFixed(e)) return;
    change(function () {
      if (SL.fillMode(asset(e), e)) e.fill = false;
      var h = hOf(e), cy = e.anchor === 'bottom' ? null : e.y;
      if (e.anchor === 'bottom') { var H = hostRect(e); if (H) e.y = r2(e.y - (h * (1 - k) / 2) * H.width / H.height); } // keep the centre where it is
      e.w = r2(e.w * k); e.h = r2(h * k); if (cy != null) e.y = cy;
    });
  }
  function onKey(ev) {
    var tag = (ev.target.tagName || '');
    if (previewing) { if (ev.key === 'Escape' || ev.key === 'p' || ev.key === 'P') { if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return; ev.preventDefault(); setPreview(false); } return; }
    if ((ev.key === 'p' || ev.key === 'P') && !ev.metaKey && !ev.ctrlKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) { ev.preventDefault(); setPreview(true); return; }
    var mod = ev.metaKey || ev.ctrlKey;
    if (mod && (ev.key === 'z' || ev.key === 'Z')) { if (/^(INPUT|TEXTAREA)$/.test(tag)) ev.target.blur(); ev.preventDefault(); if (ev.shiftKey) doRedo(); else doUndo(); return; }
    if (mod && (ev.key === 'y')) { ev.preventDefault(); doRedo(); return; }
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
    if (group) {
      var gk = ev.key;
      if (gk === 'Escape') { ev.preventDefault(); if (isel) { isel = null; hiInner(); fill(); } else leaveGroup(); return; }
      if (!isel) return;
      var gs = ev.shiftKey ? 2 : 0.5;
      if (/^Arrow/.test(gk)) { ev.preventDefault(); innerChange(function (o) { if (gk === 'ArrowLeft') o.dx = r2((o.dx || 0) - gs); if (gk === 'ArrowRight') o.dx = r2((o.dx || 0) + gs); if (gk === 'ArrowUp') o.dy = r2((o.dy || 0) - gs); if (gk === 'ArrowDown') o.dy = r2((o.dy || 0) + gs); }); }
      else if (gk === '+' || gk === '=') { ev.preventDefault(); innerChange(function (o) { o.s = r2(Math.min(4, (o.s || 1) * 1.1)); }); }
      else if (gk === '-' || gk === '_') { ev.preventDefault(); innerChange(function (o) { o.s = r2(Math.max(0.2, (o.s || 1) / 1.1)); }); }
      else if (gk === 'Delete' || gk === 'Backspace') { ev.preventDefault(); innerChange(function (o) { o.del = true; }); isel = null; hiInner(); fill(); }
      return;
    }
    if (!sel) return;
    var e = find(sel); if (!e) return;
    var st = ev.shiftKey ? 2 : 0.5, k = ev.key, fx = isFixed(e);
    if (/^Arrow/.test(k)) {
      ev.preventDefault();
      change(function () {
        if (k === 'ArrowLeft') e.x = r2((e.x == null ? 50 : e.x) - st);
        if (k === 'ArrowRight') e.x = r2((e.x == null ? 50 : e.x) + st);
        if (!fx && k === 'ArrowUp') e.y = r2(e.y - st);
        if (!fx && k === 'ArrowDown') e.y = r2(e.y + st);
      });
    } else if ((k === '-' || k === '_') && !ev.metaKey && !ev.ctrlKey) { ev.preventDefault(); scaleSel(1 / 1.1); }
    else if ((k === '=' || k === '+') && !ev.metaKey && !ev.ctrlKey) { ev.preventDefault(); scaleSel(1.1); }
    else if (k === 'Escape') select(null);
    else if ((k === 'Delete' || k === 'Backspace') && !fx) { ev.preventDefault(); del(); }
  }

  // ---- actions ----
  function zSorted() { return list().slice().sort(function (a, b) { return (a.z || 0) - (b.z || 0); }); }
  function restack(e, dir) {
    var same = zSorted().filter(function (x) { return x.section === e.section; });
    var i = same.indexOf(e), j = i + dir; if (j < 0 || j >= same.length) return;
    same.splice(i, 1); same.splice(j, 0, e);
    same.forEach(function (x, n) { x.z = n; });
    same.forEach(function (x) { SL.apply(x); });
  }
  function del() { var e = find(sel); if (!e || isFixed(e)) return; begin(); list().splice(list().indexOf(e), 1); sel = null; SL.render(); commit(); fill(); }
  function dup() {
    var e = find(sel); if (!e || isFixed(e)) return;
    begin(); var c = JSON.parse(JSON.stringify(e)); c.id = e.asset + '-' + Date.now().toString(36); c.x = r2(e.x + 2); c.y = r2(e.y + 2);
    c.z = Math.max.apply(null, list().map(function (x) { return x.z || 0; })) + 1;
    list().push(c); SL.render(); commit(); select(c.id); status('Duplicated');
  }
  function sectionInView() {
    var best = 'top', bd = 1e9, cy = innerHeight / 2;
    Object.keys(SL.hosts).filter(function (k) { return k !== 'name' && k !== 'orbit'; }).forEach(function (k) { var h = document.querySelector(SL.hosts[k]); if (!h) return; var r = h.getBoundingClientRect(); var d = r.top <= cy && r.bottom >= cy ? 0 : Math.min(Math.abs(r.top - cy), Math.abs(r.bottom - cy)); if (d < bd) { bd = d; best = k; } });
    return best;
  }
  function addEl(key) {
    var a = SL.cfg.assets[key], k = sectionInView();
    if (k === 'footer') { var alt = Object.keys(SL.hosts).filter(function (q) { var hq = document.querySelector(SL.hosts[q]); if (!hq || q === 'footer' || q === 'name' || q === 'orbit') return false; var rq = hq.getBoundingClientRect(); return rq.bottom > innerHeight * 0.2 && rq.top < innerHeight * 0.8; })[0]; if (alt) k = alt; }
    var h = document.querySelector(SL.hosts[k]), r = h.getBoundingClientRect();
    var y = Math.max(2, Math.min(98, (innerHeight / 2 - r.top) / r.height * 100)), w = a.kind === 'backdrop' ? 100 : a.kind === 'stars' ? 40 : 8;
    var e = { id: key + '-' + Date.now().toString(36), asset: key, section: k, x: 50, y: r2(y), w: w, h: r2(w * (a.aspect || 1)), opacity: a.kind === 'img' ? 0.6 : a.kind === 'backdrop' ? 0.5 : 1, rotate: 0, z: Math.max.apply(null, list().map(function (x) { return x.z || 0; }).concat([0])) + 1, anim: true };
    if (a.kind === 'backdrop') { e.area = { l: 0, t: 0, r: 1, b: 1 }; SL.areaFrom(e); } // backdrops own an area of their section at every screen size
    begin(); list().push(e); SL.render(); commit(); select(e.id); status('Added to ' + k + '. Drag it into place.');
  }

  // ---- panel ----
  function el(tag, css, html) { var n = document.createElement(tag); if (css) n.style.cssText = css; if (html != null) n.innerHTML = html; return n; }
  function btn(label, fn, css) { var b = el('button', css || '', label); b.type = 'button'; b.onclick = fn; return b; }
  var FIELDS = [['x', 'X %'], ['y', 'Y %'], ['w', 'W %'], ['h', 'H %'], ['rotate', 'Rotate °'], ['opacity', 'Opacity']];
  function buildPanel() {
    panel = el('div', 'position:fixed;left:16px;bottom:16px;z-index:9999;width:310px;max-height:calc(100vh - 32px);overflow:auto;display:flex;flex-direction:column;gap:12px;padding:14px 16px 16px;background:#f7f3ed;color:#1f2b33;border:1.5px solid #1f2b33;box-shadow:5px 5px 0 #1f2b33;font-family:Archivo,sans-serif');
    panel.setAttribute('data-sl-panel', ''); panel.setAttribute('role', 'region'); panel.setAttribute('aria-label', 'Space element editor');
    var head = el('div', 'display:flex;justify-content:space-between;align-items:center;gap:8px;cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none', '<span style="' + M + ';font-weight:600;color:#ab6a55">⠿ Space edit</span>');
    head.title = 'Drag to move the panel';
    var seg = el('div', 'display:flex;align-items:center');
    ['desktop', 'mobile'].forEach(function (m) { var b = btn(m === 'desktop' ? 'Desktop' : 'Mobile', function () { SL.mode = m; sel = null; SL.render(); syncSeg(); fill(); status(m === 'mobile' ? 'Editing the layout for screens under 768px. Narrow the window to preview it.' : 'Editing the desktop layout.'); }); b.setAttribute('data-mode', m); seg.appendChild(b); });
    var mini = btn('–', function () { setMini(!panel.hasAttribute('data-mini')); }, 'margin-left:8px;padding:4px 9px');
    mini.setAttribute('aria-label', 'Collapse panel'); mini.title = 'Collapse / expand';
    var pv = btn('Preview', function () { setPreview(true); }, 'margin-left:8px;padding:4px 9px');
    pv.title = 'Preview the page without edit outlines (P)';
    seg.appendChild(pv); seg.appendChild(mini);
    head.appendChild(seg); panel.appendChild(head);
    // movable + collapsible; position and collapsed state are remembered in this browser only
    function setMini(on) {
      if (on) panel.setAttribute('data-mini', ''); else panel.removeAttribute('data-mini');
      [].forEach.call(panel.children, function (c) { if (c !== head) c.style.display = on ? 'none' : ''; });
      mini.textContent = on ? '+' : '–'; mini.setAttribute('aria-label', on ? 'Expand panel' : 'Collapse panel');
      keepIn(); remember();
    }
    function keepIn() {
      if (panel.style.left === '' || panel.style.top === '') return;
      var r = panel.getBoundingClientRect();
      panel.style.left = Math.max(0, Math.min(innerWidth - r.width, parseFloat(panel.style.left))) + 'px';
      panel.style.top = Math.max(0, Math.min(innerHeight - Math.min(r.height, 40), parseFloat(panel.style.top))) + 'px';
    }
    function remember() { try { localStorage.setItem('sl-edit-panel', JSON.stringify({ l: panel.style.left, t: panel.style.top, mini: panel.hasAttribute('data-mini') })); } catch (e) {} }
    head.addEventListener('pointerdown', function (ev) {
      if (ev.button !== 0 || ev.target.closest('button')) return;
      ev.preventDefault();
      var r = panel.getBoundingClientRect(), ox = ev.clientX - r.left, oy = ev.clientY - r.top;
      panel.style.bottom = 'auto'; panel.style.left = r.left + 'px'; panel.style.top = r.top + 'px'; head.style.cursor = 'grabbing';
      var mv = function (m) { panel.style.left = (m.clientX - ox) + 'px'; panel.style.top = (m.clientY - oy) + 'px'; keepIn(); };
      var up = function () { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); head.style.cursor = 'grab'; remember(); };
      addEventListener('pointermove', mv); addEventListener('pointerup', up);
    });
    addEventListener('resize', keepIn);
    setTimeout(function () {
      var saved = null; try { saved = JSON.parse(localStorage.getItem('sl-edit-panel') || 'null'); } catch (e) {}
      if (saved && saved.l && saved.t) { panel.style.bottom = 'auto'; panel.style.left = saved.l; panel.style.top = saved.t; }
      if (saved && saved.mini) setMini(true); else keepIn();
    }, 0);

    ui.layers = el('select', 'width:100%;padding:6px;border:1.5px solid #1f2b33;background:#fff;color:#1f2b33;font-family:Archivo,sans-serif;font-size:13px');
    ui.layers.setAttribute('aria-label', 'Select any space element');
    ui.layers.onchange = function () { if (group) leaveGroup(true); select(ui.layers.value || null); };
    panel.appendChild(ui.layers);
    ui.grp = el('div', 'display:none;flex-direction:column;gap:8px;padding:10px;border:1.5px dashed #2f6fdc');
    ui.gname = el('span', M + ';color:#2f6fdc;line-height:1.5');
    ui.grp.appendChild(ui.gname);
    var gl = el('label', 'display:flex;align-items:center;gap:8px', '<span style="' + M + '">Size</span>');
    ui.gsize = el('input'); ui.gsize.type = 'range'; ui.gsize.min = '0.2'; ui.gsize.max = '4'; ui.gsize.step = '0.05'; ui.gsize.style.flex = '1';
    ui.gsize.addEventListener('pointerdown', function () { begin(); });
    ui.gsize.addEventListener('input', function () { var e = find(group); if (!e || !isel) return; ovOf(e, isel).s = +ui.gsize.value; SL.apply(e); hiInner(); });
    ui.gsize.addEventListener('change', function () { commit(); });
    gl.appendChild(ui.gsize); ui.grp.appendChild(gl);
    var gr = el('div', 'display:flex;flex-wrap:wrap;gap:6px');
    ui.gdel = btn('Delete item', function () { innerChange(function (o) { o.del = true; }); isel = null; hiInner(); fill(); }, 'border-color:#ab6a55;color:#ab6a55');
    ui.greset = btn('Reset item', function () { var e = find(group); if (!e || !isel) return; begin(); delete e.vig.ov[isel]; SL.apply(e); commit(); hiInner(); fill(); });
    ui.grestore = btn('Restore deleted', function () { var e = find(group); if (!e || !e.vig || !e.vig.ov) return; begin(); Object.keys(e.vig.ov).forEach(function (k) { delete e.vig.ov[k].del; }); SL.apply(e); commit(); hiInner(); fill(); });
    [ui.gdel, ui.greset, ui.grestore, btn('Leave group', function () { leaveGroup(); })].forEach(function (b) { gr.appendChild(b); });
    ui.grp.appendChild(gr);
    panel.appendChild(ui.grp);
    ui.sel = el('div', 'display:flex;flex-direction:column;gap:10px;padding-top:10px;border-top:1px solid #c4b8ac');
    ui.name = el('span', M + ';color:#4a4b4f;line-height:1.5');
    ui.sel.appendChild(ui.name);
    var grid = el('div', 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px');
    FIELDS.forEach(function (f) {
      var lab = el('label', 'display:flex;flex-direction:column;gap:3px', '<span style="' + M + '">' + f[1] + '</span>');
      var inp = el('input'); inp.type = 'number'; inp.step = f[0] === 'opacity' ? '0.05' : '0.1'; if (f[0] === 'opacity') { inp.min = '0'; inp.max = '1'; }
      inp.addEventListener('focus', function () { begin(); });
      inp.addEventListener('input', function () { var e = find(sel); if (!e || inp.value === '') return; var v = +inp.value; if (f[0] === 'opacity') v = Math.max(0, Math.min(1, v)); if ((f[0] === 'w' || f[0] === 'h') && v < 0.05) v = 0.05; if (f[0] !== 'opacity' && SL.fillMode(asset(e), e)) e.fill = false; if (f[0] === 'h' && e.h == null) e.h = hOf(e); e[f[0]] = v; if (e.near && e.near.pin && f[0] !== 'opacity' && f[0] !== 'rotate') SL.pinFrom(e); if (!(e.near && e.near.pin) && f[0] !== 'opacity' && f[0] !== 'rotate') SL.anchorFrom(e); SL.apply(e); });
      inp.addEventListener('change', function () { commit(); fill(); });
      inp.addEventListener('blur', function () { commit(); });
      ui[f[0]] = inp; lab.appendChild(inp); grid.appendChild(lab);
    });
    ui.sel.appendChild(grid);
    // field settings (only shown when a field is selected); one panel per field engine
    var FF = [['asteroids', 'Asteroids', 1, 0, 200], ['dots', 'Dots', 1, 0, 600], ['minSize', 'Min size px', 1, 4, 200], ['maxSize', 'Max size px', 1, 4, 300], ['opBack', 'Back opacity', 0.05, 0, 1], ['opMid', 'Mid opacity', 0.05, 0, 1], ['opFront', 'Front opacity', 0.05, 0, 1], ['speed', 'Drift px/s', 0.5, 0, 80], ['dir', 'Direction °', 5, -180, 360], ['lane', 'Lane px', 5, 0, 600]];
    var SF = [['stars', 'Dot stars', 1, 0, null], ['sparkles', 'Sparkles', 1, 0, null], ['dust', 'Dust', 1, 0, null], ['constellations', 'Constellations', 1, 0, null], ['constSize', 'Constellation px', 5, 60, 600], ['satellites', 'Satellites', 1, 0, null], ['satSize', 'Satellite px', 1, 16, 160], ['speed', 'Drift px/s', 0.5, 0, 40], ['dir', 'Direction °', 5, -180, 360], ['opStars', 'Star opacity', 0.05, 0, 1], ['opSparkles', 'Sparkle opacity', 0.05, 0, 1], ['opDust', 'Dust opacity', 0.05, 0, 1], ['opConst', 'Const. opacity', 0.05, 0, 1], ['opSat', 'Satellite opacity', 0.05, 0, 1], ['clear', 'Fade behind text (1/0)', 1, 0, 1], ['asteroids', 'Asteroids', 1, 0, null], ['astMin', 'Asteroid min px', 1, 4, null], ['astMax', 'Asteroid max px', 1, 4, null], ['opAst', 'Asteroid opacity', 0.05, 0, 1], ['comets', 'Comets / minute', 0.5, 0, null], ['cometSize', 'Comet px', 1, 10, null], ['pace', 'Motion speed ×', 0.1, 0, null]];
    ui.fields = {};
    [['asteroids', 'Asteroid field', FF], ['stars', 'Star field', SF]].forEach(function (P) {
    var box = el('div', 'display:none;flex-direction:column;gap:8px;padding-top:8px;border-top:1px dashed #c4b8ac');
    box.appendChild(el('span', M + ';color:#ab6a55', P[1]));
    var fg = el('div', 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px');
    var ff = {};
    P[2].forEach(function (f) {
      var lab = el('label', 'display:flex;flex-direction:column;gap:3px', '<span style="' + M + '">' + f[1] + '</span>');
      var inp = el('input'); inp.type = 'number'; inp.step = f[2]; inp.min = f[3]; if (f[4] != null) inp.max = f[4];
      inp.addEventListener('focus', function () { begin(); });
      inp.addEventListener('input', function () { var e = find(sel); if (!e || inp.value === '') return; var v = Math.max(f[3], f[4] == null ? +inp.value : Math.min(f[4], +inp.value)); e.field = e.field || {}; e.field[f[0]] = v; if (f[0] === 'minSize' && e.field.maxSize < v) e.field.maxSize = v; if (f[0] === 'maxSize' && e.field.minSize > v) e.field.minSize = v; SL.apply(e); });
      inp.addEventListener('change', function () { commit(); fill(); });
      ff[f[0]] = inp; lab.appendChild(inp); fg.appendChild(lab);
    });
    box.appendChild(fg);
    ui.fillBtns = ui.fillBtns || {};
    ui.fillBtns[P[0]] = btn('Fill section again', function () { var e = find(sel); if (!e) return; change(function () { if (asset(e).kind === 'stars') e.fill = true; else delete e.fill; delete e.near; }); status('Fills its whole section again. Save to keep it.'); });
    box.appendChild(ui.fillBtns[P[0]]);
    box.appendChild(btn('Reshuffle', function () { var e = find(sel); if (!e) return; change(function () { e.field = e.field || {}; e.field.seed = Math.floor(Math.random() * 1e6) + 1; }); status('New layout. Save to keep it.'); }));
    ui.sel.appendChild(box);
    ui.fields[P[0]] = { box: box, ff: ff };
    });
    var row = el('div', 'display:flex;flex-wrap:wrap;gap:6px');
    ui.fwd = btn('Bring forward', function () { var e = find(sel); if (e) change(function () { restack(e, 1); }); });
    ui.back = btn('Send backward', function () { var e = find(sel); if (e) change(function () { restack(e, -1); }); });
    ui.dup = btn('Duplicate', dup);
    ui.hide = btn('Hide', function () { var e = find(sel); if (e) change(function () { e.hidden = !e.hidden; }, true); });
    ui.anim = btn('Animation', function () { var e = find(sel); if (e) change(function () { e.anim = e.anim === false; }, true); });
    ui.del = btn('Delete', del, 'border-color:#ab6a55;color:#ab6a55');
    [ui.fwd, ui.back, ui.dup, ui.hide, ui.anim, ui.del].forEach(function (b) { row.appendChild(b); });
    // section: move the element into another section without it moving on screen
    ui.secRow = el('label', 'display:flex;align-items:center;justify-content:space-between;gap:8px', '<span style="' + M + '">Section</span>');
    ui.secSel = el('select', 'flex:1;max-width:190px;font:inherit;font-size:12px;padding:4px 6px;border:1px solid #c4b8ac;background:#fff;color:#1f2b33');
    ui.secSel.onchange = function () { moveToSection(ui.secSel.value); };
    ui.secRow.appendChild(ui.secSel);
    ui.sel.appendChild(ui.secRow);
    ui.sizeRow = el('div', 'display:flex;align-items:center;gap:6px');
    ui.sizeRow.appendChild(el('span', M, 'Size'));
    ui.smaller = btn('− Smaller', function () { scaleSel(1 / 1.1); }); ui.smaller.title = 'Shrink from the centre (− key)';
    ui.bigger = btn('+ Bigger', function () { scaleSel(1.1); }); ui.bigger.title = 'Grow from the centre (= key)';
    ui.sizeRow.appendChild(ui.smaller); ui.sizeRow.appendChild(ui.bigger);
    ui.sel.appendChild(ui.sizeRow);
    ui.sel.appendChild(row);
    ui.angRow = el('div', 'display:flex;flex-wrap:wrap;align-items:center;gap:8px');
    var al = el('label', 'display:flex;align-items:center;gap:6px', '<span style="' + M + '">Angle</span>');
    ui.angle = el('select', 'font:inherit;font-size:12px;padding:4px 6px;border:1px solid #c4b8ac;background:#fff;color:#1f2b33');
    ['auto', '1', '2', '3', '4'].forEach(function (v) { var o = el('option', '', v === 'auto' ? 'Auto' : 'Angle ' + v); o.value = v; ui.angle.appendChild(o); });
    ui.angle.onchange = function () { var e = find(sel); if (!e) return; var v = ui.angle.value; change(function () { if (v === 'auto') delete e.angle; else e.angle = +v; }); };
    al.appendChild(ui.angle); ui.angRow.appendChild(al);
    ui.wob = btn('Wobble: off', function () { var e = find(sel); if (e) change(function () { e.wobble = !e.wobble; }); });
    ui.angRow.appendChild(ui.wob);
    ui.sel.appendChild(ui.angRow);
    ui.vigRow = el('div', 'display:flex;flex-wrap:wrap;align-items:center;gap:8px');
    var vl = el('label', 'display:flex;align-items:center;gap:6px', '<span style="' + M + '">Hero</span>');
    ui.vhero = el('select', 'font:inherit;font-size:12px;padding:4px 6px;border:1px solid #c4b8ac;background:#fff;color:#1f2b33');
    [['moon', 'Moon'], ['jupiter', 'Jupiter'], ['gas-b', 'Gas planet B'], ['gas-c', 'Gas planet C'], ['ringed', 'Ringed planet'], ['satellite', 'Satellite'], ['mini', 'Mini planet'], ['none', 'None (rocks + dust)']].forEach(function (o) { var op = el('option', '', o[1]); op.value = o[0]; ui.vhero.appendChild(op); });
    ui.vhero.onchange = function () { var e = find(sel); if (!e) return; var v = ui.vhero.value; change(function () { e.vig = e.vig || {}; e.vig.hero = v; delete e.vig.heroSrc; }); };
    vl.appendChild(ui.vhero); ui.vigRow.appendChild(vl);
    ui.vigRow.appendChild(btn('Reshuffle rocks + dust', function () { var e = find(sel); if (!e) return; change(function () { e.vig = e.vig || {}; e.vig.seed = Math.floor(Math.random() * 1e6) + 1; }); status('New layout. Save to keep it.'); }));
    ui.sel.appendChild(ui.vigRow);
    // backdrops: how strongly the cut-out pieces move (0 = still, 1 = default, 2 = twice as much)
    ui.motionRow = el('label', 'display:flex;align-items:center;justify-content:space-between;gap:8px', '<span style="' + M + '">Motion strength</span>');
    ui.motion = el('input', 'flex:1;max-width:150px'); ui.motion.type = 'range'; ui.motion.min = '0'; ui.motion.max = '3'; ui.motion.step = '0.1';
    ui.motionVal = el('span', 'min-width:34px;text-align:right;font-size:12px', '1×');
    ui.motion.addEventListener('pointerdown', function () { begin(); });
    ui.motion.addEventListener('input', function () { var e = find(sel); if (!e) return; if (!pending) begin(); e.motion = +ui.motion.value; ui.motionVal.textContent = ui.motion.value + '×'; SL.apply(e); });
    ui.motion.addEventListener('change', function () { commit(); });
    ui.motionRow.appendChild(ui.motion); ui.motionRow.appendChild(ui.motionVal);
    ui.sel.appendChild(ui.motionRow);
    // pin (hero only): what the element stays attached to, and what its size scales with, at every screen size
    ui.pinRow = el('div', 'display:flex;flex-direction:column;gap:6px;padding:8px;border:1px dashed #c4b8ac');
    var pinSel = function (label, opts) { var l = el('label', 'display:flex;align-items:center;justify-content:space-between;gap:8px', '<span style="' + M + '">' + label + '</span>'); var sl = el('select', 'flex:1;max-width:190px;font:inherit;font-size:12px;padding:4px 6px;border:1px solid #c4b8ac;background:#fff;color:#1f2b33'); opts.forEach(function (o) { var op = el('option', '', o[1]); op.value = o[0]; sl.appendChild(op); }); l.appendChild(sl); ui.pinRow.appendChild(l); return sl; };
    ui.pinTo = pinSel('Pin to', [['none', 'Not pinned (% of section)'], ['edge', 'Nearest section edge'], ['hero', 'Whole hero'], ['photo', 'Photo'], ['gap', 'Gap beside photo'], ['right', 'Comments column'], ['below', 'Under hero (above About)']]);
    ui.pinBy = pinSel('Size follows', [['page', 'Page width'], ['w', 'Pinned area width'], ['h', 'Pinned area height']]);
    ui.pinRow.appendChild(el('span', 'font-size:11px;line-height:1.4;color:#4a4b4f', 'Changing these keeps the element where it is now; it then follows that area on every screen size.'));
    var repin = function () {
      var e = find(sel); if (!e) return; var to = ui.pinTo.value, by = ui.pinBy.value;
      change(function () {
        if (to === 'none') { delete e.near; delete e.__w0; return; }
        e.near = { pin: { to: to, by: by, at: [0.5, 0.5], s: 0.5, ar: r2(hOf(e) / e.w * 100) / 100 } }; // pinFrom (in change) fills at + s from where it is now
      });
      status(to === 'none' ? 'Unpinned: now a % of the section.' : 'Pinned. Save to keep it.');
    };
    ui.pinTo.onchange = repin; ui.pinBy.onchange = repin;
    ui.sel.appendChild(ui.pinRow);
    // backdrop areas: when the area's shape differs from the picture's, which part of the picture to keep
    ui.focusRow = el('label', 'display:flex;align-items:center;justify-content:space-between;gap:8px', '<span style="' + M + '">Keep in view</span>');
    ui.focus = el('select', 'flex:1;max-width:190px;font:inherit;font-size:12px;padding:4px 6px;border:1px solid #c4b8ac;background:#fff;color:#1f2b33');
    [['center', 'Centre of the picture'], ['top', 'Top (sky)'], ['bottom', 'Bottom (ground)'], ['left', 'Left side'], ['right', 'Right side']].forEach(function (o) { var op = el('option', '', o[1]); op.value = o[0]; ui.focus.appendChild(op); });
    ui.focus.onchange = function () { var e = find(sel); if (!e) return; var v = ui.focus.value; change(function () { e.focus = v === 'top' ? [0.5, 0] : v === 'bottom' ? [0.5, 1] : v === 'left' ? [0, 0.5] : v === 'right' ? [1, 0.5] : [0.5, 0.5]; }); };
    ui.focusRow.appendChild(ui.focus);
    ui.sel.appendChild(ui.focusRow);
    ui.sel.appendChild(el('span', 'font-size:11.5px;line-height:1.45;color:#4a4b4f', 'Drag to move. Edge handles: width or height. Corners: both (Shift keeps shape). Top dot: rotate (Shift snaps). Arrows 0.5% (Shift 2%). − / = smaller / bigger. Cmd+Z / Cmd+Shift+Z. Red outline = overlaps text.'));
    panel.appendChild(ui.sel);

    var add = el('div', 'display:flex;gap:6px;padding-top:10px;border-top:1px solid #c4b8ac');
    var pick = el('select', 'flex:1;min-width:0;padding:6px;border:1.5px solid #1f2b33;background:#f7f3ed;color:#1f2b33;font-family:Archivo,sans-serif;font-size:13px');
    Object.keys(SL.cfg.assets).forEach(function (k) { var a = SL.cfg.assets[k]; if (a.kind === 'fixed' || a.kind === 'orbit') return; var o = document.createElement('option'); o.value = k; o.textContent = a.label || k; pick.appendChild(o); });
    add.appendChild(pick); add.appendChild(btn('Add element', function () { addEl(pick.value); }));
    panel.appendChild(add);

    var save = el('div', 'display:flex;flex-direction:column;gap:8px;padding-top:10px;border-top:1px solid #c4b8ac');
    var sr = el('div', 'display:flex;gap:6px;flex-wrap:wrap');
    sr.appendChild(btn('Save', doSave, 'background:#ab6a55;color:#f7f3ed;box-shadow:3px 3px 0 #1f2b33'));
    sr.appendChild(btn('Reset', function () { begin(); var o = JSON.parse(SL.saved); SL.cfg.desktop = o.desktop; SL.cfg.mobile = o.mobile; sel = null; SL.render(); commit(); fill(); dropDraft(); status('Restored the last saved version.'); }));
    sr.appendChild(btn('Undo', doUndo)); sr.appendChild(btn('Redo', doRedo));
    save.appendChild(sr);
    ui.status = el('span', 'font-size:12px;line-height:1.4;color:#4a4b4f', 'Click an element to select it.'); ui.status.setAttribute('role', 'status');
    save.appendChild(ui.status); panel.appendChild(save);
    document.body.appendChild(panel); syncSeg(); fill(); SL.mark();
    if (restored) status('Brought back your unsaved changes from ' + restored.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '. Save to keep them, or Reset to drop them.');
  }
  // preview: the page exactly as visitors see it (no outlines, handles or hidden elements); unsaved edits stay
  function setPreview(on) {
    previewing = on; SL.editing = !on;
    if (on) document.documentElement.removeAttribute('data-sl-edit'); else document.documentElement.setAttribute('data-sl-edit', '');
    panel.style.visibility = on ? 'hidden' : '';
    if (!exitBtn) {
      exitBtn = btn('✕ Exit preview', function () { setPreview(false); }, 'position:fixed;left:16px;bottom:16px;z-index:9999;padding:8px 12px;background:#f7f3ed;box-shadow:3px 3px 0 #1f2b33');
      exitBtn.setAttribute('data-sl-panel', ''); exitBtn.title = 'Back to editing (Esc or P)'; document.body.appendChild(exitBtn);
    }
    exitBtn.style.display = on ? '' : 'none';
    if (!on) SL.mark();
  }
  function syncSeg() { panel.querySelectorAll('[data-mode]').forEach(function (b) { if (b.getAttribute('data-mode') === SL.mode) b.setAttribute('data-on', ''); else b.removeAttribute('data-on'); }); }
  function fillLayers() {
    if (!ui.layers) return;
    var items = list().slice().sort(function (a, b) { return (a.section > b.section ? 1 : a.section < b.section ? -1 : (a.z || 0) - (b.z || 0)); });
    var key = items.map(function (x) { return x.id; }).join('|');
    if (ui.layers.__key !== key) { ui.layers.__key = key; ui.layers.innerHTML = '<option value="">Select an element…</option>' + items.map(function (x) { return '<option value="' + x.id + '">' + x.section + ' · ' + ((asset(x).label || x.asset).replace(/</g, '')) + ' · ' + x.id + (x.hidden ? ' (hidden)' : '') + '</option>'; }).join(''); }
    ui.layers.value = sel || '';
  }
  function fill(live) {
    fillLayers();
    if (sel) clampHandles(nodeOf(sel));
    ui.grp.style.display = group ? 'flex' : 'none';
    if (group) {
      var ge = find(group), o = isel && ge && ge.vig && ge.vig.ov && ge.vig.ov[isel];
      ui.gname.textContent = 'Group: ' + group + (isel ? ' · ' + innerName(isel) : ' · click an item inside');
      ui.gsize.disabled = ui.gdel.disabled = ui.greset.disabled = !isel; ui.gsize.value = (o && o.s) || 1;
      ui.sel.style.display = 'none'; return;
    }
    var e = sel && find(sel);
    ui.sel.style.display = e ? 'flex' : 'none';
    if (!e) return;
    var fx = isFixed(e);
    ui.name.textContent = (asset(e).label || e.asset) + ' · ' + e.section + ' · layer ' + (e.z || 0) + (fx ? ' · LOCKED: vertical position follows scroll, because the rocket is the timeline progress marker. X, width and height are editable.' : '') + (asset(e).kind === 'vignette' ? ' · double click to edit items inside' : '') + (e.anchor === 'bottom' ? ' · Y = bottom edge' : '');
    FIELDS.forEach(function (f) {
      var inp = ui[f[0]]; if (live && document.activeElement === inp) return;
      var v = f[0] === 'h' ? hOf(e) : e[f[0]];
      if (f[0] === 'opacity' && v == null) v = 1;
      inp.value = v == null ? '' : r2(v);
      inp.disabled = fx && (f[0] === 'y' || f[0] === 'rotate');
      inp.placeholder = fx && f[0] === 'x' ? 'on line' : '';
    });
    var isField = asset(e).kind === 'field';
    var eng = asset(e).kind === 'stars' || (isField && asset(e).engine === 'stars') ? 'stars' : isField ? 'asteroids' : null;
    Object.keys(ui.fields).forEach(function (k) { ui.fields[k].box.style.display = k === eng ? 'flex' : 'none'; });
    if (eng) {
      var D = (eng === 'stars' ? window.StarField && window.StarField.defaults : window.AsteroidField && window.AsteroidField.defaults) || {}, FFs = ui.fields[eng].ff;
      Object.keys(FFs).forEach(function (k) { var inp = FFs[k]; if (live && document.activeElement === inp) return; var v = e.field && e.field[k] != null ? e.field[k] : D[k]; inp.value = v == null ? '' : v; });
      var fb = ui.fillBtns && ui.fillBtns[eng]; if (fb) { var filled = SL.fillMode(asset(e), e); fb.textContent = filled ? 'Fills section · drag or resize to free it' : 'Fill section again'; fb.disabled = filled; }
    }
    ui.fwd.style.display = ui.back.style.display = ui.dup.style.display = ui.anim.style.display = ui.del.style.display = fx ? 'none' : '';
    ui.sizeRow.style.display = fx ? 'none' : 'flex';
    ui.secRow.style.display = fx || asset(e).kind === 'field' ? 'none' : 'flex'; if (!fx) fillSections(e);
    if (isField) ui.fwd.style.display = ui.back.style.display = 'none';
    ui.anim.textContent = e.anim === false ? 'Animation: off' : 'Animation: on';
    if (e.anim === false) ui.anim.removeAttribute('data-on'); else ui.anim.setAttribute('data-on', '');
    ui.hide.textContent = e.hidden ? 'Show' : 'Hide';
    var canPin = !fx && !SL.fillMode(asset(e), e) && !e.area;
    ui.focusRow.style.display = e.area && asset(e).kind === 'backdrop' ? 'flex' : 'none';
    if (e.area) { var fo = e.focus || [0.5, 0.5]; ui.focus.value = fo[1] === 0 ? 'top' : fo[1] === 1 ? 'bottom' : fo[0] === 0 ? 'left' : fo[0] === 1 ? 'right' : 'center'; }
    ui.pinRow.style.display = canPin ? 'flex' : 'none';
    [].forEach.call(ui.pinTo.options, function (o) { o.hidden = e.section !== 'top' && !/^(none|edge)$/.test(o.value); }); // hero areas only make sense in the hero
    if (canPin) { var P = e.near && e.near.pin; ui.pinTo.value = P ? (P.to || 'photo') : 'none'; ui.pinBy.value = P ? (P.by || 'w') : 'page'; ui.pinBy.disabled = !P; }
    if (asset(e).kind === 'stars') { ui.opacity.disabled = true; ui.opacity.title = 'Star fields use the per-layer opacities below'; } else ui.opacity.title = '';
    var isBd = asset(e).kind === 'backdrop' || asset(e).kind === 'scene' || !!asset(e).strength; ui.motionRow.style.display = isBd ? 'flex' : 'none';
    if (isBd && !(live && document.activeElement === ui.motion)) { var mv = e.motion == null ? 1 : e.motion; ui.motion.value = mv; ui.motionVal.textContent = mv + '×'; }
    var isVig = asset(e).kind === 'vignette'; ui.vigRow.style.display = isVig ? 'flex' : 'none'; if (isVig) ui.vhero.value = (e.vig && e.vig.hero) || 'none';
    var A2 = asset(e), many = A2.angles && A2.angles.length > 1; ui.angRow.style.display = many ? 'flex' : 'none';
    if (many) {
      var key = e.asset + ':' + A2.angles.length;
      if (ui.angle.__key !== key) { ui.angle.__key = key; ui.angle.innerHTML = ''; ['auto'].concat(A2.angles.map(function (_, i) { return String(i + 1); })).forEach(function (v) { var o = el('option', '', v === 'auto' ? 'Auto' : (A2.frameName || 'Angle') + ' ' + v); o.value = v; ui.angle.appendChild(o); }); }
      ui.angle.parentElement.firstChild.textContent = A2.frameName || 'Angle';
      ui.angle.value = e.angle ? String(e.angle) : 'auto'; ui.wob.style.display = A2.behave === 'wobble' ? '' : 'none'; ui.wob.textContent = e.wobble ? 'Wobble: on' : 'Wobble: off'; if (e.wobble) ui.wob.setAttribute('data-on', ''); else ui.wob.removeAttribute('data-on'); }
  }
  function status(t) { if (ui.status) ui.status.textContent = t; }
  function doSave() {
    // merge with the file as it is on disk right now, so saving never undoes changes made elsewhere since this tab loaded it
    fetch('data/space-layout.json?v=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (disk) {
      var merged = disk ? mergeDraft(JSON.parse(savedLists() || '{"desktop":[],"mobile":[]}'), { desktop: SL.cfg.desktop, mobile: SL.cfg.mobile }, disk) : null;
      var out = disk ? Object.assign({}, disk, { desktop: merged.desktop, mobile: merged.mobile }) : SL.cfg;
      writeOut(out, !!disk);
    });
  }
  function writeOut(out, mergedFromDisk) {
    var json = JSON.stringify(out, null, 2) + '\n';
    fetch('/__space-layout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: json })
      .then(function (r) {
        if (!r.ok) throw new Error(r.status);
        if (mergedFromDisk) { var before = snap(); SL.cfg.assets = out.assets; SL.cfg.desktop = out.desktop; SL.cfg.mobile = out.mobile; if (snap() !== before) { SL.render(); fill(); } }
        SL.saved = JSON.stringify(SL.cfg); dropDraft(); status('Saved to data/space-layout.json.');
      })
      .catch(function () {
        var done = function () { SL.saved = JSON.stringify(SL.cfg); status('No dev server, so the full JSON is on your clipboard. Paste it into data/space-layout.json.'); };
        if (navigator.clipboard) navigator.clipboard.writeText(json).then(done, fb); else fb();
        function fb() { var a = document.createElement('textarea'); a.value = json; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); done(); } catch (e) { status('Could not save. Run node dev/server.js and try again.'); } a.remove(); }
      });
  }
})();
