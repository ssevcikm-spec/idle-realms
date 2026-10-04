# Idle Realm — prompt pro vývoj

> **Druh dokumentu:** ZADÁNÍ PRO POKRAČOVÁNÍ VÝVOJE (ne stav, ne kronika — je to
> pokyn, co udělat a v jakém pořadí; jeho stav je v [`ARCHITEKTURA_PREMISA.md`](./ARCHITEKTURA_PREMISA.md)).
> **Vznik:** 2026-09-15 · **Datum spotřeby:** 2026-09-15 (Fáze A), 2026-10-04 (Fáze B).
> **Čtení:** agent nebo člověk, kdo session nezná repo. Postupuj krok za krokem.
> **Stav po Fázi B:** A ✅, B ✅ (§4), další je C. Co přesně vzniklo a co zůstalo
> nedokončené, je v [`ARCHITEKTURA_PREMISA.md`](./ARCHITEKTURA_PREMISA.md) §2.3.
> **Předpoklad:** Vanilla JS (ES6+), žádný build, žádná závislost, žádný framework.
> Hra běží otevřením `index.html`.

---

## 0. NEJDŘÍV — nechyb si vlastní údaje

Tento repo má **dva dokumenty plánu, které si navzájem odporují**, protože popisují
starý stav. Tohle není výčet ke čtení; to je **nejdůležitější věc v celém promptu**:

> **`docs/TECHNICKY_DOKUMENT.md` a `docs/PLAN_VYVOJE.md` zastaraly. Neplánuj podle nich.**

| Co ty dokumenty tvrdí | Co je pravda (ověřeno v kódu, záříjí 2026) |
|---|---|
| `tickAmbitions` neexistuje → ambice se nevyhodnocují | **Existuje** — `js/data/ambitions.js:123` |
| Panel nelze sbalit, mapa má malé okno, chybí desktop rozvržení | **Hotové** — `css/style.css:168,174,178-198`; tlačítka `index.html:33-34` |
| Chybí git | **Existuje**, má historii |
| Chybí testy | **`node test/headless-smoke.js` → 77 kontrol, prochází** |
| Chybí Activity Dashboard | **Existuje** (`js/ui/panels.js:145`), ale jen jako barevné čipy |
| 48 skriptů | **59** |

Ověřený stav, na kterém stojí tenhle plán: **59 skriptů, 723 globálů `G.*` (0 rozporů),
88 UI akcí (0 mrtvých), 77 testů (0 selhání), git s historií, Node v22.**

**Než začneš cokoli měnit, ověř tenhle stav sám** — je to dvě minuty a ušetří ti to
práci na už hotových věcech:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\check-globals.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\check-actions.ps1
node test\headless-smoke.js
```

Když čísla nesedí, **aktualizuj `ARCHITEKTURA_PREMISA.md` §2**, ne tento prompt.

---

## 1. Premise, kterou tento plán chrání

> Hra se **hraje sama** (živý svět, postavy samy pracují, obchodují, stárnou, umírají,
> svět běží i offline), ale hráč do ní **zasahuje jako vůdce** — určuje směr a priority.
> Ne mikromanagement akce, ale řízení na úrovni.

Z toho plyne jediné pravidlo, které rozhoduje každou spornou otázku:

> **Hráč zadává ZÁMĚR. Autonomie rozhoduje, JAK ho splnit.**
> Hráč nikdy nepřiděluje práci ručně, protože to by nebyla autonomie, ale jen
> hra s automatickou animací.

A jedno upozornění, které platí pro každou novou funkci:

> **Každá automatika musí být vidět.** Co hra udělá sama, musí se objevit v přehledu
> nebo v deníku postavy. Odměna, kterou hráč nevidí, není odměna — je šum.

---

## 2. Skutečná mezera (to je, proč tenhle plán existuje)

Hráč dnes může dvěma způsoby:

- **`directives`** — „přednostně železo“, „vyhýbat se nebezpečí“
- **`orders`** — jednorázový příkaz „postav sem tolik a tolik“

Obě jsou **sada podmínek vyhodnocených v daném okamžiku**. Nenese si stav, nemá plán,
nemá pokrok. A hráč proto **nemůže říct „připrav družinu na lov draků“** a nechat hru,
ať si spočítá, že k tomu patří zbroj, zbraně, jídlo na deset dní, lektvary a tři
postavy s bojovnictvím 6+ — protože to nikdo neumí. Musí to udělat klikací po klikaci.

**Úkol tohoto plánu:** tuto propast zacpatit **jedním mechanismem**, ne třemi vlastnostmi.

---

## 3. Jádro: Záměr → Plán → Mezera → Rozdělovac

Toto je celý návrh v pěti větách. Detaily a důvody jsou v
[`ARCHITEKTURA_PREMISA.md`](./ARCHITEKTURA_PREMISA.md) §3.

| Krok | Co to je | Kde žije |
|---|---|---|
| **Záměr** (`goal`) | Co hráč chce. `kind`: `stock` / `train` / `campaign` / `explore` / `prestige`. Má `priority` a `params`. | `js/systems/goals.js` (nový) |
| **Plán** | Plánovač (`goal`, stav světa) → **kroky** (`Step`). Čistá funkce, bez náhody. | `goals.js` |
| **Mezera** | Co chybí do kroku, v jednotkách `unitWorkRate`. Nahrazuje dnešní `×8` a `materialNeed()`. | `goals.js` |
| **Rozdělovac** | Pro každou schopnou jednotku: kandidáti = nesplněné kroky × mezera + běžná práce (dnešní logika, nízká priorita). Vážená ruleta jako dnes. | `autonomy.js` |
| **Následek** | Přehled záměrů (kroky, mezera, kdo pracuje, ETA) + **rozpad vah** („mezera 37/120 ×4.2“) u postavy + zápis do deníku. | `panels.js`, `journal.js` |

### Tři pravidla, která to nesmí rozbít

1. **`directives` a `orders` nesmí zůstat vedle záměrů — musejí se stát zkratkou nad nimi.**
   `setDirective('focusMaterial', …)` dál funguje, ale *pod* ním vznikne `stock` záměr.
   Tři vstupní cesty do stejného rozhodnutí = tři místa, kde se to bude chovat jinak.
2. **Bez záměrů musí být chování hry DNEŠNÍ.** Refaktor nesmí nic zmenšit.
3. **Offline běh musí dělat stejnou hru.** `simulateOffline()` volá `G.tick()` znovu,
   takže dnes je parita zadarmo; nesmí se to rozbít přidáním „inteligentních“ rozhodnutí.

---

## 4. Fáze — v tomto pořadí, každá má zelenou bránu nebo není hotová

> Granule = jeden commit. Cílem granule je ≤ 60 řádků; větší celek smí silnější model
> a musí to být deklarované.

### FÁZE A — sjednotit vstupy *(nejmenší změna, největší zjednodušení)*
| # | Úkol | Soubor | Hotovo, když |
|---|---|---|---|
| A1 | `goals`: `newGoal`, `cancelGoal`, `listGoals`, `getGoalBoard` | `js/systems/goals.js` (nový) | `check-globals` 0 problémů; soubor přidán do `index.html` |
| A2 | `directives` jako zkratka nad `stock` záměrem | `js/systems/autonomy.js` | `setDirective('focusMaterial','iron_ore')` vytvoří záměr; staré UI funguje dál |
| A3 | Opravit duplicitní default směrnic (`main.js:149` nemá `focusTarget`) | `js/main.js` | save bez `focusTarget` se načte; obě místa dávají stejný default |

**Brána A:** `check-globals.ps1` 0 problémů · `node test/headless-smoke.js` OK ·
+ 3 testy v `headless-smoke` (záměr vzniká, zruší se, přežije save/load).

### FÁZE B — plánovač a mezera *(jádro)* — ✅ **HOTOVO 2026-10-04**
| # | Úkol | Hotovo, když | Naměřeno |
|---|---|---|---|
| B1 | `planner`: záměr → kroky, čistá funkce | `campaign` lov draků má ≥ 5 kroků; `stock` má 1 | `dragon_hunt` + družina 3 = **7 kroků** |
| B2 | `gap`: krok → mezera | mezera klesá, když jednotka pracuje na správném uzlu | `stepGap = (potřeba − má) × práce na kus` |
| B3 | **Brána dosažitelnosti (K1)**: každý krok splnitelné existující aktivitou | test je zelený **na záměrech, které umí vzniknout** — ne na prázdném seznamu | `test/coherence.js`: 82 záměrů z herních dat / 274 kroků |
| B4 | Rozdělovac přes `gap` | **bez záměrů je výběr práce stejný jako dnes** (regresní test) | `test/scheduler-regress.js` proti zaznamenané referenci; scénář se záměrem hráče se oproti tomu **liší** |
| B5 | Plánovač běží v offline simulaci | 1 h offline == 1 h živě do 1 % hodnot | krok simulace sjednocen s živým během; shoda pod 1e-6 %. Zbylý rozdíl 4,3 % práce je **záměrný** (při offline se nespouštějí náhodné události) |

**Brána B:** vše výše + `check-actions.ps1` 0 mrtvých. ✅

> ⚠ **B4 je nejdůležitější test v tomto plánu.** Dokazuje, že refaktor nerozbil hru.
> Napiš ho *před* B4, ať umí selhat — a pak ho zkontroluj vrácenou vadou (viz §6).
> **Stalo se:** první verze té brány neprošla vlastní kontrolou reprodukovatelnosti
> (scénář běžel dvakrát a dával jiný otisk) a první verze K3 tikala po 0,1 s přímo,
> takže mutace kroku v `simulateOffline` jí prošla. Obě se opravily *tím*, že brána
> začala volat to, co má hlídat. Podrobnosti v `ARCHITEKTURA_PREMISA.md` §2.3.

### FÁZE C — vedení viditelné hráči
| # | Úkol | Hotovo, když |
|---|---|---|
| C1 | Panel záměrů: kroky, mezera, kdo pracuje, ETA | prázdný stav ukazuje `emptyState` s odkazem kam jít |
| C2 | Rozpad vah u postavy („proč ta právě tohle dělá“) | přiřazení má uložené váhy; součet odpovídá `×` v UI |
| C3 | `takeControl` / `releaseControl` jako API (dnes `ui.js:879` mutuje stav přímo) | vzití kontroly vyřadí jednotku z rozdělování; **rozestavěná práce se nepřepne** |
| C4 | Přepsat 3 přímé UI mutace na `G.*` API | `ui.js` nemutuje `state` mimo API |
| C5 | Každý **splněný** krok → zápis do deníku postavy | deník obsahuje událost kroku; hráč to vidí bez otevření panelu |

### FÁZE D — autonomní dobudování
| # | Úkol | Hotovo, když |
|---|---|---|
| D1 | Kandidáti z `kind: explore` (návštěva sídel) | prozkoumaná sídla záměr plní |
| D2 | `train` záměr: učení skillu přes mentora | skill roste, mezera klesá |
| D3 | `byTime` u `campaign` → po termínu `failed`, ne visí | záměr skončí + zápis do deníku |
| D4 | **Prediktivní odpočinek** (dnes `REST_THRESHOLD = 20`, reaguje pozdě) | jednotka odpočine dřív, než vyčerpá |
| D5 | Konkurence záměrů: dva `stock` o tutéž kapacitu | vyšší `priority` vyhraje **a log to vysvětlí** |

### FÁZE E — hloubka
Politika ↔ ekonomika ↔ roční období propojit se záměry (dnes `story.flags` funguje, ale
izolovaně) · prestiž jako generátor záměrů · 5 cest k témuž zdroji, ne 35. nepřítel.

### FÁZE F — obsah *(až když ukáže Fáze B+E, co chybí)*
Nový nepřítel jen tehdy, když je boj vpremiu příliš levný. Nový recept jen tehdy,
když chybí cesta k zdroji. **Pořadí podle tohoto pravidla, ne podle „co by se taky hodilo“.**

---

## 5. Co se dělat nesmí

| Nepřítel | Proč |
|---|---|
| Sloty plánování pro postavu | Už odloženo v `PLAN_HRATELNOST.md` §4, správně. Obnovit jen s důvodem. |
| Další obsah před Fází B | Chybí hloubka, ne šířka. |
| Přepis na ESM / TypeScript / Vite | Testy procházejí, build není potřeba. Až bude bolet — ve větvi. |
| Nové UI jako samostatný cíl | Panel i mapa jsou. Chybí hloubka dat, ne ploch. |
| Napětí mezi plánem a realitou řešené dalším tlačítkem | Napětí řeší kapacita a priorita **v datech**. |
| Náhodná rozhodnutí bez uloženého důvodu | Poruší vysvětlitelnost a udělá z hry černou skříňku. |

---

## 6. Brány — čtyři, a musí umět selhat

| Brána | Příkaz | Dnes |
|---|---|---|
| Globály | `scripts\check-globals.ps1` | 0/723 |
| UI akce | `scripts\check-actions.ps1` | 0 mrtvých z 88 |
| Chod hry | `node test\headless-smoke.js` | 88 kontrol OK |
| **Koherence** | `node test\coherence.js` | ✅ **K1 + K3** |
| **Neregrese rozdělovace** | `node test\scheduler-regress.js` | ✅ 8 kontrol |

> ⚠ **Toto jsou brány této architektury, ne celý seznam kontrol projektu.**
> Projekt má i brány grafiky (dlaždice, foundry, postavy, ilustrace) — úplný seznam
> je v [`HANDOFF.md`](./HANDOFF.md) §2 a je závazný i pro herní práci
> (grafika spadá, když rozbiješ `index.html` nebo `render/`).
> **Spouštěj všechny, ne jen čtyři výše.**

`coherence.js` dokazuje, co ostatní dokázat nemohou: **každý záměr je dosažitelný**
a **offline dělá stejnou hru**. `scheduler-regress.js` dokazuje, co dokazuje
žádná z nich: **že rozdělovac stále vybírá práci jako před refaktorem** — a zároveň
že nová věc (kroky záměrů) skutečně přesouvá práci, když záměr existuje.
`K2` (každý spotřebovávaný zdroj je řiditelný) v plánu ještě není.

### Jak psát bránu, která opravdu měří
Pět pravidel z tohoto stanice, která stojí za to, aby byla napsaná:

1. **Test bez `assert` a bez `sys.exit(1)` není test.** Naměřeno: test vypsal `CHYBA`
   a skončil `exit 0` — v CI zelený.
2. **Napiš test, vrať do kódu vadu, ať spadne.** Když s vrácenou vadou projde, je slepý.
   Zkontroluj, že se mutace vůbec provedla (text/hash) — tiše neprovedená mutace
   tvrdí totéž co mutace, která projde.
3. **Brána o přítomnosti ne měří chování.** `has_method('save')` projde i nad souborem,
   který při spuštění spadne. **Musí zavolat kód a ověřit výsledek**; soubor, který
   součástí být má, musí při nenačtení **selhat**.
4. **Brána musí volat to, co má hlídat — ne jeho náhradu.** Naměřeno v této fázi:
   brána K3 porovnávala `simulateOffline` s ručním tikáním po 0,1 s, takže mutace
   kroku *uvnitř* `simulateOffline` prošla (exit 0) — brála o něčem jiném.
5. **Prázdný vstup je zelený výsledek, ne výsledek.** Cyklus při prázdném seznamu
   ničeho neověří. Když se brána opírá o seznam z herních dat, tvrď i jeho
   délku — jinak mlčí ve chvíli, kdy data chybí.
6. **Když test čte číselnou hodnotu z jiného souboru, vypiš, odkud.** Různé čítače
   nesou stejné jméno; čtenář musí umět číslo vyvrátit.

---

## 7. Konvence, které nesmíš porušit

- **Jazyk:** identifikátory, klíče a literály rozhraní = **ASCII anglicky**.
  Dokumentace, komentáře, texty pro hráče = **česky**.
- **Globální namespace:** všechno visí na `window.Game` (`G`). Nový soubor = IIFE
  + zápis do `index.html` **na správné místo** (core → data → render → systems → ui → loop → main).
- **Každé nové pole v `state`** musí mít default **na obou místech**:
  `migrateSave()` v `js/core/state.js` **i** `ensureDefaults()` v `js/main.js`.
  (Dnes jsou dvě místa a nejsou stejná — to je A3.)
- **Nový tick** → registrovat v `G.tick()` (`js/core/loop.js`), idempotentní, s guardem `if (!G.fn) return`.
- **Jeden commit = jedna logická změna**, `feat:` / `fix:` / `chore:`.
- **UI nemění stav přímo**, jen přes `G.*` API. Dnes to neplatí všude
  (`ui.js:879`, `ui.js:886-888`) — zavádíme to pro nový kód a starý postupně uklízíme (C4).

---

## 8. Akceptační kritéria — konkrétně, jak hráč pozná, že to funguje

Když je hotová Fáze C–D, **toto musí platit všechno** (a tohle se dá ověřit ručně v prohlížeči
za 15 minut, což je ta pravá kontrola):

1. Hráč zadá **„připrav lov draků“** → hra vytvoří záměr s kroky (zbraň, zbroj, 3 bojovníci,
   jídlo, lektvary). Hráč **nemusí přemýšlet, co všechno to znamená**.
2. **Autonomie sama** postupně plní kroky — bez jediného kliknutí hráče.
3. Hráč otevře přehled a vidí: **který krok, kolik chybí, kdo na něm pracuje, ETA**.
4. Hráč u postavy vidí **proč ta právě tohle dělá** — rozpad vah, ne „magická konstanta“.
5. Hráč klikne **„vzít kontrolu“** → ta postava přestane dostávat automatickou práci;
   rozestavěná práce **nepřepadne** jiné.
6. Hráč má **dvě záměry o stejnou kapacitu** → vyhraje ten s vyšší prioritou
   a hra to **řekne nahlas v logu**.
7. Hráč zavře hranu a vrátí se za hodinu → svět je ve stavu, **jaký by byl po hodině živě**.
8. Staré UI **funguje dál**: „Směrnice → železo“ pořád funguje, fronta příkazů pořád funguje.

---

## 9. Když dostaneš jinou session

Nedávej jí jen odkaz na tenhle soubor a neříkej jí „přečti si to“. Otevři **`docs/`**
a předáš jí **tři věci**:

1. **Jeden soubor s konkrétní granule** (např. „Fáze B4: rozdělovac přes `gap`“),
   ne „pokračuj ve fázi B“.
2. **Aktuální výstup tří bran** (příkazy výše) — aby věděla, na jakém stavu se jede.
3. **Jednu věc, kterou si smí zvolit** (např. pořadí dvou aktivit), aby nemusela
   přemýšlet nad rámec zadání.

A **nech jí tenhle soubor i `ARCHITEKTURA_PREMISA.md` jako pozadí**, ne jako zadání —
za měsíc bude mít vlastní pochybnosti a je správné, aby je měla.

---

*Obsah vychází z naměřeného stavu repa (59 skriptů, 723 globálů, 77 testů, 88 UI akcí —
vše ověřeno 2026-09-15), z kódu `js/systems/autonomy.js`, `work.js`, `goals.js` (plánovaný),
`js/core/state.js`, `js/core/loop.js`, `js/ui/panels.js`, `js/ui/ui.js`, `index.html`,
`css/style.css`, a z dokumentů `DESIGN_DOKUMENT.md`, `PLAN_VYVOJE.md`,
`TECHNICKY_DOKUMENT.md`, `PLAN_HRATELNOST.md`, `UKOLY_A_VYROBA.md`,
`PRIBEHOVE_POPUPY.md`. Tam, kde dokumenty a kód si odporovaly, rozhodl kód.*
