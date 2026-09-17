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
  // `base` = jeden základní model (nový koncept); archetypy zůstávají jako
  // záložní sada, kdyby base.png chyběl.
  const UNIT_FILES = ['base'].concat(ARCHETYPES);
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
   *
   * Preferuje se **jeden základní model** (`assets/units/base.png`, bez zbraně),
   * protože roli nese erb kreslený v kódu (`G.drawFigureHeraldry`) a postava je
   * na mapě vysoká ~26 px — šest archetypů se zbraněmi se v tom měřítku stejně
   * nerozezná. Když `base.png` chybí, padá se zpět na staré archetypy.
   */
  G.aiUnitSprite = function (u) {
    if (G.unitStyle() !== 'ai') return null;
    const S = G.AI_UNITS.sprites;
    return S.base || S[G.aiUnitArchetype(u)] || null;
  };

  /** Načte sprity postav (jednorázově). */
  G.loadAiUnits = function (done) {
    const A = G.AI_UNITS;
    if (A.ready || A.loading) { if (done) done(A); return; }
    if (typeof Image !== 'function') { if (done) done(A); return; }
    A.loading = true;
    A.tried = true;
    let finished = 0;
    for (const a of UNIT_FILES) {
      const img = new Image();
      img.onload = () => { A.sprites[a] = img; A.loaded++; step(); };
      img.onerror = () => { A.failed++; step(); };
      img.src = SRC + a + '.png';
    }
    function step() {
      finished++;
      if (finished < UNIT_FILES.length) return;
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

  /* ===================== props (krajinné prvky) =====================
     Stejný princip jako postavy: krajinné prvky (strom, skála, trs, rákosí…)
     umí hra nakreslit kódem, a když je v `assets/props/<druh>.png` hotový alfa
     sprite, použije se místo kresby. Je to poslední vrstva, kterou má dělat AI
     („AI jen na alfa sprity“) — a je nepovinná: bez souborů se chová všechno
     jako dřív.

     Kotvy jsou stejné jako u kódové kresby (strom/rákosí na základně, skála
     a trs uprostřed), takže výměna sprite za kresbu nic neposune. Barvy spritů
     musí ladit s paletou — na to je `scripts/grade_art.py`. */

  const PROP_KINDS = ['tree','pine','boulder','tuft','bush','pebble','reed','drift','ripple','rut'];
  // Cesta jde přepsat (G.AI_PROP_DIR nastaveným PŘED načtením) — používá to
  // náhledová stránka v tools/tiles, která kvůli relativním cestám leží jinde.
  G.AI_PROP_DIR = G.AI_PROP_DIR || 'assets/props/';
  const PROP_SRC = G.AI_PROP_DIR;

  G.AI_PROPS = { ready:false, loading:false, sprites:{}, loaded:0, failed:0, tried:false };

  /** Vzhled krajinných prvků: 'code' (kreslené, výchozí) nebo 'ai' (sprity). */
  G.propStyle = function () {
    const s = (G.state && G.state.settings) || {};
    return s.props === 'ai' ? 'ai' : 'code';
  };
  G.setPropStyle = function (v) {
    if (!G.state) return 'code';
    if (!G.state.settings) G.state.settings = {};
    G.state.settings.props = (v === 'ai') ? 'ai' : 'code';
    if (G.state.settings.props === 'ai' && G.loadAiProps) G.loadAiProps();
    if (G.drawWorldFrame) G.drawWorldFrame();
    return G.state.settings.props;
  };

  /** Sprite krajinného prvku (Image), nebo null když není / je vypnutý. */
  G.aiPropSprite = function (kind) {
    if (G.propStyle() !== 'ai') return null;
    return G.AI_PROPS.sprites[kind] || null;
  };

  /** Načte sprity krajinných prvků (jednorázově, chybějící soubory nevadí). */
  G.loadAiProps = function (done) {
    const A = G.AI_PROPS;
    if (A.ready || A.loading) { if (done) done(A); return; }
    if (typeof Image !== 'function') { if (done) done(A); return; }
    A.loading = true;
    A.tried = true;
    let finished = 0;
    for (const k of PROP_KINDS) {
      const img = new Image();
      img.onload = () => { A.sprites[k] = img; A.loaded++; step(); };
      img.onerror = () => { A.failed++; step(); };
      img.src = PROP_SRC + k + '.png';
    }
    function step() {
      if (++finished < PROP_KINDS.length) return;
      A.ready = A.loaded > 0;
      A.loading = false;
      if (G.drawWorldFrame) G.drawWorldFrame();
      if (done) done(A);
    }
  };

  /** Dočte sprity prvků, když jsou zapnuté a ještě se to nezkusilo. */
  G.ensureAiProps = function () {
    const A = G.AI_PROPS;
    if (G.propStyle() !== 'ai' || A.ready || A.loading || A.tried) return A;
    G.loadAiProps();
    return A;
  };

  /* ============ ilustrace vrstvy 3 (titul, scény, portréty) ============
     Ilustrace nejsou dlaždice ani postavy: jsou to velké statické obrazy pro
     UI — titul, příběhové scény (popupy z `js/data/progress.js`) a portréty
     rolí. Vygenerované jsou v `assets/art/` (docs/STYL_GRAFIKY.md §14.4).

     Tenhle modul drží jen **načtení a lookupy**, aby napojení v UI bylo
     dvouřádkové:
         const id = G.illustrationForStory(ps.id);
         const src = id && G.illustrationSrc(id);
         if (src) { ... <img src=src> nebo drawImage(G.illustration(id), ...) }
     Když obrázek chybí (nebo je vypnutý), funkce vrátí null a UI kreslí jako dřív. */

  const ART_FILES = [
    'title',
    'scene_arrival', 'scene_mountain_message', 'scene_forest_call', 'scene_merchant_call',
    'scene_cave_shadows', 'scene_council', 'scene_new_beginning',
    'portrait_leader', 'portrait_quarter', 'portrait_medic',
    'portrait_scout', 'portrait_fighter', 'portrait_trader'
  ];
  // Cesta jde přepsat (G.AI_ART_DIR) — používá to náhledová stránka.
  G.AI_ART_DIR = G.AI_ART_DIR || 'assets/art/';
  const ART_SRC = G.AI_ART_DIR;

  G.AI_ART = { ready:false, loading:false, images:{}, loaded:0, failed:0, tried:false };

  /** Mají se ilustrace používat? (`settings.art` = 'on' | 'off', výchozí zapnuto.) */
  G.illustrationsEnabled = function () {
    const s = (G.state && G.state.settings) || {};
    return s.art !== 'off';
  };
  G.setIllustrations = function (v) {
    if (!G.state) return false;
    if (!G.state.settings) G.state.settings = {};
    G.state.settings.art = (v === 'off') ? 'off' : 'on';
    if (G.state.settings.art === 'on' && G.loadIllustrations) G.loadIllustrations();
    if (G.drawWorldFrame) G.drawWorldFrame();
    return G.state.settings.art !== 'off';
  };

  /** Načte ilustrace (jednorázově). Chybějící soubory nevadí. */
  G.loadIllustrations = function (done) {
    const A = G.AI_ART;
    if (A.ready || A.loading) { if (done) done(A); return; }
    if (typeof Image !== 'function') { if (done) done(A); return; }
    if (!G.illustrationsEnabled()) { if (done) done(A); return; }
    A.loading = true;
    A.tried = true;
    let finished = 0;
    for (const id of ART_FILES) {
      const img = new Image();
      img.onload = () => { A.images[id] = img; A.loaded++; step(); };
      img.onerror = () => { A.failed++; step(); };
      img.src = ART_SRC + id + '.png';
    }
    function step() {
      if (++finished < ART_FILES.length) return;
      A.ready = A.loaded > 0;
      A.loading = false;
      if (done) done(A);
    }
  };

  /** Dočte ilustrace, když jsou zapnuté a ještě se to nezkusilo. */
  G.ensureIllustrations = function () {
    const A = G.AI_ART;
    if (!G.illustrationsEnabled() || A.ready || A.loading || A.tried) return A;
    G.loadIllustrations();
    return A;
  };

  /** Načtený obrázek ilustrace (Image) nebo null. */
  G.illustration = function (id) {
    if (!G.illustrationsEnabled()) return null;
    return G.AI_ART.images[id] || null;
  };

  /** Cesta k ilustraci (pro `<img src>` / CSS) nebo null, když není načtená. */
  G.illustrationSrc = function (id) {
    return G.illustration(id) ? ART_SRC + id + '.png' : null;
  };

  /** Ilustrace k příběhovému popupu (`arrival` -> `scene_arrival`), jinak null. */
  G.illustrationForStory = function (storyId) {
    if (!storyId) return null;
    const id = 'scene_' + storyId;
    return G.illustration(id) ? id : null;
  };

  /** Portrét role (`medic` -> `portrait_medic`), jinak null. */
  G.illustrationForRole = function (roleId) {
    if (!roleId) return null;
    const id = 'portrait_' + roleId;
    return G.illustration(id) ? id : null;
  };

  /** Všechna id ilustrací (i ta, co se nenačetla) — pro náhled a testy. */
  G.illustrationIds = function () { return ART_FILES.slice(); };
})();
