(function () {
  const G = window.Game;

  /** Posun času — fáze dne + sezóny. */
  G.tickTime = function (dt) {
    const s = G.state;
    if (s.dayTime == null) s.dayTime = 0;
    if (s.day == null) s.day = 0;
    if (!s.season) s.season = 'spring';
    if (!s.year) s.year = 1;

    s.dayTime += dt;
    if (s.dayTime >= G.TIME.dayLength) {
      s.dayTime -= G.TIME.dayLength;
      s.day++;
      if (s.day >= G.TIME.daysPerSeason) {
        s.day = 0;
        const idx = G.TIME.seasons.indexOf(s.season);
        s.season = G.TIME.seasons[(idx + 1) % 4];
        if (s.season === 'spring') {
          s.year++;
          G.log(`🎊 Nový rok ${s.year} začíná. Vítej na jaře.`, 'info');
        } else {
          const info = G.SEASONS[s.season];
          G.log(`${info.icon} Nové roční období: ${info.name}. ${info.desc}`, 'info');
        }
      }
    }
  };

  G.currentPhase = function () {
    const frac = (G.state.dayTime || 0) / G.TIME.dayLength;
    for (const pid in G.TIME.dayPhases) {
      const p = G.TIME.dayPhases[pid];
      if (p.start < p.end) {
        if (frac >= p.start && frac < p.end) return pid;
      } else {
        if (frac >= p.start || frac < p.end) return pid;
      }
    }
    return 'day';
  };

  G.phaseInfo = function () {
    const pid = G.currentPhase();
    return Object.assign({ id: pid }, G.TIME.dayPhases[pid]);
  };

  G.seasonInfo = function () {
    const sid = G.state.season || 'spring';
    return Object.assign({ id: sid }, G.SEASONS[sid]);
  };

  /** Multiplikátor pro práci dané dovednosti (fáze + sezóna). */
  G.timeWorkMod = function (skillId) {
    const phase = G.currentPhase();
    const season = G.seasonInfo();
    let m = 1;
    if (season.workMods && season.workMods[skillId] != null) m *= season.workMods[skillId];
    if (phase === 'night') {
      if (skillId === 'alchemy' || skillId === 'smithing') m *= 1.15;
      if (skillId === 'herbalism' || skillId === 'woodcutting') m *= 0.85;
    }
    if (phase === 'morning' && skillId === 'herbalism') m *= 1.15;
    if (phase === 'evening' && skillId === 'hunting') m *= 1.10;
    return m;
  };

  G.timeStaminaMod = function () {
    return (G.seasonInfo().staminaMod) || 1;
  };

  G.timeDangerMod = function () {
    const phase = G.currentPhase();
    const season = G.seasonInfo();
    let m = season.dangerMod || 1;
    if (phase === 'night') m *= 1.30;
    return m;
  };

  G.timePriceMod = function (matId) {
    const s = G.seasonInfo();
    if (s.priceMods && s.priceMods[matId] != null) return s.priceMods[matId];
    return 1;
  };

  G.timeXpMod = function () {
    return (G.seasonInfo().xpMod) || 1;
  };
})();
