(function () {
  const G = window.Game;

  /**
   * FIX-v4: odstraněno `masteryMult` (nikde se nepoužívalo).
   * `honorTitle` zachováno — používá se ve victory modalu.
   */
  G.DIFFICULTIES = {
    relax: {
      id: 'relax', name: 'Relax', icon: '🌿',
      desc: 'Mírné tempo, delší offline, jen stářím. Ideální pro první hru a poznávání světa.',
      startGold: 80, startUnits: 4, combatDeathChance: 0,
      offlineCap: 8 * 3600, xpMult: 1.15,
      honorTitle: 'Poutník'
    },
    normal: {
      id: 'normal', name: 'Normální', icon: '⚖️',
      desc: 'Doporučený zážitek. Vyvážené tempo, sm
