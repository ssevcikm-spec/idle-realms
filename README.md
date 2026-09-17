# Idle Realm

Idle RPG se správou skupin, ekonomikou, bojem a živým světem.

## Spuštění
Otevři `index.html` v prohlížeči. Nebo `python3 -m http.server 8000`.

## Funkce

- **Postavy** — atributy, dovednosti, výstroj, zranění, výdrž, **nálada**, **osobnost** (5 os), **ambice**, vztahy, povolání, perky, učednictví
- **Skupiny** — role (Vůdce, Zásobovač, Ranhojič, Průzkumník, Bojovník), chemie.
  Skupina je **družina**: drží spolu na mapě, bojuje spolu a role opravdu fungují —
  Vůdce +10 % práce, Bojovník +30 % boje, Ranhojič +50 % hojení, Průzkumník −25 %
  nebezpečí, Zásobovač −30 % jídla na expedici. Postava bez skupiny je družina o jednom.
- **Boj** — statistiky, kola, taktika, nepřátelé podle regionů. Bojuje se **s družinou**
  postavy, která je uzlu nejblíž (nebo s doporučenou / se všemi); členové skupiny
  v okolí **přispěchají na pomoc**. Nepřátel se přidává podle **síly** družiny, ne
  podle počtu hlav — přibrat slabšího člena tedy nikdy neuškodí.
- **Obchodník** — postava cestující mezi sídly, prodává přebytky, buduje vztahy
- **Výroba** — dílny ve městech, produkční řetězce, kvalita
- **Ekonomika** — dynamické ceny, specializace, budovy, zakázky, frakce
- **Svět** — karavany, světové události, příběhové kvesty (volby s trvalými efekty), dropy, expedice, politika
- **Obsah** — 33 schopností, 34 nepřátel + 6 bossů, sety, gemy, legendárky, synergie
- **Obtížnosti** — Relax / Normální / Hardcore (ovlivňují smrt, offline, XP)
- **Meta** — prestiž, 34 achievementů, základna, endgame, tutoriál

## Ovládání
- Tažení — pohyb mapou
- Ťuknutí — výběr uzlu / sídla / základny
- **Výbava (nástroj, zbraň, zbroj)** — kup ji v sídle na mapě (záložka **Vybavení**)
  nebo ji získej z bossů, a pak ji postavě nasaď:
  - **Lidé → Postavy** — u postavy v sekci *Výzbroj a výstroj* vyber v rozbalovacím
    seznamu konkrétní kus (➕ *Nasadit ze skladu*), nebo zmáčkni **⚡ Nasadit nejlepší**
    (tlačítko svítí s ⬆ a počtem slotů, které jde vylepšit),
  - **Řemeslo → Batoh** — seznam celého skladu, u každého kusu je vidět, komu se hodí
    nejvíc, a tlačítko **⚡ Nasadit vše nejlepší** rozdistribuuje výbavu všem postavám,
  - *Sundat* vrátí kus zpět do skladu; výměna kusu starý automaticky vrátí do skladu.
- **Expedice** — vyšli družinu (2–6 postav) na 2–10 dní; vybrat můžeš
  **celou skupinu** jedním tlačítkem, **jen volné postavy**, nebo nechat hru
  navrhnout **doporučenou družinu**. Expedice nikoho nevytrhne ze skupiny —
  členství i role mu zůstávají, jen je zrovna na cestě (⛵).
- **Souboj** — u uzlu s nepřáteli vyber, kdo půjde: **⚔️ Bojovat s družinou (N)**
  (výchozí — družina/skupina postavy, která je uzlu nejblíž), **🛡️ Doporučená
  družina** (nejmenší dostatečně silná), nebo **⚔️ Všichni** (přeruší práci všem).
  Okno boje se dá kdykoli zavřít (`✕ Zavřít okno`, `Esc` nebo klik
  mimo okno) a souboj běží dál na pozadí; zpátky ho otevřeš tlačítkem
  **⚔️ Souboj — kolo N** na mapě. V menu ☰ jde volbou **⚔️ Okno boje** nastavit,
  jestli má okno vyskakovat `vždy`, `jen boss a elita`, nebo `nikdy (tiše)`.
- **☰ v horní liště** — menu (zpět do hry, nová hra, obtížnost, přepínač příběhových popupů, smazání savu), zavře i `Esc`
- **Lišta surovin** pod HUD — co máš; na mobilu se posouvá prstem, šipkou ▸/▾ ji sbalíš
- **Klávesa D** — debug (rychlost času, měřítko mapy: dlaždice 46–80 px, výška postav 60–115 %).
  V sekci **Mapa — vzhled** je i přepínač vzhledu mapy (`kreslený` / `malovaný` / `foundry`)
  a **sada dlaždic**: když si vedle `assets/tiles/` položíš další sadu
  (`assets/tiles_kronika/final/`, `assets/tiles_kronika_tex/final/`), přepneš mezi nimi
  v běžící hře a hned vidíš rozdíl — chybějící sadu hra odmítne přepnout a nechá předchozí

Hra se při načtení stránky **rovnou rozjede z uložené pozice** (menu se neukazuje);
úvodní obrazovka s volbou obtížnosti se objeví jen při prvním spuštění nebo po smazání savu.

## Vývoj (git)

- Repozitář: `https://github.com/ssevcikm-spec/idle-realms.git` (privátní)
- Větev: `main`
- Konvence commitů: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`)

```bash
git clone https://github.com/ssevcikm-spec/idle-realms.git
cd idle-realms
# po změnách
git add -A
git commit -m "feat: popis změny"
git push
```

Architektura: vanilla JS, globální `window.Game`, IIFE moduly načítané v `index.html`
v pevném pořadí. Více v `docs/TECHNICKY_DOKUMENT.md`.

## Testy a kontroly

Statická kontrola konzistence (chybějící globály, odkazy v `index.html`, tick funkce, TODO):

```bash
powershell.exe -ExecutionPolicy Bypass -File scripts/check-globals.ps1
# nebo (PowerShell 7)
pwsh -File scripts/check-globals.ps1
```

Statická kontrola ovládacích prvků UI (každé `data-action` / `data-change` musí mít
obsluhu v `js/ui/ui.js` — odhalí mrtvá tlačítka):

```bash
powershell.exe -ExecutionPolicy Bypass -File scripts/check-actions.ps1
```

Headless smoke test (spustí hru bez prohlížeče přes Node — 77 kontrol, deterministicky):

```bash
node test/headless-smoke.js
```

Smoke test v prohlížeči (rozšířený, 31 kontrol):

```
test/smoke.html
```

## Licence
MIT.
