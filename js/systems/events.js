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

  G.tickEvents = function (dt) {
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
    weNextIn = G.WORLD_EVENT_INTERVAL[0] + G.rand() * (G.WORLD_EVENT_INTERVAL[1] - G.WORLD_EVENT_INTERVAL[0]);
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
  G.startEvent = function (templateId) {
    const tpl = G.WORLD_EVENTS[templateId]; if (!tpl) return null;
    const ev = { id:'we'+(weSeq++), templateId, startedAt: G.state.time, endsAt: G.state.time + tpl.duration };
    if (!G.state.worldEvents) G.state.worldEvents = [];
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
    q.status = 'active'; q.acceptedAt = G.state.time; q.expiresAt = G.state.time + q.deadline;
    G.log(`📜 Přijata zakázka: ${q.text}`);
    return { ok:true };
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
          if (q.factionId) G.addRep(q.factionId, G.REP_QUEST_FAIL);
          G.addSettlementRep(sid, -3);
          G.log(`❌ Zakázka propadla: ${q.text}`);
        }
        if (q.status === 'available' && G.state.time > q.expiresAt) q.status = 'declined';
      }
      G.state.quests[sid] = list.filter(x => x.status === 'available' || x.status === 'active');
      G.ensureQuests(sid);
    }
  };
  G.activeQuests = function () {
    const out = [];
    if (!G.state.quests) return out;
    for (const sid in G.state.quests) for (const q of G.state.quests[sid]) if (q.status === 'active') out.push(q);
    return out;
  };
  G.questTimeLeft = function (q) { return Math.max(0, q.expiresAt - G.state.time); };

  /* ---------- příběhové kvesty ---------- */
  let storyTimer = 0;
  G.tickStory = function (dt) {
    if (G.simulating) return;
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
        choices: q.choices.map((c, i) => ({ text: c.text, index: i }))
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
    if (!def) { G.state.pendingStory = null; G.resumeGame(); return; }
    const choice = def.choices[choiceIndex];
    if (!choice) return;
    applyStoryEffects(choice.effects || []);
    if (!G.state.story) G.state.story = { completed:[], flags:{} };
    if (!G.state.story.completed.includes(def.id)) G.state.story.completed.push(def.id);
    G.state.pendingStory = null;
    G.hideStoryModal();
    G.resumeGame();
  };
  function applyStoryEffects(effects) {
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
    }
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
})();
