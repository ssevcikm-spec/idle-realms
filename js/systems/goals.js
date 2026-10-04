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
    // Plán vzniká hned, jakmile je na co se podívat. Když se záměr zakládá
    // ještě před načtením světa (migrace savu), plán doplní `tickGoals`.
    if (G.WORLD && G.state && G.state.materials && G.state.units) G.planNewGoal(goal);
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
      if (existing.params.qty !== qty) { existing.params.qty = qty; G.planGoal(existing); }
      return existing;
    }
    return G.newGoal('stock', { material: dir.focusMaterial, qty: qty },
      { priority: 40, via: 'directive', silent: true });
  }

  /* ---------- Fáze B1: plánovač — záměr na kroky ----------
     Čistá funkce stavu: { záměr, stav světa } → kroky. Bez náhody, bez
     side effectů (ARCHITEKTURA_PREMISA §3.3). Kroky se pak měří zvlášť
     (`measureStep`), aby „kolik je splněno" nebylo uložený dohad. */

  /** První aktivita, která přímo vyrábí materiál (null = jen recept / nelze). */
  G.activityForMaterial = function (mat) {
    for (const aid in G.ACTIVITIES) {
      const a = G.ACTIVITIES[aid];
      if (!a.output) continue;
      for (const o of a.output) if (o.material === mat) return a;
    }
    return null;
  };

  /**
 * ODKUD se materiál vůbec dá získat, když ho nelze vyrobit prací: lov (drop
 * nepřítele), drop z aktivity, odměna z expedice, nákup v sídle nebo stavba
 * na základně. Bez tohoto by brána K1 označila „zásoba šperku" za mrtvý
   * záměr — ačkoli šperk v repu je.
   */
  G.materialSource = function (mat) {
    const out = [];
    for (const aid in G.ACTIVITIES) {
      const d = G.ACTIVITIES[aid];
      if (d.drops && d.drops[mat]) out.push({ type: 'activity', id: aid });
    }
    for (const eid in G.ENEMIES) {
      const e = G.ENEMIES[eid];
      if (e.drops && e.drops.some(d => d.material === mat)) out.push({ type: 'enemy', id: eid });
    }
    for (const xid in G.EXPEDITIONS) {
      const x = G.EXPEDITIONS[xid];
      if (x.rewardPool && x.rewardPool.some(r => r.material === mat)) out.push({ type: 'expedition', id: xid });
    }
    if (G.TRADED && G.TRADED.indexOf(mat) !== -1) out.push({ type: 'trade', id: mat });
    for (const bid in G.BASE_BUILDINGS) {
      const b = G.BASE_BUILDINGS[bid];
      if (b.produces === mat) out.push({ type: 'building', id: bid });
    }
    return out;
  };

  /** Práce potřebná na JEDEN kus materiálu, v jednotkách `unitWorkRate`.
   * Recept je započítán po vstupech (chleba = 2 obilí = 12 jednotek práce),
   * cyklus v receptech je možný jen při chybě dat → 0, ne vymyšlené číslo.
   */
  G.materialWork = function (mat, seen) {
    if (!mat) return 0;
    seen = seen || {};
    if (seen[mat]) return 0;
    seen[mat] = true;
    const act = G.activityForMaterial(mat);
    if (act) {
      let qty = 0;
      for (const o of (act.output || [])) if (o.material === mat) qty = Math.max(qty, o.qty || 1);
      return (act.workPerUnit || 4) / Math.max(1, qty);
    }
    const rid = G.PRODUCTION_RECIPES ? G.PRODUCTION_RECIPES[mat] : null;
    const r = rid && G.RECIPES[rid];
    if (!r || !r.inputs) return 0;
    let work = 0;
    for (const inp of r.inputs) work += G.materialWork(inp.material, seen) * inp.qty;
    const out = (r.output && r.output.qty) || 1;
    return work / Math.max(1, out);
  };

  /**
 * ČÍM se dá dovednost zvednout — konkrétně a z dat. Šest dovedností nemá
 * sběrnou aktivitu (kovářství, alchymie, kuchařství, řemeslo, obchod, boj):
 * ty rostou výrobou, obchodem nebo doprovodem. Kdyby plánovač tvrdil „dovednost
 * X" a nic jiného, brána K1 by neměla čím tvrzení ověřit — proto se tady
 * vypisují konkrétní zdroje a každý se dá ověřit proti kódu.
 */
  G.skillSources = function (sid) {
    const out = [];
    for (const aid in G.ACTIVITIES) if (G.ACTIVITIES[aid].skill === sid) { out.push({ type: 'activity', id: aid }); break; }
    for (const rid in G.RECIPES) if (G.RECIPES[rid].skill === sid) { out.push({ type: 'recipe', id: rid }); break; }
    // obchodní dovednost roste, když postava obchoduje (merchant.js:150)
    if (sid === 'trading' && typeof G.merchantInstantTrade === 'function') out.push({ type: 'api', id: 'merchantInstantTrade' });
    return out;
  };

  /**
   * Suroviny, kterých krok potřebuje — plán je nárok, práci dodá hra.
   * Číslo u jídla spočítal plánovač (nejdelší možná cesta, aby odjezd
   * nezkolil střední délkou výpravy).
   */
  function stepMaterials(step) {
    if (step.kind !== 'have') return [];
    if (step.what === 'food') return [{ material: 'bread', qty: step.needed }];
    if (step.what === 'material' && step.material) return [{ material: step.material, qty: step.needed }];
    return [];
  }

  /**
   * Aktivity, které krok posouvají. Odvozené z dat, ne ze seznamu v kódu:
   * materiál jde recepty dolů až k aktivitě (obilí → mouka → chléb), dovednost
   * k aktivitám, které ji zvyšují, výbava k aktivitám živenícím její recept.
   * Prázdný seznam = krok práci nežere (odjezd, renomé) — a to je poctivé:
   * rozdělovac se pak o něj ani nepokouší, místo aby dělal falešnou práci.
   */
  G.stepActivities = function (step) {
    const out = [];
    const chain = (mat, seen) => {
      if (!mat) return;
      seen = seen || {};
      if (seen[mat]) return;
      seen[mat] = true;
      const act = G.activityForMaterial(mat);
      if (act) { out.push(act.id); return; }
      const rid = G.PRODUCTION_RECIPES ? G.PRODUCTION_RECIPES[mat] : null;
      const r = rid && G.RECIPES[rid];
      if (!r || !r.inputs) return;
      for (const inp of r.inputs) chain(inp.material, seen);
    };
    if (step.kind === 'have') {
      if (step.what === 'material') chain(step.material);
      else if (step.what === 'food') { chain('bread'); chain('fish'); }
    }
    else if (step.kind === 'skill') {
      for (const aid in G.ACTIVITIES) if (G.ACTIVITIES[aid].skill === step.id) out.push(aid);
    }
    else if (step.kind === 'equip') {
      for (const sat of (step.satisfiedBy || [])) {
        if (sat.type !== 'recipe') continue;
        const r = G.RECIPES[sat.id];
        if (r && r.inputs) for (const inp of r.inputs) chain(inp.material);
      }
    }
    return out.filter((v, i, a) => a.indexOf(v) === i);
  };

  function mk(goal, kind, extra) {
    const n = goal.plan.length + 1;
    const s = Object.assign({
      id: goal.id + '.s' + n, of: goal.id, kind: kind,
      qty: 0, needed: 0, done: false, blockedBy: null
    }, extra);
    s.satisfiedBy = s.satisfiedBy || [];
    goal.plan.push(s);
    return s;
  }

  /**
   * Rozloží záměr na kroky. Vrací nové pole `goal.plan` (starý zahazuje).
   * Krok bez `satisfiedBy` je mrtvý záměr — to má chytit brána K1, ne hráč.
   */
  G.planGoal = function (goal) {
    goal.plan = [];
    if (!goal || !goal.params) return goal.plan;
    const p = goal.params;
    if (goal.kind === 'stock') {
      const qty = Math.max(1, p.qty || 30);
      mk(goal, 'have', {
        what: 'material', material: p.material, quality: p.quality || null, needed: qty, qty: 0,
        label: `${qty}× ${G.MATERIALS[p.material] ? G.MATERIALS[p.material].name : p.material}` +
          (p.quality ? ` (${G.QUALITY_LABEL[p.quality] || p.quality})` : ''),
        satisfiedBy: [{ type: 'material', id: p.material }]
      });
    }
    else if (goal.kind === 'train') {
      const need = Math.max(1, p.minUnits || 1);
      mk(goal, 'skill', {
        what: 'skill', id: p.skill, level: p.level, units: need, needed: need,
        label: `${need}× ${G.SKILLS[p.skill] ? G.SKILLS[p.skill].name : p.skill} ${p.level}`,
        satisfiedBy: G.skillSources(p.skill)
      });
    }
    else if (goal.kind === 'campaign') {
      const tpl = G.EXPEDITIONS[p.expeditionId];
      if (!tpl) return goal.plan;           // neznámá expedice = žádný plán, ne plan pro všechno
      const party = Math.max(G.EXPEDITION_MIN_PARTY || 2, p.minPartySize || G.EXPEDITION_MIN_PARTY || 2);
      mk(goal, 'equip', {
        what: 'weapon', slot: 'weapon', minTier: 2, units: party, needed: party,
        label: `${party}× zbraň (tier 2)`,
        satisfiedBy: [{ type: 'recipe', id: 'sword' }, { type: 'slot', id: 'weapon', minTier: 2 }]
      });
      mk(goal, 'equip', {
        what: 'armor', slot: 'armor', minTier: 2, units: party, needed: party,
        label: `${party}× zbroj (tier 2)`,
        satisfiedBy: [{ type: 'recipe', id: 'armor' }, { type: 'slot', id: 'armor', minTier: 2 }]
      });
      mk(goal, 'skill', {
        what: 'combat', id: 'combat', level: 6, units: party, needed: party,
        label: `${party}× bojovnictví 6`,
        satisfiedBy: G.skillSources('combat')
      });
      // Jídlo se počítá podle NEJDLANŠÍ cesty (maxDays), ne průměru:
      // `startExpedition` hází počet dní náhodně, takže plán podle průměru by
      // byl „splněný" a výprava by stejně neodjela.
      const foodNeed = Math.ceil(tpl.maxDays * party * (G.EXPEDITION_FOOD_PER_UNIT_PER_DAY || 0.5));
      mk(goal, 'have', {
        what: 'food', needed: foodNeed, units: party, qty: 0,
        label: `jídlo na cestu (${foodNeed} na ${tpl.maxDays} dní)`,
        satisfiedBy: [{ type: 'material', id: 'bread' }, { type: 'material', id: 'fish' }]
      });
      mk(goal, 'have', {
        what: 'material', material: 'potion', needed: party, qty: 0,
        label: `${party}× lektvar`,
        satisfiedBy: [{ type: 'material', id: 'potion' }]
      });
      mk(goal, 'count', {
        what: 'partyPower', needed: G.expeditionNeed(p.expeditionId), qty: 0,
        label: `družina o síle ${G.expeditionNeed(p.expeditionId)}`,
        satisfiedBy: [{ type: 'api', id: 'expeditionPowerOf' }]
      });
      const last = mk(goal, 'expedition', {
        what: 'depart', expeditionId: p.expeditionId, needed: 1, qty: 0,
        label: `vyrazit na ${tpl.name}`,
        satisfiedBy: [{ type: 'api', id: 'startExpedition' }]
      });
      // vyrazit bez zbroje a jídla je nesmysl — vše ostatní čeká na odjezd
      for (let i = 0; i < goal.plan.length - 1; i++) goal.plan[i].blockedBy = last.id;
    }
    else if (goal.kind === 'explore') {
      const ids = p.settlementIds && p.settlementIds.length ? p.settlementIds : null;
      if (ids) {
        for (const sid of ids) {
          mk(goal, 'visit', {
            what: 'visitSettlement', settlementId: sid, needed: 1, qty: 0,
            label: `navštívit ${sid}`,
            satisfiedBy: [{ type: 'api', id: 'visitSettlement' }]
          });
        }
      } else {
        const visits = Math.max(1, p.minVisits || 1);
        mk(goal, 'visit', {
          what: 'visitSettlement', needed: visits, qty: 0,
          label: `navštívit ${visits} sídel`,
          satisfiedBy: [{ type: 'api', id: 'visitSettlement' }]
        });
      }
    }
    else if (goal.kind === 'prestige') {
      const renown = Math.max(1, p.renown || 100);
      mk(goal, 'have', {
        what: 'renown', needed: renown, qty: 0,
        label: `${renown} renomé`,
        satisfiedBy: [{ type: 'api', id: 'gainRenown' }]
      });
    }
    for (const s of goal.plan) {
      s.materials = stepMaterials(s);
      s.actIds = G.stepActivities(s);      // kdo tenhle krok vůbec posouvá
    }
    // Podpis parametrů: podle něj se pozná, že plán zastarál (např. hráč
    // změnil `focusTarget` a plán má pořád staré `needed`).
    goal.planSig = JSON.stringify(p);
    return goal.plan;
  };

  /* ---------- Fáze B2: měření kroku a mezera ----------
     Krok se neměří v okamžiku plánování — ten je čistý a svět číst nemá.
     Měření je oddělené, aby „kolik je splněno" vždy odpovídalo STAVU, ne
     dohodu z chvíle, kdy plán vznikl. */

  /** Postavy, které může plán počítat (živé, dospělé, ne na expedici). */
  function planUnits() {
    return (G.state.units || []).filter(u => u && !u.dead && !u.isChild && !u.onExpedition);
  }

  /** Kolik postav má v daném slotu předmět dané (nebo vyšší) úrovně. */
  G.equippedCount = function (slot, minTier) {
    let n = 0;
    for (const u of planUnits()) {
      const it = u.equipment && u.equipment[slot];
      if (!it) continue;
      const def = G.EQUIPMENT[it.itemId];
      if (!def || def.tier < minTier) continue;
      if (def.durability > 0 && it.durability <= 0) continue;   // rozbité nepočítáme
      n++;
    }
    return n;
  };

  /**
   * Změří krok proti stavu světa a zapíše `qty`/`needed`/`done`.
   * Nic jiného neupravuje — plán je odhad, měření je fakt.
   */
  G.measureStep = function (step, goal) {
    let qty = 0, needed = step.needed;
    if (step.kind === 'have') {
      if (step.what === 'material') {
        // `quality` je volitelný parametr záměru: „mít 20× železa JEMNÉHO"
        // není totéž jako „mít 20× železa", a `matCount` by to zaměřilo všech
        // kvalit dohromady.
        qty = step.quality ? G.matCountQuality(step.material, step.quality) : G.matCount(step.material);
      }
      else if (step.what === 'food') qty = G.matCount('bread') + G.matCount('fish');
      else if (step.what === 'renown') qty = (G.state.resources && G.state.resources.renown) || 0;
    }
    else if (step.kind === 'skill') {
      qty = planUnits().filter(u => G.unitSkill(u, step.id) >= step.level).length;
      needed = step.needed || step.units || 1;
    }
    else if (step.kind === 'equip') {
      qty = G.equippedCount(step.slot, step.minTier || 1);
      needed = step.needed || step.units || 1;
    }
    else if (step.kind === 'count' && step.what === 'partyPower') {
      const units = planUnits().slice().sort((a, b) => G.expeditionPowerOf([b]) - G.expeditionPowerOf([a]));
      const take = step.units || (G.EXPEDITION_MIN_PARTY || 2);
      qty = Math.round(G.expeditionPowerOf(units.slice(0, take)));
      needed = step.needed;
    }
    else if (step.kind === 'expedition' && step.what === 'depart') {
      const since = goal && goal.createdAt ? goal.createdAt : 0;
      qty = (G.state.expeditions || []).some(e =>
        e.templateId === step.expeditionId && (e.startedAt || 0) >= since) ? 1 : 0;
      needed = 1;
    }
    else if (step.kind === 'visit') {
      const visited = (G.state.stats && G.state.stats.settlementsVisited) || [];
      qty = step.settlementId
        ? (visited.indexOf(step.settlementId) !== -1 ? 1 : 0)
        : visited.length;
      needed = step.needed;
    }
    step.qty = Math.max(0, Math.min(needed, qty));
    step.needed = needed;
    step.done = step.qty >= needed;
    return step;
  };

  /** Jednotky práce na JEDNU jednotku kroku (z reálných dat, ne odhadem). */
  G.stepWorkPerUnit = function (step) {
    if (step.kind === 'have') {
      if (step.what === 'material') return G.materialWork(step.material);
      if (step.what === 'food') {
        const both = [G.materialWork('bread'), G.materialWork('fish')].filter(x => x > 0);
        return both.length ? Math.min.apply(null, both) : 0;
      }
      return 0;                    // renomé nevyrábíš prací — a mezera u něj je 0 jen proto, že ho nelze vypracovat
    }
    if (step.kind === 'skill') return G.xpForLevel ? G.xpForLevel(step.level || 1) : 0;
    return 0;                      // výbava a odjezd nejsou práce, ale cesta k nim ano
  };

  /**
   * MEZERA: kolik jednotek práce ještě chybí do kroku (ARCHITEKTURA_PREMISA
   * §3.4). Vrací 0, když je krok hotový — a to je jediné, podle čeho se
   * rozhoduje rozdělovac.
   */
  G.stepGap = function (step, goal) {
    if (!step) return 0;
    G.measureStep(step, goal);          // vždy přeměřit: uložené `qty` je dohad, ne fakt
    const missing = Math.max(0, (step.needed || 0) - (step.qty || 0));
    if (!missing) return 0;
    return missing * G.stepWorkPerUnit(step);
  };

  /** Podíl mezery 0–1 — to je veličina, kterou váhy rozdělovace násobí. */
  G.stepGapFraction = function (step, goal) {
    if (!step) return 0;
    G.measureStep(step, goal);
    const needed = step.needed || 0;
    if (needed <= 0) return 0;
    return Math.max(0, Math.min(1, (needed - (step.qty || 0)) / needed));
  };

  /** Přepočítá celý plán záměru a označí záměr jako splněný. */
  G.refreshGoal = function (goal) {
    if (!goal || !goal.plan) return null;
    for (const s of goal.plan) G.measureStep(s, goal);
    // Záměr ze směrnice je TRVALÉ přání („drž železo"), ne jednorázovka:
    // splnění ho neruší, jinak by boost zmizel právě ve chvíli, kdy je
    // suroviny dost, a hráč by musel směrnici znovu nastavit.
    if (goal.via !== 'directive' && G.isGoalActive(goal) &&
        goal.plan.length && goal.plan.every(s => s.done)) {
      goal.status = 'met';
      goal.metAt = G.state.time || 0;
      G.log(`✅ Záměr splněn: ${goal.label}`, 'work');
    }
    return goal;
  };

  /** Všechny NESPLNĚNÉ kroky živých záměrů — vstup rozdělovace. */
  G.listActiveSteps = function () {
    const out = [];
    for (const goal of G.listGoals('active')) {
      if (!goal.plan || !goal.plan.length) continue;
      for (const step of goal.plan) if (!step.done) out.push({ goal: goal, step: step });
    }
    return out;
  };

  /** Naplánuje nový záměr hned — plán je součást záměru, ne pozdější doplněk. */
  G.planNewGoal = function (goal) {
    G.planGoal(goal);
    return G.refreshGoal(goal);
  };

  /** Zaznamená návštěvu sídla (API pro UI i pro průzkumný záměr). */
  G.visitSettlement = function (id) {
    if (!G.state.stats) G.state.stats = {};
    if (!G.state.stats.settlementsVisited) G.state.stats.settlementsVisited = [];
    const list = G.state.stats.settlementsVisited;
    if (list.indexOf(id) !== -1) return false;
    list.push(id);
    return true;
  };

  /** Přepočítá plány všech živých záměrů; volá se z rytmu hry. */
  G.tickGoals = function () {
    for (const goal of G.listGoals('active')) {
      // plán bez kroků = záměr z Fáze A; změněné parametry = plán zastaralý
      if (!goal.plan || !goal.plan.length || goal.planSig !== JSON.stringify(goal.params)) G.planGoal(goal);
      else G.refreshGoal(goal);
    }
  };
})();