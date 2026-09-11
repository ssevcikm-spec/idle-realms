(function () {
  const G = window.Game;

  /** Vrátí seznam dostupných dílen v aktuálním sídle/na základně pro UI. */
  G.workshopStatus = function () {
    const out = [];
    for (const wid in G.WORKSHOPS) {
      const w = G.WORKSHOPS[wid];
      let available = false;
      let where = '';
      // sídla
      for (const s of G.WORLD.settlements) {
        if (w.settlements[s.size]) { available = true; where = s.name; break; }
      }
      // základna
      let onBase = false;
      if (w.baseRequirement && G.state.base && G.state.base.unlocked) {
        if ((G.state.base.buildings[w.baseRequirement] || 0) > 0) onBase = true;
      }
      out.push({ workshop: w, available, where, onBase });
    }
    return out;
  };

  /** Kolik postav má k dílně přístup. */
  G.workshopAccessCount = function (wid) {
    let n = 0;
    for (const u of G.state.units) {
      if (G.canAccessWorkshop(u, wid)) n++;
    }
    return n;
  };
})();
