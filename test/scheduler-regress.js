// scheduler-regress.js — regresní brána rozdělovace práce (Fáze B4).
//
// Použití:  node test/scheduler-regress.js            # porovná s uloženou referencí
//            node test/scheduler-regress.js --record   # přepíše referenci (po změně, která je míněna)
//
// Proč: Fáze B přepojí rozdělovac na `gap` (mezera do kroku záměru). Největší
// riziko refaktoru NENÍ nová chyba, ale TAJNÁ změna toho, jak si hra vybírá
// práci — a tu neodhalí žádný test na nové funkci. Proto se tu měří SEKVENCE
// volení práce proti uložené referenci zachycené JEŠTĚ PŘED zásahem.
//
// Co se měří: při 40 kolech autonomie, který úkol má která postava.
// Co se NEMĚŘÍ: sklad, zlato, ekonomika — mění se při libovolné balanci a brána
// by kazila na věcech, o kterých tato fáze nerozhoduje.
//
// Scénáře:
//   A  — žádný záměr, žádná směrnice. Výběr práce musí být DNESNÍ.
//   B  — směrnice `focusMaterial` (ta od Fáze A zakládá záměr). Musí být
//        stejný jako A: směrnice si váhu bere sama (×8), jinak by se přičetla
//        dvakrát.
//   C  — ZÁMĚR HRÁČE (bez směrnice). Musí se od A LIŠIT — jinak by kroky
//        zvýhodňovaly práci, ale nikdo by to neviděl. Scénáře A a B dohromady
//        dokazují jen „nic se nerozbilo"; C dokazuje, že nová věc vůbec dělá.
//   A2 — A znovu, pro pořádek. Musí dát stejný otisk jako A.
//
// ⚠ Každý scénář běží ve VLASTNÍM vm kontextu. Hra si totiž drží stav v
// modulech (počítadla, časovače) a `startNewGame` je nenulová — dvě nové hry
// v jednom kontextu nedají stejný běh, takže by srovnání s referencí nedávalo
// smysl (a první verze tohoto testu právě na to narazila).
//
// Referenci nelze updatovat „aby to prošlo" — to je přesně slepá brána.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE = path.join(__dirname, 'fixtures', 'scheduler-baseline.json');
const RECORD = process.argv.indexOf('--record') !== -1;
const FROM = process.argv.slice(2).find((a) => a.indexOf('--') !== 0) || 'nezapsáno';
const ROUNDS = 3000;          // ticků po 0,1 s = 300 s herního času
const SAMPLE = 10;            // záznam každý 1.0 s herního času
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
    performance: { now: () => Date.now() }, navigator: { userAgent: 'node-scheduler-regress' },
    devicePixelRatio: 1, innerWidth: 800, innerHeight: 600,
    location: { href: 'http://localhost/', pathname: '/', search: '' },
    matchMedia: () => ({ matches: false, addEventListener: noop })
  };
  const sandbox = {
    window: win, document: documentStub, localStorage: localStorageStub,
    performance: win.performance, navigator: win.navigator, location: win.location,
    requestAnimationFrame: win.requestAnimationFrame,
    cancelAnimationFrame: win.cancelAnimationFrame,
    // časovače musí být i v kontextu, ne jen na window: hra volá `setInterval`
    // bare (např. js/ui/ui.js). Stub nikdy nepošle zpátky do smyčky.
    setTimeout: win.setTimeout, clearTimeout: win.clearTimeout,
    setInterval: win.setInterval, clearInterval: win.clearInterval,
    Image: function () {}, ResizeObserver: function () { this.observe = noop; this.disconnect = noop; },
    console: console
  };
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const srcs = [...html.matchAll(/src="([^"]+)"/g)].map((m) => m[1]);
  // main.js až na konec a s přepsaným `showTitleScreen` — jinak by se hra
  // sama spustila ještě předtím, než máme jak začít novou (viz headless-smoke).
  for (const s of srcs.filter((s) => s.indexOf('main.js') === -1)) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, s), 'utf8'), ctx, { filename: s });
  }
  const G = win.Game;
  G.setSeed(SEED);
  let newGame = null;
  G.showTitleScreen = (opts) => { newGame = opts.onNewGame; };
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8'), ctx, { filename: 'js/main.js' });
  if (typeof newGame !== 'function') throw new Error('showTitleScreen nezavolalo onNewGame — hra se nespustila');
  newGame('normal');
  return G;
}

let failed = 0;
function check(name, fn) {
  try { fn(); console.log('  OK   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + ' :: ' + e.message); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assert selhal'); }

console.log('=== Idle Realm — regresní brána rozdělovace (Fáze B4) ===');

/** Otisk sekvence (FNV-1a) — krátký a stejný pro stejný běh. */
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return ('00000000' + h.toString(16)).slice(-8);
}

/** Jeden scénář v čistém kontextu: ROUNDS kol autonomie, pak otisk + rozpad aktivit. */
function run(withDirective, playerGoal) {
  const G = boot();
  if (withDirective) {
    // Cíl vysoko nad zásobou, aby směrnice opravdu přepínala váhu (×8).
    // Materiál musí být JEDEN Z TYCH, co tu postavy opravdu sbírají — jinak
    // by B nebylo od A nijak lišené a netestovalo by nic.
    G.setDirective('focusMaterial', 'fiber');
    G.setDirective('focusTarget', 500);
  } else {
    // žádný záměr a žádná směrnice — jinak by směrnice založila záměr sama (Fáze A)
    G.setDirective('focusMaterial', null);
    G.state.goals.length = 0;
  }
  if (playerGoal) G.newGoal('stock', playerGoal, { priority: 80, silent: true });
  const seq = [];
  const hist = {};
  for (let i = 0; i < ROUNDS; i++) {
    // TICK celé hry, ne jen autonomie: `tickAutonomy` sám o sobě nespouští
    // `tickTasks`, takže by postavy zůstaly na prvním úkolu navěky a scénář
    // by měřil jedno rozhodnutí místo chování.
    G.tick(0.1);
    if (i % SAMPLE !== SAMPLE - 1) continue;
    const rows = [];
    for (const u of G.state.units) {
      const t = u.assignedTaskId ? G.state.tasks.find((x) => x.id === u.assignedTaskId) : null;
      const act = t ? t.activityId : '-';
      hist[act] = (hist[act] || 0) + 1;
      rows.push(u.id + '=' + act);
    }
    seq.push(rows.join(','));
  }
  return { hash: hash(seq.join('|')), hist: hist,
    units: G.state.units.map((u) => u.name + '(' + (G.professionOf(u) ? G.professionOf(u).id : '?') +
      ', ' + Math.round(u.pos.x) + ',' + Math.round(u.pos.y) + ')').join(' ') };
}

const A = run(false), B = run(true), A2 = run(false), C = run(false, { material: 'fiber', qty: 500 });
const got = { A: A.hash, B: B.hash, C: C.hash, A2: A2.hash };
function fmt(hist) {
  return Object.keys(hist).sort((a, b) => hist[b] - hist[a])
    .map((k) => k + ':' + hist[k]).join(' ');
}
console.log('  ..scénáře: A=' + got.A + '  B=' + got.B + '  C=' + got.C + '  A2=' + got.A2);
console.log('  ..rozpad činností A: ' + fmt(A.hist));
console.log('  ..rozpad činností B: ' + fmt(B.hist));
console.log('  ..rozpad činností C: ' + fmt(C.hist));
console.log('  ..postavy: ' + A.units);

check('scénář je reprodukovatelný (A2 musí dát stejný otisk jako A)', () => {
  assert(got.A2 === got.A, 'tentýž scénář dvakrát nedal stejný otisk (' + got.A + ' vs ' + got.A2 + ') — srovnání s referencí by nedávalo smysl');
});
check('scénář se něco děje (postavy si vybírají práci)', () => {
  const G = boot();
  G.tickAutonomy(2);
  const busy = G.state.units.filter((u) => u.assignedTaskId).length;
  assert(busy > 0, 'po jednom kole autonomie nikdo nic nedělá — otisk by byl stejný prázdný pokaždé');
});
check('scénář B opravdu přepíná váhu (jinak by netestoval nic)', () => {
  assert(got.B !== got.A, 'scénáře se směrnicí a bez ní daly stejný otisk — buď směrnice nepřepíná váhu (scénář je k ničemu), nebo je všechno jedno');
});
check('záměr hráče opravdu přesouvá práci (jinak je zvýhodňování kroků mrtvý kód)', () => {
  assert(got.C !== got.A, 'záměr hráče nepohnul výběrem práce vůbec — stepBoost je mrtvý kód a testy by to nepoznaly');
  assert((C.hist.gather_fiber || 0) > (A.hist.gather_fiber || 0),
    'záměr na vlákno nezvýšil práci na vlákno (' + (C.hist.gather_fiber || 0) + ' proti ' + (A.hist.gather_fiber || 0) + ')');
});

const base = fs.existsSync(FIXTURE) ? JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) : null;
if (RECORD) {
  if (!fs.existsSync(path.dirname(FIXTURE))) fs.mkdirSync(path.dirname(FIXTURE), { recursive: true });
  fs.writeFileSync(FIXTURE, JSON.stringify({
    recordedFrom: FROM,
    seed: SEED, rounds: ROUNDS,
    A: got.A, B: got.B, C: got.C,
    note: 'Otisk sekvence volení práce. Přepisovat jen změně, která je míněna (viz základní komentář).'
  }, null, 2) + '\n');
  console.log('  ..reference zapsána: ' + FIXTURE);
} else {
  check('bez záměrů je výběr práce stejný jako před Fází B (scénář A)', () => {
    assert(base, 'chybí reference ' + FIXTURE + ' — spusť nejdřív node test/scheduler-regress.js --record');
    assert(got.A === base.A, 'scénář A: ' + got.A + ', reference ' + base.A +
      ' — rozdělovac se chová jinak než před Fází B');
  });
  check('směrnice (scénář B) se nezměnila dvojnásobným započtením záměru', () => {
    assert(base, 'chybí reference ' + FIXTURE);
    assert(got.B === base.B, 'scénář B: ' + got.B + ', reference ' + base.B +
      ' — záměr ze směrnice se přičítá k váze, kterou si směrnice bere už sama');
  });
  check('chování záměru hráče je zaznamenané (scénář C)', () => {
    assert(base, 'chybí reference ' + FIXTURE);
    assert(got.C === base.C, 'scénář C: ' + got.C + ', reference ' + base.C +
      ' — záměr hráče přesouvá práci jinak, než bylo zaznamenané');
  });
}

console.log('');
if (failed === 0) { console.log('VYSLEDEK: OK — rozdělovac neregresoval'); process.exit(0); }
else { console.log('VYSLEDEK: ' + failed + ' chyb'); process.exit(1); }