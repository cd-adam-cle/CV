/* Site behaviour: mobile nav, scroll-spy, compact header on scroll, gentle reveal (respects reduced motion). */
(function () {
  'use strict';
  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('.nav-toggle');
  const menu = document.getElementById('nav-menu');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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

  /* compact header after scrolling past the hero */
  let ticking = false;
  const onScroll = () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => { if (header) header.classList.toggle('is-compact', window.scrollY > 64); ticking = false; });
  };
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

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

  /* reveal on scroll: opacity/translate only, once, skipped under reduced motion */
  const revealables = document.querySelectorAll('.hero, .section');
  const revealAll = () => revealables.forEach((el) => el.classList.add('is-revealed'));
  if (!reduce && 'IntersectionObserver' in window) {
    const ro = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-revealed'); ro.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    revealables.forEach((el) => ro.observe(el));
    setTimeout(revealAll, 1500); // safety net: never leave content hidden
  } else {
    revealAll();
  }

  /* current year safety: nothing dynamic needed; keep static footer */
})();
