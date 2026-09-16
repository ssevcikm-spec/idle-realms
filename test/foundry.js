// foundry.js — ověří světovou vrstvu mapy (js/render/art.js, sekce FOUNDRY).
//
// Použití:  node test/foundry.js
// Exit 0 = OK, exit 1 = chyba.
//
// Foundry kreslí krajinu jako funkci SVĚTA, ne dlaždice — proto se nedá ověřit
// pohledem na jednu dlaždici. Ověřuje se geometrie plánu (`G.foundryOps` je
// čistá funkce, žádný canvas):
//   1) plán je deterministický,
//   2) je ukotvený ve světě — posun kamery posune prvky přesně o posun, nic
//      neproblikne (kdyby se hashoval screen, krajina by „plavala"),
//   3) mřížka štětců má přesně očekávaný počet buněk (pokrytí bez děr),
//   4) hash nemá krátkou periodu -> krajina se neopakuje,
//   5) hranice terénů se plánují právě jednou na hranu (ne dvakrát = dvojitá
//      alpha) a mimo mapu se neplánuje nic.

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

global.window = { Game: {} };
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js/render/art.js'), 'utf8'),
  { filename: 'art.js' });
const G = global.window.Game;

/** Jednoduchá testovací mapa: funkce (x,y) -> jméno terénu. */
function mapOf(w, h, fn) {
  return function (x, y) {
    if (x < 0 || y < 0 || x >= w || y >= h) return '';
    return fn(x, y);
  };
}
const GRASS = mapOf(64, 64, () => 'grass');
function view(over) {
  return Object.assign({
    x0: 5, x1: 15, y0: 5, y1: 15, ox: 100, oy: 80, tilePx: 64,
    mode: 'detail', quality: 1, terrainAt: GRASS
  }, over || {});
}
function plan(v) {
  const ops = [];
  G.foundryOps(v, function (kind, sx, sy, size, p1, p2, p3, p4) {
    ops.push([kind, sx, sy, size, p1, p2, p3, p4]);
  });
  return ops;
}
function rel(a, b) { return Math.abs(a - b) < 1e-9; }

check('modul foundry je nabidnuty', () => {
  for (const f of ['foundryField', 'foundryOps', 'foundryGround', 'foundryDeco', 'foundryBase']) {
    assert(typeof G[f] === 'function', 'chybí G.' + f);
  }
  assert(G.FOUNDRY && G.FOUNDRY.daub > 0 && G.FOUNDRY.deco > 0, 'chybí G.FOUNDRY');
});

check('zakladni barva existuje pro vsech 10 terenu', () => {
  const ter = ['grass','forest','deep_forest','hills','mountain','water','swamp','snow','road','dirt'];
  for (const t of ter) {
    const c = G.foundryBase(t);
    assert(/^#[0-9a-f]{6}$/i.test(c), 'terén ' + t + ' nemá barvu: ' + c);
  }
  assert(G.foundryBase('neexistuje') === G.PAL.grass.base, 'neznámý terén nemá fallback');
});

check('svetove pole je v rozsahu 0..1 a deterministicke', () => {
  let min = 1, max = 0;
  for (let i = 0; i < 4000; i++) {
    const x = (i % 97) * 0.7, y = Math.floor(i / 97) * 1.3;
    const v = G.foundryField(x, y, 7, 5);
    assert(v >= 0 && v <= 1, 'pole mimo rozsah: ' + v);
    assert(rel(v, G.foundryField(x, y, 7, 5)), 'pole není deterministické');
    if (v < min) min = v;
    if (v > max) max = v;
  }
  assert(max - min > 0.4, 'pole je skoro konstantní (' + min.toFixed(2) + '..' + max.toFixed(2) + ')');
});

check('plan je deterministicky', () => {
  const a = plan(view()), b = plan(view());
  assert(a.length === b.length, 'jiný počet prvků: ' + a.length + ' vs ' + b.length);
  assert(a.length > 100, 'plán je podezřele malý: ' + a.length);
  for (let i = 0; i < a.length; i++) {
    for (let k = 0; k < 8; k++) {
      assert(rel(a[i][k], b[i][k]), 'prvek ' + i + ' se liší v ' + k);
    }
  }
});

check('posun kamery posune prvky presne o posun (ukotveni ve svete)', () => {
  const a = plan(view({ ox: 100, oy: 80 }));
  const b = plan(view({ ox: 100 - 640, oy: 80 + 320 }));
  assert(a.length === b.length, 'jiný počet prvků');
  for (let i = 0; i < a.length; i++) {
    assert(a[i][0] === b[i][0], 'jiný typ prvku na ' + i);
    assert(rel(a[i][1] - 640, b[i][1]), 'sx není ukotvené ve světě (prvek ' + i + ')');
    assert(rel(a[i][2] + 320, b[i][2]), 'sy není ukotvené ve světě (prvek ' + i + ')');
    for (const k of [3, 4, 5, 6, 7]) {
      assert(rel(a[i][k], b[i][k]), 'parametr ' + k + ' se změnil s posunem kamery');
    }
  }
});

check('mrizka stetcu pokryva presne ocekavane bunky', () => {
  const v = view({ x0: 5, x1: 15, y0: 5, y1: 15 });
  const cell = G.FOUNDRY.daub;
  const nx = Math.ceil(15 / cell) + 1 - (Math.floor(5 / cell) - 1) + 1;
  const ny = Math.ceil(15 / cell) + 1 - (Math.floor(5 / cell) - 1) + 1;
  const daubs = plan(v).filter(o => o[0] === 0).length;
  assert(daubs === nx * ny, 'štětců je ' + daubs + ', čeká se ' + nx + '×' + ny);
});

check('hash umisteni nema kratkou periodu (krajina se neopakuje)', () => {
  // jeden řádek mřížky přes 120 dlaždic, bereme variantu barvy jako vzorek hashe
  const v = view({ x0: 5, y0: 5, x1: 125, y1: 5, terrainAt: mapOf(256, 64, () => 'grass') });
  const ops = plan(v);
  const cell = G.FOUNDRY.daub;
  const rows = {};
  for (const o of ops) {
    if (o[0] !== 0) continue;
    const gy = Math.floor(((o[2] - v.oy) / v.tilePx) / cell);
    (rows[gy] = rows[gy] || []).push(o[5]);
  }
  const keys = Object.keys(rows).sort((a, b) => a - b);
  assert(keys.length >= 3, 'málo řad mřížky: ' + keys.length);
  const seq = rows[keys[1]];               // prostřední řada
  assert(seq.length > 60, 'krátká řada: ' + seq.length +
    ' (radky: ' + keys.map(k => rows[k].length).join(',') + ')');
  const n = seq.length;
  const mean = seq.reduce((s, v) => s + v, 0) / n;
  const dev = seq.map(v => v - mean);
  let varSum = 0;
  for (const d of dev) varSum += d * d;
  let worst = 0, worstLag = 0;
  for (let lag = 1; lag <= 24; lag++) {
    let num = 0;
    for (let i = 0; i + lag < n; i++) num += dev[i] * dev[i + lag];
    const corr = num / varSum;
    if (Math.abs(corr) > Math.abs(worst)) { worst = corr; worstLag = lag; }
  }
  assert(Math.abs(worst) < 0.5,
    'hash má periodu (lag ' + worstLag + ', korelace ' + worst.toFixed(2) + ')');
});

check('hranice terenu se planuje prave jednou na hranu', () => {
  // svislá hranice voda|louka na x=10 (mapa 20x20)
  const m = mapOf(20, 20, (x) => (x < 10 ? 'water' : 'grass'));
  const v = view({ x0: 2, x1: 18, y0: 2, y1: 18, terrainAt: m });
  const edges = plan(v).filter(o => o[0] === 1);
  const nx = v.x1 + 1 - (v.x0 - 1) + 1;      // řady, které plán projde (s okrajem)
  assert(edges.length === nx, 'hran je ' + edges.length + ', čeká se ' + nx);
  for (const e of edges) {
    assert(e[7] === 0, 'hrana má být svislá, je ' + e[7]);
    assert(rel((e[1] - v.ox) / v.tilePx, 10), 'hrana není na x=10: ' + e[1]);
  }
  const vertical = plan(view({ x0: 2, x1: 18, y0: 2, y1: 18, terrainAt: mapOf(20, 20, (x, y) => (y < 10 ? 'water' : 'grass')) }))
    .filter(o => o[0] === 1);
  for (const e of vertical) assert(e[7] === 1, 'vodorovná hrana má p4=1, je ' + e[7]);
});

check('mimo mapu se neplanuje nic', () => {
  const m = mapOf(8, 8, () => 'grass');
  const v = view({ x0: -3, x1: 10, y0: -3, y1: 10, terrainAt: m });
  const ops = plan(v);
  assert(ops.length > 0, 'nic se neplánovalo');
  for (const o of ops) {
    const wx = (o[1] - v.ox) / v.tilePx, wy = (o[2] - v.oy) / v.tilePx;
    assert(wx >= 0 && wx < 8 && wy >= 0 && wy < 8,
      'prvek mimo mapu: ' + wx.toFixed(1) + ',' + wy.toFixed(1));
  }
});

check('pocet prvku na obrazovku je rozumny', () => {
  const v = view({ x0: 0, x1: 30, y0: 0, y1: 20, terrainAt: mapOf(64, 64, () => 'grass') });
  const ops = plan(v);
  assert(ops.length < 1400, 'na obrazovku se plánuje ' + ops.length + ' prvků');
  const deco = ops.filter(o => o[0] === 2).length;
  assert(deco > 0, 'v detailu se neplánuje žádná dekorace');
});

check('v prehledu se stetce ridnou a dekorace vynecha', () => {
  const detail = plan(view({ mode: 'detail' })).length;
  const overview = plan(view({ mode: 'overview', quality: 0.45 })).length;
  assert(overview < detail, 'přehled má ' + overview + ' prvků, detail ' + detail);
  const decoOv = plan(view({ mode: 'overview' })).filter(o => o[0] === 2).length;
  assert(decoOv === 0, 'v přehledu se plánuje dekorace: ' + decoOv);
});

check('kresleni proběhne pro všechny větve (přechody i dekorace)', () => {
  // mapa střídající všech 10 terénů -> projdou všechny dvojice hran i tvary dekorace
  const mixed = mapOf(64, 64, (x, y) => {
    const ter = ['grass','forest','deep_forest','hills','mountain','water','swamp','snow','road','dirt'];
    return ter[((x + y * 3) % 10 + 10) % 10];
  });
  const v = view({ x0: 0, x1: 20, y0: 0, y1: 20, terrainAt: mixed });
  const counts = { fill: 0, stroke: 0, ellipse: 0, arc: 0, moveTo: 0 };
  const base = { globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1 };
  const ctx = new Proxy(base, {
    get(t, p) {
      if (p in t) return t[p];
      return function () { if (counts[p] !== undefined) counts[p]++; };
    },
    set(t, p, val) { t[p] = val; return true; }
  });
  G.foundryGround(ctx, v);
  G.foundryDeco(ctx, v);
  assert(counts.fill > 150, 'málo vyplněných tvarů: ' + counts.fill);
  assert(counts.ellipse > 100, 'málo štětců/dekorací: ' + counts.ellipse);
  assert(counts.stroke > 10, 'málo tahů (dekorace trávy/rákosí): ' + counts.stroke);
});

check('kresleni vraci alfu zpet na 1', () => {
  const base = { globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1 };
  const ctx = new Proxy(base, {
    get(t, p) { return (p in t) ? t[p] : function () {}; },
    set(t, p, v) { t[p] = v; return true; }
  });
  G.foundryGround(ctx, view());
  G.foundryDeco(ctx, view());
  assert(base.globalAlpha === 1, 'po kreslení zůstala alpha ' + base.globalAlpha);
});

check('ladeni foundry se uklada a meni plan', () => {
  G.state = { settings: {} };
  const wide = { x0: 0, x1: 30, y0: 0, y1: 20, terrainAt: mapOf(64, 64, () => 'grass') };
  const before = plan(view(wide)).filter(o => o[0] === 0).length;
  assert(G.setFoundry('daub', 1.6) === true, 'setFoundry neprošlo');
  assert(Math.abs(G.FOUNDRY.daub - 1.6) < 1e-9, 'hodnota se nenastavila: ' + G.FOUNDRY.daub);
  assert(G.state.settings.foundry && G.state.settings.foundry.daub === 1.6,
    'ladění se neuložilo do settings.foundry');
  const after = plan(view(wide)).filter(o => o[0] === 0).length;
  assert(after < before, 'větší štětce nemají zmenšit počet štětců (' + after + ' vs ' + before + ')');
});

check('ladeni foundry drzi rozumne meze', () => {
  G.setFoundry('daub', 99);
  assert(G.FOUNDRY.daub === 2.6, 'horní mez neplatí: ' + G.FOUNDRY.daub);
  G.setFoundry('daub', 0.01);
  assert(G.FOUNDRY.daub === 0.6, 'dolní mez neplatí: ' + G.FOUNDRY.daub);
  G.setFoundry('quality', 5);
  assert(G.FOUNDRY.quality === 1, 'hustota má strop 1: ' + G.FOUNDRY.quality);
  assert(G.setFoundry('nesmysl', 1) === false, 'neznámý klíč má vrátit false');
});

check('vypnuti prechodu opravdu vynecha hrany', () => {
  const m = mapOf(20, 20, (x) => (x < 10 ? 'water' : 'grass'));
  const v = view({ x0: 2, x1: 18, y0: 2, y1: 18, terrainAt: m });
  G.setFoundry('edge', 1);
  assert(plan(v).filter(o => o[0] === 1).length > 0, 'se zapnutými přechody žádná hrana není');
  G.setFoundry('edge', 0);
  assert(plan(v).filter(o => o[0] === 1).length === 0, 's vypnutými přechody se hrany pořád plánují');
  G.setFoundry('edge', 1);
});

check('ulozene ladeni se promitne zpet do G.FOUNDRY', () => {
  G.state.settings.foundry = { daub: 1.8, deco: 3.0, quality: 0.4 };
  G.FOUNDRY.daub = 1.0; G.FOUNDRY.deco = 2.2; G.FOUNDRY.quality = 1;
  G.applyFoundrySettings();
  assert(G.FOUNDRY.daub === 1.8 && G.FOUNDRY.deco === 3.0 && G.FOUNDRY.quality === 0.4,
    'uložené ladění se nepromítlo: ' + JSON.stringify(G.FOUNDRY));
});

check('vychozi hodnoty foundry se vrati', () => {
  for (const [k, v] of [['daub', 1.0], ['deco', 2.2], ['quality', 1], ['edge', 1]]) {
    G.setFoundry(k, v);
  }
  assert(G.FOUNDRY.daub === 1.0 && G.FOUNDRY.deco === 2.2 &&
         G.FOUNDRY.quality === 1 && G.FOUNDRY.edge === 1, 'návrat k výchozím hodnotám selhal');
});

console.log('');
if (failed) {
  console.log('VYSLEDEK: CHYBA — ' + failed + ' testu selhalo');
  process.exit(1);
}
console.log('VYSLEDEK: OK — foundry je ukotvený ve světě a neopakuje se');
