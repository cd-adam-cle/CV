# Adam Zikmund — osobní web a CV

Statický jednostránkový web (čeština + `/en/`) a jednostránkové CV v PDF (EN + CZ). Hostováno na Vercelu bez build kroku: Vercel servíruje soubory z repozitáře tak, jak jsou.

## Struktura

| Cesta | Co to je |
|---|---|
| `index.html`, `en/index.html` | vygenerované stránky (needitovat ručně) |
| `src/content.cs.json`, `src/content.en.json` | **jediný zdroj obsahu** pro web i CV (texty, data, odkazy) |
| `build.mjs` | generuje obě stránky z obsahu; `--cv` navíc vyrobí PDF |
| `src/cv.mjs` | šablona CV (A4, EB Garamond, konvence investment-banking CV) |
| `cv/Adam-Zikmund-CV-EN.pdf`, `cv/Adam-Zikmund-CV-CZ.pdf` | hotová CV, na která web odkazuje |
| `assets/css/site.css` | design (papír, Schibsted Grotesk + IBM Plex Mono, vlasové linky) |
| `assets/js/site.js` | navigace, scroll-spy, jemný reveal |
| `assets/js/quant.js` | tři interaktivní modely (Black–Scholes, Monte Carlo se skoky podle Mertona, Markowitz), čistý JS + canvas |
| `src/typo.mjs` | česká typografie (nezlomitelné mezery) pro web i CV |
| `.vercelignore` | na Vercel jde jen `index.html`, `en/`, `assets/`, `cv/` a `vercel.json` |
| `_old/` | předchozí verze webu a nepoužité soubory (v `.gitignore`, nenasazuje se) |

## Úprava obsahu

1. Uprav text v `src/content.cs.json` a `src/content.en.json` (stejná struktura, drž obě verze v souladu).
2. Spusť `node build.mjs` (jen web) nebo `node build.mjs --cv` (web + PDF; PDF se tiskne přes headless Google Chrome z `/Applications`).
3. Zkontroluj, že CV zůstalo na jedné straně, a commitni vygenerované soubory.

Konstanta `updated` v obou JSON souborech je datum „Aktualizováno“ v hlavičce i patičce — při změně obsahu ji přepiš.

## Zásady

- Žádné vymyšlené údaje: všechno na webu i v CV musí odpovídat skutečnosti a LinkedInu.
- Jedna akcentní barva (navy) v rozhraní; oxidová barva jen v datech (VaR, tlusté konce, chyba odhadu).
- Nástroje v sekci 03 jsou vzdělávací ukázky, ne investiční doporučení.
