/* Scroll motion for the blocks layout (variant C).
   - Words light up with the scroll (the MagicText idea): the hero headline while it is pinned, other paragraphs as they pass through the viewport.
   - Elements reveal as they enter the viewport (headline masks, rules, ledger rows, cards, panels); items that enter together are staggered.
   - A thin progress line under the header.
   The CSS hides things only while this script runs (html.js without html.motion-fail), so nothing stays invisible if it fails to load. */
(function () {
  'use strict';
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
  const smooth = (a, b, n) => { const t = clamp((n - a) / (b - a)); return t * t * (3 - 2 * t); };
  root.classList.add('motion-ready');

  /* ---------- words that light up ---------- */
  const magics = Array.from(document.querySelectorAll('[data-magic]')).map((el) => {
    let spans = Array.from(el.querySelectorAll(':scope > .w'));
    if (!spans.length) { // markup without server-rendered words: wrap them now (plain spaces only, so non-breaking spaces stay inside words)
      const words = el.textContent.trim().split(/ +/);
      el.textContent = '';
      spans = words.map((w, i) => { const s = document.createElement('span'); s.className = 'w'; s.textContent = w; el.appendChild(s); if (i < words.length - 1) el.appendChild(document.createTextNode(' ')); return s; });
    }
    return { el, spans, hero: el.dataset.magic === 'hero', last: new Float32Array(spans.length).fill(-1) };
  });
  const setWords = (m, lit) => { // lit = number of fully lit words, fractional for the word being lit
    for (let i = 0; i < m.spans.length; i++) {
      const o = 0.18 + 0.82 * clamp(lit - i);
      if (Math.abs(o - m.last[i]) > 0.004) { m.spans[i].style.opacity = o.toFixed(3); m.last[i] = o; }
    }
  };
  const paintMagic = () => {
    const vh = window.innerHeight;
    for (const m of magics) {
      if (m.hero) continue;
      const r = m.el.getBoundingClientRect();
      let p;
      if (r.top >= vh) p = 0; else if (r.bottom <= 0) p = 1;
      else p = clamp((vh * 0.9 - r.top) / (vh * 0.65 + Math.min(r.height, vh * 0.9))); // starts when the top reaches 90% of the viewport, done when the bottom reaches about 25%
      setWords(m, m.spans.length * p);
    }
  };

  /* ---------- hero: the headline is pinned and its words light up over the scroll distance ---------- */
  const hero = document.querySelector('[data-hero]');
  const pin = hero && hero.querySelector('.hero-pin');
  const heroM = magics.find((m) => m.hero);
  const paintHero = () => {
    if (!hero || !pin || !heroM) return;
    const navH = parseFloat(getComputedStyle(root).getPropertyValue('--nav-h')) || 56;
    const dist = Math.max(1, hero.offsetHeight - pin.offsetHeight);
    const p = clamp((navH - hero.getBoundingClientRect().top) / dist);
    const q = clamp(p / 0.8); // the last fifth of the distance holds the finished headline
    setWords(heroM, heroM.spans.length * (0.2 + 0.8 * q));
    hero.style.setProperty('--hero-hint', (1 - smooth(0, 0.06, p)).toFixed(3));
  };

  /* ---------- reveals ---------- */
  const targets = Array.from(document.querySelectorAll('[data-reveal]'));
  const show = (el) => { el.classList.add('in'); setTimeout(() => el.style.removeProperty('--i'), 2400); };
  if (reduce || !('IntersectionObserver' in window)) targets.forEach((t) => t.classList.add('in'));
  else {
    const io = new IntersectionObserver((entries) => {
      const batch = entries.filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left);
      batch.forEach((e, i) => { e.target.style.setProperty('--i', String(Math.min(i, 5))); show(e.target); io.unobserve(e.target); });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.06 });
    targets.forEach((t) => io.observe(t));
  }

  /* ---------- big titles drift slightly slower than the page ---------- */
  const drifters = Array.from(document.querySelectorAll('.rail h2, .page-title'));
  const paintDrift = () => {
    const vh = window.innerHeight;
    for (const el of drifters) {
      const r = el.getBoundingClientRect();
      if (r.bottom < -80 || r.top > vh + 80) continue;
      const d = clamp((r.top + r.height / 2 - vh * 0.5) / vh, -1, 1) * -26; // up to 26px against the scroll direction
      el.style.setProperty('--drift', d.toFixed(1) + 'px');
    }
  };

  /* ---------- progress line ---------- */
  const header = document.querySelector('.site-header');
  let bar = null;
  if (header) { bar = document.createElement('div'); bar.className = 'scrollbar'; bar.setAttribute('aria-hidden', 'true'); header.appendChild(bar); }
  const paintBar = () => {
    if (!bar) return;
    const max = root.scrollHeight - window.innerHeight;
    bar.style.setProperty('--p', max > 0 ? clamp(window.scrollY / max).toFixed(4) : '0');
  };

  /* ---------- frame loop ---------- */
  let raf = 0;
  const frame = () => { raf = 0; if (!reduce) { paintMagic(); paintHero(); paintDrift(); } paintBar(); };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(frame); };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  if (window.ResizeObserver) new ResizeObserver(schedule).observe(document.body);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
  frame();
})();
