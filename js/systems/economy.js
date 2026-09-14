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

  /**
   * FIX-v4 (E4): soft cap na stack multiplikátorů.
   * Předtím se mohly násobit bez limitu (zimní válka + isolationisté
   * + nulová reputace = až 10× base price). Nyní 0.30–4.0×.
   */
  const MULT_MIN = 0.30;
  const MULT_MAX = 4.00;

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
      const stack = b.buyMult * rep.buyMult * srep.buyMult * we * tm * buyBonus * pol;
      p *= G.clamp(stack, MULT_MIN, MULT_MAX);
      return Math.max(1, Math.round(p));
    } else {
      let p = base * scarcity * 0.78;
      if (produces) p *= 0.70;
      if (consumes) p *= 1.35;
      const stack = G.bestSellBonus() * b.sellMult * rep.sellMult * srep.sellMult * we * tm * pol;
      p *= G.clamp(stack, MULT_MIN, MULT_MAX);
      return Math.max(1, Math.round(p));
   
