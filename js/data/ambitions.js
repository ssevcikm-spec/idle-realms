(function () {
  const G = window.Game;

  /**
   * Ambice = osobní cíle postavy. Generují se při vzniku a v průběhu hry.
   * Splněním získá postava velký bonus (XP, perk bod, trvalá vlastnost).
   */

  G.AMBITION_POOL = [
    { id:'master_woodcutter', text:'Stát se nejlepším dřevařem v zemi',
      check: (u) => G.unitSkill(u, 'woodcutting') >= 20,
      reward: { xp: 500, trait: 'diligent' }, icon:'🪓' },
    { id:'master_miner', text:'Stát se nejlepším horníkem',
      check: (u) => G.unitSkill(u, 'mining') >= 20,
      reward: { xp: 500, trait: 'sturdy' }, icon:'⛏️' },
    { id:'master_smith', text:'Stát se mistrem kovářem',
      check: (u) => G.unitSkill(u, 'smithing') >= 20,
      reward: { xp: 700, trait: 'diligent' }, icon:'🔨' },
    { id:'master_herb', text:'Stát se největším znalcem bylin',
      check: (u) => G.unitSkill(u, 'herbalism') >= 20,
      reward: { xp: 500, trait: 'curious' }, icon:'🌿' },
    { id:'master_hunter', text:'Stát se obávaným lovcem',
      check: (u) => G.unitSkill(u, 'hunting') >= 20,
      reward: { xp: 600, trait: 'brave' }, icon:'🏹' },
    { id:'master_trader', text:'Stát se nejbohatším kupcem',
      check: (u) => G.unitSkill(u, 'trading') >= 20,
      reward: { xp: 700, trait: 'merchant' }, icon:'⚖️' },
    { id:'rich_1000', text:'Nashromáždit 1000 zlata',
      check: () => G.state.resources.gold >= 1000,
      reward: { xp: 300, mood: 15 }, icon:'🪙' },
    { id:'warrior_10', text:'Vyhrát 10 soubojů',
      check: (u) => (u._combatWins || 0) >= 10,
      reward: { xp: 800, trait: 'brave' }, icon:'⚔️' },
    { id:'survivor', text:'Přežít 5 zranění',
      check: (u) => (u._injuriesHealed || 0) >= 5,
      reward: { xp: 400, trait: 'sturdy' }, icon:'🩹' },
    { id:'leader', text:'Vést skupinu 5 postav',
      check: (u) => {
        if (!u.groupId) return false;
        const g = G.getGroup(u.groupId);
        if (!g) return false;
        return g.roles && g.roles.leader === u.id && g.memberIds.length >= 5;
      },
      reward: { xp: 600, trait: 'brave' }, icon:'👑' },
    { id:'explorer', text:'Navštívit všechny regiony',
      check: (u) => (G.state.stats.settlementsVisited || []).length >= 6,
      reward: { xp: 500, trait: 'curious' }, icon:'🗺️' },
    { id:'dragon_slayer', text:'Zabít draka Ohnivce',
      check: (u) => (G.state.stats.dragonsKilled || 0) >= 1,
      reward: { xp: 2000, trait: 'brave', renown: 20 }, icon:'🐉' },
    { id:'friend_maker', text:'Získat 3 blízké přátele',
      check: (u) => {
        let n = 0;
        for (const id in (u.relationships || {})) {
          if (u.relationships[id] >= 60) n++;
        }
        return n >= 3;
      },
      reward: { xp: 400, trait: 'loyal' }, icon:'❤️' },
    { id:'self_sufficient', text:'Postavit všechny budovy základny',
      check: () => {
        if (!G.state.base || !G.state.base.unlocked) return false;
        for (const bid in G.BASE_BUILDINGS) {
          if ((G.state.base.buildings[bid] || 0) < 1) return false;
        }
        return true;
      },
      reward: { xp: 800, renown: 10 }, icon:'🏕️' },
    { id:'quest_master', text:'Splnit 10 zakázek',
      check: () => (G.state.stats.questsCompleted || 0) >= 10,
      reward: { xp: 600, trait: 'diligent' }, icon:'📜' }
  ];

  /** Vygeneruj 1–3 ambice pro novou postavu. */
  G.rollAmbitions = function () {
    const pool = G.AMBITION_POOL.slice();
    const out = [];
    const n = G.randInt(1, 3);
    for (let i = 0; i < n && pool.length; i++) {
      const idx = G.randInt(0, pool.length - 1);
      out.push({
        id: pool[idx].id,
        assignedAt: G.state ? G.state.time : 0,
        done: false
      });
      pool.splice(idx, 1);
    }
    return out;
  };

  G.getAmbitionDef = function (id) {
    return G.AMBITION_POOL.find(a => a.id === id) || null;
  };

  /** Zkontroluj, jestli postava splnila nějaké ambice. */
  G.checkAmbitions = function (unit) {
    if (!unit.ambitions) return;
    for (const a of unit.ambitions) {
      if (a.done) continue;
      const def = G.getAmbitionDef(a.id);
      if (!def) continue;
      let ok = false;
      try { ok = def.check(unit); } catch (e) { ok = false; }
      if (!ok) continue;
      a.done = true;
      a.doneAt = G.state.time;
      // odměny
      const rw = def.reward || {};
      if (rw.xp) G.addUnitXp(unit, rw.xp);
      if (rw.renown) G.state.resources.renown += rw.renown;
      if (rw.mood) G.addMood(unit, rw.mood);
      if (rw.trait && !unit.traits.some(t => t.id === rw.trait)) {
        // najdi v poolu a přidej
        const traitDef = G.TRAIT_POOL.find(t => t.id === rw.trait);
        if (traitDef) unit.traits.push(traitDef);
      }
      G.log(`🎯 ${unit.name} splnil ambici: ${def.text}`);
      G.addMood(unit, 10);
    }
  };

  /** Periodická kontrola ambicí všech postav (voláno z autonomy). */
  G.tickAmbitions = function () {
    if (!G.state || !G.state.units) return;
    for (const u of G.state.units) G.checkAmbitions(u);
  };
})();
