// tiles-preview.js — ověří, že náhledová stránka dlaždic po otevření funguje.
//
// Použití:  node test/tiles-preview.js
// Exit 0 = OK, exit 1 = chyba.
//
// `tools/tiles/preview.html` je nástroj, podle kterého se rozhoduje o vzhledu
// mapy — kdyby po úpravě kódu přestal běžet, přišli bychom o oči i uši. Test
// proto spustí jeho skript v Node se stubs DOM (canvas, Image, prvky) a ověří,
// že se postaví všechny panely a že se spočítá diagnostika.

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

const html = fs.readFileSync(path.join(ROOT, 'tools/tiles/preview.html'), 'utf8');
const blocks = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)]
  .map((m) => m[1]);
assert(blocks.length === 2, 'v náhledu se čekají 2 inline skripty, je ' + blocks.length);

// ---------- stub prohlížeče ----------
const pendingImg = [];
function ImageStub() {
  this.width = 768; this.height = 768;
  this.onload = null; this.onerror = null;
  const self = this;
  Object.defineProperty(this, 'src', {
    set() { pendingImg.push(self); },
    get() { return ''; }
  });
}
function ctxStub() {
  const base = { imageSmoothingEnabled: true, imageSmoothingQuality: '', globalAlpha: 1, fillStyle: '' };
  return new Proxy(base, {
    get(t, p) {
      if (p === 'getImageData') {
        return (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
      }
      if (p === 'createLinearGradient' || p === 'createRadialGradient') {
        return () => ({ addColorStop: noop });
      }
      if (p === 'measureText') return () => ({ width: 10 });
      if (p in t) return t[p];
      return noop;
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}
function elStub(tag) {
  const el = {
    tagName: tag || 'div', value: '', textContent: '', innerHTML: '', className: '', style: {},
    children: [], width: 300, height: 150,
    appendChild(c) { el.children.push(c); return c; },
    addEventListener: noop, removeEventListener: noop, setAttribute: noop, getAttribute: () => null,
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    getContext() { return ctxStub(); }
  };
  return el;
}
const byId = {};
const presets = { terrain: 'grass', tile: '64', grid: '12', blend: '0' };
const documentStub = {
  createElement: (tag) => elStub(tag),
  getElementById(id) {
    if (!byId[id]) {
      byId[id] = elStub('div');
      if (presets[id] !== undefined) byId[id].value = presets[id];
    }
    return byId[id];
  },
  querySelector: () => null, querySelectorAll: () => [], addEventListener: noop
};
global.window = { Game: {}, document: documentStub };
global.document = documentStub;
global.Image = ImageStub;

const runtimeErrors = [];
process.on('uncaughtException', (e) => { runtimeErrors.push(e && e.message || String(e)); });

// stránka načítá v tomto pořadí: window.Game, art.js, tiles_ai.js, inline skript
try {
  vm.runInThisContext(blocks[0], { filename: 'preview-inline-1.js' });
  for (const f of ['js/data/character.js', 'js/systems/groups.js']) {
    vm.runInThisContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), { filename: f });
  }
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js/render/art.js'), 'utf8'),
    { filename: 'art.js' });
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js/render/tiles_ai.js'), 'utf8'),
    { filename: 'tiles_ai.js' });
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js/render/units_ai.js'), 'utf8'),
    { filename: 'units_ai.js' });
  vm.runInThisContext(blocks[1], { filename: 'preview-inline-2.js' });
  while (pendingImg.length) pendingImg.shift().onload();   // dlaždice
  // props se dotahují zvlášť (a v testu žádné soubory nejsou)
  while (pendingImg.length) pendingImg.shift().onerror();
} catch (e) {
  runtimeErrors.push(e && e.message || String(e));
}

check('stranka se spustila bez chyby', () => {
  assert(runtimeErrors.length === 0, 'chyby: ' + runtimeErrors.join(' | '));
});

check('nacetly se vsechny textury', () => {
  const A = global.window.Game.AI_TILES;
  assert(A, 'AI_TILES neexistuje');
  assert(A.ready && A.loaded === 10, 'nacetlo se ' + A.loaded + ' terenu');
  assert(A.failed === 0, 'chyby nacitani: ' + A.failed);
});

check('postavily se vsechny panely', () => {
  const seams = byId['seams'] ? byId['seams'].children.length : 0;
  const mosaics = byId['mosaics'] ? byId['mosaics'].children.length : 0;
  const sheet = byId['sheet'] ? byId['sheet'].children.length : 0;
  const foundry = byId['foundry'] ? byId['foundry'].children.length : 0;
  const palette = byId['palette'] ? byId['palette'].children.length : 0;
  const figures = byId['figures'] ? byId['figures'].children.length : 0;
  const props = byId['props'] ? byId['props'].children.length : 0;
  assert(seams === 5, 'panelu svy: ' + seams + ' (ceka se 5)');
  assert(mosaics === 4, 'panelu mozaiky: ' + mosaics + ' (ceka se 4 bez prolnuti)');
  assert(sheet === 30, 'kontaktni list: ' + sheet + ' (ceka se 30 = 10 terenu x 3 velikosti)');
  assert(foundry === 3, 'panelu foundry: ' + foundry + ' (ceka se 3)');
  assert(palette === 10, 'swatchu palety: ' + palette + ' (ceka se 10 terenu)');
  assert(props === 10, 'panelu props: ' + props + ' (ceka se 10 druhu)');
  // počet panelů postav se odvozuje z tabulky rolí (ta se může rozrůst)
  const roleCount = Object.keys(global.window.Game.ROLES || {}).length;
  assert(figures === 12 + roleCount,
    'panelu postav: ' + figures + ' (ceka se ' + (12 + roleCount) + ' = 6 pripadu x 2 vzhledy + ' + roleCount + ' roli)');
});

check('spocitala se diagnostika', () => {
  const diag = byId['diag'] ? byId['diag'].textContent : '';
  assert(diag && diag.length > 200, 'diagnostika je prazdna');
  for (const must of ['navazování assetu', 'seam', 'perioda', 'kontrast', 'foundry', 'balíčky']) {
    assert(diag.indexOf(must) >= 0, 'v diagnostice chybi "' + must + '"');
  }
  assert(diag.indexOf('NaN') < 0, 'diagnostika obsahuje NaN');
});

check('balicky vzhledu maji platnou a citelnou paletu', () => {
  const pv = global.window.__preview;
  assert(pv && pv.packages && pv.packages.length >= 4, 'chybí definice balíčků');
  const boxes = byId['packages'] ? byId['packages'].children.length : 0;
  assert(boxes === pv.packages.length,
    'panelu balíčků: ' + boxes + ' (ceka se ' + pv.packages.length + ')');
  const ter = ['grass','forest','deep_forest','hills','mountain','water','swamp','snow','road','dirt'];
  const hex = /^#[0-9a-f]{6}$/;
  const info = [];
  for (const pkg of pv.packages) {
    const pal = pv.palettes[pkg.id];
    assert(pal, 'balíček ' + pkg.id + ' nemá paletu');
    for (const t of ter) {
      const e = pal[t];
      assert(e && hex.test(e.base) && hex.test(e.dark) && hex.test(e.light),
        'balíček ' + pkg.id + '/' + t + ' nemá platné barvy: ' + JSON.stringify(e));
      assert(e.daubs && e.daubs.length >= 3, 'balíček ' + pkg.id + '/' + t + ' nemá štětce');
      for (const d of e.daubs) assert(hex.test(d), 'neplatná barva štětce: ' + d);
    }
    const md = pv.minDistance(pal);
    // po roztažení musí být každý balíček čitelný (limit 26)
    assert(md.d >= 26, 'balíček ' + pkg.id + ' není čitelný: rozestup ' + md.d.toFixed(1));
    info.push(pkg.id + ' ' + pv.rawDistances[pkg.id].toFixed(1) + '->' + md.d.toFixed(1) +
      (pv.fitK[pkg.id] > 1.01 ? ' (x' + pv.fitK[pkg.id].toFixed(1) + ')' : ''));
  }
  console.log('       (syrové -> roztažené: ' + info.join(', ') + ')');
});

console.log('');
if (failed) {
  console.log('VYSLEDEK: CHYBA — ' + failed + ' testu selhalo');
  process.exit(1);
}
console.log('VYSLEDEK: OK — náhled dlaždic běží');
