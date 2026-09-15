// headless-smoke.js — spustí Idle Realm bez prohlížeče (Node) a ověří, že běží.
// Použití:  node test/headless-smoke.js
// Exit 0 = OK, exit 1 = chyba.
//
// Simuluje prohlížeč (window/document/localStorage), načte všech 56 skriptů
// v pořadí z index.html, zobrazí title screen → spustí Novou hru, a pak
// prožene ticky. Odhalí runtime chyby, které statická analýza nezachytí.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
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
  performance: { now: () => Date.now() }, navigator: { userAgent: 'node-headless-smoke' },
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

let failed = 0;
function check(name, fn) {
  try { fn(); console.log('  OK   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + ' :: ' + e.message); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assert selhal'); }

console.log('=== Idle Realm — headless smoke test ===');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const srcs = [...html.matchAll(/src="([^"]+)"/g)].map((m) => m[1]);
const nonMain = srcs.filter((s) => s.indexOf('main.js') === -1);

let loadErr = 0;
for (const s of nonMain) {
  try { vm.runInThisContext(fs.readFileSync(path.join(ROOT, s), 'utf8'), { filename: s }); }
  catch (e) { loadErr++; console.log('  LOAD ERROR ' + s + ': ' + e.message); }
}
check('nacteni ' + nonMain.length + ' skriptu bez chyb', () => assert(loadErr === 0, loadErr + ' chyb'));

const G = windowStub.Game;
check('window.Game existuje', () => assert(!!G));

let titleOpts = null;
G.showTitleScreen = (opts) => { titleOpts = opts; };
try { vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8'), { filename: 'js/main.js' }); }
catch (e) { failed++; console.log('  FAIL main.js: ' + e.message); }

check('title screen zavolan', () => assert(!!titleOpts));
check('Nova hra se spusti', () => { titleOpts.onNewGame('normal'); assert(!!G.state); });
check('stav ma postavy a svet', () => assert(G.state.units.length > 0 && G.WORLD.settlements.length > 0));
check('obtiznost funguje', () => assert(G.currentDifficulty().id === 'normal'));
check('200x tick() bez vyjimky', () => { for (let i = 0; i < 200; i++) G.tick(0.1); });
check('20x tickAutonomy() bez vyjimky', () => { for (let i = 0; i < 20; i++) G.tickAutonomy(2); });
check('20x tickEconomy() bez vyjimky', () => { for (let i = 0; i < 20; i++) G.tickEconomy(0.1); });
check('craft() funguje', () => { if (G.craft) G.craft('plank', [G.state.units[0].id]); });
check('settlementMarket() funguje', () => { if (G.settlementMarket) G.settlementMarket(G.WORLD.settlements[0].id); });
check('udalosti jsou vypnute (faze 0)', () => assert(G.EVENTS_ENABLED === false));
check('fronta prikazu: addOrder + tickOrders', () => {
  const u = G.state.units.find(x => !x.dead && !x.isChild && !x.onExpedition);
  assert(!!u, 'zadna pouzitelna postava');
  if (u.assignedTaskId && G.detachUnit) G.detachUnit(u.id);
  u.assignedTaskId = null;
  u.resting = false;
  if (G.wakeUnit) G.wakeUnit(u);
  const o = G.addOrder({ activityId: 'chop_wood' });
  assert(!!o && G.state.orders.some(x => x.id === o.id), 'prikaz se nepridal');
  G.tickOrders();
  assert(!G.state.orders.some(x => x.id === o.id), 'prikaz se nevyridil');
});
check('fronta prikazu drzi mnozstvi (targetQty)', () => {
  for (const t of G.state.tasks.slice()) G.cancelTask(t.id);
  const u = G.state.units.find(x => !x.dead && !x.isChild && !x.onExpedition && !(x.merchantState && x.merchantState.active));
  assert(!!u, 'zadna pouzitelna postava');
  if (G.wakeUnit) G.wakeUnit(u);
  u.resting = false;
  u.assignedTaskId = null;
  const o = G.addOrder({ activityId: 'chop_wood', targetQty: 37 });
  assert(!!o, 'prikaz se nepridal');
  G.tickOrders();
  const t = G.state.tasks.find(x => x.activityId === 'chop_wood');
  assert(!!t, 'prikaz se nevyridil');
  assert(t.targetQty === 37, 'targetQty se prenesl spatne: ' + t.targetQty);
});
check('buyGem: nakup gemu funguje', () => {
  const city = G.WORLD.settlements.find(s => s.size === 'city') || G.WORLD.settlements[0];
  assert(!!city, 'zadne sidlo');
  const gid = Object.keys(G.GEMS)[0];
  const price = G.gemPrice(city.id, gid);
  assert(price > 0, 'cena gemu je 0');
  G.state.resources.gold = price + 5;
  const before = G.matCount('gem_' + gid);
  const res = G.buyGem(city.id, gid);
  assert(res.ok, 'nakup selhal: ' + (res.reason || '?'));
  assert(G.matCount('gem_' + gid) === before + 1, 'gem se nepridal');
  assert(G.state.resources.gold === 5, 'zlato se odecetlo spatne: ' + G.state.resources.gold);
});
check('vsechny panely se vykresli bez vyjimky', () => {
  const fns = ['panelPlace','panelActivities','panelUnits','panelGroups','panelExpeditions',
    'panelCraft','panelInventory','panelMerchant','panelReputation','panelPolitics',
    'panelLog','panelAchievements','panelPrestige','panelBase'];
  for (const f of fns) {
    assert(typeof G[f] === 'function', 'chybi ' + f);
    const html = G[f]();
    assert(typeof html === 'string' && html.length > 0, f + ' nic nevykreslil');
  }
  const sid = G.WORLD.settlements[0].id;
  assert(typeof G.panelTrade(sid) === 'string', 'panelTrade nevykreslil');
});
check('modaly se vykresli bez vyjimky', () => {
  const u = G.state.units.find(x => !x.dead);
  assert(!!u, 'zadna postava');
  assert(typeof G.perkPanel(u.id) === 'string', 'perkPanel');
  assert(typeof G.mentorPanel(u.id) === 'string', 'mentorPanel');
  assert(typeof G.merchantPanel(u.id) === 'string', 'merchantPanel');
  assert(typeof G.expeditionModal() === 'string', 'expeditionModal');
  assert(typeof G.taskAssignModal({ activityId:'chop_wood', nodeId:null, targetQty:25 }) === 'string', 'taskAssignModal');
});
check('mnozstvi: pamet hodnot a davkova vyroba', () => {
  G.qtySet('act:chop_wood', 42);
  assert(G.qtyGet('act:chop_wood', 10) === 42, 'qtyGet nevratil ulozenou hodnotu');
  assert(G.qtyClamp(9999, 500) === 500, 'qtyClamp nezastropoval');
  assert(G.qtyClamp(0, 500) === 1, 'qtyClamp nepodlazil');
  assert(G.qtyClamp(NaN, 500) === 1, 'qtyClamp nezvlada NaN');
  G.matAdd('wood', 20, 'common');
  const before = G.matCount('plank');
  const res = G.craft('plank', 3);
  if (res.ok) assert(G.matCount('plank') === before + res.qty, 'davkova vyroba nepridala spravny pocet');
});
check('qtyControl vykresli ovladani mnozstvi', () => {
  const html = G.qtyControl('act:chop_wood', { value: 20, max: 500 });
  assert(html.indexOf('data-qty-key="act:chop_wood"') !== -1, 'chybi data-qty-key');
  assert(html.indexOf('data-action="qty-step"') !== -1, 'chybi tlacitka +/-');
  assert(html.indexOf('data-action="qty-set"') !== -1, 'chybi cipy');
});
check('chytre prirazeni: doporucena druzina + volby v modalu', () => {
  const units = G.state.units.filter(u => !u.dead && !u.isChild);
  assert(units.length > 0, 'zadne postavy');
  const rec = G.recommendParty(2, units);
  assert(rec.length >= 1 && rec.length <= units.length, 'recommendParty vratil divny pocet: ' + rec.length);
  const html = G.taskAssignModal({ activityId: 'chop_wood', nodeId: null, targetQty: 25 });
  assert(html.indexOf('data-action="assign-task-all"') !== -1, 'chybi volba "priradit vsem"');
  assert(html.indexOf('data-action="queue-task"') !== -1, 'chybi volba "do fronty"');
  if ((G.state.groups || []).length) {
    assert(html.indexOf('data-action="assign-task-group"') !== -1, 'chybi volba "priradit skupine"');
  }
});
check('fronta: razeni a priorita prikazu', () => {
  G.state.orders = [];
  const a = G.addOrder({ activityId: 'chop_wood' });
  const b = G.addOrder({ activityId: 'gather_stone' });
  const c = G.addOrder({ activityId: 'fish' });
  let ids = G.sortedOrders().map(o => o.id);
  assert(ids.join(',') === [a.id, b.id, c.id].join(','), 'vychozi poradi je spatne: ' + ids.join(','));
  G.moveOrder(c.id, -1);
  ids = G.sortedOrders().map(o => o.id);
  assert(ids[1] === c.id, 'posun nahoru nefungoval: ' + ids.join(','));
  G.moveOrder(c.id, -1);
  ids = G.sortedOrders().map(o => o.id);
  assert(ids[0] === c.id, 'druhy posun nahoru nefungoval: ' + ids.join(','));
  assert(G.moveOrder(c.id, -1) === false, 'posun nad prvni prikaz mel vratit false');
  assert(G.moveOrder(a.id, 1) === true, 'posun dolu mel projit');
  ids = G.sortedOrders().map(o => o.id);
  assert(ids.indexOf(a.id) === 2, 'posun dolu nefungoval: ' + ids.join(','));
  G.state.orders = [];
});
check('hromadne vzbuzeni postav', () => {
  const us = G.state.units.filter(u => !u.dead && !u.isChild).slice(0, 3);
  assert(us.length > 0, 'zadne postavy');
  for (const u of us) { u.resting = true; u.status = 'resting'; u.stamina = 30; }
  const n = G.wakeAllUnits();
  assert(n >= us.length, 'nevzbudil vsechny (' + n + ')');
  assert(us.every(u => !u.resting), 'nekdo zustal odpocivat');
});
check('směrnice: cilova hodnota + hledani v logu', () => {
  G.setDirective('focusMaterial', 'wood');
  G.setDirective('focusTarget', 77);
  assert(G.state.directives.focusTarget === 77, 'cilova hodnota se neulozila');
  G.state.logSearch = 'drev';
  assert(G.state.logSearch === 'drev', 'hledany vyraz se neulozil');
  G.renderLog();
  G.state.logSearch = '';
  G.setDirective('focusMaterial', null);
});
check('trh ukazuje cenu a trend proti zakladu', () => {
  const sid = G.WORLD.settlements[0].id;
  const html = G.panelTrade(sid);
  if (html.indexOf('koupíš') !== -1) {
    assert(html.indexOf('sklad') !== -1, 'chybi plnost skladu');
    assert(html.indexOf('%') !== -1, 'chybi trend ceny');
  }
});
check('zakladna: validace mista', () => {
  const w = G.WORLD;
  let water = null, mountain = null;
  for (let y = 0; y < w.h && (!water || !mountain); y++) for (let x = 0; x < w.w; x++) {
    const t = w.terrainAt(x, y);
    if (!water && t === 'water') water = { x: x, y: y };
    if (!mountain && t === 'mountain') mountain = { x: x, y: y };
  }
  if (water) assert(!G.canPlaceBaseAt(water.x, water.y).ok, 'voda mela byt neplatna');
  if (mountain) assert(!G.canPlaceBaseAt(mountain.x, mountain.y).ok, 'hora mela byt neplatna');
  const n = w.nodes[0];
  assert(!G.canPlaceBaseAt(n.x, n.y).ok, 'poli s uzlem melo byt neplatne');
  const st = w.settlements[0];
  assert(!G.canPlaceBaseAt(st.x, st.y).ok, 'poli se sidlem melo byt neplatne');
  assert(!G.canPlaceBaseAt(-1, 5).ok, 'mimo mapu melo byt neplatne');
  const s = G.suggestBaseSpot();
  assert(!!s, 'nenaslo se doporucene misto');
  assert(G.canPlaceBaseAt(s.x, s.y).ok, 'doporucene misto neni platne');
});
check('zakladna: nestavi se sama, ale po volbe hrace', () => {
  G.state.base = { unlocked: false, buildings: {}, accum: {}, x: 14, y: 18, placing: false, placementOffered: false, suggested: null };
  G.state.resources.renown = 30;
  assert(G.tryUnlockBase() === true, 'tryUnlockBase neproběhlo');
  assert(G.state.base.unlocked === false, 'zakladna se postavila sama, bez volby hrace');
  assert(G.state.base.placementOffered === true, 'nenabidlo se vyber mista');
  const html = G.panelBase();
  assert(html.indexOf('data-action="pick-base-spot"') !== -1, 'panel nenabizi vyber mista na mape');
  assert(html.indexOf('data-action="auto-place-base"') !== -1, 'panel nenabizi doporucene misto');
  G.startBasePlacement(false);
  assert(G.isBasePlacing() === true, 'rezim umisteni se nezapnul');
  const s = G.baseSuggestion();
  const res = G.placeBaseAt(s.x, s.y);
  assert(res.ok, 'umisteni selhalo: ' + (res.reason || '?'));
  assert(G.state.base.unlocked === true, 'zakladna neni po umisteni odemcena');
  assert(G.basePos().x === s.x && G.basePos().y === s.y, 'poloha se neulozila');
  assert(G.isBasePlacing() === false, 'rezim umisteni zustal zapnuty');
  assert(G.baseLocationText().length > 0, 'popis polohy je prazdny');
  assert(G.panelBase().indexOf('data-action="center-base"') !== -1, 'panel neumi zobrazit zakladnu na mape');
});
check('charakterove udalosti: resolveCharacterEvent', () => {
  const u = G.state.units.find(x => !x.dead && !x.isChild);
  assert(!!u, 'zadna postava');
  const before = G.matCount('crystal');
  G.resolveCharacterEvent(u, { icon: '💎', journal: 'Test nalez.', effects: [{ type: 'mat', material: 'crystal', qty: [1, 2] }] });
  assert(G.matCount('crystal') > before, 'mat efekt se neprovedl');
});
check('charakterove udalosti: maybeCharacterEvent nespada', () => {
  const u = G.state.units.find(x => !x.dead && !x.isChild);
  G.maybeCharacterEvent(u, { nodeKind: 'cave' });
});

console.log('');
if (failed === 0) { console.log('VYSLEDEK: OK — vse funguje'); process.exit(0); }
else { console.log('VYSLEDEK: ' + failed + ' chyb'); process.exit(1); }
