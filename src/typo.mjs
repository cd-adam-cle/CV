// Typographic pass on visible text: non-breaking spaces where Czech (and numbers) must not break.
const NBSP = '\u00a0';
export function typo(str, LANG = 'cs') {
  let t = String(str);
  t = t.replace(/(?<=\d) (?=\d{3}\b)/g, NBSP);                   // 1 000 000
  t = t.replace(/(\d) %/g, `$1${NBSP}%`);
  t = t.replace(/(\S) ([ABC][12])\b/g, `$1${NBSP}$2`);                        // angličtina C1, German A2
  t = t.replace(/\b(od|do|ze|v|in|since|from) (\d{4})\b/g, `$1${NBSP}$2`);       // od 2026, since 2026
  t = t.replace(/ ([A-Za-zα-ωΑ-Ω](?:_[a-z]+|[₀-₉]+)?)(?=$| \(|[.,;:](?:\s|$))/g, `${NBSP}$1`);   // keep a trailing variable symbol (r, σ, S₀, r_f) with its label
  t = t.replace(/(\d(?:\u00a0| )?%) (VaR|ES)\b/g, `$1${NBSP}$2`);                 // 5% VaR                           // 1,35 %
  t = t.replace(/(\d) (Kč|p\. a\.|p\.a\.|p\. b\.|dní|hodin|let|km\/h|km|h|fps|scénářů|aktiva|fondech|funds|years|days|paths)(?=[\s,.;:)]|$)/g, `$1${NBSP}$2`); // 1 000 Kč, 5 % p. a., 24 hodin
  t = t.replace(/\bp\. a\./g, `p.${NBSP}a.`);
  t = t.replace(/\bp\. b\./g, `p.${NBSP}b.`);
  t = t.replace(/(\d) (–|-) (\d)/g, `$1${NBSP}$2 $3`);               // 06/2026 – 09/2026 (keep break after dash)
  if (LANG === 'cs') {
    t = t.replace(/(^|[\s(„"])([KSVZOUAIksvzouai]) (?=\S)/g, `$1$2${NBSP}`); // one-letter prepositions and conjunctions
    t = t.replace(/(\d{1,2}\.) (ročník|semestr)/g, `$1${NBSP}$2`);
  }
  return t;
}
