/* Quantitative instruments: Black–Scholes, Monte Carlo (GBM), Markowitz. Vanilla JS, canvas 2D, no dependencies.
   Markup contract: <article class="tool" data-tool="bs|mc|mk"> with number inputs [name], ranges [data-sync], toggles [data-role=seg], outputs [data-out]. */
(function () {
  'use strict';
  const lang = document.documentElement.lang || 'cs';
  const locale = lang === 'cs' ? 'cs-CZ' : 'en-GB';
  const nfCache = {};
  const nf = (d) => nfCache[d] || (nfCache[d] = new Intl.NumberFormat(locale, { minimumFractionDigits: d, maximumFractionDigits: d }));
  const minus = (s) => s.replace(/-/g, '−');
  const PCT = lang === 'cs' ? ' %' : '%';
  const fmt = {
    n: (x, d) => minus(nf(d).format(x)),
    int: (x) => minus(nf(0).format(Math.round(x))),
    pct: (x, d = 1) => minus(nf(d).format(x)) + PCT,
    signedPct: (x, d = 1) => (x > 0 ? '+' : '') + minus(nf(d).format(x)) + PCT,
    plusMinus: (x, d = 1) => '± ' + minus(nf(d).format(Math.abs(x))) + PCT,
  };
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const nfInCache = {};
  const nfIn = (d) => nfInCache[d] || (nfInCache[d] = new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: d, useGrouping: false }));
  const formatIn = (x, d) => minus(nfIn(d).format(x));
  const parseNum = (v) => parseFloat(String(v).replace(/[\s\u00a0]/g, '').replace(/\u2212/g, '-').replace(',', '.'));
  const fill = (tpl, vals) => tpl.replace(/\{(\w+)\}/g, (m, k) => (vals[k] != null ? vals[k] : m));

  /* ---------- theme from CSS custom properties ---------- */
  function theme(el) {
    const cs = getComputedStyle(el);
    const v = (name, fb) => (cs.getPropertyValue(name) || '').trim() || fb;
    return { ink: v('--ink', '#1a1917'), muted: v('--ink-2', '#6b6862'), line: v('--line', '#d9d5cc'), grid: v('--grid', '#e6e2da'),
      navy: v('--navy', '#22395b'), oxide: v('--oxide', '#b4472b'), cloud: v('--cloud', '#a39e94'), surface: v('--surface', '#faf9f6'), bg: v('--chart-bg', v('--bg', '#ffffff')), font: v('--font-chart', 'Georgia, serif'), fs: parseFloat(v('--chart-fs', '12')) || 12 };
  }

  /* ---------- canvas helpers ---------- */
  function setupCanvas(canvas) {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(160, Math.round(rect.width)); const h = Math.max(160, Math.round(rect.height || 300));
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }
  function niceTicks(min, max, n) {
    const span = max - min || 1; const step0 = span / Math.max(1, n);
    const mag = Math.pow(10, Math.floor(Math.log10(step0))); const norm = step0 / mag;
    const step = (norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10) * mag;
    const out = []; for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(10));
    return out;
  }
  function frame(ctx, t, box, xTicks, yTicks, xfmt, yfmt, xLabel, yLabel) {
    const { x0, y0, x1, y1, sx, sy } = box;
    ctx.font = `${t.fs}px ${t.font}`; ctx.lineWidth = 1;
    ctx.strokeStyle = t.grid;
    for (const yt of yTicks) { const py = Math.round(sy(yt)) + 0.5; if (py < y0 - 1 || py > y1 + 1) continue; ctx.beginPath(); ctx.moveTo(x0, py); ctx.lineTo(x1, py); ctx.stroke(); ctx.fillStyle = t.muted; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(yfmt(yt), x0 - 6, py); }
    ctx.strokeStyle = t.line; ctx.beginPath(); ctx.moveTo(x0, y1 + 0.5); ctx.lineTo(x1, y1 + 0.5); ctx.stroke();
    ctx.fillStyle = t.muted; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (const xt of xTicks) { const px = sx(xt); if (px < x0 - 1 || px > x1 + 1) continue; ctx.fillText(xfmt(xt), px, y1 + 6); }
    if (xLabel) { ctx.textAlign = 'right'; ctx.fillText(xLabel, x1, y1 + 20); }
    if (yLabel) { ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(yLabel, x0, y0 - 6); }
  }
  function label(ctx, t, text, x, y, color, align, baseline) {
    ctx.font = `${t.fs}px ${t.font}`; ctx.textAlign = align || 'left'; ctx.textBaseline = baseline || 'bottom';
    ctx.lineJoin = 'round'; ctx.strokeStyle = t.bg; ctx.lineWidth = 4; ctx.strokeText(text, x, y);
    ctx.fillStyle = color; ctx.fillText(text, x, y);
  }
  function polyline(ctx, pts, color, width, dash) {
    if (pts.length < 2) return; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []); ctx.beginPath();
    for (let i = 0; i < pts.length; i++) { const [x, y] = pts[i]; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke(); ctx.setLineDash([]);
  }

  /* ---------- maths ---------- */
  function erf(x) { const s = x < 0 ? -1 : 1; x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return s * y; }
  const N = (x) => 0.5 * (1 + erf(x / Math.SQRT2));
  const phi = (x) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  function blackScholes(type, S, K, sig, T, r) {
    const call = type === 'call';
    if (T <= 0 || sig <= 0) { const intr = call ? Math.max(S - K, 0) : Math.max(K - S, 0); return { price: intr, delta: call ? (S > K ? 1 : 0) : (S < K ? -1 : 0), gamma: 0, vega: 0, theta: 0, intrinsic: intr, timeValue: 0 }; }
    const sq = sig * Math.sqrt(T); const d1 = (Math.log(S / K) + (r + 0.5 * sig * sig) * T) / sq; const d2 = d1 - sq; const disc = Math.exp(-r * T);
    const price = call ? S * N(d1) - K * disc * N(d2) : K * disc * N(-d2) - S * N(-d1);
    const delta = call ? N(d1) : N(d1) - 1; const gamma = phi(d1) / (S * sq); const vega = S * phi(d1) * Math.sqrt(T) / 100;
    const thetaY = call ? -(S * phi(d1) * sig) / (2 * Math.sqrt(T)) - r * K * disc * N(d2) : -(S * phi(d1) * sig) / (2 * Math.sqrt(T)) + r * K * disc * N(-d2);
    const intrinsic = call ? Math.max(S - K, 0) : Math.max(K - S, 0);
    return { price, delta, gamma, vega, theta: thetaY / 365, intrinsic, timeValue: price - intrinsic };
  }
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function makeNormal(rand) { let spare = null; return () => { if (spare !== null) { const v = spare; spare = null; return v; } let u1 = rand(); if (u1 < 1e-12) u1 = 1e-12; const u2 = rand(); const R = Math.sqrt(-2 * Math.log(u1)); spare = R * Math.sin(2 * Math.PI * u2); return R * Math.cos(2 * Math.PI * u2); }; }
  function quantileSorted(a, p) { const i = (a.length - 1) * p; const lo = Math.floor(i), hi = Math.ceil(i); return a[lo] + (a[hi] - a[lo]) * (i - lo); }

  /* ---------- control binding ---------- */
  function decimalsOf(input) { if (input.dataset.decimals != null) return +input.dataset.decimals; const s = String(input.step || '1'); return s.includes('.') ? s.split('.')[1].length : 0; }
  function readInputs(form) {
    const o = {};
    form.querySelectorAll('input[data-num]').forEach((i) => { const v = parseNum(i.value); o[i.name] = Number.isFinite(v) ? clamp(v, +i.min, +i.max) : parseNum(i.defaultValue); });
    form.querySelectorAll('[data-role=seg]').forEach((seg) => { const on = seg.querySelector('[aria-pressed="true"]'); o[seg.dataset.name] = on ? on.dataset.value : null; });
    return o;
  }
  function stepInput(num, dir, big) {
    const st = parseFloat(num.step) || 1; const v = parseNum(num.value); const base = Number.isFinite(v) ? v : parseNum(num.defaultValue);
    const nv = clamp(Math.round((base + dir * st * (big ? 10 : 1)) / st) * st, +num.min, +num.max);
    num.value = formatIn(+nv.toFixed(6), decimalsOf(num));
  }
  function bindControls(form, onChange) {
    const ranges = {}; form.querySelectorAll('input[type=range][data-sync]').forEach((r) => { ranges[r.dataset.sync] = r; });
    form.querySelectorAll('input[data-num]').forEach((num) => {
      const range = ranges[num.name];
      const sync = () => { const v = parseNum(num.value); if (range && Number.isFinite(v)) range.value = clamp(v, +range.min, +range.max); onChange(); };
      num.addEventListener('input', sync);
      num.addEventListener('change', () => { const v = parseNum(num.value); num.value = Number.isFinite(v) ? formatIn(clamp(v, +num.min, +num.max), decimalsOf(num)) : num.defaultValue; sync(); });
      num.addEventListener('keydown', (e) => { if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return; e.preventDefault(); stepInput(num, e.key === 'ArrowUp' ? 1 : -1, e.shiftKey); sync(); });
      if (range) range.addEventListener('input', () => { num.value = formatIn(+range.value, decimalsOf(num)); onChange(); });
    });
    form.querySelectorAll('[data-role=seg]').forEach((seg) => seg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); onChange();
    })));
  }
  function resetForm(form) {
    form.reset();
    form.querySelectorAll('input[type=range][data-sync]').forEach((range) => { const num = form.querySelector(`input[data-num][name="${range.dataset.sync}"]`); if (num) range.value = parseNum(num.value); });
    form.querySelectorAll('[data-role=seg]').forEach((seg) => { const d = seg.dataset.default; seg.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', (d != null ? b.dataset.value === d : i === 0) ? 'true' : 'false')); });
    form.querySelectorAll('button[aria-pressed]:not([data-value])').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  }
  function setOut(root, key, text, neg) { const el = root.querySelector(`[data-out="${key}"]`); if (!el) return; el.textContent = text; if (neg != null) el.classList.toggle('is-neg', !!neg); }
  function live(root, tpl, vals) { const el = root.querySelector('[data-role=live]'); if (el && tpl) el.textContent = fill(tpl, vals); }
  function onFrame(fn) { let raf = 0; return () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; fn(); }); }; }
  function observe(canvas, redraw) { if ('ResizeObserver' in window) new ResizeObserver(redraw).observe(canvas.parentElement); else window.addEventListener('resize', redraw); }

  /* ================= 03.1 Black–Scholes ================= */
  function initBS(root, ui) {
    const form = root.querySelector('form'); const canvas = root.querySelector('canvas');
    let state = null;
    const compute = () => {
      const p = readInputs(form); const type = p.type || 'call';
      const S = p.S, K = p.K, sig = p.sigma / 100, T = p.T, r = p.r / 100;
      const g = blackScholes(type, S, K, sig, T, r);
      const xMin = Math.min(K * 0.5, S * 0.9), xMax = Math.max(K * 1.5, S * 1.1), n = 160; const curve = [], payoff = []; let yMax = 0;
      for (let i = 0; i <= n; i++) { const x = xMin + (xMax - xMin) * i / n; const v = blackScholes(type, x, K, sig, T, r).price; const pay = type === 'call' ? Math.max(x - K, 0) : Math.max(K - x, 0); curve.push([x, v]); payoff.push([x, pay]); yMax = Math.max(yMax, v, pay); }
      state = { type, S, K, g, xMin, xMax, curve, payoff, yMax: yMax * 1.08 || 1 };
      setOut(root, 'price', fmt.n(g.price, 2)); setOut(root, 'delta', fmt.n(g.delta, 4)); setOut(root, 'gamma', fmt.n(g.gamma, 4));
      setOut(root, 'vega', fmt.n(g.vega, 4)); setOut(root, 'theta', fmt.n(g.theta, 4), g.theta < 0); setOut(root, 'intrinsic', fmt.n(g.intrinsic, 2)); setOut(root, 'timeValue', fmt.n(g.timeValue, 2));
      live(root, ui.live, { price: fmt.n(g.price, 2), delta: fmt.n(g.delta, 4), theta: fmt.n(g.theta, 4) });
    };
    const draw = () => {
      if (!state) compute(); const s = state; const t = theme(root); const { ctx, w, h } = setupCanvas(canvas);
      const pad = { l: 44, r: 16, t: 20, b: 36 };
      const sx = (x) => pad.l + (x - s.xMin) / (s.xMax - s.xMin) * (w - pad.l - pad.r); const sy = (y) => h - pad.b - (y / s.yMax) * (h - pad.t - pad.b);
      frame(ctx, t, { x0: pad.l, y0: pad.t, x1: w - pad.r, y1: h - pad.b, sx, sy }, niceTicks(s.xMin, s.xMax, w < 360 ? 3 : 5), niceTicks(0, s.yMax, 4), fmt.int, fmt.int, ui.axisX, '');
      // strike tick
      label(ctx, t, 'K', sx(s.K) + 5, h - pad.b - 3, t.muted, 'left', 'bottom');
      polyline(ctx, s.payoff.map(([x, y]) => [sx(x), sy(y)]), t.cloud, 1, [4, 4]);
      polyline(ctx, s.curve.map(([x, y]) => [sx(x), sy(y)]), t.ink, 1.25);
      const px = sx(s.S), py = sy(s.g.price);
      ctx.strokeStyle = t.navy; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(Math.round(px) + 0.5, h - pad.b); ctx.lineTo(Math.round(px) + 0.5, py); ctx.stroke();
      ctx.fillStyle = t.ink; ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
      const left = px < pad.l + 110;
      label(ctx, t, `S = ${fmt.int(s.S)}: ${fmt.n(s.g.price, 2)}`, px + (left ? 8 : -8), py - 8, t.ink, left ? 'left' : 'right', 'bottom');
    };
    const recompute = onFrame(() => { compute(); draw(); }); const redraw = onFrame(draw);
    bindControls(form, recompute);
    root.querySelector('[data-role=reset]')?.addEventListener('click', () => { resetForm(form); compute(); draw(); });
    observe(canvas, redraw); compute(); draw();
    return draw;
  }

  /* ================= 03.2 Monte Carlo ================= */
  function initMC(root, ui) {
    const form = root.querySelector('form'); const canvas = root.querySelector('canvas');
    let seed = 20261005; let state = null;
    const JUMP = { lambda: 0.5, muJ: -0.15, sigJ: 0.10 }; // Merton jump-diffusion: rare crashes
    const simulate = (p, jump) => {
      const S0 = p.S0, mu = p.mu / 100, sig = p.sigma / 100; const steps = Math.round(+p.horizon || 252); const Np = Math.round(+p.paths || 500);
      const dt = 1 / 252, vol = sig * Math.sqrt(dt);
      const kappa = Math.exp(JUMP.muJ + 0.5 * JUMP.sigJ * JUMP.sigJ) - 1; // E[e^J] - 1
      const drift = (mu - 0.5 * sig * sig) * dt - (jump ? JUMP.lambda * kappa * dt : 0); // compensated so E[S_T] matches
      const pJump = JUMP.lambda * dt;
      const rand = mulberry32(seed); const z = makeNormal(rand); const jrand = mulberry32(seed ^ 0x9e3779b9); const jz = makeNormal(jrand);
      const grid = new Float64Array(Np * (steps + 1)); // all paths, row-major
      for (let k = 0; k < Np; k++) { let s = S0; grid[k * (steps + 1)] = s; for (let i = 1; i <= steps; i++) { let x = drift + vol * z(); if (jump && jrand() < pJump) x += JUMP.muJ + JUMP.sigJ * jz(); s *= Math.exp(x); grid[k * (steps + 1) + i] = s; } }
      const finals = new Float64Array(Np); for (let k = 0; k < Np; k++) finals[k] = grid[k * (steps + 1) + steps];
      const sorted = Array.from(finals).sort((a, b) => a - b);
      const median = quantileSorted(sorted, 0.5); const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length; const q05 = quantileSorted(sorted, 0.05);
      const ploss = sorted.filter((v) => v < S0).length / sorted.length;
      const nTail = Math.max(1, Math.ceil(0.05 * sorted.length)); let tailSum = 0; for (let i = 0; i < nTail; i++) tailSum += sorted[i]; const es05 = S0 - tailSum / nTail;
      // per-step percentiles (5, 50, 95)
      const col = new Float64Array(Np); const p05 = [], p50 = [], p95 = [];
      for (let i = 0; i <= steps; i++) { for (let k = 0; k < Np; k++) col[k] = grid[k * (steps + 1) + i]; const sc = Array.from(col).sort((a, b) => a - b); p05.push(quantileSorted(sc, 0.05)); p50.push(quantileSorted(sc, 0.5)); p95.push(quantileSorted(sc, 0.95)); }
      return { S0, steps, Np, grid, finals, sorted, median, mean, q05, var5: S0 - q05, es05, ploss, p05, p50, p95 };
    };
    const compute = () => {
      const p = readInputs(form); const fat = p.dist === 'jump';
      const rn = simulate(p, false); const rt = simulate(p, true);
      state = { p, fat, rn, rt, sel: fat ? rt : rn };
      const put = (key, a, b, oxide) => { setOut(root, key + '-n', a); setOut(root, key + '-t', b); };
      put('median', fmt.n(rn.median, 2), fmt.n(rt.median, 2)); put('mean', fmt.n(rn.mean, 2), fmt.n(rt.mean, 2));
      put('var', fmt.n(rn.var5, 2), fmt.n(rt.var5, 2)); put('es', fmt.n(rn.es05, 2), fmt.n(rt.es05, 2)); put('ploss', fmt.pct(100 * rn.ploss, 1), fmt.pct(100 * rt.ploss, 1));
      root.querySelectorAll('[data-role=var-delta], [data-role=legend-normal]').forEach((el) => { el.hidden = !fat; });
      setOut(root, 'varDelta', rn.var5 > 0 ? fmt.signedPct(100 * (rt.var5 - rn.var5) / rn.var5, 1) : '–');
      setOut(root, 'esDelta', rn.es05 > 0 ? fmt.signedPct(100 * (rt.es05 - rn.es05) / rn.es05, 1) : '–');
      root.querySelectorAll('.ro-table [data-col], .ro-table td').forEach((el) => el.classList.remove('is-active'));
      root.querySelectorAll(`.ro-table [data-out$="-${fat ? 't' : 'n'}"], .ro-table [data-col="${fat ? 'jump' : 'normal'}"]`).forEach((el) => el.classList.add('is-active'));
      const sel = state.sel;
      live(root, ui.live, { median: fmt.n(sel.median, 2), var: fmt.n(sel.var5, 2), es: fmt.n(sel.es05, 2), ploss: fmt.pct(100 * sel.ploss, 1) });
    };
    const draw = () => {
      if (!state) compute(); const { sel, rn, fat } = state; const t = theme(root); const { ctx, w, h } = setupCanvas(canvas);
      const small = window.innerWidth < 640 || w < 360; const drawN = Math.min(sel.Np, small ? 100 : 200); const stride = small ? 2 : 1;
      setOut(root, 'shown', fill(ui.shown, { shown: fmt.int(drawN), total: fmt.int(sel.Np) }));
      const histW = small ? 48 : 72; const pad = { l: 44, r: 12, t: 20, b: 36 }; const gap = 12; const x1 = w - pad.r - histW - gap;
      const yMin = Math.min(sel.S0 * 0.7, quantileSorted(sel.sorted, 0.005)); const yMax = Math.max(sel.S0 * 1.15, quantileSorted(sel.sorted, 0.995));
      const sx = (i) => pad.l + (i / sel.steps) * (x1 - pad.l); const sy = (v) => h - pad.b - (clamp(v, yMin, yMax) - yMin) / (yMax - yMin) * (h - pad.t - pad.b);
      frame(ctx, t, { x0: pad.l, y0: pad.t, x1, y1: h - pad.b, sx: (d) => sx(d), sy }, niceTicks(0, sel.steps, small ? 3 : 5), niceTicks(yMin, yMax, 4), fmt.int, fmt.int, ui.axisX, '');
      const varNormal = rn.q05; const n1 = sel.steps + 1;
      ctx.lineWidth = 0.6;
      for (let k = 0; k < drawN; k++) {
        const end = sel.grid[k * n1 + sel.steps]; const below = fat && end < varNormal;
        ctx.strokeStyle = below ? t.oxide : t.cloud; ctx.globalAlpha = below ? 0.6 : 0.16; ctx.beginPath();
        for (let i = 0; i < n1; i += stride) { const v = sel.grid[k * n1 + i]; i ? ctx.lineTo(sx(i), sy(v)) : ctx.moveTo(sx(0), sy(v)); }
        if ((n1 - 1) % stride) ctx.lineTo(sx(sel.steps), sy(end));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const pts = (arr) => arr.map((v, i) => [sx(i), sy(v)]);
      polyline(ctx, pts(sel.p05), t.cloud, 1, [3, 3]); polyline(ctx, pts(sel.p95), t.cloud, 1, [3, 3]); polyline(ctx, pts(sel.p50), t.ink, 1.25);
      ctx.strokeStyle = t.line; ctx.beginPath(); ctx.moveTo(pad.l, Math.round(sy(sel.S0)) + 0.5); ctx.lineTo(x1, Math.round(sy(sel.S0)) + 0.5); ctx.stroke();
      // VaR level of the selected model (solid); in jump mode also the normal model's level (dashed), which the red paths are measured against
      ctx.lineWidth = 1; ctx.strokeStyle = t.oxide;
      const yv = Math.round(sy(sel.q05)) + 0.5; ctx.beginPath(); ctx.moveTo(pad.l, yv); ctx.lineTo(w - pad.r, yv); ctx.stroke();
      if (fat) {
        const yn = Math.round(sy(rn.q05)) + 0.5; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(pad.l, yn); ctx.lineTo(w - pad.r, yn); ctx.stroke(); ctx.setLineDash([]);
        label(ctx, t, `${ui.legendVarNormal}: ${fmt.int(rn.q05)}`, pad.l + 4, yn - 3, t.oxide, 'left', 'bottom');
        label(ctx, t, `${ui.legendVar}: ${fmt.int(sel.q05)}`, pad.l + 4, yv + 3, t.oxide, 'left', 'top');
      } else {
        label(ctx, t, `${ui.legendVar}: ${fmt.int(sel.q05)}`, pad.l + 4, yv - 3, t.oxide, 'left', 'bottom');
      }
      label(ctx, t, `${ui.legendMedian}: ${fmt.int(sel.median)}`, x1 - 4, Math.max(pad.t + 12, sy(sel.p50[sel.p50.length - 1]) - 6), t.ink, 'right', 'bottom');
      // histogram
      const bins = 32; const counts = new Array(bins).fill(0);
      for (const v of sel.sorted) counts[clamp(Math.floor((v - yMin) / (yMax - yMin) * bins), 0, bins - 1)]++;
      const cMax = Math.max(...counts) || 1; const hx0 = x1 + gap;
      for (let b = 0; b < bins; b++) { const lo = yMin + b * (yMax - yMin) / bins, hi = lo + (yMax - yMin) / bins; const yTop = sy(hi), yBot = sy(lo);
        ctx.fillStyle = hi <= (fat ? rn.q05 : sel.q05) ? t.oxide : t.line; ctx.fillRect(hx0, yTop + 0.5, (counts[b] / cMax) * histW, Math.max(1, yBot - yTop - 1)); }
    };
    const recompute = onFrame(() => { compute(); draw(); }); const redraw = onFrame(draw);
    bindControls(form, recompute);
    root.querySelector('[data-role=reseed]')?.addEventListener('click', () => { seed = (seed * 1664525 + 1013904223) >>> 0; compute(); draw(); });
    root.querySelector('[data-role=reset]')?.addEventListener('click', () => { resetForm(form); seed = 20261005; compute(); draw(); });
    observe(canvas, redraw); compute(); draw();
    return draw;
  }

  /* ================= 03.3 Markowitz ================= */
  function initMK(root, ui) {
    const form = root.querySelector('form'); const canvas = root.querySelector('canvas'); const errBtn = root.querySelector('[data-role=error]');
    let state = null;
    const weightSets = {};
    const weightsFor = (short) => {
      if (weightSets[short]) return weightSets[short];
      const rand = mulberry32(777); const g = makeNormal(rand); const out = [];
      while (out.length < 3000) {
        let w; if (short) { w = [g(), g(), g()]; const sum = w[0] + w[1] + w[2]; if (Math.abs(sum) < 0.25) continue; w = w.map((x) => x / sum); if (w.some((x) => x < -1 || x > 2)) continue; }
        else { w = [Math.abs(g()), Math.abs(g()), Math.abs(g())]; const sum = w[0] + w[1] + w[2]; w = w.map((x) => x / sum); }
        out.push(w);
      }
      for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) for (let a = 0; a <= 40; a++) { const w = [0, 0, 0]; w[i] = a / 40; w[j] = 1 - a / 40; out.push(w); }
      return (weightSets[short] = out);
    };
    const evaluate = (W, mu, sg, rho, rf) => {
      const cov = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cov[i][j] = (i === j ? 1 : rho[i][j]) * sg[i] * sg[j];
      const pts = new Array(W.length); let minRisk = null, maxSharpe = null;
      for (let k = 0; k < W.length; k++) { const w = W[k]; let r = 0, v = 0; for (let i = 0; i < 3; i++) { r += w[i] * mu[i]; for (let j = 0; j < 3; j++) v += w[i] * w[j] * cov[i][j]; }
        const s = Math.sqrt(Math.max(v, 0)); const q = { w, r, s, sh: s > 0 ? (r - rf) / s : -Infinity }; pts[k] = q; if (!minRisk || q.s < minRisk.s) minRisk = q; if (!maxSharpe || q.sh > maxSharpe.sh) maxSharpe = q; }
      const sorted = pts.slice().sort((a, b) => a.s - b.s); const frontier = []; let best = -Infinity;
      for (const q of sorted) { if (q.s < minRisk.s) continue; if (q.r > best) { best = q.r; frontier.push(q); } }
      return { pts, minRisk, maxSharpe, frontier };
    };
    const compute = () => {
      const p = readInputs(form); const short = p.short === 'short'; const errOn = errBtn && errBtn.getAttribute('aria-pressed') === 'true';
      const mu = [p.mu1, p.mu2, p.mu3].map((x) => x / 100); const sg = [p.sg1, p.sg2, p.sg3].map((x) => x / 100); const rf = p.rf / 100;
      // Require the correlation matrix R to have its smallest eigenvalue >= EPS, i.e. R - EPS*I positive semi-definite:
      // all principal minors of R - EPS*I non-negative. Otherwise scale the three correlations towards zero by a common factor.
      const EPS = 0.05; const d = 1 - EPS;
      const ok = (a, b, c) => Math.abs(a) <= d && Math.abs(b) <= d && Math.abs(c) <= d && d * d * d + 2 * a * b * c - d * (a * a + b * b + c * c) >= 0;
      let shrink = 1;
      if (!ok(p.r12, p.r13, p.r23)) { let lo = 0, hi = 1; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (ok(m * p.r12, m * p.r13, m * p.r23)) lo = m; else hi = m; } shrink = lo; }
      const r12 = p.r12 * shrink, r13 = p.r13 * shrink, r23 = p.r23 * shrink;
      const rho = [[1, r12, r13], [r12, 1, r23], [r13, r23, 1]];
      const psdNote = root.querySelector('[data-role=psd-note]'); if (psdNote) { psdNote.hidden = shrink >= 1; if (shrink < 1) psdNote.textContent = fill(ui.psdNote || '', { c: fmt.n(shrink, 2) }); }
      const W = weightsFor(short); const base = evaluate(W, mu, sg, rho, rf);
      let ghosts = [], err = null;
      if (errOn) {
        const rand = mulberry32(4242); const wmin = [Infinity, Infinity, Infinity], wmax = [-Infinity, -Infinity, -Infinity];
        for (let s = 0; s < 20; s++) { const mu2 = mu.map((m) => m + (rand() * 2 - 1) * 0.015); const sg2 = sg.map((v) => v * (1 + (rand() * 2 - 1) * 0.10)); const e = evaluate(W, mu2, sg2, rho, rf); ghosts.push(e.frontier);
          for (let i = 0; i < 3; i++) { wmin[i] = Math.min(wmin[i], e.maxSharpe.w[i]); wmax[i] = Math.max(wmax[i], e.maxSharpe.w[i]); } }
        err = wmin.map((lo, i) => (wmax[i] - lo) / 2);
      }
      const tangency = base.maxSharpe.sh > 0;
      state = { mu, sg, rf, short, base, ghosts, err, errOn, tangency };
      const sel = base.maxSharpe;
      const noTan = root.querySelector('[data-role=no-tangency]'); if (noTan) noTan.hidden = tangency;
      if (tangency) { setOut(root, 'ret', fmt.pct(sel.r * 100, 1)); setOut(root, 'risk', fmt.pct(sel.s * 100, 1)); setOut(root, 'sharpe', fmt.n(sel.sh, 2)); }
      else { setOut(root, 'ret', '–'); setOut(root, 'risk', '–'); setOut(root, 'sharpe', '–'); }
      sel.w.forEach((wv, i) => { setOut(root, `w${i + 1}`, tangency ? fmt.pct(wv * 100, 1) : '–'); const bar = root.querySelector(`[data-bar="${i}"]`); if (bar) { bar.style.width = tangency ? `${Math.min(100, Math.abs(wv) * 100)}%` : '0'; bar.classList.toggle('is-neg', wv < 0); }
        setOut(root, `e${i + 1}`, err && tangency ? fmt.plusMinus(err[i] * 100, 1) : '–'); });
      root.querySelectorAll('.col-err').forEach((el) => { el.hidden = !errOn; });
      const cap = root.querySelector('[data-role=error-caption]'); if (cap) cap.hidden = !errOn;
      const lg = root.querySelector('.legend-ghost'); if (lg) lg.hidden = !errOn;
      if (tangency) live(root, ui.live, { ret: fmt.pct(sel.r * 100, 1), risk: fmt.pct(sel.s * 100, 1), sharpe: fmt.n(sel.sh, 2) }); else live(root, '{x}', { x: ui.noTangency || '' });
    };
    const draw = () => {
      if (!state) compute(); const { mu, sg, rf, base, ghosts, tangency } = state; const t = theme(root); const { ctx, w, h } = setupCanvas(canvas);
      const pad = { l: 44, r: 16, t: 20, b: 36 };
      const sMax = Math.max(...base.pts.map((q) => q.s), ...sg) * 1.08; const rs = base.pts.map((q) => q.r);
      const rMin = Math.min(...rs, rf) - 0.01, rMax = Math.max(...rs, ...mu) + 0.015;
      const sx = (s) => pad.l + s / sMax * (w - pad.l - pad.r); const sy = (v) => h - pad.b - (v - rMin) / (rMax - rMin) * (h - pad.t - pad.b);
      frame(ctx, t, { x0: pad.l, y0: pad.t, x1: w - pad.r, y1: h - pad.b, sx, sy }, niceTicks(0, sMax * 100, w < 360 ? 3 : 5).map((v) => v / 100), niceTicks(rMin * 100, rMax * 100, 4).map((v) => v / 100), (v) => fmt.int(v * 100), (v) => fmt.int(v * 100), ui.axisX, ui.axisY);
      ctx.fillStyle = t.cloud; ctx.globalAlpha = 0.55; for (const q of base.pts) ctx.fillRect(sx(q.s) - 0.75, sy(q.r) - 0.75, 1.5, 1.5); ctx.globalAlpha = 1;
      ctx.globalAlpha = 0.3; for (const g of ghosts) polyline(ctx, g.map((q) => [sx(q.s), sy(q.r)]), t.oxide, 1); ctx.globalAlpha = 1;
      polyline(ctx, base.frontier.map((q) => [sx(q.s), sy(q.r)]), t.ink, 1.25);
      const ms = base.maxSharpe; const kx = sMax; if (tangency) polyline(ctx, [[sx(0), sy(rf)], [sx(kx), sy(rf + ms.sh * kx)]], t.navy, 1, [4, 3]);
      ctx.font = `${t.fs}px ${t.font}`;
      for (let i = 0; i < 3; i++) { ctx.strokeStyle = t.ink; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(sx(sg[i]), sy(mu[i]), 3.5, 0, Math.PI * 2); ctx.stroke(); label(ctx, t, ui.names[i], sx(sg[i]) + 7, sy(mu[i]), t.ink, 'left', 'middle'); }
      const sq = (q, color, text) => { ctx.fillStyle = color; ctx.fillRect(sx(q.s) - 3.5, sy(q.r) - 3.5, 7, 7); label(ctx, t, text, sx(q.s) - 8, sy(q.r) - 5, color, 'right', 'bottom'); };
      sq(base.minRisk, t.ink, ui.legendMin); if (tangency) sq(ms, t.navy, ui.legendMax);
    };
    const recompute = onFrame(() => { compute(); draw(); }); const redraw = onFrame(draw);
    bindControls(form, recompute);
    errBtn?.addEventListener('click', () => { errBtn.setAttribute('aria-pressed', errBtn.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); compute(); draw(); });
    root.querySelector('[data-role=reset]')?.addEventListener('click', () => { resetForm(form); compute(); draw(); });
    observe(canvas, redraw); compute(); draw();
    return draw;
  }

  /* ---------- boot: UI strings come from a JSON block rendered by the build ---------- */
  const inits = { bs: initBS, mc: initMC, mk: initMK };
  function boot() {
    let dict = {}; const cfg = document.getElementById('quant-ui'); if (cfg) { try { dict = JSON.parse(cfg.textContent); } catch (e) { console.error('quant-ui JSON', e); } }
    const redraws = [];
    document.querySelectorAll('[data-tool]').forEach((el) => { const f = inits[el.dataset.tool]; if (!f) return; try { const d = f(el, dict[el.dataset.tool] || {}); if (d) redraws.push(d); el.classList.add('is-ready'); } catch (e) { console.error('tool init failed', el.dataset.tool, e); } });
    // Canvas text does not trigger web-font loading: load the chart face explicitly, then redraw so labels use it.
    if (document.fonts && document.fonts.load) {
      const fam = getComputedStyle(document.documentElement).getPropertyValue('--font-chart').trim();
      Promise.all([fam ? document.fonts.load(`13px ${fam}`) : null, document.fonts.ready]).then(() => redraws.forEach((d) => d())).catch(() => {});
    }
    // The site dispatches "themechange" after the visitor flips light/dark; the charts read their colours from CSS custom properties on every draw.
    window.addEventListener('themechange', () => redraws.forEach((d) => d()));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
