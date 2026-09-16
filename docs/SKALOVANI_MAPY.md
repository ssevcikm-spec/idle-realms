# Škálování mapy — jak to bylo, co je teď a co dál

> **Datum:** 2026-09-15
> **Zadání:** „Ať města nejsou jen ikony a postavičky ať nejsou jen mrňavé puntíky.
> Chtěl bych vidět figurky chodící po krajině, kterou vidím z dálky. Něco jako
> detailní mapa." (Teď zmenšit zdrobnění, později rozšířit svět.)

---

## 1. Diagnóza — proč to vypadalo jako puntíky

| Co | Bylo | Proč to vadilo |
|---|---|---|
| Art dlaždic | generoval se **96 px**, kreslil na **46 px** | polovina vygenerovaného detailu se zahazovala a na retina displeji (DPR 2) to bylo rozmazané |
| Postava | ~**26 px** v dlaždici 46 px, hlava r ≈ **3,7 px** | na obličej, zbraň ani výbavu není místo → barevný puntík |
| Sídla | vesnice i metropole měly **stejný půdorys** (poloměr 0,40–1,45 dlaždice, domky 0,55–0,90) | metropole vypadala jako vesnice, tedy „ikona" |
| Okno mapy (mobil) | `min(38vh, 280px)` | úzký pruh, ~6 řad dlaždic |
| Oddálení | zoom až 0,55 → dlaždice 25 px, postava 14 px | doslova puntíky a nic nepřepínalo na symbolický režim |

---

## 2. Co je hotové

### Dlaždice: 46 → 64 px, ale hlavně **ostré**
- `BASE_TILE` je nyní **64 px** při zoomu 1.
- Art se kreslí do **192 px** canvasu (`RES`), ale **kompozice zůstává stejná**:
  painters pracují v logickém prostoru 96 a `ctx.scale(RES/SIZE)` je jen zjemní.
  Díky tomu se nezměnil vzhled krajiny, jen rozlišení — dlaždice je ostrá i ve
  větším měřítku a na DPR 2 (192 zdroj → 128 zařízení při zoomu 1).
- Paměť: 10 terénů × 4 varianty × 192² × 4 B ≈ **5,9 MB**, generuje se líně.

### Postavy: 26 → ~60 px, tedy **figurky místo puntíků**
- Nový vztah: postava je vysoká `figureHeight` (výchozí **0,94**) dlaždice.
  `figScale() = tilePx · figureHeight / 24,5`.
- Hlava má r ≈ **8,6 px** (bylo 3,7), takže je kam dát helmu, zbraň i štít.
- Figura má **jemný tmavý obrys** (tělo + hlava), aby se oddělila od terénu.
- Ikony nad hlavou (zranění, spánek, obchodník) a kroužek postupu se posunuly
  podle skutečné výšky postavy, pruhy výdrže a nálady zůstávají pod nohama.

### Sídla: opravdová místa, ne ikony
- Půdorys roste s velikostí: vesnice **1,0×**, město **1,5×**, metropole **2,1×**
  (`G.settlementSpread`), domky se zvětšují spolu s ním.
- Město a metropole dostaly **hradby/palisádu** (kolíky po obvodu) a **bránu**;
  metropole navíc **4 věže** se střechami. Vesnice zůstává otevřená.
- Stín pod sídlem se roztahuje podle velikosti.

### Okno mapy
- Mobil a úzká okna: `min(48vh, 400px)` místo `min(38vh, 280px)` — více krajiny.
- Na desktopu (≥ 900 px) je mapa vlevo v gridu a roztažená i na výšku, tam se nic
  nemění; celoobrazovková mapa (⛶) a sbalení panelu (▾) fungují dál.
- `MIN_ZOOM` 0,55 → **0,7**, aby se z figurek nedaly dělat puntíky.

### Ladění bez zásahu do kódu
V debug panelu (**D**) je sekce **„Mapa — měřítko"**:
- **Dlaždice**: 46 / 56 / 64 / 80 px
- **Postava**: 60 % / 80 % / 94 % / 115 % dlaždice
- pod tím živě spočítané hodnoty („dlaždice 64 px • postava 60 px")

Volba se ukládá do `settings.tileBase` / `settings.figHeight`, takže přežije reload.

---

## 3. Co to znamená pro styl grafiky

Tohle je zásadní vstup do `docs/STYL_GRAFIKY.md`:

- Při **26 px** byla malba zbytečná — rozhodovala jen barva.
- Při **~60 px** (a 120 px při zoomu 2) už má smysl **Battle Brothers směr**:
  obrys, 3 tóny stínování, čitelná výzbroj.
- **Pixel art** je teď realističtější v tom, že sprity budou větší, ale pořád
  platí: volný zoom ho rozmázne, dokud nezamkneme celočíselné stupně.
- Sídla s hradbami potřebují vlastní paletu (kámen vs. dřevo), což je přesně to,
  co řeší vybraný styl.

---

## 4. Co dál (návrh dalších kroků)

### Krok 2 — LOD (úrovně detailu) — *doporučuji jako další*
Při oddálení pod určitý práh (např. `tilePx < 34`) **přepnout kreslení**:
- sídla → **ikona s názvem** a barvou frakce, ne mrňavé domky,
- postavy → **korouhvička/tečka podle role**, ne sprite,
- uzly → symbol + název,
- volitelně jména sídel a regionů.

Tím zmizí „puntíky" úplně (oddálení bude *jiný režim*, ne zmenšený detail)
a zároveň se otevře prostor pro velký svět.

### Krok 3 — větší svět
- Svět je dnes 40×30 dlaždic. Při 64 px je to 2560×1920 px — v detailu se dá
  procházet, v přehledu (LOD) přehlédnout.
- Rozšíření na **64×48** (+ ~2,5× plochy) je pak hlavně datová změna:
  `W/H` v `generateWorld`, víc sídel a uzlů, doladit hustotu.
- Podmínka: nejdřív LOD, jinak bude velký svět jen víc puntíků.

### Krok 4 — volitelně: posuvník výšky mapy
Mapa vs. panel by šlo rozdělit tažením (split), aby si hráč zvolil, kolik krajiny
chce vidět. Zatím to řeší tlačítko ▾ (sbalit panel) a ⛶ (celá obrazovka).

---

## 5. Krajinné prvky místo ikon *(doplněno)*

Dosud byl každý uzel (les, jezero, pole…) nakreslený jako **emoji v kroužku**
(`G.drawBadge`) — tedy „ikona na kliknutí". Nově se uzel kreslí jako **skutečný
kus krajiny**: `G.drawNodeFeature` (`js/render/art.js`).

| Uzel | Co je na mapě vidět |
|---|---|
| Les | hustý shluk stromů a borovic se stínem |
| Hluboký les | tmavší, hustší porost |
| Hájek | světlé stromy s jarními květy |
| Louka | **obdělávané pole** s řádky a snopy |
| Močál | tůňky, rákosí a ztrouchnivělý kmen |
| Kamenolom | stupňovitá skalní stěna a balvany |
| Důl | horský hřbet, tmavý vstup s dřevěnou výztuhou a hromadou rudy |
| Jeskyně | skalní výchoz s tmavým ústím a zábleskem krystalu |
| Jezero | **jezírko** s vlnkami, rákosím a dřevěným molem |

Jak to funguje:
- Rozvržení prvku je **deterministické podle id uzlu** (`G.nodeFeatureProps`,
  seedovaný RNG) a drží se v `node._feat` — nekreslí se tedy každý snímek jinak
  a nic nebliká.
- Prvky se kreslí ve starých jednotkách dlaždice (46) a škálují se podle aktuální
  velikosti dlaždice, takže sedí s `tileBase` i zoomem.
- **Rychlé přiblížení:** pod `tilePx < 34` by se prvek slil s terénem, a tak se
  automaticky přepne zpět na symbol. To je zárodek LOD z kroku 2 — přepíná se
  podle velikosti, ne ručně.
- Oblast kliknutí u uzlu se zvětšila z 0,9 na 1,15 dlaždice, aby se trefilo
  i na okraj nakresleného porostu.

### Cesty jsou nyní spojité
Dřív byla cesta zapečená v dlaždici jako pevná křivka, takže na sebe dlaždice
nenavazovaly a cesta vypadala přerušovaně. Generování teď ukládá **střed cesty
jako polyline** (`G.WORLD.roads` = pole bodů [x,y]) a `drawRoads` ji kreslí jako
jednu souvislou čáru se zaoblenými spoji — žádné pruhy od středu k hranám ani šum.
Má tmavý lem a světlejší povrch. Dlaždice cesty žijí zvlášť v `G.WORLD.roadTiles`
(pro rychlé testy).

---

## 6. Testy

`test/headless-smoke.js` (celkem 40 kontrol) nově ověřuje:
- `G.setTileBase` / `G.getTileBase` včetně podlazení (32) a zastropování (96),
- `G.setFigureHeight` / `G.getFigureHeight`,
- `G.settlementSpread`: vesnice 1,0 < město < metropole,
- dlaždice se generuje v rozlišení **192 px**,
- **všech 9 druhů uzlů** se vykreslí jako krajinný prvek a rozvržení je stabilní
  pro stejný uzel (a různé pro různé uzly),
- cesty jsou polyline mezi sídly (alespoň 2 body) a jejich konce leží u sídel.
