(function () {
  const G = window.Game;

  G.SETS = {
    hunters_kit: {
      id:'hunters_kit', name:'Lovcova výbava', icon:'🏹',
      desc:'Kožené a plátěné kusy pro stopaře.',
      bonuses: {
        2: { desc:'+10 % poškození', atk:1.10 },
        3: { desc:'+15 % kvalita lovu, +15 % krit', skillBonus:{ hunting:15 }, crit:0.15 }
      }
    },
    warrior_plate: {
      id:'warrior_plate', name:'Válečná zbroj', icon:'⚔️',
      desc:'Těžká výbava z bitev.',
      bonuses: {
        2: { desc:'+15 % obrany', def:1.15 },
        3: { desc:'+30 % poškození, +20 % HP', atk:1.30, hp:1.20 }
      }
    },
    scholars_insight: {
      id:'scholars_insight', name:'Učencova moudrost', icon:'📚',
      desc:'Plášť a doplňky pro znalce.',
      bonuses: {
        2: { desc:'+15 % XP ze všech dovedností', xpBonus:15 },
        3: { desc:'+25 % kvalita výroby, +1 batch', craftQuality:25, craftBatch:1 }
      }
    }
  };

  G.setBonusFor = function (unit) {
    if (!unit || !unit.equipment) return { sets: [], bonuses: {} };
    const counts = {};
    for (const slot in unit.equipment) {
      const item = unit.equipment[slot];
      if (!item) continue;
      const def = G.EQUIPMENT[item.itemId];
      if (!def || !def.setId) continue;
      counts[def.setId] = (counts[def.setId] || 0) + 1;
    }
    const sets = [];
    const bonuses = { atk:1, def:1, hp:1, crit:0, speed:1, skillBonus:{}, xpBonus:0, craftQuality:0, craftBatch:0 };
    for (const setId in counts) {
      const setDef = G.SETS[setId];
      if (!setDef) continue;
      const cnt = counts[setId];
      const activeTiers = [];
      for (const tier of [2, 3]) {
        if (cnt >= tier && setDef.bonuses[tier]) {
          activeTiers.push(tier);
          const b = setDef.bonuses[tier];
          if (b.atk) bonuses.atk *= b.atk;
          if (b.def) bonuses.def *= b.def;
          if (b.hp) bonuses.hp *= b.hp;
          if (b.crit) bonuses.crit += b.crit;
          if (b.speed) bonuses.speed *= b.speed;
          if (b.xpBonus) bonuses.xpBonus += b.xpBonus;
          if (b.craftQuality) bonuses.craftQuality += b.craftQuality;
          if (b.craftBatch) bonuses.craftBatch += b.craftBatch;
          if (b.skillBonus) {
            for (const sid in b.skillBonus) bonuses.skillBonus[sid] = (bonuses.skillBonus[sid] || 0) + b.skillBonus[sid];
          }
        }
      }
      sets.push({ set: setDef, count: cnt, tiers: activeTiers });
    }
    return { sets, bonuses };
  };

  G.setSummary = function (unit) {
    const result = G.setBonusFor(unit);
    if (!result.sets.length) return [];
    return result.sets.map(s => ({
      name: s.set.name, icon: s.set.icon, count: s.count,
      desc: s.tiers.map(t => s.set.bonuses[t].desc).join(' • ')
    }));
  };
})();
