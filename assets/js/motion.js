/* Motion for the blocks layout: word-by-word reading reveal, line reveals, block reveals, and a scroll portal through the name.
   Portal approach adapted from Glyph Portal © 2026 Christian Katzmann, MIT (ktzm.dk): a scroll-driven camera through live type. */
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
      const p = clamp((vh * 0.9 - r.top) / (vh * 0.9 - vh * 0.25)); // starts when the top reaches 90% of the viewport, done at 25%
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

  /* ---------- portal ---------- */
  const portal = document.querySelector('[data-portal]');
  let paintPortal = () => {};
  if (portal && !reduce) {
    const pin = portal.querySelector('.portal-pin'); const field = portal.querySelector('.portal-field');
    const art = portal.querySelector('.portal-art'); const glyph = portal.querySelector('[data-portal-glyph]'); const clip = portal.querySelector('#portal-clip');
    const text = glyph.textContent;
    const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let W = 1, H = 1, travel = 1, startScale = 1, endScale = 1, bounds = null, center = null, target = null, ready = false;

    // Largest opaque square inside a glyph, in linear time; works for O, S and Ø, not only stems.
    const interior = (char, font) => {
      ctx.font = font; const m = ctx.measureText(char); const pad = 8;
      const left = Math.ceil(m.actualBoundingBoxLeft), ascent = Math.ceil(m.actualBoundingBoxAscent);
      canvas.width = Math.max(1, Math.ceil(m.actualBoundingBoxLeft + m.actualBoundingBoxRight) + pad * 2);
      canvas.height = Math.max(1, Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) + pad * 2);
      ctx.font = font; ctx.fontKerning = 'none'; ctx.fillText(char, pad + left, pad + ascent);
      const { width, height } = canvas; const px = ctx.getImageData(0, 0, width, height).data; const rows = new Uint16Array(width + 1);
      let size = 0, bx = 0, by = 0;
      for (let y = 0; y < height; y++) { let diag = 0; for (let x = 0; x < width; x++) { const above = rows[x + 1]; rows[x + 1] = px[(y * width + x) * 4 + 3] > 245 ? Math.min(above, rows[x], diag) + 1 : 0; diag = above; if (rows[x + 1] > size) { size = rows[x + 1]; bx = x; by = y; } } }
      if (size < 3) return null;
      return { x: (bx + 1 - size / 2 - pad - left) / 3, y: (by + 1 - size / 2 - pad - ascent) / 3, radius: (size / 2 - 1) / 3 };
    };
    const readInk = () => {
      const fs = getComputedStyle(glyph); const family = fs.fontFamily, weight = fs.fontWeight;
      const ls = '0px'; // the clip text is set without letter-spacing; SVG clip paths do not honour it reliably
      ctx.font = `${weight} 100px ${family}`; ctx.fontKerning = 'none'; ctx.letterSpacing = ls;
      const m = ctx.measureText(text);
      bounds = { x: -m.actualBoundingBoxLeft, y: -m.actualBoundingBoxAscent, width: m.actualBoundingBoxLeft + m.actualBoundingBoxRight, height: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent };
      if (!bounds.width || !bounds.height) return false;
      center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
      const cands = []; let offset = 0;
      for (const ch of Array.from(text)) {
        ctx.font = `${weight} 100px ${family}`; ctx.letterSpacing = ls; ctx.fontKerning = 'none'; const adv = ctx.measureText(text.slice(0, offset)).width;
        const found = interior(ch, `${weight} 300px ${family}`);
        if (found) cands.push({ x: found.x + adv, y: found.y, radius: found.radius });
        offset += ch.length;
      }
      // Prefer a roomy counter close to the middle of the word, so the camera never crosses a gap between letters.
      const best = Math.max(0, ...cands.map((c) => c.radius));
      target = cands.filter((c) => c.radius >= best * 0.72).sort((a, b) => Math.abs(a.x - center.x) - Math.abs(b.x - center.x))[0] || null;
      return !!target;
    };
    const layout = () => {
      W = pin.clientWidth; H = pin.clientHeight; travel = portal.offsetHeight - H;
      art.setAttribute('viewBox', `0 0 ${W} ${H}`);
      if (!ready) ready = readInk();
      if (!ready) { portal.setAttribute('data-portal-static', ''); return; }
      startScale = Math.min(W * 0.84 / bounds.width, H * 0.38 / bounds.height);
      endScale = Math.max(startScale, Math.hypot(W, H) / (target.radius * 1.35));
      portal.setAttribute('data-portal-ready', '');
    };
    paintPortal = () => {
      if (!ready) return;
      const p = clamp(-portal.getBoundingClientRect().top / travel);
      const t = clamp(p / 0.78);
      const eased = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
      const scale = Math.exp(Math.log(startScale) + Math.log(endScale / startScale) * eased);
      const blend = endScale === startScale ? 0 : (1 / scale - 1 / startScale) / (1 / endScale - 1 / startScale);
      const cx = center.x + (target.x - center.x) * blend, cy = center.y + (target.y - center.y) * blend;
      const roll = -4 * smooth(0.06, 0.5, t) * (1 - smooth(0.62, 0.92, t));
      // Scale and rotate the clip itself; keep only a translation on the text. Scaling the text directly hits glyph paint limits.
      const rad = roll * Math.PI / 180; const dx = W / 2 / scale, dy = (H * 0.46 + H * 0.04 * eased) / scale;
      clip.setAttribute('transform', `scale(${scale}) rotate(${roll})`);
      glyph.setAttribute('transform', `translate(${Math.cos(rad) * dx + Math.sin(rad) * dy - cx} ${-Math.sin(rad) * dx + Math.cos(rad) * dy - cy})`);
      field.style.clipPath = t >= 1 ? 'none' : 'url(#portal-clip)';
      portal.style.setProperty('--portal-caption', String(1 - smooth(0.01, 0.16, p)));
      portal.style.setProperty('--portal-reveal', String(smooth(0.78, 0.9, p)));
    };
    const start = () => { layout(); paintPortal(); };
    if (document.fonts && document.fonts.load) {
      Promise.all([document.fonts.load('800 100px "Archivo"', text), document.fonts.ready]).then(start).catch(start);
      setTimeout(() => { if (!ready) start(); }, 2500);
    } else start();
    new ResizeObserver(() => { ready = false; layout(); paintPortal(); }).observe(pin);
  }

  /* ---------- frame loop on scroll ---------- */
  let raf = 0;
  const frame = () => { raf = 0; if (!reduce) paintMagic(); paintPortal(); };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(frame); };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  frame();
})();
