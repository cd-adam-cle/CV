/* Minimalist black-and-white line drawings shown beside scroll-lit words (variant C: hero and profile).

   Each figure is computed, not drawn by hand, and the random parts use a seeded generator, so every build is identical.
   Styling contract (the CSS lives in assets/css/variant-c.css):
   - Every stroke is currentColor; dots are filled with currentColor; rings are filled with the page background (CSS).
   - class "g":    a faint guide hairline, never animated.
   - class "d":    a line that draws itself. It carries pathLength="1" and no vector-effect, so CSS can animate
                   stroke-dasharray: 1 and stroke-dashoffset: 1 -> 0 at any rendered size.
   - class "dot":  a filled dot that fades in.   class "ring": an outlined node that fades in.
   - style="--t:Nms" staggers an element.
   Figures: hero  fin (financial mathematics), alg (algorithms), ai (AI systems), proc (AI in processes);
            profile  map (Božííí), edu (Freio), pipe (automation and scraping), ets (EU ETS 2 model), port (portfolio). */

const r = (v) => String(Math.round(v * 10) / 10);
const pts = (a) => a.map(([x, y], i) => `${i ? 'L' : 'M'}${r(x)} ${r(y)}`).join('');
const st = (t) => (t ? ` style="--t:${Math.round(t)}ms"` : '');
const D = (d, t = 0, extra = '') => `<path class="d" pathLength="1"${st(t)}${extra} d="${d}"/>`;
const G = (d) => `<path class="g" d="${d}"/>`;
const dot = (x, y, rad = 3, t = 0) => `<circle class="dot" cx="${r(x)}" cy="${r(y)}" r="${rad}"${st(t)}/>`;
const ring = (x, y, rad = 6, t = 0) => `<circle class="ring" cx="${r(x)}" cy="${r(y)}" r="${rad}"${st(t)}/>`;
const svg = (id, w, h, body) => `<svg class="fig" data-fig="${id}" viewBox="0 0 ${w} ${h}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" focusable="false">${body}</svg>`;

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function gauss(rnd) { let u = 0; while (u === 0) u = rnd(); const v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
// a straight line with a small open arrowhead; the head draws after the shaft
function arrow(x1, y1, x2, y2, t) {
  const a = Math.atan2(y2 - y1, x2 - x1), h = 9, w = 0.45;
  const p1 = [x2 - h * Math.cos(a - w), y2 - h * Math.sin(a - w)], p2 = [x2 - h * Math.cos(a + w), y2 - h * Math.sin(a + w)];
  return D(pts([[x1, y1], [x2, y2]]), t) + D(pts([p1, [x2, y2], p2]), t + 450);
}
function roundRect(x, y, w, h, q) {
  return `M${r(x + q)} ${r(y)}H${r(x + w - q)}Q${r(x + w)} ${r(y)} ${r(x + w)} ${r(y + q)}V${r(y + h - q)}Q${r(x + w)} ${r(y + h)} ${r(x + w - q)} ${r(y + h)}H${r(x + q)}Q${r(x)} ${r(y + h)} ${r(x)} ${r(y + h - q)}V${r(y + q)}Q${r(x)} ${r(y)} ${r(x + q)} ${r(y)}Z`;
}

/* ---------- hero ---------- */

// Financial mathematics: seven geometric Brownian motion paths (mu 6%, sigma 32%, one year in 60 steps) and, sideways
// along the right axis, the normal density of their log terminal value.
function fin() {
  const rnd = mulberry32(7), x0 = 40, x1 = 290, y0 = 205, k = 150, n = 60, mu = 0.06, sig = 0.32;
  let body = G(pts([[x0, y0], [x1, y0]])) + G(pts([[x1, 50], [x1, 360]]));
  const ends = [];
  for (let p = 0; p < 7; p++) {
    let ls = 0; const path = [[x0, y0]];
    for (let i = 1; i <= n; i++) {
      ls += (mu - sig * sig / 2) / n + sig * Math.sqrt(1 / n) * gauss(rnd);
      path.push([x0 + (x1 - x0) * i / n, y0 - k * ls]);
    }
    body += D(pts(path), p * 120);
    ends.push(path[path.length - 1]);
  }
  const m = mu - sig * sig / 2, sdp = k * sig, yc = y0 - k * m, dens = [];
  for (let y = 50; y <= 360; y += 4) { const z = (y - yc) / sdp; dens.push([x1 + 78 * Math.exp(-z * z / 2), y]); }
  body += D(pts(dens), 900);
  ends.forEach(([x, y], i) => { body += dot(x, y, 2.8, 1300 + i * 60); });
  return svg('fin', 400, 400, body);
}

// Algorithms: a small graph and the route a shortest-path search takes through it.
function alg() {
  const N = [[60, 120], [150, 70], [255, 92], [345, 140], [105, 215], [205, 185], [305, 240], [80, 315], [200, 300], [330, 335]];
  const E = [[0, 1], [1, 2], [2, 3], [0, 4], [1, 5], [2, 5], [3, 6], [4, 5], [5, 6], [4, 7], [5, 8], [6, 8], [7, 8], [8, 9], [6, 9]];
  const route = [0, 4, 5, 8, 9];
  let body = E.map(([a, b]) => G(pts([N[a], N[b]]))).join('');
  for (let i = 0; i + 1 < route.length; i++) body += D(pts([N[route[i]], N[route[i + 1]]]), 200 + i * 320, ' stroke-width="2.4"');
  N.forEach(([x, y], i) => {
    body += (i === route[0] || i === route[route.length - 1]) ? ring(x, y, 9, 0) + dot(x, y, 3.5, 100) : dot(x, y, 3.6, 0);
  });
  return svg('alg', 400, 400, body);
}

// AI systems: a 4-6-6-3 network with three activation routes drawn through it.
function ai() {
  const L = [[4, 70], [6, 160], [6, 250], [3, 340]];
  const layers = L.map(([c, x]) => Array.from({ length: c }, (_, i) => [x, 200 + (i - (c - 1) / 2) * 52]));
  let body = '';
  for (let l = 0; l + 1 < layers.length; l++) for (const a of layers[l]) for (const b of layers[l + 1]) body += G(pts([a, b]));
  const routes = [[1, 2, 3, 1], [2, 4, 1, 1], [0, 1, 2, 0]];
  routes.forEach((rt, k) => {
    for (let l = 0; l + 1 < rt.length; l++) body += D(pts([layers[l][rt[l]], layers[l + 1][rt[l + 1]]]), 150 + l * 330 + k * 120, ' stroke-width="2.2"');
  });
  layers.forEach((ly) => ly.forEach(([x, y]) => { body += ring(x, y, 7, 0); }));
  const lit = new Set();
  routes.forEach((rt) => rt.forEach((nIdx, l) => lit.add(`${l}:${nIdx}`)));
  lit.forEach((key) => { const [l, nIdx] = key.split(':').map(Number); const [x, y] = layers[l][nIdx]; body += dot(x, y, 3.4, 300 + l * 330); });
  return svg('ai', 400, 400, body);
}

// AI in processes: input data, an AI step, a check and the finished output, connected in a loop of arrows.
function proc() {
  const B = [[40, 70], [230, 70], [230, 250], [40, 250]], w = 130, h = 80;
  let body = '';
  B.forEach(([x, y], i) => { body += D(roundRect(x, y, w, h, 10), i * 450); });
  body += arrow(40 + w + 8, 110, 230 - 8, 110, 250);
  body += arrow(230 + w / 2, 70 + h + 8, 230 + w / 2, 250 - 8, 700);
  body += arrow(230 - 8, 290, 40 + w + 8, 290, 1150);
  [92, 110, 128].forEach((y, i) => { body += G(pts([[60, y], [150 - i * 18, y]])); });
  const n2 = [[262, 96], [262, 124], [295, 110], [328, 96], [328, 124]];
  body += D(pts([n2[0], n2[2], n2[3]]), 600) + D(pts([n2[1], n2[2], n2[4]]), 680);
  n2.forEach(([x, y]) => { body += dot(x, y, 3.4, 650); });
  body += D(pts([[272, 292], [288, 308], [320, 274]]), 1050, ' stroke-width="2.4"');
  [272, 290, 308].forEach((y, i) => { body += G(pts([[62, y], [148 - (i === 2 ? 30 : 0), y]])); });
  return svg('proc', 400, 400, body);
}

/* ---------- profile ---------- */

// Božííí: a river through the city and three parishes linked to one site.
function map() {
  let body = G('M150 0C210 60 120 120 190 170S230 260 200 300');
  const hub = [300, 70], pins = [[115, 95], [130, 230], [315, 225]];
  pins.forEach(([x, y], i) => { body += D(pts([hub, [x, y - 30]]), 300 + i * 250); });
  pins.forEach(([x, y], i) => {
    body += D(`M${x} ${y}C${x - 14} ${y - 14} ${x - 12} ${y - 30} ${x} ${y - 30}C${x + 12} ${y - 30} ${x + 14} ${y - 14} ${x} ${y}Z`, i * 200);
    body += dot(x, y - 19, 3.2, 400 + i * 200);
  });
  body += ring(hub[0], hub[1], 11, 0) + dot(hub[0], hub[1], 4, 150);
  return svg('map', 400, 300, body);
}

// Freio: an answer sheet of an entrance test, one marked answer per question and a check.
function edu() {
  const x = 130, y = 30, w = 140, h = 225, ans = [1, 3, 0, 2, 1, 3];
  let body = D(roundRect(x, y, w, h, 8), 0);
  for (let q = 0; q < 6; q++) {
    const yy = y + 38 + q * 28;
    body += G(pts([[x + 18, yy], [x + 34, yy]]));
    for (let c = 0; c < 4; c++) {
      const cx = x + 56 + c * 22;
      body += ring(cx, yy, 6, 200 + q * 90);
      if (c === ans[q]) body += dot(cx, yy, 3.6, 300 + q * 90);
    }
  }
  body += D(pts([[x + w - 52, y + h - 22], [x + w - 40, y + h - 10], [x + w - 16, y + h - 36]]), 950, ' stroke-width="2.4"');
  return svg('edu', 400, 300, body);
}

// Automation, scraping and LLM APIs: a web page becomes a table that goes into a model.
function pipe() {
  let body = D(roundRect(20, 80, 92, 120, 8), 0) + G(pts([[20, 100], [112, 100]]));
  [122, 140, 158, 176].forEach((yy, i) => { body += G(pts([[34, yy], [96 - (i % 2) * 22, yy]])); });
  body += D(roundRect(160, 80, 92, 120, 8), 400);
  [110, 140, 170].forEach((yy) => { body += G(pts([[160, yy], [252, yy]])); });
  body += G(pts([[206, 80], [206, 200]]));
  [[183, 95], [229, 95], [183, 125], [229, 125], [183, 155], [229, 155], [183, 185], [229, 185]].forEach(([cx, cy], i) => { body += dot(cx, cy, 2.6, 700 + i * 60); });
  const c = [334, 140], R = 40;
  const nodes = Array.from({ length: 6 }, (_, i) => [c[0] + R * Math.cos(i * Math.PI / 3 - Math.PI / 2), c[1] + R * Math.sin(i * Math.PI / 3 - Math.PI / 2)]);
  nodes.forEach((p, i) => { body += D(pts([c, p]), 1000 + i * 70); });
  nodes.forEach(([x, y]) => { body += ring(x, y, 6, 1000); });
  body += dot(c[0], c[1], 4.5, 1000);
  body += arrow(118, 140, 152, 140, 300) + arrow(258, 140, 284, 140, 800);
  return svg('pipe', 400, 300, body);
}

// EU ETS 2: the allowance price starts in 2027 and rises in steps; the household fuel cost follows with a lag.
function ets() {
  const X0 = 46, X1 = 372, Y0 = 250, Y1 = 40;
  const xt = (yr) => X0 + (X1 - X0) * (yr - 2024) / 8, yp = (v) => Y0 - v * 1.75;
  let body = G(pts([[X0, Y0], [X1, Y0]])) + G(pts([[X0, Y0], [X0, Y1]])) + G(pts([[xt(2027), Y0], [xt(2027), Y1 + 10]]));
  const steps = [[2024, 0], [2027, 0], [2027, 45], [2028, 45], [2028, 55], [2029, 55], [2029, 70], [2030, 70], [2030, 85], [2032, 85]];
  body += D(pts(steps.map(([a, v]) => [xt(a), yp(v)])), 0, ' stroke-width="2.2"');
  const price = (t) => (t < 2027 ? 0 : t < 2028 ? 45 : t < 2029 ? 55 : t < 2030 ? 70 : 85);
  const cost = [];
  for (let i = 0; i <= 80; i++) {
    const t = 2024 + i / 10;
    const pass = 1 - Math.exp(-Math.max(0, t - 2027) / 0.9);
    cost.push([xt(t), yp(45 + 0.62 * price(t - 0.35) * pass)]);
  }
  body += D(pts(cost), 700);
  return svg('ets', 400, 300, body);
}

// Portfolio: the 50 / 34 / 16 split of the analysed portfolio (bonds, real estate, equities) as a donut of three arcs.
function port() {
  const c = [200, 150], R = 92, gap = 0.06, parts = [0.5, 0.34, 0.16], widths = [16, 8, 3];
  let a0 = -Math.PI / 2;
  let body = G(`M${c[0]} ${c[1] - R - 18}A${R + 18} ${R + 18} 0 1 1 ${c[0] - 0.01} ${c[1] - R - 18}`);
  parts.forEach((p, i) => {
    const a1 = a0 + p * 2 * Math.PI, s = a0 + gap, e = a1 - gap;
    const P1 = [c[0] + R * Math.cos(s), c[1] + R * Math.sin(s)], P2 = [c[0] + R * Math.cos(e), c[1] + R * Math.sin(e)];
    body += D(`M${r(P1[0])} ${r(P1[1])}A${R} ${R} 0 ${e - s > Math.PI ? 1 : 0} 1 ${r(P2[0])} ${r(P2[1])}`, i * 380, ` stroke-width="${widths[i]}"`);
    a0 = a1;
  });
  return svg('port', 400, 300, body);
}

export const FIGS = { fin, alg, ai, proc, map, edu, pipe, ets, port };
export const figs = (ids) => ids.filter((id) => FIGS[id]).map((id) => FIGS[id]()).join('');
