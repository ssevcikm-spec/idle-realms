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
      if (!found || !found.unit) { const w = G.WORKSHOPS[r.workshop]; return { ok:false, reason:`Nikdo u ${w.name} (${w.icon}).` }; }
    }
    return { ok:true };
  };

  const MASTERWORK_SUFFIXES = ['Drtič','Strážce','Ostří','Blesk','Pevnost','Sláva','Pomsta','Svítání','Soumrak','Věčnost','Bouře','Klid','Duch','Stín','Plamen','Mráz'];

  /**
   * Vyrobí `qty` kusů (výchozí 1). Zastaví se, když dojdou suroviny nebo
   * přestane platit některá podmínka receptu. Loguje jeden souhrn.
   */
  G.craft = function (recipeId, qty) {
    const r = G.RECIPES[recipeId];
    const check = G.canCraft(recipeId);
    if (!check.ok) return check;
    qty = Math.max(1, Math.min(999, Math.floor(qty || 1)));
    const made = [];
    for (let i = 0; i < qty; i++) {
      if (i > 0) { const c = G.canCraft(recipeId); if (!c.ok) break; }
      const res = craftOnce(recipeId);
      if (!res.ok) break;
      made.push(res);
    }
    if (!made.length) return { ok:false, reason:'Výroba se nezdařila.' };
    const totalQty = made.reduce((s, x) => s + x.qty, 0);
    const crafterName = made[made.length - 1].crafterName;
    const masterworks = made.filter(x => x.masterwork);
    if (made.length === 1) {
      const one = made[0];
      if (one.masterwork) G.log(`✨ Mistrovské dílo: "${one.masterwork}" — ${one.qty}× (${G.QUALITY_LABEL[one.quality]}).`, 'work');
      else G.log(`🔨 Vyrobeno: ${one.qty}× ${r.name} (${G.QUALITY_LABEL[one.quality]}) — ${crafterName}.`, 'work');
    } else {
      const counts = {};
      for (const x of made) counts[x.quality] = (counts[x.quality] || 0) + 1;
      const qTxt = Object.keys(counts).map(q => `${G.QUALITY_LABEL[q]} ${counts[q]}×`).join(', ');
      G.log(`🔨 Vyrobeno ${made.length}× ${r.name} — celkem ${totalQty}× (${qTxt}) — ${crafterName}.`, 'work');
      if (masterworks.length) G.log(`✨ Z toho ${masterworks.length}× mistrovské dílo.`, 'work');
    }
    return { ok:true, made: made.length, qty: totalQty, quality: made[made.length - 1].quality };
  };

  function craftOnce(recipeId) {
    const r = G.RECIPES[recipeId];
    const check = G.canCraft(recipeId);
    if (!check.ok) return { ok:false, reason:check.reason };
    let crafter = null, bestLvl = 0;
    if (r.workshop) { const found = G.findCraftsmanForRecipe(recipeId); crafter = found.unit; bestLvl = G.unitSkill(crafter, r.skill); }
    else { for (const u of G.state.units) { if (u.dead || u.isChild || u.resting || u.onExpedition) continue; if (u.merchantState && u.merchantState.active) continue; const lv = G.unitSkill(u, r.skill); if (lv > bestLvl) { bestLvl = lv; crafter = u; } } }
    const saved = {};
    if (crafter && G.perkEffects) { const eff = G.perkEffects(crafter, r.skill); for (const m in eff.craftingSave) saved[m] = (saved[m] || 0) + eff.craftingSave[m]; }
    if (crafter && G.synergyBonus) { const synSave = G.synergyBonus(crafter, 'craftSave'); for (const m in synSave) saved[m] = (saved[m] || 0) + synSave[m]; }
    for (const inp of r.inputs) { const saveAmt = Math.min(saved[inp.material] || 0, inp.qty - 1); G.matRemove(inp.material, inp.qty - saveAmt); }
    let synQuality = 0;
    if (crafter && G.synergyBonus) synQuality = G.synergyBonus(crafter, 'craftQuality');
    if (G.unlockCraftQualityBonus) synQuality += G.unlockCraftQualityBonus();
    if (crafter && G.skillQualityBonus) synQuality += G.skillQualityBonus([crafter], r.skill);
    let q;
    if (crafter) q = G.rollQualityWithBonus(bestLvl, [crafter], r.skill, synQuality);
    else q = G.rollQuality(bestLvl, [], r.skill);
    let batch = r.output.qty || 1;
    if (crafter && G.perkCraftBatch) batch += G.perkCraftBatch(crafter, r.skill);
    if (crafter && G.skillYieldBonus) batch += G.skillYieldBonus([crafter], r.skill);
    G.matAdd(r.output.material, batch, q);
    for (const u of G.state.units) if (!u.dead && !u.isChild && G.unitSkill(u, r.skill) >= (r.reqLevel || 1) - 1) G.addSkillXp(u, r.skill, r.xp || 5);
    const crafterName = crafter ? crafter.name.split(' ')[0] : '?';
    let masterwork = null;
    if (q === 'masterwork' && crafter && G.chance(0.30)) {
      const suffix = G.pick(MASTERWORK_SUFFIXES);
      masterwork = `${crafter.name.split(' ')[1] || crafterName}ův ${r.name} ${suffix}`;
      G.state.stats.namedMasterworks = (G.state.stats.namedMasterworks || 0) + 1;
      if (!G.state.masterworks) G.state.masterworks = [];
      G.state.masterworks.push({ id: 'mw' + Date.now(), name: masterwork, recipe: rid2name(recipeId), craftsman: crafter.name, craftsmanId: crafter.id, material: r.output.material, qty: batch, time: G.state.time });
    }
    return { ok:true, quality:q, qty:batch, crafterName, masterwork };
  }

  function rid2name(recipeId) { return G.RECIPES[recipeId] ? G.RECIPES[recipeId].name : recipeId; }

  /* ---------- automatická výroba (udržovat zásobu) ---------- */

  /** Materiál → recept, který ho vyrobí. Hra ho pak umí dělat sama. */
  G.PRODUCTION_RECIPES = {
    plank: 'plank', cloth: 'cloth', iron_ingot: 'iron_ingot',
    flour: 'flour', bread: 'bread', potion: 'potion',
    bow: 'bow', sword: 'sword', armor: 'armor', longbow: 'longbow'
  };

  /** Kolik kusů materiálu má hra držet (0 = vypnuto). */
  G.productionOrder = function (material) {
    const o = (G.state.productionOrders || []).find(x => x.material === material);
    return o ? o.qty : 0;
  };
  /** Nastaví cíl „držet alespoň N kusů" (0 = vypnout). */
  G.setProductionOrder = function (material, qty) {
    if (!G.state.productionOrders) G.state.productionOrders = [];
    qty = Math.max(0, Math.floor(qty || 0));
    const i = G.state.productionOrders.findIndex(x => x.material === material);
    if (qty <= 0) { if (i >= 0) G.state.productionOrders.splice(i, 1); return; }
    if (i >= 0) G.state.productionOrders[i] = { material: material, qty: qty };
    else G.state.productionOrders.push({ material: material, qty: qty });
  };

  /** Automaticky vyrobí chybějící kusy podle cílů. Volá se periodicky. */
  G.tickProduction = function () {
    const orders = G.state.productionOrders || [];
    if (!orders.length) return;
    for (const o of orders.slice()) {
      if (!o.material || o.qty <= 0) continue;
      if (G.matCount(o.material) >= o.qty) continue;
      const rid = G.PRODUCTION_RECIPES[o.material];
      if (!rid) continue;
      const check = G.canCraft(rid);
      if (!check.ok) continue;   // chybí dílna / postava u ní / materiál
      const deficit = o.qty - G.matCount(o.material);
      const r = G.RECIPES[rid];
      const perCraft = (r.output && r.output.qty) || 1;
      const n = Math.max(1, Math.min(5, Math.ceil(deficit / perCraft)));
      G.craft(rid, n);
    }
  };

  G.rollCraftQuality = function (skillLevel, bonus) {
    const score = (skillLevel || 1) * 1.1 + (bonus || 0) + G.rand() * 100 - 50;
    if (score >= 100) return 'masterwork';
    if (score >= 75)  return 'superior';
    if (score >= 45)  return 'fine';
    if (score >= 15)  return 'common';
    return 'crude';
  };
})();
