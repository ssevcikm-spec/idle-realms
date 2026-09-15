(function () {
  const G = window.Game;

  G.initEconomy = function () {
    const rnd = G.rngFrom((G.WORLD.seed || 1) + 7777);
    for (const s of G.WORLD.settlements) {
      const sizeDef = G.SETTLEMENT_SIZE[s.size];
      const spec = G.SETTLEMENT_SPECS[s.spec];
      const stock = {}, target = {};
      for (const mid of G.TRADED) {
        let t;
        if (spec.produces.includes(mid)) t = Math.round(28 * sizeDef.stockMult);
        else if (spec.consumes.includes(mid)) t = Math.round(6 * sizeDef.stockMult);
        else t = Math.round(12 * sizeDef.stockMult);
        if (s.size === 'village' && !spec.produces.includes(mid) && !spec.consumes.includes(mid) && rnd() < 0.45) t = 0;
        target[mid] = t; stock[mid] = Math.round(t * (0.7 + rnd()*0.6));
      }
      G.state.economy[s.id] = {
        gold: Math.round(sizeDef.goldBase * (0.6 + rnd()*0.8)),
        goldTarget: sizeDef.goldBase, stock, target
      };
      if (G.state.settlementRep[s.id] == null) G.state.settlementRep[s.id] = 0;
    }
  };

  G.priceAt = function (settlementId, matId, mode) {
    const st = G.state.economy[settlementId];
    const def = G.WORLD.settlementById[settlementId];
    if (!st || !def) return 0;
    const base = G.MATERIALS[matId].price;
    const stock = st.stock[matId] || 0;
    const target = st.target[matId] || 0;
    if (target === 0 && stock === 0) return 0;
    const ratio = target > 0 ? stock / target : 1;
    const scarcity = G.clamp(2 - ratio, 0.45, 2.2);
    const spec = G.SETTLEMENT_SPECS[def.spec];
    const produces = spec.produces.includes(matId);
    const consumes = spec.consumes.includes(matId);
    const b = G.settlementBonuses ? G.settlementBonuses(settlementId) : { sellMult:1, buyMult:1 };
    const rep = G.repPriceMods ? G.repPriceMods(settlementId) : { buyMult:1, sellMult:1 };
    const srep = G.settlementRepMods(settlementId);
    const we = G.worldEventPriceMult ? G.worldEventPriceMult(matId, mode) : 1;
    const tm = G.timePriceMod ? G.timePriceMod(matId) : 1;
    const buyBonus = G.bestBuyBonus ? G.bestBuyBonus() : 1;
    const pol = G.politicalPriceMult ? G.politicalPriceMult(settlementId, matId) : 1;
    if (mode === 'buy') {
      let p = base * scarcity * 1.30;
      if (produces) p *= 0.60;
      if (consumes) p *= 1.40;
      p *= b.buyMult * rep.buyMult * srep.buyMult * we * tm * buyBonus * pol;
      return Math.max(1, Math.round(p));
    } else {
      let p = base * scarcity * 0.78;
      if (produces) p *= 0.70;
      if (consumes) p *= 1.35;
      p *= G.bestSellBonus() * b.sellMult * rep.sellMult * srep.sellMult * we * tm * pol;
      return Math.max(1, Math.round(p));
    }
  };

  G.settlementRepMods = function (settlementId) {
    const v = G.state.settlementRep[settlementId] || 0;
    if (v >= 80) return { buyMult:0.82, sellMult:1.18, tier:'spojenec' };
    if (v >= 40) return { buyMult:0.92, sellMult:1.10, tier:'přítel' };
    if (v >= 15) return { buyMult:0.97, sellMult:1.04, tier:'známý' };
    if (v >= -15) return { buyMult:1.00, sellMult:1.00, tier:'neutrální' };
    if (v >= -40) return { buyMult:1.08, sellMult:0.94, tier:'chladný' };
    return { buyMult:1.20, sellMult:0.85, tier:'nepřátelský' };
  };
  G.addSettlementRep = function (settlementId, delta) {
    if (!G.state.settlementRep) G.state.settlementRep = {};
    if (G.state.settlementRep[settlementId] == null) G.state.settlementRep[settlementId] = 0;
    const before = G.state.settlementRep[settlementId];
    G.state.settlementRep[settlementId] = G.clamp(before + delta, -100, 120);
    const bs = (before >= 40 ? 'přítel' : before >= 15 ? 'známý' : before >= -15 ? 'neutrální' : 'chladný');
    const as = (G.state.settlementRep[settlementId] >= 40 ? 'přítel' :
                G.state.settlementRep[settlementId] >= 15 ? 'známý' :
                G.state.settlementRep[settlementId] >= -15 ? 'neutrální' : 'chladný');
    if (bs !== as) {
      const s = G.WORLD.settlementById[settlementId];
      G.log(`🏘️ ${s ? s.name : settlementId}: vztah se změnil na ${as}.`, 'economy');
    }
  };

  G.buyMaterial = function (settlementId, matId, qty) {
    const st = G.state.economy[settlementId];
    if (!st) return { ok:false, reason:'Neznámé sídlo.' };
    qty = Math.max(1, Math.floor(qty));
    const have = st.stock[matId] || 0;
    if (have < qty) return { ok:false, reason:`Sídlo má jen ${Math.floor(have)} ks.` };
    const unitPrice = G.priceAt(settlementId, matId, 'buy');
    const total = unitPrice * qty;
    if (G.state.resources.gold < total) return { ok:false, reason:`Potřebuješ ${total} zlata.` };
    G.state.resources.gold -= total;
    G.state.stats.goldSpent = (G.state.stats.goldSpent || 0) + total;
    st.stock[matId] = have - qty;
    st.gold += Math.round(total * 0.9);
    const q = rollPurchaseQuality(settlementId);
    G.matAdd(matId, qty, q);
    if (G.repForTrade) G.repForTrade(settlementId, 'buy', qty);
    G.addSettlementRep(settlementId, 0.02 * qty);
    G.log(`🛒 Koupil jsi ${qty}× ${G.MATERIALS[matId].name} za ${total} zlata.`, 'economy');
    return { ok:true, total, quality:q };
  };

  G.sellMaterial = function (settlementId, matId, qty) {
    const st = G.state.economy[settlementId];
    if (!st) return { ok:false, reason:'Neznámé sídlo.' };
    qty = Math.max(1, Math.floor(qty));
    const have = G.matCount(matId);
    if (have < qty) return { ok:false, reason:`Máš jen ${have} ks.` };
    const unitPrice = G.priceAt(settlementId, matId, 'sell');
    const total = unitPrice * qty;
    if (st.gold < total) return { ok:false, reason:`Sídlo má jen ${Math.floor(st.gold)} zlata.` };
    G.matRemove(matId, qty);
    G.state.resources.gold += total;
    G.state.stats.goldEarned = (G.state.stats.goldEarned || 0) + total;
    st.stock[matId] = (st.stock[matId] || 0) + qty;
    st.gold -= total;
    if (G.repForTrade) G.repForTrade(settlementId, 'sell', qty);
    G.addSettlementRep(settlementId, 0.04 * qty);
    G.log(`💰 Prodalo se ${qty}× ${G.MATERIALS[matId].name} za ${total} zlata.`, 'economy');
    return { ok:true, total };
  };

  function rollPurchaseQuality(settlementId) {
    const def = G.WORLD.settlementById[settlementId];
    const bonus = def && def.size === 'city' ? 0.25 : def && def.size === 'town' ? 0.15 : 0.05;
    const r = G.rand();
    if (r < 0.04 + bonus) return 'fine';
    if (r < 0.10 + bonus) return 'crude';
    return 'common';
  }

  let ecoTimer = 0;
  const ECO_STEP = 5;
  G.tickEconomy = function (dt) {
    ecoTimer += dt;
    if (ecoTimer < ECO_STEP) return;
    const step = ecoTimer; ecoTimer = 0;
    for (const sid in G.state.economy) {
      const st = G.state.economy[sid];
      const def = G.WORLD.settlementById[sid];
      if (!def) continue;
      const spec = G.SETTLEMENT_SPECS[def.spec];
      const sizeDef = G.SETTLEMENT_SIZE[def.size];
      const b = G.settlementBonuses ? G.settlementBonuses(sid) : { stockMult:1 };
      for (const mid in st.target) {
        const baseTarget = st.target[mid];
        if (baseTarget <= 0) continue;
        const t = baseTarget * b.stockMult;
        const cur = st.stock[mid] || 0;
        let rate = 0.010;
        if (spec.produces.includes(mid)) rate = 0.030;
        else if (spec.consumes.includes(mid)) rate = 0.018;
        st.stock[mid] = cur + (t - cur) * rate * step;
      }
      const gt = st.goldTarget || sizeDef.goldBase;
      st.gold += (gt - st.gold) * 0.004 * step;
      if (st.gold < 0) st.gold = 0;
    }
  };

  G.settlementMarket = function (settlementId) {
    const st = G.state.economy[settlementId];
    if (!st) return [];
    return G.TRADED
      .filter(mid => (st.target[mid] || 0) > 0)
      .sort((a, b) => G.MATERIALS[a].tier - G.MATERIALS[b].tier
                   || G.MATERIALS[a].name.localeCompare(G.MATERIALS[b].name));
  };

  G.getRep = function (factionId) {
    if (!G.state.reputation) G.state.reputation = {};
    return G.state.reputation[factionId] || 0;
  };
  G.addRep = function (factionId, delta) {
    if (!G.state.reputation) G.state.reputation = {};
    const before = G.getRep(factionId);
    const after = G.clamp(before + delta, -100, 150);
    G.state.reputation[factionId] = after;
    const oldTier = G.repTier(before), newTier = G.repTier(after);
    if (oldTier.id !== newTier.id) {
      const f = G.FACTIONS[factionId];
      if (f) {
        if (after > before) G.log(`${f.icon} ${f.name}: ${newTier.name}!`, 'politics');
        else G.log(`${f.icon} ${f.name}: reputace klesla na ${newTier.name}.`, 'politics');
      }
    }
  };

  G.repForTrade = function (settlementId, direction, qty) {
    const facId = G.SETTLEMENT_FACTION[settlementId];
    if (!facId) return;
    const perUnit = direction === 'sell' ? G.REP_PER_SALE_UNIT : G.REP_PER_PURCHASE_UNIT;
    const gain = perUnit * Math.sqrt(qty) * 2;
    G.addRep(facId, gain);
    const fac = G.FACTIONS[facId];
    if (fac && fac.rivals) for (const r of fac.rivals) G.addRep(r, -gain * G.REP_RIVAL_PENALTY);
  };
  G.repPriceMods = function (settlementId) {
    const facId = G.SETTLEMENT_FACTION[settlementId];
    if (!facId) return { buyMult:1, sellMult:1, tier: G.repTier(0), rep: 0 };
    const rep = G.getRep(facId);
    const tier = G.repTier(rep);
    return { buyMult: tier.buyMult, sellMult: tier.sellMult, tier, rep };
  };
  G.reputationSummary = function () {
    const out = [];
    for (const fid in G.FACTIONS) out.push({ faction: G.FACTIONS[fid], value: G.getRep(fid), tier: G.repTier(G.getRep(fid)) });
    return out;
  };
})();
