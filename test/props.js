// props.js — ověří AI sprity krajinných prvků (js/render/art.js + units_ai.js).
//
// Použití:  node test/props.js
// Exit 0 = OK, exit 1 = chyba.
//
// Krajinné prvky (strom, skála, trs, rákosí…) umí hra kreslit kódem a volitelně
// je nahradit alfa sprity z `assets/props/`. Test hlídá:
//   1) bez spritů se kreslí kódem (fallback je vždy funkční),
//   2) se spritem se použije `drawImage` a kódová kresba se přeskočí,
//   3) výměna NEPOSUNE krajinu — vizuální těžiště zůstane na místě,
//   4) načítání snese chybějící soubory a nezkouší to každý snímek znovu,
//   5) přepínač `settings.props` se ukládá a je nezávislý na vzhledu mapy
//      i na vzhledu postav.

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
  this.width = 64; this.height = 64;
  this.onload = null; this.onerror = null;
  Object.defineProperty(this, 'src', {
    set(v) { self._src = v; pendingImg.push(self); },
    get() { return self._src; }
  });
}
global.window = { Game: {} };
global.document = { createElement: () => ({ getContext: () => ({}) }) };
global.Image = ImageStub;

vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js/render/art.js'), 'utf8'), { filename: 'art.js' });
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js/render/units_ai.js'), 'utf8'), { filename: 'units_ai.js' });
const G = global.window.Game;

// data, která v prohlížeči plní jiné moduly
G.nodeTiles = (n) => (n.tiles || []);
G.state = { settings: {} };

/** Vypustí frontu načítání (chybí = simulace 404). */
function flush(missing) {
  while (pendingImg.length) {
    const img = pendingImg.shift();
    if (missing) img.onerror(); else img.onload();
  }
}
function recCtx() {
  const base = { globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1, lineJoin: '', lineCap: '' };
  const ops = { drawImage: [], ellipses: [], fillRect: 0, stroke: 0, fill: 0 };
  const ctx = new Proxy(base, {
    get(t, p) {
      if (p === 'drawImage') return function () { ops.drawImage.push([].slice.call(arguments, 1)); };
      if (p === 'ellipse') return function (cx, cy, rx, ry) { ops.ellipses.push([cx, cy, rx, ry]); };
      if (p in t) return t[p];
      return function () { if (ops[p] !== undefined) ops[p]++; };
    },
    set(t, p, v) { t[p] = v; return true; }
  });
  return { ctx: ctx, ops: ops };
}
function drawNode(kind) {
  const r = recCtx();
  const node = { id: 'n1', kind: kind, x: 10, y: 10, tiles: [{ x: 10, y: 10 }] };
  G.drawNodeFeature(r.ctx, node, 0, 0, 64);
  return r.ops;
}
/** Vážené těžiště kresby (koruny/elipsy vs. obdélníky spritů). */
function centroid(ops) {
  const pts = [];
  for (const e of ops.ellipses) pts.push([e[0], e[1]]);
  // drawImage(sprite, dx, dy, dw, dh) -> střed obdélníku
  for (const a of ops.drawImage) pts.push([a[0] + a[2] / 2, a[1] + a[3] / 2]);
  if (!pts.length) return null;
  const sx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const sy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return [sx, sy];
}
const KINDS = ['tree','pine','boulder','tuft','bush','pebble','reed','drift','ripple','rut'];
function giveSprites() {
  G.AI_PROPS.sprites = {};
  for (const k of KINDS) G.AI_PROPS.sprites[k] = { width: 64, height: 64, _src: k };
  G.AI_PROPS.ready = true;
  G.AI_PROPS.tried = true;
}

check('modul props je nabidnuty', () => {
  for (const f of ['propStyle', 'setPropStyle', 'aiPropSprite', 'loadAiProps', 'ensureAiProps']) {
    assert(typeof G[f] === 'function', 'chybí G.' + f);
  }
  assert(G.propStyle() === 'code', 'výchozí vzhled prvků nemá být kreslený: ' + G.propStyle());
});

check('bez spritu se kresli kodem', () => {
  const ops = drawNode('forest');
  assert(ops.drawImage.length === 0, 'kresba bez spritů použila drawImage: ' + ops.drawImage.length);
  assert(ops.ellipses.length > 5, 'kódová kresba lesa nic nenakreslila');
});

check('se spritem se pouzije drawImage a kresba se preskoci', () => {
  const codeOps = drawNode('forest');
  G.setPropStyle('ai');
  flush(true);
  giveSprites();
  const ops = drawNode('forest');
  assert(ops.drawImage.length > 0, 'se spritem se drawImage nepoužil');
  // pár elips patří podkladu uzlu (ne korunám) — kresba korun musí zmizet
  assert(ops.ellipses.length < codeOps.ellipses.length * 0.25,
    'se spritem se pořád kreslí koruny (elips ' + ops.ellipses.length +
    ' z ' + codeOps.ellipses.length + ')');
});

check('vymena spritu neposune krajinu (teziste zustane)', () => {
  // kódová kresba
  const codeOps = drawNode('forest');
  const c1 = centroid(codeOps);
  assert(c1, 'kódová kresba nemá těžiště');
  // se sprity
  giveSprites();
  const sprOps = drawNode('forest');
  const c2 = centroid(sprOps);
  assert(c2, 'kresba se sprity nemá těžiště');
  const shift = Math.hypot(c1[0] - c2[0], c1[1] - c2[1]);
  console.log('       (těžiště kresba ' + c1.map(v => v.toFixed(0)).join(',') +
    ' vs sprite ' + c2.map(v => v.toFixed(0)).join(',') + ' -> posun ' + shift.toFixed(1) + ' px)');
  assert(shift < 14, 'výměna spritu posunula krajinu o ' + shift.toFixed(1) + ' px');
  // sprite musí být rozumně velký a nad základnou
  for (const a of sprOps.drawImage) {
    assert(a[2] > 8 && a[2] < 60, 'sprite má podezřelou šířku: ' + a[2]);
    assert(a[3] > 8 && a[3] < 60, 'sprite má podezřelou výšku: ' + a[3]);
    assert(a[1] + a[3] > 0 && a[1] < 64, 'sprite je mimo dlaždici: dy=' + a[1].toFixed(1));
  }
});

check('stromy a skaly se nahradi sprity ve vsech druzich uzlu', () => {
  giveSprites();
  // napojené jsou stromy (tree/pine) a kameny (boulder); vstupy do dolů a jeskyní
  // mají vlastní kresbu a sprite druh zatím nemají (viz docs §16)
  for (const kind of ['forest', 'deep_forest', 'grove', 'quarry']) {
    const ops = drawNode(kind);
    assert(ops.drawImage.length > 0, 'uzel ' + kind + ' nepoužil ani jeden sprite');
  }
});

check('nacteni snese chybejici soubory', () => {
  G.AI_PROPS = { ready:false, loading:false, sprites:{}, loaded:0, failed:0, tried:false };
  G.state.settings.props = 'ai';
  G.loadAiProps();
  assert(pendingImg.length === KINDS.length, 'nemělo se zkoušet ' + KINDS.length + ' spritů, ale ' + pendingImg.length);
  flush(true);
  assert(G.AI_PROPS.failed === KINDS.length, 'chyby se nepočítají: ' + G.AI_PROPS.failed);
  assert(G.AI_PROPS.ready === false, 'ready nemá být true bez spritů');
  assert(G.AI_PROPS.tried === true, 'tried se má nastavit');
});

check('chybejici sprity se nezkousi kazdy snimek', () => {
  G.ensureAiProps();
  G.ensureAiProps();
  G.ensureAiProps();
  assert(pendingImg.length === 0, 'zkouší se to znovu: ' + pendingImg.length);
});

check('po nacteni se sprite pouzije', () => {
  G.AI_PROPS = { ready:false, loading:false, sprites:{}, loaded:0, failed:0, tried:false };
  G.state.settings.props = 'ai';
  G.loadAiProps();
  flush(false);
  assert(G.AI_PROPS.ready && G.AI_PROPS.loaded === KINDS.length,
    'sprity se nenačetly: ' + G.AI_PROPS.loaded);
  assert(G.aiPropSprite('tree') !== null, 'po načtení se sprite nevrací');
});

check('prepinac prvku je nezavisly na mape i postavach', () => {
  G.setPropStyle('ai');
  assert(G.state.settings.props === 'ai', 'volba se neuložila');
  assert(G.propStyle() === 'ai', 'propStyle nevrátil ai');
  G.setTileStyle ? G.setTileStyle('foundry') : (G.state.settings.tileStyle = 'foundry');
  G.setUnitStyle('code');
  assert(G.propStyle() === 'ai', 'volba prvků se přebila mapou nebo postavami');
  G.setPropStyle('code');
  assert(G.propStyle() === 'code', 'návrat ke kresbě nefunguje');
  assert(G.aiPropSprite('tree') === null, 'v kresleném vzhledu se sprite nemá vracet');
});

check('kresleni dekorace foundry projde v obou vzhledech', () => {
  const terrain = ['grass','forest','deep_forest','hills','mountain','water','swamp','snow','road','dirt'];
  for (const style of ['code', 'ai']) {
    G.state.settings.props = style;
    if (style === 'ai') giveSprites();
    for (let ti = 0; ti < terrain.length; ti++) {
      const r = recCtx();
      G.foundryDeco(r.ctx, {
        x0: 0, x1: 8, y0: 0, y1: 6, ox: 0, oy: 0, tilePx: 64, mode: 'detail', quality: 1,
        terrainAt: function () { return terrain[ti]; }
      });
      const drew = (style === 'ai')
        ? r.ops.drawImage.length > 0
        : (r.ops.stroke > 0 || r.ops.ellipses.length > 0 || r.ops.fill > 0);
      assert(drew, 'dekorace ' + terrain[ti] + ' ve vzhledu ' + style + ' nic nekreslila');
    }
  }
  G.setPropStyle('code');
});

console.log('');
if (failed) {
  console.log('VYSLEDEK: CHYBA — ' + failed + ' testu selhalo');
  process.exit(1);
}
console.log('VYSLEDEK: OK — krajinné prvky jdou nahradit sprity (a jinak se kreslí)');
