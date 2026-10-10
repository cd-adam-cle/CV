# Adam Zikmund: osobní web a CV

Statický web (úvodní stránka a stránka s nástroji, čeština + `/en/`) ve třech variantách vzhledu a jednostránkové CV v PDF (EN + CZ). Hostováno na Vercelu bez build kroku: Vercel servíruje soubory z repozitáře tak, jak jsou.

## Struktura

| Cesta | Co to je |
|---|---|
| `index.html`, `en/index.html` | varianta C (hlavní), vygenerované stránky (needitovat ručně) |
| `nastroje/index.html`, `en/tools/index.html` | samostatná stránka s nástroji (jen varianta C), také generovaná |
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
| `assets/js/motion.js` | jen varianta C: připnutý nadpis, jehož slova se rozsvěcují scrollem, odkrývání textu po slovech, objevování bloků a čára průchodu stránkou; respektuje `prefers-reduced-motion` |
| `assets/js/hints.js` | jen varianta C, úvodní stránka: poznámky u označených slov v hero a Profilu (najetí myší, fokus z klávesnice, první klepnutí) |
| `assets/js/skyline.js`, `assets/css/skyline.css` | jen varianta C: graf příspěvků ve stylu GitHubu (2D mřížka a 3D panorama), čistý JS + canvas |
| `src/contributions.json`, `scripts/build-contributions.mjs` | počty commitů po dnech za poslední rok pro graf; obnova je v části Graf commitů níže |
| `src/thumbs.mjs` | SVG náhledy tří modelů na kartách nástrojů (skutečné výpočty, žádné obrázky) |
| `assets/js/quant.js` | tři interaktivní modely (Black–Scholes, Monte Carlo se skoky podle Mertona, Markowitz), čistý JS + canvas |
| `src/typo.mjs` | česká typografie (nezlomitelné mezery) pro web i CV |
| `.vercelignore` | na Vercel jde jen `index.html`, `en/`, `nastroje/`, `a/`, `b/`, `assets/`, `cv/` a `vercel.json` |
| `_old/` | předchozí verze webu a nepoužité soubory (v `.gitignore`, nenasazuje se) |

## Úprava obsahu

1. Uprav text v `src/content.cs.json` a `src/content.en.json` (stejná struktura, drž obě verze v souladu).
2. Spusť `node build.mjs` (jen web) nebo `node build.mjs --cv` (web + PDF; PDF se tiskne přes headless Google Chrome z `/Applications`).
3. Zkontroluj, že CV zůstalo na jedné straně, a commitni vygenerované soubory.

Až si vybereš variantu, stačí v `src/variants.json` nechat jen ji (složka `""`) a smazat složky `a/` a `b/`.

## Rámeček AI engineering v Dovednostech

Je v obsahu pod `skills.ai` (nadpis, skupiny `k` a `v` ve stejné podobě jako ostatní dovednosti a poznámka `cert` o certifikacích). Vykresluje ho `aiFrame()` v `build.mjs` mezi mřížkou dovedností a zájmy, styly jsou v `assets/css/site.css` (základ pro všechny varianty) a `assets/css/variant-c.css` (karta). Do rámečku patří jen to, co jde doložit prací nebo konfigurací. Poznámka o certifikacích mluví o plánu, dokud certifikát není získaný; po získání ji přepiš na hotovou věc a uveď přesný název z oficiální stránky Anthropic.

## Kresby u rozsvěcených slov (hero a Profil)

V textu hero (`hero.title`) a profilu (`profile.lead`) značka `{id}slova{/}` určí slova, u kterých se při scrollování vpravo objeví černobílá čárová kresba `id` ze `src/figs.mjs` (počítaná, ne kreslená ručně: odmocnina z dílků se svíčkovým grafem u Matfyzu, okno aplikace s grafem u softwaru, náhodné cesty a hustota pro finanční matematiku, graf s nejkratší cestou, neuronová síť, proces s AI krokem, mapa farností, záznamový arch, scraping do modelu, model EU ETS 2 a rozložení portfolia). Ukazuje se vždy kresba k poslední rozsvícené značce. Připnutá vzdálenost hero (`.hero-track`, nejméně 960 px) dává každé kresbě aspoň jeden krok kolečka myši (asi 100 px), takže se při scrollování kolečkem žádná nepřeskočí. Kresby jsou jen na širokých obrazovkách od 1100 px a jen když běží pohyb; při omezeném pohybu, bez JavaScriptu nebo při vysokém kontrastu zůstane čistý text. Ve variantách A a B a všude jinde se značky z textu odstraní.

## Poznámky u označených slov (hero a Profil)

Každá značka `{id}…{/}` může mít v obsahu poznámku `hints.<id>` = `{ "text", "link", "href" }`. Fráze se pak ve variantě C vykreslí jako odkaz na `href` (sekce, položka nebo stránka) s jemným tečkovaným podtržením a `text` je její popis pro čtečky (`aria-describedby`). Odkaz obsahuje přesně označená slova: předložka přilepená nezlomitelnou mezerou a interpunkce za frází stojí ve vlastních spanech mimo odkaz (`data-sat`) a rozsvěcují se se svým slovem. `assets/js/hints.js` ukáže text a odkaz `link` v malém okénku pod frází (nad ní, když dole není místo):

- myš: okénko se otevře, až když se ukazatel na frázi zastaví (přejíždění přes text nic neotevírá, obsah posouvaný pod stojící myší také ne); zůstane, dokud ukazatel míří k okénku, a jiná fráze ho převezme jen tehdy, když se na ní ukazatel zastaví. Scrollování okénko otevřené myší zavře, aby nezakrývalo rozsvěcovaná slova; Escape ho zavře, dokud ukazatel frázi neopustí;
- klávesnice: okénko je otevřené, dokud má fráze viditelný fokus, po doskrolování se znovu umístí; Escape zavře, Enter otevře odkaz;
- dotyk: první klepnutí otevře okénko, druhé klepnutí nebo odkaz v okénku přejde na cíl.

Dokud je okénko otevřené, vedle textu se ukazuje kresba té fráze. Zavřené okénko není v layoutu, takže při otočení telefonu nebo zúžení okna nikdy nerozšíří stránku. Bez JavaScriptu jsou fráze obyčejné odkazy.

Cíle uvnitř stránky jsou sekce (`#projekty`) nebo položky s polem `anchor` v obsahu (řádky Zkušeností a Vzdělání, karty Projektů, rámeček AI engineering), které se vykreslí jako `id`. Při změně textu nebo kotvy zkontroluj, že každý `href` z `hints` míří na existující prvek.

Karty Projektů: první je široká, takže když by poslední karta zůstala v řádku sama (počet karet dělitelný třemi), roztáhne se na šířku stránky s nadpisem vlevo a body vpravo.

## Světlý a tmavý režim

Varianta C má oba režimy. Ve výchozím stavu sleduje nastavení systému, tlačítko v hlavičce volbu přepne a uloží (`localStorage`, klíč `theme`). Barvy jsou jen v CSS proměnných na začátku `assets/css/variant-c.css`; grafy nástrojů a graf příspěvků je čtou z nich a po přepnutí se překreslí (událost `themechange`).

## Graf commitů

Graf ukazuje posledních pět týdnů po dnech jako malý kalendář (řádek je týden, sloupec je den v týdnu; 2D mřížka nebo 3D panorama, počet týdnů je `ACTIVITY_WEEKS` v `build.mjs`, orientaci řídí `data-orient="rows"`), velké číslo v nadpisu je součet za posledních 53 týdnů. Data jsou snímek `src/contributions.json` (jen data a denní počty, žádné názvy repozitářů, zprávy ani autoři). Počítá se každý commit bez sloučení větví, a to jednou podle jeho hashe, takže klony stejného repozitáře se nezdvojují. Započítávají se commity pod mými identitami (jméno nebo adresa obsahuje `cd-adam-cle` nebo `zikmund`, tedy i pracovní a školní adresa i adresy vymyšlené gitem) a commity asistenta (`noreply@anthropic.com`, tedy i z cloudových session) v repozitářích, které jsou moje: remote pod mým účtem nebo bez remote. Commity cizích lidí se nepočítají.

Obnova snímku před nasazením:

```
node scripts/build-contributions.mjs --github cd-adam-cle --clone git@github.com:cd-adam-cle/<repozitář>.git ~/Claude ~/Development
node build.mjs
```

Složky se prohledají na git repozitáře, `--github` přidá veřejné repozitáře z GitHubu a `--clone` přidá soukromý repozitář, který na počítači není (stáhnou se jen metadata commitů a hned se smažou). Další soukromý repozitář přidáš dalším `--clone`.

## Zásady

- Žádné vymyšlené údaje: všechno na webu i v CV musí odpovídat skutečnosti a LinkedInu.
- Jedna akcentní barva (navy) v rozhraní; oxidová barva jen v datech (VaR, tlusté konce, chyba odhadu).
- Nástroje na webu jsou vzdělávací ukázky, ne investiční doporučení.
