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
  /**
   * Cena jídla na expedici. Když známe složení družiny (`unitIds`), uplatní se
   * role Zásobovač ze skupiny (−30 % jídla) — jinak se počítá základ.
   */
  G.expeditionFoodCost = function (expeditionId, partySize, unitIds) {
    const tpl = G.EXPEDITIONS[expeditionId]; if (!tpl) return 0;
    const avgDays = (tpl.minDays + tpl.maxDays) / 2;
    let cost = foodNeededFor(avgDays, partySize);
    if (unitIds && unitIds.length) {
      const units = unitIds.map(id => G.getUnit(id)).filter(Boolean);
      const mult = G.groupFoodMultFor ? G.groupFoodMultFor(units) : 1;
      if (mult !== 1) cost = Math.max(1, Math.round(cost * mult));
    }
    return cost;
  };

  /** Součet síly družiny na expedici (stejný vzorec jako při vyhodnocení). */
  G.expeditionPowerOf = function (units) {
    return (units || []).reduce((s, u) => s + (u ? G.unitCombatPower(u) + G.unitSkill(u, 'scouting') * 3 : 0), 0);
  };
  /** Jak silná družina je na tuhle expedici potřeba. */
  G.expeditionNeed = function (expeditionId) {
    const tpl = G.EXPEDITIONS[expeditionId];
    return tpl ? tpl.difficulty * 30 : 0;
  };
  /** Odhad šance na úspěch pro expedici + vybrané postavy (0.20–0.95). */
  G.expeditionChance = function (expeditionId, unitIds) {
    const units = (unitIds || []).map(id => G.getUnit(id)).filter(u => u && !u.dead);
    if (!units.length) return 0.20;
    const ratio = G.expeditionPowerOf(units) / Math.max(1, G.expeditionNeed(expeditionId));
    return G.clamp(0.30 + ratio * 0.40, 0.20, 0.95);
  };
  /**
   * Doporučená družina: nejsilnější postavy, ale jen tolik, kolik má smysl —
   * jakmile je šance dobrá, další postavy jen zbytečně spotřebují jídlo.
   */
  G.recommendExpeditionParty = function (expeditionId, units) {
    const pool = (units || []).slice().sort((a, b) => G.expeditionPowerOf([b]) - G.expeditionPowerOf([a]));
    const out = [];
    for (const u of pool) {
      if (out.length >= G.EXPEDITION_MAX_PARTY) break;
      out.push(u);
      if (out.length >= G.EXPEDITION_MIN_PARTY && G.expeditionChance(expeditionId, out.map(x => x.id)) >= 0.75) break;
    }
    return out;
  };
  /**
   * Koho vůbec jde na expedici nabídnout: ne mrtvé, ne děti, ne ty, kdo už jsou
   * pryč nebo obchodují. Odpočívající jde vzít taky (vzbudí se), pracující taky
   * (přeruší úkol) — na rozdíl od `G.availableForExpedition`, která vrací jen volné.
   */
  G.expeditionPickable = function () {
    const busy = new Set();
    for (const e of (G.state.expeditions || [])) for (const id of e.unitIds) busy.add(id);
    return G.state.units.filter(u => u && !u.dead && !u.isChild
      && !busy.has(u.id)
      && !u.onExpedition
      && !(u.merchantState && u.merchantState.active));
  };
  /** Je postava úplně volná (nic nedělá, neodpočívá, neobchoduje)? */
  G.expeditionUnitIsFree = function (u) {
    return !!(u && !u.dead && !u.isChild && !u.onExpedition && !u.resting && !u.assignedTaskId
      && !(u.merchantState && u.merchantState.active)
      && !(G.hasSevereInjury && G.hasSevereInjury(u)));
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
    let foodCost = foodNeededFor(days, units.length);
    const groupFoodMult = G.groupFoodMultFor ? G.groupFoodMultFor(units) : 1;
    if (groupFoodMult !== 1) foodCost = Math.max(1, Math.round(foodCost * groupFoodMult));
    if (availableFood() < foodCost) return { ok:false, reason:`Potřebuješ ${foodCost}× jídlo na cestu, máš ${availableFood()}.` };
    const power = G.expeditionPowerOf(units);
    const need = G.expeditionNeed(expeditionId);
    consumeFood(foodCost);
    const exp = {
      id: 'ex' + Date.now() + '_' + G.randInt(0, 999),
      templateId: expeditionId, unitIds: unitIds.slice(),
      startedAt: G.state.time, endsAt: G.state.time + duration,
      days: days, power: Math.round(power), need: Math.round(need),
      foodCost: foodCost, outcome: null, events: []
    };
    const groups = new Set();
    for (const u of units) {
      if (u.assignedTaskId) G.cancelTask(u.assignedTaskId);
      if (u.resting && G.wakeUnit) G.wakeUnit(u);   // odpočívající jde taky, jen se vzbudí
      u.onExpedition = true; u.expeditionId = exp.id;
      u.stamina = Math.max(20, Math.floor(u.stamina * 0.7));
      // Skupinu NEROZEBÍRÁME: postava zůstává členem i ve své roli, jen je na cestě.
      const g = u.groupId ? G.getGroup(u.groupId) : null;
      if (g) groups.add(g.name);
      if (G.addJournal) G.addJournal(u, `Vyrazil na expedici "${tpl.name}" (${days} dní).`, '⛵');
    }
    exp.groups = Array.from(groups);
    // Naplánuj eventy na cestě
    if (G.EXPEDITION_EVENTS && G.chance(G.EXPEDITION_EVENT_CHANCE)) {
      const ev = G.pick(G.EXPEDITION_EVENTS);
      exp.events.push({ tpl: ev.id, at: G.state.time + duration * 0.5 });
    }
    G.state.expeditions.push(exp);
    G.state.stats.expeditions = (G.state.stats.expeditions || 0) + 1;
    G.log(`⛵ ${tpl.icon} Expedice "${tpl.name}" začala (${days} dní, ${units.length} postav, ${foodCost} jídla${groupFoodMult !== 1 ? ` — Zásobovač ušetřil ${Math.round((1 - groupFoodMult) * 100)} %` : ''}).${exp.groups.length ? ` Skupiny: ${exp.groups.join(', ')} — členství i role jim zůstávají.` : ''}`, 'story');
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
    return G.state.units.filter(u => u && !u.dead && !u.isChild
      && !busy.has(u.id)
      && !u.resting
      && !u.onExpedition
      && !(u.merchantState && u.merchantState.active));
  };
  /** Kolik členů skupiny je zrovna na expedici (pro odznak ve skupině). */
  G.groupExpeditionCount = function (groupId) {
    const g = G.getGroup(groupId);
    if (!g) return 0;
    return G.groupMembers(g).filter(u => u && !u.dead && u.onExpedition).length;
  };
  /** Skupiny, ze kterých jde teď na expedici aspoň někdo. */
  G.expeditionGroups = function () {
    const pickable = new Set(G.expeditionPickable().map(u => u.id));
    return (G.state.groups || []).map(g => {
      const members = G.groupMembers(g).filter(u => u && !u.dead && !u.isChild);
      return { g, members, eligible: members.filter(u => pickable.has(u.id)), away: members.filter(u => u.onExpedition).length };
    });
  };
})();
