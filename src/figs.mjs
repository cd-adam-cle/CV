/* Minimalist black-and-white line drawings shown beside scroll-lit words (variant C: hero and profile).

   Each figure is computed, not drawn by hand, and the random parts use a seeded generator, so every build is identical.
   Styling contract (the CSS lives in assets/css/variant-c.css):
   - Every stroke is currentColor; dots are filled with currentColor; rings are filled with the page background (CSS).
   - class "g":    a faint guide hairline, never animated.
   - class "d":    a line that draws itself. It carries pathLength="1" and no vector-effect, so CSS can animate
                   stroke-dasharray: 1 and stroke-dashoffset: 1 -> 0 at any rendered size.
   - class "dot":  a filled dot that fades in.   class "ring": an outlined node that fades in.
   - style="--t:Nms" staggers an element.
   - class "acc" (on a "d" line or a "dot"): the one accent of a figure, coloured by topic in variant-c.css (finance orange,
                   software and algorithms green, AI blue); everything else stays ink.
   Figures: hero  mff (Matfyz, financial mathematics), sw (building software), alg (classic algorithms), fin (financial algorithms), ai (AI systems), proc (AI in processes);
            profile  map (Božííí), edu (Freio), pipe (automation and scraping), ets (EU ETS 2 paper: cost against the Social Climate Fund), port (portfolio). */

const r = (v) => String(Math.round(v * 10) / 10);
const pts = (a) => a.map(([x, y], i) => `${i ? 'L' : 'M'}${r(x)} ${r(y)}`).join('');
const st = (t) => (t ? ` style="--t:${Math.round(t)}ms"` : '');
const D = (d, t = 0, extra = '', cls = '') => `<path class="d${cls ? ' ' + cls : ''}" pathLength="1"${st(t)}${extra} d="${d}"/>`;
const G = (d) => `<path class="g" d="${d}"/>`;
const dot = (x, y, rad = 3, t = 0, cls = '') => `<circle class="dot${cls ? ' ' + cls : ''}" cx="${r(x)}" cy="${r(y)}" r="${rad}"${st(t)}/>`;
const ring = (x, y, rad = 6, t = 0) => `<circle class="ring" cx="${r(x)}" cy="${r(y)}" r="${rad}"${st(t)}/>`;
const svg = (id, w, h, body) => `<svg class="fig" data-fig="${id}" viewBox="0 0 ${w} ${h}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" focusable="false">${body}</svg>`;

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function gauss(rnd) { let u = 0; while (u === 0) u = rnd(); const v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
// a straight line with a small open arrowhead; the head draws after the shaft
function arrow(x1, y1, x2, y2, t, cls = '') {
  const a = Math.atan2(y2 - y1, x2 - x1), h = 9, w = 0.45;
  const p1 = [x2 - h * Math.cos(a - w), y2 - h * Math.sin(a - w)], p2 = [x2 - h * Math.cos(a + w), y2 - h * Math.sin(a + w)];
  return D(pts([[x1, y1], [x2, y2]]), t, '', cls) + D(pts([p1, [x2, y2], p2]), t + 450, '', cls);
}
function roundRect(x, y, w, h, q) {
  return `M${r(x + q)} ${r(y)}H${r(x + w - q)}Q${r(x + w)} ${r(y)} ${r(x + w)} ${r(y + q)}V${r(y + h - q)}Q${r(x + w)} ${r(y + h)} ${r(x + w - q)} ${r(y + h)}H${r(x + q)}Q${r(x)} ${r(y + h)} ${r(x)} ${r(y + h - q)}V${r(y + q)}Q${r(x)} ${r(y)} ${r(x + q)} ${r(y)}Z`;
}

/* ---------- hero ---------- */

// Matfyz, financial mathematics: a square-root sign assembled from geometric pieces (a nod to the faculty's mathematics mark,
// drawn as plain outlines) with a candlestick price chart under its bar, so the radicand is a market.
function mff() {
  const L = ([x, y]) => [30 + (x - 520) * 0.507, 110 + (y - 505) * 0.507];   // piece coordinates are given on a 2000 px grid
  const piece = (ps, t) => D(pts(ps.map(L)) + 'Z', t);
  let body = '';
  body += piece([[523, 650], [523, 772], [645, 772]], 0);                      // left triangle
  body += piece([[528, 778], [780, 778], [654, 904]], 120);                    // bottom triangle
  body += piece([[662, 772], [788, 772], [914, 645], [790, 645]], 240);        // the long stroke
  body += piece([[797, 636], [920, 636], [920, 513]], 360);                    // the turn
  body += piece([[927, 509], [1055, 509], [1055, 636], [927, 636]], 480);      // the bar, two squares
  body += piece([[1061, 509], [1189, 509], [1189, 636], [1061, 636]], 600);
  // under the bar: six daily candles of a rising price (open, close, high, low); filled = up day, hollow = down day
  const candles = [[40, 47, 50, 37], [47, 44, 49, 41], [44, 55, 58, 43], [55, 52, 57, 49], [52, 63, 66, 51], [63, 74, 78, 61]];
  const yp = (v) => 304 - (v - 35) * 2.75, w = 12;
  body += G(pts([[236, 312], [369, 312]]));
  candles.forEach(([o, c, h, l], i) => {
    const x = 250 + i * 21, top = yp(Math.max(o, c)), bot = yp(Math.min(o, c)), t = 760 + i * 90;
    body += D(pts([[x, yp(h)], [x, yp(l)]]), t, '', 'acc');
    body += `<rect class="${c >= o ? 'dot acc' : 'ring'}" x="${r(x - w / 2)}" y="${r(top)}" width="${w}" height="${r(Math.max(2, bot - top))}"${st(t + 200)}/>`;
  });
  return svg('mff', 400, 400, body);
}

// Software: an application window assembled piece by piece: frame, title bar, sidebar, a chart panel and a short list.
function sw() {
  const X = 44, Y = 74, W = 312, H = 252;
  let body = D(roundRect(X, Y, W, H, 12), 0);
  body += D(pts([[X, Y + 30], [X + W, Y + 30]]), 260);                                      // title bar
  [0, 1, 2].forEach((i) => { body += ring(X + 20 + i * 15, Y + 15, 4.2, 320 + i * 60); });   // window controls
  body += D(pts([[X + 80, Y + 30], [X + 80, Y + H]]), 420);                                  // sidebar edge
  [0, 1, 2, 3].forEach((i) => { body += G(pts([[X + 18, Y + 58 + i * 24], [X + 62 - (i % 2) * 12, Y + 58 + i * 24]])); });
  body += D(pts([[X + 18, Y + 58], [X + 62, Y + 58]]), 560, ' stroke-width="2.4"');           // the active menu item
  const px = X + 98, py = Y + 48, pw = W - 116, ph = 100;                                    // chart panel
  body += D(roundRect(px, py, pw, ph, 8), 640);
  const v = [0.22, 0.3, 0.26, 0.42, 0.38, 0.55, 0.5, 0.68, 0.74];
  body += D(pts(v.map((y, i) => [px + 14 + i * (pw - 28) / (v.length - 1), py + ph - 14 - y * (ph - 28)])), 900, ' stroke-width="2"', 'acc');
  [0, 1, 2].forEach((i) => {                                                                 // a list of three rows
    const yy = py + ph + 26 + i * 26;
    body += G(pts([[px + 22, yy], [px + pw - 40 - (i % 2) * 30, yy]]));
    body += i === 0 ? dot(px + 6, yy, 4, 1100, 'acc') : ring(px + 6, yy, 4.2, 1100 + i * 90);
  });
  return svg('sw', 400, 400, body);
}

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
  body += D(pts(dens), 900, '', 'acc');
  ends.forEach(([x, y], i) => { body += dot(x, y, 2.8, 1300 + i * 60, 'acc'); });
  return svg('fin', 400, 400, body);
}

// Algorithms: a small graph and the route a shortest-path search takes through it.
function alg() {
  const N = [[60, 120], [150, 70], [255, 92], [345, 140], [105, 215], [205, 185], [305, 240], [80, 315], [200, 300], [330, 335]];
  const E = [[0, 1], [1, 2], [2, 3], [0, 4], [1, 5], [2, 5], [3, 6], [4, 5], [5, 6], [4, 7], [5, 8], [6, 8], [7, 8], [8, 9], [6, 9]];
  const route = [0, 4, 5, 8, 9];
  let body = E.map(([a, b]) => G(pts([N[a], N[b]]))).join('');
  for (let i = 0; i + 1 < route.length; i++) body += D(pts([N[route[i]], N[route[i + 1]]]), 200 + i * 320, ' stroke-width="2.4"', 'acc');
  N.forEach(([x, y], i) => {
    body += (i === route[0] || i === route[route.length - 1]) ? ring(x, y, 9, 0) + dot(x, y, 3.5, 100, 'acc') : dot(x, y, 3.6, 0, route.includes(i) ? 'acc' : '');
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
    for (let l = 0; l + 1 < rt.length; l++) body += D(pts([layers[l][rt[l]], layers[l + 1][rt[l + 1]]]), 150 + l * 330 + k * 120, ' stroke-width="2.2"', 'acc');
  });
  layers.forEach((ly) => ly.forEach(([x, y]) => { body += ring(x, y, 7, 0); }));
  const lit = new Set();
  routes.forEach((rt) => rt.forEach((nIdx, l) => lit.add(`${l}:${nIdx}`)));
  lit.forEach((key) => { const [l, nIdx] = key.split(':').map(Number); const [x, y] = layers[l][nIdx]; body += dot(x, y, 3.4, 300 + l * 330, 'acc'); });
  return svg('ai', 400, 400, body);
}

// AI in processes: input data, an AI step, a check and the finished output, connected in a loop of arrows.
function proc() {
  const B = [[40, 70], [230, 70], [230, 250], [40, 250]], w = 130, h = 80;
  let body = '';
  B.forEach(([x, y], i) => { body += D(roundRect(x, y, w, h, 10), i * 450, '', i === 1 ? 'acc' : ''); });
  body += arrow(40 + w + 8, 110, 230 - 8, 110, 250);
  body += arrow(230 + w / 2, 70 + h + 8, 230 + w / 2, 250 - 8, 700);
  body += arrow(230 - 8, 290, 40 + w + 8, 290, 1150);
  [92, 110, 128].forEach((y, i) => { body += G(pts([[60, y], [150 - i * 18, y]])); });
  const inL = [[262, 97], [262, 123]], mid = [[295, 86], [295, 110], [295, 134]], out = [328, 110];
  [[0, 0], [0, 1], [1, 1], [1, 2]].forEach(([a, b], i) => { body += D(pts([inL[a], mid[b]]), 600 + i * 40); });
  mid.forEach((p, i) => { body += D(pts([p, out]), 760 + i * 40); });
  [...inL, ...mid, out].forEach(([x, y]) => { body += dot(x, y, 3.2, 650, 'acc'); });
  body += D(pts([[272, 292], [288, 308], [320, 274]]), 1050, ' stroke-width="2.4"');
  [272, 290, 308].forEach((y, i) => { body += G(pts([[62, y], [148 - (i === 2 ? 30 : 0), y]])); });
  return svg('proc', 400, 400, body);
}

/* ---------- profile ---------- */

// Božííí: a river through the city and three parishes linked to one site.
function map() {
  let body = G('M150 0C210 60 120 120 190 170S230 260 200 300');
  const hub = [300, 70], pins = [[115, 95], [130, 230], [315, 225]];
  pins.forEach(([x, y], i) => { body += D(pts([hub, [x, y - 30]]), 300 + i * 250, '', 'acc'); });
  pins.forEach(([x, y], i) => {
    body += D(`M${x} ${y}C${x - 14} ${y - 14} ${x - 12} ${y - 30} ${x} ${y - 30}C${x + 12} ${y - 30} ${x + 14} ${y - 14} ${x} ${y}Z`, i * 200);
    body += dot(x, y - 19, 3.2, 400 + i * 200);
  });
  body += ring(hub[0], hub[1], 11, 0) + dot(hub[0], hub[1], 4, 150, 'acc');
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
      if (c === ans[q]) body += dot(cx, yy, 3.6, 300 + q * 90, 'acc');
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
  nodes.forEach((p, i) => { body += D(pts([c, p]), 1000 + i * 70, '', 'acc'); });
  nodes.forEach(([x, y]) => { body += ring(x, y, 6, 1000); });
  body += dot(c[0], c[1], 4.5, 1000, 'acc');
  body += arrow(118, 140, 152, 140, 300) + arrow(258, 140, 284, 140, 800);
  return svg('pipe', 400, 300, body);
}

// EU ETS 2 (the research paper): the extra yearly heating cost of an older coal-heated family house in the paper's two allowance
// price scenarios, 55 and 100 EUR/t (18 000 and 32 700 Kč, open bars), against the fixed Social Climate Fund support of about
// 4 000 Kč a year (filled, the same in both): it covers about 22 % of the first and 12 % of the second. An arrow marks the price rise.
function ets() {
  const base = 262, k = 196 / 32700, w = 70, xs = [112, 222], fund = 4000;
  let body = G(pts([[72, base], [332, base]]));
  [18000, 32700].forEach((c, i) => {
    const x = xs[i], top = base - c * k, t = i * 420;
    body += D(pts([[x, base], [x, top], [x + w, top], [x + w, base]]), t, ' stroke-width="2"');
    body += `<rect class="dot" x="${r(x)}" y="${r(base - fund * k)}" width="${w}" height="${r(fund * k)}"${st(t + 900)}/>`;
  });
  body += G(pts([[xs[0] + w, base - fund * k], [xs[1], base - fund * k]]));   // the support stays flat
  const t1 = base - 18000 * k, t2 = base - 32700 * k;
  body += arrow(xs[0] + w / 2, t1 - 16, xs[1] - 14, t2 + 16, 600, 'acc');      // the allowance price rises, the bill follows
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
    body += D(`M${r(P1[0])} ${r(P1[1])}A${R} ${R} 0 ${e - s > Math.PI ? 1 : 0} 1 ${r(P2[0])} ${r(P2[1])}`, i * 380, ` stroke-width="${widths[i]}"`, i === 1 ? 'acc' : '');
    a0 = a1;
  });
  return svg('port', 400, 300, body);
}

export const FIGS = { mff, sw, fin, alg, ai, proc, map, edu, pipe, ets, port };
export const figs = (ids) => ids.filter((id) => FIGS[id]).map((id) => FIGS[id]()).join('');
