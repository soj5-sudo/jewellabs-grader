/* ═══════════════════════════════════════════════
   Jewel Labs, page behaviour.
   No overlay, no lock. Nothing here can hide content:
   the reveal classes only ever add opacity back.
   ═══════════════════════════════════════════════ */

(function () {
  'use strict';

  var qs = function (s) { return document.querySelector(s); };
  var reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  /* ── hero copy arrives, one word at a time ── */
  (function () {
    document.body.classList.add('ready');
    var words = Array.prototype.slice.call(document.querySelectorAll('#tagline span'));
    if (reduced) { words.forEach(function (w) { w.classList.add('in'); }); return; }
    words.forEach(function (w, i) {
      setTimeout(function () { w.classList.add('in'); }, 520 + i * 95);
    });
  })();

  /* ── nav ── */
  (function () {
    var nav = qs('#nav');
    if (!nav) return;
    var t = false;
    function up() { nav.classList.toggle('stuck', window.pageYOffset > 16); t = false; }
    window.addEventListener('scroll', function () {
      if (!t) { t = true; requestAnimationFrame(up); }
    }, { passive: true });
    up();
  })();

  /* ── section reveal ── */
  (function () {
    if (reduced || !('IntersectionObserver' in window)) return;
    var items = Array.prototype.slice.call(
      document.querySelectorAll('.band .h2, .band .lede, .band .sub, .steps, .grid8, .doc, .compare, .wl')
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

    // fail open: content is never left invisible if the observer misses
    setTimeout(function () {
      io.disconnect();
      items.forEach(function (el) { el.classList.add('in'); });
    }, 3200);
  })();

  /* ── waitlist ── */
  (function () {
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
