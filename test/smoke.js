// smoke.js — browser smoke test pro Idle Realm (rozšířený)
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

    for (const k in G) {
      if (k.indexOf('render') === 0 && typeof G[k] === 'function') G[k] = function () {};
    }

    section('1. Svět a stav');
    G.WORLD_SEED = 20260910;
    G.WORLD = G.generateWorld(G.WORLD_SEED);
    assert('generateWorld() vrací svět', !!(G.WORLD && G.WORLD.settlements && G.WORLD.settlements.length));
    G.state = G.newState();
    assert('newState() vrací stav', !!(G.state && G.state.resources));
    assert('newState().stats.bossesKilled = 0', G.state.stats.bossesKilled === 0);
    assert('newState().settings existuje', !!G.state.settings);

    section('2. Obtížnost');
    G.setDifficulty('hardcore');
    assert('setDifficulty hardcore', G.currentDifficulty().id === 'hardcore');
    assert('hardcore má 35 % smrt', G.currentDifficulty().combatDeathChance === 0.35);
    G.setDifficulty('normal');

    section('3. Postavy a skupina');
    const a = G.createUnit('Aldo'), b = G.createUnit('Bram'), c = G.createUnit('Cira');
    G.state.units.push(a, b, c);
    const g = G.createGroup('Test');
    g.memberIds = [a.id, b.id, c.id];
    a.groupId = b.groupId = c.groupId = g.id;
    assert('createUnit() vytvoří postavu', !!(a.attrs && a.attrs.str != null));
    assert('postava má dovednosti', !!(a.skills && Object.keys(a.skills).length > 0));

    section('4. Ekonomika');
    G.initEconomy();
    for (const s of G.WORLD.settlements) if (G.ensureQuests) G.ensureQuests(s.id);
    assert('initEconomy() proběhne', true);

    section('5. Úkol');
    const t = G.startTask('chop_wood', [a.id, b.id], { targetQty: 20 });
    assert('startTask() vytvoří úkol', !!t);
    if (t) assert('postavy přiřazeny k úkolu', a.assignedTaskId === t.id && b.assignedTaskId === t.id);

    section('6. Tick');
    let tickOk = true, tickErr = null;
    try { for (let i = 0; i < 50; i++) G.tick(0.2); } catch (e) { tickOk = false; tickErr = e.message; }
    assert('tick() běží bez výjimky', tickOk, tickErr);
    assert('úkol postupuje', !!(t && t.workDone > 0));

    section('7. Směrnice');
    if (G.setDirective) {
      G.setDirective('focusMaterial', 'wood');
      assert('setDirective/getDirective', G.getDirective('focusMaterial') === 'wood');
    }

    section('8. Save/load roundtrip');
    const origKey = G.SAVE_KEY;
    G.SAVE_KEY = 'idleRealmSmokeTest_temp';
    try {
      G.save();
      const loaded = G.load();
      assert('save()/load() roundtrip', !!(loaded && loaded.units && loaded.units.length === 3));
      assert('uložené bossesKilled', loaded && loaded.stats && loaded.stats.bossesKilled === 0);
      assert('uložené settings', loaded && loaded.settings && loaded.settings.difficulty);
    } finally {
      G.SAVE_KEY = origKey;
      try { localStorage.removeItem('idleRealmSmokeTest_temp'); } catch (e) {}
    }

    section('9. Autonomie');
    let autoOk = true, autoErr = null;
    try { for (let i = 0; i < 5; i++) G.tickAutonomy(2); } catch (e) { autoOk = false; autoErr = e.message; }
    assert('tickAutonomy() běží', autoOk, autoErr);

    section('10. Legendární drop');
    if (G.rollLegendaryDrop) {
      const orig = G.chance;
      G.chance = () => true;
      const anyDrop = G.rollLegendaryDrop('colossus', 0.5);
      G.chance = orig;
      assert('rollLegendaryDrop s bonusem vrátí item', !!anyDrop);
    } else {
      assert('rollLegendaryDrop existuje', false);
    }

    section('11. Boss spawn — BOSS_TABLE');
    assert('BOSS_TABLE.forest', !!(G.BOSS_TABLE && G.BOSS_TABLE.forest));
    assert('BOSS_TABLE.marsh', !!(G.BOSS_TABLE && G.BOSS_TABLE.marsh));
    assert('BOSS_TABLE.cave', !!(G.BOSS_TABLE && G.BOSS_TABLE.cave));
    assert('ENCOUNTER_TABLE.mountain', !!(G.ENCOUNTER_TABLE && G.ENCOUNTER_TABLE.mountain));

    section('12. Kill countery pro questy');
    if (G.recordKill) {
      G.state.killCounts = { beast: 0, humanoid: 0, monster: 0 };
      G.recordKill('beast', 3);
      G.recordKill('humanoid', 1);
      assert('recordKill funguje', G.state.killCounts.beast === 3 && G.state.killCounts.humanoid === 1);
    } else {
      assert('recordKill existuje', false);
    }

    section('13. Endgame');
    assert('ENDGAME.victoryPrestige = 5', G.ENDGAME && G.ENDGAME.victoryPrestige === 5);
    if (G.chapterName) {
      assert('chapterName funguje', G.chapterName(0) === 'Popel' && G.chapterName(5) === 'Hvězdy');
    }

    section('14. Tutoriál');
    if (G.tutorialCurrentStep) {
      G.state.settings.tutorial = true;
      G.state.tutorial = { active: true, stepIdx: 0, completed: [] };
      const step = G.tutorialCurrentStep();
      assert('tutorialCurrentStep vrací první krok', step && step.id === 'chop_wood');
      G.state.stats.totalWood = 10;
      G.tickTutorial();
      assert('tickTutorial posune krok', G.state.tutorial.stepIdx === 1);
    }

    section('15. Obtížnost ovlivňuje smrt v boji');
    assert('relax nikdy nezabije v boji', G.DIFFICULTIES.relax.combatDeathChance === 0);
    assert('normal má 12 %', G.DIFFICULTIES.normal.combatDeathChance === 0.12);

  } catch (e) {
    failed++;
    results.push('<div class="fail">FATAL: ' + (e && e.message ? e.message : e) + '</div>');
  }

  const el = document.getElementById('results');
  el.innerHTML = results.join('') +
    '<hr><div class="' + (failed ? 'fail' : 'pass') + '"><b>' + passed + ' prošlo, ' + failed + ' selhalo</b></div>';
  document.title = failed ? 'SMOKE TEST — SELHÁNÍ' : 'SMOKE TEST — OK';
})();
