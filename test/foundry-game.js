// foundry-game.js — ověří foundry v BĚŽÍCÍ hře (ne jen v izolaci).
//
// Použití:  node test/foundry-game.js
// Exit 0 = OK, exit 1 = chyba.
//
// `test/foundry.js` testuje plán na syntetické mapě. Tady jde o integraci:
// spustí se celá hra jako v `test/headless-smoke.js` (stuby prohlížeče, všech
// skriptů z index.html), přepne se vzhled mapy na `foundry` a zavolá se
// skutečné vykreslení (`G.drawWorldFrame`). Sleduje se, kolik kreslicích
// operací na canvasu opravdu proběhlo — když se foundry omylem vypne (nebo
// spadne na výjimce), počty to ukážou.

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

// ---------- stub prohlížeče (stejný princip jako headless-smoke) ----------
const counts = {};
function resetCounts() { for (const k in counts) delete counts[k]; }
function makeCtx() {
  const base = {};
  return new Proxy(base, {
    get(t, p) {
      if (p === 'measureText') return () => ({ width: 10 });
      if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => ({ addColorStop: noop });
      if (p === 'getImageData') return () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 });
      if (p in t) return t[p];
      return function () { counts[p] = (counts[p] || 0) + 1; };
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}
function makeEl() {
  const el = {
    addEventListener: noop, removeEventListener: noop, appendChild: noop, removeChild: noop,
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    style: {}, dataset: {}, children: [],
    setAttribute: noop, getAttribute: () => null, removeAttribute: noop,
    querySelector: () => null, querySelectorAll: () => [],
    focus: noop, blur: noop, click: noop,
    setPointerCapture: noop, releasePointerCapture: noop,
    innerHTML: '', textContent: '', value: '', scrollTop: 0, scrollHeight: 0,
    clientWidth: 800, clientHeight: 600, width: 800, height: 600,
    getBoundingClientRect: () => ({ width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600 })
  };
  let ctx = null;
  el.getContext = () => (ctx || (ctx = makeCtx()));
  return el;
}
const elements = {};
const documentStub = {
  readyState: 'complete', hidden: false, body: makeEl(), documentElement: makeEl(),
  getElementById(id) { if (!elements[id]) elements[id] = makeEl(); return elements[id]; },
  querySelector: () => null, querySelectorAll: () => [],
  createElement: () => makeEl(), addEventListener: noop, removeEventListener: noop
};
const store = {};
const localStorageStub = {
  getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
  clear: () => { for (const k in store) delete store[k]; }
};
const windowStub = {
  document: documentStub, localStorage: localStorageStub,
  addEventListener: noop, removeEventListener: noop,
  setTimeout: () => 0, clearTimeout: noop, setInterval: () => 0, clearInterval: noop,
  requestAnimationFrame: () => 0, cancelAnimationFrame: noop,
  performance: { now: () => Date.now() }, navigator: { userAgent: 'node-headless-foundry' },
  devicePixelRatio: 1, innerWidth: 800, innerHeight: 600,
  location: { href: 'http://localhost/', pathname: '/', search: '' },
  matchMedia: () => ({ matches: false, addEventListener: noop })
};
global.window = windowStub;
global.document = documentStub;
global.localStorage = localStorageStub;
global.performance = windowStub.performance;
global.requestAnimationFrame = windowStub.requestAnimationFrame;
global.navigator = windowStub.navigator;
global.location = windowStub.location;
global.Image = function () {};
global.ResizeObserver = function () { this.observe = noop; this.disconnect = noop; };

console.log('=== Idle Realm — foundry v běžící hře ===');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const srcs = [...html.matchAll(/src="([^"]+)"/g)].map((m) => m[1]);
const nonMain = srcs.filter((s) => s.indexOf('main.js') === -1);

let loadErr = 0;
for (const s of nonMain) {
  try { vm.runInThisContext(fs.readFileSync(path.join(ROOT, s), 'utf8'), { filename: s }); }
  catch (e) { loadErr++; console.log('  LOAD ERROR ' + s + ': ' + e.message); }
}
const G = windowStub.Game;
check('nacteni ' + nonMain.length + ' skriptu bez chyb', () => assert(loadErr === 0, loadErr + ' chyb'));

if (G.setSeed) G.setSeed(20260910);
let titleOpts = null;
G.showTitleScreen = (opts) => { titleOpts = opts; };
try { vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8'), { filename: 'js/main.js' }); }
catch (e) { failed++; console.log('  FAIL main.js: ' + e.message); }
check('hra se spustila', () => { titleOpts.onNewGame('normal'); assert(!!G.state && !!G.WORLD); });

function draw(style) {
  G.setTileStyle(style);
  resetCounts();
  G.drawWorldFrame();
  return Object.assign({}, counts);
}

let code = null, foundry = null;
check('kresleny vzhled se vykresli', () => {
  code = draw('code');
  assert((code.drawImage || 0) > 100, 'kreslený vzhled nekreslil dlaždice: ' + (code.drawImage || 0));
});

check('foundry se vykresli pres celou obrazovku', () => {
  foundry = draw('foundry');
  assert(G.tileStyle() === 'foundry', 'vzhled se nepřepnul: ' + G.tileStyle());
  // plochý podklad = jeden fillRect na dlaždici (20x15 viditelných + okraj)
  assert((foundry.fillRect || 0) > 250, 'málo výplní podkladu: ' + (foundry.fillRect || 0));
  // štětce a dekorace = spousta elips/obloučků
  assert((foundry.ellipse || 0) > 150, 'málo světových štětců: ' + (foundry.ellipse || 0));
  assert((foundry.stroke || 0) > 5, 'málo tahů (dekorace): ' + (foundry.stroke || 0));
});

check('foundry nekresli dlazdice jako obrazky', () => {
  // dlaždicové bitmapy nahrazuje světová vrstva; drawImage zbývá jen na
  // jednotky/sídla, takže musí být výrazně méně než v kresleném vzhledu
  assert((foundry.drawImage || 0) < (code.drawImage || 0) / 2,
    'foundry pořád kreslí dlaždice jako obrázky: ' + (foundry.drawImage || 0) +
    ' vs kreslený ' + (code.drawImage || 0));
});

check('foundry jde prepnout zpet a znovu', () => {
  draw('code');
  resetCounts();
  G.setTileStyle('foundry');
  G.drawWorldFrame();
  const again = Object.assign({}, counts);
  assert((again.ellipse || 0) > 150, 'druhé zapnutí foundry nekreslí: ' + (again.ellipse || 0));
  G.setTileStyle('code');
  assert(G.tileStyle() === 'code', 'návrat ke kreslenému vzhledu nefunguje');
});

check('foundry v prehledu (🔭) se vykresli', () => {
  G.setTileStyle('foundry');
  if (G.toggleMapOverview) G.toggleMapOverview();
  resetCounts();
  G.drawWorldFrame();
  const ov = Object.assign({}, counts);
  assert((ov.fillRect || 0) > 100, 'přehled nekreslí podklad: ' + (ov.fillRect || 0));
  assert((ov.ellipse || 0) > 10, 'přehled nekreslí vůbec nic: ' + (ov.ellipse || 0));
});

check('foundry zvladne i posun a zoom kamery', () => {
  G.setTileStyle('foundry');
  for (const [dx, dy, z] of [[7, 3, 1], [-20, -11, 0.5], [30, 18, 1.8]]) {
    G.state.camera.x += dx;
    G.state.camera.y += dy;
    G.state.camera.zoom = z;
    G.drawWorldFrame();
  }
});

check('foundry na realne mape zustava v rozpoctu', () => {
  const c = { 0: 0, 1: 0, 2: 0 };
  const view = {
    x0: 9, x1: 22, y0: 8, y1: 19, ox: 0, oy: 0, tilePx: 64,
    mode: 'detail', quality: 1,
    terrainAt: (x, y) => (x < 0 || y < 0 || x >= G.WORLD.w || y >= G.WORLD.h)
      ? '' : G.WORLD.terrainAt(x, y)
  };
  G.foundryOps(view, (k) => { c[k]++; });
  console.log('       (realná mapa: ' + c[0] + ' štětců, ' + c[1] + ' přechodů, ' + c[2] + ' dekorací)');
  assert(c[0] > 100 && c[0] < 400, 'počet štětců mimo rozpočet: ' + c[0]);
  assert(c[1] < 260, 'příliš mnoho přechodů na snímek: ' + c[1]);
  assert(c[2] < 100, 'příliš mnoho dekorací na snímek: ' + c[2]);
});

console.log('');
// Hra si při běhu vytváří skutečné intervaly (toasty, panely), takže proces
// musí skončit explicitně — jinak by test visel.
if (failed) {
  console.log('VYSLEDEK: CHYBA — ' + failed + ' testu selhalo');
  process.exit(1);
}
console.log('VYSLEDEK: OK — foundry kreslí v běžící hře');
process.exit(0);
