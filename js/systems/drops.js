(function () {
  const G = window.Game;

  G.rollActivityDrops = function (act, units) {
    if (!act.drops) return;
    for (const matId in act.drops) {
      const [baseChance, minQ, maxQ] = act.drops[matId];
      let chance = baseChance;
      for (const u of units) chance *= (1 + (u.attrs.luk - 10) * 0.005);
      chance /= units.length;
      if (!G.chance(chance)) continue;
      const qty = G.randInt(minQ, maxQ);
      const q = matId === 'coin' || matId === 'jewel' ? 'common' : (G.chance(0.15) ? 'fine' : 'common');
      G.matAdd(matId, qty, q);
      if (matId !== 'coin' || qty >= 5) {
        G.log(`✨ Nález: ${qty}× ${G.MATERIALS[matId].icon} ${G.MATERIALS[matId].name}.`);
      }
    }
  };

  G.describeDrop = function (matId, qty) {
    const m = G.MATERIALS[matId];
    if (!m) return `${qty}× neznámý`;
    return `${qty}× ${m.icon} ${m.name}`;
  };

  G.lootValue = function (dropList) {
    let sum = 0;
    for (const d of dropList) {
      if (d.material === 'coin') sum += d.qty;
      else sum += d.qty * (G.MATERIALS[d.material] ? G.MATERIALS[d.material].price : 0);
    }
    return sum;
  };
})();
