/**
 * tiles_ai.js — malované dlaždice z AI jako TORUS, vzorkovaný ve světě.
 *
 * Starý přístup (8 variant obrázku: zrcadlení + jas) byl příčinou viditelných
 * švů: dlaždice byla samostatná malba, takže na každé hranici skočila. Naměřeno
 * `scripts/check-tiles.py`: seam 23, wrap 27,9 (255 = plný rozdíl).
 *
 * Nový přístup: dlaždice **není obrázek, ale okno** do torusu textury.
 *   - Assety jsou **skutečné torusy** (levý sloupec = pravý, horní = spodní) —
 *     dopočítané skriptem `scripts/seamless_tiles.py` (offset + zacelení).
 *   - Kreslí se **výřez** z textury, jehož počátek se posouvá o okno na každou
 *     dlaždici světa. Sousední dlaždice jsou tedy sousední výřezy téhož
 *     spojitého obrazu -> šev nemůže vzniknout (měřeno seam/zrno 0,74).
 *   - Okno je 1/6 textury, takže se obsah zopakuje až po 6 dlaždicích (a přes
 *     to se v další fázi položí světová dekorace — viz docs/STYL_GRAFIKY.md).
 *
 * Volitelně (`G.AI_TILES.blend`) se dvě textury téhož terénu prolínají váhou,
 * která se mění pomalu ve světových souřadnicích. Váha je spojitá, takže šev
 * nevznikne, a perioda opakování zmizí úplně (měřeno: period None). Cena je
 * ~13 % kontrastu v místě, kde je prolnutí půl na půl — proto je výchozí 0
 * a hodnotu je nejlepší vybrat okem v `tools/tiles/preview.html`.
 *
 * PŘECHODY TERÉNŮ (`G.AI_TILES.transition`, výchozí 0 = vyp):
 *   Tohle řeší „ostrou hranu“ mezi dvěma RŮZNÝMI terény (louka/voda, les/louka).
 *   Dlaždice se ptá světa (`G.WORLD.terrainAt`) na okolí: váha, kterou má
 *   v okně zabrat sousední terén, je podíl Gaussova jádra, které tomu terénu
 *   patří — takže se mění plynule po dlaždicích a přechod je **zóna** o 1–3
 *   dlaždicích, ne jeden pruh. Rovná hranice se navíc rozbije hladkým šumem
 *   (`field`), aby přechod nebyl vidět jako linie mezi dlaždicemi.
 *   Kreslí se jen dvě `drawImage` (základ A, přes něj soused B s alfou), takže
 *   cena je stejná jako u `blend`. Nikdy nepřepne víc než `TRANS_MAX` — dlaždice
 *   si vždycky nechá většinu svého terénu.
 *   Ladí se v debug panelu (Mapa — vzhled → „přechody terénů“).
 *
 * DŮLEŽITÉ: tenhle modul NESMÍ volat `getImageData` ani `toDataURL` — při
 * otevření hry z `file://` canvas s obrázkem z disku "taintuje" a čtení pixelů
 * by hodilo SecurityError. Kreslení (`drawImage`) je bezpečné.
 *
 * Přepínač: `settings.tileStyle = 'code' | 'ai'` (menu ☰ → Vzhled mapy).
 */
(function () {
  const G = window.Game;

  const TERRAINS = ['grass','forest','deep_forest','hills','mountain','water','swamp','snow','road','dirt'];
  // Cesta k assetům jde přepsat (G.AI_TILE_DIR nastaveným PŘED načtením tohoto
  // skriptu) — používá to náhledová stránka `tools/tiles/preview.html`.
  G.AI_TILE_DIR = G.AI_TILE_DIR || 'assets/tiles/';
  const REPEAT = 6;              // jedna textura pokryje 6 dlaždic (perioda)
  const BLEND_X = 29, BLEND_Y = 43;  // periody váhy prolnutí (nesoudělné s 6)
  const TRANS_ZONE = 2;          // výchozí šířka přechodové zóny (v dlaždicích)
  const TRANS_MAX = 0.5;         // víc než půlka by terén rovnou přepnula

  /**
   * Sady dlaždic, mezi kterými jde přepnout v debug panelu (Mapa — vzhled).
   * První je vždy ta nasazená. Kandidátské sady jsou gitignored a v čistém
   * checkoutu neexistují — `setTileSet` proto před přepnutím zkusí jeden
   * soubor načíst a když chybí, sadu **nepřepne** (jinak by hra tiše spadla
   * na kreslenou cestu a nebylo by poznat, že přepnutí neprošlo).
   */
  G.TILE_SETS = G.TILE_SETS || [
    { id: 'base',        dir: G.AI_TILE_DIR,                     name: 'současná' },
    { id: 'kronika',     dir: 'assets/tiles_kronika/final/',     name: 'kronika-ilustrace' },
    { id: 'kronika-tex', dir: 'assets/tiles_kronika_tex/final/', name: 'kronika-textura' },
    // Sada z lokálního ComfyUI (matice promptů + měřítko krajiny), 20. 9. 2026.
    { id: 'drawn',       dir: 'assets/tiles_drawn/final/',       name: 'kreslený (drawn)' },
    // Gemini dlaždice: názvy souborů žádný terén neobsahují, přiřazení je
    // odhad z naměřené barvy (`assets/tiles_gemini_set/_mapovani.md`). Chybí
    // voda, sníh a cesta — tam se kreslí kreslená dlaždice.
    { id: 'gemini',      dir: 'assets/tiles_gemini_set/final/',  name: 'gemini (odhad terénů)' },
    // Starší kandidát z `make_tile_set.py --name moje`.
    { id: 'moje',        dir: 'assets/tiles_moje/final/',        name: 'moje (starší)' }
  ];

  /** Id aktivní sady dlaždic (neznámé id spadne na první sadu). */
  G.tileSet = function () {
    const s = (G.state && G.state.settings) || {};
    const list = G.TILE_SETS || [];
    if (list.some(x => x.id === s.tileSet)) return s.tileSet;
    return (list[0] && list[0].id) || 'base';
  };

  /** Adresář aktivní sady (s koncovým lomítkem). */
  G.tileSetDir = function () {
    const list = G.TILE_SETS || [];
    const id = G.tileSet();
    const set = list.filter(x => x.id === id)[0] || list[0];
    return (set && set.dir) || G.AI_TILE_DIR;
  };

  /** Přepne sadu dlaždic (a znovu je načte). Vrací použitou sadu, nebo null. */
  G.setTileSet = function (id, done) {
    const set = (G.TILE_SETS || []).filter(x => x.id === id)[0];
    if (!set || !G.state) return null;
    const apply = () => {
      if (!G.state.settings) G.state.settings = {};
      G.state.settings.tileSet = set.id;
      const A = G.AI_TILES;
      A.tiles = {}; A.ready = false; A.loaded = 0; A.failed = 0; A.loading = false;
      if (G.tileStyle() === 'ai' && G.loadAiTiles) G.loadAiTiles();
      if (G.drawWorldFrame) G.drawWorldFrame();
      if (done) done(set);
    };
    // v Node/testech Image není — tam se přepne rovnou (testy si Image stubbují)
    if (typeof Image !== 'function') { apply(); return set; }
    const probe = new Image();
    let answered = false;
    probe.onload = () => { if (!answered) { answered = true; apply(); } };
    probe.onerror = () => { if (!answered) { answered = true; if (done) done(null); } };
    probe.src = set.dir + TERRAINS[0] + '-1.jpg';
    return set;
  };

  G.AI_TILES = {
    ready: false, loading: false, tiles: {}, loaded: 0, failed: 0,
    /** 0 = jen jedna textura, 1 = plné prolnutí dvou textur téhož terénu. */
    blend: 0,
    /** 0 = ostré hrany terénů, 1 = plné prolnutí se sousedem (viz `tileMixAt`). */
    transition: 0,
    /** Šířka přechodové zóny v dlaždicích (1–3). */
    spread: TRANS_ZONE,
    repeat: REPEAT
  };

  /** Aktivní vzhled mapy: 'code' (kreslený), 'ai' (bitmapy) nebo 'foundry' (světová vrstva). */
  G.tileStyle = function () {
    const s = (G.state && G.state.settings) || {};
    if (s.tileStyle === 'ai') return 'ai';
    if (s.tileStyle === 'foundry') return 'foundry';
    return 'code';
  };
  G.setTileStyle = function (style) {
    if (!G.state) return 'code';
    if (!G.state.settings) G.state.settings = {};
    const v = (style === 'ai' || style === 'foundry') ? style : 'code';
    G.state.settings.tileStyle = v;
    if (v === 'ai') {
      if (G.loadAiTiles) G.loadAiTiles();
      if (G.loadAiUnits) G.loadAiUnits();
    }
    if (G.drawWorldFrame) G.drawWorldFrame();
    return v;
  };

  /** Nastaví míru prolnutí dvou textur (0–1). Vrací použitou hodnotu. */
  G.setTileBlend = function (v) {
    const b = Math.max(0, Math.min(1, Number(v) || 0));
    G.AI_TILES.blend = b;
    return b;
  };

  /** Uloží jednu hodnotu do `settings` (ať vyladěný vzhled přežije reload). */
  function saveTileSetting(key, value) {
    if (!G.state) return;
    if (!G.state.settings) G.state.settings = {};
    G.state.settings[key] = value;
  }

  /** Promítne uložené hodnoty přechodů do `G.AI_TILES` (volá se při kreslení). */
  function applyTileSettings() {
    const s = (G.state && G.state.settings) || null;
    const A = G.AI_TILES;
    if (!s) return A;
    if (s.tileTransition !== undefined) {
      A.transition = Math.max(0, Math.min(1, Number(s.tileTransition) || 0));
    }
    if (s.tileSpread !== undefined) {
      A.spread = Math.max(1, Math.min(3, Math.round(Number(s.tileSpread) || TRANS_ZONE)));
    }
    return A;
  }

  /**
   * Síla prolévání se sousedním terénem (0–1). 0 = ostré hrany (původní stav).
   * Ukládá se do `settings.tileTransition`.
   */
  G.setTileTransition = function (v) {
    const x = Math.max(0, Math.min(1, Number(v) || 0));
    G.AI_TILES.transition = x;
    saveTileSetting('tileTransition', x);
    if (G.drawWorldFrame) G.drawWorldFrame();
    return x;
  };

  /** Šířka přechodové zóny v dlaždicích (1–3). Ukládá se do `settings.tileSpread`. */
  G.setTileSpread = function (v) {
    const x = Math.max(1, Math.min(3, Math.round(Number(v) || TRANS_ZONE)));
    G.AI_TILES.spread = x;
    saveTileSetting('tileSpread', x);
    if (G.drawWorldFrame) G.drawWorldFrame();
    return x;
  };

  // ---------------------------------------------------------------------------
  //  Šum pro hranici přechodu. Je tu VLASTNÍ kopie (a ne `G.foundryField`),
  //  aby šel tenhle modul načíst a otestovat sám, bez art.js — viz
  //  `test/tile-transition.js`. Stejný princip: hash + hladká interpolace.
  // ---------------------------------------------------------------------------
  function hash2(x, y, s) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2246822519);
    h = Math.imul(h ^ (h >>> 15), 1274126177);
    h ^= h >>> 13;
    h = Math.imul(h, 2654435761);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function fade(t) { return t * t * (3 - 2 * t); }

  /** Hladké pole ve světových dlaždicích (bilineární hodnotový šum), 0..1. */
  function field(x, y, cell, salt) {
    const gx = x / cell, gy = y / cell;
    const ix = Math.floor(gx), iy = Math.floor(gy);
    const fx = fade(gx - ix), fy = fade(gy - iy);
    const a = hash2(ix, iy, salt), b = hash2(ix + 1, iy, salt);
    const c = hash2(ix, iy + 1, salt), d = hash2(ix + 1, iy + 1, salt);
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  }

  /**
   * Váhy jádra pro daný poloměr (jen dx, dy, k). Počítá se jednou pro každý
   * poloměr — `Math.exp` by se jinak volal pro každou dlaždici a každý vzorek.
   */
  const kernelCache = {};
  function kernel(r) {
    if (kernelCache[r]) return kernelCache[r];
    const sigma = Math.max(0.8, r / 1.5);
    const out = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const d2 = dx * dx + dy * dy;
      if (d2 > r * r) continue;
      out.push([dx, dy, Math.exp(-d2 / (2 * sigma * sigma))]);
    }
    kernelCache[r] = out;
    return out;
  }

  /**
   * S kým a jak silně se má dlaždice (x, y) prolít.
   *
   * Vrací `{ terrain, weight }`, nebo null (žádný přechod).
   *
   * Kdo: dominantní CIZÍ terén v okolí (podíl Gaussova jádra o poloměru
   * `G.AI_TILES.spread`) — je to robustní i na nároží, kde se potkávají tři
   * terény.
   *
   * Jak silně: podle VZDÁLENOSTI od toho terénu (1 dlaždice = plná polovina,
   * dál se to lineárně ztiší na nulu) — takže přechod je **zóna** o `spread`
   * dlaždicích, ne skok. Rovnou linii rozbíjí hladký šum a `TRANS_MAX` hlídá,
   * aby dlaždice zůstala většinově sama sebou.
   */
  G.tileMixAt = function (x, y) {
    const A = G.AI_TILES;
    if (!(A.transition > 0)) return null;
    const world = G.WORLD;
    if (!world || !world.terrainAt) return null;
    const self = world.terrainAt(x, y);
    if (!self) return null;

    const r = Math.max(1, Math.min(3, A.spread | 0 || TRANS_ZONE));
    const acc = {}, dist = {};
    let total = 0;
    for (const k3 of kernel(r)) {
      const dx = k3[0], dy = k3[1], k = k3[2];
      const t = (dx || dy) ? world.terrainAt(x + dx, y + dy) : self;
      if (!t) continue;
      acc[t] = (acc[t] || 0) + k;
      total += k;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      if (dist[t] === undefined || d < dist[t]) dist[t] = d;
    }
    if (total <= 0) return null;

    let best = null, bw = 0;
    for (const t in acc) {
      if (t === self) continue;
      const v = acc[t] / total;
      if (v > bw) { bw = v; best = t; }
    }
    if (!best) return null;
    // podíl jádra je zanedbatelný -> terén se tam jen mihne, neprolévat
    if (bw < 0.02) return null;

    const n = 0.65 * field(x, y, 3.2, 17) + 0.35 * field(x, y, 1.3, 29);
    const near = Math.max(1, dist[best] || r);
    const falloff = 1 - (near - 1) / r;            // 1 dlaždice = 1, okraj zóny = 1/r
    let weight = TRANS_MAX * falloff * (0.55 + 0.9 * n) * A.transition;
    weight = Math.max(0, Math.min(TRANS_MAX, weight));
    if (weight < 0.02) return null;
    return { terrain: best, weight: weight };
  };

  /**
   * Načte textury dlaždic (jednorázově). Když chybí, hra jede dál kresleně.
   * Načítá se `<terén>-1` (základ) a `<terén>-2` (pro volitelné prolnutí).
   */
  G.loadAiTiles = function (done) {
    const A = G.AI_TILES;
    if (A.ready || A.loading) { if (done) done(A); return; }
    if (typeof Image !== 'function') { if (done) done(A); return; }
    A.loading = true;
    const src = G.tileSetDir ? G.tileSetDir() : G.AI_TILE_DIR;
    const jobs = [];
    for (const t of TERRAINS) for (const n of [1, 2]) jobs.push([t, n]);

    let finished = 0;
    const imgs = {};
    for (const [terrain, n] of jobs) {
      const img = new Image();
      img.onload = () => { imgs[terrain + '-' + n] = img; step(); };
      img.onerror = () => { A.failed++; step(); };
      img.src = src + terrain + '-' + n + '.jpg';
    }

    function step() {
      if (++finished < jobs.length) return;
      for (const t of TERRAINS) {
        const a = imgs[t + '-1'];
        if (!a) continue;
        // okno musí dělit texturu beze zbytku, aby výřez nikdy nepřetekl
        const win = Math.max(16, Math.floor(a.width / REPEAT));
        A.tiles[t] = {
          a, b: imgs[t + '-2'] || null, win,
          px: Math.max(1, Math.floor(a.width / win)),
          py: Math.max(1, Math.floor(a.height / win))
        };
        A.loaded++;
      }
      A.ready = A.loaded > 0;
      A.loading = false;
      if (G.refreshPanel) G.refreshPanel();
      if (G.drawWorldFrame) G.drawWorldFrame();
      if (done) done(A);
    }
  };

  /**
   * Vykreslí dlaždici terénu na světových souřadnicích (wx, wy).
   *
   * Vrací true, když dlaždici nakreslil (malovaný vzhled), false když nemá
   * čím — pak si volající kreslí záložní dlaždici přes `G.tileArt`.
   * POZOR: dvojice drawImage je záměrná — A se kreslí neprůhledně a teprve
   * přes něj B s váhou (1-wa). Kdyby se kreslily obě s alfou, výsledek by se
   * násobil a prolnutí by nesedělo.
   *
   * Když je zapnutý přechod terénů (`G.AI_TILES.transition`), přidá se TŘETÍ
   * kreslení: okno sousedního terénu s váhou z `G.tileMixAt`. Okno se bere
   * z rozměrů toho druhého terénu, protože každá textura může mít jiné `win`.
   */
  G.tileDraw = function (ctx, terrain, dx, dy, size, wx, wy) {
    if (G.tileStyle() !== 'ai') return false;
    const A = applyTileSettings();
    const t = A.tiles[terrain];
    if (!t || !t.a) return false;

    const sx = (((wx % t.px) + t.px) % t.px) * t.win;
    const sy = (((wy % t.py) + t.py) % t.py) * t.win;
    const w = t.win;
    const bl = A.blend;

    if (bl <= 0 || !t.b) {
      ctx.globalAlpha = 1;
      ctx.drawImage(t.a, sx, sy, w, w, dx, dy, size, size);
    } else {
      // wa = váha textury A; B dostane 1-wa
      const wave = 0.5 + 0.5 * Math.sin(2 * Math.PI * (wx / BLEND_X + wy / BLEND_Y));
      const wa = (1 - bl) + bl * wave;
      ctx.globalAlpha = 1;
      ctx.drawImage(t.a, sx, sy, w, w, dx, dy, size, size);
      ctx.globalAlpha = 1 - wa;
      ctx.drawImage(t.b, sx, sy, w, w, dx, dy, size, size);
      ctx.globalAlpha = 1;
    }

    const mix = G.tileMixAt(wx, wy);
    if (mix) {
      const tb = A.tiles[mix.terrain];
      if (tb && tb.a) {
        const bx = (((wx % tb.px) + tb.px) % tb.px) * tb.win;
        const by = (((wy % tb.py) + tb.py) % tb.py) * tb.win;
        ctx.globalAlpha = mix.weight;
        ctx.drawImage(tb.a, bx, by, tb.win, tb.win, dx, dy, size, size);
        ctx.globalAlpha = 1;
      }
    }
    return true;
  };

  /**
   * Kreslená dlaždice — ZÁLOŽNÍ cesta (když malovaný vzhled není zapnutý nebo
   * se textury nenačetly). Malované dlaždice se nekreslí tudy: nejsou to
   * samostatné obrázky, ale výřezy z torusu, a potřebují světové souřadnice.
   */
  G.tileArt = function (terrain, variant) {
    return G.getTileArt(terrain, variant);
  };
})();
