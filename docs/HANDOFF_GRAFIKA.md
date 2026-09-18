# Handoff: grafika Idle Realm — stav 2026-09-17

Tenhle dokument je pro **nový chat**, který o předchozí práci nic neví. Je
samostatný: obsahuje zadání, rozhodnutí, naměřená čísla, mapu souborů, otevřené
úkoly a pasti. Druhý dokument pro orientaci v celém projektu je
`docs/HANDOFF.md` (kód, kontroly, konvence).

**První, co je potřeba vědět:** uživatel je **jediný soudce vzhledu** — agent
obrázky v této session nevidí. Všechno se musí měřit čísly (`scripts/*.py`)
a hotové věci se ukazují uživateli v prohlížeči (`tools/tiles/preview.html`,
`assets/tiles_*/srovnani.html`, přepínač v debug panelu hry).

---

## 1. Zadání a co je rozhodnuté

Uživatel řeší **sjednocení grafiky** a **navazování dlaždic mapy**. Původní
zadání: generovat dlaždice přes AI je pracné, protože kontrola je jen přes
Gemini vision a generátor není exaktní render — ptal se, jestli jde designovat
cíleně přes renderer, nebo jestli si může promptovat sám.

**Rozhodnuto (route C — hybrid):**

- **základ mapy kreslit kódem** (foundry — krajina jako funkce světa),
- **AI jen na to, co šev neřeší**: alfa sprity (postavy, krajinné prvky)
  a ilustrace vrstvy 3 (příběhové obrázky),
- dlaždice z AI zůstávají jako **volitelný vzhled** (`malovaný`), ne jako základ.

**Vzhled, který uživatel vybral jako nejlepší (2026-09-17):** `kreslený` mapa
+ `kreslené` postavy + `kreslené` prvky. V debug panelu jsou to tlačítka
`kreslený` / `postavy kreslené` / `prvky kreslené`.

---

## 2. Zpětná vazba uživatele (2026-09-17) — DOSLOVNĚ

> Co se týče grafiky, tak AKTUÁLNÍ teď vypadá ze všech nejlépe a to v kombinaci
> s kreslenými postavami a kreslenými prvky.
>
> Malované prvky nikam nepasují, je to nepříjemné do očí. Foundry dlaždice nemají
> žádný detail. Malované dlaždice mají potenciál, ale neladí. "Současná" je jako
> bomba do očí. Pěkné obrázky, ale vůbec na sebe jednotlivé biomy nenavazují
> a obrázky nejsou vhodné pro mapu (něco jsou kapradiny, něco jsou kamínky - ani
> jedno se nehodí na náhled mapy, i kdyby krajiny, protože nedává smysl dívat se
> na detail malé věci, když se bavíme o celé krajině). Kronika ilustrace a kronila
> textura jsou podobné, ale s jinými obrázky. Mají potenciál v poušti a horách,
> ale nedovedu si představit jak to skutečně uplatni.
>
> Celkově největší problém je přechod mezi typy krajiny. Vypadá to jako
> poslepované výstřižky z časopisu.
> Problém se mi zdá je v tom, jaká perspektiva a detail se má na dlaždice použít.
> Pak jak přejít mezi jedním a druhým prostředím.

**Přeloženo do požadavků (tohle je zadání pro další práci):**

| # | Požadavek | Priorita |
|---|---|---|
| P1 | **Přechod mezi terény** nesmí vypadat jako slepenec; musí být plynulý a široký, ne ostrá hrana | **nejvyšší** |
| P2 | Rozhodnout a sjednotit **perspektivu a měřítko detailu** dlaždic (mapa = celá krajina, ne detail kapradí či kamínků) | vysoká |
| P3 | Foundry (kreslený základ) **nemá detail** — doplnit texturu/hmat, ale ne šum | vysoká |
| P4 | **Malované prvky nepasují** — buď je nezapínat (default `kreslené`), nebo zjistit proč (jiné měřítko/perspektiva/paleta než kreslené) | střední |
| P5 | Malované dlaždice „mají potenciál, ale neladí" — najít, co je potřeba sjednotit (měřítko, kontrast, hmat, přechody) | střední |
| P6 | Motiv kroniky má potenciál **v poušti a horách** — ověřit na těch terénech konkrétně | nízká |

---

## 3. Proč to tak vypadá — mapa kódu k P1 a P2

**Tři vzhledy mapy** (`G.tileStyle()` v `js/render/tiles_ai.js`, přepínač:
klávesa D → *Mapa — vzhled*):

| Vzhled | Kdo kreslí | Přechody mezi terény |
|---|---|---|
| `code` (kreslený) | `G.tileArt(name, v)` z `js/render/art.js`, dlaždice `ctx.drawImage` v `js/render/world.js:379` | **žádné** — každá dlaždice je samostatný obrázek, hrana terénu je ostrá |
| `ai` (malovaný) | `G.tileDraw` (`js/render/tiles_ai.js`) — výřez z fotky terénu na světových souřadnicích | **žádné** — každý terén je jiná fotka ⇒ „poslepované výstřižky" (přesně P1) |
| `foundry` | `G.foundryBase` + `G.foundryGround` + `G.foundryDeco` (`js/render/art.js`, volané z `world.js:369–390`) | **ano, ale jen pruh na hranici dlaždice**: `emit(1, …)` v `art.js` kolem řádku 887 (řízeno `G.FOUNDRY.edge`) |

Takže: **přechody dnes řeší jediný mechanismus — foundry pruh na hranici
dlaždice.** Je úzký a rovný, což je z definice vidět jako slepenec. Směr řešení
P1 (návrh, ne hotový kód):

1. přechod jako **zóna o šířce několika dlaždic** (ne jeden pruh), s hranicí
   **deformovanou šumem** (ne rovná linie mezi dlaždicemi),
2. v zóně **prolínat oba terény** (barva i hmat), ne jen kreslit pruh,
3. dtto pro `ai` vzhled: v zóně prolínat **dvě textury** (mechanismus pro
   prolnutí dvou textur už existuje — `G.AI_TILES.blend`, ale je to prolnutí
   dvou variant **téhož** terénu, ne dvou různých!),
4. ověřovat **měřitelně**: podíl „hranových" pixelů, které mají v okolí oba
   terény, a vizuálně přes `tools/tiles/preview.html` (mozaiky).

**Perspektiva a měřítko (P2)** je art-direction rozhodnutí, které je potřeba
udělat **před** další generací dlaždic: dlaždice má na 46 px v mapě reprezentovat
**povrch krajiny z ptačí perspektivy** (les = koruny stromů, ne kapradí; hory =
skalní masiv, ne jednotlivé kameny; tráva = plocha s odstíny, ne jednotlivé
květiny). To se promítne do `scripts/tile_prompts.txt` (viz §6).

---

## 4. Co je hotové (měřené)

**Dlaždice (nasazená sada `assets/tiles/`, používaná ve vzhledu `malovaný`):**

| Metrika | Hodnota | Limit |
|---|---|---|
| `wrap` (levý sloupec vs. pravý) | 1,93 | 2,5 |
| `seam/zrno` | 0,78 | 1,6 |
| perioda opakování | 6 dlaždic | ≥ 4 |
| odchylka barvy od cíle terénu | 3,66 | 22 |
| kontrast v 46 px | 13,1 | ≥ 5 |
| odlišnost terénů | 40,1 | ≥ 26 |
| ostrost pásu se švem (obsahová ref.) | **0,90** | ≥ 0,85 |

**Kandidátské sady** (obě projdou všemi kontrolami; `flatness` = kolik dlaždic
vypadá jako obrázek krajiny místo textury):

| Sada | flatness | odchylka od palety | seam/zrno | wrap | ostrost |
|---|---|---|---|---|---|
| `assets/tiles_kronika/final` (ilustrace+flatten) | **0/20** | **1,14** | 0,91 | 0,76 | 0,90 |
| `assets/tiles_kronika_tex/final` (textura+flatten) | **0/20** | 1,26 | 0,76 | 0,79 | 0,93 |
| bez `flatten` (raw) | 13/20 a 14/20 | — | — | — | — |

**Další hotové věci:**

- **foundry** (`js/render/art.js` §foundry, `docs/STYL_GRAFIKY.md` §11) — krajina
  ve světových souřadnicích: plán/paint split, ~224 štětců, 176 hran, 36 dekorací,
  0,15 ms/frame; ladí se v debug panelu (`G.setFoundry`).
- **jedna paleta** `G.PAL` v `js/render/art.js` = jediný zdroj barev; parsuje ji
  `scripts/tile_palette.py` (berou ji `grade_tiles.py`, `check-tiles.py`).
  Rozestup terénů 40,5 (dřív 8,3).
- **sprity**: `assets/units/base.png` + 6 archetypů, `assets/props/*` (10),
  barevně srovnané (`grade_art.py`), nádech palety 0,92–0,97.
- **ilustrace vrstvy 3**: `assets/art/*` (14) + API v `js/render/units_ai.js`
  (`G.illustration`, `G.illustrationForStory`, `G.illustrationForRole`, vypínač
  `settings.art`). **Zapojení do UI (`js/ui/ui.js`, `js/ui/title_screen.js`)
  ještě není hotové** — to je volný úkol z dřívějška, WIP v těch souborech je
  už commitnutý, takže nic neblokuje.
- **přepínače vzhledu** v debug panelu: vzhled mapy, vzhled postav, vzhled prvků,
  sada dlaždic, ladění foundry, měřítko mapy (46–80 px), výška postav.
- **testy**: headless-smoke 77, tile-window 10, **tile-sets 9**, tiles-preview 5,
  foundry 19, foundry-game 13, figures 12, props 11, units-ai 5, art-assets 5.
  `check-globals` 720 globálů / 59 souborů.

---

## 5. Kde co leží (a kam padá výstup generátorů)

```
assets/tiles/                 NASazená sada dlaždic (verzovaná) — hra ji čte
assets/tiles_local/*.png      surové rendry z ComfyUI 768 px (gitignored)
assets/tiles_<jméno>/         kandidátská sada z make_tile_set.py (gitignored)
    raw/                      co vrátil generátor (NEMAZAT — bez toho nejde přeladit)
    flat/                     po odečtení kompozice (flatten_tiles.py)
    graded/                   po srovnání barev na paletu (grade_tiles.py)
    final/                    PO ZACELENÍ ŠVU — tohle se ukazuje ve hře
    srovnani.html             srovnání s nasazenou sadou (compare_tiles.py)
assets/tiles_kronika/         kandidát „kronika-ilustrace" (gitignored), stejná struktura
assets/tiles_kronika_tex/     kandidát „kronika-textura" (gitignored), stejná struktura
assets/props/*.png            krajinné prvky (verzované), assets/props_kronika/ = kandidáti
assets/units/*.png            postavy (verzované), assets/units_gen/ = surové rendry
assets/art/*.png              ilustrace vrstvy 3 (verzované), assets/art_candidates/ = kandidáti
tools/tiles/preview.html      náhled z reálného kódu hry (kontaktní list, mozaiky, diagnostika)
scripts/tile_prompts.txt      VLASTNÍ PROMPTY (viz §6)
```

**Kde končí výstup `make_tile_set.py`:** vždy v `assets/tiles_<jméno>/final/`
(u jmen `kronika` a `kronika-tex` v odpovídajících kandidátských složkách).
Skript to na konci sám vypíše.

---

## 6. Jak si uživatel zadá vlastní prompt

```bat
cd /d C:\idle-realm
scripts\make_tile_set.cmd --name moje --prompts scripts\tile_prompts.txt
```

`scripts/tile_prompts.txt` je soubor s komentáři; formát `klíč = hodnota`:

- `template = … {subject} … {style} …` — společná šablona pro všechny terény,
- `grass = …` — celý vlastní prompt pro jeden terén (přebije šablonu).

Skript u každého terénu vypíše **délku promptu a jeho zdroj** (`vlastni` /
`sablona` / `vestaveny`) a varuje, když prompt přeteče ~350 znaků (Pollinations
delší odřezává). Bez `--prompts` se chová jako dřív.

Varianta bez cmd obalu (PowerShell):
```powershell
& 'D:\ComfyUI\venv-comfy\Scripts\python.exe' scripts\make_tile_set.py --name moje --prompts scripts\tile_prompts.txt
```

---

## 7. Jak si věci zobrazit

1. **V běžící hře:** otevřít `index.html`, klávesa **D** → *Mapa — vzhled* →
   `malovaný` + **sada dlaždic** (`současná` / `kronika-ilustrace` /
   `kronika-textura`). Chybějící složku hra odmítne přepnout (`G.setTileSet`).
2. **Vedle sebe:** `assets/tiles_kronika_tex/srovnani.html` (tři sady, každá
   dlaždice zopakovaná 4×4 + 1:1) — vygeneruje `scripts/compare_tiles.py`.
3. **Náhled z reálného kódu hry:** `tools/tiles/preview.html` (chce lokální
   server nebo Chrome s `--allow-file-access-from-files`, jinak canvas taintuje
   a přeskočí se diagnostika).
4. **Zeptat se na obrázek (Gemini vision):**
   `& "$env:USERPROFILE\.dsh\skills\vision\run.cmd" --mode asset <soubor>`
   — spouštět s `$env:PYTHONIOENCODING='utf-8'`, jinak spadne na cp1252.
   Je to **druhé oči, ne rozhodčí** (v jemných rozdílech je nekonzistentní).
5. `~\.dsh\skills\imagegen\run.cmd` (generování obrázků přes Gemini) **nejde** —
   free tier má u image modelů kvótu 0.

---

## 8. Otevřené úkoly v pořadí, jak je řešit

1. **P1 přechody terénů** (§3) — největší stížnost. Začít u foundry: zóna místo
   pruhu, hranice deformovaná šumem, prolínání obou terénů (barva + hmat).
   Měřitelně popsat (hranové pixely, šířka zóny) a ukázat uživateli v náhledu.
2. **P2 perspektiva a měřítko detailu** — rozhodnout s uživatelem (je to jeho
   oko) a promítnout do `scripts/tile_prompts.txt`; pak přegenerovat dlaždice.
   Argument pro diskusi: na 46 px nemá smysl kreslit jednotlivé kamínky; les má
   být korunová textura, hory masiv, tráva plocha s odstíny.
3. **P3 detail ve foundry** — doplnit hmat (jemná textura povrchu) tak, aby to
   nebyl šum; hlídat `kontrast v 46 px` a čas na frame (dnes 0,15 ms).
4. **P4 malované prvky** — porovnat měřítko a perspektivu malovaných prvků proti
   kresleným (nejspíš je potřeba generovat v jiném měřítku/perspektivě), nebo
   nechat default `kreslené` a téma uzavřít.
5. **Ilustrace vrstvy 3 do UI** — zapojit `G.illustrationForStory` do
   `G.showStoryModal` (`js/ui/ui.js`) a portrét role do `js/ui/title_screen.js`.
6. **P6 terénní motiv kroniky pro poušť a hory** — ověřit na těch dvou terénech.

---

## 9. Konvence a pasti (co se už jednou vymstilo)

- **Kontroly po každé fázi:** `scripts/check-globals.ps1` (musí „0 problems"),
  `scripts/check-actions.ps1`, `node test/headless-smoke.js`, testy dlaždic
  (`tile-window`, `tile-sets`, `tiles-preview`, `foundry`, `foundry-game`).
  Pak commit (Conventional Commits, česky) a push
  (`git -c http.sslBackend=openssl push origin main`).
- **Python na obrázky je jen** `D:\ComfyUI\venv-comfy\Scripts\python.exe`
  (pillow + numpy). Systémový Python 3.12 je nemá.
- **Textové soubory needituj přes PowerShell** (přepíše je v UTF-16).
  V cmd nastav `chcp 65001` + `PYTHONIOENCODING=utf-8`, nebo použij obal
  `scripts\make_tile_set.cmd`.
- **Past 28:** dobré `wrap` i `seam/zrno` neznamenají dobrý šev — zacelení švu
  dlaždici **rozmazalo** (ostrost pásu 0,47). Hlídej `tile_sharpness.py`.
- **Past 30:** nepřepisuj meziprodukt pipeline (`raw/`, `graded/`), jinak nejde
  nic přeladit a musí se generovat znovu.
- **Past 31:** ostrost měř s **obsahovou** referencí (`--ref raw`); proti mediánu
  zbytku dlaždice vyšla táž dlaždice jako 0,50 i 1,34.
- **Past 32:** **promptem se nedá řídit kompozice** — „no horizon, no sky, no
  central object" nezměnilo nic (13/20 → 14/20 dlaždic jako scéna). Řeší to až
  `flatten_tiles.py` (odečte velké plochy): 0/20.
- **Zacelení švu má cenu:** šev zmizí (wrap 27 → 0), ale lokální detail klesne
  (~10 %, u vody až 30 %). Odstraní to jen dlaždice, která šev nemá — tedy
  kreslený základ (foundry) nebo inpaint švu v ComfyUI (nezkoušeno).
- **Paralelní práce:** v repu může pracovat jiná session. Před commitem
  `git status` a stage **jen svoje soubory**.
- **Headless Chrome v tomhle sandboxu nejde** (blokuje mojo jmenné roury) —
  ověřuje se Node stuby + Python metrikami, ne renderem stránky.

---

## 10. Užitečné příkazy (zkopírovat)

```bat
REM nová sada dlaždic jedním příkazem (cmd; ~15 min)
scripts\make_tile_set.cmd --name moje --style kronika-tex

REM rychlý test (2 terény, ~2 min)
scripts\make_tile_set.cmd --name zkouska --only grass,water --variants 1

REM s vlastním promptem
scripts\make_tile_set.cmd --name moje --prompts scripts\tile_prompts.txt

REM srovnání sad vedle sebe (mozaiky 4x4)
python scripts\compare_tiles.py --old assets\tiles --new assets\tiles_moje\final --out assets\tiles_moje\srovnani.html
```

Detailní popis všech nástrojů a čísel je v `docs/STYL_GRAFIKY.md`
(§8 dlaždice, §11 foundry, §12 paleta, §18 kuchařka „jak si to vygenerovat sám").
