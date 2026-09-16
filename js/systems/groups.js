(function () {
  const G = window.Game;
  let groupIdSeq = 1;
  G.setGroupIdSeq = function (v) { groupIdSeq = v; };

  G.ROLES = {
    leader:   { id:'leader',   name:'Vůdce',      icon:'👑', desc:'+10 % produktivita skupiny' },
    quarter:  { id:'quarter',  name:'Zásobovač',  icon:'📦', desc:'−30 % spotřeba jídla' },
    medic:    { id:'medic',    name:'Ranhojič',   icon:'⚕️', desc:'Rychlejší hojení' },
    scout:    { id:'scout',    name:'Průzkumník', icon:'🧭', desc:'−25 % nebezpečí' },
    fighter:  { id:'fighter',  name:'Bojovník',   icon:'⚔️', desc:'+30 % bojová síla' },
    trader:   { id:'trader',   name:'Obchodník',  icon:'⚖️', desc:'Vede karavany' }
  };

  G.createGroup = function (name) {
    const g = {
      id:'g'+(groupIdSeq++), name: name || ('Skupina ' + groupIdSeq),
      memberIds:[], focus:null, roles:{}, supplies: { food: 0, tools: 0, medicine: 0 }
    };
    G.state.groups.push(g);
    return g;
  };
  /** Přejmenuje skupinu. Vrací { ok, reason }. */
  G.renameGroup = function (groupId, name) {
    const g = G.getGroup(groupId);
    if (!g) return { ok:false, reason:'Skupina neexistuje.' };
    const n = String(name || '').trim();
    if (!n) return { ok:false, reason:'Název nesmí být prázdný.' };
    if (n.length > 24) return { ok:false, reason:'Název je moc dlouhý (max 24 znaků).' };
    g.name = n;
    return { ok:true };
  };
  G.getGroup = function (id) { return G.state.groups.find(g => g.id === id) || null; };
  G.getUnit = function (id) { return G.state.units.find(u => u.id === id) || null; };
  G.groupMembers = function (g) { if (!g) return []; return g.memberIds.map(id => G.getUnit(id)).filter(Boolean); };

  G.addUnitToGroup = function (unitId, groupId) {
    const u = G.getUnit(unitId), g = G.getGroup(groupId);
    if (!u || !g) return;
    if (u.groupId) {
      const prev = G.getGroup(u.groupId);
      if (prev) prev.memberIds = prev.memberIds.filter(x => x !== unitId);
    }
    u.groupId = groupId;
    if (!g.memberIds.includes(unitId)) g.memberIds.push(unitId);
  };
  G.removeUnitFromGroup = function (unitId) {
    const u = G.getUnit(unitId);
    if (!u || !u.groupId) return;
    const g = G.getGroup(u.groupId);
    if (g) g.memberIds = g.memberIds.filter(x => x !== unitId);
    u.groupId = null;
  };

  G.groupChemistry = function (g) {
    const members = G.groupMembers(g);
    if (members.length < 2) return { value: 0, label:'—', color:'#8d8570' };
    let total = 0, pairs = 0;
    for (let i = 0; i < members.length; i++) for (let j = i + 1; j < members.length; j++) {
      const rel = (members[i].relationships || {})[members[j].id] || 0;
      total += rel; pairs++;
    }
    const avg = pairs > 0 ? total / pairs : 0;
    let label, color;
    if (avg >= 40) { label = 'Harmonie'; color = '#8fbf7a'; }
    else if (avg >= 10) { label = 'Přátelská'; color = '#9ed48c'; }
    else if (avg >= -10) { label = 'Neutrální'; color = '#9c937c'; }
    else if (avg >= -40) { label = 'Napětí'; color = '#e0bb5e'; }
    else { label = 'Rozpad'; color = '#c05a45'; }
    return { value: avg, label, color };
  };

  G.autoAssignRoles = function (g) {
    const members = G.groupMembers(g);
    if (!members.length) { g.roles = {}; return; }
    const scores = {
      leader:  (u) => u.attrs.int * 0.5 + G.unitSkill(u, 'trading') * 2 + G.unitSkill(u, 'combat'),
      quarter: (u) => u.attrs.int + G.unitSkill(u, 'cooking') * 2,
      medic:   (u) => u.attrs.int + G.unitSkill(u, 'herbalism') * 2 + G.unitSkill(u, 'alchemy'),
      scout:   (u) => u.attrs.agi + G.unitSkill(u, 'scouting') * 2,
      fighter: (u) => u.attrs.str + G.unitSkill(u, 'combat') * 2
    };
    const assigned = new Set();
    g.roles = {};
    for (const roleId of ['leader','fighter','medic','scout','quarter']) {
      let best = null, bestScore = 0;
      for (const u of members) {
        if (assigned.has(u.id)) continue;
        const sc = scores[roleId](u);
        if (sc > bestScore) { bestScore = sc; best = u; }
      }
      if (best) { g.roles[roleId] = best.id; best.role = roleId; assigned.add(best.id); }
    }
  };

  G.groupRoleBonus = function (g, roleId) {
    if (!g.roles || !g.roles[roleId]) return null;
    return G.getUnit(g.roles[roleId]);
  };

  G.groupWorkMult = function (g) {
    let m = 1;
    const leader = G.groupRoleBonus(g, 'leader');
    if (leader) m *= 1.10;
    const ch = G.groupChemistry(g);
    if (ch.value >= 40) m *= 1.12;
    else if (ch.value >= 10) m *= 1.05;
    else if (ch.value <= -40) m *= 0.85;
    else if (ch.value <= -10) m *= 0.95;
    return m;
  };
  G.groupCombatMult = function (g) {
    let m = 1;
    const fighter = G.groupRoleBonus(g, 'fighter');
    if (fighter) m *= 1.30;
    const ch = G.groupChemistry(g);
    if (ch.value >= 40) m *= 1.10;
    else if (ch.value <= -40) m *= 0.85;
    return m;
  };
  G.groupFoodCostMult = function (g) {
    const q = G.groupRoleBonus(g, 'quarter');
    return q ? 0.70 : 1.0;
  };
  G.groupSafetyMult = function (g) {
    const s = G.groupRoleBonus(g, 'scout');
    return s ? 0.75 : 1.0;
  };
  G.groupHealMult = function (g) {
    const m = G.groupRoleBonus(g, 'medic');
    return m ? 1.50 : 1.0;
  };
})();
