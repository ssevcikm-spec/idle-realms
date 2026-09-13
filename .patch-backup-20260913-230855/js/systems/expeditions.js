(function () {
  const G = window.Game;

  G.expeditionList = function () { return G.state.expeditions || []; };
  G.EXPEDITION_FOOD_PER_UNIT_PER_DAY = 0.5;
  function foodNeededFor(days, partySize) { return Math.ceil(days * partySize * G.EXPEDITION_FOOD_PER_UNIT_PER_DAY); }
  function availableFood() { return G.matCount('bread') + G.matCount('fish'); }
  function consumeFood(amount) {
    let remaining = amount;
    for (const mat of ['bread', 'fish']) { if (remaining <= 0) break; const have = G.matCount(mat); const take = Math.min(have, remaining); if (take > 0) { G.matRemove(mat, take); remaining -= take; } }
    return remaining === 0;
  }
  G.expeditionFoodCost = function (expeditionId, partySize) {
    const tpl = G.EXPEDITIONS[expeditionId]; if (!tpl) return 0;
    const avgDays = (tpl.minDays + tpl.maxDays) / 2;
    return foodNeededFor(avgDays, partySize);
  };

  G.startExpedition = function (expeditionId, unitIds) {
    const tpl = G.EXPEDITIONS[expeditionId];
    if (!tpl) return { ok:false, reason:'Neznámá expedice.' };
    const units = unitIds.map(id => G.getUnit(id)).filter(u => u && !u.dead && !u.isChild);
    if (units.length < G.EXPEDITION_MIN_PARTY) return { ok:false, reason:`Potřebuješ alespoň ${G.EXPEDITION_MIN_PARTY} postavy.` };
    if (units.length > G.EXPEDITION_MAX_PARTY) return { ok:false, reason:`Maximálně ${G.EXPEDITION_MAX_PARTY} postav.` };
    if (!G.state.expeditions) G.state.expeditions = [];
    const busy = new Set();
    for (const e of G.state.expeditions) for (const id of e.unitIds) busy.add(id);
    for (const u of units) if (busy.has(u.id)) return { ok:false, reason:`${u.name} už je na expedici.` };
    const days = tpl.minDays + G.randInt(0, tpl.maxDays - tpl.minDays);
    const duration = days * G.TIME.dayLength;
    const foodCost = foodNeededFor(days, units.length);
    if (availableFood() < foodCost) return { ok:false, reason:`Potřebuješ ${foodCost}× jídlo na cestu, máš ${availableFood()}.` };
    const power = units.reduce((s, u) => s + G.unitCombatPower(u) + G.unitSkill(u, 'scouting') * 3, 0);
    const need = tpl.difficulty * 30;
    consumeFood(foodCost);
    const exp = {
      id: 'ex' + Date.now() + '_' + G.randInt(0, 999),
      templateId: expeditionId, unitIds: unitIds.slice(),
      startedAt: G.state.time, endsAt: G.state.time + duration,
      days: days, power: Math.round(power), need: Math.round(need),
      foodCost: foodCost, outcome: null, events: []
    };
    for (const u of units) {
      if (u.assignedTaskId) G.cancelTask(u.assignedTaskId);
      u.onExpedition = true; u.expeditionId = exp.id;
      u.stamina = Math.max(20, Math.floor(u.stamina * 0.7));
      G.removeUnitFromGroup(u.id);
      if (G.addJournal) G.addJournal(u, `Vyrazil na expedici "${tpl.name}" (${days} dní).`, '⛵');
    }
    // Naplánuj eventy na cestě
    if (G.EXPEDITION_EVENTS && G.chance(G.EXPEDITION_EVENT_CHANCE)) {
      const ev = G.pick(G.EXPEDITION_EVENTS);
      exp.events.push({ tpl: ev.id, at: G.state.time + duration * 0.5 });
    }
    G.state.expeditions.push(exp);
    G.state.stats.expeditions = (G.state.stats.expeditions || 0) + 1;
    G.log(`⛵ ${tpl.icon} Expedice "${tpl.name}" začala (${days} dní, ${units.length} postav, ${foodCost} jídla).`, 'story');
    return { ok:true, expedition: exp };
  };

  G.tickExpeditions = function (dt) {
    if (!G.state.expeditions) return;
    for (const exp of G.state.expeditions.slice()) {
      // Zpracuj eventy na cestě
      if (exp.events && exp.events.length) {
        for (const ev of exp.events.slice()) {
          if (G.state.time >= ev.at && !ev.resolved) {
            ev.resolved = true;
            resolveExpeditionEvent(exp, ev.tpl);
          }
        }
      }
      if (!exp.outcome && G.state.time >= exp.endsAt) resolveExpedition(exp);
    }
    G.state.expeditions = G.state.expeditions.filter(e => !e.cleanupAt || G.state.time < e.cleanupAt);
  };

  function resolveExpeditionEvent(exp, eventId) {
    const ev = G.EXPEDITION_EVENTS.find(e => e.id === eventId);
    if (!ev) return;
    const units = exp.unitIds.map(id => G.getUnit(id)).filter(u => u && !u.dead);
    if (!units.length) return;
    G.log(`🎲 ${ev.icon} Na cestě: ${ev.text}`, 'story');
    switch (ev.outcome) {
      case 'loot':
        for (const l of ev.loot) {
          if (!G.chance(l.chance)) continue;
          const q = G.randInt(l.min, l.max);
          G.matAdd(l.material, q, 'common');
        }
        break;
      case 'loss':
        for (const l of ev.loss) G.matRemove(l.material, l.qty);
        break;
      case 'shorten':
        exp.endsAt = Math.max(exp.startedAt + 60, exp.endsAt - ev.days * G.TIME.dayLength);
        break;
      case 'lengthen':
        exp.endsAt += ev.days * G.TIME.dayLength;
        break;
      case 'injury':
        if (G.chance(0.4)) { const u = G.pick(units); G.addInjury(u, G.rollInjury(2)); }
        break;
      case 'mood':
        for (const u of units) G.addMood(u, ev.value);
        break;
      case 'xp':
        for (const u of units) G.addUnitXp(u, ev.value);
        break;
      case 'renown':
        G.state.resources.renown += ev.value;
        break;
      case 'heal':
        for (const u of units) u.mood = Math.min(100, u.mood + 5);
        break;
    }
    exp.events.push({ resolved:true });
  }

  function resolveExpedition(exp) {
    const tpl = G.EXPEDITIONS[exp.templateId];
    if (!tpl) { exp.outcome = 'failure'; exp.cleanupAt = G.state.time + 60; return; }
    const units = exp.unitIds.map(id => G.getUnit(id)).filter(u => u && !u.dead);
    if (!units.length) { exp.outcome = 'failure'; exp.cleanupAt = G.state.time + 60; return; }
    const ratio = exp.power / Math.max(1, exp.need);
    const successChance = G.clamp(0.30 + ratio * 0.40, 0.20, 0.95);
    const success = G.chance(successChance);
    exp.outcome = success ? 'success' : 'failure';
    exp.resolvedAt = G.state.time;
    exp.successChance = successChance;
    if (success) {
      const drops = [];
      for (const r of tpl.rewardPool) {
        if (!G.chance(r.chance)) continue;
        const q = G.randInt(r.min, r.max);
        G.matAdd(r.material, q, 'common');
        drops.push(`${q}× ${G.MATERIALS[r.material] ? G.MATERIALS[r.material].icon : '💎'} ${G.MATERIALS[r.material] ? G.MATERIALS[r.material].name : r.material}`);
      }
      const renown = tpl.renownReward || 0;
      if (renown) G.state.resources.renown += renown;
      for (const u of units) {
        G.addUnitXp(u, tpl.xpReward || 50);
        G.addMood(u, 8);
        if (G.addJournal) G.addJournal(u, `Úspěšně dokončil expedici "${tpl.name}".`, '🏆');
      }
      if (units.length > 1 && G.onGroupSuccess) G.onGroupSuccess(units, 5);
      G.log(`🎉 ${tpl.successText} ${drops.join(', ')}`, 'story');
      G.state.stats.expeditionSuccesses = (G.state.stats.expeditionSuccesses || 0) + 1;
      exp.drops = drops;
    } else {
      for (const u of units) {
        G.addMood(u, -12);
        if (G.chance(0.15)) G.addInjury(u, G.rollInjury(tpl.difficulty));
        if (G.addJournal) G.addJournal(u, `Vrátil se z neúspěšné expedice "${tpl.name}".`, '💀');
      }
      G.log(`💀 ${tpl.failureText}`, 'story');
      exp.drops = [];
    }
    for (const u of units) {
      u.onExpedition = false; u.expeditionId = null; u.stamina = 30;
      const home = G.WORLD.settlementById['svitavy'];
      if (home) u.pos = { x: home.x + 0.5 + (G.rand() - 0.5) * 2, y: home.y + 0.5 + (G.rand() - 0.5) * 2 };
    }
    exp.cleanupAt = G.state.time + G.TIME.dayLength;
  }

  G.expeditionProgress = function (exp) {
    const total = exp.endsAt - exp.startedAt;
    if (total <= 0) return 1;
    return G.clamp((G.state.time - exp.startedAt) / total, 0, 1);
  };
  G.unitsOnExpeditions = function () {
    if (!G.state.expeditions) return [];
    const ids = new Set();
    for (const e of G.state.expeditions) for (const id of e.unitIds) ids.add(id);
    return Array.from(ids).map(id => G.getUnit(id)).filter(Boolean);
  };
  G.availableForExpedition = function () {
    const busy = new Set();
    for (const e of (G.state.expeditions || [])) for (const id of e.unitIds) busy.add(id);
    return G.state.units.filter(u => u && !u.dead && !u.isChild && !busy.has(id => busy.has(u.id)) && !busy.has(u.id));
  };
})();
