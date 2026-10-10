// Static site build: src/content.<lang>.json -> index.html (cs) and en/index.html (en), once per variant in src/variants.json.
// Variant layout "blocks" (variant C) also renders a separate tools page (nastroje/index.html and en/tools/index.html).
// Usage: node build.mjs          (site only)
//        node build.mjs --cv     (site + CV PDFs via headless Chrome, see src/cv.mjs)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
import { typo as typoFor } from './src/typo.mjs';
let LANG = 'cs';
const typo = (s) => typoFor(s, LANG);
const esc = (s) => typo(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rich = (s) => esc(s).replace(/([A-Za-zΣσμρ\]\)])_([A-Za-z]{1,3})\b/g, '$1<sub>$2</sub>');
const ext = (href) => /^https?:/.test(href) ? ' target="_blank" rel="noopener"' : '';
const json = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
// Words wrapped for the scroll reveals. Split on plain spaces only, so non-breaking spaces keep their words together.
const magic = (s) => esc(s).split(' ').map((w) => `<span class="w">${w}</span>`).join(' ');
// Figure markers in texts: "{id}some words{/}" tags those words; variant C draws figure id (src/figs.mjs) beside the text when
// the words light up. Everywhere else the markers are removed.
const plain = (s) => String(s).replace(/\{\w+\}|\{\/\}/g, '');
const figIds = (s) => [...new Set([...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].filter((id) => !figMod || figMod.FIGS[id]);
// Notes on tagged phrases (variant C): content.hints[id] = { text, link, href }. The phrase becomes a link to href with a dotted
// underline under its words, text becomes its accessible description, and assets/js/hints.js shows text and link in a small note
// on hover, keyboard focus or a first tap. Without the script the phrase is an ordinary link.
let HINTS = {};
const attr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const markIds = (s) => [...new Set([...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]))];
const hintNotes = (s, indent) => {
  const list = markIds(s).filter((id) => HINTS[id]);
  return list.length ? `\n${indent}<div class="hint-notes" hidden>${list.map((id) => `<span id="hint-${id}">${esc(HINTS[id].text)}</span>`).join('')}</div>` : '';
};
// Like magic(), plus data-fig on tagged words; lit0 marks the words up to the end of the first tagged phrase as lit from the start.
// A tagged phrase with a note in HINTS is wrapped in a link that holds exactly the tagged words: a preposition that a non-breaking
// space glues to the first word, and punctuation after the last word, go into their own spans outside the link (data-sat="next" or
// "prev": motion.js lights them together with that word, they do not count as words). The words are underlined (span.u); inside the
// phrase the space after a word sits in that word's span.u, so the underline runs through the phrase and fades with the words.
function magicFig(s, lit0) {
  let cur = null, firstId = null, lastOfFirst = -1;
  const toks = esc(s).split(' ').map((w, i) => {
    let pre = '', post = '', open = false, close = false;
    const m = /\{(\w+)\}/.exec(w);
    if (m) { cur = m[1]; if (!firstId) firstId = cur; pre = w.slice(0, m.index); w = w.slice(m.index + m[0].length); open = true; }
    const fig = cur, c = w.indexOf('{/}');
    if (c >= 0) { post = w.slice(c + 3); w = w.slice(0, c); close = true; }
    if (fig && fig === firstId) lastOfFirst = i;
    if (close) cur = null;
    return { pre, w, post, fig, open, close };
  });
  return toks.map((t, i) => {
    const h = t.fig && HINTS[t.fig], inside = h && !t.close && i < toks.length - 1; // a word followed by another word of the phrase
    const cls = `w${lit0 && i <= lastOfFirst ? ' l0' : ''}`, gap = i < toks.length - 1 && !inside ? ' ' : '';
    if (!h) return `<span class="${cls}"${t.fig ? ` data-fig="${t.fig}"` : ''}>${t.pre}${t.w}${t.post}</span>${gap}`;
    const pre = t.open && t.pre ? `<span class="${cls}" data-sat="next">${t.pre}</span>` : '';
    const open = t.open ? `<a class="hint" href="${attr(h.href)}"${ext(h.href)} data-hint="${t.fig}" data-hint-link="${esc(h.link)}" aria-describedby="hint-${t.fig}">` : '';
    const post = t.close ? `</a>${t.post ? `<span class="${cls}" data-sat="prev">${t.post}</span>` : ''}` : '';
    return `${pre}${open}<span class="${cls}" data-fig="${t.fig}"><span class="u">${t.w}${inside ? ' ' : ''}</span></span>${post}${gap}`;
  }).join('');
}
const maskWords = (s) => esc(s).split(' ').map((w) => `<span class="mw"><span>${w}</span></span>`).join(' ');
const fill = (tpl, vals) => tpl.replace(/\{(\w+)\}/g, (m, k) => (vals[k] != null ? vals[k] : m));
// Optional inputs: the tool thumbnails and the contribution snapshot (node scripts/build-contributions.mjs).
const thumbs = existsSync(join(root, 'src', 'thumbs.mjs')) ? await import('./src/thumbs.mjs') : null;
const figMod = existsSync(join(root, 'src', 'figs.mjs')) ? await import('./src/figs.mjs') : null;
const drawFigs = (ids) => (figMod ? figMod.figs(ids) : '');
const contributions = existsSync(join(root, 'src', 'contributions.json')) ? JSON.parse(readFileSync(join(root, 'src', 'contributions.json'), 'utf8')) : null;
if (contributions && (Date.now() - Date.parse(contributions.end + 'T00:00:00Z')) / 86400000 > 14) console.warn(`warning: src/contributions.json ends ${contributions.end}; refresh it with scripts/build-contributions.mjs (see README) so "in the last year" stays true`);
// Design variants built from the same content: C (layout "blocks") is the production site at /, A and B are noindex previews for comparison.
const VARIANTS = JSON.parse(readFileSync(join(root, 'src', 'variants.json'), 'utf8'));
let V = VARIANTS[0];
const P = (path) => (V.dir ? '/' + V.dir.replace(/\/$/, '') : '') + path;
const isBlocks = () => V.layout === 'blocks';

/* ---------- head / nav / footer ---------- */
function head(c, pg) {
  const m = c.meta; const url = m.siteUrl + pg.path; const alt = m.siteUrl + pg.altPath; const blocks = isBlocks();
  const init = blocks
    ? `<script>(function(){var d=document.documentElement;d.classList.add('js');try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light'){d.setAttribute('data-theme',t);var m=document.querySelectorAll('meta[name="theme-color"]'),c,i;for(i=0;i<m.length;i++){if(/dark/.test(m[i].media||'')===(t==='dark'))c=m[i].content}if(c)for(i=0;i<m.length;i++)m[i].content=c}}catch(e){}setTimeout(function(){if(!d.classList.contains('motion-ready'))d.classList.add('motion-fail')},4000)})();</script>`
    : `<script>document.documentElement.classList.add('js');</script>`;
  const colour = blocks
    ? `<meta name="color-scheme" content="light dark">\n<meta name="theme-color" content="${V.themeColor}" media="(prefers-color-scheme: light)">\n<meta name="theme-color" content="${V.themeColorDark}" media="(prefers-color-scheme: dark)">`
    : `<meta name="color-scheme" content="light">\n<meta name="theme-color" content="${V.themeColor}">`;
  const scripts = blocks ? ['site.js', pg.kind === 'tools' ? 'quant.js' : 'skyline.js', 'motion.js', ...(pg.kind === 'home' ? ['hints.js'] : [])] : ['site.js', 'quant.js'];
  return `<!doctype html>
<html lang="${c.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(pg.title).replace(/\u2011/g, '-')}</title>
<meta name="description" content="${esc(pg.description).replace(/\u2011/g, '-')}">
<meta name="author" content="Adam Zikmund">
${colour}
<link rel="canonical" href="${url}">${V.noindex ? '\n<meta name="robots" content="noindex">' : ''}
<link rel="alternate" hreflang="${c.lang}" href="${url}">
<link rel="alternate" hreflang="${m.altLang.lang}" href="${alt}">
<link rel="alternate" hreflang="x-default" href="${c.lang === 'cs' ? url : alt}">
<meta property="og:type" content="${pg.kind === 'home' ? 'profile' : 'website'}">
<meta property="og:title" content="${esc(pg.title).replace(/\u2011/g, '-')}">
<meta property="og:description" content="${esc(pg.description).replace(/\u2011/g, '-')}">
<meta property="og:url" content="${url}">
<meta property="og:locale" content="${c.lang === 'cs' ? 'cs_CZ' : 'en_GB'}">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${V.fonts}">
<link rel="stylesheet" href="/assets/css/site.css">
<link rel="stylesheet" href="${V.css}">${blocks && pg.kind === 'home' ? '\n<link rel="stylesheet" href="/assets/css/skyline.css">' : ''}
${init}
${scripts.map((s) => `<script src="/assets/js/${s}" defer></script>`).join('\n')}
</head>`;
}

const themeToggle = (n) => `<button class="theme-toggle" type="button" aria-pressed="false" aria-label="${esc(n.theme)}" title="${esc(n.theme)}" data-theme-toggle>
      <svg class="ico-moon" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false"><path d="M16.4 12.1A7 7 0 0 1 7.9 3.6a7 7 0 1 0 8.5 8.5Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
      <svg class="ico-sun" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="3.3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 2.4v2M10 15.6v2M2.4 10h2M15.6 10h2M4.6 4.6l1.4 1.4M14 14l1.4 1.4M4.6 15.4 6 14M14 6l1.4-1.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
    </button>`;

function nav(c, pg) {
  const n = c.nav; const m = c.meta; const blocks = isBlocks(); const home = P(m.path);
  const link = (l) => {
    const isPage = blocks && l.href;
    const href = isPage ? P(l.href) : (blocks && pg.kind === 'tools' ? `${home}#${l.id}` : `#${l.id}`);
    const current = isPage && pg.kind === 'tools';
    const spy = blocks && pg.kind === 'tools' ? '' : ` data-spy="${l.id}"`;
    return `<li><a href="${href}"${spy}${current ? ' class="is-active" aria-current="page"' : ''}>${esc(l.label)}</a></li>`;
  };
  const alt = P(pg.altPath);
  return `<header class="site-header" id="top">
<a class="skip" href="#main">${esc(n.skip)}</a>
<nav class="nav" aria-label="${esc(n.ariaMain)}">
  <a class="brand" href="${home}">${esc(n.brand)}</a>
  <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-menu"><span class="t-open">${esc(n.contents)}</span><span class="t-close">${esc(n.close)}</span></button>
  <div class="nav-menu" id="nav-menu">
    <ol class="nav-list">
      ${n.links.map(link).join('\n      ')}
    </ol>
    <span class="nav-lang" role="group" aria-label="${esc(n.ariaLang)}"><span class="is-current">${esc(m.thisLang.label)}</span><span class="sep" aria-hidden="true">/</span><a href="${alt}" hreflang="${m.altLang.lang}" lang="${m.altLang.lang}">${esc(m.altLang.label)}</a></span>
  </div>
  <div class="nav-right">
    <a class="nav-cv" href="${m.cvPdf}"><span class="t-long">${esc(n.cv)}</span><span class="t-short">${esc(n.cvShort)}</span></a>
    <span class="nav-lang" role="group" aria-label="${esc(n.ariaLang)}"><span class="is-current">${esc(m.thisLang.label)}</span><span class="sep" aria-hidden="true">/</span><a href="${alt}" hreflang="${m.altLang.lang}" lang="${m.altLang.lang}" title="${esc(m.altLang.title)}">${esc(m.altLang.label)}</a></span>${blocks ? '\n    ' + themeToggle(n) : ''}
  </div>
</nav>
</header>`;
}

function footer(c, pg) {
  const f = c.footer; const m = c.meta;
  return `<footer class="site-footer">
  <p>${esc(f.left)}</p>
  <p class="footer-note">${esc(f.note)}</p>
  <p class="footer-lang"><span class="is-current">${esc(m.thisLang.label)}</span> / <a href="${P(pg.altPath)}" hreflang="${m.altLang.lang}" lang="${m.altLang.lang}">${esc(m.altLang.label)}</a></p>
</footer>`;
}

/* ---------- hero ---------- */
function links(arr) { return arr.map((l) => `<a href="${l.href}">${esc(l.label)}</a>`).join(', '); }
const sheet = (h) => `<aside class="sheet" aria-labelledby="sheet-title"${isBlocks() ? ' data-reveal="rise"' : ''}>
    <h2 id="sheet-title" class="visually-hidden">${esc(h.sheetTitle)}</h2>
    <dl class="sheet-rows">
      ${h.sheet.map((r) => `<div class="sheet-row"><dt>${esc(r.k)}</dt><dd>${r.links ? links(r.links) : esc(r.v)}</dd></div>`).join('\n      ')}
    </dl>
  </aside>`;
function heroBlocks(c) {
  const h = c.hero;
  const ids = figIds(h.title.join(' '));
  return `<section class="hero-track" data-hero>
  <div class="hero-pin">
    <h1 id="hero-title" class="hero-title" data-magic="hero"${ids.length ? ' data-art="art-hero"' : ''}>${h.title.map((t) => `<span class="hero-sentence">${magicFig(t, true)}</span>`).join(' ')}</h1>${hintNotes(h.title.join(' '), '    ')}${ids.length ? `
    <div class="fig-art fig-art-hero" id="art-hero" aria-hidden="true">${drawFigs(ids)}</div>` : ''}
    <p class="hero-hint" aria-hidden="true">${esc(h.scrollHint)}</p>
  </div>
</section>
<section class="hero hero-rest">
  <div class="hero-text">
    <p class="deck" data-magic>${magic(h.deck)}</p>
    <p class="actions" data-reveal="rise"><a class="btn-fill" href="${h.actions.cvHref}">${esc(h.actions.cv)}</a><a class="email-link" href="mailto:${h.actions.email}">${esc(h.actions.email)}</a></p>
  </div>
  ${sheet(h)}
</section>`;
}
function hero(c) {
  if (isBlocks()) return heroBlocks(c);
  const h = c.hero;
  return `<section class="hero" aria-labelledby="hero-title">
  <div class="hero-text">
    <h1 id="hero-title">${h.title.map((t) => `<span class="line">${esc(plain(t))}</span>`).join(' ')}</h1>
    <p class="deck">${esc(h.deck)}</p>
    <p class="actions"><a class="cv-link" href="${h.actions.cvHref}">${esc(h.actions.cv)}</a><a class="email-link" href="mailto:${h.actions.email}">${esc(h.actions.email)}</a></p>
  </div>
  ${sheet(h)}
</section>`;
}

/* ---------- section scaffolding ---------- */
function section(s, body, extraClass) {
  const blocks = isBlocks();
  return `<section id="${s.id}" class="section${extraClass ? ' ' + extraClass : ''}" aria-labelledby="h-${s.id}">
  <div class="rail"${blocks ? ' data-reveal="rail"' : ''}><h2 id="h-${s.id}">${blocks ? maskWords(s.title) : esc(s.title)}</h2></div>
  <div class="content">
${body}
  </div>
</section>`;
}
function kv(title, rows, id) {
  return `<div class="kv-block">
      <h3 id="${id}">${esc(title)}</h3>
      <dl class="kv" aria-labelledby="${id}">
        ${rows.map((r) => `<div class="kv-row" data-reveal="kv"><dt>${esc(r.k)}</dt><dd>${esc(r.v)}</dd></div>`).join('\n        ')}
      </dl>
    </div>`;
}
let EXIT_LABEL = '';
function ledger(items, extra) {
  const row = (e) => `<li class="row"${e.anchor ? ` id="${e.anchor}"` : ''} data-reveal="row">
        <div class="row-date"><span>${esc(e.period)}</span></div>
        <div class="row-head"><h3>${e.href ? `<a href="${e.href}"${ext(e.href)}>${esc(e.org)}</a>` : esc(e.org)}</h3><p class="row-role">${esc(e.role)}</p></div>
        <div class="row-body">
          <ul class="results">${e.results.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
          ${e.exit ? `<p class="row-exit"><span class="row-exit-k">${esc(EXIT_LABEL)}</span> ${esc(e.exit)}</p>` : ''}
          ${e.stack ? `<p class="row-stack">${esc(e.stack)}</p>` : ''}
        </div>
      </li>`;
  return `<ol class="ledger">
      ${items.map(row).join('\n      ')}${extra ? '\n      ' + extra : ''}
    </ol>`;
}

function profile(c) {
  const p = c.profile;
  const ids = isBlocks() ? figIds(p.lead) : [];
  const lead = isBlocks()
    ? `<div class="lead-row">
      <p class="lead" data-magic${ids.length ? ' data-art="art-profile"' : ''}>${magicFig(p.lead)}</p>${hintNotes(p.lead, '      ')}${ids.length ? `
      <div class="fig-art fig-art-profile" id="art-profile" aria-hidden="true">${drawFigs(ids)}</div>` : ''}
    </div>`
    : `<p class="lead">${esc(plain(p.lead))}</p>`;
  return section(p, `    ${lead}
    ${kv(p.seeking.title, p.seeking.rows, 'h-seeking')}
    ${kv(p.basis.title, p.basis.rows, 'h-basis')}`);
}
function experience(c) { EXIT_LABEL = c.experience.exitLabel || ''; return section(c.experience, '    ' + ledger(c.experience.items)); }
function education(c) {
  const e = c.education;
  const note = e.note ? `\n    <p class="edu-note"${isBlocks() ? ' data-reveal="rise"' : ''}>${e.note.k ? `<strong>${esc(e.note.k)}.</strong> ` : ''}${esc(e.note.v)}</p>` : '';
  return section(e, '    ' + ledger(e.items) + note);
}
// GitHub-style commit graph (variant C): the chart shows the last five weeks, the heading states the figure for the last year.
// Sparse data: the script fills the empty days.
const ACTIVITY_WEEKS = 5;
function activity(c) {
  const a = c.projects.activity;
  if (!isBlocks() || !a || !contributions) return '';
  const DAYMS = 86400000;
  const weekStartOf = (ms) => ms - ((new Date(ms).getUTCDay() + 6) % 7) * DAYMS; // weeks start on Monday
  const endMs = Date.parse(contributions.end + 'T00:00:00Z');
  const yearFrom = new Date(weekStartOf(endMs - 364 * DAYMS)).toISOString().slice(0, 10); // the 53 weeks of a year
  const chartFrom = new Date(weekStartOf(endMs) - (ACTIVITY_WEEKS - 1) * 7 * DAYMS).toISOString().slice(0, 10);
  const yearTotal = contributions.days.filter((d) => d[0] >= yearFrom).reduce((t, d) => t + d[1], 0);
  const days = contributions.days.filter((d) => d[0] >= chartFrom && d[1] > 0);
  const total = new Intl.NumberFormat(LANG === 'cs' ? 'cs-CZ' : 'en-GB').format(yearTotal);
  const title = typeof a.labels.title === 'string' ? a.labels.title : (a.labels.title[new Intl.PluralRules(LANG === 'cs' ? 'cs-CZ' : 'en-GB').select(yearTotal)] || a.labels.title.other);
  return `<div class="activity" data-reveal="panel">
      <figure class="skyline" data-skyline data-view="3d" data-locale="${LANG === 'cs' ? 'cs-CZ' : 'en-GB'}" data-week-start="1" data-weeks="${ACTIVITY_WEEKS}" data-orient="rows" data-total="${yearTotal}">
        <script type="application/json" data-skyline-data>${json({ end: contributions.end, days })}</script>
        <script type="application/json" data-skyline-labels>${json(a.labels)}</script>
        <noscript><p class="skyline-fallback">${esc(fill(title, { total }))}</p></noscript>
      </figure>
    </div>
    `;
}
function projects(c) {
  if (!isBlocks()) return section(c.projects, '    ' + ledger(c.projects.items));
  const p = c.projects;
  const card = (e, i) => `<article class="pcard${i === 0 ? ' pcard-wide' : ''}"${e.anchor ? ` id="${e.anchor}"` : ''} data-reveal="card">
        <p class="pcard-meta"><span class="pcard-tag">${esc(e.tag)}</span><span class="pcard-period">${esc(e.period)}</span></p>
        <h3>${e.href ? `<a href="${e.href}"${ext(e.href)}>${esc(e.org)}</a>` : esc(e.org)}</h3>
        <p class="pcard-role">${esc(e.role)}</p>
        <ul class="results">${e.results.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
        ${e.stack ? `<p class="row-stack">${esc(e.stack)}</p>` : ''}
      </article>`;
  return section(p, `    <p class="section-intro" data-magic>${magic(p.intro)}</p>
    ${activity(c)}<div class="pgrid">
      ${p.items.map(card).join('\n      ')}
    </div>`);
}
function skills(c) {
  const s = c.skills; const it = s.interests; const blocks = isBlocks();
  let v = esc(it.v);
  if (blocks && it.link && it.v.includes(it.link.text)) {
    const i = it.v.indexOf(it.link.text);
    v = `${esc(it.v.slice(0, i))}<a href="${it.link.href}">${esc(it.link.text)}</a>${esc(it.v.slice(i + it.link.text.length))}`;
  }
  return section(s, `    <dl class="skills-grid">
      ${s.groups.map((g) => `<div class="skill"${blocks ? ' data-reveal="rise"' : ''}><dt>${esc(g.k)}</dt><dd>${esc(g.v)}</dd></div>`).join('\n      ')}
    </dl>${aiFrame(s.ai)}

    <div class="card-frame interests-card"${blocks ? ' data-reveal="panel"' : ''}>
      <h3 class="card-title">${esc(it.k)}</h3>
      <p class="interests">${v}</p>
    </div>`);
}
/* the AI engineering frame inside the skills section: the same label and short paragraph as the other skills, in a light frame, plus the certificate plan */
function aiFrame(a) {
  if (!a) return '';
  return `
    <div class="card-frame ai-frame"${a.anchor ? ` id="${a.anchor}"` : ''}${isBlocks() ? ' data-reveal="panel"' : ''}>
      <h3 class="card-title">${esc(a.title)}</h3>
      <dl class="ai-grid">
        ${a.groups.map((g) => `<div class="skill"><dt>${esc(g.k)}</dt><dd>${esc(g.v)}</dd></div>`).join('\n        ')}
      </dl>${a.cert ? `
      <p class="ai-cert"><strong>${esc(a.cert.k)}.</strong> ${esc(a.cert.v)}</p>` : ''}
    </div>`;
}
function contact(c) {
  const s = c.contact; const blocks = isBlocks();
  const items = s.rows.map((r) => r.links
    ? `<li${blocks ? ' data-reveal="rise"' : ''}>${esc(s.cvLabel)}: ${links(r.links)}</li>`
    : `<li${blocks ? ' data-reveal="rise"' : ''}><a href="${r.href}"${ext(r.href)}>${esc(/^https?:/.test(r.href) ? r.k : r.v)}</a></li>`).join('\n      ');
  return section(s, `    <p class="contact-email"${blocks ? ' data-reveal="rise"' : ''}><a href="mailto:${s.email}">${esc(s.email)}</a></p>
    <ul class="contact-list">
      ${items}
    </ul>`, 'section-contact');
}

/* ---------- quant tools ---------- */
const fmtIn = (v) => { let s = String(v); if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, ''); return LANG === 'cs' ? s.replace('.', ',') : s; };
const numAttrs = (name, min, max, step, value, decimals) => `type="text" ${Number(min) < 0 ? '' : 'inputmode="decimal" '}autocomplete="off" spellcheck="false" data-num name="${name}" min="${min}" max="${max}" step="${step}" value="${fmtIn(value)}"${decimals != null ? ` data-decimals="${decimals}"` : ''}`;
function ctl(tool, name, label, min, max, step, value, unit, decimals) {
  const id = `${tool}-${name}`;
  return `<div class="ctl">
          <label class="ctl-label" id="${id}-label" for="${id}">${rich(label)}</label>
          <span class="ctl-value"><input id="${id}" ${numAttrs(name, min, max, step, value, decimals)}><span class="unit"${unit ? '' : ' aria-hidden="true"'}>${unit ? esc(unit) : ''}</span></span>
          <input type="range" class="ctl-range" aria-labelledby="${id}-label" data-sync="${name}" min="${min}" max="${max}" step="${step}" value="${value}" tabindex="-1">
        </div>`;
}
function toggle(name, legend, options, def) {
  const d = def != null ? String(def) : options[0][0];
  return `<fieldset class="toggle" data-role="seg" data-name="${name}" data-default="${d}"><legend>${esc(legend)}</legend><div class="toggle-options">${options.map(([v, l]) => `<button type="button" data-value="${v}" aria-pressed="${v === d ? 'true' : 'false'}">${esc(l)}</button>`).join('')}</div></fieldset>`;
}
function ro(label, key, cls) { return `<div class="ro${cls ? ' ' + cls : ''}"><dt>${esc(label)}</dt><dd data-out="${key}">–</dd></div>`; }

function toolShell(c, t, controls, chart, readouts, extraBtns = '') {
  const cm = c.tools.common;
  return `<article class="tool" id="tool-${t.id}" data-tool="${t.id}" data-reveal="panel">
        <h2 class="tool-title">${esc(t.title)}</h2>
        <p class="tool-quote">${esc(t.quote)}</p>
        <p class="tool-spec">${esc(t.summary)}</p>
        <div class="panel">
          <div class="panel-body">
            <form class="controls" aria-label="${esc(cm.controls)}: ${esc(t.title)}" onsubmit="return false">
              ${controls}
              <div class="btn-row">${extraBtns}<button type="button" class="text-btn" data-role="reset">${esc(cm.reset)}</button></div>
            </form>
            <div class="chart">
              ${chart}
              <noscript><p class="chart-noscript">${esc(cm.noscript)}</p></noscript>
            </div>
            <div class="readouts">
              ${readouts}
            </div>
          </div>
          <p class="visually-hidden" aria-live="polite" data-role="live"></p>
          <p class="insight">${rich(t.insight)}</p>
          <details class="method"><summary>${esc(cm.details)}</summary><ul>${t.details.map((d) => `<li>${rich(d)}</li>`).join('')}</ul></details>
        </div>
      </article>`;
}
function toolBS(c, t) {
  const u = t.ui;
  const controls = [
    toggle('type', u.type, [['call', u.call], ['put', u.put]]),
    ctl('bs', 'S', u.S, 50, 200, 1, 100), ctl('bs', 'K', u.K, 50, 200, 1, 100),
    ctl('bs', 'T', u.T, 0.05, 2, 0.05, 0.5, u.unitYears, 2), ctl('bs', 'r', u.r, 0, 10, 0.25, 4, u.unitPct, 2), ctl('bs', 'sigma', u.sigma, 5, 80, 1, 22, u.unitPct, 1),
  ].join('\n              ');
  const chart = `<canvas data-role="chart" role="img" aria-label="${esc(u.aria)}"></canvas>
              <ul class="legend"><li><i class="sw sw-ink"></i>${esc(u.legendValue)}</li><li><i class="sw sw-dash"></i>${esc(u.legendPayoff)}</li></ul>`;
  const readouts = `<dl class="ro-list">
                ${ro(u.price, 'price', 'ro-main')}
                ${ro(u.delta, 'delta')}
                ${ro(u.gamma, 'gamma')}
                ${ro(u.vega, 'vega')}
                ${ro(u.theta, 'theta', 'ro-theta')}
                ${ro(u.intrinsic, 'intrinsic', 'ro-sep')}
                ${ro(u.timeValue, 'timeValue')}
              </dl>`;
  return toolShell(c, t, controls, chart, readouts);
}
function toolMC(c, t) {
  const u = t.ui;
  const controls = [
    ctl('mc', 'S0', u.S0, 50, 200, 1, 100), ctl('mc', 'mu', u.mu, -10, 20, 0.5, 6, u.unitPct, 1), ctl('mc', 'sigma', u.sigma, 5, 80, 1, 22, u.unitPct, 1),
    toggle('horizon', u.horizon, [['21', '21'], ['63', '63'], ['126', '126'], ['252', '252']], '252'),
    toggle('paths', u.paths, [['500', '500'], ['1000', c.lang === 'cs' ? '1 000' : '1,000'], ['2000', c.lang === 'cs' ? '2 000' : '2,000']], '1000'),
    toggle('dist', u.dist, [['normal', u.normal], ['jump', u.fat]]),
  ].join('\n              ');
  const chart = `<canvas data-role="chart" role="img" aria-label="${esc(u.aria)}"></canvas>
              <p class="chart-note" data-out="shown"></p>
              <ul class="legend"><li><i class="sw sw-ink"></i>${esc(u.legendMedian)}</li><li><i class="sw sw-dash"></i>${esc(u.legendPct)}</li><li><i class="sw sw-oxide"></i>${esc(u.legendVar)}</li><li data-role="legend-normal" hidden><i class="sw sw-oxide-dash"></i>${esc(u.legendVarNormal)}</li></ul>`;
  const readouts = `<table class="ro-table">
                <thead><tr><th scope="col"><span class="visually-hidden">${esc(c.tools.common.readouts)}</span></th><th scope="col" data-col="normal">${esc(u.colNormal)}</th><th scope="col" data-col="jump">${esc(u.colFat)}</th></tr></thead>
                <tbody>
                  <tr><th scope="row">${esc(u.median)}</th><td data-out="median-n">–</td><td data-out="median-t">–</td></tr>
                  <tr><th scope="row">${esc(u.mean)}</th><td data-out="mean-n">–</td><td data-out="mean-t">–</td></tr>
                  <tr class="is-oxide"><th scope="row">${esc(u.var)}</th><td data-out="var-n">–</td><td data-out="var-t">–</td></tr>
                  <tr class="is-oxide"><th scope="row">${esc(u.es)}</th><td data-out="es-n">–</td><td data-out="es-t">–</td></tr>
                  <tr><th scope="row">${esc(u.ploss)}</th><td data-out="ploss-n">–</td><td data-out="ploss-t">–</td></tr>
                  <tr class="row-delta" data-role="var-delta" hidden><th scope="row">${esc(u.varDelta)}</th><td></td><td data-out="varDelta">–</td></tr>
                  <tr class="row-delta" data-role="var-delta" hidden><th scope="row">${esc(u.esDelta)}</th><td></td><td data-out="esDelta">–</td></tr>
                </tbody>
              </table>`;
  return toolShell(c, t, controls, chart, readouts, `<button type="button" class="text-btn" data-role="reseed">${esc(u.rerun)}</button>`);
}
function toolMK(c, t) {
  const u = t.ui; const N = u.names;
  const num = (name, aria, min, max, step, value, dec) => `<input ${numAttrs(name, min, max, step, value, dec)}${aria ? ` aria-label="${esc(aria)}"` : ''}>`;
  const lab = (i, q) => `${u.asset} ${N[i]}: ${q} (${u.unitPct})`;
  const assets = `<table class="assets"><caption class="visually-hidden">${esc(u.assets)}</caption>
                <thead><tr><th scope="col">${esc(u.asset)}</th><th scope="col">${esc(u.mu)} ${esc(u.unitPct)}</th><th scope="col">${esc(u.sigma)} ${esc(u.unitPct)}</th></tr></thead>
                <tbody>
                  <tr><th scope="row">${esc(N[0])}</th><td>${num('mu1', lab(0, u.mu), 0, 20, 0.5, 5, 1)}</td><td>${num('sg1', lab(0, u.sigma), 5, 60, 1, 12, 0)}</td></tr>
                  <tr><th scope="row">${esc(N[1])}</th><td>${num('mu2', lab(1, u.mu), 0, 20, 0.5, 8, 1)}</td><td>${num('sg2', lab(1, u.sigma), 5, 60, 1, 18, 0)}</td></tr>
                  <tr><th scope="row">${esc(N[2])}</th><td>${num('mu3', lab(2, u.mu), 0, 20, 0.5, 12, 1)}</td><td>${num('sg3', lab(2, u.sigma), 5, 60, 1, 30, 0)}</td></tr>
                </tbody>
              </table>
              <div class="corr" role="group" aria-label="${esc(u.corr)}"><span class="ctl-label">${esc(u.corr)}</span>
                <label>${esc(u.rho)}(${esc(N[0])},${esc(N[1])}) ${num('r12', null, -0.9, 0.95, 0.05, 0.3, 2)}</label>
                <label>${esc(u.rho)}(${esc(N[0])},${esc(N[2])}) ${num('r13', null, -0.9, 0.95, 0.05, 0.2, 2)}</label>
                <label>${esc(u.rho)}(${esc(N[1])},${esc(N[2])}) ${num('r23', null, -0.9, 0.95, 0.05, 0.4, 2)}</label>
              </div>`;
  const controls = [
    assets,
    ctl('mk', 'rf', u.rf, 0, 6, 0.25, 2, u.unitPct, 2),
    toggle('short', u.short, [['none', u.noShort], ['short', u.withShort]]),
  ].join('\n              ');
  const chart = `<canvas data-role="chart" role="img" aria-label="${esc(u.aria)}"></canvas>
              <p class="chart-note" data-role="error-caption" hidden>${esc(u.caption)}</p>
              <p class="chart-note is-warn" data-role="psd-note" hidden></p>
              <p class="chart-note is-warn" data-role="no-tangency" hidden>${esc(u.noTangency)}</p>
              <ul class="legend"><li><i class="sw sw-cloud"></i>${esc(u.legendCloud)}</li><li><i class="sw sw-ink"></i>${esc(u.legendFrontier)}</li><li><i class="sw sw-navy"></i>${esc(u.legendMax)} ${LANG === 'cs' ? 'a\u00a0' : 'and '}${esc(u.legendCml)}</li><li class="legend-ghost" hidden><i class="sw sw-oxide"></i>${esc(u.legendGhost)}</li></ul>`;
  const readouts = `<p class="ro-title">${esc(u.maxSharpe)}</p>
              <dl class="ro-list">
                ${ro(u.ret, 'ret', 'ro-main')}
                ${ro(u.risk, 'risk')}
                ${ro(u.sharpe, 'sharpe')}
              </dl>
              <table class="weights">
                <thead><tr><th scope="col">${esc(u.weights)}</th><th scope="col">${esc(u.colEstimate)}</th><th scope="col" class="col-err" hidden>${esc(u.colError)}</th></tr></thead>
                <tbody>
                  ${N.map((n, i) => `<tr><th scope="row">${esc(n)}</th><td><span class="wbar" aria-hidden="true"><i data-bar="${i}"></i></span><span data-out="w${i + 1}">–</span></td><td class="col-err" hidden data-out="e${i + 1}">–</td></tr>`).join('\n                  ')}
                </tbody>
              </table>`;
  return toolShell(c, t, controls, chart, readouts, `<button type="button" class="text-btn btn-error" data-role="error" aria-pressed="false">${esc(u.error)}</button>`);
}
function tools(c) {
  const s = c.tools; const r = { bs: toolBS, mc: toolMC, mk: toolMK };
  return section(s, `    <p class="section-heading" data-split>${esc(s.heading)}</p>
    <div class="tools">
      ${s.items.map((t) => r[t.id](c, t)).join('\n      ')}
    </div>
    <script type="application/json" id="quant-ui">${json(Object.fromEntries(s.items.map((t) => [t.id, t.ui])))}</script>`, 'section-tools');
}

/* ---------- variant C: tools teaser on the home page, tools on their own page ---------- */
function toolsTeaser(c) {
  const t = c.tools; const tz = t.teaser; const page = P(t.page.meta.path);
  const art = { bs: thumbs && thumbs.thumbBS, mc: thumbs && thumbs.thumbMC, mk: thumbs && thumbs.thumbMK };
  const cards = tz.cards.map((k) => `<li class="tcard" data-reveal="card"><a href="${page}#tool-${k.id}"><div class="tcard-art">${art[k.id] ? art[k.id]() : ''}</div><div class="tcard-body"><h3>${esc(k.title)}</h3><p>${esc(k.text)}</p></div></a></li>`).join('\n      ');
  return `<section id="${t.id}" class="section section-teaser" aria-labelledby="h-${t.id}">
  <div class="rail" data-reveal="rail"><h2 id="h-${t.id}">${maskWords(tz.title)}</h2></div>
  <div class="content">
    <p class="section-intro" data-magic>${magic(tz.lead)}</p>
    <ul class="tcards">
      ${cards}
    </ul>
    <p class="actions" data-reveal="rise"><a class="btn-fill" href="${page}">${esc(tz.cta)}</a></p>
  </div>
</section>`;
}
function toolsPage(c) {
  const t = c.tools; const p = t.page; const r = { bs: toolBS, mc: toolMC, mk: toolMK };
  return `<section class="page-head" aria-labelledby="page-title">
  <p class="crumb"><a href="${P(c.meta.path)}">${esc(p.back)}</a></p>
  <h1 id="page-title" class="page-title">${maskWords(p.title)}</h1>
  <p class="page-intro" data-magic>${magic(p.intro)}</p>
  <nav class="page-index" aria-label="${esc(p.index)}"><ul>${t.items.map((i) => `<li><a href="#tool-${i.id}">${esc(i.title)}</a></li>`).join('')}</ul></nav>
  <p class="page-more">${esc(p.more)}</p>
</section>
<section class="section section-tools">
  <div class="content">
    <div class="tools">
      ${t.items.map((i) => r[i.id](c, i)).join('\n      ')}
    </div>
    <script type="application/json" id="quant-ui">${json(Object.fromEntries(t.items.map((i) => [i.id, i.ui])))}</script>
  </div>
</section>`;
}

export function renderSite(c) {
  const m = c.meta; const blocks = isBlocks();
  HINTS = blocks && c.hints ? c.hints : {};
  const pg = { kind: 'home', title: m.title, description: m.description, path: m.path, altPath: m.altLang.path };
  return `${head(c, pg)}
<body>
${nav(c, pg)}
<main id="main">
${hero(c)}
${profile(c)}
${experience(c)}
${blocks ? toolsTeaser(c) : tools(c)}
${projects(c)}
${education(c)}
${skills(c)}
${contact(c)}
</main>
${footer(c, pg)}
</body>
</html>
`;
}
export function renderTools(c) {
  const p = c.tools.page; const pg = { kind: 'tools', title: p.meta.title, description: p.meta.description, path: p.meta.path, altPath: p.meta.altPath };
  return `${head(c, pg)}
<body class="page-tools">
${nav(c, pg)}
<main id="main">
${toolsPage(c)}
</main>
${footer(c, pg)}
</body>
</html>
`;
}

const write = (rel, html, tag) => {
  const out = (V.dir || '') + rel;
  mkdirSync(dirname(join(root, out)), { recursive: true });
  writeFileSync(join(root, out), html);
  console.log('wrote', out, html.length, 'bytes', `(variant ${V.key}${tag ? ', ' + tag : ''})`);
};
for (const variant of VARIANTS) {
  V = variant;
  for (const lang of ['cs', 'en']) {
    const c = JSON.parse(readFileSync(join(root, 'src', `content.${lang}.json`), 'utf8'));
    LANG = lang;
    write(lang === 'cs' ? 'index.html' : 'en/index.html', renderSite(c));
    if (isBlocks()) write(c.tools.page.meta.path.replace(/^\//, '') + 'index.html', renderTools(c), 'tools');
  }
}
if (process.argv.includes('--cv')) {
  const { renderCV, htmlToPdf } = await import('./src/cv.mjs');
  for (const [lang, suffix] of [['en', 'EN'], ['cs', 'CZ']]) {
    const c = JSON.parse(readFileSync(join(root, 'src', `content.${lang}.json`), 'utf8'));
    const htmlPath = join(process.env.TMPDIR || '/tmp', `Adam-Zikmund-CV-${suffix}.html`);
    writeFileSync(htmlPath, renderCV(c));
    htmlToPdf(htmlPath, join(root, 'cv', `Adam-Zikmund-CV-${suffix}.pdf`));
    console.log('wrote cv/Adam-Zikmund-CV-' + suffix + '.pdf');
  }
}
