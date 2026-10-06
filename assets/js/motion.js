/* Motion for the blocks layout: word-by-word reading reveal (MagicText idea, scroll-driven), line reveals and block reveals. */
(function () {
  'use strict';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
  const smooth = (a, b, n) => { const t = clamp((n - a) / (b - a)); return t * t * (3 - 2 * t); };

  /* ---------- word-by-word reading reveal (MagicText idea, scroll-driven) ---------- */
  const magics = [];
  document.querySelectorAll('[data-magic]').forEach((el) => {
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    const spans = words.map((w, i) => { const s = document.createElement('span'); s.className = 'w'; s.textContent = w; el.appendChild(s); if (i < words.length - 1) el.appendChild(document.createTextNode(' ')); return s; });
    magics.push({ el, spans });
  });
  const paintMagic = () => {
    const vh = window.innerHeight;
    for (const m of magics) {
      const r = m.el.getBoundingClientRect();
      const p = clamp((vh * 0.9 - r.top) / (vh * 0.9 - vh * 0.45)); // starts when the top reaches 90% of the viewport, done at 45%
      const n = m.spans.length;
      for (let i = 0; i < n; i++) { const t = clamp((p - i / n) * n); m.spans[i].style.opacity = String(0.18 + 0.82 * t); }
    }
  };
  if (reduce) magics.forEach((m) => m.spans.forEach((s) => { s.style.opacity = '1'; }));

  /* ---------- reveals ---------- */
  document.querySelectorAll('[data-split]').forEach((el) => { el.querySelectorAll('.line').forEach((line, i) => { const inner = document.createElement('span'); inner.style.setProperty('--i', i); inner.textContent = line.textContent; line.textContent = ''; line.appendChild(inner); }); });
  const targets = document.querySelectorAll('[data-reveal], [data-split]');
  if (!reduce && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => { entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    targets.forEach((t) => io.observe(t));
    setTimeout(() => targets.forEach((t) => t.classList.add('in')), 2500);
  } else targets.forEach((t) => t.classList.add('in'));

  /* ---------- frame loop on scroll ---------- */
  let raf = 0;
  const frame = () => { raf = 0; if (!reduce) paintMagic(); };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(frame); };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  frame();
})();
