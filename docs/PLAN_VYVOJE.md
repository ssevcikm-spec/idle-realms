# Idle Realms — plán dalšího vývoje

> Navazuje na `docs/TECHNICKY_DOKUMENT.md`. Stav: repo verzované, hra publikovaná,
> ambice opravené. Tento dokument rozpracovává směr dalšího vývoje.

---

## 1. Vize a cíl

**Idle Realms** má být idle hra, která se **hraje sama** (živý svět, autonomní postavy,
běh na pozadí i offline), ale do které hráč **zasahuje jako vůdce** — určuje směr,
priority a dělá klíčová rozhodnutí. Ne mikromanagement každé akce, ale řízení na vyšší úrovni.

### Co už autonomie umí (potvrzeno v kódu)

- `tickAutonomy` (`js/systems/autonomy.js`) každé 2 s přiřazuje práci nečinným členům
  podle `focus` skupiny.
- Obchodník sám cestuje a prodává, karavany jezdí, světové události probíhají.
- Offline progres (`simulateOffline`, až 4 h) dopočítá hru zpětně.

### Hlavní mezery

1. **UI** — panel je vždy roztažený, mapa má jen malé okno (zejm. mobil).
2. **Recepty výroby** — některé nepřirozené (chléb z bylin + vláken).
3. **Vedení** — hráč má málo „páček", kterými by autonomii směroval.
4. **Zpětná vazba** — hráč špatně vidí, co postavy právě dělají a proč.

---

## 2. Priority

### Priorita 1 — UI/UX (nejvyšší dopad, viditelné okamžitě)

**Potvrzený problém** (`css/style.css`):
- `#world-wrap` má pevnou výšku `min(38vh, 280px)` (řádky 51–56).
- `#panel` je `flex: 1; overflow-y: auto` (řádky 78–81) — zabírá zbytek a **nelze sbalit**.
- Neexistuje žádný collapse/minimize/fullscreen mechanismus.

**Návrhy (postupně):**
1. **Sbalitelný panel** — tlačítko/gesto sbalí panel na lištu tabů; mapa zabere celou plochu.
2. **Fullscreen mapa** — tap na mapu ji zvětší; panel se schová úplně.
3. **Responsivní rozvržení** — desktop: mapa vlevo + panel vpravo (vedle sebe);
   mobil: přepínatelné režimy „mapa ⇄ panel".
4. **Ergonomie** — lepší využití `safe-area`, spodní lišta tabů, HUD bez přetékání.

**Dotčené soubory:** `css/style.css` (layout), `index.html` (`#world-wrap`/`#panel`/`#tabs`),
`js/ui/ui.js` (`render`, `selectTab`).

### Priorita 2 — Recepty výroby (přirozenost)

**Potvrzený problém** (`js/data/world.js`, `G.RECIPES` řádky 131–164):
- `bread` (chléb) = `herb` + `fiber` → **nepřirozené**; ve hře chybí surovina obilí/zrno.
- Drobné nelogičnosti: meč bez rukojeti/useň, luk bez tětivy.

**Návrhy:**
1. Přidat surovinu **`grain`** (obilí) — zdroj: zemědělské uzly/sídla; chléb = obilí (příp. obilí → mouka → chléb).
2. **Revize všech receptů** na logické řetězce: `wood → plank → bow`, `ore+coal → ingot → sword` (doplnit `hide` na jílec), `fiber → cloth`, `herb+crystal → potion`.
3. Rozšířit o mezistupně (mouka, tětiva) **přiměřeně** — držet to srozumitelné, ne přehnaně.
4. **Vyvážit** náklady/výstupy s cenami, aby výroba dávala ekonomický smysl (zisk, ne ztráta).

**Dotčené soubory:** `js/data/world.js` (`G.RECIPES`, `ACTIVITIES` pro zdroj obilí),
`js/data/character.js` (materiály/skilly), `js/data/workshops.js`, `js/systems/crafting.js`.

### Priorita 3 — Autonomie a „vedení"

**Cíl:** hra se hraje sama, ale hráč ji **směruje**, ne mikromanžuje.

**Návrhy:**
1. **Směrnice (directives)** — hráč nastaví cíl vyšší úrovně (např. „priorita: železo",
   „připrav se na výpravu", „nebojuj s draky"), autonomie se mu přizpůsobí.
2. **Chytřejší AI** — rozhodování o odpočinku, léčení, vyhýbání se nebezpečí, prioritě
   podle chybějícího materiálu (aktuálně je výběr práce poměrně mechanický).
3. **Přehled „co se děje"** — dashboard aktivit postav (kdo co dělá, kam jde, proč),
   aby hráč viděl autonomii a mohl zasáhnout.
4. **Zásah do jednotky** — pauza / převzetí kontroly nad konkrétní postavou.

**Dotčené soubory:** `js/systems/autonomy.js`, `js/systems/work.js`,
`js/systems/psychology.js`, `js/ui/panels.js`, `js/core/state.js` (stav směrnic).

### Priorita 4 — Obsah a balanc

- Více schopností, nepřátel, questů, achievementů (současně 22).
- Propojit nově dokončené systémy (politika, dynastie, čas/roční období) s hlavní smyčkou.
- Vyvážit ekonomiku, prestiž a tempo postupu.

### Priorita 5 — Technická infrastruktura (z technického dokumentu)

- Smoke testy (boot, save/load roundtrip, tick bez výjimek), lint.
- Automatizovaná kontrola `G.*` referencí (odhalí chybějící globály hned).
- Postupná migrace na ESM moduly, JSDoc/TypeScript, build (Vite).

---

## 3. Roadmap (fáze)

| Fáze | Zaměření | Klíčové výstupy |
|---|---|---|
| **0** | Stabilizace | ✅ ambice opravené, ✅ git + push, ✅ README, ✅ klon `idlefantasy_bart` |
| **1** | UI/UX | ✅ sbalitelný panel, ✅ celoobrazovková mapa, ✅ desktop rozvržení |
| **2** | Výroba | ✅ obilí + mouka + chléb (řetězec), ✅ revize receptů, ✅ balanc ziskovosti |
| **3** | Autonomie | ✅ směrnice, ✅ dashboard aktivit, ✅ ruční úkol přebije auto-práci, ✅ manuální režim postavy, ✅ chytřejší AI |
| **4** | Obsah | ✅ schopnost dřevorubectví, ✅ achievementy, ✅ nepřátelé (harpyje, bahenní golem) |
| **5** | Infra | ✅ check-globals skript, ✅ smoke test, ✅ .editorconfig (ESM/typizace/build: volitelné, viz níže) |

> **K Fázi 5 — ESM/TypeScript/build (Vite):** tyto kroky jsou záměrně odložené jako
> volitelné. Hra běží bez build kroku (stačí otevřít `index.html`), a migrace 48 IIFE
> souborů na ESM moduly + zavedení bundleru by vyžadovala Node.js tooling a důkladné
> ruční ověření v prohlížeči. Doporučuji ji dělat **postupně a v samostatné větvi**,
> až bude potřeba (např. kvůli minifikaci, HMR nebo typové kontrole).

---

## 4. Navrhované pořadí konkrétních úkolů (první kroky)

1. **Fáze 1** — přidat tlačítko „sbalit panel" + režim celoobrazovkové mapy (malá, izolovaná změna UI).
2. **Fáze 2** — přidat `grain` a opravit `bread` (malá změna dat) + revize ostatních receptů.
3. **Fáze 3** — zavést `directives` (nové pole ve stavu + UI + úprava `tickAutonomy`).
4. Po každé fázi: commit + push na `main` (Conventional Commits).

---

## 5. Jak budeme postupovat (workflow)

- Jeden úkol = jeden commit s jasnou zprávou (`feat:`/`fix:`/`chore:`).
- Push na `main` (repo je privátní, jeden vývojář).
- Větší celky lze řešit ve feature větvi (`git checkout -b feat/…`) a pak `merge`.
- Po každé změně ověřit v prohlížeči (smoke test: boot, práce, boj, výroba, save/load).
