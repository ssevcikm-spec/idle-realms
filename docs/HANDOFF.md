# Handoff — Idle Realm (předání novému chatu)

> **Datum:** 2026-09-16
> **Účel:** kompletní kontext pro nový chat/agenta, aby mohl pokračovat bez čtení
> celé historie. Tohle je živý dokument — při každém větším kroku ho aktualizuj.

---

## 1. Co to je a jak to spustit

**Idle Realm** — idle/incremental RPG ve **vanilla JavaScriptu**, bez build kroku,
bez závislostí, bez serveru. Hra běží otevřením `index.html` v prohlížeči
(mobile-first, desktop grid). UI je česky.

- **Adresář:** `C:\idle-realm` (session workspace)
- **Repo:** `https://github.com/ssevcikm-spec/idle-realms.git` (privátní), větev `main`
- **Architektura:** jediný globální objekt `window.Game` (zkráceně `G`); každý soubor
  je **IIFE**, které definují funkce/konstanty na `G`. **Pořadí `<script>` v
  `index.html` je kritické** (core → data → render → core → systems → render → ui → loop → main).
- **Herní smyčka:** `requestAnimationFrame` + pevný krok 100 ms (`js/core/loop.js`),
  `G.tick(dt)` volá všechny systémy. Offline simulace (4 h) přes `simulateOffline`.
- **Perzistence:** `localStorage`, klíč `idleRealmSave_v8`; export/import base64.
- **Svět:** `G.WORLD = G.generateWorld(seed)` — **regeneruje se z `worldSeed` při
  každém načtení**, uzly/úkoly nejsou v savu (jen seed), takže změny v generování
  platí i pro uložené hry.

---

## 2. Kontroly a konvence (po každé fázi)

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts/check-globals.ps1   # musí být "0 problems"
powershell.exe -ExecutionPolicy Bypass -File scripts/check-actions.ps1   # 0 mrtvých data-action/data-change
node test/headless-smoke.js                                              # "VYSLEDEK: OK"
node test/tile-window.js                                                 # dlaždice: okno je spojité
node test/tiles-preview.js                                               # náhled dlaždic se spustí
node test/foundry.js                                                     # světová vrstva: plán a kreslení
node test/foundry-game.js                                                # foundry v běžící hře
# dlaždice (potřebuje python s pillow+numpy — viz past č. 13):
python scripts/check-tiles.py --scheme sliding --repeat 6                # "VYSLEDEK: OK"
```

- **Commit + push po každé fázi**, Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`).
- **Push v tomto prostředí selhává na schannel TLS.** Použij:
  ```powershell
  git -c http.sslBackend=openssl push origin main
  ```
  (`ls-remote`/`fetch` fungují jen s openssl backendem.)
- Smoke test je **deterministický** — hned po načtení `G.setSeed(20260910)`.

---

## 3. Důležité pasti (naučené za pochodu)

1. **`powershell.exe` (Windows PowerShell 5.1) rozbíjí UTF-8** při čtení/zápisu
   textu (mojibake `Ä›` apod.). **Text edituj jen nástroji `edit`/`write`.**
   Pro hromadnou opravu náhodného znaku v cyrilici použij .NET:
   ```powershell
   $t=[System.IO.File]::ReadAllText($f); $t=$t.Replace(...); [System.IO.File]::WriteAllText($f,$t,[System.Text.UTF8Encoding]::new($false))
   ```
   Po editaci vždy ověř `[regex]::IsMatch($t,'[\u0400-\u04FF]')` (občas se vloudí
   cyrilské `e`/`a` místo latinky).
2. Nástroj `edit` vyžaduje **soubor nejdřív v session přečíst** (`read`), jinak
   vrátí „file has not been read". Nezapomínej na `read` před každým `edit`.
3. `edit` s `old_string` končícím novým řádkem snadno **spojí řádky** — kontroluj
   okolí editace.
4. **Model v session neumí číst obrázky** (read_image selhává). Generované assety
   ověřuj čísly (rozměr, počet barev) — viz skill `imagegen`. **Nově je ale skill
   `vision`** (čte screenshot přes Gemini vision) — využij ho, když uživatel pošle
   screenshot, ať můžeš hru „vidět" a doladit vizuál.
5. Headless smoke harness má **stuby**: `setInterval`/`setTimeout` vrací 0 a nikdy
   nevolají callback — **timerový kód netestuje**. Testuj přímým voláním funkcí.
6. Smoke test na konci **znovu spustí `main.js`** (test auto-pokračování) → nahradí
   `G.state`/`G.WORLD`. Stateful testy dávej **před** tenhle test.
7. `G.MATERIALS` je map; suroviny mají kvality (`crude..masterwork`); `matCount`
   sčítá přes kvality. `matRemove` **nic neodebere**, když máš méně, než žádáš
   (vrací false) — pro „smaž vše" mazat `state.materials[mat]` přímo.
8. **Headless Chrome v tomhle sandboxu NEBĚŽÍ** (od 2026-09-16): `chrome.exe
   --headless=new --dump-dom` spadne na `mojo platform_channel ... Access is
   denied` — sandbox blokuje jmenné roury, které Chrome používá pro IPC. Dřívější
   postup (dočasná harness stránka v rootu + `Start-Process
   -RedirectStandardOutput`) tím pádem nefunguje. **Místo toho ověřuj v Node a
   Pythonu**: stub DOM/canvas (jako `test/headless-smoke.js`), geometrii kreslení
   testuj na záznamu volání (`test/tile-window.js`) a pixely měř v Pythonu
   (`scripts/check-tiles.py`). Náhledovou stránku pro oči otevře uživatel sám.
   (Kdyby Chrome potřeba byl, jde o sandboxovou politiku — ne obcházet, ale řešit.)
9. **V generování světa používej jen seedovaný `rnd`**, nikdy `G.rand`/`G.randInt`:
   `G.rngFrom(seed)` drží mapu stabilní, kdežto globální RNG je jiný při každém
   spuštění (a rozladí i zbytek testů). Přesně tohle byla chyba ve velikosti
   shluků uzlů — mapa se při každém načtení savu mírně změnila; hlídá to test
   „svet je deterministicky".
10. **Desktop grid musí mít `minmax(0, …)` sloupce + `min-width:0` na položkách**
    (`#app` `1.1fr 1fr` → bez `minmax(0,…)` hrozí „grid blowout": široký min-content
    libovolného prvku — canvas (šířka = CSS × DPR na retina displeji) **nebo lišta
    surovin s mnoha chipy** (`#hud-mats`) — roztáhne sloupec mapy a **boční panel
    se časem zužuje**. Lišta surovin proto má `min-width:0` a vlastní řádek gridu
    `mats`, jinak se auto-umísťuje na spodek levého sloupce. Opravu ověř simulací:
    `world-wrap.style.overflow='visible'` + obří `canvas.width` a desítky chipů
    nesmí hnout šířkou `#panel`.
11. **Migrace savu nesmí být „všechno, nebo nic“.** `initEconomy()` se pouštěl jen
    když byla ekonomika **úplně prázdná** (`if (!Object.keys(state.economy.length))`),
    takže když se svět rozšířil ze 6 na 10 sídel (`c63effc`), čtyři nová města
    (Železná, Přístav, Úrodná Dolina, Starý Háj) zůstala bez trhu a hlásila
    „Sídlo nenalezeno“ — `priceAt()` vracel 0, `settlementMarket()` prázdno.
    Vzor, jak to dělat: **per-sídlo dopočet** `G.ensureEconomy()`, který nic
    nepřepisuje a je idempotentní (volá se v `continueGame` i jako pojistka
    v `tickEconomy`), `ensureQuests(id)` pro každé sídlo a úklid `state.selected`.
    Test: `ekonomika: chybějící sídla se doplní (starý sav s 6 sídly)`.
11. **AI obrázky (grafika):** Gemini API **neumí generovat obrázky na free tieru**
    (`limit: 0` u všech image modelů; text a vision fungují). Zdarma jde
    **Pollinations** (`https://image.pollinations.ai/prompt/<urlencoded>?width=768&height=768&nologo=true&model=flux&seed=N`,
    bez klíče, občas 500 → zkusit znovu) nebo **lokálně ComfyUI** — ten je
    **nainstalovaný a funkční** (`D:\ComfyUI`, `http://127.0.0.1:8188`,
    RX 6600 native, ~105 s na 768×768 dlaždici). Postup a dvě slepé uličky
    (portable build nemá gfx1032 kernely; Smart App Control blokuje nepodepsaný
    `offload-arch.exe`) jsou v `docs/STYL_GRAFIKY.md` §9.
    **Pollinations odřezává dlouhé prompty** (u ~800 znaků zůstal jen styl) —
    drž prompt **do ~350 znaků** a **subjekt dej na začátek**.
12. **PowerShell `[int]` zaokrouhluje, netruncuje** (`[int]3.98` = 4) — při
    indexování palet/čtverců přes `[int]($v/16)` to přeteče rozsah; používej
    `[math]::Floor()`.
13. **Python s pillow/numpy není na PATH** (Windows Store alias hlásí „Python was
    not found"). Používej venv ComfyUI:
    `D:\ComfyUI\venv-comfy\Scripts\python.exe` (Python 3.12, PIL 12, numpy 2.5).
14. **Bezešvost dlaždice je matematická vlastnost, ne dojem.** Buď platí
    „levý sloupec = pravý" (`wrap` ≈ 0), nebo dlaždice netileuje — a generátor
    obrázků to nikdy nedodá, musí se to dopočítat (`scripts/seamless_tiles.py`:
    posun o polovinu + zacelení středního kříže + srovnání okrajů).
    Naměřeno: wrap 27,9 → 0,0 při ztrátě ostrosti 12–18 % (zrcadlové prolnutí
    ztratí 45 %, proto se nepoužívá).
15. **Světlo ani dekorace nesmí být v souřadnicích dlaždice.** Per-dlaždicová
    `vignette` v `art.js` dělala krok 11,5 jasu na každé hranici (šachovnice).
    Vše, co má přesahovat dlaždici, musí být funkce **světa**: buď výřez z torusu
    (jako `G.tileDraw`), nebo spojitá vrstva (jako `drawRoads`).
16. **Šev se nesmí měřit jako absolutní skok** — když dlaždice navazují spojitě,
    je skok na hranici stejně velký jako zrno textury. Měř poměr `seam / zrno`
    (limit 1,6) a `wrap` na **nativním** rozlišení assetu (po zmenšení se šev
    zamaskuje). Vše v `scripts/check-tiles.py`.
17. **V workspace může běžet paralelní práce** (jiná session/agent ve stejném
    repu). Před commitem si projdi `git status` a stage **jen svoje soubory** —
    jinak si přivlastníš cizí rozdělanou práci. Sdílené soubory (`docs/HANDOFF.md`,
    `README.md`, `index.html`) před editací znovu načti, jinak `edit` ohlásí
    „file changed". Když cizí práce drží `index.html`, **neregistruj nový
    `<script>`** — commitnutý stav by byl nekonzistentní; dej kód do existujícího
    modulu (foundry takhle bydlí v `art.js`).
18. **Světová vrstva se nesmí hashovat ze screen souřadnic.** Foundry počítá
    pozice z dlaždicových (světových) souřadnic; kdyby bral `ox/oy`, krajina by
    při posunu kamery „plavala". Hlídá to `test/foundry.js` (posun kamery musí
    posunout prvky přesně o posun).
19. **Test, který spustí celou hru, musí skončit `process.exit()`** — hra si
    při běhu vytváří skutečné intervaly (toasty, panely) a Node by po testu
    neexitoval. Vzor: konec `test/headless-smoke.js`, `test/foundry-game.js`.
20. **Nový kód, který kreslí do canvasu, ověřuj počtem operací, ne dojmem.**
    `test/foundry-game.js` si obalí canvas proxy a počítá `fillRect`/`ellipse`/
    `stroke`; tím se pozná, že se vrstva opravdu vykreslila (a že se nevykresluje
    dvakrát).

---

## 4. Stav kódu (co je hotové)

### Čísla
- 59 JS souborů, **679** definovaných/used globálů `G.*` (check-globals čisté;
  část přírůstku je z paralelní práce na výbavě postav).
- Testy: headless-smoke **73** + tile-window **10** + tiles-preview **4** +
  foundry **13** + foundry-game **9** kontrol, deterministicky.
- Svět: **64×48 dlaždic**, **10 sídel**, ~220 uzlů (generuje se ze seedu).
- Dlaždice: assety jsou **torusy** (`wrap` 1,88), kreslí se jako **okno do
  textury** ve světových souřadnicích — `seam/zrno` 0,74, perioda 6 dlaždic.
- **Foundry** (nový vzhled mapy, Stage 1): krajina jako funkce světa — plochý
  podklad + světové štětce + přechody terénů + dekorace. Plán **0,15 ms/snímek**,
  na obrazovku ~224 štětců / 176 přechodů / 36 dekorací, **žádné opakování**
  (autokorelace hashe < 0,5 pro posuny 1–24 dlaždic). Detail: `docs/STYL_GRAFIKY.md` §11.
- Grafika: dlaždice lze přepnout mezi **kreslenou (kód)**, **malovanou (AI
  bitmapy v `assets/tiles`)** a **foundry** — `settings.tileStyle`, přepínač
  v menu ☰ (kód/malovaný) a v debug panelu **D** (i foundry).

### Klíčové soubory
| Oblast | Soubor |
|---|---|
| Data (aktivity, budovy, boj, world, questy) | `js/data/*.js` (hlavně `world.js`, `character.js`, `progress.js`, `combat.js`) |
| Jádro | `js/core/{state,loop,rng}.js` |
| Systémy | `js/systems/*.js` (work, combat, events, autonomy, economy, crafting, construction, psychology, …) |
| Render | `js/render/{art,world,tiles_ai,units_ai}.js` |
| UI | `js/ui/{ui,panels,trade,title_screen,debug,combat_modal,…}.js` |
| Boot | `js/main.js` |

### Feature inventář (podle oblastí)
- **Menu/UI**: záložky/podzáložky, HUD, **lišta surovin pod HUD** (mobil: posuvná,
  sbalovací), **☰ menu** (pokračovat/nová hra/smazat, přepínače), **auto-pokračování**
  při načtení stránky (menu se neukazuje, když je save), log s filtry/hledáním,
  toast hlášky. Audit + log fází v `docs/AUDIT_MENU.md`.
- **Fronta příkazů** (`state.orders`): priorita, ▲▼, „přiřadit všem/skupině",
  kandidáti se stavem a cenou přerušení.
- **Množství**: `G.qtyControl` s pamětí, `[−][+]/Max`, dávková výroba `G.craft(id, qty)`.
- **Základna**: výběr místa na mapě (validace, doporučené místo, přesun), stavba
  se staviteli (`js/systems/construction.js` — stavba = skrytý úkol), **všechny
  dílny i na základně** (carpenter/alchemy/kitchen mají `baseRequirement`).
- **Budovy**: efekty oživené (dílna/kovárna/zahrada/chata/laboratoř/cvičiště/
  knihovna/hospoda), lidské popisy efektů + náhled další úrovně.
- **Zakázky**: escort **obsadí postavy** (skrytý úkol), automatické zakázky
  (`settings.autoQuests` off/deliver/all + auto-odevzdání), `G.canTurnInQuest`
  jednotné místo, postup kill/explore vidět v UI.
- **Výroba**: „Udržovat zásobu" (`state.productionOrders` → `tickProduction`).
- **Skupiny a expedice**: expedici lze vyslat **celé skupině** (rychlé voliče
  v modalu: 👥 skupina, 🟢 jen volné postavy, 🎯 doporučená družina, vše / zrušit —
  `G.expQuickPick`, `G.expeditionGroups`, `G.recommendExpeditionParty`), nebo
  tlačítkem **⛵ Expedice** přímo na kartě skupiny (`pendingExpGroup`).
  **Expedice nikoho nevytrhne ze skupiny** — členství i role zůstávají, postava
  je jen „na cestě" (`G.groupExpeditionCount`, `G.expeditionPickable`,
  `G.expeditionUnitIsFree`; dřív volalo `G.removeUnitFromGroup`).
- **Výbava postav**: nákup v sídle na mapě (záložka **Vybavení**) nebo drop z bossů
  → nasazení **přímo na kartě postavy** (`data-change="unit-equip"`,
  ⚡ *Nasadit nejlepší* = `G.equipBest`) a hromadně v **Řemeslo → Batoh**
  (⚡ *Nasadit vše nejlepší* = `G.autoEquipAll`). Sdílený seznam
  `G.gearStockHtml` (Batoh i sídlo), skóre kusu `G.equipScore` (kvalita,
  životnost, mody, úspora výdrže) — rozbité kusy se nenasadí, výměna vrací
  starý kus do skladu.
- **Boj**: tahový, **automatický** (běží sám ~0,7 s/kolo, pozastavitelné), schopnosti
  defaultně automatické, **boj na každém uzlu s nepřáteli**, přepadení v divočině.
  **Svět běží dál i během souboje** (boj nepauzuje hru, jen překryje mapu;
  bojující postavy drží `G.unitInCombat`, ať je autonomie nepřeplánuje).
  **Okno se po konci samo zavře po 5 s**; aktivita v okně odloží
  (`G.resetCombatCloseTimer`), menu ☰ samozavření pozdrží.
  **Okno jde kdykoli zavřít** (`✕`/`Esc`/klik mimo; `G.hideCombatWindow`) —
  souboj běží dál na pozadí a na mapě se ukáže tlačítko **⚔️ Souboj — kolo N**
  (`G.combatWindowHiddenNow` → `G.openCombatWindow`); ručně zavřené okno se samo
  nevrací (ani po menu ☰). Režim okna v menu ☰: `vždy` / `jen boss a elita` /
  `nikdy (tiše)` (`settings.combatWindow`, `G.combatWindowMode`,
  `G.combatWindowWanted`); v tichém režimu jde výsledek do logu a plovoucí
  hláškou (`G.toast`).
- **Příběhové popupy**: viditelné efekty voleb, **trvalé následky** (`G.storyFlag`
  — renomé/základna, ceny, boj, reputace, výtěžnost), přepínač v menu.

### Mapa a grafika (poslední velký blok)
- **Foundry — krajina ve světových souřadnicích** (nový vzhled, `tileStyle =
  'foundry'`, přepínač v debug panelu **D** → „Mapa — vzhled"): plochý podklad po
  dlaždicích + **světové štětce** (`G.foundryGround`), **přechody terénů** (pěna
  u vody, závěj u sněhu, obruba jinde; každá hrana právě jednou) a **dekorace**
  (`G.foundryDeco`). Prvky se neřežou na hranici dlaždice a hash nemá periodu →
  **švy ani opakování nemohou vzniknout**. Plán je čistá funkce `G.foundryOps`
  (dá se testovat bez canvasu). Ladění: `G.FOUNDRY {daub, deco, edge, quality}`.
  Detail a naměřené hodnoty: `docs/STYL_GRAFIKY.md` §11.
- **Vzhled dlaždic lze přepnout**: kreslený (kód, výchozí) ↔ **malovaný (AI
  bitmapy)** — `settings.tileStyle`, přepínač „🎨 Vzhled mapy" v menu ☰.
  Malované dlaždice kreslí **`G.tileDraw`** (`js/render/tiles_ai.js`) jako
  **výřez z torusu** na světových souřadnicích (okno 128 px = 1/6 textury);
  kreslenou dlaždici vrací **`G.tileArt`** (záložní cesta, vždy funkční).
  Assety prošly `scripts/seamless_tiles.py` (jsou to torusy), barevně je
  srovnává `scripts/grade_tiles.py` na `TARGET` terénu. Volitelné prolnutí dvou
  textur: `G.setTileBlend(0–1)`.
  **Švy jsou vyřešené měřitelně** (seam/zrno 0,74, wrap 1,88) — měření
  `scripts/check-tiles.py`, náhled pro oči `tools/tiles/preview.html`.
  Detail a naměřené hodnoty: `docs/STYL_GRAFIKY.md` §8.
- **Malované postavy (AI sprity)**: stejný přepínač zapíná i bitmapové postavy
  (`js/render/units_ai.js` + `drawAiFigure` v `world.js`). 6 archetypů
  (`assets/units/*.png`, průhledné, výška 96 px), generované lokálně
  (`scripts/gen_units_local.py`) a ořezané prahováním jasu
  (`scripts/process_units.py`). Viz `docs/STYL_GRAFIKY.md` §10.
- Dlaždice **64 px** při zoomu 1, laditelné v debug panelu (**D** → „Mapa — měřítko":
  46/56/64/80 px, postavy 60–115 %), ukládá se do `settings`.
- Art dlaždic se kreslí do **192 px** canvasu (`ctx.scale(RES/SIZE)`), kompozice
  v logickém 96 prostoru → ostré i při zoomu a DPR 2.
- **LOD (úrovně detailu)** — `js/render/world.js`, `G.lodLevel(tilePx)`:
  `detail` (≥ 34 px) = krajina/domky/figurky s pruhy, `overview` (≥ 22 px) =
  symboly **+ jména**, sídla jako ikona s **prstencem v barvě frakce** a jménem,
  postavy jako **tečka v barvě role** (`G.ROLES[].color`), `far` (< 22 px) = jen
  symboly bez textů. Jmenovky zkouší 8 poloh a nekryjí symboly (`G.lodLabelFits`).
  Tlačítko **🔭** na mapě přepíná detail ↔ přehled (`G.toggleMapOverview`),
  `MIN_ZOOM` je 0,28 (`G.clampZoom`), takže se dá dojet až na `far`.
  Přehled se dá ověřit čísly: `G.drawWorldFrame()` + `G.lodFrameStats()`.
- **Uzly = krajinné prvky** (`js/render/art.js` `G.drawNodeFeature`), ne emoji:
  les = stromy, louka = pole, jezero = rákosí+molo, důl/jeskyně/kamenolom = bodové.
  Pod prahem LOD se přepne na symbol.
- **Uzly = oblasti** (`node.tiles`): lesy/pole/močály = shluk 2–5 dlaždic, **jezero
  = celá vodní plocha** (flood fill), rybaří se z břehu. Helpery: `G.nodeTiles`,
  `G.nodeDistance`, `G.nodeAnchor`, `G.nodeAt`. Klik/chodí/hledá se přes plochu.
- **Cesty = polyline** (`G.WORLD.roads` = pole bodů, `G.WORLD.roadTiles` = Set),
  kreslí se spojitě, žádné smyčky.
- **Sídla podle specializace** (`drawSettlementProps`): těžní věž / pila+klády /
  silo+seno / stánky+vůz; hradby u měst, věže u metropole, kroužek výběru podle
  velikosti.

---

## 5. Dokumenty (index) — co je aktuální

| Dokument | Obsah | Stav |
|---|---|---|
| `docs/PLAN_HRATELNOST.md` | původní plán (popupy, osobní momenty, fronta) | fáze 0–2 hotové, fáze 3 částečně |
| `docs/TECHNICKY_DOKUMENT.md` | architektura, inventář | **zastaralé počty** (48→57 souborů, 445→~614 globálů); jinak orientačně platí |
| `docs/AUDIT_MENU.md` | audit menu + log fází **M-A … M-J** | aktuální (přidává se tam řádek za každou fázi) |
| `docs/ANALYZA_BUDOVY_A_ZAKLADNA.md` | stavby, základna, výběr místa, stavitelské efekty | aktuální |
| `docs/SKALOVANI_MAPY.md` | měřítko mapy, prvky, cesty, **LOD + větší svět (hotové)** | aktuální |
| `docs/OBLASTI_A_SIDLA.md` | multi-tile oblasti, props sídel, LOD + větší svět | aktuální |
| `docs/PRIBEHOVE_POPUPY.md` | příběhové popupy (efekty, trvalé vlajky, přepínač) | aktuální |
| `docs/UKOLY_A_VYROBA.md` | zakázky, escort, automatika, výroba, dílny na základně | aktuální |
| `docs/BOJ.md` | boj (automatický, kill questy, explore) | aktuální |
| `docs/STYL_GRAFIKY.md` | **rozhodnutí cesty C (hybrid)**, §8 = dlaždice: bezešvá mapa, měření, náhled; §9 = lokální ComfyUI; §10 = malované postavy | aktuální (2026-09-16) |

---

## 6. Co je dál (plán)

> **Směr je rozhodnutý (2026-09-16): cesta C — hybrid.** Podklad, přechody
> a dekorace mapy z kódu (foundry), AI jen na alfa sprity/propsy a vrstvu 3
> (titul, scény, portréty). Zdůvodnění a čísla: `docs/STYL_GRAFIKY.md` §7–8, §11.

1. **Foundry** — ✅ **hotové** (`tileStyle = 'foundry'`, debug panel **D**,
   `docs/STYL_GRAFIKY.md` §11, testy `test/foundry.js` + `test/foundry-game.js`).
   Zbývá k němu:
   - **Doladit vzhled okem** — hustota a velikost štětců (`G.FOUNDRY.daub`,
     `deco`), síla přechodů, barvy. Náhled: `tools/tiles/preview.html`.
   - **Oddělit přepínač jednotek od mapy** — malované (AI) figurky se dnes
     zapínají jen s `tileStyle === 'ai'`, takže ve foundry se kreslí kódové.
     Pro cestu C patří do `settings.units`, aby šel foundry + malované postavy.
   - Volitelně přesunout kód z `js/render/art.js` do `js/render/foundry.js`
     (teď tam je, protože `index.html` držela paralelní práce).
2. **Rozestupy v paletě**: grass vs. hills i grass vs. road jsou od sebe jen
   **22,1** (L2) — na 46 px se pletou. Posunout odstín/hodnotu (foundry to
   neřeší, je to barva, ne kresba).
3. **Volba vzhledu** — doporučení platí (**1 — Žoldnéřská kronika**: pergamenová
   mapa + Battle Brothers postavy). Projeví se hlavně paletou a štětci, ne
   přepisem pipeline. Volitelně i volba „kód: varianty náhodně vs. zrcadlení
   podle parity" — čísla i vzhled jsou v `tools/tiles/preview.html`.
4. **Sjednocení postav (koncept od uživatele — ČEKÁ NA REALIZACI).**
   Uživatel chce: **všichni na jednom základním modelu** + **ikona role (erb)**
   + **na modelu jen zbroj/oblečení, žádná zbraň**. Doporučený přístup:
   - **Jeden základní sprite** (fixní póza, bez zbraně) — vygenerovat lokálně
     s pevným seedem pro konzistenci, ořezat jako dosud (`process_units.py`).
   - **Erb/ikona role** kreslit **v kódu** (vektorová heraldika: štít, dělení,
     barvy frakce/role z `G.FACTIONS`/`G.ROLES`) — dokonalá konzistence, ladí
     s procedurální estetikou hry.
   - **Výbava** = barevný tint základu (materiál zbroje) + malé přeložené odznaky
     (helm/truhla) — ne plné výměny spritů (AI neumí spolehlivě zarovnat vrstvy).
   - Současný stav: 6 odlišných archetypů, každý s vlastní zbraní.
5. **Drobné budoucí rozšíření**: vlastní sklad a obrana základny (karavany na
   základně už jezdí), dosah dílen jako kruh na mapě, posuvník výšky mapy.

---

## 7. Skills dostupné v session

- **`imagegen`** — generování obrázků/sprite přes Gemini (stejný klíč jako bot
  cetnik). Projekt `idle-realms`, styl na serveru jako `.style.txt` (sdílí se
  s botem v telefonu). Přepínače: `--project`, `--set-style`, `--many`, `--size WxH`,
  `--colors N`, `--dest local|server|both`, `--model fast`. **Ověřuj výstup čísly**.
- **`vision`** — přečte obrázek/screenshot přes Gemini vision (popis scény, UI,
  přepis, porovnání před/po); bere i screenshot ze schránky Windows. **Použij pro
  vizuální zpětnou vazbu, když sám obrázky nečteš.**

---

## 8. Git — jak je to teď

- Poslední commit: **foundry** — světová vrstva mapy (podklad, přechody terénů,
  dekorace) + testy + náhled. Před ním **Stage 0 dlaždic** (torusy + okno do
  textury, měření). Viz `git log`.
- **Pracovní strom NENÍ čistý** — běží v něm paralelní práce na **výbavě postav
  a skupinách/expedicích** (`js/systems/{misc,combat}.js`,
  `js/ui/{panels,trade,ui,title_screen,combat_modal}.js`, `css/style.css`,
  `index.html`, `README.md`, `docs/BOJ.md`, část `docs/HANDOFF.md`). Ta není moje;
  při commitu stage **jen svoje soubory** (viz pasti č. 17–18).
- Při push nezapomeň na `-c http.sslBackend=openssl` (viz §2) — v sandboxu
  `workspace-write` push spadne (`sh.exe: couldn't create signal pipe`), je
  potřeba širší oprávnění.

---

## 9. Okamžité „další kroky" pro nový chat

1. Zkontroluj `git status` / `git log` a ujisti se, že navazuješ na poslední stav
   (a co je cizí rozdělaná práce — viz §8).
2. **Hotové:** svět (64×48), LOD, backlog, audit menu, AI dlaždice (bezešvé
   a měřené), AI postavy, **foundry (světová vrstva mapy)**.
   **Další v řadě:** doladit foundry okem + oddělit přepínač jednotek od mapy
   (§6 bod 1), **rozestupy v paletě** (§6 bod 2), **sjednocení postav** (§6 bod 4)
   a volba vzhledu (§6 bod 3).
3. Než začneš měnit vzhled mapy, otevři `tools/tiles/preview.html` (náhled
   z reálného kódu: dlaždice, švy, foundry) a spusť `python scripts/check-tiles.py`
   — čísla jsou v `docs/STYL_GRAFIKY.md` §8 a §11.
4. Po každé fázi: sedm kontrol + commit + push (viz §2).
