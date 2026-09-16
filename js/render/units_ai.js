/**
 * units_ai.js — volitelné malované postavy (AI sprity) na mapě.
 *
 * Stejný princip jako tiles_ai.js: postavy se defaultně kreslí kódem
 * (`drawFigure`), tenhle modul přidá bitmapové sprity z `assets/units/<id>.png`
 * (průhledné PNG, připravené `scripts/process_units.py`). Přepíná je stejný
 * přepínač „Vzhled" (`settings.tileStyle === 'ai'`) jako dlaždice — takže
 * mapa i postavy jsou v jednom malovaném stylu.
 *
 * Také zde NESMÍ být `getImageData` (file:// canvas taint) — jen drawImage.
 */
(function () {
  const G = window.Game;

  const ARCHETYPES = ['mercenary','villager','blacksmith','hunter','scout','merchant'];
  const SRC = 'assets/units/';

  G.AI_UNITS = { ready:false, loading:false, sprites:{}, loaded:0, failed:0 };

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

  /** Sprite pro postavu (Image), nebo null když není načtený. */
  G.aiUnitSprite = function (u) {
    return G.AI_UNITS.sprites[G.aiUnitArchetype(u)] || null;
  };

  /** Načte sprity postav (jednorázově). */
  G.loadAiUnits = function (done) {
    const A = G.AI_UNITS;
    if (A.ready || A.loading) { if (done) done(A); return; }
    if (typeof Image !== 'function') { if (done) done(A); return; }
    A.loading = true;
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
      if (done) done(A);
    }
  };
})();
