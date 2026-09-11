// smoke.js — browser smoke test pro Idle Realm
// Načte se PO všech herních skriptech (kromě main.js, který bootuje hru).
// Ověří, že jádro hry (svět, stav, postavy, úkoly, tick, save/load) funguje.
(function () {
  const results = [];
  let passed = 0, failed = 0;

  function assert(name, cond, detail) {
    if (cond) { passed++; results.push('<div class="pass">OK&nbsp;&nbsp; ' + name + '</div>'); }
    else { failed++; results.push('<div class="fail">FAIL ' + name + (detail ? ' — ' + detail : '') + '</div>'); }
  }
  function section(t) { results.push('<h2>' + t + '</h2>'); }

  try {
    const G = window.Game;
    assert('window.Game existuje', !!G);
    if (!G) throw new Error('window.Game chybí');

    // Neutralizuj render funkce, které sahají na DOM (tady není herní UI)
    for (const k in G) {
      if (k.indexOf('render') === 0 && typeof G[k] === 'function') G[k] = function () {};
    }

    section('1. Svět a stav');
    G.WORLD_SEED = 20260910;
    G.WORLD = G.generateWorld(G.WORLD_SEED);
    assert('generateWorld() vrací svět', !!(G.WORLD && G.WORLD.settlements && G.WORLD.settlements.length));
    G.state = G.newState();
    assert('newState() vrací stav', !!(G.state && G.state.resources));

    section('2. Postavy a skupina');
    const a = G.createUnit('Aldo'), b = G.createUnit('Bram'), c = G.createUnit('Cira');
    G.state.units.push(a, b, c);
    const g = G.createGroup('Test');
    g.memberIds = [a.id, b.id, c.id];
    a.groupId = b.groupId = c.groupId = g.id;
    assert('createUnit() vytvoří postavu s atributy', !!(a.attrs && a.attrs.str != null));
    assert('postava má dovednosti', !!(a.skills && Object.keys(a.skills).length > 0));

    section('3. Ekonomika');
    G.initEconomy();
    for (const s of G.WORLD.settlements) if (G.ensureQuests) G.ensureQuests(s.id);
    assert('initEconomy() proběhne', true);

    section('4. Úkol');
    const t = G.startTask('chop_wood', [a.id, b.id], { targetQty: 20 });
    assert('startTask() vytvoří úkol', !!t);
    if (t) assert('postavy přiřazeny k úkolu', a.assignedTaskId === t.id && b.assignedTaskId === t.id);

    section('5. Tick');
    let tickOk = true, tickErr = null;
    try { for (let i = 0; i < 50; i++) G.tick(0.2); } catch (e) { tickOk = false; tickErr = e.message; }
    assert('tick() běží bez výjimky', tickOk, tickErr);
    assert('úkol postupuje (workDone > 0)', !!(t && t.workDone > 0));

    section('6. Produkce');
    assert('dřevo se těží', (G.state.stats.totalWood || 0) > 0 || G.matCount('wood') > 0);

    section('7. Směrnice');
    if (G.setDirective) {
      G.setDirective('focusMaterial', 'wood');
      assert('setDirective/getDirective fungují', G.getDirective('focusMaterial') === 'wood');
    } else {
      assert('setDirective existuje', false);
    }

    section('8. Save/load roundtrip (dočasný klíč)');
    const origKey = G.SAVE_KEY;
    G.SAVE_KEY = 'idleRealmSmokeTest_temp';
    try {
      G.save();
      const loaded = G.load();
      assert('save()/load() roundtrip', !!(loaded && loaded.units && loaded.units.length === 3));
    } finally {
      G.SAVE_KEY = origKey;
      try { localStorage.removeItem('idleRealmSmokeTest_temp'); } catch (e) {}
    }

    section('9. Autonomie');
    let autoOk = true, autoErr = null;
    try { for (let i = 0; i < 5; i++) G.tickAutonomy(2); } catch (e) { autoOk = false; autoErr = e.message; }
    assert('tickAutonomy() běží bez výjimky', autoOk, autoErr);
  } catch (e) {
    failed++;
    results.push('<div class="fail">FATAL: ' + (e && e.message ? e.message : e) + '</div>');
  }

  const el = document.getElementById('results');
  el.innerHTML = results.join('') +
    '<hr><div class="' + (failed ? 'fail' : 'pass') + '"><b>' + passed + ' prošlo, ' + failed + ' selhalo</b></div>';
  document.title = failed ? 'SMOKE TEST — SELHÁNÍ' : 'SMOKE TEST — OK';
})();
