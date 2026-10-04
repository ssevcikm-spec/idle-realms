// tile-transition.js — ověří PŘECHODY TERÉNŮ (malovaný vzhled) a foundry vrstvu.
//
// Použití:  node test/tile-transition.js
// Exit 0 = OK, exit 1 = chyba.
//
// Proč: ostré hrany mezi terény (voda/louka, les/louka) byly hlavní vada
// malované mapy. Řeší to dvě věci a obě se musí dát ověřit bez prohlížeče:
//   1) `G.tileMixAt` — dlaždice se prolije se sousedním terénem; váha je podíl
//      Gaussova jádra, takže přechod je ZÓNA (ne skok) a nikdy nepřepne víc
//      než polovinu dlaždice,
//   2) `G.FOUNDRY.overlay` — foundry jako vrstva nad dlaždicemi (hrany
//      a dekorace ve světových souřadnicích); režim „jen hrany“ nesmí kreslit
//      štětce, jinak by hotové textury přebil.
// Navíc se kontroluje, že modul nečte pixely (`getImageData`) — na `file://`
// by to shodilo hru (taint canvasu).

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let failed = 0;
function check(name, fn) {
  try { fn(); console.log('  OK   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + ' :: ' + e.message); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assert selhal'); }

// ---------- stub prohlížeče a světa ----------
global.window = { Game: {} };
const G = global.window.Game;
G.state = { settings: { tileStyle: 'ai' } };
G.drawWorldFrame = function () {};

const W = 32, H = 32;
// levá polovina louka, pravá voda — přechod je na x = 16
function terrainAt(x, y) {
  if (x < 0 || y < 0 || x >= W || y >= H) return '';
  return x < 16 ? 'grass' : 'water';
}
G.WORLD = { w: W, h: H, terrainAt };

// pořadí jako v index.html: art.js (foundry) pak tiles_ai.js
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js/render/art.js'), 'utf8'), { filename: 'art.js' });
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js/render/tiles_ai.js'), 'utf8'), { filename: 'tiles_ai.js' });

function fakeTiles(terrains) {
  G.AI_TILES.tiles = {};
  for (const t of terrains) G.AI_TILES.tiles[t] = { a: { width: 768, id: t }, b: null, win: 128, px: 6, py: 6 };
  G.AI_TILES.ready = true;
}
fakeTiles(['grass', 'water', 'forest']);

/** Záznamník kreslení (canvas v Node není). */
function ctxRec() {
  return {
    globalAlpha: 1, fillStyle: '#000', ellipseCalls: 0,
    calls: [],
    drawImage: function (img, sx, sy, sw, sh, dx, dy, dw, dh) {
      this.calls.push({ img: img, sx: sx, sy: sy, alpha: this.globalAlpha });
    },
    beginPath: function () {}, ellipse: function () { this.ellipseCalls++; },
    arc: function () { this.ellipseCalls++; }, fill: function () {}, stroke: function () {},
    moveTo: function () {}, lineTo: function () {}, closePath: function () {},
    fillRect: function () {}, save: function () {}, restore: function () {},
    createLinearGradient: function () { return { addColorStop: function () {} }; }
  };
}
function draw(x, y) {
  const ctx = ctxRec();
  G.tileDraw(ctx, terrainAt(x, y), 0, 0, 64, x, y);
  return ctx.calls;
}

// ---------------------------------------------------------------------------
check('modul necte pixely (jinak by na file:// spadl)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/render/tiles_ai.js'), 'utf8');
  assert(!/\.\s*getImageData\s*\(/.test(src), 'tiles_ai.js volá getImageData');
  assert(!/\.\s*toDataURL\s*\(/.test(src), 'tiles_ai.js volá toDataURL');
});

check('vypnuto = jedno kresleni na dlazdici (puvodni stav)', () => {
  G.setTileTransition(0);
  assert(draw(5, 5).length === 1, 'vnitrek ma ' + draw(5, 5).length + ' kresleni');
  assert(draw(15, 5).length === 1, 'hranice ma ' + draw(15, 5).length + ' kresleni');
});

check('vnitrek terenu se neproleva ani pri plnem prechodu', () => {
  G.setTileTransition(1);
  assert(draw(5, 5).length === 1, 'vnitrek se prolil (' + draw(5, 5).length + ' kresleni)');
});

check('hranice se prolije se sousedem (dve kresleni, alfa 0-0,5)', () => {
  G.setTileTransition(1);
  const c = draw(15, 5);
  assert(c.length === 2, 'ceka se 2 kresleni, je ' + c.length);
  assert(c[0].img.id === 'grass', 'zaklad ma byt grass, je ' + c[0].img.id);
  assert(c[1].img.id === 'water', 'soused ma byt water, je ' + c[1].img.id);
  assert(c[1].alpha > 0.03 && c[1].alpha <= 0.5, 'alfa sou sede je ' + c[1].alpha);
  assert(c[0].alpha === 1, 'zaklad ma byt neprusvitny, alfa ' + c[0].alpha);
});

check('vaha nikdy neprepne vic nez pulku dlazdice', () => {
  G.setTileTransition(1);
  for (let x = 12; x <= 20; x++) for (let y = 10; y <= 20; y++) {
    const m = G.tileMixAt(x, y);
    if (m) assert(m.weight <= 0.5, 'vaha ' + m.weight + ' na ' + x + ',' + y);
  }
});

check('prechod je ZONA, ne skok (vaha roste po dlazdicich)', () => {
  G.setTileTransition(1);
  const w = [];
  for (let x = 8; x <= 24; x++) { const m = G.tileMixAt(x, 16); w.push(m ? m.weight : 0); }
  const left = w.slice(0, 8).filter(v => v > 0).length;   // nalevo od hranice
  const right = w.slice(8).filter(v => v > 0).length;     // napravo
  assert(left >= 2, 'nalevo od hranice se proleva jen ' + left + ' dlazdic');
  assert(right >= 2, 'napravo od hranice se proleva jen ' + right + ' dlazdic');
  let maxJump = 0;
  for (let i = 1; i < w.length; i++) maxJump = Math.max(maxJump, Math.abs(w[i] - w[i - 1]));
  assert(maxJump < 0.4, 'sousedni dlazdice se lisi o ' + maxJump.toFixed(2) + ' (skok, ne zona)');
});

check('bez textury souseda se neproleva', () => {
  fakeTiles(['grass']);
  G.setTileTransition(1);
  assert(draw(15, 5).length === 1, 'prolilo se i bez textury souseda');
  fakeTiles(['grass', 'water', 'forest']);
});

check('nastaveni se ulozi a aplikuje pri kresleni', () => {
  assert(G.setTileTransition(1.5) === 1, 'sila se nezalomila na 1');
  assert(G.state.settings.tileTransition === 1, 'sila se neulozila do nastaveni');
  assert(G.setTileSpread(9) === 3, 'zona se nezalomila na 3');
  assert(G.state.settings.tileSpread === 3, 'zona se neulozila');
  G.AI_TILES.transition = 0;                    // simulace reloadu: v pameti 0
  const c = draw(15, 5);
  assert(c.length === 2, 'ulozene nastaveni se neaplikovalo (' + c.length + ' kresleni)');
  G.setTileTransition(1); G.setTileSpread(2);
});

check('foundry vrstva: vychozi stav je vypnuta', () => {
  assert(G.FOUNDRY && G.FOUNDRY.overlay === 0, 'overlay ma byt 0, je ' + (G.FOUNDRY && G.FOUNDRY.overlay));
});

check('foundry vrstva: nastaveni se ulozi a aplikuje', () => {
  assert(G.setFoundry('overlay', 1) === true, 'setFoundry overlay neproslo');
  assert(G.FOUNDRY.overlay === 1, 'overlay neni 1');
  assert(G.state.settings.foundry && G.state.settings.foundry.overlay === 1, 'neulozilo se');
  assert(G.setFoundry('overlay', 7) === true && G.FOUNDRY.overlay === 2, 'overlay se nezalomil na 2');
  G.FOUNDRY.overlay = 0;
  G.applyFoundrySettings();
  assert(G.FOUNDRY.overlay === 2, 'ulozene nastaveni se neaplikovalo');
  G.setFoundry('overlay', 1);
});

check('foundry rezim "jen hrany" nekresli stetce', () => {
  const view = { x0: 8, x1: 24, y0: 8, y1: 24, ox: 0, oy: 0, tilePx: 64, mode: 'detail',
                 quality: 1, terrainAt: terrainAt };
  const full = ctxRec();
  G.foundryGround(full, view);
  const edges = ctxRec();
  G.foundryGround(edges, view, 'edges');
  assert(edges.ellipseCalls > 0, 'rezim "jen hrany" nekresli vubec nic');
  assert(full.ellipseCalls > edges.ellipseCalls,
    'stetce se nevynechaly (plny ' + full.ellipseCalls + ' vs hrany ' + edges.ellipseCalls + ')');
});

console.log('');
if (failed) {
  console.log('VYSLEDEK: CHYBA — ' + failed + ' testu selhalo');
  process.exit(1);
}
console.log('VYSLEDEK: OK — přechody terénů i foundry vrstva fungují');
