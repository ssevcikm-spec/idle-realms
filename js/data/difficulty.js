(function () {
  const G = window.Game;

  G.DIFFICULTIES = {
    relax: {
      id: 'relax', name: 'Relax', icon: '🌿',
      desc: 'Mírné tempo, delší offline, jen stářím. Ideální pro první hru a poznávání světa.',
      startGold: 80, startUnits: 4, combatDeathChance: 0,
      offlineCap: 8 * 3600, xpMult: 1.15, masteryMult: 0.85,
      honorTitle: 'Poutník'
    },
    normal: {
      id: 'normal', name: 'Normální', icon: '⚖️',
      desc: 'Doporučený zážitek. Vyvážené tempo, smrt 12 % v boji, 4 h offline dopočtu.',
      startGold: 40, startUnits: 3, combatDeathChance: 0.12,
      offlineCap: 4 * 3600, xpMult: 1.0, masteryMult: 1.0,
      honorTitle: 'Dobrodruh'
    },
    hardcore: {
      id: 'hardcore', name: 'Hardcore', icon: '⚔️',
      desc: 'Vyšší smrt 35 %, kratší offline. Když dynastie vyhyne a zlato dojde, běh končí.',
      startGold: 20, startUnits: 2, combatDeathChance: 0.35,
      offlineCap: 2 * 3600, xpMult: 0.9, masteryMult: 1.25,
      honorTitle: 'Válečník'
    },
    ironman: {
      id: 'ironman', name: 'Ironman', icon: '💀',
      desc: 'Smrt je trvalá, žádný export/import, žádné escape. Jen pro otrlé a pro slávu.',
      startGold: 20, startUnits: 2, combatDeathChance: 0.35,
      offlineCap: 2 * 3600, xpMult: 0.9, masteryMult: 1.5,
      noExport: true, permaDeath: true,
      honorTitle: 'Nesmrtelný'
    }
  };

  G.currentDifficulty = function () {
    const id = (G.state && G.state.settings && G.state.settings.difficulty) || 'normal';
    return G.DIFFICULTIES[id] || G.DIFFICULTIES.normal;
  };

  G.setDifficulty = function (id) {
    if (!G.state.settings) G.state.settings = {};
    if (!G.DIFFICULTIES[id]) id = 'normal';
    G.state.settings.difficulty = id;
  };

  G.difficultyList = function () {
    return Object.values(G.DIFFICULTIES);
  };
})();
