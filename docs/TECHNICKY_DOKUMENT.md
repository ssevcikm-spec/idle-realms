# Idle Realm — technický dokument a analýza stavu

> Dokument slouží jako podklad pro plánování dalšího vývoje.
> Stav ke dni analýzy (po doplnění chybějících souborů).

---

## 1. Shrnutí (executive summary)

**Idle Realm** je idle/incremental RPG v čistém JavaScriptu, které běží přímo v prohlížeči
bez build kroku, bez závislostí a bez serveru. Hra se spouští otevřením `index.html`.

### Aktuální stav projektu

| Kritérium | Stav |
|---|---|
| Počet souborů JS | 48 |
| Rozsah JS | ~8 700 řádků (+ CSS 739, HTML 92) |
| Chybějící soubory (odkazy v `index.html`) | **0** — všechny vyřešeny |
| Nedefinované globály (`window.Game.*`) | **1** (`tickAmbitions`, chráněné guardem) |
| Chybějící tick funkce (mrtvý kód) | **0** — vše navázáno na herní smyčku |
| TODO / FIXME / XXX / HACK markery | **0** (pouze 1 falešný záchyt v textu) |
| Build systém / bundler | žádný |
| Správa verzí (git) | žádná (git není nainstalován) |
| Testy / linting / typová kontrola | žádné |

**Závěr:** Projekt je nyní **kompletní a v principu hratelný**. Zbývá jediné drobné
funkční zjištění: **ambice se automaticky nevyhodnocují** (viz §6). Hlavní rizika pro další
vývoj jsou infrastrukturní — chybí git, testy, build a modularizace (viz §7).

---

## 2. Technologický přehled

- **Jazyk:** Vanilla JavaScript (ES6+), žádné frameworky, žádné knihovny.
- **Běh:** prohlížeč; `index.html` načítá skripty klasickými `<script>` tagy v pevném pořadí.
- **Styly:** jediný soubor `css/style.css` (vlastní CSS, bez frameworku).
- **Perzistence:** `localStorage` (klíč `idleRealmSave_v8`), export/import přes base64.
- **Jazyk hry:** čeština (UTF-8, včetně diakritiky).
- **Platforma:** mobile-first (viewport, touch gesta — tažení/ťuknutí), desktop (klávesa `D` = debug).

---

## 3. Architektura

### 3.1 Globální namespace a moduly

Veškerý kód komunikuje přes jediný globální objekt **`window.Game`** (zkráceně `G`).
Každý soubor je **IIFE** (Immediately-Invoked Function Expression), který při načtení
definuje funkce/konstanty na objektu `Game`:

```js
(function () {
  const G = window.Game;
  G.nejakaFunkce = function () { ... };
})();
```

Důsledky:
- **Pořadí načítání je kritické** — definováno v `index.html` (§3.3).
- Neexistuje izolace ani modulový systém; vše sdílí jeden namespace (kolizní riziko).

### 3.2 Vrstvy (adresáře)

| Vrstva | Role | Soubory | Řádky |
|---|---|---|---|
| `js/core/` | jádro — smyčka, RNG, stav/perzistence | 3 | 298 |
| `js/data/` | statická data a „lookup" funkce | 13 | 1 597 |
| `js/systems/` | herní logika / simulace (tick funkce) | 21 | 3 756 |
| `js/render/` | kreslení na canvas (mapa, postavy) | 2 | 691 |
| `js/ui/` | DOM UI — panely, obchod, debug | 8 | 2 187 |
| `js/main.js` | boot, migrace savu, nová hra | 1 | 163 |

### 3.3 Pořadí načítání (`index.html`)

1. **core**: `rng.js`
2. **data**: `world`, `character`, `combat`, `progress`, `personality`, `ambitions`,
   `workshops`, `aging`, `abilities`, `politics`, `time`, `expeditions`, `unlocks`
3. **render**: `art.js`
4. **core**: `state.js`
5. **systems**: `units`, `groups`, `psychology`, `work`, `combat`, `abilities`, `economy`,
   `merchant`, `crafting`, `workshops`, `misc`, `drops`, `events`, `autonomy`, `aging`,
   `politics`, `dynasty`, `time`, `expeditions`, `journal`, `prestige`
6. **render**: `world.js`
7. **ui**: `panels`, `trade`, `base_panel`, `achievements_panel`, `combat_modal`,
   `merchant_panel`, `debug`, `ui`
8. **core**: `loop.js`
9. `main.js` (boot)

### 3.4 Herní smyčka (`js/core/loop.js`)

- `requestAnimationFrame` + **pevný krok (fixed timestep) 100 ms** (`TICK = 1/10`).
- `MAX_CATCHUP = 24` — omezení počtu dopočítávaných kroků za snímek.
- `tick(dt)` volá centrálně všechny aktivní systémy:

```
tickTasks → tickEconomy → tickInjuries → tickQuests → tickCaravans →
tickWorldEvents → tickMerchants → tickAchievements → tickAutonomy → tickStory → tickEvents
```

- `tickAutonomy` dále řídí periodické subsystémy (nálada, vztahy, osobnost, dezerce,
  ambice, základna, …) v intervalu 2 s.
- **Offline progres:** `simulateOffline(elapsed)`, kapacita 4 hodiny, dopočítá `tick` zpětně.
- **Auto-save:** každých 5 s (`setInterval`) + při `beforeunload` a `visibilitychange`.

### 3.5 Stav a perzistence (`js/core/state.js`)

- `SAVE_KEY = 'idleRealmSave_v8'`, `SAVE_VERSION = 8`.
- `newState()` — kompletní výchozí stav (jednotky, skupiny, úkoly, ekonomika, svět, meta).
- `save()` / `load()` / `migrateSave()` — migrace ze starších verzí (v2–v7).
- `exportSave()` / `importSave()` — base64 export/import.
- Pomocné funkce materiálů (`matAdd`, `matCount`, `matRemove`, …) a log (`G.log`).
- Stav obsahuje domény: `resources`, `materials`, `equipment`, `buildings`, `units`,
  `groups`, `tasks`, `economy`, `reputation`, `quests`, `caravans`, `worldEvents`,
  `expeditions`, `masterworks`, `prestige`, `base`, `story`, `achievements`, `combat`,
  `family`, `politics`, `dynasty`, `stats`, `camera`, `selected`, `log`.

---

## 4. Inventář souborů

### `js/core/` (jádro)

| Soubor | Řádky | Role |
|---|---|---|
| `rng.js` | 25 | Seeded RNG (xorshift), `rand`, `randInt`, `pick`, `chance`, `clamp`, `rngFrom` |
| `state.js` | 214 | Stav hry, save/load/migrace, export/import, materiály, log |
| `loop.js` | 59 | Herní smyčka, fixed timestep, offline simulace, pause |

### `js/data/` (data)

| Soubor | Řádky | Role |
|---|---|---|
| `world.js` | 371 | Generování světa, sídla, uzly, nebezpečí, frakce, questy |
| `character.js` | 165 | Dovednosti (`SKILLS`), perky, profese, vybavení |
| `progress.js` | 212 | Aktivity, zakázky, budovy, tech progres, prestižní definice |
| `ambitions.js` | 116 | Pool ambicí, `rollAmbitions`, `checkAmbitions` |
| `abilities.js` | 137 | **Schopnosti**: `ABILITIES`, `abilitiesFor`, `autoChooseAbility` |
| `personality.js` | 71 | Osobnost (5 os), drift, reakce |
| `combat.js` | 77 | Nepřátelé, taktika, regiony |
| `aging.js` | 40 | **Věk**: `AGE_YEAR`, prahy, `ageModifiers`, `naturalDeathChance`, rodina |
| `politics.js` | 70 | **Politika**: `POLITICAL_PROGRAMS`, `POLITICS`, kandidáti, `supportPrice` |
| `time.js` | 50 | **Čas**: `SEASONS`, `TIME` (délky dne/ročních období) |
| `expeditions.js` | 75 | **Expedice**: `EXPEDITIONS`, min/max velikost družiny |
| `workshops.js` | 102 | Dílny, produkční řetězce, recepty |
| `unlocks.js` | 111 | Odemykání, tech strom, achievement definice |

### `js/systems/` (logika)

| Soubor | Řádky | Role |
|---|---|---|
| `units.js` | 198 | Vytváření postav, XP, work-rate, bojová síla |
| `groups.js` | 116 | Skupiny, role, chemie |
| `psychology.js` | 288 | Nálada, vztahy, osobnostní drift, dezerce |
| `work.js` | 170 | Úkoly, těžba, produkce, stamina |
| `combat.js` | 307 | Boj (kola, taktika), poškození, zranění |
| `abilities.js` | 151 | **Použití schopností**: `useAbility`, `tickAbilityTimers`, `tickPoisons` |
| `economy.js` | 203 | Dynamické ceny, specializace, zakázky |
| `merchant.js` | 167 | Obchodník, cesty mezi sídly, vztahy |
| `crafting.js` | 103 | Výroba, kvalita |
| `workshops.js` | 31 | Dílny tick |
| `misc.js` | 501 | Různé (smrt, vzkříšení, léčení, masterworks, …) |
| `drops.js` | 32 | Loot/dropy |
| `events.js` | 454 | Světové a náhodné události |
| `autonomy.js` | 289 | Autonomní chování (periodické ticky, auto-práce) |
| `aging.js` | 118 | Stárnutí, přirozená smrt, rodina, děti |
| `politics.js` | 169 | **Politika**: volby, frakce, podpora kandidátů |
| `dynasty.js` | 108 | **Dynastie**: dědictví, legacy, rodokmen |
| `time.js` | 80 | **Čas**: fáze dne/roku, sezónní modifikátory |
| `expeditions.js` | 117 | Expedice (start, průběh, výsledek) |
| `journal.js` | 35 | Deníky postav |
| `prestige.js` | 119 | Prestiž, nová mapa, meta progrese |

### `js/render/` a `js/ui/`

| Soubor | Řádky | Role |
|---|---|---|
| `render/art.js` | 300 | Canvas kreslení (postavy, ikony) |
| `render/world.js` | 391 | Vykreslení mapy, uzlů, sídel |
| `ui/ui.js` | 536 | Hlavní UI, HUD, log, modály |
| `ui/panels.js` | 796 | Panely (místo, postavy, skupiny, inventář, politika, dynastie, expedice) |
| `ui/trade.js` | 256 | Obchodní panel |
| `ui/debug.js` | 232 | Debug panel (klávesa `D`) |
| `ui/combat_modal.js` | 137 | Bojové okno |
| `ui/merchant_panel.js` | 122 | Panel obchodníka |
| `ui/base_panel.js` | 69 | Panel základny |
| `ui/achievements_panel.js` | 39 | Panel achievementů |

---

## 5. Výsledky statické analýzy

Provedena analýza všech `G.*` referencí (definice vs. použití) napříč 48 soubory.

### 5.1 Definované vs. použité globály

- **Definováno:** 445 globálů (`G.něco = …`).
- **Použito:** 446 globálů.
- **Použito, ale nedefinováno:** 1 — `tickAmbitions` (viz §6).

### 5.2 Tick funkce — navázání na smyčku

Všechny tick funkce jsou **definované i volané** (žádný mrtvý kód, žádná chybějící tick
funkce). Kompletní výčet navázaných ticků:

`tickTasks`, `tickEconomy`, `tickInjuries`, `tickQuests`, `tickCaravans`, `tickWorldEvents`,
`tickMerchants`, `tickAchievements`, `tickAutonomy`, `tickStory`, `tickEvents`,
`tickTime`, `tickPolitics`, `tickAging`, `tickFamily`, `tickExpeditions`,
`tickAbilityTimers`, `tickPoisons`, `tickMood`, `tickRelationships`, `tickPersonalityDrift`,
`tickPersonalityReactions`, `tickDesertion`, `tickProfessions`, `tickRestCheck`,
`tickStaminaDrain`, `tickStaminaRegen`, `tickBase`.

### 5.3 Odkazy v `index.html`

Všech 48 `<script src="…">` odkazů ukazuje na existující soubor (0 chybějících).

### 5.4 TODO / FIXME / XXX / HACK

0 relevantních markerů (jediný záchyt je falešný — běžný text).

---

## 6. Známé problémy a zjištění

### 6.1 (Nízká priorita) Ambice se automaticky nevyhodnocují

- `js/data/ambitions.js` definuje `checkAmbitions(unit)` — kontrolu splnění ambicí **jedné postavy**.
- `js/systems/autonomy.js:19` volá `if (G.tickAmbitions) G.tickAmbitions(INTERVAL);`
  — jenže funkce **`tickAmbitions` nikde neexistuje** (je chráněná guardem, takže hra nespadne,
  ale kontrola se periodicky **neprovádí**).
- Jediné místo, kde se ambice dnes vyhodnotí, je **ručně přes debug tlačítko**
  (`js/ui/debug.js` → `check-ambitions`).

**Dopad:** ambice (a jejich odměny — XP, renown, nálada, trait) se plní jen po stisknutí
debug tlačítka, nikoli samovolně v průběhu hry.

**Návrh opravy** (jedna ze dvou variant):
1. Doplnit do `js/data/ambitions.js` obal:
   ```js
   G.tickAmbitions = function () {
     for (const u of G.state.units) G.checkAmbitions(u);
   };
   ```
2. Nebo v `autonomy.js` nahradit volání iterací:
   ```js
   for (const u of G.state.units) if (G.checkAmbitions) G.checkAmbitions(u);
   ```

### 6.2 Chybějící infrastruktura (hlavní riziko pro týmový vývoj)

| Oblast | Stav | Riziko |
|---|---|---|
| Git | chybí | žádná historie, review, větvení, rollback |
| Testy | žádné | regrese neodhalitelné; chyby se projeví až v prohlížeči |
| Build/bundler | žádný | manuální pořadí skriptů, žádný HMR/minifikace |
| Lint / formátování | žádné | nekonzistence stylu |
| Typová kontrola | žádná (bez TS/JSDoc) | tiché chyby z překlepů v `G.*` |
| Modularizace | žádná (ESM nevyužito) | jeden globální namespace, kolize |

### 6.3 Technický dluh v kódu

- **Jeden globální namespace `window.Game`** — jakákoli kolize názvů je tichá.
- **Pořadí načítání je křehké** — přidání souboru vyžaduje ruční editaci `index.html`.
- **Duplikovaná migrační logika** — výchozí hodnoty stavu se opakují ve `state.js`
  (`newState` + `migrateSave`) i v `main.js` (`ensureDefaults`).
- **IDs jako řetězce** (`'u1'`, `'ch…'`) s ruční obnovou sekvencí (`restoreSequences`).
- **Jeden velký CSS** (739 řádků v jednom souboru).
- **Data inline v JS** (žádný JSON/CSV), žádné oddělení dat od logiky ve formě konfigurace.

---

## 7. Doporučení a roadmap pro další vývoj

### Fáze 0 — Stabilizace (předpoklad všeho dalšího)

1. **Opravit ambice** (§6.1) — triviální, jednořádková změna.
2. **Smoke test v prohlížeči** — otevřít `index.html`, projít hlavní smyčku
   (nová hra → přiřadit práci → boj → expedice → politika → uložit/načíst).
   (Node v prostředí není dostupný, takže automatický syntax-check nelze spustit lokálně;
   je vhodné ho přidat.)
3. **Založit git** a provést úvodní commit (repo je aktuálně bez verzování).

### Fáze 1 — Zajištění kvality

4. Přidat **minimální testy** (smoke test: načtení všech skriptů, boot nové hry,
   save/load roundtrip, tick bez výjimek).
5. Zavést **syntax check / lint** (např. ESLint) a skript pro kontrolu `G.*` referencí
   (automatizovat analýzu z §5, aby se chybějící globály odhalily okamžitě).
6. Zavést **formátování** (Prettier) a jednotnou konvenci.

### Fáze 2 — Modernizace architektury (volitelně)

7. Migrace na **ESM moduly** (`import`/`export`) — odstraní závislost na pořadí a globálním
   namespace. Lze dělat postupně.
8. Zavedení **build kroku** (Vite) — HMR, minifikace, bundling.
9. **JSDoc / TypeScript** pro typovou bezpečnost `G.*` API (odhalí překlepy staticky).

### Fáze 3 — Herní obsah (plánovat na základě designu)

10. Vyvážení nově dokončených systémů (schopnosti, politika, dynastie, čas/roční období,
    expedice) — ověřit, že odměny a náklady dávají smysl.
11. Rozšíření dat (nepřátelé, questy, achievementy, schopnosti) a propojení s prestiží.

---

## 8. Příloha — datový model (klíčové domény)

Hlavní entity ve stavu (`G.state`):

- **`units[]`** — postava: `id`, `name`, `level`, `xp`, `attrs` (str/agi/int/end/luk),
  `skills{}`, `traits[]`, `equipment{tool,weapon,armor}`, `injuries[]`, `perks{}`,
  `profession`, `mentorId`, `stamina`, `mood`, `personality`, `ambitions[]`,
  `relationships{}`, `role`, `merchantRoute/State`, `onExpedition`, `birthTime`,
  `generation`, `parentIds[]`, `legacy`, `journal[]`, `dead`, `deserted`, `isChild`.
- **`groups[]`** — skupina: `memberIds[]`, role (Vůdce, Zásobovač, Ranhojič, Průzkumník,
  Bojovník), `focus`, chemie.
- **`tasks[]`** — úkol: přiřazení postav, aktivita, uzel, cíl.
- **`economy`** — ceny, specializace sídel, zakázky, frakce.
- **`quests{}`** — questy podle sídla; `caravans[]`, `worldEvents[]`.
- **`expeditions[]`**, **`masterworks[]`**.
- **`politics{factions}`**, **`dynasty{generations,…}`**, **`family{children[]}`**.
- **`prestige{level,totalPrestige,unlocks[]}`**, **`base{unlocked,buildings,accum}`**.
- **`story{completed[],flags{}}`**, **`achievements{unlocked[]}`**.
- **`stats{}`** — souhrnné statistiky (práce, boje, obchod, smrti, volby, expedice, …).

---

*Dokument vygenerován automatizovanou analýzou repozitáře (statická analýza referencí,
inventář souborů, kontrola odkazů).*
