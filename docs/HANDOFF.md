# Handoff — Idle Realm (předání novému chatu)

> **Datum:** 2026-09-15
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
node test/headless-smoke.js                                              # "VYSLEDEK: OK" (nyní 49 kontrol)
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
8. **Vizuál se dá ověřit i bez očí** (a je to potřeba — Gemini vision umí vrátit
   `HTTP 429 prepayment credits are depleted`): postav dočasnou harness stránku
   **v rootu repa** (musí být v rootu, jinak relativní `js/...` cesty 404),
   spusť `chrome.exe --headless=new --dump-dom` a výsledek nech vypsat do
   `<pre>`; přečti ho ze souboru přes `Start-Process -RedirectStandardOutput`
   (roury v PowerShellu na Chrome nefungují — používá jmenné roury a sandbox je
   blokuje). Pixely se čtou z reálného canvasu (`ctx.getImageData`), takže se dá
   čísly ověřit barva prstence sídla, přítomnost textu nebo tečky postavy.
   Dočasné soubory pak smaž.
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
11. **AI obrázky (grafika):** Gemini API **neumí generovat obrázky na free tieru**
    (`limit: 0` u všech image modelů; text a vision fungují). Zdarma jde
    **Pollinations** (`https://image.pollinations.ai/prompt/<urlencoded>?width=768&height=768&nologo=true&model=flux&seed=N`,
    bez klíče, občas 500 → zkusit znovu) nebo lokálně ComfyUI (na Radeonu už
    **není potřeba ZLUDA** — od ROCm 10 pro Windows stačí oficiální AMD balíček
    PyTorchu, případně AMD portable build ComfyUI).
    **Pollinations odřezává dlouhé prompty** (u ~800 znaků zůstal jen styl) —
    drž prompt **do ~350 znaků** a **subjekt dej na začátek**.
12. **PowerShell `[int]` zaokrouhluje, netruncuje** (`[int]3.98` = 4) — při
    indexování palet/čtverců přes `[int]($v/16)` to přeteče rozsah; používej
    `[math]::Floor()`.

---

## 4. Stav kódu (co je hotové)

### Čísla
- 58 JS souborů, 637 definovaných/used globálů `G.*` (check-globals čisté).
- Smoke test: **63 kontrol**, deterministicky.
- Svět: **64×48 dlaždic**, **10 sídel**, ~220 uzlů (generuje se ze seedu).
- Grafika: dlaždice lze přepnout mezi **kreslenou (kód)** a **malovanou (AI
  bitmapy v `assets/tiles`) — `settings.tileStyle`, přepínač v menu ☰.

### Klíčové soubory
| Oblast | Soubor |
|---|---|
| Data (aktivity, budovy, boj, world, questy) | `js/data/*.js` (hlavně `world.js`, `character.js`, `progress.js`, `combat.js`) |
| Jádro | `js/core/{state,loop,rng}.js` |
| Systémy | `js/systems/*.js` (work, combat, events, autonomy, economy, crafting, construction, psychology, …) |
| Render | `js/render/{art,world}.js` |
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
- **Boj**: tahový, **automatický** (běží sám ~0,7 s/kolo, pozastavitelné), schopnosti
  defaultně automatické, **boj na každém uzlu s nepřáteli**, přepadení v divočině.
  **Svět běží dál i během souboje** (boj nepauzuje hru, jen překryje mapu;
  bojující postavy drží `G.unitInCombat`, ať je autonomie nepřeplánuje).
  **Okno se po konci samo zavře po 5 s**; aktivita v okně odloží
  (`G.resetCombatCloseTimer`), menu ☰ samozavření pozdrží.
- **Příběhové popupy**: viditelné efekty voleb, **trvalé následky** (`G.storyFlag`
  — renomé/základna, ceny, boj, reputace, výtěžnost), přepínač v menu.

### Mapa a grafika (poslední velký blok)
- **Vzhled dlaždic lze přepnout**: kreslený (kód, výchozí) ↔ **malovaný (AI
  bitmapy)** — `G.tileArt` v `js/render/tiles_ai.js`, `settings.tileStyle`,
  přepínač „🎨 Vzhled mapy" v menu ☰. AI dlaždice se **barevně srovnávají podle
  terénu** (voda modrá, sníh světlý) a mají 8 variant, aby se mapa neopakovala.
  Známý otevřený problém: dlaždice na sebe **nenavazují** (švy) — řešení viz
  `docs/STYL_GRAFIKY.md` §8.
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
| `docs/STYL_GRAFIKY.md` | **kandidáti stylu + balíčky** (doporučen „Žoldnéřská kronika" = Battle Brothers + pergamen) | **čeká na rozhodnutí uživatele** |

---

## 6. Co je dál (plán)

1. **Styl grafiky** — viz `docs/STYL_GRAFIKY.md`; uživatel ještě nevybral.
   Doporučeno: definovat styl projektu (`imagegen --set-style`) a pak generovat
   ilustrace (titul + 7 příběhových scén). Skills: `imagegen` (generování,
   styl na serveru `.style.txt`, `--size WxH --colors N` = pixel art) a `vision`
   (čtení screenshotů pro vizuální ladění).
2. **Drobné budoucí rozšíření**: vlastní sklad a obrana základny (karavany na
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

- Vše je commitnuté a pushnuté, `HEAD == origin/main`; pracovní strom čistý
  (poslední změny: LOD — přehled mapy, tlačítko 🔭).
- Při push nezapomeň na `-c http.sslBackend=openssl` (viz §2).

---

## 9. Okamžité „další kroky" pro nový chat

1. Zkontroluj `git status` / `git log` a ujisti se, že navazuješ na poslední stav.
2. Svět (64×48), LOD, backlog i audit menu jsou hotové — zbývá **styl grafiky**
   (čeká na rozhodnutí uživatele) a drobná budoucí rozšíření (viz §6).
3. Po každé fázi: tři kontroly + commit + push (viz §2).
