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
    if (best
