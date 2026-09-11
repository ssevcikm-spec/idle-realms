(function () {
  const G = window.Game;
  let taskIdSeq = 1;
  G.setTaskIdSeq = function (v) { taskIdSeq = v; };

  G.startTask = function (activityId, unitIds, opts) {
    opts = opts || {};
    const act = G.ACTIVITIES[activityId];
    if (!act || !unitIds || !unitIds.length) return null;
    const usable = unitIds.filter(id => {
      const u = G.getUnit(id);
      if (!u || u.dead || u.isChild || u.resting) return false;
      if (G.hasSevereInjury && G.hasSevereInjury(u)) return false;
      if (u.role === 'trader' || (u.merchantState && u.merchantState.active)) return false;
      if (G.unitRefusesWork && G.unitRefusesWork(u)) return false;
      if (u._refuseUntil && G.state.time < u._refuseUntil) return false;
      return true;
    });
    if (!usable.length) return null;
    const node = opts.nodeId
      ? G.WORLD.nodes.find(n => n.id === opts.nodeId)
      : G.findNodeFor(activityId, usable);
    if (!node) return null;
    const t = {
      id:'t'+(taskIdSeq++), activityId, nodeId: node.id,
      unitIds: usable.slice(), mode: act.mode,
      targetQty: act.mode === 'quantity' ? Math.max(1, Math.floor(opts.targetQty || act.defaultQty || 10)) : 1,
      producedQty:0, workDone:0,
      workRequired: act.mode === 'timed' ? (act.workRequired || 20) : null,
      startedAt: G.state.time, _dangerAccum:0
    };
    G.state.tasks.push(t);
    for (const uid of t.unitIds) {
      const u = G.getUnit(uid);
      if (u) { u.assignedTaskId = t.id; u.status = 'working'; }
    }
    const groups = new Set(usable.map(id => G.getUnit(id).groupId).filter(Boolean));
    for (const gid of groups) G.autoAssignRoles(G.getGroup(gid));
    return t;
  };

  G.findNodeFor = function (activityId, unitIds) {
    const act = G.ACTIVITIES[activityId]; if (!act) return null;
    let cx = 0, cy = 0, n = 0;
    for (const uid of (unitIds || [])) {
      const u = G.getUnit(uid);
      if (u) { cx += u.pos.x; cy += u.pos.y; n++; }
    }
    if (!n) { cx = G.state.camera.x; cy = G.state.camera.y; }
    else { cx /= n; cy /= n; }
    return G.WORLD.nearestNode(act.nodeKinds, cx, cy);
  };

  G.cancelTask = function (taskId) {
    const idx = G.state.tasks.findIndex(t => t.id === taskId);
    if (idx < 0) return;
    const t = G.state.tasks[idx];
    for (const uid of t.unitIds) {
      const u = G.getUnit(uid);
      if (u && u.assignedTaskId === t.id) { u.assignedTaskId = null; u.status = 'idle'; }
    }
    G.state.tasks.splice(idx, 1);
  };

  G.taskProgress = function (t) {
    if (t.mode === 'quantity') return t.targetQty > 0 ? Math.min(1, t.producedQty / t.targetQty) : 0;
    return Math.min(1, t.workDone / t.workRequired);
  };

  G.tickTasks = function (dt) {
    for (const t of G.state.tasks.slice()) {
      const act = G.ACTIVITIES[t.activityId];
      if (!act) { G.cancelTask(t.id); continue; }
      const node = G.WORLD.nodes.find(n => n.id === t.nodeId);
      const richMult = node ? node.richness : 1;
      let rate = 0; const active = [];
      for (const uid of t.unitIds) {
        const u = G.getUnit(uid);
        if (!u || u.dead || u.isChild || u.assignedTaskId !== t.id) continue;
        if (u.resting) continue;
        if (G.hasSevereInjury && G.hasSevereInjury(u)) continue;
        if (G.unitRefusesWork && G.unitRefusesWork(u)) continue;
        if (u._refuseUntil && G.state.time < u._refuseUntil) continue;
        active.push(u);
        rate += G.unitWorkRate(u, act);
      }
      if (rate <= 0) continue;

      const gids = new Set(active.map(u => u.groupId).filter(Boolean));
      for (const gid of gids) {
        const g = G.getGroup(gid);
        if (g) rate *= G.groupWorkMult(g);
      }

      if (G.checkDanger) G.checkDanger(t, dt);
      if (G.wearEquipment) for (const u of active) G.wearEquipment(u, dt);
      if (G.tickStaminaDrain) for (const u of active) G.tickStaminaDrain(u, dt);

      const work = rate * richMult * dt;
      t.workDone += work;
      G.state.stats.totalWork += work;

      if (t.mode === 'quantity') {
        const wpu = act.workPerUnit || 4;
        let guard = 0;
        while (t.workDone >= wpu && t.producedQty < t.targetQty && guard++ < 500) {
          t.workDone -= wpu; t.producedQty++;
          grantOutput(act, active, false);
        }
        if (t.producedQty >= t.targetQty) finishTask(t, act);
      } else {
        if (t.workDone >= t.workRequired) { grantOutput(act, active, true); finishTask(t, act); }
      }
    }
  };

  function grantOutput(act, units, isTimed) {
    if (!act.output || !units.length) return;
    const sid = act.skill;
    let avgSkill = 0;
    for (const u of units) avgSkill += G.unitSkill(u, sid);
    avgSkill /= units.length;
    const extras = {};
    for (const u of units) {
      if (!G.perkExtraOutput) continue;
      const eo = G.perkExtraOutput(u, sid);
      for (const m in eo) extras[m] = (extras[m] || 0) + eo[m];
    }
    for (const out of act.output) {
      if (!out.qty) continue;
      const q = G.rollQuality(avgSkill, units, sid);
      let qty = out.qty;
      if (extras[out.material]) qty += extras[out.material];
      G.matAdd(out.material, qty, q);
    }
    for (const u of units) {
      if (!G.perkEffects) continue;
      const eff = G.perkEffects(u, sid);
      for (const rd of eff.rareDrop) {
        if (G.chance(rd.chance)) {
          G.matAdd(rd.material, 1, 'fine');
          G.log(`💎 ${u.name} nalezl vzácný ${G.MATERIALS[rd.material].name}!`);
        }
      }
    }
    if (G.rollActivityDrops) G.rollActivityDrops(act, units);
    const xpBase = isTimed ? (act.xpReward || 20) : (act.xpPerUnit || 5);
    for (const u of units) { G.addSkillXp(u, sid, xpBase); G.addUnitXp(u, xpBase*0.5); }
  }

  G.rollQuality = function (avgSkill, units, skillId) {
    let luckMod = 0, perkQuality = 0, persBonus = 0, inspBonus = 0;
    for (const u of units) {
      luckMod += (u.attrs.luk - 10)*0.01;
      luckMod += (G.unitTraitMod(u, 'luck', 1) - 1);
      if (skillId && G.perkQualityBonus) perkQuality += G.perkQualityBonus(u, skillId);
      if (G.personalityMod) persBonus += G.personalityMod(u, 'quality');
      if (G.hasInspiration && G.hasInspiration(u)) inspBonus += 30;
    }
    const n = Math.max(1, units.length);
    luckMod /= n; perkQuality /= n; persBonus /= n; inspBonus /= n;
    const score = avgSkill*0.9 + luckMod*30 + perkQuality + persBonus + inspBonus + G.rand()*100 - 50;
    if (score >= 120) return 'masterwork';
    if (score >= 85)  return 'superior';
    if (score >= 50)  return 'fine';
    if (score >= 15)  return 'common';
    return 'crude';
  };

  function finishTask(t, act) {
    for (const uid of t.unitIds) {
      const u = G.getUnit(uid);
      if (u && u.assignedTaskId === t.id) { u.assignedTaskId = null; u.status = 'idle'; }
    }
    G.state.stats.tasksDone++;
    const active = t.unitIds.map(id => G.getUnit(id)).filter(u => u && !u.dead);
    if (G.onGroupSuccess && active.length) G.onGroupSuccess(active, 3);
    G.log(t.mode === 'quantity' ? `✔ ${act.name} — hotovo (${t.producedQty}×).` : `✔ ${act.name} — dokončeno.`);
    G.state.tasks = G.state.tasks.filter(x => x.id !== t.id);
  }

  G.grantOutput = grantOutput;
})();
