/**
 * units_ai.js — volitelné malované postavy (AI sprity) na mapě.
 *
 * Stejný princip jako tiles_ai.js: postavy se defaultně kreslí kódem
 * (`drawFigure`), tenhle modul přidá bitmapové sprity z `assets/units/<id>.png`
 * (průhledné PNG, připravené `scripts/process_units.py`).
 *
 * Vzhled postav je **vlastní přepínač** (`settings.units`), nezávislý na vzhledu
 * mapy. Dřív se malované postavy zapínaly jen s `tileStyle === 'ai'`, takže
 * nešlo zkombinovat foundry (mapa z kódu) s malovanými postavami — což je pro
 * cestu C (hybrid) cílový stav. Když `settings.units` není nastaveno, chová se
 * to jako dřív (malované postavy patří k malované mapě).
 *
 * Také zde NESMÍ být `getImageData` (file:// canvas taint) — jen drawImage.
 */
(function () {
  const G = window.Game;

  const ARCHETYPES = ['mercenary','villager','blacksmith','hunter','scout','merchant'];
  const SRC = 'assets/units/';

  G.AI_UNITS = { ready:false, loading:false, sprites:{}, loaded:0, failed:0 };

  /**
   * Vzhled postav: 'code' (kreslené figurky) nebo 'ai' (malované sprity).
   * Bez explicitního nastavení se odvozuje od vzhledu mapy.
   */
  G.unitStyle = function () {
    const s = (G.state && G.state.settings) || {};
    if (s.units === 'ai' || s.units === 'code') return s.units;
    return (G.tileStyle && G.tileStyle() === 'ai') ? 'ai' : 'code';
  };
  G.setUnitStyle = function (style) {
    if (!G.state) return 'code';
    if (!G.state.settings) G.state.settings = {};
    const v = (style === 'ai') ? 'ai' : 'code';
    G.state.settings.units = v;
    if (v === 'ai' && G.loadAiUnits) G.loadAiUnits();
    if (G.drawWorldFrame) G.drawWorldFrame();
    return v;
  };

  function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) || 1; }

  /** Archetyp postavy podle profese, jinak stabilně podle id. */
  G.aiUnitArchetype = function (u) {
    if (!u) return 'mercenary';
    const prof = G.professionOf ? (G.professionOf(u) || {}).id : null;
    if (prof === 'smith') return 'blacksmith';
    if (prof === 'merchant') return 'merchant';
    if (prof === 'scout') return 'scout';
    const pool = ['mercenary','villager','hunter'];
    return pool[hashStr(u.id) % pool.length];
  };

  /**
   * Sprite pro postavu (Image), nebo null když není načtený NEBO je vypnutý
   * kreslený vzhled — volající pak kreslí `G.drawFigure`.
   */
  G.aiUnitSprite = function (u) {
    if (G.unitStyle() !== 'ai') return null;
    return G.AI_UNITS.sprites[G.aiUnitArchetype(u)] || null;
  };

  /** Načte sprity postav (jednorázově). */
  G.loadAiUnits = function (done) {
    const A = G.AI_UNITS;
    if (A.ready || A.loading) { if (done) done(A); return; }
    if (typeof Image !== 'function') { if (done) done(A); return; }
    A.loading = true;
    A.tried = true;
    let finished = 0;
    for (const a of ARCHETYPES) {
      const img = new Image();
      img.onload = () => { A.sprites[a] = img; A.loaded++; step(); };
      img.onerror = () => { A.failed++; step(); };
      img.src = SRC + a + '.png';
    }
    function step() {
      finished++;
      if (finished < ARCHETYPES.length) return;
      A.ready = A.loaded > 0;
      A.loading = false;
      if (G.drawWorldFrame) G.drawWorldFrame();
      if (done) done(A);
    }
  };

  /**
   * Načte sprity, když jsou potřeba a ještě se to nezkusilo. Volá se z kreslení
   * mapy — řeší načtení savu s `settings.units = 'ai'` (v takovém případě se
   * `loadAiUnits` z bootu nezavolá, protože mapa může být kreslená/foundry).
   * `tried` brání tomu, aby se chybějící soubory zkoušely znovu každý snímek.
   */
  G.ensureAiUnits = function () {
    const A = G.AI_UNITS;
    if (G.unitStyle() !== 'ai' || A.ready || A.loading || A.tried) return A;
    G.loadAiUnits();
    return A;
  };
})();
