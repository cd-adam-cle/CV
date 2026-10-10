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
    let spans = Array.from(el.querySelectorAll('.w:not([data-sat])'));
    if (!spans.length) { // markup without server-rendered words: wrap them now (plain spaces only, so non-breaking spaces stay inside words)
      const words = el.textContent.trim().split(/ +/);
      el.textContent = '';
      spans = words.map((w, i) => { const s = document.createElement('span'); s.className = 'w'; s.textContent = w; el.appendChild(s); if (i < words.length - 1) el.appendChild(document.createTextNode(' ')); return s; });
    }
    // a glued preposition or punctuation kept outside a phrase's link (data-sat) lights up with the word next to it
    const sats = Array.from(el.querySelectorAll('.w[data-sat]')).map((s) => {
      const next = s.dataset.sat === 'next';
      let i = next ? spans.findIndex((w) => s.compareDocumentPosition(w) & Node.DOCUMENT_POSITION_FOLLOWING) : -1;
      if (!next) for (let k = spans.length - 1; k >= 0 && i < 0; k--) if (s.compareDocumentPosition(spans[k]) & Node.DOCUMENT_POSITION_PRECEDING) i = k;
      return { s, i, last: -1 };
    }).filter((x) => x.i >= 0);
    return { el, spans, sats, hero: el.dataset.magic === 'hero', last: new Float32Array(spans.length).fill(-1) };
  });
  /* figures beside the lit words (hero and profile): the latest tagged phrase whose first word is at least half lit picks one */
  magics.forEach((m) => {
    const art = m.el.dataset.art ? document.getElementById(m.el.dataset.art) : null;
    if (!art) return;
    const list = [], seen = new Set();
    m.spans.forEach((s, i) => {
      const id = s.dataset.fig;
      if (!id || seen.has(id)) return;
      seen.add(id);
      const el = art.querySelector(`.fig[data-fig="${id}"]`);
      if (el) list.push({ first: i, el });
    });
    if (list.length) m.figs = { list, active: null, box: art };
  });
  const showFig = (m, lit) => {
    if (!m.figs) return;
    let cur = null;
    for (const f of m.figs.list) if (lit >= f.first + 0.5) cur = f;
    const held = m.figs.scroll; // a little hysteresis: scrolling back a word does not flip the drawing back and forth
    if (held && cur !== held && (!cur || cur.first < held.first) && lit >= held.first - 0.5) cur = held;
    m.figs.scroll = cur; // the scroll choice is kept apart, so closing a note returns exactly to it
    if (m.figs.hover) cur = m.figs.hover; // a phrase whose note is open (hints.js) shows its drawing
    if (cur === m.figs.active) return;
    if (m.figs.active) m.figs.active.el.classList.remove('on');
    if (cur) cur.el.classList.add('on', 'drawn'); // drawn stays, so a figure draws itself once and later only fades
    m.figs.active = cur;
  };
  document.addEventListener('hintchange', (e) => {
    const m = magics.find((x) => x.el === e.detail.host);
    if (!m || !m.figs) return;
    m.figs.hover = (e.detail.fig && m.figs.list.find((f) => f.el.dataset.fig === e.detail.fig)) || null;
    showFig(m, m.lit || 0);
  });
  const FLOOR = 0.6; // dim words keep enough contrast to be read before they are lit
  const setWords = (m, lit) => { // lit = number of fully lit words, fractional for the word being lit
    m.lit = lit;
    for (let i = 0; i < m.spans.length; i++) {
      const o = FLOOR + (1 - FLOOR) * clamp(lit - i);
      if (Math.abs(o - m.last[i]) > 0.004) { m.spans[i].style.opacity = o.toFixed(3); m.last[i] = o; }
    }
    for (const x of m.sats) { const o = m.last[x.i]; if (o !== x.last) { x.s.style.opacity = o.toFixed(3); x.last = o; } }
    showFig(m, lit);
  };
  const paintMagic = () => {
    const vh = window.innerHeight;
    for (const m of magics) {
      if (m.hero) continue;
      const r = m.el.getBoundingClientRect();
      let p;
      if (r.top >= vh) p = 0; else if (r.bottom <= 0) p = 1;
      else if (m.figs && m.figs.box.offsetHeight) {
        // with a drawing beside it, the paragraph starts lighting only once the drawing is fully on screen
        const a = m.figs.box.getBoundingClientRect();
        const navH = parseFloat(getComputedStyle(root).getPropertyValue('--nav-h')) || 56;
        const room = vh - 24 - a.height - navH - 12; // scroll distance before the drawing would reach the header
        p = clamp((vh - 24 - a.bottom) / Math.max(160, Math.min(r.height * 0.85, room)));
      } else p = clamp((vh * 0.9 - r.top) / (vh * 0.45 + Math.min(r.height, vh * 0.9))); // starts when the top reaches 90% of the viewport, done when the bottom reaches about 45%
      setWords(m, m.spans.length * p);
    }
  };

  /* ---------- hero: the headline is pinned and its words light up over the scroll distance ---------- */
  const hero = document.querySelector('[data-hero]');
  const pin = hero && hero.querySelector('.hero-pin');
  const heroM = magics.find((m) => m.hero);
  const titleWords = heroM ? heroM.el.querySelectorAll('.w.l0:not([data-sat])').length : 0; // words marked l0 (up to the first tagged phrase) are lit from the start
  const paintHero = () => {
    if (!hero || !pin || !heroM) return;
    const navH = parseFloat(getComputedStyle(root).getPropertyValue('--nav-h')) || 56;
    const dist = Math.max(1, hero.offsetHeight - pin.offsetHeight);
    const p = clamp((navH - hero.getBoundingClientRect().top) / dist);
    const q = clamp(p / 0.88); // the last 12 % of the distance holds the finished headline
    const base = titleWords || Math.round(heroM.spans.length * 0.2);
    setWords(heroM, base + (heroM.spans.length - base) * q);
    hero.style.setProperty('--hero-hint', (1 - smooth(0, 0.06, p)).toFixed(3));
  };

  /* ---------- reveals ---------- */
  const targets = Array.from(document.querySelectorAll('[data-reveal]'));
  const show = (el) => { el.classList.add('in'); setTimeout(() => el.style.removeProperty('--i'), 2400); };
  // an element that receives keyboard focus is shown at once, so the focus ring is never on something invisible
  document.addEventListener('focusin', (e) => { const t = e.target.closest && e.target.closest('[data-reveal]:not(.in)'); if (t) show(t); });
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
