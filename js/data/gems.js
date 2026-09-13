(function () {
  const G = window.Game;

  /**
   * Gemy — socketovatelné předměty, které dávají pasivní bonus.
   * Vloží se do zbroje (max 1–3 sockety podle tieru).
   * Lze vyjmout (s 50% ztrátou gemy).
   */
  G.GEMS = {
    ruby:     { id:'ruby',     name:'Rubín',     icon:'🔴', tier:1, price:120, desc:'+8 % poškození',    effect:{ atk:1.08 } },
    sapphire: { id:'sapphire', name:'Safír',     icon:'🔵', tier:1, price:120, desc:'+8 % obrany',       effect:{ def:1.08 } },
    emerald:  { id:'emerald',  name:'Smaragd',   icon:'🟢', tier:1, price:140, desc:'+10 % HP',           effect:{ hp:1.10 } },
    topaz:    { id:'topaz',    name:'Topaz',     icon:'🟡', tier:2, price:220, desc:'+5 % krit',          effect:{ crit:0.05 } },
    amethyst: { id:'amethyst', name:'Ametyst',   icon:'🟣', tier:2, price:220, desc:'+8 % rychlost',      effect:{ speed:1.08 } },
    diamond:  { id:'diamond',  name:'Diamant',   icon:'💎', tier:3, price:500, desc:'+12 % všechny staty',effect:{ atk:1.12, def:1.12, hp:1.12 } }
  };

  G.GEM_SOCKETS_BY_TIER = { 1: 1, 2: 2, 3: 3 };

  G.maxSockets = function (itemId) {
    const def = G.EQUIPMENT[itemId];
    if (!def) return 0;
    if (def.slot !== 'armor' && def.slot !== 'weapon') return 0;
    return G.GEM_SOCKETS_BY_TIER[def.tier] || 0;
  };

  /** Vrátí seznam gemů v předmětu. */
  G.gemsIn = function (item) {
    if (!item) return [];
    if (!item.gems) item.gems = [];
    return item.gems;
  };

  /** Vloží gem do předmětu (instance z G.state.equipment). */
  G.socketGem = function (equipInstanceId, gemId) {
    const item = G.equipFind(equipInstanceId);
    if (!item) return { ok:false, reason:'Předmět nenalezen.' };
    const gemDef = G.GEMS[gemId];
    if (!gemDef) return { ok:false, reason:'Neznámý gem.' };
    const max = G.maxSockets(item.itemId);
    if (max <= 0) return { ok:false, reason:'Předmět nemá sockety.' };
    if (!item.gems) item.gems = [];
    if (item.gems.length >= max) return { ok:false, reason:`Max ${max} gemů.` };
    // Odečti gem z inventáře (materiál 'gem_' + id)
    const matId = 'gem_' + gemId;
    if (G.matCount(matId) < 1) return { ok:false, reason:'Nemáš tento gem.' };
    G.matRemove(matId, 1);
    item.gems.push(gemId);
    G.log(`💎 Vložen ${gemDef.icon} ${gemDef.name} do ${G.EQUIPMENT[item.itemId].name}.`, 'social');
    return { ok:true };
  };

  /** Vyndá gem (50 % šance na ztrátu). */
  G.unsocketGem = function (equipInstanceId, gemIndex) {
    const item = G.equipFind(equipInstanceId);
    if (!item || !item.gems || !item.gems[gemIndex]) return { ok:false, reason:'Žádný gem.' };
    const gemId = item.gems[gemIndex];
    item.gems.splice(gemIndex, 1);
    if (G.chance(0.5)) {
      G.matAdd('gem_' + gemId, 1, 'common');
      G.log(`💎 Gem ${G.GEMS[gemId].name} vyjmut.`, 'social');
      return { ok:true, recovered:true };
    }
    G.log(`💥 Gem ${G.GEMS[gemId].name} se rozbil při vyjímání.`, 'social');
    return { ok:true, recovered:false };
  };

  /** Souhrnný bonus ze všech gemů na postavě. */
  G.gemBonusFor = function (unit) {
    const bonus = { atk:1, def:1, hp:1, crit:0, speed:1 };
    if (!unit || !unit.equipment) return bonus;
    for (const slot in unit.equipment) {
      const item = unit.equipment[slot];
      if (!item || !item.gems) continue;
      for (const gemId of item.gems) {
        const gem = G.GEMS[gemId];
        if (!gem) continue;
        if (gem.effect.atk) bonus.atk *= gem.effect.atk;
        if (gem.effect.def) bonus.def *= gem.effect.def;
        if (gem.effect.hp) bonus.hp *= gem.effect.hp;
        if (gem.effect.crit) bonus.crit += gem.effect.crit;
        if (gem.effect.speed) bonus.speed *= gem.effect.speed;
      }
    }
    return bonus;
  };
})();
