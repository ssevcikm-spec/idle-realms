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

**Stav 2026-09-16: balíček VYBRÁN — „Žoldnéřská kronika" (A + D).** Uživatel
zvolil pergamenovou mapu s inkoustem (D) a odsáté zemitě postavy (A). Paleta je
nasazená (§17), dlaždice i sprity přegradované, mapa je čitelnější než předtím.

Zbývá doladit:

1. **Linky a šrafování** — na nich pergamen stojí; paleta sama čitelnost drží
   (rozestup 40,5), ale „inkoustový" ráz dodá teprve linka.
2. **Vybrat a nasadit sprity v pergamenovém motivu** — ✅ **kandidáti hotoví**
   (§16.2): `assets/props_kronika/` (9 prvků + základní postava) se srovnávacím
   listem `index.html`; zbývá vybrat okem a přepsat soubory. Dlaždice se stejným
   postupem (`gen_tiles_local.py` nebo Pollinations → `grade_tiles.py` →
   `seamless_tiles.py`).
3. **Ilustrace vrstvy 3** (titul, 7 příběhových scén, portréty) — ✅ **hotové**
   (§14.4: `scripts/gen_art.py`, 14 obrazků v `assets/art`), zbývá je napojit
   do hry (§14.5).
4. **Foundry doladit okem** (debug panel **D**) a přesunout jeho kód z `art.js`
   do `js/render/foundry.js`.

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
   zacelení středního kříže proložením rozmazanou kopií v pásu ±16 px,
   **vrácení textury** do zaceleného pruhu (`grain_pass`) a srovnání
   protilehlých okrajů v pásu 16 px (tím je wrap **přesně** 0).
   Naměřeno: wrap **27,10 → 0,00**, ztráta ostrosti celé dlaždice 7–11 %.

   Zacelení samo o sobě míchá rozmazání, takže uprostřed dlaždice zůstane
   rozmazaný pruh — v prvním nasazení (pás ±28 px) měl **0,47** ostrosti okolí
   (`scripts/tile_sharpness.py`) a **Gemini vision** ho popsal jako „extrémně
   výrazný rozmazaný kříž přes střed". `grain_pass` proto přidá do stejné masky
   **jen vysokofrekvenční** složku vzorku odjinud z dlaždice: nízké frekvence
   (to, co drží šev neviditelný) zůstanou z rozmazané verze, ostrost se vrátí.
   Maska je na okrajích nulová (exp(−(384/16)²) ≈ 0), takže wrap zůstává přesně 0.

   **Množství je adaptivní** (`--grain auto`, výchozí). Pevné číslo fungovalo pro
   jednu sadu a druhou (hladší textury) přeostřilo — naměřeno **1,40**, tedy
   rušivější pruh, než jaký vznikl. `auto` spočítá dávku pro každou dlaždici:
   energie nezávislých složek se sčítá ve druhé mocnině (`ref² = base² + (a·inc)²`),
   takže se dávka dopočítá tak, aby pás dorovnal referenci. Referencí je
   **posunutá raw dlaždice** (stejné místo, jen nezacelené) — medián zbytku
   dlaždice měří u nehomogenních textur (les, hory) spíš obsah než vadu.

   **Poctivá čísla** (`tile_sharpness.py --ref <raw>`, tedy „kolik detailu hojení
   na tom místě ubralo"): dlaždice ve hře **0,90** (5 z 20 pod 0,85, nejhorší
   water-1 **0,68**), kandidáti kroniky **0,89** (nejhorší snow-1 **0,61**).
   Proti mediánu zbytku dlaždice vyjde 0,94, respektive 1,34 — proto je obsahová
   reference směrodatná. Seam/zrno 0,78 (kronika 1,00), wrap 1,93 (kronika 0,72).

   **Co zůstává:** rozmazání nízkých frekvencí je nutné, aby schod po posunu
   zmizel — vypůjčené zrno vrátí texturu, ale ne **obsah** (u sněhu a vody je
   místní struktura bohatší než vzorek odjinud, takže pás zůstane o 10–30 %
   chudší). Vision to vidí jako „jemnou šmouhu". Odstraní to jen dlaždice, která
   šev vůbec nemá:
   - **kreslený základ ve foundry** (§11) — žádný šev nevzniká, je to route C;
   - **inpaint švu** (ComfyUI je nainstalované, `scripts/gen_tiles_local.py`) —
     místo rozmazání se kříž nechá domalovat modelem, detail zůstane.
2. **Kreslení je výřez** (`G.tileDraw`): okno 128 px (= 1/6 textury 768 px) se
   posouvá o jedno okno na dlaždici světa. Sousední dlaždice jsou tedy sousední
   výřezy téhož spojitého obrazu — šev nemůže vzniknout. Naměřeno: seam/zrno
   **0,74**, wrap **1,88**, perioda 6 dlaždic.
3. **Per-dlaždicová vignette je pryč** z `art.js` (krok 11,5 jasu na hranici).

**Volitelné prolnutí dvou textur** (`G.setTileBlend`, periody 29/43 dlaždic):
perioda opakování zmizí úplně (**period None** — v mozaice 16×16 se nezopakuje),
cena je ~13 % kontrastu tam, kde je prolnutí půl na půl (zrno 1,86 → 1,62).
Výchozí hodnota je 0; kterou použít, se má rozhodnout **okem** v náhledu.

### 8.4 Jak se to teď ověřuje (metriky + vision)

| Nástroj | Co dělá |
|---|---|
| `scripts/check-tiles.py` | metriky: `wrap`, `seam/zrno`, `perioda`, barva vs. cíl terénu, kontrast v 46 px, odlišnost terénů. Umí nasimulovat schéma skládání (`random`/`parity`/`sliding`/`sliding2`) a uložit mozaiku jako PNG. |
| `scripts/tile_sharpness.py` | ostrost pásu kolem středu — hlídá, že se šev nevyřešil rozmazáním (`--limit`, výchozí 0,85). S `--ref <raw adresář>` měří **obsahovou** referenci (stejné místo z raw dlaždice) = „kolik detailu tu hojení ubralo"; bez ní proti mediánu zbytku dlaždice. |
| `scripts/compare_tiles.py` | srovnávací HTML dvou sad dlaždic: každá dlaždice **zopakovaná 4×4** (v jednom obrázku šev nepoznáš) + 1:1. Pro „líbí / nelíbí" rozhodnutí uživatele. |
| `scripts/tile_flatness.py` | pozná dlaždici, která není plocha textura, ale **obrázek scény** (horizont/obloha, ústřední motiv). Ostatní metriky takovou dlaždici chválí — je ostrá, bezešvá a v paletě. Limity kalibrované na přijaté sadě. |
| `scripts/flatten_tiles.py` | odečte z dlaždice **velké plochy** (kompozici) a vrátí průměr — když AI vyrobila scénu místo textury. Do pipeline patří před `grade_tiles.py`; měřený účinek 13/20 → 0/20 (§8.6). |
| `tools/tiles/preview.html` | náhled v prohlížeči z **reálného kódu hry**: kontaktní list terénů (46/64/192 px), mozaiky 12×12, detaily švů 2× zvětšené, slider prolnutí, diagnostika s čísly. Otevři přes lokální server, nebo Chrome s `--allow-file-access-from-files` (jinak canvas taintuje a měření se přeskočí). |
| `node test/tile-window.js` | geometrie kreslení: okna navazují, obtáčejí se na torusu, nepřetékají, fallback na kreslenou cestu, váhy prolnutí sčítají na 1. |
| `node test/tiles-preview.js` | náhledová stránka se spustí bez chyby a spočítá diagnostiku. |
| `scripts/seamless_tiles.py --check` | jen změří `wrap` a ztrátu ostrosti, nic nemění. |
| `scripts/seamless_tiles.py --grain-pass` | vrátí texturu do **už zacelených** dlaždic (bez posunu) — pro sady, které prošly starým `heal`. |
| `scripts/tile_palette.py` | **jediný zdroj barev terénů** — parsuje `G.PAL` z `art.js`; berou ho `grade_tiles.py` i `check-tiles.py`. |
| skill `vision` (Gemini) | **od 2026-09-17 k dispozici** — pošle dlaždici modelu a vrátí text: vidí vady, které metriky neměří (deformované tvary, „rozmazaný kříž"). Není to rozhodčí: v jemných rozdílech je nekonzistentní, ber ho jako druhé oči vedle čísel. |

**Tři klíčové lekce k metrice** (jinak se měří nesmysly):

- Absolutní skok na hranici dlaždice nic neříká: když dlaždice navazují spojitě,
  je skok stejně velký jako **zrno** textury. Měří se proto poměr `seam / zrno`
  (limit 1,6).
- Šev se musí měřit na **nativním** rozlišení assetu — po zmenšení se zamaskuje.
- `seam/zrno` ani `wrap` nepoznají, že je dlaždice **rozmazaná** (rozmazaný
  přechod je hladký, takže šev „vypadá" dokonale). Proto se přidala měřená
  ostrost pásu (`tile_sharpness.py`) a vizuální kontrola visionem.

### 8.5 Otevřené (do Stage 1)

- **Perioda 6 dlaždic** v malované cestě (okno je 1/6 textury). Správné řešení
  není další obrázek, ale **světová dekorace z kódu** (trsy, kameny, rákosí) —
  ta opakování rozbije, protože je funkce světa. **Foundry tuhle cestu realizuje
  (§11); malovaná cesta `ai` periodu 6 pořád má.**
- **Kreslená cesta** (`art.js`, výchozí vzhled) pořád kreslí prvky uříznuté na
  hranici. Náhled porovnává dvě varianty: dnešní (varianty náhodně) vs.
  **zrcadlení podle parity** (šev 0 i pro dlaždice, které netileují, ale perioda
  2 = kaleidoskop). Volba je na očích uživatele, čísla jsou v náhledu.
- **Paleta má blízké terény**: grass vs. hills i grass vs. road jsou od sebe jen
  **22,1** (L2 v RGB). Na 46 px se pletou. Ve Stage 1 je potřeba rozestupy
  zvětšit (posunout odstín/hodnotu), ne je jen „nějak vybarvit".
- **Headless Chrome v tomhle sandboxu nespustíš** (blokuje mojo jmenné roury),
  takže ověřování je postavené na Node + Python, ne na renderu stránky.

### 8.6 Dlaždice z AI: **prompt to neřídí, struktura ano** (změřeno 2026-09-17)

Zkoušelo se přenést pergamenový motiv kroniky (který uspěl u spritů, prvků
a ilustrací) i na dlaždice terénu — 20 dlaždic přes Pollinations
(`scripts/gen_tiles.py`), stejný postup jako u nasazené sady. Problém: generátor
místo ploché textury vyrobí **scénu** (horizont s oblohou, ústřední motiv,
vinětaci). Všechny dosavadní metriky ji chválí — je ostrá, bezešvá a v paletě.

Na to je `scripts/tile_flatness.py` (`horizont`, `stred`, `makro`), s limity
kalibrovanými na sadě, kterou uživatel přijal (její nejhorší hodnoty 0,023
a 0,059 → limit 0,045 a 0,075).

**Dva pokusy o prompt a jeden strukturální — měřeno:**

| Sada | dlaždic jako scéna | odchylka od palety | seam/zrno | wrap |
|---|---|---|---|---|
| nasazená (ComfyUI, bez stylu) — *přijatá* | **0 / 20** | 3,66 | 0,78 | 1,93 |
| kronika, ilustrační styl | 13 / 20 | 1,67 | 1,00 | 0,72 |
| kronika, styl popsaný jako **textura** | **14 / 20** | — | — | — |
| kronika ilustrační **+ `flatten_tiles.py`** | **0 / 20** | **1,14** | 0,91 | 0,76 |
| kronika texturová **+ `flatten_tiles.py`** | **0 / 20** | 1,26 | 0,76 | 0,79 |

Takže: **přepsat prompt tak, aby zněl jako textura („no horizon, no sky, no
central object"), vůbec nepomohlo** — 14 z 20 dlaždic bylo pořád scén. Co
pomohlo, je **odečíst z dlaždice velké plochy** (`scripts/flatten_tiles.py`):
horizont, obloha i ústřední motiv jsou nízké frekvence, takže se odečtením silně
rozmazané kopie ztratí a zůstane jen textura (zrno, hmat, šrafování). Sada tím
spadne z 13/20 na **0/20** a zůstane v paletě (odchylka 1,14 — nejlepší dosud).

**Cena a co z toho plyne:** flatten sebere i **střední** frekvence, takže klesne
kontrast v 46 px (5,8–6,6 proti limitu 5,0; nasazená sada má 13,1). Velké plochy
tedy dlaždice nenesou — a to je v pořádku, protože je má nést **foundry ve
světových souřadnicích** (§11). Pořadí pipeline pro AI dlaždice je proto
`gen` → **`flatten`** → `grade_tiles.py` → `seamless_tiles.py`.

**Závěr:** AI dlaždice jdou vyrobit, ale jen když se kompozice odečte strojově
a měří se `tile_flatness.py`; promptem se to řídit nedá. Motiv kroniky na ploše
mapy tím pádem funguje, ale jeho charakter je jen v textuře — kreslený foundry
zůstává cílový stav pro základ mapy.

### 8.7 Pasti při generování (ověřeno, obsah beze změny)

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

Postavy jsou zatím každá jiná (postava, vybavení, zbraň). Koncept sjednocení je
**hotový pro kreslený vzhled** — viz §13 (jeden model + erb role + zbroj, bez
zbraně); zbývá **regenerovat sadu malovaných spritů** v tomtéž konceptu.

---

## 11. Foundry — krajina ve světových souřadnicích *(Stage 1, hotovo 2026-09-16)*

**Co to je:** třetí vzhled mapy vedle `code` a `ai` — `settings.tileStyle =
'foundry'` (přepínač v debug panelu **D** → „Mapa — vzhled"). Krajina se
nekreslí po dlaždicích, ale jako **funkce světa**:

| Vrstva | Co dělá | Kde |
|---|---|---|
| Plochý podklad | barva terénu na dlaždici (`fillRect`) | `G.foundryBase` |
| Světové štětce | dauby na světové mřížce 1 dlaždice, hash + jitter, velkoplošné světlo z `foundryField` | `G.foundryGround` |
| Přechody terénů | pás na každé hraně, kde se mění terén — pěna u vody, závěj u sněhu, obruba jinde | `G.foundryGround` |
| Dekorace | trsy, kamínky, rákosí, vyjeté koleje, závěje (`DECO_DENSITY` podle terénu) | `G.foundryDeco` |

**Proč to řeší obě nemoci dlaždic:**

1. **Šev nemůže vzniknout** — prvek přes hranici dlaždice je prostě prvek na
   svém světovém místě; kreslí se přes celou viditelnou oblast naráz, takže se
   nic neřeže ani neopakuje na hranici.
2. **Krajina se neopakuje** — umístění i barva pocházejí z 32bitového hashe
   světových souřadnic (`fhash`), který nemá krátkou periodu. Ověřeno
   autokorelací: |korelace| < 0,5 pro všechny posuny 1–24 dlaždic.

**Jak je to postavené (a proč):** plánování je oddělené od kreslení.
`G.foundryOps(view, emit)` je **čistá funkce** — žádný canvas, žádné řetězce,
jen čísla — takže se dá ověřit v Node bez prohlížeče. `G.foundryGround` a
`G.foundryDeco` jsou jen „paintery", které plán překreslí.

| Nástroj | Co ověřuje |
|---|---|
| `node test/foundry.js` (13 kontrol) | determinismus, **ukotvení ve světě** (posun kamery posune prvky přesně o posun — kdyby se hashoval screen, krajina by „plavala"), přesné pokrytí mřížky, žádná perioda, každá hrana právě jednou, nic mimo mapu, rozpočet prvků, všech větví kreslení |
| `node test/foundry-game.js` (9 kontrol) | integrace: spustí celou hru, přepne vzhled, změří reálné kreslicí operace, přehledový LOD, posun a zoom kamery |
| `tools/tiles/preview.html` | tři panely foundry: demo svět, přechody zblízka (160 px/dlaždice), pás 40 dlaždic (hledání opakování) + měření repetice |

**Naměřený rozpočet** (viewport 14×12 dlaždic při 64 px, reálná mapa):
**224 štětců, 176 přechodů, 36 dekorací**, plán **0,15 ms** na snímek.
V přehledovém LOD se štětce i přechody ředí (`quality`), v `far` se kreslí jen
plochý podklad.

**Foundry nesmí měnit barvu terénu** — jen ho texturovat. Dá se to změřit bez
canvasu: `G.foundryTerrainColor(terén)` spočítá z plánu průměrnou barvu, kterou
krajina po štětcích má (štětec kryje `π·r²·flat / tilePx²` dlaždice a přes tu
plochu míchá svou barvu s alfou). Ověřuje to `test/foundry.js`:

| | hodnota |
|---|---|
| nejbližší dvojice terénů po foundry | **33,3** (paleta 33,1) |
| největší posun barvy terénu | **5,2** |

Naměřeno při ladění: když měly štětce v průměru tmavší barvu než `base`
(či světelný nádech míchal bílou a černou), krajina zšedla, rozestup terénů
spadl z **33 na 19–25** a louka s močálem se slily. Proto jsou `daubs`
**vycentrované na `base`** (jejich průměr = základ) a světlo/stín bere odstíny
vlastního terénu (`pal.light` / `pal.dark`), ne bílou a černou.

**Ladění:** `G.FOUNDRY = { daub, deco, edge, quality }` — velikost mřížky
štětců/dekorace, zapnutí přechodů a hustota. Dá se ladit **přímo ve hře**:
debug panel **D** → „Mapa — vzhled" → řádky *štětce / dekorace / hustota /
přechody* (`G.setFoundry`, meze v `FOUNDRY_LIMITS`). Vyladěné hodnoty se ukládají
do `settings.foundry` (přežijí reload) a `G.applyFoundrySettings()` je promítá
zpět — volá se na začátku plánu, takže je změna vidět okamžitě. Čísla hlídá
`test/foundry.js` (18 kontrol, včetně toho, že větší štětce opravdu znamenají
méně štětců a že vypnuté přechody opravdu vynechají hrany).

**Otevřené (do dalšího kroku):**

- **Přechody jsou jen vizuální pás** — nejsou to plnohodnotné „biomy"
  (např. břeh nemá vlastní plážový terén).
- **Vzhled foundry je potřeba doladit okem** — hustota a velikost štětců,
  síla přechodů, barvy (vše v `G.FOUNDRY` a `G.PAL`).
- Foundry bydlí v `js/render/art.js`, protože `index.html` měl v době práce
  cizí rozpracované změny a přidání `<script>` by rozbilo konzistenci
  commitnutého stavu. Až se práce sejde, je čistší ho přesunout do
  `js/render/foundry.js`.

---

## 12. Jedna paleta a vzhled postav *(unifikace, 2026-09-16)*

### 12.1 Paleta byla na dvou místech a rozešla se

Barvy terénů se vedly dvakrát: `G.PAL` v `js/render/art.js` (kreslená dlaždice
a foundry) a `TARGET` v `scripts/grade_tiles.py` (+ druhá kopie v
`check-tiles.py`) — cíl, na který se barevně srovnávají **malované (AI)
dlaždice**. Naměřeno: stejný terén se v obou vzhledech barvil jinak o **15–38**
(L2) — hora 36,8, voda 38,1, hlína 32,7, sníh 30,6. Nebyla to „jedna paleta",
ale dvě.

**Teď je zdroj jeden:** `G.PAL` v `art.js`. `scripts/tile_palette.py` ho parsuje
a `grade_tiles.py` i `check-tiles.py` ho odsud berou (když se parsování
nepovede, skript spadne — tichý fallback by znamenal, že se dlaždice gradují na
staré barvy a nikdo si toho nevšimne).

### 12.2 Rozestupy terénů (čitelnost na 46 px)

Paleta měla dvojice, které se na dlaždici 46 px slévaly:

| dvojice | dřív | teď |
|---|---|---|
| hills vs dirt | **8,3** | 50,4 |
| forest vs swamp | 17,9 | 34,4 |
| grass vs dirt | 18,3 | 34,5 |
| hills vs road | 19,8 | 71,9 |
| grass vs hills | 20,1 | 42,7 |
| **minimum palety** | **8,3** | **33,1** |

Postup: základní barvy se roztáhly podle významu terénu (hills = khaki,
mountain = chladná šedá, road = světlá dlažba, dirt = červenohnědá,
water = skutečná modrá, snow = jasnější), a `dark`/`light`/`daubs` odstíny se
dopočítaly **zachováním původních rozdílů vůči základu** — struktura kresby
(světlo/stín) zůstala stejná, změnily se jen barvy.

Ověřeno: odlišnost terénů v assetech **22,5 → 31,8** (paleta dovoluje 33,1),
odchylka od cíle 2,19, švy beze změny (wrap 1,87, seam/zrno 0,78).

**Pravidlo pro `daubs`:** jejich **průměr se musí rovnat `base`** daného terénu.
Štětce (v kresbě dlaždic i ve foundry) pak terén jen texturují a nemění jeho
barvu — jinak krajina v průměru ztmavne, terény se slijí a rozestup palety se
ztratí (naměřeno: 33 → 25, resp. 19 při světelném nádechu přes bílou a černou).
Kontrola: `node test/foundry.js` → „foundry zachova barvu a rozestup terenu".

### 12.3 Pořadí pipeline dlaždic (důležité)

```
vygenerovat
  → python scripts/grade_tiles.py      # barvy podle G.PAL (art.js)
  → python scripts/seamless_tiles.py   # z dlaždic udělá torusy
  → python scripts/check-tiles.py --scheme sliding --repeat 6
```

Gradování je posun po kanálech (+ kontrast), takže **bezešvost nerozbije** —
proto je správné pořadí gradovat a *pak* zacelit. Při každé změně `G.PAL` je
proto potřeba assety přegradovat a znovu zacelit.

### 12.4 Vzhled postav je nezávislý na vzhledu mapy

Dřív se malované postavy zapínaly jen s `tileStyle === 'ai'`, takže **nešlo**
zkombinovat foundry mapu s malovanými postavami — což je pro cestu C cílový
stav. Nově (`js/render/units_ai.js`):

- `G.unitStyle()` / `G.setUnitStyle()` (`settings.units`), přepínač v debug
  panelu **D** → „Mapa — vzhled" → *postavy kreslené / malované*,
- bez explicitní volby se chování **odvozuje od mapy** (jako dřív, takže se nic
  nezměnilo pro existující hry),
- `G.ensureAiUnits()` dočte sprity, když je potřeba (např. sav s
  `units: 'ai'` a kreslenou mapou, kde boot sprity nenačítá), a příznak `tried`
  brání tomu, aby se chybějící soubory zkoušely znovu každý snímek.

Testy (`test/foundry-game.js`): nezávislost obou přepínačů, použití sprite jen
při malovaném vzhledu, a že se **všech šest kombinací** mapy a postav vykreslí.

---

## 13. Sjednocený model postavy *(2026-09-16)*

**Koncept od uživatele:** všichni na **jednom základním modelu** (stejná
silueta), roli nese **erb kreslený v kódu** a na modelu je jen
zbroj/oblečení — **žádná zbraň**.

**Proč to takhle:** postava je na mapě vysoká ~26 px. Šest různých archetypů se
zbraněmi se v tom měřítku stejně nerozezná (zbraně jsou 2–3 px), zato **barva
a tvar erbu** a **materiál zbroje** ano. A hlavně: dokud měl každý „svůj"
obrázek, styl se rozpadal — teď je jazyk jeden.

### 13.1 Jak je to postavené

| Prvek | Jak se určuje |
|---|---|
| **Jeden model** | konstanta `height: 24.5` v plánu — silueta je pro všechny role i profese stejná |
| **Erb role** | `G.ROLES[u.role]` → barva role; dělení štítu a znamení z tabulky `ROLE_HERALDRY` (6 rolí = 6 různých kombinací) |
| **Bez role** | erb v barvě profese (`G.PROFESSIONS[prof].color`) |
| **Zbroj** | materiál z profese (`cloth/leather/mail/plate`), přilba posune o stupeň výš; tón trupu = mix oblečení a materiálu + kovový pás přes hruď |
| **Zbraň** | jen v klasickém vzhledu (`G.figureStyle() === 'classic'`) |

**Plán je čistá funkce** `G.figurePlan(u)` (žádný canvas) — proto se dá ověřit
v Node: `test/figures.js` (12 kontrol) hlídá, že silueta je opravdu jedna, že
erb má barvu role/profese, že se role v heraldice neopakují, že ve sjednoceném
vzhledu **není zbraň** (a v klasickém je), že materiál zbroje mění tón, a že
kreslení projde pro všechny kombinace rolí, profesí a vzhledů.

**Erb se kreslí i přes malované (AI) sprity** (`drawAiFigure` ve `world.js`):
sprite sám roli neříká, takže role by se v malovaném vzhledu ztratila. Ověřeno
počtem volání `ctx.clip()` — to používá v celém kódu jen heraldika, takže je to
jednoznačný důkaz, že se erb kreslí (barvy se nedají použít: `#c05a45` je
zároveň barva role *bojovník* i reputace „nepřátelský").

### 13.2 Přepínač

`settings.figureStyle` = `unified` (výchozí) | `classic`; v debug panelu **D**
→ „Mapa — vzhled" → *figurky: sjednocené / klasické*. Klasický vzhled je
původní figura se zbraní a štítem z výbavy — ponechaný proto, aby se dalo
porovnat a vrátit.

Náhled pro oči: `tools/tiles/preview.html` → sekce **Postavy** (6 případů ve
dvou vzhledech + heraldika všech rolí zvětšená).

### 13.3 Otevřené

- **Základní sprite postavy je vygenerovaný** — `assets/units/base.png` (bez
  zbraně, 48×96, srovnaný do palety) a `units_ai.js` ho **preferuje pro všechny
  profese**; staré archetypy zůstávají jako záložní sada, kdyby soubor chyběl.
  Generuje ho `scripts/gen_unit_base.py` (Pollinations → vyříznutí → výběr
  kandidáta → `grade_art.py` → `check-art.py --mode props`). Past: na **čtvercové
  plátno** model vyrobí širokou scénu (poměr 1,0–1,3) — proto se žádá
  `width=384&height=768` a prompt zdůrazňuje „full body, one person only".
  Naměřeno: vybraný kandidát poměr 0,50, `podil` 0,57, `okraj` 0,00; po srovnání
  odchylka od tónu projektu 119,5 → 33,5 a kontrola: nádech 0,81, neon 0 %,
  mimo paletu 0 %.
- **Frakce se v erbu neprojevují** — erb nese roli (nebo profesi), ne frakci.
  Až bude jasné, čí jsou to postavy (měšťan vs. družina), může přibýt lem
  v barvě frakce.

---

## 14. Vrstva 3 — ilustrace v jedné paletě *(pipeline hotová 2026-09-16)*

Titul, příběhové scény a portréty jsou jediná vrstva, kterou má dělat AI. Jenže
generátor dodá obrázek ve **svém** barevném světě (světlejší, sytější, často
s barvami, které ve hře nejsou) — položený vedle mapy vypadá jako z jiné hry.
Proto je mezi generátor a hru vložená harmonizace:

```
vygenerovat (ComfyUI / Pollinations)
  -> python scripts/grade_art.py --in <obrazek> --out assets/art/<nazev>.png
  -> python scripts/check-art.py
```

### 14.1 Co harmonizace dělá

| krok | co se děje |
|---|---|
| **nádech** | posune průměrnou barvu k průměru palety (`tone()` z `tile_palette.py`) |
| **jas** | jen mírně přiměří rozsah jasu k rozsahu palety (kompozice zůstává) |
| **sytost** | měkký **strop sytosti** — neonové barvy stáhne, ostatní nechá |

Síla se řídí `--strength` (výchozí 0,5 — ilustrace má být bohatší než dlaždice,
jen nesmí utéct z palety). Průhlednost se nemění.

### 14.2 Dvě pasti, které stály za měření

- **Sytost v HSV se lineárním mísením snížit nedá.** Krácení chromy (`max-min`)
  ani mísení k šedé o stejném jasu sytost nezmění, protože se zmenší i maximum
  (naměřeno: 0,74 -> 0,70, resp. beze změny). Správně se pro pixely nad stropem
  **zvedne minimum** na `max*(1-cap)` — pak sytost spadne přesně na strop.
- **Do statistik nepatří průhledné pixely.** Sprity postav mají průhledné
  pozadí a jeho RGB je nesmysl; když se počítalo i ono, vyšly „špatně" i slušné
  sprity (odchylka tónu 95–134 místo 36–102).

### 14.3 Jak se to ověřuje (bez očí)

| metrika | co znamená | limit |
|---|---|---|
| `nadech` | kosinus směru odchylky od šedé proti nádechu palety | >= 0,45 |
| `neon` | podíl pixelů se saturací > 0,6 | <= 10 % |
| `mimo` | podíl pixelů dál než 120 od nejbližší barvy palety | <= 25 % |
| `kontrast` | směrodatná odchylka jasu (ilustrace nesmí být plochá) | >= 12 |

`python scripts/check-art.py --selftest` ověří celou pipeline na syntetickém
obrázku (modrý nádech + malá neonová skvrna + průhledný okraj): poloviční síla
musí zlepšit nádech, tón i sytost a nechat kompozici, plná síla musí splnit
limity. Tím je pipeline ověřená i ve chvíli, kdy kresby ještě nejsou.

Naměřeno na skutečných spritech postav (jako testovací vstup):
nádech **0,61–0,73 -> 0,80–0,82**, neon **5,4 % -> 0 %**, tón (vzdálenost od tónu
projektu) **36–102 -> 26–48**, kontrast zůstal.

### 14.4 Generátor ilustrací *(hotovo 2026-09-16)*

```
python scripts/gen_art.py --candidates 2     # 14 obrazků, 2 kandidáti na každý
python scripts/check-art.py                  # kontrola (rezim illustration)
python scripts/gen_art.py --rescore          # prevybrat viteze z kandidatu (bez internetu)
```

Sada odpovídá tomu, co hra opravdu má: **titul**, **7 příběhových scén**
(popupy z `js/data/progress.js`: Neznámý poutník, Zpráva z hor, Volání lesa,
Kupecká výzva, Stíny v jeskyni, Rada starších, Nový začátek) a **6 portrétů rolí**
(vůdce, zásobovač, ranhojič, průzkumník, bojovník, obchodník).

Každý kandidát se **hned srovná do palety** (aby se hodnotilo to, co by se
použilo) a vybere se nejlepší podle skóre: kontrast v pásu 28–75, minimum
přesvětlených/utopených pixelů, barvy v paletě a **žádný neon**. Všichni
kandidáti zůstávají v `assets/art_candidates/` (gitignore) spolu s `index.html` —
kontaktní list, kde se dá výběr přebít okem (vítěz je zeleně).

**Past, kterou odhalil až první běh:** skóre neon nezohledňovalo, takže vybralo
dva kandidáty s 15 % a 17 % sytých pixelů a kontrola je shodila. Po přidání
penalty za neon se z už stažených kandidátů vybralo líp (a u portrétu bojovníka
bylo potřeba vygenerovat znovu s vyšší silou srovnání).

**Naměřeno u hotové sady 14 ilustrací:** nádech palety **0,96–0,97**, mimo paletu
**0,0 %**, kontrast **48–72**, neon ≤ 10 % (u většiny do 3 %).

### 14.5 Napojení do hry *(API hotové, čeká na UI)*

Načtení a lookupy jsou hotové v `js/render/units_ai.js` (`G.AI_ART`), takže
napojení v UI je **dvouřádkové**:

```js
// v G.showStoryModal(ps) — příběhová scéna:
const id  = G.illustrationForStory(ps.id);      // 'arrival' -> 'scene_arrival'
const img = id && G.illustration(id);           // Image, nebo null
// <img src="..."> / CSS pozadí:  G.illustrationSrc(id)
// canvas:                        ctx.drawImage(img, x, y, w, h)
```

| funkce | co dělá |
|---|---|
| `G.loadIllustrations(done)` / `G.ensureIllustrations()` | načte 14 obrázků (chybějící nevadí, `tried` brání opakování) |
| `G.illustration(id)` / `G.illustrationSrc(id)` | obrázek / cesta, nebo `null` |
| `G.illustrationForStory(storyId)` | `arrival` → `scene_arrival` (jinak `null` — náhodné události typu `lost_traveler` ilustraci nemají) |
| `G.illustrationForRole(roleId)` | `medic` → `portrait_medic`, jinak `null` |
| `G.illustrationsEnabled()` / `G.setIllustrations('on'\|'off')` | vypínač (`settings.art`); při `off` vrací všechno `null` a UI kreslí jako dřív |

Zbývá **jen** doplnit ten kód do `js/ui/ui.js` a `js/ui/title_screen.js` — což
blokuje necommitnutá práce paralelní session (v pracovním stromu je 19 cizích
změněných souborů). `test/art-assets.js` (5 kontrol) hlídá, že na disku je
přesně 14 očekávaných souborů (a nic osiřelého), že lookupy sedí na popupy
a role a že vypínač funguje.

Ilustrace se dají prohlédnout v `tools/tiles/preview.html` → sekce **Ilustrace**
(u každé je vidět, ke kterému popupu/roli patří).

---

## 15. Srovnání balíčků vzhledu *(rozhodovací pomůcka, 2026-09-16)*

Volba balíčku (§7) blokovala zbytek práce (sprity, ilustrace), takže je v náhledu
sekce **Balíčky vzhledu**: pro každý balíček se z barev vypsaných v §2 odvodí
paleta terénů a vykreslí se **skutečným foundry**, takže je vidět, jak by krajina
vypadala — a hlavně **jestli zůstanou terény rozlišitelné**.

Odvození je záměrně bez vymyšlených parametrů: z barev balíčku se spočítá jeho
průměr, sytost, rozestup a rozsah jasu, a teprve podle nich se současná paleta
přeloží (re-anchor na průměr + sytost + teplota + posun k průměrnému jasu).
Sekce ukazuje i **syrový** výsledek (pouhé přenesení barev) — u balíčků, které
stojí na linkách a šrafování, terény splynou, a to je informace, ne chyba.

Naměřeno (rozestup terénů L2, limit 26):

| balíček | syrové přenesení | po roztažení | poznámka |
|---|---|---|---|
| současná paleta | 33,1 | — | reference |
| **Žoldnéřská kronika (A+D)** | **40,5** | — | doporučený balíček; jeho vlastní barvy mají **větší** rozestup než současná paleta, takže čitelnost netrpí |
| Akvarel (B) | 21,8 | 30,1 (×1,4) | potřebuje roztažení — dokument ji pro mapu nedoporučuje a čísla to potvrzují |
| Pixel art (C) | 24,0 | 30,0 (×1,3) | posterizace separaci mírně ukusuje |
| Dřevěná deskovka (E) | 23,9 | 30,0 (×1,3) | teplé dřevo terény sbližuje |

**Co z toho plyne:** doporučení ze §7 (kronika) drží i měřitelně. Dvě věci, které
náhled neukáže a je potřeba dodělat po volbě: **linky a šrafování** (na nich
stojí pergamen i dřevořez) a **textury dlaždic** (`scripts/grade_tiles.py` +
`seamless_tiles.py` na novou paletu).

Test (`node test/tiles-preview.js`) hlídá, že každý balíček má platnou paletu a po
roztažení rozestup **≥ 26** — kdyby někdo paletu balíčku upravil do nečitelna,
spadne to.

---

## 16. Props — krajinné prvky jako alfa sprity *(hotovo včetně spritů, 2026-09-16)*

Poslední vrstva, kterou má dělat AI („AI jen na alfa sprity“): **krajinné prvky**
(strom, skála, trs, rákosí, závěj…). Hra je umí nakreslit kódem a když je
v `assets/props/<druh>.png` hotový průhledný sprite, použije se místo kresby.

| Druh | Kde se používá | Kotva |
|---|---|---|
| `tree`, `pine` | lesy, háje (uzly) | střed základny kmene |
| `boulder` | kamenolom, kopce, hory, hlína | střed prvku |
| `tuft` | louka (dekorace foundry) | střed základny |
| `bush` | les a hluboký les | střed |
| `pebble` | kopce, hory, hlína | střed |
| `reed` | močál | střed základny |
| `drift` | sníh | střed |
| `ripple` | voda | střed |
| `rut` | cesta | střed |

**Přepínač:** `settings.props` (`G.propStyle`/`G.setPropStyle`), v debug panelu
**D** → „Mapa — vzhled" → *prvky kreslené / malované*. Je **nezávislý** na vzhledu
mapy i postav, a když sprity nejsou, kreslí se kódem (fallback je vždy funkční).
Výchozí je `code`, protože soubory zatím neexistují — jakmile budou, stačí
přepnout (a `assets/props` prohnat `scripts/grade_art.py`, aby sprity držely
paletu).

**Footprinty jsou změřené z kódové kresby** (např. strom 28×26 jednotek, kotva na
základně) a sprite se do boxu **vepasuje se zachováním poměru stran** (roztahovat
cizí obrázek na změřený box by ho zdeformovalo) — hlídá to `test/props.js`
(11 kontrol, mimo jiné že **těžiště kresby se posune o 0,0 px**) a že chybějící
soubory se nezkoušejí znovu každý snímek (`tried`).

### 16.1 Generování spritů

```
python scripts/gen_props.py --candidates 3                          # stromy/skály/…
python scripts/grade_art.py --in assets/props --out assets/props    # do palety
python scripts/check-art.py --dir assets/props --mode props         # kontrola
```

`gen_props.py` dělá čtyři věci: stáhne kandidáty (Pollinations, zdarma, bez
klíče), vyřízne pozadí **stejnou logikou jako u postav** (`process_units.py`:
polarita podle jasu středu vs. okraje, prahování, největší souvislá oblast
uprostřed), **vybere nejlepšího kandidáta** (skóre = plnost obdélníku − trest za
nalepení na okraj − trest za těžiště mimo střed) a zmenší na cílovou výšku.
Pozadí je středně šedé (ne krémové jako u postav), aby šly vyříznout i světlé
věci (závěj, pěna).

Proč vybírat z kandidátů: model občas vyrobí scénu místo jednoho objektu a
vyříznutí pak vrátí celý výřez — skóre to pozná podle podílu popředí a nalepení
na okraj. Naměřeno při generování 10 druhů: `podil` 0,38–0,77, `plnost` 0,40–0,79,
`okraj` 0,00 (kompaktní objekty uprostřed), 3 z 30 kandidátů se vůbec nepovedlo
vyříznout (model dal scénu) — proto se dělají 3 kandidáti.

**Kontrola má dva režimy** (`--mode illustration|props`), protože jednotlivý
objekt má jiné nároky než celá scéna: ilustrace má mít *nádech* palety
(`nadech` ≥ 0,45), ale bílá závěj nebo modravá pěna teplé být nemusí — u nich se
hlídá, že barvy leží **v paletě** (`mimo` ≤ 25 %) a nejsou neonové. Naměřeno po
srovnání: odchylka od tónu projektu **88 → 43,5**, neon např. u koleje **99 % →
1,4 %**, `mimo paletu` 0,0–0,1 % u všech deseti.

**Zatím nenapojeno:** vstupy do dolů a jeskyní (`mine`, `cave`) mají vlastní
kresbu a sprite druh nemají — dodá se s dalšími sprity.

### 16.2 Motiv (pergamen a inkoust) — kandidáti k výběru

Sprity v `assets/props` jsou jen **barevně srovnané** na kroniku. Aby měly
i stejný jazyk linek, umí generátor přidat styl balíčku:

```
python scripts/gen_props.py --style kronika --candidates 2 --out assets/props_kronika --seed 5000
python scripts/gen_unit_base.py --style kronika --candidates 5 --out assets/props_kronika --seed 6100
python scripts/grade_art.py --in assets/props_kronika --out assets/props_kronika --strength 0.6
python scripts/check-art.py --dir assets/props_kronika --mode props
python scripts/compare_assets.py --old assets/props --new assets/props_kronika
```

Vygenerovaná sada je v `assets/props_kronika/` (gitignore) a **čeká na výběr
okem** — `compare_assets.py` vyrobí kontaktní list „staré vs nové" pro každý
druh (`assets/props_kronika/index.html`). Naměřeno u nové sady: nádech palety
0,92–0,97, mimo paletu 0 %, kontrast 27–59, všech 10 souborů (9 prvků + základní
postava) prochází kontrolou.

Dvě věci, které se u motivu ukázaly: **trs trávy** model v kronikovém stylu
vyrobil jako skoro celoplošný obraz (podíl popředí 0,86–0,95) a skóre ho správně
odmítlo — v sadě proto chybí; a **základní postava** potřebovala 5 kandidátů
(první tři se nepovedlo vyříznout), než vyšla.

Až se sada vybere, nasadí se přepsáním souborů a znovu `grade_art.py` +
`check-art.py`. Sprity jsou **barevně
srovnané** na zvolený balíček (§17); jejich úplné přegenerování v pergamenovém
stylu je další krok (tři příkazy výše).

---

## 17. Nasazení balíčku „Žoldnéřská kronika" *(2026-09-16)*

Uživatel vybral balíček A+D. Nasazení znamenalo:

1. **Paleta do `G.PAL`** (`js/render/art.js`) — odvozená **kódem z náhledu**
   (`derivePalette` bere barvy balíčku z §2), se dvěma ručními korekcemi:
   - **sníh** se odvozením vybílil do čisté bílé (`#ffffff`) a ztratil texturu →
     `#f2efe6`,
   - **hora** dostala mauve nádech (šedá + teplý posun) → `#8d8177` (šedohnědá).
   `daubs` u obou se dopočítaly tak, aby jejich průměr = základ (pravidlo §12).
2. **Dlaždice** — obnoveny ze stavu před healem, přegradované na novou paletu
   (`grade_tiles.py`) a znovu zacelené (`seamless_tiles.py`).
3. **Sprity** — `assets/props/*` (10) a `assets/units/base.png` srovnané
   `grade_art.py` jedním průchodem (síla 0,7; rákosí 1,0 — při 0,7 mu zůstalo
   14 % neonu).

**Naměřeno po nasazení:**

| | před | po |
|---|---|---|
| rozestup terénů v paletě | 33,1 | **40,5** |
| rozestup terénů v assetech (`check-tiles`) | 31,8 | **39,7** |
| wrap dlaždic / seam-zrno | 1,87 / 0,78 | 1,85 / 0,78 (beze změny) |
| sprity: nádech palety | 0,61–0,83 | **0,85–0,96** |

Kontroly po nasazení: check-globals 0 problémů, check-actions OK, 8 testovacích
sad zelených, `check-tiles` OK, `check-art --mode props` OK (10 + 1 sprit).

**Co tím ještě není hotové:** „kronika" stojí na **lince a šrafování** — paleta
drží čitelnost, ale inkoustový ráz dodá teprve kresba linek (další krok, §7).
Dlaždice a sprity jsou zatím jen *barevně* srovnané, ne přegenerované
v pergamenovém motivu.

## 18. Kuchařka: jak si grafiku vygenerovat sám *(2026-09-17)*

Tohle je pro uživatele, který si chce experimentovat.

### 18.0 Nejjednodušší cesta: jeden příkaz

**V cmd** (a funguje i v PowerShellu) — obal `make_tile_set.cmd` si sám přepne
konzoli na UTF-8 a najde správný Python, takže se nemusí nic nastavovat:

```bat
cd /d C:\idle-realm
scripts\make_tile_set.cmd --name kronika-tex --style kronika-tex
```

**V PowerShellu** totéž napřímo (pozor: `&` je jen PowerShell; v cmd se píše
cesta bez něj):

```powershell
cd C:\idle-realm
& 'D:\ComfyUI\venv-comfy\Scripts\python.exe' scripts\make_tile_set.py --name moje --style kronika-tex
```

Skript udělá celou pipeline sám (vygeneruje → pozná, jestli to nejsou scény →
srovná barvy → zacelí šev → změří) a na konci **vypíše, jak si sadu zobrazit**.
Trvá ~15 minut (20 obrázků). Na rychlé vyzkoušení stačí dva terény:

```bat
scripts\make_tile_set.cmd --name zkouska --only grass,water --variants 1
```

Tip: `--name kronika-tex` (nebo `kronika`) **přepíše kandidátskou sadu, která už
má tlačítko v debug panelu hry** — pak si ji zobrazíš jedním kliknutím, bez
editace kódu. Vlastní jméno udělá `assets/tiles_<jméno>/final/` a skript vypíše
řádek, který se má vložit do `G.TILE_SETS` (`js/render/tiles_ai.js`).

Zbytek sekce popisuje totéž ručně a vysvětluje, co se uvnitř děje. Všechno jde
spustit z terminálu ve `C:\idle-realm`; Python na obrázky je
`D:\ComfyUI\venv-comfy\Scripts\python.exe` (má pillow + numpy; systémový
Python 3.12 je **nemá** — past 13 v `docs/HANDOFF.md`).

**Kam padá výstup:** sada vždy do `assets/tiles_<jméno>/final/` (u jmen
`kronika` a `kronika-tex` do odpovídajících kandidátských složišť). Uvnitř sady
jsou meziprodukty `raw/` → `flat/` → `graded/` → `final/`; **`raw/` se nemazat**
(past 30 — bez nezacelené dlaždice nejde nic přeladit). Nasazená sada, kterou
čte hra, je `assets/tiles/`.

### 18.0b Vlastní prompt (když chceš psát prompty sám)

```bat
scripts\make_tile_set.cmd --name moje --prompts scripts\tile_prompts.txt
```

`scripts/tile_prompts.txt` je obyčejný textový soubor: `template = …` je společná
šablona pro všechny terény (`{subject}` se nahradí předmětem terénu, `{style}`
stylem z `--style`), a `grass = …` je celý vlastní prompt pro jeden terén, který
šablonu přebije. Skript u každého terénu vypíše **délku promptu a jeho zdroj**
(`vlastni` / `sablona` / `vestaveny`) a varuje, když prompt přeteče ~350 znaků.

Pozor na měřítko: dlaždice má na 46 px zobrazovat **povrch krajiny z ptačí
perspektivy** (les = koruny stromů, ne kapradí), ne detail jedné věci.
Víc v `docs/HANDOFF_GRAFIKA.md` §2 a §3.

### 18.1 Dvě cesty k obrázkům

| | **ComfyUI** (lokálně, `D:\ComfyUI`) | **Pollinations** (online, zdarma) |
|---|---|---|
| Co to je | SDXL model na tvé RX 6600, server `http://127.0.0.1:8188` | veřejná služba, stačí internet |
| Kdy | chceš kvalitu a mít to pod kontrolou (model, kroky, seed) | chceš rychle vyzkoušet motiv nebo nápad |
| Rychlost | ~105–144 s na obrázek (768×768) | jednotky sekund |
| Skript | `scripts/gen_tiles_local.py`, `scripts/gen_units_local.py` | `scripts/gen_tiles.py`, `scripts/gen_props.py`, `scripts/gen_art.py` |
| Pozor | ComfyUI musí běžet (`python main.py --port 8188`) | odřezává prompty nad ~350 znaků, občas vrátí 500 (skript to zkouší znovu) |

**ComfyUI spustíš** takto (setup je popsaný v §9, tady jen start):

```powershell
cd D:\ComfyUI
.\venv-comfy\Scripts\python.exe main.py --port 8188
# pak v prohlížeči http://127.0.0.1:8188 (pokud chceš klikat místo skriptu)
```

**Vygenerovat dlaždice v ComfyUI** (stejná cesta, jak vznikla nasazená sada):

```powershell
cd C:\idle-realm
& 'D:\ComfyUI\venv-comfy\Scripts\python.exe' scripts\gen_tiles_local.py
# výstup: assets/tiles_local/*.png (gitignored); seznam terénů a promptů je v tom skriptu
```

**Vygenerovat dlaždice přes Pollinations** (bez ComfyUI, stačí internet):

```powershell
& 'D:\ComfyUI\venv-comfy\Scripts\python.exe' scripts\gen_tiles.py `
    --style plain --out assets/moje_dlazdice/raw
# --style plain | kronika | kronika-tex ; --only grass,water ; --variants 2
# skript vypíše délku promptu u každého terénu (limit ~350 znaků)
```

### 18.2 Co s vygenerovanými obrázky (pipeline)

Surový obrázek **není** použitelná dlaždice. Proženej ho třemi kroky — ať
meziprodukty zůstanou, jinak se nedá nic přeladit (past 30):

```powershell
$py = 'D:\ComfyUI\venv-comfy\Scripts\python.exe'
& $py scripts\tile_flatness.py assets\moje_dlazdice\raw           # 1) je to plocha textura, nebo scéna?
& $py scripts\flatten_tiles.py assets\moje_dlazdice\raw assets\moje_dlazdice\flat --radius 48
& $py scripts\grade_tiles.py  assets\moje_dlazdice\flat assets\moje_dlazdice\graded
& $py scripts\seamless_tiles.py --dir assets\moje_dlazdice\graded --out assets\moje_dlazdice\final
& $py scripts\check-tiles.py  --dir assets\moje_dlazdice\final --scheme sliding --repeat 6
& $py scripts\tile_sharpness.py assets\moje_dlazdice\final --ref assets\moje_dlazdice\flat
```

Každý krok má jasné „VYSLEDEK: OK" a čísla; co znamenají, je v §8.3–8.4.
`flatten` je potřeba jen když `tile_flatness.py` hlásí scénu (§8.6).

### 18.3 Podívat se na výsledek (dvě cesty)

1. **V běžící hře** (nejlepší — vidíš to na skutečné mapě): polož sadu do
   `assets/tiles_moje/final/`, přidej ji do `G.TILE_SETS`
   (`js/render/tiles_ai.js`), otevři hru, zmáčkni **D** → sekce **Mapa —
   vzhled** → klikni na svou sadu (vzhled se sám přepne na `malovaný`).
   Když složka chybí, hra sadu odmítne přepnout a nechá předchozí.
2. **Vedle sebe jako mozaiky**: `scripts/compare_tiles.py`
   (`--old assets/tiles --new assets/tiles_moje/final --out .../srovnani.html`) —
   každá dlaždice 4×4 zopakovaná, protože v jednom obrázku šev nepoznáš.

### 18.4 Můžu se na obrázek i zeptat (vision)

Model v téhle session obrázky sám nevidí, ale je na to nástroj — pošle obrázek
Gemini a vrátí text (popis, vady, přepis textu):

```powershell
$env:PYTHONIOENCODING='utf-8'   # bez toho spadne na výpisu češtiny do cp1252
& "$env:USERPROFILE\.dsh\skills\vision\run.cmd" --mode asset "C:\idle-realm\assets\tiles\grass-1.jpg"
& "$env:USERPROFILE\.dsh\skills\vision\run.cmd" img1.jpg img2.jpg --mode diff
```

Hodí se jako **druhé oči** (našel rozmazaný kříž, který metriky neviděly — past 28),
ale v jemných rozdílech je nekonzistentní (past 29). Čísla + tvůj pohled rozhodují.

### 18.5 Generování obrázků přes Gemini (skill `imagegen`)

`~\.dsh\skills\imagegen\run.cmd "popis obrázku"` umí obrázky i herní sprity
(stejný klíč jako bot cetnik). **Stav 2026-09-17: nefunguje** — free tier má
u obou image modelů kvótu `limit: 0` (HTTP 429). Až se kredit doplní, je to
nejpohodlnější cesta (`--project idle-realm --many "vlk,medvěd" --size 32x32
--colors 16`).

