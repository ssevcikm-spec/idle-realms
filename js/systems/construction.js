(function () {
  const G = window.Game;

  /**
   * Stavby budov zaberou herní čas a potřebují stavitele.
   *
   * Stavba se nepočítá zvlášť — vytvoří se jako běžný úkol s vnitřní aktivitou
   * `construct` (skrytá v UI). Tím stavitelé:
   *   - jsou zaměstnaní (autonomie je nepřevezme na jinou práci),
   *   - přeruší svou předchozí práci,
   *   - mají viditelný postup a odhad času v panelu,
   *   - spadnou pod běžné kontroly (výdrž, zranění, nebezpečí).
   * Po dokončení úkolu se budova zapíše do stavu hry (`finishConstruction`).
   */

  let seq = 1;
  G.setConstructionSeq = function (v) { seq = v; };

  G.ACTIVITIES.construct = {
    id: 'construct', name: 'Stavět', icon: '🏗️', nodeKinds: [], hidden: true,
    skill: 'crafting', attr: 'str', mode: 'timed', workRequired: 60,
    xpReward: 20, output: []
  };

  const MAX_BUILDERS = 3;
  const SITE_RANGE = 4;      // jak daleko od stavby musí stavitel být

  /** Kolik práce stavba vyžaduje (roste kvadraticky s úrovní). */
  G.constructionWorkRequired = function (level, kind) {
    const base = kind === 'base' ? 45 : 32;
    return Math.round(base * level * level);
  };

  G.constructionList = function () { return G.state.construction || []; };

  /** Rozestavěná stavba na daném místě (sídlo id, nebo 'base'). */
  G.constructionAt = function (siteKey) {
    const key = siteKey == null ? 'base' : siteKey;
    return (G.state.construction || []).find(j => j.site === key) || null;
  };
  G.constructionStatus = function (siteKey) {
    const job = G.constructionAt(siteKey);
    if (!job) return null;
    const t = job.taskId ? G.state.tasks.find(x => x.id === job.taskId) : null;
    return {
      job: job,
      task: t,
      builders: t ? t.unitIds.length : 0,
      progress: t ? G.taskProgress(t) : 0,
      eta: t ? G.taskEta(t) : null
    };
  };

  function siteOf(job) {
    if (!job) return null;
    if (job.kind === 'base') {
      const p = G.basePos ? G.basePos() : G.BASE_POS;
      return { x: p.x + 0.5, y: p.y + 0.5, name: 'Základna' };
    }
    const s = G.WORLD.settlementById[job.settlementId];
    return s ? { x: s.x + 0.5, y: s.y + 0.5, name: s.name } : null;
  }
  G.constructionSite = function (job) { return siteOf(job); };

  G.buildingLabel = function (job) {
    if (!job) return 'stavba';
    const def = job.kind === 'base' ? G.BASE_BUILDINGS[job.buildingId] : G.BUILDINGS[job.buildingId];
    return def ? `${def.icon} ${def.name} (úr. ${job.level})` : 'stavba';
  };

  /** Schopní stavitelé u stavby (seřazení podle řemesla a vzdálenosti). */
  function ableBuilders(site) {
    const out = [];
    for (const u of G.state.units) {
      if (u.dead || u.isChild) continue;
      if (G.workBlockReason && G.workBlockReason(u)) continue;
      if (!u.pos) continue;
      const d = Math.hypot(u.pos.x - site.x, u.pos.y - site.y);
      if (d > SITE_RANGE) continue;
      out.push({ u: u, d: d });
    }
    out.sort((a, b) => (G.unitSkill(b.u, 'crafting') - G.unitSkill(a.u, 'crafting')) || (a.d - b.d));
    return out.slice(0, MAX_BUILDERS).map(x => x.u);
  }
  G.ableBuilders = ableBuilders;

  /** Založí stavbu (cenu už odečetl volající). */
  G.startConstruction = function (kind, settlementId, buildingId, level) {
    if (!G.state.construction) G.state.construction = [];
    const job = {
      id: 'c' + (seq++),
      kind: kind,
      site: kind === 'base' ? 'base' : settlementId,
      settlementId: settlementId || null,
      buildingId: buildingId,
      level: level,
      workRequired: G.constructionWorkRequired(level, kind),
      taskId: null,
      startedAt: G.state.time
    };
    G.state.construction.push(job);
    G.tryStartConstruction(job);
    return job;
  };

  /** Zkusí stavbě přiřadit stavitele (a založit jim úkol). */
  G.tryStartConstruction = function (job) {
    if (!job) return false;
    if (job.taskId) {
      if (G.state.tasks.some(t => t.id === job.taskId)) return false;
      job.taskId = null;   // úkol zmizel (zrušen/načtení) → zkusit znovu
    }
    const site = siteOf(job);
    if (!site) return false;
    const builders = ableBuilders(site);
    if (!builders.length) return false;
    for (const u of builders) {
      if (!u.assignedTaskId) continue;
      const t = G.state.tasks.find(x => x.id === u.assignedTaskId);
      if (t && t.id !== job.taskId) G.cancelTask(t.id);
    }
    const t = G.startTask('construct', builders.map(u => u.id), {
      nodeId: 'site:' + job.id,
      workRequired: job.workRequired,
      buildJobId: job.id,
      site: { x: site.x, y: site.y },
      siteName: site.name
    });
    if (!t) return false;
    job.taskId = t.id;
    G.log(`🏗️ Stavba: ${G.buildingLabel(job)} v ${site.name} (${builders.length} stavitelů).`, 'work');
    return true;
  };

  /** Periodická kontrola: stavby bez stavitelů zkusí získat nové. */
  G.tickConstruction = function () {
    const list = G.state.construction || [];
    for (const job of list.slice()) {
      const t = job.taskId ? G.state.tasks.find(x => x.id === job.taskId) : null;
      if (job.taskId && !t) {
        job.taskId = null;
      } else if (t) {
        // Zůstal stavbě vůbec někdo schopný? Když ne, úkol zrušíme (bez zrušení stavby)
        // a zkusíme sehnat nové stavitele.
        const someoneAlive = t.unitIds.some(id => {
          const u = G.getUnit(id);
          if (!u || u.dead || u.assignedTaskId !== t.id) return false;
          return !(G.workBlockReason && G.workBlockReason(u));
        });
        if (!someoneAlive) {
          delete t.buildJobId;
          G.cancelTask(t.id);
          job.taskId = null;
        }
      }
      if (!job.taskId) G.tryStartConstruction(job);
    }
  };

  /** Úkol stavby dokončen → zapiš budovu. */
  G.finishConstruction = function (jobId) {
    const list = G.state.construction || [];
    const i = list.findIndex(j => j.id === jobId);
    if (i < 0) return false;
    const job = list[i];
    list.splice(i, 1);
    if (job.kind === 'base') {
      if (!G.state.base.buildings) G.state.base.buildings = {};
      G.state.base.buildings[job.buildingId] = (G.state.base.buildings[job.buildingId] || 0) + 1;
      const def = G.BASE_BUILDINGS[job.buildingId];
      G.log(`🏗️ Základna: ${def ? def.name : job.buildingId} na úrovni ${G.state.base.buildings[job.buildingId]}.`, 'work');
    } else {
      const b = G.buildingsAt(job.settlementId);
      b[job.buildingId] = (b[job.buildingId] || 0) + 1;
      const def = G.BUILDINGS[job.buildingId];
      const s = G.WORLD.settlementById[job.settlementId];
      G.log(`🏗️ ${s ? s.name : job.settlementId}: ${def ? def.name : job.buildingId} na úrovni ${b[job.buildingId]}.`, 'work');
    }
    return true;
  };

  /** Zruší rozestavěnou stavbu (suroviny propadají). */
  G.cancelConstruction = function (jobId, silent) {
    const list = G.state.construction || [];
    const i = list.findIndex(j => j.id === jobId);
    if (i < 0) return false;
    const job = list[i];
    list.splice(i, 1);
    if (!silent) G.log(`🏗️ Stavba zrušena: ${G.buildingLabel(job)} — suroviny propadly.`, 'info');
    return true;
  };
})();
