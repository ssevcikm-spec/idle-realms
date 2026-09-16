(function () {
  const G = window.Game;

  const EVENTS = [
    { id:'lost_traveler', title:'Ztracený poutník', text:'U cesty jste potkali vyčerpaného poutníka.',
      choices:[
        { text:'Pomoci mu', effects:[
          { type:'mat', material:'bread', qty:1 }, { type:'renown', value:2 },
          { type:'log', text:'🙏 Poutník poděkoval.' } ] },
        { text:'Nechat ho být', effects:[ { type:'log', text:'Prošli jste kolem.' } ] },
        { text:'Okrást ho', effects:[ { type:'gold', value:6 }, { type:'renown', value:-2 },
          { type:'log', text:'💰 Získali jste 6 zlata.' } ] }
      ] },
    { id:'rich_vein', title:'Bohatá žíla', text:'Objevili jste vzácnou žílu.',
      choices:[
        { text:'Vytěžit hned', effects:[ { type:'mat', material:'iron_ore', qty:6 },
          { type:'log', text:'⛏️ Vytěžili jste 6 rudy.' } ] },
        { text:'Označit', effects:[ { type:'mat', material:'iron_ore', qty:2, quality:'fine' }, { type:'renown', value:1 } ] }
      ] },
    { id:'wolf', title:'Vlk v lese', text:'Cestu vám zkřížil vlk.',
      choices:[
        { text:'Bojovat', effects:[ { type:'combat', difficulty:3 } ] },
        { text:'Utéct', effects:[ { type:'mat', material:'hide', qty:-1 }, { type:'log', text:'💨 Utekli jste.' } ] }
      ] },
    { id:'merchant', title:'Potulný obchodník', text:'Nabízí výhodnou koupi.',
      choices:[
        { text:'Koupit byliny (3 zlata)', effects:[ { type:'gold', value:-3 }, { type:'mat', material:'herb', qty:4 } ] },
        { text:'Koupit rudu (8 zlat)', effects:[ { type:'gold', value:-8 }, { type:'mat', material:'iron_ore', qty:4 } ] },
        { text:'Odmítnout', effects:[ { type:'log', text:'Odmítli jste.' } ] }
      ] },
    { id:'abandoned_cart', title:'Opuštěný vůz', text:'Na kraji cesty stojí opuštěný vůz.',
      choices:[
        { text:'Prohledat', effects:[ { type:'loot', table:[
          { chance:0.5, material:'plank', qty:3 },
          { chance:0.3, material:'iron_ingot', qty:1, quality:'fine' },
          { chance:0.2, material:'cloth', qty:2 },
          { chance:0.15, material:'jewel', qty:1 } ] } ] },
        { text:'Jít dál', effects:[ { type:'log', text:'Nechali jste vůz být.' } ] }
      ] }
  ];
  let eventTimer = 0;
  const CHECK_EVERY = 55, CHANCE = 0.25;

  // Náhodné popup události jsou dočasně VYPNUTÉ — čekají na přepracování
  // na osobní momenty postav (viz docs/PLAN_HRATELNOST.md). Zapnutí: = true.
  G.EVENTS_ENABLED = false;

  G.tickEvents = function (dt) {
    if (!G.EVENTS_ENABLED) return;
    if (G.simulating) return;
    if (G.state.pendingEvents.length) return;
    eventTimer += dt;
    if (eventTimer < CHECK_EVERY) return;
    eventTimer = 0;
    if (!G.chance(CHANCE)) return;
    const ev = EVENTS[G.randInt(0, EVENTS.length - 1)];
    const instance = Object.assign({}, ev, { instanceId:'e' + Date.now() + '_' + G.randInt(0, 9999) });
    G.state.pendingEvents.push(instance);
    G.pauseGame();
    G.showEventModal(instance);
  };

  G.resolveEvent = function (instanceId, choiceIndex) {
    const idx = G.state.pendingEvents.findIndex(e => e.instanceId === instanceId);
    if (idx < 0) return;
    const ev = G.state.pendingEvents[idx];
    const choice = ev.choices[choiceIndex];
    if (!choice) return;
    applyEffects(choice.effects || []);
    G.state.pendingEvents.splice(idx, 1);
    if (G.state.pendingEvents.length > 0) G.showEventModal(G.state.pendingEvents[0]);
    else { G.hideEventModal(); G.resumeGame(); }
  };

  function applyEffects(effects) {
    for (const e of effects) {
      if (e.type === 'mat') {
        if (e.qty >= 0) G.matAdd(e.material, e.qty, e.quality || 'common');
        else G.matRemove(e.material, -e.qty);
      } else if (e.type === 'gold') {
        G.state.resources.gold = Math.max(0, G.state.resources.gold + e.value);
        if (e.value > 0) G.log(`🪙 +${e.value} zlata.`);
      } else if (e.type === 'renown') {
        G.state.resources.renown = Math.max(0, G.state.resources.renown + e.value);
      } else if (e.type === 'log') G.log(e.text);
      else if (e.type === 'combat') {
        const idle = G.state.units.filter(u => !u.resting && !(G.hasSevereInjury && G.hasSevereInjury(u)));
        if (idle.length) {
          const node = G.WORLD.nodes.find(n => G.NODE_DANGER[n.kind] >= 2) || G.WORLD.nodes[0];
          G.startCombat(node, idle, { tactic:'balanced' });
        }
      } else if (e.type === 'loot') {
        for (const it of e.table) {
          if (G.rand() < it.chance) {
            G.matAdd(it.material, it.qty, it.quality || 'common');
            G.log(`📦 Nalezeno: ${it.qty}× ${G.MATERIALS[it.material].name}.`);
          }
        }
      }
    }
  }

  /* ---------- karavany ---------- */
  let carSeq = 1;
  G.setCaravanSeq = function (v) { carSeq = v; };
  let spawnTimer = 0;

  G.tickCaravans = function (dt) {
    if (!G.state.caravans) G.state.caravans = [];
    for (const c of G.state.caravans.slice()) {
      const from = G.WORLD.settlementById[c.fromId];
      const to = G.WORLD.settlementById[c.toId];
      if (!from || !to) { removeCaravan(c.id); continue; }
      const dist = Math.hypot(to.x - from.x, to.y - from.y) || 1;
      const type = G.CARAVAN_TYPES[c.type];
      c.progress += (type.speed / dist) * dt;
      c.pos = {
        x: from.x + (to.x - from.x) * c.progress,
        y: from.y + (to.y - from.y) * c.progress
      };
      if (c.progress >= 1) arriveCaravan(c);
    }
    spawnTimer += dt;
    if (spawnTimer < G.CARAVAN_SPAWN_INTERVAL) return;
    spawnTimer = 0;
    if (G.state.caravans.length < G.CARAVAN_TARGET_COUNT) trySpawnCaravan();
  };

  function trySpawnCaravan() {
    if (!G.ROADS || !G.ROADS.length) return;
    const [aId, bId] = G.ROADS[G.randInt(0, G.ROADS.length - 1)];
    const a = G.WORLD.settlementById[aId], b = G.WORLD.settlementById[bId];
    if (!a || !b) return;
    let typeId = 'trade';
    if (a.size === 'city' || b.size === 'city') typeId = 'royal';
    else if (G.rand() < 0.3) typeId = 'supply';
    const type = G.CARAVAN_TYPES[typeId];
    const cargo = [];
    const n = G.randInt(1, type.cargoSlots);
    for (let i = 0; i < n; i++) {
      const mat = G.CARAVAN_GOODS[G.randInt(0, G.CARAVAN_GOODS.length - 1)];
      cargo.push({ material: mat, qty: G.randInt(2, 8) });
    }
    G.state.caravans.push({
      id:'c'+(carSeq++), type: typeId, fromId: aId, toId: bId,
      progress: 0, cargo, pos: { x: a.x, y: a.y }, createdAt: G.state.time
    });
  }

  function arriveCaravan(c) {
    const st = G.state.economy[c.toId];
    if (st) for (const item of c.cargo) st.stock[item.material] = (st.stock[item.material] || 0) + item.qty;
    if (G.chance(0.35)) {
      const backId = c.fromId;
      const newCargo = [];
      const type = G.CARAVAN_TYPES[c.type];
      const n = G.randInt(1, type.cargoSlots);
      for (let i = 0; i < n; i++) {
        const mat = G.CARAVAN_GOODS[G.randInt(0, G.CARAVAN_GOODS.length - 1)];
        newCargo.push({ material: mat, qty: G.randInt(2, 6) });
      }
      c.fromId = c.toId; c.toId = backId; c.progress = 0; c.cargo = newCargo;
    } else removeCaravan(c.id);
  }
  function removeCaravan(id) { G.state.caravans = (G.state.caravans || []).filter(x => x.id !== id); }
  G.removeCaravan = removeCaravan;
  G.spawnCaravanNow = function (fromId, toId, typeId) {
    if (!fromId || !toId) return null;
    const a = G.WORLD.settlementById[fromId], b = G.WORLD.settlementById[toId];
    if (!a || !b) return null;
    const type = G.CARAVAN_TYPES[typeId || 'trade'];
    const cargo = [];
    for (let i = 0; i < type.cargoSlots; i++) {
      const mat = G.CARAVAN_GOODS[G.randInt(0, G.CARAVAN_GOODS.length - 1)];
      cargo.push({ material: mat, qty: G.randInt(2, 6) });
    }
    const c = { id:'c'+(carSeq++), type: typeId || 'trade', fromId, toId, progress: 0, cargo, pos:{ x:a.x, y:a.y }, createdAt: G.state.time };
    if (!G.state.caravans) G.state.caravans = [];
    G.state.caravans.push(c);
    return c;
  };

  /* ---------- světové události ---------- */
  let weSeq = 1;
  G.setWorldEventSeq = function (v) { weSeq = v; };
  let weTimer = 0;
  let weNextIn = G.WORLD_EVENT_INTERVAL[0];

  G.tickWorldEvents = function (dt) {
    if (!G.state.worldEvents) G.state.worldEvents = [];
    const now = G.state.time;
    const ended = [];
    for (const ev of G.state.worldEvents) if (now >= ev.endsAt) ended.push(ev);
    for (const ev of ended) {
      const tpl = G.WORLD_EVENTS[ev.templateId];
      G.log(`🌍 Světová událost skončila: ${tpl ? tpl.name : ev.templateId}.`);
    }
    G.state.worldEvents = G.state.worldEvents.filter(ev => now < ev.endsAt);
    weTimer += dt;
    if (weTimer < weNextIn) return;
    weTimer = 0;
    const weDurMult = G.unlockEventDurationMult ? G.unlockEventDurationMult() : 1;
    weNextIn = (G.WORLD_EVENT_INTERVAL[0] + G.rand() * (G.WORLD_EVENT_INTERVAL[1] - G.WORLD_EVENT_INTERVAL[0])) / weDurMult;
    if (G.state.worldEvents.length >= G.WORLD_EVENT_MAX) return;
    if (G.simulating) return;
    startRandomWorldEvent();
  };

  function startRandomWorldEvent() {
    const activeIds = new Set(G.state.worldEvents.map(e => e.templateId));
    const pool = [];
    for (const id in G.WORLD_EVENTS) {
      if (activeIds.has(id)) continue;
      const tpl = G.WORLD_EVENTS[id];
      for (let i = 0; i < (tpl.weight || 1); i++) pool.push(id);
    }
    if (!pool.length) return;
    startWorldEvent(pool[G.randInt(0, pool.length - 1)]);
  }
  G.startEvent = function (templateId, force) {
    const tpl = G.WORLD_EVENTS[templateId]; if (!tpl) return null;
    if (!G.state.worldEvents) G.state.worldEvents = [];
    if (!force) {
      if (G.state.worldEvents.some(e => e.templateId === templateId)) return null;
      if (G.state.worldEvents.length >= G.WORLD_EVENT_MAX) return null;
    }
    const evMult = G.unlockEventDurationMult ? G.unlockEventDurationMult() : 1;
    const ev = { id:'we'+(weSeq++), templateId, startedAt: G.state.time, endsAt: G.state.time + tpl.duration * evMult };
    G.state.worldEvents.push(ev);
    G.log(`${tpl.icon} Světová událost: ${tpl.name} — ${tpl.desc}`);
    return ev;
  };
  G.startWorldEvent = G.startEvent;

  G.worldEventPriceMult = function (matId, mode) {
    if (!G.state.worldEvents || !G.state.worldEvents.length) return 1;
    let mult = 1;
    for (const ev of G.state.worldEvents) {
      const tpl = G.WORLD_EVENTS[ev.templateId];
      if (!tpl || !tpl.priceMods) continue;
      if (tpl.priceMods[matId] && tpl.priceMods[matId][mode] != null) mult *= tpl.priceMods[matId][mode];
      if (tpl.priceMods.all && tpl.priceMods.all[mode] != null) mult *= tpl.priceMods.all[mode];
    }
    return mult;
  };
  G.worldEventRenownMult = function () {
    if (!G.state.worldEvents || !G.state.worldEvents.length) return 1;
    let mult = 1;
    for (const ev of G.state.worldEvents) {
      const tpl = G.WORLD_EVENTS[ev.templateId];
      if (tpl && tpl.renownMult) mult *= tpl.renownMult;
    }
    return mult;
  };
  G.worldEventStaminaMult = function () {
    if (!G.state.worldEvents || !G.state.worldEvents.length) return 1;
    let mult = 1;
    for (const ev of G.state.worldEvents) {
      const tpl = G.WORLD_EVENTS[ev.templateId];
      if (tpl && tpl.staminaMult) mult *= tpl.staminaMult;
    }
    return mult;
  };
  G.worldEventTimeLeft = function (ev) { return Math.max(0, ev.endsAt - G.state.time); };

  /* ---------- zakázky ---------- */
  let questSeq = 1;
  G.setQuestSeq = function (v) { questSeq = v; };

  // Doprovod je skrytá aktivita — postavy ji plní jako úkol, ale v panelech se neukazuje.
  if (G.ACTIVITIES && !G.ACTIVITIES.escort) {
    G.ACTIVITIES.escort = {
      id: 'escort', name: 'Doprovod', icon: '🚶', nodeKinds: [], hidden: true,
      skill: 'combat', attr: 'agi', mode: 'timed', workRequired: 1, xpReward: 30, output: []
    };
  }
  G.generateQuest = function (settlementId) {
    const def = G.WORLD.settlementById[settlementId];
    if (!def) return null;
    const sizeIdx = def.size === 'city' ? 2 : def.size === 'town' ? 1 : 0;
    const pool = [];
    for (const tid in G.QUEST_TEMPLATES) {
      const t = G.QUEST_TEMPLATES[tid];
      if (t.minSize && sizeIdx < t.minSize) continue;
      for (let i = 0; i < (t.weight || 1); i++) pool.push(t);
    }
    if (!pool.length) return null;
    const template = pool[G.randInt(0, pool.length - 1)];
    const data = template.generate(sizeIdx);
    const facId = G.SETTLEMENT_FACTION[settlementId];
    return Object.assign({
      id:'q'+(questSeq++), templateId: template.id, kind: template.kind,
      settlementId, factionId: facId,
      deadline: data.deadline, createdAt: G.state.time,
      expiresAt: G.state.time + data.deadline + 1800,
      status:'available', acceptedAt: null
    }, data);
  };
  G.ensureQuests = function (settlementId) {
    if (!G.state.quests) G.state.quests = {};
    if (!G.state.quests[settlementId]) G.state.quests[settlementId] = [];
    const def = G.WORLD.settlementById[settlementId];
    if (!def) return;
    const sizeIdx = def.size === 'city' ? 2 : def.size === 'town' ? 1 : 0;
    const slots = G.questSlots(sizeIdx);
    const list = G.state.quests[settlementId];
    while (list.filter(q => q.status === 'available').length < slots) {
      const q = G.generateQuest(settlementId);
      if (!q) break;
      list.push(q);
    }
  };
  G.acceptQuest = function (settlementId, questId) {
    const list = G.state.quests[settlementId] || [];
    const q = list.find(x => x.id === questId);
    if (!q || q.status !== 'available') return { ok:false, reason:'Zakázka není dostupná.' };
    if (G.activeQuestCount() >= G.MAX_ACTIVE_QUESTS) return { ok:false, reason:`Max ${G.MAX_ACTIVE_QUESTS} aktivních.` };
    // Doprovod skutečně zaměstná postavy — bez volné postavy to nejde.
    if (q.kind === 'escort') {
      const s = G.WORLD.settlementById[settlementId];
      const site = s ? { x: s.x + 0.5, y: s.y + 0.5, name: s.name } : null;
      const esc = escortCandidates(site);
      if (!esc.length) return { ok:false, reason:'Doprovod potřebuje volnou postavu — teď nikdo nemůže jít.' };
      for (const u of esc) {
        if (u.assignedTaskId) G.cancelTask(u.assignedTaskId);
        if (u.resting && G.wakeUnit) G.wakeUnit(u);
      }
      const t = G.startTask('escort', esc.map(u => u.id), {
        nodeId: 'site:escort:' + q.id,
        workRequired: Math.max(1, Math.round((q.escortDays || 1) * G.TIME.dayLength)),
        site: site ? { x: site.x, y: site.y } : undefined,
        siteName: site ? site.name : undefined,
        quiet: true
      });
      q.taskId = t ? t.id : null;
      q.escortUnitIds = esc.map(u => u.id);
      G.log(`🚶 Doprovod: ${esc.map(u => u.name.split(' ')[0]).join(', ')} vyrazili (${q.escortDays} dní).`, 'work');
    }
    q.status = 'active'; q.acceptedAt = G.state.time; q.expiresAt = G.state.time + q.deadline;
    q.killCountAtAccept = (G.state.killCounts && G.state.killCounts[q.killType]) || 0;
    q.visitedAtAccept = (G.state.stats.settlementsVisited || []).length;
    G.log(`📜 Přijata zakázka: ${q.text}`);
    return { ok:true };
  };
  /** Volné schopné postavy pro doprovod (až 2, nejbližší k místu). */
  function escortCandidates(site) {
    const out = [];
    for (const u of G.state.units) {
      if (u.dead || u.isChild || u.onExpedition) continue;
      if (G.workBlockReason && G.workBlockReason(u)) continue;
      if (!u.pos) continue;
      const d = site ? Math.hypot(u.pos.x - site.x, u.pos.y - site.y) : 0;
      out.push({ u, d });
    }
    out.sort((a, b) => (a.d - b.d) || (G.unitSkill(b.u, 'combat') - G.unitSkill(a.u, 'combat')));
    return out.slice(0, 2).map(x => x.u);
  }
  /** Uvolní postavy z doprovodu (při odevzdání i propadnutí). */
  function clearEscort(q) {
    if (!q.taskId) { q.escortUnitIds = null; return; }
    const t = G.state.tasks.find(x => x.id === q.taskId);
    if (t) G.cancelTask(t.id);
    q.taskId = null; q.escortUnitIds = null;
  }
  /** Může se zakázka odevzdat? (jediné místo s logikou per-kind) */
  G.canTurnInQuest = function (q) {
    if (!q || q.status !== 'active') return false;
    if (q.kind === 'deliver') return (q.need || []).every(n => !n.material || G.matCount(n.material) >= n.qty);
    if (q.kind === 'kill') {
      const have = ((G.state.killCounts && G.state.killCounts[q.killType]) || 0) - (q.killCountAtAccept || 0);
      return have >= (q.killCount || 0);
    }
    if (q.kind === 'explore') {
      const have = (G.state.stats.settlementsVisited || []).length - (q.visitedAtAccept || 0);
      return have >= (q.exploreCount || 0);
    }
    if (q.kind === 'escort') return G.state.time >= (q.acceptedAt || 0) + (q.escortDays || 0) * G.TIME.dayLength;
    return false;
  };
  G.activeQuestCount = function () {
    if (!G.state.quests) return 0;
    let n = 0;
    for (const sid in G.state.quests) for (const q of G.state.quests[sid]) if (q.status === 'active') n++;
    return n;
  };
  G.turnInQuest = function (settlementId, questId) {
    const list = G.state.quests[settlementId] || [];
    const q = list.find(x => x.id === questId);
    if (!q || q.status !== 'active') return { ok:false, reason:'Zakázka není aktivní.' };
    if (G.state.time > q.expiresAt) return { ok:false, reason:'Vypršela.' };
    for (const n of (q.need || [])) {
      if (n.material && G.matCount(n.material) < n.qty) return { ok:false, reason:`Chybí ${n.qty}× ${G.MATERIALS[n.material].name}.` };
    }
    for (const n of (q.need || [])) if (n.material) G.matRemove(n.material, n.qty);
    const gold = q.reward.gold || 0;
    const renown = q.reward.renown || 0;
    const rep = q.reward.rep || 0;
    G.state.resources.gold += gold;
    G.state.resources.renown += renown;
    if (q.factionId && rep) G.addRep(q.factionId, rep);
    G.addSettlementRep(settlementId, 8);
    for (const u of G.state.units) G.addSkillXp(u, 'crafting', 3 + (q.reward.renown || 0));
    q.status = 'done';
    clearEscort(q);
    if (!G.state.stats.questsCompleted) G.state.stats.questsCompleted = 0;
    G.state.stats.questsCompleted++;
    G.log(`✅ Zakázka splněna: +${gold} 🪙, +${renown} ⭐, +${rep} rep.`);
    return { ok:true, gold, renown, rep };
  };
  G.declineQuest = function (settlementId, questId) {
    const list = G.state.quests[settlementId] || [];
    const q = list.find(x => x.id === questId);
    if (!q || q.status === 'done' || q.status === 'failed') return;
    if (q.factionId) G.addRep(q.factionId, -1);
    q.status = 'declined';
    G.state.quests[settlementId] = list.filter(x => x.id !== questId);
  };
  let questTimer = 0;
  const QUEST_TICK = 30;
  G.tickQuests = function (dt) {
    questTimer += dt;
    if (questTimer < QUEST_TICK) return;
    questTimer = 0;
    if (!G.state.quests) G.state.quests = {};
    for (const sid in G.state.quests) {
      const list = G.state.quests[sid];
      for (const q of list) {
        if (q.status === 'active' && G.state.time > q.expiresAt) {
          q.status = 'failed';
          clearEscort(q);
          if (q.factionId) G.addRep(q.factionId, G.REP_QUEST_FAIL);
          G.addSettlementRep(sid, -3);
          G.log(`❌ Zakázka propadla: ${q.text}`);
        }
        if (q.status === 'available' && G.state.time > q.expiresAt) q.status = 'declined';
      }
      G.state.quests[sid] = list.filter(x => x.status === 'available' || x.status === 'active');
      G.ensureQuests(sid);
      if (G.autoQuestMode() !== 'off') tryAutoQuest(sid);
    }
    if (G.autoQuestMode() !== 'off') tryAutoTurnIn();
  };

  /** Jak se hra chová k zakázkám sama: 'off' | 'deliver' | 'all'. */
  G.autoQuestMode = function () {
    const s = G.state.settings || {};
    return s.autoQuests || 'off';
  };
  G.setAutoQuestMode = function (mode) {
    if (!G.state.settings) G.state.settings = {};
    G.state.settings.autoQuests = (mode === 'deliver' || mode === 'all') ? mode : 'off';
  };

  /** Automaticky vezme dostupnou zakázku, kterou jde rozumně splnit. */
  function tryAutoQuest(sid) {
    if (G.activeQuestCount() >= G.MAX_ACTIVE_QUESTS) return;
    const mode = G.autoQuestMode();
    const list = (G.state.quests[sid] || []).filter(q => q.status === 'available');
    list.sort((a, b) => (b.reward.renown || 0) - (a.reward.renown || 0));
    for (const q of list) {
      if (mode === 'deliver' && q.kind !== 'deliver') continue;
      if (q.kind === 'deliver') {
        const have = (q.need || []).every(n => !n.material || G.matCount(n.material) >= n.qty);
        if (!have) continue;   // nepřebírej, co nejde splnit
      }
      const res = G.acceptQuest(sid, q.id);
      if (res.ok) { G.log(`🤖 Automaticky přijata zakázka: ${q.text}`, 'info'); return; }
      if (res.reason && res.reason.indexOf('postav') !== -1) return;   // doprovod bez postav — zkus až příště
    }
  }
  /** Odevzdá splněné aktivní zakázky (když je automatika zapnutá). */
  function tryAutoTurnIn() {
    for (const sid in G.state.quests) {
      for (const q of G.state.quests[sid]) {
        if (q.status !== 'active') continue;
        if (!G.canTurnInQuest(q)) continue;
        const res = G.turnInQuest(sid, q.id);
        if (res.ok) G.log(`🤖 Zakázka odevzdána automaticky: ${q.text}`, 'info');
      }
    }
  }
  G.activeQuests = function () {
    const out = [];
    if (!G.state.quests) return out;
    for (const sid in G.state.quests) for (const q of G.state.quests[sid]) if (q.status === 'active') out.push(q);
    return out;
  };
  G.questTimeLeft = function (q) { return Math.max(0, q.expiresAt - G.state.time); };

  /* ---------- příběhové kvesty ---------- */
  let storyTimer = 0;

  /** Jsou příběhové popupy zapnuté? (menu → přepínač) */
  G.storyPopupsEnabled = function () {
    const s = G.state.settings || {};
    return s.storyPopups !== false;
  };

  /** Hodnota příběhové vlajky (trvalé rozhodnutí hráče). */
  G.storyFlag = function (name) {
    const f = G.state.story && G.state.story.flags;
    return f ? f[name] : undefined;
  };

  /** Trvalé efekty vlajek — jediné místo, kde se popisují. */
  const FLAG_EFFECTS = {
    'plan:base': 'trvale: 🏕️ základna už při renomé 20 (místo 25)',
    'plan:trade': 'trvale: ⚖️ prodejní ceny +8 %',
    'plan:war': 'trvale: ⚔️ bojová síla postav +10 %',
    'allegiance:crown': 'trvale: 👑 zisky reputace u Koruny +25 %',
    'allegiance:free': 'trvale: 🌲 zisky reputace u Bratrstva a cechu +25 %',
    'allegiance:independent': 'trvale: ⚖️ ztráty reputace poloviční',
    'oath:forest': 'trvale: 🌿 +1 bylina z každého sběru',
    'cave_cleared': 'trvale: 💎 +1 krystal z těžby krystalu',
    'cave_sealed': 'trvale: 🪨 nebezpečí v jeskyních −40 %',
    'merchant_unlocked': 'záznam: 🐎 obchodník na cestách',
    'chapter1_done': 'záznam: 📖 první kapitola uzavřena'
  };
  G.storyFlagEffectText = function (flag, value) {
    return FLAG_EFFECTS[flag + ':' + value] || FLAG_EFFECTS[flag] || `záznam: ${flag} = ${value}`;
  };

  /** Lidsky čitelný popis efektů volby (náhled před volbou i souhrn po ní). */
  G.storyEffectText = function (effects) {
    const out = [];
    const mat = (m) => G.MATERIALS[m] ? `${G.MATERIALS[m].icon} ${G.MATERIALS[m].name}` : m;
    for (const e of (effects || [])) {
      if (e.type === 'log') continue;
      else if (e.type === 'mat') out.push(`${e.qty >= 0 ? '+' : ''}${e.qty}× ${mat(e.material)}`);
      else if (e.type === 'cost_mat') out.push(`−${e.qty}× ${mat(e.material)}`);
      else if (e.type === 'gold') out.push(`${e.value >= 0 ? '+' : ''}${e.value} 🪙`);
      else if (e.type === 'cost_gold') out.push(`−${e.value} 🪙`);
      else if (e.type === 'renown') out.push(`${e.value >= 0 ? '+' : ''}${e.value} ⭐`);
      else if (e.type === 'bonus_rep') {
        const f = G.FACTIONS[e.faction];
        out.push(`${e.value >= 0 ? '+' : ''}${e.value} reputace${f ? ` (${f.name})` : ''}`);
      } else if (e.type === 'combat') out.push(`⚔️ souboj (obtížnost ${e.difficulty})`);
      else if (e.type === 'unlock_base') out.push('🏕️ odemkne základnu');
      else if (e.type === 'set_flag') out.push(G.storyFlagEffectText(e.flag, e.value));
    }
    return out.join(' • ');
  };

  G.tickStory = function (dt) {
    if (G.simulating) return;
    if (!G.storyPopupsEnabled()) return;
    if (G.state.pendingStory) return;
    if (G.state.pendingEvents && G.state.pendingEvents.length) return;
    storyTimer += dt;
    if (storyTimer < G.STORY_CHECK_INTERVAL) return;
    storyTimer = 0;
    if (!G.state.story) G.state.story = { completed:[], flags:{} };
    for (const q of G.STORY_QUESTS) {
      if (G.state.story.completed.includes(q.id)) continue;
      let ok = false;
      try { ok = q.trigger(G.state); } catch (e) { ok = false; }
      if (!ok) continue;
      G.state.pendingStory = {
        id: q.id, title: q.title, text: q.text,
        choices: q.choices.map((c, i) => ({
          text: c.text, index: i,
          preview: G.storyEffectText(c.effects || [])
        }))
      };
      G.pauseGame();
      G.showStoryModal(G.state.pendingStory);
      break;
    }
  };
  G.resolveStory = function (choiceIndex) {
    const ps = G.state.pendingStory;
    if (!ps) return;
    const def = G.STORY_QUESTS.find(q => q.id === ps.id);
    if (!def) { G.state.pendingStory = null; G.hideStoryModal(); G.resumeGame(); return; }
    const choice = def.choices[choiceIndex];
    if (!choice) return;
    const summary = applyStoryEffects(choice.effects || []);
    if (!G.state.story) G.state.story = { completed:[], flags:{} };
    if (!G.state.story.choices) G.state.story.choices = {};
    if (!G.state.story.completed.includes(def.id)) G.state.story.completed.push(def.id);
    G.state.story.choices[def.id] = choiceIndex;
    G.state.pendingStory = null;
    G.hideStoryModal();
    G.resumeGame();
    const line = `📖 ${def.title} — ${choice.text}${summary ? ` — ${summary}` : ''}`;
    G.log(line, 'story');
    if (G.toast) G.toast(`📖 ${def.title}: ${choice.text}${summary ? ` — ${summary}` : ''}`, 'story');
  };
  /** Provede efekty volby a vrátí lidsky čitelný souhrn, co se stalo. */
  function applyStoryEffects(effects) {
    const done = [];
    for (const e of effects) {
      if (e.type === 'log') G.log(e.text);
      else if (e.type === 'mat') {
        if (e.qty >= 0) G.matAdd(e.material, e.qty, e.quality || 'common');
        else G.matRemove(e.material, -e.qty);
      } else if (e.type === 'cost_mat') {
        if (G.matCount(e.material) >= e.qty) G.matRemove(e.material, e.qty);
      } else if (e.type === 'gold') G.state.resources.gold = Math.max(0, G.state.resources.gold + e.value);
      else if (e.type === 'cost_gold') G.state.resources.gold = Math.max(0, G.state.resources.gold - e.value);
      else if (e.type === 'renown') G.state.resources.renown += e.value;
      else if (e.type === 'bonus_rep') { if (G.addRep) G.addRep(e.faction, e.value); }
      else if (e.type === 'set_flag') {
        if (!G.state.story) G.state.story = { completed:[], flags:{} };
        if (!G.state.story.flags) G.state.story.flags = {};
        G.state.story.flags[e.flag] = e.value;
      } else if (e.type === 'unlock_base') { if (G.tryUnlockBase) G.tryUnlockBase(); }
      else if (e.type === 'combat') applyCombat(e.difficulty);
      const t = G.storyEffectText([e]);
      if (t) done.push(t);
    }
    return done.join(' • ');
  }
  function applyCombat(difficulty) {
    const idle = G.state.units.filter(u => !u.resting && !(G.hasSevereInjury && G.hasSevereInjury(u)));
    if (!idle.length) { G.log('⚔️ Nemáme kdo by bojoval.'); return; }
    const node = G.WORLD.nodes.find(n => G.NODE_DANGER[n.kind] >= 2) || G.WORLD.nodes[0];
    G.startCombat(node, idle, { tactic:'balanced' });
  }
  G.storyProgress = function () {
    const total = G.STORY_QUESTS.length;
    const done = G.state.story && G.state.story.completed ? G.state.story.completed.length : 0;
    return { done, total };
  };

  /* ---------- achievementy ---------- */
  let achTimer = 0;
  const ACH_INTERVAL = 5;
  G.tickAchievements = function (dt) {
    achTimer += dt;
    if (achTimer < ACH_INTERVAL) return;
    achTimer = 0;
    if (!G.state.achievements) G.state.achievements = { unlocked: [] };
    for (const a of G.ACHIEVEMENTS) {
      if (G.state.achievements.unlocked.includes(a.id)) continue;
      let ok = false;
      try { ok = a.check(G.state); } catch (e) { ok = false; }
      if (!ok) continue;
      G.state.achievements.unlocked.push(a.id);
      const rw = a.reward || {};
      if (rw.gold) { G.state.resources.gold += rw.gold; G.state.stats.goldEarned = (G.state.stats.goldEarned || 0) + rw.gold; }
      if (rw.renown) G.state.resources.renown += rw.renown;
      G.log(`🏆 Cíl splněn: ${a.name}${rw.gold || rw.renown ? ` (+${rw.gold || 0} 🪙, +${rw.renown || 0} ⭐)` : ''}`);
    }
  };
  G.achievementProgress = function () {
    const total = G.ACHIEVEMENTS.length;
    const done = G.state.achievements && G.state.achievements.unlocked ? G.state.achievements.unlocked.length : 0;
    return { done, total };
  };
  G.isAchieved = function (id) {
    return G.state.achievements && G.state.achievements.unlocked && G.state.achievements.unlocked.includes(id);
  };

  /* ---------- Osobní momenty postav (auto + deník, bez hráčských promptů) ---------- */

  // Postavové události jsou ZAPNUTÉ (na rozdíl od starých popup událostí).
  G.CHARACTER_EVENTS_ENABLED = true;
  G.CHARACTER_EVENT_CHANCE = 0.12;

  G.CHARACTER_EVENTS = [
    { id:'find_glowstone', icon:'💎', weight:1, when:{ nodeKinds:['cave','mine'] },
      effects:[{ type:'mat', material:'crystal', qty:[1,2] }],
      journal:'Narazil na třpytivý krystal.' },
    { id:'rich_herb', icon:'🌿', weight:1, when:{ nodeKinds:['grove','forest','marsh'] },
      effects:[{ type:'mat', material:'herb', qty:[1,3] }],
      journal:'Našel vzácnou bylinu.' },
    { id:'inspiration', icon:'✨', weight:1,
      effects:[{ type:'xp', value:15 }],
      journal:'Při práci ho napadlo něco nového.' },
    { id:'help_traveler', icon:'🙏', weight:1, when:{ nodeKinds:['meadow','grove'] },
      effects:[{ type:'mood', value:6 }, { type:'renown', value:1 }],
      journal:'Pomohl ztracenému poutníkovi.' },
    { id:'good_day', icon:'😊', weight:1,
      effects:[{ type:'mood', value:5 }],
      journal:'Dnešní práce ho těšila.' },
    { id:'lucky_coins', icon:'🪙', weight:1,
      effects:[{ type:'gold', value:[2,8] }],
      journal:'Našel pár mincí.' }
  ];

  /** Aplikuje efekty a zapíše osobní moment do deníku + logu. */
  G.resolveCharacterEvent = function (unit, ev) {
    if (!unit || !ev) return null;
    const name = unit.name.split(' ')[0];
    for (const e of (ev.effects || [])) {
      if (e.type === 'mat' && e.material) {
        const q = Array.isArray(e.qty) ? G.randInt(e.qty[0], e.qty[1]) : (e.qty || 1);
        G.matAdd(e.material, q, 'common');
      } else if (e.type === 'xp') {
        if (G.addUnitXp) G.addUnitXp(unit, e.value || 10);
      } else if (e.type === 'mood') {
        if (G.addMood) G.addMood(unit, e.value || 5);
      } else if (e.type === 'renown') {
        G.state.resources.renown += (e.value || 1);
      } else if (e.type === 'gold') {
        const g = Array.isArray(e.value) ? G.randInt(e.value[0], e.value[1]) : (e.value || 5);
        G.state.resources.gold = Math.max(0, G.state.resources.gold + g);
      }
    }
    if (G.addJournal) G.addJournal(unit, ev.journal, ev.icon);
    G.log(`${ev.icon} ${name}: ${ev.journal}`, 'social');
    return ev;
  };

  /** Šance na osobní moment (volá se např. po dokončení úkolu). */
  G.maybeCharacterEvent = function (unit, ctx) {
    if (!G.CHARACTER_EVENTS_ENABLED) return null;
    if (!unit || unit.dead || unit.isChild) return null;
    if (!G.chance(G.CHARACTER_EVENT_CHANCE)) return null;
    const pool = (G.CHARACTER_EVENTS || []).filter(ev =>
      !ev.when || !ev.when.nodeKinds || (ctx && ctx.nodeKind && ev.when.nodeKinds.indexOf(ctx.nodeKind) >= 0));
    const list = pool.length ? pool : G.CHARACTER_EVENTS;
    if (!list.length) return null;
    return G.resolveCharacterEvent(unit, G.pick(list));
  };
})();
