# Adam Zikmund — osobní web a CV

Statický jednostránkový web (čeština + `/en/`) ve třech variantách vzhledu a jednostránkové CV v PDF (EN + CZ). Hostováno na Vercelu bez build kroku: Vercel servíruje soubory z repozitáře tak, jak jsou.

## Struktura

| Cesta | Co to je |
|---|---|
| `index.html`, `en/index.html` | varianta C (hlavní), vygenerované stránky (needitovat ručně) |
| `a/`, `b/` | varianty A a B na porovnání (`noindex`), také generované |
| `src/variants.json` | seznam variant: složka, písma z Google Fonts, styl varianty, `layout` (`blocks` = varianta C) |
| `src/content.cs.json`, `src/content.en.json` | **jediný zdroj obsahu** pro web i CV (texty, data, odkazy) |
| `build.mjs` | generuje obě stránky z obsahu; `--cv` navíc vyrobí PDF |
| `src/cv.mjs` | šablona CV (A4, EB Garamond, konvence investment-banking CV) |
| `cv/Adam-Zikmund-CV-EN.pdf`, `cv/Adam-Zikmund-CV-CZ.pdf` | hotová CV, na která web odkazuje |
| `assets/css/site.css` | společná struktura (mřížka, řádky, nástroje), bez písem a barev |
| `assets/css/variant-c.css` | C: blokové rozvržení ve stylu VC fondů, Archivo (titulky) + Source Sans 3 (text), scroll animace |
| `assets/css/variant-a.css`, `variant-b.css` | A: teplý papír a Source Sans 3; B: bílá a Literata |
| `assets/js/site.js` | mobilní menu a zvýraznění aktivní sekce, bez animací |
| `assets/js/motion.js` | jen varianta C: průlet písmenem jména při scrollu, odkrývání textu po slovech, objevování bloků; respektuje `prefers-reduced-motion` |
| `assets/js/quant.js` | tři interaktivní modely (Black–Scholes, Monte Carlo se skoky podle Mertona, Markowitz), čistý JS + canvas |
| `src/typo.mjs` | česká typografie (nezlomitelné mezery) pro web i CV |
| `.vercelignore` | na Vercel jde jen `index.html`, `en/`, `a/`, `b/`, `assets/`, `cv/` a `vercel.json` |
| `_old/` | předchozí verze webu a nepoužité soubory (v `.gitignore`, nenasazuje se) |

## Úprava obsahu

1. Uprav text v `src/content.cs.json` a `src/content.en.json` (stejná struktura, drž obě verze v souladu).
2. Spusť `node build.mjs` (jen web) nebo `node build.mjs --cv` (web + PDF; PDF se tiskne přes headless Google Chrome z `/Applications`).
3. Zkontroluj, že CV zůstalo na jedné straně, a commitni vygenerované soubory.

Až si vybereš variantu, stačí v `src/variants.json` nechat jen ji (složka `""`) a smazat složky `a/` a `b/`.

## Zásady

- Žádné vymyšlené údaje: všechno na webu i v CV musí odpovídat skutečnosti a LinkedInu.
- Jedna akcentní barva (navy) v rozhraní; oxidová barva jen v datech (VaR, tlusté konce, chyba odhadu).
- Nástroje na webu jsou vzdělávací ukázky, ne investiční doporučení.
