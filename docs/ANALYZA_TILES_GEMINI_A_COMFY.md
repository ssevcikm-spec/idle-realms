# Analýza dlaždic: `tiles_gemini` a `tiles_comfy`

> Zjištěno měřením (`scripts/check-tiles.py`, `scripts/tile_flatness.py` + stejné
> metriky přepočítané na každý soubor), barevnou statistikou a logem generátoru
> `generations.jsonl`. Vision (Gemini) nebyl k dispozici — kvóta free tieru je
> vyčerpaná (limit 20 requestů, u `pro` modelu 0), viz „Omezení“ na konci.

## 1. Co v obou složkách je

| Složka | Souborů | Formát | Rozlišení | Co to je |
|---|---|---|---|---|
| `assets/tiles_gemini/` | 16 | JPEG | 1024×1024 (1× 1408×768) | 16 obrázků z Gemini, názvy `Gemini_Generated_Image_*.jpg` (bez významu) |
| `assets/tiles_comfy/` | 7 | PNG | 3× 512×512 + 4× 1024×1024 | 7 obrázků z ComfyUI/SDXL |

**Podstatný nález k `tiles_comfy`:** všech 7 souborů je **bit po bitu shodných**
se soubory v `C:\Users\Ssevc\Local-Deepseek\obrazky\user\pictures` (ověřeno
SHA-256). Složka tedy nic nového nepřináší — je to kopie 7 obrázků z toho poolu.

Obsah (podle statistiky barev + u comfy souborů doslovně podle promptu v logu):

| Složka | Terén podle obsahu |
|---|---|
| `tiles_gemini` | 13× zelená vegetace (z toho tmavé = les), 2× hnědá (hlína/cesta), 1× obrázek scény — **žádná voda, sníh, hory, kopce, močál ani cesta** |
| `tiles_comfy` | **7× tentýž terén: „grassy meadow / grass, top view, flat, uniform light“** (u 5 souborů je prompt doslovně v logu — 4× `comfyui-*.png` a `07-orthoscopic-drawn-2.png`; u zbylých 2 to říká název) |

## 2. Měření proti sadě, kterou hra používá

| Sada | `wrap` (torus) | kontrast v 46 px | `seam/zrno` | scéna |
|---|---|---|---|---|
| nasazená `assets/tiles/` (verzovaná) | 1.1–2.6 | 9.8–43.6 | 0.72–1.01 | 0/20 |
| `tiles_kronika/final` (přijatý kandidát) | 0.5–1.0 | 5.8–24.0 | 0.69–0.98 | 0/20 |
| `tiles_kronika_tex/final` (přijatý kandidát) | 0.5–1.3 | 6.6–28.6 | 0.76–0.97 | 0/20 |
| **`tiles_gemini` (kandidát)** | 18.6–51.3 | 6.7–84.4 | 0.93–1.04 | 1/16 |
| **`tiles_comfy` (kandidát)** | 15.9–33.0 | 4.4–10.4 | 0.96–1.05 | 0/7 |

Limity, které si repo samo nastavilo (`scripts/check-tiles.py`, `tile_flatness.py`):
`wrap` ≤ **2,5**, kontrast v 46 px ≥ **5**, `seam/zrno` ≤ **1,6**, perioda ≥ 4,
horizont ≤ 0,045, střed ≤ 0,075, odchylka barvy od palety ≤ 22.

**Hlavní zjištění: `wrap` je 10–20× mimo limit u všech 23 souborů.** Nasazená sada
má 1,2–2,6 a zacelené kandidáty 0,5–1,0; tyhle soubory mají 15,9–51,3. Hra přitom
bere dlaždici jako **okno do torusu** (`js/render/tiles_ai.js`) — dlaždice musí mít
levý sloupec = pravý a horní řádek = spodní. To žádný z těchto souborů nesplňuje.

Dobrá zpráva: **plošnost (flatness) projde u 22 z 23 souborů** (jediná výjimka je
`Gemini_Generated_Image_lorjbvlorjbvlorj.jpg`, střed 0,675 / makro 0,295 = obrázek
s ústředním motivem). To je lepší než staré raw dávky, kde bylo
13–14 z 20 dlaždic „scéna“ (`docs/STYL_GRAFIKY.md` §8.6) — tyhle obrázky jsou
většinou opravdové povrchové textury, jen nejsou zašité do torusu.

## 3. Soubor po souboru — `tiles_gemini`

| Soubor | Co to je (odhad z barvy) | `wrap` H/V | kontrast | seam/zrno | horizont / střed | paleta (nejbližší) | Co s tím |
|---|---|---|---|---|---|---|---|
| `Gemini_Generated_Image_6pvk1v6pvk1v6pvk.jpg` | hlína / cesta (hnědá) | 28.6 / 34.0 | 21.3 | 1.01 | 0.013 / 0.002 | swamp 27 | není torus (nutné seamless_tiles.py); barva mimo paletu (nutné grade_tiles.py) |
| `Gemini_Generated_Image_9djj6o9djj6o9djj.jpg` | zelená vegetace (tráva–les) | 24.3 / 24.1 | 15.1 | 0.97 | 0.003 / 0.000 | swamp 33 | není torus (nutné seamless_tiles.py); barva mimo paletu (nutné grade_tiles.py) |
| `Gemini_Generated_Image_bbiw0zbbiw0zbbiw.jpg` | zelená vegetace (tráva–les) | 38.0 / 39.5 | 17.2 | 1.02 | 0.002 / 0.006 | forest 35 | není torus (nutné seamless_tiles.py); barva mimo paletu (nutné grade_tiles.py) |
| `Gemini_Generated_Image_e53e1ze53e1ze53e.jpg` | tmavá zelená vegetace (les / hluboký les) | 20.5 / 22.2 | 16.4 | 1.04 | 0.007 / 0.005 | forest 26 | není torus (nutné seamless_tiles.py); barva mimo paletu (nutné grade_tiles.py) |
| `Gemini_Generated_Image_eri5pxeri5pxeri5.jpg` | tmavá zelená vegetace (les / hluboký les) | 34.8 / 33.0 | 17.3 | 1.00 | 0.011 / 0.023 | forest 16 | není torus (nutné seamless_tiles.py) |
| `Gemini_Generated_Image_i1974wi1974wi197.jpg` | zelená vegetace (tráva–les) | 25.5 / 27.5 | 10.7 | 0.94 | 0.029 / 0.004 | forest 23 | není torus (nutné seamless_tiles.py); barva mimo paletu (nutné grade_tiles.py) |
| `Gemini_Generated_Image_ixgzdfixgzdfixgz.jpg` | zelená vegetace (tráva–les) | 39.6 / 37.8 | 12.0 | 1.01 | 0.040 / 0.000 | forest 37 | není torus (nutné seamless_tiles.py); barva mimo paletu (nutné grade_tiles.py) |
| `Gemini_Generated_Image_lorjbvlorjbvlorj.jpg` | obrázek scény (ústřední motiv / horizont) | 51.1 / 51.3 | 84.4 | 0.93 | 0.022 / 0.675 | mountain 16 | scéna → flatten, nebo vyřadit; není torus (nutné seamless_tiles.py) |
| `Gemini_Generated_Image_oq08t4oq08t4oq08.jpg` | hlína / cesta (hnědá) | 28.6 / 28.1 | 19.0 | 1.00 | 0.011 / 0.001 | grass 30 | není torus (nutné seamless_tiles.py); barva mimo paletu (nutné grade_tiles.py) |
| `Gemini_Generated_Image_p4cvypp4cvypp4cv.jpg` | zelená vegetace (tráva–les) | 47.9 / 41.0 | 23.5 | 1.02 | 0.004 / 0.002 | forest 29 | není torus (nutné seamless_tiles.py); barva mimo paletu (nutné grade_tiles.py) |
| `Gemini_Generated_Image_pdnstpdnstpdnstp.jpg` | zelená vegetace (tráva–les) | 32.0 / 30.0 | 13.1 | 0.95 | 0.045 / 0.001 | swamp 40 | není torus (nutné seamless_tiles.py); barva mimo paletu (nutné grade_tiles.py) |
| `Gemini_Generated_Image_sppfhgsppfhgsppf.jpg` | zelená vegetace (tráva–les) | 29.3 / 27.6 | 6.7 | 1.02 | 0.045 / 0.007 | forest 40 | není torus (nutné seamless_tiles.py); barva mimo paletu (nutné grade_tiles.py) |
| `Gemini_Generated_Image_txca6qtxca6qtxca.jpg` | světlá zelená (louka / tráva) | 19.6 / 18.6 | 12.0 | 1.01 | 0.016 / 0.004 | grass 19 | není torus (nutné seamless_tiles.py) |
| `Gemini_Generated_Image_xfypgfxfypgfxfyp.jpg` | světlá zelená (louka / tráva) | 24.3 / 23.6 | 18.9 | 0.97 | 0.000 / 0.002 | grass 20 | není torus (nutné seamless_tiles.py) |
| `Gemini_Generated_Image_y27ikty27ikty27i.jpg` | zelená vegetace (tráva–les) | 33.4 / 29.1 | 7.8 | 1.01 | 0.040 / 0.009 | forest 44 | není torus (nutné seamless_tiles.py); barva mimo paletu (nutné grade_tiles.py) |
| `Gemini_Generated_Image_yh3ireyh3ireyh3i.jpg` | zelená vegetace (tráva–les) | 26.7 / 33.8 | 19.6 | 1.03 | 0.008 / 0.009 | forest 29 | není torus (nutné seamless_tiles.py); barva mimo paletu (nutné grade_tiles.py) |

## 4. Soubor po souboru — `tiles_comfy`

| Soubor | Prompt z logu generátoru | `wrap` H/V | kontrast | seam/zrno | paleta | Co s tím |
|---|---|---|---|---|---|---|
| `07-grassy-meadow-top-view-orthoscopic-painted.png` | _v logu není_ | 20.9 / 20.5 | 6.3 | 0.99 | swamp 32 | není torus (nutné seamless_tiles.py); barva mimo paletu (nutné grade_tiles.py); jen 512 px (KB: pod nativním rozlišením SDXL → měkké) |
| `07-orthoscopic-drawn-2.png` | `grassy meadow, top view, flat, uniform light, orthoscopic, drawn` | 16.3 / 15.9 | 4.4 | 0.98 | swamp 31 | není torus (nutné seamless_tiles.py); nízký kontrast v 46 px; barva mimo paletu (nutné grade_tiles.py); jen 512 px (KB: pod nativním rozlišením SDXL → měkké) |
| `32-meadow-top-view-orthoscopic-drawn.png` | _v logu není_ | 23.2 / 20.0 | 10.4 | 0.96 | swamp 20 | není torus (nutné seamless_tiles.py); jen 512 px (KB: pod nativním rozlišením SDXL → měkké) |
| `comfyui-20260918-173720.png` | `grassy meadow, top view, flat with no perspective, uniform light, hand drawn` | 26.5 / 25.9 | 6.7 | 0.98 | swamp 29 | není torus (nutné seamless_tiles.py); barva mimo paletu (nutné grade_tiles.py) |
| `comfyui-20260918-175723.png` | `grassy meadow, top view, flat, orthoscopic, uniform light, drawn` | 26.3 / 26.9 | 6.8 | 0.96 | forest 31 | není torus (nutné seamless_tiles.py); barva mimo paletu (nutné grade_tiles.py) |
| `comfyui-20260918-175945.png` | `grassy meadow, top view, flat, orthoscopic, uniform light, drawn` | 29.3 / 33.0 | 7.9 | 1.02 | forest 29 | není torus (nutné seamless_tiles.py); barva mimo paletu (nutné grade_tiles.py) |
| `comfyui-20260918-180200.png` | `grassy meadow, top view, flat, orthoscopic, uniform light, drawn` | 29.6 / 28.1 | 7.1 | 1.05 | swamp 34 | není torus (nutné seamless_tiles.py); barva mimo paletu (nutné grade_tiles.py) |

## 5. Verdikt

**Jako hotová sada dlaždic: ani jedna složka použitelná není.** Chybí tři věci
současně:

1. **nejsou to torusy** (`wrap` 15,9–51,3 vs. limit 2,5) — ve hře by na každém
   obtáčení textury vznikl šev (kreslí se jako okno do torusu),
2. **část je mimo paletu** (odchylka od nejbližšího terénu palety > 22:
   12 ze 16 gemini, 6 ze 7 comfy),
3. **názvy a počty nesedí** — hra čte `<terén>-1.jpg` a `<terén>-2.jpg` pro
   10 terénů (`grass`, `forest`, `deep_forest`, `hills`, `mountain`, `water`,
   `swamp`, `snow`, `road`, `dirt`), tedy 20 souborů; v obou složkách je dohromady
   23 souborů, ale jen 2–3 různé terény a ani jeden z nich není voda, sníh,
   hory, kopce, močál nebo cesta.

**Jako surový materiál (raw) je `tiles_gemini` použitelný a slibný:** 1024 px,
15 z 16 plošných textur, kontrast 6,7–23,5 (limit ≥ 5), pestrá zelená škála
a 2 hnědé na hlínu/cestu. `tiles_comfy` je pro tvorbu sady **nadbytečný** — je to
kopie 7 obrázků z `user\pictures`, všechny na jeden terén (louka), a tři z nich
jsou jen 512 px (podle `kb/KB.md` je 512×512 pod nativním rozlišením SDXL → měkké;
`07-orthoscopic-drawn-2.png` má kontrast 4,4, tedy i pod limitem repa).

### Jak z kandidátů udělat použitelnou sadu

```bat
REM 1) kandidati jsou surove (raw) - prozenou se pipeline z docs/HANDOFF_GRAFIKA.md §5
python scripts\flatten_tiles.py --dir <raw>      REM jen kdyby vysla scena (tady 1 soubor)
python scripts\grade_tiles.py   --dir <flat> --out <graded>
python scripts\seamless_tiles.py --dir <graded> --out <final>   REM tohle dodela torus

REM 2) pojmenovat na <teren>-1.jpg / <teren>-2.jpg (presne nazvy terenu)
REM 3) zkopirovat do assets\tiles_<jmeno>\final\ a overit:
python scripts\check-tiles.py --dir assets\tiles_<jmeno>\final
python scripts\tile_flatness.py assets\tiles_<jmeno>\final
python scripts\tile_sharpness.py --dir assets\tiles_<jmeno>\final --ref <raw>
```

Pak sadu zobrazit v `tools/tiles/preview.html` a zapsat do `G.TILE_SETS`
(`js/render/tiles_ai.js`) — teprve pak ji jde přepnout v debug panelu.

Pozor na past 28/31 z `docs/HANDOFF.md`: zacelení švu umí dlaždici rozmazat.
Proto se po `seamless_tiles.py` **vždy** pouští `tile_sharpness.py` (limit 0,85).

## 6. Vedlejší nález: `user\pictures` (odkud comfy soubory pocházejí)

Ve složce právě **běží generování** (nejnovější soubory mají čas pár minut zpět).
V době psaní reportu v ní bylo **176 obrázků**, měření proběhlo na snapshotu
**163 souborů** (složka roste i během analýzy). Jsou to rendry z lokálního
ComfyUI/SDXL (`obrazky\img.cmd`, log `kb\generations.jsonl`) podle matice
**předmět × pohled × perspektiva × styl**:

- předmět: `grassy-meadow, meadow, clearing, forest, canopy, savannah, rocks`
- pohled: `top-view` / `side-view`
- perspektiva: `bird-s-view` / `orthoscopic` / `isometric`
- styl: `computer-graphics` / `medieval` / `painted` / `drawn`

Změřeno (163 souborů): **119 (73 %) je scéna**, ne plošná textura;
torus splňuje jen **27** z 163; kontrast 4,4–88,6.
To je přesně past z `docs/STYL_GRAFIKY.md` §8.6: prompt „no horizon, no sky,
no central object“ kompozici neuhlídá — u bočních pohledů vyjde krajina,
u top-view se to daří jen u části (louky ano, skály/savana skoro nikdy).

Pro dlaždice mají smysl jen **top-view a zároveň ne-scéna** — takových je
**28 z 163**:

| Soubor | kontrast | `wrap` H/V | horizont / střed |
|---|---|---|---|
| `73-forest-top-view-bird-s-view-computer-graphics.png` | 38.4 | 55.5 / 57.1 | 0.002 / 0.039 |
| `84-forest-top-view-isometric-drawn.png` | 37.6 | 24.0 / 29.3 | 0.028 / 0.036 |
| `59-clearing-top-view-isometric-painted.png` | 36.4 | 4.8 / 1.5 | 0.015 / 0.011 |
| `80-forest-top-view-orthoscopic-drawn.png` | 33.6 | 29.4 / 29.4 | 0.022 / 0.038 |
| `104-canopy-top-view-orthoscopic-drawn.png` | 33.1 | 1.7 / 1.0 | 0.002 / 0.026 |
| `79-forest-top-view-orthoscopic-painted.png` | 31.5 | 24.7 / 24.0 | 0.027 / 0.014 |
| `36-meadow-top-view-isometric-drawn.png` | 30.2 | 14.3 / 15.9 | 0.023 / 0.017 |
| `52-clearing-top-view-bird-s-view-drawn.png` | 29.9 | 4.9 / 2.5 | 0.014 / 0.013 |
| `76-forest-top-view-bird-s-view-drawn.png` | 24.3 | 25.1 / 29.1 | 0.002 / 0.006 |
| `11-grassy-meadow-top-view-isometric-painted.png` | 22.5 | 29.3 / 35.9 | 0.041 / 0.048 |
| `128-savannah-top-view-orthoscopic-drawn.png` | 20.9 | 7.1 / 4.5 | 0.001 / 0.009 |
| `27-meadow-top-view-bird-s-view-painted.png` | 19.5 | 20.8 / 23.8 | 0.026 / 0.018 |
| `51-clearing-top-view-bird-s-view-painted.png` | 18.5 | 10.8 / 11.9 | 0.006 / 0.026 |
| `30-meadow-top-view-orthoscopic-medieval.png` | 18.3 | 13.2 / 12.8 | 0.019 / 0.016 |

(Vypsáno 14 s nejvyšším kontrastem; celý seznam je v
`assets/tiles_analyza/metrics_user_pictures.json`.)

### Podle skupin (průměr)

| Předmět | Pohled | Počet | Z toho scéna | Kontrast | `wrap` H/V |
|---|---|---|---|---|---|
| ? | ? | 9 | 1 | 16.3 | 27.5 / 28.7 |
| canopy | side-view | 12 | 12 | 56.6 | 15.0 / 33.8 |
| canopy | top-view | 12 | 11 | 57.1 | 18.8 / 15.7 |
| clearing | side-view | 12 | 11 | 50.7 | 26.3 / 24.8 |
| clearing | top-view | 12 | 9 | 46.7 | 14.6 / 13.5 |
| forest | side-view | 12 | 10 | 54.6 | 45.0 / 53.3 |
| forest | top-view | 11 | 6 | 37.9 | 40.8 / 40.8 |
| grassy-meadow | side-view | 12 | 9 | 34.9 | 25.2 / 42.3 |
| grassy-meadow | top-view | 12 | 2 | 15.3 | 23.6 / 21.7 |
| meadow | side-view | 12 | 11 | 40.1 | 18.6 / 38.2 |
| meadow | top-view | 12 | 4 | 21.8 | 25.2 / 22.9 |
| rocks | top-view | 11 | 11 | 64.2 | 29.4 / 23.6 |
| savannah | side-view | 12 | 11 | 51.6 | 12.7 / 20.5 |
| savannah | top-view | 12 | 11 | 54.4 | 20.8 / 24.9 |

(Řádek `? / ?` = starší soubory z poolu s jiným schématem názvů, např.
`comfyui-20260918-*.png` a `07-orthoscopic-drawn-2.png`.)

## 7. Omezení této analýzy

- **Vision (Gemini) neběžel.** Free tier klíče má dnes vyčerpaný limit
  (`gemini-3.6-flash`: 20 requestů, `gemini-3.1-pro-preview`: 0) — proto je obsah
  určený z barevných statistik a z promptů v `generations.jsonl`, ne z popisu
  modelu. U `tiles_comfy` je to přesné (prompty se v logu našly),
  u `tiles_gemini` je to **odhad** (např. „tmavá zelená“ = les vs. hluboký les
  z barvy nepoznám spolehlivě). Až se kvóta obnoví, můžu pustit
  `vision --mode asset` na všech 23 souborech a doplnit slovní popis.
- **Barvu proti paletě** měříme po převedení na 192 px; u 512px souborů je
  zmenšení zdola nahoru, což kontrast i ostrost mírně podhodnotí.
- **Složka `user\pictures` roste**, čísla v §6 platí k okamžiku měření.

## 8. Kde jsou podklady

| Soubor | Obsah |
|---|---|
| `assets/tiles_analyza/metrics.json` | metriky 23 kandidátů |
| `assets/tiles_analyza/metrics_reference.json` | tytéž metriky pro nasazenou sadu a oba přijaté kandidáty |
| `assets/tiles_analyza/metrics_user_pictures.json` | metriky obrázků z `user\pictures` |
| `assets/tiles_analyza/classify.json` | barevná klasifikace (top 3 terény podle palety) |
| `assets/tiles_analyza/run_vision.ps1` | dávka vision popisů (spustit, až bude kvóta) |

Vše v `assets/tiles_analyza/` je gitignored (`assets/tiles_*/`).
