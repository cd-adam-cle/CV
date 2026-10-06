// CV generator: content.<lang>.json -> HTML -> PDF (headless Chrome).
// Usage: node src/cv.mjs [--html-only]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { typo } from './typo.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
let CV_LANG = 'cs';
const esc = (s) => typo(String(s), CV_LANG).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const CSS = `
@page { size: A4; margin: 0; }
html, body { margin: 0; padding: 0; }
body {
  font-family: "EB Garamond", Garamond, "Times New Roman", serif;
  font-size: 10.5pt; line-height: 1.15; color: #000; background: #fff;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.page { width: 210mm; min-height: 297mm; box-sizing: border-box; padding: 10mm 14mm 9mm 14mm; }
header { text-align: center; margin-bottom: 7pt; }
h1 { font-size: 17pt; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; margin: 0 0 3pt 0; }
.contact { font-size: 9.6pt; margin: 0; }
.contact a { color: inherit; text-decoration: none; }
h2 { font-size: 10.8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin: 6pt 0 2pt 0; padding-bottom: 1pt; border-bottom: 0.9pt solid #000; }
.entry { margin: 0 0 3.4pt 0; break-inside: avoid; }
.row { display: flex; justify-content: space-between; align-items: baseline; gap: 10pt; }
.row.top { font-weight: 700; }
.row.sub { font-style: italic; }
.row .r { white-space: nowrap; font-weight: 400; }
ul { margin: 1pt 0 0 0; padding-left: 11pt; }
li { margin: 0 0 0.6pt 0; padding-left: 1pt; text-wrap: pretty; }
.skills div { text-wrap: pretty; }
li::marker { font-size: 8pt; }
.skills { margin: 0; }
.skills div { margin: 0 0 1pt 0; }
.skills b { font-weight: 700; }
`;

function entry(top, topR, sub, subR, bullets) {
  return `<div class="entry">
    <div class="row top"><span>${esc(top)}</span><span class="r">${esc(topR)}</span></div>
    ${sub || subR ? `<div class="row sub"><span>${esc(sub || '')}</span><span class="r">${esc(subR || '')}</span></div>` : ''}
    ${bullets && bullets.length ? `<ul>${bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
  </div>`;
}

export function renderCV(c) {
  CV_LANG = c.lang;
  const cv = c.cv;
  const contact = cv.contactLine.split(' · ').map((part) => {
    if (part.includes('@')) return `<a href="mailto:${esc(part)}">${esc(part)}</a>`;
    if (/^\+?[\d ]+$/.test(part)) return `<a href="tel:${part.replace(/\s/g, '')}">${esc(part)}</a>`;
    if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(part)) return `<a href="https://${esc(part)}">${esc(part)}</a>`;
    return esc(part);
  }).join(' · ');
  return `<!doctype html>
<html lang="${c.lang}"><head><meta charset="utf-8"><title>${esc(cv.fileTitle)}</title>
<meta name="author" content="${esc(cv.name)}"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;1,400&display=block"><style>${CSS}</style></head>
<body><div class="page">
<header><h1>${esc(cv.name)}</h1><p class="contact">${contact}</p></header>
<h2>${esc(cv.sections.education)}</h2>
${cv.education.map(e => entry(e.school, e.place, e.degree, e.period, e.bullets)).join('')}
<h2>${esc(cv.sections.experience)}</h2>
${cv.experience.map(e => entry(e.org, e.place, e.role, e.period, e.bullets)).join('')}
<h2>${esc(cv.sections.projects)}</h2>
${cv.projects.map(p => entry(p.name, p.period, '', '', p.bullets)).join('')}
<h2>${esc(cv.sections.skills)}</h2>
<div class="skills">${cv.skills.map(s => `<div><b>${esc(s.k)}:</b> ${esc(s.v)}</div>`).join('')}</div>
</div></body></html>`;
}

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export function htmlToPdf(htmlPath, pdfPath) {
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${pdfPath}`, `file://${htmlPath}`], { stdio: 'ignore' });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const htmlOnly = process.argv.includes('--html-only');
  const outDir = process.env.CV_HTML_DIR || process.env.TMPDIR || '/tmp';
  mkdirSync(outDir, { recursive: true });
  for (const [lang, suffix] of [['en', 'EN'], ['cs', 'CZ']]) {
    const c = JSON.parse(readFileSync(join(root, 'src', `content.${lang}.json`), 'utf8'));
    const html = renderCV(c);
    const htmlPath = join(outDir, `Adam-Zikmund-CV-${suffix}.html`);
    writeFileSync(htmlPath, html);
    if (!htmlOnly) {
      const pdfPath = join(root, 'cv', `Adam-Zikmund-CV-${suffix}.pdf`);
      htmlToPdf(htmlPath, pdfPath);
      console.log('PDF:', pdfPath);
    }
  }
}
