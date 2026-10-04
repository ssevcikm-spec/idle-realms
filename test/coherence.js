// coherence.js — brána koherence herní architektury (docs/ARCHITEKTURA_PREMISA §4).
//
// Použití:  node test/coherence.js
// Exit 0 = OK, exit 1 = chyba.
//
// Proč existuje: `headless-smoke` dokazuje, že hra BĚŽÍ, a `check-globals`,
// že kód je čistý. Tady jde o vlastnost, kterou nejde rozbít tichým merge-em:
//
//   K1  každý krok záměru je splnitelný existující aktivitou, receptem,
//       stavbou nebo API — mrtvý záměr je chyba, ne „vlastnost hry".
//
// ⚠ BRÁNA, KDE JE SNADNÉ MLČET: cyklus přes záměry, které umí vzniknout, když
// je seznam prázdný, je zelený aniž by cokoli změřil. Proto se tady POČÍTÁ,
// kolik záměrů a kroků se prošlo, a počty jsou součástí tvrzení (viz `neprazdne`).
// Záměry se NEPIŠOU ručně — berou se z herních dat (expedice, materiály,
// dovednosti, sídla), takže test vyhovuje i záměru, který vznikne až za rok.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const noop = function () {};

// ---------- stub prohlížeče (stejný jako v headless-smoke.js) ----------
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
  performance: { now: () => Date.now() }, navigator: { userAgent: 'node-coherence' },
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

// ---------- načtení hry ----------
console.log('=== Idle Realm — brána koherence (K1 dosažitelnost) ===');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const srcs = [...html.matchAll(/src="([^"]+)"/g)].map((m) => m[1]);
for (const s of srcs.filter((s) => s.indexOf('main.js') === -1)) {
  try { vm.runInThisContext(fs.readFileSync(path.join(ROOT, s), 'utf8'), { filename: s }); }
  catch (e) { failed++; console.log('  LOAD ERROR ' + s + ': ' + e.message); }
}
const G = windowStub.Game;
G.setSeed(20260910);
G.showTitleScreen = (opts) => { G.__opts = opts; };
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8'), { filename: 'js/main.js' });
G.__opts.onNewGame('normal');
check('hra se spustila (bez stavu nema co merit)', () => assert(!!G.state && !!G.WORLD));

/* ---------- K1: je krok splnitelný existující věcí ve hře? ---------- */

/** Umí hra tenhle způsob splnění? — a umí ho VŠECHNY uvedené? */
function resolves(sat) {
  switch (sat.type) {
    case 'material':
      // ne jen „materiál existuje", ale „umí se získat": vyrobit prací
      // (aktivita/recept) NEBO získat lovem, obchodem, expedicí, stavbou
      return !!G.MATERIALS[sat.id] && (G.materialWork(sat.id) > 0 || G.materialSource(sat.id).length > 0);
    case 'skill': {
      // „Dovednost existuje" nestačí: šest dovedností nemá sběrnou aktivitu
      // (kovářství, alchymie, kuchařství, řemeslo, obchod, boj). Ty rostou
      // výrobou, obchodem nebo doprovodem — a plánovač proto vypisuje
      // konkrétní ZDROJE, které se dají ověřit proti kódu.
      if (!G.SKILLS[sat.id]) return false;
      const src = G.skillSources(sat.id);
      if (!src.length) throw new Error('dovednost ' + sat.id + ' nemá žádný zdroj, kterým by se dala zvednout');
      return src.some(resolves);
    }
    case 'recipe':
      return !!G.RECIPES[sat.id];
    case 'activity':
      return !!G.ACTIVITIES[sat.id];
    case 'slot':
      return Object.keys(G.EQUIPMENT).some(id => {
        const d = G.EQUIPMENT[id];
        return d.slot === sat.id && d.tier >= (sat.minTier || 1);
      });
    case 'api':
      return typeof G[sat.id] === 'function';
    default:
      return false;                 // neznámý typ = nesplnitelné, ne „nevadí"
  }
}

/** Záměry, které umí vzniknout — z HERNÍCH DAT, ne ze seznamu v testu. */
function realGoals() {
  const out = [];
  for (const mat in G.MATERIALS) out.push({ kind: 'stock', params: { material: mat, qty: 30 } });
  for (const sid in G.SKILLS) out.push({ kind: 'train', params: { skill: sid, level: 5, minUnits: 2 } });
  for (const eid in G.EXPEDITIONS) {
    for (const party of [G.EXPEDITION_MIN_PARTY, G.EXPEDITION_MAX_PARTY]) {
      out.push({ kind: 'campaign', params: { expeditionId: eid, minPartySize: party } });
    }
  }
  for (const sid in G.WORLD.settlements) {
    out.push({ kind: 'explore', params: { settlementIds: [sid] } });
  }
  out.push({ kind: 'explore', params: { minVisits: 3 } });
  out.push({ kind: 'prestige', params: { renown: 100 } });
  return out;
}

let plannedGoals = 0, plannedSteps = 0, unsatisfiable = [], emptyPlans = [];
for (const spec of realGoals()) {
  const goal = G.newGoal(spec.kind, spec.params, { silent: true });
  if (!goal) { unsatisfiable.push(spec.kind + '(' + JSON.stringify(spec.params) + ') = nevznikl vůbec'); continue; }
  const plan = G.planGoal(goal);
  plannedGoals++;
  if (!plan.length) { emptyPlans.push(spec.kind + ' ' + JSON.stringify(spec.params)); continue; }
  for (const s of plan) {
    plannedSteps++;
    const sat = s.satisfiedBy || [];
    if (!sat.length || !sat.some(resolves)) {
      unsatisfiable.push(goal.kind + '/' + goal.id + '.' + s.id + ' (' + s.kind + ' ' + (s.what || '') + ') → [' +
        sat.map(x => x.type + ':' + x.id).join(', ') + ']');
    }
  }
  G.cancelGoal(goal.id);
}

console.log('  ..prošlo ' + plannedGoals + ' záměrů, ' + plannedSteps + ' kroků ' +
  '(' + realGoals().length + ' záměrů ze herních dat)');

check('K1: prošly VŠECHNY záměry ze seznamu (prázdný průchod je slepá brána)', () => {
  assert(realGoals().length > 50, 'seznam záměrů je podezřele malý: ' + realGoals().length);
  assert(plannedGoals === realGoals().length, 'naplánovalo se jen ' + plannedGoals + ' z ' + realGoals().length);
  assert(plannedSteps > plannedGoals, 'kroků nebylo víc než záměrů (' + plannedSteps + ' ≤ ' + plannedGoals + ')');
});
check('K1: žádný záměr nemá prázdný plán', () => {
  assert(!emptyPlans.length, 'prázdný plán má: ' + emptyPlans.slice(0, 5).join(' | '));
});
check('K1: každý krok je splnitelný existující aktivitou, receptem, stavbou nebo API', () => {
  assert(!unsatisfiable.length, 'nesplnitelné kroky (' + unsatisfiable.length + '):\n      ' +
    unsatisfiable.slice(0, 10).join('\n      '));
});
check('K1: krok „material" má cestu získání, ne jen existující název', () => {
  // Totéž co první kontrola, ale z druhé strany: kdyby materialWork i
  // materialSource vracely 0 pro všechno, brána by zelenala naslepo. Proto
  // se počítají OBE cesty a tvrdí se, že jsou obě použité.
  let work = 0, source = 0, total = 0;
  for (const mat in G.MATERIALS) {
    total++;
    if (G.materialWork(mat) > 0) work++;
    if (G.materialSource(mat).length > 0) source++;
  }
  console.log('     materiálů vyrobitelných prací: ' + work + '/' + total +
              ', získatelných jinak: ' + source + '/' + total);
  assert(work > 0, 'žádný materiál nelze vyrobit — brána by zelenala naslepo');
  assert(source > 0, 'žádný materiál nelze získat jinak než prací — zase by zelenalo naslepo');
  assert(work + source > total, 'některý materiál nemá cestu získání vůbec (' + (work + source) + '/' + total + ')');
});

console.log('');
if (failed === 0) { console.log('VYSLEDEK: OK — koherence drzi'); process.exit(0); }
else { console.log('VYSLEDEK: ' + failed + ' chyb'); process.exit(1); }