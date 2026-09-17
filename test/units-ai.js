// units-ai.js — ověří výběr malovaných spritů postav (js/render/units_ai.js).
//
// Použití:  node test/units-ai.js
// Exit 0 = OK, exit 1 = chyba.
//
// Koncept (od uživatele): všichni na JEDNOM základním modelu, roli nese erb
// kreslený v kódu. Malované postavy proto mají preferovat `assets/units/base.png`
// (bez zbraně) a teprve když chybí, padat zpět na staré archetypy se zbraněmi.
// Testy:
//   1) načítá se `base` + záložní archetypy, chybějící soubory nevadí,
//   2) s `base` se použije základní model pro VŠECHNY profese,
//   3) bez `base` se padá zpět na archetyp podle profese,
//   4) v kresleném vzhledu se sprite nevrací (kreslí se figurka),
//   5) `ensureAiUnits` se neopakuje každý snímek.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const noop = function () {};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log('  OK   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + ' :: ' + e.message); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assert selhal'); }

const pendingImg = [];
function ImageStub() {
  const self = this;
  this.width = 48; this.height = 96;
  this.onload = null; this.onerror = null;
  Object.defineProperty(this, 'src', {
    set(v) { self._src = v; pendingImg.push(self); },
    get() { return self._src; }
  });
}
global.window = { Game: {} };
global.document = { createElement: () => ({ getContext: () => ({}) }) };
global.Image = ImageStub;

vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js/render/units_ai.js'), 'utf8'),
  { filename: 'units_ai.js' });
const G = global.window.Game;
G.PROFESSIONS = {
  woodcutter: { id:'woodcutter' }, smith: { id:'smith' }, merchant: { id:'merchant' },
  scout: { id:'scout' }, adventurer: { id:'adventurer' }
};
G.professionOf = (u) => G.PROFESSIONS[u.profession] || G.PROFESSIONS.adventurer;
G.state = { settings: {} };

function flush(missing) {
  while (pendingImg.length) {
    const img = pendingImg.shift();
    if (missing) img.onerror(); else img.onload();
  }
}
const unit = (over) => Object.assign({ id: 'u1', profession: 'woodcutter' }, over || {});

check('nactou se base i zalozni archetypy', () => {
  G.setUnitStyle('ai');
  assert(pendingImg.length === 7, 'nemělo se načítat 7 souborů (base + 6 archetypů), ale ' + pendingImg.length);
  flush(false);
  assert(G.AI_UNITS.ready, 'sprity se nenačetly');
  assert(G.AI_UNITS.loaded === 7, 'načetlo se ' + G.AI_UNITS.loaded + ' z 7');
  assert(G.AI_UNITS.sprites.base, 'chybí base');
});

check('se zakladem se pouzije base pro vsechny profese', () => {
  const ids = Object.keys(G.PROFESSIONS);
  ids.push('neznamy');
  for (const p of ids) {
    const spr = G.aiUnitSprite(unit({ profession: p }));
    assert(spr === G.AI_UNITS.sprites.base,
      'profese ' + p + ' nepoužila základní model');
  }
});

check('bez zakladu se pada zpet na archetypy', () => {
  const base = G.AI_UNITS.sprites.base;
  delete G.AI_UNITS.sprites.base;
  assert(G.aiUnitSprite(unit({ profession: 'smith' })) === G.AI_UNITS.sprites.blacksmith,
    'kovář nemá padat na blacksmith');
  assert(G.aiUnitSprite(unit({ profession: 'merchant' })) === G.AI_UNITS.sprites.merchant,
    'kupec nemá padat na merchant');
  assert(G.aiUnitSprite(unit({ profession: 'scout' })) === G.AI_UNITS.sprites.scout,
    'průzkumník nemá padat na scout');
  const other = G.aiUnitSprite(unit({ id: 'u9', profession: 'woodcutter' }));
  assert(other && other !== null, 'běžná profese nemá fallback');
  G.AI_UNITS.sprites.base = base;
});

check('v kreslenem vzhledu se sprite nevraci', () => {
  G.setUnitStyle('code');
  assert(G.aiUnitSprite(unit()) === null, 'kreslený vzhled nemá vracet sprite');
  G.setUnitStyle('ai');
  assert(G.aiUnitSprite(unit()) !== null, 'malovaný vzhled má vracet sprite');
});

check('chybejici soubory nevadi a nezkousi se opakovaně', () => {
  G.AI_UNITS.ready = false; G.AI_UNITS.loading = false; G.AI_UNITS.tried = false;
  G.AI_UNITS.sprites = {}; G.AI_UNITS.loaded = 0; G.AI_UNITS.failed = 0;
  G.loadAiUnits();
  const n = pendingImg.length;
  flush(true);                       // všechny chybí
  assert(n === 7, 'zkoušelo se ' + n + ' souborů');
  assert(G.AI_UNITS.failed === 7, 'chyby se nepočítají: ' + G.AI_UNITS.failed);
  assert(G.AI_UNITS.ready === false, 'ready nemá být true bez souborů');
  assert(G.aiUnitSprite(unit()) === null, 'bez spritů se má kreslit figurka');
  G.ensureAiUnits(); G.ensureAiUnits();
  assert(pendingImg.length === 0, 'zkouší se to znovu: ' + pendingImg.length);
});

console.log('');
if (failed) {
  console.log('VYSLEDEK: CHYBA — ' + failed + ' testu selhalo');
  process.exit(1);
}
console.log('VYSLEDEK: OK — malované postavy používají jeden základní model');
