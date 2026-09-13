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
    const node = opts.nodeId ? G.WORLD.nodes.find(n => n.id === opts.nodeId) : G.findNodeFor(activityId, usable);
    if (!node) return null;
    const t = {
      id:'t'+(taskIdSeq++), activityId, nodeId: node.id,
      unitIds: usable.slice(), mode: act.mode,
      targetQty: act.mode === 'quantity' ? Math.max(1, Math.floor(opts.targetQty || act.defaultQty || 10)) : 1,
      producedQty:0, workDone:0, auto: !!opts.auto,
      workRequired: act.mode === 'timed' ? (act.workRequired || 20) : null,
      startedAt: G.state.time, _dangerAccum:0
    };
    G.state.tasks.push(t);
    for (const uid of t.unitIds) { const u = G.getUnit(uid); if (u) { u.assignedTaskId = t.id; u.status = 'working'; } }
    const groups = new Set(usable.map(id => G.getUnit(id).groupId).filter(Boolean));
    for (const gid of groups) G.autoAssignRoles(G.getGroup(gid));
    return t;
  };
  G.findNodeFor = function (activityId, unitIds) {
    const act = G.
