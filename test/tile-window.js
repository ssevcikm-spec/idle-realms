// tile-window.js — ověří, že malované dlaždice se kreslí jako SPOJITÉ OKNO.
//
// Použití:  node test/tile-window.js
// Exit 0 = OK, exit 1 = chyba.
//
// Proč samostatný test: bez prohlížeče se nedá číst z canvasu, takže se
// nekontroluje barva, ale **geometrie kreslení** — a ta rozhoduje o švech.
// Test nahradí prohlížeč (window/document/Image) a nahrává `Image` se
// skutečnou velikostí assetu, takže se ověří:
//   1) dlaždice se skládají ze sousedních výřezů textury (okno se posune
//      přesně o šířku okna, nikdy nepřeteče okraj) -> šev nemůže vzniknout,
//   2) na konci textury se okno obtáčí (torus),
//   3) záložní kreslená cesta se použije, když malovaná není k dispozici,
//   4) prolnutí dvou textur sčítá váhy na 1 a první textura je neprůhledná
//      (jinak by se prolnutí násobilo a obrázek by bledl).

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
const pendingImg = [];
function ImageStub() {
  const self = this;
  this.width = 768; this.height = 768;
  this.onload = null; this.onerror = null;
  Object.defineProperty(this, 'src', {
    set(v) { self._src = v; pendingImg.push(self); },
    get() { return self._src; }
  });
}
const G = {};
global.window = { Game: G, document: { createElement: () => ({ getContext: () => ({ drawImage: noop }) }) } };
global.document = global.window.document;
global.Image = ImageStub;

// dlaždicový modul sahá na tyhle věci z okolí
G.state = { settings: {} };
G.getTileArt = (terrain, variant) => ({ code: true, terrain, variant });

// ---------- načtení modulu ----------
const src = fs.readFileSync(path.join(ROOT, 'js/render/tiles_ai.js'), 'utf8');
vm.runInThisContext(src, { filename: 'tiles_ai.js' });

assert(typeof G.tileDraw === 'function', 'modul nedefinoval G.tileDraw');
assert(typeof G.loadAiTiles === 'function', 'modul nedefinoval G.loadAiTiles');

// ---------- načtení textur (simulace onload) ----------
let done = false;
G.loadAiTiles(() => { done = true; });
assert(pendingImg.length === 20, 'nemělo se načítat 20 textur, ale ' + pendingImg.length);
while (pendingImg.length) pendingImg.shift().onload();

function recCtx() {
  return {
    globalAlpha: 1,
    calls: [],
    drawImage(...a) { this.calls.push({ args: a, alpha: this.globalAlpha }); }
  };
}

check('textury se nacetly pro vsech 10 terenu', () => {
  assert(done, 'callback loadAiTiles neproběhl');
  assert(G.AI_TILES.ready, 'AI_TILES.ready není true');
  assert(G.AI_TILES.loaded === 10, 'nacetlo se ' + G.AI_TILES.loaded + ' terenu, ceka se 10');
  assert(G.AI_TILES.failed === 0, 'nacetlo se ' + G.AI_TILES.failed + ' chyb');
});

check('okno deli texturu beze zbytku', () => {
  const t = G.AI_TILES.tiles.grass;
  assert(t.win === 128, 'okno ma byt 128 px, je ' + t.win);
  assert(t.px * t.win === t.a.width, 'okno nedeli texturu: ' + t.px + '*' + t.win);
  assert(t.py * t.win === t.a.height, 'okno nedeli texturu na vysku');
  assert(t.px === 6 && t.py === 6, 'perioda ma byt 6, je ' + t.px + 'x' + t.py);
  assert(t.b, 'druha textura pro prolnuti se nenacetla');
});

check('sousedni dlazdice jsou sousedni vyrezy textury (bez sve)', () => {
  G.setTileStyle('ai');
  G.setTileBlend(0);
  const ctx = recCtx();
  const xs = [];
  for (let x = 0; x < 8; x++) {
    ctx.calls.length = 0;
    assert(G.tileDraw(ctx, 'grass', x * 64, 0, 64, x, 0) === true, 'tileDraw nic nekreslil pro x=' + x);
    assert(ctx.calls.length === 1, 'ceka se 1 drawImage, je ' + ctx.calls.length);
    const a = ctx.calls[0].args;
    assert(a[3] === 128 && a[4] === 128, 'vyrez ma byt 128x128, je ' + a[3] + 'x' + a[4]);
    xs.push(a[1]);
  }
  const win = G.AI_TILES.tiles.grass.win, W = G.AI_TILES.tiles.grass.a.width;
  for (let i = 0; i < xs.length; i++) {
    assert(xs[i] + win <= W, 'vyrez pretekl texturu: ' + xs[i] + '+' + win + ' > ' + W);
  }
  for (let i = 0; i < xs.length - 1; i++) {
    const ok = xs[i] + win === xs[i + 1] || (xs[i] + win === W && xs[i + 1] === 0);
    assert(ok, 'vyrezy na sebe nenavazuji: ' + xs[i] + ' -> ' + xs[i + 1]);
  }
  assert(xs[6] === 0, 'okno se neobtoci na zacatek textury (torus): ' + xs[6]);
});

check('okno se posouva i po ose Y', () => {
  const ctx = recCtx();
  const ys = [];
  for (let y = 0; y < 7; y++) {
    ctx.calls.length = 0;
    G.tileDraw(ctx, 'grass', 0, y * 64, 64, 0, y);
    ys.push(ctx.calls[0].args[2]);
  }
  const win = G.AI_TILES.tiles.grass.win;
  const H = G.AI_TILES.tiles.grass.a.height;
  for (let i = 0; i < ys.length - 1; i++) {
    const ok = ys[i] + win === ys[i + 1] || (ys[i] + win === H && ys[i + 1] === 0);
    assert(ok, 'Y okno nenavazuje: ' + ys[i] + ' -> ' + ys[i + 1]);
  }
  assert(ys[6] === 0, 'Y okno se neobtoci na zacatek textury: ' + ys[6]);
});

check('zaporne svetove souradnice se obtoci (modulo)', () => {
  const ctx = recCtx();
  G.tileDraw(ctx, 'grass', 0, 0, 64, -1, -1);
  const a = ctx.calls[0].args, t = G.AI_TILES.tiles.grass;
  assert(a[1] === (t.px - 1) * t.win, 'sx pro wx=-1 je ' + a[1]);
  assert(a[2] === (t.py - 1) * t.win, 'sy pro wy=-1 je ' + a[2]);
  assert(a[1] >= 0 && a[1] + a[3] <= t.a.width, 'vyrez mimo texturu');
});

check('kresleny vzhled pouzije zalozni cestu', () => {
  G.setTileStyle('code');
  const ctx = recCtx();
  assert(G.tileDraw(ctx, 'grass', 0, 0, 64, 0, 0) === false, 'v kreslenem vzhledu se ma vratit false');
  assert(ctx.calls.length === 0, 'v kreslenem vzhledu se nic nemelo kreslit');
  const art = G.tileArt('grass', 3);
  assert(art && art.code === true && art.variant === 3, 'G.tileArt nemá vracet kreslenou dlaždici');
  G.setTileStyle('ai');
});

check('neznamy teren vraci false (fallback hry)', () => {
  const ctx = recCtx();
  assert(G.tileDraw(ctx, 'lava', 0, 0, 64, 0, 0) === false, 'neznamy teren ma vratit false');
});

check('prolnuti textur scita vahy na 1', () => {
  G.setTileBlend(1);
  const ctx = recCtx();
  G.tileDraw(ctx, 'grass', 0, 0, 64, 3, 3);
  assert(ctx.calls.length === 2, 'prolnuti ma kreslit 2 obrazy, kresli ' + ctx.calls.length);
  assert(ctx.calls[0].alpha === 1, 'prvni textura musi byt neprůhledná, je ' + ctx.calls[0].alpha);
  const wa = 0.5 + 0.5 * Math.sin(2 * Math.PI * (3 / 29 + 3 / 43));
  const a2 = ctx.calls[1].alpha;
  assert(Math.abs(a2 - (1 - wa)) < 1e-9, 'vaha druhe textury je ' + a2 + ', ceka se ' + (1 - wa));
  assert(a2 > 0 && a2 < 1, 'vaha druhe textury ma byt mezi 0 a 1');
  G.setTileBlend(0);
});

check('nulove prolnuti kresli jen jednou', () => {
  const ctx = recCtx();
  G.tileDraw(ctx, 'grass', 0, 0, 64, 5, 5);
  assert(ctx.calls.length === 1, 'bez prolnuti se ma kreslit 1 obraz, kresli ' + ctx.calls.length);
});

check('kazdy teren ma vlastni texturu', () => {
  const ctx = recCtx();
  const seen = new Set();
  for (const t of ['grass', 'forest', 'water', 'snow', 'road']) {
    ctx.calls.length = 0;
    assert(G.tileDraw(ctx, t, 0, 0, 64, 0, 0) === true, 'teren ' + t + ' se nekreslil');
    seen.add(ctx.calls[0].args[0]._src);
  }
  assert(seen.size === 5, 'tereny sdileji texturu: ' + seen.size + ' z 5');
});

console.log('');
if (failed) {
  console.log('VYSLEDEK: CHYBA — ' + failed + ' testu selhalo');
  process.exit(1);
}
console.log('VYSLEDEK: OK — okno dlaždic je spojité');
