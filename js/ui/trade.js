(function () {
  const G = window.Game;
  let tradeTab = 'market';
  G.setTradeTab = function (t) { tradeTab = t; };

  G.panelTrade = function (settlementId) {
    const def = G.WORLD.settlementById[settlementId];
    const st = G.state.economy[settlementId];
    if (!def || !st) return `<div class="empty">Sídlo nenalezeno.</div>`;
    const sizeDef = G.SETTLEMENT_SIZE[def.size];
    const spec = G.SETTLEMENT_SPECS[def.spec];
    const bonuses = G.settlementBonuses(settlementId);
    const facId = G.SETTLEMENT_FACTION[settlementId];
    const fac = facId ? G.FACTIONS[facId] : null;
    const repInfo = G.repPriceMods(settlementId);
    const srep = (G.state.settlementRep && G.state.settlementRep[settlementId]) || 0;
    const srepMods = G.settlementRepMods(settlementId);
    const workshops = G.workshopsInSettlement(settlementId);
    const polMods = G.politicsMods ? G.politicsMods(facId) : null;
    const facLine = fac ? `<div class="loc-sub" style="color:
