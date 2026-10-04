// control.js — brána Fáze C3+C4: vedení viditelné hráči (docs/PROMPT_IDLE_REALM.md §4).
//
// Použití:  node test/control.js
// Exit 0 = OK, exit 1 = chyba.
//
// Co hlídá:
//   A4 / C3  hráč si bere postavu na sebe — přes API, ne přímou mutací UI.
//             Vzetí kontroly ji vyřadí z ROZDĚLOVÁNÍ, ale rozestavěnou práci
//             nepřepne (postava dokončí, co dělá).
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

const run = makeRunner('brána vedení (C3 takeControl, C4 čisté UI)');
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

run.finish('postavy v nové hře: ' + G.state.units.length +
  ', vzory K5: 4, celkem kontrol: ' + 11);