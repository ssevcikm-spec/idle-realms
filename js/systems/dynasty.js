(function () {
  const G = window.Game;

  /** Inicializuje dynastii. */
  G.ensureDynasty = function () {
    if (!G.state.dynasty) {
      G.state.dynasty = {
        generations: 1,
        names: [],              // historie jmen rodiny
        legacyXp: 0,            // trvalý XP bonus pro potomky
        totalBirths: 0,
        totalDeaths: 0
      };
    }
  };

  /** Při vytvoření postavy jí přiřadí generaci a rodiče. */
  G.initUnitDynasty = function (unit, opts) {
    G.ensureDynasty();
    opts = opts || {};
    unit.generation = opts.generation != null ? opts.generation : 1;
    unit.parentIds = opts.parentIds || [];
    unit.legacy = opts.legacy || 0;
  };

  /** Když se narodí dítě, zdědí generaci. */
  G.assignChildDynasty = function (child, a, b) {
    G.ensureDynasty();
    const genA = a.generation || 1;
    const genB = b.generation || 1;
    child.generation = Math.max(genA, genB) + 1;
    G.state.dynasty.generations = Math.max(G.state.dynasty.generations, child.generation);
    G.state.dynasty.totalBirths++;
  };

  /** Když postava dospěje, nastaví se jí odkaz od rodičů. */
  G.inheritLegacy = function (unit, parentA, parentB) {
    G.ensureDynasty();
    let legacy = 0;
    for (const p of [parentA, parentB]) {
      if (!p) continue;
      // každý rodič přispěje součtem svých dovedností / 20
      let total = 0;
      for (const sid in p.skills) total += p.skills[sid].level;
      legacy += Math.floor(total / 20);
      // a jménem
      if (!G.state.dynasty.names.includes(p.name)) G.state.dynasty.names.push(p.name);
    }
    unit.legacy = legacy;
    if (legacy > 0) {
      G.log(`🌳 ${unit.name} dědí odkaz předků: +${legacy} úrovní dovedností.`);
      // rovnou přidat XP do všech dovedností
      for (const sid in unit.skills) {
        unit.skills[sid].level += Math.floor(legacy / 10);
      }
    }
  };

  /** Když postava zemře, ostatní členové dynastie dostanou odkaz. */
  G.onDynastyDeath = function (unit) {
    G.ensureDynasty();
    G.state.dynasty.totalDeaths++;
    // zapiš jméno do historie
    if (!G.state.dynasty.names.includes(unit.name)) G.state.dynasty.names.push(unit.name);
    // přímí potomci (děti co dospěly) už odkaz dostaly při dospění.
    // Ale nepřímí (vnuci, pravnuci) dostanou dodatečný bonus.
    const descendants = G.state.units.filter(u =>
      !u.dead && u.parentIds && u.parentIds.length && u.generation > (unit.generation || 1));
    for (const d of descendants) {
      let total = 0;
      for (const sid in unit.skills) total += unit.skills[sid].level;
      const bonus = Math.floor(total / 40);
      if (bonus > 0) {
        d.legacy = (d.legacy || 0) + bonus;
        G.addUnitXp(d, bonus * 20);
      }
    }
  };

  /** XP bonus podle odkazu. */
  G.legacyXpMult = function (unit) {
    if (!unit.legacy) return 1;
    return 1 + unit.legacy * 0.02;   // 1 % za 1 bod odkazu
  };

  /** Přehled dynastie pro UI. */
  G.dynastySummary = function () {
    G.ensureDynasty();
    const alive = G.state.units.filter(u => !u.dead && !u.isChild);
    const byGen = {};
    for (const u of alive) {
      const g = u.generation || 1;
      if (!byGen[g]) byGen[g] = [];
      byGen[g].push(u);
    }
    return {
      generations: G.state.dynasty.generations,
      totalBirths: G.state.dynasty.totalBirths,
      totalDeaths: G.state.dynasty.totalDeaths,
      historicalNames: G.state.dynasty.names.slice(-20),
      byGeneration: byGen
    };
  };

  /** Vrátí děti a rodiče dané postavy (pro UI). */
  G.familyOf = function (unit) {
    const parents = (unit.parentIds || []).map(id => G.getUnit(id)).filter(Boolean);
    const children = G.state.units.filter(u =>
      u.parentIds && u.parentIds.includes(unit.id) && !u.dead);
    const pendingChildren = (G.state.family && G.state.family.children)
      ? G.state.family.children.filter(c =>
          c.parentA === unit.id || c.parentB === unit.id)
      : [];
    return { parents, children, pendingChildren };
  };
})();
