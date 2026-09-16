# Styl grafiky — definice a varianty

> **Datum:** 2026-09-15
> **Stav:** k rozhodnutí (nic se ještě negenerovalo)
> **Kontext:** idle RPG středověká fantasy, vanilla JS, procedurální canvas.
> Styl se ukládá k projektu jako `.style.txt` (server), takže ho používají
> **oba generátory** — harness i bot v telefonu.

---

## 1. Tvrdá omezení, kterými musí styl projít

Než se vybere styl, musí se vejít do reality téhle hry:

| Omezení | Hodnota | Co z toho plyne pro styl |
|---|---|---|
| Dlaždice | 96 px canvas → kreslené na **46 px** (× zoom) | detail musí být čitelný na 46 px, ne na 1024 |
| Postavy na mapě | ≈ **26 px** vysoké (scale `tilePx/44`), hlava r ≈ 3,5 px | rozhoduje **silueta a barva**, ne malba |
| Zoom | **volný 0,55–2,0** (`MIN_ZOOM`/`MAX_ZOOM`), smoothing zapnutý | **pixel art by potřeboval celočíselný zoom** (1×/2×/3×) a `imageSmoothingEnabled = false`, jinak se rozmaže |
| Rozlišení | DPR až 2 | assety musí být 2× cílové velikosti, nebo vektor |
| Sezóny a denní doba | `G.PAL`, `tickTime` | paleta musí být **tintovatelná** — ideálně z jedněch barev, ne s pevně zapečeným světlem |
| Mobil | canvas + dotyk, výkon | žádné velké sprity atlas, žádné 100 obrázků |
| Repo | MIT, bez build kroku | u AI assetů je potřeba doložit licenci generátoru |
| Generátor | `--size 32x32 --colors 16` (NEAREST + redukce palety) umí **skutečný pixel art** | pixel art je technicky dostupný, ale jen pro sprity/ikony, ne pro bezešvé dlaždice |

**Klíčové rozdělení:** hra má tři vizuální vrstvy s různými nároky.

1. **Mapa a dlaždice** — musí navazovat bez švů, tintovat se, pracovat s volným zoomem.
2. **Postavy a předměty na mapě** — 26 px, silueta a animace.
3. **Ilustrace a portréty** — velké, statické, klidně malované. Tady je AI nejlepší.

Nejlepší styl je takový, který má vrstvy 1–2 v kódu a vrstvu 3 z generátoru —
a **jednu paletu a jeden jazyk linek pro všechny tři**.

---

## 2. Kandidáti

### A) Battle Brothers (grim low-fantasy) — *tvůj favorit*
**Reference:** Overhype Studios. Nízká fantasy, žoldnéřská družina, žádná velkolepá magie.
**Paleta:** zemitá, silně odsátá — hnědošedá a olivová.
`#1e1b16` stín · `#3b3226` · `#55483a` · `#6b5b45` · `#7d6a52` · `#8f7f63`
olivová `#4a5138` / `#5c6344` · ocel `#6e7278` · rez `#7a4a32` · kost `#cfc3a8` · krev `#6d2f26`
**Linka:** tmavě hnědá až černá, silná, mírně roztřesená (ruční pero).
**Světlo:** jedno, teplé a špinavé; vysoký lokální kontrast, silné stíny.
**Textura:** prach, škrábance, plsť, kouř.
**Přežije 46 px?** Ano — protože je to hlavně **kontrast a silueta**. Detail se ztratí, ale dojem zůstane.
**Náklad:** střední (v kódu stačí paleta + obrysy + hatching overlay; ilustrace z AI).
**Riziko:** při špatné práci sklouzne k „blátivé hnědé kaši" — nutná disciplína v hodnotách (3 úrovně světla na dlaždici).

### B) Akvarel (malovaný vodovkami) — *tvůj favorit*
**Paleta:** světlá, vzdušná, 4–6 barev + bílá papíru: `#f2ece0` papír · `#8fa9b8` · `#9db08a` · `#d9b98a` · `#b8836a` · `#6b6a58`
**Linka:** žádná nebo jen velmi lehká, barva se „roztéká".
**Textura:** zrno papíru, tmavší okraje po zaschnutí (edge darkening).
**Přežije 46 px?** **Ne dobře** — akvarel žije z plochy a přechodů; na dlaždici 46 px zůstane jen bledá skvrna. Riziko: hra bude vypadat vybledlá a hůř čitelná (nebezpečí, vzácnost, frakce).
**Kde ano:** titulní obrazovka, ilustrace příběhu, portréty postav, hlavičky panelů — **vrstva 3**.
**Verdikt:** skvělé pro ilustrace, nedoporučuji jako základ mapy.

### C) Pixel art (16bit JRPG, top-down)
**Paleta:** 24–32 barev, vyšší saturace než A; `#2b2033` · `#4a3b52` · `#6d7f4e` · `#8fae5e` · `#c2a05a` · `#b0603f` · `#4a7f8c` · `#e8e0c8`
**Linka:** pevný 1px obrys, bez anti-aliasingu.
**Přežije 46 px?** Ano, ale **jen s celočíselným zoomem.** Volný zoom 0,55–2,0 by pixely rozmazal. Znamenalo by to zamknout zoom na 1×/2×/3× a vypnout smoothing — jinak to bude vypadat levně.
**Náklad:** vysoký — přepis vykreslování dlaždic (32×32 mřížka), ztráta tintování a volného zoomu, sprity z AI (skill umí `--size 32x32 --colors 16`).
**Verdikt:** největší změna chování hry; dělat jen když je pixel art opravdu cíl, ne prostředek.

### D) Pergamen a inkoust (stará mapa / kronika) ⭐ *můj tip*
**Reference:** středověká mapa světa + kronikářská kniha.
**Paleta:** `#efe3c8` pergamen · `#d9c7a1` · `#8a6f45` sépie · `#4a3a24` inkoust · `#7a2f26` pečeť · `#3e5641` les · `#5b6f7d` voda
**Linka:** inkoustová, tenká, s šrafováním pro stín (hatching) — **generuje se v kódu**.
**Světlo:** plošné, bez perspektivního stínování; hloubka šrafováním.
**Přežije 46 px?** Ano — šrafování na 46 px funguje jako textura, kontrast drží.
**Proč tip:** (1) téma je „usedlost a dědictví", mapa světa je doslova mapa; (2) šrafování a pečetě umí kód vygenerovat, takže konzistence je zdarma; (3) bohatě se doplňuje s AI ilustracemi (pergamenové scény); (4) tintování sezón = jiný odstín pergamenu, triviální.
**Náklad:** nízký až střední.

### E) Dřevěná desková hra / figurky (meeple diorama)
**Reference:** deskovka na plstěném stole; jednotky jako dřevěné figurky.
**Paleta:** teplé dřevo a barvy figurek: `#2e2721` stůl · `#8a6a44` · `#b58c58` · `#6d4b2f` · hráčské barvy `#a8503f` `#3f6d8a` `#6d8a4a` `#c2a05a`
**Linka:** tlustá, tmavá, jednotná.
**Přežije 46 px?** **Nejlépe ze všech** — ploché tvary a siluety jsou na malé velikosti nejčitelnější.
**Konzistence:** nejlevnější — jeden tvaroslovný jazyk (kvádr + oblouk), zvládne to i kód.
**Riziko:** vypadá „hravě", ne „grim". Nehodí se k dramatickým příběhovým scénám.

### F) Iluminovaný rukopis / vitráž
Zlatá plocha, silné černé olovo, heraldické barvy, zdobené rámy.
`#1b1a22` olovo · `#c9a227` zlato · `#7a2f3a` · `#2f5d7a` · `#4a7a3f` · `#efe6cf`
**Přežije 46 px?** Špatně — olovo a zlato potřebují plochu. **Výborné pro hlavičky panelů, erby a titulní obrazovku.**

### G) Dřevořez / lept (Doré, inkoust, Darkest Dungeon)
Křížové šrafování, papír, černá, dramatické světlo, siluety.
`#f0e8d8` papír · `#2a241c` · `#5a4f3e` · `#8a7a5e`
**Přežije 46 px?** Hraniční — šrafování na dlaždici splyne, ale jako **portréty, příběhové ilustrace a ikony předmětů** je to nejcharakterističtější volba pro grimdark.

### H) Vrstvený papír (papercraft diorama)
Ploché tvary s měkkými stíny, jemná textura papíru, teplá paleta.
Čitelné, levné, konzistentní. Méně „středověké", víc „pohádkové".

### I) Tapisérie / výšivka (Bayeux)
Plátno, stehy, ploché středověké postavy, vlněná paleta (`#b8a271` · `#7a3b2e` · `#3f5a7a` · `#6d7a3f` · `#c9bb94`).
**Přežije 46 px?** Ano, výborně (plochy + obrys ze stehů). **Tematicky skvělé pro dynastii/kroniku**, ale je to výrazná niche volba.

---

## 3. Srovnání

| Styl | Mapa (46 px) | Postavy (26 px) | Ilustrace | Konzistence | Náklad | Grim |
|---|---|---|---|---|---|---|
| A Battle Brothers | ✅ | ✅ | ✅ | střední | střední | ⭐⭐⭐ |
| B Akvarel | ❌ | ⚠️ | ⭐⭐⭐ | střední | střední | ⭐ |
| C Pixel art | ✅ (jen celočíselný zoom) | ✅ | ✅ | vysoká | **vysoký** | ⭐⭐ |
| D Pergamen a inkoust | ⭐⭐⭐ | ✅ | ⭐⭐⭐ | **zdarma** | nízký | ⭐⭐ |
| E Dřevěná deskovka | ⭐⭐⭐ | ⭐⭐⭐ | ⚠️ | **zdarma** | nízký | ⭐ |
| F Rukopis/vitráž | ❌ | ⚠️ | ⭐⭐ | střední | střední | ⭐⭐ |
| G Dřevořez | ⚠️ | ⚠️ | ⭐⭐⭐ | střední | střední | ⭐⭐⭐ |
| H Papírový diorama | ✅ | ✅ | ✅ | vysoká | nízký | ⭐ |
| I Tapisérie | ⭐⭐ | ⭐⭐ | ✅ | vysoká | nízký | ⭐⭐ |

---

## 4. Doporučené balíčky (kombinace, ne jeden styl na všechno)

### Balíček 1 — „Žoldnéřská kronika" (A + D, doporučuji)
- **Mapa:** pergamen a inkoust (D) — mapa světa je skutečná mapa, šrafování v kódu, sezóny = odstín pergamenu.
- **Postavy a sídla:** Battle Brothers (A) — odsátá zemitá paleta, silný tmavý obrys, 3 úrovně světla.
- **Ilustrace, portréty, titul:** AI v BB paletě (pergamenový podklad, inkoustová linka).
- **UI:** kronikářská kniha — karty jako listy, zlaté rámy, voskové pečeti u frakcí.
- Vychází vstříc tvému favoritu a zároveň drží čitelnost na 46 px.

### Balíček 2 — „Akvarelová kronika" (B + F jen v UI)
- Mapa zůstává **světle inkoustová** s akvarelovým nádechem (jinak se ztratí čitelnost nebezpečí).
- Titul, 7 příběhových scén, portréty a hlavičky panelů **akvarelem** (AI).
- Krásné a vzdušné, ale mapa bude nejslabší článek; hra ztratí „grim".

### Balíček 3 — „Stolní hra" (E + H)
- Celé to drží jeden plochý tvaroslovný jazyk, kód i AI se potkají nejsnáz.
- Nejlepší čitelnost a nejnižší náklad, nejmenší dramatičnost.

### Balíček 4 — „Plný pixel art" (C)
- Jen pokud chceš pixel art jako **cíl**: 32×32 dlaždice, `--size 32x32 --colors 16`, celočíselný zoom, vypnutý smoothing, přepis `render/art.js` a `render/world.js`.
- Nejvíc práce, nejvíc „indie" výsledek, ztráta volného zoomu a snadného tintování.

---

## 5. Co to znamená pro kód (ať se ví, do čeho jdeme)

| Vrstva | Balíček 1 (A+D) | Balíček 4 (pixel) |
|---|---|---|
| `render/art.js` palety | přepsat `G.PAL` na sépiovou/zemitou (+ hatch overlay) | dlaždice 32×32 z generátoru nebo kódu |
| Přechody dlaždic | auto-tiling (okraje lesa, pěna u břehů) — pomůže všude | nutné, jinak švy |
| Zoom | zůstává volný | jen 1×/2×/3×, `imageSmoothingEnabled=false` |
| Sezóny/denní doba | tint z palety (zdarma) | obtížnější (zapečené světlo) |
| Postavy | `drawFigure` dostane BB obrys + 3 tóny | sprite sheet + chůzové framy |
| Ilustrace | AI (titul, 7 scén, portréty) | AI pixel (jiný prompt) |
| UI (CSS) | pergamenové karty, zlaté rámy, pečeti | pixel fonty, 9-slice rámy |

---

## 6. Návrh stylu pro generátor (`.style.txt`)

Pro Balíček 1 by se do projektu uložilo něco jako:

> `grim medieval low-fantasy, Battle Brothers inspired, desaturated earthy palette
> (browns, olive, dull steel, bone), strong dark ink outline, one warm dirty light
> source, high local contrast, painterly texture with grime and scratches, aged
> parchment background, muted heraldry accents, no bright saturation, no anime,
> no modern elements, illustration for a medieval idle RPG`

Pro Balíček 2 by se vyměnilo jádro za:
> `hand-painted watercolor on textured paper, soft washes with darker dried edges,
> visible paper grain, light minimal linework, airy limited palette, storybook
> medieval fantasy, no heavy black outlines`

Pro Balíček 4:
> `16-bit SNES-era pixel art, top-down 3/4 view, 32x32 tile, limited 24-color
> palette, 1px dark outline, no anti-aliasing, medieval low-fantasy`

Styl se nastaví příkazem `--set-style` a **platí i pro bota v telefonu**.

---

## 7. Další krok

**Stav 2026-09-16: rozhodnuto.** Uživatel zvolil **cestu C (hybrid)** — podklad
a přechody mapy z kódu, AI jen na alfa sprity a ilustrace (§8). Stage 0 (bezešvá
mapa + měření) je hotový; tím se i rozhodování o *stylu* zlevnilo, protože
varianta se teď vygeneruje za sekundu a změří čísly.

Zbývá:

1. **Vybrat balíček vzhledu** — doporučení pořád platí (**1 — Žoldnéřská
   kronika**: pergamenová mapa + Battle Brothers postavy). Volba se ale nově
   projeví hlavně **paletou a štětci jednoho souboru**, ne přepisem pipeline.
2. Uložit styl k projektu (`--set-style`) pro generátor ilustrací.
3. Vygenerovat **testovací trojici** (1 dlaždice lesa, 1 postava, 1 příběhová
   ilustrace) a porovnat vedle sebe.
4. **Stage 1 — „foundry"** (§8.5): světová pole, toroidní razítkování, dekorace,
   přechody terénů; teprve pak sídla a postavy.

---

## 8. Dlaždice: měřitelně bezešvá mapa *(přepsáno 2026-09-16)*

**Rozhodnutí uživatele:** jde se **cestou C — hybrid**: podklad, přechody a
dekorace mapy z kódu (Stage 1 = „foundry"), AI jen na alfa sprity/propsy a
vrstvu 3 (titul, příběhové scény, portréty). Důvody jsou v §8.2.

**Hotovo:** `js/render/tiles_ai.js` + přepínač `settings.tileStyle = 'code' | 'ai'`
v menu ☰ („🎨 Vzhled mapy"). Vzhled dlaždice má hra na dvou místech: malovanou
kreslí `G.tileDraw` (potřebuje světové souřadnice, protože je to výřez z torusu)
a kreslenou `G.tileArt` (záložní cesta). **Fallback je vždy funkční**, takže
chybějící obrázky hru nerozbijí.

Sada assetů: `assets/tiles/<terén>-<1|2>.jpg` (10 terénů × 2 textury, FLUX přes
Pollinations — zdarma, bez klíče). Textury se **nasadí jen po průchodu
`scripts/seamless_tiles.py`** (udělá z nich torusy) — viz §8.3.

### 8.1 Dvě věci, které dlaždice z generátoru nutně potřebují

1. **Barevná korekce podle terénu.** Model vrátil „vodu" olivově zelenou
   (`#474918`) a „sníh" tmavý (jas 97) — terén se pak nedá poznat. Řešení:
   průměr dlaždice se posune na cílovou barvu terénu (`TARGET` v `tiles_ai.js`).
   Ověřeno čísly — všech 10 terénů přesně na cíli (voda `53,92,122`, sníh
   `194,201,207`, hora `108,108,106`).
2. **Torus, ne jen „pěkná textura".** Bezešvost je matematická vlastnost, kterou
   generátor nedodá (viz §8.2) — dopočítá ji `scripts/seamless_tiles.py`.
   Aby se textura po mapě neopakovala, posouvá se okno výřezu po světě; volitelně
   se prolínají **dvě textury téhož terénu** váhou měnící se ve světovém prostoru.

### 8.2 Proč to předtím nešlo (změřeno, ne dohad)

Původní zápis tady tvrdil „švy vyřešeny seamless generováním (metrika 1,59,
baseline kódu 5,51)". To číslo nebylo v repu k dohledání a realita byla jiná:

| Co se měřilo | Naměřeno |
|---|---|
| `wrap` AI dlaždic (levý sloupec vs. pravý; 255 = plný rozdíl) | **27,9** |
| šev v mozaice (staré schéma: 8 variant se zrcadlením a jasem) | **23,1** |
| `vignette()` v `art.js` — per-dlaždicové světlo samo o sobě | krok **11,5** jasu na hranici |

Příčiny byly čtyři a všechny konstrukční, ne „kvalita generátoru":

1. **Dlaždice nebyla torus.** Model „bezešvý" obrázek nevygeneruje — vlastnost
   (levý sloupec = pravý) buď platí, nebo ne. Musí se dopočítat.
2. **Světlo se počítalo v souřadnicích dlaždice** (`vignette`), takže na každé
   hranici skočilo o 11 úrovní jasu a mapa dostala šachovnici. Světlo musí být
   funkcí **světa**.
3. **Prvky se kreslily v lokálních souřadnicích** a na hranici se uřízly.
4. **Ověřování bylo verbalní** (Gemini vision): na dlaždici 46 px nic nevidí a
   hlavní artefakt — opakování přes 64×48 dlaždic — v jednom obrázku není vidět.
   V repu nebyl jediný opakovatelný metrický test.

### 8.3 Co je implementováno

**Dlaždice už není obrázek, ale okno do torusu, vzorkované ve světových
souřadnicích.** Tři kroky:

1. **Assety jsou skutečné torusy** — `scripts/seamless_tiles.py` je dopočítá
   deterministicky: posun o polovinu (nespojitost se přestěhuje doprostřed),
   zacelení středního kříže proložením rozmazanou kopií v pásu ±28 px, a
   srovnání protilehlých okrajů v pásu 16 px (tím je wrap **přesně** 0).
   Naměřeno: wrap **27,91 → 0,00**, ztráta ostrosti jen **12–18 %**
   (pro srovnání: prosté zrcadlové prolnutí ztratí 45 %).
2. **Kreslení je výřez** (`G.tileDraw`): okno 128 px (= 1/6 textury 768 px) se
   posouvá o jedno okno na dlaždici světa. Sousední dlaždice jsou tedy sousední
   výřezy téhož spojitého obrazu — šev nemůže vzniknout. Naměřeno: seam/zrno
   **0,74**, wrap **1,88**, perioda 6 dlaždic.
3. **Per-dlaždicová vignette je pryč** z `art.js` (krok 11,5 jasu na hranici).

**Volitelné prolnutí dvou textur** (`G.setTileBlend`, periody 29/43 dlaždic):
perioda opakování zmizí úplně (**period None** — v mozaice 16×16 se nezopakuje),
cena je ~13 % kontrastu tam, kde je prolnutí půl na půl (zrno 1,86 → 1,62).
Výchozí hodnota je 0; kterou použít, se má rozhodnout **okem** v náhledu.

### 8.4 Jak se to teď ověřuje (místo vision)

| Nástroj | Co dělá |
|---|---|
| `scripts/check-tiles.py` | metriky: `wrap`, `seam/zrno`, `perioda`, barva vs. cíl terénu, kontrast v 46 px, odlišnost terénů. Umí nasimulovat schéma skládání (`random`/`parity`/`sliding`/`sliding2`) a uložit mozaiku jako PNG. |
| `tools/tiles/preview.html` | náhled v prohlížeči z **reálného kódu hry**: kontaktní list terénů (46/64/192 px), mozaiky 12×12, detaily švů 2× zvětšené, slider prolnutí, diagnostika s čísly. Otevři přes lokální server, nebo Chrome s `--allow-file-access-from-files` (jinak canvas taintuje a měření se přeskočí). |
| `node test/tile-window.js` | geometrie kreslení: okna navazují, obtáčejí se na torusu, nepřetékají, fallback na kreslenou cestu, váhy prolnutí sčítají na 1. |
| `node test/tiles-preview.js` | náhledová stránka se spustí bez chyby a spočítá diagnostiku. |
| `scripts/seamless_tiles.py --check` | jen změří `wrap` a ztrátu ostrosti, nic nemění. |

**Dvě klíčové lekce k metrice** (jinak se měří nesmysly):

- Absolutní skok na hranici dlaždice nic neříká: když dlaždice navazují spojitě,
  je skok stejně velký jako **zrno** textury. Měří se proto poměr `seam / zrno`
  (limit 1,6).
- Šev se musí měřit na **nativním** rozlišení assetu — po zmenšení se zamaskuje.

### 8.5 Otevřené (do Stage 1)

- **Perioda 6 dlaždic** v malované cestě (okno je 1/6 textury). Správné řešení
  není další obrázek, ale **světová dekorace z kódu** (trsy, kameny, rákosí) —
  ta opakování rozbije, protože je funkce světa.
- **Kreslená cesta** (`art.js`, výchozí vzhled) pořád kreslí prvky uříznuté na
  hranici. Náhled porovnává dvě varianty: dnešní (varianty náhodně) vs.
  **zrcadlení podle parity** (šev 0 i pro dlaždice, které netileují, ale perioda
  2 = kaleidoskop). Volba je na očích uživatele, čísla jsou v náhledu.
- **Paleta má blízké terény**: grass vs. hills i grass vs. road jsou od sebe jen
  **22,1** (L2 v RGB). Na 46 px se pletou. Ve Stage 1 je potřeba rozestupy
  zvětšit (posunout odstín/hodnotu), ne je jen „nějak vybarvit".
- **Headless Chrome v tomhle sandboxu nespustíš** (blokuje mojo jmenné roury),
  takže ověřování je postavené na Node + Python, ne na renderu stránky.

### 8.5 Pasti při generování (ověřeno, obsah beze změny)

- **Pollinations odřezává dlouhé prompty** — u promptu ~800 znaků zůstal jen
  stylový blok a vyšly 4× „dvě postavy s mečem". Drž prompt **do ~350 znaků**
  a **subjekt dej na začátek**.
- **Víc panelů v jednom obrázku model nezvládá** — ze 4 promptů na „3 panely"
  vyšly 2 správně, jeden jako 4 panely a jeden bez panelů. Generuj **jeden
  asset na obrázek**.
- **Pixel art se negeneruje, ale dopočítá**: zmenšit na 32×32 → zredukovat na
  16 barev → zvětšit NEAREST. Ověřeno: 11 barev, 0 neostrých bloků 8×8.
- **Gemini API neumí generovat obrázky na free tieru** (`limit: 0` u všech image
  modelů); text a vision fungují. Alternativa zdarma: Pollinations (bez klíče),
  nebo lokálně ComfyUI na Radeonu.

---

## 9. Lokální generování na RX 6600 — ✅ *funkční setup*

**Stav:** ComfyUI 0.36.0 běží na `D:\ComfyUI`, server `http://127.0.0.1:8188`,
zařízení `AMD Radeon RX 6600 : native`, VRAM 7,98 GB. Ověřeno reálným
vygenerováním dvou dlaždic (768×768, SDXL Juggernaut XL, 20 kroků):
**~105–144 s na obrázek** (první je pomalejší kvůli načtení 6,6 GB modelu).

### Funkční postup (tohle je ta cesta, co vyšla)

1. **Python 3.12** (per-user, bez adminu): `python-3.12.10-amd64.exe /quiet
   InstallAllUsers=0 PrependPath=1 Include_test=0 Include_launcher=0`
2. `python -m venv D:\ComfyUI\venv-comfy`
3. **PyTorch s ROCm 10 a kernely pro gfx1032** (klíčové!):
   `pip install --index-url https://stable.repo.amd.com/rocm/whl-next/
   "torch[device-gfx1032]" "torchvision[device-gfx1032]" torchaudio`
   → nainstaluje `rocm-sdk-device-gfx1032` a `amd-torch-device-gfx1032`
   (celkem ~1,1 GB). **HIP SDK ani ZLUDA nejsou potřeba.**
4. `git clone https://github.com/comfyanonymous/ComfyUI.git` + `pip install -r requirements.txt`
5. Model do `ComfyUI\models\checkpoints`, pak `python main.py --port 8188`.

### Dvě slepé uličky (nešlapat do nich)

- **Oficiální `ComfyUI_windows_portable_amd.7z` na RX 6600 NEFUNGUJE**: obsahuje
  GPU kernely jen pro `gfx1100/1101/1102/1150/1151/1200/1201` — **žádný gfx10xx**
  (RDNA2). Ověřeno rozborem 393 `.hsaco` souborů. Navíc jeho embedded Python
  nemá `venv` a jeho `offload-arch.exe` je nepodepsaný.
- **Smart App Control blokuje nepodepsané ROCm nástroje** (`offload-arch.exe`
  v portable) → `torch.cuda.is_available()` spadne s access violation.
  Cesta přes pip (`stable.repo.amd.com`) tím netrpí.

### Podpora gfx1032 (RX 6600)

Podle [SUPPORTED_GPUS.md](https://github.com/ROCm/TheRock/blob/main/SUPPORTED_GPUS.md)
má `gfx1032` na Windows **Build ✅ / Sanity Tested ✅ / Release Ready ✅**.
Ceny: `rocm-sdk-core` ~700 MB, `rocm-sdk-libraries` ~100 MB,
`rocm-sdk-device-gfx1032` ~50 MB, torch ~100 MB.

### Ovládání

```powershell
# start (odpojeně, aby přežil zavření terminálu)
Start-Process 'D:\ComfyUI\venv-comfy\Scripts\python.exe' -ArgumentList 'main.py','--port','8188' `
  -WorkingDirectory 'D:\ComfyUI\ComfyUI' -WindowStyle Hidden
# GUI: http://127.0.0.1:8188   (PID se ukládá do D:\ComfyUI\_download\comfy.pid)
```

---

## 10. Malované postavy (AI sprity) — *implementováno*

Stejný přepínač „🎨 Vzhled" zapíná i bitmapové postavy na mapě (kromě dlaždic),
takže mapa i postavy drží jeden malovaný styl.

- **Generování:** `scripts/gen_units_local.py` — ComfyUI + SDXL, 6 archetypů
  (`mercenary`, `villager`, `blacksmith`, `hunter`, `scout`, `merchant`),
  768×768, tmavá postava na světlém krémovém pozadí `#f0e8d8`.
- **Odstranění pozadí:** `scripts/process_units.py` — **prahování jasu** (porovná
  střed vs. okraj → zjistí, jestli je postava tmavší nebo světlejší než pozadí,
  pak prahuje a nechá největší souvislou oblast uprostřed). Výstup = průhledné
  PNG, výška 96 px.
- **Vykreslení:** `js/render/units_ai.js` (mapuje profesi → archetyp) + `drawAiFigure`
  v `world.js` (flip podle směru, bob). Fallback = kódové `drawFigure`.

### Pasti (ověřeno)

- **Model ignoruje „plain cream background".** Juggernaut XL u „hunter" vygeneroval
  tmavou lesní scénu místo krémového podkladu. Řešení: negativní prompt
  `forest, trees, landscape, vignette, scenery, dark background` + výběr kandidáta
  podle jasu okraje (okraj > 140 = světlé pozadí).
- **Flood-fill od okraje nefunguje** na gradientu pozadí (krém jde 148→217 jasu
  shora dolů) ani když postava sahá k okraji. Proto se používá prahování jasu,
  ne barevná vzdálenost k okraji.
- **GrabCut je nestabilní** (stejný obrázek dá 17 % vs. 48 % popředí podle posunu
  obdélníku o 1 %), proto se nepoužívá.

### Otevřené: jednotný vzhled postav

Postavy jsou zatím každá jiná (postava, vybavení, zbraň). Plán na sjednocení
viz `docs/HANDOFF.md` — všichni na jednom základním modelu + ikona role (erb)
+ jen zbroj/oblečení, žádná zbraň.
