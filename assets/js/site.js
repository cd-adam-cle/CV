/* Site behaviour: mobile nav, theme toggle and scroll-spy. Scroll animations live in motion.js (variant C only). */
(function () {
  'use strict';
  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('.nav-toggle');
  const menu = document.getElementById('nav-menu');
  document.documentElement.classList.add('js-ready');

  /* mobile menu: overlay with the page behind made inert */
  if (toggle && menu) {
    const behind = [document.querySelector('main'), document.querySelector('.site-footer')].filter(Boolean);
    const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';
    const setOpen = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('nav-open', open);
      behind.forEach((el) => { if (open) el.setAttribute('inert', ''); else el.removeAttribute('inert'); });
    };
    toggle.addEventListener('click', () => setOpen(!isOpen()));
    menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) { setOpen(false); toggle.focus(); } });
    const wide = window.matchMedia('(min-width: 1024px)');
    const onWide = () => { if (wide.matches && isOpen()) setOpen(false); };
    if (wide.addEventListener) wide.addEventListener('change', onWide); else if (wide.addListener) wide.addListener(onWide);
  }

  /* theme: follows the system unless the visitor picks one (stored as "light" or "dark"); charts and the contribution graph listen for "themechange" */
  const themeBtn = document.querySelector('[data-theme-toggle]');
  if (themeBtn) {
    const root = document.documentElement;
    const mqDark = window.matchMedia('(prefers-color-scheme: dark)');
    const metas = Array.from(document.querySelectorAll('meta[name="theme-color"]'));
    const colorOf = (dark) => { const m = metas.find((x) => /dark/.test(x.media || '') === dark); return m ? m.getAttribute('content') : null; };
    const current = () => root.getAttribute('data-theme') || (mqDark.matches ? 'dark' : 'light');
    const sync = () => themeBtn.setAttribute('aria-pressed', String(current() === 'dark'));
    const announce = () => window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: current() } }));
    let animTimer = 0;
    themeBtn.addEventListener('click', () => {
      const next = current() === 'dark' ? 'light' : 'dark';
      root.classList.add('theme-anim'); clearTimeout(animTimer); animTimer = setTimeout(() => root.classList.remove('theme-anim'), 450);
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) { /* private mode: the choice just lasts for this visit */ }
      const c = colorOf(next === 'dark'); if (c) metas.forEach((m) => m.setAttribute('content', c));
      sync(); announce();
    });
    const onSystem = () => { if (!root.getAttribute('data-theme')) { sync(); announce(); } };
    if (mqDark.addEventListener) mqDark.addEventListener('change', onSystem); else if (mqDark.addListener) mqDark.addListener(onSystem);
    sync();
  }

  /* scroll-spy */
  const links = Array.from(document.querySelectorAll('[data-spy]'));
  const sections = links.map((l) => document.getElementById(l.dataset.spy)).filter(Boolean);
  if ('IntersectionObserver' in window && sections.length) {
    const visible = new Map();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => visible.set(en.target.id, en.isIntersecting ? en.intersectionRatio : 0));
      let bestId = null, best = 0;
      for (const [id, ratio] of visible) if (ratio > best) { best = ratio; bestId = id; }
      links.forEach((l) => { const on = l.dataset.spy === bestId; l.classList.toggle('is-active', on); if (on) l.setAttribute('aria-current', 'location'); else l.removeAttribute('aria-current'); });
    }, { rootMargin: '-35% 0px -55% 0px', threshold: [0, 0.1, 0.25, 0.5] });
    sections.forEach((s) => io.observe(s));
  }

})();
