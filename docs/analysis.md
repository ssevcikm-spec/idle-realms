# Idle Realm — přehled projektu

> Krátký rozcestník k projektu. Podrobná analýza, inventář souborů a roadmap jsou v [`TECHNICKY_DOKUMENT.md`](./TECHNICKY_DOKUMENT.md).

---

## Účel

**Idle Realm** je idle/incremental RPG běžící přímo v prohlížeči — bez build kroku, bez závislostí a bez serveru. Hráč spravuje skupinu postav, ekonomiku sídel, výrobu, obchod, boj a živý svět, který se vyvíjí i v době, kdy hráč nehraje (offline progres až 4 hodiny).

Cílem projektu je nabídnout hlubokou simulační hru s důrazem na:

- **Postavy** — atributy, dovednosti, výstroj, zranění, výdrž, nálada, osobnost (5 os), ambice, vztahy, povolání, perky, učednictví, stárnutí a dynastie.
- **Skupiny** — role (Vůdce, Zásobovač, Ranhojič, Průzkumník, Bojovník), chemie skupiny.
- **Ekonomiku** — dynamické ceny, specializace sídel, budovy, zakázky, frakce, obchodníka na cestách.
- **Boj** — kola, taktika, schopnosti, nepřátelé podle regionů.
- **Živý svět** — karavany, světové události, příběhové kvesty, expedice, politika.
- **Meta** — prestiž, 22 achievementů, základna.

---

## Architektura

Projekt je postaven na **vanilla JavaScriptu (ES6+)** bez frameworků a bez bundleru. Veškerý kód komunikuje přes jediný globální namespace **`window.Game`** (zkráceně `G`); každý soubor je **IIFE**, který při načtení přidává funkce/konstanty na tento objekt.

Klíčová specifika:

- `index.html` načítá **48 skriptů v pevném pořadí** (kritické pro běh — jeden globální namespace, žádná izolace modulů).
- **Herní smyčka** (`js/core/loop.js`) používá `requestAnimationFrame` s **pevným krokem 100 ms** a centrálně volá tick funkce všech systémů.
- **Perzistence** přes `localStorage` (klíč `idleRealmSave_v8`), s migrací ze starších verzí (v2–v7) a exportem/importem savu (base64).
- **Styly** v jediném souboru `css/style.css` (vlastní CSS, mobile-first s touch gesty; debug panel na klávesu `D`).

### Vrstvy

| Vrstva | Role |
|---|---|
| `js/core/` | jádro — smyčka, RNG, stav a perzistence |
| `js/data/` | statická data a lookup funkce (svět, postavy, schopnosti, politika, čas, expedice…) |
| `js/systems/` | herní logika a simulace (tick funkce) |
| `js/render/` | vykreslování na canvas (mapa, postavy) |
| `js/ui/` | DOM UI — panely, obchod, modály, debug |
| `js/main.js` | boot, migrace savu, nová hra |

---

## Klíčové moduly

| Modul | Role |
|---|---|
| `js/core/loop.js` | Herní smyčka (fixed timestep), offline simulace, auto-save |
| `js/core/state.js` | Stav hry, save/load/migrace, export/import, log |
| `js/core/rng.js` | Seeded RNG (xorshift) |
| `js/data/world.js` | Generování světa, sídel, uzlů, frakcí, questů |
| `js/data/character.js` | Dovednosti, perky, profese, vybavení |
| `js/data/ambitions.js` | Pool ambicí, `rollAmbitions`, `checkAmbitions` |
| `js/data/abilities.js` | Definice schopností a jejich výběr |
| `js/data/politics.js` | Politické programy, kandidáti, ceny podpory |
| `js/data/time.js` | Roční období, délka dne/roku |
| `js/data/expeditions.js` | Definice expedic |
| `js/systems/units.js` | Vytváření postav, XP, work-rate, bojová síla |
| `js/systems/psychology.js` | Nálada, vztahy, osobnostní drift, dezerce |
| `js/systems/combat.js` | Boj (kola, taktika), poškození, zranění |
| `js/systems/abilities.js` | Použití schopností, timery, jedy |
| `js/systems/economy.js` | Dynamické ceny, specializace, zakázky |
| `js/systems/merchant.js` | Obchodník a jeho cesty |
| `js/systems/events.js` | Světové a náhodné události |
| `js/systems/autonomy.js` | Autonomní chování a periodické ticky |
| `js/systems/aging.js` | Stárnutí, přirozená smrt, rodina |
| `js/systems/politics.js` | Volby, frakce, podpora kandidátů |
| `js/systems/dynasty.js` | Dědictví, legacy, rodokmen |
| `js/systems/expeditions.js` | Průběh a výsledek expedic |
| `js/systems/prestige.js` | Prestiž a meta progrese |
| `js/render/world.js` | Vykreslení mapy |
| `js/ui/ui.js` | Hlavní UI, HUD, log, modály |
| `js/ui/panels.js` | Panely (místo, postavy, skupiny, inventář, politika, dynastie, expedice) |

---

## Stav vývoje

Projekt je **kompletní a v principu hratelný** — všechny soubory odkazované z `index.html` existují, všechny tick funkce jsou navázané na herní smyčku a v kódu nejsou žádné TODO/FIXME markery.

Známá zjištění (detail v technickém dokumentu):

- **Ambice se automaticky nevyhodnocují** — `tickAmbitions` je volán pod guardem, ale nikde není definován; ambice se dnes plní jen přes debug tlačítko.
- **Chybí infrastruktura** — testy, lint, build/bundler, typová kontrola. Statická kontrola je k dispozici přes `scripts/check-globals.ps1` a smoke test v `test/smoke.html`.
- **Technický dluh** — jeden globální namespace, křehké pořadí načítání, duplikovaná migrační logika.

Roadmap (fáze 0–3) a doporučení jsou rozepsány v [`TECHNICKY_DOKUMENT.md`](./TECHNICKY_DOKUMENT.md).

---

## Další dokumenty

- [`../README.md`](../README.md) — spuštění, funkce, ovládání, testy, konvence commitů.
- [`TECHNICKY_DOKUMENT.md`](./TECHNICKY_DOKUMENT.md) — detailní technická analýza, inventář souborů, výsledky statické analýzy, známé problémy a roadmap.
