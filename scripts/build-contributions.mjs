// Builds src/contributions.json: commits per day over the last year, counted from git history.
//
//   node scripts/build-contributions.mjs [--github <user>] [--clone <git-url>]... [--end YYYY-MM-DD] <folder> [<folder> ...]
//
// What is counted. Every non-merge commit that is reachable from a branch (local or remote-tracking) is counted once,
// by its hash, so clones of the same repository never count twice. A commit counts when it is the owner's (any author
// name or address containing "cd-adam-cle" or "zikmund", which covers the GitHub name, the personal, school and work
// addresses and the addresses git invents for a laptop) or when it was written by the coding assistant
// (noreply@anthropic.com, which includes the owner's cloud sessions) in a repository that belongs to the owner: its remote
// is under the owner's GitHub account or it has no remote. Commits by other people are never counted.
//
// Where it looks. The folders are searched for git repositories (nested ones too). With --github the default-branch
// commits of that user's public repositories are added. With --clone a repository that is not on this machine is
// fetched without file contents (git clone --bare --filter=blob:none, read-only), counted, and deleted again.
//
// Only dates and daily counts are written to the file, never repository names, messages or authors.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
let github = null; let endArg = null; const folders = []; const clones = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--github') github = args[++i];
  else if (args[i] === '--clone') clones.push(args[++i]);
  else if (args[i] === '--end') endArg = args[++i];
  else folders.push(resolve(args[i]));
}
if (!folders.length && !github && !clones.length) { console.error('Usage: node scripts/build-contributions.mjs [--github <user>] [--clone <git-url>]... [--end YYYY-MM-DD] <folder> ...'); process.exit(1); }

const MINE = /cd-adam-cle|zikmund/i;
const ASSISTANT = /noreply@anthropic\.com/i;
const OWNER = /cd-adam-cle/i; // a repository counts as the owner's when its remote is under this GitHub account
const DAY = 86400000;
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const now = new Date(); const localToday = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
const endMs = endArg ? Date.parse(endArg + 'T00:00:00Z') : localToday;
// The graph shows the 53 weeks that end with the week of the end date, weeks starting on Monday; start the data on that Monday.
const startMs = endMs - 364 * DAY;
const fromMs = startMs - ((new Date(startMs).getUTCDay() + 6) % 7) * DAY;
const from = iso(fromMs); const end = iso(endMs);

const commits = new Map(); // hash -> YYYY-MM-DD
const stats = { repos: 0, mine: 0, assistant: 0, others: 0, github: 0 };

// rows: [hash, "name <email> login", date] already limited to the window; applies the counting rule for one repository
function take(rows, fromGithub, owned) {
  stats.others += rows.filter((r) => !MINE.test(r[1]) && !ASSISTANT.test(r[1])).length;
  for (const [h, who, d] of rows) {
    const mine = MINE.test(who); const assistant = !mine && ASSISTANT.test(who);
    if (!(mine || (assistant && owned))) continue;
    if (commits.has(h)) continue;
    commits.set(h, d);
    if (fromGithub) stats.github++; else if (mine) stats.mine++; else stats.assistant++;
  }
}

/* ---------- repositories on this machine, and read-only metadata clones ---------- */
const SKIP = new Set(['node_modules', '.next', '.venv', 'venv', 'Pods', '.build', 'Library', '.Trash', '.cache', '.npm', 'dist', '__pycache__']);
function findRepos(dir, depth, out) {
  if (depth > 8) return;
  let names; try { names = readdirSync(dir); } catch { return; }
  if (names.includes('.git')) out.push(dir);
  for (const n of names) {
    if (n === '.git' || SKIP.has(n)) continue;
    const p = join(dir, n);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) findRepos(p, depth + 1, out);
  }
}
function readRepo(path) {
  let out;
  try { out = execFileSync('git', ['-C', path, 'log', '--branches', '--remotes', '--no-merges', `--since=${from}`, '--format=%H%x09%an <%ae>%x09%ad', '--date=format:%Y-%m-%d'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch { return; } // no commits yet, or not readable
  const rows = out.split('\n').map((l) => l.split('\t')).filter((p) => p.length === 3 && p[2] >= from && p[2] <= end);
  if (!rows.length) return;
  stats.repos++;
  let remotes = [];
  try { remotes = execFileSync('git', ['-C', path, 'remote', '-v'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').filter(Boolean); } catch { /* no remotes */ }
  const owned = remotes.length === 0 || remotes.some((l) => OWNER.test(l));
  take(rows, false, owned);
}
const repos = []; for (const f of folders) findRepos(f, 0, repos);
for (const r of repos) readRepo(r);
if (clones.length) {
  const tmp = mkdtempSync(join(tmpdir(), 'contributions-'));
  try {
    clones.forEach((url, i) => {
      const dest = join(tmp, `r${i}.git`);
      try { execFileSync('git', ['clone', '--bare', '--filter=blob:none', '--quiet', url, dest], { stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, GIT_SSH_COMMAND: 'ssh -o BatchMode=yes -o ConnectTimeout=15' } }); readRepo(dest); }
      catch (e) { console.error(`could not read a --clone repository (${e.message.split('\n')[0]})`); }
    });
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

/* ---------- public repositories on GitHub (default branch) ---------- */
if (github) {
  const gh = async (url) => { const r = await fetch(url, { headers: { accept: 'application/vnd.github+json', 'user-agent': 'cv-site-contributions' } }); if (!r.ok) throw new Error(`${url} -> ${r.status}`); return r.json(); };
  const list = await gh(`https://api.github.com/users/${github}/repos?per_page=100&type=owner`);
  for (const repo of list) {
    if (repo.fork) continue;
    const rows = [];
    for (let page = 1; page < 20; page++) {
      let batch;
      try { batch = await gh(`https://api.github.com/repos/${github}/${repo.name}/commits?since=${from}T00:00:00Z&per_page=100&page=${page}`); }
      catch (e) { if (/409/.test(e.message)) break; throw e; } // 409 = empty repository
      for (const c of batch) {
        if ((c.parents || []).length > 1) continue;
        const a = (c.commit && c.commit.author) || {}; const d = (a.date || '').slice(0, 10);
        if (!d || d < from || d > end) continue;
        rows.push([c.sha, `${a.name || ''} <${a.email || ''}> ${(c.author && c.author.login) || ''}`, d]);
      }
      if (batch.length < 100) break;
    }
    take(rows, true, true); // the user's own repositories on GitHub
  }
}

/* ---------- daily counts ---------- */
const perDay = new Map(); for (const d of commits.values()) perDay.set(d, (perDay.get(d) || 0) + 1);
const days = []; for (let ms = fromMs; ms <= endMs; ms += DAY) days.push([iso(ms), perDay.get(iso(ms)) || 0]);
const total = days.reduce((s, d) => s + d[1], 0);
writeFileSync(join(root, 'src', 'contributions.json'), JSON.stringify({ fetched: iso(localToday), from, end, unit: 'commits', total, days }) + '\n');
const active = days.filter((d) => d[1] > 0).length; const best = days.reduce((m, d) => (d[1] > m[1] ? d : m), ['', 0]);
console.log(`src/contributions.json: ${total} commits on ${active} days, ${from} to ${end}; busiest day ${best[0]} with ${best[1]}`);
console.log(`  from ${stats.repos} repositories with commits in the window: ${stats.mine} by the owner, ${stats.assistant} by the assistant; ${stats.github} more from public GitHub repositories; ${stats.others} commits by other people were left out`);
