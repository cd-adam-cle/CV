/*
 * Contribution skyline: a year of activity as a heat map grid that folds up into an
 * isometric 3D skyline and back. Dependency-free, no build step.
 *
 * Adapted from the "Contribution Skyline" component (21st.dev) that the site owner
 * selected. The rendering engine (grid, levels by the 95th percentile, camera maths,
 * wave rise, painter's ordering, hit testing, orbit, colour easing) follows the
 * original; React, Tailwind and the palette presets were replaced by plain DOM and
 * CSS custom properties (--sky-empty, --sky-1 ... --sky-4, --ink-2, --surface, --line).
 *
 * Markup contract (everything else is generated):
 *   <figure class="skyline" data-skyline data-view="3d" data-locale="cs-CZ" data-week-start="1">
 *     <script type="application/json" data-skyline-data>{"end":"YYYY-MM-DD","days":[["YYYY-MM-DD",n],...]}</script>
 *     <script type="application/json" data-skyline-labels>{...}</script>
 *     <noscript>...</noscript>
 *   </figure>
 *
 * Public API: window.__skylines is an array of instances with setView(view, {instant}) and destroy().
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Pure helpers: dates, grid, stats, levels, camera and colour maths
  // ---------------------------------------------------------------------------

  var DAY_MS = 86400000;

  function clamp01(v) { return v > 0 ? (v < 1 ? v : 1) : 0; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeInOutCubic(x) {
    var t = clamp01(x);
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  function easeOutCubic(x) { return 1 - Math.pow(1 - clamp01(x), 3); }
  function smoothstep(a, b, x) {
    var t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  }

  /** UTC midnight in ms to "YYYY-MM-DD". */
  function toKey(ms) { return new Date(ms).toISOString().slice(0, 10); }

  /** "YYYY-MM-DD" (read literally, no timezone drift) or a timestamp to UTC midnight of that day. */
  function dayMs(v) {
    if (typeof v === 'number') return Math.floor(v / DAY_MS) * DAY_MS;
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
  }

  /** 0 for an empty day, else 1 to 4 by quarters of `busy`. Anything at or past `busy` is 4. */
  function levelOf(count, busy) {
    return count <= 0 ? 0 : busy <= 0 ? 4 : 1 + Math.min(3, Math.floor((count / busy) * 4));
  }

  /**
   * Columns are weeks, rows are weekdays (row 0 = weekStart). The grid ends on endMs and starts
   * on the week containing the day one year earlier. Levels split the non-zero days by their
   * share of a busy day, the 95th percentile, so one freak day cannot wash the rest out.
   */
  function buildGrid(days, endMs, weekStart) {
    var counts = new Map();
    for (var j = 0; j < days.length; j++) {
      var d = days[j];
      if (!d) continue;
      var ms = dayMs(d[0]);
      var c = Number(d[1]);
      if (!isFinite(ms) || !(c > 0) || !isFinite(c)) continue;
      var k = toKey(ms);
      counts.set(k, (counts.get(k) || 0) + c);
    }
    var start = endMs - 364 * DAY_MS;
    start -= ((new Date(start).getUTCDay() - weekStart + 7) % 7) * DAY_MS;
    var cells = [];
    for (var m2 = start, i = 0; m2 <= endMs; m2 += DAY_MS, i++) {
      var date = toKey(m2);
      cells.push({ date: date, count: counts.get(date) || 0, level: 0, week: Math.floor(i / 7), day: i % 7 });
    }
    var nz = cells.map(function (x) { return x.count; }).filter(function (x) { return x > 0; }).sort(function (a, b) { return a - b; });
    var busy = nz.length ? nz[Math.floor(0.95 * (nz.length - 1))] : 0;
    for (var q = 0; q < cells.length; q++) cells[q].level = levelOf(cells[q].count, busy);
    return {
      cells: cells,
      weeks: cells.length ? cells[cells.length - 1].week + 1 : 0,
      max: nz.length ? nz[nz.length - 1] : 0
    };
  }

  /** Total, busiest day, longest run, and the run that reaches today (or yesterday, today is not over). */
  function computeStats(cells) {
    var total = 0, best = 0, bestDate = null, run = 0, runStart = null;
    var longest = { days: 0, start: null, end: null };
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i];
      total += c.count;
      if (c.count > best) { best = c.count; bestDate = c.date; }
      if (c.count > 0) {
        if (run === 0) runStart = c.date;
        run++;
        if (run > longest.days) longest = { days: run, start: runStart, end: c.date };
      } else run = 0;
    }
    var j = cells.length - 1;
    if (j >= 0 && cells[j].count === 0) j--;
    var endAt = j;
    while (j >= 0 && cells[j].count > 0) j--;
    var days = endAt - j;
    var current = days > 0
      ? { days: days, start: cells[j + 1].date, end: cells[endAt].date }
      : { days: 0, start: null, end: null };
    return {
      total: total,
      first: cells.length ? cells[0].date : null,
      last: cells.length ? cells[cells.length - 1].date : null,
      busiest: { count: best, date: bestDate },
      longest: longest,
      current: current
    };
  }

  /** A label on each week whose first day starts a new month; a cramped first label is dropped. */
  function monthLabels(cells, weeks, fmt) {
    var out = [];
    var prev = -1;
    for (var w = 0; w < weeks; w++) {
      var c = cells[w * 7];
      if (!c) break;
      var m = +c.date.slice(5, 7);
      if (m !== prev) out.push({ week: w, label: fmt.format(dayMs(c.date)) });
      prev = m;
    }
    if (out.length > 1 && out[1].week - out[0].week < 3) out.shift();
    return out;
  }

  /** Box height in grid units. Empty days are thin slabs; the busiest day is about 7.6 cells tall. */
  function barHeight(count, max) {
    return count > 0 && max > 0 ? 0.4 + Math.pow(count / max, 0.85) * 7.2 : 0.2;
  }

  /** Share of the morph each bar spends waiting; the wave sweeps oldest week to newest. */
  var WAVE = 0.42;

  /** 0 to 1 as a bar rises during the morph. Every bar is flat at t=0 and fully up at t=1. */
  function riseAt(t, week, weeks, day) {
    var d = (weeks > 1 ? week / (weeks - 1) : 0) * 0.36 + (day / 6) * 0.06;
    return easeOutCubic((t - d) / (1 - WAVE));
  }

  var YAW_3D = Math.PI / 4;
  var ELEV_3D = (34 * Math.PI) / 180;
  var YAW_RANGE = [(8 * Math.PI) / 180, (82 * Math.PI) / 180];
  var ELEV_RANGE = [(18 * Math.PI) / 180, (62 * Math.PI) / 180];

  /**
   * e=0 looks straight down (yaw 0, elevation 90 degrees): x across, y down, height invisible,
   * a plain heat map. e=1 is the isometric corner view. Orbit offsets apply in proportion to e,
   * so the flat view never tilts.
   */
  function camera(e, dYaw, dElev) {
    var yaw = Math.min(YAW_RANGE[1], Math.max(0, lerp(0, YAW_3D + (dYaw || 0), e)));
    var elev = lerp(Math.PI / 2, Math.min(ELEV_RANGE[1], Math.max(ELEV_RANGE[0], ELEV_3D + (dElev || 0))), e);
    return { cs: Math.cos(yaw), sn: Math.sin(yaw), se: Math.sin(elev), ce: Math.cos(elev) };
  }

  /** World (x = week, y = weekday, z = up) to screen, before scale and offset. */
  function project(c, x, y, z) {
    return [x * c.cs - y * c.sn, (x * c.sn + y * c.cs) * c.se - z * c.ce];
  }

  function mixRGB(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }
  function luminance(c) { return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255; }
  function rgbString(r, g, b) { return 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')'; }

  // Any CSS colour to sRGB, by letting the browser paint it (handles oklch, color-mix, names).
  var probe = null;
  function toRGB(color, fallback) {
    if (!color) return fallback;
    if (!probe) {
      var c = document.createElement('canvas');
      c.width = c.height = 1;
      probe = c.getContext('2d', { willReadFrequently: true });
    }
    if (!probe) return fallback;
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = 'rgba(0,0,0,0)';
    probe.fillStyle = color;
    probe.fillRect(0, 0, 1, 1);
    var d = probe.getImageData(0, 0, 1, 1).data;
    if (d[3] < 8) return fallback;
    return [d[0], d[1], d[2]];
  }

  function pointInQuad(p, o, x, y) {
    var sign = 0;
    for (var k = 0; k < 4; k++) {
      var ax = p[o + k * 2];
      var ay = p[o + k * 2 + 1];
      var bx = p[o + ((k + 1) % 4) * 2];
      var by = p[o + ((k + 1) % 4) * 2 + 1];
      var cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
      if (Math.abs(cross) < 1e-9) continue;
      var s = cross > 0 ? 1 : -1;
      if (sign === 0) sign = s;
      else if (s !== sign) return false;
    }
    return sign !== 0;
  }

  function quadPath(ctx, p, o, r) {
    if (r < 0.3) {
      ctx.moveTo(p[o], p[o + 1]);
      ctx.lineTo(p[o + 2], p[o + 3]);
      ctx.lineTo(p[o + 4], p[o + 5]);
      ctx.lineTo(p[o + 6], p[o + 7]);
      ctx.closePath();
      return;
    }
    ctx.moveTo((p[o + 6] + p[o]) / 2, (p[o + 7] + p[o + 1]) / 2);
    for (var k = 0; k < 4; k++) {
      var b = (k + 1) % 4;
      ctx.arcTo(p[o + k * 2], p[o + k * 2 + 1], p[o + b * 2], p[o + b * 2 + 1], r);
    }
    ctx.closePath();
  }

  // GitHub's palette, used only when the --sky tokens are missing.
  var FALLBACK_LIGHT = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];
  var FALLBACK_DARK = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];
  var SKY_TOKENS = ['--sky-empty', '--sky-1', '--sky-2', '--sky-3', '--sky-4'];

  // ---------------------------------------------------------------------------
  // Small DOM and text helpers
  // ---------------------------------------------------------------------------

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function fill(tpl, map) {
    return String(tpl == null ? '' : tpl).replace(/\{(\w+)\}/g, function (m, k) {
      return map[k] != null ? map[k] : m;
    });
  }

  function safeLocale(l) {
    try {
      Intl.getCanonicalLocales(l);
      return l;
    } catch (e) {
      return 'en-US';
    }
  }

  var uid = 0;

  // ---------------------------------------------------------------------------
  // One instance per figure
  // ---------------------------------------------------------------------------

  function createSkyline(fig) {
    var dataEl = fig.querySelector('script[data-skyline-data]');
    var labelEl = fig.querySelector('script[data-skyline-labels]');
    var data, L;
    try {
      data = JSON.parse(dataEl.textContent);
      L = JSON.parse(labelEl.textContent);
    } catch (e) {
      return null;
    }
    if (!data || !Array.isArray(data.days)) return null;

    var id = 'skyline-' + (++uid);
    var locale = safeLocale(fig.getAttribute('data-locale') || 'en-US');
    var weekStart = fig.getAttribute('data-week-start') === '0' ? 0 : 1;
    var duration = 1300;
    var orbitOn = true;

    // ---- model ----
    var allDays = data.days;
    var endMs = dayMs(data.end);
    if (!isFinite(endMs)) {
      endMs = 0;
      for (var a = 0; a < allDays.length; a++) endMs = Math.max(endMs, dayMs(allDays[a][0]) || 0);
    }
    var grid = buildGrid(allDays, endMs, weekStart);
    var cells = grid.cells;
    var stats = computeStats(cells);

    var nf = new Intl.NumberFormat(locale);
    var dfShort = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' });
    var dfYear = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    var dfLong = new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    var dfMonth = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' });
    var dfWeekday = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
    var pr;
    try { pr = new Intl.PluralRules(locale); } catch (e) { pr = new Intl.PluralRules('en'); }

    function plural(forms, n) {
      if (!forms || typeof forms === 'string') return forms || '';
      return forms[pr.select(n)] || forms.other || '';
    }
    function unitFor(n) { return plural(L.unit, n); }
    function daysFor(n) { return plural(L.daysUnit, n); }
    function range(a2, b2, withYear) {
      if (!a2 || !b2) return '\u00a0';
      var f = withYear ? dfYear : dfShort;
      if (a2 === b2) return f.format(dayMs(a2));
      return f.format(dayMs(a2)) + ' – ' + f.format(dayMs(b2));
    }

    function describe(i) {
      var c = cells[i];
      if (!c) return '';
      return fill(c.count ? L.dayWithCount : L.dayEmpty, {
        count: nf.format(c.count), unit: unitFor(c.count), date: dfLong.format(dayMs(c.date))
      });
    }
    // Tooltip text split into a bold lead ("2 contributions") and the muted remainder (", Monday ...").
    function tipParts(i) {
      var c = cells[i];
      var tpl = c.count ? L.dayWithCount : L.dayEmpty;
      var at = String(tpl).indexOf('{date}');
      var map = { count: nf.format(c.count), unit: unitFor(c.count) };
      var date = dfLong.format(dayMs(c.date));
      if (at <= 0) return { lead: describe(i), rest: '' };
      var head = fill(tpl.slice(0, at), map);
      var tail = fill(tpl.slice(at + 6), map);
      var lead = head.replace(/[\s,;:]+$/, '');
      return { lead: lead, rest: head.slice(lead.length) + date + tail };
    }

    // ---- DOM ----
    var titleEl = el('h3', 'skyline-title');
    titleEl.id = id + '-title';
    var titleTpl = L.title;
    if (titleTpl && typeof titleTpl === 'object') titleTpl = plural(titleTpl, stats.total);
    var titleParts = String(titleTpl || '{total}').split('{total}');
    for (var tp = 0; tp < titleParts.length; tp++) {
      if (tp > 0) titleEl.appendChild(el('span', 'skyline-title-num', nf.format(stats.total)));
      if (titleParts[tp]) titleEl.appendChild(document.createTextNode(titleParts[tp]));
    }

    var toggle = el('div', 'skyline-toggle');
    toggle.setAttribute('role', 'group');
    toggle.setAttribute('aria-label', L.viewGroup || '');
    var btns = {};
    ['2d', '3d'].forEach(function (v) {
      var b = el('button', 'skyline-toggle-btn', v === '2d' ? L.view2d : L.view3d);
      b.type = 'button';
      b.setAttribute('aria-pressed', 'false');
      b.setAttribute('data-skyline-view', v);
      btns[v] = b;
      toggle.appendChild(b);
    });

    var head = el('div', 'skyline-head');
    head.appendChild(titleEl);
    head.appendChild(toggle);

    var canvas = el('canvas', 'skyline-canvas');
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    var stage = el('div', 'skyline-stage');
    stage.appendChild(canvas);

    function makeStat(variant) {
      var root = el('div', 'skyline-stat skyline-stat--' + variant);
      var label = el('div', 'skyline-stat-label');
      var value = el('div', 'skyline-stat-value');
      var unit = el('div', 'skyline-stat-unit');
      var sub = el('div', 'skyline-stat-sub');
      if (variant === 'stack') {
        var line = el('div', 'skyline-stat-line');
        line.appendChild(value);
        line.appendChild(unit);
        root.appendChild(label);
        root.appendChild(line);
        root.appendChild(sub);
      } else {
        var side = el('div', 'skyline-stat-side');
        side.appendChild(unit);
        side.appendChild(sub);
        root.appendChild(label);
        root.appendChild(value);
        root.appendChild(side);
      }
      return { root: root, label: label, value: value, unit: unit, sub: sub };
    }
    var blocks = [
      { label: L.statTotal, value: nf.format(stats.total), unit: unitFor(stats.total), sub: range(stats.first, stats.last, true) },
      { label: L.statBusiest, value: nf.format(stats.busiest.count), unit: unitFor(stats.busiest.count), sub: stats.busiest.date ? dfShort.format(dayMs(stats.busiest.date)) : '\u00a0' },
      { label: L.statLongest, value: nf.format(stats.longest.days), unit: daysFor(stats.longest.days), sub: range(stats.longest.start, stats.longest.end) },
      { label: L.statCurrent, value: nf.format(stats.current.days), unit: daysFor(stats.current.days), sub: range(stats.current.start, stats.current.end) }
    ];
    function fillStat(s, b) {
      s.label.textContent = b.label || '';
      s.value.textContent = b.value;
      s.unit.textContent = b.unit;
      s.sub.textContent = b.sub;
    }
    var cornerTR = el('div', 'skyline-corner skyline-corner--tr');
    var cornerBL = el('div', 'skyline-corner skyline-corner--bl');
    cornerTR.setAttribute('aria-hidden', 'true');
    cornerBL.setAttribute('aria-hidden', 'true');
    [[cornerTR, 0, 'end'], [cornerTR, 1, 'end'], [cornerBL, 2, 'start'], [cornerBL, 3, 'start']].forEach(function (r) {
      var s = makeStat(r[2]);
      fillStat(s, blocks[r[1]]);
      r[0].appendChild(s.root);
    });
    stage.appendChild(cornerTR);
    stage.appendChild(cornerBL);

    var tip = el('div', 'skyline-tip');
    tip.setAttribute('role', 'tooltip');
    tip.setAttribute('aria-hidden', 'true');
    var tipLead = el('strong', 'skyline-tip-lead');
    var tipRest = el('span', 'skyline-tip-rest');
    tip.appendChild(tipLead);
    tip.appendChild(tipRest);

    var plot = el('div', 'skyline-plot');
    plot.appendChild(stage);
    plot.appendChild(tip);

    var statsRow = el('div', 'skyline-stats');
    var statsInner = el('div', 'skyline-stats-inner');
    blocks.forEach(function (b) {
      var s = makeStat('stack');
      fillStat(s, b);
      statsInner.appendChild(s.root);
    });
    var statsClip = el('div', 'skyline-stats-clip');
    statsClip.appendChild(statsInner);
    statsRow.appendChild(statsClip);

    var hint = el('p', 'skyline-hint', L.hint || '');
    hint.id = id + '-hint';
    var legend = el('div', 'skyline-legend');
    legend.appendChild(el('span', 'skyline-legend-text', L.less || ''));
    var swatches = [];
    var levelNames = Array.isArray(L.levelNames) && L.levelNames.length >= 5 ? L.levelNames : null;
    for (var li = 0; li < 5; li++) {
      var name = levelNames ? levelNames[li] : li === 0 ? fill(L.dayEmpty, { date: '' }).replace(/[\s,;:]+$/, '') : li + ' / 4';
      var sw = el('button', 'skyline-swatch');
      sw.type = 'button';
      sw.setAttribute('aria-label', name);
      sw.setAttribute('aria-pressed', 'false');
      sw.title = name;
      sw.setAttribute('data-level', String(li));
      swatches.push(sw);
      legend.appendChild(sw);
    }
    legend.appendChild(el('span', 'skyline-legend-text', L.more || ''));
    var foot = el('div', 'skyline-foot');
    foot.appendChild(hint);
    foot.appendChild(legend);

    var live = el('p', 'skyline-live');
    live.setAttribute('aria-live', 'polite');

    var made = [head, plot, statsRow, foot, live];
    made.forEach(function (n) { fig.appendChild(n); });
    canvas.setAttribute('aria-describedby', hint.id);
    fig.setAttribute('data-skyline-ready', '');
    fig.style.setProperty('--skyline-dur', duration + 'ms');
    fig.setAttribute('data-mode', '2d');
    fig.setAttribute('data-corners', 'false');

    // ---- engine state ----
    var ctx = canvas.getContext('2d');
    var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    var mqDark = window.matchMedia('(prefers-color-scheme: dark)');
    var reduced = mqReduce.matches;
    var destroyed = false;
    var visible = !('IntersectionObserver' in window);
    var pendingKick = false;

    var wantView = fig.getAttribute('data-view') === '2d' ? '2d' : '3d';
    var t = 0;          // linear morph time, 0 (2D) to 1 (3D)
    var target = 0;
    var entered = false;
    var yaw = 0, elev = 0, yawGoal = 0, elevGoal = 0;
    var W = 0, H2 = 0, H3 = 0, Hmax = 0, lastH = -1, dpr = 1;
    var gutter = 30, labelW = 30;
    var fontFamily = 'sans-serif';
    var font = '400 12px sans-serif';
    var col = new Float32Array(15);      // [empty, l1..l4] x rgb, eased toward colGoal
    var colGoal = new Float32Array(15);
    var colReady = false;
    var fg = [23, 23, 23];
    var bg = [255, 255, 255];
    var muted = [115, 115, 115];
    var lineRGB = [221, 221, 221];

    var n = cells.length;
    var weeks = grid.weeks;
    var wk = new Float32Array(n);
    var dy = new Float32Array(n);
    var lv = new Uint8Array(n);
    var hgt = new Float32Array(n);
    var zs = new Float32Array(n);
    var hover = new Float32Array(n);
    var dim = new Float32Array(n);
    var polys = new Float32Array(n * 24);
    var faces = new Uint8Array(n);
    var order = [];
    for (var oi = 0; oi < n; oi++) {
      order.push(oi);
      wk[oi] = cells[oi].week;
      dy[oi] = cells[oi].day;
      lv[oi] = cells[oi].level;
      hgt[oi] = barHeight(cells[oi].count, grid.max);
    }
    var months = monthLabels(cells, weeks, dfMonth);
    var weekdayRows = [];
    for (var wd = 0; wd < 7 && wd < n; wd++) {
      var dow = new Date(dayMs(cells[wd].date)).getUTCDay();
      if (dow === 1 || dow === 3 || dow === 5) weekdayRows.push({ day: wd, label: dfWeekday.format(dayMs(cells[wd].date)) });
    }

    var hovered = -1, pinned = -1, activeIdx = -1;
    var legendHover = -1, legendPin = -1, legendLevel = -1;
    var tipW = 0;
    var raf = 0, last = 0;
    var themeTimer = 0;

    // ---- theme ----
    function retheme() {
      if (destroyed) return;
      var cs = getComputedStyle(fig);
      fg = toRGB(cs.color, [23, 23, 23]);
      var surf = toRGB(cs.getPropertyValue('--surface').trim(), null);
      bg = surf || (luminance(fg) > 0.5 ? [10, 10, 10] : [255, 255, 255]);
      var dark = luminance(bg) < 0.45;
      muted = toRGB(cs.getPropertyValue('--ink-2').trim(), null) || mixRGB(bg, fg, 0.55);
      lineRGB = toRGB(cs.getPropertyValue('--line').trim(), null) || mixRGB(bg, fg, 0.14);
      var fb = dark ? FALLBACK_DARK : FALLBACK_LIGHT;
      var all = [];
      for (var k = 0; k < 5; k++) {
        all.push(toRGB(cs.getPropertyValue(SKY_TOKENS[k]).trim(), null) || toRGB(fb[k], fg));
      }
      for (var k2 = 0; k2 < 5; k2++) for (var ch = 0; ch < 3; ch++) colGoal[k2 * 3 + ch] = all[k2][ch];
      if (!colReady || reduced) {
        col.set(colGoal);
        colReady = true;
      }
      fontFamily = cs.fontFamily || 'sans-serif';
      for (var s = 0; s < 5; s++) swatches[s].style.backgroundColor = rgbString(all[s][0], all[s][1], all[s][2]);
      if (W) draw();
      kick();
    }

    function onThemeChange() {
      retheme();
      // A site may be mid-transition when the event arrives; settle on the final values too.
      clearTimeout(themeTimer);
      themeTimer = setTimeout(retheme, 450);
    }

    // ---- layout ----
    function extent(cam, e, full) {
      var w = lerp(0.78, 0.9, e);
      var off = (1 - w) / 2;
      var minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
      function add(x, y, z) {
        var p = project(cam, x, y, z);
        if (p[0] < minx) minx = p[0];
        if (p[0] > maxx) maxx = p[0];
        if (p[1] < miny) miny = p[1];
        if (p[1] > maxy) maxy = p[1];
      }
      for (var i = 0; i < n; i++) {
        var x0 = wk[i] + off;
        var y0 = dy[i] + off;
        var z = full ? hgt[i] * e : zs[i];
        add(x0, y0, z);
        add(x0 + w, y0, z);
        add(x0, y0 + w, z);
        add(x0 + w, y0 + w, 0);
        add(x0, y0 + w, 0);
        add(x0 + w, y0, 0);
      }
      // room for the month labels that run along the front edge in 3D
      add(0, 7 + 1.5 * e, 0);
      add(weeks, 7 + 1.5 * e, 0);
      return { minx: minx, maxx: maxx, miny: miny, maxy: maxy };
    }

    function relayout() {
      if (destroyed) return;
      var w = Math.round(stage.clientWidth);
      if (!w || !n) return;
      W = w;
      var fs = W < 520 ? 11 : 12;
      font = '400 ' + fs + 'px ' + fontFamily;
      ctx.font = font;
      var widest = 20;
      for (var r = 0; r < weekdayRows.length; r++) widest = Math.max(widest, ctx.measureText(weekdayRows[r].label).width);
      labelW = Math.ceil(widest) + 8;
      // Narrow cards give the weekday names' column to the grid; rows get too tight to label.
      gutter = W < 520 ? 0 : labelW;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      var b2 = extent(camera(0), 0, true);
      H2 = 20 + 4 + ((b2.maxy - b2.miny) / (b2.maxx - b2.minx)) * (W - gutter - 4);
      var b3 = extent(camera(1), 1, true);
      var natural = ((b3.maxy - b3.miny) / (b3.maxx - b3.minx)) * (W - 40) + 40;
      H3 = Math.max(Math.min(natural, W * 0.72, 620), Math.min(natural, 240));
      Hmax = Math.ceil(Math.max(H2, H3));
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(Hmax * dpr);
      canvas.style.width = W + 'px';
      canvas.style.height = Hmax + 'px';
      fig.setAttribute('data-corners', W >= 560 ? 'true' : 'false');
      fig.style.setProperty('--skyline-big', Math.round(Math.max(30, Math.min(56, W * 0.058))) + 'px');
      lastH = -1;
      draw();
    }

    // ---- drawing ----
    function draw() {
      if (!W || !n) return;
      var e = easeInOutCubic(t);
      var cam = camera(e, yaw, elev);
      var Hc = lerp(H2, H3, e);
      if (Math.abs(Hc - lastH) > 0.2) {
        stage.style.height = Hc.toFixed(1) + 'px';
        lastH = Hc;
      }
      for (var i = 0; i < n; i++) zs[i] = riseAt(t, wk[i], weeks, dy[i]) * hgt[i];
      var b = extent(cam, e, false);
      var pad = lerp(2, 20, e);
      var left = pad + gutter * (1 - e);
      var top = pad + 20 * (1 - e);
      var aw = W - left - pad;
      var ah = Hc - top - pad;
      var bw = Math.max(1e-6, b.maxx - b.minx);
      var bh = Math.max(1e-6, b.maxy - b.miny);
      var s = Math.min(aw / bw, ah / bh);
      var ox = left + (aw - bw * s) / 2 - b.minx * s;
      var oy = top + (ah - bh * s) / 2 - b.miny * s;
      var cs = cam.cs, sn = cam.sn, se = cam.se, ce = cam.ce;
      function px(x, y) { return ox + (x * cs - y * sn) * s; }
      function py(x, y, z) { return oy + ((x * sn + y * cs) * se - z * ce) * s; }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, Hmax);

      // painter's order: far to near for yaw in [0, 90 degrees]
      order.sort(function (a2, c2) {
        return (wk[a2] + 0.5) * sn + (dy[a2] + 0.5) * cs - ((wk[c2] + 0.5) * sn + (dy[c2] + 0.5) * cs);
      });

      var w = lerp(0.78, 0.9, e);
      var off = (1 - w) / 2;
      var radius = lerp(0.17, 0.03, e) * s;
      var outline = (1 - e) * 0.6;
      var lift = 0.7 * e;
      var ex = col[0], ey = col[1], ez = col[2];
      var fgs = fg[0] + ',' + fg[1] + ',' + fg[2];
      var lns = Math.round(lineRGB[0]) + ',' + Math.round(lineRGB[1]) + ',' + Math.round(lineRGB[2]);

      for (var k = 0; k < n; k++) {
        var ii = order[k];
        var x0 = wk[ii] + off;
        var y0 = dy[ii] + off;
        var x1 = x0 + w;
        var y1 = y0 + w;
        var z = zs[ii] + hover[ii] * lift;
        var o = ii * 24;
        // top
        polys[o] = px(x0, y0); polys[o + 1] = py(x0, y0, z);
        polys[o + 2] = px(x1, y0); polys[o + 3] = py(x1, y0, z);
        polys[o + 4] = px(x1, y1); polys[o + 5] = py(x1, y1, z);
        polys[o + 6] = px(x0, y1); polys[o + 7] = py(x0, y1, z);
        // +y face (left on screen)
        polys[o + 8] = px(x0, y1); polys[o + 9] = py(x0, y1, 0);
        polys[o + 10] = px(x1, y1); polys[o + 11] = py(x1, y1, 0);
        polys[o + 12] = polys[o + 4]; polys[o + 13] = polys[o + 5];
        polys[o + 14] = polys[o + 6]; polys[o + 15] = polys[o + 7];
        // +x face (right on screen)
        polys[o + 16] = px(x1, y0); polys[o + 17] = py(x1, y0, 0);
        polys[o + 18] = polys[o + 10]; polys[o + 19] = polys[o + 11];
        polys[o + 20] = polys[o + 4]; polys[o + 21] = polys[o + 5];
        polys[o + 22] = polys[o + 2]; polys[o + 23] = polys[o + 3];

        var tall = z * ce * s;
        var f = 0;
        if (tall > 0.35 && w * cs * s > 0.35) f |= 1;
        if (tall > 0.35 && w * sn * s > 0.35) f |= 2;
        faces[ii] = f;

        var L0 = lv[ii] * 3;
        var r = col[L0], g = col[L0 + 1], bl = col[L0 + 2];
        var d = dim[ii];
        if (d > 0.002) {
          r += (ex - r) * 0.72 * d;
          g += (ey - g) * 0.72 * d;
          bl += (ez - bl) * 0.72 * d;
        }
        var hv = hover[ii];
        if (hv > 0.002) {
          var m = 0.16 * hv;
          r += (fg[0] - r) * m;
          g += (fg[1] - g) * m;
          bl += (fg[2] - bl) * m;
        }
        if (f & 1) {
          ctx.beginPath();
          quadPath(ctx, polys, o + 8, 0);
          ctx.fillStyle = rgbString(r * 0.84, g * 0.84, bl * 0.84);
          ctx.fill();
        }
        if (f & 2) {
          ctx.beginPath();
          quadPath(ctx, polys, o + 16, 0);
          ctx.fillStyle = rgbString(r * 0.68, g * 0.68, bl * 0.68);
          ctx.fill();
        }
        ctx.beginPath();
        quadPath(ctx, polys, o, radius);
        ctx.fillStyle = rgbString(r, g, bl);
        ctx.fill();
        if (outline > 0.004) {
          ctx.strokeStyle = 'rgba(' + lns + ',' + outline.toFixed(3) + ')';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        if (hv > 0.02) {
          ctx.strokeStyle = 'rgba(' + fgs + ',' + (0.85 * hv).toFixed(3) + ')';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // Labels: along the top and left in 2D, along the front edge in 3D. They fade, never pop.
      var mus = Math.round(muted[0]) + ',' + Math.round(muted[1]) + ',' + Math.round(muted[2]);
      ctx.font = font;
      var a2 = 1 - smoothstep(0, 0.4, e);
      var a3 = smoothstep(0.62, 1, e);
      var edge, mi, mm, x, tw;
      if (a2 > 0.004) {
        ctx.fillStyle = 'rgba(' + mus + ',' + a2.toFixed(3) + ')';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        edge = -Infinity;
        for (mi = 0; mi < months.length; mi++) {
          mm = months[mi];
          x = px(mm.week + off, -0.3);
          tw = ctx.measureText(mm.label).width;
          if (x < edge || x + tw > W) continue;
          ctx.fillText(mm.label, x, py(mm.week + off, -0.3, 0) - 3);
          edge = x + tw + 6;
        }
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        if (gutter > 0) {
          for (var wr = 0; wr < weekdayRows.length; wr++) {
            var row = weekdayRows[wr];
            ctx.fillText(row.label, px(0, row.day + 0.5) - 6, py(0, row.day + 0.5, 0));
          }
        }
      }
      if (a3 > 0.004) {
        ctx.fillStyle = 'rgba(' + mus + ',' + a3.toFixed(3) + ')';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        edge = -Infinity;
        for (mi = 0; mi < months.length; mi++) {
          mm = months[mi];
          x = px(mm.week + 0.5, 7.3);
          tw = ctx.measureText(mm.label).width;
          if (x < edge || x + tw > W) continue;
          ctx.fillText(mm.label, x, py(mm.week + 0.5, 7.3, 0) + 2);
          edge = x + tw + 10;
        }
      }

      // The tooltip rides the active cell through morphs and orbits.
      if (activeIdx >= 0 && activeIdx < n) {
        var ai = activeIdx;
        var za = zs[ai] + hover[ai] * lift;
        var tx = px(wk[ai] + 0.5, dy[ai] + 0.5);
        var ty = Math.min(
          py(wk[ai] + off, dy[ai] + off, za),
          py(wk[ai] + off + w, dy[ai] + off, za),
          py(wk[ai] + off, dy[ai] + off + w, za)
        );
        var half = tipW / 2;
        var cx = Math.min(W - half - 2, Math.max(half + 2, tx));
        tip.style.transform = 'translate(' + (cx - half).toFixed(1) + 'px,' + (ty - 8).toFixed(1) + 'px) translateY(-100%)';
        tip.style.setProperty('--arrow', (tx - cx + half).toFixed(1) + 'px');
      }
    }

    // ---- animation loop ----
    function tick(now) {
      raf = 0;
      if (destroyed) return;
      var dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      var moving = false;

      if (t !== target) {
        var step = reduced ? 1 : (dt * 1000) / Math.max(1, duration);
        t = target > t ? Math.min(target, t + step) : Math.max(target, t - step);
        moving = true;
      }

      var ko = reduced ? 1 : 1 - Math.exp(-dt * 12);
      yaw += (yawGoal - yaw) * ko;
      elev += (elevGoal - elev) * ko;
      if (Math.abs(yawGoal - yaw) > 1e-4 || Math.abs(elevGoal - elev) > 1e-4) moving = true;
      else { yaw = yawGoal; elev = elevGoal; }

      var kc = reduced ? 1 : 1 - Math.exp(-dt * 7);
      for (var k = 0; k < 15; k++) {
        var dd = colGoal[k] - col[k];
        if (Math.abs(dd) > 0.4) { col[k] += dd * kc; moving = true; }
        else col[k] = colGoal[k];
      }

      var kh = reduced ? 1 : 1 - Math.exp(-dt * 16);
      var kd = reduced ? 1 : 1 - Math.exp(-dt * 10);
      for (var i = 0; i < n; i++) {
        var hg = i === activeIdx ? 1 : 0;
        var dg = legendLevel >= 0 && lv[i] !== legendLevel ? 1 : 0;
        var h = hover[i];
        var d = dim[i];
        if (h !== hg) {
          hover[i] = Math.abs(hg - h) < 0.003 ? hg : h + (hg - h) * kh;
          moving = true;
        }
        if (d !== dg) {
          dim[i] = Math.abs(dg - d) < 0.003 ? dg : d + (dg - d) * kd;
          moving = true;
        }
      }

      draw();
      if (moving) {
        if (visible) raf = requestAnimationFrame(tick);
        else pendingKick = true;
      }
    }

    function kick() {
      if (destroyed || raf) return;
      if (!visible) { pendingKick = true; return; }
      pendingKick = false;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }

    // ---- view and target ----
    function applyTarget(instant) {
      var goal = wantView === '3d' ? 1 : 0;
      if (instant || reduced) {
        target = goal;
        t = goal;
        if (goal === 0) { yawGoal = 0; elevGoal = 0; yaw = 0; elev = 0; }
      } else if (goal !== target) {
        target = goal;
        if (goal === 0) { yawGoal = 0; elevGoal = 0; }
      }
      fig.setAttribute('data-mode', target === 1 ? '3d' : '2d');
      stage.setAttribute('data-orbit', orbitOn && target === 1 ? 'true' : 'false');
      canvas.style.cursor = orbitOn && target === 1 ? 'grab' : 'default';
      canvas.setAttribute('aria-label', [L.aria, titleEl.textContent, wantView === '3d' ? L.view3d : L.view2d].filter(Boolean).join('. '));
      if (instant || reduced) draw();
      kick();
    }

    function setView(v, opts) {
      if (destroyed || (v !== '2d' && v !== '3d')) return;
      wantView = v;
      fig.setAttribute('data-view', v);
      btns['2d'].setAttribute('aria-pressed', String(v === '2d'));
      btns['3d'].setAttribute('aria-pressed', String(v === '3d'));
      // A deliberate choice counts as having seen the chart.
      entered = true;
      applyTarget(!!(opts && opts.instant));
    }

    function enter() {
      if (entered) return;
      entered = true;
      applyTarget(false);
    }

    // ---- interaction ----
    function setLegend() {
      var next = legendPin >= 0 ? legendPin : legendHover;
      for (var s = 0; s < 5; s++) swatches[s].setAttribute('aria-pressed', String(legendPin === s));
      if (next === legendLevel) return;
      legendLevel = next;
      kick();
    }

    function renderTip() {
      if (activeIdx < 0 || !cells[activeIdx]) {
        tip.classList.remove('is-on');
        tip.setAttribute('aria-hidden', 'true');
        return;
      }
      var p = tipParts(activeIdx);
      tipLead.textContent = p.lead;
      tipRest.textContent = p.rest;
      tip.classList.add('is-on');
      tip.setAttribute('aria-hidden', 'false');
      tipW = tip.offsetWidth;
    }

    // The active day is the hovered one, else the pinned one (tap, click or keyboard).
    function refreshActive() {
      var next = hovered >= 0 ? hovered : pinned;
      if (next === activeIdx) return;
      activeIdx = next;
      renderTip();
      draw();
      kick();
    }

    function hit(x, y) {
      for (var k = n - 1; k >= 0; k--) {
        var i = order[k];
        var o = i * 24;
        if (pointInQuad(polys, o, x, y)) return i;
        if ((faces[i] & 1) && pointInQuad(polys, o + 8, x, y)) return i;
        if ((faces[i] & 2) && pointInQuad(polys, o + 16, x, y)) return i;
      }
      return -1;
    }

    function local(ev) {
      var r = canvas.getBoundingClientRect();
      return [ev.clientX - r.left, ev.clientY - r.top];
    }

    var drag = null;

    function startOrbit(ev) {
      drag.moved = true;
      try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* capture is a nicety */ }
    }

    function onDown(ev) {
      if (ev.button !== 0) return;
      var can = orbitOn && target === 1;
      drag = {
        id: ev.pointerId, x: ev.clientX, y: ev.clientY, yaw: yawGoal, elev: elevGoal,
        moved: false, orbit: can, mouse: ev.pointerType === 'mouse'
      };
      if (can && drag.mouse) {
        try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* capture is a nicety */ }
      }
    }

    function onMove(ev) {
      if (drag && drag.orbit && ev.pointerId === drag.id) {
        var dx = ev.clientX - drag.x;
        var dyy = ev.clientY - drag.y;
        if (!drag.moved) {
          // Mouse orbits after a small drag. Touch only when the gesture is clearly horizontal,
          // otherwise the page scrolls (touch-action: pan-y).
          if (drag.mouse ? Math.hypot(dx, dyy) > 4 : (Math.abs(dx) > 8 && Math.abs(dx) > 1.6 * Math.abs(dyy))) startOrbit(ev);
        }
        if (drag.moved) {
          yawGoal = Math.min(YAW_RANGE[1] - YAW_3D, Math.max(YAW_RANGE[0] - YAW_3D, drag.yaw + dx * 0.006));
          if (drag.mouse) elevGoal = Math.min(ELEV_RANGE[1] - ELEV_3D, Math.max(ELEV_RANGE[0] - ELEV_3D, drag.elev + dyy * 0.004));
          canvas.style.cursor = 'grabbing';
          hovered = -1;
          refreshActive();
          kick();
          return;
        }
      }
      if (ev.pointerType !== 'mouse') return;
      var p = local(ev);
      var i = hit(p[0], p[1]);
      if (i !== hovered) {
        hovered = i;
        refreshActive();
      }
      canvas.style.cursor = orbitOn && target === 1 ? 'grab' : i >= 0 ? 'pointer' : 'default';
    }

    function onUp(ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      var wasMoved = drag.moved;
      drag = null;
      try { if (canvas.hasPointerCapture(ev.pointerId)) canvas.releasePointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
      canvas.style.cursor = orbitOn && target === 1 ? 'grab' : 'default';
      if (wasMoved) return;
      var p = local(ev);
      var i = hit(p[0], p[1]);
      pinned = i === pinned ? -1 : i;
      if (ev.pointerType !== 'mouse') hovered = -1;
      refreshActive();
    }

    function onCancel() { drag = null; }

    function onLeave() {
      if (drag) return;
      hovered = -1;
      refreshActive();
    }

    function onDbl() {
      yawGoal = 0;
      elevGoal = 0;
      kick();
    }

    function onKey(ev) {
      var keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Escape'];
      if (keys.indexOf(ev.key) < 0 || !n) return;
      ev.preventDefault();
      if (ev.key === 'Escape') {
        pinned = -1;
        hovered = -1;
        refreshActive();
        return;
      }
      var i = pinned >= 0 ? pinned : activeIdx >= 0 ? activeIdx : n - 1;
      if (pinned >= 0 || activeIdx >= 0) {
        if (ev.key === 'ArrowLeft') i -= 7;
        if (ev.key === 'ArrowRight') i += 7;
        if (ev.key === 'ArrowUp') i -= 1;
        if (ev.key === 'ArrowDown') i += 1;
        if (ev.key === 'Home') i = 0;
        if (ev.key === 'End') i = n - 1;
      }
      i = Math.max(0, Math.min(n - 1, i));
      pinned = i;
      hovered = -1;
      refreshActive();
      live.textContent = describe(i);
    }

    function onBlur() {
      pinned = -1;
      refreshActive();
    }

    function onToggleClick(ev) {
      var b = ev.target.closest ? ev.target.closest('[data-skyline-view]') : null;
      if (b) setView(b.getAttribute('data-skyline-view'));
    }

    var swHandlers = [];
    swatches.forEach(function (sw, i) {
      var h = {
        enter: function (ev) { if (ev.pointerType === 'mouse') { legendHover = i; setLegend(); } },
        leave: function () { legendHover = -1; setLegend(); },
        focus: function () { if (sw.matches(':focus-visible')) { legendHover = i; setLegend(); } },
        blur: function () { legendHover = -1; setLegend(); },
        click: function () { legendPin = legendPin === i ? -1 : i; setLegend(); }
      };
      sw.addEventListener('pointerenter', h.enter);
      sw.addEventListener('pointerleave', h.leave);
      sw.addEventListener('focus', h.focus);
      sw.addEventListener('blur', h.blur);
      sw.addEventListener('click', h.click);
      swHandlers.push(h);
    });

    function onReduce() {
      reduced = mqReduce.matches;
      kick();
    }

    // ---- wire up ----
    toggle.addEventListener('click', onToggleClick);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('dblclick', onDbl);
    canvas.addEventListener('keydown', onKey);
    canvas.addEventListener('blur', onBlur);
    window.addEventListener('themechange', onThemeChange);
    if (mqReduce.addEventListener) {
      mqReduce.addEventListener('change', onReduce);
      mqDark.addEventListener('change', onThemeChange);
    } else {
      mqReduce.addListener(onReduce);
      mqDark.addListener(onThemeChange);
    }

    var io = null;
    var ro = null;
    var fontsDone = false;

    // initial paint: the flat grid (or straight to the target view under reduced motion)
    btns['2d'].setAttribute('aria-pressed', String(wantView === '2d'));
    btns['3d'].setAttribute('aria-pressed', String(wantView === '3d'));
    if (reduced) {
      entered = true;
      applyTarget(true);
    } else {
      applyTarget(false);
    }
    retheme();
    relayout();

    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (entries) {
        for (var q = 0; q < entries.length; q++) {
          var en = entries[q];
          var wasVisible = visible;
          visible = en.isIntersecting;
          if (en.isIntersecting && en.intersectionRatio >= 0.35) enter();
          if (visible && !wasVisible && pendingKick) kick();
          if (!visible && raf) {
            cancelAnimationFrame(raf);
            raf = 0;
            pendingKick = true;
          }
        }
      }, { threshold: [0, 0.35] });
      io.observe(stage);
    } else {
      enter();
    }

    if ('ResizeObserver' in window) {
      ro = new ResizeObserver(function () {
        if (Math.round(stage.clientWidth) !== W) relayout();
      });
      ro.observe(stage);
    } else {
      window.addEventListener('resize', relayout);
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        if (destroyed || fontsDone) return;
        fontsDone = true;
        retheme();
        relayout();
      });
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      clearTimeout(themeTimer);
      if (io) io.disconnect();
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', relayout);
      window.removeEventListener('themechange', onThemeChange);
      if (mqReduce.removeEventListener) {
        mqReduce.removeEventListener('change', onReduce);
        mqDark.removeEventListener('change', onThemeChange);
      } else {
        mqReduce.removeListener(onReduce);
        mqDark.removeListener(onThemeChange);
      }
      made.forEach(function (node) { if (node.parentNode) node.parentNode.removeChild(node); });
      ['data-skyline-ready', 'data-mode', 'data-corners'].forEach(function (a3) { fig.removeAttribute(a3); });
      fig.style.removeProperty('--skyline-dur');
      fig.style.removeProperty('--skyline-big');
      var at = window.__skylines ? window.__skylines.indexOf(inst) : -1;
      if (at >= 0) window.__skylines.splice(at, 1);
    }

    var inst = {
      el: fig,
      setView: setView,
      destroy: destroy,
      // read-only hooks for tests
      debug: {
        rafPending: function () { return raf !== 0; },
        morph: function () { return t; },
        target: function () { return target; },
        visible: function () { return visible; },
        activeIndex: function () { return activeIdx; },
        cells: function () { return cells; },
        colors: function () { return Array.prototype.slice.call(col); },
        goalColors: function () { return Array.prototype.slice.call(colGoal); },
        draw: function () { draw(); },
        cellPoint: function (i) {
          var o = i * 24;
          return [(polys[o] + polys[o + 4]) / 2, (polys[o + 1] + polys[o + 5]) / 2];
        },
        orbit: function () { return [yaw, elev, yawGoal, elevGoal]; },
        legend: function () { return legendLevel; },
        size: function () { return { W: W, H2: H2, H3: H3, Hmax: Hmax, dpr: dpr }; }
      }
    };
    return inst;
  }

  function initAll() {
    var figs = document.querySelectorAll('[data-skyline]');
    window.__skylines = window.__skylines || [];
    for (var i = 0; i < figs.length; i++) {
      var f = figs[i];
      if (f.hasAttribute('data-skyline-ready')) continue;
      var inst = null;
      try { inst = createSkyline(f); } catch (e) {
        if (window.console && console.error) console.error('skyline: init failed', e);
      }
      if (inst) window.__skylines.push(inst);
    }
  }

  window.__skylines = window.__skylines || [];
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAll);
  else initAll();
})();
