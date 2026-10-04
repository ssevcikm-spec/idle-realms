(function () {
  const G = window.Game;

  G.PRESTIGE_REQUIREMENTS = {
    renown: 75,
    goldEarned: 2500,
    units: 8,
    generations: 1     // nový požadavek: alespoň 1 dokončená generace
  };

  /**
   * Jediné místo, kde roste renomé. Dřív se `resources.renown +=` psalo na
   * osmi místech v pěti souborech — a průzkumný záměr „připrav se na dědictví"
   * neměl žádné API, kterým by se dal splnit (brána K1 to našla jako mrtvý krok).
   */
  G.gainRenown = function (amount) {
    const n = Number(amount) || 0;
    if (n <= 0) return 0;
    if (!G.state.resources) G.state.resources = {};
    G.state.resources.renown = (G.state.resources.renown || 0) + n;
    return n;
  };

  G.prestigeXpMult = function () {
    const lvl = (G.state.prestige && G.state.prestige.level) || 0;
    return 1 + 0.15 * lvl;
  };
  G.prestigeStartGold = function () {
    const lvl = (G.state.prestige && G.state.prestige.level) || 0;
    return 40 + 30 * lvl;
  };
  G.prestigeStartUnits = function () {
    const lvl = (G.state.prestige && G.state.prestige.level) || 0;
    return Math.min(3, lvl);
  };

  G.prestigeStatus = function () {
    const req = G.PRESTIGE_REQUIREMENTS;
    const renown = G.state.resources.renown;
    const goldEarned = G.state.stats.goldEarned || 0;
    const units = G.state.units.filter(u => !u.dead).length;
    const gens = (G.state.dynasty && G.state.dynasty.generations) || 1;
    const items = [
      { key:'renown',      label:'Renomé',            have: renown,     need: req.renown,     ok: renown >= req.renown },
      { key:'goldEarned',  label:'Vydělané zlato',    have: goldEarned, need: req.goldEarned, ok: goldEarned >= req.goldEarned },
      { key:'units',       label:'Živé postavy',      have: units,      need: req.units,      ok: units >= req.units },
      { key:'generations', label:'Generace dynastie', have: gens,       need: req.generations, ok: gens >= req.generations }
    ];
    return { ok: items.every(i => i.ok), items };
  };

  /** Vygeneruje nový seed (deterministicky offsetovaný). */
  function nextWorldSeed(oldSeed) {
    let s = (oldSeed | 0) || 20260910;
    // mix
    s = (s * 1664525 + 1013904223) | 0;
    // zajisti kladné
    if (s < 0) s = -s;
    return s % 999999999 || 12345;
  }

  G.doPrestige = function (chosenUnlock) {
    const st = G.prestigeStatus();
    if (!st.ok) return { ok:false, reason:'Podmínky ještě nesplněny.' };

    const oldLevel = (G.state.prestige && G.state.prestige.level) || 0;
    const newLevel = oldLevel + 1;
    const oldSeed = G.state.worldSeed || G.WORLD_SEED || 20260910;
    const newSeed = nextWorldSeed(oldSeed);

    // zachovej seznam unlocků (staré) + přidej nový
    const oldUnlocks = (G.state.prestige && G.state.prestige.unlocks) || [];
    const unlocks = oldUnlocks.slice();

    let unlockName = null;
    if (chosenUnlock && G.UNLOCKS[chosenUnlock] && !unlocks.includes(chosenUnlock)) {
      unlocks.push(chosenUnlock);
      unlockName = G.UNLOCKS[chosenUnlock].name;
    }

    // Regeneruj svět s novým seedem
    if (G.regenerateWorld) {
      G.regenerateWorld(newSeed);
    } else {
      G.WORLD = G.generateWorld(newSeed);
      G.WORLD_SEED = newSeed;
    }

    // Reset stavu, ale zachovej prestige info a obtížnost
    const oldDiff = (G.state.settings && G.state.settings.difficulty) || 'normal';
    G.state = G.newState();
    G.state.worldSeed = newSeed;
    G.state.settings = { difficulty: oldDiff, tutorial: false };
    G.state.prestige = {
      level: newLevel,
      totalPrestige: newLevel,
      unlocks: unlocks,
      lastUnlock: chosenUnlock || null
    };

    G.WORLD_SEED = newSeed;

    // Startovní postavy
    const names = ['Aldo','Bram','Cira','Dara','Egon'];
    const units = [];
    for (let i = 0; i < 3; i++) {
      const u = G.createUnit(names[i] || undefined);
      G.addJournal(u, 'Zúčastnil se přechodu do nového světa.', '🌍');
      units.push(u);
    }

    const start = G.WORLD.settlementById['svitavy'];
    if (start) {
      units.forEach((u, i) => {
        const a = (i / units.length) * Math.PI * 2;
        u.pos = { x: start.x + 0.5 + Math.cos(a)*1.2, y: start.y + 0.5 + Math.sin(a)*1.2 };
      });
      G.state.camera.x = start.x + 0.5;
      G.state.camera.y = start.y + 0.5;
      G.state.camera.zoom = 1.0;
      G.state.selected = { type:'settlement', id:'svitavy' };
      G.state.stats.settlementsVisited = ['svitavy'];
    }
    G.state.units = units;
    const g = G.createGroup('Dobrodruzi');
    g.memberIds = units.map(u => u.id);
    units.forEach(u => u.groupId = g.id);

    G.state.resources.gold = G.prestigeStartGold();
    G.initEconomy();
    if (G.ensurePolitics) G.ensurePolitics();
    if (G.ensureDynasty) G.ensureDynasty();
    for (const s of G.WORLD.settlements) G.ensureQuests(s.id);

    // Aplikuj permanentní unlocky
    if (G.applyUnlocksToNewGame) G.applyUnlocksToNewGame();

    G.log(`🌟 PRESTIŽ ${newLevel}! Svět se přerodil (seed ${newSeed}).`, 'story');
    if (unlockName) G.log(`🔓 Trvalé odemčení: ${unlockName}.`, 'story');

    G.save();
    return { ok:true, level: newLevel, seed: newSeed, unlock: unlockName };
  };

  /** Regeneruje svět s novým seedem. Volá se i při startu, když save má worldSeed. */
  G.regenerateWorld = function (seed) {
    seed = (seed | 0) || 20260910;
    G.WORLD = G.generateWorld(seed);
    G.WORLD_SEED = seed;
  };
})();
