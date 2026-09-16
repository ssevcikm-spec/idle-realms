(function () {
  const G = window.Game;

  /**
   * Dílny — fyzická místa, kde se vyrábí.
   * Každá dílna má:
   *   - `settlements` = sídla, kde je (podle velikosti)
   *   - `baseLevel`   = minimální úroveň budovy základny (nebo null, pokud jen v sídlech)
   *   - `type`        = typ dílny (odpovídá recept.workshop)
   */
  G.WORKSHOPS = {
    carpenter: { id:'carpenter', name:'Tesařská dílna', icon:'🪚',
      desc:'Výroba prken, luků a dřevěných předmětů.',
      settlements: { village:false, town:true, city:true },
      baseRequirement: 'woodcutter_camp' },
    smithy:    { id:'smithy',    name:'Kovárna',         icon:'🔨',
      desc:'Výroba ingotů, zbraní a zbrojí.',
      settlements: { village:false, town:true, city:true },
      baseRequirement: 'iron_mine' },
    weaver:    { id:'weaver',    name:'Tkalcovská dílna',icon:'🧶',
      desc:'Výroba látek a oděvů.',
      settlements: { village:true, town:true, city:true },
      baseRequirement: 'weaving_hut' },
    alchemy:   { id:'alchemy',   name:'Alchymistická laboratoř', icon:'⚗️',
      desc:'Výroba lektvarů a jedů.',
      settlements: { village:false, town:true, city:true },
      baseRequirement: 'herb_garden' },
    kitchen:   { id:'kitchen',   name:'Kuchyně',         icon:'🍳',
      desc:'Výroba jídla.',
      settlements: { village:true, town:true, city:true },
      baseRequirement: 'grain_field' }
  };

  /** Vrátí seznam dílen dostupných v daném sídle. */
  G.workshopsInSettlement = function (settlementId) {
    const s = G.WORLD.settlementById[settlementId];
    if (!s) return [];
    const out = [];
    for (const wid in G.WORKSHOPS) {
      const w = G.WORKSHOPS[wid];
      if (w.settlements[s.size]) out.push(wid);
    }
    return out;
  };

  /** Vrátí seznam dílen dostupných na základně. */
  G.workshopsOnBase = function () {
    if (!G.state.base || !G.state.base.unlocked) return [];
    const out = [];
    for (const wid in G.WORKSHOPS) {
      const w = G.WORKSHOPS[wid];
      if (!w.baseRequirement) continue;
      if ((G.state.base.buildings[w.baseRequirement] || 0) > 0) out.push(wid);
    }
    return out;
  };

  /**
   * Může postava vyrábět v dané dílně?
   *   - buď je její skupina (nebo ona sama) u sídla, kde dílna je
   *   - nebo je u základny a dílna je postavena
   */
  G.canAccessWorkshop = function (unit, workshopId) {
    if (!unit) return false;
    const w = G.WORKSHOPS[workshopId];
    if (!w) return false;
    // 1) základna
    if (G.state.base && G.state.base.unlocked && w.baseRequirement) {
      const bx = G.state.base.x + 0.5, by = G.state.base.y + 0.5;
      const d = Math.hypot(unit.pos.x - bx, unit.pos.y - by);
      if (d <= 3 && (G.state.base.buildings[w.baseRequirement] || 0) > 0) return true;
    }
    // 2) sídlo
    for (const s of G.WORLD.settlements) {
      const sizeDef = G.SETTLEMENT_SIZE[s.size];
      if (!w.settlements[s.size]) continue;
      const sx = s.x + 0.5, sy = s.y + 0.5;
      const d = Math.hypot(unit.pos.x - sx, unit.pos.y - sy);
      if (d <= sizeDef.radius + 1.5) return true;
    }
    return false;
  };

  /** Vrátí seznam dílen, které jsou v dosahu postavy. */
  G.workshopsInReach = function (unit) {
    const out = [];
    for (const wid in G.WORKSHOPS) {
      if (G.canAccessWorkshop(unit, wid)) out.push(wid);
    }
    return out;
  };

  /** Najdi dílnu pro recept a zjisti, jestli k ní má někdo přístup. */
  G.findCraftsmanForRecipe = function (recipeId) {
    const r = G.RECIPES[recipeId];
    if (!r) return null;
    if (!r.workshop) return { unit: null, workshop: null };
    let best = null, bestLvl = 0;
    for (const u of G.state.units) {
      if (u.dead || u.isChild || u.resting || u.onExpedition) continue;
      if (u.merchantState && u.merchantState.active) continue;
      const lvl = G.unitSkill(u, r.skill);
      if (lvl < (r.reqLevel || 1)) continue;
      if (!G.canAccessWorkshop(u, r.workshop)) continue;
      if (lvl > bestLvl) { bestLvl = lvl; best = u; }
    }
    return { unit: best, workshop: r.workshop };
  };
})();
