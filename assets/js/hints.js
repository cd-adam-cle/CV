/* Notes on the tagged phrases of the hero and the profile (variant C, built from content.hints by build.mjs).
   Each phrase is a link (a.hint) to the section or item it refers to, described by a hidden span#hint-<id>. This script shows the
   description and the same link in a small note next to the phrase:
   - mouse: once the pointer has moved onto a phrase and rests there for a moment (passing over phrases opens nothing, and content
     scrolling under a still pointer opens nothing either). The note stays while the pointer heads for it, even on a long diagonal,
     and closes a moment after the pointer leaves both or moves away. Another phrase takes over only when the pointer rests on it.
     Scrolling closes a note the mouse opened, so it never covers the words lighting up; Escape closes it until the pointer leaves;
   - keyboard: while the phrase has visible focus (placed again once the focus scroll settles); Escape closes it, Enter follows the
     link as usual;
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
  pop.hidden = true; // out of the layout while closed, so a note left at an old position can never widen the page
  const text = document.createElement('p');
  text.className = 'hint-text';
  const link = document.createElement('a');
  link.className = 'hint-link';
  link.tabIndex = -1;
  pop.append(text, link);
  const OPEN_MS = 120, SWITCH_MS = 220, CLOSE_MS = 300, FADE_MS = 260, STILL_PX = 6, SCROLL_PX = 24;
  let cur = null, via = '', armed = null, muted = null, openTimer = 0, closeTimer = 0, hideTimer = 0, settleTimer = 0;
  let lastPointer = 'mouse', restX = 0, restY = 0, closing = false, lastDist = Infinity, openY = 0;

  const hostOf = (t) => t.closest('[data-magic]');
  const announce = (t, fig) => document.dispatchEvent(new CustomEvent('hintchange', { detail: { fig, host: hostOf(t) } }));
  // the underlined words merged into one rectangle per line (an inline link without a box of its own reports one rectangle per word)
  const lines = (t) => {
    const us = t.querySelectorAll('.u');
    const src = us.length ? Array.from(us).flatMap((u) => Array.from(u.getClientRects())) : Array.from(t.getClientRects());
    const out = [];
    src.filter((r) => r.width > 0 && r.height > 0).forEach((r) => {
      const mid = (r.top + r.bottom) / 2, l = out.find((q) => mid > q.top && mid < q.bottom);
      if (l) { l.left = Math.min(l.left, r.left); l.right = Math.max(l.right, r.right); l.top = Math.min(l.top, r.top); l.bottom = Math.max(l.bottom, r.bottom); }
      else out.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom });
    });
    return out.sort((a, b) => a.top - b.top);
  };
  // CSS keeps a wrapped max-content box at its max-width; shrink the box to its longest line, but never at the cost of an extra line
  const fit = () => {
    pop.style.width = '';
    const h = text.offsetHeight, rg = document.createRange();
    rg.selectNodeContents(text);
    const rs = Array.from(rg.getClientRects()).filter((q) => q.width > 0);
    if (rs.length < 2) return;
    const cs = getComputedStyle(pop);
    const extra = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
    const left = Math.min(...rs.map((q) => q.left));
    const w = Math.max(Math.max(...rs.map((q) => q.right)) - left, link.getBoundingClientRect().width);
    pop.style.width = Math.ceil(w + extra) + 1 + 'px';
    if (text.offsetHeight > h) pop.style.width = '';
  };
  // under the phrase (its last line, from where the underline starts on that line), above its first line when there is no room
  // below, and when neither fits (a phone held sideways) wherever the whole note stays on screen
  const place = (t) => {
    const rects = lines(t);
    if (!rects.length) return;
    const first = rects[0], last = rects[rects.length - 1];
    const base = (pop.offsetParent || document.body).getBoundingClientRect();
    const vw = root.clientWidth, vh = window.innerHeight, edge = 12, gap = 10;
    const navH = parseFloat(getComputedStyle(root).getPropertyValue('--nav-h')) || 56;
    const pw = pop.offsetWidth, ph = pop.offsetHeight, highest = navH + edge, lowest = vh - edge - ph;
    let anchor = last, top = last.bottom + gap;
    if (top > lowest) {
      if (first.top - gap - ph >= highest) { anchor = first; top = first.top - gap - ph; }
      else top = Math.max(highest, lowest);
    }
    const left = Math.max(edge, Math.min(anchor.left, vw - edge - pw));
    pop.style.left = Math.round(left - base.left) + 'px';
    pop.style.top = Math.round(top - base.top) + 'px';
  };
  const hideNow = () => { clearTimeout(hideTimer); if (!cur) { pop.hidden = true; pop.style.left = ''; pop.style.top = ''; } };
  const keep = () => { clearTimeout(closeTimer); closing = false; };
  const disarm = () => { clearTimeout(openTimer); armed = null; };
  const open = (t, how) => {
    disarm(); keep(); clearTimeout(hideTimer);
    via = how;
    openY = window.scrollY;
    if (cur === t) return;
    if (cur) {
      cur.classList.remove('is-open');
      if (hostOf(cur) !== hostOf(t)) announce(cur, null); // the other text goes back to its scroll-chosen drawing
    }
    cur = t;
    t.classList.add('is-open');
    const note = document.getElementById('hint-' + t.dataset.hint);
    text.textContent = note ? note.textContent : '';
    link.textContent = t.dataset.hintLink || '';
    link.href = t.getAttribute('href');
    if (t.target) { link.target = t.target; link.rel = t.rel; } else { link.removeAttribute('target'); link.removeAttribute('rel'); }
    const host = t.closest('.hero-pin, .lead-row') || document.body;
    if (pop.parentNode !== host) host.appendChild(pop);
    pop.hidden = false;
    fit();
    place(t); // reading the layout here also lets the fade-in run after the box was hidden
    pop.classList.add('is-open');
    announce(t, t.dataset.hint);
  };
  // now = true takes the box out of the layout at once, otherwise after the fade-out
  const close = (now) => {
    disarm(); keep(); clearTimeout(hideTimer);
    if (cur) {
      const t = cur;
      cur = null;
      via = '';
      t.classList.remove('is-open');
      pop.classList.remove('is-open');
      announce(t, null);
    }
    if (now === true) hideNow(); else hideTimer = setTimeout(hideNow, FADE_MS);
  };
  const distToPop = (x, y) => {
    const r = pop.getBoundingClientRect();
    return Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));
  };
  const closeSoon = (ms, e) => {
    clearTimeout(closeTimer);
    closing = true;
    if (e) lastDist = distToPop(e.clientX, e.clientY);
    closeTimer = setTimeout(close, ms);
  };
  // hover intent: a phrase opens (or takes over from an open note) only after the pointer has stayed within a few pixels for a moment
  const arm = (t, e) => {
    clearTimeout(openTimer);
    armed = t; restX = e.clientX; restY = e.clientY;
    openTimer = setTimeout(() => open(t, 'mouse'), cur ? SWITCH_MS : OPEN_MS);
  };
  // after a keyboard open the browser may still be scrolling the phrase into view: place the note again once that settles
  const settle = (ms) => {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => { if (cur && via === 'key') place(cur); }, ms);
  };
  // a click from a finger or a pen (keyboard clicks have detail 0; older browsers report no pointerType on click events)
  const tapped = (e) => e.detail !== 0 && (e.pointerType ? e.pointerType === 'touch' || e.pointerType === 'pen' : lastPointer === 'touch' || lastPointer === 'pen');

  triggers.forEach((t) => {
    // only real moves count: content scrolling under a still mouse fires enter and leave events, never moves
    t.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || muted === t) return;
      if (cur === t) { if (via === 'mouse') keep(); disarm(); return; }
      if (armed !== t || Math.hypot(e.clientX - restX, e.clientY - restY) > STILL_PX) arm(t, e);
    });
    t.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && cur === t && via === 'mouse') keep(); });
    t.addEventListener('pointerleave', (e) => {
      if (e.pointerType !== 'mouse') return;
      if (muted === t) muted = null;
      if (armed === t) disarm();
      if (cur && via === 'mouse') closeSoon(CLOSE_MS, e); // also when the pointer only crossed this phrase on its way to the note
    });
    // only keyboard focus opens a note: a mouse click or a tap also focuses the link, but must not count as a first tap
    t.addEventListener('focus', () => {
      if (!t.matches(':focus-visible')) return;
      open(t, 'key');
      settle(650);
    });
    t.addEventListener('blur', () => { if (cur === t && via === 'key') closeSoon(120); });
    t.addEventListener('click', (e) => {
      if (tapped(e) && cur !== t) { e.preventDefault(); open(t, 'touch'); return; }
      close(); // the link is being followed
    });
  });
  // only a note the mouse opened is kept by the pointer; a keyboard note follows the focus (and may scroll under a resting mouse)
  pop.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'mouse') return; disarm(); if (via === 'mouse') keep(); });
  pop.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && cur && via === 'mouse') closeSoon(CLOSE_MS, e); });
  link.addEventListener('click', () => close());
  // while a close is pending, every move that brings the pointer closer to the note postpones it
  document.addEventListener('pointermove', (e) => {
    if (!closing || !cur || via !== 'mouse' || e.pointerType !== 'mouse') return;
    const d = distToPop(e.clientX, e.clientY);
    if (d < lastDist - 0.5) { clearTimeout(closeTimer); closeTimer = setTimeout(close, CLOSE_MS); }
    lastDist = d;
  }, { passive: true });
  // the pointer type of the latest press decides how a click is read; a press outside the phrase and the note closes it
  document.addEventListener('pointerdown', (e) => {
    lastPointer = e.pointerType || 'mouse';
    if (cur && !cur.contains(e.target) && !pop.contains(e.target)) close();
  }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !cur) return;
    if (via === 'mouse') muted = cur; // a dismissed hover note stays closed until the pointer leaves its phrase
    close();
  });
  window.addEventListener('scroll', () => {
    if (!cur) return;
    if (via === 'mouse' && Math.abs(window.scrollY - openY) > SCROLL_PX) close(); // the scroll story wins over a resting pointer
    else if (via === 'key') settle(160);
  }, { passive: true });
  // zoom, rotation or a resized window: keep the note with its phrase (a hidden phrase closes it)
  window.addEventListener('resize', () => {
    if (!cur) { hideNow(); return; }
    if (!lines(cur).length) { close(true); return; }
    fit();
    place(cur);
  });
})();
