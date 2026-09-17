// tile-sets.js — ověří PŘEPÍNÁNÍ SAD dlaždic (debug panel → Mapa — vzhled).
//
// Použití:  node test/tile-sets.js
// Exit 0 = OK, exit 1 = chyba.
//
// Proč samostatný test: kandidátské sady dlaždic (`assets/tiles_kronika*/final/`)
// vznikají mimo repo a v čistém checkoutu **neexistují**. Hra se proto nesmí
// přepnout na sadu, kterou nejde načíst — jinak tiše spadne na kreslenou cestu
// a uživatel nepozná, že se přepnutí nepovedlo. Testy ověřují:
//   1) výchozí sada je nasazená a adresáře sedí,
//   2) přepnutí proběhne jen když se zkušební soubor opravdu načte,
//   3) při chybě zůstane předchozí sada (a callback dostane null),
//   4) po přepnutí se textury načítají z NOVÉHO adresáře a staré se zahodí,
//   5) v kresleném vzhledu se textury vůbec nenačítají,
//   6) neznámé id nic nezmění.

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

// ---------- stub prohlížeče ----------
const pending = [];
function ImageStub() {
  const self = this;
  this.width = 768; this.height = 768;
  this.onload = null; this.onerror = null;
  Object.defineProperty(this, 'src', {
    set(v) { self._src = v; pending.push(self); },
    get() { return self._src; }
  });
}
const G = {};
global.window = { Game: G, document: { createElement: () => ({ getContext: () => ({ drawImage: noop }) }) } };
global.document = global.window.document;
global.Image = ImageStub;

G.state = { settings: {} };
G.getTileArt = (terrain, variant) => ({ code: true, terrain, variant });

vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js/render/tiles_ai.js'), 'utf8'),
  { filename: 'tiles_ai.js' });

const DIRS = ['assets/tiles/', 'assets/tiles_kronika/final/', 'assets/tiles_kronika_tex/final/'];
function flush(ok) { while (pending.length) { const i = pending.shift(); (ok ? i.onload : i.onerror)(); } }

check('prvni sada je nasazena a vsechny maji adresar', () => {
  assert(Array.isArray(G.TILE_SETS), 'G.TILE_SETS neni pole');
  assert(G.TILE_SETS.length >= 3, 'ceka se aspon 3 sady, je ' + G.TILE_SETS.length);
  assert(G.TILE_SETS[0].dir === DIRS[0], 'prvni sada ma byt ' + DIRS[0]);
  for (const s of G.TILE_SETS) assert(s.id && s.dir && s.name, 'sada bez id/dir/name: ' + JSON.stringify(s));
});

check('vychozi sada a jeji adresar', () => {
  assert(G.tileSet() === 'base', 'vychozi sada je ' + G.tileSet());
  assert(G.tileSetDir() === DIRS[0], 'adresar je ' + G.tileSetDir());
});

check('nezname ulozene id spadne na prvni sadu', () => {
  G.state.settings.tileSet = 'blbost';
  assert(G.tileSet() === 'base', 'neznama sada se nemela pouzit');
  assert(G.tileSetDir() === DIRS[0], 'adresar u nezname sady');
  G.state.settings.tileSet = 'base';
});

check('kresleny vzhled nacte textury az po prepnuti na malovany', () => {
  G.setTileStyle('code');
  pending.length = 0;
  G.setTileSet('base');
  assert(pending.length === 1, 'ceka se jen zkusebni soubor, je ' + pending.length);
  flush(true);
  assert(pending.length === 0, 'v kreslenem vzhledu se textury nemaji nacitat');
  G.setTileStyle('ai');
  assert(pending.length === 20, 'malovany vzhled ma nacist 20 textur, je ' + pending.length);
  flush(true);
  assert(G.AI_TILES.ready, 'textury se nenacetly');
});

check('nactene textury jdou z adresare aktivni sady', () => {
  const src = G.AI_TILES.tiles.grass.a._src;
  assert(src === DIRS[0] + 'grass-1.jpg', 'nacteno z ' + src);
});

check('prepnuti sady overi soubor a prenacte textury z noveho adresare', () => {
  let got = null;
  G.setTileSet('kronika', s => { got = s; });
  assert(pending.length === 1, 'ceka se zkusebni soubor, je ' + pending.length);
  assert(pending[0]._src === DIRS[1] + 'grass-1.jpg', 'zkusebni soubor je ' + pending[0]._src);
  pending.shift().onload();
  assert(pending.length === 20, 'po prepnuti se maji nacist textury, je ' + pending.length);
  flush(true);
  assert(got && got.id === 'kronika', 'callback nedostal novou sadu');
  assert(G.tileSet() === 'kronika', 'aktivni sada je ' + G.tileSet());
  assert(G.tileSetDir() === DIRS[1], 'adresar je ' + G.tileSetDir());
  const src = G.AI_TILES.tiles.grass.a._src;
  assert(src === DIRS[1] + 'grass-1.jpg', 'textury se nacetly z ' + src);
  assert(G.AI_TILES.ready && G.AI_TILES.loaded === 10, 'po prepnuti neni nacteno 10 terenu');
});

check('sada, ktera nejde nacist, se neprepne', () => {
  let got = 'nevolano';
  G.state.settings.tileSet = 'base';
  G.setTileSet('kronika-tex', s => { got = s; });
  assert(pending.length === 1, 'ceka se zkusebni soubor, je ' + pending.length);
  pending.shift().onerror();
  assert(got === null, 'callback mel dostat null, dostal ' + got);
  assert(G.tileSet() === 'base', 'sada se nemela zmenit, je ' + G.tileSet());
  assert(G.tileSetDir() === DIRS[0], 'adresar se nemel zmenit');
});

check('nezname id nic nezmeni', () => {
  G.state.settings.tileSet = 'base';
  assert(G.setTileSet('neexistuje') === null, 'nezname id ma vratit null');
  assert(G.tileSet() === 'base', 'sada se zmenila na ' + G.tileSet());
  assert(pending.length === 0, 'nezname id nema zkouset nacitat soubor');
});

check('zvolena sada se uklada do nastaveni (prezije reload)', () => {
  G.setTileSet('kronika');
  pending.shift().onload();
  flush(true);
  assert(G.state.settings.tileSet === 'kronika', 'nastaveni si sadu nepamatuje');
  assert(G.tileSetDir() === DIRS[1], 'adresar po ulozeni');
});

console.log('');
if (failed) {
  console.log('VYSLEDEK: CHYBA — ' + failed + ' testu selhalo');
  process.exit(1);
}
console.log('VYSLEDEK: OK — sady dlaždic jdou přepínat bezpečně');
