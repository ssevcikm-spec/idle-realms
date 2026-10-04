# Idle Realm — architektura z premisy

> **Druh dokumentu:** PLÁN (přepisuje se, když se jeho předpoklady změní).
> **Vznik:** 2026-09-15 · **Datum spotřeby:** 2026-09-15 — z tohoto dokumentu byla
> převzata **celá roadmapa fází A–F** a **investice do `test/coherence.js`**;
> nic jiného zatím nebylo provedeno.
> **Účel:** jak má vypadat architektura, aby hra byla **koherentní** (všechno slouží
> jedné premise), **hluboká** (interakce systémů, ne množství obsahu), **zábavná**
> (pochopitelná příčinnost) a **autonomní** (hra si hraje sama).
>
> **⚠ Odkud brát současný stav — ne z tohoto dokumentu.** Část §2 je změřená
> 2026-09-15 a platí do té doby, kdy se něco změní; ověř ji spuštěním uvedených
> příkazů (§2). Oddíl §2.1 navíc záměrně **popisuje, kde dokumentace repa lže** —
> je to záznam z té doby, ne živý stav; při ověřování čti kód, ne tuto tabulku.
>
> **Doprovod:** [`PROMPT_IDLE_REALM.md`](./PROMPT_IDLE_REALM.md) — operační prompt
> pro vývoj (co udělat, v jakém pořadí, jak poznat, že to hotovo).

---

## 1. Premisa jako zákon, ne jako slogan

Premise projektu je v [`PLAN_VYVOJE.md:10-12`](./PLAN_VYVOJE.md):

> *„Hra, která se **hraje sama** (živý svět, autonomní postavy, běh na pozadí i offline),
> ale do které hráč **zasahuje jako vůdce** — určuje směr, priorities a dělá klíčová
> rozhodnutí. Ne mikromanagement každé akce, ale řízení na vyšší úrovni."*

Tady jsou dvě síly, které se táhnou proti sobě: **autonomie** (svět jedeme bez hráče)
a **vedení** (hráč musí mít pocit, že vede). Většina her tuhle kolizi řeší tím, že jednu
stranu zredukuje — buď je hra pasivní spectator, nebo se hráč vrátí do mikroklikání.

Tato architektura kolizi neřeší úbytkem, ale **přesouvá rozhodovací úroveň**:

| Hráč | Autonomie |
|---|---|
| říká **co** chce | rozhoduje **jak** to udělat |
| zadává **záměr**, ne úkol | rozkládá záměr na kroky |
| zasahuje **výjimečně** | vede **trvale** |

Protože hráč zadává záměr, nemůže být zablokován mikromanagementem, a protože autonomie
rozkládá záměr sama, hra pokračuje bez něj. Záměr je jediné, co musí být v save,
UI a offline simulaci — a proto je jediné, co musí být konzistentní.

**Toto je jediná architektonická věta, kterou je potřeba nezapomenout:**
*hráč nefiguruje jako postava ve světě, ale jako autorita nad prioritami.*

---

## 2. Ověřený stav (baseline, změřený, ne odhadnutý)

Změřeno 2026-09-15 spuštěním skutečných nástrojů v repu; **přeměřeno po Fázi A** (viz §2.2):

| Měření | Hodnota | Nástroj |
|---|---|---|
| Skriptů v `index.html` | **60** (a 60 JS souborů) | `scripts/check-globals.ps1` |
| Def. / použ. globálů `G.*` | **737 / 737, 0 problémů** | `scripts/check-globals.ps1` |
| `data-action` handlerů | **88 (+ 7 `data-change`), 0 mrtvých** | `scripts/check-actions.ps1` |
| Headless testů | **81 kontrol, 0 selhání** — `VÝSLEDEK: OK` | `node test/headless-smoke.js` |
| Verze Node | v22.23.2 | `node -v` |
| Git | existuje, historie (poslední: `feat: make_tile_set --backend local`) | `git log` |
| Herní smyčka | fixed timestep 100 ms, `MAX_CATCHUP` 24, offline 4 h | `js/core/loop.js` |
| Svět | 64×48 dlaždic, 10 sídel, ~220 uzlů | `js/data/world.js` |

**Význam:** projekt není v ohrožení. Hra běží, testy procházejí, globály jsou v souladu,
UI i obsah jsou hotové. Chybí **architektonická vrstva**, ne základy.

### 2.2 Spotřeba tohoto dokumentu — Fáze A (PROVEDENO)

> **Datum spotřeby:** 2026-09-15, **provedeno z tohoto dokumentu:** Fáze A (`PROMPT_IDLE_REALM.md` §4),
> granule A1–A3. **Výše uvedená čísla byla přeměřena po této změně** (60 / 737 / 88 / 81).

| # | Granule | Co vzniklo | Kde |
|---|---|---|---|
| A1 | `goals` registry | `newGoal`, `cancelGoal`, `listGoals`, `getGoalBoard`, `getGoal`, `goalProgress`, `goalLabel` | `js/systems/goals.js` (nový, `index.html:104`) |
| A2 | směrnice jako zkratka nad záměrem | `setDirective('focusMaterial', …)` založí `stock` záměr s `priority: 40`; změna `focusTarget` mění jeho `qty`; vypnutí materiálu záměr zruší. `pickActivity` **zůstává beze změny** → dnešní chování hry je zachováno | `js/systems/autonomy.js:131-139` |
| A3 | jeden default směrnic | `G.DEFAULT_DIRECTIVES` + `G.newDirectives()` — nahrazuje tři zkopírované defaulty, z nichž jeden (`main.js` `ensureDefaults`) `focusTarget` ztratil | `js/core/state.js:10-19` |

**Co Fáze A ještě NEudělala (aby nikdo nečetl „hotovo“ jako „hotová hra“):** plánovač (§3.3),
mezera (§3.4), rozdělovac (§3.5) a panel (§3.7) neexistují. `plan` je zatím vždy prázdný
pole a `getGoalBoard` z něj nepočítá — počítá si jen `progress` přímo z parametrů.
`orders[]` zatím pořád stojí vedle záměrů jako druhá vstupní cesta (§3.6, úkol až ve Fázi B).
Záměry tedy **neovlivňují práci postav**; mění se jen to, co hráč vidí a zruší-li.

**Nová pole v `state`:** `goals[]`, `goalSeq`. Default na všech třech místech
(`newState`, `migrateSave`, `ensureDefaults` v `main.js`).

**Brány po Fázi A** (přeměřeno, ne převzato):

| Brána | Výsledek |
|---|---|
| `scripts/check-globals.ps1` | ✅ 0 problémů, 60 skriptů, 737/737 globálů |
| `scripts/check-actions.ps1` | ✅ 0 mrtvých z 88 |
| `node test/headless-smoke.js` | ✅ **81 kontrol, 0 selhání** (přidány 4 kontroly na záměry) |
| 9 grafických bran z `HANDOFF.md` §2 | ✅ všechny zelené (`index.html` byl dotčen) |

> ⚠ **Mutační kontrola těchto 4 kontrol proběhla a prokázala, že měří.**
> Vrátil jsem do kódu 3 vady (odpojená směrnice, `cancelGoal` bez změny stavu,
> nabití bez doplnění záměru) — první dvě shodily testy, **třetí prošel** a odhalil
> slepou kontrolu (test si záměr vytvořil sám, takže backfill nikdy nešel přes prázdný seznam).
> Po doplnění `zamer: stary sav se smernici bez zameru si zamer nedoplni` spadla i třetí.

### 2.3 Spotřeba tohoto dokumentu — Fáze B (PROVEDENO)

> **Datum spotřeby:** 2026-10-04, **provedeno z tohoto dokumentu:** Fáze B
> (`PROMPT_IDLE_REALM.md` §4), granule B1–B5. **Čísla níže jsou přeměřená po
> této změně**, převzata nejsou.

| # | Granule | Co vzniklo | Kde |
|---|---|---|---|
| B1 | `planner` | `planGoal(goal)` — čistá funkce, `{záměr, stav} → kroky`. Každý krok si nese `satisfiedBy` | `js/systems/goals.js` |
| B2 | `gap` | `measureStep` (fakt) oddělený od plánu (odhad); `materialWork`, `stepGap`, `stepGapFraction`, `stepActivities`, `materialSource` | `js/systems/goals.js` |
| B3 | brána K1 | `test/coherence.js` — záměry se berou z **herních dat**, ne ze seznamu v testu | `test/coherence.js` |
| B4 | `scheduler` přes mezeru | `stepBoost()` — `w = 1 + 6 × (mezera/ potřeba) × naléhavost`; bez kroků je to ×1 | `js/systems/autonomy.js` |
| B5 | parita offline | krok `simulateOffline` sjednocen s živým během; K3 v bráně | `js/core/loop.js` |

**Co Fáze B NEudělala (aby nikdo nečetl „hotovo" jako „hotová hra"):** panel
záměrů, rozpadové váhy u postavy, `takeControl`/`releaseControl` a deník kroků
stále nejsou — to je Fáze C. `getGoalBoard` stále počítá `progress` přímo
z parametrů, ne z kroků. `orders[]` pořád stojí vedle záměrů jako druhá
vstupní cesta (§3.6, úkol ve Fázi C). Autonomie zatím umí zvýhodnit práci na
kus, který záměr žádá; **neumí sama záměr splnit** — výbava, odjezd na expedici
a návštěva sídla zůstávají na hráči.

**Tři vady, které našly právě brány B (a ne žádný test na novou funkci):**

| # | Vada | Jak se projevila |
|---|---|---|
| 1 | `startWorldEvent(...)` zavoláno **bez jmenička** — v repu je jen `G.startWorldEvent` | Když spadl náhodný světový děj, hra shodila `ReferenceError`. Prošlo to celým smoke testem, protože k události nedojde za 200 ticků; odhalil to až hodinový běh |
| 2 | `tickMood` čítal `g.supplies.food <= 0`, ale **nikdo ty zásoby nedoplňuje** (zakládají se na 0, jiný zápis ve hře neexistuje) | Každá postava ve skupině měla trvalou pokutu −0,4 nálady/s → propadla pod 20 → `unitRefusesWork` ji vyřadil z práce. Rozdíl práce živý/offline spadl z 57 % na ~5 % |
| 3 | `simulateOffline` tikala po **1 s**, živý běh po 0,1 s | Systémy s vlastním intervalem přehrávají v jednom kroku jiné podmínky než ve dvou; rozdíl se násobil prahy (nálada < 20, výdrž < 25). Naměřeno: −74 % práce po 15 minutách |

**A jedna vada v samotné bráně**, která je důležitější než opravený kód: první
verze K3 tikala po 0,1 s přímo, takže mutace kroku uvnitř `simulateOffline` jí
prošla (exit 0). Brála o věci, které necílila. Teď jde přes skutečné API —
mutace je chycená (práce 9,45 %, mezera 13,4 %).

**ZNÁMÝ ROZDÍL, který zbývá a je záměrný:** při `G.simulating` se nespouštějí
náhodné události (světové děje, postavy, psychika). Za hodinu je proto živý běh
a offline běh např. o 4,3 % práce a 4,7 % materiálu jiný. Není to chyba
plánovače, ale nesmí to zůstat nezapsané, protože to jinak vypadá jako stejná
hra. Jestli se mají události přehrát i za nepřítomnosti, je to rozhodnutí
Fáze C/E.

**Brány po Fázi B** (přeměřeno):

| Brána | Výsledek |
|---|---|
| `scripts/check-globals.ps1` | ✅ 0 problémů, 60 skriptů, 754/754 globálů |
| `scripts/check-actions.ps1` | ✅ 0 mrtvých z 88 |
| `node test/headless-smoke.js` | ✅ **88 kontrol** (Fáze B přidala 7) |
| `node test/coherence.js` | ✅ K1: 82 záměrů / 274 kroků · K3: 5 kontrol |
| `node test/scheduler-regress.js` | ✅ 8 kontrol (scénáře A/B/C proti zaznamenané referenci) |
| 10 grafických bran z `HANDOFF.md` §2 | ✅ všechny zelené |

> **Oprava v tomto dokumentu:** §3.3 uvádí příklad `expeditionId='drak_hunt'`.
> Taková expedice v repu **neexistuje** — správně je `dragon_hunt`
> (`js/data/expeditions.js:13`). Plánovač na neznámé id vrací prázdný plán
> a brána K1 to odmítne, ale příklad v dokumentu byl chybný už při psaní.

### 2.1 Kde se dokumenty mýlí (a to je důležitější než seznam hotového)

`docs/TECHNICKY_DOKUMENT.md` a `docs/PLAN_VYVOJE.md` jsou **zastaralé**. Konkrétně:

| Tvrzení v dokumentu | Pravda (ověřeno v kódu) |
|---|---|
| `tickAmbitions` neexistuje → ambice se nevyhodnocují (TECH §6.1) | **Existuje** — `js/data/ambitions.js:123`, vyvolává se z `autonomy.js:26` |
| Panel nelze sbalit, mapa má malé okno, chybí desktop layout (PLAN Priorita 1) | **Hotové** — `#app.panel-collapsed` (`css/style.css:168`), `#app.map-fullscreen` (:174), grid s `grid-template-areas` nad 900 px (:178-198); tlačítka v `index.html:33-34` |
| 48 skriptů, ~8700 řádků (TECH §1, §3.3) | **59 skriptů**; přibyly `render/tiles_ai.js`, `render/units_ai.js`, `systems/construction.js`, `systems/tutorial.js`, `systems/endgame.js`, `ui/title_screen.js`, `data/difficulty.js`, `data/legendaries.js`, `data/sets.js`, `data/gems.js`, `data/synergies.js` |
| Chybí git (TECH §6.2) | **Git existuje** s historií |
| Chybí testy (TECH §6.2) | **`test/headless-smoke.js` — 77 kontrol**, prochází |
| Chybí Activity Dashboard (PLAN Priorita 3.3) | **Existuje** — `renderActivityDashboard` v `js/ui/panels.js:145` (ale jen jako řádek barevných čipů, ne jako přehled) |

**Důsledek pro plánování:** kdo se řídí jen těmito dvěma dokumenty, udělá znovu a levně
práci, která už je hotová, a propadne skutečnou mezeru. **Měření musí předcházet plánu.**
Tento odstavec je proto součástí architektury, ne poznámka.

### 2.2 Skutečná mezera — jedna věta

Příkazy hráče (`orders`) a směrnice (`directives`) existují, ale obojí je **ploská
sada podmínek v okamžiku**, ne **záměr, který se plní**. Hráč řekne „přednostně železo“
a hra v daném ticku přehodnotí váhu práce. Hráč nemůže říct „připrav družinu na
výpravu za drakem“ a čekat, že hra **sama domyslí**: najme tři bojovníky, vybaví je
mečem, naskoupí jídlo na deset dní a nechá je natrénovat — protože to nikdo neumí
a hráč to musí udělat klikací po klikaci. To je propast mezi „hráč je vůdce“ a
„hra je hratelná“.

**Jádrem návrhu je tuto propast zacpatit — a zacpatit ji jedním mechanismem, ne třemi
vlastnostmi.**

---

## 3. Jádro architektury: Záměr → Plán → Mezera → Autonomie → Následek

### 3.1 Záměr (`goal`) — jediná věc, kterou hráč zadává

Nahrazuje dvojici `directives` + `orders` jedním objektem s jednotným životním cyklem.
`directives` se stane *rychlou zkratkou* nad záměrem (viz §3.6), ne paralelní cestou.

```js
// goal = to, co hráč chce. Ne úkol. Úkol si vyrobí plánovač.
{
  id: 'g7',
  kind: 'campaign' | 'stock' | 'train' | 'explore' | 'prestige',
  label: 'Příprava na lov draků',
  priority: 70,              // 0..100 — když se záměry perou, rozhodne číslo
  params: { /* druhově specifické */ },
  status: 'planning' | 'active' | 'met' | 'failed',
  plan: [Step],              // viz 3.2 — vypočteno, hráč ho jen čte
  createdAt: 12345,          // herní čas
  startedAt: null, metAt: null
}
```

Druhy záměrů a jejich parametry:

| `kind` | Co znamená | Klíčové `params` |
|---|---|---|
| `stock` | „mám mít dost X“ | `material`, `qty`, `quality?` |
| `train` | „někdo to umí“ | `skill`, `level`, `minUnits` |
| `campaign` | „připravit a odjet na to a to“ | `expeditionId`, `minPartySize`, `byTime?` |
| `explore` | „prozkoumat tohle“ | `settlementIds?`, `minVisits` |
| `prestige` | „připrav se na další generaci“ | `renown`, `legacyTarget` |

### 3.2 Krok (`step`) — rozklad záměru na měřitelné podmínky

Plánovač převádí záměr na **kroky, které lze přesně změřit a splnit aktivitou hry**.
Krok je jednoznačný, a proto se dá automaticky ověřit, naplnit i vysvětlit.

```js
Step = {
  id: 'g7.s3',
  of: 'goalId',
  kind: 'count' | 'have' | 'skill' | 'equip' | 'build',
  // příklady:
  //   { kind:'count',  what:'units',      qty:3,                label:'3 bojovníci' }
  //   { kind:'have',   what:'material',   id:'food', qty:120,   label:'120 jídla' }
  //   { kind:'skill',  id:'combat',      level:8,              label:'bojovnictví 8' }
  //   { kind:'equip',  what:'weapon', minQuality:'fine', slot:'weapon' }
  //   { kind:'build',  id:'base:iron_mine', level:2,            label:'důl na základně 2' }
  qty: 0,            // kolik už je splněno
  needed: 0,         // kolik je třeba celkem
  done: false,
  blockedBy: 'g7.s1' | null   // krok může čekat na jiný
}
```

**Pravidlo: krok musí být splnitelný nejméně jednou aktivitou hry.** Krok, který nelze
splnit, je mrtvý záměr — a to je chyba, kterou musí zachytit brána (§6), ne hráč.

### 3.3 Plánovač (`planner`) — záměr na kroky

Deterministická, čistá funkce stavu: `{ záměr, stav světa } → kroky`. Bez náhody,
bez side effectů. Volá se při vytvoření záměru a znovu, když se krok změní.

`campaign: expeditionId='dragon_hunt', minPartySize=3` se rozloží na:

```
s1  equip  3× zbraň kvality fine+
s2  equip  3× zbroj
s3  count  3 jednotky s bojovnictvím ≥ 6     (blockedBy: s1)
s4  have   jídlo 3×0.5/den × délka výpravy
s5  have   3× lektvar na cestu
s6  count  družina vybrána a odjela
```

Hráč **neřešil**, co všechno musí být pravda, aby „lov draků“ proběhl. Hra to ví
a donese to k postavám. To je přesně ten okamžik, kdy se hráč cítí jako vůdce, ne jako
údržbář.

### 3.4 Mezera (`gap`) — jediné, podle čeho se rozhoduje

Mezera je **co chybí do nejvyššího kroku**, vyjádřená v jednotkách, které přiděluje
`unitWorkRate`. Tady se nahrazuje dnešní hrubý `materialNeed()` a váha `×8`:

```
dnes:  have < target ? w ×8 : w ×1.5        ← magická konstanta, ne úbytek
napětí: gap = (needed - qty);  w = 1 + 6 × (gap / needed) ×  urgency
```

Výhody, které plynou ze skutečné mezery místo prahu:

- **reaguje na poměr**, ne na průchod binární hranicí — plynulé, žádné skoky;
- **vysvětlitelná** — dashboard ukáže `mezera 37/120 jídla`, ne „magic weight 8“;
- **stejný mechanismus pro všechno** — suroviny, dovednosti, výbava, stavby, lidé;
- **testovatelná** — brála může tvrdit „mezera klesá při práci na správném uzlu“.

### 3.5 Rozdělovací (`scheduler`) — kdo to udělá

Nahrazuje dnešní `pickActivity()` jednotkým pravidlem, které samo o sobě pokrývá
dnešní chování i nové:

```
pro každou schopnou jednotku u:
  kandidáti = []
  pro každý AKTIVNÍ krok všech záměrů (seřazené podle priority × přibližování):
     mezera = step.needed - step.qty
     když mezera <= 0: přeskočit
     aktivity, které tenhle krok plní  →  váha = mezeraFrakce × urgency
  pro každou běžnou aktivitu (dosažení materiálu, jídla, zlata):
     váha = 1 + materialNeed × 6         ← zachováno z dneška, nízká priorita
  vybrat váženě (stejná ruleta jako dnes), s podmínkami:
     meetsReq(u, a) ∧ uzel existuje ∧ nebezpečí u.zvládne ∧ !avoidDanger
```

Klíčové vlastnosti:

- **Jedno pravidlo** pro záměry i pro běžnou práci → žádné dvě cesty, které si odporují;
- **Když záměry nejsou, hra se chová jako dnes** → žádná regrese (kryto testem §6);
- **Žádná schopná jednotka nezůstane stát**, pokud existuje nesplněný krok (garance §5).

### 3.6 Migrace `directives` a `orders` — bez dvojí cesty

Stav dnes má dvě vstupní cesty a plán přidává třetí. Musí zůstat **jediná**.

| Dnes | Stane se |
|---|---|
| `state.directives.focusMaterial` | zkratka: zadá `stock` záměr s `priority: 40` |
| `state.directives.focusTarget` | parametr `qty` toho záměru |
| `state.directives.avoidDanger` | zůstává přepínač (filtr kandidátů, ne záměr) |
| `state.orders[]` | zkratka: `stock` záměr s vysokou prioritou + `qty` záměr; fronta se dá číst, ale je to *jen zobrazení* nedoplněných kroků |

`G.setDirective('focusMaterial', 'iron_ore')` dál funguje (kompatibilita UI i savů),
ale **pod ním** vznikne záměr. Směrnice nezmizí — ztratí významnost. To je jediný
přípustný způsob, jak přidat třetí cestu: staré musí být **podmínkou nového**, ne sourozencem.

### 3.7 Následek — výsledek musí být vidět

Záměr bez dohledu je jen zápis do save. Tři místa, kde se záměr stane příběhem:

| Místo | Co ukazuje | Proč |
|---|---|---|
| **Přehled záměrů** (nový panel) | záměr, kroky, mezera, kdo na kroku pracuje, ETA | hráč ví, že jeho příkaz existuje |
| **Důvod volby** (u postavy) | rozklad vah: `skill 8 ×1.8 · mezera 37/120 ×4.2 · vzdálenost 9 ×0.61 = ×4.6` | hráč vidí **proč** — příčinnost je zábava |
| **Deník postavy** | dokončený krok jako osobní moment | postava si to „pamatuje“, svět má paměť |

Poslední řádek je zásadní pro premisu: autonomie, která **nestojí o tom, co dělá**,
vypadá jako černá skříňka. Deník je nejlevnější způsob, jak ji zlidštit —
a už existuje (`G.addJournal`, `js/systems/journal.js:7`).

---

## 4. Koherence — pravidla, která nesmí být porušena

Koherence není estetická vlastnost, ale **sada invariantů**. Těchto sedm se porušit nesmí:

| # | Invariant | Jak se poruší | Kdo hlídá |
|---|---|---|---|
| K1 | Každý krok záměru je splnitelný existující aktivitou/buildem | mrtvý záměr, hráč čeká navždy | brána `goals-reachable` |
| K2 | Každý zdroj, který hra spotřebovává, je dosažitelný jako krok | hráč nemůže říct „chci méně úmrtí“ | brána `goal-coverage` |
| K3 | Stejný plánovač běží v živém i offline běhu | offline hra dělá jinou hru | test `offline-parity` |
| K4 | Rozdělovac je deterministický pro daný seed | debug, replikace, reprodukovatelné sáčky | test `scheduler-determinism` |
| K5 | UI nemění stav přímo, jen přes `G.*` API | kód mimo systém, neočekávané efekty | pravidlo + postupná čistka |
| K6 | Každé nové pole v `state` má default v `migrateSave()` i v `ensureDefaults()` | starý save spadne | `migrateSave` test |
| K7 | Nová automatika funguje i při `G.simulating` (offline) | hra se při návratu rozsype | test `offline-parity` |

**K5 je aspirace, ne dnešní fakt** — a to je potřeba říct nahlas. Dnes UI mutuje stav
přímo na několika místech (`ui.js:879` `u.manual = !u.manual`, `ui.js:886-888` peníze
a `units.push`). Zavedeme to jako pravidlo pro **nový** kód a postupně odstraníme
starý; nevymýšlíme si, že to už platí.

**K3 je nejdůležitější z neviditelných.** Dnešní offline simulace volá `G.tick(dt)`
znovu, takže dnes je parita zadarmo. Jakmile začne „inteligentní“ autonomie dělat
náhodné nebo časově citlivé rozhodnutí, offline a živý běh se **rozejdou** — hráč
se vrátí a svět bude v jiném stavu, ne jaký by býval. Proto je parita výslovně K3,
ne vedlejší poznámka.

---

## 5. Autonomie — čtyři garance, které musí platit

Autonomie není náhodná animace; je to **inženýrské závazky, které hráč smí očekávat**.

| # | Závazek | Formulace |
|---|---|---|
| A1 | **Nezůstane stát** | Schopná jednotka, která nemá co dělat, dostane úkol, pokud existuje nesplněný krok jakéhokoli záměru. |
| A2 | **Zdůvodní** | Každé přiřazení má uložené rozpadové váhy; dashboard umí ukázat, proč. |
| A3 | **Záměr má přednost** | Krok blížící se dokončení bije obecnou práci; bez toho se plán nerozběhne. |
| A4 | **Hráč může vzít kontrolu** | `manual` na jednotce ji vyřadí z rozdělování, ale nepřeruší rozestavěnou práci v půlce cesty. |

A4 je drobnost s velkým dopadem na důvěryhodnost: hráč musí mít možnost říct „Aldo,
tohle nech a dělej tohle“ — a musí vědět, že to nejde jenom na dva obrazovky.

---

## 6. Hloubka bez nafukování

Tady je věc, kterou plány opomíjí: **hloubka není množství obsahu, ale počet
interakcí mezi systémy za nedostatku**.

| Špatná hloubka | Dobrá hloubka |
|---|---|
| 60. nepřítel | 12 systémů, které si navzájem překážejí |
| další 10 receptů | 5 cest k témuž zdroji (těžba / farma / karavana / nákup / výprava) |
| achievement navíc | záměr, který vyžaduje současně 3 systémy |
| synergy navíc | situace, kdy nejlevnější řešení stojí víc než čas |

Obsah v repu **už stačí** — 34 nepřátel, 33 schopností, 15 expedic, 10 sídel, 6 sídelních
specializací. Další nepřítel neudělá hru hlubší, jen delší. Místo toho:

> **Škála hloubky = počet cest, kterými lze jeden zdroj získat, a počet záměrů,
> které se o jeho kapacitu perou.**

Tím se dostáváme k **nedostatku jako hlavní zdroj zábavy**. Záměry si konkurují
o tytéž postavy, zlato a čas. Hráč nemůže mít všechno. A právě tohle nutí rozhodovat —
což je práce vůdce, ne práce klikací.

---

## 7. Zábavnost: čtyři podmínky, které musí být splněny

| Podmínka | Mechanika, která ji zajišťuje | K čemu slouží |
|---|---|---|
| **Pochopitelná příčinnost** | A2 — rozpad vah, „mezera 37/120 ×4.2“ | hráč se nebojí experimentovat |
| **Viditelný postup** | přehled záměrů s kroky a mezí | hráč vidí, že jeho příkaz se plní |
| **Napětí** | záměry s `priority` perou o kapacity | rozhodování má cenu |
| **Paměť světa** | deník postav, příběh, dynastie | svět má historii, ne jen stav |

Předpoklad, který je nutné udržet: **žádný herní systém nesmí být jediným
zdrojem odměny bez zápisu do deníku nebo přehledu.** Odměna, kterou hráč nevidí,
není odměna — je šum. Tento princip je přesně to, co opravdu chybělo, když příběhové
popupy „nedělaly nic“ ([`PRIBEHOVE_POPUPY.md` §2](./PRIBEHOVE_POPUPY.md)).

---

## 8. Roadmap — co dál, v jakém pořadí

Vychází z ověřeného stavu (§2), ne z plánu, který už splněný. Každá fáze má
**změřitelnou bránu**; bez ní se nepovažuje za hotovou.

### Fáze A — Sjednocení vstupů *(malá, odstraní rozpor, otevře dveře)* — ✅ **HOTOVO 2026-09-15** (viz §2.2)
| Úkol | Soubor | Brána |
|---|---|---|
| ✅ `goals` registry: `newGoal`, `cancelGoal`, `listGoals`, `getGoalBoard` | `js/systems/goals.js` (nový) | `check-globals` 0 problémů; 4 testy v `headless-smoke` (plán požadoval 3) |
| ✅ Směrnice jako zkratka nad záměrem (§3.6) | `js/systems/autonomy.js:131-137` | staré `setDirective` funguje; `focusMaterial` vytvoří záměr |
| ✅ Opravit duplicitní default směrnic | `js/main.js` `ensureDefaults` (chyběl `focusTarget`), `js/core/state.js:10-19` | K6 test: save bez `focusTarget` se otevře |

> **Proč nejdřív:** dokud existují dvě vstupní cesty, každá nová vlastnost bude
> muset existovat dvakrát. Sjednocení je nejmenší změna s největším
> následujícím zjednodušením.

### Fáze B — Plánovač a mezera *(jádro)* — ✅ **HOTOVO 2026-10-04** (§2.3)
| Úkol | Brána | Stav |
|---|---|---|
| `planner`: záměr → kroky, čistá funkce | test: `campaign` draka má ≥5 kroků; `stock` má 1 krok | ✅ `dragon_hunt` + družina 3 = **7 kroků**; `stock` = 1 |
| `gap`: krok → mezera v jednotkách práce | test: mezera klesá při práci na správném uzlu | ✅ `stepGap = (potřeba − má) × práce na kus` |
| `reachability` brána (K1) | test: všechny kroky splnitelné; jinak test červený, ne tichý | ✅ `test/coherence.js` — 82 záměrů / 274 kroků |
| `scheduler` přes `gap`; zachovat dnešní chování bez záměrů | test: bez záměrů je výběr práce **stejný** jako dnes | ✅ `test/scheduler-regress.js` proti zaznamenané reference |
| plánovač běží v offline simulaci | 1 h offline == 1 h živě | ✅ K3 v `coherence.js` — viz §2.3 |

> Ta poslední brána je klíčová: dokazuje, že refaktor nerozbil existující hru.
> **Fáze B ji prokázala třikrát za sebou** — a pokaždé ukázala jinou skutečnou
> chybu, kterou žádný test na novou funkci neodhalil (viz §2.3).

### Fáze C — Vedení, viditelné hráči
| Úkol | Brána |
|---|---|
| Přehled záměrů (panel) s kroky a mezí | screenshot/`emptyState` test: prázdný stav odkazuje kam jít |
| Důvod volby u postavy (rozpad vah) | test: přiřazení má rozpadové váhy; kladné všechny kroky |
| `takeControl` / `releaseControl` jako API (dnes jen `ui.js:879` přímo) | test: vzití kontroly ji vyřadí z rozdělování, práce nepřepne |
| Přepsat 3 přímé mutace v UI na API (K5) | `check-actions` beze změny; 3 testy |

### Fáze D — Autonomní dobudování
| Úkol | Brána |
|---|---|
| Kandidáti z `kind: explore` (návštěva sídel) | test: prozkoumaná sídla záměr plní |
| `train` záměry: učení skillu (mentor, učednictví) | test: skill roste, mezera klesá |
| Tlak na čas: `byTime` u `campaign` → záměr skončí `failed`, ne visí | test: po termínu `failed` + zápis do deníku |
| **Parita offline** (K3) | test: 1 h offline == 1 h živě, do 1 % hodnot |
| Prediktivní odpočinek (dnes `REST_THRESHOLD = 20`, reakce pozdě) | test: jednotka odpočine dřív, než vyčerpá |

### Fáze E — Hloubka
| Úkol | Brána |
|---|---|
| Koherence politika ↔ ekonomika ↔ čas (dnes `story.flags` už funguje, ale izolovaně) | test: volba mění ceny/boj (už existuje) + nová pro sezónu |
| Konkurence záměrů: dva `stock` záměry o tutéž kapacitu | test: vyšší `priority` vyhraje, log to vysvětlí |
| Prestiž jako generátor záměrů | test: po prestiži vznikne záměr pro další generaci |

### Fáze F — Obsah *(až když je co rozšiřovat)*
Obsah přidáváme **na mezeru**, kterou ukáže až Fáze B+E: nový nepřítel, pokud je
boj vpremiu příliš levný; nový recept, pokud chybí cesta k nějakému zdroji.
Pořadí podle tohoto pravidla, ne podle „co by se taky hodilo“.

---

## 9. Co se dělat nesmí

Tady jsou věci, které by vypadaly jako progres, ale premisi rozbijí:

| Nepřítel | Proč |
|---|---|
| **Mikrosloty plánování pro postavu** (2 sloty) | Odloženo už v `PLAN_HRATELNOST.md` §4 a správně — fronta dává 90 % přínosu bez této složitosti. Obnovit jen když je k dispozici a má důvod. |
| **Další obsah před Fází B** | Chybí hloubka, ne šířka. 34 nepřátel už stačí; 35. nepřítel hru neudělá hlubší. |
| **Přepis na ESM / TypeScript / Vite** | Technicky možné, ale teď by to koupilo jen HMR a minifikaci. Testy procházejí, build není potřeba. Oddělená větev, až bude bolet. |
| **Nové UI jako samostatný cíl** | Panel je, mapa je, dashboard (chips) je. Chybí hloubka dat, ne ploch. |
| **Náhodná rozhodnutí bez uloženého důvodu** | Poruší A2 a srovná hru s černou skříňkou. Jakákoli náhoda v rozdělování musí být uložená jako vysvětlení. |
| **Napětí mezi plánem a realitou řešené přidáváním UI** | Napětí vyřeší kapacita a priorita v datech, ne další tlačítko. |

---

## 10. Brány — co měří, že je hotovo

Tři existující nástroje, dva nové. Žádná fáze nekončí bez zelené brány.

| Brána | Příkaz | Co dnes (2026-10-04) | Nová |
|---|---|---|---|
| Globály | `scripts/check-globals.ps1` | ✅ 0/754 | hlídá `goals`/`planner`/`scheduler` |
| Akce UI | `scripts/check-actions.ps1` | ✅ 0 mrtvých z 88 | hlídá panel záměrů |
| Chod hry | `node test/headless-smoke.js` | ✅ 88 kontrol | panel záměrů (Fáze C) |
| **Koherence** | `node test/coherence.js` | ✅ **K1 + K3** | **K2** — každý spotřebovávaný zdroj je řiditelný |
| **Neregrese rozdělovace** | `node test/scheduler-regress.js` | ✅ 8 kontrol | hlídá, že kroky záměrů nepřepisují dnešní chování |

`test/coherence.js` je třetí noha pod stolem. Dnes umíme dokázat, že hra *funguje*
(`smoke`) a že kód je *čistý* (`check-globals`). Chybí brána, která dokáže říct
„záměr je **dosažitelný** a **offline běh dělá stejnou hru**“.
Bez ní je „koherence" jen hezký slovník; s ní je to vlastnost, kterou nelze rozbít
tichým merge-em.

`test/scheduler-regress.js` je čtvrtá, která vznikla až v praxi: dokazuje, že
**refaktor nezměnil hru tam, kde neměl**. Měří otisk sekvence volení práce
proti zaznamenané referenci, včetně scénáře, který naopak *musí* změnit chování
(záměr hráče). Bez něj by „chování bez záměrů je stejné jako dnes" bylo tvrzení
v commitu, ne měření.

---

## 11. Shrnutí v jednom odstavci

Idle Realm má hotové základy, funkční UI, obsah i testy; chybí mu jedna vrstva —
**záměr**. Dnešní hráč řídí hru dvěma sady podmínek (`directives`, `orders`), které
neřeší nic složitéjšího než „přednostně železo“; nemůže hře říct „připrav lov draků“
a nechat ji, ať si spočítá, co všechno to znamená. Architektura, která tuto propast
zavírá, je jediná uzavřená smyčka: **hráč zadá záměr → plánovač ho rozloží na měřitelné
kroky → rozdělovac přidělí postavy podle mezery, která jim zbývá → výsledek je
viditelný a zapíše se do paměti světa**. Tři kroky navíc (`orders`, `directives`,
autonomie) nevzniknou vedle, ale **pod** toto — jinak by hra měla čtyři způsoby říct,
co chce, a žádný by nebyl autoritativní. Koherence se pak neměří slovem, ale
`test/coherence.js`; autonomie ne kreslením, ale čtyřmi garancemi, které musí
platit včetně offline běhu. A zábavnost není v tom, kolik nepřátel přibude, ale
v tom, že záměry si budou konkurovat o omezené postavy, zlato a čas — protože
nedostatek je jediné, co z jedné mapy dělá rozhodnutí.

---

*Sestaveno z měřeného stavu repa (59 skriptů, 723 globálů, 77 passing testů),
z `DESIGN_DOKUMENT.md`, `PLAN_VYVOJE.md`, `TECHNICKY_DOKUMENT.md`, `PLAN_HRATELNOST.md`,
`UKOLY_A_VYROBA.md`, `PRIBEHOVE_POPUPY.md`, `SKALOVANI_MAPY.md`, `OBLASTI_A_SIDLA.md`
a z kódu `js/systems/autonomy.js`, `js/systems/work.js`, `js/core/state.js`,
`js/core/loop.js`, `js/ui/panels.js`, `js/ui/ui.js`, `index.html`, `css/style.css`.
Tam, kde dokumenty a kód si odporovaly, je rozhodl kód.*
