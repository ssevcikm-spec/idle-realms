// _boot.js — čisté bootnutí hry pro testy (Fáze C).
//
// Proč to existuje: `coherence.js` i `scheduler-regress.js` si oba kopírovali
// stejných ~45 řádků stubu DOM a vm kontextu. Třetí brána (C3/C4) by zkopírovala
// je potřetí — a rozdíl mezi třemi kopiemi je přesně místo, kde se tiše rozjede.
// Tady je JEDNA kopie.
//
// ⚠ Co TATO funkce NESMÍ dělat: sahat na stav, který brána chce měřit. Zavádí
// jen svět, semínko a UI stub. Každá bráda si pak hraje sama.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const SEED = 20260910;
const noop = function () {};

function makeCtx() {
  return new Proxy({}, {
    get(t, p) {
      if (p === 'measureText') return () => ({ width: 10 });
      if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => ({ addColorStop: noop });
      if (p === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      return noop;
    },
    set() { return true; }
  });
}

function makeEl() {
  return {
    addEventListener: noop, removeEventListener: noop, appendChild: noop, removeChild: noop,
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    style: {}, dataset: {}, children: [],
    setAttribute: noop, getAttribute: () => null, removeAttribute: noop,
    querySelector: () => null, querySelectorAll: () => [],
    getContext: () => makeCtx(), focus: noop, blur: noop, click: noop,
    setPointerCapture: noop, releasePointerCapture: noop,
    innerHTML: '', textContent: '', value: '', scrollTop: 0, scrollHeight: 0,
    clientWidth: 800, clientHeight: 600, width: 800, height: 600,
    getBoundingClientRect: () => ({ width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600 })
  };
}

/**
 * Čistá kopie hry: nové vm kontexty, nové stuby, nové `window.Game`.
 * Vrací `{ G, sandbox }` — sandbox jen když brána potřebuje volat i vnější
 * kontext (např. `G.simulating`).
 */
function boot() {
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
  const win = {
    Game: {}, document: documentStub, localStorage: localStorageStub,
    addEventListener: noop, removeEventListener: noop,
    setTimeout: () => 0, clearTimeout: noop, setInterval: () => 0, clearInterval: noop,
    requestAnimationFrame: () => 0, cancelAnimationFrame: noop,
    performance: { now: () => Date.now() }, navigator: { userAgent: 'node-test' },
    devicePixelRatio: 1, innerWidth: 800, innerHeight: 600,
    location: { href: 'http://localhost/', pathname: '/', search: '' },
    matchMedia: () => ({ matches: false, addEventListener: noop })
  };
  const sandbox = {
    window: win, document: documentStub, localStorage: localStorageStub,
    performance: win.performance, navigator: win.navigator, location: win.location,
    requestAnimationFrame: win.requestAnimationFrame, cancelAnimationFrame: noop,
    setTimeout: win.setTimeout, clearTimeout: win.clearTimeout,
    setInterval: win.setInterval, clearInterval: win.clearInterval,
    Image: function () {}, ResizeObserver: function () { this.observe = noop; this.disconnect = noop; },
    console: console
  };
  const ctx = vm.createContext(sandbox);
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const srcs = [...html.matchAll(/src="([^"]+)"/g)].map((m) => m[1]);
  for (const s of srcs.filter((s) => s.indexOf('main.js') === -1)) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, s), 'utf8'), ctx, { filename: s });
  }
  const G = win.Game;
  G.setSeed(SEED);
  let newGame = null;
  G.showTitleScreen = (opts) => { newGame = opts.onNewGame; };
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8'), ctx, { filename: 'js/main.js' });
  if (typeof newGame !== 'function') throw new Error('showTitleScreen nezavolalo onNewGame');
  newGame('normal');
  return { G: G, sandbox: sandbox, root: ROOT, seed: SEED };
}

/** Společná kostra brány: `check()` počítá selhání, `assert()` hází. */
function makeRunner(title) {
  let failed = 0, passed = 0;
  function check(name, fn) {
    try { fn(); passed++; console.log('  OK   ' + name); }
    catch (e) { failed++; console.log('  FAIL ' + name + ' :: ' + e.message); }
  }
  function assert(cond, msg) { if (!cond) throw new Error(msg || 'assert selhal'); }
  function finish(zmereno) {
    console.log('ZMERENO: ' + title + ' — kontrol: ' + passed + ', selhání: ' + failed +
      (zmereno ? ' (' + zmereno + ')' : ''));
    console.log(failed ? 'VYSLEDEK: CHYBA' : 'VYSLEDEK: OK — ' + title);
    process.exit(failed ? 1 : 0);
  }
  console.log('=== ' + title + ' ===');
  return { check: check, assert: assert, finish: finish };
}

module.exports = { boot: boot, makeRunner: makeRunner, ROOT: ROOT, SEED: SEED };