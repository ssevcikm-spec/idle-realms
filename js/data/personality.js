(function () {
  const G = window.Game;

  G.PERSONALITY_AXES = {
    openness:      { id:'openness',      name:'Otevřenost',    icon:'🎭', low:'Konzervativní', high:'Zvídavý',    color:'#b3a4e8' },
    conscientious: { id:'conscientious', name:'Svědomitost',   icon:'📋', low:'Chaotický',     high:'Pečlivý',     color:'#7aa8e0' },
    extraversion:  { id:'extraversion',  name:'Extraverze',    icon:'🗣️', low:'Samotář',       high:'Vůdčí',       color:'#e0bb5e' },
    agreeableness: { id:'agreeableness', name:'Přívětivost',   icon:'💚', low:'Konfliktní',    high:'Vstřícný',    color:'#8fbf7a' },
    stability:     { id:'stability',     name:'Stabilita',     icon:'🧘', low:'Úzkostný',      high:'Klidný',      color:'#cf8f6a' }
  };

  G.rollPersonality = function () {
    return {
      openness:      40 + G.randInt(-15, 20),
      conscientious: 40 + G.randInt(-15, 20),
      extraversion:  40 + G.randInt(-15, 20),
      agreeableness: 40 + G.randInt(-15, 20),
      stability:     40 + G.randInt(-15, 20)
    };
  };

  G.personalityLabel = function (axis, value) {
    if (value >= 75) return { text: G.PERSONALITY_AXES[axis].high, level:'high' };
    if (value >= 55) return { text: 'Spíše ' + G.PERSONALITY_AXES[axis].high.toLowerCase(), level:'mid-high' };
    if (value >= 45) return { text: 'Vyrovnaný', level:'mid' };
    if (value >= 25) return { text: 'Spíše ' + G.PERSONALITY_AXES[axis].low.toLowerCase(), level:'mid-low' };
    return { text: G.PERSONALITY_AXES[axis].low, level:'low' };
  };

  G.personalityMod = function (unit, key) {
    if (!unit.personality) return 1;
    const p = unit.personality;
    switch (key) {
      case 'work':        return 1 + (p.conscientious - 50) * 0.001;
      case 'xp':          return 1 + (p.openness - 50) * 0.002;
      case 'quality':     return (p.conscientious - 50) * 0.4;
      case 'combat':      return 1 + (p.stability - 50) * 0.001;
      case 'safety':      return 1 - (p.stability - 50) * 0.003;
      case 'relationship':return 1 + (p.agreeableness - 50) * 0.006;
      case 'moodRegen':   return 1 + ((p.stability + p.extraversion) / 2 - 50) * 0.003;
    }
    return 1;
  };

  G.PERSONALITY_DRIFT = {
    woodcutting:  { conscientious: 0.15, stability: 0.05 },
    mining:       { conscientious: 0.20, stability: 0.10 },
    herbalism:    { openness: 0.15, agreeableness: 0.05 },
    hunting:      { extraversion: -0.10, stability: 0.15, openness: 0.05 },
    combat:       { stability: 0.25, extraversion: 0.10, agreeableness: -0.05 },
    smithing:     { conscientious: 0.25, openness: -0.05 },
    alchemy:      { openness: 0.25, conscientious: 0.10 },
    cooking:      { agreeableness: 0.15, conscientious: 0.10 },
    crafting:     { conscientious: 0.15, openness: 0.05 },
    scouting:     { openness: 0.20, extraversion: -0.05, stability: 0.10 },
    trading:      { extraversion: 0.20, agreeableness: 0.10, openness: 0.10 }
  };

  G.driftPersonality = function (unit, skillId, hours) {
    const drift = G.PERSONALITY_DRIFT[skillId];
    if (!drift || !unit.personality) return;
    for (const axis in drift) {
      const delta = drift[axis] * hours;
      unit.personality[axis] = G.clamp((unit.personality[axis] || 50) + delta, 0, 100);
    }
  };

  G.driftPersonalityCombat = function (unit, won) {
    if (!unit.personality) return;
    if (won) {
      unit.personality.stability = G.clamp(unit.personality.stability + 0.3, 0, 100);
      unit.personality.extraversion = G.clamp(unit.personality.extraversion + 0.2, 0, 100);
    } else {
      unit.personality.stability = G.clamp(unit.personality.stability - 0.5, 0, 100);
      unit.personality.openness = G.clamp(unit.personality.openness + 0.1, 0, 100);
    }
  };
})();
