# Přechody terénů (ostré hrany mezi dlaždicemi)

> Stav: 20. 9. 2026. Vzniklo z konkrétní vady: „jednotlivé dlaždice mají ostré
> hrany a žádné přechody, takže voda/louka nebo les/louka je ošklivý“.

## 1. Co je příčina

Uvnitř jednoho terénu je spojitost vyřešená: dlaždice **není obrázek**, ale
**okno do torusu** vzorkované ve světových souřadnicích (`G.tileDraw`,
`js/render/tiles_ai.js`). Sousední dlaždice téhož terénu jsou tedy sousední
výřezy jednoho spojitého obrazu.

Jenže na hranici **dvou různých** terénů se potkají dvě nesourodé textury.
Kreslený vzhled to neskrývá, ale ani neprozrazuje (je to plochá grafika —
ostrá hrana je čitelná jako styl). Malované dlaždice jsou fotografické: každá
má jiný jas, sytost a strukturu, takže řez vypadá jako chyba.

## 2. Měření (`scripts/tile_edges.py`)

Měří se stejnou logikou jako šev uvnitř dlaždice: **rozdíl dvou textur ku zrnu**.
`rozdíl` = průměrný rozdíl jasu, když se textury potkají (průměr přes vzájemné
posuny, protože hra řeže okna, ne hrany dlaždic), `zrno` = jak moc se liší
sousední sloupce uvnitř dlaždice, `poměr` = rozdíl / zrno.

| Sada | nejhorší dvojice | poměr | medián |
|---|---|---|---|
| `assets/tiles` (nasazená) | deep_forest/snow 183, poměr **18,9** | 18,9 | ~6 |
| `assets/tiles_kronika/final` | deep_forest/snow, poměr **93,5** | 93,5 | ~20 |
| `assets/tiles_drawn/final` | deep_forest/snow 196, poměr **21,8** | 21,8 | ~8 |
| `assets/tiles_gemini_set/final` | deep_forest/mountain 91, poměr **6,3** | 6,3 | ~3 |

Přečti si to takhle: **není to vada jedné sady, mají ji i dlaždice, které jsou
ve hře nasazené.** Nejextrémnější dvojice jsou vždycky ty, kde se potká tmavý
terén se světlým (hluboký les ↔ sníh: 40 vs 236 jasu) — a to je záměr palety
(`G.PAL`), ne chyba dlaždic. Gemini sada má poměry nejnižší jen proto, že v ní
**není sníh ani voda** (žádná modrá, bílá ani písčitá dlaždice).

## 3. Dvě řešení (obě zapojená)

### 3.1 Prolnutí dvou terénů — `G.AI_TILES.transition`

Dlaždice se zeptá světa (`G.WORLD.terrainAt`) na okolí a prolije se
s dominantním sousedním terénem:

* **kdo**: dominantní cizí terén podle Gaussova jádra o poloměru `spread` —
  robustní i na nároží, kde se potkají tři terény,
* **jak silně**: podle **vzdálenosti** od toho terénu (1 dlaždice = plná
  polovina `TRANS_MAX`, na okraji zóny nula), takže přechod je **zóna**
  o 1–3 dlaždicích, ne skok,
* **rovná hranice se rozbíjí** hladkým šumem (`field`), aby přechod nebyl
  vidět jako linie mezi dlaždicemi,
* `TRANS_MAX = 0,5` hlídá, že dlaždice zůstane většinově sama sebou,
* cena: jedno `drawImage` navíc na hraniční dlaždici (jádro se počítá jednou
  pro každý poloměr, `Math.exp` se nevolá per dlaždici).

### 3.2 Foundry jako vrstva nad dlaždicemi — `G.FOUNDRY.overlay`

Foundry umí kreslit krajinu ve **světových souřadnicích**: hrany terénů
(`paintEdge`) a dekorace (`paintDeco`). Dosud to byl samostatný vzhled; teď jde
pustit **nad** malované dlaždice:

* `overlay = 1` — jen hrany (foam u vody, sněhová obruba, kamínky na přechodu),
  štětce se vynechají, aby hotové textury nepřebily,
* `overlay = 2` — hrany + štětce (i barevný nádech foundry).

**Proč obojí:** prolnutí půlí rozdíl (např. 92 → ~46 na dlaždici), ale u dvojic,
kde je rozdíl daný paletou (sníh ↔ hluboký les), ani polovina nestačí. Tam je
správná odpověď **nakreslený přechodový prvek** (pěna, obruba, kameny), ne
prolité barvy. Prolnutí je pro podobné dvojice (tráva/les/kopce/hlína/močál),
foundry hrany pro extrémní (sníh, voda).

## 4. Jak to ovládat

Debug panel (`D`) → **Mapa — vzhled**:

| Prvek | Co dělá | Ukládá se do |
|---|---|---|
| `ostré hrany / 0,35 / 0,7 / 1` | síla prolnutí dvou terénů | `settings.tileTransition` |
| `zóna 1 / 2 / 3` | šířka přechodové zóny v dlaždicích | `settings.tileSpread` |
| `foundry vyp / hrany / plný` | foundry jako vrstva nad dlaždicemi | `settings.foundry.overlay` |

Vše se ukládá, takže vyladěný vzhled přežije reload. Výchozí stav je **vyp**
(chování hry se nemění, dokud to nezapneš).

## 5. Testy

* `node test/tile-transition.js` — 11 kontrol: vypnuto = jedno kreslení,
  vnitřek se neprolévá, hranice se prolije se sousedem (alfa 0–0,5), váha nikdy
  nepřepne víc než půlku, přechod je **zóna** (váha roste po dlaždicích, žádný
  skok), chybějící textura souseda = neprolévá, nastavení se ukládá a aplikuje,
  foundry vrstva výchozí vyp / ukládá se / režim „jen hrany“ nekreslí štětce,
  a modul nečte pixely (`getImageData` by na `file://` shodil hru).
* `node test/foundry.js`, `node test/tile-window.js`, `node test/tile-sets.js` —
  beze změny procházejí.

## 6. Co zůstává otevřené

* **Změřit vliv v reálné hře.** `tile_edges.py` měří assety; jak vypadá
  prolnutí a foundry vrstva na skutečné mapě, se hodnotí okem v přepínači sad.
* **Harmonizace hodnot** v pipeline (srovnat jas napříč terény víc než jen
  průměrem) by ublížila záměru palety — sníh má být světlý. Proto se do ní
  nezasahovalo a řeší se to přechody.
* **Vlastní přechodové assety** pro pár nejvýraznějších dvojic (např. jen
  voda/zem) — možné, ale drahé (10 terénů = 45 dvojic) a generátor neumí
  spolehlivě řídit kompozici „vlevo tráva, vpravo voda“.
