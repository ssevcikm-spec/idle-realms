(function () {
  const G = window.Game;
  let timer = 0;
  const INTERVAL = 2;

  G.tickAutonomy = function (dt) {
    timer += dt;
    if (timer < INTERVAL) return;
    timer = 0;

    if (G.tickProfessions) G.tickProfessions(INTERVAL);
    if (G.tickRestCheck) G.tickRestCheck();
    if (G.tickStaminaRegen) for (const u of G.state.units) G.tickStaminaRegen(u, INTERVAL);
    if (G.tickMood) G.tickMood(INTERVAL);
    if (G.tickRelationships) G.tickRelationships(INTERVAL);
    if (G.tickPersonalityDrift) G.tickPersonalityDrift(INTERVAL);
    if (G.tickPersonalityReactions) G.tickPersonalityReactions(INTERVAL);
    if (G.tickDesertion) G.tickDesertion(INTERVAL);
    if (G.tickAmbitions) G.tickAmbitions(INTERVAL);
    if (G.tickBase) G.tickBase(INTERVAL);
    if (G.tryUnlockBase) G.tryUnlockBase();

    for (const g of G.state.groups) {
      if (!g.focus) continue;
      const act = G.ACTIVITIES[g.focus];
      if (!act) { g.focus = null; continue; }
      const idle = G.groupMembers(g).filter(u =>
        u && !u.dead && !u.isChild && !u.onExpedition && !u.assignedTaskId && !u.resting
        && !(G.hasSevereInjury && G.hasSevereInjury(u))
        && !(u.merchantState && u.merchantState.active)
        && !(G.unitRefusesWork && G.unitRefusesWork(u))
        && !(u._refuseUntil && G.state.time < u._refuseUntil));
      if (!idle.length) continue;
      const node = G.findNodeFor(g.focus, idle.map(u => u.id));
      if (!node) continue;
      G.startTask(g.focus, idle.map(u => u.id), {
        nodeId: node.id,
        targetQty: act.mode === 'quantity' ? (act.defaultQty || 10) : 1,
        auto: true
      });
    }

    for (const u of G.state.units) {
      if (u.dead || u.isChild || u.onExpedition) continue;
      if (u.assignedTaskId || u.resting) continue;
      if (u.merchantState && u.merchantState.active) continue;
      if (G.hasSevereInjury && G.hasSevereInjury(u)) continue;
      if (G.unitRefusesWork && G.unitRefusesWork(u)) continue;
      if (u._refuseUntil && G.state.time < u._refuseUntil) continue;
      if (u.groupId) {
        const g = G.getGroup(u.groupId);
        if (g && g.focus) continue;
      }
      const pick = pickActivity(u);
      if (!pick) continue;
      G.startTask(pick.act.id, [u.id], {
        nodeId: pick.node.id,
        targetQty: pick.act.mode === 'quantity'
          ? Math.max(3, Math.floor((pick.act.defaultQty || 10) / 2))
          : 1,
        auto: true
      });
    }
  };

  function pickActivity(unit) {
    const cands = [];
    const dir = G.state.directives || {};
    const prof = G.professionOf ? G.professionOf(unit) : null;
    for (const aid in G.ACTIVITIES) {
      const a = G.ACTIVITIES[aid];
      if (!meetsReq(unit, a)) continue;
      const node = G.WORLD.nearestNode(a.nodeKinds, unit.pos.x, unit.pos.y);
      if (!node) continue;
      const danger = G.nodeDanger ? G.nodeDanger(node.kind) : 0;
      if (danger >= 2) {
        const power = G.unitCombatPower(unit);
        if (power < danger * 18) continue;
      }
      if (danger === 3) continue;
      if (dir.avoidDanger && danger >= 2) continue;
      const dist = Math.hypot(node.x - unit.pos.x, node.y - unit.pos.y);
      const lvl = G.unitSkill(unit, a.skill);
      let w = (1 + lvl*lvl*0.12) / (1 + dist*0.07);
      if (unit.traits.some(t => t.id === 'likes_nature') && (a.skill === 'woodcutting' || a.skill === 'herbalism')) w *= 2.2;
      if (unit.traits.some(t => t.id === 'likes_stone') && a.skill === 'mining') w *= 2.2;
      if (prof && prof.primary === a.skill) w *= 2.5;
      if (prof && prof.bonus && prof.bonus[a.skill]) w *= 1.5;
      // časový bonus
      if (G.timeWorkMod) w *= G.timeWorkMod(a.skill);
      // směrnice: prioritní materiál
      if (dir.focusMaterial && a.output && a.output.some(o => o.material === dir.focusMaterial)) w *= 8;
      // bez explicitní směrnice: přednostně sháněj materiály, kterých je málo
      else if (a.output) {
        let need = 0;
        for (const o of a.output) need = Math.max(need, materialNeed(o.material));
        if (need > 0) w *= 1 + need * 2;
      }
      cands.push({ act: a, node, w });
    }
    if (!cands.length) return null;
    let total = 0;
    for (const c of cands) total += c.w;
    let r = G.rand() * total;
    for (const c of cands) { r -= c.w; if (r <= 0) return c; }
    return cands[cands.length - 1];
  }
  function meetsReq(unit, a) {
    if (!a.requires || !a.requires.skillLevel) return true;
    for (const sid in a.requires.skillLevel) {
      if (G.unitSkill(unit, sid) < a.requires.skillLevel[sid]) return false;
    }
    return true;
  }
  function materialNeed(matId) {
    const count = G.matCount(matId);
    if (count >= 15) return 0;
    return (15 - count) / 15;
  }
  G.pickActivity = pickActivity;
  G.setDirective = function (key, value) {
    if (!G.state.directives) G.state.directives = { focusMaterial: null, avoidDanger: false };
    G.state.directives[key] = value;
  };
  G.getDirective = function (key) {
    return (G.state.directives || {})[key];
  };

  const REST_THRESHOLD = 20;
  const REGEN_BASE = 1.2, DRAIN_BASE = 0.35;
  G.tickStaminaDrain = function (unit, dt) {
    if (unit.dead || unit.resting || !unit.assignedTaskId) return;
    const mult = G.equipmentStaminaMult(unit);
    const traitMult = G.unitTraitMod(unit, 'stamina', 1);
    let perkMult = 1;
    if (G.perkStaminaMult) {
      const t = G.state.tasks.find(x => x.id === unit.assignedTaskId);
      if (t) { const a = G.ACTIVITIES[t.activityId]; if (a) perkMult = G.perkStaminaMult(unit, a.skill); }
    }
    let weMult = G.worldEventStaminaMult ? G.worldEventStaminaMult() : 1;
    const tMult = G.timeStaminaMod ? G.timeStaminaMod() : 1;
    unit.stamina = Math.max(0, unit.stamina - DRAIN_BASE * mult * traitMult * perkMult * weMult * tMult * dt);
  };
  G.tickStaminaRegen = function (unit, dt) {
    if (unit.dead || !unit.resting) return;
    let mult = 1;
    if (unit.restingAt && G.settlementBonuses) {
      const b = G.settlementBonuses(unit.restingAt);
      mult = b.restMult;
    }
    unit.stamina = Math.min(unit.maxStamina, unit.stamina + REGEN_BASE * mult * dt);
    if (unit.mood != null && unit.mood < 90) unit.mood = Math.min(90, unit.mood + 0.4 * mult * dt);
    if (unit.stamina >= unit.maxStamina) {
      unit.resting = false; unit.restingAt = null; unit.status = 'idle';
      G.log(`💪 ${unit.name} je odpočatý.`, 'social');
    }
  };
  G.tickRestCheck = function () {
    for (const u of G.state.units) {
      if (u.dead || u.onExpedition) continue;
      if (u.resting) continue;
      if (u.stamina < REST_THRESHOLD) G.sendToRest(u, true);
    }
  };
  G.sendToRest = function (unit, auto) {
    if (unit.dead || unit.resting) return;
    if (unit.assignedTaskId) G.cancelTask(unit.assignedTaskId);
    unit.resting = true; unit.status = 'resting';
    let best = null, bestD = Infinity;
    for (const s of G.WORLD.settlements) {
      const d = Math.hypot(s.x + 0.5 - unit.pos.x, s.y + 0.5 - unit.pos.y);
      if (d < bestD) { bestD = d; best = s; }
    }
    unit.restingAt = best ? best.id : null;
    if (!auto) G.log(`😴 ${unit.name} jde odpočívat.`, 'social');
    else G.log(`😴 ${unit.name} je vyčerpaný a jde odpočívat.`, 'social');
  };
  G.wakeUnit = function (unit) {
    if (!unit.resting) return;
    unit.resting = false; unit.restingAt = null; unit.status = 'idle';
  };

  /* ---------- základna ---------- */
  G.baseBuildingLevel = function (buildingId) {
    if (!G.state.base || !G.state.base.buildings) return 0;
    return G.state.base.buildings[buildingId] || 0;
  };
  G.canBuildBase = function (buildingId) {
    const def = G.BASE_BUILDINGS[buildingId];
    if (!def) return { ok:false, reason:'Neznámá budova.' };
    const lvl = G.baseBuildingLevel(buildingId);
    if (lvl >= def.maxLevel) return { ok:false, reason:'Maximální úroveň.' };
    const cost = def.cost(lvl + 1);
    if (G.state.resources.gold < cost.gold) return { ok:false, reason:`Potřebuješ ${cost.gold} zlata.` };
    for (const m of cost.materials) {
      if (G.matCount(m.material) < m.qty) return { ok:false, reason:`Chybí ${m.qty}× ${G.MATERIALS[m.material].name}.` };
    }
    return { ok:true, cost };
  };
  G.buildBase = function (buildingId) {
    const check = G.canBuildBase(buildingId);
    if (!check.ok) return check;
    const cost = check.cost;
    G.state.resources.gold -= cost.gold;
    G.state.stats.goldSpent = (G.state.stats.goldSpent || 0) + cost.gold;
    for (const m of cost.materials) G.matRemove(m.material, m.qty);
    if (!G.state.base) G.state.base = { unlocked:true, buildings:{}, accum:{} };
    if (!G.state.base.buildings) G.state.base.buildings = {};
    G.state.base.buildings[buildingId] = (G.state.base.buildings[buildingId] || 0) + 1;
    const def = G.BASE_BUILDINGS[buildingId];
    G.log(`🏗️ Základna: ${def.name} na úroveň ${G.state.base.buildings[buildingId]}.`, 'work');
    return { ok:true, level: G.state.base.buildings[buildingId] };
  };
  G.tryUnlockBase = function () {
    if (G.state.base && G.state.base.unlocked) return false;
    if (G.state.resources.renown < G.BASE_UNLOCK.renown) return false;
    if (!G.state.base) G.state.base = { unlocked:false, buildings:{}, accum:{} };
    G.state.base.unlocked = true;
    G.state.base.x = G.BASE_POS.x;
    G.state.base.y = G.BASE_POS.y;
    G.log(`🏕️ Odemknuta tvá základna! (${G.BASE_POS.x}, ${G.BASE_POS.y}).`, 'work');
    return true;
  };
  let baseTimer = 0;
  const BASE_INTERVAL = 2;
  G.tickBase = function (dt) {
    baseTimer += dt;
    if (baseTimer < BASE_INTERVAL) return;
    const step = baseTimer; baseTimer = 0;
    if (!G.state.base || !G.state.base.unlocked) return;
    if (!G.state.base.accum) G.state.base.accum = {};
    for (const bid in G.BASE_BUILDINGS) {
      const def = G.BASE_BUILDINGS[bid];
      const lvl = G.baseBuildingLevel(bid);
      if (lvl <= 0) continue;
      const rate = def.rate(lvl);
      const add = rate * step;
      const accum = (G.state.base.accum[bid] || 0) + add;
      const whole = Math.floor(accum);
      if (whole > 0) {
        const q = G.chance(G.BASE_FINE_CHANCE) ? 'fine' : 'common';
        G.matAdd(def.produces, whole, q);
        G.state.base.accum[bid] = accum - whole;
      } else G.state.base.accum[bid] = accum;
    }
  };
  G.baseProductionSummary = function () {
    const out = {};
    if (!G.state.base || !G.state.base.unlocked) return out;
    for (const bid in G.BASE_BUILDINGS) {
      const def = G.BASE_BUILDINGS[bid];
      const lvl = G.baseBuildingLevel(bid);
      if (lvl <= 0) continue;
      const perHour = def.rate(lvl) * 3600;
      out[def.produces] = (out[def.produces] || 0) + perHour;
    }
    return out;
  };

  /* ---------- prestiž ---------- */
  G.PRESTIGE_REQUIREMENTS = { renown: 75, goldEarned: 2500, units: 8 };
  G.prestigeXpMult = function () {
    const lvl = (G.state.prestige && G.state.prestige.level) || 0;
    return 1 + 0.15 * lvl;
  };
  G.prestigeStartGold = function () {
    const lvl = (G.state.prestige && G.state.prestige.level) || 0;
    return 40 + 30 * lvl;
  };
  G.prestigeStartUnits = function () {
    const lvl = (G.state.prestige && G.state.prestige.level) || 0;
    return Math.min(3, lvl);
  };
  G.prestigeStatus = function () {
    const req = G.PRESTIGE_REQUIREMENTS;
    const renown = G.state.resources.renown;
    const goldEarned = G.state.stats.goldEarned || 0;
    const units = G.state.units.filter(u => !u.dead).length;
    const items = [
      { key:'renown',     label:'Renomé',         have: renown,     need: req.renown,     ok: renown >= req.renown },
      { key:'goldEarned', label:'Vydělané zlato', have: goldEarned, need: req.goldEarned, ok: goldEarned >= req.goldEarned },
      { key:'units',      label:'Živé postavy',   have: units,      need: req.units,      ok: units >= req.units }
    ];
    return { ok: items.every(i => i.ok), items };
  };
  G.doPrestige = function () {
    const st = G.prestigeStatus();
    if (!st.ok) return { ok:false, reason:'Podmínky ještě nesplněny.' };
    const oldLevel = (G.state.prestige && G.state.prestige.level) || 0;
    const newLevel = oldLevel + 1;
    G.state = G.newState();
    G.state.prestige = { level: newLevel, totalPrestige: newLevel };
    const startGold = G.prestigeStartGold();
    const extraUnits = G.prestigeStartUnits();
    const names = ['Aldo','Bram','Cira','Dara','Egon'];
    const units = [];
    for (let i = 0; i < 3 + extraUnits; i++) units.push(G.createUnit(names[i] || undefined));
    const start = G.WORLD.settlementById['svitavy'];
    if (start) {
      units.forEach((u, i) => {
        const a = (i / units.length) * Math.PI * 2;
        u.pos = { x: start.x + 0.5 + Math.cos(a)*1.2, y: start.y + 0.5 + Math.sin(a)*1.2 };
      });
      G.state.camera.x = start.x + 0.5;
      G.state.camera.y = start.y + 0.5;
      G.state.camera.zoom = 1.0;
      G.state.selected = { type:'settlement', id:'svitavy' };
      G.state.stats.settlementsVisited = ['svitavy'];
    }
    G.state.units = units;
    const g = G.createGroup('Dobrodruzi');
    g.memberIds = units.map(u => u.id);
    units.forEach(u => u.groupId = g.id);
    G.state.resources.gold = startGold;
    G.initEconomy();
    for (const s of G.WORLD.settlements) G.ensureQuests(s.id);
    G.log(`🌟 PRESTIŽ ${newLevel}! Svět se restartoval.`, 'story');
    G.save();
    return { ok:true, level: newLevel };
  };
})();
