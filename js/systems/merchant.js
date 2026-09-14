(function () {
  const G = window.Game;
  G.MERCHANT_SELL_THRESHOLD = 20;
  G.MERCHANT_KEEP_MIN = 10; // FIX-v4 (E9): rezerva — obchodník nikdy nevyprodá pod tuto mez (chrání domácí zásoby)

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

  /**
   * FIX-v4 (E7): při ukončení obchodníka ho odeber ze skupiny "Karavany".
   * Předtím zůstal ve skupině navždy → při opětovném nasazení byl ve skupině 2×.
   */
  G.clearMerchant = function (unitId) {
    const u = G.getUnit(unitId);
    if (!u) return;
    u.role = null; u.merchantRoute = null; u.merchantState = null;
    if (u.assignedTaskId) G.cancelTask(u.assignedTaskId);
    if (u.groupId) {
      const g = G.getGroup(u.groupId);
      if (g && g.name === 'Karavany') G.removeUnitFromGroup(u.id);
    }
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
      const dist = Math.hypot
