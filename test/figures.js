// figures.js — ověří sjednocený model postavy (js/render/art.js).
//
// Použití:  node test/figures.js
// Exit 0 = OK, exit 1 = chyba.
//
// Koncept od uživatele: všichni na JEDNOM základním modelu, roli nese ERB
// kreslený v kódu, na modelu je jen zbroj/oblečení a **žádná zbraň**.
// Ověřuje se plán kresby (`G.figurePlan` je čistá funkce bez canvasu):
//   1) silueta (výška) je pro všechny role/profese stejná — „jeden model",
//   2) erb má barvu role, a když role není, barvu profese; bez obojího se
//      nekreslí,
//   3) ve sjednoceném vzhledu není zbraň, v klasickém je,
//   4) materiál zbroje dává tón trupu a liší se podle profese,
//   5) plán je deterministický a kreslení projde pro všechny kombinace.

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

// ---------- minimální svět pro art.js ----------
global.window = { Game: {} };
global.document = { createElement: () => ({ getContext: () => ({}) }) };
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js/render/art.js'), 'utf8'),
  { filename: 'art.js' });
const G = global.window.Game;

// data, která má art.js jen číst (v prohlížeči je plní jiné moduly)
G.ROLES = {
  leader:  { id:'leader',  color:'#d8b45a' },
  quarter: { id:'quarter', color:'#c2a06a' },
  medic:   { id:'medic',   color:'#7fc4a8' },
  scout:   { id:'scout',   color:'#7aa8e0' },
  fighter: { id:'fighter', color:'#c05a45' },
  trader:  { id:'trader',  color:'#b58fd0' }
};
G.PROFESSIONS = {
  woodcutter: { id:'woodcutter', color:'#8fbf7a' },
  smith:      { id:'smith',      color:'#e0bb5e' },
  merchant:   { id:'merchant',   color:'#7aa8e0' },
  adventurer: { id:'adventurer', color:'#b3a4e8' }
};
G.professionOf = (u) => G.PROFESSIONS[u.profession] || G.PROFESSIONS.adventurer;
G.state = { settings: {} };

function unit(over) {
  return Object.assign({ id:'u1', color:'#8c4a3a', profession:'woodcutter',
                         role:null, gear:{}, facing:1 }, over || {});
}

check('modul nabizi plán i přepínač vzhledu', () => {
  assert(typeof G.figurePlan === 'function', 'chybí G.figurePlan');
  assert(typeof G.figureStyle === 'function', 'chybí G.figureStyle');
  assert(typeof G.setFigureStyle === 'function', 'chybí G.setFigureStyle');
  assert(G.figureStyle() === 'unified', 'výchozí vzhled nemá být sjednocený: ' + G.figureStyle());
});

check('silueta je pro vsechny stejna (jeden model)', () => {
  const heights = new Set();
  for (const role of [null, 'leader', 'medic', 'fighter']) {
    for (const prof of ['woodcutter', 'smith', 'merchant', 'adventurer']) {
      const p = G.figurePlan(unit({ role: role, profession: prof }));
      heights.add(p.height);
    }
  }
  assert(heights.size === 1, 'různé výšky modelu: ' + [...heights].join(', '));
  assert([...heights][0] === 24.5, 'výška modelu se změnila: ' + [...heights][0]);
});

check('erb nese barvu role, jinak profese', () => {
  const p = G.figurePlan(unit({ role: 'medic' }));
  assert(p.heraldry.show, 'erb se nemá kreslit');
  assert(p.heraldry.color === G.ROLES.medic.color, 'erb nemá barvu role: ' + p.heraldry.color);
  const q = G.figurePlan(unit({ role: null, profession: 'smith' }));
  assert(q.heraldry.color === G.PROFESSIONS.smith.color, 'erb nemá barvu profese: ' + q.heraldry.color);
});

check('kazda role ma vlastni heraldiku', () => {
  const seen = new Set();
  for (const role of Object.keys(G.ROLES)) {
    const h = G.figurePlan(unit({ role: role })).heraldry;
    seen.add(h.division + ':' + h.charge);
  }
  assert(seen.size === Object.keys(G.ROLES).length,
    'role se v heraldice opakují (' + seen.size + ' z ' + Object.keys(G.ROLES).length + ')');
});

check('sjednoceny vzhled nema zbran, klasicky ano', () => {
  G.setFigureStyle('unified');
  assert(G.figurePlan(unit({ gear:{ weapon:'axe' } })).weapon === null,
    'sjednocený model nemá mít zbraň');
  G.setFigureStyle('classic');
  assert(G.figurePlan(unit({ gear:{ weapon:'sword' } })).weapon === 'sword',
    'klasický vzhled má zbraň vrátit');
  G.setFigureStyle('unified');
});

check('zbroj dava ton trupu a lisi se podle profese', () => {
  const cloth = G.figurePlan(unit({ profession: 'merchant' }));
  const leather = G.figurePlan(unit({ profession: 'woodcutter' }));
  const mail = G.figurePlan(unit({ profession: 'adventurer' }));
  assert(cloth.armor === 'cloth' && cloth.armorColor === null, 'kupec má být v látce');
  assert(leather.armor === 'leather' && leather.armorColor, 'dřevorubec má mít koženou zbroj');
  assert(mail.armor === 'mail' && mail.armorColor, 'dobrodruh má mít kroužkovou zbroj');
  assert(leather.armorColor !== mail.armorColor, 'materiály mají mít různé barvy');
  // přilba posune materiál o stupeň výš
  const helm = G.figurePlan(unit({ profession: 'woodcutter', gear:{ helm:true } }));
  assert(helm.armor === 'mail', 'přilba nemá posunout materiál: ' + helm.armor);
});

check('plan je deterministicky', () => {
  const u = unit({ role:'scout', profession:'smith', gear:{ helm:true, weapon:'bow' } });
  const a = JSON.stringify(G.figurePlan(u));
  for (let i = 0; i < 5; i++) assert(JSON.stringify(G.figurePlan(u)) === a, 'plán není deterministický');
});

function recCtx() {
  const colors = new Set();
  const base = { globalAlpha:1, fillStyle:'', strokeStyle:'', lineWidth:1, lineJoin:'', lineCap:'' };
  const ctx = new Proxy(base, {
    get(t, p) {
      if (p in t) return t[p];
      return function () {};
    },
    set(t, p, v) {
      if (p === 'fillStyle' || p === 'strokeStyle') colors.add(v);
      t[p] = v; return true;
    }
  });
  return { ctx: ctx, colors: colors };
}

check('sjednoceny model opravdu kresli erb (a ne zbran)', () => {
  G.setFigureStyle('unified');
  const r = recCtx();
  G.drawFigure(r.ctx, unit({ role:'fighter' }), 100, 100, 1.06);
  assert(r.colors.has(G.ROLES.fighter.color), 'erb role se nevykreslil (chybí jeho barva)');
  assert(!r.colors.has('#8a7550'), 've sjednoceném vzhledu se kreslí zbraň (dřevo)');
  assert(!r.colors.has('#9a958c') && !r.colors.has('#a8a49b'),
    've sjednoceném vzhledu se kreslí čepel');
});

check('klasicky model kresli zbran', () => {
  G.setFigureStyle('classic');
  const r = recCtx();
  G.drawFigure(r.ctx, unit({ role:'fighter', gear:{ weapon:'axe' } }), 100, 100, 1.06);
  assert(r.colors.has('#8a7550'), 'klasický vzhled nemá dřevo zbraně');
  assert(r.colors.has('#9a958c'), 'klasický vzhled nemá čepel sekery');
  G.setFigureStyle('unified');
});

check('klasicky model erb nekresli (je to puvodni figura)', () => {
  const u = unit({ role:'fighter', gear:{ weapon:'axe' } });
  G.setFigureStyle('classic');
  const rc = recCtx();
  G.drawFigure(rc.ctx, u, 100, 100, 1.06);
  assert(!rc.colors.has(G.ROLES.fighter.color), 'klasický vzhled nemá kreslit erb role');
  G.setFigureStyle('unified');
  const ru = recCtx();
  G.drawFigure(ru.ctx, u, 100, 100, 1.06);
  assert(ru.colors.has(G.ROLES.fighter.color), 'sjednocený vzhled má erb role kreslit');
});

check('kresleni projde pro vsechny role, profese a vzhledy', () => {
  for (const style of ['unified', 'classic']) {
    G.setFigureStyle(style);
    for (const role of [null].concat(Object.keys(G.ROLES))) {
      for (const prof of Object.keys(G.PROFESSIONS)) {
        for (const gear of [{}, { helm:true, weapon:'sword', shield:true }]) {
          const r = recCtx();
          G.drawFigure(r.ctx, unit({ role:role, profession:prof, gear:gear }), 10, 20, 1);
        }
      }
    }
  }
  G.setFigureStyle('unified');
});

check('postava bez role dostane erb v barve profese', () => {
  // profese se vždycky najde (fallback adventurer), takže erb má vždy co kreslit
  const p = G.figurePlan(unit({ role:'neexistuje', profession:'nesmysl' }));
  assert(p.heraldry.color, 'erb musí mít fallback barvu');
  assert(p.heraldry.show, 'erb se má kreslit i bez role (barva profese)');
});

console.log('');
if (failed) {
  console.log('VYSLEDEK: CHYBA — ' + failed + ' testu selhalo');
  process.exit(1);
}
console.log('VYSLEDEK: OK — postavy mají jeden model a erb role');
