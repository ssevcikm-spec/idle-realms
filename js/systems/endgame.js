(function () {
  const G = window.Game;

  G.ENDGAME = {
    victoryPrestige: 5,
    hardcoreGoldFloor: 15,
    chapterNames: [
      'Popel', 'Led', 'Kořeny', 'Oheň', 'Stíny', 'Hvězdy',
      'Krev', 'Soumrak', 'Svítání', 'Věčnost'
    ]
  };

  G.tickEndgame = function () {
    if (!G.state) return;
    const lvl = (G.state.prestige && G.state.prestige.level) || 0;
    if (lvl >= G.ENDGAME.victoryPrestige && !G.state.victoryReached) {
      G.state.victoryReached = true;
      G.state.victoryAt = G.state.time;
      G.pauseGame();
      if (G.showVictoryModal) G.showVictoryModal();
      G.log('🏆 VÍTĚZSTVÍ! Dovedl jsi lidstvo z popela do hvězd.', 'story');
      return;
    }
    const diff = G.currentDifficulty ? G.currentDifficulty() : null;
    if (diff && diff.permaDeath && !G.state.defeatReached) {
      const alive = G.state.units.filter(u => !u.dead && !u.isChild);
      const gold = G.state.resources.gold;
      if (alive.length === 0 && gold < G.ENDGAME.hardcoreGoldFloor) {
        G.state.defeatReached = true;
        G.state.defeatAt = G.state.time;
        G.pauseGame();
        if (G.showDefeatModal) G.showDefeatModal();
        G.log('💀 KONEC. Dynastie vyhasla a pokladnice je prázdná.', 'story');
      }
    }
  };

  G.runSummary = function () {
    const s = G.state.stats || {};
    const diff = G.currentDifficulty ? G.currentDifficulty() : { name: 'Normální', icon: '⚖️' };
    return {
      difficulty: diff,
      timePlayed: G.state.time,
      prestige: (G.state.prestige && G.state.prestige.level) || 0,
      unitsAlive: G.state.units.filter(u => !u.dead && !u.isChild).length,
      unitsDead: G.state.units.filter(u => u.dead && !u.deserted).length,
      generations: (G.state.dynasty && G.state.dynasty.generations) || 1,
      goldEarned: s.goldEarned || 0,
      tasksDone: s.tasksDone || 0,
      combatsWon: s.combatsWon || 0,
      combatsLost: s.combatsLost || 0,
      bossesKilled: s.bossesKilled || 0,
      questsCompleted: s.questsCompleted || 0,
      expeditions: s.expeditionSuccesses || 0,
      masterworks: s.masterworks || 0,
      achievements: (G.state.achievements && G.state.achievements.unlocked) ? G.state.achievements.unlocked.length : 0
    };
  };

  G.newChapter = function () {
    const lvl = (G.state.prestige && G.state.prestige.level) || 0;
    const chapterName = G.chapterName(lvl);
    G.state.chapterHistory = G.state.chapterHistory || [];
    G.state.chapterHistory.push({
      num: lvl,
      name: chapterName,
      endedAt: G.state.time,
      summary: G.runSummary()
    });
    G.log(`📖 Kapitola ${lvl} „${chapterName}" uzavřena.`, 'story');
    G.state.victoryReached = false;
    return G.doPrestige(null);
  };

  G.chapterName = function (lvl) {
    return G.ENDGAME.chapterNames[(lvl || 0) % G.ENDGAME.chapterNames.length];
  };
})();
