(function () {
  const G = window.Game;

  G.bestSkill = function (sid) {
    let b = 1;
    for (const u of G.state.units) { const lv = G.unitSkill(u, sid); if (lv > b) b = lv; }
    return b;
  };

  G.canCraft = function (recipeId) {
    const r = G.RECIPES[recipeId];
    if (!r) return { ok:false, reason:'Neznámý recept.' };
    const best = G.bestSkill(r.skill);
    if (best < (r.reqLevel || 1)) return { ok:false, reason:`Potřebuješ ${G.SKILLS[r.skill].name} ${r.reqLevel}.` };
    if (!G.hasMaterials(r.inputs)) return { ok:false, reason:'Chybí materiál.' };
    if (r.workshop) {
      const found = G.findCraftsmanForRecipe(recipeId);
      if (!found || !found.unit) {
        const w = G.WORKSHOPS[r.workshop];
        return { ok:false, reason:`Nikdo u ${w.name} (${w.icon}).` };
      }
    }
    return { ok:true };
  };

  /** Náhodná jména pro mistrovská díla. */
  const MASTERWORK_SUFFIXES = [
    'Drtič', 'Strážce', 'Ostří', 'Blesk', 'Pevnost', 'Sláva',
    'Pomsta', 'Svítání', 'Soumrak', 'Věčnost', 'Bouře', 'Klid',
    'Duch', 'Stín', 'Plamen', 'Mráz'
  ];

  G.craft = function (recipeId) {
    const r = G.RECIPES[recipeId];
    const check = G.canCraft(recipeId);
    if (!check.ok) return check;

    let crafter = null, bestLvl = 0;
    if (r.workshop) {
      const found = G.findCraftsmanForRecipe(recipeId);
      crafter = found.unit;
      bestLvl = G.unitSkill(crafter, r.skill);
    } else {
      for (const u of G.state.units) {
        if (u.merchantState && u.merchantState.active) continue;
        const lv = G.unitSkill(u, r.skill);
        if (lv > bestLvl) { bestLvl = lv; crafter = u; }
      }
    }

    const saved = {};
    if (crafter && G.perkEffects) {
      const eff = G.perkEffects(crafter, r.skill);
      for (const m in eff.craftingSave) saved[m] = eff.craftingSave[m];
    }
    for (const inp of r.inputs) {
      const saveAmt = Math.min(saved[inp.material] || 0, inp.qty - 1);
      G.matRemove(inp.material, inp.qty - saveAmt);
    }
    let q;
    if (crafter) {
      const qBonus = G.perkQualityBonus ? G.perkQualityBonus(crafter, r.skill) : 0;
      q = G.rollCraftQuality(bestLvl, qBonus);
    } else q = G.rollCraftQuality(bestLvl, 0);
    let batch = r.output.qty || 1;
    if (crafter && G.perkCraftBatch) batch += G.perkCraftBatch(crafter, r.skill);
    G.matAdd(r.output.material, batch, q);
    for (const u of G.state.units) {
      if (G.unitSkill(u, r.skill) >= (r.reqLevel || 1) - 1) G.addSkillXp(u, r.skill, r.xp || 5);
    }

    const crafterName = crafter ? crafter.name.split(' ')[0] : '?';
    let extra = '';
    if (q === 'masterwork' && crafter && G.chance(0.30)) {
      // jmenované mistrovské dílo
      const suffix = G.pick(MASTERWORK_SUFFIXES);
      const itemName = `${crafter.name.split(' ')[1] || crafterName}ův ${r.name} ${suffix}`;
      // vlastní jméno do logu
      G.log(`✨ Mistrovské dílo: "${itemName}" — ${batch}× (kvalita ${G.QUALITY_LABEL[q]}).`, 'work');
      G.state.stats.namedMasterworks = (G.state.stats.namedMasterworks || 0) + 1;
      // ulož do seznamu
      if (!G.state.masterworks) G.state.masterworks = [];
      G.state.masterworks.push({
        id: 'mw' + Date.now(),
        name: itemName,
        recipe: rid2name(recipeId),
        craftsman: crafter.name,
        craftsmanId: crafter.id,
        material: r.output.material,
        qty: batch,
        time: G.state.time
      });
      extra = ' ✨';
    } else {
      G.log(`🔨 Vyrobeno: ${batch}× ${r.name} (${G.QUALITY_LABEL[q]}) — ${crafterName}.${extra}`, 'work');
    }
    return { ok:true, quality:q, qty:batch };
  };

  function rid2name(recipeId) {
    return G.RECIPES[recipeId] ? G.RECIPES[recipeId].name : recipeId;
  }

  G.rollCraftQuality = function (skill, bonus) {
    const score = skill*0.9 + (bonus || 0) + G.rand()*100 - 50;
    if (score >= 120) return 'masterwork';
    if (score >= 85)  return 'superior';
    if (score >= 50)  return 'fine';
    if (score >= 15)  return 'common';
    return 'crude';
  };
})();
