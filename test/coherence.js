// coherence.js — brána koherence herní architektury (docs/ARCHITEKTURA_PREMISA §4).
//
// Použití:  node test/coherence.js
// Exit 0 = OK, exit 1 = chyba.
//
// Proč existuje: `headless-smoke` dokazuje, že hra BĚŽÍ, a `check-globals`,
// že kód je čistý. Tady jde o vlastnosti, které nejde rozbít tichým merge-em:
//
//   K1  každý krok záměru je splnitelný existující aktivitou, receptem,
//       stavbou nebo API — mrtvý záměr je chyba, ne „vlastnost hry".
//   K3  offline běh dělá stejnou hru jako živý běh (parita).
//
// ⚠ BRÁNA, KDE JE SNADNÉ MLČET: cyklus přes záměry, které umí vzniknout, když
// je seznam prázdný, je zelený aniž by cokoli změřil. Proto se tady POČÍTÁ,
// kolik záměrů a kroků se prošlo, a počty jsou součástí tvrzení.
// Záměry se NEPIŠOU ručně — berou se z herních dat (expedice, materiály,
// dovednosti, sídla), takže test vyhovuje i záměru, který vznikne až za rok.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const SEED = 20260910;
const TICK = 0.1;                 // musí být stejný jako v js/core/loop.js
const PARITY_SECONDS = 3600;      // 1 h
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

/** Čistá kopie hry: nové vm kontexty, nové stuby, nový `window.Game`. */
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
    performance: { now: () => Date.now() }, navigator: { userAgent: 'node-coherence' },
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
  return G;
}

let failed = 0;
function check(name, fn) {
  try { fn(); console.log('  OK   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + ' :: ' + e.message); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assert selhal'); }

/** Kolik procent se dvě hodnoty liší (0, když jsou stejné). */
function relDiff(a, b) {
  if (a === b) return 0;
  if (!a) return 100;
  return Math.abs((b - a) / a) * 100;
}

console.log('=== Idle Realm — brána koherence (K1 dosažitelnost, K3 parita) ===');
const G = boot();
check('hra se spustila (bez stavu nema co merit)', () => assert(!!G.state && !!G.WORLD));

/* ================= K1: je krok splnitelný existující věcí ve hře? ========== */

/** Umí hra tenhle způsob splnění? */
function resolves(sat) {
  switch (sat.type) {
    case 'material':
      // ne jen „materiál existuje", ale „umí se získat": vyrobit prací
      // (aktivita/recept) NEBO získat lovem, obchodem, expedicí, stavbou
      return !!G.MATERIALS[sat.id] && (G.materialWork(sat.id) > 0 || G.materialSource(sat.id).length > 0);
    case 'skill': {
      // „Dovednost existuje" nestačí: šest dovedností nemá sběrnou aktivitu
      // (kovářství, alchymie, kuchařství, řemeslo, obchod, boj). Plánovač proto
      // vypisuje konkrétní ZDROJE, které se dají ověřit proti kódu.
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

let plannedGoals = 0, plannedSteps = 0;
const unsatisfiable = [], emptyPlans = [];
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

console.log('  ..K1 prošlo ' + plannedGoals + ' záměrů, ' + plannedSteps + ' kroků (' + realGoals().length + ' z herních dat)');

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

/* ===================== K3: offline dělá stejnou hru jako živý běh ========= */

/** Hrubý otisk stavu — hodnoty, u kterých má být shoda. */
function snapshot(game, goal) {
  const mats = {};
  for (const m in game.state.materials) mats[m] = game.matCount(m);
  const skills = game.state.units.map((u) => game.unitSkill(u, 'herbalism')).join(',');
  return {
    time: game.state.time,
    work: game.state.stats.totalWork,
    tasksDone: game.state.stats.tasksDone,
    materials: mats,
    materialTotal: Object.values(mats).reduce((a, b) => a + b, 0),
    skills: skills,
    gap: goal ? Math.round(game.stepGap(goal.plan[0], goal)) : 0
  };
}

/** Běh se záměrem; `simulating` drží režim offline simulace. */
function run(seconds, simulating) {
  const g = boot();
  // Cíl vysoko nad tím, co se za hodinu vyrobí: jinak by mezera dojela na nulu
  // a její porovnání by bylo 0 = 0 — zelená bez jediného měření.
  const goal = g.newGoal('stock', { material: 'fiber', qty: 2000 }, { priority: 70, silent: true });
  g.planGoal(goal);
  g.simulating = !!simulating;
  const n = Math.round(seconds / TICK);
  for (let i = 0; i < n; i++) g.tick(TICK);
  return snapshot(g, goal);
}

/** Totéž, ale přes SKUTEČNÉ API, kterým hra simuluje čas nepřítomnosti. */
function runOfflineApi(seconds) {
  const g = boot();
  const goal = g.newGoal('stock', { material: 'fiber', qty: 2000 }, { priority: 70, silent: true });
  g.planGoal(goal);
  const simulated = g.simulateOffline(seconds);
  const snap = snapshot(g, goal);
  snap.simulated = simulated;
  return snap;
}

const H = PARITY_SECONDS / 3600;
// A a B: STEJNÉ podmínky (`G.simulating` na obou). Porovnává se simulátor se
// simulátorem — to je předmětem K3 a jediná věc, kterou tato fáze opravovala.
// C: živý běh s `G.simulating` vypnutým. Rozdíl A↔C je ZÁMĚRNÝ běh hry:
// při offline simulaci se nespouštějí náhodné události (viz `G.simulating`),
// a ten rozdíl je změřený níže, ne schovaný.
const simRun = run(PARITY_SECONDS, true);
const simRun2 = run(PARITY_SECONDS, true);
const liveRun = run(PARITY_SECONDS, false);
const apiRun = runOfflineApi(PARITY_SECONDS);
const mins = PARITY_SECONDS / 60;
console.log('  ..K3 ' + mins + ' min živý běh:       práce=' + Math.round(liveRun.work) +
  ' úkolů=' + liveRun.tasksDone + ' materiály=' + liveRun.materialTotal + ' mezera=' + liveRun.gap);
console.log('  ..K3 ' + mins + ' min simulace:       práce=' + Math.round(simRun.work) +
  ' úkolů=' + simRun.tasksDone + ' materiály=' + simRun.materialTotal + ' mezera=' + simRun.gap);
console.log('  ..K3 ' + mins + ' min simulateOffline: práce=' + Math.round(apiRun.work) +
  ' úkolů=' + apiRun.tasksDone + ' materiály=' + apiRun.materialTotal + ' mezera=' + apiRun.gap);

check('K3: simulace je sama se sebou shodná (bez toho je srovnání směs náhody)', () => {
  assert(relDiff(simRun.work, simRun2.work) <= 1e-6, 'dva běhy simulace se liší (' +
    simRun.work + ' vs ' + simRun2.work + ') — simulace není deterministická');
});
check('K3: mezera záměru je po hodině pořád nenulová (jinak by se nic neměřilo)', () => {
  assert(simRun.gap > 0 && apiRun.gap > 0, 'mezera došla na nulu — její porovnání by bylo 0 = 0');
});
check('K3: simulateOffline dělá stejnou hru jako tik po 0,1 s', () => {
  // Tahle kontrola hlídá KROK v js/core/loop.js — a musí jít přes skutečné
  // API, ne přes jeho náhradu. První verze této brány tikala po 0,1 s přímo,
  // takže mutace kroku uvnitř simulateOffline jí prošla (exit 0): brála o věci,
  // kterou necílila, a vypadala přitom zelená. Dřív šla offline simulace po
  // sekundě proti desáté sekundě živého běhu — a to byl celý nález.
  assert(apiRun.simulated === PARITY_SECONDS,
    'simulateOffline zpracoval ' + apiRun.simulated + ' s místo ' + PARITY_SECONDS + ' s (strop obtížnosti?)');
  // Tolerance 1e-6 %: práce se sčítá 36 000krát po 0,1 s, takže i při shodném
  // běhu se liší poslední bit. Pod touto hranicí je to plovoucí čárka, ne hra.
  const TOL = 1e-6;
  const dWork = relDiff(simRun.work, apiRun.work);
  const dTasks = relDiff(simRun.tasksDone, apiRun.tasksDone);
  const dMats = relDiff(simRun.materialTotal, apiRun.materialTotal);
  const dGap = relDiff(simRun.gap, apiRun.gap);
  assert(dWork <= TOL && dTasks <= TOL && dMats <= TOL && dGap <= TOL,
    'simulateOffline se liší od tikání po ' + TICK + ' s (práce ' + dWork.toExponential(2) +
    ' %, úkoly ' + dTasks.toExponential(2) + ' %, materiály ' + dMats.toExponential(2) +
    ' %, mezera ' + dGap.toExponential(2) + ' %) — offline běh nedělá stejnou hru');
});
check('K3: rozdíl živého běhu a offline simulace je ZMĚŘENÝ a ohraničený', () => {
  // Známý, záměrný rozdíl: při `G.simulating` se nespouštějí náhodné události
  // (světové děje, postavy, psychika), takže offline svět není úplně stejný
  // jako svět, v němž hráč seděl. Tohle je rozhodnutí hry, ne chyba plánovače —
  // ale NESMÍ to zůstat nezapsané, protože se to tváří jako stejná hra.
  // Když se to má změnit (události během nepřítomnosti), je to věc Fáze C/E.
  const dWork = relDiff(liveRun.work, apiRun.work);
  const dTasks = relDiff(liveRun.tasksDone, apiRun.tasksDone);
  const dMats = relDiff(liveRun.materialTotal, apiRun.materialTotal);
  console.log('     rozdíl po ' + mins + ' min: práce ' + dWork.toFixed(1) + ' %, úkoly ' +
    dTasks.toFixed(1) + ' %, materiály ' + dMats.toFixed(1) + ' % (události se při offline nespouštějí)');
  assert(dWork <= 15, 'rozdíl práce živý/offline je ' + dWork.toFixed(1) +
    ' % — může být události, ne smí být neomezený');
  assert(dMats <= 15, 'rozdíl materiálu živý/offline je ' + dMats.toFixed(1) + ' %');
});

console.log('');
if (failed === 0) { console.log('VYSLEDEK: OK — koherence drzi'); process.exit(0); }
else { console.log('VYSLEDEK: ' + failed + ' chyb'); process.exit(1); }