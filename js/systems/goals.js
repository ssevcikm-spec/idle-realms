// goals.js — ZÁMĚRY hráče (Fáze A1 z docs/PROMPT_IDLE_REALM.md)
// Záměr je to, co hráč chce. Úkol si z něj vyrobí plánovač (Fáze B1).
// Zatím tu je jen registry a přehled pro UI; kroky (plan) doplní plánovač.
(function () {
  const G = window.Game;

  // Druhy záměrů a parametry, kterým musí umět naplnit plánovač (viz ARCHITEKTURA_PREMISA §3.1).
  G.GOAL_KINDS = {
    stock:    { label: 'Zásoba',    params: ['material'],           optional: ['qty', 'quality'] },
    train:    { label: 'Výcvik',    params: ['skill', 'level'],     optional: ['minUnits'] },
    campaign: { label: 'Výprava',   params: ['expeditionId'],       optional: ['minPartySize', 'byTime'] },
    explore:  { label: 'Průzkum',   params: [],                    optional: ['settlementIds', 'minVisits'] },
    prestige: { label: 'Příprava na dědictví', params: [],          optional: ['renown', 'legacyTarget'] }
  };

  /** Seznam záměrů ve stavu; vytvoří ho, když ve starším savu chybí. */
  G.goalList = function () {
    if (!G.state.goals) G.state.goals = [];
    return G.state.goals;
  };
  G.getGoal = function (id) {
    return G.goalList().find(g => g.id === id) || null;
  };

  /** Je záměr ještě živý (hráč ho neřídl a nesplnil se)? */
  G.isGoalActive = function (goal) {
    return !!goal && (goal.status === 'active' || goal.status === 'planning');
  };

  /** Nový záměr. Vrací objekt, nebo null když je druh/parametry chybné. */
  G.newGoal = function (kind, params, opts) {
    const def = G.GOAL_KINDS[kind];
    if (!def) return null;
    params = params || {};
    for (const k of def.params) {
      if (params[k] == null) return null;
    }
    opts = opts || {};
    const s = G.state;
    s.goalSeq = (s.goalSeq || 0) + 1;
    const goal = {
      id: 'g' + s.goalSeq,
      kind: kind,
      label: opts.label || G.goalLabel(kind, params),
      priority: opts.priority == null ? 50 : Math.max(0, Math.min(100, opts.priority)),
      params: JSON.parse(JSON.stringify(params)),
      status: 'active',
      plan: [],              // kroky — doplní plánovač (Fáze B1)
      createdAt: s.time || 0,
      startedAt: null,
      metAt: null,
      cancelled: false,
      via: opts.via || 'player'   // kdo záměr zadal: hráč, nebo směrnice
    };
    G.goalList().push(goal);
    if (opts.silent !== true) G.log(`🎯 Nový záměr: ${goal.label}`, 'work');
    return goal;
  };

  /** Hráč záměr ruší. Rušení je konečné — záměr se nesmí potichu vrátit. */
  G.cancelGoal = function (id, reason) {
    const goal = id && typeof id === 'object' ? id : G.getGoal(id);
    if (!goal) return false;
    if (!G.isGoalActive(goal)) return false;
    goal.status = 'failed';
    goal.cancelled = true;
    goal.cancelReason = reason || 'Hráč záměr zrušil.';
    goal.metAt = G.state.time || 0;
    G.log(`🚫 Záměr zrušen: ${goal.label}`, 'work');
    return true;
  };

  /** Záměry k zobrazení. Bez argumenty jen živé, vyšší priorita první. */
  G.listGoals = function (filter) {
    let list = G.goalList().slice();
    if (!filter || filter === 'active') list = list.filter(G.isGoalActive);
    else if (filter === 'all') { /* všechny */ }
    else list = list.filter(g => g.status === filter);
    return list.sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt);
  };

  /** Přehled záměrů pro panel: co hráč chce a jak moc toho je hotovo. */
  G.getGoalBoard = function () {
    const rows = [];
    for (const goal of G.listGoals('active')) {
      rows.push({
        id: goal.id,
        kind: goal.kind,
        label: goal.label,
        priority: goal.priority,
        status: goal.status,
        via: goal.via,
        steps: goal.plan.length ? goal.plan.length : 0,
        progress: G.goalProgress(goal)
      });
    }
    return rows;
  };

  /**Kolik záměru je splněno — jen pro zobrazení, plánovač si spočítá mezery sám. */
  G.goalProgress = function (goal) {
    if (!goal) return null;
    const p = goal.params;
    if (goal.kind === 'stock') {
      const have = G.matCount(p.material);
      const need = p.qty || 30;
      return { have: have, need: need, done: have >= need, text: `${have}/${need}` };
    }
    if (goal.kind === 'train') {
      const ready = G.state.units.filter(u =>
        !u.dead && !u.isChild && G.unitSkill(u, p.skill) >= p.level).length;
      const need = Math.max(1, p.minUnits || 1);
      return { have: ready, need: need, done: ready >= need, text: `${ready}/${need}` };
    }
    if (goal.kind === 'explore') {
      const visited = (G.state.stats.settlementsVisited || []).filter(id =>
        !p.settlementIds || p.settlementIds.indexOf(id) !== -1).length;
      const need = p.minVisits || (p.settlementIds ? p.settlementIds.length : 1);
      return { have: visited, need: need, done: visited >= need, text: `${visited}/${need}` };
    }
    if (goal.kind === 'prestige') {
      const renown = (G.state.resources && G.state.resources.renown) || 0;
      const need = p.renown || 100;
      return { have: renown, need: need, done: renown >= need, text: `${renown}/${need}` };
    }
    return { have: 0, need: 1, done: false, text: '' };
  };

  /** Název záměru pro log a panel. */
  G.goalLabel = function (kind, params) {
    const p = params || {};
    if (kind === 'stock') {
      const name = G.MATERIALS && G.MATERIALS[p.material] ? G.MATERIALS[p.material].name : p.material;
      return `Zásoba: ${p.qty || 30}× ${name}`;
    }
    if (kind === 'train') {
      const skill = G.SKILLS && G.SKILLS[p.skill] ? G.SKILLS[p.skill].name : p.skill;
      return `Výcvik: ${skill} ${p.level}`;
    }
    if (kind === 'campaign') return `Výprava: ${p.expeditionId}`;
    if (kind === 'explore') return 'Průzkum okolí';
    if (kind === 'prestige') return 'Příprava na další generaci';
    return 'Záměr';
  };

  /* ---------- směrnice jako ZKRATKA nad záměrem (Fáze A2) ----------
     Směrnice nezmizí — ale pod ní vzniká záměr, aby hra měla jediný
     zdroj pravdy o tom, co hráč chce (ARCHITEKTURA_PREMISA §3.6). */

  /** Živý záměr, který stojí za směrnicí `focusMaterial` (nebo null). */
  G.directiveGoal = function () {
    const dir = G.state.directives || {};
    return G.goalList().find(g => g.via === 'directive' && G.isGoalActive(g) && g.kind === 'stock' &&
      (!dir.focusMaterial || g.params.material === dir.focusMaterial)) || null;
  };

  /** Založí/udrží záměr `stock` pod směrnicí. Volá se při každé změně směrnice. */
  G.ensureDirectiveGoal = function () {
    const dir = G.state.directives || {};
    if (!dir.focusMaterial) { const old = G.directiveGoal(); if (old) G.cancelGoal(old, 'Směrnice směřovala jinam.'); return null; }
    const qty = dir.focusTarget || 30;
    const existing = G.directiveGoal();
    if (existing) {
      // směrnice je zkratka nad záměrem: mění záměr, ne vzniká druhý
      if (existing.params.qty !== qty) existing.params.qty = qty;
      return existing;
    }
    return G.newGoal('stock', { material: dir.focusMaterial, qty: qty },
      { priority: 40, via: 'directive', silent: true });
  };
})();