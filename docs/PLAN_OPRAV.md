# Plán oprav — Idle Realm

> **Datum:** 2026-09-18
> **Navazuje na:** `docs/AUDIT_VERDIKTY.md` (verdikty 184 nálezů proti `HEAD = 26c691a`)
> **Stav:** návrh — **nic z tohoto dokumentu není implementováno**
> **Pravidlo:** každý úkol se dělá až po ověření proti `HEAD`; nález z auditu sám o sobě není zadání.

---

## 0. Jak je plán postavený

Řazení není podle priority v auditech, ale podle **závislostí a rizika**:

1. **F0** — rozhodnout sporné věci (bez kódu). Bez toho se F2 nedá udělat správně.
2. **F1** — integrita dat a savu. Neviditelné, ale odstraňuje celou třídu pádů a bílých obrazovek.
3. **F2** — čas, stárnutí, offline. Největší reálná vada hry (`N1`–`N3`).
4. **F3** — vrstva vysvětlení. Jedna architektura vyřeší ~60 nálezů napříč všemi audity.
5. **F4** — ekonomika obsahu a boj (materiály, expedice, bossové, propojení).
6. **F5** — meta-progrese a endgame.

**Legenda velikosti:** S = hodiny, M = 1–2 dny, L = více dní práce.
**Legenda rizika:** nízké = izolovaná změna s testem; střední = dotýká se balancu nebo savů; vysoké = mění zažitek ze hry.

**Povinná brána po každé fázi** (existující nástroje):

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts/check-globals.ps1   # "0 problems"
powershell.exe -ExecutionPolicy Bypass -File scripts/check-actions.ps1   # 0 mrtvých handlerů
node test/headless-smoke.js                                              # "VYSLEDEK: OK" (dnes 77/77)
node test/tile-window.js ; node test/tile-sets.js ; node test/foundry.js
node test/foundry-game.js ; node test/figures.js ; node test/props.js ; node test/units-ai.js
```

---

## F0 — Triage a dvě rozhodnutí (S, riziko nulové)

**Cíl:** aby se neopravovalo to, co je zastaralé, a aby F2 měla jasné zadání.

| # | Úkol | Výstup |
|---|---|---|
| F0.1 | Převzít `docs/AUDIT_VERDIKTY.md` jako závazný seznam (9 nálezů NEPLATÍ, 46 ČÁSTEČNĚ) | hotový dokument |
| F0.2 | Zavést pravidlo „tvrzení = `soubor:řádek` + commit"; audit platí jen proti uvedenému commitu | odstavec v `docs/HANDOFF.md` |
| F0.3 | **Rozhodnutí A — co je „rok"?** Dnes existují dva: kalendářní (8 400 s) a věkový (`AGE_YEAR` 300 s). Varianty: **(a)** jeden rok = kalendářní, věk se přepočítá; **(b)** kalendář se zkrátí a `AGE_YEAR` se přeškáluje; **(c)** věk se od kalendáře úplně oddělí (vlastní čítač). | zápis rozhodnutí + dopad na `T1/T14` |
| F0.4 | **Rozhodnutí B — co má dělat offline?** Dnes: stárnutí ano, vztahy/reakce/události/příběh ne. Varianty: **(a)** věrná simulace (zapnout vše a škálovat `dt`); **(b)** vědomě zjednodušená, ale **bez stárnutí a smrti**; **(c)** offline jen produkce + explicitní sdělení hráči. | zápis rozhodnutí + dopad na `N2/N3` |
| F0.5 | Dohodnout, zda se `T1` (zkrácení roku) vůbec dělá — `dayLength` je jednotka i pro expedice a doprovody | rozhodnutí |

**Brána:** dokumenty v `docs/`, žádná změna kódu. `check-globals` + smoke beze změny stavu.

---

## F1 — Integrita dat a savu (M, riziko nízké)

**Cíl:** „chybějící nebo neplatná data nesmí shodit hru" a „poškozený save nesmí zničit progres".

### F1.1 Validace dat při startu

- **Co:** `G.validateData()` volaná z `boot()`; kontrola `MATERIALS` (name/icon/price), `SKILLS`, `RECIPES` (inputs/output), `BUILDINGS` (cost/effect), `ENEMIES` (hp/atk), `GEMS`, `UNLOCKS`, `ACTIVITIES`.
- **Chování při chybě:** zalogovat + `console.warn` + doplnit default; **nikdy neshodit boot**.
- **Řeší:** `D2`, `D14`, `D1` (částečně), `D20` (test).
- **Soubory:** nový `js/core/validate.js` + `<script>` v `index.html` (pozor na past č. 17 v HANDOFFu — pokud `index.html` drží někdo jiný, dát kód do `js/core/state.js`).
- **Akceptační test:** `test/data.js` — iteruje registry, ověří povinná pole; + test „neznámý materiál v `state.materials` neshodí `priceAt`".

### F1.2 Sjednotit registr materiálů (gemy)

- **Co:** rozhodnout, zda `gem_*` patří do `G.MATERIALS` (varianta A), nebo zda gemy nejsou materiály a `state.materials` je nesmí obsahovat (varianta B, migrace klíčů do `state.gems`).
- **Řeší:** `N6`, `D8`, část `D16`.
- **Soubory:** `js/data/world.js` (nebo `js/data/gems.js`) + `economy.js:188`, `gems.js:60`, `autonomy.js:447`, `expeditions.js:46`.
- **Akceptační test:** invariant „každý klíč `state.materials` má definici v `G.MATERIALS`" jako kontrola v `test/data.js`.

### F1.3 Helper nad materiály + náhrada nechráněných přístupů

- **Co:** `G.matName(id)`, `G.matDef(id)`, `G.matIcon(id)` s fallbackem (`?`), a nahradit **39** nechráněných `G.MATERIALS[...]`.
- **Řeší:** `D16`.
- **Soubory:** `js/core/state.js` + `panels.js:97,990`, `economy.js:61,134,154`, `merchant.js:127`, `construction.js:41`, `work.js:197`, `psychology.js:300,307`, `combat.js:480`, `events.js:96`.
- **Akceptační test:** rozšířit `scripts/check-globals.ps1` (nebo nový skript) o hledání `G.MATERIALS[` bez guardu — 0 nálezů.

### F1.4 Save: robustnost načtení

- **Co:** `load()` — `try/catch` **per klíč** (poškozený aktuální klíč nesmí zablokovat starší); `migrateSave` — zrušit tichý early-return ve prospěch validace i pro aktuální verzi; odmítnout/označit neznámou verzi místo přepisu; `importSave` — strukturální validace za base64 (typy `units`/`resources`/`tasks`), size cap, whitelist verze.
- **Řeší:** `N7`, `N8`, `N24`, `SL2`, `SL4`, `SL5`, `SL15`.
- **Soubory:** `js/core/state.js:65-75,76-165,182-193`.
- **Akceptační testy (5 nových):** corrupt aktuální klíč + validní starší → načte starší; `v7` save bez `pos` → hra naběhne (dnes pád `world.js:441`); `importSave` s `units:"nope"` → `ok:false`; neznámá verze → odmítnuto s hláškou; neznámá kvalita v `materials` → nespotřebovatelná, ale bez pádu.

### F1.5 Jedna reparační vrstva

- **Co:** sloučit `newState` / `migrateSave` / `ensureDefaults`+`repairUnits` do jednoho idempotentního `G.ensureState()` (per-entita: `ensureUnits`, `ensureEconomy`, `ensureQuests` už existují jako vzor).
- **Řeší:** `N9` (`maxStamina`), `N10` (divergence), `D9`, `SL3`, `SL11`, `SL12`, `SL14` (trojí duplikace resetu), `N11`.
- **Soubory:** `js/core/state.js`, `js/main.js:108-202`, `js/ui/title_screen.js:18`, `js/main.js:7-14`.
- **Akceptační test:** test „starý sav se doopraví a `ensureState()` je idempotentní" (2× volání = stejný stav).

**Brána F1:** všech 5 nových testů + stávajících 77 + `check-globals` + `check-actions`.

---

## F2 — Čas, stárnutí, offline (M, riziko střední)

**Předpoklad:** dokončené F0.3 a F0.4.

| # | Úkol | Řeší | Soubory | Akceptační test |
|---|---|---|---|---|
| F2.1 | Zavést **jeden** zdroj pravdy o roku (podle F0.3) a odstranit 28× rozpor mezi `AGE_YEAR` a kalendářem | `N1` | `js/data/aging.js`, `js/data/time.js`, `js/systems/aging.js`, `js/ui/panels.js:496` | test: „za 1 kalendářní rok zestárne postava o 1 rok" |
| F2.2 | **Nikdy nestárnout během offline** (nebo podle F0.4 věrně simulovat) | `N2` | `js/systems/aging.js:39-56`, `js/core/loop.js:54-67` | test: „4 h offline nezabije generaci stářím" |
| F2.3 | Sjednotit offline a online krok (`dt`) nebo explicitně škálovat pravděpodobnosti | `N3` | `js/core/loop.js` | test: „offline 1 h ≈ online 1 h" (tolerance, deterministický seed) |
| F2.4 | Dořešit stáří: strop `AGE_MAX`, `ageProtected` (nastavit, nebo odstranit), křivka `naturalDeathChance` | `N13`, `N14` (nepřímo) | `js/data/aging.js:32-36`, `js/systems/aging.js:44-49` | test: „věk nepřekročí `AGE_MAX`" |
| F2.5 | Časová hygiena: `% G.TIME.seasons.length`, logovat přechod dne/fáze, `day` popsat jako „den v sezóně" | `N19`, `T6`, `T8` | `js/systems/time.js:15-19`, `js/ui/ui.js:369` | test: „přidání 5. sezóny nerozbije cyklus" |
| F2.6 | (`T1`/`T14` teprve po F0.5) Pokud se rok zkracuje: přeškálovat `AGE_YEAR` **a** zkontrolovat, že se nezkrátily expedice a doprovody | `T1`, `T14` | `js/data/time.js`, `js/data/aging.js`, `js/systems/{expeditions,events}.js` | test: „délka expedice v reálném čase se nezměnila" |

---

## F3 — Vrstva vysvětlení (L, riziko střední)

**Cíl:** jedna architektura místo ~60 dílčích tooltipů.

| # | Úkol | Řeší | Soubory |
|---|---|---|---|
| F3.1 | `G.modTrace(unit, kind)` → `[{ zdroj, hodnota, dopad }]` pro `work`/`xp`/`quality`/`speed`; postavit na něm `unitWorkRate` a `addSkillXp` (jen refaktor, žádná změna čísel) | `N4`, `S4`, `S20`, `PS5`, `I4`, `I7` | `js/systems/units.js:88-168`, nový `js/systems/mods.js` |
| F3.2 | Zobrazit rozpad v kartě postavy a u ETA úkolu („+20 % čas = rychlejší" — opravit i zavádějící text v `panels.js:339-340`) | `S4`, `T8`(text) | `js/ui/panels.js` |
| F3.3 | Rozpad kvality u receptu (odhad pravděpodobností podle aktuálních bonusů) | `I4`, `I19` | `js/ui/panels.js:894-902`, `js/systems/work.js:208-234` |
| F3.4 | Autonomní report („proč šel Aldo kácet") + stav výrobních objednávek (🟢/🟡/🔴) | `S20`, `I7`, `N17` | `js/systems/autonomy.js`, `js/ui/panels.js` |
| F3.5 | Zapojit existující `G.toast` na smrt, bosse, prestiž, dezerci (mechanismus je hotový, volá se 2×) | `U10`, `B13`, `B14`, `PS8` | `js/systems/{combat,misc,psychology}.js` |
| F3.6 | Progres u ambicí, matice vztahů, varování před dezerteří + možnost intervence | `PS9`, `PS3`, `PS8` | `js/ui/panels.js`, `js/systems/psychology.js` |
| F3.7 | Sezónní tint mapy + noční UI (nebo jen výraznější HUD indikátor) | `T7`, `T8` | `js/render/world.js`, `css/style.css` |
| F3.8 | `Esc` pro všechny modaly, stránkování logu, undo poslední akce, globální search | `U6`, `U8`, `U9`, `U15` | `js/ui/ui.js`, `js/ui/panels.js` |
| F3.9 | UI hygieny: cache `renderSubtabs`, díra v `autoRefresh` (`showEventModal` bez `modal`), clear debug intervalu | `N21`, `U1`, `U2`, `U3` | `js/ui/ui.js:408,1228`, `js/ui/debug.js:114` |

**Brána F3:** čísla ve hře se **nesmí změnit** — `modTrace` je popis, ne úprava. Ověřit smoke testem + srovnáním pár hodnot před/po.

---

## F4 — Ekonomika obsahu a boj (L, riziko střední)

| # | Úkol | Řeší |
|---|---|---|
| F4.1 | Recepty pro nevyužité materiály (kůže → kožená zbroj, ryba → jídlo, kámen → zdivo, trofeje, `bandit_seal`, `dragon_scale` → legendární) | `I1`, `I10`, `B15` |
| F4.2 | Přidat chybějící materiály do `G.TRADED` (dnes 6 položek nelze ani prodat) | `I1`, `B15` |
| F4.3 | Masterwork jako použitelný item (staty/prodej/bonus) | `I5` |
| F4.4 | XP z výroby **jen crafterovi** (+ opravit podmínku `reqLevel - 1`) | `I6`, `N22` |
| F4.5 | Kvalita: vstupy ovlivňují výstup (`matAvgQualityMult`), profese dává bonus, base `1.1 → 1.5` | `I12`, `I13`, `I19` |
| F4.6 | Expedice: stupně úspěchu, trvalé efekty (region/reputace/recept), role, průběžné jídlo, zrušení expedice, víc eventů na cestě, oprava `natural_spring` | `X2`, `X3`, `X4`, `X5`, `X6`, `X16`, `X18`, `N16` |
| F4.7 | Délka expedic a party limity (závisí na F0.5) | `X1`, `X12`, `X13` |
| F4.8 | Boj: boss fáze + interrupt, dropy podle obtížnosti, reputace z boje, `lootValue` v UI, propojení s recepty | `B8`, `B9`, `B10`, `B15` |
| F4.9 | Sjednotit vzorce poškození a aplikovat taktiku i na schopnosti | `N5`, `B5`, `B22`, `B23` |
| F4.10 | Drobnosti: návrat z expedice do původního sídla, úklid `onExpedition` při smrti, `maxCraftable` min 0 | `X8`, `N15`, `N23` |

---

## F5 — Meta-progrese a endgame (M, riziko střední)

| # | Úkol | Řeší |
|---|---|---|
| F5.1 | Prestiž zachová achievementy, story flags, dynastii, `chapterHistory`, meta-statistiky **a uživatelská nastavení** (`prestige.js:80`) | `M2`, `M3`, `M4`, `M16`, `M17`, `N20` |
| F5.2 | Škálovat `PRESTIGE_REQUIREMENTS` podle levelu | `M1` |
| F5.3 | Vyřešit 7 unlocků vs. vítězství na 5; `newChapter()` nesmí obejít výběr unlocku | `M5`, `N20` |
| F5.4 | Souhrn „co si odnáším / co ztrácím" před potvrzením prestiže | `M11` |
| F5.5 | Variabilita nové mapy (počet sídel, specializace, regiony) + salt v `nextWorldSeed` | `M6`, `M7` |
| F5.6 | Semantika vítězství/prohry (post-game mód nebo jasný konec; prohra zachová meta) | `M9`, `M12`, `M14`, `M18`, `M19` |
| F5.7 | Zobrazit kapitoly z `chapterHistory` (dnes mrtvý zápis) | `M8` |

---

## Rychlé výhry (kdykoli, S, riziko nízké)

Vysoký poměr efektu k práci, nezávislé na fázích výše:

- `Esc` pro všechny modaly (`U6`).
- Sloučení toastů + zapojení notifikací (`U7`, `U10`).
- Oprava eventu `natural_spring`, aby opravdu léčil (`N16`).
- Úklid `onExpedition` při smrti a vzkříšení (`N15`).
- Sjednocení zobrazené a účtované ceny jídla u expedic (`N16`).
- Oprava textu „2–9 dní" → 2–10 (`N16`).
- Smazání mrtvých deklarací nebo jejich zapojení (`N12`) — urychlí orientaci v kódu.
- `maxCraftable` min 0 (`N23`).
- `% G.TIME.seasons.length` místo `% 4` (`N19`).
- Zavést `day` v UI jako „den v sezóně" (`N19`).

---

## Co plán vědomě nechává být

- **Nálezy NEPLATÍ** (`B4`, `B17`, `S2`, `S15`, `X7`, `SL1`, `SL10`, `SL13`, `U7`) — už opravené nebo chybné; jen přehodnotit, až se kód změní.
- **Přechod na ESM/TypeScript/build** — `docs/PLAN_VYVOJE.md` to už odkládá jako volitelné; tento plán s tím nepočítá.
- **JSON data loader** (`D17`) — má smysl až po `F1.1`, jinak by validace neměla co validovat.
- **Vizuální/generovaná grafika** — má vlastní handoff (`docs/HANDOFF_GRAFIKA.md`), sem nepatří.

---

## Kontrolní seznam před každým commitem

1. Ověřeno proti `HEAD`, že nález stále platí (`git show HEAD:<soubor>` u sporných).
2. Změna má test (nebo je vysvětleno, proč test nejde — pozor na stuby timerů v headless harnessu).
3. Prošlo: `check-globals` = 0, `check-actions` = 0, `headless-smoke` = OK, ostatní `node test/*.js`.
4. Čísla ve hře se nezměnila, pokud to nebyl záměr (u F3 povinné).
5. `docs/AUDIT_VERDIKTY.md` — přehodnotit dotčené řádky.
6. Commit Conventional Commits, stage **jen svoje soubory** (ve workspace může běžet paralelní práce).
