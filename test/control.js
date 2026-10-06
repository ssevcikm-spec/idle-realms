// control.js — brána Fáze C: vedení viditelné hráči (docs/PROMPT_IDLE_REALM.md §4).
//
// Použití:  node test/control.js
// Exit 0 = OK, exit 1 = chyba.
//
// Co hlídá:
//   A4 / C3  hráč si bere postavu na sebe — přes API, ne přímou mutací UI.
//             Vzetí kontroly ji vyřadí z ROZDĚLOVÁNÍ, ale rozestavěnou práci
//             nepřepne (postava dokončí, co dělá).
//   A2 / C2  každé automatické přiřazení má uložené rozpadové váhy a součin
//             těch vah JE váha, podle které rozdělovac rozhodl.
//   K5 / C4  UI nemutuje `state` mimo `G.*` API.
//
// ⚠ BRÁNA, KDE JE SNADNÉ MLČET — dvě místa, obě tady otevřeně:
//
//   1) „Postava je vyřazená z rozdělování" se dá prokázat dvěma různými
//      testy: na PŘEDIKÁTU (`G.unitAutoEligible`) a na CHOVÁNÍ (rozdělovac
//      jí po kolo nepřidělí úkol). Predikát je levnější, ale sám o sobě nic
//      neříká — klidně může být ve stavu, kterého rozdělovac vůbec nepoužívá.
//      Tady se proto volají OBA, a test, který má postavu vyřadit, nejprve
//      prokáže, že ta samá scénéra umí úkol UDĚLIT. Bez toho by „nepřišel
//      úkol" znamenalo cokoliv — včetně toho, že scénéra nefunguje.
//
//   2) Statická kontrola K5 hledá přímé mutace v `ui.js`. Musí číst KÓD, ne
//      komentáře — jinak by popisek, který tu vadu popisuje, bránu uspokojil.
//      A opačně: hledá-li vzor v celém souboru, najde ho i v komentáři, který
//      vadu popisuje, a brána pak projde i s vrácenou vadou. Proto se komentáře
//      MAŽOU a vzor se hledá v tom, co zůstane.

const fs = require('fs');
const path = require('path');
const { boot, makeRunner, ROOT } = require('./_boot.js');

const run = makeRunner('brána vedení (C2 rozpad vah, C3 kontrola, C4 čisté UI)');
const { check, assert } = run;

/* ---------- nástroj: kód bez komentářů ---------- */

/**
 * Vyhodí řádkové i blokové komentáře, ale NE zasáhne do řetězců (např. `//`
 * v URL by bez toho zkrátila řádek). Řetězce přeskočí, takže i `'a//b'` zůstane.
 * Regex by tu byl chybný — spadl by na `https://` v řetězci.
 */
function stripComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; out += c; i++;
      while (i < n) {
        if (src[i] === '\\') { out += src.slice(i, i + 2); i += 2; continue; }
        out += src[i];
        if (src[i] === q) { i++; break; }
        i++;
      }
      continue;
    }
    out += c; i++;
  }
  return out;
}

/* ---------- postava, která je schopná práce ---------- */

const { G } = boot();

/** První dospělá, živá, neexpedující postava. */
function worker() {
  const u = G.state.units.find(x => x && !x.dead && !x.isChild && !x.onExpedition);
  if (!u) throw new Error('v nové hře není žádná dospělá postava — scénéra by nič neprověřila');
  return u;
}

/** Otevře postavu pro rozdělování: doma, svobodná, netěšná. */
function makeAssignable(u) {
  u.assignedTaskId = null;
  u.resting = false;
  u.dead = false; u.isChild = false; u.onExpedition = false;
  u.manual = false;
  u._refuseUntil = 0;
  u.merchantState = null;
  u.injuries = [];
  u.stamina = u.maxStamina;
  return u;
}

/** Rozdělovac na jeden cyklus (`tickAutonomy` bere 2 s). */
function distribTick() {
  G.tickAutonomy(3);
}

console.log('hra se spustila, postav: ' + G.state.units.length);

/* ================= C3 — vzití kontroly ================= */

check('C3: rozdělovac je zapnutý — scénéra umí postavu zaměstnat (jinak by „nepřišel úkol" nic neznamenalo)', () => {
  const u = makeAssignable(worker());
  distribTick();
  assert(u.assignedTaskId, 'postava, která je volná a schopná, nedostala po jednom cyklu žádný úkol — scénéra nic neměří');
});

check('C3: takeControl ji vyřadí z rozdělování (predikát)', () => {
  const u = makeAssignable(worker());
  assert(G.unitAutoEligible(u), 'předpoklad: volná postava je do rozdělování způsobilá');
  const res = G.takeControl(u.id);
  assert(res && res.ok, 'takeControl skončil: ' + (res && res.reason));
  assert(G.hasManualControl(u), 'hasManualControl nevidí právě vzdanou kontrolu');
  assert(!G.unitAutoEligible(u), 'postava pod manuální kontrolou je pořád v rozdělování — A4 porušena');
});

check('C3: takeControl ji vyřadí z rozdělování (chování — rozdělovac jí úkol nepřidělí)', () => {
  const u = makeAssignable(worker());
  G.takeControl(u.id);
  distribTick();
  assert(!u.assignedTaskId, 'postava pod manuální kontrolou dostala úkol: ' + u.assignedTaskId);
});

check('C3: ROZESTAVĚNÁ PRÁCE SE NEPŘEPNE (A4)', () => {
  const u = makeAssignable(worker());
  distribTick();
  assert(u.assignedTaskId, 'předpoklad: postava má na čem pracovat');
  const taskId = u.assignedTaskId;
  const res = G.takeControl(u.id);
  assert(res && res.ok, 'takeControl selhal: ' + (res && res.reason));
  assert(u.assignedTaskId === taskId,
    'vzetí kontroly přepsalo rozestavěnou práci (' + taskId + ' -> ' + u.assignedTaskId + ')');
  assert(G.state.tasks.some(t => t.id === taskId), 'úkol zmizel ze `state.tasks` — práce byla zrušena, ne jen opuštěna');
});

check('C3: releaseControl ji vrátí do rozdělování', () => {
  const u = makeAssignable(worker());
  G.takeControl(u.id);
  assert(!G.unitAutoEligible(u), 'předpoklad: pod kontrolou není způsobilá');
  const res = G.releaseControl(u.id);
  assert(res && res.ok, 'releaseControl skončil: ' + (res && res.reason));
  assert(!G.hasManualControl(u), 'po puštění je postava stále pod manuální kontrolou');
  assert(G.unitAutoEligible(u), 'po puštění je postava stále vyřazená z rozdělování');
});

check('C3: vzetí kontroly dvakrát neudělá nic druhýkrát (idempotence)', () => {
  const u = makeAssignable(worker());
  assert(G.takeControl(u.id).ok, 'první vzití kontroly selhalo');
  const second = G.takeControl(u.id);
  assert(second && !second.ok, 'druhé vzití kontroly se tváří jako úspěch — chybí hlídka duplicity');
});

check('C3: neznámá postava neprojde tiše', () => {
  const res = G.takeControl('u-neexistuje');
  assert(res && res.ok === false && res.reason, 'takeControl neznámé postavy neřekl, proč nešlo');
});

/* ================= C4 — UI nemutuje stav mimo API ================= */

check('C4: recruitUnit je jedna operace — zlata se odečte o ceně a přibude jedna postava', () => {
  const before = G.state.units.length;
  const cost = G.recruitCost();
  G.state.resources.gold = cost + 1000;
  const res = G.recruitUnit();
  assert(res && res.ok, 'recruitUnit selhal: ' + (res && res.reason));
  assert(G.state.units.length === before + 1,
    'přibylo ' + (G.state.units.length - before) + ' postav, ne 1');
  assert(res.unit && G.state.units.indexOf(res.unit) !== -1,
    'vrácená postava není ve `state.units` — API si ji drží jen u sebe');
  assert(G.state.resources.gold === 1000,
    'zůstalo ' + G.state.resources.gold + ' zlata, má být 1000 (cena ' + cost + ' z 1100)');
});

check('C4: bez zlata se nenajme NIC (chrání peníze)', () => {
  const before = G.state.units.length;
  G.state.resources.gold = 0;
  const res = G.recruitUnit();
  assert(res && res.ok === false, 'najetí bez zlata skončilo úspěchem');
  assert(G.state.units.length === before, 'postava přibyla i bez zlata');
  assert(G.state.resources.gold === 0, 'zlata ubylo, i když se nenajmulo');
});

check('C4: ui.js nemutuje `state` mimo API (K5, čteno z kódu bez komentářů)', () => {
  const src = stripComments(fs.readFileSync(path.join(ROOT, 'js/ui/ui.js'), 'utf8'));
  // Přímé zápisy, které C4 měl odstranit. Každý je tam s odkazem na API,
  // které ho nyní nahrazuje.
  const zakaz = [
    { re: /\.manual\s*=\s*!/, why: 'přímé přepnutí `manual` (má být G.toggleControl)' },
    { re: /G\.state\.resources\.gold\s*[-+]?=/, why: 'přímý zápis do `resources.gold` (má být G.recruitUnit)' },
    { re: /G\.state\.units\.push\(/, why: 'přímé strčení postavy do `state.units` (má být G.recruitUnit)' },
    { re: /G\.state\.selected\s*=/, why: 'přímý zápis výběru (má být G.selectTarget)' }
  ];
  const nalezeno = [];
  zakaz.forEach(z => {
    // řádek s nálezem se vypíše — „něco to našlo" a „něco to našlo správně"
    // jsou dvě různé věty a tady je snadné je zaměnit
    const m = z.re.exec(src);
    if (!m) return;
    const radek = src.slice(0, m.index).split('\n').length;
    nalezeno.push(z.why + ' (ui.js:' + radek + ')');
  });
  assert(nalezeno.length === 0,
    'ui.js stále mutuje stav přímo: ' + nalezeno.join(' | '));
});

check('K5: vzor v kontrolovaném souboru umí být i v komentáři (brána neumří jen kód)', () => {
  // FIXTURA SAMY PRO SEBE: kdyby `stripComments` nefungovala, tento test by
  // padl. Bez něj je kontrola výše slepá právě v této chvíli.
  const zdravy = 'var a = 1; // G.state.resources.gold -= cost\nvar b = 2;';
  const bezKomentu = stripComments(zdravy);
  assert(!/\.gold\s*[-+]?=/.test(bezKomentu),
    'kód bez komentářů stále obsahuje zápis, který byl jen v komentáři — stripComments nefunguje');
  const opravduKod = 'var a = 1;\nG.state.resources.gold -= cost;';
  assert(/\.gold\s*[-+]?=/.test(stripComments(opravduKod)),
    'stripComments smazal i skutečný kód — brána by mlčela i nad vrácenou vadou');
});

/* ================= C2 — rozpad vah u postavy (garance A2) ================= */

check('C2: automatické přiřazení si nese rozpadové váhy', () => {
  const u = makeAssignable(worker());
  distribTick();
  assert(u.assignedTaskId, 'postava nedostala úkol — rozpad vah není co ověřovat');
  const t = G.state.tasks.find(x => x.id === u.assignedTaskId);
  assert(t && t.auto, 'úrok nebyl automatický — pak nemá rozklad vah (ruční příkaz hráče váhy nemá)');
  assert(Array.isArray(t.weights) && t.weights.length > 0,
    'automatický úkol nemá uložené váhy (A2 porušena): ' + JSON.stringify(t.weights));
});

check('C2: součin rozkladu JE váha, podle které se rozhodlo (ne „vypadá to podobně")', () => {
  const r = pickWithGoal();
  assert(r.pick, 'přes ' + r.zkouseli + ' kandidátů nemá žádný faktor `goal` — kontrola by mlčela');
  // ⚠ SOUČIN SE POČÍTÁ ZDE, NE PŘES `G.weightsTotal`. První verze té kontroly
  // volala `G.weightsTotal(t.weights)` a porovnávala to s `t.weight` — jenže
  // `t.weight` SÁ vzniká jako `G.weightsTotal(f)`. Obě strany tedy počítal
  // stejný kód a musely se shodovat, i když byl rozklad špatně. Naměřeno
  // 5. 10. 2026: mutace, která při součinu vynechala faktor `goal`, prošla
  // touto kontrolou a chytila ji až jiná. Měřidlo nesmí být to, co měří.
  let soucin = 1;
  for (const f of r.pick.factors) soucin *= f.value;
  assert(soucin === r.pick.w,
    'součin rozkladu ' + soucin + ' se liší od váhy ' + r.pick.w +
    ' — UI by ukázalo jiné číslo, než podle čeho se rozhodlo');
  console.log('     (kandidát z ' + r.zkouseli + ' pokusů, ' + r.pick.factors.length + ' faktorů)');
});

check('C2: G.weightsTotal není jen jiná věta pro stejný součet', () => {
  // Druhá polovina téže pasti: i když test součin počítá sám, UI používá
  // `G.weightsTotal`. Kdyby se ta funkce rozešla s tím, co ukazuje rozklad,
  // hráč by na panelu viděl číslo jiné, než podle čeho se postava rozhodla.
  const r = pickWithGoal();
  assert(r.pick, 'nepodařilo se najít kandidáta s faktorem `goal`');
  let soucin = 1;
  for (const f of r.pick.factors) soucin *= f.value;
  assert(G.weightsTotal(r.pick.factors) === soucin,
    'G.weightsTotal dává ' + G.weightsTotal(r.pick.factors) + ', součin rozkladu je ' + soucin);
  assert(G.weightsTotal([]) === 1, 'prázdný rozklad nemá být ×1 — to by znamenalo „nic nevím"');
});

check('C2: každý faktor má smyslový údaj a kladnou hodnotu', () => {
  const u = makeAssignable(worker());
  distribTick();
  const t = G.state.tasks.find(x => x.id === u.assignedTaskId);
  assert(t && t.weights, 'předpoklad: úkol má rozklad vah');
  for (const f of t.weights) {
    assert(f && typeof f.id === 'string' && f.id, 'faktor bez `id`: ' + JSON.stringify(f));
    assert(typeof f.text === 'string' && f.text.length > 0,
      'faktor `' + f.id + '` nemá popisek — hráč by viděl ×2,2 bez věty, co to je');
    assert(typeof f.value === 'number' && isFinite(f.value) && f.value > 0,
      'faktor `' + f.id + '` má nekladnou/nečíselnou váhu: ' + f.value);
  }
  // PATRO: rozklad musí obsahovat ZÁKLAD, ne jen to, co se zrovna uplatnilo.
  // Bez toho by prázdný seznam (0 faktorů) prošel jako „váhy jsou v pořádku".
  const ids = t.weights.map(f => f.id);
  assert(ids.indexOf('skill') !== -1, 'v rozkladu není dovednost — bez ní se nedá odhadnout, proč si vybralo tuhle práci');
  assert(ids.indexOf('dist') !== -1, 'v rozkladu není vzdálenost');
});

/**
 * Kandidát rozdělování, jehož rozklad OPRAVDU obsahuje tlak záměru.
 *
 * Proč to není „vyberme postavu a doufejme": první verze té kontroly nechala
 * rozdělovat naslepo a pak předpokládala, že postava zvolí právě aktivitu, kterou
 * záměr žádá. Nezvolila — výběr je náhodný, takže kontrola buď mlčela, nebo padla
 * podle toho, kdo ji předtím spustil. Tady se záměr zkusí u každé suroviny a u
 * každé postavy, dokud nějaký kandidát faktor `goal` OPRAVDU má.
 */
function pickWithGoal() {
  let zkouseli = 0;
  for (const mat of Object.keys(G.MATERIALS)) {
    for (const u of G.state.units) {
      if (u.dead || u.isChild || u.onExpedition) continue;
      makeAssignable(u);
      const goal = G.newGoal('stock', { material: mat, qty: 999 }, { priority: 90 });
      G.tickGoals();
      const pick = G.pickActivity(u, G.listActiveSteps());
      G.cancelGoal(goal.id, 'brána');
      zkouseli++;
      if (pick && pick.factors.some(f => f.id === 'goal')) return { pick: pick, zkouseli: zkouseli };
    }
  }
  return { pick: null, zkouseli: zkouseli };
}

check('C2: rozklad reaguje na záměr — tlak záměru je v něm vidět (ne dekorace)', () => {
  const r = pickWithGoal();
  assert(r.pick, 'přes ' + r.zkouseli + ' kandidátů se nevyskytl ANI JEDEN faktor `goal` — kontrola by mlčela');
  const g = r.pick.factors.filter(f => f.id === 'goal');
  assert(g.length === 1, 'v rozkladu je ' + g.length + ' faktorů `goal`, ne 1');
  assert(g[0].value > 1, 'faktor `goal` je ' + g[0].value + ' — záměr práci nezvýhodnil, ačkoli by měl');
  assert(/mezera/.test(g[0].text), 'faktor `goal` nemá popisek o mezeře: ' + g[0].text);
});

check('C2: bez záměru tlak v rozkladu chybí (jinak by byl faktor `goal` jen šum)', () => {
  const u = makeAssignable(worker());
  const pick = G.pickActivity(u, []);
  assert(pick, 'bez záměru rozdělovac nic nevrací — předpoklad selhal');
  assert(pick.factors.every(f => f.id !== 'goal'),
    'v rozkladu je faktor `goal`, ale žádný záměr neexistuje: ' +
    JSON.stringify(pick.factors.filter(f => f.id === 'goal')));
});

check('C2: ruční příkaz hráče si váhy nevymýšlí', () => {
  // Kdyby `startTask` přiřadil prázdný rozklad všemu, „váhy jsou uložené" by
  // platilo i tam, kde o výběru rozhodl člověk, a UI by kreslilo prázdniny.
  const u = makeAssignable(worker());
  const node = G.WORLD.nodes[0];
  const t = G.startTask(Object.keys(G.ACTIVITIES)[0], [u.id], { nodeId: node.id, auto: false });
  assert(t, 'ruční úkol nevznikl — předpoklad selhal');
  assert(!t.weights, 'ručnímu příkazu hráče byly přiděleny rozpadové váhy, o kterých nikdo nerozhodoval');
});

/* ================= C5 — zápis splněného kroku do deníku postavy ================= */

check('C5: splnění kroku záměru se zapíše do deníku postavy a je vidět v záznamu', () => {
  const u = makeAssignable(worker());
  const initialJournals = (u.journal || []).length;
  // Vytvoříme záměr na materiál, kterého je zatím nedostatek
  const goal = G.newGoal('stock', { material: 'wood', qty: 50 }, { silent: true });
  assert(goal && goal.plan && goal.plan.length > 0, 'záměr nevytvořil plán');
  const step = goal.plan[0];
  assert(!step.done, 'krok by neměl být hotový hned');
  
  // Přidáme surovinu, která krok splní
  G.matAdd('wood', 100);
  G.tickGoals();
  assert(step.done, 'krok se měl označit za splněný');
  assert(step.completed, 'krok se měl označit jako completed');

  // Ověříme záznam v deníku některé z postav
  const allJournals = [];
  for (const unit of G.state.units) {
    for (const j of (unit.journal || [])) {
      if (j.msg && j.msg.includes('Splněn krok záměru')) {
        allJournals.push({ unit, j });
      }
    }
  }
  assert(allJournals.length > 0, 'žádná postava nemá v deníku záznam o splnění kroku záměru');
  const record = allJournals[0];
  assert(record.j.icon === '🎯', 'záznam v deníku nemá správnou ikonu 🎯: ' + record.j.icon);
  assert(record.j.msg.includes(step.label || 'dřevo'), 'záznam v deníku neobsahuje název kroku');

  // Úklid
  G.cancelGoal(goal.id, 'test C5');
});

check('C5: opakované přeměření (tickGoals) nezapíše tentýž splněný krok znovu (žádný spam)', () => {
  const countBefore = G.state.units.reduce((acc, u) => acc + (u.journal || []).filter(j => j.msg && j.msg.includes('Splněn krok záměru')).length, 0);
  G.tickGoals();
  G.tickGoals();
  const countAfter = G.state.units.reduce((acc, u) => acc + (u.journal || []).filter(j => j.msg && j.msg.includes('Splněn krok záměru')).length, 0);
  assert(countBefore === countAfter, 'do deníku přibyly duplicitní záznamy téhož kroku (' + countBefore + ' -> ' + countAfter + ')');
});

run.finish('postavy v nové hře: ' + G.state.units.length + ', vzory K5: 4');