/**
 * tiles_ai.js — volitelné malované dlaždice z AI (bitmapy).
 *
 * Hra umí dlaždice kreslit kódem (`art.js`) — to je výchozí a vždy funkční.
 * Tenhle modul přidává druhou sadu: obrázky `assets/tiles/<terén>-<n>.jpg`,
 * které se načtou do canvasů ve stejném rozlišení (192 px) a kreslí se úplně
 * stejnou cestou (`world.js` → `G.tileArt`).
 *
 * DŮLEŽITÉ: dlaždice jsou už **předem barevně srovnané** (skript
 * `scripts/grade_tiles.py` — voda modrá, sníh světlý, atd.). Tento modul
 * NESMÍ volat `getImageData` ani `toDataURL`: při otevření hry z `file://`
 * prohlížeč canvas „taintuje" (kvůli načtení obrázku z disku) a čtení pixelů
 * by hodilo SecurityError. Kreslení (`drawImage`, `fillRect`) je naopak
 * bezpečné, takže celá tato cesta funguje i z `file://`.
 *
 * Přepínač: `settings.tileStyle = 'code' | 'ai'` (menu ☰ → Vzhled mapy).
 */
(function () {
  const G = window.Game;

  const TERRAINS = ['grass','forest','deep_forest','hills','mountain','water','swamp','snow','road','dirt'];
  const RES = 192;               // stejné rozlišení jako procedurální dlaždice
  const SRC = 'assets/tiles/';

  /** 8 variant na terén: 2 textury × zrcadlení × jas (žádné čtení pixelů). */
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

  G.AI_TILES = { ready:false, loading:false, tiles:{}, loaded:0, failed:0 };

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

  /** Z obrázku udělá variantu (zrcadlení + jas) — jen kreslení, žádné čtení. */
  function variantOf(img, mul, flip) {
    const c = document.createElement('canvas');
    c.width = RES; c.height = RES;
    const x = c.getContext('2d');
    x.save();
    x.translate(flip.indexOf('h') >= 0 ? RES : 0, flip.indexOf('v') >= 0 ? RES : 0);
    x.scale(flip.indexOf('h') >= 0 ? -1 : 1, flip.indexOf('v') >= 0 ? -1 : 1);
    x.drawImage(img, 0, 0, RES, RES);
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
        const list = [];
        for (const cfg of VARIANTS) {
          const img = imgs[t + '-' + cfg.file];
          if (img) list.push(variantOf(img, cfg.mul, cfg.flip));
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
