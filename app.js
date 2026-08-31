/* ═══════════════════════════════════════════════
   Jewel Labs
   Particles gather into a round brilliant, it turns,
   it fades, the wordmark arrives. Canvas 2D, no deps.
   Every stage fails open.
   ═══════════════════════════════════════════════ */

(function () {
  'use strict';

  var qs = function (s, r) { return (r || document).querySelector(s); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };

  var reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  /* ── round brilliant, as facet edges ─────────────────────
     table octagon, star facets, bezels, girdle, pavilion.
     y runs downward: table is negative, culet positive.     */
  var GEM = (function () {
    var table = [], star = [], girdle = [], culet = [0, 1.00, 0];
    var i, a, edges = [];

    for (i = 0; i < 8; i++) {
      a = i * Math.PI / 4;
      table.push([Math.cos(a) * 0.46, -0.52, Math.sin(a) * 0.46]);
      a = i * Math.PI / 4 + Math.PI / 8;
      star.push([Math.cos(a) * 0.66, -0.30, Math.sin(a) * 0.66]);
    }
    for (i = 0; i < 16; i++) {
      a = i * Math.PI / 8;
      girdle.push([Math.cos(a), 0, Math.sin(a)]);
    }

    for (i = 0; i < 8; i++) edges.push([table[i], table[(i + 1) % 8]]);       // table
    for (i = 0; i < 8; i++) {                                                 // star facets
      edges.push([table[i], star[i]]);
      edges.push([table[(i + 1) % 8], star[i]]);
    }
    for (i = 0; i < 8; i++) edges.push([star[i], girdle[(2 * i + 1) % 16]]);  // upper bezels
    for (i = 0; i < 8; i++) edges.push([table[i], girdle[(2 * i) % 16]]);     // bezel mains
    for (i = 0; i < 16; i++) edges.push([girdle[i], girdle[(i + 1) % 16]]);   // girdle
    for (i = 0; i < 16; i++) edges.push([girdle[i], culet]);                  // pavilion

    return edges;
  })();

  // rotate about Y then X, then a light perspective divide
  function project(p, rotY, rotX, scale, cx, cy) {
    var cy1 = Math.cos(rotY), sy1 = Math.sin(rotY);
    var x1 = p[0] * cy1 + p[2] * sy1;
    var z1 = -p[0] * sy1 + p[2] * cy1;
    var cx1 = Math.cos(rotX), sx1 = Math.sin(rotX);
    var y2 = p[1] * cx1 - z1 * sx1;
    var z2 = p[1] * sx1 + z1 * cx1;
    var f = 4.2, s = f / (f - z2);
    return { x: cx + x1 * scale * s, y: cy + y2 * scale * s, d: z2 };
  }

  // spread particles evenly along every edge
  function seed(n) {
    var pts = [], per = Math.max(1, Math.ceil(n / GEM.length)), i;
    for (i = 0; i < n; i++) {
      var e = GEM[i % GEM.length];
      var t = (Math.floor(i / GEM.length) + 0.5) / per;
      pts.push([
        e[0][0] + (e[1][0] - e[0][0]) * t,
        e[0][1] + (e[1][1] - e[0][1]) * t,
        e[0][2] + (e[1][2] - e[0][2]) * t
      ]);
    }
    return pts;
  }

  /* ══════════════ INTRO ══════════════ */
  (function () {
    var canvas = qs('#stage');
    var intro = qs('#intro');
    var body = document.body;

    var handedHash = false;
    function handOver() {
      body.classList.remove('lock');
      body.classList.add('ready');
      // the page was locked while the intro ran, so the browser could not
      // honour a deep link. Do it now, once.
      if (handedHash) return;
      handedHash = true;
      var h = location.hash;
      if (!h || h.length < 2) return;
      var target = null;
      try { target = document.querySelector(h); } catch (e) {}
      if (target) target.scrollIntoView({ block: 'start' });
    }
    function strip() {
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
      if (intro && intro.parentNode) { intro.parentNode.removeChild(intro); intro = null; }
    }

    // the tagline arrives one word at a time
    var words = Array.prototype.slice.call(document.querySelectorAll('#tagline span'));
    var wordsRunning = false;
    function runWords(delay) {
      if (wordsRunning) return;
      wordsRunning = true;
      words.forEach(function (w, i) {
        setTimeout(function () { w.classList.add('in'); }, delay + i * 105);
      });
    }

    if (!canvas || reduced) { handOver(); strip(); runWords(0); return; }

    var ctx = null;
    try { ctx = canvas.getContext('2d'); } catch (e) {}
    if (!ctx) { handOver(); strip(); runWords(0); return; }

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, N = 0, gem = [], parts = [];
    var done = false, raf = 0;

    function finish() {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      handOver();
      strip();
      runWords(320);
    }

    function build() {
      W = Math.round(window.innerWidth * dpr);
      H = Math.round(window.innerHeight * dpr);
      canvas.width = W; canvas.height = H;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';

      var want = window.innerWidth < 720 ? 1100 : 1800;
      if (want !== N) {
        N = want;
        gem = seed(N);
        parts = [];
        for (var i = 0; i < N; i++) {
          var a = Math.random() * Math.PI * 2;
          var r = 0.75 + Math.random() * 0.9;
          parts.push({
            ox: W * 0.5 + Math.cos(a) * W * r,
            oy: H * 0.5 + Math.sin(a) * H * r,
            ph: Math.random() * Math.PI * 2,
            drift: 0.5 + Math.random()
          });
        }
      }
    }

    build();
    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { if (!done) build(); }, 180);
    });

    var FORM = 2000;    // gather into the stone
    var HOLD = 3400;    // it turns
    var GONE = 4600;    // it fades away
    var t0 = performance.now();
    var handed = false;
    var skipAt = t0 + 800;

    function skip() { if (!done && performance.now() >= skipAt) finish(); }
    window.addEventListener('pointerdown', skip, { passive: true });
    window.addEventListener('keydown', function (e) { if (e.key !== 'Tab') skip(); });
    setTimeout(function () { if (!done) finish(); }, 7600);

    raf = requestAnimationFrame(function frame(now) {
      if (done) return;
      var el = now - t0;

      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      var form = easeOut(clamp(el / FORM, 0, 1));
      var out = clamp((el - HOLD) / (GONE - HOLD), 0, 1);
      var scale = Math.min(W, H) * (window.innerWidth >= 1024 ? 0.23 : 0.26);
      var cx = W / 2, cy = H * 0.46;
      var rotY = el * 0.00042;
      var rotX = 0.40 + Math.sin(el * 0.00048) * 0.07;

      // the black backdrop lifts as the stone dissolves
      if (intro) {
        var io = clamp(1 - out * 1.25, 0, 1);
        intro.style.opacity = io.toFixed(3);
        if (io <= 0.01) intro.style.pointerEvents = 'none';
      }
      if (!handed && el > HOLD + 380) { handed = true; handOver(); runWords(760); }

      for (var i = 0; i < N; i++) {
        var p = parts[i];
        var q = project(gem[i], rotY, rotX, scale, cx, cy);

        // on the way out the dust lifts and spreads
        var gx = q.x, gy = q.y;
        if (out > 0) {
          var push = out * out * 190 * dpr * p.drift;
          gx += Math.cos(p.ph) * push;
          gy += Math.sin(p.ph) * push - out * 46 * dpr;
        }

        // purely a function of elapsed time, so the stone forms the same
        // way at 30fps as at 120fps
        var jit = (1 - form) * 11 * dpr;
        p.x = lerp(p.ox, gx, form) + Math.sin(el * 0.0038 + p.ph) * jit;
        p.y = lerp(p.oy, gy, form) + Math.cos(el * 0.0034 + p.ph * 1.3) * jit;

        var twinkle = 0.66 + 0.34 * Math.sin(el * 0.0027 + p.ph);
        var alpha = 0.92 * twinkle * Math.max(form, 0.05) * (1 - out);
        if (alpha <= 0.005) continue;

        // depth reads as colour: far is deep cornflower, near is frost
        var d = clamp((q.d + 1.1) / 2.2, 0, 1);
        var r = lerp(96, 226, d) | 0;
        var g = lerp(140, 240, d) | 0;
        var b = lerp(190, 255, d) | 0;
        var sz = (0.95 + 0.5 * twinkle + 0.55 * d) * dpr;

        ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + alpha.toFixed(3) + ')';
        ctx.fillRect(p.x - sz, p.y - sz, sz * 2, sz * 2);
      }

      ctx.globalCompositeOperation = 'source-over';

      if (el > GONE + 120) { finish(); return; }
      raf = requestAnimationFrame(frame);
    });
  })();

  /* ══════════════ SCAN BAY ══════════════ */
  (function () {
    var canvas = qs('#scan-canvas');
    if (!canvas) return;
    var ctx = null;
    try { ctx = canvas.getContext('2d'); } catch (e) {}
    if (!ctx) return;

    var reads = {
      carat: '0.164 ct', colour: 'G', clarity: 'VS2', cut: 'Excellent',
      table: '57.0%', depth: '61.4%', fluor: 'Faint', origin: 'Natural'
    };
    var order = ['carat', 'colour', 'clarity', 'cut', 'table', 'depth', 'fluor', 'origin'];
    var cells = {};
    order.forEach(function (k) { cells[k] = qs('[data-r="' + k + '"]'); });

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, pts = seed(window.innerWidth < 720 ? 900 : 1500), raf = 0, live = false, t0 = 0, cycle = 0;

    function size() {
      var r = canvas.getBoundingClientRect();
      W = Math.max(2, Math.round(r.width * dpr));
      H = Math.max(2, Math.round(r.height * dpr));
      canvas.width = W; canvas.height = H;
    }

    function resetReads() {
      order.forEach(function (k) {
        if (cells[k]) { cells[k].textContent = 'Not set'; cells[k].classList.remove('fresh'); }
      });
    }

    function paint(el) {
      var span = 5200;                       // one full pass
      var k = (el % span) / span;

      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      var scale = Math.min(W, H) * 0.36;
      var cx = W / 2, cy = H / 2;
      var rotY = el * 0.00040;
      var rotX = 0.38 + Math.sin(el * 0.00042) * 0.06;

      // the sweep travels top to bottom across the stone
      var sweepY = cy - scale * 1.25 + k * scale * 2.5;

      for (var i = 0; i < pts.length; i++) {
        var q = project(pts[i], rotY, rotX, scale, cx, cy);
        var near = clamp(1 - Math.abs(q.y - sweepY) / (34 * dpr), 0, 1);
        var d = clamp((q.d + 1.1) / 2.2, 0, 1);

        var r = lerp(92, 218, d) + near * 40;
        var g = lerp(138, 238, d) + near * 20;
        var b = lerp(188, 255, d);
        var alpha = clamp(0.52 + 0.34 * d + near * 0.45, 0, 1);
        var sz = (0.9 + 0.55 * d + near * 1.0) * dpr;

        ctx.fillStyle = 'rgba(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ',' + alpha.toFixed(3) + ')';
        ctx.fillRect(q.x - sz, q.y - sz, sz * 2, sz * 2);
      }

      ctx.globalCompositeOperation = 'source-over';

      // the sweep line itself
      var grd = ctx.createLinearGradient(0, 0, W, 0);
      grd.addColorStop(0, 'rgba(168,200,232,0)');
      grd.addColorStop(0.5, 'rgba(190,218,244,0.42)');
      grd.addColorStop(1, 'rgba(168,200,232,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, sweepY, W, Math.max(1, dpr));

      // fields land as the sweep clears them
      var filled = Math.floor(clamp((k - 0.10) / 0.72, 0, 1) * order.length);
      for (var j = 0; j < order.length; j++) {
        var c = cells[order[j]];
        if (!c) continue;
        var want = j < filled ? reads[order[j]] : 'Not set';
        if (c.textContent !== want) {
          c.textContent = want;
          if (want !== 'Not set') {
            c.classList.add('fresh');
            (function (el2) { setTimeout(function () { el2.classList.remove('fresh'); }, 700); })(c);
          }
        }
      }

    }

    function loop(now) {
      if (!live) return;
      var el = now - t0;
      var span = 5200;
      if (Math.floor(el / span) !== cycle) { cycle = Math.floor(el / span); resetReads(); }
      paint(el);
      raf = requestAnimationFrame(loop);
    }

    function start() {
      if (live) return;
      live = true;
      size();
      t0 = performance.now();
      cycle = 0;
      raf = requestAnimationFrame(loop);
    }
    function stop() { live = false; cancelAnimationFrame(raf); }

    window.addEventListener('resize', function () { if (live) size(); });

    if (reduced) {
      // no animation, but the panel must still show the stone and the record
      size();
      paint(4600);
      order.forEach(function (k) { if (cells[k]) cells[k].textContent = reads[k]; });
      window.addEventListener('resize', function () { size(); paint(4600); });
      return;
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) { e.isIntersecting ? start() : stop(); });
      }, { threshold: 0.15 }).observe(canvas);
    } else {
      start();
    }
  })();

  /* ══════════════ NAV ══════════════ */
  (function () {
    var nav = qs('#nav');
    if (!nav) return;
    var t = false;
    function up() { nav.classList.toggle('stuck', window.pageYOffset > 20); t = false; }
    window.addEventListener('scroll', function () {
      if (!t) { t = true; requestAnimationFrame(up); }
    }, { passive: true });
    up();
  })();

  /* ══════════════ SECTION REVEAL ══════════════ */
  (function () {
    if (reduced || !('IntersectionObserver' in window)) return;
    var items = Array.prototype.slice.call(
      document.querySelectorAll('.band > .eyebrow, .band > .h2, .band > .body, .glass, .grid8, .chain, .waitlist')
    );
    if (!items.length) return;
    items.forEach(function (el) { el.classList.add('rv'); });

    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
    items.forEach(function (el) { io.observe(el); });

    // fail open: never leave content invisible if the observer misses
    setTimeout(function () {
      io.disconnect();
      items.forEach(function (el) { el.classList.add('in'); });
    }, 3200);
  })();

  /* ══════════════ WAITLIST ══════════════ */
  (function () {
    var form = qs('#waitlist');
    var input = qs('#email');
    var msg = qs('#waitlistMsg');
    if (!form || !input || !msg) return;

    var ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = input.value.trim();
      if (!ok.test(v)) {
        input.classList.add('bad');
        msg.classList.add('bad');
        msg.textContent = 'Enter a valid email address.';
        input.focus();
        return;
      }
      input.classList.remove('bad');
      msg.classList.remove('bad');
      msg.textContent = 'Thank you. We will update you soon.';
      input.value = '';
      input.disabled = true;
      form.querySelector('button').disabled = true;
    });

    input.addEventListener('input', function () {
      input.classList.remove('bad');
      msg.classList.remove('bad');
      msg.textContent = '';
    });
  })();

})();
