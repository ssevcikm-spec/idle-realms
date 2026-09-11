(function () {
  const G = window.Game;

  G.expeditionList = function () { return G.state.expeditions || []; };

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
    const power = units.reduce((s, u) => s + G.unitCombatPower(u) + G.unitSkill(u, 'scouting') * 3, 0);
    const need = tpl.difficulty * 30;

    const exp = {
      id: 'ex' + Date.now() + '_' + G.randInt(0, 999),
      templateId: expeditionId,
      unitIds: unitIds.slice(),
      startedAt: G.state.time,
      endsAt: G.state.time + duration,
      days: days,
      power: Math.round(power),
      need: Math.round(need),
      outcome: null
    };

    for (const u of units) {
      if (u.assignedTaskId) G.cancelTask(u.assignedTaskId);
      u.onExpedition = true;
      u.expeditionId = exp.id;
      G.removeUnitFromGroup(u.id);
      if (G.addJournal) G.addJournal(u, `Vyrazil na expedici "${tpl.name}" (${days} dní).`, '⛵');
    }

    G.state.expeditions.push(exp);
    G.state.stats.expeditions = (G.state.stats.expeditions || 0) + 1;
    G.log(`⛵ ${tpl.icon} Expedice "${tpl.name}" začala (${days} dní, ${units.length} postav).`, 'story');
    return { ok:true, expedition: exp };
  };

  G.tickExpeditions = function (dt) {
    if (!G.state.expeditions) return;
    for (const exp of G.state.expeditions.slice()) {
      if (!exp.outcome && G.state.time >= exp.endsAt) {
        resolveExpedition(exp);
      }
    }
    G.state.expeditions = G.state.expeditions.filter(e =>
      !e.cleanupAt || G.state.time < e.cleanupAt);
  };

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
        drops.push(`${q}× ${G.MATERIALS[r.material].icon} ${G.MATERIALS[r.material].name}`);
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
      u.onExpedition = false;
      u.expeditionId = null;
      const home = G.WORLD.settlementById['svitavy'];
      if (home) u.pos = {
        x: home.x + 0.5 + (G.rand() - 0.5) * 2,
        y: home.y + 0.5 + (G.rand() - 0.5) * 2
      };
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
    return G.state.units.filter(u => u && !u.dead && !u.isChild && !busy.has(u.id));
  };
})();
