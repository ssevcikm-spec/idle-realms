(function () {
  const G = window.Game;
  G.MERCHANT_SELL_THRESHOLD = 20;
  G.MERCHANT_KEEP_MIN = 10;

  G.setMerchant = function (unitId, route) {
    const u = G.getUnit(unitId);
    if (!u) return { ok:false, reason:'Postava nenalezena.' };
    if (route && route.length < 2) return { ok:false, reason:'Trasa musí mít alespoň 2 sídla.' };
    u.role = 'trader';
    u.merchantRoute = route && route.length ? route.slice() : null;
    u.merchantState = {
      active: true, currentIdx: 0, progress: 0,
      fromId: route && route.length ? route[0] : null,
      toId: route && route.length > 1 ? route[1] : null,
      lastTrade: null, totalTrades: 0, totalGold: 0
    };
    let g = G.state.groups.find(x => x.name === 'Karavany');
    if (!g) g = G.createGroup('Karavany');
    G.addUnitToGroup(u.id, g.id);
    G.log(`🐎 ${u.name} se stal obchodníkem. Trasa: ${route && route.length ? route.map(id => G.WORLD.settlementById[id].name).join(' → ') : 'neurčena'}.`);
    return { ok:true };
  };

  G.clearMerchant = function (unitId) {
    const u = G.getUnit(unitId);
    if (!u) return;
    u.role = null; u.merchantRoute = null; u.merchantState = null;
    if (u.assignedTaskId) G.cancelTask(u.assignedTaskId);
    G.log(`🛑 ${u.name} už není obchodník.`);
    return { ok:true };
  };

  G.autoMerchantRoute = function () {
    return G.WORLD.settlements.filter(s => s.size === 'city' || s.size === 'town').map(s => s.id);
  };

  let merchantTimer = 0;
  G.tickMerchants = function (dt) {
    merchantTimer += dt;
    if (merchantTimer < 1) return;
    const step = merchantTimer; merchantTimer = 0;
    for (const u of G.state.units) {
      if (!u.merchantState || !u.merchantState.active) continue;
      if (!u.merchantRoute || u.merchantRoute.length < 2) continue;
      const st = u.merchantState;
      const from = G.WORLD.settlementById[st.fromId];
      const to = G.WORLD.settlementById[st.toId];
      if (!from || !to) { advanceRoute(u); continue; }
      const dist = Math.hypot(to.x - from.x, to.y - from.y) || 1;
      const skill = G.unitSkill(u, 'trading');
      const speed = (0.4 + skill * 0.05);
      st.progress += (speed / dist) * step;
      u.pos = {
        x: from.x + 0.5 + (to.x - from.x) * st.progress,
        y: from.y + 0.5 + (to.y - from.y) * st.progress
      };
      if (st.progress >= 1) {
        arriveAtSettlement(u, st.toId);
        advanceRoute(u);
      }
    }
  };

  function advanceRoute(u) {
    const st = u.merchantState;
    if (!st || !u.merchantRoute) return;
    st.currentIdx = (st.currentIdx + 1) % u.merchantRoute.length;
    st.fromId = u.merchantRoute[st.currentIdx];
    st.toId = u.merchantRoute[(st.currentIdx + 1) % u.merchantRoute.length];
    st.progress = 0;
  }

  function arriveAtSettlement(u, settlementId) {
    const st = u.merchantState;
    const sid = settlementId;
    const stx = G.state.economy[sid];
    if (!stx) return;
    const settlement = G.WORLD.settlementById[sid];

    let soldGold = 0;
    const sellList = [];
    for (const mid of G.TRADED) {
      const have = G.matCount(mid);
      const target = stx.target[mid] || 0;
      if (target <= 0) continue;
      const surplus = have - G.MERCHANT_KEEP_MIN;
      if (surplus <= 0) continue;
      const spec = G.SETTLEMENT_SPECS[settlement.spec];
      let toSell = Math.min(surplus, Math.ceil(G.MERCHANT_SELL_THRESHOLD * 0.5));
      if (spec.produces.includes(mid)) toSell = Math.floor(toSell * 0.3);
      if (toSell <= 0) continue;
      const price = G.priceAt(sid, mid, 'sell');
      if (price <= 0) continue;
      const canBuy = Math.floor(stx.gold / price);
      const qty = Math.min(toSell, canBuy);
      if (qty <= 0) continue;
      G.matRemove(mid, qty);
      const gold = qty * price;
      G.state.resources.gold += gold;
      G.state.stats.goldEarned = (G.state.stats.goldEarned || 0) + gold;
      stx.stock[mid] = (stx.stock[mid] || 0) + qty;
      stx.gold -= gold;
      soldGold += gold;
      sellList.push(`${qty}× ${G.MATERIALS[mid].icon}`);
      G.addSettlementRep(sid, 0.04 * qty);
      if (G.repForTrade) G.repForTrade(sid, 'sell', Math.min(qty, 5));
    }

    const buyList = [];
    let boughtGold = 0;
    const needs = [];
    for (const mid of G.TRADED) {
      const have = G.matCount(mid);
      const target = stx.target[mid] || 0;
      if (target <= 0) continue;
      const stock = stx.stock[mid] || 0;
      if (stock < 5) continue;
      if (have >= 40) continue;
      const price = G.priceAt(sid, mid, 'buy');
      if (price <= 0) continue;
      const need = Math.max(0, 40 - have);
      const wantQty = Math.min(need, 10, Math.floor(stock * 0.5));
      if (wantQty <= 0) continue;
      const spec = G.SETTLEMENT_SPECS[settlement.spec];
      const localCheap = spec.produces.includes(mid);
      if (!localCheap && price > G.MATERIALS[mid].price * 1.4) continue;
      needs.push({ mid, qty: wantQty, price, priority: localCheap ? 2 : 1 });
    }
    needs.sort((a, b) => b.priority - a.priority);
    const budget = Math.min(G.state.resources.gold * 0.3, 500);
    let spent = 0;
    for (const n of needs) {
      const cost = n.price * n.qty;
      if (spent + cost > budget) continue;
      if (G.state.resources.gold < cost) continue;
      G.matAdd(n.mid, n.qty, 'common');
      G.state.resources.gold -= cost;
      G.state.stats.goldSpent = (G.state.stats.goldSpent || 0) + cost;
      stx.stock[n.mid] = Math.max(0, (stx.stock[n.mid] || 0) - n.qty);
      stx.gold += cost;
      spent += cost;
      boughtGold += cost;
      buyList.push(`${n.qty}× ${G.MATERIALS[n.mid].icon}`);
      G.addSettlementRep(sid, 0.02 * n.qty);
      if (G.repForTrade) G.repForTrade(sid, 'buy', Math.min(n.qty, 5));
    }

    const xpGain = 4 + Math.floor((soldGold + boughtGold) / 20);
    G.addSkillXp(u, 'trading', xpGain);
    G.addUnitXp(u, xpGain * 0.6);
    G.addMood(u, 3);
    G.state.stats.merchantTrades = (G.state.stats.merchantTrades || 0) + 1;
    G.state.stats.merchantGoldEarned = (G.state.stats.merchantGoldEarned || 0) + soldGold;

    if (sellList.length || buyList.length) {
      const parts = [];
      if (sellList.length) parts.push(`prodal ${sellList.join(', ')} za ${soldGold} 🪙`);
      if (buyList.length) parts.push(`koupil ${buyList.join(', ')} za ${boughtGold} 🪙`);
      G.log(`🐎 ${u.name} v ${settlement.name}: ${parts.join(', ')}.`);
    }
    st.lastTrade = { settlementId: sid, sold:soldGold, bought:boughtGold, time: G.state.time };
    st.totalTrades = (st.totalTrades || 0) + 1;
    st.totalGold = (st.totalGold || 0) + soldGold - boughtGold;
  }

  G.merchantInstantTrade = function (unitId) {
    const u = G.getUnit(unitId);
    if (!u || !u.merchantState) return { ok:false, reason:'Není obchodník.' };
    const st = u.merchantState;
    if (!st.toId) return { ok:false, reason:'Žádné cílové sídlo.' };
    arriveAtSettlement(u, st.toId);
    return { ok:true };
  };

  G.merchantList = function () {
    return G.state.units.filter(u => u.merchantState && u.merchantState.active);
  };
})();
