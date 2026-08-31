/* ═══════════════════════════════════════════════
   Jewel Labs

   Three visual layers, all optional, all fail open:
     ambient   WebGL dust behind the page
     stage     the intro: particles gather into a round
               brilliant, it turns, it dissolves
     bay       the chamber: the same stone under a single
               measurement pass that runs once and settles
   ═══════════════════════════════════════════════ */

(function () {
  'use strict';

  var qs = function (s) { return document.querySelector(s); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };
  var easeInOut = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };

  var reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  /* Each visual layer runs inside this. A throw in the particle code must not
     take the nav, the reveal or the form down with it. */
  function layer(fn) { try { fn(); } catch (e) {} }

  var T0 = performance.now();   // shared clock: intro and hero stone stay in step

  var dpr = function () { return Math.min(window.devicePixelRatio || 1, 2); };

  /* ── the stone ──────────────────────────────────────────
     A round brilliant as facet EDGES plus facet SURFACES.
     Edges alone read hollow, like a wireframe. Filling the
     facets is what gives it a body.                         */
  var STONE = (function () {
    var T = [], S = [], gU = [], gL = [], culet = [0, 1.00, 0];
    var i, a;
    for (i = 0; i < 8; i++) {
      a = i * Math.PI / 4;
      T.push([Math.cos(a) * 0.46, -0.52, Math.sin(a) * 0.46]);
      a += Math.PI / 8;
      S.push([Math.cos(a) * 0.68, -0.30, Math.sin(a) * 0.68]);
    }
    for (i = 0; i < 16; i++) {
      a = i * Math.PI / 8;
      gU.push([Math.cos(a), -0.02, Math.sin(a)]);
      gL.push([Math.cos(a), 0.02, Math.sin(a)]);
    }
    var n8 = function (k) { return (k + 1) % 8; };
    var p8 = function (k) { return (k + 7) % 8; };
    var n16 = function (k) { return (k + 1) % 16; };

    var edges = [], faces = [];
    var tri = function (a1, b1, c1) { faces.push([a1, b1, c1]); };
    var quad = function (a1, b1, c1, d1) { tri(a1, b1, c1); tri(a1, c1, d1); };

    for (i = 1; i < 7; i++) tri(T[0], T[i], T[i + 1]);            // table
    for (i = 0; i < 8; i++) {
      edges.push([T[i], T[n8(i)]]);
      edges.push([T[i], S[i]]);
      edges.push([T[n8(i)], S[i]]);
      edges.push([S[i], gU[(2 * i + 1) % 16]]);
      edges.push([T[i], gU[(2 * i) % 16]]);

      tri(T[i], T[n8(i)], S[i]);                                   // star
      quad(T[i], S[i], gU[(2 * i) % 16], S[p8(i)]);                // kite
      tri(S[i], gU[(2 * i + 1) % 16], gU[(2 * i) % 16]);           // upper girdle
      tri(S[i], gU[(2 * i + 2) % 16], gU[(2 * i + 1) % 16]);
    }
    for (i = 0; i < 16; i++) {
      edges.push([gU[i], gU[n16(i)]]);
      edges.push([gU[i], gL[i]]);
      edges.push([gL[i], culet]);
      quad(gU[i], gU[n16(i)], gL[n16(i)], gL[i]);                  // girdle band
      tri(gL[i], gL[n16(i)], culet);                               // pavilion
    }
    return { edges: edges, faces: faces };
  })();

  // Uniform point inside a triangle.
  function inTri(f) {
    var u = Math.random(), v = Math.random();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    return [
      f[0][0] + (f[1][0] - f[0][0]) * u + (f[2][0] - f[0][0]) * v,
      f[0][1] + (f[1][1] - f[0][1]) * u + (f[2][1] - f[0][1]) * v,
      f[0][2] + (f[1][2] - f[0][2]) * u + (f[2][2] - f[0][2]) * v
    ];
  }

  /* Edge points carry the facet lines and are bright; surface points fill the
     body and are dim. Returns [x, y, z, weight]. */
  function seed(n) {
    var E = STONE.edges, F = STONE.faces;
    var nEdge = Math.round(n * 0.34), nFace = n - nEdge;
    var pts = [], i;

    var per = Math.max(1, Math.ceil(nEdge / E.length));
    for (i = 0; i < nEdge; i++) {
      var g = E[i % E.length];
      var t = (Math.floor(i / E.length) + 0.5) / per;
      pts.push([
        g[0][0] + (g[1][0] - g[0][0]) * t,
        g[0][1] + (g[1][1] - g[0][1]) * t,
        g[0][2] + (g[1][2] - g[0][2]) * t,
        1
      ]);
    }
    for (i = 0; i < nFace; i++) {
      var q = inTri(F[i % F.length]);
      pts.push([q[0], q[1], q[2], 0.60]);
    }
    return pts;
  }

  function project(p, ry, rx, s, cx, cy) {
    var cY = Math.cos(ry), sY = Math.sin(ry);
    var x1 = p[0] * cY + p[2] * sY;
    var z1 = -p[0] * sY + p[2] * cY;
    var cX = Math.cos(rx), sX = Math.sin(rx);
    var y2 = p[1] * cX - z1 * sX;
    var z2 = p[1] * sX + z1 * cX;
    var f = 4.2, k = f / (f - z2);
    return { x: cx + x1 * s * k, y: cy + y2 * s * k, d: z2 };
  }

  /* A soft round mote. Drawing this with additive blending is the whole
     difference between dust and a grid of little squares. */
  function makeSprite() {
    var S = 16;
    var c = document.createElement('canvas');
    c.width = c.height = S;
    var g = c.getContext('2d');
    if (!g) return null;
    var r = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    r.addColorStop(0.00, 'rgba(255,255,255,1)');
    r.addColorStop(0.26, 'rgba(232,244,255,0.80)');
    r.addColorStop(0.56, 'rgba(158,202,242,0.20)');
    r.addColorStop(1.00, 'rgba(120,175,232,0)');
    g.fillStyle = r;
    g.beginPath();
    g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
    g.fill();
    return c;
  }
  var SPRITE = null;
  try { SPRITE = makeSprite(); } catch (e) {}

  /* ══════════════ AMBIENT DUST (WebGL) ══════════════ */
  layer(function () {
    var canvas = qs('#ambient');
    if (!canvas || reduced) { if (canvas) canvas.style.display = 'none'; return; }

    var gl = null;
    try { gl = canvas.getContext('webgl', { alpha: true, antialias: true, depth: false }); } catch (e) {}
    if (!gl) { canvas.style.display = 'none'; return; }

    var VS = [
      'attribute vec2 aSeed;',
      'uniform float uTime;',
      'uniform vec2 uResolution;',
      'varying float vDepth;',
      'void main() {',
      '  float drift = sin(uTime * 0.16 + aSeed.x * 17.0) * 0.035',
      '              + cos(uTime * 0.096 + aSeed.y * 9.0) * 0.016;',
      '  float rise = fract(aSeed.y + uTime * (0.005 + aSeed.x * 0.009));',
      '  vec2 pos = vec2(aSeed.x * 2.0 - 1.0 + drift, rise * 2.0 - 1.0);',
      '  float edgeFade = 1.0 - smoothstep(0.72, 1.0, abs(pos.x));',
      '  vDepth = edgeFade * (0.28 + aSeed.y * 0.72);',
      '  gl_Position = vec4(pos, 0.0, 1.0);',
      '  gl_PointSize = (1.0 + aSeed.x * 2.0) * min(uResolution.x / 1400.0, 1.3);',
      '}'
    ].join('\n');

    var FS = [
      'precision mediump float;',
      'varying float vDepth;',
      'void main() {',
      '  vec2 p = gl_PointCoord - vec2(0.5);',
      '  float d = length(p);',
      '  float core = smoothstep(0.5, 0.04, d);',
      '  vec3 color = mix(vec3(0.13, 0.28, 0.46), vec3(0.62, 0.79, 0.95), vDepth);',
      '  float alpha = core * (0.05 + vDepth * 0.30);',
      '  gl_FragColor = vec4(color * alpha, alpha);',
      '}'
    ].join('\n');

    function compile(type, src) {
      var sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { gl.deleteShader(sh); return null; }
      return sh;
    }
    var vs = compile(gl.VERTEX_SHADER, VS);
    var fs = compile(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) { canvas.style.display = 'none'; return; }

    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.style.display = 'none'; return; }

    var COUNT = window.innerWidth < 720 ? 260 : 520;
    var seeds = new Float32Array(COUNT * 2);
    for (var i = 0; i < seeds.length; i += 2) {
      seeds[i] = Math.random();
      seeds[i + 1] = Math.random();
    }

    var buf = gl.createBuffer();
    var aSeed = gl.getAttribLocation(prog, 'aSeed');
    var uTime = gl.getUniformLocation(prog, 'uTime');
    var uRes = gl.getUniformLocation(prog, 'uResolution');

    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);   // premultiplied, glows on black

    var start = performance.now(), raf = 0;

    function resize() {
      var d = dpr();
      var w = Math.max(1, Math.floor(canvas.clientWidth * d));
      var h = Math.max(1, Math.floor(canvas.clientHeight * d));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
    }

    function render(now) {
      if (gl.isContextLost()) { cancelAnimationFrame(raf); return; }
      resize();
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.vertexAttribPointer(aSeed, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(aSeed);
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.drawArrays(gl.POINTS, 0, COUNT);
      raf = requestAnimationFrame(render);
    }
    raf = requestAnimationFrame(render);

    var hiddenAt = 0;
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { hiddenAt = performance.now(); cancelAnimationFrame(raf); }
      else {
        if (hiddenAt) start += performance.now() - hiddenAt;   // no teleport back to t=0
        hiddenAt = 0;
        raf = requestAnimationFrame(render);
      }
    });

    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      cancelAnimationFrame(raf);
      canvas.style.display = 'none';
    });
  });

  /* ══════════════ INTRO ══════════════ */
  layer(function () {
    var canvas = qs('#stage');
    var veil = qs('#veil');
    var body = document.body;

    var words = Array.prototype.slice.call(document.querySelectorAll('#tagline span'));
    var wordsRun = false;
    function runWords(delay) {
      if (wordsRun) return;
      wordsRun = true;
      words.forEach(function (w, i) {
        setTimeout(function () { w.classList.add('in'); }, delay + i * 100);
      });
    }
    function strip() {
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
      if (veil && veil.parentNode) { veil.parentNode.removeChild(veil); veil = null; }
    }
    function handOver() { body.classList.add('ready'); }

    var ctx = null;
    if (canvas) { try { ctx = canvas.getContext('2d'); } catch (e) {} }
    if (!canvas || !ctx || !SPRITE || reduced) { handOver(); strip(); runWords(0); return; }

    var W = 0, H = 0, N = 0, gem = [], parts = [];
    var done = false, raf = 0;

    function finish() {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      handOver();
      strip();
      runWords(300);
    }

    function build() {
      var D = dpr();
      W = Math.round(window.innerWidth * D);
      H = Math.round(window.innerHeight * D);
      canvas.width = W; canvas.height = H;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';

      var want = window.innerWidth < 720 ? 1500 : 2900;
      if (want === N) return;
      N = want;
      gem = seed(N);
      parts = [];
      for (var i = 0; i < N; i++) {
        var a = Math.random() * Math.PI * 2;
        var r = 0.7 + Math.random() * 0.85;
        parts.push({
          ox: W * 0.5 + Math.cos(a) * W * r,
          oy: H * 0.5 + Math.sin(a) * H * r,
          ph: Math.random() * Math.PI * 2,
          dl: Math.random() * 0.24,          // staggered arrival
          dr: 0.5 + Math.random()
        });
      }
    }
    build();
    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { if (!done) build(); }, 180);
    });

    var FORM = 2100;   // gather
    var HOLD = 3550;   // turn
    var GONE = 4750;   // dissolve
    var t0 = performance.now();
    var handed = false;
    var skipAt = t0 + 700;

    function skip() { if (!done && performance.now() >= skipAt) finish(); }
    window.addEventListener('pointerdown', skip, { passive: true });
    window.addEventListener('keydown', function (e) { if (e.key !== 'Tab') skip(); });
    setTimeout(function () { if (!done) finish(); }, 6800);

    raf = requestAnimationFrame(function frame(now) {
      if (done) return;
      var el = now - t0;

      var D = dpr();
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      var out = clamp((el - HOLD) / (GONE - HOLD), 0, 1);
      var ease = easeInOut(out);

      // where the stone lives once the intro is over
      var slot = null;
      var hero = document.getElementById('heroGem');
      if (hero) {
        var hr = hero.getBoundingClientRect();
        if (hr.width > 2) {
          slot = {
            cx: (hr.left + hr.width / 2) * D,
            cy: (hr.top + hr.height / 2) * D,
            sc: Math.min(hr.width, hr.height) * D * 0.40
          };
        }
      }

      var bigScale = Math.min(W, H) * (window.innerWidth >= 1024 ? 0.21 : 0.25);
      var scale = slot ? lerp(bigScale, slot.sc, ease) : bigScale;
      var cx = slot ? lerp(W / 2, slot.cx, ease) : W / 2;
      var cy = slot ? lerp(H * 0.45, slot.cy, ease) : H * 0.45;
      var ry = (now - T0) * 0.00034;
      var rx = 0.36 + Math.sin((now - T0) * 0.00042) * 0.055;

      if (veil) veil.style.opacity = clamp(1 - out * 1.6, 0, 1).toFixed(3);
      if (!handed && out > 0.06) { handed = true; handOver(); runWords(520); }
      canvas.style.opacity = clamp(1 - (out - 0.86) / 0.14, 0, 1).toFixed(3);

      for (var i = 0; i < N; i++) {
        var p = parts[i];
        // arrival is a pure function of elapsed time, so the stone forms the
        // same way at 30fps as at 120fps
        var f = easeOut(clamp((el / FORM - p.dl) / (1 - p.dl), 0, 1));
        var q = project(gem[i], ry, rx, scale, cx, cy);

        var gx = q.x, gy = q.y;

        var jit = (1 - f) * 13 * D;
        var x = lerp(p.ox, gx, f) + Math.sin(el * 0.0036 + p.ph) * jit;
        var y = lerp(p.oy, gy, f) + Math.cos(el * 0.0032 + p.ph * 1.3) * jit;

        var w = gem[i][3];
        var tw = 0.68 + 0.32 * Math.sin(el * 0.0026 + p.ph);
        var depth = clamp((q.d + 1.1) / 2.2, 0, 1);
        var alpha = (0.40 + 0.62 * depth) * tw * f * w;
        if (alpha <= 0.005) continue;

        var s = (1.05 + 1.55 * depth + 0.55 * tw) * (0.6 + 0.4 * w) * D;
        ctx.globalAlpha = alpha;
        ctx.drawImage(SPRITE, x - s / 2, y - s / 2, s, s);
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      if (el > GONE + 100) { finish(); return; }
      raf = requestAnimationFrame(frame);
    });
  });

  /* ══════════════ THE HERO STONE ══════════════
     Where the intro puts the stone down. Same geometry, same clock, so the
     handoff has nothing to jump between. */
  layer(function () {
    var canvas = qs('#heroGem');
    if (!canvas || !SPRITE) return;
    var ctx = null;
    try { ctx = canvas.getContext('2d'); } catch (e) {}
    if (!ctx) return;

    var W = 0, H = 0, raf = 0, live = false;
    var pts = seed(window.innerWidth < 720 ? 1100 : 1900);

    function size() {
      var r = canvas.getBoundingClientRect();
      var D = dpr();
      W = Math.max(2, Math.round(r.width * D));
      H = Math.max(2, Math.round(r.height * D));
      canvas.width = W; canvas.height = H;
    }

    function paint(now) {
      var D = dpr();
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      var el = now - T0;
      var scale = Math.min(W, H) * 0.40;
      var cx = W / 2, cy = H / 2;
      var ry = el * 0.00034;
      var rx = 0.36 + Math.sin(el * 0.00042) * 0.055;

      for (var i = 0; i < pts.length; i++) {
        var q = project(pts[i], ry, rx, scale, cx, cy);
        var w = pts[i][3];
        var depth = clamp((q.d + 1.1) / 2.2, 0, 1);
        var tw = 0.70 + 0.30 * Math.sin(el * 0.0024 + i);
        var alpha = clamp((0.34 + 0.60 * depth) * tw * w, 0, 1);
        var sz = (1.0 + 1.5 * depth) * (0.6 + 0.4 * w) * D;
        ctx.globalAlpha = alpha;
        ctx.drawImage(SPRITE, q.x - sz / 2, q.y - sz / 2, sz, sz);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    function loop(now) { if (!live) return; paint(now); raf = requestAnimationFrame(loop); }
    function start() { if (live) return; live = true; raf = requestAnimationFrame(loop); }
    function stop() { live = false; cancelAnimationFrame(raf); }

    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { size(); if (!live) paint(performance.now()); }, 160);
    });

    size();
    if (reduced) { paint(T0 + 4000); return; }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) { e.isIntersecting ? start() : stop(); });
      }, { threshold: 0.02 }).observe(canvas);
    } else { start(); }
  });

  /* ══════════════ THE CHAMBER ══════════════ */
  layer(function () {
    var cells = Array.prototype.slice.call(document.querySelectorAll('.readout b'));
    function settleAll() { cells.forEach(function (c) { c.classList.add('set'); }); }

    var canvas = qs('#scan-canvas');
    if (!canvas) { settleAll(); return; }
    var ctx = null;
    try { ctx = canvas.getContext('2d'); } catch (e) {}
    // A blocked or unavailable 2D canvas must still leave the record readable.
    if (!ctx || !SPRITE) { settleAll(); return; }

    var W = 0, H = 0;
    var pts = seed(window.innerWidth < 720 ? 1400 : 2700);
    var raf = 0, live = false, t0 = 0;

    function size() {
      var r = canvas.getBoundingClientRect();
      var D = dpr();
      W = Math.max(2, Math.round(r.width * D));
      H = Math.max(2, Math.round(r.height * D));
      canvas.width = W; canvas.height = H;
    }

    // el is elapsed since the panel came into view
    function paint(el) {
      var D = dpr();
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      var scale = Math.min(W, H) * 0.34;
      var cx = W / 2, cy = H / 2;
      var ry = el * 0.00034;
      var rx = 0.34 + Math.sin(el * 0.0003) * 0.05;

      // one measurement pass, then it is done. Nothing loops, nothing resets.
      var PASS = 2600, LEAD = 500;
      var k = clamp((el - LEAD) / PASS, 0, 1);
      var passing = k > 0 && k < 1;
      var sweepY = cy - scale * 1.4 + easeInOut(k) * scale * 2.8;

      for (var i = 0; i < pts.length; i++) {
        var q = project(pts[i], ry, rx, scale, cx, cy);
        var w = pts[i][3];
        var near = passing ? clamp(1 - Math.abs(q.y - sweepY) / (30 * D), 0, 1) : 0;
        var depth = clamp((q.d + 1.1) / 2.2, 0, 1);
        var alpha = clamp((0.30 + 0.58 * depth) * w + near * 0.55 * w, 0, 1);
        var s = (1.0 + 1.5 * depth + near * 1.5) * (0.6 + 0.4 * w) * D;
        ctx.globalAlpha = alpha;
        ctx.drawImage(SPRITE, q.x - s / 2, q.y - s / 2, s, s);
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      if (passing) {
        var g = ctx.createLinearGradient(0, 0, W, 0);
        g.addColorStop(0, 'rgba(169,201,232,0)');
        g.addColorStop(0.5, 'rgba(196,222,248,0.32)');
        g.addColorStop(1, 'rgba(169,201,232,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, sweepY, W, Math.max(1, D));
      }

      // each value settles as the pass clears it, and then stays settled
      var filled = Math.floor(clamp(k / 0.88, 0, 1) * cells.length);
      for (var j = 0; j < filled; j++) cells[j].classList.add('set');
    }

    function loop(now) {
      if (!live) return;
      paint(now - t0);
      raf = requestAnimationFrame(loop);
    }
    var failsafe = 0;
    function start() {
      if (live) return;
      live = true;
      if (!t0) t0 = performance.now();
      // armed when the panel is first seen, so the record cannot sit blank
      if (!failsafe) failsafe = setTimeout(settleAll, 9000);
      raf = requestAnimationFrame(loop);
    }
    function stop() { live = false; cancelAnimationFrame(raf); }

    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        size();
        // repaint at the real elapsed time, so an off-screen resize cannot
        // fast-forward the measurement pass to completion
        if (!live) paint(t0 ? performance.now() - t0 : 0);
      }, 160);
    });

    if (reduced) { size(); paint(4000); settleAll(); return; }

    size();
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) { e.isIntersecting ? start() : stop(); });
      }, { threshold: 0.12 }).observe(canvas);
    } else { start(); }
  });

  /* ══════════════ BOOKING, OPENED ON REQUEST ══════════════ */
  layer(function () {
    var wrap = qs('#cal'), gate = qs('#calGate'), btn = qs('#calOpen');
    if (!wrap || !gate || !btn) return;

    btn.addEventListener('click', function () {
      var src = wrap.getAttribute('data-src');
      if (!src) return;
      btn.disabled = true;
      btn.textContent = 'Opening…';
      var f = document.createElement('iframe');
      f.title = 'Book a fifteen minute demo with Jewel Labs';
      f.src = src;
      f.referrerPolicy = 'no-referrer-when-downgrade';
      f.addEventListener('load', function () {
        if (gate.parentNode) gate.parentNode.removeChild(gate);
        try { f.focus(); } catch (e) {}
      });
      wrap.appendChild(f);
    });
  });

  /* ══════════════ NAV ══════════════ */
  layer(function () {
    var nav = qs('#nav');
    if (!nav) return;
    var t = false;
    function up() { nav.classList.toggle('stuck', window.pageYOffset > 16); t = false; }
    window.addEventListener('scroll', function () {
      if (!t) { t = true; requestAnimationFrame(up); }
    }, { passive: true });
    up();
  });

  /* ══════════════ SECTION REVEAL ══════════════ */
  layer(function () {
    if (reduced || !('IntersectionObserver' in window)) return;
    var items = Array.prototype.slice.call(
      document.querySelectorAll('.band .kicker, .band .h2, .band .lede, .band .sub, .steps, .sheet, .compare, .bay, .cal, .wl')
    );
    if (!items.length) return;
    items.forEach(function (el) { el.classList.add('rv'); });

    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -5% 0px', threshold: 0.04 });
    items.forEach(function (el) { io.observe(el); });

    setTimeout(function () {
      io.disconnect();
      items.forEach(function (el) { el.classList.add('in'); });
    }, 3400);
  });

  /* ══════════════ WAITLIST ══════════════ */
  layer(function () {
    var form = qs('#waitlist'), input = qs('#email'), msg = qs('#waitlistMsg');
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
      // move focus to the confirmation before disabling, or it falls to <body>
      try { msg.focus(); } catch (e) {}
      input.disabled = true;
      form.querySelector('button').disabled = true;
    });

    input.addEventListener('input', function () {
      input.classList.remove('bad');
      msg.classList.remove('bad');
      msg.textContent = '';
    });
  });

})();
