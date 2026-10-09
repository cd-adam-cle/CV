/* Notes on the tagged phrases of the hero and the profile (variant C, built from content.hints by build.mjs).
   Each phrase is a link (a.hint) to the section or item it refers to, described by a hidden span#hint-<id>. This script shows the
   description and the same link in a small note next to the phrase:
   - mouse: after a short hover; the pointer can move into the note, which closes a moment after the pointer leaves both;
   - keyboard: while the phrase has visible focus; Escape closes it, Enter follows the link as usual;
   - touch and pen: the first tap opens the note instead of following the link, a second tap (or the link in the note) follows it.
   The note is decoration for pointer and keyboard users (aria-hidden, its link is not in the tab order): screen readers get the
   description through aria-describedby, and the phrase itself is the link. While a note is open, motion.js shows the phrase's drawing. */
(function () {
  'use strict';
  const triggers = Array.from(document.querySelectorAll('a.hint[data-hint]'));
  if (!triggers.length) return;
  const root = document.documentElement;
  const pop = document.createElement('div');
  pop.className = 'hint-pop';
  pop.setAttribute('aria-hidden', 'true');
  const text = document.createElement('p');
  text.className = 'hint-text';
  const link = document.createElement('a');
  link.className = 'hint-link';
  link.tabIndex = -1;
  pop.append(text, link);
  let cur = null, openTimer = 0, closeTimer = 0, lastPointer = 'mouse';

  const announce = (t, fig) => document.dispatchEvent(new CustomEvent('hintchange', { detail: { fig, host: t.closest('[data-magic]') } }));
  // the boxes of the phrase merged into one rectangle per line (an inline link without its own box reports one per word)
  const lines = (t) => {
    const out = [];
    Array.from(t.getClientRects()).filter((r) => r.width > 0 && r.height > 0).forEach((r) => {
      const mid = (r.top + r.bottom) / 2, l = out.find((q) => mid > q.top && mid < q.bottom);
      if (l) { l.left = Math.min(l.left, r.left); l.right = Math.max(l.right, r.right); l.top = Math.min(l.top, r.top); l.bottom = Math.max(l.bottom, r.bottom); }
      else out.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom });
    });
    return out.sort((a, b) => a.top - b.top);
  };
  // below the phrase (under its last line, from where that line of the phrase starts), or above its first line when there is no room below
  const place = (t) => {
    const rects = lines(t);
    if (!rects.length) return;
    const first = rects[0], last = rects[rects.length - 1];
    const base = (pop.offsetParent || document.body).getBoundingClientRect();
    const vw = root.clientWidth, vh = window.innerHeight, edge = 12, gap = 10;
    const navH = parseFloat(getComputedStyle(root).getPropertyValue('--nav-h')) || 56;
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let anchor = last, top = last.bottom + gap;
    if (top + ph > vh - edge && first.top - gap - ph >= navH + edge) { anchor = first; top = first.top - gap - ph; }
    const left = Math.max(edge, Math.min(anchor.left, vw - edge - pw));
    pop.style.left = Math.round(left - base.left) + 'px';
    pop.style.top = Math.round(top - base.top) + 'px';
  };
  const open = (t) => {
    clearTimeout(openTimer); clearTimeout(closeTimer);
    if (cur === t) return;
    if (cur) cur.classList.remove('is-open');
    cur = t;
    t.classList.add('is-open');
    const note = document.getElementById('hint-' + t.dataset.hint);
    text.textContent = note ? note.textContent : '';
    link.textContent = t.dataset.hintLink || '';
    link.href = t.getAttribute('href');
    if (t.target) { link.target = t.target; link.rel = t.rel; } else { link.removeAttribute('target'); link.removeAttribute('rel'); }
    const host = t.closest('.hero-pin, .lead-row') || document.body;
    if (pop.parentNode !== host) host.appendChild(pop);
    place(t);
    pop.classList.add('is-open');
    announce(t, t.dataset.hint);
  };
  const close = () => {
    clearTimeout(openTimer); clearTimeout(closeTimer);
    if (!cur) return;
    const t = cur;
    cur = null;
    t.classList.remove('is-open');
    pop.classList.remove('is-open');
    announce(t, null);
  };
  const closeSoon = (ms) => { clearTimeout(closeTimer); closeTimer = setTimeout(close, ms); };
  // a click from a finger or a pen (keyboard clicks have detail 0; older browsers report no pointerType on click events)
  const tapped = (e) => e.detail !== 0 && (e.pointerType ? e.pointerType === 'touch' || e.pointerType === 'pen' : lastPointer === 'touch' || lastPointer === 'pen');

  triggers.forEach((t) => {
    t.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse') return;
      clearTimeout(closeTimer); clearTimeout(openTimer);
      if (cur !== t) openTimer = setTimeout(() => open(t), cur ? 0 : 120);
    });
    t.addEventListener('pointerleave', (e) => {
      if (e.pointerType !== 'mouse') return;
      clearTimeout(openTimer);
      if (cur === t) closeSoon(220);
    });
    // only keyboard focus opens a note: a mouse click or a tap also focuses the link, but must not count as a first tap
    t.addEventListener('focus', () => { if (t.matches(':focus-visible')) open(t); });
    t.addEventListener('blur', (e) => {
      if (cur === t && !pop.contains(e.relatedTarget) && !t.matches(':hover') && !pop.matches(':hover')) closeSoon(120);
    });
    t.addEventListener('click', (e) => {
      if (tapped(e) && cur !== t) { e.preventDefault(); open(t); return; }
      close(); // the link is being followed
    });
  });
  pop.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') clearTimeout(closeTimer); });
  pop.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && cur && !cur.matches(':hover')) closeSoon(220); });
  link.addEventListener('click', () => close());
  // the pointer type of the latest press decides how a click is read; a press outside the phrase and the note closes it
  document.addEventListener('pointerdown', (e) => {
    lastPointer = e.pointerType || 'mouse';
    if (cur && !cur.contains(e.target) && !pop.contains(e.target)) close();
  }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && cur) close();
  });
  // phones resize the viewport while the address bar slides away: keep the note in place then, close it only when the width changes
  let lastW = root.clientWidth;
  window.addEventListener('resize', () => {
    const w = root.clientWidth, changed = w !== lastW;
    lastW = w;
    if (cur) { if (changed) close(); else place(cur); }
  });
})();
