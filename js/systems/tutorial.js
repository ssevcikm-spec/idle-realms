(function () {
  const G = window.Game;

  G.TUTORIAL_STEPS = [
    {
      id: 'chop_wood',
      title: 'První dřevo',
      text: 'Klepni na uzel v lese (🌲) a zvol „Kácet dřevo". Pošli tam někoho ze skupiny.',
      icon: '🪓',
      check: (s) => (s.stats.totalWood || 0) >= 5,
      hint: (s) => `${Math.min((s.stats.totalWood || 0), 5)}/5 dřeva`,
      reward: { gold: 30, renown: 2, log: '🌱 První dřevo v ruce. Základ je položen.' }
    },
    {
      id: 'first_building',
      title: 'Vlastní dílna',
      text: 'Klepni na sídlo (🏘️) a v záložce „Budovy" postav první stavbu.',
      icon: '🏗️',
      check: (s) => {
        if (!s.buildings) return false;
        for (const sid in s.buildings) for (const bid in s.buildings[sid]) {
          if ((s.buildings[sid][bid] || 0) > 0) return true;
        }
        return false;
      },
      hint: () => '0/1 budova',
      reward: { gold: 40, renown: 3, log: '🏗️ První budova stojí. Vesnice roste.' }
    },
    {
      id: 'explore_world',
      title: 'Cesta do světa',
      text: 'Tažením posouvej mapu a klepni na druhé sídlo. Obchod a reputace jsou tvůj chléb.',
      icon: '🗺️',
      check: (s) => (s.stats.settlementsVisited || []).length >= 2,
      hint: (s) => `${Math.min((s.stats.settlementsVisited || []).length, 2)}/2 sídla`,
      reward: { gold: 50, renown: 5, log: '🗺️ Svět je otevřený. Jdi a dobij ho.' }
    }
  ];

  G.tutorialState = function () {
    if (!G.state.tutorial) {
      G.state.tutorial = { active: true, stepIdx: 0, completed: [] };
    }
    return G.state.tutorial;
  };

  G.tutorialCurrentStep = function () {
    if (!G.state.settings || !G.state.settings.tutorial) return null;
    const ts = G.tutorialState();
    if (!ts.active || ts.stepIdx >= G.TUTORIAL_STEPS.length) return null;
    return G.TUTORIAL_STEPS[ts.stepIdx];
  };

  G.tickTutorial = function () {
    if (!G.state || !G.state.settings) return;
    if (!G.state.settings.tutorial) return;
    const ts = G.tutorialState();
    if (!ts.active) return;
    if (ts.stepIdx >= G.TUTORIAL_STEPS.length) {
      ts.active = false;
      G.state.settings.tutorial = false;
      return;
    }
    const step = G.TUTORIAL_STEPS[ts.stepIdx];
    let ok = false;
    try { ok = step.check(G.state); } catch (e) { ok = false; }
    if (!ok) return;
    ts.completed.push(step.id);
    ts.stepIdx++;
    const rw = step.reward || {};
    if (rw.gold) G.state.resources.gold += rw.gold;
    if (rw.renown) G.state.resources.renown += rw.renown;
    if (rw.log) G.log(rw.log, 'story');
    if (ts.stepIdx >= G.TUTORIAL_STEPS.length) {
      ts.active = false;
      G.state.settings.tutorial = false;
      G.state.resources.renown += 5;
      G.log('🎉 Tutoriál dokončen! Bonus: +5 ⭐ navíc.', 'story');
    } else {
      const next = G.TUTORIAL_STEPS[ts.stepIdx];
      G.log(`📘 Nový úkol: ${next.title} — ${next.text}`, 'story');
    }
  };

  G.skipTutorial = function () {
    if (!G.state.tutorial) return;
    G.state.tutorial.active = false;
    if (G.state.settings) G.state.settings.tutorial = false;
    G.log('⏭️ Tutoriál přeskočen.', 'info');
  };
})();
