(function () {
  const G = window.Game;

  /**
   * Časový systém.
   *   1 herní den  = 300 s (5 min při ×1)
   *   1 sezóna     = 7 dní = 2100 s (35 min při ×1)
   *   1 rok        = 4 sezóny = 8400 s (2,3 h při ×1)
   */
  G.TIME = {
    dayLength: 300,
    daysPerSeason: 7,
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    dayPhases: {
      morning: { start: 0.20, end: 0.40, name: 'Ráno',  icon: '🌅', color: '#e0bb5e' },
      day:     { start: 0.40, end: 0.65, name: 'Den',   icon: '☀️', color: '#d8b45a' },
      evening: { start: 0.65, end: 0.80, name: 'Večer', icon: '🌆', color: '#cf8f6a' },
      night:   { start: 0.80, end: 0.20, name: 'Noc',   icon: '🌙', color: '#7aa8e0' }
    }
  };

  G.SEASONS = {
    spring: {
      name: 'Jaro', icon: '🌸', color: '#8fbf7a',
      desc: 'Bylinky rostou, mírné počasí.',
      priceMods: { herb: 0.85, fish: 0.90 },
      workMods:  { herbalism: 1.20, woodcutting: 0.95, mining: 0.95 },
      staminaMod: 1.00, dangerMod: 1.00, xpMod: 1.05
    },
    summer: {
      name: 'Léto', icon: '☀️', color: '#e0bb5e',
      desc: 'Lov a rybolov vzkvétá, horko unavuje.',
      priceMods: { fish: 0.80, bread: 1.10 },
      workMods:  { hunting: 1.20, mining: 0.90, smithing: 0.90 },
      staminaMod: 1.20, dangerMod: 0.95, xpMod: 1.00
    },
    autumn: {
      name: 'Podzim', icon: '🍂', color: '#cf8f6a',
      desc: 'Sklizeň, dřevo suché, ideální pro učení.',
      priceMods: { herb: 0.90 },
      workMods:  { woodcutting: 1.20, herbalism: 0.90 },
      staminaMod: 1.00, dangerMod: 1.00, xpMod: 1.10
    },
    winter: {
      name: 'Zima', icon: '❄️', color: '#7aa8e0',
      desc: 'Zima. Vše je dražší, cesty jsou nebezpečné.',
      priceMods: { bread: 1.30, wood: 1.25, coal: 1.20, herb: 1.15 },
      workMods:  { hunting: 0.85, herbalism: 0.80 },
      staminaMod: 1.30, dangerMod: 1.15, xpMod: 0.95
    }
  };
})();
