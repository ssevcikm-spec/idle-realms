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
  const SRC = G.AI_TILE_DIR;
  const REPEAT = 6;              // jedna textura pokryje 6 dlaždic (perioda)
  const BLEND_X = 29, BLEND_Y = 43;  // periody váhy prolnutí (nesoudělné s 6)

  G.AI_TILES = {
    ready: false, loading: false, tiles: {}, loaded: 0, failed: 0,
    /** 0 = jen jedna textura, 1 = plné prolnutí dvou textur téhož terénu. */
    blend: 0,
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

  /**
   * Načte textury dlaždic (jednorázově). Když chybí, hra jede dál kresleně.
   * Načítá se `<terén>-1` (základ) a `<terén>-2` (pro volitelné prolnutí).
   */
  G.loadAiTiles = function (done) {
    const A = G.AI_TILES;
    if (A.ready || A.loading) { if (done) done(A); return; }
    if (typeof Image !== 'function') { if (done) done(A); return; }
    A.loading = true;
    const jobs = [];
    for (const t of TERRAINS) for (const n of [1, 2]) jobs.push([t, n]);

    let finished = 0;
    const imgs = {};
    for (const [terrain, n] of jobs) {
      const img = new Image();
      img.onload = () => { imgs[terrain + '-' + n] = img; step(); };
      img.onerror = () => { A.failed++; step(); };
      img.src = SRC + terrain + '-' + n + '.jpg';
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
   */
  G.tileDraw = function (ctx, terrain, dx, dy, size, wx, wy) {
    if (G.tileStyle() !== 'ai') return false;
    const A = G.AI_TILES;
    const t = A.tiles[terrain];
    if (!t || !t.a) return false;

    const sx = (((wx % t.px) + t.px) % t.px) * t.win;
    const sy = (((wy % t.py) + t.py) % t.py) * t.win;
    const w = t.win;
    const bl = A.blend;

    if (bl <= 0 || !t.b) {
      ctx.drawImage(t.a, sx, sy, w, w, dx, dy, size, size);
      return true;
    }
    // wa = váha textury A; B dostane 1-wa
    const wave = 0.5 + 0.5 * Math.sin(2 * Math.PI * (wx / BLEND_X + wy / BLEND_Y));
    const wa = (1 - bl) + bl * wave;
    ctx.globalAlpha = 1;
    ctx.drawImage(t.a, sx, sy, w, w, dx, dy, size, size);
    ctx.globalAlpha = 1 - wa;
    ctx.drawImage(t.b, sx, sy, w, w, dx, dy, size, size);
    ctx.globalAlpha = 1;
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
