/* Inline SVG thumbnails (320 x 180) for the tools teaser cards: Black-Scholes, Monte Carlo (GBM) and Markowitz.

   thumbBS(), thumbMC() and thumbMK() are pure: no arguments, no Math.random, no Date (the random parts use a seeded
   mulberry32), so the markup is identical on every build. Each shape is computed from its model, not drawn by hand:
   - BS: European call, K 100, T 0.5, r 4%, sigma 22%, spot 60 to 140; normal CDF by Abramowitz and Stegun 7.1.26.
   - MC: GBM, mu 6%, sigma 22%, S0 100, 252 daily steps. 2000 paths give the median and the 5% quantile series; the first
     24 of them are drawn.
   - MK: three assets (mu 5, 8, 12%; sigma 12, 18, 30%; rho 0.3, 0.2, 0.4), long-only. The frontier is the upper envelope of
     a dense simplex grid (step 1/400), the tangency portfolio uses rf 2%, the cloud is 220 random portfolios.

   Styling contract (the CSS lives in assets/css/variant-c.css):
   - No <style>, no hex colours. Every stroke and fill is currentColor; a class only sets `color`:
       th-ink  th-muted  th-grid  th-accent  th-oxide  th-fill-muted
   - Lines are hairlines (stroke-width 1 to 1.5) with vector-effect="non-scaling-stroke".
   - The main solid lines carry class "th-draw" and pathLength="1", so CSS can animate stroke-dasharray: 1 and
     stroke-dashoffset: 1 -> 0. Dashed lines never carry th-draw, because the class would replace their dash pattern.
   - Exception: the th-draw lines leave out vector-effect (see STRICT_DRAW). Chrome scales the dash by pathLength in user
     units but applies it in screen pixels under non-scaling-stroke, so the reveal is only right at a rendered width of
     exactly 320px. Measured at 336px: a 19px stub shows before the reveal and the finished line stops 15px short; at
     640px the stub is 460px and the line stops 280px short. Without the attribute it is exact at every width.
   - The portfolio cloud in the Markowitz thumbnail is one path of 0.1-unit subpaths with round caps, one dot each.

   Self-test and preview page:  node src/thumbs.mjs --preview out.html */

/* ---------- number and path helpers ---------- */

const last = (a) => a[a.length - 1];
const t10 = (v) => Math.round(v * 10);                       // coordinate -> integer tenths
const num = (v) => String(Math.round(v * 10) / 10);          // one decimal, no trailing zero
// integer tenths -> shortest SVG number: 83 -> "8.3", 80 -> "8", -5 -> "-.5"
function tenths(t) {
  const a = Math.abs(t), ip = Math.floor(a / 10), fp = a % 10;
  return (t < 0 ? '-' : '') + (fp ? (ip || '') + '.' + fp : ip);
}
// join numbers with a space unless the next one starts with a minus sign
const seq = (tokens) => tokens.reduce((s, t, i) => s + (i && t[0] !== '-' ? ' ' : '') + t, '');

// Polyline as "M x y l dx dy ...". The steps are differences of the rounded absolute points, so rounding never drifts.
function polyD(pts) {
  const q = pts.map(([x, y]) => [t10(x), t10(y)]);
  const steps = [];
  for (let i = 1; i < q.length; i++) steps.push(tenths(q[i][0] - q[i - 1][0]), tenths(q[i][1] - q[i - 1][1]));
  return 'M' + seq([tenths(q[0][0]), tenths(q[0][1])]) + 'l' + seq(steps);
}
// One tiny subpath (0.1 long) per point; with stroke-linecap="round" each of them is drawn as a dot. A zero-length subpath
// would do in the SVG spec, but this does not rely on how a browser treats degenerate segments.
function dotsD(pts) {
  let px = 0, py = 0, d = '';
  pts.forEach(([x, y], i) => {
    const tx = t10(x), ty = t10(y);
    d += (i ? 'm' + seq([tenths(tx - px), tenths(ty - py)]) : 'M' + seq([tenths(tx), tenths(ty)])) + 'h.1';
    px = tx + 1; py = ty;                                    // the h.1 moved the pen one tenth to the right
  });
  return d;
}

// true: th-draw lines also get vector-effect="non-scaling-stroke" (as in the brief). Only safe if the CSS keeps the SVG at or
// below 320px wide, e.g. .tcard-art svg { max-width: 320px }; see the note in the header.
const STRICT_DRAW = false;
const DRAW = ' pathLength="1"';                              // paired with the th-draw class
const DASH = ' stroke-dasharray="3 3"';
const VE = ' vector-effect="non-scaling-stroke"';
const stroke = (cls, d, w, extra = '', ve = VE) =>
  `<path class="${cls}" d="${d}" fill="none" stroke="currentColor" stroke-width="${w}"${extra}${ve}/>`;
// A main line that CSS can draw in: class th-draw, pathLength 1, no dash pattern of its own. It scales with the SVG unless
// STRICT_DRAW, so its width is 1.4 (1.5 on screen at the 1.05 scale of a desktop card).
const drawn = (cls, d) => stroke(cls + ' th-draw', d, STRICT_DRAW ? 1.5 : 1.4, DRAW, STRICT_DRAW ? VE : '');
const disc = (cls, x, y, r) => `<circle class="${cls}" cx="${num(x)}" cy="${num(y)}" r="${r}" fill="currentColor"/>`;
const ring = (cls, x, y, r, w) =>
  `<circle class="${cls}" cx="${num(x)}" cy="${num(y)}" r="${r}" fill="none" stroke="currentColor" stroke-width="${w}" vector-effect="non-scaling-stroke"/>`;
const svg = (inner) => `<svg viewBox="0 0 320 180" aria-hidden="true" focusable="false">${inner}</svg>`;

/* ---------- random numbers ---------- */

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Standard normal draws by Box-Muller (both values of each pair are used).
function gauss(rng) {
  let spare = null;
  return () => {
    if (spare !== null) { const z = spare; spare = null; return z; }
    const u = 1 - rng(), v = rng();                          // u in (0, 1]
    const r = Math.sqrt(-2 * Math.log(u)), a = 2 * Math.PI * v;
    spare = r * Math.sin(a);
    return r * Math.cos(a);
  };
}
// Quantile of a sorted array, linear interpolation between order statistics.
function quantile(sorted, p) {
  const pos = p * (sorted.length - 1), lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/* ---------- Black-Scholes: European call ---------- */

const BS = { K: 100, T: 0.5, r: 0.04, sigma: 0.22, lo: 60, hi: 140 };

// Abramowitz and Stegun 7.1.26, absolute error below 1.5e-7.
function erf(x) {
  const s = x < 0 ? -1 : 1; x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const poly = ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
  return s * (1 - poly * Math.exp(-x * x));
}
const normCdf = (x) => 0.5 * (1 + erf(x / Math.SQRT2));
function callValue(S) {
  const { K, T, r, sigma } = BS, sq = sigma * Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / sq, d2 = d1 - sq;
  return S * normCdf(d1) - K * Math.exp(-r * T) * normCdf(d2);
}
function modelBS() {
  const spot = [], value = [], payoff = [];
  for (let s = BS.lo; s <= BS.hi; s++) { spot.push(s); value.push(callValue(s)); payoff.push(Math.max(s - BS.K, 0)); }
  return { spot, value, payoff };
}
function renderBS() {
  const m = modelBS();
  const X0 = 0, X1 = 320, Y0 = 160, Y1 = 14;
  const vmax = Math.max(...m.value);
  const x = (s) => X0 + (s - BS.lo) / (BS.hi - BS.lo) * (X1 - X0);
  const y = (v) => Y0 - v / vmax * (Y0 - Y1);
  const curve = m.spot.map((s, i) => [x(s), y(m.value[i])]);
  const kink = [x(BS.K), y(0)];
  const payoff = `M${num(X0)} ${num(Y0)}H${num(kink[0])}L${num(X1)} ${num(y(last(m.payoff)))}`;
  return svg(
    stroke('th-grid', `M${num(X0)} ${num(Y0)}H${num(X1)}`, 1) +
    stroke('th-muted', payoff, 1.2, DASH) +
    drawn('th-ink', polyD(curve)) +
    disc('th-accent', x(BS.K), y(callValue(BS.K)), 3)
  );
}

/* ---------- Monte Carlo: geometric Brownian motion ---------- */

// The seed is fixed once so that the 24 drawn paths are a typical sample: one of them ends below the 5% quantile, 13 end
// above the median, and the fan is about as wide above the median as below it.
const MC = { mu: 0.06, sigma: 0.22, S0: 100, steps: 252, paths: 2000, drawn: 24, seed: 90, fanEvery: 9, lineEvery: 4 };

function modelMC() {
  const { mu, sigma, S0, steps, paths } = MC;
  const z = gauss(mulberry32(MC.seed)), dt = 1 / steps;
  const drift = (mu - 0.5 * sigma * sigma) * dt, vol = sigma * Math.sqrt(dt);
  const sims = [];
  for (let p = 0; p < paths; p++) {
    const s = new Float64Array(steps + 1); s[0] = S0;
    for (let k = 1; k <= steps; k++) s[k] = s[k - 1] * Math.exp(drift + vol * z());
    sims.push(s);
  }
  const fan = [];                                            // the first 24 paths, every fanEvery-th step
  for (let p = 0; p < MC.drawn; p++) {
    const f = []; for (let k = 0; k <= steps; k += MC.fanEvery) f.push(sims[p][k]);
    fan.push(f);
  }
  const line = { step: [], median: [], q05: [] };            // cross-section of all 2000 paths
  for (let k = 0; k <= steps; k += MC.lineEvery) {
    const col = Float64Array.from(sims, (s) => s[k]).sort();
    line.step.push(k); line.median.push(quantile(col, 0.5)); line.q05.push(quantile(col, 0.05));
  }
  return { fan, line };
}
function renderMC() {
  const m = modelMC();
  const X0 = 0, X1 = 308, Y0 = 164, Y1 = 12;            // 28 fan segments of 11 units; the tick fills the last 9 up to 320
  const lo = Math.min(...m.fan.flat(), ...m.line.q05), hi = Math.max(...m.fan.flat(), ...m.line.median);
  const x = (k) => X0 + k / MC.steps * (X1 - X0);
  const y = (v) => Y0 - (v - lo) / (hi - lo) * (Y0 - Y1);
  const fanD = m.fan.map((f) => polyD(f.map((v, i) => [x(i * MC.fanEvery), y(v)]))).join('');
  const at = (series) => series.map((v, i) => [x(m.line.step[i]), y(v)]);
  const yEnd = y(last(m.line.q05));
  return svg(
    stroke('th-grid', fanD, 1) +
    stroke('th-oxide', polyD(at(m.line.q05)), 1.2, DASH) +
    drawn('th-ink', polyD(at(m.line.median))) +
    stroke('th-oxide', `M${num(X1 + 3)} ${num(yEnd)}h9`, 1.5)
  );
}

/* ---------- Markowitz: three assets, long-only ---------- */

const MK = {
  mu: [0.05, 0.08, 0.12], sigma: [0.12, 0.18, 0.30],
  rho: [[1, 0.3, 0.2], [0.3, 1, 0.4], [0.2, 0.4, 1]],
  rf: 0.02, grid: 400, cloud: 220, spare: 24, seed: 11,
};

// z-component of (a - o) x (b - o); negative for a clockwise turn, which is what an upper hull keeps.
const cross = (o, a, b) => (a.s - o.s) * (b.m - o.m) - (a.m - o.m) * (b.s - o.s);

function modelMK() {
  const { mu, sigma, rho, rf, grid } = MK;
  const cov = rho.map((row, i) => row.map((r, j) => r * sigma[i] * sigma[j]));
  const stat = (w) => {                                      // [stdev, mean] of a portfolio
    let m = 0, v = 0;
    for (let i = 0; i < 3; i++) { m += w[i] * mu[i]; for (let j = 0; j < 3; j++) v += w[i] * w[j] * cov[i][j]; }
    return [Math.sqrt(v), m];
  };
  // Dense grid over the simplex (weights are multiples of 1/grid).
  const pts = [];
  for (let i = 0; i <= grid; i++) for (let j = 0; i + j <= grid; j++) {
    const w = [i / grid, j / grid, (grid - i - j) / grid], [s, m] = stat(w);
    pts.push({ s, m });
  }
  // Efficient frontier: upper envelope of the grid in (stdev, mean), i.e. the upper convex hull (monotone chain).
  pts.sort((a, b) => a.s - b.s || b.m - a.m);
  const hull = [];
  for (const p of pts) {
    while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], p) >= 0) hull.pop();
    hull.push(p);
  }
  const sharpe = (p) => (p.m - rf) / p.s;
  const tangency = pts.reduce((a, b) => (sharpe(b) > sharpe(a) ? b : a));
  // Random long-only portfolios: normalised exponentials, i.e. uniform on the simplex.
  const rng = mulberry32(MK.seed), cloud = [];
  for (let n = 0; n < MK.cloud + MK.spare; n++) {
    const e = [0, 0, 0].map(() => -Math.log(1 - rng())), tot = e[0] + e[1] + e[2];
    const [s, m] = stat(e.map((v) => v / tot));
    cloud.push({ s, m });
  }
  const assets = [0, 1, 2].map((i) => ({ s: sigma[i], m: mu[i] }));
  return { hull, tangency, cloud, assets, rf, slope: sharpe(tangency) };
}
function renderMK() {
  const m = modelMK();
  const X0 = 0, X1 = 320, Y0 = 164, Y1 = 12;
  const SLO = 0.098, SHI = 0.3029, MLO = 0.044, MHI = 0.13;   // plotted window (stdev, mean), fitted to the portfolios
  const x = (s) => X0 + (s - SLO) / (SHI - SLO) * (X1 - X0);
  const y = (u) => Y0 - (u - MLO) / (MHI - MLO) * (Y0 - Y1);
  const P = (p) => [x(p.s), y(p.m)];
  const marks = [...m.assets, m.tangency].map(P);
  // Cloud: the first 220 portfolios that do not sit under a marker, sorted by x (smaller steps, shorter path data).
  const cloud = m.cloud.map(P).filter(([cx, cy]) => marks.every(([mx, my]) => Math.hypot(cx - mx, cy - my) > 6)).slice(0, MK.cloud);
  cloud.sort((a, b) => a[0] - b[0]);
  // Frontier: keep a vertex about every 4 px of arc length, stop at the rim of the circle around asset 3.
  const hull = m.hull.map(P), keep = [hull[0]];
  let acc = 0;
  for (let i = 1; i < hull.length; i++) {
    acc += Math.hypot(hull[i][0] - hull[i - 1][0], hull[i][1] - hull[i - 1][1]);
    if (acc >= 4 || i === hull.length - 1) { keep.push(hull[i]); acc = 0; }
  }
  const front = shortenEnd(keep, 4);
  // Capital market line through (0, rf) and the tangency portfolio, cut where it leaves the window.
  const sEnd = Math.min(SHI, (MHI - m.rf) / m.slope);
  const cml = `M${num(x(SLO))} ${num(y(m.rf + m.slope * SLO))}L${num(x(sEnd))} ${num(y(m.rf + m.slope * sEnd))}`;
  return svg(
    stroke('th-fill-muted', dotsD(cloud), 2.4, ' stroke-linecap="round"') +
    stroke('th-accent', cml, 1.2, DASH) +
    drawn('th-ink', polyD(front)) +
    m.assets.map((a) => ring('th-ink', ...P(a), 3.5, 1.2)).join('') +
    disc('th-accent', ...P(m.tangency), 3.6)
  );
}
// Shorten a polyline so that it ends on the circle of radius r around its last point.
function shortenEnd(pts, r) {
  const [ex, ey] = last(pts);
  let i = pts.length - 1;
  while (i > 0 && Math.hypot(pts[i - 1][0] - ex, pts[i - 1][1] - ey) < r) i--;
  if (i === 0) return pts;
  const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
  const dx = bx - ax, dy = by - ay, fx = ax - ex, fy = ay - ey;
  const A = dx * dx + dy * dy, B = 2 * (fx * dx + fy * dy), C = fx * fx + fy * fy - r * r;
  const t = (-B - Math.sqrt(Math.max(0, B * B - 4 * A * C))) / (2 * A);
  return [...pts.slice(0, i), [ax + t * dx, ay + t * dy]];
}

/* ---------- public API ---------- */

const cache = {};
export function thumbBS() { return cache.bs || (cache.bs = renderBS()); }
export function thumbMC() { return cache.mc || (cache.mc = renderMC()); }
export function thumbMK() { return cache.mk || (cache.mk = renderMK()); }

/* ---------- CLI: node src/thumbs.mjs --preview out.html ---------- */

// Checks on the markup (contract above) and on the mathematics. Returns a list of failures.
function selfTest() {
  const fails = [], ok = (c, msg) => { if (!c) fails.push(msg); };
  const sizes = {};
  for (const [name, s] of [['BS', thumbBS()], ['MC', thumbMC()], ['MK', thumbMK()]]) {
    const bytes = new TextEncoder().encode(s).length; sizes[name] = bytes;
    ok(s.startsWith('<svg viewBox="0 0 320 180" aria-hidden="true" focusable="false">'), name + ': svg root attributes');
    ok(!/<svg[^>]*\s(width|height)=/.test(s), name + ': svg has width or height');
    ok(!/<(style|text|script|image|foreignObject)/.test(s), name + ': forbidden element');
    ok(!/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|url\(/.test(s), name + ': colour literal or url()');
    ok(!/\.\d\d/.test(s), name + ': more than one decimal');
    ok(!/NaN|undefined|Infinity/.test(s), name + ': bad number');
    ok(bytes < 7000, name + ': ' + bytes + ' bytes');
    for (const [, v] of s.matchAll(/(?:fill|stroke)="([^"]*)"/g)) ok(v === 'none' || v === 'currentColor', name + ': paint ' + v);
    for (const [, v] of s.matchAll(/class="([^"]*)"/g)) for (const c of v.split(' ')) {
      ok(['th-ink', 'th-muted', 'th-grid', 'th-accent', 'th-oxide', 'th-fill-muted', 'th-draw'].includes(c), name + ': class ' + c);
    }
    for (const [el] of s.matchAll(/<(?:path|circle)\b[^>]*>/g)) {
      const draw = /th-draw/.test(el);
      if (/stroke="currentColor"/.test(el)) ok((draw && !STRICT_DRAW || /vector-effect="non-scaling-stroke"/.test(el)) && /stroke-width="1(\.\d)?"|stroke-width="2\.4"/.test(el), name + ': stroke attributes');
      if (draw) ok(/pathLength="1"/.test(el) && !/dasharray/.test(el) && /fill="none"/.test(el), name + ': th-draw element');
    }
  }
  // Black-Scholes: above the intrinsic payoff, increasing and convex; the value at the strike is the textbook 7.18.
  const bs = modelBS();
  ok(bs.value.every((v, i) => v >= bs.payoff[i]), 'BS: curve below payoff');
  ok(bs.value.every((v, i) => i === 0 || v > bs.value[i - 1]), 'BS: not increasing');
  ok(bs.value.every((v, i) => i === 0 || i === bs.value.length - 1 || bs.value[i - 1] - 2 * v + bs.value[i + 1] > -1e-6), 'BS: not convex');
  ok(Math.abs(callValue(100) - 7.18) < 0.01, 'BS: C(100) = ' + callValue(100));
  // Monte Carlo: fan widens, median rises above S0, 5% line stays under the median.
  const mc = modelMC(), n = mc.fan[0].length;
  const spread = (i) => { const v = mc.fan.map((f) => Math.log(f[i])), mean = v.reduce((a, b) => a + b) / v.length; return Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length); };
  ok(spread(Math.floor(n / 4)) < spread(Math.floor(n / 2)) && spread(Math.floor(n / 2)) < spread(n - 1), 'MC: fan does not widen');
  ok(last(mc.line.median) > MC.S0 && last(mc.line.median) < 106, 'MC: median ' + last(mc.line.median));
  ok(mc.line.q05.every((v, i) => i === 0 || v < mc.line.median[i]), 'MC: q05 above median');
  ok(mc.fan.filter((f) => last(f) < last(mc.line.q05)).length === 1, 'MC: not exactly one path under the 5% quantile');
  // Markowitz: concave frontier ending at asset 3, every random portfolio under it, tangency has the best Sharpe ratio.
  const mk = modelMK(), h = mk.hull;
  ok(h.every((p, i) => i < 2 || cross(h[i - 2], h[i - 1], p) < 1e-12), 'MK: frontier not concave');
  ok(Math.abs(last(h).s - 0.3) < 1e-9 && Math.abs(last(h).m - 0.12) < 1e-9, 'MK: frontier does not end at asset 3');
  const env = (s) => { let i = 1; while (i < h.length - 1 && h[i].s < s) i++; const a = h[i - 1], b = h[i]; return a.m + (b.m - a.m) * (s - a.s) / (b.s - a.s || 1); };
  ok(mk.cloud.every((p) => p.m <= env(p.s) + 3e-4), 'MK: a random portfolio lies above the frontier');
  ok(mk.cloud.every((p) => (p.m - mk.rf) / p.s <= mk.slope + 1e-9) && mk.assets.every((p) => (p.m - mk.rf) / p.s <= mk.slope), 'MK: tangency is not the best Sharpe ratio');
  ok((thumbMK().match(/h\.1/g) || []).length === MK.cloud, 'MK: dot count');
  return { fails, sizes, stats: { callAtK: callValue(100), medianEnd: last(mc.line.median), q05End: last(mc.line.q05), tangency: mk.tangency, sharpe: mk.slope } };
}

function previewHtml() {
  const card = (name, art) => `<figure class="card"><span class="art">${art}</span><figcaption>${name}</figcaption></figure>`;
  const row = (theme) => `<section class="panel ${theme}">${card('Black-Scholes', thumbBS())}${card('Monte Carlo', thumbMC())}${card('Markowitz', thumbMK())}</section>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Thumbnails</title>
<style>
/* Tokens as in assets/css/variant-c.css (light and dark); the card and page colours follow the brief. */
.light { --bg: #f6f5f2; --surface: #ffffff; --ink: #121212; --ink-2: #5c5c57; --line-strong: #c6c4bd; --navy: #1b2d4f; --oxide: #b4472b; --cloud: #a3a19b; }
.dark { --bg: #121211; --surface: #1b1b19; --ink: #f2f0ea; --ink-2: #a8a69e; --line-strong: #44443f; --navy: #9db5e3; --oxide: #e6805a; --cloud: #6c6b66; }
/* The class contract: each class sets only \`color\`; the SVG paints with currentColor. */
.th-ink { color: var(--ink); }
.th-muted { color: var(--ink-2); }
.th-grid { color: var(--line-strong); }
.th-accent { color: var(--navy); }
.th-oxide { color: var(--oxide); }
.th-fill-muted { color: var(--cloud); }
/* Reveal, as in variant-c.css (there: .tcard instead of .card, :root.js:not(.motion-fail) instead of .js). A card gets .in
   when it scrolls into view; click a card here to replay. The main line draws itself, the rest of the drawing fades in
   underneath, and the markers (circles) arrive once the line has passed them. */
:root { --ease: cubic-bezier(0.22, 1, 0.36, 1); }
@media (prefers-reduced-motion: no-preference) {
  .js .th-draw { stroke-dasharray: 1; stroke-dashoffset: 0; transition: stroke-dashoffset 1800ms var(--ease) 250ms; }
  .js .card:not(.in) .th-draw { stroke-dashoffset: 1; }
  .js .art svg > :not(.th-draw, circle) { transition: opacity 900ms var(--ease) 100ms; }
  .js .art svg > circle { transition: opacity 500ms var(--ease) 600ms; }
  .js .card:not(.in) .art svg > :not(.th-draw) { opacity: 0; }
}
body { margin: 0; font: 16px/1.4 "Source Sans 3", "Helvetica Neue", Arial, sans-serif; }
.panel { display: grid; grid-template-columns: repeat(3, minmax(0, 380px)); gap: 20px; justify-content: center; padding: 36px 28px; background: var(--bg); color: var(--ink); }
.card { margin: 0; background: var(--surface); border-radius: 6px; cursor: pointer; }
.art { display: block; padding: 22px 22px 4px; color: var(--ink); }
.art svg { display: block; width: 100%; height: auto; overflow: visible; }
figcaption { padding: 14px 22px 22px; font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
@media (max-width: 900px) { .panel { grid-template-columns: minmax(0, 380px); } }
</style></head>
<body>
${row('light')}
${row('dark')}
<script>
document.documentElement.classList.add('js');
const cards = [...document.querySelectorAll('.card')];
const play = () => requestAnimationFrame(() => requestAnimationFrame(() => cards.forEach((c) => c.classList.add('in'))));
cards.forEach((c) => c.addEventListener('click', () => { c.classList.remove('in'); requestAnimationFrame(() => requestAnimationFrame(() => c.classList.add('in'))); }));
play();
</script>
</body></html>
`;
}

async function cli(argv) {
  const [{ fileURLToPath }, { realpathSync, writeFileSync, mkdirSync }, { dirname, resolve }] =
    await Promise.all([import('node:url'), import('node:fs'), import('node:path')]);
  let isMain = false;
  try { isMain = realpathSync(fileURLToPath(import.meta.url)) === realpathSync(argv[1]); } catch { /* not run from a file */ }
  if (!isMain) return;
  const out = argv[argv.indexOf('--preview') + 1];
  if (!out) { console.error('usage: node src/thumbs.mjs --preview out.html'); process.exitCode = 2; return; }
  const { fails, sizes, stats } = selfTest();
  mkdirSync(dirname(resolve(out)), { recursive: true });
  writeFileSync(out, previewHtml());
  console.log('wrote', resolve(out));
  console.log('bytes', JSON.stringify(sizes));
  console.log('C(S=K) %s, MC median(T) %s, q05(T) %s, tangency (%s, %s) sharpe %s',
    stats.callAtK.toFixed(3), stats.medianEnd.toFixed(1), stats.q05End.toFixed(1),
    stats.tangency.s.toFixed(4), stats.tangency.m.toFixed(4), stats.sharpe.toFixed(4));
  if (fails.length) { console.error('FAILED:\n  ' + fails.join('\n  ')); process.exitCode = 1; return; }
  console.log('self-test ok');
}
const argv = typeof process === 'undefined' ? [] : process.argv;
if (argv.includes('--preview')) cli(argv).catch((e) => { console.error(e); process.exitCode = 1; });
