/* ═══════════════════════════════════════════════
   Hero: the stone, and a little dust around it.
   Loaded as a module, so browsers without module
   support simply get the wordmark. Fails open.
   ═══════════════════════════════════════════════ */

import { mountDiamond } from './diamond.js';

const reduced = (() => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch (e) { return false; }
})();

/* ── the stone ── */
(function () {
  const canvas = document.getElementById('gem');
  if (!canvas) return;
  let handle = null;
  try { handle = mountDiamond(canvas, { reduced }); } catch (e) { handle = null; }
  if (!handle) {
    // no WebGL: take the stage out rather than leave an empty rectangle
    const stage = canvas.closest('.stone');
    if (stage) stage.style.display = 'none';
  }
})();

/* ── dust: tiny, sparse, slow ── */
(function () {
  const canvas = document.getElementById('dust');
  if (!canvas || reduced) return;

  let ctx = null;
  try { ctx = canvas.getContext('2d'); } catch (e) { return; }
  if (!ctx) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0, motes = [], raf = 0, live = false;

  function build() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width * dpr));
    H = Math.max(1, Math.round(r.height * dpr));
    canvas.width = W; canvas.height = H;

    const want = r.width < 420 ? 34 : 54;
    motes = [];
    for (let i = 0; i < want; i++) {
      motes.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: (0.5 + Math.random() * 0.7) * dpr,     // sub-pixel to just over one
        a: 0.05 + Math.random() * 0.14,
        vy: (0.10 + Math.random() * 0.22) * dpr,
        ph: Math.random() * Math.PI * 2
      });
    }
  }

  function frame(now) {
    if (!live) return;
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < motes.length; i++) {
      const m = motes[i];
      m.y -= m.vy;
      if (m.y < -4) { m.y = H + 4; m.x = Math.random() * W; }
      const x = m.x + Math.sin(now * 0.00016 + m.ph) * 7 * dpr;
      const a = m.a * (0.55 + 0.45 * Math.sin(now * 0.0007 + m.ph));
      ctx.fillStyle = 'rgba(47,85,115,' + a.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    raf = requestAnimationFrame(frame);
  }

  function start() { if (live) return; live = true; raf = requestAnimationFrame(frame); }
  function stop() { live = false; cancelAnimationFrame(raf); }

  build();
  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(build, 180);
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => {
      es.forEach((e) => (e.isIntersecting ? start() : stop()));
    }, { threshold: 0.02 }).observe(canvas);
  } else { start(); }
})();
