(function () {
  const G = window.Game;

  /**
   * Trvalé odemknutelné prvky (přenášejí se mezi prestižemi).
   * Každý unlock se buď aplikuje při startu nové hry, nebo mění parametry světa.
   */
  G.UNLOCKS = {
    new_region: {
      id: 'new_region', name: 'Nové území', icon: '🗺️',
      desc: 'Odemkne 5. region světa (Zapomenutý ostrov).',
      kind: 'world'
    },
    start_gold: {
      id: 'start_gold', name: 'Bohatá pokladna', icon: '💰',
      desc: 'Každá nová hra začíná s +250 zlata navíc.',
      kind: 'start', value: 250
    },
    start_units: {
      id: 'start_units', name: 'Věrní následovníci', icon: '🧙',
      desc: 'Každá nová hra začíná s +2 postavami navíc.',
      kind: 'start', value: 2
    },
    master_tools: {
      id: 'master_tools', name: 'Dědictví řemeslníka', icon: '🧰',
      desc: 'Každá startovní postava začíná s Mistrovským nářadím.',
      kind: 'start'
    },
    veteran: {
      id: 'veteran', name: 'Veteráni', icon: '⚔️',
      desc: 'Startovní postavy začínají na úrovni 5 a mají 5 úrovní v každé dovednosti.',
      kind: 'start'
    },
    lucky_craft: {
      id: 'lucky_craft', name: 'Štěstěna', icon: '🍀',
      desc: 'Trvale +12 % kvalita výroby.',
      kind: 'passive'
    },
    world_knowledge: {
      id: 'world_knowledge', name: 'Znalost světa', icon: '📚',
      desc: 'Světové události trvají o 40 % déle.',
      kind: 'passive'
    },
    faster_xp: {
      id: 'faster_xp', name: 'Moudrost předků', icon: '🌟',
      desc: '+25 % XP pro všechny postavy.',
      kind: 'passive'
    }
  };

  G.PRESTIGE_UNLOCK_POOL = Object.keys(G.UNLOCKS);

  /** Vrátí seznam unlocků, které hráč ještě nemá. */
  G.availablePrestigeUnlocks = function () {
    const have = (G.state.prestige && G.state.prestige.unlocks) || [];
    return G.PRESTIGE_UNLOCK_POOL.filter(id => !have.includes(id));
  };

  /** Zkontroluj, jestli hráč má unlock. */
  G.hasUnlock = function (id) {
    if (!G.state || !G.state.prestige) return false;
    return (G.state.prestige.unlocks || []).includes(id);
  };

  /** Aplikuje všechny permanentní unlocky na nový stav (při newGame / prestiži). */
  G.applyUnlocksToNewGame = function () {
    if (!G.state.prestige || !G.state.prestige.unlocks) return;
    const unlocks = G.state.prestige.unlocks;

    if (unlocks.includes('start_gold')) {
      G.state.resources.gold += G.UNLOCKS.start_gold.value;
    }
    if (unlocks.includes('start_units')) {
      const extra = G.UNLOCKS.start_units.value;
      for (let i = 0; i < extra; i++) {
        const u = G.createUnit();
        applyStartUnitBoost(u, unlocks);
        G.state.units.push(u);
      }
    }
    if (unlocks.includes('master_tools')) {
      for (const u of G.state.units) {
        const item = G.equipAdd('master_tools');
        if (item) {
          u.equipment.tool = item;
          if (G.refreshGearVisual) G.refreshGearVisual(u);
        }
      }
    }
    if (unlocks.includes('veteran')) {
      for (const u of G.state.units) {
        u.level = 5;
        for (const sid in u.skills) u.skills[sid].level = 5;
      }
    }
  };

  function applyStartUnitBoost(u, unlocks) {
    if (unlocks.includes('veteran')) {
      u.level = 5;
      for (const sid in u.skills) u.skills[sid].level = 5;
    }
    if (unlocks.includes('master_tools')) {
      const item = G.equipAdd('master_tools');
      if (item) u.equipment.tool = item;
    }
  }

  /** Pasivní multiplikátory — čtou se za běhu. */
  G.unlockCraftQualityBonus = function () {
    return G.hasUnlock('lucky_craft') ? 12 : 0;
  };
  G.unlockXpMult = function () {
    return G.hasUnlock('faster_xp') ? 1.25 : 1;
  };
  G.unlockEventDurationMult = function () {
    return G.hasUnlock('world_knowledge') ? 1.40 : 1;
  };
})();
