/**
 * tiles_ai.js — volitelné malované dlaždice z AI (bitmapy).
 *
 * Hra umí dlaždice kreslit kódem (`art.js`) — to je výchozí a vždy funkční.
 * Tenhle modul přidává druhou sadu: obrázky `assets/tiles/<terén>-<n>.jpg`,
 * které se načtou do canvasů ve stejném rozlišení (192 px), takže se kreslí
 * úplně stejnou cestou (`world.js` → `G.tileArt`).
 *
 * Dvě věci, které AI dlaždice potřebují, aby se daly ve hře použít:
 *  1) BAREVNÁ KOREKCE — model vrátí „vodu" zelenou a „sníh" tmavý; hráč musí
 *     terén poznat na první pohled. Každý terén má cílový průměr barvy a dlaždice
 *     se k němu posune (textura zůstane, jen se srovná jas a odstín).
 *  2) VARIANTY — jediná textura opakovaná po mapě bije do očí. Z každé dlaždice
 *     se dělá 8 variant (2 textury × zrcadlení × jas).
 *
 * Přepínač: `settings.tileStyle = 'code' | 'ai'` (menu ☰ → Vzhled mapy).
 */
(function () {
  const G = window.Game;

  const TERRAINS = ['grass','forest','deep_forest','hills','mountain','water','swamp','snow','road','dirt'];
  const RES = 192;               // stejné rozlišení jako procedurální dlaždice
  const SRC = 'assets/tiles/';
  const GRADE = 1.0;             // 1 = průměr dlaždice přesně na cíli
  const CONTRAST = 1.06;         // mírné přiostření hodnot

  /** Cílový průměr barvy pro čitelnost terénu (odvozeno z měření dlaždic). */
  const TARGET = {
    grass:       [104, 108,  56],
    forest:      [ 54,  72,  40],
    deep_forest: [ 34,  48,  32],
    hills:       [ 98,  94,  72],
    mountain:    [108, 108, 106],
    water:       [ 52,  92, 122],   // modrozelená — musí být poznat voda
    swamp:       [ 84,  80,  46],
    snow:        [196, 204, 212],   // nejsvětlejší terén
    road:        [122, 100,  66],
    dirt:        [138, 116,  80]
  };

  /** 8 variant na terén: 2 textury × zrcadlení × jas. */
  const VARIANTS = [
    { file:1, mul:1.00, flip:''   },
    { file:2, mul:1.00, flip:'h'  },
    { file:1, mul:0.93, flip:'v'  },
    { file:2, mul:1.06, flip:'h'  },
    { file:1, mul:1.00, flip:'h'  },
    { file:2, mul:0.95, flip:''   },
    { file:1, mul:1.05, flip:'hv' },
    { file:2, mul:0.98, flip:'v'  }
  ];

  G.AI_TILES = { ready:false, loading:false, tiles:{}, loaded:0, failed:0, graded:0 };

  /** Aktivní vzhled mapy: 'code' (kreslený) nebo 'ai' (bitmapy). */
  G.tileStyle = function () {
    const s = (G.state && G.state.settings) || {};
    return s.tileStyle === 'ai' ? 'ai' : 'code';
  };
  G.setTileStyle = function (style) {
    if (!G.state) return 'code';
    if (!G.state.settings) G.state.settings = {};
    G.state.settings.tileStyle = (style === 'ai') ? 'ai' : 'code';
    if (G.state.settings.tileStyle === 'ai' && G.loadAiTiles) G.loadAiTiles();
    return G.state.settings.tileStyle;
  };

  /** Srovná dlaždici k cílové barvě terénu (zachová texturu). */
  function gradeCanvas(src, terrain) {
    const tgt = TARGET[terrain];
    const c = document.createElement('canvas');
    c.width = RES; c.height = RES;
    const x = c.getContext('2d');
    x.drawImage(src, 0, 0, RES, RES);
    if (!tgt) return c;
    const im = x.getImageData(0, 0, RES, RES), d = im.data;
    // průměrná barva dlaždice
    let sr = 0, sg = 0, sb = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { sr += d[i]; sg += d[i+1]; sb += d[i+2]; n++; }
    const mean = [sr / n, sg / n, sb / n];
    // posun průměru k cíli (přesně) + mírný kontrast; textura zůstane
    const sh = [0, 0, 0];
    for (let k = 0; k < 3; k++) sh[k] = (tgt[k] - mean[k]) * GRADE;
    for (let i = 0; i < d.length; i += 4) {
      d[i]   = Math.max(0, Math.min(255, (d[i]   - mean[0]) * CONTRAST + mean[0] + sh[0]));
      d[i+1] = Math.max(0, Math.min(255, (d[i+1] - mean[1]) * CONTRAST + mean[1] + sh[1]));
      d[i+2] = Math.max(0, Math.min(255, (d[i+2] - mean[2]) * CONTRAST + mean[2] + sh[2]));
    }
    x.putImageData(im, 0, 0);
    return c;
  }

  /** Z hotové dlaždice udělá variantu (zrcadlení + jas). */
  function variantOf(src, mul, flip) {
    const c = document.createElement('canvas');
    c.width = RES; c.height = RES;
    const x = c.getContext('2d');
    x.save();
    x.translate(flip.indexOf('h') >= 0 ? RES : 0, flip.indexOf('v') >= 0 ? RES : 0);
    x.scale(flip.indexOf('h') >= 0 ? -1 : 1, flip.indexOf('v') >= 0 ? -1 : 1);
    x.drawImage(src, 0, 0, RES, RES);
    x.restore();
    if (mul !== 1) {
      x.globalCompositeOperation = 'source-atop';
      x.fillStyle = mul < 1
        ? 'rgba(0,0,0,' + (1 - mul).toFixed(2) + ')'
        : 'rgba(255,255,255,' + (mul - 1).toFixed(2) + ')';
      x.fillRect(0, 0, RES, RES);
    }
    return c;
  }

  /** Načte AI dlaždice (jednorázově). Když chybí, hra jede dál kresleně. */
  G.loadAiTiles = function (done) {
    const A = G.AI_TILES;
    if (A.ready || A.loading) { if (done) done(A); return; }
    if (typeof Image !== 'function') { if (done) done(A); return; }
    A.loading = true;
    const imgs = {};
    const paths = [];
    for (const t of TERRAINS) for (const v of [1, 2]) paths.push(t + '-' + v);
    if (!paths.length) { A.loading = false; if (done) done(A); return; }
    let finished = 0;
    for (const key of paths) {
      const img = new Image();
      img.onload = () => { imgs[key] = img; step(); };
      img.onerror = () => { A.failed++; step(); };
      img.src = SRC + key + '.jpg';
    }
    function step() {
      finished++;
      if (finished < paths.length) return;
      for (const t of TERRAINS) {
        const graded = {};
        for (const v of [1, 2]) {
          const img = imgs[t + '-' + v];
          if (img) { graded[v] = gradeCanvas(img, t); A.graded++; }
        }
        const list = [];
        for (const cfg of VARIANTS) {
          const src = graded[cfg.file];
          if (src) list.push(variantOf(src, cfg.mul, cfg.flip));
        }
        if (list.length) { A.tiles[t] = list; A.loaded++; }
      }
      A.ready = A.loaded > 0;
      A.loading = false;
      if (G.refreshPanel) G.refreshPanel();
      if (done) done(A);
    }
  };

  /** Dlaždice pro vykreslení: AI bitmapa (když je zapnutá a načtená), jinak kresba. */
  G.tileArt = function (terrain, variant) {
    if (G.tileStyle() === 'ai') {
      const list = G.AI_TILES.tiles[terrain];
      if (list && list.length) {
        const i = ((variant | 0) % list.length + list.length) % list.length;
        return list[i];
      }
    }
    return G.getTileArt(terrain, variant);
  };
})();
