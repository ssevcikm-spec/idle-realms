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
